/* Optional gender is stored once on the unified user account.
   Related identities read that profile; transaction snapshots stay untouched. */
const GENDER_VALUES=['男','女','其他','未填写'];
const GENDER={team:'',invite:'',following:'',promotion:'',mcnGuilds:'',mcnPromotions:'',supply:'',quality:'',matches:''};
function genderValue(value){const v=String(value??'').trim()||'未填写';demand(GENDER_VALUES.includes(v),'请选择有效性别：男、女、其他或未填写');return v;}
function genderFilterValue(value){const v=String(value??'').trim();demand(!v||GENDER_VALUES.includes(v),'性别筛选条件无效');return v;}
function genderUser(object){
 if(!object)return null;
 if(typeof object==='string')return getBy('users',object)||getBy('users',getBy('providers',object)?.uid)||getBy('users',getBy('agents',object)?.userId)||null;
 return getBy('users',object.uid||object.user||object.member||object.manager||object.userId)||getBy('users',getBy('providers',object.provider)?.uid)||getBy('users',object.id)||null;
}
function genderOf(object){const u=genderUser(object),v=String(u?.gender||'').trim();return !v?'未填写':GENDER_VALUES.includes(v)?v:'其他';}
function genderMatches(object,value){const v=genderFilterValue(value);return !v||genderOf(object)===v;}
function genderBadge(object){const u=genderUser(object);return u?'<span class="gender-badge" data-gender="'+e(genderOf(u))+'">性别：'+e(genderOf(u))+'</span>':'';}
function genderEnsure(d=db){
 if(!d?.users)return;
 for(const u of d.users){
  if(u.genderProfileVersion===1)continue;
  // These IDs are fictional preset accounts with deliberately assigned portraits.
  // Never infer a new or uploaded account's gender from an image.
  const preset=FASHION_SEEDED_PORTRAITS[u.id],old=String(u.gender||'').trim();
  if(!old||old==='未填写')u.gender=preset===undefined?'未填写':[0,1,2,3,8,9,10,11].includes(preset)?'女':'男';
  u.genderProfileVersion=1;
 }
}
function genderOptions(value='',filter=true){return (filter?[['','不限性别'],...GENDER_VALUES.map(v=>[v,v])]:GENDER_VALUES.map(v=>[v,v==='未填写'?'未填写 / 不公开':v])).map(([v,t])=>'<option value="'+e(v)+'" '+(v===value?'selected':'')+'>'+e(t)+'</option>').join('');}
function genderField(value='未填写',name='gender',label='性别（选填）'){
 return '<label class="fe-field"><span>'+e(label)+'</span><select name="'+e(name)+'">'+genderOptions(value,false)+'</select><small class="fe-small">与会员资料同步；可选择未填写。</small></label>';
}
function genderQuery(scope,label='性别筛选'){
 return '<div class="gender-query"><label><span>'+e(label)+'</span><select data-gender-query="'+e(scope)+'" aria-label="'+e(label)+'">'+genderOptions(GENDER[scope]||'')+'</select></label><button type="button" class="btn small ghost fe-btn" data-gender-clear="'+e(scope)+'">重置性别</button><small>按当前会员资料筛选</small></div>';
}
function genderRevalidate(){for(const m of db.v22?.matches||[])v22MatchRefresh(m);}
function genderPersist(work,frontend=false){
 const oldSave=save,ui=frontend?Object.fromEntries(['user','side','page','id','dialog','error','flash','orderFilter','chat','history'].map(k=>[k,structuredClone(FE[k])])):null,auth=frontend?structuredClone(FE_AUTH):null;
 // Legacy form handlers save during the action. Commit the gender update once
 // through the existing capacity-aware writer, after all linked changes finish.
 try{save=()=>{};return v22Persist(work);}catch(err){if(ui){Object.assign(FE,ui);Object.assign(FE_AUTH,auth);FE.error=err.message;feAuthSave();feRender();}throw err;}finally{save=oldSave;}
}
const genderSeedBefore=feSeed;feSeed=function(){const out=genderSeedBefore();genderEnsure();return out;};
const genderDerivedBefore=refreshDerived;refreshDerived=function(...args){genderEnsure();return genderDerivedBefore(...args);};
const genderRenderBefore=feRender;feRender=function(...args){genderEnsure();return genderRenderBefore(...args);};
const genderProvidersBefore=feProviders;feProviders=function(){genderEnsure();return genderProvidersBefore().filter(p=>genderMatches(p,V22.filters?.gender));};
const genderTagsBefore=v23Tags;v23Tags=function(p,m){return ['性别：'+genderOf(p),...genderTagsBefore(p,m)];};
const genderFormBefore=v22Form;v22Form=function(action,id,body,label,backend=false){
 if(['filters','matchCreate'].includes(action))body='<div class="v22-fields"><label class="fe-field"><span>服务者性别</span><select name="gender">'+genderOptions(action==='filters'?V22.filters?.gender||'':'')+'</select></label></div>'+body;
 return genderFormBefore(action,id,body,label,backend);
};
const genderCandidatesBefore=v22MatchCandidates;v22MatchCandidates=function(m){return genderCandidatesBefore(m).filter(p=>genderMatches(p,m.gender));};
const genderMatchRefreshBefore=v22MatchRefresh;v22MatchRefresh=function(m){genderMatchRefreshBefore(m);for(const c of m.candidates||[])if(c.status==='已失效'&&!genderMatches(c.provider,m.gender))c.reason='服务者当前性别不符合本次匹配条件';};
const genderCommandBefore=v22Command;v22Command=function(action,id='',data={},backend=false){
 const preference=action==='matchCreate'?genderFilterValue(data.gender):'';
 const ids=action==='matchCreate'?new Set(db.v22?.matches?.map(m=>m.id)||[]):null;
 const out=genderCommandBefore(action,id,data,backend);
 if(action==='matchCreate'&&!ids.has(out)){const m=v22Get('matches',out);m.gender=preference;}
 return out;
};
const genderMatchDetailBefore=v23MatchDetail;v23MatchDetail=function(m,u){return genderMatchDetailBefore(m,u).replace('<section class="v23-panel v23-match-progress">','<section class="v23-panel v23-match-progress"><p class="gender-condition">服务者性别条件：'+e(m.gender||'不限')+' · 发起时保存，后续按当前资料核对</p>');};
const genderProfileDialogBefore=feDialogView;feDialogView=function(){let html=genderProfileDialogBefore();if(FE.dialog?.type==='profile')html=html.replace('<div class="fe-form-actions">',genderField(genderOf(feMe()))+'<p class="fe-small">修改后同步到服务者、公会成员与推广会员资料。未填写不会出现在男 / 女筛选结果中。</p><div class="fe-form-actions">');return html;};
const genderRegisterBefore=FE_PAGES.register;FE_PAGES.register=function(){return genderRegisterBefore().replace('<details class="fe-auth-terms">',genderField()+'<details class="fe-auth-terms">');};
const genderApplyBefore=FE_PAGES.apply;FE_PAGES.apply=function(){const html=genderApplyBefore(),u=feAuthUser();return html.includes('data-fe-form="apply"')?html.replace('<h3>入驻资料（离线演示）</h3>','<h3>入驻资料（离线演示）</h3>'+genderField(genderOf(u))):html+feNotice('性别：'+genderOf(u)+'；可在“我的 → 编辑资料”更新，同步到原入驻与服务者资料。');};
const genderSubmitBefore=feSubmit;feSubmit=function(type,id,fd){
 if(type==='authRegister'){genderValue(fd.get('gender'));return genderPersist(()=>genderSubmitBefore(type,id,fd),true);}
 if(!['profile','apply'].includes(type)||!fd.has('gender'))return genderSubmitBefore(type,id,fd);
 const v=genderValue(fd.get('gender')),u=ops12Me();
 const out=genderPersist(()=>{u.gender=v;u.genderProfileVersion=1;const result=genderSubmitBefore(type,id,fd);genderRevalidate();return result;},true);
 feRender();return out;
};
const genderProviderPageBefore=FE_PAGES.provider;FE_PAGES.provider=function(){const p=getBy('providers',FE.id);return genderProviderPageBefore().replace('<h1>'+e(p?.name)+'</h1>','<h1>'+e(p?.name)+'</h1>'+genderBadge(p));};
const genderMineBefore=FE_PAGES.mine;FE_PAGES.mine=function(){let html=genderMineBefore();const u=feMe();return html.replace('<h1>'+e(v23Name(u))+'</h1>','<h1>'+e(v23Name(u))+'</h1>'+genderBadge(u)).replace('<h2>'+e(v23Name(u))+'</h2>','<h2>'+e(v23Name(u))+'</h2>'+genderBadge(u));};

