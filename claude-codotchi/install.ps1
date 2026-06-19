#!/usr/bin/env pwsh
# install.ps1 — Claude Code plugin installer for codotchi
#
# Claude Code's /plugin system requires interactive commands that cannot be
# automated from a script. This script prints the exact commands to run.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginDir  = $scriptDir

Write-Host ""
Write-Host "Codotchi for Claude Code — Installation"
Write-Host "========================================"
Write-Host ""
Write-Host "Open a Claude Code session and run these two commands:"
Write-Host ""
Write-Host "  /plugin marketplace add $pluginDir"
Write-Host "  /plugin install claude-codotchi"
Write-Host ""
Write-Host "If you have installed before and are updating, use:"
Write-Host ""
Write-Host "  /plugin update claude-codotchi"
Write-Host ""
Write-Host "After installing, verify with:"
Write-Host ""
Write-Host "  /codotchi status"
Write-Host ""
Write-Host "See INSTALL.md for full installation instructions."
Write-Host ""
