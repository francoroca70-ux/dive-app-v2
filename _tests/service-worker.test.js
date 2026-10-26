// El service worker cachea lo que puede, no todo-o-nada.
//
//   node _tests/run-all.js      (preferido)
//
// EL BUG, encontrado el 26/10 a partir de una captura de Juanma: la app
// instalada en su Android, sin datos y sin wifi, mostraba el fondo de la app y
// **el logo roto**. Esa pantalla dice más de lo que parece — el HTML cargó y lo
// que faltó fue una imagen, así que no era «la app no abre»: era «la caché
// estaba vacía».
//
// Por qué estaba vacía:
//
//     caches.open(V).then(c => c.addAll(APP_SHELL)).catch(() => {
//       // Don't let a single missing asset block install — cache what we can.
//     })
//
// `addAll` es **atómico**: si una sola de las 19 URLs falla, no se guarda
// ninguna. El `catch` vacío se tragaba el rechazo, así que el install terminaba
// «bien» con cero archivos y sin una línea en la consola. Y el `activate` ya
// había borrado la caché de la versión anterior.
//
// El comentario prometía exactamente lo contrario de lo que el código hacía, y
// eso es lo que hizo que nadie lo mirara en dos meses.
//
// Y había un segundo agujero que garantizaba la falla en la app instalada:
// `/landing.html` está en el APP_SHELL y `build-www.js` **no la copiaba al
// paquete**. Un 404 seguro en cada arranque, que con `addAll` se llevaba puesto
// todo lo demás.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

const RAIZ = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const buildWww = fs.readFileSync(path.join(RAIZ, 'scripts', 'build-www.js'), 'utf8');

// ─── 1 · Las dos listas tienen que coincidir ────────────────────────────────
//
// El APP_SHELL es lo que el service worker promete tener offline. `build-www`
// es lo que de verdad viaja dentro del binario. Que no coincidan es el defecto,
// y es invisible: no hay error de build, no hay error en el arranque.
const shell = [...sw.matchAll(/^\s*'(\/[^']*)',?\s*$/gm)].map(m => m[1]);
chk('se puede leer el APP_SHELL del service worker', shell.length > 10, shell.length + ' entradas');

const copiados = (buildWww.match(/const FILES = \[([^\]]*)\]/) || [])[1] || '';
const dirs = (buildWww.match(/const DIRS = \[([^\]]*)\]/) || [])[1] || '';
const faltantes = shell.filter((u) => {
  if (u === '/') return false;                              // la raíz es index.html
  const rel = u.slice(1);
  if (dirs.includes("'" + rel.split('/')[0] + "'")) return false;  // viene en un directorio
  return !copiados.includes("'" + rel + "'");
});
chk('todo lo que el APP_SHELL promete viaja al binario',
    faltantes.length === 0, faltantes.join(', '));
chk('y landing.html está entre lo copiado, que era el agujero',
    /'landing\.html'/.test(copiados),
    'estaba en el APP_SHELL y no en el paquete: 404 garantizado en cada arranque');

// Y que el archivo exista de verdad, no sólo que esté nombrado.
for (const f of ['index.html', 'landing.html', 'sw.js', 'manifest.json']) {
  chk('existe ' + f + ' en la raíz del repo', fs.existsSync(path.join(RAIZ, f)));
}

// ─── 1b · Y el workflow tiene que construir cuando esto cambia ──────────────
//
// Un archivo que decide qué entra al binario, y que no dispara una build, es un
// cambio que parece aplicado y no lo está. Ya pasó con `capacitor.config.json`:
// sacar `server.url` —el interruptor de arrancar del binario— no habría
// construido nada.
const wf = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'mobile-build.yml'), 'utf8');
const disparadores = wf.slice(wf.indexOf('paths:'), wf.indexOf('jobs:'));
for (const p of ['sw.js', 'index.html', 'capacitor.config.json', 'scripts/build-www.js', 'landing.html', 'assets/**']) {
  chk('un cambio en ' + p + ' dispara una build', disparadores.includes("'" + p + "'"));
}

// ─── 2 · El install ya no es todo-o-nada ────────────────────────────────────
// Se cuentan líneas de CÓDIGO. El comentario de arriba nombra `addAll` a
// propósito —explica por qué se fue— y la primera versión de esta comprobación
// lo contó como si fuera código. Sexta vez en este proyecto con la misma forma:
// **un comentario que nombra algo no lo usa.**
const lineasDeCodigo = sw.split('\n').filter(l => !l.trim().startsWith('//'));
chk('el install NO usa addAll',
    !lineasDeCodigo.some(l => /addAll\(APP_SHELL\)/.test(l)),
    'addAll es atómico: una URL rota se lleva puestas las otras 18');
