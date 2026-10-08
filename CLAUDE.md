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

**Pruebas**: `_tests/*.test.js` — 257 comprobaciones corriendo el `index.html`
real en jsdom. `npm i -D jsdom && node _tests/<archivo>.test.js`.

**Checklists — reforma en curso (06/10).** Tres conceptos que la palabra
«checklist» tapaba: **plantilla** (lo que hay que revisar, editable),
**en curso** (lo que se lleva tildado, compartido entre personas y días) y
**acta** (lo firmado, inmutable). El plan completo, las siete etapas y qué
tabla conservar o borrar está en `Seven Seas Ops/Plantillas y actas.md` del
vault — **leerlo antes de tocar este módulo.**

Hecho: bloque 0 (actas inmutables), etapa 0.5 (`checklist_progress`), etapa 1
(el esquema) y **etapa 2** (las semillas: 16 tipos de salida, 270 ítems, en
`checklist_seeds`, sembradas por un disparador al activar una categoría).
Hecho también **etapa 3a**: el camino de tres capas que el offline necesita,
construido y probado, con el interruptor `FUENTE_PLANTILLAS` todavía en
`'cableado'`. Sigue: **3b**, pasarlo a `'base'` — una línea, y volver atrás
también. `custom_checklists` se fusiona ahí.

**Las checklists funcionan sin señal SÓLO porque las listas están cableadas en
`index.html`**, que es lo que el service worker cachea: no toca los pedidos a
Supabase y `localStorage` no guarda datos de la app. Leer de la base sin más
dejaría a un instructor en un barco **sin ninguna lista**. De ahí las tres
capas: base → caché local → cableado. La capa 3 es gratis hasta la etapa 5, que
es la que borra lo cableado; mientras siga ahí, nadie queda sin lista.

**La caché guarda las filas bilingües, no el texto resuelto** — el idioma es de
quien mira, no de cuando se guardó. La clave lleva el org id (un navegador tiene
varias cuentas guardadas) y versión de esquema. Todo acceso a `localStorage` va
envuelto en try/catch.

**Un fallo de red y un rechazo del servidor piden lo contrario.** Sin red se
ENCOLA (nunca llegamos, hay que reintentar); con rechazo NO se encola, porque
reintentar no lo va a hacer entrar y **trancaría la cola**, que se detiene en
el primer fallo.

**Y la forma del error NO alcanza para distinguirlos: hay que medir la red.**
Cada navegador la redacta distinto y un corte lento puede traer un `code`
inesperado — clasificar por mensaje falló en producción con Fran probando modo
avión. Si una escritura falla, `hayRedDeVerdad()` manda un **HEAD** al propio
origen (HEAD porque el service worker sólo intercepta GET; con GET lo
contestaría la caché y no mediría nada). La forma del error es una pista, la
red es un hecho. `pareceFalloDeRed()` quedó reducido a lo único que la medición
respalda: la ausencia de `code`.

**El acta se guarda sólo en `guardarActa()`**, y el progreso se borra SÓLO si
entró. Antes los tres firmados insertaban sin mirar el error y limpiaban igual:
si se cortaba la señal al firmar, el acta no existía, los tildes se borraban y
el cartel decía «firmada». Ver
`Errores y aprendizajes/La señal que se corta antes de que el navegador se entere.md`.

**Al recuperar la señal se vacía `progressCache` y se redibuja**
(`refrescarChecklistVisible`). Antes sólo se vaciaba al firmar, así que después
de reconectar no se veía lo que tildó el resto de la tripulación hasta recargar
la página — y lo mismo con dos personas tildando a la vez.

**Los ítems de plantilla son bilingües en la base** (`text_en` + `text_es`),
decidido por Fran el 07/10: al pasar a ser dato del centro un ítem sería un
solo texto, y `organizations` no tiene idioma — lo elige cada persona. El acta
NO hereda esto: guarda el texto ya resuelto en el idioma que vio quien firmó.

**Las semillas son datos, no código**: `checklist_seeds` es una tabla global de
la que se COPIA. Corregir una semilla no cambia lo que un centro ya recibió, y
eso es lo correcto. La siembra es idempotente y va **una lista por nombre** de
tipo de salida, no por fila, porque hay centros con tipos duplicados
históricos. Contenido completo en
`Seven Seas Ops/Checklists sembradas por tipo de salida.md`.

**El español de los textos es neutro latinoamericano, no rioplatense** (pedido
por Fran el 07/10: hay muy pocos centros de buceo acá y los clientes van a
estar repartidos por la región). Cooler y no conservadora, leash y no invento,
wax y no parafina —en Chile y Perú parafina es kerosene—, spot y no pico, gaff
y no rebenque. **Se mantienen «huéspedes» y «licra»** porque la app ya los usa
en todo el producto: coincidir con el resto pesa más que la preferencia.

