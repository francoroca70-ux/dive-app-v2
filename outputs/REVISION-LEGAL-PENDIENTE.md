# ⚠️ PARA REVISIÓN DE UN ABOGADO — Seven Seas Ops

**Estado: BORRADOR. Ningún abogado revisó estos documentos todavía.**

*Última actualización: 20 de septiembre de 2026*

---

## Qué es esto

Seven Seas Ops tiene tres documentos legales publicados y en vigencia:

| Documento | URL |
|---|---|
| Términos de Servicio | https://www.sevenseasops.com/terms.html |
| Política de Privacidad | https://www.sevenseasops.com/privacy.html |
| Política de Reembolsos | https://www.sevenseasops.com/refund.html |

Los tres están **escritos por el fundador con ayuda de IA**, en español e inglés.
Describen con precisión cómo funciona el servicio hoy. No reemplazan el
asesoramiento de un profesional, y hay puntos concretos donde sabemos que
puede haber un problema.

Este archivo es la lista de esos puntos, para llevarle a un abogado y no
pagar una hora de su tiempo para que descubra lo que ya sabemos.

---

## Contexto del negocio

- **Quién vende:** Franco Roca, persona física, con domicilio en Argentina.
  Sin sociedad constituida. Ciudadanía española en trámite (2+ años), lo que
  podría cambiar la jurisdicción en el mediano plazo.
- **Qué se vende:** software de operaciones por suscripción (SaaS) para
  centros de buceo, charters, escuelas de surf y liveaboards.
- **A quién:** empresas, no consumidores. Clientes esperados en Tailandia,
  México, Fiyi, Islas Vírgenes Británicas, España, Indonesia, Egipto,
  Filipinas, Argentina. **La mayoría fuera de Argentina.**
- **Cómo se cobra:** Paddle actúa como *merchant of record*. Paddle es el
  vendedor registrado frente al cliente final, factura, cobra y liquida los
  impuestos sobre la venta. Franco le vende a Paddle, no al cliente final.
- **Datos que se manejan:** datos de huéspedes de los centros, incluidas
  **exenciones de responsabilidad firmadas digitalmente** y la indicación de
  que existe un cuestionario médico en papel.

---

## Puntos concretos a revisar, por orden de riesgo

### 1. 🔴 Exenciones de responsabilidad (waivers) — el riesgo más grande

**Dónde:** Términos, sección 6.

La app permite que un centro de buceo recolecte firmas digitales de sus
huéspedes en exenciones de responsabilidad. Seven Seas **no redacta ni
revisa** el texto de esas exenciones: cada centro escribe el suyo.

Los Términos dicen que Seven Seas no es parte de esa exención y no responde
por su contenido ni por la participación del huésped en la actividad.

**Lo que hay que confirmar:**
- ¿Esa exclusión de responsabilidad se sostiene? Si un huésped se ahoga y la
  familia demanda, ¿puede alcanzar al proveedor del software que capturó la
  firma?
- La app guarda una **foto del cuestionario médico en papel**. ¿Eso convierte
  a Seven Seas en tratante de datos de salud, con las obligaciones reforzadas
  que eso implica (GDPR art. 9 y equivalentes)?
