/**
 * gen_sprites.js
 * Generates the DEFS block for sprites.js.
 * Run: node scripts/gen_sprites.js > /tmp/defs.txt
 *
 * Grid conventions:
 *   Upright (classic,monkey,rooster,dragon): 32 cols x 48 rows
 *     - Head/body: rows 8-36 (adult), 12-36(teen), 16-36(child), 20-36(baby)
 *     - Legs: rows 37-47
 *     - Cols centred around 8-23
 *   Quadruped (all others except snake): 48 cols x 32 rows
 *     - Head at LEFT (cols 0-15), body cols 10-43, tail cols 38-47
 *     - Body rows 4-24 (adult), 6-24(teen), 8-24(child), 12-24(baby)
 *     - Legs: rows 25-31
 *   Snake: 48 cols x 32 rows, coiled body, no legs used by renderer
 *
 * Colours: 0=transparent, 1=primary, 2=secondary(eyes/markings), 3=accent
 */

"use strict";

// ── helpers ──────────────────────────────────────────────────────────────────

// Build a 32-char row string from a list of [start,end,colour] spans
// spans are inclusive [col, col, colour]; unlisted cols = '0'
function r32(spans) {
  var arr = new Array(32).fill('0');
  for (var s of spans) {
    for (var c = s[0]; c <= s[1]; c++) arr[c] = String(s[2]);
  }
  return arr.join('');
}
var R32 = '0'.repeat(32);

// Build a 48-char row string from spans
function r48(spans) {
  var arr = new Array(48).fill('0');
  for (var s of spans) {
    for (var c = s[0]; c <= s[1]; c++) arr[c] = String(s[2]);
  }
  return arr.join('');
}
var R48 = '0'.repeat(48);

// Emit a DEFS entry
function emit(name, stages) {
  var lines = [];
  lines.push(`  DEFS["${name}"] = {`);
  var stageNames = Object.keys(stages);
  for (var si = 0; si < stageNames.length; si++) {
    var sn = stageNames[si];
    var grid = stages[sn];
    var isLast = (si === stageNames.length - 1);
    lines.push(`    ${sn}: [`);
    for (var ri = 0; ri < grid.length; ri++) {
      var comma = (ri < grid.length - 1) ? ',' : '';
      lines.push(`      "${grid[ri]}"${comma}//${ri}`);
    }
    lines.push(`    ]${isLast ? '' : ','}`);
  }
  lines.push(`  };`);
  return lines.join('\n');
}

// ── UPRIGHT BUILDER HELPERS ──────────────────────────────────────────────────
// uprightGrid(params) → 48-row array of 32-char strings
// params: { headTop, bodyTop, earL, earR, eyeL, eyeR, noseRow, mouthRow,
//           bodyLeft, bodyRight, armRow, armL, armR,
//           pelvisTop, legGap, legLLeft, legLRight, legRLeft, legRRight,
//           footRow, footLLeft, footLRight, footRLeft, footRRight,
//           extras: [[row, spans], ...] }
// All rows not specified → R32

function uprightGrid(p) {
  var g = new Array(48).fill(null);
  for (var i = 0; i < 48; i++) g[i] = R32;

  function setRow(row, spans) { if (row >= 0 && row < 48) g[row] = r32(spans); }
  function fillRows(r1, r2, spans) { for (var r = r1; r <= r2; r++) setRow(r, spans); }
  function fillRowsBody(r1, r2, bl, br) {
    for (var r = r1; r <= r2; r++) setRow(r, [[bl,br,1]]);
  }

  var bl = p.bodyLeft, br = p.bodyRight;
  var bt = p.bodyTop;

  // ears
  if (p.earL && p.earR) {
    for (var r = p.earTop; r <= p.earBot; r++) {
      setRow(r, [[p.earL[0], p.earL[1], 1],[p.earR[0], p.earR[1], 1]]);
    }
  }

  // body fill (head+torso)
  fillRowsBody(bt, 36, bl, br);

  // eyes (row, leftEyeCol, rightEyeCol, eyeWidth=1)
  if (p.eyeRow !== undefined) {
    var ew = p.eyeWidth || 2;
    setRow(p.eyeRow, [[bl,br,1],[p.eyeL, p.eyeL+ew-1, 2],[p.eyeR, p.eyeR+ew-1, 2]]);
  }

  // mouth
  if (p.mouthRow !== undefined) {
    setRow(p.mouthRow, [[bl,br,1],[p.mouthL, p.mouthR, 2]]);
  }

  // arms
  if (p.armRow !== undefined) {
    var base = [[bl,br,1]];
    if (p.armL) base.push([p.armL[0], p.armL[1], 1]);
    if (p.armR) base.push([p.armR[0], p.armR[1], 1]);
    setRow(p.armRow, base);
    if (p.armRowEnd) {
      for (var ar = p.armRow+1; ar <= p.armRowEnd; ar++) setRow(ar, base);
    }
  }

  // extras (arbitrary overrides)
  if (p.extras) {
    for (var ex of p.extras) {
      setRow(ex[0], ex[1]);
    }
  }

  // legs: left leg cols legLL..legLR, right leg cols legRL..legRR
  // rows 37-40 = upper legs, 41=gap, 42-45=lower legs, 46-47=feet
  var ll = p.legLL, lr = p.legLR, rl = p.legRL, rr = p.legRR;
  if (ll !== undefined) {
    for (var lr2 = 37; lr2 <= 40; lr2++) setRow(lr2, [[ll,lr,1],[rl,rr,1]]);
    // gap row 41
    for (var lr3 = 42; lr3 <= 45; lr3++) setRow(lr3, [[ll,lr,1],[rl,rr,1]]);
    setRow(46, [[ll, lr+1, 1],[rl-1, rr, 1]]); // feet slightly wider
    setRow(47, [[ll, lr+1, 1],[rl-1, rr, 1]]);
  }

  return g;
}

