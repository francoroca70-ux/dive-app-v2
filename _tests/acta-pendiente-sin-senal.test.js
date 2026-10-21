// El acta firmada sin señal no desaparece de la pantalla.
//
//   node _tests/acta-pendiente-sin-senal.test.js
//
// El bug, reportado por Fran el 14/10: firmando en modo avión, el acta aparece
// dos segundos y la pantalla vuelve a la lista viva.
//
// La causa, leída del código y no reproducida —conviene decirlo—:
// `guardarActa()` encola bien y devuelve true, se pinta «firmada», y acto
// seguido el redibujo le pregunta al SERVIDOR por un acta que el servidor
// nunca recibió. Sin red esa consulta falla y `buscarActaVigente()` devolvía
// `null`, o sea «no hay acta»: lo contrario exacto de la verdad.
//
// Los dos segundos son lo que tarda el pedido en fallar.
//
// Y había un segundo problema de la misma familia: los tres caminos que firman
// terminaban en estados DISTINTOS según lo que `navigator.onLine` hubiera
// dicho. Con `false`, cartel y lista viva. Con `true` —la mentira de a bordo—,
// el acta apareciendo y desapareciendo.
const { JSDOM } = require('./jsdom');
const fs = require('fs');
const path = require('path');
const { llamadasA } = require('./contar');

