# Seven Seas Ops — contexto del proyecto

*Este archivo lo lee Claude Code solo, al arrancar cada sesión. Es la fuente de
verdad del proyecto. `HANDOVER.md` y `NEXT-SESSION.md` son históricos y están
desactualizados — no mandan.*

**Última actualización: 2026-10-03.**

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

**Roles y checklists** (revisado el 03/10): un rol por persona (`staff.role`).
Ese único campo hace dos trabajos distintos — permiso y área de trabajo — y de
ahí salen casi todos los roces. El detalle completo, con lo que está y lo que
no está filtrado por rol, en `Seven Seas Ops/Qué ve cada rol.md` del vault.

Tres cuidados concretos al tocar esta zona:
- `checklist_completions.role` dice **qué checklist** se firmó
  (`deck_morning`, `instructor`, `custom_<id>`), **no quién**. Logged
  Checklists la lee para etiquetar. Pisarla rompe esa vista.
- `DEPT_ROUTINE_VISIBILITY_BY_ROLE` (qué pestañas ve un rol) y
  `deptKeyForRole()` (bajo qué pestaña se archivan sus checklists propias) se
  ven casi iguales y dicen cosas distintas. No editar las dos a la vez.
- Quien firma sale de un selector de la tripulación, no de texto libre, y se
  guarda en `completed_by`. Ver `Quién firma una checklist.md`.

**Pruebas**: `_tests/*.test.js` — 106 comprobaciones corriendo el `index.html`
real en jsdom. `npm i -D jsdom && node _tests/<archivo>.test.js`.

**Checklists — reforma en curso (06/10).** Tres conceptos que la palabra
«checklist» tapaba: **plantilla** (lo que hay que revisar, editable),
**en curso** (lo que se lleva tildado, compartido entre personas y días) y
**acta** (lo firmado, inmutable). El plan completo, las siete etapas y qué
tabla conservar o borrar está en `Seven Seas Ops/Plantillas y actas.md` del
vault — **leerlo antes de tocar este módulo.**

Hecho: bloque 0 (actas inmutables), etapa 0.5 (`checklist_progress`, una fila
por tilde) y etapa 1 (el esquema: `checklist_templates` +
`checklist_template_items`, con `scope` y una restricción de coherencia).
Sigue: **etapa 2** — semillas de los 17 tipos de salida, sembradas al activar
cada categoría. `custom_checklists` sigue viva a propósito hasta la etapa 3.

**El acta no tiene FK a local, salida ni persona, y es a propósito.** Un acta
es inmutable, así que una cascada —que la borraría— o un `SET NULL` —que la
modificaría— chocan con el trigger y rompen la operación del vecino: borrar un
local, dar de baja a alguien, borrar una salida. En vez de eso el acta guarda
el nombre (`boat_name`, `signed_by`, `location_name`, `trip_name`) y deja los
ids como punteros. No volver a ponerle FKs ni ablandar el trigger — ver
`Errores y aprendizajes/Las claves que peleaban con la inmutabilidad.md`.

El acta se arma en **un solo lugar**, `buildRecordPayload()`. Los tres caminos
que firman la usan y hay un test estructural que lo verifica.

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

**El circuito de cobro está probado de punta a punta con tarjeta real
(30/09/2026).** Alta → cobro → plan derivado del price ID de Paddle → portal
de cliente → baja. Los registros del webhook muestran las dos escrituras:

```
11:58:57  org 81944871… -> active    (starter via price.custom_data)
13:30:54  org 81944871… -> canceled  (starter via price.custom_data)
```

> [!important] Dónde se prueba
> **`https://www.sevenseasops.com/index.html`**, en navegador. No desde la URL
> de Render (ese dominio no está aprobado en Paddle) y **nunca** desde la app
> instalada, donde el checkout corta a propósito por la guía 3.1.1 de Apple.
> No hace falta `app.sevenseasops.com` para cobrar — ver
> `Errores y aprendizajes/El dominio que ya estaba aprobado.md`.

La prueba costó ~4,45 USD (la comisión de Paddle no se reembolsa) y encontró
cinco fallos que un cliente habría encontrado por nosotros. Los cinco están en
`Errores y aprendizajes/`; conviene leerlos antes de tocar cobros.

### Lo que sigue en esta área

- **Configurar el payout**: `vendors.paddle.com` → Paddle Balance. Cuenta
  bancaria y verificación de identidad. Es lo único que falta para que el
  dinero llegue a Fran. Ojo con el mínimo de payout y el ciclo de pago: la
  primera transferencia no sale al día siguiente del primer cliente.
- **La app no registra el cambio agendado.** Un centro que cancela con 20 días
  por delante no ve nada: ni «tu suscripción termina el 30 de octubre», ni un
  aviso. Funciona, pero queda mudo justo cuando el cliente quiere confirmación.

### Después de eso

- **Decidir qué hacer con `app.sevenseasops.com`.** Hoy resuelve y tiene
  certificado, pero apunta a un servicio de Render equivocado que sirve un
  prototipo viejo llamado *Blue Drift* (verificado: sin Supabase, sin claves,
  todo en `localStorage` — no es una fuga). Render rutea por nombre de host,
  así que el CNAME está bien y lo que está mal es en qué servicio figura el
  dominio. Opciones: moverlo al servicio correcto y usarlo como URL oficial de
  la app, o soltarlo. No es urgente.
- Bajar el prototipo *Blue Drift* de Render
- **iOS: build 136001 en revisión** desde el 30/09, reenviado con capturas
  nuevas tras el rechazo del 23/09 por metadatos (guía 2.3.3: las capturas de
  13" sólo mostraban el login). El procedimiento para prepararlas está en
  `Operativa/Capturas para el App Store.md` del vault — se repite en cada
  versión.
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
