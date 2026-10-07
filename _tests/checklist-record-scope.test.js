// A qué local y a qué salida pertenece un acta — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/checklist-record-scope.test.js
//
// El hueco que cerró la etapa 1: el trabajo en curso distinguía de qué local
// era (el local va en la scope_key), pero una vez firmada, el acta no lo
// decía. Sólo tenía `boat_name`. Para un centro con varios locales, eso es un
// acta que no se puede atribuir.
//
// Y lo que se prueba no es que el campo exista, sino que el acta se pueda LEER
// SOLA: guarda el NOMBRE del local y de la salida, no sólo los ids, porque un
// local se cierra y una salida se borra. Las tres FKs del acta se soltaron a
// propósito por eso mismo — ver la migración checklist_records_*_sin_fk.
//
// OJO (trampa del arnés, ya documentada en los otros tests): `const sb` y
// `let currentOrgId` son léxicos y NO se ven desde `window` después de un eval
// indirecto. Por eso todo entra y sale por window.__t.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;
const TRIPULACION=[{id:'u-ana',full_name:'Ana Diaz',role:'instructor',custom_role_name:null}];
let insertados=[]; let encolados=[];
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:n==='staff'?TRIPULACION:[],count:0,error:null}).then(res,rej);
    if(prop==='insert') return (p)=>{ insertados.push(p); return Promise.resolve({error:null}); };
    if(prop==='upsert') return ()=>Promise.resolve({error:null});
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
const hook=main+"\n;window.__t={"+
  "setOrg:(id)=>{currentOrgId=id;},setRole:(r)=>{currentUserRole=r;},"+
  "setTrip:(id)=>{currentChecklistTripId=id;},offline:(v)=>{isOffline=v;},"+
  "local:(id,nom)=>{currentLocationId=id;currentLocationName=nom;},"+
  "nombreSalida:(id,nom,f,h)=>{checklistTripById[id]={name:nom,date:f||null,time:h||null};},"+
  "marcar:(tripId,obj)=>{instructorChecksByTrip[tripId]=obj;},"+
  "items:()=>INSTRUCTOR_ITEMS_get(),"+
  "dept:(k,c,checks)=>{currentDeptKey=k;currentCadenceKey=c;"+
  "  const r=departmentRoutinesGet()[k].cadences[c]; deptRoutineChecks[r.role]=checks; return r;},"+
  "propias:(arr)=>{customChecklists=arr;},"+
  "marcarPropia:(id,obj)=>{customChecklistChecks[id]=obj;},"+
  "cola:()=>offlineQueueGet?offlineQueueGet():null};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setRole('owner'); window.__t.offline(false);
window.showAlertModal=async()=>{}; window.showConfirmModal=async()=>true;
window.queueOfflineAction=(tipo,payload)=>{ encolados.push({tipo,payload}); };

