import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { asset } from "../lib/asset";
import { fetchPurchases, orderNumber, type Purchase } from "../lib/account-data";
import type { AccountContext } from "../lib/useSession";
import type { PlanId } from "../data/content";
import { Button } from "../components/Button";
import { downloadInvoicePdf } from "../lib/invoice-pdf";
import { AnimateIcon } from "../components/animate-ui/icons/icon";
import { ArrowDown01 } from "../components/animate-ui/icons/hugeicons/arrow-down-01";
import { Download01 } from "../components/animate-ui/icons/hugeicons/download-01";

type Status = "loading" | "ready" | "empty" | "error";

/* Historial de compras: cada compra es un tablero; la cabecera (foto, nombre, estado, monto y factura) lo despliega
   con el cliente, el pago y el resumen. La factura se descarga directo como PDF con forma de ticket. */
export function Purchases() {
  const { c, lang } = usePrefs();
  const t = c.dashboard.purchases;
  const account = useOutletContext<AccountContext>();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [openId, setOpenId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Purchase | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(() => new Set());

  const load = useCallback(() => {
    setStatus("loading");
    fetchPurchases()
      .then((list) => {
        setPurchases(list);
        setOpenId(list[0]?.id ?? null);
        setStatus(list.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = { paid: t.statusPaid, pending: t.statusPending, refunded: t.statusRefunded, failed: t.statusFailed };
  const formatDate = (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(iso));
  const formatTime = (iso: string) => new Intl.DateTimeFormat(lang, { timeStyle: "short" }).format(new Date(iso));
  const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat(lang, { style: "currency", currency }).format(amount);
  const planName = (planId: string) => c.buy.plans[planId as PlanId]?.name ?? planId;
  const methodName = (purchase: Purchase) =>
    purchase.provider ? purchase.provider.charAt(0).toUpperCase() + purchase.provider.slice(1) : purchase.amount === 0 ? t.methodCoupon : t.methodNone;

  const onInvoice = (e: MouseEvent, purchase: Purchase) => {
    e.stopPropagation();
    if (purchase.invoiceUrl) {
      window.open(purchase.invoiceUrl, "_blank", "noopener");
      return;
    }
    setInvoiceError(null);
    setGenerating(purchase);
    downloadInvoicePdf({ purchase, customer: { name: account.name, email: account.email }, planName: planName(purchase.planId), methodName: methodName(purchase), t, lang })
      .catch(() => setInvoiceError(purchase.id))
      .finally(() => setGenerating(null));
  };

  const row = (label: string, value: string, className = "purch-dl__row") => (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <div className="dash__section">
      <div className="dash__head">
        <p className="up dash__eyebrow">{t.eyebrow}</p>
        <h1 className="dash__title">{t.title}</h1>
        <p className="sub dash__sub">{t.subtitle}</p>
      </div>

      {status === "loading" && (
        <div className="purch-list">
          {[0, 1].map((i) => (
            <div key={i} className="purch purch--skel" aria-hidden="true">
              <div className="purch__head">
                <div className="purch__info">
                  <div className="skel-line" style={{ width: 140 }} />
                  <div className="skel-line" style={{ width: 90 }} />
                </div>
                <div className="skel-line" style={{ width: 70 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="dash-state">
          <p>{t.error}</p>
          <Button variant="ghost" size="sm" onClick={load}>
            {t.retry}
          </Button>
        </div>
      )}

      {status === "empty" && (
        <div className="dash-state">
          <p>{t.empty}</p>
        </div>
      )}

      {status === "ready" && (
        <div className="purch-list">
          {purchases.map((purchase) => {
            const open = openId === purchase.id;
            const detailsId = `purch-${purchase.id}`;
            const toggle = () => setOpenId(open ? null : purchase.id);
            const isGenerating = generating?.id === purchase.id;
            return (
              <article key={purchase.id} className="purch" data-open={open}>
                {/* toda la cabecera abre y cierra; el botón de la flecha es el control accesible */}
                <div className="purch__head" onClick={toggle}>
                  {purchase.productImage && !brokenPhotos.has(purchase.id) && (
                    <img
                      className="purch__photo"
                      src={asset(purchase.productImage)}
                      alt=""
                      decoding="async"
                      onError={() => setBrokenPhotos((cur) => new Set(cur).add(purchase.id))}
                    />
                  )}
                  <span className="purch__info">
                    <span className="purch__name">{purchase.productName}</span>
                    <span className="purch__meta">
                      {t.planLabel(planName(purchase.planId))} · {formatDate(purchase.date)}
                    </span>
                  </span>
                  <span className="status-badge" data-status={purchase.status}>
                    {purchase.status === "paid" && purchase.amount === 0 ? t.statusFree : statusLabel[purchase.status]}
                  </span>
                  <span className="purch__amount">{formatAmount(purchase.amount, purchase.currency)}</span>
                  <Button variant="ghost" size="sm" onClick={(e) => onInvoice(e, purchase)} loading={isGenerating}>
                    {!isGenerating && <Download01 size={15} />}
                    {isGenerating ? t.preparing : t.downloadInvoice}
                  </Button>
                  <AnimateIcon animateOnHover asChild>
                    <button
                      type="button"
                      className="purch__toggle"
                      aria-expanded={open}
                      aria-controls={detailsId}
                      aria-label={t.toggleDetails}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle();
                      }}
                    >
                      <ArrowDown01 size={16} />
                    </button>
                  </AnimateIcon>
                </div>

                {invoiceError === purchase.id && (
                  <p className="auth__msg purch__error" data-tone="error" role="alert">
                    {t.invoiceError}
                  </p>
                )}

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="details"
                      id={detailsId}
                      className="purch__details"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <div className="purch__grid">
                        <section className="purch__block">
                          <h3 className="lib-product__title purch__title">{t.customer}</h3>
                          <dl className="purch-dl">
                            {row(t.nameLabel, account.name || "—")}
                            {row(t.emailLabel, account.email)}
                          </dl>
                        </section>
                        <section className="purch__block">
                          <h3 className="lib-product__title purch__title">{t.payment}</h3>
                          <dl className="purch-dl">
                            {row(t.order, `#${orderNumber(purchase)}`)}
                            {row(t.methodLabel, methodName(purchase))}
                            {row(t.dateLabel, formatDate(purchase.date))}
                            {row(t.timeLabel, formatTime(purchase.date))}
                            {purchase.reference && row(t.referenceLabel, purchase.reference)}
                          </dl>
                        </section>
                        <section className="purch__block">
                          <h3 className="lib-product__title purch__title">{t.summary}</h3>
                          <dl className="purch-dl">
                            {row(t.planLabel(planName(purchase.planId)), formatAmount(purchase.amount + purchase.discount, purchase.currency))}
                            {purchase.discount > 0 &&
                              row(
                                purchase.couponCode ? t.couponLabel(purchase.couponCode) : t.discountLabel,
                                `−${formatAmount(purchase.discount, purchase.currency)}`,
                              )}
                            {row(t.totalLabel, formatAmount(purchase.amount, purchase.currency), "purch-dl__row purch-dl__total")}
                          </dl>
                        </section>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      )}

    </div>
  );
}
