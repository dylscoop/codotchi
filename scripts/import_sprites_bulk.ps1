
# import_sprites_bulk.ps1
# Interactive launcher for scripts/import_sprites_bulk.js
# Pick the pet's stage images, name the pet, choose options; the images are
# copied into sprites\<pet>\, sprite.json is updated, and the bulk import runs.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\import_sprites_bulk.ps1
# Or double-click scripts\import_sprites_bulk.bat

param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Stages    = @('baby', 'child', 'teen', 'adult', 'senior')
$ImageExts = @('.png', '.jpg', '.jpeg', '.webp', '.pixil')
$RepoRoot  = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$SpritesDir = Join-Path $RepoRoot "sprites"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "  -- $Title ------------------------------------------" -ForegroundColor DarkGray
}

function Prompt-Text {
    param([string]$Label, [string]$Hint = "")
    if ($Hint) { Write-Host "  $Label ($Hint)" -ForegroundColor White }
    else       { Write-Host "  $Label" -ForegroundColor White }
    $val = Read-Host "  > "
    return $val.Trim()
}

function Prompt-YN {
    param([string]$Label, [bool]$Default = $false)
    $defLabel = if ($Default) { "Y/n" } else { "y/N" }
    Write-Host "  $Label [$defLabel]" -ForegroundColor White
    $val = (Read-Host "  > ").Trim().ToLower()
    if ($val -eq '') { return $Default }
    return ($val -eq 'y' -or $val -eq 'yes')
}

function Set-JsonField {
    param($Obj, [string]$Name, $Value)
    if ($Obj.PSObject.Properties[$Name]) { $Obj.$Name = $Value }
    else { $Obj | Add-Member -NotePropertyName $Name -NotePropertyValue $Value }
}

function Get-JsonField {
    param($Obj, [string]$Name, $Default)
    if ($Obj.PSObject.Properties[$Name]) { return $Obj.$Name }
    return $Default
}

Write-Host ""
Write-Host "  Codotchi Bulk Sprite Importer" -ForegroundColor Cyan
Write-Host "  -----------------------------" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# Image picker (same window as import_sprite.ps1; select several images)
# ---------------------------------------------------------------------------

Add-Type -AssemblyName System.Windows.Forms | Out-Null

$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title       = "Select the pet's stage images (Ctrl/Shift-click to pick several)"
$dlg.Filter      = "Image files (*.png;*.jpg;*.jpeg;*.webp;*.pixil)|*.png;*.jpg;*.jpeg;*.webp;*.pixil|All files (*.*)|*.*"
$dlg.Multiselect = $true
$candidateDir = Join-Path $RepoRoot "downloaded_sprites"
$dlg.InitialDirectory = if (Test-Path $candidateDir) { $candidateDir } else { $SpritesDir }

Write-Host ""
Write-Host "  Opening file picker..." -ForegroundColor DarkGray
if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host "  Cancelled." -ForegroundColor DarkGray
    exit 0
}

$images = @($dlg.FileNames | ForEach-Object { Get-Item -LiteralPath $_ } |
    Where-Object { $ImageExts -contains $_.Extension.ToLower() } |
    Sort-Object Name)
if ($images.Count -eq 0) {
    Write-Host "  No images (.png .jpg .jpeg .webp .pixil) selected." -ForegroundColor Yellow
    exit 1
}
$srcDir = $images[0].DirectoryName
Write-Host "  Selected $($images.Count) image(s) from $srcDir" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Pet name
# ---------------------------------------------------------------------------

