@echo off
REM Codotchi bulk sprite import - double-click launcher
REM Rebuilds vscode\media\sprites.generated.js from sprites\<species>\
cd /d "%~dp0.."
node scripts\import_sprites_bulk.js
if errorlevel 1 (echo. & echo Import failed.) else (node scripts\validate_sprites.js)
pause
