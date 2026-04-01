# PSA Toolbox launcher (WinUI 3)

Unpackaged WinUI 3 app that reads **`tools-manifest.json` at the repository root** (not next to the executable). When you run from Visual Studio or `dotnet run`, the process walks up from the output folder until it finds both `tools-manifest.json` and a `tools/` directory.

If discovery fails (for example, a copied `.exe` without the rest of the repo), set:

`PSA_TOOLBOX_ROOT` = full path to your clone (e.g. `D:\PSA Toolbox`).

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download) or later with Windows desktop workload
- Windows App SDK (pulled in via NuGet)

## Build and run

```powershell
cd "D:\PSA Toolbox"
dotnet build .\launcher\PSA.Toolbox.Launcher\PSA.Toolbox.Launcher.csproj
dotnet run --project .\launcher\PSA.Toolbox.Launcher\PSA.Toolbox.Launcher.csproj
```

Packaging model: **unpackaged** (`WindowsPackageType` = `None`) for simple `dotnet build` / `dotnet run` loops.
