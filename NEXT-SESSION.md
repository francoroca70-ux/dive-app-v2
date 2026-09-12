# Próxima sesión — arrancar por acá
*Escrito 12 sep 2026 al cierre de sesión. Leer esto antes de tocar nada.*

---

## 1. PRIORIDAD — La raíz del dominio sirve el login, no la landing

**El problema.** `https://sevenseasops.com/` sirve `index.html`, que es la app.
Un prospecto que escribe el dominio, hace clic en un link de los mails de
outreach, o llega desde Google, cae en "Sign in to your account" sin una sola
palabra de qué es el producto. La landing existe pero está en `/landing.html`,
que nadie adivina. Esto es lo primero que hay que resolver: bloquea la
conversión de todo el outreach.

**La restricción que hace esto delicado.** En `index.html`:

```js
function buildWaiverSigningUrl(token) {
  return `${window.location.origin}${window.location.pathname}?waiver=${token}`;
}
```

Los links de firma remota se construyen desde la URL donde está corriendo la
app. Si el staff usa la app en `sevenseasops.com/`, los waivers ya enviados a
huéspedes apuntan a `sevenseasops.com/?waiver=TOKEN`. **Hay 28 links de firma
ya generados en la base** (tabla `waiver_signing_links`). Cualquier cambio que
haga que `/` deje de servir la app rompe esos links, incluidos los ya mandados.

### Opción A — gate del lado del cliente (RECOMENDADA)

Al principio de `index.html`, antes de renderizar el login: si NO hay token en
la query y NO hay sesión guardada, redirigir a `/landing.html`.

- Los links de waiver/invitación siguen funcionando: traen token.
- El staff logueado sigue entrando directo: tiene sesión.
- Solo el visitante anónimo sin token va a la landing, que es exactamente lo
  que queremos.
- ~10 líneas, reversible, cero cambios de infraestructura.

**Edge case que NO hay que olvidar:** los links de reseteo de contraseña de
Supabase llegan con el token en el **hash**, no en la query
(`sevenseasops.com/#access_token=...&type=recovery`). Sin chequear el hash, a
alguien reseteando su contraseña lo rebotamos a la landing y pierde el flujo.
La condición tiene que contemplar `?waiver=`, `?invite=`, sesión activa, y
`access_token` / `type=recovery` en el hash.

Sumar también `<meta name="robots" content="noindex">` a `index.html`: es una
app privada, no tiene nada que hacer en un índice de búsqueda.

### Opción B — dar vuelta los archivos (NO hacer todavía)

`landing.html` → `index.html` y la app → `app.html`. Mejor para SEO y para la
marca, pero:

- Rompe los 28 links de waiver ya enviados salvo que se agregue una regla de
  rewrite en Render.
- **Y rompe la app nativa.** `capacitor.config.json` tiene
  `server.url: https://dive-app-v2.onrender.com`, o sea la raíz. Si la raíz
  pasa a servir la landing, la app de iOS y Android cargan la landing en vez
  de la app. Habría que cambiar `server.url` a `/app.html` y **recompilar** —
  y el build de iOS está ahora mismo en revisión de Apple (108001).

Conclusión: Opción A ahora. Opción B más adelante, cuando se pueda coordinar
un build nativo nuevo sin interferir con la revisión.

---

## 2. Google Search Console

Ya quedaron creados `robots.txt`, `sitemap.xml` y los meta tags (description,
canonical, og:, twitter:) en la landing, más una imagen de preview 1200×630 en
`assets/og-image.png`. Falta el paso manual: registrar el sitio en Google
Search Console y enviar el sitemap. Sin eso Google puede tardar semanas en
encontrarlo solo; con eso, días.

Verificar también que la preview del link funcione, compartiendo
`https://www.sevenseasops.com/landing.html` por WhatsApp una vez desplegado.

---

## 3. Webhook de Paddle — ordenamiento de eventos

Hoy el webhook aplica cualquier evento `subscription.*` que llegue con firma
válida, sin mirar si es más nuevo que lo que ya está guardado. Si Paddle
entrega dos eventos fuera de orden (o reintenta uno viejo después de uno
nuevo), el estado más viejo sobrescribe al más nuevo. No es un ataque —
la protección contra replay ya está puesta, función versión 4 — es robustez.

**Fix:** agregar una columna de marca de agua alta, p. ej.
`organizations.paddle_last_event_at timestamptz`, y en el webhook descartar el
evento si `data.occurred_at <= paddle_last_event_at`. Acordarse de sumar esa
columna a la lista que preserva el trigger `clamp_org_billing_columns()`, para
que el cliente no la pueda tocar.

---

## 4. Un manager puede promoverse a owner

La política `owners_managers_update_staff` deja que owner **y manager** editen
cualquier fila de `staff` de su org. Como el rol es una columna de esa misma
fila, un manager puede editarse a sí mismo y ponerse `owner` — y también
degradar al owner original, y desde ahí tocar facturación o cerrar la cuenta
del shop.

No es un problema entre organizaciones (el aislamiento entre shops está
cerrado y verificado), es escalada de privilegios dentro de un shop. Fran fue
explícito: cambiar roles debe ser potestad exclusiva del dueño.

**Fix:** mismo patrón que el trigger de facturación. Un trigger `BEFORE UPDATE`
en `staff` que rechace el cambio de `role` si quien llama no es owner, y que
impida que un no-owner modifique la fila de un owner — dejando que el manager
siga editando lo que sí le corresponde (`day_rate`, `banked_days`, `active`,
`full_name`).

---

## 5. Pendientes menores

- **Corregir el link en `outreach/primer-contacto-warm-leads.md`**: dice
  `https://sevenseasops.com`, tiene que decir `/landing.html` hasta que esté
  resuelto el punto 1.
- **Código de excepción en Paddle** para los contactos de Fran (quedó para
  esta semana). Solo importa cuando se llenen los 10 cupos.
- **Barrido estético en tablet.** El de celular quedó cerrado (cero desborde
  en 11 páginas + modales, controles táctiles en 40-44px). Tablet es el
  dispositivo con el que Fran prueba, así que vale la pasada.
- **Columna muerta**: quedan `participants.payment_status` / `amount_paid` /
  `payment_method` en uso, así que no tocarlas. Ya se eliminaron
  `waiver_signed`, `check_in_status` y `cert_level`.

---

## Estado al cierre del 12 sep 2026

- **iOS**: build 108001 enviado a revisión de Apple, pendiente.
- **Seguridad**: falla crítica de aislamiento entre organizaciones cerrada y
  verificada tabla por tabla (ver `outputs/security-audit-2026-09-12.sql`).
- **Founding Fleet**: publicado en la landing, código `FOUNDINGFLEET30`,
  30% recurrente, 10 usos.
- **Outreach**: 4 mails listos en `outreach/primer-contacto-warm-leads.md`
  (Simon Garrity/Big Blue, Dave/Hauraki, Jeff/Dive BVI, Gareth/Reef Safari).
  Sea Shepherd deliberadamente excluido por ahora.
