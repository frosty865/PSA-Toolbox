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
}
