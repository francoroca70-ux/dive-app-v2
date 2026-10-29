// Lo que Fran encontró probando en el celular el 14/10 — index.html real.
//
//   node _tests/abrir-sin-internet.test.js
//
// El hallazgo grande: **la app no abría con el modo avión puesto.** Pantalla
// azul, nada. Y eso contradice lo único que el producto promete de entrada —
// que un instructor pueda tildar una checklist en un barco sin señal.
//
// El mecanismo, medido: la raíz del dominio público redirige a `/landing.html`
// para que un prospecto que teclea el dominio caiga en la página de ventas. Sin
// red ese pedido no se podía contestar ni desde la red ni desde la caché, porque
// `/landing.html` **no estaba en `APP_SHELL`**. El arreglo que importa no es
// cachearla: es **no redirigir sin red**. Alguien sin conexión abriendo el
// dominio no es un prospecto que viene de Google, es el centro abriendo su
// herramienta.
//
// Y el resto de la tanda, que salió de la misma prueba de uso: el acta de una
// checklist propia mostraba `custom_` y un uuid, el título y los ítems iban
// crudos al innerHTML, las tarjetas no se podían plegar, y la pasada abierta por
// Reset se perdía al cerrar la app — que es el bug que dejaba a Fran tildando
// una checklist **sin botón para firmarla**.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const path=require('path');
const P=path.join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');

let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}

// ─── 1 · El redirect de la raíz, corrido de verdad ───
//
// No se afirma «el código tiene una guarda»: se le pasan los cuatro mundos y se
// mira a dónde manda. `new Function` con location/navigator/localStorage
// falsos — el script del head no toca nada más.
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const headScript=scripts.find(s=>s.includes('PUBLIC_HOSTS'));
chk('el script del redirect sigue existiendo',!!headScript);

function aDondeVa({hostname='www.sevenseasops.com',pathname='/',search='',hash='',onLine=true,storage={}}={}){
  let destino=null;
  const claves=Object.keys(storage);
  const fn=new Function('location','navigator','localStorage',headScript);
  fn({hostname,pathname,search,hash,replace:(u)=>{destino=u;}},
     {onLine},
     {length:claves.length,key:(i)=>claves[i],getItem:(k)=>storage[k]});
  return destino;
}

chk('un prospecto con red tecleando el dominio va a la landing',
    aDondeVa()==='/landing.html', String(aDondeVa()));
chk('SIN RED la raíz NO redirige: se queda en la app',
    aDondeVa({onLine:false})===null, String(aDondeVa({onLine:false})));
chk('sin red tampoco redirige en el dominio sin www',
    aDondeVa({hostname:'sevenseasops.com',onLine:false})===null);
chk('`onLine` true no alcanza para nada más que seguir el camino de antes',
    aDondeVa({onLine:true})==='/landing.html');
// Las cuatro excepciones que ya existían siguen en pie: el arreglo no las tocó.
chk('/index.html pedido por nombre no redirige',
    aDondeVa({pathname:'/index.html'})===null);
chk('un deep link de waiver no redirige',
    aDondeVa({search:'?waiver=abc'})===null);
chk('un deep link de invitación no redirige',
    aDondeVa({search:'?invite=abc'})===null);
chk('la recuperación de contraseña, que viaja en el hash, no redirige',
    aDondeVa({hash:'#access_token=xyz&type=recovery'})===null);
chk('con sesión guardada no redirige',
    aDondeVa({storage:{'sb-ggtbxjwstkuhnabwpgdz-auth-token':'{"x":1}'}})===null);
chk('la app nativa carga otro host y nunca entra al redirect',
    aDondeVa({hostname:'dive-app-v2.onrender.com'})===null);
chk('un host desconocido tampoco',
    aDondeVa({hostname:'localhost'})===null);

// ─── 2 · La landing, cacheada ───
chk('/landing.html está en APP_SHELL del service worker',
    /APP_SHELL[\s\S]*?'\/landing\.html'/.test(sw));
chk('siguen estando la raíz y /index.html',
    /APP_SHELL[\s\S]*?'\/'[\s\S]*?'\/index\.html'/.test(sw));

