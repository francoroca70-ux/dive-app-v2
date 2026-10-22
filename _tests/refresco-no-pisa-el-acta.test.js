// El refresco de diez segundos no pisa el acta — index.html real en jsdom.
//
//   node _tests/run-all.js      (preferido)
//
// Medido en producción el 22/10, con el build desplegado: se firma una rutina,
// la pantalla muestra el acta, y **a los diez segundos el acta desaparece y
// vuelve la lista viva, tildable, en blanco** — con la insignia todavía
// diciendo `SIGNED 2/16`.
//
//   | | ítems de acta | ítems vivos |
//   | recién dibujado | 16 | 0 |
//   | 12 segundos después | 0 | 16 |
//
// La causa: `refrescarProgresoVisible()` redibujaba los ítems con
// `renderCheckItems()` en el MISMO contenedor donde `mostrarActaSiHay()` dibuja
// el acta. Y pasaba en **cada firma**, sin necesidad de Reset — a diferencia del
// bug de ayer, que necesitaba Reset y nadie lo había usado en producción.
//
// Dos caminos y no tres, que es una corrección a lo que yo mismo reporté: las
// checklists propias ya pasan por `renderCustomChecklistsForCurrentView()`, su
// render completo, que consulta el acta desde el 11/10.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const {lineasDeCodigoCon}=require('./contar');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

let actaEnLaBase=null, errorAlConsultar=null, consultas=0;
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>{
      if(n==='checklist_completions') consultas++;
      return Promise.resolve({
        data: (n==='checklist_completions' && actaEnLaBase) ? [actaEnLaBase] : [],
        error: (n==='checklist_completions') ? errorAlConsultar : null
      }).then(res,rej);
    };
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

