'use strict';

// Office nomenclature for the Econt mock and the golden tests. Each office is
// built in the shape Econt's NomenclaturesService.getOffices returns (the full,
// heavy object: city with its own nested data, phones, hours, coordinates), so
// the app's trimming and matching run on realistic input. Deterministic: no
// clock, no randomness, so golden outputs captured against it stay valid.

// [code, name, nameEn, city, cityEn, postCode, quarter, street, num, kind]
// kind: '' = normal office, 'aps' = Еконтомат (parcel locker), 'hub' = ЛЛЦ (sorting hub)
const PRODUCTION = [
  ['1111', 'София Павлово', 'Sofia Pavlovo', 'София', 'Sofia', '1000', 'ж.к. Павлово', 'ул. Александър Пушкин', '22', ''],
  ['1112', 'София Младост', 'Sofia Mladost', 'София', 'Sofia', '1000', 'ж.к. Младост 1', 'бул. Андрей Ляпчев', '51', ''],
  ['1113', 'София Надежда', 'Sofia Nadezhda', 'София', 'Sofia', '1000', 'ж.к. Надежда 2', 'бул. Ломско шосе', '200', ''],
  ['1114', 'София Люлин', 'Sofia Lyulin', 'София', 'Sofia', '1000', 'ж.к. Люлин 5', 'бул. Царица Йоанна', '64', ''],
  ['1115', 'София Център', 'Sofia Center', 'София', 'Sofia', '1000', '', 'ул. Граф Игнатиев', '15', ''],
  ['1116', 'София Васил Левски', 'Sofia Vasil Levski', 'София', 'Sofia', '1000', '', 'бул. Васил Левски', '100', ''],
  ['1190', 'Еконтомат София Ринг Мол', 'Econtomat Sofia Ring Mall', 'София', 'Sofia', '1000', 'кв. Малинова долина', 'Околовръстен път', '214', 'aps'],
  ['2222', 'Пловдив Център', 'Plovdiv Center', 'Пловдив', 'Plovdiv', '4000', '', 'бул. Цар Борис III Обединител', '2', ''],
  ['2223', 'Пловдив Тракия', 'Plovdiv Trakia', 'Пловдив', 'Plovdiv', '4000', 'ж.к. Тракия', 'ул. Съединение', '12', ''],
  ['2224', 'Пловдив Кършияка', 'Plovdiv Karshiyaka', 'Пловдив', 'Plovdiv', '4000', 'кв. Кършияка', 'ул. Васил Левски', '120', ''],
  ['2290', 'ЛЛЦ Пловдив', 'LLC Plovdiv', 'Пловдив', 'Plovdiv', '4000', 'Индустриална зона', 'ул. Кукленско шосе', '17', 'hub'],
  ['3333', 'Варна Чайка', 'Varna Chayka', 'Варна', 'Varna', '9000', 'ж.к. Чайка', 'ул. Чайка', '3', ''],
  ['3334', 'Варна Владиславово', 'Varna Vladislavovo', 'Варна', 'Varna', '9000', 'ж.к. Владислав Варненчик', 'ул. 312', '6', ''],
  ['3335', 'Варна Аспарухово', 'Varna Asparuhovo', 'Варна', 'Varna', '9000', 'кв. Аспарухово', 'ул. Народни будители', '2', ''],
  ['3336', 'Варна Център', 'Varna Center', 'Варна', 'Varna', '9000', '', 'бул. Христо Ботев', '5', ''],
  ['3390', 'Еконтомат Варна Гранд Мол', 'Econtomat Varna Grand Mall', 'Варна', 'Varna', '9000', '', 'ул. Андрей Сахаров', '2', 'aps'],
  ['4441', 'Бургас Лазур', 'Burgas Lazur', 'Бургас', 'Burgas', '8000', 'ж.к. Лазур', 'ул. Шейново', '1', ''],
  ['4442', 'Бургас Сарафово', 'Burgas Sarafovo', 'Бургас', 'Burgas', '8000', 'кв. Сарафово', 'ул. Крайморска', '10', ''],
  ['4443', 'Бургас Меден Рудник', 'Burgas Meden Rudnik', 'Бургас', 'Burgas', '8000', 'ж.к. Меден Рудник', 'зона А', '1', ''],
  ['5551', 'Русе Център', 'Ruse Center', 'Русе', 'Ruse', '7000', '', 'ул. Александровска', '51', ''],
  ['5552', 'Русе Дружба', 'Ruse Druzhba', 'Русе', 'Ruse', '7000', 'ж.к. Дружба 3', 'ул. Чипровци', '4', ''],
  ['6661', 'Стара Загора Център', 'Stara Zagora Center', 'Стара Загора', 'Stara Zagora', '6000', '', 'бул. Руски', '15', ''],
  ['6662', 'Плевен Център', 'Pleven Center', 'Плевен', 'Pleven', '5800', '', 'ул. Васил Левски', '160', ''],
  ['6663', 'Кърджали Възрожденци', 'Kardzhali Vazrozhdentsi', 'Кърджали', 'Kardzhali', '6600', 'кв. Възрожденци', 'бул. Беломорски', '64', ''],
  ['6664', 'Хасково Орфей', 'Haskovo Orfey', 'Хасково', 'Haskovo', '6300', '', 'ул. Орфей', '3', ''],
  ['6665', 'Велико Търново Картала', 'Veliko Tarnovo Kartala', 'Велико Търново', 'Veliko Tarnovo', '5000', 'кв. Картала', 'ул. Магистрална', '1', ''],
  ['6666', 'Благоевград Център', 'Blagoevgrad Center', 'Благоевград', 'Blagoevgrad', '2700', '', 'ул. Тодор Александров', '30', ''],
  ['6667', 'Шумен Център', 'Shumen Center', 'Шумен', 'Shumen', '9700', '', 'бул. Славянски', '25', ''],
  ['6668', 'Добрич Център', 'Dobrich Center', 'Добрич', 'Dobrich', '9300', '', 'ул. България', '3', ''],
  ['6669', 'Сливен Център', 'Sliven Center', 'Сливен', 'Sliven', '8800', '', 'бул. Цар Освободител', '11', ''],
  ['6670', 'Габрово Център', 'Gabrovo Center', 'Габрово', 'Gabrovo', '5300', '', 'ул. Брянска', '5', ''],
  ['6671', 'Казанлък', 'Kazanlak', 'Казанлък', 'Kazanlak', '6100', '', 'ул. Христо Ботев', '2', ''],
  ['6672', 'Своге', 'Svoge', 'Своге', 'Svoge', '2260', '', 'ул. Александър Стамболийски', '9', ''],
  ['6673', 'Ямбол Център', 'Yambol Center', 'Ямбол', 'Yambol', '8600', '', 'ул. Търговска', '7', ''],
  ['6674', 'Перник Център', 'Pernik Center', 'Перник', 'Pernik', '2300', '', 'ул. Кракра', '18', ''],
];