// ─── 3 · El resto, con el index.html real en jsdom ───
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;
function tabla(){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:[],count:0,error:null}).then(res,rej);
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-fran'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>tabla(), rpc:async()=>({data:null,error:null}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={"+
  "setOrg:(id)=>{currentOrgId=id;},setIdioma:(l)=>{currentLanguage=l;},"+
  "rol:(r)=>checklistRoleLabel(r),"+
  "setCustom:(a)=>{customChecklists=a;},"+
  "esc:(s)=>escapeHtml(s),"+
  "pHas:(k)=>pasadasAbiertas.has(k),"+
  "pAdd:(k)=>pasadasAbiertas.add(k),"+
  "pDel:(k)=>pasadasAbiertas.delete(k),"+
  "cerrarApp:()=>{pasadasAbiertas._mem=null;pasadasAbiertas._org=undefined;},"+
  "abiertas:()=>[...checklistsAbiertas],"+
  "cargarAbiertas:()=>cargarChecklistsAbiertas(),"+
  "toggleAbierta:(id)=>toggleChecklistAbierta(id,`custom-cl-body-${id}`,`custom-cl-chev-${id}`),"+
  "toggleDept:(r)=>toggleChecklistAbierta(claveDeptoAbierta(r),'dept-routine-body','dept-routine-chev'),"+
  "t:(k)=>t(k)};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

