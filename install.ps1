# Batch watermark remover - one-command installer for Windows.
#
#   irm https://raw.githubusercontent.com/AhilOtTroy/econt-shipper/refs/heads/claude/batch-watermark-remover-iopaint-i4t9dk/install.ps1 | iex
#
# Deliberately self-contained. It does not clone, does not unzip, and does not
# read anything already on disk, so there is no stale copy to run by accident.
# It never touches a Python installed on this PC - it downloads its own into
# C:\wm\python and refuses to continue if anything else is in play.
#
# Written for Windows PowerShell 5.1, which is what ships with Windows:
#   - no ternaries, no ?? operator, no ForEach-Object -Parallel
#   - $LASTEXITCODE is checked after every native command, because PowerShell
#     does not stop on a native failure no matter what ErrorActionPreference says

$ErrorActionPreference = 'Stop'
$WMVERSION = '2026-08-02.2'

$Branch  = 'refs/heads/claude/batch-watermark-remover-iopaint-i4t9dk'
$RawBase = "https://raw.githubusercontent.com/AhilOtTroy/econt-shipper/$Branch"
$PyTag   = '20260728'
$PyVer   = 'cpython-3.12.13+20260728'
# Always x86_64, even on ARM: PyTorch publishes no win_arm64 wheel at all, and
# x64 runs fine under Windows-on-ARM emulation.
$PyUrl   = "https://github.com/astral-sh/python-build-standalone/releases/download/$PyTag/$PyVer-x86_64-pc-windows-msvc-install_only.tar.gz"

function Say($msg, $colour = 'Gray') { Write-Host $msg -ForegroundColor $colour }
function Die($msg) {
    Write-Host ''
    Write-Host '============================================' -ForegroundColor Red
    Write-Host $msg -ForegroundColor Red
    Write-Host '============================================' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Copy everything above and send it.' -ForegroundColor Yellow
    Read-Host 'Press Enter to close'
    exit 1
}
# Native commands do not throw. Every single one is checked through this.
function CheckExit($what) {
    if ($LASTEXITCODE -ne 0) { Die "$what failed with exit code $LASTEXITCODE" }
}

Write-Host ''
Write-Host "[WM] installer v$WMVERSION" -ForegroundColor Cyan
Write-Host "[WM] this uses its own Python and ignores any Python on this PC" -ForegroundColor Cyan
Write-Host ''

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
$ProgressPreference = 'SilentlyContinue'

# --- where it lives -------------------------------------------------------
# A short ASCII path on purpose: keeps the deep site-packages trees clear of
# the 260 character path limit, and avoids non-ASCII usernames entirely.
$Root = 'C:\wm'
try {
    New-Item -ItemType Directory -Force -Path $Root -ErrorAction Stop | Out-Null
} catch {
    $Root = Join-Path $env:USERPROFILE 'wm'
    Say "C:\wm was not allowed, using $Root instead" 'Yellow'
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
}
$PyDir  = Join-Path $Root 'python'
$PyExe  = Join-Path $PyDir 'python.exe'
$Models = Join-Path $Root 'models'
Say "[WM] folder $Root" 'Cyan'

try {
    $drive = [IO.Path]::GetPathRoot($Root).TrimEnd('\').TrimEnd(':')
    $free = (Get-PSDrive -Name $drive -ErrorAction Stop).Free
    if ($free -and $free -lt 8GB) {
        Die ("Not enough free disk space on {0}: {1:N1} GB free, about 8 GB needed." -f $drive, ($free / 1GB))
    }
} catch {
    # Not being able to measure free space is no reason to refuse to install.
}

# --- step 1: private Python ----------------------------------------------
if (Test-Path $PyExe) {
    Say 'Step 1 of 4: private Python already here.' 'Green'
} else {
    Say 'Step 1 of 4: downloading a private Python (45 MB) ...'
    $tarball = Join-Path $Root 'python-download.tar.gz'
    try {
        Invoke-WebRequest -Uri $PyUrl -OutFile $tarball -UseBasicParsing
    } catch {
        Die "Could not download Python.`n$($_.Exception.Message)`n`nURL: $PyUrl`nA firewall or VPN blocking github.com would do this."
    }
    if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
        Die 'tar.exe is missing. It is built into Windows 10 build 17063 and newer.'
    }
    # Extract with the working directory set, and pass no -C. A quoted path
    # ending in a backslash is corrupted by the C runtime: the backslash
    # escapes the quote and the argument arrives with a stray " glued on.
    Push-Location $Root
    try {
        tar.exe -xf 'python-download.tar.gz'
        CheckExit 'Extracting Python'
    } finally { Pop-Location }
    if (-not (Test-Path $PyExe)) { Die "Extract finished but $PyExe is missing." }
    Remove-Item $tarball -Force -ErrorAction SilentlyContinue
    Say '   done.' 'Green'
}

