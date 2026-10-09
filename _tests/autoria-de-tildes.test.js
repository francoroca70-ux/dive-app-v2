// Quién tildó cada ítem — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/autoria-de-tildes.test.js
//
// Pedido por Fran el 09/10: en un acta firma UNA persona, pero el barco lo
// cargan tres o cuatro, y esas tres o cuatro quedaban fuera del registro.
//
// El dato ya se escribía (`checked_by` en cada fila de checklist_progress) y se
// tiraba dos veces: la lectura traía sólo `item_id, checked`, y el acta guardaba
// `{id, text, done}`. O sea que la atribución se destruía JUSTO al firmar — el
// momento en que empieza a tener valor legal. De ahí que el test más importante
// acá sea el del snapshot.
const fs=require('fs'); const {JSDOM}=require('/tmp/node_modules/jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// Lo que devuelve checklist_progress en cada prueba.
let filas=[];
let ultimoSelect='';
function tabla(nombre){
  const h={get(t,p){
    if(p==='then') return (res)=>Promise.resolve({data:filas,error:null}).then(res);
    if(p==='select') return (cols)=>{ ultimoSelect=String(cols||''); return new Proxy({},h); };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-pau'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  idioma:(l)=>{currentLanguage=l;},
  org:(id)=>{currentOrgId=id;},
  yo:(id)=>{currentUserId=id;},
  offline:(v)=>{isOffline=v;},
  tripulacion:(xs)=>{signerStaffCache=xs;},
  progreso:()=>progressCache,
  pendientes:()=>tildesPendientes,
  leer:(k)=>leerProgresoDelServidor(k),
  cargar:(k,o)=>loadChecklistProgress(k,o),
  autoria:(c)=>autoriaDe(c),
  anotar:(c,a)=>anotarAutoria(c,a),
  nombre:(id)=>nombreDeTripulante(id),
  participantesViva:(a)=>participantesDeAutoria(a),
  participantesActa:(s)=>participantesDeActa(s),
  snapshot:(i,e,a)=>buildItemsSnapshot(i,e,a),
  chip:(a)=>chipDeAutor(a),
  linea:(n)=>lineaDeParticipantes(n),
  filaActa:(f)=>nombreDeFilaDeActa(f)
};`;
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,300):'');
if(boot) process.exit(1);

const T=window.__t;
T.idioma('en');
T.org('org-1');
T.yo('u-pau');
T.tripulacion([
  {id:'u-pau',  full_name:'Pau'},
  {id:'u-guido',full_name:'Guido'},
  {id:'u-meli', full_name:'Meli'}
]);

(async()=>{ try {

  // ─── La lectura tiene que TRAER el dato ───
  // Antes pedía 'item_id, checked' y el nombre no viajaba nunca.
  filas=[
    {item_id:'0',checked:true, checked_by:'u-pau',  checked_at:'2026-10-09T10:00:00Z'},
    {item_id:'1',checked:true, checked_by:'u-guido',checked_at:'2026-10-09T10:01:00Z'},
    {item_id:'2',checked:false,checked_by:'u-meli', checked_at:'2026-10-09T10:02:00Z'}
  ];
  const leido=await T.leer('scope-a');
  chk('la consulta pide checked_by', /checked_by/.test(ultimoSelect), ultimoSelect);
  chk('devuelve el mapa booleano como antes',
      leido.mapa['0']===true && leido.mapa['1']===true && leido.mapa['2']===undefined);
  chk('y la autoría con el nombre resuelto',
      leido.autores['0'].name==='Pau' && leido.autores['1'].name==='Guido',
      JSON.stringify(leido.autores['0']));
  chk('un ítem sin tildar no tiene autor', !leido.autores['2'], JSON.stringify(leido.autores['2']||null));
  chk('guarda el id además del nombre', leido.autores['0'].id==='u-pau');

  // ─── staff.id ES auth.uid(), así que el uuid se traduce directo ───
  chk('un uuid desconocido no inventa un nombre', T.nombre('u-nadie')==='', T.nombre('u-nadie'));
  chk('y sin id tampoco', T.nombre(null)==='');

  // ─── La autoría viaja colgada del objeto de tildes ───
  // Así los siete llamadores de renderCheckItems no tuvieron que cambiar, y los
  // ids posicionales ('0','1') no se cruzan entre listas distintas.
  const checksA={}, checksB={};
  T.anotar(checksA,{'0':{id:'u-pau',name:'Pau'}});
  T.anotar(checksB,{'0':{id:'u-meli',name:'Meli'}});
  chk('dos listas con el mismo id de ítem no se cruzan',
      T.autoria(checksA)['0'].name==='Pau' && T.autoria(checksB)['0'].name==='Meli');
  chk('un objeto sin autoría devuelve vacío, no undefined',
      JSON.stringify(T.autoria({}))==='{}' && JSON.stringify(T.autoria(null))==='{}');

  // ─── Lo que de verdad se estaba perdiendo: el acta ───
  const items=[{id:'0',text:'Chequear tanques'},{id:'1',text:'Cargar toallas'},{id:'2',text:'Botiquín'}];
  const autores={'0':{id:'u-pau',name:'Pau',at:'2026-10-09T10:00:00Z'},
                 '1':{id:'u-guido',name:'Guido',at:'2026-10-09T10:01:00Z'}};
  const snap=T.snapshot(items,(it)=>({'0':1,'1':1})[it.id], (it)=>autores[it.id]);
  chk('el acta guarda quién tildó cada ítem',
      snap[0].by==='Pau' && snap[1].by==='Guido', JSON.stringify(snap[0]));
  chk('y guarda el id, que es el hecho',
      snap[0].by_id==='u-pau' && snap[1].by_id==='u-guido');
  chk('un ítem sin tildar NO lleva autor en el acta',
      snap[2].done===false && snap[2].by===undefined && snap[2].by_id===undefined,
      JSON.stringify(snap[2]));
  chk('sigue guardando id, texto y done como antes',
      snap[0].id==='0' && snap[0].text==='Chequear tanques' && snap[0].done===true);

  // Sin autoría (acta vieja, o una lista que nadie tildó) el snapshot no se
  // rompe ni mete campos vacíos.
  const sinAutor=T.snapshot(items,()=>true,undefined);
  chk('sin función de autoría el acta se arma igual',
      sinAutor.length===3 && sinAutor[0].by===undefined && sinAutor[0].done===true);

  // ─── Las actas viejas no tienen el campo y no se pueden reconstruir ───
  chk('una fila de acta vieja no muestra nombre', T.filaActa({done:true,text:'x'})==='');
  chk('si quedó el id sin nombre, se resuelve desde el id',
      T.filaActa({done:true,by_id:'u-meli'})==='Meli');
  chk('el nombre guardado gana sobre el id (el acta es inmutable)',
      T.filaActa({by:'Pau el de antes',by_id:'u-meli'})==='Pau el de antes');

  // ─── Los participantes salen derivados, no de una segunda lista ───
  chk('participantes de la lista viva, sin repetir',
      JSON.stringify(T.participantesViva({
        '0':{name:'Pau'},'1':{name:'Guido'},'2':{name:'Pau'},'3':{name:'Meli'}
      }))===JSON.stringify(['Pau','Guido','Meli']));
  chk('participantes del acta se leen del snapshot, no de la base',
      JSON.stringify(T.participantesActa([
        {done:true,by:'Pau'},{done:true,by:'Guido'},{done:false},{done:true,by:'Pau'}
      ]))===JSON.stringify(['Pau','Guido']));
  chk('un acta vieja no tiene participantes y no explota',
      JSON.stringify(T.participantesActa([{done:true,text:'x'}]))==='[]');
  chk('y aguanta que no venga nada', JSON.stringify(T.participantesActa(null))==='[]');

  // La línea se dibuja sólo si hubo MÁS DE UNO: es la razón de existir del
  // pedido de Fran, que no quede un solo responsable de algo que hicieron
  // cuatro. Con una sola persona no agrega nada.
  chk('con dos o más nombres se dibuja la línea', /Pau, Guido/.test(T.linea(['Pau','Guido'])));
  chk('con uno solo no se dibuja', T.linea(['Pau'])==='');
  chk('con ninguno tampoco', T.linea([])==='' && T.linea(null)==='');

  // ─── Nada de esto puede inyectar HTML ───
  // Los nombres los escribe gente en un formulario.
  const malo=T.chip({name:'<img src=x onerror=alert(1)>'});
  chk('el nombre va escapado', !/<img/.test(malo) && /&lt;img/.test(malo), malo);
  const lineaMala=T.linea(['<script>x</script>','Guido']);
  chk('y la línea de participantes también',
      !/<script>/.test(lineaMala) && /&lt;script&gt;/.test(lineaMala), lineaMala);
  chk('sin nombre no se dibuja chip ninguno',
      T.chip({name:''})==='' && T.chip(null)==='' && T.chip({id:'u-pau'})==='');

  // ─── El refresco no le puede borrar el nombre a mi propio tilde ───
  // Mismo problema que arregló tildesPendientes para el tilde en sí: el
  // servidor todavía no sabe de mi tilde, así que si lo de él gana pelado, mi
  // nombre desaparece y reaparece cada diez segundos.
  T.offline(false);
  filas=[{item_id:'0',checked:true,checked_by:'u-guido',checked_at:'2026-10-09T10:00:00Z'}];
  const primera=await T.cargar('scope-ref',{forzar:true});
  chk('arranca con el tilde de Guido', T.autoria(primera)['0'].name==='Guido');

  // Simulo mi tilde pendiente del ítem 1, que el servidor no devuelve todavía.
  T.pendientes()['scope-ref']={'1':true};
  T.autoria(primera)['1']={id:'u-pau',name:'Pau',at:'2026-10-09T10:05:00Z'};
  primera['1']=true;
  const segunda=await T.cargar('scope-ref',{forzar:true});
  chk('el refresco conserva MI tilde pendiente', segunda['1']===true);
  chk('y conserva mi nombre en él',
      T.autoria(segunda)['1'] && T.autoria(segunda)['1'].name==='Pau',
      JSON.stringify(T.autoria(segunda)['1']||null));
  chk('sin pisar lo que trajo el servidor', T.autoria(segunda)['0'].name==='Guido');

  // ─── Guardián estructural: una regla, un lugar ───
  chk('la autoría se dibuja en un solo lugar',
      (html.match(/function chipDeAutor\(/g)||[]).length===1 &&
      (html.match(/chipDeAutor\(/g)||[]).length>=4,
      (html.match(/chipDeAutor\(/g)||[]).length+' usos');
  chk('los tres dibujos la usan: lista viva, checklists propias y acta',
      (html.match(/chipDeAutor\(autores\[item\.id\]\)/g)||[]).length===1 &&
      (html.match(/chipDeAutor\(autores\[idx\]\)/g)||[]).length===1 &&
      (html.match(/chipDeAutor\(\{ name: nombreDeFilaDeActa\(item\) \}\)/g)||[]).length===1);
  chk('los tres caminos que firman pasan checks para resolver el autor',
      (html.match(/signer, hechos: done, checks/g)||[]).length===3,
      (html.match(/signer, hechos: done, checks/g)||[]).length+' de 3');
  chk('la línea de participantes vive en una función',
      (html.match(/function lineaDeParticipantes\(/g)||[]).length===1 &&
      (html.match(/lineaDeParticipantes\(/g)||[]).length>=4);
  chk('y los participantes se derivan, no se guardan aparte',
      !/participants_snapshot|participantes_snapshot/.test(html));

  // marcarTilde sigue siendo el único dueño del estado en pantalla: la autoría
  // se pinta y se deshace ahí, con el tilde.
  chk('la autoría se pinta antes de guardar, como el tilde',
      /const autores = anotarAutoria\(checks, autoriaDe\(checks\)\);[\s\S]{0,600}?dibujar\(\);/.test(html));
  chk('y si el servidor rechaza el tilde, el nombre se deshace con él',
      /if \(autorPrevio\) autores\[itemId\] = autorPrevio; else delete autores\[itemId\];/.test(html));

  // Los textos en los dos diccionarios.
  const claves=['cl_autor_title','cl_participantes'];
  const faltan=claves.filter(k=>(html.match(new RegExp(k+':','g'))||[]).length<2);
  chk('los textos nuevos están en inglés y en español', faltan.length===0, faltan.join(', ')||'los dos en ambos');

  T.idioma('es');
  chk('la línea sale en el idioma de quien mira',
      /La completaron entre/.test(T.linea(['Pau','Guido'])), T.linea(['Pau','Guido']));
  T.idioma('en');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }
  process.exit(fail);
})();