try{
const T=window.__t;
T.setOrg('org-1');

// ─── 3a · La etiqueta de un acta ───
//
// El bug: `checklistRoleLabel` tenía un mapa de 17 entradas a mano y caía en
// `crewRoleLabel`, que devuelve lo que le entra. Para una checklist propia eso
// era `custom_` + uuid, en la pantalla donde un dueño mira el historial.
T.setCustom([{id:'aaa-111',title:'Revisión de seguridad',cadence:'morning',dept_key:'deck',role_scope:'captain',items:['uno']}]);
chk('una checklist propia se etiqueta con SU nombre',
    T.rol('custom_aaa-111')==='Revisión de seguridad', T.rol('custom_aaa-111'));
chk('nunca aparece el uuid en la etiqueta',
    !/aaa-111/.test(T.rol('custom_aaa-111')), T.rol('custom_aaa-111'));
// Un acta sobrevive a la checklist que la generó: es inmutable. Que no se
// encuentre es normal, y lo que NO puede pasar es que se muestre el uuid.
chk('una propia borrada dice qué es, no el uuid',
    T.rol('custom_zzz-999')===T.t('cl_custom_checklist_generic'), T.rol('custom_zzz-999'));
chk('y tampoco filtra el uuid cuando no la encuentra',
    !/zzz-999/.test(T.rol('custom_zzz-999')), T.rol('custom_zzz-999'));

// Las 16 combinaciones de departamento × cadencia, derivadas y no enumeradas.
const DEPTOS=['captain','instructor','deck','stewards'];
const CADS=['morning','eod','monthly','yearly'];
let derivadasOk=0;
for(const d of DEPTOS) for(const c of CADS){
  const et=T.rol(`${d}_${c}`);
  if(et && et.includes('—') && !et.includes('_')) derivadasOk++;
}
chk('las 16 combinaciones depto × cadencia se derivan',derivadasOk===16,`${derivadasOk}/16`);
chk('la clave vieja «captain», sin sufijo, sigue siendo la rutina de la mañana',
    T.rol('captain').includes('—'), T.rol('captain'));
chk('«instructor» a secas sigue siendo el Gear Prep de una salida',
    T.rol('instructor')===T.t('cl_instructor_dm'), T.rol('instructor'));
chk('un rol desconocido no explota',T.rol('cualquiera')!=null);
chk('null y vacío devuelven cadena vacía',T.rol(null)===''&&T.rol('')==='');

// ─── 3b · «Mañana» se leía como *tomorrow* ───
T.setIdioma('es');
chk('en castellano la cadencia diaria ya no dice «Mañana»',
    T.t('cl_cadence_morning')!=='Mañana', T.t('cl_cadence_morning'));
chk('y dice algo que no se puede confundir con el día siguiente',
    !/^Mañana$/i.test(T.t('cl_cadence_morning')), T.t('cl_cadence_morning'));
chk('hace par con la otra cadencia diaria',
    /día/i.test(T.t('cl_cadence_morning'))&&/día/i.test(T.t('cl_cadence_eod')),
    `${T.t('cl_cadence_morning')} / ${T.t('cl_cadence_eod')}`);
chk('la clave nueva existe en castellano',T.t('cl_custom_checklist_generic')==='Checklist propia');
T.setIdioma('en');
chk('y en inglés',T.t('cl_custom_checklist_generic')==='Custom checklist');
chk('en inglés la cadencia sigue diciendo Morning',T.t('cl_cadence_morning')==='Morning');

// ─── 3c · El texto gris de «¿por qué faltó?» ───
//
// Pedido de Fran: la última oración afuera. Un tripulante firmando no necesita
// que le expliquen para qué le sirve el dato al dueño.
chk('el texto de ayuda ya no habla de contestarle a un cliente',
    !/customer/i.test(T.t('cl_motivos_ayuda')), T.t('cl_motivos_ayuda'));
T.setIdioma('es');
chk('y tampoco en castellano',
    !/cliente/i.test(T.t('cl_motivos_ayuda')), T.t('cl_motivos_ayuda'));
chk('pero sigue diciendo lo que importa: que queda en el acta',
    /acta/i.test(T.t('cl_motivos_ayuda')), T.t('cl_motivos_ayuda'));

// ─── 3d · La pasada abierta sobrevive cerrar la app ───
//
// El bug tal como lo vivió Fran: reseteó una ya firmada, cerró la app, volvió,
// pudo tildar y **no había botón para firmar**. El Set en memoria nacía vacío,
// el guardián encontraba el acta de la primera pasada y escondía el botón: la
// protección pasaba a bloqueo.
const K='org-1|deck_morning|2026-10-14';
chk('una pasada nueva no está abierta',!T.pHas(K));
T.pAdd(K);
chk('se abre',T.pHas(K));
T.cerrarApp();
chk('y SIGUE ABIERTA después de cerrar y reabrir la app',T.pHas(K));
T.pDel(K);
chk('cerrarla la cierra',!T.pHas(K));
T.cerrarApp();
chk('y sigue cerrada al reabrir',!T.pHas(K));
// La llave lleva el período, así que una pasada de hoy no puede aplicarse a la
// de mañana. No hace falta inventar una expiración.
T.pAdd(K);
chk('la pasada de hoy no abre la instancia de otro día',
    !T.pHas('org-1|deck_morning|2026-10-15'));
chk('ni la de otro departamento',!T.pHas('org-1|captain_morning|2026-10-14'));
// Cambiar de organización cambia la clave guardada.
T.setOrg('org-2');
chk('una pasada abierta en un centro no abre nada en otro',!T.pHas(K));
T.setOrg('org-1');
chk('y volviendo al centro de antes sigue ahí',T.pHas(K));
T.pDel(K);

// ─── 3e · Plegar una checklist propia ───
//
// «tengo que ir hasta abajo de todo para ver que tengo la checklist de noche».
// El default es plegado, y lo abierto se recuerda — importa porque la tarjeta se
// redibuja en CADA tilde, así que sin memoria cada tilde la volvería a plegar.
T.cargarAbiertas();
chk('por defecto no hay ninguna abierta',T.abiertas().length===0,JSON.stringify(T.abiertas()));
T.toggleAbierta('aaa-111');
chk('abrir una la recuerda',T.abiertas().includes('aaa-111'),JSON.stringify(T.abiertas()));
T.cargarAbiertas();
chk('y lo recordado sobrevive un redibujo',T.abiertas().includes('aaa-111'));
T.toggleAbierta('aaa-111');
chk('volver a tocarla la cierra',!T.abiertas().includes('aaa-111'));
T.cargarAbiertas();
chk('y eso también se recuerda',!T.abiertas().includes('aaa-111'));
T.toggleAbierta('bbb-222'); T.toggleAbierta('ccc-333');
chk('se pueden tener varias abiertas a la vez',
    T.abiertas().includes('bbb-222')&&T.abiertas().includes('ccc-333'));

// ─── 3f · El texto del centro va escapado ───
//
// Encontrado al entrar a esta tarjeta: `cc.title` y el texto de cada ítem iban
// crudos al innerHTML. Mismo agujero que ya se había tapado en las actas y en
// las listas de tareas — tercer lugar.
const hostil='<img src=x onerror=alert(1)>';
chk('escapeHtml neutraliza el caso hostil',
    !T.esc(hostil).includes('<img'), T.esc(hostil));
const tarjeta=main.slice(main.indexOf('async function renderCustomChecklistsForCurrentView'),
                         main.indexOf('async function renderCustomChecklistsForCurrentView')+4200);
chk('el título de la tarjeta va escapado',
    !/\$\{cc\.title\}/.test(tarjeta)&&/escapeHtml\(cc\.title/.test(tarjeta));
chk('el texto de cada ítem va escapado',
    /cl-item-text">\$\{escapeHtml\(text\)\}/.test(tarjeta));
chk('el rol del ámbito también',/escapeHtml\(crewRoleLabel\(cc\.role_scope\)\)/.test(tarjeta));

// ─── 3g · El recuadro punteado, afuera ───
chk('la tarjeta de una checklist propia ya no tiene borde punteado',
    !/border:1px dashed/.test(tarjeta));

// ─── 3h · Un solo lugar nombra las cadencias ───
//
// El mapa de 17 líneas era cuatro ediciones por cadencia nueva, y una cadencia
// que falte en uno de los cuatro departamentos no se nota: la etiqueta cae al
// `crewRoleLabel` y muestra la clave cruda, que es exactamente el bug de arriba.
const sinComentarios=main.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
// Lo que importa es que el mapa se DECLARE una sola vez, no cuántos lo leen.
// La primera versión de esta comprobación exigía exactamente dos apariciones
// —una declaración y un lector— y falló el 15/10 en cuanto el selector del
// formulario de checklist propia pasó a leer el mismo mapa. Eso es justamente
// lo que queremos: un lector más de la única fuente. Contar lectores era
// encodear «hoy hay uno», el mismo error que contar «tres consultas crudas» en
// el guardián de salidas.
const declCad=(sinComentarios.match(/const CHECKLIST_CADENCIAS\s*=/g)||[]).length;
chk('CHECKLIST_CADENCIAS se declara exactamente una vez',declCad===1,String(declCad));
const declDept=(sinComentarios.match(/const CHECKLIST_DEPTOS\s*=/g)||[]).length;
chk('CHECKLIST_DEPTOS también',declDept===1,String(declDept));
// Y nadie escribe su propio mapa de cadencia → clave de traducción al lado.
const mapasSueltos=(sinComentarios.match(/\bmorning:\s*'cl_cadence_morning'/g)||[]).length;
chk('y nadie arma un segundo mapa de cadencias',mapasSueltos===1,String(mapasSueltos));
chk('ya no queda el mapa enumerado de 17 entradas',
    !/stewards_yearly:\s*`/.test(sinComentarios));


// ─── El arranque no precarga pantallas que nadie está mirando ───
//
// Medido en el navegador el 28/10: 39 pedidos a Supabase en **26 olas
// secuenciales**, 5,65 s de reloj — y 22 de esos 39 eran de pantallas que al
// arrancar no están en la pantalla.
//
// Lo que volvió esto una deleción y no un mecanismo: **`showPage()` ya recarga
// cada pantalla al abrirla**. El arranque pedía datos que se vuelven a pedir
// igual. Iba a construir un registro de «cargar al abrir» y al medir apareció
// que existía.
//
// Lo que se afirma es la regla: **si `showPage()` la carga al abrir, el arranque
// no la precarga.** Las de Configuración se quedan a propósito, porque
// `showPage('settings')` NO las recarga — ahí el arranque es la única carga que
// hay, y diferirlas dejaría la pantalla vacía.
{
  const cuerpoDe = (nombre) => {
    const i = sinComentarios.indexOf('async function ' + nombre + '(');
    if (i < 0) return '';
    let prof = 0, fin = i;
    for (let j = i; j < sinComentarios.length; j++) {
      if (sinComentarios[j] === '{') prof++;
      if (sinComentarios[j] === '}') { prof--; if (prof === 0) { fin = j; break; } }
    }
    return sinComentarios.slice(i, fin + 1);
  };
  const arranque = cuerpoDe('initAuthInner') || cuerpoDe('initAuth');
  chk('se encontró el cuerpo del arranque', arranque.length > 200, arranque.length + ' caracteres');

  for (const f of ['loadFleet', 'loadCrew', 'renderCalendar']) {
    chk('el arranque no precarga ' + f,
        !new RegExp('(^|[^.\\w])' + f + '\\(\\)').test(arranque),
        'showPage() ya la llama al abrir esa pantalla');
    chk('y showPage() sí la llama al abrir', new RegExp(f + '\\(\\)').test(sinComentarios),
        'si se borra de las dos puntas, la pantalla queda vacía');
  }

  // Las cuatro de Configuración, en UNA ola. La dependencia está medida: las
  // cuatro filtran sólo por currentOrgId y ninguna escribe currentLocationId.
  chk('las cuatro lecturas de Configuración van en una sola ola',
      /Promise\.allSettled\(\[\s*loadLocations\(\),\s*syncCategoryCheckboxes\(\),\s*renderTripTypesList\(\),\s*dibujarRutinasDeDepartamento\(\)\s*\]\)/.test(sinComentarios),
      'eran cuatro esperas en fila');

  // Los tres avisos, en una sola ola.
  chk('los tres avisos del arranque van en una sola ola',
      /Promise\.allSettled\(\[\s*checkCrewNotifications\(\),\s*checkTasksNotifications\(\),\s*checkChecklistNotifications\(\)\s*\]\)/.test(sinComentarios));

  // allSettled y no all: una lectura que falla no se lleva a las otras.
  chk('y usa allSettled, no all',
      !/Promise\.all\(\[\s*loadLocations/.test(sinComentarios) &&
      !/Promise\.all\(\[\s*checkCrewNotifications/.test(sinComentarios),
      'con all un solo rechazo deja las otras tres sin dibujar');

  // La lectura de locales del staff arranca ANTES de esperar la de staff.
  chk('las dos lecturas de identidad arrancan juntas',
      sinComentarios.indexOf('const pLocsDelStaff =') < sinComentarios.indexOf(".from('staff')\n    .select('org_id"),
      'las dos van por user.id; esperarlas de a una eran dos olas');
  chk('y la de locales se espera donde se usa',
      /const \{ data: locRows \} = await pLocsDelStaff;/.test(sinComentarios));

  // El nombre del centro no se vuelve a pedir: viene del select('*').
  chk('updateHomeBanner acepta el centro ya leído',
      /async function updateHomeBanner\(orgYaLeido\)/.test(sinComentarios) &&
      /await updateHomeBanner\(org\);/.test(sinComentarios),
      'era un segundo viaje por un dato que ya estaba en la mano');
}


// ─── C11 · El registro de repintados, y por qué no es una lista ─────────────
//
// Tres episodios con la misma causa antes de esto: el cartel de sin conexión,
// el detalle de un barco, y la tarjeta de rutinas — los tres se quedaban en el
// idioma anterior porque `refreshDynamicTranslations()` era una lista escrita a
// mano y nadie se acordó de ampliarla. El defecto nacía en silencio: ni error,
// ni consola, ni test en rojo. Un texto en el idioma de antes que alguien tenía
// que notar de casualidad.
//
// Lo que estas comprobaciones afirman es la REGLA, no el inventario.
{
  const cuerpo = sinComentarios.slice(sinComentarios.indexOf('function refreshDynamicTranslations'),
                                      sinComentarios.indexOf('function setLanguage'));
  chk('quien repinta no tiene una lista propia: recorre el registro',
      cuerpo.includes('for (const entrada of repintadosDeIdioma)'),
      'una lista acá es N lugares donde puede faltar una entrada');
  chk('y el cuerpo quedó corto — no es una lista disfrazada',
      cuerpo.split('\n').length < 25, cuerpo.split('\n').length + ' líneas');

  const entradas = (sinComentarios.match(/repintarAlCambiarIdioma\('/g) || []).length;
  chk('hay al menos las 29 entradas que tenía la lista', entradas >= 29, entradas + ' entradas');

  // Cada entrada lleva NOMBRE, y los nombres no se repiten: un registro
  // duplicado repinta dos veces, y eso en una pantalla que lee de la base son
  // dos viajes por lo mismo.
  const nombres = [...sinComentarios.matchAll(/repintarAlCambiarIdioma\('([^']+)'/g)].map(m => m[1]);
  const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i);
  chk('ningún nombre de entrada está repetido', repetidos.length === 0, repetidos.join(', '));

  // Un redibujo que falla no puede dejar la app en dos idiomas a la vez.
  chk('cada entrada corre en su propio try',
      cuerpo.includes('try {') && cuerpo.includes('catch'),
      'sin esto, una excepción a mitad del registro parte la app en dos idiomas');

  // Las condiciones viven en funciones reutilizables, no copiadas en cada
  // entrada — una condición repetida es N lugares donde puede estar mal.
  for (const f of ['pantallaActiva', 'hayCentro', 'visible']) {
    chk('la condición ' + f + ' se declara una vez',
        (sinComentarios.match(new RegExp('function ' + f + '\\(')) || []).length === 1);
  }
}

// ─── J3/J4 · Las olas del panel de Inicio ──────────────────────────────────
//
// Medido en el navegador el 29/10: cambiar de idioma estando en Inicio costaba
// **15 pedidos en 12 OLAS casi todas en fila**, y por eso bajar de 34 a 15
// pedidos movió el tiempo de 2,2 a 2,0 s y nada más. **Lo que se paga es la
// fila, no la cantidad** — la misma lección que el arranque.
//
// Y el hallazgo que lo destapó, que corrige un cambio del 28/10: guardar una
// consulta de supabase-js en una variable NO la manda. Comprobado contra
// producción: tras guardarla, 0 pedidos; tras esperarla, 1.
{
  chk('lanzar() se declara una vez',
      (sinComentarios.match(/function lanzar\(/g) || []).length === 1);

  // La regla, no el inventario: una consulta que se guarda para esperar después
  // tiene que pasar por `lanzar()`, o no está en vuelo y el paralelismo es
  // decorativo.
  const guardadasCrudas = [...sinComentarios.matchAll(/const (p[A-Z]\w*)\s*=\s*sb\.from\(/g)].map(m => m[1]);
  chk('ninguna consulta se guarda cruda esperando salir sola',
      guardadasCrudas.length === 0, guardadasCrudas.join(', ') + ' — les falta lanzar()');

  // `updateAppContext` SÍ va sola y antes: deja puesto `currentLocationId`, y
  // las dos de abajo filtran por él. Paralelizar las tres daría números
  // plausibles y equivocados — de todos los locales en vez de uno.
  const banner = sinComentarios.slice(sinComentarios.indexOf('async function updateHomeBanner'),
                                      sinComentarios.indexOf('function locationStorageKey'));
  chk('el contexto del local se resuelve antes, y solo',
      /await updateAppContext\(/.test(banner) &&
      banner.indexOf('await updateAppContext(') < banner.indexOf('allSettled'),
      'si va en paralelo, las burbujas cuentan las salidas de todos los locales');
  chk('las burbujas y el panel se arman en UNA ola',
      /allSettled\(\[refreshHomeStats\(\), renderHomeGettingStartedOrFinance\(\)\]\)/.test(banner),
      'eran dos esperas en fila sin dependencia entre ellas');

  // Las tarjetas de Inicio: ninguna rama vuelve a esperarlas de a una.
  const enFila = (sinComentarios.match(/blocks\.push\(await build/g) || []).length;
  chk('ninguna tarjeta de Inicio se espera en fila', enFila === 0, enFila + ' quedaron en fila');
  const ramas = (sinComentarios.match(/blocks\.push\(\.\.\.await tarjetasEnParalelo\(/g) || []).length;
  chk('las tres ramas de rol usan el mismo armador', ramas === 3, ramas + ' ramas');
  chk('tarjetasEnParalelo preserva el orden del arreglo, no el de llegada',
      /\.map\(\(x, i\)/.test(sinComentarios) &&
      sinComentarios.includes('async function tarjetasEnParalelo'),
      'sin esto el panel se reordena solo según la latencia');
  chk('y una tarjeta que falla no se lleva a las otras',
      /tarjetasEnParalelo[\s\S]{0,300}allSettled/.test(sinComentarios));

  // Las cuatro de Configuración sólo se leen si alguien la está mirando.
  chk('Configuración sólo se carga si se la está mirando',
      sinComentarios.includes("if (pantallaActiva('settings')()) await cargarContenidosDeConfiguracion();"),
      "4 de los 28 pedidos del arranque eran de una pantalla que nadie abrió");
  chk('y usa la MISMA condición que el repintado de idioma',
      sinComentarios.split("pantallaActiva('settings')").length - 1 >= 2,
      'dos criterios para «se está mirando» son dos lugares donde puede estar mal');

  // La precarga de pantallas aparecía SIEMPRE como el mismo trío, y en cuatro
  // caminos de entrada — no en dos, como yo creía el 28/10. Lo que se afirma es
  // que el trío no existe en ningún lado, no cuántas veces aparece cada llamada:
  // un número habría pasado con sólo subirlo.
  const trio = /loadFleet\(\);\s*loadCrew\(\);\s*(await )?renderCalendar\(\);/;
  chk('ningún camino de entrada precarga el trío de pantallas',
      !trio.test(sinComentarios),
      'showPage() ya carga cada pantalla al abrirla; al arrancar se muestra Inicio');

  // La lista de primeros pasos es una tarjeta más, no una ola previa.
  chk('la lista de primeros pasos se arma como una tarjeta',
      /async function buildGettingStartedHtml/.test(sinComentarios) &&
      /buildGettingStartedHtml()/.test(sinComentarios.slice(sinComentarios.indexOf('tarjetasEnParalelo(['))),
      'era una espera aparte y previa, una ola para decidir si se muestra algo');
  chk('y devuelve vacío cuando los tres pasos están hechos',
      sinComentarios.includes("hasBoat && hasPricedTrip && hasCrew) return '';"),
      'sin eso no puede ir en la misma ola que las otras');

  // Las burbujas: lo único que espera de verdad es la cuenta de huéspedes.
  const stats = sinComentarios.slice(sinComentarios.indexOf('async function refreshHomeStats'));
  const cuerpoStats = stats.slice(0, stats.indexOf('\n}'));
  chk('las barcas no esperan a las salidas de hoy',
      cuerpoStats.indexOf('pBoats') < cuerpoStats.indexOf('await tripsQuery'),
      'no dependen de los ids: eran tres olas en fila y son dos');
  chk('y las dos que quedan se cierran juntas',
      cuerpoStats.includes('Promise.all([pGuests, pBoats])'));


  const p2 = sinComentarios.slice(sinComentarios.indexOf('async function buildPhase2ChecklistHtml'));
  const cuerpo2 = p2.slice(0, p2.indexOf('\n}'));
  chk('el equipo se pide ANTES de esperar las categorías',
      cuerpo2.indexOf('pGearItems') < cuerpo2.indexOf('await loadActiveCategories'),
      'eran cuatro olas en fila y son dos cadenas que no se conocen');
  chk('y las dos cadenas se cierran en una sola ola',
      /Promise\.all\(\[pComp, pStock\]\)/.test(cuerpo2));
}

}catch(e){ chk('el cuerpo del test corrió hasta el final',false,String(e).slice(0,300)); }

console.log(`\n${fail?'HAY FALLOS':'todo en verde'} — abrir-sin-internet`);
process.exit(fail);
