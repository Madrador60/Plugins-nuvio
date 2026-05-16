@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js n'est pas trouve sur ce PC.
  echo Installe Node.js 18 ou plus, puis relance ce fichier.
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
echo.

start "" "http://127.0.0.1:7000/"
node site/server.js

pause
