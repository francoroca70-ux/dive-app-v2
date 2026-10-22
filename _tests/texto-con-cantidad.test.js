// Un contador que puede valer 1 no dice «1 listas».
//
//   node _tests/texto-con-cantidad.test.js
//
// Lo destapó probar en OTRA cuenta, el 22/10. El aviso de listas de preparación
// que faltan se había probado en Blue water, que tiene **siete** tipos sin
// lista, y ahí el plural es correcto. La org de Fran tiene **uno**, y la
// pantalla decía textual *«1 trip types have no prep list of their own»* y
// *«1 of them have no standard list to copy»*.
//
// La lección, que es de método y no de texto: **un caso de prueba con n=7 no
// prueba el camino de n=1.** Las dos cuentas corren el mismo código y sólo una
// enseña el defecto.
//
// Y de fondo había algo más grande: la app tenía CUATRO convenciones para
// resolver lo mismo —`_singular`/`_plural`, `{s}`, «(s)» escrito a mano, y los
// contadores que no lo resolvían en absoluto—. Este archivo cuida la que queda,
// que es una función. La unificación del resto está anotada en el vault y es un
// cambio aparte.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(n, ok, x) {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · La función existe y degrada a lo de antes ─────────────────────────
const cuerpo = html.slice(html.indexOf('function textoConCantidad'),
                          html.indexOf('function textoConCantidad') + 400);
chk('textoConCantidad existe', cuerpo.length > 50);
chk('usa la clave _one sólo cuando n es exactamente 1',
    /n === 1/.test(cuerpo), 'un >= 1 o un truthy haría que 0 use el singular');
chk('pregunta si la clave existe antes de usarla',
    /hayClave\(/.test(cuerpo),
    'sin eso, t() devuelve el nombre de la clave y se muestra «prep_missing_title_one»');
chk('reemplaza el {n}', /replace\('\{n\}', n\)/.test(cuerpo));

// Cero no es uno. Es el caso que un `n <= 1` rompería en silencio, y acá no se
// da sólo por suerte: el aviso corta antes si no falta ninguna.
chk('hayClave mira los dos diccionarios, no sólo el activo',
    /TRANSLATIONS\.en\[clave\]/.test(html.slice(html.indexOf('function hayClave'),
                                                html.indexOf('function hayClave') + 300)));

// ─── 2 · El aviso de listas que faltan la usa en los cinco lugares ─────────
//
// Cuenta la REGLA, no «los cinco que yo conozco»: lo que este guardián afirma es
// que NINGÚN texto de prep_missing con un contador se interpola a mano. Si
// mañana aparece un sexto, falla.
const aManoConN = [...html.matchAll(/t\('prep_missing_\w+'\)\.replace\('\{n\}'/g)].length;
chk('ningún prep_missing_* interpola {n} a mano', aManoConN === 0,
    'quedan ' + aManoConN + ' — tienen que pasar por textoConCantidad');

const porLaFuncion = [...html.matchAll(/textoConCantidad\('prep_missing_\w+'/g)].length;
chk('y los cinco contadores van por la función', porLaFuncion === 5,
    'encontrados ' + porLaFuncion);

// ─── 3 · Cada clave con contador tiene su _one, en LOS DOS idiomas ─────────
//
// Éste es el que de verdad protege: una clave nueva sin su `_one` vuelve al bug.
// Y se comprueba por idioma porque el defecto clásico acá es agregarla en inglés
// y olvidarla en español — la app cae al inglés y nadie ve un error.
const conContador = ['prep_missing_title', 'prep_missing_fix', 'prep_missing_no_seed',
                     'prep_missing_confirm', 'prep_missing_done'];
const en = html.slice(html.indexOf('  en: {'), html.indexOf('  es: {'));
const es = html.slice(html.indexOf('  es: {'));
for (const k of conContador) {
  chk(k + '_one está en inglés', en.includes(k + '_one:'));
  chk(k + '_one está en español', es.includes(k + '_one:'));
  chk(k + '_one no lleva {n}',
      !(new RegExp(k + "_one: '[^']*\\{n\\}").test(en))
      && !(new RegExp(k + "_one: '[^']*\\{n\\}").test(es)),
      'el singular dice «un/una», no un número');
}

// ─── 4 · El parcial esquiva el plural en vez de necesitar dos textos ──────
//
// `prep_missing_partial` lleva {ok}, no {n}, así que la función no lo cubre. En
// vez de dejarlo a medias —media corrección miente con más confianza— se
// reescribió para que el número vaya después de los dos puntos, donde 1 y 7 se
// leen igual de bien.
chk('el parcial no arranca con el contador',
    !/prep_missing_partial: '\{ok\}/.test(html),
    'con ok=1 diría «1 lists created»');
chk('el parcial sigue diciendo el número y el motivo',
    /prep_missing_partial: '[^']*\{ok\}[^']*\{why\}/.test(en)
    && /prep_missing_partial: '[^']*\{ok\}[^']*\{why\}/.test(es));

// ─── 5 · El español del aviso no vosea ────────────────────────────────────
//
// Encontrado en el mismo pase: dos de estos textos decían «podés». La regla de
// español neutro existe desde el 07/10 y estos quedaron afuera — la misma forma
// que la landing el 15/10. Una regla escrita que vive en un solo lado es media
// regla.
const bloqueEsPrep = es.slice(es.indexOf('prep_missing_title:'),
                              es.indexOf('prep_missing_partial:') + 200);
chk('ningún prep_missing en español vosea',
    !/\b(podés|tenés|creá|seguí|armá|editá|elegí)\b/.test(bloqueEsPrep),
    bloqueEsPrep.match(/\b(podés|tenés|creá|seguí|armá|editá|elegí)\b/)?.[0] || '');

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
