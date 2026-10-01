# AGENTS.md — cómo trabajar en este repositorio

Instrucciones para cualquier agente o persona que toque este código. Lo que
está aquí se ha aprendido rompiendo cosas: cada regla tiene detrás un fallo que
llegó a producción.

## Qué es esto

SaaS de facturación para autónomos y pymes de España y Suiza. Dos mitades:

- **Recibidas**: el usuario sube un ticket o factura, Claude Vision extrae los
  datos, el motor fiscal valida el IVA y el motor de pagos decide si se paga.
- **Emitidas**: el usuario crea facturas con tres campos y el motor fiscal
  deriva impuestos, retenciones y menciones legales.

`invoices` son facturas **recibidas**. Las emitidas viven en `bill_*`. No se
mezclan: tienen ciclo de vida y valor probatorio distintos.

## Stack

Next.js 16 (App Router, RSC) · TypeScript estricto · Supabase (PostgreSQL +
RLS) · Tailwind v4 · next-intl (es/de/en) · Vercel, región `fra1`.

## Las reglas que no se negocian

### 1. Las invariantes viven en la base de datos, no en la interfaz

Si una regla protege dinero o tiene valor legal, se impone en SQL. La
aplicación puede tener bugs; la base de datos es la última línea.

Ejemplos reales: `bill_issue_invoice` revalida que el total cuadra con sus
partes antes de escribir; `pay_require_user()` toma `auth.uid()` y nunca un
parámetro; `bill_records` y `pay_audit_log` son append-only por trigger.

### 2. Dinero en céntimos enteros, siempre

Nada de coma flotante. Un solo redondeo por documento, sobre la base, no línea
a línea: hay una prueba con tres líneas de 3,33 € que se desvía tres céntimos
si se hace al revés.

### 3. Los errores no se tragan

`return []` ante un fallo convierte una consulta rota en "no hay resultados".
Ya pasó: los filtros parecían no funcionar y no había rastro en ningún log.
Registrar, lanzar, y que la interfaz distinga "sin resultados" de "ha fallado".

### 4. Nada se afirma sin medir

Rendimiento y accesibilidad se miden con axe y Playwright, en los dos temas y
en móvil y escritorio. "Parece que va bien" no cuenta. El objetivo es cero
violaciones WCAG 2.1 AA.

### 5. El esquema real manda sobre los tipos

`src/types/database.ts` está escrito a mano y se desvió de las migraciones: la
columna `profiles.locale` existía en el tipo y en el formulario pero no en la
base de datos, y Configuración no pudo guardarse nunca. Lo vigila
`supabase/tests/schema-contract.test.ts`.

### 6. Capas de superficie completa necesitan ancestro posicionado

Un enlace con `after:absolute after:inset-0` sin un ancestro `relative` se
estira sobre **toda la página** y se come los clics de todo lo que haya encima.
Pasó en la lista de facturas y parecía un fallo de los filtros. Lo vigila
`src/components/invoices/row-overlay.test.ts`.

### 7. Idiomas a la par

Tres catálogos (`messages/es|de|en.json`) con las mismas claves. Una clave que
falta revienta la página en runtime, no en compilación.

## Antes de dar algo por terminado

```bash
npm run verify     # tsc + eslint + vitest + build
```

Y, si se ha tocado interfaz, axe sobre las páginas afectadas en los dos temas.
El guion de medición está en la skill `website-growth-audit-architect`
(`scripts/audit-a11y.cjs`), y se le pasa `PW_PATH` apuntando a un
`node_modules` con Playwright.

## Trabajo en paralelo

Hay varias sesiones trabajando sobre este repositorio a la vez.

- **Nunca `git push --force`.**
- **Nunca `git stash` a secas**: la pila es compartida. Usar un commit WIP.
- Rebase sobre `origin/main` antes de empujar.

## Base de datos

- Instancia Supabase **compartida con otros cuatro productos**. Prefijos
  `pay_` y `bill_` para no colisionar.
- Toda migración va en `supabase/migrations/` **y** se aplica a producción.
  La desviación entre ambas ya ha costado un fallo en producción.
- Las migraciones se prueban contra un Postgres real (PGlite) en
  `supabase/tests/`.

## Documentos de diseño

Las decisiones de arquitectura están en `docs/sdd/`. Antes de cambiar el motor
de pagos, el de emisión o el modelo de datos, leer el SDD correspondiente; si
la decisión cambia, el documento se actualiza en el mismo commit.

## Idioma

Código, nombres e identificadores en inglés. Comentarios y documentación en el
idioma en que mejor se explique la razón; en este repositorio conviven ambos y
no es un problema. Los comentarios explican **por qué**, no qué.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
