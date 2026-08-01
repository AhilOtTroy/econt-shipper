@echo off
REM Batch watermark remover - Windows one-click start.
REM
REM Double-click this file. First run installs everything and downloads the
REM models (a few GB, several minutes). Later runs start in seconds.
REM
REM The fussy part is the Python version. torch and scipy only publish
REM prebuilt Windows wheels for a range of Python versions; on anything newer,
REM pip tries to COMPILE them from source and fails. So this picks a known-good
REM Python rather than whatever happens to be first on PATH.
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ============================================
echo   Batch watermark remover - starting up
echo ============================================
echo.

call :findpython
if not defined PY goto nopython

echo Using: %PY%
%PY% -c "import sys,struct; print('   Python', sys.version.split()[0], struct.calcsize('P')*8, 'bit')"
echo.

REM Install into a private virtual environment next to this file rather than
REM the system Python. It keeps this project's packages away from whatever
REM else is installed, so a stray second copy of a package cannot win the
REM import and break things in a way that is very hard to diagnose.
set "VENV=%~dp0.venv"
set "VPY=%VENV%\Scripts\python.exe"
if not exist "%VPY%" (
    echo Creating a private environment in .venv ...
    %PY% -m venv "%VENV%"
    if errorlevel 1 goto installfailed
)

REM Only install when something is actually missing, so restarts stay fast.
"%VPY%" -c "import flask, cv2, easyocr, iopaint" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies. First time only - this takes a few minutes.
    echo.
    "%VPY%" -m pip install --upgrade pip setuptools wheel
    REM --no-deps on purpose: IOPaint pins Pillow==9.5.0 and gradio==4.21.0.
    REM Installing those pins drags in numpy 1.x, and on a current Python none
    REM of them have prebuilt files, so pip tries to compile them and fails.
    REM That is the real cause of the "failed to build scipy" error: scipy is
    REM innocent, it is numpy 1.x being compiled inside scipy's build step.
    "%VPY%" -m pip install --no-deps iopaint==1.6.0
    if errorlevel 1 goto installfailed
    REM --only-binary turns a doomed ten-minute compile into an instant, clear
    REM "no matching distribution" message naming the guilty package.
    "%VPY%" -m pip install --only-binary=numpy,scipy,scikit-image,pillow,torch,torchvision,opencv-python-headless,python-bidi -r requirements-watermark.txt
    if errorlevel 1 goto installfailed
    echo.
    echo Dependencies installed.
    echo.
)

echo Starting the web page. Your browser opens by itself.
echo Close this window when you are finished.
echo.
"%VPY%" watermark_web.py
if errorlevel 1 (
    echo.
    echo The server stopped with an error. The messages above say why.
    echo.
)
pause
exit /b 0


REM ---------------------------------------------------------------------------
REM Pick a Python that actually has wheels. Preference order matters: named
REM versions known to work come first, and each candidate must really run -
REM "py" can exist with no Python 3 behind it, and "python" on PATH is often
REM the Microsoft Store stub that does nothing.
REM ---------------------------------------------------------------------------
REM check_python.py exits 0 only for a 64-bit interpreter in the version range
REM that has prebuilt wheels. It is a separate file because cmd's parser breaks
REM on the parentheses a version comparison needs inside a FOR block.
:findpython
set "PY="
for %%V in (3.12 3.11 3.13 3.10) do (
    if not defined PY (
        py -%%V check_python.py >nul 2>&1 && set "PY=py -%%V"
    )
)
if not defined PY (
    for %%C in ("py -3" "python" "python3") do (
        if not defined PY (
            %%~C check_python.py >nul 2>&1 && set "PY=%%~C"
        )
    )
)
exit /b 0


:nopython
echo ============================================
echo   No suitable Python found.
echo ============================================
echo.
echo This needs 64-bit Python 3.12 (3.10 - 3.13 also work).
echo A newer Python is the problem, not the solution: PyTorch and friends
echo do not ship prebuilt Windows files for it yet, so pip tries to
echo compile them and fails. Python 3.15 has nothing prebuilt at all.
echo.
echo What is installed now:
py -0 2>nul
echo.
echo Why each one was rejected:
py -3 check_python.py --why 2>nul
python check_python.py --why 2>nul
echo.
choice /c YN /m "Install Python 3.12 automatically with winget"
if errorlevel 2 goto manualpython

echo.
echo Installing Python 3.12 ...
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto manualpython

echo.
echo Checking again ...
call :findpython
if not defined PY goto manualpython
echo Found: %PY%
echo.
echo Python 3.12 installed. Run this file again to finish setup.
echo.
pause
exit /b 0

:manualpython
echo.
echo Install Python 3.12 by hand:
echo   https://www.python.org/downloads/release/python-31210/
echo Choose "Windows installer (64-bit)" and tick
echo "Install launcher for all users". You can leave "Add python.exe to
echo PATH" unchecked - this launcher finds it with "py -3.12" either way.
echo Then run this file again.
echo.
pause
exit /b 1


:installfailed
echo.
echo ============================================
echo   Installing the dependencies failed.
echo ============================================
echo.
echo Your Python is:
%PY% -c "import sys,struct; print('   Python', sys.version.split()[0], struct.calcsize('P')*8, 'bit')"
echo.
echo If the error above says no matching distribution was found, this Python
echo has no prebuilt file for that package. Install Python 3.12 and run this
echo file again:
echo.
echo   winget install -e --id Python.Python.3.12
echo.
echo Full diagnostic follows. Send all of it if you need help.
echo.
if exist "%VPY%" ("%VPY%" watermark_doctor.py) else (%PY% watermark_doctor.py)
echo.
pause
exit /b 1
