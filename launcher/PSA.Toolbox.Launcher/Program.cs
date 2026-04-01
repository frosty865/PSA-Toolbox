namespace PSA.Toolbox.Launcher;

public static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        global::WinRT.ComWrappersSupport.InitializeComWrappers();
        Microsoft.UI.Xaml.Application.Start(_ => new App());
    }
}
