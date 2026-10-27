<#
.SYNOPSIS
Checks a wiki's vendored ewiki theme against its manifest and pinned digest,
and checks the wiki for files that shadow a core theme file.

.DESCRIPTION
Exits 1, naming each offending file, when:

- a vendored file is missing, extra, or differs from .theme-manifest.txt
  (THEME-VERSION and the manifest itself are exempt from the extra-file
  check);
- the manifest's digest (the SHA-256 of its LF-normalized bytes) differs from
  -ExpectedManifestSha256, when that is given;
- a site file shadows a core theme file, through any of Hugo 0.161.1's
  equivalent layout paths or through a [[module.mounts]] entry;
- the site's CSS declares tokens outside ewiki-brand.css;
- the site has a config/ folder, or its config sets layoutDir or assetDir.

This script is self-contained: it never dot-sources or imports another file,
because a consumer's shell pre-check verifies only this one file's hash before
running it (D-24728 section 3).

.PARAMETER Site
The Hugo project directory (`hugo --source`).

.PARAMETER Config
The site config. Defaults to <Site>/hugo.toml. Mount sources resolve against
-Site, as Hugo resolves them.

.PARAMETER ExpectedManifestSha256
The digest the consumer pins outside the vendored tree.

.EXAMPLE
pwsh -File themes/ewiki/tools/Test-EwikiTheme.ps1 -Site . -ExpectedManifestSha256 <digest>
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Site,

    [string] $Config,

    [string] $ExpectedManifestSha256
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ManifestName = '.theme-manifest.txt'
$VersionFileName = 'THEME-VERSION'
$TextExtensions = @('.html', '.css', '.ps1', '.md', '.toml', '.json', '.txt', '.svg')
$ExtensionPoints = @(
    '_partials/ewiki/sidebar.html', '_partials/ewiki/metadata.html', '_partials/ewiki/after-content.html',
    '_partials/ewiki/editing-extra.html', '_partials/ewiki/head-end.html', '_partials/ewiki/body-end.html'
)
$SpecialFolders = @('_default', '_partials', 'partials', '_shortcodes', 'shortcodes', '_markup')
$ShadowKindPattern = '^(page|section|taxonomy|term|single|list|baseof)(\.[^/]+)?$'
$SectionKindPattern = '^(single|list|page|section|taxonomy|term)(\.[^/]+)?$'
$Failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    <#
    .SYNOPSIS
    Records one failure, naming the file and the fix.
    .PARAMETER Path
    The offending file or folder.
    .PARAMETER Message
    What is wrong and how to fix it, as full sentences.
    #>
    param([string] $Path, [string] $Message)
    $Failures.Add("Test-EwikiTheme: ${Path}: $Message")
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
    return ([System.Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($Bytes))).ToLowerInvariant()
}

