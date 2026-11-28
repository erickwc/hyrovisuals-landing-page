/* Datos del ticket de compra: se usan en el build (HTML inicial) y en el navegador (al cambiar de plan). */
import type { Plan } from './supabase-rest';

export const planCode = (p: Plan) => (p.id.normalize('NFD').replace(/[^a-z]/gi, '').slice(0, 3) || 'PLN').toUpperCase();
export const planName = (p: Plan, names: Record<string, string>) => names[p.id] || p.id.charAt(0).toUpperCase() + p.id.slice(1);
export const priceParts = (price: number) => {
  const [int, dec] = Number(price).toFixed(2).split('.');
  return { int: String(+int), dec };
};
export const invoiceNo = (p: Plan, d = new Date()) => `HV-${String(d.getFullYear()).slice(2)}-${planCode(p)}-${String(p.keys).padStart(2, '0')}`;
export const barcodeText = (p: Plan, d = new Date()) => `HV-${planCode(p)}-${p.keys}K-${d.getFullYear()}`;
export const ticketDate = (months: string[], d = new Date()) => `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;

/** Código de barras decorativo (siempre el mismo para el mismo texto): barras de 1 a 3 unidades. */
export function barcodePath(text: string) {
  let x = 0;
  let seed = 0;
  for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 16) / 65536;
  const bars: string[] = [];
  bars.push(`M0 0h2v38h-2z`); x = 3; bars.push(`M${x} 0h1v38h-1z`); x = 6;
  while (x < 190) {
    const w = 1 + Math.floor(rnd() * 3);
    bars.push(`M${x} 0h${w}v38h-${w}z`);
    x += w + 1 + Math.floor(rnd() * 3);
  }
  bars.push(`M194 0h1v38h-1z`, `M197 0h2v38h-2z`);
  return bars.join('');
}
