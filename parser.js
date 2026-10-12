'use strict';

// Parse a free-text Bulgarian shipping message into structured fields, and
// fuzzy-match the office description against the Econt office nomenclature.
// Robust to the name appearing BEFORE or AFTER the phone, and detects a
// cash-on-delivery (наложен платеж) amount + currency when present.

// Mobile numbers: 0 / +359 / 00359, then 87x/88x/89x and seven more digits, with
// single space . - / separators ("0888/123 456", "(0888) 123 456"). The third digit is pinned to 7-9
// so dotted dates + times ("08.10.2026 14:32") are never read as a phone.
const PHONE_RE = /\(?(?:(?:\+|00)?\s?359|0)[\s\-./]?\(?8(?:\)\s?|[\s\-./])?[7-9](?:(?:\)\s?|[\s\-./])?\d){7}/;

// Words that are never a person's name (office terms, fillers, sentence words).
const STOP_NAME = new Set([
  'моля', 'благодаря', 'мерси', 'здравейте', 'здрасти', 'привет', 'поздрави', 'btw',
  'ще', 'ви', 'ти', 'аз', 'той', 'тя', 'то', 'ние', 'те', 'и', 'или', 'за', 'на', 'във', 'в',
  'до', 'от', 'със', 'с', 'по', 'при', 'ако', 'как', 'кога', 'когато', 'че', 'да', 'не', 'ок', 'добре',
  'тел', 'телефон', 'гсм', 'gsm', 'офис', 'еконт', 'econt', 'склад', 'автомат', 'апс', 'aps', 'каса', 'машина',
  'адрес', 'име', 'имена', 'получател', 'получателя', 'подател', 'пратка', 'пратки', 'пратете', 'изпратите',
  'изпратете', 'съобщение', 'снимка', 'номер', 'сериен', 'кутия', 'кутията', 'едно', 'центру', 'център',
  'лева', 'лев', 'лв', 'евро', 'eur', 'bgn', 'наложен', 'наложена', 'платеж', 'нп', 'сума', 'сумата', 'плати',
  'град', 'гр', 'село', 'ул', 'бул', 'блок', 'бл', 'вход', 'вх', 'етаж', 'ет', 'апартамент', 'ап', 'кв', 'жк', 'район',
  'отпаднал', 'отпаднали', 'изпратени', 'изпратена', 'доставени', 'доставена', 'тръгнали', 'подаване', 'анулиране', 'платено', 'чакащи', 'нови', 'последните',
  'офиса', 'чакам', 'предварително',
]);

// Major Bulgarian cities/towns (and the words of multi-word names) — never a name.
// Also used to read the city of a door address, so it stays to the big towns.
const CITIES = new Set([
  'софия', 'пловдив', 'варна', 'бургас', 'русе', 'стара', 'загора', 'плевен', 'сливен', 'добрич', 'шумен',
  'перник', 'хасково', 'ямбол', 'пазарджик', 'благоевград', 'велико', 'търново', 'враца', 'габрово',
  'асеновград', 'видин', 'казанлък', 'кърджали', 'кюстендил', 'монтана', 'димитровград', 'търговище',
  'силистра', 'ловеч', 'разград', 'дупница', 'горна', 'оряховица', 'петрич', 'самоков', 'лом', 'нова',
  'попово', 'велинград', 'севлиево', 'карлово', 'банско', 'несебър', 'поморие', 'созопол', 'царево',
  'балчик', 'каварна', 'аксаково', 'девня', 'провадия', 'белослав', 'своге', 'ботевград', 'козлодуй',
  'мездра', 'тетевен', 'сандански', 'разлог', 'симитли', 'харманли', 'свиленград', 'елхово',
  'средец', 'айтос', 'карнобат', 'котел', 'твърдица', 'панагюрище', 'ихтиман', 'костинброд', 'нови',
  'пазар', 'омуртаг', 'берковица', 'чирпан', 'раднево', 'гълъбово', 'първомай', 'смолян', 'девин',
]);
// The rest of Bulgaria's towns (and words of their multi-word names). Only used
// to keep a town out of the recipient name, never to read an address city (many
// of them are also common street names: ул. Шипка, ул. Искър …).
const TOWNS = new Set([
  'белица', 'добринище', 'кресна', 'мелник', 'хаджидимово', 'якоруда', 'ахелой', 'българово', 'камено',
  'китен', 'малко', 'обзор', 'приморско', 'свети', 'черноморец', 'сунгурларе', 'бяла', 'вълчи', 'дол',
  'игнатиево', 'суворово', 'дългопол', 'долни', 'чифлик', 'дебелец', 'златарица', 'килифарево', 'лясковец',
  'павликени', 'полски', 'тръмбеш', 'свищов', 'стражица', 'сухиндол', 'черква', 'белоградчик', 'брегово',
  'грамада', 'димово', 'дунавци', 'кула', 'криводол', 'мизия', 'оряхово', 'дряново', 'плачковци', 'трявна',
  'генерал', 'тошево', 'шабла', 'ардино', 'джебел', 'крумовград', 'момчилград', 'бобошево', 'кочериново',
  'сапарева', 'баня', 'априлци', 'летница', 'луковит', 'угърчин', 'ябланица', 'бойчиновци', 'брусарци',
  'вълчедръм', 'вършец', 'чипровци', 'батак', 'белово', 'брацигово', 'ветрен', 'костандово', 'пещера',
  'ракитово', 'септември', 'стрелча', 'сърница', 'батановци', 'брезник', 'земен', 'радомир', 'трън', 'белене',
  'гулянци', 'митрополия', 'дъбник', 'искър', 'кнежа', 'койнаре', 'никопол', 'пордим', 'славяново',
  'тръстеник', 'червен', 'бряг', 'брезово', 'калофер', 'клисура', 'кричим', 'куклен', 'лъки', 'перущица',
  'садово', 'сопот', 'съединение', 'хисаря', 'завет', 'лозница', 'цар', 'ветово', 'глоджево', 'могили',
  'мартен', 'сеново', 'сливо', 'поле', 'алфатар', 'главиница', 'дулово', 'тутракан', 'кермен', 'шивачево',
  'доспат', 'златоград', 'мадан', 'неделино', 'рудозем', 'чепеларе', 'банкя', 'бухово', 'божурище', 'годеч',
  'драгоман', 'етрополе', 'златица', 'копривщица', 'костенец', 'момин', 'проход', 'пирдоп', 'правец',
  'сливница', 'елин', 'пелин', 'долна', 'гурково', 'мъглиж', 'николаево', 'шипка', 'крън', 'меричлери',
  'антоново', 'опака', 'ивайловград', 'любимец', 'маджарово', 'минерални', 'бани', 'симеоновград',
  'тополовград', 'велики', 'преслав', 'върбица', 'каолиново', 'каспичан', 'плиска', 'смядово', 'болярово',
  'стралджа', 'приморско',
]);
// Towns whose name is also a common first name / surname: a place only right
// after a location word ("Еконт Троян") or after a full name ("Иван Петров Троян").
const AMBIG_PLACE = new Set(['троян', 'бояна', 'елена', 'левски', 'раковски', 'стамболийски', 'кубрат', 'тервел', 'исперих', 'роман']);
// Address city detection keeps Троян (it left CITIES only so it can be a first name).
const ADDR_CITIES = new Set([...CITIES, 'троян']);
// Two-word places made of name-like words.
const PLACE_PHRASES = new Set(['гоце делчев', 'павел баня', 'цар калоян', 'свети влас', 'бобов дол']);
// The most common first names: a "Иван Петров" written straight after "Еконт" is
// still a person, not a two-word place.
const FIRST_NAMES = new Set([
  'иван', 'георги', 'димитър', 'петър', 'николай', 'христо', 'стефан', 'йордан', 'тодор', 'васил', 'александър',
  'атанас', 'стоян', 'ангел', 'красимир', 'мартин', 'кристиан', 'валентин', 'пламен', 'борис', 'емил', 'симеон',
  'мария', 'иванка', 'елена', 'йорданка', 'пенка', 'надежда', 'виктория', 'десислава', 'гергана', 'петя',
  'анна', 'ани', 'милена', 'теодора', 'николета', 'росица', 'цветелина', 'габриела', 'радостина', 'силвия',
]);

