'use strict';

const $ = (id) => document.getElementById(id);
const $q = (sel) => document.querySelector(sel);
// Respect the OS reduce-motion setting in JS-driven scrolls too.
const scrollBehavior = () => (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth';
const KEY = 'econt_shipper_v1';
const PKEY = 'econt_parcels';

// ===================== creator / credits =====================
// Shown on the About page and in the © footer. Fill in your real handles —
// empty fields are simply hidden, so the page always looks complete.
const CREATOR = {
  name: 'Ivan Manastirsky',              // public name (© line + About page)
  instagram: 'ivnmky',                   // instagram username, without @
  facebook: 'https://www.facebook.com/profile.php?id=100022967482779',
  email: 'contact@ivanmanastirsky.xyz',  // public contact email
};

// ===================== i18n =====================
const I18N = {
  bg: {
    page_title: 'Econt Shipper: от текст до пратка', parse_failed: 'Неуспешно разчитане.',
    land_pill: 'За продавачи в OLX, Bazar, Instagram и Facebook', land_title: 'От текст до пратка.',
    land_sub: 'Пускаш съобщението от клиента, хвърляш едно око и товарителницата е готова в твоя Еконт.',
    land_cta: 'Започнете безплатно', land_what_h: 'Накратко',
    land_what_p: 'Работи с каквото ти пратят: съобщение, списък или снимка от чата. Приложението открива имената, телефона и офиса и създава товарителницата във вашия Еконт акаунт. Входът остава на устройството, заключен с PIN.',
    land_f1: 'Чете текст и снимки от чата (OCR).', land_f2: 'Разпознава трите имена, телефона и офиса.',
    land_f3: 'Наложен платеж, обявена стойност, преглед и тест.', land_f4: 'Жив статус и готов отговор с номер за проследяване.',
    setup_title: 'Бърза настройка', setup_sub: 'Еднократно. Всичко остава на устройството, с PIN.',
    setup_s1: 'Изберете PIN', setup_s1_sub: 'Заключва приложението и криптира паролата ви за Еконт на това устройство.',
    setup_pin: 'PIN (4-6 цифри)', setup_pin2: 'Повторете PIN', setup_s2: 'Вашият Еконт акаунт', setup_mode: 'Режим', mode_prod: 'Реален', mode_demo: 'Демо',
    setup_user: 'Потребителско име в Еконт (точно, с главни/малки букви)', setup_pass: 'Парола за Еконт', setup_test: 'Проверка на входа',
    setup_demo_try: 'Без вход в Еконт? Пробвай ДЕМО акаунта', demo_note: 'В момента сте в ДЕМО режим. Въведете реалния си потребител и парола, запазете, и приложението минава на реалния ви акаунт.',
    setup_s3: 'Вие (подателят)', setup_yourname: 'Вашето име', setup_yourphone: 'Вашият телефон', setup_youroffice: 'Вашият офис за подаване',
    setup_search_office: 'търсене по град / име на офис…', find: 'Намери', setup_s4: 'Вашите обичайни настройки', weight: 'Тегло (кг)', contents: 'Съдържание', who_pays: 'Кой плаща',
    receiver_pays: 'Получателят плаща', i_pay: 'Аз плащам', setup_cod: 'Обикновено с наложен платеж (сумата въвеждате за всяка пратка)',
    cod_currency: 'Валута на наложен платеж', setup_finish: 'Завършете настройката →',
    lock_title: 'Въведете PIN', unlock: 'Отключи', forget: 'Изтрий от това устройство и започни наново',
    app_brand: 'Econt Shipper', nav_new: 'Нова', nav_parcels: 'Пратки',
    set_account: 'Еконт акаунт', username: 'Потребител', pass_keep: 'Парола (празно = без промяна)',
    set_sender: 'Подател', name: 'Име', phone: 'Телефон', set_office_code: 'Код на вашия офис за подаване', search: 'търсене…',
    set_defaults: 'Настройки по подразбиране', receiver: 'Получател', sender: 'Подател', set_cod_default: 'Наложен платеж по подразбиране',
    set_shiptype: 'Тип пратка', shiptype_pack: 'Колет', shiptype_doc: 'Документи', set_packcount: 'Брой пакети',
    set_sms: 'SMS известие до получателя за всяка пратка', cod_warn: 'Няма наложен платеж на тази пратка',
    offices_status: '{n} активни офиса · списък отпреди {m} мин', offices_added: '+{d} нови офиса',
    gaps_prefix: 'Не разчетох: ', gap_name: 'име', gap_phone: 'телефон', gap_office: 'офис', gap_addr: 'адрес', gaps_hint: ', попълнете ги ръчно.',
    decl: 'Обявена стойност', decl_default: 'Обявена стойност по подразбиране (= наложения платеж, ако няма друга сума)',
    sec_recipient: 'Получател', sec_delivery: 'Доставка', sec_parcel: 'Пратка', sec_pay: 'Плащане и опции',
    ret_label: 'Ако получателят откаже пратката, къде да се върне', ret_default: 'Както е настроено в Еконт', ret_office: 'В офис (въведете код)', ret_address: 'На адрес', ret_office_ph: 'код на офис, напр. 9049',
    batch_h: 'Партида: няколко пратки', batch_found: '{n} пратки открити · {c} за създаване · {t} за проследяване', batch_create: '✓ Изпълни избраните', batch_cancel: 'Затвори',
    batch_edit: 'Отвори', batch_no_office: 'избери офис…', batch_addr_row: 'до адрес: {a}',
    st_create: 'нова пратка', st_track: 'има товарителница → проследяване', st_missing: 'липсва офис', st_creating: 'създаване…', st_ok: '✓ {num}', st_tracked: '✓ добавена за проследяване', st_skip: 'пропусната',
    batch_done: 'Готово: {ok} успешни · {fail} грешки · {skip} пропуснати',
    row_label: 'Ред {n}', ret_incomplete: 'Опцията за връщане не е запазена. Попълнете офис код или адрес.',
    back_to_batch: '← Към партидата ({n})',
    payout_label: 'Изплащане на наложения платеж', payout_default: 'Както е зададено в Еконт', payout_load: 'Зареди сметките',
    payout_bank: 'банков превод', payout_office: 'в офис', payout_address: 'на адрес',
    payout_hint: 'Парите се превеждат по сметката от избраното споразумение с Еконт.',
    payout_found: 'Намерени {n} споразумения ({b} банкови). Изберете по кое да получавате парите.',
    payout_none: 'Няма споразумения за изплащане в акаунта ви. За получаване по банков път подпишете споразумение с Еконт.',
    refresh_offices: 'Обнови офисите', save: 'Запази',
    paste_label: 'Поставете съобщението на клиента', paste_ph: 'Моля да ги изпратите в Офис на еконт: …  Име - 08xx xxx xxx', paste_hint: 'Съвет: Ctrl+Enter за преглед',
    img_cta: 'Снимка → товарителница', img_hint: 'Пуснете, поставете или изберете снимка на чата', or_paste: 'или поставете текста',
    comp_hint: 'Постави текст или снимка от чата, или просто ги пусни върху полето.', a11y_attach: 'Прикачи снимка',
    ocr_loading: 'Подготовка на четеца…', ocr_reading: 'Разчитане на снимката… {p}%', ocr_empty: 'Не открих текст в снимката. Опитайте по-ясна снимка.', ocr_fail: 'Неуспешно разчитане. Поставете текста ръчно.',
    clear: 'Изчисти', preview: 'Преглед →', prev_h: 'Проверете и потвърдете', recipient: 'Име на получателя', deliver_office: 'Доставка до офис',
    deliver_to: 'Доставка', to_office: 'До офис', to_address: 'До адрес',
    addr_city: 'Град', addr_post: 'Пощ. код', addr_street: 'Улица / квартал', addr_num: '№', addr_note: 'Ориентир (по избор)', need_addr: 'Нужни са град и улица/квартал за доставка до адрес.',
    wrong_office: 'грешен офис? търсене по име/град…', search_btn: 'Търси', description: 'Описание', pays: 'Плаща',
    cod: 'Нал. платеж', amount: 'сума', recalc: 'Преизчисли', create_btn: '✓ Създай товарителница',
    res_h: 'Товарителницата е създадена', copy: 'Копирай номера', label_pdf: 'Етикет PDF', view_in_profile: 'Виж в профила', new: '+ Нова',
    dd_site: 'econt.com', dd_site_sub: 'Официалният сайт на Еконт', dd_profile: 'e-Econt профил', dd_profile_sub: 'Пратките във вашия акаунт',
    reply_copy: 'Отговор за клиента', reply_copied: 'Отговорът е копиран ✓', track_link: 'Проследи',
    reply_template: 'Готово! Пратката е подадена.\nТоварителница: {num}\nПроследяване: {url}',
    match_high: '✓ сигурно съвпадение', match_mid: 'вероятно съвпадение', match_lo: 'провери офиса',
    parcels_h: 'Вашите пратки', parcels_refresh: 'Обнови',
    clear_all: 'Изчисти всички', clear_confirm: 'Да се премахнат ли ВСИЧКИ пратки от списъка?', del_confirm: 'Премахни пратката от списъка?', yes: 'Да', no: 'Не', removed: 'Премахнато ✓', del_aria: 'Изтрий пратката', parcels_note: 'Показва пратките, създадени през това приложение, с актуален статус от Еконт.',
    parcels_empty: 'Все още няма пратки тук. Създайте първата от раздел „Нова“.', exp_delivery: 'Очаквана доставка', collected: 'Събрано НП',
    track_events: 'Проследяване', reprint: 'Етикет', copied: 'Копирано ✓', need_desc: 'Описанието е задължително за колетни пратки.',
    loading: 'Зареждане…', no_status: 'няма статус', other_env: 'друга среда', status_delivered: 'Доставена', status_transit: 'В движение', kg: 'кг',
    review_only: 'Преглед', review_test: 'Преглед и тест', review_none: 'Без преглед',
    review_setting: 'Фиксирай „Преглед“ за всяка пратка', review_unanchored: 'Избирам за всяка пратка',
    review_label: 'Опция „Преглед“', review_from_settings: 'Преглед: {mode} (от настройките)',
    track_ph: 'добави номер на пратка…', track_add: 'Добави', already_added: 'Вече е добавена', invalid_number: 'Невалиден номер на пратка',
    details: 'Детайли', hide_details: 'Скрий детайли', in_operation: 'Във движение от', delivered_ok: 'Доставена успешно', returned_ok: 'Върната към подателя', awaiting_dispatch: 'Очаква изпращане',
    d_status: 'Статус', d_sender: 'Подател', d_recipient: 'Получател', d_phone: 'Телефон', d_office: 'Офис получател', d_sender_office: 'Офис подател', d_storage: 'Съхранява се в', d_type: 'Тип', d_packs: 'Брой', d_weight: 'Тегло', d_contents: 'Съдържание', d_review: 'Преглед', d_created: 'Създадена', d_sent: 'Изпратена', d_expected: 'Очаквана доставка', d_delivered: 'Доставена на', d_cod: 'Наложен платеж', d_price: 'Цена', d_attempts: 'Опити за доставка', d_routing: 'Маршрут',
    dd: 'д', dh: 'ч', dm: 'м', ds: 'с',
    testing: 'Проверка…', login_saved: 'Запазено.', fix_login_hint: 'Отворете Настройки (зъбното колело горе) и натиснете „Проверка на входа“ с паролата ви за e-econt.com.', server_waking: 'Сървърът се събужда. Изчакайте 30 секунди и опитайте пак.', net_down: 'Няма интернет връзка.', login_ok: '✓ Входът работи. Налични са {n} офиса.', need_creds: 'Първо въведете потребител и парола.',
    pin_short: 'PIN трябва да е поне 4 цифри.', pin_mismatch: 'PIN кодовете не съвпадат.', test_first: 'Първо проверете входа за Еконт (стъпка 2).',
    fill_sender: 'Попълнете име, телефон и изберете офис за подаване (стъпка 3).',
    paste_first: 'Първо поставете съобщение.', pick_office: 'Първо изберете офис.', need_recip: 'Нужни са име, телефон и офис.',
    cod_blank: 'Наложеният платеж е включен, а сумата е празна. Въведете сума или го изключете.',
    saved: 'Запазено ✓', creating: 'Създаване…', getting_price: 'Изчисляване на цена…', validated: 'Проверено ✓',
    est_price: 'Очаквана цена: <span class="price">{v} {cur}</span>', price_label: 'Цена: {v} {cur}',
    no_match: 'Няма съвпадащ офис за „{q}“. Потърсете по-долу.', office_err: 'Грешка със списъка офиси: {err}',
    demo_hint: 'ДЕМО списък с офиси (~585). Въведете реалния си вход в Настройки, за да преминете на реален режим.',
    wrong_pin: 'Грешен PIN.', forget_confirm: 'Да премахна ли запазения Еконт вход и настройки от това устройство?',
    refreshing: 'Обновяване…', offices_loaded: 'Заредени {n} офиса ✓', searching: 'търсене…', no_matches: 'няма резултати',
    no_number: '(няма върнат номер)', econt_prefix: 'Еконт: ', error_prefix: 'Грешка: ',
    land_trust: 'Безплатно · Без сървърна регистрация · Данните остават при вас',
    step1_t: 'Постави', step1_s: 'съобщението или снимка от чата', step2_t: 'Провери', step2_s: 'име, офис и наложен платеж', step3_t: 'Създай', step3_s: 'и прати номера на клиента',
    about_sub: 'От текст до пратка. Малък инструмент, който върши едно нещо и го върши добре.',
    about_app_h: 'Полезно да знаете',
    about_app_p: 'Приложението чете какво ви е писал клиентът и прави товарителницата във вашия Еконт акаунт. Разбира текст и снимки, наложен платеж и обявена стойност, преглед и тест, и показва жив статус на всяка пратка.',
    about_priv: 'Входът ви за Еконт стои само на това устройство, криптиран с PIN. Нямаме сървър с ваши данни и не следим нищо.',
    about_free: 'Безплатно за всички податели в Еконт.',
    about_creator_h: 'Създател', about_creator_role: 'Идея, дизайн и разработка',
    about_back: '← Назад', footer_about: 'За приложението · Контакти', rights: 'Всички права запазени.',
    a11y_theme_dark: 'Превключи към тъмна тема', a11y_theme_light: 'Превключи към светла тема',
    a11y_info: 'За приложението', a11y_settings: 'Настройки', a11y_lock: 'Заключи', a11y_home: 'Начало',
    // wake-up / retry / unsure create
    wake_wait: 'Сървърът се събужда, още няколко секунди…', price_waiting: 'Цената идва след малко, сървърът се събужда.',
    create_unsure: 'Не стана ясно дали товарителницата е създадена. Провери в e-Econt профила, преди да опиташ пак.', create_unsure_link: 'Отвори e-Econt',
    st_unsure: 'неясно, провери в e-Econt', badge_demo: 'ДЕМО',
    busy_wait: 'Изчакай, създавам пратка…',
    // paste / live price / keyboard
    a11y_paste: 'Постави от клипборда', clip_denied: 'Нямам достъп до клипборда. Постави текста в полето.', clip_empty: 'Клипбордът е празен.',
    create_hint: '{k}+Enter създава товарителницата',
    // telling the customer
    send_customer: 'Прати на клиента', parcel_reply: 'Отговор', reply_prev_h: 'Това получава клиентът',
    reply_paste_now: 'Отговорът е копиран, постави го в чата.', copied_btn: 'Копирано',
    copy_fail: 'Не успях да копирам. Задръж пръст върху текста и го копирай.', created_sr: 'Товарителницата е създадена. Номер {num}.',
    reply_review: 'На гише отваряш, проверяваш и плащаш само ако всичко е наред.',
    reply_review_test: 'На гише отваряш, проверяваш и тестваш, и плащаш само ако всичко е наред.',
    reply_cod: 'Наложен платеж: {amt}.',
    // COD guard
    st_nocod: 'без наложен платеж', batch_nocod: 'Без наложен платеж ще тръгнат: {rows}. Да продължа ли?',
    nocod_confirm: 'Тази пратка тръгва без наложен платеж. Да продължа ли?', nocod_go: 'Да, без наложен платеж', nocod_fix: 'Ще добавя сума',
    cod_conv: '{a} лв са около {e} €. Провери в каква валута е цената в обявата.',
    cod_conv_rev: '{a} € са около {b} лв. Провери в каква валута е цената в обявата.',
    // duplicate guard
    dup_warn: 'Вече има пратка до този номер: {num} от {date}.', dup_show: 'Покажи', dup_confirm_btn: 'Създай втора пратка',
    st_dup: 'вече изпратена ({num})',
    // parcels tab
    upd_now: 'Обновено току-що', upd_min: 'Обновено преди {m} мин', upd_hours: 'Обновено преди {h} ч',
    upd_failed: 'Не успях да обновя. Виждаш последния известен статус.',
    parcels_empty_t: 'Тук ще се появят пратките ти', parcels_empty_s: 'Създай първата от „Нова“ или добави номер на товарителница отгоре.',
    parcels_empty_cta: 'Нова пратка', a11y_details: 'Подробности за пратката',
  },
  en: {
    page_title: 'Econt Shipper: from text to parcel', parse_failed: 'Could not parse that.',
    land_pill: 'For sellers on OLX, Bazar, Instagram & Facebook', land_title: 'From text to parcel.',
    land_sub: 'Drop in the customer message, give it a quick look, and the waybill is ready in your Econt.',
    land_cta: 'Start for free', land_what_h: 'In short',
    land_what_p: 'It works with whatever you get: a message, a list, a chat screenshot. The app finds the names, the phone and the office, then creates the waybill in your Econt account. Your login stays on this device, locked with a PIN.',
    land_f1: 'Reads text and chat screenshots (OCR).', land_f2: 'Recognises all three names, the phone and the office.',
    land_f3: 'Cash on delivery, declared value, review & test.', land_f4: 'Live status and a ready reply with the tracking number.',
    setup_title: 'Quick setup', setup_sub: 'One time. Everything stays on this device, behind a PIN.',
    setup_s1: 'Choose a PIN', setup_s1_sub: 'Locks the app and encrypts your Econt password on this device.',
    setup_pin: 'PIN (4-6 digits)', setup_pin2: 'Repeat PIN', setup_s2: 'Your Econt account', setup_mode: 'Mode', mode_prod: 'Production', mode_demo: 'Demo',
    setup_user: 'Econt username (exact, case-sensitive)', setup_pass: 'Econt password', setup_test: 'Test login',
    setup_demo_try: 'No Econt login? Try the demo account', demo_note: 'You are in DEMO mode. Enter your real username and password, hit save, and the app moves to your real account.',
    setup_s3: 'You (the sender)', setup_yourname: 'Your name', setup_yourphone: 'Your phone', setup_youroffice: 'Your drop-off office',
    setup_search_office: 'search by city / office name…', find: 'Find', setup_s4: 'Your usual options', weight: 'Weight (kg)', contents: 'Contents', who_pays: 'Who pays',
    receiver_pays: 'Receiver pays', i_pay: 'I pay', setup_cod: 'Usually cash-on-delivery (you type the amount per parcel)',
    cod_currency: 'COD currency', setup_finish: 'Finish setup →',
    lock_title: 'Enter PIN', unlock: 'Unlock', forget: 'Forget this device & start over',
    app_brand: 'Econt Shipper', nav_new: 'New', nav_parcels: 'Parcels',
    set_account: 'Econt account', username: 'Username', pass_keep: 'Password (blank = keep)',
    set_sender: 'Sender', name: 'Name', phone: 'Phone', set_office_code: 'Your drop-off office code', search: 'search…',
    set_defaults: 'Default options', receiver: 'Receiver', sender: 'Sender', set_cod_default: 'COD on by default',
    set_shiptype: 'Shipment type', shiptype_pack: 'Parcel', shiptype_doc: 'Documents', set_packcount: 'Number of packs',
    set_sms: 'SMS notification to the recipient for every parcel', cod_warn: 'No cash-on-delivery on this parcel',
    offices_status: '{n} active offices · list from {m} min ago', offices_added: '+{d} new offices',
    gaps_prefix: 'Could not read: ', gap_name: 'name', gap_phone: 'phone', gap_office: 'office', gap_addr: 'address', gaps_hint: ', fill them in manually.',
    decl: 'Declared value', decl_default: 'Declared value by default (= the COD amount unless set otherwise)',
    sec_recipient: 'Recipient', sec_delivery: 'Delivery', sec_parcel: 'Parcel', sec_pay: 'Payment & options',
    ret_label: 'If the receiver refuses, where the parcel goes back to', ret_default: 'As configured with Econt', ret_office: 'To an office (enter code)', ret_address: 'To an address', ret_office_ph: 'office code, e.g. 9049',
    batch_h: 'Batch: several parcels', batch_found: '{n} parcels found · {c} to create · {t} to track', batch_create: '✓ Run selected', batch_cancel: 'Close',
    batch_edit: 'Open', batch_no_office: 'pick an office…', batch_addr_row: 'to address: {a}',
    st_create: 'new parcel', st_track: 'has a waybill → tracking', st_missing: 'office missing', st_creating: 'creating…', st_ok: '✓ {num}', st_tracked: '✓ added to tracking', st_skip: 'skipped',
    batch_done: 'Done: {ok} created · {fail} errors · {skip} skipped',
    row_label: 'Row {n}', ret_incomplete: 'Return option not saved. Fill in the office code or address.',
    back_to_batch: '← Back to batch ({n})',
    payout_label: 'COD payout', payout_default: 'As configured with Econt', payout_load: 'Load accounts',
    payout_bank: 'bank transfer', payout_office: 'at office', payout_address: 'to address',
    payout_hint: 'COD money is paid out to the account in the agreement you pick with Econt.',
    payout_found: 'Found {n} agreements ({b} bank). Pick which one your money goes to.',
    payout_none: 'No payout agreements on your account. To be paid by bank transfer, sign an agreement with Econt.',
    refresh_offices: 'Refresh offices', save: 'Save',
    paste_label: "Paste the customer's message", paste_ph: 'Please send to Econt office: Varna Chataldzha…  Ivan Petrov - 08xx xxx xxx', paste_hint: 'Tip: Ctrl+Enter to preview',
    img_cta: 'Screenshot → label', img_hint: 'Drop, paste or pick a screenshot of the chat', or_paste: 'or paste the text',
    comp_hint: 'Paste text or a chat screenshot, or just drop them onto this box.', a11y_attach: 'Attach a screenshot',
    ocr_loading: 'Preparing the reader…', ocr_reading: 'Reading the screenshot… {p}%', ocr_empty: 'No text found in the image. Try a clearer screenshot.', ocr_fail: 'Could not read it. Paste the text manually.',
    clear: 'Clear', preview: 'Preview →', prev_h: 'Check & confirm', recipient: 'Recipient name', deliver_office: 'Deliver to office',
    deliver_to: 'Delivery', to_office: 'To office', to_address: 'To address',
    addr_city: 'City', addr_post: 'Post code', addr_street: 'Street / quarter', addr_num: 'No.', addr_note: 'Landmark (optional)', need_addr: 'City and street/quarter are required for address delivery.',
    wrong_office: 'wrong office? search by name/city…', search_btn: 'Search', description: 'Description', pays: 'Pays',
    cod: 'COD', amount: 'amount', recalc: 'Recalculate', create_btn: '✓ Create shipment number',
    res_h: 'Shipment created', copy: 'Copy number', label_pdf: 'Label PDF', view_in_profile: 'View in profile', new: '+ New',
    dd_site: 'econt.com', dd_site_sub: 'Official Econt website', dd_profile: 'e-Econt profile', dd_profile_sub: 'Shipments in your account',
    reply_copy: 'Customer reply', reply_copied: 'Reply copied ✓', track_link: 'Track',
    reply_template: 'Done! Your parcel is on its way.\nTracking number: {num}\nTrack it: {url}',
    match_high: '✓ strong match', match_mid: 'likely match', match_lo: 'check the office',
    parcels_h: 'Your parcels', parcels_refresh: 'Refresh',
    clear_all: 'Clear all', clear_confirm: 'Remove ALL parcels from the list?', del_confirm: 'Remove this parcel from the list?', yes: 'Yes', no: 'No', removed: 'Removed ✓', del_aria: 'Delete parcel', parcels_note: 'Shows parcels created through this app, with live status from Econt.',
    parcels_empty: 'No parcels yet. Create your first from the New tab.', exp_delivery: 'Expected delivery', collected: 'COD collected',
    track_events: 'Tracking', reprint: 'Label', copied: 'Copied ✓', need_desc: 'Description is required for parcels.',
    loading: 'Loading…', no_status: 'no status', other_env: 'other env', status_delivered: 'Delivered', status_transit: 'In transit', kg: 'kg',
    review_only: 'Review', review_test: 'Review & Test', review_none: 'No review',
    review_setting: 'Fix a review option for every parcel', review_unanchored: 'Choose per shipment',
    review_label: 'Review option', review_from_settings: 'Review: {mode} (from settings)',
    track_ph: 'add a shipment number…', track_add: 'Add', already_added: 'Already added', invalid_number: 'Invalid shipment number',
    details: 'Details', hide_details: 'Hide details', in_operation: 'In transit for', delivered_ok: 'Delivered successfully', returned_ok: 'Returned to sender', awaiting_dispatch: 'Awaiting dispatch',
    d_status: 'Status', d_sender: 'Sender', d_recipient: 'Recipient', d_phone: 'Phone', d_office: 'Receiver office', d_sender_office: 'Sender office', d_storage: 'Stored at', d_type: 'Type', d_packs: 'Packs', d_weight: 'Weight', d_contents: 'Contents', d_review: 'Review', d_created: 'Created', d_sent: 'Dispatched', d_expected: 'Expected delivery', d_delivered: 'Delivered at', d_cod: 'COD', d_price: 'Price', d_attempts: 'Delivery attempts', d_routing: 'Routing',
    dd: 'd', dh: 'h', dm: 'm', ds: 's',
    testing: 'Testing…', login_saved: 'Saved.', fix_login_hint: 'Open Settings (the cog at the top) and press "Test login" with your e-econt.com password.', server_waking: 'The server is waking up. Wait 30 seconds and try again.', net_down: 'No internet connection.', login_ok: '✓ Login works. {n} offices available.', need_creds: 'Enter username and password first.',
    pin_short: 'PIN must be at least 4 digits.', pin_mismatch: 'PINs do not match.', test_first: 'Test your Econt login first (step 2).',
    fill_sender: 'Fill your name, phone and pick your drop-off office (step 3).',
    paste_first: 'Paste a message first.', pick_office: 'Pick an office first.', need_recip: 'Need recipient name, phone and an office.',
    cod_blank: 'COD is on but the amount is empty. Enter an amount or switch it off.',
    saved: 'Saved ✓', creating: 'Creating…', getting_price: 'Getting price…', validated: 'Validated ✓',
    est_price: 'Estimated price: <span class="price">{v} {cur}</span>', price_label: 'Price: {v} {cur}',
    no_match: 'No office matched "{q}". Search below.', office_err: 'Office list error: {err}',
    demo_hint: 'DEMO office list (~585). Enter your real login in Settings to switch to production.',
    wrong_pin: 'Wrong PIN.', forget_confirm: 'Remove your saved Econt login and settings from this device?',
    refreshing: 'Refreshing…', offices_loaded: 'Loaded {n} offices ✓', searching: 'searching…', no_matches: 'no matches',
    no_number: '(no number returned)', econt_prefix: 'Econt: ', error_prefix: 'Error: ',
    land_trust: 'Free · No server accounts · Your data stays with you',
    step1_t: 'Paste', step1_s: 'the message or a chat screenshot', step2_t: 'Check', step2_s: 'name, office and COD', step3_t: 'Create', step3_s: 'and send the number to the customer',
    about_sub: 'From text to parcel. A small tool that does one thing and does it well.',
    about_app_h: 'Good to know',
    about_app_p: 'The app reads what your customer wrote and builds the waybill in your Econt account. It understands text and screenshots, cash on delivery and declared value, review and test, and it shows live status for every parcel.',
    about_priv: 'Your Econt login lives only on this device, encrypted with your PIN. We keep no database about you and we track nothing.',
    about_free: 'Free for every Econt sender.',
    about_creator_h: 'Creator', about_creator_role: 'Idea, design & development',
    about_back: '← Back', footer_about: 'About · Contact', rights: 'All rights reserved.',
    a11y_theme_dark: 'Switch to dark theme', a11y_theme_light: 'Switch to light theme',
    a11y_info: 'About this app', a11y_settings: 'Settings', a11y_lock: 'Lock', a11y_home: 'Home',
    // wake-up / retry / unsure create
    wake_wait: 'The server is waking up, a few more seconds…', price_waiting: 'The price will show in a moment, the server is waking up.',
    create_unsure: 'Could not tell whether the waybill was created. Check your e-Econt profile before trying again.', create_unsure_link: 'Open e-Econt',
    st_unsure: 'unclear, check e-Econt', badge_demo: 'DEMO',
    busy_wait: 'Hold on, a parcel is being created…',
    // paste / live price / keyboard
    a11y_paste: 'Paste from clipboard', clip_denied: 'No clipboard access. Paste the text into the box.', clip_empty: 'The clipboard is empty.',
    create_hint: '{k}+Enter creates the waybill',
    // telling the customer
    send_customer: 'Send to customer', parcel_reply: 'Reply', reply_prev_h: 'What the customer gets',
    reply_paste_now: 'Reply copied, paste it into the chat.', copied_btn: 'Copied',
    copy_fail: 'Could not copy. Press and hold the text to copy it.', created_sr: 'Shipment created. Number {num}.',
    reply_review: 'At the counter you can open and check it, and pay only if everything is fine.',
    reply_review_test: 'At the counter you can open, check and test it, and pay only if everything is fine.',
    reply_cod: 'Cash on delivery: {amt}.',
    // COD guard
    st_nocod: 'no COD', batch_nocod: 'These go out without cash on delivery: {rows}. Go ahead?',
    nocod_confirm: 'This parcel goes out without cash on delivery. Go ahead?', nocod_go: 'Yes, without COD', nocod_fix: 'I will add an amount',
    cod_conv: '{a} BGN is about {e} EUR. Check which currency the listing used.',
    cod_conv_rev: '{a} EUR is about {b} BGN. Check which currency the listing used.',
    // duplicate guard
    dup_warn: 'There is already a parcel to this number: {num} from {date}.', dup_show: 'Show', dup_confirm_btn: 'Create a second parcel',
    st_dup: 'already sent ({num})',
    // parcels tab
    upd_now: 'Updated just now', upd_min: 'Updated {m} min ago', upd_hours: 'Updated {h} h ago',
    upd_failed: "Couldn't refresh. You're seeing the last known status.",
    parcels_empty_t: 'Your parcels will show up here', parcels_empty_s: 'Create one from New, or add a waybill number above.',
    parcels_empty_cta: 'New parcel', a11y_details: 'Parcel details',
  },
};
let LANG = ['bg', 'en'].includes(localStorage.getItem('econt_lang')) ? localStorage.getItem('econt_lang') : 'bg';
// One consistent line-icon family (stroke = currentColor, so icons follow the theme).
const ICONS = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.6 4.6 6 6M18 18l1.4 1.4M19.4 4.6 18 6M6 18l-1.4 1.4"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
  refresh: '<path d="M21 4v6h-6"/><path d="M20.2 14a8.2 8.2 0 1 1-1.9-8.4L21 8.2"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  money: '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5 16 16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M15 3h-3a4 4 0 0 0-4 4v3H6v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
};
function svgi(name, cls) {
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
// Escape untrusted text before it goes into innerHTML.
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function t(key, params) {
  const dict = I18N[LANG] || I18N.en;
  let s = dict[key];
  if (s == null) s = (I18N.en[key] != null ? I18N.en[key] : key);
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}
function applyLang() {
  const dict = I18N[LANG] || I18N.en;
  document.documentElement.lang = LANG;
  document.title = dict.page_title || I18N.en.page_title;
  document.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (dict[k] != null && !el.hasAttribute('aria-busy')) el.textContent = dict[k]; });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const k = el.getAttribute('data-i18n-ph'); if (dict[k] != null) el.placeholder = dict[k]; });
  $('langBg').classList.toggle('active', LANG === 'bg');
  $('langEn').classList.toggle('active', LANG === 'en');
  $('footerCopy').textContent = `© ${new Date().getFullYear()} ${CREATOR.name || 'Econt Shipper'}`;
  $('footerAbout').textContent = dict.footer_about || I18N.en.footer_about;
  // Translated accessible names for the emoji-only controls.
  for (const [id, k] of [['infoBtn', 'a11y_info'], ['settingsBtn', 'a11y_settings'], ['lockNowBtn', 'a11y_lock'], ['brandHome', 'a11y_home'], ['attachBtn', 'a11y_attach'], ['pasteBtn', 'a11y_paste'], ['recalcBtn', 'recalc'], ['msg', 'paste_label'], ['refreshParcelsBtn', 'parcels_refresh']]) {
    const el = $(id); if (el) { el.setAttribute('aria-label', t(k)); el.title = t(k); }
  }
  $('createHint').textContent = t('create_hint', { k: isMac ? '⌘' : 'Ctrl' });
  syncThemeBtnLabel();
}
function syncThemeBtnLabel() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const label = t(dark ? 'a11y_theme_light' : 'a11y_theme_dark');
  $('themeBtn').setAttribute('aria-label', label); $('themeBtn').title = label;
}
function setLang(l) {
  LANG = l; localStorage.setItem('econt_lang', l); applyLang();
  syncCreateLabel();
  if (!$('result').classList.contains('hide')) renderReplyPreview();
  if (!$('batchNoCodConfirm').classList.contains('hide')) renderBatchNoCodMsg();
  if (!$('preview').classList.contains('hide')) updateSummary();
  if (!$('tab-parcels').classList.contains('hide')) openParcels();
  if (!$('view-about').classList.contains('hide')) renderAbout();
  if (!$('batch').classList.contains('hide')) renderBatch();
  // Refresh dynamically-generated strings in an open preview so they follow the language.
  if (!$('view-app').classList.contains('hide') && !$('preview').classList.contains('hide')) { applyReviewUI(); doPreview(); }
}

