// Serveur en ligne de Monnet : les COMPTES des utilisateurs et la bibliothèque de SONS PARTAGÉS (« Communauté »).
// Node seul, sans paquet.
//
// Comptes : e-mail + mot de passe + nom unique (ou « Continuer avec Google »).
//  - Le nom est unique sans tenir compte des majuscules, accents, points, tirets et chiffres-sosies
//    (Luunox = luu.nox = 1uunox). Certains noms sont réservés (voir NOMS_RESERVES).
//  - Les mots de passe sont gardés « hachés » avec scrypt : illisibles, même pour nous.
//  - Une session = un jeton tiré au hasard, gardé seulement haché ici. Monnet l'envoie dans « Authorization: Bearer … ».
// Sons : il faut un compte pour partager ; tout le monde peut écouter. Les sons arrivent déjà convertis par Monnet
// (Ogg Opus, 30 s au plus, 1,5 Mo au plus).
//
// Variables (.env) : PORT (47960), DOSSIER (./donnees), CONFIANCE_PROXY=1 derrière Caddy, CLE_ADMIN (modération),
// NOMS_RESERVES (« nom:code,nom2:code2 » : le nom ne peut être pris qu'avec son code), GOOGLE_CLIENT_ID (connexion Google).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 47960;
const DOSSIER = path.resolve(process.env.DOSSIER || path.join(__dirname, 'donnees'));
const DOSSIER_SONS = path.join(DOSSIER, 'sons');
const CLE_ADMIN = process.env.CLE_ADMIN || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLES = process.env.GOOGLE_CLES || 'https://www.googleapis.com/oauth2/v3/certs'; // remplaçable pour les essais
const TAILLE_MAX = 1.5 * 1024 * 1024;
const TOTAL_MAX = 3 * 1024 * 1024 * 1024; // 3 Go de sons en tout
const CATEGORIES = new Set(['whoosh', 'impacts', 'basses', 'montees', 'transitions', 'glitch', 'ui', 'jeu', 'droles', 'percus', 'ambiance', 'voix', 'musique', 'autre']);
const SIGNALEMENTS_MAX = 3; // à partir de là, le son est caché en attendant qu'un admin regarde
const DUREE_SESSION = 365 * 86400000;

// ---------- Fichiers de données (écriture « sûre », un peu retardée) ----------

fs.mkdirSync(DOSSIER_SONS, { recursive: true });
const DOSSIER_MAJ = path.join(DOSSIER, 'maj');
fs.mkdirSync(DOSSIER_MAJ, { recursive: true });
function charger(nom) { try { return JSON.parse(fs.readFileSync(path.join(DOSSIER, nom), 'utf8')); } catch (_) { return {}; } }
const donnees = { 'index.json': charger('index.json'), 'comptes.json': charger('comptes.json'), 'sessions.json': charger('sessions.json'), 'maj-stats.json': charger('maj-stats.json') };
const telechargementsMaj = donnees['maj-stats.json']; // fichier → nombre de téléchargements (une fois par adresse et par jour)
const sons = donnees['index.json'], comptes = donnees['comptes.json'], sessions = donnees['sessions.json'];
const minuteries = {};
function sauver(nom = 'index.json') {
  clearTimeout(minuteries[nom]);
  minuteries[nom] = setTimeout(() => {
    const f = path.join(DOSSIER, nom);
    fs.writeFileSync(f + '.tmp', JSON.stringify(donnees[nom]), { mode: 0o600 });
    fs.renameSync(f + '.tmp', f);
  }, 300);
}

