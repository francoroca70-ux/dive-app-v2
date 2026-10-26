// El centro VE sus ventas, y una venta se anula con un contra-asiento.
//
//   node _tests/run-all.js      (preferido)
//
// EL HUECO QUE LO ORIGINÓ, medido el 26/10 y que no estaba en ninguna nota:
// **nada en la app leía `sales` ni `sale_lines`.** Ni una consulta. La etapa 1
// construyó la mitad que escribe —venta, líneas, stock, todo en una
// transacción— y la mitad que LEE quedó sin construir. Un centro podía
// registrar una venta y después no tenía forma de verla.
//
// Y le pega justo al agujero que el Roadmap POS nombra como el importante:
// «hoy la app no puede contestar ¿qué vendimos hoy?, sólo cuánto entró».
//
// LO QUE ESTE ARCHIVO NO PUEDE VERIFICAR, y es la mitad que importa de la
// anulación: nada de la base. El stub de Supabase no tiene CHECK, ni FK, ni
// índices únicos, ni triggers, ni transacciones. Que anular devuelva el stock,
// que no se pueda anular dos veces, que una venta no se pueda editar y que
// `qty: -5` desde el navegador se rechace **se verifica contra la base real**,
// y al 26/10 **no se verificó**: la migración `_sql/anular-una-venta.sql` está
// escrita y sin aplicar. Esa es exactamente la razón por la que el interruptor
// sigue apagado.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');
const { lineasDeCodigoCon } = require('./contar');

