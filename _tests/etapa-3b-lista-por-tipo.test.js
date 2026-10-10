// Etapa 3b — la lista de preparación sale del tipo de salida.
//
//   node _tests/run-all.js      (preferido)
//   node _tests/etapa-3b-lista-por-tipo.test.js
//
// Qué conecta esta etapa: la 3a construyó y probó el camino de tres capas, y
// `itemsDeInstructorParaTipo()` **no la llamaba nadie** — medido el 09/10.
// El interruptor `FUENTE_PLANTILLAS` existía y no cambiaba nada.
//
// El problema de forma era que los cuatro lugares que dibujan o firman piden la
// lista SINCRÓNICAMENTE y la fuente nueva es asíncrona. Se resuelve una vez por
// salida (`fijarItemsDeLaSalida`) y los cuatro leen de `itemsDeLaSalida()`.
//
// LA COMPROBACIÓN QUE MÁS IMPORTA es «una sola vez por salida», y no es una
// optimización: los ids de ítem son la llave con la que se guardan los tildes.
// La lista cableada usa posiciones ('0','1',…) y la plantilla usa uuid. Si una
// salida resolviera su lista en cada dibujo, un corte de red a media mañana la
// pasaría de uuid a posicional y **todos los tildes de la tripulación se verían
// perdidos**: están guardados con la otra llave.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// La plantilla que "devuelve la base", y un contador de lecturas para poder
// comprobar que se lee una sola vez.
let lecturasALaBase = 0;
let plantillaDeLaBase = [{
  id: 'tpl-1',
  checklist_template_items: [
    { id: 'uuid-aaa', order_index: 2, text_en: 'Load towels',  text_es: 'Cargar toallas', active: true },
    { id: 'uuid-bbb', order_index: 1, text_en: 'Check tanks',  text_es: 'Chequear tanques', active: true },
    { id: 'uuid-ccc', order_index: 3, text_en: 'Retired item', text_es: 'Ítem retirado', active: false }
  ]
}];
let filtroTipo = null;

