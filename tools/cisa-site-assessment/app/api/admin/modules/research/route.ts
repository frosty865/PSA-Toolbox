import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { screenCandidateUrl } from "@/app/lib/crawler/screenCandidateUrl";

const execAsync = promisify(exec);

type ScreeningResult = {
  totalFound: number;
  totalAccepted: number;
  rejectedByCode: Record<string, number>;
  acceptedCandidates: Array<{ url: string; finalUrl?: string; score?: number }>;
};

async function runScreeningOnCandidates(
  candidates: unknown,
  moduleCode: string
): Promise<ScreeningResult> {
  const result: ScreeningResult = {
    totalFound: 0,
    totalAccepted: 0,
    rejectedByCode: {},
    acceptedCandidates: [],
  };
  if (!Array.isArray(candidates) || candidates.length === 0) return result;
  result.totalFound = candidates.length;

  for (const c of candidates) {
    const url = typeof c === "string" ? c : (c && typeof c === "object" && "url" in c ? (c as { url: string }).url : null);
    if (!url || typeof url !== "string") continue;
    try {
      const verdict = await screenCandidateUrl(url, {
        target: { kind: "module", moduleCode },
        strictness: "strict",
        resolveLandingToPdf: true,
      });
      if (verdict.ok) {
        result.totalAccepted += 1;
        result.acceptedCandidates.push({
          url,
          finalUrl: verdict.finalUrl,
          score: verdict.score,
        });
      } else {
        const code = verdict.rejectCode ?? "VERIFY_FAILED";
        result.rejectedByCode[code] = (result.rejectedByCode[code] ?? 0) + 1;
      }
    } catch {
      result.rejectedByCode["VERIFY_FAILED"] = (result.rejectedByCode["VERIFY_FAILED"] ?? 0) + 1;
    }
  }
  return result;
}

