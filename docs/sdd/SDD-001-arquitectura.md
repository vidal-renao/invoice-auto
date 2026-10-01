# SDD-001 · Arquitectura general

**Estado:** vigente · **Fecha:** 2026-10-01 · **Alcance:** todo el sistema

## Problema

Un autónomo pierde unas 226 horas al año en administración. El producto tiene
que cerrar un ciclo completo —emitir, cobrar, capturar gastos, decidir pagos,
cuadrar impuestos— sin convertirse en un ERP, y sirviendo a dos jurisdicciones
con reglas distintas: España y Suiza.

## Decisión

Una sola aplicación Next.js sobre Supabase, con la lógica que importa empujada
lo más abajo posible.

```
Navegador
   │  Server Components y Server Actions (sin API propia que mantener)
   ▼
Next.js 16 · App Router · Vercel fra1
   │  cliente Supabase con la sesión del usuario
   ▼
PostgreSQL + RLS                    ← aquí viven las invariantes
   │
   ├── auth.users          identidad (compartida con otros productos)
   ├── invoices            facturas RECIBIDAS (gastos)
   ├── pay_*               motor de pagos: cuentas, lotes, auditoría
   └── bill_*              facturas EMITIDAS: clientes, series, registro
                                                        encadenado
```

Cuatro decisiones estructurales:

**1. Sin capa de API propia.** Los Server Components leen con el cliente de
Supabase bajo la sesión del usuario, y las Server Actions escriben. No hay
controladores que mantener ni contratos que versionar. Los únicos Route
Handlers son los que no pueden ser otra cosa: exportación de ficheros,
callback de autenticación y la descarga del pain.001 de la demo.

**2. Las invariantes en SQL.** Todo lo que protege dinero o tiene valor legal
se impone en la base de datos mediante funciones `SECURITY DEFINER` que
revalidan antes de escribir, y RLS por `auth.uid()`. La aplicación puede tener
bugs; la base de datos es la última línea. Ver SDD-004 y SDD-005.

**3. Lógica pura separada de la infraestructura.** El motor fiscal
(`src/lib/tax`), el de decisión de pagos (`src/lib/payments/decision.ts`) y el
de emisión (`src/lib/billing`) son funciones puras sin dependencias de red ni
de base de datos. Por eso se prueban en milisegundos y por eso hay 181 pruebas.

**4. Dinero en céntimos enteros.** Nunca coma flotante, y un solo redondeo por
documento sobre la base imponible.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| API REST propia entre el navegador y la base de datos | Capa que mantener sin beneficio: RLS ya da el aislamiento por usuario |
| Lógica fiscal en la base de datos | Imposible de probar bien y de evolucionar; en TypeScript son funciones puras con pruebas |
| Confiar solo en la validación de la aplicación | Un bug del cliente podría emitir una factura descuadrada o pagar a una cuenta no verificada |
| Monorepo con paquetes compartidos | Un solo desarrollador y un solo despliegue: coste de coordinación sin retorno |

## Consecuencias

- **Bien**: superficie pequeña, pruebas rápidas, el aislamiento no depende de
  que nadie se acuerde de filtrar por usuario.
- **Bien**: cambiar de interfaz no toca las reglas de negocio.
- **Coste**: parte de la lógica está en SQL y hay que mantener migraciones
  probadas contra un Postgres real (PGlite, `supabase/tests/`).
- **Coste**: los tipos de la base de datos están escritos a mano y pueden
  desviarse del esquema. Lo vigila `schema-contract.test.ts` desde que esa
  desviación rompió la página de Configuración en producción.

## Lo que no cubre

- **Multi-tenant por organización.** Hoy todo cuelga de un usuario. Una
  gestoría que gestione varios clientes necesitaría un modelo de organizaciones
  y permisos que no existe.
- **Trabajo sin conexión más allá del service worker.** La PWA cachea estáticos
  y navegación; no hay cola de escrituras offline.
- **Escala.** Las consultas no están paginadas: a partir de unos miles de
  facturas por usuario habrá que paginar y mover agregados a vistas
  materializadas.
