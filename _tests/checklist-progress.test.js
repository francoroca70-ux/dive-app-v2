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
function tablaProgress(){
  let filtros={};
  const h={get(t,prop){
    if(prop==='then') return (res)=>{
      const sel=filas.filter(f=>Object.entries(filtros).every(([k,v])=>f[k]===v));
      return Promise.resolve({data:sel,error:null}).then(res);
    };
    if(prop==='eq') return (col,val)=>{ filtros[col]=val; return new Proxy({},h); };
    if(prop==='upsert') return (p)=>{
      const i=filas.findIndex(f=>f.org_id===p.org_id&&f.scope_key===p.scope_key&&f.item_id===p.item_id);
      if(i>=0) filas[i]=p; else filas.push(p);     // la restricción única
      return Promise.resolve({error:null});
    };
    if(prop==='delete') return ()=>{ filtros={}; const d={get(t2,p2){
        if(p2==='eq') return (c,v)=>{ filtros[c]=v; return new Proxy({},d); };
        if(p2==='then') return (res)=>{
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
  "offline:(v)=>{isOffline=v;},cache:()=>progressCache,limpiarCache:()=>{for(const k in progressCache) delete progressCache[k];}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setLoc('loc-a'); window.__t.offline(false);

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

  process.exit(fail);
} catch(e){ console.log('EXCEPCIÓN:', e && (e.stack||String(e))); process.exit(1);} })();
