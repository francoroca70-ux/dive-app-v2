// A1-a · Las rutinas de departamento pueden salir de una plantilla del centro.
//
//   node _tests/rutinas-de-departamento.test.js
//
// Las rutinas del capitán, de cubierta, de instructores y de stewards están
// cableadas en `DEPARTMENT_ROUTINES_I18N` —4 departamentos × 4 cadencias, 102
// ítems— y **ningún centro puede tocarlas**. Un dueño que quiere corregir la
// rutina de la mañana de su capitán hoy no tiene cómo.
//
// Esto construye el camino de lectura al lado del cableado, **apagado en
// producción** (regla 8). Lo que este archivo tiene que asegurar es lo que la
// etapa 3a NO aseguró en su momento, y por eso tuvo tres días un interruptor
// que no cambiaba nada con la suite en verde:
//
//   1. que el interruptor esté en UN solo lugar
//   2. que **cambiarlo cambie el comportamiento** — probado en las dos
//      posiciones, no sólo en la de hoy
//   3. que una instancia abierta **no cambie de llave** a mitad del día
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');
const { lineasDeCodigoCon } = require('./contar');

const P = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(P, 'utf8');

let pass = 0, fail = 0;
function chk(n, ok, x) {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); }
}

// ─── 1 · El interruptor, en un solo lugar y apagado ─────────────────────────
//
// Exactamente dos: la declaración y el único lugar que lo mira. Una tercera y
// dejó de ser interruptor. Es el mismo guardián que cuida `FUENTE_PLANTILLAS`.
// **Líneas de código, no menciones.** La primera versión de este archivo contó
// menciones y falló con el código sano, porque un comentario nombraba el otro
// interruptor. Quinta vez que ese atajo se equivoca en este proyecto; por eso
// existe `contar.js`.
const lineasRut = lineasDeCodigoCon(html, 'FUENTE_RUTINAS_DEPTO');
chk('FUENTE_RUTINAS_DEPTO se lee en un solo lugar', lineasRut.length === 2,
    `${lineasRut.length} líneas: ${lineasRut.join(' | ').slice(0, 160)}`);
// PRENDIDO el 28/10, decisión de Fran, con el chequeo previo en cero filas. Lo
// que el guardián afirma no cambió de naturaleza: la posición es **explícita y
// declarada en un solo lugar**, porque el riesgo nunca fue el valor sino que el
// valor se moviera sin que nadie lo decidiera. Se da vuelta a mano, igual que
// con `COPIA_LOCAL` el 26/10 y `EDITOR_RUTINAS` esta mañana.
//
// Y lo que vale recordar al volver atrás: pasar a `'cableado'` **también** mueve
// la llave, así que el chequeo SQL se corre en las dos direcciones.
chk('la posición está declarada en un solo lugar, y hoy es BASE',
    /let FUENTE_RUTINAS_DEPTO = 'base';/.test(html),
    'moverla es decisión de Fran, y antes va el chequeo de instancias abiertas');
const lineasPl = lineasDeCodigoCon(html, 'FUENTE_PLANTILLAS');
chk('y el de las salidas sigue en uno', lineasPl.length === 2,
    `${lineasPl.length} líneas`);
chk('son dos interruptores distintos y no uno compartido',
    !lineasRut.some(l => l.includes('FUENTE_PLANTILLAS')));

// Las tres capas son UNA implementación con dos interruptores, no dos copias.
chk('las tres capas no se duplicaron',
    (html.match(/async function cargarConTresCapas/g) || []).length === 1);
chk('y cada camino le pasa su propio interruptor',
    /fuente: FUENTE_PLANTILLAS/.test(html) && /fuente: fuenteDeRutinas\(\)/.test(html));

// ─── 2 · Los seis lugares piden la lista por función ───────────────────────
//
// **Seis, y el sexto es el que importa.** Conté cinco al diseñar esto y el
// sexto apareció al medir: `refrescarChecklistVisible()`, el refresco de cada
// 10 segundos. Redibujar con la lista cableada mientras los tildes vienen de la
// plantilla haría que toda la tripulación viera sus tildes perdidos cada diez
// segundos. El camino de las salidas ya pedía su lista por función ahí; el de
// departamento era la copia que faltaba.
const usosCrudos = html.split('\n')
  .map((l, i) => ({ l: l.trim(), n: i + 1 }))
  .filter(x => x.l.includes('routine.items') && !x.l.startsWith('//'));
chk('nadie lee routine.items a mano', usosCrudos.length === 0,
    usosCrudos.map(x => 'línea ' + x.n).join(', '));
