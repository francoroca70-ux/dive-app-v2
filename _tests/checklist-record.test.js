// El acta de una checklist firmada — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/checklist-record.test.js
//
// Lo que importa no es que se guarde "algo", sino que el acta pueda LEERSE
// SOLA dentro de cinco años: por eso guarda el texto de cada ítem y no sólo
// su id. Las plantillas van a cambiar (checklists por tipo de salida) y un
// registro con ids se vuelve ilegible en cuanto cambien.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;
const TRIPULACION=[{id:'u-ana',full_name:'Ana Diaz',role:'instructor',custom_role_name:null}];
let insertados=[];
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:n==='staff'?TRIPULACION:[],count:0,error:null}).then(res,rej);
    if(prop==='insert') return (p)=>{ insertados.push(p); return Promise.resolve({error:null}); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-ana'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={setOrg:(id)=>{currentOrgId=id;},setRole:(r)=>{currentUserRole=r;},"+
  "setTrip:(id)=>{currentChecklistTripId=id;},offline:(v)=>{isOffline=v;},sb:()=>sb,"+
  "marcar:(tripId,obj)=>{instructorChecksByTrip[tripId]=obj;},items:()=>INSTRUCTOR_ITEMS_get()};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setRole('instructor'); window.__t.offline(false);
window.showAlertModal=async()=>{}; window.showConfirmModal=async()=>true;

(async()=>{ try {
  // ── buildItemsSnapshot ──
  const items=[{id:'a',text:'Tanques a bordo'},{id:'b',text:'Botiquín abastecido'}];
  let snap=window.buildItemsSnapshot(items,(it)=>it.id==='a');
  chk('el acta guarda el TEXTO, no sólo el id', snap[0].text==='Tanques a bordo', JSON.stringify(snap[0]));
  chk('marca lo tildado', snap[0].done===true);
  chk('marca lo NO tildado', snap[1].done===false);
  // Ítems de texto suelto, indexados por posición (checklists personalizadas)
  snap=window.buildItemsSnapshot(['Toallas','Hielo'],(_i,idx)=>idx===1);
  chk('funciona con ítems de texto suelto', snap[0].text==='Toallas' && snap[1].done===true, JSON.stringify(snap));
  chk('les inventa un id estable por posición', snap[0].id==='0' && snap[1].id==='1');

  // ── Firma incompleta: tiene que quedar registrado QUÉ faltó ──
  await window.populateSignerSelects();
  window.__t.setTrip('trip-1');
  const todos=window.__t.items();
  const tildados={}; todos.slice(0,3).forEach(i=>tildados[i.id]=true);   // 3 de 14
  window.__t.marcar('trip-1',tildados);
  insertados=[];
  await window.instructorSignOff();
  const f=insertados[0]||{};
  chk('se guardó el acta', Array.isArray(f.items_snapshot), typeof f.items_snapshot);
  chk('el acta tiene TODOS los ítems, no sólo los tildados',
      f.items_snapshot.length===todos.length, f.items_snapshot.length+' de '+todos.length);
  chk('los números siguen coincidiendo con el acta',
      f.items_snapshot.filter(i=>i.done).length===f.completed_items, f.completed_items);
  const faltantes=f.items_snapshot.filter(i=>!i.done);
  chk('se puede responder QUÉ faltó', faltantes.length===todos.length-3, faltantes.length+' faltantes');
  chk('y cada faltante se lee solo, sin la plantilla al lado',
      faltantes.every(i=>typeof i.text==='string' && i.text.length>5), JSON.stringify(faltantes[0]));

  // ── Sin conexión: el acta también viaja en la cola ──
  const cola=[]; window.queueOfflineAction=(tipo,payload)=>cola.push({tipo,payload});
  window.__t.offline(true);
  await window.instructorSignOff();
  chk('offline: la cola lleva el acta completa',
      cola[0] && Array.isArray(cola[0].payload.items_snapshot) &&
      cola[0].payload.items_snapshot.length===todos.length);
  window.__t.offline(false);

  // ── La pantalla del historial ──
  chk('existe el abrir/cerrar del detalle', typeof window.toggleLoggedDetail==='function');
  const cont=doc.createElement('div'); cont.id='cl-logged-detail-X'; cont.style.display='none';
  doc.body.appendChild(cont);
  window.toggleLoggedDetail('X');
  chk('abre el detalle', cont.style.display==='block');
  window.toggleLoggedDetail('X');
  chk('y lo cierra', cont.style.display==='none');
  window.toggleLoggedDetail('no-existe');   // no debe explotar
  chk('un id inexistente no rompe nada', true);

  process.exit(fail);
} catch(e){ console.log('EXCEPCIÓN:', e && (e.stack||String(e))); process.exit(1);} })();
