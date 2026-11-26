// Monnet.exe : la fenêtre de Monnet (son propre logiciel, plus besoin d'ouvrir Edge).
// Elle démarre le moteur de Monnet (Node, en arrière-plan, sans fenêtre) puis l'affiche dans une fenêtre WebView2
// (le moteur d'affichage déjà présent dans Windows). Sans WebView2 (vieux Windows 10), elle revient à l'ancienne
// méthode (fenêtre Edge).
// Compilé par construire-exe.mjs avec le compilateur C# de Windows (.NET Framework 4.8) : C# 5 seulement.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Monnet")]
[assembly: AssemblyDescription("Monnet : studio de montage")]
[assembly: AssemblyCompany("luunox")]
[assembly: AssemblyProduct("Monnet")]
[assembly: AssemblyCopyright("Copyright (c) 2026 luunox. Tous droits reserves.")]
[assembly: AssemblyVersion("%%VERSION_EXE%%")]
[assembly: AssemblyFileVersion("%%VERSION_EXE%%")]

static class Programme
{
    [STAThread]
    static void Main(string[] args)
    {
        bool premier;
        using (var mutex = new Mutex(true, "luunox-Monnet-fenetre", out premier))
        {
            if (!premier)
            {
                // Monnet est déjà ouvert : on ramène sa fenêtre devant au lieu d'en ouvrir une deuxième
                try { EventWaitHandle.OpenExisting("luunox-Monnet-activer").Set(); } catch (Exception) { }
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new FenetreMonnet());
        }
    }
}

class FenetreMonnet : Form
{
    readonly string racine = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
    readonly int port = LirePort();
    WebView2 vue;
    Label attente;
    Process moteur;
    FormWindowState etatAvantPleinEcran = FormWindowState.Maximized;

    static int LirePort()
    {
        int p;
        return int.TryParse(Environment.GetEnvironmentVariable("MONTAGE_PORT"), out p) ? p : 47950;
    }

