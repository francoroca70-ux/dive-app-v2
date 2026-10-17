// Las fechas siguen el idioma de la APP, no el de la máquina.
//
//   node _tests/idioma-de-las-fechas.test.js
//
// Lo trajo una medición, no una idea: el 16/10 la suite dio 1037/0 en el
// sandbox y 1037/5 en el Windows de Fran, sobre el mismo commit. La causa era
// `toLocaleDateString()` sin idioma, que usa el del SISTEMA.
//
// Y eso no era un problema de los tests: era un bug de producto. La app es
// bilingüe a propósito, y mostraba las fechas en el idioma del sistema
// operativo. Un centro en Tailandia con la app en inglés, sobre una tablet
// tailandesa, veía las fechas en tailandés.
//
// Peor: había CUATRO redacciones de la misma regla conviviendo, y ya habían
// divergido —`es-AR`/`en-GB` en dos lugares, `es-ES`/`en-US` en seis, un
// `'en-US'` escrito a mano, y nada en el resto—. La misma fecha se veía
// distinta en el banner de suscripción que en la planilla de tripulación.
const { JSDOM } = require('./jsdom');
const fs = require('fs');
const path = require('path');
const { llamadasA, localeDeLaApp: localeEsperado } = require('./contar');

let pass = 0, fail = 0;
function chk(nombre, ok, detalle) {
  if (ok) { pass++; console.log('PASS  ' + nombre); }
  else { fail++; console.log('FAIL  ' + nombre + (detalle ? '  ' + detalle : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · El guardián que impide la quinta copia ─────────────────────────────
//
// Es la aserción que importa: NINGUNA llamada a toLocale* puede quedar sin el
// idioma de la app. Una sola que se escape vuelve a mostrar la fecha en el
// idioma del sistema, y eso no se nota mirando la pantalla propia.
const sinIdioma = [...html.matchAll(/\.toLocale(DateString|TimeString|String)\(([^)]{0,40})/g)]
  .filter(m => !/^(localeDeLaApp|rosterLocale|loc\b)/.test(m[2].trim()))
  .map(m => '.toLocale' + m[1] + '(' + m[2].trim().slice(0, 40));
chk('ninguna fecha se formatea con el idioma de la máquina',
    sinIdioma.length === 0,
    sinIdioma.length + ' sin idioma: ' + JSON.stringify(sinIdioma.slice(0, 3)));

chk('el idioma de las fechas se decide en una sola función',
    (html.match(/function localeDeLaApp\(\)/g) || []).length === 1);

// Las cuatro redacciones viejas no pueden volver.
chk('no quedan redacciones sueltas de la misma regla',
    !/currentLanguage === 'es' \? 'es-AR'/.test(html) &&
    !/currentLanguage === 'es' \? 'es-ES'/.test(html),
    'había es-AR/en-GB y es-ES/en-US conviviendo');

// ─── 2 · El comportamiento ──────────────────────────────────────────────────

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/index.html' });
const { window } = dom;
const scripts = [...window.document.querySelectorAll('script')].map(s => s.textContent);
window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.scrollTo = () => {};
window.supabase = { createClient: () => ({
  auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} },
  from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) })
}) };
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const main = scripts.find(s => s.includes('[Seven Seas] build'));
const hook = main + "\n;window.__t={" +
  "setIdioma:(l)=>{currentLanguage=l;}," +
  "locale:()=>localeDeLaApp()," +
  "t:(k)=>t(k)};";
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 220) : '');

try {
const T = window.__t;

T.setIdioma('es');
chk('en castellano formatea en español latinoamericano',
    T.locale() === 'es-419', T.locale());
T.setIdioma('en');
chk('y en inglés con el día primero, igual que el castellano',
    T.locale() === 'en-GB', T.locale());

// El espejo: el ayudante de los tests repite esta misma regla, y si las dos se
// separan los tests de fechas empiezan a mentir en silencio. Misma disciplina
// que el espejo del CHECK de las cadencias.
T.setIdioma('es');
chk('el ayudante de los tests dice lo mismo que la app, en castellano',
    localeEsperado('es') === T.locale(), localeEsperado('es') + ' vs ' + T.locale());
T.setIdioma('en');
chk('y en inglés también',
    localeEsperado('en') === T.locale(), localeEsperado('en') + ' vs ' + T.locale());

// Y lo que esto arregla, visto de verdad: la misma fecha, los dos idiomas, sin
// que la máquina opine.
const d = new Date('2026-10-17T12:00:00Z');
const opts = { month: 'short', day: 'numeric', year: 'numeric' };
T.setIdioma('es');
const enEs = d.toLocaleDateString(T.locale(), opts);
T.setIdioma('en');
const enEn = d.toLocaleDateString(T.locale(), opts);
chk('la misma fecha se ve distinta en cada idioma', enEs !== enEn, enEs + '  /  ' + enEn);
chk('y las dos ponen el día antes que el mes',
    enEs.startsWith('17') && enEn.startsWith('17'),
    enEs + '  /  ' + enEn);
chk('ninguna de las dos depende del idioma de esta máquina',
    enEs === '17 oct 2026' && enEn === '17 Oct 2026',
    enEs + '  /  ' + enEn);

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
