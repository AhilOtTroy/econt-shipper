@echo off
REM ===========================================================================
REM  Batch watermark remover - Windows launcher.
REM
REM  Uses NO Python from this PC. It downloads its own private Python into a
REM  "python" folder beside this file and uses only that. Nothing is installed
REM  system-wide, nothing touches PATH, no admin needed. To uninstall, delete
REM  this folder.
REM
REM  Every rule below was verified by running this under a real Windows shell
REM  with a real MSVC-built python.exe. They are bugs that were hit, not
REM  hypotheticals:
REM
REM   * Never end a quoted argument with %~dp0. That path ends in a backslash,
REM     and a backslash before a closing quote is an ESCAPED quote to the C
REM     runtime, so the argument arrives with a stray quote glued on. Measured:
REM     -C "%~dp0" produced  argv = C:\users\Test User\wm"  and tar then failed
REM     with a misleading "corrupt download". Use %HEREN%, stripped of it.
REM
REM   * Check errors with  if not "%errorlevel%"=="0" . Measured: a crash exit
REM     code of -1073741515 (missing DLL) is NOT caught by  if errorlevel 1 ,
REM     because that means ">= 1". The string compare catches it.
REM
REM   * Do not use  ||  after the cd builtin; it fires even on success.
REM
REM   * Delayed expansion must stay OFF, or an exclamation mark anywhere in the
REM     folder path is silently eaten out of every variable.
REM
REM   * Keep errorlevel checks out of parenthesised blocks - %errorlevel% is
REM     substituted when the block is parsed, not when it runs.
REM ===========================================================================
setlocal EnableExtensions DisableDelayedExpansion

set "WMVERSION=2026-08-04.4"
set "HERE=%~dp0"
REM Same path without the trailing backslash. Required for any quoted argument.
set "HEREN=%HERE:~0,-1%"
cd /d "%HERE%"

REM ---------------------------------------------------------- MAX_PATH ------
REM Windows refuses to create a file whose full path exceeds 260 characters,
REM and Python packages nest deeply. Measured on a real failure: unzipping to
REM Downloads gives a 122-character folder prefix, because GitHub's archive
REM repeats the 59-character branch folder inside itself, and pip then died on
REM   ...\python\Lib\site-packages\networkx\algorithms\centrality\tests\
REM   test_current_flow_betweenness_centrality_subset.py
REM at exactly 260 characters. From C:\wm the same file is 118.
REM So the program moves itself somewhere short before installing anything.
set "TARGET=C:\wm"
if /i "%HEREN%"=="%TARGET%" goto shortpath
md "%TARGET%" >nul 2>&1
if exist "%TARGET%\." goto relocate
REM C:\ refused us, e.g. a locked-down machine. Home is still far shorter.
set "TARGET=%USERPROFILE%\wm"
md "%TARGET%" >nul 2>&1
if not exist "%TARGET%\." goto cannotrelocate

:relocate
echo Setting up in a short folder, so Windows' 260-character path limit
echo cannot break the install:
echo    %TARGET%
echo.
copy /y "%HERE%*.py" "%TARGET%\" >nul 2>&1
copy /y "%HERE%*.html" "%TARGET%\" >nul 2>&1
copy /y "%HERE%*.txt" "%TARGET%\" >nul 2>&1
copy /y "%HERE%start_watermark.bat" "%TARGET%\" >nul 2>&1
md "%TARGET%\wheels" >nul 2>&1
copy /y "%HERE%wheels\*" "%TARGET%\wheels\" >nul 2>&1
if not exist "%TARGET%\watermark_web.py" goto cannotrelocate
if not exist "%TARGET%\start_watermark.bat" goto cannotrelocate
echo From now on you can run it straight from there:
echo    %TARGET%\start_watermark.bat
echo.
cd /d "%TARGET%"
call "%TARGET%\start_watermark.bat"
exit /b %errorlevel%

:shortpath
REM One file to send when something goes wrong. Progress still prints to the
REM window; the failure branches append the details here.
set "LOG=%HERE%watermark-log.txt"
if exist "%LOG%" del "%LOG%" >nul 2>&1

