// Que un centro vea lo que archivó — corre el index.html real en jsdom.
//
//   node _tests/salidas-archivadas.test.js
//
// El agujero que cierra: desde el 07/10 quitar una salida la ARCHIVA, y la app
// le promete al centro que archivar conserva («se quitó del calendario; sus
// reservas y registros siguen acá»). Pero no había ninguna pantalla donde
// mirarlo. Una promesa verdadera que no se puede comprobar se lee igual que una
// falsa, y lo único que el dueño ve es que la salida del martes no está.
//
// Lo que se prueba, entonces, no es «la tarjeta existe»: es que la tarjeta
// CONTESTA la pregunta —qué salida, cuándo era, en qué barco, cuándo se quitó—
// y que no inventa un dato cuando no lo tiene.
//
// OJO (trampas del arnés, aprendidas peleándolas):
//  · La app arranca en INGLÉS. Las aserciones van contra el texto inglés; que
//    cada clave exista también en español lo cubre el chequeo del final.
//  · Los ids del DOM real ya están tomados: no crear elementos con el id de la
//    app. Acá se usa el `#rep-archived-list` que ya trae el index.html.
//  · `nombreDeTripulante()` lee `signerStaffCache`. Si no se puebla, el nombre
//    no resuelve — que es justo uno de los casos a probar, pero hay que poder
//    elegir cuál se está corriendo.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
// Las fechas NO se afirman ya formateadas: la app formatea con `localeDeLaApp()`
// y no con el idioma de la máquina, y eso hacía que la suite diera 0 fallos en el sandbox
// y 5 en el Windows de Fran sobre el mismo commit. Ver _tests/contar.js.
const { fechaDeDiaEnLaApp } = require('./contar');
// La app formatea con `localeDeLaApp()`; estos tests corren en inglés.
const elDia = (d) => fechaDeDiaEnLaApp(d, 'en');
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
  from:()=>tabla(),
  rpc:async()=>({data:null,error:null}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={setOrg:(id)=>{currentOrgId=id;},"+
  "tripulacion:(s)=>{signerStaffCache=s;},"+
  "dibujar:(filas,todos)=>renderArchivedTrips(filas,todos)};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

try{
window.__t.setOrg('org-1');
const lista=()=>doc.getElementById('rep-archived-list');
const texto=()=>(lista().textContent||'').replace(/\s+/g,' ').trim();

// ─── La tarjeta existe en la página del dueño ───
chk('la tarjeta vive en Reportes, que ya es sólo del dueño',
    !!doc.querySelector('#page-reports #rep-archived-card'));
chk('y tiene su contenedor de lista', !!lista());
chk('el título y la explicación son traducibles, no texto pegado',
    !!doc.querySelector('#rep-archived-card [data-i18n="rep_archived_trips"]') &&
    !!doc.querySelector('#rep-archived-card [data-i18n="rep_archived_trips_desc"]'));

// ─── Vacío: un mensaje, no una tarjeta en blanco ───
window.__t.dibujar([],false);
chk('sin archivadas dice que no hubo ninguna en el rango',
    /No trips were archived in this range/.test(texto()), texto().slice(0,80));
window.__t.dibujar(null,false);
chk('y aguanta que la consulta no haya devuelto nada (null)',
    /No trips were archived in this range/.test(texto()));

// ─── Una fila contesta la pregunta completa ───
window.__t.tripulacion([{id:'st-pau',full_name:'Pau Giménez'}]);
const unaFila=[{id:'t1',trip_date:'2026-10-07',trip_time:'10:00:00',
  trip_name:'Island Hopping AM',trip_type:'1 Dive',
  archived_at:'2026-10-07T12:00:10Z',archived_by:'st-pau',
  boats:{name:'Sea Dragon'},locations:{name:'Blue water'}}];
window.__t.dibujar(unaFila,false);
let tx=texto();
chk('dice qué salida era',   /Island Hopping AM/.test(tx), tx.slice(0,140));
chk('dice cuándo era',       tx.includes(elDia('2026-10-07')), elDia('2026-10-07'));
chk('dice la hora',          /10:00/.test(tx));
chk('dice en qué barco iba', /Sea Dragon/.test(tx));
chk('dice cuándo se archivó',tx.includes('Archived ' + elDia('2026-10-07')));
chk('y de qué cuenta salió', /from Pau Giménez's account/.test(tx), tx.slice(0,200));

// ─── El local sólo cuando se están viendo todos ───
chk('con un solo local elegido NO repite el nombre del local',
    !/Blue water/.test(tx), 'el filtro ya dice cuál es');
window.__t.dibujar(unaFila,true);
chk('viendo todos los locales SÍ dice de cuál es',
    /Blue water/.test(texto()));

// ─── No se inventa quién ───
// Un tripulante dado de baja no está en la caché de activos. Mismo criterio que
// la autoría de un tilde: antes que un autor inventado, ninguno.
window.__t.tripulacion([]);
window.__t.dibujar(unaFila,false);
tx=texto();
chk('sin poder resolver el nombre sigue diciendo cuándo se archivó',
    tx.includes('Archived ' + elDia('2026-10-07')), tx.slice(0,140));
chk('y NO deja un «desde la cuenta de» colgando sin nombre',
    !/account/.test(tx), tx.slice(0,160));
chk('la resolución del uuid es la misma función que la autoría de un tilde',
    /const quien = nombreDeTripulante\(tr\.archived_by\);/.test(html),
    'no una segunda forma de traducir un uuid a un nombre');

// ─── Una salida sin nombre propio no queda en blanco ───
window.__t.dibujar([{id:'t2',trip_date:'2026-09-30',trip_time:null,
  trip_name:null,trip_type:'Sunset Cruise',archived_at:null,archived_by:null,
  boats:null,locations:null}],false);
tx=texto();
chk('sin trip_name cae al tipo de salida', /Sunset Cruise/.test(tx), tx.slice(0,120));
window.__t.dibujar([{id:'t3',trip_date:'2026-09-30',trip_name:null,trip_type:null,
  archived_at:null,archived_by:null}],false);
chk('y sin ninguno de los dos pone una etiqueta genérica, no un hueco',
    /Trip/.test(texto()), texto().slice(0,120));
chk('sin fecha de archivado no deja la etiqueta «Archived» colgando sola',
    !/Archived/.test(texto()), texto().slice(0,120));

// ─── Escapado ───
window.__t.dibujar([{id:'t4',trip_date:'2026-10-01',
  trip_name:'<img src=x onerror=alert(1)>Charter',trip_type:null,
  archived_at:'2026-10-02T09:00:00Z',archived_by:null,
  boats:{name:'<b>Boat</b>'}}],false);
chk('el nombre de la salida va escapado',
    lista().querySelectorAll('img').length===0, 'ninguna etiqueta inyectada');
chk('y el del barco también',
    lista().querySelectorAll('b').length===0);

// ─── El rango es por trip_date, y es la decisión que importa ───
// Con `archived_at` la tarjeta contestaría «qué quité esta semana». La pregunta
// del dueño es «el martes 7 no está, qué pasó», así que el rango tiene que
// significar lo mismo acá que en las otras tarjetas de la página.
chk('la consulta filtra el rango por trip_date',
    /\.eq\('org_id', currentOrgId\)\.gte\('trip_date', startDate\)\.lte\('trip_date', endDate\)/.test(html) &&
    !/gte\('archived_at'/.test(html),
    'no por archived_at');
chk('y la decisión está explicada donde se toma',
    /Las archivadas se piden por `trip_date`, no por `archived_at`/.test(html));
chk('pide las columnas que la fila muestra, sin incrustar trips(…) de más',
    /tripsArchivadas\('id, trip_date, trip_time, trip_name, trip_type, archived_at, archived_by, boats\(name\), locations\(name\)'\)/.test(html));
chk('ordena de la más reciente a la más vieja',
    /\.order\('trip_date', \{ ascending: false \}\)\.order\('trip_time', \{ ascending: false \}\)/.test(html));
chk('se dibuja en los dos modos de la página, no sólo en uno',
    /renderArchivedTrips\(archived, isAllShops\);/.test(html) &&
    !/else \{\s*\n\s*renderArchivedTrips/.test(html),
    'fuera del if de un solo local');

// ─── No hay desarchivar, y es a propósito ───
chk('la tarjeta es de sólo lectura: ningún botón',
    lista().querySelectorAll('button').length===0 &&
    !/desarchivar|unarchive/i.test(html.slice(html.indexOf('function renderArchivedTrips'),
                                              html.indexOf('function renderArchivedTrips')+2600)),
    'devolver una salida al calendario todavía no está decidido');
chk('y el porqué está escrito al lado',
    /No hay botón de\s*\n\/\/ desarchivar/.test(html));

// ─── Los textos existen en los dos idiomas ───
const claves=['rep_archived_trips','rep_archived_trips_desc','rep_archived_none',
              'rep_archived_untitled','rep_archived_meta','rep_archived_meta_by'];
const faltan=claves.filter(k=>(html.match(new RegExp('\\b'+k+':','g'))||[]).length<2);
chk('cada texto nuevo está en inglés y en español', faltan.length===0,
    faltan.join(', ')||'las 6 en ambos');
chk('los dos textos de «cuándo se archivó» usan marcadores, no concatenación',
    /rep_archived_meta: 'Archived \{date\}'/.test(html) &&
    /rep_archived_meta_by: 'Archived \{date\} — from \{name\}/.test(html));

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
process.exit(fail);
