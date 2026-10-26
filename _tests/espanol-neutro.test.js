// El español de la app es neutro latinoamericano, y eso ahora lo cuida un test.
//
//   node _tests/run-all.js      (preferido)
//
// LA REGLA, decidida por Fran el 07/10: hay muy pocos centros de buceo en
// Argentina, así que los clientes van a estar repartidos por la región. Y
// **no se elige entre `tú` y `vos`**: Centroamérica se parte entre los dos
// —Costa Rica, Nicaragua y Guatemala vosean—, así que la segunda persona queda
// **sin conjugar**: impersonales, infinitivos, y el posesivo `tu`, que los dos
// comparten. Los botones van en infinitivo.
//
// Desde el 15/10 hay una segunda mitad: **menos modo imperativo**. Una lista de
// funciones describe, no manda.
//
// POR QUÉ ESTE ARCHIVO EXISTE, y es lo que vale: la regla se arregló **cuatro
// veces en un lugar cada vez**.
//
//   07/10  se escribe la regla
//   15/10  la landing seguía voseando nueve días después
//   22/10  los textos de `prep_missing_*` decían «podés» y «Armá»
//   26/10  `trial_banner_ending` decía «Elegí un plan»
//
// Cada arreglo tocó el sitio que alguien miró, y cada vez quedó escrito en el
// vault que *«una regla escrita que vive en un solo lado es media regla»* — y la
// siguiente vez volvió a pasar. Al medir el diccionario entero el 26/10
// aparecieron **61 líneas con 80 ocurrencias**. Una regla que depende de que
// alguien se acuerde no es una regla: es una intención.
//
// LO QUE NO SE PUEDE USAR ACÁ ES `\b`. En JavaScript `\b` trata la `í` como
// carácter no-palabra, así que `\bdecí\b` **matchea dentro de «decía»**, que no
// es voseo sino pretérito imperfecto. La primera medición de esta pasada
// reportó 56 líneas y la mitad eran comentarios con «decía» y «seguía». Van
// lookarounds de Unicode: `(?<!\p{L})…(?!\p{L})` con la bandera `u`.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// El bloque del diccionario español, acotado de verdad: hasta el cierre del
// objeto `TRANSLATIONS`. Medir sobre todo el archivo metería los comentarios
// del código, que no se le muestran a nadie.
const ini = html.indexOf('  es: {');
chk('se encuentra el diccionario español', ini > 0);
const resto = html.slice(ini);
const corte = resto.search(/\n  \}\n\};/);
chk('y se le encuentra el final', corte > 0, String(corte));
const es = resto.slice(0, corte);
chk('el bloque tiene un tamaño razonable', es.length > 50000 && es.length < 200000, String(es.length));

// ─── Las formas que delatan voseo ───────────────────────────────────────────
//
// Es una lista de formas concretas y no una regla de terminaciones, porque
// «comí», «salí» y «pedí» en primera persona del pretérito son correctos en
// cualquier español. Lo que se busca son imperativos y presentes de `vos`.
const FORMAS = [
  // presente de indicativo
  'podés', 'tenés', 'querés', 'sabés', 'debés', 'necesitás', 'sos', 'vivís',
  'acabás', 'encontrás', 'acordás', 'entendés', 'preferís', 'elegís',
  // imperativos
  'elegí', 'armá', 'creá', 'seguí', 'editá', 'mirá', 'agregá', 'cargá',
  'guardá', 'borrá', 'tildá', 'probá', 'revisá', 'contactá', 'usá', 'dejá',
  'poné', 'abrí', 'cerrá', 'andá', 'hacé', 'vení', 'tocá', 'apretá', 'subí',
  'bajá', 'sacá', 'buscá', 'anotá', 'completá', 'confirmá', 'verificá',
  'activá', 'desactivá', 'volvé', 'actualizá', 'escribí', 'continuá',
  'ingresá', 'intentá', 'recargá', 'grapá', 'fijate', 'dale',
  // imperativo con pronombre pegado
  'cambialo', 'cancelalo', 'hacelo', 'elegilo', 'archivalo', 'pedile',
  'escribinos', 'avisanos', 'mandanos', 'tenelo', 'dejalo', 'buscalo'
];
const rx = new RegExp('(?<!\\p{L})(' + FORMAS.join('|') + ')(?!\\p{L})', 'giu');

const sitios = [];
es.split('\n').forEach((l, i) => {
  if (l.trim().startsWith('//')) return;      // un comentario no se le muestra a nadie
  const m = l.match(rx);
  if (m) sitios.push([...new Set(m)].join(',') + ' → ' + l.trim().slice(0, 70));
});
chk('ninguna cadena del diccionario español vosea',
    sitios.length === 0, sitios.slice(0, 5).join('  ·  '));