set "PYDIR=%HERE%python"
set "PYEXE=%PYDIR%\python.exe"
set "MODELS=%HERE%models"
set "TARBALL=%HERE%python-download.tar.gz"
set "PORT=5057"

REM Always the x86_64 build, even on ARM64: PyTorch publishes no win_arm64
REM wheel at all, and x64 runs fine under Windows-on-ARM emulation.
set "PYVER=cpython-3.12.13+20260728"
set "PYURL=https://github.com/astral-sh/python-build-standalone/releases/download/20260728/%PYVER%-x86_64-pc-windows-msvc-install_only.tar.gz"

echo [WM] v%WMVERSION%  batch watermark remover
echo [WM] folder %HEREN%
echo.

REM Guard: run from inside the ZIP and Explorer copies only this one file to a
REM Temp folder. The install would appear to work and then fail at the end on
REM a missing .py. This also covers the case where the cd above failed.
if not exist "%HERE%watermark_web.py" goto insidezip

REM -------------------------------------------------------------- Python ----
if exist "%PYEXE%" goto haspython

echo Step 1 of 3: downloading a private Python (about 45 MB).
echo Not installed on your PC - it lives in this folder only.
echo.
if exist "%TARBALL%" goto haveTarball

where curl.exe >nul 2>&1
if not "%errorlevel%"=="0" goto useps
curl.exe -L --fail --progress-bar -o "%TARBALL%" "%PYURL%"
if "%errorlevel%"=="0" goto extract
echo Download with curl failed, trying PowerShell ...

:useps
set "WM_URL=%PYURL%"
set "WM_OUT=%TARBALL%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12}catch{}; Invoke-WebRequest -Uri $env:WM_URL -OutFile $env:WM_OUT -UseBasicParsing"
if not "%errorlevel%"=="0" goto downloadfailed
goto extract

:haveTarball
echo Using the copy already downloaded.

:extract
if not exist "%TARBALL%" goto downloadfailed
echo Extracting ...
where tar.exe >nul 2>&1
if not "%errorlevel%"=="0" goto notar
tar -xf "%TARBALL%" -C "%HEREN%"
if not "%errorlevel%"=="0" goto extractfailed
if not exist "%PYEXE%" goto extractfailed
del "%TARBALL%" >nul 2>&1
echo Private Python ready.
echo.

:haspython
REM Confirm this is the private Python, not one from the PC. A virtualenv over
REM a system Python sits inside this folder yet still IS the system
REM interpreter, and that is the exact setup that produced the original
REM "failed to build scipy". check_private.py inspects sys.base_prefix.
"%PYEXE%" "%HERE%check_private.py" "%PYDIR%"
if not "%errorlevel%"=="0" goto notprivate
echo.

REM ---------------------------------------------------------- Components ----
"%PYEXE%" -c "import flask, cv2, easyocr, iopaint" >nul 2>&1
if "%errorlevel%"=="0" goto haspkgs

echo Step 2 of 3: installing components, about 2.5 GB.
echo First run only. This takes several minutes. The big step is written to
echo watermark-log.txt instead of the screen, so the window will look quiet -
echo that is normal. Leave it alone until it finishes.
echo.
"%PYEXE%" -m pip install --upgrade --no-warn-script-location pip setuptools wheel >>"%LOG%" 2>&1
if not "%errorlevel%"=="0" goto installfailed
"%PYEXE%" -m pip install --no-warn-script-location --no-deps iopaint==1.6.0 >>"%LOG%" 2>&1
if not "%errorlevel%"=="0" goto installfailed
REM Prebuilt and shipped in wheels\ because PyPI has no wheel for it, only a
REM source archive. omegaconf hard-pins this exact version, so installing it
REM first is what keeps the whole setup free of compiling.
"%PYEXE%" -m pip install --no-warn-script-location --no-index --find-links "%HERE%wheels" antlr4-python3-runtime==4.9.3 >>"%LOG%" 2>&1
if not "%errorlevel%"=="0" goto installfailed
"%PYEXE%" -m pip install --no-warn-script-location --only-binary=numpy,scipy,scikit-image,pillow,torch,torchvision,opencv-python-headless,python-bidi,shapely,pyclipper,ninja,tokenizers,safetensors,regex -r "%HERE%requirements-watermark.txt" >>"%LOG%" 2>&1
if not "%errorlevel%"=="0" goto installfailed
echo.
echo Components installed.

