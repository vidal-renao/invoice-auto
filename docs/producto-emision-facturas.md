# Emisión de facturas: mercado, competencia y diseño de producto

**Fecha del análisis:** 28 de septiembre de 2026 · **Mercados:** España (autónomos) y Suiza (Selbstständige)
**Encargo:** añadir a Invoice Auto la creación de facturas, no solo su captura, con el mínimo de datos posible.

---

## 1. La respuesta incómoda primero

**Lo más fácil hoy para un autónomo español no cuesta dinero: lo regala Hacienda.**

Desde octubre de 2025, la AEAT ofrece su propia [aplicación gratuita de facturación VERI\*FACTU](https://sede.agenciatributaria.gob.es/Sede/todas-noticias/2025/octubre/13/aplicacion-gratuita-facturacion-verifactu.html): sin instalación, **sin límite de facturas** —ni anual, ni mensual, ni semanal—, con el QR obligatorio, el cálculo de impuestos y el envío automático de los registros a la Agencia Tributaria. Solo pide certificado digital, Cl@ve o DNIe.

Sus limitaciones son reales: está pensada para necesidades básicas, no para volumen alto ni contabilidad compleja, y no hay app móvil, ni recurrentes, ni presupuestos, ni seguimiento de cobro. Pero el listón queda fijado: **"emitir una factura legal" ya no es un problema por el que un autónomo español pague.**

Por debajo de eso, el suelo comercial: [Billin desde 6,60 €/mes](https://www.billin.net/blog/mejores-programas-facturacion/) con pago anual, Contasimple con plan gratuito de 3 facturas al mes, [Quipu desde 9,50 €/mes](https://getquipu.com/blog/mejores-10-programas-de-facturacion-gratis-y-pagos/), Holded desde 15 €.

Y por encima, lo que de verdad pagan: **una gestoría, entre [80 y 130 €/mes](https://www.billeo.es/blog/gestoria-precios)**, que usan más de tres millones de autónomos solo para cumplir con Hacienda.

> **Consecuencia para el plan:** construir "otro creador de facturas" es entrar en un mercado cuyo precio suelo es cero y cuyo líder de facto es la Agencia Tributaria. El módulo de emisión hay que construirlo —sin él no hay producto completo— pero **no puede ser la propuesta de valor.** Es la entrada, no el destino.

---

## 2. El dolor real, medido

Lo que sí duele, con cifras de este año:

| Dato | Fuente |
|---|---|
| **226 horas al año** en trámites administrativos por autónomo — casi un mes de trabajo | [Forbes España / ATA, agosto 2026](https://forbes.es/ultima-hora/997277/los-autonomos-dedican-226-horas-al-ano-a-tramites-administrativos-con-un-coste-superior-a-11-000-millones/) |
| **4 horas semanales** mínimo dedicadas a la Administración, sobre jornadas de 47 h | ATA |
| **11.000 millones de euros** de coste anual agregado del papeleo | ATA |
| **40,7 %** de los autónomos pone "reducir burocracia" como prioridad número uno | ATA |
| **3.300 €/año** de coste por trámites burocráticos por autónomo | [Autónomos y Emprendedor](https://www.autonomosyemprendedor.es/articulo/info-ata/ata-denuncia-que-autonomos-pierden-mas-3000-euros-costes-tramites-burocraticos/20260810150741055355.html) |

El dolor no es "escribir una factura". Es **el ciclo completo**: emitir, perseguir el cobro, guardar el gasto, pagar al proveedor, cuadrar el trimestre y no equivocarse con Hacienda. Cada competidor cubre un trozo y deja costuras; el autónomo las cose a mano, cuatro horas por semana.

---

## 3. La regulación no es un detalle: es el calendario del producto

### 3.1 Verifactu — obliga, y con multa al usuario

El [Real Decreto 1007/2023](https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840) fija los requisitos de los Sistemas Informáticos de Facturación (SIF). Tras la prórroga del RD-ley 15/2025, el calendario vigente es:

| Quién | Desde |
|---|---|
| Fabricantes de software: sistemas adaptados | **1 de julio de 2025** (ya vencido) |
| Contribuyentes de Impuesto sobre Sociedades | **1 de enero de 2027** |
| **Autónomos en IRPF** y resto de obligados | **1 de julio de 2027** |

Las sanciones alcanzan **50.000 € por ejercicio** por la mera tenencia o uso de software no conforme ([resumen de plazos](https://www.groupseres.com/sistema-verifactu-espana), [ANETAE sobre el aplazamiento](https://www.anetae.es/aplazamiento-de-la-entrada-en-vigor-de-verifactu-hasta-2027/)).

**Esto corta en los dos sentidos.** Es la oportunidad —tres millones largos de autónomos tienen que cambiar de herramienta antes de julio de 2027, una ventana que no se repite— y es la barrera: si emites facturas para clientes españoles con un software no conforme, **les expones a la multa a ellos**. No es un "lo pulimos en la v2".

### 3.2 Qué exige técnicamente ser un SIF

De la Orden HAC/1177/2024 y el reglamento, lo esencial:

- **Registro de facturación por cada factura**, en tabla propia, independiente de las líneas de venta, persistente e **inalterable**, con más de 35 campos obligatorios.
- **Huella SHA-256 encadenada**: cada registro incorpora el hash del anterior, de modo que alterar uno rompe la cadena y se detecta.
- **Firma electrónica** de cada registro según la Orden.
- **Código QR** en la factura: ISO/IEC 18004, nivel M, de 30×30 a 40×40 mm, codificando la URL de cotejo con NIF del emisor, serie y número, fecha e importe total.
- **Dos modalidades**: VERI\*FACTU (cada registro se remite a la AEAT en el momento de generarse) o no-VERI\*FACTU (se conservan y se entregan a requerimiento, con requisitos de conservación más duros).
- **Declaración responsable del fabricante**: un documento firmado por ti declarando que el software cumple el RD 1007/2023.

Fuentes: [ECIJA sobre cumplimiento SIF](https://www.ecija.com/actualidad-insights/cumplimiento-del-sif-y-verifactu-requisitos-plazos-y-estrategias-de-adaptacion/), [AGM Abogados, FAQ SIF y VERI\*FACTU](https://www.agmabogados.com/preguntas-frecuentes-sobre-sistemas-informaticos-de-facturacion-sif-y-verifactu/), [especificación del QR](https://www.reixmor.com/codigo-qr-verifactu-datos-validacion/).

> **La buena noticia**: tu motor de pagos ya tiene exactamente la disciplina que esto exige —registro append-only, huella, invariantes revalidadas en la propia base de datos—. La arquitectura de `pay_audit_log` es la plantilla mental correcta para el registro de facturación.

### 3.3 Factura electrónica B2B — el segundo reloj

El [Real Decreto 238/2026, de 25 de marzo](https://www.sage.com/es-es/certificacion-software/ley-crea-y-crece/) desarrolla la Ley 18/2022 (Crea y Crece) y entró en vigor el 20 de abril de 2026. Obliga a que **toda factura entre empresas y autónomos españoles** sea electrónica y estructurada (Facturae o UBL como candidatos):

| Fase | Quién | Desde |
|---|---|---|
| 1 | Facturación > 8 M€/año | **octubre de 2027** |
| 2 | El resto, autónomos incluidos | **octubre de 2028** |

Los plazos empiezan a contar desde una orden ministerial que regula la solución pública de intercambio. **Verifica su publicación antes de planificar**: es la pieza que fija las fechas definitivas.

Son dos obligaciones distintas que la gente confunde: Verifactu regula **cómo se genera y registra** la factura; Crea y Crece, **en qué formato se intercambia** y por dónde viaja.

### 3.4 Suiza: otra liga, más simple

Sin obligación de factura electrónica ni equivalente a Verifactu. Lo que sí es obligatorio desde el 30 de septiembre de 2022 es la **QR-factura**: toda factura suiza lleva su Zahlteil con Swiss QR Code, y la QR-IBAN con referencia de 27 dígitos es lo que permite la conciliación automática. Emitir en Suiza = generar QR-facturas correctas. Ya validas ese formato al leerlo; generarlo es el mismo estándar del revés.

---

## 4. La competencia, comparada por lo que decide una venta

| | Invoice Auto (hoy) | App AEAT | Billin / Quipu | Holded | bexio (CH) | Magic Heidi / Billify (CH) |
|---|---|---|---|---|---|---|
| Emitir factura legal | **No** | Sí, gratis | Sí | Sí | Sí | Sí |
| Verifactu | — | Nativo | Sí | Sí | n/a | n/a |
| Captura de gastos con IA | **Sí, central** | No | Extra de pago | Sí | Extra desde ~42 CHF | Sí (Billify) |
| Multi-jurisdicción ES+CH | **Sí, 16 países** | Solo ES | Solo ES | Solo ES | Solo CH | Solo CH |
| QR-factura suiza | Lee y valida | No | No | No | Sí | Sí |
| **Decisión de pago con verificación de IBAN** | **Sí, único** | No | No | No | No | No |
| Fichero SEPA pain.001 | **Sí** | No | Parcial | Sí | Sí | No |
| Registro de auditoría inmutable | **Sí** | Sí (AEAT) | No expuesto | No | No | No |
| Precio | Beta gratis | **0 €** | 6,60–30 €/mes | 15–199 €/mes | 35–119 CHF/mes | 14,90–15 CHF/mes |

Fuentes de precios: [comparativa española](https://rankiabusiness.com/mejores-programas-facturacion/), [alternativas suizas a bexio](https://erplight.ch/vergleich/bexio-alternative.html), [subida de precios de bexio en 2026](https://pfeffersack.ch/blog/bexio-preiserhoehung-2026-alternativen).

**Dos lecturas que mandan sobre el diseño:**

1. **La fila que nadie más tiene llena es la de pagos.** El fraude por cambio de IBAN en facturas crece en España, con pérdidas medias de **35.000 €** por incidente y la deuda con el proveedor legítimo intacta después de pagar al estafador ([INCIBE](https://www.incibe.es/empresas/blog/fraude-del-ceo-el-engano-que-puede-vaciar-la-cuenta-de-tu-pyme), [Banco de España](https://clientebancario.bde.es/pcb/es/blog/cuidado-con-las-estafas-a-la-hora-de-pagar-una-factura.html)). Ningún programa de facturación para autónomos comprueba a quién estás pagando. Tú ya lo haces.

2. **Nadie cubre España y Suiza a la vez.** Los españoles ignoran la QR-factura; los suizos ignoran el IVA español y Verifactu. Un autónomo español con clientes suizos —o un español afincado en Basilea— hoy necesita dos programas. Es un nicho estrecho, pero es *tu* nicho: lo vives.

---

## 5. El producto: cómo debe sentirse emitir una factura

Tu encargo —"con poner unos pocos datos que se autogenere y se calcule"— es correcto y se puede llevar más lejos de lo que hacen los demás, porque tú ya tienes el motor fiscal.

### 5.1 El flujo de tres campos

```
Cliente  →  Concepto  →  Importe  →  [Emitir]
```

Todo lo demás se deriva, y esto es lo que ningún competidor hace del todo:

| Dato | De dónde sale, sin preguntar |
|---|---|
| Número y serie | Correlativo por serie y ejercicio, sin huecos (lo exige el reglamento) |
| Fecha de expedición | Hoy |
| Vencimiento | Condiciones guardadas del cliente (30/60 días…) |
| **Tipo de IVA** | País del cliente + tipo de operación, desde tu motor de 16 jurisdicciones |
| **Inversión del sujeto pasivo** | Cliente empresa de otro país UE con VAT válido → 0 % + mención legal automática |
| **Exportación** | Cliente fuera de la UE → exenta, con la mención correspondiente |
| **Retención de IRPF** | Autónomo profesional español facturando a empresa española → 15 % (7 % los tres primeros años). **Este es el campo que más se equivoca a mano** |
| Recargo de equivalencia | Si el cliente lo tiene marcado |
| Datos del emisor | Perfil |
| QR Verifactu | Generado al emitir |
| QR-factura suiza | Si el emisor es suizo o cobra en CHF |

El autónomo escribe tres cosas. El sistema decide otras diez y **explica cada una** —igual que el motor de pagos explica por qué detiene—, porque un cálculo fiscal que no se puede auditar no vale para nada frente a una inspección.

### 5.2 Lo que hay que modelar (y no existe hoy en el repo)

Hoy `invoices` son **facturas recibidas** (gastos). Y la sección "Clientes" en realidad lista *proveedores*: usa `vendors`. Emitir necesita conceptos nuevos:

```
customers            clientes reales: NIF/VAT, país, dirección, condiciones
                     de pago, retención aplicable, idioma de la factura

issued_invoices      serie, número, ejercicio, fechas, cliente,
                     divisa, totales en céntimos enteros, estado
                     (borrador → emitida → cobrada / vencida / rectificada)

issued_invoice_lines descripción, cantidad, precio unitario, tipo de IVA,
                     retención, importes calculados

billing_records      registro de facturación Verifactu: append-only,
                     SHA-256 encadenado, firma, estado de envío a AEAT.
                     Mismo patrón que pay_audit_log

series               numeración por serie y ejercicio, con bloqueo para
                     que dos facturas simultáneas no compartan número
```

Reglas duras que el esquema debe imponer, no la interfaz:

- **Una factura emitida no se edita ni se borra.** Se rectifica con otra factura. El reglamento lo exige y tu audit log ya trabaja así.
- **Numeración sin huecos** por serie y ejercicio, garantizada en base de datos.
- **El registro de facturación se genera en la misma transacción** que la factura, o no se genera ninguno.

### 5.3 Lo que cierra el círculo (y es donde ganas)

Una vez emites, el resto del ciclo ya casi lo tienes:

- **Cobro**: enlace de pago o QR-factura en el PDF; marcar cobrada; recordatorios automáticos al vencimiento.
- **Conciliación**: la referencia QR suiza o la referencia SEPA permiten casar el cobro con el extracto.
- **El trimestre**: emitidas + recibidas + IVA repercutido y soportado = el 303 casi hecho. Aquí es donde compites con la gestoría de 100 €/mes, no con Billin de 7 €.
- **Pagos salientes**: ya funciona, y es tu diferencial.

---

## 6. Lo que NO hay que construir

Tan importante como lo anterior:

- **Contabilidad completa por partida doble.** Es el terreno de Holded y bexio, con años de ventaja y auditorías detrás. Integra con la gestoría en lugar de sustituirla.
- **CRM, proyectos, inventario, nóminas.** El "todo en uno" es la trampa que convierte productos buenos en productos mediocres.
- **Competir por precio con la app de la AEAT.** Es gratis e ilimitada. No hay fondo en esa carrera.
- **Emisión en España sin ser SIF conforme.** Antes de la primera factura emitida a un cliente español, la declaración responsable tiene que estar firmada. Sin eso, no se lanza.

---

## 7. Fases, con lo que ya existe

**Fase 1 — Emitir, sin España (4–6 semanas).**
Modelo de datos, flujo de tres campos, PDF, QR-factura suiza, clientes, series. Mercado inicial: suizos y facturación intracomunitaria, donde no hay Verifactu de por medio. Permite validar el producto sin el riesgo regulatorio.

**Fase 2 — SIF conforme para España (8–12 semanas, la más dura).**
Registro de facturación encadenado, firma, QR de cotejo, envío a la AEAT, modo VERI\*FACTU, declaración responsable. Objetivo de calendario: **operativo mucho antes de julio de 2027**, porque la migración masiva ocurre en los meses previos y quien llegue después llega a un mercado ya repartido.

**Fase 3 — El círculo cerrado.**
Cobros, recordatorios, conciliación, borrador del 303. Es el punto en el que un autónomo puede plantearse sustituir parte de lo que hoy paga a la gestoría.

**Fase 4 — Canal.**
Las gestorías son el distribuidor natural: cada una lleva decenas de autónomos y todas tienen que migrarlos antes de 2027. Un panel multi-cliente para gestorías vende más que cien anuncios.

---

## 8. Precio y posicionamiento

La honestidad manda aquí: **no compitas donde el suelo es cero.**

| Plan | Precio | Contenido |
|---|---|---|
| Free | 0 € | Emitir hasta X facturas/mes + captura de gastos. Compite con la app de la AEAT en comodidad, no en precio |
| Pro | 12–19 €/mes | Ilimitado, multi-jurisdicción, recurrentes, recordatorios de cobro |
| **Pagos** | +15–25 €/mes | El motor de decisión: verificación de IBAN, referencia QR, pain.001, audit log. **Aquí está el margen, porque no existe alternativa** |
| Gestorías | por cliente gestionado | Panel multi-cliente |

El argumento de venta no es "haz facturas". Es: *"de las 226 horas al año que pierdes en papeleo, te quito las que se van en facturar, guardar gastos y decidir pagos — y te aviso antes de que pagues a un IBAN que nadie ha verificado"*.

---

## 9. Riesgos, sin adornos

1. **Ser un SIF es una responsabilidad legal, no una funcionalidad.** Firmas una declaración responsable. Si tu software incumple, la multa se la come tu cliente y la reclamación te llega a ti. Esta fase necesita revisión de un asesor fiscal español, no solo código.
2. **La ventana de julio de 2027 se cierra.** La migración ocurre en los seis meses previos. Llegar en 2028 es llegar tarde.
3. **Instancia Supabase compartida.** Facturación emitida con valor probatorio no debería convivir con otros cuatro productos y registro abierto. Antes de la fase 2, instancia propia.
4. **Un solo desarrollador contra equipos de veinte.** La única defensa es el foco: el ciclo emitir→pagar hecho como nadie, en dos jurisdicciones, y ni un módulo más.
5. **La app de la AEAT puede mejorar.** Es gratuita y del Estado; si añade móvil y recurrentes, se come la franja básica entera. Otra razón para que tu valor viva por encima de "emitir".

---

## 10. Lo que decides tú, no yo

1. **¿España en la fase 1 o en la 2?** Entrar ya obliga a ser SIF desde el primer día; esperar te da producto validado pero menos margen hasta 2027.
2. **¿Autónomo español o suizo como usuario principal?** El producto cambia bastante: retenciones de IRPF y modelo 303 en un caso; QR-factura y MWST en el otro.
3. **¿Canal directo o gestorías?** Determina si lo siguiente que se construye es una landing o un panel multi-cliente.
4. **¿Instancia Supabase propia antes de emitir?** Mi recomendación es sí, y antes de la primera factura con valor legal.

---

## Auditoría de este análisis

**Comprobado de primera mano:**
- El calendario de Verifactu y su prórroga a 2027 aparece consistente en múltiples fuentes independientes, incluida la nota de la propia AEAT sobre su aplicación gratuita.
- La aplicación gratuita de la AEAT y sus características están tomadas de la [sede electrónica oficial](https://sede.agenciatributaria.gob.es/Sede/todas-noticias/2025/octubre/13/aplicacion-gratuita-facturacion-verifactu.html), no de terceros.
- El estado del repositorio: `invoices` son facturas recibidas, la sección "Clientes" lista `vendors`, no existe entidad de cliente, y la exportación a PDF devuelve 501 sin implementar. Verificado leyendo el código.
- Los precios de la competencia proceden de comparativas de 2026; los de bexio, de su propia subida de precios documentada.

**Corregido durante el análisis:**
- Iba a presentar el módulo de emisión como la propuesta de valor. Al encontrar la app gratuita e ilimitada de la AEAT, la tesis cambió: emitir es la entrada, el margen está en pagos y en el ciclo cerrado. Sin ese dato, el plan habría sido competir de frente con el Estado.
- En una búsqueda anterior de esta misma sesión leí que Verifactu obligaba en 2026; la fuente era antigua. El calendario vigente, tras el RD-ley 15/2025, es 2027.

**Contradicción sin resolver:**
- El precio de entrada de Quipu aparece como 9,50 €/mes en una fuente y 17 €/mes en otra, ambas de 2026. Probablemente sea precio anual frente a mensual, pero **no lo he verificado en su web**: si el precio importa para una decisión, confírmalo en origen.

**No verificado, y hay que hacerlo antes de construir:**
- Si la **orden ministerial** que fija los plazos de la factura electrónica B2B ya se ha publicado. De ella dependen las fechas de octubre de 2027 y 2028.
- El texto exacto de la **Orden HAC/1177/2024**: he trabajado con resúmenes de asesorías, no con el BOE. Los 35+ campos del registro y el formato de firma hay que leerlos del original antes de implementar.
- Si existe algún **proceso de homologación** de la AEAT más allá de la declaración responsable.
- Ninguna **entrevista con autónomos reales**. Todo el dolor aquí está medido en estadísticas agregadas (ATA), no en conversaciones. Antes de la fase 2, cinco entrevistas valen más que cinco semanas de código.
