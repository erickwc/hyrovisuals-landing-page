// Correo de confirmación de compra al cliente, con Resend y el mismo estilo que el aviso de venta (fondo negro,
// HYRO arriba, tarjeta oscura). Cumple el art. 21-B b de la Ley de Protección al Consumidor de El Salvador:
// confirma la orden con el número de pedido, el desglose, el total y la entrega (las claves, al instante).
// Sale una sola vez por compra (purchases.receipt_sent_at, migración 0017), en español o inglés.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { emailConfigured, emailFrom } from "./sale-email.ts";

const SITE = "https://byhyro.com";

export type Lang = "es" | "en";

const COPY = {
  es: {
    subject: (product: string, order: string) => `Tu compra de ${product} · Pedido #${order}`,
    eyebrow: "Confirmación de compra",
    heading: "¡Gracias por tu compra!",
    intro: (name: string) =>
      `${name ? `Hola, ${name}. ` : ""}Tu pago se confirmó y tu licencia ya está en tu biblioteca, con los instaladores para Windows y macOS.`,
    order: "Pedido",
    date: "Fecha",
    license: "Licencia",
    keysCount: (n: number) => `${n} ${n === 1 ? "clave de activación" : "claves de activación"}`,
    keys: "Tus claves",
    subtotal: "Precio",
    discount: (code: string) => `Cupón ${code}`,
    total: "Total pagado",
    method: "Medio de pago",
    paypal: "PayPal",
    free: "Cupón del 100 % (sin cobro)",
    delivery: "Entrega",
    deliveryText: "Inmediata y digital: en tu biblioteca de byhyro.com",
    button: "Ir a mi biblioteca",
    test: "Compra de prueba: PayPal en modo pruebas, sin dinero real.",
    legal:
      "Tienes 8 días para retractarte si no has activado ninguna clave de esta compra. Para eso, o para cualquier reclamo, responde a este correo con tu número de pedido.",
    links: "Términos · Aviso de privacidad · Reembolsos",
    rights: "Todos los derechos reservados.",
    locale: "es-SV",
  },
  en: {
    subject: (product: string, order: string) => `Your ${product} purchase · Order #${order}`,
    eyebrow: "Purchase confirmation",
    heading: "Thanks for your purchase!",
    intro: (name: string) =>
      `${name ? `Hi, ${name}. ` : ""}Your payment was confirmed and your license is already in your library, with the installers for Windows and macOS.`,
    order: "Order",
    date: "Date",
    license: "License",
    keysCount: (n: number) => `${n} ${n === 1 ? "activation key" : "activation keys"}`,
    keys: "Your keys",
    subtotal: "Price",
    discount: (code: string) => `Coupon ${code}`,
    total: "Total paid",
    method: "Payment method",
    paypal: "PayPal",
    free: "100% coupon (no charge)",
    delivery: "Delivery",
    deliveryText: "Instant and digital: in your byhyro.com library",
    button: "Go to my library",
    test: "Test purchase: PayPal in test mode, no real money.",
    legal:
      "You have 8 days to withdraw if you haven't activated any key from this purchase. For that, or for any claim, reply to this email with your order number.",
    links: "Terms · Privacy notice · Refunds",
    rights: "All rights reserved.",
    locale: "en-US",
  },
} as const;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

