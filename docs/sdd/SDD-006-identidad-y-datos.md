# SDD-006 · Identidad, aislamiento de datos y privacidad

**Estado:** vigente · **Fecha:** 2026-10-01 · **Alcance:** autenticación,
aislamiento entre usuarios, residencia de los datos y lo que se declara

## Problema

El sistema guarda facturas: datos personales y financieros de terceros, de un
negocio que opera entre España y Suiza. El aislamiento no puede depender de que
alguien se acuerde de filtrar por usuario, y lo que se declara públicamente
tiene que ser verdad.

## Decisión

### Identidad

Supabase Auth con correo y contraseña. La sesión viaja en cookies, se refresca
en el middleware y los Server Components leen con la sesión del usuario.

`handle_new_user()` crea el perfil al registrarse: 6 usuarios, 6 perfiles, cero
huérfanos.

Supabase devuelve el **mismo error** para una contraseña incorrecta y un correo
inexistente. Es deliberado —evita enumerar cuentas— y la interfaz lo respeta
en lugar de "mejorarlo".

### Aislamiento

Row Level Security en todas las tablas, con `(select auth.uid()) = user_id` y
`to authenticated`. Las tablas con valor probatorio (`pay_*`, `bill_*`) permiten
**leer** pero no escribir: se escribe por funciones que revalidan.

Verificado con pruebas contra Postgres real: un usuario no ve ni toca lo de
otro, ni puede emitir contra un cliente ajeno, ni encadena su registro al de
nadie.

### Residencia de los datos

| Qué | Dónde |
|---|---|
| Base de datos y ficheros | Supabase, `eu-central-2` (Zúrich, Suiza) |
| Ejecución de la aplicación | Vercel, `fra1` (Fráncfort, Alemania) |
| Extracción con IA | Anthropic — puede implicar transferencia a EE. UU. |

La región de ejecución está fijada en `vercel.json`. Antes corría en `iad1`
(Virginia) con la base de datos en Zúrich: cada render cruzaba el Atlántico y
contradecía el posicionamiento suizo del producto.

### Lo que se declara

Las páginas legales (`/privacy`, `/terms`, `/imprint`, en tres idiomas) dicen
dónde están los datos, quién los trata y qué subencargados intervienen. **Están
pendientes de revisión profesional y les falta la dirección postal completa.**

Analítica **sin cookies** (Vercel Web Analytics): por eso no hay banner de
consentimiento, no porque se haya omitido. Las únicas cookies son la de idioma
y las de sesión.

## Riesgo conocido y no resuelto

**La instancia Supabase está compartida con otros cuatro productos del
ecosistema, y el registro está abierto.** Quien se da de alta aquí obtiene una
identidad válida en toda la instancia.

El aislamiento es **por usuario**, no por producto. En las tablas de este
repositorio está verificado. En las de los otros cuatro, no lo hemos
comprobado, y una política mal puesta en cualquiera de ellos afecta al
conjunto.

Mitigaciones aplicadas: prefijos `pay_` y `bill_`, RLS revisada y asesor de
seguridad de Supabase ejecutado (solo quedan avisos de otro producto).

**Pendiente**: instancia propia antes de operar con facturación emitida real, y
activar la protección contra contraseñas filtradas, que está desactivada.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Filtrar por usuario solo en la aplicación | Un `where` olvidado expone datos de otro; RLS no se olvida |
| Permitir escritura directa en las tablas de pagos y emisión | Un bug del cliente podría alterar una factura emitida o pagar a una cuenta sin verificar |
| Distinguir "correo no registrado" de "contraseña incorrecta" | Permite enumerar qué correos tienen cuenta |
| Analítica con cookies | Obligaría a un banner y a tratar datos que no necesitamos |

## Lo que no cubre

- **Segundo factor** ni inicio de sesión con proveedor externo.
- **Organizaciones**: todo cuelga de un usuario; una gestoría con varios
  clientes no tiene modelo.
- **Exportación y borrado automatizados** de los datos de un usuario: hoy es
  una petición manual por correo.
- **Retención documentada** por tipo de dato. El audit log es inmutable por
  diseño; el resto se borra a petición.
