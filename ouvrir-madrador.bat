@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="

where node >nul 2>nul
if not errorlevel 1 (
  set "NODE_EXE=node"
)

if "%NODE_EXE%"=="" if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)

if "%NODE_EXE%"=="" if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
  set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
)

if "%NODE_EXE%"=="" if exist "C:\Program Files\nodejs\node.exe" (
  set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

if "%NODE_EXE%"=="" (
  echo.
  echo Node.js n'est pas trouve sur ce PC, ni dans le runtime Codex.
  echo Solution 1 : ouvre le site en ligne Render.
  echo Solution 2 : installe Node.js 18 ou plus, puis relance ce fichier.
  echo.
  echo Adresse Render en ligne :
  echo https://madrador60-stremio-addon.onrender.com/
  echo.
  pause
  exit /b 1
)

echo.
echo Demarrage de Madrador Film...
echo Le site va s'ouvrir sur http://127.0.0.1:7000/
echo Garde cette fenetre ouverte tant que tu utilises le site.
echo Node utilise : %NODE_EXE%
echo.

start "" "http://127.0.0.1:7000/"
"%NODE_EXE%" site/server.js

pause
