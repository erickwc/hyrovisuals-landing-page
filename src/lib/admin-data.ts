import { supabase } from "./supabase";

function db() {
  if (!supabase) throw new Error("Falta configurar Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  return supabase;
}

function sum(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

async function logAudit(action: string, entity: string, entityId: string, detail?: unknown) {
  const sb = db();
  const { data: userData } = await sb.auth.getUser();
  await sb.from("admin_audit_log").insert({ admin_id: userData.user?.id ?? null, action, entity, entity_id: entityId, detail: detail ?? null });
}

export type PurchaseStatus = "pending" | "paid" | "failed" | "refunded";

type RawPurchase = {
  id: string;
  created_at: string;
  paid_at: string | null;
  amount: number;
  fee_amount: number | null;
  net_amount: number | null;
  status: PurchaseStatus;
  provider: string | null;
  plan_id: string;
  settlement_id: string | null;
  user_id: string;
  profiles: { email: string } | null;
  settlements: { status: string } | null;
  coupon_id: string | null;
  discount_amount: number | null;
  coupons: { code: string } | null;
};

// `purchases.user_id` apunta a auth.users, no a profiles, así que PostgREST no puede
// incrustar profiles(email) automáticamente (no hay llave foránea entre esas dos tablas).
// Se consulta profiles aparte y se mezcla en el cliente.
const PURCHASE_SELECT =
  "id, created_at, paid_at, amount, fee_amount, net_amount, status, provider, plan_id, settlement_id, user_id, coupon_id, discount_amount, settlements(status), coupons(code)";

async function attachEmails<T extends { user_id: string }>(rows: T[]): Promise<(T & { profiles: { email: string } | null })[]> {
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  if (ids.length === 0) return rows.map((r) => ({ ...r, profiles: null }));
  const { data } = await db().from("profiles").select("id, email").in("id", ids);
  const byId = new Map((data ?? []).map((p) => [p.id, p.email]));
  return rows.map((r) => ({ ...r, profiles: byId.has(r.user_id) ? { email: byId.get(r.user_id)! } : null }));
}

export type OverviewData = {
  orders: number;
  grossAmount: number;
  feesAmount: number;
  refundsAmount: number;
  netEstimated: number;
  netReconciled: number;
  netAmount: number;
  partnerAShare: number;
  partnerBShare: number;
  availableToSettle: number;
  // Cuántas ventas pagadas forman lo disponible para repartir (aún sin corte).
  unsettledCount: number;
  daily: { date: string; gross: number; net: number }[];
  recent: RawPurchase[];
  byPlan: { plan_id: string; count: number; gross: number }[];
  previousPeriod: { orders: number; grossAmount: number; netAmount: number };
};

function previousWindow(startDate: string, endExclusive: string): { start: string; endExclusive: string } {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endExclusive + "T00:00:00Z");
  const lengthMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - lengthMs);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(prevStart), endExclusive: fmt(start) };
}

