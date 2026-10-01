# MEMORY.md — lo que hay que saber antes de tocar nada

Hechos del proyecto que no se deducen leyendo el código y que han costado
tiempo averiguar. Si algo de aquí deja de ser cierto, se corrige en el mismo
commit que lo cambia.

## Infraestructura

| Qué | Dónde | Detalle |
|---|---|---|
| Producción | `https://invoice-auto-xi.vercel.app` | **No** es `invoice-auto.vercel.app`: ese devuelve 307 y no está en la lista blanca de Supabase |
| Proyecto Vercel | `prj_ERGgOL2WOvL3kP6GX3sULZ0WHhgX` | equipo `team_pq3l7uTjuKaC5k0zDjFoS6nz` |
| Región de ejecución | `fra1` (Fráncfort) | Fijada en `vercel.json`. Antes corría en `iad1`, con la base de datos en Zúrich |
| Supabase | `upuhppsbolpdpaighzfq` | Región `eu-central-2` (Zúrich) |
| Despliegue | Automático al empujar a `main` | GitHub → Vercel |

## Supabase: instancia compartida

El proyecto `upuhppsbolpdpaighzfq` **aloja cinco productos** del ecosistema, no
solo este. De ahí los prefijos `pay_` y `bill_` en las tablas.

- El registro está **abierto** y sin confirmación por correo: quien se da de
  alta aquí tiene identidad válida en toda la instancia.
- El aislamiento es **por usuario**, vía RLS y `auth.uid()`, no por producto.
  Está bien hecho en las tablas de este repositorio; no está verificado para
  las de los otros.
- **Antes de meter facturación emitida con valor probatorio en serio,
  conviene instancia propia.**

## Correo

Los correos de recuperación salen por el **SMTP de pruebas de Supabase**
(`noreply@mail.app.supabase.io`): limitado a unos pocos envíos por hora y con
mala entregabilidad en Outlook. Migrar a Resend es tarea pendiente.

La lista blanca de redirección incluye
`https://invoice-auto-xi.vercel.app/api/auth/callback` y
`http://localhost:<puerto>/api/auth/callback`. El **Site URL** del proyecto es
el dominio `-xi`, así que cualquier enlace con un `redirect_to` no autorizado
acaba aquí aunque venga de otro producto.

Comprobar la lista blanca sin enviar ningún correo:

```bash
curl -s -o /dev/null -w "%{redirect_url}" \
  "https://upuhppsbolpdpaighzfq.supabase.co/auth/v1/verify?token=x&type=recovery&redirect_to=<URL>"
```

## Entorno de desarrollo

- `npm ci` falla sin `--legacy-peer-deps`: `next-intl@3` declara un peer de
  Next ≤ 15 y aquí corre Next 16. `vercel.json` ya lo tiene configurado.
- El worktree puede quedarse sin `node_modules` si otra sesión limpia; se
  reinstala con `npm ci --legacy-peer-deps`.
- Playwright y `@axe-core/playwright` no están en este proyecto. Se usan desde
  otro repositorio con `PW_PATH=.../solarpilot/node_modules`.
- `next dev` añade un bloque `<!-- BEGIN:nextjs-agent-rules -->` al final de
  `CLAUDE.md` cada vez que arranca. No es trabajo nuestro; revertirlo.

## Regulación que condiciona el producto

- **Verifactu** (RD 1007/2023, prorrogado por RD-ley 15/2025): obligatorio
  para sociedades el **1 de enero de 2027** y para autónomos el **1 de julio
  de 2027**. Multas de hasta 50.000 € por ejercicio por usar software no
  conforme — la sanción recae en el usuario, no en el fabricante.
- **Este software todavía NO es un SIF conforme**: falta firma por registro,
  QR de cotejo, envío a la AEAT y declaración responsable. La estructura de
  `bill_records` (cadena SHA-256 inmutable) ya está preparada para recibirlo.
  **Hasta entonces no se puede anunciar como Verifactu.**
- **Factura electrónica B2B** (Ley 18/2022 + RD 238/2026): octubre de 2027
  para facturación > 8 M€, octubre de 2028 para el resto. Los plazos cuentan
  desde una orden ministerial cuya publicación hay que verificar.
- **Suiza**: sin equivalente a Verifactu. La QR-factura es obligatoria desde
  octubre de 2022, y la QR-IBAN con referencia de 27 dígitos es lo que permite
  la conciliación automática.

Análisis completo en [docs/producto-emision-facturas.md](docs/producto-emision-facturas.md).

## Estado del producto

Construido y desplegado: captura con IA, motor fiscal de 16 jurisdicciones,
motor de decisión de pagos con pain.001, emisión de facturas, temas claro y
oscuro, tres idiomas, PWA.

Sin estrenar con datos reales: **0 facturas emitidas, 0 clientes, 0 cuentas de
proveedor verificadas, 0 ficheros de pago generados**. Hay mucho motor y
ninguna vuelta completa dada.