# --- step 2: prove it is ours, not the PC's ------------------------------
# The Microsoft Store Python is the usual accidental winner here, and it is
# what caused every earlier failure. Judge by base_prefix, not by path: a
# virtualenv over a system Python sits in our folder yet still IS that Python.
$probe = & $PyExe -c "import sys,os,struct;print(os.path.realpath(sys.executable));print(os.path.realpath(sys.base_prefix));print(sys.version.split()[0]);print(struct.calcsize('P')*8)"
CheckExit 'Starting the private Python'
if (-not $probe -or @($probe).Count -lt 4) {
    Die "The private Python did not report itself properly. Delete $PyDir and run this again."
}
$exe, $base, $pyv, $bits = $probe
if ($base.TrimEnd('\') -ne $PyDir.TrimEnd('\')) {
    Die "Refusing to run: that is not the private Python.`n  interpreter: $exe`n  base:        $base`n  expected:    $PyDir`n`nDelete $PyDir and run this again."
}
Say "[WM] python $exe" 'Cyan'
Say "[WM] $pyv $bits-bit  PRIVATE OK" 'Green'

# --- step 3: the program files -------------------------------------------
Say 'Step 2 of 4: fetching the program ...'
$files = @(
    'watermark_core.py', 'watermark_web.py', 'watermark_remover.py',
    'watermark_ui.html', 'watermark_doctor.py', 'check_private.py',
    'requirements-watermark.txt'
)
foreach ($f in $files) {
    try {
        Invoke-WebRequest -Uri "$RawBase/$f" -OutFile (Join-Path $Root $f) -UseBasicParsing
    } catch {
        Die "Could not download $f`n$($_.Exception.Message)"
    }
}
# The one package PyPI has no wheel for, prebuilt so nothing ever compiles.
$wheelDir = Join-Path $Root 'wheels'
New-Item -ItemType Directory -Force -Path $wheelDir | Out-Null
$wheel = 'antlr4_python3_runtime-4.9.3-py3-none-any.whl'
try {
    Invoke-WebRequest -Uri "$RawBase/wheels/$wheel" -OutFile (Join-Path $wheelDir $wheel) -UseBasicParsing
} catch {
    Die "Could not download $wheel`n$($_.Exception.Message)"
}
Say '   done.' 'Green'

# --- step 4: components ---------------------------------------------------
& $PyExe -c "import flask, cv2, easyocr, iopaint" 2>$null 1>$null
if ($LASTEXITCODE -eq 0) {
    Say 'Step 3 of 4: components already installed.' 'Green'
} else {
    Say 'Step 3 of 4: installing components, about 2.5 GB.'
    Say '   First run only. Several minutes, and it looks frozen at times.'
    Say '   Leave this window alone until it finishes.' 'Yellow'

    $env:PYTHONNOUSERSITE = '1'   # ignore any leftover per-user packages
    $env:PYTHONHOME = ''
    $env:PYTHONPATH = ''
    $env:PIP_CACHE_DIR = Join-Path $Root 'cache\pip'
    $env:PIP_DISABLE_PIP_VERSION_CHECK = '1'

    & $PyExe -m pip install --upgrade --no-warn-script-location pip setuptools wheel
    CheckExit 'Upgrading pip'

    # --no-deps: IOPaint pins Pillow 9.5.0 and gradio 4.21.0, which drag in
    # numpy 1.x. None of those have prebuilt files for current Python, so pip
    # would try to compile them and fail.
    & $PyExe -m pip install --no-warn-script-location --no-deps iopaint==1.6.0
    CheckExit 'Installing IOPaint'

    & $PyExe -m pip install --no-warn-script-location --no-index --find-links $wheelDir antlr4-python3-runtime==4.9.3
    CheckExit 'Installing the prebuilt antlr wheel'

    # --only-binary turns a doomed compile into an instant, clear message.
    $onlyBinary = '--only-binary=numpy,scipy,scikit-image,pillow,torch,torchvision,opencv-python-headless,python-bidi,shapely,pyclipper,ninja,tokenizers,safetensors,regex'
    & $PyExe -m pip install --no-warn-script-location $onlyBinary -r (Join-Path $Root 'requirements-watermark.txt')
    CheckExit 'Installing the components'
    Say '   done.' 'Green'
}

# --- a shortcut for next time --------------------------------------------
$startCmd = Join-Path $Root 'START.bat'
@"
@echo off
cd /d "%~dp0"
set "EASYOCR_MODULE_PATH=%~dp0models\easyocr"
set "PYTHONNOUSERSITE=1"
echo Starting the watermark remover. Your browser opens by itself.
"%~dp0python\python.exe" "%~dp0watermark_web.py" --model-dir "%~dp0models" --port 5057
pause
"@ | Set-Content -Path $startCmd -Encoding ASCII

# --- run ------------------------------------------------------------------
Say ''
Say 'Step 4 of 4: starting. Your browser opens by itself.' 'Green'
Say "Next time just double-click  $startCmd" 'Cyan'
Say 'Keep this window open while you use it.' 'Yellow'
Say ''
$env:EASYOCR_MODULE_PATH = Join-Path $Models 'easyocr'
& $PyExe (Join-Path $Root 'watermark_web.py') --model-dir $Models --port 5057
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'It stopped with an error. Diagnostic follows - send all of it.' -ForegroundColor Red
    Write-Host ''
    & $PyExe (Join-Path $Root 'watermark_doctor.py')
    Read-Host 'Press Enter to close'
    exit 1
}
