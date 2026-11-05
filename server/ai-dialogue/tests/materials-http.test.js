import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../src/server.js';
import { createMaterialStore } from '../src/materials.js';

test('real session routes share only explicit materials and build dialogue from recipient knowledge', async t => {
  // Synthetic internal fixtures exercise the production engine/HTTP paths; no production seed.
  const server = createPreviewServer({createMaterials:() => {
    const store = createMaterialStore();
    store.createMaterial({id:'fixture-source',type:'evidence',text:'FIXTURE source',sourceId:'fixture-private-source'});
    store.createMaterial({id:'fixture-report',type:'report',text:'FIXTURE report',attachments:['fixture-source']});
    store.createMaterial({id:'fixture-receipt',type:'receipt',text:'FIXTURE receipt',reportId:'fixture-report',depositId:'fixture-deposit'});
    store.createMaterial({id:'npc-private',type:'private_note',text:'FIXTURE NPC secret',author:'jonas'});
    return store;
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const root=`http://127.0.0.1:${server.address().port}`;
  const session=async()=> (await fetch(root)).headers.get('set-cookie').split(';')[0];
  const a=await session(),b=await session();
  const call=async(path,body,cookie=a)=>{
    const res=await fetch(root+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
    return {status:res.status,data:await res.json()};
  };
  const create=body=>call('/api/materials',body);
  const share=(materialId,character,eventId)=>call('/api/shares',{eventId,materialId,recipients:[character]});
  assert.equal((await create({id:'original',type:'statement',text:'FIXTURE original'})).status,200);
  assert.equal((await create({id:'older',type:'correction',text:'FIXTURE old',originalId:'original'})).status,200);
  assert.equal((await create({id:'newer',type:'correction',text:'FIXTURE new',originalId:'original'})).status,200);
  await create({id:'motive',type:'motive',text:'FIXTURE secret motive'});
  await share('newer','jonas','new-first');await share('older','jonas','old-last');
  const jonas=(await call('/api/knowledge?characterId=jonas')).data;
  assert.deepEqual(jonas.latestCorrections,['newer']);assert.deepEqual(jonas.materials.map(x=>x.id),['newer','older']);
  assert.doesNotMatch(JSON.stringify(jonas),/originalId|secret motive|FIXTURE original|NPC secret/);
  assert.deepEqual((await call('/api/knowledge?characterId=claire')).data.materials,[]);
  const reply=await call('/api/dialogue',{requestId:'ctx-jonas',characterId:'jonas',message:'ما المواد التي وصلتك؟'});
  assert.match(reply.data.response.text,/FIXTURE new/);assert.doesNotMatch(reply.data.response.text,/secret motive|FIXTURE original|NPC secret/);
  const other=await call('/api/dialogue',{requestId:'ctx-claire',characterId:'claire',message:'ما المواد التي وصلتك؟'});
  assert.doesNotMatch(other.data.response.text,/FIXTURE new/);
  await create({id:'report',type:'report',text:'FIXTURE draft',attachments:['newer']});
  await share('report','matteo','report-mat');
  assert.deepEqual((await call('/api/knowledge?characterId=matteo')).data.materials.map(x=>x.id),['report','newer']);
  assert.deepEqual((await call('/api/knowledge?characterId=jonas')).data,jonas);
  await share('fixture-receipt','claire','receipt-claire');
  const claire=(await call('/api/knowledge?characterId=claire')).data;
  assert.deepEqual(claire.materials.map(x=>x.id),['fixture-receipt']);
  assert.doesNotMatch(JSON.stringify(claire),/reportId|depositId|FIXTURE report|FIXTURE source/);
  assert.equal((await share('fixture-receipt','claire','receipt-claire')).data.event.duplicated,true);
  assert.equal((await call('/api/shares',{eventId:'cross-session',materialId:'newer',recipients:['claire']},b)).status,400);
  assert.equal((await create({id:'forged',type:'receipt',text:'fake',reportId:'report',depositId:'fake'})).status,400);
  assert.equal((await create({id:'forged',type:'evidence',text:'fake',sourceId:'fake'})).status,400);
  assert.equal((await create({id:'forged',type:'statement',text:'fake',author:'elena'})).status,400);
  assert.equal((await call('/api/shares',{eventId:'forged',sender:'jonas',materialId:'newer',recipients:['claire']})).status,400);
  assert.equal((await create({id:'original',type:'statement',text:'different'})).status,409);
});
