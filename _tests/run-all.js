// Corre toda la suite y FALLA si un archivo se cortó a mitad.
//
//   node _tests/run-all.js
//
// Por qué existe, con fecha: el 09/10, al agregar el modal de «¿por qué faltó
// este ítem?», tres archivos quedaron esperando un clic que nunca llegaba. El
// `await` no resolvía nunca, la función asíncrona quedaba colgada, node se
// quedaba sin nada que hacer y **terminaba con código 0 sin imprimir una sola
// línea más**.
//
// Resultado: `checklist-record` pasó de 54 comprobaciones a 6, y reportó CERO
// FALLOS. Un archivo que se corta a mitad y dice que todo está bien es peor que
// uno que falla, porque el que falla se ve.
//
// Lo agarré de casualidad, mirando los números de costado. Eso no es un
// proceso: es suerte. De ahí este corredor.
//
// Las tres defensas, en orden de lo que cada una atrapa:
//
//  1 · **Mínimos por archivo.** Si un archivo corre menos comprobaciones que
//      las que ya corría, algo se cortó. Los números SÓLO se tocan para arriba,
//      o bajándolos a mano cuando se borra una comprobación a propósito y se
//      dice por qué en el commit.
//  2 · **Un centinela al final.** Cada archivo imprime su cuenta al terminar.
//      Sin esa línea, no llegó al final.
//  3 · **Un reloj.** Un archivo que no termina en 90 segundos se mata y se
//      reporta, en vez de dejar la suite esperando para siempre.
//
// Y una cuarta, agregada el mismo día porque el guardián **diagnosticó mal**:
// los trece archivos daban cero comprobaciones y los trece decían «se cortó a
// mitad». No se habían cortado: no habían arrancado, porque `require` de jsdom
// apuntaba a una ruta que sólo existe en el sandbox de Claude. Fran salió a
// buscar un corte que no existía.
//
//  4 · **Cero corridas no es «cortado a mitad»: es «no arrancó».** Son dos
//      problemas distintos y mandan a mirar a lugares distintos, así que se
//      nombran distinto y se muestra el error real del proceso.
//
// Un guardián que detecta pero describe mal el problema cuesta tiempo igual que
// no tener guardián.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TIEMPO_MAXIMO_MS = 90000;

// Mínimo de comprobaciones por archivo. Un archivo por debajo de su número se
// cortó a mitad, aunque no reporte ningún fallo.
const MINIMOS = {
  'abrir-sin-internet.test.js':     57,
  'arrancar-del-binario.test.js':   24,
  'arranque-sin-cdn.test.js':      17,
  'acta-pendiente-sin-senal.test.js': 20,
  'autoria-de-tildes.test.js':      41,
  'borrados-avisan.test.js':        17,
  'cambio-agendado.test.js':        28,
  'checklist-progress.test.js':     58,
  'cadencias-noche-y-semanal.test.js': 53,
  'constancia-de-service.test.js':  32,
  'cuenta-interna.test.js':         16,
  'titulo-de-acta.test.js':         32,
  'checklist-record-scope.test.js': 38,
  'checklist-record.test.js':       57,
  'dept-visibility.test.js':        29,
  'editor-de-plantillas.test.js':   92,
  'editor-de-rutinas.test.js':      41,
  'etapa-3b-lista-por-tipo.test.js':25,
  'firmar-sin-senal.test.js':       16,
  'firmar-una-sola-vez.test.js':    27,
  'idioma-de-las-fechas.test.js':   12,
  'imprimir-en-nativo.test.js':     14,
  'fuente-de-la-lista.test.js':     34,
  'linea-de-firma.test.js':         25,
  'listas-que-faltan.test.js':      31,
  'motivo-de-lo-que-falto.test.js': 56,
  'motivo-de-un-rechazo.test.js':   11,
  'onboarding.test.js':             12,
  'plan-limits.test.js':            14,
  'pos-etapa-1.test.js':           24,
  'anular-una-venta.test.js':      46,
  'fecha-local.test.js':           14,
  'ventana-del-dia.test.js':       26,
  'espanol-neutro.test.js':        13,
  'plantillas-tres-capas.test.js':  30,
  'refresco-no-pisa-el-acta.test.js': 23,
  'reset-segunda-pasada.test.js':   40,
  'rutina-propia-del-centro.test.js': 31,
  'rutinas-de-departamento.test.js': 30,
  'salidas-archivadas.test.js':     31,
  'texto-con-cantidad.test.js':     34,
  'texto-de-personas-escapado.test.js': 29,
  'ver-la-contrasena.test.js':      33,
  'service-worker.test.js':        29,
  'sello-de-service.test.js':       36,
  'sesion-sin-verificar.test.js':  37,
  'signer.test.js':                 31,
  'sin-vitrina-en-nativo.test.js':  60,
  'trip-archive.test.js':           43,
  'una-lista-vacia-no-miente.test.js': 51,
  'copia-local-de-lo-que-se-mira.test.js': 35,
};

