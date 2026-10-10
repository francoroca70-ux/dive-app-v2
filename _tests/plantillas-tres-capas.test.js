// Las tres capas de donde salen las listas, y el refresco al reconectar.
// Corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/plantillas-tres-capas.test.js
//
// Por qué existe esta etapa: las checklists funcionan sin señal SÓLO porque
// las listas están cableadas en index.html, que el service worker guarda en
// caché. Nada de localStorage guarda datos de la app y el service worker no
// toca los pedidos a Supabase. Así que leer las listas de la base sin más
// dejaría a un instructor en un barco sin señal sin NINGUNA lista — no una
// lista vacía, nada. Y ése es el escenario normal de un centro de buceo.
//
// La 3a construye el camino y lo deja probado sin mover el interruptor. La app
// sigue leyendo lo cableado; estos tests llaman al camino nuevo directamente,
// que es lo que impide que sea código muerto.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// Lo que la base devolvería, y si tiene que fallar.
let filasDeLaBase=null; let errorDeLaBase=null; let lecturas=0;
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>{
      if(n==='checklist_templates'){
        lecturas++;
        if(errorDeLaBase) return Promise.resolve({data:null,error:errorDeLaBase}).then(res,rej);
        return Promise.resolve({data:filasDeLaBase,error:null}).then(res,rej);
      }
      return Promise.resolve({data:[],count:0,error:null}).then(res,rej);
    };
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
const hook=main+"\n;window.__t={setOrg:(id)=>{currentOrgId=id;},offline:(v)=>{isOffline=v;},"+
  "fuente:(f)=>{FUENTE_PLANTILLAS=f;},verFuente:()=>FUENTE_PLANTILLAS,"+
  "idioma:(l)=>{currentLanguage=l;},cache:()=>progressCache,"+
  "ponerProgreso:(k,v)=>{progressCache[k]=v;},"+
  "setTrip:(id)=>{currentChecklistTripId=id;}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.offline(false); window.__t.idioma('en');

const FILAS=[{ id:'tpl-1', checklist_template_items:[
  { id:'it-b', order_index:2, text_en:'Ice stocked',  text_es:'Hielo cargado',  active:true },
  { id:'it-a', order_index:1, text_en:'Towels aboard',text_es:'Toallas a bordo',active:true },
  { id:'it-x', order_index:3, text_en:'Retired item', text_es:'Ítem jubilado',  active:false }
]}];