// Shared admin list integration retains each caller's pre-scoped rows and pager.
const GENDER_TABLES=new Set(['users','providers','applications','skills','agents']);
function genderListRows(r,key,rows){const f=filters[r]||{};return rows.filter(x=>genderMatches(x,f.gender));}
function genderAdminTable(before,r,key,columns,options={}){
 if(!GENDER_TABLES.has(key)||options.genderPrepared)return before(r,key,columns,options);
 genderEnsure();const rows=genderListRows(r,key,options.rows||db[key]||[]),cs=[...columns];
 if(!cs.some(c=>c[0]==='性别'||c[0]==='性别（自愿填写）'))cs.splice(1,0,['性别',x=>genderBadge(x)]);
 const html=before(r,key,cs,{...options,rows,genderPrepared:true});
 return html.replace('<div class="table-filter">','<div class="table-filter"><label class="gender-admin-select">性别<select data-filter="gender" data-table="'+e(r)+'" aria-label="筛选性别">'+genderOptions(filters[r]?.gender||'')+'</select></label>');
}
const genderTableBefore=table;table=function(r,key,columns,options={}){return genderAdminTable(genderTableBefore,r,key,columns,options);};
const genderStationTableBefore=stationTable;stationTable=function(r,key,columns,options={}){return genderAdminTable(genderStationTableBefore,r,key,columns,options);};
const genderEnrichedBefore=enriched;enriched=function(kind,x){const out=genderEnrichedBefore(kind,x);if(GENDER_TABLES.has(kind))out.gender=genderOf(x);return out;};
const genderSchema=FIELD_SCHEMA.users.find(f=>f.key==='gender');Object.assign(genderSchema,{type:'select',source:'统一会员资料的自愿填写字段；选人、公会、推广与供给按当前资料联动。'});
for(const kind of ['providers','applications','skills','agents'])if(FIELD_SCHEMA[kind]&&!FIELD_SCHEMA[kind].some(f=>f.key==='gender'))FIELD_SCHEMA[kind].push({key:'gender',label:'性别',type:'select',group:'统一账号资料',editable:false,source:'读取关联会员当前资料；到会员管理或本人编辑资料维护。'});
const genderEditBefore=editField;editField=function(f,v){return f.key==='gender'?formField('f_gender',f.label,GENDER_VALUES.includes(v)?v:'其他', 'select',false,'与所有关联身份同步，可选择未填写。',GENDER_VALUES.map(v=>[v,v])):genderEditBefore(f,v);};
const genderV2CommitBefore=v2Commit;v2Commit=function(action,id,type,fd){
 if(action!=='v2Edit'||type!=='users')return genderV2CommitBefore(action,id,type,fd);
 admin19Require(true);demand(checkObjectAccess('users',id),'无会员资料编辑权限');genderValue(fd.get('f_gender'));
 return genderPersist(()=>{const out=genderV2CommitBefore(action,id,type,fd);getBy('users',id).genderProfileVersion=1;genderRevalidate();return out;});
};
const genderV4CommitBefore=v4Commit;v4Commit=function(action,id,type,fd){
 if(action!=='v4CreateMember')return genderV4CommitBefore(action,id,type,fd);
 admin19Require(true);const v=genderValue(fd.get('gender')),ids=new Set(db.users.map(u=>u.id));
 return genderPersist(()=>{const out=genderV4CommitBefore(action,id,type,fd),u=db.users.find(u=>!ids.has(u.id));demand(u,'原会员创建流程未完成');u.gender=v;u.genderProfileVersion=1;return out;});
};
const genderActionBefore=handleAction;handleAction=function(action,id='',type=''){
 if(action==='v4ExportSites'){
  try{const rows=v4SiteExportRows(id,type);v4ExportCsv([['对象编号','名称','性别','账号','站点编号','站点代码','站点名称','最初注册站点','状态'],...rows.map(x=>[x.id,x.name,genderOf(x),x.account,x.stationId,siteCode(x.stationId),siteLabel(x.stationId),x.registrationStationId,x.status])],(type==='users'?'会员':'代理')+'_站点性别筛选结果.csv');audit('导出站点性别筛选名录',type,'条数 '+rows.length+'；性别 '+(filters[id]?.gender||'不限'));save();return toast('已导出当前站点、性别及其他筛选范围。');}catch(err){return toast(err.message,'error');}
 }
 const out=genderActionBefore(action,id,type);
 if(action==='v4CreateMember'&&modalState?.action===action)document.querySelector('#actionForm .form-grid')?.insertAdjacentHTML('beforeend',formField('gender','性别（选填）','未填写','select',false,'普通演示会员资料，可选择未填写。',GENDER_VALUES.map(v=>[v,v])));
 return out;
};
const genderExportRowsBefore=v4SiteExportRows;v4SiteExportRows=function(r,kind){return genderListRows(r,kind,genderExportRowsBefore(r,kind));};