let pass=0, fail=0;
function chk(n, ok, x){ if(ok){pass++;console.log('PASS  '+n);} else {fail++;console.log('FAIL  '+n+(x?'  '+x:''));} }

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  setOrg:(id)=>{currentOrgId=id;}, offline:(v)=>{isOffline=v;},
  abiertas:()=>pasadasAbiertas,
  decidir:(x)=>queHaceElRefresco(x),
  muestraActa:(c)=>pantallaMuestraActa(c)
};`;
let boot=null; try{ window.eval(hook); }catch(e){ boot=e; }
chk('arranca sin excepción', !boot, boot?String(boot&&boot.stack||boot).slice(0,300):'');

(async () => {
try {
  if (boot) throw boot;
  const T=window.__t;
  const d=window.document;
  T.setOrg('org-1'); T.offline(false);

  // Un contenedor de prueba, para no depender de qué pantalla está armada.
  const cont=d.createElement('div'); cont.id='cont-de-prueba'; d.body.appendChild(cont);
  const conActa    = () => { cont.innerHTML = '<div class="cl-item acta">Tanques</div>'; };
  const conListaViva= () => { cont.innerHTML = '<div class="cl-item">Tanques</div>'; };
  const vacio      = () => { cont.innerHTML = ''; };

  const inst={ role:'captain', periodo:{start:'2026-10-22T00:00:00Z', end:'2026-10-22T23:59:59Z'} };
  const pedir=(scopeKey)=>T.decidir({ containerId:'cont-de-prueba', scopeKey, instancia:inst });

  // ─── 1 · Leer la pantalla es mirar el DOM ────────────────────────────────
  conActa();     chk('reconoce un acta en pantalla', T.muestraActa('cont-de-prueba')===true);
  conListaViva();chk('y una lista viva no es un acta', T.muestraActa('cont-de-prueba')===false);
  vacio();       chk('un contenedor vacío tampoco', T.muestraActa('cont-de-prueba')===false);
  chk('y un contenedor que no existe no explota', T.muestraActa('no-existe')===false);

  // ─── 2 · Las cuatro respuestas ───────────────────────────────────────────
  //
  // El par que prueba que el arreglo CAMBIA algo: con el acta en la base y la
  // lista viva en pantalla, antes se parchaban los tildes —pisándola— y ahora
  // se pide el render completo.
  actaEnLaBase={ signed_by:'Franco', signed_at:'2026-10-22T16:00:00Z',
                 completed_items:2, total_items:16, items_snapshot:[] };
  conListaViva();
  chk('hay acta y la pantalla NO la muestra → render completo',
      (await pedir(null))==='render',
      'esto es lo que antes pisaba el acta con la lista viva');

  conActa();
  chk('hay acta y ya está en pantalla → no hacer nada',
      (await pedir(null))==='nada',
      'no hay tildes que traer: al firmar el progreso se borra');

  actaEnLaBase=null;
  conListaViva();
  chk('no hay acta → parchar los tildes, como siempre',
      (await pedir(null))==='tildes');

  // ─── 3 · Una pantalla firmada no gasta consultas ─────────────────────────
  //
  // Sale más barato que antes del arreglo: antes hacía una consulta de progreso
  // cada diez segundos sobre una instancia que ya no tiene progreso.
  actaEnLaBase={ signed_by:'Franco', signed_at:'2026-10-22T16:00:00Z',
                 completed_items:2, total_items:16, items_snapshot:[] };
  conActa(); consultas=0;
  await pedir(null);
  chk('con el acta a la vista no consulta nada', consultas===0, consultas+' consultas');

  conListaViva(); consultas=0;
  await pedir(null);
  chk('y sin el acta a la vista sí pregunta', consultas>0, consultas+' consultas');

  // ─── 4 · Reset gana: una pasada abierta muestra la lista viva ────────────
  //
  // Sin esta excepción el refresco le taparía la segunda pasada con el acta
  // vieja — el mismo error que casi se cometió con el guardián de firmar, que
  // habría pasado de proteger a bloquear.
  T.abiertas().add('k-reset');
  conListaViva();
  chk('con pasada abierta se parchan los tildes aunque haya acta',
      (await pedir('k-reset'))==='tildes');
  T.abiertas().delete('k-reset');
  chk('y cerrada la pasada, vuelve a pedir el render',
      (await pedir('k-reset'))==='render');

  // ─── 5 · Si no se puede medir, no se esconde un acta ────────────────────
  //
  // Misma regla que el aviso de listas que faltan: sin medición no se afirma.
  // Acá la dirección segura es parchar los tildes, que es lo que hacía antes.
  errorAlConsultar={ message:'network' };
  conListaViva();
  chk('si la consulta falla, se parchan los tildes y no se oculta nada',
      (await pedir(null))==='tildes');
  errorAlConsultar=null;

  // ─── 6 · Guardianes estructurales ───────────────────────────────────────
  chk('la decisión vive en una sola función',
      (html.match(/async function queHaceElRefresco/g)||[]).length===1);
  chk('y la usan los DOS caminos que parchaban ítems directo',
      lineasDeCodigoCon(html,'queHaceElRefresco(').length===3,
      'la declaración más la salida y el departamento');

  // El guardián que importa: que ningún camino vuelva a parchar ítems sin
  // preguntar. Si mañana aparece un tercero, esto falla.
  const cuerpo = html.slice(html.indexOf('async function refrescarProgresoVisible'),
                            html.indexOf('function refrescarChecklistVisible'));
  const parches = (cuerpo.match(/renderCheckItems\(/g)||[]).length;
  chk('en el refresco hay exactamente dos parches de ítems', parches===2,
      parches+' llamadas a renderCheckItems');
  for (const a of ["accion === 'render'", "accion === 'tildes'"]) {
    chk('el refresco distingue ' + a, cuerpo.includes(a));
  }
  chk('y los dos parches están detrás de la decisión',
      (cuerpo.match(/accion === 'tildes'/g)||[]).length===2,
      'uno por camino');

  // Las propias quedan afuera a propósito, y su render completo sigue ahí.
  chk('las checklists propias siguen pasando por su render completo',
      /renderCustomChecklistsForCurrentView\(\);/.test(cuerpo));
  chk('y se refrescan pase lo que pase con la rutina de departamento',
      cuerpo.lastIndexOf('renderCustomChecklistsForCurrentView();')
        > cuerpo.lastIndexOf("accion === 'tildes'"),
      'van después del if, no adentro');

  // ─── 7 · La documentación de la función dice la verdad ──────────────────
  //
  // Lo que se afirma es lo POSITIVO: que el comentario avisa que esto puede
  // tocar el acta. La primera versión de este test buscaba además que la frase
  // vieja —«No toca el acta»— ya no apareciera, y falló: aparece, dentro del
  // comentario nuevo que **cita** la frase vieja para explicar el postmortem.
  //
  // Se saca en vez de afinarse, porque una búsqueda de texto no puede
  // distinguir una cita de una afirmación. Octava vez que contar menciones se
  // equivoca, y un chequeo que falla con el código sano se termina
  // desactivando, que es peor que no tenerlo.
  chk('el comentario avisa que el refresco SÍ puede tocar el acta',
      /esto SÍ puede tocar el acta/.test(html));
  chk('y explica por qué tiene que poder',
      /si Juanma firma en su\n\/\/ celular, esta pantalla se entere/.test(html)
      || /se entere/.test(html));

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }

console.log('\n'+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
})();
