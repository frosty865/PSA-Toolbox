using System.Text.Json.Serialization;

namespace PSA.Toolbox.Launcher.Models;

public sealed class ToolboxManifestDocument
{
    [JsonPropertyName("version")]
    public int Version { get; set; }

    [JsonPropertyName("tools")]
    public List<ToolManifestEntry> Tools { get; set; } = new();
}

public sealed class ToolManifestEntry
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = "";

    [JsonPropertyName("relativePath")]
    public string RelativePath { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";

    [JsonPropertyName("readmeRelativePath")]
    public string? ReadmeRelativePath { get; set; }

    /// <summary>Same-origin path on the unified dev/production server (e.g. /assessment/categories/).</summary>
    [JsonPropertyName("entryPath")]
    public string? EntryPath { get; set; }

    /// <summary>If set, open this full URL in the browser instead of PSA_TOOLBOX_WEB_BASE + entryPath (e.g. another port).</summary>
    [JsonPropertyName("externalUrl")]
    public string? ExternalUrl { get; set; }

    [JsonPropertyName("start")]
    public StartManifestEntry? Start { get; set; }
}

public sealed class StartManifestEntry
{
    [JsonPropertyName("kind")]
    public string Kind { get; set; } = "";

    [JsonPropertyName("scriptRelativePath")]
    public string ScriptRelativePath { get; set; } = "";

    [JsonPropertyName("arguments")]
    public List<string>? Arguments { get; set; }
}

/// <summary>Resolved paths for UI and actions.</summary>
public sealed class ToolDisplayItem
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string Description { get; init; }
    public required string ToolRootFullPath { get; init; }
    public string? ReadmeFullPath { get; init; }
    public string? StartScriptFullPath { get; init; }
    /// <summary>Path segment for the default browser URL (e.g. /assessment/categories/).</summary>
    public string? EntryPath { get; init; }

    /// <summary>Full URL when the tool is not served from the unified web app (e.g. http://localhost:3001/).</summary>
    public string? ExternalUrl { get; init; }
}
