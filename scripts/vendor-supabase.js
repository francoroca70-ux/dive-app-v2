// Copia la librería de Supabase de node_modules al repo, con la versión en el
// nombre del archivo.
//
//   npm run vendor:supabase
//
// POR QUÉ EXISTE. Hasta el 27/10/2026 el `index.html` decía:
//
//     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">
//
// O sea que la app empaquetada —la que «arranca del binario» desde el 14/10—
// salía a internet a buscar **la librería sin la cual no existe**. Nadie la
// guardaba: `build-www.js` copia archivos locales, y el service worker ignora
// a propósito todo lo que no sea del mismo origen. Sin señal sólo podía salir
// de la caché HTTP del webview, que se vacía sola y que en una instalación
// nueva está vacía.
//
// Y `@2` significa «la última v2 que haya». La librería de AUTENTICACIÓN de un
// producto que además cobra podía cambiar debajo nuestro sin que
// desplegáramos nada, y sin que nadie se enterara hasta que algo se rompiera.
//
// POR QUÉ EL ARCHIVO SE COMMITEA, y no se genera al desplegar: Render sirve
// el repo tal cual, sin build step. Es una decisión vieja y deliberada —Fran
// no programa y despliega con un push— así que lo que el navegador necesita
// tiene que estar en el repo. `www/` lo arma `build-www.js` sólo para el
// envoltorio nativo.
//
// LA VERSIÓN VA EN EL NOMBRE DEL ARCHIVO a propósito. El service worker cachea
// este archivo en el APP_SHELL, y la rama de estáticos es cache-first: un
// nombre fijo con contenido nuevo sería exactamente el bug de «la copia vieja
// que nadie puede sacarse de encima». Con la versión adentro, una actualización
// es una URL nueva y la vieja se cae sola al cambiar `CACHE_VERSION`.
//
// Al actualizar la versión hay que tocar TRES lugares, y el test
// `_tests/arranque-sin-cdn.test.js` falla si no coinciden:
//   1 · `package.json`   → la dependencia
//   2 · `index.html`     → el <script src>
//   3 · `sw.js`          → la entrada del APP_SHELL
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PKG = path.join(ROOT, 'node_modules', '@supabase', 'supabase-js');

if (!fs.existsSync(PKG)) {
  console.error('Falta node_modules/@supabase/supabase-js. Correr primero:  npm install');
  process.exit(1);
}

const version = require(path.join(PKG, 'package.json')).version;
const origen = path.join(PKG, 'dist', 'umd', 'supabase.js');

if (!fs.existsSync(origen)) {
  console.error('No está el build UMD en ' + origen + '. ¿Cambió el empaquetado de la librería?');
  process.exit(1);
}

const destinoDir = path.join(ROOT, 'assets', 'vendor');
fs.mkdirSync(destinoDir, { recursive: true });
const nombre = `supabase-js-${version}.js`;
fs.copyFileSync(origen, path.join(destinoDir, nombre));

// Las copias viejas se borran. Si quedaran, el APP_SHELL apuntaría a una y el
// `<script>` a otra sin que nada se queje, que es la forma más cara de tener
// dos versiones de la librería de autenticación conviviendo.
const viejas = fs.readdirSync(destinoDir)
  .filter(f => /^supabase-js-.*\.js$/.test(f) && f !== nombre);
viejas.forEach(f => { fs.unlinkSync(path.join(destinoDir, f)); console.log('borrada la copia vieja: ' + f); });

console.log(`assets/vendor/${nombre} listo.`);
console.log('AHORA hay que actualizar a mano, o el test falla:');
console.log(`  index.html  →  <script src="assets/vendor/${nombre}">`);
console.log(`  sw.js       →  '/assets/vendor/${nombre}' en APP_SHELL`);
