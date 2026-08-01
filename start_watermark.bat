@echo off
REM ===========================================================================
REM  Batch watermark remover - Windows. Double-click this file.
REM
REM  This does NOT use, need, or touch any Python you have installed. It
REM  downloads its own private Python into a "python" folder next to this file
REM  and uses only that. Nothing is installed system-wide, nothing is added to
REM  PATH, no admin rights are needed, and no Python version on your machine
REM  can break it.
REM
REM  To uninstall completely: delete this folder. That is all.
REM
REM  First run downloads about 2.5 GB and takes several minutes. Later runs
REM  start in seconds.
REM ===========================================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "PYDIR=%~dp0python"
set "PYEXE=%PYDIR%\python.exe"
set "MODELS=%~dp0models"
set "TARBALL=%~dp0python-download.tar.gz"

REM Pinned build. Verified to exist and to run this project end to end.
set "PYVER=cpython-3.12.13+20260728"
set "PYTAG=20260728"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set "PYPLAT=aarch64-pc-windows-msvc"
) else (
    set "PYPLAT=x86_64-pc-windows-msvc"
)
set "PYURL=https://github.com/astral-sh/python-build-standalone/releases/download/%PYTAG%/%PYVER%-%PYPLAT%-install_only.tar.gz"

echo ============================================
echo   Batch watermark remover
echo ============================================
echo.

REM ---------------------------------------------------------------- Python --
if exist "%PYEXE%" goto haspython

echo Step 1 of 3: downloading a private Python (about 45 MB).
echo This is not installed on your system - it lives in this folder only.
echo.
where curl.exe >nul 2>&1
if errorlevel 1 goto usepowershell
curl.exe -L --fail --progress-bar -o "%TARBALL%" "%PYURL%"
if errorlevel 1 goto usepowershell
goto extract

:usepowershell
echo (using PowerShell to download)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PYURL%' -OutFile '%TARBALL%' -UseBasicParsing"
if errorlevel 1 goto downloadfailed

:extract
if not exist "%TARBALL%" goto downloadfailed
echo Extracting ...
where tar.exe >nul 2>&1
if errorlevel 1 goto notar
tar -xf "%TARBALL%" -C "%~dp0"
if errorlevel 1 goto extractfailed
del "%TARBALL%" >nul 2>&1
if not exist "%PYEXE%" goto extractfailed
echo Private Python ready.
echo.

:haspython
"%PYEXE%" -c "import sys; print('   using', sys.version.split()[0], 'from this folder')"
if errorlevel 1 goto pythonbroken

REM ---------------------------------------------------------- Dependencies --
"%PYEXE%" -c "import flask, cv2, easyocr, iopaint" >nul 2>&1
if errorlevel 1 (
    echo.
    echo Step 2 of 3: installing components, about 2.5 GB. First run only,
    echo this takes several minutes. Leave it alone until it finishes.
    echo.
    "%PYEXE%" -m pip install --upgrade --no-warn-script-location pip setuptools wheel
    REM --no-deps on purpose: IOPaint pins Pillow==9.5.0 and gradio==4.21.0,
    REM and gradio drags in numpy 1.x. On current Python none of those have
    REM prebuilt files, so pip would try to compile them and fail. That is the
    REM real cause of the "failed to build scipy" error - scipy is innocent,
    REM it is numpy 1.x being compiled inside scipy's build step that dies.
    "%PYEXE%" -m pip install --no-warn-script-location --no-deps iopaint==1.6.0
    if errorlevel 1 goto installfailed
    REM --only-binary turns a doomed compile into an instant, clear message.
    "%PYEXE%" -m pip install --no-warn-script-location --only-binary=numpy,scipy,scikit-image,pillow,torch,torchvision,opencv-python-headless,python-bidi -r requirements-watermark.txt
    if errorlevel 1 goto installfailed
    echo.
    echo Components installed.
)

REM ---------------------------------------------------------------- Launch --
REM Keep the AI models inside this folder too, so the whole thing stays
REM self-contained and deleting the folder really does remove everything.
set "EASYOCR_MODULE_PATH=%MODELS%\easyocr"
echo.
echo Step 3 of 3: starting. Your browser opens by itself.
echo Close this window when you are finished.
echo.
"%PYEXE%" watermark_web.py --model-dir "%MODELS%"
if errorlevel 1 (
    echo.
    echo It stopped with an error. Full diagnostic follows - send all of it.
    echo.
    "%PYEXE%" watermark_doctor.py
)
echo.
pause
exit /b 0


:downloadfailed
echo.
echo ============================================
echo   Could not download Python.
echo ============================================
echo.
echo Tried: %PYURL%
echo.
echo Check the internet connection. If you are behind a company firewall or
echo VPN that blocks github.com, that is the cause.
echo.
echo You can also download that link in a browser, save it next to this file
echo as python-download.tar.gz, and run this again - it will use the file.
echo.
pause
exit /b 1

:notar
echo.
echo ERROR: tar.exe was not found. It is built into Windows 10 build 17063
echo and newer. On an older Windows, extract this file by hand with 7-Zip:
echo   %TARBALL%
echo so that python\python.exe ends up next to this .bat file, then run again.
echo.
pause
exit /b 1

:extractfailed
echo.
echo ERROR: could not extract the Python download - the file may be damaged.
echo Delete this file and run again to re-download it:
echo   %TARBALL%
echo.
pause
exit /b 1

:pythonbroken
echo.
echo ERROR: the private Python did not run. Delete the "python" folder next
echo to this file and run this again to reinstall it.
echo.
pause
exit /b 1

:installfailed
echo.
echo ============================================
echo   Installing components failed.
echo ============================================
echo.
echo Usually this is a dropped connection - running this file again resumes
echo where it stopped and is safe.
echo.
echo Full diagnostic follows. Send all of it if you need help.
echo.
"%PYEXE%" watermark_doctor.py
echo.
pause
exit /b 1
