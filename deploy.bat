@echo off
cd /d "%~dp0"
echo Bouwen...
call npm run build
echo.
echo Deployen naar Vercel...
call npx vercel --prod
echo.
pause
