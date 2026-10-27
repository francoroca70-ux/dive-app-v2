// La sesión que no se pudo verificar: arrancar sin señal en vez de mandar al
// login. Corre el index.html real en jsdom.
//
//   node _tests/run-all.js      (preferido)
//
// EL HALLAZGO, 27/10/2026. Fran abrió la app sin señal y estaba deslogueado;
// al intentar entrar, «load failed». Y la causa se midió **leyendo la librería
// vendorizada**, no la documentación:
//
//   · `_callRefreshToken()` hace `if (!isAuthRetryableFetchError(error))` antes
//     de tocar nada. Un fallo de RED es retryable → entra por ese `if` → **la
//     sesión NO se borra**. Sigue en localStorage.
//   · `__loadSession()` devuelve la sesión guardada **sólo si el access token
//     sigue dentro de su expiración real**. Vencido → `{ session: null }`.
//
// La sesión está y no se devuelve. La app leía «no hay sesión» y mandaba al
// login — y el login sin red tampoco puede. Un instructor arriba del barco se
// quedaba afuera de su propia herramienta.
//
// Anoche yo había afirmado que la librería BORRABA la sesión, deducido de una
// frase de la doc. Era falso, y cambiaba qué había que construir: no hay nada
// que recuperar, hay que dejar de tratar «no se pudo verificar» como «no hay
// sesión».
//
// ESTE ARCHIVO TIENE QUE PROBAR, por la regla 8: el interruptor en las DOS
// posiciones y que **cambiarlo cambia el comportamiento**. La 3a tuvo tres días
// un interruptor que no cambiaba nada con la suite entera en verde.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');

const P = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(P, 'utf8');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

// ─── Estructura: lo que se puede afirmar leyendo el archivo ────────────────

// El interruptor en UN lugar. Se cuenta sobre CÓDIGO: contar menciones ya
// falló ocho veces acá, las dos últimas por comentarios míos.
const codigo = html.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const vecesInterruptor = (codigo.match(/SESION_SIN_VERIFICAR/g) || []).length;
chk('SESION_SIN_VERIFICAR aparece exactamente dos veces en el código',
  vecesInterruptor === 2, 'veces: ' + vecesInterruptor + ' (la declaración y la comparación)');

chk('el interruptor arranca APAGADO en el archivo',
  /const SESION_SIN_VERIFICAR = 'apagado'/.test(html),
  'el default en producción es el camino viejo — prenderlo es decisión de Fran');

chk('hay una ventana máxima declarada',
  /const VENTANA_SIN_VERIFICAR_MS = /.test(html));

// Sólo se rescata cuando se puede AFIRMAR que no hay red. Con red, que el
// refresco falle significa otra cosa (servidor caído, token revocado) y ahí el
// login es la respuesta correcta.
const cuerpoUsable = (html.match(/function sesionSinVerificarUsable\(\)\s*\{[\s\S]*?\n\}/) || [''])[0];
chk('sólo rescata cuando se puede afirmar que no hay red',
  /sinRedSeguro\(\)/.test(cuerpoUsable), cuerpoUsable.slice(0, 200));
chk('y aplica la ventana máxima',
  /VENTANA_SIN_VERIFICAR_MS/.test(cuerpoUsable));

// El agujero peor, y no se ve: con el token vencido el cliente consulta como
// ANÓNIMO, y RLS devuelve CERO FILAS sin error. Una lista vacía sin error es
// exactamente la mentira que el trabajo del 26/10 vino a sacar, por otra puerta.
const manejadorOnline = (html.match(/window\.addEventListener\('online', async \(\) => \{[\s\S]*?\n\}\);/) || [''])[0];
chk('al volver la señal se revalida ANTES de vaciar la cola',
  manejadorOnline.indexOf('revalidarSesion') > -1 &&
  manejadorOnline.indexOf('revalidarSesion') < manejadorOnline.indexOf('flushOfflineQueue'),
  'si se lee antes de revalidar, las consultas salen como anon y RLS devuelve 0 filas SIN error');
chk('y si no se pudo revalidar, no sigue',
  /if \(!\(await revalidarSesion\(\)\)\) return;/.test(manejadorOnline));

// La identidad local va por USUARIO, no por centro: en un arranque sin conexión
// el centro es justamente lo que no sabemos todavía.
chk('la clave de identidad va por usuario, no por centro',
  /function claveDeIdentidad\(userId\)[\s\S]{0,120}\$\{userId\}/.test(html));
