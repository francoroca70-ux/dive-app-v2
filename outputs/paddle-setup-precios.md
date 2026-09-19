# Paddle — qué crear para los precios nuevos
*19 sep 2026. El código ya está listo y esperando estos IDs.*

---

## Lo que hay que crear

**Tres productos** (Enterprise no lleva producto: se negocia por llamada, no
tiene checkout), y **dos precios por producto** — Paddle trata mensual y anual
como precios distintos del mismo producto.

| Producto | Precio mensual | Precio anual |
|---|---|---|
| Seven Seas — Crew | $79 USD / mes | $790 USD / año |
| Seven Seas — Fleet | $169 USD / mes | $1.690 USD / año |
| Seven Seas — Armada | $329 USD / mes | $3.290 USD / año |

El anual son **dos meses gratis** (~17% de descuento), que es el estándar del
rubro.

---

## Dónde van los IDs

Cuando los tengas, pasámelos y los pongo. Van en `index.html`, en el bloque
`PADDLE_PRICE_IDS`:

```js
const PADDLE_PRICE_IDS = {
  crew:   { monthly: 'pri_...', annual: 'pri_...' },
  fleet:  { monthly: 'pri_...', annual: 'pri_...' },
  armada: { monthly: 'pri_...', annual: 'pri_...' }
};
```

Hoy los `monthly` apuntan a los precios viejos como marcador de posición, para
que el checkout no reviente mientras tanto, y los `annual` están en `null`. Si
alguien elige anual antes de que existan, la app le dice que el pago anual
todavía no está habilitado en vez de abrir un checkout roto o cobrarle
mensual sin avisar.

---

## ⚠️ Lo que se rompe en silencio si te lo salteás

**El descuento Founding Fleet no cubre productos nuevos automáticamente.**
`FOUNDINGFLEET30` está asociado a los tres productos viejos. Si creás Crew,
Fleet y Armada como productos nuevos y no los agregás al alcance del
descuento, el código deja de funcionar y **nadie se entera hasta que un
cliente lo intenta y le rebota**.

En Paddle: Discounts → FOUNDINGFLEET30 → Limit to specific products → sumar
los tres nuevos.

Dos alternativas si te resulta más simple: dejar el descuento sin límite de
productos (aplica a todo lo que vendas), o directamente editar los precios de
los productos existentes en vez de crear productos nuevos — en ese caso los
`pri_` actuales siguen sirviendo y no hay que tocar nada del código salvo
sumar los anuales.

**Esa última opción es la que menos puede salir mal**, y probablemente la que
te conviene: editás el importe de los tres precios que ya existen, creás solo
los tres anuales, y el descuento sigue apuntando a donde siempre apuntó.

---

## Lo que ya quedó hecho del lado del código

- Base: tiers `crew` / `fleet` / `armada` / `enterprise`, con la restricción
  actualizada. Sin esto el webhook fallaría al guardar un tier nuevo — el
  cliente paga, Paddle cobra, y la app nunca se entera.
- Topes de barcos por banda: Crew 3, Fleet 8, Armada 17, Enterprise sin tope.
- Blue water migrada de `growth` a `fleet` (tiene 4 barcos).
- Prueba de **30 días**, cambiada en los cuatro lugares donde vivía el 14
  — incluido el trigger de la base, que es el que realmente manda y habría
  seguido dando 14 días aunque la landing dijera 30.
- Tope de locales **eliminado**: el brief define un solo eje de precio
  (cantidad de barcos), así que limitar locales sería cobrar por algo que no
  se vende.
- Landing y app con los cuatro planes, toggle mensual/anual, precios con
  Founding Fleet recalculados al 30%, y el rango real por barco.
- El checkout manda `billing_cycle` a Paddle junto con `org_id` y `plan_tier`,
  así el webhook sabe qué ciclo contrató.

---

## Pendiente aparte: salir de sandbox

Paddle sigue en **sandbox**. Antes de cobrarle a alguien de verdad hay que
pasar a producción, lo que implica que Paddle revise la cuenta y apruebe al
vendedor — y eso tarda. Conviene iniciarlo cuanto antes porque es tiempo de
espera, no de trabajo.

Al pasar a producción hay que cambiar en `index.html`:

```js
const PADDLE_ENV = 'sandbox';   // -> 'production'
const PADDLE_TOKEN = 'test_...'; // -> el token live
```

y en las variables de la Edge Function, `PADDLE_API_BASE` de
`https://sandbox-api.paddle.com` a `https://api.paddle.com`, más la API key y
el secreto de webhook de producción.
