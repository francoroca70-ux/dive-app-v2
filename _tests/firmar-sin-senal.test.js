// Sin señal se puede firmar: la tripulación tiene copia local.
//
//   node _tests/firmar-sin-senal.test.js
//
// Lo encontró Fran el 21/10 probando la app **empaquetada** en un iPhone, con el
// modo avión puesto — la primera vez que se probó así, y justo la prueba que la
// suite no podía hacer: en jsdom, con un stub de Supabase, la consulta «anda»
// siempre.
//
// Lo que vio: la checklist se abría, se podía tildar, los tildes sobrevivían
// salir y volver, y **al firmar el selector de firmante estaba vacío**. El botón
// exige elegir a alguien, así que no se podía firmar. Y los tildes no mostraban
// el nombre de quien los hizo.
//
// **Una sola causa para los dos síntomas**: todo lo que traduce un id de persona
// a un nombre sale de `loadSignerStaff()`, que lee de la base. Sin red no trae
// nada, así que el selector no tenía a quién ofrecer — ni siquiera al dueño de la
// sesión, porque su id también se descarta cuando no se lo puede nombrar.
//
// Es el mismo agujero que las listas de preparación tenían antes de la etapa 3a,
// y se tapa igual: **copia local con las filas crudas.**
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');

const P = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(P, 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/' });
const { window } = dom;

// La consulta de `staff` se puede hacer fallar, que es el caso que nadie podía
// probar: sin red, PostgREST no contesta y `data` viene vacío.
let staffFalla = false;
let filasDeStaff = [];
function tabla(nombre) {
  const h = { get(t, p) {
    if (p === 'then') {
      return (res) => {
        if (nombre === 'staff' && staffFalla) {
          return Promise.resolve({ data: null,
            error: { message: 'TypeError: Failed to fetch' } }).then(res);
        }
        return Promise.resolve({ data: nombre === 'staff' ? filasDeStaff : [],
                                 error: null }).then(res);
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
  yo:(id)=>{currentUserId=id;},
  memoria:(xs)=>{signerStaffCache=xs;},
  verMemoria:()=>signerStaffCache,
  cargar:()=>loadSignerStaff(),
  conocida:()=>tripulacionConocida(),
  opciones:(a)=>opcionesDeFirmante(a),
  nombre:(id)=>nombreDeTripulante(id),
  guardarCopia:(xs)=>cacheLocalGuardar(nombreEnCacheDeTripulacion(),xs),
  borrarCopia:()=>cacheLocalBorrar(nombreEnCacheDeTripulacion()),
  leerCopia:()=>cacheLocalLeer(nombreEnCacheDeTripulacion())
};`;
let boot = null; try { window.eval(hook); } catch (e) { boot = e; }

let pass = 0, fail = 0;
function chk(n, ok, x) {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); }
}
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 300) : '');
if (boot) process.exit(1);

const T = window.__t;
const TRIPULACION = [
  { id: 'u-fran',   full_name: 'Franco', role: 'owner',   custom_role_name: null },
  { id: 'u-juanma', full_name: 'Juanma', role: 'captain', custom_role_name: null }
];

(async () => {
  // ─── 1 · Un solo lugar traduce un id a una persona ────────────────────────
  //
  // El guardián que importa. Si un cuarto lugar vuelve a leer
  // `signerStaffCache` a mano, la copia local no lo cubre y el agujero
  // reaparece justo ahí — sin señal, que es cuando nadie lo está mirando.
  const lineas = html.split('\n');
  const crudos = lineas
    .map((l, i) => ({ l: l.trim(), n: i + 1 }))
    .filter(x => x.l.includes('signerStaffCache')
              && !x.l.startsWith('//')
              && !x.l.startsWith('*')
              && !x.l.startsWith('let signerStaffCache')
              && !x.l.startsWith('function clearSignerStaffCache'));
  // Los que queden tienen que vivir dentro de loadSignerStaff() o de
  // tripulacionConocida(), más el hook de este test.
  const dentroDeSuDuenio = crudos.filter(x => {
    const antes = lineas.slice(0, x.n).join('\n');
    const inicio = Math.max(antes.lastIndexOf('async function loadSignerStaff'),
                            antes.lastIndexOf('function tripulacionConocida'));
    if (inicio === -1) return false;
    return !/\n(async )?function /.test(antes.slice(inicio + 20));
  });
  chk('nadie lee signerStaffCache fuera de su dueño',
      crudos.length === dentroDeSuDuenio.length,
      crudos.filter(x => !dentroDeSuDuenio.includes(x))
            .map(x => `línea ${x.n}: ${x.l.slice(0, 60)}`).join(' | '));
  chk('y se revisó más de una línea', crudos.length >= 3, `${crudos.length} líneas`);

  // ─── 2 · Con señal: se lee y queda copia local ────────────────────────────
  T.org('org-1');
  T.yo('u-fran');
  T.borrarCopia();
  T.memoria(null);
  staffFalla = false;
  filasDeStaff = TRIPULACION;

  const conRed = await T.cargar();
  chk('con señal trae la tripulación', conRed.length === 2, String(conRed.length));
  chk('y deja copia local', (T.leerCopia() || []).length === 2,
      JSON.stringify(T.leerCopia() || []).slice(0, 80));

  // ─── 3 · Sin señal: la copia local sostiene el selector ───────────────────
  //
  // Esto es el modo avión de Fran: la app arrancó del binario, la variable en
  // memoria está vacía porque nunca hubo una lectura buena en esta sesión.
  T.memoria(null);
  staffFalla = true;

  const sinRed = await T.cargar();
  chk('sin señal devuelve la copia local y no un vacío',
      sinRed.length === 2, String(sinRed.length));
  chk('y NO guarda esa copia en la variable en memoria',
      T.verMemoria() === null, String(T.verMemoria()));

  const opciones = T.opciones({ '0': { id: 'u-juanma', name: 'Juanma' } });
  chk('sin señal el selector NO sale vacío', /<option value="u-/.test(opciones),
      opciones.slice(0, 140));
  chk('ofrece al dueño de la sesión', opciones.includes('value="u-fran"'));
  chk('y a quien tildó', opciones.includes('value="u-juanma"'));
  chk('con el nombre y no el uuid',
      opciones.includes('Franco') && opciones.includes('Juanma'));
  chk('el dueño de la sesión viene preseleccionado',
      /value="u-fran" selected/.test(opciones));
  chk('un tilde sin señal muestra el nombre de quien lo hizo',
      T.nombre('u-juanma') === 'Juanma', T.nombre('u-juanma'));

  // ─── 4 · Un fallo NO envenena la caché ────────────────────────────────────
  //
  // El bug que estaba escondido debajo: `signerStaffCache = data || []` guardaba
  // el vacío de un error, y el `if (signerStaffCache)` del principio lo
  // devolvía para siempre. **Un corte de un segundo al abrir dejaba la app sin
  // poder firmar hasta recargarla, con señal o sin ella.**
  staffFalla = false;
  const alVolver = await T.cargar();
  chk('al volver la señal se vuelve a leer de la base',
      alVolver.length === 2 && (T.verMemoria() || []).length === 2,
      `devolvió ${alVolver.length}, memoria ${(T.verMemoria() || []).length}`);

  // ─── 5 · Sin copia y sin señal: no se inventa nada ────────────────────────
  //
  // Caso real pero raro: primera vez que se abre la app para esta organización y
  // justo sin red. No hay forma honesta de nombrar a nadie, así que el selector
  // queda sin opciones — pero no explota, y no inventa un nombre vacío, que
  // sería peor porque un acta se queda con él para siempre.
  T.memoria(null);
  T.borrarCopia();
  staffFalla = true;
  const vacio = T.opciones(null);
  chk('sin copia ni señal no explota', typeof vacio === 'string');
  chk('y no ofrece a nadie con el nombre vacío',
      !/<option value="u-fran"[^>]*>\s*(—|<)/.test(vacio), vacio.slice(0, 140));

  console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
  process.exit(fail);
})();
