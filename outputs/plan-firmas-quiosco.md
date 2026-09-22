# Plan: firmas digitales al estándar de la industria

*22 sep 2026. Basado en cómo lo resolvió Smartwaiver, adaptado a Seven Seas.*

---

## El cambio conceptual

Hoy hay tres caminos para firmar y **uno de ellos permite que el staff firme
por el huésped** — el pad de firma vive dentro de la sesión normal del staff,
con toda la app detrás.

Smartwaiver también deja firmar en el local. La diferencia es que en su modelo
el dispositivo **no permite otra cosa**: es una app de quiosco bloqueada donde
el único acto posible es firmar. El staff nunca tiene el pad a mano dentro de
su propia sesión.

Ese es el cambio: **el huésped siempre firma, en su teléfono o en una tablet
bloqueada. El staff nunca captura una firma.**

Lo que el staff sigue haciendo: registrar que existe un formulario en papel, y
registrar la habilitación médica. Ninguna de las dos es una firma.

---

## 1. Qué hay que BORRAR

### 1.1 El pad de firma dentro de la sesión del staff
El bloque `sig-signature-block` del modal (`index.html`, ~línea 1812) captura
firmas de huéspedes desde la cuenta del staff. Se elimina el canvas y el modo
"firma digital"; **el modal queda solo para "registrado en papel"**.

Concretamente se van: `sig-canvas-wrap`, `signature-canvas`,
`sig-guardian-canvas-wrap`, `guardian-signature-canvas`, `makeSignaturePad()`
para esos dos, `clearSignatureCanvas()`, `clearGuardianSignatureCanvas()`, y la
fila de método `sig-method-row` (ya no hay dos opciones que elegir).

**No borrar todavía**: hacerlo antes de que exista el quiosco deja al shop sin
forma de atender al huésped que llegó sin firmar y sin teléfono. Va en la
fase 2, después de que el quiosco funcione.

### 1.2 El aviso "mejor que firme en su teléfono"
`wv_prefer_remote`, agregado el 22/09. Deja de tener sentido cuando el staff ya
no puede capturar firmas: no hay decisión que empujar. Se borra junto con 1.1.

### 1.3 La redacción de procedencia que sobreafirma
`waiverProvenanceLine()` dice hoy *"firmado por el huésped en su propio
dispositivo"* cuando `signed_via = 'remote'`. **Eso puede ser falso**: si el
huésped abre su link en la tablet del local, el registro igual dice `remote`.

El token no prueba de quién es el aparato, prueba que **esa persona tuvo acceso
al mail de la reserva**. Reescribir a "Firmado desde el link de la reserva" más
IP y dispositivo como dato, sin afirmar de quién era. **Esto se corrige ya, no
espera a ninguna fase.**

---

## 2. Qué hay que CONSTRUIR

### Fase 1 — Modo quiosco (lo que resuelve el 80%)

**1.1 Auto-cierre después de firmar.**
Hoy, terminada la firma, queda abierta la pantalla de la reserva: el próximo
que agarre la tablet ve los nombres del grupo anterior. Debe limpiarse sola y
mostrar una pantalla neutra de "listo".

**1.2 Pantalla de entrega.**
Después del auto-cierre: "Gracias — devolvé la tablet al mostrador". Sin datos
de nadie.

**1.3 Entrada al quiosco desde la app del staff.**
Botón "Abrir en modo quiosco" junto al QR que ya existe. Abre el link del token
en pantalla completa y marca la sesión como quiosco.

**1.4 Sin salida hacia la app.**
En modo quiosco no hay navegación, ni link de login, ni volver. La única salida
es cerrar el navegador. (El lockdown físico —carcasa con llave— es
responsabilidad del shop, igual que en Smartwaiver.)

### Fase 2 — Retirar la captura de firmas del staff
Ejecutar el punto 1 completo. El modal del staff queda con papel y médico.

### Fase 3 — Certificado de autenticidad
Es lo que un shop le muestra al seguro, y es barato.

