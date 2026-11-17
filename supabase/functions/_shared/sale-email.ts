// Aviso por correo de cada venta, con Resend (https://resend.com), en el mismo estilo que el correo de recuperar
// contraseña (fondo negro, HYRO arriba, tarjeta oscura). Dice quién compró, qué licencia y lleva el botón al panel.
// Secretos de Edge Functions: RESEND_API_KEY y SALE_EMAIL_FROM (opcional, p. ej. "Hyro <auth@byhyro.com>").
// A quién se envía se edita en el panel admin (sale_notifications).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const PANEL_URL = "https://byhyro.com/admin/ventas";

export function emailConfigured(): boolean {
  return Boolean(Deno.env.get("RESEND_API_KEY"));
}

export function emailFrom(): string {
  return Deno.env.get("SALE_EMAIL_FROM") || "Hyro Ventas <ventas@byhyro.com>";
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

type Block = { label: string; title: string; detail?: string };

/** Plantilla común: misma estética que el correo de recuperar contraseña. */
function layout(opts: { eyebrow: string; heading: string; intro: string; blocks: Block[]; button: { label: string; href: string } }) {
  const blocks = opts.blocks
    .map(
      (b, i) => `
  <div style="${i > 0 ? "border-top:1px solid #242424;padding-top:18px;margin-top:18px;" : ""}">
    <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8d8a86;margin:0 0 8px;">${esc(b.label)}</p>
    <p style="font-family:Arial,sans-serif;font-size:17px;font-weight:700;color:#f4f2ef;margin:0;">${esc(b.title)}</p>
    ${b.detail ? `<p style="font-size:13px;line-height:1.5;color:#b9b6b1;margin:4px 0 0;">${esc(b.detail)}</p>` : ""}
  </div>`,
    )
    .join("");

  return `<div style="background-color:#070707;padding:48px 24px;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;">
  <div style="max-width:420px;margin:0 auto;">
  <div style="font-family:Arial,sans-serif;font-weight:800;font-style:italic;font-size:22px;letter-spacing:-0.04em;color:#f4f2ef;margin-bottom:40px;">HYRO</div>
  <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8d8a86;margin:0 0 10px;">${esc(opts.eyebrow)}</p>
  <h1 style="font-family:Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:-0.02em;font-size:24px;color:#f4f2ef;margin:0 0 16px;">${esc(opts.heading)}</h1>
  <p style="font-size:14px;line-height:1.6;color:#b9b6b1;margin:0 0 28px;">${esc(opts.intro)}</p>
  <div style="background-color:#0e0e0e;border:1px solid #242424;border-radius:16px;padding:24px;margin-bottom:28px;">${blocks}
  </div>
  <div style="text-align:center;margin-bottom:8px;">
    <a href="${opts.button.href}" style="display:inline-block;background-color:#f4f2ef;color:#0a0a0a;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:15px 30px;border-radius:999px;">${esc(opts.button.label)} &rarr;</a>
  </div>
  <p style="font-size:11px;color:#6b6762;margin-top:44px;">&copy; 2026 HYRO. Todos los derechos reservados.</p>
  </div>
  </div>`;
}

function plainText(heading: string, intro: string, blocks: Block[], href: string) {
  const lines = blocks.map((b) => `${b.label}: ${b.title}${b.detail ? ` (${b.detail})` : ""}`);
  return `${heading}\n\n${intro}\n\n${lines.join("\n")}\n\nVer en el panel: ${href}`;
}

async function sendEmail(to: string[], subject: string, html: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ from: emailFrom(), to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
}

async function recipients(admin: SupabaseClient): Promise<{ enabled: boolean; emails: string[] }> {
  const { data } = await admin.from("sale_notifications").select("enabled, emails").maybeSingle();
  return { enabled: Boolean(data?.enabled), emails: (data?.emails ?? []).filter((e: string) => e.includes("@")) };
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Avisa de una venta pagada. Sale una sola vez por compra (purchases.notified_at). */
export async function notifySale(admin: SupabaseClient, purchaseId: string): Promise<"sent" | "skipped"> {
  const { enabled, emails } = await recipients(admin);
  if (!enabled || emails.length === 0 || !emailConfigured()) return "skipped";

  // se marca primero: si dos avisos llegan a la vez, solo uno envía el correo
  const { data: claimed } = await admin
    .from("purchases")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .eq("status", "paid")
    .is("notified_at", null)
    .select("id, user_id, product_id, plan_id, provider")
    .maybeSingle();
  if (!claimed) return "skipped";

  try {
    const [{ data: buyer }, { data: product }, { data: plan }] = await Promise.all([
      admin.from("profiles").select("email, name").eq("id", claimed.user_id).maybeSingle(),
      admin.from("products").select("name").eq("id", claimed.product_id).maybeSingle(),
      admin.from("plans").select("license_count").eq("product_id", claimed.product_id).eq("id", claimed.plan_id).maybeSingle(),
    ]);
    const productName = product?.name ?? "Hyro";
    const planName = capitalize(String(claimed.plan_id));
    const keys = Number(plan?.license_count ?? 1);
    const isTest = claimed.provider === "paypal_sandbox";

    const blocks: Block[] = [
      {
        label: "Usuario que compró",
        title: buyer?.name || buyer?.email || "Cliente",
        detail: buyer?.name ? buyer.email ?? undefined : undefined,
      },
      {
        label: "Licencia que compró",
        title: `${productName} · ${planName}`,
        detail: `${keys} ${keys === 1 ? "clave de activación" : "claves de activación"}`,
      },
    ];
    const heading = isTest ? "Venta de prueba" : "Nueva venta";
    const intro = isTest
      ? "Se registró una compra de prueba (PayPal en modo pruebas, sin dinero real)."
      : "Alguien acaba de comprar en byhyro.com. Su licencia ya está en su biblioteca.";

    await sendEmail(
      emails,
      `${isTest ? "[PRUEBA] " : ""}Nueva venta: ${productName} ${planName}`,
      layout({ eyebrow: "Ventas", heading, intro, blocks, button: { label: "Ver en el panel", href: PANEL_URL } }),
      plainText(heading, intro, blocks, PANEL_URL),
    );
    return "sent";
  } catch (err) {
    // no salió: se libera para poder reintentar
    await admin.from("purchases").update({ notified_at: null }).eq("id", purchaseId);
    throw err;
  }
}

/** Correo de prueba desde el panel, a los mismos destinatarios y con el mismo diseño que una venta. */
export async function sendTestEmail(admin: SupabaseClient): Promise<string[]> {
  const { emails } = await recipients(admin);
  if (!emailConfigured()) throw new Error("Falta el secreto RESEND_API_KEY en Supabase.");
  if (emails.length === 0) throw new Error("No hay correos para avisar.");
  const blocks: Block[] = [
    { label: "Usuario que compró", title: "Nombre del cliente", detail: "cliente@correo.com" },
    { label: "Licencia que compró", title: "Hyro Visuals · Personal", detail: "1 clave de activación" },
  ];
  const heading = "Así se verá una venta";
  const intro = "Este es un correo de prueba del panel de Hyro. Cada venta llegará con este formato.";
  await sendEmail(
    emails,
    "Prueba: aviso de ventas de Hyro",
    layout({ eyebrow: "Ventas", heading, intro, blocks, button: { label: "Ver en el panel", href: PANEL_URL } }),
    plainText(heading, intro, blocks, PANEL_URL),
  );
  return emails;
}
