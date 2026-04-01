param(
  [string]$WorkbookPath = "D:\ADA\Asset Dependency Visualization.xlsm",
  [string]$SheetName = "Wastewater"
)

Write-Host "Updating chart axis titles in worksheet '$SheetName' for workbook: $WorkbookPath"

if (-not (Test-Path -Path $WorkbookPath)) {
  Write-Error "Workbook not found: $WorkbookPath"
  exit 1
}

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $workbook = $excel.Workbooks.Open($WorkbookPath)

  # Try to get the specified sheet; fallback: locate a sheet that contains 'Wastewater' in the name
  $worksheet = $null
  try {
    $worksheet = $workbook.Worksheets.Item($SheetName)
  } catch {
    foreach ($ws in @($workbook.Worksheets)) {
      if ($ws.Name -match "Wastewater") { $worksheet = $ws; break }
    }
  }

  if ($null -eq $worksheet) {
    Write-Error "Worksheet not found: $SheetName"
    $workbook.Close($false)
    $excel.Quit()
    exit 1
  }

  # xlCategory = 1, xlValue = 2; AxisGroup: xlPrimary = 1, xlSecondary = 2
  $xlCategory = 1
  $xlValue = 2
  $xlPrimary = 1
  $xlSecondary = 2

  $charts = $worksheet.ChartObjects()
  $updated = 0
  foreach ($chartObj in @($charts)) {
    $chart = $chartObj.Chart

    # Try primary category (X) axis, fallback to primary value axis for XY charts
    $setXAxis = $false
    try {
      $xAxis = $chart.Axes($xlCategory, $xlPrimary)
      if ($null -ne $xAxis) {
        $xAxis.HasTitle = $true
        $xAxis.AxisTitle.Characters.Text = "Hours"
        $setXAxis = $true
      }
    } catch {}
    if (-not $setXAxis) {
      try {
        $xAxis2 = $chart.Axes($xlValue, $xlPrimary)
        if ($null -ne $xAxis2) {
          $xAxis2.HasTitle = $true
          $xAxis2.AxisTitle.Characters.Text = "Hours"
          $setXAxis = $true
        }
      } catch {}
    }
    if (-not $setXAxis) { Write-Warning "X axis not available on chart '$($chartObj.Name)'" }

    # Primary value (Y) axis
    $setYAxis = $false
    try {
      $yAxis = $chart.Axes($xlValue, $xlPrimary)
      if ($null -ne $yAxis) {
        $yAxis.HasTitle = $true
        $yAxis.AxisTitle.Characters.Text = "Capacity (%)"
        $setYAxis = $true
      }
    } catch {}
    if (-not $setYAxis) { Write-Warning "Y axis not available on chart '$($chartObj.Name)'" }

    $updated += 1
  }

  $workbook.Save()
  $workbook.Close($true)
  $excel.Quit()

  $wsName = $worksheet.Name
  Write-Host "Updated axis titles for $updated chart(s) on '$wsName'."
  exit 0
} catch {
  Write-Error "Failed to update workbook: $($_.Exception.Message)"
  try { if ($workbook) { $workbook.Close($false) } } catch {}
  try { if ($excel) { $excel.Quit() } } catch {}
  exit 1
}
