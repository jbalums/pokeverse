$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$gameFile = Join-Path $projectRoot 'prototypes/verdant-town-3d.html'
if (!(Test-Path -LiteralPath $gameFile -PathType Leaf)) {
    throw "Browser game not found: $gameFile"
}
Start-Process -FilePath ([System.Uri]::new($gameFile).AbsoluteUri)
