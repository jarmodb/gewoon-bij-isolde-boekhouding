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

## Automatisch opstarten met Windows

Maak een snelkoppeling naar `start.bat` en zet die in:
`C:\Users\[gebruiker]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

Of gebruik de Taakplanner van Windows.

## Map op NAS gebruiken

Als je de NAS als netwerkschijf hebt gemount (bijv. als Z:), kun je gewoon
`UPLOAD_MAP=Z:\nagelsalon\bewijsstukken` gebruiken in `.env`.
