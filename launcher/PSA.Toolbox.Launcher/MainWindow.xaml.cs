using System.Diagnostics;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using PSA.Toolbox.Launcher.Models;
using PSA.Toolbox.Launcher.Services;

namespace PSA.Toolbox.Launcher;

public sealed partial class MainWindow : Window
{
    private readonly TextBlock _statusText;
    private readonly ListView _toolsListView;
    private string? _repoRoot;

    public MainWindow()
    {
        InitializeComponent();

        Title = "PSA Toolbox · DHS";
        ExtendsContentIntoTitleBar = false;

        _statusText = new TextBlock
        {
            Text = string.Empty,
            Opacity = 0.75,
            TextWrapping = TextWrapping.WrapWholeWords,
            Foreground = (Brush)Application.Current.Resources["DhsDarkGrayBrush"],
        };

        _toolsListView = new ListView
        {
            SelectionMode = ListViewSelectionMode.None,
            IsItemClickEnabled = false,
        };

        Content = BuildContent();
        LoadTools();
    }

    private UIElement BuildContent()
    {
        var root = new Grid
        {
            Padding = new Thickness(24),
            RowSpacing = 12,
            Background = (Brush)Application.Current.Resources["DhsPageBackgroundBrush"],
        };

        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

        var header = new StackPanel { Spacing = 4 };
        header.Children.Add(new TextBlock
        {
            Text = "PSA Toolbox",
            Style = (Style)Application.Current.Resources["TitleTextBlockStyle"],
            Foreground = (Brush)Application.Current.Resources["DhsBlueBrush"],
        });
        header.Children.Add(new TextBlock
        {
            Text = "U.S. Department of Homeland Security",
            FontSize = 12,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Foreground = (Brush)Application.Current.Resources["DhsDarkGrayBrush"],
            Opacity = 0.95,
        });
        header.Children.Add(_statusText);
        root.Children.Add(header);

        var toolsLabel = new TextBlock
        {
            Text = "Tools",
            Style = (Style)Application.Current.Resources["SubtitleTextBlockStyle"],
            Foreground = (Brush)Application.Current.Resources["DhsLightBlueBrush"],
        };
        Grid.SetRow(toolsLabel, 1);
        root.Children.Add(toolsLabel);

        Grid.SetRow(_toolsListView, 2);
        root.Children.Add(_toolsListView);
        return root;
    }

    private void LoadTools()
    {
        _repoRoot = ToolboxManifestLoader.FindRepositoryRoot();
        if (_repoRoot is null)
        {
            _statusText.Text =
                "Could not find the repository root (tools-manifest.json and tools/ folder). Set environment variable PSA_TOOLBOX_ROOT to your clone root, or run from a build output under the cloned repo.";
            return;
        }

        _statusText.Text = _repoRoot;

        ToolboxManifestDocument doc;
        try
        {
            doc = ToolboxManifestLoader.LoadFromRepositoryRoot(_repoRoot);
        }
        catch (Exception ex)
        {
            _statusText.Text = $"Failed to read manifest: {ex.Message}";
            return;
        }

        var items = ToolboxManifestLoader.ResolveTools(_repoRoot, doc);
        _toolsListView.Items.Clear();

        foreach (var item in items)
        {
            _toolsListView.Items.Add(BuildToolCard(item));
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

        if (!string.IsNullOrEmpty(item.ExternalUrl) || !string.IsNullOrEmpty(item.EntryPath))
        {
            var openWeb = new Button { Content = "Open in browser" };
            openWeb.Click += (_, _) => OpenWebUi(item.ExternalUrl, item.EntryPath);
            actions.Children.Add(openWeb);
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

    /// <summary>Opens a tool URL: <paramref name="externalUrl"/> if set, else <c>PSA_TOOLBOX_WEB_BASE</c> (default <c>http://localhost:3000</c>) + <paramref name="entryPath"/>.</summary>
    private static void OpenWebUi(string? externalUrl, string? entryPath)
    {
        string url;
        if (!string.IsNullOrWhiteSpace(externalUrl))
        {
            url = externalUrl.Trim();
        }
        else if (!string.IsNullOrWhiteSpace(entryPath))
        {
            var env = Environment.GetEnvironmentVariable("PSA_TOOLBOX_WEB_BASE")?.Trim();
            var baseUrl = string.IsNullOrEmpty(env) ? "http://localhost:3000" : env.TrimEnd('/');
            var path = entryPath.StartsWith('/') ? entryPath : "/" + entryPath;
            url = $"{baseUrl}{path}";
        }
        else
        {
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true,
            });
        }
        catch
        {
            /* ignore */
        }
    }
}