function Get-NormalizedFileHash {
    <#
    .SYNOPSIS
    Returns a file's SHA-256, with CRLF turned into LF for text files.
    .PARAMETER Path
    The file to hash.
    #>
    param([string] $Path)
    # why: text is hashed LF-normalized, so a Windows checkout with CRLF line
    # endings and a Linux checkout agree on every hash (D-24728 section 2).
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($TextExtensions -contains [System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        $bytes = ConvertTo-LfBytes $bytes
    }
    return Get-ByteHash $bytes
}

function Get-RelativeFile {
    <#
    .SYNOPSIS
    Lists every file under a folder as a /-separated path relative to it.
    .PARAMETER Root
    The folder to list.
    #>
    param([string] $Root)
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        return @()
    }
    $full = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\', '/')
    return @(Get-ChildItem -LiteralPath $full -Recurse -File -Force |
        ForEach-Object { $_.FullName.Substring($full.Length + 1).Replace('\', '/') })
}

function Get-ConfigValue {
    <#
    .SYNOPSIS
    Returns a top-level string value from TOML config lines, or $null.
    .PARAMETER Lines
    The config file's lines.
    .PARAMETER Key
    The key to find, matched case-insensitively.
    #>
    param([string[]] $Lines, [string] $Key)
    foreach ($line in $Lines) {
        if ($line -match '^\s*\[') {
            return $null
        }
        if ($line -match ('^\s*' + [regex]::Escape($Key) + '\s*=\s*["''](?<value>[^"'']*)["'']')) {
            return $Matches['value']
        }
    }
    return $null
}

function Get-ConfigMount {
    <#
    .SYNOPSIS
    Returns the [[module.mounts]] entries of TOML config lines, line by line.
    .PARAMETER Lines
    The config file's lines.
    #>
    param([string[]] $Lines)
    $mounts = [System.Collections.Generic.List[object]]::new()
    $current = $null
    foreach ($line in $Lines) {
        if ($line -match '^\s*\[\[\s*module\.mounts\s*\]\]') {
            $current = [pscustomobject]@{ Source = $null; Target = $null }
            $mounts.Add($current)
        }
        elseif ($line -match '^\s*\[') {
            $current = $null
        }
        elseif ($null -ne $current -and $line -match '^\s*(?<key>source|target)\s*=\s*["''](?<value>[^"'']*)["'']') {
            $current.($Matches['key']) = $Matches['value']
        }
    }
    return @($mounts | Where-Object { $_.Source -and $_.Target })
}

function Test-RefusedConfig {
    <#
    .SYNOPSIS
    Fails a site whose config the checker can't fully read.
    .PARAMETER SitePath
    The full site path.
    .PARAMETER ConfigPath
    The full config path.
    .PARAMETER Lines
    The config file's lines.
    #>
    param([string] $SitePath, [string] $ConfigPath, [string[]] $Lines)
    # why: a config/ folder or a layoutDir/assetDir setting moves layouts or
    # assets somewhere this line-oriented check doesn't look, so the shadow
    # rules could be bypassed. Refuse rather than pass blind.
    $configFolder = Join-Path $SitePath 'config'
    if (Test-Path -LiteralPath $configFolder -PathType Container) {
        Add-Failure $configFolder 'The site has a config/ folder, which this check cannot read. Move its settings into the single hugo.toml, or stop and decide the layout in that wiki''s migration packet.'
    }
    foreach ($key in @('layoutDir', 'assetDir')) {
        if (Get-ConfigValue $Lines $key) {
            Add-Failure $ConfigPath "The config sets $key, which moves files out of reach of the shadow check. Remove $key and use the default folders or a [[module.mounts]] entry."
        }
    }
}

function Read-ThemeManifest {
    <#
    .SYNOPSIS
    Parses .theme-manifest.txt into its commit and a path-to-hash map.
    .PARAMETER ManifestPath
    The manifest file.
    #>
    param([string] $ManifestPath)
    $entries = [ordered]@{}
    $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($ManifestPath)).Replace("`r`n", "`n")
    $lines = @($text.TrimEnd("`n").Split("`n"))
    if ($lines[0] -notmatch '^commit [0-9a-f]{40}$') {
        Add-Failure $ManifestPath 'The first line is not "commit <sha>", so this is not a manifest Sync-EwikiTheme.ps1 wrote. Re-sync the theme.'
    }
    foreach ($line in ($lines | Select-Object -Skip 1)) {
        if ($line -match '^(?<hash>[0-9a-f]{64})  (?<path>.+)$') {
            $entries[$Matches['path']] = $Matches['hash']
        }
        else {
            Add-Failure $ManifestPath "The line '$line' is not '<sha256>  <path>'. Re-sync the theme instead of editing the manifest."
        }
    }
    return $entries
}

function Test-VendoredFile {
    <#
    .SYNOPSIS
    Compares the vendored tree with its manifest: missing, extra, differing.
    .PARAMETER ThemePath
    The vendored theme folder.
    .PARAMETER Entries
    The manifest's path-to-hash map.
    #>
    param([string] $ThemePath, [System.Collections.IDictionary] $Entries)
    $actual = @(Get-RelativeFile $ThemePath | Where-Object { $_ -ne $ManifestName -and $_ -ne $VersionFileName })
    foreach ($relativePath in $Entries.Keys) {
        $file = Join-Path $ThemePath $relativePath
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            Add-Failure $file 'This vendored file is missing. Re-sync the theme with tools/Sync-EwikiTheme.ps1; never delete vendored files by hand.'
        }
        elseif ((Get-NormalizedFileHash $file) -ne $Entries[$relativePath]) {
            Add-Failure $file 'This vendored file differs from the manifest. Revert the edit and make the change in barefootbetters/bb-studio-ewiki-theme, then re-sync.'
        }
    }
    foreach ($relativePath in $actual) {
        if (-not $Entries.Contains($relativePath)) {
            Add-Failure (Join-Path $ThemePath $relativePath) 'This file is not in the vendored theme''s manifest. Remove it; a site''s own files go in its own layouts/ or assets/, through an extension point.'
        }
    }
}

function Test-ManifestDigest {
    <#
    .SYNOPSIS
    Compares the manifest's LF-normalized SHA-256 with the pinned digest.
    .PARAMETER ManifestPath
    The manifest file.
    #>
    param([string] $ManifestPath)
    # why: the digest is pinned outside the vendored tree (D-24728 section 3),
    # so an edit plus a regenerated manifest still fails here. It is hashed
    # LF-normalized, so a CRLF checkout of the manifest still matches.
    $digest = Get-ByteHash (ConvertTo-LfBytes ([System.IO.File]::ReadAllBytes($ManifestPath)))
    if ($ExpectedManifestSha256 -and $digest -ne $ExpectedManifestSha256.Trim().ToLowerInvariant()) {
        Add-Failure $ManifestPath "Its digest is $digest, not the pinned $ExpectedManifestSha256. Re-sync the release whose notes give the pinned digest, or update the pin when upgrading on purpose."
    }
    return $digest
}

function ConvertTo-NormalizedLayoutPath {
    <#
    .SYNOPSIS
    Maps a layouts-relative path onto Hugo 0.161.1's canonical layout name.
    .PARAMETER RelativePath
    A /-separated path relative to a layouts folder.
    #>
    param([string] $RelativePath)
    # why: Hugo 0.146+ resolves a layout through several equivalent paths
    # (pre-flight reproduced it on 0.161.1): _default/X is X, partials/ is
    # _partials/, shortcodes/ is _shortcodes/, _default/_markup/ is _markup/.
    # Comparing normalized names catches a shadow written in either form.
    $normalized = $RelativePath
    if ($normalized.StartsWith('_default/')) {
        $normalized = $normalized.Substring('_default/'.Length)
    }
    $normalized = $normalized -replace '(^|/)partials/', '$1_partials/'
    $normalized = $normalized -replace '(^|/)shortcodes/', '$1_shortcodes/'
    return $normalized
}

function Get-CoreLayoutSet {
    <#
    .SYNOPSIS
    Returns the normalized names of the core layout files from the manifest.
    .PARAMETER Entries
    The manifest's path-to-hash map.
    #>
    param([System.Collections.IDictionary] $Entries)
    $core = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($relativePath in $Entries.Keys) {
        if ($relativePath.StartsWith('layouts/')) {
            $normalized = ConvertTo-NormalizedLayoutPath $relativePath.Substring('layouts/'.Length)
            if ($ExtensionPoints -notcontains $normalized) {
                [void] $core.Add($normalized)
            }
        }
    }
    return , $core
}

function Get-LayoutShadowReason {
    <#
    .SYNOPSIS
    Returns why a site layout file shadows core, or $null when it is allowed.
    .PARAMETER RelativePath
    The file's /-separated path relative to its layouts folder.
    .PARAMETER Core
    The normalized core layout names.
    #>
    param([string] $RelativePath, [System.Collections.Generic.HashSet[string]] $Core)
    $normalized = ConvertTo-NormalizedLayoutPath $RelativePath
    $segments = $normalized.Split('/')
    $name = $segments[-1]
    if ($name -like 'baseof*') {
        return 'A baseof layout replaces the theme''s page shell. Remove it; use the head-end and body-end extension points instead.'
    }
    if ($ExtensionPoints -contains $normalized) {
        return $null
    }
    if ($Core.Contains($normalized)) {
        return "It shadows the core theme file $normalized. Remove it, and move the change into barefootbetters/bb-studio-ewiki-theme or an extension point."
    }
    if ($segments.Count -eq 1) {
        if ($name -match $ShadowKindPattern) {
            return 'A top-level kind layout overrides the theme''s page or list layout. Remove it; put a section layout under layouts/<section>/ or use an extension point.'
        }
        return $null
    }
    return Get-NestedShadowReason $segments $Core
}

function Get-NestedShadowReason {
    <#
    .SYNOPSIS
    Applies the section-folder rules to a nested site layout file.
    .PARAMETER Segments
    The normalized path's segments.
    .PARAMETER Core
    The normalized core layout names.
    #>
    param([string[]] $Segments, [System.Collections.Generic.HashSet[string]] $Core)
    if ($SpecialFolders -contains $Segments[0]) {
        return $null
    }
    # why: a section folder (layouts/<section>/) may hold only kind layouts.
    # A nested _markup, _shortcodes or _partials file there that matches core
    # still shadows it for that section.
    for ($index = 1; $index -lt $Segments.Count - 1; $index++) {
        if ($SpecialFolders -contains $Segments[$index]) {
            $nested = ConvertTo-NormalizedLayoutPath (($Segments[$index..($Segments.Count - 1)]) -join '/')
            if ($Core.Contains($nested)) {
                return "It shadows the core theme file $nested inside the $($Segments[0]) section. Remove it; a render hook the theme ships can't be replaced per section."
            }
            return $null
        }
    }
    if ($Segments[-1] -notmatch $SectionKindPattern) {
        return "Only kind layouts (single, list, page, section, taxonomy, term) may sit in the section folder $($Segments[0])/. Move this file, or rename it to a kind layout."
    }
    return $null
}

function Get-MountedRoot {
    <#
    .SYNOPSIS
    Returns each folder that feeds a target (layouts or assets), with the
    sub-path it lands under.
    .PARAMETER SitePath
    The full site path.
    .PARAMETER Mounts
    The config's mounts.
    .PARAMETER TargetName
    layouts or assets.
    #>
    param([string] $SitePath, [object[]] $Mounts, [string] $TargetName)
    $roots = [System.Collections.Generic.List[object]]::new()
    $roots.Add([pscustomobject]@{ Path = (Join-Path $SitePath $TargetName); Prefix = '' })
    foreach ($mount in $Mounts) {
        $target = $mount.Target.Replace('\', '/').Trim('/')
        if ($target -eq $TargetName -or $target.StartsWith("$TargetName/")) {
            $prefix = $target.Substring($TargetName.Length).Trim('/')
            $roots.Add([pscustomobject]@{ Path = [System.IO.Path]::GetFullPath($mount.Source, $SitePath); Prefix = $prefix })
        }
    }
    return $roots
}

function Test-LayoutShadow {
    <#
    .SYNOPSIS
    Checks every site layout file, direct or mounted, against the shadow rules.
    .PARAMETER Roots
    The layout folders and their sub-paths.
    .PARAMETER Core
    The normalized core layout names.
    #>
    param([object[]] $Roots, [System.Collections.Generic.HashSet[string]] $Core)
    foreach ($root in $Roots) {
        foreach ($relativePath in (Get-RelativeFile $root.Path)) {
            $layoutPath = if ($root.Prefix) { "$($root.Prefix)/$relativePath" } else { $relativePath }
            $reason = Get-LayoutShadowReason $layoutPath $Core
            if ($reason) {
                Add-Failure (Join-Path $root.Path $relativePath) $reason
            }
        }
    }
}

function Test-AssetShadow {
    <#
    .SYNOPSIS
    Fails a site copy of core CSS, and a site CSS file that declares tokens.
    .PARAMETER Roots
    The asset folders and their sub-paths.
    #>
    param([object[]] $Roots)
    # why: tokens live only in ewiki-brand.css, which loads first, so the dark
    # block can't be overridden by a later file (D-24728 section 4). A site
    # copy of ewiki.css replaces core; a custom property in ewiki-site.css
    # would override the brand's dark values.
    foreach ($root in $Roots) {
        foreach ($relativePath in (Get-RelativeFile $root.Path)) {
            $assetPath = if ($root.Prefix) { "$($root.Prefix)/$relativePath" } else { $relativePath }
            $file = Join-Path $root.Path $relativePath
            if ($assetPath -eq 'css/ewiki.css') {
                Add-Failure $file 'It shadows the core stylesheet. Remove it; put brand tokens in assets/css/ewiki-brand.css and site rules in assets/css/ewiki-site.css.'
            }
            elseif ($assetPath -eq 'css/ewiki-site.css' -and (Get-Content -LiteralPath $file -Raw) -match '--[A-Za-z0-9_-]+\s*:') {
                Add-Failure $file 'It declares a custom property. Move every token into assets/css/ewiki-brand.css, light and dark, so the dark block stays last.'
            }
        }
    }
}

function Write-TestResult {
    <#
    .SYNOPSIS
    Prints the failures and exits 1, or prints the pass summary.
    .PARAMETER Summary
    The pass line.
    #>
    param([string] $Summary)
    if ($Failures.Count -gt 0) {
        foreach ($failure in $Failures) {
            [Console]::Error.WriteLine($failure)
        }
        [Console]::Error.WriteLine("Test-EwikiTheme failed with $($Failures.Count) problem(s).")
        exit 1
    }
    Write-Host $Summary
}

function Invoke-EwikiThemeTest {
    <#
    .SYNOPSIS
    Runs every check and reports.
    #>
    $sitePath = [System.IO.Path]::GetFullPath($Site, (Get-Location).Path)
    $configPath = if ($Config) { [System.IO.Path]::GetFullPath($Config, (Get-Location).Path) } else { Join-Path $sitePath 'hugo.toml' }
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw "Test-EwikiTheme.ps1: the config $configPath does not exist. Pass -Config with the site's hugo.toml (a YAML or JSON config is not supported)."
    }
    $lines = @(Get-Content -LiteralPath $configPath)
    Test-RefusedConfig $sitePath $configPath $lines
    $themesFolder = Get-ConfigValue $lines 'themesDir'
    $themePath = Join-Path ([System.IO.Path]::GetFullPath($(if ($themesFolder) { $themesFolder } else { 'themes' }), $sitePath)) 'ewiki'
    $manifestPath = Join-Path $themePath $ManifestName
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Test-EwikiTheme.ps1: $manifestPath does not exist, so no theme is vendored there. Run tools/Sync-EwikiTheme.ps1 from a theme clone, or fix themesDir in $configPath."
    }
    $entries = Read-ThemeManifest $manifestPath
    Test-VendoredFile $themePath $entries
    $digest = Test-ManifestDigest $manifestPath
    $mounts = Get-ConfigMount $lines
    Test-LayoutShadow (Get-MountedRoot $sitePath $mounts 'layouts') (Get-CoreLayoutSet $entries)
    Test-AssetShadow (Get-MountedRoot $sitePath $mounts 'assets')
    Write-TestResult "Test-EwikiTheme passed: $($entries.Count) vendored files match the manifest (digest $digest), and $sitePath shadows no core file."
}

Invoke-EwikiThemeTest
