import { esc, IC, isym } from './core/icons.js';
import {
  SCORE_MODES,
  NEG_MODES,
  THEMES,
  fmtTime,
  fmtPct,
  fmtPts,
  modeShort,
  negShort,
  scoreExamQ,
  calcGrade
} from './core/scoring.js';
import {
  KINDS,
  PROMPT,
  GPROMPT,
  norm,
  cleanJson,
  parseSets,
  extractGloss,
  parseGloss,
  promptFor,
  gpromptFor
} from './core/parser.js';
import {
  jj,
  qk,
  sk,
  gk,
  m3,
  mergeSets3Way,
  mergeGloss3Way
} from './core/merge.js';
import { computeTerms } from './core/glossary.js';
import {
  updateSrs,
  isScheduledDue,
  collectDueQuestions,
  formatRelativeDue
} from './core/srs.js';
import {
  buildExamAttempt,
  mergeAttempts,
  summarizeHistory,
  weakestChapters
} from './core/history.js';
import { supabase } from './sync/supabaseClient.js';
import { fetchSupabaseState, pushSupabaseState } from './sync/supabaseSync.js';

const $app=document.getElementById('app');
(()=>{const d=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML'),key=e=>e.id||e.dataset.act||e.dataset.chg||e.dataset.chk||e.getAttribute('onclick')||e.getAttribute('onchange')||e.getAttribute('aria-label')||e.getAttribute('title')||'';
Object.defineProperty($app,'innerHTML',{get(){return d.get.call(this)},set(h){const a=document.activeElement;let k='',n=0,t='';
if(a&&a!==document.body&&this.contains(a)&&!/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){t=a.tagName;k=key(a);if(k)n=[...this.querySelectorAll(t)].filter(x=>key(x)===k).indexOf(a)}
d.set.call(this,h);syncHist();
if(k){const c=[...this.querySelectorAll(t)].filter(x=>key(x)===k)[n];if(c&&!c.disabled)c.focus({preventScroll:true})}}})})();
(()=>{const si=Storage.prototype.setItem;let shown=0;Storage.prototype.setItem=function(k,v){try{return si.call(this,k,v)}catch(e){if(!shown){shown=1;const b=document.createElement('div');b.setAttribute('role','alert');b.style.cssText='position:fixed;left:12px;right:12px;top:12px;z-index:99;padding:12px 14px;border-radius:8px;background:var(--badbg);color:var(--bad);border:1px solid var(--bad);font-weight:700';b.textContent='Speichern fehlgeschlagen (Speicher voll?). Bitte jetzt exportieren, sonst gehen Änderungen verloren.';b.onclick=()=>b.remove();document.body.appendChild(b)}throw e}}})();
let exp=new Set(),pq=null,col=new Set(),gcol=new Set(),pend=null,rpend=null,cpend=null,crpend=null,gcpend=null,gloss=[],courses={},cnames=[],gcnames=[],gen={name:'',f:['single','multi','tf']},sets=[],sel=new Set(),opts={n:20,shuffle:true,hideMastered:true,mastery:3,theme:'auto',examMins:30,pass:50,scoreMode:'all',negMode:'none',cpass:{},ctime:{},cqcount:{},cmode:{},cneg:{},corder:[]},Q=[],idx=0,picked=new Set(),checked=false,log=[],msg='';
let cedit=null,cdraft='',cpdraft=50,ctdraft=30,cqdraft=20,cmdraft='all',cndraft='none',cerr='',gcedit=null,gcdraft='',gcerr='',sedit=null,sdraft=null,serr='',qedit=null,qdraft=null,qerr='',curView='q';
let examMode=false,examPicks=[],examMarks=new Set(),examEnd=0,examStart=0,examElapsed=0,examTimer=null,examSubPend=false,examExitPend=false,examTimeUp=false,examCourse='',examDurMins=30;
let gh={token:'',user:'',sha:'',lastSync:0},localTs=0,syncState='idle',syncErr='',syncTimer=null,forceOverwrite=false;
let sbUser=null,sbLastSync=0,sbState='idle',sbErr='',sbMsg='',sbAuthMode='login',sbTimer=null,sbDirty=false,sbLastPull=0,sbBusy=false;
let examHistory=[],statsCourse='',histExp=new Set(),histDelPend=null;
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const toTop=()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0};
const stopExamTimer=()=>{if(examTimer){clearInterval(examTimer);examTimer=null}try{localStorage.removeItem('pt:exam')}catch(e){}};
function saveExam(){if(!examMode)return;try{localStorage.setItem('pt:exam',JSON.stringify({c:examCourse,m:examDurMins,s:examStart,e:examEnd,i:idx,mk:[...examMarks],p:examPicks.map(x=>[...x]),q:Q.map(q=>{const r=q._ref,st=sets.find(x=>x.qs.includes(r));return st?{s:st.id,i:st.qs.indexOf(r),o:q.opts.map(o=>r.opts.findIndex(x=>x.t===o.t))}:null})}))}catch(e){}}
const readExam=()=>{try{return JSON.parse(localStorage.getItem('pt:exam')||'null')}catch(e){return null}};
function resumeExam(x){try{
  const qs=x.q.map(r=>{if(!r)throw 0;const st=sets.find(y=>y.id===r.s),ref=st&&st.qs[r.i];if(!ref)throw 0;const os=r.o.map(j=>ref.opts[j]);if(os.some(o=>!o))throw 0;return{...ref,_ref:ref,_course:st.course,_title:st.title,_newlyMastered:false,opts:os}});
  stopExamTimer();Q=qs;examMode=true;idx=x.i;log=[];examPicks=x.p.map(a=>new Set(a));examMarks=new Set(x.mk);examSubPend=examExitPend=examTimeUp=false;checked=false;examCourse=x.c;examDurMins=x.m;examStart=x.s;examEnd=x.e;
  examTimer=setInterval(tickExam,1000);quiz();saveExam();
}catch(e){try{localStorage.removeItem('pt:exam')}catch(_){}}}
const getQuizCount=()=>Math.max(1,+opts.n||20);
const getPass=c=>(c&&opts.cpass&&[50,60,70].includes(+opts.cpass[c]))?+opts.cpass[c]:([50,60,70].includes(+opts.pass)?+opts.pass:50);
const getExamMins=c=>(c&&opts.ctime&&+opts.ctime[c]>0)?Math.max(1,+opts.ctime[c]):(Math.max(1,+opts.examMins||30));
const getExamCount=c=>(c&&opts.cqcount&&+opts.cqcount[c]>0)?Math.max(1,+opts.cqcount[c]):20;
const getScoreMode=c=>(c&&opts.cmode&&SCORE_MODES.includes(opts.cmode[c]))?opts.cmode[c]:(SCORE_MODES.includes(opts.scoreMode)?opts.scoreMode:'all');
const getNegMode=c=>(c&&opts.cneg&&NEG_MODES.includes(opts.cneg[c]))?opts.cneg[c]:(NEG_MODES.includes(opts.negMode)?opts.negMode:'none');
const courseHasMulti=c=>sets.some(s=>s.course===c&&s.qs.some(q=>q.type==='multi'));
function syncSetCfg(s){
  if(!s||!s.course)return;
  const c=s.course;
  s.cfg={fragenAnzahl:getExamCount(c),zeitMinuten:getExamMins(c),positivAb:getPass(c),mcWertung:getScoreMode(c),minuspunkte:getNegMode(c)};
}
function syncCourseCfg(c){
  sets.forEach(s=>{if(!c||s.course===c)syncSetCfg(s)});
  try{localStorage.setItem('pt:sets',JSON.stringify(sets))}catch(e){}
}
function applyTheme(){
  const t=THEMES.includes(opts.theme)?opts.theme:'auto',de=document.documentElement;
  if(!de||!de.setAttribute)return;
  if(t==='light'||t==='dark')de.setAttribute('data-theme',t);
  else de.removeAttribute('data-theme');
}
function setQuizCount(v){opts.n=Math.max(1,Math.min(500,parseInt(v,10)||20));saveO();if(curView==='s')settingsView()}
function setMastery(v){opts.mastery=Math.max(1,Math.min(10,parseInt(v,10)||3));saveO();if(curView==='s')settingsView()}
function setHideMastered(v){opts.hideMastered=!!v;saveO();if(curView==='s')settingsView()}
function setAutoCheck(v){opts.autoCheck=!!v;saveO();if(curView==='s')settingsView()}
function setShuffle(v){opts.shuffle=!!v;saveO();if(curView==='s')settingsView()}
function setTheme(v){opts.theme=THEMES.includes(v)?v:'auto';applyTheme();saveO();if(curView==='s')settingsView()}
function selCourses(){const cs=new Set();sets.forEach(s=>{if(sel.has(s.id))cs.add(s.course)});return[...cs]}
function isGSel(c){return !!c&&selCourses().some(x=>norm(x)===norm(c))}
function enforceSingleCourse(pref){
  const cs=selCourses();
  if(cs.length<=1)return;
  const keep=(pref&&cs.includes(pref))?pref:cs[0];
  sets.forEach(s=>{if(s.course!==keep)sel.delete(s.id)});
  saveSel();
}
function activePass(){const cs=selCourses();return cs.length===1?getPass(cs[0]):getPass('')}
function activeTime(){const cs=selCourses();return cs.length===1?getExamMins(cs[0]):getExamMins('')}
function activeCount(){const cs=selCourses();return cs.length===1?getExamCount(cs[0]):getExamCount('')}
function activeScoreMode(){const cs=selCourses();return cs.length===1?getScoreMode(cs[0]):getScoreMode('')}
function activeNegMode(){const cs=selCourses();return cs.length===1?getNegMode(cs[0]):getNegMode('')}
const CFG_MAPS=['cpass','ctime','cqcount','cmode','cneg'];
function ensureCfgMaps(){CFG_MAPS.forEach(k=>{if(!opts[k]||typeof opts[k]!=='object')opts[k]={}})}
function setActiveCfg(map,single,val,crs){ensureCfgMaps();if(crs){opts[map][crs]=val;syncCourseCfg(crs)}else{opts[single]=val;selCourses().forEach(c=>{opts[map][c]=val;syncCourseCfg(c)})}saveO(true)}
function setActivePass(v,crs){setActiveCfg('cpass','pass',[50,60,70].includes(+v)?+v:50,crs)}
function setActiveScoreMode(v,crs){setActiveCfg('cmode','scoreMode',SCORE_MODES.includes(v)?v:'all',crs)}
function setActiveNegMode(v,crs){setActiveCfg('cneg','negMode',NEG_MODES.includes(v)?v:'none',crs)}
function allCourses(){
  const out=[];
  Object.keys(courses).forEach(c=>{if(c&&!out.includes(c))out.push(c)});
  sets.forEach(s=>{if(s.course&&!out.includes(s.course))out.push(s.course)});
  gloss.forEach(g=>{if(g.course&&!out.includes(g.course))out.push(g.course)});
  return out;
}
function normGloss(){
  const sCourses=[...new Set(sets.map(s=>s.course).filter(Boolean))];
  const defC=sCourses.length===1?sCourses[0]:'Ohne Kurs';
  if(!Array.isArray(gloss)){gloss=[];return}
  gloss=gloss.filter(g=>g&&(g.b||g.begriff)&&(g.i||g.info)).map(g=>({
    course:String(g.course||g.kurs||defC).trim()||'Ohne Kurs',
    b:String(g.b||g.begriff).trim(),
    i:String(g.i||g.info).trim(),
    a:Array.isArray(g.a||g.alias)?(g.a||g.alias).map(x=>String(x).trim()).filter(Boolean):[]
  }));
}
function load(){
  try{sets=JSON.parse(localStorage.getItem('pt:sets')||'[]')}catch(e){sets=[]}
  try{courses=JSON.parse(localStorage.getItem('pt:courses')||'{}')}catch(e){courses={}}
  try{gloss=JSON.parse(localStorage.getItem('pt:gloss')||'[]')}catch(e){gloss=[]}
  normGloss();
  try{col=new Set(JSON.parse(localStorage.getItem('pt:col')||'[]'))}catch(e){col=new Set()}
  try{gcol=new Set(JSON.parse(localStorage.getItem('pt:gcol')||'[]'))}catch(e){gcol=new Set()}
  try{exp=new Set(JSON.parse(localStorage.getItem('pt:exp')||'[]'))}catch(e){exp=new Set()}
  try{
    const rawSel=localStorage.getItem('pt:sel');
    if(rawSel!==null){
      const arr=JSON.parse(rawSel);
      sel=new Set(Array.isArray(arr)?arr.filter(id=>sets.some(s=>s.id===id)):[]);
    }else{
      sel=new Set(sets.map(s=>s.id));
    }
  }catch(e){
    sel=new Set(sets.map(s=>s.id));
  }
  enforceSingleCourse();
  exp=new Set([...exp].filter(id=>sets.some(s=>s.id===id)));
  try{const o=JSON.parse(localStorage.getItem('pt:opts')||'null');if(o&&typeof o==='object')opts={...opts,...o,n:Math.max(1,+o.n||20),examMins:Math.max(1,+o.examMins||30),pass:[50,60,70].includes(+o.pass)?+o.pass:50,scoreMode:SCORE_MODES.includes(o.scoreMode)?o.scoreMode:'all',negMode:NEG_MODES.includes(o.negMode)?o.negMode:'none',cpass:(o.cpass&&typeof o.cpass==='object')?o.cpass:{},ctime:(o.ctime&&typeof o.ctime==='object')?o.ctime:{},cqcount:(o.cqcount&&typeof o.cqcount==='object')?o.cqcount:{},cmode:(o.cmode&&typeof o.cmode==='object')?o.cmode:{},cneg:(o.cneg&&typeof o.cneg==='object')?o.cneg:{},corder:Array.isArray(o.corder)?o.corder.filter(Boolean):[],shuffle:o.shuffle!==false,hideMastered:o.hideMastered!==false,mastery:Math.max(1,Math.min(10,+o.mastery||3)),theme:THEMES.includes(o.theme)?o.theme:'auto'}}catch(e){}
  applyTheme();
  try{localTs=+localStorage.getItem('pt:ts')||0}catch(e){localTs=0}
  try{const g=JSON.parse(localStorage.getItem('pt:gh')||'null');if(g&&typeof g==='object')gh={...gh,...g}}catch(e){}
  try{const h=JSON.parse(localStorage.getItem('pt:exams')||'[]');examHistory=Array.isArray(h)?h:[]}catch(e){examHistory=[]}
}
function saveGH(){try{localStorage.setItem('pt:gh',JSON.stringify(gh))}catch(e){}}
function saveHistory(ow){try{localStorage.setItem('pt:exams',JSON.stringify(examHistory))}catch(e){}touchLocal(ow)}
let syncDirty=false,lastPull=0;
function touchLocal(overwrite){syncDirty=true;sbDirty=true;
  localTs=Date.now();
  if(overwrite)forceOverwrite=true;
  try{localStorage.setItem('pt:ts',String(localTs))}catch(e){}
  if(sbUser){clearTimeout(sbTimer);sbTimer=setTimeout(()=>pushSupabaseNow(),3000)}
  if(gh.token){clearTimeout(syncTimer);syncTimer=setTimeout(()=>pushCloudNow(),15000)}
}
function saveO(ow){try{localStorage.setItem('pt:opts',JSON.stringify(opts))}catch(e){}touchLocal(ow!==false)}
function saveC(){try{localStorage.setItem('pt:courses',JSON.stringify(courses))}catch(e){}touchLocal()}
function saveCol(){try{localStorage.setItem('pt:col',JSON.stringify([...col]))}catch(e){}touchLocal()}
function saveGCol(){try{localStorage.setItem('pt:gcol',JSON.stringify([...gcol]))}catch(e){}}
function saveSel(){try{localStorage.setItem('pt:sel',JSON.stringify([...sel]))}catch(e){}}
function saveExp(){try{localStorage.setItem('pt:exp',JSON.stringify([...exp]))}catch(e){}}
function saveGloss(ow){termsCache=new WeakMap();try{localStorage.setItem('pt:gloss',JSON.stringify(gloss))}catch(e){}touchLocal(ow)}
function save(ow){termsCache=new WeakMap();try{localStorage.setItem('pt:sets',JSON.stringify(sets))}catch(e){}touchLocal(ow)}

const isMastered=q=>(q.streak||0)>=opts.mastery;
const qWeight=q=>{
  if(isScheduledDue(q))return q.wrong?8:5;
  if(isMastered(q))return opts.hideMastered?0:1;
  const st=q.streak||0;
  if(st===0)return q.wrong?6:4;
  if(st===1)return 2;
  return 1;
};
const pool1=s=>opts.hideMastered?s.qs.filter(q=>!isMastered(q)):s.qs;
const masteredInSet=s=>s.qs.filter(isMastered).length;
const hasAnyProgress=()=>sets.some(s=>s.qs.some(q=>(q.streak||0)>0||q.wrong));

function qBadge(sid,qi,q){
  const st=q.streak||0,m=isMastered(q);
  const srsHint=q.srs&&Number.isFinite(q.srs.nextReview)?` · Wiederholung: ${formatRelativeDue(q.srs.nextReview)}`:'';
  if(m)return `<button class="badge ok" aria-label="Gemeistert, Klicken zum Zurücksetzen" title="Gemeistert (${st}× richtig in Folge${srsHint}) – Klicken zum Zurücksetzen" data-act="togMastery" data-args="${esc(JSON.stringify([String(sid),qi]))}">✓ Gemeistert (${st})</button>`;
  const dots='●'.repeat(Math.min(st,opts.mastery))+'○'.repeat(Math.max(0,opts.mastery-st));
  return `<button class="badge${q.wrong?' bad':''}" aria-label="Lernstand ${st} von ${opts.mastery}" title="${q.wrong?'Zuletzt falsch – ':''}Lernstand ${st}/${opts.mastery}${srsHint} (Klicken um als gemeistert zu markieren)" data-act="togMastery" data-args="${esc(JSON.stringify([String(sid),qi]))}">${dots}</button>`;
}

function togMastery(sid,qi){
  const s=sets.find(x=>x.id===sid);if(!s||!s.qs[qi])return;
  const q=s.qs[qi];
  if(isMastered(q)){q.streak=0;q.wrong=false}else{if(!okFlag){appDialog('Frage als gemeistert markieren? Sie wird beim Üben dann ausgeblendet.',()=>{okFlag=true;try{togMastery(sid,qi)}finally{okFlag=false}});return}q.streak=opts.mastery;q.wrong=false}
  save();home();
}

function togFlag(sid,qi,stay){
  const s=sets.find(x=>x.id===sid);if(!s||!s.qs[qi])return;
  s.qs[qi].flagged=!s.qs[qi].flagged;
  save(true);if(!stay)curView==='r'?result():home();
}
function togQuizFlag(){
  const q=Q[idx],src=q&&(q._ref||q);if(!src)return;
  src.flagged=!src.flagged;q.flagged=src.flagged;
  save(true);quiz();
}
function flaggedAll(){
  const out=[];
  sets.forEach(s=>s.qs.forEach((q,qi)=>{if(q.flagged)out.push([s,q,qi])}));
  return out;
}
function flaggedHtml(){
  const fl=flaggedAll();if(!fl.length)return '';
  return `<div class="card fbox" style="margin:12px 0;border-color:var(--warn)"><div class="row" style="justify-content:space-between;margin-bottom:4px"><b style="color:var(--warn);display:inline-flex;align-items:center;gap:6px">${IC.flag} Zum Bearbeiten markiert (${fl.length})</b></div>${fl.map(([s,q,qi])=>`<div class="qi"><button class="lnk" data-act="goQEdit" data-args="${esc(JSON.stringify([String(s.id),qi]))}"><span class="mut">${esc(s.course)} › ${esc(s.title)}</span><br>${esc(q.q)}</button><span class="gc"><button class="btn sec sm" data-act="goQEdit" data-args="${esc(JSON.stringify([String(s.id),qi]))}">Bearbeiten</button><button class="x warn" title="Markierung aufheben" aria-label="Markierung aufheben" data-act="togFlag" data-args="${esc(JSON.stringify([String(s.id),qi]))}">${IC.flag}</button></span></div>`).join('')}</div>`;
}

function resetProg(sid){
  if(sid){const s=sets.find(x=>x.id===sid);if(s)s.qs.forEach(q=>{q.streak=0;q.wrong=false})}
  else{sets.forEach(s=>s.qs.forEach(q=>{q.streak=0;q.wrong=false}))}
  rpend=null;crpend=null;wp=null;save(true);home();
}
const rerenderC=()=>curView==='s'?settingsView():home();
function resetCourseProg(gi){
  const c=cnames[gi];
  if(c){
    sets.filter(s=>s.course===c).forEach(s=>s.qs.forEach(q=>{q.streak=0;q.wrong=false}));
    save(true);
  }
  crpend=null;rpend=null;wp=null;rerenderC();
}

