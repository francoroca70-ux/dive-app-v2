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

**Y el paso que más se saltea es correr `python3 _scripts/chequeo_vault.py`.**
Está en el procedimiento desde el 24/09. La primera vez que se corrió en serio
(09/10) encontró tres hallazgos de una sola sesión: un enlace roto, una nota
huérfana y un `type` inventado (`referencia` no existe — los válidos son `moc`,
`note`, `decision`, `procedimiento`, `postmortem`, `person`, `project`).

**Dos skills guardadas encapsulan este flujo** y conviene usarlas en vez de
reconstruirlo de memoria, que es lo que lo hacía distinto cada vez:
`seven-seas-investigar` (antes de tocar algo: leer el vault, medir el sistema
vivo, tratar la nota como hipótesis) y `seven-seas-cerrar-cambio` (después: qué
nota toca, frontmatter, versiones, chequeo, mensaje de commit).

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
- Quien firma sale de un selector, no de texto libre, y se guarda en
  `completed_by`. Desde el 09/10 el selector ofrece **sólo a quienes tildaron
  algo, más el usuario de la sesión**. Ver `Quién firma una checklist.md` y
  `Decisiones/Quién tildó cada ítem.md`.

**Pruebas**: `node _tests/run-all.js` — 441 comprobaciones corriendo el
`index.html` real en jsdom. **Las corre Fran también**, que hasta el 09/10 no
podía: los trece archivos hacían `require('/tmp/node_modules/jsdom')`, una ruta
que sólo existe en el sandbox de Claude, así que en su Windows daban cero. La
regla «validar antes de pushear» la estaba ejecutando una sola de las dos
personas. Ahora jsdom sale de `_tests/jsdom.js` (un solo lugar: `jsdom` del
proyecto primero, el sandbox después, y `JSDOM_PATH` como atajo porque desde la
carpeta montada tarda ~35 s por archivo). **Ninguna ruta absoluta en los
tests.**

**Correr la suite con `run-all.js`, no archivo por archivo.** Un test que queda
esperando algo (un modal que nadie cierra) deja a node sin trabajo pendiente y
**termina con código 0 sin imprimir nada más**: el `process.exit(fail)` del final
nunca corre. Pasó el 09/10 — `checklist-record` bajó de 54 comprobaciones a 6 y
reportó **cero fallos**, y lo agarré de casualidad mirando el número. `run-all.js`
tiene un mínimo por archivo, una cuenta final y un reloj de 90s, y **sale con 1
si un archivo corrió menos de lo que corría**. Los mínimos sólo se tocan para
arriba.

**Y distingue «no arrancó» de «se cortó a mitad»**, porque la primera vez
diagnosticó mal: trece archivos con cero comprobaciones por una dependencia
faltante decían «se cortó a mitad» y mandaron a buscar un corte inexistente. Un
guardián que describe mal el problema cuesta lo mismo que no tenerlo. Ver
`Errores y aprendizajes/El test que se cortaba a mitad y decía que todo estaba bien.md`.

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
construido y probado, con el interruptor `FUENTE_PLANTILLAS` en `'cableado'`.

**Etapa 3b hecha el 09/10: la lista de preparación sale del tipo de salida.**
La 3a había construido y probado el camino de tres capas y
`itemsDeInstructorParaTipo()` **no la llamaba nadie** — el interruptor existía y
no cambiaba nada. `FUENTE_PLANTILLAS` está en `'base'` y volver atrás sigue
siendo esa línea (hay un test que cuida que nadie más que `cargarConTresCapas()`
la mire).

**La pieza clave: la lista de una salida se resuelve UNA vez y no se vuelve a
tocar.** No es optimización. Los ids de ítem son la llave de los tildes: la
lista cableada usa posiciones (`'0'`, `'1'`…) y la plantilla usa uuid. Si una
salida resolviera su lista en cada dibujo, un corte de red a media mañana la
pasaría de uuid a posicional y **todos los tildes de la tripulación se verían
perdidos** — están guardados con la otra llave.

