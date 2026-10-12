'use strict';

// Parse a free-text Bulgarian shipping message into structured fields, and
// fuzzy-match the office description against the Econt office nomenclature.
// Robust to the name appearing BEFORE or AFTER the phone, and detects a
// cash-on-delivery (наложен платеж) amount + currency when present.

// Mobile numbers: 0 / +359 / 00359, then 87x/88x/89x and seven more digits, with
// single space . - / separators, optionally spaced ("0888/123 456", "0888 / 123456"),
// and parentheses ("(0888) 123 456", "(+359) 888 123 456"). The third digit is pinned
// to 7-9 so dotted dates + times ("08.10.2026 14:32") are never read as a phone.
const PH_SEP = '(?:\\s?[\\-./]\\s?|\\)\\s?|\\s)';
const PHONE_RE = new RegExp('\\(?(?:(?:\\+|00)?\\s?359\\)?|0)' + PH_SEP + '?\\(?8' + PH_SEP + '?[7-9](?:' + PH_SEP + '?\\d){7}');

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
  // greetings / shop signatures written as capitalised pairs ("Весела Коледа!", "Магазин Бебе Лукс")
  'коледа', 'великден', 'честита', 'честит', 'весели', 'празници', 'приятен', 'приятна', 'уикенд', 'магазин',
  'лукс', 'еоод', 'оод', 'shop', 'store', 'поръчка', 'поръчки',
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
  'стралджа', 'приморско', 'ахтопол', 'каблешково', 'рила', 'борово',
  // resorts with Econt offices
  'слънчев', 'пясъци', 'боровец', 'пампорово', 'кранево',
]);
// Place words that are also ordinary words ("две якета", "бяла рокля", "нова"): they
// keep a place out of the name, but alone they do not make a line a location.
const GENERIC_PLACE = new Set(['две', 'бяла', 'нова', 'нови', 'стара', 'горна', 'долна', 'долни', 'малко', 'полски',
  'свети', 'генерал', 'цар', 'поле', 'баня', 'бани', 'дол', 'бряг', 'черква', 'велики', 'момин', 'проход', 'червен',
  'минерални', 'вълчи', 'чифлик', 'пазар', 'кула', 'лом', 'завет', 'септември', 'съединение', 'котел', 'земен',
  'слънчев', 'пясъци', 'шипка', 'искър', 'опака', 'крън', 'батак', 'белово', 'лъки', 'бухово', 'камено', 'китен']);
// Towns whose name is also a common first name / surname: a place only right
// after a location word ("Еконт Троян") or after a full name ("Иван Петров Троян").
const AMBIG_PLACE = new Set(['троян', 'бояна', 'елена', 'левски', 'раковски', 'стамболийски', 'кубрат', 'тервел', 'исперих', 'роман',
  'албена', 'зорница', 'надежда']);
// Address city detection keeps Троян (it left CITIES only so it can be a first name).
const ADDR_CITIES = new Set([...CITIES, 'троян']);
// Two-word places made of name-like words.
const PLACE_PHRASES = new Set(['гоце делчев', 'павел баня', 'цар калоян', 'свети влас', 'бобов дол', 'две могили',
  'слънчев бряг', 'златни пясъци', 'св влас', 'бяла слатина', 'бяла черква',
  // multi-word quarters (Sofia, Varna, Plovdiv, Burgas …) written like a person's name
  'овча купел', 'бели брези', 'белите брези', 'гео милев', 'красно село', 'красна поляна', 'студентски град',
  'хаджи димитър', 'манастирски ливади', 'сухата река', 'западен парк', 'горна баня', 'малинова долина',
  'кръстова вада', 'христо смирненски', 'кючук париж', 'гранд мол', 'мол варна', 'кайсиева градина',
  'владислав варненчик', 'меден рудник', 'братя миладинови', 'долно езерово', 'горно езерово',
  'захарна фабрика']);
// The most common first names: a "Иван Петров" written straight after "Еконт" is
// still a person, not a two-word place.
const FIRST_NAMES = new Set([
  'иван', 'георги', 'димитър', 'петър', 'николай', 'христо', 'стефан', 'йордан', 'тодор', 'васил', 'александър',
  'атанас', 'стоян', 'ангел', 'красимир', 'мартин', 'кристиан', 'валентин', 'пламен', 'борис', 'емил', 'симеон',
  'мария', 'иванка', 'елена', 'йорданка', 'пенка', 'надежда', 'виктория', 'десислава', 'гергана', 'петя',
  'анна', 'ани', 'милена', 'теодора', 'николета', 'росица', 'цветелина', 'габриела', 'радостина', 'силвия',
  'михаил', 'любомир', 'венцислав', 'веселин', 'светослав', 'цветан', 'илия', 'кирил', 'методи', 'асен', 'боян',
  'владимир', 'данаил', 'деян', 'добромир', 'живко', 'здравко', 'иво', 'ивайло', 'калоян', 'константин', 'лъчезар',
  'любен', 'марин', 'митко', 'младен', 'никола', 'огнян', 'павел', 'пенчо', 'радослав', 'румен', 'самуил', 'сашо',
  'славчо', 'тихомир', 'трифон', 'филип', 'христиан', 'цветомир', 'явор', 'янко', 'андрей', 'антон', 'богдан',
  'виктор', 'габриел', 'даниел', 'денис', 'димо', 'евгени', 'захари', 'ивелин', 'илиян', 'камен', 'кристиян',
  'любослав', 'момчил', 'неделчо', 'орлин', 'пламен', 'радко', 'росен', 'спас', 'станимир', 'станислав', 'тошко',
  'александра', 'албена', 'антония', 'бистра', 'вася', 'венета', 'вяра', 'галина', 'генка', 'диана', 'дimitrina',
  'димитрина', 'добринка', 'донка', 'ева', 'евгения', 'екатерина', 'жана', 'живка', 'златка', 'зорница', 'ивана',
  'ивелина', 'илияна', 'йоана', 'калина', 'катя', 'кристина', 'лилия', 'лиляна', 'любов', 'магдалена', 'маргарита',
  'марина', 'мариана', 'мариета', 'мира', 'михаела', 'нели', 'нина', 'павлина', 'пепа', 'поля', 'радка', 'райна',
  'ралица', 'румяна', 'светла', 'светлана', 'севдалина', 'снежана', 'соня', 'станислава', 'стефка', 'таня',
  'татяна', 'тодорка', 'цветана', 'юлия', 'яна', 'янка', 'веселина', 'гергина', 'даниела', 'дарина',
  'деница', 'емилия', 'иглика', 'йорданка', 'кремена', 'красимира', 'любка', 'мила', 'надя', 'невена', 'петра',
  'преслава', 'рая', 'симона', 'стела', 'теменужка', 'християна',
]);

