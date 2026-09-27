// Shared by the web button and the WhatsApp bot (no server-only imports, safe for the browser).

/** QueFalta's WhatsApp Business number (Zavu), digits only for wa.me links. */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "17083840040";

/** The message the web button pre-fills, so the user starts the chat (WhatsApp's 24-hour rule). */
export const planRequestText = (catId: string, lat: number, lon: number) =>
  `Quiero mi plan: ${catId} @${lat.toFixed(5)},${lon.toFixed(5)}`;

export const whatsappLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
