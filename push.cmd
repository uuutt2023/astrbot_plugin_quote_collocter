@echo off
setlocal
set NODE_OPTIONS=--jitless
set NODE_TLS_REJECT_UNAUTHORIZED=0
set MSG=feat(quote_collocter): add React WebUI (v1.6) for managing submitted meme images
if "%GH_TOKEN%"=="" (
  echo ERROR: Set GH_TOKEN environment variable to a GitHub PAT with repo:write.
  exit /b 1
)
cd /d "%~dp0"
node .tmp\ghpush.js uuutt2023 astrbot_plugin_quote_collocter master "" uuutt2023 584193570@qq.com uuutt2023 584193570@qq.com "%GH_TOKEN%" "%MSG%"
echo EXIT=%ERRORLEVEL%
