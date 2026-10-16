param([string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$packaged = Join-Path $projectRoot 'output/Windows/VerdantTrails.exe'
if (Test-Path -LiteralPath $packaged) {
    Start-Process -FilePath $packaged -WorkingDirectory (Split-Path $packaged) -WindowStyle Normal
    exit
}
$editor = Join-Path $EngineRoot 'Engine/Binaries/Win64/UnrealEditor.exe'
$projectFile = Join-Path $projectRoot 'Game/VerdantTrails.uproject'
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'Game/Binaries/Win64/UnrealEditor-VerdantTrails.dll'))) {
    throw 'Build the project first: powershell -File tools/Build-Town.ps1 -Stage all'
}
Start-Process -FilePath $editor -ArgumentList @(('"'+$projectFile+'"'),'-game','-windowed','-ResX=1600','-ResY=900') -WorkingDirectory $projectRoot -WindowStyle Normal
