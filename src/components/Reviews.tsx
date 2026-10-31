import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { fetchReviews, summarize, type Review, type ReviewRole } from "../lib/reviewsDb";
import { EASE, Reveal, SplitHeading } from "./ui";
import "../styles/reviews.css";

type Filter = "all" | ReviewRole;
const PAGE = 6;
const roles: ReviewRole[] = ["producer", "dj", "creator"];

export function Reviews() {
  const { c, lang } = usePrefs();
  const r = c.reviews;
  const [list, setList] = useState<Review[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const top = useRef<HTMLDivElement>(null);
  const seen = useInView(top, { once: true, margin: "0px 0px -10% 0px" });

  useEffect(() => {
    let live = true;
    fetchReviews().then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, []);

  const stats = useMemo(() => (list ? summarize(list) : null), [list]);
  const filtered = useMemo(() => (list ?? []).filter((x) => filter === "all" || x.role === filter), [list, filter]);
  const date = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });

  return (
    <section id="resenas" aria-labelledby="reviews-title">
      <div className="wrap">
        <SplitHeading lines={[r.title]} id="reviews-title" />
        <Reveal delay={0.1}>
          <p className="sub">{r.sub}</p>
        </Reveal>

        <div className="rvs-bar" ref={top}>
          <div className="rvs-score">
            <p>
              <b>{stats ? stats.avg.toFixed(1) : "–"}</b>
              <span>/5</span>
            </p>
            <small>{stats ? r.count(stats.count) : r.loading}</small>
          </div>
          <div className="rvs-bars">
            {[5, 4, 3, 2, 1].map((s, i) => {
              const p = stats && stats.count ? stats.dist[i] / stats.count : 0;
              return (
                <div key={s}>
                  <span>{s}</span>
                  <u>
                    <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: seen ? p : 0 }} transition={{ duration: 1, ease: EASE, delay: 0.1 + i * 0.06 }} />
                  </u>
                </div>
              );
            })}
          </div>
          <div className="rvs-tabs" role="group" aria-label={r.title}>
            {(["all", ...roles] as Filter[]).map((k) => (
              <button
                key={k}
                type="button"
                className="fl"
                aria-pressed={filter === k}
                onClick={() => {
                  setFilter(k);
                  setShown(PAGE);
                }}
              >
                {r.filters[k]}
              </button>
            ))}
          </div>
        </div>

        {!list ? (
          <ul className="rvs-grid" aria-busy="true" aria-label={r.loading}>
            {[0, 1, 2, 3].map((i) => (
              <li className="rvs-item skel" key={i} aria-hidden="true">
                <i />
                <i />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <p className="sub">{r.empty}</p>
        ) : (
          <>
            <ul className="rvs-grid" aria-live="polite">
              {filtered.slice(0, shown).map((x) => (
                <li key={x.id} className="rvs-item">
                  <blockquote>{x.text}</blockquote>
                  <div className="rvs-foot">
                    <span>
                      <b>{x.name}</b> · {r.roles[x.role]} · {date(x.date)}
                    </span>
                    <em title={r.verified}>
                      {x.rating}/5<span className="sr-only"> · {r.verified}</span>
                    </em>
                  </div>
                </li>
              ))}
            </ul>
            {shown < filtered.length && (
              <div className="rvs-more">
                <button type="button" className="btn ghost" onClick={() => setShown((s) => s + PAGE)}>
                  {r.more}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