// ===================== helpers =====================
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2300); }
function btnBusy(btn, on, label) {
  if (!btn) return;
  if (on) {
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    if (btn.dataset.html == null) btn.dataset.html = btn.innerHTML;
    btn.innerHTML = '<span class="spin" aria-hidden="true"></span>' + (label ? esc(label) : '<span class="sr-only">' + esc(t('loading')) + '</span>');
  } else {
    btn.disabled = false; btn.removeAttribute('aria-busy');
    if (btn.dataset.html != null) { btn.innerHTML = btn.dataset.html; delete btn.dataset.html; }
    // The language may have changed while it was busy.
    const k = btn.getAttribute('data-i18n'); if (k) btn.textContent = t(k);
  }
}
// Econt times may come as epoch seconds, epoch ms or date strings.
function toMs(v) {
  if (v == null || v === '') return null;
  let n = Number(v);
  if (!isNaN(n)) { if (!n) return null; if (n < 1e12) n *= 1000; return n; }
  const d = Date.parse(String(v).replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T'));
  return isNaN(d) ? null : d;
}
function fmtDate(v) { const ms = toMs(v); if (!ms) return ''; const d = new Date(ms); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString(LANG === 'bg' ? 'bg-BG' : 'en-GB', { day: '2-digit', month: 'short' }); }
// Review service (преглед): one setting, three states — None / Review / Review & Test.
function reviewFlags(mode) { return { payAfterAccept: mode === 'review' || mode === 'review_test', payAfterTest: mode === 'review_test' }; }
// The review mode "anchored" in settings: '' = not anchored (user picks per shipment).
// Legacy 'none'/unset both mean "not anchored" now that the no-review choice lives on the creation page.
function reviewAnchor(d) {
  if (!d) return '';
  if (d.reviewMode === 'review' || d.reviewMode === 'review_test') return d.reviewMode;
  if (d.reviewMode === 'none') return '';
  if (d.payAfterTest) return 'review_test';
  if (d.payAfterAccept) return 'review';
  return '';
}
// Segmented button group backed by a hidden input: the control reads as buttons
// while every existing `<input>.value` read keeps working unchanged.
function setSeg(segId, inputId, val) {
  const seg = $(segId), input = $(inputId);
  if (!seg || !input) return;
  input.value = val == null ? '' : val;
  seg.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.val === input.value;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}
function initSeg(segId, inputId, onChange) {
  const seg = $(segId); if (!seg) return;
  seg.querySelectorAll('button').forEach((b) => {
    b.onclick = () => { setSeg(segId, inputId, b.dataset.val); if (onChange) onChange(); };
  });
  setSeg(segId, inputId, $(inputId).value);
}

// ===================== state =====================
const SESSION = { password: null, pin: null };
let CONFIG = { mode: 'production', username: '', sender: {}, defaults: {} };

// ---------- crypto ----------
const tenc = new TextEncoder(), tdec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', tenc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptSecret(plain, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, tenc.encode(plain));
  return { salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function decryptSecret(e, pin) {
  const key = await deriveKey(pin, unb64(e.salt));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, key, unb64(e.ct));
  return tdec.decode(pt);
}

// ---------- storage ----------
const loadStore = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const saveStore = (o) => localStorage.setItem(KEY, JSON.stringify(o));
async function persist() { saveStore({ v: 1, mode: CONFIG.mode, username: CONFIG.username, enc: await encryptSecret(SESSION.password, SESSION.pin), sender: CONFIG.sender, defaults: CONFIG.defaults, pinLen: (SESSION.pin || '').length }); }
const loadParcels = () => { try { return JSON.parse(localStorage.getItem(PKEY)) || []; } catch { return []; } };
const saveParcels = (a) => localStorage.setItem(PKEY, JSON.stringify(a.slice(0, 300)));
const addParcel = (p) => { const a = loadParcels(); a.unshift(p); saveParcels(a); };

// ---------- views ----------
function show(view) {
  for (const v of ['landing', 'setup', 'lock', 'app', 'about', 'settings']) $('view-' + v).classList.toggle('hide', v !== view);
  document.querySelectorAll('.app-ctl').forEach((el) => el.classList.toggle('hide', view !== 'app'));
}
const creds = () => ({ mode: CONFIG.mode, username: CONFIG.username, password: SESSION.password });
// Official e-Econt account ("profile") URL for the active environment, so the
// user can log in and confirm the shipment really landed in their account.
const econtProfileUrl = () => (CONFIG.mode === 'production' ? 'https://ee.econt.com/' : 'https://demo.econt.com/ee/');
// Public tracking page for a shipment number (locale-aware), for seller + customer.
const econtTrackUrl = (num) => `https://www.econt.com/${LANG === 'en' ? 'en/' : ''}services/track-shipment/${encodeURIComponent(String(num))}`;
// Ready-to-send reply for the customer: number + tracking link + counter note.
// The review line is only promised when the parcel really has review/test.
function buildReply(num, info) {
  info = info || {};
  const lines = [t('reply_template', { num, url: econtTrackUrl(num) })];
  if (Number(info.cod) > 0) lines.push(t('reply_cod', { amt: Number(info.cod).toFixed(2).replace(/\.00$/, '') + ' ' + (info.currency === 'BGN' ? 'лв' : '€') }));
  if (info.reviewMode === 'review_test') lines.push(t('reply_review_test'));
  else if (info.reviewMode === 'review') lines.push(t('reply_review'));
  return lines.join('\n');
}
// Share sheet on phones (straight into Viber/Messenger), copy on desktop.
async function sendReply(num, btn, info) {
  const text = buildReply(num, info);
  if (navigator.share && window.matchMedia && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (await copyText(text)) { flashBtn(btn); $('srLive').textContent = t('reply_paste_now'); }
  else toast(t('copy_fail'));
}
// Never throws: a sleeping/restarting server (HTML 502, timeout, offline) comes
// back as { ok:false, error, transient:true } so every button shows a message
// instead of hanging. opts.retry (only for calls that are safe to repeat) keeps
// trying through a Render cold start: 2+4+8+16+30 s, about a minute in total.
// /api/create is NEVER retried: a 502 can hide a waybill that was created.
let LAST_OK = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY_WAITS = [2000, 4000, 8000, 16000, 30000];
const api = async (path, body, opts) => {
  opts = opts || {};
  for (let attempt = 0; ; attempt++) {
    let kind;
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ lang: LANG }, body || {})) });
      const txt = await res.text();
      try { const j = JSON.parse(txt); LAST_OK = Date.now(); return j; } catch { kind = 'waking'; }
    } catch { kind = navigator.onLine === false ? 'offline' : 'net'; }
    const fail = { ok: false, error: t(kind === 'waking' ? 'server_waking' : 'net_down'), transient: true };
    if (!opts.retry || kind === 'offline' || attempt >= RETRY_WAITS.length) return fail;
    if (opts.alive && !opts.alive()) return Object.assign(fail, { stale: true });
    if (opts.onWait) opts.onWait(attempt);
    // Wait in short steps so a superseded call stops at once, not after 30 s.
    for (let waited = 0; waited < RETRY_WAITS[attempt]; waited += 250) {
      await sleep(250);
      if (opts.alive && !opts.alive()) return Object.assign(fail, { stale: true });
    }
  }
};
// Fire-and-forget wake-up; carries no credentials.
const ping = () => fetch('/api/ping', { method: 'POST' }).then((r) => { if (r.ok) LAST_OK = Date.now(); }).catch(() => {});
const warm = () => { if (SESSION.password) api('/api/warm', { creds: creds() }); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden || Date.now() - LAST_OK < 10 * 60 * 1000) return;
  if (SESSION.password) warm(); else ping();
});
// Before a call that must not be retried (create), make sure the server is up.
async function ensureAwake(btn) {
  if (Date.now() - LAST_OK < 60 * 1000) return { ok: true };
  if (btn) { btnBusy(btn, false); btnBusy(btn, true, t('wake_wait')); }
  return api('/api/ping', {}, { retry: true });
}
// Clipboard that tells the truth: async API first, then the old execCommand path.
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
// Brief "Copied" state on the button itself (taps are ignored while it shows).
function flashBtn(btn) {
  if (!btn || btn.classList.contains('is-done')) return;
  const html = btn.innerHTML;
  btn.classList.add('is-done');
  btn.innerHTML = svgi('check', 'ic-s') + ' ' + esc(t('copied_btn'));
  setTimeout(() => { btn.innerHTML = html; btn.classList.remove('is-done'); }, 1400);
}
function debounce(fn, ms) { let h = 0; const d = (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(h); return d; }
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
function officeLabel(c) { return `${c.name} · ${c.address}${c.city ? ', ' + c.city : ''}${c.postCode ? ' (' + c.postCode + ')' : ''}`; }
async function fillOfficeSelect(sel, q, credsObj) {
  const seq = PARSE_SEQ, live = () => sel !== $('pOffice') || seq === PARSE_SEQ;
  sel.classList.remove('hide'); sel.innerHTML = `<option>${t('searching')}</option>`;
  const r = await api('/api/offices', { creds: credsObj, q }, { retry: true, alive: live });
  if (!live()) return false;
  if (!r.ok) { sel.innerHTML = `<option value="">${esc(r.error)}</option>`; return; }
  sel.innerHTML = '';
  for (const c of (r.candidates || [])) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o); }
  if (!sel.options.length) sel.innerHTML = `<option value="">${t('no_matches')}</option>`;
  return true;
}

