@echo off
setlocal
cd /d "%~dp0"
set NODE_OPTIONS=--jitless
set NODE_TLS_REJECT_UNAUTHORIZED=0
node build.cjs
echo EXIT=%ERRORLEVEL%
