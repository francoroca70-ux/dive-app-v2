// El acta registra de dónde salió la lista — index.html real en jsdom.
//
//   node _tests/fuente-de-la-lista.test.js
//
// El agujero (14/10): cuando un tipo de salida no tiene plantilla propia, en el
// barco aparece la lista **cableada genérica** de `index.html` — no las semillas
// buenas, que hay que copiar primero. El instructor la tilda entera y firma, y
// el acta quedaba diciendo «preparación 14/14» **sin decir contra qué lista**.
//
// Nadie miente, pero el registro afirma algo más fuerte de lo que pasó: que la
// salida se preparó según la checklist del centro. Y en *Blue water* eso son 8
// salidas reales contra 7 tipos sin plantilla.
//
// Lo que se prueba acá es que el acta dice la verdad y **que no dice más de lo
// que sabe**: `null` es una respuesta legítima y no se rellena.
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
  "setOrg:(id)=>{currentOrgId=id;},setIdioma:(l)=>{currentLanguage=l;},"+
  "fuente:(role,tripId)=>fuenteDeLaLista(role,tripId),"+
  "guardarEnTrip:(tripId,v)=>{instructorItemsByTrip[tripId]=v;},"+
  "salida:(tripId,s)=>{checklistTripById[tripId]=s;},"+
  "payload:(o)=>buildRecordPayload(o),"+
  "linea:(acta)=>lineaDeFuenteDeLista(acta)};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

