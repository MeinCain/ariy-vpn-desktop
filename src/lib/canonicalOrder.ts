// Canonical server order — copy из Chrome-расширения (`vpn-extension/src/state.js`),
// REV 3. Список стран в шторке рендерится строго в этом порядке, без
// автоматической ping-сортировки. Юзер прямо просил «зафиксировать» —
// порядок меняется только редактированием этого массива.
//
// HOW TO REORDER (когда юзер попросит):
//   1. Поправить массив ниже — те же элементы, новая последовательность.
//   2. Bump REV +1 (просто для трассировки в логах).
//   3. Никакой миграции в storage не нужно — sort применяется на лету в
//      sortByCanonicalOrder() при каждом render'е.
//
// Adding country: append + bump REV. Removing: drop + bump REV. Renaming:
// replace FQDN + bump REV.

export const CANONICAL_SERVER_ORDER: string[] = [
  // «Fastest» / EU-aggregate всегда первой, флаг EU.
  "fastest",
  "fi-01.example.com", //  12 ms  Finland
  "se-01.example.com", //  13 ms  Sweden
  "de-02.example.com", //  48 ms  Germany     (manually moved up)
  "dk-01.example.com", //  21 ms  Denmark
  "no-01.example.com", //  27 ms  Norway
  "nl-01.example.com", //  31 ms  Netherlands
  "pl-01.example.com", //  31 ms  Poland
  "ch-01.example.com", //  37 ms  Switzerland
  "gb-01.example.com", //  44 ms  United Kingdom
  "at-01.example.com", //  45 ms  Austria
  "cz-01.example.com", //  61 ms  Czechia     (manually moved up — above LV)
  "lv-01.example.com", //  20 ms  Latvia      (manually moved down)
  "hr-01.example.com", //  52 ms  Croatia
  "kz-01.example.com", //  60 ms  Kazakhstan
  "us-01.example.com", // 144 ms  USA
  "sg-01.example.com", // 207 ms  Singapore
  "au-01.example.com", // 333 ms  Australia
  "al-01.example.com", // 446 ms  Albania
];

export const CANONICAL_ORDER_REV = 3;

// Простой rank-лук: rank=index канонического элемента; элементы не из
// списка получают MAX_SAFE_INTEGER (отправляются в конец, сохраняя их
// относительный порядок). Идемпотентен — стабильная сортировка.
function indexOfHost(host: string): number {
  const lower = host.toLowerCase();
  for (let i = 0; i < CANONICAL_SERVER_ORDER.length; i++) {
    if (CANONICAL_SERVER_ORDER[i] === lower) return i;
  }
  return Number.MAX_SAFE_INTEGER;
}

/** Определить «канонический ключ» сервера по его entry. Сначала пробуем
 *  hostname (entry.server), потом по «fastest» в имени для синтетической
 *  EU-aggregate ноды. */
export function canonicalKey(name: string, server: string): string {
  if (/fastest|самый\s*быстрый/i.test(name)) return "fastest";
  return (server || "").toLowerCase();
}

/** Получить rank сервера в canonical-порядке. Меньше = выше в списке.
 *  Для нод не из списка — Number.MAX_SAFE_INTEGER (попадут в конец). */
export function canonicalRank(name: string, server: string): number {
  return indexOfHost(canonicalKey(name, server));
}

/** Sort массива entries (или индексов) по canonical order. Стабильный
 *  (двух entries с одинаковым rank сохраняют исходный порядок). */
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
