# Installation (ou reparation) de Montage, le logiciel de montage avec Claude.
# A lancer avec :  powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/tchiki-exe/montage/main/installer.ps1 | iex"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$depot = 'tchiki-exe/montage'
$dossier = Join-Path $env:LOCALAPPDATA 'Programs\Montage'
$tmp = Join-Path $env:TEMP ('montage-installation-' + [guid]::NewGuid().ToString('N'))

function Etape($texte) { Write-Host ''; Write-Host "==> $texte" -ForegroundColor Green }
function Telecharger($url, $fichier) {
  for ($i = 1; $i -le 3; $i++) {
    try { Invoke-WebRequest $url -OutFile $fichier -UseBasicParsing; return } catch {
      if ($i -eq 3) { throw "Telechargement impossible : $url ($($_.Exception.Message))" }
      Start-Sleep -Seconds 2
    }
  }
}
function Verifier($fichier, $attendu) {
  $h = (Get-FileHash $fichier -Algorithm SHA256).Hash.ToLower()
  if ($h -ne $attendu.Trim().ToLower()) { throw "Fichier abime (empreinte differente) : $fichier" }
}

try {
  Write-Host 'Installation de Monnet' -ForegroundColor Green
  Write-Host "Dossier : $dossier"
  New-Item -ItemType Directory -Force $dossier, $tmp | Out-Null
  if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) { throw 'tar.exe introuvable : il faut Windows 10 (2018) ou plus recent.' }

  # 1. Le logiciel
  Etape 'Telechargement du logiciel'
  $fv = Join-Path $tmp 'version.json'
  Telecharger "https://github.com/$depot/releases/latest/download/version.json" $fv
  $info = Get-Content $fv -Raw -Encoding UTF8 | ConvertFrom-Json
  $zip = Join-Path $tmp 'montage.zip'
  Telecharger "https://github.com/$depot/releases/download/v$($info.version)/montage.zip" $zip
  Verifier $zip $info.sha256
  foreach ($e in 'app', 'serveur') { $c = Join-Path $dossier $e; if (Test-Path $c) { Remove-Item -Recurse -Force $c } }
  tar.exe -xmf $zip -C $dossier
  if ($LASTEXITCODE -ne 0) { throw 'Decompression du logiciel impossible' }
  Write-Host "Version $($info.version) installee."

  # 2. Node (le moteur du logiciel)
  $node = Join-Path $dossier 'outils\node\node.exe'
  if (-not (Test-Path $node)) {
    Etape 'Telechargement de Node (environ 30 Mo)'
    $base = 'https://nodejs.org/dist/latest-v22.x'
    $sommes = Join-Path $tmp 'SHASUMS256.txt'
    Telecharger "$base/SHASUMS256.txt" $sommes
    $ligne = Get-Content $sommes | Where-Object { $_ -match 'node-v[\d.]+-win-x64\.zip$' } | Select-Object -First 1
    if (-not $ligne) { throw 'Version de Node introuvable' }
    $hash, $nom = $ligne -split '\s+'
    $nz = Join-Path $tmp $nom
    Telecharger "$base/$nom" $nz
    Verifier $nz $hash
    $nd = Join-Path $tmp 'node'
    New-Item -ItemType Directory -Force $nd | Out-Null
    tar.exe -xmf $nz -C $nd
    $exe = Get-ChildItem $nd -Recurse -Filter node.exe | Select-Object -First 1
    New-Item -ItemType Directory -Force (Split-Path $node) | Out-Null
    Copy-Item $exe.FullName $node -Force
  }

  # 3. ffmpeg (lit et fabrique les videos)
  $ff = Join-Path $dossier 'outils\ffmpeg'
  if (-not ((Test-Path (Join-Path $ff 'ffmpeg.exe')) -and (Test-Path (Join-Path $ff 'ffprobe.exe')))) {
    Etape 'Telechargement de ffmpeg (environ 100 Mo, ca peut prendre un moment)'
    $fz = Join-Path $tmp 'ffmpeg.zip'
    $ok = $false
    try {
      Telecharger 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' $fz
      $sf = Join-Path $tmp 'ffmpeg.sha256'
      Telecharger 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256' $sf
      Verifier $fz ((Get-Content $sf -Raw).Trim() -split '\s+')[0]
      $ok = $true
    } catch {
      Write-Host "Premier site indisponible ($($_.Exception.Message)), j'essaie le second..." -ForegroundColor Yellow
    }
    if (-not $ok) {
      $nomB = 'ffmpeg-master-latest-win64-gpl.zip'
      Telecharger "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/$nomB" $fz
      $sb = Join-Path $tmp 'checksums.sha256'
      Telecharger 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/checksums.sha256' $sb
      $l = Get-Content $sb | Where-Object { $_ -match [regex]::Escape($nomB) } | Select-Object -First 1
      Verifier $fz (($l.Trim() -split '\s+')[0])
    }
    $fd = Join-Path $tmp 'ffmpeg'
    New-Item -ItemType Directory -Force $fd, $ff | Out-Null
    tar.exe -xmf $fz -C $fd
    foreach ($n in 'ffmpeg.exe', 'ffprobe.exe') {
      $x = Get-ChildItem $fd -Recurse -Filter $n | Select-Object -First 1
      Copy-Item $x.FullName (Join-Path $ff $n) -Force
    }
  }

  # 4. Raccourcis (bureau et menu Demarrer)
  Etape 'Creation des raccourcis'
  $sh = New-Object -ComObject WScript.Shell
  $cibles = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('Programs')) ''))
  foreach ($d in $cibles) {
    $l = $sh.CreateShortcut((Join-Path $d 'Monnet.lnk'))
    $l.TargetPath = "$env:WINDIR\System32\wscript.exe"
    $l.Arguments = '"' + (Join-Path $dossier 'Montage.vbs') + '"'
    $l.WorkingDirectory = $dossier
    $l.IconLocation = (Join-Path $dossier 'icone.ico') + ',0'
    $l.Description = 'Monnet : studio de montage avec Claude et Monnet IA'
    $l.Save()
  }

  # 5. Claude Code present ?
  $claude = @(
    (Join-Path $env:USERPROFILE '.local\bin\claude.exe'),
    (Join-Path $env:APPDATA 'npm\node_modules\@anthropic-ai\claude-code\cli.js')
  ) | Where-Object { Test-Path $_ }
  $ext = Get-ChildItem (Join-Path $env:USERPROFILE '.vscode\extensions') -Directory -Filter 'anthropic.claude-code-*' -ErrorAction SilentlyContinue
  if (-not $claude -and -not $ext -and -not (Get-Command claude.exe -ErrorAction SilentlyContinue)) {
    Write-Host ''
    Write-Host "Attention : Claude Code n'est pas installe sur ce PC. Le logiciel marche, mais l'onglet Claude ne pourra pas repondre." -ForegroundColor Yellow
  }

  Etape 'Termine ! Lancement de Monnet...'
  Start-Process "$env:WINDIR\System32\wscript.exe" -ArgumentList ('"' + (Join-Path $dossier 'Montage.vbs') + '"')
} catch {
  Write-Host ''
  Write-Host "Probleme : $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Rien de grave : tu peux relancer la meme commande pour reessayer.'
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
