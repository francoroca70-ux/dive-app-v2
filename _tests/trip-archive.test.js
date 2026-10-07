// Quitar una salida del calendario — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/trip-archive.test.js
//
// El bug que esto cierra: el botón borraba en cinco pedidos HTTP sueltos
// —pagos, participantes, reservas, tripulación y recién la salida— sin
// controlar un solo error. Cada pedido es su propia transacción, así que los
// cuatro primeros commiteaban. Si el quinto fallaba (y fallaba SIEMPRE que la
// salida tuviera un waiver firmado, porque `waivers.trip_id` bloquea), la
// salida quedaba viva con sus reservas, participantes y pagos ya borrados.
//
// Así que lo que se prueba no es «se llamó a la función»: es que **el botón ya
// no puede destruir nada** y que cuando algo falla, el usuario se entera.
//
// OJO (trampas del arnés, aprendidas peleándolas):
//  · La app arranca en INGLÉS. Las aserciones van contra el texto inglés; que
//    cada clave exista también en español lo cubre el chequeo de i18n del final.
//  · `currentTripId` se pone en null cuando la operación termina bien, así que
//    cada caso tiene que volver a abrir una salida o cae en el return temprano.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// Toda escritura queda registrada. Si el botón borra algo, se ve.
let borrados=[]; let rpcs=[]; let respuestas=[];
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:[],count:0,error:null}).then(res,rej);
    if(prop==='delete') return ()=>{ borrados.push(n); return new Proxy({},h); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-fran'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n),
  // Una respuesta por llamada, para poder hacer que falle la ejecución y no la consulta.
  rpc:(nombre,args)=>{ rpcs.push({nombre,args});
        const r=respuestas.shift()||{data:null,error:null};
        return Promise.resolve(r); },
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={setOrg:(id)=>{currentOrgId=id;},"+
  "setTrip:(id)=>{currentTripId=id;},getTrip:()=>currentTripId,"+
  "setRol:(r)=>{currentUserRole=r;},"+
  "grupos:(g)=>{tripGroups_cache=g;}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setRol('owner');
let avisos=[]; let confirmaciones=[]; let responderConfirm=true;
window.showAlertModal=async(m)=>{ avisos.push(String(m)); };
window.showConfirmModal=async(m)=>{ confirmaciones.push(String(m)); return responderConfirm; };
window.renderCalendar=()=>{}; window.checkDoubleBookings=()=>{};

const ok=(data)=>({data,error:null});
const err=(m)=>({data:null,error:{message:m}});

// Cada caso abre una salida de nuevo: la operación exitosa deja currentTripId
// en null, y sin esto los clics siguientes salen por el return temprano.
async function clic({previo, ejecucion, confirmar=true, trip='trip-1', grupos=[{id:'g-1'}]}){
  borrados=[]; rpcs=[]; avisos=[]; confirmaciones=[]; responderConfirm=confirmar;
  respuestas=[previo]; if(ejecucion) respuestas.push(ejecucion);
  window.__t.setTrip(trip); window.__t.grupos(grupos);
  doc.getElementById('modal-trip').style.display='block';
  doc.getElementById('btn-delete-trip').dispatchEvent(new window.Event('click'));
  await new Promise(r=>setTimeout(r,0));
}

(async()=>{ try {

  // ─── Lo que importa: ya no puede destruir nada ───
  const conHistoria={accion:'archivaria',reservas:2,participantes:5,pagos:1,waivers:3,actas:1,tripulacion:2};
  await clic({previo:ok(conHistoria), ejecucion:ok({accion:'archivada'})});
  chk('el botón NO borra ninguna tabla', borrados.length===0, 'borró: '+JSON.stringify(borrados));
  chk('todo pasa por una sola llamada atómica',
      rpcs.length===2 && rpcs.every(r=>r.nombre==='trip_archive_or_delete'),
      rpcs.map(r=>r.nombre).join(','));
  chk('la consulta previa va en modo consulta y la ejecución no',
      rpcs[0].args.p_solo_consultar===true && rpcs[1].args.p_solo_consultar===false,
      JSON.stringify(rpcs.map(r=>r.args.p_solo_consultar)));

  const aviso=confirmaciones[0]||'';
  chk('avisa que se va a archivar, no eliminar', /archived, not deleted/i.test(aviso), aviso.slice(0,80));
  chk('y enumera lo que está en juego',
      /2 booking/.test(aviso) && /5 guest/.test(aviso) && /3 signed waiver/.test(aviso)
      && /1 signed checklist/.test(aviso) && /2 crew/.test(aviso), aviso.slice(0,170));
  chk('no miente diciendo que no se puede deshacer', !/cannot be undone/i.test(aviso), aviso.slice(0,60));
  chk('al archivar, confirma que el historial se conserva',
      /history is kept/i.test(avisos[0]||''), avisos[0]||'(ningún aviso)');
  chk('y cierra la salida', window.__t.getTrip()===null, String(window.__t.getTrip()));

  // Sólo lo que tiene algo se enumera: un aviso con "0 pagos" es ruido.
  await clic({previo:ok({accion:'archivaria',reservas:1,participantes:0,pagos:0,waivers:0,actas:0,tripulacion:0}),
              ejecucion:ok({accion:'archivada'})});
  chk('no enumera lo que está en cero', !/0 /.test(confirmaciones[0]||''), (confirmaciones[0]||'').slice(0,110));

  // ─── Salida vacía: ahí sí se borra, y el aviso lo dice ───
  await clic({previo:ok({accion:'borraria',reservas:0,participantes:0,pagos:0,waivers:0,actas:0,tripulacion:0}),
              ejecucion:ok({accion:'borrada'})});
  chk('una salida vacía avisa que se elimina de verdad',
      /empty/i.test(confirmaciones[0]||'') && /for good/i.test(confirmaciones[0]||''), (confirmaciones[0]||'').slice(0,90));
  chk('tampoco borra tabla por tabla', borrados.length===0, JSON.stringify(borrados));
  chk('y confirma la eliminación', /deleted/i.test(avisos[0]||''), avisos[0]||'');

  // ─── Cancelar no hace nada ───
  await clic({previo:ok(conHistoria), confirmar:false});
  chk('si el usuario cancela, la ejecución no ocurre', rpcs.length===1, rpcs.length+' llamadas');
  chk('y la salida sigue abierta', window.__t.getTrip()==='trip-1', String(window.__t.getTrip()));

  // ─── El error ahora se ve. Antes fallaba y la pantalla seguía igual. ───
  await clic({previo:err('permission denied')});
  chk('si la consulta previa falla, se lo dice al usuario',
      /Couldn't remove the trip/i.test(avisos[0]||''), avisos[0]||'(ningún aviso)');
  chk('y no pide confirmar algo que no va a poder hacer', confirmaciones.length===0, confirmaciones.length+'');
  chk('la salida no se cierra si falló', window.__t.getTrip()==='trip-1', String(window.__t.getTrip()));

  await clic({previo:ok(conHistoria), ejecucion:err('violates foreign key constraint')});
  chk('si falla la EJECUCIÓN, también se lo dice',
      /Couldn't remove the trip/i.test(avisos[0]||''), avisos[0]||'(ningún aviso)');
  chk('y el error real aparece en el mensaje',
      /foreign key/i.test(avisos[0]||''), avisos[0]||'');
  chk('la salida queda abierta para reintentar', window.__t.getTrip()==='trip-1', String(window.__t.getTrip()));
  chk('y el modal no se cerró',
      doc.getElementById('modal-trip').style.display!=='none',
      doc.getElementById('modal-trip').style.display);

  // ─── Ya archivada: no vuelve a preguntar ───
  await clic({previo:ok({accion:'ya_archivada',archivada_el:'2026-10-07T00:00:00Z'})});
  chk('una salida ya archivada lo dice y corta', /already archived/i.test(avisos[0]||''), avisos[0]||'');
  chk('sin pedir confirmación ni ejecutar nada',
      confirmaciones.length===0 && rpcs.length===1, 'conf '+confirmaciones.length+' / rpc '+rpcs.length);

  // ─── Quién puede quitar una salida ───
  // Antes el botón se le mostraba a cualquiera. Mientras el borrado fallaba
  // solo casi no importaba; ahora que archivar funciona, un tripulante podría
  // sacar del calendario una salida con reservas y pagos.
  const botonVisible=()=>{ window.mostrarBotonQuitarSalida();
    return doc.getElementById('btn-delete-trip').style.display!=='none'; };
  window.__t.setRol('owner');    chk('el dueño ve el botón',      botonVisible()===true);
  window.__t.setRol('manager');  chk('el encargado ve el botón',  botonVisible()===true);
  window.__t.setRol('captain');  chk('el capitán NO lo ve',       botonVisible()===false);
  window.__t.setRol('deckhand'); chk('un tripulante NO lo ve',    botonVisible()===false);
  window.__t.setRol('instructor');chk('un instructor NO lo ve',   botonVisible()===false);
  window.__t.setRol(undefined);  chk('un rol desconocido NO lo ve (falla cerrado)', botonVisible()===false);
  window.__t.setRol('owner');
  chk('el permiso de quitar una salida se decide en un solo lugar',
      (html.match(/function puedeQuitarSalida\(\)/g)||[]).length===1 &&
      (html.match(/puedeQuitarSalida\(\)/g)||[]).length===2,   // la declaración + un uso
      (html.match(/puedeQuitarSalida\(\)/g)||[]).length+' menciones');
  chk('y los dos lugares que muestran el botón pasan por la misma función',
      (html.match(/mostrarBotonQuitarSalida\(\);/g)||[]).length===2,
      (html.match(/mostrarBotonQuitarSalida\(\);/g)||[]).length+' llamadas');

  // ─── Guardián estructural: ninguna lista puede olvidarse el filtro ───
  // Eran nueve consultas de lista. Filtrar a mano en nueve es el patrón donde
  // el defecto aparece donde la copia FALTA: alcanza con que una vista se
  // olvide para que el centro vea una salida que creía quitada.
  const crudasConSelect=[...html.matchAll(/from\('trips'\)\s*\n?\s*\.select\(/g)].length;
  chk('sólo quedan 3 consultas crudas: el helper y las dos excepciones',
      crudasConSelect===3, crudasConSelect+' consultas crudas con select');
  chk('las dos excepciones están documentadas como tales',
      (html.match(/A propósito NO usa tripsVigentes\(\)/g)||[]).length===2,
      (html.match(/A propósito NO usa tripsVigentes\(\)/g)||[]).length+' comentarios');
  // Total de menciones, menos la declaración, menos las dos que viven dentro
  // de los comentarios de excepción. Lo que queda son llamadas reales.
  const mencionesHelper=(html.match(/tripsVigentes\(/g)||[]).length;
  const enComentarios=(html.match(/NO usa tripsVigentes\(\)/g)||[]).length;
  const llamadasHelper=mencionesHelper-1-enComentarios;
  chk('las ocho consultas de lista pasan por el helper',
      llamadasHelper===8, llamadasHelper+' llamadas reales');
  chk('el helper es el único que filtra, y filtra por archived_at',
      /function tripsVigentes\(cols\) \{\s*\n\s*return sb\.from\('trips'\)\.select\(cols\)\.is\('archived_at', null\);/.test(html));
  chk('el export del historial completo SÍ incluye archivadas',
      /archived_at, boats\(name\)/.test(html), 'pide archived_at en el export');
  chk('ya no quedan los cinco borrados sueltos del botón',
      !/from\('trip_groups'\)\.delete\(\)\.eq\('trip_id', currentTripId\)/.test(html) &&
      !/from\('trips'\)\.delete\(\)\.eq\('id', currentTripId\)/.test(html), 'secuencia vieja ausente');
  chk('el choque de barcos ya no cuenta salidas archivadas',
      /Una salida archivada no puede generar un choque de barco/.test(html));

  // ─── Los textos existen en los dos idiomas ───
  const claves=['tt_del_empty_confirm','tt_del_archive_confirm','tt_del_archived_ok',
                'tt_del_deleted_ok','tt_del_already','tt_del_failed',
                'tt_del_n_bookings','tt_del_n_guests','tt_del_n_payments',
                'tt_del_n_waivers','tt_del_n_records','tt_del_n_crew'];
  const faltan=claves.filter(k=>(html.match(new RegExp(k+':','g'))||[]).length<2);
  chk('cada texto nuevo está en inglés y en español', faltan.length===0, faltan.join(', ')||'las 12 en ambos');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
  process.exit(fail);
})();