- `instructorItemsByTrip` guarda **filas bilingües** o el centinela `'cableado'`
- `itemsDeLaSalida(tripId)` es sincrónico y resuelve el idioma en cada lectura;
  es lo que piden los cuatro lugares que dibujan o firman
- `fijarItemsDeLaSalida(tripId)` resuelve una vez, antes de dibujar y antes de
  leer los tildes
- `filasDePlantillaParaTipo()` devuelve las filas crudas — una sola consulta,
  dos formas de pedirla

**La caída a lo cableado TAMBIÉN se guarda**, con el centinela: si no, el día
que la plantilla apareciera (alguien activa la categoría a media mañana) la
lista cambiaría de llave con la tripulación tildando. **Para una salida abierta,
estabilidad le gana a frescura.**

**Bug que introduje y agarró el test:** la primera versión guardaba el texto ya
resuelto, lo que congela el idioma — el **mismo** error que la 3a había
arreglado para la caché de `localStorage`, repetido doce líneas más abajo. Si
una caché guarda algo que depende de quién mira, guarda el dato crudo.

**Para probarlo hay que elegir bien el tipo de salida.** La cuenta de Fran está
en *Blue water*, que tiene `diving` **sin activar**: sus 9 tipos no-buceo tienen
plantilla (14–22 ítems) y los 7 de buceo tienen **cero**. Con un tipo de buceo
se ve la lista cableada y parece que no funcionó. Probar con **Island Hopping**
(22 ítems) o Sunset Cruise (21). Y la checklist de preparación sólo lista las
salidas **de hoy** — hay que crear una.

**Paso 1 de la 3b, listo y sin aplicar (09/10):** `trip_types_merge_duplicates(org, aplicar)`
fusiona los tipos duplicados en una transacción, con **modo consulta** como
`trip_archive_or_delete()`. Conserva la copia que tiene la plantilla (medido: no
hay grupo con plantilla en dos copias) y **salta** cualquier grupo que la
tuviera, porque la FK de `checklist_templates` es **CASCADE** y borrar esa copia
se llevaría la plantilla en silencio. Repunta antes de borrar: las FK de `trips`
y `trip_groups` son NO ACTION y frenan el borrado hasta entonces.

**Aplicado el 09/10 y dio exactamente la predicción**: 111 tipos → **51**, 17
grupos duplicados → **0**, salidas con plantilla 32 → **44**, plantillas
**43 → 43**. Escribir la predicción antes es lo que hace que «dio 51» signifique
algo; sin ella cualquier número parece razonable.

**Y el supuesto que tuve que corregir midiendo:** supuse que algo seguía creando
duplicados. No. La siembra no era idempotente y se le puso un guardián el
**07/09** (`b182b2e`); todos los duplicados son del 30/06 al 05/08 y después del
guardián se crearon **0**. Esto es residuo, no una fuga activa.

**Hueco aparte, encontrado ahí:** un centro puede crear salidas de una categoría
que **no activó**, y las plantillas se siembran al activarla — así que *Blue
water* tiene salidas de buceo y ninguna plantilla de buceo. Detalle en
`Seven Seas Ops/Tipos de salida duplicados.md`.

> [!important] La 3b está TERMINADA y desplegada (`e88ecfb`, `build 2026-10-09e`,
> `sw v42`). Lo de abajo **no es una parte pendiente de la 3b**: es una función
> NUEVA que el trabajo de la 3b destapó como pregunta. Llamarla «lo que queda de
> la 3b» fue un error de redacción mío que hizo dudar a Fran de si la etapa
> estaba cerrada. **Está cerrada.**

**Dos actividades en un mismo barco — función nueva, con un PIN puesto por Fran
el 10/10.** La pregunta que la 3b destapó era qué lista gana cuando una reserva
pisa el tipo de la salida; la respuesta correcta es que **no gana ninguna, salen
las dos** (un private charter que además bucea necesita la lista de charter *y*
la de buceo). Pero construirlo
toca la **identidad** de una checklist —llave del progreso, esquema del acta, el
guardián de no-firmar-dos-veces y la pantalla entera, 269 líneas— en un módulo
con **cinco postmortems en cuatro días**, y el caso mide **cero** en los datos
(0 salidas con dos actividades, 0 reservas con el tipo pisado).