// ===================== WIZARD =====================
let wizardTested = false;
const wizardCreds = () => ({ mode: $('suMode').value, username: $('suUser').value.trim(), password: $('suPass').value });
$('suTestBtn').onclick = async () => {
  const c = wizardCreds();
  if (!c.username || !c.password) { $('suTestMsg').className = 'err'; $('suTestMsg').textContent = t('need_creds'); return; }
  $('suTestMsg').className = 'muted'; $('suTestMsg').textContent = t('testing');
  const r = await api('/api/test', { creds: c });
  if (r.ok) { wizardTested = true; $('suTestMsg').className = 'good'; $('suTestMsg').textContent = t('login_ok', { n: r.officeCount }); $('suFinishBtn').disabled = false; }
  else { wizardTested = false; $('suTestMsg').className = 'err'; $('suTestMsg').textContent = '✗ ' + r.error; $('suFinishBtn').disabled = true; }
};
for (const id of ['suUser', 'suPass', 'suMode']) $(id).addEventListener('input', () => { wizardTested = false; $('suFinishBtn').disabled = true; });
$('suSenderSearchBtn').onclick = () => fillOfficeSelect($('suSenderOffice'), $('suSenderOfficeSearch').value, wizardCreds());
// First-timers without an Econt login can try the public DEMO account. This is
// the ONLY place demo exists — settings always drives toward the real account.
$('suDemoBtn').onclick = () => {
  $('suMode').value = 'demo';
  $('suUser').value = 'iasp-dev'; $('suPass').value = '1Asp-dev';
  $('suTestBtn').onclick();
};
for (const id of ['suUser', 'suPass']) $(id).addEventListener('input', () => { $('suMode').value = 'production'; });
$('suFinishBtn').onclick = async () => {
  const pin = $('suPin').value, e = $('suFinishMsg');
  if (pin.length < 4) { e.textContent = t('pin_short'); return; }
  if (pin !== $('suPin2').value) { e.textContent = t('pin_mismatch'); return; }
  if (!wizardTested) { e.textContent = t('test_first'); return; }
  const office = $('suSenderOffice').value;
  if (!$('suSenderName').value.trim() || !$('suSenderPhone').value.trim() || !office) { e.textContent = t('fill_sender'); return; }
  const c = wizardCreds();
  SESSION.password = c.password; SESSION.pin = pin;
  CONFIG = {
    mode: c.mode, username: c.username,
    sender: { name: $('suSenderName').value.trim(), phone: $('suSenderPhone').value.trim(), officeCode: office, address: null },
    defaults: { shipmentType: 'pack', packCount: 1, weight: Number($('suWeight').value) || 1, shipmentDescription: $('suDesc').value.trim(), payer: $('suPayer').value, payAfterAccept: false, payAfterTest: false, smsNotification: false, cod: { enabled: $('suCod').checked, amount: 0, currency: $('suCur').value }, countryCode: 'BGR' },
  };
  await persist(); enterApp();
};

// ===================== LOCK =====================
function showLock() { show('lock'); $('forgetConfirm').classList.add('hide'); $('lockMsg').textContent = ''; $('lockPin').value = ''; setTimeout(() => $('lockPin').focus(), 50); ping(); }
let UNLOCKING = false;
async function tryUnlock(silentOnFail) {
  if (UNLOCKING) return;
  const store = loadStore(); if (!store) return show('landing');
  UNLOCKING = true;
  try {
    SESSION.password = await decryptSecret(store.enc, $('lockPin').value); SESSION.pin = $('lockPin').value;
    CONFIG = { mode: store.mode, username: store.username, sender: store.sender, defaults: store.defaults };
    enterApp();
  } catch { if (!silentOnFail) $('lockMsg').textContent = t('wrong_pin'); }
  finally { UNLOCKING = false; }
}
const unlock = () => tryUnlock(false);
$('lockBtn').onclick = unlock;
// Auto-unlock the moment the full PIN is entered — no button click needed.
$('lockPin').addEventListener('input', () => {
  $('lockMsg').textContent = '';
  const store = loadStore(); if (!store) return;
  const len = $('lockPin').value.length, expected = store.pinLen || 0;
  if (expected) { if (len === expected) tryUnlock(false); }
  else if (len >= 4) tryUnlock(len < 6); // legacy store: only show error at the 6-char cap
});
// In-place confirm (no native dialog). Removes the login and settings only, as
// the prompt says; the parcel list stays so nothing in transit is lost.
$('forgetBtn').onclick = () => $('forgetConfirm').classList.toggle('hide');
$('forgetNo').onclick = () => $('forgetConfirm').classList.add('hide');
$('forgetYes').onclick = () => { localStorage.removeItem(KEY); location.reload(); };
$('lockNowBtn').onclick = () => { SESSION.password = null; SESSION.pin = null; showLock(); };

