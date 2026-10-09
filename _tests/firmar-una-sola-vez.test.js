// Una checklist no se puede firmar dos veces — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/firmar-una-sola-vez.test.js
//
// El bug, medido en la base el 09/10 con Fran probando:
//
//   13:17:12  2/4   la parcial, correcta
//   13:17:49  4/4   la completa
//   13:17:51  4/4   LA MISMA OTRA VEZ
//
// 1,7 segundos no es un doble toque: es apretar, no ver que cambie nada, y
// volver a apretar. La causa: firmar NO redibujaba. El arreglo del 08/10 —«una
// checklist firmada muestra el acta, no la lista viva»— se había aplicado sólo
// al camino de CARGAR la pantalla, no al de firmar. Así que al firmar quedaba
// la lista viva tildada con el botón disponible, y el `checks` en memoria
// seguía teniendo los cuatro tildes: la segunda firma insertó otra acta 4/4.
//
// Dos cosas distintas lo protegen ahora, y las dos están probadas acá:
//  · el candado, para el doble toque mientras el primer insert viaja
//  · la comprobación contra el servidor, para dos celulares — el progreso es
//    compartido, así que Juanma puede firmar en el suyo sin que el mío se entere
//    hasta el refresco de diez segundos.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

const TRIPULACION=[{id:'u-fran',full_name:'Franco',role:'manager',custom_role_name:null}];
let insertados=[];
let actaEnLaBase=null;     // lo que el servidor dice que ya hay
let demoraDelInsert=0;     // para simular el viaje de red