const hacher = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const ipDe = req => (process.env.CONFIANCE_PROXY === '1' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '?';
const nouvelId = () => crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(12, '0').slice(0, 12);

// Limites par adresse (et par compte) : tentatives de connexion, créations, dépôts, signalements
const compteurs = new Map();
function limite(cle, max, fenetreMs) {
  const maintenant = Date.now();
  const l = (compteurs.get(cle) || []).filter(t => maintenant - t < fenetreMs);
  if (l.length >= max) { compteurs.set(cle, l); return false; }
  l.push(maintenant);
  compteurs.set(cle, l);
  return true;
}
setInterval(() => {
  const m = Date.now();
  for (const [k, l] of compteurs) if (!l.some(t => m - t < 86400000)) compteurs.delete(k);
  let change = false;
  for (const [k, s] of Object.entries(sessions)) if (m - s.vu > DUREE_SESSION) { delete sessions[k]; change = true; }
  if (change) sauver('sessions.json');
}, 3600000).unref();

// ---------- Noms uniques ----------

// « Clé » d'un nom : deux noms qui se ressemblent trop ont la même clé (Luunox, luu.nox, LUUN0X, 1uunox…)
function cleNom(nom) {
  return String(nom).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[._\-\s]/g, '').replace(/0/g, 'o').replace(/[1i|!]/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/\$/g, 's');
}
// réservés : « nom:code » dans NOMS_RESERVES (prenable avec le code) ; les autres mots ci-dessous ne sont jamais prenables
const RESERVES = new Map(String(process.env.NOMS_RESERVES || '').split(',').map(x => x.trim()).filter(Boolean)
  .map(x => { const [n, c] = x.split(':'); return [cleNom(n), c || '']; }));
const INTERDITS = ['admin', 'administrateur', 'moderateur', 'modo', 'monnet', 'support', 'staff', 'officiel', 'systeme', 'anthropic', 'claude', 'invite'].map(cleNom);
function verifierNom(nom, code) {
  if (!/^[A-Za-z0-9_.-]{3,20}$/.test(nom)) return 'Nom : de 3 à 20 lettres (sans accent), chiffres, _ . ou -';
  const cle = cleNom(nom);
  for (const [r, c] of RESERVES) {
    if (cle.includes(r)) {
      if (cle !== r) return 'Ce nom ressemble trop à un nom réservé';
      if (!c || !code || !crypto.timingSafeEqual(Buffer.from(hacher(code)), Buffer.from(hacher(c)))) return { erreur: 'Ce nom est réservé. Si c\'est le tien, entre ton code de réservation.', reserve: true };
    }
  }
  // « Admin », « MonnetOfficiel », « lucas_admin »… interdits ; « badminton » permis
  if (INTERDITS.some(x => cle === x || cle.startsWith(x) || cle.endsWith(x))) return 'Ce nom n\'est pas autorisé';
  if (Object.values(comptes).some(c => c.cle === cle)) return 'Ce nom est déjà pris';
  return null;
}

// ---------- Mots de passe (scrypt) et sessions ----------

