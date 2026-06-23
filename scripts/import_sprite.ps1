
# import_sprite.ps1
# Interactive launcher for scripts/import_sprite.js
# Opens a file picker dialog then prompts for all import options.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\import_sprite.ps1
# Or double-click scripts\import_sprite.bat

param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Header {
    Write-Host ""
    Write-Host "  Codotchi Sprite Importer" -ForegroundColor Cyan
    Write-Host "  -------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

function Prompt-Text {
    param([string]$Label, [string]$Hint = "")
    if ($Hint) {
        Write-Host "  $Label ($Hint)" -ForegroundColor White
    } else {
        Write-Host "  $Label" -ForegroundColor White
    }
    $val = Read-Host "  > "
    return $val.Trim()
}

function Prompt-YN {
    param([string]$Label, [bool]$Default = $false)
    $defLabel = if ($Default) { "Y/n" } else { "y/N" }
    Write-Host "  $Label [$defLabel]" -ForegroundColor White
    $raw = Read-Host "  > "
    $val = $raw.Trim().ToLower()
    if ($val -eq '') { return $Default }
    return ($val -eq 'y' -or $val -eq 'yes')
}

$ColourNames = @{
    'red'    = '#cc3333'
    'orange' = '#dd6622'
    'yellow' = '#ddcc00'
    'green'  = '#339944'
    'blue'   = '#3366cc'
    'purple' = '#7744bb'
    'pink'   = '#dd5599'
    'white'  = '#ffffff'
    'grey'   = '#888888'
    'gray'   = '#888888'
    'black'  = '#222222'
    'brown'  = '#8b4513'
    'tan'    = '#c8a060'
    'cream'  = '#f0e0b0'
}

function Prompt-Hex {
    param([string]$Label)
    while ($true) {
        $val = Prompt-Text -Label $Label -Hint "e.g. red, brown, #f2994a, or blank to skip"
        if ($val -eq '') { return $null }
        $lower = $val.ToLower()
        if ($ColourNames.ContainsKey($lower)) {
            $resolved = $ColourNames[$lower]
            Write-Host "  -> $lower = $resolved" -ForegroundColor DarkGray
            return $resolved
        }
        if ($val -match '^#?[0-9a-fA-F]{6}$') {
            if (-not $val.StartsWith('#')) { $val = "#$val" }
            return $val
        }
        Write-Host "  Unknown colour name or invalid hex. Try again." -ForegroundColor Yellow
    }
}

function Prompt-Int {
    param([string]$Label, [string]$Hint = "blank to skip")
    while ($true) {
        $val = Prompt-Text -Label $Label -Hint $Hint
        if ($val -eq '') { return $null }
        if ($val -match '^\d+$') { return [int]$val }
        Write-Host "  Must be a whole number. Try again." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# File picker
# ---------------------------------------------------------------------------

Write-Header

Add-Type -AssemblyName System.Windows.Forms | Out-Null

$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title  = "Select sprite image"
$dlg.Filter = "Image files (*.png;*.jpg;*.jpeg;*.webp;*.pixil)|*.png;*.jpg;*.jpeg;*.webp;*.pixil|All files (*.*)|*.*"
$candidateDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\downloaded_sprites"))
$dlg.InitialDirectory = if (Test-Path $candidateDir) { $candidateDir } else {
    [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}

Write-Host "  Opening file picker..." -ForegroundColor DarkGray
$result = $dlg.ShowDialog()

if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host "  Cancelled." -ForegroundColor DarkGray
    exit 0
}

$imageFile = $dlg.FileName
Write-Host ""
Write-Host "  File : $imageFile" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Sprite type
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  -- Sprite type ------------------------------------------" -ForegroundColor DarkGray
$spriteType = ''
while ($spriteType -eq '') {
    $spriteType = Prompt-Text -Label "Sprite type name:" -Hint "e.g. dog, cat, shiba"
    if ($spriteType -eq '') { Write-Host "  Required -- cannot be blank." -ForegroundColor Yellow }
}

# ---------------------------------------------------------------------------
# Stage
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  -- Stage ------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Choose a stage:" -ForegroundColor White
Write-Host "    1) baby   2) child   3) teen   4) adult   5) senior   6) all" -ForegroundColor DarkGray
$stageMap = @{
    '1'='baby'; '2'='child'; '3'='teen'; '4'='adult'; '5'='senior'; '6'='all'
    'baby'='baby'; 'child'='child'; 'teen'='teen'; 'adult'='adult'; 'senior'='senior'; 'all'='all'
}
$stage = ''
while ($stage -eq '') {
    $raw = Prompt-Text -Label "Stage:" -Hint "number 1-6 or name, or 'all' for all stages"
    $rawLower = $raw.ToLower()
    if ($stageMap.ContainsKey($rawLower)) {
        $stage = $stageMap[$rawLower]
    } else {
        Write-Host "  Invalid stage. Enter 1-6 or baby/child/teen/adult/senior/all." -ForegroundColor Yellow
    }
}
if ($stage -eq 'all') {
    $stages = @('baby', 'child', 'teen', 'adult', 'senior')
    Write-Host "  Stage set to: all (baby, child, teen, adult, senior)" -ForegroundColor Green
} else {
    $stages = @($stage)
    Write-Host "  Stage set to: $stage" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Colour palette (optional)
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  -- Colour palette (blank = auto-detect; names: red, white, blue, brown...) --" -ForegroundColor DarkGray
$primary   = Prompt-Hex -Label "--primary   (body fill):"
$secondary = Prompt-Hex -Label "--secondary (eyes / markings):"
$accent    = Prompt-Hex -Label "--accent    (stripes / accent):"

# ---------------------------------------------------------------------------
# Grid options (optional)
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  -- Grid options -----------------------------------------" -ForegroundColor DarkGray
$legRow = Prompt-Int -Label "--leg-row (row where legs begin):" -Hint "blank = auto (78% of rows)"

# ---------------------------------------------------------------------------
# Background removal (optional)
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  -- Background removal -----------------------------------" -ForegroundColor DarkGray
$transparent     = Prompt-Hex -Label "--transparent (background colour to remove):"
$transparentDist = $null
$cropTransparent = $false
if ($null -ne $transparent) {
    $transparentDist = Prompt-Int -Label "--transparent-distance (RGB tolerance):" -Hint "blank = default 2500"
    $cropTransparent = Prompt-YN -Label "--crop-transparent (trim border after removal)?" -Default $true
}

# ---------------------------------------------------------------------------
# Output options
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  -- Output options ----------------------------------------" -ForegroundColor DarkGray
$preview = Prompt-YN -Label "--preview (show ASCII art preview in console)?" -Default $true

# ---------------------------------------------------------------------------
# Inject
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "  -- Inject -----------------------------------------------" -ForegroundColor DarkGray
Write-Host "  WARNING: --inject writes directly to sprites.js and spriteConstants.js" -ForegroundColor Yellow
$inject = Prompt-YN -Label "--inject (splice output into source files)?" -Default $false

# ---------------------------------------------------------------------------
# Pixil frame (only for .pixil files)
# ---------------------------------------------------------------------------

$frame = $null
if ($imageFile -imatch '\.pixil$') {
    Write-Host ""
    Write-Host "  -- Pixil options ----------------------------------------" -ForegroundColor DarkGray
    $frame = Prompt-Int -Label "--frame (frame index in .pixil file):" -Hint "blank = 0"
}

# ---------------------------------------------------------------------------
# Build argument list and run (once per stage)
# ---------------------------------------------------------------------------

$repoRoot  = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$jsScript  = Join-Path $PSScriptRoot "import_sprite.js"

Push-Location $repoRoot
try {
    foreach ($stg in $stages) {
        $nodeArgs = @("`"$jsScript`"", "`"$imageFile`"", $spriteType, $stg)

        if ($null -ne $primary)          { $nodeArgs += "--primary";              $nodeArgs += $primary }
        if ($null -ne $secondary)        { $nodeArgs += "--secondary";            $nodeArgs += $secondary }
        if ($null -ne $accent)           { $nodeArgs += "--accent";               $nodeArgs += $accent }
        if ($null -ne $legRow)           { $nodeArgs += "--leg-row";              $nodeArgs += "$legRow" }
        if ($null -ne $transparent)      { $nodeArgs += "--transparent";          $nodeArgs += $transparent }
        if ($null -ne $transparentDist)  { $nodeArgs += "--transparent-distance"; $nodeArgs += "$transparentDist" }
        if ($cropTransparent)            { $nodeArgs += "--crop-transparent" }
        if ($preview)                    { $nodeArgs += "--preview" }
        if ($inject)                     { $nodeArgs += "--inject" }
        if ($null -ne $frame)            { $nodeArgs += "--frame";                $nodeArgs += "$frame" }

        $fullCmd = "node " + ($nodeArgs -join " ")

        Write-Host ""
        Write-Host "  -- Stage: $stg ---------------------------------------" -ForegroundColor Magenta
        Write-Host "  $fullCmd" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Running..." -ForegroundColor DarkGray
        Write-Host "  --------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host ""

        & node $nodeArgs

        Write-Host ""
        Write-Host "  Stage '$stg' complete." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "  --------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Done." -ForegroundColor Green
Write-Host ""
