import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { EASE, HyroStrip, SplitHeading } from "./ui";
import { Button } from "./Button";
import { AppleIcon, WindowsIcon } from "./HugeIcons";
import "../styles/hero.css";

const stripParams = { primary: "#ff2a3d", secondary: "#f4f2ef", sensitivityDb: 2, motion: 1, smoothing: 0.55 };
const stripPanels = ["spectrum", "stereo", "pixels", "vu", "levels", "bands", "trail"] as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: EASE, delay },
});

function useNarrow(query = "(max-width: 640px)") {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

/* Orden: frase, descripción, botones y, debajo, el visual. */
export function Hero() {
  const { c } = usePrefs();
  const [paused, setPaused] = useState(false);
  const narrow = useNarrow();

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__text">
        <motion.div className="hero__os" role="group" aria-label={c.features.platform} {...rise(0)}>
          <i>
            <AppleIcon />
            {c.features.mac}
          </i>
          <i>
            <WindowsIcon />
            {c.features.win}
          </i>
        </motion.div>
        <motion.p className="up hero__kicker" {...rise(0.05)}>
          {c.hero.kicker}
        </motion.p>
        <SplitHeading as="h1" id="hero-title" className="hero__title" lines={c.hero.title} immediate delay={0.12} />
        <motion.p className="hero__sub" {...rise(0.3)}>
          {c.hero.sub}
        </motion.p>
        <motion.div className="hero__acts" {...rise(0.42)}>
          <Button href="#licencias" size="lg" arrow>
            {c.hero.buy}
          </Button>
          <Button href="#preview" variant="ghost" size="lg">
            {c.hero.preview}
          </Button>
        </motion.div>
      </div>

      <motion.div className="strip-w" {...rise(0.58)}>
        <div className="strip" onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)} onPointerLeave={() => setPaused(false)}>
          <HyroStrip className="strip__canvas" panels={[...stripPanels]} params={stripParams} label={c.hero.stripLabel} minPanelWidth={narrow ? 62 : 120} gap={narrow ? 14 : 22} paused={paused} />
        </div>
      </motion.div>
    </section>
  );
}

