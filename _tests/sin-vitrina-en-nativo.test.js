// Nada que parezca una compra dentro de la app de una tienda.
//
//   node _tests/run-all.js      (preferido)
//   node _tests/sin-vitrina-en-nativo.test.js
//
// POR QUÉ EXISTE ESTE ARCHIVO, con el número delante: Apple se queda con
// 15–30% de lo que se cobre por In-App Purchase, contra ~5% de Paddle. Y el
// IAP además no encaja con el producto — la suscripción es del CENTRO y la
// usan seis personas en tres plataformas, no de un Apple ID. Ése es el caso de
// Enterprise Services (guía 3.1.3(c)): se le vende al negocio y el negocio le
// da acceso a su gente.
//
// EL FALLO QUE ESTO CUIDA, medido el 11/10: el corte de nativo estaba puesto
// en DOS lugares —el checkout y el portal de facturación— y se le había
// escapado el tercero, que era el peor. `enforceSubscriptionGate()` levantaba
// un modal **no cerrable** con las tarjetas de los tres planes y los
// **precios en dólares** dentro de la app de iOS. O sea una vitrina, sin IAP,
// señalando una compra en la web. Apple preguntó por el modelo de negocio
// (2.1(b)) el 08/10 antes de terminar la revisión.
//
// La regla vive ahora en `puedeMostrarPrecios()`, y se llama por lo que decide
// y no por dónde estamos: «una copia distribuida por una tienda de apps no
// muestra nada que parezca una compra».
//
// LO QUE SE AFIRMA ES LO QUE UN REVISOR MIRARÍA: que **ningún precio** quede
// en la pantalla ni en el DOM. No «que esté escondido» — escondido es más
// débil y más difícil de probar que ausente.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

