# Monnet

Studio de montage vidéo **gratuit** pour Windows, avec Claude et Monnet IA intégrés.

© 2026 luunox. Tous droits réservés. Monnet est gratuit, mais ce n'est pas un logiciel libre : voir [LICENSE](LICENSE).

## Installer sur un PC Windows

1. Télécharge **[Monnet-installation.zip](https://141-11-103-42.sslip.io/maj/Monnet-installation.zip)** (environ 110 Mo).
2. Clic droit sur le fichier → **Extraire tout…** → choisis où le mettre (par exemple Documents) → **Extraire**.
3. Dans le dossier **Montage**, double-clique sur **Monnet.exe**. Au premier lancement, Monnet ajoute son icône sur le bureau et dans le menu Démarrer.
   La première fois, Windows peut afficher « Windows a protégé votre ordinateur » : Monnet est un petit logiciel indépendant, pas encore signé par un certificat payant. Clique sur **Informations complémentaires** puis **Exécuter quand même**.

Ensuite Monnet se met à jour tout seul. Pas besoin d'être administrateur. Pour le désinstaller : supprime le dossier **Montage** et l'icône (garde le dossier **projets** si tu veux tes montages).

Autre méthode (si ton antivirus la laisse passer) : touches Windows + R, puis :

```
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/tchiki-exe/montage/main/installer.ps1 | iex"
```

## Est-ce que Monnet est sûr ?

Tout est expliqué dans **[SECURITE.md](SECURITE.md)** : ce que Monnet fait sur ton PC, ce qu'il envoie sur internet (et ce qu'il n'envoie jamais), et comment le vérifier.
Les fichiers qui touchent à ton PC et à tes données sont lisibles dans **[code-visible](code-visible)** : installation, lancement, mises à jour, fenêtres Windows, connexion au serveur, et le serveur en ligne qui gère les comptes.

## Version actuelle : 0.9.0

- Monnet devient un vrai logiciel : sa propre fenêtre (Monnet.exe) et son icône, plus de fenêtre Edge
- Installation plus simple : extraire le dossier puis double-clic sur Monnet.exe (il crée ses icônes tout seul)

Empreinte SHA-256 de `montage-0.9.0.zip` : `144cbc22f3579130c7a20771bbe9b1dfd41c474ac72c1390aef40c538d649de1`

Empreinte SHA-256 de `Monnet-installation.zip` : `c26b0714251f71043b19d5afdd62619d0b64a91094808462d450641c978ebbd2` (vérifie avec `Get-FileHash Monnet-installation.zip`)

Chaque mise à jour est signée : Monnet refuse toute version qui n'est pas signée par son auteur.
