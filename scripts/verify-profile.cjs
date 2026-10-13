// Profile IP language, avatar presentation and synchronized prototype change notes.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('陪伴服务平台_三端交互原型.html','utf8');
const source=html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\nboot\(\);\s*feBoot\(\);\s*$/,'');
const noop=()=>{};const el=new Proxy({style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},children:[],childNodes:[],appendChild:noop,append:noop,setAttribute:noop,removeAttribute:noop,addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],insertAdjacentHTML:noop,remove:noop,textContent:'',innerHTML:''},{get:(t,k)=>k in t?t[k]:undefined});
const storage={getItem:()=>null,setItem:noop,removeItem:noop};
const c={AbortController,console,structuredClone,TextEncoder,TextDecoder,URL,URLSearchParams,FormData,Blob,Intl,Date,Math,JSON,Set,Map,Array,Object,Number,String,Boolean,RegExp,Error,Promise,Uint8Array,atob,btoa,setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,clearInterval:noop,localStorage:storage,sessionStorage:storage,location:{hash:''},history:{replaceState:noop,pushState:noop},navigator:{language:'zh-CN',languages:['zh-CN']},document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>el,addEventListener:noop,documentElement:el,body:el,head:el},window:{addEventListener:noop,innerWidth:1280,scrollTo:noop},NodeFilter:{SHOW_TEXT:4},MutationObserver:class{observe(){}},confirm:()=>true};c.window.window=c.window;vm.createContext(c);vm.runInContext(source,c,{timeout:10000});
vm.runInContext(`db=createSeed();feSeed();admin19Ensure();render=()=>{};feRender=()=>{};save=()=>{};toast=()=>{};const seed22=structuredClone(db);function as22(id){FE.user=id;FE.side='buyer';FE_AUTH.signedIn=true;FE.mode='pc';};function admin22(){const a=db.admin19Accounts.find(a=>a.role==='admin');ADMIN19.initialized=true;ADMIN19.session={accountId:a.id,credentialVersion:a.credentialVersion,issuedAt:Date.now(),expiresAt:Date.now()+1800000};role=a.role;FE.mode='admin';};`,c);
const run=s=>vm.runInContext(s,c);let passed=0,failed=0;async function test(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' :: '+String(e.message).split('\n')[0].slice(0,160));}}
function reset(){run(`db=structuredClone(seed22);as22('U22-VIP');Object.assign(PF_IP,{mode:'auto',status:'idle',country:'',checkedAt:0,request:PF_IP.request+1,controller:null});`);}
const adminPage=r=>run(`admin22();route='${r}';PAGE['${r}']()`);
run(`function mfd(data){const f=new FormData();for(const [k,v] of Object.entries(data))f.set(k,v);return f;}`);

