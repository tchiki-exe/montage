# Monnet

Studio de montage vidéo **gratuit** pour Windows, avec Claude et Monnet IA intégrés.

© 2026 luunox. Tous droits réservés. Monnet est gratuit, mais ce n'est pas un logiciel libre : voir [LICENSE](LICENSE).

## Installer sur un PC Windows

1. Télécharge le dossier complet : **[Monnet-installation.zip](https://141-11-103-42.sslip.io/maj/Monnet-installation.zip)**
2. Clic droit sur le fichier téléchargé → **Extraire tout…** → choisis où le mettre (par exemple Documents) → **Extraire**.
3. Ouvre le dossier **Montage** et double-clique sur **Montage.vbs**. Une icône Monnet est ajoutée sur le bureau.
   (Si Montage.vbs est bloqué, double-clique sur **Montage.cmd** et laisse la fenêtre noire ouverte.)

Ensuite le logiciel se met à jour tout seul (ça se règle dans ses Paramètres).

Autre méthode (si ton antivirus la laisse passer) : touches Windows + R, puis :

```
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/tchiki-exe/montage/main/installer.ps1 | iex"
```

## Est-ce que Monnet est sûr ?

Tout est expliqué dans **[SECURITE.md](SECURITE.md)** : ce que Monnet fait sur ton PC, ce qu'il envoie sur internet (et ce qu'il n'envoie jamais), et comment le vérifier.
Les fichiers qui touchent à ton PC et à tes données sont lisibles dans **[code-visible](code-visible)** : installation, lancement, mises à jour, fenêtres Windows, connexion au serveur, et le serveur en ligne qui gère les comptes.

## Version actuelle : 0.8.2

- Mises à jour signées : Monnet refuse toute version qui n'est pas signée par son auteur (même si quelqu'un pirate le serveur)

Empreinte SHA-256 de `montage-0.8.2.zip` : `d9e5743cc15a3f3c409e6467d81e83f6f07ffe624c76fe459fd73a412eaf9809`

Empreinte SHA-256 de `Monnet-installation.zip` : `a175ae84aab3871c92532cbca26647aff74cd2253a35151beff570674513a6c4` (vérifie avec `Get-FileHash Monnet-installation.zip`)

Chaque mise à jour est signée : Monnet refuse toute version qui n'est pas signée par son auteur.
