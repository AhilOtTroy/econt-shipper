'use strict';

// Edge cases for the golden tests: size limits, a wrong or missing login, an office
// list that fails, the demo list. The texts are built here (some are 80 000
// characters long), so the golden file only stores the answers.
//
// creds: 'ok' | 'bad' (Econt rejects the password) | 'missing' | 'demo'
// fault: 'offices502' = Econt answers the office list with a 502 page

const phoneLine = (i) => 'Клиент ' + i + ' 0888' + String(100000 + i).slice(-6) + ' Варна Чайка';
const TWO = 'Петър Колев 0888777666 Варна офис Чайка\n\nАна Димитрова 0899555444 Пловдив офис Център 40 лв';
const ONE = 'Мария Петрова 0888123456 Пловдив офис Център';

function edgeCases() {
  const out = [];
  for (const lang of ['bg', 'en']) {
    out.push({ name: 'parse too long ' + lang, route: 'parse', lang, creds: 'ok', text: 'Мария Петрова 0888123456 Пловдив Център ' + 'х'.repeat(20000) });
    out.push({ name: 'parse at limit ' + lang, route: 'parse', lang, creds: 'ok', text: ('Мария Петрова 0888123456 Пловдив Център ' + 'х'.repeat(20000)).slice(0, 20000) });
    out.push({ name: 'batch too long ' + lang, route: 'batch', lang, creds: 'ok', text: 'Мария Петрова 0888123456 Пловдив Център\n' + 'x'.repeat(80000) });
    out.push({ name: 'batch too many phones ' + lang, route: 'batch', lang, creds: 'ok', text: Array.from({ length: 320 }, (_, i) => '0888' + String(100000 + i).slice(-6)).join(' ') });
    out.push({ name: 'batch too many rows ' + lang, route: 'batch', lang, creds: 'ok', text: Array.from({ length: 105 }, (_, i) => phoneLine(i)).join('\n') });
    out.push({ name: 'batch 100 rows ' + lang, route: 'batch', lang, creds: 'ok', text: Array.from({ length: 100 }, (_, i) => phoneLine(i)).join('\n') });
    out.push({ name: 'multi parcel ' + lang, route: 'parse', lang, creds: 'ok', text: TWO });
    out.push({ name: 'batch wrong login ' + lang, route: 'batch', lang, creds: 'bad', text: TWO });
    out.push({ name: 'parse missing login ' + lang, route: 'parse', lang, creds: 'missing', text: ONE });
    out.push({ name: 'batch missing login ' + lang, route: 'batch', lang, creds: 'missing', text: TWO });
  }
  out.push({ name: 'parse offices fail', route: 'parse', lang: 'bg', creds: 'demo', fault: 'offices502', text: ONE });
  out.push({ name: 'batch offices fail', route: 'batch', lang: 'bg', creds: 'demo', fault: 'offices502', text: TWO });
  out.push({ name: 'parse demo list', route: 'parse', lang: 'bg', creds: 'demo', text: 'Мария Петрова 0888123456 Пловдив офис Тракия' });
  out.push({ name: 'parse door', route: 'parse', lang: 'bg', creds: 'ok', text: 'Моля на адрес гр. София, ж.к. Люлин 5, бл. 512, ап. 45. Николай Георгиев 0898 765 432' });
  out.push({ name: 'batch demo list', route: 'batch', lang: 'en', creds: 'demo', text: 'Петя 0888 454 001 Варна Чайка 30 лв\nЕлена 0888 454 002 Пловдив Тракия 20 лв\nМария 0888 454 003 Своге 15 лв' });
  return out;
}

module.exports = { edgeCases };
