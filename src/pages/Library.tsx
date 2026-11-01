import { useCallback, useEffect, useState } from "react";
import { usePrefs } from "../lib/prefs";
import { fetchLibrary, type Product } from "../lib/account-data";
import { asset } from "../lib/asset";
import { Button } from "../components/Button";
import { PhotoSlot } from "../components/ui";
import { Layers01 } from "../components/animate-ui/icons/hugeicons/layers-01";
import { ShoppingBag } from "../components/animate-ui/icons/hugeicons/shopping-bag";

type Status = "loading" | "ready" | "empty" | "error";

export function Library() {
  const { c } = usePrefs();
  const t = c.dashboard.library;
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const load = useCallback(() => {
    setStatus("loading");
    fetchLibrary()
      .then((list) => {
        setProducts(list);
        setStatus(list.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="dash__section">
      <div className="dash__head">
        <p className="up dash__eyebrow">{t.eyebrow}</p>
        <h1 className="dash__title">{t.title}</h1>
        <p className="sub dash__sub">{t.subtitle}</p>
      </div>

      {status === "loading" && (
        <div className="lib-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="lib-card lib-card--skel" aria-hidden="true">
              <div className="lib-card__photo" />
              <div className="lib-card__body">
                <div className="skel-line" style={{ width: "70%" }} />
                <div className="skel-line" style={{ width: "40%" }} />
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
          <ShoppingBag size={28} className="dash-state__icon" />
          <p className="dash-state__title">{t.empty.title}</p>
          <p className="sub">{t.empty.subtitle}</p>
          <Button href="/" size="sm">
            {t.empty.cta}
          </Button>
        </div>
      )}

      {status === "ready" && (
        <div className="lib-grid">
          {products.map((product) => (
            <article key={product.id} className="lib-card">
              <PhotoSlot
                className="lib-card__photo"
                src={asset(product.image)}
                alt={product.name}
                pendingLabel={t.imagePending}
                fallback={<Layers01 size={26} />}
              />
              <div className="lib-card__body">
                <h3 className="lib-card__name">{product.name}</h3>
                <span className="lib-card__tag">
                  {product.licenses.length > 1
                    ? `${c.buy.plans[product.licenses[0].planId].name} · ${product.licenses.length}`
                    : c.buy.plans[product.licenses[0].planId].name}
                </span>
                <div className="lib-card__foot">
                  <Button href={`/cuenta/biblioteca/${product.slug}`} variant="ghost" size="sm" arrow>
                    {t.viewDetails}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
