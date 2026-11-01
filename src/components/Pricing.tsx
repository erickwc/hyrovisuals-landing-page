import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { plans, type PlanId } from "../data/content";
import { EASE, Reveal, SplitHeading } from "./ui";
import { Button } from "./Button";
import { LockKeyhole } from "./animate-ui/icons/hugeicons/lock-keyhole";
import "../styles/pricing.css";

const payments = ["Visa", "Mastercard", "PayPal"];

export function Pricing() {
  const { c } = usePrefs();
  const b = c.buy;
  const reduce = useReducedMotion();
  const [plan, setPlan] = useState<PlanId>("personal");
  const cur = plans.find((p) => p.id === plan)!;
  const [amount, setAmount] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const pass = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { once: true, margin: "0px 0px -15% 0px" });

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(amount, cur.price, { duration: reduce ? 0 : 0.8, ease: EASE, onUpdate: (v) => setAmount(Math.round(v)) });
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
    const i = plans.findIndex((p) => p.id === plan);
    if (["ArrowDown", "ArrowRight"].includes(e.key)) setPlan(plans[(i + 1) % plans.length].id);
    else if (["ArrowUp", "ArrowLeft"].includes(e.key)) setPlan(plans[(i - 1 + plans.length) % plans.length].id);
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
              {b.plans[plan].perks.map((t, i) => (
                <motion.li key={plan + i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.35, ease: EASE, delay: i * 0.05 }}>
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
                  {plans.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} tabIndex={plan === p.id ? 0 : -1} className="opt" onClick={() => setPlan(p.id)}>
                      <span className="r" />
                      <b>{b.plans[p.id].name}</b>
                      <em>{b.keys(p.keys)}</em>
                      <small>{b.plans[p.id].desc}</small>
                    </button>
                  ))}
                </div>
                <p className="fine">{b.note}</p>
              </div>
              <div className="perf" />
              <div className="pb">
                <div className="price">
                  <b aria-label={`${cur.price},00 US$`}>{amount}</b>
                  <span>
                    ,00 US$<i>{b.once}</i>
                  </span>
                </div>
                <Button className="buy-btn" href="/checkout/" arrow>
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