chk('deptScope() resuelve la lista una vez para todos',
    /items: itemsDeLaRutina\(\{ scopeKey, deptKey, cadence \}\)/.test(html));

// ─── 3 · Con la app corriendo: el interruptor cambia el comportamiento ─────
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/' });
const { window } = dom;

let plantilla = null;      // qué devuelve la consulta de checklist_templates
let consultas = 0;
function tabla(nombre) {
  const h = { get(t, p) {
    if (p === 'then') {
      return (res) => {
        if (nombre === 'checklist_templates') {
          consultas++;
          return Promise.resolve({ data: plantilla ? [plantilla] : [], error: null }).then(res);
        }
        return Promise.resolve({ data: [], error: null }).then(res);
      };
    }
    return () => new Proxy({}, h);
  } };
  return new Proxy({}, h);
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: null } }),
          getUser: async () => ({ data: { user: { id: 'u-fran' } } }),
          onAuthStateChange: () => ({ data: { subscription: {} } }) },
  from: (n) => tabla(n), functions: { invoke: async () => ({}) } }) };
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts.find(s => s.includes('[Seven Seas] build'));
const hook = main + `
;window.__t={
  org:(id)=>{currentOrgId=id;},
  idioma:(l)=>{currentLanguage=l;},
  interruptor:(v)=>{FUENTE_RUTINAS_DEPTO=v;},
  verInterruptor:()=>FUENTE_RUTINAS_DEPTO,
  instancias:()=>rutinaItemsPorInstancia,
  olvidar:()=>{Object.keys(rutinaItemsPorInstancia).forEach(k=>delete rutinaItemsPorInstancia[k]);},
  fijar:(d)=>fijarItemsDeLaRutina(d),
  items:(d)=>itemsDeLaRutina(d),
  cableados:(dk,c)=>itemsCableadosDeLaRutina(dk,c),
  fuente:(role,trip,sk)=>fuenteDeLaLista(role,trip,sk),
  borrarCache:(dk,c)=>cacheLocalBorrar(nombreEnCacheDeRutina(dk,c))
};`;
let boot = null; try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 300) : '');
if (boot) { console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`); process.exit(fail); }

const T = window.__t;
const DESC = { scopeKey: 'loc:captain:2026-10-21', deptKey: 'captain', cadence: 'morning' };
const FILAS = [
  { id: 'uuid-1', order_index: 0, text_en: 'Shop item one', text_es: 'Ítem uno del centro', active: true },
  { id: 'uuid-2', order_index: 1, text_en: 'Shop item two', text_es: 'Ítem dos del centro', active: true }
];

(async () => {
  T.org('org-1');
  T.idioma('en');

  // La lista cableada existe y tiene ids posicionales. Eso es lo que hace que
  // mezclar las dos fuentes sea un problema de LLAVES y no de contenido.
  const cableados = T.cableados('captain', 'morning');
  chk('la rutina cableada del capitán tiene ítems', cableados.length >= 10, `${cableados.length} ítems`);
  chk('y sus ids son posicionales', cableados[0].id === '0' && cableados[1].id === '1',
      `${cableados[0].id}, ${cableados[1].id}`);

  // ── Apagado: no consulta y usa lo cableado ──
  T.interruptor('cableado');
  T.olvidar();
  T.borrarCache('captain', 'morning');
  plantilla = { id: 'tpl-1', checklist_template_items: FILAS };
  consultas = 0;
  const apagado = await T.fijar(DESC);
  chk('apagado: no consulta la base', consultas === 0, `${consultas} consultas`);
  chk('apagado: la lista es la cableada', apagado.length === cableados.length,
      `${apagado.length} vs ${cableados.length}`);
  chk('apagado: el centinela queda guardado',
      T.instancias()[DESC.scopeKey] === 'cableado', String(T.instancias()[DESC.scopeKey]));

  // ── Prendido: consulta y usa la plantilla ──
  //
  // **Esta es la aserción que la 3a no tenía.** Sin ella, un interruptor que no
  // cambia nada pasa en verde — y eso ya costó tres días.
  T.interruptor('base');
  T.olvidar();
  T.borrarCache('captain', 'morning');
  consultas = 0;
  const prendido = await T.fijar(DESC);
  chk('prendido: consulta la base', consultas === 1, `${consultas} consultas`);
  chk('prendido: la lista es la del centro', prendido.length === 2, `${prendido.length} ítems`);
  chk('prendido: los ids son los uuid de la plantilla',
      prendido[0].id === 'uuid-1', prendido[0].id);
  chk('cambiar el interruptor CAMBIA el comportamiento',
      apagado.length !== prendido.length && apagado[0].id !== prendido[0].id);

  // ── El idioma se resuelve al leer, no al guardar ──
  //
  // Si la caché guardara el texto ya resuelto, congelaría el idioma: es el error
  // que la 3a arregló para las salidas y que repetí doce líneas más abajo.
  chk('en inglés dice el texto inglés', prendido[0].text === 'Shop item one', prendido[0].text);
  T.idioma('es');
  chk('y en español el español, sin volver a consultar',
      T.items(DESC)[0].text === 'Ítem uno del centro', T.items(DESC)[0].text);
  T.idioma('en');

  // ── Una instancia abierta no cambia de llave ──
  //
  // El corazón del A1-a. Si la plantilla desaparece a media mañana —un corte de
  // red, o el dueño la retira— la instancia que la tripulación está tildando
  // tiene que conservar SU lista. Los tildes están guardados con esos uuid.
  consultas = 0;
  plantilla = null;                       // se cayó la plantilla
  const otraVez = await T.fijar(DESC);
  chk('una instancia ya resuelta no vuelve a consultar', consultas === 0, `${consultas} consultas`);
  chk('y conserva su lista aunque la plantilla desaparezca',
      otraVez.length === 2 && otraVez[0].id === 'uuid-1',
      `${otraVez.length} ítems, primero ${otraVez[0].id}`);

  // ── La capa 2 gana sobre lo cableado, y eso es a propósito ──
  //
  // **Mi primera versión de este test esperaba lo contrario y el código tenía
  // razón.** Con la copia local cargada y el servidor sin contestar, una
  // instancia nueva usa la copia, no lo cableado: es exactamente para lo que la
  // capa 2 existe — «mejor una lista de la semana pasada que ninguna», hablado
  // con Fran el 07/10.
  //
  // El matiz que esto destapa y vale anotar: `cargarConTresCapas()` **no
  // distingue** «no pude llegar al servidor» de «la plantilla ya no existe»,
  // así que una plantilla que el centro retiró se sigue sirviendo de la copia
  // local hasta que la copia se reemplace. Es así también para las salidas desde
  // la etapa 3a; cambiarlo es una decisión aparte, no un arreglo.
  const OTRO_DIA = { scopeKey: 'loc:captain:2026-10-22', deptKey: 'captain', cadence: 'morning' };
  plantilla = null;
  const conCopia = await T.fijar(OTRO_DIA);
  chk('sin respuesta del servidor, la copia local gana a lo cableado',
      conCopia.length === 2 && conCopia[0].id === 'uuid-1',
      `${conCopia.length} ítems, primero ${conCopia[0].id}`);

  // ── Sin copia Y sin plantilla: lo cableado, y se guarda el centinela ──
  const SIN_NADA = { scopeKey: 'loc:deck:2026-10-22', deptKey: 'deck', cadence: 'morning' };
  T.borrarCache('deck', 'morning');
  plantilla = null;
  await T.fijar(SIN_NADA);
  chk('sin plantilla ni copia cae a lo cableado y guarda el centinela',
      T.instancias()[SIN_NADA.scopeKey] === 'cableado',
      String(T.instancias()[SIN_NADA.scopeKey]));

  // Y no salta a la plantilla cuando aparece, con la tripulación tildando: los
  // tildes de esa instancia están guardados con los ids posicionales.
  plantilla = { id: 'tpl-2', checklist_template_items: FILAS };
  const siguiendo = await T.fijar(SIN_NADA);
  chk('y no salta a la plantilla con la tripulación tildando',
      siguiendo[0].id === '0', siguiendo[0].id);

  // ── El acta dice de dónde salió la lista, y no antes de saberlo ──
  chk('sin instancia resuelta el acta no afirma nada',
      T.fuente('captain', null, 'loc:captain:2026-12-31') === null);
  chk('con plantilla dice template',
      T.fuente('captain', null, DESC.scopeKey) === 'template');
  chk('con la cableada dice hardwired',
      T.fuente('deck', null, SIN_NADA.scopeKey) === 'hardwired',
      String(T.fuente('deck', null, SIN_NADA.scopeKey)));
  chk('una checklist propia sigue siendo del centro',
      T.fuente('custom_abc', null, 'x') === 'template');

  // Y el que firma pasa su scopeKey: derivarlo del rol sería buscar «alguna
  // instancia de este rol», y hoy y ayer conviven en una sesión.
  chk('el firmado de una rutina le pasa su scopeKey al acta',
      /scopeKey: deptScope\(\)\.scopeKey/.test(html));

  console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
  process.exit(fail);
})();
