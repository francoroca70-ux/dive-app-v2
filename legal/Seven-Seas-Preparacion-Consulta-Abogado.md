# Seven Seas — Preparación para la Consulta con el Abogado

*Preguntas a plantear, ordenadas aproximadamente según qué tan fundamentales/complejas son — más una lista de los documentos que deberían salir de esta consulta. Preparado para Fran Roca, julio 2026.*

Esto no es asesoramiento legal — es una lista de trabajo de lo que hay que plantearle a tu abogado, armada a partir de todo lo que hace Seven Seas hoy (reservas, exenciones digitales, gestión de tripulación, inventario de equipo) más lo que viene (cobro de suscripción con débito automático de tarjeta, clientes en distintos países). Las secciones están ordenadas para que las preguntas fundacionales (estructura societaria) vayan primero, ya que condicionan cómo se responden las demás.

## 1. Estructura y Constitución del Negocio

*Fundacional — esto afecta cómo te registrás impositivamente, qué protección de responsabilidad tenés realmente, y cómo podés cobrar pagos internacionales de forma legal. Conviene resolverlo antes que las demás secciones.*

1. Estoy radicado en Argentina pero vendiendo software a clientes que pueden estar en cualquier parte (centros de buceo en EE.UU., UE, Asia-Pacífico). ¿Tiene más sentido constituir una sociedad en Argentina (por ejemplo una S.A.S.), armar una entidad en el extranjero (por ejemplo una LLC en EE.UU.), o necesito ambas?
2. ¿Usar Stripe (o cualquier procesador de pagos) para cobrarle a clientes internacionales requiere que esté constituido en un país específico, o que tenga una cuenta bancaria en una moneda/región específica?
3. ¿Cuáles son las implicancias de residencia fiscal y de declaración de impuestos de manejar este negocio mientras sigo el trámite de la ciudadanía española y vivo de forma semi-nómade?
4. ¿Una sola entidad cubre las ventas a clientes de todos los países, o hay países que exigen inscripción local una vez que tengo clientes ahí?
5. ¿Debería la empresa (una vez constituida) ser titular de la marca, del copyright del código y del nombre Seven Seas — o debería ser yo el titular de la propiedad intelectual y licenciársela a la empresa? ¿Cuál me protege mejor si algo sale mal?
6. Dado que estoy en etapa pre-ingresos/ingresos iniciales, ¿existe una estructura societaria mínima viable para arrancar ahora, con un punto de referencia claro (por ejemplo un umbral de facturación) para cuando convenga pasar a algo más robusto?

## 2. Responsabilidad Civil, Exenciones de Responsabilidad y Riesgo del Producto

*La sección de mayor riesgo — Seven Seas se usa para registrar checklists de seguridad de buceo reales y exenciones de responsabilidad. Si algo sale mal en una inmersión real, la exposición legal está acá.*

1. La app es una herramienta de registro para checklists previos a la inmersión, inspecciones de equipo y exenciones de responsabilidad — no certifica buzos ni toma decisiones de seguridad. ¿Qué lenguaje de descargo de responsabilidad / limitación de responsabilidad deja clara esa distinción de forma defendible en los Términos de Servicio?
2. Argentina reconoce firmas electrónicas escalonadas bajo la Ley 25.506 — las firmas electrónicas simples son válidas pero tienen menor peso probatorio que una firma digital certificada. ¿La firma de exenciones actual de Seven Seas (firma tipeada/dibujada más marca de tiempo) alcanza el estándar para sostenerse en un juicio si demandan a un centro de buceo, tanto en Argentina como en los otros países donde puedan operar los centros?
3. Si un buzo se lesiona o muere y el centro de buceo usó Seven Seas para registrar su exención o checklist previo a la inmersión, ¿podría Seven Seas terminar siendo parte demandada en la demanda resultante? ¿Qué lenguaje contractual o estructura protege realmente contra eso?
4. Si un centro de buceo se salta un paso obligatorio del checklist, o un miembro de la tripulación usa mal la app, y algo sale mal — ¿eso traslada toda la responsabilidad al centro de buceo, o hay algún escenario donde Seven Seas sigue expuesta?
5. Se recolectan datos de menores (fecha de nacimiento, firma del tutor) para las exenciones — ¿eso genera algún requisito adicional de consentimiento o responsabilidad más allá de lo que ya está construido?
6. ¿Cuál es el lenguaje correcto de "tal cual, sin garantía" para una herramienta donde un error, una demora de sincronización o una caída del servicio podría en teoría afectar un flujo de trabajo real de seguridad crítica (por ejemplo, el modo offline sincronizando una exención después de que la inmersión ya ocurrió)?

