# Преместване на приложението в Cloudflare (безплатно)

English version below.

Сега приложението живее в Render. Безплатният Render „заспива“, когато никой не
го ползва, и първото отваряне след това чака около 30 секунди. Cloudflare Workers
Free не заспива, не иска карта и е безплатен. Приложението вече е готово за него:
четенето на съобщението и търсенето на офис стават в самия браузър, а сървърът
само предава заявките към Еконт.

Отнема около 15 минути. Можеш от телефона, но е по-лесно от MacBook-а.

## Какво НЕ трябва да правиш

- **Не въвеждай карта.** Безплатният план (Free) не иска карта. Ако някъде те
  подканят да добавиш начин на плащане, пропусни.
- **Не избирай платен план** (Workers Paid, 5 долара на месец) и не включвай
  платени услуги (R2, KV, D1, Images, Stream). Приложението не ги ползва.
- **Не купувай домейн.** Безплатният адрес `…workers.dev` е достатъчен.
- **Не пиши паролата си за Еконт в Cloudflare.** Приложението не пази тайни на
  сървъра. Паролата остава криптирана в твоя браузър, както и досега.
- **Не сменяй името на проекта.** То трябва да е точно `econt-shipper`.
- **Не спирай Render**, докато новият адрес не е работил добре поне няколко дни.

## Стъпка 1. Промените да влязат в main

Готово. Промените вече са в клона `main` в GitHub, а Render работи с новата
версия. Продължи направо със стъпка 2.

## Стъпка 2. Безплатен профил в Cloudflare

1. Отвори https://dash.cloudflare.com/sign-up
2. Въведи имейл и парола и натисни **Sign up**. Карта не се иска.
3. Отвори имейла от Cloudflare и потвърди адреса (линкът в писмото).
4. Ако те пита какво искаш да правиш или кой план, избери **Free**. Ако те пита
   за домейн (сайт), пропусни (**Skip**).

## Стъпка 3. Свържи GitHub хранилището (Workers Builds)

1. В менюто вляво отвори **Workers & Pages** (може да е под **Compute (Workers)**).
2. Натисни **Create** (Създай).
3. Избери **Import a repository** (Импортирай хранилище).
4. Натисни **Connect GitHub** и разреши достъп на Cloudflare до профила ти в
   GitHub. Стига достъп само до хранилището `econt-shipper`.
5. Избери хранилището **AhilOtTroy/econt-shipper**.
6. Попълни така:
   - **Project name** (име на проекта): `econt-shipper`
   - **Production branch** (клон): `main`
   - **Build command** (команда за построяване): остави празно
   - **Deploy command** (команда за качване): `npx wrangler deploy`
   - **Root directory** (папка): остави `/` (по подразбиране)
   - Променливи (variables) не са нужни.
7. Натисни **Create and deploy** (или **Save and Deploy**).
8. Изчакай 1 до 2 минути, докато пише **Success** (Успешно).

Ако Cloudflare те помоли да си избереш поддомейн за `workers.dev`, напиши кратка
дума, например името на магазина. Тя става част от адреса.

## Стъпка 4. Намери адреса

Адресът е като `https://econt-shipper.ТВОЯТ-ПОДДОМЕЙН.workers.dev`.
Виждаш го в Cloudflare: **Workers & Pages** → **econt-shipper** → горе вдясно
(**Visit**) или в раздела **Settings** → **Domains & Routes**.

## Стъпка 5. Изпробвай го

Новият адрес е нов сайт за браузъра. Настройките ти (PIN, вход в Еконт, подател)
и списъкът с пратки се пазят в браузъра за всеки адрес поотделно, затова:

1. Отвори новия адрес на MacBook-а.
2. Мини настройката отново: PIN, потребител и парола за e-econt.com, офис за
   подаване, обичайните настройки. Натисни **Проверка на входа**: трябва да пише
   „Входът работи. Налични са … офиса.“
3. Постави едно истинско съобщение от клиент и натисни прочитане. Провери име,
   телефон, офис и цена. Не е нужно да създаваш товарителница, ако не искаш.
4. На телефона отвори новия адрес и го добави на началния екран (Safari:
   **Сподели** → **Добави към началния екран**). Мини настройката и там.
5. Старите пратки остават в стария адрес (Render), докато го има. Ако искаш да
   следиш някоя от тях в новия, добави номера ѝ в раздела **Пратки**.

Всяка следваща промяна в `main` в GitHub се качва сама и в Cloudflare (и в
Render, докато го има).

## Стъпка 6. По-късно: спри Render

Когато новият адрес работи добре поне няколко дни:

1. Отвори https://dashboard.render.com и избери услугата **econt-shipper**.
2. **Settings** → най-долу **Suspend Web Service** (спиране, може да се пусне
   пак). Когато е ясно, че Render няма да трябва, можеш да избереш **Delete Web Service**.

## Ако нещо не стане

- **Build failed** с думата *name*: провери, че името на проекта е точно
  `econt-shipper` (Settings → Build → проектът трябва да съвпада с името в
  `wrangler.jsonc`).
- **Build failed** с *wrangler.jsonc not found*: провери, че в Cloudflare клонът
  (Production branch) е `main`.
- Страницата се отваря, но „Входът не работи“: същото е като в Render. Провери
  потребителското име и паролата за e-econt.com (главни и малки букви).

---

# Moving the app to Cloudflare (free)

Today the app runs on Render. Render's free plan falls asleep when nobody uses
it, so the first visit after a while waits about 30 seconds. Cloudflare Workers
Free never sleeps, needs no card and costs nothing. The app is ready for it:
reading the message and finding the office now happen in the browser, and the
server only passes requests on to Econt.

About 15 minutes. A phone works, the MacBook is easier.

## What NOT to do

- **Do not enter a card.** The Free plan needs none. If you are asked for a
  payment method anywhere, skip it.
- **Do not pick a paid plan** (Workers Paid, 5 dollars a month) and do not turn on
  paid products (R2, KV, D1, Images, Stream). The app uses none of them.
- **Do not buy a domain.** The free `…workers.dev` address is enough.
- **Do not type your Econt password into Cloudflare.** The app keeps no secrets
  on the server; the password stays encrypted in your browser, as before.
- **Do not rename the project.** It must be exactly `econt-shipper`.
- **Do not switch Render off** until you have used the new address for a few days.

## Step 1. Get the changes into main

Done. The changes are already on the GitHub branch `main`, and Render runs the
new version. Go straight to step 2.

## Step 2. A free Cloudflare account

1. Open https://dash.cloudflare.com/sign-up
2. Enter an email and a password, press **Sign up**. No card is asked for.
3. Confirm your email with the link Cloudflare sends.
4. If asked for a plan, choose **Free**. If asked to add a domain (site), **Skip**.

## Step 3. Connect the GitHub repository (Workers Builds)

1. In the left menu open **Workers & Pages** (it may sit under **Compute (Workers)**).
2. Press **Create**.
3. Choose **Import a repository**.
4. **Connect GitHub** and allow Cloudflare to see your GitHub account (access to
   the `econt-shipper` repository alone is enough).
5. Pick **AhilOtTroy/econt-shipper**.
6. Fill in:
   - **Project name**: `econt-shipper`
   - **Production branch**: `main`
   - **Build command**: leave empty
   - **Deploy command**: `npx wrangler deploy`
   - **Root directory**: leave `/`
   - No variables are needed.
7. Press **Create and deploy** (or **Save and Deploy**).
8. Wait 1 to 2 minutes until it says **Success**.

If Cloudflare asks you to pick a `workers.dev` subdomain, type a short word, for
example your shop's name. It becomes part of the address.

## Step 4. Find the address

It looks like `https://econt-shipper.YOUR-SUBDOMAIN.workers.dev`. In Cloudflare:
**Workers & Pages** → **econt-shipper** → **Visit** (top right), or **Settings** →
**Domains & Routes**.

## Step 5. Try it

To the browser the new address is a new website. Your setup (PIN, Econt login,
sender) and the parcels list are kept per address, so:

1. Open the new address on the MacBook.
2. Run the setup again: PIN, your e-econt.com username and password, drop-off
   office, usual options. **Test login** must say "Login works. … offices available."
3. Paste a real customer message and read it. Check name, phone, office and price.
   You do not have to create a waybill.
4. On the phone, open the new address and add it to the Home Screen (Safari:
   **Share** → **Add to Home Screen**). Run the setup there too.
5. Older parcels stay on the old (Render) address while it exists. To track one
   on the new address, add its number in the **Parcels** tab.

Every later change to `main` on GitHub goes to Cloudflare by itself (and to Render
while it exists).

## Step 6. Later: switch Render off

Once the new address has worked well for a few days:

1. Open https://dashboard.render.com and choose the **econt-shipper** service.
2. **Settings** → at the bottom **Suspend Web Service** (it can be resumed). When
   you are fully sure, you can later choose **Delete Web Service**.

## If something goes wrong

- **Build failed** mentioning the *name*: the project name must be exactly
  `econt-shipper`, the name in `wrangler.jsonc`.
- **Build failed** with *wrangler.jsonc not found*: check that the Production
  branch in Cloudflare is `main`.
- The page opens but the login fails: same as on Render. Check your e-econt.com
  username and password (upper and lower case matter).
