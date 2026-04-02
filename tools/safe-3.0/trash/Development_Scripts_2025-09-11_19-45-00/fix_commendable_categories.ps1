# FIX COMMENDABLE CATEGORIES - Use valid category values
$jsonPath = "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json"
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host "=== FIXING COMMENDABLE CATEGORIES ===" -ForegroundColor Green

# Fix commendable categories to use valid values
$json["commendableCategory1"] = "Physical Security"       # Valid category
$json["commendableCategory2"] = "Information Sharing"     # Valid category
$json["commendableCategory3"] = "Training & Awareness"    # Valid category

# Save the fixed JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8

Write-Host "Fixed commendable categories:"
Write-Host "1. commendableCategory1 = 'Physical Security'"
Write-Host "2. commendableCategory2 = 'Information Sharing'"
Write-Host "3. commendableCategory3 = 'Training & Awareness'"
Write-Host "These are now valid category values!"
