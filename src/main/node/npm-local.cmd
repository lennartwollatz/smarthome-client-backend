@echo off
setlocal
set "NODE_HOME=%LOCALAPPDATA%\nvm\v20.19.0"
if not exist "%NODE_HOME%\node.exe" (
  echo [npm-local] Node 20.19.0 nicht gefunden: %NODE_HOME%
  echo Installiere Node 20.19.0 mit nvm oder passe NODE_HOME in dieser Datei an.
  exit /b 1
)
set "PATH=%NODE_HOME%;%PATH%"
cd /d "%~dp0"
"%NODE_HOME%\npm.cmd" %*
