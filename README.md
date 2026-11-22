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

Version actuelle : **0.2.1**

- Corrigé : un import ne reste plus bloqué « en attente 0 % » pendant qu'une autre vidéo s'analyse
- Une vidéo est utilisable tout de suite ; la forme du son, le rythme et les miniatures se calculent ensuite en fond, en une seule lecture (2 fois plus rapide)
- Deux vidéos peuvent se préparer en même temps
- Si l'outil vidéo se bloque, il est arrêté et une erreur s'affiche (clic droit sur le média → Relancer la préparation)
- Fermer le logiciel arrête aussi les préparations en cours
- Musiques MP3, WAV, M4A lues directement, sans conversion
- Dis « ça bug » à Claude intégré : il lit le journal du logiciel et t'explique