- ¿Alcanza con la advertencia que ya muestra la app ("la exigibilidad de las
  firmas digitales varía según el país; consultá a un abogado local") o hace
  falta algo más formal, como una aceptación explícita registrada?

### 2. 🔴 Datos de menores

**Dónde:** Privacidad, sección 6. Términos, sección 6.

Los centros de buceo atienden menores, y la app tiene un flujo específico de
firma por padre o tutor. O sea, **se recopilan datos de menores de forma
deliberada y estructural**, no accidental.

**Lo que hay que confirmar:**
- Obligaciones bajo GDPR (art. 8), COPPA si hay huéspedes estadounidenses, y
  la ley argentina 25.326.
- ¿Basta con el consentimiento del tutor capturado en la misma pantalla?
- ¿Hay que limitar la edad mínima, o registrar la verificación del vínculo?

### 3. 🟠 Ley aplicable y jurisdicción

**Dónde:** Términos, sección 13.

Hoy dice, simplemente: *"Estos términos se rigen por las leyes de Argentina,
donde Seven Seas está radicado."*

**Lo que hay que confirmar:**
- ¿Es defendible frente a un cliente en Tailandia o México? ¿Conviene agregar
  una cláusula de jurisdicción exclusiva, o arbitraje?
- Si sale la ciudadanía española y la operación se muda a la UE, ¿qué cambia?
- ¿Conviene constituir una sociedad antes de tener clientes, o después?
  (Pregunta de negocio tanto como legal: hoy la responsabilidad es personal e
  ilimitada.)

### 4. 🟠 Limitación de responsabilidad

**Dónde:** Términos, sección 11.

El tope actual es *"lo que el comercio nos pagó en los 12 meses previos"*. Para
un cliente de Starter eso son **$948 dólares**.

**Lo que hay que confirmar:**
- ¿Ese tope es exigible en las jurisdicciones donde van a estar los clientes,
  o hay países donde un tope tan bajo se considera abusivo y se cae entero?
- ¿La exclusión de daños indirectos (reservas perdidas, pérdida de datos,
  interrupción del negocio) se sostiene en un contrato B2B?

### 5. 🟡 Rol frente a los datos: ¿encargado o responsable?

**Dónde:** Privacidad, secciones 1, 4 y 5. Términos, sección 5.

Los documentos dicen que Seven Seas actúa como **encargado del tratamiento**
(*data processor*) de los datos de huéspedes, y que el centro es el
responsable.

**Lo que hay que confirmar:**
- ¿Es correcta esa caracterización, dado que Seven Seas decide cómo se
  estructuran y se guardan los datos?
- Si lo es: bajo GDPR hace falta un **contrato de encargo de tratamiento
  (DPA)** con cada cliente. Hoy no existe ninguno. ¿Hay que armarlo?
- Sub-encargados declarados: Supabase, Render, Resend. Paddle figura como
  responsable independiente de los datos de facturación. ¿Está bien esa
  distinción?
- Transferencias internacionales (Privacidad, sección 10): los datos salen de
  la UE. ¿Hacen falta cláusulas contractuales tipo?

### 6. 🟡 Retención y borrado

**Dónde:** Privacidad, sección 5. Términos, sección 9.

Al cerrar una cuenta, los registros (exenciones, checklists, historial de
viajes) **se conservan, no se borran** — a propósito, por si el centro los
necesita en un juicio o ante un seguro.

**Lo que hay que confirmar:**
- ¿Cómo se concilia con el derecho de supresión (GDPR art. 17)?
- ¿Cuánto tiempo es defendible conservarlos? ¿Hay que fijar un plazo máximo?

### 7. 🟢 Reembolsos y consumidores

**Dónde:** Política de Reembolsos, secciones 3 y 4.

Hoy: sin reembolso retroactivo por tiempo ya usado; los casos puntuales se
resuelven uno por uno.

**Lo que hay que confirmar:**
- Se vende a empresas, pero algunos clientes van a ser monotributistas o
  personas físicas. ¿Les aplica la normativa de defensa del consumidor (por
  ejemplo el derecho de desistimiento de 14 días de la UE)?
- Paddle, como *merchant of record*, ¿asume esa obligación, o queda en Franco?

---

## Lo que NO hace falta revisar

- La redacción general y el tono: están pensados para que se entiendan.
- La traducción al español: la hizo un hablante nativo.
- Los precios y las bandas por bote: es una decisión comercial, no legal.

---

## Aviso que ya está publicado

Las tres páginas muestran arriba de todo, en los dos idiomas, un recuadro que
dice que están siendo revisadas por un abogado y que no reemplazan
asesoramiento profesional. **Es deliberado y debe quedar hasta que esta
revisión efectivamente ocurra.** Cuando ocurra, sacarlo.

---

## Presupuesto y expectativa

Esto no es un encargo de "redactar términos de SaaS desde cero". Es una
**revisión de documentos existentes** con foco en siete puntos concretos. Un
abogado de tecnología debería poder darte una devolución útil en dos o tres
horas de trabajo.

Los puntos 1 y 2 —exenciones y menores— son los que justifican pagar la
consulta. El resto se puede vivir un tiempo más sin resolver. Un accidente de
buceo con una exención firmada en tu app, no.
