// ¿Se banca la app arrancar del binario, sin servidor? — index.html real.
//
//   node _tests/arrancar-del-binario.test.js
//
// Contexto, medido el 14/10. La app instalada **no abre sin internet**, y la
// causa es `server.url` en `capacitor.config.json`: con eso puesto, Capacitor
// carga la interfaz del servidor y **no usa los archivos del binario**. Sin red
// no hay de dónde cargar.
//
// Y el service worker no la salva en iOS: en WKWebView, con `server.url`, los
// service workers **no se registran** salvo que se configure App-Bound Domains,
// y la posición de los propios mantenedores de Capacitor es que si querés
// offline, empaquetes los archivos.
//
// Lo bueno de la medición: **los archivos YA están en el binario.** El workflow
// corre `npm run build:www` y después `cap sync` para las dos plataformas, así
// que `index.html`, `sw.js`, `manifest.json` y `assets/` viajan adentro de la
// app — sin usarse, porque `server.url` los tapa. El cambio es sacar esa línea.
//
// Este archivo prueba lo que hay que tener listo ANTES de sacarla, para que el
// día que se saque no aparezca un problema nuevo. No prueba el flip: el flip se
// prueba instalando una build y poniendo el celular en modo avión, y eso no lo
// puede hacer jsdom.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const path=require('path');
const R=(f)=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const html=R('index.html');

let fail=0;
function chk(n,ok,x){console.log((ok?'PASS  ':'FAIL  ')+n+(x?'  '+x:'')); if(!ok)fail=1;}

// ─── 1 · El interruptor, que acá es de configuración y no de código ───
//
// No puede ser una bandera en el JS: la app no arranca, así que **nuestro
// código nunca corre**. El interruptor es la presencia de `server.url`, la
// decide `cap sync` al armar el binario, y la aprieta Fran.
//
// Este guardián existe para que las dos mitades no divergan en silencio: si
// alguien saca `server.url`, tiene que cambiar ESTE número y enterarse de que
// desde ese momento cada arreglo del index.html necesita un binario nuevo.
// Cambiado a 'binario' el 14/10. Desde acá, **un arreglo del `index.html` ya no
// llega solo a las apps nativas**: necesita una build. La web sigue igual.
const FUENTE_DE_LA_APP_NATIVA = 'binario';   // 'servidor' | 'binario'
const cap=JSON.parse(R('capacitor.config.json'));
const tieneServerUrl=!!(cap.server && cap.server.url);
chk('la config y la intención declarada coinciden',
    tieneServerUrl===(FUENTE_DE_LA_APP_NATIVA==='servidor'),
    `config=${tieneServerUrl?'servidor':'binario'} declarado=${FUENTE_DE_LA_APP_NATIVA}`);
chk('`webDir` sigue apuntando a www, que es lo que se empaqueta',cap.webDir==='www');

// ─── 2 · Los archivos viajan en el binario ───
const build=R('scripts/build-www.js');
for(const f of ['index.html','sw.js','manifest.json'])
  chk(`build-www copia ${f}`,build.includes(`'${f}'`));
chk('build-www copia assets/',/DIRS\s*=\s*\[[^\]]*'assets'/.test(build));
const ci=R('.github/workflows/mobile-build.yml');
chk('el workflow arma www/ antes de cap sync en Android',
    ci.indexOf('build:www')<ci.indexOf('cap sync android')&&ci.includes('cap sync android'));
chk('y en iOS',ci.includes('cap sync ios')&&/build:www[\s\S]*cap sync ios/.test(ci));
chk('www/ está en .gitignore porque se genera, no se versiona',
    /^www\/$/m.test(R('.gitignore')));

// ─── 3 · Nada depende de estar servido desde la raíz de un dominio ───
//
// Cargada del binario, la app vive en otro origen (`capacitor://localhost` en
// iOS). Una ruta con barra inicial en un `src`/`href` apuntaría afuera.
const absolutas=[...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map(m=>m[1]);
chk('ningún src/href con barra inicial',absolutas.length===0,absolutas.slice(0,3).join(' '));
chk('el registro del service worker está envuelto en catch',
    /navigator\.serviceWorker\.register\('\/sw\.js'\)\.catch\(/.test(html));

// ─── 4 · La medición de red no puede preguntarle al propio origen ───
//
// Este es el hallazgo que importa. `hayRedDeVerdad()` pingueaba
// `/manifest.json` de acá mismo. Empaquetada, esa ruta **la contesta el disco**:
// diría «hay red» en modo avión, y de esa respuesta cuelga si una escritura se
// ENCOLA o se descarta. El bug de `La señal que se corta antes de que el
// navegador se entere`, resucitado por un cambio que no parece tocar esto.
chk('ya no se mide pingueando el propio manifest',
    !/fetch\('\/manifest\.json\?ping=/.test(html));
const sinComentarios=html.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
const veces=(sinComentarios.match(/ORIGEN_PARA_MEDIR_RED/g)||[]).length;
chk('el destino del ping se declara y se usa en un solo lugar cada vez',
    veces===2, String(veces));

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
  "red:()=>hayRedDeVerdad(),"+
  "destino:()=>ORIGEN_PARA_MEDIR_RED};";
let boot=null; try{window.eval(hook);}catch(e){boot=e;}
chk('arranca sin excepción',!boot,boot?String(boot).slice(0,200):'');

(async()=>{
try{
const T=window.__t;
chk('el ping va a Supabase, que es a donde van las escrituras',
    /supabase\.co$/.test(T.destino()), T.destino());

// Se corre de verdad, con la red falseada en las tres formas que importan.
let pedido=null;
window.fetch=async(url,opts)=>{ pedido={url:String(url),opts};
  // Una respuesta OPACA: `ok` es false aunque la red haya funcionado. Si el
  // código mirara `.ok`, esto diría «no hay red» siempre.
  return { ok:false, status:0, type:'opaque' }; };
chk('con la red andando dice que hay red, sin mirar `.ok`',
    (await T.red())===true);
chk('y pregunta por fuera del propio origen',
    pedido && pedido.url.startsWith('https://') && !pedido.url.startsWith('/'),
    pedido?pedido.url.slice(0,60):'sin pedido');
chk('con HEAD, que el service worker no intercepta',pedido.opts.method==='HEAD');
chk('sin caché',pedido.opts.cache==='no-store');
chk('en modo no-cors, porque es otro origen',pedido.opts.mode==='no-cors');
chk('con un parámetro distinto cada vez, para que nadie lo cachee',
    /ping=\d+/.test(pedido.url), pedido.url.slice(-20));

window.fetch=async()=>{ throw new TypeError('Load failed'); };
chk('si el pedido falla, dice que NO hay red',(await T.red())===false);

// `navigator.onLine === false` corta antes de pedir nada: es el único valor
// del que el navegador puede estar seguro, y ahorra el viaje.
let pidio=false;
window.fetch=async()=>{ pidio=true; return {ok:false,type:'opaque'}; };
Object.defineProperty(window.navigator,'onLine',{value:false,configurable:true});
chk('con onLine en false contesta que no hay red',(await T.red())===false);
chk('y no manda ningún pedido',!pidio);

}catch(e){ chk('el cuerpo del test corrió hasta el final',false,String(e).slice(0,300)); }

console.log(`\n${fail?'HAY FALLOS':'todo en verde'} — arrancar-del-binario`);
process.exit(fail);
})();
