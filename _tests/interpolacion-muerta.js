// Busca `${...}` atrapado dentro de comillas SIMPLES o DOBLES, donde no se
// interpola: en vez del valor, la persona ve en pantalla el texto crudo
// `${t('alguna_clave')}`.
//
// Existe porque el 29/10 lo cometí DOS VECES en el mismo cambio, reemplazando
// textos en inglés duro por llamadas al diccionario dentro de cadenas que no
// eran plantillas. **La suite estaba en verde las dos veces**: el archivo
// parsea, la función corre, y lo único que pasa es que el exportable sale con
// `${t(...)}` impreso. Ningún test de comportamiento lo miraba porque nadie
// renderiza un exportable en jsdom.
//
// Por qué un escáner y no una expresión regular: una regex no sabe en qué
// estado está. `t('clave')">${t('otra')}` dentro de una plantilla tiene
// comillas simples que NO abren una cadena, y mi primer intento con regex dio
// 104 falsos positivos. Este recorre el texto siguiendo la pila de
// delimitadores, que es lo que hace la diferencia entre adivinar y medir.
// Recorre el JS siguiendo el estado real de comillas y devuelve las cadenas en
// comillas simples o dobles que contienen ${...}, donde eso NO se interpola:
// queda como texto literal en la pantalla.
function interpolacionesMuertas(js) {
  const malas = [];
  let i = 0, n = js.length;
  let enLinea = false, enBloque = false;
  const pila = [];               // '`' para template, "'" o '"' para cadena
  let inicio = -1, buf = '';
  while (i < n) {
    const c = js[i], d = js[i+1];
    const dentro = pila[pila.length-1];
    if (!dentro && !enLinea && !enBloque) {
      if (c === '/' && d === '/') { enLinea = true; i += 2; continue; }
      if (c === '/' && d === '*') { enBloque = true; i += 2; continue; }
      // Una expresión regular puede CONTENER una comilla —`/"/g` es el caso
      // real que dio el primer falso positivo— así que hay que saltearla
      // entera. Se distingue de una división por lo que viene antes: después
      // de un valor es división, después de un operador o un paréntesis que
      // abre es una regex. Es la heurística estándar y alcanza acá.
      if (c === '/') {
        let k = i - 1;
        while (k >= 0 && /s/.test(js[k])) k--;
        const previo = k < 0 ? '' : js[k];
        if (previo === '' || '(,=:[!&|?{};+-*%<>~^'.includes(previo)) {
          let j = i + 1, esc = false, clase = false;
          while (j < n) {
            const e = js[j];
            if (esc) { esc = false; j++; continue; }
            if (e === '\\') { esc = true; j++; continue; }
            if (e === '[') clase = true;
            else if (e === ']') clase = false;
            else if (e === '/' && !clase) break;
            else if (e === '\n') { j = i; break; }   // no era una regex
            j++;
          }
          if (j > i) { i = j + 1; continue; }
        }
      }
    }
    if (enLinea) { if (c === '\n') enLinea = false; i++; continue; }
    if (enBloque) { if (c === '*' && d === '/') { enBloque = false; i += 2; continue; } i++; continue; }
    if (dentro && c === '\\') { if (dentro !== '`') buf += js.slice(i, i+2); i += 2; continue; }
    if (!dentro && (c === "'" || c === '"' || c === '`')) { pila.push(c); if (c !== '`') { inicio = i; buf = ''; } i++; continue; }
    if (dentro && c === dentro) {
      pila.pop();
      if (c !== '`' && buf.includes('${')) malas.push({ pos: inicio, texto: buf.slice(0, 90) });
      i++; continue;
    }
    // Dentro de un template, ${ ... } vuelve a ser código.
    if (dentro === '`' && c === '$' && d === '{') { pila.push('{'); i += 2; continue; }
    if (dentro === '{') { if (c === '}') pila.pop(); else if (c === '`' || c === "'" || c === '"') { pila.push(c); if (c !== '`') { inicio = i; buf = ''; } } i++; continue; }
    if (dentro && dentro !== '`') buf += c;
    i++;
  }
  return malas;
}
module.exports = { interpolacionesMuertas };
