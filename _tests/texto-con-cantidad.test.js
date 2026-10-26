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

// ─── 6 · LAS CUATRO CONVENCIONES SON UNA (hecho el 26/10) ─────────────────
//
// Este archivo decía que la unificación «es un cambio aparte». Es éste.
// Medidas antes de empezar, las cinco formas que había de resolver lo mismo:
//
//   A · textoConCantidad(clave, n) + `_one`   ← la que queda
//   B · t(n === 1 ? 'x_one' : 'x').replace('{n}', n)   escrita a mano
//   C · .replace('{s}', n > 1 ? 's' : '')     sólo sirve en inglés
//   D · «(s)» / «(es)» dentro del texto
//   E · cinco claves pegadas para armar UNA oración
//
// C y E eran los peores y por razones distintas. C es inglés: en castellano el
// plural no siempre es +s, y el `> 1` da **singular con cero** («0 cambio»). E
// pegaba `tt_crew_hire_cost` + `$monto` + `tt_for_days` + `días` +
// `tt_day_plural` + `tt_added_to_total`, con los espacios metidos dentro de las
// traducciones: el orden de las palabras queda clavado al del inglés y ningún
// traductor puede moverlo.

chk('ya no queda ningún {s} en una traducción',
    !/: *["'][^"']*\{s\}/.test(html),
    'el truco del {s} sólo funciona en inglés');
chk('ya no queda «(s)» ni «(es)» dentro de un texto',
    !/: *["'][^"']*\((s|es)\)/.test(html));
chk('nadie arma el plural con un ternario sobre una clave',
    !/t\([a-zA-Z_.$\[\]]+ *(===|>) *1 *\? *'/.test(html),
    'eso es textoConCantidad escrito a mano');
chk('el > 1 ya no decide un plural (con cero daría singular)',
    !/> *1 *\? *t\('[a-z_]*plural/.test(html));

// La oración del costo de tripulación es UNA clave con marcadores.
chk('el costo de tripulación es una oración, no cinco fragmentos',
    /tt_crew_hire_line: '[^']*\{amount\}[^']*\{n\}/.test(en) &&
    /tt_crew_hire_line: '[^']*\{amount\}[^']*\{n\}/.test(es));
chk('y las cinco claves que la pegaban ya no existen',
    !/tt_crew_hire_cost|tt_for_days|tt_added_to_total/.test(html));

// Los pares nuevos, en los dos diccionarios. Es la lista de lo que este cambio
// convirtió: si mañana alguien agrega un contador nuevo sin `_one`, no lo
// agarra esto sino los guardianes de arriba, que afirman la regla.
const paresNuevos = ['offline_banner_waiting', 'offline_syncing_back', 'offline_syncing',
                     'trial_banner_ending', 'trial_banner_ending_native',
                     'tt_del_n_bookings', 'tt_del_n_guests', 'tt_del_n_payments',
                     'tt_del_n_waivers', 'tt_del_n_records', 'tt_del_n_crew',
                     'tt_crew_hire_line', 'rw_pending', 'rd_blocked',
                     'cl_motivos_intro', 'cl_reset_confirm', 'cl_reset_confirm_firmada',
                     'gt_bookings_label'];
let faltantes = [];
for (const k of paresNuevos) {
  if (!en.includes(k + '_one:') || !es.includes(k + '_one:')) faltantes.push(k);
}
chk('los 18 contadores tienen su singular en los dos diccionarios',
    faltantes.length === 0, faltantes.join(', '));

// Y el singular no lleva «{n}»: dice «1 reserva», no «{n} reserva».
let conN = [];
for (const k of paresNuevos) {
  for (const [nombre, dicc] of [['en', en], ['es', es]]) {
    const m = dicc.match(new RegExp(k + "_one: '([^']*)'"));
    if (m && m[1].includes('{n}')) conN.push(k + ' (' + nombre + ')');
  }
}
chk('ningún singular lleva el marcador {n}', conN.length === 0, conN.join(', '));

// `set_billing_trial_left` usaba {days}; pasó a {n} para que la función lo
// resuelva. Si volviera {days}, el número no se sustituiría y la pantalla
// mostraría el marcador crudo.
chk('el aviso de días de prueba usa {n}, no {days}',
    /set_billing_trial_left: '[^']*\{n\}/.test(en) &&
    /set_billing_trial_left: '[^']*\{n\}/.test(es));

console.log('\n' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
