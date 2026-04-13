"use strict";
var child_process = require('child_process');
var lines = child_process.execSync('node scripts/gen_sprites.js', {cwd: __dirname + '/..'}).toString().split('\n');
var uprightTypes = {classic:1,monkey:1,rooster:1,dragon:1};
var currentType = null;
var errors = [];
lines.forEach(function(line,i){
  var tm = line.match(/DEFS\["(\w+)"\]/);
  if(tm) currentType = tm[1];
  var m = line.match(/^\s+"([0-9]+)"[,]?\/\/(\d+)$/);
  if(!m) return;
  var row = m[1]; var rowNum = parseInt(m[2]);
  var expected = (currentType && uprightTypes[currentType]) ? 32 : 48;
  if(row.length !== expected) {
    errors.push('Line '+(i+1)+' type='+currentType+' row='+rowNum+' len='+row.length+' expected='+expected);
  }
});
if(errors.length===0) console.log('ALL ROWS VALID (' + lines.length + ' lines)');
else { errors.forEach(function(e){console.log(e);}); process.exit(1); }