chk('la identidad se guarda al final de un arranque verificado',
  /guardarIdentidadLocal\(\);\n\s*updateOfflineBanner\(\);/.test(html));

// Los textos, en los dos diccionarios.
['sesion_sin_verificar', 'sesion_dias', 'sesion_dias_one', 'sesion_revalidando', 'sesion_revalidada']
  .forEach(clave => {
    const veces = (html.match(new RegExp('(^|[\\s{])' + clave + ':', 'gm')) || []).length;
    chk('la clave ' + clave + ' está en los dos diccionarios', veces === 2, 'veces: ' + veces);
  });

// ─── Comportamiento: el index.html real, en jsdom ──────────────────────────

function arrancar({ interruptor, hayRed, sesionGuardada, identidad }) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/' });
  const { window } = dom;

  // jsdom trae `navigator.onLine` en true y de sólo lectura.
  Object.defineProperty(window.navigator, 'onLine', { value: !!hayRed, configurable: true });

  if (sesionGuardada) {
    window.localStorage.setItem('sb-ggtbxjwstkuhnabwpgdz-auth-token', JSON.stringify(sesionGuardada));
  }
  if (identidad) {
    window.localStorage.setItem('ss_identidad_v1_' + identidad.userId, JSON.stringify(identidad));
  }

  window.supabase = { createClient: () => ({
    auth: {
      // ESTO es lo que la librería real hace con el token vencido y sin red:
      // la sesión sigue en el disco, pero getSession() devuelve null.
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      refreshSession: async () => ({ data: null, error: { message: 'Load failed' } }),
      onAuthStateChange: () => ({ data: { subscription: {} } }),
      signOut: async () => ({})
    },
    from: () => { const h = { get(t, p) { if (p === 'then') return (r) => Promise.resolve({ data: [], error: null }).then(r); return () => new Proxy({}, h); } }; return new Proxy({}, h); },
    functions: { invoke: async () => ({}) }
  }) };
  window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
  window.Chart = function () {};

  const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const main = scripts.find(s => s.includes('[Seven Seas] build'));
  const hook = main + `
;window.__t = {
  interruptor: (v) => { try { SESION_SIN_VERIFICAR_TEST(v); } catch(e) {} },
  usable: () => sesionSinVerificarUsable(),
  enDisco: () => sesionGuardadaEnDisco(),
  modo: () => modoSinVerificar,
  arrancarInner: () => initAuthInner()
};`;
  // El interruptor es una constante a propósito (regla 8: un lugar, y un test
  // que lo cuida). Para probar la otra posición se reescribe el texto del
  // script, que es lo mismo que haría Fran cambiando esa línea.
  const conInterruptor = hook.replace(
    "const SESION_SIN_VERIFICAR = 'apagado';",
    "const SESION_SIN_VERIFICAR = '" + interruptor + "';");

  let boot = null;
  try { window.eval(conInterruptor); } catch (e) { boot = e; }
  return { window, boot, dom };
}

const AHORA = Math.floor(Date.now() / 1000);
const SESION_AYER = {
  access_token: 'jwt-vencido', refresh_token: 'rt-vivo',
  expires_at: AHORA - 20 * 60 * 60,            // venció hace 20 horas
  user: { id: 'u-fran' }
};
const SESION_VIEJISIMA = Object.assign({}, SESION_AYER, { expires_at: AHORA - 30 * 24 * 60 * 60 });
const IDENTIDAD = { userId: 'u-fran', orgId: 'org-1', locationId: 'loc-1', role: 'owner', locationIds: ['loc-1'], captainElevated: false };