// The demo host has its own, smaller list (and different counts), like the real one.
const DEMO_CODES = ['1111', '1112', '1115', '2222', '2223', '3333', '3336', '4441', '4442', '5551', '6662', '6664'];

const DAY_MS = 86400000;
function cityObject(name, nameEn, postCode, i) {
  return {
    id: 100 + i,
    country: { id: 1033, code2: 'BG', code3: 'BGR', name: 'България', nameEn: 'Bulgaria', isEU: true },
    postCode, name, nameEn,
    regionName: name, regionNameEn: nameEn,
    phoneCode: '0' + (30 + (i % 60)),
    location: { latitude: 42 + (i % 10) / 10, longitude: 23 + (i % 7) / 10, confidence: 3 },
    expressCityDeliveries: i % 2 === 0,
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: i % 3 !== 0, sunday: false,
    serviceDays: 6, zoneId: 1 + (i % 4), zoneName: 'Зона ' + (1 + (i % 4)), zoneNameEn: 'Zone ' + (1 + (i % 4)),
    servingOffices: [{ officeCode: '0', servingType: 'from_office' }],
  };
}
function officeObject(row, i) {
  const [code, name, nameEn, city, cityEn, postCode, quarter, street, num, kind] = row;
  const fullAddress = ['гр. ' + city, quarter, [street, num].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    id: 5000 + i,
    code,
    isMPS: false,
    isAPS: kind === 'aps',
    name, nameEn,
    phones: ['+359 ' + (700 + i) + ' 17 ' + String(100 + i).slice(-3), '0' + (888000000 + i * 7919)],
    emails: [code + '@econt.com'],
    address: {
      id: 9000 + i,
      city: cityObject(city, cityEn, postCode, i),
      fullAddress,
      fullAddressEn: [cityEn, nameEn].join(', '),
      quarter: quarter || '',
      street: street || '',
      num: num || '',
      other: '',
      location: { latitude: 42.1 + i / 1000, longitude: 23.3 + i / 1000, confidence: 4 },
      zip: postCode,
      hezid: null,
    },
    info: kind === 'aps' ? 'Автомат за пратки, достъпен 24/7' : 'Работно време по график',
    currency: 'EUR',
    language: 'bg',
    normalBusinessHoursFrom: 1696143600000,
    normalBusinessHoursTo: 1696179600000,
    halfDayBusinessHoursFrom: 1696147200000,
    halfDayBusinessHoursTo: 1696165200000,
    sundayBusinessHoursFrom: null,
    sundayBusinessHoursTo: null,
    shipmentTypes: kind === 'aps' ? ['pack'] : ['document', 'pack', 'post_pack', 'pallet', 'cargo'],
    partnerCode: '',
    hubCode: kind === 'hub' ? code : '',
    hubName: kind === 'hub' ? name : '',
    hubNameEn: kind === 'hub' ? nameEn : '',
    isDrive: false,
    holidayStartDate: null,
    holidayEndDate: null,
    workingTimeSchedule: [1, 2, 3, 4, 5, 6].map((d) => ({ day: d, from: 1696143600000 + d * DAY_MS, to: 1696179600000 + d * DAY_MS })),
  };
}

function productionOffices() { return PRODUCTION.map(officeObject); }
function demoOffices() { return PRODUCTION.filter((r) => DEMO_CODES.includes(r[0])).map(officeObject); }
// A list as heavy as the real production one (~1000 offices, ~4 MB of JSON), for
// measuring that the relay passes it through without parsing it.
function bigOffices(n) {
  const base = productionOffices();
  const out = base.slice();
  for (let i = base.length; i < (n || 1000); i++) {
    const r = PRODUCTION[i % PRODUCTION.length];
    const o = officeObject([String(10000 + i), r[1] + ' ' + i, r[2] + ' ' + i, r[3], r[4], r[5], r[6], r[7], String(i), r[9] === 'hub' ? '' : r[9]], i);
    // Real office objects carry long working-hour tables; pad to a realistic size.
    o.workingTimeSchedule = o.workingTimeSchedule.concat(o.workingTimeSchedule, o.workingTimeSchedule);
    o.address.city.servingOffices = Array.from({ length: 12 }, (_, k) => ({ officeCode: String(1000 + k), servingType: k % 2 ? 'to_door' : 'from_office' }));
    out.push(o);
  }
  return out;
}

module.exports = { productionOffices, demoOffices, bigOffices, PRODUCTION, DEMO_CODES };