export async function fetchOverview(startDate: string, endExclusive: string): Promise<OverviewData> {
  const sb = db();

  const { data: paidRows, error: paidError } = await sb
    .from("purchases")
    .select(PURCHASE_SELECT)
    .eq("status", "paid")
    .gte("paid_at", startDate)
    .lt("paid_at", endExclusive);
  if (paidError) throw paidError;
  const paid = await attachEmails((paidRows ?? []) as unknown as Omit<RawPurchase, "profiles">[]);

  const { data: refundedRows, error: refundedError } = await sb
    .from("purchases")
    .select(PURCHASE_SELECT)
    .eq("status", "refunded")
    .gte("paid_at", startDate)
    .lt("paid_at", endExclusive);
  if (refundedError) throw refundedError;
  const refunded = await attachEmails((refundedRows ?? []) as unknown as Omit<RawPurchase, "profiles">[]);

  const unsettled = paid.filter((p) => !p.settlement_id);
  const reconciled = paid.filter((p) => p.settlement_id && p.settlements?.status === "completed");

  const netEstimated = sum(unsettled.map((p) => Number(p.net_amount ?? 0)));
  const netReconciled = sum(reconciled.map((p) => Number(p.net_amount ?? 0)));

  const dailyMap = new Map<string, { gross: number; net: number }>();
  for (const p of paid) {
    const date = (p.paid_at ?? p.created_at).slice(0, 10);
    const entry = dailyMap.get(date) ?? { gross: 0, net: 0 };
    entry.gross += Number(p.amount);
    entry.net += Number(p.net_amount ?? 0);
    dailyMap.set(date, entry);
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, gross: Math.round(v.gross * 100) / 100, net: Math.round(v.net * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const { data: recentRows } = await sb.from("purchases").select(PURCHASE_SELECT).order("created_at", { ascending: false }).limit(50);
  const recent = await attachEmails((recentRows ?? []) as unknown as Omit<RawPurchase, "profiles">[]);

  const byPlanMap = new Map<string, { count: number; gross: number }>();
  for (const p of paid) {
    const entry = byPlanMap.get(p.plan_id) ?? { count: 0, gross: 0 };
    entry.count += 1;
    entry.gross += Number(p.amount);
    byPlanMap.set(p.plan_id, entry);
  }
  const byPlan = Array.from(byPlanMap.entries()).map(([plan_id, v]) => ({ plan_id, count: v.count, gross: Math.round(v.gross * 100) / 100 }));

  const prev = previousWindow(startDate, endExclusive);
  const { data: prevRows } = await sb
    .from("purchases")
    .select("amount, net_amount")
    .eq("status", "paid")
    .gte("paid_at", prev.start)
    .lt("paid_at", prev.endExclusive);
  const previousPeriod = {
    orders: (prevRows ?? []).length,
    grossAmount: sum((prevRows ?? []).map((p) => Number(p.amount))),
    netAmount: sum((prevRows ?? []).map((p) => Number(p.net_amount ?? 0))),
  };

  return {
    orders: paid.length,
    grossAmount: sum(paid.map((p) => Number(p.amount))),
    feesAmount: sum(paid.map((p) => Number(p.fee_amount ?? 0))),
    refundsAmount: sum(refunded.map((p) => Number(p.amount))),
    netEstimated,
    netReconciled,
    netAmount: sum(paid.map((p) => Number(p.net_amount ?? 0))),
    // La parte de cada socio es sobre lo disponible para repartir (sin cortar aún),
    // no sobre lo ya repartido — así la tarjeta responde "si corto ahora, cuánto me toca".
    partnerAShare: Math.round((netEstimated / 2) * 100) / 100,
    partnerBShare: netEstimated - Math.round((netEstimated / 2) * 100) / 100,
    availableToSettle: netEstimated,
    unsettledCount: unsettled.length,
    daily,
    recent,
    byPlan,
    previousPeriod,
  };
}

export type SaleRow = RawPurchase;

export async function fetchSales(filters: { startDate?: string; endExclusive?: string; status?: PurchaseStatus | "all"; search?: string }): Promise<SaleRow[]> {
  const sb = db();
  let query = sb.from("purchases").select(PURCHASE_SELECT).order("created_at", { ascending: false });
  if (filters.startDate) query = query.gte("created_at", filters.startDate);
  if (filters.endExclusive) query = query.lt("created_at", filters.endExclusive);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw error;
  let rows = await attachEmails((data ?? []) as unknown as Omit<RawPurchase, "profiles">[]);
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    rows = rows.filter((r) => r.profiles?.email?.toLowerCase().includes(needle) || r.plan_id.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle));
  }
  return rows;
}

export async function markPurchaseRefunded(purchaseId: string) {
  const sb = db();
  const { error } = await sb.from("purchases").update({ status: "refunded" }).eq("id", purchaseId);
  if (error) throw error;
  await logAudit("mark_refunded", "purchase", purchaseId);
}

export type ProviderBreakdown = { provider: string | null; count: number; gross: number; fees: number; net: number };

export type FinancesSummary = {
  count: number;
  gross: number;
  fees: number;
  net: number;
  partnerAShare: number;
  partnerBShare: number;
  byProvider: ProviderBreakdown[];
};

