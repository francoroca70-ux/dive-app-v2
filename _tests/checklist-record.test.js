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

  // ── Una checklist firmada muestra lo que se revisó y lo que NO ──
  // Antes, al abrir una ya firmada se veía el cartel «completa» arriba de una
  // lista con nada tildado: firmar cierra la instancia y borra el trabajo en
  // curso (correcto), pero la pantalla seguía dibujando la lista viva, vacía.
  // Para el capitán que entra después eso no se lee como «ya está hecho», se
  // lee como que no se hizo nada — y lo que necesita ver es justamente que las
  // toallas NO se cargaron, para poder preguntar por qué.
  const contActa=doc.createElement('div'); contActa.id='acta-prueba';
  doc.body.appendChild(contActa);
  window.renderActaItems('acta-prueba', [
    {id:'a', text:'Toallas a bordo', done:false},
    {id:'b', text:'Tanques cargados', done:true}
  ], null);
  const html2=contActa.innerHTML;
  chk('el acta muestra los ítems que se revisaron', /Tanques cargados/.test(html2));
  chk('y también los que NO', /Toallas a bordo/.test(html2));
  const filas=[...contActa.querySelectorAll('.cl-item')];
  chk('lo hecho se ve tachado', filas[1].classList.contains('checked'), filas[1].className);
  chk('lo que faltó NO se ve tachado', !filas[0].classList.contains('checked'), filas[0].className);
  chk('y lo que faltó queda señalado, no sólo sin tilde',
      /cl-role-badge warn/.test(filas[0].innerHTML), filas[0].innerHTML.slice(0,120));
  chk('el acta no se puede tildar: no tiene onclick',
      filas.every(f=>!f.getAttribute('onclick')), 'sin onclick');
  chk('y se marca como acta para no parecer clicable',
      filas.every(f=>f.classList.contains('acta')));
  chk('dice que es un acta firmada y cómo hacer una pasada nueva',
      /cl-acta-nota/.test(html2) && /Reset|Reiniciar/i.test(html2), 'nota presente');

  // El texto del ítem lo escribe una persona y termina insertado como HTML.
  window.renderActaItems('acta-prueba', [{id:'x', text:'<img src=x onerror=alert(1)>', done:true}], null);
  chk('el texto del ítem se escapa',
      !/<img/.test(contActa.innerHTML) && /&lt;img/.test(contActa.innerHTML), contActa.innerHTML.slice(0,90));

  // Actas de antes del 06/10: no tienen detalle y no se puede reconstruir
  // (son inmutables). Tiene que decirlo, no mentir con una lista vacía.
  contActa.innerHTML='<div class="cl-item">algo</div>';
  window.mostrarActaSiHay('acta-prueba', {items_snapshot:null}, null);
  chk('un acta vieja sin detalle lo dice en vez de mostrar una lista vacía',
      /cl-acta-nota/.test(contActa.innerHTML), contActa.innerHTML.slice(0,110));

  // Los dos caminos que muestran una firmada usan la misma función.
  chk('la salida y la rutina de departamento comparten el arreglo',
      (html.match(/mostrarActaSiHay\(/g)||[]).length===3, // 1 declaración + 2 usos
      (html.match(/mostrarActaSiHay\(/g)||[]).length+' menciones');
  chk('y las dos consultas piden items_snapshot',
      (html.match(/signed_by, signed_at, completed_items, total_items, items_snapshot/g)||[]).length===2,
      'dos selects con el detalle');

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
