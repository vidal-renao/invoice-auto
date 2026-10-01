# SDD-005 · Emisión de facturas

**Estado:** vigente · **Fecha:** 2026-10-01 · **Alcance:** clientes, series,
facturas emitidas y registro de facturación

## Problema

Emitir una factura legal correcta exige decidir una docena de cosas: serie y
número correlativo, tipo de IVA según el país y la condición del cliente,
inversión del sujeto pasivo, exportación exenta, retención de IRPF, recargo de
equivalencia, menciones legales y vencimiento.

El autónomo quiere escribir tres: a quién, qué y cuánto.

Y hay un segundo problema que condiciona el modelo: a partir del **1 de julio
de 2027**, el software que emita facturas en España debe ser un Sistema
Informático de Facturación conforme al RD 1007/2023, con registro encadenado e
inalterable. Construir ahora sin esa estructura significaría rehacerlo entero.

## Decisión

### Entidades propias, separadas de las recibidas

`invoices` son facturas **recibidas**. Las emitidas viven aparte porque tienen
otro ciclo de vida y valor probatorio:

```
bill_customers       país, tipo, NIF-IVA validado, condiciones de pago,
                     recargo de equivalencia  → de aquí sale lo fiscal
bill_series          numeración por serie y ejercicio, con bloqueo de fila
bill_invoices        la factura: importes en céntimos, caso fiscal,
                     menciones legales, estado
bill_invoice_lines   conceptos, cantidades en milésimas
bill_records         registro de facturación: cadena SHA-256, append-only
```

### Una sola función hace todo o no hace nada

`bill_issue_invoice(...)`, en una transacción:

1. Comprueba que el cliente es de quien emite.
2. Verifica que **las líneas suman la base** y que **el total cuadra con sus
   partes**. Los importes los calcula la aplicación con código probado; la base
   de datos los revalida y rechaza lo que no cuadre.
3. Reserva el siguiente número de la serie con la fila bloqueada hasta el
   commit: sin huecos y sin duplicados aunque se emitan dos a la vez.
4. Escribe factura y líneas.
5. Añade el registro encadenado: `sha256(hash_anterior || payload)`.

### Inmutabilidad

Una factura emitida **no se edita ni se borra**: se rectifica con otra. Lo
único que cambia es marcarla cobrada. `bill_records` rechaza `UPDATE` y
`DELETE` por trigger, y cada usuario tiene su propia cadena.

### El cálculo se ve antes de emitir

`previewInvoice` ejecuta en el servidor **el mismo código** que usará la
emisión y devuelve importes, menciones legales y **los motivos**. Una
previsualización que calculase por su cuenta podría mentir.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Reutilizar `invoices` con un campo `direction` | Mismo nombre para dos cosas con reglas opuestas: una se edita y se borra, la otra no puede |
| Calcular los importes en SQL | Duplicaría el motor fiscal en un lenguaje donde probarlo es mucho más caro |
| Numerar en la aplicación | Dos emisiones simultáneas se llevarían el mismo número; el hueco o el duplicado son una infracción |
| Guardar el PDF generado | El PDF se reconstruye a partir de los datos; guardar el binario añade almacenamiento y un sitio más donde desviarse. La impresión del navegador produce el documento |
| Esperar a la fase Verifactu para diseñar el registro | Rehacer el modelo después cuesta más que construirlo bien una vez |

## Consecuencias

- **Bien**: tres campos y la factura sale, con el tratamiento fiscal explicado.
- **Bien**: 10 pruebas contra Postgres real cubren numeración sin huecos,
  series independientes, rechazo de importes descuadrados, aislamiento entre
  usuarios e inalterabilidad de la cadena.
- **Bien**: la estructura que Verifactu exige ya está, lista para firma y envío.
- **Coste**: emitir pasa por una función SQL de cien líneas. Cambiarla exige
  entenderla; por eso está documentada aquí.

## Lo que no cubre — y es importante

**Esto todavía NO es un SIF conforme.** Falta:

- firma electrónica de cada registro según la Orden HAC/1177/2024,
- código QR de cotejo en la factura,
- envío de los registros a la AEAT (modalidad VERI\*FACTU),
- declaración responsable del fabricante.

**Hasta que eso exista, el producto no se puede anunciar como conforme a
Verifactu en España**: la sanción por usar software no conforme recae en el
usuario, no en el fabricante.

Tampoco cubre: facturas rectificativas (el campo `rectifies_id` existe pero no
el flujo), recurrentes, presupuestos convertibles en factura, QR-factura suiza
en la emisión, ni recordatorios de cobro.