Se revirtió el trabajo a medio hacer. **Mientras tanto se usa `trips.notes` /
`trip_groups.notes`, que ya existen.** Ojo: una checklist propia se indexa por
`dept_key + role_scope + cadence`, **no por tipo de salida**, así que «que el
centro se arme una checklist para esa salida» hoy no es posible sin construir.

**Cuándo se retoma, decidido por Fran:** «una vez que hayamos cerrado todo y
estemos activamente buscando clientes». Y la señal es medible:
`select count(*) from trip_groups where trip_type_id is not null;` — medido el
10/10: **0**. Mientras siga en 0 el caso es hipotético. Diseño completo y las
cinco cosas que hay que mover, en
`Decisiones/Dos actividades en un mismo barco.md`.

**Quedó aplicada la migración `acta_guarda_la_actividad`**
(`checklist_completions.trip_type_id` + `activity_name`, nulas, sin FK). Es
aditiva y **nadie la escribe ni la lee**: se dejó porque borrarla es un DDL
destructivo a cambio de nada.

**Y la lección de proceso, que es mía:** no puse el costo sobre la mesa antes de
empezar. Dije «es más grande que los últimos cambios» y seguí — y «grande» no le
dio a Fran nada con qué decidir.

**7 · Decir cuánto cuesta un cambio, del 1 al 10, ANTES de empezar.** Pedido por
Fran el 10/10 por lo de arriba. Las anclas son reales: un texto es 1, una
columna nueva 3, una función con su test 4, una regla en N lugares 5, un camino
nuevo en un módulo 6, cambiar la **fuente** de algo en uso 7, **reestructurar un
módulo en varias sesiones 8** (el ancla que fijó Fran: la reforma de checklists
entera), tocar la **identidad** de algo en uso en varios módulos 9, cobros o
autenticación 10.

Y el número va con tres mediciones, o es un invento: **¿toca la identidad de
algo en uso?** (+2), **¿cuántos lugares?** (contados), **¿cuántas veces se da el
caso en los datos hoy?** (si es 0, el beneficio es hipotético). Más una cuarta:
**¿rehace trabajo cerrado?**

**De 7 para arriba el número va primero y se espera la respuesta.** De 1 a 6 se
dice y se sigue. La escala no mide riesgo: un 3 que toca cobros es más peligroso
que un 6 que toca un texto. Ver `Operativa/Cuánto cuesta un cambio.md`.

Detalle y la lección —leí mi propia nota en vez de medir el código, cuatro
veces— en `Seven Seas Ops/Plantillas y actas.md`.

**Y para esta etapa jsdom no alcanzó:** se midió contra la base real que la FK
`checklist_template_items → checklist_templates` existe (sin ella el `select`
incrustado daría PGRST200), que las 5 columnas del select están, y que RLS
haciéndose pasar por Fran devuelve filas — 9 plantillas y 156 ítems.

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

**Mientras la checklist está abierta, el progreso se relee cada 10 segundos**
(`arrancarRefrescoDeProgreso`), más un refresco al volver a la app. Antes se
leía una vez por sesión y se cacheaba, así que los tildes de un compañero no
aparecían ni saliendo y volviendo a entrar. Diez segundos y no Realtime,
decidido con Fran el 08/10: cargando un barco es indistinguible de «en vivo» y
un websocket se caería todo el tiempo con señal de barco. **Realtime está
agendado** para cuando haya clientes — la publicación `supabase_realtime` existe
sin tablas, así que es una migración.

**Y la parte difícil no es el refresco: es no pisar tu propio tilde.**
`tildesPendientes` guarda lo marcado o desmarcado que el servidor no confirmó,
y lo del servidor es la base con lo pendiente ENCIMA. Destildar también es
pendiente (si no, un refresco lo resucita). Un tilde encolado sigue pendiente
hasta que la cola se vacíe entera. Si el refresco falla, se conserva lo que ya
estaba en pantalla.

