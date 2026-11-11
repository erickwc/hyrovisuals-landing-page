import { useEffect, useState } from "react";
import { usePrefs } from "../lib/prefs";
import { asset } from "../lib/asset";
import { deleteReview, fetchDownloadUrl, fetchReview, markVersionSeen, platformName, releaseActivation, saveReview } from "../lib/account-data";
import type { License, Product } from "../lib/account-data";
import { Button } from "./Button";
import { MiniModal } from "./MiniModal";
import { AppleIcon, WindowsIcon } from "./HugeIcons";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { Copy01 } from "./animate-ui/icons/hugeicons/copy-01";
import { Check } from "./animate-ui/icons/hugeicons/check";
import { Star } from "./animate-ui/icons/hugeicons/star";
import { View } from "./animate-ui/icons/hugeicons/view";
import { EyeOff } from "./animate-ui/icons/hugeicons/eye-off";
import { CircleCheckBig } from "./animate-ui/icons/hugeicons/circle-check-big";
import { Delete02 } from "./animate-ui/icons/hugeicons/delete-02";

type ReviewStatus = "idle" | "submitting" | "error" | "confirmDelete" | "deleting" | "deleteError";

/* Un producto de la biblioteca: nombre y versión; instaladores | clave de activación; y la reseña del cliente abajo.
   Se ve la clave en uso (o la más reciente); si hay más, "Ver todas" las abre en una mini ventana. La reseña se escribe en otra.
   Las mini ventanas se abren pegadas al botón que las abre, como en el admin. */
