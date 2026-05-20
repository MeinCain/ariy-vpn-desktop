import { useEffect, useRef, useState } from "react";
import { useVpnStore } from "../stores/vpnStore";

/**
 * Таймер сессии подключения «HH:MM:SS» как в Chrome-расширении Ariy.
 *
 * Отсчёт начинается при переходе `status → "running"` и сбрасывается
 * на 0 при любом другом статусе. Backend не tracks момент `connectedAt`,
 * поэтому таймер локально-honest: показывает «сколько прошло с момента
 * как UI увидел подключение». Для отображения этого достаточно.
 */
export function ConnectionTimer() {
  const status = useVpnStore((s) => s.status);
  const startRef = useRef<number | null>(null);
  const [text, setText] = useState("00:00:00");

  useEffect(() => {
    if (status === "running") {
      // Начало новой сессии — сохраняем момент.
      if (startRef.current == null) startRef.current = Date.now();
      const tick = () => {
        const start = startRef.current;
        if (start == null) return;
        const sec = Math.floor((Date.now() - start) / 1000);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const pad = (n: number) => String(n).padStart(2, "0");
        setText(`${pad(h)}:${pad(m)}:${pad(s)}`);
      };
      tick();
      const id = window.setInterval(tick, 1000);
      return () => window.clearInterval(id);
    }
    // Любой не-running статус → сбрасываем счётчик.
    startRef.current = null;
    setText("00:00:00");
  }, [status]);

  return <div className="connection-timer">{text}</div>;
}