Write-Section "Pet"
$defaultName = (Split-Path $srcDir -Leaf).ToLower() -replace '[^a-z0-9_]', '_'
if ($defaultName -notmatch '^[a-z]' -or $defaultName -eq 'downloaded_sprites') { $defaultName = '' }
$pet = ''
while ($pet -eq '') {
    $hint = if ($defaultName) { "blank = $defaultName" } else { "e.g. dog, cat, shiba" }
    $raw = (Prompt-Text -Label "Pet (sprite type) name:" -Hint $hint).ToLower()
    if ($raw -eq '' -and $defaultName) { $raw = $defaultName }
    if ($raw -match '^[a-z][a-z0-9_]*$') { $pet = $raw }
    else { Write-Host "  Use lower-case letters, digits or _, starting with a letter." -ForegroundColor Yellow }
}
$petDir = Join-Path $SpritesDir $pet
$inPlace = ([System.IO.Path]::GetFullPath($petDir).TrimEnd('\') -ieq $srcDir.TrimEnd('\'))
if (Test-Path $petDir) { Write-Host "  sprites\$pet already exists - its images will be updated." -ForegroundColor DarkGray }
else                   { Write-Host "  New pet: sprites\$pet" -ForegroundColor Green }

# ---------------------------------------------------------------------------
# Match images to stages (and mood art like adult_sleeping)
# ---------------------------------------------------------------------------

Write-Section "Stage images"
$assign = [ordered]@{}
foreach ($img in $images) {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($img.Name).ToLower()
    if ($base -match '^(baby|child|teen|adult|senior)(_[a-z]+)?$') { $assign[$base] = $img }
}

if (-not $inPlace) {
    for ($i = 0; $i -lt $images.Count; $i++) {
        Write-Host ("    {0,2}) {1}" -f ($i + 1), $images[$i].Name) -ForegroundColor DarkGray
    }
    foreach ($stage in $Stages) {
        $cur  = if ($assign.Contains($stage)) { $assign[$stage].Name } else { $null }
        $hint = if ($cur) { "blank = $cur, 0 = skip" } else { "number, blank = skip" }
        while ($true) {
            $raw = Prompt-Text -Label "Image for $($stage):" -Hint $hint
            if ($raw -eq '') { break }
            if ($raw -eq '0') { if ($assign.Contains($stage)) { $assign.Remove($stage) }; break }
            if ($raw -match '^\d+$' -and [int]$raw -ge 1 -and [int]$raw -le $images.Count) {
                $assign[$stage] = $images[[int]$raw - 1]; break
            }
            Write-Host "  Enter 1-$($images.Count), 0 or blank." -ForegroundColor Yellow
        }
    }
}

$found = @($Stages | Where-Object { $assign.Contains($_) })
if ($found.Count -eq 0) {
    Write-Host "  No stage images chosen - nothing to import." -ForegroundColor Yellow
    exit 1
}
foreach ($key in $assign.Keys) { Write-Host ("  {0,-16} <- {1}" -f $key, $assign[$key].Name) -ForegroundColor Green }
$missing = @($Stages | Where-Object { -not $assign.Contains($_) })
if ($missing.Count) { Write-Host "  Missing: $($missing -join ', ') (they fall back to adult)" -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# Options (saved in sprites\<pet>\sprite.json; existing fields are kept)
# ---------------------------------------------------------------------------

$jsonPath = Join-Path $petDir "sprite.json"
$config = if (Test-Path $jsonPath) { Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json } else { New-Object PSObject }

Write-Section "Colours"
Write-Host "  Per-stage colours: each stage gets its own colours, detected from its own image." -ForegroundColor DarkGray
Write-Host "  Off: every stage shares one palette detected from all images." -ForegroundColor DarkGray
$perStage = Prompt-YN -Label "Per-stage colours?" -Default ([bool](Get-JsonField $config 'perStagePalette' $false))

Write-Section "Shape"
Write-Host "  Sprites face LEFT. Mirror if the source images face RIGHT." -ForegroundColor DarkGray
$flip    = Prompt-YN -Label "Flip (source faces right)?" -Default ([bool](Get-JsonField $config 'flip' $false))
$upright = Prompt-YN -Label "Upright (portrait pet, e.g. a standing animal)?" -Default ([bool](Get-JsonField $config 'upright' $false))

if ($perStage) { Set-JsonField $config 'perStagePalette' $true }
elseif ($config.PSObject.Properties['perStagePalette']) { $config.PSObject.Properties.Remove('perStagePalette') }
if ($flip) { Set-JsonField $config 'flip' $true }
elseif ($config.PSObject.Properties['flip']) { $config.PSObject.Properties.Remove('flip') }
if ($upright) { Set-JsonField $config 'upright' $true }
elseif ($config.PSObject.Properties['upright']) { $config.PSObject.Properties.Remove('upright') }

# ---------------------------------------------------------------------------
# Copy images, write sprite.json, run the import
# ---------------------------------------------------------------------------

Write-Section "Import"
New-Item -ItemType Directory -Force -Path $petDir | Out-Null
if (-not $inPlace) {
    foreach ($key in $assign.Keys) {
        # Remove any old image for this key (any extension) so there's only one.
        Get-ChildItem -LiteralPath $petDir -File |
            Where-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name).ToLower() -eq $key -and
                           $ImageExts -contains $_.Extension.ToLower() } |
            Remove-Item -Force
        $dest = Join-Path $petDir ($key + $assign[$key].Extension.ToLower())
        Copy-Item -LiteralPath $assign[$key].FullName -Destination $dest -Force
        Write-Host "  Copied $($assign[$key].Name) -> sprites\$pet\$(Split-Path $dest -Leaf)" -ForegroundColor DarkGray
    }
}
$json = $config | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($jsonPath, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Host "  Wrote sprites\$pet\sprite.json" -ForegroundColor DarkGray
Write-Host ""

Push-Location $RepoRoot
try {
    & node scripts\import_sprites_bulk.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  Import failed." -ForegroundColor Red
        exit 1
    }
    & node scripts\validate_sprites.js
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "  Done. Check $pet in Codotchi: Sprite Preview (Dev)." -ForegroundColor Green
Write-Host ""