// Well-known quarter names — places, never a person's name. Deliberately excludes
// words that double as Bulgarian first names (Надежда, Бояна; Изгрев is kept out too).
const QUARTERS = new Set([
  'люлин', 'младост', 'дружба', 'тракия', 'лагера', 'обеля', 'слатина', 'подуяне',
  'хиподрума', 'стрелбище', 'драгалевци', 'симеоново', 'капана', 'аспарухово',
  'владиславово', 'кършияка', 'каменица', 'въстанически', 'чайка', 'тросково', 'meden', 'рудник',
  'лозенец', 'изток', 'павлово', 'княжево', 'банишора', 'редута', 'сердика', 'илинден', 'хладилника', 'разсадника',
  'дианабад', 'мусагеница', 'дървеница', 'орландовци', 'суходол', 'кремиковци', 'ботунец', 'илиянци', 'овча', 'купел',
  'коматево', 'остромила', 'прослав', 'столипиново', 'мараша', 'лазур', 'сарафово', 'крайморие', 'виница',
  'галата', 'траката', 'кючук', 'железник', 'картала', 'трошево',
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

// "Офис или адрес:", "Офис на Еконт или адрес:", "Офис/адрес:", "До офис или до адрес?":
// a form label or the seller's question offers both; the value after it decides.
const DT_ALT_RE = new RegExp('(?:до\\s+)?(?:офис[а-яё]*|еконт|econt)(?:\\s+(?:на|до)\\s+(?:еконт|econt))?\\s*(?:/|\\\\|или|or)\\s*(?:до\\s+|на\\s+)?адрес[а-яё]*'
  + '|(?:до\\s+)?адрес[а-яё]*\\s*(?:/|\\\\|или|or)\\s*(?:до\\s+|в\\s+)?(?:офис[а-яё]*|еконт|econt)', 'gi');
// "не до офис", "без офис", "не искам до офис", "нямам офис наблизо": a refused office.
// Only these shapes: "не знам кой офис" or "няма проблем офис …" refuse nothing.
const DT_REF_HEAD = NL + '(?:(?:не|без)\\s+(?:(?:искам|желая|ща|трябва|може|е)\\s+)?|(?:нямам|няма)\\s+)(?:(?:до|в|във|на|през)\\s+)?';
const DT_OFF_REF_RE = new RegExp(DT_REF_HEAD + '(?:офис[а-яё]*|office|апс|aps|автомат)' + NR, 'gi');
const DT_ADDR_REF_RE = new RegExp(DT_REF_HEAD + '(?:адрес[а-яё]*|врата|вкъщи|дома)' + NR, 'gi');
// The address OF an office ("офис Еконт с адрес бул. …", "до Еконт на адрес ул. …",
// "до офис на Еконт, който е на адрес …", "адресът на офиса"). Not "с Еконт на адрес"
// (Econt as the carrier, door delivery), and not "Еконт до адрес".
const DT_OFFICE_ADDR_RE = new RegExp('(?<!(?:^|[^а-яёa-z])(?:с|със|чрез|по|през)\\s+)' + NL + '(?:офис[а-яё]*|office|апс|aps|автомат|еконт|econt)' + NR
  + '(?:[^.;!?\\n,/]|,(?=\\s*(?:който|която|което|намиращ|намира|разположен)))' + '{0,40}?' + NL + '(?:с|със|на)\\s+адрес'
  + '|' + NL + 'адрес(?:ът|а)?\\s+на\\s+офис'
  // "Адрес: Еконт Пловдив Тракия" — the address given IS an Econt office
  + '|' + NL + 'адрес[а-яё]*(?:\\s+за\\s+доставка)?\\s*[:\\-–]\\s*(?:до\\s+|в\\s+)?(?:офис[а-яё]*\\s+(?:на\\s+)?)?(?:еконт|econt)' + NR, 'i');

function detectDeliveryType(text) {
  let t = text.toLowerCase();
  const altLabel = new RegExp(DT_ALT_RE.source, 'i').test(t);
  // "Офис/адрес: Еконт Пловдив Център, ул. Гладстон 12": the value is an office.
  if (altLabel && new RegExp('(?:' + DT_ALT_RE.source + ')\\s*[:\\-–]?\\s*(?:до\\s+|в\\s+)?(?:офис[а-яё]*\\s+(?:на\\s+)?)?(?:еконт|econt)' + NR, 'i').test(t)) return 'office';
  t = t.replace(DT_ALT_RE, ' ');
  const offRefused = new RegExp(DT_OFF_REF_RE.source, 'i').test(t);
  t = t.replace(DT_OFF_REF_RE, ' ');
  const addrRefused = new RegExp(DT_ADDR_REF_RE.source, 'i').test(t);
  t = t.replace(DT_ADDR_REF_RE, ' ');
  const hasOffice = OFFICE_WORD_RE.test(t);
  if (DT_OFFICE_ADDR_RE.test(t)) return 'office';
  // "Адрес на Еконт: <street>" names the Econt office's street. With a home-style
  // address (ж.к., блок/вход/етаж/апартамент, a landmark) it is the customer's own
  // address written under that label, as in the real message that drove e8df982.
  const homeAddr = new RegExp(NL + '(?:ж\\.?\\s*к|жк\\s|кв\\.?\\s|бл\\.?\\s*\\d|блок\\s*\\d|вх\\.?\\s|ет\\.?\\s*\\d|етаж|ап\\.?\\s*\\d|апартамент)|\\sдо\\s+(?:училище|блок|бл\\.?)').test(t);
  if (/адрес(?:ът|а)?\s+на\s+(?:еконт|econt)/.test(t) && !homeAddr && !/до\s*адрес|до\s*врата/.test(t)) return 'office';
  // A concrete street/complex/block next to an address word (or under an
  // "office or address" label, or with the office refused) is a strong "door"
  // signal that wins even if "офис" appears elsewhere (e.g. the seller's own pitch).
  const street = /(ул\.?\s|бул\.?\s|ж\.?\s*к|жк\s|кв\.?\s|№|\sдо\s+(?:училище|блок|бл\.?))/.test(t) || new RegExp(NL + '(?:бл\\.?\\s*\\d|вх\\.?\\s)').test(t);
  // ("вкъщи"/"дома" only as "до вкъщи"/"до дома": "ще съм вкъщи след 17 ч" is not a door request)
  const doorWord = new RegExp('адрес|до\\s*врата|до\\s*мен|до\\s+(?:вкъщи|дома)' + NR + '|' + NL + '(?:courier|куриер)').test(t);
  if (street && (doorWord || altLabel || offRefused)) return 'door';
  // "не до офис" with no other office word: the customer wants it at the door.
  if (offRefused && !hasOffice) return 'door';
  if (addrRefused) return 'office';
  if (doorWord) return hasOffice ? 'office' : 'door';
  return 'office';
}

const isPunct = (s) => /^[^\p{L}\p{N}]+$/u.test(s);
function bare(tok) { return tok.toLowerCase().replace(/[.'’:-]/g, ''); }
const isPlace = (b) => CITIES.has(b) || TOWNS.has(b) || QUARTERS.has(b);
// A word that on its own says "this is a location" (not "две", "нова", "бяла").
const isStrongPlace = (b) => isPlace(b) && !GENERIC_PLACE.has(b);
// Words of a known multi-word place found in a string ("овча купел", "две могили").
function hasPlacePhrase(lower) {
  const w = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (let i = 0; i + 1 < w.length; i++) if (PLACE_PHRASES.has(w[i] + ' ' + w[i + 1])) return true;
  return false;
}
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
// directly follows a location marker. Known place words inside the run do not count
// towards its length ("Еконт Велико Търново Картала", "Еконт Варна Гранд Мол").
// Returns the index before the run, or null.
function markerRun(tokens, brk, i) {
  let best = null, words = 0;
  for (let j = i; j >= 0 && i - j < 6; j--) {
    const tk = tokens[j], b = bare(tk);
    if (isShortNum(tk)) { if (j !== i) break; } else if (isCap(tk) && !isPunct(tk)) { if (!isPlace(b) && !AMBIG_PLACE.has(b)) words++; } else break;
    if (words > 2) break;
    if (j < i && brk[j + 1]) break;
    if (!afterMarker(tokens, j)) continue;
    // "Еконт Мария Иванова", "офис Лиляна Петрова", "Еконт Пловдив Иван Петров": the
    // unknown words start with a first name or have a surname-shaped second word —
    // a person, unless they are a known place ("Гоце Делчев", "Овча Купел").
    const run = tokens.slice(j, i + 1).filter((x) => !isShortNum(x)).map(bare);
    const unknown = run.filter((w) => !isPlace(w) && !AMBIG_PLACE.has(w));
    if (unknown.length && !PLACE_PHRASES.has(unknown.join(' ')) && (FIRST_NAMES.has(unknown[0]) || (unknown.length === 2 && SURNAME_RE.test(unknown[1])))) continue;
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
const NUM_PLAIN_SRC = '\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,6}(?:[.,]\\d{1,2})?';
const NUM_SPACED_SRC = '\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?:[.,]\\d{1,2})?';
const NUM_SRC = '(?<![\\d.,])(' + NUM_SPACED_SRC + '|' + NUM_PLAIN_SRC + ')(?!\\d)';
const NUM_PLAIN_Y = new RegExp('(?:' + NUM_PLAIN_SRC + ')(?!\\d)', 'y');
// A space-grouped amount ("1 200 лв") only where an amount starts: at the start of
// a line, after punctuation, a COD/total keyword, "за"/"е", or a currency. After a
// word or a number it is two numbers: a size, house/block/quarter number, model or
// "3 в 1" right before a price ("Младост 1 120 лв", "размер 42 100 лв").
const GROUP_OK_BEFORE_RE = new RegExp('(?:^|\\n)[ \\t]*$|[:=\\-–—,;(+/]\\s*$|' + NL + '(?:наложен[а-яё]*|платеж[а-яё]*|нп|cod|сума(?:та)?|общо|всичко|тотал|total|цена(?:та)?|стойност|получаване|плащане|е|за|от|€|евро|eur|лв\\.?|лева|bgn)\\s*$', 'i');
const QTY_AFTER_RE = /^\s*(?:бр(?:ой(?:ки|ка)?|оя|\.)?|pcs|чифт[а-яё]*|x|х|\*|×|%)(?![а-яёa-z])/i;
const UNIT_BEFORE_RE = /(?:^|[^а-яёa-z])(?:по|x|х|\*|×)\s*$/i;
const UNIT_AFTER_RE = new RegExp('^\\s*(?:(?:' + CUR_SRC + ')' + NR + ')?\\s*(?:/|на|за)\\s*(?:бр|брой|бройка|чифт)', 'i');
const MULT_BEFORE_RE = new RegExp('(?:' + CUR_SRC + ')\\s*(?:x|х|\\*|×)\\s*$', 'i');
const MULT_AFTER_RE = new RegExp('^\\s*(?:' + CUR_SRC + ')\\s*(?:x|х|\\*|×)\\s*\\d', 'i');
const TOTAL_BEFORE_RE = /(?:=|(?:^|[^а-яёa-z])(?:общо|всичко|тотал|total|крайна\s+цена|сумата\s+е|общата\s+сума|става|стават|остава|остават|(?:за\s+)?доплащане|след\s+отстъпка(?:та)?)(?:\s+е)?\s*:?)\s*$/i;
// Money the customer has already paid ("Вече платих 52 лв по Revolut", "Платено 20 лв
// капаро", "сумата от 52 лв е преведена"): never the amount to collect.
// ("без капаро", "платена доставка": not a paid amount)
const PAID_BEFORE_RE = /(?:^|[^а-яёa-z])(?<!(?:без|не|няма)\s+)(?:(?:за)?плат(?:их|ихме|ил|ила|или|ено|ена|ен|ени)|преведох(?:ме)?|преведен[аио]?|преведени|капаро|аванс|депозит|предплат[а-яё]*)(?![а-яёa-z])(?!\s+(?:доставк|транспорт|куриер))[^,.;!?\n\d]{0,25}$/i;
const PAID_AFTER_RE = new RegExp('^\\s*(?:(?:' + CUR_SRC + ')' + NR + ')?\\s*(?:(?:капаро|аванс|депозит|предплат[а-яё]*)' + NR
  + '|[,(\\-–—]?\\s*(?:(?:са|е|бяха|беше)\\s+)?(?:вече\\s+)?(?:платен[аио]?|платени|преведен[аио]?|преведени|по\\s+(?:revolut|револют|банк[а-яё]*|сметка(?:та)?|iban|paypal))' + NR
  // ("45 лв преведени 5 лв за доставката": the word goes with the amount after it)
  + '(?!\\s+(?:доставк|транспорт|куриер))(?![^,.;!?\\n\\d]{0,20}\\d))', 'i');
const DELIV_BEFORE_RE = /(?:^|[^а-яёa-z])(?:доставка(?:та)?|куриер(?:а|ска)?|транспорт|такса)(?:\s+(?:е|от|за))?\s*:?\s*$/i;
const DELIV_AFTER_RE = new RegExp('^\\s*(?:(?:' + CUR_SRC + ')' + NR + ')?\\s*(?:за\\s+)?(?:доставка|куриер|транспорт)', 'i');
// House/block/size/model numbers — never money unless a currency is attached.
const ADDR_BEFORE_RE = /(?:(?:^|[^а-яёa-z])(?:ул|бул|no|ж\.?к|кв|блок|бл|вх|ап|етаж|ет|размер|р-р|номер|ном|модел|арт)\.?\s*|№\s*|(?:^|[^а-яёa-z])(?:ул|бул|улица|булевард)\.?\s+[^,\d\n]{1,30}|ж\.?\s*к\.?\s+[^,\d\n]{1,25})$/i;
const KW_SRC = NL + '(?:наложен[а-яё]*(?:\\s+платеж[а-яё]*)?|нал\\.?\\s*платеж[а-яё]*|нп|cod|сума(?:та)?|за\\s+получаване|за\\s+плащане)' + NR;
// A phone-like digit group that PHONE_RE did not take ("0899 654 32", "0888 123 4567").
const LOOSE_PHONE_RE = /(?<!\d)(?:(?:\+|00)?359|0)[\s\-./]{0,2}8[\s\-./]{0,2}[7-9](?:[\s\-./]{0,2}\d){5,9}(?!\d)/g;
// A clock time ("14:32"). A dotted "12.50" alone on a line is a price: the noise
// filter only drops a dotted time when "ч"/"h" follows it.
const TIME_LIKE = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
// The line before ends with a street/block/size word but no number ("ул. Шипка",
// "вх. А"): a number alone on the next line is that house/block number, not money.
const ADDR_LINE_END_RE = /(?:^|[^а-яёa-z])(?:ул|бул|улица|булевард|ж\.?\s*к|жк|кв|квартал|бл|блок|вх|вход|ет|етаж|ап|апартамент|номер|№|размер|р-р)\.?(?:\s+[^\d\n]{0,40})?$/i;

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
function groupOk(before) {
  if (GROUP_OK_BEFORE_RE.test(before)) return true;
  if (/[ \t]{3,}$/.test(before)) return true; // a (blanked) phone right before
  // "Еконт Пловдив 1 200 лв": a town (not a quarter, not a street named after one).
  const w = /([а-яё]+)\s+$/i.exec(before);
  return !!(w && (CITIES.has(w[1].toLowerCase()) || TOWNS.has(w[1].toLowerCase())) && !ADDR_BEFORE_RE.test(before));
}
function codCandidates(text) {
  const out = []; const re = new RegExp(NUM_SRC, 'g'); let m;
  while ((m = re.exec(text))) {
    let s = m[0];
    const start = m.index;
    if (/[ \u00a0\u202f]/.test(s) && !groupOk(text.slice(Math.max(0, start - 40), start))) {
      NUM_PLAIN_Y.lastIndex = start;
      const pm = NUM_PLAIN_Y.exec(text);
      s = pm ? pm[0] : s.split(/[ \u00a0\u202f]/)[0];
      re.lastIndex = start + s.length;
    }
    const end = start + s.length;
    const before = text.slice(Math.max(0, start - 40), start), after = text.slice(end, end + 40);
    const ca = CUR_AFTER_RE.exec(after);
    const cbm = CUR_BEFORE_RE.exec(before);
    const cb = cbm && !/\d\s*$/.test(before.slice(0, cbm.index)) ? cbm : null;
    const value = numVal(s);
    out.push({
      s, start, end, value, intLen: String(Math.trunc(value)).length,
      cur: ca ? curOf(ca[1]) : cb ? curOf(cb[1]) : null,
      // "25 лв x 2": 2 is a count and 25 a unit price.
      qty: QTY_AFTER_RE.test(after) || MULT_BEFORE_RE.test(before),
      unit: UNIT_BEFORE_RE.test(before) || UNIT_AFTER_RE.test(after) || MULT_AFTER_RE.test(after),
      total: TOTAL_BEFORE_RE.test(before),
      delivery: DELIV_BEFORE_RE.test(before) || DELIV_AFTER_RE.test(after),
      addr: !ca && !cb && ADDR_BEFORE_RE.test(before),
      paid: PAID_BEFORE_RE.test(before) || PAID_AFTER_RE.test(after),
      // "2 якета", "1 яке": a count of something, not an amount.
      wordAfter: !ca && /^\s*[а-яёa-z]{2,}/i.test(after),
    });
  }
  return out;
}
const UNSURE = { unsure: true };
// Pick the amount the customer pays: a stated total ("= 50 лв", "общо 40 лв") wins;
// quantities ("2 бр", "2х") never count; unit prices ("по 20 лв") and delivery fees
// only when nothing else is there. Only unit prices next to a quantity = unknown total.
// In a keyword window, a bare number written straight after the keyword
// ("наложен платеж 45, доставка 6 лв") is the amount; one followed by a word
// ("НП 1 яке 45 лв", "за 2 якета 120 лв") or after other words ("iPhone 13 - 950 лв")
// loses to a later amount that carries a currency.
function chooseAmount(list, all, kwText) {
  const usable = list.filter((c) => !c.qty);
  if (!usable.length) return null;
  const tot = usable.find((c) => c.total);
  if (tot) return tot;
  const plain = usable.filter((c) => !c.unit && !c.delivery);
  if (plain.length) {
    const first = plain[0], withCur = plain.find((c) => c.cur);
    if (kwText && withCur && !first.cur) {
      const lead = kwText.text.slice(kwText.end, first.start);
      const strong = /^[\s:=\-–—]*(?:(?:за|от|на|е|в\s+размер\s+на)\s+)?$/i.test(lead) && !first.wordAfter;
      if (!strong) return withCur;
    }
    return first;
  }
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
  const cands = codCandidates(clean).filter((c) => !c.paid);
  // Line lookups by binary search over the newline positions, so a long single-line
  // paste stays linear.
  const nlPos = []; for (let i = clean.indexOf('\n'); i >= 0; i = clean.indexOf('\n', i + 1)) nlPos.push(i);
  const lineIdx = (pos) => { let lo = 0, hi = nlPos.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (nlPos[mid] < pos) lo = mid + 1; else hi = mid; } return lo; };
  const lineStart = (li) => (li ? nlPos[li - 1] + 1 : 0), lineEnd = (li) => (li < nlPos.length ? nlPos[li] : clean.length);
  const firstCand = (pos) => { let lo = 0, hi = cands.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (cands[mid].start < pos) lo = mid + 1; else hi = mid; } return lo; };
  let pick = null, negated = false, positiveKw = false;
  // 1. The amount anchored to a COD keyword ("наложен платеж 300"), so an
  //    item/listing price stated earlier ("Цена 250 лв") does not win.
  const kwRe = new RegExp(KW_SRC, 'gi'); let k;
  while ((k = kwRe.exec(clean))) {
    const pre = clean.slice(Math.max(0, k.index - 25), k.index);
    // "без наложен платеж", "не искам НП" — but "не забравяйте наложения платеж" and
    // "не може без наложен платеж" still ask for it.
    // (same line only: "без преглед\nНаложен платеж 30 лв" refuses the review, not the COD)
    if (/(?:^|[^а-яёa-z])(?:без[ \t]+(?:(?!преглед|тест)[а-яё]+[ \t]+)?|не[ \t]+(?:(?!забрав|пропуск|изпуск)[а-яё]+[ \t]+)?)$/i.test(pre)
      && !/(?:^|[^а-яёa-z])не\s+(?:може|мога|можем|става|искам|бива)\s+без\s+$/i.test(pre)) { negated = true; continue; }
    positiveKw = true;
    const kwEnd = k.index + k[0].length;
    let winEnd = Math.min(clean.length, kwEnd + 50);
    const li = lineIdx(kwEnd), nl1 = li < nlPos.length ? nlPos[li] : -1;
    if (nl1 >= 0 && nl1 < winEnd) {
      if (/\d/.test(clean.slice(kwEnd, nl1))) winEnd = nl1;
      else { const nl2 = li + 1 < nlPos.length ? nlPos[li + 1] : -1; if (nl2 >= 0) winEnd = Math.min(winEnd, nl2); }
    }
    const win = [];
    for (let ci = firstCand(kwEnd); ci < cands.length && cands[ci].start < winEnd; ci++) if (!cands[ci].addr) win.push(cands[ci]);
    if (!win.length) continue;
    pick = chooseAmount(win, win, { text: clean, end: kwEnd });
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
      // (10+, or a price with cents like "9.99"; never a 4-digit year/postcode)
      if (!((c.value >= 10 || (c.value >= 1 && /[.,]\d\d$/.test(c.s))) && c.value <= 100000) || c.intLen === 4 || TIME_LIKE.test(c.s)) continue;
      const li = lineIdx(c.start), ls = lineStart(li), le = lineEnd(li);
      if (le - ls > c.s.length + 12) continue;
      const line = clean.slice(ls, le).trim().replace(/[.!]+$/, '').trim();
      if (line !== c.s) continue;
      let prevLine = '';
      for (let pl = li - 1; pl >= 0 && !prevLine; pl--) prevLine = clean.slice(lineStart(pl), lineEnd(pl)).trim();
      if (!/\d/.test(prevLine) && ADDR_LINE_END_RE.test(prevLine)) continue;
      last = c;
    }
    pick = last;
  }
  if (!pick || pick === UNSURE) return null;
  return { amount: pick.value, currency: pick.cur || globalCurrency(clean) || null };
}

// Detect a review request written in the message: "с преглед" → review,
// "преглед и тест" / "тест" → review & test. Null when not mentioned, and null
// when refused ("без преглед", "не искам да има преглед", "преглед и тест: не").
const RV_W = '(?<![а-яёa-z])', RV_E = '(?![а-яёa-z])';
// One mention: "преглед", "тест", or a pair written as one ("преглед и тест",
// "преглед/тест", "преглед,тест", "преглед и/или тест", "тест и преглед").
// (not a product: "тест за бременност", "бърз тест", "тест ленти")
// (nor the seller's own check of the item: "минал тест", "тест ок", "Направих преглед")
// Latin: "s pregled", "pregled i test".
const RV_MENTION_RE = new RegExp(RV_W + '(?<!(?:бърз[аи]?|антигенен|антигенни|pcr|covid|ковид|кръвен|домашен|минал[аио]?|мина|премина(?:л[аио]?)?|издържа(?:л[аио]?)?|направих(?:ме)?|пуснах|успешен|успешно)\\s+)'
  + '(?:(преглед|pregled)(?:\\s*(?:и\\s*/\\s*или|и|или|i|ili|/|,|&|\\+)\\s*(тест|test))?|(тест)(?!\\s+(?:за\\s+(?:бременност|овулация)|ленти|лента|касет)|\\s+(?:ок|ok|окей|мина|премина|успешен)' + RV_E + ')(?:\\s*(?:и|или|/|,|&|\\+)\\s*(преглед))?)' + RV_E, 'g');
const RV_NEG_RE = new RegExp(RV_W + '(без|не|няма|нямам|нямаме|отказвам|отказваме|отказва|no|without|нито|bez|ne|nqma|nyama)' + RV_E, 'g');
const RV_NEG_AFTER_RE = new RegExp('^\\s*[:\\-–—=)]?\\s*(?:не|no|няма|nope)' + RV_E + '(?!\\s+(?:знам|зная|съм|сме|мога|може|е\\s+ли))', 'i');
// Is the mention at [st, en) refused? A negation earlier in the same clause, with at
// most five words and no "с/със" ("без НП с преглед") in between, or a "не" right after
// it ("Преглед и тест: не"). "Не може без преглед" is a double negative: wanted.
function reviewRefused(s, st, en) {
  if (RV_NEG_AFTER_RE.test(s.slice(en, en + 20))) return true;
  let pre = s.slice(Math.max(0, st - 70), st);
  const cut = pre.search(/[\n.!?;,][^\n.!?;,]*$/);
  if (cut >= 0) pre = pre.slice(cut + 1);
  let m, last = null;
  RV_NEG_RE.lastIndex = 0;
  while ((m = RV_NEG_RE.exec(pre))) last = m;
  if (!last) return false;
  const between = pre.slice(last.index + last[0].length);
  if (/^\s+(?:забрав|пропуск)/.test(between)) return false;          // "не забравяйте … преглед"
  // "Не искам с преглед", "не желая със": the "с" is part of the refused wish
  if (/^(?:не|ne)$/.test(last[1]) && /^\s+(?:искам|искаме|желая|желаем|ща|щем|трябва|е\s+нужн[оа]?|е\s+необходим[оа]?|iskam)\s+(?:с|със|s)\s+$/.test(between)) return true;
  if (new RegExp(RV_W + '(?:с|със|но|а|s|sas)' + RV_E).test(between)) return false;
  if (between.trim().split(/\s+/).filter(Boolean).length > 5) return false;
  if (last[1] === 'без' && /(?:^|[^а-яёa-z])не\s+(?:може|мога|можем|става|бива|искам|иска)\s+$/.test(pre.slice(0, last.index))) return false;
  return true;
}
function detectReview(text) {
  const s = String(text).toLowerCase();
  // Whole-word matching (Cyrillic-safe) so "тествам"/"прегледай" (I'm testing / look
  // it over) don't trigger the paid review/test service.
  let review = false, test = false, m;
  RV_MENTION_RE.lastIndex = 0;
  while ((m = RV_MENTION_RE.exec(s))) {
    if (reviewRefused(s, m.index, m.index + m[0].length)) continue;
    if (m[2] || m[3] || m[4]) test = true;
    review = true;
  }
  if (test) return 'review_test';
  if (review) return 'review';
  // The classic seller offer of the review service, phrased without the keyword:
  // "отваряш на гишето, проверяваш и плащаш само ако е наред". \w does not match
  // Cyrillic in JS, so use an explicit Cyrillic class.
  m = /плаща[а-яё]*\s+само\s+ако/.exec(s);
  if (m && !reviewRefused(s, m.index, m.index)) return 'review';
  m = /провер[а-яё]+[^.!?]{0,20}плаща[а-яё]*/.exec(s);
  if (m && !reviewRefused(s, m.index, m.index)) return 'review';
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
  // Residential complex / quarter: "ж.к Трошево", "кв. Младост", or a known quarter
  // name on its own ("Пловдив, Тракия бл. 23").
  const q = s.match(/(?:ж\.?\s*к\.?|жк|кв|квартал)\.?\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/);
  if (q) addr.quarter = q[1].trim();
  else { const kq = s.match(/[А-ЯЁ][а-яё]+/g); const hit = kq && kq.find((w) => QUARTERS.has(w.toLowerCase())); if (hit) addr.quarter = hit; }
  // Block / entrance / floor / flat: "бл. 23, вх. А, ет. 4, ап. 38".
  const parts = [];
  // ("АПС" is a parcel locker, not "ап. С": a '.' or a space must follow the word)
  const bre = /(?:^|[^а-яёa-z])(бл|блок|вх|вход|ет|етаж|ап|апартамент)(?:\.\s*|\s+)(\d{1,4}[а-яa-z]?|[А-ЯA-Z])(?![а-яёa-z\d])/gi; let bm;
  const ABBR_OF = { бл: 'бл.', вх: 'вх.', ет: 'ет.', ап: 'ап.' };
  while ((bm = bre.exec(s))) parts.push(ABBR_OF[bm[1].toLowerCase().slice(0, 2)] + ' ' + bm[2]);
  // Landmark note ("до училище …") — stop before any digits so the postcode is not
  // swallowed. Cyrillic-safe left boundary (\b does not work before Cyrillic in JS).
  // "до адрес", "не до офис", "до вкъщи" are delivery wording, not landmarks.
  const near = s.match(/(?:^|[^а-яёa-z])(до|срещу|зад|при)\s+(?!(?:адрес|офис|врата|вкъщи|дома|мен|входа)(?![а-яё]))([^,\n\d]{2,40})/i);
  const other = [parts.join(', '), near ? (near[1] + ' ' + near[2]).replace(/\s+/g, ' ').trim() : ''].filter(Boolean).join(', ');
  if (other) addr.other = other;
  return addr;
}

// A line holding only a name: "Иван Петров", "Име: Мария Иванова".
function isNameLine(line) {
  let t = String(line).trim();
  const labeled = /^(?:име(?:на)?|получател|клиент|name)\s*[:\-–]\s*/i.test(t);
  if (labeled) t = t.replace(/^(?:име(?:на)?|получател|клиент|name)\s*[:\-–]\s*/i, '');
  else if (/[!?]\s*$/.test(t)) return false; // "Весела Коледа!", "Как сте?" — chatter, not a name
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
  if (OFFICE_LINE_RE.test(t) || t.toLowerCase().split(/[^\p{L}]+/u).some((w) => isStrongPlace(w)) || hasPlacePhrase(t.toLowerCase()) || findPostCode(t)) return 'O';
  if (new RegExp(KW_SRC, 'i').test(t) || CUR_NUM_RE.test(t)) return 'C';
  // A bare amount alone on its line ("45", "120", "45.", "12,50"): what detectCod reads
  // as the COD of the phone above it.
  if (/^\d{2,3}(?:[.,]\d{1,2})?\.?$|^\d[.,]\d\d$/.test(t)) return 'C';
  RV_MENTION_RE.lastIndex = 0;
  if (detectReview(t) || RV_MENTION_RE.test(t.toLowerCase())) return 'R'; // "с преглед", "без преглед"
  return 'X';
}

// Looks like a person: starts with a common first name, or has a surname-shaped
// later word ("Мария Иванова", "Ivan Petrov"), unlike "Черна Рокля" or "Овча Купел".
function personLike(words) {
  const b = words.map(bare);
  if (!b.length) return false;
  return FIRST_NAMES.has(b[0]) || b.slice(1).some((w) => SURNAME_RE.test(w) || /(?:ov|ev|ova|eva|ski|ska)$/.test(w));
}
const nameLineWords = (line) => line.replace(/^(?:име(?:на)?|получател|клиент|name)\s*[:\-–]\s*/i, '').split(/[\s,]+/).filter((w) => w && !isPunct(w)).map((w) => w.replace(/[.,!]+$/, ''));
// "Изпращам от Пловдив", "пращаме от гр. Русе": the seller's own town, never the
// customer's office.
// The words before the town: "изпращам от", "пращаме утре от", "подавам ги от".
const ORIGIN_HEAD_RE = /(?<![а-яёa-z])(?:изпраща[а-яё]*|праща[а-яё]*|изпрат[а-яё]*|прат[а-яё]*|пуска[а-яё]*|подава[а-яё]*|тръгва[а-яё]*)\s+(?:[а-яё]+\s+){0,2}?от\s/i;
// ... then an optional office ("от офис Еконт", "от офиса на Еконт"), the town and,
// after an office word, the office's own name ("от Еконт Бургас Сарафово").
const ORIGIN_RE = new RegExp(ORIGIN_HEAD_RE.source.slice(0, -2) + '\\s+((?:(?:офис[а-яё]*|office|апс|автомат)\\s+)?(?:(?:на\\s+)?(?:еконт|econt)\\s+)?)'
  + '(?:гр\\.?\\s*|град\\s+|с\\.\\s*)?([а-яё]+(?:\\s+[а-яё]+){0,2})', 'gi');
function stripOrigin(s) {
  return String(s).replace(ORIGIN_RE, (m, pre, words) => {
    const w = words.split(/\s+/), b = w.map(bare), office = /\S/.test(pre);
    const townWord = (x) => CITIES.has(x) || TOWNS.has(x);
    const officeName = (i) => office && i < w.length && /^[А-ЯЁ]/.test(w[i]) && !LOC_MARKER.has(b[i]) && !CONNECTOR.has(b[i]);
    let n = 1;
    if (w.length >= 2) {
      // keep a second word only when the town is known and the word is not part of it
      // ("от Пловдив Иван"), unless an office word says it is the office's name
      if (isPlace(b[0]) && (isPlace(b[1]) || PLACE_PHRASES.has(b[0] + ' ' + b[1]))) n = 2;
      else if (!isPlace(b[0]) && !office) n = 2;
      else if (officeName(1)) n = 2;
      // "от Еконт Стара Загора Железник": a two-word town, then the office name
      if (n === 2 && townWord(b[0]) && townWord(b[1]) && officeName(2)) n = 3;
    }
    return ' ' + w.slice(n).join(' ') + ' ';
  }).replace(/\s+/g, ' ').trim();
}

function parseMessage(text) {
  // (the seller's own "Подател: … 0888…" line is never the recipient)
  text = dropSenderLines(String(text || ''));
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
  // Name lines above the phone: the nearest one that looks like a person wins over a
  // nearer capitalised product line ("Мария Иванова\nЧерна Рокля\n0888…"). A name line
  // below the phone must look like a person (not a greeting or shop signature).
  const findNameLine = (from, to, step, needPerson) => {
    let any = -1;
    for (let i = from; i !== to; i += step) {
      if (!isNameLine(lines[i])) continue;
      if (personLike(nameLineWords(lines[i])) || /^(?:име(?:на)?|получател|клиент|name)\s*[:\-–]/i.test(lines[i].trim())) return i;
      if (any < 0) any = i;
    }
    return needPerson ? -1 : any;
  };
  // A lone first name before the phone beats two capitalised words after it that do
  // not look like a person ("Мария 0888… Овча Купел").
  const oneBefore = beforeSeg.words.length === 1 && (leadSame.length < 2 || (FIRST_NAMES.has(bare(beforeSeg.words[0])) && !personLike(leadSame)));
  let nameTok = [], nameFrom = null, nameLine = -1;
  // The words before the phone fill a line of their own but do not look like a person,
  // while a line further up does: that line is the name ("Мария Иванова\nЧерна Рокля\n0888…").
  const segLine = beforeSeg.words.length ? before.slice(0, before.lastIndexOf(beforeSeg.words[0])).split('\n').length - 1 : -1;
  const upPerson = beforeSeg.words.length && !personLike(beforeSeg.words) && segLine >= 1 && isNameLine(lines[segLine])
    ? findNameLine(segLine - 1, -1, -1, true) : -1;
  if (upPerson >= 0) { nameLine = upPerson; nameTok = nameLineWords(lines[nameLine]); nameFrom = 'line-before'; }
  else if (beforeSeg.words.length >= 2 || oneBefore) { nameTok = beforeSeg.words; nameFrom = 'before'; }
  else if (leadSame.length >= 2) { nameTok = leadSame; nameFrom = 'after'; }
  else if ((nameLine = findNameLine(phoneLine - 1, -1, -1, false)) >= 0) { nameTok = nameLineWords(lines[nameLine]); nameFrom = 'line-before'; }
  else if (lead.length >= 2) { nameTok = lead; nameFrom = 'after'; }
  else if (m && (nameLine = findNameLine(phoneLine + 1, lines.length, 1, true)) >= 0) { nameTok = nameLineWords(lines[nameLine]); nameFrom = 'line-after'; }
  else {
    // "Иван Иванов - яке L - 0888…", "Иван Петров Иванов, ЕГН не давам :), 0888…": a
    // person's name at the start of the phone's line, with other words before the phone.
    const ls = before.lastIndexOf('\n') + 1;
    const T = tokB(before.slice(ls)), lead0 = leadingName(T.toks, T.brk);
    if (lead0.length >= 2 && personLike(lead0)) { nameTok = lead0; nameFrom = 'line-start'; }
  }
  out.recipientName = nameTok.join(' ').replace(/[.,'’-]+$/u, '').trim();

  let officeTokens = beforeTok.slice();
  // Cut exactly the name segment out; trailing place words stay in the location.
  if (nameFrom === 'before' && nameTok.length) officeTokens = beforeTok.slice(0, beforeSeg.start).concat(beforeTok.slice(beforeSeg.end + 1));
  if (nameFrom === 'line-start') { const ls = before.lastIndexOf('\n') + 1; officeTokens = tokB(before.slice(0, ls)).toks.concat(tokB(before.slice(ls)).toks.slice(nameTok.length)); }
  if (nameFrom === 'line-before') {
    const bl = before.split('\n'); bl[nameLine] = '';
    officeTokens = tokB(bl.join('\n')).toks;
    while (officeTokens.length && (isPunct(officeTokens[officeTokens.length - 1]) || TRAIL_LABEL.has(bare(officeTokens[officeTokens.length - 1])))) officeTokens.pop();
  }
  officeTokens = officeTokens.filter((w) => !['тел', 'телефон', 'gsm', 'гсм'].includes(w.toLowerCase()) && !/^(?:име|имена|получател|клиент|name|тел|телефон|gsm|гсм|моб|мобилен)\.?:$/i.test(w));
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
  // The seller's own town ("изпращам от Пловдив") is never the delivery location.
  loc = stripOrigin(loc);
  // Only a name read from after the phone is cut out of the after-phone text: a name
  // from before the phone may share a word with the office ("Троян Колев … Еконт Троян").
  const afterLoc = stripOrigin(((nameFrom === 'after' || nameFrom === 'line-after') ? afterTok.filter((w) => !nameTok.includes(w)) : afterTok).join(' '));
  const meaningful = loc.split(/\s+/).filter((w) => /\p{L}/u.test(w) && !STOP_NAME.has(bare(w)) && !TRAIL_LABEL.has(bare(w)));
  const locScore = (s) => {
    const lower = s.toLowerCase(), words = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return (OFFICE_LINE_RE.test(s) ? 2 : 0) + (words.some((w) => isStrongPlace(w) || AMBIG_PLACE.has(w)) || hasPlacePhrase(lower) ? 2 : 0) + (findPostCode(s) ? 1 : 0);
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
// Money is never a postcode or an office word: "Варна 1000 лв" must not pick the 1000
// (София) offices. Drops amounts with a currency next to them and the amount after a
// COD keyword ("наложен платеж 1500").
const MONEY_AFTER_RE = new RegExp('(?<![\\d.,])(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?\\s*(?:' + CUR_SRC + ')' + NR, 'gi');
const MONEY_BEFORE_RE = new RegExp(NL + '(?:€|евро|eur|лв\\.?|bgn)\\s*\\d+(?:[.,]\\d{1,2})?', 'gi');
const MONEY_KW_RE = new RegExp('(' + KW_SRC + ')\\s*[:\\-–=]?\\s*\\d+(?:[.,]\\d{1,2})?', 'gi');
function stripMoney(s) {
  return String(s || '').replace(MONEY_AFTER_RE, ' ').replace(MONEY_BEFORE_RE, ' ').replace(MONEY_KW_RE, '$1 ');
}
// An office's tokens, computed once per office object (the cached nomenclature is
// replaced, never mutated, on refresh).
const OFFICE_TOKENS = new WeakMap();
function officeTokens(o) {
  let t = OFFICE_TOKENS.get(o);
  if (!t) {
    const hayArr = tokenize(officeHaystack(o)), city = (o && o.address && o.address.city) || {};
    t = { hayArr, hayTokens: new Set(hayArr), cityTokens: new Set(tokenize(city.name)) };
    if (o && typeof o === 'object') OFFICE_TOKENS.set(o, t);
  }
  return t;
}
function matchOffices(locationText, offices, limit) {
  locationText = stripMoney(locationText);
  const qTokens = tokenize(locationText);
  const postcode = (locationText.match(/\b\d{4}\b/) || [])[0];
  const ranked = [];
  for (const o of offices) {
    if (!isCustomerOffice(o)) continue;
    const { hayArr, hayTokens, cityTokens } = officeTokens(o);
    let score = 0;
    for (const tt of qTokens) {
      const exact = hayTokens.has(tt);
      // A word form ("Чайката" / "Чайка") counts a little less than the word itself, and
      // only a few letters apart: "Ботевград" is not "ул. Христо Ботев".
      // (numbers match exactly: a waybill or amount is not a postcode's "prefix")
      const near = !exact && tt.length >= 4 && !/^\d+$/.test(tt)
        && hayArr.some((h) => h.length >= 4 && !/^\d+$/.test(h) && Math.abs(h.length - tt.length) <= 3 && (h.startsWith(tt) || tt.startsWith(h)));
      if (!exact && !near) continue;
      // The office's own town scores above a street named after a town ("ул. Ловеч").
      score += /^\d{4}$/.test(tt) ? 4 : Math.min(tt.length, 8) + (near ? -2 : cityTokens.has(tt) ? 2 : 0);
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
// A second number for the same parcel: "или 0899…", "/ 0899…", "+ 0899…", or a bare
// number right under the first phone. A line that is just a "+359 …" number is not
// one: the "+" belongs to the number.
const ALT_CONNECT = new Set(['или', 'or', 'алт', 'alt', 'резервен', 'втори', 'друг', 'допълнителен']);
function isAltPhoneLine(line, gap) {
  const pm = PHONE_RE.exec(line);
  const prefix = pm ? line.slice(0, pm.index).trim() : '';
  const rest = line.replace(PHONE_RE_G, ' ').replace(/[^\p{L}\s]/gu, ' ').trim().toLowerCase();
  const words = rest.split(/\s+/).filter(Boolean);
  if (!words.length) return gap === 0 || /^[/+]$/.test(prefix);
  if (ALT_CONNECT.has(words[0])) return true;
  // "тел. на дъщеря ми Мария 0899…", "Ако не вдига - на съпругата 0899…": a relative's
  // number for the same parcel (unless the line names a full person of its own).
  if (ALT_HINT_RE.test(rest) && !(pm && trailingName(tokB(line.slice(0, pm.index)).toks).words.length >= 2)) return true;
  return gap === 0 && words.every((w) => TRAIL_LABEL.has(w));
}
const ALT_HINT_RE = /(?<![а-яё])(?:(?:дъщеря|син|съпруг|съпруга|мъж|жена|майка|баща|сестра|брат|снаха|зет|внук|внучка)\s+ми|дъщерята|сина|синът|съпругата|съпругът|мъжа|мъжът|жената|майката|бащата|сестрата|брата|братът|снахата|ако\s+не\s+(?:вдига|отговаря|се\s+обади|ме\s+намерите)|резервен|друг\s+(?:телефон|номер)|втори\s+(?:телефон|номер))(?![а-яё])/;
// The seller's own line in a form or signature ("Подател: Иван Колев 0888…",
// "Магазин Детски Свят, тел. 0899…"): never a parcel, never the recipient.
const SENDER_LINE_RE = /^\s*(?:(?:подател|изпращач|sender)(?![а-яёa-z])|от\s*[:\-–])/i;
const SHOP_LINE_RE = /^\s*(?:магазин|shop|store)(?![а-яёa-z])|(?<![а-яёa-z])е?оод(?![а-яёa-z])/i;
function isSenderLine(line) {
  const pm = PHONE_RE.exec(line);
  if (!pm) return false;
  return SENDER_LINE_RE.test(line) || SHOP_LINE_RE.test(line.slice(0, pm.index));
}
// Drop sender lines when another phone line remains (the recipient's).
function dropSenderLines(text) {
  const ls = String(text).split('\n');
  if (!ls.some(isSenderLine)) return text;
  const rest = ls.filter((l) => !isSenderLine(l));
  return rest.some((l) => PHONE_RE.test(l)) ? rest.join('\n') : text;
}
// The recipient name a line carries, lowercased ("" when none): a name line, or the
// name around the phone on a phone line.
function nameKey(line) {
  const pm = PHONE_RE.exec(line);
  let w;
  if (pm) {
    const b = tokB(line.slice(0, pm.index));
    const bt = b.toks.slice(); while (bt.length && (isPunct(bt[bt.length - 1]) || TRAIL_LABEL.has(bare(bt[bt.length - 1])))) bt.pop();
    w = trailingName(bt, b.brk).words;
    if (!w.length) w = leadingName(tokB(line.slice(pm.index + pm[0].length)).toks.filter((x) => !isPunct(x)));
  } else w = isNameLine(line) ? nameLineWords(line) : [];
  return w.map(bare).join(' ');
}
// Two customers written on one line ("Тома Иванов 0887… Свищов 20 лв, Злати Иванова
// 0887… Левски 25 лв", also with ';', '|' or "1) … 2) …"): cut the line before the
// second customer when the first part is a parcel of its own (a name, and an office or
// an amount) and the second part names a person. An alternate number ("0888… / 0899…",
// "Мартин Колев 0888…, Мария Колева 0899… офис Еконт Перник") stays on the line.
function splitTwoOnLine(line) {
  const ms = [...line.matchAll(PHONE_RE_G)];
  if (ms.length < 2) return [line];
  const out = []; let from = 0;
  for (let k = 1; k < ms.length; k++) {
    const segStart = ms[k - 1].index + ms[k - 1][0].length, segEnd = ms[k].index;
    const seg = line.slice(segStart, segEnd);
    // the last separator before the next phone: ',' ';' '|', or a list number "2)"
    const sepRe = /[;|,]|(?<!\S)\d{1,2}\)\s/g; let sm, cut = -1, cutEnd = -1;
    while ((sm = sepRe.exec(seg))) { cut = sm.index; cutEnd = sm.index + sm[0].length; }
    if (cut < 0) continue;
    const at = segStart + cut;
    // (the first part around its own phone only, so a line of many numbers stays linear)
    const piece = line.slice(Math.max(from, k >= 2 ? ms[k - 2].index + ms[k - 2][0].length : 0, ms[k - 1].index - 80), at);
    if (!lineHasName(piece) || (!lineHasLocation(piece) && !CUR_NUM_RE.test(piece.replace(PHONE_RE_G, ' ')) && !new RegExp(KW_SRC, 'i').test(piece))) continue;
    const after = seg.slice(cutEnd), T = tokB(after);
    const tn = trailingName(T.toks.filter((x) => !isPunct(x) && !TRAIL_LABEL.has(bare(x))), T.brk).words;
    const rest = segEnd + ms[k][0].length;
    const named = (tn.length >= 2 && personLike(tn))
      || (!/\p{L}/u.test(after) && personLike(leadingName(tokB(line.slice(rest, rest + 80)).toks.filter((x) => !isPunct(x)))));
    if (!named) continue;
    out.push(line.slice(from, at).replace(/[\s,;|]+$/, ''));
    from = at + (/[,;|]/.test(line[at]) ? 1 : 0);
  }
  out.push(line.slice(from).trim());
  return out.filter((l) => l.trim());
}
// A later chat bubble about the seller's own drop-off ("Подавам ги утре от Еконт
// Бургас Сарафово", "Моя офис за подаване: …").
const DROPOFF_RE = /(?<![а-яё])(?:за\s+подаване|подава[а-яё]*|предава[а-яё]*|мо(?:я|ят|ия)\s+офис|наши(?:я|ят)\s+офис)(?![а-яё])/i;
// A note for every parcel ("Всички с преглед", "и двете с преглед").
const ALL_PARCELS_RE = /(?<![а-яё])(?:всички(?:те)?|всичките|двете|трите|четирите|всяка|всеки)(?![а-яё])/i;

// A heading line ("Поръчка 2:", "Пратки Еконт за днес:", "2)", "#3"): it starts the
// next parcel and is not part of any parcel's layout.
function isHeadingLine(line) {
  const t = String(line).trim();
  if (PHONE_RE.test(t)) return false;
  // A marked number ("Поръчка 2", "№3", "#3", "2)", "2:") or a lone list number
  // ("2", "2."). A bare 10+ ("45", "120", "45.") is an amount, not a heading.
  if (/^(?:поръчка|пратка|клиент|order|№|#|no\.)\s*(?:№|#|no\.?)?\s*\d{1,3}\s*[.:)\-]?$/i.test(t)
    || /^(?:№|#|no\.?)?\s*\d{1,3}\s*[:)\-]$/i.test(t) || /^\d\.?$/.test(t)) return true;
  return /:\s*$/.test(t) && t.split(/\s+/).length <= 6 && !CUR_NUM_RE.test(t);
}
// A field label alone on its line ("Име:", "Тел:", "Офис:"): it belongs with the line
// after it.
const FIELD_LABEL_RE = /^\s*(?:име(?:на)?|три\s+имена|получател|клиент|тел(?:ефон)?|gsm|гсм|моб(?:илен)?|номер|офис|адрес(?:\s+за\s+доставка)?|град|населено\s+място|сума|наложен(?:\s+платеж)?|цена|преглед|бележка|viber|вайбър|whatsapp|name|phone|office|address)\.?\s*[:\-–]?\s*$/i;
// Kind of a batch line: P phone (a parcel), A alternate phone, L field label,
// H heading, else lineKind.
function batchKind(line) { return FIELD_LABEL_RE.test(line) ? 'L' : isHeadingLine(line) ? 'H' : lineKind(line); }
// Does a line name a place (office, town, address) besides the name and phone?
function lineHasLocation(line) {
  const t = String(line).replace(PHONE_RE_G, ' ').trim();
  return !!t && !isNameLine(t) && lineKind(t) === 'O';
}
// Chatter that may sit between the last parcel and its own COD/review bubble.
const isSmallTalk = (line) => !/\d/.test(line) && !/:\s*$/.test(line) && line.trim().split(/\s+/).length <= 3;

// Split a batch message into one chunk per parcel. Every phone line (other than an
// alternate number) is a parcel. The lines between two phone lines are cut where
// they fit the paste's own layout:
//  - the lines before the first phone show what precedes a phone (head: e.g. office,
//    name), so the end of a gap that matches the head starts the next parcel;
//  - the lines after the last phone show what follows one (tail: office, COD, review);
//  - a name line goes to the parcel whose phone line has no name, an office line to
//    the parcel that has no office yet, a heading always starts the next parcel;
//  - a blank line (chat bubble edge) or a "-----" separator is a likely cut;
//  - when nothing tells them apart, lines stay with the parcel before them.
// Lines after the last phone in its own bubble belong to it; later bubbles only for
// their office/COD/review lines (a trailing "в разговор, без данни" list is dropped).
function splitBatch(text) {
  const lines = [], bnd = [];
  let pendB = true;
  for (const l of String(text).split('\n')) {
    if (!l.trim() || /^\s*[-=_*~•·]{3,}\s*$/.test(l)) { pendB = true; continue; }
    if (isNoiseLine(l)) continue;
    for (const part of splitTwoOnLine(l)) { lines.push(part); bnd.push(pendB); pendB = false; }
  }
  if (!lines.length) return [];
  const isRec = lines.map((l) => PHONE_RE.test(l));
  // The seller's own line (sender, shop signature) is no parcel, while another remains.
  const sender = lines.map((l, i) => isRec[i] && isSenderLine(l));
  if (sender.some(Boolean) && isRec.some((r, i) => r && !sender[i])) sender.forEach((x, i) => { if (x) isRec[i] = false; });
  else sender.fill(false);
  let lastPhone = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!isRec[i]) continue;
    const gap = i - lastPhone - 1;
    if (lastPhone >= 0 && isAltPhoneLine(lines[i], bnd[i] ? Math.max(gap, 1) : gap)) isRec[i] = false;
    lastPhone = i;
  }
  const P = []; isRec.forEach((r, i) => { if (r) P.push(i); });
  if (!P.length) return [lines.join('\n')];
  // S: a sender line, which is ignored by the layout.
  const kinds = lines.map((l, i) => (isRec[i] ? 'P' : sender[i] ? 'S' : PHONE_RE.test(l) ? 'A' : batchKind(l)));
  const lastP = P[P.length - 1];
  // Lines dropped from every chunk: a Messenger copy repeats the customer's name over
  // each of their bubble groups ("Асен Милев\n0898…\n\nАсен Милев\nЕконт …").
  const drop = new Set();
  // Lines after the last phone: its own bubble is kept whole; later bubbles keep their
  // office/COD/review lines (and a name line if the parcel has none), skipping short
  // small talk ("Благодаря!") and stopping at anything else. A later bubble that names
  // another customer ("На Генади сумата е 40 лв") ends the scan; the seller's own
  // drop-off office, or a second office for a parcel that has one, is skipped.
  let end = lastP + 1, lastBubble = lastP;
  while (end < lines.length && !bnd[end]) end++;
  while (lastBubble > 0 && !bnd[lastBubble]) lastBubble--;
  const prevP = P.length >= 2 ? P[P.length - 2] : -1;
  const own = lines.slice(Math.max(lastBubble, prevP + 1), end);
  const lastKeys = new Set(own.map(nameKey).filter(Boolean));
  const ownName = recHasName(own.join('\n'));
  let lastLoc = own.some(lineHasLocation), others = null;
  const keep = [];
  for (let i = end; i < lines.length; i++) {
    const kd = kinds[i], l = lines[i];
    if (kd === 'A' || kd === 'L') { keep.push(i); continue; }
    if (kd === 'N' && lastKeys.has(nameKey(l))) { drop.add(i); continue; }
    if ((kd === 'X' && isSmallTalk(l)) || kd === 'S') continue;
    if (!('OCR'.includes(kd) || (kd === 'N' && !ownName))) break;
    if (!others) {
      // name words of the other customers (not shared with this one)
      const mine = new Set([...lastKeys].join(' ').split(' '));
      others = new Set(lines.slice(0, prevP + 1).map(nameKey).join(' ').split(' ').filter((w) => w.length >= 3 && !mine.has(w)));
    }
    if (l.toLowerCase().split(/[^\p{L}]+/u).some((w) => others.has(w))) break;
    if (DROPOFF_RE.test(l) || ORIGIN_HEAD_RE.test(l)) continue;
    if (kd === 'O') { if (lastLoc) continue; lastLoc = true; }
    keep.push(i);
  }
  const tailIdx = []; for (let i = lastP + 1; i < end; i++) tailIdx.push(i); tailIdx.push(...keep);
  const head = kinds.slice(0, P[0]).filter((k) => k !== 'H' && k !== 'L' && k !== 'S');
  const tail = tailIdx.map((i) => kinds[i]).filter((k) => k !== 'A' && k !== 'L' && k !== 'S');
  const chunks = [];
  const range = (from, to) => { const r = []; for (let i = from; i < to; i++) r.push(i); return r; };
  let start = 0;
  for (let j = 0; j < P.length - 1; j++) {
    const a = P[j], nb = P[j + 1];
    const gap = kinds.slice(a + 1, nb), g = gap.length;
    const prevLines = lines.slice(start, a + 1);
    const prevHasName = recHasName(prevLines.join('\n')), prevLoc = prevLines.some(lineHasLocation);
    const nextHasName = lineHasName(lines[nb]), nextLoc = lineHasLocation(lines[nb]);
    // The previous customer's name repeated over their next bubble group (Messenger)
    // belongs to them, like an alternate number; it is dropped from the chunk.
    const prevKeys = new Set(prevLines.map(nameKey).filter(Boolean));
    // (not the line right above a nameless next phone: that is the next parcel's own
    // name, e.g. two parcels to the same person)
    gap.forEach((kd, i) => {
      if (kd === 'N' && !(i === g - 1 && !nextHasName) && prevKeys.has(nameKey(lines[a + 1 + i]))) { gap[i] = 'A'; drop.add(a + 1 + i); }
    });
    let minK = 0; gap.forEach((kd, i) => { if (kd === 'A') minK = i + 1; });
    // The next phone's own bubble, when it starts after the previous phone: its lines
    // above the phone ("НП 36 лв\nСтанка … 0894…") go with that phone.
    let nbStart = nb; while (nbStart > a + 1 && !bnd[nbStart]) nbStart--;
    const inNext = bnd[nbStart] ? nbStart - (a + 1) : g;
    let bestK = g, bestS = -Infinity;
    // Real gaps are a few lines; on a huge one only cuts near its ends are tried, so
    // the work stays linear in the paste's length.
    const ks = [];
    for (let k = minK; k <= g; k++) { if (k - minK > 12 && g - k > 12) k = g - 12; if (!k || gap[k - 1] !== 'L') ks.push(k); }
    if (!ks.length) ks.push(minK);
    for (const k of ks) {
      let s = 0, ti = 0, nameP = prevHasName, locP = prevLoc;
      for (let i = 0; i < k; i++) {
        const kd = gap[i];
        if (kd === 'A' || kd === 'L' || kd === 'S') continue;
        if (kd === 'H') { s -= 3; continue; }
        s += ti < tail.length ? (kd === tail[ti] ? 2 : -1) : -0.5; ti++;
        if (kd === 'N') { s += nameP ? -3 : 3; nameP = true; }
        if (kd === 'O') { s += locP ? -1.5 : 1; locP = true; }
      }
      const next = gap.slice(k).filter((kd) => kd !== 'H' && kd !== 'L' && kd !== 'S');
      let nameN = nextHasName, locN = nextLoc;
      for (let i = next.length - 1; i >= 0; i--) {
        const kd = next[i], pos = head.length - next.length + i;
        s += pos >= 0 && kd === head[pos] ? 2 : -2;
        if (kd === 'N') { s += nameN ? -3 : 3; nameN = true; }
        if (kd === 'O') { s += locN ? -1.5 : 1; locN = true; }
      }
      if (gap.slice(k).includes('H')) s += 2;
      if (bnd[a + 1 + k]) s += 1.5;
      if (k > inNext) s -= 2;
      if (s > bestS) { bestS = s; bestK = k; } // ties: the larger k (lines stay with the parcel before)
      else if (s === bestS) bestK = k;
    }
    chunks.push(range(start, a + 1 + bestK));
    start = a + 1 + bestK;
  }
  chunks.push(range(start, lastP + 1).concat(tailIdx));
  // A note for every parcel ("Всички с преглед") goes to each of them.
  // (a review note without amounts, at most two such lines, so a pasted wall of them
  // cannot multiply the rows' text)
  const isAllNote = (l) => { RV_MENTION_RE.lastIndex = 0; return ALL_PARCELS_RE.test(l) && !/\d/.test(l) && RV_MENTION_RE.test(l.toLowerCase()); };
  const allIdx = chunks.flat().filter((i) => 'RC'.includes(kinds[i]) && isAllNote(lines[i])).slice(0, 2);
  for (const c of chunks) for (const i of allIdx) if (!c.includes(i)) c.push(i);
  // The same phone repeated across chunks is one conversation, not two parcels —
  // merge those chunks so a quoted/confirmed number can't duplicate a shipment.
  const byPhone = new Map(), result = [];
  for (const ci of chunks) {
    const c = ci.filter((i) => !drop.has(i)).map((i) => lines[i]).join('\n');
    const m = PHONE_RE.exec(ci.filter((i) => isRec[i]).map((i) => lines[i]).join('\n'));
    const key = m ? normalizePhone(m[0]) : null;
    if (key && byPhone.has(key)) { const idx = byPhone.get(key); result[idx] += '\n' + c; continue; }
    if (key) byPhone.set(key, result.length);
    result.push(c);
  }
  return result;
}

// How many separate parcels a paste holds, counted the way parseMessage decides to
// read only the first one: further chunks that name their own recipient.
function namedParcelCount(text) {
  const recs = splitBatch(text);
  return recs.length ? 1 + recs.slice(1).filter(recHasName).length : 0;
}
// Index of the first phone number in a text (-1 when there is none).
function phoneIndexOf(text) { const m = PHONE_RE.exec(String(text || '')); return m ? m.index : -1; }

const isCommonFirstName = (w) => FIRST_NAMES.has(bare(String(w || '')));

module.exports = { parseMessage, matchOffices, normalizePhone, tokenize, detectCod, isCustomerOffice, stripNoise, splitBatch, countPhones, findWaybill, stripMoney, namedParcelCount, phoneIndexOf, isCommonFirstName };
