const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP = '薪连薪每日推进';
const KEY_SERVICE = 'com.xinlianxin.dailyprogress';
const KEY_NAMES = ['deepseek','tavily','ingest'];

function baseDir(){ const d=path.join(app.getPath('applicationSupport'),APP); fs.mkdirSync(d,{recursive:true}); return d; }
function workspaceFile(){ return path.join(baseDir(),'workspace.json'); }
function monitorDir(){ const d=path.join(baseDir(),'monitor'); fs.mkdirSync(d,{recursive:true}); return d; }
function log(msg){ try{ fs.appendFileSync(path.join(baseDir(),'app.log'),`[${new Date().toISOString()}] ${msg}\n`); }catch{} }
function defaults(){ return {settings:{model:'deepseek-chat',baseUrl:'https://api.deepseek.com'},northStar:{voice:0,leads:0,opportunities:0,leadTarget:30},tasks:[],reviews:[],inbox:[],monitor:{lastRun:null,stats:{positive:0,neutral:0,negative:0,total:0}}}; }
function load(){ try{ const p=workspaceFile(); if(!fs.existsSync(p)) return defaults(); const d=JSON.parse(fs.readFileSync(p,'utf8')); return {...defaults(),...d,settings:{...defaults().settings,...(d.settings||{})},northStar:{...defaults().northStar,...(d.northStar||{})}}; }catch(e){ log('load '+e.stack); return defaults(); } }
function save(data){ const safe=JSON.parse(JSON.stringify(data||{})); if(safe.keys) delete safe.keys; fs.writeFileSync(workspaceFile(),JSON.stringify(safe,null,2)); return true; }
function keyAccount(name){ return `xlx-${name}`; }
function getKey(name){ if(process.platform!=='darwin') return ''; try{return execFileSync('/usr/bin/security',['find-generic-password','-s',KEY_SERVICE,'-a',keyAccount(name),'-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return '';} }
function setKey(name,value){ if(!KEY_NAMES.includes(name)) throw new Error('未知密钥类型'); if(process.platform!=='darwin') return false; if(!value){try{execFileSync('/usr/bin/security',['delete-generic-password','-s',KEY_SERVICE,'-a',keyAccount(name)],{stdio:'ignore'});}catch{} return true;} execFileSync('/usr/bin/security',['add-generic-password','-U','-s',KEY_SERVICE,'-a',keyAccount(name),'-w',value],{stdio:'ignore'}); return true; }

async function deepseek(messages, opts={}){
  const key=getKey('deepseek'); if(!key) throw new Error('请先在设置中保存 DeepSeek API Key');
  const d=load(); const base=(d.settings.baseUrl||'https://api.deepseek.com').replace(/\/$/,'');
  const r=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:d.settings.model||'deepseek-chat',temperature:opts.temperature??0.2,response_format:opts.json?{type:'json_object'}:undefined,messages})});
  const raw=await r.text(); if(!r.ok) throw new Error(`DeepSeek HTTP ${r.status}: ${raw.slice(0,300)}`);
  const obj=JSON.parse(raw); return obj.choices?.[0]?.message?.content||'';
}

async function planWork(payload){
  const text=(payload?.text||'').trim(); if(!text) throw new Error('请输入会议纪要、业务描述或领导安排');
  const sys='你是薪连薪品宣负责人的增长执行助手。只围绕品牌有效声量、有效企业线索、业务机会。负责人只做定目标、做判断、看数据、促协同；排版、剪辑、发布、投流账户执行优先委派。只输出JSON。';
  const user=`输入类型：${payload.type||'业务输入'}\n原文：${text}\n输出JSON：{"summary":"核心判断","goal":"增长目标","top3":[{"title":"今日关键结果","metric":"验收标准"}],"tasks":[{"title":"任务","result":"结果","owner":"我|兼职编辑|兼职品宣|兼职投流|AI","priority":"S|A|B","track":"声量|有效线索|业务机会|协同","due":"今天|明天|本周|具体日期","estimate":60,"action":"动作","metric":"验收"}],"stop":["应停止事项"],"risks":["风险"]}`;
  const c=await deepseek([{role:'system',content:sys},{role:'user',content:user}],{json:true});
  return JSON.parse(c.replace(/^```json\s*/i,'').replace(/```$/,'').trim());
}

