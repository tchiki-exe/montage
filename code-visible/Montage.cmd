@echo off
rem Autre façon de lancer le logiciel, si Montage.vbs est bloqué. Laisse cette fenêtre noire ouverte (tu peux la réduire).
cd /d "%~dp0"
set "NODE=%~dp0outils\node\node.exe"
if not exist "%NODE%" set "NODE=%~dp0..\dev-tools\node\node.exe"
if not exist "%NODE%" (
  echo Je ne trouve pas Node, le moteur du logiciel. Retelecharge le dossier complet.
  pause
  exit /b 1
)
title Montage - laisse cette fenetre ouverte
"%NODE%" --use-system-ca "%~dp0serveur\index.js"