:haspkgs
REM ------------------------------------------------------------- Launch -----
REM Keep caches and weights inside this folder so that deleting the folder
REM really does remove everything.
set "EASYOCR_MODULE_PATH=%MODELS%\easyocr"
set "PIP_CACHE_DIR=%HERE%cache\pip"
set "HF_HOME=%HERE%cache\hf"
set "PYTHONNOUSERSITE=1"
set "PYTHONHOME="
set "PYTHONPATH="
echo.
echo Step 3 of 3: starting. Your browser opens by itself.
echo Keep this window open while you use it.
echo.
"%PYEXE%" "%HERE%watermark_web.py" --model-dir "%MODELS%" --port %PORT%
if not "%errorlevel%"=="0" goto runfailed
echo.
pause
exit /b 0


:cannotrelocate
echo ============================================
echo   Could not create a short working folder.
echo ============================================
echo.
echo Tried C:\wm and %%USERPROFILE%%\wm and could not create either.
echo.
echo Windows cannot install this where it currently sits, because the full
echo path would pass its 260-character limit:
echo   %HEREN%
echo.
echo Move this folder to C:\ by hand (so it becomes C:\wm) and run it again.
echo.
pause
exit /b 1

:insidezip
echo ============================================
echo   Extract the ZIP first.
echo ============================================
echo.
echo This file is not sitting next to the rest of the program, which almost
echo always means it is being run from inside the ZIP.
echo.
echo Right-click the ZIP file, choose "Extract All", then open the folder
echo that appears and run this file from there.
echo.
echo   Current folder: %HEREN%
echo.
pause
exit /b 1

:downloadfailed
echo.
echo ============================================
echo   Could not download Python.
echo ============================================
echo.
echo Tried: %PYURL%
echo.
echo Check the internet connection. A company firewall or VPN blocking
echo github.com would also do this.
echo.
echo You can also open that link in a browser, save the file into this
echo folder as  python-download.tar.gz  and run this again - it will use it.
echo.
pause
exit /b 1

:notar
echo.
echo ERROR: tar.exe not found. It is built into Windows 10 build 17063 and
echo newer. On an older Windows, extract this file with 7-Zip by hand:
echo   %TARBALL%
echo so that python\python.exe sits next to this file, then run this again.
echo.
pause
exit /b 1

:extractfailed
echo.
echo ERROR: could not extract the Python download.
echo Delete this file, then run this again to download it fresh:
echo   %TARBALL%
echo.
pause
exit /b 1

:notprivate
echo.
echo ============================================
echo   Stopping: that is not the private Python.
echo ============================================
echo.
echo Refusing to continue rather than use a Python installed on this PC,
echo which is what caused the earlier install errors.
echo.
echo Delete the "python" folder next to this file and run this again.
echo.
pause
exit /b 87

:installfailed
echo.
echo ============================================
echo   Installing components failed.
echo ============================================
echo.
echo A dropped connection is the usual cause. Running this file again
echo resumes where it stopped and is safe.
echo.
echo Writing watermark-log.txt - send that one file.
echo.
echo ==== install failed, v%WMVERSION% ==== >>"%LOG%"
"%PYEXE%" "%HERE%watermark_doctor.py" >>"%LOG%" 2>&1
type "%LOG%"
echo.
echo Saved to: %LOG%
echo.
pause
exit /b 1

:runfailed
echo.
echo ============================================
echo   It stopped with an error.
echo ============================================
echo.
echo If you stopped it yourself - closed the browser page, pressed Ctrl+C -
echo this is a false alarm: just close this window and ignore the rest.
echo.
echo Writing watermark-log.txt - send that one file only if it stopped on
echo its own.
echo.
echo ==== run failed, v%WMVERSION% ==== >>"%LOG%"
"%PYEXE%" "%HERE%watermark_doctor.py" >>"%LOG%" 2>&1
type "%LOG%"
echo.
echo Saved to: %LOG%
echo.
pause
exit /b 1
