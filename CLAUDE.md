# Seven Seas Ops — contexto del proyecto

*Este archivo lo lee Claude Code solo, al arrancar cada sesión. Es la fuente de
verdad del proyecto. `HANDOVER.md` y `NEXT-SESSION.md` son históricos y están
desactualizados — no mandan.*

**Última actualización: 2026-10-13.**

---

## Qué es

SaaS de operaciones para centros de buceo y operaciones de charter. Bilingüe
(ES/EN). Web + apps nativas. Cero clientes **pagando**.

> [!important] Pero la app de Android SÍ está publicada, y tiene usuarios
> **Google Play, en producción al 100% desde el 1 de septiembre de 2026**:
> `com.sevenseasops.app`, 16 instalaciones, **13 dispositivos activos por mes**.
> Verificado en la ficha pública el 15/10.
>
> **Esos 13 NO son clientes: son conocidos a los que Fran les pidió que bajaran
> la app para probarla** (dicho por él el 15/10). El número no es tracción y no
> hay que leerlo así. **Lo que sí vale de ellos es que son el único detector de
> fallas de arranque que hay** — Play Vitals da tasa de fallas y de ANR, y el
> cambio de arrancar del binario es justamente el que más puede romper el
> arranque. Que dos o tres la dejen instalada hasta que la actualización esté
> publicada y confirmada.
>
> Claude afirmó el 15/10 que no estaba publicada, después de buscar en el repo y
> en el vault y no encontrar registro. **La ausencia de un registro no es una
> medición** — ver
> `Errores y aprendizajes/La app que sí estaba publicada.md`.
>
> **Lo que esto cambia, y es la parte que importa:** la frase de más abajo sobre
> «las nativas tienen cero usuarios» era falsa. Hay 13 dispositivos activos, y
> **la versión publicada tiene `server.url`, así que hoy no abre sin internet**
> mientras la ficha de Play promete *«Works offline — built for shops with
> unreliable wifi»*. El arreglo del arranque desde el binario no es más barato
> de lo que creíamos: es **más urgente**.
>
> iOS sigue sin publicar: binario 162001 en revisión.

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
| **Memoria del proyecto** | el vault de Obsidian en `~/Desktop/AI Projects/Fran´s Vult` |
| Web app | Render, servicio con URL `dive-app-v2.onrender.com` |
| Landing | **`sevenseasops.com/landing.html`**, y **tecleando el dominio pelado se llega ahí**: la raíz sirve `index.html` pero ese archivo redirige. Ver abajo |
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
`/add-dir "C:\Users\franc\Desktop\AI Projects\Fran´s Vult"`.

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

**El chequeo de la bóveda es un solo comando, y está en Node:**

```bash
cd "/c/Users/franc/Desktop/AI Projects/Fran´s Vult" && node "_scripts/salud-boveda.js"
```

O diciendo «chequeá la bóveda» (skill `seven-seas-salud-boveda`). Mira la bóveda
por dentro —enlaces, huérfanas, tipos, borradores, números contra
`Datos canónicos`— y después **verifica contra el código lo que la bóveda
afirma**: la posición medida de cada interruptor, los dos números del despliegue,
los identificadores o archivos que una nota cita y ya no existen, la ruta de la
bóveda, y que los comandos que una nota manda correr se puedan correr de verdad.
Es la respuesta mecánica al error más caro del proyecto —leer una nota en vez de
medir, cuatro veces—.

**Cuándo: al abrir la primera sesión del día.** Un health check, no una hora
fija. **No se puede programar**: las tareas programadas corren en la nube y no
llegan al disco de Fran, así que una corrida automática devolvería hallazgos
inventados. Si ya se corrió hoy, no se repite.

> [!warning] Estuvo en Python tres semanas y Fran nunca lo pudo correr
> Medido el 17/10 en su máquina: los `python.exe` y `python3.exe` del PATH son
> los stubs del Microsoft Store, de **0 bytes**. **No tiene Python.** El chequeo
> estructural era paso obligatorio desde el 24/09 y lo corría una sola de las dos
> personas, en un sandbox donde sí había. Mismo error que los tests con
> `require('/tmp/node_modules/jsdom')`.
>
> De ahí dos cosas: **un solo runtime, Node**, el que Fran ya usa para la suite;
> y el chequeo ahora **se mide a sí mismo** — si una nota manda correr algo con un
> runtime que no está en esta máquina, es un hallazgo. Ver
> `Operativa/Salud de la bóveda.md` y
> `Errores y aprendizajes/El chequeo que Fran no podía correr.md`.

**Tres skills guardadas encapsulan este flujo** y conviene usarlas en vez de
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

**Pruebas**: `node _tests/run-all.js` — 783 comprobaciones corriendo el
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
`checklist_seeds`, copiadas al activar una categoría por el disparador
`trg_sembrar_checklists`, que llama a `sembrar_checklists_de_categoria()` — el
EXECUTE de esa función está **revocado** para `authenticated`, así que el
cliente no la puede llamar).

**La siembra NUNCA pisa:** si cualquier copia de ese nombre de tipo ya tiene
plantilla, saltea. Medido el 11/10 antes de construir la etapa 4 — es lo que
hace que las ediciones de un centro estén a salvo cuando activa otra categoría.
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

**8 · De 6 para arriba, el cambio va detrás de un interruptor apagado en
producción.** Decidido con Fran el 14/10. Él lo pidió como «trabajar en una
copia y pasarla al proyecto en vivo cuando esté pulida» — el requisito es
correcto y lo que cambió al medirlo fue la forma.

**Por qué no una rama larga:** `index.html` tiene 20.799 líneas en un solo
archivo y **38 de los últimos 54 commits lo tocan** (70%). Una rama de semanas
contra `main` moviéndose en el mismo archivo deja un merge grande que resuelve
Claude, y un merge mal resuelto acá es el modo de falla de siempre: verde en las
728 comprobaciones y mal en algo que nadie afirmó. Peor: **la base es una sola y
las migraciones entran en producción al aplicarse**, así que la copia sería del
código y no de los datos — no cubriría el A1, que es justo el que preocupa.

El patrón ya está en uso y es `FUENTE_PLANTILLAS` (`'cableado' | 'base'`): el
camino nuevo al lado del viejo, migración aditiva, y se prende con una línea.

Lo que acompaña al interruptor, o no sirve:
- **Migración sólo aditiva.** Si el cambio exige soltar, renombrar o restringir
  algo en uso, el interruptor no alcanza: se muestra el SQL y se espera.
- **El camino viejo queda entero**, sin limpiarlo «de paso».
- **El interruptor en UN lugar, y un test lo cuida.**
  `plantillas-tres-capas.test.js` afirma que `FUENTE_PLANTILLAS` aparece
  **exactamente dos veces**. Una tercera y dejó de ser interruptor.
- **Un test con el interruptor en cada posición**, y que afirme que **cambiarlo
  cambia el comportamiento** — la 3a tuvo tres días un interruptor que no
  cambiaba nada, con la suite en verde.
- **El default en producción es el camino viejo.** Prenderlo es decisión de
  Fran, no efecto colateral de un commit.
- **Si el interruptor mueve una LLAVE** (ids posicionales vs uuid), hace falta
  además una respuesta escrita a «¿qué pasa con lo que está abierto cuando se
  prende?». Para algo en curso, estabilidad le gana a frescura.

