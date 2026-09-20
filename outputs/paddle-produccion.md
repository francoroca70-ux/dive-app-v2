# Paddle — salir de sandbox y cobrar de verdad
*20 sep 2026*

---

## Lo primero, porque cambia cómo leés todo lo demás

**Sandbox y producción son dos cuentas separadas de Paddle.** No es un
interruptor. Es otra cuenta, con otros productos, otros precios, otros IDs,
otro token, otra API key, otro secreto de webhook y otra lista de dominios
aprobados.

Consecuencia concreta: **los seis `pri_` que me pasaste son de sandbox y los
seis van a cambiar el día que pasemos a producción.** Lo que quedó conectado
hoy sirve para probar el checkout de punta a punta sin cobrarle a nadie —que
es exactamente lo que hay que hacer antes de cobrar— pero no es la
configuración final.

Por eso el orden de abajo es: primero pedir la aprobación (que es espera, no
trabajo), y mientras tanto probar todo en sandbox.

---

## Paso 1 — Pedir la aprobación de vendedor (hacelo hoy)

Paddle revisa cada cuenta antes de habilitarle cobros reales. Es una revisión
humana y **tarda días**. Es tiempo de espera puro, así que cuanto antes entre,
antes sale.

En la cuenta de **producción** (no la de sandbox):

1. `Paddle → Home` o `Settings → Business verification`
2. Completar los datos del negocio: nombre legal, dirección, país, tipo de
   entidad, y cómo se factura.
3. Subir la documentación que pidan (identidad y, según el caso, prueba de
   domicilio o de la entidad).
4. Enviar para revisión.

### Lo que Paddle va a mirar en el sitio y conviene tener antes

Paddle rechaza cuentas cuyo sitio no deja claro qué se vende y bajo qué
condiciones. Esto ya está en la landing, pero vale confirmarlo antes de enviar:

- Precios visibles y en una moneda concreta. ✅ está
- Términos de servicio y política de privacidad accesibles. ✅ están en el footer
- **Política de reembolsos.** ✅ está en el footer (`ln147`)
- Una forma de contacto real. ✅ mail + WhatsApp
- Descripción clara del producto. ✅ la landing entera

Si algo de eso no estuviera, el rechazo llega con una semana de demora
encima. Por eso se chequea antes y no después.

---

## Paso 2 — Aprobar el dominio (se olvida siempre y rompe el checkout)

Paddle.js solo abre el checkout en dominios que estén en la lista blanca de
esa cuenta. El dominio aprobado en sandbox **no** vale en producción.

`Paddle → Checkout → Website approval` (o `Checkout settings → Approved
domains`) → agregar `sevenseasops.com` **y** `www.sevenseasops.com`.

Si esto falta, el botón de suscribirse no hace nada visible y en la consola
aparece un error de dominio no aprobado. Es el fallo más silencioso de toda la
migración.

---

## Paso 3 — Recrear los productos y precios en producción

Tres productos, dos precios cada uno. Mismos importes que en sandbox:

| Producto | Barcos | Mensual | Anual |
|---|---|---|---|
| Seven Seas — Starter | 1–3 | $79 USD | $790 USD |
| Seven Seas — Growth | 4–8 | $169 USD | $1.690 USD |
| Seven Seas — Pro | 9–17 | $329 USD | $3.290 USD |

Enterprise no lleva producto: se negocia por llamada.

**Anotá los seis `pri_` nuevos y pasámelos.** Sin eso el checkout de producción
apunta a precios que no existen en esa cuenta.

---

## Paso 4 — Recrear el descuento Founding Fleet

`Paddle → Discounts → Create`:

- Código: `FOUNDINGFLEET30`
- Tipo: porcentaje, **30%**
- Duración: **recurrente / para siempre** — no "first billing period". Este es
  el punto que hace o rompe la promesa de la landing ("30% de por vida"). Si
  queda en el primer período, al segundo mes el cliente paga el precio lleno
  y la landing pasa a ser mentira.
- Usos máximos: **10**
- Alcance: o sin límite de productos, o limitado a los tres productos nuevos.

---

## Paso 5 — Webhook de producción

`Paddle → Developer tools → Notifications → New destination`:

- URL: `https://ggtbxjwstkuhnabwpgdz.supabase.co/functions/v1/paddle-webhook`
- Eventos: todos los `subscription.*`
- Copiar el **secreto** que genera (empieza con `pdl_ntfset_...`)

La Edge Function ya valida firma HMAC y rechaza payloads de más de 5 minutos,
así que no hay que tocar código: solo cambiar el secreto.

---

## Paso 6 — Los cambios en el código y en Supabase

### `index.html` (líneas ~90-106)

```js
const PADDLE_ENV   = 'production';        // era 'sandbox'
const PADDLE_TOKEN = 'live_...';          // era 'test_72490ade5a4569aaeec5660413d'
const PADDLE_PRICE_IDS = {                // los SEIS cambian
  starter: { monthly: 'pri_...', annual: 'pri_...' },
  growth:  { monthly: 'pri_...', annual: 'pri_...' },
  pro:     { monthly: 'pri_...', annual: 'pri_...' }
};
```

El token live está en `Paddle → Developer tools → Authentication → Client-side
tokens`. Es público por diseño (va en el HTML); el que **nunca** va en el
código es la API key.

### Supabase → Edge Functions → Secrets

| Secreto | Valor nuevo | Lo usa |
|---|---|---|
| `PADDLE_API_BASE` | `https://api.paddle.com` | `paddle-portal` |
| `PADDLE_API_KEY` | la API key de producción | `paddle-portal` |
| `PADDLE_WEBHOOK_SECRET` | el secreto del paso 5 | `paddle-webhook` |

`PADDLE_API_BASE` hoy ni siquiera está seteado: la función usa
`https://sandbox-api.paddle.com` como valor por defecto. **Si no se setea en
producción, el botón "Gestionar facturación" le va a pedir a la API de sandbox
un cliente que existe solo en producción, y devuelve 404.** El cliente ve un
error al intentar cambiar su tarjeta.

---

## Paso 7 — La prueba que no se puede saltear

Con todo arriba, antes de mandarle el link a nadie:

1. Suscribirte vos con una tarjeta real al plan más barato.
2. Confirmar en Supabase que la org quedó `subscription_status = 'active'` con
   el `plan_tier` correcto. Si el webhook falla, el cliente paga y la app no se
   entera — es el peor modo de fallo posible.
3. Probar el botón "Gestionar facturación" (valida el paso 6).
4. Probar `FOUNDINGFLEET30` en el checkout y confirmar que el descuento dice
   que se aplica a cada período, no solo al primero.
5. Cancelar y pedir el reembolso desde el panel de Paddle.

Cinco minutos y una tarjeta. Es la diferencia entre descubrir un problema vos o
descubrirlo con el primer cliente que paga.

---

## Detalle menor, anotado para no perderlo

El checkout manda `billing_cycle` en `custom_data`, pero
`paddle-webhook` hoy guarda solo `org_id` y `plan_tier` — ignora el ciclo. No
rompe nada (Paddle sabe el ciclo y el portal del cliente lo muestra), pero la
app no puede decir "facturado anualmente, renueva el 20/09/2027" sin
consultarle a Paddle. Si en algún momento queremos mostrarlo en Ajustes, hay
que sumar una columna `billing_cycle` y leerla en el webhook.