function dedupGloss(){
  const out=[];
  gloss.forEach(g=>{
    const i=out.findIndex(x=>norm(x.course)===norm(g.course)&&x.b.toLowerCase()===g.b.toLowerCase());
    if(i<0)out.push(g);else out[i]=g;
  });
  gloss=out;
}
function startCNew(){
  qsearch='';cedit='__new__';cdraft='';cpdraft=getPass('');ctdraft=getExamMins('');cqdraft=getExamCount('');cmdraft=getScoreMode('');cndraft=getNegMode('');cerr='';
  cpend=null;crpend=null;sedit=null;qedit=null;rpend=null;pend=null;pq=null;wp=null;rerenderC();
  setTimeout(()=>{const el=document.getElementById('ecn');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});el.focus()}},30);
}
function startCEdit(gi){cedit=gi;cdraft=cnames[gi]||'';cpdraft=getPass(cdraft);ctdraft=getExamMins(cdraft);cqdraft=getExamCount(cdraft);cmdraft=getScoreMode(cdraft);cndraft=getNegMode(cdraft);cerr='';cpend=null;crpend=null;sedit=null;qedit=null;rpend=null;pend=null;pq=null;wp=null;rerenderC()}
function cancelCEdit(){cedit=null;cdraft='';cerr='';rerenderC()}
function saveCEdit(gi){
  const isNew=gi==='__new__',old=isNew?'':cnames[gi],el=document.getElementById('ecn'),pEl=document.getElementById('ecp'),tEl=document.getElementById('ect'),qEl=document.getElementById('ecq'),mEl=document.getElementById('ecm'),nEl=document.getElementById('ecnm'),nw=(el?el.value:cdraft).trim(),np=pEl?+pEl.value:cpdraft,nt=tEl?Math.max(1,+tEl.value||30):ctdraft,nq=qEl?Math.max(1,+qEl.value||20):cqdraft,nm=mEl?mEl.value:cmdraft,nn=nEl?nEl.value:cndraft;
  cdraft=el?el.value:cdraft;cpdraft=[50,60,70].includes(np)?np:50;ctdraft=nt;cqdraft=nq;cmdraft=SCORE_MODES.includes(nm)?nm:'all';cndraft=NEG_MODES.includes(nn)?nn:'none';
  if(!nw){cerr='Kursname darf nicht leer sein.';rerenderC();return}
  if((isNew||nw!==old)&&cnames.some(x=>x!==old&&norm(x)===norm(nw))){cerr='Diesen Kurs gibt es schon.';rerenderC();return}
  ensureCfgMaps();
  if(!Array.isArray(opts.corder))opts.corder=cnames.slice();
  if(isNew){
    courses[nw]=KINDS.map(x=>x[0]);saveC();
    if(!opts.corder.includes(nw))opts.corder.push(nw);
    if(col.has(nw)){col.delete(nw);saveCol()}
  }else if(nw!==old){
    sets.forEach(s=>{if(s.course===old)s.course=nw});
    let gChg=false;
    gloss.forEach(g=>{if(g.course===old){g.course=nw;gChg=true}});
    if(gChg){dedupGloss();saveGloss(true)}
    courses[nw]=courses[old]||KINDS.map(x=>x[0]);delete courses[old];saveC();
    opts.corder=opts.corder.map(x=>x===old?nw:x).filter((x,i,a)=>a.indexOf(x)===i);
    if(col.has(old)){col.delete(old);col.add(nw);saveCol()}
    if(gcol.has(old)){gcol.delete(old);gcol.add(nw);saveGCol()}
    delete opts.cpass[old];
    delete opts.ctime[old];
    delete opts.cqcount[old];
    delete opts.cmode[old];
    delete opts.cneg[old];
    save(true);
  }
  opts.cpass[nw]=cpdraft;
  opts.ctime[nw]=ctdraft;
  opts.cqcount[nw]=cqdraft;
  opts.cmode[nw]=cmdraft;
  opts.cneg[nw]=cndraft;
  syncCourseCfg(nw);
  saveO(true);
  cedit=null;cdraft='';cerr='';rerenderC();
}
function cForm(gi,hasMC){
  const isNew=gi==='__new__',act=isNew?'__new__':gi,kd=`data-kd="saveCEdit" data-args="${esc(JSON.stringify([isNew?'__new__':gi]))}"`;
  return `<div class="ge"${isNew?'':' style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)"'}>${isNew?'<b style="display:block;margin-bottom:6px;color:var(--ac)">Neuen Kurs anlegen</b>':''}<label class="mut" for="ecn">${isNew?'Kursname':'Kursname bearbeiten'}</label><input id="ecn" value="${esc(cdraft)}" placeholder="Name des Kurses" ${kd}><label class="mut" for="ecq">Anzahl der Fragen (Prüfung)</label><input id="ecq" type="number" min="1" max="200" value="${cqdraft}"><label class="mut" for="ect">Prüfungszeit (Minuten)</label><input id="ect" type="number" min="1" max="300" value="${ctdraft}"><label class="mut" for="ecp">Notenschema (Positiv-Grenze für Prüfungen)</label><select id="ecp"><option value="50" ${cpdraft===50?'selected':''}>50 % – Positiv ab 50 % (1: ≥87,5 % · 2: ≥75 % · 3: ≥62,5 % · 4: ≥50 %)</option><option value="60" ${cpdraft===60?'selected':''}>60 % – Positiv ab 60 % (1: ≥90 % · 2: ≥80 % · 3: ≥70 % · 4: ≥60 %)</option><option value="70" ${cpdraft===70?'selected':''}>70 % – Positiv ab 70 % (1: ≥92,5 % · 2: ≥85 % · 3: ≥77,5 % · 4: ≥70 %)</option></select>${hasMC?`<label class="mut" for="ecm">Multiple-Choice-Wertung (Prüfung)</label><select id="ecm"><option value="all" ${cmdraft==='all'?'selected':''}>Gesamtfrage – 1 Punkt nur wenn komplett richtig (Alles-oder-nichts)</option><option value="opt" ${cmdraft==='opt'?'selected':''}>Einzelantworten (inkl. Nicht-Ankreuzen) – +1 Punkt je richtiger Option (auch richtig weggelassene)</option><option value="pos" ${cmdraft==='pos'?'selected':''}>Einzelantworten (nur richtige) – +1 Punkt je richtig angekreuzter Option</option><option value="part" ${cmdraft==='part'?'selected':''}>Teilpunkte (normiert) – 1 Punkt pro Frage, anteilig über die Optionen</option></select>`:''}<label class="mut" for="ecnm">Minuspunkte bei Fehlern (Prüfung)</label><select id="ecnm"><option value="none" ${cndraft==='none'?'selected':''}>Keine Minuspunkte (Fehler = 0 Punkte)</option>${hasMC||cndraft==='clamp'?`<option value="clamp" ${cndraft==='clamp'?'selected':''}>Minuspunkte pro Fehler, aber mind. 0 Punkte pro Frage (kein Abzug von anderen Fragen)</option>`:''}<option value="full" ${cndraft==='full'?'selected':''}>Minuspunkte pro Fehler, auch unter 0 Punkte pro Frage (Gesamtabzug; Offen = 0 Punkte)</option></select><p class="err" role="alert">${esc(cerr)}</p><div class="row act"><button class="btn sm" type="button" data-act="saveCEdit" data-args="${esc(JSON.stringify([act]))}">${isNew?'Anlegen':'Speichern'}</button><button class="btn sec sm" type="button" data-act="cancelCEdit" data-args='[]'>Abbrechen</button></div></div>`;
}

function startSNew(gi){
  const c=gi!==undefined&&cnames[gi]?cnames[gi]:'';if(!c)return;
  qsearch='';if(col.has(c)){col.delete(c);saveCol()}
  sedit='__new__';sdraft={course:c,title:'',targetC:c};serr='';
  cedit=null;qedit=null;pend=null;rpend=null;cpend=null;crpend=null;pq=null;wp=null;home();
  setTimeout(()=>{const el=document.getElementById('esc_t');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});el.focus()}},30);
}
function startSEdit(sid){
  const s=sets.find(x=>x.id===sid);if(!s)return;
  sedit=sid;sdraft={course:s.course,title:s.title,targetC:''};serr='';cedit=null;qedit=null;pend=null;rpend=null;cpend=null;crpend=null;pq=null;wp=null;home();
  setTimeout(()=>{const el=document.getElementById('esc_t');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});el.focus()}},30);
}
function cancelSEdit(){sedit=null;sdraft=null;serr='';home()}
function saveSEdit(sid){
  const isNew=sid==='__new__';
  const s=isNew?null:sets.find(x=>x.id===sid);
  if(!isNew&&!s)return;
  const cEl=document.getElementById('esc_c'),tEl=document.getElementById('esc_t');
  const rawC=isNew?((sdraft&&sdraft.targetC)||(sdraft&&sdraft.course)||''):(cEl?cEl.value:(sdraft&&sdraft.course)||'');
  const rawT=tEl?tEl.value:(sdraft&&sdraft.title)||'';
  const c=rawC.trim(),t=rawT.trim();
  sdraft={course:rawC,title:rawT,targetC:(sdraft&&sdraft.targetC)||''};
  if(!c||!t){serr=isNew?'Thema / Kapitel darf nicht leer sein.':'Kurs und Thema dürfen nicht leer sein.';home();return}
  const canonC=allCourses().find(x=>norm(x)===norm(c))||c;
  if(sets.some(x=>x.id!==sid&&norm(x.course)===norm(canonC)&&norm(x.title)===norm(t))){
    serr='Dieses Kapitel gibt es in diesem Kurs schon.';home();return;
  }
  if(isNew){
    const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const ns={id,course:canonC,title:t,qs:[]};
    syncSetCfg(ns);
    sets.push(ns);
    if(col.has(canonC)){col.delete(canonC);saveCol()}
    exp.add(id);saveExp();
    sel.add(id);enforceSingleCourse(canonC);saveSel();
    sedit=null;sdraft=null;serr='';
    save(true);home();
    return;
  }
  s.course=canonC;s.title=t;syncSetCfg(s);enforceSingleCourse(sel.has(sid)?canonC:undefined);sedit=null;sdraft=null;serr='';save(true);home();
}
function sForm(sid){
  const isNew=sid==='__new__',d=sdraft||{course:'',title:'',targetC:''};
  const kd=`data-kd="saveSEdit" data-args="${esc(JSON.stringify([String(sid)]))}"`;
  return `<div class="ge"${isNew?'':' style="margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)"'}>${isNew?'<b style="display:block;margin-bottom:6px;color:var(--ac)">Neues Kapitel hinzufügen</b>':`<label class="mut" for="esc_c">Kurs</label><input id="esc_c" list="cl" value="${esc(d.course)}" placeholder="Name des Kurses" ${kd}>`}<label class="mut" for="esc_t">Thema / Kapitel</label><input id="esc_t" value="${esc(d.title)}" placeholder="z. B. Vorlesung 1 – Grundlagen" ${kd}><p class="err" role="alert">${esc(serr)}</p><div class="row act"><button class="btn sm" type="button" data-act="saveSEdit" data-args="${esc(JSON.stringify([String(sid)]))}">${isNew?'Anlegen':'Speichern'}</button><button class="btn sec sm" type="button" data-act="cancelSEdit" data-args='[]'>Abbrechen</button></div></div>`;
}

function startQEdit(sid,qi){
  const s=sets.find(x=>x.id===sid);if(!s||!s.qs[qi])return;
  const q=s.qs[qi];
  qedit=sid+':'+qi;
  qdraft={
    type:q.fixed?'tf':q.type,
    q:q.q,
    exp:q.exp||'',
    tfOk:q.fixed?!!(q.opts[0]&&q.opts[0].ok):true,
    tfWhy:q.fixed?[(q.opts[0]&&q.opts[0].why)||'',(q.opts[1]&&q.opts[1].why)||'']:['',''],
    opts:q.fixed?[{t:'',ok:true,why:''},{t:'',ok:false,why:''}]:q.opts.map(o=>({t:o.t,ok:!!o.ok,why:o.why||''}))
  };
  qerr='';cedit=null;sedit=null;pq=null;home();
}
function startQNew(sid){
  const s=sets.find(x=>x.id===sid);if(!s)return;
  exp.add(sid);saveExp();if(col.has(s.course)){col.delete(s.course);saveCol()}
  qedit=sid+':new';
  qdraft={type:'single',q:'',exp:'',tfOk:true,tfWhy:['',''],opts:[{t:'',ok:true,why:''},{t:'',ok:false,why:''},{t:'',ok:false,why:''},{t:'',ok:false,why:''}]};
  qerr='';cedit=null;sedit=null;pq=null;home();
  setTimeout(()=>{const el=document.getElementById('eq_q');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});el.focus()}},30);
}
function cancelQEdit(){qedit=null;qdraft=null;qerr='';home()}
function syncQDraft(){
  if(!qdraft)return;
  const qEl=document.getElementById('eq_q'),eEl=document.getElementById('eq_exp'),tEl=document.getElementById('eq_type');
  if(qEl)qdraft.q=qEl.value;
  if(eEl)qdraft.exp=eEl.value;
  if(tEl)qdraft.type=tEl.value;
  if(qdraft.type==='tf'){
    const r=document.querySelector('input[name="eq_tf"]:checked');
    if(r)qdraft.tfOk=r.value==='true';
    const w0=document.getElementById('eq_tfw0'),w1=document.getElementById('eq_tfw1');
    if(w0||w1)qdraft.tfWhy=[w0?w0.value:(qdraft.tfWhy&&qdraft.tfWhy[0])||'',w1?w1.value:(qdraft.tfWhy&&qdraft.tfWhy[1])||''];
  }else{
    const oks=[...document.querySelectorAll('.eq_ok')],ots=[...document.querySelectorAll('.eq_ot')],ows=[...document.querySelectorAll('.eq_ow')];
    if(ots.length){
      qdraft.opts=ots.map((el,k)=>({t:el.value,ok:!!(oks[k]&&oks[k].checked),why:ows[k]?ows[k].value:''}));
    }
  }
}
function changeQType(nt){
  syncQDraft();
  qdraft.type=nt;
  if(nt==='tf'&&!qdraft.tfWhy)qdraft.tfWhy=['',''];
  if(nt!=='tf'&&(!qdraft.opts||qdraft.opts.length<2))qdraft.opts=[{t:'',ok:true,why:''},{t:'',ok:false,why:''}];
  if(nt==='single'&&qdraft.opts.filter(o=>o.ok).length>1){
    let first=true;qdraft.opts.forEach(o=>{if(o.ok){if(first)first=false;else o.ok=false}});
  }
  qerr='';home();
}
function addQOpt(){syncQDraft();qdraft.opts.push({t:'',ok:false,why:''});qerr='';home()}
function delQOpt(k){syncQDraft();if(qdraft.opts.length>2){qdraft.opts.splice(k,1);qerr='';home()}}
function saveQEdit(sid,qi){
  syncQDraft();
  const s=sets.find(x=>x.id===sid);if(!s||(qi>=0&&!s.qs[qi]))return;
  const orig=qi>=0?s.qs[qi]:{streak:0,wrong:false},qTxt=qdraft.q.trim(),expTxt=qdraft.exp.trim();
  if(!qTxt){qerr='Der Fragetext darf nicht leer sein.';home();return}
  let nq;
  if(qdraft.type==='tf'){
    const tw=qdraft.tfWhy||['',''];
    nq={q:qTxt,type:'single',fixed:true,exp:expTxt,streak:orig.streak||0,wrong:!!orig.wrong,flagged:false,
      opts:[{t:'Wahr',ok:!!qdraft.tfOk,why:(tw[0]||'').trim()},{t:'Falsch',ok:!qdraft.tfOk,why:(tw[1]||'').trim()}]};
  }else{
    if(qdraft.opts.length<2){qerr='Mindestens 2 Antwortoptionen sind nötig.';home();return}
    if(qdraft.opts.some(o=>!o.t.trim())){qerr='Alle Antwortoptionen müssen einen Text enthalten.';home();return}
    const okCnt=qdraft.opts.filter(o=>o.ok).length;
    if(!okCnt){qerr='Bitte mindestens eine richtige Antwort markieren.';home();return}
    if(qdraft.type==='single'&&okCnt>1){qerr='Bei Single Choice darf nur genau eine Antwort richtig sein.';home();return}
    nq={q:qTxt,type:qdraft.type,exp:expTxt,streak:orig.streak||0,wrong:!!orig.wrong,flagged:false,
      opts:qdraft.opts.map(o=>({t:o.t.trim(),ok:!!o.ok,why:o.why.trim()}))};
  }
  if(qi>=0)s.qs[qi]=nq;else s.qs.push(nq);
  qedit=null;qdraft=null;qerr='';save(true);home();
}

function qForm(sid,qi){
  const d=qdraft,isTf=d.type==='tf',isSingle=d.type==='single',tw=d.tfWhy||['',''];
  return `<div class="qi"><div class="ge">${qi<0?'<b style="display:block;margin-bottom:6px;color:var(--ac)">Neue Frage hinzufügen</b>':''}<label class="mut" for="eq_type">Fragetyp</label><select id="eq_type" data-chg="changeQType" data-args='[]'><option value="single" ${d.type==='single'?'selected':''}>Single Choice</option><option value="multi" ${d.type==='multi'?'selected':''}>Multiple Choice</option><option value="tf" ${isTf?'selected':''}>Wahr / Falsch</option></select><label class="mut" for="eq_q">Frage</label><textarea id="eq_q" style="min-height:64px">${esc(d.q)}</textarea>${isTf?`<label class="mut" style="margin-bottom:4px">Richtige Antwort &amp; optionale Begründungen</label><div class="orow" style="grid-template-columns:auto auto 1fr"><input type="radio" name="eq_tf" value="true" ${d.tfOk?'checked':''}><span style="min-width:52px;font-weight:700">Wahr</span><input id="eq_tfw0" placeholder="Begründung zu Wahr (optional)" value="${esc(tw[0]||'')}"></div><div class="orow" style="grid-template-columns:auto auto 1fr;margin-bottom:10px"><input type="radio" name="eq_tf" value="false" ${!d.tfOk?'checked':''}><span style="min-width:52px;font-weight:700">Falsch</span><input id="eq_tfw1" placeholder="Begründung zu Falsch (optional)" value="${esc(tw[1]||'')}"></div>`:`<label class="mut" style="margin-bottom:4px">Antwortoptionen (Häkchen = richtig, optional Begründung)</label>${d.opts.map((o,k)=>`<div class="orow"><input class="eq_ok" type="${isSingle?'radio':'checkbox'}" name="eq_ok_grp" title="Als richtige Antwort markieren" ${o.ok?'checked':''}><input class="eq_ot" placeholder="Antwort ${k+1}" value="${esc(o.t)}"><input class="eq_ow" placeholder="Begründung (optional)" value="${esc(o.why)}"><button class="x" type="button" title="Option entfernen" aria-label="Option entfernen" ${d.opts.length<=2?'disabled':''} data-act="delQOpt" data-args="${esc(JSON.stringify([k]))}">${IC.x}</button></div>`).join('')}<button class="btn sec sm" type="button" style="margin:2px 0 10px" data-act="addQOpt" data-args='[]'>+ Option hinzufügen</button>`}<label class="mut" for="eq_exp">Erklärung</label><textarea id="eq_exp" style="min-height:64px">${esc(d.exp)}</textarea><p class="err" role="alert">${esc(qerr)}</p><div class="row act"><button class="btn sm" type="button" data-act="saveQEdit" data-args="${esc(JSON.stringify([String(sid),qi]))}">${qi<0?'Anlegen':'Speichern'}</button><button class="btn sec sm" type="button" data-act="cancelQEdit" data-args='[]'>Abbrechen</button></div></div></div>`;
}

