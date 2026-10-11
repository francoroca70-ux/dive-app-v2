// Reset abre una segunda pasada, con dos actas.
//
//   node _tests/run-all.js      (preferido)
//
// Qué hacía Reset hasta el 11/10: **nada**. Vaciaba el objeto local de tildes y
// redibujaba; el redibujo llamaba a `loadChecklistProgress()`, que devuelve
// `progressCache[scopeKey]` sin consultar, así que los tildes volvían. Sobre una
// checklist ya firmada era peor: el redibujo encontraba el acta y la mostraba
// otra vez, así que el botón parecía no responder.
//
// Lo que significa, decidido por Fran el 11/10: **una segunda pasada, con dos
// actas.** La mañana se hizo dos veces y quedan las dos en el historial, cada
// una con su hora y su firmante. Es el principio del proyecto —las actas no se
// editan nunca— aplicado a la pantalla.
//
// LA PARTE DIFÍCIL, y por eso este archivo: choca con `firmarUnaSolaVez()`, que
// se niega a firmar si ya hay acta. Sin la excepción de la pasada abierta, el
// guardián dejaría de proteger y pasaría a BLOQUEAR — el mismo error que casi
// se cometió con las dos actividades en un barco.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

const TRIPULACION=[{id:'u-fran',full_name:'Franco',role:'manager',custom_role_name:null}];
let insertados=[];
let borrados=[];
let actaEnLaBase=null;
let errorAlBorrar=null;

