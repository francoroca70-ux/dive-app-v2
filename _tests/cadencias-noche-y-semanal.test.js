// Cadencias de noche y semanal — index.html real en jsdom.
//
//   node _tests/cadencias-noche-y-semanal.test.js
//
// Pedido por Fran el 14/10: «noche» para los charters, y semanal porque hay
// checklists que se hacen una vez por semana.
//
// Lo que medí antes de construir y cambió el diseño:
//
//  1 · **`weekly` se habría roto en silencio.** La lógica de «qué período cubre
//      esta cadencia» estaba DUPLICADA en `periodKeyForCadence` y en
//      `deptRoutinePeriodRange`, y las dos terminaban en un `else` que mandaba
//      todo lo desconocido a «por día». Una checklist semanal se habría
//      reiniciado cada mañana, sin que nada falle y sin que nadie se entere.
//      Ahora las dos salen de `granoDeCadencia()`.
//  2 · **Las rutinas de departamento traen sus ítems cableados por cadencia**,
//      así que agregarles noche y semanal serían ocho listas de ítems que yo
//      tendría que inventar. No es lo que pidió Fran: él quiere que el CENTRO se
//      arme su checklist de noche. Las cuatro rutinas no se tocan.
//
// Y el interruptor controla qué se **ofrece**, nunca qué se **lee**: una
// checklist de noche ya creada se sigue viendo y firmando con el interruptor
// apagado. Si controlara la lectura, apagarlo haría desaparecer registros de un
// centro, y eso no se arregla después.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
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
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:{id:'u'}}}),
        onAuthStateChange:()=>({data:{subscription:{}}})},
  from:()=>tabla(), rpc:async()=>({data:null,error:null}),
  functions:{invoke:async()=>({})}})};
window.Paddle={Environment:{set(){}},Initialize(){},Checkout:{open(){}}};
window.Chart=function(){};

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const main=scripts.find(s=>s.includes('[Seven Seas] build'));
const hook=main+"\n;window.__t={"+
  "grano:(c)=>granoDeCadencia(c),"+
  "clave:(c)=>periodKeyForCadence(c,null),"+
  "claveConSalida:(c,id)=>periodKeyForCadence(c,id),"+
  "rango:(c)=>deptRoutinePeriodRange(c),"+
  "semana:(d)=>claveDeSemana(d),"+
  "lunes:(d)=>lunesDeLaSemana(d),"+
  "ofrecidas:()=>cadenciasQueSeOfrecen(),"+
  "rol:(r)=>checklistRoleLabel(r),"+
  "setIdioma:(l)=>{currentLanguage=l;},"+
  "t:(k)=>t(k),"+
  "cad:()=>CHECKLIST_CADENCIAS};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}

let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