**Se borra el camino viejo** recién con las tres: una semana prendido en
producción, usado de verdad por Fran, y nadie tocó el interruptor en el medio. Y
es un cambio aparte, con su propio tamaño.

**Nada de esto cambia el flujo de Fran**: una sola rama `main`, un solo servicio
en Render, el mismo comando. El staging en Render y la rama de base de Supabase
(~10 USD/mes) se arman el día que haya un centro pagando — hoy serían diez
dólares por mes para proteger a cero personas. Ver
`Operativa/Construir detrás de un interruptor.md`.

Detalle y la lección —leí mi propia nota en vez de medir el código, cuatro
veces— en `Seven Seas Ops/Plantillas y actas.md`.

**9 · Lo que depende de un tercero y tiene plazo se cierra con una captura.**
Pedido por Fran el 26/10, después de descubrir que el envío a Apple que las
notas daban por hecho desde el 13/10 **nunca se había mandado**: trece días de
cola perdidos, y yo lo había repetido como un hecho en cuatro notas sin haberlo
visto.

Cuando se le pasan a Fran los pasos de algo **con plazo y en manos de un
tercero** —Apple, Google Play, Paddle, DNS, Search Console, un banco, un
organismo—, en el mismo mensaje se le pide la **captura del estado final**.
Hasta verla, en el vault y acá figura como *«según Fran, sin confirmar»*.

Lo que se puede medir solo se mide solo y no se le pide nada: la ficha pública
de Play, el DNS, la URL desplegada, la base. La captura es para lo que vive
detrás de un login que Claude no abre — que es exactamente el mismo límite de la
regla 1.

**La mitad del error fue mía**, y es la parte que la regla corrige: *«Fran lo
hizo» no es una medición hasta que alguien lo ve.*

**Y para esta etapa jsdom no alcanzó:** se midió contra la base real que la FK
`checklist_template_items → checklist_templates` existe (sin ella el `select`
incrustado daría PGRST200), que las 5 columnas del select están, y que RLS
haciéndose pasar por Fran devuelve filas — 9 plantillas y 156 ítems.

> [!warning] Medido el 26/10: la app ABRE sin señal, y adentro no hay nada
> Fran probó desde el binario (TestFlight **203001**): logueado, app cerrada del
> todo, wifi y datos apagados, abrir. **Abre** — eso cierra la mitad del 14/10.
> Lo que mostró fue el calendario sin salidas, la tripulación diciendo *«Aún no
> hay tripulación»* y su propio usuario como un **«?»**.
>
> Una sola causa: `supabase-js` **no lanza**, devuelve `data: null` con el error
> al lado, y **141 lecturas destructuran sólo `data`** (41 miran el error). Así
> que una consulta que no salió y una tabla vacía son **el mismo valor**, y la
> pantalla elige la peor de las dos lecturas. Es el mismo hallazgo del 08/10 del
> lado de los borrados —32 y sólo 4 miraban el error, de ahí `borrarOAvisar()`—
> pero del lado de leer, donde nunca se había hecho la pasada.
>
> **Hecho el 26/10:** `motivoDeFalloAlLeer()` y `textoDeListaVacia()`, aplicadas
> en los estados vacíos que viven bajo una lectura, con
> `_tests/una-lista-vacia-no-miente.test.js` afirmando la regla (no un número) y
> una lista de excepciones donde cada una lleva su motivo escrito. Son
> **síncronas** a propósito: un `await` en un camino de dibujo sería otro viaje a
> la red en el arranque, que es la enfermedad y no la cura. Por eso sólo se
> afirma «sin conexión» cuando `navigator.onLine === false` lo permite; en la
> duda se dice «no se pudo cargar», que es verdad siempre.
>
> `fetchTripsForRange()` devuelve ahora `{ salidas, error }` y no un arreglo
> pelado. **No** se colgó el error como propiedad del arreglo, que no tocaba a
> nadie: `renderWeekView()` hace `.filter(...)` y la marca se habría perdido en
> silencio — la misma clase de bug.
>
> **La pantalla de fallo de arranque tenía una trampa**, y se sacó: su único
> botón era *«Cerrar sesión y reintentar»*, y sin señal eso borra la sesión
> cuando volver a entrar **necesita red**. Ahora la acción principal recarga, y
> cerrar sesión **no se ofrece** cuando se puede afirmar que no hay red.
>
> **Y el C, que haya algo que mostrar: construido el 26/10 y APAGADO.**
> `COPIA_LOCAL` (`'apagado' | 'encendido'`): una lectura que falla muestra la
> última copia buena en vez de una lista vacía. Se cachean **la planilla de
> tripulación** y **las salidas de hoy** (la clave lleva el día, así que una copia
> de ayer no se puede mostrar como la de hoy). La semana y el mes del calendario
> quedan afuera a propósito: el caso del barco es hoy.
>
> **Lo dije en 8 y lo corregí midiendo: es 6.** El patrón NO es nuevo —
> `loadSignerStaff()` lo hace desde el 21/10, encontrado por Fran probando modo
> avión—; lo que se hizo fue sacar esa regla de adentro de una función
> (`leerConCopiaLocal()`) y aplicarla a las otras dos lecturas. Sin migración: es
> `localStorage` y nada más. No toca ninguna llave: las filas de la copia llevan
> los uuid reales del servidor, así que prenderlo o apagarlo a media mañana **no
> le mueve los tildes a nadie**.
>
> **Tres reglas que son consecuencias medidas:** la copia se guarda **aunque el
> interruptor esté apagado** (si no, el día que se prenda no habría ninguna copia
> todavía); **un cero verdadero sí se guarda** pero **el vacío de un fallo nunca**
> —el error que `loadSignerStaff()` tenía debajo hasta el 21/10—; y **la copia se
> dice siempre, con la fecha**, porque una copia sin etiqueta se lee como el dato
> de hoy y eso es peor que una pantalla vacía.
>
> **La copia es para MIRAR, nunca para firmar.** El selector de firmantes sale de
> `tripulacionConocida()`, que tiene su propia copia filtrada por `active`; la
> planilla trae todo, archivados incluidos, y se guarda con **otro nombre** a
> propósito. Si alimentara al selector se podría firmar como alguien que ya no
> trabaja ahí — el agujero que el 09/10 vino a cerrar. Hay un test que lo afirma.
>
> Detalle en `Seven Seas Ops/La copia local de lo que se mira.md`. **Falta
> probarlo en un teléfono**, y hasta eso queda apagado. La ficha de Play promete
> *«Works offline»*, así que la promesa no es cierta hasta que se prenda: **no
> reenviar a Apple antes.**

