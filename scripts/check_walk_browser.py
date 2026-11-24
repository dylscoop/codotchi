"""Real-Chromium walking regression, using the same media packaged by both IDEs.

Run after `npm test` in vscode/:
  uv run --with playwright --with pillow python scripts/check_walk_browser.py --output <directory>
Uses an existing Playwright Chromium installation; never reads/writes real pets.
"""

import argparse
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import subprocess
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "vscode" / "media"


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        if self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        elif self.path == "/fixture":
            html = (MEDIA / "sidebar.html").read_text(encoding="utf-8-sig")
            values = {
                "cspSource": "'self'", "cssUri": "/sidebar.css", "jsUri": "/sidebar.js",
                "spriteConstantsUri": "/spriteConstants.js", "spritesGeneratedUri": "/sprites.generated.js",
                "spritesUri": "/sprites.js", "minigameArtUri": "/minigameArt.js",
                "bossArtUri": "/bossArt.js", "backgroundArtUri": "/backgroundArt.js",
                "customCharactersUri": "/customCharacters.js", "stageHeight": "240",
                "petSize": "medium", "reducedMotion": "false", "backgroundStyle": "legacy",
                "backgroundAnimations": "false", "backgroundOpacity": "0",
            }
            html = re.sub(r"\{\{(\w+)\}\}", lambda m: values.get(m[1], ""), html)
            html = html.replace('<script src="/sidebar.js">', '<script src="/probe.js"></script><script src="/sidebar.js">')
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode())
        elif self.path == "/probe.js":
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.end_headers()
            self.wfile.write(b"""
              window.__walkCalls = [];
              const draw = window.renderSpriteGrid;
              window.renderSpriteGrid = function(ctx, state, x, y, facing, frame) {
                if (ctx.canvas.id === 'sprite-canvas') {
                  window.__walkCalls.push({type:state.spriteType, stage:state.stage, x, y, facing, frame});
                  if (window.__walkCalls.length > 600) window.__walkCalls.shift();
                }
                return draw.apply(this, arguments);
              };
            """)
        elif self.path == "/rig":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"""<!doctype html><body data-pet-size="medium" style="background:#202020;color:white;font:12px monospace">
              <script src="/spriteConstants.js"></script><script src="/sprites.generated.js"></script><script src="/sprites.js"></script>
            """)
        else:
            super().do_GET()


