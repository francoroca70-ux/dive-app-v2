// Un día del centro, comparado contra una columna de INSTANTE.
//
//   node _tests/run-all.js      (preferido)
//
// EL BUG, y es uno que introduje yo mismo al arreglar el anterior. Lo encontró
// una revisión independiente del commit 1822e0f.
//
// Ese commit unificó «qué día es hoy» en `fechaLocal()`, que devuelve el día del
// centro. Pero cuatro consultas comparan ese día contra una columna
// `timestamptz` pegándole un texto SIN huso:
//
//     .gte('signed_at', '2026-10-26T00:00:00')
//
// PostgREST manda ese texto crudo y Postgres lo interpreta con el `TimeZone` de
// la sesión. **Medido el 26/10 contra la base real: `show timezone` → UTC**, y
// `sales.sold_at`, `waivers.signed_at` y `checklist_completions.signed_at` son
// las tres `timestamp with time zone`. Así que el borde de la ventana era la
// medianoche de Greenwich.
//
// Lo que lo vuelve una REGRESIÓN y no un bug viejo: antes las dos puntas
// estaban mal y se cancelaban. El día por defecto también salía del UTC, así
// que la fecha y el borde vivían en el mismo huso. Arreglé una punta y no la
// otra — el mismo error que el commit decía venir a corregir.
//
// Los dos sitios de waivers y el de actas **están en producción**. El de ventas
// está detrás de `POS_VENTAS` apagado.
process.env.TZ = 'Pacific/Fiji';   // UTC+12

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');
const { lineasDeCodigoCon } = require('./contar');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · EL GUARDIÁN: nadie vuelve a pegar un string sin huso ───────────────
//
// Afirma la regla, no un número: cualquier `.gte('col', algo + 'T…')` nuevo
// falla acá. Es la forma exacta del bug, y es fácil de escribir sin pensarlo.
const pegados = html.split('\n').filter(l =>
  /\.(gte|lte|gt|lt|eq)\(\s*'[a-z_]+'\s*,\s*[A-Za-z_$][\w$.]*\s*\+\s*'T/.test(l) &&
  !l.trim().startsWith('//')
);
chk('ninguna consulta compara una columna contra un texto de fecha sin huso',
    pegados.length === 0, pegados.slice(0, 3).join(' · '));

chk('la ventana se calcula en un solo lugar',
    (html.match(/function ventanaDelDia\(/g) || []).length === 1);
chk('y el camino de vuelta también',
    (html.match(/function diaLocalDeInstante\(/g) || []).length === 1);

// Los cuatro sitios que la llaman. Se excluyen la declaración y la línea que
// la nombra dentro del mensaje de error — **el nombre dentro de un string no es
// un llamador**, igual que un comentario no lo es. Mi primera versión esperaba
// 5 y daba 6 justamente por esa línea: quinta vez con la misma forma.
const usos = lineasDeCodigoCon(html, 'ventanaDelDia(')
  .filter(l => !l.startsWith('function ') && !l.includes('RangeError'));
chk('la llaman los cuatro filtros medidos y nadie más',
    usos.length === 4, usos.length + ': ' + JSON.stringify(usos));

// `lte` con 'T23:59:59' pierde la última fracción de segundo. La ventana es
// semiabierta y eso tiene que seguir siendo verdad.
chk('la ventana es semiabierta: se usa lt, no lte',
    lineasDeCodigoCon(html, ".lt('signed_at'").length === 3 &&
    lineasDeCodigoCon(html, ".lt('sold_at'").length === 1,
    'un <= 23:59:59 pierde lo que pase en el último segundo');
chk('y ya no queda ningún 23:59:59',
    lineasDeCodigoCon(html, "T23:59:59").length === 0);

// ─── 2 · El comportamiento ──────────────────────────────────────────────────
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/index.html' });
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.scrollTo = () => {};
window.supabase = { createClient: () => ({
  auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} },
  from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) })
}) };
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const scripts = [...window.document.querySelectorAll('script')].map(s => s.textContent);
const main = scripts.find(s => s.includes('[Seven Seas] build'));
const hook = main + `
;window.__t={
  ventana:(f,n)=>ventanaDelDia(f,n),
  dia:(iso)=>diaLocalDeInstante(iso),
  fecha:(d)=>fechaLocal(d),
  dias:(a,b)=>tripDayCount(a,b)
};`;
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot && boot.stack || boot).slice(0, 300) : '');

