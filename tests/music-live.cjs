const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{sessionStorage.setItem('raven_studio_ident_v1','1');localStorage.setItem('raven_music_cinematic_v1','off');});
  await page.goto(process.env.RAVEN_MUSIC_URL || 'http://127.0.0.1:10002/raven/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#music-track-picker option').length===13);
  await page.locator('#music-toggle').click();
  await page.waitForFunction(()=>{const a=document.getElementById('site-soundtrack');return !a.paused && a.currentTime>0.1 && a.readyState>=3;});
  console.log('Actual browser MP3 playback:',await page.locator('#site-soundtrack').evaluate(a=>({src:a.currentSrc,time:a.currentTime,ready:a.readyState,error:a.error,paused:a.paused})));
  await page.waitForFunction(()=>document.getElementById('site-recovery').hidden);
  const timeBefore = await page.evaluate(()=>{
    window.reviewMusicNode=document.getElementById('site-soundtrack');
    const time=reviewMusicNode.currentTime;
    if(!RavenSite.navigate(new URL('?lang=en#about',location.href).href))throw new Error('navigation rejected');
    return time;
  });
  await page.waitForFunction(()=>location.hash==='#about' && document.getElementById('site-content').contentDocument.documentElement.lang==='en');
  assert.equal(await page.evaluate(()=>reviewMusicNode===document.getElementById('site-soundtrack')),true);
  assert.equal(await page.locator('audio').count(),1);
  assert.ok(await page.locator('#site-soundtrack').evaluate(a=>!a.paused && a.currentTime>0));
  const timeAfter=await page.locator('#site-soundtrack').evaluate(a=>a.currentTime);
  assert.ok(timeAfter>=timeBefore);
  console.log('Actual in-app language/hash navigation preserved the same background audio and playback time:',{timeBefore,timeAfter});
  await page.locator('#music-toggle').click();
  assert.equal(await page.locator('#site-soundtrack').evaluate(a=>a.paused),true);
  console.log('Actual pause confirmed; one background audio:',await page.locator('audio').count());
  for(const width of [320,375,390]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const id of ['music-prev','music-toggle','music-next','music-settings-label']){
    const b=await page.locator('#'+id).boundingBox();assert.ok(b.x>=0 && b.x+b.width<=width,id+' overflow');
   }
   console.log('Player controls within viewport:',width);
  }
  assert.deepEqual(errors,[]);console.log('No uncaught page errors. Headless Chromium is not a listening or iPhone device test.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
