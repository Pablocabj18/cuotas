# Control de cuotas

Para gimnasios, academias, escuelas de danza, clubes y profesores particulares: quién pagó, quién debe, cuánto se cobró en el mes y recordatorios de pago por WhatsApp con un toque.

- **Cuotas del mes:** totales cobrados y pendientes, filtro por "deben" o "pagaron", buscador, registrar pagos (monto, medio, fecha), anular y descargar la planilla en CSV (se abre con Excel).
- **Socios:** alta, edición y baja, con plan, teléfono, fecha de ingreso y notas.
- **Configuración:** nombre del negocio, día de vencimiento, alias para transferencias y planes con precios.

Funciona en GitHub Pages y la base de datos es **gratis** con el plan free de Supabase.

## Modo demo

Sin configurar nada, funciona en **modo demo**: los datos se guardan en el navegador donde se usa. En la pestaña *Socios* hay un botón para cargar socios de ejemplo y mostrar cómo funciona.

Ojo: en modo demo, si se borran los datos del navegador, se pierde todo. Para usarlo en serio hay que conectar Supabase.

## Conectar la base de datos (Supabase, gratis)

1. Creá una cuenta en <https://supabase.com> y un proyecto nuevo.
2. **SQL Editor → New query**: pegá el contenido de `supabase/schema.sql` y tocá **Run**.
3. **Authentication → Users → Add user**: creá el usuario del dueño (email y contraseña).
4. **Authentication → Sign In / Providers → Allow new users to sign up = OFF** (importante: cualquier usuario logueado ve todos los datos).
5. **Project Settings → API**: copiá la *Project URL* y la *anon public key* y pegalas en `js/config.js`.
6. Subí los cambios y entrá con el usuario del paso 3.

## Publicar en GitHub Pages

Repositorio → **Settings → Pages → Deploy from a branch → `main` / root**.

## Próximos pasos posibles

- Recordatorios automáticos el día del vencimiento.
- Link de pago de Mercado Pago dentro del recordatorio.
- Control de asistencia (presentes por día).
- Recargo por pago fuera de término.