try {
if (boot) throw boot;
const T = window.__t;

// LA COMPROBACIÓN CENTRAL. En Fiji (UTC+12), la medianoche local del 26 es el
// 25 a las 12:00 UTC. Ésa es la diferencia que el bug tiraba a la basura.
const v = T.ventana('2026-10-26');
chk('el borde de abajo es la medianoche LOCAL, como instante',
    v.desde === '2026-10-25T12:00:00.000Z', v.desde);
chk('y el de arriba es la medianoche local del día siguiente',
    v.hasta === '2026-10-26T12:00:00.000Z', v.hasta);
chk('la versión vieja habría mandado el borde de Greenwich — por eso era un bug',
    '2026-10-26' + 'T00:00:00' !== v.desde,
    'doce horas de diferencia, o sea media jornada de mostrador');

// Una venta de las 9 de la mañana en Fiji cae DENTRO de la ventana de su día.
// Con el borde UTC quedaba afuera, y era el caso del reporte: el centro abría
// el mostrador y no veía ninguna de sus ventas.
const nueveDeLaManiana = new Date('2026-10-25T21:00:00Z');   // 26/10 09:00 en Fiji
chk('una venta de las 9 de la mañana en Fiji entra en la ventana de su día',
    nueveDeLaManiana.toISOString() >= v.desde && nueveDeLaManiana.toISOString() < v.hasta,
    nueveDeLaManiana.toISOString());
chk('y con el borde viejo quedaba AFUERA',
    !(nueveDeLaManiana.toISOString() >= '2026-10-26T00:00:00'),
    'esto es el bug, escrito como comprobación');

// Varios días, para la vista semanal del log de waivers.
const semana = T.ventana('2026-10-26', 7);
chk('con 7 días la ventana cubre la semana entera',
    semana.desde === v.desde &&
    semana.hasta === new Date(2026, 9, 26 + 7).toISOString(), semana.hasta);
chk('y el largo sale de tripDayCount, que ya existía',
    T.dias('2026-10-26', '2026-11-01') === 7, String(T.dias('2026-10-26', '2026-11-01')));

// Rueda de mes y de año sola, que es la razón de usar `new Date(a, m-1, d+1)`
// en vez de sumar 86400000.
chk('el último día del mes rueda al mes siguiente',
    T.ventana('2026-10-31').hasta === new Date(2026, 10, 1).toISOString());
chk('y el último del año al año siguiente',
    T.ventana('2026-12-31').hasta === new Date(2027, 0, 1).toISOString());

// Basura entra, excepción sale. No una ventana plausible-pero-inventada.
let err = null;
try { T.ventana('no es una fecha'); } catch (e) { err = e; }
chk('una fecha inválida corta en vez de devolver una ventana inventada', !!err);

// ─── 3 · El camino de vuelta ────────────────────────────────────────────────
chk('un instante se resuelve al día del centro',
    T.dia('2026-10-25T21:00:00Z') === '2026-10-26', T.dia('2026-10-25T21:00:00Z'));
chk('y la versión vieja habría dicho el 25',
    '2026-10-25T21:00:00Z'.split('T')[0] === '2026-10-25',
    'una firma de la mañana archivada bajo el día anterior');
chk('un instante vacío no explota ni inventa un día',
    T.dia(null) === '' && T.dia('') === '' && T.dia('basura') === '');

// ─── 4 · fechaLocal no inventa fechas ───────────────────────────────────────
// `formatDate` lanzaba RangeError con una fecha inválida y eso era mejor que
// «NaN-NaN-NaN»: es alcanzable desde los botones de día anterior/siguiente si
// la persona vacía el campo.
let err2 = null;
try { T.fecha(new Date('basura')); } catch (e) { err2 = e; }
chk('fechaLocal corta con una fecha inválida en vez de devolver NaN-NaN-NaN', !!err2);
chk('pero sin argumento sigue siendo hoy, que es parte del contrato',
    /^\d{4}-\d{2}-\d{2}$/.test(T.fecha()));
chk('y un null explícito también es hoy',
    T.fecha(null) === T.fecha(), T.fecha(null));

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
