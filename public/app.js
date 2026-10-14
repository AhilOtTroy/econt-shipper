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
    page_title: 'Econt Shipper: от текст до пратка', parse_failed: 'Не успях да разчета съобщението.',
    land_title: 'От текст до пратка.',
    land_sub: 'Поставяш съобщението на клиента, проверяваш името, офиса и сумата, и товарителницата е готова в твоя Еконт профил. Без преписване и без да отваряш сайта на Еконт.',
    land_cta: 'Свържи профила си в Еконт', land_cta_open: 'Отвори приложението',
    land_cta_note: 'Трябват ти потребителското име и паролата за Еконт. Остават само на това устройство, заключени с PIN. Нямаш профил в Еконт? Можеш да пробваш с демо профил.',
    demo_h: 'Пример с едно съобщение', demo_gloss: '',
    demo_c1: 'Постави съобщението', demo_c2: 'Провери и създай товарителницата', demo_c3: 'Прати отговора',
    demo_map: 'Всяка номерирана част от съобщението попълва реда със същия номер.',
    wb_title: 'Товарителница', wb_rcpt: 'Получател', wb_phone: 'Телефон', wb_office: 'До офис', wb_cod: 'Наложен платеж', wb_cod_v: '45 €',
    wb_review: 'Преглед', wb_review_v: 'Да, преди плащане', wb_parcel: 'Пратка', wb_parcel_v: 'колет, 1 кг, плаща получателят',
    wb_from_settings: 'Теглото и кой плаща идват от настройките ти.', demo_out_meta: 'изпратено 14:34',
    land_more_h: 'Какво още прави',
    land_spec1_t: 'Текст или снимка', land_spec1_d: 'Копираш съобщението от OLX, Viber, Instagram или Facebook, или пускаш скрийншот.',
    land_spec2_t: 'Много поръчки наведнъж', land_spec2_d: 'Поставяш всички съобщения в едно поле. Всяко става отделна товарителница.',
    land_spec3_t: 'Пази те от грешки', land_spec3_d: 'Пита те, ако липсва сумата за наложения платеж или ако на същия телефон вече има пратка.',
    land_spec4_t: 'Безплатно', land_spec4_d: 'Плащаш само на Еконт за пратките, както винаги.',
    land_need: 'Настройката отнема около минута: PIN, вход в Еконт и офисът, от който пращаш.',
    // setup
    setup_title: 'Бърза настройка', setup_sub: 'Прави се веднъж. Всичко, което въведеш, остава на това устройство, заключено с PIN.',
    setup_s1: 'Избери PIN', setup_s1_sub: 'Заключва приложението и криптира паролата ти за Еконт на това устройство.',
    setup_pin: 'PIN (4 до 6 цифри)', setup_pin2: 'Повтори PIN', setup_s2: 'Твоят профил в Еконт',
    setup_user: 'Потребителско име', setup_pass: 'Парола', setup_test: 'Проверка на входа',
    setup_user_hint: 'Пиши потребителското име точно, с главните и малките букви.',
    setup_demo_try: 'Нямаш профил? Пробвай с демо профила',
    setup_s3: 'Подател', setup_s3_sub: 'Както ще пише на товарителницата.', setup_yourname: 'Име', setup_yourphone: 'Телефон', setup_youroffice: 'Офис, от който пращаш',
    setup_search_office: 'град или име на офис', find: 'Намери',
    setup_s4: 'Обичайна пратка', setup_s4_sub: 'Тези стойности влизат във всяка нова пратка. Можеш да ги смениш за отделна пратка.',
    weight: 'Тегло (кг)', contents: 'Съдържание', contents_ph: 'напр. дрехи', who_pays: 'Кой плаща доставката',
    receiver_pays: 'Получателят', i_pay: 'Аз', setup_cod: 'Обикновено пращам с наложен платеж (сумата се пише за всяка пратка)',
    cod_currency: 'Валута на наложения платеж', setup_finish: 'Завърши настройката',
    // lock
    lock_title: 'Въведи PIN', lock_sub: 'Входът ти за Еконт е заключен на това устройство.', unlock: 'Отключи', forget: 'Изтрий от това устройство и започни наново',
    nav_new: 'Нова пратка', nav_parcels: 'Пратки',
    // settings
    settings_h: 'Настройки',
    set_account: 'Профил в Еконт', set_account_d: 'Потребителското име и паролата ти за Еконт. Паролата остава на това устройство, криптирана с PIN.',
    username: 'Потребителско име', pass_saved_ph: 'запазена', pass_keep: 'Парола',
    pass_keep_hint: 'Паролата е запазена. Попълни я само ако искаш да я смениш.',
    set_sender: 'Подател', set_sender_d: 'Както ще пише на товарителницата и откъде пращаш.',
    name: 'Име', phone: 'Телефон', set_office_code: 'Офис, от който пращаш', office_code_ph: 'код', search: 'друг офис: град или име',
    set_return: 'Връщане при отказ',
    set_defaults: 'Обичайна пратка', set_defaults_d: 'Тези стойности влизат във всяка нова пратка. Можеш да ги смениш за отделна пратка.',
    receiver: 'Получателят', sender: 'Подателят',
    set_cod: 'Наложен платеж', set_cod_d: 'Валута, сметка за изплащане и обявена стойност.',
    set_cod_default: 'Включвай наложен платеж във всяка нова пратка',
    set_shiptype: 'Тип пратка', shiptype_pack: 'Колет', shiptype_doc: 'Документи', set_packcount: 'Брой пакети',
    set_extra: 'Преглед и SMS', set_extra_d: 'Важи за всяка пратка.',
    set_sms: 'SMS до получателя за всяка пратка', cod_warn: 'Тази пратка е без наложен платеж.',
    offices_status: '{n} активни офиса, списъкът е обновен преди {m} мин.', offices_status_now: '{n} активни офиса, списъкът е обновен току-що.',
    offices_status_h: '{n} активни офиса, списъкът е обновен преди {h} ч.', offices_added: 'Нови офиси: {d}.',
    gaps_prefix: 'Не разчетох: ', gap_name: 'име', gap_phone: 'телефон', gap_office: 'офис', gap_addr: 'адрес', gaps_hint: '. Попълни ги ръчно.',
    decl: 'Обявена стойност', decl_default: 'Обявявай стойност, равна на наложения платеж',
    sec_recipient: 'Получател', sec_delivery: 'Доставка', sec_parcel: 'Пратка', sec_pay: 'Плащане',
    ret_label: 'Ако получателят откаже пратката, къде да се върне', ret_default: 'Както е настроено в Еконт', ret_office: 'В офис (въведи код)', ret_address: 'На адрес', ret_office_ph: 'код на офис, напр. 9049',
    // batch
    batch_h: 'Няколко пратки наведнъж', batch_found: '{n} пратки: {c} за създаване, {t} за проследяване.', batch_found_c: '{n} пратки за създаване.',
    batch_create: 'Създай избраните', batch_cancel: 'Затвори', batch_run: 'Създавам {i} от {n}…',
    batch_edit: 'Отвори', batch_no_office: 'избери офис', batch_addr_row: 'до адрес: {a}',
    st_create: 'нова пратка', st_create_cod: 'нова пратка, наложен платеж {amt}', st_create_conv: 'нова пратка, наложен платеж {amt}, около {v}', st_pick: 'няколко офиса пасват, избери един', st_badamt: 'сумата не е число, поправи я', st_baddecl: 'обявената стойност липсва или не е число, отвори реда', st_nocontact: 'липсва име или телефон', st_track: 'има товарителница, ще се проследява', st_missing: 'липсва офис', st_creating: 'създавам…', st_ok: 'създадена: {num}', st_ok_norev: 'създадена: {num}, Еконт не добави преглед', st_tracked: 'добавена за проследяване', st_skip: 'пропусната',
    batch_done: 'Готово. {parts}.',
    bd_ok1: 'създадена е 1 товарителница', bd_ok: 'създадени са {n} товарителници', bd_tr1: '1 номер е добавен за проследяване', bd_tr: '{n} номера са добавени за проследяване',
    bd_fail1: '1 ред е с грешка', bd_fail: '{n} реда са с грешка', bd_skip1: '1 ред е пропуснат', bd_skip: '{n} реда са пропуснати', bd_wait1: '1 ред чака избор на офис', bd_wait: '{n} реда чакат избор на офис',
    row_label: 'Ред {n}', row_one: 'ред {n}', row_many: 'редове {list}', list_and: ' и ',
    ret_incomplete: 'Връщането при отказ не е запазено. Попълни код на офис или адрес.',
    back_to_batch: 'Обратно към списъка (ред {n})',
    payout_label: 'Изплащане на наложения платеж', payout_default: 'Както е зададено в Еконт', payout_load: 'Зареди сметките от Еконт',
    payout_bank: 'банков превод', payout_office: 'в офис', payout_address: 'на адрес',
    payout_hint: 'Парите се превеждат по сметката от избраното споразумение с Еконт.',
    payout_found: 'Намерих {n} споразумения ({b} банкови). Избери по кое да получаваш парите.',
    payout_none: 'В профила ти няма споразумения за изплащане. За да получаваш по банков път, подпиши споразумение с Еконт.',
    refresh_offices: 'Обнови списъка с офиси', save: 'Запази',
    // composer / preview
    paste_label: 'Съобщението на клиента', paste_ph: 'Моля да ги изпратите в Офис на еконт: …  Име - 08xx xxx xxx',
    comp_hint: 'Постави текст или снимка от чата, или ги пусни тук.', a11y_attach: 'Прикачи снимка',
    ocr_loading: 'Подготвям четеца…', ocr_reading: 'Чета снимката… {p}%', ocr_empty: 'Не открих текст в снимката. Опитай с по-ясна снимка.', ocr_fail: 'Не успях да прочета снимката. Постави текста ръчно.',
    clear: 'Изчисти', preview: 'Разчети', prev_h: 'Провери пратката', recipient: 'Име',
    to_office: 'До офис', to_address: 'До адрес', office_lbl: 'Офис на Еконт',
    addr_city: 'Град', addr_post: 'Пощенски код', addr_street: 'Улица или квартал', addr_num: 'Номер', addr_note: 'Ориентир (по избор)', need_addr: 'За доставка до адрес трябват град и улица или квартал.',
    wrong_office: 'друг офис: търси по град или име', search_btn: 'Търси', description: 'Съдържание', pays: 'Кой плаща доставката',
    cod: 'Наложен платеж', amount: 'сума', recalc: 'Изчисли цената отново', create_btn: 'Създай товарителница',
    // the created waybill
    res_h: 'Товарителницата е създадена', copy: 'Копирай номера', label_pdf: 'Етикет PDF', view_in_profile: 'Виж в профила', new: 'Нова пратка',
    res_for: 'Създадена за {name}', res_created: 'Създадена',
    sum_for: 'За {name}', sum_office: 'офис {o}', sum_addr: 'до адрес {a}', sum_cod: 'наложен\u00A0платеж\u00A0{amt}', sum_nocod: 'без наложен платеж',
    sum_decl: 'обявена стойност\u00A0{amt}', sum_review: 'с преглед', sum_review_test: 'с преглед и тест', sum_price: 'Цена\u00A0{v}.',
    today_one: 'Днес: 1 пратка', today_many: 'Днес: {n} пратки', today_cod: '{amt} наложен платеж', today_and: ' и ',
    dd_site: 'econt.com', dd_site_sub: 'Официалният сайт на Еконт', dd_profile: 'e-Econt профил', dd_profile_sub: 'Пратките в твоя профил',
    reply_copy: 'Натисни, за да копираш', track_link: 'Проследи',
    reply_template: 'Готово! Пратката е подадена.\nТоварителница: {num}\nПроследяване: {url}',
    match_high: 'сигурно съвпадение', match_mid: 'вероятно съвпадение', match_lo: 'провери офиса',
    // parcels
    parcels_h: 'Твоите пратки', parcels_refresh: 'Обнови статуса',
    clear_all: 'Изчисти всички', clear_confirm: 'Да премахна ли всички пратки от списъка? В Еконт те остават.', del_confirm: 'Да премахна ли пратката от списъка? В Еконт тя остава.', clear_yes: 'Да, премахни всички', del_yes: 'Да, премахни', forget_yes: 'Да, изтрий', no: 'Не', removed: 'Премахната от списъка', del_link: 'Премахни от списъка',
    exp_delivery: 'Очаквана доставка', collected: 'Събрани {amt}',
    track_events: 'Проследяване', reprint: 'Етикет PDF', need_desc: 'Попълни съдържание. Еконт го изисква за колети.',
    loading: 'Зареждане…', no_status: 'Няма статус', other_env: 'От друг Еконт профил', kg: 'кг',
    review_only: 'Преглед', review_test: 'Преглед и тест', review_none: 'Без преглед',
    review_setting: 'Преглед преди плащане', review_unanchored: 'Избирам за всяка пратка', review_always: 'Винаги с преглед', review_test_always: 'Винаги с преглед и тест',
    review_label: 'Преглед преди плащане',
    review_set_review: 'Всяка пратка е с преглед преди плащане. Сменя се в Настройки.', review_set_test: 'Всяка пратка е с преглед и тест преди плащане. Сменя се в Настройки.',
    track_ph: 'Номер на товарителница', track_add: 'Добави', already_added: 'Тази пратка вече е в списъка', invalid_number: 'Това не прилича на номер на товарителница',
    details: 'Детайли', delivered_ok: 'Доставена', returned_ok: 'Върната към подателя', in_operation: 'В движение от {d}', delivered_in: 'Доставена за {d}', returned_in: 'Върната към подателя след {d}', awaiting_dispatch: 'Очаква изпращане', cancelled_ok: 'Анулирана', dur_sent: 'изпратена преди {d}', dur_in: 'за {d}', dur_after: 'след {d}',
    dur_min: '{n}\u00A0мин', dur_h: '{n}\u00A0ч', dur_d1: '1\u00A0ден', dur_d: '{n}\u00A0дни', dur_join: ' и ',
    d_status: 'Статус', d_sender: 'Подател', d_recipient: 'Получател', d_phone: 'Телефон', d_office: 'Офис на получателя', d_sender_office: 'Офис на подателя', d_storage: 'Съхранява се в', d_type: 'Тип', d_packs: 'Брой', d_weight: 'Тегло', d_contents: 'Съдържание', d_review: 'Преглед', d_sent: 'Изпратена', d_expected: 'Очаквана доставка', d_delivered: 'Доставена на', d_cod: 'Наложен платеж', d_price: 'Цена', d_attempts: 'Опити за доставка', d_routing: 'Маршрут',
    testing: 'Проверявам…', login_saved: 'Запазено.', fix_login_hint: 'Отвори Настройки (зъбното колело горе) и натисни „Проверка на входа“ с паролата си за e-econt.com.', server_waking: 'Сървърът се събужда. Изчакай 30 секунди и опитай пак.', net_down: 'Няма връзка с интернет.', login_ok: 'Входът работи. Налични са {n} офиса.', need_creds: 'Първо въведи потребителско име и парола.',
    pin_short: 'PIN трябва да е поне 4 цифри.', pin_mismatch: 'Двата PIN-а не съвпадат.', test_first: 'Първо провери входа за Еконт (стъпка 2).',
    fill_sender: 'Попълни име, телефон и офис, от който пращаш (стъпка 3).',
    paste_first: 'Първо постави съобщение.', pick_office: 'Избери офис.', need_recip: 'Трябват име, телефон и офис.',
    cod_blank: 'Наложеният платеж е включен, но сумата липсва или не е число. Въведи сума или го изключи.',
    decl_blank: 'Обявената стойност е включена, но сумата липсва или не е число. Въведи сума или я изключи.',
    review_ignored_prev: 'Еконт не предлага преглед за тази доставка, затова пратката ще е без преглед.',
    review_ignored_res: 'Еконт не добави преглед към пратката, затова отговорът до клиента не го обещава.',
    ocr_stale: 'Докато четях снимката, съобщението или пратката се промениха, затова текстът от снимката не е използван.',
    a11y_cod_amount: 'Сума на наложения платеж', a11y_decl_amount: 'Сума на обявената стойност', a11y_decl_cur: 'Валута на обявената стойност',
    saved: 'Запазено', creating: 'Създавам…', validated: 'Еконт прие данните',
    est_price: 'Очаквана цена <span class="price">{v}</span>',
    no_match: 'Няма офис за „{q}“. Потърси по-долу.', office_err: 'Списъкът с офиси не се зареди: {err}',
    demo_hint: 'Демо списък с офиси (около 585). Въведи своя вход в Настройки, за да минеш на истинския профил.',
    wrong_pin: 'Грешен PIN.', forget_confirm: 'Да премахна ли запазения вход за Еконт и настройките от това устройство? Пратките в списъка остават.',
    refreshing: 'Обновявам…', offices_loaded: 'Заредени са {n} офиса.', searching: 'търся…', no_matches: 'няма резултати',
    no_number: '(Еконт не върна номер)', econt_prefix: 'Еконт: ', error_prefix: 'Грешка: ',
    // about
    about_sub: 'Прави товарителница в твоя Еконт профил от съобщението на клиента, без преписване.',
    about_creator_h: 'Създател', about_creator_role: 'Идея, дизайн и разработка',
    about_back: 'Назад', footer_about: 'За приложението и контакти', rights: 'Всички права запазени.',
    a11y_theme_dark: 'Превключи към тъмна тема', a11y_theme_light: 'Превключи към светла тема',
    a11y_info: 'За приложението', a11y_settings: 'Настройки', a11y_lock: 'Заключи', a11y_home: 'Начало',
    // wake-up / retry / unsure create
    wake_wait: 'Сървърът се събужда, още няколко секунди…', price_waiting: 'Цената идва след малко, сървърът се събужда.',
    create_unsure: 'Не стана ясно дали товарителницата е създадена. Провери в e-Econt профила, преди да опиташ пак.', create_unsure_link: 'Отвори e-Econt',
    st_unsure: 'неясно, провери в e-Econt', badge_demo: 'Демо', demo_note: 'Работиш с демо профила. Въведи своето потребителско име и парола за Еконт и натисни „Запази“, за да минеш на истинския си профил.',
    busy_wait: 'Изчакай, създавам пратка…',
    parse_again: 'Докато създавах пратката, не прочетох новото съобщение. Натисни „Разчети“ отново.',
    batch_nocod_list: 'Без наложен платеж: {rows}.', batch_repeat_list: 'Вече изпратени или с неясен резултат: {rows}.',
    batch_confirm_q: 'Да продължа ли?', batch_go: 'Да, продължи', batch_check: 'Ще проверя',
    // paste / live price / keyboard
    a11y_paste: 'Постави от клипборда', clip_denied: 'Нямам достъп до клипборда. Постави текста в полето.', clip_empty: 'Клипбордът е празен.',
    create_hint: '{k}+Enter създава товарителницата',
    // telling the customer
    send_customer: 'Прати на клиента', parcel_reply: 'Прати на клиента', reply_prev_h: 'Това получава клиентът',
    reply_paste_now: 'Отговорът е копиран, постави го в чата.', copied_btn: 'Копирано',
    copy_fail: 'Не успях да копирам. Задръж пръст върху текста и го копирай.', created_sr: 'Товарителницата е създадена. Номер {num}.',
    reply_review: 'На гише отваряш, проверяваш и плащаш само ако всичко е наред.',
    reply_review_test: 'На гише отваряш, проверяваш и тестваш, и плащаш само ако всичко е наред.',
    reply_cod: 'Наложен платеж: {amt}.',
    // COD guard
    st_nocod: 'без наложен платеж',
    nocod_confirm: 'Тази пратка тръгва без наложен платеж. Да продължа ли?', nocod_go: 'Да, без наложен платеж', nocod_fix: 'Ще добавя сума',
    cod_conv: '{a} лв са около {e}. Провери в каква валута е цената в обявата.',
    cod_conv_rev: '{a} € са около {b}. Провери в каква валута е цената в обявата.',
    // duplicate guard
    dup_warn: 'Вече има пратка до този номер: {num} от {date}.', dup_show: 'Покажи', dup_confirm_btn: 'Създай втора пратка',
    st_dup: 'вече изпратена ({num})',
    // parcels tab
    upd_now: 'Обновено току-що.', upd_min: 'Обновено преди {m} мин.', upd_hours: 'Обновено преди {h} ч.',
    upd_failed: 'Не успях да обновя. Виждаш последния известен статус.',
    parcels_empty_t: 'Тук ще се появят пратките ти', parcels_empty_s: 'Създай първата от „Нова пратка“ или добави номер на товарителница отгоре.',
    parcels_empty_cta: 'Нова пратка',
  },
  en: {
    page_title: 'Econt Shipper: from text to parcel', parse_failed: 'Could not read that message.',
    land_title: 'From text to parcel.',
    land_sub: "Paste the customer's message, check the name, the office and the amount, and the waybill is ready in your own Econt account. No retyping, no opening the Econt website.",
    land_cta: 'Connect your Econt account', land_cta_open: 'Open the app',
    land_cta_note: "You'll need your Econt username and password. They stay on this device, locked with a PIN. No Econt account? You can try a demo one.",
    demo_h: 'Example with one message',
    demo_c1: 'Paste the message', demo_c2: 'Check and create the waybill', demo_c3: 'Send the reply',
    demo_map: 'Each numbered part of the message fills the waybill row with the same number.',
    demo_gloss: 'In English: "Hi, I\'ll take the jacket for 45 €. Maria Petrova, 0888 412 657, Econt Plovdiv, Trakia office. With review if possible, thanks!"',
    wb_title: 'Waybill', wb_rcpt: 'Recipient', wb_phone: 'Phone', wb_office: 'To office', wb_cod: 'Cash on delivery', wb_cod_v: '45 €',
    wb_review: 'Review', wb_review_v: 'Yes, before paying', wb_parcel: 'Parcel', wb_parcel_v: 'package, 1 kg, recipient pays',
    wb_from_settings: 'Weight and who pays come from your settings.', demo_out_meta: 'sent 14:34',
    land_more_h: 'What else it does',
    land_spec1_t: 'Text or a screenshot', land_spec1_d: 'Copy the message from OLX, Viber, Instagram or Facebook, or drop in a screenshot.',
    land_spec2_t: 'Many orders at once', land_spec2_d: 'Paste all the messages into one box. Each one becomes its own waybill.',
    land_spec3_t: 'Catches mistakes', land_spec3_d: 'Asks you first if the COD amount is missing or the same phone already has a parcel.',
    land_spec4_t: 'Free', land_spec4_d: 'You only pay Econt for the parcels, as usual.',
    land_need: 'Setup takes about a minute: a PIN, your Econt login and the office you ship from.',
    // setup
    setup_title: 'Quick setup', setup_sub: 'You do this once. Everything you enter stays on this device, locked with a PIN.',
    setup_s1: 'Choose a PIN', setup_s1_sub: 'Locks the app and encrypts your Econt password on this device.',
    setup_pin: 'PIN (4 to 6 digits)', setup_pin2: 'Repeat the PIN', setup_s2: 'Your Econt account',
    setup_user: 'Username', setup_pass: 'Password', setup_test: 'Test login',
    setup_user_hint: 'Type the username exactly, with its upper and lower case letters.',
    setup_demo_try: 'No Econt account? Try the demo one',
    setup_s3: 'Sender', setup_s3_sub: 'As it will appear on the waybill.', setup_yourname: 'Name', setup_yourphone: 'Phone', setup_youroffice: 'Office you ship from',
    setup_search_office: 'city or office name', find: 'Find',
    setup_s4: 'Usual parcel', setup_s4_sub: 'These go into every new parcel. You can change them for a single parcel.',
    weight: 'Weight (kg)', contents: 'Contents', contents_ph: 'e.g. clothes', who_pays: 'Who pays for delivery',
    receiver_pays: 'The receiver', i_pay: 'Me', setup_cod: 'I usually ship with cash on delivery (the amount is set per parcel)',
    cod_currency: 'Cash on delivery currency', setup_finish: 'Finish setup',
    // lock
    lock_title: 'Enter your PIN', lock_sub: 'Your Econt login is locked on this device.', unlock: 'Unlock', forget: 'Remove from this device and start over',
    nav_new: 'New parcel', nav_parcels: 'Parcels',
    // settings
    settings_h: 'Settings',
    set_account: 'Econt account', set_account_d: 'Your Econt username and password. The password stays on this device, encrypted with your PIN.',
    username: 'Username', pass_saved_ph: 'saved', pass_keep: 'Password',
    pass_keep_hint: 'Your password is saved. Fill this in only to change it.',
    set_sender: 'Sender', set_sender_d: 'As it will appear on the waybill, and where you ship from.',
    name: 'Name', phone: 'Phone', set_office_code: 'Office you ship from', office_code_ph: 'code', search: 'another office: city or name',
    set_return: 'Return on refusal',
    set_defaults: 'Usual parcel', set_defaults_d: 'These go into every new parcel. You can change them for a single parcel.',
    receiver: 'The receiver', sender: 'The sender',
    set_cod: 'Cash on delivery', set_cod_d: 'Currency, payout account and declared value.',
    set_cod_default: 'Turn on cash on delivery for every new parcel',
    set_shiptype: 'Shipment type', shiptype_pack: 'Parcel', shiptype_doc: 'Documents', set_packcount: 'Number of packs',
    set_extra: 'Inspection and SMS', set_extra_d: 'Applies to every parcel.',
    set_sms: 'SMS to the recipient for every parcel', cod_warn: 'This parcel has no cash on delivery.',
    offices_status: '{n} active offices, list updated {m} min ago.', offices_status_now: '{n} active offices, list updated just now.',
    offices_status_h: '{n} active offices, list updated {h} h ago.', offices_added: 'New offices: {d}.',
    gaps_prefix: 'Could not read: ', gap_name: 'name', gap_phone: 'phone', gap_office: 'office', gap_addr: 'address', gaps_hint: '. Fill them in yourself.',
    decl: 'Declared value', decl_default: 'Declare a value equal to the cash on delivery amount',
    sec_recipient: 'Recipient', sec_delivery: 'Delivery', sec_parcel: 'Parcel', sec_pay: 'Payment',
    ret_label: 'If the receiver refuses, where the parcel goes back to', ret_default: 'As set up with Econt', ret_office: 'To an office (enter its code)', ret_address: 'To an address', ret_office_ph: 'office code, e.g. 9049',
    // batch
    batch_h: 'Several parcels at once', batch_found: '{n} parcels: {c} to create, {t} to track.', batch_found_c: '{n} parcels to create.',
    batch_create: 'Create selected', batch_cancel: 'Close', batch_run: 'Creating {i} of {n}…',
    batch_edit: 'Open', batch_no_office: 'pick an office', batch_addr_row: 'to address: {a}',
    st_create: 'new parcel', st_create_cod: 'new parcel, cash on delivery {amt}', st_create_conv: 'new parcel, cash on delivery {amt}, about {v}', st_pick: 'several offices match, pick one', st_badamt: 'the amount is not a number, fix it', st_baddecl: 'the declared value is missing or not a number, open the row', st_nocontact: 'name or phone missing', st_track: 'has a waybill, will be tracked', st_missing: 'office missing', st_creating: 'creating…', st_ok: 'created: {num}', st_ok_norev: 'created: {num}, Econt added no inspection', st_tracked: 'added to tracking', st_skip: 'skipped',
    batch_done: 'Done. {parts}.',
    bd_ok1: '1 waybill created', bd_ok: '{n} waybills created', bd_tr1: '1 number added to tracking', bd_tr: '{n} numbers added to tracking',
    bd_fail1: '1 row failed', bd_fail: '{n} rows failed', bd_skip1: '1 row skipped', bd_skip: '{n} rows skipped', bd_wait1: '1 row needs an office picked', bd_wait: '{n} rows need an office picked',
    row_label: 'Row {n}', row_one: 'row {n}', row_many: 'rows {list}', list_and: ' and ',
    ret_incomplete: 'Return on refusal was not saved. Fill in the office code or the address.',
    back_to_batch: 'Back to the list (row {n})',
    payout_label: 'Cash on delivery payout', payout_default: 'As set up with Econt', payout_load: 'Load accounts from Econt',
    payout_bank: 'bank transfer', payout_office: 'at office', payout_address: 'to address',
    payout_hint: 'The money is paid to the account in the agreement you pick with Econt.',
    payout_found: 'Found {n} agreements ({b} by bank). Pick which one your money goes to.',
    payout_none: 'Your account has no payout agreements. To be paid by bank transfer, sign an agreement with Econt.',
    refresh_offices: 'Refresh the office list', save: 'Save',
    // composer / preview
    paste_label: "The customer's message", paste_ph: 'Please send to Econt office: Varna Chataldzha…  Ivan Petrov - 08xx xxx xxx',
    comp_hint: 'Paste text or a chat screenshot, or drop them here.', a11y_attach: 'Attach a screenshot',
    ocr_loading: 'Preparing the reader…', ocr_reading: 'Reading the screenshot… {p}%', ocr_empty: 'No text found in the image. Try a clearer screenshot.', ocr_fail: 'Could not read it. Paste the text yourself.',
    clear: 'Clear', preview: 'Read message', prev_h: 'Check the parcel', recipient: 'Name',
    to_office: 'To office', to_address: 'To address', office_lbl: 'Econt office',
    addr_city: 'City', addr_post: 'Post code', addr_street: 'Street or quarter', addr_num: 'Number', addr_note: 'Landmark (optional)', need_addr: 'Address delivery needs a city and a street or quarter.',
    wrong_office: 'another office: search by city or name', search_btn: 'Search', description: 'Contents', pays: 'Who pays for delivery',
    cod: 'Cash on delivery', amount: 'amount', recalc: 'Get the price again', create_btn: 'Create waybill',
    // the created waybill
    res_h: 'Waybill created', copy: 'Copy number', label_pdf: 'Label PDF', view_in_profile: 'View in your account', new: 'New parcel',
    res_for: 'Created for {name}', res_created: 'Created',
    sum_for: 'For {name}', sum_office: 'office {o}', sum_addr: 'to {a}', sum_cod: 'cash on delivery\u00A0{amt}', sum_nocod: 'no cash on delivery',
    sum_decl: 'declared value\u00A0{amt}', sum_review: 'customer can inspect', sum_review_test: 'customer can inspect and test', sum_price: 'Price\u00A0{v}.',
    today_one: 'Today: 1 parcel', today_many: 'Today: {n} parcels', today_cod: '{amt} cash on delivery', today_and: ' and ',
    dd_site: 'econt.com', dd_site_sub: 'The official Econt website', dd_profile: 'e-Econt account', dd_profile_sub: 'The parcels in your account',
    reply_copy: 'Click or tap to copy', track_link: 'Track',
    reply_template: 'Done! Your parcel is on its way.\nTracking number: {num}\nTrack it: {url}',
    match_high: 'strong match', match_mid: 'likely match', match_lo: 'check the office',
    // parcels
    parcels_h: 'Your parcels', parcels_refresh: 'Refresh status',
    clear_all: 'Clear all', clear_confirm: 'Remove all parcels from this list? They stay in Econt.', del_confirm: 'Remove this parcel from the list? It stays in Econt.', clear_yes: 'Yes, remove all', del_yes: 'Yes, remove', forget_yes: 'Yes, delete', no: 'No', removed: 'Removed from the list', del_link: 'Remove from list',
    exp_delivery: 'Expected delivery', collected: 'Collected {amt}',
    track_events: 'Tracking', reprint: 'Label PDF', need_desc: 'Fill in the contents. Econt needs it for parcels.',
    loading: 'Loading…', no_status: 'No status', other_env: 'From another Econt account', kg: 'kg',
    review_only: 'Inspect', review_test: 'Inspect and test', review_none: 'No inspection',
    review_setting: 'Inspection before paying', review_unanchored: 'I choose for each parcel', review_always: 'Always with inspection', review_test_always: 'Always with inspection and test',
    review_label: 'Inspection before paying',
    review_set_review: 'Every parcel goes with inspection before paying. You can change this in Settings.', review_set_test: 'Every parcel goes with inspection and test before paying. You can change this in Settings.',
    track_ph: 'Waybill number', track_add: 'Add', already_added: 'This parcel is already on the list', invalid_number: 'That does not look like a waybill number',
    details: 'Details', delivered_ok: 'Delivered', returned_ok: 'Returned to sender', in_operation: 'In transit for {d}', delivered_in: 'Delivered in {d}', returned_in: 'Returned to sender after {d}', awaiting_dispatch: 'Waiting to be sent', cancelled_ok: 'Cancelled', dur_sent: 'sent {d} ago', dur_in: 'in {d}', dur_after: 'after {d}',
    dur_min: '{n}\u00A0min', dur_h: '{n}\u00A0h', dur_d1: '1\u00A0day', dur_d: '{n}\u00A0days', dur_join: ' ',
    d_status: 'Status', d_sender: 'Sender', d_recipient: 'Recipient', d_phone: 'Phone', d_office: 'Recipient office', d_sender_office: 'Sender office', d_storage: 'Stored at', d_type: 'Type', d_packs: 'Packs', d_weight: 'Weight', d_contents: 'Contents', d_review: 'Inspection', d_sent: 'Sent', d_expected: 'Expected delivery', d_delivered: 'Delivered at', d_cod: 'Cash on delivery', d_price: 'Price', d_attempts: 'Delivery attempts', d_routing: 'Routing',
    testing: 'Testing…', login_saved: 'Saved.', fix_login_hint: 'Open Settings (the cog at the top) and press "Test login" with your e-econt.com password.', server_waking: 'The server is waking up. Wait 30 seconds and try again.', net_down: 'No internet connection.', login_ok: 'Login works. {n} offices available.', need_creds: 'Enter your username and password first.',
    pin_short: 'The PIN needs at least 4 digits.', pin_mismatch: 'The two PINs do not match.', test_first: 'Test your Econt login first (step 2).',
    fill_sender: 'Fill in your name, phone and the office you ship from (step 3).',
    paste_first: 'Paste a message first.', pick_office: 'Pick an office.', need_recip: 'A name, a phone and an office are needed.',
    cod_blank: 'Cash on delivery is on but the amount is missing or not a number. Enter an amount or turn it off.',
    decl_blank: 'Declared value is on but the amount is missing or not a number. Enter an amount or turn it off.',
    review_ignored_prev: 'Econt does not offer inspection for this delivery, so the parcel will go without it.',
    review_ignored_res: 'Econt did not add inspection to this parcel, so the reply to the customer does not promise it.',
    ocr_stale: 'The message or the parcel changed while the screenshot was being read, so its text was not used.',
    a11y_cod_amount: 'Cash on delivery amount', a11y_decl_amount: 'Declared value amount', a11y_decl_cur: 'Declared value currency',
    saved: 'Saved', creating: 'Creating…', validated: 'Econt accepted the details',
    est_price: 'Estimated price <span class="price">{v}</span>',
    no_match: 'No office matched "{q}". Search below.', office_err: 'The office list did not load: {err}',
    demo_hint: 'Demo office list (about 585). Enter your own login in Settings to switch to your real account.',
    wrong_pin: 'Wrong PIN.', forget_confirm: 'Remove your saved Econt login and settings from this device? The parcel list stays.',
    refreshing: 'Refreshing…', offices_loaded: 'Loaded {n} offices.', searching: 'searching…', no_matches: 'no matches',
    no_number: '(Econt returned no number)', econt_prefix: 'Econt: ', error_prefix: 'Error: ',
    // about
    about_sub: "Makes a waybill in your Econt account from the customer's message, without retyping.",
    about_creator_h: 'Creator', about_creator_role: 'Idea, design and development',
    about_back: 'Back', footer_about: 'About and contact', rights: 'All rights reserved.',
    a11y_theme_dark: 'Switch to dark theme', a11y_theme_light: 'Switch to light theme',
    a11y_info: 'About this app', a11y_settings: 'Settings', a11y_lock: 'Lock', a11y_home: 'Home',
    // wake-up / retry / unsure create
    wake_wait: 'The server is waking up, a few more seconds…', price_waiting: 'The price will show in a moment, the server is waking up.',
    create_unsure: 'Could not tell whether the waybill was created. Check your e-Econt account before trying again.', create_unsure_link: 'Open e-Econt',
    st_unsure: 'unclear, check e-Econt', badge_demo: 'Demo', demo_note: 'You are using the demo account. Enter your own Econt username and password and press Save to switch to your real account.',
    busy_wait: 'Hold on, a parcel is being created…',
    parse_again: 'A parcel was being created, so the new message was not read. Press Read message again.',
    batch_nocod_list: 'No cash on delivery: {rows}.', batch_repeat_list: 'Already sent or unclear: {rows}.',
    batch_confirm_q: 'Go ahead?', batch_go: 'Yes, go ahead', batch_check: 'Let me check',
    // paste / live price / keyboard
    a11y_paste: 'Paste from clipboard', clip_denied: 'No clipboard access. Paste the text into the box.', clip_empty: 'The clipboard is empty.',
    create_hint: '{k}+Enter creates the waybill',
    // telling the customer
    send_customer: 'Send to customer', parcel_reply: 'Send to customer', reply_prev_h: 'What the customer gets',
    reply_paste_now: 'Reply copied, paste it into the chat.', copied_btn: 'Copied',
    copy_fail: 'Could not copy. Press and hold the text to copy it.', created_sr: 'Waybill created. Number {num}.',
    reply_review: 'At the counter you can open and check it, and pay only if everything is fine.',
    reply_review_test: 'At the counter you can open, check and test it, and pay only if everything is fine.',
    reply_cod: 'Cash on delivery: {amt}.',
    // COD guard
    st_nocod: 'no cash on delivery',
    nocod_confirm: 'This parcel goes out without cash on delivery. Go ahead?', nocod_go: 'Yes, without it', nocod_fix: 'I will add an amount',
    cod_conv: '{a} BGN is about {e}. Check which currency the listing used.',
    cod_conv_rev: '{a} EUR is about {b}. Check which currency the listing used.',
    // duplicate guard
    dup_warn: 'There is already a parcel to this number: {num} from {date}.', dup_show: 'Show', dup_confirm_btn: 'Create a second parcel',
    st_dup: 'already sent ({num})',
    // parcels tab
    upd_now: 'Updated just now.', upd_min: 'Updated {m} min ago.', upd_hours: 'Updated {h} h ago.',
    upd_failed: "Couldn't refresh. You're seeing the last known status.",
    parcels_empty_t: 'Your parcels will show up here', parcels_empty_s: 'Create one from New parcel, or add a waybill number above.',
    parcels_empty_cta: 'New parcel',
  },
};
let LANG = ['bg', 'en'].includes(localStorage.getItem('econt_lang')) ? localStorage.getItem('econt_lang') : 'bg';
// Line icons used from JS (stroke = currentColor, so they follow the theme).
const ICONS = {
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.6 4.6 6 6M18 18l1.4 1.4M19.4 4.6 18 6M6 18l-1.4 1.4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
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
// Bulgarian typesetting: a one-letter word (и, в, с, а, о, у, к) never ends a line.
// Two passes, so runs like "и в" both bind.
const SHORT_WORD = /(^|[\s(])([авиоскуАВИОСКУ]) /g;
const bindShortWords = (s) => s.replace(SHORT_WORD, '$1$2\u00A0').replace(SHORT_WORD, '$1$2\u00A0');
function applyLang() {
  const dict = I18N[LANG] || I18N.en;
  document.documentElement.lang = LANG;
  document.title = dict.page_title || I18N.en.page_title;
  document.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (dict[k] != null && !el.hasAttribute('aria-busy')) el.textContent = LANG === 'bg' && el.closest('#view-landing') ? bindShortWords(dict[k]) : dict[k]; });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const k = el.getAttribute('data-i18n-ph'); if (dict[k] != null) el.placeholder = dict[k]; });
  $('langBg').classList.toggle('active', LANG === 'bg');
  $('langEn').classList.toggle('active', LANG === 'en');
  $('footerCopy').textContent = `© ${new Date().getFullYear()} ${CREATOR.name || 'Econt Shipper'}`;
  $('footerAbout').textContent = dict.footer_about || I18N.en.footer_about;
  // Translated accessible names for the emoji-only controls.
  for (const [id, k] of [['infoBtn', 'a11y_info'], ['settingsBtn', 'a11y_settings'], ['lockNowBtn', 'a11y_lock'], ['brandHome', 'a11y_home'], ['attachBtn', 'a11y_attach'], ['pasteBtn', 'a11y_paste'], ['recalcBtn', 'recalc'], ['msg', 'paste_label'], ['refreshParcelsBtn', 'parcels_refresh']]) {
    const el = $(id); if (el) { el.setAttribute('aria-label', t(k)); el.title = t(k); }
  }
  // Money fields sit next to their checkbox label; each gets its own spoken name.
  for (const [id, k] of [['pCodAmount', 'a11y_cod_amount'], ['pCodCur', 'cod_currency'], ['pDeclAmount', 'a11y_decl_amount'], ['pDeclCur', 'a11y_decl_cur']]) {
    const el = $(id); if (el) el.setAttribute('aria-label', t(k));
  }
  $('createHint').textContent = t('create_hint', { k: isMac ? '⌘' : 'Ctrl' });
  renderLandingReply();
  syncThemeBtnLabel();
  renderToday();
}
function syncThemeBtnLabel() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const label = t(dark ? 'a11y_theme_light' : 'a11y_theme_dark');
  $('themeBtn').setAttribute('aria-label', label); $('themeBtn').title = label;
}
function setLang(l) {
  LANG = l; localStorage.setItem('econt_lang', l); applyLang();
  syncCreateLabel();
  if (!$('result').classList.contains('hide')) { if ($('shipNum').classList.contains('is-text')) $('shipNum').textContent = t('no_number'); renderReplyPreview(); }
  if (!$('batchNoCodConfirm').classList.contains('hide')) renderBatchNoCodMsg();
  if (!$('preview').classList.contains('hide')) updateSummary();
  if (!$('tab-parcels').classList.contains('hide')) openParcels();
  if (!$('view-about').classList.contains('hide')) renderAbout();
  if (!$('batch').classList.contains('hide')) renderBatch();
  // Strings built from state: the back-to-list buttons, the payout select and its message.
  showBatchBackBtns();
  renderPayoutSelect(PAYOUTS, $('cfgPayout').value);
  renderPayoutMsg();
  syncModeBadge();
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
// Amounts as people write them: 6,40 € in Bulgarian, 6.40 € in English. One rule on
// every screen: decimals only when they are not ,00 (99 €, 6,40 €).
function fmtNum(n, trim) {
  let s = (Number(n) || 0).toFixed(2);
  if (trim !== false) s = s.replace(/\.00$/, '');
  return LANG === 'bg' ? s.replace('.', ',') : s;
}
function fmtMoney(n, cur) {
  // Only a plain currency code ever reaches the page (Econt's reply is relayed as is).
  const c = String(cur || 'EUR').toUpperCase(), code = /^[A-Z]{3}$/.test(c) ? c : '';
  return fmtNum(n) + (c === 'BGN' ? '\u00A0лв' : c === 'EUR' ? '\u00A0€' : code ? '\u00A0' + code : '');
}
// A typed money amount, the way Bulgarians write it as well, read like the message
// parser reads it: "45,50", "45.50", "1 234,50", "1.234,50", "1.200" (thousands),
// "45 лв". Empty is 0; anything else that is not a number is NaN, so a typo is caught
// instead of becoming 4550 (type=number in an English browser drops the comma).
function parseAmount(v) {
  let s = String(v == null ? '' : v).trim().replace(/[\s\u00A0\u202F]/g, '').replace(/(лв\.?|лева|bgn|eur|евро|€)$/i, '');
  if (!s) return 0;
  if (/^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^[1-9]\d{0,2}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+[.,]\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else if (!/^\d+$/.test(s)) return NaN;
  return Number(s);
}
const amtOf = (id) => parseAmount($(id).value);
// The declared value a seller ticked must be a real amount: a typo or an empty box
// would make Econt drop the insurance without a word. The one empty box that is fine
// is the one that follows the COD ("equal to the COD" in Settings) while there is no COD.
function declBad(on, raw, auto) {
  if (!on) return false;
  raw = String(raw == null ? '' : raw).trim();
  if (!raw && auto) return false;
  return !(parseAmount(raw) > 0);
}
const declBadEd = () => declBad($('pDeclOn').checked, $('pDeclAmount').value, $('pDeclAmount').dataset.auto === '1');
// The customer reply as HTML: a long tracking URL may break after a slash, never mid-word.
// The landing shows the link short and blue (urlCls); the app shows it exactly as sent.
const urlParts = (rest) => rest.split('/').map((seg) => (seg ? `<span class="nw">${seg}</span>` : '')).join('/<wbr>');
const replyHTML = (text, urlCls) => text.split('\n').map((line) => esc(line).replace(/(https?:\/\/)(\S+)/, (m, scheme, rest) =>
  urlCls ? `<span class="${urlCls}">${urlParts(rest)}</span>` : scheme + urlParts(rest))).join('\n');
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
  if (view === 'landing') syncLandingCta();
  syncThemeColor();
}
// Landing CTA: a first visit connects an Econt account; a returning seller just opens the app.
function syncLandingCta() {
  const k = SESSION.password || loadStore() ? 'land_cta_open' : 'land_cta';
  for (const id of ['getStartedBtn', 'getStartedBtn2']) { const b = $(id); b.dataset.i18n = k; b.textContent = t(k); }
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
  // Plain spaces: this text is pasted into other chat apps.
  if (Number(info.cod) > 0) lines.push(t('reply_cod', { amt: fmtMoney(info.cod, info.currency).replace('\u00A0', ' ') }));
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
const noDash = (m) => String(m).replace(/\s+[\u2013\u2014]\s+/g, ', ').replace(/[\u2013\u2014]/g, '-');
const api = async (path, body, opts) => {
  opts = opts || {};
  for (let attempt = 0; ; attempt++) {
    let kind;
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ lang: LANG }, body || {})) });
      const txt = await res.text();
      try {
        const j = JSON.parse(txt); LAST_OK = Date.now();
        // Server and Econt messages are shown as written, minus their dashes (house style).
        if (j && typeof j.error === 'string') j.error = noDash(j.error);
        if (j && typeof j.officesError === 'string') j.officesError = noDash(j.officesError);
        return j;
      } catch { kind = 'waking'; }
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
  btn.style.minWidth = btn.offsetWidth + 'px';
  btn.classList.add('is-done');
  btn.textContent = t('copied_btn');
  setTimeout(() => { btn.innerHTML = html; btn.classList.remove('is-done'); btn.style.minWidth = ''; }, 1400);
}
function debounce(fn, ms) { let h = 0; const d = (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(h); return d; }
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
function officeLabel(c) { return [c.name, c.address, c.city].filter(Boolean).join(', ') + (c.postCode ? ' ' + c.postCode : ''); }
function officeOption(c) { const o = document.createElement('option'); o.value = c.code; o.textContent = officeLabel(c); o.dataset.name = c.name || ''; return o; }
const optName = (o) => (o ? (o.dataset.name || o.textContent) : '');
async function fillOfficeSelect(sel, q, credsObj) {
  const seq = PARSE_SEQ, live = () => sel !== $('pOffice') || (seq === PARSE_SEQ && !createBusy());
  if (sel === $('pOffice') && createBusy()) return false;
  sel.classList.remove('hide'); sel.innerHTML = `<option value="">${t('searching')}</option>`;
  const r = await api('/api/offices', { creds: credsObj, q }, { retry: true, alive: live });
  if (!live()) return false;
  if (!r.ok) { sel.innerHTML = `<option value="">${esc(r.error)}</option>`; return true; }   // changed: caller refreshes
  sel.innerHTML = '';
  for (const c of (r.candidates || [])) sel.appendChild(officeOption(c));
  if (!sel.options.length) sel.innerHTML = `<option value="">${t('no_matches')}</option>`;
  return true;
}

// ===================== WIZARD =====================
let wizardTested = false, WIZ_TEST_SEQ = 0;
const wizardCreds = () => ({ mode: $('suMode').value, username: $('suUser').value.trim(), password: $('suPass').value });
$('suTestBtn').onclick = async () => {
  const c = wizardCreds();
  if (!c.username || !c.password) { $('suTestMsg').className = 'err'; $('suTestMsg').textContent = t('need_creds'); return; }
  $('suTestMsg').className = 'muted'; $('suTestMsg').textContent = t('testing');
  const seq = ++WIZ_TEST_SEQ;
  const r = await api('/api/test', { creds: c });
  // A reply for credentials that were changed meanwhile says nothing about the new ones.
  const now = wizardCreds();
  if (seq !== WIZ_TEST_SEQ || now.mode !== c.mode || now.username !== c.username || now.password !== c.password) return;
  if (r.ok) { wizardTested = true; $('suTestMsg').className = 'good'; $('suTestMsg').textContent = t('login_ok', { n: r.officeCount }); $('suFinishBtn').disabled = false; }
  else { wizardTested = false; $('suTestMsg').className = 'err'; $('suTestMsg').textContent = r.error; $('suFinishBtn').disabled = true; }
  syncSetupSteps();
};
// Setup progress: a step's marker fills in once that step is complete.
function syncSetupSteps() {
  const pin = $('suPin').value;
  const done = {
    1: pin.length >= 4 && pin === $('suPin2').value,
    2: wizardTested,
    3: !!($('suSenderName').value.trim() && $('suSenderPhone').value.trim() && $('suSenderOffice').value),
    4: !!($('suDesc').value.trim() && Number($('suWeight').value) > 0),
  };
  document.querySelectorAll('#view-setup .step').forEach((li) => li.classList.toggle('done', !!done[li.dataset.step]));
}
$('view-setup').addEventListener('input', syncSetupSteps);
$('view-setup').addEventListener('change', syncSetupSteps);
for (const id of ['suUser', 'suPass', 'suMode']) $(id).addEventListener('input', () => {
  wizardTested = false; $('suFinishBtn').disabled = true;
  WIZ_TEST_SEQ++; $('suTestMsg').className = 'muted'; $('suTestMsg').textContent = '';
});
$('suSenderSearchBtn').onclick = async () => { await fillOfficeSelect($('suSenderOffice'), $('suSenderOfficeSearch').value, wizardCreds()); syncSetupSteps(); };
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
    sender: { name: $('suSenderName').value.trim(), phone: $('suSenderPhone').value.trim(), officeCode: office, officeName: optName($('suSenderOffice').selectedOptions[0]), address: null },
    defaults: { shipmentType: 'pack', packCount: 1, weight: Number($('suWeight').value) || 1, shipmentDescription: $('suDesc').value.trim(), payer: $('suPayer').value, payAfterAccept: false, payAfterTest: false, smsNotification: false, cod: { enabled: $('suCod').checked, amount: 0, currency: $('suCur').value }, countryCode: 'BGR' },
  };
  await persist(); enterApp();
};

