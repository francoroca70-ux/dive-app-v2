// A5: el hueco de la siembra por categoría — index.html real en jsdom.
//
//   node _tests/listas-que-faltan.test.js
//
// El agujero, medido contra la base el 14/10: las plantillas se siembran al
// **activar** una categoría, pero un centro puede crear salidas de una categoría
// que nunca activó. *Blue water* tiene `diving` **sin activar**, 7 tipos de
// buceo, **los 7 sin plantilla**, y **8 salidas ya creadas** con esos tipos.
//
// Lo que ve el instructor en el barco es la **lista cableada genérica**, que es
// peor que un error: parece correcta y no es la del centro. Y el centro no tenía
// forma de enterarse — la etapa 4 le dio la salida, escondida dentro de un panel
// que hay que abrir tipo por tipo.
//
// Lo que NO hace, y es la decisión que importa: **no activa la categoría**.
// `seedTripTypesForCategory()` inserta TIPOS DE SALIDA nuevos además de marcar
// la categoría, así que a un centro con sus propios tipos le duplicaría la
// lista. Copiar las semillas tipo por tipo es el camino seguro y ya probado.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// Fuente de verdad del stub: qué plantillas y qué semillas existen.
let conPlantilla=new Set(); let conSemilla=new Set(); let inserts=[];
let errorPlantillas=null; let errorEnInsert=null;
function tabla(n){
  const ctx={tabla:n, filtros:{}};
  const h={
    get(t,prop){
      if(prop==='then') return (res,rej)=>Promise.resolve(resolver(ctx)).then(res,rej);
      if(prop==='insert') return (p)=>{ inserts.push({tabla:n,payload:p});
        return new Proxy({},{get(t2,p2){
          if(p2==='then') return (res,rej)=>Promise.resolve(
            errorEnInsert ? {data:null,error:errorEnInsert}
                          : {data:{id:'tpl-'+inserts.length},error:null}).then(res,rej);
          return ()=>new Proxy({},{get(t3,p3){
            if(p3==='then') return (res,rej)=>Promise.resolve(
              errorEnInsert ? {data:null,error:errorEnInsert}
                            : {data:{id:'tpl-'+inserts.length},error:null}).then(res,rej);
            return ()=>new Proxy({},this);
          }});
        }});
      };
      return (...args)=>{
        if(prop==='eq') ctx.filtros[args[0]]=args[1];
        if(prop==='in') ctx.filtros['__in_'+args[0]]=args[1];
        return new Proxy({},h);
      };
    }
  };
  return new Proxy({},h);
}
function resolver(ctx){
  if(ctx.tabla==='checklist_templates'){
    if(errorPlantillas) return {data:null,error:errorPlantillas};
    const ids=ctx.filtros['__in_trip_type_id']||[];
    return {data:ids.filter(i=>conPlantilla.has(i)).map(i=>({trip_type_id:i})),error:null};
  }
  if(ctx.tabla==='checklist_seeds'){
    const nombre=ctx.filtros['trip_type_name'];
    if(!conSemilla.has(nombre)) return {data:[],error:null};
    return {data:[{id:'s1',order_index:0,text_en:'Tanks',text_es:'Tanques'}],error:null};
  }
  return {data:[],count:0,error:null};
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
  "setOrg:(id)=>{currentOrgId=id;},setRol:(r)=>{currentUserRole=r;},"+
  "tipos:(ts)=>{window._settingsTripTypes=ts;},"+
  "faltan:(ts)=>tiposSinListaDePreparacion(ts),"+
  "aviso:(ts)=>pintarAvisoDeListasQueFaltan(ts),"+
  "armar:()=>armarListasQueFaltan(),"+
  // `hayRedDeVerdad` manda un HEAD al propio origen y en jsdom no hay red, así
  // que sin stub TODO error se clasifica como «sin conexión» — que es el
  // comportamiento correcto de la app y la respuesta equivocada para el test.
  "red:(v)=>{hayRedDeVerdad=async()=>v;},"+
  "confirmar:(v)=>{showConfirmModal=async()=>v;},"+
  "avisos:(a)=>{showAlertModal=async(m)=>{a.push(m);};},"+
  "redibujo:()=>{renderTripTypesList=async()=>{};}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

(async () => {
try{
const T=window.__t;
T.setOrg('org-1'); T.setRol('owner'); T.redibujo(); T.red(true);
const el=()=>doc.getElementById('trip-types-missing-prep');
const texto=()=>(el().textContent||'').replace(/\s+/g,' ').trim();

// El caso real de Blue water: 7 de buceo sin plantilla, 10 con.
const buceo=Array.from({length:7},(_,i)=>({id:'d'+i,name:'1 Dive',category:'diving'}));
const otros=Array.from({length:10},(_,i)=>({id:'o'+i,name:'Island Hopping',category:'charter_yacht'}));
const todos=[...buceo,...otros];
conPlantilla=new Set(otros.map(o=>o.id));
conSemilla=new Set(['1 Dive','Island Hopping']);
T.tipos(todos);

// ─── 1 · Detectar ───
let faltan=await T.faltan(todos);
chk('detecta exactamente los tipos sin plantilla',
    faltan.length===7 && faltan.every(f=>f.category==='diving'),
    faltan.length+' tipos');
chk('y no cuenta los que sí la tienen', !faltan.some(f=>conPlantilla.has(f.id)));

// ─── 2 · El aviso dice el número y QUÉ pasa en el barco ───
await T.aviso(todos);
chk('el aviso aparece',            el().style.display==='block');
chk('dice cuántos faltan',         /7 trip types/.test(texto()), texto().slice(0,70));
chk('explica qué se ve en el barco', /generic list/.test(texto()),
    'una lista genérica que parece correcta — eso es lo que hay que decir');
chk('y ofrece armar las 7',        /Set up the 7 missing lists/.test(texto()));

// ─── 3 · Lo que no tiene semilla se cuenta aparte ───
conSemilla=new Set(['Island Hopping']);   // los de buceo ya no tienen semilla
await T.aviso(todos);
chk('sin semilla no se ofrece un botón que no puede hacer nada',
    !/Set up the/.test(texto()), texto().slice(0,80));
chk('y se dice que ésos van a mano',
    /7 of them have no standard list/.test(texto()), texto().slice(0,110));
conSemilla=new Set(['1 Dive','Island Hopping']);

// ─── 4 · Sin nada que avisar, no hay aviso ───
conPlantilla=new Set(todos.map(x=>x.id));
await T.aviso(todos);
chk('con todas las listas armadas el aviso no aparece',
    el().style.display==='none' && texto()==='');
conPlantilla=new Set(otros.map(o=>o.id));

// ─── 5 · Sólo lo ve quien puede arreglarlo ───
for (const rol of ['captain','instructor','deckhand',undefined]) {
  T.setRol(rol);
  await T.aviso(todos);
  chk('un '+(rol||'rol desconocido')+' NO ve el aviso',
      el().style.display==='none',
      'no puede tocar plantillas: sería ruido sobre algo ajeno');
}
T.setRol('manager');
await T.aviso(todos);
chk('el encargado SÍ lo ve', el().style.display==='block');
T.setRol('owner');

// ─── 6 · Si no se puede medir, no se inventa un diagnóstico ───
errorPlantillas={code:'42501',message:'permission denied'};
faltan=await T.faltan(todos);
chk('si la consulta falla NO se afirma que faltan listas',
    faltan.length===0,
    'avisar «te faltan 7» sin poder medirlo podría ser falso');
await T.aviso(todos);
chk('y el aviso no se dibuja', el().style.display==='none');
errorPlantillas=null;

// ─── 7 · Armar en bloque ───
await T.aviso(todos);
inserts=[]; const dichos=[]; T.avisos(dichos); T.confirmar(true);
await T.armar();
const plantillasCreadas=inserts.filter(i=>i.tabla==='checklist_templates').length;
const itemsCreados=inserts.filter(i=>i.tabla==='checklist_template_items').length;
chk('crea una plantilla por tipo que faltaba',
    plantillasCreadas===7, plantillasCreadas+' plantillas');
chk('y le copia los ítems a cada una', itemsCreados===7, itemsCreados+' inserts de ítems');
chk('informa cuántas quedaron hechas',
    dichos.length===1 && /7 prep lists created/.test(dichos[0]), dichos[0]||'(nada)');

// Cancelar no escribe nada.
inserts=[]; T.confirmar(false);
await T.armar();
chk('si se cancela la confirmación no se escribe nada', inserts.length===0);
T.confirmar(true);

// ─── 8 · Si se corta a mitad, se dice cuántas entraron ───
inserts=[]; const dichos2=[]; T.avisos(dichos2);
errorEnInsert={code:'42501',message:'permission denied'};
await T.armar();
chk('un fallo no se reporta como éxito',
    dichos2.length===1 && /and then it stopped/.test(dichos2[0]), dichos2[0]||'(nada)');
chk('y el cartel dice el motivo real, no «revisá la conexión»',
    !/connection/i.test(dichos2[0]||''), dichos2[0]||'');
// El hallazgo del 14/10: la función se renombró el 11/10 y sus textos siguieron
// diciendo «borrar». Un 42501 al GUARDAR decía «no tenés permiso para borrar
// esto», y sin red «no se borró nada».
chk('un fallo al guardar NO habla de borrar',
    !/delete|deleted|borrar|borró/i.test(dichos2[0]||''),
    dichos2[0]||'');
errorEnInsert=null;

// Sin red el motivo es el de escritura, no el de borrado.
T.red(false);
const dichos3=[]; T.avisos(dichos3); errorEnInsert={message:'network'};
await T.armar();
chk('sin conexión dice que no se GUARDÓ nada, no que no se borró',
    /nothing was saved/.test(dichos3[0]||''), dichos3[0]||'(nada)');
errorEnInsert=null; T.red(true);

// ─── 9 · NO activa la categoría ───
chk('no toca org_operation_categories en ningún momento',
    !inserts.some(i=>i.tabla==='org_operation_categories'),
    'activar la categoría insertaría tipos de salida nuevos y duplicaría la lista del centro');
chk('y la decisión está escrita donde alguien la va a leer antes de deshacerla',
    /Esto NO activa la categoría, y es deliberado/.test(html));
chk('la copia en sí vive en UN lugar, usado por el botón de uno y por el de todos',
    (html.match(/async function copiarListaEstandar/g)||[]).length===1 &&
    (html.match(/copiarListaEstandar\(/g)||[]).length===3,
    (html.match(/copiarListaEstandar\(/g)||[]).length+' menciones');
chk('y tira la caché local de la plantilla que acaba de crear',
    /cacheLocalBorrar\(nombreEnCacheDePlantilla\(tripTypeId\)\);/.test(html),
    'si no, el barco seguiría viendo la copia vieja');

// ─── 10 · i18n ───
const claves=['prep_missing_title','prep_missing_desc','prep_missing_fix',
              'prep_missing_no_seed','prep_missing_confirm','prep_missing_done',
              'prep_missing_partial'];
const sinTraducir=claves.filter(k=>(html.match(new RegExp('\\b'+k+':','g'))||[]).length<2);
chk('cada texto nuevo está en inglés y en español', sinTraducir.length===0,
    sinTraducir.join(', ')||'las 7 en ambos');
chk('y ningún marcador queda sin reemplazar en pantalla',
    !/\{n\}|\{ok\}|\{why\}/.test(texto()), texto().slice(0,80));

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
process.exit(fail);
})();
