/* ---------- Multi-currency readiness: phase 1 prices and settles in USDT only; other currencies keep daily auto-fetched reference rates ---------- */
const FX_SEED=[
 ['USD','美元',2,1],['PHP','菲律宾比索',2,56.5],['MYR','马来西亚林吉特',2,4.7],['SGD','新加坡元',2,1.35],
 ['THB','泰铢',2,36.5],['VND','越南盾',0,25400],['JPY','日元',0,149]
];
const FX_PROVIDERS=[['MOCK-A','模拟汇率数据源 A（演示）'],['MOCK-B','模拟汇率数据源 B（演示）']];
const FX_TIMES=[['00:05','每天 00:05（UTC）'],['06:00','每天 06:00（UTC）'],['12:00','每天 12:00（UTC）']];
function fxPricingCode(){return (typeof db!=='undefined'&&db&&db.fxV1&&db.fxV1.pricing)||'USDT';}
function fxDeepCurrency(node,seen=new Set()){if(!node||typeof node!=='object'||seen.has(node))return;seen.add(node);if(Array.isArray(node)){for(const x of node)fxDeepCurrency(x,seen);return;}for(const k of Object.keys(node)){if(k==='currency'&&node[k]==='D')node[k]='USDT';else if(node[k]&&typeof node[k]==='object')fxDeepCurrency(node[k],seen);}}
function fxBaseRate(code){return FX_SEED.find(x=>x[0]===code)?.[3]||0;}
function fxQuote(code,day,provider){const base=fxBaseRate(code);let h=0;for(const ch of code+day+provider)h=(h*31+ch.charCodeAt(0))%100000;const drift=((h%1001)-500)/100000;const dec=fxCur(code)?.decimals??2;const v=base*(1+drift);return dec===0?Math.round(v):Math.round(v*10000)/10000;}
function fxDB(){if(!db)return null;
 if(!db.fxV1||db.fxV1.version!==2){const old=db.fxV1;db.fxV1={version:2,settlement:'USDT',pricing:'USDT',
  currencies:FX_SEED.map(([code,name,decimals],i)=>({code,name,decimals,status:'待启用',note:'多币种预留；按 D01 / D03 确认后启用',order:i+1})),
  rates:{},stations:{},auto:{enabled:true,provider:'MOCK-A',time:'00:05',nextResult:'成功',version:'FX-AUTO-1',updatedAt:'',updatedBy:''},runs:[],alert:null,history:old?.history||[]};
  const F=db.fxV1;for(const [code] of FX_SEED)F.rates[code]={perUSDT:fxQuote(code,TODAY,'MOCK-A'),source:'自动获取',provider:'MOCK-A',day:TODAY,at:TODAY+' 00:05',by:'系统',version:'FXR-'+code+'-'+TODAY};
  F.runs.unshift({id:'FXRUN-'+TODAY,day:TODAY,at:TODAY+' 00:05',trigger:'每日自动',provider:'MOCK-A',status:'成功',count:FX_SEED.length,note:'初始获取'});
  fxDeepCurrency(db);const W=db.walletV1;if(W?.settings&&!W.settings.version&&Number(W.settings.rate)===7)W.settings.rate=1;}
 const F=db.fxV1;F.rates||={};F.stations||={};F.runs||=[];F.history||=[];for(const s of db.stations||[])F.stations[s.id]||={pricing:'USDT',version:'FX-ST-1',at:'',by:''};return F;}
