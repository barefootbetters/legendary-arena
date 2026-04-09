<#
.SYNOPSIS
    Installs EC-mode Git hooks for the Legendary Arena repository.

.DESCRIPTION
    Sets git core.hooksPath to .githooks/ so the repo-local hooks
    (pre-commit, commit-msg) are active. Run this once after cloning
    or whenever hooks are updated.

.EXAMPLE
    pwsh scripts/git/install-ec-hooks.ps1
#>

$ErrorActionPreference = 'Stop'
$repoRoot = git rev-parse --show-toplevel 2>$null

if (-not $repoRoot) {
    Write-Error "Not inside a Git repository. Run this from the Legendary Arena repo root."
    exit 1
}

$hooksDir = Join-Path $repoRoot '.githooks'

if (-not (Test-Path $hooksDir)) {
    Write-Error "Hooks directory not found: $hooksDir"
    exit 1
}

# Verify hook files exist
$requiredHooks = @('pre-commit', 'commit-msg')
foreach ($hook in $requiredHooks) {
    $hookPath = Join-Path $hooksDir $hook
    if (-not (Test-Path $hookPath)) {
        Write-Error "Missing hook file: $hookPath"
        exit 1
    }
}

# Set core.hooksPath (repo-local, not global)
git config core.hooksPath .githooks
$currentPath = git config core.hooksPath

if ($currentPath -ne '.githooks') {
    Write-Error "Failed to set core.hooksPath. Current value: $currentPath"
    exit 1
}

Write-Host ""
Write-Host "EC-mode Git hooks installed successfully." -ForegroundColor Green
Write-Host ""
Write-Host "  Hooks directory: .githooks/"
Write-Host "  core.hooksPath:  $currentPath"
Write-Host ""
Write-Host "Installed hooks:" -ForegroundColor Cyan
foreach ($hook in $requiredHooks) {
    Write-Host "  - $hook"
}
Write-Host ""
Write-Host "Commit message format (enforced):" -ForegroundColor Cyan
Write-Host "  EC-###: <present-tense summary>   (code changes)"
Write-Host "  SPEC: <summary>                   (specification fixes)"
Write-Host "  INFRA: <summary>                  (infrastructure/tooling)"
Write-Host ""
Write-Host "To bypass hooks in an emergency: git commit --no-verify" -ForegroundColor Yellow
Write-Host "  (Prohibited under EC mode except with human approval)" -ForegroundColor Yellow
Write-Host ""