**El acta no tiene FK a local, salida ni persona, y es a propósito.** Un acta
es inmutable, así que una cascada —que la borraría— o un `SET NULL` —que la
modificaría— chocan con el trigger y rompen la operación del vecino: borrar un
local, dar de baja a alguien, borrar una salida. En vez de eso el acta guarda
el nombre (`boat_name`, `signed_by`, `location_name`, `trip_name`) y deja los
ids como punteros. No volver a ponerle FKs ni ablandar el trigger — ver
`Errores y aprendizajes/Las claves que peleaban con la inmutabilidad.md`.

El acta se arma en **un solo lugar**, `buildRecordPayload()`. Los tres caminos
que firman la usan y hay un test estructural que lo verifica.

**El acta se lee sola: no se incrusta `trips(...)`.** PostgREST deduce los
`select` incrustados de las foreign keys, así que al soltar la FK del acta a
`trips` las tres consultas que la incrustaban empezaron a devolver 400
(PGRST200) y Logged Checklists quedó vacío. El acta guarda `trip_name`,
`trip_date` y `trip_time`, y la etiqueta se arma en `tripLabelDeActa()`, que
lee sólo columnas del acta. **Antes de soltar una FK, buscar quién la estaba
usando para incrustar** — el error es idéntico al de una tabla inexistente.
Ver `Errores y aprendizajes/La clave que sostenía un join.md`.

**Y para cambios de esquema, jsdom no alcanza.** La suite estaba en verde: un
stub de Supabase no sabe que PostgREST necesita una FK para incrustar. Hay que
pegarle a la API real con la consulta que usa la app.

**Una checklist firmada muestra el acta, no la lista viva.** Firmar cierra la
instancia y borra el trabajo en curso, así que antes se veía «completa» arriba
de una lista vacía — que para el capitán que entra después se lee como que no
se hizo nada, cuando lo que necesita ver es que las toallas NO se cargaron.
`mostrarActaSiHay()` dibuja `items_snapshot` de sólo lectura en los dos caminos
(salida y rutina de departamento). Para otra pasada está «Reset», que firma un
acta aparte — nunca se edita la vieja.

**Qué cuenta como historia al quitar una salida** (afinado el 07/10): una
reserva sólo cuenta si tiene participantes o pagos. El formulario crea una
reserva junto con la salida, así que contar cualquiera hacía que **toda** salida
se archivara. Una reserva vacía se borra con la salida, en la misma transacción.

**Los tildes se pintan antes de guardar**, vía `marcarTilde()`. Los tres
toggles esperaban el viaje a São Paulo antes de dibujar (más otro por
`getUser()` en cada tilde), así que tildar tardaba ~1s. El id del usuario sale
de `currentUserId`, cacheado al arrancar la sesión. Si la escritura falla, el
tilde se deshace en pantalla y se avisa. `marcarTilde()` es el **único dueño**
del estado en pantalla — `saveChecklistTick()` no lo toca.

**Archivar en vez de borrar** (decidido por Fran el 07/10). Nada que tenga
historia se borra: se archiva. Los registros legales guardan snapshot y sueltan
la FK; las entidades operativas se archivan; sólo lo que no tiene nada colgado
se borra de verdad. Un tripulante archivado pierde el acceso salvo que lo
reactiven (la gente vuelve la temporada siguiente). El plan completo y qué
falta, en `Decisiones/Archivar en vez de borrar.md`.

Hecho: las **salidas**. `trips.archived_at`, y quitar una salida es una sola
llamada atómica a `trip_archive_or_delete()` — la regla de qué se puede borrar
vive ahí, del lado del servidor, y su modo consulta es el que arma el aviso
para que no haya dos cuentas distintas de lo mismo. Es sólo de dueño o
encargado. Pendiente: el paso 2 (que todos los borrados miren el error) y el
paso 3 (tripulantes, barcos, locales, huéspedes).

**Las ocho consultas que listan salidas pasan por `tripsVigentes()`.** Es el
único lugar donde vive el filtro de archivadas. Dos excepciones deliberadas y
comentadas: `openTrip(id)` busca una por id, y `exportAllShopRecords()` es el
historial completo y las archivadas tienen que estar. Archivar saca algo del
uso diario, no del registro.

**Cinco `await sb.from(…).delete()` seguidos NO son una transacción.** Cada uno
es su propio pedido y commitea solo, así que una secuencia puede fallar a mitad
y dejar un estado roto — eso es exactamente lo que hacía el borrado de una
salida. Lo que borre en varios pasos va del lado del servidor, en una sola
transacción. Ver `Errores y aprendizajes/El borrado que perdía la mitad.md`.

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
