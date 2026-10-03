// Quién firma una checklist — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/signer.test.js
//
// Lo que importa acá no es que el selector se vea, sino:
//  · que se guarde el staff_id en completed_by (la columna existía y nunca se
//    escribía), y
//  · que NO se toque `role`, que identifica QUÉ checklist se firmó y no quién.
//    Pisarla rompería Logged Checklists entero.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

const TRIPULACION=[
  {id:'u-ana',  full_name:'Ana Diaz',  role:'instructor', custom_role_name:null},
  {id:'u-luke', full_name:'Luke Roy',  role:'deckhand',   custom_role_name:null},
  {id:'u-fran', full_name:'Franco R.', role:'manager',    custom_role_name:null},
];
let insertados=[];
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({
      data: n==='staff'?TRIPULACION:[], count:0, error:null}).then(res,rej);
    if(prop==='insert') return (payload)=>{ insertados.push(payload); return Promise.resolve({error:null}); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),
        getUser:async()=>({data:{user:{id:'u-fran'}}}),   // sesión: el gerente
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n), functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={setOrg:(id)=>{currentOrgId=id;},setRole:(r)=>{currentUserRole=r;},"+
  "setTrip:(id)=>{currentChecklistTripId=id;},sb:()=>sb,offline:(v)=>{isOffline=v;}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setRole('manager'); window.__t.offline(false);
window.showAlertModal = async(m)=>{ window.__ultimoAviso=m; };
window.showConfirmModal = async()=>true;

(async()=>{ try {
  // ── El selector reemplazó al texto libre ──
  chk('no quedan campos de texto para el nombre',
      doc.querySelectorAll('input[data-i18n-placeholder="cl_your_name"]').length===0);
  const ids=['cl-instructor-name','dept-routine-name'];
  ids.forEach(id=>{
    const el=doc.getElementById(id);
    chk(`#${id} es un selector`, el && el.tagName==='SELECT', el?el.tagName:'no existe');
  });

  // ── Se puebla con la tripulación, con el usuario actual ya elegido ──
  await window.populateSignerSelects();
  const sel=doc.getElementById('cl-instructor-name');
  chk('ofrece a los 3 tripulantes (+ la opción vacía)', sel.options.length===4, 'opciones: '+sel.options.length);
  chk('preselecciona al usuario de la sesión', sel.value==='u-fran', 'quedó: '+sel.value);
  chk('muestra el rol al lado del nombre', /Franco R\./.test(sel.options[3].textContent));

  // ── Firma el gerente: se guarda su id, y `role` queda como la checklist ──
  window.__t.setTrip('trip-1');
  insertados=[];
  await window.instructorSignOff();
  chk('se insertó una fila', insertados.length===1, 'filas: '+insertados.length);
  const f=insertados[0]||{};
  chk('completed_by lleva el staff_id', f.completed_by==='u-fran', 'completed_by='+f.completed_by);
  chk('signed_by lleva el nombre de la nómina', f.signed_by==='Franco R.', 'signed_by='+f.signed_by);
  chk('role sigue identificando la CHECKLIST, no a la persona',
      f.role==='instructor', 'role='+f.role);
  chk('role NO quedó con el rol de la persona', f.role!=='manager');

  // ── Firma otro tripulante desde la misma tablet ──
  sel.value='u-luke';
  insertados=[];
  await window.instructorSignOff();
  const g=insertados[0]||{};
  chk('tablet compartida: queda registrado el que firmó, no el de la sesión',
      g.completed_by==='u-luke' && g.signed_by==='Luke Roy',
      'completed_by='+g.completed_by+' signed_by='+g.signed_by);

  // ── Sin elegir a nadie no se firma ──
  sel.value='';
  insertados=[];
  window.__ultimoAviso=null;
  await window.instructorSignOff();
  chk('sin firmante no inserta nada', insertados.length===0);
  chk('y avisa', !!window.__ultimoAviso, String(window.__ultimoAviso));

  // ── Sin conexión: el mismo payload va a la cola ──
  const cola=[];
  window.queueOfflineAction=(tipo,payload)=>cola.push({tipo,payload});
  window.__t.offline(true);
  sel.value='u-ana';
  await window.instructorSignOff();
  chk('offline: encola en vez de insertar', cola.length===1);
  chk('offline: la cola también lleva completed_by',
      cola[0] && cola[0].payload.completed_by==='u-ana', JSON.stringify(cola[0]&&cola[0].payload||{}).slice(0,120));

  process.exit(fail);
} catch(e){ console.log('EXCEPCIÓN:', e && (e.stack||String(e))); process.exit(1);} })();