// ===================== APP =====================
function switchTab(which) {
  $('navNew').classList.toggle('active', which === 'new');
  $('navParcels').classList.toggle('active', which === 'parcels');
  $('navNew').setAttribute('aria-selected', String(which === 'new'));
  $('navParcels').setAttribute('aria-selected', String(which === 'parcels'));
  $('tab-new').classList.toggle('hide', which !== 'new');
  $('tab-parcels').classList.toggle('hide', which !== 'parcels');
  const ind = document.querySelector('.seg-ind');
  if (ind) ind.style.transform = which === 'parcels' ? 'translateX(calc(100% + 5px))' : 'translateX(0)';
  if (which === 'parcels') openParcels(); else stopTimers();
}
function enterApp() {
  const badge = $('modeBadge'); badge.textContent = t('badge_demo'); badge.className = 'app-ctl badge demo'; badge.style.display = CONFIG.mode === 'demo' ? '' : 'none';
  $('cfgUser').value = CONFIG.username || ''; $('cfgPass').value = '';
  $('cfgDemoNote').classList.toggle('hide', CONFIG.mode !== 'demo');
  const s = CONFIG.sender, d = CONFIG.defaults;
  $('cfgSenderName').value = s.name || ''; $('cfgSenderPhone').value = s.phone || ''; $('cfgSenderOffice').value = s.officeCode || '';
  $('cfgWeight').value = d.weight ?? 1; $('cfgDesc').value = d.shipmentDescription || '';
  $('cfgPayer').value = d.payer || 'receiver'; $('cfgCodOn').checked = !!(d.cod && d.cod.enabled);
  $('cfgCur').value = (d.cod && d.cod.currency) || 'EUR';
  $('cfgShipType').value = d.shipmentType || 'pack'; $('cfgPackCount').value = d.packCount || 1;
  $('cfgSms').checked = !!d.smsNotification;
  $('cfgDeclOn').checked = !!(d.declaredValue && d.declaredValue.enabled);
  renderPayoutSelect(PAYOUTS, (d.cod && d.cod.payOptionNum) || '');
  const ret = d.returnTo || {};
  $('cfgRetMode').value = ret.mode || '';
  $('cfgRetOfficeCode').value = ret.officeCode || '';
  const ra = ret.address || {};
  $('cfgRetCity').value = ra.city || ''; $('cfgRetPost').value = ra.postCode || '';
  $('cfgRetStreet').value = ra.street || ''; $('cfgRetNum').value = ra.num || '';
  applyRetUI();
  setSeg('cfgReviewSeg', 'cfgReviewMode', reviewAnchor(d));
  applyReviewUI();  // keep the preview's review control in sync after a settings change
  switchTab('new');
  show('app');
  warm();
  if (window.matchMedia && matchMedia('(pointer: fine)').matches && $('preview').classList.contains('hide') && $('result').classList.contains('hide')) $('msg').focus({ preventScroll: true });
}
$('navNew').onclick = () => switchTab('new');
$('navParcels').onclick = () => switchTab('parcels');
$('settingsBtn').onclick = () => { show('settings'); fetchOfficeStatus(); };
$('settingsBackBtn').onclick = () => show('app');
// Credentials being tested/saved in settings: brand-new username+password mean
// the real account (production); otherwise stay in the current mode.
function cfgCreds() {
  const fresh = $('cfgPass').value && $('cfgUser').value.trim();
  return { mode: fresh ? 'production' : CONFIG.mode, username: $('cfgUser').value.trim(), password: $('cfgPass').value || SESSION.password };
}
// Login check result is shown right under the button (not at the page bottom).
async function cfgTestLogin(btn) {
  const c = cfgCreds(), m = $('cfgTestMsg');
  if (!c.username || !c.password) { m.className = 'err'; m.textContent = t('need_creds'); return false; }
  m.className = 'muted'; m.textContent = t('testing'); btnBusy(btn, true);
  const r = await api('/api/test', { creds: c });
  btnBusy(btn, false);
  m.className = r.ok ? 'good' : 'err';
  m.textContent = r.ok ? t('login_ok', { n: r.officeCount }) : ('✗ ' + r.error);
  // A login that just passed is saved immediately, so parcels use exactly the
  // account that was checked (before, it stayed unsaved until "Запази").
  if (r.ok && (c.username !== CONFIG.username || c.password !== SESSION.password || c.mode !== CONFIG.mode)) {
    CONFIG.mode = c.mode; CONFIG.username = c.username; SESSION.password = c.password;
    await persist(); $('cfgPass').value = '';
    m.textContent += ' ' + t('login_saved');
    $('cfgDemoNote').classList.toggle('hide', CONFIG.mode !== 'demo');
  }
  return !!r.ok;
}
$('cfgTestBtn').onclick = (ev) => cfgTestLogin(ev.currentTarget);
for (const id of ['cfgUser', 'cfgPass']) $(id).addEventListener('input', () => { $('cfgTestMsg').textContent = ''; });
$('cfgSenderSearchBtn').onclick = () => fillOfficeSelect($('cfgSenderOfficeSel'), $('cfgSenderSearch').value, cfgCreds());
$('cfgSenderOfficeSel').onchange = () => { $('cfgSenderOffice').value = $('cfgSenderOfficeSel').value; };
$('refreshOfficesBtn').onclick = async (ev) => {
  btnBusy(ev.currentTarget, true); $('cfgMsg').textContent = t('refreshing');
  const r = await api('/api/offices/refresh', { creds: creds() });
  btnBusy(ev.currentTarget, false);
  $('cfgMsg').textContent = r.ok
    ? t('offices_loaded', { n: r.count }) + (r.added > 0 ? ' · ' + t('offices_added', { d: r.added }) : '')
    : (t('error_prefix') + r.error);
};
$('saveCfgBtn').onclick = async (ev) => {
  // Changed login? Prove it works before saving, so a typo can't lock the app out.
  const loginChanged = $('cfgPass').value || $('cfgUser').value.trim() !== (CONFIG.username || '');
  if (loginChanged && !(await cfgTestLogin(ev.currentTarget))) {
    $('cfgTestMsg').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  CONFIG.mode = cfgCreds().mode; CONFIG.username = $('cfgUser').value.trim();
  if ($('cfgPass').value) SESSION.password = $('cfgPass').value;
  CONFIG.sender = { name: $('cfgSenderName').value.trim(), phone: $('cfgSenderPhone').value.trim(), officeCode: $('cfgSenderOffice').value.trim(), address: CONFIG.sender.address || null };
  const rm = $('cfgReviewMode').value, rf = reviewFlags(rm);
  CONFIG.defaults = Object.assign({}, CONFIG.defaults, {
    weight: Number($('cfgWeight').value) || 1, shipmentDescription: $('cfgDesc').value.trim(), payer: $('cfgPayer').value,
    shipmentType: $('cfgShipType').value, packCount: Math.max(1, parseInt($('cfgPackCount').value, 10) || 1),
    smsNotification: $('cfgSms').checked,
    declaredValue: { enabled: $('cfgDeclOn').checked },
    returnTo: gatherReturnTo(),
    reviewMode: rm, payAfterAccept: rf.payAfterAccept, payAfterTest: rf.payAfterTest,
    cod: Object.assign({}, CONFIG.defaults.cod, { enabled: $('cfgCodOn').checked, currency: $('cfgCur').value, payOptionNum: $('cfgPayout').value || '' }),
  });
  const retWanted = $('cfgRetMode').value; // read before enterApp() re-populates the form
  await persist(); enterApp(); toast(t('saved'));
  $('cfgMsg').textContent = '';
  if (retWanted && !(CONFIG.defaults.returnTo && CONFIG.defaults.returnTo.mode)) {
    show('settings');
    $('cfgRetMode').value = retWanted; applyRetUI();
    $('cfgMsg').textContent = t('ret_incomplete');
  }
};


// ---------- COD payout agreements (Econt holds the IBAN, we only reference it) ----------
let PAYOUTS = [];
function payoutLabel(o) {
  const m = o.method === 'bank' ? t('payout_bank') : o.method === 'office' ? t('payout_office')
    : o.method === 'address' ? t('payout_address') : (o.method || '');
  return [o.num, m, o.iban, o.bic].filter(Boolean).join(' \u00b7 ');
}
function renderPayoutSelect(options, selected) {
  const sel = $('cfgPayout');
  sel.innerHTML = '';
  const def = document.createElement('option');
  def.value = ''; def.textContent = t('payout_default');
  sel.appendChild(def);
  for (const o of options) {
    const el = document.createElement('option');
    el.value = o.num; el.textContent = payoutLabel(o);
    sel.appendChild(el);
  }
  // Keep a previously saved choice selectable even before the list is fetched.
  if (selected && !options.some((o) => o.num === selected)) {
    const el = document.createElement('option');
    el.value = selected; el.textContent = selected;
    sel.appendChild(el);
  }
  sel.value = selected || '';
}
$('cfgPayoutBtn').onclick = async (ev) => {
  const btn = ev.currentTarget;
  btnBusy(btn, true);
  $('cfgPayoutMsg').textContent = t('loading');
  const r = await api('/api/payouts', { creds: cfgCreds() });
  btnBusy(btn, false);
  if (!r.ok) { $('cfgPayoutMsg').textContent = t('error_prefix') + r.error; return; }
  PAYOUTS = r.options || [];
  renderPayoutSelect(PAYOUTS, (CONFIG.defaults.cod && CONFIG.defaults.cod.payOptionNum) || '');
  const banks = PAYOUTS.filter((o) => o.method === 'bank').length;
  $('cfgPayoutMsg').textContent = PAYOUTS.length ? t('payout_found', { n: PAYOUTS.length, b: banks }) : t('payout_none');
};

// ---------- refusal-return anchor ----------
function applyRetUI() {
  const m = $('cfgRetMode').value;
  $('retOfficeBox').classList.toggle('hide', m !== 'office');
  $('retAddrBox').classList.toggle('hide', m !== 'address');
  // Sensible prefill: returning to "my office" usually means the drop-off office.
  if (m === 'office' && !$('cfgRetOfficeCode').value.trim()) $('cfgRetOfficeCode').value = $('cfgSenderOffice').value.trim();
}
$('cfgRetMode').onchange = applyRetUI;
function gatherReturnTo() {
  const mode = $('cfgRetMode').value;
  if (mode === 'office') { const oc = $('cfgRetOfficeCode').value.trim(); return oc ? { mode, officeCode: oc } : { mode: '' }; }
  if (mode === 'address') {
    const a = { city: $('cfgRetCity').value.trim(), postCode: $('cfgRetPost').value.trim(), street: $('cfgRetStreet').value.trim(), num: $('cfgRetNum').value.trim(), countryCode: 'BGR' };
    return a.city && a.street ? { mode, address: a } : { mode: '' };
  }
  return { mode: '' };
}

// ---------- office list freshness ----------
async function fetchOfficeStatus() {
  const r = await api('/api/offices/status', { creds: creds() });
  if (!r.ok) return;
  let msg = t('offices_status', { n: r.count, m: r.ageMinutes });
  if (r.added > 0) msg += ' · ' + t('offices_added', { d: r.added });
  $('cfgMsg').textContent = msg;
}

// ---------- parse / preview / create ----------
let CANDIDATES = [];
let deliverMode = 'office';   // 'office' | 'address' (door)
let PARSED_ADDR = null;       // last address parsed from a message, for the toggle
// Switch between office and address (door) delivery, showing the matching fields.
function setDeliverMode(mode, skipPreview) {
  deliverMode = mode === 'address' ? 'address' : 'office';
  const isOffice = deliverMode === 'office';
  $('officeBlock').classList.toggle('hide', !isOffice);
  $('addrBlock').classList.toggle('hide', isOffice);
  $('modeOfficeBtn').classList.toggle('active', isOffice);
  $('modeAddressBtn').classList.toggle('active', !isOffice);
  $('modeOfficeBtn').setAttribute('aria-selected', String(isOffice));
  $('modeAddressBtn').setAttribute('aria-selected', String(!isOffice));
  if (!skipPreview && !$('preview').classList.contains('hide')) doPreview();
}
// Fill the address form from a parsed address (quarter used as the street line only
// when no real street was found; otherwise it goes in the landmark note).
function fillAddress(a) {
  a = a || {};
  $('pAddrCity').value = a.city || '';
  $('pAddrPost').value = a.postCode || '';
  $('pAddrStreet').value = a.street || a.quarter || '';
  $('pAddrNum').value = a.num || '';
  $('pAddrNote').value = [(a.street && a.quarter) ? a.quarter : '', a.other].filter(Boolean).join(', ');
}
function gatherAddress() {
  return { city: $('pAddrCity').value.trim(), postCode: $('pAddrPost').value.trim(), street: $('pAddrStreet').value.trim(), num: $('pAddrNum').value.trim(), other: $('pAddrNote').value.trim(), countryCode: 'BGR' };
}
const PHONE_COUNT_RE = /(?:\+?\s?359|0)[\s\-.]?8(?:[\s\-.]?\d){8}/g;
// A newer paste supersedes an older parse that is still waiting on the server.
let PARSE_SEQ = 0, PARSE_INFLIGHT = 0;
function parseBusy(on) {
  if (on) { if (PARSE_INFLIGHT++ === 0) btnBusy($('parseBtn'), true); }
  else if (--PARSE_INFLIGHT <= 0) { PARSE_INFLIGHT = 0; btnBusy($('parseBtn'), false); }
}
// Retry options for a parse: show "waking up" instead of an error while it waits.
const parseRetry = (seq) => ({
  retry: true, alive: () => seq === PARSE_SEQ,
  onWait: () => { if (seq === PARSE_SEQ) { $('parseErr').className = 'muted'; $('parseErr').textContent = t('wake_wait'); } },
});
// Returns true only when THIS call filled the editor (or the batch), so callers
// that post-edit the result (batch Open, OCR) never touch a newer message.
async function doParse(ev, opts) {
  if (createBusy()) { toast(t('busy_wait')); return false; }
  const seq = ++PARSE_SEQ;
  $('parseErr').className = 'err'; $('parseErr').textContent = '';
  const text = $('msg').value.trim();
  if (!text) { $('parseErr').textContent = t('paste_first'); return false; }
  resetCreateGuards();
  // Several phone numbers MAY mean a batch — but only if the splitter really
  // finds 2+ parcels (an alternate number in one message is still one parcel).
  if (!(opts && opts.forceSingle) && (text.match(PHONE_COUNT_RE) || []).length >= 2) {
    const handled = await doBatchParse(text, seq);
    if (handled || seq !== PARSE_SEQ) return handled === 'applied';
  }
  $('batch').classList.add('hide');
  if (!(opts && opts.keepBatchEdit)) { BATCH_EDIT = -1; showBatchBackBtns(); }
  parseBusy(true);
  try {
    const r = await api('/api/parse', { text, creds: creds() }, parseRetry(seq));
    if (seq !== PARSE_SEQ || createBusy()) return false;
    $('parseErr').className = 'err'; $('parseErr').textContent = '';
    if (!r.ok) { $('parseErr').textContent = r.error || t('parse_failed'); return false; }
    const p = r.parsed;
    PARSED_CUR = !!(p.cod && p.cod.amount && p.cod.currency);
    $('pName').value = p.recipientName || ''; $('pPhone').value = p.phone || '';
    CANDIDATES = r.candidates || [];
    const sel = $('pOffice'); sel.innerHTML = '';
    if (r.officesError) sel.innerHTML = `<option value="">${esc(t('office_err', { err: r.officesError }))}</option>`;
    else if (!CANDIDATES.length) sel.innerHTML = `<option value="">${esc(t('no_match', { q: p.locationText }))}</option>`;
    else for (const c of CANDIDATES) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); sel.appendChild(o); }
    renderOfficeHint();
    const d = CONFIG.defaults;
    $('pWeight').value = d.weight ?? 1; $('pDesc').value = d.shipmentDescription || '';
    $('pPayer').value = d.payer || 'receiver';
    // COD: use a detected amount/currency from the message if present, else defaults.
    if (p.cod && p.cod.amount) {
      $('pCodOn').checked = true; $('pCodAmount').value = p.cod.amount;
      $('pCodCur').value = p.cod.currency || (d.cod && d.cod.currency) || 'EUR';
    } else {
      $('pCodOn').checked = !!(d.cod && d.cod.enabled); $('pCodAmount').value = (d.cod && d.cod.amount) || '';
      $('pCodCur').value = (d.cod && d.cod.currency) || 'EUR';
    }
    // Declared value: from the settings anchor; amount mirrors the COD amount.
    const declOn = !!(d.declaredValue && d.declaredValue.enabled);
    $('pDeclOn').checked = declOn;
    $('pDeclAmount').value = declOn && $('pCodAmount').value ? $('pCodAmount').value : '';
    $('pDeclAmount').dataset.auto = '1';
    $('pDeclCur').value = $('pCodCur').value;
    applyReviewUI();
    // Reset the per-shipment review each parse (never leak a prior message's choice),
    // then apply the review hint detected in THIS message, if any.
    if (!reviewAnchor(CONFIG.defaults)) setSeg('pReviewSeg', 'pReviewMode', p.reviewMode || 'none');
    // Office vs address (door) delivery: pick the detected mode and pre-fill the form.
    PARSED_ADDR = p.address || null;
    fillAddress(p.address);
    setDeliverMode(p.deliveryType === 'door' ? 'address' : 'office', true);
    $('preview').classList.remove('hide'); $('result').classList.add('hide');
    $('preview').scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
    doPreview();
    return true;
  } finally { parseBusy(false); }
}
// Show the per-shipment review selector only when settings does NOT anchor a mode.
// When anchored, hide the selector and show a small read-only note instead.
function applyReviewUI() {
  const anchor = reviewAnchor(CONFIG.defaults);
  if (anchor) {
    $('reviewRow').classList.add('hide');
    $('reviewAnchored').classList.remove('hide');
    $('reviewAnchored').textContent = t('review_from_settings', { mode: reviewLabel(anchor) });
  } else {
    $('reviewRow').classList.remove('hide');
    $('reviewAnchored').classList.add('hide');
    setSeg('pReviewSeg', 'pReviewMode', $('pReviewMode').value || 'none');
  }
}
function gatherOverrides() {
  // Anchored in settings → use it; otherwise the per-shipment choice on this page.
  const anchor = reviewAnchor(CONFIG.defaults);
  const mode = anchor || $('pReviewMode').value || 'none';
  const rf = reviewFlags(mode);
  const o = {
    recipientName: $('pName').value.trim(), phone: $('pPhone').value.trim(),
    weight: Number($('pWeight').value) || undefined, description: $('pDesc').value.trim(), payer: $('pPayer').value,
    cod: { enabled: $('pCodOn').checked, amount: Number($('pCodAmount').value) || 0, currency: $('pCodCur').value },
    declaredValue: { enabled: $('pDeclOn').checked, amount: Number($('pDeclAmount').value) || 0, currency: $('pDeclCur').value },
    payAfterAccept: rf.payAfterAccept, payAfterTest: rf.payAfterTest, reviewMode: mode,
  };
  if (deliverMode === 'address') o.address = gatherAddress();
  else o.officeCode = $('pOffice').value;
  return o;
}
const shipBody = (overrides) => ({ creds: creds(), sender: CONFIG.sender, defaults: CONFIG.defaults, overrides });
function showPrice(resp) {
  const st = resp.label || resp, total = st.totalPrice;
  const cur = st.totalPriceCurrency || st.currency || $('pCodCur').value || 'EUR';
  return total != null ? t('est_price', { v: Number(total).toFixed(2), cur }) : t('validated');
}
function currentReviewMode() { return reviewAnchor(CONFIG.defaults) || $('pReviewMode').value || 'none'; }
// One-glance confirmation chip-line so the user verifies the whole shipment in ~1s,
// plus a caution note when the parcel carries no cash-on-delivery.
// What the summary line shows, read from the editor (also captured at create time).
function summaryData() {
  const sel = $('pOffice');
  let dest = '';
  if (deliverMode === 'address') {
    const c = $('pAddrCity').value.trim(), st = [$('pAddrStreet').value.trim(), $('pAddrNum').value.trim()].filter(Boolean).join(' ');
    dest = [c, st].filter(Boolean).join(', ');
  } else {
    const opt = sel.selectedOptions[0];
    dest = opt && sel.value ? opt.textContent.split(' · ')[0] : '';
  }
  const codAmt = Number($('pCodAmount').value), declAmt = Number($('pDeclAmount').value);
  return {
    name: $('pName').value.trim(), dest,
    cod: $('pCodOn').checked && codAmt > 0 ? codAmt + ' ' + $('pCodCur').value : '',
    decl: $('pDeclOn').checked && declAmt > 0 ? declAmt + ' ' + $('pDeclCur').value : '',
    review: currentReviewMode(),
  };
}
function summaryHTML(d) {
  const parts = [], rl = reviewLabel(d.review);
  if (d.name) parts.push(`<b>${esc(d.name)}</b>`);
  if (d.dest) parts.push(`${svgi('pin', 'ic-s')} ${esc(d.dest)}`);
  if (d.cod) parts.push(`${svgi('money', 'ic-s')} ${esc(d.cod)}`);
  if (d.decl) parts.push(`${svgi('shield', 'ic-s')} ${esc(d.decl)}`);
  if (rl) parts.push(`${svgi('eye', 'ic-s')} ${esc(rl)}`);
  return parts.join('<span class="dot-sep">·</span>');
}
function updateSummary() {
  const sel = $('pOffice');
  const name = $('pName').value.trim();
  const codOn = $('pCodOn').checked, codAmt = Number($('pCodAmount').value);
  const html = summaryHTML(summaryData());
  const box = $('prevSummary');
  if (html) { box.innerHTML = html; box.classList.remove('hide'); }
  else box.classList.add('hide');
  // Warn when there is no cash-on-delivery on this parcel.
  $('codWarn').classList.toggle('hide', codOn && codAmt > 0);
  if (codOn && codAmt > 0) $('noCodConfirm').classList.add('hide');
  // BGN vs EUR: show the other currency when it differs from the usual one.
  const defCur = (CONFIG.defaults.cod && CONFIG.defaults.cod.currency) || 'EUR', cur = $('pCodCur').value, ch = $('codCurHint');
  if (codOn && codAmt > 0 && cur !== defCur) {
    ch.textContent = cur === 'BGN' ? t('cod_conv', { a: codAmt, e: (codAmt / BGN_PER_EUR).toFixed(2) }) : t('cod_conv_rev', { a: codAmt, b: (codAmt * BGN_PER_EUR).toFixed(2) });
    ch.className = 'cur-hint ' + (PARSED_CUR ? 'warn-box' : 'muted');
  } else ch.className = 'muted cur-hint hide';
  // What the parser could not read — so nothing silently stays empty.
  const gaps = [];
  if (!name) gaps.push(t('gap_name'));
  if (!$('pPhone').value.trim()) gaps.push(t('gap_phone'));
  if (deliverMode === 'address') { if (!$('pAddrCity').value.trim() || !$('pAddrStreet').value.trim()) gaps.push(t('gap_addr')); }
  else if (!sel.value) gaps.push(t('gap_office'));
  const gb = $('parseGaps');
  if (gaps.length) { gb.textContent = t('gaps_prefix') + gaps.join(', ') + t('gaps_hint'); gb.classList.remove('hide'); }
  else gb.classList.add('hide');
  // Outline exactly the fields that still need something.
  const addr = deliverMode === 'address';
  for (const [id, on] of [['pName', !name], ['pPhone', !$('pPhone').value.trim()], ['pOffice', !addr && !sel.value],
    ['pAddrCity', addr && !$('pAddrCity').value.trim()], ['pAddrStreet', addr && !$('pAddrStreet').value.trim()],
    ['pCodAmount', codOn && !(codAmt > 0)]]) $(id).classList.toggle('need', !!on);
  renderDupWarn();
}
// Coalesce bursts of input events into a single summary update per frame.
let _sumRaf = 0;
function scheduleSummary() { if (!_sumRaf) _sumRaf = requestAnimationFrame(() => { _sumRaf = 0; updateSummary(); }); }
// Confidence that the auto-picked office is right, from the match score.
function officeMatchHint() {
  if (!CANDIDATES.length || !$('pOffice').value) return '';
  const top = CANDIDATES[0].score || 0;
  const onTop = $('pOffice').value === String(CANDIDATES[0].code);
  if (onTop && top >= 12) return `<span class="match match-hi">${t('match_high')}</span>`;
  if (top >= 6) return `<span class="match match-mid">${t('match_mid')}</span>`;
  return `<span class="match match-lo">${t('match_lo')}</span>`;
}
function renderOfficeHint() {
  const hints = [];
  if (CONFIG.mode === 'demo') hints.push(t('demo_hint'));
  const mh = officeMatchHint(); if (mh) hints.push(mh);
  $('officeHint').innerHTML = hints.join(' ');
}
let PREVIEW_SEQ = 0;
async function doPreview(ev) {
  const seq = ++PREVIEW_SEQ;
  $('previewErr').textContent = '';
  updateSummary(); renderOfficeHint();
  const o = gatherOverrides();
  if (deliverMode === 'address') {
    if (!o.address.city || !o.address.street) { $('priceBox').textContent = ''; $('previewErr').textContent = t('need_addr'); return; }
  } else if (!o.officeCode) { $('priceBox').textContent = ''; $('previewErr').textContent = t('pick_office'); return; }
  const btn = ev && ev.currentTarget && ev.currentTarget.id === 'recalcBtn' ? $('recalcBtn') : null;
  btnBusy(btn, true); $('priceBox').innerHTML = '<span class="sk">price price price</span>';
  const r = await api('/api/preview', shipBody(o), {
    retry: true, alive: () => seq === PREVIEW_SEQ,
    onWait: () => { if (seq === PREVIEW_SEQ) $('priceBox').textContent = t('price_waiting'); },
  });
  btnBusy(btn, false);
  if (seq !== PREVIEW_SEQ) return;
  if (!r.ok) { $('priceBox').textContent = ''; $('previewErr').textContent = t('econt_prefix') + r.error + (r.code === 'bad_login' ? '\n' + t('fix_login_hint') : ''); return; }
  $('priceBox').innerHTML = showPrice(r.response);
}
function playCheck() {
  const old = $q('#result .check-c'); if (!old) return;
  old.replaceWith(old.cloneNode(true));
}
// Guards before a create: COD missing although it is the default, a parcel to
// the same phone in the last 72 h, or an earlier create whose outcome is unclear.
// Each needs one deliberate extra click (never a double-click or key repeat).
let NOCOD_ACK = false, DUP_ACK = '', DUP_ACK_AT = 0, PARSED_CUR = false, LAST_RESULT = null;
const BGN_PER_EUR = 1.95583;
const createBusy = () => $('createBtn').hasAttribute('aria-busy') || $('batchCreateBtn').hasAttribute('aria-busy');
function syncCreateLabel() {
  const b = $('createBtn'); if (b.hasAttribute('aria-busy')) return;
  b.textContent = DUP_ACK ? t('dup_confirm_btn') : t('create_btn');
}
function resetCreateGuards() {
  NOCOD_ACK = false; DUP_ACK = ''; DUP_ACK_AT = 0;
  $('noCodConfirm').classList.add('hide');
  syncCreateLabel();
}
const normPhone9 = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
const destKey = (o) => (o.officeCode ? String(o.officeCode) : o.address ? [o.address.city, o.address.street].filter(Boolean).join('|') : '');
const DUP_WINDOW = 72 * 3600 * 1000;
// Creates whose outcome is unknown (reply lost). Persisted so the warning
// survives edits, reloads and the batch. Cleared by a deliberate create.
const UKEY = 'econt_unsure';
function loadUnsure() { try { const now = Date.now(); return (JSON.parse(localStorage.getItem(UKEY)) || []).filter((u) => now - u.at < DUP_WINDOW); } catch { return []; } }
function saveUnsure(a) { try { localStorage.setItem(UKEY, JSON.stringify(a.slice(0, 100))); } catch {} }
function markUnsure(phone) {
  const ph = normPhone9(phone); if (!ph) return;
  const a = loadUnsure().filter((u) => !(u.phone9 === ph && u.mode === CONFIG.mode));
  a.unshift({ phone9: ph, mode: CONFIG.mode, at: Date.now() }); saveUnsure(a);
}
function clearUnsure(phone) { const ph = normPhone9(phone); if (ph) saveUnsure(loadUnsure().filter((u) => !(u.phone9 === ph && u.mode === CONFIG.mode))); }
function findUnsure(phone) { const ph = normPhone9(phone); return ph ? loadUnsure().find((u) => u.phone9 === ph && u.mode === CONFIG.mode) || null : null; }
// Newest parcel to this phone in the last 72 h (same environment, not returned).
function findDup(phone) {
  const ph = normPhone9(phone);
  if (!ph || ph === normPhone9(CONFIG.sender && CONFIG.sender.phone)) return null;
  const now = Date.now();
  return loadParcels().find((p) => p.mode === CONFIG.mode && !p.manual && p.phone9 === ph
    && now - (p.createdAt || 0) < DUP_WINDOW && !(p.snap && classify(p.snap) === 'returned')) || null;
}
function dupInfo() {
  const phone = $('pPhone').value, u = findUnsure(phone);
  if (u) return { key: 'unsure:' + u.phone9 + ':' + u.at, text: t('create_unsure'), num: '' };
  const d = findDup(phone);
  return d ? { key: d.number, text: t('dup_warn', { num: d.number, date: fmtDate(d.createdAt) }), num: d.number } : null;
}
function renderDupWarn() {
  const d = dupInfo(), box = $('dupWarn');
  if (!d) { box.classList.add('hide'); if (DUP_ACK) { DUP_ACK = ''; syncCreateLabel(); } return null; }
  $('dupMsg').textContent = d.text;
  $('dupShowBtn').classList.toggle('hide', !d.num); $('dupShowBtn').dataset.num = d.num;
  box.classList.remove('hide');
  if (DUP_ACK && DUP_ACK !== d.key) { DUP_ACK = ''; syncCreateLabel(); }
  return d;
}
// Result card extras: receipt line (from the data that was SENT, re-rendered on a
// language switch) + the exact text the customer will get.
function renderReplyPreview() {
  if (!LAST_RESULT) { $('replyPreview').classList.add('hide'); $('resultSummary').classList.add('hide'); return; }
  const sum = $('resultSummary'); sum.innerHTML = summaryHTML(LAST_RESULT.sum); sum.classList.toggle('hide', !sum.innerHTML);
  $('replyText').textContent = buildReply(LAST_RESULT.num, LAST_RESULT.info);
  $('replyPreview').classList.remove('hide');
}
// While a create is in flight (wake-up wait included) the editor is frozen, so
// what Econt receives is exactly what is on screen.
function freezeEditor(on) { $('preview').inert = on; $('preview').classList.toggle('frozen', on); }
async function doCreate() {
  if (createBusy()) return;
  $('previewErr').textContent = '';
  const o = gatherOverrides();
  if (!o.recipientName || !o.phone) { $('previewErr').textContent = t('need_recip'); return; }
  if (deliverMode === 'address' ? (!o.address.city || !o.address.street) : !o.officeCode) {
    $('previewErr').textContent = deliverMode === 'address' ? t('need_addr') : t('need_recip'); return;
  }
  if (!o.description) { $('previewErr').textContent = t('need_desc'); $('pDesc').focus(); return; }
  if (o.cod.enabled && !(o.cod.amount > 0)) { $('previewErr').textContent = t('cod_blank'); return; }
  if (CONFIG.defaults.cod && CONFIG.defaults.cod.enabled && !o.cod.enabled && !NOCOD_ACK) {
    // Focus the safe choice: a stray Enter must not confirm shipping without COD.
    $('noCodConfirm').classList.remove('hide'); $('noCodFix').focus({ preventScroll: true }); return;
  }
  const dup = renderDupWarn();
  if (dup && !(DUP_ACK === dup.key && Date.now() - DUP_ACK_AT > 700)) {
    if (DUP_ACK !== dup.key) { DUP_ACK = dup.key; DUP_ACK_AT = Date.now(); syncCreateLabel(); toast(dup.text); }
    return; // a double-click or key repeat inside 700 ms does not count as the confirm
  }
  // Everything below uses what was captured here, before any wait.
  const sum = summaryData();
  const editRow = BATCH_EDIT >= 0 ? BATCH[BATCH_EDIT] : null;
  const btn = $('createBtn');
  let created = false;
  freezeEditor(true);
  try {
    const awake = await ensureAwake(btn);
    if (!awake.ok) { $('previewErr').textContent = awake.error; return; }
    btnBusy(btn, true, t('creating'));
    schedulePreview.cancel(); PREVIEW_SEQ++;   // a late quote must not overwrite the create's messages
    const r = await api('/api/create', shipBody(o));   // never retried
    if (!r.ok) {
      if (r.transient || r.unsure) {
        // The request may have reached Econt. Make a retry a deliberate act.
        markUnsure(o.phone);
        if (editRow && !editRow.done) { editRow.unsure = true; editRow.on = false; editRow.statusTpl = { k: 'st_unsure' }; editRow.statusColor = 'var(--warn)'; }
        $('previewErr').innerHTML = esc(t('create_unsure')) + ` <a href="${esc(econtProfileUrl())}" target="_blank" rel="noopener noreferrer">${esc(t('create_unsure_link'))}</a>`;
        DUP_ACK = '';
        renderDupWarn();
        return;
      }
      $('previewErr').textContent = t('econt_prefix') + r.error + (r.code === 'bad_login' ? '\n' + t('fix_login_hint') : ''); return;
    }
    created = true;
    clearUnsure(o.phone);
    const st = r.response.label || r.response;
    const num = st.shipmentNumber || t('no_number');
    $('shipNum').textContent = num;
    const pdf = st.pdfURL;
    if (pdf) { $('pdfLink').href = pdf; $('pdfLink').style.display = ''; } else { $('pdfLink').style.display = 'none'; }
    $('profileLink').href = econtProfileUrl();
    if (st.shipmentNumber) { $('trackLink').href = econtTrackUrl(num); $('trackLink').style.display = ''; } else { $('trackLink').style.display = 'none'; }
    $('resultMeta').textContent = st.totalPrice != null ? t('price_label', { v: Number(st.totalPrice).toFixed(2), cur: st.totalPriceCurrency || o.cod.currency || 'EUR' }) : '';
    const destLabel = o.address ? [o.address.city, o.address.street, o.address.num].filter(Boolean).join(' ') : o.officeCode;
    const info = { cod: o.cod.enabled ? o.cod.amount : 0, currency: o.cod.currency, reviewMode: o.reviewMode };
    if (st.shipmentNumber) addParcel({ number: st.shipmentNumber, recipient: o.recipientName, phone: o.phone, phone9: normPhone9(o.phone), dest: destKey(o), office: destLabel, weight: o.weight, description: o.description, cod: info.cod, currency: o.cod.currency, reviewMode: o.reviewMode, createdAt: Date.now(), pdfURL: pdf, mode: CONFIG.mode });
    // Created from a batch row → mark THAT row done (captured before the wait).
    if (editRow && st.shipmentNumber) {
      editRow.done = true; editRow.on = true; editRow.unsure = false;
      editRow.statusTpl = { k: 'st_ok', p: { num: st.shipmentNumber } }; editRow.statusColor = 'var(--go-d)';
      editRow.name = o.recipientName; editRow.phone = o.phone; editRow.num = st.shipmentNumber; editRow.replyInfo = info;
    }
    LAST_RESULT = st.shipmentNumber ? { num: st.shipmentNumber, info, sum } : null;
    renderReplyPreview();
    $('replyBtn').classList.toggle('hide', !LAST_RESULT);
    showBatchBackBtns();
    $('preview').classList.add('hide'); $('result').classList.remove('hide');
    playCheck();
    $('result').scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
    $('srLive').textContent = t('created_sr', { num });
  } finally {
    freezeEditor(false);
    btnBusy(btn, false);
    if (!created) {
      syncCreateLabel();
      // A quote cancelled for the create must not leave a skeleton behind.
      if ($('priceBox').querySelector('.sk') || $('priceBox').textContent === t('price_waiting')) $('priceBox').textContent = '';
    }
  }
  if (created) { resetCreateGuards(); if (LAST_RESULT) $('replyBtn').focus({ preventScroll: true }); }
}
$('noCodGo').onclick = () => { NOCOD_ACK = true; $('noCodConfirm').classList.add('hide'); doCreate(); };
$('noCodFix').onclick = () => { $('noCodConfirm').classList.add('hide'); $('pCodOn').checked = true; $('pCodAmount').focus(); scheduleSummary(); };
$('dupShowBtn').onclick = () => {
  const num = $('dupShowBtn').dataset.num; if (!num) return;
  switchTab('parcels');
  const c = $q(`.parcel[data-num="${num}"]`);
  if (c) { c.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }); c.classList.remove('fresh'); void c.offsetWidth; c.classList.add('fresh'); }
};
$('clearBtn').onclick = () => { if (createBusy()) return; PARSE_SEQ++; resetCreateGuards(); $('parseErr').textContent = ''; $('msg').value = ''; $('preview').classList.add('hide'); $('result').classList.add('hide'); $('batch').classList.add('hide'); BATCH_EDIT = -1; showBatchBackBtns(); };
$('parseBtn').onclick = doParse;

