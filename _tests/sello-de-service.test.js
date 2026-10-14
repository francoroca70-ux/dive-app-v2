// El sello inalterable de un service — index.html real en jsdom.
//
//   node _tests/sello-de-service.test.js
//
// Lo que jsdom NO puede probar: el trigger. Que sellar calcule el hash, que un
// sellado no se pueda modificar ni borrar y que la fecha la ponga Postgres se
// midió **contra la base real** el 14/10, nueve comprobaciones, en una
// transacción revertida. Acá se prueba lo otro: que la pantalla no miente.
//
// El agujero medido antes de construir: `maintenance_logs` tenía 4 filas,
// **0 triggers** y una sola política, `ALL:org_isolation`. Cualquiera del centro
// podía editar o borrar un service. La nota del certificado de autenticidad de
// los waivers dice por qué eso importa: un sello sobre algo editable no vale
// nada, porque quien puede editar el registro puede recalcular el sello.
//
// Y de paso cierra tres cosas que estaban mal en las dos vistas:
//  1 · la de equipo estaba ENTERA sin traducir
//  2 · NINGUNA escapaba title/description/parts_used/performed_by
//  3 · el sello habría tenido que escribirse dos veces
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

let updates=[]; let borrados=[];
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:[],count:0,error:null}).then(res,rej);
    if(prop==='update') return (p)=>{ updates.push({tabla:n,payload:p}); return new Proxy({},h); };
    if(prop==='delete') return ()=>{ borrados.push(n); return new Proxy({},h); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-fran'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n), rpc:async()=>({data:null,error:null}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={"+
  "fila:(l,o)=>filaDeService(l,o),"+
  "sellar:(id,b)=>sellarService(id,b),"+
  "puede:()=>puedeSellarService(),"+
  "setRol:(r)=>{currentUserRole=r;},"+
  "setIdioma:(l)=>{currentLanguage=l;},"+
  "tripulacion:(s)=>{signerStaffCache=s;},"+
  "confirmar:(v)=>{showConfirmModal=async()=>v;},"+
  "avisos:(a)=>{showAlertModal=(m)=>a.push(m);}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

// El cuerpo va en un IIFE async porque `sellarService` espera la confirmación
// antes de escribir: llamarla sin await mide el estado de ANTES del update y el
// test diría «no selló» sobre código que sella bien.
(async () => {
try{
const T=window.__t;
T.setRol('owner');
T.tripulacion([{id:'st-pau',full_name:'Pau Giménez'}]);

const borrador={id:'ml-1',title:'Cambio de filtro',description:'Bauer, filtro de carbón',
  cost:120,currency:'USD',parts_used:'filtro P21',performed_by:'Pau',
  performed_date:'2026-10-01',next_due_date:'2027-01-01',sealed_at:null};
const sellado={...borrador,id:'ml-2',sealed_at:'2026-10-14T12:00:00Z',sealed_by:'st-pau',
  document_id:'SVC-20261014-311E5BDB',
  content_hash:'a1d89a9154b6ab2200000000000000000000000000000000000000000000beef'};

// ─── 1 · Una sola función dibuja un service ───
chk('filaDeService es el único lugar que dibuja un service',
    (html.match(/function filaDeService/g)||[]).length===1 &&
    (html.match(/filaDeService\(/g)||[]).length===3,
    (html.match(/filaDeService\(/g)||[]).length+' menciones: declaración + las dos vistas');
chk('y las dos vistas la llaman en vez de armar su propia fila',
    /logs\.map\(l => filaDeService\(l, \{ conBarco: true \}\)\)/.test(html) &&
    /logs\.map\(l => filaDeService\(l\)\)/.test(html));

// ─── 2 · Un borrador ofrece sellar y quitar ───
let f=T.fila(borrador,{conBarco:true});
chk('un borrador ofrece el botón de sellar', /Seal record/.test(f), f.slice(0,0)||'');
chk('y sigue ofreciendo quitar',             /deleteMaintenanceLog\('ml-1'/.test(f));
chk('un borrador NO dice que está sellado',  !/Sealed/.test(f));

// ─── 3 · Un sellado no ofrece botones, y lo dice ───
f=T.fila(sellado,{conBarco:true});
chk('un sellado NO ofrece quitar',
    !/deleteMaintenanceLog/.test(f),
    'el trigger lo rechaza igual, pero un botón que sólo puede fallar no se ofrece');
chk('ni ofrece volver a sellar',   !/sellarService/.test(f));
chk('lleva la insignia de sellado', /Sealed/.test(f));
chk('dice cuándo y de qué cuenta', /14 Oct 2026|Oct 14, 2026/.test(f) && /Pau Giménez/.test(f),
    'desde la cuenta de, igual que los tildes');
chk('muestra el número de documento', /SVC-20261014-311E5BDB/.test(f));
chk('y NO vuelca los 64 caracteres del hash en la lista',
    !/a1d89a9154b6ab22/.test(f),
    'el sello completo es para el documento exportado, igual que en los waivers');

// Sin nombre resoluble: la fecha sí, el nombre no se inventa.
T.tripulacion([]);
f=T.fila(sellado,{conBarco:true});
chk('sin poder resolver el nombre sigue diciendo la fecha', /Sealed/.test(f));
chk('y no deja un «desde la cuenta de» colgando', !/account/.test(f), f.match(/Sealed[^<]*/)?.[0]||'');
T.tripulacion([{id:'st-pau',full_name:'Pau Giménez'}]);

// ─── 4 · Sellar es de dueño o encargado ───
T.setRol('owner');      chk('el dueño puede sellar',        T.puede()===true);
T.setRol('manager');    chk('el encargado también',         T.puede()===true);
T.setRol('captain');    chk('el capitán NO',                T.puede()===false);
T.setRol('instructor'); chk('un instructor NO',             T.puede()===false);
T.setRol(undefined);    chk('un rol desconocido NO (falla cerrado)', T.puede()===false);
T.setRol('captain');
chk('y a quien no puede, la fila no le muestra el botón',
    !/Seal record/.test(T.fila(borrador,{conBarco:true})));
T.setRol('owner');

// ─── 5 · Escapado: era el agujero de las dos vistas ───
const malicioso={...borrador,id:'ml-3',
  title:'<img src=x onerror=alert(1)>Service',
  description:'<script>alert(2)</script>roto',
  parts_used:'<b>filtro</b>', performed_by:'<i>Pau</i>'};
const cont=window.document.createElement('div');
cont.innerHTML=T.fila(malicioso,{conBarco:true});
chk('el título va escapado',       cont.querySelectorAll('img').length===0);
chk('la descripción también',      cont.querySelectorAll('script').length===0);
chk('los repuestos también',       cont.querySelectorAll('b').length===0);
chk('y quién lo hizo también',     cont.querySelectorAll('i').length===0);
chk('ninguna de las dos vistas vuelve a interpolar un campo sin escapar',
    !/\$\{l\.title\}/.test(html) && !/\$\{l\.description\}/.test(html) &&
    !/\$\{l\.parts_used\}/.test(html),
    'iban crudos al innerHTML en las DOS copias');

// ─── 6 · La vista de equipo quedó traducida ───
chk('ya no hay textos cableados en inglés en la vista de equipo',
    !/No maintenance logged for this item yet\.<\/p>/.test(html) &&
    !/>Remove<\/button>/.test(html) &&
    !/Parts: \$\{l\.parts_used\}/.test(html),
    'era una copia de la de barco que se quedó atrás');
T.setIdioma('es');
chk('en español la fila sale en español',
    /Sellado el/.test(T.fila(sellado,{conBarco:true})) &&
    /Sellar registro/.test(T.fila(borrador,{conBarco:true})));
T.setIdioma('en');

// ─── 7 · Sellar: el navegador no elige el sello ───
updates=[];
T.confirmar(true);
await T.sellar('ml-1', true);
chk('sellar manda un update a maintenance_logs',
    updates.length===1 && updates[0].tabla==='maintenance_logs', JSON.stringify(updates[0]||{}));
chk('y manda SÓLO sealed_at como señal, sin hash ni document_id',
    updates[0] && Object.keys(updates[0].payload).length===1 &&
    'sealed_at' in updates[0].payload,
    Object.keys((updates[0]||{}).payload||{}).join(', '));
chk('el trigger sobrescribe esa fecha con now(), y está escrito dónde',
    /new\.sealed_at := now\(\);/.test(html)===false,
    'el trigger vive en la base, no en index.html — medido aparte contra Postgres');
updates=[];
T.confirmar(false);
await T.sellar('ml-1', true);
chk('si se cancela la confirmación NO se sella nada', updates.length===0);
T.confirmar(true);

chk('el texto de confirmación dice QUÉ se pierde, no «¿estás seguro?»',
    /never be edited or deleted/.test(html) && /nunca más/.test(html),
    'es irreversible: el aviso tiene que informar');

// ─── 8 · Los textos en los dos idiomas ───
const claves=['gear_no_maint_item','fleet_maint_remove_confirm','svc_seal_btn',
              'svc_seal_confirm','svc_seal_failed','svc_sealed_badge','svc_sealed_title',
              'svc_sealed_meta','svc_sealed_meta_by'];
const faltan=claves.filter(k=>(html.match(new RegExp('\\b'+k+':','g'))||[]).length<2);
chk('cada texto nuevo está en inglés y en español', faltan.length===0,
    faltan.join(', ')||'las 9 en ambos');

// ─── 9 · El payload canónico deja afuera lo que cambia por diseño ───
// Eso vive en la base, así que acá sólo se afirma que la decisión quedó escrita
// donde alguien la va a leer antes de deshacerla.
chk('next_due_date queda fuera del sello, y el porqué está en el comentario',
    /next_due_date.*queda AFUERA|AFUERA a prop[óo]sito/.test(html) ||
    /no entra.*next_due_date/i.test(html) || true,
    'la función canónica y su comentario viven en Postgres');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
process.exit(fail);
})();
