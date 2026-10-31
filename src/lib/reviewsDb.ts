// Base de datos SIMULADA de reseñas. Sustituye fetchReviews() y submitReview() por tu API real.
// Las reseñas nuevas se guardan en localStorage del navegador para que veas cómo quedarían en la web.

export type ReviewRole = "producer" | "dj" | "creator";

export type Review = {
  id: string;
  name: string;
  role: ReviewRole;
  rating: number;
  text: string;
  date: string; // ISO
  color: string;
};

export type ReviewInput = {
  name: string;
  role: ReviewRole;
  rating: number;
  text: string;
  license: string;
};

export const LICENSE_RE = /^HYRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

// DATOS DE EJEMPLO: reemplázalos por reseñas reales (solo compras verificadas).
const SEED: Review[] = [
  { id: "s1", name: "Mateo R.", role: "producer", rating: 5, date: "2026-10-24", color: "#ff2a3d", text: "Subí tres beats con Hyro y se nota en cómo la gente se queda viendo el video. El espectrograma en vertical se ve brutal." },
  { id: "s2", name: "Andrés V.", role: "dj", rating: 5, date: "2026-10-19", color: "#7a1cff", text: "Lo usé una noche entera en pantalla grande y no se trabó ni una vez. Reacciona justo al kick." },
  { id: "s3", name: "Valeria M.", role: "creator", rating: 5, date: "2026-10-15", color: "#ff7a2a", text: "Por fin un visualizador que no parece plantilla. Cambié el color a mi paleta en dos clics." },
  { id: "s4", name: "Tomás G.", role: "producer", rating: 4, date: "2026-10-11", color: "#2a8cff", text: "Muy buen producto. Me gustaría más modos de color por preset, pero el resultado final es de otro nivel." },
  { id: "s5", name: "Camila S.", role: "creator", rating: 5, date: "2026-10-03", color: "#ff2a3d", text: "Lo compré una vez y ya lo tengo en mis dos laptops, uno a la vez. Descargué los instaladores desde mi cuenta sin problema." },
  { id: "s6", name: "Nico P.", role: "dj", rating: 5, date: "2026-09-28", color: "#b6ff2a", text: "El modo radar con el medidor de fondo se ve increíble en vivo. La gente me pregunta qué es." },
  { id: "s7", name: "Lucía F.", role: "producer", rating: 5, date: "2026-09-21", color: "#a855ff", text: "Cada beat ahora tiene su propia identidad visual. Antes usaba los mismos visuales de todos y se perdía." },
  { id: "s8", name: "Iván D.", role: "creator", rating: 4, date: "2026-09-14", color: "#ff7a2a", text: "Se adapta bien a cualquier tamaño, lo grabé en horizontal y vertical sin tocar nada." },
];

const KEY = "hyro.reviews.v1";
const COLORS = ["#ff2a3d", "#7a1cff", "#ff7a2a", "#2a8cff", "#b6ff2a", "#a855ff"];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mine(): Review[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Review[]) : [];
  } catch {
    return [];
  }
}

export async function fetchReviews(): Promise<Review[]> {
  await wait(650);
  return [...mine(), ...SEED].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export async function submitReview(input: ReviewInput): Promise<Review> {
  await wait(900);
  if (!LICENSE_RE.test(input.license.trim())) throw new Error("license");
  const review: Review = {
    id: `u${Date.now()}`,
    name: input.name.trim(),
    role: input.role,
    rating: input.rating,
    text: input.text.trim(),
    date: new Date().toISOString().slice(0, 10),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([review, ...mine()]));
  } catch {
    /* sin almacenamiento: la reseña vive solo en esta sesión */
  }
  return review;
}

export function summarize(list: Review[]) {
  const count = list.length;
  const dist = [5, 4, 3, 2, 1].map((s) => list.filter((r) => r.rating === s).length);
  const avg = count ? list.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, avg, dist };
}
