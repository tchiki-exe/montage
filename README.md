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

Version actuelle : **0.2.4**

- Corrigé : la bande verte en haut de l'aperçu (elle n'a jamais été dans la vidéo exportée)
- Nouvelle option « Aperçu par la carte graphique » dans les réglages (clique dans le vide de la ligne de temps), décochée par défaut
