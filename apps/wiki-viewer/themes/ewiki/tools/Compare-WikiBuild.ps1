<#
.SYNOPSIS
Compares two builds of a wiki: the page set, every link and image in <main>,
and the visible text.

.DESCRIPTION
Run it on a wiki's build before and after a theme migration, or before and
after a theme upgrade.

- Page set: any difference in index.html paths fails.
- Links are enumerated from the baseline's <main>. Each is paired with the
  candidate link on the same page with the same link text and occurrence
  index. The theme's own navigation is left out of both builds first: heading
  anchors (a.heading-anchor), the table of contents (nav.toc) and the
  breadcrumbs (nav.crumbs). A pre-theme baseline has none of them; a themed
  baseline (an upgrade) has them all. Inside details.editing-this-page, whose
  wording may change, the page's multiset of link targets is compared
  instead, link text ignored: every baseline target must appear in the
  candidate as often.
- Images: each baseline <img src> in <main> is paired by page, alt text and
  occurrence index, with no allowed difference.
- Targets: a local href is compared as a page (lowercased, trailing slash,
  fragment kept); any other href as the full URL. One difference is allowed,
  built in: github.com/<repo>/blob/<branch>/<path> becoming
  github.com/<repo>/tree/<branch>/<path> on a paired link, with the same repo,
  branch and path once any trailing slash is ignored (a folder link).
- Visible text: <main> with tags stripped, entities decoded and whitespace
  collapsed, split at block elements, is diffed per page and every hunk is
  reported. Text hunks are reported, not failed: the migration maps each one
  to an intended change.

It exits 1 when the page set differs, a baseline link or image has no
partner, or a paired target changed other than by the allowed rule.

.PARAMETER Baseline
The baseline build's output folder (public/).

.PARAMETER Candidate
The candidate build's output folder.

.EXAMPLE
pwsh -File themes/ewiki/tools/Compare-WikiBuild.ps1 -Baseline before/public -Candidate public
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Baseline,

    [Parameter(Mandatory = $true)]
    [string] $Candidate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# why: the report quotes page text (em dashes, arrows), so write it as UTF-8
# even when the output is redirected to a file.
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

# why: a tag's attribute values may hold '>' (an alt text with an arrow), so
# every tag pattern skips over quoted values instead of stopping at the first '>'.
$TagBody = '(?:[^>"'']|"[^"]*"|''[^'']*'')*'
$BlockTags = 'p|li|h[1-6]|td|th|dt|dd|pre|summary|caption|figcaption|blockquote|tr|div|section|article|nav|ul|ol|table|details|dl|header|footer|aside|main|br|hr'
$Failures = [System.Collections.Generic.List[string]]::new()
$Totals = @{ Links = 0; FooterTargets = 0; Images = 0; FolderChanges = 0; HunkPages = 0; Hunks = 0 }