function fxCur(code){const F=db&&db.fxV1&&db.fxV1.version===2?db.fxV1:fxDB();return F?.currencies?.find(c=>c.code===code);}
function fxEnabled(){return [{code:'USDT',name:'USDT',decimals:6,status:'启用'}].concat(fxDB().currencies.filter(c=>c.status==='启用'));}
function fxRate(code){if(code==='USDT')return 1;return Number(fxDB().rates[code]?.perUSDT)||0;}
function fxStationCurrency(stationId){return fxDB().stations[stationId]?.pricing||'USDT';}
function fxRateText(code){if(code==='USDT')return '无需换算';const r=fxRate(code);return r?`1 USDT = ${r} ${code}`:'未获取';}
function fxBizDay(){try{return wpBizDay();}catch{return TODAY;}}
function fxStale(code){const r=fxDB().rates[code];if(!r)return true;return r.day<fxBizDay();}
function fxFetch(day,trigger,result,actor){const F=fxDB(),A=F.auto,provider=A.provider,at=day+' '+A.time;if(trigger==='每日自动'&&F.runs.some(r=>r.day===day&&r.trigger==='每日自动'))return null;
 const ok=(result||A.nextResult||'成功')==='成功';if(trigger==='每日自动'&&A.nextResult!=='成功')A.nextResult='成功';
 const run={id:uid('FXRUN'),day,at,trigger,provider,status:ok?'成功':'失败',count:0,note:ok?'':'数据源无响应（模拟）'};
 if(ok){for(const c of F.currencies){const v=fxQuote(c.code,day,provider),version=uid('FXR');F.rates[c.code]={perUSDT:v,source:'自动获取',provider,day,at,by:actor||'系统',version};run.count++;}if(F.alert&&F.alert.day<=day)F.alert=null;}
 else F.alert={day,at,provider,message:`${day} 汇率获取失败（${FX_PROVIDERS.find(p=>p[0]===provider)?.[1]||provider}）：已保留上一版本，请手动录入`};
 F.runs.unshift(run);F.history.unshift({id:uid('FXLOG'),at,by:actor||'系统',object:'汇率获取',change:ok?`${trigger}成功，更新 ${run.count} 个币种`:`${trigger}失败，保留上一版本`,reason:run.note||provider,version:run.id});return run;}
function fxCommand(action,id,data={},backend=false){const F=fxDB();demand(backend,'仅可在运营后台修改币种与汇率');const a=admin19Require(true);demand(FE.mode==='admin'||ADMIN19.backendDepth>0,'请在运营后台处理管理动作');demand(a.role==='admin','仅总站可以修改币种与汇率');
 const reason=String(data.reason||'').trim();demand(reason.length>=4,'请填写调整依据（至少 4 字）');const at=fxBizDay()+' '+new Date().toTimeString().slice(0,5),by=a.subject;let out=id;
 if(action==='rate'){const code=String(data.code||id);const c=fxCur(code);demand(c,'只能为待启用币种录入汇率；USDT 无需汇率');const v=Number(data.perUSDT);demand(Number.isFinite(v)&&v>0&&v<=10000000,'汇率须大于 0');const rate=c.decimals===0?Math.round(v):Math.round(v*10000)/10000,before=fxRate(code);
  const version=uid('FXR');F.rates[code]={perUSDT:rate,source:'人工录入',provider:'',day:fxBizDay(),at,by,version,reason};out=version;if(F.alert)F.alert=null;
  F.history.unshift({id:uid('FXLOG'),at,by,object:code,change:`人工录入 1 USDT = ${before||'未获取'} → ${rate} ${code}`,reason,version});}
 else if(action==='auto'){const provider=String(data.provider||'');demand(FX_PROVIDERS.some(p=>p[0]===provider),'请选择数据源');const time=String(data.time||'');demand(FX_TIMES.some(t=>t[0]===time),'请选择获取时间');
  Object.assign(F.auto,{enabled:data.enabled==='on'||data.enabled===true,provider,time,version:uid('FX-AUTO'),updatedAt:at,updatedBy:by});out=F.auto.version;
  F.history.unshift({id:uid('FXLOG'),at,by,object:'自动获取设置',change:`${F.auto.enabled?'开启':'关闭'} · ${FX_PROVIDERS.find(p=>p[0]===provider)[1]} · ${time} UTC`,reason,version:out});}
 else if(action==='fetch'){const run=fxFetch(fxBizDay(),'手动触发',data.result==='失败'?'失败':'成功',by);out=run.id;}
 else if(action==='nextFail'){F.auto.nextResult='失败';out='nextFail';F.history.unshift({id:uid('FXLOG'),at,by,object:'演示设置',change:'下一次每日自动获取模拟失败',reason,version:'—'});}
 else if(action==='station'){const st=getBy('stations',id);demand(st,'分站不存在');const code=String(data.pricing||'');demand(fxEnabled().some(c=>c.code===code),'只能选择已启用的币种；首期仅 USDT');demand(code==='USDT'||!fxStale(code),'该币种汇率未更新，请先获取或手动录入');const prev=fxStationCurrency(id);demand(prev!==code,'定价币种没有变化');const version=uid('FXST');F.stations[id]={pricing:code,version,at,by};
  F.history.unshift({id:uid('FXLOG'),at,by,object:siteLabel(id),change:`定价币种 ${prev} → ${code}（只影响之后的商品与订单）`,reason,version});out=version;}
 else demand(false,'未知操作');
 audit('币种与汇率 · '+action,out,reason);return out;}
