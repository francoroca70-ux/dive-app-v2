// Contar usos de verdad, sin que un comentario cuente como uso.
//
// Esto existe porque la misma aserción falló **cuatro veces en dos días**, y
// las cuatro por el mismo motivo: `html.match(/nombreDeFuncion\(/g).length`
// cuenta también las menciones en comentarios.
//
//   15/10 · CHECKLIST_CADENCIAS  — un lector más de la única fuente
//   15/10 · lineaDeFuenteDeLista — un comentario la nombraba
//   16/10 · POS_VENTAS           — un comentario de HTML la nombraba
//   16/10 · filaDeService        — un comentario en otra función la nombraba
//
// Las cuatro veces el código estaba bien y la aserción estaba mal. Un guardián
// que falla cuando no hay nada roto se termina desactivando, y entonces deja
// de guardar — que es peor que no tenerlo.
//
// La regla que hay que afirmar casi nunca es «aparece N veces». Es «se declara
// una sola vez» y «la llaman estos lugares». Estas dos funciones son para eso.

// Las líneas de CÓDIGO que contienen un texto. Se descartan las que empiezan
// con `//`, `*` o `<!--`, que es donde viven los comentarios de este proyecto.
//
// No pretende ser un parser: un `//` dentro de un string lo engañaría. Para lo
// que se usa —contar dónde se llama una función— alcanza, y la alternativa
// (contar menciones) ya demostró cuatro veces que no.
function lineasDeCodigoCon(html, texto) {
  return html.split('\n')
    .map(l => l.trim())
    .filter(l => l.includes(texto))
    .filter(l => !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('<!--'));
}

// Cuántas veces se LLAMA a una función en código, sin contar su declaración.
function llamadasA(html, nombre) {
  return lineasDeCodigoCon(html, nombre + '(')
    .filter(l => !l.startsWith('function ' + nombre + '(')
              && !l.startsWith('async function ' + nombre + '('))
    .length;
}

module.exports = { lineasDeCodigoCon, llamadasA };

// ─── Fechas, con el idioma de la APP ──────────────────────────────────────
//
// Esto nació el 16/10 porque la suite daba 1037/0 en el sandbox y 1037/5 en el
// Windows de Fran: las aserciones comparaban contra una fecha ya formateada y
// `toLocaleDateString([])` seguía el idioma de la MÁQUINA.
//
// El 17/10 se arregló la causa de raíz —la app ahora formatea con
// `localeDeLaApp()`— así que este ayudante cambió con ella: ya no calcula «como
// la ve esta máquina» sino «como la formatea la app en ese idioma».
//
// **Es un espejo, no una medición.** Repite la regla de `localeDeLaApp()` en
// `index.html`; si una de las dos cambia y la otra no, el test pasa a mentir.
// Por eso hay una comprobación aparte que afirma que las dos dicen lo mismo —
// igual que el espejo del CHECK de las cadencias.
function localeDeLaApp(idioma) {
  return idioma === 'es' ? 'es-419' : 'en-GB';
}

function fechaEnLaApp(iso, idioma, opciones) {
  return new Date(iso).toLocaleDateString(localeDeLaApp(idioma), opciones ||
    { month: 'short', day: 'numeric', year: 'numeric' });
}

// Para fechas de sólo día (`2026-10-07`), que la app ancla al mediodía para
// que no se corra un día según la zona horaria.
function fechaDeDiaEnLaApp(yyyymmdd, idioma, opciones) {
  return fechaEnLaApp(yyyymmdd + 'T12:00:00', idioma, opciones);
}

module.exports.localeDeLaApp = localeDeLaApp;
module.exports.fechaEnLaApp = fechaEnLaApp;
module.exports.fechaDeDiaEnLaApp = fechaDeDiaEnLaApp;
