const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
// Reuse the production player's exact DOM; isolate routing/intro while testing media races.
const fixture=fs.readFileSync(path.join(root,'raven/index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
test('production soundtrack module with production controls',async t=>{
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://test').pathname;
    if(pathname==='/fixture'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
    if(pathname==='/site-audio.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(process.env.RAVEN_AUDIO_SOURCE || path.join(root,'site-audio.js')));return;}
    res.writeHead(404);res.end();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
  async function check(fn){
    const page=await browser.newPage();
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
      await page.evaluate(async()=>{
        const a=document.getElementById('site-soundtrack');
        window.audioState={paused:true,error:null,ended:false,readyState:4};
        for(const prop of Object.keys(window.audioState))Object.defineProperty(a,prop,{get:()=>window.audioState[prop],configurable:true});
        Object.defineProperty(a,'currentSrc',{get:()=>a.src,configurable:true});
        window.plays=[];
        a.load=()=>{};
        a.play=()=>{window.audioState.paused=false;return new Promise((resolve,reject)=>window.plays.push({resolve,reject}));};
        a.pause=()=>{window.audioState.paused=true;};
        localStorage.setItem('raven_music_cinematic_v1','off');
        const {createSoundtrack}=await import('/site-audio.js');
        window.manager=createSoundtrack(new URL('/',location.href));
        window.factory=createSoundtrack;
      });
      await fn(page);
    } finally{await page.close();}
  }
  const click=async(p,id)=>p.locator('#'+id).click();
  const phase=async p=>p.evaluate(()=>manager.state().phase);
  await t.test('late error/ended/pause events after stop leave player paused',()=>check(async p=>{
    await click(p,'music-toggle');await click(p,'music-toggle');
    await p.evaluate(()=>{
      const a=document.getElementById('site-soundtrack');
      a.dispatchEvent(new Event('error'));
    });
    assert.equal(await phase(p),'paused');
    await p.evaluate(()=>{
      const a=document.getElementById('site-soundtrack');
      a.dispatchEvent(new Event('waiting'));a.dispatchEvent(new Event('playing'));
    });
    assert.equal(await phase(p),'paused');
  }));
  await t.test('queued pause/error/ended from previous source do not override new selection',()=>check(async p=>{
    await click(p,'music-toggle');await click(p,'music-next');
    await p.evaluate(()=>{const a=document.getElementById('site-soundtrack');for(const e of ['pause','error','ended'])a.dispatchEvent(new Event(e));});
    assert.equal(await p.locator('#music-track-number').innerText(),'2 من 13');
    assert.equal(await p.evaluate(()=>manager.state().enabled),true);
    assert.equal(await phase(p),'starting');
  }));
  await t.test('old play promise cannot override selection; pause and mute during pending play persist',()=>check(async p=>{
    await click(p,'music-toggle');await click(p,'music-next');
    await p.evaluate(()=>plays[0].resolve());assert.equal(await phase(p),'starting');
    await click(p,'music-settings-label');await click(p,'music-mute');
    await click(p,'music-toggle');await p.evaluate(()=>plays[1].resolve());
    assert.equal(await phase(p),'paused');
    assert.equal(await p.evaluate(()=>document.getElementById('site-soundtrack').muted),true);
    assert.equal(await p.evaluate(()=>document.getElementById('site-soundtrack').paused),true);
  }));
  await t.test('stale rejection ignored; waiting/stalled do not advance; actual ended wraps last to first',()=>check(async p=>{
    await click(p,'music-toggle');await click(p,'music-next');
    await p.evaluate(()=>plays[0].reject(new Error('old')));
    assert.equal(await phase(p),'starting');
    await p.evaluate(()=>{audioState.readyState=1;const a=document.getElementById('site-soundtrack');a.dispatchEvent(new Event('waiting'));a.dispatchEvent(new Event('stalled'));});
    assert.equal(await phase(p),'waiting');assert.equal(await p.locator('#music-track-number').innerText(),'2 من 13');
    await click(p,'music-settings-label');await p.locator('#music-track-picker').selectOption('12');
    await p.evaluate(()=>{audioState.ended=true;document.getElementById('site-soundtrack').dispatchEvent(new Event('ended'));audioState.ended=false;});
    assert.equal(await p.locator('#music-track-number').innerText(),'1 من 13');
  }));
  await t.test('natural end while foreground media is active advances silently, then resumes next track',()=>check(async p=>{
    await click(p,'music-toggle');
    await p.evaluate(()=>{
      audioState.ended=true;
      manager.setMediaActive(true);
      document.getElementById('site-soundtrack').dispatchEvent(new Event('ended'));
      audioState.ended=false;
    });
    assert.equal(await phase(p),'suspended');
    assert.equal(await p.locator('#music-track-number').innerText(),'2 من 13');
    assert.equal(await p.evaluate(()=>plays.length),1);
    assert.equal(await p.evaluate(()=>document.getElementById('site-soundtrack').paused),true);
    await p.evaluate(()=>manager.setMediaActive(false));
    assert.equal(await p.evaluate(()=>plays.length),2);
    assert.match(await p.locator('#site-soundtrack').getAttribute('src'),/02\.mp3$/);
    await p.evaluate(()=>plays[1].resolve());
    assert.equal(await phase(p),'playing');
  }));
  await t.test('last track wraps silently during suspension; explicit stop prevents resume',()=>check(async p=>{
    await click(p,'music-settings-label');await p.locator('#music-track-picker').selectOption('12');
    await click(p,'music-toggle');
    await p.evaluate(()=>{
      audioState.ended=true;manager.setMediaActive(true);
      document.getElementById('site-soundtrack').dispatchEvent(new Event('ended'));
      audioState.ended=false;
    });
    assert.equal(await p.locator('#music-track-number').innerText(),'1 من 13');
    assert.equal(await p.evaluate(()=>plays.length),1);
    await click(p,'music-toggle');
    await p.evaluate(()=>{manager.setMediaActive(false);plays[0].resolve();});
    assert.equal(await phase(p),'paused');
    assert.equal(await p.evaluate(()=>plays.length),1);
    assert.equal(await p.evaluate(()=>document.getElementById('site-soundtrack').paused),true);
  }));
  await t.test('late pause with network error preserves explicit stop; active failure remains error',()=>check(async p=>{
    await click(p,'music-toggle');await click(p,'music-toggle');
    await p.evaluate(()=>{
      audioState.error={code:2};
      document.getElementById('site-soundtrack').dispatchEvent(new Event('pause'));
    });
    assert.equal(await phase(p),'paused');
    await p.evaluate(()=>audioState.error=null);
    await click(p,'music-toggle');
    await p.evaluate(()=>{
      audioState.error={code:2};audioState.paused=true;
      const a=document.getElementById('site-soundtrack');
      a.dispatchEvent(new Event('error'));a.dispatchEvent(new Event('pause'));
    });
    assert.equal(await phase(p),'error');
  }));
  await t.test('singleton, one background audio, repeat factory preserves preferences',()=>check(async p=>{
    assert.equal(await p.locator('audio').count(),1);
    assert.equal(await p.locator('#music-track-picker option').count(),13);
    assert.equal(await p.evaluate(()=>factory(new URL('/',location.href))===manager),true);
    assert.equal(await p.evaluate(()=>localStorage.getItem('raven_music_cinematic_v1')),'off');
    await click(p,'music-next');assert.equal(await p.evaluate(()=>document.getElementById('site-soundtrack').paused),true);
  }));
});
