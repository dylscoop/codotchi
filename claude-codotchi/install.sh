#!/usr/bin/env bash
# install.sh — Claude Code plugin installer for codotchi
#
# Claude Code's /plugin system requires interactive commands that cannot be
# automated from a script. This script prints the exact commands to run.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$SCRIPT_DIR"

echo ""
echo "Codotchi for Claude Code — Installation"
echo "========================================"
echo ""
echo "Open a Claude Code session and run these two commands:"
echo ""
echo "  /plugin marketplace add $PLUGIN_DIR"
echo "  /plugin install claude-codotchi"
echo ""
echo "If you have installed before and are updating, use:"
echo ""
echo "  /plugin update claude-codotchi"
echo ""
echo "After installing, verify with:"
echo ""
echo "  /codotchi status"
echo ""
echo "See INSTALL.md for full installation instructions."
echo ""
