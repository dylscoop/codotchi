$lines = @('protocol=https', 'host=github.com', 'username=dylscoop', '')
$creds = $lines | & 'C:\Program Files\Git\mingw64\libexec\git-core\git-credential-wincred.exe' get
$token = ($creds | Where-Object { $_ -match '^password=' }) -replace '^password=', ''

$headers = @{
    Authorization          = "token $token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

# Step 1 - delete existing release
Write-Host "Deleting existing release..."
Invoke-RestMethod -Uri 'https://api.github.com/repos/dylscoop/codotchi/releases/315289819' -Method Delete -Headers $headers
Write-Host "Deleted."

# Step 2 - create as draft
$body = "## Features`n`n"
$body += "- **Extension renamed to Codotchi** - The VS Code extension ID, display name, and publisher are now codotchi. The artifact is codotchi-1.14.4.vsix (previously vscode-codotchi-X.Y.Z.vsix).`n"
$body += "- **Manual refresh button** - A refresh icon appears in the VS Code sidebar toolbar and the PyCharm tool window toolbar. Reloads pet state from disk immediately.`n"
$body += "- **File watcher (PyCharm)** - The PyCharm plugin now watches the shared state file via JVM WatchService with a 200ms debounce, so the pet updates automatically when VS Code writes a save event.`n"
$body += "- **Contextual speech (OpenCode)** - The OpenCode pet now reacts to idle time (30m/60m), high message volume (5/10/20 prompts), production branch detection, todo completions, and session diffs.`n`n"
$body += "## Bug fixes`n`n"
$body += "- **ASCII art misalignment** - Fixed misaligned speech bubble rendering in the OpenCode terminal renderer.`n`n"
$body += "## Artifacts`n`n"
$body += "- codotchi-1.14.4.vsix - VS Code extension (renamed from vscode-codotchi)`n"
$body += "- pycharm-codotchi-1.14.4.zip - PyCharm / JetBrains plugin`n"
$body += "- opencode-codotchi-1.15.0.zip - OpenCode plugin`n"

$payload = [ordered]@{
    tag_name         = 'v1.15.0'
    target_commitish = 'main'
    name             = 'v1.15.0 - Codotchi rename, refresh button, file watcher, contextual speech'
    body             = $body
    draft            = $true
    prerelease       = $false
} | ConvertTo-Json -Depth 3

Write-Host "Creating draft release..."
$rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/dylscoop/codotchi/releases' -Method Post -Headers $headers -Body $payload -ContentType 'application/json'
Write-Host "Draft created: id=$($rel.id)"

# Step 3 - upload assets
$releaseId = $rel.id
$baseUrl = "https://uploads.github.com/repos/dylscoop/codotchi/releases/$releaseId/assets"

$assets = @(
    @{ path = "vscode\codotchi-1.14.4.vsix";                             name = "codotchi-1.14.4.vsix" },
    @{ path = "pycharm\build\distributions\pycharm-codotchi-1.14.4.zip"; name = "pycharm-codotchi-1.14.4.zip" },
    @{ path = "opencode-codotchi\opencode-codotchi-1.15.0.zip";           name = "opencode-codotchi-1.15.0.zip" }
)

foreach ($asset in $assets) {
    $url = "$baseUrl`?name=$($asset.name)"
    $fullPath = Join-Path $PSScriptRoot $asset.path
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    Write-Host "Uploading $($asset.name) ($($bytes.Length) bytes)..."
    try {
        $r = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $bytes -ContentType 'application/octet-stream'
        Write-Host "  OK: $($r.browser_download_url)"
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)"
        Write-Host $_.ErrorDetails.Message
    }
}

# Step 4 - publish
Write-Host "Publishing release..."
$publishPayload = [ordered]@{ draft = $false } | ConvertTo-Json
$final = Invoke-RestMethod -Uri "https://api.github.com/repos/dylscoop/codotchi/releases/$releaseId" -Method Patch -Headers $headers -Body $publishPayload -ContentType 'application/json'
Write-Host "SUCCESS: $($final.html_url)"