// ---------- batch: several parcels in one paste ----------
let BATCH = [];
let BATCH_EDIT = -1; // row currently opened in the single-parcel editor
function showBatchBackBtns() {
  const show = BATCH_EDIT >= 0 && BATCH.length > 0;
  const label = show ? t('back_to_batch', { n: '#' + (BATCH_EDIT + 1) }) : '';
  for (const id of ['backToBatchBtn', 'backToBatchBtn2']) {
    const b = $(id); b.classList.toggle('hide', !show); if (show) b.textContent = label;
  }
}
// Leave the editor and land back on the batch, carrying the edits into the row.
function returnToBatch(syncFields) {
  const row = BATCH[BATCH_EDIT];
  if (row && syncFields && !row.done) {
    row.name = $('pName').value.trim();
    row.phone = $('pPhone').value.trim();
    row.cod = $('pCodAmount').value;
    row.cur = $('pCodCur').value;
    if (row.parsed.deliveryType !== 'door') {
      const sel = $('pOffice');
      if (sel.value) {
        row.officeCode = sel.value;
        if (!row.candidates.some((c) => String(c.code) === sel.value)) {
          const o = sel.selectedOptions[0];
          row.candidates.unshift({ code: sel.value, name: o ? o.textContent.split(' · ')[0] : sel.value, address: '', city: '' });
        }
      }
    }
  }
  const idx = BATCH_EDIT;
  BATCH_EDIT = -1;
  showBatchBackBtns();
  renderBatch();
  $('preview').classList.add('hide'); $('result').classList.add('hide');
  $('batch').classList.remove('hide');
  const rowEl = $q(`.brow[data-i="${idx}"]`);
  if (rowEl) rowEl.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
}
$('backToBatchBtn').onclick = () => returnToBatch(true);
$('backToBatchBtn2').onclick = () => returnToBatch(false);
// Row status: explicit run results win; otherwise what will happen on "run".
// A row with no COD while COD is the default is called out before it ships.
function batchRowStatus(row) {
  if (row.statusTpl) return { text: row.statusTpl.raw != null ? row.statusTpl.raw : t(row.statusTpl.k, row.statusTpl.p), color: row.statusColor || '', needCod: false };
  if (row.trackNum) return { text: t('st_track'), color: '', needCod: false };
  const doorOk = row.parsed.deliveryType === 'door' && row.parsed.address && row.parsed.address.city && row.parsed.address.street;
  if (!(row.officeCode || doorOk)) return { text: t('st_missing'), color: 'var(--warn)', needCod: false };
  const d = CONFIG.defaults.cod || {}, amt = Number(row.cod) || 0;
  if (d.enabled && !(amt > 0)) return { text: t('st_nocod'), color: 'var(--warn)', needCod: true };
  let text = t('st_create');
  if (amt > 0 && row.cur !== (d.currency || 'EUR')) text += ' · ≈ ' + (row.cur === 'BGN' ? (amt / BGN_PER_EUR).toFixed(2) + ' €' : (amt * BGN_PER_EUR).toFixed(2) + ' лв');
  return { text, color: '', needCod: false };
}
const batchSendBtn = () => `<button class="ghost btn-xs" data-f="send" type="button">${svgi('send', 'ic-s')} ${esc(t('parcel_reply'))}</button>`;
function syncRowStatus(i) {
  const row = BATCH[i], el = $q(`.brow[data-i="${i}"]`); if (!row || !el) return;
  const st = batchRowStatus(row), se = el.querySelector('[data-status]');
  se.textContent = st.text; se.style.color = st.color;
  const ci = el.querySelector('[data-f="cod"]'); if (ci) ci.classList.toggle('need', st.needCod);
}
function batchRowHTML(row, i) {
  const rs = batchRowStatus(row), st = rs.text;
  const officeUI = row.parsed.deliveryType === 'door' && row.parsed.address
    ? `<input data-f="addr" value="${esc(t('batch_addr_row', { a: [row.parsed.address.city, row.parsed.address.street, row.parsed.address.num].filter(Boolean).join(' ') }))}" disabled>`
    : `<select data-f="office">${row.candidates.length ? '' : `<option value="">${t('batch_no_office')}</option>`}${row.candidates.map((c) => `<option value="${esc(c.code)}">${esc(officeLabel(c))}</option>`).join('')}</select>`;
  return `<div class="brow${row.done ? ' done' : ''}" data-i="${i}">
    <div class="brow-top">
      <input type="checkbox" data-f="on" aria-label="${esc(t('row_label', { n: i + 1 }))}" ${row.on ? 'checked' : ''}>
      <span class="idx">#${i + 1}</span>
      ${row.trackNum ? `<span class="track-tag">${svgi('box', 'ic-s')} ${esc(row.trackNum)}</span>` : ''}
      <span class="brow-status" data-status${rs.color ? ` style="color:${rs.color}"` : ''}>${esc(st)}</span>
      ${row.num ? batchSendBtn() : ''}
    </div>
    <div class="brow-grid">
      <input data-f="name" data-i18n-nope value="${esc(row.name)}" placeholder="${esc(t('recipient'))}">
      <input data-f="phone" class="bamt" inputmode="tel" value="${esc(row.phone)}" placeholder="${esc(t('phone'))}">
      ${officeUI}
      <input data-f="cod" class="bamt${rs.needCod ? ' need' : ''}" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(row.cod || '')}" placeholder="${esc(t('amount'))}">
      <select data-f="cur" class="bamt"><option value="EUR"${row.cur === 'EUR' ? ' selected' : ''}>€ EUR</option><option value="BGN"${row.cur === 'BGN' ? ' selected' : ''}>лв BGN</option></select>
      <button class="ghost" data-f="edit" type="button" style="flex:0 0 auto">${t('batch_edit')}</button>
    </div>
  </div>`;
}
async function doBatchParse(text, seq) {
  parseBusy(true);
  try {
    const r = await api('/api/parse-batch', { text, creds: creds() }, parseRetry(seq));
    if (seq !== PARSE_SEQ || createBusy()) return true;
    $('parseErr').className = 'err'; $('parseErr').textContent = '';
    if (!r.ok) { $('parseErr').textContent = r.error || t('parse_failed'); return true; }
    if (!r.rows || r.rows.length < 2) return false; // one parcel → normal editor
    BATCH = (r.rows || []).map((row) => ({
      chunk: row.chunk, parsed: row.parsed, candidates: row.candidates || [], trackNum: row.trackNum || null,
      on: true,
      name: row.parsed.recipientName || '',
      phone: row.parsed.phone || '',
      officeCode: (row.candidates && row.candidates.length) ? String(row.candidates[0].code) : '',
      cod: row.parsed.cod ? row.parsed.cod.amount : '',
      cur: (row.parsed.cod && row.parsed.cod.currency) || (CONFIG.defaults.cod && CONFIG.defaults.cod.currency) || 'EUR',
      done: false,
    }));
    // Already shipped to this phone in the last 72 h → start unticked; ticking is the confirm.
    // An unclear earlier create or a recent parcel to the same phone → start
    // unticked; ticking the row is the deliberate confirm.
    for (const row of BATCH) {
      if (row.trackNum) continue;
      if (findUnsure(row.phone)) { row.on = false; row.unsure = true; row.statusTpl = { k: 'st_unsure' }; row.statusColor = 'var(--warn)'; continue; }
      const d = findDup(row.phone);
      if (d) { row.on = false; row.statusTpl = { k: 'st_dup', p: { num: d.number } }; row.statusColor = 'var(--warn)'; }
    }
    BATCH_NOCOD_OK = ''; $('batchNoCodConfirm').classList.add('hide');
    if (r.officesError) $('batchErr').textContent = t('office_err', { err: r.officesError }); else $('batchErr').textContent = '';
    BATCH_EDIT = -1; showBatchBackBtns();
    renderBatch();
    $('preview').classList.add('hide'); $('result').classList.add('hide');
    $('batch').classList.remove('hide');
    $('batch').scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
    return 'applied';
  } finally { parseBusy(false); }
}
function renderBatch() {
  const creates = BATCH.filter((r) => !r.trackNum).length;
  $('batchInfo').textContent = t('batch_found', { n: BATCH.length, c: creates, t: BATCH.length - creates });
  $('batchList').innerHTML = BATCH.map((row, i) => batchRowHTML(row, i)).join('');
  // Preselect the top office candidate in each row's select.
  $('batchList').querySelectorAll('.brow').forEach((el) => {
    const row = BATCH[Number(el.dataset.i)];
    const sel = el.querySelector('select[data-f="office"]');
    if (sel && row.officeCode) sel.value = row.officeCode;
  });
}
$('batchList').addEventListener('input', (e) => {
  const el = e.target, brow = el.closest('.brow'); if (!brow) return;
  const row = BATCH[Number(brow.dataset.i)], f = el.dataset.f;
  if (!row || !f) return;
  if (f === 'on') {
    row.on = el.checked;
    if (row.on && row.statusTpl && (row.statusTpl.k === 'st_skip' || row.unsure)) { row.unsure = false; row.statusTpl = null; row.statusColor = ''; }
  }
  else if (f === 'name') row.name = el.value;
  else if (f === 'phone') row.phone = el.value;
  else if (f === 'office') row.officeCode = el.value;
  else if (f === 'cod') row.cod = el.value;
  else if (f === 'cur') row.cur = el.value;
  if (f === 'on' || f === 'office' || f === 'cod' || f === 'cur') syncRowStatus(Number(brow.dataset.i));
});
$('batchList').addEventListener('click', async (e) => {
  const sb = e.target.closest('button[data-f="send"]');
  if (sb) { const r = BATCH[Number(sb.closest('.brow').dataset.i)]; if (r && r.num) sendReply(r.num, sb, r.replyInfo); return; }
  const btn = e.target.closest('button[data-f="edit"]'); if (!btn || createBusy()) return;
  const i = Number(btn.closest('.brow').dataset.i);
  const row = BATCH[i];
  $('msg').value = row.chunk;
  $('batch').classList.add('hide');
  BATCH_EDIT = i;
  if (!(await doParse(null, { forceSingle: true, keepBatchEdit: true }))) return;
  // The row's fields may have been edited in the table — they win over a re-parse.
  if (row.name) $('pName').value = row.name;
  if (row.phone) $('pPhone').value = row.phone;
  if (row.cod) { $('pCodOn').checked = true; $('pCodAmount').value = row.cod; $('pCodCur').value = row.cur; }
  if (row.parsed.deliveryType !== 'door' && row.officeCode) {
    const sel = $('pOffice');
    if (![...sel.options].some((o) => o.value === String(row.officeCode))) {
      const c = row.candidates.find((x) => String(x.code) === String(row.officeCode));
      const o = document.createElement('option');
      o.value = String(row.officeCode); o.textContent = c ? officeLabel(c) : String(row.officeCode);
      sel.insertBefore(o, sel.firstChild);
    }
    sel.value = String(row.officeCode);
  }
  showBatchBackBtns();
  updateSummary();
  doPreview();
});
function batchOverrides(row) {
  const d = CONFIG.defaults;
  const mode = reviewAnchor(d) || row.parsed.reviewMode || 'none';
  const rf = reviewFlags(mode);
  const amt = Number(row.cod) || 0;
  const o = {
    recipientName: row.name.trim(), phone: row.phone.trim(),
    weight: d.weight, description: d.shipmentDescription, payer: d.payer || 'receiver',
    cod: { enabled: amt > 0, amount: amt, currency: row.cur },
    declaredValue: (d.declaredValue && d.declaredValue.enabled && amt > 0) ? { enabled: true, amount: amt, currency: row.cur } : { enabled: false },
    payAfterAccept: rf.payAfterAccept, payAfterTest: rf.payAfterTest, reviewMode: mode,
  };
  if (row.parsed.deliveryType === 'door' && row.parsed.address) o.address = Object.assign({ countryCode: 'BGR' }, row.parsed.address);
  else o.officeCode = row.officeCode;
  return o;
}
$('batchCancelBtn').onclick = () => $('batch').classList.add('hide');
// "Yes, ship without COD" covers exactly the rows it named, for one run only.
let BATCH_NOCOD_OK = '', BATCH_NOCOD_IDX = [];
const batchNoCodIdx = (rows) => rows.map((r, i) => (r.on && !r.done && !r.trackNum && !(Number(r.cod) > 0) ? i : -1)).filter((i) => i >= 0);
function renderBatchNoCodMsg() { $('batchNoCodMsg').textContent = t('batch_nocod', { rows: BATCH_NOCOD_IDX.map((i) => '#' + (i + 1)).join(', ') }); }
$('batchNoCodGo').onclick = () => { BATCH_NOCOD_OK = BATCH_NOCOD_IDX.join(','); $('batchNoCodConfirm').classList.add('hide'); $('batchCreateBtn').onclick(); };
$('batchNoCodFix').onclick = () => {
  $('batchNoCodConfirm').classList.add('hide');
  const i = batchNoCodIdx(BATCH)[0];
  const el = i != null && $q(`.brow[data-i="${i}"] [data-f="cod"]`); if (el) el.focus();
};
// Re-render one row from its state (survives a language switch mid-run).
function repaintRow(i) {
  const el = $q(`.brow[data-i="${i}"]`), row = BATCH[i]; if (!el || !row) return;
  el.outerHTML = batchRowHTML(row, i);
  const sel = $q(`.brow[data-i="${i}"] select[data-f="office"]`); if (sel && row.officeCode) sel.value = row.officeCode;
}
$('batchCreateBtn').onclick = async () => {
  if (createBusy()) return;
  $('batchErr').textContent = '';
  const rows = BATCH; // snapshot BEFORE any wait: a paste meanwhile must never be acted upon
  // Creating without a contents description fails at Econt for every row — stop early.
  if (!(CONFIG.defaults.shipmentDescription || '').trim() && rows.some((r) => r.on && !r.trackNum && !r.done)) {
    $('batchErr').textContent = t('need_desc'); return;
  }
  // COD is the default but some ticked rows have no amount: ask, never ship silently.
  if (CONFIG.defaults.cod && CONFIG.defaults.cod.enabled) {
    const idx = batchNoCodIdx(rows);
    if (idx.length && idx.join(',') !== BATCH_NOCOD_OK) {
      BATCH_NOCOD_IDX = idx; renderBatchNoCodMsg();
      $('batchNoCodConfirm').classList.remove('hide'); $('batchNoCodFix').focus({ preventScroll: true });
      return;
    }
  }
  $('batchNoCodConfirm').classList.add('hide');
  const btn = $('batchCreateBtn');
  btnBusy(btn, true, t('creating'));
  $('parseBtn').disabled = true; $('clearBtn').disabled = true; $('batchList').inert = true;
  let ok = 0, fail = 0, skip = 0;
  try {
    const awake = await ensureAwake(btn);
    if (!awake.ok) { $('batchErr').textContent = awake.error; return; }
    if (BATCH !== rows || $('batch').classList.contains('hide')) return;
    btnBusy(btn, false); btnBusy(btn, true, t('creating'));
    for (let i = 0; i < rows.length; i++) {
      if (BATCH !== rows) break; // the batch was replaced mid-run — stop cleanly
      const row = rows[i]; if (row.done) continue;
      // Stored as a template so a language switch re-renders it correctly.
      const set = (k, p, color) => { row.statusTpl = typeof k === 'object' ? k : { k, p }; row.statusColor = color || ''; if (BATCH === rows) repaintRow(i); };
      if (!row.on) { skip++; set('st_skip'); continue; }
      if (row.trackNum) {
        if (!loadParcels().some((x) => x.number === row.trackNum)) {
          addParcel({ number: row.trackNum, recipient: row.name.trim(), office: row.officeCode || '', cod: Number(row.cod) || 0, currency: row.cur, createdAt: Date.now(), mode: CONFIG.mode, manual: true });
        }
        row.done = true; ok++; set('st_tracked', null, 'var(--go-d)');
        continue;
      }
      const o = batchOverrides(row);
      const destOk = o.officeCode || (o.address && o.address.city && o.address.street);
      if (!o.recipientName || !o.phone || !destOk) { fail++; set('st_missing', null, 'var(--warn)'); continue; }
      set('st_creating');
      const r = await api('/api/create', shipBody(o));   // never retried
      const st = r.ok ? (r.response.label || r.response) : null;
      if (r.ok && st && st.shipmentNumber) {
        const info = { cod: o.cod.enabled ? o.cod.amount : 0, currency: o.cod.currency, reviewMode: o.reviewMode };
        addParcel({ number: st.shipmentNumber, recipient: o.recipientName, phone: o.phone, phone9: normPhone9(o.phone), dest: destKey(o), office: o.officeCode || (o.address && o.address.city) || '', weight: o.weight, description: o.description, cod: info.cod, currency: o.cod.currency, reviewMode: o.reviewMode, createdAt: Date.now(), pdfURL: st.pdfURL, mode: CONFIG.mode });
        clearUnsure(o.phone);
        row.done = true; row.num = st.shipmentNumber; row.replyInfo = info; ok++; set('st_ok', { num: st.shipmentNumber }, 'var(--go-d)');
      } else if (r.transient || r.unsure) {
        // Unknown outcome: untick and remember, so neither a re-run nor the editor
        // can silently create a second waybill.
        markUnsure(o.phone);
        fail++; row.unsure = true; row.on = false; set('st_unsure', null, 'var(--warn)');
      } else {
        fail++; set({ raw: '✗ ' + ((r && r.error) || 'error').slice(0, 120) }, null, 'var(--warn)');
      }
    }
    if (BATCH === rows) $('batchInfo').textContent = t('batch_done', { ok, fail, skip });
  } finally {
    btnBusy(btn, false); $('parseBtn').disabled = false; $('clearBtn').disabled = false; $('batchList').inert = false;
    BATCH_NOCOD_OK = ''; // consent was for this run only
  }
};

