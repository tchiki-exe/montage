# Monnet est-il sûr ? Tout ce qu'il fait, sans rien cacher

Monnet est un logiciel de montage gratuit pour Windows. Cette page dit exactement ce qu'il fait sur ton PC et ce qu'il envoie sur internet.
Les fichiers qui touchent à ton PC et à tes données sont lisibles dans le dossier [`code-visible`](code-visible) : chacun peut les vérifier.

## Ce que Monnet ne fait JAMAIS
- Pas de publicité, pas de traqueur, pas de revente de données.
- Pas d'enregistreur de touches, pas de minage, pas d'accès à distance à ton PC.
- **Pas besoin des droits administrateur** : Monnet s'installe dans ton dossier personnel.
- **Rien ne tourne quand Monnet est fermé** : son moteur s'arrête 30 secondes après la fermeture de la fenêtre.
- **Tes vidéos ne quittent jamais ton PC.** Seuls les sons que tu choisis de partager sont envoyés.

## Sur ton PC
- **Le moteur :** Node.js (le programme officiel de nodejs.org) fait tourner un petit serveur, joignable **uniquement depuis ton PC** (adresse 127.0.0.1). À chaque lancement, il est protégé par un code secret tiré au hasard. Personne sur ton réseau ni sur internet ne peut s'y connecter.
- **La fenêtre :** `Monnet.exe` (code source : `code-visible/exe/Monnet.cs`). Elle affiche Monnet avec WebView2, le moteur d'affichage de Microsoft déjà présent dans Windows, et range son profil dans le dossier de Monnet. Elle ne demande jamais les droits administrateur. Au premier lancement, elle ajoute l'icône « Monnet » sur le bureau et dans le menu Démarrer. Sur un vieux Windows sans WebView2, Monnet s'ouvre dans Edge.
- **`Monnet.exe` n'est pas signé** par un certificat payant. Windows peut donc afficher « Windows a protégé votre ordinateur » la première fois.
- **Les programmes que Monnet lance :**
  - `ffmpeg` / `ffprobe` : lire et fabriquer les vidéos ;
  - PowerShell : seulement pour afficher les fenêtres Windows « Ouvrir » et « Choisir un dossier » (voir `code-visible/serveur/fenetres.js`) ;
  - `wscript` : le lanceur `Montage.vbs` ;
  - `claude.exe` : seulement si Claude Code est installé et que tu l'utilises ;
  - `whisper` : les sous-titres automatiques, seulement si tu les demandes.
- **Tes fichiers :** Monnet ne lit que ceux que tu importes ou que tu choisis. Quand tu glisses un fichier dans la fenêtre, Windows ne donne pas son emplacement. Monnet le retrouve alors en cherchant un fichier de même nom, même taille et même date dans tes dossiers habituels (Vidéos, Bureau, Téléchargements…). Il ne regarde que les noms et les tailles, jamais le contenu des autres fichiers.
- **Le micro :** il ne sert qu'à la voix off, quand tu cliques sur le bouton micro. Windows et Edge te demandent ton accord la première fois.
- **Monnet IA :** elle apprend ton style **sur ton PC uniquement**, dans le fichier `monnet/style.json`. Il n'est jamais envoyé.

## Sur internet (et seulement dans ces cas-là)
| Quand | Vers où | Quoi |
|---|---|---|
| Au lancement (mises à jour) | serveur de Monnet `141-11-103-42.sslip.io` (en France), GitHub en secours | Monnet télécharge la dernière version. Avant de l'installer, il vérifie la **signature de l'auteur** (Ed25519, faite avec une clé qui ne quitte jamais son PC) et l'**empreinte SHA-256**. Même quelqu'un qui pirate le serveur ou GitHub ne peut donc pas faire installer sa propre version. Les mises à jour automatiques peuvent être coupées dans les Paramètres. |
| Compteur d'utilisateurs (accueil) | GitHub et le serveur de Monnet | Monnet lit seulement les compteurs publics de téléchargements. |
| Compte Monnet et sons partagés, si tu t'en sers | serveur de Monnet | Ton nom, ton e-mail et ton mot de passe. Le mot de passe est **chiffré avec scrypt** : illisible, même pour l'auteur. Les sons que tu partages deviennent publics. Tu peux supprimer ton compte et tes sons quand tu veux. |
| « Continuer avec Google », si tu cliques dessus | Google | La connexion se fait chez Google. Monnet reçoit seulement ton identifiant Google et ton e-mail. |
| Onglet Claude, ou demande compliquée à Monnet IA | Anthropic (Claude), avec **ton** abonnement Claude Code | Ton message, la description de ton montage, la liste de tes médias et, si besoin, quelques miniatures. Jamais tes fichiers vidéo. |
| Sous-titres automatiques (une seule fois) | GitHub (whisper.cpp) et Hugging Face | Téléchargement de l'outil de reconnaissance de la voix et de son modèle. |
| Détourage (une seule fois) | npm et Google (MediaPipe) | Téléchargement de l'outil de détourage. |
| Bibliothèque « Communauté » | serveur de Monnet | Liste et téléchargement des sons partagés. |

## Vérifier toi-même
- Lis les fichiers de [`code-visible`](code-visible) :
  - l'installation (`installer.ps1`) ;
  - la fenêtre (`exe/Monnet.cs`) et le lancement (`Montage.vbs`, `Montage.cmd`) ;
  - les mises à jour (`serveur/maj.js`) ;
  - les fenêtres Windows (`serveur/fenetres.js`) ;
  - ce qui est envoyé au serveur (`serveur/communaute.js`) ;
  - le serveur en ligne lui-même, qui gère les comptes et les mots de passe (`serveur-en-ligne/serveur.js`).
- L'empreinte SHA-256 de chaque version est publiée dans `version.json` et sur la page d'accueil du dépôt. Tu peux la comparer au fichier téléchargé : `Get-FileHash fichier.zip`.
- Chaque `version.json` est signé. La clé publique qui vérifie la signature est écrite en dur dans `code-visible/serveur/maj.js` (`CLES_MAJ`).
- Tu peux aussi envoyer le fichier téléchargé sur [VirusTotal](https://www.virustotal.com).

## Désinstaller
Supprime le dossier de Monnet et ses icônes (bureau et menu Démarrer). Si tu veux garder tes montages, mets d'abord de côté le dossier `projets`. Pour effacer ton compte en ligne : dans Monnet, ton compte → « Supprimer mon compte ».

---
© 2026 luunox. Tous droits réservés. Monnet est gratuit mais **ce n'est pas un logiciel libre**. Le code de `code-visible` est montré pour être vérifié, pas pour être réutilisé : voir [LICENSE](LICENSE).
