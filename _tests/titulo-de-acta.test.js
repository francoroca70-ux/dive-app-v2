// El título de un acta, y el plegado de las checklists de departamento.
//
//   node _tests/titulo-de-acta.test.js
//
// Por qué existe, con fecha. El 15/10 Fran creó una checklist propia del
// capitán llamada «Mediodía», la firmó, la borró, y el acta quedó en Logged
// Checklists titulada **«Revisión de seguridad de la embarcación»** — un nombre
// que él nunca escribió.
//
// Tres defectos encadenados, y ninguno era el que parecía:
//
//  1 · `cl_logged_vessel_check` era un TEXTO DE RELLENO del diccionario que las
//      tres vistas de actas usaban de título cuando el acta no tenía salida. O
//      sea: toda checklist de departamento y toda propia aparecía con ese
//      nombre. No era el nombre de nada.
//  2 · el nombre de una propia se resolvía AL DIBUJAR, mirando la fila viva de
//      `custom_checklists`. Un acta es inmutable y tiene que leerse sola —ya
//      guarda `trip_name`, `boat_name`, `signed_by`— pero el nombre de la
//      checklist no se guardaba, así que borrarla lo destruía para siempre.
//  3 · las tres vistas usaban `crewRoleLabel`, que devuelve lo que le entra, en
//      vez de `checklistRoleLabel`, que traduce el uuid a nombre. La función se
//      había arreglado el 14/10 y estos tres lugares **nunca la llamaron**:
//      arreglé la función y no pregunté quién la usaba.
const { JSDOM } = require('./jsdom');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(nombre, ok, detalle) {
  if (ok) { pass++; console.log('PASS  ' + nombre); }
  else { fail++; console.log('FAIL  ' + nombre + (detalle ? '  ' + detalle : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · Lo estructural, leyendo el archivo ───

chk('el relleno «Vessel safety check» no existe más en el diccionario',
    !/cl_logged_vessel_check:/.test(html),
    'un texto que no nombra ninguna checklist no puede ser el título de un acta');

chk('el acta guarda el nombre de la checklist',
    /checklist_name: nombreDeChecklistParaActa\(role\)/.test(html),
    'dentro de buildRecordPayload, no en los tres que firman');

chk('y lo decide una sola función',
    (html.match(/function nombreDeChecklistParaActa\(/g) || []).length === 1);

chk('las tres vistas de actas no llaman más a crewRoleLabel',
    !/crewRoleLabel\(r\.role\)/.test(html),
    'devolvía el uuid crudo en la pantalla donde un dueño mira el historial');

chk('el título de un acta se decide en un solo lugar',
    (html.match(/function tituloDeActa\(/g) || []).length === 1 &&
    (html.match(/function rolDeActaSiAporta\(/g) || []).length === 1);

// El nombre del acta y el rol son los dos texto que puede haber escrito una
// persona, así que los dos van escapados. El del rol era crudo hasta hoy, y
// recién pasó a poder contener el título de una propia.
chk('el título va escapado en las tres vistas',
    (html.match(/escapeHtml\(tituloDeActa\(r/g) || []).length === 3,
    (html.match(/escapeHtml\(tituloDeActa\(r/g) || []).length + ' de 3');
chk('y el rol también, en las tres',
    !/\$\{roleLabel\} ·/.test(html) &&
    (html.match(/escapeHtml\(rolDeActaSiAporta\(r\)\)/g) || []).length >= 2,
    'el de Logged Checklists iba crudo al innerHTML');

// ─── 2 · El plegado, estructural ───

chk('hay UN registro de checklists abiertas, no uno por tipo de tarjeta',
    (html.match(/let checklistsAbiertas = /g) || []).length === 1 &&
    !/propiasAbiertas/.test(html),
    'propias y de departamento son la misma regla');

chk('la rutina de departamento nace plegada',
    /<div id="dept-routine-body" style="display:none;">/.test(html),
    'lo que reportó Fran: la de la mañana abierta tapando a las propias');

chk('el encabezado de la rutina abre y cierra',
    /onclick="toggleDeptAbierta\(\)"/.test(html) &&
    (html.match(/function toggleDeptAbierta\(/g) || []).length === 1);

chk('y el render respeta lo que la persona dejó',
    /checklistsAbiertas\.has\(claveDeptoAbierta\(roleKey\)\)/.test(html),
    'sin esto, cambiar de pestaña hereda el estado de la pestaña anterior');

chk('la clave de una de departamento no se puede pisar con la de una propia',
    /return `dept:\$\{roleKey\}`/.test(html),
    'una es `dept:deck_morning`, la otra un uuid');

// ─── 3 · El comportamiento, corriendo el index.html de verdad ───

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/index.html' });
const { window } = dom;
const scripts = [...window.document.querySelectorAll('script')].map(s => s.textContent);

window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.scrollTo = () => {};
window.supabase = {
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) })
  })
};
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const main = scripts.find(s => s.includes('[Seven Seas] build'));
const hook = main + "\n;window.__t={" +
  "setIdioma:(l)=>{currentLanguage=l;}," +
  "setCustom:(a)=>{customChecklists=a;}," +
  "titulo:(r,o)=>tituloDeActa(r,o)," +
  "rol:(r)=>rolDeActaSiAporta(r)," +
  "nombre:(r)=>nombreDeChecklistParaActa(r)," +
  "t:(k)=>t(k)};";
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 200) : '');

try {
const T = window.__t;
T.setIdioma('es');
T.setCustom([{ id: 'aaa-111', title: 'Mediodía', cadence: 'morning', dept_key: 'deck', role_scope: 'captain', items: ['uno'] }]);

// ── Qué se guarda al firmar
chk('una propia guarda su nombre en el acta',
    T.nombre('custom_aaa-111') === 'Mediodía', T.nombre('custom_aaa-111'));
// Una rutina de departamento se nombra desde `role`, que el acta ya guarda.
// Copiar el texto acá congelaría la traducción del día que se firmó: el cambio
// de «Mañana» a «Inicio del día» del 15/10 dejaría las actas viejas con el
// nombre viejo. Un dato derivable no se snapshotea.
chk('una de departamento NO lo guarda, porque se deriva de role',
    T.nombre('deck_morning') === null, String(T.nombre('deck_morning')));
chk('ni la de preparación de una salida',
    T.nombre('instructor') === null, String(T.nombre('instructor')));
// Guardar el texto genérico sería guardar un relleno con la misma confianza que
// un nombre real, que es exactamente el bug que esto arregla.
chk('una propia que no está cargada guarda NULL, no un relleno',
    T.nombre('custom_no-existe') === null, String(T.nombre('custom_no-existe')));

// ── Qué se muestra al leer
const salida = { trip_id: 't1', trip_name: 'Island Hopping', trip_time: '09:30:00', trip_date: '2026-10-15', role: 'instructor' };
chk('un acta de salida se titula con la salida',
    T.titulo(salida) === '09:30 — Island Hopping', T.titulo(salida));
chk('y abajo dice qué checklist era, que es otro dato',
    T.rol(salida) === T.t('cl_instructor_dm'), T.rol(salida));

// EL BUG DE FRAN. El acta sobrevive a la checklist: es inmutable. Con el nombre
// guardado se lee sola, aunque la fila viva ya no exista.
const borrada = { trip_id: null, role: 'custom_93134ccc', checklist_name: 'Mediodía' };
chk('un acta de una propia BORRADA dice el nombre que le puso Fran',
    T.titulo(borrada) === 'Mediodía', T.titulo(borrada));
chk('y no repite el nombre abajo',
    T.rol(borrada) === '', '«' + T.rol(borrada) + '»');
chk('nunca aparece el uuid',
    !/93134ccc/.test(T.titulo(borrada) + T.rol(borrada)));

// El nombre guardado le gana al vivo: el acta dice lo que se firmó, no lo que
// la checklist se llama hoy. Renombrar una checklist no reescribe su historia.
chk('el nombre guardado le gana al nombre de hoy',
    T.titulo({ trip_id: null, role: 'custom_aaa-111', checklist_name: 'Como se llamaba al firmar' })
      === 'Como se llamaba al firmar');

// Un acta anterior al 15/10 no tiene el nombre guardado. No se rellena hacia
// atrás —misma decisión que `items_source` y que los 5 waivers del 23/09—, así
// que cae en el nombre derivado del rol, que para una propia viva alcanza.
chk('un acta vieja de una propia que todavía existe cae en su nombre vivo',
    T.titulo({ trip_id: null, role: 'custom_aaa-111', checklist_name: null }) === 'Mediodía');
chk('y una vieja de una propia ya borrada dice qué es, sin inventar un nombre',
    T.titulo({ trip_id: null, role: 'custom_fantasma', checklist_name: null })
      === T.t('cl_custom_checklist_generic'),
    T.titulo({ trip_id: null, role: 'custom_fantasma', checklist_name: null }));

// Una rutina de departamento: el título ya dice depto + cadencia, así que
// repetirlo abajo sería ruido.
const rutina = { trip_id: null, role: 'deck_morning', checklist_name: null };
chk('una rutina de departamento se titula con depto y cadencia',
    T.titulo(rutina) === 'Cubierta — Inicio del día', T.titulo(rutina));
chk('y no se repite abajo', T.rol(rutina) === '', '«' + T.rol(rutina) + '»');

// Y el título sigue el idioma de quien mira, porque se deriva. Si se hubiera
// snapshoteado, un acta firmada en castellano se vería en castellano para un
// instructor que usa la app en inglés.
// En inglés la cadencia sigue siendo «Morning»: lo que se cambió el 15/10 fue
// el castellano, donde «Mañana» se lee como *tomorrow*. En inglés no hay
// ambigüedad, así que no se tocó — y mi primera versión de este test esperaba
// «Start of day» en inglés, o sea afirmaba un cambio que nunca se pidió.
T.setIdioma('en');
chk('el título de una rutina sigue el idioma de quien mira',
    T.titulo(rutina) === 'Deck — Morning', T.titulo(rutina));
T.setIdioma('es');

// Lo que una persona escribió NO se traduce, y eso también es correcto: es su
// texto, no una etiqueta del producto.
T.setIdioma('en');
chk('el nombre que escribió el centro no se traduce', T.titulo(borrada) === 'Mediodía');
T.setIdioma('es');

// Nada rompe con un acta a medio llenar.
chk('aguanta un acta sin rol ni nombre',
    typeof T.titulo({ trip_id: null, role: null, checklist_name: null }) === 'string' &&
    !/null|undefined/.test(T.titulo({ trip_id: null, role: null, checklist_name: null })));

// El export completo pide el título con fecha, y la opción tiene que llegar.
chk('el export con fecha la recibe',
    T.titulo(salida, { conFecha: true }) === '2026-10-15 09:30 — Island Hopping',
    T.titulo(salida, { conFecha: true }));

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
