# CREATE COMPLETE REALISTIC JSON - All conditionals properly set
$htmlContent = Get-Content "../../ALT_SAFE_Beta_DEPLOYMENT_2025-09-11_19-42-31/ALT_SAFE_Beta_Assessment.html" -Raw
$allFieldIds = [regex]::Matches($htmlContent, 'id="([^"]*)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object | Get-Unique

Write-Host "=== CREATING COMPLETE REALISTIC JSON ===" -ForegroundColor Green

# Create new JSON with South Florida data
$json = @{}

# SOUTH FLORIDA FACILITY INFO - Valid Miami address
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
$json["assessmentDate"] = "2025-01-27"
$json["sector"] = "Manufacturing"
$json["facilityType"] = "Industrial Manufacturing"
$json["employeeCount"] = "150"
$json["facilitySize"] = "75000"
$json["operatingHours"] = "24/7"
$json["publicAccess"] = "Restricted"
$json["assessmentNotes"] = "Mid-level manufacturing facility in South Florida. Some security measures in place but several areas need improvement. Good cooperation from management."

# PSA/Assessor info
$json["psaName"] = "John Smith"
$json["psaTitle"] = "Protective Security Advisor"
$json["psaFullTitle"] = "Senior Protective Security Advisor"
$json["psaEmail"] = "john.smith@cisa.dhs.gov"
$json["psaPhone"] = "(202) 555-0101"

# CSA info
$json["csaName"] = "David Chen"
$json["csaTitle"] = "Cybersecurity Specialist"
$json["csaFullTitle"] = "Senior Cybersecurity Specialist"
$json["csaEmail"] = "david.chen@cisa.dhs.gov"
$json["csaPhone"] = "(202) 555-0102"

# Facility contact - South Florida
$json["facilityContactName"] = "Michael Rodriguez"
$json["facilityContactTitle"] = "Security Director"
$json["facilityContactEmail"] = "michael.rodriguez@southfloridamfg.com"
$json["facilityContactPhone"] = "(305) 555-0457"

# Emergency contacts - South Florida
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

# REALISTIC ASSESSMENT RESPONSES - Mid-level facility with gaps
$realisticResponses = @{
    'Awareness' = 'yes'
    'LawEnforcement' = 'yes'
    'LawComm' = 'no'
    'FireAgency' = 'yes'
    'FireComm' = 'yes'
    'MedicalAgency' = 'no'
    'MedicalComm' = 'no'
    'FBIInfo' = 'yes'
    'ISACInfo' = 'no'
    'HSINInfo' = 'no'
    'InfraGard' = 'yes'
    'FederalInfo' = 'yes'
    'StateLocalInfo' = 'yes'
    'NeighborInfo' = 'no'
    'SecurityManager' = 'yes'
    'SecurityPlan' = 'yes'
    'PlanTraining' = 'no'
    'PlanCoordination' = 'yes'
    'EmployeeTraining' = 'no'
    'PlanTesting' = 'no'
    'RiskAssessment' = 'yes'
    'SecurityPersonnel' = 'yes'
    'PerimeterFencing' = 'no'
    'AccessControl' = 'yes'
    'SecurityLighting' = 'no'
    'StandoffDistance' = 'no'
    'BuildingEnvelope' = 'yes'
    'KeyControl' = 'no'
    'VideoSystemType' = 'yes'
    'VideoCoverage' = 'no'
    'VideoMonitoring' = 'yes'
    'VideoRecording' = 'yes'
    'IntrusionDetection' = 'no'
    'AlarmMonitoring' = 'yes'
    'SystemIntegration' = 'no'
}

# Set question responses
foreach ($question in $realisticResponses.Keys) {
    $json[$question] = $realisticResponses[$question]
}

# Add ALL other form fields with realistic values
foreach ($fieldId in $allFieldIds) {
    if (-not $json.ContainsKey($fieldId)) {
        if ($fieldId -match "Yes$") {
            $question = $fieldId -replace "Yes$", ""
            if ($realisticResponses.ContainsKey($question) -and $realisticResponses[$question] -eq "yes") {
                $json[$fieldId] = "yes"
            } else {
                $json[$fieldId] = ""
            }
        } elseif ($fieldId -match "No$") {
            $question = $fieldId -replace "No$", ""
            if ($realisticResponses.ContainsKey($question) -and $realisticResponses[$question] -eq "no") {
                $json[$fieldId] = "no"
            } else {
                $json[$fieldId] = ""
            }
        } elseif ($fieldId -match "NA$") {
            $question = $fieldId -replace "NA$", ""
            if ($realisticResponses.ContainsKey($question) -and $realisticResponses[$question] -eq "na") {
                $json[$fieldId] = "na"
            } else {
                $json[$fieldId] = ""
            }
        } elseif ($fieldId -match "Comp[0-9]+$") {
            # REALISTIC: Only select 1-2 out of 3-4 Comp options for YES responses
            $question = $fieldId -replace "Comp[0-9]+$", ""
            if ($realisticResponses.ContainsKey($question) -and $realisticResponses[$question] -eq "yes") {
                # Select only some checkboxes, not all
                $compNumber = [int]($fieldId -replace ".*Comp", "")
                if ($compNumber -eq 1 -or $compNumber -eq 3) {
                    $json[$fieldId] = $true
                } else {
                    $json[$fieldId] = $false
                }
            } else {
                $json[$fieldId] = $false
            }
        } elseif ($fieldId -match "NoOFC[0-9]+$") {
            # REALISTIC: Only select 1 out of 2-3 NoOFC options for NO responses
            $question = $fieldId -replace "NoOFC[0-9]+$", ""
            if ($realisticResponses.ContainsKey($question) -and $realisticResponses[$question] -eq "no") {
                # Select only the first checkbox, not all
                $noofcNumber = [int]($fieldId -replace ".*NoOFC", "")
                if ($noofcNumber -eq 1) {
                    $json[$fieldId] = $true
                } else {
                    $json[$fieldId] = $false
                }
            } else {
                $json[$fieldId] = $false
            }
        } elseif ($fieldId -match "Details$") {
            $json[$fieldId] = "Assessment details documented during evaluation"
        } elseif ($fieldId -match "Notes$") {
            $json[$fieldId] = "Additional assessment notes"
        } elseif ($fieldId -match "Name$") {
            $json[$fieldId] = "John Doe"
        } elseif ($fieldId -match "Email$") {
            $json[$fieldId] = "john.doe@example.com"
        } elseif ($fieldId -match "Phone$") {
            $json[$fieldId] = "(305) 555-1234"
        } elseif ($fieldId -match "Title$") {
            $json[$fieldId] = "Security Manager"
        } elseif ($fieldId -match "Address$") {
            $json[$fieldId] = "12345 NW 12th Street"
        } elseif ($fieldId -match "City$") {
            $json[$fieldId] = "Miami"
        } elseif ($fieldId -match "State$") {
            $json[$fieldId] = "FL"
        } elseif ($fieldId -match "Zip$") {
            $json[$fieldId] = "33126"
        } elseif ($fieldId -match "Country$") {
            $json[$fieldId] = "United States"
        } elseif ($fieldId -match "Date$") {
            $json[$fieldId] = "2025-01-27"
        } elseif ($fieldId -match "Time$") {
            $json[$fieldId] = "14:30"
        } elseif ($fieldId -match "Count$") {
            $json[$fieldId] = "150"
        } elseif ($fieldId -match "Size$") {
            $json[$fieldId] = "75000"
        } elseif ($fieldId -match "Hours$") {
            $json[$fieldId] = "24/7"
        } elseif ($fieldId -match "Access$") {
            $json[$fieldId] = "Restricted"
        } elseif ($fieldId -match "Type$") {
            $json[$fieldId] = "Industrial"
        } elseif ($fieldId -match "Sector$") {
            $json[$fieldId] = "Manufacturing"
        } elseif ($fieldId -match "Organization$") {
            $json[$fieldId] = "CISA"
        } elseif ($fieldId -match "Office$") {
            $json[$fieldId] = "Miami Office"
        } elseif ($fieldId -match "Badge$") {
            $json[$fieldId] = "PSA-001"
        } elseif ($fieldId -match "Mobile$") {
            $json[$fieldId] = "(305) 555-1235"
        } elseif ($fieldId -match "Latitude$") {
            $json[$fieldId] = "25.7617"
        } elseif ($fieldId -match "Longitude$") {
            $json[$fieldId] = "-80.1918"
        } else {
            $json[$fieldId] = ""
        }
    }
}

# Add custom VOFCs
$json["customCategory1"] = "Physical Security"
$json["customVulnerability1"] = "Insufficient perimeter lighting creates security blind spots"
$json["customOFC1"] = "Install additional LED security lighting with motion sensors"

$json["customCategory2"] = "Cybersecurity"
$json["customVulnerability2"] = "Outdated network equipment increases cyber attack risk"
$json["customOFC2"] = "Implement network segmentation and upgrade infrastructure"

$json["customCategory3"] = "Personnel Security"
$json["customVulnerability3"] = "Incomplete background check procedures for contractors"
$json["customOFC3"] = "Establish comprehensive background check requirements"

# Add commendables
$json["commendableCategory1"] = "Emergency Preparedness"
$json["commendableAction1"] = "Conducted quarterly emergency response drills"
$json["commendableImpact1"] = "Improved coordination during emergency situations"

$json["commendableCategory2"] = "Information Sharing"
$json["commendableAction2"] = "Active participation in InfraGard program"
$json["commendableImpact2"] = "Enhanced threat intelligence capabilities"

$json["commendableCategory3"] = "Physical Security"
$json["commendableAction3"] = "Implemented 24/7 security personnel"
$json["commendableImpact3"] = "Significantly improved facility security posture"

# Assessment metrics
$json["totalStandards"] = 45
$json["totalStandardsMet"] = 28
$json["totalStandardsLost"] = 17
$json["totalVofcs"] = 8
$json["totalEnhancementOptions"] = 12
$json["totalCommendables"] = 6
$json["securityPercentage"] = 62
$json["postureLevel"] = "Medium"

# Metadata
$json["exportDate"] = "2025-01-27T18:30:00.000Z"
$json["exportVersion"] = "ALT SAFE Beta"
$json["totalFields"] = $json.PSObject.Properties.Count

# Save the complete realistic South Florida JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json" -Encoding UTF8

Write-Host "`n=== COMPLETE REALISTIC JSON CREATED ===" -ForegroundColor Green
Write-Host "Facility: South Florida Manufacturing Corp"
Write-Host "Address: 12345 NW 12th Street, Miami, FL 33126"
Write-Host "Valid Miami address with proper coordinates"
Write-Host "REALISTIC CONDITIONALS:"
Write-Host "- YES responses: Only 1-2 Comp checkboxes selected per question"
Write-Host "- NO responses: Only 1 NoOFC checkbox selected per question"
Write-Host "- This creates a realistic mid-level assessment with gaps"
Write-Host "Total fields: $($json.PSObject.Properties.Count)"
Write-Host "This is now a complete, realistic, testable assessment!"