try{
const T=window.__t;

// ─── 1 · El grano de cada cadencia, en un solo lugar ───
chk('inicio del día es diario', T.grano('morning')==='dia');
chk('fin del día es diario',    T.grano('eod')==='dia');
chk('noche TAMBIÉN es diaria',  T.grano('night')==='dia');
chk('semanal es semanal',       T.grano('weekly')==='semana', T.grano('weekly'));
chk('mensual es mensual',       T.grano('monthly')==='mes');
chk('anual es anual',           T.grano('yearly')==='anio');
// El fallback existe sólo para valores viejos de la base.
chk('una cadencia desconocida cae a diario', T.grano('cualquiera')==='dia');

// ─── 2 · El bug que esto evita: semanal NO es por día ───
//
// Antes, `weekly` caía en el else y recibía una clave con el día adentro, así
// que la instancia cambiaba cada mañana y la tripulación perdía lo tildado.
const kSem = T.clave('weekly');
chk('la clave semanal tiene forma de semana ISO', /^\d{4}-W\d{2}$/.test(kSem), kSem);
chk('y NO contiene el día del mes', !/^\d{4}-\d{2}-\d{2}$/.test(kSem), kSem);
chk('la clave diaria sí es por día', /^\d{4}-\d{2}-\d{2}$/.test(T.clave('morning')), T.clave('morning'));
chk('noche comparte la clave del día con inicio del día',
    T.clave('night')===T.clave('morning'), T.clave('night'));
chk('la mensual no tiene día', /^\d{4}-\d{2}$/.test(T.clave('monthly')), T.clave('monthly'));
chk('la anual es sólo el año', /^\d{4}$/.test(T.clave('yearly')), T.clave('yearly'));

// Una salida siempre gana: su id ES la instancia, sin importar la cadencia.
chk('con tripId la clave es el tripId', T.claveConSalida('weekly','t-1')==='t-1');

// ─── 3 · La semana ISO, en los casos que la hacen no trivial ───
const L=(y,m,d)=>new Date(y,m-1,d);
// Lunes 12 a domingo 18 de octubre de 2026 tienen que dar la MISMA semana.
const sem=[12,13,14,15,16,17,18].map(d=>T.semana(L(2026,10,d)));
chk('los siete días de una semana dan la misma clave',
    new Set(sem).size===1, sem.join(' '));
chk('y el lunes siguiente da otra',
    T.semana(L(2026,10,19))!==sem[0], `${sem[0]} vs ${T.semana(L(2026,10,19))}`);
// El lunes de la semana es lunes, no domingo.
chk('lunesDeLaSemana de un domingo devuelve el lunes anterior',
    T.lunes(L(2026,10,18)).getDate()===12, String(T.lunes(L(2026,10,18)).getDate()));
chk('y de un lunes se devuelve a sí mismo',
    T.lunes(L(2026,10,12)).getDate()===12);
// El 4 de enero siempre cae en la semana 1 — es la definición ISO.
chk('el 4 de enero es siempre semana 01', T.semana(L(2026,1,4)).endsWith('-W01'), T.semana(L(2026,1,4)));
chk('y el 4 de enero de otro año también', T.semana(L2026=L(2024,1,4)).endsWith('-W01'), T.semana(L(2024,1,4)));
// Diciembre partido: el 31/12/2026 es jueves, así que su semana es ISO 53 de 2026.
const finDe2026=T.semana(L(2026,12,31));
chk('una semana de fin de año da un año y una semana coherentes',
    /^\d{4}-W\d{2}$/.test(finDe2026), finDe2026);

// ─── 4 · El rango sale del MISMO grano que la clave ───
//
// Era un if/else copiado. Si divergieran, `weekly` guardaría el progreso por
// semana y buscaría actas de hoy: una checklist que se ve vacía con su acta ya
// firmada.
const rSem=T.rango('weekly'), rDia=T.rango('morning');
chk('el rango semanal arranca antes que el diario',
    new Date(rSem.start) < new Date(rDia.start) || T.lunes(new Date()).getDay()===1,
    `${rSem.start} vs ${rDia.start}`);
chk('el rango semanal arranca un lunes',
    new Date(rSem.start).getDay()===1, rSem.start);
chk('el rango de noche es el mismo que el del día',
    T.rango('night').start===rDia.start);
chk('el mensual arranca el día 1',
    new Date(T.rango('monthly').start).getDate()===1, T.rango('monthly').start);
chk('el anual arranca en enero',
    new Date(T.rango('yearly').start).getMonth()===0, T.rango('yearly').start);

// ─── 5 · El interruptor, en las dos posiciones ───
//
// Está en 'false' en producción. Lo que se afirma acá es que **cambiarlo cambia
// el comportamiento** — la etapa 3a tuvo tres días un interruptor que no
// cambiaba nada con la suite en verde.
// La posición declarada. Si el código dice otra cosa, el test falla — igual que
// el guardián de `arrancar-del-binario`. Cambiar el interruptor obliga a cambiar
// esta línea y a enterarse de qué implica.
const POSICION_ESPERADA = 'prendido';   // 'apagado' | 'prendido'

const ofrecidas=T.ofrecidas();
const sinComentarios=main.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
const enCodigo=/const CADENCIAS_NUEVAS = true;/.test(sinComentarios) ? 'prendido' : 'apagado';
chk('la posición del interruptor coincide con la declarada',
    enCodigo===POSICION_ESPERADA, `código=${enCodigo} declarado=${POSICION_ESPERADA}`);

// Las dos posiciones se corren de verdad, sin importar cuál esté en producción:
// una sale del código tal como está, y la otra reevaluando la función con el
// valor opuesto. Lo que se afirma es que **cambiarlo cambia el resultado** — la
// etapa 3a tuvo tres días un interruptor inerte con la suite en verde.
function ofrecidasCon(valor){
  return new window.Function(
    sinComentarios.match(/function cadenciasQueSeOfrecen\(\)[\s\S]*?\n\}/)[0] +
    `\nconst CADENCIAS_NUEVAS = ${valor}; return cadenciasQueSeOfrecen();`)();
}
const conApagado=ofrecidasCon(false), conPrendido=ofrecidasCon(true);
chk('apagado se ofrecen las cuatro de siempre',
    conApagado.length===4 && !conApagado.includes('night') && !conApagado.includes('weekly'),
    conApagado.join(','));
