// Una cuenta interna no ve el portón de acceso — index.html real en jsdom.
//
//   node _tests/cuenta-interna.test.js
//
// Por qué existe (15/10): a Fran le aparecía la pantalla de «elegí un plan» en
// su propia cuenta, que es la que usa para mostrarle la app a prospectos. Su org
// quedó en `canceled` el 30/09 por la prueba de cobro real con tarjeta, que se
// reembolsó — así que el estado es correcto y lo que faltaba era poder decir
// «esta org no paga, a propósito».
//
// **Por qué una columna aparte y no `subscription_status = 'active'`**, que era
// la salida de un minuto: el webhook de Paddle ESCRIBE `subscription_status`, y
// lo hace sin guardia de orden (está anotado como hallazgo abierto). Esa org
// tiene un `paddle_subscription_id` cargado, así que un evento viejo que llegara
// tarde la devolvería a `canceled` y el paywall reaparecería — con suerte, en
// medio de una demo. El webhook no toca `comped` nunca.
//
// Y poner `active` a mano habría afirmado que hay una suscripción donde no hay
// ninguna: un dato inventado que después nadie distingue de uno real.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

function tabla(){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:[],count:0,error:null}).then(res,rej);
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>tabla(), rpc:async()=>({data:null,error:null}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={"+
  "recordar:(org,def)=>recordarEstadoDeSuscripcion(org,def),"+
  "interna:()=>esCuentaInterna(),"+
  "porton:(s,t)=>enforceSubscriptionGate(s,t),"+
  "setIdioma:(l)=>{currentLanguage=l;},"+
  "t:(k)=>t(k)};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}

let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

try{
const T=window.__t;

// El portón se mide por su efecto observable: si bloquea, levanta el modal y
// deja `_subscriptionLocked`. Afirmar «no tiró excepción» no probaría nada —
// tercera vez que esta forma aparece en el proyecto.
function bloqueo(){ return !!window._subscriptionLocked; }
function limpiar(){ window._subscriptionLocked=false; }

// ─── 1 · Sin la columna, el comportamiento es el de siempre ───
limpiar();
T.recordar({subscription_status:'canceled', comped:false}, 'active');
chk('una org cancelada NO es cuenta interna', T.interna()===false);
T.porton('canceled', null);
chk('y el portón la bloquea', bloqueo());

limpiar();
T.recordar({subscription_status:'active'}, 'active');
chk('una org activa pasa, como siempre', (T.porton('active',null), !bloqueo()));

limpiar();
T.recordar({subscription_status:'paused', comped:false}, 'active');
T.porton('paused', null);
chk('una org pausada también se bloquea', bloqueo());

// ─── 2 · Con la columna, no ve el portón ───
//
// El caso exacto de Fran: `canceled` **y** comped. El estado sigue diciendo la
// verdad (no hay suscripción) y el acceso no depende de mentir sobre él.
limpiar();
T.recordar({subscription_status:'canceled', comped:true}, 'active');
chk('comped sobre una org cancelada SÍ es cuenta interna', T.interna()===true);
T.porton('canceled', null);
chk('y el portón NO la bloquea', !bloqueo());

limpiar();
T.recordar({subscription_status:'paused', comped:true}, 'active');
T.porton('paused', null);
chk('tampoco con pausada', !bloqueo());

// Un trial vencido es la otra puerta del portón, y también se salta.
limpiar();
const ayer=new Date(Date.now()-86400000).toISOString();
T.recordar({subscription_status:'trial', trial_ends_at:ayer, comped:false}, 'trial');
T.porton('trial', ayer);
chk('un trial vencido sin comped se bloquea', bloqueo());
limpiar();
T.recordar({subscription_status:'trial', trial_ends_at:ayer, comped:true}, 'trial');
T.porton('trial', ayer);
chk('y con comped no', !bloqueo());

// ─── 3 · Si el bloqueo ya estaba arriba, se suelta ───
//
// Pasa si se marca comped mientras la pantalla está abierta. Sin esto quedaría
// un modal no cerrable sobre una org que ya tiene acceso.
window._subscriptionLocked = true;
T.recordar({subscription_status:'canceled', comped:true}, 'active');
T.porton('canceled', null);
chk('un bloqueo ya levantado se suelta al volverse interna', !bloqueo());

// ─── 4 · La columna no se lee de ningún otro lado ───
//
// Un solo lugar decide, y los dos que lo usan preguntan por la función. Si
// `window.currentOrgComped` apareciera suelto en un tercer lugar, dejaría de
// haber un único dueño de la regla.
const sinComentarios=main.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
const veces=(sinComentarios.match(/currentOrgComped/g)||[]).length;
chk('currentOrgComped se escribe y se lee en un solo lugar cada vez',
    veces===2, String(veces));
chk('el portón pregunta por la función, no por la variable',
    /if \(esCuentaInterna\(\)\) \{/.test(sinComentarios));

// ─── 5 · Y lo que ve el dueño dice lo que pasa ───
T.setIdioma('es');
chk('hay texto en castellano para una cuenta interna',
    /acceso completo/i.test(T.t('set_billing_comped_desc')), T.t('set_billing_comped_desc'));
chk('y no le ofrece elegir un plan',
    !/plan/i.test(T.t('set_billing_comped_desc')), T.t('set_billing_comped_desc'));
T.setIdioma('en');
chk('y en inglés también',
    /full access/i.test(T.t('set_billing_comped_desc')), T.t('set_billing_comped_desc'));

}catch(e){ chk('el cuerpo del test corrió hasta el final',false,String(e).slice(0,300)); }

console.log(`\n${fail?'HAY FALLOS':'todo en verde'} — cuenta-interna`);
process.exit(fail);
