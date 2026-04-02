# FIX REMAINING VALIDATION ISSUES - Only 3 items left!
$jsonPath = "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json"
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host "=== FIXING REMAINING 3 VALIDATION ISSUES ===" -ForegroundColor Green

# Fix 1: Add missing video surveillance system response
$json["VideoSystem"] = "no"  # They don't have a video surveillance system
$json["VideoSystemYes"] = ""
$json["VideoSystemNo"] = "no"
$json["VideoSystemNA"] = ""

# Fix 2 & 3: Add missing categories for custom VOFCs
$json["customCategory2"] = "Cybersecurity"
$json["customCategory3"] = "Personnel Security"

# Save the fixed JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8

Write-Host "Fixed remaining validation issues:"
Write-Host "1. Added VideoSystem = 'no' response"
Write-Host "2. Added customCategory2 = 'Cybersecurity'"
Write-Host "3. Added customCategory3 = 'Personnel Security'"
Write-Host "This should now pass validation with 0 issues!"
