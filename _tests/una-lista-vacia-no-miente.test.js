// Una lista que quedó vacía dice POR QUÉ, y no inventa que no hay nada.
//
//   node _tests/run-all.js      (preferido)
//
// EL BUG, encontrado el 26/10 con Fran abriendo la app sin señal en su iPhone:
// el calendario sin salidas, la tripulación diciendo «Aún no hay tripulación.
// Invita a tu primer miembro del personal arriba.» y su propio usuario como un
// «?». Tres pantallas distintas, una sola causa.
//
// `supabase-js` NO lanza. Cuando el fetch falla devuelve `data: null` con el
// error al lado:
//
//     const { data: staff } = await sb.from('staff').select(...)
//     if (!staff || staff.length === 0) → «Aún no hay tripulación»
//
// El `error` ni se destructura, así que **una consulta que no salió y una tabla
// vacía son el mismo valor**, y la pantalla elige la peor de las dos lecturas.
// Medido ese día: 141 lecturas miran sólo `data`, 41 miran el error.
//
// Es la misma forma que el 08/10 del lado de los borrados —32 borrados y sólo 4
// miraban el error, que es lo que trajo `borrarOAvisar()`— pero del lado de
// leer, donde nunca se había hecho la pasada.
//
// ─── Por qué este guardián afirma la REGLA y no un número ───
//
// Contar menciones ya falló seis veces en este proyecto: un comentario que
// nombra una función no es un llamado, y un nombre adentro de un string de
// error tampoco. Así que acá no se cuenta cuántos sitios usan la función: se
// toma cada estado vacío que vive debajo de una lectura y se EXIGE que o bien
// pase por `textoDeListaVacia()`, o bien esté en la lista de excepciones de
// abajo con su motivo escrito al lado.
//
// Una excepción sin motivo es un olvido disfrazado de decisión.
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const L = html.split('\n');

// ─── 1 · Las dos funciones existen y están UNA vez ──────────────────────────
//
// Si mañana hay dos `motivoDeFalloAlLeer`, dejó de ser una regla en un lugar y
// pasó a ser dos lugares donde puede estar mal — que es literalmente el defecto
// que este archivo persigue.
function declaracionesDe(nombre) {
  return (html.match(new RegExp('function\\s+' + nombre + '\\s*\\(', 'g')) || []).length;
}
chk('motivoDeFalloAlLeer() está declarada exactamente una vez',
  declaracionesDe('motivoDeFalloAlLeer') === 1, 'veces: ' + declaracionesDe('motivoDeFalloAlLeer'));
chk('textoDeListaVacia() está declarada exactamente una vez',
  declaracionesDe('textoDeListaVacia') === 1, 'veces: ' + declaracionesDe('textoDeListaVacia'));
chk('sinRedSeguro() está declarada exactamente una vez',
  declaracionesDe('sinRedSeguro') === 1, 'veces: ' + declaracionesDe('sinRedSeguro'));

// ─── 2 · No se puede AFIRMAR que no hay conexión sin medirlo ────────────────
//
// `navigator.onLine === true` es mentira de rutina en un barco: el teléfono ve
// la wifi del muelle y la wifi no ve internet. Sólo el `false` es un hecho, y
// es la misma regla que ya aplica `hayRedDeVerdad()`. Si alguien «simplifica»
// esto a `!navigator.onLine`, el cartel va a decir «sin conexión» sobre un
// permiso denegado.
const cuerpoSinRed = (html.match(/function sinRedSeguro\(\)\s*\{[\s\S]*?\n\}/) || [''])[0];
chk('sinRedSeguro() compara contra false explícitamente',
  /navigator\.onLine === false/.test(cuerpoSinRed), cuerpoSinRed.slice(0, 120));
chk('sinRedSeguro() no usa la negación suelta',
  !/!\s*navigator\.onLine/.test(cuerpoSinRed));