// ---------- screenshot → text (client-side OCR, nothing leaves the device) ----------
let _tessLoad = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (_tessLoad) return _tessLoad;
  _tessLoad = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => { _tessLoad = null; reject(new Error('ocr-load-failed')); };
    document.head.appendChild(s);
  });
  return _tessLoad;
}
// Isolate the customer's message from a full-chat screenshot: start at the greeting
// so the listing header/price above it (a false COD) is excluded from parsing.
function isolateMessage(text) {
  const m = String(text).match(/(здравей\S*|здрасти|привет|добър\s+ден|добро\s+утро|\bhello\b|\bhi\b)/i);
  return m ? text.slice(m.index) : text;
}
// Best-effort listing description: the longest multi-word line before the greeting,
// trimmed at a dash/comma and stripped of a trailing price.
function guessDescription(text) {
  const stop = /здравей|привет|\bhello\b|\bhi\b/i;
  let best = '';
  for (const raw of String(text).split(/\n+/)) {
    const line = raw.trim();
    if (stop.test(line)) break;
    if (line.split(/\s+/).length < 2) continue;
    if (line.length > best.length) best = line;
  }
  if (!best) return '';
  let d = best.split(/[—–,|]/)[0].trim();
  d = d.replace(/\s*\d+[.,]?\d*\s*(лв\.?|bgn|eur|€)\b.*$/i, '').trim();
  return d.slice(0, 40);
}
// Upscale small screenshots and boost contrast before OCR — the single biggest
// accuracy lever for phone-chat screenshots; huge photos are downscaled so the
// recogniser stays fast.
async function preprocessImage(file) {
  try {
    const img = await createImageBitmap(file);
    const scale = img.width < 1000 ? Math.min(2.5, 1280 / img.width) : img.width > 2200 ? 1800 / img.width : 1;
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h), px = d.data;
    let min = 255, max = 0;
    for (let i = 0; i < px.length; i += 4) {
      const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      px[i] = px[i + 1] = px[i + 2] = g;
      if (g < min) min = g; if (g > max) max = g;
    }
    const range = Math.max(40, max - min);
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((px[i] - min) * 255 / range) | 0));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    return await new Promise((res) => canvas.toBlob((b) => res(b || file), 'image/png'));
  } catch (e) { return file; }
}
// OCR loves turning digits into lookalike letters; inside long digit runs the
// intent is unambiguous, so map О/O→0, l/I/|→1 there (phones, waybills).
function fixDigitRuns(text) {
  return String(text).replace(/[\d OoОоlI|]{8,}/g, (run) => {
    const digits = (run.match(/\d/g) || []).length;
    if (digits < 5) return run;
    return run.replace(/[OoОо]/g, '0').replace(/[lI|]/g, '1');
  });
}
async function runOCRFiles(files) {
  const imgs = [...files].filter((f) => f && /^image\//.test(f.type || ''));
  if (!imgs.length) return;
  const box = $('ocrBox'), msgEl = $('ocrMsg');
  $('parseErr').textContent = '';
  box.classList.remove('hide'); msgEl.textContent = t('ocr_loading');
  try {
    const T = await loadTesseract();
    const texts = [];
    for (let i = 0; i < imgs.length; i++) {
      const pre = await preprocessImage(imgs[i]);
      const tag = imgs.length > 1 ? `(${i + 1}/${imgs.length}) ` : '';
      const { data } = await T.recognize(pre, 'bul+eng', {
        logger: (m) => { if (m && m.status === 'recognizing text') msgEl.textContent = tag + t('ocr_reading', { p: Math.round((m.progress || 0) * 100) }); },
      });
      const txt = ((data && data.text) || '').replace(/[ \t]+\n/g, '\n').trim();
      if (txt) texts.push(fixDigitRuns(txt));
    }
    box.classList.add('hide');
    if (!texts.length) { $('parseErr').textContent = t('ocr_empty'); return; }
    if (texts.length > 1) {
      // Several screenshots = a batch; keep block boundaries for the splitter.
      $('msg').value = texts.join('\n\n');
      await doParse();
      return;
    }
    const text = texts[0];
    const desc = guessDescription(text);
    $('msg').value = isolateMessage(text);
    const applied = await doParse();
    // The product from the screenshot is the most relevant description for this parcel.
    if (applied && desc && !$('preview').classList.contains('hide')) { $('pDesc').value = desc; doPreview(); }
  } catch (e) {
    box.classList.add('hide');
    $('parseErr').textContent = t('ocr_fail');
  }
}
const runOCR = (file) => runOCRFiles(file ? [file] : []);
(function initOCRInputs() {
  const drop = $('imgDrop'), input = $('imgInput');
  if (!drop || !input) return;
  // Warm the OCR engine on first intent so the download overlaps the user picking a file.
  const warmOCR = () => { loadTesseract().catch(() => {}); };
  drop.addEventListener('pointerenter', warmOCR, { once: true });
  drop.addEventListener('dragenter', warmOCR, { once: true });
  $('attachBtn').addEventListener('click', warmOCR);
  $('attachBtn').onclick = () => input.click();
  input.onchange = () => { if (input.files && input.files.length) runOCRFiles(input.files); input.value = ''; };
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); const fl = e.dataTransfer && e.dataTransfer.files; if (fl && fl.length) runOCRFiles(fl); });
  // Paste a screenshot anywhere while the New tab is open.
  document.addEventListener('paste', (e) => {
    if ($('view-app').classList.contains('hide') || $('tab-new').classList.contains('hide')) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const fls = [];
    for (const it of items) { if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) fls.push(f); } }
    if (fls.length) { e.preventDefault(); runOCRFiles(fls); return; }
    // Text pasted anywhere outside a field (Ctrl/Cmd+V right after opening the
    // app) goes straight into the composer and is read at once.
    const tg = e.target;
    if (tg && tg.closest && tg.closest('input, textarea, select, [contenteditable]')) return;
    // Never replace an open preview or batch (edits would be lost) or race a create.
    if (createBusy() || !$('preview').classList.contains('hide') || !$('batch').classList.contains('hide')) return;
    const txt = e.clipboardData && e.clipboardData.getData('text');
    if (!txt || !txt.trim()) return;
    e.preventDefault();
    $('msg').value = txt;
    doParse();
  });
  // Paste button: images go to OCR, text to the parser. Hidden where unsupported.
  const pb = $('pasteBtn');
  if (navigator.clipboard && navigator.clipboard.readText) pb.classList.remove('hide');
  pb.onclick = async () => {
    if (createBusy()) { toast(t('busy_wait')); return; }
    $('parseErr').className = 'err'; $('parseErr').textContent = '';
    try {
      if (navigator.clipboard.read) {
        let items = null;
        try { items = await navigator.clipboard.read(); } catch (e) { if (e && e.name === 'NotAllowedError') throw e; }
        if (items) {
          const files = [];
          for (const it of items) {
            const ty = (it.types || []).find((x) => x.startsWith('image/'));
            if (ty) files.push(new File([await it.getType(ty)], 'clip.' + (ty.split('/')[1] || 'png'), { type: ty }));
          }
          if (files.length) { warmOCR(); runOCRFiles(files); return; }
        }
      }
      const txt = await navigator.clipboard.readText();
      if (!txt || !txt.trim()) { toast(t('clip_empty')); return; }
      $('msg').value = txt;
      doParse();
    } catch { $('parseErr').textContent = t('clip_denied'); }
  };
})();
$('recalcBtn').onclick = doPreview;
initSeg('pReviewSeg', 'pReviewMode', doPreview);
initSeg('cfgReviewSeg', 'cfgReviewMode');
$('createBtn').onclick = doCreate;
$('officeSearchBtn').onclick = async () => { if (await fillOfficeSelect($('pOffice'), $('officeSearch').value, creds())) doPreview(); };
$('pOffice').onchange = () => doPreview();
$('copyBtn').onclick = async (e) => {
  const btn = e.currentTarget;
  if (await copyText($('shipNum').textContent.trim())) { flashBtn(btn); return; }
  // Copy blocked (some in-app browsers): select the number so a long-press copies it.
  const r = document.createRange(); r.selectNodeContents($('shipNum'));
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  toast(t('copy_fail'));
};
$('replyBtn').onclick = (e) => { if (LAST_RESULT) sendReply(LAST_RESULT.num, e.currentTarget, LAST_RESULT.info); };
// The reply preview copies on tap/Enter (always copy, even on phones).
async function copyReplyPreview() {
  if (!LAST_RESULT) return;
  const box = $('replyPreview');
  if (box.classList.contains('is-done')) return;
  if (await copyText(buildReply(LAST_RESULT.num, LAST_RESULT.info))) {
    box.classList.add('is-done'); $('srLive').textContent = t('reply_paste_now');
    const lbl = box.querySelector('.reply-prev-copy'), html = lbl.innerHTML;
    lbl.innerHTML = svgi('check', 'ic-s') + ' ' + esc(t('copied_btn'));
    setTimeout(() => { lbl.innerHTML = html; box.classList.remove('is-done'); }, 1400);
  } else toast(t('copy_fail'));
}
$('replyPreview').onclick = copyReplyPreview;
$('replyPreview').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyReplyPreview(); } });
$('newBtn').onclick = () => { $('msg').value = ''; $('result').classList.add('hide'); $('preview').classList.add('hide'); BATCH_EDIT = -1; showBatchBackBtns(); $('msg').focus(); };
// Instant: pasting the message auto-parses (no extra click). Live summary follows edits.
$('msg').addEventListener('paste', () => setTimeout(() => { if ($('msg').value.trim()) doParse(); }, 60));
['pName', 'pPhone', 'pCodOn', 'pCodAmount', 'pCodCur', 'pDeclOn', 'pDeclAmount', 'pDeclCur', 'pAddrCity', 'pAddrStreet', 'pAddrNum'].forEach((id) => $(id).addEventListener('input', scheduleSummary));
// Live price: anything that changes Econt's price re-quotes after a short pause.
const schedulePreview = debounce(() => {
  if ($('preview').classList.contains('hide')) return;
  if (createBusy()) { schedulePreview(); return; }
  doPreview();
}, 700);
['pCodAmount', 'pCodCur', 'pWeight', 'pDeclAmount', 'pDeclCur', 'pAddrCity', 'pAddrStreet', 'pAddrNum'].forEach((id) => $(id).addEventListener('input', schedulePreview));
['pPayer', 'pCodOn'].forEach((id) => $(id).addEventListener('change', schedulePreview));
// A changed COD answer means the "ship without COD?" question must be asked again.
['pCodOn', 'pCodAmount'].forEach((id) => $(id).addEventListener('input', () => { NOCOD_ACK = false; }));
$('pDeclOn').addEventListener('change', () => { if ($('pDeclOn').checked && !$('pDeclAmount').value && $('pCodAmount').value) { $('pDeclAmount').value = $('pCodAmount').value; $('pDeclAmount').dataset.auto = '1'; } doPreview(); });
// A COD amount typed after parsing keeps the declared value in sync until the
// user edits the declared amount themselves.
$('pDeclAmount').addEventListener('input', () => { delete $('pDeclAmount').dataset.auto; });
$('pCodAmount').addEventListener('input', () => {
  const da = $('pDeclAmount');
  if ($('pDeclOn').checked && (da.dataset.auto === '1' || !da.value)) { da.value = $('pCodAmount').value; da.dataset.auto = '1'; }
});
// Office ↔ address delivery toggle. When switching to address with empty fields,
// pre-fill from the last parsed address.
$('modeOfficeBtn').onclick = () => setDeliverMode('office');
$('modeAddressBtn').onclick = () => { if (!$('pAddrCity').value.trim() && PARSED_ADDR) fillAddress(PARSED_ADDR); setDeliverMode('address'); };