// ===================== LOCK =====================
function showLock() {
  show('lock'); $('forgetConfirm').classList.add('hide'); $('lockMsg').textContent = ''; $('lockPin').value = '';
  // New PINs are 4 to 6 digits. A store from before that cap (no pinLen) may hold a
  // longer PIN, so its field takes any length; a stored length above 6 is honoured too.
  const store = loadStore(), pin = $('lockPin');
  if (store && store.pinLen) pin.maxLength = Math.max(6, store.pinLen); else pin.removeAttribute('maxlength');
  setTimeout(() => $('lockPin').focus(), 50); ping();
}
// The PIN is read once per attempt: digits typed while it decrypts never become
// SESSION.pin (the next save would re-encrypt with them). A request made while an
// attempt runs is kept and runs right after it, for whatever the field then holds.
let UNLOCKING = false, UNLOCK_NEXT = null;
async function tryUnlock(silentOnFail) {
  if (UNLOCKING) { UNLOCK_NEXT = { silent: !!silentOnFail && !(UNLOCK_NEXT && !UNLOCK_NEXT.silent) }; return; }
  const store = loadStore(); if (!store) return show('landing');
  const pin = $('lockPin').value;
  UNLOCKING = true; UNLOCK_NEXT = null;
  let ok = false;
  try {
    const password = await decryptSecret(store.enc, pin);
    SESSION.password = password; SESSION.pin = pin; ok = true;
    CONFIG = { mode: store.mode, username: store.username, sender: store.sender, defaults: store.defaults };
    enterApp();
  } catch { if (!ok && !silentOnFail && $('lockPin').value === pin) $('lockMsg').textContent = t('wrong_pin'); }
  finally {
    UNLOCKING = false;
    const next = UNLOCK_NEXT; UNLOCK_NEXT = null;
    if (!ok && next && !$('view-lock').classList.contains('hide')) {
      if ($('lockPin').value !== pin) tryUnlock(next.silent);
      else if (!next.silent) $('lockMsg').textContent = t('wrong_pin');
    }
  }
}
const unlock = () => tryUnlock(false);
$('lockBtn').onclick = unlock;
// Auto-unlock the moment the full PIN is entered, no button click needed.
$('lockPin').addEventListener('input', () => {
  $('lockMsg').textContent = '';
  const store = loadStore(); if (!store) return;
  const len = $('lockPin').value.length, expected = store.pinLen || 0;
  if (expected) { if (len === expected) tryUnlock(false); }
  else if (len >= 4) tryUnlock(true); // legacy store, length unknown: quiet tries, the button says if it is wrong
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
// The Demo badge follows CONFIG.mode wherever the mode changes (unlock, Save, a login check).
function syncModeBadge() { const badge = $('modeBadge'); badge.textContent = t('badge_demo'); badge.style.display = CONFIG.mode === 'demo' ? '' : 'none'; }
// The settings form always opens showing what is saved: edits left with Back are dropped,
// so a later unrelated Save can never store them by accident.
function fillSettingsForm() {
  $('cfgUser').value = CONFIG.username || ''; $('cfgPass').value = '';
  $('cfgTestMsg').textContent = ''; $('cfgMsg').textContent = '';
  $('cfgSenderSearch').value = ''; $('cfgSenderOfficeSel').classList.add('hide');
  $('cfgDemoNote').classList.toggle('hide', CONFIG.mode !== 'demo');
  const s = CONFIG.sender, d = CONFIG.defaults;
  $('cfgSenderName').value = s.name || ''; $('cfgSenderPhone').value = s.phone || ''; $('cfgSenderOffice').value = s.officeCode || '';
  $('cfgOfficeName').textContent = s.officeName || '';
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
  renderPayoutMsg();
}
function enterApp() {
  syncModeBadge();
  fillSettingsForm();
  applyReviewUI();  // keep the preview's review control in sync after a settings change
  if (!$('batch').classList.contains('hide') && !createBusy()) renderBatch();  // review / COD defaults show in the rows
  switchTab('new');
  show('app');
  renderToday();
  warm();
  if (window.matchMedia && matchMedia('(pointer: fine)').matches && $('preview').classList.contains('hide') && $('result').classList.contains('hide')) $('msg').focus({ preventScroll: true });
}
$('navNew').onclick = () => switchTab('new');
$('navParcels').onclick = () => switchTab('parcels');
$('settingsBtn').onclick = () => { fillSettingsForm(); show('settings'); fetchOfficeStatus(); };
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
  m.textContent = r.ok ? t('login_ok', { n: r.officeCount }) : r.error;
  // A login that just passed is saved immediately, so parcels use exactly the
  // account that was checked (before, it stayed unsaved until "Запази").
  if (r.ok && (c.username !== CONFIG.username || c.password !== SESSION.password || c.mode !== CONFIG.mode)) {
    CONFIG.mode = c.mode; CONFIG.username = c.username; SESSION.password = c.password;
    await persist(); $('cfgPass').value = '';
    m.textContent += ' ' + t('login_saved');
    $('cfgDemoNote').classList.toggle('hide', CONFIG.mode !== 'demo');
    syncModeBadge();
  }
  return !!r.ok;
}
$('cfgTestBtn').onclick = (ev) => cfgTestLogin(ev.currentTarget);
for (const id of ['cfgUser', 'cfgPass']) $(id).addEventListener('input', () => { $('cfgTestMsg').textContent = ''; });
// The office the select shows is the one Save stores: a single result (or the first of
// several) fires no change event, so adopt it as soon as the list is filled.
$('cfgSenderSearchBtn').onclick = async () => {
  const sel = $('cfgSenderOfficeSel');
  if ((await fillOfficeSelect(sel, $('cfgSenderSearch').value, cfgCreds())) && sel.value) sel.onchange();
};
$('cfgSenderOfficeSel').onchange = () => {
  const sel = $('cfgSenderOfficeSel');
  $('cfgSenderOffice').value = sel.value; $('cfgOfficeName').textContent = sel.value ? optName(sel.selectedOptions[0]) : '';
};
$('cfgSenderOffice').addEventListener('input', () => { $('cfgOfficeName').textContent = ''; });
$('refreshOfficesBtn').onclick = async (ev) => {
  const st = $('officeStatus');
  btnBusy(ev.currentTarget, true); st.textContent = t('refreshing');
  const r = await api('/api/offices/refresh', { creds: creds() });
  btnBusy(ev.currentTarget, false);
  st.textContent = r.ok
    ? t('offices_loaded', { n: r.count }) + (r.added > 0 ? ' ' + t('offices_added', { d: r.added }) : '')
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
  CONFIG.sender = { name: $('cfgSenderName').value.trim(), phone: $('cfgSenderPhone').value.trim(), officeCode: $('cfgSenderOffice').value.trim(), officeName: $('cfgOfficeName').textContent.trim(), address: CONFIG.sender.address || null };
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
let PAYOUTS = [], PAYOUT_MSG = { k: 'payout_hint' };
// The message under the payout select is state (hint, loading, result, error), so a
// language switch re-renders it instead of putting the static hint back.
function renderPayoutMsg() {
  const m = PAYOUT_MSG;
  $('cfgPayoutMsg').textContent = m.err != null ? t('error_prefix') + m.err : t(m.k, m.p);
}
function payoutLabel(o) {
  const m = o.method === 'bank' ? t('payout_bank') : o.method === 'office' ? t('payout_office')
    : o.method === 'address' ? t('payout_address') : (o.method || '');
  return [o.num, m, o.iban, o.bic].filter(Boolean).join(', ');
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
  PAYOUT_MSG = { k: 'loading' }; renderPayoutMsg();
  const r = await api('/api/payouts', { creds: cfgCreds() });
  btnBusy(btn, false);
  if (!r.ok) { PAYOUT_MSG = { err: r.error }; renderPayoutMsg(); return; }
  PAYOUTS = r.options || [];
  renderPayoutSelect(PAYOUTS, $('cfgPayout').value || (CONFIG.defaults.cod && CONFIG.defaults.cod.payOptionNum) || '');
  const banks = PAYOUTS.filter((o) => o.method === 'bank').length;
  PAYOUT_MSG = PAYOUTS.length ? { k: 'payout_found', p: { n: PAYOUTS.length, b: banks } } : { k: 'payout_none' };
  renderPayoutMsg();
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
  const m = Math.max(0, Math.floor(Number(r.ageMinutes) || 0));
  let msg = m < 1 ? t('offices_status_now', { n: r.count }) : m < 60 ? t('offices_status', { n: r.count, m }) : t('offices_status_h', { n: r.count, h: Math.floor(m / 60) });
  if (r.added > 0) msg += ' ' + t('offices_added', { d: r.added });
  $('officeStatus').textContent = msg;
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
// The same mobile-number pattern as parser.js PHONE_RE (keep the two in step): 0, +359
// or 00359, then 87x/88x/89x and seven more digits, with single space . - / separators,
// slashes ("0888/123456") and brackets ("(0888) 123 456"). The browser counts phones with
// it to decide whether a paste may be a batch, so both sides must see the same numbers.
const PH_SEP = '(?:\\s?[\\-./]\\s?|\\)\\s?|\\s)';
const PHONE_COUNT_RE = new RegExp('\\(?(?:(?:\\+|00)?\\s?359\\)?|0)' + PH_SEP + '?\\(?8' + PH_SEP + '?[7-9](?:' + PH_SEP + '?\\d){7}', 'g');
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
  // Several phone numbers MAY mean a batch, but only if the splitter really
  // finds 2+ parcels (an alternate number in one message is still one parcel).
  const forceSingle = !!(opts && opts.forceSingle);
  let triedBatch = false;
  if (!forceSingle && (text.match(PHONE_COUNT_RE) || []).length >= 2) {
    triedBatch = true;
    const handled = await doBatchParse(text, seq);
    if (handled || seq !== PARSE_SEQ) return handled === 'applied';
  }
  $('batch').classList.add('hide');
  if (!(opts && opts.keepBatchEdit)) { BATCH_EDIT = -1; showBatchBackBtns(); }
  parseBusy(true);
  try {
    const r = await api('/api/parse', { text, creds: creds() }, parseRetry(seq));
    if (seq !== PARSE_SEQ) return false;
    if (createBusy()) { $('parseErr').className = 'muted'; $('parseErr').textContent = t('parse_again'); return false; }
    $('parseErr').className = 'err'; $('parseErr').textContent = '';
    if (!r.ok) {
      // The server found several parcels the browser did not count: open them as a
      // list instead of showing one and dropping the rest. A batch Open (forceSingle)
      // or a list that was already tried shows the server's message.
      if (r.code === 'multi_parcel' && !forceSingle && !triedBatch) {
        const handled = await doBatchParse(text, seq);
        if (seq !== PARSE_SEQ) return false;
        if (handled) return handled === 'applied';
        $('parseErr').className = 'err';
      }
      // Too long, several parcels, or any other refusal: the server's own words.
      $('parseErr').textContent = r.error || t('parse_failed'); return false;
    }
    const p = r.parsed;
    REVIEW_IGNORED = null;
    PARSED_CUR = !!(p.cod && p.cod.amount && p.cod.currency);
    $('pName').value = p.recipientName || ''; $('pPhone').value = p.phone || '';
    CANDIDATES = r.candidates || [];
    const sel = $('pOffice'); sel.innerHTML = '';
    if (r.officesError) sel.innerHTML = `<option value="">${esc(t('office_err', { err: r.officesError }))}</option>`;
    else if (!CANDIDATES.length) sel.innerHTML = `<option value="">${esc(t('no_match', { q: p.locationText }))}</option>`;
    else for (const c of CANDIDATES) sel.appendChild(officeOption(c));
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
    $('reviewAnchored').textContent = t(anchor === 'review_test' ? 'review_set_test' : 'review_set_review');
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
    cod: { enabled: $('pCodOn').checked, amount: amtOf('pCodAmount') || 0, currency: $('pCodCur').value },
    declaredValue: { enabled: $('pDeclOn').checked, amount: amtOf('pDeclAmount') || 0, currency: $('pDeclCur').value },
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
  return total != null ? t('est_price', { v: esc(fmtMoney(total, cur)) }) : esc(t('validated'));
}
function currentReviewMode() { return reviewAnchor(CONFIG.defaults) || $('pReviewMode').value || 'none'; }
// Econt drops преглед/тест for some deliveries (parcel lockers and the like) and says so
// in its reply (reviewIgnored). The last quote's answer, null until one arrives.
let REVIEW_IGNORED = null;
const cleanEcontNote = (m) => String(m || '').replace(/\s+[\u2013\u2014]\s+/g, '. ').trim();
function reviewIgnoredText(key, info) {
  if (!info) return '';
  const m = cleanEcontNote(info.msg);
  return t(key) + (m ? ' ' + t('econt_prefix') + m : '');
}
function renderReviewIgnored() {
  const box = $('reviewIgnoredNote');
  const on = !!REVIEW_IGNORED && currentReviewMode() !== 'none';
  box.textContent = on ? reviewIgnoredText('review_ignored_prev', REVIEW_IGNORED) : '';
  box.classList.toggle('hide', !on);
}
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
    dest = opt && sel.value ? optName(opt) : '';
  }
  const codAmt = amtOf('pCodAmount'), declAmt = amtOf('pDeclAmount');
  const review = currentReviewMode();
  return {
    name: $('pName').value.trim(), dest, addr: deliverMode === 'address',
    cod: $('pCodOn').checked && codAmt > 0 ? { a: codAmt, c: $('pCodCur').value } : null,
    decl: $('pDeclOn').checked && declAmt > 0 ? { a: declAmt, c: $('pDeclCur').value } : null,
    // Never promise review that Econt said it will not add.
    review: REVIEW_IGNORED && review !== 'none' ? 'none' : review,
  };
}
// The parcel in plain words: who and where, then money and review.
// "За Теодор Манолов, офис София Павлово. Наложен платеж 99 €, с преглед."
function summaryText(d, created) {
  if (!d) return '';
  const cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  const who = [];
  // A short name never breaks across lines ("Теодор Манолов").
  const name = d.name && d.name.length <= 24 ? d.name.replace(/ /g, '\u00A0') : d.name;
  if (name) who.push(t(created ? 'res_for' : 'sum_for', { name }));
  else if (created) who.push(t('res_created'));
  if (d.dest) who.push(d.addr ? t('sum_addr', { a: d.dest }) : t('sum_office', { o: d.dest }));
  const terms = [d.cod ? t('sum_cod', { amt: fmtMoney(d.cod.a, d.cod.c) }) : t('sum_nocod')];
  if (d.decl) terms.push(t('sum_decl', { amt: fmtMoney(d.decl.a, d.decl.c) }));
  if (d.review === 'review_test') terms.push(t('sum_review_test'));
  else if (d.review === 'review') terms.push(t('sum_review'));
  const out = (who.length ? cap(who.join(', ')) + '. ' : '') + cap(terms.join(', ')) + '.';
  return LANG === 'bg' ? bindShortWords(out) : out;
}
function updateSummary() {
  const sel = $('pOffice');
  const name = $('pName').value.trim();
  const codOn = $('pCodOn').checked, codAmt = amtOf('pCodAmount');
  const sd = summaryData(), box = $('prevSummary');
  if (sd.name || sd.dest) { box.textContent = summaryText(sd); box.classList.remove('hide'); }
  else box.classList.add('hide');
  // Warn when there is no cash-on-delivery on this parcel.
  $('codWarn').classList.toggle('hide', codOn && codAmt > 0);
  if (codOn && codAmt > 0) $('noCodConfirm').classList.add('hide');
  // BGN vs EUR: show the other currency when it differs from the usual one.
  const defCur = (CONFIG.defaults.cod && CONFIG.defaults.cod.currency) || 'EUR', cur = $('pCodCur').value, ch = $('codCurHint');
  if (codOn && codAmt > 0 && cur !== defCur) {
    ch.textContent = cur === 'BGN' ? t('cod_conv', { a: fmtNum(codAmt), e: fmtMoney(codAmt / BGN_PER_EUR, 'EUR') }) : t('cod_conv_rev', { a: fmtNum(codAmt), b: fmtMoney(codAmt * BGN_PER_EUR, 'BGN') });
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
    ['pCodAmount', codOn && !(codAmt > 0)], ['pDeclAmount', declBadEd()]]) $(id).classList.toggle('need', !!on);
  renderReviewIgnored();
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
  if (createBusy()) return;   // the editor is frozen; a quote now could overwrite the create's messages
  const seq = ++PREVIEW_SEQ;
  $('previewErr').textContent = '';
  updateSummary(); renderOfficeHint();
  const o = gatherOverrides();
  const pb = $('priceBox');
  if (deliverMode === 'address') {
    if (!o.address.city || !o.address.street) { pb.removeAttribute('aria-busy'); pb.textContent = ''; $('previewErr').textContent = t('need_addr'); return; }
  } else if (!o.officeCode) { pb.removeAttribute('aria-busy'); pb.textContent = ''; $('previewErr').textContent = t('pick_office'); return; }
  const btn = ev && ev.currentTarget && ev.currentTarget.id === 'recalcBtn' ? $('recalcBtn') : null;
  // The placeholder is visual only: the live region is busy (nothing is read out)
  // until the price itself arrives.
  btnBusy(btn, true); pb.setAttribute('aria-busy', 'true'); pb.innerHTML = '<span class="sk" aria-hidden="true">price price price</span>';
  const r = await api('/api/preview', shipBody(o), {
    retry: true, alive: () => seq === PREVIEW_SEQ,
    onWait: () => { if (seq === PREVIEW_SEQ) { pb.removeAttribute('aria-busy'); pb.textContent = t('price_waiting'); } },
  });
  btnBusy(btn, false);
  if (seq !== PREVIEW_SEQ) return;
  pb.removeAttribute('aria-busy');
  if (!r.ok) { pb.textContent = ''; $('previewErr').textContent = t('econt_prefix') + r.error + (r.code === 'bad_login' ? '\n' + t('fix_login_hint') : ''); return; }
  REVIEW_IGNORED = r.reviewIgnored ? { msg: r.reviewIgnoredMessage || '' } : null;
  updateSummary();
  pb.innerHTML = showPrice(r.response);
}
// The one success moment: the digits of the new number settle in once, and a
// short buzz on phones. Nothing moves (or buzzes) when reduced motion is asked for.
let _revealT = 0;
function revealNumber() {
  const el = $('shipNum'), card = $('result'), num = el.textContent;
  clearTimeout(_revealT); card.classList.remove('revealing'); el.removeAttribute('aria-label');
  if (!/^\d+$/.test(num) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  // During the reveal the digits are separate boxes; they read as one number, and
  // the plain text comes back as soon as the moment is over.
  el.setAttribute('aria-label', num);
  el.innerHTML = [...num].map((c, i) => `<span class="d" aria-hidden="true" style="--i:${i}">${c}</span>`).join('');
  void card.offsetWidth;
  card.classList.add('revealing');
  _revealT = setTimeout(settleReveal, 1500);
  try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) navigator.vibrate(12); } catch (e) {}
}
// The moment is over (or cut short): plain text again. A selection on the number (the
// Copy fallback asks for a long-press on it) is kept on the plain text.
function settleReveal() {
  const el = $('shipNum'); clearTimeout(_revealT);
  $('result').classList.remove('revealing'); el.removeAttribute('aria-label');
  if (!el.querySelector('.d')) return;
  const sel = getSelection(), had = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode);
  el.textContent = el.textContent;
  if (had) { const r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); }
}
// Bring the new waybill into view with its number clear of the sticky top bar (html's
// scroll-padding-top). A card that fits is shown whole with the least movement; a taller
// one (phones) lines up its top, so the number is the first thing on screen.
function scrollToResult() {
  const el = $('result'), pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 72;
  const fits = el.getBoundingClientRect().height <= innerHeight - pad - 16;
  el.scrollIntoView({ behavior: scrollBehavior(), block: fits ? 'nearest' : 'start' });
}
// Today's progress from the parcel list: count and cash on delivery to collect.
function todayStats() {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const from = d0.getTime(), cod = {};
  const list = loadParcels().filter((p) => p.mode === CONFIG.mode && !p.manual && (p.createdAt || 0) >= from);
  for (const p of list) { const a = Number(p.cod) || 0; if (a > 0) { const c = p.currency === 'BGN' ? 'BGN' : 'EUR'; cod[c] = (cod[c] || 0) + a; } }
  return { n: list.length, cod };
}
function todayText() {
  const s = todayStats(); if (!s.n) return '';
  let txt = s.n === 1 ? t('today_one') : t('today_many', { n: s.n });
  const money = Object.keys(s.cod).sort().reverse().map((c) => fmtMoney(s.cod[c], c));
  if (money.length) txt += ', ' + t('today_cod', { amt: money.join(t('today_and')) });
  return txt + '.';
}
function renderToday() { const s = todayText(); for (const id of ['resToday', 'plToday', 'newToday']) { const el = $(id); if (el) el.textContent = s; } }
// Guards before a create: COD missing although it is the default, a parcel to
// the same phone in the last 72 h, or an earlier create whose outcome is unclear.
// Each needs one deliberate extra click (never a double-click or key repeat).
let NOCOD_ACK = false, DUP_ACK = '', DUP_ACK_AT = 0, PARSED_CUR = false, LAST_RESULT = null, LAST_SUM = null;
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
  renderToday();
  if (LAST_SUM) {
    $('resultSummary').textContent = summaryText(LAST_SUM.sum, true);
    $('resultMeta').textContent = LAST_SUM.price ? t('sum_price', { v: fmtMoney(LAST_SUM.price.v, LAST_SUM.price.c) }) : '';
  }
  const rn = $('resultNote'), dropped = LAST_SUM && LAST_SUM.reviewDropped;
  rn.textContent = dropped ? reviewIgnoredText('review_ignored_res', dropped) : '';
  rn.classList.toggle('hide', !dropped);
  if (!LAST_RESULT) { $('replyPreview').classList.add('hide'); return; }
  $('replyText').innerHTML = replyHTML(buildReply(LAST_RESULT.num, LAST_RESULT.info));
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
  if (declBadEd()) { $('previewErr').textContent = t('decl_blank'); $('pDeclAmount').focus(); return; }
  if (CONFIG.defaults.cod && CONFIG.defaults.cod.enabled && !o.cod.enabled && !NOCOD_ACK) {
    // Focus the safe choice: a stray Enter must not confirm shipping without COD.
    $('noCodConfirm').classList.remove('hide'); $('noCodFix').focus({ preventScroll: true }); return;
  }
  const dup = renderDupWarn();
  if (dup && !(DUP_ACK === dup.key && Date.now() - DUP_ACK_AT > 700)) {
    // Any activation that is not the confirm restarts the clock, so a held key,
    // a double-click or rapid clicking can never count as the deliberate second click.
    if (DUP_ACK !== dup.key) { DUP_ACK = dup.key; syncCreateLabel(); toast(dup.text); }
    DUP_ACK_AT = Date.now();
    return;
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
    $('shipNum').textContent = num; $('shipNum').classList.toggle('is-text', !st.shipmentNumber);
    const pdf = st.pdfURL;
    if (pdf) { $('pdfLink').href = pdf; $('pdfLink').style.display = ''; } else { $('pdfLink').style.display = 'none'; }
    $('profileLink').href = econtProfileUrl();
    if (st.shipmentNumber) { $('trackLink').href = econtTrackUrl(num); $('trackLink').style.display = ''; } else { $('trackLink').style.display = 'none'; }
    const destLabel = o.address ? [o.address.city, o.address.street, o.address.num].filter(Boolean).join(' ') : o.officeCode;
    // Econt dropped the review (reviewIgnored): the parcel, the receipt line and the
    // customer reply all say "no review", never what was asked for.
    const dropped = !!r.reviewIgnored && o.reviewMode !== 'none';
    const reviewMode = r.reviewIgnored ? 'none' : o.reviewMode;
    if (r.reviewIgnored) sum.review = 'none';
    const info = { cod: o.cod.enabled ? o.cod.amount : 0, currency: o.cod.currency, reviewMode };
    if (st.shipmentNumber) addParcel({ number: st.shipmentNumber, recipient: o.recipientName, phone: o.phone, phone9: normPhone9(o.phone), dest: destKey(o), office: destLabel, weight: o.weight, description: o.description, cod: info.cod, currency: o.cod.currency, reviewMode, createdAt: Date.now(), pdfURL: pdf, mode: CONFIG.mode });
    // Created from a batch row → mark THAT row done (captured before the wait).
    if (editRow && st.shipmentNumber) {
      editRow.done = true; editRow.on = true; editRow.unsure = false;
      editRow.statusTpl = { k: dropped ? 'st_ok_norev' : 'st_ok', p: { num: st.shipmentNumber } }; editRow.statusColor = 'var(--go-d)';
      editRow.name = o.recipientName; editRow.phone = o.phone; editRow.num = st.shipmentNumber; editRow.replyInfo = info;
    }
    const price = st.totalPrice != null ? { v: Number(st.totalPrice), c: st.totalPriceCurrency || o.cod.currency || 'EUR' } : null;
    LAST_RESULT = st.shipmentNumber ? { num: st.shipmentNumber, info, sum, price } : null;
    LAST_SUM = { sum, price, reviewDropped: dropped ? { msg: r.reviewIgnoredMessage || '' } : null };
    renderReplyPreview();
    $('replyBtn').classList.toggle('hide', !LAST_RESULT); $('copyBtn').classList.toggle('hide', !LAST_RESULT);
    showBatchBackBtns();
    $('preview').classList.add('hide'); $('result').classList.remove('hide');
    revealNumber();
    scrollToResult();
    $('srLive').textContent = t('created_sr', { num });
  } finally {
    freezeEditor(false);
    btnBusy(btn, false);
    if (!created) {
      syncCreateLabel();
      // A quote cancelled for the create must not leave a skeleton behind.
      if ($('priceBox').querySelector('.sk') || $('priceBox').textContent === t('price_waiting')) { $('priceBox').removeAttribute('aria-busy'); $('priceBox').textContent = ''; }
    }
  }
  if (created) { resetCreateGuards(); if (LAST_RESULT) $('replyBtn').focus({ preventScroll: true }); }
}
// A held Enter on the focused button must not fire repeated clicks.
$('createBtn').addEventListener('keydown', (e) => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); });
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
// A row holds everything a run will send, so what the list shows is what ships:
//   name, phone, cod (text as typed), cur, officeCode   the table cells
//   door        the delivery address (null = to an office)
//   review      the per-row review choice when settings do not fix one
//   codOff      COD was turned off on purpose (an emptied cell, or unticked in the editor)
//   ed          payer, weight, contents and declared value saved from the editor
let BATCH = [];
let BATCH_EDIT = -1; // row currently opened in the single-parcel editor
function showBatchBackBtns() {
  const show = BATCH_EDIT >= 0 && BATCH.length > 0;
  const label = show ? t('back_to_batch', { n: BATCH_EDIT + 1 }) : '';
  for (const id of ['backToBatchBtn', 'backToBatchBtn2']) {
    const b = $(id); b.classList.toggle('hide', !show); if (show) b.textContent = label;
  }
}
// A recent parcel or an unclear create to this row's phone: the row says so (and a run asks).
function recheckRowPhone(row) {
  const u = findUnsure(row.phone), d = !u && findDup(row.phone);
  if (u) { row.statusTpl = { k: 'st_unsure' }; row.statusColor = 'var(--warn)'; }
  else if (d) { row.statusTpl = { k: 'st_dup', p: { num: d.number } }; row.statusColor = 'var(--warn)'; }
  else if (row.statusTpl && (row.statusTpl.k === 'st_unsure' || row.statusTpl.k === 'st_dup')) { row.statusTpl = null; row.statusColor = ''; }
}
// Leave the editor and land back on the batch, carrying every edit into the row.
function returnToBatch(syncFields) {
  const row = BATCH[BATCH_EDIT];
  if (row && syncFields && !row.done) {
    const o = gatherOverrides();
    row.name = o.recipientName;
    row.phone = o.phone;
    row.codOff = !$('pCodOn').checked;
    row.cod = row.codOff ? '' : $('pCodAmount').value.trim();
    row.cur = $('pCodCur').value;
    row.review = $('pReviewMode').value || 'none';
    row.ed = { payer: o.payer, weight: o.weight, description: o.description, decl: o.declaredValue, declRaw: $('pDeclAmount').value.trim(), declAuto: $('pDeclAmount').dataset.auto === '1' };
    if (deliverMode === 'address') row.door = gatherAddress();
    else {
      row.door = null;
      const sel = $('pOffice');
      if (sel.value) {
        row.officeCode = sel.value;
        if (!row.candidates.some((c) => String(c.code) === sel.value)) {
          const op = sel.selectedOptions[0];
          row.candidates.unshift({ code: sel.value, name: op ? optName(op) : sel.value, address: '', city: '' });
        }
      }
    }
    clearRowProblem(row);
    recheckRowPhone(row);
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
const rowDoorOk = (row) => !!(row.door && row.door.city && row.door.street);
const rowDoorText = (row) => [row.door.city, row.door.street, row.door.num].filter(Boolean).join(' ');
// A declared value typed in the editor (one that follows the COD is checked as the COD).
const rowDeclRaw = (row) => (row.ed.declRaw != null ? row.ed.declRaw : String(row.ed.decl.amount || ''));
const rowDeclBad = (row) => !!(row.ed && row.ed.decl && row.ed.decl.enabled && !row.ed.declAuto && declBad(true, rowDeclRaw(row), false));
// Tied offices and none picked yet: the row waits for the seller, it is not skipped.
const rowNeedsPick = (row) => !row.done && !row.trackNum && row.ambiguous && !row.door && !row.officeCode;
// What a run found wrong with a row and the seller can fix in place. Once the row is
// edited the note goes, and the status says again what the row will do now.
const ROW_PROBLEMS = ['st_badamt', 'st_baddecl', 'st_pick', 'st_missing', 'st_nocontact'];
function clearRowProblem(row) {
  const tp = row.statusTpl;
  if (tp && (tp.raw != null || ROW_PROBLEMS.includes(tp.k))) { row.statusTpl = null; row.statusColor = ''; }
  if (row.res === 'wait' && !rowNeedsPick(row)) row.res = null;
}
// Row status: explicit run results win; otherwise what will happen on "run".
// A row with no COD while COD is the default is called out before it ships, and
// the amount is echoed, so a typo (4550 for 45,50) is seen before the run.
function batchRowStatus(row) {
  if (row.statusTpl) return { text: row.statusTpl.raw != null ? row.statusTpl.raw : t(row.statusTpl.k, row.statusTpl.p), color: row.statusColor || '', needCod: false };
  if (row.trackNum) return { text: t('st_track'), color: '', needCod: false };
  if (!(row.door ? rowDoorOk(row) : row.officeCode)) return { text: t(row.ambiguous && !row.door ? 'st_pick' : 'st_missing'), color: 'var(--warn)', needCod: false };
  if (!String(row.name || '').trim() || !String(row.phone || '').trim()) return { text: t('st_nocontact'), color: 'var(--warn)', needCod: false };
  const d = CONFIG.defaults.cod || {}, amt = parseAmount(row.cod);
  if (isNaN(amt)) return { text: t('st_badamt'), color: 'var(--warn)', needCod: true };
  if (rowDeclBad(row)) return { text: t('st_baddecl'), color: 'var(--warn)', needCod: false };
  if (d.enabled && !(amt > 0)) return { text: t('st_nocod'), color: 'var(--warn)', needCod: true };
  if (!(amt > 0)) return { text: t('st_create'), color: '', needCod: false };
  const a = fmtMoney(amt, row.cur);
  if (row.cur !== (d.currency || 'EUR')) return { text: t('st_create_conv', { amt: a, v: row.cur === 'BGN' ? fmtMoney(amt / BGN_PER_EUR, 'EUR') : fmtMoney(amt * BGN_PER_EUR, 'BGN') }), color: '', needCod: false };
  return { text: t('st_create_cod', { amt: a }), color: '', needCod: false };
}
const batchSendBtn = () => `<button class="lnk" data-f="send" type="button">${esc(t('parcel_reply'))}</button>`;
// "ред 1", "редове 1 и 3": rows named in words, never with a # sign.
function rowsLabel(idx) {
  const n = idx.map((i) => i + 1);
  if (n.length === 1) return t('row_one', { n: n[0] });
  return t('row_many', { list: n.slice(0, -1).join(', ') + t('list_and') + n[n.length - 1] });
}
function syncRowStatus(i) {
  const row = BATCH[i], el = $q(`.brow[data-i="${i}"]`); if (!row || !el) return;
  const st = batchRowStatus(row), se = el.querySelector('[data-status]');
  se.textContent = st.text; se.style.color = st.color;
  const ci = el.querySelector('[data-f="cod"]'); if (ci) ci.classList.toggle('need', st.needCod);
}
// Offices a row can be sent to: confident candidates, or (an ambiguous match) the
// tied suggestions. Suggestions are never preselected: the empty choice comes first.
const rowOffices = (row) => (row.candidates.length ? row.candidates : (row.suggestions || []));
function batchRowHTML(row, i) {
  const rs = batchRowStatus(row);
  const status = `<span class="brow-status" data-status${rs.color ? ` style="color:${rs.color}"` : ''}>${esc(rs.text)}</span>`;
  // A created row folds to one line: which row, who, the number, and the reply.
  if (row.done) {
    return `<div class="brow done" data-i="${i}">
    <div class="brow-top">
      <input type="checkbox" data-f="on" checked hidden><span class="idx">${esc(t('row_label', { n: i + 1 }))}</span>
      <span class="brow-mid">${row.trackNum ? `<span class="track-tag">${esc(row.trackNum)}</span>` : ''}${row.name ? `<span class="brow-name">${esc(row.name)}</span>` : ''}${status}</span>
      <span class="brow-acts">${row.num ? batchSendBtn() : ''}</span>
    </div>
  </div>`;
  }
  const offs = rowOffices(row);
  const officeUI = row.door
    ? `<input data-f="addr" value="${esc(t('batch_addr_row', { a: rowDoorText(row) }))}" disabled aria-label="${esc(t('to_address'))}">`
    : `<select data-f="office" aria-label="${esc(t('office_lbl'))}">${row.officeCode && offs.length ? '' : `<option value="">${esc(t('batch_no_office'))}</option>`}${offs.map((c) => `<option value="${esc(c.code)}" data-name="${esc(c.name || '')}">${esc(officeLabel(c))}</option>`).join('')}</select>`;
  const rv = row.review || 'none';
  const reviewUI = reviewAnchor(CONFIG.defaults) ? ''
    : `<select data-f="review" aria-label="${esc(t('review_label'))}">${[['none', 'review_none'], ['review', 'review_only'], ['review_test', 'review_test']].map(([v, k]) => `<option value="${v}"${rv === v ? ' selected' : ''}>${esc(t(k))}</option>`).join('')}</select>`;
  return `<div class="brow" data-i="${i}">
    <div class="brow-top">
      <label class="brow-pick"><input type="checkbox" data-f="on" ${row.on ? 'checked' : ''}><span class="idx">${esc(t('row_label', { n: i + 1 }))}</span></label>
      <span class="brow-mid">${row.trackNum ? `<span class="track-tag">${esc(row.trackNum)}</span>` : ''}${status}</span>
      <span class="brow-acts"><button class="lnk" data-f="edit" type="button">${esc(t('batch_edit'))}</button></span>
    </div>
    <div class="brow-grid">
      <input data-f="name" value="${esc(row.name)}" placeholder="${esc(t('recipient'))}" aria-label="${esc(t('recipient'))}">
      <input data-f="phone" inputmode="tel" value="${esc(row.phone)}" placeholder="${esc(t('phone'))}" aria-label="${esc(t('phone'))}">
      <input data-f="cod" class="${rs.needCod ? 'need' : ''}" type="text" inputmode="decimal" autocomplete="off" value="${esc(row.cod || '')}" placeholder="${esc(t('amount'))}" aria-label="${esc(t('a11y_cod_amount'))}">
      <select data-f="cur" aria-label="${esc(t('cod_currency'))}"><option value="EUR"${row.cur === 'EUR' ? ' selected' : ''}>EUR</option><option value="BGN"${row.cur === 'BGN' ? ' selected' : ''}>BGN</option></select>
      ${officeUI}
      ${reviewUI}
    </div>
  </div>`;
}
async function doBatchParse(text, seq) {
  parseBusy(true);
  try {
    const r = await api('/api/parse-batch', { text, creds: creds() }, parseRetry(seq));
    if (seq !== PARSE_SEQ) return true;
    if (createBusy()) { $('parseErr').className = 'muted'; $('parseErr').textContent = t('parse_again'); return true; }
    $('parseErr').className = 'err'; $('parseErr').textContent = '';
    // Too big a paste (batch_too_big) and any other refusal: the server's own message.
    if (!r.ok) { $('parseErr').textContent = r.error || t('parse_failed'); return true; }
    if (!r.rows || r.rows.length < 2) return false; // one parcel → normal editor
    BATCH = (r.rows || []).map((row) => {
      const p = row.parsed || {}, cands = row.candidates || [];
      // A tie between offices comes back as suggestions with no candidate: the row
      // starts unticked with "pick one", and nothing is preselected.
      const ambiguous = !!row.ambiguous && !cands.length;
      return {
        chunk: row.chunk, parsed: p, candidates: cands, trackNum: row.trackNum || null,
        ambiguous, suggestions: ambiguous ? (row.suggestions || []) : [],
        on: !ambiguous,
        name: p.recipientName || '',
        phone: p.phone || '',
        officeCode: cands.length ? String(cands[0].code) : '',
        door: p.deliveryType === 'door' && p.address ? Object.assign({}, p.address) : null,
        review: p.reviewMode || 'none',
        cod: p.cod && p.cod.amount ? String(p.cod.amount) : '',
        codOff: false, ed: null,
        cur: (p.cod && p.cod.currency) || (CONFIG.defaults.cod && CONFIG.defaults.cod.currency) || 'EUR',
        done: false,
      };
    });
    // An unclear earlier create or a recent parcel to the same phone → start
    // unticked; ticking the row is the deliberate confirm.
    for (const row of BATCH) {
      if (row.trackNum) continue;
      if (findUnsure(row.phone)) { row.on = false; row.unsure = true; row.statusTpl = { k: 'st_unsure' }; row.statusColor = 'var(--warn)'; continue; }
      const d = findDup(row.phone);
      if (d) { row.on = false; row.statusTpl = { k: 'st_dup', p: { num: d.number } }; row.statusColor = 'var(--warn)'; }
    }
    BATCH_CONSENT = ''; $('batchNoCodConfirm').classList.add('hide');
    if (r.officesError) $('batchErr').textContent = t('office_err', { err: r.officesError }); else $('batchErr').textContent = '';
    BATCH_EDIT = -1; showBatchBackBtns();
    renderBatch();
    $('preview').classList.add('hide'); $('result').classList.add('hide');
    $('batch').classList.remove('hide');
    $('batch').scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
    return 'applied';
  } finally { parseBusy(false); }
}
// Run progress for the batch on screen: "Създавам 2 от 5…", a bar, then the tally.
let BATCH_RUN = null;
// The tally names only what happened: "Готово. Създадени са 2 товарителници."
// Counted from the rows as they are now, so a row created later from the editor
// counts as created: every done row, then each other row's last run result.
function batchTally(rows) {
  const res = { ok: 0, tracked: 0, fail: 0, skip: 0, wait: 0 };
  for (const r of rows) {
    if (r.done) { res.ok++; if (r.trackNum) res.tracked++; }
    else if (r.res && res[r.res] != null) res[r.res]++;
  }
  return res;
}
function batchDoneText(res) {
  const parts = [], add = (n, one, many) => { if (n > 0) parts.push(n === 1 ? t(one) : t(many, { n })); };
  add(res.ok - (res.tracked || 0), 'bd_ok1', 'bd_ok'); add(res.tracked || 0, 'bd_tr1', 'bd_tr');
  add(res.fail, 'bd_fail1', 'bd_fail'); add(res.wait || 0, 'bd_wait1', 'bd_wait'); add(res.skip, 'bd_skip1', 'bd_skip');
  const txt = parts.join(', ');
  return t('batch_done', { parts: txt.charAt(0).toUpperCase() + txt.slice(1) });
}
function renderBatchInfo() {
  const creates = BATCH.filter((r) => !r.trackNum).length, tracks = BATCH.length - creates;
  const run = BATCH_RUN && BATCH_RUN.rows === BATCH ? BATCH_RUN : null;
  const tally = run && run.res ? batchTally(BATCH) : null;
  $('batchInfo').textContent = tally ? batchDoneText(tally)
    : run ? t('batch_run', { i: Math.min(run.k + 1, run.n), n: run.n })
    : tracks ? t('batch_found', { n: BATCH.length, c: creates, t: tracks }) : t('batch_found_c', { n: BATCH.length });
  $('batchToday').textContent = run && run.res ? todayText() : '';
  // Review fixed in Settings: one line says so (rows then carry no review choice).
  const anchor = reviewAnchor(CONFIG.defaults);
  $('batchReviewNote').textContent = anchor ? t(anchor === 'review_test' ? 'review_set_test' : 'review_set_review') : '';
  $('batchReviewNote').classList.toggle('hide', !anchor);
  syncBatchActions();
  const bar = $('batchProg');
  bar.classList.toggle('hide', !run);
  if (!run) return;
  $('batchBar').style.width = (run.res ? 100 : run.n ? Math.round(run.k / run.n * 100) : 0) + '%';
  bar.classList.toggle('ok', !!tally && !tally.fail && !tally.wait && !batchLive(BATCH));
  bar.classList.toggle('bad', !!tally && tally.fail > 0);
}
// One primary at a time: Създай избраните while a row is still to be created; once
// every row is through, Нова пратка takes its place. Never a run with nothing in it.
// A row still waiting for an office, or one whose create is unclear, keeps the list
// open: Нова пратка would drop that order without a word.
const batchLive = (rows) => rows.filter((r) => r.on && !r.done).length;
const batchUndecided = (rows) => rows.some((r) => rowNeedsPick(r) || (r.unsure && !r.done));
function syncBatchActions() {
  const btn = $('batchCreateBtn'); if (btn.hasAttribute('aria-busy')) return;
  const live = batchLive(BATCH), ran = !!(BATCH_RUN && BATCH_RUN.rows === BATCH && BATCH_RUN.res);
  const finished = ran && !live && !batchUndecided(BATCH);
  btn.classList.toggle('hide', finished); btn.disabled = !finished && !live;
  $('batchCancelBtn').classList.toggle('hide', finished);
  $('batchNewBtn').classList.toggle('hide', !finished);
}
function renderBatch() {
  renderBatchInfo();
  $('batchList').innerHTML = BATCH.map((row, i) => batchRowHTML(row, i)).join('');
  // Select each row's chosen office (none for an ambiguous row until one is picked).
  $('batchList').querySelectorAll('.brow').forEach((el) => {
    const row = BATCH[Number(el.dataset.i)];
    const sel = el.querySelector('select[data-f="office"]');
    if (sel) sel.value = row.officeCode || '';
  });
}
$('batchList').addEventListener('input', (e) => {
  const el = e.target, brow = el.closest('.brow'); if (!brow) return;
  const i = Number(brow.dataset.i), row = BATCH[i], f = el.dataset.f;
  if (!row || !f) return;
  if (f === 'on') {
    row.on = el.checked;
    if (row.on && row.statusTpl && row.statusTpl.k === 'st_skip') { row.statusTpl = null; row.statusColor = ''; }
  }
  else if (f === 'name') row.name = el.value;
  else if (f === 'phone') row.phone = el.value;
  else if (f === 'office') {
    row.officeCode = el.value;
    // Picking one of the tied offices is the decision the row was waiting for.
    if (row.ambiguous && el.value && !row.on && !(row.statusTpl && (row.statusTpl.k === 'st_unsure' || row.statusTpl.k === 'st_dup'))) {
      row.on = true; const cb = brow.querySelector('[data-f="on"]'); if (cb) cb.checked = true;
    }
  }
  else if (f === 'cod') { row.cod = el.value; row.codOff = !el.value.trim(); }
  else if (f === 'cur') row.cur = el.value;
  else if (f === 'review') row.review = el.value;
  if (f !== 'on') clearRowProblem(row);
  if (f === 'phone') recheckRowPhone(row);
  syncRowStatus(i);
  if (f === 'on' || f === 'office') renderBatchInfo();
});
// Open a row in the single editor. The row's own values (table edits and what an
// earlier visit to the editor saved) win over the re-parse of its text.
function applyRowToEditor(row) {
  $('pName').value = row.name || '';
  $('pPhone').value = row.phone || '';
  if (String(row.cod || '').trim()) { $('pCodOn').checked = true; $('pCodAmount').value = row.cod; $('pCodCur').value = row.cur; }
  else if (row.codOff) { $('pCodOn').checked = false; $('pCodAmount').value = ''; $('pCodCur').value = row.cur; }
  if (!reviewAnchor(CONFIG.defaults)) setSeg('pReviewSeg', 'pReviewMode', row.review || 'none');
  const ed = row.ed;
  if (ed) {
    $('pPayer').value = ed.payer || 'receiver';
    $('pWeight').value = ed.weight != null ? ed.weight : '';
    $('pDesc').value = ed.description || '';
    const dv = ed.decl || {};
    $('pDeclOn').checked = !!dv.enabled; $('pDeclCur').value = dv.currency || $('pCodCur').value;
    $('pDeclAmount').value = ed.declAuto ? (dv.enabled ? $('pCodAmount').value : '') : (ed.declRaw != null ? ed.declRaw : (dv.amount || ''));
    if (ed.declAuto) $('pDeclAmount').dataset.auto = '1'; else delete $('pDeclAmount').dataset.auto;
  } else if ($('pDeclOn').checked && $('pDeclAmount').dataset.auto === '1') {
    $('pDeclAmount').value = $('pCodOn').checked ? $('pCodAmount').value : '';
  }
  if (row.door) { fillAddress(row.door); setDeliverMode('address', true); }
  else {
    setDeliverMode('office', true);
    if (row.officeCode) {
      const sel = $('pOffice');
      if (![...sel.options].some((o) => o.value === String(row.officeCode))) {
        const c = rowOffices(row).find((x) => String(x.code) === String(row.officeCode));
        const o = officeOption(c || { code: String(row.officeCode), name: String(row.officeCode) });
        sel.insertBefore(o, sel.firstChild);
      }
      sel.value = String(row.officeCode);
    }
  }
}
$('batchList').addEventListener('click', async (e) => {
  const sb = e.target.closest('button[data-f="send"]');
  if (sb) { const r = BATCH[Number(sb.closest('.brow').dataset.i)]; if (r && r.num) sendReply(r.num, sb, r.replyInfo); return; }
  const btn = e.target.closest('button[data-f="edit"]'); if (!btn || createBusy()) return;
  const i = Number(btn.closest('.brow').dataset.i);
  const row = BATCH[i];
  const prevMsg = $('msg').value, seq0 = PARSE_SEQ;
  $('msg').value = row.chunk;
  $('batch').classList.add('hide');
  BATCH_EDIT = i;
  if (!(await doParse(null, { forceSingle: true, keepBatchEdit: true }))) {
    // Not superseded by a newer paste: the parse failed, so return to the batch
    // (with the error above it) instead of leaving everything hidden.
    if (PARSE_SEQ <= seq0 + 1 && $('preview').classList.contains('hide')) {
      $('msg').value = prevMsg; BATCH_EDIT = -1; showBatchBackBtns(); $('batch').classList.remove('hide');
    }
    return;
  }
  applyRowToEditor(row);
  showBatchBackBtns();
  updateSummary();
  doPreview();
});
function batchOverrides(row) {
  const d = CONFIG.defaults, ed = row.ed || {};
  const mode = reviewAnchor(d) || row.review || 'none';
  const rf = reviewFlags(mode);
  const amt = parseAmount(row.cod), codOk = amt > 0;
  let declaredValue = (d.declaredValue && d.declaredValue.enabled && codOk) ? { enabled: true, amount: amt, currency: row.cur } : { enabled: false };
  if (ed.decl) declaredValue = !ed.decl.enabled ? { enabled: false }
    : ed.declAuto ? (codOk ? { enabled: true, amount: amt, currency: row.cur } : { enabled: false })
    : { enabled: true, amount: parseAmount(rowDeclRaw(row)) || 0, currency: ed.decl.currency || row.cur };
  const o = {
    recipientName: row.name.trim(), phone: row.phone.trim(),
    weight: ed.weight != null ? ed.weight : d.weight,
    description: ed.description != null ? ed.description : d.shipmentDescription,
    payer: ed.payer || d.payer || 'receiver',
    cod: { enabled: codOk, amount: codOk ? amt : 0, currency: row.cur },
    declaredValue,
    payAfterAccept: rf.payAfterAccept, payAfterTest: rf.payAfterTest, reviewMode: mode,
  };
  if (row.door) o.address = Object.assign({ countryCode: 'BGR' }, row.door);
  else o.officeCode = row.officeCode;
  return o;
}
$('batchCancelBtn').onclick = () => $('batch').classList.add('hide');
// Run-time consent, checked against the rows AS THEY ARE NOW (phones may have been
// edited since the paste): ticked rows without COD while COD is the default, and
// ticked rows whose phone already has a recent parcel or an unclear create.
// "Yes" covers exactly the rows it named, for one run only.
let BATCH_CONSENT = '', BATCH_RISK = { nocod: [], repeat: [] };
function batchRisk(rows) {
  const live = (r) => r.on && !r.done && !r.trackNum;
  const codOn = CONFIG.defaults.cod && CONFIG.defaults.cod.enabled;
  const nocod = [], repeat = [];
  rows.forEach((r, i) => {
    if (!live(r)) return;
    const amt = parseAmount(r.cod);
    if (codOn && !isNaN(amt) && !(amt > 0)) nocod.push(i);
    if (findUnsure(r.phone) || findDup(r.phone)) repeat.push(i);
  });
  return { nocod, repeat, key: 'n' + nocod.join(',') + '|r' + repeat.join(',') };
}
function renderBatchNoCodMsg() {
  const parts = [];
  if (BATCH_RISK.nocod.length) parts.push(t('batch_nocod_list', { rows: rowsLabel(BATCH_RISK.nocod) }));
  if (BATCH_RISK.repeat.length) parts.push(t('batch_repeat_list', { rows: rowsLabel(BATCH_RISK.repeat) }));
  $('batchNoCodMsg').textContent = parts.join(' ') + ' ' + t('batch_confirm_q');
  $('batchNoCodGo').textContent = BATCH_RISK.repeat.length ? t('batch_go') : t('nocod_go');
  $('batchNoCodFix').textContent = BATCH_RISK.repeat.length ? t('batch_check') : t('nocod_fix');
}
$('batchNoCodGo').onclick = () => { BATCH_CONSENT = BATCH_RISK.key; $('batchNoCodConfirm').classList.add('hide'); $('batchCreateBtn').onclick(); };
$('batchNoCodFix').onclick = () => {
  $('batchNoCodConfirm').classList.add('hide');
  const i = BATCH_RISK.nocod[0], j = BATCH_RISK.repeat[0];
  const el = i != null ? $q(`.brow[data-i="${i}"] [data-f="cod"]`) : j != null ? $q(`.brow[data-i="${j}"] [data-f="on"]`) : null;
  if (el) { el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }); el.focus({ preventScroll: true }); }
};
// Re-render one row from its state (survives a language switch mid-run).
function repaintRow(i) {
  const el = $q(`.brow[data-i="${i}"]`), row = BATCH[i]; if (!el || !row) return;
  el.outerHTML = batchRowHTML(row, i);
  const sel = $q(`.brow[data-i="${i}"] select[data-f="office"]`); if (sel) sel.value = row.officeCode || '';
}
$('batchCreateBtn').onclick = async () => {
  if (createBusy()) return;
  $('batchErr').textContent = '';
  const rows = BATCH; // snapshot BEFORE any wait: a paste meanwhile must never be acted upon
  if (!batchLive(rows)) { syncBatchActions(); return; }   // nothing ticked or left to create
  // Creating without a contents description fails at Econt for every row: stop early.
  if (rows.some((r) => r.on && !r.trackNum && !r.done && !String(batchOverrides(r).description || '').trim())) {
    $('batchErr').textContent = t('need_desc'); return;
  }
  // No COD although it is the default, or a repeat to a phone: ask, never ship silently.
  const risk = batchRisk(rows);
  if ((risk.nocod.length || risk.repeat.length) && risk.key !== BATCH_CONSENT) {
    BATCH_RISK = risk; renderBatchNoCodMsg();
    $('batchNoCodConfirm').classList.remove('hide'); $('batchNoCodFix').focus({ preventScroll: true });
    return;
  }
  $('batchNoCodConfirm').classList.add('hide');
  const btn = $('batchCreateBtn');
  btnBusy(btn, true, t('creating'));
  $('parseBtn').disabled = true; $('clearBtn').disabled = true; $('batchList').inert = true;
  let ok = 0, fail = 0, skip = 0, tracked = 0;
  try {
    const awake = await ensureAwake(btn);
    if (!awake.ok) { $('batchErr').textContent = awake.error; return; }
    if (BATCH !== rows || $('batch').classList.contains('hide')) return;
    btnBusy(btn, false); btnBusy(btn, true, t('creating'));
    const run = BATCH_RUN = { rows, n: rows.filter((r) => !r.done && r.on).length, k: 0, res: null };
    const step = () => { run.k++; if (BATCH === rows) renderBatchInfo(); };
    renderBatchInfo();
    for (let i = 0; i < rows.length; i++) {
      if (BATCH !== rows) break; // the batch was replaced mid-run — stop cleanly
      const row = rows[i]; if (row.done) continue;
      // Stored as a template so a language switch re-renders it correctly.
      const set = (k, p, color) => { row.statusTpl = typeof k === 'object' ? k : { k, p }; row.statusColor = color || ''; if (BATCH === rows) repaintRow(i); };
      if (!row.on) {
        // Still waiting for an office: it says so, and is not counted as skipped.
        if (rowNeedsPick(row)) { row.res = 'wait'; if (BATCH === rows) repaintRow(i); continue; }
        skip++; row.res = 'skip';
        // Keep an "unclear" / "already sent" warning; plain rows read "skipped".
        if (!(row.statusTpl && (row.statusTpl.k === 'st_unsure' || row.statusTpl.k === 'st_dup'))) set('st_skip');
        continue;
      }
      if (row.trackNum) {
        if (!loadParcels().some((x) => x.number === row.trackNum)) {
          addParcel({ number: row.trackNum, recipient: row.name.trim(), office: row.officeCode || '', cod: parseAmount(row.cod) || 0, currency: row.cur, createdAt: Date.now(), mode: CONFIG.mode, manual: true });
        }
        row.done = true; ok++; tracked++; set('st_tracked', null, 'var(--go-d)'); step();
        continue;
      }
      const o = batchOverrides(row);
      const destOk = o.officeCode || (o.address && o.address.city && o.address.street);
      if (!destOk) {
        const pick = row.ambiguous && !row.door;
        if (pick) row.res = 'wait'; else { fail++; row.res = 'fail'; }
        set(pick ? 'st_pick' : 'st_missing', null, 'var(--warn)'); step(); continue;
      }
      if (!o.recipientName || !o.phone) { fail++; row.res = 'fail'; set('st_nocontact', null, 'var(--warn)'); step(); continue; }
      if (isNaN(parseAmount(row.cod))) { fail++; row.res = 'fail'; set('st_badamt', null, 'var(--warn)'); step(); continue; }
      if (rowDeclBad(row)) { fail++; row.res = 'fail'; set('st_baddecl', null, 'var(--warn)'); step(); continue; }
      set('st_creating');
      const r = await api('/api/create', shipBody(o));   // never retried
      const st = r.ok ? (r.response.label || r.response) : null;
      if (r.ok && st && st.shipmentNumber) {
        // Econt dropped the review (reviewIgnored): stored and replied as "no review".
        const dropped = !!r.reviewIgnored && o.reviewMode !== 'none', reviewMode = r.reviewIgnored ? 'none' : o.reviewMode;
        const info = { cod: o.cod.enabled ? o.cod.amount : 0, currency: o.cod.currency, reviewMode };
        addParcel({ number: st.shipmentNumber, recipient: o.recipientName, phone: o.phone, phone9: normPhone9(o.phone), dest: destKey(o), office: o.officeCode || (o.address && o.address.city) || '', weight: o.weight, description: o.description, cod: info.cod, currency: o.cod.currency, reviewMode, createdAt: Date.now(), pdfURL: st.pdfURL, mode: CONFIG.mode });
        clearUnsure(o.phone);
        row.done = true; row.num = st.shipmentNumber; row.replyInfo = info; ok++; set(dropped ? 'st_ok_norev' : 'st_ok', { num: st.shipmentNumber }, 'var(--go-d)');
      } else if (r.transient || r.unsure) {
        // Unknown outcome: untick and remember, so neither a re-run nor the editor
        // can silently create a second waybill.
        markUnsure(o.phone);
        fail++; row.res = 'fail'; row.unsure = true; row.on = false; set('st_unsure', null, 'var(--warn)');
      } else {
        fail++; row.res = 'fail'; set({ raw: ((r && r.error) || 'error').slice(0, 120) }, null, 'var(--warn)');
      }
      step();
    }
    run.res = { ok, fail, skip, tracked };
    if (BATCH === rows) renderToday();
  } finally {
    btnBusy(btn, false); $('parseBtn').disabled = false; $('clearBtn').disabled = false; $('batchList').inert = false;
    BATCH_CONSENT = ''; // consent was for this run only
    if (BATCH === rows) renderBatchInfo(); else syncBatchActions();
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
const GREETING_RE = /(здравей\S*|здрасти|привет|добър\s+ден|добро\s+утро|\bhello\b|\bhi\b)/i;
function isolateMessage(text) {
  const m = String(text).match(GREETING_RE);
  return m ? text.slice(m.index) : text;
}
// Best-effort listing description: the longest multi-word line before the greeting,
// trimmed at a dash/comma and stripped of a trailing price. Without a greeting there
// is no listing header to tell apart from the customer's own words, so no guess; and
// a line with a phone, a COD word or an office word is the customer's, never the item.
const NOT_ITEM_RE = /наложен|нал\.\s*плат|офис|еконт|econt|автомат|\bcod\b/i;
function guessDescription(text) {
  const g = String(text).match(GREETING_RE);
  if (!g) return '';
  let best = '';
  for (const raw of String(text).slice(0, g.index).split(/\n+/)) {
    const line = raw.trim();
    if (line.split(/\s+/).length < 2) continue;
    if (new RegExp(PHONE_COUNT_RE.source).test(line) || NOT_ITEM_RE.test(line)) continue;
    if (line.length > best.length) best = line;
  }
  if (!best) return '';
  let d = best.split(/\s-\s|[\u2013\u2014,|]/)[0].trim();
  d = d.replace(/\s*\d+[.,]?\d*\s*(лв\.?|bgn|eur|€)(?![\p{L}\d]).*$/iu, '').trim();
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
// Edits in the editor or the batch list since some moment (an OCR result must not
// replace them). The newest OCR run wins; an older one that finishes later is dropped.
let EDIT_SEQ = 0, OCR_SEQ = 0;
['preview', 'batch'].forEach((id) => $(id).addEventListener('input', () => { EDIT_SEQ++; }));
async function runOCRFiles(files) {
  const imgs = [...files].filter((f) => f && /^image\//.test(f.type || ''));
  if (!imgs.length) return;
  const run = ++OCR_SEQ, tok = { parse: PARSE_SEQ, edit: EDIT_SEQ, msg: $('msg').value };
  // A newer message, parse or edit since this screenshot was attached: keep those.
  const stale = () => tok.parse !== PARSE_SEQ || tok.edit !== EDIT_SEQ || tok.msg !== $('msg').value;
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
      if (run !== OCR_SEQ) return;
    }
    if (run !== OCR_SEQ) return;
    box.classList.add('hide');
    if (stale()) { $('parseErr').className = 'muted'; $('parseErr').textContent = t('ocr_stale'); return; }
    if (!texts.length) { $('parseErr').className = 'err'; $('parseErr').textContent = t('ocr_empty'); return; }
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
    if (run !== OCR_SEQ) return;
    box.classList.add('hide');
    $('parseErr').className = 'err'; $('parseErr').textContent = t('ocr_fail');
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
$('officeSearchBtn').onclick = async () => { if ((await fillOfficeSelect($('pOffice'), $('officeSearch').value, creds())) !== false) doPreview(); };
$('pOffice').onchange = () => doPreview();
$('copyBtn').onclick = async (e) => {
  const btn = e.currentTarget;
  if (await copyText($('shipNum').textContent.trim())) { flashBtn(btn); return; }
  // Copy blocked (some in-app browsers): select the number so a long-press copies it,
  // on the plain text (the digit boxes of the reveal are about to go).
  settleReveal();
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
    const lbl = box.querySelector('.reply-prev-copy');
    lbl.textContent = t('copied_btn');
    setTimeout(() => { lbl.textContent = t('reply_copy'); box.classList.remove('is-done'); }, 1400);
  } else toast(t('copy_fail'));
}
$('replyPreview').onclick = copyReplyPreview;
$('replyPreview').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyReplyPreview(); } });
function startNew() { if (createBusy()) return; PARSE_SEQ++; resetCreateGuards(); $('parseErr').textContent = ''; $('msg').value = ''; $('result').classList.add('hide'); $('preview').classList.add('hide'); $('batch').classList.add('hide'); BATCH_EDIT = -1; showBatchBackBtns(); renderToday(); $('msg').focus(); }
$('newBtn').onclick = startNew;
$('batchNewBtn').onclick = startNew;
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
$('pDeclOn').addEventListener('change', () => {
  const da = $('pDeclAmount');
  if ($('pDeclOn').checked && !da.value.trim()) {
    // Ticked by hand: follow the COD when there is one, otherwise ask for an amount.
    if ($('pCodAmount').value.trim()) { da.value = $('pCodAmount').value; da.dataset.auto = '1'; }
    else delete da.dataset.auto;
  }
  doPreview();
});
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
// Sticky bars and keyboard focus: the browser scrolls a focused field just inside the
// viewport, which on a laptop screen is under the confirm (or save) bar. The bars'
// real heights feed html's scroll-padding-bottom (--cb-h, --sb-h), and a field that
// still ends up under a bar, or under the top bar, is brought to the middle.
(function initStickyBars() {
  const root = document.documentElement, cb = $('confirmBar'), sb = $q('.save-bar'), top = $q('.topbar');
  const measure = () => {
    if (cb.offsetHeight) root.style.setProperty('--cb-h', cb.offsetHeight + 'px');
    if (sb && sb.offsetHeight) root.style.setProperty('--sb-h', sb.offsetHeight + 'px');
  };
  if (window.ResizeObserver) { const ro = new ResizeObserver(measure); ro.observe(cb); if (sb) ro.observe(sb); }
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el || !el.getBoundingClientRect || el === document.body) return;
    const bar = $('preview').contains(el) ? cb : (sb && $('settings').contains(el)) ? sb : null;
    if (!bar || bar.contains(el)) return;
    requestAnimationFrame(() => {
      if (document.activeElement !== el || getComputedStyle(bar).position !== 'sticky') return;
      const r = el.getBoundingClientRect(), b = bar.getBoundingClientRect(), tb = top ? top.getBoundingClientRect().bottom : 0;
      if (r.bottom > b.top - 4 || r.top < tb + 4) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  });
})();

