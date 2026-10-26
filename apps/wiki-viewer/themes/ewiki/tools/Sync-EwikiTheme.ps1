<#
.SYNOPSIS
Vendors one version of the ewiki theme into a wiki's themes/ewiki folder and
writes its manifest.

.DESCRIPTION
Run from a clone of barefootbetters/bb-studio-ewiki-theme (this script finds the clone
from its own location). It extracts the theme at -Version with
`git -c core.autocrlf=false archive`, using the fixed pathspec
`layouts assets tools theme.toml README.md`, so CHANGELOG.md, docs/,
exampleSite/ and .github/ never ship. It replaces the -Target tree, then
writes two files there:

- THEME-VERSION, one line: `<tag> <commit>`, or `untagged <commit>`.
- .theme-manifest.txt: a line `commit <sha>`, then one `<sha256>  <path>`
  line per vendored file, in ordinal path order, with `/` separators, as
  UTF-8 without a BOM, LF line endings and a trailing newline. Text files
  (.html .css .ps1 .md .toml .json .txt .svg) are hashed with CRLF turned
  into LF; every other file is hashed as raw bytes.

It prints the manifest digest, the SHA-256 of the LF-normalized manifest
bytes. A consumer pins that digest outside the vendored tree (D-24728).

.PARAMETER Version
A tag (v1.0.0) or HEAD. A tag is recorded in THEME-VERSION; anything else
records `untagged`.

.PARAMETER Target
The folder to vendor into, normally <site>/themes/ewiki. It must be missing,
empty, or an earlier sync (it holds .theme-manifest.txt).

.EXAMPLE
pwsh -File tools/Sync-EwikiTheme.ps1 -Version v1.0.0 -Target ../my-wiki/themes/ewiki
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Version,

    [Parameter(Mandatory = $true)]
    [string] $Target
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# why: the pathspec and the text-extension list are locked values (WP-814,
# EC-852). Leaving CHANGELOG.md out keeps release notes outside the manifest,
# so recording a digest never changes it.
$ArchivePathspec = @('layouts', 'assets', 'tools', 'theme.toml', 'README.md')
$TextExtensions = @('.html', '.css', '.ps1', '.md', '.toml', '.json', '.txt', '.svg')
$ManifestName = '.theme-manifest.txt'
$VersionFileName = 'THEME-VERSION'

function Invoke-ThemeGit {
    <#
    .SYNOPSIS
    Runs git in the theme clone and returns its output, throwing on failure.
    .PARAMETER Repository
    The theme clone's root folder.
    .PARAMETER Arguments
    The git arguments.
    #>
    param([string] $Repository, [string[]] $Arguments)
    $output = & git -C $Repository @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Sync-EwikiTheme.ps1: 'git $($Arguments -join ' ')' failed in $Repository with: $output. Check that $Repository is a clone of barefootbetters/bb-studio-ewiki-theme and that the version exists there."
    }
    return $output
}

function Resolve-ThemeVersion {
    <#
    .SYNOPSIS
    Resolves -Version to a commit and the label THEME-VERSION records.
    .PARAMETER Repository
    The theme clone's root folder.
    .PARAMETER RequestedVersion
    A tag name or HEAD.
    #>
    param([string] $Repository, [string] $RequestedVersion)
    $commit = (Invoke-ThemeGit $Repository @('rev-parse', '--verify', "$RequestedVersion^{commit}")) | Select-Object -Last 1
    $label = 'untagged'
    & git -C $Repository show-ref --verify --quiet "refs/tags/$RequestedVersion" 2>$null
    if ($LASTEXITCODE -eq 0) {
        $label = $RequestedVersion
    }
    return [pscustomobject]@{ Commit = $commit.Trim(); Label = $label }
}

