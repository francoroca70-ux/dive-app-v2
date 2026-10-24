// El texto que escribe una persona no entra crudo al HTML.
//
//   node _tests/run-all.js      (preferido)
//
// EL BUG QUE LO ORIGINÓ, medido el 24/10 y que no es teórico: el botón de dar
// de baja a un tripulante armaba
//
//     onclick="removeStaff('<id>', 'O'Brien')"
//
// que es un **error de sintaxis**. El botón no hacía nada. O'Brien, O'Connor y
// D'Souza son nombres corrientes en una tripulación angloparlante, que es el
// mercado de este producto.
//
// Y la trampa de fondo: **`escapeHtml` no sirve para un manejador.** Escapa
// `& < > "` y no toca el apóstrofo, que es justo el carácter que rompe el
// literal de JavaScript. Hacen falta dos capas en orden: literal de JS primero,
// atributo HTML después.
//
// La defensa existía, escrita a mano DOS veces
// (`(p.full_name||'').replace(/'/g, "\\'")`), y el defecto apareció donde
// faltaba la copia. Encima esas dos copias sólo cubrían el apóstrofo.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const {lineasDeCodigoCon}=require('./contar');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

function tabla(){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:[],error:null}).then(res,rej);
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>tabla(),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};

let pass=0, fail=0;
function chk(n, ok, x){ if(ok){pass++;console.log('PASS  '+n);} else {fail++;console.log('FAIL  '+n+(x?'  '+x:''));} }

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  esc:(v)=>escapeHtml(v),
  escJs:(v)=>escapeJsEnAtributo(v),
  waiver:(tpl)=>vistaPreviaDeWaiver(tpl)
};`;
let boot=null; try{ window.eval(hook); }catch(e){ boot=e; }
chk('arranca sin excepción', !boot, boot?String(boot&&boot.stack||boot).slice(0,300):'');

(async () => {
try {
  if (boot) throw boot;
  const T=window.__t;

  // ─── 1 · escapeHtml NO alcanza para un manejador, y queda afirmado ───────
  //
  // Esta comprobación existe para que nadie "simplifique" el arreglo usando
  // escapeHtml en un onclick: el día que alguien lo haga, O'Brien vuelve.
  chk('escapeHtml deja pasar el apóstrofo', T.esc("O'Brien") === "O'Brien",
      'por eso no sirve dentro de un manejador');
  chk('y sí escapa la comilla doble', T.esc('a"b').includes('&quot;'));

  // ─── 2 · Las dos capas, y en el orden correcto ──────────────────────────
  chk('el apóstrofo sale escapado para JavaScript',
      T.escJs("O'Brien") === "O\\'Brien", T.escJs("O'Brien"));
  chk('la barra invertida también', T.escJs('a\\b') === 'a\\\\b', T.escJs('a\\b'));
  chk('la barra se escapa ANTES del apóstrofo',
      T.escJs("a\\'b") === "a\\\\\\'b", T.escJs("a\\'b"));
  chk('la comilla doble se va como entidad de atributo',
      T.escJs('a"b').includes('&quot;'), T.escJs('a"b'));
  chk('un nulo no explota', T.escJs(null) === '' && T.escJs(undefined) === '');

  // ─── 3 · LA PRUEBA QUE IMPORTA: el manejador generado PARSEA ────────────
  //
  // No se afirma la forma del texto: se le pide a JavaScript que lo compile.
  // Es la diferencia entre «el string parece bien» y «el botón funciona».
  for (const nombre of ["O'Brien", 'D\'Souza', 'a\\b', 'Ann "Nitrox" Lee', "O'Neill-D'Angelo"]) {
    const attr = `removeStaff('abc-123', '${T.escJs(nombre)}')`;
    let error=null;
    try { new Function(attr); } catch(e){ error=e; }
    chk('el manejador compila con el nombre ' + JSON.stringify(nombre), !error,
        error ? String(error.message).slice(0,80) : '');
  }

  // Y la contracara: sin la función, el mismo nombre NO compila. Es lo que
  // prueba que el arreglo cambia algo — un test que sólo mira el camino bueno
  // habría pasado antes y después.
  let errorSinArreglo=null;
  try { new Function("removeStaff('abc-123', 'O'Brien')"); } catch(e){ errorSinArreglo=e; }
  chk('sin escapar, el mismo manejador NO compila', !!errorSinArreglo,
      'si esto pasa, el bug no era un bug');

  // El nombre llega entero al otro lado, no desfigurado.
  const recuperado = new Function('return ' + `'${T.escJs("O'Brien")}'`)();
  chk('y el nombre llega intacto al manejador', recuperado === "O'Brien", recuperado);

  // ─── 4 · La vista previa del waiver escapa, y conserva los saltos ───────
  const prev = T.waiver({ title: 'Cláusula <b>importante</b>',
                          body_text: 'Línea 1\nLínea 2 & 3 <script>x</script>' });
  chk('el título del waiver va escapado',
      !/<b>/.test(prev) && /&lt;b&gt;/.test(prev), prev.slice(0,120));
  chk('el cuerpo también', !/<script>/.test(prev) && /&lt;script&gt;/.test(prev));
  chk('el ampersand no se pierde', /&amp;/.test(prev));
  chk('y los saltos de línea se conservan',
      /Línea 1\nLínea 2/.test(prev) && /pre-wrap/.test(prev),
      'los saltos son caracteres, no etiquetas: escapar no se los lleva');
  chk('sin título no se dibuja el párrafo',
      !/sf-label/.test(T.waiver({ body_text: 'x' })));
  chk('y aguanta una plantilla vacía', typeof T.waiver(null) === 'string');

  // ─── 5 · Una sola declaración de cada regla ─────────────────────────────
  chk('escapeJsEnAtributo se declara una vez',
      (html.match(/function escapeJsEnAtributo/g)||[]).length===1);
  chk('la vista previa del waiver se declara una vez',
      (html.match(/function vistaPreviaDeWaiver/g)||[]).length===1,
      'estaba escrita dos veces, idéntica');
  chk('y la usan los dos caminos de firma',
      lineasDeCodigoCon(html,'vistaPreviaDeWaiver(').length===3,
      'la declaración más la firma remota y la del local');

  // Ya no queda ningún `replace(/'/g` armando un literal a mano.
  chk('nadie escapa el apóstrofo a mano',
      lineasDeCodigoCon(html, "replace(/'/g").length===1,
      'sólo dentro de escapeJsEnAtributo');

  // ─── 6 · EL GUARDIÁN: estos campos nunca van crudos a una línea de HTML ─
  //
  // Afirma la REGLA y no un número: si mañana aparece un lugar nuevo que mete
  // uno de estos campos sin escapar, falla. La lista son los campos que ESTE
  // cambio cerró; los que quedan abiertos están en la nota del vault con sus
  // líneas, y se van sumando acá a medida que se cierran.
  const CERRADOS = [
    's.full_name', 'l.name', 'b.name', 'g.name', 'e.name',
    'tab.guest_name', 't.guest_name', 'a.name', 'a.task_lists.title',
    'it.text', 'r.reason', 'item.label', 'g.serial_number',
    'template.title', 'template.body_text'
  ];
  const lineas = html.split('\n');
  const crudos = [];
  lineas.forEach((l, i) => {
    if (!/[<]\/?[a-zA-Z]/.test(l)) return;          // no parece una línea de HTML
    if (l.trim().startsWith('//')) return;          // un comentario no dibuja nada
    for (const m of l.matchAll(/\$\{([^}]*)\}/g)) {
      const e = m[1].trim();
      if (CERRADOS.includes(e) || CERRADOS.includes(e.replace(/ \|\| ''$/, ''))) {
        crudos.push((i + 1) + ': ' + e);
      }
    }
  });
  chk('ningún campo de los cerrados vuelve a aparecer crudo en HTML',
      crudos.length === 0, crudos.slice(0, 6).join('  ·  '));

  // Y que el guardián de arriba sepa fallar: si se le pide un campo que SÍ
  // está crudo a propósito (de los que quedan abiertos), tiene que encontrarlo.
  // Sin esto, un error en la expresión regular haría que pase siempre.
  const detector = (campo) => lineas.some((l, i) =>
    /[<]\/?[a-zA-Z]/.test(l) && !l.trim().startsWith('//') &&
    [...l.matchAll(/\$\{([^}]*)\}/g)].some(m => m[1].trim() === campo));
  chk('el detector funciona: encuentra un campo que sigue crudo',
      detector('tripLabel'),
      'si esto falla, el guardián de arriba pasa por estar roto, no por estar limpio');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }

console.log('\n'+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
})();
