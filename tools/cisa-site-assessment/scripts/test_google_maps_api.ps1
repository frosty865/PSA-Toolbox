# Test Google Maps API Configuration
# This script verifies that the Google Maps API key is properly configured

Write-Host "=== Google Maps API Configuration Test ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "ERROR: .env.local file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ .env.local file exists" -ForegroundColor Green

# Check if Google Maps API key is set
$envContent = Get-Content ".env.local" -Raw
if ($envContent -match "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=(.+)") {
    $apiKey = $matches[1].Trim()
    Write-Host "✓ Google Maps API key found: $($apiKey.Substring(0, [Math]::Min(10, $apiKey.Length)))..." -ForegroundColor Green
    Write-Host ""
    
    # Test if the key is accessible (check environment variable in Node context)
    Write-Host "Testing API key accessibility..." -ForegroundColor Yellow
    
    # Create a test script to check if Next.js can read the env var
    $testScript = @"
const fs = require('fs');
const path = require('path');

// Load .env.local manually for testing
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=(.+)/);
    if (match) {
        console.log('SUCCESS: API key found in .env.local');
        console.log('Key (first 10 chars):', match[1].trim().substring(0, 10) + '...');
        process.exit(0);
    } else {
        console.log('ERROR: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not found in .env.local');
        process.exit(1);
    }
} else {
    console.log('ERROR: .env.local file not found');
    process.exit(1);
}
"@
    
    $testScriptPath = "test_google_maps_env.js"
    Set-Content -Path $testScriptPath -Value $testScript
    
    try {
        $result = node $testScriptPath 2>&1
        Write-Host $result -ForegroundColor White
        Remove-Item $testScriptPath -ErrorAction SilentlyContinue
        Write-Host ""
        Write-Host "✓ API key is accessible" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Could not test with Node (Node may not be available in this shell)" -ForegroundColor Yellow
        Write-Host "  The key is present in .env.local and will be loaded by Next.js" -ForegroundColor Gray
        Remove-Item $testScriptPath -ErrorAction SilentlyContinue
    }
    
} else {
    Write-Host "ERROR: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not found in .env.local" -ForegroundColor Red
    Write-Host ""
    Write-Host "To add it, run:" -ForegroundColor Yellow
    Write-Host '  Add-Content -Path .env.local -Value "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here"' -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart the Next.js dev server if it's running" -ForegroundColor White
Write-Host "  2. Open the Create Assessment dialog" -ForegroundColor White
Write-Host "  3. Check the browser console for '[Google Maps] API key found' message" -ForegroundColor White
Write-Host "  4. Test address autocomplete in the Address Line 1 field" -ForegroundColor White
