// Quién firma una checklist — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/signer.test.js
//
// Lo que importa acá no es que el selector se vea, sino:
//  · que se guarde el staff_id en completed_by (la columna existía y nunca se
//    escribía),
//  · que NO se toque `role`, que identifica QUÉ checklist se firmó y no quién.
//    Pisarla rompería Logged Checklists entero, y
//  · que SÓLO pueda firmar quien participó (09/10). Antes el selector ofrecía a
//    toda la tripulación del local, así que un marinero podía firmar la revisión
//    de seguridad de la embarcación como el capitán, que ni estuvo. En palabras
//    de Fran: «nadie puede firmar por alguien que no participó en ese
//    checklist».
//
// Este archivo cambió de opinión el 09/10: las dos comprobaciones que decían
// «ofrece a los 3 tripulantes» y «tablet compartida: firma otro tripulante»
// afirmaban justo lo que se cerró. Quedan abajo dadas vuelta, como guardián.
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
  "setTrip:(id)=>{currentChecklistTripId=id;},sb:()=>sb,offline:(v)=>{isOffline=v;},"+
  // `currentUserId` reemplazó al `await sb.auth.getUser()` que hacía
  // populateSignerSelects: un viaje de red para saber quién sos, en cada
  // dibujo. Ahora sale de la sesión, cacheado al arrancar.
  "yo:(id)=>{currentUserId=id;},tripulacion:(xs)=>{signerStaffCache=xs;},"+
  "tildes:(k,c,a)=>{progressCache[k]=c;anotarAutoria(c,a||{});},"+
  "checksInstructor:(id,c)=>{instructorChecksByTrip[id]=c;}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setRole('manager'); window.__t.offline(false);
window.__t.yo('u-fran');                 // la sesión es del gerente
window.__t.tripulacion(TRIPULACION);
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

  // ── Sólo puede firmar quien participó, más vos ──
  //
  // El agujero que esto cierra: antes el selector traía a los 3, así que Luke
  // (marinero) podía firmar como Ana la checklist del instructor sin que Ana
  // hubiera tocado nada.
  await window.populateSignerSelects();
  const sel=doc.getElementById('cl-instructor-name');
  chk('sin tildes, el único firmante posible sos vos (+ la opción vacía)',
      sel.options.length===2, 'opciones: '+sel.options.length);
  chk('preselecciona al usuario de la sesión', sel.value==='u-fran', 'quedó: '+sel.value);
  chk('NO ofrece a la tripulación que no participó',
      !/u-ana|u-luke/.test(sel.innerHTML), sel.innerHTML.replace(/\s+/g,' ').slice(0,160));
  chk('muestra el rol al lado del nombre', /Franco R\./.test(sel.options[1].textContent));

  // Y vos estás SIEMPRE, hayas tildado o no: estás presente y autenticado, que
  // es más de lo que se puede decir de cualquier otro nombre. Sin esto, una
  // checklist que nadie tildó no se podría firmar nunca — y «la revisamos y no
  // se hizo nada» es un registro legítimo.
  chk('se puede firmar una checklist sin un solo tilde', sel.value==='u-fran');

  // Ahora Ana tilda algo: pasa a ser firmante posible, sin recargar.
  const checksCompartidos={ '0':true };
  window.__t.tildes('instructor:trip-1', checksCompartidos,
    { '0': { id:'u-ana', name:'Ana Diaz', at:'2026-10-09T10:00:00Z' } });
  window.poblarFirmantesDe('cl-instructor-name', checksCompartidos);
  chk('quien tilda aparece como firmante posible',
      sel.options.length===3 && /u-ana/.test(sel.innerHTML), 'opciones: '+sel.options.length);
  chk('y Luke, que no tildó nada, sigue afuera', !/u-luke/.test(sel.innerHTML));
  chk('tu elección no se pierde al repoblarse', sel.value==='u-fran', 'quedó: '+sel.value);

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
  // Quién APRETÓ firmar, además de quién figura firmando. El desplegable sigue
  // siendo una declaración —se puede firmar como alguien que sí participó— y
  // eso no se previene porque rompe un caso real (a Juanma se le muere el
  // celular y Franco termina y firma). Se registra, y queda auditable.
  chk('el acta registra la cuenta que apretó firmar',
      f.signed_by_account==='u-fran', 'signed_by_account='+f.signed_by_account);

  // ── El agujero cerrado: no se puede firmar como quien no participó ──
  //
  // Antes esto era una comprobación que PASABA y describía la tablet
  // compartida. Desde el 09/10 afirma lo contrario: Luke no tildó nada, así
  // que ni siquiera se puede elegir.
  sel.value='u-luke';
  chk('elegir a quien no participó no prende', sel.value!=='u-luke', 'quedó: '+sel.value);

  // Ana sí tildó, así que sí puede figurar firmando — con la cuenta de Franco
  // registrada al lado, que es lo que lo hace auditable en vez de prevenido.
  sel.value='u-ana';
  insertados=[];
  await window.instructorSignOff();
  const g=insertados[0]||{};
  chk('quien participó puede figurar firmando',
      g.completed_by==='u-ana' && g.signed_by==='Ana Diaz',
      'completed_by='+g.completed_by+' signed_by='+g.signed_by);
  chk('y queda registrado que lo apretó otro',
      g.signed_by_account==='u-fran' && g.completed_by!==g.signed_by_account,
      'signed_by_account='+g.signed_by_account);

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
  chk('offline: y también la cuenta que firmó',
      cola[0] && cola[0].payload.signed_by_account==='u-fran');

  // ── Guardián estructural: una sola regla de quién puede firmar ──
  chk('la regla de quién puede firmar vive en una función',
      (html.match(/function opcionesDeFirmante\(/g)||[]).length===1 &&
      (html.match(/function poblarFirmantesDe\(/g)||[]).length===1);
  chk('ya no se ofrece toda la tripulación del local',
      !/staff\.map\(s => \{[\s\S]{0,200}?option value="\$\{s\.id\}"/.test(html));
  chk('el selector se repuebla al dibujar, porque la lista crece al tildar',
      /FIRMANTE_SELECT_POR_LISTA\[containerId\]/.test(html) &&
      (html.match(/const FIRMANTE_SELECT_POR_LISTA = \{/g)||[]).length===1);
  chk('las checklists propias pueblan una por tarjeta, no todas igual',
      /poblarFirmantesDe\(`custom-cl-name-\$\{cc\.id\}`/.test(html));

  process.exit(fail);
} catch(e){ console.log('EXCEPCIÓN:', e && (e.stack||String(e))); process.exit(1);} })();
