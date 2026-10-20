// WhatsApp de NovaStudio (desarrollador del software), con indicativo de Colombia.
const NOVASTUDIO_PHONE = '573193034610';

function whatsappLink(message: string) {
  return `https://wa.me/${NOVASTUDIO_PHONE}?text=${encodeURIComponent(message)}`;
}

export const novaStudioLink = whatsappLink('Hola, estoy interesado en el software de veterinaria.');
export const supportLink = whatsappLink('Hola, necesito soporte del software venuSpa pets.');
