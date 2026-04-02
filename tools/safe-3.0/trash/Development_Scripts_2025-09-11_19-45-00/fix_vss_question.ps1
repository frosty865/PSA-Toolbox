# FIX VSS QUESTION - Use correct field name and value
$jsonPath = "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json"
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host "=== FIXING VSS QUESTION ===" -ForegroundColor Green

# Fix VSS question - use correct field name and value
$json["VideoSystemType"] = "digital"  # They have a digital video surveillance system
$json["VideoSystemTypeDigital"] = "digital"
$json["VideoSystemTypeAnalog"] = ""
$json["VideoSystemTypeHybrid"] = ""
$json["VideoSystemTypeNone"] = ""
$json["VideoSystemTypeNA"] = ""

# Remove the incorrect VideoSystem field
$json.Remove("VideoSystem")

# Save the fixed JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8

Write-Host "Fixed VSS question:"
Write-Host "- VideoSystemType = 'digital' (they have a digital video surveillance system)"
Write-Host "- VideoSystemTypeDigital = 'digital'"
Write-Host "- Removed incorrect VideoSystem field"
Write-Host "This should now answer the VSS question properly!"