let dragItem=null;
function reorderCourseAt(fromGi,toGi){
  buildGroups();
  if(fromGi<0||fromGi>=cnames.length||toGi<0||toGi>=cnames.length||fromGi===toGi)return;
  const next=cnames.slice();
  const [moved]=next.splice(fromGi,1);
  next.splice(toGi,0,moved);
  cnames=next;
  opts.corder=next.slice();
  const byC={};next.forEach(c=>byC[c]=[]);
  sets.forEach(s=>(byC[s.course]=byC[s.course]||[]).push(s));
  sets=next.flatMap(c=>byC[c]||[]);
  saveO(true);save(true);rerenderC();
}
function moveC(gi,d){reorderCourseAt(gi,gi+d);home()}
function moveS(sid,d){const a=sets.find(x=>x.id===sid);if(!a)return;const c=sets.filter(x=>x.course===a.course),i=c.findIndex(x=>x.id===sid),t=c[i+d];if(t){reorderSet(sid,t.id);home()}}
function reorderSet(srcId,targetId){
  if(!srcId||!targetId||srcId===targetId)return;
  const a=sets.find(s=>s.id===srcId),b=sets.find(s=>s.id===targetId);
  if(!a||!b||a.course!==b.course)return;
  const c=a.course,cSets=sets.filter(s=>s.course===c);
  const fromIdx=cSets.findIndex(s=>s.id===srcId),toIdx=cSets.findIndex(s=>s.id===targetId);
  if(fromIdx<0||toIdx<0||fromIdx===toIdx)return;
  const [moved]=cSets.splice(fromIdx,1);
  cSets.splice(toIdx,0,moved);
  let k=0;
  sets=sets.map(s=>s.course===c?cSets[k++]:s);
  save(true);home();
}
function dragCStart(ev,gi){
  const tag=(ev.target&&ev.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'){ev.preventDefault();return}
  dragItem={kind:'c',gi};
  if(ev.dataTransfer){ev.dataTransfer.effectAllowed='move';try{ev.dataTransfer.setData('text/plain','c:'+gi)}catch(e){}}
}
function dragCOver(ev,gi){
  if(!dragItem||dragItem.kind!=='c'||dragItem.gi===gi)return;
  ev.preventDefault();
  if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
  ev.currentTarget.classList.add('drop-target');
}
function dragLeave(ev){
  if(!ev.currentTarget.contains(ev.relatedTarget))ev.currentTarget.classList.remove('drop-target');
}
function dropC(ev,gi){
  ev.currentTarget.classList.remove('drop-target');
  if(!dragItem||dragItem.kind!=='c')return;
  ev.preventDefault();
  const from=dragItem.gi;dragItem=null;
  reorderCourseAt(from,gi);
}
function dragSStart(ev,sid,c){
  const tag=(ev.target&&ev.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'){ev.preventDefault();return}
  ev.stopPropagation();
  dragItem={kind:'s',sid,c};
  if(ev.dataTransfer){ev.dataTransfer.effectAllowed='move';try{ev.dataTransfer.setData('text/plain','s:'+sid)}catch(e){}}
}
function dragSOver(ev,sid,c){
  if(!dragItem||dragItem.kind!=='s'||dragItem.c!==c||dragItem.sid===sid)return;
  ev.preventDefault();ev.stopPropagation();
  if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';
  ev.currentTarget.classList.add('drop-target');
}
function dropS(ev,sid,c){
  ev.currentTarget.classList.remove('drop-target');
  if(!dragItem||dragItem.kind!=='s'||dragItem.c!==c)return;
  ev.preventDefault();ev.stopPropagation();
  const from=dragItem.sid;dragItem=null;
  reorderSet(from,sid);
}
function dragEnd(){
  dragItem=null;
  document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
}

function courseCardHtml(c,l,gi,isSetView){
  const mC=l.reduce((a,s)=>a+masteredInSet(s),0),allC=l.reduce((a,s)=>a+s.qs.length,0),gC=gloss.filter(g=>norm(g.course)===norm(c)).length,hasCP=l.some(s=>s.qs.some(q=>(q.streak||0)>0||q.wrong)),hasMC=l.some(s=>s.qs.some(q=>q.type==='multi')),cp=getPass(c),cm=getExamMins(c),cq=getExamCount(c),csm=getScoreMode(c),cnm=getNegMode(c),cCol=mC===allC&&allC?'--ok':l.some(s=>sel.has(s.id))?'--ac':'--ink';
  const sub=`<span class="mut" style="display:block;font-size:.82rem;margin-bottom:1px">${l.length} Kapitel · ${allC} Fragen${mC?` · ${mC} gemeistert`:''}${gC?` · ${gC} Glossarbegriffe`:''}</span><span class=\"mut\" style=\"display:block;font-size:.82rem;margin-bottom:2px\">Prüfung: ${cq} Fragen · ${cm} Min. · bestanden ab ${cp} %${hasMC?` · ${modeShort(csm)}`:''}${cnm!=='none'?` · ${negShort(cnm)}`:''}</span><b>${esc(c)}</b>`;
  const canDrag=cnames.length>1&&cedit!==gi;
  return `<div class="card ccard" style="margin:14px 0 8px;padding:12px 16px;border-left:4px solid var(${cCol})" ${canDrag?`draggable="true" data-dragstart="dragCStart" data-dragover="dragCOver" data-dragleave="dragLeave" data-drop="dropC" data-dragend="dragEnd" data-args="${esc(JSON.stringify([gi]))}"`:''}><div class="crs">${isSetView?`<div class="chb" style="padding:2px 0;cursor:default"><span>${sub}</span></div>`:`<input type="checkbox" aria-label="Alle Kapitel auswählen" ${allSel(l)?'checked':''} ${l.length?'':'disabled'} data-chk="togC" data-args="${esc(JSON.stringify([gi]))}"><button class="chb" style="padding:2px 0" aria-expanded="${!col.has(c)}" data-act="fold" data-args="${esc(JSON.stringify([gi]))}"><span>${col.has(c)?'▸':'▾'}</span><span>${sub}</span></button>`}<span class="gc">${isSetView?'':`<button class="x" title="Neues Kapitel zu diesem Kurs hinzufügen" aria-label="Neues Kapitel hinzufügen" data-act="startSNew" data-args="${esc(JSON.stringify([gi]))}">${IC.plus}</button>`}<button class="x" title="Kurs exportieren" aria-label="Kurs exportieren" data-act="exportC" data-el data-args="${esc(JSON.stringify([gi]))}">${IC.exp}</button>${crpend===gi?`<span class="mut">Zurücksetzen?</span><button class="btn sm" data-act="resetCourseProg" data-args="${esc(JSON.stringify([gi]))}">Ja</button><button class="btn sec sm" data-act="_h1">Nein</button>`:hasCP?`<button class="x" title="Lernstand dieses Kurses zurücksetzen" aria-label="Lernstand dieses Kurses zurücksetzen" data-act="_h2" data-args="${esc(JSON.stringify([gi]))}">${IC.res}</button>`:''}${canDrag?`<button class="x" aria-label="Kurs ${esc(c)} nach oben" title="Nach oben" ${gi===0?'disabled':''} data-act="moveC" data-args="${esc(JSON.stringify([gi,-1]))}">↑</button><button class="x" aria-label="Kurs ${esc(c)} nach unten" title="Nach unten" ${gi===cnames.length-1?'disabled':''} data-act="moveC" data-args="${esc(JSON.stringify([gi,1]))}">↓</button>`:''}<button class="x" title="Kurs, Zeit, Wertung & Notenschema bearbeiten" aria-label="Kurs bearbeiten" data-act="startCEdit" data-args="${esc(JSON.stringify([gi]))}">${IC.edit}</button>${cpend===gi?`<span class="mut">Löschen?</span><button class="btn sm" data-act="delC2" data-args="${esc(JSON.stringify([gi]))}">Ja</button><button class="btn sec sm" data-act="delC" data-args="${esc(JSON.stringify([gi]))}">Nein</button>`:`<button class="x" title="Kurs löschen" aria-label="Kurs löschen" data-act="delC" data-args="${esc(JSON.stringify([gi]))}">${IC.del}</button>`}</span></div>${cedit===gi?cForm(gi,hasMC):''}</div>`;
}

function buildGroups(){
  const groups={},order=[],avail=new Set();
  sets.forEach(s=>{if(s.course)avail.add(s.course)});
  Object.keys(courses).forEach(c=>{if(c)avail.add(c)});
  const addC=c=>{if(c&&avail.has(c)&&!order.includes(c)){order.push(c);groups[c]=[]}};
  if(Array.isArray(opts.corder))opts.corder.forEach(addC);
  sets.forEach(s=>{addC(s.course);if(s.course)groups[s.course].push(s)});
  Object.keys(courses).forEach(addC);
  cnames=order;
  return groups;
}

function dueBannerHtml(){
  const res=collectDueQuestions(sets,sel.size?sel:null);
  if(!res.dueCount)return '';
  const cnt=res.dueCount;
  return `<div class="card fbox" style="margin:10px 0;border-left:4px solid var(--ac)"><div class="row" style="justify-content:space-between;align-items:center"><div><b style="display:inline-flex;align-items:center;gap:6px;color:var(--ac)">${IC.clock} ${cnt} ${cnt===1?'Frage':'Fragen'} zur Wiederholung fällig</b><p class="mut" style="margin:2px 0 0;font-size:.86rem">Spaced Repetition: Diese Fragen stehen heute wieder auf dem Plan.</p></div><button class="btn sm" data-act="startDue" data-args='[]'>Fällige üben (${Math.min(cnt,getQuizCount())})</button></div></div>`;
}
function startDue(allScope){
  const res=collectDueQuestions(sets,allScope?null:(sel.size?sel:null));
  if(!res.due.length)return;
  start(res.due.slice(0,getQuizCount()));
}
function home(){stopExamTimer();enforceSingleCourse();const chg=curView!=='q';curView='q';$app.className=qsearch.trim()?'searching':'';
  const groups=buildGroups();
  const total=[...sel].reduce((a,id)=>{const s=sets.find(x=>x.id===id);return a+(s?pool1(s).length:0)},0);
  const allSelCount=[...sel].reduce((a,id)=>{const s=sets.find(x=>x.id===id);return a+(s?s.qs.length:0)},0);
  const cs=selCourses(),mainC=cs[0]||(cnames[0]||''),examMax=getExamCount(mainC);
  const eCnt=Math.min(examMax,allSelCount),qCnt=Math.min(getQuizCount(),total);
  const dl=`<datalist id="cl">${allCourses().map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`;
  const topNew=cedit==='__new__';
  $app.innerHTML=`${nav('q')}<div class="row" style="justify-content:space-between;align-items:center"><h1>${IC.cap}<span>Quizomat</span></h1>${sets.length?`<div class="row dstart"><button class="btn sec" ${allSelCount?'':'disabled'} data-act="startExam" data-args='[]'>Prüfung starten${eCnt?` (${eCnt})`:''}</button><button class="btn" ${total?'':'disabled'} data-act="start" data-args='[]'>Quiz starten${qCnt?` (${qCnt})`:''}</button></div>`:''}</div><p class="mut">Fragen aus deinen Vorlesungsunterlagen üben und auswerten.</p>
  ${topBar()}${sets.length?optsHtml(total,allSelCount)+searchHtml()+dueBannerHtml()+flaggedHtml():''}${dl}
  ${topNew?`<div class="card ccard" style="margin-top:14px;border-left:4px solid var(--ac)">${cForm('__new__',false)}</div>`:''}
  ${cnames.length?cnames.map((c,gi)=>{
    const l=groups[c],inNew=sedit==='__new__'&&sdraft&&sdraft.targetC===c;
    return courseCardHtml(c,l,gi,false)+(col.has(c)?'':`<div class="grp" style="margin:0 0 16px 12px">${l.map((s,si)=>{
      const mS=masteredInSet(s),hasP=s.qs.some(q=>(q.streak||0)>0||q.wrong),sCol=mS===s.qs.length&&s.qs.length?'--ok':sel.has(s.id)?'--ac':'--ink',canDragS=l.length>1&&sedit!==s.id;
      return `<div class="set" style="border-left:4px solid var(${sCol})" ${canDragS?`draggable="true" data-dragstart="dragSStart" data-dragover="dragSOver" data-dragleave="dragLeave" data-drop="dropS" data-dragend="dragEnd" data-args="${esc(JSON.stringify([String(s.id),c]))}"`:''}><input type="checkbox" aria-label="${esc(s.title)} auswählen" ${sel.has(s.id)?'checked':''} data-chk="tog" data-args="${esc(JSON.stringify([String(s.id)]))}"><button class="sb" style="padding:2px 0" aria-expanded="${exp.has(s.id)}" data-act="openS" data-args="${esc(JSON.stringify([String(s.id)]))}"><span>${exp.has(s.id)?'▾':'▸'}</span><span><span class="mut" style="display:block;font-size:.82rem;margin-bottom:1px">Kapitel ${si+1} · ${s.qs.length} Fragen${mS?` · ${mS} ✓ gemeistert`:''}</span><b>${esc(s.title)}</b></span></button><span class="gc"><button class="x" title="Neue Frage hinzufügen" aria-label="Neue Frage hinzufügen" data-act="startQNew" data-args="${esc(JSON.stringify([String(s.id)]))}">${IC.plus}</button>${rpend===s.id?`<span class="mut">Zurücksetzen?</span><button class="btn sm" data-act="resetProg" data-args="${esc(JSON.stringify([String(s.id)]))}">Ja</button><button class="btn sec sm" data-act="_h3">Nein</button>`:hasP?`<button class="x" title="Lernstand dieses Kapitels zurücksetzen" aria-label="Lernstand zurücksetzen" data-act="_h4" data-args="${esc(JSON.stringify([String(s.id)]))}">${IC.res}</button>`:''}${canDragS?`<button class="x" aria-label="Kapitel ${esc(s.title)} nach oben" title="Nach oben" ${l.indexOf(s)===0?'disabled':''} data-act="moveS" data-args="${esc(JSON.stringify([String(s.id),-1]))}">↑</button><button class="x" aria-label="Kapitel ${esc(s.title)} nach unten" title="Nach unten" ${l.indexOf(s)===l.length-1?'disabled':''} data-act="moveS" data-args="${esc(JSON.stringify([String(s.id),1]))}">↓</button>`:''}<button class="x" title="Kapitel bearbeiten" aria-label="Kapitel bearbeiten" data-act="startSEdit" data-args="${esc(JSON.stringify([String(s.id)]))}">${IC.edit}</button>${pend===s.id?`<span class="mut">Löschen?</span><button class="btn sm" data-act="del2" data-args="${esc(JSON.stringify([String(s.id)]))}">Ja</button><button class="btn sec sm" data-act="del" data-args="${esc(JSON.stringify([String(s.id)]))}">Nein</button>`:`<button class="x" title="Kapitel löschen" aria-label="Kapitel löschen" data-act="del" data-args="${esc(JSON.stringify([String(s.id)]))}">${IC.del}</button>`}</span>${sedit===s.id?sForm(s.id):''}</div>${exp.has(s.id)?`<div class="ql">${s.qs.map((q,i)=>qedit===s.id+':'+i?qForm(s.id,i):`<div class="qi"><span>${esc(q.q)}</span><span class="gc">${qBadge(s.id,i,q)}<button class="x${q.flagged?' warn':''}" title="${q.flagged?'Markierung aufheben':'Zum Bearbeiten markieren'}" aria-label="Markieren" data-act="togFlag" data-args="${esc(JSON.stringify([String(s.id),i]))}">${IC.flag}</button><button class="x" title="Frage bearbeiten" aria-label="Frage bearbeiten" data-act="startQEdit" data-args="${esc(JSON.stringify([String(s.id),i]))}">${IC.edit}</button>${pq===s.id+':'+i?`<button class="btn sm" data-act="delQ" data-args="${esc(JSON.stringify([String(s.id),i]))}">Löschen</button><button class="btn sec sm" data-act="_h5">Nein</button>`:`<button class="x" title="Frage löschen" aria-label="Frage löschen" data-act="_h6" data-args="${esc(JSON.stringify([s.id,i]))}">${IC.del}</button>`}</span></div>`).join('')}${qedit===s.id+':new'?qForm(s.id,-1):`<div class="qi" style="padding:10px 0 6px"><button class="btn sec sm" type="button" data-act="startQNew" data-args="${esc(JSON.stringify([String(s.id)]))}">+ Neue Frage hinzufügen</button></div>`}</div>`:''}`}).join('')}${inNew?`<div class="set" style="border-left:4px solid var(--ac)">${sForm('__new__')}</div>`:(!l.length?`<div class="set" style="padding:10px 14px"><button class="btn sec sm" type="button" data-act="startSNew" data-args="${esc(JSON.stringify([gi]))}">+ Neues Kapitel hinzufügen</button></div>`:'')}</div>`);
  }).join('')+(sets.length?`<div class="mstart"><div class="row"><button class="btn sec" ${allSelCount?'':'disabled'} data-act="startExam" data-args='[]'>Prüfung${eCnt?` (${eCnt})`:''}</button><button class="btn" ${total?'':'disabled'} data-act="start" data-args='[]'>Quiz${qCnt?` (${qCnt})`:''}</button></div></div>`:'')
  :(topNew?'':`<div class="card" style="margin-top:18px"><p><b>Noch keine Kurse oder Fragen vorhanden.</b></p><p class="mut">Lege oben über „+ Neuer Kurs“ einen neuen Kurs an oder lass dir in Claude aus deinen Unterlagen ein Fragenset als JSON erstellen und füge es hier ein.</p></div>`)}
`;if(chg)toTop();
}
let wp=null;
function topBar(){
  const hasP=hasAnyProgress();
  return `<div class="row act" style="margin:12px 0 6px"><button class="btn sec ico" title="Fragen importieren" aria-label="Fragen importieren" data-act="imp" data-args='["fragen"]'>${IC.imp}</button><button class="btn sec sm" style="min-height:40px" data-act="startCNew" data-args='[]'>+ Neuer Kurs</button>${sets.length?`<button class="btn sec ico" title="Alle Fragen exportieren" aria-label="Alle Fragen exportieren" data-act="exportQ" data-el>${IC.exp}</button>`:''}${cnames.length?`<span class="gc" style="gap:8px">${hasP?(wp==='r'?`<span class="mut">Zurücksetzen?</span><button class="btn sm" data-act="resetProg" data-args='[]'>Ja</button><button class="btn sec sm" data-act="_h7">Nein</button>`:`<button class="btn sec ico" title="Lernstand zurücksetzen" aria-label="Lernstand zurücksetzen" data-act="_h8">${IC.res}</button>`):''}</span>`:''}</div>`;
}
function optsHtml(total,allSelCount){
  const mastCount=allSelCount-[...sel].reduce((a,id)=>{const s=sets.find(x=>x.id===id);return a+(s?s.qs.filter(q=>!isMastered(q)).length:0)},0),ap=activePass(),at=activeTime(),aq=activeCount(),asm=activeScoreMode(),anm=activeNegMode(),cs=selCourses(),hasMC=cs.length===1&&courseHasMulti(cs[0]),qCnt=Math.min(getQuizCount(),total);
  return `<p class="mut" style="margin:8px 0 4px">${total?`<b>${total}</b> ${total===1?'Frage':'Fragen'} zum Üben verfügbar (Quiz: <b>${qCnt}</b>`+(mastCount?` · ${mastCount} gemeisterte ${opts.hideMastered?'ausgeblendet':'enthalten'} · für Prüfung alle ${allSelCount} verfügbar`:'')+`)`:allSelCount&&mastCount===allSelCount?`Alle ${allSelCount} ausgewählten Fragen sind gemeistert – setze den Lernstand zurück oder starte eine Prüfung.`:sel.size?'Noch keine Fragen in den ausgewählten Kapiteln.':'Wähle mindestens ein Kapitel eines Kurses aus.'}${cs.length===1?` · Kurs „${esc(cs[0])}“ (Prüfung: ${aq} Fragen · ${at} Min. · bestanden ab ${ap} %${hasMC?` · ${modeShort(asm)}`:''}${anm!=='none'?` · ${negShort(anm)}`:''})`:''}</p>`;
}
function wipe(k){if(k==='q'&&!okFlag){appDialog('Löscht alle Fragen, Kurse und (bei aktivem Sync) auch die Cloud-Daten. Zum Bestätigen LÖSCHEN eingeben:',()=>{okFlag=true;try{wipe('q')}finally{okFlag=false}},'LÖSCHEN');return}if(k==='q'){sets=[];courses={};opts.corder=[];sel=new Set();exp=new Set();col=new Set();saveSel();saveExp();saveCol();saveC();saveO();save(true);wp=null;home()}else{gloss=[];gcol=new Set();saveGCol();saveGloss(true);wp=null;glosView()}}
const allSel=l=>l.length>0&&l.every(s=>sel.has(s.id));
function fold(gi){const c=cnames[gi];col.has(c)?col.delete(c):col.add(c);saveCol();home()}
function gfold(gi){const c=gcnames[gi];gcol.has(c)?gcol.delete(c):gcol.add(c);saveGCol();glosView()}
function togC(gi,on){const c=cnames[gi];if(on)sets.forEach(s=>{if(s.course!==c)sel.delete(s.id)});sets.filter(s=>s.course===c).forEach(s=>on?sel.add(s.id):sel.delete(s.id));saveSel();home()}
function openS(id){exp.has(id)?exp.delete(id):exp.add(id);saveExp();pq=null;qedit=null;home()}
function delQ(id,i){const s=sets.find(x=>x.id===id);if(!s)return;s.qs.splice(i,1);pq=null;save(true);home()}
const exportQ=b=>exportData(b,'fragen'),exportG=b=>exportData(b,'glossar'),exportC=(b,gi)=>exportData(b,'kurs',cnames[gi]),exportGC=(b,gi)=>exportData(b,'glossar',gcnames[gi]);
function exportData(b,kind,crs){const h0=b.innerHTML;
  let out;
  if(kind==='glossar'){
    if(crs){
      out={kurs:crs,glossar:gloss.filter(g=>g.course===crs).map(g=>({begriff:g.b,info:g.i,...(g.a.length?{alias:g.a}:{})}))};
    }else{
      const gm={};gloss.forEach(g=>(gm[g.course]=gm[g.course]||[]).push({begriff:g.b,info:g.i,...(g.a.length?{alias:g.a}:{})}));
      const gk=Object.keys(gm);
      out=gk.length===1?{kurs:gk[0],glossar:gm[gk[0]]}:gk.map(k=>({kurs:k,glossar:gm[k]}));
    }
  }else{
    const list=kind==='kurs'?sets.filter(s=>s.course===crs):sets;
    out=list.map(s=>({kurs:s.course,titel:s.title,einstellungen:{fragenAnzahl:getExamCount(s.course),zeitMinuten:getExamMins(s.course),positivAb:getPass(s.course),mcWertung:getScoreMode(s.course),minuspunkte:getNegMode(s.course)},fragen:s.qs.map(q=>({...(q.fixed?{typ:'tf',frage:q.q,richtig:q.opts[0].ok,erklaerung:q.exp}:{typ:q.type,frage:q.q,optionen:q.opts.map(o=>o.t),richtig:q.opts.map((o,i)=>o.ok?i:-1).filter(i=>i>=0),erklaerung:q.exp}),...(q.opts.some(o=>o.why)?{begruendungen:q.opts.map(o=>o.why||'')}:{}),...(q.streak?{streak:q.streak}:{}),...(q.wrong?{wrong:true}:{}),...(q.flagged?{flagged:true}:{})}))}));
    if(kind==='kurs'&&crs){
      const cg=gloss.filter(g=>norm(g.course)===norm(crs));
      if(cg.length)out.push({kurs:crs,glossar:cg.map(g=>({begriff:g.b,info:g.i,...(g.a.length?{alias:g.a}:{})}))});
    }
  }
  const slug=crs?'-'+(crs.toLowerCase().replace(/[^a-z0-9äöüß]+/g,'-').replace(/^-|-$/g,'')||'kurs'):'';
  try{const u=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));
    const a=document.createElement('a');a.href=u;a.download='quizomat-'+kind+slug+'-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);b.textContent='✓'}
  catch(e){b.textContent='!'}
  setTimeout(()=>{b.innerHTML=h0},2000)}
function tog(id){const s=sets.find(x=>x.id===id);if(!s)return;if(sel.has(id)){sel.delete(id)}else{sets.forEach(x=>{if(x.course!==s.course)sel.delete(x.id)});sel.add(id)}saveSel();home()}
function del(id){pend=pend===id?null:id;rpend=null;cpend=null;crpend=null;home()}
function del2(id){const s=sets.find(x=>x.id===id);if(s&&s.course&&!courses[s.course]){courses[s.course]=KINDS.map(x=>x[0]);saveC()}sets=sets.filter(x=>x.id!==id);sel.delete(id);exp.delete(id);saveSel();saveExp();pend=null;rpend=null;cpend=null;crpend=null;save(true);home()}
function delC(gi){cpend=cpend===gi?null:gi;pend=null;rpend=null;crpend=null;rerenderC()}
function delC2(gi){
  const c=cnames[gi];
  if(c!==undefined){
    sets.filter(s=>s.course===c).forEach(s=>{sel.delete(s.id);exp.delete(s.id)});
    sets=sets.filter(s=>s.course!==c);
    if(gloss.some(g=>g.course===c)){gloss=gloss.filter(g=>g.course!==c);gcol.delete(c);saveGCol();saveGloss(true)}
    delete courses[c];col.delete(c);if(opts.cpass)delete opts.cpass[c];if(opts.ctime)delete opts.ctime[c];if(opts.cqcount)delete opts.cqcount[c];if(opts.cmode)delete opts.cmode[c];if(opts.cneg)delete opts.cneg[c];if(Array.isArray(opts.corder))opts.corder=opts.corder.filter(x=>x!==c);
    saveSel();saveExp();saveCol();saveC();saveO();save(true);
  }
  cpend=null;crpend=null;rpend=null;pend=null;rerenderC();
}

function activeCloudState(){
  if(sbUser)return{on:true,state:sbState,err:sbErr,last:sbLastSync,label:'Supabase'};
  if(gh.token)return{on:true,state:syncState,err:syncErr,last:gh.lastSync,label:'GitHub'};
  return{on:false,state:'idle',err:'',last:0,label:''};
}
function syncBadge(){
  const c=activeCloudState();
  if(!c.on)return '';
  if(c.state==='syncing')return `<span class="sdot">…</span>`;
  if(c.state==='err')return `<span class="sdot bad">!</span>`;
  if(c.state==='ok'||c.last)return `<span class="sdot ok">✓</span>`;
  return '';
}
function syncTitle(){
  const c=activeCloudState();
  if(!c.on)return 'Cloud-Sync einrichten';
  if(c.state==='syncing')return `Cloud-Sync (${c.label}) läuft …`;
  if(c.state==='err')return `Cloud-Sync (${c.label}) Fehler: `+c.err;
  return `Cloud-Sync (${c.label}) aktiv`+(c.last?' (zuletzt '+new Date(c.last).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})+' Uhr)':'');
}
function updSyncUI(){
  const c=activeCloudState();
  if(c.state!==lastSS){if(c.state==='err')announce('Synchronisierung fehlgeschlagen');else if(lastSS==='syncing'&&c.state==='ok')announce('Synchronisiert');lastSS=c.state}
  const el=document.getElementById('cs');if(el)el.innerHTML=syncBadge();
  const b=document.querySelector('.cnav');if(b)b.title='Einstellungen'+(c.on?' · '+syncTitle():'');
  const sb=document.getElementById('sbbox');if(sb)sb.innerHTML=sbCloudHtml();
  const cb=document.getElementById('cbox');if(cb)cb.innerHTML=cloudHtml();
}
const nav=a=>`<nav class='nav'><button class='${a==='q'?'on':''}' ${a==='q'?'aria-current="page"':''} title="Fragen" aria-label="Fragen" data-act="_h10">${IC.cap}<span class="nlbl">Fragen</span></button><button class='${a==='g'?'on':''}' ${a==='g'?'aria-current="page"':''} title="Glossar" aria-label="Glossar" data-act='glos'>${IC.book}<span class="nlbl">Glossar</span></button><button class='${a==='t'?'on':''}' ${a==='t'?'aria-current="page"':''} title="Statistik &amp; Verlauf" aria-label="Statistik" data-act='stats'>${IC.chart}<span class="nlbl">Statistik</span></button><button class='cnav ${a==='s'?'on':''}' ${a==='s'?'aria-current="page"':''} title="Einstellungen${activeCloudState().on?' · '+esc(syncTitle()):''}" aria-label="Einstellungen" data-act='settings'>${IC.cog}<span class="nlbl">Einstellungen</span><span id="cs">${syncBadge()}</span></button></nav>`;
function stats(){histDelPend=null;statsView();toTop()}
function setStatsCourse(c){statsCourse=c||'';histDelPend=null;statsView()}
function togHistExp(id){histExp.has(id)?histExp.delete(id):histExp.add(id);statsView()}
function delHist(id){histDelPend=histDelPend===id?null:id;statsView()}
function delHist2(id){examHistory=examHistory.filter(a=>a.id!==id);histExp.delete(id);histDelPend=null;saveHistory(true);statsView()}
function statsView(){
  stopExamTimer();curView='t';$app.className='';
  const allQs=sets.flatMap(s=>s.qs||[]),totQ=allQs.length,mastQ=allQs.filter(isMastered).length,wrongQ=allQs.filter(q=>q.wrong).length;
  const dueRes=collectDueQuestions(sets,null);
  const histCourses=[...new Set(examHistory.map(a=>a.course).filter(Boolean))];
  if(statsCourse&&!histCourses.includes(statsCourse))statsCourse='';
  const filtered=statsCourse?examHistory.filter(a=>a.course===statsCourse):examHistory;
  const sum=summarizeHistory(filtered);
  const weak=weakestChapters(filtered).slice(0,6);
  $app.innerHTML=`${nav('t')}<h1>${IC.chart}<span>Statistik &amp; Verlauf</span></h1><p class="mut">Lernfortschritt, Spaced-Repetition-Wiederholungen und deine bisherigen Prüfungsergebnisse.</p>
  <h2>Lernstand &amp; Spaced Repetition</h2>
  <div class="kpis">
    <div class="kpi"><div class="kv">${totQ}</div><div class="kl">Fragen gesamt</div></div>
    <div class="kpi"><div class="kv" style="color:var(--ok)">${mastQ}</div><div class="kl">Gemeistert${totQ?` (${Math.round(mastQ/totQ*100)} %)`:''}</div></div>
    <div class="kpi"><div class="kv" style="color:var(${dueRes.dueCount?'--ac':'--fg'})">${dueRes.dueCount}</div><div class="kl">Heute fällig (SRS)</div></div>
    <div class="kpi"><div class="kv" style="color:var(${wrongQ?'--bad':'--fg'})">${wrongQ}</div><div class="kl">Zuletzt falsch</div></div>
  </div>
  <div class="card" style="margin-bottom:14px">
    <div class="row" style="justify-content:space-between;align-items:center">
      <div>
        <b>Spaced Repetition (Wiederholungsplan)</b>
        <p class="mut" style="margin:2px 0 0">${dueRes.dueCount?`<b>${dueRes.dueCount}</b> ${dueRes.dueCount===1?'Frage ist':'Fragen sind'} heute zur Wiederholung fällig.`:dueRes.nextDueAt?`Alles erledigt! Nächste fällige Wiederholung: <b>${esc(formatRelativeDue(dueRes.nextDueAt))}</b>.`:'Beantworte Fragen im Quiz oder in einer Prüfung, um deinen persönlichen Wiederholungsplan zu starten.'}</p>
      </div>
      ${dueRes.dueCount?`<button class="btn sm" data-act="startDue" data-args='[true]'>Fällige jetzt üben (${Math.min(dueRes.dueCount,getQuizCount())})</button>`:''}
    </div>
  </div>
  <h2>Prüfungshistorie (${filtered.length})</h2>
  ${histCourses.length>1?`<div class="gtabs" style="margin-bottom:10px"><button class="gtab${!statsCourse?' on':''}" data-act="setStatsCourse" data-args='[""]'>Alle Kurse (${examHistory.length})</button>${histCourses.map(c=>`<button class="gtab${statsCourse===c?' on':''}" data-act="setStatsCourse" data-args="${esc(JSON.stringify([c]))}">${esc(c)} (${examHistory.filter(a=>a.course===c).length})</button>`).join('')}</div>`:''}
  ${filtered.length?`
    <div class="kpis">
      <div class="kpi"><div class="kv">${sum.count}</div><div class="kl">Prüfungen</div></div>
      <div class="kpi"><div class="kv" style="color:var(${sum.passRate>=50?'--ok':'--bad'})">${sum.passRate} %</div><div class="kl">Bestanden (${sum.passedCount}/${sum.count})</div></div>
      <div class="kpi"><div class="kv">${String(sum.avgGrade).replace('.',',')}</div><div class="kl">Ø Note</div></div>
      <div class="kpi"><div class="kv">${fmtPct(sum.avgPct)}</div><div class="kl">Ø Punkte (Best: ${fmtPct(sum.bestPct)})</div></div>
    </div>
    ${weak.length?`<div class="card" style="margin-bottom:14px"><b>Schwachstellen nach Kapiteln</b><p class="mut" style="margin:2px 0 8px">Kapitel mit den niedrigsten Durchschnittswerten aus deinen bisherigen Prüfungen:</p>${weak.map(w=>`<div class="qi" style="padding:6px 0"><span>${!statsCourse?`<span class="mut">${esc(w.course)} › </span>`:''}<b>${esc(w.title)}</b> <span class="mut">(${w.runs}× geprüft)</span></span><span class="badge ${w.pct>=75?'ok':w.pct>=50?'warn':'bad'}" style="cursor:default">${w.pct} %</span></div>`).join('')}</div>`:''}
    ${filtered.map(a=>{
      const open=histExp.has(a.id),dt=a.createdAt?new Date(a.createdAt).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})+' Uhr':'';
      const colVar=a.passed?(a.grade<=2?'--ok':a.grade===3?'--ac':'--warn'):'--bad';
      return `<div class="card" style="margin:10px 0;padding:12px 16px;border-left:4px solid var(${colVar})">
        <div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between">
          <button class="sb" style="padding:2px 0" aria-expanded="${open}" data-act="togHistExp" data-args="${esc(JSON.stringify([a.id]))}">
            <span>${open?'▾':'▸'}</span>
            <span><span class="mut" style="display:block;font-size:.82rem;margin-bottom:1px">${esc(dt)} · ⏱ ${fmtTime(a.elapsedSec)} / ${fmtTime(a.durationMins*60)} · ${a.correctCount}/${a.totalCount} komplett richtig</span><b>${esc(a.course)}</b></span>
          </button>
          <span class="gc">
            <span class="badge ${a.passed?'ok':'bad'}" style="cursor:default">Note ${a.grade} · ${fmtPct(a.pct)}</span>
            ${histDelPend===a.id?`<span class="mut">Löschen?</span><button class="btn sm" data-act="delHist2" data-args="${esc(JSON.stringify([a.id]))}">Ja</button><button class="btn sec sm" data-act="delHist" data-args="${esc(JSON.stringify([a.id]))}">Nein</button>`:`<button class="x" title="Prüfungseintrag löschen" aria-label="Eintrag löschen" data-act="delHist" data-args="${esc(JSON.stringify([a.id]))}">${IC.del}</button>`}
          </span>
        </div>
        ${open?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">
          <p class="mut" style="margin:0 0 8px"><b>${fmtPts(a.scorePts)} / ${fmtPts(a.maxPts)} Punkte</b> · Positiv ab ${a.passPct} % · ${esc(modeShort(a.scoreMode))}${a.negMode!=='none'?` · ${esc(negShort(a.negMode))}`:''}</p>
          ${(a.chapters||[]).length?a.chapters.map(c=>`<div class="qi" style="padding:5px 0"><span>${esc(c.title)}</span><span class="badge ${c.pct>=a.passPct?'ok':'bad'}" style="cursor:default">${fmtPts(c.pts)} / ${fmtPts(c.max)} Pkt. (${c.pct} %)</span></div>`).join(''):''}
        </div>`:''}
      </div>`;
    }).join('')}
  `:`<div class="card"><p style="margin:0"><b>Noch keine Prüfungen abgeschlossen.</b></p><p class="mut" style="margin:4px 0 0">Sobald du eine Prüfung abgibst, erscheint hier automatisch dein Verlauf inkl. Notenentwicklung und Kapitel-Analyse.</p></div>`}`;
}
let gpend=null,qsearch='',gq='',gedit=null,gdraft=null,gerr='';
function glos(){gpend=null;gcpend=null;gcedit=null;wp=null;gedit=null;gdraft=null;gq='';glosView();toTop()}
function settings(){cedit=null;cpend=null;crpend=null;wp=null;settingsView();toTop()}
function settingsView(){
  stopExamTimer();curView='s';$app.className='';
  const groups=buildGroups();
  const qn=getQuizCount(),ms=Math.max(1,Math.min(10,+opts.mastery||3)),th=THEMES.includes(opts.theme)?opts.theme:'auto';
  $app.innerHTML=`${nav('s')}<h1>${IC.cog}<span>Einstellungen</span></h1><p class="mut">Übungsumfang für das Quiz, Darstellung, Kurseinstellungen und Cloud-Sync verwalten.</p>
  <h2>Übungsmodus (Quiz) &amp; Darstellung</h2>
  <div class="card">
    <div class="srow">
      <div>
        <label for="sqn" style="font-weight:700;display:block">Anzahl der Fragen pro Übung (Quiz)</label>
        <p class="mut" style="margin:2px 0 0">Legt fest, wie viele Fragen bei einem Quiz-Durchgang maximal aus den ausgewählten Kapiteln gestellt werden.</p>
      </div>
      <input id="sqn" type="number" min="1" max="500" value="${qn}" data-chg="setQuizCount" data-args='[]' style="width:5em;font-weight:700;text-align:center">
    </div>
    <div class="srow">
      <div>
        <label for="sms" style="font-weight:700;display:block">Frage gilt als „Gemeistert“ ab</label>
        <p class="mut" style="margin:2px 0 0">Wie oft eine Frage in Folge richtig beantwortet werden muss, bis sie den Status „✓ Gemeistert“ erhält.</p>
      </div>
      <select id="sms" class="inl" data-chg="setMastery" data-args='[]' style="font-weight:700">
        ${[1,2,3,4,5].map(n=>`<option value="${n}" ${ms===n?'selected':''}>${n}× in Folge</option>`).join('')}
      </select>
    </div>
    <div class="srow">
      <div>
        <label for="shm" style="font-weight:700;display:block">Gemeisterte Fragen im Übungsmodus ausblenden</label>
        <p class="mut" style="margin:2px 0 0">Wenn aktiv, werden bereits gemeisterte Fragen im normalen Quiz übersprungen (in Prüfungen sind immer alle Fragen enthalten).</p>
      </div>
      <input id="shm" type="checkbox" ${opts.hideMastered?'checked':''} data-chk="setHideMastered" style="width:22px;height:22px;accent-color:var(--ac);cursor:pointer">
    </div>
    <div class="srow">
      <div>
        <label for="ssh" style="font-weight:700;display:block">Antwortoptionen automatisch mischen</label>
        <p class="mut" style="margin:2px 0 0">Mischt die Reihenfolge der Antwortoptionen bei jedem Quiz- und Prüfungsdurchgang (außer bei Wahr/Falsch-Fragen).</p>
      </div>
      <input id="ssh" type="checkbox" ${opts.shuffle?'checked':''} data-chk="setShuffle" style="width:22px;height:22px;accent-color:var(--ac);cursor:pointer">
    </div>
    <div class="srow">
      <div>
        <label for="sac" style="font-weight:700;display:block">Single Choice sofort prüfen</label>
        <p class="mut" style="margin:2px 0 0">Bei Single-Choice- und Wahr/Falsch-Fragen wird die Antwort direkt beim Antippen ausgewertet.</p>
      </div>
      <input id="sac" type="checkbox" ${opts.autoCheck?'checked':''} data-chk="setAutoCheck" style="width:22px;height:22px;accent-color:var(--ac);cursor:pointer">
    </div>
    <div class="srow">
      <div>
        <label for="sth" style="font-weight:700;display:block">Erscheinungsbild (Design)</label>
        <p class="mut" style="margin:2px 0 0">Wähle zwischen automatischer Anpassung an das Betriebssystem, hellem oder dunklem Design.</p>
      </div>
      <select id="sth" class="inl" data-chg="setTheme" data-args='[]' style="font-weight:700">
        <option value="auto" ${th==='auto'?'selected':''}>System</option>
        <option value="light" ${th==='light'?'selected':''}>Hell</option>
        <option value="dark" ${th==='dark'?'selected':''}>Dunkel</option>
      </select>
    </div>
  </div>
  <h2>Vorhandene Kurse (${cnames.length})</h2>
  <p class="mut">Alle Kurse im Überblick (ohne Kapitel und Fragen). Über das Stift-Symbol lassen sich Kursname, Prüfungsfragen-Anzahl, Prüfungszeit, Notenschema, Multiple-Choice-Wertung und Minuspunkte pro Kurs anpassen.</p>
  ${cnames.length?cnames.map((c,gi)=>courseCardHtml(c,groups[c],gi,true)).join(''):`<div class="card" style="margin-top:12px"><p class="mut">Noch keine Kurse vorhanden. Importiere zuerst ein Fragenset unter „Fragen“.</p></div>`}
  <h2>Cloud-Sync (Supabase)</h2>
  <p class="mut">Synchronisiert deine Fragen, Kurseinstellungen, deinen Lernstand und dein Glossar sicher über dein Supabase-Konto zwischen Mac, iPad und iPhone – ganz ohne Access-Token.</p>
  <div id="sbbox">${sbCloudHtml()}</div>
  <details style="margin-top:16px"${gh.token?' open':''}><summary class="mut">Alternativ: Klassischer GitHub-Sync (PAT)</summary>
  <p class="mut">Synchronisiert über ein privates GitHub-Repository (<b>${SYNC_REPO}</b>).</p>
  <div id="cbox">${cloudHtml()}</div></details>
  <h2>Tastaturkürzel</h2>
  <div class="card"><p class="mut" style="margin:0"><b>Quiz:</b> 1–9 Antwort wählen · Enter oder Leertaste prüfen/weiter · M zum Bearbeiten markieren · Esc zurück.<br><b>Prüfung:</b> ←/→ Frage wechseln · L für später markieren · M zum Bearbeiten markieren · Esc abbrechen.</p></div>
  <h2>Gefahrenzone</h2>
  <div class="card"><p class="mut" style="margin-top:0">Löscht alle Fragen, Kapitel und Kurse. Bei aktivem Cloud-Sync werden auch die Cloud-Daten überschrieben.</p><button class="btn sec" data-act="wipe" data-args='["q"]'>Alle Fragen und Kurse löschen</button></div>`;
}
function searchHtml(){return `<input id="qs" type="search" class="srch" placeholder="Fragen durchsuchen …" value="${esc(qsearch)}" data-in="qSearch" data-args='[]'><div id="res">${resHtml()}</div>`}
function resHtml(){const t=qsearch.trim().toLowerCase();if(!t)return '';const r=[];sets.forEach(s=>s.qs.forEach((q,qi)=>{if((q.q+' '+q.opts.map(o=>o.t+' '+(o.why||'')).join(' ')+' '+q.exp).toLowerCase().includes(t))r.push([s,q,qi])}));
  return `<p class="mut">${r.length} Treffer</p>`+(r.length?`<div class="card">${r.slice(0,50).map(([s,q,qi])=>`<div class="qi"><button class="lnk" data-act="goQ" data-args="${esc(JSON.stringify([String(s.id)]))}"><span class="mut">${esc(s.course)} › ${esc(s.title)}</span><br>${esc(q.q)}</button><span class="gc">${qBadge(s.id,qi,q)}<button class="x${q.flagged?' warn':''}" title="${q.flagged?'Markierung aufheben':'Zum Bearbeiten markieren'}" aria-label="Markieren" data-act="togFlag" data-args="${esc(JSON.stringify([String(s.id),qi]))}">${IC.flag}</button><button class="x" title="Frage bearbeiten" aria-label="Frage bearbeiten" data-act="goQEdit" data-args="${esc(JSON.stringify([String(s.id),qi]))}">${IC.edit}</button></span></div>`).join('')}</div>`+(r.length>50?'<p class="mut">Es werden nur die ersten 50 Treffer angezeigt.</p>':''):'')}
function qSearch(v){qsearch=v;$app.classList.toggle('searching',!!v.trim());document.getElementById('res').innerHTML=resHtml()}
function goQ(id){const s=sets.find(x=>x.id===id);qsearch='';exp.add(id);saveExp();if(s&&col.has(s.course)){col.delete(s.course);saveCol()}home()}
function goQEdit(id,qi){const s=sets.find(x=>x.id===id);qsearch='';exp.add(id);saveExp();if(s&&col.has(s.course)){col.delete(s.course);saveCol()}startQEdit(id,qi);setTimeout(()=>{const el=document.getElementById('eq_q');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});el.focus()}},30)}
function startGNew(gi){
  const c=gi!==undefined&&gcnames[gi]?gcnames[gi]:'';
  const defC=c||selCourses()[0]||allCourses()[0]||'';
  if(c&&gcol.has(c)){gcol.delete(c);saveGCol()}
  gedit='__new__';gdraft={c:defC,b:'',i:'',a:'',targetC:c};gerr='';gpend=null;gcpend=null;gcedit=null;wp=null;glosView();
  setTimeout(()=>{const el=document.getElementById(defC?'eb':'ec');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});el.focus()}},30);
}
function startGEdit(k){
  const g=gloss[k];if(!g)return;
  gq='';if(gcol.has(g.course)){gcol.delete(g.course);saveGCol()}
  gedit=k;gdraft={c:g.course,b:g.b,i:g.i,a:g.a.join(', '),targetC:''};gerr='';gpend=null;gcpend=null;gcedit=null;wp=null;glosView();
  setTimeout(()=>{const el=document.getElementById('eb');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});el.focus()}},30);
}
function startGCEdit(gi){
  gcedit=gi;gcdraft=gcnames[gi]||'';gcerr='';gcpend=null;gpend=null;gedit=null;gdraft=null;wp=null;glosView();
}
function cancelGCEdit(){gcedit=null;gcdraft='';gcerr='';glosView()}
function saveGCEdit(gi){
  const old=gcnames[gi],el=document.getElementById('gecn'),nw=(el?el.value:gcdraft).trim();
  gcdraft=el?el.value:gcdraft;
  if(!nw){gcerr='Kursname darf nicht leer sein.';glosView();return}
  const canonC=allCourses().find(x=>x!==old&&norm(x)===norm(nw))||nw;
  if(canonC!==old){
    gloss.forEach(g=>{if(g.course===old)g.course=canonC});
    dedupGloss();
    if(gcol.has(old)){gcol.delete(old);gcol.add(canonC);saveGCol()}
    saveGloss(true);
  }
  gcedit=null;gcdraft='';gcerr='';glosView();
}
function delGC(gi){gcpend=gcpend===gi?null:gi;gpend=null;gcedit=null;wp=null;glosView()}
function delGC2(gi){
  const c=gcnames[gi];
  if(c!==undefined){
    gloss=gloss.filter(g=>g.course!==c);
    gcol.delete(c);saveGCol();saveGloss(true);
  }
  gcpend=null;gpend=null;gcedit=null;glosView();
}
function gRow(g,k,showCourse){
  return `<div class="gi"><div>${showCourse?`<span class="mut" style="display:block;font-size:.82rem;margin-bottom:1px">${esc(g.course)}</span>`:''}<b>${esc(g.b)}</b>${g.a.length?`<span class="mut"> · ${esc(g.a.join(', '))}</span>`:''}<p class="mut" style="margin:.2em 0 0">${esc(g.i)}</p></div>${gpend===k?`<span class="gc"><span class="mut">Löschen?</span><button class="btn sm" data-act="delG" data-args="${esc(JSON.stringify([k]))}">Ja</button><button class="btn sec sm" data-act="_h11">Nein</button></span>`:`<span class="gc"><button class="x" title="Begriff bearbeiten" aria-label="Begriff bearbeiten" data-act="startGEdit" data-args="${esc(JSON.stringify([k]))}">${IC.edit}</button><button class="x" title="Begriff löschen" aria-label="Begriff löschen" data-act="_h12" data-args="${esc(JSON.stringify([k]))}">${IC.del}</button></span>`}</div>`;
}
function gForm(g,k){
  const isNew=k==='__new__',d=gdraft||{c:g.course||'',b:isNew?'':g.b,i:g.i,a:g.a.join(', ')};
  return `<div class="gi ge"><div style="width:100%">${isNew?'<b style="display:block;margin-bottom:6px;color:var(--ac)">Neuen Begriff hinzufügen</b>':''}<label class="mut" for="ec">Kurs</label><input id="ec" list="cl" value="${esc(d.c)}" placeholder="Name des Kurses"><label class="mut" for="eb">Begriff</label><input id="eb" value="${esc(d.b)}"><label class="mut" for="ei">Erklärung</label><textarea id="ei" style="min-height:90px">${esc(d.i)}</textarea><label class="mut" for="ea">Alias (durch Komma getrennt)</label><input id="ea" value="${esc(d.a)}"><p class="err" role="alert">${esc(gerr)}</p><div class="row act"><button class="btn sm" type="button" data-act="saveG" data-args="${esc(JSON.stringify([isNew?'__new__':k]))}">${isNew?'Anlegen':'Speichern'}</button><button class="btn sec sm" type="button" data-act="_h13">Abbrechen</button></div></div></div>`;
}
function gCourseCardHtml(c,l,gi){
  const on=isGSel(c),cCol=on?'--ac':'--ink';
  const sub=`<span class="mut" style="display:block;font-size:.82rem;margin-bottom:1px">${l.length} ${l.length===1?'Begriff':'Begriffe'}${on?' · ✓ Aktiv':''}</span><b>${esc(c)}</b>`;
  return `<div class="card ccard" style="margin:14px 0 8px;padding:12px 16px;border-left:4px solid var(${cCol})"><div class="crs"><button class="chb" style="padding:2px 0" aria-expanded="${!gcol.has(c)}" data-act="gfold" data-args="${esc(JSON.stringify([gi]))}"><span>${gcol.has(c)?'▸':'▾'}</span><span>${sub}</span></button><span class="gc"><button class="x" title="Neuen Begriff zu diesem Kurs hinzufügen" aria-label="Neuen Begriff hinzufügen" data-act="startGNew" data-args="${esc(JSON.stringify([gi]))}">${IC.plus}</button><button class="x" title="Glossar dieses Kurses exportieren" aria-label="Kurs-Glossar exportieren" data-act="exportGC" data-el data-args="${esc(JSON.stringify([gi]))}">${IC.exp}</button><button class="x" title="Kursname bearbeiten" aria-label="Kursname bearbeiten" data-act="startGCEdit" data-args="${esc(JSON.stringify([gi]))}">${IC.edit}</button>${gcpend===gi?`<span class="mut">Löschen?</span><button class="btn sm" data-act="delGC2" data-args="${esc(JSON.stringify([gi]))}">Ja</button><button class="btn sec sm" data-act="delGC" data-args="${esc(JSON.stringify([gi]))}">Nein</button>`:`<button class="x" title="Glossar dieses Kurses löschen" aria-label="Kurs-Glossar löschen" data-act="delGC" data-args="${esc(JSON.stringify([gi]))}">${IC.del}</button>`}</span></div>${gcedit===gi?`<div class="ge" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)"><label class="mut" for="gecn">Kursname bearbeiten</label><input id="gecn" list="cl" value="${esc(gcdraft)}"><p class="err" role="alert">${esc(gcerr)}</p><div class="row act"><button class="btn sm" data-act="saveGCEdit" data-args="${esc(JSON.stringify([gi]))}">Speichern</button><button class="btn sec sm" data-act="cancelGCEdit" data-args='[]'>Abbrechen</button></div></div>`:''}</div>`;
}
function gResHtml(){
  const t=gq.trim().toLowerCase();if(!t)return '';
  const r=gloss.map((g,k)=>({g,k})).filter(({g})=>(g.course+' '+g.b+' '+g.a.join(' ')+' '+g.i).toLowerCase().includes(t)).sort((a,b)=>a.g.b.localeCompare(b.g.b,'de'));
  const byC={};r.forEach(x=>(byC[x.g.course]=byC[x.g.course]||[]).push(x));
  const crsList=Object.keys(byC).sort((a,b)=>(isGSel(b)?1:0)-(isGSel(a)?1:0));
  const info=r.length?(crsList.length===1?`<b>${r.length}</b> Treffer im Kurs „<b>${esc(crsList[0])}</b>“`:`<b>${r.length}</b> Treffer in <b>${crsList.length}</b> Kursen (${crsList.map(c=>`„<b>${esc(c)}</b>“`).join(', ')})`):`Keine Treffer (gesucht in ${gcnames.length===1?`Kurs „<b>${esc(gcnames[0])}</b>“`:`allen <b>${gcnames.length}</b> Kursen`})`;
  return `<p class="mut">${info}</p>`+crsList.map(c=>{
    const l=byC[c],on=isGSel(c),cCol=on?'--ac':'--ink';
    return `<div class="card" style="margin:12px 0 8px;padding:12px 16px;border-left:4px solid var(${cCol})"><span class="mut" style="display:block;font-size:.82rem;margin-bottom:1px">Kurs · ${l.length} Treffer${on?' · ✓ Aktiv':''}</span><b style="font-size:1.1rem">${esc(c)}</b></div><div style="margin:0 0 16px 12px"><div class="card"><div class="ggrid">${l.map(({g,k})=>gRow(g,k,true)).join('')}</div></div></div>`;
  }).join('');
}
function glosView(){
  stopExamTimer();curView='g';$app.className=gq.trim()?'searching':'';
  const ggroups={};gloss.forEach((g,k)=>(ggroups[g.course]=ggroups[g.course]||[]).push({g,k}));gcnames=Object.keys(ggroups);
  const actC=selCourses()[0]||'',actCnt=actC?gloss.filter(g=>norm(g.course)===norm(actC)).length:0;
  const sPh=gcnames.length===1?`Glossar im Kurs „${esc(gcnames[0])}“ durchsuchen …`:`Glossar in allen ${gcnames.length} Kursen durchsuchen${actC?` (aktiv: ${esc(actC)})`:''} …`;
  const dl=`<datalist id="cl">${allCourses().map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`;
  const topNew=gedit==='__new__'&&(!gdraft||!gdraft.targetC||!ggroups[gdraft.targetC]);
  $app.innerHTML=`${nav('g')}<h1>${IC.book}<span>Glossar</span></h1><p class="mut">Fachbegriffe aus deinen Vorlesungsunterlagen pro Kurs verwalten und nachschlagen.</p>
  <div class="row act" style="margin:12px 0 6px"><button class="btn sec ico" title="Glossar importieren" aria-label="Glossar importieren" data-act="imp" data-args='["glossar"]'>${IC.imp}</button><button class="btn sec sm" style="min-height:40px" data-act="startGNew" data-args='[]'>+ Begriff hinzufügen</button>${gloss.length?`<button class="btn sec ico" title="Alle Glossare exportieren" aria-label="Glossar exportieren" data-act="exportG" data-el>${IC.exp}</button><span class="gc" style="gap:8px">${wp==='g'?`<span class="mut">Löschen?</span><button class="btn sm" data-act="wipe" data-args='["g"]'>Ja</button><button class="btn sec sm" data-act="_h14">Nein</button>`:`<button class="btn sec ico" title="Gesamtes Glossar löschen" aria-label="Gesamtes Glossar löschen" data-act="_h15">${IC.del}</button>`}</span>`:''}</div>
  ${gloss.length?`<p class="mut" style="margin:8px 0 4px">${actC?`<b>${actCnt}</b> ${actCnt===1?'Begriff':'Begriffe'} für den ausgewählten Kurs „<b>${esc(actC)}</b>“ aktiv · `:''}Insgesamt <b>${gloss.length}</b> ${gloss.length===1?'Begriff':'Begriffe'} in <b>${gcnames.length}</b> ${gcnames.length===1?'Kurs':'Kursen'}.</p><input id="gs" type="search" class="srch" placeholder="${sPh}" value="${esc(gq)}" data-in="gSearch" data-args='[]'><div id="gres">${gResHtml()}</div>`:''}${dl}
  ${topNew?`<div class="card" style="margin-top:14px">${gForm({course:(gdraft&&gdraft.c)||'',b:'__new__',i:'',a:[]},'__new__')}</div>`:''}
  ${gloss.length?Object.entries(ggroups).map(([c,l],gi)=>{
    const sorted=l.slice().sort((a,b)=>a.g.b.localeCompare(b.g.b,'de'));
    const inNew=gedit==='__new__'&&gdraft&&gdraft.targetC===c;
    return gCourseCardHtml(c,l,gi)+(gcol.has(c)?'':`<div class="grp" style="margin:0 0 16px 12px"><div class="card"><div class="ggrid">${sorted.map(({g,k})=>gedit===k?gForm(g,k):gRow(g,k,false)).join('')}${inNew?gForm({course:c,b:'__new__',i:'',a:[]},'__new__'):''}</div>${inNew?'':`<div style="margin-top:8px;padding-top:10px;border-top:1px dashed var(--bd)"><button class="btn sec sm" type="button" data-act="startGNew" data-args="${esc(JSON.stringify([gi]))}">+ Begriff hinzufügen</button></div>`}</div></div>`);
  }).join(''):(topNew?'':`<div class="card" style="margin-top:18px"><p><b>Noch keine Begriffe vorhanden.</b></p><p class="mut">Importiere ein Kurs-Glossar als JSON oder füge einen neuen Begriff hinzu.</p></div>`)}`;
}
function gSearch(v){gq=v;$app.classList.toggle('searching',!!v.trim());const el=document.getElementById('gres');if(el)el.innerHTML=gResHtml()}
function saveG(k){
  const cEl=document.getElementById('ec'),bEl=document.getElementById('eb'),iEl=document.getElementById('ei'),aEl=document.getElementById('ea');
  const rawC=cEl?cEl.value:'',rawB=bEl?bEl.value:'',rawI=iEl?iEl.value:'',rawA=aEl?aEl.value:'';
  const c=rawC.trim(),b=rawB.trim(),i=rawI.trim(),a=rawA.split(',').map(x=>x.trim()).filter(Boolean);
  gdraft={c:rawC,b:rawB,i:rawI,a:rawA,targetC:(gdraft&&gdraft.targetC)||''};
  if(!c||!b||!i){gerr='Kurs, Begriff und Erklärung dürfen nicht leer sein.';glosView();return}
  const canonC=allCourses().find(x=>norm(x)===norm(c))||c;
  if(gloss.some((g,idx)=>idx!==k&&norm(g.course)===norm(canonC)&&g.b.toLowerCase()===b.toLowerCase())){gerr='Diesen Begriff gibt es in diesem Kurs schon.';glosView();return}
  if(k==='__new__'){gloss.push({course:canonC,b,i,a})}else if(gloss[k]){gloss[k]={course:canonC,b,i,a}}
  if(gcol.has(canonC)){gcol.delete(canonC);saveGCol()}
  gedit=null;gdraft=null;gerr='';
  saveGloss();glosView();
}
function delG(k){if(gloss[k])gloss.splice(k,1);gpend=null;saveGloss(true);glosView()}
let impMode='fragen';
function imp(m){curView='i';impMode=m||'fragen';$app.className='';
  const allC=allCourses(),dl=`<datalist id="cl">${allC.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`;
  const fi=`<label class="btn sec" style="position:relative;overflow:hidden;display:inline-flex;align-items:center;cursor:pointer">Datei wählen<input id="fi" type="file" accept=".json,application/json,text/plain" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer" data-act="_clr" data-el data-chg="fromFile" data-el></label>`;
  if(impMode==='glossar'){
    gen={name:'',f:KINDS.map(x=>x[0])};
    $app.innerHTML=`${nav('g')}<h1>${IC.imp}<span>Glossar importieren</span></h1><p class='mut'>Füge das JSON von Claude ein, ziehe eine .json-Datei in das Feld oder wähle sie über „Datei wählen“. Gleiche Begriffe desselben Kurses werden aktualisiert.</p><textarea id='t' placeholder='JSON hier einfügen oder .json-Datei hierher ziehen …' data-dragover="_pd" data-drop="dropFile"></textarea><p class='err' id='e' role="alert">${esc(msg)}</p><div class='row'><button class='btn' data-act='doImp'>Importieren</button>${fi}<button class='btn sec' data-act="_h16">Zurück</button></div><h2>Für jeden Kurs</h2><p class='mut'>Lade deine Unterlagen in Claude hoch und kopiere diesen Auftrag dazu. Gib den Kursnamen ein, dann trägt der Auftrag ihn automatisch ein.</p><label>Kursname <input id="gcn" list="cl" data-in="gGName" data-args='[]' style="width:100%;margin-top:4px;background:var(--card);border:1px solid var(--bd);border-radius:6px;padding:8px"></label>${dl}<div id="ggen"></div>`;
    renderGGen();toTop();return;
  }
  $app.innerHTML=`${nav('q')}<h1>${IC.imp}<span>Fragen importieren</span></h1>
  <p class="mut">Füge das JSON von Claude ein, ziehe eine .json-Datei in das Feld oder lade sie über „Datei wählen“. Mehrere Kapitel in einer Liste sind möglich.</p>
  <textarea id="t" placeholder="JSON hier einfügen oder .json-Datei hierher ziehen …" data-dragover="_pd" data-drop="dropFile"></textarea>
  <p class="err" id="e">${esc(msg)}</p>
  <div class="row"><button class="btn" data-act="doImp" data-args='[]'>Importieren</button>
  ${fi}
  <button class="btn sec" data-act="_h17">Zurück</button></div>
  <h2>Für jeden neuen Kurs</h2>
  <p class="mut">Lade deine Unterlagen in Claude hoch und kopiere diesen Auftrag dazu. Ersetze [ANZAHL] durch die gewünschte Zahl. Gib den Kursnamen ein, dann trägt der Auftrag ihn automatisch ein.</p>
  <label>Kursname <input id="cn" list="cl" data-in="gName" data-args='[]' style="width:100%;margin-top:4px;background:var(--card);border:1px solid var(--bd);border-radius:6px;padding:8px"></label>
  ${dl}
  <div id="gen"></div>`;
  gen={name:'',f:KINDS.map(x=>x[0])};renderGen();toTop();
}
function readAndImp(f){
  if(!f)return;
  const r=new FileReader();
  r.onload=()=>{const t=document.getElementById('t');if(t)t.value=r.result;doImp()};
  r.onerror=()=>{const e=document.getElementById('e');if(e)e.textContent='Datei konnte nicht gelesen werden.'};
  r.readAsText(f);
}
function fromFile(i){const f=i.files&&i.files[0];if(f)readAndImp(f);i.value=''}
function dropFile(ev){ev.preventDefault();const f=ev.dataTransfer&&ev.dataTransfer.files&&ev.dataTransfer.files[0];if(f)readAndImp(f)}
function mergeSets(incoming){
  let cfgChanged=false,lastCourse='';
  incoming.forEach(ns=>{
    let ex=sets.find(s=>norm(s.course)===norm(ns.course)&&norm(s.title)===norm(ns.title));
    if(!ex){ex={id:ns.id,course:ns.course.trim(),title:ns.title.trim(),qs:[]};sets.push(ex)}
    if(ex.course)lastCourse=ex.course;
    if(ns.cfg&&ex.course){
      const c=ex.course,cf=ns.cfg;
      ensureCfgMaps();
      if(+cf.fragenAnzahl>0){opts.cqcount[c]=Math.max(1,+cf.fragenAnzahl);cfgChanged=true}
      if(+cf.zeitMinuten>0){opts.ctime[c]=Math.max(1,+cf.zeitMinuten);cfgChanged=true}
      if([50,60,70].includes(+cf.positivAb)){opts.cpass[c]=+cf.positivAb;cfgChanged=true}
      if(SCORE_MODES.includes(cf.mcWertung)){opts.cmode[c]=cf.mcWertung;cfgChanged=true}
      if(NEG_MODES.includes(cf.minuspunkte)){opts.cneg[c]=cf.minuspunkte;cfgChanged=true}
    }
    ns.qs.forEach(nq=>{
      const eq=ex.qs.find(q=>norm(q.q)===norm(nq.q));
      if(eq){
        eq.type=nq.type;eq.fixed=nq.fixed;eq.exp=nq.exp;eq.opts=nq.opts;
        eq.streak=Math.max(eq.streak||0,nq.streak||0);
        eq.wrong=nq.streak>0?false:(nq.wrong??eq.wrong);
        eq.flagged=!!(eq.flagged||nq.flagged);
      }else{
        ex.qs.push(nq);
      }
    });
    sel.add(ex.id);
  });
  enforceSingleCourse(lastCourse);
  if(cfgChanged)saveO();
  saveSel();
}
function importStats(n){
  const sig=q=>jj([q.type,!!q.fixed,q.exp||'',(q.opts||[]).map(o=>[o.t,!!o.ok,o.why||''])]);let neu=0,upd=0,same=0;
  n.forEach(ns=>{const ex=sets.find(x=>norm(x.course)===norm(ns.course)&&norm(x.title)===norm(ns.title));
    ns.qs.forEach(nq=>{const eq=ex&&ex.qs.find(q=>norm(q.q)===norm(nq.q));if(!eq)neu++;else if(sig(eq)!==sig(nq))upd++;else same++})});
  return{neu,upd,same}}
function doImp(){
  try{
    const raw=document.getElementById('t').value;
    if(impMode==='glossar'){
      const defC=(gen.name||'').trim()||selCourses()[0]||allCourses()[0]||'Ohne Kurs';
      addGloss(parseGloss(raw,defC));msg='';glos();return;
    }
    const n=parseSets(raw);
    if(!n.length)throw new Error('Keine Fragen gefunden. Ein Glossar importierst du unter „Glossar importieren“.');
    const apply=()=>{
      mergeSets(n);
      try{const d=JSON.parse(cleanJson(raw));const gl=extractGloss(d,n[0]&&n[0].course);if(gl.length)addGloss(gl,true);saveGloss(true)}catch(e){}
      save();msg='';home();
    },st=importStats(n);
    if(st.upd)appDialog(`Import: ${st.neu} neue, ${st.upd} geänderte (lokale Änderungen daran werden überschrieben), ${st.same} unverändert. Importieren?`,apply);
    else apply();
  }
  catch(e){document.getElementById('e').textContent=e.message}
}

let liveEl=null,lastSS='idle';
function announce(t){if(!liveEl){liveEl=document.createElement('div');liveEl.setAttribute('role','status');liveEl.setAttribute('aria-live','polite');liveEl.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';document.body.appendChild(liveEl)}liveEl.textContent='';setTimeout(()=>{liveEl.textContent=t},50)}
function clip(t,b){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{b.textContent='Kopiert';announce('Kopiert')}).catch(()=>{b.textContent='Kopieren nicht möglich'})}
function renderGen(){const el=document.getElementById('gen');if(!el)return;
  el.innerHTML=`<button class="btn sec" data-act="copyG" data-el>Auftrag kopieren</button><details><summary>Auftrag anzeigen</summary><pre>${esc(promptFor(gen.name.trim(),gen.f))}</pre></details>`}
function renderGGen(){const el=document.getElementById('ggen');if(!el)return;
  const p=gpromptFor(gen.name.trim());
  el.innerHTML=`<button class="btn sec" data-act="_clipP" data-el>Auftrag kopieren</button><details><summary>Auftrag anzeigen</summary><pre>${esc(p)}</pre></details>`}
function saveGen(){const n=gen.name.trim();if(n){courses[n]=gen.f.slice();saveC()}}
function gName(v){gen.name=v;const c=courses[v.trim()];if(c)gen.f=c.slice();renderGen()}
function gGName(v){gen.name=v;renderGGen()}
function copyG(b){saveGen();clip(promptFor(gen.name.trim(),gen.f),b)}

function weightedPick(cands,count){
  const pool=cands.slice(),out=[];
  while(out.length<count&&pool.length){
    const ws=pool.map(q=>Math.max(1,qWeight(q._ref||q)));
    const sum=ws.reduce((a,b)=>a+b,0);
    let r=Math.random()*sum,pickIdx=pool.length-1;
    for(let i=0;i<pool.length;i++){r-=ws[i];if(r<=0){pickIdx=i;break}}
    out.push(pool.splice(pickIdx,1)[0]);
  }
  return out;
}

function start(pool){
  stopExamTimer();examMode=false;
  let qs;
  if(pool)qs=shuf(pool);
  else{
    enforceSingleCourse();
    const cands=[];
    [...sel].forEach(id=>{const s=sets.find(x=>x.id===id);if(s)pool1(s).forEach(q=>cands.push({...q,_ref:q._ref||q,_course:s.course,_title:s.title}))});
    qs=weightedPick(shuf(cands),Math.min(getQuizCount(),cands.length));
  }
  Q=qs.map(q=>{const ref=q._ref||q;return{...ref,_ref:ref,_course:q._course||'',_title:q._title||'',_newlyMastered:false,opts:(opts.shuffle&&!ref.fixed)?shuf(ref.opts):ref.opts.slice()}});
  idx=0;log=[];picked=new Set();examPicks=Q.map(()=>new Set());checked=false;gopen=0;quiz();toTop();
}
function startExam(){
  stopExamTimer();
  enforceSingleCourse();
  const selSets=[...sel].map(id=>sets.find(x=>x.id===id)).filter(s=>s&&s.qs.length);
  if(!selSets.length)return;
  examCourse=selSets[0].course||'';
  examDurMins=getExamMins(examCourse);
  const totalAll=selSets.reduce((a,s)=>a+s.qs.length,0),target=Math.min(getExamCount(examCourse),totalAll);
  const pools=selSets.map(s=>{const exact=s.qs.length/totalAll*target;return{s,qs:shuf(s.qs),take:Math.floor(exact),rem:exact-Math.floor(exact)}});
  let left=target-pools.reduce((a,p)=>a+p.take,0);
  shuf(pools).sort((a,b)=>b.rem-a.rem).forEach(p=>{if(left>0&&p.take<p.qs.length){p.take++;left--}});
  const cands=[];
  pools.forEach(p=>p.qs.slice(0,p.take).forEach(q=>cands.push({...q,_ref:q._ref||q,_course:p.s.course,_title:p.s.title})));
  const qs=shuf(cands);
  Q=qs.map(q=>{const ref=q._ref||q;return{...ref,_ref:ref,_course:q._course||'',_title:q._title||'',_newlyMastered:false,opts:(opts.shuffle&&!ref.fixed)?shuf(ref.opts):ref.opts.slice()}});
  examMode=true;idx=0;log=[];examPicks=Q.map(()=>new Set());examMarks=new Set();examSubPend=false;examExitPend=false;examTimeUp=false;checked=false;
  examStart=Date.now();examEnd=examStart+examDurMins*60000;
  examTimer=setInterval(tickExam,1000);
  quiz();toTop();saveExam();
}
function tickExam(){
  if(curView!=='z'||!examMode){stopExamTimer();return}
  const rem=Math.max(0,Math.ceil((examEnd-Date.now())/1000));
  const el=document.getElementById('etimer');
  if(el){
    el.textContent='⏱ '+fmtTime(rem);
    el.className='badge'+(rem<=60?' bad':rem<=300?' warn':'');
  }
  if(rem<=0)finishExam(true);
}
function goExamQ(k){
  if(k<0||k>=Q.length)return;
  idx=k;examSubPend=false;examExitPend=false;saveExam();quiz();toTop();
}
function togExamMark(){
  if(!examMode)return;
  examMarks.has(idx)?examMarks.delete(idx):examMarks.add(idx);saveExam();
  quiz();
}
function tryExitExam(){
  const ansCnt=examPicks.filter(p=>p.size>0).length;
  if(ansCnt>0&&!examExitPend){examExitPend=true;quiz();return}
  examExitPend=false;home();
}
function tryFinishExam(){
  const ansCnt=examPicks.filter(p=>p.size>0).length;
  if(ansCnt<Q.length&&!examSubPend){examSubPend=true;quiz();return}
  finishExam(false);
}
function finishExam(timeUp){
  stopExamTimer();
  examTimeUp=!!timeUp;examSubPend=false;examExitPend=false;
  examElapsed=Math.min(examDurMins*60,Math.max(1,Math.round((Date.now()-examStart)/1000)));
  const nowMs=Date.now();
  Q.forEach((q,i)=>{
    const src=q._ref||q,wasM=isMastered(src),p=examPicks[i]||new Set();
    const ok=p.size>0&&q.opts.every((o,k)=>o.ok===p.has(k));
    log[i]=ok;
    if(ok){src.streak=(src.streak||0)+1;src.wrong=false;q._newlyMastered=!wasM&&isMastered(src);updateSrs(src,true,nowMs)}
    else if(p.size>0){src.streak=0;src.wrong=true;q._newlyMastered=false;updateSrs(src,false,nowMs)}
    else{q._newlyMastered=false}
  });
  const attempt=buildExamAttempt({
    course:examCourse,
    questions:Q,
    picks:examPicks,
    elapsedSec:examElapsed,
    durationMins:examDurMins,
    passPct:getPass(examCourse),
    scoreMode:getScoreMode(examCourse),
    negMode:getNegMode(examCourse)
  });
  examHistory=[attempt,...examHistory].slice(0,200);
  try{localStorage.setItem('pt:exams',JSON.stringify(examHistory))}catch(e){}
  save();result();
}
function quiz(){curView='z';
  const q=Q[idx],src=q._ref||q,multi=q.type==='multi',tiles=q.opts.every(o=>o.t.length<=55);
  if(examMode){
    const curP=examPicks[idx]||new Set(),ansCnt=examPicks.filter(p=>p.size>0).length,rem=Math.max(0,Math.ceil((examEnd-Date.now())/1000)),sm=getScoreMode(examCourse),nm=getNegMode(examCourse);
    const eHint=multi?(sm==='opt'?`Mehrere Antworten können richtig sein (${q.opts.length} Pkt. – jede Option zählt inkl. Nicht-Ankreuzen${nm==='clamp'?' · −1 Pkt. je Fehler, min. 0':nm==='full'?' · −1 Pkt. je Fehler':''}).`:sm==='pos'?`Mehrere Antworten können richtig sein (+1 Pkt. je richtiger Antwort${nm==='clamp'?' · −1 Pkt. je falscher Wahl, min. 0':nm==='full'?' · −1 Pkt. je falscher Wahl':''}).`:sm==='part'?`Mehrere Antworten können richtig sein (1 Pkt. anteilig über alle Optionen${nm==='clamp'?' · mit Abzug, min. 0':nm==='full'?' · mit Abzug':''}).`:`Mehrere Antworten können richtig sein (1 Pkt. für die gesamte Frage${nm==='full'?' · −1 Pkt. bei Fehler':''}).`):(nm==='full'?'1 Punkt bei richtiger Antwort · −1 Punkt bei falscher Antwort (Offen = 0 Punkte).':'');
    $app.className='wide';$app.innerHTML=`<div class='cols'><div class='qhead'><div class="row" style="justify-content:space-between"><span class="mut">Prüfung · Frage ${idx+1} von ${Q.length}${q._title?` · ${esc(q._title)}`:''}</span><span class="gc"><span id="etimer" class="badge${rem<=60?' bad':rem<=300?' warn':''}" style="cursor:default;font-variant-numeric:tabular-nums" title="Verbleibende Prüfungszeit">⏱ ${fmtTime(rem)}</span><button class="badge${examMarks.has(idx)?' warn':''}" title="Frage in dieser Prüfung zur Kontrolle vormerken (Taste L)" data-act="togExamMark" data-args='[]'>⚑ ${examMarks.has(idx)?'Vorgemerkt':'Später prüfen'}</button><button class="badge${src.flagged?' warn':''}" title="Frage zum späteren Bearbeiten markieren (Taste M)" aria-label="Zum Bearbeiten markieren" data-act="togQuizFlag" data-args='[]'>${IC.flag}</button>${examExitPend?`<span class="mut">Prüfung abbrechen?</span><button class="btn sm" data-act="_h18">Ja</button><button class="btn sec sm" data-act="_h19">Nein</button>`:`<button class="btn sec sm" data-act="tryExitExam" data-args='[]'>Zurück zur Übersicht</button>`}</span></div>
    <div class="bar" role="progressbar" aria-label="Fortschritt"><i style="width:${ansCnt/Q.length*100}%"></i></div>
    <p class="q">${esc(q.q)}</p>${eHint?`<p class="mut">${eHint}</p>`:''}</div><div class='qmain'><div class='opts${tiles?' tiles':''}'>
    ${q.opts.map((o,i)=>{
      const selOpt=curP.has(i),c='opt'+(multi?' multi':'')+(selOpt?' sel':''),mk=selOpt?(multi?'✓':'●'):'';
      return `<button class="${c}" data-act="pick" data-args="${esc(JSON.stringify([i]))}" aria-pressed="${selOpt}"><span class="m">${mk}</span><span>${esc(o.t)}</span></button>`}).join('')}
    </div><div class='qfoot'>
    <div class="row"><button class="btn sec" ${idx===0?'disabled':''} data-act="goExamQ" data-args="${esc(JSON.stringify([idx-1]))}">← Zurück</button>${idx+1<Q.length?`<button class="btn" data-act="goExamQ" data-args="${esc(JSON.stringify([idx+1]))}">Weiter →</button>`:`<button class="btn" data-act="tryFinishExam" data-args='[]'>Prüfung abgeben</button>`}</div></div></div><div class='side'>${examSide()}</div></div>`;
    return;
  }
  $app.className='wide';$app.innerHTML=`<div class='cols'><div class='qhead'><div class="row" style="justify-content:space-between"><span class="mut">Frage ${idx+1} von ${Q.length}</span><span class="gc"><button class="badge${src.flagged?' warn':''}" title="Frage zum späteren Bearbeiten markieren (Taste M)" data-act="togQuizFlag" data-args='[]'>${IC.flag} ${src.flagged?'Markiert':'Später bearbeiten'}</button><button class="btn sec sm" data-act="leaveQuiz" data-args='[]'>Zurück zur Übersicht</button></span></div>
  <div class="bar" role="progressbar" aria-label="Fortschritt"><i style="width:${(idx+(checked?1:0))/Q.length*100}%"></i></div>
  <p class="q">${esc(q.q)}</p>${multi?'<p class="mut">Mehrere Antworten können richtig sein.</p>':''}</div><div class='qmain'><div class='opts${tiles?' tiles':''}'>
  ${q.opts.map((o,i)=>{
    let c='opt'+(multi?' multi':''),mk='';
    if(!checked){if(picked.has(i)){c+=' sel';mk=multi?'✓':''}}
    else{const p=picked.has(i);if(o.ok&&p){c+=' ok';mk='✓'}else if(o.ok){c+=' ok miss';mk='✓'}else if(p){c+=' bad';mk='✕'}}
    return `<button class="${c}" ${checked?'disabled':''} data-act="pick" data-args="${esc(JSON.stringify([i]))}" aria-pressed="${picked.has(i)}"><span class="m">${mk}</span><span>${esc(o.t)}${checked&&o.why?`<span class="why">${esc(o.why)}</span>`:''}</span></button>`}).join('')}
  </div><div class='qfoot'>
  <div class="row">${checked?`<button class="btn" data-act="next" data-args='[]'>${idx+1<Q.length?'Weiter':'Ergebnis anzeigen'}</button>`:`<button class="btn" ${picked.size?'':'disabled'} data-act="check" data-args='[]'>Antwort prüfen</button>`}</div></div></div><div class='side'>${side(q)}</div></div>`;
}
let okFlag=false,histBusy=false;
function syncHist(){try{
  if(curView!=='q'&&!(history.state&&history.state.v))history.pushState({v:1},'');
  else if(curView==='q'&&history.state&&history.state.v){histBusy=true;history.back()}
}catch(e){}}
window.addEventListener('popstate',()=>{
  if(histBusy){histBusy=false;return}
  if(curView==='q')return;
  if(curView==='z'){history.pushState({v:1},'');examMode?tryExitExam():leaveQuiz()}else home();
});
/* Eigener Bestätigungsdialog (window.confirm/prompt sind in eingebetteten Umgebungen oft blockiert) */
function appDialog(msg,onYes,word){
  const prev=document.activeElement,o=document.createElement('div');
  o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
  o.style.cssText='position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px';
  o.innerHTML='<div style="background:Canvas;color:CanvasText;max-width:420px;width:100%;padding:18px;border-radius:12px;border:2px solid var(--ink)"><p style="margin:0 0 12px"></p>'+(word?'<input style="width:100%;margin-bottom:12px" autocomplete="off" aria-label="Bestätigung">':'')+'<div class="row" style="justify-content:flex-end"><button class="btn sec sm" data-n>Abbrechen</button><button class="btn sm" data-y>OK</button></div></div>';
  o.querySelector('p').textContent=msg;
  const inp=o.querySelector('input'),close=()=>{o.remove();if(prev&&prev.focus&&document.contains(prev))prev.focus({preventScroll:true})},
  yes=()=>{if(word&&(!inp||inp.value.trim()!==word)){inp&&inp.focus();return}close();onYes()};
  o.querySelector('[data-n]').onclick=close;o.querySelector('[data-y]').onclick=yes;
  o.addEventListener('click',e=>{if(e.target===o)close()});
  o.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close();else if(e.key==='Enter'&&e.target.tagName==='INPUT')yes()});
  document.body.appendChild(o);(inp||o.querySelector('[data-y]')).focus();
}
function leaveQuiz(){if(!log.some(v=>v!==undefined))home();else appDialog('Quiz beenden? Das Ergebnis dieser Runde geht verloren.',home)}
function pick(i){
  if(examMode){
    const curP=examPicks[idx]||(examPicks[idx]=new Set());
    if(Q[idx].type==='multi'){curP.has(i)?curP.delete(i):curP.add(i)}else{examPicks[idx]=new Set([i])}
    examSubPend=false;examExitPend=false;saveExam();quiz();return;
  }
  if(checked)return;
  if(Q[idx].type==='multi'){picked.has(i)?picked.delete(i):picked.add(i)}else{picked=new Set([i])}
  if(opts.autoCheck&&Q[idx].type!=='multi'){check();return}
  quiz();
}
function check(){
  const q=Q[idx],src=q._ref||q,wasM=isMastered(src),ok=q.opts.every((o,i)=>o.ok===picked.has(i));
  examPicks[idx]=new Set(picked);
  checked=true;gopen=0;log[idx]=ok;
  if(ok){src.streak=(src.streak||0)+1;src.wrong=false;q._newlyMastered=!wasM&&isMastered(src)}
  else{src.streak=0;src.wrong=true;q._newlyMastered=false}
  updateSrs(src,ok);
  save();quiz();
}
function next(){picked=new Set();checked=false;gopen=0;idx++;idx<Q.length?quiz():result();toTop()}

