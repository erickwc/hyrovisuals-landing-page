import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { asset } from "../lib/asset";
import { fetchProduct, fetchReview, saveReview, type Product, type Review } from "../lib/account-data";
import { Button } from "../components/Button";
import { PhotoSlot } from "../components/ui";
import { AppleIcon, WindowsIcon } from "../components/HugeIcons";
import { ArrowLeft02 } from "../components/animate-ui/icons/hugeicons/arrow-left-02";
import { Layers01 } from "../components/animate-ui/icons/hugeicons/layers-01";
import { KeyRound } from "../components/animate-ui/icons/hugeicons/key-round";
import { Copy01 } from "../components/animate-ui/icons/hugeicons/copy-01";
import { Check } from "../components/animate-ui/icons/hugeicons/check";
import { Star } from "../components/animate-ui/icons/hugeicons/star";
import { PencilEdit02 } from "../components/animate-ui/icons/hugeicons/pencil-edit-02";
import { BadgeCheck } from "../components/animate-ui/icons/hugeicons/badge-check";

type Status = "loading" | "ready" | "error" | "notFound";
type ReviewStatus = "idle" | "submitting" | "success" | "error";

export function ProductDetail() {
  const { c } = usePrefs();
  const t = c.dashboard.product;
  const { slug = "" } = useParams();

  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hasReview, setHasReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("idle");

  const load = useCallback(() => {
    setStatus("loading");
    fetchProduct(slug)
      .then((p) => {
        if (!p) {
          setStatus("notFound");
          return;
        }
        setProduct(p);
        setStatus("ready");
        return fetchReview(p.id).then((review: Review | null) => {
          if (review) {
            setRating(review.rating);
            setComment(review.comment);
            setHasReview(true);
          }
        });
      })
      .catch(() => setStatus("error"));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const onCopy = (id: string, key: string) => {
    navigator.clipboard?.writeText(key).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    });
  };

  const onSubmitReview = async () => {
    if (!product || rating === 0) return;
    setReviewStatus("submitting");
    try {
      await saveReview(product.id, rating, comment);
      setHasReview(true);
      setReviewStatus("success");
    } catch {
      setReviewStatus("error");
    }
  };

  if (status === "loading") return <p className="dash-state">{c.dashboard.library.loading}</p>;

  if (status === "error") {
    return (
      <div className="dash-state">
        <p>{c.dashboard.library.error}</p>
        <Button variant="ghost" size="sm" onClick={load}>
          {c.dashboard.library.retry}
        </Button>
      </div>
    );
  }

  if (status === "notFound" || !product) {
    return (
      <div className="dash-state">
        <p>{t.notFound}</p>
        <Button href="/cuenta/biblioteca" variant="ghost" size="sm">
          {t.back}
        </Button>
      </div>
    );
  }

  return (
    <div className="pd">
      <Link className="pd__back" to="/cuenta/biblioteca">
        <ArrowLeft02 size={16} />
        {t.back}
      </Link>

      <div className="pd__head">
        <PhotoSlot
          className="pd__photo"
          src={asset(product.image)}
          alt={product.name}
          pendingLabel={c.dashboard.library.imagePending}
          fallback={<Layers01 size={30} />}
        />
        <div className="pd__info">
          <h1 className="pd__name">{product.name}</h1>
          <span className="pd__version">
            {t.version} {product.version}
          </span>
        </div>
      </div>

      <section className="pd__section">
        <h2 className="pd__section-title">{t.downloads}</h2>
        <div className="pd__downloads">
          {product.downloads.windows && (
            <Button href={product.downloads.windows} variant="ghost">
              <WindowsIcon width={17} height={17} />
              {t.downloadWindows}
            </Button>
          )}
          {product.downloads.mac && (
            <Button href={product.downloads.mac} variant="ghost">
              <AppleIcon width={17} height={17} />
              {t.downloadMac}
            </Button>
          )}
        </div>
      </section>

      <section className="pd__section">
        <h2 className="pd__section-title">
          <KeyRound size={16} />
          {t.licenses}
        </h2>
        <div className="pd__licenses">
          {product.licenses.map((license) => (
            <div key={license.id} className="license-card">
              <code className="license-card__key">{license.key}</code>
              <div className="license-card__meta">
                <span>{c.buy.plans[license.planId].name}</span>
                <button type="button" className="ic sm" onClick={() => onCopy(license.id, license.key)}>
                  {copiedId === license.id ? <Check size={15} /> : <Copy01 size={15} />}
                  {copiedId === license.id ? t.copied : t.copy}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pd__section">
        <h2 className="pd__section-title">
          <PencilEdit02 size={16} />
          {t.reviewTitle}
        </h2>
        <span className="verified-badge">
          <BadgeCheck size={14} />
          {t.verifiedBadge}
        </span>
        <p className="sub">{t.reviewSubtitle}</p>

        <div className="review-form">
          <div className="field">
            <label>{t.ratingLabel}</label>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" data-active={value <= rating} onClick={() => setRating(value)} aria-label={`${value}`}>
                  <Star size={22} />
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="review-comment">{t.commentLabel}</label>
            <textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.commentPlaceholder} />
          </div>

          <Button size="sm" disabled={rating === 0 || reviewStatus === "submitting"} onClick={onSubmitReview}>
            {reviewStatus === "submitting" ? t.submitting : hasReview ? t.updateReview : t.submitReview}
          </Button>

          {reviewStatus === "success" && <p className="auth__msg" data-tone="ok">{t.reviewSuccess}</p>}
          {reviewStatus === "error" && <p className="auth__msg" data-tone="error">{t.reviewError}</p>}
        </div>
      </section>
    </div>
  );
}