**3.1** Columna `waivers.document_id`: ID corto y legible, único por formulario.
Formato sugerido: `SSO-20260922-A7F3C9`.

**3.2** Columna `waivers.content_hash`: SHA-256 de lo firmado —texto del
formulario, nombre impreso, fecha, datos de la firma, timestamp—, calculado al
guardar. Permite demostrar después que el registro no se alteró.

**3.3** Congelar los formularios firmados. **Hoy la política RLS
`org members can manage their waivers` es de tipo ALL: cualquier staff del shop
puede hacer UPDATE sobre un formulario ya firmado.** Sin cerrar eso, el hash no
prueba nada. Hace falta un trigger que rechace modificar un waiver firmado,
salvo los campos de habilitación médica, que por diseño sí cambian.

**3.4** Mostrar el ID y el hash en el PDF exportado y en el registro.

### Fase 4 — Offline en el quiosco
La cola offline ya existe (`queueOfflineAction('waiver_signature', ...)`) pero
solo del lado del staff. El quiosco corre sobre el link del token, que hoy
**necesita conexión** para validar. Hay que decidir cómo: cachear la validación
del token por unas horas, o pre-cargar el grupo al abrir el quiosco.

---

## 3. Qué NO copiamos, y por qué

**La captura automática de fotos.** Smartwaiver toma tres fotos del participante
mientras firma. Es su respuesta al problema de "quién firmó de verdad".

No lo hacemos por dos motivos independientes, y cualquiera alcanza:

1. Es dato biométrico de un huésped. Acabamos de sacar de la app todos los datos
   de salud justamente para no estar en esa categoría de riesgo. Meter fotos de
   caras nos devuelve ahí por otra puerta.
2. Smartwaiver declara patente en trámite sobre ese mecanismo.

El quiosco bloqueado sin fotos sigue siendo mucho mejor que lo de hoy.

---

## 4. Decisión abierta antes de empezar

**¿El quiosco atiende solo reservas existentes, o también walk-ins?**

- **Por reserva** (más simple, cubre la mayoría): el staff abre el quiosco desde
  la reserva del huésped. Solo se firma lo de ese grupo. Casi todo construido.
- **Abierto** (como Smartwaiver): la tablet vive en el mostrador todo el día y
  cualquiera que llegue carga sus datos y firma. Necesita un token a nivel shop
  y que el huésped se identifique solo. Bastante más trabajo.

Smartwaiver es "abierto" porque sus clientes son gimnasios de escalada y parques
de trampolines, donde la mayoría entra sin reserva. Un centro de buceo agenda
casi todo con antelación, así que **"por reserva" probablemente alcance** — pero
hay que confirmarlo con un operador real antes de construir.

---

## 5. Lo que NO cambia

- **Link remoto por mail y QR**: es el camino principal y ya funciona.
- **Registro en papel**: legítimo y se queda. La prueba es el papel físico.
- **Habilitación médica**: rehecha el 22/09, no se toca.
- **Menores**: la firma del tutor sigue en los dos caminos.

---

## Orden sugerido

| | Qué | Por qué en ese lugar |
|---|---|---|
| Ya | Corregir la redacción de procedencia (1.3) | Hoy dice algo que puede ser falso |
| 1 | Auto-cierre y pantalla de entrega | Es la idea de Fran, resuelve el grueso |
| 2 | Entrada al quiosco y sin salida | Completa el modo |
| 3 | Retirar la captura de firmas del staff | Recién ahora es seguro |
| 4 | Congelar firmados (3.3) | Es un agujero real, independiente del resto |
| 5 | Certificado: ID y hash | Valor comercial alto, costo bajo |
| 6 | Offline en quiosco | Lo último: nada de lo anterior depende de esto |

El punto 4 conviene adelantarlo si aparece un cliente real antes: que cualquier
staff pueda editar un formulario firmado es un problema hoy, no dentro de tres
fases.