let pass = 0, fail = 0;
function chk(nombre, ok, detalle) {
  if (ok) { pass++; console.log('PASS  ' + nombre); }
  else { fail++; console.log('FAIL  ' + nombre + (detalle ? '  ' + detalle : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · Estructural ────────────────────────────────────────────────────────

chk('la cola se consulta en una sola función',
    (html.match(/function actaEncoladaPara\(/g) || []).length === 1);

chk('y la usa buscarActaVigente, en sus DOS finales',
    llamadasA(html, 'actaEncoladaPara') === 2,
    llamadasA(html, 'actaEncoladaPara') + ' llamadas — la consulta falla y la consulta vacía');

// Cuando el servidor contesta, manda el servidor. La encolada es la reserva.
chk('el acta del servidor le gana a la encolada',
    /return \(data && data\[0\]\) \|\| actaEncoladaPara\(/.test(html));

// Los tres caminos que firman sin señal ahora redibujan, como el camino con
// red. Antes sólo pintaban el cartel.
chk('los tres caminos offline redibujan',
    /pintarFirmaDelInstructor\(signer\.name, done, instructorItems\.length, t\('cl_saved_offline_sync'\)\);[\s\S]{0,700}?await renderInstructorChecklistForTrip\(tripId\);/.test(html) &&
    /pintar\(t\('cl_saved_offline_sync'\)\);[\s\S]{0,700}?await renderCustomChecklistsForCurrentView\(\);/.test(html) &&
    // `items.length` y no `routine.items.length` desde el A1-a del 21/10: la
    // lista de una rutina ahora la resuelve `deptScope()` una sola vez, porque
    // puede venir de la plantilla del centro o de lo cableado. Lo que esta
    // aserción cuida sigue siendo lo mismo: que el camino sin señal redibuje.
    /pintarFirmaDeRutina\(signer\.name, done, items\.length, t\('cl_saved_offline_sync'\)\);[\s\S]{0,700}?await renderDeptRoutine\(\);/.test(html));

// El progreso NO se borra sin señal: el acta todavía puede no entrar.
chk('firmar sin señal no borra el progreso',
    !/queueOfflineAction\('checklist_completion'[\s\S]{0,700}?clearChecklistProgress/.test(html),
    'los tildes son la red de seguridad hasta que el acta entre');

chk('lo pendiente se dice en un solo lugar',
    (html.match(/function lineaDeActaPendiente\(/g) || []).length === 1 &&
    llamadasA(html, 'lineaDeActaPendiente') === 1);

// ─── 2 · Comportamiento ─────────────────────────────────────────────────────

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
  "encolar:(p)=>queueOfflineAction('checklist_completion',p)," +
  "encolarOtro:(t,p)=>queueOfflineAction(t,p)," +
  "vaciarCola:()=>setOfflineQueue([])," +
  "buscarEnCola:(o)=>actaEncoladaPara(o)," +
  "lineaPendiente:(a)=>lineaDeActaPendiente(a)," +
  "t:(k)=>t(k)};";
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 220) : '');

try {
const T = window.__t;
T.setIdioma('es');
T.vaciarCola();

// ── Sin nada en la cola, no se inventa un acta
chk('cola vacía: no hay acta pendiente',
    T.buscarEnCola({ role: 'instructor', tripId: 't-1' }) === null);

// ── El acta de una salida
T.encolar({ role: 'instructor', trip_id: 't-1', signed_by: 'Franco',
            completed_items: 4, total_items: 6, items_snapshot: [], signed_at: '2026-10-16T10:00:00Z' });
const a = T.buscarEnCola({ role: 'instructor', tripId: 't-1' });
chk('el acta encolada de esa salida aparece', !!a && a.signed_by === 'Franco', JSON.stringify(a && a.signed_by));
chk('y viene marcada como pendiente', !!a && a.pendiente === true);

// La llave importa: no puede aparecer en OTRA salida ni en otro rol.
chk('no aparece en otra salida',
    T.buscarEnCola({ role: 'instructor', tripId: 't-2' }) === null);
chk('ni en otra checklist',
    T.buscarEnCola({ role: 'deck_morning', tripId: 't-1' }) === null);

// ── Lo que hay en la cola que no es un acta no se confunde con una
T.vaciarCola();
T.encolarOtro('checklist_tick', { role: 'instructor', trip_id: 't-1' });
chk('un tilde encolado no se lee como un acta',
    T.buscarEnCola({ role: 'instructor', tripId: 't-1' }) === null,
    'la cola lleva varios tipos y sólo uno es un acta');

// ── Las de departamento se identifican por período, no por salida
T.vaciarCola();
T.encolar({ role: 'deck_morning', trip_id: null, signed_by: 'Pau',
            completed_items: 2, total_items: 6, items_snapshot: [], signed_at: '2026-10-16T09:00:00Z' });
chk('una rutina encolada aparece dentro de su período',
    !!T.buscarEnCola({ role: 'deck_morning', periodo: { start: '2026-10-16T00:00:00Z', end: '2026-10-16T23:59:59Z' } }));
chk('y NO aparece fuera de su período',
    T.buscarEnCola({ role: 'deck_morning', periodo: { start: '2026-10-17T00:00:00Z', end: '2026-10-17T23:59:59Z' } }) === null,
    'si no, la rutina de ayer taparía la de hoy');

// ── Con dos encoladas de la misma instancia gana la más nueva
T.encolar({ role: 'deck_morning', trip_id: null, signed_by: 'Meli',
            completed_items: 6, total_items: 6, items_snapshot: [], signed_at: '2026-10-16T11:00:00Z' });
const ult = T.buscarEnCola({ role: 'deck_morning', periodo: { start: '2026-10-16T00:00:00Z', end: '2026-10-16T23:59:59Z' } });
chk('con dos encoladas gana la más nueva', ult.signed_by === 'Meli', ult.signed_by);

// ── La pantalla lo dice, y sólo cuando corresponde
chk('un acta pendiente avisa que no está sincronizada',
    /sin sincronizar/.test(T.lineaPendiente({ pendiente: true })),
    T.lineaPendiente({ pendiente: true }).slice(0, 60));
chk('y una que ya está en el servidor no dice nada',
    T.lineaPendiente({ signed_by: 'Franco' }) === '' && T.lineaPendiente(null) === '',
    'sería ruido en todas las actas');

T.setIdioma('en');
chk('el aviso existe también en inglés',
    /not yet synced/.test(T.lineaPendiente({ pendiente: true })));
T.setIdioma('es');
T.vaciarCola();

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
