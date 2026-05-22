// Canonical server order — список стран в шторке рендерится строго в
// этом порядке (без авто-ping-сортировки), REV 3.
//
// Ключи — 2-буквенные ISO-3166-1 коды стран (lowercase). При render'е мы
// извлекаем код из hostname сервера (`xx-NN.<domain>` → `xx`) и матчим
// против этого списка.
//
// HOW TO REORDER:
//   1. Поправить массив ниже — те же коды, новая последовательность.
//   2. Bump REV +1 (просто для трассировки в логах).
//   3. Никакой миграции в storage не нужно — sort применяется на лету
//      в sortByCanonicalOrder() при каждом render'е.
//
// Adding country: append + bump REV. Removing: drop + bump REV.

export const CANONICAL_SERVER_ORDER: string[] = [
  // «Fastest» / EU-aggregate всегда первой, флаг EU.
  "fastest",
  "fi", // Finland
  "se", // Sweden
  "de", // Germany
  "dk", // Denmark
  "no", // Norway
  "nl", // Netherlands
  "pl", // Poland
  "ch", // Switzerland
  "gb", // United Kingdom
  "at", // Austria
  "cz", // Czechia
  "lv", // Latvia
  "hr", // Croatia
  "kz", // Kazakhstan
  "us", // USA
  "sg", // Singapore
  "au", // Australia
  "al", // Albania
];

export const CANONICAL_ORDER_REV = 3;

/** Извлечь 2-буквенный ISO-код страны из hostname сервера или fallback
 *  на полную строку. Формат hostname: `xx-NN.<rest>` где xx — ISO код. */
function countryCodeOf(server: string): string {
  const lower = (server || "").toLowerCase();
  const m = lower.match(/^([a-z]{2})-\d+\./);
  return m ? m[1] : lower;
}

function indexOfKey(key: string): number {
  for (let i = 0; i < CANONICAL_SERVER_ORDER.length; i++) {
    if (CANONICAL_SERVER_ORDER[i] === key) return i;
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Определить «канонический ключ» сервера. Сначала проверяем имя на
 *  «fastest»/«самый быстрый» (синтетическая EU-aggregate нода), потом
 *  извлекаем ISO-код из hostname. */
export function canonicalKey(name: string, server: string): string {
  if (/fastest|самый\s*быстрый/i.test(name)) return "fastest";
  return countryCodeOf(server);
}

/** Получить rank сервера в canonical-порядке. Меньше = выше в списке.
 *  Для нод не из списка — Number.MAX_SAFE_INTEGER (попадут в конец). */
export function canonicalRank(name: string, server: string): number {
  return indexOfKey(canonicalKey(name, server));
}

/** Sort массива entries (или индексов) по canonical order. Стабильный
 *  (два entries с одинаковым rank сохраняют исходный порядок). */
export function sortIndicesByCanonical<T extends { name: string; server: string }>(
  servers: T[]
): number[] {
  return servers
    .map((s, i) => ({ rank: canonicalRank(s.name, s.server), i }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.i - b.i;
    })
    .map(({ i }) => i);
}
