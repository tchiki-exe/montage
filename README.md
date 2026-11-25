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

Version actuelle : **0.5.1**

- Monnet IA apprend de plusieurs vidéos d'un coup : choisis-en plein, elle les regarde l'une après l'autre
- Elle repère maintenant aussi les zooms secs et les secousses (en plus des coupes, flashs et rythme)
- Quand elle monte, elle met autant d'impacts que dans les vidéos apprises, aux meilleurs endroits
- Ton propre style compte plus que les vidéos de référence dès que tu exportes tes montages
