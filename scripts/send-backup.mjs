// Envía por correo el respaldo cifrado (o un aviso de que falló).
//   node scripts/send-backup.mjs --file respaldo.json.enc --kilobytes 9
//   node scripts/send-backup.mjs --failed
//   --dry-run  muestra el correo sin enviarlo
// Variables: SMTP_USER, SMTP_APP_PASSWORD (contraseña de aplicación de Gmail), BACKUP_TO, RUN_URL (opcional).
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import nodemailer from 'nodemailer';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const { SMTP_USER, SMTP_APP_PASSWORD, BACKUP_TO, RUN_URL } = process.env;
const dryRun = flag('--dry-run');
if (!dryRun && (!SMTP_USER || !SMTP_APP_PASSWORD || !BACKUP_TO)) {
  console.error('Faltan SMTP_USER, SMTP_APP_PASSWORD o BACKUP_TO.');
  process.exit(1);
}

const MAX_ATTACHMENT = 20 * 1024 * 1024; // Gmail admite 25 MB por correo.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

let subject, text, attachments = [];
if (flag('--failed')) {
  subject = `⚠ Falló el respaldo semanal de VenuSpa Pets (${today})`;
  text = [
    'El respaldo automático de esta semana no se pudo completar.',
    '', 'Mientras se revisa, descarga una copia manual desde la app: Configuración → Respaldo.',
    RUN_URL ? `\nDetalle técnico: ${RUN_URL}` : ''
  ].join('\n');
} else {
  const file = value('--file');
  if (!file) { console.error('Falta --file.'); process.exit(1); }
  const size = (await stat(file)).size;
  const kb = value('--kilobytes') ?? Math.round(size / 1024);
  subject = `Respaldo semanal de VenuSpa Pets (${today})`;
  const how = [
    'Para abrirlo hace falta la contraseña de respaldo (la que se guardó al configurar el respaldo automático).',
    'Con OpenSSL (en Git Bash o en cualquier terminal):',
    `  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in ${basename(file)} -out respaldo.json`,
    'Sin la contraseña el archivo no se puede leer: guárdala en un lugar seguro.'
  ].join('\n');
  if (size <= MAX_ATTACHMENT) {
    attachments = [{ filename: basename(file), content: await readFile(file) }];
    text = `Adjunto está la copia de seguridad semanal de VenuSpa Pets (${kb} KB), cifrada.\n\nNo incluye las fotos de las mascotas.\n\n${how}`;
  } else {
    text = `La copia de seguridad semanal pesa demasiado para adjuntarla (${Math.round(size / 1024 / 1024)} MB).\nDescárgala desde GitHub: ${RUN_URL ?? '(ver ejecuciones en GitHub Actions)'}\n\n${how}`;
  }
}

if (dryRun) {
  console.log({ to: BACKUP_TO ?? '(BACKUP_TO)', subject, attachments: attachments.map(a => `${a.filename} (${a.content.length} bytes)`) });
  console.log(text);
} else {
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD } });
  await transport.sendMail({ from: `"VenuSpa Pets (respaldo)" <${SMTP_USER}>`, to: BACKUP_TO, subject, text, attachments });
  console.log('Correo enviado a', BACKUP_TO);
}
