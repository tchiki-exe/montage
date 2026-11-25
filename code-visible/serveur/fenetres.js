// Fenêtres Windows « Ouvrir » et « Choisir un dossier ».
// Lancer PowerShell et charger les fenêtres Windows prend de 2 à 10 secondes sur un petit PC (et l'antivirus regarde
// à chaque fois) : on le fait UNE fois au démarrage, et ce PowerShell reste prêt en arrière-plan (environ 60 Mo).
// La fenêtre s'ouvre alors tout de suite. S'il a disparu, on retombe sur l'ancienne méthode (un PowerShell par fenêtre).
'use strict';
const { spawn } = require('child_process');
const { suivre, executer } = require('./outils');

// Une demande par ligne (JSON) sur l'entrée ; les chemins choisis sur la sortie, puis <<FIN>>.
// (Script passé tel quel avec -Command, sans « commande encodée » dont certains antivirus se méfient.)
const DEBUT = `
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::InputEncoding = [Text.Encoding]::UTF8
[System.Windows.Forms.Application]::EnableVisualStyles()
`;
const SCRIPT = DEBUT + `
[Console]::Out.WriteLine('PRET'); [Console]::Out.Flush()
while ($true) {
  $ligne = [Console]::In.ReadLine()
  if ($ligne -eq $null) { break }
  try {
    $q = $ligne | ConvertFrom-Json
    if ($q.sorte -eq 'essai') {
      # essai sans fenêtre : renvoie ce qui a été compris
      [Console]::Out.WriteLine([string]$q.titre + '|' + [string]$q.filtre + '|' + [string]$q.dossierInitial + '|' + [string][bool]$q.multi)
      [Console]::Out.WriteLine('<<FIN>>'); [Console]::Out.Flush()
      continue
    }
    $f = New-Object System.Windows.Forms.Form
    $f.TopMost = $true; $f.ShowInTaskbar = $false; $f.WindowState = 'Minimized'
    $f.Show(); $f.Hide()
    if ($q.sorte -eq 'dossier') {
      $d = New-Object System.Windows.Forms.FolderBrowserDialog
      $d.Description = [string]$q.titre
      if ($q.dossierInitial) { $d.SelectedPath = [string]$q.dossierInitial }
      if ($d.ShowDialog($f) -eq 'OK') { [Console]::Out.WriteLine($d.SelectedPath) }
    } else {
      $d = New-Object System.Windows.Forms.OpenFileDialog
      $d.Multiselect = [bool]$q.multi
      $d.Title = [string]$q.titre
      $d.Filter = [string]$q.filtre
      if ($q.dossierInitial) { $d.InitialDirectory = [string]$q.dossierInitial }
      if ($d.ShowDialog($f) -eq 'OK') { foreach ($n in $d.FileNames) { [Console]::Out.WriteLine($n) } }
    }
    $d.Dispose(); $f.Dispose()
  } catch { [Console]::Out.WriteLine('<<ERREUR>>' + $_.Exception.Message) }
  [Console]::Out.WriteLine('<<FIN>>'); [Console]::Out.Flush()
}
`;
const ARGS = ['-NoProfile', '-NonInteractive', '-STA', '-Command', SCRIPT];

let hote = null;

// Démarre (ou redémarre) le PowerShell gardé prêt.
function demarrer() {
  if (process.platform !== 'win32') return null;
  if (hote && !hote.mort) return hote;
  const p = suivre(spawn('powershell.exe', ARGS, { windowsHide: true }));
  const h = { p, mort: false, tampon: '', attente: null, chaine: Promise.resolve() };
  h.pret = new Promise((resolve, reject) => { h.surPret = resolve; h.surEchec = reject; });
  h.pret.catch(() => {});
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => {
    h.tampon += d;
    let i;
    while ((i = h.tampon.indexOf('\n')) >= 0) {
      const ligne = h.tampon.slice(0, i).replace(/\r$/, '');
      h.tampon = h.tampon.slice(i + 1);
      if (ligne === 'PRET') { h.surPret(); continue; }
      if (!h.attente) continue;
      if (ligne === '<<FIN>>') { const a = h.attente; h.attente = null; a.resolve(a.lignes); } else if (ligne.trim()) h.attente.lignes.push(ligne.trim());
    }
  });
  p.stderr.on('data', () => {});
  p.stdin.on('error', () => {});
  const fin = () => {
    h.mort = true;
    h.surEchec(new Error('PowerShell arrêté'));
    if (h.attente) { h.attente.reject(new Error('PowerShell arrêté')); h.attente = null; }
  };
  p.on('exit', fin);
  p.on('error', fin);
  hote = h;
  return h;
}

function parHote(q) {
  const h = demarrer();
  if (!h) return Promise.reject(new Error('Pas sous Windows'));
  // une seule fenêtre à la fois
  const tour = h.chaine.then(async () => {
    let minuterie;
    await Promise.race([h.pret, new Promise((_, rej) => { minuterie = setTimeout(() => rej(new Error('PowerShell trop lent')), 25000); })]);
    clearTimeout(minuterie);
    if (h.mort) throw new Error('PowerShell arrêté');
    return new Promise((resolve, reject) => {
      h.attente = { lignes: [], resolve, reject };
      h.p.stdin.write(JSON.stringify(q) + '\n');
    });
  });
  h.chaine = tour.catch(() => {});
  return tour;
}

// Secours : un PowerShell rien que pour cette fenêtre (l'ancienne méthode, plus lente).
async function seul(q) {
  const r = await executer('powershell.exe', ARGS, { entree: JSON.stringify(q) + '\n' });
  return r.sortie.split(/\r?\n/).map(s => s.trim()).filter(s => s && s !== 'PRET' && s !== '<<FIN>>');
}

async function demander(q) {
  let lignes;
  try { lignes = await parHote(q); } catch (e) {
    console.error('[fenêtres] PowerShell prêt indisponible, méthode lente :', e.message);
    lignes = await seul(q);
  }
  const err = lignes.find(l => l.startsWith('<<ERREUR>>'));
  if (err) throw new Error('Fenêtre impossible : ' + err.slice(10));
  return lignes;
}

// q : { titre, filtre, multi, dossierInitial } → liste de chemins (vide si annulé)
function ouvrirFichiers(q) { return demander({ sorte: 'fichiers', ...q }); }
// → chemin choisi, ou '' si annulé
async function choisirDossier(q) { return (await demander({ sorte: 'dossier', ...q }))[0] || ''; }

module.exports = { demarrer, ouvrirFichiers, choisirDossier, _demander: demander, _seul: seul };
