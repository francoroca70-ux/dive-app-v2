// Qué departamentos ve cada rol — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/dept-visibility.test.js
//
// Hay DOS mapas casi idénticos y conviene no confundirlos:
//   DEPT_ROUTINE_VISIBILITY_BY_ROLE  → qué pestañas VE un rol
//   deptKeyForRole()                 → bajo qué pestaña se ARCHIVAN sus
//                                      checklists propias
// Este test cubre los dos justamente para que no se los toque a la vez.
// 28/10 · El default del rol dejó de inventar.
//
// Lo encontró Fran probando en el celular sin datos: es DUEÑO y Checklists le
// mostró UN departamento. Medido en la app en vivo: `currentUserRole` tenía
// `'instructor'` como valor inicial, así que un rol que no llega a cargar no
// deja a la app sin saber — la deja **afirmando** que sos instructor, y a un
// dueño le esconde tres departamentos sin decir nada.
//
// Lo que estas comprobaciones afirman es la REGLA, no el valor: que el valor
// inicial no sea un rol real, que no se invente uno en ningún camino, y que con
// el rol sin confirmar se muestren todos los departamentos **y se diga**.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u1'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>new Proxy({},{get(t,p){ if(p==='then') return (r)=>Promise.resolve({data:[],count:0,error:null}).then(r);
                                   return ()=>new Proxy({},this); }}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={setRole:(r)=>{currentUserRole=r;},elevated:(v)=>{window.currentCaptainElevated=v;},"+
  "deptKeyForRole:(r)=>deptKeyForRole(r),setOrg:(id)=>{currentOrgId=id;}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
const ve=(rol,elev)=>{ window.__t.setRole(rol); window.__t.elevated(!!elev);
                       return window.visibleDeptKeysForCurrentUser().slice().sort(); };
const TODOS=['captain','deck','instructor','stewards'].sort();

chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

// ── Lo que cambió ──
chk('capitán ve los cuatro departamentos',
    JSON.stringify(ve('captain'))===JSON.stringify(TODOS), ve('captain').join(','));
chk('capitán ve cubierta', ve('captain').includes('deck'));
chk('capitán ve instructor (mantenimiento del equipo de buceo)', ve('captain').includes('instructor'));
chk('capitán ve cocina y servicio (liveaboard/yate)', ve('captain').includes('stewards'));

// ── Lo que NO tenía que cambiar ──
chk('deckhand sigue viendo sólo cubierta', JSON.stringify(ve('deckhand'))===JSON.stringify(['deck']), ve('deckhand').join(','));
chk('instructor sigue viendo sólo instructor', JSON.stringify(ve('instructor'))===JSON.stringify(['instructor']), ve('instructor').join(','));
chk('divemaster sigue viendo sólo instructor', JSON.stringify(ve('divemaster'))===JSON.stringify(['instructor']));
chk('steward sigue viendo sólo cocina', JSON.stringify(ve('steward'))===JSON.stringify(['stewards']));
chk('engineer sigue viendo sólo cubierta', JSON.stringify(ve('engineer'))===JSON.stringify(['deck']));
chk('dueño sigue viendo todo', JSON.stringify(ve('owner'))===JSON.stringify(TODOS));
chk('gerente sigue viendo todo', JSON.stringify(ve('manager'))===JSON.stringify(TODOS));
chk('front_desk (sin mapa) sigue viendo todo', JSON.stringify(ve('front_desk'))===JSON.stringify(TODOS));

// ── El otro mapa, el que NO se tocó ──
chk('las checklists propias del capitán se archivan bajo «capitán», no bajo las cuatro',
    window.__t.deptKeyForRole('captain')==='captain', String(window.__t.deptKeyForRole('captain')));
chk('las del deckhand siguen bajo cubierta', window.__t.deptKeyForRole('deckhand')==='deck');
chk('las del divemaster siguen bajo instructor', window.__t.deptKeyForRole('divemaster')==='instructor');
chk('las del chef siguen bajo cocina', window.__t.deptKeyForRole('chef')==='stewards');


// ── El interruptor «ver todos los departamentos» (opción D) ──
window.__t.setOrg('org-1');
const key='deptShowAll:org-1';
window.localStorage.removeItem(key);

window.__t.setRole('deckhand');
chk('apagado: el deckhand sigue viendo sólo cubierta',
    JSON.stringify(ve('deckhand'))===JSON.stringify(['deck']), ve('deckhand').join(','));

window.toggleDeptShowAll(true);
window.__t.setRole('deckhand');
chk('encendido: el deckhand ve los cuatro',
    JSON.stringify(ve('deckhand'))===JSON.stringify(TODOS), ve('deckhand').join(','));
chk('queda guardado en localStorage', window.localStorage.getItem(key)==='true');
chk('y encendido también lo ve el instructor',
    JSON.stringify(ve('instructor'))===JSON.stringify(TODOS));

window.toggleDeptShowAll(false);
window.__t.setRole('deckhand');
chk('se puede volver atrás', JSON.stringify(ve('deckhand'))===JSON.stringify(['deck']), ve('deckhand').join(','));

// La preferencia es por organización: no se filtra a otra.
window.localStorage.setItem('deptShowAll:org-1','true');
window.__t.setOrg('org-2'); window.__t.setRole('deckhand');
chk('la preferencia no se cuela a otra organización',
    JSON.stringify(ve('deckhand'))===JSON.stringify(['deck']), ve('deckhand').join(','));
window.__t.setOrg('org-1');

// ── A quién se le muestra el interruptor ──
const muestra=(rol,elev)=>{ window.__t.setRole(rol); window.__t.elevated(!!elev); return !window.roleSeesEveryDept(); };
chk('se le muestra al deckhand', muestra('deckhand'));
chk('se le muestra al instructor', muestra('instructor'));
chk('NO se le muestra al dueño', !muestra('owner'));
chk('NO se le muestra al gerente', !muestra('manager'));
chk('NO se le muestra al capitán (ya ve los cuatro)', !muestra('captain'));
chk('NO se le muestra a un rol fuera del mapa', !muestra('front_desk'));

// ── Y el rol no se PISA después de recuperarlo ──
//
// 28/10, medido leyendo el arranque: después de `loadSettings()` había un
// `loadCurrentUserRole()` que releía `staff` y `staff_locations` por el mismo id
// para dejar puestas las mismas dos variables. Dos viajes de red para recalcular
// lo que ya estaba — y en el arranque sin señal, al fallar la lectura, **pisaba
// con null el rol que la identidad local acababa de recuperar**.
//
// Era la segunda causa del departamento único que vio Fran en el celular. El
// default `'instructor'` la tapaba: con el rol en null el síntoma cambiaba de
// cara, no desaparecía.
{
  const sinComentarios2 = html.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  chk('nadie relee el rol después de loadSettings',
      !/loadCurrentUserRole/.test(sinComentarios2),
      'si vuelve, va con su motivo y mirando el error antes de pisar nada');
  // Lo que se afirma es la REGLA, no un conteo: **nadie vuelve a pedirle el rol
  // a la base**. Era lo que hacían `loadCurrentUserRole()` y, peor, el arranque
  // de la pantalla de Checklists. Las asignaciones que quedan salen de
  // `loadSettings`, de la identidad local y del alta de una organización — todas
  // de un dato que ya está en la mano, ninguna de un viaje de red.
  chk('nadie le pide el rol a la base para saber quién mira',
      !/from\('staff'\)\.select\('role'\)/.test(sinComentarios2),
      'eran dos lugares, y el de Checklists corría justo antes de dibujar los departamentos');
}

// ── El rol no se inventa ──
//
// Las tres primeras miran el CÓDIGO, porque el valor inicial se evalúa al
// arrancar y a esa altura ya se perdió: para cuando el test puede preguntar,
// alguien ya lo pisó.
const sinComentarios = html.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
chk('el valor inicial del rol no es un rol real',
    /let currentUserRole = null;/.test(sinComentarios),
    'null = no se sabe; un rol de verdad ahí es una afirmación sin medir');
chk('y ningún camino cae a un rol inventado',
    !/\|\| 'instructor'/.test(sinComentarios),
    'eran tres lugares: el inicial, el arranque con sesión guardada y loadSettings');
chk('hay un solo lugar que decide si el rol está sin confirmar',
    (sinComentarios.match(/function rolSinConfirmar\(/g) || []).length === 1);

// ── Y con el rol sin confirmar: se ven TODOS, y se dice ──
window.__t.setRole(null); window.__t.elevated(false);
const sinRol = window.visibleDeptKeysForCurrentUser();
chk('sin rol confirmado se listan los cuatro departamentos',
    sinRol.length === 4, sinRol.join(','));
chk('y eso NO es lo que pasaba con el default viejo',
    JSON.stringify(ve('instructor')) !== JSON.stringify(sinRol),
    'con instructor era un solo departamento — ese era el síntoma de Fran');

window.__t.setRole(null);
chk('rolSinConfirmar() lo detecta', window.rolSinConfirmar() === true);
chk('y con un rol de verdad no molesta', (window.__t.setRole('owner'), window.rolSinConfirmar() === false));

// El aviso tiene que existir en los DOS idiomas, y no afirmar de más: dice que
// no se pudo confirmar, no que el rol cambió.
for (const clave of ["cl_rol_sin_confirmar: '"]) {
  chk('el aviso está definido dos veces (en y es)',
      (html.match(new RegExp('cl_rol_sin_confirmar:', 'g')) || []).length === 2);
}
chk('el aviso no vosea', !/cl_rol_sin_confirmar: '[^']*(confirmá|fijate|mirá|podés|tenés)/.test(html));
chk('la pantalla tiene dónde mostrarlo',
    /id="dept-rol-sin-confirmar"/.test(html));
chk('y initDeptChecklists lo pinta',
    /dept-rol-sin-confirmar/.test(sinComentarios.slice(sinComentarios.indexOf('function initDeptChecklists'))),
    'una función que decide sin pantalla donde aparecer es la mitad del arreglo');

// ─── 29/10 · El aviso de doble reserva estaba en inglés duro y sin escapar ───
//
// Dos reglas escritas del proyecto rotas en la misma función: «todo string nuevo
// va en los dos diccionarios» y «el texto del centro no entra crudo al
// innerHTML». Un centro en español leía un cartel entero en inglés, y el nombre
// de una embarcación o de un contacto se interpretaba como HTML.
{
  const fuente = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const fn = fuente.slice(fuente.indexOf('async function checkDoubleBookings'));
  const cuerpo = fn.slice(0, fn.indexOf('\n}'));

  chk('el aviso no tiene inglés duro',
      !/Double-booking detected|is booked for both|is assigned to both|This isn't a bug/.test(cuerpo),
      'una app bilingüe desde el primer día no puede tener un cartel sin clave');
  for (const k of ['dbl_title', 'dbl_note', 'dbl_boat', 'dbl_crew']) {
    chk('usa la clave ' + k, cuerpo.includes("t('" + k + "')") || cuerpo.includes(k + "')"));
    chk('y ' + k + ' está en los dos diccionarios',
        (fuente.match(new RegExp('\\s' + k + ':', 'g')) || []).length === 2,
        (fuente.match(new RegExp('\\s' + k + ':', 'g')) || []).length + ' veces');
  }
  // Lo que se afirma es la regla: ningún nombre del centro llega al texto sin
  // pasar por el escapado. Los cuatro —embarcación, dos contactos, tripulante—
  // van por el mismo ayudante, así que se afirma que no hay otro camino.
  chk('ningún nombre del centro entra sin escapar',
      !/\$\{(a|b|c)\.(boats|staff|contact_name)/.test(cuerpo) &&
      cuerpo.includes('escapeHtml(v || t(clave))'),
      'nombre de embarcación, de contacto y de tripulante iban crudos al innerHTML');
  chk('y el aviso se repinta al cambiar de idioma',
      fuente.includes("repintarAlCambiarIdioma('aviso de doble reserva'"),
      'escribe su texto una vez: sin entrada en el registro se queda en el idioma viejo');
}

console.log('\n' + (fail ? 'HAY FALLOS' : 'todo en verde') + ' — dept-visibility');
process.exit(fail);