chk('cachea una por una', /APP_SHELL\.map\(/.test(sw) && /cache\.put\(url, res\)/.test(sw));
chk('una respuesta de error NO se guarda',
    /if \(!res \|\| !res\.ok\) throw/.test(sw),
    'un 404 cacheado se sirve offline como si fuera el archivo');
chk('y lo que falla se dice en voz alta, no se traga',
    /console\.warn\('\[sw\]/.test(sw),
    'el modo de falla anterior era el silencio');
// El guardián contra la vuelta atrás: un `catch` vacío es lo que escondió esto
// durante dos meses.
chk('no queda ningún catch vacío en el service worker',
    !/catch\s*\(\s*\)\s*\{\s*\n?\s*(\/\/[^\n]*\n\s*)*\}/.test(sw) &&
    !/\.catch\(\(\) => \{\s*\}\)/.test(sw),
    'un error tragado es un bug que no se puede encontrar');

// ─── 3 · La caché se recupera sola ──────────────────────────────────────────
chk('lo que se trae por red queda guardado',
    /cache\.put\(req, copia\)/.test(sw),
    'antes era `cached || fetch(req)`: devolvía la respuesta y la tiraba');
chk('y sólo se guarda una respuesta buena',
    /if \(res && res\.ok\) \{[\s\S]{0,160}cache\.put\(req, copia\)/.test(sw));

// ─── 4 · Lo que NO cambió, y tiene que seguir así ───────────────────────────
//
// El HTML nunca sale de la caché habiendo red. Esa regla costó dos días de
// Fran recibiendo una versión vieja sin forma de enterarse, y este cambio no
// la toca.
chk('el HTML sigue siendo network-first',
    /El HTML NUNCA sale de la caché mientras haya red/.test(sw));
chk('y sólo los estáticos son cache-first',
    /Cache-first sólo para estáticos de verdad/.test(sw));
chk('los pedidos que no son GET del mismo origen siguen pasando de largo',
    /req\.method !== 'GET' \|\| new URL\(req\.url\)\.origin !== self\.location\.origin/.test(sw),
    'Supabase y la cola offline no se tocan');
chk('el activate sigue borrando las cachés viejas',
    /keys\.filter\(\(k\) => k !== CACHE_VERSION\)\.map\(\(k\) => caches\.delete\(k\)\)/.test(sw));

// ─── 5 · El comportamiento, con un fetch que falla ─────────────────────────
//
// Se corre el install de verdad con stubs: una de las URLs tira, y las otras
// tienen que entrar igual. Es la comprobación que el bug no pasaba.
const guardadas = new Map();
const cacheFalso = {
  put: async (k, v) => { guardadas.set(typeof k === 'string' ? k : k.url, v); },
  addAll: async () => { throw new Error('no debería usarse'); }
};
const oyentes = {};
const avisos = [];
const sandbox = {
  self: {
    addEventListener: (ev, fn) => { oyentes[ev] = fn; },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    location: { origin: 'https://localhost' }
  },
  caches: { open: async () => cacheFalso, keys: async () => [], delete: async () => true },
  console: { warn: (m) => avisos.push(m), info: () => {}, error: () => {} },
  // La tercera URL del shell falla; el resto contesta bien.
  fetch: async (url) => {
    if (String(url).includes('landing')) throw new Error('falla a propósito');
    return { ok: true, status: 200, clone: () => ({}) };
  },
  URL, Promise, Error, String
};
sandbox.self.self = sandbox.self;

let arranco = true;
try {
  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'console', 'fetch', 'URL', sw)(
    sandbox.self, sandbox.caches, sandbox.console, sandbox.fetch, URL);
} catch (e) { arranco = false; chk('el service worker evalúa', false, String(e).slice(0, 200)); }

if (arranco) {
  chk('el service worker evalúa y registra sus oyentes',
      typeof oyentes.install === 'function' && typeof oyentes.fetch === 'function');

  (async () => {
    let esperar;
    await oyentes.install({ waitUntil: (p) => { esperar = p; } });
    await esperar;

    chk('con UNA url rota, las demás igual se cachean',
        guardadas.size === shell.length - 1,
        guardadas.size + ' de ' + (shell.length - 1) + ' esperadas');
    chk('la que falló no se guardó',
        ![...guardadas.keys()].some(k => String(k).includes('landing')));
    chk('y se avisó cuál falló, con el motivo',
        avisos.length === 1 && /landing/.test(avisos[0]) && /falla a propósito/.test(avisos[0]),
        avisos.join(' | '));
    // La contracara: con el `addAll` viejo, el resultado habría sido CERO.
    chk('con addAll habrían sido cero — por eso era un bug',
        guardadas.size > 0,
        'una sola falla dejaba la caché entera vacía, en silencio');

    console.log('\n' + pass + ' pass, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
  })();
} else {
  console.log('\n' + pass + ' pass, ' + fail + ' fail');
  process.exit(1);
}
