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
    /function abrirParaImprimir\(html\) \{[\s\S]{0,600}window\.open/.test(html));

chk('las seis exportaciones que ya existían pasan por ahí',
    (html.match(/abrirParaImprimir\(/g) || []).length >= 7,
    (html.match(/abrirParaImprimir\(/g) || []).length + ' menciones (1 declaración + llamadas)');

// **Cambió el 21/10 y esta aserción cambió con él.** Antes decía que cada lugar
// decidía *cómo avisar Y qué decir*, y los tres textos eran variantes de
// «permití las ventanas emergentes» — mentira en la app instalada, donde no hay
// ningún bloqueador que permitir.
//
// Ahora la división es más fina y es la correcta: **la superficie sigue siendo
// de quien llama** (un modal o un cartel al lado del botón, que son sitios
// legítimamente distintos) y **el motivo sale de un solo lugar**. Lo que ya no
// existe es el `alert()` del navegador, que era la tercera piel y la peor.
// Detalle en `_tests/imprimir-en-nativo.test.js`.
chk('la superficie del aviso sigue siendo de quien llama',
    /if \(noSePudo\) await showAlertModal\(motivoDeNoPoderImprimir/.test(html) &&
    /feedback\.textContent = motivoDeNoPoderImprimir\(noSePudo\)/.test(html));
chk('pero el motivo ya no lo arma cada uno',
    !/abrirParaImprimir\(html, /.test(html) && !/alert\(t\('mf_popup_blocked'\)\)/.test(html));

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

// ─── LA COMPROBACIÓN DEL SELLO, agregada el 26/10 ──────────────────────────
//
// Hasta hoy la hoja decía textual que «recalcular la huella sobre el registro
// guardado tiene que dar el mismo valor, y cualquier diferencia es en sí misma
// la prueba» — y **nadie la recalculaba**. Existían `verify_waivers` y
// `verify_waiver` para los formularios y el equivalente del service no.
//
// Un documento que describe una verificación que el sistema no hace es la misma
// forma que el cartel que mandaba a permitir ventanas emergentes en la app
// instalada. La diferencia es que esta hoja es la que mira un seguro.
//
// Los tres estados son TRES, no dos, y esa es la parte que importa:
// `undefined` es «no se preguntó» y `false` es «se preguntó y no coincide».
const conOk    = T.cert(sellado, { verificado: true });
const conMal   = T.cert(sellado, { verificado: false });
const sinPregun = T.cert(sellado, {});

chk('verificado: la hoja lo dice, con fecha y hora',
    /chk ok/.test(conOk) && /comprobado contra el registro guardado/.test(conOk),
    'la hoja afirma que A ESTA FECHA el sello coincidía');
chk('no coincide: la hoja lo grita, no lo esconde',
    /chk mal/.test(conMal) && /ATENCIÓN/.test(conMal) && /cambió desde que se selló/.test(conMal));
chk('no se pudo preguntar: la hoja lo dice y no afirma de más',
    /chk gris/.test(sinPregun) && /No se pudo volver a comprobar/.test(sinPregun),
    'callarlo sería afirmar una verificación que no se hizo');

// Y las tres son distintas entre sí: si dos coincidieran, uno de los estados
// no se estaría mostrando.
chk('los tres estados producen tres hojas distintas',
    conOk !== conMal && conMal !== sinPregun && conOk !== sinPregun);
chk('y «no coincide» no se puede confundir con «verificado»',
    !/chk ok/.test(conMal) && !/chk ok/.test(sinPregun));

// La hoja se emite igual sin señal. Un certificado que no sale porque no hubo
// conexión no le sirve a nadie.
chk('la constancia se emite aunque la comprobación falle',
    sinPregun.includes(sellado.content_hash) && /SHA-256/.test(sinPregun));

// Se pregunta al EMITIR, no al sellar: en el momento del sellado la huella
// acaba de calcularse y comprobarla no probaría nada.
chk('se consulta al emitir la constancia, una sola vez',
    (html.match(/sb\.rpc\('verify_maintenance_logs'/g) || []).length === 1);
chk('y la respuesta viaja a la hoja',
    /constanciaDeService\(l, \{[\s\S]{0,120}verificado[\s\S]{0,20}\}\)/.test(html));
// Lo que NO se puede probar acá: que la función de Postgres detecte una
// alteración. Eso se midió contra la base real el 26/10 en una transacción
// revertida — cambiarle el costo al único service sellado hizo que `intact`
// pasara de true a false. jsdom no sabe nada de SHA-256 ni de triggers.
chk('los tres textos están en los dos idiomas',
    /svc_cert_checked/.test(html) && /svc_cert_broken/.test(html) && /svc_cert_unchecked/.test(html) &&
    (html.match(/svc_cert_checked:/g) || []).length === 2 &&
    (html.match(/svc_cert_broken:/g) || []).length === 2 &&
    (html.match(/svc_cert_unchecked:/g) || []).length === 2);

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
