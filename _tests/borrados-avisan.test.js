// Que todo borrado mire el error y lo diga — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/borrados-avisan.test.js
//
// Había 32 borrados en index.html y sólo 4 miraban el error. Los otros 28
// fallaban en silencio: el usuario apretaba, la lista se recargaba, y la cosa
// seguía ahí. Fran lo vivió dos veces — con el botón de dar de baja un
// tripulante y con el de borrar una salida.
//
// Y no se arregla escribiendo `if (error)` veintiocho veces: eso es la regla
// copiada, y el defecto aparece donde la copia FALTA. De ahí el guardián
// estructural del final.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;
function tabla(){ const h={get(t,p){
  if(p==='then') return (res)=>Promise.resolve({data:[],error:null}).then(res);
  return ()=>new Proxy({},h); }}; return new Proxy({},h); }
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-ana'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>tabla(),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={idioma:(l)=>{currentLanguage=l;}};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

let avisos=[]; window.showAlertModal=async(m)=>{avisos.push(String(m));};
let redDeVerdad=true; window.hayRedDeVerdad=async()=>redDeVerdad;
window.__t.idioma('en');

// Una "consulta" que devuelve lo que le digamos.
const consulta=(error)=>Promise.resolve({error});

(async()=>{ try {

  // ─── Borró bien: no molesta a nadie ───
  avisos=[];
  let ok=await window.borrarOAvisar(consulta(null));
  chk('si borró, devuelve true y no muestra nada', ok===true && avisos.length===0, avisos[0]||'(sin avisos)');

  // ─── El motivo traducido es lo que le sirve a un centro ───
  // Un «23503 foreign_key_violation» no le dice nada a nadie.
  redDeVerdad=true;
  avisos=[];
  ok=await window.borrarOAvisar(consulta({code:'23503', message:'violates foreign key constraint "trips_boat_id_fkey"'}));
  chk('una FK se explica como «tiene registros asociados»',
      ok===false && /records attached/i.test(avisos[0]||''), avisos[0]||'(ningún aviso)');
  chk('y no le muestra el nombre de la constraint a un dueño de centro',
      !/fkey|constraint/i.test(avisos[0]||''), avisos[0]||'');

  avisos=[];
  await window.borrarOAvisar(consulta({code:'42501', message:'row-level security'}));
  chk('un rechazo de permisos se dice como permisos',
      /permission/i.test(avisos[0]||''), avisos[0]||'');

  avisos=[];
  await window.borrarOAvisar(consulta({code:'22P02', message:'invalid input syntax for type uuid'}));
  chk('un motivo que no previmos muestra el error real, no un genérico vacío',
      /invalid input syntax/.test(avisos[0]||''), avisos[0]||'');

  // ─── Sin red, el motivo es la red ───
  // La forma del error no alcanza: lo medimos antes. Si nunca llegamos, el
  // código de Postgres no significa nada.
  redDeVerdad=false;
  avisos=[];
  await window.borrarOAvisar(consulta({code:'23503', message:'violates foreign key constraint'}));
  chk('sin red gana la red, aunque el error traiga un code',
      /No connection/i.test(avisos[0]||''), avisos[0]||'');
  chk('y aclara que no se borró nada', /nothing was deleted/i.test(avisos[0]||''), avisos[0]||'');
  redDeVerdad=true;

  // ─── Los textos están en los dos idiomas ───
  const claves=['del_sin_conexion','del_tiene_historia','del_sin_permiso','del_otro_motivo'];
  const faltan=claves.filter(k=>(html.match(new RegExp(k+':','g'))||[]).length<2);
  chk('cada motivo está en inglés y en español', faltan.length===0, faltan.join(', ')||'los cuatro en ambos');

  window.__t.idioma('es');
  avisos=[];
  await window.borrarOAvisar(consulta({code:'23503', message:'x'}));
  chk('y el motivo sale en el idioma de quien mira',
      /registros asociados/i.test(avisos[0]||''), avisos[0]||'');
  window.__t.idioma('en');

  // ─── Guardián estructural: una regla, una función ───
  const total=(html.match(/\.delete\(\)/g)||[]).length;
  const envueltos=(html.match(/borrarOAvisar\(sb\.from/g)||[]).length;
  // Los que recogen el error a mano: el replay de la cola (2, que LANZAN para
  // que la cola reintente), el tilde, la limpieza post-firma y el equipo.
  const aMano=(html.match(/const \{ error[^}]*\} = await sb\.from\('[a-z_]+'\)\.delete/g)||[]).length;
  chk('todos los borrados miran el error',
      envueltos + aMano + 1 >= total,   // +1: el delete del ternario del tilde
      `${total} borrados = ${envueltos} envueltos + ${aMano} a mano + 1 ternario`);
  chk('y son bastantes: esto no se podía resolver copiando un if',
      envueltos >= 25, envueltos+' envueltos');
  chk('la regla vive en una sola función',
      (html.match(/async function borrarOAvisar\(/g)||[]).length===1 &&
      (html.match(/async function motivoDeFalloAlBorrar\(/g)||[]).length===1);

  // Las secuencias de varios borrados tienen que CORTAR al primer fallo: eso
  // es lo que dejaba estados a medias.
  chk('las secuencias cortan al primer fallo',
      (html.match(/if \(!\(await borrarOAvisar\([\s\S]{0,200}?\)\)\) return;/g)||[]).length >= 25,
      'cada uno con su return');
  chk('borrar un grupo corta en orden y no sigue si falla',
      /borrarOAvisar\(sb\.from\('payments'\)\.delete\(\)\.eq\('group_id', groupId\)\)\)\) return;[\s\S]{0,300}?borrarOAvisar\(sb\.from\('participants'\)[\s\S]{0,300}?borrarOAvisar\(sb\.from\('trip_groups'\)/.test(html));

  // La limpieza después de firmar NO avisa: el acta ya entró y un cartel ahí
  // le haría dudar de una firma que sí se guardó.
  chk('la limpieza post-firma registra pero no molesta',
      /no se pudo limpiar el trabajo en curso/.test(html) &&
      !/clearChecklistProgress[\s\S]{0,400}?showAlertModal/.test(html),
      'console.warn, sin cartel');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,400)); }
  process.exit(fail);
})();
