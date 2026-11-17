/* Confeti al confirmarse una compra: un estallido corto al centro y dos ráfagas breves desde los lados.
   Se carga solo cuando hace falta y no aparece si la persona pidió reducir el movimiento. */
const COLORS = ["#22c55e", "#ef4444", "#a855f7", "#facc15"]; // verde, rojo, morado, amarillo

export async function celebrate() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  // ticks bajos: las piezas caen y desaparecen en cerca de dos segundos
  const base = { colors: COLORS, zIndex: 1000, disableForReducedMotion: true, ticks: 150, gravity: 1.2 };

  confetti({ ...base, particleCount: 120, spread: 100, startVelocity: 42, origin: { x: 0.5, y: 0.55 } });

  const end = Date.now() + 650;
  const sides = () => {
    confetti({ ...base, particleCount: 5, angle: 60, spread: 60, startVelocity: 50, origin: { x: 0, y: 0.7 } });
    confetti({ ...base, particleCount: 5, angle: 120, spread: 60, startVelocity: 50, origin: { x: 1, y: 0.7 } });
    if (Date.now() < end) requestAnimationFrame(sides);
  };
  sides();
}
