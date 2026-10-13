#!/usr/bin/env node
/**
 * scripts/gen-command-template.js
 *
 * Regenerates src/commandTemplate.ts from commands/codotchi.md so the
 * config-hook-registered /codotchi command matches the file-based one.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const md = fs.readFileSync(path.join(root, "commands", "codotchi.md"), "utf8").replace(/\r\n/g, "\n");
const parts = md.split(/^---\n/m);
const desc = (parts[1].match(/^description:\s*(.+)$/m) || [])[1] || "";
const body = parts.slice(2).join("---\n").trimEnd();

const out = `/**
 * /codotchi slash-command definition, registered via the plugin config hook
 * so npm installs (opencode.json "plugin": [...]) get the command without
 * running bin/install.js. GENERATED from commands/codotchi.md by
 * scripts/gen-command-template.js — do not edit by hand.
 */
export const CODOTCHI_COMMAND_DESCRIPTION = ${JSON.stringify(desc.trim())};

export const CODOTCHI_COMMAND_TEMPLATE: string = ${JSON.stringify(body)};
`;
fs.writeFileSync(path.join(root, "src", "commandTemplate.ts"), out, "utf8");