function examSide(){
  const ansCnt=examPicks.filter(p=>p.size>0).length,openCnt=Q.length-ansCnt;
  return `<div class="card"><div class="row" style="justify-content:space-between"><b>Fragenübersicht</b><span class="mut">${ansCnt} / ${Q.length} beantwortet</span></div>
  <div class="enav">${Q.map((_,i)=>{
    const cl=[i===idx?'cur':'',examMarks.has(i)?'mk':examPicks[i]&&examPicks[i].size?'ans':''].filter(Boolean).join(' ');
    return `<button class="${cl}" data-act="goExamQ" data-args="${esc(JSON.stringify([i]))}" title="Frage ${i+1}${examMarks.has(i)?' (vorgemerkt)':examPicks[i]&&examPicks[i].size?' (beantwortet)':' (offen)'}">${i+1}</button>`;
  }).join('')}</div>
  <p class="mut" style="font-size:.82rem;margin:4px 0 10px">Klicke auf eine Nummer, um direkt zur Frage zu springen.</p>
  ${examSubPend?`<div class="card" style="border-color:var(--warn);padding:10px 12px;margin-top:8px"><p style="margin:0 0 8px"><b>Noch ${openCnt} ${openCnt===1?'Frage':'Fragen'} unbeantwortet.</b><br><span class="mut">Nicht beantwortete Fragen geben 0 Punkte.</span></p><div class="row"><button class="btn sm" data-act="finishExam" data-args='[false]'>Jetzt abgeben</button><button class="btn sec sm" data-act="_h20">Weiterarbeiten</button></div></div>`:`<button class="btn${openCnt?' sec':''}" style="width:100%" data-act="tryFinishExam" data-args='[]'>Prüfung abgeben (${ansCnt}/${Q.length})</button>`}</div>`;
}

