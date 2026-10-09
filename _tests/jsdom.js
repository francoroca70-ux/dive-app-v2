// De dónde sale jsdom. Un solo lugar para los trece archivos de test.
//
// Por qué existe, con fecha: hasta el 09/10 cada test hacía
//
//     require('/tmp/node_modules/jsdom')
//
// una ruta absoluta de Linux que **sólo existía en el sandbox donde Claude los
// escribía**. En el Git Bash de Fran, en Windows, eso lanza antes de la primera
// comprobación, así que los trece archivos daban cero y **Fran nunca pudo
// correr la suite ni una vez**.
//
// Lo grave no es la ruta: es que la regla «validar antes de pushear» la estuvo
// ejecutando una sola de las dos personas del proyecto, y la que despliega y
// prueba de verdad no tenía cómo. Un test que sólo corre en la máquina de quien
// lo escribió no es una red de seguridad del proyecto; es una del autor.
//
// Ahora se resuelve en este orden:
//   1. `jsdom` normal — desde `node_modules` del proyecto, que es lo que
//      instala `npm i -D jsdom`. Es el camino de Fran.
//   2. la ruta del sandbox, que se reinstala sola cuando se reinicia.
// Y si no está en ninguno, el mensaje dice exactamente qué comando correr, en
// vez de un stack de `MODULE_NOT_FOUND`.
// `JSDOM_PATH` existe sólo para el sandbox de Claude: ahí `node_modules` del
// proyecto está en la carpeta montada de Windows y cargar jsdom desde ahí tarda
// ~35 s por archivo, contra menos de un segundo desde una copia local. No
// cambia nada en la máquina de Fran, donde el orden normal ya es el rápido.
let jsdom = null;
const intentos = [process.env.JSDOM_PATH, 'jsdom', '/tmp/node_modules/jsdom'].filter(Boolean);
const errores = [];

for (const ruta of intentos) {
  try { jsdom = require(ruta); break; }
  catch (e) { errores.push(`${ruta}: ${e.code || e.message}`); }
}

if (!jsdom) {
  console.error('\nFalta jsdom, que es lo que corre el index.html de verdad.\n');
  console.error('  cd ~/dive-app-v2 && npm i -D jsdom\n');
  console.error('Intentado en:');
  errores.forEach(e => console.error('  · ' + e));
  console.error('');
  // 2 y no 1, para que run-all.js lo distinga de «un test falló».
  process.exit(2);
}

module.exports = jsdom;