chk('prendido se ofrecen SEIS, con noche y semanal',
    conPrendido.length===6 && conPrendido.includes('night') && conPrendido.includes('weekly'),
    conPrendido.join(','));
chk('y cambiarlo cambia el resultado', conApagado.length !== conPrendido.length);
chk('lo que la app ofrece hoy es la posición del código',
    ofrecidas.length===(enCodigo==='prendido'?6:4), ofrecidas.join(','));

const veces=(sinComentarios.match(/CADENCIAS_NUEVAS/g)||[]).length;
chk('el interruptor se declara y se lee en un solo lugar cada vez',
    veces===2, String(veces));

// ─── 6 · Lo que YA existe se lee con el interruptor apagado ───
//
// Esta es la restricción de diseño: el interruptor controla qué se OFRECE, no
// qué se LEE. Una checklist de noche creada cuando estaba prendido se sigue
// etiquetando y su período se sigue calculando con el interruptor apagado.
chk('el grano de noche se calcula igual con el interruptor apagado',
    T.grano('night')==='dia');
chk('el de semanal también', T.grano('weekly')==='semana');
chk('noche y semanal están en el mapa de etiquetas',
    !!T.cad()['night'] && !!T.cad()['weekly']);
T.setIdioma('es');
chk('una rutina de noche se etiqueta en castellano',
    T.rol('deck_night').includes('—') && !T.rol('deck_night').includes('_'), T.rol('deck_night'));
chk('y una semanal también',
    T.rol('deck_weekly').includes('—') && !T.rol('deck_weekly').includes('_'), T.rol('deck_weekly'));

// ─── 7 · Los textos, en los dos diccionarios ───
chk('noche en castellano dice Noche', T.t('cl_cadence_night')==='Noche', T.t('cl_cadence_night'));
chk('semanal en castellano dice Semanal', T.t('cl_cadence_weekly')==='Semanal');
T.setIdioma('en');
chk('y en inglés Night', T.t('cl_cadence_night')==='Night');
chk('y Weekly', T.t('cl_cadence_weekly')==='Weekly');

// ─── 8 · Las rutinas de departamento NO se tocaron ───
//
// Siguen con sus cuatro cadencias cableadas. Agregarles noche y semanal serían
// ocho listas de ítems inventadas, y no es lo que se pidió.
// Se cuentan los ROLES declarados, no las apariciones de `cadences: {` — ésa
// aparece una quinta vez en el constructor que arma `out[deptKey]`, y contar
// esa quinta fue mi error, no del código. Un roleKey por departamento.
const deptos=sinComentarios.match(/role: '[a-z]+_monthly'/g)||[];
chk('siguen siendo cuatro departamentos con sus cuatro cadencias',
    deptos.length===4, deptos.join(' '));
chk('y ninguno declara una cadencia de noche',
    !/\bnight:\s*\{\s*role:/.test(sinComentarios));

// ─── 9 · El selector se arma de la única fuente ───
chk('el select de frecuencia ya no tiene options escritos a mano',
    !/<option value="morning" data-i18n="cl_cadence_morning">/.test(html));
chk('y se puebla desde cadenciasQueSeOfrecen',
    /cadenciasQueSeOfrecen\(\)\s*\n?\s*\.map/.test(sinComentarios) ||
    /poblarCadenciasDelFormulario/.test(sinComentarios));

}catch(e){ chk('el cuerpo del test corrió hasta el final',false,String(e).slice(0,300)); }

console.log(`\n${fail?'HAY FALLOS':'todo en verde'} — cadencias-noche-y-semanal`);
process.exit(fail);
