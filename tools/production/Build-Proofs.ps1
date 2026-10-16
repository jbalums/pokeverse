<#
.SYNOPSIS
Build and validate the local S1 asset proof sources and Unreal integration.
.DESCRIPTION
The default stage only generates project-local sources. Engine stages require
an existing Unreal 5.8 installation and its normal toolchain/cache permissions.
Nothing installs software, changes elevation, publishes, or admits canonical
game-dev packages. Logs live under output/asset-evidence/s1-proof-v001.
.EXAMPLE
.\tools\production\Build-Proofs.ps1 -Stage test
.EXAMPLE
.\tools\production\Build-Proofs.ps1 -Stage all -IncludeReducedMotion
#>
[CmdletBinding()]
param(
    [ValidateSet('sources', 'test', 'import', 'build', 'author', 'capture', 'all')]
    [string]$Stage = 'sources',
    [string]$PythonExe = 'C:/Users/balum/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe',
    [string]$EngineRoot = 'C:/Program Files/Epic Games/UE_5.8',
    [switch]$IncludeReducedMotion
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$EvidenceRoot = Join-Path $ProjectRoot 'output/asset-evidence/s1-proof-v001'
$NativeProject = Join-Path $ProjectRoot 'Game/VerdantTrails.uproject'
$ImportProject = Join-Path $ProjectRoot 'Game/ArtPipeline.uproject'
$EditorExe = Join-Path $EngineRoot 'Engine/Binaries/Win64/UnrealEditor-Cmd.exe'
$BuildScript = Join-Path $EngineRoot 'Engine/Build/BatchFiles/Build.bat'
$Inventory = Join-Path $ProjectRoot 'docs/asset-package-inventory.json'
$Verifier = Join-Path $PSScriptRoot 'verify_release.py'
$EnvironmentRelease = Join-Path $ProjectRoot 'assets/production/source/s1-environment/v001'
$CharactersRelease = Join-Path $ProjectRoot 'assets/production/source/s1-characters/v001'

function Invoke-ProofTool {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$ToolArguments
    )
    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
        throw "[$Name] Required executable is unavailable: $Executable"
    }
    $LogPath = Join-Path $EvidenceRoot ($Name + '.log')
    Write-Host "[$Name] Running; log: $LogPath"
    # unittest and several Epic tools write ordinary progress to stderr. Capture
    # it as log data without turning those successful native runs into PowerShell
    # errors. The native exit status remains the success/failure authority.
    $SavedErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $LASTEXITCODE = 0
    try {
        & $Executable @ToolArguments 2>&1 | Out-File -LiteralPath $LogPath -Encoding utf8
        $ToolExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $SavedErrorPreference
    }
    if ($ToolExitCode -ne 0) {
        Get-Content -LiteralPath $LogPath -Tail 60 | Write-Host
        throw "[$Name] Failed with native exit code $ToolExitCode. See $LogPath"
    }
    Write-Host "[$Name] Passed."
}

function Build-Sources {
    Invoke-ProofTool -Name 'source-environment' -Executable $PythonExe -ToolArguments @(
        (Join-Path $PSScriptRoot 'build_environment.py'), '--output', $EnvironmentRelease
    )
    Invoke-ProofTool -Name 'source-characters' -Executable $PythonExe -ToolArguments @(
        (Join-Path $PSScriptRoot 'build_characters.py'), '--output', $CharactersRelease
    )
}

function Test-Proofs {
    Invoke-ProofTool -Name 'tests' -Executable $PythonExe -ToolArguments @(
        '-m', 'unittest', 'discover', '-s', (Join-Path $PSScriptRoot 'tests'), '-v'
    )
    Invoke-ProofTool -Name 'verify-inventory' -Executable $PythonExe -ToolArguments @(
        $Verifier, '--inventory', $Inventory
    )
    Invoke-ProofTool -Name 'verify-environment' -Executable $PythonExe -ToolArguments @(
        $Verifier, '--inventory', $Inventory, '--release', $EnvironmentRelease
    )
    Invoke-ProofTool -Name 'verify-characters' -Executable $PythonExe -ToolArguments @(
        $Verifier, '--inventory', $Inventory, '--release', $CharactersRelease
    )
}

function Import-Proofs {
    Invoke-ProofTool -Name 'unreal-import' -Executable $EditorExe -ToolArguments @(
        $ImportProject,
        ('-ExecutePythonScript=' + (Join-Path $PSScriptRoot 'import_proofs.py')),
        '-ProofImportGroup=All', '-unattended', '-NullRHI', '-nosplash', '-nosound', '-NoSourceControl'
    )
}

function Build-Editor {
    Invoke-ProofTool -Name 'unreal-build' -Executable $BuildScript -ToolArguments @(
        'VerdantTrailsEditor', 'Win64', 'Development', ('-Project=' + $NativeProject),
        '-NoUBA', '-MaxParallelActions=2', '-WaitMutex', '-NoHotReload'
    )
}

function Author-Proofs {
    $AuthorScript = Join-Path $PSScriptRoot 'author_proofs.py'
    if (-not (Test-Path -LiteralPath $AuthorScript -PathType Leaf)) {
        throw "Native scene authoring script is unavailable: $AuthorScript"
    }
    Invoke-ProofTool -Name 'unreal-author' -Executable $EditorExe -ToolArguments @(
        $NativeProject, ('-ExecutePythonScript=' + $AuthorScript),
        '-unattended', '-NullRHI', '-nosplash', '-nosound', '-NoSourceControl'
    )
}

function Capture-Proofs {
    $CaptureArguments = @(
        $NativeProject, '/Game/Verdant/Production/Maps/L_TownReference',
        '-game', '-RenderOffscreen', '-ResX=1920', '-ResY=1080', '-windowed',
        '-ProofCapture', '-unattended', '-nosplash', '-nosound', '-NoSourceControl'
    )
    Invoke-ProofTool -Name 'capture-normal' -Executable $EditorExe -ToolArguments $CaptureArguments
    if ($IncludeReducedMotion) {
        Invoke-ProofTool -Name 'capture-reduced-motion' -Executable $EditorExe -ToolArguments @(
            $CaptureArguments + '-ProofReducedMotion'
        )
    }
}

New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
Push-Location -LiteralPath $ProjectRoot
try {
    switch ($Stage) {
        'sources' { Build-Sources }
        'test' { Test-Proofs }
        'import' { Import-Proofs }
        'build' { Build-Editor }
        'author' { Build-Editor; Author-Proofs }
        'capture' { Capture-Proofs }
        'all' {
            Build-Sources
            Test-Proofs
            Import-Proofs
            Build-Editor
            Author-Proofs
            Capture-Proofs
        }
    }
    Write-Host "Proof stage '$Stage' completed. Import, capture, visual approval, and release acceptance remain distinct evidence."
}
finally {
    Pop-Location
}
