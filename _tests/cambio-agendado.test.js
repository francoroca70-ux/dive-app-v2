// Que la app diga «tu suscripción termina el 30 de octubre» — index.html real
// en jsdom.
//
//   node _tests/cambio-agendado.test.js
//
// El hueco que cierra: cancelar «al final del período» en Paddle **NO cambia el
// estado** — la suscripción queda `active` hasta la fecha de factura. La app
// sólo leía `subscription_status`, así que a quien acababa de cancelar le
// mostraba exactamente la misma pantalla que antes. Muda justo en el momento en
// que el cliente quiere confirmación de que su baja se registró.
//
// Y ya costaba algo medible ANTES de tener clientes: el procedimiento de envío
// a Apple incluye entrar a Paddle a mano a comprobar que la cuenta de revisión
// no tenga un cambio agendado, precisamente porque la app no lo sabe leer.
//
// OJO (trampas del arnés):
//  · La app arranca en INGLÉS.
//  · El banner es UNO y ahora tiene dos motivos para aparecer. Los tests van
//    contra las dos combinaciones, incluida la de que estén los dos a la vez.
//  · `t()` necesita los diccionarios cargados, así que todo corre sobre el
//    index.html real y no sobre strings inventados.
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
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-fran'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>tabla(), rpc:async()=>({data:null,error:null}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={"+
  "recordar:(org,def)=>recordarEstadoDeSuscripcion(org,def),"+
  "banner:()=>updateTrialBanner(),"+
  "texto:(a,c)=>textoDeCambioAgendado(a,c),"+
  "tarjeta:(org)=>updateBillingCard(org),"+
  "setRol:(r)=>{currentUserRole=r;},"+
  "setIdioma:(l)=>{currentLanguage=l;},"+
  "nativo:(p)=>{ if(p===null){delete window.Capacitor;} else {window.Capacitor={getPlatform:()=>p,isNativePlatform:()=>true};} }};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

