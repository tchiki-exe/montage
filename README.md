# Montage

Logiciel de montage vidéo avec Claude intégré.

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

Version actuelle : **0.3.0**

- Visionneuse source (comme DaVinci) : double-clic sur une vidéo, marque le passage avec I et O, puis « , » pour l'insérer, « . » pour écraser ou E pour l'ajouter à la fin
- Moments forts : le logiciel repère les passages où le son s'emballe dans tes longs enregistrements
- Mini ligne de temps sous le montage : tout ton montage en petit, clique pour t'y déplacer
- Touches Q et W : coupe avant ou après la tête de lecture et recolle
- Étalonnage façon DaVinci (ombres, tons moyens, lumières), 6 looks tout faits et filtres LUT .cube (6 fournis, tu peux importer les tiens)
- Export : volume adapté à TikTok et YouTube (−14 LUFS)
- Capture d'image en PNG pleine qualité pour tes miniatures (bouton à côté du plein écran)