let pass = 0, fail = 0;
function chk(n, ok, x) { if (ok) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); } }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · La dependencia de la migración queda ESCRITA al lado del interruptor ─
//
// Prender `POS_VENTAS` sin la migración aplicada deja un botón de anular que
// llama a una función que no existe, y una venta que cualquiera del centro
// puede editar. Que eso esté escrito justo donde está el interruptor es la
// única defensa real: el que lo prenda va a leer esa línea.
chk('el interruptor sigue apagado', /const POS_VENTAS = false;/.test(html));
chk('y al lado está dicho de dónde sale el lado del servidor',
    /_sql\/anular-una-venta\.sql`, \*\*aplicado el/.test(html),
    'el que prenda el interruptor lee esa línea');
chk('el archivo de la migración existe',
    fs.existsSync(path.join(__dirname, '..', '_sql', 'anular-una-venta.sql')));

const sql = fs.readFileSync(path.join(__dirname, '..', '_sql', 'anular-una-venta.sql'), 'utf8');

// ─── 2 · Lo que el SQL tiene que afirmar ────────────────────────────────────
//
// No se está probando la base: se está probando que el SQL escrito dice lo que
// la decisión dice. Es un guardián de intención, no una verificación.
chk('la anulación es un contra-asiento, no una bandera',
    /voids_sale_id/.test(sql) && !/voided_at\s+timestamptz/.test(sql),
    'con una bandera, cada suma de plata necesitaría acordarse de filtrar');
chk('una venta se anula una sola vez',
    /create unique index sales_una_anulacion_por_venta/.test(sql));
chk('una venta no se anula a sí misma',
    /voids_sale_id is distinct from id/.test(sql));
chk('un motivo sin anulación no se permite',
    /void_reason is null or voids_sale_id is not null/.test(sql));
chk('las líneas pueden ser negativas',
    /check \(qty <> 0\)/.test(sql));
// EL HALLAZGO: aflojar esa CHECK saca la única defensa contra `qty: -5` desde
// el navegador. Si alguien recorta la migración y deja la CHECK floja sin el
// guardián, vuelve el agujero.
chk('y al aflojarla, registrar_venta valida la cantidad a mano',
    /if v_qty is null or v_qty <= 0 then/.test(sql),
    'esa CHECK era lo único que impedía sumar stock con una cantidad negativa');
chk('la anulación conserva el precio de la venta original',
    /v_linea\.unit_price/.test(sql),
    'si la remera subió de 35 a 40, anular la venta de ayer devuelve 35');
chk('el stock vuelve con un movimiento de motivo Anulación',
    /reason.*'Anulación'|'Anulación'/.test(sql) &&
    /available_count = available_count \+ v_linea\.qty/.test(sql));
chk('una venta es inmutable en dos capas, como el acta',
    /drop policy org_isolation on public\.sales/.test(sql) &&
    /create trigger trg_venta_inmutable/.test(sql),
    'RLS sin UPDATE ni DELETE, más un trigger que frena saltando RLS');
chk('y las líneas también',
    /create trigger trg_linea_de_venta_inmutable/.test(sql));
chk('el EXECUTE se revoca de public, no de authenticated por nombre',
    /revoke execute on function public\.anular_venta\(uuid, text, text\) from public/.test(sql),
    'se hereda de PUBLIC: revocar por nombre de rol no hace nada');

// ─── 3 · Una sola llamada, un solo lugar ────────────────────────────────────
chk('anular es UNA llamada al servidor',
    (html.match(/sb\.rpc\('anular_venta'/g) || []).length === 1,
    'cuatro escrituras desde el cliente no son una transacción');
chk('quién puede anular se decide en una función',
    (html.match(/function puedeAnularVenta\(/g) || []).length === 1 &&
    lineasDeCodigoCon(html, 'puedeAnularVenta()').length === 3,
    'la declaración, el guardián del handler y el botón');
// El día del centro sale de `fechaLocal()`, que nació acá el 26/10 como
// `fechaLocalDeHoy` y a las dos horas se convirtió en la única del archivo:
// resultó que la misma cuenta estaba copiada 37 veces, y la versión vieja
// (`formatDate`) daba la fecha UTC. El detalle vive en `fecha-local.test.js`.
// Y el día se manda como VENTANA DE INSTANTES, no como texto: `sold_at` es
// `timestamptz` y un string sin huso lo lee Postgres en UTC. Detalle en
// `ventana-del-dia.test.js`.
chk('la lista del día usa fechaLocal y la manda como ventana de instantes',
    /const v = ventanaDelDia\(fechaLocal\(\)\);/.test(html) &&
    (html.match(/function fechaLocal\(/g) || []).length === 1);
chk('y no quedó ninguna fecha de calendario sacada del UTC',
    lineasDeCodigoCon(html, "toISOString().split('T')[0]").length === 0);

// ─── 4 · El comportamiento, con el index.html de verdad ─────────────────────
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/index.html' });
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.scrollTo = () => {};
window.supabase = { createClient: () => ({
  auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} },
  from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) })
}) };
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const scripts = [...window.document.querySelectorAll('script')].map(s => s.textContent);
const main = scripts.find(s => s.includes('[Seven Seas] build'));

// El interruptor se reevalúa en las dos posiciones reconstruyendo las funciones
// que lo leen, igual que `pos-etapa-1`. `POS_VENTAS` es const: no se reasigna.
const hook = main + `
;window.__t={
  setIdioma:(l)=>{currentLanguage=l;},
  setRol:(r)=>{currentUserRole=r;},
  puedeAnular:()=>puedeAnularVenta(),
  emparejar:(f)=>emparejarAnulaciones(f),
  totalNeto:(f)=>totalNetoDeVentas(f),
  render:(f)=>renderVentasDelDia(f),
  renderPrendido:(f)=>{
    const POS_VENTAS=true;
    const posEstaPrendido=()=>POS_VENTAS===true;
    return eval('(' + renderVentasDelDia.toString() + ')')(f);
  },
  t:(k)=>t(k)
};`;
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot && boot.stack || boot).slice(0, 300) : '');

try {
if (boot) throw boot;
const T = window.__t;
T.setIdioma('es');

const linea = (qty, precio, nombre) => ({ qty, unit_price: precio, item_name: nombre || 'Remera', size_label: 'M' });
const venta = { id: 'v-1', sold_at: '2026-10-26T14:30:00Z', sold_by: 'Pau',
                voids_sale_id: null, void_reason: null, sale_lines: [linea(2, 35)] };
const anulacion = { id: 'v-2', sold_at: '2026-10-26T15:00:00Z', sold_by: 'Fran',
                    voids_sale_id: 'v-1', void_reason: 'Se la llevó mal', sale_lines: [linea(-2, 35)] };

// ── El total NETEA sin que nadie filtre nada. Es la razón entera de que la
//    anulación sea un contra-asiento y no una bandera.
chk('una venta sola suma su monto', T.totalNeto([venta]) === 70, String(T.totalNeto([venta])));
chk('la venta con su anulación netea a cero, SIN filtrar nada',
    T.totalNeto([venta, anulacion]) === 0, String(T.totalNeto([venta, anulacion])));
// Y la contracara, que es lo que prueba que el neteo no es casualidad: si las
// líneas de la anulación fueran positivas, el total daría el doble.
chk('si la anulación fuera en positivo el total daría 140 — por eso va negativa',
    T.totalNeto([venta, { ...anulacion, sale_lines: [linea(2, 35)] }]) === 140);

// ── El emparejado
const pares = T.emparejar([venta, anulacion]);
chk('la anulación no se lista como una venta más',
    pares.length === 1 && pares[0].venta.id === 'v-1',
    JSON.stringify(pares.map(p => p.venta.id)));
chk('y queda colgada de la venta que anula',
    pares[0].anulacion && pares[0].anulacion.id === 'v-2');
// Una anulación de una venta de ayer no tiene su original en la lista de hoy.
// Se muestra sola: esconderla dejaría un total que no cierra con lo que se ve.
const sueltas = T.emparejar([anulacion]);
chk('una anulación cuya venta es de otro día se muestra sola',
    sueltas.length === 1 && sueltas[0].venta.id === 'v-2' && sueltas[0].anulacion === null);

// ── Quién puede anular
T.setRol('owner');    chk('el dueño puede anular', T.puedeAnular() === true);
T.setRol('manager');  chk('el encargado también', T.puedeAnular() === true);
T.setRol('deckhand'); chk('un marinero no', T.puedeAnular() === false);
T.setRol('captain');  chk('ni el capitán', T.puedeAnular() === false,
                          'registrar una venta sí; deshacerla mueve plata y stock');

// ── EL INTERRUPTOR HACE ALGO
T.setRol('owner');
// El div se busca en el DOM REAL del index.html: no se crea acá. Crear uno con
// un id que ya existe hizo que el render dibujara en el de verdad y el test
// midiera su propio hueco vacío — cuatro veces ya. Si el id desaparece del
// HTML, esto falla, que es lo correcto.
const div = window.document.getElementById('pos-ventas-del-dia');
chk('el div de la lista existe en el HTML real', !!div,
    'si esto falla, el render dibuja en la nada y el test mide su propio hueco');
T.render([venta]);
chk('con el interruptor APAGADO no se dibuja nada',
    div.innerHTML === '', '«' + div.innerHTML.slice(0, 60) + '»');
T.renderPrendido([venta]);
const dibujado = div.innerHTML;
chk('y PRENDIDO sí — cambiarlo cambia el resultado',
    dibujado.length > 0 && /pos-venta/.test(dibujado), dibujado.slice(0, 80));
chk('se ve el monto de la venta', /70\.00/.test(dibujado), dibujado.slice(0, 160));
chk('y quién la registró', /Pau/.test(dibujado));
chk('el dueño ve el botón de anular', /pos-venta-anular/.test(dibujado));

// Una venta anulada NO se esconde: se tacha y se sella.
T.renderPrendido([venta, anulacion]);
const conAnulada = div.innerHTML;
chk('una venta anulada queda en la lista, sellada',
    /pos-venta anulada/.test(conAnulada) && /Anulada/.test(conAnulada),
    conAnulada.slice(0, 120));
chk('con el motivo que escribió quien anuló',
    /Se la llevó mal/.test(conAnulada));
chk('y el total mostrado es el neto, no la suma bruta',
    /0\.00/.test(conAnulada) && !/70\.00/.test(conAnulada.split('pos-total')[1] || ''),
    'si mostrara 70 el total no cerraría con lo que se ve tachado');

// ── Un marinero no ve el botón, aunque la lista sí
T.setRol('deckhand');
T.renderPrendido([venta]);
chk('un marinero ve la lista pero no el botón de anular',
    /pos-venta/.test(div.innerHTML) && !/pos-venta-anular/.test(div.innerHTML));
T.setRol('owner');

// ── El texto del centro va escapado. `item_name` lo escribe el centro.
T.renderPrendido([{ ...venta, sold_by: "O'Brien & Co <b>x</b>",
                    sale_lines: [linea(1, 10, 'Remera <script>x</script>')] }]);
chk('el nombre del artículo va escapado',
    !/<script>/.test(div.innerHTML) && /&lt;script&gt;/.test(div.innerHTML));
chk('y quién vendió también',
    !/<b>x<\/b>/.test(div.innerHTML) && /&lt;b&gt;/.test(div.innerHTML));
// El id de la venta entra a un `onclick`, así que necesita las dos capas:
// literal de JS y atributo HTML. `escapeHtml` no toca el apóstrofo.
chk('el id de la venta entra al manejador con escapeJsEnAtributo',
    /anularVenta\('\$\{escapeJsEnAtributo\(venta\.id\)\}'\)/.test(html),
    'ver «El botón que no podía dar de baja a O\'Brien»');

// ── Sin ventas
T.renderPrendido([]);
chk('sin ventas se dice que no se vendió nada, no se esconde la tarjeta',
    /Todavía no se vendió nada hoy/.test(div.innerHTML),
    'una tarjeta ausente se lee igual que una pantalla rota');

// ── Los textos en los dos idiomas
chk('los textos están en castellano', T.t('pos_anular_btn') === 'Anular', T.t('pos_anular_btn'));
T.setIdioma('en');
chk('y en inglés', T.t('pos_anular_btn') === 'Void', T.t('pos_anular_btn'));
T.setIdioma('es');

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
