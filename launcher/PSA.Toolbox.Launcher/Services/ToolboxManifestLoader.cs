using System.Text.Json;
using PSA.Toolbox.Launcher.Models;

namespace PSA.Toolbox.Launcher.Services;

public static class ToolboxManifestLoader
{
    private const string ManifestFileName = "tools-manifest.json";
    private const string EnvRepoRoot = "PSA_TOOLBOX_ROOT";

    /// <summary>True if <paramref name="directory"/> looks like the PSA Toolbox repo root (manifest + tools/).</summary>
    public static bool IsRepositoryRoot(string directory)
    {
        if (string.IsNullOrEmpty(directory))
            return false;
        var manifest = Path.Combine(directory, ManifestFileName);
        var tools = Path.Combine(directory, "tools");
        return File.Exists(manifest) && Directory.Exists(tools);
    }

    public static string? FindRepositoryRoot()
    {
        var env = Environment.GetEnvironmentVariable(EnvRepoRoot);
        if (!string.IsNullOrWhiteSpace(env))
        {
            var p = Path.GetFullPath(env.Trim());
            if (IsRepositoryRoot(p))
                return p;
        }

        var dir = AppContext.BaseDirectory;
        for (var i = 0; i < 20 && !string.IsNullOrEmpty(dir); i++)
        {
            try
            {
                if (IsRepositoryRoot(dir))
                    return dir;
            }
            catch
            {
                /* ignore */
            }

            dir = Directory.GetParent(dir)?.FullName;
        }

        return null;
    }

    public static ToolboxManifestDocument LoadFromRepositoryRoot(string repoRoot)
    {
        var path = Path.Combine(repoRoot, ManifestFileName);
        var json = File.ReadAllText(path);
        var doc = JsonSerializer.Deserialize<ToolboxManifestDocument>(json, JsonOptions());
        return doc ?? throw new InvalidOperationException("Manifest deserialized to null.");
    }

    public static IReadOnlyList<ToolDisplayItem> ResolveTools(string repoRoot, ToolboxManifestDocument doc)
    {
        var list = new List<ToolDisplayItem>();
        foreach (var t in doc.Tools)
        {
            var root = Path.GetFullPath(Path.Combine(repoRoot, t.RelativePath.TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)));
            string? readme = null;
            if (!string.IsNullOrEmpty(t.ReadmeRelativePath))
            {
                var rp = Path.Combine(root, t.ReadmeRelativePath);
                if (File.Exists(rp))
                    readme = rp;
            }

            string? startScript = null;
            if (t.Start is { Kind: "powershell", ScriptRelativePath: { Length: > 0 } scriptRel })
            {
                var sp = Path.Combine(root, scriptRel);
                if (File.Exists(sp))
                    startScript = sp;
            }

            list.Add(new ToolDisplayItem
            {
                Id = t.Id,
                DisplayName = t.DisplayName,
                Description = t.Description,
                ToolRootFullPath = root,
                ReadmeFullPath = readme,
                StartScriptFullPath = startScript,
            });
        }

        return list;
    }

    private static JsonSerializerOptions JsonOptions()
    {
        return new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            ReadCommentHandling = JsonCommentHandling.Skip,
            AllowTrailingCommas = true,
        };
    }
}
