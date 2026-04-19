# Combine-Themes.ps1
$themesDir = "C:\pcloud\BB\DEV\legendary-arena\content\themes"
$outFile   = Join-Path $themesDir "00-ALL_THEMES_COMBINED.json"

# Read each .json file, parse it, and collect objects into an array.
$combined = @()

Get-ChildItem -Path $themesDir -Filter "*.json" -File |
  Sort-Object Name |
  ForEach-Object {
    $path = $_.FullName
    try {
      $raw = Get-Content -Path $path -Raw -Encoding UTF8
      if ([string]::IsNullOrWhiteSpace($raw)) {
        Write-Warning "Skipping empty file: $($_.Name)"
        return
      }

      $obj = $raw | ConvertFrom-Json -ErrorAction Stop

      # If a file contains a JSON array, append its elements; otherwise append the object.
      if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string]) -and $obj.GetType().Name -eq "Object[]") {
        $combined += $obj
      } else {
        $combined += $obj
      }
    }
    catch {
      Write-Warning "Failed to parse JSON in file: $($_.Name)  ->  $($_.Exception.Message)"
    }
  }

# Write pretty JSON (increase -Depth if your theme objects are deeply nested)
$combined | ConvertTo-Json -Depth 50 | Set-Content -Path $outFile -Encoding UTF8

Write-Host "Wrote $($combined.Count) theme item(s) to: $outFile"