// ── QUADRUPED BUILDER HELPERS ────────────────────────────────────────────────
// quadGrid(p) → 32-row array of 48-char strings
// Head at left (cols 0-15), body right, tail far right
// Legs rows 25-31

function quadGrid(p) {
  var g = new Array(32).fill(null);
  for (var i = 0; i < 32; i++) g[i] = R48;

  function setRow(row, spans) { if (row >= 0 && row < 32) g[row] = r48(spans); }
  function fillRows(r1, r2, spans) { for (var r = r1; r <= r2; r++) setRow(r, spans); }

  var bt = p.bodyTop !== undefined ? p.bodyTop : 4;
  var bl = p.bodyLeft !== undefined ? p.bodyLeft : 8;   // body left col
  var br = p.bodyRight !== undefined ? p.bodyRight : 38; // body right col

  // head top/bottom rows, cols
  var ht = p.headTop !== undefined ? p.headTop : bt;
  var hb = p.headBot !== undefined ? p.headBot : 20;
  var hl = p.headLeft !== undefined ? p.headLeft : 2;
  var hr = p.headRight !== undefined ? p.headRight : 14;

  // body fill
  for (var r = bt; r <= 24; r++) {
    var spans = [[bl, br, 1]];
    // include head cols on head rows
    if (r >= ht && r <= hb) spans.push([hl, Math.max(hr, bl-1), 1]);
    setRow(r, spans);
  }

  // merge head+body rows properly
  for (var r = bt; r <= 24; r++) {
    var lc = (r >= ht && r <= hb) ? Math.min(hl, bl) : bl;
    var rc = (r >= ht && r <= hb) ? Math.max(hr, br) : br;
    setRow(r, [[lc, rc, 1]]);
  }

  // eyes (2)
  if (p.eyeRow !== undefined) {
    var row = g[p.eyeRow] ? g[p.eyeRow].split('') : R48.split('');
    if (p.eyeCol !== undefined) { row[p.eyeCol] = '2'; if (p.eyeWidth > 1) row[p.eyeCol+1]='2'; }
    g[p.eyeRow] = row.join('');
  }

  // nose/snout
  if (p.snoutRow !== undefined && p.snoutLeft !== undefined) {
    var row2 = g[p.snoutRow].split('');
    for (var c = p.snoutLeft; c <= p.snoutRight; c++) row2[c] = '2';
    g[p.snoutRow] = row2.join('');
  }

  // tail: cols tailLeft..tailRight at rows tailTop..tailBot
  if (p.tailLeft !== undefined) {
    for (var r = p.tailTop; r <= p.tailBot; r++) {
      var row3 = g[r].split('');
      for (var c = p.tailLeft; c <= p.tailRight; c++) {
        if (row3[c] === '0') row3[c] = '1';
      }
      g[r] = row3.join('');
    }
  }

  // ears: left ear spans on rows earTop..earBot
  if (p.earLeft !== undefined) {
    for (var r = p.earTop; r <= p.earBot; r++) {
      var row4 = g[r].split('');
      for (var c = p.earLeft; c <= p.earRight; c++) row4[c] = '1';
      g[r] = row4.join('');
    }
  }

  // extras
  if (p.extras) {
    for (var ex of p.extras) {
      var row5 = ex[2] ? g[ex[0]].split('') : R48.split('');
      if (!ex[2]) row5 = g[ex[0]].split('');
      for (var s of ex[1]) {
        for (var c = s[0]; c <= s[1]; c++) row5[c] = String(s[2]);
      }
      g[ex[0]] = row5.join('');
    }
  }

  // legs: 4 legs at rows 25-31
  // front legs cols frontLL..frontLR, back legs cols backLL..backLR
  if (p.frontLL !== undefined) {
    var fl = p.frontLL, fr = p.frontLR;
    var bl2 = p.backLL, br2 = p.backLR;
    for (var r = 25; r <= 31; r++) {
      var row6 = g[r].split('');
      for (var c = fl; c <= fr; c++) row6[c] = '1';
      for (var c = bl2; c <= br2; c++) row6[c] = '1';
      g[r] = row6.join('');
    }
  }

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Now define all 14 animals
// ─────────────────────────────────────────────────────────────────────────────

var out = [];

// ============================================================================
// CLASSIC — round upright blob with arm stubs and big eyes
// ============================================================================
function classicStage(bt, bl, br, eyeRow, eyeL, eyeR, arms, legSize) {
  // legSize: 0=no legs, 1=small(baby/child), 2=full
  var ll = (legSize===0)?undefined : (legSize===1)?11:10;
  var lr = (legSize===0)?undefined : (legSize===1)?13:12;
  var rl = (legSize===0)?undefined : (legSize===1)?18:19;
  var rr = (legSize===0)?undefined : (legSize===1)?20:21;
  var p = {
    bodyTop: bt, bodyLeft: bl, bodyRight: br,
    eyeRow: eyeRow, eyeL: eyeL, eyeR: eyeR, eyeWidth: 2,
    legLL: ll, legLR: lr, legRL: rl, legRR: rr,
    extras: []
  };
  if (arms) {
    // arm stub rows
    for (var r = eyeRow+2; r <= eyeRow+4; r++) {
      p.extras.push([r, [[bl-2, bl-1, 1],[bl,br,1],[br+1, br+2, 1]]]);
    }
  }
  return uprightGrid(p);
}

// Build classic with manual grids for cleaner look
function classicManual(bt, bl, br, eyeRow, eyeL, eyeR, hasArms, legLL, legLR, legRL, legRR, ageSpots) {
  var g = new Array(48).fill(R32);
  // body
  for (var r = bt; r <= 36; r++) {
    var arr = new Array(32).fill('0');
    // taper top and bottom
    var indent = 0;
    if (r === bt) indent = 2;
    else if (r === bt+1) indent = 1;
    else if (r === 35) indent = 1;
    else if (r === 36) indent = 2;
    for (var c = bl+indent; c <= br-indent; c++) arr[c] = '1';
    g[r] = arr.join('');
  }
  // eyes
  if (eyeRow >= 0) {
    var arr2 = g[eyeRow].split('');
    arr2[eyeL] = '2'; arr2[eyeL+1] = '2';
    arr2[eyeR] = '2'; arr2[eyeR+1] = '2';
    g[eyeRow] = arr2.join('');
  }
  // arms
  if (hasArms) {
    for (var r2 = eyeRow+2; r2 <= eyeRow+5; r2++) {
      if (r2 < 37) {
        var arr3 = g[r2].split('');
        if (bl-2 >= 0) { arr3[bl-2]='1'; arr3[bl-1]='1'; }
        if (br+2 < 32) { arr3[br+1]='1'; arr3[br+2]='1'; }
        g[r2] = arr3.join('');
      }
    }
  }
  // age spots
  if (ageSpots) {
    [[eyeRow+4, bl+2],[eyeRow+5, br-2],[eyeRow+7, bl+4]].forEach(function(sp){
      if (sp[0] < 37) {
        var a = g[sp[0]].split('');
        a[sp[1]]='3'; if(sp[1]+1<32)a[sp[1]+1]='3';
        g[sp[0]] = a.join('');
      }
    });
  }
  // legs (rows 37-47)
  if (legLL !== undefined) {
    for (var r3 = 37; r3 <= 40; r3++) {
      var a2 = new Array(32).fill('0');
      for (var c2 = legLL; c2 <= legLR; c2++) a2[c2]='1';
      for (var c3 = legRL; c3 <= legRR; c3++) a2[c3]='1';
      g[r3] = a2.join('');
    }
    // gap row 41 empty
    for (var r4 = 42; r4 <= 45; r4++) {
      var a3 = new Array(32).fill('0');
      for (var c4 = legLL; c4 <= legLR; c4++) a3[c4]='1';
      for (var c5 = legRL; c5 <= legRR; c5++) a3[c5]='1';
      g[r4] = a3.join('');
    }
    // feet
    for (var r5 = 46; r5 <= 47; r5++) {
      var a4 = new Array(32).fill('0');
      for (var c6 = legLL-1; c6 <= legLR+1; c6++) if(c6>=0&&c6<32) a4[c6]='1';
      for (var c7 = legRL-1; c7 <= legRR+1; c7++) if(c7>=0&&c7<32) a4[c7]='1';
      g[r5] = a4.join('');
    }
  }
  return g;
}

out.push('  DEFS["classic"] = {');
out.push('    baby: [');
classicManual(22,12,19,24,13,17,false,undefined,undefined,undefined,undefined,false)
  .forEach(function(r,i){ out.push('      "'+r+'"'+(i<47?',':'')+'//' +i); });
out.push('    ],');
out.push('    child: [');
classicManual(18,11,20,20,12,17,true,undefined,undefined,undefined,undefined,false)
  .forEach(function(r,i){ out.push('      "'+r+'"'+(i<47?',':'')+'//' +i); });
out.push('    ],');
out.push('    teen: [');
classicManual(14,10,21,16,11,18,true,10,12,19,21,false)
  .forEach(function(r,i){ out.push('      "'+r+'"'+(i<47?',':'')+'//' +i); });
out.push('    ],');
out.push('    adult: [');
classicManual(10,9,22,12,10,19,true,9,11,20,22,false)
  .forEach(function(r,i){ out.push('      "'+r+'"'+(i<47?',':'')+'//' +i); });
out.push('    ],');
out.push('    senior: [');
classicManual(10,9,22,12,10,19,true,9,11,20,22,true)
  .forEach(function(r,i){ out.push('      "'+r+'"'+(i<47?',':'')+'//' +i); });
out.push('    ]');
out.push('  };');

// ============================================================================
// MONKEY — upright, round head, big ears on sides, long arms, short legs
// Primary colour body. Eyes+nostrils = 2. Ear inner = 2.
// ============================================================================
function monkeyGrid(bt, bl, br, eyeRow, hasLegs) {
  var g = new Array(48).fill(R32);
  // big round ears sticking out left and right of head
  var earTop = bt, earBot = bt+5;
  var earSize = Math.max(1, Math.round((br-bl)*0.15));
  // body
  for (var r = bt; r <= 36; r++) {
    var arr = new Array(32).fill('0');
    var indent = 0;
    if (r === bt || r === bt+1) indent = 2;
    else if (r >= 34) indent = (r-33);
    for (var c = bl+indent; c <= br-indent; c++) arr[c] = '1';
    // ears on head rows
    if (r >= earTop && r <= earBot) {
      arr[bl-3]='1'; arr[bl-2]='1';
      arr[br+2]='1'; arr[br+3]='1';
    }
    // ear inner colour
    if (r >= earTop+1 && r <= earBot-1) {
      if (bl-2 >= 0) arr[bl-2]='2';
      if (br+2 < 32) arr[br+2]='2';
    }
    g[r] = arr.join('');
  }
  // eyes
  if (eyeRow >= 0) {
    var a = g[eyeRow].split('');
    a[bl+2]='2'; a[bl+3]='2'; a[br-3]='2'; a[br-2]='2';
    g[eyeRow] = a.join('');
  }
  // nostrils (2 rows below eyes, centred)
  var mid = Math.round((bl+br)/2);
  if (eyeRow+3 < 37) {
    var a2 = g[eyeRow+3].split('');
    a2[mid-1]='2'; a2[mid+1]='2';
    g[eyeRow+3] = a2.join('');
  }
  // long arms
  for (var r2 = eyeRow+2; r2 <= eyeRow+8; r2++) {
    if (r2 < 37) {
      var a3 = g[r2].split('');
      if (bl-4>=0){a3[bl-4]='1';a3[bl-3]='1';}
      if (br+4<32){a3[br+3]='1';a3[br+4]='1';}
      g[r2] = a3.join('');
    }
  }
  // legs
  if (hasLegs) {
    var ll=10,lr=12,rl=19,rr=21;
    for (var r3=37;r3<=40;r3++){var a4=new Array(32).fill('0');for(var c2=ll;c2<=lr;c2++)a4[c2]='1';for(var c3=rl;c3<=rr;c3++)a4[c3]='1';g[r3]=a4.join('');}
    for (var r4=42;r4<=45;r4++){var a5=new Array(32).fill('0');for(var c4=ll;c4<=lr;c4++)a5[c4]='1';for(var c5=rl;c5<=rr;c5++)a5[c5]='1';g[r4]=a5.join('');}
    for (var r5=46;r5<=47;r5++){var a6=new Array(32).fill('0');for(var c6=ll-1;c6<=lr+1;c6++)if(c6>=0&&c6<32)a6[c6]='1';for(var c7=rl-1;c7<=rr+1;c7++)if(c7>=0&&c7<32)a6[c7]='1';g[r5]=a6.join('');}
  }
  return g;
}

out.push('  DEFS["monkey"] = {');
out.push('    baby: [');
monkeyGrid(22,13,18,24,false).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    child: [');
monkeyGrid(18,12,19,20,false).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    teen: [');
monkeyGrid(14,11,20,16,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    adult: [');
monkeyGrid(10,9,22,12,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    senior: [');
monkeyGrid(10,9,22,12,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ]');
out.push('  };');

// ============================================================================
// ROOSTER — upright, comb on top (colour 3), beak (2), wattle (2), wings
// ============================================================================
function roosterGrid(bt, bl, br, eyeRow, hasLegs) {
  var g = new Array(48).fill(R32);
  var mid = Math.round((bl+br)/2);
  // comb (3 spikes on top)
  if (bt >= 3) {
    var combRows = [[bt-3,mid-2,mid+2],[bt-2,mid-3,mid+3],[bt-1,mid-2,mid+2]];
    combRows.forEach(function(cr){ var a=new Array(32).fill('0'); for(var c=cr[1];c<=cr[2];c++) a[c]='3'; g[cr[0]]=a.join(''); });
  }
  // body
  for (var r=bt;r<=36;r++){
    var arr=new Array(32).fill('0');
    var ind = (r===bt||r===bt+1)?2:(r>=34?(r-33):0);
    for(var c=bl+ind;c<=br-ind;c++) arr[c]='1';
    g[r]=arr.join('');
  }
  // beak
  if (eyeRow+1 < 37) {
    var a=g[eyeRow+1].split('');
    a[mid]='2'; a[mid+1]='2';
    g[eyeRow+1]=a.join('');
  }
  // wattle below beak
  if (eyeRow+3 < 37) {
    var a2=g[eyeRow+3].split('');
    a2[mid]='2';
    g[eyeRow+3]=a2.join('');
  }
  // eye
  if (eyeRow>=0){
    var a3=g[eyeRow].split('');
    a3[bl+2]='2'; a3[br-2]='2';
    g[eyeRow]=a3.join('');
  }
  // wings (accent)
  for(var r2=eyeRow+2;r2<=eyeRow+8;r2++){
    if(r2<37){
      var a4=g[r2].split('');
      if(bl-3>=0){a4[bl-3]='3';a4[bl-2]='3';}
      if(br+3<32){a4[br+2]='3';a4[br+3]='3';}
      g[r2]=a4.join('');
    }
  }
  // tail feathers at bottom (accent)
  for(var r3=30;r3<=36;r3++){
    var a5=g[r3].split('');
    if(br+4<32){a5[br+1]='3';a5[br+2]='3';if(r3>=32){a5[br+3]='3';}}
    g[r3]=a5.join('');
  }
  // legs
  if(hasLegs){
    var ll=10,lr=12,rl=19,rr=21;
    for(var r4=37;r4<=40;r4++){var a6=new Array(32).fill('0');for(var c2=ll;c2<=lr;c2++)a6[c2]='1';for(var c3=rl;c3<=rr;c3++)a6[c3]='1';g[r4]=a6.join('');}
    for(var r5=42;r5<=45;r5++){var a7=new Array(32).fill('0');for(var c4=ll;c4<=lr;c4++)a7[c4]='1';for(var c5=rl;c5<=rr;c5++)a7[c5]='1';g[r5]=a7.join('');}
    // bird feet = 3 toes
    for(var r6=46;r6<=47;r6++){
      var a8=new Array(32).fill('0');
      a8[ll-1]='1';a8[ll]='1';a8[ll+1]='1';a8[ll+2]='1';a8[ll+3]='1';
      a8[rl-1]='1';a8[rl]='1';a8[rl+1]='1';a8[rl+2]='1';a8[rl+3]='1';
      g[r6]=a8.join('');
    }
  }
  return g;
}

out.push('  DEFS["rooster"] = {');
out.push('    baby: [');
roosterGrid(22,13,18,24,false).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    child: [');
roosterGrid(18,12,19,20,false).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    teen: [');
roosterGrid(14,11,20,16,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    adult: [');
roosterGrid(10,9,22,12,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    senior: [');
roosterGrid(10,9,22,12,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ]');
out.push('  };');

// ============================================================================
// DRAGON — upright, horns (3) on top, wings (3) on back, spiky tail (3)
// ============================================================================
function dragonGrid(bt, bl, br, eyeRow, hasLegs) {
  var g = new Array(48).fill(R32);
  var mid = Math.round((bl+br)/2);
  // horns
  if (bt >= 3) {
    [[bt-3,mid-3,mid-3],[bt-2,mid-3,mid-2],[bt-3,mid+3,mid+3],[bt-2,mid+2,mid+3]].forEach(function(sp){
      var a=g[sp[0]].split(''); for(var c=sp[1];c<=sp[2];c++)a[c]='3'; g[sp[0]]=a.join('');
    });
  }
  // body (slightly wider)
  for (var r=bt;r<=36;r++){
    var arr=new Array(32).fill('0');
    var ind=(r===bt)?1:0;
    for(var c=bl+ind;c<=br-ind;c++) arr[c]='1';
    g[r]=arr.join('');
  }
  // eyes (slit pupils = accent)
  if(eyeRow>=0){
    var a=g[eyeRow].split('');
    a[bl+2]='2';a[bl+3]='3';a[br-3]='2';a[br-2]='3';
    g[eyeRow]=a.join('');
  }
  // nostrils
  if(eyeRow+2<37){var a2=g[eyeRow+2].split('');a2[mid-1]='3';a2[mid+1]='3';g[eyeRow+2]=a2.join('');}
  // wings (rows on each side, accent)
  for(var r2=eyeRow+2;r2<=eyeRow+10;r2++){
    if(r2<37){
      var a3=g[r2].split('');
      var w=Math.min(4, r2-eyeRow);
      for(var c2=bl-w;c2<bl&&c2>=0;c2++) a3[c2]='3';
      for(var c3=br+1;c3<=br+w&&c3<32;c3++) a3[c3]='3';
      g[r2]=a3.join('');
    }
  }
  // spine/back ridges
  for(var r3=bt;r3<=36;r3+=2){
    var a4=g[r3].split('');
    if(br+1<32) a4[br+1]='3';
    g[r3]=a4.join('');
  }
  if(hasLegs){
    var ll=10,lr=12,rl=19,rr=21;
    for(var r4=37;r4<=40;r4++){var a5=new Array(32).fill('0');for(var c4=ll;c4<=lr;c4++)a5[c4]='1';for(var c5=rl;c5<=rr;c5++)a5[c5]='1';g[r4]=a5.join('');}
    for(var r5=42;r5<=45;r5++){var a6=new Array(32).fill('0');for(var c6=ll;c6<=lr;c6++)a6[c6]='1';for(var c7=rl;c7<=rr;c7++)a6[c7]='1';g[r5]=a6.join('');}
    for(var r6=46;r6<=47;r6++){var a7=new Array(32).fill('0');for(var c8=ll-1;c8<=lr+1;c8++)if(c8>=0&&c8<32)a7[c8]='1';for(var c9=rl-1;c9<=rr+1;c9++)if(c9>=0&&c9<32)a7[c9]='1';g[r6]=a7.join('');}
  }
  return g;
}

out.push('  DEFS["dragon"] = {');
out.push('    baby: [');
dragonGrid(22,13,18,24,false).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    child: [');
dragonGrid(18,12,19,20,false).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    teen: [');
dragonGrid(14,11,20,16,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    adult: [');
dragonGrid(10,9,22,12,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ],');
out.push('    senior: [');
dragonGrid(10,9,22,12,true).forEach(function(r,i){out.push('      "'+r+'"'+(i<47?',':'')+'//' +i);});
out.push('    ]');
out.push('  };');

// ============================================================================
// QUADRUPED BUILDER — shared function, parameterised per animal
// 48 cols x 32 rows. Head LEFT, tail RIGHT. Legs rows 25-31.
// ============================================================================

function quadManual(cfg) {
  // cfg: { bt, headTop, headBot, headLeft, headRight,
  //        bodyLeft, bodyRight, eyeRow, eyeCol,
  //        earTop, earBot, earLeft, earRight,  (head ears pointing UP: rows above headTop)
  //        tailTop, tailBot, tailLeft, tailRight,
  //        snoutRow, snoutLeft, snoutRight,
  //        stripes: [[col,col,colour], ...] applied to body rows,
  //        extras: [[row, [[c1,c2,colour],...]], ...]
  //        frontLL, frontLR, backLL, backLR,
  //        neckLeft, neckRight, neckTop, neckBot }
  var g = new Array(32).fill(null);
  for(var i=0;i<32;i++) g[i] = R48;

  var bt = cfg.bodyTop !== undefined ? cfg.bodyTop : 4;
  var bl = cfg.bodyLeft !== undefined ? cfg.bodyLeft : 8;
  var br = cfg.bodyRight !== undefined ? cfg.bodyRight : 38;
  var ht = cfg.headTop !== undefined ? cfg.headTop : bt;
  var hb = cfg.headBot !== undefined ? cfg.headBot : 22;
  var hl = cfg.headLeft !== undefined ? cfg.headLeft : 0;
  var hr = cfg.headRight !== undefined ? cfg.headRight : 14;

  // Fill body+head rows
  for(var r=ht;r<=24;r++){
    var rowArr = new Array(48).fill('0');
    var lc = (r<=hb) ? Math.min(hl,bl) : bl;
    var rc = (r<=hb) ? Math.max(hr,br) : br;
    // taper head top
    if(r===ht && cfg.headTaper) {lc+=2; rc=Math.min(rc,hr-1);}
    for(var c=lc;c<=rc;c++) rowArr[c]='1';
    g[r]=rowArr.join('');
  }

  // neck blending (if head right < body left, connect them)
  if(hr < bl) {
    var nr = cfg.neckTop !== undefined ? cfg.neckTop : ht;
    var nb = cfg.neckBot !== undefined ? cfg.neckBot : hb;
    for(var r2=nr;r2<=nb;r2++){
      var a=g[r2].split('');
      for(var c=hr+1;c<bl;c++) a[c]='1';
      g[r2]=a.join('');
    }
  }

  // eye
  if(cfg.eyeRow!==undefined){
    var a2=g[cfg.eyeRow].split('');
    var ec=cfg.eyeCol!==undefined?cfg.eyeCol:hl+3;
    a2[ec]='2';
    if(cfg.eyeWidth>1) a2[ec+1]='2';
    g[cfg.eyeRow]=a2.join('');
  }

  // snout
  if(cfg.snoutRow!==undefined){
    var a3=g[cfg.snoutRow].split('');
    for(var c2=cfg.snoutLeft;c2<=cfg.snoutRight;c2++) a3[c2]='2';
    g[cfg.snoutRow]=a3.join('');
  }

  // ears (rows ABOVE headTop, sticking up)
  if(cfg.earTop!==undefined){
    for(var r3=cfg.earTop;r3<=cfg.earBot;r3++){
      var a4=g[r3]?g[r3].split(''):new Array(48).fill('0');
      if(r3<ht || !g[r3] || g[r3]===R48) a4=new Array(48).fill('0');
      else a4=g[r3].split('');
      for(var c3=cfg.earLeft;c3<=cfg.earRight;c3++) a4[c3]='1';
      // inner ear
      if(cfg.earInnerLeft!==undefined){
        for(var c4=cfg.earInnerLeft;c4<=cfg.earInnerRight;c4++) a4[c4]='2';
      }
      g[r3]=a4.join('');
    }
  }

  // second ears (some animals have two pairs)
  if(cfg.ear2Top!==undefined){
    for(var r3b=cfg.ear2Top;r3b<=cfg.ear2Bot;r3b++){
      var a4b=g[r3b]?g[r3b].split(''):new Array(48).fill('0');
      for(var c3b=cfg.ear2Left;c3b<=cfg.ear2Right;c3b++) a4b[c3b]='1';
      g[r3b]=a4b.join('');
    }
  }

  // tail
  if(cfg.tailLeft!==undefined){
    for(var r4=cfg.tailTop;r4<=cfg.tailBot;r4++){
      var a5=g[r4]?g[r4].split(''):new Array(48).fill('0');
      for(var c5=cfg.tailLeft;c5<=cfg.tailRight;c5++) if(a5[c5]==='0') a5[c5]='1';
      g[r4]=a5.join('');
    }
  }

  // stripes (applied to body rows bt..24)
  if(cfg.stripes){
    for(var r5=bt;r5<=24;r5++){
      var a6=g[r5].split('');
      for(var s of cfg.stripes){
        for(var c6=s[0];c6<=s[1];c6++) if(a6[c6]==='1') a6[c6]=String(s[2]);
      }
      g[r5]=a6.join('');
    }
  }

  // extras
  if(cfg.extras){
    for(var ex of cfg.extras){
      var a7=g[ex[0]]?g[ex[0]].split(''):new Array(48).fill('0');
      for(var s2 of ex[1]) for(var c7=s2[0];c7<=s2[1];c7++) a7[c7]=String(s2[2]);
      g[ex[0]]=a7.join('');
    }
  }

  // legs
  if(cfg.frontLL!==undefined){
    var fl=cfg.frontLL, fr=cfg.frontLR, bkl=cfg.backLL, bkr=cfg.backLR;
    for(var r6=25;r6<=31;r6++){
      var a8=g[r6]?g[r6].split(''):new Array(48).fill('0');
      for(var c8=fl;c8<=fr;c8++) a8[c8]='1';
      for(var c9=bkl;c9<=bkr;c9++) a8[c9]='1';
      // second front/back pair if specified
      if(cfg.frontLL2!==undefined){ for(var ca=cfg.frontLL2;ca<=cfg.frontLR2;ca++) a8[ca]='1'; }
      if(cfg.backLL2!==undefined){ for(var cb=cfg.backLL2;cb<=cfg.backLR2;cb++) a8[cb]='1'; }
      g[r6]=a8.join('');
    }
  }

  return g;
}

// ── Scale helpers for quadruped stages ───────────────────────────────────────
// adult=full, teen=slightly smaller, child=smaller, baby=tiny
// We'll just define a scale factor per stage and compute params

function quadStage(animal, stage) {
  var scales = {baby:0.45, child:0.6, teen:0.75, adult:1.0, senior:1.0};
  var s = scales[stage];
  return makeQuad(animal, s, stage==='senior');
}

function makeQuad(animal, s, isSenior) {
  // Full-size reference dimensions per animal type:
  // All use 48x32. Body row 4..24. Front legs ~cols 10-13, back ~cols 28-31.
  // Head cols 0-13, body cols 12-40, tail cols 38-47.

  // Compute body extents by scaling from adult centre (row 14, col 24)
  var centerRow = 14, centerCol = 24;
  var halfH = Math.round(10 * s);  // body half-height
  var halfW = Math.round(14 * s);  // body half-width (not counting head/tail)
  var bt = Math.max(4, centerRow - halfH);
  var bb = Math.min(24, centerRow + halfH);
  var bl = Math.max(13, centerCol - halfW);
  var br = Math.min(38, centerCol + halfW);

  // Head dimensions
  var headW = Math.round(7*s), headH = Math.round(10*s);
  var hl = Math.max(0, bl - headW - 1);
  var hr = bl + 1;
  var ht = Math.max(bt-2, centerRow - Math.round(6*s));
  var hb = Math.min(24, centerRow + Math.round(4*s));

  var eyeRow = Math.max(ht, ht + Math.round(2*s));
  var eyeCol = Math.max(hl, hl + Math.round(2*s));
  var snoutRow = Math.min(hb, eyeRow + Math.round(3*s));
  var snoutL = hl, snoutR = Math.min(hr-1, hl+Math.round(3*s));

  // Legs
  var legW = Math.max(1, Math.round(2*s));
  var fl = bl + Math.round(2*s), fr = fl + legW;
  var bkl = br - legW - Math.round(2*s), bkr = bkl + legW;
  fl = Math.max(13, Math.min(fl, 20));
  fr = Math.min(fl+legW, 22);
  bkl = Math.max(27, Math.min(bkl, 32));
  bkr = Math.min(bkl+legW, 34);

  // Tail
  var tailTop = Math.max(bt, centerRow - Math.round(3*s));
  var tailBot = Math.min(24, centerRow + Math.round(3*s));
  var tailL = br + 1, tailR = Math.min(47, br + Math.round(5*s) + 1);

  // Ear
  var earH = Math.round(3*s);
  var earTop = Math.max(0, ht - earH);
  var earBot = ht - 1;
  var earL = hl + Math.round(2*s);
  var earR = earL + Math.max(1, Math.round(2*s));

  // Build animal-specific overrides
  var cfg = {
    bodyTop: bt, bodyLeft: bl, bodyRight: br,
    headTop: ht, headBot: hb, headLeft: hl, headRight: hr,
    eyeRow: eyeRow, eyeCol: eyeCol, eyeWidth: 2,
    snoutRow: snoutRow, snoutLeft: snoutL, snoutRight: snoutR,
    tailTop: tailTop, tailBot: tailBot, tailLeft: tailL, tailRight: tailR,
    earTop: earTop, earBot: earBot, earLeft: earL, earRight: earR,
    frontLL: fl, frontLR: fr, backLL: bkl, backLR: bkr
  };

  // Animal-specific tweaks
  applyAnimalTweaks(animal, cfg, s, isSenior,
    {bt,bl,br,ht,hb,hl,hr,eyeRow,eyeCol,snoutRow,snoutL,snoutR,
     tailTop,tailBot,tailL,tailR:tailR,earTop,earBot,earL,earR,fl,fr,bkl,bkr});

  return quadManual(cfg);
}

function applyAnimalTweaks(animal, cfg, s, isSenior, d) {
  var extras = [];
  switch(animal) {
    case 'cat':
      // pointed ears (triangular: 2 cols at earTop, wider at earBot)
      // whiskers (colour 2) on snout row
      cfg.earRight = cfg.earLeft + Math.max(1, Math.round(3*s));
      extras.push([d.snoutRow, [[Math.max(0,d.hl-2), Math.max(0,d.hl-1), 2],
                                 [d.hr+1, Math.min(47,d.hr+3), 2]]]);
      // thin curly tail (goes up)
      cfg.tailTop = Math.max(0, d.bt-2);
      cfg.tailBot = d.tailBot;
      cfg.extras = extras;
      break;
    case 'rat':
      // round small ears, long thin tail
      cfg.tailRight = Math.min(47, d.br + Math.round(8*s)+1);
      cfg.tailTop = d.centerRow ? d.centerRow : 14;
      cfg.tailBot = cfg.tailTop;
      // small rounded snout
      extras.push([d.snoutRow, [[d.hl, d.hl+1, 2]]]);
      cfg.extras = extras;
      break;
    case 'ox':
      // wide head, horns sticking up (accent)
      cfg.earTop = Math.max(0, d.ht-4);
      cfg.earBot = d.ht-1;
      cfg.earLeft = d.hl;
      cfg.earRight = d.hl+1;
      cfg.ear2Top = cfg.earTop;
      cfg.ear2Bot = cfg.earBot;
      cfg.ear2Left = d.hr-1;
      cfg.ear2Right = d.hr;
      // horns are accent
      extras.push([Math.max(0,d.ht-3), [[d.hl,d.hl,3],[d.hr,d.hr,3]]]);
      extras.push([Math.max(0,d.ht-4), [[d.hl,d.hl,3],[d.hr,d.hr,3]]]);
      // wide snout
      cfg.snoutRight = Math.min(d.hr, d.snoutL + Math.round(5*s));
      cfg.extras = extras;
      break;
    case 'tiger':
      // stripes (accent cols) on body
      var stripeCol = d.bl + Math.round(3*s);
      var sc2 = d.bl + Math.round(7*s);
      var sc3 = d.br - Math.round(3*s);
      cfg.stripes = [[stripeCol, stripeCol+1, 3]];
      if(sc2 < d.br) cfg.stripes.push([sc2, sc2+1, 3]);
      if(sc3 > stripeCol+2 && sc3 < d.br) cfg.stripes.push([sc3, sc3+1, 3]);
      cfg.extras = extras;
      break;
    case 'rabbit':
      // very tall ears
      cfg.earTop = Math.max(0, d.ht - Math.round(6*s));
      cfg.earBot = d.ht - 1;
      cfg.earLeft = d.hl + Math.round(1*s);
      cfg.earRight = cfg.earLeft + Math.max(1, Math.round(2*s));
      cfg.ear2Top = cfg.earTop;
      cfg.ear2Bot = cfg.earBot;
      cfg.ear2Left = d.hr - Math.round(2*s);
      cfg.ear2Right = cfg.ear2Left + Math.max(1, Math.round(2*s));
      // inner ear
      cfg.earInnerLeft = cfg.earLeft + 1;
      cfg.earInnerRight = cfg.earRight - 1;
      // short tail
      cfg.tailRight = Math.min(47, d.br + Math.round(2*s));
      cfg.tailTop = d.bt;
      cfg.tailBot = d.bt + Math.round(2*s);
      cfg.extras = extras;
      break;
    case 'horse':
      // mane (accent on top of neck/head rows)
      var maneRow = d.ht;
      extras.push([maneRow, [[d.hl, d.hr, 3]]]);
      if(maneRow+1 <= d.hb) extras.push([maneRow+1, [[d.hr, Math.min(47,d.hr+2), 3]]]);
      // long tail
      cfg.tailRight = Math.min(47, d.br + Math.round(7*s));
      cfg.tailTop = Math.max(d.bt, d.bt+1);
      cfg.tailBot = 24;
      cfg.extras = extras;
      break;
    case 'sheep':
      // woolly — body is fluffy, represented by accent dots
      var woolCols = [];
      for(var c=d.bl;c<=d.br;c+=3) woolCols.push([c,Math.min(c+1,d.br),3]);
      cfg.stripes = woolCols;
      // round ears to sides
      cfg.earTop = d.ht + 1;
      cfg.earBot = d.ht + 3;
      cfg.earLeft = Math.max(0,d.hl-2);
      cfg.earRight = d.hl;
      cfg.ear2Top = cfg.earTop;
      cfg.ear2Bot = cfg.earBot;
      cfg.ear2Left = d.hr;
      cfg.ear2Right = Math.min(47,d.hr+2);
      cfg.extras = extras;
      break;
    case 'dog':
      // floppy ears hanging down from head sides
      cfg.earTop = d.ht;
      cfg.earBot = Math.min(d.hb, d.ht + Math.round(5*s));
      cfg.earLeft = Math.max(0,d.hl-1);
      cfg.earRight = d.hl+1;
      cfg.ear2Top = cfg.earTop;
      cfg.ear2Bot = cfg.earBot;
      cfg.ear2Left = d.hr-1;
      cfg.ear2Right = Math.min(47,d.hr+1);
      // tongue (colour 2) on snout
      if(d.snoutRow+1 <= d.hb) extras.push([d.snoutRow+1, [[d.hl+1, d.hl+2, 2]]]);
      // wagging tail (wider)
      cfg.tailRight = Math.min(47, d.br + Math.round(5*s));
      cfg.extras = extras;
      break;
    case 'pig':
      // round pink snout, round ears on top
      cfg.snoutRight = Math.min(d.hr, d.snoutL + Math.round(4*s));
      cfg.snoutLeft = d.hl;
      // nostrils
      extras.push([d.snoutRow, [[d.hl, d.hl, 3],[Math.min(d.hr-1,d.hl+2), Math.min(d.hr-1,d.hl+2), 3]]]);
      // curly tail (just 2-3 pixels)
      cfg.tailRight = Math.min(47, d.br+2);
      cfg.tailTop = d.bt;
      cfg.tailBot = d.bt+1;
      cfg.extras = extras;
      break;
  }
}

// Helper to clamp d.centerRow (not always set)
var _centerRow = 14;

// Emit quadruped animals
var quadAnimals = ['cat','rat','ox','tiger','rabbit','horse','sheep','dog','pig'];
var stages = ['baby','child','teen','adult','senior'];

for(var qi=0;qi<quadAnimals.length;qi++){
  var an = quadAnimals[qi];
  out.push('  DEFS["'+an+'"] = {');
  for(var sti=0;sti<stages.length;sti++){
    var stn = stages[sti];
    var isLast = (sti===stages.length-1);
    var grid = quadStage(an, stn);
    out.push('    '+stn+': [');
    for(var ri=0;ri<grid.length;ri++){
      out.push('      "'+grid[ri]+'"'+(ri<31?',':'')+'//' +ri);
    }
    out.push('    ]'+(isLast?'':','));
  }
  out.push('  };');
}

// ============================================================================
// SNAKE — special: no legs used. Body = S-curve / coiled shape.
// 48 cols x 32 rows. Head at col ~4, body winds across grid.
// Scale up through stages (baby = small coil, adult = full S-curve)
// ============================================================================
function snakeGrid(s) {
  var g = new Array(32).fill(R48);

  // Helper
  function fillRow(r, l, right, col) {
    if(r<0||r>=32) return;
    var a = g[r].split('');
    for(var c=l;c<=right;c++) if(c>=0&&c<48) a[c]=String(col||1);
    g[r]=a.join('');
  }

  // Snake is drawn as an S-curve:
  // Row range for body depends on scale s (0.4 to 1.0)
  var bh = Math.round(6*s);   // body half-height
  var bw = Math.round(8*s);   // body segment half-width
  var thick = Math.max(1, Math.round(3*s));

  // Top horizontal segment: row range [4, 4+thick], cols [4, 4+bw*2]
  var t1 = Math.round(4 + (1-s)*8);
  var t2 = t1 + thick;
  var hLeft = Math.max(2, Math.round(4 + (1-s)*4));
  var hRight = Math.min(44, hLeft + Math.round(bw*2*s)+4);
  for(var r=t1;r<=t2;r++) fillRow(r, hLeft, hRight, 1);

  // Right vertical segment
  var v1 = t2;
  var v2 = Math.min(28, t2 + Math.round(bh*2*s));
  var vl = hRight - thick;
  for(var r=v1;r<=v2;r++) fillRow(r, vl, hRight, 1);

  // Bottom horizontal segment
  var b1 = v2 - thick;
  var b2 = v2;
  var bLeft2 = hLeft;
  for(var r=b1;r<=b2;r++) fillRow(r, bLeft2, hRight, 1);

  // Left vertical going back up (partial)
  var v3 = Math.max(t1, v2 - Math.round(bh*s));
  for(var r=v3;r<=b1;r++) fillRow(r, hLeft, hLeft+thick, 1);

  // Head: slightly wider at the start of top segment
  for(var r=t1-1;r<=t1+thick;r++){
    fillRow(r, hLeft-1, hLeft+thick+1, 1);
  }
  // eye
  fillRow(t1, hLeft+1, hLeft+1, 2);
  // tongue
  fillRow(t1+1, hLeft-2, hLeft-1, 3);

  return g;
}

out.push('  DEFS["snake"] = {');
var snakeScales = {baby:0.4, child:0.55, teen:0.7, adult:1.0, senior:1.0};
var snakeStages = Object.keys(snakeScales);
for(var si2=0;si2<snakeStages.length;si2++){
  var stn2=snakeStages[si2];
  var isLast2=(si2===snakeStages.length-1);
  var grid2=snakeGrid(snakeScales[stn2]);
  out.push('    '+stn2+': [');
  for(var ri2=0;ri2<grid2.length;ri2++){
    out.push('      "'+grid2[ri2]+'"'+(ri2<31?',':'')+'//' +ri2);
  }
  out.push('    ]'+(isLast2?'':','));
}
out.push('  };');

// Validate all rows
var errors = 0;
var uprightTypes = {classic:1,monkey:1,rooster:1,dragon:1};
out.forEach(function(line){
  var m = line.match(/^\s+"([01230-9]+)"[,]?\/\/\d+$/);
  if(!m) return;
  var row = m[1];
  // We can't easily tell which sprite we're in from just the line, skip deep validation
});

process.stdout.write(out.join('\n') + '\n');
