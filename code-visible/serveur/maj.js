// Mises à jour par GitHub : chaque version publiée est une « release » du dépôt, avec deux fichiers :
// version.json (numéro, nouveautés, empreinte) et montage.zip (le logiciel sans les montages).
// Les montages (projets/), les réglages et les outils (node, ffmpeg) ne sont jamais touchés.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { RACINE, lireJson, ecrireJson, executer } = require('./outils');

const FICHIER_VERSION = path.join(RACINE, 'version.json');
const FICHIER_REGLAGES = path.join(RACINE, 'reglages.json');
// ce qu'une mise à jour remplace
const ELEMENTS = ['app', 'serveur', 'Montage.vbs', 'Montage.cmd', 'icone.ico', 'LISEZMOI.txt', 'LICENCE.txt', 'version.json'];

function versionActuelle() {
  return lireJson(FICHIER_VERSION, { version: '0.0.0', depot: '', notes: '' });
}

// La copie où Claude développe le logiciel ne se met jamais à jour toute seule.
function estSource() {
  return fs.existsSync(path.join(RACINE, '.source'));
}

function reglages() { return lireJson(FICHIER_REGLAGES, {}); }
function majAuto() { return reglages().majAuto !== false; }
function changerMajAuto(v) {
  const r = reglages();
  r.majAuto = !!v;
  ecrireJson(FICHIER_REGLAGES, r);
}