(async()=>{
await test('PC/H5 头像图片无可见编号；资料移除旧提示及手选语言，保留头像与性别编辑',()=>{
 reset();for(const mode of ['pc','h5']){run(`FE.mode='${mode}';FE.dialog={type:'profile',id:'',intent:'PF'};`);const d=run('feDialogView()');
 assert.equal((d.match(/data-av-choice=/g)||[]).length,216);assert.doesNotMatch(d,/<em>(?:\d+|原有 \d+)<\/em>/);assert.doesNotMatch(d,/仅保存当前演示账号资料|<select name="lang"|偏好服务语言/);assert.match(d,/按 IP 自动切换/);assert.match(d,/data-pf-updates/);assert.match(d,/name="gender"/);assert.match(d,/data-av-file/);}
});
await test('IP 地区控制服务语言；不使用浏览器语言，也不改变界面语言、服务者能力或金额',()=>{
 reset();const before=run('JSON.stringify([feLocaleState().code,db.international.serviceLanguages,money(132)])');
 for(const country of ['CN','HK','MO','TW','US','SG','JP','DE']){run(`Object.assign(PF_IP,{country:'${country}',status:'ready'});pfSyncLanguage();`);assert.equal(run('feMe().feServiceLanguage'),['CN','HK','MO','TW'].includes(country)?'简体中文':'英语');}
 assert.equal(run('JSON.stringify([feLocaleState().code,db.international.serviceLanguages,money(132)])'),before);
 assert.equal(run('navigator.language'),'zh-CN');assert.equal(run('pfLanguageState().code'),'en-US');assert.equal(run('feMe().feServiceLanguageMode'),'ip');
});
await test('只使用本站已发布语言；未知地区、失败与未开放语言回退本站默认，重新识别恢复',()=>{
 reset();assert.equal(run(`pfLanguageFor('US',['zh-CN'],'zh-CN').code`),'zh-CN');assert.equal(run(`pfLanguageFor('US',['zh-CN'],'zh-CN').restricted`),true);
 assert.equal(run(`pfLanguageFor('', ['zh-CN','en-US'],'en-US').code`),'en-US');assert.equal(run(`pfCountryCode(' XX ')`),'');assert.equal(run(`pfCountryCode('<script>')`),'');
 run(`Object.assign(PF_IP,{status:'error',country:'US'});`);assert.equal(run('pfLanguageState().code'),'zh-CN');assert.match(run('pfLanguageField()'),/暂未识别 IP/);
 run(`Object.assign(PF_IP,{status:'ready',country:'US'});`);assert.equal(run('pfLanguageState().code'),'en-US');
});
await test('保存资料按最新 IP 结果写入，旧表单的语言值不能覆盖；头像、昵称及性别正常保存',()=>{
 reset();run(`Object.assign(PF_IP,{status:'ready',country:'US'});FE.dialog={type:'profile',id:'',intent:'PF'};feSubmit('profile','',mfd({nickname:'资料验收',gender:'女',avatarChoice:'preset:48',lang:'简体中文'}));`);
 assert.equal(run('feMe().feServiceLanguage'),'英语');assert.equal(run('feMe().nickname'),'资料验收');assert.equal(run('feMe().gender'),'女');assert.equal(run('feMe().avatarChoice'),'preset:48');
});
await test('真实查询使用无凭据且不带引用来源的请求；只消费地区，不保存原始 IP；五分钟内不重复查询',async()=>{
 reset();let calls=0,options;c.fetch=async(url,opts)=>{calls++;options=opts;assert.equal(url,'https://api.country.is/');return {ok:true,json:async()=>({country:'JP',ip:'198.51.100.7'})};};
 await run('pfDetectIP(true)');assert.equal(run('PF_IP.status'),'ready');assert.equal(run('feMe().feServiceLanguage'),'英语');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(run(`JSON.stringify(db).includes('198.51.100.7')`),false);
 await run('pfDetectIP()');assert.equal(calls,1);
});
await test('HTTP 失败、响应缺地区、超时中止均回退；旧请求不覆盖最新地区预览',async()=>{
 for(const mock of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({})}),async()=>{throw new Error('network unavailable');}]){reset();c.fetch=mock;await run('pfDetectIP(true)');assert.equal(run('PF_IP.status'),'error');assert.equal(run('pfLanguageState().code'),'zh-CN');}
 reset();c.fetch=async(url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted'))));let pending=run('pfDetectIP(true)');run('PF_IP.controller.abort()');await pending;assert.equal(run('PF_IP.status'),'error');
 reset();let resolve;c.fetch=async()=>new Promise(r=>{resolve=r;});pending=run('pfDetectIP(true)');run(`pfPreviewIP('CN')`);resolve({ok:true,json:async()=>({country:'US'})});await pending;assert.equal(run('PF_IP.country'),'CN');assert.equal(run('pfLanguageState().code'),'zh-CN');
});
await test('演示地区有明确标识且不自动持久化；恢复自动识别后重新获取并使用当前地区',async()=>{
 reset();const before=run('JSON.stringify([feMe().feServiceLanguage,feMe().feServiceLanguageMode])');let saves=0;c.pfTestSave=()=>{saves++;};run('save=pfTestSave');run(`pfPreviewIP('US')`);assert.equal(saves,0);assert.equal(run('pfLanguageState().label'),'英语');assert.equal(run('JSON.stringify([feMe().feServiceLanguage,feMe().feServiceLanguageMode])'),before);assert.match(run('pfLanguageState().detail'),/演示预览/);
 run(`pfPreviewIP('failure')`);assert.match(run('pfLanguageState().detail'),/识别失败|暂未识别/);
 c.fetch=async()=>({ok:true,json:async()=>({country:'CN'})});run(`pfPreviewIP('auto')`);await new Promise(setImmediate);assert.equal(run('PF_IP.mode'),'auto');assert.equal(run('pfLanguageState().code'),'zh-CN');assert.doesNotMatch(run('pfLanguageState().detail'),/演示/);assert.ok(saves>0);run('save=()=>{}');
});
await test('原型修改说明与最新文档同源，所有关联文档随构建同步到 dist',()=>{
 reset();const changes=JSON.parse(fs.readFileSync('.work/prototype-updates.json','utf8')),doc=fs.readFileSync('docs/修改说明.md','utf8'),body=run('pfUpdatesBody()');
 for(const entry of changes.entries){for(const item of entry.items){assert.ok(doc.includes(item.text));assert.ok(body.includes(item.text));}for(const d of entry.docs)assert.equal(fs.readFileSync(d.path,'utf8'),fs.readFileSync('dist/'+d.path,'utf8'));}
 assert.equal(doc,fs.readFileSync('dist/docs/修改说明.md','utf8'));assert.equal(JSON.parse(fs.readFileSync('dist/build-info.json')).prototypeUpdatedAt,changes.entries[0].date);
});
console.log('PROFILE CHECKS '+passed+(failed?' · FAILED '+failed:''));if(failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