function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({
      data: n==='staff' ? TRIPULACION : (actaEnLaBase?[actaEnLaBase]:[]),
      count:0, error:null}).then(res,rej);
    if(prop==='insert') return async (payload)=>{
      if(demoraDelInsert) await new Promise(r=>setTimeout(r,demoraDelInsert));
      insertados.push(payload);
      return {error:null};
    };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-fran'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  setOrg:(id)=>{currentOrgId=id;},setRole:(r)=>{currentUserRole=r;},
  setTrip:(id)=>{currentChecklistTripId=id;},offline:(v)=>{isOffline=v;},
  yo:(id)=>{currentUserId=id;},tripulacion:(xs)=>{signerStaffCache=xs;},
  items:()=>INSTRUCTOR_ITEMS_get(),
  marcar:(tripId,obj)=>{instructorChecksByTrip[tripId]=obj;},
  enCurso:()=>firmasEnCurso,
  buscar:(x)=>buscarActaVigente(x)
};`;
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,300):'');
if(boot) process.exit(1);

const T=window.__t;
T.setOrg('org-1'); T.setRole('manager'); T.offline(false);
T.yo('u-fran'); T.tripulacion(TRIPULACION);
let avisos=[];
window.showAlertModal=async(m)=>{avisos.push(String(m));};
window.showConfirmModal=async()=>true;

(async()=>{ try {

  const todos=T.items();
  const todoTildado={}; todos.forEach(i=>{ todoTildado[i.id]=true; });

  // ─── El caso de Fran: apretar, no ver nada, apretar otra vez ───
  actaEnLaBase=null;
  insertados=[];
  T.setTrip('trip-1'); T.marcar('trip-1',todoTildado);
  await window.populateSignerSelects();
  await window.instructorSignOff();
  chk('la primera firma inserta un acta', insertados.length===1, 'filas: '+insertados.length);
  chk('y es la lista completa', (insertados[0]||{}).completed_items===todos.length);

  // Ahora el servidor ya tiene el acta. Es exactamente el estado en que estaba
  // la app de Fran cuando volvió a apretar: el `checks` en memoria intacto.
  actaEnLaBase={signed_by:'Franco',signed_at:'2026-10-09T13:17:49Z',
                completed_items:todos.length,total_items:todos.length,items_snapshot:[]};
  insertados=[]; avisos=[];
  T.marcar('trip-1',todoTildado);
  await window.instructorSignOff();
  chk('la SEGUNDA firma no inserta nada', insertados.length===0, 'filas: '+insertados.length);
  chk('y explica que ya estaba firmada',
      /already signed/i.test(avisos[0]||''), avisos[0]||'(sin aviso)');
  chk('nombrando a quien firmó y cuándo',
      /Franco/.test(avisos[0]||''), avisos[0]||'');
  chk('y aclarando que no se reemplaza un acta',
      /never replaced|Reset/i.test(avisos[0]||''), avisos[0]||'');

  // ─── El doble toque, mientras el primer insert todavía viaja ───
  // El candado, no la comprobación: acá el servidor todavía no sabe nada.
  actaEnLaBase=null;
  insertados=[]; avisos=[];
  demoraDelInsert=40;
  T.setTrip('trip-2'); T.marcar('trip-2',todoTildado);
  await Promise.all([ window.instructorSignOff(), window.instructorSignOff() ]);
  demoraDelInsert=0;
  chk('dos toques simultáneos insertan UNA sola acta',
      insertados.length===1, 'filas: '+insertados.length);
  chk('y el segundo no molesta con un cartel (no pasó nada malo)',
      avisos.length===0, avisos[0]||'');
  chk('el candado queda liberado al terminar',
      T.enCurso().size===0, 'en curso: '+T.enCurso().size);

  // ─── Dos celulares: Juanma firmó y mi pantalla no se enteró ───
  // Esto es nuevo con el progreso compartido, y el refresco de diez segundos no
  // mira actas. Sin la comprobación, los dos firmamos y quedan dos actas.
  actaEnLaBase={signed_by:'Juanma',signed_at:'2026-10-09T13:20:00Z',
                completed_items:todos.length,total_items:todos.length,items_snapshot:[]};
  insertados=[]; avisos=[];
  T.setTrip('trip-3'); T.marcar('trip-3',todoTildado);
  await window.instructorSignOff();
  chk('si el otro firmó primero, no se agrega una segunda acta',
      insertados.length===0, 'filas: '+insertados.length);
  chk('y se dice quién la firmó, para que no parezca un error',
      /Juanma/.test(avisos[0]||''), avisos[0]||'');

  // ─── La pantalla: firmada no se vuelve a firmar ───
  actaEnLaBase={signed_by:'Franco',signed_at:'2026-10-09T13:17:49Z',
                completed_items:2,total_items:4,
                items_snapshot:[{id:'0',text:'Tanques',done:true,by:'Franco'},
                                {id:'1',text:'Toallas',done:false}]};
  await window.renderInstructorChecklistForTrip('trip-9');
  const btn=doc.getElementById('cl-instructor-signoff-btn');
  const sel=doc.getElementById('cl-instructor-name');
  chk('con acta, el botón de firmar no está', btn && btn.style.display==='none',
      btn?('display: '+btn.style.display):'no existe el botón');
  chk('y el selector de firmante tampoco', sel && sel.style.display==='none',
      sel?('display: '+sel.style.display):'no existe');
  chk('se ve el acta y no la lista viva',
      /cl-item acta/.test(doc.getElementById('cl-instructor-items').innerHTML));
  chk('con lo que NO se hizo marcado',
      /cl-item-falta/.test(doc.getElementById('cl-instructor-items').innerHTML));

  // Y al revés: volver a una sin firmar tiene que devolver el botón. Si la zona
  // se pintara sólo cuando hay acta, quedaba escondido para siempre.
  actaEnLaBase=null;
  await window.renderInstructorChecklistForTrip('trip-10');
  chk('sin acta, el botón vuelve', btn.style.display!=='none', 'display: '+btn.style.display);
  chk('y el selector también', sel.style.display!=='none', 'display: '+sel.style.display);

  // ─── El cartel de «firmada» se pinta DESPUÉS de que el acta entró ───
  // Antes se pintaba primero: si el servidor rechazaba, quedaba diciendo
  // «✓ firmada por Franco» arriba de un acta que no existía.
  chk('el cartel no se pinta antes del insert',
      !/doneBanner\.innerHTML = `✓[\s\S]{0,400}?await guardarActa/.test(html) &&
      (html.match(/function pintarFirmaDelInstructor\(/g)||[]).length===1 &&
      (html.match(/function pintarFirmaDeRutina\(/g)||[]).length===1);

  // ─── Guardianes estructurales ───
  // Se cuentan las LLAMADAS (`await firmarUnaSolaVez(`), no las apariciones del
  // nombre: un comentario que la menciona no es un uso. Contar apariciones ya
  // dio un falso positivo acá y falsos negativos en otros tests de esta suite.
  chk('la regla de firmar una sola vez vive en una función',
      (html.match(/async function firmarUnaSolaVez\(/g)||[]).length===1 &&
      (html.match(/await firmarUnaSolaVez\(/g)||[]).length===3,
      (html.match(/await firmarUnaSolaVez\(/g)||[]).length+' llamadas, una por camino');
  chk('los tres caminos que firman la usan',
      /firmarUnaSolaVez\(`instructor:\$\{tripId\}`/.test(html) &&
      /firmarUnaSolaVez\(deptScope\(\)\.scopeKey/.test(html) &&
      /firmarUnaSolaVez\(scopeKey,/.test(html));
  chk('firmar redibuja, que es lo que faltaba',
      /await renderInstructorChecklistForTrip\(tripId\);/.test(html) &&
      /await renderDeptRoutine\(\);\s*\n\s*return true;/.test(html));
  chk('la búsqueda del acta vigente está en un solo lugar',
      (html.match(/async function buscarActaVigente\(/g)||[]).length===1 &&
      (html.match(/buscarActaVigente\(/g)||[]).length>=4);
  chk('y las columnas del acta también',
      (html.match(/const COLUMNAS_DE_ACTA = /g)||[]).length===1 &&
      !/select\('signed_by, signed_at, completed_items, total_items, items_snapshot'\)/.test(html));
  chk('esconder la zona de firma es una sola regla',
      (html.match(/function pintarZonaDeFirma\(/g)||[]).length===1 &&
      (html.match(/pintarZonaDeFirma\(/g)||[]).length>=5);

  const faltan=['cl_ya_firmada'].filter(k=>(html.match(new RegExp(k+':','g'))||[]).length<2);
  chk('el texto nuevo está en los dos idiomas', faltan.length===0, faltan.join(', ')||'en ambos');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }
  process.exit(fail);
})();
