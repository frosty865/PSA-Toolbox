# CREATE CLEAN ALT SAFE BETA JSON - No template variables
Write-Host "=== CREATING CLEAN ALT SAFE BETA JSON ===" -ForegroundColor Green

# Create clean JSON with South Florida data
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
$json["emergencyContactName"] = "Sarah Johnson"
$json["emergencyContactTitle"] = "Emergency Coordinator"
$json["emergencyContactPhone"] = "(305) 555-0458"
$json["emergencyContactEmail"] = "sarah.johnson@southfloridamfg.com"

# Assessment results
$json["securityPercentage"] = 62
$json["postureLevel"] = "Medium"
$json["totalStandards"] = 135
$json["standardsMet"] = 84
$json["enhancementOpportunities"] = 51

# Information Sharing - Realistic responses
$json["Awareness"] = "yes"
$json["AwarenessComp1"] = $true
$json["AwarenessComp2"] = $false
$json["AwarenessComp3"] = $true

$json["LawEnforcement"] = "yes"
$json["LawCommComp1"] = $true
$json["LawCommComp2"] = $false
$json["LawCommComp3"] = $true

$json["FireAgency"] = "yes"
$json["FireCommComp1"] = $true
$json["FireCommComp2"] = $false
$json["FireCommComp3"] = $true

$json["MedicalAgency"] = "yes"
$json["MedicalCommComp1"] = $true
$json["MedicalCommComp2"] = $false
$json["MedicalCommComp3"] = $true

$json["FBI"] = "no"
$json["FBICommNoOFC1"] = $true
$json["FBICommNoOFC2"] = $false
$json["FBICommNoOFC3"] = $false

$json["ISAC"] = "yes"
$json["ISACCommComp1"] = $true
$json["ISACCommComp2"] = $false
$json["ISACCommComp3"] = $true

$json["HSIN"] = "no"
$json["HSINCommNoOFC1"] = $true
$json["HSINCommNoOFC2"] = $false
$json["HSINCommNoOFC3"] = $false

$json["InfraGard"] = "yes"
$json["InfraGardCommComp1"] = $true
$json["InfraGardCommComp2"] = $false
$json["InfraGardCommComp3"] = $true

$json["FederalAgencies"] = "yes"
$json["FederalCommComp1"] = $true
$json["FederalCommComp2"] = $false
$json["FederalCommComp3"] = $true

$json["StateLocal"] = "yes"
$json["StateLocalCommComp1"] = $true
$json["StateLocalCommComp2"] = $false
$json["StateLocalCommComp3"] = $true

$json["NeighborInfo"] = "no"
$json["NeighborInfoNoOFC1"] = $true
$json["NeighborInfoNoOFC2"] = $false
$json["NeighborInfoNoOFC3"] = $false

# Security Plans - Realistic responses
$json["SecurityManager"] = "yes"
$json["SecurityManagerComp1"] = $true
$json["SecurityManagerComp2"] = $false
$json["SecurityManagerComp3"] = $true

$json["SecurityPlan"] = "yes"
$json["SecurityPlanComp1"] = $true
$json["SecurityPlanComp2"] = $false
$json["SecurityPlanComp3"] = $true
$json["SecurityPlanComp4"] = $false

$json["PlanTraining"] = "yes"
$json["PlanTrainingComp1"] = $true
$json["PlanTrainingComp2"] = $false
$json["PlanTrainingComp3"] = $true
$json["PlanTrainingComp4"] = $false

$json["PlanCoordination"] = "yes"
$json["PlanCoordinationComp1"] = $true
$json["PlanCoordinationComp2"] = $false
$json["PlanCoordinationComp3"] = $true
$json["PlanCoordinationComp4"] = $false

$json["EmployeeTraining"] = "no"
$json["EmployeeTrainingNoOFC1"] = $true
$json["EmployeeTrainingNoOFC2"] = $false
$json["EmployeeTrainingNoOFC3"] = $false
$json["EmployeeTrainingNoOFC4"] = $false

$json["PlanTesting"] = "yes"
$json["PlanTestingComp1"] = $true
$json["PlanTestingComp2"] = $false
$json["PlanTestingComp3"] = $true
$json["PlanTestingComp4"] = $false

$json["RiskAssessment"] = "yes"
$json["RiskAssessmentComp1"] = $true
$json["RiskAssessmentComp2"] = $false
$json["RiskAssessmentComp3"] = $true

# Physical Security - Realistic responses
$json["SecurityPersonnel"] = "yes"
$json["SecurityPersonnelComp1"] = $true
$json["SecurityPersonnelComp2"] = $false
$json["SecurityPersonnelComp3"] = $true

