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

## Planning koppelen aan Google Agenda

De server biedt een agenda-feed (.ics) met alle afspraken en geblokkeerde dagen
uit de planning. Google Agenda kan zich hierop abonneren en ververst dit zelf
automatisch (meestal binnen een paar uur na elke wijziging).

### Eenmalig instellen
1. Vul in `.env` een eigen `AGENDA_TOKEN` in (bijv. `isolde-agenda-2026-geheim`).
   Dit is een apart wachtwoord, los van `API_KEY` — alleen voor de agenda-link.
2. Herstart de server (`pm2 restart isolde-upload` of opnieuw opstarten).
3. De abonnee-link is:
   `https://jouw-nuc.staartje-xxxxx.ts.net/agenda.ics?token=isolde-agenda-2026-geheim`
4. Open Google Agenda op de computer (calendar.google.com) → links onder
   "Andere agenda's" op het **+** klikken → **Op URL abonneren** → plak de link → Toevoegen.
5. Klaar! Nieuwe en gewijzigde afspraken verschijnen vanzelf in de agenda
   (Google ververst abonnementen periodiek, dit kan tot enkele uren duren —
   niet direct zoals bij een live-koppeling).

Let op: dit werkt alleen van de planning-app náár Google Agenda (eenrichtingsverkeer).
Afspraken die rechtstreeks in Google Agenda worden gezet, komen niet in de app.

## Automatisch opstarten met Windows

Maak een snelkoppeling naar `start.bat` en zet die in:
`C:\Users\[gebruiker]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

Of gebruik de Taakplanner van Windows.

## Map op NAS gebruiken

Als je de NAS als netwerkschijf hebt gemount (bijv. als Z:), kun je gewoon
`UPLOAD_MAP=Z:\nagelsalon\bewijsstukken` gebruiken in `.env`.
