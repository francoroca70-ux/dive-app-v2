// Por qué faltó cada ítem — corre el index.html real en jsdom.
//
//   npm i -D jsdom && node _tests/motivo-de-lo-que-falto.test.js
//
// Pedido por Fran el 09/10, con el caso concreto:
//
//   «En un private charter no pudimos poner toallas, entonces quedó incompleta.
//    Que aparezca un cartel para completar tipeando que diga "tal ítem no se
//    completó" y un por qué.»
//
// Antes había un sí/no: «faltan 2 ítems, ¿firmar igual?». La pregunta que le
// sirve a un centro no es si firma —va a firmar— es POR QUÉ faltó. Eso es lo
// que convierte «firmada 14/16» en un registro con el que se le contesta a un
// cliente tres semanas después.
//
// Los motivos son OPCIONALES a propósito: obligarlos con diez ítems sin hacer
// haría que alguien escriba «x» diez veces, y un dato inventado es peor que
// ninguno porque parece un dato.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

const TRIPULACION=[{id:'u-fran',full_name:'Franco',role:'manager',custom_role_name:null}];
let insertados=[];
function tabla(n){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({
      data: n==='staff'?TRIPULACION:[], count:0, error:null}).then(res,rej);
    if(prop==='insert') return async (payload)=>{ insertados.push(payload); return {error:null}; };
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
  setOrg:(id)=>{currentOrgId=id;},setRole:(r)=>{currentUserRole=r;},
  setTrip:(id)=>{currentChecklistTripId=id;},offline:(v)=>{isOffline=v;},
  yo:(id)=>{currentUserId=id;},tripulacion:(xs)=>{signerStaffCache=xs;},
  marcar:(tripId,obj)=>{instructorChecksByTrip[tripId]=obj;},
  confirmar:(items,f)=>confirmarFirma(items,f),
  snapshot:(i,e,a,m)=>buildItemsSnapshot(i,e,a,m),
  acta:(c,s,p)=>renderActaItems(c,s,p),
  fila:(it,o)=>filaDeActa(it,o)
};`;
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
const doc=window.document;
let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,300):'');
if(boot) process.exit(1);

const T=window.__t;
T.idioma('en'); T.setOrg('org-1'); T.setRole('manager'); T.offline(false);
T.yo('u-fran'); T.tripulacion(TRIPULACION);
window.showAlertModal=async()=>{};

const ITEMS=[{id:'0',text:'Check tanks'},{id:'1',text:'Load towels'},
             {id:'2',text:'First aid kit'},{id:'3',text:'Fuel'}];

(async()=>{ try {

  // ─── Lista completa: no se pregunta nada ───
  // Un cartel acá sería una traba sin información que ganar.
  const todo={'0':true,'1':true,'2':true,'3':true};
  const r1=await T.confirmar(ITEMS,(it)=>todo[it.id]);
  chk('con todo tildado no pregunta y deja firmar',
      r1 && JSON.stringify(r1.motivos)==='{}', JSON.stringify(r1));
  chk('y no abre el modal', doc.getElementById('modal-motivos').style.display!=='flex');

  // ─── Falta algo: pregunta por los que faltaron, y sólo por ésos ───
  const parcial={'0':true,'2':true};
  const promesa=T.confirmar(ITEMS,(it)=>parcial[it.id]);
  await new Promise(r=>setTimeout(r,10));
  const modal=doc.getElementById('modal-motivos');
  chk('con huecos abre el modal', modal.style.display==='flex', 'display: '+modal.style.display);
  const inputs=[...doc.querySelectorAll('#cl-motivos-lista input[data-item-id]')];
  chk('un campo por ítem que faltó, no por ítem', inputs.length===2, 'campos: '+inputs.length);
  chk('y son los que faltaron',
      inputs.map(i=>i.getAttribute('data-item-id')).join(',')==='1,3',
      inputs.map(i=>i.getAttribute('data-item-id')).join(','));
  chk('cada campo muestra de qué ítem habla',
      /Load towels/.test(doc.getElementById('cl-motivos-lista').innerHTML) &&
      /Fuel/.test(doc.getElementById('cl-motivos-lista').innerHTML));
  chk('dice cuántos faltaron', /2/.test(doc.getElementById('cl-motivos-intro').textContent),
      doc.getElementById('cl-motivos-intro').textContent);
  chk('y aclara que es opcional pero queda en el acta',
      /optional/i.test(html) && /cl_motivos_ayuda/.test(html));

  // El caso de Fran, literal.
  inputs[0].value='  supplier never delivered them  ';   // con espacios al borde
  inputs[1].value='';                                     // éste no lo explica
  doc.getElementById('cl-motivos-ok').click();
  const r2=await promesa;
  chk('devuelve sólo los motivos tipeados',
      r2 && Object.keys(r2.motivos).length===1, JSON.stringify(r2));
  chk('con el texto limpio de espacios',
      r2.motivos['1']==='supplier never delivered them', JSON.stringify(r2.motivos));
  chk('un campo vacío NO se guarda como motivo vacío', r2.motivos['3']===undefined);
  chk('y el modal se cierra', modal.style.display==='none');

  // ─── Cancelar es cancelar: no se firma ───
  const promesa2=T.confirmar(ITEMS,(it)=>parcial[it.id]);
  await new Promise(r=>setTimeout(r,10));
  doc.getElementById('cl-motivos-cancel').click();
  const r3=await promesa2;
  chk('cancelar devuelve null y corta la firma', r3===null, String(r3));

  // Firmar sin explicar nada es válido: un objeto vacío no es cancelar.
  const promesa3=T.confirmar(ITEMS,(it)=>parcial[it.id]);
  await new Promise(r=>setTimeout(r,10));
  doc.getElementById('cl-motivos-ok').click();
  const r4=await promesa3;
  chk('firmar sin explicar nada es válido, no es cancelar',
      r4 !== null && JSON.stringify(r4.motivos)==='{}', JSON.stringify(r4));

  // ─── El motivo viaja al acta ───
  const snap=T.snapshot(ITEMS,(it)=>parcial[it.id],null,
    {'1':'supplier never delivered them','3':'pump was broken'});
  chk('el acta guarda el por qué del ítem que faltó',
      snap[1].why==='supplier never delivered them', JSON.stringify(snap[1]));
  chk('y del otro también', snap[3].why==='pump was broken');
  chk('un ítem HECHO no lleva motivo',
      snap[0].why===undefined && snap[2].why===undefined, JSON.stringify(snap[0]));

  // Un motivo para un ítem que sí se hizo se descarta: en un registro inmutable
  // un campo sin sentido queda para siempre.
  const snapRaro=T.snapshot(ITEMS,()=>true,null,{'0':'esto no debería quedar'});
  chk('un motivo sobre algo hecho se descarta', snapRaro[0].why===undefined,
      JSON.stringify(snapRaro[0]));

  // Sin motivos el acta se arma igual (listas completas, o firmadas offline).
  const snapSin=T.snapshot(ITEMS,(it)=>parcial[it.id],null,undefined);
  chk('sin motivos el acta se arma igual', snapSin.length===4 && snapSin[1].why===undefined);

  // ─── Y se ve en el acta, que es el punto ───
  const cont=doc.createElement('div'); cont.id='acta-motivos'; doc.body.appendChild(cont);
  T.acta('acta-motivos', snap, null);
  chk('el acta muestra el por qué en pantalla',
      /supplier never delivered them/.test(cont.innerHTML), cont.innerHTML.slice(0,200));
  chk('etiquetado como «por qué», no suelto', /cl-motivo/.test(cont.innerHTML));
  chk('y sigue marcando que no se hizo', /cl-item-falta/.test(cont.innerHTML));

  // Las actas de antes del 09/10 no tienen `why` y no se rompen.
  T.acta('acta-motivos', [{id:'0',text:'Towels',done:false}], null);
  chk('un acta vieja sin motivos no se rompe',
      /cl-item-falta/.test(cont.innerHTML) && !/cl-motivo/.test(cont.innerHTML));

  // El motivo lo tipea una persona.
  T.acta('acta-motivos', [{id:'0',text:'x',done:false,why:'<img src=x onerror=alert(1)>'}], null);
  chk('el motivo va escapado',
      !/<img/.test(cont.innerHTML) && /&lt;img/.test(cont.innerHTML));

  // ─── Guardianes estructurales ───
  chk('la decisión de qué preguntar vive en una función',
      (html.match(/async function confirmarFirma\(/g)||[]).length===1 &&
      (html.match(/await confirmarFirma\(/g)||[]).length===3,
      (html.match(/await confirmarFirma\(/g)||[]).length+' llamadas, una por camino');
  chk('ya no queda el sí/no viejo en ningún camino',
      !/showConfirmModal\(`\$\{[a-zA-Z.]+\.length - done\}/.test(html),
      'el «faltan N, ¿firmar igual?» se fue');
  chk('los tres caminos pasan los motivos al acta',
      (html.match(/motivos: confirmado\.motivos/g)||[]).length===3,
      (html.match(/motivos: confirmado\.motivos/g)||[]).length+' de 3');
  chk('el modal se resuelve en un solo lugar',
      (html.match(/function cerrarMotivos\(/g)||[]).length===1);

  const claves=['cl_motivos_titulo','cl_motivos_intro','cl_motivos_ayuda','cl_motivos_ph',
                'cl_motivos_firmar','cl_acta_porque'];
  const faltan=claves.filter(k=>(html.match(new RegExp(k+':','g'))||[]).length<2);
  chk('los textos nuevos están en los dos idiomas', faltan.length===0,
      faltan.join(', ')||'los seis en ambos');

  T.idioma('es');
  const promesa4=T.confirmar(ITEMS,(it)=>parcial[it.id]);
  await new Promise(r=>setTimeout(r,10));
  chk('pregunta en el idioma de quien mira',
      /sin hacer/.test(doc.getElementById('cl-motivos-intro').textContent),
      doc.getElementById('cl-motivos-intro').textContent);
  doc.getElementById('cl-motivos-cancel').click();
  await promesa4;
  T.idioma('en');

  // ─── LAS DOS PANTALLAS QUE DIBUJAN UN ACTA NO PUEDEN DIVERGIR ───
  //
  // Reportado por Fran el 11/10: en **Logged Checklists** el ítem que dejó sin
  // tildar aparecía, pero sin el nombre de la cuenta que tildó cada uno. La
  // causa no era el dato —el acta guarda `by` y `by_id` desde el 09/10— sino
  // que esa vista **armaba sus propias filas** con sólo el ✓/✗ y el texto. Lo
  // que se agregó el 09/10 nunca llegó a la pantalla donde un dueño mira el
  // historial, que es donde más vale.
  //
  // El defecto aparece donde la copia falta. Ahora las dos pieles salen de
  // `filaDeActa()`.
  const UNO = { id:'0', text:'Load towels', done:true, by:'Pau', by_id:'s-pau' };
  const FALTO = { id:'1', text:'Fuel', done:false, why:'el surtidor estaba cerrado' };

  chk('la fila del acta se arma en un solo lugar',
      (html.match(/function filaDeActa\(/g)||[]).length===1);

  for (const [piel, opts] of [['salida', undefined], ['historial', { compacto:true }]]) {
    const hecho = T.fila(UNO, opts);
    chk(`(${piel}) un ítem hecho muestra desde qué cuenta se tildó`,
        /Pau/.test(hecho), hecho.replace(/<[^>]*>/g,' ').trim().slice(0,70));
    chk(`(${piel}) y lo hace con el mismo chip, no con un span propio`,
        /class="cl-autor"/.test(hecho));

    const falto = T.fila(FALTO, opts);
    chk(`(${piel}) un ítem que faltó muestra el por qué`,
        /surtidor/.test(falto), falto.replace(/<[^>]*>/g,' ').trim().slice(0,70));
    chk(`(${piel}) y NO le cuelga un nombre a algo que nadie hizo`,
        !/class="cl-autor"/.test(falto));
  }

  // La piel compacta conserva las marcas que el historial ya tenía: si el ✓/✗
  // se perdiera al unificar, habría cambiado un hueco por una regresión.
  const compacto = T.fila(UNO, { compacto:true });
  chk('el historial conserva su marca ✓ y su clase',
      /cl-logged-item-mark/.test(compacto) && /cl-logged-item ok/.test(compacto));
  chk('y el que faltó queda en rojo con ✗',
      /cl-logged-item missed/.test(T.fila(FALTO, { compacto:true })) &&
      /✗/.test(T.fila(FALTO, { compacto:true })));

  chk('Logged Checklists ya no arma sus propias filas',
      !/class="cl-logged-item \$\{i\.done/.test(html));
  chk('y usa la función compartida',
      /filaDeActa\(i, \{ compacto: true \}\)/.test(html));

  // Un acta vieja (previa al 09/10) no tiene autor y se dibuja sin inventarlo.
  const viejo = T.fila({ id:'0', text:'Check tanks', done:true }, { compacto:true });
  chk('un acta sin autoría se dibuja sin nombre, no con uno inventado',
      !/class="cl-autor"/.test(viejo) && /Check tanks/.test(viejo));

  // El estilo cubre las dos pieles con UN selector, no con la regla duplicada.
  chk('el CSS del autor cubre las dos pantallas en una sola regla',
      /\.cl-item \.cl-autor, \.cl-logged-item \.cl-autor \{/.test(html));

  // Y el texto de un ítem sigue escapándose en la piel nueva.
  const malicioso = T.fila({ id:'0', text:'<img src=x onerror=alert(1)>', done:true, by:'Pau' },
                           { compacto:true });
  chk('el texto se escapa también en el historial',
      !/<img/.test(malicioso) && /&lt;img/.test(malicioso));

  // ─── Un motivo que nadie tipeó no entra ──────────────────────────────────
  //
  // Medido el 22/10 firmando una rutina de capitán en la app en vivo: el último
  // campo de motivos tenía **`francoroca70@gmail.com`** adentro sin que nadie lo
  // escribiera, y quedó guardado en el acta. En esa misma página había dos
  // marcas de 1Password, así que el culpable fue una extensión, no la app.
  //
  // Pero la app tenía su parte: `autocomplete="off"` solo no alcanza —Chrome lo
  // toma como sugerencia y las extensiones lo ignoran— y la defensa completa YA
  // existía en el HTML, en los campos de invitar tripulación. Estaba copiada, y
  // el defecto apareció donde la copia faltaba.
  //
  // Y pega más fuerte acá que en cualquier otro campo porque **un acta es
  // inmutable**: un dato que nadie escribió entra una vez y no se corrige nunca.
  chk('los atributos anti-autocompletado se declaran en UN lugar',
      (html.match(/const SIN_AUTOCOMPLETADO/g)||[]).length===1);
  chk('y cubren navegador y gestores de contraseñas',
      /autocomplete="off"/.test(html.slice(html.indexOf('const SIN_AUTOCOMPLETADO'),
                                           html.indexOf('const SIN_AUTOCOMPLETADO')+260))
      && /data-1p-ignore/.test(html.slice(html.indexOf('const SIN_AUTOCOMPLETADO'),
                                          html.indexOf('const SIN_AUTOCOMPLETADO')+260))
      && /data-lpignore/.test(html.slice(html.indexOf('const SIN_AUTOCOMPLETADO'),
                                         html.indexOf('const SIN_AUTOCOMPLETADO')+260)),
      'autocomplete solo no alcanza');

  const campoMotivo = html.slice(html.indexOf('id="cl-motivo-${i}"') - 220,
                                 html.indexOf('id="cl-motivo-${i}"') + 220);
  chk('el campo de motivo usa la constante, no sus propios atributos',
      /\$\{SIN_AUTOCOMPLETADO\}/.test(campoMotivo), campoMotivo.slice(0,160));
  chk('y lleva un name que no invita a autocompletar',
      /noautofill/.test(campoMotivo),
      'un name vacío o semántico es lo que los gestores miran');

  // La regla vale para los dos lugares que la tenían antes: si alguien le saca
  // la defensa a los campos de invitación, también falla.
  chk('los campos de invitar tripulación siguen protegidos',
      (html.match(/data-1p-ignore/g)||[]).length>=3,
      'los dos de invitación más la constante');

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }
  process.exit(fail);
})();
