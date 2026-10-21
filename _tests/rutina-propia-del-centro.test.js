// A1-b1 · Un centro se queda con SU copia de una rutina de departamento.
//
//   node _tests/rutina-propia-del-centro.test.js
//
// El A1-a (21/10) construyó el camino de lectura detrás de un interruptor, y
// dejó algo que había que resolver antes del editor de ítems: **sin una copia
// que editar, prender el interruptor no cambia nada.** Y una función que nadie
// puede disparar es exactamente la trampa de la etapa 3a — tres días con un
// interruptor que no hacía nada y la suite en verde.
//
// Así que primero la pantalla que crea la copia, después el editor.
//
// La diferencia con los tipos de salida: la «lista estándar» de una rutina NO
// vive en `checklist_seeds`, vive **en el código**, en `DEPARTMENT_ROUTINES_I18N`.
// No hizo falta ninguna tabla nueva.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('./jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function chk(n, ok, x) {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (x ? '  ' + x : '')); }
}

// ─── 1 · La tarjeta existe y está en Configuración ─────────────────────────
chk('hay una tarjeta de rutinas por departamento',
    /id="card-dept-routines"/.test(html) && /id="dept-routines-list"/.test(html));
chk('y se dibuja al cargar Configuración',
    /await dibujarRutinasDeDepartamento\(\);/.test(html));

// ─── 2 · Los textos, en los DOS diccionarios ───────────────────────────────
for (const clave of ['rut_card_title', 'rut_card_desc', 'rut_standard', 'rut_own_copy',
                     'rut_make_own', 'rut_copy_error', 'rut_load_error']) {
  const n = (html.match(new RegExp('\\n\\s*' + clave + ':', 'g')) || []).length;
  chk(`${clave} está en inglés y en español`, n === 2, `${n} definiciones`);
}

// ─── 3 · Se copia del objeto CRUDO, no del resuelto ────────────────────────
//
// `departmentRoutinesGet()` resuelve el idioma de quien mira. Copiar de ahí
// guardaría la rutina en un solo idioma **para siempre**, y los ítems de
// plantilla son bilingües a propósito (decidido por Fran el 07/10). Es el mismo
// error que la 3a arregló para la caché y que repetí en la 3b doce líneas más
// abajo.
const cuerpoCopia = html.slice(html.indexOf('async function copiarRutinaEstandar'),
                               html.indexOf('async function rutinasConCopia'));
chk('copiarRutinaEstandar lee el objeto crudo',
    /DEPARTMENT_ROUTINES_I18N\[deptKey\]/.test(cuerpoCopia));
chk('y NO el resuelto por idioma',
    !/departmentRoutinesGet\(\)/.test(cuerpoCopia));
chk('guarda los dos idiomas',
    /text_en: it\.en \|\| null, text_es: it\.es \|\| null/.test(cuerpoCopia));

// ─── 4 · Una plantilla sin ítems no se deja viva ───────────────────────────
//
// Con cero ítems activos, `cargarConTresCapas()` no cachea un vacío y el barco
// cae a la **lista cableada sin aviso**: el centro creería tener su lista y la
// tripulación vería otra. Es la misma regla que el editor de la etapa 4 ya tenía
// («no puede quedar sin ningún ítem activo»), acá del lado de la creación.
chk('si fallan los ítems, la plantilla vacía se borra',
    /from\('checklist_templates'\)\.delete\(\)\.eq\('id', templateId\)/.test(cuerpoCopia));
chk('y si el borrado también falla, se dice',
    /y qued[óo] una plantilla vac[íi]a/.test(cuerpoCopia));
