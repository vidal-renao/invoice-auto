# SDD-002 · Captura de documentos y extracción

**Estado:** vigente · **Fecha:** 2026-10-01 · **Alcance:** subida de tickets y
facturas recibidas, y extracción de sus datos con Claude Vision

## Problema

Meter un gasto a mano son dos minutos y un error de tecleo. El usuario quiere
hacer una foto y olvidarse. El documento puede ser una foto torcida de un
ticket térmico, un PDF de texto o una captura de pantalla, en cualquiera de las
16 jurisdicciones soportadas.

## Decisión

```
Navegador                                  Servidor
  │ comprime la imagen (máx 1600 px, JPEG 0.85)
  │ sube directo a Supabase Storage      ← el binario no pasa por el servidor
  ├──────────────────────────────────────►
  │ createInvoiceRecord(path, nombre)
  ├──────────────────────────────────────► fila en `invoices`, estado `pending`
  │ analyzeReceipt(id)
  └──────────────────────────────────────► URL firmada → Claude Vision
                                           → tool use con esquema JSON
                                           → motor fiscal valida
                                           → estado `approved` o `review_needed`
```

**La compresión y la subida ocurren en el navegador.** El binario no viaja en
el payload de una Server Action: evita el límite de tamaño y el coste de pasar
megas por la función.

**Extracción con `tool use`, no con texto libre.** El esquema JSON declara 22
campos con sus tipos y descripciones, incluidos `payment_iban` y
`payment_reference` para el motor de pagos. Pedir JSON en prosa y parsearlo es
frágil; una herramienta tipada no.

**El fallo es un estado, no una excepción.** Si el documento no es una factura,
está borroso o la extracción revienta, la fila queda en `review_needed` con el
motivo. Nunca se pierde el documento, y la persona decide.

**Tiempo de espera de 45 segundos**, con `maxDuration = 60` en las rutas del
panel. Antes eran 8 segundos y **toda factura seria se abortaba a mitad**:
Claude Vision tarda entre 10 y 30 en una página completa. El `AbortController`
cancela la conexión HTTP de verdad, no solo la promesa, para que la función
pueda terminar y registrar el fallo.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| OCR clásico (Tesseract) + reglas | Falla con tickets térmicos, manuscritos y formatos variados; mantener reglas por país es inviable |
| Subir el fichero a través del servidor | Límite de payload y coste por invocación sin ninguna ventaja |
| Reintento automático al fallar | Multiplica el gasto de API en bucle; además el estado `review_needed` ya permite reintentar a mano |
| Guardar solo el texto extraído | El documento original es la prueba ante una inspección |

## Consecuencias

- **Bien**: el usuario hace una foto y el sistema devuelve proveedor, NIF,
  base, IVA, total, IBAN y referencia de pago.
- **Bien**: un fallo no bloquea nada; la factura queda visible con su fecha de
  subida y su nombre de archivo, que es por lo que la persona la reconoce.
- **Coste**: cada extracción es una llamada de pago a la API de Anthropic.
- **Riesgo**: la precisión depende del modelo. Por eso el motor fiscal
  **recalcula** el IVA en vez de fiarse, y por eso nada se aprueba
  automáticamente sin confianza alta.

## Lo que no cubre

- **Subida por correo** (reenviar una factura a una dirección del sistema), que
  es como llegan la mitad de las facturas reales.
- **Lectura del código QR suizo** desde la imagen: hoy se extrae la referencia
  del texto impreso, no decodificando el QR.
- **Detección de duplicados**: subir dos veces la misma factura crea dos filas.
