/**
 * Сигнальные столбики (4 палочки разной высоты) — индикатор пинга
 * как в мобильных интерфейсах. Заменяет старую пару PingBadge + цветную
 * точку доступности на компактный визуальный градиент.
 *
 * Уровни:
 *   < 80мс       → 4 зелёных
 *   80-149мс     → 3 зелёных, 1 dim
 *   150-299мс    → 2 жёлтых, 2 dim
 *   ≥300мс       → 1 красный, 3 dim
 *   null / loading → все dim
 */
export function SignalBars({ ms }: { ms: number | null | undefined }) {
  const { level, color } = (() => {
    if (ms == null) return { level: 0, color: "dim" as const };
    if (ms < 80) return { level: 4, color: "green" as const };
    if (ms < 150) return { level: 3, color: "green" as const };
    if (ms < 300) return { level: 2, color: "yellow" as const };
    return { level: 1, color: "red" as const };
  })();

  return (
    <span
      className={`signal-bars signal-bars-${color}`}
      aria-label={ms != null ? `${ms} ms` : "no signal"}
      title={ms != null ? `${ms} ms` : ""}
    >
      <span className={`signal-bar bar1${level >= 1 ? " is-on" : ""}`} />
      <span className={`signal-bar bar2${level >= 2 ? " is-on" : ""}`} />
      <span className={`signal-bar bar3${level >= 3 ? " is-on" : ""}`} />
      <span className={`signal-bar bar4${level >= 4 ? " is-on" : ""}`} />
    </span>
  );
}