(async()=>{ try {

  // ─── El constructor único ───
  // Si alguien vuelve a armar el acta a mano en uno de los tres lugares, esto
  // no lo detecta — pero el guardián estructural del final sí.
  window.__t.local('loc-norte','Local Norte');
  window.__t.nombreSalida('trip-1','Charter Mañana');
  const firmante={staff_id:'u-ana',name:'Ana Diaz'};
  let p=window.buildRecordPayload({role:'instructor',tripId:'trip-1',
    items:[{id:'a',text:'Tanques'}],estaTildado:()=>true,signer:firmante,hechos:1});
  chk('el acta dice en qué local se firmó (id)', p.location_id==='loc-norte', p.location_id);
  chk('y lo dice con el NOMBRE, que se lee solo', p.location_name==='Local Norte', p.location_name);
  chk('el acta dice a qué salida correspondía', p.trip_name==='Charter Mañana', p.trip_name);
  chk('y conserva el id como puntero', p.trip_id==='trip-1', p.trip_id);

  // Una rutina de departamento no tiene salida. Tiene que quedar null, no
  // undefined: undefined viaja distinto a la base y deja el campo sin escribir.
  p=window.buildRecordPayload({role:'deck_morning',tripId:null,
    items:[{id:'a',text:'Cubierta'}],estaTildado:()=>false,signer:firmante,hechos:0});
  chk('una rutina sin salida guarda trip_id null, no undefined',
      p.trip_id===null && p.trip_name===null, JSON.stringify({id:p.trip_id,n:p.trip_name}));
  chk('pero igual guarda el local', p.location_name==='Local Norte', p.location_name);

  // Centro de un solo local: updateAppContext igual resuelve el nombre.
  window.__t.local('loc-unico','Buceo Mar del Plata');
  p=window.buildRecordPayload({role:'deck_morning',tripId:null,
    items:[],estaTildado:()=>false,signer:firmante,hechos:0});
  chk('un centro de un solo local también queda registrado',
      p.location_name==='Buceo Mar del Plata', p.location_name);

  // Centro sin locales cargados todavía: null, no el string vacío.
  window.__t.local(null,'');
  p=window.buildRecordPayload({role:'deck_morning',tripId:null,
    items:[],estaTildado:()=>false,signer:firmante,hechos:0});
  chk('sin local cargado guarda null, no un string vacío',
      p.location_id===null && p.location_name===null, JSON.stringify({id:p.location_id,n:p.location_name}));

  // Una salida cuyo nombre nunca se resolvió en pantalla: null antes que basura.
  window.__t.local('loc-norte','Local Norte');
  p=window.buildRecordPayload({role:'instructor',tripId:'trip-fantasma',
    items:[],estaTildado:()=>false,signer:firmante,hechos:0});
  chk('una salida sin nombre conocido guarda null, no "undefined"',
      p.trip_name===null, String(p.trip_name));

  // ─── Los tres caminos que firman, de punta a punta ───
  await window.populateSignerSelects();

  // 1. Instructor
  window.__t.setTrip('trip-1');
  window.__t.nombreSalida('trip-1','Charter Mañana');
  const todos=window.__t.items();
  const tildados={}; todos.slice(0,2).forEach(i=>tildados[i.id]=true);
  window.__t.marcar('trip-1',tildados);
  insertados=[];
  await window.instructorSignOff();
  let f=insertados[0]||{};
  chk('instructor: el acta llega con local y salida',
      f.location_name==='Local Norte' && f.trip_name==='Charter Mañana',
      JSON.stringify({l:f.location_name,s:f.trip_name}));
  chk('instructor: y sigue guardando los ítems', Array.isArray(f.items_snapshot) && f.items_snapshot.length===todos.length,
      f.items_snapshot&&f.items_snapshot.length);

  // 2. Rutina de departamento
  const rutina=window.__t.dept('deck','morning',{});
  insertados=[];
  await window.deptRoutineSignOff();
  f=insertados[0]||{};
  chk('rutina de departamento: el acta llega con local',
      f.location_name==='Local Norte', JSON.stringify({l:f.location_name}));
  chk('rutina de departamento: sin salida, en null',
      f.trip_id===null && f.trip_name===null, JSON.stringify({id:f.trip_id,n:f.trip_name}));
  chk('rutina de departamento: el rol sigue diciendo QUÉ checklist es',
      f.role===rutina.role, f.role+' vs '+rutina.role);

  // 3. Checklist propia del centro
  window.__t.propias([{id:'cc-1',org_id:'org-1',dept_key:'deck',role_scope:'deckhand',
                       cadence:'monthly',title:'Mensual cubierta',items:['Toallas','Hielo'],created_by:'u-ana'}]);
  window.__t.marcarPropia('cc-1',{0:true,1:true});
  const cont=doc.createElement('div');
  cont.innerHTML='<select class="signer-select" id="custom-cl-name-cc-1"></select>'+
                 '<div id="custom-cl-done-cc-1"></div>';
  doc.body.appendChild(cont);
  await window.populateSignerSelects(cont);
  insertados=[];
  await window.customChecklistSignOff('cc-1');
  f=insertados[0]||{};
  chk('checklist propia: el acta llega con local',
      f.location_name==='Local Norte', JSON.stringify({l:f.location_name}));
  chk('checklist propia: el rol identifica cuál es', f.role==='custom_cc-1', f.role);
  chk('checklist propia: guarda el texto de los ítems',
      f.items_snapshot && f.items_snapshot[0] && f.items_snapshot[0].text==='Toallas',
      JSON.stringify(f.items_snapshot&&f.items_snapshot[0]));

  // ─── Sin conexión ───
  // La cola tiene que llevar los campos nuevos. Si no, un acta firmada sin
  // señal pierde el local para siempre: cuando sincroniza ya no hay a qué
  // volver a preguntarle.
  window.__t.offline(true);
  window.__t.setTrip('trip-1');
  window.__t.marcar('trip-1',tildados);
  encolados=[]; insertados=[];
  await window.instructorSignOff();
  chk('offline: encola en vez de insertar', encolados.length===1 && insertados.length===0,
      'encolados '+encolados.length+' / insertados '+insertados.length);
  const q=(encolados[0]||{}).payload||{};
  chk('offline: la cola también lleva el local',
      q.location_name==='Local Norte' && q.location_id==='loc-norte', JSON.stringify({l:q.location_name}));
  chk('offline: la cola también lleva la salida', q.trip_name==='Charter Mañana', q.trip_name);
  window.__t.offline(false);

  // ─── El acta se lee sola, sin join a `trips` ───
  // Tres consultas incrustaban `trips(trip_name, trip_date, trip_time,
  // trip_type)` desde el acta. PostgREST deduce esos joins DE LAS FOREIGN
  // KEYS, así que al soltar la FK —a propósito, para que una salida borrada no
  // pueda tocar un acta inmutable— las tres empezaron a devolver 400 y Logged
  // Checklists quedó vacío. Verificado contra la API real: PGRST200, el mismo
  // error que daría una tabla inexistente.
  chk('ninguna consulta de actas incrusta trips(...)',
      !/checklist_completions'\)[\s\S]{0,400}?trips\(/.test(html), 'sin embeds');
  chk('y las tres piden los campos del snapshot',
      (html.match(/signed_at, trip_name, trip_date, trip_time/g)||[]).length +
      (html.match(/items_snapshot, trip_name, trip_date, trip_time/g)||[]).length === 3,
      'tres selects con los campos del acta');
  chk('el acta guarda fecha y hora de la salida, no sólo el nombre',
      /trip_date: salida \? \(salida\.date \|\| null\) : null/.test(html) &&
      /trip_time: salida \? \(salida\.time \|\| null\) : null/.test(html));

  // La etiqueta se arma en un solo lugar y lee sólo campos del acta.
  // La declaración también empieza con `tripLabelDeActa(r`, así que se descuenta.
  const etqTotal=(html.match(/tripLabelDeActa\(r/g)||[]).length;
  const etqDecl=(html.match(/function tripLabelDeActa\(/g)||[]).length;
  chk('la etiqueta de la salida se arma en una sola función',
      etqDecl===1 && (etqTotal-etqDecl)===3, (etqTotal-etqDecl)+' usos, '+etqDecl+' declaración');
  let etiqueta=window.tripLabelDeActa({trip_id:'t1',trip_name:'Charter Mañana',trip_time:'09:30:00',trip_date:'2026-10-07'});
  chk('la etiqueta usa la hora y el nombre del acta', etiqueta==='09:30 — Charter Mañana', etiqueta);
  etiqueta=window.tripLabelDeActa({trip_id:'t1',trip_name:'Charter Mañana',trip_time:'09:30:00',trip_date:'2026-10-07'},{conFecha:true});
  chk('y con fecha cuando el export la pide', etiqueta==='2026-10-07 09:30 — Charter Mañana', etiqueta);
  chk('un acta sin salida no inventa una etiqueta',
      window.tripLabelDeActa({trip_id:null,trip_name:null})===null, 'null');
  // Las actas anteriores al 07/10 no tienen el snapshot: no deben romper.
  etiqueta=window.tripLabelDeActa({trip_id:'t1',trip_name:null,trip_time:null,trip_date:null});
  chk('un acta vieja sin snapshot cae en el texto de reserva, sin romper',
      typeof etiqueta==='string' && etiqueta.length>0 && !/null|undefined/.test(etiqueta), etiqueta);
  chk('y la agrupación por día cae en la fecha de firma',
      /row\.trip_date \|\| row\.signed_at\.split/.test(html));

  // ─── Guardián estructural: una regla, una función ───
  // Los tres payloads se armaban a mano y eran idénticos salvo el rol. Esta
  // etapa le agregó TRES campos al acta; con el patrón viejo eran nueve
  // ediciones y el defecto habría aparecido donde la copia faltara. Si alguien
  // vuelve a armar el acta a mano, esto lo frena acá y no en producción.
  const insertsDeActa=(html.match(/from\('checklist_completions'\)\.insert/g)||[]).length;
  // Sin el `function` adelante, para no contar la declaración como una llamada.
  const llamadasAlConstructor=(html.match(/(?<!function\s)buildRecordPayload\(\{/g)||[]).length;
  const declaraciones=(html.match(/function\s+buildRecordPayload\(/g)||[]).length;
  chk('el constructor del acta está declarado una sola vez',
      declaraciones===1, declaraciones+' declaraciones');
  chk('los tres lugares que firman usan el constructor único',
      llamadasAlConstructor===3, llamadasAlConstructor+' llamadas');
  chk('y no quedó ningún acta armada a mano',
      !/signed_by:\s*name,\s*completed_by:/.test(html), 'patrón viejo ausente');
  // Antes había un insert por cada camino que firma (3) más el de la cola.
  // Desde que el acta se guarda en un solo lugar quedan dos reales:
  // guardarActa() y el replay de la cola. El tercero es una mención en un
  // comentario que explica el patrón viejo.
  chk('el acta se inserta en dos lugares reales: guardarActa y la cola',
      insertsDeActa===3 &&
      (html.match(/const \{ error \} = await sb\.from\('checklist_completions'\)\.insert\(payload\)/g)||[]).length===1,
      insertsDeActa+' menciones');

  // El acta no puede quedar sin firmante: `signer` es obligatorio y los tres
  // caminos cortan antes si no hay. Verificamos que el constructor no invente.
  chk('el constructor no inventa un firmante',
      (()=>{ try{ window.buildRecordPayload({role:'x',tripId:null,items:[],
             estaTildado:()=>false,signer:undefined,hechos:0}); return false; }catch(e){ return true; } })(),
      'falla si no hay firmante');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
  process.exit(fail);
})();
