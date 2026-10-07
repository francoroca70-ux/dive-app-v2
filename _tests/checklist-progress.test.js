// Trabajo en curso de una checklist — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/checklist-progress.test.js
//
// El caso que importa no es "se guarda un tilde", es el de un control mensual
// repartido: una persona tilda dos ítems el día 2, otra persona en otro
// dispositivo abre la misma lista el día 3 y tiene que VER esos dos.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// "Base de datos": filas de checklist_progress, con su restricción única.
let filas=[];
const borrados=[];
// Permite forzar el error que devuelve la escritura, para distinguir un fallo
// de red de un rechazo del servidor. Las formas están medidas contra la API
// real: red -> code:'' ; servidor -> code:'42501'.
let errorAlEscribir=null;
function tablaProgress(){
  let filtros={};
  const h={get(t,prop){
    if(prop==='then') return (res)=>{
      const sel=filas.filter(f=>Object.entries(filtros).every(([k,v])=>f[k]===v));
      return Promise.resolve({data:sel,error:null}).then(res);
    };
    if(prop==='eq') return (col,val)=>{ filtros[col]=val; return new Proxy({},h); };
    if(prop==='upsert') return (p)=>{
      if(errorAlEscribir) return Promise.resolve({error:errorAlEscribir});
      const i=filas.findIndex(f=>f.org_id===p.org_id&&f.scope_key===p.scope_key&&f.item_id===p.item_id);
      if(i>=0) filas[i]=p; else filas.push(p);     // la restricción única
      return Promise.resolve({error:null});
    };
    if(prop==='delete') return ()=>{ filtros={}; const d={get(t2,p2){
        if(p2==='eq') return (c,v)=>{ filtros[c]=v; return new Proxy({},d); };
        if(p2==='then') return (res)=>{
          if(errorAlEscribir) return Promise.resolve({error:errorAlEscribir}).then(res);
          const antes=filas.length;
          filas=filas.filter(f=>!Object.entries(filtros).every(([k,v])=>f[k]===v));
          borrados.push(antes-filas.length);
          return Promise.resolve({error:null}).then(res);
        };
        return ()=>new Proxy({},d);
      }}; return new Proxy({},d); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
let insertados=[];
function tabla(n){
  if(n==='checklist_progress') return tablaProgress();
  const h={get(t,prop){
    if(prop==='then') return (res)=>Promise.resolve({data:n==='staff'?[{id:'u-ana',full_name:'Ana',role:'instructor'}]:[],count:0,error:null}).then(res);
    if(prop==='insert') return (p)=>{insertados.push(p);return Promise.resolve({error:null});};
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
const hook=main+"\n;window.__t={setOrg:(id)=>{currentOrgId=id;},setLoc:(id)=>{currentLocationId=id;},"+
  // En produccion `currentUserId` lo setea initAuthInner() desde la sesion.
  // El stub de auth no devuelve sesion (a proposito, para que la app muestre
  // el login y no arranque entera), asi que aca se simula ese paso.
  "setUser:(id)=>{currentUserId=id;},"+
  "offline:(v)=>{isOffline=v;},cache:()=>progressCache,limpiarCache:()=>{for(const k in progressCache) delete progressCache[k];}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setLoc('loc-a'); window.__t.offline(false);
window.__t.setUser('u-ana');   // lo que initAuthInner() hace desde la sesión

(async()=>{ try {
  // ── La llave de cada instancia ──
  const hoy=new Date(), yyyy=hoy.getFullYear(),
        mm=String(hoy.getMonth()+1).padStart(2,'0'), dd=String(hoy.getDate()).padStart(2,'0');
  chk('rutina de mañana: una por día', window.periodKeyForCadence('morning',null)===`${yyyy}-${mm}-${dd}`);
  chk('control mensual: uno por mes',  window.periodKeyForCadence('monthly',null)===`${yyyy}-${mm}`);
  chk('control anual: uno por año',    window.periodKeyForCadence('yearly',null)===String(yyyy));
  chk('preparación de salida: una por salida', window.periodKeyForCadence(null,'trip-9')==='trip-9');
  chk('el local va en la llave', window.progressScopeKey('deck_morning','2026-10-06')==='loc-a:deck_morning:2026-10-06');

  // ── EL CASO: control mensual repartido entre días y personas ──
  const mensual=window.progressScopeKey('instructor_monthly', window.periodKeyForCadence('monthly',null));
  const meta={role:'instructor_monthly', periodKey:window.periodKeyForCadence('monthly',null), tripId:null};
  await window.saveChecklistTick(mensual, meta, 'i1', true);
  await window.saveChecklistTick(mensual, meta, 'i2', true);
  chk('se guardaron los dos tildes del día 2', filas.length===2, 'filas: '+filas.length);
  chk('cada tilde guarda quién lo marcó', filas[0].checked_by==='u-ana', filas[0].checked_by);

  // Otra persona, otro dispositivo, otro día: caché vacía, lee de la base.
  window.__t.limpiarCache();
  const visto=await window.loadChecklistProgress(mensual);
  chk('otro dispositivo VE lo que tildó el otro', visto.i1===true && visto.i2===true, JSON.stringify(visto));

  // Agrega dos más y destilda uno
  await window.saveChecklistTick(mensual, meta, 'i3', true);
  await window.saveChecklistTick(mensual, meta, 'i1', false);
  window.__t.limpiarCache();
  const visto2=await window.loadChecklistProgress(mensual);
  chk('destildar borra la fila', visto2.i1===undefined, JSON.stringify(visto2));
  chk('lo demás sigue', visto2.i2===true && visto2.i3===true);

  // Tildar dos veces el mismo ítem no duplica
  await window.saveChecklistTick(mensual, meta, 'i2', true);
  chk('tildar dos veces no duplica filas', filas.filter(f=>f.item_id==='i2').length===1);

  // ── Instancias que NO se mezclan ──
  const otroMes=window.progressScopeKey('instructor_monthly','2026-09');
  window.__t.limpiarCache();
  chk('el mes anterior arranca limpio', Object.keys(await window.loadChecklistProgress(otroMes)).length===0);
  window.__t.setLoc('loc-b'); window.__t.limpiarCache();
  const otroLocal=window.progressScopeKey('instructor_monthly', window.periodKeyForCadence('monthly',null));
  chk('otro local arranca limpio', Object.keys(await window.loadChecklistProgress(otroLocal)).length===0, otroLocal);
  window.__t.setLoc('loc-a');

  // ── Al firmar se cierra la instancia ──
  window.__t.limpiarCache();
  await window.clearChecklistProgress(mensual);
  chk('firmar borra el trabajo en curso', filas.length===0, 'quedan: '+filas.length);

  // ── Sin conexión ──
  const cola=[]; window.queueOfflineAction=(tipo,payload)=>cola.push({tipo,payload});
  window.__t.offline(true);
  await window.saveChecklistTick(mensual, meta, 'i7', true);
  chk('offline: el tilde va a la cola', cola.length===1 && cola[0].tipo==='checklist_tick', JSON.stringify(cola[0]||{}).slice(0,80));
  await window.saveChecklistTick(mensual, meta, 'i7', false);
  chk('offline: destildar también', cola[1] && cola[1].tipo==='checklist_untick');
  chk('offline: la pantalla igual responde', window.__t.cache()[mensual].i7===undefined);
  window.__t.offline(false);

  // ── La pantalla se pinta ANTES de guardar ──
  // Los tres toggles hacían `await saveChecklistTick(...)` y recién entonces
  // dibujaban, así que el casillero no se marcaba hasta que volvía el viaje a
  // la base: con Supabase en São Paulo, cerca de un segundo por tilde. Lo
  // encontró Fran usando la app, no un test — de ahí este.
  let orden=[]; let liberar;
  const lento=new Promise(r=>{ liberar=r; });
  const saveOriginal=window.saveChecklistTick;
  window.saveChecklistTick=async(...a)=>{ orden.push('guardar'); await lento; return saveOriginal(...a); };
  const checks={};
  const p=window.marcarTilde({ scopeKey:mensual, meta, itemId:'i9', checks,
                               dibujar:()=>orden.push('dibujar') });
  await new Promise(r=>setTimeout(r,0));
  chk('el casillero se pinta antes de que la escritura termine',
      orden[0]==='dibujar', orden.join(' → ')||'(nada)');
  chk('y el tilde ya se ve en la pantalla sin esperar la red', checks.i9===true, String(checks.i9));
  liberar(); await p;
  window.saveChecklistTick=saveOriginal;

  // ── Si la escritura falla, el tilde se deshace ──
  // Un tilde que no se guardó no puede verse igual que uno que sí: alguien
  // está revisando un barco contra esa lista.
  let avisos=[]; window.showAlertModal=async(m)=>{avisos.push(String(m));};
  window.saveChecklistTick=async()=>false;
  const checks2={};
  await window.marcarTilde({ scopeKey:mensual, meta, itemId:'i10', checks:checks2,
                             dibujar:()=>{} });
  chk('si falla la escritura, el tilde se revierte en pantalla',
      checks2.i10===undefined, JSON.stringify(checks2));
  chk('y se le avisa a quien estaba tildando', avisos.length===1, avisos[0]||'(ningún aviso)');
  window.saveChecklistTick=saveOriginal;

  // ── Señal cortada que el navegador todavía no notó ──
  // Lo encontró Fran probando: puso el celular en modo avión, tildó, y los
  // tildes SE BORRARON con un aviso de error. `navigator.onLine` seguía
  // diciendo que había señal, así que el tilde intentó escribir, falló, y el
  // código lo trató como un rechazo del servidor. En un barco con señal mala
  // ése no es un caso raro: es el caso normal.
  //
  // Las formas de error están medidas contra la API real, no inventadas.
  const errRed = { code: '', message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch' };
  const errServidor = { code: '42501', message: 'new row violates row-level security policy for table "checklist_progress"' };

  chk('un fallo de red se reconoce por no tener code', window.pareceFalloDeRed(errRed)===true);
  chk('un rechazo del servidor NO se confunde con red', window.pareceFalloDeRed(errServidor)===false, errServidor.code);
  chk('sin error no hay fallo de red', window.pareceFalloDeRed(null)===false);

  // Con la red caída pero isOffline todavía en false: el tilde va a la cola y
  // NO se deshace.
  const cola2=[]; window.queueOfflineAction=(tipo,payload)=>cola2.push({tipo,payload});
  window.__t.offline(false);
  errorAlEscribir=errRed;
  const checks3={};
  avisos=[];
  await window.marcarTilde({ scopeKey:mensual, meta, itemId:'i11', checks:checks3, dibujar:()=>{} });
  chk('señal cortada sin avisar: el tilde NO se deshace', checks3.i11===true, JSON.stringify(checks3));
  chk('y se encola para cuando vuelva la señal',
      cola2.length===1 && cola2[0].tipo==='checklist_tick', JSON.stringify(cola2[0]||{}).slice(0,70));
  chk('y NO se le muestra un error que no corresponde', avisos.length===0, avisos[0]||'(ningún aviso, bien)');

  // Un rechazo real del servidor sí se deshace y sí se avisa.
  errorAlEscribir=errServidor;
  cola2.length=0; avisos=[];
  const checks4={};
  await window.marcarTilde({ scopeKey:mensual, meta, itemId:'i12', checks:checks4, dibujar:()=>{} });
  chk('un rechazo del servidor sí deshace el tilde', checks4.i12===undefined, JSON.stringify(checks4));
  chk('y sí avisa', avisos.length===1, avisos[0]||'(ningún aviso)');
  chk('y NO lo encola, para no trancar la cola para siempre', cola2.length===0, cola2.length+'');
  errorAlEscribir=null;

  // ── El id del usuario no se pide por red en cada tilde ──
  chk('el tilde no pide el usuario por red: usa currentUserId',
      /checked_by: currentUserId/.test(html) &&
      !/getUser\(\)[\s\S]{0,200}?checked_by: currentUserId/.test(html),
      'checked_by: currentUserId');

  // ── Los tres toggles pasan por el mismo camino ──
  const llamadas=(html.match(/await marcarTilde\(\{/g)||[]).length;
  const declara=(html.match(/async function marcarTilde\(/g)||[]).length;
  chk('los tres toggles usan marcarTilde()', llamadas===3 && declara===1,
      llamadas+' llamadas, '+declara+' declaracion');
  // Sin contar la mencion dentro del comentario que explica por que cambio.
  const directas=(html.match(/= await saveChecklistTick\(/g)||[]).length;
  chk('y ninguno llama a saveChecklistTick por su cuenta',
      directas===1, directas+' llamada real (solo la de marcarTilde)');

  process.exit(fail);
} catch(e){ console.log('EXCEPCIÓN:', e && (e.stack||String(e))); process.exit(1);} })();
