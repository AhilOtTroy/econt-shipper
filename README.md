# Econt shipper — paste → товарителница

Paste a customer's Bulgarian message, check the details, tap once, and get a ready
Econt shipment number (товарителница) — with your usual options. Works on phone or
desktop as a normal website.

## How it's built (and why it's safe to host)

The server is a **stateless proxy** — it stores **no credentials and no database**.
Your Econt login, sender info and default options are saved **in your own browser**,
and your Econt **password is encrypted with a PIN** you choose. Each request decrypts
in memory and the server just relays it to Econt over HTTPS. So even if someone finds
the public URL, they can't touch your Econt account — they'd just get their own empty
setup screen.

## Run locally (Windows)

1. Double-click [`start.bat`](start.bat) → opens `http://localhost:5005`.
2. First time: the **setup wizard** asks for a PIN → your Econt login (with a
   **Test login** button) → your sender office → your usual options. Done.
3. Daily use: paste the message → **Preview →** → check recipient/office/price →
   **✓ Create shipment number** → copy it / open the label PDF.

## Put it on your phone (deploy free, works with your PC off)

Hosted on **Render** (free tier), one time:

1. Put this folder in a **GitHub repo** (new repo → upload these files).
2. Go to **[render.com](https://render.com)** → **New +** → **Blueprint** →
   connect that repo. Render reads [`render.yaml`](render.yaml) and deploys. No
   settings to fill in (there are no server secrets).
3. You get an HTTPS link like `https://econt-shipper-xxxx.onrender.com`.
4. Open that link **on your phone**, run the setup wizard, and add it to your home
   screen. Anyone you share the link with just runs their own setup — their data
   stays in their own browser.

> Notes: Render's free tier sleeps after inactivity, so the first open after a while
> takes ~30s to wake. The chosen region is Frankfurt (closest to Bulgaria).

## Demo vs Production

- **Demo** (`iasp-dev` / `1Asp-dev`) creates nothing real — good for trying it out,
  but has only ~585 test offices.
- **Production** uses your normal econt.com login (username, exact case) and gives the
  full office list (~1000+) and real shipments. Every "Create" is billed by Econt.

## Security notes

- Your Econt password lives only in **your browser**, encrypted with your PIN
  (PBKDF2 + AES-GCM). It is sent to the server **only** to relay a request to Econt,
  over HTTPS, and is never stored server-side.
- The PIN both locks the app on your device and is the key to that encryption — if you
  forget it, use **Forget this device** and set up again.
- Treat the COD amount carefully: the app blocks creating a label if COD is on but the
  amount is blank.

## Files

| File | What it does |
|------|--------------|
| `server.js` | Stateless proxy + office ranking (no dependencies) |
| `econt.js` | Econt API calls + builds the ShippingLabel payload |
| `parser.js` | Parses the pasted message + ranks office matches |
| `public/` | The web app: setup wizard, PIN lock, paste→create UI |
| `render.yaml` | One-click Render deploy config |