    public FenetreMonnet()
    {
        Text = "Monnet";
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }
        BackColor = Color.FromArgb(9, 9, 10);
        MinimumSize = new Size(900, 600);
        // essais : fenêtre placée à un endroit précis (MONNET_ESSAI_POSITION=x,y,l,h)
        var pos = Environment.GetEnvironmentVariable("MONNET_ESSAI_POSITION");
        if (!string.IsNullOrEmpty(pos))
        {
            var n = pos.Split(',');
            StartPosition = FormStartPosition.Manual;
            Bounds = new Rectangle(int.Parse(n[0]), int.Parse(n[1]), int.Parse(n[2]), int.Parse(n[3]));
        }
        else
        {
            Size = new Size(1400, 860);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
        }
        attente = new Label
        {
            Text = "Monnet démarre…", ForeColor = Color.FromArgb(140, 140, 146), Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 13f),
        };
        Controls.Add(attente);
        // relancer Monnet ramène cette fenêtre devant
        var activer = new EventWaitHandle(false, EventResetMode.AutoReset, "luunox-Monnet-activer");
        var t = new Thread(() =>
        {
            while (true)
            {
                activer.WaitOne();
                try { BeginInvoke(new Action(RamenerDevant)); } catch (Exception) { return; }
            }
        });
        t.IsBackground = true;
        t.Start();
        Shown += async (s, e) => await Demarrer();
    }

    void RamenerDevant()
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Maximized;
        Activate();
        TopMost = true; TopMost = false;
    }

    // ---------- Démarrage ----------

    async Task Demarrer()
    {
        string versionWebView = null;
        try { versionWebView = CoreWebView2Environment.GetAvailableBrowserVersionString(); } catch (Exception) { }
        if (string.IsNullOrEmpty(versionWebView))
        {
            // pas de WebView2 sur ce PC : ancienne méthode (le moteur ouvre lui-même une fenêtre Edge)
            if (!MoteurRepond()) LancerMoteur(false);
            MessageBox.Show("Il manque un composant de Windows (WebView2) pour la fenêtre de Monnet : Monnet s'ouvre dans Edge pour cette fois.\n\nPour l'installer : https://go.microsoft.com/fwlink/p/?LinkId=2124703", "Monnet", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Close();
            return;
        }
        CreerRaccourcisPremierLancement();
        MettreAJourRaccourcis();
        if (!MoteurRepond())
        {
            if (!LancerMoteur(true)) { Close(); return; }
            attente.Text = "Monnet démarre…";
            for (int i = 0; i < 150 && !MoteurRepond(); i++) await Task.Delay(200);
            if (!MoteurRepond())
            {
                MessageBox.Show("Le moteur de Monnet ne démarre pas. Regarde journal.txt dans le dossier de Monnet, ou réinstalle Monnet.", "Monnet", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }
        }
        await OuvrirVue();
    }

    bool MoteurRepond()
    {
        try
        {
            using (var c = new TcpClient())
            {
                var r = c.BeginConnect("127.0.0.1", port, null, null);
                bool ok = r.AsyncWaitHandle.WaitOne(300) && c.Connected;
                if (ok) c.EndConnect(r);
                return ok;
            }
        }
        catch (Exception) { return false; }
    }

    string TrouverNode()
    {
        var candidats = new[] {
            Path.Combine(racine, @"outils\node\node.exe"),
            Path.Combine(Path.GetDirectoryName(racine) ?? racine, @"dev-tools\node\node.exe"),
        };
        foreach (var c in candidats) if (File.Exists(c)) return c;
        return null;
    }

    bool LancerMoteur(bool sansFenetre)
    {
        var node = TrouverNode();
        if (node == null)
        {
            MessageBox.Show("Je ne trouve pas Node, le moteur de Monnet.\nSi Monnet est sur un disque externe, vérifie qu'il est branché. Sinon, réinstalle Monnet.", "Monnet", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }
        var psi = new ProcessStartInfo(node, "--use-system-ca \"" + Path.Combine(racine, @"serveur\index.js") + "\"")
        {
            WorkingDirectory = racine, UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
        };
        if (sansFenetre) psi.EnvironmentVariables["MONTAGE_SANS_FENETRE"] = "1";
        psi.EnvironmentVariables["MONNET_FENETRE"] = Application.ExecutablePath;
        moteur = Process.Start(psi);
        return true;
    }

    string ArgumentsNavigateur()
    {
        // mêmes réglages que l'ancienne fenêtre Edge (voir serveur/index.js)
        var a = "--autoplay-policy=no-user-gesture-required --disable-features=Translate,CalculateNativeWinOcclusion"
            + " --js-flags=--max-old-space-size=4096 --disk-cache-size=1073741824"
            + " --disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows";
        bool gpu = false;
        try { gpu = Regex.IsMatch(File.ReadAllText(Path.Combine(racine, "reglages.json")), "\"decodageGpu\"\\s*:\\s*true"); } catch (Exception) { }
        if (!gpu) a += " --disable-accelerated-video-decode";
        var debug = Environment.GetEnvironmentVariable("MONNET_DEBUG_PORT");
        if (!string.IsNullOrEmpty(debug)) a += " --remote-debugging-port=" + debug;
        return a;
    }

    async Task OuvrirVue()
    {
        var options = new CoreWebView2EnvironmentOptions(ArgumentsNavigateur());
        var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(racine, "navigateur-monnet"), options);
        vue = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(9, 9, 10) };
        Controls.Add(vue);
        await vue.EnsureCoreWebView2Async(env);
        var w = vue.CoreWebView2;
        w.Settings.AreDevToolsEnabled = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MONNET_DEBUG_PORT"));
        w.Settings.IsStatusBarEnabled = false;
        w.Settings.IsZoomControlEnabled = false;
        w.Settings.AreBrowserAcceleratorKeysEnabled = false;
        w.Settings.IsPasswordAutosaveEnabled = false;
        w.Settings.IsGeneralAutofillEnabled = false;
        // le micro (voix off) : autorisé seulement pour Monnet lui-même
        w.PermissionRequested += (s, e) =>
        {
            if (e.Uri.StartsWith("http://127.0.0.1:" + port + "/") && e.PermissionKind == CoreWebView2PermissionKind.Microphone)
                e.State = CoreWebView2PermissionState.Allow;
        };
        // liens externes (Google, GitHub…) : dans le navigateur habituel
        w.NewWindowRequested += (s, e) =>
        {
            e.Handled = true;
            if (e.Uri.StartsWith("https://") || e.Uri.StartsWith("http://")) OuvrirDehors(e.Uri);
        };
        w.NavigationStarting += (s, e) =>
        {
            if (!e.Uri.StartsWith("http://127.0.0.1:" + port + "/") && !e.Uri.StartsWith("about:")) { e.Cancel = true; OuvrirDehors(e.Uri); }
        };
        w.DocumentTitleChanged += (s, e) => { Text = string.IsNullOrEmpty(w.DocumentTitle) ? "Monnet" : w.DocumentTitle; };
        w.ContainsFullScreenElementChanged += (s, e) => PleinEcran(w.ContainsFullScreenElement);
        w.NavigationCompleted += (s, e) => { if (attente != null) { Controls.Remove(attente); attente.Dispose(); attente = null; } };
        w.ProcessFailed += (s, e) =>
        {
            if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited) return;
            try { w.Reload(); } catch (Exception) { }
        };
        w.Navigate("http://127.0.0.1:" + port + "/");
    }

    void OuvrirDehors(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch (Exception) { }
    }

    void PleinEcran(bool oui)
    {
        if (oui)
        {
            etatAvantPleinEcran = WindowState;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Normal;
            WindowState = FormWindowState.Maximized;
        }
        else
        {
            FormBorderStyle = FormBorderStyle.Sizable;
            WindowState = etatAvantPleinEcran;
        }
    }

    // Premier lancement (dossier tout juste extrait) : icônes « Monnet » sur le bureau et dans le menu Démarrer.
    // Une seule fois (fichier .raccourci-cree), pour ne pas les recréer si on les enlève.
    void CreerRaccourcisPremierLancement()
    {
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MONNET_ESSAI_POSITION"))) return; // essais
        var marque = Path.Combine(racine, ".raccourci-cree");
        if (File.Exists(marque)) return;
        try
        {
            var shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            foreach (var d in new[] { Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Environment.GetFolderPath(Environment.SpecialFolder.Programs) })
            {
                var f = Path.Combine(d, "Monnet.lnk");
                if (File.Exists(f)) continue;
                var lien = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { f });
                lien.GetType().InvokeMember("TargetPath", BindingFlags.SetProperty, null, lien, new object[] { Application.ExecutablePath });
                lien.GetType().InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, lien, new object[] { racine });
                lien.GetType().InvokeMember("Description", BindingFlags.SetProperty, null, lien, new object[] { "Monnet : studio de montage" });
                lien.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, lien, null);
            }
            File.WriteAllText(marque, "");
        }
        catch (Exception) { }
    }

    // Les anciens raccourcis « Monnet » lançaient Montage.vbs : ils lancent maintenant Monnet.exe
    void MettreAJourRaccourcis()
    {
        try
        {
            var shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            var dossiers = new[] {
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                Environment.GetFolderPath(Environment.SpecialFolder.Programs),
            };
            foreach (var d in dossiers)
            {
                var f = Path.Combine(d, "Monnet.lnk");
                if (!File.Exists(f)) continue;
                var lien = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { f });
                var cible = (string)lien.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, lien, null);
                var argsLien = (string)lien.GetType().InvokeMember("Arguments", BindingFlags.GetProperty, null, lien, null);
                if (cible.EndsWith("wscript.exe", StringComparison.OrdinalIgnoreCase) && argsLien.IndexOf(racine, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    lien.GetType().InvokeMember("TargetPath", BindingFlags.SetProperty, null, lien, new object[] { Application.ExecutablePath });
                    lien.GetType().InvokeMember("Arguments", BindingFlags.SetProperty, null, lien, new object[] { "" });
                    lien.GetType().InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, lien, new object[] { racine });
                    lien.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, lien, null);
                }
            }
        }
        catch (Exception) { }
    }
}
