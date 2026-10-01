# SDD-004 · Motor de decisión de pagos

**Estado:** vigente · **Fecha:** 2026-10-01 · **Alcance:** decisión de pago por
factura, verificación de cuentas y generación de ficheros ISO 20022

Complementa [ADR-002](../adr/ADR-002-payment-decision-layer.md) y el
[modelo de amenazas](../threat-model-payments.md).

## Problema

Una factura aprobada es correcta. Eso no la convierte en un pago seguro.

El fraude por cambio de IBAN funciona así: llega un documento impecable, del
proveedor real, con los importes reales, y una cuenta distinta. En pymes
españolas la pérdida media ronda los 35.000 € y, después de pagar al estafador,
la deuda con el proveedor legítimo sigue viva.

Ningún programa de facturación para autónomos comprueba a quién se paga.

## Decisión

Un motor de decisión puro (`src/lib/payments/decision.ts`) que, para cada
factura, devuelve **pagar, revisar o detener** con los motivos. Las reglas:

| Regla | Resultado si falla |
|---|---|
| La factura está aprobada | Detener |
| Existe cuenta registrada para ese proveedor | Detener |
| La cuenta está **verificada por un canal independiente** | Detener |
| El IBAN impreso coincide con el de la cuenta verificada | Detener |
| El IBAN es válido (mod-97, longitud por país) | Detener |
| **QR-IBAN suiza con referencia QR de 27 dígitos**, y no una sin la otra | Detener |
| La ruta es compatible: SEPA en euros, doméstica suiza en francos | Detener |
| Fuera del periodo de enfriamiento de la cuenta (72 h por defecto) | Detener |
| Importe por debajo del umbral de doble revisión (10.000 € por defecto) | Revisar |
| No está ya programada ni pagada | Detener |

Y cuatro decisiones de diseño:

**1. Verificación fuera de banda, con prueba.** Una cuenta solo pasa a
verificada indicando el canal usado —llamada al número que ya se tenía, en
persona, carta firmada o confirmación bancaria— y con quién se habló. Queda en
el registro de auditoría.

**2. Periodo de enfriamiento.** Una cuenta recién verificada no se puede pagar
de inmediato: es la ventana donde el fraude aprieta con prisas.

**3. Las cuentas nacen desde una factura detenida.** No hay alta libre de
cuentas: toda cuenta está atada al documento que la introdujo.

**4. Nada se escribe desde el cliente.** Ocho funciones `SECURITY DEFINER`
(`pay_*`) revalidan la invariante, escriben el estado y añaden la entrada de
auditoría **en la misma transacción**. `pay_require_user()` toma `auth.uid()`
y nunca un parámetro. `pay_audit_log` es append-only por trigger.

La salida es un fichero **ISO 20022 pain.001** que la persona lleva a su banco.
El sistema no mueve dinero, no tiene credenciales bancarias y no ejecuta
transferencias: la orden final la da siempre la persona, en su banco.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Integración directa con el banco (PSD2 / API bancaria) | Multiplica el impacto de un fallo: pasaríamos de recomendar a ejecutar. Y exige licencias y auditorías que hoy no tenemos |
| Confiar en el IBAN del documento | Es exactamente el vector del fraude |
| Verificar por correo electrónico | El correo es el canal comprometido en el fraude BEC: verificar por ahí es verificar con el estafador |
| Avisar en vez de detener | Un aviso se ignora cuando hay prisa; detener obliga a una decisión consciente |

## Consecuencias

- **Bien**: es lo único del producto que ningún competidor ofrece, y se puede
  demostrar sin registrarse, en `/es/demo/payments`, con el motor real.
- **Bien**: el audit log inmutable sirve de prueba si algo se discute.
- **Coste**: fricción deliberada. La primera vez que se paga a un proveedor
  hay que verificar y esperar. Es el punto del producto, pero hay que
  explicarlo o se percibe como un estorbo.
- **Riesgo**: 72 h y 10.000 € son configurables; un usuario puede bajarlos
  hasta volverlos inútiles. No se impide, pero queda registrado.

## Lo que no cubre

- **Conciliación bancaria** (camt.053/054): se genera la orden, no se lee el
  extracto para confirmarla.
- **Pagos fuera de SEPA y Suiza**.
- **Domiciliaciones** (pain.008) ni pagos recurrentes.
- Validación del IBAN **contra el banco**: se comprueba estructura y dígitos de
  control, no que la cuenta exista ni su titular.
