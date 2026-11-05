const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright');
test('materials UI uses the real server and recipient contexts',async t=>{
 const {createPreviewServer}=await import('../src/server.js');const server=createPreviewServer();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('#materials-panel summary').click();
 await page.locator('#material-status').filter({hasText:'المواد المسجلة'}).waitFor();
 const create=async(type,text,original)=>{
  await page.selectOption('#material-type',type);if(original)await page.selectOption('#material-original',original);
  await page.fill('#material-text',text);const before=await page.locator('#materials-list .material').count();
  await page.click('#material-save');await page.waitForFunction(n=>document.querySelectorAll('#materials-list .material').length===n,before+1);
  await page.waitForFunction(()=>!document.getElementById('material-save').disabled);
  return page.locator('#materials-list .material').last().getAttribute('data-material-id');
 };
 const original=await create('statement','FIXTURE الأصل الذي يبقى');
 // The action's confirmation must survive the list refresh that follows it.
 assert.match(await page.locator('#material-status').innerText(),/تأكد تسجيل الإجراء في ذاكرة الخادم/);
 const correction=await create('correction','FIXTURE التصحيح الخاص',original);
 const motive=await create('motive','FIXTURE دافع خاص');
 await create('private_note','<img src=x onerror="window.injected=true">FIXTURE ملاحظة');
 const share=async(id,to)=>{
  await page.selectOption('#share-material',id);await page.selectOption('#share-recipient',to);
  const done=page.waitForResponse(r=>r.url().endsWith('/api/shares')&&r.request().method()==='POST');
  await page.click('#material-share');await done;
  await page.waitForFunction(()=>!document.getElementById('material-share').disabled);
 };
 await share(correction,'jonas');
 assert.match(await page.locator('#knowledge-list').innerText(),/التصحيح الخاص/);
 assert.doesNotMatch(await page.locator('#knowledge-list').innerText(),/الأصل الذي|دافع خاص|ملاحظة/);
 await page.selectOption('#share-recipient','claire');await page.locator('#knowledge-list').filter({hasText:'لم تصله'}).waitFor();
 await page.selectOption('#material-type','report');await page.fill('#material-text','FIXTURE مسودة التقرير');
 await page.locator(`#attachments input[value="${correction}"]`).check();
 await page.click('#material-save');await page.locator('#materials-list').filter({hasText:'مسودة التقرير'}).waitFor();
 await page.waitForFunction(()=>!document.getElementById('material-save').disabled);
 const report=await page.locator('#materials-list .material').last().getAttribute('data-material-id');
 await share(report,'claire');
 assert.match(await page.locator('#knowledge-list').innerText(),/مسودة التقرير/);assert.match(await page.locator('#knowledge-list').innerText(),/التصحيح الخاص/);
 assert.doesNotMatch(await page.locator('#knowledge-list').innerText(),/دافع خاص|الأصل الذي|ملاحظة/);
 assert.equal(await page.locator('#materials-list img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
 await page.fill('#input','ما المواد التي وصلتك؟');await page.click('#send');await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
 assert.match(await page.locator('#log').innerText(),/التصحيح الخاص/);assert.doesNotMatch(await page.locator('#log').innerText(),/دافع خاص|الأصل الذي/);
 const download=page.waitForEvent('download');await page.click('#material-export');assert.equal((await download).suggestedFilename(),'raven-materials-backup.json');
 let posts=0;
 await page.route('**/api/materials',async route=>{
  if(route.request().method()!=='POST')return route.continue();
  posts++;await route.fetch();await route.fulfill({status:503,contentType:'application/json',body:'{"error":"read_failed_after_save"}'});
 });
 await page.selectOption('#material-type','statement');await page.fill('#material-text','FIXTURE إجراء محفوظ مع رد غير مؤكد');
 await page.click('#material-save');await page.locator('#material-status').filter({hasText:'لم تتأكد حالة الإجراء'}).waitFor();
 assert.equal(await page.locator('#material-save').isDisabled(),true);
 const pendingId=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven_deleted_name_material_actions_v1')).pending.id);
 assert.ok(pendingId);await page.click('#material-check');
 await page.locator('#material-status').filter({hasText:'تأكد تسجيل الإجراء الأصلي'}).waitFor();
 assert.match(await page.locator('#materials-list').innerText(),/إجراء محفوظ مع رد غير مؤكد/);assert.equal(posts,1);
 await page.unroute('**/api/materials');
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const id of ['material-save','material-share','share-recipient','material-text']){const box=await page.locator('#'+id).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);}
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/materials-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
});
test('a material action lost with the session can be resent with the same ID, without duplicates',async t=>{
 const {createPreviewServer}=await import('../src/server.js');const server=createPreviewServer();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
 const KEY='raven_deleted_name_material_actions_v1';
 const seeded=async pending=>{
  const context=await browser.newContext();const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(([key,value])=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');localStorage.setItem(key,value);},
   [KEY,JSON.stringify({draft:{type:'statement',text:'',originalId:'',attachments:[]},pending})]);
  await page.goto(root);await page.locator('#materials-panel summary').click();
  await page.locator('#material-status').filter({hasText:'الإجراء غير مؤكد'}).waitFor();
  return {context,page,errors};
 };
 // 1) Pending statement from an earlier session: the new session does not know it.
 {
  const {context,page,errors}=await seeded({path:'/api/materials',id:'earlier-statement',body:{id:'earlier-statement',type:'statement',text:'FIXTURE قول من جلسة سابقة'}});
  assert.equal(await page.locator('#material-save').isDisabled(),true);
  assert.equal(await page.locator('#material-resend').isVisible(),true);
  for(const width of [320,375,390]){await page.setViewportSize({width,height:844});const box=await page.locator('#material-resend').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);}
  const sent=page.waitForRequest(r=>r.url().endsWith('/api/materials')&&r.method()==='POST');
  await page.click('#material-resend');
  assert.deepEqual((await sent).postDataJSON(),{id:'earlier-statement',type:'statement',text:'FIXTURE قول من جلسة سابقة'});
  await page.locator('#material-status').filter({hasText:'تأكد تسجيل'}).waitFor();
  await page.waitForFunction(()=>!document.getElementById('material-save').disabled);
  // The confirmation is still shown after the list refresh that follows it.
  assert.match(await page.locator('#material-status').innerText(),/تأكد تسجيل الإجراء في ذاكرة الخادم/);
  assert.equal(await page.locator('#materials-list .material[data-material-id="earlier-statement"]').count(),1);
  assert.equal(await page.locator('#material-resend').isVisible(),false);
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).pending,KEY),null);
  assert.deepEqual(errors,[]);await context.close();
 }
 // 2) The server registered the action but the reply was lost: resending the same ID adds nothing.
 {
  const context=await browser.newContext();const page=await context.newPage();let posts=0;
  await page.route('**/api/materials',async route=>{
   if(route.request().method()!=='POST')return route.continue();
   if(++posts===1){await route.fetch();return route.abort('failed');}
   return route.continue();
  });
  await page.goto(root);await page.locator('#materials-panel summary').click();
  await page.locator('#material-status').filter({hasText:'المواد المسجلة'}).waitFor();
  await page.fill('#material-text','FIXTURE قول وصل وضاع رده');await page.click('#material-save');
  await page.locator('#material-status').filter({hasText:'تعذر تأكيد'}).waitFor();
  const id=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).pending.id,KEY);
  await page.click('#material-resend');await page.locator('#material-status').filter({hasText:'تأكد تسجيل'}).waitFor();
  assert.equal(posts,2);
  assert.equal(await page.locator('#materials-list .material').count(),1);
  assert.equal(await page.locator(`#materials-list .material[data-material-id="${id}"]`).count(),1);
  const listed=await page.evaluate(async()=>(await (await fetch('/api/materials')).json()).items.length);assert.equal(listed,1);
  await context.close();
 }
 // 3) A pending correction whose original no longer exists is refused, which releases the panel.
 {
  const {context,page}=await seeded({path:'/api/materials',id:'earlier-correction',body:{id:'earlier-correction',type:'correction',text:'FIXTURE تصحيح بلا أصل',originalId:'missing-original'}});
  await page.click('#material-resend');await page.locator('#material-status').filter({hasText:'لم يُقبل الإجراء: material_unavailable'}).waitFor();
  assert.equal(await page.locator('#material-save').isDisabled(),false);assert.equal(await page.locator('#materials-list .material').count(),0);
  await context.close();
 }
 // 4) Expired session cookie: the panel says to reload; after reload the same action is resent.
 {
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto(root);await page.locator('#materials-panel summary').click();
  await page.locator('#material-status').filter({hasText:'المواد المسجلة'}).waitFor();
  await context.clearCookies();
  await page.fill('#material-text','FIXTURE قول بعد انتهاء الجلسة');
  const first=page.waitForResponse(r=>r.url().endsWith('/api/materials')&&r.request().method()==='POST');
  await page.click('#material-save');assert.equal((await first).status(),401);
  await page.locator('#material-status').filter({hasText:'أعد تحميل الصفحة'}).waitFor();
  const id=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).pending.id,KEY);
  await page.reload();await page.locator('#materials-panel summary').click();
  await page.locator('#material-status').filter({hasText:'الإجراء غير مؤكد'}).waitFor();
  const again=page.waitForRequest(r=>r.url().endsWith('/api/materials')&&r.method()==='POST');
  await page.click('#material-resend');assert.equal((await again).postDataJSON().id,id);
  await page.locator('#material-status').filter({hasText:'تأكد تسجيل'}).waitFor();
  assert.equal(await page.locator(`#materials-list .material[data-material-id="${id}"]`).count(),1);
  await context.close();
 }
});