chk('el motivo del fallo sale de la función compartida',
    (cuerpoCopia.match(/await motivoDeFalloAlEscribir\(/g) || []).length === 2);
chk('y tira la copia local al terminar',
    /cacheLocalBorrar\(nombreEnCacheDeRutina\(deptKey, cadence\)\)/.test(cuerpoCopia));

// ─── 5 · Si no se pudo medir, no se afirma ─────────────────────────────────
const cuerpoDibujo = html.slice(html.indexOf('async function dibujarRutinasDeDepartamento'),
                                html.indexOf('async function arrancarRutinaPropia'));
chk('sin poder leer las copias, la tarjeta lo dice',
    /if \(!copias\)/.test(cuerpoDibujo) && /rut_load_error/.test(cuerpoDibujo));
chk('una sola consulta para las 16 rutinas',
    (html.slice(html.indexOf('async function rutinasConCopia'),
                html.indexOf('async function dibujarRutinasDeDepartamento'))
      .match(/sb\.from\(/g) || []).length === 1);
chk('y sólo dueño o encargado ve el botón',
    /\(!propia && puede\)/.test(cuerpoDibujo)
    && /const puede = puedeEditarPlantillas\(\)/.test(cuerpoDibujo));

// ─── 6 · Con la app corriendo ──────────────────────────────────────────────
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.sevenseasops.com/' });
const { window } = dom;
let insertado = { plantillas: [], items: [] };
let fallarItems = false;
let borrados = 0;
function tabla(nombre) {
  const h = { get(t, p) {
    if (p === 'insert') return (filas) => {
      if (nombre === 'checklist_templates') insertado.plantillas.push(filas);
      if (nombre === 'checklist_template_items') {
        if (fallarItems) return new Proxy({ __err: true }, h);
        insertado.items.push(filas);
      }
      return new Proxy({}, h);
    };
    if (nombre === 'checklist_template_items' && p === 'then' && fallarItems) {
      return (res) => Promise.resolve({ data: null, error: { code: '42501' } }).then(res);
    }
    if (p === 'delete') { borrados++; return () => new Proxy({}, h); }
    if (p === 'then') {
      return (res) => Promise.resolve({
        data: nombre === 'checklist_templates' ? [{ id: 'tpl-nueva' }] : [], error: null }).then(res);
    }
    return () => new Proxy({}, h);
  } };
  return new Proxy({}, h);
}
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: null } }),
          getUser: async () => ({ data: { user: { id: 'u-fran' } } }),
          onAuthStateChange: () => ({ data: { subscription: {} } }) },
  from: (n) => tabla(n), functions: { invoke: async () => ({}) } }) };
window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
window.Chart = function () {};

const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts.find(s => s.includes('[Seven Seas] build'));
const hook = main + `
;window.__t={
  org:(id)=>{currentOrgId=id;},
  yo:(id)=>{currentUserId=id;},
  rol:(r)=>{currentUserRole=r;},
  idioma:(l)=>{currentLanguage=l;},
  copiar:(d,c)=>copiarRutinaEstandar(d,c),
  cableados:(d,c)=>itemsCableadosDeLaRutina(d,c)
};`;
let boot = null; try { window.eval(hook); } catch (e) { boot = e; }
chk('arranca sin excepción', !boot, boot ? String(boot).slice(0, 300) : '');
if (boot) { console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`); process.exit(fail); }

const T = window.__t;
(async () => {
  T.org('org-1'); T.yo('u-fran'); T.rol('owner'); T.idioma('en');

  const motivo = await T.copiar('captain', 'morning');
  chk('copiar una rutina estándar no da error', motivo === null, String(motivo));

  const pl = insertado.plantillas[0] || {};
  chk('la plantilla va con scope department', pl.scope === 'department', String(pl.scope));
  chk('y con el departamento, que es lo que el CHECK exige',
      pl.department === 'captain', String(pl.department));
  chk('sin trip_type_id', !('trip_type_id' in pl));
  // `role_scope` queda nulo: su significado lo fija RLS (es un ROL del staff) y
  // 'deck' y 'stewards' no son roles. La convención la copia `custom_checklists`,
  // que separa `dept_key` de `role_scope`.
  chk('y sin role_scope, que significa otra cosa', !('role_scope' in pl));
  chk('la cadencia es la de la app, no la del CHECK viejo',
      pl.cadence === 'morning', String(pl.cadence));

  const items = insertado.items[0] || [];
  const cableados = T.cableados('captain', 'morning');
  chk('copia todos los ítems de la rutina', items.length === cableados.length,
      `${items.length} vs ${cableados.length}`);
  chk('en los dos idiomas', !!(items[0] && items[0].text_en && items[0].text_es),
      JSON.stringify(items[0] || {}).slice(0, 110));
  chk('y en orden', items[0].order_index === 0 && items[1].order_index === 1);

  // El inglés y el español son textos DISTINTOS: si fueran iguales, alguien
  // copió el resuelto y el idioma quedó congelado.
  chk('el inglés y el español no son el mismo texto',
      items[0].text_en !== items[0].text_es,
      `${items[0].text_en} | ${items[0].text_es}`);

  // Una cadencia que no tiene rutina cableada no se puede copiar: inventar
  // contenido sería peor que no ofrecerlo.
  const sinRutina = await T.copiar('captain', 'weekly');
  chk('una cadencia sin rutina cableada no se copia', typeof sinRutina === 'string',
      String(sinRutina));

  console.log(`\n${pass + fail} comprobaciones, ${fail} fallos`);
  process.exit(fail);
})();
