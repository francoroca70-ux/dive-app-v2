// El arranque no depende de la red.
//
//   node _tests/run-all.js      (preferido)
//
// EL HALLAZGO, 27/10/2026. Fran abrió la app sin señal desde el binario y la
// sesión se había cerrado; al intentar entrar, «load failed». Buscando por qué,
// apareció algo más grande, y medido:
//
//     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">
//     <script src="https://cdn.paddle.com/paddle/v2/paddle.js">
//     <link href="https://fonts.googleapis.com/css2?...">
//
// `build-www.js` copia al binario CUATRO archivos locales más `assets/`. Y el
// `fetch` del service worker, en su primera línea, **ignora a propósito todo lo
// que no sea del mismo origen**. Así que ninguna de esas tres estaba en el
// paquete ni en la caché: sin señal sólo podían salir de la caché HTTP del
// webview, que se vacía sola y que en una instalación nueva está vacía.
//
// O sea: «la app arranca del binario» era verdad para el HTML y falso para la
// librería sin la cual la app no existe. El arreglo del 14/10 estaba a medias y
// nadie lo había notado porque el webview venía tapando el agujero.
//
// Y había un segundo filo: `@2` significa «la última v2 que haya». La librería
// de AUTENTICACIÓN de un producto que además cobra podía cambiar debajo nuestro
// sin que desplegáramos nada.
//
// Este archivo afirma la regla, no una lista: **ningún script que el arranque
// necesite puede venir de otro origen.** Lo que sí puede venir de afuera va en
// la lista de abajo con su motivo escrito al lado.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

// ─── 1 · Qué scripts remotos quedan, y por qué ──────────────────────────────
//
// Una excepción sin motivo escrito es un olvido disfrazado de decisión. Y una
// excepción que ya no corresponde a nada afloja el guardián en silencio, así
// que también se comprueba que siga existiendo.
const REMOTOS_PERMITIDOS = {
  'cdn.paddle.com':
    'el script del checkout de Paddle no se puede empaquetar —es parte de su servicio— y offline no hace falta: en la app nativa el checkout corta antes de abrir nada por la guía 3.1.1 de Apple',
};

