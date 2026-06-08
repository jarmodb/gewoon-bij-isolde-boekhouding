# Gewoon bij Isolde — Upload server

Draait op de NUC, bereikbaar via Tailscale Funnel.

## Eerste keer instellen

### 1. Node.js installeren op de NUC
Download en installeer Node.js van https://nodejs.org (LTS versie)

### 2. Server installeren
Open PowerShell in deze map en voer uit:
```
npm install
```

### 3. Instellingen aanmaken
Kopieer `.env.voorbeeld` naar `.env` en vul in:
- `API_KEY` — verzin een wachtwoord, bijv. `nagels2026geheim`
- `UPLOAD_MAP` — map op de NUC of NAS, bijv. `Z:\nagelsalon\bewijsstukken`

### 4. Tailscale installeren
Download van https://tailscale.com/download en log in.

### 5. Server starten
```
node server.js
```

### 6. Tailscale Funnel starten
```
tailscale funnel --bg 3747
```
Je krijgt een URL zoals: `https://jouw-nuc.staartje-xxxxx.ts.net`

### 7. URL en API-key invullen in de app
Ga in de app naar **Meer → Bewijsstukken** en vul in:
- Server URL: `https://jouw-nuc.staartje-xxxxx.ts.net`
- API-key: het wachtwoord dat je in `.env` hebt ingevuld

## Bewijsstukken delen met de boekhouder

In de Excel-export voor de boekhouder ("Meer → Exporteren") staan bij elke
uitgave klikbare links om het bewijsstuk te bekijken of te downloaden. Om te
voorkomen dat de boekhouder daarmee ook bestanden zou kunnen uploaden, kun je
een aparte **alleen-lezen viewer-sleutel** instellen:

1. Verzin een eigen `VIEWER_KEY` (bijv. `boekhouder-bonnen-2026`) en zet die in `.env`
2. Herstart de server
3. Vul dezelfde sleutel in via de app: **Meer → Bewijsstukken (NUC) → Viewer-sleutel**

Vanaf dat moment gebruiken de links in de export deze sleutel — de boekhouder
kan bonnen bekijken en downloaden, maar nooit nieuwe bestanden plaatsen of
bestaande wijzigen. Laat je dit veld leeg, dan werken de links nog steeds,
maar dan via de gewone (volledige) API-key.

## Automatisch opstarten met Windows

Maak een snelkoppeling naar `start.bat` en zet die in:
`C:\Users\[gebruiker]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

Of gebruik de Taakplanner van Windows.

## Map op NAS gebruiken

Als je de NAS als netwerkschijf hebt gemount (bijv. als Z:), kun je gewoon
`UPLOAD_MAP=Z:\nagelsalon\bewijsstukken` gebruiken in `.env`.
