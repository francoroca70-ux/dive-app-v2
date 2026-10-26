// Copies the deployable web assets (the same files Render serves) into www/,
// which is the clean folder Capacitor wraps into the native iOS/Android shells.
// Keeps the native build from ever seeing repo-only stuff (supabase/ functions,
// legal/ docs, .git, README-style .md files, node_modules, etc).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

// `landing.html` va al paquete aunque la app instalada nunca la muestre.
//
// Medido el 26/10: está en el `APP_SHELL` de `sw.js`, y como acá no se copiaba,
// en la app instalada el `cache.addAll()` del install fallaba **siempre** — y
// como `addAll` es atómico, eso dejaba la caché entera vacía, en silencio. El
// install se arregló para no ser todo-o-nada, pero el archivo tiene que estar
// igual: una entrada del shell que no existe es un 404 garantizado en cada
// arranque.
//
// La alternativa era sacarla del APP_SHELL. No: en la web la raíz del dominio
// redirige a la landing, y cachearla es correcto — un prospecto con señal mala
// merece verla. Lo que estaba mal era que las dos listas no coincidieran.
const FILES = ['index.html', 'landing.html', 'sw.js', 'manifest.json'];
const DIRS = ['assets'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) copyRecursive(src, path.join(WWW, f));
}
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (fs.existsSync(src)) copyRecursive(src, path.join(WWW, d));
}

console.log('www/ built from:', FILES.concat(DIRS).join(', '));
