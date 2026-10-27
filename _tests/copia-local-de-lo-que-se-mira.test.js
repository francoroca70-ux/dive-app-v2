// La copia local: que haya algo que mostrar sin señal, y que se diga que es
// una copia. Corre el index.html real en jsdom.
//
//   node _tests/run-all.js      (preferido)
//
// POR QUÉ EXISTE. El 26/10 Fran abrió la app sin señal desde el binario
// (TestFlight 203001): logueado, app cerrada del todo, wifi y datos apagados.
// La app ABRIÓ —los archivos están en el paquete, eso cerró la mitad del
// 14/10— y adentro no había nada: calendario sin salidas, «Aún no hay
// tripulación», su propio usuario como un «?».
//
// El arreglo de esa misma noche (B) hizo que la app dijera la verdad —«no se
// pudo cargar»— en vez de mentir —«no hay nada»—. Esto es la otra mitad: que
// haya algo que mostrar.
//
// EL PATRÓN NO ES NUEVO, y eso es lo que lo abarata. `loadSignerStaff()` lo
// hace desde el 21/10, encontrado por Fran probando modo avión: lee, guarda las
// filas crudas, y si la lectura falla usa la copia. Acá esa regla —que vivía
// escrita a mano en una función— se saca a `leerConCopiaLocal()` y se aplica a
// las dos lecturas que un barco necesita.
//
// LO QUE ESTE ARCHIVO TIENE QUE PROBAR, y es la regla 8 de CLAUDE.md:
// el interruptor en las DOS posiciones, y que **cambiarlo cambia el
// comportamiento**. La etapa 3a tuvo tres días un interruptor que no cambiaba
// nada con la suite entera en verde, porque los tests sólo miraban que
// existiera.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');

const P = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(P, 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/' });
const { window } = dom;

// La base: devuelve filas, o falla, según se le pida.
let filasDeLaBase = null, errorDeLaBase = null, lecturas = 0;
function tabla() {
  const h = { get(t, prop) {
    if (prop === 'then') return (res, rej) => {
      lecturas++;
      if (errorDeLaBase) return Promise.resolve({ data: null, error: errorDeLaBase }).then(res, rej);
      return Promise.resolve({ data: filasDeLaBase, error: null }).then(res, rej);
    };
    return () => new Proxy({}, h);
  } };
  return new Proxy({}, h);
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: null } }),
          getUser: async () => ({ data: { user: { id: 'u-ana' } } }),
          onAuthStateChange: () => ({ data: { subscription: {} } }) },
  from: () => tabla(), functions: { invoke: async () => ({}) } }) };
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts.find(s => s.includes('[Seven Seas] build'));
const hook = main + `
;window.__t = {
  setOrg: (id) => { currentOrgId = id; },
  copia: (v) => { COPIA_LOCAL = v; },
  verCopia: () => COPIA_LOCAL,
  idioma: (l) => { currentLanguage = l; },
  leer: (o) => leerConCopiaLocal(o),
  guardar: (n, d) => cacheLocalGuardar(n, d),
  leerCache: (n) => cacheLocalLeer(n),
  leerCacheConFecha: (n) => cacheLocalLeerConFecha(n),
  clave: (n) => cacheLocalClave(n),
  linea: (g) => lineaDeCopiaLocal(g)
};`;
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 300) : '');