function fxRun(action,id,data={},backend=true){const out=v22Persist(()=>fxCommand(action,id,data,backend));const run=action==='fetch'?fxDB().runs[0]:null;toast({rate:'汇率已手动录入并保存版本',auto:'自动获取设置已保存',fetch:run?.status==='成功'?'汇率获取成功，已更新':'汇率获取失败，已保留上一版本，请手动录入',nextFail:'下一次每日自动获取将模拟失败',station:'分站定价币种已保存'}[action]||'已保存');render();return out;}
function fxForm(action,id,body,label){return `<form class="mcn-form" data-fx-form="${e(action)}" data-id="${e(id)}">${body}<div class="mcn-form-error" role="alert"></div><button class="btn primary" type="submit">${e(label)}</button></form>`;}
function fxBtn(action,label,values={}){return `<button type="button" class="btn small" data-fx-command="${e(action)}" data-values="${e(JSON.stringify(values))}">${e(label)}</button>`;}
function fxAdminPage(){const a=admin19Require(),admin=a.role==='admin',F=fxDB(),A=F.auto,own=db.stations.filter(s=>admin||s.ownerId===a.subject),last=F.runs[0],pname=FX_PROVIDERS.find(p=>p[0]===A.provider)?.[1]||A.provider;
 const curRows=[[`<b>USDT</b>`,'USDT','6 / 2',mcnTag('已启用 · 定价与结算'),'—','—','—',mcnTag('正常')]].concat(F.currencies.map(c=>{const r=F.rates[c.code];return [`<b>${e(c.code)}</b>`,e(c.name),`${c.decimals} / ${c.decimals}`,mcnTag('待启用'),e(r?r.perUSDT:'未获取'),e(r?.source||'—'),e(r?r.at+(r.by&&r.by!=='系统'?' · '+r.by:''):'—'),fxStale(c.code)?mcnTag('待更新',true):mcnTag('正常')];}));
 return pageHead('币种与汇率','首期只启用 USDT：商品定价、支付、钱包与提现均以 USDT 计价和结算，不需要换算。其他币种已预留，汇率每天自动获取一次，获取失败时手动录入。')+`<div class="mcn-surface" data-admin-no-translate>`
 +mcnStats([['定价与结算币种','USDT'],['自动获取',A.enabled?`已开启 · ${A.time} UTC`:'已关闭'],['最近获取',last?`${last.day} ${last.status}`:'—'],['待更新币种',F.currencies.filter(c=>fxStale(c.code)).length]])
 +(F.alert?banner(F.alert.message,'danger'):'')
 +banner('多币种预留：订单、账单与资金记录都保存币种和汇率快照字段；首期汇率恒为 1。其他币种的汇率每天按设置自动获取一次并保存版本，只作参考，不参与计价；获取失败时保留上一版本并在此提醒手动录入。启用其他币种（如本地法币定价）须按 D01 / D03 确认。原型不连接真实汇率接口。','neutral')
 +(admin?mcnPanel('自动获取设置',fxForm('auto','',`<div class="mcn-grid">${mcnField('provider','数据源',A.provider,'select',FX_PROVIDERS)}${mcnField('time','获取时间',A.time,'select',FX_TIMES)}</div>${mcnField('enabled','开启每日自动获取',A.enabled,'checkbox')}${mcnField('reason','调整依据（至少 4 字）','','textarea')}<p class="mcn-rule-note">当前：${e(pname)} · ${e(A.time)} UTC · 版本 ${e(A.version)}${A.updatedAt?' · '+e(A.updatedAt)+' '+e(A.updatedBy):''}。每次日结推进到新的一天后执行当天的自动获取；同一天只自动获取一次。</p>`,'保存设置')
  +`<div class="fx-actions">${fxBtn('fetch','立即获取（模拟成功）',{result:'成功',reason:'运营人工触发获取'})}${fxBtn('fetch','立即获取（模拟失败）',{result:'失败',reason:'演示获取失败'})}${fxBtn('nextFail','下次每日获取模拟失败',{reason:'演示自动获取失败'})}</div>`):`<p>自动获取：${e(A.enabled?'已开启':'已关闭')} · ${e(pname)} · ${e(A.time)} UTC（仅总站可修改）。</p>`)
 +mcnPanel('币种与汇率',mcnTable(['代码','名称','小数位（账务 / 展示）','状态','1 USDT 兑换','来源','更新','汇率状态'],curRows))
 +(admin?mcnPanel('手动录入汇率',fxForm('rate','',`<div class="mcn-grid">${mcnField('code','币种',F.currencies[0]?.code||'','select',F.currencies.map(c=>[c.code,c.code+' · '+c.name]))}<label class="fe-field"><span>1 USDT 兑换</span><input name="perUSDT" type="number" min="0.0001" step="0.0001" required></label></div>${mcnField('reason','录入依据（至少 4 字）','','textarea')}<p class="mcn-rule-note">自动获取失败或数据异常时使用。人工录入同样保存版本与依据，下次自动获取成功后以新数据为准。</p>`,'保存汇率')):'')
 +mcnPanel(admin?'分站定价币种':'本站定价币种',mcnTable(['分站','定价币种','版本','更新'],own.map(s=>{const x=F.stations[s.id]||{};return [e(siteLabel(s.id)),`<b>${e(x.pricing||'USDT')}</b>`,e(x.version||'—'),e(x.at?x.at+' · '+x.by:'初始配置')];}))+`<p class="mcn-rule-note">${admin?'首期所有分站以 USDT 定价；其他币种启用后才能切换，切换只影响之后的商品与订单。':'站长只读；修改由总站处理。'}</p>`)
 +mcnPanel('获取记录',mcnTable(['日期','时间','触发','数据源','结果','更新币种','说明'],F.runs.slice(0,30).map(r=>[e(r.day),e(r.at),e(r.trigger),e(FX_PROVIDERS.find(p=>p[0]===r.provider)?.[1]||r.provider),mcnTag(r.status,r.status!=='成功'),e(r.count),e(r.note||'—')])))
 +mcnPanel('汇率与配置记录',mcnTable(['时间','操作人','对象','变更','依据','版本'],F.history.filter(h=>admin||own.some(s=>siteLabel(s.id)===h.object)||!db.stations.some(s=>siteLabel(s.id)===h.object)).slice(0,40).map(h=>[e(h.at),e(h.by),e(h.object),e(h.change),e(h.reason),e(h.version)])))
 +'</div>';}