## 3. Cobro de Suscripciones, Renovación Automática y Cumplimiento en Pagos

*Concreto y urgente — estoy por construir el cobro recurrente automático (Stripe), con una prueba gratuita que se convierte automáticamente en pago, un recordatorio por email ante un pago fallido, y un período de gracia de 3 días antes de cortar el acceso.*

1. ¿Qué avisos son legalmente obligatorios cuando se le cobra automáticamente a la tarjeta de un cliente de forma recurrente, especialmente cuando una prueba gratuita se convierte automáticamente en pago? Varias jurisdicciones (las reglas de "click to cancel" de la FTC en EE.UU., las reglas de derechos del consumidor de la UE) tienen requisitos específicos acá.
2. ¿Un período de gracia de 3 días después de un pago fallido — recordatorio por email el día 1, corte de acceso el día 4 si sigue sin resolverse — es legalmente suficiente, o hay jurisdicciones que exigen un aviso más largo antes de suspender el acceso de un cliente pago a sus propios datos de negocio?
3. ¿Qué tiene que decir la política de reembolsos/cancelación, y necesita variar según la región (los consumidores de la UE en general tienen derechos de reembolso más fuertes que los de EE.UU. — aunque esto podría ser más liviano ya que mis clientes son empresas, no consumidores individuales)?
4. Si se cancela una suscripción por falta de pago, ¿estoy obligado a igual permitirle al centro de buceo exportar sus datos (listas de huéspedes, exenciones, bitácoras de buceo) antes de borrarlos, o el acceso se puede cortar directamente?
5. ¿Esto necesita un Acuerdo de Suscripción/Facturación independiente, o puede vivir como una sección dentro de los Términos de Servicio principales?
6. Si uso Stripe directamente (no una plataforma merchant-of-record), ¿qué responsabilidad sigo teniendo por disputas de facturación o contracargos como vendedor registrado?

## 4. Privacidad de Datos, Seguridad y Datos Transfronterizos

*Genuinamente complejo dada la dispersión de clientes — la app recolecta nombres de huéspedes, teléfonos, fechas de nacimiento, niveles de certificación y respuestas tipo cuestionario médico de buceo, alojados en infraestructura (Supabase, Resend) que puede estar en un país distinto al mío o al de mis clientes.*

1. Parte de los datos recolectados (respuestas del cuestionario médico/de aptitud para bucear) podrían considerarse datos sensibles/de categoría especial bajo el RGPD. ¿Qué protecciones adicionales, lenguaje de consentimiento o reglas de manejo dispara eso?
2. Mis proveedores de infraestructura son Supabase (base de datos) y Resend (email) — ¿necesito un Acuerdo de Tratamiento de Datos formal que los nombre como subencargados, y es algo que mis clientes (empresas chicas) realmente van a pedir, o es más bien una preocupación de escala empresarial?
3. ¿Dónde están alojados físicamente los datos de mis clientes, y eso importa para clientes en la UE bajo las expectativas de residencia de datos del RGPD, o para clientes en otras regiones con sus propias reglas de localización de datos?
4. Mi contrato directo es con el centro de buceo, no con el buzo — ¿qué derechos tiene el huésped final (el buzo cuyos datos están en el sistema), y quién es responsable de garantizarlos, yo o el centro de buceo?
5. ¿La página de aterrizaje/marketing necesita una Política de Cookies separada de la Política de Privacidad de la app?
6. ¿Qué obligaciones de notificación de brechas de seguridad aplicarían si alguna vez se expusieran datos de clientes, y varían según en qué países estén mis clientes?

