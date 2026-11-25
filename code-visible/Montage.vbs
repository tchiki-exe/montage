' Lance le logiciel de montage : démarre le petit serveur (caché) qui ouvre la fenêtre.
Option Explicit
Dim sh, fso, dossier, node, candidats, c, bureau, marque, lien
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dossier = fso.GetParentFolderName(WScript.ScriptFullName)
' Node : installé avec le logiciel (outils\node) ou à côté sur le disque externe (dev-tools\node)
candidats = Array(fso.BuildPath(dossier, "outils\node\node.exe"), fso.BuildPath(fso.GetParentFolderName(dossier), "dev-tools\node\node.exe"))
node = ""
For Each c In candidats
  If node = "" And fso.FileExists(c) Then node = c
Next
If node = "" Then
  MsgBox "Je ne trouve pas Node, le moteur de Monnet." & vbCrLf & "Si le logiciel est sur le disque externe, vérifie qu'il est branché." & vbCrLf & "Sinon, retélécharge le dossier complet.", 48, "Monnet"
  WScript.Quit
End If

' Premier lancement : raccourci sur le bureau (une seule fois, pour ne pas le recréer si tu l'enlèves)
marque = fso.BuildPath(dossier, ".raccourci-cree")
bureau = sh.SpecialFolders("Desktop")
' Nouveau nom : l'ancien raccourci « Montage » devient « Monnet »
If fso.FileExists(fso.BuildPath(bureau, "Montage.lnk")) And Not fso.FileExists(fso.BuildPath(bureau, "Monnet.lnk")) Then
  On Error Resume Next
  fso.MoveFile fso.BuildPath(bureau, "Montage.lnk"), fso.BuildPath(bureau, "Monnet.lnk")
  On Error GoTo 0
End If
If Not fso.FileExists(marque) Then
  On Error Resume Next
  If Not fso.FileExists(fso.BuildPath(bureau, "Monnet.lnk")) Then
    Set lien = sh.CreateShortcut(fso.BuildPath(bureau, "Monnet.lnk"))
    lien.TargetPath = fso.BuildPath(sh.ExpandEnvironmentStrings("%WINDIR%"), "System32\wscript.exe")
    lien.Arguments = Chr(34) & WScript.ScriptFullName & Chr(34)
    lien.WorkingDirectory = dossier
    lien.IconLocation = fso.BuildPath(dossier, "icone.ico") & ",0"
    lien.Description = "Monnet : studio de montage avec Claude et Monnet IA"
    lien.Save
  End If
  fso.CreateTextFile(marque, True).Close
  On Error GoTo 0
End If

sh.CurrentDirectory = dossier
sh.Run Chr(34) & node & Chr(34) & " --use-system-ca " & Chr(34) & dossier & "\serveur\index.js" & Chr(34), 0, False
