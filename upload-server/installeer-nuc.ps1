# Gewoon bij Isolde - volledige installatie van de upload-server op een NUC.
# Start dit via installeer-nuc.bat (dubbelklik).
#
# Doet alles in een keer:
#   1. Node.js en Tailscale installeren (via winget)
#   2. Server kopieren naar C:\IsoldeServer en afhankelijkheden installeren
#   3. .env aanmaken (sleutels + uploadmap)
#   4. Server automatisch laten starten bij inloggen + nachtelijke back-up inplannen
#   5. Tailscale koppelen en Funnel aanzetten

$ErrorActionPreference = "Stop"

function Stap($t)       { Write-Host ""; Write-Host "== $t" -ForegroundColor Magenta }
function Ok($t)         { Write-Host "   OK: $t" -ForegroundColor Green }
function Waarschuw($t)  { Write-Host "   LET OP: $t" -ForegroundColor Yellow }
function Ververs-Pad    { $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User") }

# Adminrechten nodig voor het installeren van programma's
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

try {
  Write-Host ""
  Write-Host "Gewoon bij Isolde - upload-server installeren" -ForegroundColor Magenta

  $doel = "C:\IsoldeServer"
  $poort = 3747

  # -- 1. Programma's --
  Stap "1/6  Node.js en Tailscale installeren"
  Ververs-Pad
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget niet gevonden. Installeer 'App Installer' uit de Microsoft Store en start dit opnieuw."
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    Ververs-Pad
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js installeren is mislukt. Installeer het handmatig van https://nodejs.org en start dit opnieuw." }
  $node = (Get-Command node).Source
  Ok "Node.js: $(& $node --version)"

  $ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
  if (-not $ts -and -not (Test-Path "C:\Program Files\Tailscale\tailscale.exe")) {
    winget install --id Tailscale.Tailscale -e --silent --accept-package-agreements --accept-source-agreements
    Ververs-Pad
  }
  if (-not $ts) { $ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source }
  if (-not $ts) { $ts = "C:\Program Files\Tailscale\tailscale.exe" }
  if (-not (Test-Path $ts)) { throw "Tailscale installeren is mislukt. Installeer het handmatig van https://tailscale.com/download en start dit opnieuw." }
  Ok "Tailscale gevonden"

  # -- 2. Bestanden --
  Stap "2/6  Server kopieren naar $doel"
  $bron = (Resolve-Path $PSScriptRoot).Path.TrimEnd('\')
  if ($bron -ne $doel) {
    New-Item -ItemType Directory -Force $doel | Out-Null
    robocopy $bron $doel /E /XD node_modules uploads /NFL /NDL /NJH /NJS | Out-Null
  }
  Ok "Bestanden staan in $doel"

  # -- 3. Instellingen (.env) --
  Stap "3/6  Instellingen"
  $envPad = Join-Path $doel ".env"
  if (Test-Path $envPad) {
    Ok ".env bestaat al en wordt gebruikt"
  } else {
    Write-Host "   Gebruik dezelfde sleutels als op de oude NUC: dan hoef je in de app niets aan te passen."
    $api = ""
    while (-not $api) { $api = (Read-Host "   API_KEY (verplicht)").Trim() }
    $viewer = (Read-Host "   VIEWER_KEY (alleen-lezen sleutel voor de boekhouder, leeg = uit)").Trim()
    $backupMail = (Read-Host "   BACKUP_EMAIL (Supabase-account voor de nachtelijke back-up, leeg = overslaan)").Trim()
    $backupWw = ""
    if ($backupMail) { $backupWw = (Read-Host "   BACKUP_PASSWORD").Trim() }
    $map = (Read-Host "   Map voor bonnetjes en facturen [C:\nagelsalon\bewijsstukken]").Trim()
    if (-not $map) { $map = "C:\nagelsalon\bewijsstukken" }
    $regels = @("API_KEY=$api", "VIEWER_KEY=$viewer", "UPLOAD_MAP=$map", "BACKUP_EMAIL=$backupMail", "BACKUP_PASSWORD=$backupWw")
    Set-Content -Path $envPad -Value $regels -Encoding ascii
    Ok ".env aangemaakt"
  }
  $uploadMap = ((Get-Content $envPad | Where-Object { $_ -match '^\s*UPLOAD_MAP\s*=' } | Select-Object -First 1) -replace '^\s*UPLOAD_MAP\s*=\s*','').Trim().Trim('"')
  if ($uploadMap) {
    try { New-Item -ItemType Directory -Force $uploadMap | Out-Null; Ok "Uploadmap: $uploadMap" }
    catch { Waarschuw "Uploadmap $uploadMap is nu niet bereikbaar (NAS niet gekoppeld?). De server maakt hem aan zodra hij beschikbaar is." }
  }

  # -- 4. Afhankelijkheden --
  Stap "4/6  Afhankelijkheden installeren (kan een paar minuten duren)"
  Push-Location $doel
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install is mislukt." }
  Pop-Location
  Ok "Klaar"

  # -- 5. Automatisch starten + back-up --
  Stap "5/6  Automatisch starten en nachtelijke back-up inplannen"
  $gebruiker = "$env:USERDOMAIN\$env:USERNAME"
  $principal = New-ScheduledTaskPrincipal -UserId $gebruiker -LogonType Interactive -RunLevel Limited

  function Maak-Taak($naam, $scriptNaam, $trigger, $instellingen) {
    $arg = "-NoProfile -WindowStyle Hidden -Command `"Set-Location '$doel'; & '$node' $scriptNaam *>> '$doel\${scriptNaam}.log'`""
    $actie = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg -WorkingDirectory $doel
    Register-ScheduledTask -TaskName $naam -Action $actie -Trigger $trigger -Settings $instellingen -Principal $principal -Force | Out-Null
  }

  $serverInst = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  Maak-Taak "Isolde Upload Server" "server.js" (New-ScheduledTaskTrigger -AtLogOn -User $gebruiker) $serverInst

  $backupInst = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
  Maak-Taak "Isolde Nachtelijke Backup" "backup.js" (New-ScheduledTaskTrigger -Daily -At "00:00") $backupInst
  Ok "Taken aangemaakt (server start bij inloggen, back-up elke nacht om 00:00)"

  # Een server mag niet in slaapstand
  powercfg /change standby-timeout-ac 0 | Out-Null
  powercfg /change hibernate-timeout-ac 0 | Out-Null
  Ok "Slaapstand uitgezet (netstroom)"

  # Oude server stoppen als die nog draait en nieuwe starten
  Stop-ScheduledTask -TaskName "Isolde Upload Server" -ErrorAction SilentlyContinue
  Start-ScheduledTask -TaskName "Isolde Upload Server"
  Start-Sleep -Seconds 5
  try {
    $h = Invoke-RestMethod "http://localhost:$poort/health" -TimeoutSec 5
    Ok "Server draait ($($h.status))"
  } catch {
    Waarschuw "Server reageert nog niet op poort $poort. Kijk in $doel\server.js.log"
  }

  # Test-backup
  Push-Location $doel
  & $node backup.js
  if ($LASTEXITCODE -ne 0) { Waarschuw "Test-backup mislukt (zie melding hierboven)." }
  Pop-Location

  # -- 6. Tailscale --
  Stap "6/6  Tailscale koppelen"
  Write-Host "   Wil je hetzelfde adres houden als de oude NUC? Verwijder de oude dan eerst op"
  Write-Host "   https://login.tailscale.com/admin/machines en geef deze computer dezelfde naam."
  $hn = (Read-Host "   Naam in Tailscale (leeg = niet wijzigen)").Trim()
  Write-Host "   Er opent zo nodig een inlogpagina in de browser. Log in en kom hier terug."
  if ($hn) { & $ts up --hostname=$hn } else { & $ts up }
  & $ts funnel --bg $poort
  Write-Host ""
  & $ts funnel status

  Write-Host ""
  Write-Host "Klaar!" -ForegroundColor Green
  Write-Host "  - Staat hierboven een adres (https://....ts.net)? Vul dat in de app in bij Meer > Bewijsstukken (NUC)"
  Write-Host "    als het anders is dan het oude adres. Dezelfde API_KEY betekent dat je die niet hoeft aan te passen."
  Write-Host "  - Zie je een melding over Funnel inschakelen? Open de link, sta het toe en start dit bestand opnieuw."
  Write-Host "  - Zet automatisch inloggen aan (netplwiz), anders start de server pas na handmatig inloggen."
  Write-Host "  - Vergeet niet de oude bonnetjes en data-backups naar de uploadmap te kopieren."
}
catch {
  Write-Host ""
  Write-Host "FOUT: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""
Read-Host "Druk op Enter om te sluiten"
