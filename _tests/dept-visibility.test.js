// Qué departamentos ve cada rol — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/dept-visibility.test.js
//
// Hay DOS mapas casi idénticos y conviene no confundirlos:
//   DEPT_ROUTINE_VISIBILITY_BY_ROLE  → qué pestañas VE un rol
//   deptKeyForRole()                 → bajo qué pestaña se ARCHIVAN sus
//                                      checklists propias
// Este test cubre los dos justamente para que no se los toque a la vez.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u1'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>new Proxy({},{get(t,p){ if(p==='then') return (r)=>Promise.resolve({data:[],count:0,error:null}).then(r);
                                   return ()=>new Proxy({},this); }}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={setRole:(r)=>{currentUserRole=r;},elevated:(v)=>{window.currentCaptainElevated=v;},"+
  "deptKeyForRole:(r)=>deptKeyForRole(r)};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
const ve=(rol,elev)=>{ window.__t.setRole(rol); window.__t.elevated(!!elev);
                       return window.visibleDeptKeysForCurrentUser().slice().sort(); };
const TODOS=['captain','deck','instructor','stewards'].sort();

chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

// ── Lo que cambió ──
chk('capitán ve los cuatro departamentos',
    JSON.stringify(ve('captain'))===JSON.stringify(TODOS), ve('captain').join(','));
chk('capitán ve cubierta', ve('captain').includes('deck'));
chk('capitán ve instructor (mantenimiento del equipo de buceo)', ve('captain').includes('instructor'));
chk('capitán ve cocina y servicio (liveaboard/yate)', ve('captain').includes('stewards'));

// ── Lo que NO tenía que cambiar ──
chk('deckhand sigue viendo sólo cubierta', JSON.stringify(ve('deckhand'))===JSON.stringify(['deck']), ve('deckhand').join(','));
chk('instructor sigue viendo sólo instructor', JSON.stringify(ve('instructor'))===JSON.stringify(['instructor']), ve('instructor').join(','));
chk('divemaster sigue viendo sólo instructor', JSON.stringify(ve('divemaster'))===JSON.stringify(['instructor']));
chk('steward sigue viendo sólo cocina', JSON.stringify(ve('steward'))===JSON.stringify(['stewards']));
chk('engineer sigue viendo sólo cubierta', JSON.stringify(ve('engineer'))===JSON.stringify(['deck']));
chk('dueño sigue viendo todo', JSON.stringify(ve('owner'))===JSON.stringify(TODOS));
chk('gerente sigue viendo todo', JSON.stringify(ve('manager'))===JSON.stringify(TODOS));
chk('front_desk (sin mapa) sigue viendo todo', JSON.stringify(ve('front_desk'))===JSON.stringify(TODOS));

// ── El otro mapa, el que NO se tocó ──
chk('las checklists propias del capitán se archivan bajo «capitán», no bajo las cuatro',
    window.__t.deptKeyForRole('captain')==='captain', String(window.__t.deptKeyForRole('captain')));
chk('las del deckhand siguen bajo cubierta', window.__t.deptKeyForRole('deckhand')==='deck');
chk('las del divemaster siguen bajo instructor', window.__t.deptKeyForRole('divemaster')==='instructor');
chk('las del chef siguen bajo cocina', window.__t.deptKeyForRole('chef')==='stewards');

process.exit(fail);