chk('sinRedSeguro() sobrevive a que navigator no exista',
  /try\s*\{/.test(cuerpoSinRed) && /catch/.test(cuerpoSinRed));

// ─── 3 · El motivo no se adivina por el texto del error ─────────────────────
//
// Clasificar por el mensaje ya falló en producción el 07/10 con Fran probando
// modo avión: cada navegador lo redacta distinto. Acá el único código que se
// mira es el de Postgres, que sí es un dato.
const cuerpoMotivo = (html.match(/function motivoDeFalloAlLeer\(error\)\s*\{[\s\S]*?\n\}/) || [''])[0];
chk('motivoDeFalloAlLeer() devuelve null cuando no hubo error',
  /if \(!error\) return null;/.test(cuerpoMotivo));
chk('motivoDeFalloAlLeer() reconoce el 42501 de RLS',
  /42501/.test(cuerpoMotivo));
chk('motivoDeFalloAlLeer() no clasifica por error.message',
  !/error\.message/.test(cuerpoMotivo), cuerpoMotivo.slice(0, 200));

// ─── 4 · Es SÍNCRONA, y eso es el punto ─────────────────────────────────────
//
// Meter un `await` en un camino de dibujo sería agregar otro viaje a la red en
// el arranque — la enfermedad que este cambio vino a curar, no la cura. Si
// alguien la vuelve async para «medir mejor la red», este test lo frena.
chk('motivoDeFalloAlLeer() NO es async',
  !/async function motivoDeFalloAlLeer/.test(html));
chk('textoDeListaVacia() NO es async',
  !/async function textoDeListaVacia/.test(html));

// ─── 5 · El detalle crudo no se le pega al usuario ──────────────────────────
//
// Un `error.message` es texto de afuera y casi todos los que llaman lo meterían
// en una plantilla de innerHTML. Va a la consola, que es donde sirve.
const cuerpoTexto = (html.match(/function textoDeListaVacia\(error, claveVacia\)\s*\{[\s\S]*?\n\}/) || [''])[0];
chk('textoDeListaVacia() no mete error.message en lo que se muestra',
  !/error\.message/.test(cuerpoTexto), cuerpoTexto.slice(0, 200));
chk('textoDeListaVacia() registra el error en consola',
  /console\.error/.test(cuerpoTexto));
chk('textoDeListaVacia() usa la clave de vacío sólo cuando NO hubo error',
  /if \(!error\) return t\(claveVacia\);/.test(cuerpoTexto));

// ─── 6 · La regla, sitio por sitio ──────────────────────────────────────────
//
// Un «estado vacío» es una línea que dibuja un texto de «todavía no hay nada».
// Si arriba suyo, en la misma función, hay una lectura a Supabase, entonces esa
// línea PUEDE estar mintiendo y tiene que pasar por la función.
//
// Las excepciones llevan su motivo. No son «todavía no lo hice»: son sitios
// donde el texto no afirma nada sobre los datos.
const EXCEPCIONES = {
  tt_no_boat_select:  'es el placeholder de un <select>, no un estado vacío: dice «ninguna embarcación», que es una opción válida',
  gr_link_none:       'ídem, la opción «sin vincular» de un <select>',
  tk_no_due_date:     'es el texto de un campo sin fecha, no de una lista vacía',
  wv_remind_no_email: 'es la etiqueta de un botón deshabilitado, no una lista',
  crew_no_access:     'habla del permiso de quien mira, no de si hay datos',
  crew_no_selected:   'dice que no se eligió a nadie todavía, no que no haya nadie',
  fleet_select_boat_hint: 'es una instrucción («elegí una embarcación»), no un recuento',
};

const RX_VACIO = /fleet-empty|empty-state|_no_|_none|_empty|no_crew_yet/;
const RX_DIBUJA = /innerHTML|textContent|= `|\+= `/;
const RX_LECTURA = /const\s*\{\s*data[^}]*\}\s*=\s*await\s+(sb|tripsVigentes|consultaDeSalidas)/;