export async function fetchFinancesSummary(startDate: string, endExclusive: string): Promise<FinancesSummary> {
  const sb = db();
  const { data, error } = await sb
    .from("purchases")
    .select("provider, amount, fee_amount, net_amount")
    .eq("status", "paid")
    .is("settlement_id", null)
    .gte("paid_at", startDate)
    .lt("paid_at", endExclusive);
  if (error) throw error;
  const rows = data ?? [];

  const byProviderMap = new Map<string | null, ProviderBreakdown>();
  for (const r of rows) {
    const entry = byProviderMap.get(r.provider) ?? { provider: r.provider, count: 0, gross: 0, fees: 0, net: 0 };
    entry.count += 1;
    entry.gross += Number(r.amount);
    entry.fees += Number(r.fee_amount ?? 0);
    entry.net += Number(r.net_amount ?? 0);
    byProviderMap.set(r.provider, entry);
  }
  const byProvider = Array.from(byProviderMap.values()).map((p) => ({
    ...p,
    gross: Math.round(p.gross * 100) / 100,
    fees: Math.round(p.fees * 100) / 100,
    net: Math.round(p.net * 100) / 100,
  }));

  const gross = sum(rows.map((r) => Number(r.amount)));
  const fees = sum(rows.map((r) => Number(r.fee_amount ?? 0)));
  const net = sum(rows.map((r) => Number(r.net_amount ?? 0)));
  const partnerAShare = Math.round((net / 2) * 100) / 100;

  return { count: rows.length, gross, fees, net, partnerAShare, partnerBShare: net - partnerAShare, byProvider };
}

export type GatewayFee = { provider: string; fee_percent: number; updated_at: string };

export async function fetchGatewayFees(): Promise<GatewayFee[]> {
  const { data, error } = await db().from("gateway_fees").select("*").order("provider");
  if (error) throw error;
  return data ?? [];
}

export async function updateGatewayFee(provider: string, feePercent: number) {
  const sb = db();
  const { error } = await sb.from("gateway_fees").update({ fee_percent: feePercent, updated_at: new Date().toISOString() }).eq("provider", provider);
  if (error) throw error;
  await logAudit("update_fee", "gateway_fee", provider, { feePercent });
}

export type Settlement = {
  id: string;
  period_start: string;
  period_end: string;
  status: "pending" | "completed";
  gross_amount: number;
  fees_amount: number;
  net_amount: number;
  partner_a_share: number;
  partner_b_share: number;
  partner_a_confirmed: boolean;
  partner_b_confirmed: boolean;
  created_at: string;
  completed_at: string | null;
};

export async function fetchSettlements(): Promise<Settlement[]> {
  const { data, error } = await db().from("settlements").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSettlement(periodStart: string, periodEnd: string, confirmedA: boolean, confirmedB: boolean): Promise<Settlement> {
  const sb = db();
  const { data, error } = await sb.rpc("admin_create_settlement", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_partner_a_confirmed: confirmedA,
    p_partner_b_confirmed: confirmedB,
  });
  if (error) throw error;
  const settlement = data as Settlement;
  await logAudit("create_settlement", "settlement", settlement.id, { periodStart, periodEnd, confirmedA, confirmedB });
  return settlement;
}

export type AdminPlan = { id: string; product_id: string; price_usd: number; license_count: number; active: boolean };

export async function fetchPlans(productId: string): Promise<AdminPlan[]> {
  const { data, error } = await db().from("plans").select("*").eq("product_id", productId).order("id");
  if (error) throw error;
  return (data ?? []) as AdminPlan[];
}

export async function createPlan(input: { productId: string; id: string; priceUsd: number; licenseCount: number }): Promise<AdminPlan> {
  const sb = db();
  const { data, error } = await sb
    .from("plans")
    .insert({ product_id: input.productId, id: input.id.trim(), price_usd: input.priceUsd, license_count: input.licenseCount, active: true })
    .select("*")
    .single();
  if (error) throw error;
  await logAudit("create_plan", "plan", data.id, input);
  return data;
}

export async function updatePlanPrice(productId: string, planId: string, newPrice: number) {
  const sb = db();
  const { data: current, error: currentError } = await sb.from("plans").select("price_usd").eq("product_id", productId).eq("id", planId).single();
  if (currentError) throw currentError;
  const oldPrice = Number(current.price_usd);

  const { error: updateError } = await sb.from("plans").update({ price_usd: newPrice }).eq("product_id", productId).eq("id", planId);
  if (updateError) throw updateError;

  const { data: userData } = await sb.auth.getUser();
  await sb.from("plan_price_history").insert({ product_id: productId, plan_id: planId, old_price: oldPrice, new_price: newPrice, changed_by: userData.user?.id ?? null });
  await logAudit("update_price", "plan", planId, { productId, oldPrice, newPrice });
}

