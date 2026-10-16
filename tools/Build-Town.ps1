param(
    [ValidateSet('assets','build','test','package','all')][string]$Stage = 'all',
    [string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$projectFile = Join-Path $projectRoot 'Game/VerdantTrails.uproject'
$editor = Join-Path $EngineRoot 'Engine/Binaries/Win64/UnrealEditor-Cmd.exe'
$build = Join-Path $EngineRoot 'Engine/Build/BatchFiles/Build.bat'
$uat = Join-Path $EngineRoot 'Engine/Build/BatchFiles/RunUAT.bat'
$evidenceDir = Join-Path $projectRoot 'output'
New-Item -ItemType Directory -Force $evidenceDir | Out-Null
if (!(Test-Path -LiteralPath $editor)) { throw "Unreal Editor not found: $editor" }

function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$LogName) {
    $logPath = Join-Path $evidenceDir $LogName
    & $File @Arguments *> $logPath
    if ($LASTEXITCODE -ne 0) { Get-Content -LiteralPath $logPath -Tail 35; throw "Failed ($LASTEXITCODE): $File. See $logPath" }
    Write-Host "Completed: $LogName"
}

Push-Location $projectRoot
try {
    if ($Stage -in @('assets','all')) {
        Invoke-Checked 'py' @('-3','tools/build_kit.py') 'kit-source.log'
        Invoke-Checked $editor @((Join-Path $projectRoot 'Game/ArtPipeline.uproject'),
            "-ExecutePythonScript=$(Join-Path $PSScriptRoot 'import_town.py')",'-unattended','-NullRHI','-nosplash','-nosound') 'asset-import-console.log'
    }
    if ($Stage -in @('build','all')) {
        Invoke-Checked $build @('VerdantTrailsEditor','Win64','Development',"-Project=$projectFile",'-WaitMutex','-NoHotReloadFromIDE','-NoUBA','-MaxParallelActions=2') 'editor-build.log'
        Invoke-Checked $editor @($projectFile,"-ExecutePythonScript=$(Join-Path $PSScriptRoot 'author_town.py')",'-unattended','-NullRHI','-nosplash','-nosound') 'town-author.log'
    }
    if ($Stage -in @('test','all')) {
        Invoke-Checked 'py' @('-3','-m','unittest','discover','-s','tools/tests','-v') 'kit-tests.log'
        Invoke-Checked $editor @($projectFile,'-unattended','-NullRHI','-nosplash','-nosound',
            '-ExecCmds=Automation RunTests Verdant.Corner','-TestExit=Automation Test Queue Empty',
            "-ReportExportPath=$(Join-Path $evidenceDir 'automation')") 'automation.log'
    }
    if ($Stage -in @('package','all')) {
        Invoke-Checked $build @('VerdantTrails','Win64','Development',"-Project=$projectFile",'-WaitMutex','-NoUBA','-MaxParallelActions=2') 'game-build.log'
        Invoke-Checked $uat @('BuildCookRun',"-project=$projectFile",'-noP4','-platform=Win64',
            '-clientconfig=Development','-skipbuild','-cook','-stage','-pak','-archive','-nocompileeditor',
            "-archivedirectory=$(Join-Path $evidenceDir 'Windows')",'-unattended','-utf8output') 'package.log'
    }
} finally { Pop-Location }
