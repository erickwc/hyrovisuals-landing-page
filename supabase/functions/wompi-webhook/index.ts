// Webhook público de Wompi (con su firma verificada): registra la compra pagada cuando el pago se aprueba.
// El trigger `purchases_handle_paid` (ver migración) genera las licencias automáticamente.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firstKeyFrom, hmacSha256Hex } from "../_shared/wompi.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const secret = Deno.env.get("WOMPI_API_SECRET")!;
  const expectedHash = await hmacSha256Hex(secret, rawBody);
  const receivedHash = req.headers.get("wompi_hash") ?? "";

  if (expectedHash.toLowerCase() !== receivedHash.toLowerCase()) {
    return new Response("Firma inválida", { status: 401 });
  }

  let payload: {
    IdTransaccion?: string;
    ResultadoTransaccion?: string;
    EnlacePago?: { IdentificadorEnlaceComercio?: string };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const reference = payload.EnlacePago?.IdentificadorEnlaceComercio;
  if (!reference) return new Response("Sin referencia de compra", { status: 400 });

  const approved = payload.ResultadoTransaccion === "ExitosaAprobada";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, firstKeyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"));

  const fees = async (amount: number) => {
    const { data: fee } = await admin.from("gateway_fees").select("fee_percent").eq("platform", "wompi").single();
    const feePercent = Number(fee?.fee_percent ?? 0);
    const feeAmount = Math.round(amount * (feePercent / 100) * 100) / 100;
    return { fee_percent: feePercent, fee_amount: feeAmount, net_amount: Math.round((amount - feeAmount) * 100) / 100 };
  };

  // El descuento ya se aplicó al monto en wompi-create-link; aquí solo se registra el uso
  // del cupón (no bloquea la confirmación del pago si por algún motivo ya no es válido).
  const redeem = async (couponId: string | null, productId: string, purchaseId: string) => {
    if (!couponId) return;
    const { data: coupon } = await admin.from("coupons").select("code").eq("id", couponId).single();
    if (!coupon) return;
    const { error: redeemError } = await admin.rpc("redeem_coupon", { p_code: coupon.code, p_product_id: productId });
    if (redeemError) {
      await admin.from("admin_audit_log").insert({
        action: "coupon_redeem_failed",
        entity: "coupon",
        entity_id: couponId,
        detail: { purchaseId, error: redeemError.message },
      });
    }
  };

  // Enlaces nuevos (v2): la compra no existe hasta aquí. Solo se crea si el pago se aprobó; un rechazo no deja nada.
  // Formato de la referencia: v2|usuario|producto|plan|cupón|monto|descuento|aleatorio (la arma wompi-create-link).
  if (reference.startsWith("v2|")) {
    if (!approved) return new Response("ok", { status: 200 });
    const [, userId, productId, planId, couponId, amountText, discountText] = reference.split("|");
    const amount = Number(amountText);
    const transactionId = payload.IdTransaccion ?? null;

    // Wompi reintenta el webhook: si esta transacción ya se registró, no se duplica
    if (transactionId) {
      const { data: existing } = await admin.from("purchases").select("id").eq("wompi_transaction_id", transactionId).maybeSingle();
      if (existing) return new Response("ok", { status: 200 });
    }

    const { data: purchase, error } = await admin
      .from("purchases")
      .insert({
        user_id: userId,
        product_id: productId,
        plan_id: planId,
        amount,
        coupon_id: couponId || null,
        discount_amount: discountText ? Number(discountText) : null,
        currency: "USD",
        status: "paid",
        wompi_transaction_id: transactionId,
        paid_at: new Date().toISOString(),
        ...(await fees(amount)),
      })
      .select("id")
      .single();
    // un choque con el índice único de wompi_transaction_id es un reintento que llegó a la vez: ya quedó registrado
    if (error) return new Response(error.code === "23505" ? "ok" : "No se pudo registrar la compra", { status: error.code === "23505" ? 200 : 500 });
    await redeem(couponId || null, productId, purchase.id);
    return new Response("ok", { status: 200 });
  }

  // Enlaces anteriores: la referencia es el id de una compra «pending» creada al abrir el pago.
  const purchaseId = reference;
  const update: Record<string, unknown> = {
    status: approved ? "paid" : "failed",
    wompi_transaction_id: payload.IdTransaccion ?? null,
  };

  if (approved) {
    const { data: purchase } = await admin.from("purchases").select("amount, product_id, coupon_id").eq("id", purchaseId).single();
    Object.assign(update, await fees(Number(purchase?.amount ?? 0)), { paid_at: new Date().toISOString() });
    if (purchase) await redeem(purchase.coupon_id, purchase.product_id, purchaseId);
  }

  // El filtro status=pending hace el webhook idempotente ante reintentos de Wompi.
  await admin.from("purchases").update(update).eq("id", purchaseId).eq("status", "pending");

  return new Response("ok", { status: 200 });
});
