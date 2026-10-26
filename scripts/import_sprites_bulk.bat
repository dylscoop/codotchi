@echo off
REM Codotchi Bulk Sprite Importer - double-click launcher
REM Runs scripts\import_sprites_bulk.ps1 via PowerShell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0import_sprites_bulk.ps1"
pause