function Get-PageSet {
    <#
    .SYNOPSIS
    Returns every index.html under a build, as sorted /-separated paths.
    .PARAMETER Root
    The build's output folder.
    #>
    param([string] $Root)
    $paths = [string[]] @(Get-ChildItem -LiteralPath $Root -Recurse -File -Filter 'index.html' |
        ForEach-Object { $_.FullName.Substring($Root.Length + 1).Replace('\', '/') })
    [System.Array]::Sort($paths, [System.StringComparer]::Ordinal)
    return , $paths
}

function Get-Attribute {
    <#
    .SYNOPSIS
    Returns one attribute's decoded value from an opening tag's attribute text.
    .PARAMETER Attributes
    The text between the tag name and '>'.
    .PARAMETER Name
    The attribute name.
    #>
    param([string] $Attributes, [string] $Name)
    # why: minified HTML drops quotes where it can (href=/page/), so all three
    # forms are read: double-quoted, single-quoted and bare.
    $pattern = '(?:^|\s)' + [regex]::Escape($Name) + '\s*=\s*(?:"(?<value>[^"]*)"|''(?<value>[^'']*)''|(?<value>[^\s>]+))'
    $match = [regex]::Match($Attributes, $pattern, 'IgnoreCase')
    if (-not $match.Success) {
        return $null
    }
    return [System.Net.WebUtility]::HtmlDecode($match.Groups['value'].Value)
}

function Get-ElementRange {
    <#
    .SYNOPSIS
    Returns the start and end of each balanced element whose opening tag
    matches a pattern.
    .PARAMETER Html
    The HTML to scan.
    .PARAMETER Tag
    The element name, such as nav or details.
    .PARAMETER OpeningPattern
    A regex the opening tag must match, such as 'class=toc'.
    #>
    param([string] $Html, [string] $Tag, [string] $OpeningPattern)
    $ranges = [System.Collections.Generic.List[object]]::new()
    $tokens = [regex]::Matches($Html, "<(?<close>/)?$Tag\b$TagBody>", 'IgnoreCase')
    for ($index = 0; $index -lt $tokens.Count; $index++) {
        $opening = $tokens[$index]
        if ($opening.Groups['close'].Success -or $opening.Value -notmatch $OpeningPattern) {
            continue
        }
        $depth = 0
        for ($scan = $index; $scan -lt $tokens.Count; $scan++) {
            $depth += if ($tokens[$scan].Groups['close'].Success) { -1 } else { 1 }
            if ($depth -eq 0) {
                $ranges.Add([pscustomobject]@{ Start = $opening.Index; End = $tokens[$scan].Index + $tokens[$scan].Length })
                $index = $scan
                break
            }
        }
    }
    return $ranges
}

function Split-Element {
    <#
    .SYNOPSIS
    Splits HTML into the matching elements and the rest.
    .PARAMETER Html
    The HTML to split.
    .PARAMETER Tag
    The element name.
    .PARAMETER OpeningPattern
    A regex the opening tag must match.
    #>
    param([string] $Html, [string] $Tag, [string] $OpeningPattern)
    $inside = [System.Text.StringBuilder]::new()
    $outside = [System.Text.StringBuilder]::new()
    $cursor = 0
    foreach ($range in (Get-ElementRange $Html $Tag $OpeningPattern)) {
        [void] $outside.Append($Html.Substring($cursor, $range.Start - $cursor))
        [void] $inside.Append($Html.Substring($range.Start, $range.End - $range.Start))
        $cursor = $range.End
    }
    [void] $outside.Append($Html.Substring($cursor))
    return [pscustomobject]@{ Inside = $inside.ToString(); Outside = $outside.ToString() }
}

function Get-MainHtml {
    <#
    .SYNOPSIS
    Returns a page's <main> element, or "" when it has none.
    .PARAMETER Path
    The HTML file.
    #>
    param([string] $Path)
    $html = [System.IO.File]::ReadAllText($Path)
    $range = @(Get-ElementRange $html 'main' '.')
    if ($range.Count -eq 0) {
        return ''
    }
    return $html.Substring($range[0].Start, $range[0].End - $range[0].Start)
}

function ConvertTo-PlainText {
    <#
    .SYNOPSIS
    Strips tags, decodes entities and collapses whitespace.
    .PARAMETER Html
    The HTML fragment.
    #>
    param([string] $Html)
    $text = [regex]::Replace($Html, "<$TagBody>", ' ')
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    return ([regex]::Replace($text, '\s+', ' ')).Trim()
}

function Get-Link {
    <#
    .SYNOPSIS
    Returns each <a href> in an HTML fragment as its text and href.
    .PARAMETER Html
    The HTML fragment.
    #>
    param([string] $Html)
    foreach ($match in [regex]::Matches($Html, "<a\b(?<attributes>$TagBody)>(?<inner>.*?)</a>", 'IgnoreCase, Singleline')) {
        $href = Get-Attribute $match.Groups['attributes'].Value 'href'
        if ($null -ne $href) {
            [pscustomobject]@{ Text = (ConvertTo-PlainText $match.Groups['inner'].Value); Href = $href }
        }
    }
}

function Get-Image {
    <#
    .SYNOPSIS
    Returns each <img> in an HTML fragment as its alt text and src.
    .PARAMETER Html
    The HTML fragment.
    #>
    param([string] $Html)
    foreach ($match in [regex]::Matches($Html, "<img\b(?<attributes>$TagBody)>", 'IgnoreCase')) {
        $attributes = $match.Groups['attributes'].Value
        [pscustomobject]@{ Alt = [string](Get-Attribute $attributes 'alt'); Src = [string](Get-Attribute $attributes 'src') }
    }
}

function ConvertTo-ComparableTarget {
    <#
    .SYNOPSIS
    Normalizes an href for comparison: a local page lowercased with a
    trailing slash and its fragment kept; anything else as written.
    .PARAMETER Href
    The decoded href.
    #>
    param([string] $Href)
    if ($Href -match '^[a-zA-Z][a-zA-Z0-9+.-]*:' -or $Href.StartsWith('//') -or $Href.StartsWith('#')) {
        return $Href
    }
    $fragment = ''
    $path = $Href
    $hashIndex = $Href.IndexOf('#')
    if ($hashIndex -ge 0) {
        $fragment = $Href.Substring($hashIndex)
        $path = $Href.Substring(0, $hashIndex)
    }
    $path = $path.ToLowerInvariant()
    if (-not $path.EndsWith('/') -and ($path.Split('/')[-1] -notmatch '\.')) {
        $path = "$path/"
    }
    return "$path$fragment"
}

function Test-FolderChange {
    <#
    .SYNOPSIS
    True when a GitHub blob URL became the tree URL of the same path (a folder
    link), the one built-in allowed change.
    .PARAMETER BaselineHref
    The baseline target.
    .PARAMETER CandidateHref
    The candidate target.
    #>
    param([string] $BaselineHref, [string] $CandidateHref)
    $pattern = '^https://github\.com/(?<repo>[^/]+/[^/]+)/(?<kind>blob|tree)/(?<branch>[^/]+)/(?<path>.*)$'
    $before = [regex]::Match($BaselineHref, $pattern)
    $after = [regex]::Match($CandidateHref, $pattern)
    if (-not ($before.Success -and $after.Success)) {
        return $false
    }
    $samePlace = $before.Groups['repo'].Value -eq $after.Groups['repo'].Value -and $before.Groups['branch'].Value -eq $after.Groups['branch'].Value
    $samePath = $before.Groups['path'].Value.TrimEnd('/') -eq $after.Groups['path'].Value.TrimEnd('/')
    return $samePlace -and $samePath -and $before.Groups['kind'].Value -eq 'blob' -and $after.Groups['kind'].Value -eq 'tree'
}

function Group-ByOccurrence {
    <#
    .SYNOPSIS
    Keys items by a field plus its occurrence index: "text#0", "text#1".
    .PARAMETER Items
    The links or images.
    .PARAMETER Field
    The field to key by (Text or Alt).
    #>
    param([object[]] $Items, [string] $Field)
    $seen = @{}
    $keyed = [ordered]@{}
    foreach ($item in $Items) {
        $value = $item.$Field
        $seen[$value] = if ($seen.ContainsKey($value)) { $seen[$value] + 1 } else { 0 }
        $keyed["$value#$($seen[$value])"] = $item
    }
    return $keyed
}

function Compare-PageLink {
    <#
    .SYNOPSIS
    Pairs a page's baseline links with the candidate's and checks targets.
    .PARAMETER Page
    The page path.
    .PARAMETER BaselineLinks
    The baseline's links outside the footer.
    .PARAMETER CandidateLinks
    The candidate's links outside the footer and the new navigation.
    #>
    param([string] $Page, [object[]] $BaselineLinks, [object[]] $CandidateLinks)
    $candidateByKey = Group-ByOccurrence $CandidateLinks 'Text'
    $baselineByKey = Group-ByOccurrence $BaselineLinks 'Text'
    foreach ($key in $baselineByKey.Keys) {
        $Totals.Links++; $before = $baselineByKey[$key].Href
        if (-not $candidateByKey.Contains($key)) {
            $Failures.Add("$Page`: the baseline link '$key' -> $before has no partner in the candidate.")
            continue
        }
        $after = $candidateByKey[$key].Href
        if ((ConvertTo-ComparableTarget $before) -ne (ConvertTo-ComparableTarget $after)) {
            if (Test-FolderChange $before $after) {
                $Totals.FolderChanges++
                Write-Host "  allowed folder change on $Page, '$key': $before -> $after"
            }
            else {
                $Failures.Add("$Page`: the link '$key' changed target: $before -> $after.")
            }
        }
    }
}

function Compare-FooterTarget {
    <#
    .SYNOPSIS
    Checks that every baseline footer target appears in the candidate's
    footer at least as often.
    .PARAMETER Page
    The page path.
    .PARAMETER BaselineLinks
    The baseline footer's links.
    .PARAMETER CandidateLinks
    The candidate footer's links.
    #>
    param([string] $Page, [object[]] $BaselineLinks, [object[]] $CandidateLinks)
    $available = @{}
    foreach ($link in $CandidateLinks) {
        $target = ConvertTo-ComparableTarget $link.Href
        $available[$target] = 1 + $(if ($available.ContainsKey($target)) { $available[$target] } else { 0 })
    }
    foreach ($link in $BaselineLinks) {
        $Totals.FooterTargets++
        $target = ConvertTo-ComparableTarget $link.Href
        if ($available.ContainsKey($target) -and $available[$target] -gt 0) {
            $available[$target]--
        }
        else {
            $Failures.Add("$Page`: the footer target $($link.Href) is missing from the candidate's footer.")
        }
    }
}

function Compare-PageImage {
    <#
    .SYNOPSIS
    Pairs a page's baseline images with the candidate's by alt text and
    occurrence; any src change fails.
    .PARAMETER Page
    The page path.
    .PARAMETER BaselineImages
    The baseline's images.
    .PARAMETER CandidateImages
    The candidate's images.
    #>
    param([string] $Page, [object[]] $BaselineImages, [object[]] $CandidateImages)
    $candidateByKey = Group-ByOccurrence $CandidateImages 'Alt'
    $baselineByKey = Group-ByOccurrence $BaselineImages 'Alt'
    foreach ($key in $baselineByKey.Keys) {
        $Totals.Images++
        if (-not $candidateByKey.Contains($key)) {
            $Failures.Add("$Page`: the baseline image '$key' ($($baselineByKey[$key].Src)) has no partner in the candidate.")
        }
        elseif ($candidateByKey[$key].Src -ne $baselineByKey[$key].Src) {
            $Failures.Add("$Page`: the image '$key' changed src: $($baselineByKey[$key].Src) -> $($candidateByKey[$key].Src).")
        }
    }
}

function Get-TextLine {
    <#
    .SYNOPSIS
    Returns <main>'s visible text as lines, one per block element.
    .PARAMETER Html
    The <main> HTML.
    #>
    param([string] $Html)
    # why: split at block elements only, with a marker the HTML can't hold, so
    # a newline the minifier left inside a paragraph doesn't break its line.
    $marker = [char] 0x1F
    $marked = [regex]::Replace($Html, "<(/?)($BlockTags)\b$TagBody>", [string] $marker, 'IgnoreCase')
    $lines = foreach ($chunk in $marked.Split($marker)) {
        $text = ConvertTo-PlainText $chunk
        if ($text) { $text }
    }
    return , [string[]] @($lines)
}

function Get-TextHunk {
    <#
    .SYNOPSIS
    Diffs two line lists and returns the hunks as lists of -/+ lines.
    .PARAMETER Before
    The baseline lines.
    .PARAMETER After
    The candidate lines.
    #>
    param([string[]] $Before, [string[]] $After)
    $head = 0
    while ($head -lt $Before.Count -and $head -lt $After.Count -and $Before[$head] -ceq $After[$head]) { $head++ }
    $tail = 0
    while ($tail -lt ($Before.Count - $head) -and $tail -lt ($After.Count - $head) -and $Before[$Before.Count - 1 - $tail] -ceq $After[$After.Count - 1 - $tail]) { $tail++ }
    # why: diff only the differing middle. A theme change touches the top and
    # the foot of a page, so trimming the shared head and tail keeps the LCS
    # table small.
    $middleBefore = [string[]]::new($Before.Count - $head - $tail)
    [System.Array]::Copy($Before, $head, $middleBefore, 0, $middleBefore.Length)
    $middleAfter = [string[]]::new($After.Count - $head - $tail)
    [System.Array]::Copy($After, $head, $middleAfter, 0, $middleAfter.Length)
    if ($middleBefore.Length -eq 0 -and $middleAfter.Length -eq 0) {
        return @()
    }
    return Get-LcsHunk $middleBefore $middleAfter
}

function Get-LcsHunk {
    <#
    .SYNOPSIS
    Groups an LCS line diff into hunks of consecutive -/+ lines.
    .PARAMETER Before
    The baseline lines.
    .PARAMETER After
    The candidate lines.
    #>
    param([string[]] $Before, [string[]] $After)
    $rows = $Before.Count
    $columns = $After.Count
    $table = [int[, ]]::new($rows + 1, $columns + 1)
    for ($row = $rows - 1; $row -ge 0; $row--) {
        for ($column = $columns - 1; $column -ge 0; $column--) {
            $table[$row, $column] = if ($Before[$row] -ceq $After[$column]) { $table[($row + 1), ($column + 1)] + 1 } else { [System.Math]::Max($table[($row + 1), $column], $table[$row, ($column + 1)]) }
        }
    }
    return Read-LcsHunk $Before $After $table
}

function Read-LcsHunk {
    <#
    .SYNOPSIS
    Walks a filled LCS table into hunks.
    .PARAMETER Before
    The baseline lines.
    .PARAMETER After
    The candidate lines.
    .PARAMETER Table
    The LCS length table.
    #>
    param([string[]] $Before, [string[]] $After, [int[, ]] $Table)
    $hunks = [System.Collections.Generic.List[object]]::new()
    $current = [System.Collections.Generic.List[string]]::new()
    $row = 0
    $column = 0
    while ($row -lt $Before.Count -or $column -lt $After.Count) {
        if ($row -lt $Before.Count -and $column -lt $After.Count -and $Before[$row] -ceq $After[$column]) {
            if ($current.Count -gt 0) { $hunks.Add($current); $current = [System.Collections.Generic.List[string]]::new() }
            $row++; $column++
        }
        elseif ($column -lt $After.Count -and ($row -ge $Before.Count -or $Table[$row, ($column + 1)] -ge $Table[($row + 1), $column])) {
            $current.Add("+ $($After[$column])"); $column++
        }
        else {
            $current.Add("- $($Before[$row])"); $row++
        }
    }
    if ($current.Count -gt 0) { $hunks.Add($current) }
    return $hunks
}

function Compare-PageText {
    <#
    .SYNOPSIS
    Reports a page's visible-text hunks.
    .PARAMETER Page
    The page path.
    .PARAMETER BaselineMain
    The baseline <main> HTML.
    .PARAMETER CandidateMain
    The candidate <main> HTML.
    #>
    param([string] $Page, [string] $BaselineMain, [string] $CandidateMain)
    $hunks = @(Get-TextHunk (Get-TextLine $BaselineMain) (Get-TextLine $CandidateMain))
    if ($hunks.Count -eq 0) {
        return
    }
    $Totals.HunkPages++
    $Totals.Hunks += $hunks.Count
    Write-Host "Text hunks on ${Page}: $($hunks.Count)"
    $number = 0
    foreach ($hunk in $hunks) {
        $number++
        Write-Host "  @@ hunk $number"
        foreach ($line in $hunk) { Write-Host "  $line" }
    }
}

function Remove-ThemeNavigation {
    <#
    .SYNOPSIS
    Removes the theme's own links from <main>: the table of contents
    (nav.toc), the breadcrumbs (nav.crumbs) and heading anchors
    (a.heading-anchor).
    .PARAMETER Html
    The <main> HTML outside the editing footer.
    #>
    param([string] $Html)
    foreach ($navigation in @('class="?toc\b', 'class="?crumbs\b')) {
        $Html = (Split-Element $Html 'nav' $navigation).Outside
    }
    return [regex]::Replace($Html, "<a\b(?=[^>]*\bclass=""?heading-anchor\b)$TagBody>\s*</a>", '')
}

function Compare-Page {
    <#
    .SYNOPSIS
    Compares one page's links, footer targets, images and text.
    .PARAMETER Page
    The page path.
    #>
    param([string] $Page)
    $baselineMain = Get-MainHtml (Join-Path $Baseline $Page)
    $candidateMain = Get-MainHtml (Join-Path $Candidate $Page)
    $baselineParts = Split-Element $baselineMain 'details' 'class="?editing-this-page'
    $candidateParts = Split-Element $candidateMain 'details' 'class="?editing-this-page'
    # why: both sides lose the theme's navigation. A pre-theme baseline has
    # none, so nothing changes for it; a themed baseline (a theme upgrade)
    # would otherwise report every breadcrumb, TOC entry and heading anchor as
    # having no partner (v1.2.2).
    Compare-PageLink $Page @(Get-Link (Remove-ThemeNavigation $baselineParts.Outside)) @(Get-Link (Remove-ThemeNavigation $candidateParts.Outside))
    Compare-FooterTarget $Page @(Get-Link $baselineParts.Inside) @(Get-Link $candidateParts.Inside)
    Compare-PageImage $Page @(Get-Image $baselineMain) @(Get-Image $candidateMain)
    Compare-PageText $Page $baselineMain $candidateMain
}

function Compare-PageSet {
    <#
    .SYNOPSIS
    Fails when the two builds' index.html sets differ; returns the shared set.
    .PARAMETER BaselinePages
    The baseline's pages.
    .PARAMETER CandidatePages
    The candidate's pages.
    #>
    param([string[]] $BaselinePages, [string[]] $CandidatePages)
    $onlyBaseline = @($BaselinePages | Where-Object { $CandidatePages -notcontains $_ })
    $onlyCandidate = @($CandidatePages | Where-Object { $BaselinePages -notcontains $_ })
    foreach ($page in $onlyBaseline) { $Failures.Add("Page set: $page is in the baseline but missing from the candidate.") }
    foreach ($page in $onlyCandidate) { $Failures.Add("Page set: $page is in the candidate but not in the baseline.") }
    Write-Host "Page set: $($BaselinePages.Count) baseline pages, $($CandidatePages.Count) candidate pages, $($onlyBaseline.Count + $onlyCandidate.Count) different."
    return , [string[]] @($BaselinePages | Where-Object { $CandidatePages -contains $_ })
}

function Invoke-WikiBuildComparison {
    <#
    .SYNOPSIS
    Runs the comparison and reports.
    #>
    foreach ($folder in @($Baseline, $Candidate)) {
        if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
            throw "Compare-WikiBuild.ps1: the build folder $folder does not exist. Build the wiki first and pass its output folder (public/)."
        }
    }
    $script:Baseline = (Resolve-Path -LiteralPath $Baseline).Path.TrimEnd('\', '/')
    $script:Candidate = (Resolve-Path -LiteralPath $Candidate).Path.TrimEnd('\', '/')
    $shared = Compare-PageSet (Get-PageSet $Baseline) (Get-PageSet $Candidate)
    foreach ($page in $shared) {
        Compare-Page $page
    }
    Write-Host "Links paired: $($Totals.Links); footer targets checked: $($Totals.FooterTargets); images paired: $($Totals.Images); allowed folder changes (blob -> tree): $($Totals.FolderChanges)."
    Write-Host "Text hunks: $($Totals.Hunks) on $($Totals.HunkPages) page(s)."
    if ($Failures.Count -gt 0) {
        foreach ($failure in $Failures) { [Console]::Error.WriteLine("Compare-WikiBuild: $failure") }
        [Console]::Error.WriteLine("Compare-WikiBuild failed with $($Failures.Count) problem(s).")
        exit 1
    }
    Write-Host 'Compare-WikiBuild passed: identical page set, every baseline link and image paired, and no changed target beyond the allowed folder rule.'
}

Invoke-WikiBuildComparison
