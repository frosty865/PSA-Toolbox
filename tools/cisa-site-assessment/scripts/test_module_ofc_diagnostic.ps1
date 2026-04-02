# Test to see if we get the diagnostic error (500) or validation error (400)
# This helps determine if the table exists but is empty, or doesn't exist at all

$ErrorActionPreference = "Stop"

Write-Host "Testing MODULE OFC API Diagnostic..." -ForegroundColor Cyan
Write-Host ""

# Test with a clearly invalid UUID to see what error we get
$invalidPayload = @{
    ofc_text = "Test"
    discipline_subtype_id = "00000000-0000-0000-0000-000000000000"  # Invalid UUID
    ofc_class = "FOUNDATIONAL"
} | ConvertTo-Json

Write-Host "Test 1: Invalid UUID (should get 400 validation error)" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/module-ofcs/create" `
        -Method POST `
        -ContentType "application/json" `
        -Body $invalidPayload `
        -ErrorAction Stop
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $responseBody = $reader.ReadToEnd()
    $errorJson = $responseBody | ConvertFrom-Json
    
    Write-Host "   Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 400) { "Yellow" } else { "Red" })
    Write-Host "   Error: $($errorJson.error)" -ForegroundColor Gray
    
    if ($errorJson.connected_as) {
        Write-Host "   ⚠️  Diagnostic info present!" -ForegroundColor Yellow
        Write-Host "      DB: $($errorJson.connected_as.db)" -ForegroundColor Gray
        Write-Host "      Schema: $($errorJson.connected_as.schema)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Test 2: Valid UUID format but not in database" -ForegroundColor Gray
$validFormatPayload = @{
    ofc_text = "Test"
    discipline_subtype_id = "11111111-1111-1111-1111-111111111111"  # Valid format, likely not in DB
    ofc_class = "FOUNDATIONAL"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/module-ofcs/create" `
        -Method POST `
        -ContentType "application/json" `
        -Body $validFormatPayload `
        -ErrorAction Stop
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $responseBody = $reader.ReadToEnd()
    $errorJson = $responseBody | ConvertFrom-Json
    
    Write-Host "   Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 500) { "Red" } else { "Yellow" })
    Write-Host "   Error: $($errorJson.error)" -ForegroundColor Gray
    
    if ($errorJson.error -like "*Taxonomy missing*") {
        Write-Host "   ✅ DIAGNOSTIC ERROR - Table doesn't exist!" -ForegroundColor Red
        if ($errorJson.connected_as) {
            Write-Host "      Connected to: $($errorJson.connected_as.db).$($errorJson.connected_as.schema)" -ForegroundColor Gray
        }
    } elseif ($errorJson.error -like "*Invalid discipline_subtype_id*") {
        Write-Host "   ⚠️  Table exists but UUID not found (table may be empty)" -ForegroundColor Yellow
    }
    
    if ($errorJson.connected_as) {
        Write-Host "   Diagnostic info:" -ForegroundColor Cyan
        Write-Host "      DB: $($errorJson.connected_as.db)" -ForegroundColor Gray
        Write-Host "      Schema: $($errorJson.connected_as.schema)" -ForegroundColor Gray
        Write-Host "      User: $($errorJson.connected_as.db_user)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "- If you see 'Taxonomy missing' → Migration not applied" -ForegroundColor White
Write-Host "- If you see 'Invalid discipline_subtype_id' → Table exists but needs seeding" -ForegroundColor White
