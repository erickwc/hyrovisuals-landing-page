import type { PlanId } from "../data/content";
import { supabase } from "./supabase";

export type Platform = "windows" | "mac";

export type License = {
  id: string;
  planId: PlanId;
  key: string;
  /** Activada en un equipo ahora mismo. El servidor de licencias de la app todavía no lo guarda en esta base: siempre false. */
  inUse: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  version: string;
  /** Ruta relativa a /public, ej. "media/productos/hyro-visuals.jpg". */
  image: string;
  changelog: string | null;
  hasUnseenVersion: boolean;
  licenses: License[];
};

export type PurchaseStatus = "paid" | "pending" | "refunded" | "failed";

export type Purchase = {
  id: string;
  productSlug: string;
  productName: string;
  /** Ruta relativa a /public de la foto del producto; vacía si no tiene. */
  productImage: string;
  planId: string;
  /** Cuándo se confirmó el pago (o cuándo se creó, si no hay confirmación). */
  date: string;
  /** Monto cobrado, ya con el descuento aplicado. */
  amount: number;
  discount: number;
  /** Código del cupón usado, si hubo (null también si la base aún no tiene la función que lo expone). */
  couponCode: string | null;
  currency: string;
  status: PurchaseStatus;
  platform: "wompi" | "paypal";
  /** Número de la transacción en la pasarela. */
  reference: string | null;
  invoiceUrl: string | null;
};

/** Número corto del pedido que ve el cliente (los primeros 8 caracteres del id). */
export const orderNumber = (purchase: Purchase) => purchase.id.slice(0, 8).toUpperCase();

export type Review = {
  rating: number;
  comment: string;
  updatedAt: string;
};

function db() {
  if (!supabase) throw new Error("Falta configurar Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  return supabase;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await db().auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchLibrary(): Promise<Product[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const sb = db();

  const { data, error } = await sb
    .from("licenses")
    .select("id, plan_id, license_key, products(id, slug, name, version, image_path)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false }); // la clave más reciente va primero en la biblioteca
  if (error) throw error;

  const byProduct = new Map<string, Product>();
  for (const row of data ?? []) {
    const p = row.products as unknown as { id: string; slug: string; name: string; version: string; image_path: string } | null;
    if (!p) continue;

    if (!byProduct.has(p.id)) {
      byProduct.set(p.id, {
        id: p.id,
        slug: p.slug,
        name: p.name,
        version: p.version,
        image: p.image_path,
        changelog: null,
        hasUnseenVersion: false,
        licenses: [],
      });
    }
    byProduct.get(p.id)!.licenses.push({ id: row.id, planId: row.plan_id as PlanId, key: row.license_key, inUse: false });
  }

  const products = Array.from(byProduct.values());
  if (products.length === 0) return products;

  const productIds = products.map((p) => p.id);
  const [{ data: versions }, { data: reads }] = await Promise.all([
    sb.from("product_versions").select("id, product_id, changelog").eq("status", "published").in("product_id", productIds),
    sb.from("product_version_reads").select("product_id, version_id").eq("user_id", userId).in("product_id", productIds),
  ]);
  const versionByProduct = new Map((versions ?? []).map((v) => [v.product_id, v]));
  const readByProduct = new Map((reads ?? []).map((r) => [r.product_id, r.version_id]));

  for (const p of products) {
    const version = versionByProduct.get(p.id);
    if (!version) continue;
    p.changelog = version.changelog || null;
    p.hasUnseenVersion = readByProduct.get(p.id) !== version.id;
  }

  return products;
}

export async function fetchDownloadUrl(productId: string, platform: Platform): Promise<string> {
  const r2Platform = platform === "mac" ? "macos" : "windows";
  const { data, error } = await db().functions.invoke<{ downloadUrl?: string; error?: string }>("r2-download-url", {
    body: { productId, platform: r2Platform },
  });
  if (error || !data?.downloadUrl) throw new Error(data?.error || error?.message || "No se pudo generar el enlace de descarga");
  return data.downloadUrl;
}

export async function markVersionSeen(productId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const sb = db();
  const { data: version } = await sb.from("product_versions").select("id").eq("product_id", productId).eq("status", "published").maybeSingle();
  if (!version) return;
  await sb
    .from("product_version_reads")
    .upsert({ user_id: userId, product_id: productId, version_id: version.id, seen_at: new Date().toISOString() }, { onConflict: "user_id,product_id" });
}

export async function fetchPurchases(): Promise<Purchase[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const [{ data, error }, { data: coupons }] = await Promise.all([
    db()
      .from("purchases")
      .select("id, amount, discount_amount, currency, status, platform, plan_id, wompi_transaction_id, invoice_url, created_at, paid_at, products(slug, name, image_path)")
      .eq("user_id", userId)
      .eq("status", "paid")
      .order("created_at", { ascending: false }),
    // si la función no existe todavía (migración 0009 sin aplicar), simplemente no hay códigos
    db().rpc("my_purchase_coupons"),
  ]);
  if (error) throw error;
  const couponByPurchase = new Map(((coupons ?? []) as { purchase_id: string; code: string }[]).map((row) => [row.purchase_id, row.code]));

  return (data ?? []).map((row) => {
    const product = row.products as unknown as { slug: string; name: string; image_path: string } | null;
    return {
      id: row.id,
      productSlug: product?.slug ?? "",
      productName: product?.name ?? "",
      productImage: product?.image_path ?? "",
      planId: row.plan_id,
      date: row.paid_at ?? row.created_at,
      amount: Number(row.amount),
      discount: Number(row.discount_amount ?? 0),
      couponCode: couponByPurchase.get(row.id) ?? null,
      currency: row.currency,
      status: row.status as PurchaseStatus,
      platform: row.platform as Purchase["platform"],
      reference: row.wompi_transaction_id,
      invoiceUrl: row.invoice_url,
    };
  });
}

export async function fetchReview(productId: string): Promise<Review | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await db()
    .from("reviews")
    .select("rating, comment, updated_at")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { rating: data.rating, comment: data.comment, updatedAt: data.updated_at };
}

export async function deleteReview(productId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("No autenticado");
  const { error } = await db().from("reviews").delete().eq("user_id", userId).eq("product_id", productId);
  if (error) throw error;
}

export async function saveReview(productId: string, rating: number, comment: string): Promise<Review> {
  const userId = await currentUserId();
  if (!userId) throw new Error("No autenticado");

  const { data, error } = await db()
    .from("reviews")
    .upsert({ user_id: userId, product_id: productId, rating, comment }, { onConflict: "user_id,product_id" })
    .select("rating, comment, updated_at")
    .single();
  if (error) throw error;
  return { rating: data.rating, comment: data.comment, updatedAt: data.updated_at };
}
