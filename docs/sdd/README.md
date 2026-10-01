# SDD — Documentos de diseño de software

Cómo está construido Invoice Auto y **por qué así**. Un SDD por subsistema, y
cada uno responde a lo mismo: qué problema resuelve, qué alternativas había,
qué se decidió y qué consecuencias tiene.

No es documentación de API: para eso está el código. Es el sitio donde queda
escrito el razonamiento que, si no, se pierde.

## Índice

| Documento | Subsistema | Estado |
|---|---|---|
| [SDD-001](SDD-001-arquitectura.md) | Arquitectura general y límites del sistema | Vigente |
| [SDD-002](SDD-002-captura-y-extraccion.md) | Captura de documentos y extracción con IA | Vigente |
| [SDD-003](SDD-003-motor-fiscal.md) | Motor fiscal multi-jurisdicción | Vigente |
| [SDD-004](SDD-004-motor-de-pagos.md) | Decisión de pagos y ficheros ISO 20022 | Vigente |
| [SDD-005](SDD-005-emision-de-facturas.md) | Emisión de facturas y registro encadenado | Vigente |
| [SDD-006](SDD-006-identidad-y-datos.md) | Identidad, aislamiento de datos y privacidad | Vigente |

Las decisiones puntuales de arquitectura siguen en [`../adr/`](../adr); un ADR
responde a "¿por qué esta decisión concreta?" y un SDD a "¿cómo funciona esto
y bajo qué supuestos?".

## Reglas de este directorio

1. **Un cambio de diseño y su documento viajan en el mismo commit.** Un SDD que
   describe algo que ya no es así es peor que no tenerlo.
2. **Se escribe lo que se decidió y lo que se descartó.** La alternativa
   rechazada suele ser la pregunta que hará el siguiente.
3. **Lo desconocido se marca como desconocido.** Si algo no está verificado,
   se dice; si depende de una decisión del negocio, también.
4. **Nada de diagramas por decorar.** Un diagrama entra si explica un
   mecanismo que el texto no explica mejor.

## Convención

```
SDD-NNN-nombre-corto.md

# SDD-NNN · Título
Estado · Fecha · Alcance

## Problema
## Decisión
## Alternativas descartadas
## Consecuencias
## Lo que no cubre
```