let rexp=new Set(),gopen=0,rgopen={};
function togQGloss(k){gopen=gopen===k?-1:k;quiz()}
function togRGloss(qi,gi){const cur=rgopen[qi]??0;rgopen[qi]=cur===gi?-1:gi;result()}
function togRexp(i){rexp.has(i)?rexp.delete(i):rexp.add(i);result()}
function togAllRexp(){if(rexp.size===Q.length)rexp.clear();else Q.forEach((_,i)=>rexp.add(i));result()}
function togResFlag(i){
  const q=Q[i],src=q&&(q._ref||q);if(!src)return;
  src.flagged=!src.flagged;q.flagged=src.flagged;
  save(true);result();
}
function resQList(title,smode,nmode){
  return `<div class="row" style="justify-content:space-between;margin:1.4em 0 .6em"><h2 style="margin:0">${title} (${Q.length})</h2><button class="btn sec sm" data-act="togAllRexp" data-args='[]'>${rexp.size===Q.length?'Alle zuklappen':'Alle aufklappen'}</button></div>
  ${Q.map((q,i)=>{
    const p=examPicks[i]||new Set(),ok=log[i],src=q._ref||q,open=rexp.has(i),multi=q.type==='multi',sc=examMode?scoreExamQ(q,p,smode,nmode):null;
    const acCol=examMode?(sc.ok?'--ok':(sc.part||sc.open)?'--warn':'--bad'):(ok?'--ok':p.size?'--bad':'--warn');
    const bCls=examMode?(sc.ok?'ok':(sc.part||sc.open)?'warn':'bad'):(ok?'ok':p.size?'bad':'warn');
    const bTxt=examMode?`${sc.ok?'✓ Richtig':sc.part?'Teilweise':sc.open?'Offen':'✕ Falsch'} · ${fmtPts(sc.pts)} / ${fmtPts(sc.max)} Pkt.`:(ok?'✓ Richtig':p.size?'✕ Falsch':'Offen');
    return `<div class="card" style="margin:12px 0;padding:12px 16px;border-left:4px solid var(${acCol})"><div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between"><button class="sb" style="padding:2px 0" aria-expanded="${open}" data-act="togRexp" data-args="${esc(JSON.stringify([i]))}"><span>${open?'▾':'▸'}</span><span><span class="mut" style="display:block;font-size:.82rem;margin-bottom:2px">Frage ${i+1}${q._title?` · ${esc(q._title)}`:''}</span><b>${esc(q.q)}</b></span></button><span class="gc"><span class="badge ${bCls}" style="cursor:default">${bTxt}</span><button class="x${src.flagged?' warn':''}" title="${src.flagged?'Markierung aufheben':'Zum Bearbeiten markieren'}" aria-label="Markieren" data-act="togResFlag" data-args="${esc(JSON.stringify([i]))}">${IC.flag}</button></span></div>${open?`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--bd)">${!p.size?`<p class="mut" style="margin:0 0 8px;color:var(--warn)"><b>Keine Antwort ausgewählt (0 Punkte).</b></p>`:''}${q.opts.map((o,k)=>{
      const pk=p.has(k);let c='opt'+(multi?' multi':''),mk='',note='';
      const optStep=examMode&&multi&&!sc.open&&smode!=='all'?(smode==='part'?fmtPts(1/q.opts.length):'1'):'';
      if(o.ok&&pk){c+=' ok';mk='✓';note=optStep?`Deine Antwort (richtig · +${optStep} Pkt.)`:'Deine Antwort (richtig)'}
      else if(o.ok){c+=' ok miss';mk='✓';note=optStep?`Richtige Antwort (nicht gewählt · ${smode==='pos'||nmode==='none'?'0':'−'+optStep} Pkt.)`:'Richtige Antwort'}
      else if(pk){c+=' bad';mk='✕';note=optStep?`Deine Antwort (falsch · ${nmode==='none'?'0':'−'+optStep} Pkt.)`:'Deine Antwort (falsch)'}
      else if(optStep&&(smode==='opt'||smode==='part')){mk='✓';note=`Richtig nicht gewählt (+${optStep} Pkt.)`}
      return `<div class="${c}" style="cursor:default${!o.ok&&!pk&&!(optStep&&(smode==='opt'||smode==='part'))?';opacity:.72':''}"><span class="m">${mk}</span><span>${esc(o.t)}${note||o.why?`<span class="why">${note?`<b>${note}</b>${o.why?' · ':''}`:''}${esc(o.why||'')}</span>`:''}</span></div>`;
    }).join('')}${q.exp?`<div class="exp" style="margin:8px 0 2px"><b style="color:var(--ac);display:block;margin-bottom:2px">Begründung</b>${esc(q.exp)}</div>`:''}${(()=>{const gt=terms(q),curG=rgopen[i]??0,ag=gt[curG];return gt.length?`<div class="card" style="margin-top:8px;padding:10px 12px;background:var(--bg)"><div class="row" style="justify-content:space-between;gap:6px"><b style="font-size:.88rem">Glossar (${gt.length})</b><span class="mut" style="font-size:.78rem">${ag?'Antippen zum Wechseln / Schließen':'Begriff antippen'}</span></div><div class="gtabs">${gt.map((g,gi)=>`<button class="gtab${curG===gi?' on':''}" style="background:var(${curG===gi?'--ac':'--card'})" aria-expanded="${curG===gi}" data-act="togRGloss" data-args="${esc(JSON.stringify([i,gi]))}">${isym(IC.book)}${esc(g.b)}</button>`).join('')}</div>${ag?`<div class="gbox" style="background:var(--card)"><b>${esc(ag.b)}</b> – ${esc(ag.i)}</div>`:''}</div>`:''})()}</div>`:''}</div>`;
  }).join('')}`;
}

function result(){stopExamTimer();const chg=curView!=='r';curView='r';$app.className='';
  if(chg){rexp=new Set(Q.map((_,i)=>i).filter(i=>!log[i]));rgopen={}}
  const ok=log.filter(Boolean).length,exactPct=Q.length?ok/Q.length*100:0,pct=Math.round(exactPct),wrong=Q.filter((_,i)=>!log[i]),newlyM=Q.filter(q=>q._newlyMastered).length;
  if(examMode){
    const passPct=getPass(examCourse),smode=getScoreMode(examCourse),nmode=getNegMode(examCourse),hasMC=Q.some(q=>q.type==='multi')||(examCourse&&courseHasMulti(examCourse));
    const scores=Q.map((q,i)=>scoreExamQ(q,examPicks[i]||new Set(),smode,nmode));
    const rawPts=scores.reduce((a,s)=>a+s.pts,0),maxPts=scores.reduce((a,s)=>a+s.max,0),totPts=Math.max(0,rawPts);
    const exPct=maxPts>0?totPts/maxPts*100:0,partCnt=scores.filter(s=>s.part).length;
    const gr=calcGrade(exPct,passPct),st=gr.st;
    const resCol=gr.ok?(gr.g<=2?'--ok':gr.g===3?'--ac':'--warn'):'--bad';
    const chMap={};Q.forEach((q,i)=>{const k=q._title||'Allgemein';if(!chMap[k])chMap[k]={pts:0,max:0};chMap[k].pts+=scores[i].pts;chMap[k].max+=scores[i].max});
    const chEntries=Object.entries(chMap);
    $app.innerHTML=`${nav('q')}<h1 style="color:var(${resCol})">${IC.award}<span>Prüfungsergebnis</span></h1>
    <div class="card" style="border-left:5px solid var(${resCol});background:color-mix(in srgb,var(${resCol}) 6%,var(--card))">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(${resCol});margin-bottom:3px">${gr.ok?'Prüfung bestanden':'Nicht bestanden'}</div>
          <div class="score" style="color:var(${resCol})">Note ${gr.g} · ${gr.t}</div>
          <div class="row" style="gap:12px;margin-top:8px;font-size:.93rem;flex-wrap:wrap">
            <span><b>${fmtPts(totPts)} / ${fmtPts(maxPts)} Punkte</b>${rawPts<0?` (Rohwert: ${fmtPts(rawPts)})`:''} (${fmtPct(exPct)})</span>
            <span class="mut">·</span>
            <span><b>${ok} / ${Q.length}</b> Fragen komplett richtig${partCnt?` (${partCnt} teilweise)`:''}</span>
            <span class="mut">·</span>
            <span>⏱ Zeit: <b>${fmtTime(examElapsed)}</b> / ${fmtTime(examDurMins*60)} Min.</span>
            ${examTimeUp?'<span class="badge warn">⏱ Zeit abgelaufen</span>':''}
            ${newlyM?`<span class="badge ok">✓ ${newlyM} neu gemeistert</span>`:''}
          </div>
        </div>
        <span class="badge ${gr.ok?'ok':'bad'}" style="cursor:default;font-size:.95rem;padding:6px 14px;box-shadow:0 1px 2px rgba(0,0,0,.04)">${gr.ok?'✓ Positiv (Bestanden)':'✕ Negativ (Nicht bestanden)'}</span>
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(${resCol}) 20%,var(--bd))">
        <p class="mut" style="margin:0 0 6px;font-size:.82rem">Hinweis: Änderungen an Wertung, Minuspunkten und Notenschema gelten dauerhaft für diesen Kurs, auch für künftige Prüfungen.</p>
        <div class="row" style="gap:12px;margin-bottom:8px">
          ${hasMC?`<label class="mut">MC-Wertung: <select class="inl" data-chg="_rSM" data-args="${esc(JSON.stringify([examCourse]))}"><option value="all" ${smode==='all'?'selected':''}>Gesamtfrage (Alles-oder-nichts)</option><option value="opt" ${smode==='opt'?'selected':''}>Einzelantworten (inkl. Nicht-Ankreuzen)</option><option value="pos" ${smode==='pos'?'selected':''}>Einzelantworten (nur richtige)</option><option value="part" ${smode==='part'?'selected':''}>Teilpunkte (1 Pkt./Frage)</option></select></label>`:''}
          <label class="mut">Minuspunkte: <select class="inl" data-chg="_rNM" data-args="${esc(JSON.stringify([examCourse]))}"><option value="none" ${nmode==='none'?'selected':''}>Keine Minuspunkte</option>${hasMC||nmode==='clamp'?`<option value="clamp" ${nmode==='clamp'?'selected':''}>Min. 0 Pkt. pro Frage</option>`:''}<option value="full" ${nmode==='full'?'selected':''}>Gesamtabzug (auch &lt; 0)</option></select></label>
        </div>
        <div class="row" style="justify-content:space-between">
          <label class="mut">Notenschema${examCourse?` (${esc(examCourse)})`:''}: <select class="inl" data-chg="_rP" data-args="${esc(JSON.stringify([examCourse]))}"><option value="50" ${passPct===50?'selected':''}>Positiv ab 50 %</option><option value="60" ${passPct===60?'selected':''}>Positiv ab 60 %</option><option value="70" ${passPct===70?'selected':''}>Positiv ab 70 %</option></select></label>
          <span class="mut" style="font-size:.84rem"><b>1:</b> ≥${fmtPct(passPct+3*st)} · <b>2:</b> ≥${fmtPct(passPct+2*st)} · <b>3:</b> ≥${fmtPct(passPct+st)} · <b>4:</b> ≥${fmtPct(passPct)} · <b>5:</b> &lt;${fmtPct(passPct)}</span>
        </div>
      </div>
    </div>
    ${chEntries.length>1?`<div class="card" style="margin-top:12px"><b>Auswertung nach Kapiteln</b><div style="margin-top:6px">${chEntries.map(([t,v])=>{const cp=v.max>0?Math.round(Math.max(0,v.pts)/v.max*100):0;return `<div class="qi" style="padding:6px 0"><span>${esc(t)}</span><span class="badge ${cp>=passPct?'ok':'bad'}" style="cursor:default">${fmtPts(Math.max(0,v.pts))} / ${fmtPts(v.max)} Pkt. (${cp} %)</span></div>`}).join('')}</div></div>`:''}
    <div class="row act" style="margin-top:14px"><button class="btn" data-act="startExam" data-args='[]'>Neue Prüfung starten</button>${wrong.length?`<button class="btn sec" data-act="_h21">Falsche Fragen üben (${wrong.length})</button>`:''}<button class="btn sec" data-act="home" data-args='[]'>Zur Übersicht</button></div>
    ${flaggedHtml()}
    ${resQList('Klausureinsicht',smode,nmode)}`;
    if(chg)toTop();
    return;
  }
  const qCol=pct>=80?'--ok':pct>=50?'--ac':pct>0?'--warn':'--bad';
  const qLabel=pct===100?'Perfekt! Alle richtig':pct>=80?'Sehr gutes Ergebnis':pct>=50?'Gut geübt':pct>0?'Weiter üben':'Noch kein Treffer';
  $app.innerHTML=`${nav('q')}<h1 style="color:var(${qCol})">${IC.star}<span>Ergebnis</span></h1>
  <div class="card" style="border-left:5px solid var(${qCol});background:color-mix(in srgb,var(${qCol}) 6%,var(--card))">
    <div class="row" style="justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(${qCol});margin-bottom:3px">${qLabel}</div>
        <div class="score" style="color:var(${qCol})">${ok} / ${Q.length}</div>
        <p class="mut" style="margin-top:6px;font-size:.95rem"><b>${pct} %</b> der Fragen richtig beantwortet${newlyM?` · <b style="color:var(--ok)">✓ ${newlyM} ${newlyM===1?'Frage':'Fragen'} neu gemeistert</b>`:''}</p>
      </div>
      <span class="badge ${pct>=80?'ok':pct>=50?'':pct>0?'warn':'bad'}" style="cursor:default;font-size:1.15rem;padding:8px 16px;font-weight:700">${pct} %</span>
    </div>
  </div>
  <div class="row act" style="margin-top:14px">${wrong.length?`<button class="btn" data-act="_h21">Falsche Fragen wiederholen (${wrong.length})</button>`:''}<button class="btn sec" data-act="home" data-args='[]'>Zur Übersicht</button></div>
  ${flaggedHtml()}
  ${resQList('Beantwortete Fragen')}`;
  if(chg)toTop();
}
let termsCache=new WeakMap();
function terms(q){const c=termsCache.get(q);if(c&&c.g===gloss&&c.gl===gloss.length&&c.sl===sets.length)return c.r;const r=computeTerms(q,gloss,sets);termsCache.set(q,{g:gloss,gl:gloss.length,sl:sets.length,r});return r}
function side(q){
  if(!checked)return `<div class='card ph'><p class='mut' style='margin:0'>Nach dem Prüfen der Antwort erscheinen hier die Begründung und passende Begriffe aus dem Glossar.</p></div>`;
  const src=q._ref||q,st=src.streak||0,m=isMastered(src),t=terms(q),ag=t[gopen];
  return `<div class="exp" style="margin:0"><div class="row" style="justify-content:space-between;margin-bottom:4px"><b style="color:var(--ac)">Begründung</b><span class="badge ${m?'ok':src.wrong?'bad':''}" style="cursor:default">${m?`✓ Gemeistert (${st}/${opts.mastery})`:`Lernstand: ${st} / ${opts.mastery}`}</span></div>${esc(q.exp)}</div><div class='card'><div class="row" style="justify-content:space-between;gap:6px"><b>Weiterführende Informationen</b>${t.length?`<span class="mut" style="font-size:.8rem">${ag?'Antippen zum Wechseln / Schließen':'Begriff antippen'}</span>`:''}</div>${t.length?`<div class="gtabs">${t.map((g,i)=>`<button class="gtab${gopen===i?' on':''}" aria-expanded="${gopen===i}" data-act="togQGloss" data-args="${esc(JSON.stringify([i]))}">${isym(IC.book)}${esc(g.b)}</button>`).join('')}</div>${ag?`<div class="gbox"><b>${esc(ag.b)}</b> – ${esc(ag.i)}</div>`:''}`:`<p class='mut'>Zu dieser Frage ist für diesen Kurs noch kein Begriff im Glossar hinterlegt.</p>`}</div>`}
function addGloss(l,noSave){
  l.forEach(g=>{
    if(!g||!(g.begriff||g.b)||!(g.info||g.i))return;
    const rawC=String(g.kurs||g.course||'Ohne Kurs').trim()||'Ohne Kurs';
    const c=allCourses().find(x=>norm(x)===norm(rawC))||rawC;
    const o={course:c,b:String(g.begriff||g.b).trim(),i:String(g.info||g.i).trim(),a:[].concat(g.alias||g.a||[]).map(x=>String(x).trim()).filter(Boolean)};
    const i=gloss.findIndex(x=>norm(x.course)===norm(o.course)&&x.b.toLowerCase()===o.b.toLowerCase());
    i<0?gloss.push(o):gloss[i]=o;
  });
  if(!noSave)saveGloss();
}
function wrongPool(){return Q.filter((_,i)=>!log[i])}

const b64Enc=s=>{let b='';const u=new TextEncoder().encode(s);for(let i=0;i<u.length;i++)b+=String.fromCharCode(u[i]);return btoa(b)};
const b64Dec=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g,'')),c=>c.charCodeAt(0)));
const SYNC_REPO='quizomat-sync',SYNC_FILE='state.json';

async function ghReq(method,path,body,tok){
  const r=await fetch('https://api.github.com'+path,{
    method,cache:'no-store',
    headers:{Authorization:'Bearer '+(tok||gh.token),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined
  });
  const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
  return{status:r.status,ok:r.ok,data:j};
}

async function ensureCloudRepo(tok){
  const u=await ghReq('GET','/user',null,tok);
  if(!u.ok||!u.data||!u.data.login)throw new Error('Ungültiger GitHub-Token oder fehlende Berechtigung.');
  const login=u.data.login;
  const rp=await ghReq('GET',`/repos/${login}/${SYNC_REPO}`,null,tok);
  if(rp.status===404){
    const cr=await ghReq('POST','/user/repos',{name:SYNC_REPO,private:true,auto_init:true,description:'Privater Cloud-Speicher für Quizomat'},tok);
    if(!cr.ok)throw new Error('Privates Sync-Repository konnte nicht angelegt werden (hat der Token die „repo“-Berechtigung? Sonst das private Repository quizomat-sync manuell anlegen).');
  }
  return login;
}

async function fetchCloudState(){
  if(!gh.user)gh.user=await ensureCloudRepo(gh.token);
  const r=await ghReq('GET',`/repos/${gh.user}/${SYNC_REPO}/contents/${SYNC_FILE}`);
  if(r.status===404)return{sha:'',data:null};
  if(!r.ok)throw new Error('Fehler beim Laden aus der Cloud ('+r.status+').');
  let raw=r.data.content||'';
  if(!raw&&r.data.sha){
    const bl=await ghReq('GET',`/repos/${gh.user}/${SYNC_REPO}/git/blobs/${r.data.sha}`);
    if(bl.ok&&bl.data)raw=bl.data.content||'';
  }
  const parsed=raw?JSON.parse(b64Dec(raw)):null;
  return{sha:r.data.sha||'',data:parsed};
}

function mergeCloudOpts(ro,preferRemote){
  if(!ro||typeof ro!=='object')return;
  const mm=(loc,rem)=>{
    const a=(loc&&typeof loc==='object')?loc:{},b=(rem&&typeof rem==='object')?rem:{};
    return preferRemote?{...a,...b}:{...b,...a};
  };
  const pick=(lv,rv)=>preferRemote?(rv!==undefined?rv:lv):(lv!==undefined?lv:rv);
  opts={
    ...opts,
    ...(preferRemote?ro:{}),
    n:Math.max(1,+pick(opts.n,ro.n)||20),
    examMins:Math.max(1,+pick(opts.examMins,ro.examMins)||30),
    pass:[50,60,70].includes(+pick(opts.pass,ro.pass))?+pick(opts.pass,ro.pass):50,
    scoreMode:SCORE_MODES.includes(pick(opts.scoreMode,ro.scoreMode))?pick(opts.scoreMode,ro.scoreMode):'all',
    negMode:NEG_MODES.includes(pick(opts.negMode,ro.negMode))?pick(opts.negMode,ro.negMode):'none',
    cpass:mm(opts.cpass,ro.cpass),
    ctime:mm(opts.ctime,ro.ctime),
    cqcount:mm(opts.cqcount,ro.cqcount),
    cmode:mm(opts.cmode,ro.cmode),
    cneg:mm(opts.cneg,ro.cneg),
    corder:Array.isArray(pick(opts.corder,ro.corder))?pick(opts.corder,ro.corder).filter(Boolean):[],
    shuffle:pick(opts.shuffle,ro.shuffle)!==false,
    autoCheck:pick(opts.autoCheck,ro.autoCheck)===true,
    hideMastered:pick(opts.hideMastered,ro.hideMastered)!==false,
    mastery:Math.max(1,Math.min(10,+pick(opts.mastery,ro.mastery)||3)),
    theme:THEMES.includes(pick(opts.theme,ro.theme))?pick(opts.theme,ro.theme):'auto'
  };
  sets.forEach(s=>{
    if(!s||!s.cfg||!s.course)return;
    const c=s.course,cf=s.cfg;
    if(opts.cqcount[c]===undefined&&+cf.fragenAnzahl>0)opts.cqcount[c]=Math.max(1,+cf.fragenAnzahl);
    if(opts.ctime[c]===undefined&&+cf.zeitMinuten>0)opts.ctime[c]=Math.max(1,+cf.zeitMinuten);
    if(opts.cpass[c]===undefined&&[50,60,70].includes(+cf.positivAb))opts.cpass[c]=+cf.positivAb;
    if(opts.cmode[c]===undefined&&SCORE_MODES.includes(cf.mcWertung))opts.cmode[c]=cf.mcWertung;
    if(opts.cneg[c]===undefined&&NEG_MODES.includes(cf.minuspunkte))opts.cneg[c]=cf.minuspunkte;
  });
  syncCourseCfg();
  applyTheme();
  try{localStorage.setItem('pt:opts',JSON.stringify(opts))}catch(e){}
}

function applyCloudState(d){
  if(!d||typeof d!=='object')return;
  const prevSel=new Set(sel),hadSets=sets.length>0;
  let hadRawSel=false;
  try{hadRawSel=localStorage.getItem('pt:sel')!==null}catch(e){}
  if(Array.isArray(d.sets))sets=d.sets;
  if(Array.isArray(d.gloss)){gloss=d.gloss;normGloss()}
  if(d.courses&&typeof d.courses==='object')courses={...courses,...d.courses};
  if(Array.isArray(d.col))col=new Set(d.col);
  if(Array.isArray(d.gcol))gcol=new Set(d.gcol);
  if(Array.isArray(d.examHistory))examHistory=mergeAttempts(examHistory,d.examHistory);
  mergeCloudOpts(d.opts||{},true);
  localTs=d.updatedAt||Date.now();
  try{
    localStorage.setItem('pt:sets',JSON.stringify(sets));
    localStorage.setItem('pt:gloss',JSON.stringify(gloss));
    localStorage.setItem('pt:courses',JSON.stringify(courses));
    localStorage.setItem('pt:col',JSON.stringify([...col]));
    localStorage.setItem('pt:gcol',JSON.stringify([...gcol]));
    localStorage.setItem('pt:opts',JSON.stringify(opts));
    localStorage.setItem('pt:exams',JSON.stringify(examHistory));
    localStorage.setItem('pt:ts',String(localTs));
  }catch(e){}
  sel=new Set();
  if(!hadSets&&!hadRawSel){
    sets.forEach(s=>sel.add(s.id));
  }else{
    sets.forEach(s=>{if(prevSel.has(s.id))sel.add(s.id)});
  }
  enforceSingleCourse();
  exp=new Set([...exp].filter(id=>sets.some(s=>s.id===id)));
  saveSel();saveExp();writeBase(sets);
}

/* 3-Wege-Merge (Basis = letzter synchronisierter Stand): Änderungen und Löschungen beider Seiten bleiben erhalten */
function readBase(){try{const v=localStorage.getItem('pt:base');return v?JSON.parse(v):null}catch(e){return null}}
function writeBase(x){try{localStorage.setItem('pt:base',jj(x));localStorage.setItem('pt:gbase',jj(gloss))}catch(e){}}
function readGBase(){try{const v=localStorage.getItem('pt:gbase');return v?JSON.parse(v):null}catch(e){return null}}
function merge3gloss(rg,rt){gloss=mergeGloss3Way(readGBase(),gloss,rg,rt>localTs);normGloss()}
function merge3sets(rs,rt){sets=mergeSets3Way(readBase(),sets,rs,rt>localTs)}
function bothChanged(d){const b=readBase(),g=readGBase();return (!!b&&Array.isArray(d.sets)&&jj(d.sets)!==jj(b)&&jj(sets)!==jj(b))||(!!g&&Array.isArray(d.gloss)&&jj(d.gloss)!==jj(g)&&jj(gloss)!==jj(g))}
function mergeFrom(d){const rt=d.updatedAt||0;
  merge3sets(d.sets,rt);
  if(d.opts)mergeCloudOpts(d.opts,rt>=localTs);
  if(Array.isArray(d.gloss))merge3gloss(d.gloss,rt);
  if(d.courses&&typeof d.courses==='object')courses={...d.courses,...courses};
  if(Array.isArray(d.examHistory))examHistory=mergeAttempts(examHistory,d.examHistory);
  localTs=Date.now();
  try{localStorage.setItem('pt:sets',jj(sets));localStorage.setItem('pt:gloss',jj(gloss));localStorage.setItem('pt:courses',jj(courses));localStorage.setItem('pt:exams',jj(examHistory));localStorage.setItem('pt:ts',String(localTs))}catch(e){}}
async function pushCloudNow(retry){
  if(!gh.token)return;
  clearTimeout(syncTimer);
  syncState='syncing';syncErr='';updSyncUI();
  try{
    if(!gh.user)gh.user=await ensureCloudRepo(gh.token);
    if(!gh.sha&&!retry){
      const cur=await fetchCloudState();
      gh.sha=cur.sha;
    }
    if(!localTs){localTs=Date.now();try{localStorage.setItem('pt:ts',String(localTs))}catch(e){}}
    syncCourseCfg();
    const payload={updatedAt:localTs,sets,gloss,courses,col:[...col],gcol:[...gcol],opts,examHistory};
    const res=await ghReq('PUT',`/repos/${gh.user}/${SYNC_REPO}/contents/${SYNC_FILE}`,{
      message:'Sync Quizomat',
      content:b64Enc(JSON.stringify(payload)),
      ...(gh.sha?{sha:gh.sha}:{})
    });
    if((res.status===409||res.status===422)&&!retry){
      const cur=await fetchCloudState();
      gh.sha=cur.sha;
      if(cur.data){
        if(cur.data.opts)mergeCloudOpts(cur.data.opts,false);
        if(Array.isArray(cur.data.sets))merge3sets(cur.data.sets,cur.data.updatedAt||0);
        if(Array.isArray(cur.data.gloss))merge3gloss(cur.data.gloss,cur.data.updatedAt||0);
        try{localStorage.setItem('pt:sets',JSON.stringify(sets));localStorage.setItem('pt:gloss',JSON.stringify(gloss))}catch(e){}
      }
      return await pushCloudNow(true);
    }
    if(!res.ok)throw new Error('Speichern in Cloud fehlgeschlagen ('+res.status+').');
    gh.sha=(res.data&&res.data.content&&res.data.content.sha)||gh.sha;
    gh.lastSync=Date.now();forceOverwrite=false;syncDirty=false;writeBase(sets);saveGH();
    syncState='ok';updSyncUI();
  }catch(e){
    syncState='err';syncErr=e.message||'Synchronisationsfehler';updSyncUI();
  }
}

async function pullCloud(isConnect){
  if(!gh.token)return;
  syncState='syncing';syncErr='';updSyncUI();
  try{
    const rem=await fetchCloudState();
    gh.sha=rem.sha;
    const d=rem.data,remTs=(d&&d.updatedAt)||0;
    if(isConnect){
      if(d&&(sets.length||gloss.length)){
        if(d.courses&&typeof d.courses==='object')courses={...d.courses,...courses};
        if(Array.isArray(d.sets))merge3sets(d.sets,remTs);
        if(d.opts)mergeCloudOpts(d.opts,remTs>=localTs);
        if(Array.isArray(d.gloss))merge3gloss(d.gloss,remTs);
        localTs=Date.now();
        try{localStorage.setItem('pt:sets',JSON.stringify(sets));localStorage.setItem('pt:gloss',JSON.stringify(gloss));localStorage.setItem('pt:courses',JSON.stringify(courses));localStorage.setItem('pt:ts',String(localTs))}catch(e){}
        await pushCloudNow(true);
      }else if(d){
        applyCloudState(d);
        gh.lastSync=Date.now();saveGH();syncState='ok';
      }else{
        await pushCloudNow(true);
      }
    }else if(d&&bothChanged(d)){
      mergeFrom(d);
      if(curView==='q'&&cedit===null&&sedit===null&&qedit===null&&!qsearch)home();
      await pushCloudNow(true);return;
    }else if(d&&remTs>localTs){
      applyCloudState(d);
      gh.lastSync=Date.now();saveGH();syncState='ok';
    }else if(localTs>remTs&&(sets.length||gloss.length||forceOverwrite)){
      await pushCloudNow(true);
      return;
    }else{
      if(d&&d.opts)mergeCloudOpts(d.opts,true);
      gh.lastSync=Date.now();saveGH();syncState='ok';
    }
    updSyncUI();
    if(curView==='q'&&cedit===null&&sedit===null&&qedit===null&&!qsearch)home();
    else if(curView==='g'&&gedit===null&&gcedit===null&&!gq)glosView();
    else if(curView==='s'&&cedit===null)settingsView();
  }catch(e){
    syncState='err';syncErr=e.message||'Synchronisationsfehler';updSyncUI();
  }
}

function cloudHtml(){
  const last=gh.lastSync?new Date(gh.lastSync).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})+' Uhr':'Noch nicht synchronisiert';
  return gh.token?`<div class="card" style="margin-top:12px">
    <p><b>Status:</b> ${syncState==='syncing'?'Synchronisiere …':syncState==='err'?`<span style="color:var(--bad)">Fehler (${esc(syncErr)})</span>`:`<span style="color:var(--ok)">✓ Verbunden${gh.user?` als @${esc(gh.user)}`:''}</span>`}</p>
    <p class="mut">Privates Repository: <code>${esc(gh.user||'…')}/${SYNC_REPO}</code><br>Letzter Abgleich: ${esc(last)}</p>
    <div class="row" style="margin-top:12px">
      <button class="btn" ${syncState==='syncing'?'disabled':''} data-act="_h22">Jetzt synchronisieren</button>
      <button class="btn sec" data-act="disconnectCloud" data-args='[]'>Verbindung trennen</button>
    </div>
  </div>`:`<div class="card ge" style="margin-top:12px">
    <label for="ght"><b>GitHub Personal Access Token</b></label>
    <p class="mut" style="margin:2px 0 8px">Empfohlen: Fine-grained Token nur für das Repository <code>quizomat-sync</code> (Berechtigung „Contents“: Read and write); das private Repository vorher anlegen. Ein klassischer Token mit <code>repo</code> geht auch, gibt aber Zugriff auf alle deine Repositories. Der Token wird ausschließlich lokal auf diesem Gerät gespeichert.</p>
    <input id="ght" type="password" placeholder="ghp_…" autocomplete="off">
    <p class="err" role="alert">${esc(syncErr)}</p>
    <div class="row" style="margin-top:8px">
      <button class="btn" ${syncState==='syncing'?'disabled':''} data-act="_h23">${syncState==='syncing'?'Verbinde …':'Verbinden & Synchronisieren'}</button>
    </div>
  </div>`;
}

async function connectCloud(){
  const el=document.getElementById('ght'),tok=(el?el.value:'').trim();
  if(!tok){syncErr='Bitte gib einen GitHub-Token ein.';updSyncUI();return}
  syncState='syncing';syncErr='';updSyncUI();
  try{
    const user=await ensureCloudRepo(tok);
    gh={token:tok,user,sha:'',lastSync:0};
    saveGH();
    await pullCloud(true);
  }catch(e){
    gh={token:'',user:'',sha:'',lastSync:0};saveGH();
    syncState='err';syncErr=e.message||'Verbindung fehlgeschlagen.';updSyncUI();
  }
}

function disconnectCloud(){
  clearTimeout(syncTimer);
  gh={token:'',user:'',sha:'',lastSync:0};syncState='idle';syncErr='';
  try{localStorage.removeItem('pt:gh')}catch(e){}
  updSyncUI();
}

function sbCloudHtml(){
  if(!supabase)return `<div class="card" style="margin-top:12px"><p class="mut" style="margin:0">Supabase ist in dieser Umgebung nicht konfiguriert.</p></div>`;
  if(sbUser){
    const last=sbLastSync?new Date(sbLastSync).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})+' Uhr':'Noch nicht synchronisiert';
    return `<div class="card" style="margin-top:12px">
      <p><b>Status:</b> ${sbState==='syncing'?'Synchronisiere …':sbState==='err'?`<span style="color:var(--bad)">Fehler (${esc(sbErr)})</span>`:`<span style="color:var(--ok)">✓ Verbunden als ${esc(sbUser.email||sbUser.id)}</span>`}</p>
      <p class="mut">Letzter Abgleich: ${esc(last)}</p>
      <div class="row" style="margin-top:12px">
        <button class="btn" ${sbState==='syncing'?'disabled':''} data-act="sbSyncNow" data-args='[]'>Jetzt synchronisieren</button>
        <button class="btn sec" data-act="sbSignOut" data-args='[]'>Abmelden</button>
      </div>
    </div>`;
  }
  const m=sbAuthMode;
  return `<div class="card ge" style="margin-top:12px">
    <div class="gtabs" style="margin-top:0;margin-bottom:10px">
      <button type="button" class="gtab${m==='login'?' on':''}" data-act="setSbMode" data-args='["login"]'>Anmelden</button>
      <button type="button" class="gtab${m==='signup'?' on':''}" data-act="setSbMode" data-args='["signup"]'>Konto erstellen</button>
      <button type="button" class="gtab${m==='magic'?' on':''}" data-act="setSbMode" data-args='["magic"]'>Magic Link</button>
    </div>
    <label for="sb_email"><b>E-Mail-Adresse</b></label>
    <input id="sb_email" type="email" placeholder="name@beispiel.de" autocomplete="email" data-kd="sbAuthSubmit" data-args='[]'>
    ${m==='magic'?'':`<label for="sb_pw"><b>Passwort</b></label><input id="sb_pw" type="password" placeholder="${m==='signup'?'Mindestens 6 Zeichen':'Passwort'}" autocomplete="${m==='signup'?'new-password':'current-password'}" data-kd="sbAuthSubmit" data-args='[]'>`}
    ${sbErr?`<p class="err" role="alert">${esc(sbErr)}</p>`:''}
    ${sbMsg?`<p style="color:var(--ok);font-weight:700" role="status">${esc(sbMsg)}</p>`:''}
    <div class="row" style="margin-top:8px">
      <button class="btn" ${sbBusy?'disabled':''} data-act="sbAuthSubmit" data-args='[]'>${sbBusy?'Bitte warten …':m==='login'?'Anmelden & Synchronisieren':m==='signup'?'Registrieren':'Magic Link senden'}</button>
    </div>
  </div>`;
}

function setSbMode(m){sbAuthMode=m;sbErr='';sbMsg='';updSyncUI()}

async function sbAuthSubmit(){
  if(!supabase||sbBusy)return;
  const email=(document.getElementById('sb_email')?.value||'').trim();
  const pw=document.getElementById('sb_pw')?.value||'';
  if(!email){sbErr='Bitte gib eine E-Mail-Adresse ein.';sbMsg='';updSyncUI();return}
  if(sbAuthMode!=='magic'&&pw.length<6){sbErr='Das Passwort muss mindestens 6 Zeichen lang sein.';sbMsg='';updSyncUI();return}
  sbBusy=true;sbErr='';sbMsg='';updSyncUI();
  try{
    if(sbAuthMode==='magic'){
      const redirectTo=window.location.origin+window.location.pathname;
      const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
      if(error)throw error;
      sbMsg='Anmeldelink wurde per E-Mail gesendet. Öffne den Link auf diesem Gerät.';
    }else if(sbAuthMode==='signup'){
      const redirectTo=window.location.origin+window.location.pathname;
      const {data,error}=await supabase.auth.signUp({email,password:pw,options:{emailRedirectTo:redirectTo}});
      if(error)throw error;
      if(data&&data.session&&data.user){
        sbUser=data.user;
        await pullSupabase(true);
      }else{
        sbMsg='Konto erstellt! Bitte bestätige ggf. deine E-Mail-Adresse und melde dich an.';
      }
    }else{
      const {data,error}=await supabase.auth.signInWithPassword({email,password:pw});
      if(error)throw error;
      if(data&&data.user){
        sbUser=data.user;
        await pullSupabase(true);
      }
    }
  }catch(e){
    sbErr=e.message||'Anmeldung fehlgeschlagen.';
  }finally{
    sbBusy=false;updSyncUI();
  }
}

async function sbSignOut(){
  if(!supabase)return;
  clearTimeout(sbTimer);
  try{await supabase.auth.signOut()}catch(e){}
  sbUser=null;sbState='idle';sbErr='';sbMsg='';sbLastSync=0;sbDirty=false;
  updSyncUI();
}

async function pushSupabaseNow(){
  if(!supabase||!sbUser)return;
  clearTimeout(sbTimer);
  sbState='syncing';sbErr='';updSyncUI();
  try{
    if(!localTs){localTs=Date.now();try{localStorage.setItem('pt:ts',String(localTs))}catch(e){}}
    syncCourseCfg();
    const payload={updatedAt:localTs,sets,gloss,courses,col:[...col],gcol:[...gcol],opts,examHistory};
    await pushSupabaseState(supabase,sbUser.id,payload);
    sbLastSync=Date.now();forceOverwrite=false;sbDirty=false;writeBase(sets);
    sbState='ok';updSyncUI();
  }catch(e){
    sbState='err';sbErr=e.message||'Speichern fehlgeschlagen.';updSyncUI();
  }
}

async function pullSupabase(isConnect){
  if(!supabase||!sbUser)return;
  sbState='syncing';sbErr='';updSyncUI();
  try{
    const d=await fetchSupabaseState(supabase,sbUser.id);
    const remTs=(d&&d.updatedAt)||0;
    if(isConnect){
      if(d&&(sets.length||gloss.length||examHistory.length)){
        if(d.courses&&typeof d.courses==='object')courses={...d.courses,...courses};
        if(Array.isArray(d.sets))merge3sets(d.sets,remTs);
        if(d.opts)mergeCloudOpts(d.opts,remTs>=localTs);
        if(Array.isArray(d.gloss))merge3gloss(d.gloss,remTs);
        if(Array.isArray(d.examHistory))examHistory=mergeAttempts(examHistory,d.examHistory);
        localTs=Date.now();
        try{localStorage.setItem('pt:sets',JSON.stringify(sets));localStorage.setItem('pt:gloss',JSON.stringify(gloss));localStorage.setItem('pt:courses',JSON.stringify(courses));localStorage.setItem('pt:exams',JSON.stringify(examHistory));localStorage.setItem('pt:ts',String(localTs))}catch(e){}
        await pushSupabaseNow();
        if(curView==='q'&&cedit===null&&sedit===null&&qedit===null&&!qsearch)home();
        else if(curView==='g'&&gedit===null&&gcedit===null&&!gq)glosView();
        else if(curView==='t')statsView();
        else if(curView==='s'&&cedit===null)settingsView();
        return;
      }else if(d){
        applyCloudState(d);
        sbLastSync=Date.now();sbState='ok';
      }else{
        await pushSupabaseNow();
        return;
      }
    }else if(d&&bothChanged(d)){
      mergeFrom(d);
      if(curView==='q'&&cedit===null&&sedit===null&&qedit===null&&!qsearch)home();
      await pushSupabaseNow();return;
    }else if(d&&remTs>localTs){
      applyCloudState(d);
      sbLastSync=Date.now();sbState='ok';
    }else if(localTs>remTs&&(sets.length||gloss.length||forceOverwrite)){
      await pushSupabaseNow();
      return;
    }else{
      if(d&&d.opts)mergeCloudOpts(d.opts,true);
      sbLastSync=Date.now();sbState='ok';
    }
    updSyncUI();
    if(curView==='q'&&cedit===null&&sedit===null&&qedit===null&&!qsearch)home();
    else if(curView==='g'&&gedit===null&&gcedit===null&&!gq)glosView();
    else if(curView==='s'&&cedit===null)settingsView();
  }catch(e){
    sbState='err';sbErr=e.message||'Synchronisationsfehler';updSyncUI();
  }
}

function sbSyncNow(){pullSupabase(false)}

async function initSupabaseAuth(){
  if(!supabase)return;
  try{
    const {data}=await supabase.auth.getSession();
    if(data&&data.session&&data.session.user){
      sbUser=data.session.user;
      updSyncUI();
      if(curView!=='z')pullSupabase(false);
    }
  }catch(e){}
  supabase.auth.onAuthStateChange((event,session)=>{
    const prevId=sbUser&&sbUser.id;
    sbUser=(session&&session.user)||null;
    if(sbUser&&sbUser.id!==prevId&&event==='SIGNED_IN'){
      updSyncUI();
      if(curView!=='z')pullSupabase(true);
    }else if(!sbUser&&prevId){
      sbState='idle';sbLastSync=0;updSyncUI();
    }
  });
}

const autoPull=()=>{
  if(document.visibilityState!=='visible'||curView==='z')return;
  if(sbUser&&sbState!=='syncing'&&Date.now()-sbLastPull>15000){sbLastPull=Date.now();pullSupabase(false)}
  if(gh.token&&syncState!=='syncing'&&Date.now()-lastPull>30000){lastPull=Date.now();pullCloud(false)}
};
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){
    if(sbUser&&sbDirty&&sbState!=='syncing')pushSupabaseNow();
    if(gh.token&&syncDirty&&syncState!=='syncing')pushCloudNow();
  }
});
document.addEventListener('visibilitychange',autoPull);
window.addEventListener('focus',autoPull);
window.addEventListener('pageshow',autoPull);
window.addEventListener('online',autoPull);

document.addEventListener('keydown',ev=>{
  if(!$app.classList.contains('wide')||!Q.length)return;
  const tag=(ev.target&&ev.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  if(examMode){
    if(ev.key>='1'&&ev.key<='9'){
      const k=+ev.key-1;
      if(Q[idx]&&Q[idx].opts[k]){ev.preventDefault();pick(k)}
    }else if(ev.key==='ArrowLeft'){
      if(idx>0){ev.preventDefault();goExamQ(idx-1)}
    }else if(ev.key==='ArrowRight'||(ev.key==='Enter'&&tag!=='BUTTON')){
      if(idx+1<Q.length){ev.preventDefault();goExamQ(idx+1)}
    }else if((ev.key==='l'||ev.key==='L')&&!ev.metaKey&&!ev.ctrlKey&&!ev.altKey){
      ev.preventDefault();togExamMark();
    }else if((ev.key==='m'||ev.key==='M')&&!ev.metaKey&&!ev.ctrlKey&&!ev.altKey){
      ev.preventDefault();togQuizFlag();
    }else if(ev.key==='Escape'){
      ev.preventDefault();tryExitExam();
    }
    return;
  }
  if(ev.key>='1'&&ev.key<='9'&&!checked){
    const k=+ev.key-1;
    if(Q[idx]&&Q[idx].opts[k]){ev.preventDefault();pick(k)}
  }else if((ev.key==='Enter'||ev.key===' ')&&tag!=='BUTTON'){
    if(!checked&&picked.size){ev.preventDefault();check()}
    else if(checked){ev.preventDefault();next()}
  }else if((ev.key==='m'||ev.key==='M')&&!ev.metaKey&&!ev.ctrlKey&&!ev.altKey){
    ev.preventDefault();togQuizFlag();
  }else if(ev.key==='Escape'){
    ev.preventDefault();leaveQuiz();
  }
});

try{if(history.state&&history.state.v)history.replaceState(null,'')}catch(e){}
load();const rx=readExam();home();if(rx&&rx.q)resumeExam(rx);if(gh.token&&curView!=='z')pullCloud(false);initSupabaseAuth();
/* generierte Handler (vorher Inline-Anweisungen) */
function _h1(){crpend=null;rerenderC()}
function _h2(a0){crpend=a0;cpend=null;rpend=null;pend=null;rerenderC()}
function _h3(){rpend=null;home()}
function _h4(a0){rpend=a0;pend=null;cpend=null;crpend=null;home()}
function _h5(){pq=null;home()}
function _h6(a0,a1){pq=a0+':'+a1;home()}
function _h7(){wp=null;home()}
function _h8(){wp='r';home()}
function _h9(){wp='q';home()}
function _h10(){wp=null;qsearch='';home();toTop()}
function _h11(){gpend=null;glosView()}
function _h12(a0){gpend=a0;gcpend=null;glosView()}
function _h13(){gedit=null;gdraft=null;gerr='';glosView()}
function _h14(){wp=null;glosView()}
function _h15(){wp='g';glosView()}
function _h16(){msg='';glos()}
function _h17(){msg='';home()}
function _h18(){examExitPend=false;home()}
function _h19(){examExitPend=false;quiz()}
function _h20(){examSubPend=false;quiz()}
function _h21(){start(wrongPool())}
function _h22(){pullCloud(false)}
function _h23(){connectCloud()}
const handlers={
  _clipP,_clr,_h1,_h10,_h11,_h12,_h13,_h14,_h15,_h16,_h17,_h18,_h19,_h2,_h20,_h21,_h22,_h23,_h3,_h4,_h5,_h6,_h7,_h8,_h9,_pd,_rNM,_rP,_rSM,
  addQOpt,cancelCEdit,cancelGCEdit,cancelQEdit,cancelSEdit,changeQType,check,copyG,
  del,del2,delC,delC2,delG,delGC,delGC2,delHist,delHist2,delQ,delQOpt,disconnectCloud,doImp,
  dragCOver,dragCStart,dragEnd,dragLeave,dragSOver,dragSStart,dropC,dropFile,dropS,
  exportC,exportG,exportGC,exportQ,finishExam,fold,fromFile,gGName,gName,gSearch,
  gfold,glos,goExamQ,goQ,goQEdit,home,imp,leaveQuiz,moveC,moveS,next,openS,pick,
  qSearch,resetCourseProg,resetProg,saveCEdit,saveG,saveGCEdit,saveQEdit,saveSEdit,
  sbAuthSubmit,sbSignOut,sbSyncNow,setSbMode,setStatsCourse,
  setAutoCheck,setHideMastered,setMastery,setQuizCount,setShuffle,setTheme,settings,
  start,startCEdit,startCNew,startDue,startExam,startGCEdit,startGEdit,startGNew,startQEdit,
  startQNew,startSEdit,startSNew,stats,tog,togAllRexp,togC,togExamMark,togFlag,togHistExp,togMastery,
  togQGloss,togQuizFlag,togRGloss,togResFlag,togRexp,tryExitExam,tryFinishExam,wipe
};
document.addEventListener('click',e=>{for(let t=e.target.closest('[data-act]');t;t=t.parentElement&&t.parentElement.closest('[data-act]')){const f=handlers[t.dataset.act];if(typeof f==='function'){const a=JSON.parse(t.dataset.args||'[]');t.hasAttribute('data-el')?f(t,...a):f(...a)}}});
document.addEventListener('input',e=>{const t=e.target.closest&&e.target.closest('[data-in]');if(t){const f=handlers[t.dataset.in];if(typeof f==='function')f(t.value,...JSON.parse(t.dataset.args||'[]'))}});
document.addEventListener('change',e=>{const el=e.target.closest&&e.target.closest('[data-chg],[data-chk]');if(!el)return;const a=JSON.parse(el.dataset.args||'[]');
if(el.dataset.chg){const f=handlers[el.dataset.chg];if(typeof f==='function')el.hasAttribute('data-el')?f(el,...a):f(el.value,...a)}
else{const f=handlers[el.dataset.chk];if(typeof f==='function')f(...a,el.checked)}});
['dragstart','dragover','dragleave','drop','dragend'].forEach(n=>document.addEventListener(n,e=>{const t=e.target.closest&&e.target.closest('[data-'+n+']');if(!t)return;const f=handlers[t.dataset[n]];if(typeof f!=='function')return;
const p=new Proxy(e,{get(o,k){if(k==='currentTarget')return t;const v=o[k];return typeof v==='function'?v.bind(o):v}});f(p,...JSON.parse(t.dataset.args||'[]'))}));
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const t=e.target.closest&&e.target.closest('[data-kd]');if(!t)return;const f=handlers[t.dataset.kd];if(typeof f==='function'){e.preventDefault();f(...JSON.parse(t.dataset.args||'[]'))}});
function _pd(ev){ev.preventDefault()}
function _clr(el){el.value=''}
function _clipP(b){clip(gpromptFor(gen.name.trim()),b)}
function _rSM(v,c){setActiveScoreMode(v,c);result()}
function _rNM(v,c){setActiveNegMode(v,c);result()}
function _rP(v,c){setActivePass(v,c);result()}