(async () => { try {

// 0 · Arranca sin excepción con el interruptor en las dos posiciones. Esto es
//     lo que atrapa un `const` usado antes de declararse: parsea igual y
//     revienta recién al correr.
for (const pos of ['apagado', 'encendido']) {
  const { boot } = arrancar({ interruptor: pos, hayRed: false, sesionGuardada: SESION_AYER, identidad: IDENTIDAD });
  chk('arranca sin excepción con el interruptor en ' + pos, !boot, boot ? String(boot).slice(0, 220) : '');
}

// 1 · APAGADO: sin red, con sesión guardada vencida → no se rescata nada.
{
  const { window } = arrancar({ interruptor: 'apagado', hayRed: false, sesionGuardada: SESION_AYER, identidad: IDENTIDAD });
  chk('APAGADO · no rescata la sesión guardada', window.__t.usable() === null);
}

// 2 · ENCENDIDO: la misma situación, y ahora sí.
{
  const { window } = arrancar({ interruptor: 'encendido', hayRed: false, sesionGuardada: SESION_AYER, identidad: IDENTIDAD });
  const u = window.__t.usable();
  chk('ENCENDIDO · rescata la sesión guardada', !!u && u.sesion.user.id === 'u-fran', JSON.stringify(u && u.sesion && u.sesion.user));
  chk('ENCENDIDO · dice hace cuánto venció', !!u && u.vencidaHace > 0);
  chk('CAMBIAR EL INTERRUPTOR CAMBIA EL COMPORTAMIENTO', !!u,
    'misma sesión, misma falta de red, distinto resultado — esto es lo que la 3a no afirmaba');
}

// 3 · ENCENDIDO pero CON red: no se rescata. Con red, que el refresco falle
//     significa otra cosa y el login es la respuesta correcta.
{
  const { window } = arrancar({ interruptor: 'encendido', hayRed: true, sesionGuardada: SESION_AYER, identidad: IDENTIDAD });
  chk('ENCENDIDO · con red NO rescata', window.__t.usable() === null,
    'sólo se puede afirmar la ausencia de red, nunca su presencia');
}

// 4 · Fuera de la ventana: aunque no haya red, se pide iniciar sesión.
//     Es el límite que acota el riesgo de alguien dado de baja.
{
  const { window } = arrancar({ interruptor: 'encendido', hayRed: false, sesionGuardada: SESION_VIEJISIMA, identidad: IDENTIDAD });
  chk('fuera de la ventana NO rescata', window.__t.usable() === null, 'treinta días contra una ventana de siete');
}

// 5 · Sin sesión guardada no se inventa nada.
{
  const { window } = arrancar({ interruptor: 'encendido', hayRed: false, sesionGuardada: null, identidad: IDENTIDAD });
  chk('sin sesión guardada no rescata', window.__t.usable() === null);
  chk('y sesionGuardadaEnDisco devuelve null', window.__t.enDisco() === null);
}

// 6 · Una sesión guardada SIN usuario no sirve: no sabríamos quién es.
{
  const rota = { access_token: 'x', refresh_token: 'y', expires_at: AHORA - 100 };
  const { window } = arrancar({ interruptor: 'encendido', hayRed: false, sesionGuardada: rota, identidad: IDENTIDAD });
  chk('una sesión guardada sin usuario se ignora', window.__t.enDisco() === null);
}

// 7 · Sin identidad local no hay nada que dibujar → login, aunque la sesión
//     sea rescatable. Pasa en un aparato que nunca completó un arranque con
//     señal.
{
  const { window } = arrancar({ interruptor: 'encendido', hayRed: false, sesionGuardada: SESION_AYER, identidad: null });
  chk('la sesión es rescatable…', !!window.__t.usable());
  await window.__t.arrancarInner();
  chk('…pero sin identidad local NO entra en modo sin verificar', window.__t.modo() === false,
    'sin centro ni rol no hay qué dibujar, y mandar al login es lo correcto');
}

// 8 · El camino completo: entra, queda en modo sin verificar y pinta el aviso.
{
  const { window } = arrancar({ interruptor: 'encendido', hayRed: false, sesionGuardada: SESION_AYER, identidad: IDENTIDAD });
  await window.__t.arrancarInner();
  chk('entra en modo sin verificar', window.__t.modo() === true);
  const aviso = window.document.getElementById('aviso-sin-verificar');
  chk('y pinta el aviso permanente', !!aviso && aviso.textContent.length > 20,
    aviso ? aviso.textContent.slice(0, 90) : 'no se dibujó');
  chk('el aviso dice que no hay conexión',
    !!aviso && /[Ss]in conexión|[Nn]o connection/.test(aviso.textContent), aviso && aviso.textContent);
}

console.log('\n' + pass + ' pasaron, ' + fail + ' fallaron');
process.exit(fail ? 1 : 0);

} catch (e) { console.log('FAIL  excepción: ' + (e && e.stack || e)); process.exit(1); } })();
