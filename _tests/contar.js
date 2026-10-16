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
