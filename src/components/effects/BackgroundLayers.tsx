/**
 * Фоновый fixed-слой: только мягкая виньетка по краям. Сетка и scanlines
 * убраны — пользователь Ariy жаловался на «полосы» в дизайне, поэтому
 * оставили только этот один pointer-events:none слой.
 */
export function BackgroundLayers() {
  return <div className="vignette" />;
}