// Y la contracara, que es la que prueba que el detector detecta: si se le pide
// una forma que SÍ está en el archivo (en un comentario, donde es legítima),
// tiene que encontrarla. Sin esto, un error en los lookarounds haría que el
// guardián de arriba pase por estar roto y no por estar limpio.
const detector = new RegExp('(?<!\\p{L})(decía|seguía)(?!\\p{L})', 'u');
chk('el detector funciona: encuentra las formas que SÍ existen',
    detector.test(html),
    'y «decía»/«seguía» no son voseo: son pretérito imperfecto, y por eso no están en la lista');
chk('y no las confunde con voseo',
    !rx.test('la pantalla decía que todo seguía igual'),
    'con \\b en vez de lookarounds de Unicode, esto daría un falso positivo');

// ─── Y la landing, que es el otro lugar donde vive texto en castellano ──────
//
// La landing es el archivo donde el voseo se descubrió el 15/10, y hasta hoy el
// único guardián de la regla miraba cinco claves de `index.html`. Hoy está
// limpia (medido: los 7 «sos» que aparecen con un grep suelto son base64 y la
// palabra «Permisos» — los lookarounds de Unicode no los marcan). Lo que
// faltaba era que algo avise si deja de estarlo.
// Las imágenes van incrustadas en base64, y ahí aparecen `sos` y `dale` por
// azar: la primera versión de esta comprobación marcó un `sOS` dentro del JPEG
// de la portada, rodeado de `/` y `+`, que no son letras. Los lookarounds de
// Unicode no alcanzan contra datos binarios: hay que sacar los datos antes de
// medir el texto. (Es la misma lección que la `í` y el `\b`: una medición sobre
// texto necesita saber qué parte del archivo ES texto.)
const landing = fs.readFileSync(path.join(__dirname, '..', 'landing.html'), 'utf8')
  .replace(/data:[a-z/+-]+;base64,[A-Za-z0-9+/=\s]+/gi, 'data:…');
const enLanding = landing.split('\n')
  .filter(l => rx.test(l))
  .map(l => (l.match(rx) || []).join(',') + ' → ' + l.trim().slice(0, 60));
chk('la landing tampoco vosea', enLanding.length === 0, enLanding.slice(0, 3).join('  ·  '));
chk('y el detector no confunde base64 ni «Permisos» con voseo',
    !rx.test('PRUa+SI0hKdgCfJRQ7obsosKLVoUQTs') && !rx.test('Permisos según el rol'),
    'un grep sin fronteras de Unicode marca los dos');

// ─── El segundo idioma no se queda atrás ────────────────────────────────────
//
// El inglés no tiene este problema, pero sí el de los diccionarios asimétricos:
// una clave que existe en uno y no en el otro se muestra en el idioma
// equivocado y nadie se entera hasta que un centro la ve.
const en = html.slice(html.indexOf('  en: {'), ini);
const clavesDe = (bloque) => new Set(
  [...bloque.matchAll(/^\s{4}([a-z][a-z0-9_]*):/gmi)].map(m => m[1])
);
const cEn = clavesDe(en), cEs = clavesDe(es);
const soloEn = [...cEn].filter(k => !cEs.has(k));
const soloEs = [...cEs].filter(k => !cEn.has(k));
chk('ninguna clave existe sólo en inglés', soloEn.length === 0, soloEn.slice(0, 8).join(', '));
chk('ninguna clave existe sólo en español', soloEs.length === 0, soloEs.slice(0, 8).join(', '));
chk('y los dos diccionarios tienen el mismo tamaño',
    cEn.size === cEs.size, cEn.size + ' en · ' + cEs.size + ' es');

// ─── Una clave repetida es un bug invisible ─────────────────────────────────
//
// JavaScript se queda con la última y no avisa. Si las dos tienen el mismo
// valor no se nota; el día que alguien edite la primera, su cambio no aparece
// en pantalla y no hay ningún error que lo explique.
function repetidas(bloque) {
  const vistas = new Map(), dup = [];
  for (const m of bloque.matchAll(/^\s{4}([a-z][a-z0-9_]*):/gmi)) {
    if (vistas.has(m[1])) dup.push(m[1]); else vistas.set(m[1], true);
  }
  return [...new Set(dup)];
}
const dupEn = repetidas(en), dupEs = repetidas(es);
chk('ninguna clave está declarada dos veces en inglés', dupEn.length === 0, dupEn.join(', '));
chk('ninguna clave está declarada dos veces en español', dupEs.length === 0, dupEs.join(', '));

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