(async () => { try {

window.__t.setOrg('org-1');
window.__t.idioma('es');

// ─── 1 · El interruptor, ahora PRENDIDO ─────────────────────────────────────
//
// Esto afirmaba que arrancaba en `'apagado'`, y era correcto mientras el camino
// estaba construido y desconectado. Fran lo prendió el 27/10 —decisión suya,
// como pide la regla 8— así que ahora afirma lo contrario, y lo que cuida es
// que **apagarlo siga funcionando**: la vuelta atrás es esa sola línea y tiene
// que seguir siendo verdad. Es el mismo movimiento que hizo
// `plantillas-tres-capas.test.js` cuando la 3b prendió `FUENTE_PLANTILLAS`.
chk('el interruptor está PRENDIDO (lo prendió Fran el 27/10)',
  window.__t.verCopia() === 'encendido', window.__t.verCopia());

// ─── 2 · Una lectura que sale bien guarda la copia, siempre ─────────────────
const FILAS = [{ id: 't-1', trip_name: 'Island Hopping' }, { id: 't-2', trip_name: 'Sunset Cruise' }];

window.__t.copia('apagado');
filasDeLaBase = FILAS; errorDeLaBase = null;
let r = await window.__t.leer({ nombre: 'prueba_salidas', leer: () => tabla() });
chk('con la base respondiendo, devuelve las filas de la base', r.filas.length === 2, JSON.stringify(r.filas).slice(0, 80));
chk('y no las marca como copia', r.deCopia === false);
chk('y la copia quedó guardada aunque el interruptor esté apagado',
  (window.__t.leerCache('prueba_salidas') || []).length === 2,
  'guardar siempre: si sólo se guardara con el interruptor prendido, el día que Fran lo prenda no habría ninguna copia todavía');

// ─── 3 · APAGADO: una lectura que falla deja la lista vacía ─────────────────
errorDeLaBase = { message: 'Load failed' };
r = await window.__t.leer({ nombre: 'prueba_salidas', leer: () => tabla() });
chk('APAGADO · la lectura que falla devuelve cero filas', r.filas.length === 0, JSON.stringify(r.filas));
chk('APAGADO · devuelve el error para que la pantalla lo diga', !!r.error);
chk('APAGADO · no dice que sea una copia', r.deCopia === false);

// ─── 4 · ENCENDIDO: la misma lectura fallida ahora muestra la copia ─────────
//
// ESTA es la comprobación que la 3a no tenía: el mismo llamado, el mismo
// fallo, y lo ÚNICO que cambia es la línea del interruptor.
window.__t.copia('encendido');
const r2 = await window.__t.leer({ nombre: 'prueba_salidas', leer: () => tabla() });
chk('ENCENDIDO · la misma lectura fallida devuelve la copia', r2.filas.length === 2,
  JSON.stringify(r2.filas).slice(0, 80));
chk('ENCENDIDO · la marca como copia', r2.deCopia === true);
chk('ENCENDIDO · dice de cuándo es', typeof r2.guardado === 'number' && r2.guardado > 0, String(r2.guardado));
chk('ENCENDIDO · igual devuelve el error, porque la red falló',
  !!r2.error, 'quien dibuja necesita saberlo para no ofrecer acciones que piden servidor');

chk('CAMBIAR EL INTERRUPTOR CAMBIA EL COMPORTAMIENTO',
  r.filas.length === 0 && r2.filas.length === 2,
  'mismo llamado, mismo fallo, distinto resultado — esto es lo que la 3a no afirmaba');

// ─── 5 · El vacío de un fallo NO se guarda nunca ────────────────────────────
//
// El error que `loadSignerStaff()` tenía escondido debajo hasta el 21/10:
// cachear el `[]` de un error lo volvía permanente, y un corte de un segundo
// dejaba la app sin poder firmar hasta recargarla.
window.__t.guardar('prueba_buena', [{ id: 'x' }]);
errorDeLaBase = { message: 'Load failed' };
await window.__t.leer({ nombre: 'prueba_buena', leer: () => tabla() });
chk('un fallo no pisa la copia buena con un vacío',
  (window.__t.leerCache('prueba_buena') || []).length === 1,
  JSON.stringify(window.__t.leerCache('prueba_buena')));

// ─── 6 · Cero filas de verdad SÍ se guardan ─────────────────────────────────
//
// Un centro que dio de baja a todos tiene cero tripulantes, y eso es un dato.
// Confundirlo con un fallo dejaría mostrando para siempre una copia vieja de
// gente que ya no trabaja ahí.
errorDeLaBase = null; filasDeLaBase = [];
await window.__t.leer({ nombre: 'prueba_buena', leer: () => tabla() });
chk('un cero verdadero sí pisa la copia',
  (window.__t.leerCache('prueba_buena') || []).length === 0,
  JSON.stringify(window.__t.leerCache('prueba_buena')));

// ─── 7 · Sin copia guardada no se inventa nada ──────────────────────────────
window.__t.copia('encendido');
errorDeLaBase = { message: 'Load failed' };
const r3 = await window.__t.leer({ nombre: 'nunca_se_guardo', leer: () => tabla() });
chk('sin copia, devuelve vacío y el error', r3.filas.length === 0 && !!r3.error);
chk('y no se declara copia', r3.deCopia === false);

// ─── 8 · La clave lleva el centro ───────────────────────────────────────────
//
// Un navegador puede tener varias cuentas guardadas. Sin el centro en la clave,
// un tripulante que cambia de centro vería offline los datos del otro.
const claveA = window.__t.clave('x');
window.__t.setOrg('org-2');
const claveB = window.__t.clave('x');
chk('la clave de caché cambia con el centro', claveA !== claveB, claveA + ' vs ' + claveB);
window.__t.setOrg('org-1');

// ─── 9 · La copia SIEMPRE se dice, y con fecha ──────────────────────────────
//
// Una copia sin etiqueta es peor que no tener copia: se lee como el dato de
// hoy. Y la fecha va completa, no «hace 3 horas» — en un barco la pregunta no
// es cuánto pasó, es si esto es de antes o después de que salieran.
const linea = window.__t.linea(Date.parse('2026-10-26T19:42:00'));
chk('la línea nombra que es una copia', /[Cc]opia/.test(linea), linea);
chk('la línea dice la fecha y la hora', /\d{2}.*\d{2}:\d{2}/.test(linea), linea);
const sinFecha = window.__t.linea(null);
chk('sin fecha guardada no inventa una', !/\d{2}:\d{2}/.test(sinFecha), sinFecha);

// ─── 10 · El aviso se traduce ───────────────────────────────────────────────
window.__t.idioma('en');
const lineaEn = window.__t.linea(Date.parse('2026-10-26T19:42:00'));
chk('el aviso cambia de idioma', lineaEn !== linea, lineaEn + ' / ' + linea);
window.__t.idioma('es');

// ─── 11 · El interruptor vive en UN solo lugar ──────────────────────────────
//
// `plantillas-tres-capas.test.js` exige lo mismo de `FUENTE_PLANTILLAS`: una
// tercera aparición y dejó de ser interruptor. Se cuenta sobre CÓDIGO, no sobre
// texto — contar menciones ya falló siete veces acá, la última ese mismo día
// por un comentario mío.
const codigo = html.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const apariciones = (codigo.match(/COPIA_LOCAL/g) || []).length;
chk('COPIA_LOCAL aparece exactamente dos veces en el código',
  apariciones === 2, 'veces: ' + apariciones + ' (la declaración y la comparación)');

// ─── 12 · La copia es para MIRAR, nunca para firmar ─────────────────────────
//
// Medido el 26/10: `opcionesDeFirmante()` sale de `tripulacionConocida()`, que
// tiene su PROPIA copia (`tripulacion`) filtrada por `active`. La planilla de
// la pantalla de tripulación trae todo, archivados incluidos, y se guarda con
// otro nombre (`tripulacion_planilla`) a propósito: si alimentara al selector
// se podría firmar como alguien que ya no trabaja ahí, que es justo el agujero
// que el 09/10 vino a cerrar.
chk('la planilla y la lista de firmantes son dos copias con nombres distintos',
  html.includes("'tripulacion_planilla'") && html.includes("function nombreEnCacheDeTripulacion() { return 'tripulacion'; }"));
chk('el selector de firmantes sigue saliendo de tripulacionConocida()',
  /function opcionesDeFirmante\([\s\S]{0,200}tripulacionConocida\(\)/.test(html));

// ─── 13 · La copia de las salidas lleva el día en la clave ──────────────────
//
// Una copia de ayer mostrada como «las salidas de hoy» es la mentira exacta que
// esto viene a evitar, con la cara de un dato correcto.
chk('la clave de las salidas incluye la fecha',
  /nombre: 'salidas_' \+ today/.test(html));

console.log('\n' + pass + ' pasaron, ' + fail + ' fallaron');
process.exit(fail ? 1 : 0);

} catch (e) { console.log('FAIL  excepción: ' + (e && e.stack || e)); process.exit(1); } })();
