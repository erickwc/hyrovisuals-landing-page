import { useCallback, useEffect, useState } from "react";
import { usePrefs } from "../lib/prefs";
import { fetchPurchases, type Purchase } from "../lib/account-data";
import { Button } from "../components/Button";
import { FileCheck } from "../components/animate-ui/icons/hugeicons/file-check";

type Status = "loading" | "ready" | "empty" | "error";

export function Purchases() {
  const { c, lang } = usePrefs();
  const t = c.dashboard.purchases;
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(() => {
    setStatus("loading");
    fetchPurchases()
      .then((list) => {
        setPurchases(list);
        setStatus(list.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = { paid: t.statusPaid, pending: t.statusPending, refunded: t.statusRefunded };
  const formatDate = (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(iso));
  const formatAmount = (amount: number, currency: string) => new Intl.NumberFormat(lang, { style: "currency", currency }).format(amount);

  return (
    <div className="dash__section">
      <div className="dash__head">
        <p className="up dash__eyebrow">{t.eyebrow}</p>
        <h1 className="dash__title">{t.title}</h1>
        <p className="sub dash__sub">{t.subtitle}</p>
      </div>

      {status === "loading" && (
        <div className="purch-table">
          {[0, 1].map((i) => (
            <div key={i} className="purch-row purch-row--skel" aria-hidden="true">
              <div className="skel-line" style={{ width: "50%" }} />
              <div className="skel-line" style={{ width: "70px" }} />
              <div className="skel-line" style={{ width: "70px" }} />
              <div className="skel-line" style={{ width: "80px" }} />
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
        <div className="purch-table">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="purch-row">
              <div>
                <p className="purch-row__product">{purchase.productName}</p>
                <p className="purch-row__date">{formatDate(purchase.date)}</p>
              </div>
              <span>{formatAmount(purchase.amount, purchase.currency)}</span>
              <span className="status-badge" data-status={purchase.status}>
                {statusLabel[purchase.status]}
              </span>
              {purchase.invoiceUrl ? (
                <a className="ic sm" href={purchase.invoiceUrl} target="_blank" rel="noreferrer">
                  <FileCheck size={15} />
                  {t.viewInvoice}
                </a>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
