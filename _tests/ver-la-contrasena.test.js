// El ojo para ver la contraseña — index.html real en jsdom.
//
//   node _tests/run-all.js      (preferido)
//
// Pedido por Fran el 22/10 para la pantalla de login. Se puso en los OCHO campos
// de contraseña, no en uno, porque la razón es la misma en todos: se tipea en un
// celular, muchas veces con una mano, y una contraseña mal tipeada no se puede
// leer para corregirla.
//
// Lo que este archivo cuida de verdad: **que nadie lo escriba a mano campo por
// campo.** El botón se inyecta recorriendo los campos de contraseña, así que un
// campo nuevo lo recibe sin que nadie se acuerde. Ocho copias en el HTML serían
// ocho lugares donde puede faltar — el modo de falla de este proyecto.
const fs=require('fs'); const {JSDOM}=require('./jsdom');
const {lineasDeCodigoCon}=require('./contar');
const P=require('path').join(__dirname,'..','index.html');
const html=fs.readFileSync(P,'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://www.sevenseasops.com/'});
const {window}=dom;

function tabla(){
  const h={get(t,prop){
    if(prop==='then') return (res,rej)=>Promise.resolve({data:[],error:null}).then(res,rej);
    return ()=>new Proxy({},h);
  }};
  return new Proxy({},h);
}
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
  poner:(r)=>ponerOjoEnContrasenas(r),
  tapar:()=>taparContrasenas(),
  idioma:(l)=>{currentLanguage=l; applyTranslations();},
  traducir:()=>applyTranslations(),
  pantalla:(id)=>showScreen(id)
};`;

// `window.eval`, no `appendChild`: con un script inyectado, una excepción queda
// en silencio y lo único que se ve es que el hook no existe. Así el error se lee.
let boot=null; try{ window.eval(hook); }catch(e){ boot=e; }
chk('arranca sin excepción', !boot, boot?String(boot&&boot.stack||boot).slice(0,300):'');

(async () => {
try {
  if (boot) throw boot;
  const T=window.__t;
  const d=window.document;

  // ─── 1 · Los campos que hay, contados en el DOM ───────────────────────────
  //
  // Se cuentan los inputs de verdad, NO las apariciones de `type="password"` en
  // el archivo: la primera versión de este test contó menciones y dio 9, porque
  // la novena era **el selector de la función que inyecta el ojo**. Séptima vez
  // que contar menciones se equivoca, y esta vez me lo hice a mí mismo en el
  // mismo cambio que escribía la función.
  const campos = [...d.querySelectorAll('input[type="password"]')];
  chk('hay 8 campos de contraseña', campos.length===8,
      campos.length+' campos: '+campos.map(i=>i.id).join(', '));

  // ─── 2 · Todos tienen su botón, y nadie lo escribió a mano ────────────────
  T.poner(d);
  const conOjo = [...d.querySelectorAll('input[data-con-ojo]')];
  chk('los ocho recibieron el ojo', conOjo.length===8, conOjo.length+' con ojo');
  chk('cada uno tiene su botón al lado',
      conOjo.every(i => i.parentNode.classList.contains('pw-wrap')
                     && i.parentNode.querySelector('.pw-ojo')),
      'el input tiene que quedar envuelto, con el botón de hermano');

  // Éste es EL guardián: el botón no está escrito en el HTML.
  chk('ningún `pw-ojo` está escrito a mano en el HTML',
      !/class="pw-ojo"/.test(html),
      'si aparece escrito, volvieron las copias');
  chk('la inyección se declara una sola vez',
      (html.match(/function ponerOjoEnContrasenas/g)||[]).length===1);

  // Corre en el arranque, o no sirve de nada.
  chk('se llama al arrancar', lineasDeCodigoCon(html,'ponerOjoEnContrasenas()').length>=1);

  // ─── 3 · Es idempotente ───────────────────────────────────────────────────
  // Importa porque puede correr dos veces: el arranque más cualquier pantalla
  // que se arme después. Duplicar el botón dejaría dos ojos encimados.
  T.poner(d);
  chk('correrlo dos veces no duplica botones',
      d.querySelectorAll('.pw-ojo').length===8,
      d.querySelectorAll('.pw-ojo').length+' botones');

  // ─── 4 · Alterna, de verdad, en las dos direcciones ───────────────────────
  const login = d.getElementById('login-password');
  const btn = login.parentNode.querySelector('.pw-ojo');
  chk('nace tapada', login.type==='password');
  btn.click();
  chk('un toque la muestra', login.type==='text');
  btn.click();
  chk('otro toque la vuelve a tapar', login.type==='password');

  // ─── 5 · El botón no puede enviar el formulario ───────────────────────────
  // Un botón sin `type` dentro de un form es `submit`: apretar el ojo intentaría
  // iniciar sesión con la contraseña a medio escribir.
  chk('es type=button', btn.type==='button');
  chk('y se puede llegar con el teclado', btn.tabIndex !== -1,
      'tabIndex -1 lo haría inalcanzable sin mouse');

  // ─── 6 · Texto accesible, en los dos idiomas y según el estado ────────────
  chk('tapada dice «mostrar»', /show/i.test(btn.getAttribute('aria-label')||''),
      btn.getAttribute('aria-label'));
  btn.click();
  chk('mostrada dice «ocultar»', /hide/i.test(btn.getAttribute('aria-label')||''),
      btn.getAttribute('aria-label'));
  chk('y lo dice también a quien mira, en el title', !!btn.title);
  chk('aria-pressed sigue el estado', btn.getAttribute('aria-pressed')==='true');

  // El idioma: la clave vive en el atributo, así que cambiar de idioma lo
  // reetiqueta sin que el ojo se entere.
  T.idioma('es');
  chk('en español también', /ocultar/i.test(btn.getAttribute('aria-label')||''),
      btn.getAttribute('aria-label'));
  chk('y no vosea ni manda en imperativo',
      !/\b(mostrá|ocultá|mirá)\b/i.test(btn.getAttribute('aria-label')||''),
      btn.getAttribute('aria-label'));
  T.idioma('en');
  chk('volviendo a inglés se reetiqueta solo',
      /hide/i.test(btn.getAttribute('aria-label')||''),
      btn.getAttribute('aria-label'));

  // El ícono cambia, no sólo la etiqueta.
  const tachado = btn.innerHTML;
  btn.click();
  chk('el ícono cambia con el estado', btn.innerHTML !== tachado);
  chk('y es un SVG, no un carácter', /<svg/.test(btn.innerHTML));

  // ─── 7 · Al cambiar de pantalla, todo vuelve a estar tapado ───────────────
  //
  // El caso real: la tablet compartida del barco. Alguien se loguea con la
  // contraseña a la vista y la deja ahí para el que entre después.
  login.type='text';
  const otro = d.getElementById('signup-password');
  otro.type='text';
  T.tapar();
  chk('taparContrasenas tapa todas', login.type==='password' && otro.type==='password');
  chk('y el botón vuelve a decir «mostrar»',
      /show/i.test(login.parentNode.querySelector('.pw-ojo').getAttribute('aria-label')||''));

  login.type='text';
  T.pantalla('login');
  chk('cambiar de pantalla las tapa', login.type==='password',
      'showScreen es el único lugar que cambia de pantalla');

  chk('y la regla de tapar vive en una sola función',
      (html.match(/function taparContrasenas/g)||[]).length===1 &&
      lineasDeCodigoCon(html,'taparContrasenas()').length>=2,
      'declarada una vez, llamada desde showScreen y showPage');

  // ─── 8 · i18n en los dos diccionarios ────────────────────────────────────
  for (const k of ['pw_show','pw_hide']) {
    chk(k+' está en los dos idiomas', (html.match(new RegExp(k+':','g'))||[]).length===2,
        (html.match(new RegExp(k+':','g'))||[]).length+' definiciones');
  }

  // ─── 9 · El soporte de aria es genérico, no un parche del ojo ────────────
  chk('applyTranslations entiende data-i18n-aria',
      /data-i18n-aria/.test(html) &&
      lineasDeCodigoCon(html,"querySelectorAll('[data-i18n-aria]')").length===1);

  // ─── 10 · El ojo se ve en los DOS temas de campo ─────────────────────────
  //
  // Lo encontré mirando la pantalla real, no en jsdom: la primera versión usaba
  // `currentColor` creyendo que se adaptaba, y midió **#1a2a3a sobre el campo
  // oscuro** — el botón es hermano del input, así que hereda de `.login-card`,
  // que es navy; el que es blanco es el input.
  //
  // Medido: el campo de autenticación es blanco sobre oscuro, el de
  // Configuración es #1a2a3a sobre blanco. Dos temas, dos declaraciones, en los
  // mismos dos lugares donde ya viven los colores de los campos.
  chk('el ojo no usa currentColor (heredaría del contenedor, no del campo)',
      !/\.pw-ojo \{[^}]*currentColor/.test(html),
      'currentColor acá da navy sobre oscuro');
  chk('tiene un color para el tema claro', /\.pw-ojo \{[^}]*color: var\(--text\)/.test(html));
  chk('y otro para las pantallas oscuras de autenticación',
      /\.form-group \.pw-ojo \{[^}]*color: var\(--white\)/.test(html));
  chk('el campo deja lugar para el botón',
      /\.pw-wrap > input \{[^}]*padding-right/.test(html));

} catch(e){ chk('el test corrió entero', false, String(e&&e.stack||e).slice(0,500)); }

console.log('\n'+pass+' pass, '+fail+' fail');
process.exit(fail?1:0);
})();