// Edición completa de un plan. El id no cambia: compras y licencias lo referencian.
// Si cambia el precio pasa por updatePlanPrice, así queda en el historial de precios.
export async function updatePlan(productId: string, planId: string, input: { priceUsd: number; licenseCount: number; active: boolean }) {
  const sb = db();
  const { data: current, error: currentError } = await sb.from("plans").select("price_usd").eq("product_id", productId).eq("id", planId).single();
  if (currentError) throw currentError;
  if (Number(current.price_usd) !== input.priceUsd) await updatePlanPrice(productId, planId, input.priceUsd);
  const { error } = await sb.from("plans").update({ license_count: input.licenseCount, active: input.active }).eq("product_id", productId).eq("id", planId);
  if (error) throw error;
  await logAudit("update_plan", "plan", planId, { productId, licenseCount: input.licenseCount, active: input.active });
}

export async function fetchPlanPriceHistory(productId: string, planId: string) {
  const { data, error } = await db()
    .from("plan_price_history")
    .select("*")
    .eq("product_id", productId)
    .eq("plan_id", planId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type ClientRow = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  purchaseCount: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
};

export async function fetchClients(): Promise<ClientRow[]> {
  const sb = db();
  const { data: profiles, error: profilesError } = await sb.from("profiles").select("id, email, created_at, name, avatar_url");
  if (profilesError) throw profilesError;

  const { data: purchaseRows, error: purchasesError } = await sb.from("purchases").select("user_id, amount, paid_at, status").eq("status", "paid");
  if (purchasesError) throw purchasesError;

  const byUser = new Map<string, { count: number; total: number; last: string | null }>();
  for (const p of purchaseRows ?? []) {
    const entry = byUser.get(p.user_id) ?? { count: 0, total: 0, last: null };
    entry.count += 1;
    entry.total += Number(p.amount);
    if (!entry.last || (p.paid_at && p.paid_at > entry.last)) entry.last = p.paid_at;
    byUser.set(p.user_id, entry);
  }

  return (profiles ?? []).map((pr) => {
    const stats = byUser.get(pr.id) ?? { count: 0, total: 0, last: null };
    return {
      id: pr.id,
      email: pr.email,
      name: pr.name ?? null,
      avatarUrl: pr.avatar_url ?? null,
      createdAt: pr.created_at,
      purchaseCount: stats.count,
      totalSpent: Math.round(stats.total * 100) / 100,
      lastPurchaseAt: stats.last,
    };
  });
}

export type AdminLicense = {
  id: string;
  license_key: string;
  plan_id: string;
  product_id: string;
  created_at: string;
  status: "active" | "revoked";
  source: "purchase" | "manual";
  note: string | null;
  products: { name: string } | null;
  /** Equipo que la usa ahora mismo (solo la activación vigente). */
  activation: { id: string; device_name: string | null; platform: string | null; app_version: string | null; last_seen_at: string } | null;
};

const LICENSE_SELECT =
  "id, license_key, plan_id, product_id, created_at, status, source, note, products(name), license_activations(id, device_name, platform, app_version, last_seen_at, released_at)";

type LicenseRow = Omit<AdminLicense, "activation"> & {
  license_activations: (NonNullable<AdminLicense["activation"]> & { released_at: string | null })[] | null;
};
const toAdminLicense = ({ license_activations, ...l }: LicenseRow): AdminLicense => ({
  ...l,
  activation: (license_activations ?? []).find((a) => !a.released_at) ?? null,
});

/** Emite tantas claves como dice el plan, sin compra (regalos, soporte, pruebas). */
export async function adminIssueLicenses(input: { userId: string; productId: string; planId: string; note: string }) {
  const { error } = await db().rpc("admin_issue_licenses", {
    p_user_id: input.userId,
    p_product_id: input.productId,
    p_plan_id: input.planId,
    p_note: input.note,
  });
  if (error) throw error;
}

/** Revocar saca a la app del equipo en su próxima verificación (≤ 30 s). */
export async function adminSetLicenseStatus(licenseId: string, status: "active" | "revoked") {
  const { error } = await db().rpc("admin_set_license_status", { p_license_id: licenseId, p_status: status });
  if (error) throw error;
}

export async function adminReleaseActivation(activationId: string) {
  const { error } = await db().rpc("admin_release_activation", { p_activation_id: activationId });
  if (error) throw error;
}

export type ClientDetail = {
  profile: { id: string; email: string; createdAt: string };
  purchases: SaleRow[];
  licenses: AdminLicense[];
  reviews: { id: string; rating: number; comment: string; created_at: string }[];
};

export async function fetchClientDetail(userId: string): Promise<ClientDetail> {
  const sb = db();
  const [{ data: profile, error: profileError }, { data: purchases }, { data: licenses }, { data: reviews }] = await Promise.all([
    sb.from("profiles").select("id, email, created_at").eq("id", userId).single(),
    sb.from("purchases").select(PURCHASE_SELECT).eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("licenses").select(LICENSE_SELECT).eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("reviews").select("id, rating, comment, created_at").eq("user_id", userId),
  ]);
  if (profileError) throw profileError;

  const email = profile!.email;
  return {
    profile: { id: profile!.id, email, createdAt: profile!.created_at },
    purchases: ((purchases ?? []) as unknown as Omit<SaleRow, "profiles">[]).map((p) => ({ ...p, profiles: { email } })),
    licenses: ((licenses ?? []) as unknown as LicenseRow[]).map(toAdminLicense),
    reviews: reviews ?? [],
  };
}

export type AuditLogEntry = {
  id: string;
  admin_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: unknown;
  created_at: string;
};

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const { data, error } = await db().from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// reseñas (moderación)
// ---------------------------------------------------------------------------

export type AllReviewRow = {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  comment: string;
  hidden: boolean;
  created_at: string;
  profiles: { email: string } | null;
  product_name: string;
};

export async function fetchAllReviews(): Promise<AllReviewRow[]> {
  const sb = db();
  const { data, error } = await sb.from("reviews").select("id, user_id, product_id, rating, comment, hidden, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  const withEmails = await attachEmails((data ?? []) as { id: string; user_id: string; product_id: string; rating: number; comment: string; hidden: boolean; created_at: string }[]);

  const { data: products } = await sb.from("products").select("id, name");
  const nameById = new Map((products ?? []).map((p) => [p.id, p.name]));

  return withEmails.map((r) => ({ ...r, product_name: nameById.get(r.product_id) ?? "—" }));
}

export async function toggleReviewHidden(reviewId: string, hidden: boolean) {
  const sb = db();
  const { error } = await sb.from("reviews").update({ hidden }).eq("id", reviewId);
  if (error) throw error;
  await logAudit(hidden ? "hide_review" : "unhide_review", "review", reviewId);
}

// ---------------------------------------------------------------------------
// contenido y anuncios
// ---------------------------------------------------------------------------

export type Announcement = {
  id: string;
  title: string;
  body: string;
  status: "draft" | "scheduled" | "published" | "finished";
  audience: "general" | "buyers";
  placement: "landing_banner" | "library";
  product_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchAnnouncementsAdmin(): Promise<Announcement[]> {
  const { data, error } = await db().from("announcements").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type AnnouncementInput = {
  title: string;
  body: string;
  audience: "general" | "buyers";
  placement: "landing_banner" | "library";
  startsAt: string | null;
  endsAt: string | null;
};

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  const sb = db();
  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("announcements")
    .insert({
      title: input.title,
      body: input.body,
      // se publica al crearlo: aparece en la web de inmediato (sin borrador ni programación)
      status: "published",
      audience: input.audience,
      placement: input.placement,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      created_by: userData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await logAudit("create_announcement", "announcement", data.id, input);
  return data;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput) {
  const sb = db();
  const { error } = await sb
    .from("announcements")
    .update({
      title: input.title,
      body: input.body,
      audience: input.audience,
      placement: input.placement,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    })
    .eq("id", id);
  if (error) throw error;
  await logAudit("update_announcement", "announcement", id, input);
}

export async function setAnnouncementStatus(id: string, status: Announcement["status"]) {
  const sb = db();
  const { error } = await sb.from("announcements").update({ status }).eq("id", id);
  if (error) throw error;
  await logAudit("set_announcement_status", "announcement", id, { status });
}

// ---------------------------------------------------------------------------
// alertas: solo condiciones reales y verificables sobre los datos existentes
// ---------------------------------------------------------------------------

export type Alert = {
  id: string;
  kind: "missing_license" | "settlement_pending" | "recent_refund";
  message: string;
  link: string;
};

export async function fetchAlerts(): Promise<Alert[]> {
  const sb = db();
  const alerts: Alert[] = [];

  const [{ data: paidPurchases }, { data: licenseRows }] = await Promise.all([
    sb.from("purchases").select("id").eq("status", "paid"),
    sb.from("licenses").select("purchase_id"),
  ]);
  const licensedPurchaseIds = new Set((licenseRows ?? []).map((l) => l.purchase_id));
  for (const p of paidPurchases ?? []) {
    if (!licensedPurchaseIds.has(p.id)) {
      alerts.push({ id: `license-${p.id}`, kind: "missing_license", message: `Compra pagada sin licencia generada (${p.id.slice(0, 8)})`, link: "/admin/ventas" });
    }
  }

  const { data: pendingSettlements } = await sb.from("settlements").select("id, period_start, period_end").eq("status", "pending");
  for (const s of pendingSettlements ?? []) {
    alerts.push({
      id: `settlement-${s.id}`,
      kind: "settlement_pending",
      message: `Corte del ${s.period_start} al ${s.period_end} sigue pendiente de confirmar`,
      link: "/admin/finanzas",
    });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRefunds } = await sb.from("purchases").select("id, amount, created_at").eq("status", "refunded").gte("created_at", sevenDaysAgo);
  for (const r of recentRefunds ?? []) {
    alerts.push({ id: `refund-${r.id}`, kind: "recent_refund", message: `Reembolso reciente de ${formatUsd(Number(r.amount))}`, link: "/admin/ventas" });
  }

  return alerts;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(n);
}

// ---------------------------------------------------------------------------
// cupones de descuento
// ---------------------------------------------------------------------------

export type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  product_id: string | null;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export async function fetchCoupons(): Promise<Coupon[]> {
  const { data, error } = await db().from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type CouponInput = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  productId: string | null;
  maxUses: number | null;
  expiresAt: string | null;
};

export async function createCoupon(input: CouponInput): Promise<Coupon> {
  const sb = db();
  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("coupons")
    .insert({
      code: input.code.trim().toUpperCase(),
      discount_type: input.discountType,
      discount_value: input.discountValue,
      product_id: input.productId,
      max_uses: input.maxUses,
      expires_at: input.expiresAt,
      created_by: userData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await logAudit("create_coupon", "coupon", data.id, input);
  return data;
}

export async function setCouponActive(id: string, active: boolean): Promise<void> {
  const { error } = await db().from("coupons").update({ active }).eq("id", id);
  if (error) throw error;
  await logAudit(active ? "activate_coupon" : "deactivate_coupon", "coupon", id);
}

// ---------------------------------------------------------------------------
// versiones y actualizaciones (instaladores en Cloudflare R2)
// ---------------------------------------------------------------------------

export type InstallerPlatform = "windows" | "macos";
export type InstallerStatus = "pending" | "uploaded" | "failed";
export type VersionStatus = "draft" | "ready" | "published" | "previous" | "failed";

export type ProductOption = { id: string; slug: string; name: string; version: string };

export async function fetchProductOptions(): Promise<ProductOption[]> {
  const { data, error } = await db().from("products").select("id, slug, name, version").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(input: { slug: string; name: string; version: string }): Promise<ProductOption> {
  const sb = db();
  const { data, error } = await sb
    .from("products")
    .insert({ slug: input.slug.trim(), name: input.name.trim(), version: input.version.trim() || "1.0.0", image_path: "" })
    .select("id, slug, name, version")
    .single();
  if (error) throw error;
  await logAudit("create_product", "product", data.id, input);
  return data;
}

export type VersionInstaller = { platform: InstallerPlatform; status: InstallerStatus; size_bytes: number | null };

export type ProductVersion = {
  id: string;
  product_id: string;
  version: string;
  status: VersionStatus;
  changelog: string;
  created_at: string;
  published_at: string | null;
  installers: VersionInstaller[];
};

export async function fetchVersions(productId: string): Promise<ProductVersion[]> {
  const sb = db();
  const { data: versions, error } = await sb.from("product_versions").select("*").eq("product_id", productId).order("created_at", { ascending: false });
  if (error) throw error;

  const ids = (versions ?? []).map((v) => v.id);
  const { data: installers } = ids.length
    ? await sb.from("product_installers").select("version_id, platform, status, size_bytes").in("version_id", ids)
    : { data: [] as { version_id: string; platform: InstallerPlatform; status: InstallerStatus; size_bytes: number | null }[] };

  return (versions ?? []).map((v) => ({
    ...v,
    installers: (installers ?? []).filter((i) => i.version_id === v.id).map((i) => ({ platform: i.platform, status: i.status, size_bytes: i.size_bytes })),
  }));
}

export async function createVersionDraft(productId: string, version: string, changelog: string): Promise<ProductVersion> {
  const sb = db();
  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("product_versions")
    .upsert({ product_id: productId, version, changelog, created_by: userData.user?.id ?? null }, { onConflict: "product_id,version" })
    .select("*")
    .single();
  if (error) throw error;
  await logAudit("create_version_draft", "product_version", data.id, { productId, version });
  return { ...data, installers: [] };
}

// La ruta lleva el producto: dos productos con la misma versión y el mismo nombre de archivo no se pisan en R2.
// Los instaladores ya subidos conservan su ruta (la descarga usa la que quedó guardada en product_installers).
export function installerObjectKey(productSlug: string, version: string, platform: InstallerPlatform, filename: string): string {
  return `${productSlug}/${version}/${platform}/${filename}`;
}

export async function registerInstaller(versionId: string, platform: InstallerPlatform, objectKey: string): Promise<void> {
  const { error } = await db()
    .from("product_installers")
    .upsert({ version_id: versionId, platform, object_key: objectKey, status: "pending" }, { onConflict: "version_id,platform" });
  if (error) throw error;
}

export async function requestUploadUrl(objectKey: string): Promise<string> {
  const { data, error } = await db().functions.invoke<{ uploadUrl?: string; error?: string }>("r2-upload-url", { body: { key: objectKey } });
  if (error || !data?.uploadUrl) throw new Error(data?.error || error?.message || "No se pudo obtener la URL de subida");
  return data.uploadUrl;
}

// Un intento de subida directa a R2 con la URL presignada.
function putOnce(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Subida falló: ${xhr.status}`)));
    xhr.onerror = () => reject(Object.assign(new Error("network"), { network: true }));
    xhr.send(file);
  });
}

// La conexión con R2 se corta a ratos (fallos de TLS antes de enviar nada): se reintenta sola hasta 3 veces.
// La URL presignada dura 30 minutos, así que sirve para todos los intentos.
export async function uploadFileToR2(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  const attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      await putOnce(url, file, onProgress);
      return;
    } catch (err) {
      const network = (err as { network?: boolean }).network === true;
      if (!network) throw err;
      if (i === attempts) {
        throw new Error("Se cortó la conexión con el almacenamiento de instaladores varias veces. Revisa tu internet y vuelve a intentarlo.");
      }
      onProgress(0);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

export async function markInstallerUploaded(versionId: string, platform: InstallerPlatform, sizeBytes: number): Promise<void> {
  const sb = db();
  const { error } = await sb
    .from("product_installers")
    .update({ status: "uploaded", size_bytes: sizeBytes, uploaded_at: new Date().toISOString() })
    .eq("version_id", versionId)
    .eq("platform", platform);
  if (error) throw error;
  await logAudit("upload_installer", "product_installer", versionId, { platform, sizeBytes });
}

export async function publishVersion(versionId: string): Promise<ProductVersion> {
  const sb = db();
  const { data, error } = await sb.rpc("admin_publish_version", { p_version_id: versionId });
  if (error) throw error;
  await logAudit("publish_version", "product_version", versionId, { version: (data as ProductVersion).version });
  return { ...(data as ProductVersion), installers: [] };
}
