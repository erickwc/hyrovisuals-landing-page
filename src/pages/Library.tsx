import { useCallback, useEffect, useState } from "react";
import { usePrefs } from "../lib/prefs";
import { fetchLibrary, type Product } from "../lib/account-data";
import { fetchActiveAnnouncements, type PublicAnnouncement } from "../lib/announcements";
import { Button } from "../components/Button";
import { ProductBoard } from "../components/ProductBoard";
import { ShoppingBag } from "../components/animate-ui/icons/hugeicons/shopping-bag";
import { Megaphone } from "../components/animate-ui/icons/hugeicons/megaphone";

type Status = "loading" | "ready" | "empty" | "error";

export function Library() {
  const { c } = usePrefs();
  const t = c.dashboard.library;
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);

  const load = useCallback(() => {
    setStatus("loading");
    fetchLibrary()
      .then((list) => {
        setProducts(list);
        setStatus(list.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("error"));
    fetchActiveAnnouncements("library").then(setAnnouncements);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="dash__section">
      <div className="dash__head">
        <p className="up dash__eyebrow">{t.eyebrow}</p>
        <h1 className="dash__title">{t.title}</h1>
      </div>

      {announcements.length > 0 && (
        <div className="lib-announce">
          {announcements.map((a) => (
            <p key={a.id}>
              <Megaphone size={15} />
              <span>
                <b>{a.title}</b> {a.body}
              </span>
            </p>
          ))}
        </div>
      )}

      {status === "loading" && (
        <div className="lib-product lib-product--skel" aria-hidden="true">
          <div className="lib-product__head">
            <div className="lib-product__photo skel-block" />
            <div className="lib-product__info">
              <div className="skel-line" style={{ width: 160 }} />
              <div className="skel-line" style={{ width: 90 }} />
            </div>
          </div>
          <div className="lib-product__grid">
            <div className="lib-product__block">
              <div className="skel-line" style={{ width: "50%" }} />
            </div>
            <div className="lib-product__block">
              <div className="skel-line" style={{ width: "60%" }} />
            </div>
          </div>
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
        <div className="lib-list">
          {products.map((product) => (
            <ProductBoard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
