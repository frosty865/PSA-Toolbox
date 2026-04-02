# FIX REALISTIC CHECKBOXES - Only select some, not all
$jsonPath = "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json"
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host "=== FIXING REALISTIC CHECKBOXES ===" -ForegroundColor Green

# Clear all Comp and NoOFC checkboxes first
foreach ($key in $json.PSObject.Properties.Name) {
    if ($key -match "Comp[0-9]+$" -or $key -match "NoOFC[0-9]+$") {
        $json[$key] = $false
    }
}

# Now set REALISTIC checkboxes - only some selected, not all
$realisticCheckboxes = @{
    # For YES responses - only select 1-2 out of 3-4 Comp options
    'AwarenessComp1' = $true
    'AwarenessComp2' = $false
    'AwarenessComp3' = $true
    
    'LawEnforcementComp1' = $true
    'LawEnforcementComp2' = $false
    'LawEnforcementComp3' = $false
    
    'FireAgencyComp1' = $true
    'FireAgencyComp2' = $true
    'FireAgencyComp3' = $false
    
    'FireCommComp1' = $true
    'FireCommComp2' = $false
    'FireCommComp3' = $false
    
    'FBIInfoComp1' = $true
    'FBIInfoComp2' = $false
    'FBIInfoComp3' = $true
    
    'InfraGardComp1' = $true
    'InfraGardComp2' = $true
    'InfraGardComp3' = $false
    
    'FederalInfoComp1' = $true
    'FederalInfoComp2' = $false
    'FederalInfoComp3' = $true
    
    'StateLocalInfoComp1' = $true
    'StateLocalInfoComp2' = $true
    'StateLocalInfoComp3' = $false
    
    'SecurityManagerComp1' = $true
    'SecurityManagerComp2' = $false
    'SecurityManagerComp3' = $true
    
    'SecurityPlanComp1' = $true
    'SecurityPlanComp2' = $false
    'SecurityPlanComp3' = $false
    'SecurityPlanComp4' = $true
    
    'PlanCoordinationComp1' = $true
    'PlanCoordinationComp2' = $false
    'PlanCoordinationComp3' = $true
    'PlanCoordinationComp4' = $false
    
    'RiskAssessmentComp1' = $true
    'RiskAssessmentComp2' = $false
    'RiskAssessmentComp3' = $true
    'RiskAssessmentComp4' = $false
    
    'SecurityPersonnelComp1' = $true
    'SecurityPersonnelComp2' = $false
    'SecurityPersonnelComp3' = $true
    
    'AccessControlComp1' = $true
    'AccessControlComp2' = $false
    'AccessControlComp3' = $true
    
    'BuildingEnvelopeComp1' = $true
    'BuildingEnvelopeComp2' = $false
    'BuildingEnvelopeComp3' = $true
    
    'VideoSystemTypeComp1' = $true
    'VideoSystemTypeComp2' = $false
    'VideoSystemTypeComp3' = $true
    
    'VideoMonitoringComp1' = $true
    'VideoMonitoringComp2' = $false
    'VideoMonitoringComp3' = $true
    
    'VideoRecordingComp1' = $true
    'VideoRecordingComp2' = $false
    'VideoRecordingComp3' = $true
    
    'AlarmMonitoringComp1' = $true
    'AlarmMonitoringComp2' = $false
    'AlarmMonitoringComp3' = $true
    
    # For NO responses - only select 1 out of 2-3 NoOFC options
    'LawCommNoOFC1' = $true
    'LawCommNoOFC2' = $false
    
    'MedicalAgencyNoOFC1' = $true
    'MedicalAgencyNoOFC2' = $false
    
    'MedicalCommNoOFC1' = $true
    'MedicalCommNoOFC2' = $false
    
    'ISACInfoNoOFC1' = $true
    'ISACInfoNoOFC2' = $false
    
    'HSINInfoNoOFC1' = $true
    'HSINInfoNoOFC2' = $false
    
    'NeighborInfoNoOFC1' = $true
    'NeighborInfoNoOFC2' = $false
    
    'PlanTrainingNoOFC1' = $true
    'PlanTrainingNoOFC2' = $false
    'PlanTrainingNoOFC3' = $false
    'PlanTrainingNoOFC4' = $false
    
    'EmployeeTrainingNoOFC1' = $true
    'EmployeeTrainingNoOFC2' = $false
    'EmployeeTrainingNoOFC3' = $false
    'EmployeeTrainingNoOFC4' = $false
    
    'PlanTestingNoOFC1' = $true
    'PlanTestingNoOFC2' = $false
    'PlanTestingNoOFC3' = $false
    'PlanTestingNoOFC4' = $false
    
    'PerimeterFencingNoOFC1' = $true
    'PerimeterFencingNoOFC2' = $false
    
    'SecurityLightingNoOFC1' = $true
    'SecurityLightingNoOFC2' = $false
    
    'StandoffDistanceNoOFC1' = $true
    'StandoffDistanceNoOFC2' = $false
    
    'KeyControlNoOFC1' = $true
    'KeyControlNoOFC2' = $false
    
    'VideoCoverageNoOFC1' = $true
    'VideoCoverageNoOFC2' = $false
    
    'IntrusionDetectionNoOFC1' = $true
    'IntrusionDetectionNoOFC2' = $false
    
    'SystemIntegrationNoOFC1' = $true
    'SystemIntegrationNoOFC2' = $false
}

# Set the realistic checkboxes
foreach ($checkbox in $realisticCheckboxes.Keys) {
    if ($json.PSObject.Properties.Name -contains $checkbox) {
        $json[$checkbox] = $realisticCheckboxes[$checkbox]
    }
}

# Save the fixed JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8

Write-Host "Fixed realistic checkboxes:"
Write-Host "- YES responses: Only 1-2 Comp checkboxes selected per question"
Write-Host "- NO responses: Only 1 NoOFC checkbox selected per question"
Write-Host "- This creates a realistic mid-level assessment"
Write-Host "Now it's a proper testable assessment!"