> [!warning] Todo el offline vale **una vez que la app está abierta**
> Y «abierta» resultó significar **«abierta y con los datos ya cargados en esa
> misma sesión»** — ver el bloque de arriba. Lo que sigue es correcto para la
> carga del HTML, que es de lo que habla.
> Fran probó el 14/10 abrirla con el modo avión puesto y vio una pantalla azul.
> Dos causas distintas, y conviene no mezclarlas.
>
> **La web y la PWA: arreglado.** La raíz del dominio público redirige a
> `/landing.html`, que no estaba en `APP_SHELL`. El arreglo que importa no es
> cachearla —se cacheó igual— sino que **sin red no se redirige**: quien abre el
> dominio sin conexión no es un prospecto que viene de Google, es el centro
> abriendo su herramienta. Sólo se confía en `navigator.onLine === false`; `true`
> en un barco es mentira de rutina.
>
> **La app instalada: `server.url` SACADO el 14/10, sin probar en un celular.**
> Con esa línea, Capacitor cargaba la interfaz del servidor y **no** usaba los
> archivos del binario; sin red no había de dónde cargar. Ya no está, el
> guardián quedó en `'binario'` y la suite en verde — **pero nadie lo abrió en un
> teléfono todavía.** Ningún app instalada cambió: el 162001 ya estaba
> construido y subido.
>
> Y medido: **el service worker no la salva en iOS.** En WKWebView, con
> `server.url`, los SW **no se registran** sin App-Bound Domains, el issue de
> Capacitor se cerró como *not planned*, y la posición de los mantenedores es
> «si querés offline, empaquetá». Hay además un issue abierto donde WKWebView
> **se cuelga para siempre** sin red al arrancar — el segundo síntoma de Fran.
>
> **Lo bueno: los archivos YA están en el binario** (el workflow corre
> `build:www` y `cap sync`). El cambio es **sacar una línea**; lo que cuesta es
> que después cada arreglo del `index.html` necesita un envío nuevo — y hoy eso
> se paga en una moneda que **creí** que sobraba. **Falso, medido el 15/10:** la
> app está en Google Play desde el 1 de septiembre, así que desde el flip cada
> arreglo necesita una release de Play.
>
> **Y después sobrecorregí en la otra dirección**, que conviene no repetir: dije
> que el deslogueo de una vez «le pega a 13 aparatos reales» y lo usé como
> costo. Fran aclaró que los 13 son conocidos que bajaron la app para probarla,
> no clientes — así que ese costo es casi cero otra vez.
>
> **Lo que justifica la urgencia no es cuántos usuarios hay: es que la ficha
> está pública.** Cualquiera que entre a Play hoy y la instale se come la
> pantalla azul, y la ficha le promete textual *«Works offline»*. Eso es verdad
> con 13 usuarios o con cero, y es el argumento que se sostiene solo.
>
> **Dos consecuencias que no se ven**, y la primera ya está arreglada:
> `hayRedDeVerdad()` pingueaba el **propio origen**, que empaquetado lo contesta
> el disco → diría «hay red» en modo avión y una escritura sin señal se
> **descartaría** en vez de encolarse. Ahora pinguea Supabase con
> `mode:'no-cors'` (respuesta opaca: la señal es que **resuelva**, `ok` es
> siempre false). La segunda: cambiar de origen a `capacitor://localhost`
> **desloguea a todos una vez** — gratis hoy, masivo con centros adentro.
>
> **El interruptor es la presencia de `server.url`**, no una bandera en el JS:
> la app no arranca, así que nuestro código nunca corre y no hay dónde ponerla.
> Lo cuida `_tests/arrancar-del-binario.test.js`, donde una constante declara la
> intención y el test falla si la config dice otra cosa.
>
> **Lo que falta es probarlo, y NO hace falta Android Studio**: el workflow
> construye el APK en la nube (*Actions → Mobile app builds → Run workflow* →
> artefacto `seven-seas-android-debug`). `cap sync` **no construye ni instala
> nada**, sólo copia al proyecto — eso confundió una vez. Tres cosas a
> confirmar: que abra en modo avión, que se entere cuando vuelve la red sin
> cerrarla, y que un tilde sin señal **se encole**.
>
> **No entra en un envío antes de eso.** Apple no deja subir una build con la
> versión *In Review*: hay que sacarla, queda *Developer Rejected*, y reenviar
> **arranca la revisión de cero** — y el 162001 lleva la respuesta de 2.1(b).
> Ojo con la distinción: **subir no es enviar.** El workflow tiene un paso
> *Upload to TestFlight* que ya venía dejando builds en App Store Connect con
> cada push, y eso no toca la versión en revisión.
>
> Y **`capacitor.config.json` no estaba en los paths del workflow** aunque el
> comentario del archivo decía que sí: sacar el interruptor no habría construido
> nada. Agregado. Plan completo en
> `Decisiones/La app nativa arranca del binario.md`.
>
> Y la lección de proceso: todas las pruebas de offline se habían hecho con la
> app ya abierta, cortando la señal después. El caso real es el contrario — el
> instructor sube al barco y **ahí** la abre.

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

**Y el acta se dibuja en UN solo lugar, `filaDeActa()`** (11/10). Antes había
dos: la pantalla de la salida mostraba autor y motivo, y **Logged Checklists
armaba sus propias filas** con sólo el ✓/✗ y el texto — así que todo lo del
09/10 nunca llegó a la pantalla donde un dueño mira el historial, que es donde
más vale. Lo reportó Fran probando la etapa 4. Las dos pieles son legítimas (la
del acta de la salida es la checklist entera, la del historial es compacta), así
que la piel es un parámetro y qué se muestra se decide en un lugar. El CSS
también: **un** selector cubre las dos (`.cl-item .cl-autor, .cl-logged-item
.cl-autor`), no la regla duplicada.

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

**El español de los textos es neutro latinoamericano, no rioplatense** —y desde
el 15/10 eso **también vale para la landing**, que se había quedado afuera de la
regla nueve días con `Creá`, `Seguí`, `Cerrá`, `tenés`. Una regla escrita que
vive en un solo lado es media regla.

Y hay una segunda mitad, pedida por Fran el 15/10: **menos modo imperativo**,
no sólo menos voseo. Una lista de funciones **describe**, no manda — «El
manifiesto del día se genera solo», no «Generá el manifiesto». **No se elige
entre `tú` y `vos`**: Centroamérica se parte entre los dos (Costa Rica,
Nicaragua y Guatemala vosean), así que la segunda persona queda sin conjugar —
impersonales, infinitivos, y el posesivo `tu`, que los dos comparten. Los
botones van en infinitivo. Detalle en
`Clientes/Auditoría de la landing.md`.