function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({
      data: n==='staff'?TRIPULACION:(actaEnLaBase?[actaEnLaBase]:[]), error:null}).then(res,rej);
    if(prop==='insert') return async (payload)=>{ insertados.push(payload); return {error:null}; };
    if(prop==='delete') return ()=>{
      const d={get(t2,p2){
        if(p2==='then') return (res)=>{ borrados.push(n); return Promise.resolve({error:errorAlBorrar}).then(res); };
        return ()=>new Proxy({},d);
      }};
      return new Proxy({},d);
    };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u-fran'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  idioma:(l)=>{currentLanguage=l;},
  setOrg:(id)=>{currentOrgId=id;},offline:(v)=>{isOffline=v;},
  yo:(id)=>{currentUserId=id;},tripulacion:(xs)=>{signerStaffCache=xs;},
  progreso:()=>progressCache, pendientes:()=>tildesPendientes,
  abiertas:()=>pasadasAbiertas,
  limpiar:(k,o)=>clearChecklistProgress(k,o),
  reiniciar:(x)=>reiniciarPasada(x),
  firmar:(k,i,f)=>firmarUnaSolaVez(k,i,f)
};`;
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,300):'');
if(boot) process.exit(1);

const T=window.__t;
T.idioma('en'); T.setOrg('org-1'); T.offline(false); T.yo('u-fran'); T.tripulacion(TRIPULACION);
let avisos=[]; let confirmaciones=[]; let responder=true;
window.showAlertModal=async(m)=>{avisos.push(String(m));};
window.showConfirmModal=async(m)=>{confirmaciones.push(String(m)); return responder;};
window.hayRedDeVerdad=async()=>true;

const ITEMS=[{id:'0',text:'Tanks'},{id:'1',text:'Towels'},{id:'2',text:'Kit'}];

(async()=>{ try {

  // ─── El no-op de antes: borrar de verdad incluye la caché Y lo pendiente ───
  // Reset vaciaba el objeto local y el redibujo lo repoblaba desde la caché.
  T.progreso()['k1'] = { '0': true, '1': true };
  T.pendientes()['k1'] = { '2': true };
  borrados = [];
  const ok = await T.limpiar('k1', { avisarSiFalla: true });
  chk('limpiar borra la caché del progreso', T.progreso()['k1'] === undefined);
  chk('y también lo pendiente, que si no resucita en el refresco',
      T.pendientes()['k1'] === undefined);
  chk('y le pega a la base', borrados.includes('checklist_progress'), borrados.join(','));
  chk('devuelve true cuando salió bien', ok === true);

  // ─── Un Reset que falla NO abre la pasada ───
  // Si el servidor dice no y se abriera igual, la persona cree que arrancó de
  // cero y queda tildando sobre lo anterior.
  errorAlBorrar = { code: '42501', message: 'row-level security' };
  avisos = []; confirmaciones = []; responder = true;
  actaEnLaBase = { signed_by:'Franco', signed_at:'2026-10-11T10:00:00Z',
                   completed_items:3, total_items:3, items_snapshot:[] };
  let redibujos = 0;
  let abierta = await T.reiniciar({ scopeKey:'k2', items:ITEMS, checks:{'0':true},
    hayActa:true, redibujar: async () => { redibujos++; } });
  chk('si el borrado falla, la pasada NO se abre', abierta === false);
  chk('y no se redibuja como si hubiera arrancado de cero', redibujos === 0);
  chk('y se avisa el motivo', /permission/i.test(avisos[0]||''), avisos[0]||'(sin aviso)');
  chk('la pasada no quedó registrada', !T.abiertas().has('k2'));
  errorAlBorrar = null;

  // ─── Cancelar en la confirmación no toca nada ───
  // Es destructivo: se van los tildes de la tripulación.
  responder = false; confirmaciones = []; redibujos = 0;
  abierta = await T.reiniciar({ scopeKey:'k3', items:ITEMS, checks:{'0':true,'1':true},
    hayActa:false, redibujar: async () => { redibujos++; } });
  chk('cancelar no reinicia nada', abierta === false && redibujos === 0);
  chk('la confirmación dice cuántos tildes se pierden',
      /2/.test(confirmaciones[0]||''), confirmaciones[0]||'');
  responder = true;

  // ─── Sobre una SIN firmar: reinicia y no abre pasada ───
  // No hay acta, así que no hay segunda pasada que habilitar: es simplemente
  // arrancar la lista de nuevo.
  confirmaciones = []; redibujos = 0;
  abierta = await T.reiniciar({ scopeKey:'k4', items:ITEMS, checks:{'0':true},
    hayActa:false, redibujar: async () => { redibujos++; } });
  chk('sin acta reinicia y redibuja', redibujos === 1);
  chk('y NO abre una pasada (no hay nada que habilitar)', !T.abiertas().has('k4'));
  chk('el texto no menciona ninguna acta',
      !/record|acta/i.test(confirmaciones[0]||''), confirmaciones[0]||'');

  // ─── Sobre una FIRMADA: abre la pasada y lo dice ───
  confirmaciones = []; redibujos = 0;
  abierta = await T.reiniciar({ scopeKey:'k5', items:ITEMS, checks:{'0':true,'1':true,'2':true},
    hayActa:true, redibujar: async () => { redibujos++; } });
  chk('con acta abre la pasada', abierta === true && T.abiertas().has('k5'));
  chk('y redibuja', redibujos === 1);
  chk('la confirmación promete que el acta anterior se conserva',
      /kept|never edited/i.test(confirmaciones[0]||''), confirmaciones[0]||'');

  // ─── LO QUE MÁS IMPORTA: el guardián permite firmar la segunda pasada ───
  // Sin la excepción, encontraría el acta de la primera y se negaría — una
  // protección convertida en bloqueo.
  insertados = []; avisos = [];
  let firmoLaSegunda = false;
  await T.firmar('k5', { role:'instructor', tripId:'trip-1' }, async () => {
    firmoLaSegunda = true; return true;
  });
  chk('con la pasada abierta, SÍ se puede firmar aunque ya haya acta', firmoLaSegunda);
  chk('y no se le avisa que ya estaba firmada', avisos.length === 0, avisos[0]||'');
  chk('al firmarla, la pasada se cierra', !T.abiertas().has('k5'));

  // Y cerrada la pasada, el guardián vuelve a proteger.
  avisos = []; let firmoDeMas = false;
  await T.firmar('k5', { role:'instructor', tripId:'trip-1' }, async () => {
    firmoDeMas = true; return true;
  });
  chk('cerrada la pasada, el guardián vuelve a negarse', !firmoDeMas);
  chk('y explica que ya está firmada', /already signed/i.test(avisos[0]||''), avisos[0]||'');

  // Si la firma falla, la pasada sigue abierta para reintentar.
  T.abiertas().add('k6');
  await T.firmar('k6', { role:'instructor', tripId:'trip-9' }, async () => false);
  chk('si el acta no entró, la pasada sigue abierta para reintentar',
      T.abiertas().has('k6'));
  T.abiertas().delete('k6');

  // ─── Guardianes estructurales ───
  chk('qué significa Reset vive en una sola función',
      (html.match(/async function reiniciarPasada\(/g)||[]).length===1 &&
      (html.match(/await reiniciarPasada\(/g)||[]).length===3,
      (html.match(/await reiniciarPasada\(/g)||[]).length+' usos: salida, departamento y propia');
  chk('ninguno de los tres Reset vacía los tildes por su cuenta',
      !/ChecksBy[A-Za-z]*\[[^\]]+\] = \{\};\s*\n\s*(render|await render)/.test(
        html.replace(/redibujar: async \(\) => \{[\s\S]*?\}/g, '')),
      'el borrado pasa por reiniciarPasada');
  chk('los tres renders respetan la pasada abierta',
      (html.match(/pasadasAbiertas\.has\(/g)||[]).length===4,
      (html.match(/pasadasAbiertas\.has\(/g)||[]).length+' (3 renders + el guardián)');
  chk('la pasada se cierra sólo si el acta entró',
      /if \(ok\) pasadasAbiertas\.delete\(claveDeInstancia\);/.test(html));
  chk('limpiar avisa en un Reset y calla después de firmar',
      /avisarSiFalla: true/.test(html) &&
      (html.match(/await clearChecklistProgress\(scopeKey\)/g)||[]).length>=1 &&
      (html.match(/avisarSiFalla = false/g)||[]).length===1);

  const claves=['cl_reset_confirm','cl_reset_confirm_firmada'];
  const faltan=claves.filter(k=>(html.match(new RegExp(k+':','g'))||[]).length<2);
  chk('los textos nuevos están en los dos idiomas', faltan.length===0,
      faltan.join(', ')||'los dos en ambos');

  T.idioma('es');
  confirmaciones = [];
  await T.reiniciar({ scopeKey:'k7', items:ITEMS, checks:{'0':true}, hayActa:true,
                      redibujar: async () => {} });
  chk('pregunta en el idioma de quien mira',
      /las actas no se editan/i.test(confirmaciones[0]||''), confirmaciones[0]||'');
  T.idioma('en');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }
  process.exit(fail);
})();
