# Test MODULE OFC Creation API
# Tests the /api/admin/module-ofcs/create endpoint

$ErrorActionPreference = "Stop"

Write-Host "Testing MODULE OFC Creation API..." -ForegroundColor Cyan
Write-Host ""

# First, try to get available disciplines/subtypes
Write-Host "Step 1: Fetching available disciplines and subtypes..." -ForegroundColor Gray
try {
    $disciplinesResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/reference/disciplines" -Method GET -ErrorAction Stop
    
    Write-Host "✅ Found $($disciplinesResponse.disciplines.Count) disciplines" -ForegroundColor Green
    
    # Find Access Control Systems and get a subtype
    $acs = $disciplinesResponse.disciplines | Where-Object { $_.name -eq "Access Control Systems" -or $_.code -eq "ACS" } | Select-Object -First 1
    
    if ($acs -and $acs.discipline_subtypes -and $acs.discipline_subtypes.Count -gt 0) {
        $subtype = $acs.discipline_subtypes[0]
        $subtypeId = $subtype.id
        $subtypeName = $subtype.name
        
        Write-Host "   Using subtype: $subtypeName (ID: $subtypeId)" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "⚠️  No subtypes found for Access Control Systems" -ForegroundColor Yellow
        Write-Host "   This might indicate the migration hasn't been applied or seeded" -ForegroundColor Yellow
        Write-Host ""
        
        # Use the taxonomy UUID as fallback
        $subtypeId = "9ad62209-3efe-4339-b079-e17f9810f6b0"
        Write-Host "   Falling back to taxonomy UUID: $subtypeId" -ForegroundColor Gray
        Write-Host ""
    }
} catch {
    Write-Host "⚠️  Could not fetch disciplines: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Using taxonomy UUID as fallback" -ForegroundColor Gray
    Write-Host ""
    $subtypeId = "9ad62209-3efe-4339-b079-e17f9810f6b0"
}

# Test data
$testPayload = @{
    ofc_text = "Test OFC for API verification - ensures discipline_subtypes table exists"
    discipline_subtype_id = $subtypeId
    ofc_class = "FOUNDATIONAL"
    title = "Test OFC - API Verification"
} | ConvertTo-Json

Write-Host "Step 2: Testing MODULE OFC creation..." -ForegroundColor Gray
Write-Host "Endpoint: POST http://localhost:3000/api/admin/module-ofcs/create" -ForegroundColor DarkGray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/module-ofcs/create" `
        -Method POST `
        -ContentType "application/json" `
        -Body $testPayload `
        -ErrorAction Stop

    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
    
    if ($response.success -and $response.ofc) {
        Write-Host ""
        Write-Host "Created OFC ID: $($response.ofc.id)" -ForegroundColor Green
        Write-Host "Status: $($response.ofc.status)" -ForegroundColor Green
        Write-Host "Discipline Subtype ID: $($response.ofc.discipline_subtype_id)" -ForegroundColor Green
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    Write-Host "❌ ERROR: HTTP $statusCode" -ForegroundColor Red
    Write-Host ""
    
    # Try to get full error response
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        
        Write-Host "Error Response:" -ForegroundColor Yellow
        try {
            $errorJson = $responseBody | ConvertFrom-Json
            $errorJson | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Red
            
            # Check for diagnostic error
            if ($errorJson.error -like "*Taxonomy missing*") {
                Write-Host ""
                Write-Host "⚠️  DIAGNOSTIC ERROR DETECTED!" -ForegroundColor Yellow
                Write-Host "   The migration needs to be applied to create public.discipline_subtypes" -ForegroundColor Yellow
                if ($errorJson.connected_as) {
                    Write-Host ""
                    Write-Host "   Connected to:" -ForegroundColor Gray
                    Write-Host "   - Database: $($errorJson.connected_as.db)" -ForegroundColor Gray
                    Write-Host "   - Schema: $($errorJson.connected_as.schema)" -ForegroundColor Gray
                    Write-Host "   - User: $($errorJson.connected_as.db_user)" -ForegroundColor Gray
                }
            }
        } catch {
            Write-Host $responseBody -ForegroundColor Red
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    exit 1
}
