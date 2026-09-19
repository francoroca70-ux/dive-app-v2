# Próxima sesión — arrancar por acá
*Actualizado 19 sep 2026. Leer esto antes de tocar nada.*

---

## 1. Supabase Pro — lo único que puede dejarte sin producto

El proyecto **se pausó solo** el 19 de septiembre por 7 días sin actividad
(plan gratuito). Mientras estuvo pausado la app estuvo caída: sin base no hay
login, ni reservas, ni waivers.

Son **$25/mes**. Un solo cliente en Starter lo paga dos veces. Fran lo
actualiza el 20 de septiembre.

**No mandar el outreach a los 10 shops antes de resolver esto.** El escenario
realista es un shop que prueba la app dos días, se va una semana a temporada
alta, y al volver la encuentra muerta. Ese cliente no vuelve.

---

## 2. Routing de la raíz — lo que más frena el outreach

`sevenseasops.com` sirve `index.html`, que es la app. Quien escriba el dominio
—o llegue desde Google, o desde los mails— cae en "Sign in to your account"
sin saber qué es el producto. La landing está escondida en `/landing.html`.

### Lo que cambió respecto al análisis anterior

**Los 28 links de waiver son todos de prueba.** Fran confirmó que se pueden
romper sin consecuencias. Eso elimina la restricción principal que había.

**Pero sigue en pie el otro bloqueo:** `capacitor.config.json` tiene
`server.url: https://dive-app-v2.onrender.com`, o sea la raíz del mismo
servicio de Render. Si la raíz pasa a servir la landing, las apps nativas de
iOS y Android cargan la landing en lugar de la app. Y **el build de iOS está
en revisión de Apple** (108001), así que no se puede recompilar ahora.

### Solución: gate del lado del cliente

Al principio de `index.html`, antes de renderizar el login: redirigir a
`/landing.html` salvo que se cumpla alguna de estas condiciones.

1. Hay token en la query (`?waiver=`, `?invite=`)
2. Hay sesión de Supabase guardada
3. **Corre dentro de la app nativa** — usar `isNativeAppShell()`, que ya existe
   (se construyó para el tema de cumplimiento de Paddle). Sin esto, la app
   nativa en su primer arranque no tiene sesión y se autoredirige a la landing.
4. Hay token de recuperación en el **hash**, no en la query: los links de
   reseteo de contraseña de Supabase llegan como
   `#access_token=...&type=recovery`. Sin chequear el hash, a alguien
   reseteando su contraseña lo mandamos a la landing y pierde el flujo.

Agregar además `<meta name="robots" content="noindex">` a `index.html`: es una
app privada, no tiene nada que hacer en un índice de búsqueda.

**No dar vuelta los archivos** (landing.html → index.html) hasta que la
revisión de iOS termine y se pueda coordinar un build nativo nuevo.

---

## 3. Notificaciones push reales — feature nueva, no un arreglo

Hoy las notificaciones **solo aparecen cuando la crew abre la app**. No llega
nada al teléfono. Para un producto donde el valor es que el staff se entere de
un cambio de horario o una asignación, eso es una carencia real.

No es un ajuste menor. Requiere:

- Plugin `@capacitor/push-notifications`
- Firebase Cloud Messaging (Android) + APNs con certificados de Apple (iOS)
- Una tabla nueva para guardar los device tokens por usuario
- Una Edge Function que dispare los envíos
- **Un build nativo nuevo en las dos plataformas**

Ese último punto lo bloquea: **esperar a que termine la revisión de iOS.**
Meter un build nuevo ahora reinicia la cola de revisión.

Vale la pena hacerlo bien cuando se pueda — es de las cosas que separan "una
planilla linda" de "software de operaciones".

---

## 4. Ordenamiento de eventos del webhook de Paddle

El webhook aplica cualquier evento `subscription.*` con firma válida, sin
mirar si es más nuevo que lo guardado. Dos eventos fuera de orden y el estado
viejo pisa al nuevo. No es un ataque —la protección contra replay ya está
puesta, función versión 4— es robustez.

