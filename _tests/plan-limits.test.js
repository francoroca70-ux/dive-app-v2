// Límites de plan — corre el index.html real dentro de jsdom.
//
//   npm i -D jsdom && node _tests/plan-limits.test.js
//
// Dos cosas que costaron encontrar y conviene no volver a descubrir:
//
//  1. `const sb` y `let currentOrgId` son declaraciones léxicas del script, y
//     un eval indirecto las deja en SU propio scope: no se ven desde window.
//     Por eso el test engancha `window.__t` dentro del mismo eval en vez de
//     intentar leerlas de afuera. Las funciones sí quedan en window (son
//     declaraciones `function`) y cierran sobre ese scope, así que llamarlas
//     funciona aunque sus variables sean invisibles.
//
//  2. El cartel ya existe en index.html. Crear uno nuevo con el mismo id hace
//     que getElementById devuelva el de la página y el test mida un elemento
//     que nadie toca -- pasando en verde sin probar nada.
//
// Corre el index.html real en jsdom y comprueba el comportamiento de los
// límites de plan, no la forma del código.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

let botes=[];                       // lo que devuelve la consulta de botes
// Cliente falso encadenable: cualquier .metodo() devuelve el mismo objeto, y
// al await-earlo resuelve {data, error}. Así el test no depende de adivinar la
// forma exacta de la cadena de Supabase.
function fakeQuery(){
  const h={ get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:botes,error:null,count:botes.length}).then(res,rej);
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>fakeQuery(),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook = main + "\n;window.__t = { setOrg:(id)=>{ currentOrgId = id; }, sb:()=>sb };";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,160):'');

// ── currentPlanLimits ──
const set=(status,tier)=>{window.currentOrgSubscriptionStatus=status;window.currentOrgPlanTier=tier;};
set('trial','starter');   chk('en trial no hay límites', window.currentPlanLimits()===null);
set('active','starter');  chk('starter = 3 botes', window.currentPlanLimits().boats===3);
set('active','pro');      chk('pro = 17 botes', window.currentPlanLimits().boats===17);

// El agujero: activo y pagando, sin plan reconocible.
set('active',null);
let l=window.currentPlanLimits();
chk('activo sin plan_tier NO es ilimitado', l!==null, l===null?'devolvió null = sin límite':'');
chk('activo sin plan_tier cae al plan más chico', l && l.boats===3, l?('boats='+l.boats):'');
set('past_due',undefined);
l=window.currentPlanLimits();
chk('past_due sin plan tampoco es ilimitado', l!==null && l.boats===3);
set('canceled',null);
chk('cancelado no inventa un plan', window.currentPlanLimits()===null);

// ── el cartel de exceso dice dónde están los botes ──
// El cartel ya existe en index.html -- usar ESE, no uno inventado.
const banner=doc.getElementById('plan-overage-banner');
if(!banner){console.log('FAIL  no existe #plan-overage-banner en la página');process.exit(1);}
const span=banner.querySelector('.plan-overage-text');
if(!span){console.log('FAIL  el cartel no tiene .plan-overage-text');process.exit(1);}
window.__t.setOrg('org-1');
window.__t.sb().from = () => fakeQuery();   // interceptar la consulta real
set('active','starter');
botes=[{id:1,location_id:'a',locations:{name:'The wave shop'}},
       {id:2,location_id:'a',locations:{name:'The wave shop'}},
       {id:3,location_id:'a',locations:{name:'The wave shop'}},
       {id:4,location_id:'b',locations:{name:'seven seas dive shop'}}];
(async()=>{ try {

  try { await window.updatePlanOverageBanner(); } catch(e){ console.log('EXCEPCION:', e && (e.stack||e.message||String(e))); }
  const txt=span.textContent;
  chk('el cartel aparece con 4 botes en starter', banner.style.display==='flex');
  chk('dice que la cuenta es de todos los locales', /all your locations|todos tus locales/.test(txt));
  chk('nombra los dos locales con su número', /The wave shop: 3/.test(txt) && /seven seas dive shop: 1/.test(txt), JSON.stringify(txt));

  // Un solo local: no hace falta el desglose.
  botes=botes.slice(0,3).concat([{id:4,location_id:'a',locations:{name:'The wave shop'}}]);
  await window.updatePlanOverageBanner();
  chk('con un solo local no agrega el desglose', !/Where they are|Dónde están/.test(span.textContent));

  // Dentro del límite: sin cartel.
  botes=botes.slice(0,2);
  await window.updatePlanOverageBanner();
  chk('dentro del límite no muestra nada', banner.style.display==='none');

  // XSS: el nombre del local lo escribe el usuario.
  botes=[{id:1,location_id:'a',locations:{name:'<img src=x onerror=alert(1)>'}},
         {id:2,location_id:'a',locations:{name:'<img src=x onerror=alert(1)>'}},
         {id:3,location_id:'a',locations:{name:'<img src=x onerror=alert(1)>'}},
         {id:4,location_id:'b',locations:{name:'Otro'}}];
  await window.updatePlanOverageBanner();
  chk('el nombre del local no inyecta HTML', span.querySelectorAll('img').length===0);

  process.exit(fail);
 } catch(e){ console.log('EXCEPCION EN EL TEST:', e && (e.stack||String(e))); process.exit(1); }
})();
