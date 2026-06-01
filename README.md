# 💅 Nagelsalon App – Installatiehandleiding

## Wat je nodig hebt
- Je Netlify-account (al aangemaakt)
- Je JSONbin-account (al aangemaakt)

---

## Stap 1 – JSONbin instellen

1. Ga naar [jsonbin.io](https://jsonbin.io) en log in
2. Klik op **API Keys** (linkermenu)
3. Klik op **+ Create Access Key** → kies **Master Key** → kopieer de key
4. Ga naar **Bins** → klik **+ Create Bin**
5. Vul als inhoud in: `{}` en klik Create
6. Kopieer het **Bin ID** uit de URL (het stuk na `/b/`)

## Stap 2 – Sleutels invullen in de app

Open het bestand `src/storage.js` en vervang:

```js
const JSONBIN_KEY = "JOUW_MASTER_KEY_HIER";   // ← jouw Master Key
const JSONBIN_BIN = "JOUW_BIN_ID_HIER";       // ← jouw Bin ID
```

## Stap 3 – App uploaden naar Netlify

### Optie A: via de Netlify website (makkelijkst)

1. Ga naar [netlify.com](https://netlify.com) en log in
2. Klik op **Add new site** → **Deploy manually**
3. Installeer eerst dependencies en bouw de app:
   - Open een terminal in de map `nagelsalon-app`
   - Run: `npm install`
   - Run: `npm run build`
   - Dit maakt een `dist/` map aan
4. Sleep de `dist/` map naar het Netlify upload-vlak
5. Klaar! Je krijgt een link zoals `https://jouw-app.netlify.app`

### Optie B: via GitHub (automatisch updaten)

1. Maak een gratis account op [github.com](https://github.com)
2. Maak een nieuw repository aan en upload deze map
3. Ga naar Netlify → **Add new site** → **Import from Git**
4. Koppel je GitHub repository
5. Build command: `npm run build`
6. Publish directory: `dist`
7. Klik Deploy — bij elke wijziging in GitHub bouwt Netlify automatisch opnieuw

## Stap 4 – Op de telefoon als app zetten

### iPhone (Safari):
1. Open de app-link in Safari
2. Tik op het **Delen**-icoon (vierkantje met pijl omhoog)
3. Scroll naar beneden → **Zet op beginscherm**
4. Geef de app een naam → **Toevoegen**

### Android (Chrome):
1. Open de app-link in Chrome
2. Tik op de drie puntjes rechtsboven
3. Tik op **Toevoegen aan startscherm**

---

## Sync tussen telefoon en tablet

Omdat de data in JSONbin staat (online), zien telefoon en tablet automatisch dezelfde data — zolang ze de app via dezelfde URL openen. Geen extra instelling nodig.

---

## Vragen of problemen?

Kopieer de foutmelding en vraag het aan Claude 😊