PAGE.fxCurrency=fxAdminPage;ROUTE_NAMES.fxCurrency='币种与汇率';ROUTE_GROUP.fxCurrency='fund';
OPS11_NAV.find(g=>g[0]==='fund')?.[3].push(['fxCurrency','币种与汇率']);
{const ctx=OPS11_CONTEXT.find(g=>g.some?.(x=>x[0]==='walletAdmin'));if(ctx)ctx.push(['fxCurrency','币种与汇率']);const ictx=OPS11_CONTEXT.find(g=>g.some?.(x=>x[0]==='intlOverview'));if(ictx&&ictx!==ctx)ictx.push(['fxCurrency','币种与汇率']);}
if(typeof I6_MENU!=='undefined'&&!I6_MENU.some(x=>x[0]==='fxCurrency'))I6_MENU.push(['fxCurrency','币种与汇率']);
if(typeof STATION_NAV!=='undefined'&&!STATION_NAV.some(x=>(Array.isArray(x)?x[0]:x)==='fxCurrency'))STATION_NAV.splice(STATION_NAV.length-1,0,['fxCurrency','本站币种与汇率']);
const fxReadBase=canRead;canRead=function(r){if(r==='fxCurrency'){const a=admin19Bound();return !!a&&(a.role==='admin'||isStationOwner());}return fxReadBase(r);};
{const fxDailyBase=wpDailyRun;wpDailyRun=function(day,actor){const out=fxDailyBase(day,actor);const F=fxDB();if(F&&F.auto.enabled)fxFetch(day,'每日自动',null,'系统');return out;};}
for(const key of ['pd8Work','opsInbox'])if(PAGE[key]){const prev=PAGE[key];PAGE[key]=()=>{const F=admin19Bound()?.role==='admin'?fxDB():null;return prev()+(F?.alert?mcnPanel('汇率获取失败',`<p>${e(F.alert.message)}</p>`+linkTo('fxCurrency','进入币种与汇率手动录入')):'');};}
MCN_HELP.fxCurrency={purpose:'首期只启用 USDT（定价与结算）；其他币种已预留，汇率每天自动获取一次并保存版本，获取失败时手动录入。',roles:'总站修改自动获取设置、手动录入汇率、切换分站定价币种（须填写依据）；站长只读本站。',flow:'每日日结后按设置自动获取汇率 → 成功则更新各币种汇率并保存版本 → 失败则保留上一版本、在工作台提醒 → 总站手动录入 → 按 D01 / D03 启用其他币种后才用于计价。',links:['walletAdmin','stations','intlSites','regions','opsReports'],fields:{定价币种:'商品与订单的计价币种；首期为 USDT，按分站配置，切换只影响之后的商品与订单。',结算币种:'USDT：会员钱包、充值、提现、出款与账务都以 USDT 执行。',汇率:'1 USDT 兑换的币种数量；每天自动获取一次或人工录入，均保存版本；首期仅作参考。',待更新:'汇率不是当天获取或录入的，需要重新获取或手动录入。',小数位:'账务与展示的小数位，折算后按该币种的小数位舍入。'}};

