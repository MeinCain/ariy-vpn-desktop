// Перевод названий стран сервера в текущую локаль.
//
// Подписка Remnawave возвращает имена серверов как «🇸🇪 Sweden»,
// «🇩🇪 Germany», «Fastest» и т.п. Эмодзи мы уже срезаем через
// `stripFlagFromName`. Здесь маппим остаток на русский, если активна
// RU-локаль; для остальных языков возвращаем имя без изменений.

const RU_BY_EN: Record<string, string> = {
  // Канонические EN-имена 18 стран из подписки + синтетическая «Fastest».
  "fastest": "Самый быстрый",
  "finland": "Финляндия",
  "sweden": "Швеция",
  "germany": "Германия",
  "denmark": "Дания",
  "norway": "Норвегия",
  "netherlands": "Нидерланды",
  "poland": "Польша",
  "switzerland": "Швейцария",
  "united kingdom": "Великобритания",
  "uk": "Великобритания",
  "great britain": "Великобритания",
  "austria": "Австрия",
  "czechia": "Чехия",
  "czech republic": "Чехия",
  "latvia": "Латвия",
  "croatia": "Хорватия",
  "kazakhstan": "Казахстан",
  "usa": "США",
  "united states": "США",
  "united states of america": "США",
  "singapore": "Сингапур",
  "australia": "Австралия",
  "albania": "Албания",
  // Часто встречающиеся доп.страны на случай если подписка их добавит.
  "russia": "Россия",
  "france": "Франция",
  "italy": "Италия",
  "spain": "Испания",
  "canada": "Канада",
  "japan": "Япония",
  "ireland": "Ирландия",
  "portugal": "Португалия",
  "estonia": "Эстония",
  "lithuania": "Литва",
  "hungary": "Венгрия",
  "slovakia": "Словакия",
  "romania": "Румыния",
  "bulgaria": "Болгария",
  "serbia": "Сербия",
  "turkey": "Турция",
  "ukraine": "Украина",
  "moldova": "Молдова",
  "georgia": "Грузия",
  "armenia": "Армения",
  "azerbaijan": "Азербайджан",
  "israel": "Израиль",
  "uae": "ОАЭ",
  "united arab emirates": "ОАЭ",
  "india": "Индия",
  "china": "Китай",
  "hong kong": "Гонконг",
  "south korea": "Южная Корея",
  "korea": "Южная Корея",
  "indonesia": "Индонезия",
  "argentina": "Аргентина",
  "brazil": "Бразилия",
  "mexico": "Мексика",
  "south africa": "ЮАР",
};

/** Локализовать название страны. `lang` — текущая i18n-локаль
 *  (`i18n.language`). Для не-RU локалей возвращает name как есть. */
export function localizeCountryName(name: string, lang: string): string {
  if (!name) return "";
  // Применяем перевод только для русской локали. EN-locale → name as-is.
  if (!lang.toLowerCase().startsWith("ru")) return name;
  const key = name.trim().toLowerCase();
  return RU_BY_EN[key] ?? name;
}