// MCN filters apply to people records, never to the guild's money or permissions.
function genderMcnPeople(xs,scope){return xs.filter(x=>genderMatches(x,GENDER[scope]));}
const genderMcnFilteredBefore=mcnFiltered;mcnFiltered=function(xs){const rows=genderMcnFilteredBefore(xs);if(FE.mode!=='admin')return rows;if(route==='mcnGuilds')return rows.filter(x=>!x.provider&&!x.user||genderMatches(x,GENDER.mcnGuilds));if(route==='mcnPromotions')return genderMcnPeople(rows,'mcnPromotions');return rows;};
const genderMcnHeaderBefore=mcnBackHeader;mcnBackHeader=function(key){const html=genderMcnHeaderBefore(key);if(!['mcnGuilds','mcnPromotions'].includes(key))return html;return html.replace('</form>','</form>'+genderQuery(key,key==='mcnGuilds'?'签约服务者 / 招募会员性别':'推广人 / 直推会员性别'));};
function genderDistribution(users){const ids=[...new Set(users.map(x=>genderUser(x)?.id).filter(Boolean))],total=ids.length;return GENDER_VALUES.map(v=>{const n=ids.filter(id=>genderOf(id)===v).length;return [e(v),String(n),String(total),total?(n*100/total).toFixed(1)+'%':'—'];});}
function genderReportPanel(title,users,note,backend=true){const rows=genderDistribution(users);return (backend?mcnPanel:v22Panel)(title,(backend?mcnTable:v22Table)(['性别','人数','分母','占比'],rows)+'<p class="fe-small">'+e(note)+' 按当前会员资料、统一账号去重；未填写单列，0 分母显示 —。修改资料会改变当前分布，不回写历史成交快照。</p>');}
const genderAnalyticsBefore=v22AnalyticsPage;v22AnalyticsPage=function(){const html=genderAnalyticsBefore(),ps=v22Rows('profiles').map(m=>v22Provider(m.provider));return html+v22Back(genderReportPanel('服务者性别分布（当前供给快照）',ps,'沿用当前获准站点范围，包含预置示例与本地新增服务者；不受事件日期筛选影响。',false));};
PAGE.v22Analytics=()=>v22AnalyticsPage();
const genderReportsBefore=mcnReportsBack;mcnReportsBack=function(){const html=genderReportsBefore(),guilds=mcnRows('guilds'),ids=new Set(guilds.map(g=>g.id)),members=mcnDB().contracts.filter(c=>ids.has(c.guild)&&['已生效','离会待审'].includes(c.status)).map(c=>c.provider),refs=mcnFiltered(mcnRows('referrals')).filter(r=>r.source==='local');const panels=genderReportPanel('公会成员性别分布（当前签约快照）',members,'获准站点内当前生效及离会待审成员，包含预置示例与本地新增；不受记录日期筛选影响。')+genderReportPanel('直推会员性别分布（本地注册记录）',refs,'沿用站点、记录日期与关键词范围，只计实际新增归因会员；分母为该范围内直推会员人数。');const i=html.lastIndexOf('</div>');return i<0?html+panels:html.slice(0,i)+panels+html.slice(i);};
PAGE.mcnReports=()=>mcnReportsBack();
const genderOpsBefore=v22OpsPage;v22OpsPage=function(){const old=v22Rows;v22Rows=function(kind){const rows=old(kind);return kind==='profiles'?genderMcnPeople(rows,'supply'):rows;};try{return genderQuery('supply','在线供给性别')+genderOpsBefore();}finally{v22Rows=old;}};
PAGE.v22Ops=()=>v22OpsPage();
const genderQualityBefore=v22QualityPage;v22QualityPage=function(){const old=v22Rows;v22Rows=function(kind){const rows=old(kind);return kind==='materials'?genderMcnPeople(rows,'quality'):rows;};try{return genderQuery('quality','材料所属服务者性别')+genderQualityBefore();}finally{v22Rows=old;}};
PAGE.v22Quality=()=>v22QualityPage();
const genderSocialBefore=v22SocialPage;v22SocialPage=function(){const old=v22Rows;v22Rows=function(kind){const rows=old(kind);return kind==='matches'&&GENDER.matches?rows.filter(m=>m.gender===GENDER.matches):rows;};try{return genderQuery('matches','匹配记录的服务者性别条件')+genderSocialBefore();}finally{v22Rows=old;}};
PAGE.v22Social=()=>v22SocialPage();
const genderDetailBefore=renderDetail;renderDetail=function(){
 const out=genderDetailBefore(),d=drawerState;if(!d||d.tab!=='summary'||!checkObjectAccess(d.type,d.id))return out;
 const key={siteUsers:'users',siteProviders:'providers',siteAgents:'agents',siteOrders:'orders'}[d.type]||d.type,x=getBy(key,d.id),list=document.querySelector('#drawerRoot .drawer-body dl.kvs');
 if(GENDER_TABLES.has(key)&&x)list?.insertAdjacentHTML('beforeend',kv('性别（当前会员资料）',e(genderOf(x))));
 if(key==='orders'&&x)list?.insertAdjacentHTML('beforeend',kv('买方性别（当前资料）',e(genderOf(x.buyer)))+kv('服务者性别（当前资料）',e(genderOf(x.provider))));
 return out;
};
// Gender is a business profile/filter field; it grants no extra identity or trading rights.
const genderExplanation='会员自愿填写的当前性别：男、女、其他或未填写。服务者、公会成员、推广会员读取同一统一账号资料；新用户默认未填写。筛选不改变 VIP、站点、档期或资金权限，旧成交快照保留。';
for(const meta of Object.values(MCN_HELP))if(meta?.fields)meta.fields['性别']=genderExplanation;
const genderHelpBefore=mcnHelpMeta;mcnHelpMeta=function(key){
 const meta=genderHelpBefore(key),name=key.replace(/^(front|admin):/,'');
 if(!/home|discover|provider|apply|studio|mine|register|users|siteUsers|siteProviders|providers|application|skill|mcn|promotion|Following|Match|v22Ops|v22Quality|v22Analytics|agentTeam/i.test(name))return meta;
 return {...meta,links:[...new Set([...(meta.links||[]),'users','providers','mcnGuilds','mcnPromotions','v22Analytics','mcnReports'])],fields:{...meta.fields,'性别筛选':'不限不限制性别；男、女、其他、未填写按关联会员当前资料精确匹配。与原站点、状态、分类等条件同时生效。','匹配性别条件':'发起匹配时保存的服务者性别偏好；搜索、候选响应、选定和预约均重新核对。重复发起复用原进行中记录，不覆盖其条件。'},flow:meta.flow+' 性别联动：注册 / 我的编辑资料 / 会员管理 → 服务者资料 → 选人及匹配 → 公会成员、招募与推广查询。'};
};
const genderHelpPageBefore=FE_PAGES.help;FE_PAGES.help=function(){return genderHelpPageBefore()+v22Panel('性别资料与三端联动演示','<ol><li>我的 → 编辑资料，选择男、女、其他或未填写并保存；服务者、公会和推广身份共用该资料。</li><li>PC 发现左侧或 H5 更多筛选选择“服务者性别”，应用筛选；清空全部恢复所有允许结果。</li><li>VIP 在立即找人选择性别条件，搜索候选；切候选账号响应，再回发起人选定和预约。候选更改资料不符合条件后不可确认。</li><li>公会管理 → 成员与签约，分别筛选当前成员与本站可邀请用户。</li><li>运营后台会员、服务者、入驻、技能、在线供给、公会签约和会员推广筛选同一性别；公会报表按当前资料查看人数、分母和占比。</li></ol><p>性别可留空，选填不增加入驻、公会、推广或保证金门槛；匿名社区公开内容不附加作者性别。所有统计仍为本地演示。</p>');};
document.addEventListener('change',ev=>{const t=ev.target,scope=t.dataset?.genderQuery;if(!scope||!(scope in GENDER))return;try{GENDER[scope]=genderFilterValue(t.value);if(FE.mode==='admin')renderContent();else feRender();}catch(err){toast(err.message,'error');}});
document.addEventListener('click',ev=>{const b=ev.target.closest?.('[data-gender-clear]'),scope=b?.dataset.genderClear;if(!scope||!(scope in GENDER))return;ev.preventDefault();GENDER[scope]='';if(FE.mode==='admin')renderContent();else feRender();});
const genderClearBefore=admin19ClearContext;admin19ClearContext=function(){for(const k of Object.keys(GENDER))GENDER[k]='';return genderClearBefore();};
if(typeof FE_LOCALE_EN!=='undefined')Object.assign(FE_LOCALE_EN,{'男':'Male','女':'Female','其他':'Other','未填写':'Not specified','性别（选填）':'Gender (optional)','服务者性别':'Companion gender','性别筛选':'Gender filter','不限性别':'Any gender','未填写 / 不公开':'Not specified / private','重置性别':'Reset gender','按当前会员资料筛选':'Filter by current profile','性别：男':'Gender: Male','性别：女':'Gender: Female','性别：其他':'Gender: Other','性别：未填写':'Gender: Not specified'});
