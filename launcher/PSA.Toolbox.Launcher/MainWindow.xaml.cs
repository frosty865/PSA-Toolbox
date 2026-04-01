using System.Diagnostics;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using PSA.Toolbox.Launcher.Models;
using PSA.Toolbox.Launcher.Services;

namespace PSA.Toolbox.Launcher;

public sealed partial class MainWindow : Window
{
    private string? _repoRoot;

    public MainWindow()
    {
        InitializeComponent();
        Title = "PSA Toolbox";
        ExtendsContentIntoTitleBar = false;
        LoadTools();
    }

    private void LoadTools()
    {
        _repoRoot = ToolboxManifestLoader.FindRepositoryRoot();
        if (_repoRoot is null)
        {
            StatusText.Text =
                "Could not find the repository root (tools-manifest.json and tools/ folder). Set environment variable PSA_TOOLBOX_ROOT to your clone root, or run from a build output under the cloned repo.";
            return;
        }

        StatusText.Text = _repoRoot;

        ToolboxManifestDocument doc;
        try
        {
            doc = ToolboxManifestLoader.LoadFromRepositoryRoot(_repoRoot);
        }
        catch (Exception ex)
        {
            StatusText.Text = $"Failed to read manifest: {ex.Message}";
            return;
        }

        var items = ToolboxManifestLoader.ResolveTools(_repoRoot, doc);
        ToolsListView.Items.Clear();

        foreach (var item in items)
        {
            var card = BuildToolCard(item);
            ToolsListView.Items.Add(card);
        }
    }

    private static Border BuildToolCard(ToolDisplayItem item)
    {
        var stack = new StackPanel { Spacing = 12 };

        stack.Children.Add(new TextBlock
        {
            Text = item.DisplayName,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            FontSize = 18,
        });

        stack.Children.Add(new TextBlock
        {
            Text = item.Description,
            TextWrapping = TextWrapping.WrapWholeWords,
            Opacity = 0.85,
        });

        var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };

        var openFolder = new Button { Content = "Open folder" };
        openFolder.Click += (_, _) => OpenFolder(item.ToolRootFullPath);
        actions.Children.Add(openFolder);

        if (item.ReadmeFullPath is not null)
        {
            var openReadme = new Button { Content = "Open README" };
            openReadme.Click += (_, _) => OpenFile(item.ReadmeFullPath);
            actions.Children.Add(openReadme);
        }

        if (item.StartScriptFullPath is not null)
        {
            var start = new Button { Content = "Start (production server)" };
            start.Click += (_, _) => StartPowerShellScript(item.ToolRootFullPath, item.StartScriptFullPath);
            actions.Children.Add(start);
        }

        stack.Children.Add(actions);

        return new Border
        {
            Child = stack,
            Padding = new Thickness(16),
            Margin = new Thickness(0, 0, 0, 12),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(8),
            BorderBrush = new SolidColorBrush(Microsoft.UI.Colors.Gray) { Opacity = 0.35 },
            Background = new SolidColorBrush(Microsoft.UI.Colors.Transparent),
        };
    }

    private static void OpenFolder(string path)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = path,
                UseShellExecute = true,
            });
        }
        catch
        {
            /* Explorer launch failed silently */
        }
    }

    private static void OpenFile(string path)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true,
            });
        }
        catch
        {
            /* ignore */
        }
    }

    private static void StartPowerShellScript(string workingDirectory, string scriptPath)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\"",
                WorkingDirectory = workingDirectory,
                UseShellExecute = true,
            });
        }
        catch
        {
            /* ignore */
        }
    }
}