let hachagesEnCours = 0;
async function hacherMotDePasse(mdp, sel) {
  while (hachagesEnCours >= 2) await new Promise(r => setTimeout(r, 30)); // 16 Mo par calcul : deux à la fois au plus
  hachagesEnCours++;
  try {
    return await new Promise((res, rej) => crypto.scrypt(String(mdp).normalize('NFC'), sel, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
  } finally { hachagesEnCours--; }
}
function ouvrirSession(compte) {
  const jeton = crypto.randomBytes(32).toString('hex');
  sessions[hacher(jeton)] = { compte: compte.id, cree: Date.now(), vu: Date.now() };
  compte.derniere = Date.now();
  sauver('sessions.json'); sauver('comptes.json');
  return { session: jeton, compte: profil(compte) };
}
function compteDe(req) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(String(req.headers.authorization || ''));
  if (!m) return null;
  const s = sessions[hacher(m[1])];
  if (!s || !comptes[s.compte]) return null;
  if (Date.now() - s.vu > 3600000) { s.vu = Date.now(); sauver('sessions.json'); }
  return comptes[s.compte];
}
const profil = c => ({ id: c.id, nom: c.nom, email: c.email, google: !!c.google, motDePasse: !!c.hash, cree: c.cree });
const emailValide = e => typeof e === 'string' && e.length <= 254 && /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(e);
const parEmail = e => Object.values(comptes).find(c => c.email === String(e || '').trim().toLowerCase());

function creerCompte({ email, nom, hash = null, sel = null, google = null }) {
  const c = { id: nouvelId(), nom, cle: cleNom(nom), email, hash, sel, google, cree: Date.now(), derniere: Date.now() };
  comptes[c.id] = c;
  sauver('comptes.json');
  console.log(new Date().toISOString(), 'nouveau compte', c.id, JSON.stringify(nom), google ? '(Google)' : '');
  return c;
}

// ---------- Connexion Google (vérification du « jeton d'identité » signé par Google) ----------

let clesGoogle = { quand: 0, cles: [] };
async function clesDeGoogle() {
  if (Date.now() - clesGoogle.quand < 3600000 && clesGoogle.cles.length) return clesGoogle.cles;
  const r = await fetch(GOOGLE_CLES);
  if (!r.ok) throw new Error('Clés Google indisponibles');
  clesGoogle = { quand: Date.now(), cles: (await r.json()).keys || [] };
  return clesGoogle.cles;
}
async function verifierJetonGoogle(jwt) {
  const [h, p, s] = String(jwt || '').split('.');
  if (!h || !p || !s) throw new Error('Jeton Google invalide');
  const entete = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  const charge = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  if (entete.alg !== 'RS256') throw new Error('Jeton Google invalide');
  const jwk = (await clesDeGoogle()).find(k => k.kid === entete.kid);
  if (!jwk) throw new Error('Jeton Google invalide (clé inconnue)');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('Jeton Google invalide (signature)');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(charge.iss)) throw new Error('Jeton Google invalide (émetteur)');
  if (charge.aud !== GOOGLE_CLIENT_ID) throw new Error('Jeton Google invalide (destinataire)');
  if (!(charge.exp * 1000 > Date.now() - 60000)) throw new Error('Jeton Google expiré, réessaie');
  if (!charge.sub) throw new Error('Jeton Google invalide');
  return charge;
}

// ---------- HTTP ----------

function json(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-store' });
  res.end(b);
}
function lireCorps(req, max) {
  return new Promise((resolve, reject) => {
    const m = [];
    let n = 0;
    req.on('data', d => { n += d.length; if (n > max) { reject(Object.assign(new Error('Fichier trop gros (1,5 Mo au plus)'), { code: 413 })); req.destroy(); } else m.push(d); });
    req.on('end', () => resolve(Buffer.concat(m)));
    req.on('error', reject);
  });
}
async function lireJson(req) {
  try { return JSON.parse((await lireCorps(req, 64 * 1024)).toString('utf8') || '{}'); } catch (_) { return {}; }
}
const enTete = (req, k) => { try { return decodeURIComponent(String(req.headers[k] || '')); } catch (_) { return ''; } };
const nomAuteur = s => (comptes[s.compte] ? comptes[s.compte].nom : s.pseudo);
const public_ = s => ({ id: s.id, nom: s.nom, pseudo: nomAuteur(s), compte: s.compte || null, cat: s.cat, duree: s.duree, pics: s.pics, quand: s.quand, telechargements: s.telechargements || 0 });
const visibles = () => Object.values(sons).filter(s => !s.cache);
function supprimerSon(s) {
  fs.rmSync(path.join(DOSSIER_SONS, s.id + '.ogg'), { force: true });
  delete sons[s.id];
  sauver();
}