// ---------- parcels (live status + operation timer) ----------
function fmtDateTime(v) { const ms = toMs(v); if (!ms) return ''; const d = new Date(ms); if (isNaN(d.getTime())) return ''; return d.toLocaleString(LANG === 'bg' ? 'bg-BG' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function fmtDuration(ms) {
  if (!(ms > 0)) ms = 0;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), p2 = (x) => String(x).padStart(2, '0');
  return (d > 0 ? d + t('dd') + ' ' : '') + p2(Math.floor(s % 86400 / 3600)) + ':' + p2(Math.floor(s % 3600 / 60)) + ':' + p2(s % 60);
}
// Operation state: timer runs in transit, stops on delivered or returned.
function classify(p) {
  const txt = ((p.status || '') + ' ' + (p.statusEn || '')).toLowerCase();
  if (/върнат|върната|return|отказан|refus|reject/.test(txt)) return 'returned';
  if (p.deliveryTime || /достав|получена|получен|delivered/.test(txt)) return 'delivered';
  if (p.sendTime) return 'transit';
  return 'created';
}
function statusClass(p) { const st = classify(p); return st === 'returned' ? 's-red' : st === 'delivered' ? 's-green' : st === 'transit' ? 's-blue' : 's-gray'; }
// Econt status text in the UI language when Econt sends an English variant.
const statusText = (p) => ((LANG === 'en' && p.statusEn) ? p.statusEn : p.status) || '';
// Three-segment progress: created, on the way, finished (green) / returned (amber).
function trackAttrs(snap) {
  if (!snap) return 'data-step="0"';
  const st = classify(snap);
  return st === 'returned' ? 'data-step="3" data-ret' : 'data-step="' + (st === 'delivered' ? 3 : st === 'transit' ? 2 : 1) + '"';
}
function metaText(snap) {
  if (!snap || !snap.expectedDeliveryDate) return '';
  const st = classify(snap); if (st === 'delivered' || st === 'returned') return '';
  const d = fmtDate(snap.expectedDeliveryDate);
  return d ? esc(t('exp_delivery') + ': ' + d) : '';
}
function collectedPill(snap) {
  const n = snap && Number(snap.cdCollected);
  return n > 0 ? `<span class="statusb s-green" data-coll>${svgi('money', 'ic-s')} ${esc(t('collected'))}: ${n.toFixed(2)} ${esc(snap.cdCurrency || '')}</span>` : '';
}

const TICK = {}; let TIMER_INT = null, TICK_N = 0;
// Each entry caches its .clk node — one DOM write per tick, no per-second selector scans.
function startTimers() {
  stopTimers();
  TIMER_INT = setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    for (const num in TICK) { const tk = TICK[num]; if (tk && tk.el && tk.el.isConnected) tk.el.textContent = fmtDuration(now - tk.start); }
    if (++TICK_N % 30 === 0) renderUpdated();
  }, 1000);
}
function stopTimers() { if (TIMER_INT) { clearInterval(TIMER_INT); TIMER_INT = null; } }
function renderTimer(num, p) {
  const cell = $q(`.parcel[data-num="${num}"] [data-timer]`); if (!cell) return;
  const st = classify(p), sent = toMs(p.sendTime); delete TICK[num];
  if (st === 'delivered') { const dt = toMs(p.deliveryTime); cell.className = 'parcel-timer t-green'; cell.innerHTML = svgi('check', 'ic-s') + ' ' + esc(t('delivered_ok')) + (sent && dt ? ' <span class="clk">· ' + fmtDuration(dt - sent) + '</span>' : ''); }
  else if (st === 'returned') { const dt = toMs(p.deliveryTime) || Date.now(); cell.className = 'parcel-timer t-amber'; cell.innerHTML = svgi('undo', 'ic-s') + ' ' + esc(t('returned_ok')) + (sent ? ' <span class="clk">· ' + fmtDuration(dt - sent) + '</span>' : ''); }
  else if (st === 'transit' && sent) { cell.className = 'parcel-timer t-blue'; cell.innerHTML = svgi('clock', 'ic-s') + ' ' + esc(t('in_operation')) + ' <span class="clk">' + fmtDuration(Date.now() - sent) + '</span>'; TICK[num] = { start: sent, el: cell.querySelector('.clk') }; }
  else { cell.className = 'parcel-timer t-muted'; cell.innerHTML = svgi('box', 'ic-s') + ' ' + esc(t('awaiting_dispatch')); }
}

