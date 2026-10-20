// Cuando el servidor rechaza una escritura, el cartel dice POR QUÉ.
//
//   node _tests/motivo-de-un-rechazo.test.js
//
// Lo trajo una prueba de uso de Juanma el 17/10: dijo que no podía tildar en la
// checklist que había creado Fran. Medido en la base, **su tilde estaba
// guardado** —`checked_by` con su id, 19:11:49— así que el permiso no era el
// problema: el problema era lo que la app le dijo.
//
// `marcarTilde()` mostraba un texto propio, «Revisá la conexión y probá de
// nuevo», para CUALQUIER rechazo. Y esa frase no puede ser cierta ahí: si
// hubiera sido la conexión, `saveChecklistTick()` habría encolado el tilde y el
// cartel no se habría mostrado nunca. Era el motivo equivocado, con la misma
// forma exacta del error del 11/10 que ya habíamos corregido en los otros diez
// lugares — el único que había quedado afuera, y el que más se ve, porque
// tildar es lo que más se hace en esta app.
//
// La causa de fondo no era el texto: era que `saveChecklistTick()` devolvía
// `true`/`false`. **Un booleano en un borde es la decisión de no contar lo que
// se sabe.** La función que tenía el error en la mano lo tiraba, y la que
// hablaba con la persona tenía que inventar una explicación.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(nombre, ok, detalle) {
  if (ok) { pass++; console.log('PASS  ' + nombre); }
  else { fail++; console.log('FAIL  ' + nombre + (detalle ? '  ' + detalle : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · Ninguna llamada sin `await` ────────────────────────────────────────
//
// El guardián que importa. `motivoDeFalloAlEscribir()` es **async** —mide la red
// antes de decidir— así que sin `await` devuelve una Promise y el cartel le
// muestra a la persona `[object Promise]`. Un cartel ilegible es peor que uno
// genérico: el genérico al menos se entiende.
//
// Dos de los once lugares lo tenían así, encontrados el 20/10 buscando por qué
// el del tilde mentía. Se cuenta la regla, no «las que yo conozco»: cualquier
// llamada nueva que se escriba sin await rompe este test.
const llamadas = [...html.matchAll(/(.{0,10})motivoDeFalloAlEscribir\s*\(/g)]
  .filter(m => !/(async )?function $/.test(m[1]));
const sinAwait = llamadas.filter(m => !/await\s+$/.test(m[1]));
chk('todas las llamadas a motivoDeFalloAlEscribir van con await',
    sinAwait.length === 0,
    sinAwait.length ? `${sinAwait.length} sin await: ${sinAwait.map(m => m[1].trim()).join(' | ')}`
                    : `(${llamadas.length} llamadas revisadas)`);
chk('se revisó más de una llamada', llamadas.length >= 8,
    `encontradas ${llamadas.length} — si bajó, ¿se renombró la función?`);

// ─── 2 · El tilde usa la función compartida y no un texto propio ────────────
const marcarTilde = html.slice(html.indexOf('async function marcarTilde'),
                               html.indexOf('async function marcarTilde') + 3000);
chk('marcarTilde pide el motivo a la función compartida',
    /motivoDeFalloAlEscribir\(fallo/.test(marcarTilde));
// Y le dice que la red YA se midió. Si no, se mide dos veces y las dos pueden
// no coincidir: un segundo sondeo malo haría que el cartel dijera «sin
// conexión» sobre un tilde que el servidor rechazó. Lo encontró este mismo test
// en jsdom, donde el segundo sondeo siempre falla.
chk('y le avisa que la red ya estaba medida',
    /yaHabiaRed:\s*true/.test(marcarTilde));
chk('marcarTilde ya no decide el texto por su cuenta',
    !/Check your connection|Revis[áa] la conexi[óo]n/.test(marcarTilde));

// ─── 3 · El cartel tiene dónde poner el motivo, en los DOS idiomas ─────────
//
// Si falta el `{why}` en uno, ese idioma pierde el motivo en silencio: el texto
// se muestra entero y correcto, sólo que sin la parte que explica. Es el modo de
// falla de siempre — no da error, calla.
const carteles = [...html.matchAll(/cl_tick_failed:\s*(["'])(.*?)\1/g)].map(m => m[2]);
chk('el cartel del tilde existe en los dos diccionarios', carteles.length === 2,
    `encontrados ${carteles.length}`);
chk('los dos tienen {why}', carteles.length === 2 && carteles.every(c => c.includes('{why}')),
    carteles.join(' || '));

// ─── 4 · saveChecklistTick devuelve el error, no un booleano ───────────────
const save = html.slice(html.indexOf('async function saveChecklistTick'),
                        html.indexOf('async function marcarTilde'));
chk('saveChecklistTick devuelve el error del servidor', /\n  return error;/.test(save));
chk('saveChecklistTick ya no devuelve false', !/return false;/.test(save));
chk('el camino de éxito devuelve null', (save.match(/return null;/g) || []).length >= 3,
    `${(save.match(/return null;/g) || []).length} returns null`);

// ─── 5 · Y sigue encolando sin red, que es lo que hace que el cartel sea
// honesto cuando aparece ────────────────────────────────────────────────────
//
// Esto no es decoración: si un fallo de red no se encolara, el cartel tendría
// que volver a hablar de la conexión y estaríamos donde empezamos.
chk('un fallo de red sigue yendo a la cola, no al cartel',
    /queueOfflineAction\(checked \? 'checklist_tick'/.test(save)
    && /hayRedDeVerdad\(\)/.test(save));

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail);