def run(output, chromium=None):
    output.mkdir(parents=True, exist_ok=True)
    # A synthetic engine pet, not a user's persisted or installed state.
    fixture = json.loads(subprocess.check_output([
        "node", "-e", "const e=require('./vscode/out-test/src/gameEngine.js');"
        "console.log(JSON.stringify({...e.createPet('Gait test','codeling'),stage:'adult',"
        "spriteType:'dog',energy:80,hunger:80,happiness:60,weight:50,sleeping:false,alive:true}));",
    ], cwd=ROOT, text=True))
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(MEDIA)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"
    results = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(**({"executable_path": str(chromium)} if chromium else {}))
            page = browser.new_page(viewport={"width": 420, "height": 900}, device_scale_factor=1)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.add_init_script("window.acquireVsCodeApi=()=>({postMessage(){},getState(){return null},setState(){}});Math.random=()=>0.6;")
            # Run the REAL sidebar loop and message handler, not an extracted snippet.
            for kind, stage in [("dog", "adult"), ("dog", "child"), ("cat", "child"), ("cat", "senior"), ("sheep", "baby")]:
                page.goto(base + "/fixture")
                page.clock.install()
                state = {**fixture, "spriteType": kind, "stage": stage}
                page.evaluate("state=>window.dispatchEvent(new MessageEvent('message',{data:{type:'stateUpdate',state}}))", state)
                # The senior cat intentionally lounges for 20-40s before a stroll.
                page.clock.run_for(38000 if kind == "cat" and stage == "senior" else 8000)
                calls = page.evaluate("window.__walkCalls")
                moving = [c for c in calls if isinstance(c["frame"], dict)]
                poses = {c["frame"]["walk"] for c in moving}
                assert len(poses) >= 6, (kind, stage, "sidebar did not activate a full stride", poses)
                assert max(c["x"] for c in moving) - min(c["x"] for c in moving) > 4
                page.locator("#sprite-canvas").screenshot(path=str(output / f"sidebar-{kind}-{stage}.png"))
                state["sleeping"] = True
                page.evaluate("state=>{window.__walkCalls=[];window.dispatchEvent(new MessageEvent('message',{data:{type:'stateUpdate',state}}))}", state)
                page.clock.run_for(3000)
                assert not page.evaluate("window.__walkCalls.some(c=>c.frame&&typeof c.frame==='object')"), "sleep must stop gait"
                sleeping = page.evaluate("window.__walkCalls.map(c=>c.x)")
                assert sleeping and max(sleeping) - min(sleeping) < 0.001, "eased velocity must not drift into sleep"
                results.append({"type": kind, "stage": stage, "sidebarPoses": len(poses)})
                page.clock.resume()

            # Measure FINAL DISPLAY pixels in a real browser, not source-grid rectangles.
            rig = browser.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
            rig.on("pageerror", lambda e: errors.append(str(e)))
            rig.goto(base + "/rig")
            pixels = rig.evaluate("""() => {
              const results=[];
              for (const size of ['small','medium','large']) {
                document.body.dataset.petSize=size;
                for (const type of ['dog','cat','sheep']) for (const stage of ['baby','child','teen','adult','senior'])
                for (const trot of [false,true]) for (const facing of [true,false]) {
                  const row=document.createElement('div');row.style.display='flex';
                  const label=document.createElement('div');label.textContent=`${size} ${type}/${stage}`;row.append(label);
                  const images=[];
                  const neutral=document.createElement('canvas');neutral.width=230;neutral.height=200;
                  const neutralCtx=neutral.getContext('2d');
                  const state={spriteType:type,stage,weight:50,alive:true,mood:'neutral'};
                  const paint=(ctx,frame)=>window.renderSpriteGrid(ctx,state,20,20,facing,frame,0,
                    window.SPRITE_STAGE_SCALES,window.spriteWeightWidthMult,window.spriteGetPalette,window.spriteHeightRatio,window.spriteQuadBellySag);
                  const bounds=data=>{
                    let top=200,bottom=0;
                    for(let y=0;y<200;y++)for(let x=0;x<230;x++)if(data[(y*230+x)*4+3]){top=Math.min(top,y);bottom=Math.max(bottom,y);}
                    return {top,bottom};
                  };
                  paint(neutralCtx,-1);
                  const standing=bounds(neutralCtx.getImageData(0,0,230,200).data);
                  const bodyOffsets=[];
                  for(let frame=0;frame<8;frame++) {
                    // Integrate mapped timing with rounded source-pixel offsets,
                    // not just a source-code assertion about diagonal phases.
                    const legs=window.spriteWalk.rig(type,stage), rows=window.SPRITE_GRID_META[type].rows;
                    for(let i=0;i<legs.length;i++) {
                      const leg=legs[i], pose=window.spriteWalk.pose({walk:frame,trot},i,legs,rows);
                      const foot=window.spriteWalk.pixelOffset(pose,pose.foot,pose.root,rows);
                      const group=legs.length===2||['front-far','hind-near'].includes(leg[6])?0:0.5;
                      const phase=(frame/8+group)%1;
                      if((foot.y<0)!==(phase>0&&phase<0.5))throw Error(`Unpaired foot ${type}/${stage}/${leg[6]}`);
                      if(Math.abs(foot.x)>(rows===32?1:3)||-foot.y>(rows===32?1:2))throw Error('Exaggerated step');
                      if(foot.bodyWeight!==0)throw Error('Body dip moves planted paw');
                    }
                    const canvas=document.createElement('canvas');canvas.width=230;canvas.height=200;
                    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
                    paint(ctx,{walk:frame,trot});
                    const image=ctx.getImageData(0,0,canvas.width,canvas.height).data;
                    const box=bounds(image),bodyOffset=box.top-standing.top;
                    if(bodyOffset<0||bodyOffset>1)throw Error(`Exaggerated body dip ${type}/${stage}/${size}: ${bodyOffset}`);
                    if(box.bottom>standing.bottom)throw Error(`Paw below source floor ${type}/${stage}/${size}`);
                    bodyOffsets.push(bodyOffset);images.push(image);
                    canvas.style.flexShrink='0';row.append(canvas);
                  }
                  const unique=new Set(images.map(a=>Array.from(a).join(','))).size;
                  let changed=0;
                  for(let p=0;p<images[0].length;p+=4) if(images.some(a=>a[p]!==images[0][p]||a[p+1]!==images[0][p+1]||a[p+2]!==images[0][p+2]||a[p+3]!==images[0][p+3]))changed++;
                  results.push({size,type,stage,trot,facing,unique,changed,bodyOffsets});
                  // Contact sheet at the actual medium preset, no enlargement.
                  if(size==='medium' && !trot && facing)document.body.append(row);
                }
              }
              return results;
            }""")
            for row in pixels:
                # Short paired legs can quantise to two displayed positions at
                # the smallest preset. Do not inflate travel to force four
                # unique images: that recreates the rejected exaggerated gait.
                assert row["unique"] >= 2, ("static displayed paws", row)
                assert row["changed"] >= 1, ("no screen-pixel movement", row)
            assert any(max(row["bodyOffsets"]) == 1 for row in pixels), "body weight shift never reaches display"
            rig.screenshot(path=str(output / "walk-contact-sheet.png"), full_page=True)
            # Continuous normal-size motion for visual review (all stages, both
            # directions). Browser clock advances real requestAnimationFrame;
            # sprite phase comes from travelled distance, as in the main sidebar.
            motion = browser.new_page(viewport={"width": 1380, "height": 1000}, device_scale_factor=1)
            motion.on("pageerror", lambda e: errors.append(str(e)))
            motion.clock.install()
            motion.goto(base + "/rig")
            motion.evaluate("""() => {
              document.body.style.margin='0';document.body.style.display='grid';
              document.body.style.gridTemplateColumns='repeat(6,230px)';
              const pets=[];
              for(const stage of ['baby','child','teen','adult','senior'])
              for(const type of ['dog','cat','sheep'])for(const facing of [true,false]) {
                const cell=document.createElement('div');cell.style.height='200px';
                cell.textContent=`${type}/${stage} ${facing?'left':'right'}`;
                const canvas=document.createElement('canvas');canvas.width=230;canvas.height=180;
                cell.append(canvas);document.body.append(cell);
                pets.push({type,stage,facing,ctx:canvas.getContext('2d'),phase:0,velocity:0});
              }
              window.__motionTarget=20;
              let previous=performance.now();
              function draw(now) {
                const dt=Math.min(100,now-previous)/1000;previous=now;
                for(const p of pets) {
                  const width=96*window.spritePetSizeMult(p.type,'medium',p.stage)*window.SPRITE_STAGE_SCALES[p.stage];
                  const step=window.spriteWalk.ease(p.velocity,window.__motionTarget,dt,20);
                  p.velocity=step.velocity;
                  p.phase=window.spriteWalk.advance(p.phase,step.distance,width,false);
                  p.ctx.clearRect(0,0,230,180);
                  window.renderSpriteGrid(p.ctx,{spriteType:p.type,stage:p.stage,weight:50,alive:true,mood:'neutral'},
                    50,10,p.facing,window.spriteWalk.frame(p.type,p.phase,false,p.velocity>0.5),0,
                    window.SPRITE_STAGE_SCALES,window.spriteWeightWidthMult,window.spriteGetPalette,window.spriteHeightRatio,window.spriteQuadBellySag);
                }
                requestAnimationFrame(draw);
              }
              requestAnimationFrame(draw);
            }""")
            frames = []
            for index in range(32):
                if index == 20:
                    motion.evaluate("window.__motionTarget=0")
                elif index == 26:
                    motion.evaluate("window.__motionTarget=20")
                motion.clock.run_for(80)
                filename = output / f"motion-{index:02}.png"
                motion.screenshot(path=str(filename))
                with Image.open(filename) as image:
                    frames.append(image.convert("RGB"))
            frames[0].save(output / "paired-walk-motion.gif", save_all=True, append_images=frames[1:], duration=80, loop=0)
            # Sprite Preview must drive the new gait as well, not numeric legacy frames.
            preview = browser.new_page()
            preview.on("pageerror", lambda e: errors.append(str(e)))
            preview.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            preview.add_init_script("""let draw; window.__frames=[];
              Object.defineProperty(window,'renderSpriteGrid',{
                get(){return draw},set(fn){draw=function(ctx,state,x,y,facing,frame){
                  if(state.spriteType==='dog'&&state.stage==='adult')window.__frames.push(frame);
                  return fn.apply(this,arguments);
                }}
              });""")
            preview.clock.install()
            preview.goto(base + "/sprite_preview.html")
            preview.select_option("#animate-select", "yes")
            preview.clock.run_for(3000)
            preview_poses = preview.evaluate("Array.from(new Set(window.__frames.filter(f=>f&&typeof f==='object').map(f=>f.walk)))")
            assert len(preview_poses) >= 6, ("preview did not use the walking rig", preview_poses, errors)
            assert not errors, errors
            report = {"sidebar": results, "screenPixels": pixels, "errors": errors,
                       "motionPreview": "paired-walk-motion.gif",
                       "scope": "Chromium harness of shared IDE media, not a live IDE UI test"}
            (output / "results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
            print(json.dumps({"sidebarCases": len(results), "displayCases": len(pixels), "consoleErrors": len(errors), "output": str(output)}))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chromium", type=Path, help="Use an existing Chromium executable")
    args = parser.parse_args()
    run(args.output, args.chromium)