function reviewLabel(mode) { return mode === 'review_test' ? t('review_test') : mode === 'review' ? t('review_only') : null; }
function detailRows(p, local) {
  const rows = []; const add = (k, v) => { if (v != null && v !== '') rows.push([k, v]); };
  add(t('d_status'), statusText(p));
  add(t('d_recipient'), p.recipient); add(t('d_phone'), p.recipientPhone);
  add(t('d_office'), p.office || p.receiverAddress); add(t('d_storage'), p.storageOffice);
  add(t('d_sender'), p.sender); add(t('d_sender_office'), p.senderOffice);
  add(t('d_type'), p.type); add(t('d_packs'), p.packCount);
  add(t('d_weight'), p.weight != null ? p.weight + ' ' + t('kg') : null); add(t('d_contents'), p.description);
  add(t('d_review'), reviewLabel(local && local.reviewMode));
  add(t('d_sent'), p.sendTime ? fmtDateTime(p.sendTime) : null);
  add(t('d_expected'), p.expectedDeliveryDate ? fmtDate(p.expectedDeliveryDate) : null);
  add(t('d_delivered'), p.deliveryTime ? fmtDateTime(p.deliveryTime) : null);
  add(t('d_attempts'), p.deliveryAttempts);
  add(t('d_cod'), p.cdCollected ? Number(p.cdCollected).toFixed(2) + ' ' + (p.cdCurrency || '') : null);
  add(t('d_price'), p.totalPrice != null ? Number(p.totalPrice).toFixed(2) + ' ' + (p.currency || '') : null);
  add(t('d_routing'), p.routingCode);
  return rows;
}
// A card paints instantly from the last saved snapshot; live data replaces it.
function parcelCardHTML(p) {
  const other = p.mode !== CONFIG.mode;
  const snap = !other && p.snap ? p.snap : null;
  const pill = other ? `<span class="statusb s-gray" data-status>${esc(t('other_env'))}</span>`
    : snap ? `<span class="statusb ${statusClass(snap)}" data-status>${esc(statusText(snap) || t('status_transit'))}</span>`
    : `<span class="statusb sk" data-status>${esc(t('loading'))}</span>`;
  return `<div class="parcel" data-num="${esc(p.number)}">
    <div class="parcel-top"><span class="parcel-num">${esc(p.number)}</span><span class="parcel-pills" data-pills>${collectedPill(snap)}${pill}</span></div>
    <div class="ptrack" data-track ${trackAttrs(snap)} aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="parcel-sub" data-sub>${esc(p.recipient || '')}${p.office ? ' · ' + esc(p.office) : ''}</div>
    <div class="parcel-meta" data-meta>${metaText(snap)}</div>
    <div class="parcel-timer t-muted" data-timer></div>
    <div class="parcel-row">
      <button data-copy>${svgi('copy', 'ic-s')} ${esc(t('copy'))}</button>
      <button data-reply>${svgi('send', 'ic-s')} ${esc(t('parcel_reply'))}</button>
      <a class="btnlink" href="${esc(econtTrackUrl(p.number))}" target="_blank" rel="noopener">${svgi('search', 'ic-s')} ${esc(t('track_link'))}</a>
      <a class="btnlink" data-pdf ${p.pdfURL ? `href="${esc(p.pdfURL)}"` : 'hidden'} target="_blank" rel="noopener">${svgi('printer', 'ic-s')} ${esc(t('reprint'))}</a>
      <button class="ghost" data-toggle aria-expanded="false">${esc(t('details'))}</button>
      <button class="ghost" data-del aria-label="${esc(t('del_aria'))}">${svgi('trash', 'ic-s')}</button>
    </div>
    <div class="warn-box confirmrow hide" data-confirm role="alertdialog">
      <span>${esc(t('del_confirm'))}</span>
      <button class="ghost btn-xs" data-yes>${esc(t('yes'))}</button>
      <button class="ghost btn-xs" data-no>${esc(t('no'))}</button>
    </div>
    <div class="details hide" data-details><div class="muted"${other ? '' : ' data-loading'}>${esc(other ? t('other_env') : t('loading'))}</div></div>
  </div>`;
}
function updateParcelCard(p, local) {
  const c = $q(`.parcel[data-num="${p.number}"]`); if (!c) return;
  local = local || {};
  const s = c.querySelector('[data-status]');
  s.className = 'statusb ' + (p.error ? 's-gray' : statusClass(p));
  s.textContent = p.error ? t('no_status') : (statusText(p) || t('status_transit'));
  const old = c.querySelector('[data-coll]'); if (old) old.remove();
  if (!p.error) s.insertAdjacentHTML('beforebegin', collectedPill(p));
  const tr = c.querySelector('[data-track]');
  tr.removeAttribute('data-ret'); tr.setAttribute('data-step', '0');
  if (!p.error) { const st = classify(p); tr.setAttribute('data-step', st === 'delivered' || st === 'returned' ? '3' : st === 'transit' ? '2' : '1'); if (st === 'returned') tr.setAttribute('data-ret', ''); }
  c.querySelector('[data-meta]').innerHTML = p.error ? '' : metaText(p);
  if (p.recipient || p.office) c.querySelector('[data-sub]').textContent = (p.recipient || '') + (p.office ? ' · ' + p.office : '');
  const pdf = p.pdfURL || local.pdfURL, a = c.querySelector('[data-pdf]');
  if (pdf) { a.href = pdf; a.hidden = false; } else { a.hidden = true; }
  if (p.error) { const cell = c.querySelector('[data-timer]'); delete TICK[p.number]; cell.className = 'parcel-timer t-muted'; cell.textContent = ''; }
  else renderTimer(p.number, p);
  const det = c.querySelector('[data-details]');
  let html = detailRows(p, local).map(([k, v]) => `<div class="drow"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
  if (p.events && p.events.length) {
    // Newest first when every event has a time; otherwise keep Econt's order.
    const evs = p.events.map((ev) => ({ ev, ms: toMs(ev.time) }));
    if (evs.every((x) => x.ms)) evs.sort((x, y) => y.ms - x.ms);
    html += `<div class="events"><div class="events-h">${esc(t('track_events'))}</div>` + evs.map(({ ev }) => `<div class="event"><span class="dot"></span><span>${[esc(fmtDateTime(ev.time)), esc(ev.office), esc(ev.text)].filter(Boolean).join(' · ')}</span></div>`).join('') + '</div>';
  }
  det.innerHTML = html || `<div class="muted">${esc(t('no_status'))}</div>`;
}
// Cards still waiting for a status after a refresh: stop the shimmer, say so.
function markUnknown(nums) {
  const list = loadParcels();
  for (const n of nums) {
    const c = $q(`.parcel[data-num="${n}"]`); if (!c) continue;
    const s = c.querySelector('.statusb.sk');
    if (s) { s.className = 'statusb s-gray'; s.textContent = t('no_status'); }
    const det = c.querySelector('[data-details]');
    if (!det.querySelector('[data-loading]')) continue;
    const lp = list.find((x) => x.number === n) || {};
    const rows = lp.snap ? detailRows(Object.assign({ recipient: lp.recipient, description: lp.description, weight: lp.weight }, lp.snap), lp) : [];
    det.innerHTML = rows.length ? rows.map(([k, v]) => `<div class="drow"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('') : `<div class="muted">${esc(t('no_status'))}</div>`;
  }
}
// "Updated 3 min ago" from the newest snapshot of the current environment.
function renderUpdated(list) {
  const el = $('parcelsUpdated'); if (!el || el.dataset.failed) return;
  list = list || loadParcels();
  const at = Math.max(0, ...list.filter((p) => p.mode === CONFIG.mode && p.snapAt).map((p) => p.snapAt));
  if (!at) { el.textContent = ''; return; }
  const m = Math.floor((Date.now() - at) / 60000);
  el.textContent = m < 1 ? t('upd_now') : m < 60 ? t('upd_min', { m }) : t('upd_hours', { h: Math.floor(m / 60) });
}
function syncParcelsChrome(n) {
  $('clearParcelsBtn').classList.toggle('hide', !n);
  if (!n) { $('clearAllConfirm').classList.add('hide'); $('parcelsUpdated').textContent = ''; }
}
function renderParcelsEmpty() {
  $('parcelList').innerHTML = `<div class="card empty">${svgi('box', 'ic-xl')}<b>${esc(t('parcels_empty_t'))}</b><div class="muted">${esc(t('parcels_empty_s'))}</div><button class="primary" type="button" data-go-new>${esc(t('parcels_empty_cta'))}</button></div>`;
}
async function openParcels() {
  const list = loadParcels(), box = $('parcelList');
  syncParcelsChrome(list.length);
  delete $('parcelsUpdated').dataset.failed;
  for (const k in TICK) delete TICK[k];
  if (!list.length) { renderParcelsEmpty(); stopTimers(); return; }
  box.innerHTML = list.map(parcelCardHTML).join('');
  for (const p of list) if (p.snap && p.mode === CONFIG.mode) renderTimer(p.number, p.snap);
  renderUpdated(list);
  startTimers();
  await refreshParcels();
}
// One delegated listener for every card action (cards are re-rendered often).
$('parcelList').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-go-new')) { switchTab('new'); $('msg').focus(); return; }
  const card = b.closest('.parcel'); if (!card) return;
  const num = card.getAttribute('data-num');
  if (b.hasAttribute('data-copy')) copyText(num).then((ok) => (ok ? flashBtn(b) : toast(t('copy_fail'))));
  else if (b.hasAttribute('data-reply')) sendReply(num, b, loadParcels().find((x) => x.number === num));
  else if (b.hasAttribute('data-del')) card.querySelector('[data-confirm]').classList.toggle('hide');
  else if (b.hasAttribute('data-yes')) removeParcel(num);
  else if (b.hasAttribute('data-no')) b.closest('[data-confirm]').classList.add('hide');
  else if (b.hasAttribute('data-toggle')) {
    const det = card.querySelector('[data-details]');
    const open = !det.classList.toggle('hide');
    b.textContent = open ? t('hide_details') : t('details');
    b.setAttribute('aria-expanded', String(open));
  }
});
// Live status for the current environment. Saves a small snapshot per parcel so
// the next visit paints instantly. onlyNums = refresh just those (a new card).
async function refreshParcels(onlyNums) {
  const nums = onlyNums || loadParcels().filter((p) => p.mode === CONFIG.mode).map((p) => p.number);
  if (!nums.length) return;
  const btn = $('refreshParcelsBtn'); if (!onlyNums) btnBusy(btn, true);
  const upd = $('parcelsUpdated');
  try {
    const r = await api('/api/track', { creds: creds(), shipmentNumbers: nums }, { retry: true, alive: () => !$('tab-parcels').classList.contains('hide') });
    if (!r.ok) {
      if (r.stale) return;
      upd.dataset.failed = '1';
      upd.textContent = t('upd_failed') + (r.transient ? '' : ' (' + r.error + ')');
      markUnknown(nums);
      return;
    }
    delete upd.dataset.failed;
    const list = loadParcels(), map = new Map(list.map((x) => [x.number, x])), got = new Set();
    for (const p of (r.parcels || [])) {
      if (!p.number) continue;
      got.add(p.number);
      const lp = map.get(p.number);
      if (!p.error && lp && lp.mode === CONFIG.mode) {
        lp.snap = { status: p.status, statusEn: p.statusEn, sendTime: p.sendTime, deliveryTime: p.deliveryTime, expectedDeliveryDate: p.expectedDeliveryDate, cdCollected: p.cdCollected, cdCurrency: p.cdCurrency };
        lp.snapAt = Date.now();
      }
      updateParcelCard(p, lp);
    }
    saveParcels(list);
    markUnknown(nums.filter((n) => !got.has(n)));
    renderUpdated(list);
  } finally { if (!onlyNums) btnBusy(btn, false); }
}
// Remove in place: the card folds away, focus moves to the next card.
function removeParcel(num) {
  saveParcels(loadParcels().filter((x) => x.number !== num));
  delete TICK[num];
  toast(t('removed'));
  const left = loadParcels().length;
  const card = $q(`.parcel[data-num="${num}"]`);
  if (!card) { openParcels(); return; }
  const next = card.nextElementSibling || card.previousElementSibling;
  card.style.height = card.offsetHeight + 'px';
  void card.offsetHeight; // commit the start height so the collapse animates
  card.classList.add('leaving');
  let done = false;
  const finish = () => { if (done) return; done = true; card.remove(); if (!left) { renderParcelsEmpty(); syncParcelsChrome(0); } };
  card.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 350);
  const f = left && next && next.classList.contains('parcel') ? next.querySelector('[data-del]') : $('trackNumInput');
  if (f) f.focus({ preventScroll: true });
}
$('refreshParcelsBtn').onclick = () => refreshParcels();
$('clearParcelsBtn').onclick = () => $('clearAllConfirm').classList.toggle('hide');
$('clearAllNo').onclick = () => $('clearAllConfirm').classList.add('hide');
$('clearAllYes').onclick = () => {
  saveParcels([]);
  for (const k in TICK) delete TICK[k];
  stopTimers();
  renderParcelsEmpty(); syncParcelsChrome(0);
  toast(t('removed'));
};
$('trackNumBtn').onclick = () => {
  const v = ($('trackNumInput').value || '').replace(/\D/g, '');
  if (v.length < 8) { toast(t('invalid_number')); return; }
  if (loadParcels().some((p) => p.number === v)) { toast(t('already_added')); $('trackNumInput').value = ''; return; }
  const p = { number: v, recipient: '', office: '', createdAt: Date.now(), mode: CONFIG.mode, manual: true };
  addParcel(p);
  $('trackNumInput').value = '';
  const box = $('parcelList');
  if (!box.querySelector('.parcel')) box.innerHTML = '';
  box.insertAdjacentHTML('afterbegin', parcelCardHTML(p));
  box.firstElementChild.classList.add('fresh');
  syncParcelsChrome(loadParcels().length);
  if (!TIMER_INT) startTimers();
  refreshParcels([v]);
};

// ---------- about / credits page ----------
const fbUrl = (v) => (/^https?:/i.test(v) ? v : 'https://facebook.com/' + v);
function renderAbout() {
  const name = CREATOR.name || 'Econt Shipper';
  $('creatorName').textContent = name;
  $('creatorAvatar').textContent = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const s = [];
  if (CREATOR.instagram) s.push(`<a class="social" target="_blank" rel="noopener noreferrer" href="https://instagram.com/${esc(CREATOR.instagram)}">${svgi('instagram', 'ic-s')} Instagram</a>`);
  if (CREATOR.facebook) s.push(`<a class="social" target="_blank" rel="noopener noreferrer" href="${esc(fbUrl(CREATOR.facebook))}">${svgi('facebook', 'ic-s')} Facebook</a>`);
  if (CREATOR.email) s.push(`<a class="social" href="mailto:${esc(CREATOR.email)}">${svgi('mail', 'ic-s')} ${esc(CREATOR.email)}</a>`);
  $('socialRow').innerHTML = s.join('');
  $('copyLine').textContent = `© ${new Date().getFullYear()} ${name} · ${t('rights')}`;
}
let PREV_VIEW = 'landing';
function openAbout() {
  for (const v of ['landing', 'setup', 'lock', 'app', 'settings']) if (!$('view-' + v).classList.contains('hide')) PREV_VIEW = v;
  renderAbout(); show('about');
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
}
$('footerAbout').onclick = (e) => { e.preventDefault(); openAbout(); };
$('aboutBack').onclick = () => show(PREV_VIEW);

// ---------- profile dropdown (econt.com / e-Econt) ----------
function setProfileDD(open) {
  const dd = $('profileDD');
  dd.classList.toggle('open', open);
  $('profileBtn').setAttribute('aria-expanded', String(open));
  // Anchor the menu to whichever side keeps it inside the viewport.
  if (open) {
    dd.classList.remove('flip');
    if (dd.querySelector('.dd-menu').getBoundingClientRect().right > window.innerWidth - 8) dd.classList.add('flip');
  }
}
$('profileBtn').onclick = (e) => { e.stopPropagation(); setProfileDD(!$('profileDD').classList.contains('open')); };
document.querySelectorAll('#profileDD .dd-menu a').forEach((a) => a.addEventListener('click', () => setProfileDD(false)));
document.addEventListener('click', (e) => { const dd = $('profileDD'); if (dd && !dd.contains(e.target)) setProfileDD(false); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('profileDD').classList.contains('open')) { setProfileDD(false); $('profileBtn').focus(); }
});

// ---------- landing / language / enter-key ----------
// ---------- theme (light / dark) ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('themeBtn').innerHTML = svgi(theme === 'dark' ? 'sun' : 'moon');
  syncThemeBtnLabel();
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = theme === 'dark' ? '#080c12' : '#0a4ea8';
}
function initTheme() {
  let th = localStorage.getItem('econt_theme');
  if (!th) th = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  applyTheme(th);
}
$('themeBtn').onclick = () => { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; localStorage.setItem('econt_theme', next); applyTheme(next); };

$('langBg').onclick = () => setLang('bg');
$('langEn').onclick = () => setLang('en');
$('getStartedBtn').onclick = () => { if (SESSION.password) show('app'); else if (loadStore()) showLock(); else show('setup'); };
$('infoBtn').onclick = () => show('landing');
$('brandHome').onclick = (e) => { e.preventDefault(); show('landing'); };
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (el && el.id === 'msg') { if (e.ctrlKey || e.metaKey) { e.preventDefault(); $('parseBtn').click(); } return; }
  if ((e.ctrlKey || e.metaKey) && !$('view-app').classList.contains('hide') && !$('tab-new').classList.contains('hide')
    && !$('preview').classList.contains('hide') && $('batch').classList.contains('hide') && ($('preview').contains(el) || el === document.body)) {
    e.preventDefault(); if (e.repeat) return;
    const b = $('createBtn'); if (!b.disabled && b.offsetParent !== null) b.click(); return;
  }
  if (el && el.tagName === 'INPUT' && el.dataset.enter) { e.preventDefault(); const b = $(el.dataset.enter); if (b && !b.disabled) b.click(); }
});

// ---------- boot ----------
// a11y: associate every bare <label> with the field it describes.
document.querySelectorAll('label:not([for])').forEach((l) => {
  if (l.querySelector('input,select,textarea')) return; // wrapping label: already associated
  const CTL = 'input:not([hidden]):not([type=hidden]),select,textarea';
  let ctl = l.nextElementSibling;
  if (ctl && !ctl.matches(CTL)) ctl = ctl.querySelector(CTL);
  if (!ctl && l.parentElement) ctl = l.parentElement.querySelector(CTL);
  if (ctl && ctl.id) l.setAttribute('for', ctl.id);
});
applyLang();
initTheme();
if (!('crypto' in window) || !crypto.subtle) {
  document.body.innerHTML = '<div style="padding:24px">Приложението изисква защитена връзка (https), за да шифрова PIN кода. Отворете го през https или http://localhost.<br><br>This app needs a secure connection (https) to encrypt your PIN. Open it via the https link or http://localhost.</div>';
} else if (loadStore()) { showLock(); } else { show('landing'); }

// ---------- 3D pointer tilt on showcase cards (desktop, fine pointer only) ----------
// rAF-coalesced (trackpads fire 120+ events/frame) with the rect cached per card —
// re-reading it after our own transform write both thrashes layout and skews the pivot.
(function initTilt() {
  if (!window.matchMedia) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let active = null, rect = null, raf = 0, lastEv = null;
  const reset = () => { if (active) active.style.transform = ''; active = null; rect = null; lastEv = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  const apply = () => {
    raf = 0;
    const e = lastEv; if (!e) return;
    const card = e.target.closest ? e.target.closest('.tilt') : null;
    if (active && active !== card) reset();
    if (!card || card.classList.contains('hide')) return;
    if (card !== active || !rect) { active = card; rect = card.getBoundingClientRect(); }
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const m = 5;
    card.style.transform = `perspective(1000px) rotateY(${(x * m).toFixed(2)}deg) rotateX(${(-y * m).toFixed(2)}deg) translateY(-4px)`;
  };
  document.addEventListener('pointermove', (e) => { lastEv = e; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
  window.addEventListener('scroll', () => { rect = null; }, { passive: true });
  window.addEventListener('resize', () => { rect = null; });
  document.addEventListener('pointerleave', reset, true);
  window.addEventListener('blur', reset);
})();
