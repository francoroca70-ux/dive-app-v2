// El acta de una checklist firmada — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/checklist-record.test.js
//
// Lo que importa no es que se guarde "algo", sino que el acta pueda LEERSE
// SOLA dentro de cinco años: por eso guarda el texto de cada ítem y no sólo
// su id. Las plantillas van a cambiar (checklists por tipo de salida) y un
// registro con ids se vuelve ilegible en cuanto cambien.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;
const TRIPULACION=[{id:'u-ana',full_name:'Ana Diaz',role:'instructor',custom_role_name:null}];
let insertados=[];
// Para forzar el error del insert del acta y distinguir un fallo de red de un
// rechazo del servidor. Formas medidas contra la API real.
let errorAlInsertar=null;
// Qué scope_key se limpió: el progreso NO debe borrarse si el acta no entró.
let limpiados=[];
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:n==='staff'?TRIPULACION:[],count:0,error:null}).then(res,rej);
    if(prop==='insert') return (p)=>{
      if(n==='checklist_completions'&&errorAlInsertar) return Promise.resolve({error:errorAlInsertar});
      insertados.push(p); return Promise.resolve({error:null});
    };
    if(prop==='delete') return ()=>{ const d={get(t2,p2){
        if(p2==='eq') return (c,v)=>{ if(c==='scope_key') limpiados.push(v); return new Proxy({},d); };
        if(p2==='then') return (res)=>Promise.resolve({error:null}).then(res);
        return ()=>new Proxy({},d);
      }}; return new Proxy({},d); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-ana'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={setOrg:(id)=>{currentOrgId=id;},setRole:(r)=>{currentUserRole=r;},"+
  "setTrip:(id)=>{currentChecklistTripId=id;},offline:(v)=>{isOffline=v;},sb:()=>sb,"+
  // Desde el 09/10 el firmante sale de `currentUserId` y de quién tildó, no de
  // un `await sb.auth.getUser()` por dibujo.
  "yo:(id)=>{currentUserId=id;},tripulacion:(xs)=>{signerStaffCache=xs;},"+
  "marcar:(tripId,obj)=>{instructorChecksByTrip[tripId]=obj;},items:()=>INSTRUCTOR_ITEMS_get()};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

window.__t.setOrg('org-1'); window.__t.setRole('instructor'); window.__t.offline(false);
window.__t.yo('u-ana'); window.__t.tripulacion(TRIPULACION);
window.showAlertModal=async()=>{}; window.showConfirmModal=async()=>true;

(async()=>{ try {
  // ── buildItemsSnapshot ──
  const items=[{id:'a',text:'Tanques a bordo'},{id:'b',text:'Botiquín abastecido'}];
  let snap=window.buildItemsSnapshot(items,(it)=>it.id==='a');
  chk('el acta guarda el TEXTO, no sólo el id', snap[0].text==='Tanques a bordo', JSON.stringify(snap[0]));
  chk('marca lo tildado', snap[0].done===true);
  chk('marca lo NO tildado', snap[1].done===false);
  // Ítems de texto suelto, indexados por posición (checklists personalizadas)
  snap=window.buildItemsSnapshot(['Toallas','Hielo'],(_i,idx)=>idx===1);
  chk('funciona con ítems de texto suelto', snap[0].text==='Toallas' && snap[1].done===true, JSON.stringify(snap));
  chk('les inventa un id estable por posición', snap[0].id==='0' && snap[1].id==='1');

  // ── Firma incompleta: tiene que quedar registrado QUÉ faltó ──
  await window.populateSignerSelects();
  window.__t.setTrip('trip-1');
  const todos=window.__t.items();
  const tildados={}; todos.slice(0,3).forEach(i=>tildados[i.id]=true);   // 3 de 14
  window.__t.marcar('trip-1',tildados);
  insertados=[];
  await window.instructorSignOff();
  const f=insertados[0]||{};
  chk('se guardó el acta', Array.isArray(f.items_snapshot), typeof f.items_snapshot);
  chk('el acta tiene TODOS los ítems, no sólo los tildados',
      f.items_snapshot.length===todos.length, f.items_snapshot.length+' de '+todos.length);
  chk('los números siguen coincidiendo con el acta',
      f.items_snapshot.filter(i=>i.done).length===f.completed_items, f.completed_items);
  const faltantes=f.items_snapshot.filter(i=>!i.done);
  chk('se puede responder QUÉ faltó', faltantes.length===todos.length-3, faltantes.length+' faltantes');
  chk('y cada faltante se lee solo, sin la plantilla al lado',
      faltantes.every(i=>typeof i.text==='string' && i.text.length>5), JSON.stringify(faltantes[0]));

  // ── Una checklist firmada muestra lo que se revisó y lo que NO ──
  // Antes, al abrir una ya firmada se veía el cartel «completa» arriba de una
  // lista con nada tildado: firmar cierra la instancia y borra el trabajo en
  // curso (correcto), pero la pantalla seguía dibujando la lista viva, vacía.
  // Para el capitán que entra después eso no se lee como «ya está hecho», se
  // lee como que no se hizo nada — y lo que necesita ver es justamente que las
  // toallas NO se cargaron, para poder preguntar por qué.
  const contActa=doc.createElement('div'); contActa.id='acta-prueba';
  doc.body.appendChild(contActa);
  window.renderActaItems('acta-prueba', [
    {id:'a', text:'Toallas a bordo', done:false},
    {id:'b', text:'Tanques cargados', done:true}
  ], null);
  const html2=contActa.innerHTML;
  chk('el acta muestra los ítems que se revisaron', /Tanques cargados/.test(html2));
  chk('y también los que NO', /Toallas a bordo/.test(html2));
  const filas=[...contActa.querySelectorAll('.cl-item')];
  chk('lo hecho se ve tachado', filas[1].classList.contains('checked'), filas[1].className);
  chk('lo que faltó NO se ve tachado', !filas[0].classList.contains('checked'), filas[0].className);
  chk('y lo que faltó queda señalado, no sólo sin tilde',
      /cl-role-badge warn/.test(filas[0].innerHTML), filas[0].innerHTML.slice(0,120));
  chk('el acta no se puede tildar: no tiene onclick',
      filas.every(f=>!f.getAttribute('onclick')), 'sin onclick');
  chk('y se marca como acta para no parecer clicable',
      filas.every(f=>f.classList.contains('acta')));
  chk('dice que es un acta firmada y cómo hacer una pasada nueva',
      /cl-acta-nota/.test(html2) && /Reset|Reiniciar/i.test(html2), 'nota presente');

  // El texto del ítem lo escribe una persona y termina insertado como HTML.
  window.renderActaItems('acta-prueba', [{id:'x', text:'<img src=x onerror=alert(1)>', done:true}], null);
  chk('el texto del ítem se escapa',
      !/<img/.test(contActa.innerHTML) && /&lt;img/.test(contActa.innerHTML), contActa.innerHTML.slice(0,90));

  // Actas de antes del 06/10: no tienen detalle y no se puede reconstruir
  // (son inmutables). Tiene que decirlo, no mentir con una lista vacía.
  contActa.innerHTML='<div class="cl-item">algo</div>';
  window.mostrarActaSiHay('acta-prueba', {items_snapshot:null}, null);
  chk('un acta vieja sin detalle lo dice en vez de mostrar una lista vacía',
      /cl-acta-nota/.test(contActa.innerHTML), contActa.innerHTML.slice(0,110));

  // Los dos caminos que muestran una firmada usan la misma función.
  chk('la salida y la rutina de departamento comparten el arreglo',
      (html.match(/mostrarActaSiHay\(/g)||[]).length===3, // 1 declaración + 2 usos
      (html.match(/mostrarActaSiHay\(/g)||[]).length+' menciones');
  // Desde el 09/10 las columnas están en UNA constante y la consulta en UNA
  // función: eran tres listas idénticas escritas a mano, así que agregarle una
  // columna al acta pedía acordarse de tocar las tres.
  chk('las columnas del acta se piden desde un solo lugar',
      (html.match(/const COLUMNAS_DE_ACTA = '[^']*items_snapshot'/g)||[]).length===1 &&
      (html.match(/select\(COLUMNAS_DE_ACTA\)/g)||[]).length===1,
      'una constante, una consulta');

  // ── El estado de una firmada dice la verdad ──
  // Fran firmó una checklist a medias y la pantalla le dijo «Completo ✓» en
  // verde. El verde con tilde es justamente la señal de que no hay nada que
  // revisar, así que decirlo sobre una lista con huecos es lo contrario de lo
  // que sirve.
  chk('100% tildada queda verde y con tilde',
      window.estadoDeActa({completed_items:16,total_items:16}).clase==='done',
      window.estadoDeActa({completed_items:16,total_items:16}).texto);
  const parcial=window.estadoDeActa({completed_items:6,total_items:16});
  chk('firmada a medias NO queda verde', parcial.clase==='warn', parcial.clase);
  chk('y dice los números, que es lo que el capitán necesita',
      /6/.test(parcial.texto) && /16/.test(parcial.texto), parcial.texto);
  chk('una sin ítems no se declara completa',
      window.estadoDeActa({completed_items:0,total_items:0}).clase==='warn');
  chk('más tildados que el total tampoco rompe',
      window.estadoDeActa({completed_items:20,total_items:16}).clase==='done');

  // Pinta la burbuja y limpia la clase anterior, para que no queden las dos.
  const burbuja=doc.createElement('div'); burbuja.id='burbuja-prueba';
  burbuja.className='cl-role-badge done'; doc.body.appendChild(burbuja);
  window.pintarEstadoDeActa('burbuja-prueba',{completed_items:6,total_items:16});
  chk('al repintar no quedan las dos clases a la vez',
      burbuja.classList.contains('warn') && !burbuja.classList.contains('done'),
      burbuja.className);

  // Un solo lugar decide, y lo usan los tres.
  chk('el estado se decide en un solo lugar',
      (html.match(/function estadoDeActa\(/g)||[]).length===1);
  // Cuatro: al dibujar una ya firmada (2) y al firmarla (2). Este ultimo par
  // lo encontro el test: los firmados ponian «Completo» apenas firmabas,
  // antes de volver a dibujar.
  chk('lo usan los cuatro lugares que pintan estado, mas la lista de actas',
      (html.match(/pintarEstadoDeActa\('/g)||[]).length===4 &&
      (html.match(/estadoDeActa\(r\)/g)||[]).length===2,
      (html.match(/pintarEstadoDeActa\('/g)||[]).length+' burbujas + la lista');
  chk('ya nadie pone «Completo» a mano sin mirar si está completa',
      !/textContent = t\('cl_complete_check'\)/.test(html), 'patrón viejo ausente');

  // ── El marcador de «sin hacer»: mismo ancho, centrado y a la derecha ──
  chk('el marcador va pegado a la derecha con margin-left:auto',
      /\.cl-item \.cl-item-falta \{[\s\S]{0,200}?margin-left: auto/.test(html));
  chk('todos del mismo ancho y con el texto centrado',
      /\.cl-item \.cl-item-falta \{[\s\S]{0,200}?min-width: 86px[\s\S]{0,60}?text-align: center/.test(html));
  chk('y centrado verticalmente en el renglón',
      /\.cl-item \.cl-item-falta \{[\s\S]{0,250}?align-self: center/.test(html));
  chk('el acta usa esa clase en sus marcadores',
      /cl-role-badge warn cl-item-falta/.test(html));

  // ── El buscador de fecha ──
  chk('el campo de fecha tiene ancho a medida, no 100%, y el texto centrado',
      /\.sf-input\.sf-input-fecha \{ width: auto; min-width: 150px; text-align: center; \}/.test(html));
  chk('y la fila dejó de tener el padding grande de inline-form',
      /id="cl-logged-search-row" style="margin:0 0 16px;padding:12px 14px;/.test(html));
  chk('el grupo ya no se estira a 220px',
      !/max-width:220px;flex:1 1 160px/.test(html), 'flex:0 0 auto');

  // ── Si se corta la señal al firmar, el acta NO se pierde ──
  // Esto era lo más grave de la familia que destapó Fran probando el modo
  // avión. Los tres lugares que firman hacían el insert SIN mirar el error y
  // después borraban el progreso igual. Si la señal se cortaba justo al
  // firmar: el acta no existía, los tildes se borraban, y el cartel decía
  // «firmada por Franco a las 09:14». Para un registro con valor legal es lo
  // peor que puede pasar — peor que un error visible.
  //
  // Las formas de error están medidas contra la API real.
  const errRedActa = { code: '', message: 'TypeError: Failed to fetch', details: 'TypeError: Failed to fetch' };
  const errServidorActa = { code: '42501', message: 'new row violates row-level security policy' };
  const colaActa=[]; window.queueOfflineAction=(tipo,payload)=>colaActa.push({tipo,payload});
  let avisosActa=[]; window.showAlertModal=async(m)=>{avisosActa.push(String(m));};
  // En jsdom no hay red, asi que la medicion real diria siempre "sin red" y
  // todo se encolaria. Se simula para poder probar los dos lados.
  let redDeVerdad=true; window.hayRedDeVerdad=async()=>redDeVerdad;

  window.__t.setTrip('trip-1'); window.__t.marcar('trip-1',tildados);
  errorAlInsertar=errRedActa; redDeVerdad=false; insertados=[]; colaActa.length=0; avisosActa=[]; limpiados=[];
  await window.instructorSignOff();
  chk('señal cortada al firmar: el acta va a la cola',
      colaActa.length===1 && colaActa[0].tipo==='checklist_completion', JSON.stringify(colaActa[0]||{}).slice(0,60));
  chk('y NO se le muestra un error que no corresponde', avisosActa.length===0, avisosActa[0]||'(ningún aviso, bien)');

  // Rechazo real del servidor: no se borra el progreso y se avisa.
  // Rechazo del servidor CON red: ahi si se avisa y no se encola.
  errorAlInsertar=errServidorActa; redDeVerdad=true; colaActa.length=0; avisosActa=[]; limpiados=[];
  window.__t.marcar('trip-1',tildados);
  await window.instructorSignOff();
  chk('si el servidor rechaza el acta, se avisa',
      avisosActa.length===1 && /acta|record/i.test(avisosActa[0]), avisosActa[0]||'(ningún aviso)');
  chk('y NO se borra el trabajo en curso: lo tildado no se pierde',
      limpiados.length===0, JSON.stringify(limpiados));
  chk('y NO se encola algo que el servidor ya rechazó', colaActa.length===0, colaActa.length+'');
  errorAlInsertar=null; redDeVerdad=true;

  // Un error raro CON red se trata como rechazo; SIN red, se encola. La forma
  // del error es una pista, la red es un hecho.
  errorAlInsertar={ code:'ALGO_RARO', message:'vaya a saber' };
  redDeVerdad=false; colaActa.length=0; avisosActa=[]; limpiados=[];
  window.__t.marcar('trip-1',tildados);
  await window.instructorSignOff();
  chk('un error raro SIN red: el acta se encola en vez de perderse',
      colaActa.length===1 && avisosActa.length===0, 'cola '+colaActa.length+' / avisos '+avisosActa.length);
  // Encolada SI se limpia el progreso, y esta bien: el acta ya esta a salvo en
  // la cola con su items_snapshot completo. Lo que no se puede limpiar es
  // cuando el servidor la RECHAZA, porque ahi no queda registro de nada.
  chk('encolada, el progreso si se limpia: el acta ya esta a salvo',
      limpiados.length===1, JSON.stringify(limpiados));
  errorAlInsertar=null; redDeVerdad=true;

  // Un solo lugar guarda el acta, y los tres firmados lo usan.
  chk('el acta se guarda en un solo lugar',
      (html.match(/async function guardarActa\(/g)||[]).length===1 &&
      (html.match(/await guardarActa\(payload\)/g)||[]).length===3,
      (html.match(/await guardarActa\(payload\)/g)||[]).length+' usos');
  // El patrón viejo era el insert suelto, sin recoger el error. El que queda
  // dentro de guardarActa() sí lo recoge, y hay una mención en un comentario.
  chk('y ninguno inserta el acta por su cuenta',
      !/\n\s+await sb\.from\('checklist_completions'\)\.insert\(payload\);/.test(html) &&
      /const \{ error \} = await sb\.from\('checklist_completions'\)\.insert\(payload\);/.test(html),
      'el único insert recoge el error');
  // Desde el 09/10 los tres firmados corren dentro de `firmarUnaSolaVez()`, así
  // que cortan devolviendo `false` en vez de `return;` — pero la regla es la
  // misma: si el acta no entró, el trabajo en curso NO se borra.
  chk('el progreso se borra sólo si el acta quedó guardada',
      (html.match(/if \(!\(await guardarActa\(payload\)\)\) return false;/g)||[]).length===3,
      'los tres cortan antes de limpiar');

  // ── Sin conexión: el acta también viaja en la cola ──
  const cola=[]; window.queueOfflineAction=(tipo,payload)=>cola.push({tipo,payload});
  window.__t.offline(true);
  await window.instructorSignOff();
  chk('offline: la cola lleva el acta completa',
      cola[0] && Array.isArray(cola[0].payload.items_snapshot) &&
      cola[0].payload.items_snapshot.length===todos.length);
  window.__t.offline(false);

  // ── La pantalla del historial ──
  chk('existe el abrir/cerrar del detalle', typeof window.toggleLoggedDetail==='function');
  const cont=doc.createElement('div'); cont.id='cl-logged-detail-X'; cont.style.display='none';
  doc.body.appendChild(cont);
  window.toggleLoggedDetail('X');
  chk('abre el detalle', cont.style.display==='block');
  window.toggleLoggedDetail('X');
  chk('y lo cierra', cont.style.display==='none');
  window.toggleLoggedDetail('no-existe');   // no debe explotar
  chk('un id inexistente no rompe nada', true);

  process.exit(fail);
} catch(e){ console.log('EXCEPCIÓN:', e && (e.stack||String(e))); process.exit(1);} })();