function comparer(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

async function telecharger(url, ms) {
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Montage-mises-a-jour' } });
    if (!r.ok) throw new Error(`réponse ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  } finally {
    clearTimeout(minuterie);
  }
}

let derniere = null;

// D'où viennent les mises à jour : le serveur de Monnet (VPS) d'abord, GitHub en secours pendant la transition.
// (MONTAGE_MAJ_BASE remplace tout, pour les essais.) Chaque fichier téléchargé est vérifié par son empreinte SHA-256.
const SERVEUR_MAJ = process.env.MONTAGE_SERVEUR_MAJ || 'https://141-11-103-42.sslip.io/maj';
function sources(v) {
  if (process.env.MONTAGE_MAJ_BASE) {
    const b = process.env.MONTAGE_MAJ_BASE;
    return [{ nom: 'essai', version: `${b}/latest/download/version.json`, zip: n => `${b}/download/v${n}/montage.zip` }];
  }
  const l = [{ nom: 'monnet', version: `${SERVEUR_MAJ}/version.json`, zip: n => `${SERVEUR_MAJ}/montage-${n}.zip` }];
  if (v.depot) l.push({ nom: 'github', version: `https://github.com/${v.depot}/releases/latest/download/version.json`, zip: n => `https://github.com/${v.depot}/releases/download/v${n}/montage.zip` });
  return l;
}

// Signature des mises à jour : chaque version.json est signé (Ed25519) avec une clé secrète qui ne quitte jamais le PC
// de l'auteur. Même quelqu'un qui prendrait la main sur le serveur de Monnet ou sur GitHub ne pourrait donc pas faire
// installer sa propre version : sans la bonne signature, la mise à jour est refusée.
const CLES_MAJ = ['MCowBQYDK2VwAyEAxzyIqZVKkMkwCsHvRCPJIzvfh4WejWlDwRtk3ZjtrpE='];
if (process.env.MONTAGE_CLE_MAJ_ESSAI) CLES_MAJ.push(process.env.MONTAGE_CLE_MAJ_ESSAI); // essais seulement
const messageSigne = info => `MONNET-MAJ v1\n${info.version}\n${info.sha256}\n${info.taille}`;
function signatureValide(info) {
  if (!info || typeof info.signature !== 'string' || !/^[0-9a-f]{64}$/.test(String(info.sha256 || ''))) return false;
  return CLES_MAJ.some(cle => {
    try {
      return crypto.verify(null, Buffer.from(messageSigne(info)), { key: Buffer.from(cle, 'base64'), format: 'der', type: 'spki' }, Buffer.from(info.signature, 'base64'));
    } catch (_) { return false; }
  });
}

// Regarde s'il existe une version plus récente. Renvoie { actuelle, disponible: info|null }.
async function verifier(delai = 4000) {
  const v = versionActuelle();
  let derniereErreur = null;
  for (const s of sources(v)) {
    try {
      const buf = await telecharger(s.version, delai);
      const info = JSON.parse(buf.toString('utf8').replace(/^﻿/, ''));
      if (!/^\d+\.\d+\.\d+$/.test(String(info.version || ''))) throw new Error('version.json invalide');
      if (!signatureValide(info)) throw new Error('mise à jour non signée par l\'auteur de Monnet : refusée');
      info.source = s.nom;
      derniere = { actuelle: v.version, disponible: comparer(info.version, v.version) > 0 ? info : null, quand: Date.now() };
      return derniere;
    } catch (e) { derniereErreur = e; }
  }
  if (derniereErreur) throw derniereErreur;
  return { actuelle: v.version, disponible: null };
}

function derniereVerification() { return derniere; }

function renommerAvecEssais(de, vers) {
  for (let i = 0; ; i++) {
    try { fs.renameSync(de, vers); return; } catch (e) {
      if (i >= 20 || !['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e;
      const fin = Date.now() + 250;
      while (Date.now() < fin) { /* petite attente : un fichier est peut-être encore ouvert */ }
    }
  }
}

// Télécharge et installe la version « info ». En cas de souci, l'ancienne version est remise en place.
async function installer(info) {
  const v = versionActuelle();
  if (estSource()) throw new Error('Copie de développement : pas de mise à jour ici');
  if (!signatureValide(info)) throw new Error('Mise à jour non signée par l\'auteur de Monnet : refusée.');
  // d'abord la source qui a annoncé la version, puis les autres
  const liste = sources(v).sort((a, b) => (a.nom === info.source ? -1 : 0) - (b.nom === info.source ? -1 : 0));
  let zip = null, erreur = null;
  for (const s of liste) {
    try {
      const z = await telecharger(s.zip(info.version), 180000);
      if (z.length !== info.taille || crypto.createHash('sha256').update(z).digest('hex') !== info.sha256) throw new Error('empreinte différente');
      zip = z;
      break;
    } catch (e) { erreur = e; }
  }
  if (!zip) throw new Error('Le fichier téléchargé est abîmé ou introuvable (' + (erreur ? erreur.message : '?') + '), réessaie plus tard.');
  const tmp = path.join(RACINE, '.maj-en-cours');
  fs.rmSync(tmp, { recursive: true, force: true });
  const contenu = path.join(tmp, 'contenu');
  fs.mkdirSync(contenu, { recursive: true });
  const fichierZip = path.join(tmp, 'montage.zip');
  fs.writeFileSync(fichierZip, zip);
  const r = await executer('tar.exe', ['-xmf', fichierZip, '-C', contenu]);
  if (r.code !== 0) throw new Error('Décompression impossible : ' + r.erreurs.slice(0, 200));
  for (const e of ['app', 'serveur', 'version.json']) {
    if (!fs.existsSync(path.join(contenu, e))) throw new Error('Mise à jour incomplète (il manque ' + e + ')');
  }
  const ancien = path.join(RACINE, '.ancienne-version');
  fs.rmSync(ancien, { recursive: true, force: true });
  fs.mkdirSync(ancien, { recursive: true });
  const deplaces = [];
  const poses = [];
  try {
    for (const e of ELEMENTS) {
      const neuf = path.join(contenu, e);
      if (!fs.existsSync(neuf)) continue;
      const cible = path.join(RACINE, e);
      if (fs.existsSync(cible)) { renommerAvecEssais(cible, path.join(ancien, e)); deplaces.push(e); }
      renommerAvecEssais(neuf, cible);
      poses.push(e);
    }
  } catch (err) {
    // retour à l'ancienne version
    for (const e of poses) { try { fs.rmSync(path.join(RACINE, e), { recursive: true, force: true }); } catch (_) { /* rien */ } }
    for (const e of deplaces) { try { fs.renameSync(path.join(ancien, e), path.join(RACINE, e)); } catch (_) { /* rien */ } }
    throw new Error('Installation impossible, ancienne version gardée : ' + err.message);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Mise à jour installée : ${v.version} → ${info.version}`);
  return info.version;
}

// Relance le serveur (nouvelle version) puis arrête celui-ci.
function redemarrer(env = {}) {
  // mêmes options que le serveur actuel (ex. --use-system-ca pour les réseaux qui contrôlent les connexions)
  const p = spawn(process.execPath, [...process.execArgv, path.join(RACINE, 'serveur', 'index.js')], {
    cwd: RACINE, detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, ...env },
  });
  p.unref();
  setTimeout(() => process.exit(0), 300);
}

module.exports = {
  versionActuelle, estSource, majAuto, changerMajAuto, verifier, derniereVerification, installer, redemarrer, comparer,
};
