import { useEffect, useState } from "react";
import { fetchActiveAnnouncements, type PublicAnnouncement } from "../lib/announcements";
import { Cancel01 } from "./animate-ui/icons/hugeicons/cancel-01";
import "../styles/announcement-banner.css";

const KEY = "hyro.announcement.dismissed";

export function AnnouncementBanner() {
  const [item, setItem] = useState<PublicAnnouncement | null>(null);

  useEffect(() => {
    let live = true;
    fetchActiveAnnouncements("landing_banner").then((list) => {
      if (!live || list.length === 0) return;
      const dismissed = sessionStorage.getItem(KEY);
      const next = list.find((a) => a.id !== dismissed);
      if (next) setItem(next);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!item) return null;

  const onDismiss = () => {
    try {
      sessionStorage.setItem(KEY, item.id);
    } catch {
      /* sin almacenamiento: se vuelve a mostrar en la próxima carga */
    }
    setItem(null);
  };

  return (
    <div className="ann-banner" role="region" aria-label={item.title}>
      <p>
        <b>{item.title}</b> {item.body}
      </p>
      <button type="button" onClick={onDismiss} aria-label="Cerrar aviso">
        <Cancel01 size={14} />
      </button>
    </div>
  );
}
