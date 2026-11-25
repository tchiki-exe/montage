# Monnet

Studio de montage vidéo avec Claude et Monnet IA intégrés.

## Installer sur un PC Windows

1. Télécharge le dossier complet : **[Montage-complet.zip](https://github.com/tchiki-exe/montage/releases/download/installation/Montage-complet.zip)**
2. Clic droit sur le fichier téléchargé → **Extraire tout…** → choisis où le mettre (par exemple Documents) → **Extraire**.
3. Ouvre le dossier **Montage** et double-clique sur **Montage.vbs**. Une icône Montage est ajoutée sur le bureau.
   (Si Montage.vbs est bloqué, double-clique sur **Montage.cmd** et laisse la fenêtre noire ouverte.)

Ensuite le logiciel se met à jour tout seul (ça se règle sur son écran d'accueil).

Autre méthode (si ton antivirus la laisse passer) : touches Windows + R, puis :

```
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/tchiki-exe/montage/main/installer.ps1 | iex"
```

Version actuelle : **0.6.0**

- Nouvel onglet Sons : 94 bruitages (whoosh, impacts, boums, montées, glitch, jeu vidéo, drôles…) à écouter d'un clic et à glisser sur la ligne de temps
- Favoris ★ et « Mes sons » pour garder tes propres bruitages dans tous tes montages
- Correction : la suppression d'un montage était parfois refusée
