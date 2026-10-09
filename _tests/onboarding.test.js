// Primeros pasos — corre el index.html real en jsdom con centros de distinta forma.
//
//   npm i -D jsdom && node _tests/onboarding.test.js
//
// Los casos que importan no son "¿se ve la lista?" sino "¿se puede terminar?":
// un instructor que trabaja solo nunca va a invitar a un tripulante, y un
// centro de surf nunca va a tener un compresor. Antes los dos quedaban con
// tareas imposibles, y al dueño solo además se le escondía el panel entero.
//
// Primeros pasos: comprobar el COMPORTAMIENTO con distintas formas de centro.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

// Datos del "centro" simulado; cada test los cambia.
let mundo = { boats:0, pricedTypes:0, staff:1, compressors:0, gearStock:0, categorias:['diving'] };

function tabla(nombre){
  const h={ get(t,prop){
    if(prop==='then') return (res,rej)=>{
      let data=[], count=0;
      if(nombre==='boats')            count = mundo.boats;
      else if(nombre==='trip_types')  { count = mundo.pricedTypes; data = Array(mundo.pricedTypes).fill({id:1}); }
      else if(nombre==='staff')       count = mundo.staff;
      else if(nombre==='compressors') count = mundo.compressors;
      else if(nombre==='gear_items')  data = mundo.gearStock ? [{id:'g1'}] : [];
      else if(nombre==='gear_stock')  data = mundo.gearStock ? [{id:'s1'}] : [];
      else if(nombre==='org_operation_categories') data = mundo.categorias.map(c=>({category:c}));
      return Promise.resolve({data,count,error:null}).then(res,rej);
    };
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:null}}), getUser:async()=>({data:{user:{id:'u1'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:(n)=>tabla(n), functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook = main + "\n;window.__t={ setOrg:(id)=>{currentOrgId=id;}, setRole:(r)=>{currentUserRole=r;}, sb:()=>sb };";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,160):'');

window.__t.setOrg('org-1'); window.__t.setRole('owner');
window.__t.sb().from = (n)=>tabla(n);
const cont = doc.getElementById('home-dynamic-section');
chk('existe #home-dynamic-section', !!cont);

(async()=>{ try {
  // ── Instructor que trabaja solo: 1 bote, 1 tipo con precio, staff = 1 ──
  mundo = { boats:1, pricedTypes:1, staff:1, compressors:1, gearStock:1, categorias:['diving'] };
  await window.renderHomeGettingStartedOrFinance();
  let txt = cont.textContent;
  chk('operador solo: sigue viendo la lista de primeros pasos', /Getting started/.test(txt));
  chk('operador solo: NO se le esconde el panel', cont.querySelectorAll('.card').length > 1,
      'tarjetas en pantalla: ' + cont.querySelectorAll('.card').length);
  chk('operador solo: se le dice que puede saltear el paso', /Working on your own/.test(txt));

  // ── Centro completo: la lista desaparece ──
  mundo = { boats:2, pricedTypes:3, staff:4, compressors:1, gearStock:1, categorias:['diving'] };
  await window.renderHomeGettingStartedOrFinance();
  txt = cont.textContent;
  chk('centro completo: ya no aparece la lista', !/Getting started/.test(txt));
  chk('centro completo: tampoco la nota de trabajar solo', !/Working on your own/.test(txt));

  // ── Centro de surf: no tiene compresor y nunca va a tenerlo ──
  mundo = { boats:1, pricedTypes:1, staff:2, compressors:0, gearStock:0, categorias:['surf','freediving'] };
  const surf = await window.buildPhase2ChecklistHtml();
  chk('surf: no le pide un compresor', !/compressor/i.test(surf), surf.slice(0,120));
  chk('surf: sí le pide cargar stock de equipo', /phase2_step_gear|gear/i.test(surf));

  // ── Centro de buceo sin compresor: sí se lo pide ──
  mundo.categorias = ['diving','surf'];
  const buceo = await window.buildPhase2ChecklistHtml();
  chk('buceo: le pide el compresor', /compressor/i.test(buceo));

  // ── Buceo con todo cargado: la tarjeta desaparece ──
  mundo = { boats:1, pricedTypes:1, staff:2, compressors:1, gearStock:1, categorias:['diving'] };
  chk('buceo completo: no muestra la tarjeta', (await window.buildPhase2ChecklistHtml()) === '');

  // ── Surf con stock cargado: también desaparece, sin compresor ──
  mundo = { boats:1, pricedTypes:1, staff:2, compressors:0, gearStock:1, categorias:['surf'] };
  chk('surf con stock: la tarjeta desaparece sin exigir compresor',
      (await window.buildPhase2ChecklistHtml()) === '');

  process.exit(fail);
} catch(e){ console.log('EXCEPCIÓN:', e && (e.stack||String(e))); process.exit(1);} })();