try{
const T=window.__t;
T.setOrg('org-1');

// ─── 1 · La lista de una salida: plantilla vs cableada ───
T.guardarEnTrip('t-con', [{id:'uuid-1',order_index:0,text_en:'Tanks',text_es:'Tanques'}]);
T.guardarEnTrip('t-sin', 'cableado');
chk('con filas de plantilla, la fuente es la del centro',
    T.fuente('instructor','t-con')==='template', T.fuente('instructor','t-con'));
chk('con el centinela «cableado», la fuente es la genérica',
    T.fuente('instructor','t-sin')==='hardwired', T.fuente('instructor','t-sin'));

// ─── 2 · Lo que NO se sabe no se afirma ───
chk('una salida que todavía no resolvió su lista devuelve null',
    T.fuente('instructor','t-nunca-abierta')===null,
    'null es una respuesta: no se inventa una procedencia que no se midió');
chk('y un array vacío también cuenta como genérica, no como plantilla',
    (T.guardarEnTrip('t-vacio',[]), T.fuente('instructor','t-vacio'))==='hardwired',
    'una plantilla sin ítems activos cae a la cableada en el barco');

// ─── 3 · Los otros dos tipos de checklist ───
chk('una checklist propia del centro es del centro, por definición',
    T.fuente('custom_abc123', null)==='template');
// **Cambió con el A1-a (21/10) y la aserción cambió con él.** Antes esto
// devolvía `'hardwired'` cableado para cualquier rol de departamento, y era
// cierto: `scope='department'` tenía cero plantillas. Ahora una rutina mira su
// propio centinela, igual que una salida — porque dejarlo fijo haría que el acta
// afirmara «lista genérica» sobre una rutina que el centro sí escribió, en
// cuanto el interruptor se prenda.
//
// Sin `scopeKey` no hay instancia que mirar, así que **no se afirma nada**. Eso
// no es una regresión: es la misma regla que ya regía para una salida sin
// resolver, y es lo que distingue «no se midió» de «era la genérica».
chk('una rutina de departamento sin instancia resuelta no afirma nada',
    T.fuente('captain_eod', null)===null, String(T.fuente('captain_eod', null)));
chk('…y las cuatro cadencias se comportan igual',
    ['captain','captain_eod','captain_monthly','instructor_morning']
      .every(r=>T.fuente(r,null)===null));
chk('sin rol no se afirma nada', T.fuente(null,null)===null && T.fuente('',null)===null);

// ─── 4 · Llega al acta, y lo decide UN solo lugar ───
T.salida('t-sin',{name:'1 Dive',date:'2026-10-14',time:'10:00'});
const p = T.payload({ role:'instructor', tripId:'t-sin',
  items:[{id:'0',text:'Tanks'}], estaTildado:()=>true,
  signer:{name:'Pau',staff_id:'st-pau'}, hechos:1, checks:{}, motivos:{} });
chk('el acta lleva items_source', p.items_source==='hardwired', String(p.items_source));
chk('y lo decide buildRecordPayload, no los tres que firman',
    (html.match(/function fuenteDeLaLista/g)||[]).length===1 &&
    (html.match(/fuenteDeLaLista\(/g)||[]).length===2,
    (html.match(/fuenteDeLaLista\(/g)||[]).length+' menciones: declaración + un uso');
// Ojo: `buildRecordPayload({` matchea también la DECLARACIÓN, que destructura
// su argumento. 1 declaración + 3 llamadas = 4, y contar 3 era mi error, no el
// del código.
const armador=(html.match(/buildRecordPayload\(\{/g)||[]).length;
chk('los tres caminos que firman usan el mismo armador',
    armador===4, armador+' = 1 declaración + 3 llamadas');

const p2 = T.payload({ role:'instructor', tripId:'t-con',
  items:[{id:'uuid-1',text:'Tanks'}], estaTildado:()=>true,
  signer:{name:'Pau',staff_id:'st-pau'}, hechos:1, checks:{}, motivos:{} });
chk('una salida con plantilla del centro queda registrada como tal',
    p2.items_source==='template', String(p2.items_source));

// ─── 5 · En pantalla: sólo cuando la lista NO era del centro ───
chk('un acta contra la genérica lo dice',
    /standard list/.test(T.linea({items_source:'hardwired'})),
    T.linea({items_source:'hardwired'}).slice(0,60));
chk('un acta contra la lista del centro NO dice nada',
    T.linea({items_source:'template'})==='',
    'sería ruido en todas las actas');
chk('un acta vieja (null) tampoco dice nada',
    T.linea({items_source:null})==='' && T.linea({})==='',
    'no se sabe, así que no se afirma');
chk('y aguanta que no venga acta', T.linea(null)==='' && T.linea(undefined)==='');
chk('el texto apunta a DÓNDE se arregla',
    /Settings → Trip Types/.test(T.linea({items_source:'hardwired'})),
    'un aviso sin salida es un reproche');

// ─── 6 · La línea la redacta UN lugar, usado por las dos vistas del acta ───
// Se afirma que se declara una vez y que las DOS vistas la llaman, por sus
// llamadas concretas. Contar menciones no servía: el 15/10 pasó de 3 a 4 porque
// un comentario la nombra, y un comentario no es un lector.
chk('lineaDeFuenteDeLista se declara una vez',
    (html.match(/function lineaDeFuenteDeLista/g)||[]).length===1);
chk('y la llaman las dos vistas que muestran un acta',
    /lineaDeFuenteDeLista\(acta\) \+/.test(html) &&
    /\? lineaDeFuenteDeLista\(r\) \+/.test(html),
    'la pantalla de la salida y Logged Checklists');
chk('la pantalla de la salida le pasa el acta entera a renderActaItems',
    /renderActaItems\(containerId, detalle, progressId, acta\)/.test(html),
    'antes sólo recibía el snapshot, que no trae items_source');
chk('y Logged Checklists usa la fila completa del acta',
    /lineaDeFuenteDeLista\(r\)/.test(html));

// ─── 7 · Español ───
T.setIdioma('es');
chk('en español también lo dice',
    /lista estándar/.test(T.linea({items_source:'hardwired'})),
    T.linea({items_source:'hardwired'}).slice(0,60));
T.setIdioma('en');

// ─── 8 · i18n y el porqué escrito ───
chk('el texto nuevo está en los dos idiomas',
    (html.match(/\bcl_acta_lista_generica:/g)||[]).length===2,
    (html.match(/\bcl_acta_lista_generica:/g)||[]).length+' definiciones');
chk('y queda escrito que la ausencia de línea NO es una garantía',
    /ausencia de línea no significa «estaba bien»/.test(html),
    'o estaba bien o es vieja — para que nadie lo lea al revés');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
process.exit(fail);
