
# 01-ScriptAddMusicFields.ps1
# Apply musicTheme/musicAIPrompt/musicURL to individual theme JSONs
# using 01-ALL_THEMES_COMBINED.json as the source of truth.

$themesDir    = "C:\pcloud\BB\DEV\legendary-arena\content\themes"
$combinedName = "00-ALL_THEMES_COMBINED.json"
$combinedPath = Join-Path $themesDir $combinedName

# If true, move invalid JSON files into a quarantine folder instead of just reporting them.
$quarantineBadJson = $true
$badJsonDir = Join-Path $themesDir "_badjson"

function Get-FirstNonWhitespaceChar([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  foreach ($ch in $text.ToCharArray()) {
    if (-not [char]::IsWhiteSpace($ch)) { return $ch }
  }
  return $null
}

if (-not (Test-Path $combinedPath)) {
  throw "Combined file not found: $combinedPath"
}

# Load combined array
$combinedRaw = Get-Content -Path $combinedPath -Raw -Encoding UTF8
try {
  $combined = $combinedRaw | ConvertFrom-Json
} catch {
  throw "Failed to parse combined JSON ($combinedName): $($_.Exception.Message)"
}

if (-not ($combined -is [System.Array])) {
  throw "Combined JSON must be an array. Found: $($combined.GetType().FullName)"
}

# Build lookup by themeId
$lookup = @{}
foreach ($t in $combined) {
  $tid = $t.themeId
  if ([string]::IsNullOrWhiteSpace($tid)) {
    throw "Combined contains an item missing themeId."
  }
  $lookup[$tid] = $t
}

# Find target json files (exclude combined)
$files = Get-ChildItem -Path $themesDir -Filter "*.json" -File |
  Where-Object { $_.Name -ne $combinedName }

$updated = 0
$skippedNoThemeId = 0
$skippedNoMatch = 0
$skippedInvalidJson = 0
$errors = 0

$invalidFiles = New-Object System.Collections.Generic.List[string]
$noMatchFiles = New-Object System.Collections.Generic.List[string]

if ($quarantineBadJson -and -not (Test-Path $badJsonDir)) {
  New-Item -ItemType Directory -Path $badJsonDir | Out-Null
}

foreach ($f in $files) {
  try {
    $raw = Get-Content -Path $f.FullName -Raw -Encoding UTF8

    # Fast sanity check: JSON objects/arrays start with { or [
    $first = Get-FirstNonWhitespaceChar $raw
    if ($null -eq $first -or ($first -ne '{' -and $first -ne '[')) {
      Write-Warning "Invalid JSON (first char '$first'): $($f.Name)"
      $skippedInvalidJson++
      $invalidFiles.Add($f.Name) | Out-Null

      if ($quarantineBadJson) {
        Move-Item -Path $f.FullName -Destination (Join-Path $badJsonDir $f.Name) -Force
        Write-Host "  -> moved to $badJsonDir"
      }
      continue
    }

    # Parse JSON
    try {
      $obj = $raw | ConvertFrom-Json
    } catch {
      Write-Warning "Failed to parse JSON in file: $($f.Name) -> $($_.Exception.Message)"
      $skippedInvalidJson++
      $invalidFiles.Add($f.Name) | Out-Null

      if ($quarantineBadJson) {
        Move-Item -Path $f.FullName -Destination (Join-Path $badJsonDir $f.Name) -Force
        Write-Host "  -> moved to $badJsonDir"
      }
      continue
    }

    # Expect an object per file (not an array)
    if ($obj -is [System.Array]) {
      Write-Warning "SKIP (file is an array; expected a single theme object): $($f.Name)"
      $skippedInvalidJson++
      $invalidFiles.Add($f.Name) | Out-Null
      continue
    }

    $themeId = $obj.themeId
    if ([string]::IsNullOrWhiteSpace($themeId)) {
      Write-Warning "SKIP (missing themeId): $($f.Name)"
      $skippedNoThemeId++
      continue
    }

    if (-not $lookup.ContainsKey($themeId)) {
      Write-Warning "SKIP (no match in combined): themeId='$themeId' file=$($f.Name)"
      $skippedNoMatch++
      $noMatchFiles.Add("$($f.Name) (themeId=$themeId)") | Out-Null
      continue
    }

    $src = $lookup[$themeId]

    # Backup once
    $bak = "$($f.FullName).bak"
    if (-not (Test-Path $bak)) {
      Copy-Item -Path $f.FullName -Destination $bak
    }

    # Apply/overwrite the three fields from combined
    $obj.musicTheme   = $src.musicTheme
    $obj.musicAIPrompt = $src.musicAIPrompt
    $obj.musicURL     = $src.musicURL

    # Write back
    $json = $obj | ConvertTo-Json -Depth 50
    Set-Content -Path $f.FullName -Value $json -Encoding UTF8

    Write-Host "UPDATED themeId='$themeId' -> $($f.Name)"
    $updated++
  }
  catch {
    Write-Error "ERROR processing $($f.Name): $($_.Exception.Message)"
    $errors++
  }
}

Write-Host ""
Write-Host "==== SUMMARY ===="
Write-Host "Updated: $updated"
Write-Host "Skipped (missing themeId): $skippedNoThemeId"
Write-Host "Skipped (no match in combined): $skippedNoMatch"
Write-Host "Skipped (invalid JSON): $skippedInvalidJson"
Write-Host "Errors: $errors"

if ($invalidFiles.Count -gt 0) {
  Write-Host ""
  Write-Host "Invalid JSON files:"
  $invalidFiles | ForEach-Object { Write-Host "  - $_" }
}

if ($noMatchFiles.Count -gt 0) {
  Write-Host ""
  Write-Host "No-match files (themeId not found in combined):"
  $noMatchFiles | ForEach-Object { Write-Host "  - $_" }
}