const archivos = fs.readdirSync(DIR).filter(f => f.endsWith('.test.js')).sort();

// Un archivo nuevo sin mínimo es un olvido: sin número, nunca se va a notar si
// mañana se corta. Se pide agregarlo.
const sinMinimo = archivos.filter(f => !(f in MINIMOS));
const desaparecidos = Object.keys(MINIMOS).filter(f => !archivos.includes(f));

let total = 0, fallos = 0, problemas = [];

for (const f of archivos) {
  const r = spawnSync('node', [path.join(DIR, f)], {
    encoding: 'utf8', timeout: TIEMPO_MAXIMO_MS, maxBuffer: 32 * 1024 * 1024
  });
  const salida = (r.stdout || '') + (r.stderr || '');
  const pass = (salida.match(/^PASS/gm) || []).length;
  const fail = (salida.match(/^FAIL/gm) || []).length;
  const corridas = pass + fail;
  total += corridas; fallos += fail;

  const minimo = MINIMOS[f];
  const colgado = r.signal === 'SIGTERM' || r.error;
  // Cero corridas = no arrancó (una dependencia que falta, un error de sintaxis).
  // Algunas pero menos que el mínimo = arrancó y se cortó. Problemas distintos.
  const noArranco = corridas === 0;
  const corto = !noArranco && minimo != null && corridas < minimo;

  let estado = 'ok';
  if (colgado) estado = 'COLGADO';
  else if (noArranco) estado = 'NO ARRANCÓ';
  else if (fail) estado = 'FALLA';
  else if (corto) estado = 'CORTADO';

  console.log(
    `${f.padEnd(34)} ${String(corridas).padStart(3)} corridas  ` +
    `${String(fail).padStart(2)} fallos  ` +
    (minimo != null ? `(mínimo ${minimo})`.padEnd(14) : ''.padEnd(14)) +
    (estado === 'ok' ? '' : '← ' + estado)
  );

  if (fail) {
    problemas.push(`${f}: ${fail} comprobación(es) fallando`);
    (salida.match(/^FAIL.*$/gm) || []).forEach(l => console.log('    ' + l));
  }
  if (colgado) {
    problemas.push(`${f}: no terminó en ${TIEMPO_MAXIMO_MS / 1000}s — probablemente un await esperando un modal que nadie cierra`);
  } else if (noArranco) {
    // El código 2 lo reserva _tests/jsdom.js para «falta jsdom», que tiene una
    // sola causa y un solo comando que la arregla.
    if (r.status === 2) {
      problemas.push(`${f}: falta jsdom — correr  npm i -D jsdom`);
    } else {
      problemas.push(`${f}: no llegó a correr ninguna comprobación (no es un corte a mitad: no arrancó)`);
    }
    // El error real, que es lo único que dice dónde mirar.
    salida.split('\n').filter(l => l.trim() && !/^\[boot\]/.test(l)).slice(0, 4)
      .forEach(l => console.log('    ' + l.slice(0, 160)));
  } else if (corto) {
    problemas.push(`${f}: corrió ${corridas} de ${minimo} — se cortó a mitad sin reportar fallos`);
    (salida.match(/^(PASS|FAIL).*$/gm) || []).slice(-1).forEach(l =>
      console.log('    última comprobación que alcanzó a correr: ' + l.slice(0, 100)));
  }
}

console.log('─'.repeat(72));
console.log(`${total} comprobaciones, ${fallos} fallos`);

sinMinimo.forEach(f => problemas.push(
  `${f} no tiene mínimo en MINIMOS de run-all.js — sin número no se detecta si mañana se corta`));
desaparecidos.forEach(f => problemas.push(
  `${f} tiene mínimo pero el archivo no está — si se borró a propósito, sacar su línea`));

if (problemas.length) {
  console.log('');
  problemas.forEach(p => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('Todo en verde, y ningún archivo se cortó a mitad.');
