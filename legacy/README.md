# VenuSpa Pets — Peluquería Canina (demo)

Maqueta funcional del sistema de administración. Sitio estático (HTML + CSS + JS), sin servidor:
abrir `index.html` en el navegador.

## Accesos de demostración

| Usuario    | Contraseña        | Rol      |
|------------|-------------------|----------|
| `venuspa`  | `venuspa2024$`    | Administrador (Miguel Angel): ve todo |
| `empleado` | `empleado2024$`   | Empleado: sin finanzas, reportes, precios, equipo ni actividad |

## Módulos

Clientes y mascotas · Agenda (día/semana, lista de espera) · Servicios del día y caja (cierre) ·
Recordatorios por WhatsApp · Fidelización y paquetes · Productos e insumos · Catálogo de servicios ·
Gastos y utilidad · Reportes (Excel/PDF) · Equipo y respaldo · Registro de actividad.

Las citas se avisan al dueño por **Google Calendar** (enlace con la cita ya cargada) y por
**WhatsApp** (mensaje listo para enviar al cliente o al dueño, número configurable en Equipo y respaldo).

## Arquitectura (pensada para escalar)

- `js/data.js` — **única** capa de datos (`DataService`, todo con Promesas). Hoy usa `localStorage`;
  para pasar a base de datos solo se reescribe el cuerpo de estos métodos con `fetch()` a la API.
- `js/logic.js` — reglas de negocio puras (precios, descuentos, utilidad, mensajes). No cambian con el backend.
- `js/auth.js` — login en cliente solo para la demo; se reemplaza por token/API.
- Páginas (`*.html` + `js/<pagina>.js`) solo consumen `DataService` y `Logic`.

## Límites de la demo

- Los datos viven en el navegador (por equipo). Respaldo/restauración en *Equipo y respaldo*.
- Las fotos se reducen y se guardan en `localStorage` (~5 MB): sirve para demostrar, no para las ~5.000 fotos;
  con base de datos irían a almacenamiento de archivos.
- Los recordatorios abren WhatsApp con el mensaje escrito (envío con un clic); el envío automático
  requiere la API de WhatsApp Business en la versión con backend.