// Well-known quarter names — places, never a person's name. Deliberately excludes
// words that double as Bulgarian first names (Надежда, Бояна; Изгрев is kept out too).
const QUARTERS = new Set([
  'люлин', 'младост', 'дружба', 'тракия', 'лагера', 'обеля', 'слатина', 'подуяне',
  'хиподрума', 'стрелбище', 'драгалевци', 'симеоново', 'капана', 'аспарухово',
  'владиславово', 'кършияка', 'каменица', 'въстанически', 'чайка', 'тросково', 'meden', 'рудник',
]);

const STOP_OFFICE = new Set([
  'еконт', 'econt', 'офис', 'office', 'ул', 'бул', 'ж', 'к', 'жк', 'кв', 'град', 'гр', 'село', 'с',
  'до', 'на', 'в', 'и', 'тел', 'телефон', 'апс', 'aps', 'гсм', 'gsm',
]);

// Words after which capitalised words are a place ("с. Кочово", "офис Еконт Приморско").
const LOC_MARKER = new Set([
  'еконт', 'econt', 'офис', 'офиса', 'office', 'гр', 'град', 'с', 'село', 'общ', 'община', 'обл', 'област',
  'кв', 'квартал', 'жк', 'апс', 'aps', 'автомат', 'еконтомат', 'район', 'рн', 'ул', 'улица', 'бул', 'булевард',
  'бл', 'блок', 'вх', 'ет', 'ап', 'пл', 'площад',
]);
const CONNECTOR = new Set(['в', 'във', 'на', 'до', 'от']);
// Label words between a name and its phone ("Иван Петров тел. 0888…").
const TRAIL_LABEL = new Set(['тел', 'телефон', 'gsm', 'гсм', 'номер', 'номера', '№', 'тлф', 'моб', 'мобилен',
  'viber', 'вайбър', 'whatsapp', 'вацап', 'phone', 'tel']);
// Abbreviations that end with '.' without ending a sentence.
const ABBR = new Set(['гр', 'ул', 'бул', 'с', 'кв', 'жк', 'бл', 'вх', 'ет', 'ап', 'общ', 'обл', 'тел', 'пл', 'р-н', 'рн', 'г', 'д-р', 'др']);

function normalizePhone(raw) {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+359')) d = '0' + d.slice(4);
  else if (d.startsWith('00359')) d = '0' + d.slice(5);
  else if (d.startsWith('359') && d.length === 12) d = '0' + d.slice(3);
  return d;
}

// Cyrillic-safe word edges (JS \b only knows ASCII letters).
const NL = '(?<![а-яёa-z])', NR = '(?![а-яёa-z])';
const OFFICE_WORD_RE = new RegExp(NL + '(?:офис[а-яё]*|office|апс|aps|автомат|еконтомат)' + NR, 'i');

function detectDeliveryType(text) {
  const t = text.toLowerCase();
  // "не до офис", "без офис", "не искам офис": a refused office is not an office signal.
  const tOff = t.replace(new RegExp(NL + '(?:не|без)\\s+(?:[а-яёa-z]+\\s+){0,2}?(?:офис[а-яё]*|office|апс|aps|автомат)' + NR, 'g'), ' ');
  const hasOffice = OFFICE_WORD_RE.test(tOff);
  // The address OF an office ("офис Еконт с адрес бул. …", "до офис на Еконт на адрес ул. …",
  // "адрес на офиса") asks for that office, not a door delivery.
  if (new RegExp(NL + '(?:офис[а-яё]*|office|апс|aps|автомат)' + NR + '[^.,;!?\\n]{0,25}?адрес|адрес\\s+на\\s+офис', 'i').test(tOff)) return 'office';
  // "Адрес на Еконт: <street>" names the Econt office's street. With a home-style
  // address (ж.к., блок/вход/етаж/апартамент, a landmark) it is the customer's own
  // address written under that label, as in the real message that drove e8df982.
  const homeAddr = new RegExp(NL + '(?:ж\\.?\\s*к|жк\\s|кв\\.?\\s|бл\\.?\\s*\\d|блок\\s*\\d|вх\\.?\\s|ет\\.?\\s*\\d|етаж|ап\\.?\\s*\\d|апартамент)|\\sдо\\s+(?:училище|блок|бл\\.?)').test(t);
  if (/адрес\s+на\s+(?:еконт|econt)/.test(t) && !homeAddr && !/до\s*адрес|до\s*врата/.test(t)) return 'office';
  // A concrete street/complex/number next to an address word is a strong "door"
  // signal that wins even if "офис" appears elsewhere (e.g. the seller's own pitch).
  const strongAddr = /адрес/.test(t) && (/(ул\.?\s|бул\.?\s|ж\.?\s*к|жк\s|кв\.?\s|№|\sдо\s+(?:училище|блок|бл\.?))/.test(t) || new RegExp(NL + '(?:бл\\.?\\s*\\d|вх\\.?\\s)').test(t));
  if (strongAddr) return 'door';
  if (/(до\s*)?адрес|до\s*врата|до\s*мен|courier|куриер/.test(t)) { if (hasOffice) return 'office'; return 'door'; }
  return 'office';
}

