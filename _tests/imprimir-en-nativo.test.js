// En la app instalada no se ofrece imprimir, y el motivo que se dice es cierto.
//
//   node _tests/imprimir-en-nativo.test.js
//
// Lo encontró Fran el 21/10 en la app empaquetada, entrando a Logged Checklists:
// un cartel rojo que decía *«Please allow pop-ups to export»*.
//
// El problema no era que fallara: es que **en una app nativa no existe ningún
// bloqueador de ventanas emergentes que se pueda permitir.** El WebView no abre
// ventanas y punto, así que el cartel manda a buscar una opción que no existe.
// Misma forma exacta que el «revisá la conexión» del tilde, dos días antes.
//
// Y la misma causa de fondo, por tercera vez esta semana: `abrirParaImprimir()`
// devolvía un **booleano**, así que los ocho lugares que imprimen tenían que
// adivinar el motivo — y los ocho adivinaban el mismo, el equivocado.
//
// Ojo con lo que este test NO afirma: **exportar desde el celular sigue sin
// funcionar.** Eso necesita la hoja de compartir de iOS y un plugin de
// Capacitor. Esto sólo deja de mentir sobre por qué.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(n, ok, x) {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · Un solo lugar decide, y corta antes de intentar ───────────────────
const cuerpo = html.slice(html.indexOf('function abrirParaImprimir'),
                          html.indexOf('function motivoDeNoPoderImprimir'));
chk('abrirParaImprimir corta en nativo antes de abrir nada',
    cuerpo.indexOf('isNativeAppShell()') < cuerpo.indexOf('window.open'),
    'el corte tiene que estar ANTES de window.open');
chk('y devuelve el motivo, no un booleano',
    /return 'nativo'/.test(cuerpo) && /return 'bloqueado'/.test(cuerpo)
    && !/return false/.test(cuerpo) && !/return true/.test(cuerpo));
chk('el camino bueno devuelve null', /return null;/.test(cuerpo));
chk('ya no recibe un callback para avisar',
    /function abrirParaImprimir\(html\)/.test(cuerpo));

// ─── 2 · Los ocho lugares usan el motivo compartido ────────────────────────
//
// El guardián que importa: cuenta la REGLA, no «los que yo conozco». Si mañana
// aparece un noveno lugar que imprime con su propio cartel, este test falla.
// **7 y no 8**: la primera versión de este test dijo 8 porque conté las líneas
// del grep sin descontar la declaración de la función. El test lo agarró, que es
// para lo que está — pero vale anotarlo, porque es la misma forma del error que
// este archivo documenta: afirmar un número de memoria en vez de medirlo.
//
// El `>=` es a propósito: un octavo lugar que imprima no rompe nada, lo que
// rompe es que uno de ellos deje de pedir el motivo compartido.
const llamadas = [...html.matchAll(/abrirParaImprimir\(/g)].length - 1;  // menos la declaración
chk('hay varios lugares que imprimen', llamadas >= 7, `${llamadas} llamadas`);

const conCartelPropio = [
  'wv_allow_popups_export\')',   // t('wv_allow_popups_export') suelto
  'mf_popup_blocked'
].filter(s => {
  // Vale dentro de `motivoDeNoPoderImprimir` y en los diccionarios; no fuera.
  const fuera = html.split('\n').filter(l =>
    l.includes(s) && !l.trim().startsWith('//')
    && !/^\s*(wv_allow_popups_export|mf_popup_blocked):/.test(l)
    && !l.includes('razon === '));
  return fuera.length > 0;
});
chk('ningún lugar arma su propio cartel de ventanas emergentes',
    conCartelPropio.length === 0, conCartelPropio.join(', '));

// Uno por cada lugar que imprime: si un día hay menos usos que llamadas, alguno
// volvió a armar su propio cartel.
const usos = [...html.matchAll(/motivoDeNoPoderImprimir\(/g)].length - 1;
chk('todos piden el motivo a la función compartida', usos >= llamadas,
    `${usos} usos para ${llamadas} llamadas`);

// ─── 3 · Los botones no se ofrecen si no pueden funcionar ──────────────────
//
// Un botón que existe y nunca puede funcionar es peor que uno que no está:
// invita a apretarlo y después explica por qué no.
chk('el permiso de exportar mira la plataforma además del rol',
    /canExportShopRecords\(\) && sePuedeImprimir\(\)/.test(html));
chk('sePuedeImprimir sale de un solo lugar',
    /function sePuedeImprimir\(\) \{ return !isNativeAppShell\(\); \}/.test(html));

// ─── 4 · El aviso cambia de CLAVE, no sólo de texto ───────────────────────
//
// Si se escribiera el texto a mano dejando el `data-i18n` viejo, el aviso
// volvería al otro motivo en cuanto alguien cambie de idioma —
// `applyTranslations()` recorre el DOM y lo repinta desde la clave.
chk('el aviso de exportar se repinta por clave',
    /setAttribute\('data-i18n', clave\)/.test(html));

// ─── 5 · El texto nuevo existe en los DOS diccionarios ────────────────────
const textos = [...html.matchAll(/exp_solo_desde_la_web:\s*(["'])(.*?)\1/g)].map(m => m[2]);
chk('exp_solo_desde_la_web está en inglés y en español', textos.length === 2,
    `${textos.length} definiciones`);
chk('ninguno habla de ventanas emergentes',
    textos.every(x => !/pop-?up|emergente/i.test(x)), textos.join(' || '));
chk('los dos dicen dónde sí se puede',
    textos.every(x => x.includes('sevenseasops.com')), textos.join(' || '));

// El español del proyecto es neutro latinoamericano y con menos imperativo.
const es = textos.find(x => /Exportar e imprimir/.test(x));
chk('el español no conjuga la segunda persona',
    !!es && !/\b(ten[eé]s|pod[eé]s|and[aá]|entr[aá]|us[aá]|abr[ií])\b/i.test(es), es);

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail);
