// Optional browser checks: npm install --no-save --package-lock=false playwright
// CHROMIUM_PATH=/usr/bin/chromium node --test tests/browser.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('real preview page browser acceptance', async t => {
  const { createPreviewServer } = await import('../src/server.js');
  const server = createPreviewServer();
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const root = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox']});
  t.after(async () => { await browser.close(); await new Promise(r=>server.close(r)); });
  async function pageFor(fn) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = []; page.on('pageerror',e=>errors.push(e.message));
    try { await fn(page,context); assert.deepEqual(errors,[]); }
    finally { await context.close(); }
  }
  const wait = async page => { await page.locator('#status').filter({hasText:'دُمج'}).waitFor(); };
  const send = async (page,text='سؤالي') => { await page.locator('#input').fill(text); await page.locator('#send').click(); };
  const result = data => ({status:200,contentType:'application/json',body:JSON.stringify(data)});
  const record = (op,extra={}) => ({...op,id:op.requestId,status:'completed',storage:'server-memory',response:{text:'رد معروف'},...extra});

  await t.test('1 initialization preserves unrelated storage and music preferences; 2 normal path and safe text',()=>pageFor(async page=>{
    await page.addInitScript(()=>{localStorage.setItem('other_app_preferences','keep');localStorage.setItem('raven_music_volume_v1','0.37');});
    await page.goto(root); await wait(page);
    await send(page,'<img src=x onerror="window.injected=true">');
    await page.locator('#status').filter({hasText:'تأكد تسجيل'}).waitFor();
    assert.equal(await page.locator('#log .me').count(),1);
    assert.equal(await page.locator('#log img').count(),0);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('other_app_preferences'),localStorage.getItem('raven_music_volume_v1')]),['keep','0.37']);
    await page.locator('#history').click(); await wait(page);
    assert.equal(await page.locator('#log .me').count(),1);
    await page.locator('#character').selectOption('claire'); await wait(page);
    assert.equal(await page.locator('#log .me').count(),0);
  }));
  await t.test('unreadable owned journal is preserved verbatim',()=>pageFor(async page=>{
    await page.addInitScript(()=>localStorage.setItem('raven_deleted_name_preview_v2','{unreadable'));
    await page.goto(root);await wait(page);await send(page);
    await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('raven_deleted_name_preview_v2')),'{unreadable');
    assert.match(await page.locator('#status').innerText(),/الحفظ المحلي غير مؤكد/);
  }));
  await t.test('prior preview journal with refused metadata restores its response and draft',()=>pageFor(async page=>{
    await page.addInitScript(()=>localStorage.setItem('raven_deleted_name_preview_v2',JSON.stringify({jonas:{draft:'مسودة محفوظة',records:[{id:'prior',characterId:'jonas',message:'سؤال سابق',status:'completed',response:{text:'رد سابق',refused:true},confirmed:true}]}})));
    await page.goto(root);await wait(page);
    assert.match(await page.locator('#log').innerText(),/رد سابق/);
    assert.equal(await page.locator('#input').inputValue(),'مسودة محفوظة');
    assert.doesNotMatch(await page.locator('#status').innerText(),/غير متوافقة/);
  }));
  await t.test('valid JSON with incompatible fields or records is never overwritten on initialization',async()=>{
    for (const raw of ['[]','{"future":1}','{"jonas":{"draft":"keep","records":{}}}',
      '{"jonas":{"draft":"keep","records":[{"id":"old","characterId":"jonas","message":"keep","status":"future"}]}}']) {
      await pageFor(async page=>{
        await page.addInitScript(value=>localStorage.setItem('raven_deleted_name_preview_v2',value),raw);
        await page.goto(root);await wait(page);
        assert.equal(await page.evaluate(()=>localStorage.getItem('raven_deleted_name_preview_v2')),raw);
        assert.match(await page.locator('#status').innerText(),/غير متوافقة/);
      });
    }
  });
  await t.test('conflicting late history cannot replace an already received reply for the same ID',()=>pageFor(async page=>{
    let op;
    await page.route('**/api/dialogue',async route=>{op=route.request().postDataJSON();await route.fulfill(result(record(op,{response:{text:'الرد المعلوم الأول'}})));});
    await page.goto(root);await wait(page);await send(page);
    await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
    await page.route('**/api/history',route=>route.fulfill(result({items:[record(op,{response:{text:'رد متعارض متأخر'}})]})));
    await page.locator('#history').click();await wait(page);
    assert.match(await page.locator('#log').innerText(),/الرد المعلوم الأول/);
    assert.doesNotMatch(await page.locator('#log').innerText(),/رد متعارض/);
  }));
  await t.test('3 new browser session has no old history, and labels state the limits',()=>pageFor(async page=>{
    await page.goto(root); await wait(page);
    assert.equal(await page.locator('#log .me').count(),0);
    assert.match(await page.locator('footer').innerText(),/يُفقد عند إعادة تشغيله/);
    assert.match(await page.locator('footer').innerText(),/ليست حسابًا موثقًا/);
  }));
  await t.test('4 server error then poll stays error; 10 repeated reads do not duplicate',()=>pageFor(async page=>{
    let op;
    await page.route('**/api/dialogue',async route=>{op=route.request().postDataJSON();await route.fulfill(result(record(op,{status:'error',response:undefined,error:'server_error'})));});
    await page.route('**/api/operations/*',route=>route.fulfill(result(record(op,{status:'error',response:undefined,error:'server_error'}))));
    await page.goto(root); await wait(page); await send(page);
    await page.locator('#status').filter({hasText:'سُجّل خطأ'}).waitFor();
    for(let i=0;i<3;i++){await page.locator('#check').click();await page.locator('#status').filter({hasText:'سُجّل خطأ'}).waitFor();}
    assert.equal(await page.locator('#log .me').count(),1);
    assert.doesNotMatch(await page.locator('#log').innerText(),/تأكد سابقًا|تأكد تسجيل/);
  }));
  await t.test('5 history keeps pending; 6 second send blocked; 9 character switch; 11 stop retains ID',()=>pageFor(async page=>{
    let op, posts=0;
    await page.route('**/api/dialogue',async route=>{op=route.request().postDataJSON();posts++;await route.fulfill({status:202,contentType:'application/json',body:JSON.stringify(record(op,{status:'pending',response:undefined}))});});
    await page.route('**/api/operations/*',route=>route.fulfill(result(record(op,{status:'pending',response:undefined}))));
    await page.goto(root); await wait(page); await send(page,'معلق');
    await page.locator('#stop').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.getElementById('stop').disabled);
    assert.equal(await page.locator('#send').isDisabled(),true);
    await page.locator('#history').click();await wait(page);
    assert.match(await page.locator('#log').innerText(),/معلق/);
    await page.locator('#character').selectOption('claire');await wait(page);
    assert.equal(await page.locator('#send').isDisabled(),false);
    assert.doesNotMatch(await page.locator('#log').innerText(),/معلق/);
    await page.locator('#character').selectOption('jonas');await wait(page);
    let release;const gate = new Promise(r=>release=r);
    await page.route('**/api/operations/*',async route=>{await gate;try{await route.fulfill(result(record(op,{status:'pending',response:undefined})));}catch{}});
    await page.locator('#check').click();await page.locator('#stop').click();release();
    await page.waitForFunction(()=>document.getElementById('stop').disabled);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven_deleted_name_preview_v2')));
    assert.equal(stored.jonas.records[0].id,op.requestId);assert.equal(posts,1);
    assert.match(await page.locator('#status').innerText(),/احتفظنا|توقف انتظار المتصفح/);
  }));
  await t.test('7 known reply without save confirmation stays visible; no regeneration; 13 reply XSS is text',()=>pageFor(async page=>{
    let op,posts=0;
    await page.route('**/api/dialogue',async route=>{op=route.request().postDataJSON();posts++;await route.fulfill(result(record(op,{storage:undefined,response:{text:'<svg onload="window.injected=true">رد محفوظ؟</svg>'}})));});
    await page.route('**/api/operations/*',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"read_failed"}'}));
    await page.goto(root);await wait(page);await send(page);
    await page.locator('#status').filter({hasText:'تعذر تأكيد الحالة'}).waitFor();
    assert.match(await page.locator('#log').innerText(),/رد محفوظ/);assert.equal(await page.locator('#log svg').count(),0);
    await page.locator('#check').click();await page.locator('#status').filter({hasText:'تعذر تأكيد الحالة'}).waitFor();
    await page.locator('#history').click();await wait(page);
    assert.match(await page.locator('#log').innerText(),/رد محفوظ/);assert.equal(posts,1);
    assert.equal(await page.locator('#send').isDisabled(),true);
  }));
  await t.test('7b local save throws after a known reply, reply stays in memory',()=>pageFor(async page=>{
    await page.goto(root);await wait(page);
    await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('quota');};});
    await send(page);await page.locator('#status').filter({hasText:'الحفظ المحلي غير مؤكد'}).waitFor();
    await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
    assert.equal(await page.locator('#log .me').count(),1);
    assert.match(await page.locator('#log').innerText(),/النص الأصلي/);
  }));
  await t.test('8 stale history after send; 9 late character history never changes selected conversation',()=>pageFor(async page=>{
    await page.goto(root);await wait(page);
    let release;const gate=new Promise(r=>release=r);
    await page.route('**/api/history',async route=>{await gate;await route.fulfill(result({items:[]}));});
    await page.locator('#history').click();await send(page,'جديد');
    await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();release();
    await wait(page);assert.match(await page.locator('#log').innerText(),/جديد/);
    await page.locator('#character').selectOption('claire');await wait(page);
    assert.doesNotMatch(await page.locator('#log').innerText(),/جديد/);
  }));
  await t.test('late reply and late history for Jonas cannot overwrite Claire',()=>pageFor(async page=>{
    await page.goto(root);await wait(page);
    let releaseReply;const replyGate=new Promise(r=>releaseReply=r);
    await page.route('**/api/dialogue',async route=>{
      const op=route.request().postDataJSON();await replyGate;
      await route.fulfill(result(record(op,{response:{text:'رد يوناس المتأخر'}})));
    });
    await send(page,'سؤال يوناس المتأخر');
    await page.locator('#character').selectOption('claire');await wait(page);
    releaseReply();await page.waitForTimeout(100);
    assert.doesNotMatch(await page.locator('#log').innerText(),/يوناس المتأخر/);
    await page.locator('#character').selectOption('jonas');await wait(page);
    await page.locator('#log').filter({hasText:'رد يوناس المتأخر'}).waitFor();
    let releaseHistory;const historyGate=new Promise(r=>releaseHistory=r);let reads=0;
    await page.route('**/api/history',async route=>{
      if(++reads===1) await historyGate;
      await route.fulfill(result({items:[]}));
    });
    await page.locator('#history').click();
    await page.locator('#character').selectOption('claire');await wait(page);
    releaseHistory();await page.waitForTimeout(100);
    assert.doesNotMatch(await page.locator('#log').innerText(),/يوناس المتأخر/);
  }));
  await t.test('reload keeps unresolved operation and draft; 202 empty is never completed',()=>pageFor(async page=>{
    await page.route('**/api/dialogue',route=>route.fulfill({status:202,body:''}));
    await page.goto(root);await wait(page);await send(page,'سؤال غير محسوم');
    await page.waitForFunction(()=>document.getElementById('stop').disabled);
    await page.locator('#input').fill('مسودة تالية');await page.reload();await wait(page);
    assert.equal(await page.locator('#input').inputValue(),'مسودة تالية');
    assert.match(await page.locator('#log').innerText(),/سؤال غير محسوم/);
    assert.equal(await page.locator('#send').isDisabled(),true);
  }));
  await t.test('lost session: a read-only 404 follow-up releases the character without resending or inventing a result',()=>pageFor(async page=>{
    let posts=0,firstId;
    await page.route('**/api/dialogue',async route=>{
      posts++;
      if(posts===1){firstId=route.request().postDataJSON().requestId;return route.abort('failed');}
      await route.continue();
    });
    await page.goto(root);await wait(page);await send(page,'سؤال قبل انقطاع الجلسة');
    await page.locator('#status').filter({hasText:'تعذرت قراءة الحالة'}).waitFor();
    assert.equal(await page.locator('#send').isDisabled(),true);
    const followUp=page.waitForResponse(r=>r.url().endsWith('/api/operations/'+firstId)&&r.request().method()==='GET');
    await page.locator('#check').click();
    assert.equal((await followUp).status(),404);
    await page.locator('#status').filter({hasText:'لا يعرف العملية'}).waitFor();
    // The ID is shown as one isolated left-to-right unit inside the Arabic sentence.
    assert.match(await page.locator('#status').innerText(),new RegExp('لا يعرف العملية ⁨'+firstId+'⁩'));
    assert.equal(await page.locator('#send').isDisabled(),false);
    let log=await page.locator('#log').innerText();
    assert.match(log,/سؤال قبل انقطاع الجلسة/);assert.match(log,new RegExp('لم يثبت نجاح العملية أو فشلها[^]*'+firstId));
    assert.doesNotMatch(log,/تأكد سابقًا|سُجّل خطأ|الرد ظاهر هنا/);assert.equal(posts,1);
    await page.reload();await wait(page);
    assert.match(await page.locator('#log').innerText(),new RegExp(firstId));
    assert.equal(await page.locator('#send').isDisabled(),false);
    assert.doesNotMatch(await page.locator('#status').innerText(),/غير متوافقة/);
    const next=page.waitForRequest(r=>r.url().endsWith('/api/dialogue')&&r.method()==='POST');
    await send(page,'سؤال جديد بعد الانقطاع');
    assert.notEqual((await next).postDataJSON().requestId,firstId);
    await page.locator('#status').filter({hasText:'تأكد تسجيل'}).waitFor();
    log=await page.locator('#log').innerText();
    assert.match(log,/سؤال قبل انقطاع الجلسة/);assert.match(log,/سؤال جديد بعد الانقطاع/);assert.equal(posts,2);
  }));
  await t.test('known reply for an operation the server no longer has stays visible and is not regenerated',()=>pageFor(async page=>{
    let op,posts=0;
    await page.route('**/api/dialogue',async route=>{op=route.request().postDataJSON();posts++;await route.fulfill(result(record(op,{storage:undefined,response:{text:'رد وصل قبل فقد الجلسة'}})));});
    await page.goto(root);await wait(page);await send(page);
    await page.locator('#status').filter({hasText:'تعذر تأكيد الحالة'}).waitFor();
    assert.equal(await page.locator('#send').isDisabled(),true);
    const followUp=page.waitForResponse(r=>r.url().endsWith('/api/operations/'+op.requestId));
    await page.locator('#check').click();assert.equal((await followUp).status(),404);
    await page.locator('#status').filter({hasText:'لا يعرف العملية'}).waitFor();
    const log=await page.locator('#log').innerText();
    assert.match(log,/رد وصل قبل فقد الجلسة/);assert.match(log,/حفظ الرد على الخادم غير مؤكد/);
    assert.equal(await page.locator('#send').isDisabled(),false);assert.equal(posts,1);
  }));
  await t.test('stopping the wait says the browser stopped waiting, not that reading failed or the server cancelled',()=>pageFor(async page=>{
    let op,release;const gate=new Promise(r=>release=r);
    await page.route('**/api/dialogue',async route=>{op=route.request().postDataJSON();await gate;try{await route.fulfill(result(record(op)));}catch{}});
    await page.goto(root);await wait(page);await send(page,'سؤال ينتظر');
    await page.waitForFunction(()=>!document.getElementById('stop').disabled);
    await page.locator('#stop').click();
    await page.waitForFunction(()=>document.getElementById('stop').disabled);
    const status=await page.locator('#status').innerText();release();
    assert.match(status,/توقف انتظار المتصفح فقط/);assert.doesNotMatch(status,/تعذرت قراءة الحالة/);
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven_deleted_name_preview_v2')).jonas.records.at(-1));
    assert.equal(stored.id,op.requestId);assert.equal(stored.status,'pending');
  }));
  await t.test('browser timeout is reported as a timeout that proves neither failure nor cancellation',()=>pageFor(async page=>{
    let op;
    await page.clock.install();
    await page.route('**/api/dialogue',async route=>{op=route.request().postDataJSON();});
    await page.goto(root);await wait(page);await send(page,'سؤال بلا جواب');
    await page.waitForFunction(()=>!document.getElementById('stop').disabled);
    await page.clock.fastForward(8100);
    await page.locator('#status').filter({hasText:'انتهت مهلة انتظار المتصفح'}).waitFor();
    assert.doesNotMatch(await page.locator('#status').innerText(),/تعذرت قراءة الحالة/);
    assert.match(await page.locator('#log').innerText(),new RegExp('عملية غير محسومة[^]*'+op.requestId));
    assert.equal(await page.locator('#send').isDisabled(),true);
  }));
  await t.test('expired session cookie: the page says to reload; after reload the follow-up releases the question',()=>pageFor(async(page,context)=>{
    await page.goto(root);await wait(page);
    await send(page,'سؤال الجلسة الأولى');await page.locator('#status').filter({hasText:'تأكد تسجيل'}).waitFor();
    await context.clearCookies();
    const post=page.waitForResponse(r=>r.url().endsWith('/api/dialogue')&&r.request().method()==='POST');
    await send(page,'سؤال بعد انتهاء الجلسة');assert.equal((await post).status(),401);
    await page.locator('#status').filter({hasText:'أعد تحميل الصفحة'}).waitFor();
    assert.equal(await page.locator('#send').isDisabled(),true);
    const pendingId=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven_deleted_name_preview_v2')).jonas.records.at(-1).id);
    await page.reload();await page.locator('#status').filter({hasText:'ليست في سجل الخادم الحالي'}).waitFor();
    const followUp=page.waitForResponse(r=>r.url().endsWith('/api/operations/'+pendingId));
    await page.locator('#check').click();assert.equal((await followUp).status(),404);
    await page.locator('#status').filter({hasText:'يمكنك إرسال سؤال جديد'}).waitFor();
    assert.equal(await page.locator('#send').isDisabled(),false);
    const log=await page.locator('#log').innerText();
    assert.match(log,/سؤال الجلسة الأولى[^]*الرد ظاهر هنا، وحفظه على الخادم غير مؤكد/);
    assert.match(log,new RegExp('سؤال بعد انتهاء الجلسة[^]*لم يثبت نجاح العملية أو فشلها[^]*'+pendingId));
  }));
  await t.test('320/375/390 RTL long text, focus and controls stay reachable',()=>pageFor(async page=>{
    await page.goto(root);await wait(page);
    await send(page,'نص طويل '.repeat(300));await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
    for(const width of [320,375,390]){
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
      for(const id of ['input','send','check','history','character']){
        const box=await page.locator('#'+id).boundingBox();assert.ok(box.x>=0 && box.x+box.width<=width);
      }
      await page.locator('#input').focus();await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'send');
      if(process.env.SCREENSHOT_DIR) await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/dialogue-${width}.png`,fullPage:true});
    }
  }));
});
