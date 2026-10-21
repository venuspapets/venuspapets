# Respaldo semanal automático

Cada domingo a las 10 p. m. (hora de Colombia) GitHub ejecuta `.github/workflows/backup.yml`:

1. `scripts/backup.mjs` exporta todas las tablas de Supabase a un JSON (sin fotos).
2. Se cifra con AES-256 usando `BACKUP_PASSWORD`.
3. Se guarda una copia en GitHub (artefacto, 90 días) y se envía por correo a `BACKUP_TO`.
4. Si algo falla, se envía un correo de aviso y GitHub también notifica.
5. Queda una anotación en el registro de actividad de la app; si pasan más de 10 días sin respaldo, el administrador ve un aviso en Inicio.

> **Estado: en pausa.** El horario semanal está comentado en el workflow y el aviso de Inicio desactivado (`BACKUP_ALERT_ENABLED` en `lib/backups.ts`). Al configurar los secretos: descomentar el `schedule` del workflow y poner esa constante en `true`.

## Configuración (una sola vez)

En el repositorio de GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secreto | Valor |
|---|---|
| `SUPABASE_URL` | La URL del proyecto (la misma de `NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | La llave secreta de Supabase (Settings → API Keys) |
| `BACKUP_PASSWORD` | Una contraseña larga inventada para cifrar (mínimo 16 caracteres). **Guardarla en un lugar seguro: sin ella no se puede abrir ningún respaldo.** |
| `SMTP_USER` | Correo de la empresa que envía (Gmail) |
| `SMTP_APP_PASSWORD` | Contraseña de aplicación de esa cuenta de Gmail (16 caracteres) |
| `BACKUP_TO` | Correo que recibe el respaldo |

Contraseña de aplicación de Gmail: cuenta de Google → Seguridad → activar *Verificación en 2 pasos* → *Contraseñas de aplicaciones* (https://myaccount.google.com/apppasswords).

Para probar: pestaña **Actions → Respaldo semanal → Run workflow**.

## Abrir un respaldo

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in respaldo-venuspa-AAAA-MM-DD.json.enc -out respaldo.json
```

## Notas

- Las fotos de las mascotas no van en el respaldo; viven en el almacenamiento de Supabase.
- Restaurar un respaldo se hace desde la base de datos (contactar a soporte).
- Si se cambia la cuenta de correo de la empresa, actualizar `SMTP_USER`, `SMTP_APP_PASSWORD` y `BACKUP_TO`.
