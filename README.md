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

Version actuelle : **0.2.3**

- Le dézoom tient compte de tes vidéos importées : même avec un montage vide, tu peux dézoomer pour voir une vidéo de 1 h 30 en entier
- Quand tu ajoutes une longue vidéo, la ligne de temps se dézoome toute seule pour la montrer en entier
- Nouvelle barre de défilement sous la ligne de temps : glisse-la pour te déplacer, ou clique à côté pour avancer d'une page (pas besoin de molette)
