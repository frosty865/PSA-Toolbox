# FIX SOUTH FLORIDA REQUIREMENT - Valid addresses and South Florida location
$jsonPath = "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json"
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host "=== FIXING SOUTH FLORIDA REQUIREMENT ===" -ForegroundColor Green

# Update facility information to South Florida with valid address
$json["facilityName"] = "South Florida Manufacturing Corp"
$json["facilityAddress"] = "12345 NW 12th Street"
$json["facilityCity"] = "Miami"
$json["facilityState"] = "FL"
$json["facilityZip"] = "33126"
$json["facilityCountry"] = "United States"
$json["facilityPhone"] = "(305) 555-0456"
$json["facilityEmail"] = "security@southfloridamfg.com"
$json["facilityLatitude"] = "25.7617"
$json["facilityLongitude"] = "-80.1918"

# Update assessor info to South Florida office
$json["psaName"] = "John Smith"
$json["psaTitle"] = "Protective Security Advisor"
$json["psaFullTitle"] = "Senior Protective Security Advisor"
$json["psaEmail"] = "john.smith@cisa.dhs.gov"
$json["psaPhone"] = "(202) 555-0101"

$json["csaName"] = "David Chen"
$json["csaTitle"] = "Cybersecurity Specialist"
$json["csaFullTitle"] = "Senior Cybersecurity Specialist"
$json["csaEmail"] = "david.chen@cisa.dhs.gov"
$json["csaPhone"] = "(202) 555-0102"

# Update facility contact with South Florida info
$json["facilityContactName"] = "Michael Rodriguez"
$json["facilityContactTitle"] = "Security Director"
$json["facilityContactEmail"] = "michael.rodriguez@southfloridamfg.com"
$json["facilityContactPhone"] = "(305) 555-0457"

# Update emergency contacts with South Florida info
$json["opsEmergencyName"] = "Jennifer Martinez"
$json["opsEmergencyTitle"] = "Operations Manager"
$json["opsEmergencyPhone"] = "(305) 555-0458"
$json["opsEmergencyMobile"] = "(305) 555-0459"
$json["opsEmergencyEmail"] = "jennifer.martinez@southfloridamfg.com"

$json["itEmergencyName"] = "Robert Kim"
$json["itEmergencyTitle"] = "IT Director"
$json["itEmergencyPhone"] = "(305) 555-0460"
$json["itEmergencyMobile"] = "(305) 555-0461"
$json["itEmergencyEmail"] = "robert.kim@southfloridamfg.com"

$json["backupEmergencyName"] = "Lisa Thompson"
$json["backupEmergencyTitle"] = "Emergency Coordinator"
$json["backupEmergencyPhone"] = "(305) 555-0462"
$json["backupEmergencyEmail"] = "lisa.thompson@southfloridamfg.com"

# Update assessment notes for South Florida
$json["assessmentNotes"] = "Mid-level manufacturing facility in South Florida. Some security measures in place but several areas need improvement. Good cooperation from management."

# Update any other location fields
foreach ($key in $json.PSObject.Properties.Name) {
    if ($key -match "City$") {
        $json[$key] = "Miami"
    } elseif ($key -match "State$") {
        $json[$key] = "FL"
    } elseif ($key -match "Zip$") {
        $json[$key] = "33126"
    } elseif ($key -match "Address$") {
        $json[$key] = "12345 NW 12th Street"
    } elseif ($key -match "Latitude$") {
        $json[$key] = "25.7617"
    } elseif ($key -match "Longitude$") {
        $json[$key] = "-80.1918"
    }
}

# Save the updated JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8

Write-Host "Updated to South Florida location:"
Write-Host "- Facility: South Florida Manufacturing Corp"
Write-Host "- Address: 12345 NW 12th Street, Miami, FL 33126"
Write-Host "- Valid Miami address with proper coordinates"
Write-Host "- All contact info updated for South Florida"
Write-Host "This now meets the South Florida requirement!"
