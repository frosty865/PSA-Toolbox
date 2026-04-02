# FIX ALL CONDITIONAL CHECKBOXES - Complete realistic assessment
$jsonPath = "C:\Users\frost\OneDrive\Desktop\Projects\JSON\Test SAFE3.json"
$json = Get-Content $jsonPath -Raw | ConvertFrom-Json

Write-Host "=== FIXING ALL CONDITIONAL CHECKBOXES ===" -ForegroundColor Green

# Clear all conditional checkboxes first
foreach ($key in $json.PSObject.Properties.Name) {
    if ($key -match "Comp[0-9]+$" -or $key -match "NoOFC[0-9]+$") {
        $json[$key] = $false
    }
}

# Define realistic checkbox selections for each question
$realisticConditionals = @{
    # Awareness - YES response
    'AwarenessComp1' = $true   # Regular employee training
    'AwarenessComp2' = $false  # Visible signage
    'AwarenessComp3' = $true   # Clear reporting procedures
    'AwarenessNoOFC1' = $false # Not applicable for YES
    
    # LawEnforcement - YES response
    'LawEnforcementComp1' = $true   # Annual visits
    'LawEnforcementComp2' = $false  # Facility tour
    'LawEnforcementComp3' = $true   # Emergency response booklet
    'LawEnforcementNoOFC1' = $false # Not applicable for YES
    'LawEnforcementNoOFC2' = $false
    'LawEnforcementNoOFC3' = $false
    
    # LawComm - NO response
    'LawCommComp1' = $false  # Not applicable for NO
    'LawCommComp2' = $false
    'LawCommComp3' = $false
    'LawCommNoOFC1' = $true  # Only select first option
    'LawCommNoOFC2' = $false
    
    # FireAgency - YES response
    'FireAgencyComp1' = $true   # Annual visits
    'FireAgencyComp2' = $false  # Facility tour
    'FireAgencyComp3' = $true   # Emergency response booklet
    'FireAgencyNoOFC1' = $false # Not applicable for YES
    'FireAgencyNoOFC2' = $false
    
    # FireComm - YES response
    'FireCommComp1' = $true   # Regular communication
    'FireCommComp2' = $false  # Emergency procedures
    'FireCommComp3' = $true   # Contact information
    'FireCommNoOFC1' = $false # Not applicable for YES
    
    # MedicalAgency - NO response
    'MedicalAgencyComp1' = $false  # Not applicable for NO
    'MedicalAgencyComp2' = $false
    'MedicalAgencyComp3' = $false
    'MedicalAgencyNoOFC1' = $true  # Only select first option
    'MedicalAgencyNoOFC2' = $false
    
    # MedicalComm - NO response
    'MedicalCommComp1' = $false  # Not applicable for NO
    'MedicalCommComp2' = $false
    'MedicalCommComp3' = $false
    'MedicalCommNoOFC1' = $true  # Only select first option
    'MedicalCommNoOFC2' = $false
    
    # FBIInfo - YES response
    'FBIInfoComp1' = $true   # Regular information sharing
    'FBIInfoComp2' = $false  # Threat briefings
    'FBIInfoComp3' = $true   # Contact information
    'FBIInfoNoOFC1' = $false # Not applicable for YES
    
    # ISACInfo - NO response
    'ISACInfoComp1' = $false  # Not applicable for NO
    'ISACInfoComp2' = $false
    'ISACInfoComp3' = $false
    'ISACInfoNoOFC1' = $true  # Only select first option
    
    # HSINInfo - NO response
    'HSINInfoComp1' = $false  # Not applicable for NO
    'HSINInfoComp2' = $false
    'HSINInfoComp3' = $false
    'HSINInfoNoOFC1' = $true  # Only select first option
    
    # InfraGard - YES response
    'InfraGardComp1' = $true   # Active participation
    'InfraGardComp2' = $false  # Regular meetings
    'InfraGardComp3' = $true   # Information sharing
    'InfraGardNoOFC1' = $false # Not applicable for YES
    
    # FederalInfo - YES response
    'FederalInfoComp1' = $true   # Regular information sharing
    'FederalInfoComp2' = $false  # Threat briefings
    'FederalInfoComp3' = $true   # Contact information
    'FederalInfoNoOFC1' = $false # Not applicable for YES
    'FederalInfoNoOFC2' = $false
    
    # StateLocalInfo - YES response
    'StateLocalInfoComp1' = $true   # Regular information sharing
    'StateLocalInfoComp2' = $false  # Threat briefings
    'StateLocalInfoComp3' = $true   # Contact information
    'StateLocalInfoNoOFC1' = $false # Not applicable for YES
    'StateLocalInfoNoOFC2' = $false
    'StateLocalInfoNoOFC3' = $false
    
    # NeighborInfo - NO response
    'NeighborInfoComp1' = $false  # Not applicable for NO
    'NeighborInfoComp2' = $false
    'NeighborInfoComp3' = $false
    'NeighborInfoNoOFC1' = $true  # Only select first option
    
    # SecurityManager - YES response
    'SecurityManagerComp1' = $true   # Dedicated security manager
    'SecurityManagerComp2' = $false  # Security training
    'SecurityManagerComp3' = $true   # Regular assessments
    'SecurityManagerNoOFC1' = $false # Not applicable for YES
    
    # SecurityPlan - YES response
    'SecurityPlanComp1' = $true   # Written security plan
    'SecurityPlanComp2' = $false  # Regular updates
    'SecurityPlanComp3' = $true   # Employee training
    'SecurityPlanComp4' = $false  # Emergency procedures
    'SecurityPlanNoOFC1' = $false # Not applicable for YES
    'SecurityPlanNoOFC2' = $false
    'SecurityPlanNoOFC3' = $false
    
    # PlanTraining - NO response
    'PlanTrainingComp1' = $false  # Not applicable for NO
    'PlanTrainingComp2' = $false
    'PlanTrainingComp3' = $false
    'PlanTrainingComp4' = $false
    'PlanTrainingNoOFC1' = $true  # Only select first option
    'PlanTrainingNoOFC2' = $false
    'PlanTrainingNoOFC3' = $false
    'PlanTrainingNoOFC4' = $false
    
    # PlanCoordination - YES response
    'PlanCoordinationComp1' = $true   # Regular coordination
    'PlanCoordinationComp2' = $false  # Emergency procedures
    'PlanCoordinationComp3' = $true   # Contact information
    'PlanCoordinationComp4' = $false  # Training programs
    'PlanCoordinationNoOFC1' = $false # Not applicable for YES
    'PlanCoordinationNoOFC2' = $false
    'PlanCoordinationNoOFC3' = $false
    'PlanCoordinationNoOFC4' = $false
    'PlanCoordinationNoOFC5' = $false
    'PlanCoordinationNoOFC6' = $false
    
    # EmployeeTraining - NO response
    'EmployeeTrainingComp1' = $false  # Not applicable for NO
    'EmployeeTrainingComp2' = $false
    'EmployeeTrainingComp3' = $false
    'EmployeeTrainingComp4' = $false
    'EmployeeTrainingNoOFC1' = $true  # Only select first option
    'EmployeeTrainingNoOFC2' = $false
    'EmployeeTrainingNoOFC3' = $false
    'EmployeeTrainingNoOFC4' = $false
    
    # PlanTesting - NO response
    'PlanTestingComp1' = $false  # Not applicable for NO
    'PlanTestingComp2' = $false
    'PlanTestingComp3' = $false
    'PlanTestingComp4' = $false
    'PlanTestingNoOFC1' = $true  # Only select first option
    'PlanTestingNoOFC2' = $false
    'PlanTestingNoOFC3' = $false
    'PlanTestingNoOFC4' = $false
    
    # RiskAssessment - YES response
    'RiskAssessmentComp1' = $true   # Regular risk assessments
    'RiskAssessmentComp2' = $false  # Threat analysis
    'RiskAssessmentComp3' = $true   # Vulnerability assessments
    'RiskAssessmentComp4' = $false  # Mitigation strategies
    'RiskAssessmentNoOFC1' = $false # Not applicable for YES
    'RiskAssessmentNoOFC2' = $false
    'RiskAssessmentNoOFC3' = $false
    'RiskAssessmentNoOFC4' = $false
    
    # SecurityPersonnel - YES response
    'SecurityPersonnelComp1' = $true   # Dedicated security personnel
    'SecurityPersonnelComp2' = $false  # Security training
    'SecurityPersonnelComp3' = $true   # Regular patrols
    'SecurityPersonnelNoOFC1' = $false # Not applicable for YES
    'SecurityPersonnelNoOFC2' = $false
    'SecurityPersonnelNoOFC3' = $false
    
    # PerimeterFencing - NO response
    'PerimeterFencingComp1' = $false  # Not applicable for NO
    'PerimeterFencingComp2' = $false
    'PerimeterFencingNoOFC1' = $true  # Only select first option
    'PerimeterFencingNoOFC2' = $false
    
    # AccessControl - YES response
    'AccessControlComp1' = $true   # Access control system
    'AccessControlComp2' = $false  # Visitor management
    'AccessControlComp3' = $true   # Employee badges
    'AccessControlNoOFC1' = $false # Not applicable for YES
    'AccessControlNoOFC2' = $false
    'AccessControlNoOFC3' = $false
    
    # SecurityLighting - NO response
    'SecurityLightingComp1' = $false  # Not applicable for NO
    'SecurityLightingComp2' = $false
    'SecurityLightingNoOFC1' = $true  # Only select first option
    'SecurityLightingNoOFC2' = $false
    
    # StandoffDistance - NO response
    'StandoffDistanceComp1' = $false  # Not applicable for NO
    'StandoffDistanceComp2' = $false
    'StandoffDistanceNoOFC1' = $true  # Only select first option
    'StandoffDistanceNoOFC2' = $false
    
    # BuildingEnvelope - YES response
    'BuildingEnvelopeComp1' = $true   # Secure building envelope
    'BuildingEnvelopeComp2' = $false  # Reinforced doors
    'BuildingEnvelopeComp3' = $true   # Security windows
    'BuildingEnvelopeNoOFC1' = $false # Not applicable for YES
    'BuildingEnvelopeNoOFC2' = $false
    'BuildingEnvelopeNoOFC3' = $false
    
    # KeyControl - NO response
    'KeyControlComp1' = $false  # Not applicable for NO
    'KeyControlComp2' = $false
    'KeyControlNoOFC1' = $true  # Only select first option
    'KeyControlNoOFC2' = $false
    
    # VideoSystemType - YES response
    'VideoSystemTypeComp1' = $true   # Digital video system
    'VideoSystemTypeComp2' = $false  # Analog system
    'VideoSystemTypeComp3' = $true   # IP cameras
    'VideoSystemTypeNoOFC1' = $false # Not applicable for YES
    'VideoSystemTypeNoOFC2' = $false
    'VideoSystemTypeNoOFC3' = $false
    
    # VideoCoverage - NO response
    'VideoCoverageComp1' = $false  # Not applicable for NO
    'VideoCoverageComp2' = $false
    'VideoCoverageNoOFC1' = $true  # Only select first option
    'VideoCoverageNoOFC2' = $false
    
    # VideoMonitoring - YES response
    'VideoMonitoringComp1' = $true   # 24/7 monitoring
    'VideoMonitoringComp2' = $false  # Remote monitoring
    'VideoMonitoringComp3' = $true   # Alert system
    'VideoMonitoringNoOFC1' = $false # Not applicable for YES
    'VideoMonitoringNoOFC2' = $false
    'VideoMonitoringNoOFC3' = $false
    
    # VideoRecording - YES response
    'VideoRecordingComp1' = $true   # Digital recording
    'VideoRecordingComp2' = $false  # Cloud storage
    'VideoRecordingComp3' = $true   # Retention policy
    'VideoRecordingNoOFC1' = $false # Not applicable for YES
    'VideoRecordingNoOFC2' = $false
    'VideoRecordingNoOFC3' = $false
    
    # IntrusionDetection - NO response
    'IntrusionDetectionComp1' = $false  # Not applicable for NO
    'IntrusionDetectionComp2' = $false
    'IntrusionDetectionNoOFC1' = $true  # Only select first option
    'IntrusionDetectionNoOFC2' = $false
    
    # AlarmMonitoring - YES response
    'AlarmMonitoringComp1' = $true   # Central monitoring station
    'AlarmMonitoringComp2' = $false  # Local monitoring
    'AlarmMonitoringComp3' = $true   # Response procedures
    'AlarmMonitoringNoOFC1' = $false # Not applicable for YES
    'AlarmMonitoringNoOFC2' = $false
    'AlarmMonitoringNoOFC3' = $false
    
    # SystemIntegration - NO response
    'SystemIntegrationComp1' = $false  # Not applicable for NO
    'SystemIntegrationComp2' = $false
    'SystemIntegrationNoOFC1' = $true  # Only select first option
    'SystemIntegrationNoOFC2' = $false
}

# Set all conditional checkboxes
foreach ($checkbox in $realisticConditionals.Keys) {
    if ($json.PSObject.Properties.Name -contains $checkbox) {
        $json[$checkbox] = $realisticConditionals[$checkbox]
    }
}

# Save the fixed JSON
$json | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonPath -Encoding UTF8

Write-Host "Fixed ALL conditional checkboxes:"
Write-Host "- YES responses: Realistic Comp checkbox selections (1-2 per question)"
Write-Host "- NO responses: Realistic NoOFC checkbox selections (1 per question)"
Write-Host "- Total conditionals set: $($realisticConditionals.Count)"
Write-Host "This creates a realistic mid-level assessment with proper conditionals!"
