# FIX CUSTOM VOFC CATEGORIES - Only 2 issues left!
$jsonPath = "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json"
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host "=== FIXING CUSTOM VOFC CATEGORIES ===" -ForegroundColor Green

# Fix the missing custom VOFC categories
$json["customCategory2"] = "Cybersecurity"
$json["customCategory3"] = "Personnel Security"

# Save the fixed JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8

Write-Host "Fixed custom VOFC categories:"
Write-Host "- customCategory2 = 'Cybersecurity'"
Write-Host "- customCategory3 = 'Personnel Security'"
Write-Host "This should now pass validation with 0 issues!"