**Al recuperar la señal se vacía `progressCache` y se redibuja**
(`refrescarChecklistVisible`). Antes sólo se vaciaba al firmar, así que después
de reconectar no se veía lo que tildó el resto de la tripulación hasta recargar
la página — y lo mismo con dos personas tildando a la vez.

**Cada ítem guarda quién lo tildó, y el acta se lo lleva** (pedido por Fran el
09/10: firma uno, el barco lo cargan cuatro). El dato ya se escribía
(`checked_by`) y se tiraba dos veces — la lectura pedía sólo `item_id, checked`
y el snapshot guardaba `{id, text, done}`, así que **la atribución se destruía
justo al firmar**, el momento en que empieza a valer. Las actas anteriores al
09/10 la perdieron y no se recupera.

La autoría cuelga del **mismo objeto de tildes que la pantalla dibuja**
(`autoresDeChecks`, un WeakMap): los ids de ítem son posicionales y un mapa
global cruzaría el ítem 0 de dos listas distintas, y `renderCheckItems` lo
llaman siete lugares. Se pinta con el tilde y se deshace con él. Un tilde
pendiente conserva su nombre hasta que el servidor confirme, igual que
`tildesPendientes` hace con el tilde. El acta guarda `by` **y** `by_id`: el id
es el hecho y el nombre la comodidad, y si se firmó sin señal sin la lista de
tripulación cargada, el nombre se resuelve al dibujar desde el id.
«La completaron entre Pau, Guido y Meli» se **deriva**, no se guarda aparte.

`checked_by` es la **cuenta del dispositivo**, no las manos, y eso está
resuelto: los dos modos conviven (cada uno su celular, o una tablet del barco
logueada con una cuenta que el centro conoce). La app no miente en ninguno
porque dice de qué cuenta salió el tilde — de ahí que los textos digan «desde
la cuenta de» y no «hecho por».

**Y sólo puede firmar quien participó** (09/10). El selector del 03/10 ofrecía
toda la tripulación activa, así que un marinero podía firmar la revisión de
seguridad **como el capitán, que ni estuvo**. Ahora ofrece a los que tildaron
algo **más vos siempre** (estás presente y autenticado, y sin eso una checklist
sin un solo tilde no se podría firmar nunca). Se repuebla en cada dibujo, porque
la lista crece a medida que la tripulación tilda, y conserva lo ya elegido si
sigue valiendo. En la tablet compartida queda un solo nombre, que es correcto.

Queda abierto firmar como alguien que **sí** participó, y no se previene porque
rompe un caso real (se le muere el celular a uno y el otro termina y firma): se
**registra** en `signed_by_account`, la cuenta que apretó firmar, que puede
diferir de `completed_by`. Mismo principio que el certificado de autenticidad de
los waivers, y **sin FK** como el resto del acta.

`FIRMANTE_SELECT_POR_LISTA` mapea lista → selector en un solo lugar, para no
agregarle un séptimo parámetro a `renderCheckItems`.

**Al firmar una incompleta se pregunta POR QUÉ faltó cada ítem** (hecho el
09/10, pedido por Fran con el caso de las toallas en un private charter).
Reemplazó al sí/no «faltan 2 ítems, ¿firmar igual?» — la pregunta que le sirve a
un centro no es si firma, es por qué faltó, y eso es lo que convierte «firmada
14/16» en algo con lo que se le contesta a un cliente. Un campo por ítem que
faltó y sólo por ésos; va a `items_snapshot.why`, sin cambio de esquema.

**Los motivos son opcionales a propósito**: obligarlos con diez ítems sin hacer
haría que alguien escriba «x» diez veces, y un dato inventado es peor que
ninguno porque parece un dato. Un objeto vacío significa «firmo sin explicar» y
es distinto de cancelar. Un motivo sobre un ítem hecho se descarta — en un
registro inmutable un campo sin sentido queda para siempre. `confirmarFirma()`
decide en un solo lugar si se pregunta o no, así que los tres caminos no pueden
divergir.

**La lista única de lo que queda abierto en checklists** —lo que espera una
decisión de Fran, lo que espera una prueba de uso y lo decidido que falta
construir— está en
`Seven Seas Ops/Checklists — qué falta decidir y probar.md` del vault.

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

