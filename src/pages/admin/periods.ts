export type Period = { label: string; start: string; endExclusive: string };

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function presetPeriods(): Period[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const day = today.getDate();
  const quincenaStart = day <= 15 ? monthStart : new Date(now.getFullYear(), now.getMonth(), 16);
  const quincenaEnd = day <= 15 ? new Date(now.getFullYear(), now.getMonth(), 16) : nextMonthStart;

  return [
    { label: "Hoy", start: fmt(today), endExclusive: fmt(tomorrow) },
    { label: "7 días", start: fmt(sevenAgo), endExclusive: fmt(tomorrow) },
    { label: "Este mes", start: fmt(monthStart), endExclusive: fmt(nextMonthStart) },
    { label: "Quincena actual", start: fmt(quincenaStart), endExclusive: fmt(quincenaEnd) },
    { label: "Mes anterior", start: fmt(prevMonthStart), endExclusive: fmt(monthStart) },
  ];
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", { dateStyle: "medium" }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", { timeStyle: "short" }).format(new Date(iso));
}