const GROUPS = {
  品牌词:['北京薪连薪科技有限公司','薪连薪 灵活用工','薪连薪 平台经济','薪连薪 企业合规'],
  品牌风险:['薪连薪 投诉 纠纷','薪连薪 诈骗 跑路 被骗','薪连薪 税务风险 不合规','薪连薪 处罚 调查 黑猫投诉'],
  行业:['灵活用工平台 最新','灵活用工合规 最新','平台经济合规治理 最新','灵活用工 行业趋势'],
  政策:['灵活用工 政策 监管 税务 最新','互联网平台 涉税信息报送 最新','平台经济 税务 监管 最新','灵活用工 委托代征 最新'],
  竞品:['云账户 灵活用工 最新','青团社 灵活用工 最新','用友薪福社 最新','趣活 灵活用工 最新']
};
const BLOCK=['心连薪','连薪无忧','新连薪'];
async function tavilySearch(query){
  const key=getKey('tavily'); if(!key) throw new Error('请先在设置中保存 Tavily API Key');
  const r=await fetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,query,search_depth:'advanced',max_results:6,include_answer:false})});
  const raw=await r.text(); if(!r.ok) throw new Error(`Tavily HTTP ${r.status}: ${raw.slice(0,240)}`); const o=JSON.parse(raw); return o.results||[];
}
function knownUrls(){ const p=path.join(monitorDir(),'known_urls.json'); try{return new Set(JSON.parse(fs.readFileSync(p,'utf8')))}catch{return new Set();} }
function saveKnown(s){ fs.writeFileSync(path.join(monitorDir(),'known_urls.json'),JSON.stringify([...s],null,2)); }
function escCsv(v){ const s=String(v??'').replace(/"/g,'""'); return `"${s}"`; }
function riskLevel(items){ if(items.some(x=>x.category==='negative'&&x.involves_brand&&x.risk==='高')) return '高'; if(items.some(x=>x.category==='negative'&&x.involves_brand)) return '中'; return '低'; }
async function classify(items){ if(!items.length) return []; const compact=items.slice(0,80).map((x,i)=>({i,title:x.title,url:x.url,content:(x.content||'').slice(0,500),source:x.source,group:x.group}));
  const prompt=`按薪连薪舆情规则分类。硬规则：负面关键词命中不等于薪连薪自身风险；必须判断主体。排除同名干扰：心连薪、连薪无忧、新连薪。未经证实标待核实。输出JSON对象 {"items":[{"i":0,"category":"positive|neutral|negative","involves_brand":true,"industry_risk":false,"risk":"低|中|高","verified":false,"summary":"摘要","impact":"影响"}] }。输入：${JSON.stringify(compact)}`;
  try{ const c=await deepseek([{role:'system',content:'你是企业舆情分析员，只输出JSON。'},{role:'user',content:prompt}],{json:true}); const o=JSON.parse(c.replace(/^```json\s*/i,'').replace(/```$/,'').trim()); const map=new Map((o.items||[]).map(x=>[x.i,x])); return items.map((x,i)=>({...x,...(map.get(i)||{category:'neutral',involves_brand:false,industry_risk:true,risk:'低',verified:false,summary:x.content?.slice(0,120)||'',impact:'待人工复核'})})); }catch(e){ log('classify '+e.stack); return items.map(x=>({...x,category:'neutral',involves_brand:false,industry_risk:true,risk:'低',verified:false,summary:(x.content||'').slice(0,120),impact:'AI分类失败，待核实'})); }
}
async function runMonitor(){
  const seen=knownUrls(); const found=[]; let queries=0;
  for(const [group,qs] of Object.entries(GROUPS)) for(const q of qs){ queries++; const rs=await tavilySearch(q); for(const r of rs){ const url=(r.url||'').trim(); const title=r.title||''; if(!url||seen.has(url)||BLOCK.some(k=>title.includes(k))) continue; seen.add(url); found.push({group,query:q,title,url,source:new URL(url).hostname,content:r.content||'',publish_time:r.published_date||'',publisher:'',keywords:q}); } }
  const items=await classify(found); const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}); const stats={positive:items.filter(x=>x.category==='positive').length,neutral:items.filter(x=>x.category==='neutral').length,negative:items.filter(x=>x.category==='negative').length,total:items.length,brandNegative:items.filter(x=>x.category==='negative'&&x.involves_brand).length}; const risk=riskLevel(items);
  const out={date,round:'5路×4组',queries,stats,overallRisk:risk,items}; const d=monitorDir(); fs.writeFileSync(path.join(d,`${date}.json`),JSON.stringify(out,null,2));
  const csv=path.join(d,'舆情台账.csv'); if(!fs.existsSync(csv)) fs.writeFileSync(csv,'\ufeff采集日期,标题,发布时间,来源平台,原文链接,舆情分类,子类,涉及薪连薪,风险等级,核实状态,内容摘要,后续处理状态\n'); for(const x of items) fs.appendFileSync(csv,[date,x.title,x.publish_time,x.source,x.url,x.category,x.group,x.involves_brand?'是':'否',x.risk,x.verified?'已核实':'待核实',x.summary,'待跟进'].map(escCsv).join(',')+'\n');
  const top=items.filter(x=>x.involves_brand||x.category==='negative').slice(0,3); const report=`# 薪连薪每日舆情监控报告 ${date}\n\n## 今日舆情总览\n新增 ${stats.total} 条；正面 ${stats.positive}，中性 ${stats.neutral}，负面 ${stats.negative}；品牌负面 ${stats.brandNegative}；整体风险 ${risk}\n\n## 重点舆情摘要\n${top.length?top.map((x,i)=>`${i+1}. ${x.title}｜${x.source}｜${x.category}｜${x.verified?'已核实':'待核实'}\n   ${x.summary}\n   ${x.url}`).join('\n'):'暂无需重点上报的品牌风险条目'}\n\n## 品牌风险监测\n${stats.brandNegative?'存在品牌负面候选，需优先人工核实原文与主体':'未发现明确薪连薪自身高风险事项'}\n\n## 行业动态观察\n本轮覆盖品牌、品牌风险、行业、政策、竞品五路检索\n\n## 品牌建设建议\n1. 对高权重媒体与政策源持续补齐权威内容资产\n2. 对榜单长期缺席与品牌搜索可见性建立月度追踪\n3. 负面候选必须先核实主体再进入处置流程\n\n## 数据沉淀说明\n已同步生成 JSON 与 UTF-8-SIG CSV 台账\n`; fs.writeFileSync(path.join(d,`薪连薪每日舆情监控报告-${date}.md`),report); saveKnown(seen);
  const data=load(); data.monitor={lastRun:new Date().toISOString(),stats,risk,reportPath:path.join(d,`薪连薪每日舆情监控报告-${date}.md`)}; save(data);
  const ingest=getKey('ingest'); if(ingest){ try{ await fetch('https://tqvm5d6m.qwenwork.host/api/ingest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:ingest,report:{report_date:date,total_count:stats.total,positive_count:stats.positive,neutral_count:stats.neutral,negative_count:stats.negative,risk_level:risk,trend:stats.brandNegative?'存在风险':'平稳',overview:`新增${stats.total}条`,industry_summary:'五路监测完成',suggestions:['核实品牌负面候选','补充权威内容资产']},items:items.map(x=>({report_date:date,title:x.title,source:x.source,publish_time:x.publish_time,url:x.url,publisher:x.publisher,keywords:x.keywords,summary:x.summary,involves_brand:x.involves_brand,involves_industry_risk:x.industry_risk,category:x.category,impact:x.impact,verified:x.verified,featured:top.some(t=>t.url===x.url),status:'待跟进'})),alerts:[]})}); }catch(e){ log('ingest '+e.stack); } }
  return {...out,reportPath:path.join(d,`薪连薪每日舆情监控报告-${date}.md`)};
}

function createWindow(){ const win=new BrowserWindow({width:1500,height:960,minWidth:980,minHeight:700,title:APP,backgroundColor:'#0b1020',titleBarStyle:'hiddenInset',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false}}); win.loadFile(path.join(__dirname,'index.html')); win.webContents.on('did-fail-load',(_,c,d)=>log(`load fail ${c} ${d}`)); }

ipcMain.handle('data:load',()=>load());
ipcMain.handle('data:save',(_,d)=>save(d));
ipcMain.handle('key:get',(_,n)=>getKey(n));
ipcMain.handle('key:set',(_,n,v)=>setKey(n,v));
ipcMain.handle('ai:plan',(_,p)=>planWork(p));
ipcMain.handle('monitor:run',()=>runMonitor());
ipcMain.handle('path:open',(_,p)=>shell.openPath(p));
app.whenReady().then(()=>{createWindow(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0) createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin') app.quit();});
process.on('uncaughtException',e=>log(e.stack||e));
process.on('unhandledRejection',e=>log(e?.stack||e));
