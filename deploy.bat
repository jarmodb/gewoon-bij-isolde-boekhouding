@echo off
cd /d "%~dp0"
echo Bouwen...
call npm run build
echo.
echo Deployen naar Netlify...
call npx netlify-cli deploy --prod --dir dist
echo.
pause
