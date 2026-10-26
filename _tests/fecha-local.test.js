// Qué día es hoy para un centro de buceo.
//
//   node _tests/run-all.js      (preferido)
//
// EL BUG, medido el 26/10 y no deducido: `formatDate(d)` devolvía
// `d.toISOString().split('T')[0]`, o sea la fecha **UTC**. Y esa misma
// expresión estaba copiada **37 veces** en el archivo.
//
// Para un centro al este de Greenwich eso devuelve AYER toda la mañana —Fiji
// es UTC+12, Tailandia UTC+7, los dos mercados del producto— y para uno al
// oeste devuelve MAÑANA toda la noche: Mar del Plata es UTC−3, así que desde
// las 21 en adelante, que es cuando Fran usa la app.
//
// Y que estaba mal ya lo había chocado alguien: en `openNewTripModal` había un
// `todayLocalStr` escrito a mano con los getters locales, al lado de dos
// llamadas a `formatDate`, y la línea siguiente **comparaba los dos**. Se
// parchó el sitio y no la función.
//
// ESTE ARCHIVO FUERZA EL HUSO, y es lo único que hace la prueba posible: el
// sandbox corre en UTC, donde la fecha local y la UTC son la misma y las dos
// versiones del código pasan. Un test que no puede distinguir el bug del
// arreglo no es un test.
process.env.TZ = 'Pacific/Fiji';   // UTC+12, el huso de uno de los mercados

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');
const { lineasDeCodigoCon } = require('./contar');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · El huso de verdad está puesto ──────────────────────────────────────
// Si Node ignorara TZ, todo lo de abajo pasaría por la razón equivocada.
const sondaTZ = new Date('2026-10-26T20:00:00Z');
chk('el huso forzado funciona: en Fiji las 20:00 UTC son del día siguiente',
    sondaTZ.getDate() === 27 && sondaTZ.getUTCDate() === 26,
    'local=' + sondaTZ.getDate() + ' utc=' + sondaTZ.getUTCDate());

// ─── 2 · Una sola función, y ninguna copia ──────────────────────────────────
chk('fechaLocal se declara una vez',
    (html.match(/function fechaLocal\(/g) || []).length === 1);
chk('formatDate ya no existe como función',
    !/function formatDate\(/.test(html),
    'era la misma cosa con otro nombre, y la otra estaba mal');

// El guardián que importa: afirma la REGLA, no un número. Si mañana alguien
// escribe una copia nueva, falla. Se cuentan sólo líneas de CÓDIGO porque los
// comentarios que explican el bug nombran la expresión a propósito — contar
// menciones ya falló cuatro veces en este proyecto.
const copias = lineasDeCodigoCon(html, "toISOString().split('T')[0]");
chk('ninguna línea de código saca una fecha de calendario del UTC',
    copias.length === 0, copias.slice(0, 3).join('  ·  '));

// Las marcas de tiempo COMPLETAS sí van en UTC, y eso es correcto: un instante
// no tiene huso. Este guardián existe para que nadie "unifique" también esas.
chk('las marcas de tiempo completas siguen en UTC',
    lineasDeCodigoCon(html, 'new Date().toISOString()').length > 10,
    'created_at, signed_at, sealed_at: un instante no tiene día local');

// ─── 3 · El comportamiento, con el index.html de verdad ─────────────────────
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
const hook = main + '\n;window.__t={ fecha:(d)=>fechaLocal(d) };';
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot && boot.stack || boot).slice(0, 300) : '');

try {
if (boot) throw boot;
const T = window.__t;

// LA COMPROBACIÓN CENTRAL, y la que el bug no pasaba: a las 8 de la mañana en
// Fiji, la fecha UTC es la de ayer.
const maniana = new Date('2026-10-26T20:00:00Z');   // 27/10 08:00 en Fiji
chk('a las 8 de la mañana en Fiji, hoy es el 27',
    T.fecha(maniana) === '2026-10-27', T.fecha(maniana));
chk('y la versión vieja habría dicho el 26 — por eso era un bug',
    maniana.toISOString().split('T')[0] === '2026-10-26',
    'no es una opinión: son dos días distintos para la misma persona');

// La otra punta del mundo: de noche en Mar del Plata (UTC−3) el UTC se va al
// día siguiente. Se mide cambiando el huso del proceso a mitad del test, que
// es legítimo porque `fechaLocal` lee los getters locales en cada llamada.
process.env.TZ = 'America/Argentina/Buenos_Aires';
const noche = new Date('2026-10-27T01:00:00Z');     // 26/10 22:00 en Mar del Plata
chk('a las 22 en Mar del Plata, hoy sigue siendo el 26',
    T.fecha(noche) === '2026-10-26', T.fecha(noche));
chk('y la versión vieja habría dicho el 27',
    noche.toISOString().split('T')[0] === '2026-10-27');
process.env.TZ = 'Pacific/Fiji';

// Sin argumento usa ahora, y el formato es el que esperan los `input[type=date]`
// y las columnas `date` de Postgres.
chk('sin argumento devuelve hoy en formato ISO corto',
    /^\d{4}-\d{2}-\d{2}$/.test(T.fecha()), T.fecha());
chk('los meses y días de un dígito van con cero adelante',
    T.fecha(new Date(2026, 0, 5)) === '2026-01-05', T.fecha(new Date(2026, 0, 5)));

// El ancla de mediodía que varias copias usaban: `new Date(d + 'T12:00:00')` no
// cruza de día en ningún huso, así que esas copias estaban bien **por
// accidente**. El arreglo no las rompe, y conviene afirmarlo: es el camino que
// usan el calendario, los reportes y el log de waivers.
const anclada = new Date('2026-10-26T12:00:00');
chk('una fecha anclada al mediodía local sigue dando el mismo día',
    T.fecha(anclada) === '2026-10-26', T.fecha(anclada));

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