const serveur = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const ip = ipDe(req);

    if (req.method === 'GET' && p === '/') return json(res, 200, { nom: 'Monnet – sons partagés', sons: visibles().length, comptes: true, google: !!GOOGLE_CLIENT_ID, maj: true });

    // ===== Mises à jour de Monnet (fichiers déposés dans donnees/maj par le script de publication) =====
    // version.json (la dernière version et son empreinte SHA-256), montage-<version>.zip, Monnet-installation.zip
    if (req.method === 'GET' && p === '/maj/stats') {
      return json(res, 200, { telechargements: telechargementsMaj });
    }
    let mm = /^\/maj\/([A-Za-z0-9][A-Za-z0-9._-]{0,80})$/.exec(p);
    if (req.method === 'GET' && mm && /\.(json|zip)$/.test(mm[1])) {
      const f = path.join(DOSSIER_MAJ, mm[1]);
      let st;
      try { st = fs.statSync(f); } catch (_) { res.writeHead(404); return res.end(); }
      if (mm[1].endsWith('.zip') && limite('maj:' + ip + ':' + mm[1], 1, 86400000)) {
        telechargementsMaj[mm[1]] = (telechargementsMaj[mm[1]] || 0) + 1;
        sauver('maj-stats.json');
      }
      res.writeHead(200, {
        'Content-Type': mm[1].endsWith('.zip') ? 'application/zip' : 'application/json; charset=utf-8', 'Content-Length': st.size,
        'Cache-Control': mm[1] === 'version.json' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      return fs.createReadStream(f).pipe(res);
    }

    // ===== Comptes =====

    // nom libre ? (pour l'aide pendant la saisie)
    if (req.method === 'GET' && p === '/noms/libre') {
      if (!limite('nom:' + ip, 120, 600000)) return json(res, 429, { erreur: 'Doucement !' });
      const e = verifierNom(String(url.searchParams.get('nom') || ''), null);
      return json(res, 200, e ? { libre: false, raison: typeof e === 'string' ? e : e.erreur, reserve: !!(e && e.reserve) } : { libre: true });
    }

    // créer un compte : { email, motDePasse, nom, code? }
    if (req.method === 'POST' && p === '/comptes') {
      // 5 comptes CRÉÉS par heure et par adresse (les essais ratés, nom pris ou faute de frappe, ne comptent pas),
      // et 40 essais par heure en tout
      const crees = (compteurs.get('creer:' + ip) || []).filter(t => Date.now() - t < 3600000).length;
      if (crees >= 5 || !limite('essai-creer:' + ip, 40, 3600000)) return json(res, 429, { erreur: 'Trop de comptes créés d\'ici : réessaie plus tard.' });
      const b = await lireJson(req);
      const email = String(b.email || '').trim().toLowerCase(), nom = String(b.nom || '').trim(), mdp = String(b.motDePasse || '');
      if (!emailValide(email)) return json(res, 400, { erreur: 'Adresse e-mail invalide' });
      if (mdp.length < 8 || mdp.length > 200) return json(res, 400, { erreur: 'Mot de passe : 8 caractères au moins' });
      const e = verifierNom(nom, b.code);
      if (e) return json(res, 400, typeof e === 'string' ? { erreur: e } : e);
      if (parEmail(email)) return json(res, 409, { erreur: 'Un compte existe déjà avec cette adresse : connecte-toi.' });
      const sel = crypto.randomBytes(16).toString('hex');
      const c = creerCompte({ email, nom, sel, hash: await hacherMotDePasse(mdp, sel) });
      limite('creer:' + ip, 1000, 3600000);
      return json(res, 200, ouvrirSession(c));
    }

    // se connecter : { identifiant (e-mail ou nom), motDePasse }
    if (req.method === 'POST' && p === '/connexion') {
      const b = await lireJson(req);
      const id = String(b.identifiant || '').trim();
      const c = id.includes('@') ? parEmail(id) : Object.values(comptes).find(x => x.cle === cleNom(id));
      if (!limite('cnx:' + ip, 10, 900000) || (c && !limite('cnxc:' + c.id, 10, 900000))) return json(res, 429, { erreur: 'Trop d\'essais : attends 15 minutes.' });
      // même temps de calcul que le compte existe ou non
      const hash = await hacherMotDePasse(String(b.motDePasse || ''), c && c.sel ? c.sel : 'aucun-compte');
      if (!c || !c.hash || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(c.hash))) {
        return json(res, 401, { erreur: c && !c.hash ? 'Ce compte se connecte avec Google.' : 'E-mail (ou nom) ou mot de passe incorrect' });
      }
      return json(res, 200, ouvrirSession(c));
    }

    // connexion Google : { idToken, nom?, code? } → session, ou { besoinNom } pour un nouveau compte
    if (req.method === 'POST' && p === '/connexion/google') {
      if (!GOOGLE_CLIENT_ID) return json(res, 501, { erreur: 'La connexion Google n\'est pas encore activée' });
      if (!limite('ggl:' + ip, 20, 900000)) return json(res, 429, { erreur: 'Trop d\'essais : attends 15 minutes.' });
      const b = await lireJson(req);
      let g;
      try { g = await verifierJetonGoogle(b.idToken); } catch (e) { return json(res, 401, { erreur: e.message }); }
      let c = Object.values(comptes).find(x => x.google === g.sub);
      // Un compte existe déjà avec cet e-mail : on ne le relie à Google qu'avec son mot de passe
      // (sinon quelqu'un qui aurait créé un compte avec l'adresse d'un autre y ferait entrer le vrai propriétaire).
      const existant = !c && g.email ? parEmail(g.email) : null;
      if (existant) {
        if (!b.motDePasse) return json(res, 200, { lierMotDePasse: true, nom: existant.nom, email: existant.email });
        if (!limite('cnxc:' + existant.id, 10, 900000)) return json(res, 429, { erreur: 'Trop d\'essais : attends 15 minutes.' });
        const h = existant.hash ? await hacherMotDePasse(String(b.motDePasse), existant.sel) : '';
        if (!existant.hash || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(existant.hash))) return json(res, 401, { erreur: 'Mot de passe incorrect', lierMotDePasse: true, nom: existant.nom });
        existant.google = g.sub;
        sauver('comptes.json');
        c = existant;
      }
      if (c) return json(res, 200, ouvrirSession(c));
      const email = String(g.email || '').toLowerCase();
      if (!b.nom) return json(res, 200, { besoinNom: true, email });
      const e = verifierNom(String(b.nom).trim(), b.code);
      if (e) return json(res, 400, typeof e === 'string' ? { erreur: e, besoinNom: true } : { ...e, besoinNom: true });
      return json(res, 200, ouvrirSession(creerCompte({ email, nom: String(b.nom).trim(), google: g.sub })));
    }

    if (req.method === 'POST' && p === '/deconnexion') {
      const m = /^Bearer ([0-9a-f]{64})$/.exec(String(req.headers.authorization || ''));
      if (m) { delete sessions[hacher(m[1])]; sauver('sessions.json'); }
      return json(res, 200, { ok: true });
    }

    if (p === '/moi') {
      const c = compteDe(req);
      if (!c) return json(res, 401, { erreur: 'Pas connecté' });
      if (req.method === 'GET') return json(res, 200, { compte: profil(c) });
      // supprimer son compte (et ses sons) : mot de passe, ou son nom retapé pour un compte Google
      if (req.method === 'DELETE') {
        const b = await lireJson(req);
        if (!limite('sup:' + c.id, 10, 900000)) return json(res, 429, { erreur: 'Trop d\'essais : attends 15 minutes.' });
        let ok;
        if (c.hash) ok = crypto.timingSafeEqual(Buffer.from(await hacherMotDePasse(String(b.motDePasse || ''), c.sel)), Buffer.from(c.hash));
        else ok = cleNom(String(b.confirmation || '')) === c.cle;
        if (!ok) return json(res, 401, { erreur: c.hash ? 'Mot de passe incorrect' : 'Retape ton nom pour confirmer' });
        for (const s of Object.values(sons)) if (s.compte === c.id) supprimerSon(s);
        for (const [k, s] of Object.entries(sessions)) if (s.compte === c.id) delete sessions[k];
        delete comptes[c.id];
        sauver('comptes.json'); sauver('sessions.json');
        console.log(new Date().toISOString(), 'compte supprimé', c.id);
        return json(res, 200, { ok: true });
      }
    }

    // ===== Sons =====

    // liste : ?tri=recents|populaires&q=texte&cat=…&pseudo=…
    if (req.method === 'GET' && p === '/sons') {
      const q = String(url.searchParams.get('q') || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const cat = url.searchParams.get('cat'), pseudo = url.searchParams.get('pseudo');
      let l = visibles();
      if (cat) l = l.filter(s => s.cat === cat);
      if (pseudo) l = l.filter(s => cleNom(nomAuteur(s)) === cleNom(pseudo));
      if (q) l = l.filter(s => `${s.nom} ${nomAuteur(s)} ${s.cat}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
      if (url.searchParams.get('tri') === 'populaires') l.sort((a, b) => (b.telechargements || 0) - (a.telechargements || 0) || b.quand - a.quand);
      else l.sort((a, b) => b.quand - a.quand);
      return json(res, 200, { sons: l.slice(0, 500).map(public_) });
    }

    // fichier d'un son (compte un téléchargement par adresse et par jour)
    let m = /^\/sons\/([a-z0-9]{12})\.ogg$/.exec(p);
    if (req.method === 'GET' && m) {
      const s = sons[m[1]];
      if (!s || s.cache) { res.writeHead(404); return res.end(); }
      if (limite('dl:' + ip + ':' + s.id, 1, 86400000)) { s.telechargements = (s.telechargements || 0) + 1; sauver(); }
      const f = path.join(DOSSIER_SONS, s.id + '.ogg');
      const st = fs.statSync(f);
      res.writeHead(200, { 'Content-Type': 'audio/ogg', 'Content-Length': st.size, 'Cache-Control': 'public, max-age=86400' });
      return fs.createReadStream(f).pipe(res);
    }

    // dépôt d'un son (connecté) : corps = Ogg Opus ; en-têtes X-Nom, X-Categorie, X-Duree, X-Pics (JSON)
    if (req.method === 'POST' && p === '/sons') {
      const c = compteDe(req);
      if (!c) return json(res, 401, { erreur: 'Connecte-toi à ton compte Monnet pour partager un son.' });
      const nom = enTete(req, 'x-nom').trim().replace(/\s+/g, ' ');
      const cat = enTete(req, 'x-categorie'), duree = Number(req.headers['x-duree']);
      if (nom.length < 2 || nom.length > 40 || /[<>{}\\]/.test(nom)) return json(res, 400, { erreur: 'Nom du son : 2 à 40 caractères' });
      if (!CATEGORIES.has(cat)) return json(res, 400, { erreur: 'Catégorie inconnue' });
      if (!(duree > 0.05 && duree <= 30.5)) return json(res, 400, { erreur: 'Un son partagé dure 30 secondes au plus' });
      if (!limite('up:' + ip, 10, 3600000) || !limite('upj:' + c.id, 30, 86400000)) return json(res, 429, { erreur: 'Tu as partagé beaucoup de sons : réessaie plus tard.' });
      const corps = await lireCorps(req, TAILLE_MAX);
      if (corps.length < 200 || corps.slice(0, 4).toString('latin1') !== 'OggS' || !corps.includes(Buffer.from('OpusHead'))) return json(res, 400, { erreur: 'Fichier invalide' });
      const total = Object.values(sons).reduce((t, s) => t + (s.taille || 0), 0);
      if (total + corps.length > TOTAL_MAX) return json(res, 507, { erreur: 'La bibliothèque partagée est pleine pour l\'instant.' });
      let pics = [];
      try { pics = JSON.parse(enTete(req, 'x-pics') || '[]').slice(0, 64).map(v => Math.max(0, Math.min(1, Math.round(Number(v) * 100) / 100 || 0))); } catch (_) { /* pas de forme d'onde */ }
      const id = nouvelId();
      fs.writeFileSync(path.join(DOSSIER_SONS, id + '.ogg'), corps);
      sons[id] = { id, nom, compte: c.id, pseudo: c.nom, cat, duree: Math.round(duree * 1000) / 1000, pics, quand: Date.now(), taille: corps.length, ip: hacher('ip:' + ip), telechargements: 0, signalements: [] };
      sauver();
      console.log(new Date().toISOString(), 'nouveau son', id, JSON.stringify(nom), 'par', JSON.stringify(c.nom));
      return json(res, 200, { son: public_(sons[id]) });
    }

    // signaler un son (gros mot, son pas à lui, bruit horrible…)
    m = /^\/sons\/([a-z0-9]{12})\/signaler$/.exec(p);
    if (req.method === 'POST' && m) {
      const s = sons[m[1]];
      if (!s) return json(res, 404, { erreur: 'Son introuvable' });
      const qui = hacher('ip:' + ip);
      if (!limite('sig:' + qui, 30, 86400000)) return json(res, 429, { erreur: 'Trop de signalements aujourd\'hui' });
      if (!s.signalements.includes(qui)) s.signalements.push(qui);
      if (s.signalements.length >= SIGNALEMENTS_MAX) s.cache = true;
      sauver();
      return json(res, 200, { ok: true });
    }

    // retirer un son : son auteur (connecté) ou un admin (X-Admin)
    m = /^\/sons\/([a-z0-9]{12})$/.exec(p);
    if (req.method === 'DELETE' && m) {
      const s = sons[m[1]];
      if (!s) return json(res, 404, { erreur: 'Son introuvable' });
      const admin = CLE_ADMIN && String(req.headers['x-admin'] || '') === CLE_ADMIN;
      const c = compteDe(req);
      if (!admin && !(c && s.compte === c.id)) return json(res, 403, { erreur: 'Seul l\'auteur peut retirer ce son' });
      supprimerSon(s);
      return json(res, 200, { ok: true });
    }

    // ===== Admin (X-Admin) =====
    const estAdmin = CLE_ADMIN && req.headers['x-admin'] === CLE_ADMIN;
    if (req.method === 'GET' && p === '/admin/signales' && estAdmin) {
      return json(res, 200, { sons: Object.values(sons).filter(s => s.signalements.length).map(s => ({ ...public_(s), cache: !!s.cache, signalements: s.signalements.length })) });
    }
    m = /^\/admin\/remettre\/([a-z0-9]{12})$/.exec(p);
    if (req.method === 'POST' && m && estAdmin && sons[m[1]]) {
      sons[m[1]].cache = false; sons[m[1]].signalements = []; sauver();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p === '/admin/comptes' && estAdmin) {
      return json(res, 200, { nombre: Object.keys(comptes).length, comptes: Object.values(comptes).map(c => ({ id: c.id, nom: c.nom, google: !!c.google, cree: c.cree, derniere: c.derniere })) });
    }

    res.writeHead(404); res.end();
  } catch (e) {
    if (!res.headersSent) json(res, e.code === 413 ? 413 : 500, { erreur: e.code === 413 ? e.message : 'Erreur du serveur' });
    else res.end();
    if (e.code !== 413) console.error(e);
  }
});
serveur.requestTimeout = 60000;
serveur.listen(PORT, process.env.ADRESSE || '127.0.0.1', () => console.log(`Monnet en ligne (comptes + sons partagés) sur le port ${PORT} : ${Object.keys(comptes).length} comptes, ${visibles().length} sons${GOOGLE_CLIENT_ID ? ', Google activé' : ''}`));
