# Seven Seas Ops — contexto del proyecto

*Este archivo lo lee Claude Code solo, al arrancar cada sesión. Es la fuente de
verdad del proyecto. `HANDOVER.md` y `NEXT-SESSION.md` son históricos y están
desactualizados — no mandan.*

**Última actualización: 2026-09-30.**

---

## Qué es

SaaS de operaciones para centros de buceo y operaciones de charter. Bilingüe
(ES/EN). Web + apps nativas. Sin lanzar todavía, cero clientes.

Lo construye **Franco Roca (Fran)** — ex instructor de buceo (Fiji, Tailandia,
BVI), hoy en Mar del Plata. **No programa.** Claude escribe todo el código;
Fran despliega, prueba y decide. Trabaja ~1h por día entre semana, 2–3h los
fines de semana.

Objetivo: USD 1.500/mes de ingreso semi-pasivo.

---

## Dónde vive todo

| | |
|---|---|
| **Código** | esta carpeta (`~/dive-app-v2`) |
| **Memoria del proyecto** | el vault de Obsidian en `~/Desktop/Fran´s Vult` |
| Web app | Render, servicio con URL `dive-app-v2.onrender.com` |
| Landing | `sevenseasops.com` → redirige a `www` → sirve `landing.html` |
| Base y auth | Supabase, proyecto `ggtbxjwstkuhnabwpgdz`, región `sa-east-1` |
| DNS | **Squarespace** (`nsa1..nsa4.squarespacedns.com`) — no Cloudflare |
| Pagos | Paddle, en **producción** |
| Apps nativas | Capacitor, cargan la URL de Render |

**El vault de Obsidian no es documentación opcional: es la memoria del
proyecto.** Ahí están las decisiones con su porqué, los postmortems de cada
error caro, los procedimientos y los datos canónicos. Cuando una conversación
se corta, el vault es lo que permite retomar.

Empezar por `Home.md`, después `Convenciones del vault.md` y
`Datos canónicos.md`.

Si el vault no está montado en la sesión, pedirle a Fran que lo agregue con
`/add-dir "C:\Users\franc\Desktop\Fran´s Vult"`.

---

## Reglas duras

**1 · Claude no toca sistemas de pago ni cuentas.** No se hacen pagos,
suscripciones, altas de cuenta ni autorizaciones OAuth en nombre de Fran.
Nunca. Se le dan las instrucciones campo por campo y las hace él.

**2 · Claude casi no corre git, y nunca sin `--no-optional-locks`.**

El sandbox puede *crear* archivos en `.git` pero no borrarlos, así que cualquier
comando que tome un candado lo deja puesto y rompe el commit siguiente de Fran.
Pasó cuatro veces.

- **Nunca**: `add`, `commit`, `push`, `stash`, `reset`, `checkout`, `rm`,
  `read-tree`.
- **Sólo con la bandera**: `git --no-optional-locks status`,
  `git --no-optional-locks diff`.
- **`git status` a secas NO es de lectura** — refresca el índice y toma
  `index.lock`. Esa es exactamente la trampa que dejó el candado del 29/09.

Y lo más barato: **para ver qué cambió en un archivo, leer el archivo.** Git
casi nunca hace falta.

Si aparece *«Another git process seems to be running»*: mirar el candado
primero. 0 bytes y horas de antigüedad = huérfano, y se borra con
`rm -f ~/dive-app-v2/.git/index.lock` en Git Bash. Recién creado = hay un
proceso real, hay que esperar.

El flujo es: Claude escribe el mensaje en `.commit-msg.txt` y Fran corre

```bash
git add -A && git commit -F .commit-msg.txt && git push
```

**Antes de escribir un mensaje nuevo, verificar con `git log` que el anterior
ya se commiteó.** Sobrescribir `.commit-msg.txt` sin mirar hizo perder cinco
mensajes.

**3 · Fran usa Git Bash en Windows.** Comandos POSIX (`rm`, `ls`, barras
normales), no CMD ni PowerShell.

**4 · Cada cambio termina en Obsidian.** Un cambio no está terminado cuando el
código anda: está terminado cuando la nota dice lo mismo que el código. Es una
instrucción permanente de Fran. Ver `Operativa/Cerrar un cambio.md`.

**5 · Al tocar `index.html`, subir dos números:**
- `sw.js` → `CACHE_VERSION = 'seven-seas-vN'`
- `index.html` → el `console.info('[Seven Seas] build …')`

Sin eso, el service worker le sirve a la gente una copia vieja. Ya pasó: dos
días con arreglos desplegados que Fran nunca recibió.

**6 · Validar antes de pushear.** No alcanza con que el archivo parsee. Tres
caídas seguidas pasaron validación sintáctica. Para cambios de UI hay un
patrón que funciona: correr el `index.html` real dentro de jsdom con stubs de
Supabase y Paddle, y comprobar el comportamiento, no la forma.

---

## Cómo pensamos el trabajo

Está en `Operativa/Filosofía de trabajo.md` y conviene leerlo, pero en corto:

**Un error es del flujo, no de la persona.** Si alguien se equivocó, la
pregunta es qué hizo que equivocarse fuera posible. Nunca quién.

**Genchi genbutsu — ir y ver.** No deducir el estado del sistema: medirlo.
Abrir la consola, consultar el DNS, cargar la página. Dos de los errores más
caros del proyecto salieron de inferir en vez de mirar.

**Una regla, una función.** Copiar una regla crea N lugares donde puede estar
mal y ninguno donde tenga que estar bien. El defecto aparece donde la copia
*falta*. Pasó con `escapeHtml` (8 copias, 4 agujeros), con el umbral de
mantenimiento y con el semáforo de habilitación. Cuando aparezca la frase
«copiar esto también a…», la pregunta es por qué hay más de un lugar.