Lo de siempre (pedido por Fran el 07/10: hay muy pocos centros de buceo acá y los clientes van a
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

**Los dos pendientes de ahí se cerraron el 11/10.**

**Una checklist propia firmada ahora muestra su acta.** No faltaba protección
—el candado y la comprobación ya impedían duplicar— faltaba la vista:
`renderCustomChecklistsForCurrentView` no consultaba `checklist_completions` en
ningún momento. Y **se le agregó Reset en el mismo cambio**, porque mostrar el
acta sin dar salida habría cambiado un hueco por una trampa: quedaría mostrando
el acta para siempre, sin forma de repetir la checklist.

**Reset = una segunda pasada, con dos actas** (decidido por Fran el 11/10).
Antes **no hacía nada**: vaciaba el objeto local y el redibujo lo repoblaba desde
`progressCache`, que `loadChecklistProgress()` devuelve sin consultar. Sobre una
firmada era peor — el redibujo encontraba el acta y la mostraba otra vez.

Ahora `reiniciarPasada()` lo decide en un solo lugar para los tres botones:
confirma (es destructivo, se van los tildes de la tripulación), borra de verdad
(caché + pendientes + servidor, **avisando** si el servidor rechaza — lo
contrario que la limpieza post-firma, que calla a propósito), y si había acta
**abre una pasada** en `pasadasAbiertas`.

**La parte difícil: choca con `firmarUnaSolaVez()`**, que se niega si ya hay
acta. Con la pasada abierta se salta esa negativa — sin la excepción, el
guardián dejaría de proteger y pasaría a **bloquear**, el mismo error que casi
se cometió con las dos actividades. La pasada se cierra **sólo si el acta
entró**: si falló, sigue abierta para reintentar.

Y la llave de instancia del instructor pasó de `` `instructor:${tripId}` `` a
`instructorScope().scopeKey`: era la misma instancia **con otro texto**, y desde
que Reset abre pasadas el guardián y el Reset tienen que mirar el mismo
conjunto. Dos nombres para una instancia es un bug esperando.

**Etapa 4 hecha el 11/10: el centro edita su lista de preparación.** Era lo que
la etapa 2 dejó a medias — las semillas se COPIAN a cada centro precisamente
para que pueda cambiar su copia, y hasta hoy **nada en la app insertaba ni
actualizaba `checklist_template_items`**. Medido antes: 43 plantillas, 711
ítems, **0 retirados** (la columna `active` existía sin que nada la usara).

Está en **Configuración → Tipos de Salida → «Lista de preparación»**, cuarto
botón de la fila, en el patrón de panel que ya existía tres veces. Lo ve
cualquiera; lo edita sólo dueño o encargado (`puedeEditarPlantillas()`, que dice
lo mismo que RLS — las 43 plantillas tienen `created_by = NULL`, así que las
políticas caen en la rama del rol).

Tres reglas que son consecuencias medidas, no preferencias:

- **Retirar es `active = false`, NUNCA un borrado.** El id de un ítem es la
  llave de los tildes (`checklist_progress.item_id`) y de lo que quedó escrito
  en el `items_snapshot` de cada acta. Una fila borrada deja tildes vivos y
  actas firmadas apuntando a nada, y un acta es inmutable: no se arregla después.
  El lado que **lee** no se tocó — ya filtraba `active !== false` desde la 3a.
- **No puede quedar sin ningún ítem activo.** Con cero activos,
  `filasDePlantillaParaTipo()` devuelve vacío, `cargarConTresCapas()` no cachea
  un vacío y cae a la **lista cableada**: el centro vaciaría su lista y en el
  barco se vería OTRA, la genérica de buceo, sin aviso. Se niega el último. Por
  lo mismo «arrancar de cero» crea **un** ítem, no una plantilla vacía.
- **Se edita el idioma de quien mira y el otro no se toca.** El CHECK
  `checklist_template_items_con_texto` exige UNO de los dos, y `itemsDePlantilla()`
  ya cae al otro. Un centro en Tailandia no va a llenar el español nunca.

**Un tipo sin plantilla ofrece «arrancar de la lista estándar»**, que copia
`checklist_seeds` **desde el cliente** (esa tabla sí tiene política de SELECT).
Tapa el hueco medido: un centro puede crear salidas de una categoría que no
activó, y en *Blue water* los 7 tipos de buceo tienen cero ítems por eso.

**A5, hecho el 14/10: y ese hueco ahora se AVISA.** Medido contra la base:
*Blue water* tiene `diving` **sin activar**, 7 tipos de buceo, los 7 sin
plantilla, y **8 salidas ya creadas** con esos tipos — no era hipotético. Lo que
veía el instructor era la **lista cableada genérica**, que es peor que un error
porque parece correcta. La salida de la etapa 4 existía pero **escondida dentro
de un panel que hay que abrir tipo por tipo**, y una salida que hay que descubrir
no es una salida.

Ahora hay un aviso arriba de **Configuración → Tipos de Salida** con el número,
qué pasa en el barco y un botón que las arma todas. Tres decisiones:

- **NO activa la categoría**, aunque sería lo tentable:
  `seedTripTypesForCategory()` **inserta tipos de salida nuevos** además de
  marcar la categoría, así que a un centro con sus propios tipos le duplicaría la
  lista. Se copian las semillas tipo por tipo, por `copiarListaEstandar()` — un
  solo lugar, usado por el botón de uno y por el de todos.
- **Si no se puede medir, no se avisa.** Si la consulta de plantillas falla el
  aviso no se dibuja: «te faltan 7 listas» sin poder medirlo podría ser falso.
- **Sólo lo ve dueño o encargado.** A un capitán sería ruido sobre algo que no
  puede tocar.

**Y aparecieron dos bugs reales de mensajes.** El primero importa más allá de
este módulo: **`motivoDeFalloAlBorrar` se renombró a `…AlEscribir` el 11/10 y sus
cuatro textos siguieron diciendo «borrar»**. 10 de los 11 lugares que la llaman
escriben, así que guardar una plantilla o sellar un service decía «no se borró
nada» / «no tenés permiso para borrar esto». Ahora lleva `operacion`:
`borrarOAvisar()` pasa `'borrar'` y conserva los textos de antes, el resto usa
los `esc_*`. Y **`23503` no significa lo mismo en los dos casos** — al borrar es
«algo cuelga de esto», al guardar es «lo que esto referencia ya no existe».
*Media corrección es una corrección que miente con más confianza.*

El segundo: `crearPlantillaVacia` levantaba su propio modal y devolvía `null`,
así que en bloque habrían sido siete carteles y el motivo real se perdía —
reportaba «no hay lista estándar para copiar» cuando el problema era un permiso.
Ahora devuelve `{id}` o `{motivo}` y **quien llama decide si avisar**.

Detalle en `Seven Seas Ops/Las listas de preparación que faltan.md`.

**El acta se lleva el nombre de la checklist** (15/10). Lo trajo una prueba de
uso: Fran firmó una propia llamada «Mediodía», la borró, y el acta quedó titulada
«Revisión de seguridad de la embarcación» — **un texto de relleno del
diccionario** (`cl_logged_vessel_check`) que las tres vistas de actas usaban de
título cuando el acta no tenía salida, o sea en casi todo el historial que no
venga de una excursión. Ese texto ya no existe.

`checklist_completions.checklist_name`, aditiva y nulable, escrita por
`nombreDeChecklistParaActa()` **dentro de `buildRecordPayload()`**. Y la regla
que vale para cualquier columna que se le quiera agregar a un acta de acá en
adelante: **si el dato se deriva, no se guarda; si lo escribió una persona y
puede borrarlo, se guarda.** Congelar algo derivable hace que un cambio de
traducción reescriba el pasado —el cambio de «Mañana» a «Inicio del día» de ese
mismo día dejaría las actas viejas con el nombre viejo—; no guardar lo que una
persona escribió hace que un borrado lo reescriba. Por eso se escribe **sólo para
las propias**: una rutina de departamento se nombra desde `role`, que el acta ya
guarda. NULL = no se sabe, y **no se rellena hacia atrás**.

**El título de un acta lo decide `tituloDeActa()`**, en orden de confianza:
salida → nombre guardado → nombre derivado del rol → genérico. Y
`rolDeActaSiAporta()` decide si la segunda línea agrega algo o repite el título.
Las tres vistas lo armaban cada una por su cuenta y usaban **`crewRoleLabel`**, no
`checklistRoleLabel` — el arreglo del uuid del 14/10 estaba hecho **en la función**
y esos tres lugares nunca la llamaron. *Al arreglar una función compartida, la
pregunta siguiente es quién la llama.* Tercera vez que esa pregunta paga.

**Y las columnas del acta se declaran una vez cada una** (`COLUMNAS_DE_ACTA`,
`COLUMNAS_DE_ACTA_LISTADO`). Estaban escritas a mano tres veces, y el defecto
apareció donde la copia faltaba: **`items_source` no estaba en ninguna de las
tres**, así que el aviso de «se firmó contra la lista genérica» del 14/10 **nunca
se mostró en pantalla** — la función estaba bien, el dato no llegaba. Una pantalla
sin el dato no da error: calla, y eso se lee igual que «no hay nada que avisar».
Detalle en `Errores y aprendizajes/El nombre que el acta no se llevó.md`.

**Las checklists se pliegan todas, y nacen plegadas** — propias desde el 14/10 y
**de departamento desde el 15/10**, que era lo que quedaba abierto por defecto:
Fran entraba a Checklists, le aparecía la rutina de la mañana entera desplegada,
y para llegar a las propias o a la de noche tenía que pasar por arriba.
`checklistsAbiertas` es **un** registro para las dos (clave: el uuid de una
propia, `dept:<role>` para una rutina) porque son la misma regla; dos copias
serían dos lugares donde puede estar mal. El estado se aplica **en el render**, no
sólo en el toggle: cambiar de pestaña redibuja, y sin eso la rutina nueva
heredaría el estado de la anterior.

**Y el acta ahora registra de dónde salió la lista** (14/10, pedido por Fran al
no cerrarle el hueco que quedaba abierto). Era la mitad que faltaba: el A5 avisa
al centro, pero las actas ya firmadas contra la lista cableada **no decían contra
qué lista se firmó**. El registro afirmaba algo más fuerte de lo que pasó — que
la salida se preparó según la checklist del centro.

`checklist_completions.items_source`, aditiva y nulable, con CHECK:
`template` | `hardwired` | **NULL = no se sabe**. Las 11 actas existentes
quedaron en NULL y **no se rellenan hacia atrás**: misma decisión que el backfill
de los 5 waivers del 23/09, inventar la procedencia de un registro inmutable es
justo lo que esto viene a evitar.

Lo decide `fuenteDeLaLista(role, tripId)` **dentro** de `buildRecordPayload()`,
no en los tres que firman — es el dato que uno de los tres se olvidaría de pasar.
`instructor` mira el centinela de `instructorItemsByTrip`; `custom_*` es del
centro por definición; cualquier otro rol (las rutinas de departamento) es
`hardwired`, porque `scope='department'` tiene **cero** plantillas y hasta que el
A1 se construya eso es la verdad.

**En pantalla sólo se dice cuando NO era la del centro** —`lineaDeFuenteDeLista()`,
un lugar, usado por la pantalla de la salida y por Logged Checklists— con el
camino para arreglarlo. Si era la propia no se dice (sería ruido en todas las
actas) y si es NULL tampoco. **Ojo: la ausencia de esa línea NO es una garantía**,
significa «o era la del centro, o el acta es anterior al 14/10», y está escrito al
lado de la función.

**Y me corregí a mí mismo:** había agregado `items_template_id` y al ir a
escribirla medí que `filasDePlantillaParaTipo()` **tira** el id — llevarlo al acta
obligaba a cambiar qué guarda la caché de tres capas, la que tiene la regla de
estabilidad de llaves. **La saqué** en vez de dejar una columna que nadie
escribe, que es el error de `acta_guarda_la_actividad` repetido; ahí ya no se
podía sacar, acá sí. El `items_snapshot` da la trazabilidad que importa.

Probado contra la base sobre una fila real: el **trigger de inmutabilidad dispara
antes que el CHECK**, así que ni un valor inválido llega a evaluarse. Detalle en
`Seven Seas Ops/El acta de una checklist.md`.

**Al guardar se tira la copia local** (`cacheLocalBorrar()`, que faltaba), y el
nombre de la caché pasó a `nombreEnCacheDePlantilla()` porque ahora hay dos
lados que lo necesitan. **`instructorItemsByTrip` NO se invalida**: una salida
abierta conserva su lista, porque si la tripulación está tildando y el dueño
edita desde la oficina, cambiarle la lista debajo le movería la llave.

**`motivoDeFalloAlBorrar` se renombró a `motivoDeFalloAlEscribir`.** El nombre
decía «borrar» y la lógica nunca fue de borrar: es de cualquier escritura
rechazada. Lo destapó medir RLS — un rol por debajo de encargado recibe **42501**
al tocar un ítem de plantilla (RLS *lanza*, no devuelve 0 filas), y el cartel
genérico del editor le decía «revisá la conexión», el motivo equivocado.

**Y me corregí el tamaño para abajo: 5/10, no el 7 que había anotado en la
auditoría sin medir.** Lo que lo baja: el lado que lee no se toca, sin
migración, RLS ya estaba, el patrón ya existía, y no toca la identidad de nada
—precisamente porque retira en vez de borrar. Detalle en
`Seven Seas Ops/El centro edita su lista de preparación.md`.

**En Tipos de Salida hay UN solo panel abierto a la vez**, y lo decide
`abrirSoloEstePanel()`. Los cuatro botones tenían cada uno su propia lógica de
abrir y cerrar, así que ninguno sabía de los otros: con dos paneles apenas se
notaba y el cuarto lo hizo evidente — Fran abría «formularios requeridos» y
después «lista de preparación» y quedaban los dos, con la pantalla larguísima en
el celular. **Se cierran por CLASE (`.tt-panel`), no por una lista de ids**: una
lista de cuatro ids es cuatro lugares donde puede faltar una entrada y el quinto
panel se olvidaría en silencio, el mismo error que la enumeración de extensiones
en `.gitattributes`. Cierra en toda la lista y no sólo en la tarjeta. De paso
`toggleRentalFees` ganó el guardián de nulo que era el único de los cuatro en no
tener.

**Auditoría completa del módulo (11/10)** —qué protege los registros legales,
qué está probado y qué sólo lo da el uso, y los tres huecos que quedan— en
`Seven Seas Ops/Auditoría del sistema de checklists.md`. Dos cosas de ahí que
conviene saber antes de tocar esto:

- **El acta es inmutable en DOS capas independientes**: RLS no tiene política de
  UPDATE ni DELETE (0 filas alcanzables) y el trigger
  `trg_checklist_record_immutable` frena incluso saltando RLS. Las dos probadas.
- **Toda prueba de «esto está bloqueado» tiene que afirmar que alcanzó una
  fila.** La primera versión de esa prueba dijo «se pudo modificar un acta» y
  era falso: `where id = NULL` no toca ninguna fila, el trigger por fila no
  dispara, y «no hubo excepción» se lee igual que «se pudo». Tercera vez esta
  semana con la misma forma.

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

**Y desde el 13/10 un solo lugar nombra la tabla: `consultaDeSalidas(cols)`.**
De ahí salen las cuatro —el helper de vigentes, su espejo `tripsArchivadas()`,
`openTrip()` y el export—. El guardián del test pasó de exigir **tres** consultas
crudas a exigir **UNA**: contar tres era contar «las que yo conozco», y la
tarjeta de archivadas habría sido la cuarta pasando con sólo subirle el número.
`tripsVigentes` y `tripsArchivadas` están una al lado de la otra a propósito —
si mañana «archivada» deja de ser `archived_at not null`, las dos caras del
filtro se cambian de una sola lectura.

**Un centro ve lo que archivó: tarjeta `rep-archived-card` en Reportes** (13/10,
cierra el paso 1c de archivar). La app le promete al dueño que archivar conserva
y no había dónde comprobarlo — una promesa verdadera que no se puede comprobar
se lee igual que una falsa. Quedó en Reportes, que ya es sólo del dueño, y **no**
como filtro del calendario: el calendario es la herramienta del día y meterle lo
quitado vuelve a mezclar lo que archivar separó.

Tres cosas de ahí:
- **El rango filtra por `trip_date`, no por `archived_at`.** Con `archived_at`
  contestaría «qué quité esta semana»; la pregunta real es «el martes 7 no está,
  qué pasó». Así el rango significa lo mismo que en las otras seis tarjetas.
  Cuándo se archivó va igual, en la fila.
- **`archived_by` no tiene FK a `staff`**, así que no se incrusta: se resuelve con
  `nombreDeTripulante()`, la misma función que la autoría de un tilde, y hereda su
  criterio — si el nombre no resuelve se dice sólo la fecha, nunca un «desde la
  cuenta de» colgando. Sin `archived_at` no se dibuja la línea.
- **Es sólo lectura: no hay desarchivar.** Devolver una salida al calendario tiene
  consecuencias sin decidir (choques de barco, reservas que reviven).

Detalle en `Seven Seas Ops/Un centro ve lo que archivó.md`.

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

**En la app de una tienda NO se muestra nada que parezca una compra**, y lo
decide `puedeMostrarPrecios()` — llamada por lo que decide y no por dónde
estamos. Apple rebotó la build 136001 el 08/10 por **2.1(b), Information
Needed**, pidiendo el modelo de negocio, y al medir apareció por qué: el corte
de nativo estaba en **dos** lugares (checkout y portal, desde el 30/09) y se le
había escapado el **tercero**, el peor. `enforceSubscriptionGate()` levantaba un
modal **no cerrable** con las tarjetas de los tres planes **y sus precios**,
dentro de la app de iOS. Un paywall con precios, sin IAP, señalando una compra
en la web.

Qué quedó, en iOS y Android: el bloqueo **no muestra un solo precio** (la grilla
se **vacía** en `renderPlanCards()`, no se esconde — «no está a la vista» es más
débil y más difícil de probar que «no está», y el corte va ahí porque
`backToPlanPicker()` también dibuja y la llaman tres lugares); la **tarjeta de
facturación no aparece** (ya era de dueño, y gestionar el plan era sólo web); y
el motivo se dice **sin «elegí un plan»**, que ahí no existe.

**Pero sigue bloqueando en las dos plataformas**: cambió *qué* se muestra, no
*cuándo*. Si en nativo no bloqueara, la app de iOS sería el producto gratis.
`past_due` sigue sin bloquear, acompañando los reintentos de Paddle.

**Y había TRES puertas más al modal, que el primer arreglo no cerró.**
Preguntando quién llama a `openChoosePlanModal()` aparecieron: el enlace «ver
los planes» del aviso de tope de barcos, el del que frena al crear uno, y el
**banner de trial** con «elegí un plan» **dentro del texto traducido**. La cola
de esos avisos la decide ahora `colaDeAvisoDePlan()`, y el banner tiene claves
`_native` porque desde el código no se podía quitar un enlace que venía en la
traducción. **El aviso se queda** —un centro tiene que saber que llegó al tope—
y lo que cambia es la salida. Apagar la pantalla no apaga las puertas: la
pregunta «¿quién llama a esto?» es la misma que destapó la 3b.

Por qué cobramos por fuera: Apple se queda con **15–30%** contra **~5%** de
Paddle, y el IAP **no encaja** — la suscripción es del **centro** y la usan seis
personas en tres plataformas, no de un Apple ID. Es el caso de **Enterprise
Services, 3.1.3(c)**. La respuesta a las cinco preguntas está en
`_apple/respuesta-2.1b-2026-10-11.md`.

> [!important] Un arreglo del `index.html` NO necesita binario nuevo
> `capacitor.config.json` tiene `server.url = https://dive-app-v2.onrender.com`,
> así que **la app nativa carga su interfaz del servidor**. Cualquier cambio del
> `index.html` llega al iPhone del revisor en cuanto Render despliega, con el
> binario que ya está en App Store Connect. **El que está en revisión es
> `162001`, versión 1.0** — medido por Fran en App Store Connect el 14/10. Acá
> decía `161001`, que era de un envío anterior y quedó sin actualizar.
>
> **Y esto deja de ser cierto en cuanto la app arranque del binario**, que es el
> cambio del 14/10: desde ahí el binario **es** la app, y la build que se envía
> es exactamente lo que recibe el usuario.
>
> Primero dije «hay que enviar la build 2026-10-11f» — **mal**. `2026-10-11f` es
> el build **web**; el único número que App Store Connect conoce es el del
> binario. El binario se vuelve a subir sólo si cambia el envoltorio nativo
> (`capacitor.config.json`, plugins, íconos, permisos), no por tocar la app.
>
> Lo que sí hay que confirmar antes de contestarle a Apple: abrir
> `https://www.sevenseasops.com/index.html` y que la consola diga el build
> esperado.

**La cuenta de revisión es `demo@sevenseasops.com`, dueña del org
`Blue water`** (`044849ea…`), medida el 11/10 en **`active` / `growth`**. El
cartel de «suscripción vencida» que vio Fran NO era ésa: era su propia cuenta,
`francoroca70@gmail.com`, dueña de `the seven seas dive shop` (`81944871…`), que
quedó en **`canceled`** desde la prueba de cobro real del 30/09. Es correcto que
esté así.

**Y aun así Fran entra sin portón, porque su org tiene `comped = true`** —
verificado en producción el 22/10: estado `canceled`, `comped` en true, bloqueo
no levantado. `esCuentaInterna()` se pregunta **antes que todo lo demás** en
`enforceSubscriptionGate()`.

Por qué es una columna aparte y no un `subscription_status = 'active'` a mano:
**el webhook de Paddle escribe esa columna y lo hace sin guardia de orden**, así
que un evento viejo que llegara tarde le devolvería `canceled` y el paywall
reaparecería, con suerte en medio de una demo. El webhook no toca `comped`
nunca. Y es honesta en los datos: esa org no paga y es a propósito; poner
`active` afirmaría una suscripción que no existe.

**Para probar en la app conviene usar la cuenta de Fran, no la demo.** `Blue
water` es la que mira el revisor de Apple, así que escribir ahí le cambia los
datos al revisor. Y hay una razón más fuerte que la prudencia: el 22/10 los tres
bugs de mensajes aparecieron **sólo** porque las dos cuentas tienen datos
distintos — Blue water tiene 7 tipos de salida sin lista de preparación y la de
Fran tiene **1**, y el plural se rompe con 1. **Probar siempre en la misma cuenta
es probar siempre el mismo camino.**

**Y la demo NO cuelga de una suscripción viva — medido en Paddle el 11/10.**
Primero dije que sí y que podía morirse a mitad de la revisión: lo **deduje** de
que la columna `paddle_subscription_id` estaba cargada, sin mirar el otro lado.
Falso. En la cuenta de producción existen dos clientes —
`ctm_01m3s2v8ag…` (francoroca70, 1 suscripción **Canceled** con reembolso total)
y `ctm_01m3s2jxnn…` (demo, **ninguna** suscripción) — y los ids de `Blue water`
(`ctm_01m231kxzn…` / `sub_01m234hzc…`) **no están ahí**: son del sandbox, de
otra generación de ids.

Así que la demo es **estable**, porque no hay nada de producción detrás que se
pueda cancelar y el webhook nunca va a recibir un evento para esa suscripción.
Estable porque nadie la mira, pero para una cuenta de revisión alcanza.

Lo único roto, y no afecta a Apple: «Gestionar facturación» desde la **web** con
la demo falla (el portal necesita un cliente real, devuelve 400). En nativo esa
tarjeta ya no aparece. **No perseguirlo como bug nuevo.**

Cuando la cuenta de revisión tenga una suscripción real, sí hay que mirar antes
de cada envío que **no tenga un cambio agendado**: cancelar «al final del
período» en Paddle NO cambia el estado —queda `active` hasta la fecha de
factura— y la app no lee el cambio agendado. **Y se busca por el
`paddle_customer_id` de la base, no por el mail**, que es lo que hizo aparecer
un cliente que no era el de la org. Detalle en
`Operativa/Trámites en curso.md`.

Detalle y lo que no pude verificar, en
`Decisiones/Nada que parezca una compra en la app de una tienda.md`.

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
- ✅ **La app registra el cambio agendado — hecho el 14/10 (A3).** Antes un
  centro que cancelaba con 20 días por delante no veía nada, porque cancelar «al
  final del período» en Paddle **no cambia el estado**: queda `active` hasta la
  fecha de factura, y la app sólo leía `subscription_status`.

  Migración aditiva `la_app_registra_el_cambio_agendado`:
  `organizations.scheduled_change_action` (cancel/pause/resume, con CHECK),
  `scheduled_change_at` y `subscription_updated_at`.

  **Dos cosas que, mal hechas, lo convierten en una mentira**, y las dos están
  en el webhook:
  - **`scheduled_change` llega como objeto O COMO NULL.** Null es «se dio de
    baja el cambio agendado» —en Paddle el único valor que se le puede poner es
    null, justamente para quitarlo—. Así que el webhook **limpia** además de
    setear: tratarlo como «si viene, guardo» dejaría a quien canceló y se
    arrepintió viendo para siempre que su suscripción termina.
  - **Paddle NO garantiza el orden de entrega**, y lo dice en su documentación.
    Sin mirar `occurred_at`, un `subscription.updated` viejo que llega tarde
    resucitaría un cambio ya quitado. Se guarda el `occurred_at` aplicado y un
    evento más viejo no pisa esas columnas.

  La frase se arma en **un solo lugar** (`textoDeCambioAgendado`) y la usan los
  dos que la muestran: el banner y la tarjeta de facturación. **El banner SÍ se
  ve en nativo** —a diferencia de la tarjeta, que ahí no existe— porque es
  informativo: dice un hecho con una fecha, sin precio y sin enlace a una
  compra. El dueño que canceló desde la web tiene que poder verlo del celular.

  Y el estado de la suscripción se guarda en un solo lugar
  (`recordarEstadoDeSuscripcion`): eran tres `window.currentOrg…` a mano en los
  dos caminos que cargan una organización, y sumar el cambio agendado habrían
  sido cinco × dos.

  **Falta desplegar la edge function** — el archivo está en el repo y el deploy
  no lo hace Claude: es el camino del cobro. Hasta que se despliegue, las tres
  columnas quedan en NULL y la app no muestra nada, que es el comportamiento de
  antes. Detalle en `Seven Seas Ops/El cambio agendado de suscripción.md`.

  **Hallazgo aparte, sin tocar:** el webhook escribe `subscription_status` —que
  es lo que habilita el acceso— **sin guardia de orden**. Un evento viejo que
  llegue tarde podría devolver un org de `canceled` a `active` o al revés. Con
  un cliente y eventos secuenciales nunca se vio. Arreglarlo cambia *cuándo* se
  aplica una escritura del portón de acceso, así que es un cambio aparte y de
  los que se preguntan primero.

### Después de eso

- ✅ **`app.sevenseasops.com` y Blue Drift: borrados el 13/10.** Queda **un solo
  servicio en Render, `dive-app-v2`**, con un solo dominio,
  `www.sevenseasops.com`. El código del prototipo sigue en GitHub
  (`francoroca70-ux/dive-app`). No se movió la app a `app.` porque Paddle
  aprueba *dominios* y el checkout se habría roto en esa URL.

  **Dos datos operativos que costaron media hora y conviene no reaprender:**
  en Render, **un servicio sin proyecto asignado NO aparece en la lista de
  Projects** (`Ctrl+K` + nombre es la forma confiable, y el contador de Billing
  es donde el sistema dice la verdad); y **cuando un subdominio sirve lo que no
  debe, el DNS es el último lugar donde mirar** — Render rutea por hostname, así
  que `app` y `www` apuntaban los dos al servicio correcto y el problema era qué
  servicio tenía cargado ese hostname.

> [!important] La raíz YA manda a la landing, y el ruteo está resuelto por
> hostname — no hay nada pendiente acá
> **Medí esto mal dos veces el 13/10 y conviene que quede el porqué.** Primero
> escribí que la raíz servía la landing (falso: sirve `index.html`). Después lo
> «corregí» a que **un prospecto cae en un formulario de contraseña** — también
> falso, y peor, porque sonaba a medición.
>
> El error: medí con **WebFetch, que no corre JavaScript**. El archivo que el
> servidor devuelve en `/` es `index.html`, sí, pero su `<head>` tiene un
> redirect que manda a `/landing.html`. **Medido en un navegador de verdad el
> 13/10: tecleando `sevenseasops.com` se llega a la landing.** Lo que WebFetch
> ve es el archivo; lo que ve una persona es el resultado de correrlo. *Ir y ver
> con la herramienta equivocada no es ir y ver.*
>
> **El redirect está keyeado por HOSTNAME, no por Capacitor**, y por eso no hay
> conflicto con Apple: `PUBLIC_HOSTS` es sólo `sevenseasops.com` y
> `www.sevenseasops.com`, y la app nativa carga `dive-app-v2.onrender.com`, que
> **no está en la lista** — nunca redirige. No depende de que `window.Capacitor`
> esté inyectado tan temprano, que no está garantizado.
>
> Y respeta cuatro casos que son los que lo hacen no-trivial: `/index.html`
> pedido por nombre (así entran los «Log in» de la landing), los deep links con
> `?waiver=` / `?invite=`, los de recuperación de contraseña —que traen el token
> en el **hash**, no en la query— y **la sesión guardada**: si hay un
> `-auth-token` en `localStorage` es personal del centro abriendo su
> herramienta, no un prospecto, y se queda en la app. `localStorage` bloqueado
> (modo privado, webview) cae a mostrar la app.
>
> **Consecuencia práctica: no hay que mover la landing a la raíz ni tocar
> `capacitor.config.json`.** El «orden obligado» que yo había escrito —Apple →
> Capacitor a `/index.html` → landing a la raíz— **no hace falta**, salía del
> diagnóstico equivocado.
- **iOS: NO hay nada en revisión** (al 26/10, con captura). El tercer envío del
  binario **162001** se mandó ese día y **Fran lo retiró el mismo día**: la
  versión 1.0 figura como *Eliminado*. Los dos envíos anteriores habían vuelto
  rechazados: 23/09 por metadatos (guía 2.3.3, las capturas de 13" sólo mostraban
  el login) y 8/10 por el modelo de negocio (2.1(b)). El procedimiento de
  capturas está en `Operativa/Capturas para el App Store.md` del vault.

  > [!warning] Dos cosas del 26/10 que conviene no reaprender
  > **Una:** acá decía «en revisión desde el 13/10» y era falso — el envío se
  > había preparado el 13 y nunca se mandó. Trece días de cola perdidos, y **yo
  > lo repetí como un hecho en cuatro notas sin haberlo visto nunca**. De ahí la
  > regla 9.
  >
  > **Dos:** el 162001 es **anterior al arreglo del 14/10**, así que si Apple lo
  > aprobaba salía a la tienda un iOS que no abre sin señal. Por eso se retiró.
  >
  > **El orden para reenviar, y el orden importa:** primero el push, después
  > esperar el build nuevo en TestFlight, después **probarlo en modo avión en un
  > iPhone de verdad**, y recién ahí adjuntarlo y enviar. Retirar antes de tener
  > el reemplazo probado es lo que quema la cola dos veces.
  >
  > **Medido el 26/10, y no hay nada nuevo de Apple.** La ficha del envío
  > retirado muestra «2.1.0 Performance: App Completeness», que **no es un
  > rechazo nuevo**: `2.1(b) Information Needed` es un sub-ítem de la guía
  > **2.1, que se llama App Completeness**, así que App Store Connect está
  > arrastrando la categoría del rechazo del 8/10. De los tres mensajes, dos son
  > de Apple (23/09 y 8/10) y **el tercero es de Fran**.
  >
  > Y ese tercero fecha lo del 13/10 con prueba documental: la respuesta de Fran
  > a Apple es del **13/10 8:45** y la fecha de envío de la ficha es del
  > **26/10 17:58**. Escribió la respuesta ese día y el envío nunca salió — no
  > es una reconstrucción, está en la pantalla.
> [!warning] Los dos `google*.html` de la raíz del repo NO se borran
> `google6c351a16b170880f.html` sostiene la verificación de Search Console
> (propiedad `https://www.sevenseasops.com/`, verificada el 14/10) y
> `google38afbbbeee2c0da9.html` es de un intento anterior con otra cuenta.
> Parecen basura —un `.html` de una línea cada uno— y si desaparecen del
> servidor **Google desverifica la propiedad** y se pierden los datos.
>
> **Y el dominio no está indexado** (medido el 13/10: buscar «Seven Seas Ops» da
> cero resultados). El SEO on-page está completo y en vivo; faltan mandar el
> sitemap y pedir la indexación, que son pantallas de Search Console. Pasos y las
> dos trampas de la verificación, en
> `Operativa/Que nos encuentren buscando Seven Seas Ops.md`.

- Casilla de correo para reemplazar el domicilio particular publicado en la
  ficha europea del App Store
- Contactar los 10 centros de la investigación — **no depende de nada**
- Supabase Pro — destraba **dos** cosas: las páginas SEO y la protección de
  contraseñas filtradas (el chequeo contra HaveIBeenPwned es función de Pro, no
  un interruptor del plan gratis; medido el 08/10, org `sevenseas` en `free`).
  Hasta que se pague, ese aviso del linter de seguridad **no se puede cerrar**.
- ✅ **Service con sello inalterable — hecho el 14/10 (A4).** Medido antes:
  `maintenance_logs` tenía 4 filas, **0 triggers** y una sola política
  (`ALL:org_isolation`), así que cualquiera del centro podía editar o borrar un
  service — y un sello sobre algo editable no vale nada.

  **Un service NO es un waiver**, y de ahí el diseño: un waiver nace firmado e
  inmutable, un service es un registro de trabajo que alguien corrige mientras lo
  escribe. Dos estados: `sealed_at IS NULL` = **borrador** editable;
  con valor = **sellado**, y no se modifica ni se borra nunca.

  Cuatro decisiones, las tres primeras heredadas del certificado de los waivers:
  el hash se calcula **una vez al sellar y nunca se recalcula** (la diferencia
  entre el guardado y el recalculado ES la prueba); lo calcula **Postgres**, que
  sobrescribe `sealed_at` con `now()` y el autor con `auth.uid()` — el navegador
  manda una sola clave y su valor se ignora; **`next_due_date` queda AFUERA**
  porque cambia por diseño, igual que la habilitación médica en los waivers; y el
  payload lleva **prefijo de versión `v1`** para que un cambio de criterio no
  invalide retroactivamente lo ya sellado.

  **Una sola capa, no dos.** El acta tiene RLS sin UPDATE/DELETE **más** trigger;
  acá sólo trigger, porque la misma tabla tiene que seguir editable mientras es
  borrador y **sellar es en sí mismo un UPDATE**. Si alguien ablanda
  `trg_stamp_maintenance_log`, no queda nada detrás.

  **Probado contra la base real**, no en jsdom: 9 comprobaciones en una
  transacción revertida (sellar calcula el hash, la fecha la pone Postgres aunque
  se mande otra, modificar y borrar se rechazan, el hash no se mueve).

  **Y las dos vistas de mantenimiento eran la misma fila copiada**, con los tres
  síntomas: la de equipo **entera sin traducir**, **ninguna** escapaba
  `title`/`description`/`parts_used`/`performed_by` —crudos al innerHTML— y el
  sello habría ido dos veces. Ahora hay una `filaDeService(l, {conBarco})`.
  Buscando ese agujero apareció un **tercer** lugar con el mismo defecto, la
  lista de tareas (`renderTaskLists`), arreglado en el mismo cambio.

  Detalle en `Seven Seas Ops/El sello de un service.md`. **Queda abierto**:
  nadie exporta todavía un service sellado a papel, que es lo que un seguro
  pediría de verdad.

---

## Riesgo legal: la base está en Brasil

Medido el 21/10/2026. **Es el único riesgo regulatorio que existe hoy con cero
clientes**, y no sale de a quién le vendemos: sale de dónde están los datos.

La **LGPD brasileña** se activa por **tres disparadores independientes** y basta
uno. El primero es **«tratamiento realizado en territorio nacional»** — y la base
de Supabase está en **São Paulo**. No hay umbral de tamaño ni de facturación, y
**el domicilio de la empresa es irrelevante**, así que «somos uno solo y sin
clientes brasileños» no es defensa.

**Si alojar ahí basta para activarla no tiene respuesta clara en ninguna
dirección** — no se encontró fuente que lo resuelva. Es la primera pregunta para
un abogado.

**Mitigarlo es barato si molesta:** Supabase permite elegir región, así que mover
la base es configuración, no reescritura. **Pero no se mueve sin preguntar:**
São Paulo es la mejor latencia para los diez mercados objetivo, y cambiarla por un
riesgo no medido sería pagar en rendimiento por una hipótesis.

**Dos correcciones del mismo relevamiento, las dos a afirmaciones mías:**
- **Bonaire y Curazao NO están bajo el RGPD.** Son territorios de ultramar, fuera
  del acervo comunitario, con su propia ley y sin registro ni delegado.
- **Paddle no es subencargado: es un responsable separado** (merchant of record).
  No va en la lista de subencargados, los datos de tarjeta nunca pasan por la app,
  **pero la política de privacidad tiene que decir que el pago lo procesa Paddle
  como responsable independiente.**

**Y una restricción de diseño que sale de ahí:** por C-184/20 del TJUE, un dato
que revela una categoría especial **indirectamente** es dato del art. 9. «Firmó»
no revela nada; un campo **«habilitado / no habilitado / requiere firma médica»**
probablemente sí. **Un semáforo de aptitud médica es justo el diseño que cruza esa
línea** — si alguna vez se piensa agregar uno, la pregunta va antes de
construirlo. (Y el DPA de Supabase prohíbe mandar información de salud bajo HIPAA
sin un BAA aparte.)

Detalle, fuentes y los catorce puntos sin verificar, en
`Operativa/Protección de datos y DPA.md`.

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