const money = (n: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

type Row = { label: string; value: string; strong?: boolean; accent?: boolean };

function rowsHtml(rows: Row[]) {
  return rows
    .map(
      (r) => `<tr>
      <td style="padding:6px 0;font-size:13px;color:#8d8a86;">${esc(r.label)}</td>
      <td style="padding:6px 0;font-size:${r.strong ? "16px" : "13px"};font-weight:${r.strong ? 700 : 500};color:${r.accent ? "#ff2a3d" : "#f4f2ef"};text-align:right;">${esc(r.value)}</td>
    </tr>`,
    )
    .join("");
}

function layout(opts: {
  t: (typeof COPY)[Lang];
  name: string;
  isTest: boolean;
  details: Row[];
  money: Row[];
  keys: string[];
}) {
  const { t } = opts;
  const keys = opts.keys.length
    ? `<div style="border-top:1px solid #242424;padding-top:18px;margin-top:18px;">
    <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8d8a86;margin:0 0 10px;">${esc(t.keys)}</p>
    ${opts.keys
      .map(
        (k) =>
          `<p style="font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:0.06em;color:#f4f2ef;background-color:#070707;border:1px solid #242424;border-radius:8px;padding:10px 12px;margin:0 0 8px;">${esc(k)}</p>`,
      )
      .join("")}
  </div>`
    : "";

  return `<div style="background-color:#070707;padding:48px 24px;font-family:'Space Grotesk',Helvetica,Arial,sans-serif;">
  <div style="max-width:440px;margin:0 auto;">
  <div style="font-family:Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:-0.02em;color:#f4f2ef;margin-bottom:40px;">HYRO</div>
  <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8d8a86;margin:0 0 10px;">${esc(t.eyebrow)}</p>
  <h1 style="font-family:Arial,sans-serif;font-weight:700;letter-spacing:-0.02em;font-size:24px;color:#f4f2ef;margin:0 0 16px;">${esc(t.heading)}</h1>
  <p style="font-size:14px;line-height:1.6;color:#b9b6b1;margin:0 0 28px;">${esc(t.intro(opts.name))}</p>
  ${opts.isTest ? `<p style="font-size:12px;font-weight:600;color:#f4f2ef;background-color:rgba(255,42,61,0.13);border-radius:8px;padding:8px 12px;margin:0 0 20px;">${esc(t.test)}</p>` : ""}
  <div style="background-color:#0e0e0e;border:1px solid #242424;border-radius:16px;padding:22px 24px;margin-bottom:28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml(opts.details)}</table>
    <div style="border-top:1px solid #242424;margin:14px 0 8px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml(opts.money)}</table>
    ${keys}
  </div>
  <div style="text-align:center;margin-bottom:28px;">
    <a href="${SITE}/cuenta/biblioteca" style="display:inline-block;background-color:#f4f2ef;color:#0a0a0a;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:15px 30px;border-radius:999px;">${esc(t.button)} &rarr;</a>
  </div>
  <p style="font-size:12px;line-height:1.6;color:#8d8a86;margin:0 0 10px;">${esc(t.legal)}</p>
  <p style="font-size:12px;margin:0;"><a href="${SITE}/legal/terminos" style="color:#b9b6b1;text-decoration:none;">${esc(t.links.split(" · ")[0])}</a> <span style="color:#6b6762;">·</span> <a href="${SITE}/legal/privacidad" style="color:#b9b6b1;text-decoration:none;">${esc(t.links.split(" · ")[1])}</a> <span style="color:#6b6762;">·</span> <a href="${SITE}/legal/reembolsos" style="color:#b9b6b1;text-decoration:none;">${esc(t.links.split(" · ")[2])}</a></p>
  <p style="font-size:11px;color:#6b6762;margin-top:36px;">&copy; ${new Date().getFullYear()} HYRO. ${esc(t.rights)}</p>
  </div>
  </div>`;
}

/** Envía la confirmación de una compra pagada a su dueño. "skipped" si ya salió, no está pagada o falta Resend. */
export async function sendPurchaseReceipt(admin: SupabaseClient, purchaseId: string, lang: Lang = "es"): Promise<"sent" | "skipped"> {
  if (!emailConfigured()) return "skipped";

  // se marca primero: si dos llamadas llegan a la vez, solo una envía el correo
  const { data: claimed } = await admin
    .from("purchases")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .eq("status", "paid")
    .is("receipt_sent_at", null)
    .select("id, user_id, product_id, plan_id, provider, amount, currency, discount_amount, created_at, coupons(code)")
    .maybeSingle();
  if (!claimed) return "skipped";

  try {
    const [{ data: buyer }, { data: product }, { data: plan }, { data: licenses }] = await Promise.all([
      admin.from("profiles").select("email, name").eq("id", claimed.user_id).maybeSingle(),
      admin.from("products").select("name").eq("id", claimed.product_id).maybeSingle(),
      admin.from("plans").select("license_count").eq("product_id", claimed.product_id).eq("id", claimed.plan_id).maybeSingle(),
      admin.from("licenses").select("license_key").eq("purchase_id", claimed.id).order("created_at"),
    ]);
    const to = buyer?.email;
    if (!to) throw new Error("La compra no tiene correo de cliente");

    const t = COPY[lang] ?? COPY.es;
    const productName = product?.name ?? "Hyro Visuals";
    const keysCount = Number(plan?.license_count ?? licenses?.length ?? 1);
    const currency = claimed.currency || "USD";
    const amount = Number(claimed.amount);
    const discount = Number(claimed.discount_amount) || 0;
    const coupon = (claimed.coupons as { code?: string } | null)?.code ?? "";
    const orderNo = String(claimed.id).slice(0, 8).toUpperCase();
    const isTest = claimed.provider === "paypal_sandbox";
    const date = new Intl.DateTimeFormat(t.locale, { dateStyle: "long", timeZone: "America/El_Salvador" }).format(new Date(claimed.created_at));
    const firstName = String(buyer?.name ?? "").trim().split(/\s+/)[0] ?? "";

    const details: Row[] = [
      { label: t.order, value: `#${orderNo}` },
      { label: t.date, value: date },
      { label: t.license, value: `${productName} · ${capitalize(String(claimed.plan_id))} · ${t.keysCount(keysCount)}` },
      { label: t.method, value: amount > 0 ? t.paypal : t.free },
      { label: t.delivery, value: t.deliveryText },
    ];
    const moneyRows: Row[] = [
      ...(discount > 0
        ? [
            { label: t.subtotal, value: money(amount + discount, currency) },
            { label: t.discount(coupon), value: `−${money(discount, currency)}`, accent: true },
          ]
        : []),
      { label: t.total, value: `${money(amount, currency)} ${currency}`, strong: true },
    ];
    const keys = (licenses ?? []).map((l: { license_key: string }) => l.license_key);

    const text = [
      t.heading,
      "",
      t.intro(firstName),
      "",
      ...details.map((r) => `${r.label}: ${r.value}`),
      ...moneyRows.map((r) => `${r.label}: ${r.value}`),
      ...(keys.length ? ["", `${t.keys}:`, ...keys] : []),
      "",
      `${t.button}: ${SITE}/cuenta/biblioteca`,
      "",
      t.legal,
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: emailFrom(),
        to: [to],
        // RECEIPT_REPLY_TO: correo que de verdad se lee (si no, las respuestas van al remitente)
        ...(Deno.env.get("RECEIPT_REPLY_TO") ? { reply_to: Deno.env.get("RECEIPT_REPLY_TO") } : {}),
        subject: `${isTest ? "[PRUEBA] " : ""}${t.subject(productName, orderNo)}`,
        html: layout({ t, name: firstName, isTest, details, money: moneyRows, keys }),
        text,
      }),
    });
    if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
    return "sent";
  } catch (err) {
    // no salió: se libera para poder reintentar
    await admin.from("purchases").update({ receipt_sent_at: null }).eq("id", purchaseId);
    throw err;
  }
}
