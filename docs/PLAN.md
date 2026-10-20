# VenuSpa Pets — Plan de la aplicación real

Stack: Next.js 14 (App Router) + TypeScript · Supabase (Postgres + Auth + Storage) · GitHub · Netlify.
Sin funciones exclusivas de una plataforma, para poder cambiar de hosting sin reescribir.

## Principios

1. **Todo parametrizable:** precios, reglas de fidelización, mensajes, categorías, horarios y número de WhatsApp viven en la base de datos, editables desde el módulo *Configuración*. Nada fijo en el código.
2. **Un administrador hoy, más groomers mañana:** usuarios con Supabase Auth y un rol (`admin`, `groomer`). Las políticas RLS ya contemplan ambos roles; agregar un groomer es crear un usuario.
3. **Reglas de negocio puras** (precios, descuentos, utilidad, mensajes) en `lib/logic/`, separadas de la interfaz, con pruebas. Se portan de `legacy/js/logic.js`.
4. **Migraciones SQL versionadas** en `supabase/migrations/`. La base se reconstruye desde cero con ellas.
5. **Una sola empresa** (VenuSpa Pets). No se diseña multi-empresa; si algún día hace falta, es una migración aparte.

## Modelo de datos (tablas)

| Tabla | Contenido principal |
|---|---|
| `profiles` | usuario (Auth), nombre, rol, activo, comisión % |
| `settings` | una fila: nombre del negocio, WhatsApp del dueño, dirección, zona horaria, horario, moneda |
| `owners` | dueños: nombre, WhatsApp, dirección, cumpleaños, consentimiento de mensajes, `referred_by` |
| `pets` | mascotas: dueño, nombre, raza, tamaño, cumpleaños, temperamento, alergias, corte preferido, frecuencia de baño (días), notas, foto |
| `sizes` | catálogo editable de tamaños (clave, nombre, minutos base) |
| `services` | nombre, tipo (base/adicional), minutos extra, activo |
| `service_prices` | servicio × tamaño → precio |
| `service_breed_prices` | servicio × raza → precio especial |
| `appointments` | mascota, fecha, hora, duración, groomer, estado, notas |
| `appointment_services` | servicios de la cita |
| `waitlist` | lista de espera |
| `visits` | servicio prestado: fecha, groomer, subtotal, descuento (clave y %), total, propina, medio de pago, fotos antes/después |
| `visit_items` | líneas de la visita: servicio, precio cobrado |
| `loyalty_rules` | reglas editables (ver abajo) |
| `package_types` / `packages` | paquetes prepagados y su saldo |
| `payment_methods` | catálogo editable (efectivo, Nequi, Daviplata, transferencia, paquete) |
| `expense_categories` / `expenses` | gastos |
| `products` / `product_lots` | insumos y compras (cuentan como gasto) |
| `cash_closings` | cierre de caja diario |
| `message_templates` | textos de WhatsApp con variables |
| `reminder_log` | qué recordatorio se envió, cuándo y a quién |
| `activity_log` | quién hizo qué |

Seguridad: RLS activado en todas las tablas. El rol `groomer` no ve finanzas, reportes ni configuración (igual que el "empleado" de la demo).

## Parámetros (módulo Configuración)

- **Negocio:** nombre, WhatsApp del dueño, dirección, horario de atención, intervalo de la agenda.
- **Tamaños:** nombre, rango de peso, minutos base.
- **Servicios:** precios por tamaño, precios por raza, minutos extra.
- **Fidelización** (hoy en la demo → editable):
  - cada **N** baños, descuento del **X %** (demo: cada 5, 50 %)
  - descuento de cumpleaños de la mascota (demo: 10 %, ventana de ±7 días, una vez al año)
  - descuento por referido, para el nuevo y para quien refiere (demo: 10 %)
  - días de inactividad para reactivar (demo: 30 y 60)
- **Paquetes:** nombre, cantidad de baños, precio.
- **Mensajes de WhatsApp:** texto editable con `{cliente}`, `{mascota}`, `{fecha}`, `{hora}`, `{negocio}`, `{dias}`.
- **Catálogos:** medios de pago, categorías de gastos.
- **Usuarios:** crear groomers, rol, comisión.

## Módulos y orden de construcción

Cada módulo se termina, se prueba y se despliega antes de pasar al siguiente.

0. **Base:** app Next.js, conexión a Supabase, login, roles, layout, migraciones iniciales, despliegue en Netlify. La demo pasa a `legacy/`.
1. **Configuración:** negocio, tamaños, servicios y precios, catálogos. Va primero porque los demás módulos dependen de estos datos.
2. **Clientes y mascotas:** alta, edición, búsqueda, historial, fotos.
3. **Agenda:** vista día/semana, crear/mover/cancelar citas, evitar choques de horario por groomer, lista de espera, enlace a Google Calendar.
4. **Servicios y caja:** registrar la visita (desde una cita o directa), cobro, propina, cierre del día.
5. **Fidelización automática:** al registrar una visita el sistema evalúa las reglas y **aplica el descuento que corresponda** (contador de baños, cumpleaños, referidos), mostrándolo antes de cobrar. Paquetes prepagados con saldo.
6. **Ingresos y gastos:** gastos por categoría, compras de insumos, utilidad por rango de fechas, reporte exportable.
7. **Recordatorios por WhatsApp:** pantalla con los pendientes del día (cita de mañana, baño vencido, cumpleaños, reactivación). Cada uno abre WhatsApp (`wa.me`) con el mensaje ya escrito y se registra como enviado. Es gratis y manual: un clic por mensaje. No hay envío automático sin la API de pago.

## Cómo se trabaja

- Rama `main` = lo que está publicado. Cada push despliega en Netlify.
- Trabajo en ramas por módulo y se une a `main` cuando lo apruebas.
- Las llaves de Supabase solo en `.env.local` (local) y en las variables de entorno de Netlify. Nunca en git.
