// A1-b2 · El centro edita los ítems de sus rutinas de departamento.
//
//   node _tests/run-all.js      (preferido)
//
// Lo pidió Fran el 24/10, después de apretar «Hacerla propia» dos veces y
// buscar dónde editar. No había dónde: la copia estaba construida y el editor
// no, y en mis mensajes yo mezclé DOS editores con nombres casi iguales —el de
// la lista de preparación de un tipo de salida, que existe desde la etapa 4, y
// el de los ítems de una rutina, que no existía—.
//
// Lo que este archivo cuida es la generalización: el editor de la etapa 4 iba
// por `tripTypeId` de punta a punta, y copiarlo para las rutinas habría sido
// catorce lugares nuevos donde puede estar mal. Ahora las ocho funciones reciben
// un DESTINO y hay un solo lugar que lo traduce a consulta, caché e id de panel.
//
// Y lo que exige la regla 8: el cambio va detrás de un interruptor apagado, con
// un test en CADA posición que afirme que cambiarlo cambia algo. La etapa 3a
// tuvo tres días un interruptor que no cambiaba nada con la suite en verde.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const {lineasDeCodigoCon}=require('./contar');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// Lo que pide la base, anotado por cada consulta, para poder afirmar por qué
// columnas filtró cada destino.
let filtros=[];
let plantilla=null;
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({
      data: (n==='checklist_templates' && plantilla) ? [plantilla] : [], error:null }).then(res,rej);
    if(prop==='eq') return (col,val)=>{ filtros.push(col+'='+val); return new Proxy({},h); };
    if(prop==='insert'||prop==='update'||prop==='delete') return ()=>new Proxy({},h);
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
function chk(n, ok, x){ if(ok){pass++;console.log('PASS  '+n);} else {fail++;console.log('FAIL  '+n+(x?'  '+x:'')); } }

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  setOrg:(id)=>{currentOrgId=id;}, rol:(r)=>{currentUserRole=r;}, idioma:(l)=>{currentLanguage=l;},
  destTipo:(id)=>destinoDeTipo(id), destRutina:(a,b)=>destinoDeRutina(a,b),
  partes:(d)=>partesDelDestino(d), idPanel:(d)=>idDePanelDeEdicion(d),
  cache:(d)=>nombreEnCacheDelDestino(d),
  leer:(d)=>plantillaParaEditar(d),
  dibujar:(d)=>dibujarPanelDePreparacion(d),
  interruptor:(v)=>{ EDITOR_RUTINAS=v; }, verInterruptor:()=>EDITOR_RUTINAS,
  dibujarTarjeta:()=>dibujarRutinasDeDepartamento()
};`;
let boot=null; try{ window.eval(hook); }catch(e){ boot=e; }
chk('arranca sin excepción', !boot, boot?String(boot&&boot.stack||boot).slice(0,300):'');

(async () => {
try {
  if (boot) throw boot;
  const T=window.__t;
  const d=window.document;
  T.setOrg('org-1'); T.rol('owner'); T.idioma('en');

  const DEST_RUTINA = 'dept:captain:morning';
  const DEST_TIPO   = 'tt:tipo-1';

  // ─── 1 · El destino se arma y se desarma en un solo lugar ────────────────
  chk('el destino de una rutina lleva departamento y cadencia',
      T.destRutina('captain','morning')===DEST_RUTINA, T.destRutina('captain','morning'));
  chk('y el de un tipo de salida su id', T.destTipo('tipo-1')===DEST_TIPO);

  const pr=T.partes(DEST_RUTINA), pt=T.partes(DEST_TIPO);
  chk('se desarma una rutina', pr.clase==='dept' && pr.deptKey==='captain' && pr.cadencia==='morning',
      JSON.stringify(pr));
  chk('y un tipo de salida', pt.clase==='tt' && pt.tripTypeId==='tipo-1', JSON.stringify(pt));
  chk('un destino vacío no explota', T.partes('').clase==='tt' || T.partes('').clase==='dept');

  // Los dos puntos rompen un selector de CSS, así que el id del panel no los
  // lleva. `getElementById` no se entera; un selector sí.
  chk('el id del panel no lleva dos puntos', !T.idPanel(DEST_RUTINA).includes(':'),
      T.idPanel(DEST_RUTINA));
  chk('y es distinto para cada destino', T.idPanel(DEST_RUTINA)!==T.idPanel(DEST_TIPO));

  // ─── 2 · Cada destino borra SU caché, no la del otro ─────────────────────
  //
  // Son dos caminos de lectura distintos, cada uno con su nombre desde la 3a y
  // la A1-a. Si el editor borrara el equivocado, el centro editaría y en el
  // barco seguiría viendo la lista vieja.
  chk('la caché de una rutina es la de rutinas', /rutina_captain_morning/.test(T.cache(DEST_RUTINA)),
      T.cache(DEST_RUTINA));
  chk('y la de un tipo es la de plantillas', /plantilla_tipo_tipo-1/.test(T.cache(DEST_TIPO)),
      T.cache(DEST_TIPO));
  chk('y no son la misma', T.cache(DEST_RUTINA)!==T.cache(DEST_TIPO));

  // ─── 3 · La consulta filtra por las columnas que corresponden ───────────
  //
  // El CHECK `checklist_templates_scope_coherente` hace excluyentes las dos
  // ramas: un tipo de salida tiene `trip_type_id` y `department` nulo, una
  // rutina al revés. Si el editor filtrara mal, leería la plantilla de otro.
  plantilla = { id:'tpl-1', title:'Morning', checklist_template_items:[] };

  filtros=[]; await T.leer(DEST_RUTINA);
  chk('una rutina filtra por scope department', filtros.includes('scope=department'), filtros.join(' '));
  chk('y por departamento y cadencia',
      filtros.includes('department=captain') && filtros.includes('cadence=morning'), filtros.join(' '));
  chk('y NO por trip_type_id', !filtros.some(f=>f.startsWith('trip_type_id=')), filtros.join(' '));

  filtros=[]; await T.leer(DEST_TIPO);
  chk('un tipo de salida filtra por scope trip_type', filtros.includes('scope=trip_type'));
  chk('y por su trip_type_id', filtros.includes('trip_type_id=tipo-1'), filtros.join(' '));
  chk('y NO por departamento', !filtros.some(f=>f.startsWith('department=')), filtros.join(' '));

  // ─── 4 · EL INTERRUPTOR, en las dos posiciones ──────────────────────────
  //
  // Lo que controla es lo que se OFRECE. Con `false` la tarjeta no muestra el
  // botón de ítems ni dibuja el panel; el camino viejo —«Hacerla propia»— queda
  // igual en las dos posiciones.
  // El contenedor NO se crea: `#dept-routines-list` ya existe en el index.html
  // real, y crear otro con el mismo id hace que la función dibuje en el de
  // verdad y el test mida el suyo, vacío. **Cuarta vez con esta forma** — está
  // documentada en `editor-de-plantillas.test.js` y me la comí igual.
  const cont=d.getElementById('dept-routines-list');
  chk('la tarjeta de rutinas existe en el HTML', !!cont);

  T.interruptor(false);
  await T.dibujarTarjeta();
  const apagado = cont.innerHTML;
  chk('apagado: no se ofrece editar ítems', !/toggleEditorDeRutina/.test(apagado));
  chk('apagado: no se dibuja ningún panel de edición',
      !new RegExp(T.idPanel(DEST_RUTINA)).test(apagado));

  T.interruptor(true);
  await T.dibujarTarjeta();
  const prendido = cont.innerHTML;
  chk('prendido: aparece el panel de edición',
      new RegExp(T.idPanel(DEST_RUTINA)).test(prendido),
      'esto es lo que prueba que el interruptor cambia algo');

  // El camino viejo no se tocó en ninguna de las dos posiciones.
  chk('«Hacerla propia» sigue estando apagado y prendido',
      /arrancarRutinaPropia/.test(apagado) && /arrancarRutinaPropia/.test(prendido));
  T.interruptor(false);

  // ─── 5 · El interruptor se lee en UN lugar, y un test lo cuida ──────────
  const lectores = lineasDeCodigoCon(html, 'EDITOR_RUTINAS').length;
  chk('EDITOR_RUTINAS aparece exactamente tres veces en código', lectores===3,
      lectores+' líneas (la declaración y los dos lugares de la tarjeta)');
  // PRENDIDO el 28/10, decisión de Fran. Lo que el guardián afirma no cambió de
  // naturaleza: sigue afirmando que la posición es **explícita y declarada acá**,
  // porque el riesgo nunca fue el valor sino que el valor se moviera sin que
  // nadie lo decidiera. Prenderlo fue un acto de Fran y por eso el número de
  // este test se da vuelta a mano, igual que con `COPIA_LOCAL` el 26/10.
  //
  // Y lo que sigue apagado es el otro, que es el que mueve la llave de los
  // tildes: su guardián vive en `rutinas-de-departamento.test.js` y afirma
  // `'cableado'`. Son dos interruptores con dos guardianes a propósito.
  chk('la posición está declarada en un solo lugar, y hoy es PRENDIDO',
      /let EDITOR_RUTINAS = true;/.test(html),
      'moverla es decisión de Fran, no efecto de un commit');

  // ─── 6 · Una rutina sin copia no ofrece arrancar desde el editor ────────
  //
  // Su lista estándar vive en el código y la copia «Hacerla propia». Ofrecer un
  // segundo camino para lo mismo es donde empiezan a divergir.
  // El panel lo dibujó la tarjeta con el interruptor prendido, así que se usa
  // ÉSE y no uno nuevo — por lo mismo de arriba.
  T.interruptor(true);
  await T.dibujarTarjeta();
  const panel=d.getElementById(T.idPanel(DEST_RUTINA));
  chk('el panel que dibujó la tarjeta es el que se llena', !!panel);
  plantilla=null;
  await T.dibujar(DEST_RUTINA);
  chk('sin copia, el editor explica que primero hay que hacerla propia',
      !/arrancarDeLaListaEstandar|arrancarListaVacia/.test(panel.innerHTML),
      'esos dos arranques son sólo de tipos de salida');
  chk('y lo dice con un texto, no en blanco', panel.textContent.trim().length>20);

  // ─── 7 · Los textos nuevos, en los dos idiomas ─────────────────────────
  for (const k of ['rut_items','rut_none_yet_editor','prep_edit','prep_done','prep_view_desc']) {
    chk(k+' está en los dos idiomas', (html.match(new RegExp(k+':','g'))||[]).length===2,
        (html.match(new RegExp(k+':','g'))||[]).length+' definiciones');
  }
  // «Listo» y no «Guardar»: cada cambio se guarda en el momento, así que un
  // botón llamado Guardar afirmaría que hay trabajo sin guardar.
  chk('el botón dice Listo y no Guardar',
      /prep_done: 'Done'/.test(html) && /prep_done: 'Listo'/.test(html) &&
      !/prep_done: 'Save'/.test(html));

  // ─── 8 · La generalización: ninguna de las ocho sigue atada al tipo ────
  //
  // Afirma la regla, no un número: si una vuelve a recibir `tripTypeId`, falla.
  const porDestino = ['guardarTextoDeItem','agregarItemDePlantilla','retirarItemDePlantilla',
                      'devolverItemDePlantilla','moverItemDePlantilla','dibujarPanelDePreparacion',
                      'trasEditarPlantilla','plantillaParaEditar'];
  for (const f of porDestino) {
    const decl = html.match(new RegExp('(async )?function ' + f + '\\(([^)]*)\\)'));
    chk(f + ' recibe un destino', !!decl && /^destino/.test(decl[2].trim()),
        decl ? decl[2] : '(no se encontró la declaración)');
  }

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }

console.log('\n'+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
})();