function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>{
      if(n==='checklist_templates'){
        lecturasALaBase++;
        const hay = filtroTipo && plantillaDeLaBase;
        return Promise.resolve({data: hay?plantillaDeLaBase:[], error:null}).then(res,rej);
      }
      return Promise.resolve({data:[],error:null}).then(res,rej);
    };
    if(prop==='eq') return (col,val)=>{ if(col==='trip_type_id') filtroTipo=val; return new Proxy({},h); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-fran'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  idioma:(l)=>{currentLanguage=l;},
  setOrg:(id)=>{currentOrgId=id;},offline:(v)=>{isOffline=v;},
  fuente:(f)=>{FUENTE_PLANTILLAS=f;}, verFuente:()=>FUENTE_PLANTILLAS,
  salida:(id,tipo)=>{checklistTripById[id]={name:'Salida '+id,date:'2026-10-09',time:null,tripTypeId:tipo};},
  setTrip:(id)=>{currentChecklistTripId=id;},
  fijar:(id)=>fijarItemsDeLaSalida(id),
  items:(id)=>itemsDeLaSalida(id),
  cableadas:()=>INSTRUCTOR_ITEMS_get(),
  cache:()=>instructorItemsByTrip,
  olvidarCacheLocal:()=>{ try{localStorage.clear();}catch(e){} }
};`;
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,300):'');
if(boot) process.exit(1);

const T=window.__t;
T.idioma('en'); T.setOrg('org-1'); T.offline(false);

(async()=>{ try {

  // ─── El interruptor quedó en 'base', que es lo que la 3b hace ───
  chk('FUENTE_PLANTILLAS quedó en «base»', T.verFuente()==='base', T.verFuente());
  chk('y el default del archivo también',
      /let FUENTE_PLANTILLAS = 'base'/.test(html));

  const cableadas = T.cableadas();
  chk('hay una lista cableada de respaldo', cableadas.length > 0, cableadas.length+' ítems');

  // ─── Con plantilla: la lista sale del tipo de salida ───
  T.olvidarCacheLocal();
  lecturasALaBase = 0;
  T.salida('trip-A', 'tipo-buceo');
  const items = await T.fijar('trip-A');
  chk('la lista sale de la plantilla, no de la cableada',
      items.length===2, items.length+' ítems (2 activos de 3)');
  chk('el ítem inactivo de la plantilla no se muestra',
      !items.some(i=>/Retired/.test(i.text)));
  chk('vienen ordenados por order_index, no como los devolvió la base',
      items[0].text==='Check tanks' && items[1].text==='Load towels',
      items.map(i=>i.text).join(' | '));

  // Los ids son uuid y no posiciones — es de lo que depende todo lo demás.
  chk('los ids son el uuid del ítem, no su posición',
      items[0].id==='uuid-bbb' && items[1].id==='uuid-aaa',
      items.map(i=>i.id).join(', '));
  chk('y NO coinciden con los ids de la lista cableada',
      !items.some(i => cableadas.some(c => c.id === i.id)));

  // ─── UNA SOLA VEZ: la comprobación que protege los tildes ───
  const lecturasTrasLaPrimera = lecturasALaBase;
  for (let i=0;i<5;i++) await T.fijar('trip-A');
  chk('resolver cinco veces más no vuelve a leer la base',
      lecturasALaBase === lecturasTrasLaPrimera,
      `${lecturasALaBase} lecturas en total`);

  // Y si la base se cae después, la lista NO cambia de forma: los tildes ya
  // guardados con uuid siguen coincidiendo.
  const antes = T.items('trip-A').map(i=>i.id).join(',');
  plantillaDeLaBase = null;              // la base deja de responder
  T.offline(true);                        // y encima nos quedamos sin señal
  await T.fijar('trip-A');
  chk('sin señal, una salida ya resuelta conserva SU lista',
      T.items('trip-A').map(i=>i.id).join(',') === antes,
      T.items('trip-A').map(i=>i.id).join(','));
  T.offline(false);

  // ─── Sin plantilla: cae a la cableada y nadie queda sin lista ───
  // Es la capa 3, y es la razón por la que esto se puede conectar sin riesgo.
  plantillaDeLaBase = [];
  filtroTipo = null;
  T.salida('trip-B', 'tipo-sin-plantilla');
  const sinPlantilla = await T.fijar('trip-B');
  chk('un tipo sin plantilla cae a la lista cableada',
      sinPlantilla.length === cableadas.length, sinPlantilla.length+' ítems');
  // Esta comprobación afirmaba lo contrario y estaba mal. La caída a lo
  // cableado SE GUARDA, con un centinela: si no, la salida volvería a consultar
  // en cada dibujo y el día que la plantilla apareciera —alguien activa la
  // categoría a media mañana— la lista pasaría de posiciones a uuid con la
  // tripulación tildando, y los tildes se verían todos perdidos.
  // Para una salida abierta, estabilidad le gana a frescura.
  chk('la caída a lo cableado también se recuerda, para no cambiar de llave',
      T.cache()['trip-B'] === 'cableado', String(T.cache()['trip-B']));
  const lecturasAntes = lecturasALaBase;
  await T.fijar('trip-B'); await T.fijar('trip-B');
  chk('y por eso una salida sin plantilla tampoco re-consulta',
      lecturasALaBase === lecturasAntes, `${lecturasALaBase} lecturas`);

  // Una salida sin tipo de salida: mismo camino.
  T.salida('trip-C', null);
  const sinTipo = await T.fijar('trip-C');
  chk('una salida sin tipo también cae a la cableada',
      sinTipo.length === cableadas.length);

  // Y una salida que nunca se resolvió: `itemsDeLaSalida` no devuelve vacío.
  chk('una salida nunca resuelta devuelve la cableada, nunca una lista vacía',
      T.items('trip-jamas-visto').length === cableadas.length);

  // ─── Dos salidas del mismo día no se pisan la lista ───
  plantillaDeLaBase = [{ id:'tpl-2', checklist_template_items:[
    { id:'uuid-zzz', order_index:1, text_en:'Only item', text_es:'Único ítem', active:true }]}];
  T.salida('trip-D', 'tipo-surf');
  await T.fijar('trip-D');
  chk('cada salida tiene su propia lista',
      T.items('trip-D').length===1 && T.items('trip-A').length===2,
      `D=${T.items('trip-D').length} A=${T.items('trip-A').length}`);

  // ─── El idioma es de quien mira, no de cuando se guardó ───
  T.idioma('es');
  chk('la lista se muestra en el idioma actual',
      /Único ítem/.test(T.items('trip-D')[0].text), T.items('trip-D')[0].text);
  T.idioma('en');

  // ─── Volver atrás es una línea ───
  T.fuente('cableado');
  T.salida('trip-E', 'tipo-buceo');
  const conInterruptorApagado = await T.fijar('trip-E');
  chk('con el interruptor en «cableado» se usa la lista cableada',
      conInterruptorApagado.length === cableadas.length,
      conInterruptorApagado.length+' ítems');
  T.fuente('base');

  // ─── Guardianes estructurales ───
  // Los cuatro lugares que piden la lista tienen que pedirla al MISMO lugar. Si
  // uno queda pidiendo la cableada, el acta guarda ítems que nadie vio o los
  // tildes se indexan con otra llave.
  chk('la lista se pide desde un solo lugar',
      (html.match(/function itemsDeLaSalida\(/g)||[]).length===1 &&
      (html.match(/itemsDeLaSalida\(/g)||[]).length>=5,
      (html.match(/itemsDeLaSalida\(/g)||[]).length+' usos');
  chk('ya no quedan llamadas sueltas a la lista cableada en los caminos vivos',
      (html.match(/INSTRUCTOR_ITEMS_get\(\)/g)||[]).length===3,
      (html.match(/INSTRUCTOR_ITEMS_get\(\)/g)||[]).length+
      ' (definición + respaldo de las 3 capas + respaldo de itemsDeLaSalida)');
  chk('se fija una sola vez, en una sola función',
      (html.match(/async function fijarItemsDeLaSalida\(/g)||[]).length===1 &&
      /if \(!tripId \|\| instructorItemsByTrip\[tripId\]\) return/.test(html));
  chk('la lista se resuelve ANTES de dibujar y de leer los tildes',
      /const items = await fijarItemsDeLaSalida\(tripId\);[\s\S]{0,400}?loadChecklistProgress/.test(html));
  chk('el acta usa la misma lista que se tildó',
      /const instructorItems = itemsDeLaSalida\(currentChecklistTripId\);/.test(html));
  chk('el tipo de salida viaja en checklistTripById',
      /tripTypeId: tr\.trip_type_id \|\| null/.test(html) &&
      /trip_type_id, trip_types\(/.test(html));

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }
  process.exit(fail);
})();
