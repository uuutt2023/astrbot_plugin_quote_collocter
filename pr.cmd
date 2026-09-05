@echo off
setlocal EnableDelayedExpansion
set NODE_OPTIONS=--jitless
set NODE_TLS_REJECT_UNAUTHORIZED=0
if "%GH_TOKEN%"=="" (
  echo ERROR: Set GH_TOKEN environment variable to a GitHub PAT with repo:write.
  exit /b 1
)
cd /d "%~dp0"

echo === Step 1: ensure branch exists on fork ===
node .tmp\ghbranch.js uuutt2023 astrbot_plugin_quote_collocter feat/webui-quote-manager litsum astrbot_plugin_quote_collocter master "%GH_TOKEN%"
if errorlevel 1 (
  echo Branch create failed.
  exit /b 1
)

echo === Step 2: push commit and open PR ===
node .tmp\ghpr.js uuutt2023 astrbot_plugin_quote_collocter feat/webui-quote-manager litsum astrbot_plugin_quote_collocter master uuutt2023 584193570@qq.com uuutt2023 584193570@qq.com "%GH_TOKEN%" "feat: add WebUI for managing quote images ^& custom poke probability" .tmp\pr_body.md
echo EXIT=%ERRORLEVEL%
exit /b %ERRORLEVEL%
