# Ficha de Google Play — inglés: lo que hay que corregir

*Escrito el 29/10/2026. La ficha en español (es-419) quedó publicada y correcta
el 28/10; esta es la de inglés, que quedó atrás.*

**Nada de esto lo toca Claude** (regla 1): van del panel de Play, con Fran
logueado. Y por la regla 9, se cierra **midiendo la ficha pública**, no con una
captura del panel — Play aplica los cambios al pasar las verificaciones rápidas.

---

## 1 · Nombre de la app

Medido el 28/10 en la ficha pública: aparecen **dos nombres distintos** entre la
ficha y la app instalada (`Seven Seas` en `capacitor.config.json`, `Seven Seas
Ops` en la ficha en español).

**Decisión pendiente de Fran**, y es una decisión de producto, no un arreglo:

| | A favor | En contra |
|---|---|---|
| **Seven Seas** | es lo que dice el ícono en el teléfono, y es el nombre del binario | no dice qué hace, y «seven seas» tiene mucha competencia en la tienda |
| **Seven Seas Ops** | igual que el dominio, la landing y la ficha en español | hay que cambiar `appName` en `capacitor.config.json` y eso **sí** necesita binario nuevo |

**Lo que yo haría: `Seven Seas Ops` en las dos fichas, y dejar `appName` como
está hasta el próximo binario.** El nombre de la ficha y el del ícono pueden
diferir sin que Play se queje, y unificar el ícono puede viajar con el envío que
ya hay que hacer por el arranque del binario — en vez de pedir uno sólo para
esto.

---

## 2 · Descripción breve · máx. 80

La actual es la vieja. La corregida, igual criterio que la española —**la
descripción dice qué ES la app, no una función**:

```
Dive and charter operations: bookings, gear, crew and daily cash-up.
```

73 caracteres.

---

## 3 · Descripción completa

Dos arreglos concretos:

**a · Hay DOS veces la línea del offline**, una vieja y una nueva. Borrar
la vieja:

```
- Works offline — built for shops with unreliable wifi
```

**b · Poner en su lugar la frase corregida del 28/10**, que es la que no promete
lo que la app no hace:

```
Crew sign in at the shop in the morning and the app keeps working all day on
the boat, with no signal.
```

El porqué de ese cambio está en
`Decisiones/Qué quiere decir que la app funciona sin conexión.md` del vault:
«Works offline» se leía como *arranca de cero sin internet*, y eso no es cierto
en ninguna app con cuenta. Lo que sí es cierto es el día de trabajo completo.

---

## 4 · Enlaces: apuntan al servidor, no al dominio

Medido el 28/10: el sitio web y la política de privacidad de la ficha apuntan a
`dive-app-v2.onrender.com`. Tienen que apuntar al dominio público, que es el que
tiene el certificado, el SEO y la landing:

```
Sitio web:               https://www.sevenseasops.com
Política de privacidad:  https://www.sevenseasops.com/privacy.html
```

**Confirmar antes de guardar** que esa segunda URL abre de verdad — si la
política vive en otra ruta, va esa. Una política de privacidad que da 404 es
motivo de rechazo en Play, no un detalle.

---

## 5 · «Novedades de esta versión» está en español en la ficha inglesa

Reemplazar por:

```
Faster startup, and the app now opens from the device instead of the server —
so it keeps working on the boat with no signal. Fixes to checklists, exports
and the Spanish texts.
```

---

## Lo que NO hay que tocar

- **Las capturas.** Las de inglés son las que Play hereda para español, y están
  bien. No se suben capturas nuevas para español.
- **La publicación administrada sigue desactivada**, así que los cambios de
  ficha salen solos al pasar las verificaciones rápidas. No hay que «enviar a
  revisión» aparte.

## Cómo se cierra

**Midiendo la ficha pública** —`play.google.com/store/apps/details?id=com.sevenseasops.app&hl=en`—
y comprobando las cinco cosas: nombre, descripción breve, una sola línea de
offline, enlaces al dominio, y novedades en inglés. Eso sí lo puede medir Claude.

---

## MEDIDO EN LA FICHA PÚBLICA EL 30/10, Y HAY ALGO MÁS GRANDE QUE LA FICHA

> [!warning] **«Updated on Sep 1, 2026».** No salió ninguna versión nueva a Play
> **desde el 1 de septiembre.**
>
> O sea que el binario que tienen los 13 dispositivos reales es el de antes del
> arreglo del 14/10: **el que lleva `server.url` y no abre sin señal.** Todo lo
> que se construyó este mes para que la app abra del binario —sacar `server.url`,
> vendorizar supabase-js, la copia local— **no llegó a ningún teléfono Android**.
>
> Y la ficha en inglés sigue prometiendo, dos veces, lo que decidimos el 28/10
> que no era cierto: *«all designed to keep working when the signal drops»* y el
> bullet *«Works offline — built for shops with unreliable wifi»*.
>
> **Esto es lo más urgente que hay hoy**, y no es código: es una release de Play.
> El AAB firmado lo construye el workflow solo con cada push (*Actions → Mobile
> app builds*, artefacto del release). Lo único que falta es subirlo.

### Y el nombre ya estaba decidido por los hechos

La ficha pública en inglés dice **«Seven Seas»**, igual que `appName` en
`capacitor.config.json`. La que dice «Seven Seas Ops» es la española, que subiste
el 28/10. Así que no hay que elegir entre dos opciones: hay que **unificar las dos
fichas**, y lo barato es dejar «Seven Seas» en las dos — coincide con el ícono del
teléfono y con el binario, y no pide build nuevo.

(El dominio y la landing siguen diciendo «Seven Seas Ops». Eso es el nombre del
producto y puede diferir del nombre de la app en la tienda sin que moleste a
nadie; lo que no puede pasar es que las dos fichas de la MISMA app difieran.)

### El orden, entonces

1. **Subir la release de Android** con el build actual. Es lo único que le llega
   a un usuario real.
2. Corregir la ficha en inglés: descripción breve, **las dos** menciones de
   offline, los enlaces al dominio, y las novedades en inglés.
3. Recién después, iOS.