const isPunct = (s) => /^[^\p{L}\p{N}]+$/u.test(s);
function bare(tok) { return tok.toLowerCase().replace(/[.'’:-]/g, ''); }
const isPlace = (b) => CITIES.has(b) || TOWNS.has(b) || QUARTERS.has(b);
// A name word: starts uppercase, not all-caps, no digit, not a filler/city.
function isNameWord(tok) {
  if (!/^[А-ЯЁA-Z][\p{L}'’.-]*$/u.test(tok)) return false;
  if (bare(tok).length < 2) return false;
  if (/\d/.test(tok)) return false;
  if (tok === tok.toUpperCase()) return false;
  const b = bare(tok);
  return !STOP_NAME.has(b) && !isPlace(b);
}
// Tokens exactly as before (split on whitespace, ',' and '/'), plus brk[i] = the
// boundary right before token i: 2 = line break, 1 = comma/slash/sentence end, 0 = none.
function tokB(s) {
  const toks = [], brk = [];
  let pend = 2;
  const re = /[,/]|\n|[^\s,/]+/g; let m;
  while ((m = re.exec(s))) {
    const x = m[0];
    if (x === '\n') { pend = 2; continue; }
    if (x === ',' || x === '/') { pend = Math.max(pend, 1); continue; }
    const prev = toks[toks.length - 1];
    const sentEnd = prev && (/[:!?;]$/.test(prev) || (/\.$/.test(prev) && !ABBR.has(bare(prev)) && bare(prev).length > 1));
    toks.push(x); brk.push(Math.max(pend, sentEnd ? 1 : 0)); pend = 0;
  }
  return { toks, brk };
}
// Is token i right after a location marker (possibly via в/на/до: "офис на Еконт в Тракия")?
function afterMarker(tokens, i) {
  let j = i - 1, hops = 0;
  while (j >= 0 && hops < 2 && CONNECTOR.has(bare(tokens[j]))) { j--; hops++; }
  return j >= 0 && LOC_MARKER.has(bare(tokens[j]));
}
const SURNAME_RE = /(?:ов|ев|ова|ева|ски|ска|цки|цка|чки|чка)$/;
const isCap = (tk) => /^[А-ЯЁA-Z]/.test(tk) && !LOC_MARKER.has(bare(tk));
const isShortNum = (tk) => /^\d{1,3}[а-яА-Яa-zA-Z]?[.,]?$/.test(tk);
// A run of capitalised words (and a short number, "Младост 1") ending at i that
// directly follows a location marker. Returns the index before the run, or null.
function markerRun(tokens, brk, i) {
  let best = null, words = 0;
  for (let j = i; j >= 0 && i - j < 3; j--) {
    const tk = tokens[j];
    if (isShortNum(tk)) { if (j !== i) break; } else if (isCap(tk) && !isPunct(tk)) words++; else break;
    if (words > 2) break;
    if (j < i && brk[j + 1]) break;
    if (!afterMarker(tokens, j)) continue;
    const run = tokens.slice(j, i + 1).filter((x) => !isShortNum(x)).map(bare);
    // "Еконт Мария Иванова" / "офис Лиляна Петрова": a first name or a surname-shaped
    // second word is a person, unless the pair is a known place ("Гоце Делчев").
    if (!PLACE_PHRASES.has(run.join(' ')) && !isPlace(run[0]) && (FIRST_NAMES.has(run[0]) || (run.length === 2 && SURNAME_RE.test(run[1])))) continue;
    best = j - 1;
  }
  return best;
}
function phraseEndingAt(tokens, i) { return i >= 1 && PLACE_PHRASES.has(bare(tokens[i - 1]) + ' ' + bare(tokens[i])) ? 2 : 0; }
function phraseStartingAt(tokens, i) { return i + 1 < tokens.length && PLACE_PHRASES.has(bare(tokens[i]) + ' ' + bare(tokens[i + 1])); }
// Up to 3 consecutive name words from the front of a token list —
// Bulgarian recipients are usually given with all three names (трите имена).
function leadingName(tokens, brk) {
  const o = [];
  for (let i = 0; i < tokens.length && o.length < 3; i++) {
    const tk = tokens[i];
    if (!isNameWord(tk) || phraseStartingAt(tokens, i)) break;
    if (o.length && brk && brk[i] === 2) break; // a name never spans two lines
    if (o.length >= 2 && AMBIG_PLACE.has(bare(tk))) break;
    o.push(tk);
  }
  return o;
}
// The name right before the phone. Trailing place info is skipped first — known
// towns, "Еконт Приморско", "с. Кочово, общ. Велики Преслав", "Иван Петров Троян" —
// since it belongs to the delivery location, not the name. Returns the name
// segment's indices so the caller can cut exactly it out of the location text.
function trailingName(tokens, brk) {
  brk = brk || [];
  let i = tokens.length - 1, placed = false;
  for (let guard = 0; guard < 24 && i >= 0; guard++) {
    const tk = tokens[i], b = bare(tk);
    // "от Варна", "в Пловдив": a connector right before a skipped place goes with it.
    if (isPunct(tk) || LOC_MARKER.has(b) || TRAIL_LABEL.has(b) || (CONNECTOR.has(b) && (placed || afterMarker(tokens, i + 1)))) { i--; continue; }
    const ph = phraseEndingAt(tokens, i); if (ph) { i -= ph; placed = true; continue; }
    if (isPlace(b)) { i--; placed = true; continue; }
    if (AMBIG_PLACE.has(b) && (afterMarker(tokens, i) || (i >= 2 && isNameWord(tokens[i - 1]) && isNameWord(tokens[i - 2])))) { i--; placed = true; continue; }
    const r = markerRun(tokens, brk, i);
    if (r !== null) { i = r; placed = true; continue; }
    break;
  }
  const words = [];
  const end = i;
  for (; i >= 0 && words.length < 3; i--) {
    if (!isNameWord(tokens[i])) break;
    // A name never spans two lines ("Еконт Шумен Еверест\nМария Иванова 0899…"), nor a
    // comma once it has two words ("Здравейте, Мария Иванова").
    if (words.length && (brk[i + 1] === 2 || (brk[i + 1] === 1 && words.length >= 2))) break;
    // "Еконт Кочово Иван Петров": Кочово is the place — but "офис Лиляна Иванова" is a person.
    if (words.length && afterMarker(tokens, i) && !FIRST_NAMES.has(bare(tokens[i])) && !SURNAME_RE.test(bare(words[0]))) break;
    words.unshift(tokens[i]);
  }
  return { words, start: i + 1, end };
}
function curOf(s) { s = (s || '').toLowerCase(); return (s.includes('€') || s.startsWith('евро') || s.startsWith('eur') || s.startsWith('evro')) ? 'EUR' : 'BGN'; }

// ---------- cash on delivery ----------
const CUR_SRC = '€|евро|evro|euro|eur|лв\\.?|лева|лев|bgn|lv\\.?|leva|lev';
const CUR_AFTER_RE = new RegExp('^\\s*(' + CUR_SRC + ')' + NR, 'i');
const CUR_BEFORE_RE = new RegExp(NL + '(' + CUR_SRC + ')\\s*$', 'i');
// 1 200 / 1.200 / 1,200 (thousands) or 45 / 45,50 / 45.50
const NUM_SRC = '(?<![\\d.,])(\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,6}(?:[.,]\\d{1,2})?)(?!\\d)';
const QTY_AFTER_RE = /^\s*(?:бр(?:ой(?:ки|ка)?|оя|\.)?|pcs|чифт[а-яё]*|x|х|\*|×)(?![а-яёa-z])/i;
const UNIT_BEFORE_RE = /(?:^|[^а-яёa-z])(?:по|x|х|\*|×)\s*$/i;
const UNIT_AFTER_RE = new RegExp('^\\s*(?:(?:' + CUR_SRC + ')' + NR + ')?\\s*(?:/|на|за)\\s*(?:бр|брой|бройка|чифт)', 'i');
const TOTAL_BEFORE_RE = /(?:=|(?:^|[^а-яёa-z])(?:общо|всичко|тотал|total|крайна\s+цена|сумата\s+е|общата\s+сума)(?:\s+е)?\s*:?)\s*$/i;
const DELIV_BEFORE_RE = /(?:^|[^а-яёa-z])(?:доставка(?:та)?|куриер(?:а|ска)?|транспорт|такса)(?:\s+(?:е|от|за))?\s*:?\s*$/i;
const DELIV_AFTER_RE = new RegExp('^\\s*(?:(?:' + CUR_SRC + ')' + NR + ')?\\s*(?:за\\s+)?(?:доставка|куриер|транспорт)', 'i');
// House/block/size/model numbers — never money unless a currency is attached.
const ADDR_BEFORE_RE = /(?:(?:^|[^а-яёa-z])(?:ул|бул|no|ж\.?к|кв|блок|бл|вх|ап|етаж|ет|размер|р-р|номер|ном|модел|арт)\.?\s*|№\s*|(?:^|[^а-яёa-z])(?:ул|бул|улица|булевард)\.?\s+[^,\d\n]{1,30}|ж\.?\s*к\.?\s+[^,\d\n]{1,25})$/i;
const KW_SRC = NL + '(?:наложен[а-яё]*(?:\\s+платеж[а-яё]*)?|нал\\.?\\s*платеж[а-яё]*|нп|cod|сума(?:та)?|за\\s+получаване|за\\s+плащане)' + NR;
// A phone-like digit group that PHONE_RE did not take ("0899 654 32", "0888 123 4567").
const LOOSE_PHONE_RE = /(?<!\d)(?:(?:\+|00)?359|0)[\s\-./]{0,2}8[\s\-./]{0,2}[7-9](?:[\s\-./]{0,2}\d){5,9}(?!\d)/g;
const TIME_LIKE = /^(?:[01]?\d|2[0-3])[.:][0-5]\d$/;

function numVal(s) {
  let t = s.replace(/[ \u00a0\u202f]/g, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  return parseFloat(t);
}
function globalCurrency(s) {
  if (new RegExp('€|' + NL + '(?:евро|evro|euro|eur)' + NR, 'i').test(s)) return 'EUR';
  // ("лев"/"lev" only next to an amount: on its own it is also a first name, Лев.)
  if (new RegExp(NL + '(?:лв|лева|bgn|lv|leva)' + NR, 'i').test(s)) return 'BGN';
  return null;
}
function codCandidates(text) {
  const out = []; const re = new RegExp(NUM_SRC, 'g'); let m;
  while ((m = re.exec(text))) {
    const s = m[0], start = m.index, end = start + s.length;
    const before = text.slice(Math.max(0, start - 40), start), after = text.slice(end, end + 40);
    const ca = CUR_AFTER_RE.exec(after);
    const cbm = CUR_BEFORE_RE.exec(before);
    const cb = cbm && !/\d\s*$/.test(before.slice(0, cbm.index)) ? cbm : null;
    const value = numVal(s);
    out.push({
      s, start, end, value, intLen: String(Math.trunc(value)).length,
      cur: ca ? curOf(ca[1]) : cb ? curOf(cb[1]) : null,
      qty: QTY_AFTER_RE.test(after),
      unit: UNIT_BEFORE_RE.test(before) || UNIT_AFTER_RE.test(after),
      total: TOTAL_BEFORE_RE.test(before),
      delivery: DELIV_BEFORE_RE.test(before) || DELIV_AFTER_RE.test(after),
      addr: !ca && !cb && ADDR_BEFORE_RE.test(before),
    });
  }
  return out;
}
const UNSURE = { unsure: true };
// Pick the amount the customer pays: a stated total ("= 50 лв", "общо 40 лв") wins;
// quantities ("2 бр", "2х") never count; unit prices ("по 20 лв") and delivery fees
// only when nothing else is there. Only unit prices next to a quantity = unknown total.
function chooseAmount(list, all) {
  const usable = list.filter((c) => !c.qty);
  if (!usable.length) return null;
  const tot = usable.find((c) => c.total);
  if (tot) return tot;
  const plain = usable.filter((c) => !c.unit && !c.delivery);
  if (plain.length) return plain[0];
  const notUnit = usable.filter((c) => !c.unit);
  if (notUnit.length) return notUnit[0];
  if (all.some((c) => c.qty && c.value > 1)) return UNSURE;
  return usable[0];
}

// Detect a COD amount + currency. Phones are blanked first (all of them, plus
// loose phone-like digit groups) so an alternate number is never read as money.
function detectCod(text, phoneIndex) {
  text = String(text || '');
  const blank = (s) => ' '.repeat(s.length);
  const clean = text.replace(new RegExp(PHONE_RE.source, 'g'), blank).replace(LOOSE_PHONE_RE, blank);
  const cands = codCandidates(clean);
  let pick = null, negated = false, positiveKw = false;
  // 1. The amount anchored to a COD keyword ("наложен платеж 300"), so an
  //    item/listing price stated earlier ("Цена 250 лв") does not win.
  const kwRe = new RegExp(KW_SRC, 'gi'); let k;
  while ((k = kwRe.exec(clean))) {
    const pre = clean.slice(Math.max(0, k.index - 25), k.index);
    if (/(?:^|[^а-яёa-z])(?:без|не)\s+(?:[а-яё]+\s+)?$/i.test(pre)) { negated = true; continue; }
    positiveKw = true;
    const kwEnd = k.index + k[0].length;
    let winEnd = Math.min(clean.length, kwEnd + 50);
    const nl1 = clean.indexOf('\n', kwEnd);
    if (nl1 >= 0 && nl1 < winEnd) {
      if (/\d/.test(clean.slice(kwEnd, nl1))) winEnd = nl1;
      else { const nl2 = clean.indexOf('\n', nl1 + 1); if (nl2 >= 0) winEnd = Math.min(winEnd, nl2); }
    }
    const win = cands.filter((c) => c.start >= kwEnd && c.start < winEnd && !c.addr);
    if (!win.length) continue;
    pick = chooseAmount(win, win);
    if (pick) break;
  }
  // "без наложен платеж" and nothing positive: the parcel is prepaid.
  if (negated && !positiveKw) return null;
  // 2. An amount with a currency next to it ("45 лв", "€45", "45 leva").
  if (!pick) {
    const curC = cands.filter((c) => c.cur);
    if (curC.length) pick = chooseAmount(curC, cands);
  }
  // 3. A bare number alone on its own line after the phone ("…\nЕконт Пловдив\n45").
  //    A bare number inside an address/description line is never guessed: a house
  //    number or size would become a believable COD the no-COD guard can't catch.
  if (!pick) {
    let last = null;
    for (const c of cands) {
      if (phoneIndex >= 0 && c.start < phoneIndex) continue;
      if (!(c.value >= 10 && c.value <= 100000) || c.intLen === 4 || TIME_LIKE.test(c.s)) continue;
      const ls = clean.lastIndexOf('\n', c.start - 1) + 1, le = clean.indexOf('\n', c.end);
      const line = clean.slice(ls, le < 0 ? clean.length : le).trim().replace(/[.!]+$/, '').trim();
      if (line === c.s) last = c;
    }
    pick = last;
  }
  if (!pick || pick === UNSURE) return null;
  return { amount: pick.value, currency: pick.cur || globalCurrency(clean) || null };
}

// Detect a review request written in the message: "с преглед" → review,
// "преглед и тест" / "тест" → review & test. Null when not mentioned, and null
// when refused ("без преглед", "не искам преглед", "преглед: не").
function detectReview(text) {
  const s = String(text).toLowerCase();
  // Cyrillic-safe whole-word matching so inflections like "тествам"/"прегледай"
  // (I'm testing / look it over) don't trigger the paid review/test service.
  const negBefore = /(?:^|[^а-яёa-z])(?:без|не|no|without)\s+(?:[а-яёa-z.]+\s+){0,2}$|няма\s+нужда\s+от\s+$/;
  const negAfter = /^\s*[:\-–]?\s*(?:не|no)(?![а-яёa-z])/;
  // "не може без преглед" / "не мога без преглед" is a double negative: review wanted.
  const doubleNeg = /(?:^|[^а-яёa-z])не\s+(?:може|мога|можем|става|искам)\s+без\s+$/;
  const refused = (st, en) => { const pre = s.slice(Math.max(0, st - 40), st); return (negBefore.test(pre) && !doubleNeg.test(pre)) || negAfter.test(s.slice(en, en + 8)); };
  const positive = (w) => {
    const re = new RegExp('(?:^|[^а-яёa-z])(' + w + ')(?![а-яёa-z])', 'g'); let m;
    while ((m = re.exec(s))) { const st = m.index + m[0].length - m[1].length; if (!refused(st, st + m[1].length)) return true; re.lastIndex = st + 1; }
    return false;
  };
  if (positive('преглед\\s+и\\s+тест') || positive('тест')) return 'review_test';
  if (positive('преглед')) return 'review';
  // The classic seller offer of the review service, phrased without the keyword:
  // "отваряш на гишето, проверяваш и плащаш само ако е наред". \w does not match
  // Cyrillic in JS, so use an explicit Cyrillic class.
  let m = /плаща[а-яё]*\s+само\s+ако/.exec(s);
  if (m && !refused(m.index, m.index)) return 'review';
  m = /провер[а-яё]+[^.!?]{0,20}плаща[а-яё]*/.exec(s);
  if (m && !refused(m.index, m.index)) return 'review';
  return null;
}

// A 4-digit postcode: never part of a phone-like digit run ("0888 444 555"),
// never a price ("1200 лв") or a year.
function findPostCode(s) {
  const re = /\d+(?:[ .\-/]\d+)*/g; let m;
  while ((m = re.exec(s))) {
    const run = m[0];
    if (run.replace(/\D/g, '').length >= 7) continue;
    const gre = /\d+/g; let g;
    while ((g = gre.exec(run))) {
      if (!/^[1-9]\d{3}$/.test(g[0])) continue;
      const after = s.slice(m.index + g.index + 4);
      if (/^\s*(?:лв|лева|lv|leva|eur|евро|€|г\.|год)/i.test(after)) continue;
      return g[0];
    }
  }
  return null;
}

// Best-effort structured address for a door (address) delivery. Every field is
// editable in the UI afterwards, so this only has to get close.
function extractAddress(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^.{0,40}?адрес[^:]{0,20}:\s*/i, '').trim(); // drop a leading "адрес …:" label
  const addr = {};
  const pc = findPostCode(s);
  if (pc) addr.postCode = pc;
  // City: last token that is a known city (case-insensitive), else "гр. Xxx".
  const toks = s.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = toks.length - 1; i >= 0; i--) { if (ADDR_CITIES.has(toks[i].toLowerCase())) { addr.city = toks[i]; break; } }
  const gr = s.match(/\bгр\.?\s*([А-ЯЁ][а-яё]+)/);
  if (!addr.city && gr) addr.city = gr[1];
  // Street + number: "ул. Радост 8", "бул. ... 12А".
  const st = s.match(/(?:ул|бул|булевард|улица)\.?\s+([^,\d]{2,30}?)\s+(\d+[А-Яа-яA-Za-z]?)\b/i);
  if (st) { addr.street = st[1].trim(); addr.num = st[2]; }
  // Residential complex / quarter: "ж.к Трошево", "кв. Младост".
  const q = s.match(/(?:ж\.?\s*к\.?|жк|кв|квартал)\.?\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/);
  if (q) addr.quarter = q[1].trim();
  // Landmark note ("до училище …") — stop before any digits so the postcode is not
  // swallowed. Cyrillic-safe left boundary (\b does not work before Cyrillic in JS).
  const near = s.match(/(?:^|[^а-яёa-z])(до|срещу|зад|при|блок|бл\.)\s+([^,\n\d]{2,40})/i);
  if (near) addr.other = (near[1] + ' ' + near[2]).replace(/\s+/g, ' ').trim();
  return addr;
}

// A line holding only a name: "Иван Петров", "Име: Мария Иванова".
function isNameLine(line) {
  let t = String(line).trim();
  const labeled = /^(?:име(?:на)?|получател|клиент|name)\s*[:\-–]\s*/i.test(t);
  if (labeled) t = t.replace(/^(?:име(?:на)?|получател|клиент|name)\s*[:\-–]\s*/i, '');
  const toks = t.split(/[\s,]+/).filter((w) => w && !isPunct(w)).map((w) => w.replace(/[.,!]+$/, ''));
  if (!toks.length || toks.length > 3 || !toks.every(isNameWord)) return false;
  if (toks.some((w) => AMBIG_PLACE.has(bare(w))) && toks.length < 2) return false;
  return toks.length >= 2 || labeled;
}
const OFFICE_LINE_RE = new RegExp('еконт|econt|' + NL + '(?:офис[а-яё]*|office|апс|aps|автомат|адрес)' + NR + '|' + NL + '(?:ул|бул|гр|с|кв|бл|вх|общ|обл)\\.|' + NL + 'ж\\.?\\s*к|' + NL + 'жк' + NR, 'i');
const CUR_NUM_RE = new RegExp('\\d\\s*(?:' + CUR_SRC + ')' + NR + '|' + NL + '(?:€|евро|лв)\\s*\\d', 'i');
// What one line of a batch is: N name, O office/address, C money, R review, X other.
function lineKind(line) {
  const t = String(line).trim();
  if (isNameLine(t)) return 'N';
  if (OFFICE_LINE_RE.test(t) || t.toLowerCase().split(/[^\p{L}]+/u).some((w) => isPlace(w)) || findPostCode(t)) return 'O';
  if (new RegExp(KW_SRC, 'i').test(t) || CUR_NUM_RE.test(t)) return 'C';
  if (detectReview(t)) return 'R';
  return 'X';
}

function parseMessage(text) {
  text = String(text || '');
  // Several parcels pasted at once must never be mixed into one waybill: when the
  // splitter finds 2+ parcels, this (single-parcel) parse reads the first only.
  const recs = splitBatch(text);
  if (recs.length >= 2 && recHasName(recs[1])) text = recs[0];
  const out = { deliveryType: detectDeliveryType(text), recipientName: '', phone: '', phoneRaw: '', locationText: '', address: null, cod: null, reviewMode: null };
  out.reviewMode = detectReview(text);
  const m = PHONE_RE.exec(text);
  const phoneIndex = m ? m.index : -1;
  if (m) { out.phoneRaw = m[0].trim(); out.phone = normalizePhone(m[0]); }
  out.cod = detectCod(text, phoneIndex);

  const before = m ? text.slice(0, m.index) : text;
  const after = m ? text.slice(m.index + m[0].length) : '';
  const B = tokB(before), A = tokB(after);
  let beforeTok = B.toks, beforeBrk = B.brk, afterTok = A.toks, afterBrk = A.brk;
  // Drop trailing punctuation and label words (тел / GSM / номер / Viber …) so the name right before them is found.
  while (beforeTok.length) { const last = beforeTok[beforeTok.length - 1]; if (isPunct(last) || TRAIL_LABEL.has(bare(last))) { beforeTok = beforeTok.slice(0, -1); beforeBrk = beforeBrk.slice(0, -1); } else break; }
  while (afterTok.length && isPunct(afterTok[0])) { afterTok = afterTok.slice(1); afterBrk = afterBrk.slice(1); }

  // The name, in order of trust:
  //  1. right before the phone (2-3 words) — words after the phone are often the office
  //     town or chatter ("…0888123456 Приморско", "\nЧакам пратката");
  //  2. 2+ name words right after the phone on its own line ("0888… Иван Петров") — this
  //     also beats a lone word before the phone ("Кочово 0888123456 Иван Петров");
  //  3. a name alone on a line above the phone ("Иван Петров\nНаложен 45 лв\n0888…");
  //  4. 2+ name words starting the next line ("0888…\nИван Петров\nЕконт…");
  //  5. a name alone on a line below the phone.
  const beforeSeg = trailingName(beforeTok, beforeBrk);
  const lineRest = m ? after.split('\n')[0] : '';
  const leadSame = leadingName(tokB(lineRest).toks.filter((w) => !isPunct(w)));
  const lead = leadingName(afterTok, afterBrk);
  const lines = text.split('\n');
  const phoneLine = m ? before.split('\n').length - 1 : lines.length;
  const findNameLine = (from, to, step) => { for (let i = from; i !== to; i += step) if (isNameLine(lines[i])) return i; return -1; };
  const nameLineWords = (i) => lines[i].replace(/^(?:име(?:на)?|получател|клиент|name)\s*[:\-–]\s*/i, '').split(/[\s,]+/).filter((w) => w && !isPunct(w)).map((w) => w.replace(/[.,!]+$/, ''));
  let nameTok = [], nameFrom = null, nameLine = -1;
  if (beforeSeg.words.length >= 2 || (beforeSeg.words.length === 1 && leadSame.length < 2)) { nameTok = beforeSeg.words; nameFrom = 'before'; }
  else if (leadSame.length >= 2) { nameTok = leadSame; nameFrom = 'after'; }
  else if ((nameLine = findNameLine(phoneLine - 1, -1, -1)) >= 0) { nameTok = nameLineWords(nameLine); nameFrom = 'line-before'; }
  else if (lead.length >= 2) { nameTok = lead; nameFrom = 'after'; }
  else if (m && (nameLine = findNameLine(phoneLine + 1, lines.length, 1)) >= 0) { nameTok = nameLineWords(nameLine); nameFrom = 'line-after'; }
  out.recipientName = nameTok.join(' ').replace(/[.,'’-]+$/u, '').trim();

  let officeTokens = beforeTok.slice();
  // Cut exactly the name segment out; trailing place words stay in the location.
  if (nameFrom === 'before' && nameTok.length) officeTokens = beforeTok.slice(0, beforeSeg.start).concat(beforeTok.slice(beforeSeg.end + 1));
  if (nameFrom === 'line-before') {
    const bl = before.split('\n'); bl[nameLine] = '';
    officeTokens = tokB(bl.join('\n')).toks;
    while (officeTokens.length && (isPunct(officeTokens[officeTokens.length - 1]) || TRAIL_LABEL.has(bare(officeTokens[officeTokens.length - 1])))) officeTokens.pop();
  }
  officeTokens = officeTokens.filter((w) => !['тел', 'телефон', 'gsm', 'гсм'].includes(w.toLowerCase()));
  let loc = officeTokens.join(' ');
  // Strip a leading "Label:" (e.g. "Адрес за доставка:") — but only when the prefix is a
  // short, digit-free label, never a time value like "09:30" or mid-sentence colons.
  const colon = loc.indexOf(':');
  if (colon >= 0) {
    const label = loc.slice(0, colon);
    if (!/\d/.test(label) && label.trim().split(/\s+/).filter(Boolean).length <= 3) loc = loc.slice(colon + 1);
  }
  loc = loc.replace(/\s+/g, ' ').trim();
  // Location before vs after the phone. Greetings, COD wording and chatter before
  // the name ("Здравейте,", "С наложен платеж,", "Изпращам от Пловдив.") must not
  // hide the office written after the phone.
  const afterLoc = afterTok.filter((w) => !nameTok.includes(w)).join(' ').trim();
  const meaningful = loc.split(/\s+/).filter((w) => /\p{L}/u.test(w) && !STOP_NAME.has(bare(w)) && !TRAIL_LABEL.has(bare(w)));
  const locScore = (s) => {
    const words = s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return (OFFICE_LINE_RE.test(s) ? 2 : 0) + (words.some((w) => isPlace(w) || AMBIG_PLACE.has(w)) ? 2 : 0) + (findPostCode(s) ? 1 : 0);
  };
  if (!meaningful.length) { if (afterTok.length) loc = afterLoc; }
  else if (afterLoc && locScore(afterLoc) > locScore(loc)) {
    const placeOnly = meaningful.every((w) => isPlace(bare(w)) || AMBIG_PLACE.has(bare(w)));
    loc = placeOnly ? loc + ' ' + afterLoc : afterLoc;
  }
  out.locationText = loc;
  // Parse an address into editable fields whenever the message carries one, so the
  // door-delivery form is pre-filled even if the type guess was "office" and the
  // user toggles to address delivery. The address commonly follows the phone (and
  // an "адрес:" label), so read from there rather than the office-location text.
  // Phones are blanked first so a phone group is never read as a postcode.
  const noPh = (s) => String(s || '').replace(new RegExp(PHONE_RE.source, 'g'), ' ');
  const hasAddr = (a) => a.city || a.street || a.quarter || a.postCode;
  let addr = null;
  const am = text.match(/адрес(?:\s*на\s*еконт)?\s*:?\s*(.+)$/is);
  if (am) { const a = extractAddress(noPh(am[1])); if (hasAddr(a)) addr = a; }
  if (!addr && after && /\d{4}|ул\.?\s|ж\.?\s*к|кв\.?\s/i.test(noPh(after))) { const a = extractAddress(noPh(after)); if (hasAddr(a)) addr = a; }
  if (!addr) { const a = extractAddress(noPh(loc)); if (hasAddr(a)) addr = a; }
  if (addr) out.address = addr;
  return out;
}

function tokenize(s) {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((w) => w && !STOP_OFFICE.has(w) && (w.length >= 3 || /^\d{4}$/.test(w)));
}
function officeHaystack(o) { const a = o.address || {}, city = a.city || {}; return [o.name, o.nameEn, a.fullAddress, a.quarter, a.street, city.name, city.postCode].filter(Boolean).join(' '); }
// Sorting hubs (ЛЛЦ — Локален Логистичен Център) and cargo points show as "active"
// on Econt's map but cannot receive a normal parcel: createLabel rejects them with
// "Невалиден обслужващ офис". getOffices already excludes them; this is a second
// net in case a stale/edge-case entry still carries such a name.
const HUB_NAME_RE = /(^|[^\p{L}])(ллц|llc)([^\p{L}]|$)|логистичен\s*център|logistic/iu;
function isCustomerOffice(o) {
  return !HUB_NAME_RE.test([o && o.name, o && o.nameEn].filter(Boolean).join(' '));
}
function matchOffices(locationText, offices, limit) {
  const qTokens = tokenize(locationText);
  const postcode = (locationText.match(/\b\d{4}\b/) || [])[0];
  const ranked = [];
  for (const o of offices) {
    if (!isCustomerOffice(o)) continue;
    const hayArr = tokenize(officeHaystack(o));
    const hayTokens = new Set(hayArr);
    let score = 0;
    for (const tt of qTokens) {
      let hit = hayTokens.has(tt);
      if (!hit && tt.length >= 4) hit = hayArr.some((h) => h.length >= 4 && (h.startsWith(tt) || tt.startsWith(h)));
      if (hit) score += /^\d{4}$/.test(tt) ? 4 : Math.min(tt.length, 8);
    }
    if (postcode && (o.address?.city?.postCode === postcode)) score += 6;
    if (score > 0) ranked.push({ code: o.code, name: o.name, address: o.address?.fullAddress || '', city: o.address?.city?.name || '', postCode: o.address?.city?.postCode || '', score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit || 6);
}

// ---------- batch input & noise filtering ----------
const PHONE_RE_G = new RegExp(PHONE_RE.source, 'g');
function countPhones(text) { return (String(text).match(PHONE_RE_G) || []).length; }
// Existing Econt waybill number in a chunk (13 digits, 12-14 tolerated for OCR).
// Phones are stripped first so +359/00359 numbers can never be mistaken for one.
function findWaybill(text) {
  const noPhones = String(text).replace(PHONE_RE_G, ' ');
  const m = noPhones.match(/(?:^|[^\d])(\d{12,14})(?!\d)/);
  return m ? m[1] : null;
}

// Lines that carry no shipment signal at all — chat furniture, timestamps, read
// receipts, emoji rows, platform labels. Dropped before parsing OCR/batch input
// so junk never leaks into names, addresses or descriptions.
const NOISE_LINE = [
  // bare timestamp "14:32" / "9:05 pm" / "14.32 ч." — a dotted "45.50" or "19.99" is a price
  /^(?:[01]?\d|2[0-3]):[0-5]\d(\s*(ч|h|am|pm)\.?)?$/i,
  /^(?:[01]?\d|2[0-3])\.[0-5]\d\s*(ч|h)\.?$/i,
  // NB: JS \b and \W are ASCII-only — Cyrillic needs explicit lookaheads/classes.
  /^(?:днес|вчера|today|yesterday|online|на линия|активен|typing|пише)(?![а-яёa-z]).{0,20}$/i,
  /^(?:изпратено|доставено|видяно|прочетено|seen|delivered|sent|edited|редактирано)(?![а-яёa-z]).{0,20}$/i,
  /^(?:viber|whatsapp|messenger|instagram|facebook|olx|bazar)(?![а-яёa-z]).{0,25}$/i,
  /^id[:\s]*\d+$/i,
  /^[^\p{L}\p{N}]+$/u,                                                          // punctuation / emoji only
];
function isNoiseLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (t.length <= 2 && !/\d\d/.test(t)) return true;
  // A line carrying a phone ("Viber: 0888 123 456") or any long number is never noise.
  if (PHONE_RE.test(t) || /\d(?:[\s\-./]?\d){5}/.test(t)) return false;
  return NOISE_LINE.some((re) => re.test(t));
}
function stripNoise(text) { return String(text).split(/\n/).filter((l) => !isNoiseLine(l)).join('\n'); }

// Does a phone line carry the recipient's name itself ("Мария Иванова 0899…")?
function lineHasName(line) {
  const pm = PHONE_RE.exec(line);
  if (!pm) return isNameLine(line);
  const b = tokB(line.slice(0, pm.index));
  const bt = b.toks.slice(); while (bt.length && (isPunct(bt[bt.length - 1]) || TRAIL_LABEL.has(bare(bt[bt.length - 1])))) bt.pop();
  if (trailingName(bt, b.brk).words.length) return true;
  return leadingName(tokB(line.slice(pm.index + pm[0].length)).toks.filter((w) => !isPunct(w))).length > 0;
}
const recHasName = (text) => text.split('\n').some((l) => (PHONE_RE.test(l) ? lineHasName(l) : isNameLine(l)));
// A second number for the same parcel: "или 0899…", "/ 0899…", or a bare number
// right under the first phone.
const ALT_CONNECT = new Set(['или', 'or', 'алт', 'alt', 'резервен', 'втори', 'друг', 'допълнителен']);
function isAltPhoneLine(line, gap) {
  const rest = line.replace(PHONE_RE_G, ' ').replace(/[^\p{L}\s]/gu, ' ').trim().toLowerCase();
  const words = rest.split(/\s+/).filter(Boolean);
  if (!words.length) return gap === 0 || /^\s*[/+]/.test(line);
  if (ALT_CONNECT.has(words[0])) return true;
  return gap === 0 && words.every((w) => TRAIL_LABEL.has(w));
}

// One blank-line block holding several phone lines → one chunk per parcel. The
// lines between two phone lines go to the parcel whose layout they fit: the lines
// before the block's first phone show what precedes a phone (e.g. name, office),
// the lines after its last phone what follows one; a name line always starts the
// next parcel when that parcel's phone line has no name of its own.
function splitBlock(b) {
  const lines = b.split('\n');
  const isRec = lines.map((l) => PHONE_RE.test(l));
  let lastPhone = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!isRec[i]) continue;
    if (lastPhone >= 0 && isAltPhoneLine(lines[i], i - lastPhone - 1)) isRec[i] = false;
    lastPhone = i;
  }
  const P = []; isRec.forEach((r, i) => { if (r) P.push(i); });
  if (P.length <= 1) return [b];
  const kinds = lines.map((l, i) => (PHONE_RE.test(l) && !isRec[i] ? 'A' : lineKind(l)));
  const h = P[0], t = lines.length - 1 - P[P.length - 1];
  const head = kinds.slice(0, h), tail = kinds.slice(P[P.length - 1] + 1);
  const chunks = [];
  let start = 0, prevHasName = recHasName(lines.slice(0, P[0] + 1).join('\n'));
  for (let j = 0; j < P.length - 1; j++) {
    const a = P[j], nb = P[j + 1];
    const gap = kinds.slice(a + 1, nb), g = gap.length;
    const nextHasName = lineHasName(lines[nb]);
    let minK = 0; gap.forEach((kd, i) => { if (kd === 'A') minK = i + 1; });
    const k0 = h === 0 ? g : (t === 0 ? 0 : Math.min(t, g));
    let bestK = g, bestS = -Infinity;
    // Names written before the phones (the block starts with a name line): the
    // next parcel starts at its name line; anything before that is still the
    // previous parcel's (office, COD, a contact note).
    if (head.includes('N') && !nextHasName) {
      const ni = gap.findIndex((kd, i) => i >= minK && kd === 'N');
      bestK = ni >= 0 ? ni : g; bestS = Infinity;
    }
    for (let k = minK; k <= g && bestS !== Infinity; k++) {
      let s = 0;
      for (let i = 0; i < k; i++) {
        const kd = gap[i]; if (kd === 'A') continue;
        s += i < tail.length ? (kd === tail[i] ? 2 : 0) : -1;
        if (kd === 'N') s += prevHasName ? -3 : 3;
      }
      const nn = g - k;
      for (let i = 0; i < nn; i++) {
        const kd = gap[k + i], pos = head.length - nn + i;
        s += pos >= 0 ? (kd === head[pos] ? 2 : 0) : -1;
        if (kd === 'N') s += nextHasName ? -3 : 3;
      }
      if (nn && head.length && gap[k] === head[0]) s += 1;
      if (k && tail.length && gap[k - 1] === tail[tail.length - 1]) s += 1;
      if (s > bestS || (s === bestS && Math.abs(k - k0) < Math.abs(bestK - k0))) { bestS = s; bestK = k; }
    }
    chunks.push(lines.slice(start, a + 1 + bestK).join('\n'));
    start = a + 1 + bestK;
    prevHasName = nextHasName || gap.slice(bestK).includes('N');
  }
  chunks.push(lines.slice(start).join('\n'));
  return chunks;
}

// Split a batch message into one chunk per parcel. Blank-line blocks first;
// a block holding several phone lines is split by its layout (splitBlock).
// Phoneless fragments between parcels belong to the parcel BEFORE them (lines
// after a parcel's phone are that parcel's office/COD), except a name fragment
// whose next phone line has no name, or when the paste clearly writes details
// before each phone (details before the first phone, none after the last).
function splitBatch(text) {
  const blocks = String(text).split(/\n\s*\n+/).map(stripNoise).filter((b) => b.trim());
  const pieces = [];
  for (const b of blocks) for (const c of splitBlock(b)) {
    const phone = PHONE_RE.test(c);
    // "или 0899…" in a bubble of its own is the previous parcel's second number.
    const alt = phone && !c.includes('\n') && pieces.some((p) => p.phone) && isAltPhoneLine(c, 1);
    pieces.push({ text: c, phone: phone && !alt, alt });
  }
  const first = pieces.findIndex((p) => p.phone);
  if (first < 0) return pieces.length ? [pieces.map((p) => p.text).join('\n')] : [];
  let last = pieces.length - 1; while (!pieces[last].phone) last--;
  const relevant = (p) => p.text.split('\n').some((l) => 'ONC'.includes(lineKind(l)));
  const forward = pieces.slice(0, first).some(relevant) && !pieces.slice(last + 1).some(relevant);
  const merged = [];
  let pend = [];
  for (let i = first; i <= last; i++) {
    const p = pieces[i];
    if (p.alt && merged.length && !pend.length) { merged[merged.length - 1] += '\n' + p.text; continue; }
    if (!p.phone) { pend.push(p.text); continue; }
    let headLines = i === first ? pieces.slice(0, first).map((x) => x.text) : [];
    if (pend.length) {
      const prev = merged[merged.length - 1];
      const fl = pend.join('\n').split('\n');
      const ni = fl.findIndex((l) => lineKind(l) === 'N');
      const nextHas = recHasName(p.text), prevHas = recHasName(prev);
      let cut = forward ? 0 : fl.length;
      if (ni >= 0 && !nextHas && prevHas) cut = ni;
      else if (ni >= 0 && nextHas && !prevHas) cut = fl.length;
      if (cut > 0) merged[merged.length - 1] = prev + '\n' + fl.slice(0, cut).join('\n');
      headLines = fl.slice(cut);
      pend = [];
    }
    merged.push(headLines.length ? headLines.join('\n') + '\n' + p.text : p.text);
  }
  // A trailing phoneless fragment is either the last parcel's own office/COD/review
  // bubble (kept) or chatter after the last parcel (e.g. "в разговор, без данни"
  // lists) that would pollute the last row's COD/location (dropped). Keep only its
  // leading office/COD/review lines.
  const tailLines = pieces.slice(last + 1).map((p) => p.text).join('\n').split('\n').filter((l) => l.trim());
  const keep = [];
  for (const l of tailLines) { if ('OCR'.includes(lineKind(l))) keep.push(l); else break; }
  if (keep.length) merged[merged.length - 1] += '\n' + keep.join('\n');
  // The same phone repeated across chunks is one conversation, not two parcels —
  // merge those chunks so a quoted/confirmed number can't duplicate a shipment.
  const byPhone = new Map(), result = [];
  for (const c of merged) {
    const m = PHONE_RE.exec(c);
    const key = m ? normalizePhone(m[0]) : null;
    if (key && byPhone.has(key)) { const idx = byPhone.get(key); result[idx] += '\n' + c; continue; }
    if (key) byPhone.set(key, result.length);
    result.push(c);
  }
  return result;
}

module.exports = { parseMessage, matchOffices, normalizePhone, tokenize, detectCod, isCustomerOffice, stripNoise, splitBatch, countPhones, findWaybill };
