import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { plans, type PlanId } from "../data/content";
import { EASE, Reveal, SplitHeading } from "./ui";
import { Button } from "./Button";
import { LockKeyhole } from "./animate-ui/icons/hugeicons/lock-keyhole";
import "../styles/pricing.css";

const payments = ["Visa", "Mastercard", "PayPal"];

type LandingPlan = { id: string; price: number; keys: number };

// Planes de respaldo (sin Supabase o si la consulta falla). Los reales salen de la tabla plans,
// así lo que se cree o se oculte en el panel admin aparece aquí sin tocar el código.
const FALLBACK_PLANS: LandingPlan[] = plans.map((p) => ({ id: p.id, price: p.price, keys: p.keys }));
const PRODUCT_SLUG = "hyro-visuals";

export function Pricing() {
  const { c } = usePrefs();
  const b = c.buy;
  const reduce = useReducedMotion();
  const [list, setList] = useState<LandingPlan[]>(FALLBACK_PLANS);
  const [plan, setPlan] = useState<string>("personal");
  const cur = list.find((p) => p.id === plan) ?? list[0];
  const [amount, setAmount] = useState(0);
  const [showCoupon, setShowCoupon] = useState(false);
  const [coupon, setCoupon] = useState("");
  const navigate = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const pass = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { once: true, margin: "0px 0px -15% 0px" });

  useEffect(() => {
    let active = true;
    (async () => {
      // supabase-js se carga aparte para no frenar la primera pintura de la landing
      const { supabase: sb } = await import("../lib/supabase");
      if (!sb) return;
      const { data: product } = await sb.from("products").select("id").eq("slug", PRODUCT_SLUG).maybeSingle();
      if (!product) return;
      const { data } = await sb.from("plans").select("id, price_usd, license_count").eq("product_id", product.id).eq("active", true).order("price_usd");
      if (!active || !data || data.length === 0) return;
      const live = data.map((r) => ({ id: r.id as string, price: Number(r.price_usd), keys: Number(r.license_count) }));
      setList(live);
      setPlan((current) => (live.some((p) => p.id === current) ? current : live[0].id));
    })().catch(() => {
      /* sin conexión: se quedan los planes de respaldo */
    });
    return () => {
      active = false;
    };
  }, []);

  // Textos del plan: los escritos a mano si el plan coincide con el de siempre; si no, se arman con sus claves.
  const text = (p: LandingPlan) => {
    const known = plans.find((s) => s.id === p.id && s.keys === p.keys);
    if (known) return b.plans[known.id as PlanId];
    return { name: p.id.charAt(0).toUpperCase() + p.id.slice(1).replace(/-/g, " "), ...b.planFallback(p.keys) };
  };
  const cents = Math.round((cur.price % 1) * 100)
    .toString()
    .padStart(2, "0");

  // el pago se hace en el checkout propio; allí se pide la sesión si falta
  const onBuy = () => {
    navigate(`/checkout?plan=${encodeURIComponent(cur.id)}`, { state: { coupon: coupon.trim() || undefined } });
  };

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(amount, Math.floor(cur.price), { duration: reduce ? 0 : 0.8, ease: EASE, onUpdate: (v) => setAmount(Math.round(v)) });
    return () => ctrl.stop();
    // amount se lee solo como punto de partida de la animación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, cur.price, reduce]);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse" || !wrap.current || !pass.current) return;
    const r = wrap.current.getBoundingClientRect();
    pass.current.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 9}deg`);
    pass.current.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 9}deg`);
  };
  const leave = () => {
    pass.current?.style.setProperty("--ry", "0deg");
    pass.current?.style.setProperty("--rx", "0deg");
  };

  const onKey = (e: KeyboardEvent) => {
    const i = list.findIndex((p) => p.id === cur.id);
    if (["ArrowDown", "ArrowRight"].includes(e.key)) setPlan(list[(i + 1) % list.length].id);
    else if (["ArrowUp", "ArrowLeft"].includes(e.key)) setPlan(list[(i - 1 + list.length) % list.length].id);
    else return;
    e.preventDefault();
  };

  return (
    <section id="licencias" aria-labelledby="buy-title" className="tight">
      <div className="tapes" aria-hidden="true">
        <div className="tape a1">
          <div className="run">
            <span>{b.tape1.repeat(8)}</span>
            <span>{b.tape1.repeat(8)}</span>
          </div>
        </div>
        <div className="tape a2">
          <div className="run">
            <span>{b.tape2.repeat(8)}</span>
            <span>{b.tape2.repeat(8)}</span>
          </div>
        </div>
      </div>

      <div className="wrap buy-grid">
        <div className="buy-l">
          <SplitHeading lines={["HYRO", "VISUALS"]} id="buy-title" className="big" />
          <Reveal delay={0.1}>
            <p className="buy-lead">{b.lead}</p>
          </Reveal>
          <ul className="perks" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {text(cur).perks.map((t, i) => (
                <motion.li key={cur.id + i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.35, ease: EASE, delay: i * 0.05 }}>
                  {t}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <ul className="guar">
            {b.guarantees.map((g, i) => (
              <Reveal as="li" key={g.title} delay={i * 0.06} y={14}>
                <b>{g.title}</b>
                <span>{g.text}</span>
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="pass-wrap" ref={wrap} onPointerMove={move} onPointerLeave={leave}>
          <Reveal y={40}>
            <div className="pass" ref={pass}>
              <span className="sticker">{b.sticker}</span>
              <div className="pt">
                <span className="up">{b.choose}</span>
                <div role="radiogroup" aria-label={b.choose} onKeyDown={onKey}>
                  {list.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={cur.id === p.id}
                      tabIndex={cur.id === p.id ? 0 : -1}
                      className="opt"
                      onClick={() => setPlan(p.id)}
                    >
                      <span className="r" />
                      <b>{text(p).name}</b>
                      <em>{b.keys(p.keys)}</em>
                      <small>{text(p).desc}</small>
                    </button>
                  ))}
                </div>
                <p className="fine">{b.note}</p>
              </div>
              <div className="perf" />
              <div className="pb">
                <div className="price">
                  <b aria-label={`${Math.floor(cur.price)},${cents} US$`}>{amount}</b>
                  <span>
                    ,{cents} US$<i>{b.once}</i>
                  </span>
                </div>
                {showCoupon ? (
                  <div className="coupon-field">
                    <input
                      type="text"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                      placeholder={b.couponPlaceholder}
                      aria-label={b.couponPlaceholder}
                    />
                  </div>
                ) : (
                  <button type="button" className="coupon-toggle" onClick={() => setShowCoupon(true)}>
                    {b.couponToggle}
                  </button>
                )}
                <Button className="buy-btn" onClick={onBuy} arrow>
                  {b.buy}
                </Button>
                <div className="pay" aria-label={b.pay}>
                  {payments.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
                <p className="secure">
                  <LockKeyhole size={14} aria-hidden="true" />
                  {b.secure}
                </p>
                <div className="code" aria-hidden="true" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