/**
 * POST /api/admin/modules/research
 * 
 * Triggers research downloader for a module.
 * Body: {
 *   module_code: string,
 *   topic: string,
 *   queries?: string[],
 *   seed_urls?: string[],
 *   provider?: "none" | "bing" | "serpapi",
 *   max_results?: number
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { module_code, topic, queries, seed_urls, provider = "none", max_results = 10 } = body;

    if (!module_code || typeof module_code !== "string") {
      return NextResponse.json(
        { error: "module_code is required and must be a string" },
        { status: 400 }
      );
    }

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "topic is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Auto-detect provider if not specified or if API keys are missing
    let actualProvider = provider;
    if (provider === "bing" && !process.env.BING_API_KEY) {
      console.warn("[API /api/admin/modules/research] BING_API_KEY not found, falling back to 'none'");
      actualProvider = "none";
    }
    if (provider === "serpapi" && !process.env.SERPAPI_API_KEY) {
      console.warn("[API /api/admin/modules/research] SERPAPI_API_KEY not found, falling back to 'none'");
      actualProvider = "none";
    }

    // Validate provider
    if (!["none", "bing", "serpapi"].includes(actualProvider)) {
      return NextResponse.json(
        { error: 'provider must be "none", "bing", or "serpapi"' },
        { status: 400 }
      );
    }

    // If provider is "none", require seed_urls or queries
    if (actualProvider === "none" && (!seed_urls || !Array.isArray(seed_urls) || seed_urls.length === 0)) {
      // Allow queries to be used even with provider="none" (will create seed URLs from queries)
      if (!queries || !Array.isArray(queries) || queries.length === 0) {
        return NextResponse.json(
          { error: 'provider="none" requires either seed_urls or queries array' },
          { status: 400 }
        );
      }
    }

    // If provider is not "none", require queries or use topic
    const searchQueries = queries && Array.isArray(queries) && queries.length > 0 
      ? queries 
      : [topic];

    // Prepare command arguments
    const scriptPath = path.join(process.cwd(), "tools", "research", "module_research_downloader.py");
    
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `Research downloader script not found: ${scriptPath}` },
        { status: 500 }
      );
    }

    // Determine Python command (try venv first, then system python)
    let pythonCmd = "python";
    const venvPython = path.join(process.cwd(), "venv", "Scripts", "python.exe");
    if (fs.existsSync(venvPython)) {
      pythonCmd = venvPython;
    } else if (process.platform === "win32") {
      // On Windows, try python.exe
      pythonCmd = "python.exe";
    }

    // Build command arguments
    const args: string[] = [
      pythonCmd,
      scriptPath,
      "--module_code", module_code,
      "--topic", topic,
      "--provider", actualProvider,
      "--max_results", String(max_results),
    ];

    // Add queries file if provided (or if provider="none" but we have queries)
    if (searchQueries.length > 0) {
      const queriesDir = path.join(process.cwd(), "analytics", "research");
      if (!fs.existsSync(queriesDir)) {
        fs.mkdirSync(queriesDir, { recursive: true });
      }
      const queriesFile = path.join(queriesDir, `${module_code}_queries.txt`);
      fs.writeFileSync(queriesFile, searchQueries.join("\n"), "utf-8");
      args.push("--queries_file", queriesFile);
    }

    // Generate search URLs from queries if provider is "none" and queries are provided
    const finalSeedUrls = seed_urls && Array.isArray(seed_urls) ? [...seed_urls] : [];
    
    if (actualProvider === "none" && searchQueries.length > 0) {
      // Generate DuckDuckGo and Google search URLs for each query
      for (const query of searchQueries) {
        const encodedQuery = encodeURIComponent(query);
        // DuckDuckGo search URL
        finalSeedUrls.push(`https://html.duckduckgo.com/html/?q=${encodedQuery}`);
        // Google search URL
        finalSeedUrls.push(`https://www.google.com/search?q=${encodedQuery}`);
      }
      console.log(`[API /api/admin/modules/research] Generated ${finalSeedUrls.length} seed URLs from ${searchQueries.length} queries`);
    }

    // Add seed URLs file if we have any (required for provider="none")
    if (actualProvider === "none") {
      if (finalSeedUrls.length === 0) {
        return NextResponse.json(
          { error: "No seed URLs available. Please provide seed_urls or queries." },
          { status: 400 }
        );
      }
      
      const researchDir = path.join(process.cwd(), "analytics", "research");
      if (!fs.existsSync(researchDir)) {
        fs.mkdirSync(researchDir, { recursive: true });
      }
      const seedUrlsFile = path.join(researchDir, `${module_code}_seed_urls.txt`);
      fs.writeFileSync(seedUrlsFile, finalSeedUrls.join("\n"), "utf-8");
      console.log(`[API /api/admin/modules/research] Wrote ${finalSeedUrls.length} seed URLs to ${seedUrlsFile}`);
      args.push("--seed_urls_file", seedUrlsFile);
    } else if (finalSeedUrls.length > 0) {
      // For non-"none" providers, seed URLs are optional
      const researchDir = path.join(process.cwd(), "analytics", "research");
      if (!fs.existsSync(researchDir)) {
        fs.mkdirSync(researchDir, { recursive: true });
      }
      const seedUrlsFile = path.join(researchDir, `${module_code}_seed_urls.txt`);
      fs.writeFileSync(seedUrlsFile, finalSeedUrls.join("\n"), "utf-8");
      args.push("--seed_urls_file", seedUrlsFile);
    }

    // Execute research downloader
    // Escape arguments properly for shell execution
    const escapedArgs = args.map(arg => {
      // If argument contains spaces or special chars, wrap in quotes
      if (arg.includes(" ") || arg.includes("'") || arg.includes('"')) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    });
    const command = escapedArgs.join(" ");
    console.log(`[API /api/admin/modules/research] Executing: ${command}`);

    console.log(`[API /api/admin/modules/research] Executing command with ${args.length} arguments`);
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: {
        ...process.env,
        // Pass through API keys if available
        BING_API_KEY: process.env.BING_API_KEY || "",
        SERPAPI_API_KEY: process.env.SERPAPI_API_KEY || "",
      },
    });
    
    console.log(`[API /api/admin/modules/research] Command completed. stdout length: ${stdout.length}, stderr length: ${stderr.length}`);

    // Check for discovery and manifest files
    const discoveryPath = path.join(process.cwd(), "analytics", "research", `${module_code}_discovery.json`);
    const manifestPath = path.join(process.cwd(), "analytics", "research", `${module_code}_download_manifest.json`);

    let discovery = null;
    let manifest = null;

    if (fs.existsSync(discoveryPath)) {
      discovery = JSON.parse(fs.readFileSync(discoveryPath, "utf-8"));
    }

    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }

    // Log discovery and manifest status
    if (discovery) {
      console.log(`[API /api/admin/modules/research] Discovery found ${discovery.candidates?.length || 0} candidates`);
    } else {
      console.warn(`[API /api/admin/modules/research] Discovery file not found at ${discoveryPath}`);
    }
    
    if (manifest) {
      console.log(`[API /api/admin/modules/research] Manifest: ${manifest.downloaded?.length || 0} downloaded, ${manifest.failed?.length || 0} failed`);
    } else {
      console.warn(`[API /api/admin/modules/research] Manifest file not found at ${manifestPath}`);
    }

    const screening = await runScreeningOnCandidates(
      discovery?.candidates,
      module_code
    );

    return NextResponse.json({
      success: true,
      module_code,
      topic,
      provider: actualProvider,
      stdout: stdout.substring(0, 1000),
      stderr: stderr ? stderr.substring(0, 500) : null,
      discovery,
      manifest: manifest ? {
        download_dir: manifest.download_dir,
        downloaded_count: manifest.downloaded?.length || 0,
        failed_count: manifest.failed?.length || 0,
      } : null,
      screening: {
        strictness: 'strict',
        target: { kind: 'module' as const, moduleCode: module_code },
        acceptedCount: screening.totalAccepted,
        rejectedCount: screening.totalFound - screening.totalAccepted,
        rejectedByCode: screening.rejectedByCode,
        acceptedCandidates: screening.acceptedCandidates,
      },
    }, { status: 200 });

  } catch (error: unknown) {
    console.error("[API /api/admin/modules/research] Error:", error);
    const err = error && typeof error === "object" ? error as { message?: string; stderr?: unknown; stdout?: unknown; code?: string } : {};
    const errorMessage = err.message ?? "Unknown error";
    const stderr = (err.stderr ?? "").toString().substring(0, 2000);
    const stdout = (err.stdout ?? "").toString().substring(0, 2000);

    // "Python not found" only when the executable clearly could not be found or run.
    // Do NOT match on "python" in the command path (e.g. ...\venv\Scripts\python.exe) or in script stderr.
    const isPythonNotFound =
      err.code === "ENOENT" ||
      /'python' is not recognized|'python\.exe' is not recognized|python: command not found|python3: command not found/i.test(errorMessage) ||
      /'python' is not recognized|'python\.exe' is not recognized|python: command not found|python3: command not found/i.test(stderr);

    if (isPythonNotFound) {
      return NextResponse.json(
        {
          error: "Python not found",
          message: "Python is required to run the research downloader. Please ensure Python is installed and available in PATH, or use a virtual environment.",
          details: errorMessage,
          stderr: stderr || undefined,
        },
        { status: 500 }
      );
    }

    // Prefer the script's own failure message when present (e.g. provider=none and no usable seed URLs / downloads)
    let message = errorMessage;
    if (/Provide seed URLs or configure provider API keys|downloaded 0 files successfully/i.test(stderr)) {
      message =
        "The research downloader could not fetch any documents. " +
        "With provider=none: provide seed_urls or queries so the API can build seed URLs. " +
        "Or set BING_API_KEY or SERPAPI_API_KEY and use provider=bing or provider=serpapi.";
    }

    return NextResponse.json(
      {
        error: "Research download failed",
        message,
        details: errorMessage,
        stderr: stderr || undefined,
        stdout: stdout || undefined,
      },
      { status: 500 }
    );
  }
}