try{
const T=window.__t;
const banner=()=>doc.getElementById('trial-banner');
const bannerTexto=()=>(banner().querySelector('.trial-banner-text').textContent||'').trim();
const visible=()=>banner().style.display!=='none';

// ─── 1 · La frase se arma en UN solo lugar ───
chk('textoDeCambioAgendado existe y es la única que arma la frase',
    typeof T.texto==='function' &&
    (html.match(/function textoDeCambioAgendado/g)||[]).length===1);
chk('cancel dice la fecha y que el acceso sigue hasta entonces',
    /end on 30 October 2026/.test(T.texto('cancel','2026-10-30T12:00:00Z')) &&
    /full access until then/i.test(T.texto('cancel','2026-10-30T12:00:00Z')),
    T.texto('cancel','2026-10-30T12:00:00Z'));
chk('pause tiene su propio texto, distinto de cancel',
    T.texto('pause','2026-10-30T12:00:00Z')!==T.texto('cancel','2026-10-30T12:00:00Z') &&
    /pause/i.test(T.texto('pause','2026-10-30T12:00:00Z')));
chk('resume tiene el suyo y NO promete acceso hasta una fecha',
    /resume/i.test(T.texto('resume','2026-11-05T12:00:00Z')) &&
    !/until then/i.test(T.texto('resume','2026-11-05T12:00:00Z')),
    T.texto('resume','2026-11-05T12:00:00Z'));

// ─── 2 · Lo que NO se dice ───
chk('sin acción no se dice nada',          T.texto(null,'2026-10-30T12:00:00Z')==='');
chk('sin fecha tampoco',                   T.texto('cancel',null)==='');
chk('con una fecha inválida tampoco',      T.texto('cancel','mañana a la tarde')==='');
chk('una acción desconocida NO se inventa', T.texto('transmogrify','2026-10-30T12:00:00Z')==='',
    'mejor callar que decir algo que no entendemos de la facturación de alguien');

// ─── 3 · El banner lo muestra, y gana sobre el aviso de prueba ───
T.recordar({subscription_status:'active',scheduled_change_action:'cancel',
            scheduled_change_at:'2026-10-30T12:00:00Z'},'active');
T.banner();
chk('con la suscripción ACTIVE y una baja agendada, el banner aparece',
    visible() && /30 October 2026/.test(bannerTexto()), bannerTexto().slice(0,90));
chk('…que es justo el caso que la app no sabía contar',
    window.currentOrgSubscriptionStatus==='active', window.currentOrgSubscriptionStatus);

// En prueba Y cancelada: el cambio agendado es el hecho más nuevo y más
// específico, así que gana.
T.recordar({subscription_status:'trial',trial_ends_at:new Date(Date.now()+86400000).toISOString(),
            scheduled_change_action:'cancel',scheduled_change_at:'2026-10-30T12:00:00Z'},'trial');
T.banner();
chk('en prueba y con baja agendada, gana el cambio agendado',
    /30 October 2026/.test(bannerTexto()) && !/trial/i.test(bannerTexto()),
    bannerTexto().slice(0,90));

// Sin cambio agendado, el banner de prueba sigue funcionando igual que antes.
T.recordar({subscription_status:'trial',trial_ends_at:new Date(Date.now()+86400000).toISOString()},'trial');
T.banner();
chk('sin cambio agendado el banner de prueba sigue intacto',
    visible() && /trial/i.test(bannerTexto()), bannerTexto().slice(0,90));
T.recordar({subscription_status:'active'},'active');
T.banner();
chk('y sin nada que avisar, el banner se esconde', !visible());

// ─── 4 · Se ve en la app nativa, y sin precios ───
// Es informativo: dice un hecho con una fecha. No ofrece una compra ni enlaza a
// una, así que es admisible dentro de la app de iOS — y el dueño que canceló
// desde la web tiene que poder verlo desde el celular.
const PRECIOS=[...html.matchAll(/monthly:\s*(\d+)/g)].map(m=>m[1])
  .concat([...html.matchAll(/annual:\s*(\d+)/g)].map(m=>m[1]));
T.nativo('ios');
T.recordar({subscription_status:'active',scheduled_change_action:'cancel',
            scheduled_change_at:'2026-10-30T12:00:00Z'},'active');
T.banner();
chk('en la app de iOS el aviso SÍ se muestra',
    visible() && /30 October 2026/.test(bannerTexto()), bannerTexto().slice(0,90));
chk('y no filtra un solo precio',
    !PRECIOS.some(p=>p && bannerTexto().includes(p)), PRECIOS.length+' precios comprobados');
chk('ni mete un enlace a una compra',
    banner().querySelectorAll('a').length===0 &&
    !/sevenseasops\.com/.test(bannerTexto()),
    bannerTexto().slice(0,90));
T.nativo(null);

// ─── 5 · La tarjeta de facturación también lo dice ───
T.setRol('owner');
T.tarjeta({subscription_status:'active',plan_tier:'growth',paddle_customer_id:'ctm_x',
           scheduled_change_action:'cancel',scheduled_change_at:'2026-10-30T12:00:00Z'});
const trialLine=()=>doc.getElementById('billing-trial-line');
chk('la tarjeta muestra el cambio agendado junto al plan',
    trialLine().style.display==='block' && /30 October 2026/.test(trialLine().textContent),
    (trialLine().textContent||'').slice(0,90));
chk('y el estado sigue diciendo el plan, que también es cierto',
    /Growth/.test(doc.getElementById('billing-status-line').textContent),
    doc.getElementById('billing-status-line').textContent.slice(0,80));
T.tarjeta({subscription_status:'active',plan_tier:'growth',paddle_customer_id:'ctm_x'});
chk('sin cambio agendado esa línea queda escondida',
    trialLine().style.display==='none', trialLine().style.display);

// ─── 6 · Español ───
T.setIdioma('es');
chk('en español dice la fecha en español',
    /30 de octubre de 2026/.test(T.texto('cancel','2026-10-30T12:00:00Z')),
    T.texto('cancel','2026-10-30T12:00:00Z'));
chk('y no quedó el marcador {date} sin reemplazar',
    !/\{date\}/.test(T.texto('cancel','2026-10-30T12:00:00Z')));
T.setIdioma('en');

// ─── 7 · El estado de la suscripción se guarda en UN lugar ───
// Eran tres asignaciones a mano en los dos caminos que cargan una organización.
// Con el cambio agendado habrían sido cinco × dos, que es la forma donde el
// defecto aparece donde la copia falta.
chk('recordarEstadoDeSuscripcion es el único que setea esas window',
    (html.match(/function recordarEstadoDeSuscripcion/g)||[]).length===1 &&
    (html.match(/window\.currentOrgScheduledAction =/g)||[]).length===1 &&
    (html.match(/window\.currentOrgSubscriptionStatus =/g)||[]).length===1,
    'una declaración, una asignación de cada cosa');
chk('y los dos caminos que cargan una org la llaman',
    (html.match(/recordarEstadoDeSuscripcion\(org, '(active|trial)'\)/g)||[]).length===2,
    (html.match(/recordarEstadoDeSuscripcion\(org, '(active|trial)'\)/g)||[]).length+' llamadas');

// ─── 8 · Los textos están en los dos idiomas ───
const claves=['sub_sched_cancel','sub_sched_pause','sub_sched_resume'];
const faltan=claves.filter(k=>(html.match(new RegExp('\\b'+k+':','g'))||[]).length<2);
chk('cada texto nuevo está en inglés y en español', faltan.length===0,
    faltan.join(', ')||'las 3 en ambos');

// ─── 9 · El webhook, del lado del servidor ───
// Dos cosas que, mal hechas, convierten esto en una mentira. No se pueden
// probar en jsdom —viven en una edge function— así que se comprueban
// estructuralmente sobre el archivo.
const wh=fs.readFileSync(require('path').join(__dirname,'..','supabase','functions','paddle-webhook','index.ts'),'utf8');
chk('el webhook LIMPIA el cambio agendado, no sólo lo setea',
    /update\.scheduled_change_action = scheduled\?\.action \?\? null;/.test(wh),
    'Paddle manda scheduled_change = null cuando el cambio se da de baja');
chk('y mira occurred_at, porque Paddle no garantiza el orden de entrega',
    /occurred_at/.test(wh) && /aplicarCambioAgendado/.test(wh),
    'sin esto un evento viejo que llega tarde resucita un cambio ya quitado');
chk('el estado de la suscripción se sigue derivando de Paddle, no del navegador',
    /resolvePlanTier\(data\)/.test(wh), 'la regla del 30/09 sigue en pie');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
process.exit(fail);
