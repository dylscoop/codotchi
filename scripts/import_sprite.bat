@echo off
REM Codotchi Sprite Importer - double-click launcher
REM Runs scripts\import_sprite.ps1 via PowerShell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0import_sprite.ps1"
pause
