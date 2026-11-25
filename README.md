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

Version actuelle : **0.7.0**

- Import ultra rapide : la fenêtre Importer s'ouvre tout de suite, et un fichier glissé (même énorme) est retrouvé sur ton disque sans recopie ; lâche-le n'importe où, même sur l'accueil
- Voix off : enregistre ta voix au micro pendant que le montage se joue
- Parle à Monnet IA : explique-lui ce que tu veux (coupe plus vite, que des zooms, ajoute des bruitages…)
- Sélection au cadre à la souris, effets faciles à retirer (badge fx cliquable, poubelle), nouvelles flèches pour les nombres
- Couper ne fait plus de petit saut à l'image
- Compteur d'utilisateurs sur l'accueil, Monnet utilise plus de mémoire pour aller plus vite