**Los comentarios explican el porqué, no el qué.** El código ya dice qué hace.
El comentario existe para que nadie deshaga una decisión sin enterarse de qué
costó tomarla.

**Ser realista con las proyecciones.** Señalar supuestos sin fundamento. Sin
porras.

---

## Arquitectura, en una pantalla

**`index.html` es toda la app**: ~18.000 líneas, un solo archivo, HTML + CSS +
JS + las traducciones. Es a propósito — Fran despliega sin build step.

- **i18n**: dos diccionarios (`en`, `es`) y `data-i18n` en el HTML.
  `applyTranslations()` recorre el DOM. Todo string nuevo va en los dos.
- **Offline**: checklists, waivers y logs de equipo guardan local y sincronizan.
  Calendario y reservas necesitan conexión (varios editan lo mismo a la vez).
- **Service worker**: todo `.html` es network-first, nunca sale de caché
  habiendo red. Sólo íconos y manifest son cache-first.
- **Apps nativas**: `isNativeAppShell()` detecta Capacitor. El checkout y el
  portal de facturación **cortan ahí antes de abrir nada** — lo exige la guía
  3.1.1 de Apple. Los botones "no funcionan" en el celular a propósito.

**Edge functions** (`supabase/functions/`): `paddle-webhook`, `paddle-portal`,
`waiver-remote-signing`, `send-booking-confirmation`, `send-staff-invite`,
`send-waiver-reminder`, `invite-accept`, `leave-org`, `close-shop`.

**Seguridad, dos principios que costaron caro:**
- El webhook de Paddle **deriva el plan del price ID de Paddle**, nunca de lo
  que dice el navegador. Una firma válida autentica al mensajero, no al
  mensaje.
- La app **no guarda datos médicos**. Registra el hecho de que hubo una
  declaración y una habilitación, no el contenido. Mismo principio en waivers
  de papel y en ventas de merch: registrar el hecho, no el documento.

---

## Estado al 30/09/2026 — y el único bloqueo

**Paddle está en producción y cargado entero**: 3 productos, 6 precios con su
`plan_tier` en Custom Data, token `live_`, cupón `FOUNDINGFLEET30` recurrente
con 10 usos, webhook probado con firma real (200), y los tres secretos en
Supabase. `PADDLE_ENV = 'production'`.

**«Could not open checkout» eran dos fallos distintos con el mismo cartel.**

1. `transaction_default_checkout_url_not_set` — de Paddle, real, ya resuelto
   cargando el Default payment link.
2. **Un bug nuestro de una línea**: el contenedor del checkout inline tenía
   sólo el `id`, y `frameTarget` de Paddle resuelve por **`className`**
   (`getElementsByClassName(frameTarget)[0]`). Paddle recibía `undefined` y
   tiraba `Cannot read properties of undefined (reading 'appendChild')` — y el
   `catch` de `openPaddleCheckout()` se comía el error sin loguearlo.

Arreglado el 30/09 y verificado en la página en vivo: con la clase puesta,
Paddle inyecta el iframe y no tira error. Ver
`Errores y aprendizajes/El catch que se comió el diagnóstico.md`.

> [!important] La app vive en el dominio aprobado
> **`https://www.sevenseasops.com/index.html` sirve la app**, con login,
> `PADDLE_ENV = 'production'` y Paddle inicializado. `sevenseasops.com` está
> aprobado en Paddle. **No hace falta `app.sevenseasops.com` para cobrar** —
> ver `Errores y aprendizajes/El dominio que ya estaba aprobado.md`.

### Lo que falta

**1 · Pushear el build.** `index.html` y `sw.js` en disco
(`build 2026-09-30a`, `sw v17`), mensaje ya escrito en `.commit-msg.txt`.
Lleva el arreglo del checkout **y** los enlaces a términos, privacidad y
reembolsos dentro de la app. Hasta que esto no esté arriba, el botón sigue sin
funcionar.

**2 · La prueba con tarjeta real**, **desde
`https://www.sevenseasops.com/index.html`** — no desde la URL de Render (ese
dominio no está aprobado en Paddle) y nunca desde la app instalada. Los cinco
pasos están en `Operativa/Paddle — grillas de carga.md`.

### Después de eso

- **Decidir qué hacer con `app.sevenseasops.com`.** Hoy resuelve y tiene
  certificado, pero apunta a un servicio de Render equivocado que sirve un
  prototipo viejo llamado *Blue Drift* (verificado: sin Supabase, sin claves,
  todo en `localStorage` — no es una fuga). Render rutea por nombre de host,
  así que el CNAME está bien y lo que está mal es en qué servicio figura el
  dominio. Opciones: moverlo al servicio correcto y usarlo como URL oficial de
  la app, o soltarlo. No es urgente.
- Bajar el prototipo *Blue Drift* de Render
- Casilla de correo para reemplazar el domicilio particular publicado en la
  ficha europea del App Store
- Contactar los 10 centros de la investigación — **no depende de nada**
- Supabase Pro (destraba las páginas SEO)
- Service con sello inalterable en `maintenance_logs`, mismo patrón que el
  certificado de autenticidad de los waivers

---

## Lo que nunca se toca sin preguntar

- Los precios. Viven en `Datos canónicos.md` del vault y en ningún otro lado.
- Los 15 días de prueba: los da **la app**, no Paddle. Configurarlos también en
  Paddle le regala al cliente el doble de días.
- El cupón `FOUNDINGFLEET30` tiene que ser **recurrente**, no del primer
  período. Si no, la landing pasa a ser mentira al segundo mes.
- Los secretos (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`) no van al código, ni
  al vault, ni a una conversación. Van del panel que los genera al campo que
  los consume. **La API key vence el 26/09/2027.**
