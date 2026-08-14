'use strict';

// What we search for and where. This is normally the only file you edit.

// Google Maps caps a single search at ~120 results, so large cities are swept
// from a grid of points rather than one centre — otherwise everything outside
// the centre is silently missing.
const CITIES = [
  { name: 'София',        lat: 42.6977, lng: 23.3219, steps: 3, spanKm: 9 },
  { name: 'Пловдив',      lat: 42.1354, lng: 24.7453, steps: 2, spanKm: 6 },
  { name: 'Варна',        lat: 43.2141, lng: 27.9147, steps: 2, spanKm: 6 },
  { name: 'Бургас',       lat: 42.5048, lng: 27.4626, steps: 2, spanKm: 5 },
  { name: 'Русе',         lat: 43.8356, lng: 25.9657, steps: 1, spanKm: 0 },
  { name: 'Стара Загора', lat: 42.4258, lng: 25.6345, steps: 1, spanKm: 0 },
  { name: 'Плевен',       lat: 43.4170, lng: 24.6067, steps: 1, spanKm: 0 },
  { name: 'Сливен',       lat: 42.6858, lng: 26.3292, steps: 1, spanKm: 0 },
];

// Search terms are Bulgarian on purpose: "plumber Sofia" returns a handful of
// results, "водопроводчик София" returns the actual market.
const CATEGORIES = {
  'Строителни услуги': [
    'водопроводчик',
    'ВиК услуги',
    'електротехник',
    'електро услуги',
    'монтаж на климатици',
    'отопление и климатизация',
    'покривни ремонти',
    'хидроизолация',
    'бояджийски услуги',
    'шпакловка и боядисване',
    'дърводелец',
    'мебели по поръчка',
    'строителна фирма',
    'ремонт на апартаменти',
    'ПВЦ дограма',
    'гипсокартон',
    'ключар',
  ],
  'Авто и механика': [
    'автосервиз',
    'автомивка',
    'сервиз за гуми',
    'вулканизатор',
    'автотенекеджийски услуги',
    'автобояджия',
    'автоелектротехник',
    'смяна на масло',
    'автостъкла',
    'стругарски услуги',
  ],
  'Индустрия и логистика': [
    'транспортна фирма',
    'логистична фирма',
    'хамалски услуги',
    'преместване на мебели',
    'куриерски услуги',
    'складова база',
    'заваръчни услуги',
    'метални конструкции',
    'металообработване',
  ],
  'Почистване и поддръжка': [
    'фирма за почистване',
    'професионално почистване',
    'озеленяване',
    'градинар',
    'дезинсекция и дератизация',
    'извозване на отпадъци',
    'поддръжка на сгради',
    'фасаден алпинизъм',
  ],
};

// Grid of coordinates around the city centre.
function gridFor(city) {
  const { lat, lng, steps, spanKm } = city;
  if (!steps || steps < 2 || !spanKm) return [{ lat, lng, zoom: 12 }];

  const points = [];
  const dLat = spanKm / 111.32;
  const dLng = spanKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const half = (steps - 1) / 2;

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      points.push({
        lat: lat + ((i - half) / half) * dLat,
        lng: lng + ((j - half) / half) * dLng,
        zoom: 14,
      });
    }
  }
  return points;
}

// Expand cities × categories × grid points into one flat job list.
function buildJobs({ cities, groups } = {}) {
  const pickedCities = cities?.length
    ? CITIES.filter((c) => cities.includes(c.name))
    : CITIES;

  const pickedGroups = groups?.length
    ? Object.fromEntries(Object.entries(CATEGORIES).filter(([g]) => groups.includes(g)))
    : CATEGORIES;

  const jobs = [];
  for (const city of pickedCities) {
    const points = gridFor(city);
    for (const [group, terms] of Object.entries(pickedGroups)) {
      for (const term of terms) {
        for (const point of points) {
          jobs.push({
            id: `${city.name}|${term}|${point.lat.toFixed(4)},${point.lng.toFixed(4)}`,
            city: city.name,
            group,
            term,
            ...point,
          });
        }
      }
    }
  }
  return jobs;
}

module.exports = { CITIES, CATEGORIES, gridFor, buildJobs };