export function ProductBoard({ product }: { product: Product }) {
  const { c } = usePrefs();
  const t = c.dashboard.product;

  const [photoFailed, setPhotoFailed] = useState(false);
  const [downloading, setDownloading] = useState<"windows" | "mac" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [shownKeys, setShownKeys] = useState<Set<string>>(() => new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keysAnchor, setKeysAnchor] = useState<HTMLElement | null>(null);
  // liberar un equipo: primer clic pide confirmar, el segundo libera
  const [released, setReleased] = useState<Set<string>>(() => new Set());
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<{ id: string; text: string } | null>(null);

  const [reviewAnchor, setReviewAnchor] = useState<HTMLElement | null>(null);
  const [saved, setSaved] = useState({ rating: 0, comment: "" });
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("idle");
  const [reviewNotice, setReviewNotice] = useState<"saved" | "deleted" | null>(null);

  // la que está activada primero; las demás de la más reciente a la más antigua
  const keys = product.licenses
    .map((l) => (released.has(l.id) ? { ...l, inUse: false, activation: null } : l))
    .sort((a, b) => Number(b.inUse) - Number(a.inUse));
  const license = keys[0];
  // en la mini ventana, las claves agrupadas por plan: el nombre del plan una sola vez
  const groups = keys.reduce<{ planId: License["planId"]; items: License[] }[]>((acc, item) => {
    const group = acc.find((g) => g.planId === item.planId);
    if (group) group.items.push(item);
    else acc.push({ planId: item.planId, items: [item] });
    return acc;
  }, []);

  useEffect(() => {
    if (product.hasUnseenVersion) markVersionSeen(product.id);
    fetchReview(product.id)
      .then((review) => {
        if (!review) return;
        setSaved({ rating: review.rating, comment: review.comment });
        setRating(review.rating);
        setComment(review.comment);
      })
      .catch(() => {});
  }, [product.id, product.hasUnseenVersion]);

  useEffect(() => {
    if (!reviewNotice) return;
    const id = setTimeout(() => setReviewNotice(null), 4000);
    return () => clearTimeout(id);
  }, [reviewNotice]);

  const onDownload = async (platform: "windows" | "mac") => {
    setDownloading(platform);
    setDownloadError(null);
    try {
      window.location.href = await fetchDownloadUrl(product.id, platform);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "No se pudo generar el enlace de descarga");
    } finally {
      setDownloading(null);
    }
  };

  const toggleShown = (id: string) =>
    setShownKeys((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const onCopy = (item: License) => {
    navigator.clipboard?.writeText(item.key).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 2000);
    });
  };

  const onRelease = async (item: License) => {
    if (!item.activation) return;
    if (confirmRelease !== item.id) return setConfirmRelease(item.id);
    setReleasing(item.id);
    setReleaseError(null);
    try {
      await releaseActivation(item.activation.id);
      setReleased((cur) => new Set(cur).add(item.id));
      setConfirmRelease(null);
    } catch (err) {
      const limit = err instanceof Error && err.message === "release_limit";
      setReleaseError({ id: item.id, text: limit ? t.releaseLimit : t.releaseError });
    } finally {
      setReleasing(null);
    }
  };

  // en qué equipo está activada la clave, con el botón para liberarlo
  const deviceRow = (item: License) =>
    item.activation && (
      <div className="key-device">
        <span className="key-device__name">
          {t.activeOn} <strong>{item.activation.deviceName || t.unknownDevice}</strong>
          {item.activation.platform && ` · ${platformName(item.activation.platform)}`}
        </span>
        <button
          type="button"
          className="key-device__release"
          data-confirm={confirmRelease === item.id}
          disabled={releasing === item.id}
          onClick={() => onRelease(item)}
          onBlur={() => setConfirmRelease((cur) => (cur === item.id && releasing !== item.id ? null : cur))}
        >
          {releasing === item.id ? t.releasing : confirmRelease === item.id ? t.releaseConfirm : t.release}
        </button>
        {releaseError?.id === item.id && (
          <span className="key-device__error" role="alert">
            {releaseError.text}
          </span>
        )}
      </div>
    );

  const inUseTag = (item: License) =>
    item.inUse && (
      <span className="key-status">
        <CircleCheckBig size={12} />
        {t.inUse}
      </span>
    );

  // píldora con el ojo, la clave (oculta hasta pedirla), si está en uso y copiar
  const keyField = (item: License, withStatus = false) => {
    const shown = shownKeys.has(item.id);
    const copied = copiedId === item.id;
    return (
      <div className="key-field">
        <AnimateIcon animateOnHover asChild>
          <button type="button" className="key-field__eye" aria-label={shown ? t.hideKey : t.showKey} aria-pressed={shown} onClick={() => toggleShown(item.id)}>
            {shown ? <EyeOff size={16} /> : <View size={16} />}
          </button>
        </AnimateIcon>
        <code className="key-field__key">{shown ? item.key : item.key.replace(/[^-]/g, "•")}</code>
        {withStatus && inUseTag(item)}
        <AnimateIcon animateOnHover asChild>
          <button type="button" className="key-field__copy" onClick={() => onCopy(item)} data-copied={copied}>
            {copied ? <Check size={15} /> : <Copy01 size={15} />}
            <span aria-live="polite">{copied ? t.copied : t.copy}</span>
          </button>
        </AnimateIcon>
      </div>
    );
  };

  const toggleReview = (el: HTMLElement) => {
    if (reviewAnchor) return setReviewAnchor(null);
    setRating(saved.rating);
    setComment(saved.comment);
    setReviewStatus("idle");
    setReviewAnchor(el);
  };

  const onSubmitReview = async () => {
    if (rating === 0) return;
    setReviewStatus("submitting");
    try {
      const review = await saveReview(product.id, rating, comment);
      setSaved({ rating: review.rating, comment: review.comment });
      setReviewStatus("idle");
      setReviewAnchor(null);
      setReviewNotice("saved");
    } catch {
      setReviewStatus("error");
    }
  };

  const onDeleteReview = async () => {
    setReviewStatus("deleting");
    try {
      await deleteReview(product.id);
      setSaved({ rating: 0, comment: "" });
      setRating(0);
      setComment("");
      setReviewStatus("idle");
      setReviewAnchor(null);
      setReviewNotice("deleted");
    } catch {
      setReviewStatus("deleteError");
    }
  };

  const shownRating = hoverRating || rating;
  const busy = reviewStatus === "submitting" || reviewStatus === "deleting";
  const confirming = reviewStatus === "confirmDelete" || reviewStatus === "deleting";

  return (
    <article className="lib-product">
      <header className="lib-product__head">
        {product.image && !photoFailed && (
          <img className="lib-product__photo" src={asset(product.image)} alt="" decoding="async" onError={() => setPhotoFailed(true)} />
        )}
        <div className="lib-product__info">
          <h2 className="lib-product__name">
            {product.name}
            {product.hasUnseenVersion && <span className="lib-card__badge">Nueva versión</span>}
          </h2>
          <span className="lib-product__version">
            {t.version} {product.version}
          </span>
        </div>
        <span className="verified-badge">{t.verifiedBadge}</span>
      </header>

      <div className="lib-product__grid">
        <section className="lib-product__block" aria-labelledby={`dl-${product.id}`}>
          <h3 className="lib-product__title" id={`dl-${product.id}`}>
            {t.downloads}
          </h3>
          <div className="lib-product__downloads">
            <Button variant="ghost" size="sm" onClick={() => onDownload("windows")} loading={downloading === "windows"} disabled={downloading !== null}>
              {downloading !== "windows" && <WindowsIcon width={16} height={16} />}
              {t.downloadWindows}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDownload("mac")} loading={downloading === "mac"} disabled={downloading !== null}>
              {downloading !== "mac" && <AppleIcon width={16} height={16} />}
              {t.downloadMac}
            </Button>
          </div>
          {downloadError && (
            <p className="auth__msg" data-tone="error">
              {downloadError}
            </p>
          )}
        </section>

        {license && (
          <section className="lib-product__block" aria-labelledby={`key-${product.id}`}>
            <div className="lib-product__title-row">
              <h3 className="lib-product__title" id={`key-${product.id}`}>
                {t.license}
              </h3>
              {inUseTag(license)}
            </div>
            <div className="lib-product__keys">
              {keyField(license)}
              {product.licenses.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  data-mini-trigger
                  aria-haspopup="dialog"
                  aria-expanded={Boolean(keysAnchor)}
                  onClick={(e) => {
                    const el = e.currentTarget;
                    setKeysAnchor((cur) => (cur ? null : el));
                  }}
                >
                  {t.viewAllKeys}
                </Button>
              )}
            </div>
            {deviceRow(license)}
          </section>
        )}
      </div>

      <section className="lib-product__block lib-product__review" aria-labelledby={`rv-${product.id}`}>
        <div className="lib-product__review-body">
          <h3 className="lib-product__title" id={`rv-${product.id}`}>
            {t.myReview}
          </h3>
          {saved.rating > 0 ? (
            <div className="lib-product__review-text">
              <span className="lib-product__rating" role="img" aria-label={`${saved.rating} / 5`}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star key={value} size={14} fill="currentColor" stroke="none" data-on={value <= saved.rating} />
                ))}
              </span>
              {saved.comment && <p className="lib-product__comment">{saved.comment}</p>}
            </div>
          ) : (
            <p className="lib-product__comment">{t.noReview}</p>
          )}
          {reviewNotice && (
            <p className="lib-product__saved" role="status">
              {reviewNotice === "deleted" ? t.reviewDeleted : t.reviewSuccess}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" data-mini-trigger aria-expanded={Boolean(reviewAnchor)} onClick={(e) => toggleReview(e.currentTarget)}>
          {saved.rating > 0 ? t.edit : t.addReview}
        </Button>
      </section>

      {product.changelog && (
        <section className="lib-product__block">
          <h3 className="lib-product__title">{t.changelog}</h3>
          <p className="lib-product__comment">{product.changelog}</p>
        </section>
      )}

      <MiniModal open={Boolean(keysAnchor)} anchor={keysAnchor} onClose={() => setKeysAnchor(null)} title={t.licenses} bodyClassName="mini-keys">
        <ul className="mini-keys__list">
          {groups.map((group) => (
            <li key={group.planId} className="mini-keys__group">
              <span className="mini-keys__plan">{c.buy.plans[group.planId]?.name ?? group.planId}</span>
              {group.items.map((item) => (
                <div key={item.id} className="mini-keys__item">
                  {keyField(item, true)}
                  {deviceRow(item)}
                </div>
              ))}
            </li>
          ))}
        </ul>
      </MiniModal>

      <MiniModal
        open={Boolean(reviewAnchor)}
        anchor={reviewAnchor}
        onClose={() => setReviewAnchor(null)}
        locked={busy}
        title={t.reviewTitle}
        wide
        footer={
          confirming ? (
            // confirmación en el mismo pie: no abre otra ventana encima
            <>
              <span className="review-form__confirm">{t.deleteConfirm}</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setReviewStatus("idle")}>
                {t.deleteCancel}
              </Button>
              <Button size="sm" loading={reviewStatus === "deleting"} onClick={onDeleteReview}>
                {reviewStatus === "deleting" ? t.deleting : t.deleteYes}
              </Button>
            </>
          ) : (
            <>
              {saved.rating > 0 && (
                <button type="button" className="review-form__delete" disabled={busy} onClick={() => setReviewStatus("confirmDelete")}>
                  <Delete02 size={14} />
                  {t.deleteReview}
                </button>
              )}
              <Button size="sm" disabled={rating === 0} loading={reviewStatus === "submitting"} onClick={onSubmitReview}>
                {reviewStatus === "submitting" ? t.submitting : t.submitReview}
              </Button>
            </>
          )
        }
      >
        <div className="review-form">
          <div className="review-form__intro">
            <p className="review-form__desc">{t.reviewSubtitle}</p>
            <div className="stars" role="radiogroup" aria-label={t.ratingLabel} onPointerLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <AnimateIcon key={value} animateOnHover asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={value === rating}
                    aria-label={`${value} / 5`}
                    data-active={value <= shownRating}
                    onPointerEnter={() => setHoverRating(value)}
                    onClick={() => setRating(value)}
                  >
                    <Star size={18} fill="currentColor" stroke="none" />
                  </button>
                </AnimateIcon>
              ))}
            </div>
          </div>

          <textarea aria-label={t.commentLabel} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.commentPlaceholder} />

          {(reviewStatus === "error" || reviewStatus === "deleteError") && (
            <p className="auth__msg" data-tone="error">
              {reviewStatus === "error" ? t.reviewError : t.deleteError}
            </p>
          )}
        </div>
      </MiniModal>
    </article>
  );
}