// Los comentarios HTML se sacan ANTES de medir. La primera versión de este
// test marcó como defecto el `<script src="https://cdn.jsdelivr.net/...">` que
// yo mismo había escrito **dentro del comentario que explica por qué ya no
// está**. Es la octava vez en este proyecto que contar menciones falla, y la
// segunda en dos días en que el que la provoca soy yo documentando el arreglo.
// Un comentario que cita el código viejo no es el código viejo.
const htmlSinComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
const scriptsRemotos = [...htmlSinComentarios.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
const noPermitidos = scriptsRemotos.filter(u => !Object.keys(REMOTOS_PERMITIDOS).some(d => u.includes(d)));

chk('ningún <script> remoto fuera de los permitidos',
  noPermitidos.length === 0,
  noPermitidos.join(', ') + ' — si hace falta, agregarlo a REMOTOS_PERMITIDOS CON su motivo');

Object.entries(REMOTOS_PERMITIDOS).forEach(([dominio, motivo]) => {
  chk('la excepción ' + dominio + ' sigue usándose', html.includes(dominio),
    'si ya no se carga, sacar su línea de REMOTOS_PERMITIDOS');
  chk('la excepción ' + dominio + ' tiene un motivo escrito', (motivo || '').length > 40);
});

// ─── 2 · supabase-js está en el repo, y una sola versión ────────────────────
const VENDOR = path.join(RAIZ, 'assets', 'vendor');
chk('existe assets/vendor/', fs.existsSync(VENDOR));

const copias = fs.existsSync(VENDOR)
  ? fs.readdirSync(VENDOR).filter(f => /^supabase-js-.*\.js$/.test(f))
  : [];
chk('hay exactamente UNA copia de supabase-js en el repo', copias.length === 1,
  'encontradas: ' + copias.join(', ') + ' — dos versiones de la librería de auth conviviendo es el peor caso');

const archivo = copias[0] || '';
const versionArchivo = (archivo.match(/supabase-js-(.+)\.js$/) || [])[1];

chk('el archivo pesa lo que pesa una librería de verdad',
  archivo ? fs.statSync(path.join(VENDOR, archivo)).size > 100000 : false,
  'un archivo chico sería un 404 guardado, o una copia a medias');

chk('el archivo expone el global que el index.html espera',
  archivo ? /^var supabase=/.test(fs.readFileSync(path.join(VENDOR, archivo), 'utf8').slice(0, 40)) : false,
  'tiene que ser el build UMD, no el ESM: el index.html hace `const { createClient } = supabase`');

// ─── 3 · Las TRES declaraciones de la versión coinciden ─────────────────────
//
// `package.json`, el <script src> y el APP_SHELL. Tres lugares, y el defecto
// aparecería donde la copia falta: el service worker cacheando una URL y el
// HTML pidiendo otra, sin que nada se queje. Es el mismo error que la regla 5
// resuelve con los dos números del despliegue.
const srcHtml = (html.match(/<script src="assets\/vendor\/(supabase-js-[^"]+\.js)"/) || [])[1];
const srcSw = (sw.match(/'\/assets\/vendor\/(supabase-js-[^']+\.js)'/) || [])[1];
const verPkg = (pkg.devDependencies || {})['@supabase/supabase-js'];

chk('index.html apunta al archivo que existe', srcHtml === archivo, srcHtml + ' vs ' + archivo);
chk('el APP_SHELL del service worker apunta al mismo archivo', srcSw === archivo, srcSw + ' vs ' + archivo);
chk('package.json declara la misma versión', verPkg === versionArchivo, verPkg + ' vs ' + versionArchivo);
chk('la versión está clavada, no es un rango',
  !!verPkg && !/[\^~>*]|x/.test(verPkg),
  verPkg + ' — un rango deja que la librería de autenticación cambie sin desplegar nada');

// ─── 4 · build-www copia assets/, o el binario sale sin la librería ─────────
const buildWww = fs.readFileSync(path.join(RAIZ, 'scripts', 'build-www.js'), 'utf8');
chk('build-www.js copia el directorio assets al paquete',
  /DIRS\s*=\s*\[[^\]]*'assets'/.test(buildWww),
  'sin esto el binario sale sin la librería, que es exactamente el bug que esto arregla');

// ─── 5 · Nada del arranque puede tirar si un remoto no cargó ───────────────
//
// `Paddle.Environment.set(...)` corría sin preguntar: sin señal, ReferenceError
// en el arranque. No volteaba la app —es otro bloque de script— pero ensucia la
// consola justo cuando alguien trata de entender por qué la app no anda.
chk('la inicialización de Paddle pregunta si el script cargó',
  /typeof Paddle === 'undefined'/.test(html));
chk('y lo dice en voz alta en vez de romper',
  /\[Paddle\] el script no cargó/.test(html));

// ─── 6 · Si falta supabase-js, el mensaje dice qué falta ────────────────────
chk('hay un chequeo explícito de que supabase-js cargó',
  /typeof supabase === 'undefined' \|\| !supabase\.createClient/.test(html));

// ─── 7 · La tipografía no bloquea el render ─────────────────────────────────
//
// Un <link rel=stylesheet> bloquea hasta que resuelve. Sin señal eso es la
// pantalla en blanco durante todo el timeout, justo en el caso que importa.
const linkFuentes = (html.match(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/) || [''])[0];
chk('el stylesheet de las fuentes no bloquea el arranque',
  /media="print"/.test(linkFuentes) && /onload="this\.media='all'"/.test(linkFuentes),
  linkFuentes.slice(0, 160));

// ─── 8 · El service worker sigue sin tocar lo cross-origin ─────────────────
//
// Es correcto que lo ignore —no queremos cachear Supabase ni Paddle— y por eso
// mismo lo que el arranque necesita tiene que ser del mismo origen. Si alguien
// "arregla" esto cacheando cross-origin, el problema vuelve por otro lado.
chk('el service worker sigue ignorando lo que no es del mismo origen',
  /origin !== self\.location\.origin/.test(sw));

console.log('\n' + pass + ' pasaron, ' + fail + ' fallaron');
process.exit(fail ? 1 : 0);