$json["PerimeterFencing"] = "yes"
$json["PerimeterFencingComp1"] = $true
$json["PerimeterFencingComp2"] = $false
$json["PerimeterFencingComp3"] = $true

$json["AccessControl"] = "yes"
$json["AccessControlComp1"] = $true
$json["AccessControlComp2"] = $false
$json["AccessControlComp3"] = $true

$json["SecurityLighting"] = "no"
$json["SecurityLightingNoOFC1"] = $true
$json["SecurityLightingNoOFC2"] = $false
$json["SecurityLightingNoOFC3"] = $false

$json["StandoffDistance"] = "yes"
$json["StandoffDistanceComp1"] = $true
$json["StandoffDistanceComp2"] = $false
$json["StandoffDistanceComp3"] = $true

$json["BuildingEnvelope"] = "yes"
$json["BuildingEnvelopeComp1"] = $true
$json["BuildingEnvelopeComp2"] = $false
$json["BuildingEnvelopeComp3"] = $true

$json["KeyControl"] = "no"
$json["KeyControlNoOFC1"] = $true
$json["KeyControlNoOFC2"] = $false
$json["KeyControlNoOFC3"] = $false

# Security Systems - Realistic responses
$json["VideoSurveillance"] = "yes"
$json["VideoSurveillanceComp1"] = $true
$json["VideoSurveillanceComp2"] = $false
$json["VideoSurveillanceComp3"] = $true

$json["VideoCoverage"] = "yes"
$json["VideoCoverageComp1"] = $true
$json["VideoCoverageComp2"] = $false
$json["VideoCoverageComp3"] = $true

$json["VideoMonitoring"] = "yes"
$json["VideoMonitoringComp1"] = $true
$json["VideoMonitoringComp2"] = $false
$json["VideoMonitoringComp3"] = $true

$json["VideoRecording"] = "no"
$json["VideoRecordingNoOFC1"] = $true
$json["VideoRecordingNoOFC2"] = $false
$json["VideoRecordingNoOFC3"] = $false

$json["IntrusionDetection"] = "yes"
$json["IntrusionDetectionComp1"] = $true
$json["IntrusionDetectionComp2"] = $false
$json["IntrusionDetectionComp3"] = $true

$json["AlarmMonitoring"] = "yes"
$json["AlarmMonitoringComp1"] = $true
$json["AlarmMonitoringComp2"] = $false
$json["AlarmMonitoringComp3"] = $true

$json["SystemIntegration"] = "no"
$json["SystemIntegrationNoOFC1"] = $true
$json["SystemIntegrationNoOFC2"] = $false
$json["SystemIntegrationNoOFC3"] = $false

# Custom Vulnerabilities
$json["customVulnerability1"] = "Insufficient perimeter lighting creates security blind spots"
$json["customCategory1"] = "Physical Security"
$json["customVulnRec1"] = "Install additional LED security lighting around facility perimeter"

$json["customVulnerability2"] = "Outdated network equipment increases cyber attack risk"
$json["customCategory2"] = "Personnel Security"
$json["customVulnRec2"] = "Upgrade network infrastructure to current security standards"

$json["customVulnerability3"] = "Visitor management system lacks integration with security systems"
$json["customCategory3"] = "Access Control"
$json["customVulnRec3"] = "Implement integrated visitor management and access control system"

# Commendable Actions
$json["commendableAction1"] = "Implemented comprehensive security awareness training program"
$json["commendableImpact1"] = "Improved employee security awareness and incident reporting"

$json["commendableAction2"] = "Established 24/7 security monitoring center"
$json["commendableImpact2"] = "Enhanced threat intelligence capabilities"

$json["commendableAction3"] = "Implemented 24/7 security personnel"
$json["commendableImpact3"] = "Improved physical security presence and response capabilities"

# Metadata
$json["exportDate"] = "2025-01-27T18:30:00.000Z"
$json["exportVersion"] = "ALT SAFE Beta"
$json["totalFields"] = $json.PSObject.Properties.Count

# Save the clean JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath "C:\Users\frost\OneDrive\Desktop\Projects\JSON\ALT_SAFE_Beta_Clean.json" -Encoding UTF8

Write-Host "=== CLEAN ALT SAFE BETA JSON CREATED ===" -ForegroundColor Green
Write-Host "Facility: $($json.facilityName)" -ForegroundColor Yellow
Write-Host "Address: $($json.facilityAddress), $($json.facilityCity), $($json.facilityState) $($json.facilityZip)" -ForegroundColor Yellow
Write-Host "Security Percentage: $($json.securityPercentage)%" -ForegroundColor Yellow
Write-Host "Total Fields: $($json.totalFields)" -ForegroundColor Yellow
Write-Host "No template variables - Clean JSON ready for import!" -ForegroundColor Green
