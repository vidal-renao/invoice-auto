# SDD-003 · Motor fiscal multi-jurisdicción

**Estado:** vigente · **Fecha:** 2026-10-01 · **Alcance:** validación de
impuestos en facturas recibidas y derivación de impuestos en las emitidas

## Problema

El IVA no es un número: depende del país, del tipo de operación, de si el
cliente es empresa o particular, de si su NIF-IVA está validado y de si quien
factura es profesional. Equivocarse no es un bug de presentación: es una
liquidación mal hecha.

Dos usos distintos del mismo conocimiento:

- **Recibidas**: comprobar que lo que pone el documento es coherente.
- **Emitidas**: decidir qué poner, sin preguntárselo al usuario.

## Decisión

Un único cuadro de jurisdicciones (`src/lib/tax/config.ts`) con 16 países: sus
tipos legales de IVA, el tipo general, el formato del identificador fiscal, la
divisa y si pertenecen al área de IVA de la UE.

Encima, dos capas de funciones puras:

**Validación** (`src/lib/tax/validation.ts`)
- `detectCountryFromTaxId` — deduce el país a partir del identificador.
- `validateVatMath` — recalcula base × tipo y lo compara con lo impreso.
- `detectReverseCharge` — reconoce la inversión del sujeto pasivo en el texto.

**Derivación** (`src/lib/billing/treatment.ts`)

`decideTaxTreatment(emisor, cliente, tipoOpcional)` devuelve el caso fiscal, el
tipo de IVA, la retención, el recargo, **las menciones legales obligatorias** y
**los motivos de cada decisión**. Cinco casos:

| Caso | Cuándo | Resultado |
|---|---|---|
| `domestic` | Mismo país | IVA del emisor |
| `eu_reverse_charge` | Empresa de otro país UE **con VIES validado** | IVA 0 + mención del art. 196 |
| `eu_consumer` | Particular de otro país UE | IVA del emisor |
| `export` | Fuera de la UE, en cualquiera de los dos sentidos | Exenta |
| `domestic_exempt` | Reservado | — |

Más dos reglas españolas que son las que más se fallan a mano:

- **Retención de IRPF**: 15 %, o 7 % en los tres primeros años, y **solo**
  cuando el pagador es retenedor. A un particular no se le retiene.
- **Recargo de equivalencia**: 5,2 / 1,4 / 0,5 % emparejado con su tipo de IVA.

Tres decisiones de criterio:

1. **Sin VIES validado se cobra el IVA nacional.** Emitir sin IVA contra un
   NIF-IVA que no existe deja la deuda tributaria en quien factura. El sistema
   avisa en vez de asumir.
2. **Un tipo que no existe en el país se ignora**, se usa el general y se dice.
3. **Cada decisión viaja con su motivo.** Un cálculo fiscal que no se puede
   explicar no sirve ante una inspección, y tampoco genera confianza.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Un servicio externo de impuestos | Coste por operación, dependencia de red en un cálculo que debe ser determinista, y opacidad: no podríamos explicar el porqué |
| Que el usuario elija el tipo de IVA | Es exactamente el trabajo que el producto promete quitar, y donde se equivoca |
| Consultar VIES en tiempo real al emitir | Deseable, pero el servicio se cae a menudo; hoy la validación se marca a mano y queda fechada |

## Consecuencias

- **Bien**: 20 pruebas cubren los cinco casos, las dos retenciones, el recargo
  y los redondeos, incluida la reproducción al céntimo de una factura española
  real y una suiza al 8,1 %.
- **Bien**: añadir un país es una entrada en el cuadro.
- **Coste**: los tipos cambian por ley y hay que mantenerlos. El 8,1 % suizo es
  de 2024; el anterior era 7,7 %.
- **Riesgo asumido**: no cubre casos especiales —régimen de agencias de viaje,
  criterio de caja, operaciones triangulares—. El producto no los soporta y es
  mejor que no los invente.

## Lo que no cubre

- Consulta real a **VIES** y a la **AEAT**.
- **Prorrata** ni deducibilidad parcial del IVA soportado.
- Tipos **reducidos por producto**: hay que indicarlos a mano y solo se aceptan
  si son legales en ese país.
