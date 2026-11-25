# Monnet

Studio de montage vidéo **gratuit** pour Windows, avec Claude et Monnet IA intégrés.

© 2026 luunox. Tous droits réservés. Monnet est gratuit, mais ce n'est pas un logiciel libre : voir [LICENSE](LICENSE).

## Installer sur un PC Windows

1. Télécharge le dossier complet : **[Monnet-installation.zip](https://github.com/tchiki-exe/montage/releases/download/installation/Montage-complet.zip)**
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

## Version actuelle : 0.8.1

- Les mises à jour viennent maintenant du serveur de Monnet (vérifiées par une empreinte de sécurité)
- Licence de Monnet et page « Monnet est-il sûr ? » (liens en bas de l'accueil)

Empreinte SHA-256 de `montage-0.8.1.zip` : `4f8201ed948624d4427587806f8cae57a688495acbeb9726a47b326dd0bc6cdf`