/* Correct back-office texts that predate the wallet, the USD-digital-currency decision, cycle settlement and the USDT-only first phase. */
{const patch=(route,pairs)=>{const base=PAGE[route];if(!base)return;PAGE[route]=(...args)=>{let h=base(...args);for(const [a,b] of pairs)h=h.split(a).join(b);return h;};};
 patch('userBalances',[['消费者资金是订单待履约金额，不是自由充值钱包；服务者自己的可结算收益另列。','本页为会员订单的待履约金额；会员余额钱包（充值余额、可提现余额）见“钱包与推广日结”；服务者可结算收益另列。']]);
 patch('collectionChannels',[['原文首期收款方式为 GCash 与银行卡。本页仅演示配置字段；币种固定为 D，密钥仅允许环境变量名引用。','按会议记录，收付只接 USD 数字货币（USDT）；GCash 与银行卡为早期演示配置，不在当前收付范围。首期定价与结算均为 USDT，其他币种见“币种与汇率”；密钥仅允许环境变量名引用。']]);
 patch('settings',[['<h3>付款与主动续期</h3>','<h3>付款与结算周期</h3>'],['<dt>正式币种</dt><dd>待评审</dd>','<dt>定价 / 结算币种</dt><dd>首期均为 USDT；多币种已预留，其他币种按 D03 启用</dd>'],['<dt>购买周期</dt><dd>单次 / 按天 / 按周</dd>','<dt>服务期与结算周期</dt><dd>单次；按天 1 / 3 / 7 / 14 天；按周 1 / 2 周；每 1 / 3 / 7 天结算，一次付清</dd>'],['<dt>续费方式</dt><dd>用户主动付款</dd>','<dt>续费方式</dt><dd>服务期结束后重新下单</dd>']]);
 patch('withdrawalPolicies',[['普通会员消费预付款不可提现。','普通会员的订单预付款不可提现；会员余额钱包的可提现余额（推广分红、订单退款）按“钱包与推广日结”的规则提现。']]);}
{const fxBookingBase=FE_PAGES.booking;FE_PAGES.booking=function(...args){const html=fxBookingBase(...args),p=getBy('products',FE.id),prov=p&&getBy('providers',p.provider),code=fxStationCurrency(prov?.stationId||'ST-001');return html.replace('<li>下单时一次付清整个服务期的费用，由平台保管</li>',`<li>下单时一次付清整个服务期的费用，由平台保管</li><li>${code==='USDT'?'金额以 USDT 计价，与余额钱包同一币种，不需要换算':`金额以本站定价币种 ${e(code)} 计价；余额支付时按当时汇率（${e(fxRateText(code))}）折算为 USDT 并保存，之后的结算与退款按该汇率计算`}</li>`);};}
document.addEventListener('submit',ev=>{const f=ev.target;if(!f.dataset?.fxForm)return;ev.preventDefault();if(!f.reportValidity())return;try{const data=Object.fromEntries(new FormData(f));data.enabled=f.querySelector('[name="enabled"]')?.checked||false;fxRun(f.dataset.fxForm,data.station||f.dataset.id||'',data,true);}catch(err){const box=f.querySelector('.mcn-form-error');if(box)box.textContent=err.message;}});
document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-fx-command]');if(!b)return;try{fxRun(b.dataset.fxCommand,'',JSON.parse(b.dataset.values||'{}'),true);}catch(err){toast(err.message);}});
