param(
    [Parameter(Mandatory = $true)]
    [string]$PtauPath,

    [string]$WorkspaceRoot = "",
    [string]$CircuitVersion = "omega-v1.0.0",
    [string]$CircuitName = "reaction",
    [string]$CircomCommand = "circom",
    [string]$SnarkJsCommand = "snarkjs",
    [string]$CircomLibIncludePath = "",
    [string]$ContributionEntropy = "local-feat087",
    [switch]$InstallRuntimeArtifacts
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    $WorkspaceRoot = (Resolve-Path (Join-Path $scriptDirectory "..\..")).Path
}

function Ensure-Command {
    param([string]$CommandName)

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $CommandName"
    }
}

function Resolve-SnarkJsRunner {
    param(
        [string]$PreferredCommand,
        [string]$ProjectRootPath
    )

    $preferred = Get-Command $PreferredCommand -ErrorAction SilentlyContinue
    if ($preferred) {
        return @{
            FileName = $preferred.Path
            PrefixArguments = @()
        }
    }

    $node = Get-Command "node" -ErrorAction SilentlyContinue
    if ($node) {
        $localCli = Join-Path $ProjectRootPath "node_modules\snarkjs\build\cli.cjs"
        if (Test-Path $localCli) {
            return @{
                FileName = $node.Path
                PrefixArguments = @($localCli)
            }
        }
    }

    throw "Required command not found: $PreferredCommand"
}

function Get-SnarkJsContributeMode {
    param(
        [hashtable]$Runner
    )

    $helpOutput = & $Runner.FileName @($Runner.PrefixArguments + @("zkey", "contribute", "--help")) 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect snarkjs zkey contribute help output (exit code $LASTEXITCODE)"
    }

    $helpText = ($helpOutput | Out-String)
    if ($helpText -match "--name" -or $helpText -match "(^|\s)-e(\s|,|$)") {
        return "NamedEntropyFlags"
    }

    return "LegacyTwoArg"
}

function Ensure-File {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
}

$workspaceRoot = (Resolve-Path $WorkspaceRoot).Path
$ptauPath = (Resolve-Path $PtauPath).Path

if ([string]::IsNullOrWhiteSpace($CircomLibIncludePath)) {
    $CircomLibIncludePath = Join-Path $workspaceRoot "hush-web-client\node_modules"
}

Ensure-Command -CommandName $CircomCommand
Ensure-File -Path $ptauPath

$circuitDir = Join-Path $workspaceRoot "hush-web-client\circuits\$CircuitVersion"
$circuitPath = Join-Path $circuitDir "$CircuitName.circom"
Ensure-File -Path $circuitPath

$buildRoot = Join-Path $workspaceRoot "hush-web-client\.generated\circuits\$CircuitVersion"
$compileRoot = Join-Path $buildRoot "compile"
$phase2PtauPath = Join-Path $buildRoot "pot17_final_phase2.ptau"
$zkey0Path = Join-Path $buildRoot "${CircuitName}_0000.zkey"
$zkeyFinalPath = Join-Path $buildRoot "${CircuitName}.zkey"
$verificationKeyPath = Join-Path $buildRoot "verification_key.json"
$wasmPath = Join-Path $compileRoot "${CircuitName}_js\$CircuitName.wasm"
$r1csPath = Join-Path $compileRoot "$CircuitName.r1cs"
$snarkJsRunner = Resolve-SnarkJsRunner -PreferredCommand $SnarkJsCommand -ProjectRootPath (Join-Path $workspaceRoot "hush-web-client")
$snarkJsContributeMode = Get-SnarkJsContributeMode -Runner $snarkJsRunner

New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
New-Item -ItemType Directory -Force -Path $compileRoot | Out-Null

$includeArgs = @()
if (-not [string]::IsNullOrWhiteSpace($CircomLibIncludePath)) {
    $resolvedIncludePath = (Resolve-Path $CircomLibIncludePath).Path
    $includeArgs += "-l"
    $includeArgs += $resolvedIncludePath
}

Push-Location $circuitDir
try {
    & $CircomCommand $CircuitPath --r1cs --wasm --sym -o $compileRoot @includeArgs
    if ($LASTEXITCODE -ne 0) {
        if (-not ((Test-Path $r1csPath) -and (Test-Path $wasmPath))) {
            throw "circom compilation failed with exit code $LASTEXITCODE"
        }

        Write-Warning "circom returned exit code $LASTEXITCODE, but required outputs already exist. Continuing."
    }
}
finally {
    Pop-Location
}

& $snarkJsRunner.FileName @($snarkJsRunner.PrefixArguments + @("powersoftau", "prepare", "phase2", $ptauPath, $phase2PtauPath, "-v"))
if ($LASTEXITCODE -ne 0) {
    throw "snarkjs powersoftau prepare phase2 failed with exit code $LASTEXITCODE"
}

& $snarkJsRunner.FileName @($snarkJsRunner.PrefixArguments + @("groth16", "setup", $r1csPath, $phase2PtauPath, $zkey0Path))
if ($LASTEXITCODE -ne 0) {
    throw "snarkjs groth16 setup failed with exit code $LASTEXITCODE"
}

if ($snarkJsContributeMode -eq "NamedEntropyFlags") {
    & $snarkJsRunner.FileName @($snarkJsRunner.PrefixArguments + @("zkey", "contribute", $zkey0Path, $zkeyFinalPath, "--name", "Hush FEAT-087", "-e", $ContributionEntropy))
    if ($LASTEXITCODE -ne 0) {
        throw "snarkjs zkey contribute failed with exit code $LASTEXITCODE"
    }
}
else {
    if ([string]::IsNullOrWhiteSpace($ContributionEntropy)) {
        throw "ContributionEntropy must be provided for legacy snarkjs zkey contribute mode."
    }

    $ContributionEntropy | & $snarkJsRunner.FileName @($snarkJsRunner.PrefixArguments + @("zkey", "contribute", $zkey0Path, $zkeyFinalPath))
    if ($LASTEXITCODE -ne 0) {
        throw "snarkjs zkey contribute failed with exit code $LASTEXITCODE"
    }
}

& $snarkJsRunner.FileName @($snarkJsRunner.PrefixArguments + @("zkey", "export", "verificationkey", $zkeyFinalPath, $verificationKeyPath))
if ($LASTEXITCODE -ne 0) {
    throw "snarkjs zkey export verificationkey failed with exit code $LASTEXITCODE"
}

Write-Host "[OK] Circuit build outputs:"
Write-Host "  WASM: $wasmPath"
Write-Host "  ZKey: $zkeyFinalPath"
Write-Host "  Verification Key: $verificationKeyPath"

if ($InstallRuntimeArtifacts) {
    $installScript = Join-Path $workspaceRoot "hush-server-node\scripts\install-feat087-circuit-artifacts.ps1"
    if (-not (Test-Path $installScript)) {
        throw "Install script not found: $installScript"
    }

    Write-Host ""
    Write-Host "Install the approved artifacts with:"
    Write-Host "powershell -ExecutionPolicy Bypass -File `"$installScript`" -ClientWasmSource `"$wasmPath`" -ClientZkeySource `"$zkeyFinalPath`" -ServerVerificationKeySource `"$verificationKeyPath`" -Provenance `"REPLACE_ME`" -TrustedSetup `"REPLACE_ME`" -GeneratedBy `"circom + snarkjs`""
}