**Fix:** columna `organizations.paddle_last_event_at timestamptz`, y en el
webhook descartar si `data.occurred_at <= paddle_last_event_at`. Acordarse de
sumarla a la lista que preserva el trigger `clamp_org_billing_columns()`.

---

## 5. Un manager puede promoverse a owner

`owners_managers_update_staff` deja que owner **y manager** editen cualquier
fila de `staff` de su org. Como el rol es una columna de esa fila, un manager
puede editarse a sí mismo y ponerse `owner`, degradar al owner original, y
desde ahí tocar facturación o cerrar la cuenta.

No es un problema entre organizaciones —el aislamiento está cerrado y
verificado— es escalada dentro de un shop. Fran fue explícito: cambiar roles
debe ser potestad exclusiva del dueño.

**Fix:** trigger `BEFORE UPDATE` en `staff` que rechace el cambio de `role` si
quien llama no es owner, y que impida que un no-owner modifique la fila de un
owner. El manager sigue pudiendo editar `day_rate`, `banked_days`, `active`,
`full_name`.

---

## 6. Monitorear orgs `active` sin `plan_tier`

Estado que da botes ilimitados: `plan_limit_for()` devuelve null si no hay
tier, así que un cliente `active` sin plan no tiene tope. Hoy solo lo tienen
las orgs viejas de Fran, pero si el webhook alguna vez no trae el `plan_tier`,
un cliente real caería ahí.

La consulta para chequearlo está al final de
`outputs/plan-limits-migration.sql`.

---

## 7. Cowork en el celular

Fran quiere acceder desde el teléfono a esta conversación, al proyecto entero
y a otras conversaciones relevantes.

A revisar cuando se encare: las conversaciones dentro de un Proyecto deberían
sincronizar a la app móvil de Claude con la misma cuenta, pero las capacidades
propias de Cowork —acceso a la carpeta `dive-app-v2`, shell, edición de
archivos— son de escritorio. Conviene verificar qué parte funciona realmente
en el teléfono antes de asumir nada.

---

## 8. Instagram

Cuenta todavía sin crear (la crea Fran, no Claude). Usuario sugerido:
`sevenseasops`. Plan completo y qué fotos buscar en el archivo:
`outreach/instagram-plan-lanzamiento.md`. Fran confirmó que tiene su material
de Fiyi, Tailandia y BVI a mano.

---

## Hecho y verificado (no rehacer)

- **Aislamiento entre organizaciones**: cerrado y verificado tabla por tabla.
  Ver `outputs/security-audit-2026-09-12.sql`.
- **Topes por plan**: botes (2/5/15) y locales (Starter = 1), con triggers en
  la base y avisos en la app. Probado contra datos reales: corta el alta,
  corta la reactivación, y un bote inactivo no ocupa cupo. Las pruebas gratis
  quedan sin tope a propósito. Ver `outputs/plan-limits-migration.sql`.
- **Aviso de bajada de plan**: si un shop queda por encima de su tope tras
  bajar de plan, la app se lo dice. No se desactivan botes automáticamente
  porque rompería los viajes que los referencian.
- **Landing**: barra de Founding Fleet fija arriba, herramientas antes del
  origen, sin el claim de "legalmente sólido", meta tags y og: completos,
  imagen de preview 1200×630.
- **Google Search Console**: archivo de verificación publicado y respondiendo
  en `/google38afbbbeee2c0da9.html`. Falta darle Verificar y enviar el
  sitemap.
- **iOS**: build 108001 en revisión de Apple.
- **Outreach**: 4 mails cálidos + 3 bocetos fríos + 10 shops investigados con
  línea de personalización cada uno, en `outreach/`.

---

## Decidido y descartado

**VPS.** Evaluado el 19 de septiembre y descartado: no resuelve nada de lo que
hoy está roto. Las notificaciones programadas salen con `pg_cron` + Edge
Functions, que ya están pagas; las push necesitan FCM/APNs, no una máquina. El
pausado de Supabase se arregla con Pro, no con un VPS. Y el costo real no son
los $8-24, es convertirse en sysadmin con una hora por día disponible.

Tendría sentido el día del mapeo 3D desde video: eso es procesamiento pesado
que no entra en una Edge Function.
