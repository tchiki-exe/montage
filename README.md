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

Version actuelle : **0.4.0**

- Nouveau : Monnet IA (onglet à droite) apprend ton style de montage à chaque export, uniquement sur ton PC
- Bouton « Monter sur la musique » : Monnet IA coupe sur le rythme, pioche les moments forts de tes vidéos et ajoute impacts et transitions, à ta façon
- Rythme au choix : comme moi, plus calme ou plus nerveux
- Tu peux désactiver l'apprentissage ou faire oublier ton style quand tu veux