let revisados = 0, sinCubrir = [];
L.forEach((linea, i) => {
  if (!RX_VACIO.test(linea) || !RX_DIBUJA.test(linea)) return;
  // ¿Hay una lectura arriba, cerca?
  let lectura = null;
  for (let j = i - 1; j >= Math.max(0, i - 25); j--) {
    if (/^(async )?function /.test(L[j])) break;        // se salió de la función
    if (RX_LECTURA.test(L[j])) { lectura = L[j]; break; }
  }
  if (!lectura) return;
  revisados++;
  const exceptuado = Object.keys(EXCEPCIONES).some(k => linea.includes(k));
  // Pasar por la función es UNA de las dos formas de consultar el error. La
  // otra, más vieja y también correcta, es cortar antes con un `if (error)` —
  // así lo hacen el listado de actas y el guardado de equipo. La primera
  // versión de este guardián sólo miraba la función y marcó esos dos como si
  // mintieran: un guardián que llama defecto a lo que ya está bien se termina
  // apagando, y entonces no protege de nada.
  const cortaAntes = L.slice(i - 25 < 0 ? 0 : i - 25, i).some(l => /if \(error[)\s]/.test(l));
  const cubierto = /textoDeListaVacia\(/.test(linea) || cortaAntes;
  if (!cubierto && !exceptuado) sinCubrir.push((i + 1) + ': ' + linea.trim().slice(0, 110));
});

chk('hay estados vacíos bajo una lectura para revisar (si no, el test se quedó ciego)',
  revisados >= 15, 'revisados: ' + revisados);

// ─── 6b · Y la variable del error tiene que EXISTIR en esa función ──────────
//
// Esto lo agregó un bug mío, el mismo día. Aplicando la pasada con un script,
// el reemplazo de la lectura cayó en `checkDoubleBookings()` y el del estado
// vacío en `loadTodaysTripList()` — dos funciones distintas. Cada cadena era
// única, así que la comprobación de unicidad pasó; lo que nunca se comprobó fue
// que pertenecieran a la MISMA función. Quedó un `errTrips` declarado en una y
// usado en la otra: un ReferenceError en la pantalla del barco, con la suite
// entera en verde.
//
// El guardián de arriba tampoco lo vio, porque miraba la FORMA de la llamada y
// no si podía correr. Una llamada bien escrita a una variable que no existe se
// ve igual de bien.
const sinDeclarar = [];
L.forEach((linea, i) => {
  const m = linea.match(/textoDeListaVacia\(\s*([A-Za-z_$][\w$]*)\s*,/);
  // La propia declaración no cuenta: ahí `error` es el parámetro.
  if (!m || m[1] === 'null' || /function textoDeListaVacia/.test(linea)) return;
  const v = m[1];
  let declarada = false;
  for (let j = i; j >= 0; j--) {
    if (new RegExp('(const|let|var)\\s*\\{[^}]*\\b' + v + '\\b|(const|let|var)\\s+' + v + '\\b').test(L[j])) {
      declarada = true; break;
    }
    // El techo de la función. Pero la línea del techo también declara: los
    // PARÁMETROS son declaraciones, y pasarle el error a quien dibuja es
    // justamente la forma correcta de arreglar el cruce de funciones.
    if (/^(async )?function /.test(L[j])) {
      if (new RegExp('function\\s+\\w+\\s*\\([^)]*\\b' + v + '\\b').test(L[j])) declarada = true;
      break;
    }
  }
  if (!declarada) sinDeclarar.push((i + 1) + ': ' + v + ' no está declarada en esa función');
});
chk('cada variable de error usada existe en la función que la usa',
  sinDeclarar.length === 0, '\n      ' + sinDeclarar.join('\n      '));
chk('ningún estado vacío bajo una lectura se dibuja sin consultar el error',
  sinCubrir.length === 0, '\n      ' + sinCubrir.join('\n      '));

// Una excepción que ya no corresponde a nada es basura que afloja el guardián:
// mañana alguien reusa esa clave para una lista de verdad y pasa sin mirar.
Object.keys(EXCEPCIONES).forEach(clave => {
  chk('la excepción ' + clave + ' sigue existiendo en el código',
    html.includes(clave), 'si se borró, sacar su línea de EXCEPCIONES');
});
Object.entries(EXCEPCIONES).forEach(([clave, motivo]) => {
  chk('la excepción ' + clave + ' tiene un motivo escrito', (motivo || '').length > 25);
});

// ─── 7 · El calendario devuelve un contrato, no un arreglo pelado ───────────
//
// `fetchTripsForRange()` perdía el error adentro. Se descartó devolver el
// arreglo con el error colgado como propiedad porque `renderWeekView()` hace
// `.filter(...)` y el filtro devuelve un arreglo nuevo: la marca se habría
// perdido en silencio, que es la misma clase de bug.
chk('fetchTripsForRange() devuelve { salidas, error }',
  /return \{ salidas: data \|\| \[\], error: error \|\| null \};/.test(html));
chk('fetchTripsForRange() también devuelve el contrato en la salida temprana',
  /return \{ salidas: \[\], error: null \};/.test(html));
const llamados = (html.match(/await fetchTripsForRange\(/g) || []).length;
const desestructuran = (html.match(/const \{ salidas: \w+, error: \w+ \} = await fetchTripsForRange\(/g) || []).length;
chk('los tres llamados desestructuran el contrato',
  llamados > 0 && llamados === desestructuran, llamados + ' llamados, ' + desestructuran + ' desestructuran');

// ─── 8 · La pantalla de arranque fallido no empuja a cerrar sesión ──────────
//
// Tenía UN botón, «Cerrar sesión y reintentar». Sin señal eso no reintenta
// nada: borra la sesión, y volver a entrar NECESITA red. Un instructor en un
// barco que lo apretara se quedaba afuera hasta volver a puerto.
chk('la acción principal del fallo de arranque recarga, no desloguea',
  /id="boot-error-retry" onclick="location\.reload\(\)"/.test(html));
chk('cerrar sesión quedó como acción secundaria',
  /id="boot-error-signout" onclick="bootErrorSignOut\(\)"/.test(html));
const cuerpoShow = (html.match(/function showBootError\(err\)\s*\{[\s\S]*?\n\}/) || [''])[0];
chk('showBootError() mide la red antes de decidir qué ofrecer',
  /sinRedSeguro\(\)/.test(cuerpoShow));
chk('sin red, el botón de cerrar sesión NO se ofrece',
  /salir\.style\.display = offline \? 'none'/.test(cuerpoShow), cuerpoShow.slice(0, 300));
chk('el texto de ayuda cambia cuando no hay red',
  /boot_err_help_offline/.test(cuerpoShow));

// ─── 9 · Los textos nuevos están en los DOS diccionarios ────────────────────
['lec_no_se_pudo', 'lec_sin_conexion', 'lec_sin_permiso', 'lec_otro_motivo',
 'boot_err_title', 'boot_err_title_offline', 'boot_err_help', 'boot_err_help_offline',
 'boot_err_retry', 'boot_err_signout'].forEach(clave => {
  const veces = (html.match(new RegExp('(^|[\\s{])' + clave + ':', 'gm')) || []).length;
  chk('la clave ' + clave + ' está en los dos diccionarios', veces === 2, 'veces: ' + veces);
});

// ─── 10 · Cada texto de arranque lleva su respaldo en español ───────────────
//
// Un fallo de arranque no es el momento de estrenar un supuesto sobre qué
// cargó y qué no.
const cuerpoRespaldo = (html.match(/function textoDeArranque\(clave, respaldo\)\s*\{[\s\S]*?\n\}/) || [''])[0];
chk('textoDeArranque() cae al respaldo si t() no devuelve nada útil',
  /s !== clave/.test(cuerpoRespaldo), cuerpoRespaldo.slice(0, 200));
chk('textoDeArranque() sobrevive a que t() lance',
  /catch/.test(cuerpoRespaldo));

console.log('\n' + pass + ' pasaron, ' + fail + ' fallaron');
process.exit(fail ? 1 : 0);
