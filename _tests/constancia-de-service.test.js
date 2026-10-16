// La constancia en papel de un service sellado.
//
//   node _tests/constancia-de-service.test.js
//
// Por qué existe: el sello se construyó el 14/10 y **no se podía mostrar**. Un
// sello que no sale del sistema no le sirve a un seguro, que es exactamente
// para quién se hizo. Quedó anotado como «encontrado y sin arreglar» y esto lo
// cierra.
//
// La regla que este archivo cuida, y es la que puede mentir: **en la hoja va
// sólo lo que la huella cubre.** `maintenance_log_canonical_payload()` no
// incluye `next_due_date` —queda afuera del sello a propósito, porque cambia
// por diseño— así que la constancia tampoco lo muestra. Ponerlo al lado del
// hash invitaría a creer que está sellado.
const { JSDOM } = require('./jsdom');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(nombre, ok, detalle) {
  if (ok) { pass++; console.log('PASS  ' + nombre); }
  else { fail++; console.log('FAIL  ' + nombre + (detalle ? '  ' + detalle : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · Abrir e imprimir, en un solo lugar ─────────────────────────────────
//
// Estaba copiado SEIS veces y ésta habría sido la séptima. El guardián es la
// regla, no el conteo de llamadas: lo que no puede volver a pasar es que haya
// un segundo `window.open` con su propio manejo de ventana bloqueada.
chk('sólo UN lugar abre una ventana para imprimir',
    (html.match(/window\.open\('', '_blank'\)/g) || []).length === 1,
    (html.match(/window\.open\('', '_blank'\)/g) || []).length + ' lugares');

chk('y está dentro de abrirParaImprimir',
    /function abrirParaImprimir\(html, avisarQueEstaBloqueado\) \{[\s\S]{0,200}window\.open/.test(html));

chk('las seis exportaciones que ya existían pasan por ahí',
    (html.match(/abrirParaImprimir\(/g) || []).length >= 7,
    (html.match(/abrirParaImprimir\(/g) || []).length + ' menciones (1 declaración + llamadas)');

// Las tres formas de avisar que el navegador bloqueó la ventana siguen siendo
// tres: un alert, un modal y un cartel en pantalla. Son pieles legítimas de la
// misma regla y se quedan en quien llama — mismo patrón que filaDeService.
chk('cómo se avisa la ventana bloqueada sigue decidiéndolo quien llama',
    /abrirParaImprimir\(html, \(\) => alert\(/.test(html) &&
    /if \(!abrirParaImprimir\(html\)\) \{ await showAlertModal/.test(html) &&
    /if \(!abrirParaImprimir\(html\)\) \{\s*\n\s*feedback\.textContent/.test(html));

// ─── 2 · La constancia ──────────────────────────────────────────────────────

chk('la constancia se arma en una sola función',
    (html.match(/function constanciaDeService\(/g) || []).length === 1);

chk('se relee del servidor en vez de usar la fila dibujada',
    /from\('maintenance_logs'\)[\s\S]{0,160}\.eq\('id', id\)\.single\(\)/.test(html),
    'una constancia dice lo que la base dice hoy');

// ─── 3 · El comportamiento ──────────────────────────────────────────────────

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
  "setRol:(r)=>{currentUserRole=r;}," +
  "cert:(l,o)=>constanciaDeService(l,o)," +
  "fila:(l,o)=>filaDeService(l,o)," +
  "t:(k)=>t(k)};";
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 220) : '');

try {
const T = window.__t;
T.setIdioma('es'); T.setRol('owner');

const sellado = {
  id: 'ml-1', title: 'Cambio de filtro de aire', description: 'Filtro primario reemplazado',
  parts_used: 'Filtro K24', cost: 120, currency: 'USD',
  performed_by: 'Juanma', performed_date: '2026-10-10',
  next_due_date: '2027-04-10',
  sealed_at: '2026-10-14T11:02:00Z', sealed_by: 'st-1',
  document_id: 'SVC-20261014-A1B2C3D4',
  content_hash: 'c0ffee1234567890abcdefc0ffee1234567890abcdefc0ffee1234567890abcd'
};
const hoja = T.cert(sellado, { contexto: 'Compresor Bauer', selladoPor: 'Franco' });

chk('la hoja lleva el identificador del documento',
    hoja.includes('SVC-20261014-A1B2C3D4'));
chk('y la huella completa', hoja.includes(sellado.content_hash));
chk('con los datos del trabajo',
    hoja.includes('Cambio de filtro de aire') && hoja.includes('Filtro K24') &&
    hoja.includes('Juanma') && hoja.includes('Compresor Bauer'));
chk('y quién lo selló', hoja.includes('Franco'));

// LA comprobación que importa. `next_due_date` no está en el payload canónico,
// así que no puede aparecer en una hoja que dice «sellado».
chk('NO muestra la próxima fecha de service',
    !hoja.includes('2027-04-10') && !/2027/.test(hoja),
    'queda afuera del sello porque cambia por diseño');
chk('y lo explica, en vez de callarlo',
    /no está cubierta por el sello/.test(hoja),
    'una ausencia sin explicar se lee como un olvido');

chk('el texto dice qué prueba la huella',
    /recalcular la huella/.test(hoja) && /cualquier diferencia es en sí misma la prueba/.test(hoja));

// Lo que escribe el centro va escapado: el título de un service es texto libre.
const malicioso = { ...sellado, title: '<img src=x onerror=alert(1)>' };
chk('lo que escribe el centro va escapado',
    !T.cert(malicioso, {}).includes('<img src=x'),
    'el título de un service lo escribe una persona');

// ── El botón sólo donde corresponde
const filaSellada = T.fila(sellado, {});
chk('una fila sellada ofrece la constancia',
    /imprimirConstanciaDeService\('ml-1'\)/.test(filaSellada));
const borrador = { ...sellado, sealed_at: null, document_id: null, content_hash: null };
chk('y un borrador NO la ofrece',
    !/imprimirConstanciaDeService/.test(T.fila(borrador, {})),
    'una constancia de un borrador afirmaría algo que no es cierto');
chk('el borrador sigue ofreciendo sellar y quitar',
    /sellarService\(/.test(T.fila(borrador, {})) && /deleteMaintenanceLog\(/.test(T.fila(borrador, {})));

// ── Los textos, en los dos idiomas
chk('la constancia está en castellano', T.t('svc_cert_btn') === 'Constancia', T.t('svc_cert_btn'));
T.setIdioma('en');
chk('y en inglés', T.t('svc_cert_btn') === 'Certificate', T.t('svc_cert_btn'));
chk('el aviso de «todavía no sellado» existe en inglés',
    /not been sealed yet/.test(T.t('svc_cert_not_sealed')));
T.setIdioma('es');

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
