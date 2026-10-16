// POS etapa 1 · catálogo y líneas de venta, detrás de un interruptor.
//
//   node _tests/pos-etapa-1.test.js
//
// Lo que este archivo PUEDE y NO puede verificar, y conviene tenerlo claro:
//
//   PUEDE  · que el interruptor esté apagado en producción
//          · que se declare en UN solo lugar
//          · que CAMBIARLO cambie el comportamiento — la etapa 3a tuvo tres
//            días un interruptor inerte con la suite en verde
//          · que la pantalla vieja quede intacta con el interruptor apagado
//
//   NO PUEDE · nada de la base. El stub de Supabase no tiene CHECK, ni FK, ni
//             RLS, ni transacciones. Que una venta no quede a medias, que el
//             precio salga del catálogo y que no se venda sin stock **se midió
//             contra la base real** en una transacción revertida, y eso no se
//             puede repetir desde acá. Ver `El POS detrás de un interruptor`.
const { JSDOM } = require('./jsdom');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function chk(nombre, ok, detalle) {
  if (ok) { pass++; console.log('PASS  ' + nombre); }
  else { fail++; console.log('FAIL  ' + nombre + (detalle ? '  ' + detalle : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ─── 1 · El interruptor ─────────────────────────────────────────────────────

chk('el interruptor está APAGADO en producción',
    /const POS_VENTAS = false;/.test(html),
    'prenderlo es decisión de Fran, no efecto colateral de un commit');

// La regla es «se declara una vez y lo lee UNA función», no un conteo de
// menciones: un comentario que lo nombra no es un lector. Contar apariciones
// ya falló dos veces el mismo día —con CHECKLIST_CADENCIAS y con
// lineaDeFuenteDeLista—, así que acá se cuentan sólo las líneas de CÓDIGO.
const lineasConPOS = html.split('\n')
  .map(l => l.trim())
  .filter(l => l.includes('POS_VENTAS'))
  .filter(l => !l.startsWith('//') && !l.startsWith('<!--') && !l.startsWith('*'));
chk('se declara una vez y lo lee una sola función',
    lineasConPOS.length === 2 &&
    lineasConPOS.some(l => l.startsWith('const POS_VENTAS')) &&
    lineasConPOS.some(l => l.startsWith('function posEstaPrendido')),
    lineasConPOS.length + ' líneas de código: ' + JSON.stringify(lineasConPOS));

chk('y el único lector es posEstaPrendido()',
    /function posEstaPrendido\(\) \{ return POS_VENTAS === true; \}/.test(html));

// ─── 2 · Lo estructural ─────────────────────────────────────────────────────

chk('una venta se registra con UNA llamada al servidor',
    /sb\.rpc\('registrar_venta'/.test(html) &&
    (html.match(/sb\.rpc\('registrar_venta'/g) || []).length === 1,
    'varios insert() seguidos no son una transacción');

chk('el cliente NO manda el precio',
    !/unit_price:/.test(html.slice(html.indexOf('async function confirmarVenta'),
                                   html.indexOf('async function confirmarVenta') + 900)),
    'el precio lo lee registrar_venta del catálogo');

chk('no se creó una tabla de productos nueva',
    !/from\('products'\)/.test(html) && !/from\('pos_items'\)/.test(html),
    'el catálogo es gear_items — «un motor, dos techos»');

chk('la moneda sale del único lugar que recuerda la org',
    /window\.currentOrgCurrency = \(org && org\.currency\)/.test(html) &&
    (html.match(/window\.currentOrgCurrency =/g) || []).length === 1);

chk('quien vende se resuelve en una sola función',
    (html.match(/function nombreDeQuienVende\(/g) || []).length === 1 &&
    /p_sold_by: await nombreDeQuienVende\(\)/.test(html));

// El nombre del artículo y la moneda son texto del centro: van escapados.
chk('lo que escribe el centro va escapado',
    /escapeHtml\(trGearItemName\(v\.item\.name\)\)/.test(html) &&
    /escapeHtml\(precioEnPantalla/.test(html));

// ─── 3 · El comportamiento, corriendo el index.html de verdad ───────────────

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/index.html' });
const { window } = dom;
const scripts = [...window.document.querySelectorAll('script')].map(s => s.textContent);
window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
window.scrollTo = () => {};
window.supabase = { createClient: () => ({
  auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} },
  from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) })
}) };
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const main = scripts.find(s => s.includes('[Seven Seas] build'));
// El interruptor se reevalúa en las dos posiciones. `POS_VENTAS` es const, así
// que no se puede reasignar: se reconstruyen las funciones que lo leen con el
// otro valor, que es lo que de verdad prueba que el interruptor hace algo.
const hook = main + "\n;window.__t={" +
  "setIdioma:(l)=>{currentLanguage=l;}," +
  "setRol:(r)=>{currentUserRole=r;}," +
  "setOrg:(id)=>{currentOrgId=id;}," +
  "prendido:()=>posEstaPrendido()," +
  "bloque:(i)=>bloqueDeVentaDeItem(i)," +
  "vendibles:(it,sm)=>itemsVendibles(it,sm)," +
  "moneda:()=>monedaDelCentro()," +
  "precio:(n)=>precioEnPantalla(n)," +
  "clave:(a,b)=>claveDeCarrito(a,b)," +
  // La misma función con el interruptor en la otra posición.
  "bloqueConInterruptorPrendido:(i)=>{const POS_VENTAS=true;" +
  "  const posEstaPrendido=()=>POS_VENTAS===true;" +
  "  return eval('(' + bloqueDeVentaDeItem.toString() + ')')(i);}," +
  "t:(k)=>t(k)};";
let boot = null;
try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 200) : '');

try {
const T = window.__t;
T.setIdioma('es'); T.setRol('owner'); T.setOrg('org-1');

const remera = { id: 'it-1', name: 'Remera', for_sale: true, sale_price: 35, track_sizes: true,
                 gear_item_sizes: [{ size_label: 'M', sort_order: 1 }, { size_label: 'L', sort_order: 2 }] };
const regulador = { id: 'it-2', name: 'Reguladores', for_sale: false, sale_price: null, track_sizes: false };

// ── El interruptor hace algo, y es lo que la 3a no tenía
chk('con el interruptor APAGADO no se ofrece nada de venta',
    T.prendido() === false && T.bloque(remera) === '',
    '«' + T.bloque(remera) + '»');
const conPrendido = T.bloqueConInterruptorPrendido(remera);
chk('y PRENDIDO sí — cambiarlo cambia el resultado',
    typeof conPrendido === 'string' && conPrendido.length > 0 &&
    /pos-precio-input/.test(conPrendido),
    conPrendido.slice(0, 60));

// ── Qué se puede vender
const stock = { 'it-1|M': { available_count: 4 }, 'it-1|L': { available_count: 0 },
                'it-2|total': { available_count: 9 } };
const v = T.vendibles([remera, regulador], stock);
chk('sólo se ofrece lo marcado a la venta',
    v.every(x => x.item.id === 'it-1'), JSON.stringify(v.map(x => x.item.id)));
// Ofrecer algo sin stock sería dejar que alguien lo tilde para que el servidor
// lo rechace después. El talle L tiene 0.
chk('y sólo los talles que tienen stock',
    v.length === 1 && v[0].size === 'M' && v[0].disponible === 4,
    JSON.stringify(v.map(x => x.size)));
chk('un artículo a la venta sin precio no se ofrece',
    T.vendibles([{ ...remera, sale_price: null }], stock).length === 0,
    'el CHECK de la base lo impide, y la pantalla no lo asume');

// ── La moneda y el formato
chk('la moneda cae en USD si la org no dijo otra', T.moneda() === 'USD', T.moneda());
window.currentOrgCurrency = 'THB';
chk('y sigue a la org cuando la dice', T.moneda() === 'THB', T.moneda());
chk('el precio se muestra con moneda y dos decimales',
    T.precio(35) === 'THB 35.00', T.precio(35));
chk('un precio roto no imprime NaN',
    !/NaN|undefined/.test(T.precio(undefined)), T.precio(undefined));
window.currentOrgCurrency = 'USD';

// ── La clave del carrito es la misma que la del stock, no una segunda
chk('la clave del carrito coincide con la de stockMap',
    T.clave('it-1', 'M') === 'it-1|M' && T.clave('it-1') === 'it-1|total',
    T.clave('it-1'));

// ── Los textos existen en los dos diccionarios
chk('los textos del POS están en castellano', T.t('pos_cobrar') === 'Registrar venta', T.t('pos_cobrar'));
T.setIdioma('en');
chk('y en inglés', T.t('pos_cobrar') === 'Record sale', T.t('pos_cobrar'));
// El aviso de que no se puede anular tiene que estar: es la limitación que
// mantiene el interruptor apagado, y callarla sería prometer de más.
chk('se avisa que una venta no se puede anular todavía',
    /cannot be undone/.test(T.t('pos_sin_anular')), T.t('pos_sin_anular'));
T.setIdioma('es');

chk('el cuerpo del test corrió hasta el final', true);
} catch (e) {
  chk('el cuerpo del test corrió hasta el final', false, String(e && e.stack || e).slice(0, 400));
}

console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
process.exit(fail ? 1 : 0);