(async()=>{ try {

  // ─── El interruptor, ahora encendido ───
  //
  // Estas cuatro comprobaciones afirmaban que arrancaba en 'cableado', y era
  // correcto mientras el camino estaba construido y desconectado. La 3b (09/10)
  // lo conectó y lo pasó a 'base', así que ahora afirman lo contrario y lo que
  // cuidan es que **apagarlo siga funcionando** — porque la vuelta atrás es esa
  // sola línea y tiene que seguir siendo verdad.
  chk('el interruptor arranca en base (lo encendió la 3b)',
      window.__t.verFuente()==='base', window.__t.verFuente());

  window.__t.fuente('cableado');
  filasDeLaBase=FILAS; lecturas=0;
  let items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('apagándolo NO se le pregunta a la base', lecturas===0, lecturas+' lecturas');
  chk('y devuelve exactamente la lista cableada',
      items.length===window.INSTRUCTOR_ITEMS_get().length &&
      items[0].text===window.INSTRUCTOR_ITEMS_get()[0].text,
      items.length+' ítems');

  // ─── Capa 1: la base ───
  window.__t.fuente('base');
  window.localStorage.clear();
  filasDeLaBase=FILAS; lecturas=0;
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('capa 1: lee de la base', lecturas===1 && items.length===2, lecturas+' lecturas, '+items.length+' ítems');
  chk('respeta el orden de order_index, no el de llegada',
      items[0].text==='Towels aboard' && items[1].text==='Ice stocked',
      items.map(i=>i.text).join(' | '));
  chk('deja afuera los ítems jubilados (active=false)',
      !items.some(i=>/Retired/.test(i.text)), items.length+' ítems');
  chk('el id es el uuid del ítem, no su posición',
      items[0].id==='it-a', items[0].id);

  // El idioma de quien mira
  window.__t.idioma('es');
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('devuelve el texto en el idioma de quien mira', items[0].text==='Toallas a bordo', items[0].text);
  window.__t.idioma('en');

  // ─── Capa 2: la caché local, sin señal ───
  // Esto es lo que impide que un instructor en un barco se quede sin lista.
  window.__t.offline(true);
  filasDeLaBase=null; lecturas=0;
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('capa 2: sin señal NO le pregunta a la base', lecturas===0, lecturas+' lecturas');
  chk('y devuelve lo que había guardado, no la lista cableada',
      items.length===2 && items[0].text==='Towels aboard',
      items.length+' ítems: '+items.map(i=>i.text).join(' | '));

  // La caché guarda la fila BILINGÜE, no el texto resuelto. La primera versión
  // guardaba el resuelto y este test la agarró: quien guardaba en español y
  // cambiaba la app a inglés seguía viendo español sin señal.
  window.__t.idioma('es');
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('sin señal, cambiar de idioma igual cambia el texto',
      items[0].text==='Toallas a bordo', items[0].text);
  window.__t.idioma('en');
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('y vuelve al inglés sin volver a leer de la base',
      items[0].text==='Towels aboard' && lecturas===0, items[0].text+', '+lecturas+' lecturas');

  // ─── Capa 3: lo cableado, si nunca hubo una lectura exitosa ───
  // El tripulante nuevo que abre la app por primera vez justo en el barco.
  window.localStorage.clear();
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('capa 3: sin caché y sin señal cae en lo cableado',
      items.length===window.INSTRUCTOR_ITEMS_get().length, items.length+' ítems');
  chk('o sea que este camino NO puede dejar a nadie sin lista', items.length>0);

  // ─── Si la base falla con señal, tampoco se queda sin lista ───
  window.__t.offline(false);
  window.localStorage.clear();
  filasDeLaBase=FILAS;
  await window.itemsDeInstructorParaTipo('tt-1');        // llena la caché
  errorDeLaBase={message:'permission denied'};
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('si la base falla, usa la caché', items.length===2, items.length+' ítems');
  window.localStorage.clear();
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('si falla y no hay caché, cae en lo cableado',
      items.length===window.INSTRUCTOR_ITEMS_get().length, items.length+' ítems');
  errorDeLaBase=null;

  // Una plantilla que existe pero quedó sin ítems no puede ganarle a nada.
  window.localStorage.clear();
  filasDeLaBase=[{ id:'tpl-vacia', checklist_template_items:[] }];
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('una plantilla vacía no reemplaza a la lista cableada',
      items.length===window.INSTRUCTOR_ITEMS_get().length, items.length+' ítems');

  // ─── La caché está separada por centro ───
  // Un navegador puede tener varias cuentas guardadas; sin el centro en la
  // clave, un tripulante que cambia de centro vería las listas del otro.
  window.localStorage.clear();
  filasDeLaBase=FILAS; window.__t.setOrg('org-1');
  await window.itemsDeInstructorParaTipo('tt-1');
  window.__t.setOrg('org-2'); window.__t.offline(true);
  items=await window.itemsDeInstructorParaTipo('tt-1');
  chk('otro centro NO ve la caché del primero',
      items.length===window.INSTRUCTOR_ITEMS_get().length,
      items.length+' ítems (cayó en cableado, correcto)');
  const claves=Object.keys(window.localStorage).filter(k=>k.includes('plantilla_tipo'));
  chk('la clave de caché lleva el centro y la versión',
      claves.length===1 && /^ss_cache_v\d+_org-1_/.test(claves[0]), claves[0]||'(ninguna)');
  window.__t.setOrg('org-1'); window.__t.offline(false);

  // ─── Un fallo de localStorage no puede voltear la app ───
  const setOriginal=window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem=()=>{ throw new Error('QuotaExceededError'); };
  filasDeLaBase=FILAS;
  let exploto=false;
  try { items=await window.itemsDeInstructorParaTipo('tt-1'); } catch(e){ exploto=true; }
  chk('si localStorage lanza, la lista igual llega', !exploto && items.length===2,
      exploto?'explotó':items.length+' ítems');
  window.localStorage.setItem=setOriginal;

  // Una copia ilegible se ignora en vez de romper.
  window.localStorage.clear();
  setOriginal('ss_cache_v1_org-1_plantilla_tipo_tt-9','{esto no es json');
  window.__t.offline(true);
  items=await window.itemsDeInstructorParaTipo('tt-9');
  chk('una copia ilegible se ignora y cae en lo cableado',
      items.length===window.INSTRUCTOR_ITEMS_get().length, items.length+' ítems');
  window.__t.offline(false);

  // ─── Al reconectar se vuelve a leer el trabajo en curso ───
  // El bug: progressCache sólo se vaciaba al firmar, así que después de
  // recuperar la señal seguías viendo la copia de antes y NO lo que tildó el
  // resto de la tripulación. Sólo se arreglaba recargando la página.
  window.__t.ponerProgreso('loc-a:deck_morning:2026-10-07', { i1:true });
  chk('hay algo en la caché de progreso antes de reconectar',
      Object.keys(window.__t.cache()).length===1);
  doc.getElementById('cl-tripprep').style.display='none';
  doc.getElementById('cl-department').style.display='none';
  window.refrescarChecklistVisible();
  chk('al reconectar se vacía la caché de progreso',
      Object.keys(window.__t.cache()).length===0,
      JSON.stringify(window.__t.cache()));

  // Y redibuja la vista que esté abierta, no las dos.
  let dibujos=[];
  window.renderInstructorChecklistForTrip=(id)=>{ dibujos.push('instructor:'+id); };
  window.renderDeptRoutine=()=>{ dibujos.push('departamento'); };
  doc.getElementById('cl-tripprep').style.display='block';
  doc.getElementById('cl-department').style.display='none';
  window.__t.setTrip('trip-7');
  dibujos=[]; window.refrescarChecklistVisible();
  chk('redibuja la vista de la salida si es la que está abierta',
      dibujos.length===1 && dibujos[0]==='instructor:trip-7', dibujos.join(','));

  doc.getElementById('cl-tripprep').style.display='none';
  doc.getElementById('cl-department').style.display='block';
  dibujos=[]; window.refrescarChecklistVisible();
  chk('y la de departamento si es ésa', dibujos.length===1 && dibujos[0]==='departamento', dibujos.join(','));

  doc.getElementById('cl-department').style.display='none';
  dibujos=[]; window.refrescarChecklistVisible();
  chk('con ninguna abierta no dibuja nada', dibujos.length===0, dibujos.join(','));

  // ─── Guardián estructural ───
  chk('el reconectar vacía la cola y DESPUÉS refresca',
      /await flushOfflineQueue\(\);[\s\S]{0,700}?refrescarChecklistVisible\(\);/.test(html),
      'flush → refresco');
  chk('las tres capas viven en una sola función',
      (html.match(/async function cargarConTresCapas\(/g)||[]).length===1);
  chk('el interruptor está en base en el código que se despliega',
      /let FUENTE_PLANTILLAS = 'base'/.test(html), 'lo encendió la 3b el 09/10');
  // Y la vuelta atrás tiene que seguir siendo UNA línea: nadie más que
  // `cargarConTresCapas` puede mirar el interruptor, o apagarlo dejaría medio
  // camino encendido.
  chk('sólo cargarConTresCapas mira el interruptor',
      (html.match(/FUENTE_PLANTILLAS !== 'base'/g)||[]).length===1 &&
      (html.match(/FUENTE_PLANTILLAS/g)||[]).length===2,
      (html.match(/FUENTE_PLANTILLAS/g)||[]).length+' menciones: la declaración y la comprobación');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
  process.exit(fail);
})();