function fakeQuery(){
  const h={ get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:[],error:null,count:0}).then(res,rej);
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>fakeQuery(),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  idioma:(l)=>{currentLanguage=l;},
  rol:(r)=>{currentUserRole=r;},
  // Así se hace pasar el test por la app nativa: Capacitor presente y
  // devolviendo 'ios'. Es exactamente lo que mira isNativeAppShell().
  nativo:(plataforma)=>{ if(plataforma){ window.Capacitor={getPlatform:()=>plataforma}; } else { delete window.Capacitor; } },
  esNativo:()=>isNativeAppShell(),
  puedePrecios:()=>puedeMostrarPrecios(),
  abrirModal:(motivo)=>openChoosePlanModal(motivo),
  cerrarModal:()=>{ window._subscriptionLocked=false; closeChoosePlanModal(); },
  dibujarTarjetas:()=>renderPlanCards(),
  colaDeAviso:(needs)=>colaDeAvisoDePlan(needs),
  banner:(status,trialEndsAt)=>{ window.currentOrgSubscriptionStatus=status;
                                 window.currentOrgTrialEndsAt=trialEndsAt;
                                 updateTrialBanner(); },
  limite:(el,recurso,bloque)=>showPlanLimitMessage(el,recurso,bloque),
  tarjetaFacturacion:(org)=>updateBillingCard(org),
  compuerta:(status,trialEndsAt)=>enforceSubscriptionGate(status,trialEndsAt),
  precios:()=>PLAN_PRICING
};`;
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,300):'');
if(boot) process.exit(1);

const T=window.__t;
const doc=window.document;
const modal  = () => doc.getElementById('modal-choose-plan');
const grilla = () => doc.getElementById('plan-cards-grid');
const ciclo  = () => doc.getElementById('plan-cycle-toggle');
const tarjeta= () => doc.getElementById('card-billing');

// Los precios reales, leídos del código y no escritos a mano acá: si mañana
// cambian, este test sigue buscando los de verdad.
const PRECIOS = Object.values(T.precios()).flatMap(p => [String(p.monthly), String(p.annual)]);

// Busca un precio en el texto visible del modal. `$79`, `$169`, `$329` y los
// anuales. Es la comprobación que más vale: es lo que ve un revisor.
function hayPrecioEnPantalla() {
  const txt = (modal().textContent || '');
  return PRECIOS.filter(p => txt.includes(p));
}
function hayPrecioEnElDOM() {
  const h = modal().innerHTML || '';
  return PRECIOS.filter(p => h.includes('$' + p));
}

(async()=>{ try {

  T.idioma('en'); T.rol('owner');

  // ─── 1 · La detección, y que un solo lugar decida ───
  T.nativo(null);
  chk('en el navegador no se detecta app nativa', T.esNativo()===false);
  chk('y se pueden mostrar precios', T.puedePrecios()===true);

  T.nativo('ios');
  chk('con Capacitor en iOS se detecta app nativa', T.esNativo()===true);
  chk('y NO se pueden mostrar precios', T.puedePrecios()===false);
  T.nativo('android');
  chk('en Android, lo mismo — Google Play tiene la misma política',
      T.puedePrecios()===false);
  T.nativo('web');
  chk('Capacitor reportando «web» NO es la app de una tienda',
      T.puedePrecios()===true);

  chk('la regla vive en una sola función',
      (html.match(/function puedeMostrarPrecios\(/g)||[]).length===1);
  chk('y la consultan los CUATRO caminos, no dos',
      (html.match(/puedeMostrarPrecios\(\)/g)||[]).length>=5, // 1 decl + 4 usos
      (html.match(/puedeMostrarPrecios\(\)/g)||[]).length+' menciones');

  // ─── 2 · EL BLOQUEO EN NATIVO NO MUESTRA UN SOLO PRECIO ───
  //
  // Éste es el fallo que estaba en producción. Es la comprobación central del
  // archivo.
  T.nativo('ios'); T.idioma('en');
  T.abrirModal('trial_expired');
  chk('el bloqueo se abre igual: el centro tiene que saber que está bloqueado',
      modal().style.display==='flex');
  chk('NO hay ningún precio en la pantalla',
      hayPrecioEnPantalla().length===0, hayPrecioEnPantalla().join(', '));
  chk('ni ningún precio en el DOM, aunque estuviera escondido',
      hayPrecioEnElDOM().length===0, hayPrecioEnElDOM().join(', '));
  chk('la grilla de planes queda vacía, no sólo oculta',
      grilla().innerHTML.trim()==='', grilla().innerHTML.slice(0,60));
  chk('y además oculta', grilla().style.display==='none');
  chk('el selector mensual/anual no se muestra', ciclo().style.display==='none');
  // Se buscan ELEMENTOS con ese onclick, no el texto en el innerHTML: la
  // primera versión buscaba el texto y daba FAIL por un **comentario** del
  // markup que menciona la función para explicar un bug de Paddle. Un test que
  // busca un string mide la documentación, no el código — segunda vez hoy.
  const botonesDeCompra = () => modal().querySelectorAll('[onclick*="openPaddleCheckout"]').length;
  chk('no queda ningún botón de comprar en el modal', botonesDeCompra()===0,
      botonesDeCompra()+' botones');

  // Lo que SÍ tiene que ver el dueño: por qué está bloqueado y quién lo
  // arregla. Esconderlo sin explicación cambiaría un problema de tienda por
  // una app que parece rota.
  chk('dice que la suscripción la gestiona el centro, no la app',
      /dive centre|charter operation/i.test(modal().textContent),
      modal().textContent.replace(/\s+/g,' ').trim().slice(0,110));
  chk('y el motivo se dice sin pedir «elegí un plan», que acá no existe',
      !/Choose a plan/i.test(modal().textContent),
      modal().textContent.replace(/\s+/g,' ').trim().slice(0,110));
  chk('el bloqueo sigue sin poderse cerrar, igual que en la web',
      doc.getElementById('choose-plan-close-btn').style.display==='none');

  // Los dos motivos, en nativo, sin el pedido de compra.
  T.abrirModal('subscription_canceled');
  chk('el otro motivo también se dice en versión nativa',
      /no longer active/i.test(modal().textContent) &&
      !/Choose a plan/i.test(modal().textContent),
      modal().textContent.replace(/\s+/g,' ').trim().slice(0,90));

  // ─── 3 · EN LA WEB NO SE PERDIÓ NADA ───
  //
  // La contracara: es donde Fran cobra. Si este cambio apagara la vitrina en
  // el navegador, apagaría el negocio.
  window._subscriptionLocked = false;
  T.nativo(null); T.idioma('en');
  T.abrirModal('trial_expired');
  chk('en la web los tres precios siguen apareciendo',
      hayPrecioEnPantalla().length>=3, hayPrecioEnPantalla().join(', '));
  chk('la grilla se dibuja', grilla().innerHTML.length>50);
  chk('y se muestra', grilla().style.display==='grid');
  chk('el selector mensual/anual vuelve', ciclo().style.display==='flex');
  chk('los tres botones de checkout están, uno por plan',
      modal().querySelectorAll('[onclick*="openPaddleCheckout"]').length===3,
      modal().querySelectorAll('[onclick*="openPaddleCheckout"]').length+' botones');
  chk('y el título vuelve a ser el de elegir plan',
      /Choose your plan/i.test(modal().textContent),
      modal().textContent.replace(/\s+/g,' ').trim().slice(0,60));

  // Sin motivo de bloqueo se puede cerrar, como siempre.
  window._subscriptionLocked = false;
  T.abrirModal(null);
  chk('sin bloqueo el modal se puede cerrar',
      doc.getElementById('choose-plan-close-btn').style.display==='');

  // ─── 4 · LA TARJETA DE FACTURACIÓN ───
  //
  // Decisión de Fran: en nativo no se muestra. No se pierde nada que funcione
  // hoy — gestionar el plan ya era sólo web desde el 30/09 — y al personal
  // nunca se le mostró, porque la tarjeta siempre fue de dueño.
  const ORG = { subscription_status:'active', plan_tier:'growth', trial_ends_at:null };
  T.nativo(null); T.rol('owner');
  T.tarjetaFacturacion(ORG);
  chk('en la web el dueño ve la tarjeta de facturación',
      tarjeta().style.display==='block');

  T.nativo('ios');
  T.tarjetaFacturacion(ORG);
  chk('en la app nativa NO la ve', tarjeta().style.display==='none');

  T.nativo(null); T.rol('instructor');
  T.tarjetaFacturacion(ORG);
  chk('y el personal no la ve en ninguna de las dos, que ya era así',
      tarjeta().style.display==='none');
  T.rol('owner');

  // ─── 5 · LA COMPUERTA SIGUE SIENDO LA MISMA ───
  //
  // Lo que cambió es QUÉ se muestra al bloquear, no CUÁNDO se bloquea. Un
  // centro con el trial vencido queda bloqueado en las dos plataformas: si
  // nativo no bloqueara, la app de iOS sería el producto gratis.
  const ayer = new Date(Date.now() - 86400000).toISOString();
  const manana = new Date(Date.now() + 86400000).toISOString();
  for (const [donde, plataforma] of [['web', null], ['nativo', 'ios']]) {
    T.nativo(plataforma);
    window._subscriptionLocked = false;
    modal().style.display = 'none';
    T.compuerta('trial', ayer);
    chk(`(${donde}) un trial vencido bloquea`, modal().style.display==='flex');

    window._subscriptionLocked = false;
    modal().style.display = 'none';
    T.compuerta('trial', manana);
    chk(`(${donde}) un trial vigente no bloquea`, modal().style.display==='none');

    window._subscriptionLocked = false;
    modal().style.display = 'none';
    T.compuerta('canceled', null);
    chk(`(${donde}) una suscripción cancelada bloquea`, modal().style.display==='flex');

    window._subscriptionLocked = false;
    modal().style.display = 'none';
    // 'past_due' queda sin bloquear a propósito, acompañando los reintentos
    // de cobro de Paddle: un problema con la tarjeta no deja a una
    // tripulación afuera a mitad de la mañana.
    T.compuerta('past_due', null);
    chk(`(${donde}) un pago con problemas NO bloquea`, modal().style.display==='none');
  }

  // ─── 6 · LOS TEXTOS, EN LOS DOS IDIOMAS ───
  const claves=['bp_native_locked_title','bp_native_manage_on_web',
                'bp_locked_trial_expired_native','bp_locked_canceled_native'];
  const faltan=claves.filter(k=>(html.match(new RegExp(k+':','g'))||[]).length<2);
  chk('los textos nuevos están en inglés y en español', faltan.length===0,
      faltan.join(', ')||'los cuatro en ambos');

  T.nativo('ios'); T.idioma('es');
  window._subscriptionLocked = false;
  T.abrirModal('trial_expired');
  chk('el bloqueo nativo se explica en español',
      /centro de buceo|operación de charter/i.test(modal().textContent),
      modal().textContent.replace(/\s+/g,' ').trim().slice(0,110));
  chk('y en español tampoco aparece un precio',
      hayPrecioEnPantalla().length===0, hayPrecioEnPantalla().join(', '));
  T.idioma('en'); T.nativo(null);

  // ─── 6b · LAS OTRAS TRES PUERTAS AL MODAL DE PLANES ───
  //
  // Cerrar la vitrina no alcanzaba. Había **tres** entradas más que el primer
  // arreglo no había tocado: un enlace «ver los planes» pegado al aviso de
  // tope de barcos, otro en el que frena al crear uno, y el banner de trial
  // con «elegí un plan» **dentro del texto traducido**. Con la vitrina apagada
  // ya no mostraban precios, pero un enlace que invita a elegir un plan sigue
  // siendo un llamado a comprar, y en la app no llevaba a ningún lado útil.
  //
  // Las encontré leyendo quién llama a `openChoosePlanModal()`. La pregunta
  // «¿quién llama a esto?» es la que destapó esto y la etapa 3b.
  T.nativo(null); T.idioma('en');
  const colaWeb = T.colaDeAviso('growth');
  chk('en la web el aviso de límite ofrece ver los planes',
      /openChoosePlanModal/.test(colaWeb), colaWeb.replace(/<[^>]*>/g,' ').trim().slice(0,70));

  T.nativo('ios');
  const colaApp = T.colaDeAviso('growth');
  chk('en la app NO hay enlace al modal de planes',
      !/openChoosePlanModal/.test(colaApp), colaApp.slice(0,90));
  chk('ni queda una etiqueta <a> suelta', !/<a/.test(colaApp));
  chk('pero el aviso sigue diciendo quién lo resuelve',
      /administrator/i.test(colaApp), colaApp.trim().slice(0,80));
  chk('y no nombra un plan al que pasarse',
      !/growth/i.test(colaApp), colaApp.trim().slice(0,80));

  chk('la cola del aviso la decide una sola función',
      (html.match(/function colaDeAvisoDePlan\(/g)||[]).length===1);
  chk('y el único enlace al modal que queda en el archivo vive ahí',
      (html.match(/openChoosePlanModal\(\); return false/g)||[]).length===1,
      (html.match(/openChoosePlanModal\(\); return false/g)||[]).length+' enlaces');

  // El aviso que frena al crear un barco pasa por la misma cola.
  const feedback = doc.createElement('span');
  T.nativo('ios');
  T.limite(feedback, 'boats', { max:3, needs:'growth' });
  chk('el aviso al crear un barco tampoco ofrece el modal en la app',
      !/openChoosePlanModal/.test(feedback.innerHTML),
      feedback.textContent.slice(0,80));
  chk('y sigue diciendo cuál es el tope', /3/.test(feedback.textContent),
      feedback.textContent.slice(0,80));

  // El banner de trial: el enlace venía dentro de la traducción, así que acá
  // hacen falta claves aparte y no se puede quitar el <a> desde el código.
  const bannerEl = () => doc.getElementById('trial-banner');
  const enTresDias = new Date(Date.now() + 2*86400000).toISOString();
  const ayerBanner = new Date(Date.now() - 86400000).toISOString();

  T.nativo(null);
  T.banner('trial', enTresDias);
  chk('en la web el banner de trial ofrece elegir un plan',
      /openChoosePlanModal/.test(bannerEl().innerHTML));

  T.nativo('ios');
  T.banner('trial', enTresDias);
  chk('en la app el banner NO ofrece elegir un plan',
      !/openChoosePlanModal/.test(bannerEl().innerHTML),
      bannerEl().textContent.trim().slice(0,90));
  chk('pero sí avisa que la prueba está por terminar',
      /free trial ends/i.test(bannerEl().textContent),
      bannerEl().textContent.trim().slice(0,90));
  chk('y el banner sigue visible: el centro tiene que enterarse',
      bannerEl().style.display==='flex');

  T.banner('trial', ayerBanner);
  chk('con la prueba ya terminada, tampoco hay enlace de compra',
      !/openChoosePlanModal/.test(bannerEl().innerHTML),
      bannerEl().textContent.trim().slice(0,90));
  chk('y dice quién la reactiva',
      /administrator/i.test(bannerEl().textContent),
      bannerEl().textContent.trim().slice(0,90));

  // Ningún precio en ninguno de los tres avisos, que es la prueba de fondo.
  chk('ningún aviso de plan filtra un precio en la app',
      !PRECIOS.some(p => (bannerEl().textContent + feedback.textContent + colaApp).includes(p)),
      'ninguno');

  T.nativo(null); T.banner(null, null);

  // ─── 7 · LAS DOS VERSIONES ───
  // El par va en UNA constante y el texto del chequeo se deriva de ella. Antes
  // el rótulo y el regex eran dos literales distintos y se desincronizaron el
  // mismo día que se escribieron: el cartel decía «subió a 11b» mientras el
  // regex exigía 11e. Un chequeo que miente sobre lo que exige es peor que no
  // tenerlo, porque el que lo lee se va con el dato equivocado.
  //
  // Que haya que editar estas dos líneas en cada cambio es a propósito: la
  // regla 5 de CLAUDE.md dice que los dos números suben juntos, y esto es lo
  // que lo convierte en un paso que falla si se saltea.
  const ESPERADO={ build:'2026-10-28g', sw:'seven-seas-v104' };
  // Desde el 26/10 el build vive en UNA constante y de ahí salen la consola y
  // la pantalla de Configuración, así que se busca la constante y no el texto
  // del console.info — que ahora se arma por concatenación.
  chk('el build subió a '+ESPERADO.build,
      html.includes("BUILD_WEB = '"+ESPERADO.build+"'"));
  chk('y la app lo MUESTRA, no sólo lo registra en la consola',
      (html.match(/data-app-build/g)||[]).length >= 3 && html.includes('function pintarBuild('),
      'y en las DOS pantallas de login, que son las que se ven cuando algo no anda y las únicas alcanzables sin iniciar sesión');
  const sw=fs.readFileSync(require('path').join(__dirname,'..','sw.js'),'utf8');
  chk('y el service worker a '+ESPERADO.sw, sw.includes(ESPERADO.sw));

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
process.exit(fail);
})();