// ---------- parcels (live status + operation timer) ----------
function fmtDateTime(v) { const ms = toMs(v); if (!ms) return ''; const d = new Date(ms); if (isNaN(d.getTime())) return ''; return d.toLocaleString(LANG === 'bg' ? 'bg-BG' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
// Durations in words, coarse on purpose: "45 мин", "19 ч", "1 ден и 4 ч" ("1 day 4 h").
function fmtDuration(ms) {
  const min = Math.max(1, Math.floor((ms > 0 ? ms : 0) / 60000));
  if (min < 60) return t('dur_min', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('dur_h', { n: h });
  const d = Math.floor(h / 24), rh = h % 24, ds = d === 1 ? t('dur_d1') : t('dur_d', { n: d });
  return rh ? ds + t('dur_join') + t('dur_h', { n: rh }) : ds;
}
// Operation state: timer runs in transit, stops on delivered, returned or cancelled.
// Coarse on purpose, so the card face always carries Econt's own words as well; a
// failed or pending delivery ("Неуспешна доставка", "За доставка") is not "delivered".
const DELIVERED_RE = /(?:^|[^а-яё])(?:доставен|получен)[аио]?(?![а-яё])(?!\s+(?:в|до)\s+(?:офис|склад|автомат))(?!\s+от\s+куриер)|(?:^|[^a-z])delivered(?![a-z])(?!\s+to\s+(?:the\s+)?(?:office|locker))/;
const NOT_DELIVERED_RE = /неуспеш|не е доставен|недоставен|unsuccess|fail|not delivered|undeliver|attempt/;
function classify(p) {
  const txt = ((p.status || '') + ' ' + (p.statusEn || '')).toLowerCase();
  if (/анулир|cancel/.test(txt)) return 'cancelled';
  if (/върнат|върната|return|отказан|refus|reject/.test(txt)) return 'returned';
  if (!NOT_DELIVERED_RE.test(txt) && (p.deliveryTime || DELIVERED_RE.test(txt))) return 'delivered';
  if (p.sendTime) return 'transit';
  return 'created';
}
// Progress bar: created, on the way, finished (green) or stopped (amber: returned, cancelled).
function stepOf(st) { return st === 'delivered' || st === 'returned' || st === 'cancelled' ? 3 : st === 'transit' ? 2 : 1; }
// Econt status text in the UI language when Econt sends an English variant.
const statusText = (p) => ((LANG === 'en' && p.statusEn) ? p.statusEn : p.status) || '';
// Three-segment progress: created, on the way, finished (green) / returned (amber).
function trackAttrs(snap) {
  if (!snap) return 'data-step="0"';
  const st = classify(snap);
  return 'data-step="' + stepOf(st) + '"' + (st === 'returned' || st === 'cancelled' ? ' data-ret' : '');
}
function metaText(snap) {
  if (!snap || !snap.expectedDeliveryDate) return '';
  const st = classify(snap); if (st === 'delivered' || st === 'returned' || st === 'cancelled') return '';
  const d = fmtDate(snap.expectedDeliveryDate);
  return d ? esc(t('exp_delivery') + ': ' + d) : '';
}
function collectedPill(snap) {
  const n = snap && Number(snap.cdCollected);
  return n > 0 ? `<span class="statusb s-green" data-coll>${esc(t('collected', { amt: fmtMoney(n, snap.cdCurrency || 'EUR') }))}</span>` : '';
}

// Parcels in transit count up once a minute (no seconds ticking on every row).
const TICK = {}; let TIMER_INT = null;
function startTimers() {
  stopTimers();
  TIMER_INT = setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    for (const num in TICK) { const tk = TICK[num]; if (tk && tk.el && tk.el.isConnected) tk.el.textContent = t(tk.k, { d: fmtDuration(now - tk.start) }); }
    renderUpdated();
  }, 60000);
}
function stopTimers() { if (TIMER_INT) { clearInterval(TIMER_INT); TIMER_INT = null; } }
// The one status line of a row: Econt's own words for the state ("Пристигнала в офис"),
// then how long it took or has taken ("изпратена преди 1 ден и 6 ч"). Without a status
// text from Econt, the state in our words carries the time ("В движение от 1 ден").
function renderTimer(num, p) {
  const card = $q(`.parcel[data-num="${num}"]`); if (!card) return;
  const cell = card.querySelector('[data-status]'), dur = card.querySelector('[data-dur]');
  const st = classify(p), sent = toMs(p.sendTime), econt = statusText(p).trim(); delete TICK[num];
  cell.className = 'pstat';
  let own = '', short = '', tick = null;
  if (st === 'cancelled') own = t('cancelled_ok');
  else if (st === 'delivered') { const dt = toMs(p.deliveryTime); if (sent && dt) { own = t('delivered_in', { d: fmtDuration(dt - sent) }); short = t('dur_in', { d: fmtDuration(dt - sent) }); } else own = t('delivered_ok'); }
  else if (st === 'returned') { const dt = toMs(p.deliveryTime) || Date.now(); if (sent) { own = t('returned_in', { d: fmtDuration(dt - sent) }); short = t('dur_after', { d: fmtDuration(dt - sent) }); } else own = t('returned_ok'); }
  else if (st === 'transit' && sent) { own = t('in_operation', { d: fmtDuration(Date.now() - sent) }); short = t('dur_sent', { d: fmtDuration(Date.now() - sent) }); tick = econt ? 'dur_sent' : 'in_operation'; }
  else own = t('awaiting_dispatch');
  cell.textContent = econt || own;
  if (dur) dur.textContent = econt ? short : '';
  if (tick) TICK[num] = { start: sent, el: econt ? dur : cell, k: tick };
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
  add(t('d_cod'), p.cdCollected ? fmtMoney(p.cdCollected, p.cdCurrency) : null);
  add(t('d_price'), p.totalPrice != null ? fmtMoney(p.totalPrice, p.currency) : null);
  add(t('d_routing'), p.routingCode);
  return rows;
}
// A card paints instantly from the last saved snapshot; live data replaces it.
const subText = (recipient, office) => [recipient, office].filter(Boolean).join(', ');
function parcelCardHTML(p) {
  const other = p.mode !== CONFIG.mode;
  const snap = !other && p.snap ? p.snap : null;
  // Econt's own status words, then the time in ours ("Доставена за 19 ч"). Until a
  // status is known the line says so.
  const stat = (other ? `<span class="pstat" data-status>${esc(t('other_env'))}</span>`
    : snap ? '<span class="pstat" data-status></span>'
    : `<span class="pstat sk" data-status>${esc(t('loading'))}</span>`) + ' <span class="pdur" data-dur></span>';
  const copyLbl = t('copy') + ' ' + p.number;
  return `<div class="parcel" data-num="${esc(p.number)}">
    <div class="parcel-top"><button class="pnum" type="button" data-copy title="${esc(t('copy'))}" aria-label="${esc(copyLbl)}"><span class="parcel-num">${esc(p.number)}</span>${svgi('copy')}</button><span class="parcel-pills" data-pills>${collectedPill(snap)}</span></div>
    <div class="parcel-sub" data-sub>${esc(subText(p.recipient, p.office))}</div>
    <div class="ptrack" data-track ${trackAttrs(snap)} aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="parcel-line"><span class="pline">${stat}</span><span class="parcel-meta" data-meta>${metaText(snap)}</span></div>
    <div class="parcel-row">
      <button class="lnk" type="button" data-reply>${esc(t('parcel_reply'))}</button>
      <span class="spacer"></span>
      <button class="lnk" type="button" data-toggle aria-expanded="false"><span>${esc(t('details'))}</span>${svgi('chev')}</button>
    </div>
    <div class="parcel-x hide" data-x>
      <div class="details" data-details><div class="muted"${other ? '' : ' data-loading'}>${esc(other ? t('other_env') : t('loading'))}</div></div>
      <div class="parcel-more">
        <a class="lnk" href="${esc(econtTrackUrl(p.number))}" target="_blank" rel="noopener noreferrer">${esc(t('track_link'))}</a>
        <a class="lnk" data-pdf ${p.pdfURL ? `href="${esc(p.pdfURL)}"` : 'hidden'} target="_blank" rel="noopener noreferrer">${esc(t('reprint'))}</a>
        <button class="lnk lnk-danger" type="button" data-del>${esc(t('del_link'))}</button>
      </div>
      <div class="confirmrow hide" data-confirm role="alertdialog">
        <span>${esc(t('del_confirm'))}</span>
        <button class="lnk lnk-danger" type="button" data-yes>${esc(t('del_yes'))}</button>
        <button class="btn-sm" type="button" data-no>${esc(t('no'))}</button>
      </div>
    </div>
  </div>`;
}
function updateParcelCard(p, local) {
  const c = $q(`.parcel[data-num="${p.number}"]`); if (!c) return;
  local = local || {};
  const pills = c.querySelector('[data-pills]');
  pills.innerHTML = p.error ? '' : collectedPill(p);
  const tr = c.querySelector('[data-track]');
  tr.removeAttribute('data-ret'); tr.setAttribute('data-step', '0');
  if (!p.error) { const st = classify(p); tr.setAttribute('data-step', String(stepOf(st))); if (st === 'returned' || st === 'cancelled') tr.setAttribute('data-ret', ''); }
  c.querySelector('[data-meta]').innerHTML = p.error ? '' : metaText(p);
  if (p.recipient || p.office) c.querySelector('[data-sub]').textContent = subText(p.recipient, p.office);
  const pdf = p.pdfURL || local.pdfURL, a = c.querySelector('[data-pdf]');
  if (pdf) { a.href = pdf; a.hidden = false; } else { a.hidden = true; }
  if (p.error) { const cell = c.querySelector('[data-status]'); delete TICK[p.number]; cell.className = 'pstat'; cell.textContent = t('no_status'); c.querySelector('[data-dur]').textContent = ''; }
  else renderTimer(p.number, p);
  const det = c.querySelector('[data-details]');
  let html = detailRows(p, local).map(([k, v]) => `<div class="drow"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
  if (p.events && p.events.length) {
    // Newest first when every event has a time; otherwise keep Econt's order.
    const evs = p.events.map((ev) => ({ ev, ms: toMs(ev.time) }));
    if (evs.every((x) => x.ms)) evs.sort((x, y) => y.ms - x.ms);
    html += `<div class="events"><div class="events-h">${esc(t('track_events'))}</div>` + evs.map(({ ev }) => `<div class="event"><time>${esc(fmtDateTime(ev.time))}</time><span>${esc(ev.text || '')}${ev.office ? ` <span class="ev-o">${esc(ev.office)}</span>` : ''}</span></div>`).join('') + '</div>';
  }
  det.innerHTML = html || `<div class="muted">${esc(t('no_status'))}</div>`;
}
// Cards still waiting for a status after a refresh: stop the shimmer, say so.
function markUnknown(nums) {
  const list = loadParcels();
  for (const n of nums) {
    const c = $q(`.parcel[data-num="${n}"]`); if (!c) continue;
    const s = c.querySelector('[data-status].sk');
    if (s) { s.className = 'pstat'; s.textContent = t('no_status'); }
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
  $('parcelList').innerHTML = `<div class="card empty"><b>${esc(t('parcels_empty_t'))}</b><div class="muted">${esc(t('parcels_empty_s'))}</div><button class="primary" type="button" data-go-new>${esc(t('parcels_empty_cta'))}</button></div>`;
}
async function openParcels() {
  const list = loadParcels(), box = $('parcelList');
  syncParcelsChrome(list.length);
  renderToday();
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
    const open = !card.querySelector('[data-x]').classList.toggle('hide');
    card.classList.toggle('open', open);
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
  renderToday();
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
  const f = left && next && next.classList.contains('parcel') ? next.querySelector('[data-toggle]') : $('trackNumInput');
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
  renderToday();
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
  if (CREATOR.instagram) s.push(`<a class="social" target="_blank" rel="noopener noreferrer" href="https://instagram.com/${esc(CREATOR.instagram)}">${svgi('instagram')}Instagram</a>`);
  if (CREATOR.facebook) s.push(`<a class="social" target="_blank" rel="noopener noreferrer" href="${esc(fbUrl(CREATOR.facebook))}">${svgi('facebook')}Facebook</a>`);
  if (CREATOR.email) s.push(`<a class="social" href="mailto:${esc(CREATOR.email)}">${svgi('mail')}${esc(CREATOR.email)}</a>`);
  $('socialRow').innerHTML = s.join('');
  $('copyLine').textContent = `© ${new Date().getFullYear()} ${name}. ${t('rights')}`;
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
  syncThemeColor();
}
// Browser toolbar colour: Geist background-100 in every view.
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]'); if (!meta) return;
  meta.content = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0a0a0a' : '#ffffff';
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
$('getStartedBtn2').onclick = () => $('getStartedBtn').onclick();

// ---------- landing: the worked example ----------
// The reply bubble is the app's real reply text for the sample parcel, so the
// landing never promises something different from what customers receive.
const LAND_NUM = '1051602938472';
function renderLandingReply() {
  const el = $('ldReply'); if (!el) return;
  el.innerHTML = replyHTML(buildReply(LAND_NUM, { cod: 45, currency: 'EUR', reviewMode: 'review' }), 'url');
}
(function initLanding() {
  // Each marked part of the message lights up its waybill row, and the other way round.
  // Mouse: hover. Touch: a tap toggles the pair, a tap anywhere else clears it.
  // Keyboard: Tab onto a part lights its pair, Tab away clears it. A tap also focuses
  // the mark (tabindex), so only keyboard focus (:focus-visible) drives the highlight.
  const SEL = '.ld-bubble mark[data-n], .ld-wb-row[data-n]';
  const marks = document.querySelectorAll('.ld-bubble mark[data-n]'), rows = document.querySelectorAll('.ld-wb-row[data-n]');
  let cur = null, byKey = false, ptr = 'mouse';
  const set = (n) => {
    cur = n;
    marks.forEach((m) => m.classList.toggle('on', m.dataset.n === n));
    rows.forEach((r) => r.classList.toggle('on', r.dataset.n === n));
  };
  document.addEventListener('pointerdown', (e) => { ptr = e.pointerType; }, true);
  [...marks, ...rows].forEach((el) => {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') set(el.dataset.n); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') set(null); });
    // A mouse click keeps what hover lit; a tap toggles.
    el.addEventListener('click', () => set(ptr !== 'mouse' && cur === el.dataset.n ? null : el.dataset.n));
  });
  marks.forEach((m) => {
    m.addEventListener('focus', () => { let kb = true; try { kb = m.matches(':focus-visible'); } catch (e) {} if (kb) { byKey = true; set(m.dataset.n); } });
    m.addEventListener('blur', () => { if (byKey) { byKey = false; set(null); } });
  });
  document.addEventListener('click', (e) => { if (cur && !(e.target.closest && e.target.closest(SEL))) set(null); });
})();
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
