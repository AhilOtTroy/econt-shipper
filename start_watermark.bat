@echo off
REM Batch watermark remover - Windows one-click start.
REM Double-click this file. First run installs everything and downloads the
REM models (a few GB, several minutes). Later runs start in seconds.
setlocal
cd /d "%~dp0"

echo ============================================
echo   Batch watermark remover - starting up
echo ============================================
echo.

REM Prefer the py launcher, fall back to python. Each candidate has to actually
REM run before we commit to it: "py" can exist with no Python 3 behind it, and
REM "python" on PATH can be the Store stub that does nothing.
set "PY="
py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
if not defined PY (
    python -c "import sys" >nul 2>&1 && set "PY=python"
)
if not defined PY (
    python3 -c "import sys" >nul 2>&1 && set "PY=python3"
)
if not defined PY (
    echo ERROR: Python is not installed, or not on PATH.
    echo.
    echo Install Python 3.11 or 3.12 from https://www.python.org/downloads/
    echo and tick "Add python.exe to PATH" in the installer, then run this again.
    echo.
    pause
    exit /b 1
)

echo Using: %PY%
%PY% -c "import sys; print('Python', sys.version.split()[0])"
echo.

REM Only install when something is actually missing, so restarts stay fast.
%PY% -c "import flask, cv2, easyocr, iopaint" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies. First time only - this takes a few minutes.
    echo.
    %PY% -m pip install --upgrade pip
    %PY% -m pip install --upgrade setuptools wheel
    %PY% -m pip install iopaint easyocr opencv-python-headless flask
    if errorlevel 1 (
        echo.
        echo ERROR: installing the dependencies failed. The messages above say why.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed.
    echo.
)

echo Starting the web page. Your browser opens by itself.
echo Close this window when you are finished.
echo.
%PY% watermark_web.py
if errorlevel 1 (
    echo.
    echo The server stopped with an error. The messages above say why.
    echo.
)
pause