**El verde con tilde significa 100% tildada, y nada más.** `estadoDeActa()` lo
decide en un solo lugar y lo usan cinco: las dos burbujas al dibujar una ya
firmada, las dos al firmarla, y la insignia de la lista de actas. Antes firmar
ponía «Completo ✓» sin mirar cuánto se había tildado — Fran firmó una con 6 de
16 y la pantalla le dijo que estaba completa. Lo que falta va en ámbar y con
los números («Firmada 6/16»), que es lo que un capitán necesita.

**Una checklist firmada no se puede volver a firmar, y eso se cubre en CINCO
momentos, no en uno.** El arreglo del 08/10 («firmada muestra el acta») se había
aplicado sólo al camino de **cargar** la pantalla, no al de **firmar** — así que
firmar dejaba la lista viva tildada con el botón ahí y sólo cambiaba el cartel.
Fran apretó, no vio cambio, apretó otra vez: **dos actas idénticas de 4/4
separadas por 1,7 segundos.** Lo que lo cubre ahora:

- los tres firmados **redibujan** al terminar, así que la pantalla pasa al acta
- `pintarZonaDeFirma()` esconde selector y botón cuando hay acta, y los
  **devuelve** cuando no (pintarla sólo al haber acta dejaba el botón escondido
  para siempre al volver a una sin firmar)
- `firmasEnCurso`, un candado por instancia, para el doble toque en vuelo
- y **antes de insertar** se pregunta al servidor si la instancia ya tiene acta
  (`buscarActaVigente()`): con el progreso compartido, Juanma puede firmar en su
  celular y el mío no se entera hasta el refresco. Si ya hay, no se inserta y se
  dice quién firmó — **el acta de quien llegó primero queda.**

El cartel de «firmada» se pinta **después** del insert, no antes: antes quedaba
diciendo «✓ firmada por Franco» arriba de un acta que el servidor había
rechazado. Ver
`Errores y aprendizajes/El arreglo que no cubrió el momento de firmar.md`.

**Pendiente de ahí:** una checklist **propia** firmada todavía no muestra su
acta (`renderCustomChecklistsForCurrentView` nunca consulta
`checklist_completions`); no se puede duplicar, pero falta la vista. Y **Reset
quedó ambiguo**: vacía los tildes y el redibujo vuelve a encontrar el acta del
período, así que no abre visiblemente una pasada nueva. Hay que decidirlo con
Fran.

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

**Todo borrado pasa por `borrarOAvisar()`** (paso 2, hecho el 08/10). Había 32
borrados y sólo 4 miraban el error; los otros 28 fallaban en silencio. La regla
—mirar, registrar, avisar y **cortar**— vive en una función, y el motivo se
traduce: `23503` → «tiene registros asociados», `42501` → «sin permiso», sin
red → «sin conexión». Las secuencias se detienen al primer fallo, que es lo que
dejaba estados a medias. Dos excepciones: el replay de la cola **lanza** (su
trabajo es reintentar) y la limpieza post-firma sólo registra (el acta ya entró;
un cartel ahí haría dudar de una firma válida).

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

**Permisos de funciones: revocar a `anon`/`authenticated` por nombre NO sirve.**
Postgres concede EXECUTE a **PUBLIC** por defecto (el ACL lo muestra como
`=X/postgres`, la cadena vacía ES PUBLIC) y los dos roles lo heredan de ahí. Va
`revoke execute … from public`. Revocado así, **los triggers siguen disparando**
— verificado. Y `my_staff_org_and_role()` **no se toca**: la usan 11 políticas
de RLS, que se evalúan con el rol que consulta, así que revocarla rompe la app
(medido: 4 filas → «permission denied»). Ver
`Errores y aprendizajes/El permiso que nunca estuvo revocado.md`.

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
- Supabase Pro — destraba **dos** cosas: las páginas SEO y la protección de
  contraseñas filtradas (el chequeo contra HaveIBeenPwned es función de Pro, no
  un interruptor del plan gratis; medido el 08/10, org `sevenseas` en `free`).
  Hasta que se pague, ese aviso del linter de seguridad **no se puede cerrar**.
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
