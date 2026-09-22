# Preguntas para el contador — Seven Seas Ops
*22 sep 2026. Ordenadas por prioridad.*

---

## Contexto para darle en dos minutos

- Persona física en Argentina. **Sin monotributo ni ningún registro en AFIP hoy.**
- Producto: software por suscripción (SaaS) para centros de buceo y operadores
  náuticos. Se vende por internet, mensual o anual, $79 / $169 / $329 USD.
- **Clientes: empresas del exterior.** México, Tailandia, Fiyi, Islas Vírgenes
  Británicas, España, Indonesia, Egipto. Prácticamente ninguno en Argentina.
- Cobro a través de **Paddle**, que actúa como *merchant of record*: Paddle le
  vende al cliente final y después me liquida a mí. **Mi contraparte comercial
  es Paddle, no el centro de buceo.** Paddle.com Market Ltd, con sede en Reino
  Unido.
- Objetivo realista a 8 meses: USD 1.500/mes.
- Costos actuales: Supabase (~USD 25/mes), Render, cuenta de desarrollador de
  Apple (USD 99/año), Google Play (pago único), comisión de Paddle sobre cada
  cobro.
- Ciudadanía española en trámite, más de 2 años. Posible mudanza a la UE a
  mediano plazo.

---

## Prioridad 1 — antes de que entre el primer peso

### 1. ¿Me tengo que registrar antes de recibir el primer pago, o puedo empezar y regularizar después?
Paddle ya me está pidiendo tipo de entidad y probablemente CUIT. Necesito
saber si esto frena el alta o si puedo avanzar.

### 2. ¿Monotributo o Responsable Inscripto?
El punto que me hace dudar: **el monotributo no permite deducir gastos.** Mis
costos (hosting, comisión de Paddle, cuentas de desarrollador) no son enormes
pero tampoco despreciables. ¿A partir de qué facturación deja de convenir el
monotributo por este motivo?

### 3. Exportación de servicios: ¿cómo funciona en mi caso?
Vendo a clientes del exterior. Entiendo que hay un tratamiento específico.
- ¿Qué requisitos tengo que cumplir para que califique como exportación?
- ¿Cambia algo que cobre a través de un intermediario (Paddle) y no
  directamente del cliente final?
- ¿Hay algún beneficio o régimen al que pueda acceder?

### 4. ¿A quién le facturo, y qué?
Este es el que más me confunde. Como Paddle es *merchant of record*, el que me
paga es Paddle, no los centros de buceo.
- ¿Emito una factura por liquidación a Paddle, o una por cliente final?
- ¿Factura tipo E?
- ¿Qué documentación de respaldo necesito guardar de Paddle?

### 5. ¿Cómo entra la plata?
Paddle liquida en dólares o euros.
- ¿A qué tipo de cuenta puede liquidar? ¿Banco argentino, Wise, Payoneer?
- ¿Qué implica cada opción en cuanto a liquidación de divisas y tipo de cambio?
- ¿Hay obligación de liquidar en el mercado oficial?
- ¿Cuál es el camino más limpio y más simple de sostener en el tiempo?

---

## Prioridad 2 — primeros meses

### 6. Categoría de monotributo y techo
- ¿En qué categoría arranco si proyecto USD 1.500/mes hacia fin de año?
- ¿Cómo se convierte a pesos para determinar la categoría?
- ¿Qué pasa cuando supero el techo? ¿La transición a Responsable Inscripto es
  automática o la tengo que gestionar?

### 7. Reconocimiento del ingreso y tipo de cambio
- ¿Cuándo se considera devengado: cuando el cliente paga a Paddle, o cuando
  Paddle me liquida a mí? Puede haber semanas de diferencia.
- ¿Qué tipo de cambio aplico?

### 8. Gastos y deducciones
Si termino como Responsable Inscripto, ¿qué puedo deducir?
Hosting, comisiones de Paddle, cuentas de desarrollador, equipo, internet,
y eventualmente honorarios profesionales (abogado, contador).

### 9. IVA
- ¿La exportación de servicios está exenta o gravada a tasa cero?
- ¿Cambia según el régimen que elija?

---

## Prioridad 3 — planificación

### 10. ¿Conviene armar una SAS en algún momento?
- ¿A partir de qué facturación tiene sentido?
- ¿Qué gano y qué me cuesta en tiempo y plata?
- Hoy la responsabilidad es personal e ilimitada, y vendo software que maneja
  datos de huéspedes de terceros. ¿Eso pesa en la decisión?

### 11. Mudanza a la UE
Si sale la ciudadanía española y me voy:
- ¿Cuándo dejo de ser residente fiscal argentino y qué trámite implica?
- ¿Conviene mover la operación a una entidad europea, o sostener la argentina
  desde afuera?
- ¿Hay algo que **no** deba hacer ahora para no complicar ese escenario después?

### 12. Apple y Google
Hoy no vendo a través de ninguna de las dos tiendas — la suscripción se cobra
por la web con Paddle. Si algún día habilitara compras dentro de la app,
¿cambia mi situación fiscal?

---

## Dos cosas que me sirven como subproducto

Independientemente de las respuestas, si me registro en AFIP obtengo:

1. **Constancia de inscripción**, que es el documento que Apple me pidió para
   verificar mi nombre en el trámite del Reglamento de Servicios Digitales
   europeo. Hoy tuve que subir el DNI por no tenerla.
2. **CUIT**, que es lo que Paddle probablemente me pida para terminar la
   verificación de la cuenta.

O sea que el registro resuelve dos trámites que ya tengo abiertos, además del
tema impositivo.

---

## Lo único urgente

Todo lo demás puede esperar unas semanas. Lo que no: **si Paddle frena la
verificación de la cuenta por falta de CUIT, ahí sí se convierte en bloqueante**,
porque sin cuenta verificada no puedo cobrarle a nadie.