## 5. Propiedad Intelectual y Marca

*Ya en marcha parcialmente — el registro de marca y el registro de copyright de software en DNDA ya están en mi lista — pero vale la pena confirmar el alcance directamente con vos.*

1. ¿La marca "Seven Seas" debería registrarse solo en Argentina, o tiene sentido registrarla internacionalmente (por ejemplo vía el Protocolo de Madrid) dado que los clientes pueden estar en cualquier lugar?
2. ¿Qué protege realmente el registro de copyright de software en DNDA, y es suficiente por sí solo — o debería también pensar en protección de secreto comercial para cosas como la lógica de precios/reservas?
3. Si Seven Seas usa bibliotecas de código abierto, ¿hay alguna obligación de divulgación o cumplimiento de licencia que deba tener en cuenta?
4. ¿Quién es titular del contenido que un centro de buceo sube a la plataforma (su logo, fotos, texto de checklist personalizado) — el centro de buceo, o Seven Seas, una vez que está en el sistema?

## 6. Seguros y Transferencia de Riesgo

*La última capa — una vez resueltos la entidad, el lenguaje de responsabilidad y la propiedad intelectual, ¿hace falta asegurar el riesgo en sí?*

1. Dado que el producto toca el registro real de seguridad de buceo, ¿debería tener un seguro de responsabilidad profesional / errores y omisiones, y por separado un seguro de responsabilidad cibernética, antes de que esto esté completamente en vivo para clientes pagos?
2. ¿Existe una configuración de seguro mínima viable apropiada para un fundador solo en etapa pre-ingresos/ingresos iniciales, con un punto claro (facturación, cantidad de clientes o alcance geográfico) a partir del cual conviene ampliar la cobertura?

## Documentos que Deberían Salir de Esta Consulta

La lista de papeles que esta consulta debería producir o aprobar — aproximadamente en el orden en que necesitarían existir antes de que los centros de buceo empiecen a pagar.

1. **Términos de Servicio** — la base legal — uso aceptable, términos de suscripción/facturación, limitación de responsabilidad, terminación por falta de pago, resolución de disputas/ley aplicable
2. **Política de Privacidad** — qué datos se recolectan, para qué, con quién se comparten (subencargados), cuánto tiempo se conservan, y cómo alguien puede solicitar sus datos
3. **Lenguaje de descargo de responsabilidad de exenciones** — texto específico que aclare que Seven Seas es una herramienta de registro, no una autoridad certificadora o de seguridad — probablemente se integra a los Términos de Servicio pero vale la pena redactarlo de forma deliberada
4. **Términos de Suscripción y Facturación** — aviso de renovación automática, conversión de prueba gratuita a pago, política de reembolso/cancelación, período de gracia antes de cortar el acceso — puede ser una sección de los Términos de Servicio o un documento aparte
5. **Política de Cookies** — para la página de aterrizaje/marketing
6. **Plantilla de Acuerdo de Tratamiento de Datos (DPA)** — para tener lista si/cuando un cliente centro de buceo la pida
7. **Registro de marca** — nombre y logo "Seven Seas" — ya en mi lista de tareas, confirmar acá el alcance (solo Argentina vs. internacional)
8. **Registro de copyright de software en DNDA** — ya en mi lista de tareas — confirmar que cubre lo que pensamos que cubre

---

*No es asesoramiento legal — es una lista de preparación para aprovechar al máximo el tiempo pago con un abogado. Armada a partir del estado actual de la app Seven Seas a julio de 2026.*
