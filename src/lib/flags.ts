// Ariy: рендер SVG-флагов из public/flags/ вместо эмодзи 🇩🇪.
// Windows + Chromium-WebView без emoji-flag glyphs показывает «DE» буквами
// — поэтому копируем SVG-набор из расширения и резолвим их по эмодзи,
// которую обычно содержит имя сервера ("🇩🇪 Германия").

const REGIONAL_INDICATOR_BASE = 0x1f1e6; // 🇦
const A_CHAR_CODE = "A".charCodeAt(0);

/** Достать первый flag-emoji из строки. Возвращает null если в строке
 *  не нашлось пары regional-indicator codepoints. */
export function extractFlagEmoji(text: string | null | undefined): string | null {
  if (!text) return null;
  const cps = [...text].map((c) => c.codePointAt(0)!);
  for (let i = 0; i < cps.length - 1; i++) {
    const a = cps[i];
    const b = cps[i + 1];
    if (
      a >= REGIONAL_INDICATOR_BASE &&
      a <= REGIONAL_INDICATOR_BASE + 25 &&
      b >= REGIONAL_INDICATOR_BASE &&
      b <= REGIONAL_INDICATOR_BASE + 25
    ) {
      return String.fromCodePoint(a, b);
    }
  }
  return null;
}

/** Флаг-emoji → ISO-3166-1 alpha-2 ("de"). */
export function flagEmojiToCode(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  const cps = [...emoji].map((ch) => ch.codePointAt(0)!);
  if (cps.length < 2) return null;
  const a = cps[0] - REGIONAL_INDICATOR_BASE + A_CHAR_CODE;
  const b = cps[1] - REGIONAL_INDICATOR_BASE + A_CHAR_CODE;
  if (a < A_CHAR_CODE || a > A_CHAR_CODE + 25) return null;
  if (b < A_CHAR_CODE || b > A_CHAR_CODE + 25) return null;
  return String.fromCharCode(a, b).toLowerCase();
}

/** Путь к SVG-флагу в bundle или null если не нашли. */
export function flagSvgPath(emojiOrText: string | null | undefined): string | null {
  const emoji = extractFlagEmoji(emojiOrText);
  const code = flagEmojiToCode(emoji);
  if (!code) return null;
  return `/flags/${code}.svg`;
}

/** Убрать flag-emoji + лидирующие/трейлинг пробелы из имени сервера
 *  ("🇩🇪 Германия" → "Германия"). */
export function stripFlagFromName(name: string): string {
  const emoji = extractFlagEmoji(name);
  if (!emoji) return name.trim();
  return name.replace(emoji, "").trim();
}