function Clear-SyncTarget {
    <#
    .SYNOPSIS
    Empties the target folder, refusing one that isn't a theme sync.
    .PARAMETER Path
    The full target path.
    #>
    param([string] $Path)
    if (Test-Path -LiteralPath $Path) {
        $entries = @(Get-ChildItem -LiteralPath $Path -Force)
        $isEarlierSync = Test-Path -LiteralPath (Join-Path $Path $ManifestName)
        if ($entries.Count -gt 0 -and -not $isEarlierSync) {
            throw "Sync-EwikiTheme.ps1: the target $Path is not empty and holds no $ManifestName, so it isn't an earlier theme sync. Point -Target at <site>/themes/ewiki, or empty the folder first."
        }
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Export-ThemeArchive {
    <#
    .SYNOPSIS
    Extracts the theme's fixed pathspec at a commit into the target folder.
    .PARAMETER Repository
    The theme clone's root folder.
    .PARAMETER Commit
    The commit to extract.
    .PARAMETER Path
    The full, empty target path.
    #>
    param([string] $Repository, [string] $Commit, [string] $Path)
    $archive = Join-Path ([System.IO.Path]::GetTempPath()) ("ewiki-theme-{0}.tar" -f [guid]::NewGuid())
    try {
        Invoke-ThemeGit $Repository (@('-c', 'core.autocrlf=false', 'archive', '--format=tar', "--output=$archive", $Commit, '--') + $ArchivePathspec) | Out-Null
        # why: .NET's own tar reader, not a tar binary, so a Windows drive
        # letter is never read as a remote host and no tool must be on PATH.
        [System.Formats.Tar.TarFile]::ExtractToDirectory($archive, $Path, $false)
    }
    finally {
        Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
    }
}

function Get-NormalizedFileHash {
    <#
    .SYNOPSIS
    Returns a file's lowercase SHA-256, with CRLF turned into LF for text files.
    .PARAMETER Path
    The file to hash.
    #>
    param([string] $Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($TextExtensions -contains $extension) {
        $bytes = ConvertTo-LfBytes $bytes
    }
    return Get-ByteHash $bytes
}

function ConvertTo-LfBytes {
    <#
    .SYNOPSIS
    Returns the bytes with every CRLF pair turned into a single LF.
    .PARAMETER Bytes
    The bytes to normalize.
    #>
    param([byte[]] $Bytes)
    $stream = [System.IO.MemoryStream]::new($Bytes.Length)
    for ($index = 0; $index -lt $Bytes.Length; $index++) {
        $isCarriageReturnBeforeLineFeed = $Bytes[$index] -eq 13 -and ($index + 1) -lt $Bytes.Length -and $Bytes[$index + 1] -eq 10
        if (-not $isCarriageReturnBeforeLineFeed) {
            $stream.WriteByte($Bytes[$index])
        }
    }
    return $stream.ToArray()
}

function Get-ByteHash {
    <#
    .SYNOPSIS
    Returns the lowercase hex SHA-256 of a byte array.
    .PARAMETER Bytes
    The bytes to hash.
    #>
    param([byte[]] $Bytes)
    $hash = [System.Security.Cryptography.SHA256]::HashData($Bytes)
    return ([System.Convert]::ToHexString($hash)).ToLowerInvariant()
}

function Write-ThemeManifest {
    <#
    .SYNOPSIS
    Writes .theme-manifest.txt for the vendored tree and returns its digest.
    .PARAMETER Path
    The full target path.
    .PARAMETER Commit
    The vendored commit.
    #>
    param([string] $Path, [string] $Commit)
    $root = (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\', '/')
    $relativePaths = Get-ChildItem -LiteralPath $root -Recurse -File -Force |
        ForEach-Object { $_.FullName.Substring($root.Length + 1).Replace('\', '/') } |
        Where-Object { $_ -ne $ManifestName -and $_ -ne $VersionFileName }
    $sorted = [string[]] @($relativePaths)
    [System.Array]::Sort($sorted, [System.StringComparer]::Ordinal)
    $builder = [System.Text.StringBuilder]::new()
    [void] $builder.Append("commit $Commit`n")
    foreach ($relativePath in $sorted) {
        $fileHash = Get-NormalizedFileHash (Join-Path $root $relativePath)
        [void] $builder.Append("$fileHash  $relativePath`n")
    }
    $manifestBytes = [System.Text.UTF8Encoding]::new($false).GetBytes($builder.ToString())
    [System.IO.File]::WriteAllBytes((Join-Path $root $ManifestName), $manifestBytes)
    return [pscustomobject]@{ Digest = (Get-ByteHash (ConvertTo-LfBytes $manifestBytes)); FileCount = $sorted.Count }
}

function Invoke-ThemeSync {
    <#
    .SYNOPSIS
    Runs the sync: resolve, clear, extract, stamp, manifest, report.
    #>
    $repository = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
    if (-not (Test-Path -LiteralPath (Join-Path $repository 'theme.toml'))) {
        throw "Sync-EwikiTheme.ps1: $repository has no theme.toml, so this copy of the script isn't running from a theme clone. Run tools/Sync-EwikiTheme.ps1 from a clone of barefootbetters/bb-studio-ewiki-theme, not from a vendored copy."
    }
    $resolved = Resolve-ThemeVersion $repository $Version
    $targetPath = [System.IO.Path]::GetFullPath($Target, (Get-Location).Path)
    Clear-SyncTarget $targetPath
    Export-ThemeArchive $repository $resolved.Commit $targetPath
    $versionLine = [System.Text.UTF8Encoding]::new($false).GetBytes("$($resolved.Label) $($resolved.Commit)`n")
    [System.IO.File]::WriteAllBytes((Join-Path $targetPath $VersionFileName), $versionLine)
    $manifest = Write-ThemeManifest $targetPath $resolved.Commit
    Write-Host "Synced ewiki theme $($resolved.Label) $($resolved.Commit) into $targetPath ($($manifest.FileCount) files)."
    Write-Host "Manifest SHA-256: $($manifest.Digest)"
}

Invoke-ThemeSync
