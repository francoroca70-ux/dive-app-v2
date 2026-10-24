// C9 · Quién firmó y cuándo, arriba del acta y en UNA sola línea.
//
//   node _tests/run-all.js      (preferido)
//
// Fran firmó una rutina el 24/10 y dijo que «se limpió la checklist». El dato
// estaba perfecto —2 ítems con su tilde y su autor, 14 con «SIN HACER»— y lo que
// estaba mal era **dónde** se decía: medido en su pantalla, la insignia en
// y=418 y el cartel del firmante en **y=1389**, 900 px más abajo, después de los
// dieciséis ítems. Lo único que prueba que esto es un registro quedaba fuera del
// pliegue.
//
// Y al ir a moverlo apareció que la línea estaba escrita **seis veces**: tres en
// los caminos que acaban de firmar y tres armadas desde el acta guardada. Con
// dos defectos que sólo se ven juntando las seis:
//
//   · las tres de «recién firmada» metían un `at` EN INGLÉS en medio de la
//     frase: en español se leía «Confirmado por Franco at 24/10/2026»;
//   · y las dos formas no decían lo mismo — las de «recién firmada» no incluían
//     cuántos ítems se habían hecho y las del acta sí.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const {lineasDeCodigoCon}=require('./contar');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

function tabla(){const h={get(t,p){
  if(p==='then') return (res)=>Promise.resolve({data:[],error:null}).then(res);
  return ()=>new Proxy({},h);}};return new Proxy({},h);}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>tabla(),functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};

let pass=0, fail=0;
function chk(n, ok, x){ if(ok){pass++;console.log('PASS  '+n);} else {fail++;console.log('FAIL  '+n+(x?'  '+x:''));} }

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+`
;window.__t={
  idioma:(l)=>{currentLanguage=l;},
  linea:(x)=>lineaDeFirma(x),
  pintar:(x)=>pintarFirmaDeChecklist(x)
};`;
let boot=null; try{ window.eval(hook); }catch(e){ boot=e; }
chk('arranca sin excepción', !boot, boot?String(boot&&boot.stack||boot).slice(0,300):'');

(async () => {
try {
  if (boot) throw boot;
  const T=window.__t;
  const d=window.document;
  T.idioma('en');

  // ─── 1 · La línea dice las tres cosas, siempre ───────────────────────────
  const l = T.linea({ nombre:'Franco Roca', cuando:'2026-10-24T16:00:00Z', hechos:2, total:16 });
  chk('dice el nombre', /Franco Roca/.test(l), l.slice(0,120));
  chk('en negrita, que es lo que se busca de un vistazo', /<strong>Franco Roca<\/strong>/.test(l));
  chk('dice la fecha', /2026|24\/10|10\/24/.test(l), l);
  chk('y SIEMPRE dice cuántos ítems se hicieron', /2\/16/.test(l), l);
  chk('lleva el tilde adelante', /^✓/.test(l));

  // ─── 2 · El `at` en inglés ya no existe ─────────────────────────────────
  //
  // Se afirma sobre el RESULTADO en español, no buscando la palabra en el
  // archivo: un comentario que la nombre no es un bug, y contar menciones ya
  // falló ocho veces en este proyecto.
  T.idioma('es');
  const es = T.linea({ nombre:'Franco', cuando:'2026-10-24T16:00:00Z', hechos:2, total:16 });
  chk('en español no queda ninguna palabra en inglés en el medio',
      !/\bat\b/.test(es.replace(/<[^>]*>/g,'')), es.replace(/<[^>]*>/g,''));
  chk('y en español dice «Confirmado por»', /Confirmado por/.test(es), es.slice(0,80));
  T.idioma('en');
  chk('en inglés dice «Signed off by»', /Signed off by/.test(T.linea({nombre:'F'})));

  // ─── 3 · Lo que falta no se inventa ─────────────────────────────────────
  const sinCuenta = T.linea({ nombre:'Franco', cuando:'2026-10-24T16:00:00Z' });
  chk('sin los números no escribe «undefined/undefined»',
      !/undefined/.test(sinCuenta), sinCuenta);
  chk('sin nombre no explota', typeof T.linea({})==='string');
  chk('sin fecha usa ahora, no un vacío',
      /\d/.test(T.linea({nombre:'F', hechos:1, total:2}).replace(/<[^>]*>/g,'')));

  // El nombre va escapado: lo escribe una persona del centro.
  const malicioso = T.linea({ nombre:'<img src=x onerror=alert(1)>', hechos:1, total:2 });
  chk('el nombre va escapado', !/<img/.test(malicioso) && /&lt;img/.test(malicioso));
  // Y el «extra» también: hoy es un texto de traducción, pero el día que
  // alguien le pase algo de la base, ya está cubierto.
  chk('y el extra también', !/<b>/.test(T.linea({nombre:'F', extra:'<b>x</b>'})));

  // ─── 4 · Una sola declaración, y los seis la usan ───────────────────────
  chk('lineaDeFirma se declara una vez',
      (html.match(/function lineaDeFirma/g)||[]).length===1);
  chk('pintarFirmaDeChecklist se declara una vez',
      (html.match(/function pintarFirmaDeChecklist/g)||[]).length===1);
  const usos = lineasDeCodigoCon(html, 'lineaDeFirma(').length;
  chk('la usan los seis lugares que escribían la línea', usos===5,
      usos+' líneas de código (la declaración, los 3 del acta guardada y la del cartel)');

  // Nadie vuelve a armar la frase a mano.
  chk('ya nadie escribe la frase a mano',
      lineasDeCodigoCon(html, "t('cl_signed_off_by')").length===1,
      'sólo dentro de lineaDeFirma');

  // ─── 5 · EL ARREGLO QUE PIDIÓ FRAN: el cartel va ARRIBA de la lista ────
  //
  // Se mide por posición en el archivo, que es lo que determina el orden en la
  // pantalla. Los tres bloques, porque eran tres copias.
  const antesQue = (cartel, lista) => {
    const i = html.indexOf(cartel), j = html.indexOf(lista);
    return i !== -1 && j !== -1 && i < j;
  };
  chk('el cartel del instructor va antes de su lista',
      antesQue('id="cl-instructor-done"', 'id="cl-instructor-items"'));
  chk('el de la rutina de departamento también',
      antesQue('id="dept-routine-done"', 'id="dept-list"'));
  chk('y el de una checklist propia también',
      antesQue('id="custom-cl-done-${cc.id}"', 'id="custom-cl-items-${cc.id}"'));

  // ─── 6 · Y pintar el cartel sigue haciendo las otras dos cosas ─────────
  const cartel=d.createElement('div'); cartel.id='cartel-de-prueba';
  cartel.style.display='none'; d.body.appendChild(cartel);
  T.pintar({ cartelId:'cartel-de-prueba', nombre:'Franco', hechos:2, total:16 });
  chk('el cartel se muestra', cartel.style.display==='block');
  chk('y lleva la línea', /Franco/.test(cartel.innerHTML));
  chk('sin estadoId ni selectId no explota', true);

  T.pintar({ cartelId:'no-existe', nombre:'Franco' });
  chk('un cartel que no está no rompe nada', true);

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }

console.log('\n'+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
})();
