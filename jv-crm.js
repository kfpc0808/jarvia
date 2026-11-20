/* ═══════════════════════════════════════════════════════════════
   JARVIA 회원별 관리 (jv-crm.js)  ★ [2026-11-19] 신규
   · admin.html 「🗂 회원별 관리」 메뉴와 crm.html(CRM 담당 전용 화면)이 함께 쓰는 공통 화면
   · 저장: member_notes(관리 기록) · member_reqs(요청사항) · member_view_logs(상세 열람 기록)
           users/{uid}.crm  (목록용 요약: 담당자·최근 소통·다음 연락·진행 요청 수·소통 수)
   · 읽기: users · admins · service_logs · view_logs · calc_logs · transactions · lms_stats_members · lms_progress
   사용: import('./jv-crm.js').then(m=>m.mountCrm({db, root, me:{id,name,role,uid}}))
   ═══════════════════════════════════════════════════════════════ */
import{collection,doc,getDoc,getDocs,addDoc,updateDoc,query,where,orderBy,limit,serverTimestamp,Timestamp,increment,writeBatch}from'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const ROLES=['free_user','user','jarvia_member','jarvia_inner','inner_circle','con_homepage','branch_manager','jarvia_report'];
const ROLE_LABEL={free_user:'자비아(기간제)',user:'일반회원',jarvia_member:'JARVIA멤버십',jarvia_inner:'자비아멤버십(이너서클)',inner_circle:'이너서클',con_homepage:'컨홈페이지',branch_manager:'지사장',jarvia_report:'리포트회원'};
const SVC={main_access:'메인 화면 진입',my_platform:'내채널',jdr:'데일리리포트',case_report:'클로징',tax_weekly:'택스컨설팅위클리',medical_weekly:'메디컬위클리',master_guide:'마스터가이드',report:'특급보고서',weekly_lecture:'토요특강',
 bizinfo:'기업마당',research_note:'연구노트',tax_navi:'예규판례',snapshot:'금융통계',calc:'계산기(전문가용)',pptgen:'PPT생성',hospital_search:'병의원',new_hospital:'신규개원',morning_reading:'아침독서',client_report:'고객Report',medical_archive:'메디컬진입',
 sms_page:'문자화면',sms_send:'문자발송',ai_proposal:'AI제안서',voice_input:'고객입력',ai_assistant:'AI비서',monthly_report:'월간전략',signals:'실시간자료실',morning_consensus:'모닝컨센서스',fcc_quick:'생일상령일',policy_analysis:'약관분석',
 corp_report:'기업진단',worklog:'업무일지',report_alim:'알림톡',inner_platform:'이너서클',easy_memo:'이지M²',sales_talk:'영업주제',sales_talk_week:'영업주제 주간모음',stat_corner:'상담용통계',mypb_check:'재무검진',quick_calc:'간편계산기',quick_use:'간편계산기 사용',content_gift:'콘텐츠 선물 공유'};
const TOUCH=[['client_report','고객 리포트'],['morning_consensus','모닝 컨센서스'],['sales_talk','오늘의 영업주제'],['customer_letter','고객 레터'],['mypb_check','마이PB 재무검진']];
const HOWS=['📞 전화','💬 카톡','💬 알림톡','🏢 방문','🎥 줌','🏢 설명회','🗒 기타'];
const RESS=[['통화 완료','ok'],['재연락 요청','re'],['문자 남김','msg'],['부재중','miss']];
const PHRASES=['사용법 안내함','교육 권유','결제 안내','안부 연락','요청 처리 결과 안내','새 기능 안내'];
const RTYPES=['사용법 문의','오류 신고','결제·요금','자료 요청','교육 요청','기능 제안','탈퇴·변경','기타'];
const ST=['접수','진행중','완료'];
const LMS_TYPE={daily:'데일리리포트',client_daily:'고객데일리',consensus:'모닝 컨센서스',monthly:'월간리포트',master:'마스터가이드',medical:'메디컬위클리',tax:'택스컨설팅위클리',closing:'클로징'};

/* ── 공통 도우미 ── */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const TODAY=()=>ymd(new Date());
const addD=(s,n)=>{const x=new Date(s+'T00:00:00');x.setDate(x.getDate()+n);return ymd(x);};
const ms=t=>!t?0:(t.toMillis?t.toMillis():(t.seconds?t.seconds*1000:new Date(t).getTime()||0));
const md=s=>{if(!s)return'-';const x=new Date(s+'T00:00:00');return isNaN(x)?'-':(x.getMonth()+1)+'. '+x.getDate()+'.';};
const dl=s=>{const x=new Date(s+'T00:00:00');return x.getFullYear()+'. '+(x.getMonth()+1)+'. '+x.getDate()+'. ('+'일월화수목금토'[x.getDay()]+')';};
const hm=sec=>{const n=Math.round((sec||0)/60);return !n?'0분':(n>=60?Math.floor(n/60)+'시간'+(n%60?' '+n%60+'분':''):n+'분');};
const agoTxt=a=>a==null?'기록 없음':(a<=0?'오늘':(a===1?'어제':a+'일 전'));
const fmt=n=>Number(n||0).toLocaleString('ko-KR');
const nowHM=()=>{const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes());};

let C=null;   // 화면 상태
/* ★ [2026-11-20] 작성자 이름 — 관리자 계정을 여러 직원이 함께 쓰므로 기록마다 실제 작성자 이름을 남긴다(브라우저별 기억) */
const WKEY=()=>'jvcrm_writer_'+((C&&C.me&&C.me.id)||'');
function getWriter(){try{return localStorage.getItem(WKEY())||'';}catch(_e){return '';}}
function setWriter(v){try{localStorage.setItem(WKEY(),v);}catch(_e){}}
function needWriter(){const el=$c('crm-writer');const w=((el&&el.value)||getWriter()).trim();if(!w){toast('작성자 이름을 먼저 입력해 주세요');if(el)el.focus();return '';}setWriter(w);return w;}
const whoTxt=(w,acc)=>esc(w||acc||'')+(w&&acc&&w!==acc?' <span class="sub">('+esc(acc)+' 계정)</span>':'');
export async function mountCrm(opt){
  if(C&&C.root===opt.root&&C.ready){if(opt.openUid)openByUid(opt.openUid);return;}
  C={db:opt.db,root:opt.root,me:opt.me||{},ready:false,page:'mem',quick:'',view:[],cur:-1,dtab:'note',
     S:{mem:{key:'next',dir:1,p:1,q:'',mg:(opt.me&&opt.me.role==='crm')?'me':'all',f:'all',ps:50},
        note:{key:'at',dir:-1,p:1,q:'',mg:'all',how:'',res:'',from:addD(TODAY(),-30),to:TODAY(),ps:50},
        req:{key:'createdAt',dir:-1,p:1,q:'',mg:'all',st:'open',ps:50}},
     M:[],MM:{},mgrs:[],agg:null,lms:{},notesAll:null,reqsAll:null,det:null};
  injectCss();
  if(C.me.role==='crm'&&!getWriter()&&C.me.name)setWriter(C.me.name);
  C.root.innerHTML='<div id="crm-app"><div class="crm-loading">회원 정보를 불러오는 중...</div></div>';
  await loadBase();
  C.ready=true;render();
  loadAgg().then(()=>{renderToday();if(C.page==='mem')renderPage();});
  if(opt.openUid)openByUid(opt.openUid);
}
export function openByUid(uid){
  if(!C||!C.ready)return;
  const i=C.view.indexOf(uid);
  if(i>=0)openD(i);else{C.view=[uid];openD(0);}
}

/* ═════ 기본 데이터 ═════ */
async function loadBase(){
  const db=C.db;
  try{const a=await getDocs(collection(db,'admins'));C.mgrs=a.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==='active').map(x=>({id:x.id,name:x.name||x.loginId,loginId:x.loginId||'',role:x.role,authUid:x.authUid||''}));}catch(e){C.mgrs=[];}
  const us=await getDocs(collection(db,'users'));
  const today=TODAY();
  C.M=us.docs.map(d=>({id:d.id,...d.data()})).filter(m=>ROLES.includes(m.role)&&m.status!=='withdrawn'&&m.isTrial!==true&&m.isAdminTest!==true).map(m=>{
    const c=m.crm||{};const j=m.createdAt?new Date(ms(m.createdAt)):null;const ll=m.lastLoginAt?new Date(ms(m.lastLoginAt)):null;
    return {id:m.id,name:m.name||m.loginId||'',loginId:m.loginId||'',co:m.company||'',title:m.title||'',role:m.role,rl:ROLE_LABEL[m.role]||m.role,phone:m.phone||'',
      join:j?ymd(j):'',joinAgo:j?Math.floor((Date.now()-j)/864e5):9999,lastLogin:ll?ymd(ll):'',orgId:m.groupMasterId||(m.isGroup?m.id:'')||'',
      mgrId:c.mgrId||'',mgrName:c.mgrName||'',lastC:c.lastContact||'',next:c.next||'',openR:Number(c.openReq)||0,nCnt:Number(c.noteCnt)||0,
      d30:null,f30:null,lastAct:ll?ymd(ll):'',lm:0,ldone:0,warn:[]};});
  C.M.forEach((m,i)=>{m.no=i+1;C.MM[m.id]=m;});
  C.M.sort((a,b)=>String(b.join).localeCompare(String(a.join)));C.M.forEach((m,i)=>m.no=C.M.length-i);
  try{const ls=await getDocs(collection(db,'lms_stats_members'));const ym=today.slice(0,7).replace('-','');const ym2=today.slice(0,7);
    ls.docs.forEach(d=>{const v=d.data()||{};const m=C.MM[d.id];if(!m)return;const mo=(v.months||{});const cur=mo[ym]||mo[ym2]||{};
      m.lm=Number(cur.playedSec)||0;m.lmTot=Number(v.playedSec)||0;m.ldone=Number(v.done)||0;C.lms[d.id]=v;});}catch(e){console.warn('[CRM] 학습 요약 읽기 실패',e.message);}
  calcWarn();
}
function calcWarn(){
  const today=TODAY();
  C.M.forEach(m=>{m.warn=[];const la=m.lastAct?Math.floor((new Date(today)-new Date(m.lastAct))/864e5):null;m.ago=la;
    if(la==null){if(m.joinAgo>14)m.warn.push('접속 기록 없음');}else if(la>=15)m.warn.push(la+'일째 접속 없음');
    if(m.d30!=null&&m.p30!=null&&m.p30>=6&&m.d30<=m.p30/2)m.warn.push('접속일 전월 대비 '+Math.round((1-m.d30/m.p30)*100)+'% 감소');
    m.newbie=m.joinAgo<=14;});
}
/* 최근 60일 이용 집계 (목록의 30일 접속·기능 수, 전월 비교, 평균) */
async function loadAgg(){
  const db=C.db;const to=new Date();const from=new Date(Date.now()-59*864e5);from.setHours(0,0,0,0);
  const f=Timestamp.fromDate(from),t=Timestamp.fromDate(to);const cut=ymd(new Date(Date.now()-29*864e5));
  const A={};const get=uid=>A[uid]||(A[uid]={d:new Set(),p:new Set(),f:0,last:''});
  const add=(uid,ts,isFn)=>{const m=C.MM[uid];if(!m)return;const day=ymd(new Date(ms(ts)));const a=get(uid);if(day>=cut){a.d.add(day);if(isFn)a.f++;}else a.p.add(day);if(day>a.last)a.last=day;};
  try{
    const [sv,cl,vl]=await Promise.all([
      getDocs(query(collection(db,'service_logs'),where('createdAt','>=',f),where('createdAt','<=',t))).catch(()=>null),
      getDocs(query(collection(db,'calc_logs'),where('createdAt','>=',f),where('createdAt','<=',t))).catch(()=>null),
      getDocs(query(collection(db,'view_logs'),where('createdAt','>=',f),where('createdAt','<=',t))).catch(()=>null)]);
    if(sv)sv.docs.forEach(d=>{const v=d.data();if(v.userId)add(v.userId,v.createdAt,v.service!=='main_access');});
    if(cl)cl.docs.forEach(d=>{const v=d.data();if(v.userId)add(v.userId,v.createdAt,true);});
    if(vl)vl.docs.forEach(d=>{const v=d.data();if(v.userId)add(v.userId,v.createdAt,true);});
  }catch(e){console.warn('[CRM] 이용 집계 실패',e.message);}
  let sd=0,sf=0,n=0;const byRole={};
  C.M.forEach(m=>{const a=A[m.id];m.d30=a?a.d.size:0;m.p30=a?a.p.size:0;m.f30=a?a.f:0;if(a&&a.last&&a.last>m.lastAct)m.lastAct=a.last;
    if(m.joinAgo>=30){sd+=m.d30;sf+=m.f30;n++;const r=byRole[m.role]||(byRole[m.role]={d:0,f:0,n:0});r.d+=m.d30;r.f+=m.f30;r.n++;}});
  C.agg={avgD:n?sd/n:0,avgF:n?sf/n:0,byRole,sortedD:C.M.map(m=>m.d30).sort((a,b)=>a-b),sortedF:C.M.map(m=>m.f30).sort((a,b)=>a-b)};
  calcWarn();
}
const pctOf=(arr,v)=>{if(!arr||!arr.length)return 50;let i=0;while(i<arr.length&&arr[i]<=v)i++;return Math.round(i/arr.length*100);};

/* ═════ 화면 틀 ═════ */
function render(){
  const isCrm=C.me.role==='crm';
  C.root.innerHTML=`<div id="crm-app">
   <div class="crm-h"><h2>🗂 회원별 관리</h2><span class="crm-me">👤 ${esc(C.me.name||'')}${isCrm?' · CRM 담당':''}</span><button class="crm-btn sec sm" id="crm-reload" title="회원 정보·집계를 새로 불러옵니다">↻ 새로고침</button></div>
   <p class="crm-lead">위 카드를 누르면 그 대상만 목록에 나옵니다 · 열 제목을 누르면 정렬(한 번 더 누르면 반대로) · <b>이름이나 행을 누르면 상세 화면</b>이 열리고, 기록 후 「저장 후 다음 ▶」로 다음 회원으로 넘어갑니다.</p>
   <div class="crm-today" id="crm-today"></div>
   <div class="crm-ptabs"><button data-p="mem">👥 회원 목록 <small id="crm-c-mem"></small></button><button data-p="note">📝 관리 기록 전체</button><button data-p="req">📌 요청사항 전체</button></div>
   <div id="crm-page"></div></div>
   <div class="crm-modal" id="crm-mdl"><div class="crm-mbg"></div><div class="crm-mbox" id="crm-mbox"></div></div>
   <div class="crm-toast" id="crm-toast"></div>`;
  C.root.querySelectorAll('.crm-ptabs button').forEach(b=>b.onclick=()=>{C.quick='';setPage(b.dataset.p);});
  C.root.querySelector('.crm-mbg').onclick=closeD;
  $c('crm-reload').onclick=()=>{const o={db:C.db,root:C.root,me:C.me};C.ready=false;mountCrm(o);};
  if(!C._key){C._key=true;document.addEventListener('keydown',e=>{const m=document.getElementById('crm-mdl');if(!m||!m.classList.contains('on'))return;if(e.key==='Escape')closeD();if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();saveNote(true);}});}
  setPage(C.page);
}
const $c=id=>document.getElementById(id);
function toast(t){const e=$c('crm-toast');if(!e)return;e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2200);}
function setPage(p){C.page=p;C.root.querySelectorAll('.crm-ptabs button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));renderToday();renderPage();}
function mine(m){return m.mgrId===C.me.id;}
function renderToday(){
  const el=$c('crm-today');if(!el)return;const t=TODAY();const My=C.M.filter(mine);
  const cards=[['due','📞 오늘 연락할 회원',My.filter(m=>m.next&&m.next<=t).length,'red','내 담당 · 다음 연락일이 오늘이거나 지남'],
   ['req','📌 진행 중 요청',My.reduce((a,m)=>a+m.openR,0),'org','내 담당 회원'],
   ['warn','⚠ 주의 회원',My.filter(m=>m.warn.length).length,'red','장기 미접속·접속 급감'],
   ['newbie','🌱 신규 적응 (2주)',My.filter(m=>m.newbie).length,'pur','가입 14일 이내'],
   ['nolearn','📚 이번 달 학습 없음',My.filter(m=>!m.lm).length,'gry','내 담당 회원'],
   ['none','👤 담당자 미지정',C.M.filter(m=>!m.mgrId).length,'gry','전체 회원']];
  el.innerHTML=cards.map(c=>`<button class="crm-tcard ${C.page==='mem'&&C.quick===c[0]?'on':''}" data-q="${c[0]}" title="${c[4]}"><div class="k">${c[1]}</div><div class="v v-${c[3]}">${fmt(c[2])}</div></button>`).join('');
  el.querySelectorAll('.crm-tcard').forEach(b=>b.onclick=()=>{const q=b.dataset.q;C.quick=C.quick===q?'':q;const s=C.S.mem;s.f=C.quick||'all';s.mg=q==='none'?'none':(C.quick?'me':s.mg);s.p=1;if(q==='due'){s.key='next';s.dir=1;}setPage('mem');});
  const cm=$c('crm-c-mem');if(cm)cm.textContent=fmt(C.M.length)+'명';
}
function renderPage(){if(C.page==='mem')renderMem();else if(C.page==='note')renderNotes();else renderReqs();}

function th(cols,s){return '<tr>'+cols.map(c=>c[2]?`<th class="s ${s.key===c[0]?'on':''} ${c[3]||''}" data-k="${c[0]}">${c[1]}<span class="ar">${s.key===c[0]?(s.dir>0?'▲':'▼'):'⇅'}</span></th>`:`<th class="${c[3]||''}">${c[1]}</th>`).join('')+'</tr>';}
function sortBy(L,s,get){const k=s.key,d=s.dir;return L.sort((a,b)=>{const x=get(a,k),y=get(b,k);if(x===y)return 0;if(x===''||x==null)return 1;if(y===''||y==null)return -1;return (x>y?1:-1)*d;});}
function pager(n,s){const pages=Math.max(1,Math.ceil(n/s.ps));if(s.p>pages)s.p=pages;const a=Math.max(1,s.p-3),b=Math.min(pages,a+6);let h=`<button data-pg="${s.p-1}" ${s.p<=1?'disabled':''}>‹</button>`;
  for(let i=a;i<=b;i++)h+=`<button data-pg="${i}" class="${i===s.p?'on':''}">${i}</button>`;h+=`<button data-pg="${s.p+1}" ${s.p>=pages?'disabled':''}>›</button>`;
  return `<div class="crm-pager"><span>전체 ${fmt(n)}건${n?' · '+fmt((s.p-1)*s.ps+1)+'~'+fmt(Math.min(n,s.p*s.ps))+' 표시':''}</span><div class="pg">${h}</div><span><select data-ps>${[20,50,100,500,1000].map(x=>`<option ${x===s.ps?'selected':''}>${x}</option>`).join('')}</select> 줄씩</span></div>`;}
function sortSel(cols,s){return `<div class="crm-sortm">정렬 <select id="crm-sortm">${cols.filter(c=>c[2]).flatMap(c=>[[c[0]+'|1',c[1]+' ▲'],[c[0]+'|-1',c[1]+' ▼']]).map(o=>`<option value="${o[0]}" ${s.key+'|'+s.dir===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>`;}
function bindCommon(s){
  C.root.querySelectorAll('#crm-page th.s').forEach(t=>t.onclick=()=>{const k=t.dataset.k;if(s.key===k)s.dir*=-1;else{s.key=k;s.dir=(['name','next','co','mgrName','role','title','d','due','memberName','byName','type'].includes(k)?1:-1);}s.p=1;renderPage();});
  C.root.querySelectorAll('#crm-page [data-pg]').forEach(b=>b.onclick=()=>{s.p=+b.dataset.pg;renderPage();const pg=$c('crm-page');if(pg)pg.scrollIntoView({block:'start'});});
  const ps=C.root.querySelector('#crm-page [data-ps]');if(ps)ps.onchange=()=>{s.ps=+ps.value;s.p=1;renderPage();};
  const sm=$c('crm-sortm');if(sm)sm.onchange=()=>{const [k,d]=sm.value.split('|');s.key=k;s.dir=+d;s.p=1;renderPage();};
}
function mgrOpts(sel,withAll){return (withAll?`<option value="all">전체 담당자</option><option value="me">내 담당 회원</option>`:'')+C.mgrs.map(x=>`<option value="${x.id}" ${sel===x.id?'selected':''}>${esc(x.name)} (${esc(x.loginId)}${x.role==='crm'?' · CRM':''})</option>`).join('')+(withAll?`<option value="none">담당자 미지정</option>`:'');}

/* ═════ ① 회원 목록 ═════ */
const MCOLS=[['no','No.',1,'r'],['name','이름',1],['co','소속·직함',1],['role','회원유형',1],['mgrName','담당',1],['ago','마지막 접속',1],['d30','30일 접속',1,'r'],['f30','30일 기능 이용',1,'r'],['lm','이번 달 학습',1,'r'],['lastC','최근 소통',1],['nCnt','소통 수',1,'r'],['next','다음 연락',1],['openR','진행 요청',1,'r'],['flag','상태',0]];
function memRows(){const s=C.S.mem;const t=TODAY();let L=C.M.slice();
  if(s.mg==='me')L=L.filter(mine);else if(s.mg==='none')L=L.filter(m=>!m.mgrId);else if(s.mg!=='all')L=L.filter(m=>m.mgrId===s.mg);
  if(s.q){const q=s.q.toLowerCase();L=L.filter(m=>(m.name+' '+m.loginId+' '+m.co+' '+m.phone.replace(/-/g,'')).toLowerCase().includes(q.replace(/-/g,'')));}
  const f=s.f;if(f==='due')L=L.filter(m=>m.next&&m.next<=t);if(f==='req')L=L.filter(m=>m.openR);if(f==='warn')L=L.filter(m=>m.warn.length);
  if(f==='newbie')L=L.filter(m=>m.newbie);if(f==='idle')L=L.filter(m=>m.ago==null||m.ago>=15);if(f==='nocall')L=L.filter(m=>!m.lastC||m.lastC<addD(t,-60));if(f==='nolearn')L=L.filter(m=>!m.lm);
  return sortBy(L,s,(m,k)=>k==='ago'?(m.ago==null?99999:m.ago):(k==='name'?m.name:m[k]));}
function renderMem(){
  const s=C.S.mem,L=memRows();C.view=L.map(m=>m.id);const P=L.slice((s.p-1)*s.ps,s.p*s.ps);const t=TODAY();const isCrm=C.me.role==='crm';
  const F=[['all','전체'],['due','오늘 연락'],['req','요청 진행중'],['warn','⚠ 주의'],['idle','15일 이상 미접속'],['nocall','60일 이상 소통 없음'],['nolearn','이번 달 학습 없음'],['newbie','신규']];
  const unassigned=C.M.filter(m=>!m.mgrId).length;
  $c('crm-page').innerHTML=`<div class="crm-fbar"><input type="search" id="crm-q" placeholder="이름·아이디·소속·전화번호 검색" value="${esc(s.q)}">
   <select id="crm-mg">${mgrOpts(s.mg,true)}</select>
   <div class="crm-chips">${F.map(x=>`<button class="crm-chip ${s.f===x[0]?'on':''}" data-f="${x[0]}">${x[1]}</button>`).join('')}</div>
   <div class="sp"><button class="crm-btn sec sm" id="crm-csv">📥 엑셀(CSV)</button>${L.length?`<button class="crm-btn grn sm" id="crm-start">▶ 이 목록 첫 회원부터</button>`:''}</div></div>
   ${!isCrm&&unassigned?`<div class="crm-assign">👤 담당자 미지정 <b>${fmt(unassigned)}명</b> → <select id="crm-as">${mgrOpts('',false)}</select> <button class="crm-btn sm" id="crm-as-go">한 번에 배정</button></div>`:''}
   ${!isCrm&&L.length?`<div class="crm-assign">🔁 지금 목록(검색·조건 적용) <b>${fmt(L.length)}명</b>의 담당자를 → <select id="crm-bm">${mgrOpts('',false)}<option value="">담당자 미지정 (배정 취소)</option></select> <button class="crm-btn sec sm" id="crm-bm-go">한 번에 변경</button></div>`:''}
   ${C.agg?'':'<div class="crm-hint" style="margin:0 0 8px">30일 접속·기능 이용은 집계 중입니다 (잠시 후 자동 표시)</div>'}
   ${sortSel(MCOLS,s)}
   <div class="crm-tw"><table class="crm-list"><thead>${th(MCOLS,s)}</thead><tbody>${P.length?P.map((m,i)=>{
    const dot=m.ago==null?'off':(m.ago<=3?'on':(m.ago<=14?'mid':'off'));
    const nx=m.next?(m.next<t?`<span class="due">${md(m.next)} 지남</span>`:(m.next===t?'<span class="due">오늘</span>':md(m.next))):'<span class="sub">미정</span>';
    return `<tr data-i="${(s.p-1)*s.ps+i}"><td class="r no" data-l="No.">${m.no}</td><td data-l="이름"><span class="nm">${esc(m.name)}</span> <span class="sub">${esc(m.loginId)}</span></td>
     <td data-l="소속">${esc(m.co)} <span class="sub">${esc(m.title)}</span></td><td data-l="회원유형">${esc(m.rl)}</td><td data-l="담당">${m.mgrName?esc(m.mgrName):'<span class="due">미지정</span>'}</td>
     <td data-l="마지막 접속"><span><i class="dot d-${dot}"></i>${agoTxt(m.ago)}</span></td><td class="r" data-l="30일 접속">${m.d30==null?'…':m.d30+'일'}</td><td class="r" data-l="30일 기능 이용">${m.f30==null?'…':fmt(m.f30)+'회'}</td>
     <td class="r" data-l="이번 달 학습">${m.lm?hm(m.lm):'<span class="sub">0분</span>'}</td><td data-l="최근 소통">${m.lastC?md(m.lastC):'<span class="sub">없음</span>'}</td><td class="r" data-l="소통 수">${m.nCnt}</td>
     <td data-l="다음 연락">${nx}</td><td class="r" data-l="진행 요청">${m.openR?`<span class="bdg req">${m.openR}</span>`:'-'}</td>
     <td data-l="상태">${m.warn.length?`<span class="bdg warn" title="${esc(m.warn.join(' · '))}">⚠ 주의</span>`:''}${m.newbie?'<span class="bdg new">신규</span>':''}</td></tr>`;}).join(''):`<tr><td colspan="14" class="crm-empty">조건에 맞는 회원이 없습니다.</td></tr>`}</tbody></table></div>${pager(L.length,s)}`;
  const q=$c('crm-q');q.oninput=()=>{s.q=q.value.trim();s.p=1;clearTimeout(renderMem.t);renderMem.t=setTimeout(()=>{renderMem();const q2=$c('crm-q');if(q2){q2.focus();q2.setSelectionRange(q2.value.length,q2.value.length);}},300);};
  $c('crm-mg').value=s.mg;$c('crm-mg').onchange=e=>{s.mg=e.target.value;s.p=1;C.quick='';renderToday();renderMem();};
  C.root.querySelectorAll('#crm-page .crm-chip').forEach(b=>b.onclick=()=>{s.f=b.dataset.f;s.p=1;C.quick=['due','req','warn','newbie','nolearn'].includes(s.f)?s.f:'';renderToday();renderMem();});
  C.root.querySelectorAll('#crm-page tbody tr[data-i]').forEach(r=>r.onclick=()=>openD(+r.dataset.i));
  const st=$c('crm-start');if(st)st.onclick=()=>openD(0);
  $c('crm-csv').onclick=()=>csv('회원별관리_회원목록',['No.','이름','아이디','소속','직함','회원유형','연락처','담당','마지막 접속','30일 접속일','30일 기능 이용','이번 달 학습(분)','최근 소통','소통 수','다음 연락','진행 요청','주의'],
    L.map(m=>[m.no,m.name,m.loginId,m.co,m.title,m.rl,m.phone,m.mgrName,m.lastAct,m.d30,m.f30,Math.round((m.lm||0)/60),m.lastC,m.nCnt,m.next,m.openR,m.warn.join(' / ')]));
  const ag=$c('crm-as-go');if(ag)ag.onclick=()=>bulkAssign($c('crm-as').value);
  const bm=$c('crm-bm-go');if(bm)bm.onclick=()=>bulkChange(L,$c('crm-bm').value);
  bindCommon(s);
}
async function bulkAssign(mgrId){
  const g=C.mgrs.find(x=>x.id===mgrId);if(!g)return;const L=C.M.filter(m=>!m.mgrId);if(!L.length)return;
  if(!confirm(`담당자가 없는 회원 ${L.length}명을 「${g.name}」 담당으로 한 번에 배정합니다.\n계속할까요?`))return;
  try{for(let i=0;i<L.length;i+=400){const b=writeBatch(C.db);L.slice(i,i+400).forEach(m=>b.update(doc(C.db,'users',m.id),{'crm.mgrId':g.id,'crm.mgrName':g.name,'crm.updatedAt':serverTimestamp()}));await b.commit();}
    L.forEach(m=>{m.mgrId=g.id;m.mgrName=g.name;});toast(L.length+'명을 '+g.name+' 담당으로 배정했습니다');renderToday();renderMem();
  }catch(e){toast('배정 실패: '+e.message);}
}
/* ★ [2026-11-20] 담당자 일괄 변경·배정 취소 — 지금 목록(검색·조건 적용)의 회원 대상 */
async function bulkChange(list,mgrId){
  const g=mgrId?C.mgrs.find(x=>x.id===mgrId):null;if(mgrId&&!g)return;
  const L=list.filter(m=>(m.mgrId||'')!==(mgrId||''));
  if(!L.length){toast('바꿀 회원이 없습니다 (이미 '+(g?g.name+' 담당':'미지정')+')');return;}
  const to=g?`「${g.name}」 담당으로 변경`:'「담당자 미지정」으로 배정 취소';
  if(!confirm(`지금 목록 회원 ${L.length}명을 ${to}합니다.\n(이미 같은 담당인 ${list.length-L.length}명은 제외)\n계속할까요?`))return;
  try{for(let i=0;i<L.length;i+=400){const b=writeBatch(C.db);L.slice(i,i+400).forEach(m=>b.update(doc(C.db,'users',m.id),{'crm.mgrId':g?g.id:'','crm.mgrName':g?g.name:'','crm.updatedAt':serverTimestamp()}));await b.commit();}
    L.forEach(m=>{m.mgrId=g?g.id:'';m.mgrName=g?g.name:'';});toast(L.length+'명 '+(g?g.name+' 담당으로 변경':'배정 취소')+' 완료');renderToday();renderMem();
  }catch(e){toast('변경 실패: '+e.message);}
}
function csv(name,head,rows){const q=v=>{const s=String(v==null?'':v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const txt='﻿'+[head,...rows].map(r=>r.map(q).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));a.download=name+'_'+TODAY()+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}

/* ═════ ② 관리 기록 전체 ═════ */
const NCOLS=[['at','일시',1],['memberName','회원',1],['co','소속',1],['how','방법',1],['res','결과',1],['txt','내용',0],['next','다음 연락',1],['byName','작성',1],['reqNo','관련 요청',0]];
async function renderNotes(){
  const s=C.S.note;const pg=$c('crm-page');
  const key=s.from+'~'+s.to;
  if(!C.notesAll||C.notesAll.key!==key){pg.innerHTML='<div class="crm-loading">관리 기록을 불러오는 중...</div>';
    try{const sn=await getDocs(query(collection(C.db,'member_notes'),where('at','>=',Timestamp.fromDate(new Date(s.from+'T00:00:00'))),where('at','<=',Timestamp.fromDate(new Date(s.to+'T23:59:59'))),orderBy('at','desc'),limit(3000)));
      C.notesAll={key,rows:sn.docs.map(d=>({id:d.id,...d.data()}))};}catch(e){pg.innerHTML='<div class="crm-empty">불러오지 못했습니다 — '+esc(e.message)+'</div>';return;}}
  let L=C.notesAll.rows.map(n=>({...n,co:(C.MM[n.memberUid]||{}).co||'',atMs:ms(n.at)}));
  if(s.mg==='me')L=L.filter(x=>x.byUid===C.me.uid);else if(s.mg!=='all')L=L.filter(x=>x.byId===s.mg);
  if(s.how)L=L.filter(x=>x.how===s.how);if(s.res)L=L.filter(x=>x.res===s.res);
  if(s.q){const q=s.q.toLowerCase();L=L.filter(x=>((x.memberName||'')+(x.memberLoginId||'')+(x.txt||'')+(x.writerName||'')).toLowerCase().includes(q));}
  sortBy(L,s,(x,k)=>k==='at'?x.atMs:(k==='byName'?(x.writerName||x.byName||''):x[k]));const P=L.slice((s.p-1)*s.ps,s.p*s.ps);
  pg.innerHTML=`<div class="crm-fbar"><input type="date" id="crm-nf" value="${s.from}"> ~ <input type="date" id="crm-nt" value="${s.to}">
   <select id="crm-nm"><option value="all">전체 작성자</option><option value="me" ${s.mg==='me'?'selected':''}>내가 쓴 기록</option>${C.mgrs.map(x=>`<option value="${x.id}" ${s.mg===x.id?'selected':''}>${esc(x.name)} (${esc(x.loginId)})</option>`).join('')}</select>
   <select id="crm-nh"><option value="">모든 방법</option>${HOWS.map(x=>`<option ${s.how===x?'selected':''}>${x}</option>`).join('')}</select>
   <select id="crm-nr"><option value="">모든 결과</option>${RESS.map(x=>`<option ${s.res===x[0]?'selected':''}>${x[0]}</option>`).join('')}</select>
   <input type="search" id="crm-nq" placeholder="회원·내용·작성자 검색" value="${esc(s.q)}"><div class="sp"><button class="crm-btn sec sm" id="crm-ncsv">📥 엑셀(CSV)</button></div></div>
   ${sortSel(NCOLS,s)}
   <div class="crm-tw"><table class="crm-list"><thead>${th(NCOLS,s)}</thead><tbody>${P.length?P.map(x=>`<tr data-id="${esc(x.memberUid)}"><td data-l="일시">${md(x.d)} ${esc(x.t||'')}</td><td data-l="회원"><span class="nm">${esc(x.memberName||'')}</span> <span class="sub">${esc(x.memberLoginId||'')}</span></td><td data-l="소속">${esc(x.co)}</td>
    <td data-l="방법"><span class="how">${esc(x.how||'')}</span></td><td data-l="결과"><span class="res r-${(RESS.find(r=>r[0]===x.res)||['','ok'])[1]}">${esc(x.res||'')}</span></td><td data-l="내용"><div class="trunc">${esc(x.txt||'')}</div></td>
    <td data-l="다음 연락">${x.next?md(x.next):'-'}</td><td data-l="작성">${whoTxt(x.writerName,x.byName)}</td><td data-l="관련 요청">${esc(x.reqNo||'-')}</td></tr>`).join(''):`<tr><td colspan="9" class="crm-empty">조건에 맞는 기록이 없습니다.</td></tr>`}</tbody></table></div>${pager(L.length,s)}
   <div class="crm-hint">행을 누르면 그 회원의 상세 화면이 열립니다 · 고른 기간의 기록만 불러옵니다 (기본 최근 30일)</div>`;
  const on=(id,f,re)=>{$c(id).onchange=e=>{f(e.target.value);s.p=1;if(re)C.notesAll=null;renderNotes();};};
  on('crm-nf',v=>s.from=v,1);on('crm-nt',v=>s.to=v,1);on('crm-nm',v=>s.mg=v);on('crm-nh',v=>s.how=v);on('crm-nr',v=>s.res=v);on('crm-nq',v=>s.q=v.trim());
  C.root.querySelectorAll('#crm-page tbody tr[data-id]').forEach(r=>r.onclick=()=>{C.view=[r.dataset.id];openD(0);});
  $c('crm-ncsv').onclick=()=>csv('회원별관리_관리기록',['날짜','시각','회원','아이디','소속','방법','결과','내용','다음 연락','작성자','로그인 계정','관련 요청'],L.map(x=>[x.d,x.t,x.memberName,x.memberLoginId,x.co,x.how,x.res,x.txt,x.next,x.writerName||'',x.byName,x.reqNo]));
  bindCommon(s);
}

/* ═════ ③ 요청사항 전체 ═════ */
const RCOLS=[['no','번호',1],['d','접수일',1],['memberName','회원',1],['type','유형',1],['title','제목',0],['due','기한',1],['mgrName','처리 담당',1],['st','상태',1]];
async function renderReqs(){
  const s=C.S.req;const pg=$c('crm-page');const t=TODAY();
  if(!C.reqsAll){pg.innerHTML='<div class="crm-loading">요청사항을 불러오는 중...</div>';
    try{const sn=await getDocs(query(collection(C.db,'member_reqs'),orderBy('createdAt','desc'),limit(2000)));C.reqsAll=sn.docs.map(d=>({id:d.id,...d.data()}));}
    catch(e){pg.innerHTML='<div class="crm-empty">불러오지 못했습니다 — '+esc(e.message)+'</div>';return;}}
  let L=C.reqsAll.slice();
  if(s.st==='open')L=L.filter(x=>x.st<2);if(s.st==='over')L=L.filter(x=>x.st<2&&x.due&&x.due<t);if(s.st==='done')L=L.filter(x=>x.st===2);
  if(s.mg==='me')L=L.filter(x=>x.mgrId===C.me.id);else if(s.mg!=='all')L=L.filter(x=>x.mgrId===s.mg);
  if(s.q){const q=s.q.toLowerCase();L=L.filter(x=>((x.memberName||'')+(x.title||'')+(x.no||'')).toLowerCase().includes(q));}
  sortBy(L,s,(x,k)=>k==='createdAt'?ms(x.createdAt):x[k]);const P=L.slice((s.p-1)*s.ps,s.p*s.ps);
  pg.innerHTML=`<div class="crm-fbar"><div class="crm-chips">${[['open','진행 중'],['over','기한 지남'],['done','완료'],['all','전체']].map(x=>`<button class="crm-chip ${s.st===x[0]?'on':''}" data-st="${x[0]}">${x[1]}</button>`).join('')}</div>
   <select id="crm-rm"><option value="all">전체 담당</option><option value="me" ${s.mg==='me'?'selected':''}>내 담당</option>${C.mgrs.map(x=>`<option value="${x.id}" ${s.mg===x.id?'selected':''}>${esc(x.name)} (${esc(x.loginId)})</option>`).join('')}</select>
   <input type="search" id="crm-rq" placeholder="회원·제목·번호 검색" value="${esc(s.q)}"><div class="sp"><button class="crm-btn sec sm" id="crm-rre">↻ 새로 불러오기</button></div></div>
   ${sortSel(RCOLS,s)}
   <div class="crm-tw"><table class="crm-list"><thead>${th(RCOLS,s)}</thead><tbody>${P.length?P.map(x=>{const over=x.st<2&&x.due&&x.due<t;return `<tr data-id="${esc(x.memberUid)}"><td data-l="번호">${esc(x.no)}</td><td data-l="접수일">${md(x.d)}</td><td data-l="회원"><span class="nm">${esc(x.memberName||'')}</span></td>
    <td data-l="유형">${esc(x.type||'')}</td><td data-l="제목"><div class="trunc">${esc(x.title||'')}</div></td><td data-l="기한" class="${over?'due':''}">${md(x.due)}${over?' 지남':''}</td>
    <td data-l="처리 담당">${esc(x.mgrName||'')}</td><td data-l="상태"><span class="st st-${x.st}">${ST[x.st]||''}</span></td></tr>`;}).join(''):`<tr><td colspan="8" class="crm-empty">조건에 맞는 요청이 없습니다.</td></tr>`}</tbody></table></div>${pager(L.length,s)}`;
  C.root.querySelectorAll('#crm-page [data-st]').forEach(b=>b.onclick=()=>{s.st=b.dataset.st;s.p=1;renderReqs();});
  $c('crm-rm').onchange=e=>{s.mg=e.target.value;s.p=1;renderReqs();};$c('crm-rq').onchange=e=>{s.q=e.target.value.trim();s.p=1;renderReqs();};
  $c('crm-rre').onclick=()=>{C.reqsAll=null;renderReqs();};
  C.root.querySelectorAll('#crm-page tbody tr[data-id]').forEach(r=>r.onclick=()=>{C.view=[r.dataset.id];C.dtab='req';openD(0,true);});
  bindCommon(s);
}

/* ═════ 회원 상세 ═════ */
let QF={res:'통화 완료',how:'📞 전화',next:''};
async function openD(i,keepTab){
  C.cur=i;if(!keepTab)C.dtab='note';QF={res:'통화 완료',how:QF.how||'📞 전화',next:''};
  const uid=C.view[i];const m=C.MM[uid];if(!m){toast('회원 정보를 찾을 수 없습니다');return;}
  C.det={uid,notes:null,reqs:null,logs:null,logDays:90,lprog:null,useCat:'',useQ:'',useDays:30,patDays:30,nLim:30};
  $c('crm-mdl').classList.add('on');document.body.style.overflow='hidden';
  renderD();
  addDoc(collection(C.db,'member_view_logs'),{memberUid:uid,byUid:C.me.uid||'',byId:C.me.id||'',byName:C.me.name||'',at:serverTimestamp()}).catch(()=>{});
  loadNotes();loadReqs();
}
function closeD(){$c('crm-mdl').classList.remove('on');document.body.style.overflow='';renderToday();if(C.page==='mem')renderMem();}
async function loadNotes(){const d=C.det;try{const sn=await getDocs(query(collection(C.db,'member_notes'),where('memberUid','==',d.uid),orderBy('at','desc'),limit(d.nLim+1)));if(C.det!==d)return;d.notes=sn.docs.map(x=>({id:x.id,...x.data()}));}catch(e){if(C.det!==d)return;d.notes=[];d.notesErr=e.message;}if(C.dtab==='note'||C.dtab==='use')renderTab();}
async function loadReqs(){const d=C.det;try{const sn=await getDocs(query(collection(C.db,'member_reqs'),where('memberUid','==',d.uid),orderBy('createdAt','desc'),limit(100)));if(C.det!==d)return;d.reqs=sn.docs.map(x=>({id:x.id,...x.data()}));}catch(e){if(C.det!==d)return;d.reqs=[];d.reqsErr=e.message;}renderD(true);}
async function loadLogs(days){
  const d=C.det;d.logDays=days;d.logs=null;renderTab();
  const f=Timestamp.fromDate(new Date(Date.now()-days*864e5));const uid=d.uid;
  const q=c=>getDocs(query(collection(C.db,c),where('userId','==',uid),where('createdAt','>=',f),orderBy('createdAt','desc'),limit(1500))).catch(e=>{console.warn('[CRM]',c,e.message);return null;});
  const [sv,vl,cl,tx]=await Promise.all([q('service_logs'),q('view_logs'),q('calc_logs'),q('transactions')]);
  if(C.det!==d)return;
  const rows=[];
  if(sv)sv.docs.forEach(x=>{const v=x.data();const k=String(v.service||'');rows.push({t:ms(v.createdAt),c:k==='main_access'?'접속':'기능',k,x:SVC[k]||k,main:k==='main_access',dev:devOf(v)});});
  const cids=new Set();if(vl)vl.docs.forEach(x=>{const v=x.data();if(v.contentId)cids.add(String(v.contentId));});
  const ttl={};await Promise.all([...cids].slice(0,80).map(async c=>{try{const s=await getDoc(doc(C.db,'contents',c));if(s.exists())ttl[c]=s.data().title||'';}catch(_e){}}));
  if(vl)vl.docs.forEach(x=>{const v=x.data();const c=String(v.contentId||'');rows.push({t:ms(v.createdAt),c:'콘텐츠',k:'view',x:(ttl[c]||(c.startsWith('cr_')?'클로징리포트':'콘텐츠'))+' 열람',dev:devOf(v)});});
  if(cl)cl.docs.forEach(x=>{const v=x.data();rows.push({t:ms(v.createdAt),c:'계산기',k:v.quick?'quick_use':'calc',x:(v.quick?'간편계산기 · ':'계산기 · ')+String(v.calcTitle||'').replace(/^간편\s*/,''),dev:devOf(v)});});
  if(tx)tx.docs.forEach(x=>{const v=x.data();rows.push({t:ms(v.createdAt),c:'결제·포인트',k:'tx',x:v.memo||v.type||'',s:v.amount!=null?fmt(v.amount)+(v.unit==='point'?'P':'원'):''});});
  d.logs=rows.sort((a,b)=>b.t-a.t);renderTab();
}
function devOf(v){const u=String(v.device||v.ua||v.userAgent||'');if(!u)return'';if(/tablet|ipad/i.test(u))return'📲 태블릿';if(/mobi|android|iphone|phone/i.test(u))return'📱 휴대폰';if(/pc|windows|mac|desktop/i.test(u))return'💻 PC';return'';}
async function loadLearn(){const d=C.det;try{const sn=await getDocs(query(collection(C.db,'lms_progress'),where('uid','==',d.uid)));if(C.det!==d)return;d.lprog=sn.docs.map(x=>x.data());}catch(e){if(C.det!==d)return;d.lprog=[];d.lErr=e.message;}renderTab();}

function renderD(keep){
  const d=C.det;const m=C.MM[d.uid];if(!m)return;const t=TODAY();
  const box=$c('crm-mbox');const sc=keep&&box.querySelector('.crm-mscroll')?box.querySelector('.crm-mscroll').scrollTop:0;const qt=keep&&$c('crm-qt')?$c('crm-qt').value:'';
  const reqs=d.reqs||[];const open=reqs.filter(r=>r.st<2);
  box.innerHTML=`<div class="crm-mh"><div class="av">${esc((m.name||'?')[0])}</div>
   <div class="who"><h3>${esc(m.name)} <span class="sub">${esc(m.loginId)}</span></h3>
    <div class="meta">${esc(m.co)} ${esc(m.title)} · <b>${esc(m.rl)}</b> · 가입 ${esc(m.join||'-')} · 마지막 접속 ${agoTxt(m.ago)}${m.phone?` · <a href="tel:${esc(m.phone.replace(/[^0-9+]/g,''))}" class="tel">📞 ${esc(m.phone)}</a>`:''}</div></div>
   <div class="nav"><select id="crm-mgr" class="crm-sel">${`<option value="">담당자 미지정</option>`+C.mgrs.map(x=>`<option value="${x.id}" ${x.id===m.mgrId?'selected':''}>담당 ${esc(x.name)} (${esc(x.loginId)})</option>`).join('')}</select>
    <button class="crm-btn sec sm" id="crm-pv" ${C.cur<=0?'disabled':''}>◀ 이전</button><span class="pos">${C.cur+1} / ${fmt(C.view.length)}</span><button class="crm-btn sec sm" id="crm-nx" ${C.cur>=C.view.length-1?'disabled':''}>다음 ▶</button>
    <button class="x" id="crm-x" aria-label="닫기">×</button></div></div>
  <div class="crm-mscroll">
   ${m.warn.length?`<div class="crm-alert"><b>⚠ 관리 필요</b> ${esc(m.warn.join(' · '))}</div>`:''}
   <div class="crm-cards">
    <div class="card ${m.next&&m.next<=t?'warn':''}"><div class="k">다음 연락일</div><div class="v">${m.next?md(m.next):'미정'}</div></div>
    <div class="card"><div class="k">최근 소통</div><div class="v">${m.lastC?md(m.lastC):'없음'}</div><div class="s">소통 ${m.nCnt}건</div></div>
    <div class="card ${open.length?'warn':''}"><div class="k">진행 중 요청</div><div class="v">${d.reqs?open.length+'건':'…'}</div><div class="s">전체 ${d.reqs?reqs.length:'…'}건</div></div>
    <div class="card ${m.ago!=null&&m.ago>14?'warn':''}"><div class="k">30일 접속일</div><div class="v">${m.d30==null?'…':m.d30+'일'}</div><div class="s">${C.agg?'전체 평균 '+C.agg.avgD.toFixed(1)+'일':''}</div></div>
    <div class="card"><div class="k">30일 기능 이용</div><div class="v">${m.f30==null?'…':fmt(m.f30)+'회'}</div><div class="s">${C.agg?'전체 평균 '+Math.round(C.agg.avgF)+'회':''}</div></div>
    <div class="card ${m.lm?'':'warn'}"><div class="k">이번 달 학습</div><div class="v">${hm(m.lm)}</div><div class="s">누적 이수 ${m.ldone}강좌</div></div>
   </div>
   <div class="crm-quick"><h4>📝 소통 기록 <small>Ctrl+Enter = 저장 후 다음 회원 · 부재중은 버튼 한 번에 저장(다음 연락 내일)</small></h4>
    <div class="qrow"><span class="lb">작성자 <b style="color:#C0392B">*</b></span><input id="crm-writer" class="crm-sel" style="width:160px" maxlength="20" placeholder="실제 작성자 이름" value="${esc(getWriter())}"><span class="sub">로그인 계정: ${esc(C.me.name||'')} · 이 PC에서는 다음부터 자동으로 채워집니다</span></div>
    <div class="qrow"><span class="lb">결과</span>${RESS.filter(r=>r[0]!=='부재중').map(r=>`<button class="qb ${QF.res===r[0]?'on':''}" data-res="${r[0]}">${r[0]==='통화 완료'?'✅ ':r[0]==='재연락 요청'?'🔁 ':'💬 '}${r[0]}</button>`).join('')}<button class="qb miss" id="crm-miss">📵 부재중 (바로 저장 → 다음)</button></div>
    <div class="qrow"><span class="lb">방법</span>${HOWS.slice(0,5).map(x=>`<button class="qb ${QF.how===x?'on':''}" data-how="${x}">${x}</button>`).join('')}<select id="crm-how2" class="crm-sel"><option value="">기타 방법…</option>${HOWS.slice(5).map(x=>`<option ${QF.how===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="qrow"><span class="lb">자주 쓰는 말</span>${PHRASES.map(x=>`<button class="qb ph" data-ph="${x}">+ ${x}</button>`).join('')}</div>
    <div class="qrow"><span class="lb">내용</span><textarea id="crm-qt" placeholder="통화·안내 내용, 회원 반응, 약속한 것">${esc(qt)}</textarea></div>
    <div class="qrow"><span class="lb">다음 연락</span>${[['+1일',1],['+3일',3],['+1주',7],['+2주',14],['+1달',30],['없음',0]].map(x=>`<button class="qb ${QF.nset&&QF.next===(x[1]?addD(t,x[1]):'')?'on':''}" data-nx="${x[1]}">${x[0]}</button>`).join('')}<input type="date" id="crm-qn" value="${QF.next}" class="crm-sel">
     <select id="crm-qr" class="crm-sel"><option value="">관련 요청 없음</option>${reqs.filter(r=>r.st<2).map(r=>`<option value="${esc(r.no)}">${esc(r.no)} ${esc((r.title||'').slice(0,14))}</option>`).join('')}</select></div>
    <div class="qsave"><small>회원이 요청한 것이 있으면 「요청으로도 등록」을 누르세요</small><button class="crm-btn sec" id="crm-toreq">📌 요청으로도 등록</button><button class="crm-btn sec" id="crm-sv">저장</button><button class="crm-btn grn" id="crm-svn">저장 후 다음 ▶</button></div>
   </div>
   <div class="crm-tabs">${[['note','📝 관리 기록'],['req','📌 요청사항'+(open.length?` <span class="n">${open.length}</span>`:'')],['learn','🎓 학습 현황'],['use','📋 이용 기록'],['pat','📊 이용 패턴'],['mon','📅 월별 요약']].map(x=>`<button data-t="${x[0]}" class="${C.dtab===x[0]?'on':''}">${x[1]}</button>`).join('')}</div>
   <div class="crm-tbody" id="crm-tb"></div></div>`;
  $c('crm-x').onclick=closeD;
  $c('crm-writer').onchange=e=>{setWriter(e.target.value.trim());};
  $c('crm-pv').onclick=()=>{if(C.cur>0)openD(C.cur-1);};$c('crm-nx').onclick=()=>{if(C.cur<C.view.length-1)openD(C.cur+1);};
  $c('crm-mgr').onchange=async e=>{const g=C.mgrs.find(x=>x.id===e.target.value);try{await updateDoc(doc(C.db,'users',m.id),{'crm.mgrId':g?g.id:'','crm.mgrName':g?g.name:'','crm.updatedAt':serverTimestamp()});m.mgrId=g?g.id:'';m.mgrName=g?g.name:'';toast('담당자: '+(g?g.name:'미지정'));}catch(err){toast('변경 실패: '+err.message);}};
  box.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{QF.res=b.dataset.res;renderD(true);});
  box.querySelectorAll('[data-how]').forEach(b=>b.onclick=()=>{QF.how=b.dataset.how;renderD(true);});
  $c('crm-how2').onchange=e=>{if(e.target.value){QF.how=e.target.value;renderD(true);}};
  box.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>{const ta=$c('crm-qt');ta.value=(ta.value?ta.value+', ':'')+b.dataset.ph;ta.focus();});
  box.querySelectorAll('[data-nx]').forEach(b=>b.onclick=()=>{const n=+b.dataset.nx;QF.next=n?addD(TODAY(),n):'';QF.nset=true;renderD(true);});
  $c('crm-qn').onchange=e=>{QF.next=e.target.value;QF.nset=true;};
  $c('crm-miss').onclick=()=>{QF.res='부재중';QF.next=addD(TODAY(),1);QF.nset=true;const ta=$c('crm-qt');if(!ta.value.trim())ta.value='부재중';saveNote(true);};
  $c('crm-sv').onclick=()=>saveNote(false);$c('crm-svn').onclick=()=>saveNote(true);
  $c('crm-toreq').onclick=async()=>{const txt=$c('crm-qt').value.trim();if(txt){const ok=await saveNote(false,true);if(!ok)return;}C.dtab='req';renderD(true);setTimeout(()=>{const f=$c('crm-rf');if(f){f.open=true;$c('crm-r-b').value=txt;$c('crm-r-t').focus();}},0);};
  box.querySelectorAll('.crm-tabs button').forEach(b=>b.onclick=()=>{C.dtab=b.dataset.t;box.querySelectorAll('.crm-tabs button').forEach(x=>x.classList.toggle('on',x===b));renderTab();});
  if(keep){const s=box.querySelector('.crm-mscroll');if(s)s.scrollTop=sc;}
  renderTab();
}
let _saving=false;
async function saveNote(next,silent){
  if(_saving)return false;const d=C.det;const m=C.MM[d.uid];const ta=$c('crm-qt');const txt=(ta.value||'').trim();
  if(!txt&&QF.res!=='부재중'){toast('내용을 입력하거나 「자주 쓰는 말」을 눌러 주세요');ta.focus();return false;}
  const writer=needWriter();if(!writer)return false;
  const nx=$c('crm-qn').value||QF.next||'';const reqNo=$c('crm-qr').value||'';const day=TODAY(),tm=nowHM();
  _saving=true;
  try{
    const rec={memberUid:m.id,memberName:m.name,memberLoginId:m.loginId,orgId:m.orgId||'',d:day,t:tm,at:serverTimestamp(),how:QF.how,res:QF.res,txt:txt||'부재중',next:nx,reqNo,byUid:C.me.uid||'',byId:C.me.id||'',byName:C.me.name||'',writerName:writer,createdAt:serverTimestamp()};
    const ref=await addDoc(collection(C.db,'member_notes'),rec);
    const up={'crm.lastContact':day,'crm.next':nx,'crm.noteCnt':increment(1),'crm.updatedAt':serverTimestamp()};
    if(!m.mgrId&&C.me.id){up['crm.mgrId']=C.me.id;up['crm.mgrName']=C.me.name||'';m.mgrId=C.me.id;m.mgrName=C.me.name||'';}
    await updateDoc(doc(C.db,'users',m.id),up);
    m.lastC=day;m.next=nx;m.nCnt++;
    if(d.notes)d.notes.unshift({id:ref.id,...rec,at:Timestamp.now()});C.notesAll=null;
    if(!silent)toast(`${m.name} · ${QF.res} 기록 저장${nx?' · 다음 연락 '+md(nx):''}`);
    QF={res:'통화 완료',how:QF.how,next:''};ta.value='';
    if(next){if(C.cur<C.view.length-1){_saving=false;openD(C.cur+1);return true;}toast('목록의 마지막 회원입니다');}
    renderD(true);return true;
  }catch(e){toast('저장 실패: '+e.message);return false;}
  finally{_saving=false;}
}

function renderTab(){
  const el=$c('crm-tb');if(!el||!C.det)return;const d=C.det;const m=C.MM[d.uid];
  if(C.dtab==='note')el.innerHTML=tNote(d);
  else if(C.dtab==='req')el.innerHTML=tReq(d,m);
  else if(C.dtab==='learn'){if(!d.lprog){el.innerHTML='<div class="crm-loading">학습 기록을 불러오는 중...</div>';loadLearn();return;}el.innerHTML=tLearn(d,m);}
  else{if(!d.logs){el.innerHTML='<div class="crm-loading">이용 기록을 불러오는 중...</div>';if(!d._lload){d._lload=true;loadLogs(d.logDays);}return;}
    el.innerHTML=C.dtab==='use'?tUse(d):C.dtab==='pat'?tPat(d,m):tMon(d,m);}
  bindTab(d,m);
}

/* 관리 기록 탭 */
function tNote(d){
  if(!d.notes)return '<div class="crm-loading">관리 기록을 불러오는 중...</div>';
  if(d.notesErr)return '<div class="crm-empty">관리 기록을 불러오지 못했습니다 — '+esc(d.notesErr)+'</div>';
  if(!d.notes.length)return '<div class="crm-empty">아직 소통 기록이 없습니다. 위에서 첫 기록을 남겨 주세요.</div>';
  const show=d.notes.slice(0,d.nLim);const g={};show.forEach(n=>(g[n.d]=g[n.d]||[]).push(n));
  return Object.keys(g).map(day=>`<div class="day">${dl(day)}${day===TODAY()?' · 오늘':''}<small>${g[day].length}건</small></div>`+g[day].map(n=>`<div class="note"><span class="t">${esc(n.t||'')}</span>
   <span><span class="how">${esc(n.how||'')}</span> <span class="res r-${(RESS.find(r=>r[0]===n.res)||['','ok'])[1]}">${esc(n.res||'')}</span></span>
   <div class="c">${esc(n.txt||'')}${n.next?`<div><span class="nx">⏰ 다음 연락 ${md(n.next)}</span></div>`:''}${n.reqNo?`<div class="lk">📌 관련 요청 ${esc(n.reqNo)}</div>`:''}<div class="by">작성 ${whoTxt(n.writerName,n.byName)}</div></div></div>`).join('')).join('')
   +(d.notes.length>d.nLim?`<div class="more"><button class="crm-btn sec sm" id="crm-more">이전 기록 더 보기</button></div>`:'');
}
/* 요청사항 탭 */
function tReq(d,m){
  if(!d.reqs)return '<div class="crm-loading">요청사항을 불러오는 중...</div>';const t=TODAY();
  return `<details class="crm-req" id="crm-rf" style="padding:9px 12px;background:#F7FBFD" ${d.reqs.length?'':'open'}><summary style="cursor:pointer;font-weight:700;color:#1B3A5C">➕ 새 요청 등록</summary>
   <div class="crm-rform"><label>접수일<input type="date" id="crm-r-d" value="${t}"></label><label>접수 경로<select id="crm-r-v">${HOWS.map(x=>`<option>${x}</option>`).join('')}</select></label>
   <label>유형<select id="crm-r-y">${RTYPES.map(x=>`<option>${x}</option>`).join('')}</select></label><label>처리 기한<input type="date" id="crm-r-due" value="${addD(t,3)}"></label>
   <label class="w2">제목<input id="crm-r-t" placeholder="한 줄 요약 (예: 휴대폰 공유 버튼 오류)"></label><label class="w2">처리 담당<select id="crm-r-m">${C.mgrs.map(x=>`<option value="${x.id}" ${x.id===(m.mgrId||C.me.id)?'selected':''}>${esc(x.name)} (${esc(x.loginId)})</option>`).join('')}</select></label>
   <label class="w4">내용<textarea id="crm-r-b" rows="2" placeholder="회원이 요청한 내용을 그대로 적어 주세요"></textarea></label></div>
   <div style="text-align:right;margin-top:8px"><button class="crm-btn" id="crm-r-save">요청 등록</button></div></details>`+
   (d.reqsErr?'<div class="crm-empty">요청사항을 불러오지 못했습니다 — '+esc(d.reqsErr)+'</div>':'')+
   (d.reqs.length?d.reqs.map(r=>{const over=r.st<2&&r.due&&r.due<t;return `<div class="crm-req" data-id="${r.id}"><div class="req-h"><span class="rno sub">${esc(r.no)}</span>
    <div class="ti">${esc(r.title)}<div class="rmt">${md(r.d)} 접수 · ${esc(r.via||'')} · ${esc(r.type||'')} · 기한 <span class="${over?'due':''}">${md(r.due)}${over?' 지남':''}</span> · 담당 ${esc(r.mgrName||'')}${r.writerName||r.byName?' · 등록 '+whoTxt(r.writerName,r.byName):''}</div></div><span class="st st-${r.st}">${ST[r.st]}</span></div>
    <div class="req-b"><div class="rbody">${esc(r.body||'')}</div>
     <div class="steps">${(r.steps||[]).map(s=>`<div class="step"><b>${esc(s.d||'')} ${esc(s.t||'')}</b> ${esc(s.txt||'')} <span class="sub">· ${whoTxt(s.writer,s.byName)}</span></div>`).join('')}</div>
     ${r.st===2?`<div class="rdone">✅ 처리 결과 · ${esc(r.result||'')} <span class="sub">(${md(r.doneD)} 완료)</span></div>`:''}
     <div class="radd"><input class="r-step" placeholder="${r.st===2?'다시 진행할 내용 (상태를 바꿔 저장)':'진행 내용 추가 (예: 개발 전달, 자료 발송)'}"><select class="r-st">${ST.map((s,k)=>`<option value="${k}" ${k===r.st?'selected':''}>${s}</option>`).join('')}</select><button class="crm-btn sm r-add">저장</button></div>
     ${r.st<2?'<div class="sub" style="margin-top:4px">「완료」로 바꾸면 입력한 내용이 처리 결과로 남고, 관리 기록에도 한 줄 자동으로 남습니다</div>':''}</div></div>`;}).join(''):'<div class="crm-empty">등록된 요청이 없습니다.</div>');
}
/* 학습 현황 탭 */
function lmsUnion(docs){const u={};const SLOT=10;
  docs.forEach(dd=>{Object.keys(dd.courses||{}).forEach(cid=>{const c=dd.courses[cid]||{};const x=u[cid]||(u[cid]={title:c.title||cid,type:c.type||'',totalSec:0,tracks:{},completed:false,lastAt:''});
    x.totalSec=Math.max(x.totalSec,c.totalSec||0);if(!x.type&&c.type)x.type=c.type;if(c.completed)x.completed=true;if(String(c.lastAt||'')>x.lastAt)x.lastAt=String(c.lastAt||'');
    Object.keys(c.tracks||{}).forEach(tid=>{const t=c.tracks[tid]||{};const y=x.tracks[tid]||(x.tracks[tid]={slots:new Set(),dur:0});String(t.slots||'').split(',').forEach(v=>{if(v!=='')y.slots.add(+v);});y.dur=Math.max(y.dur,t.dur||0);});});});
  Object.values(u).forEach(x=>{let p=0,sd=0,pv=0,dv=0,hv=false;Object.keys(x.tracks).forEach(tid=>{const y=x.tracks[tid];let n=y.slots.size*SLOT;if(y.dur>0)n=Math.min(n,y.dur);if(tid==='video'){hv=true;pv+=n;dv+=y.dur;return;}p+=n;sd+=y.dur;});
    const tot=x.totalSec||sd;x.playedSec=Math.min(p,tot||p);x.ratio=tot>0?Math.min(1,p/tot):0;x.media=hv&&p?'🎧+🎬':(hv?'🎬 영상':'🎧 음성');if(hv){x.playedSec+=Math.min(pv,dv||pv);x.ratio=Math.max(x.ratio,dv>0?Math.min(1,pv/dv):0);}delete x.tracks;});
  return Object.values(u);}
function tLearn(d,m){
  const v=C.lms[d.uid]||{};const months=v.months||{};
  const keys=Object.keys(months).sort().slice(-12);const mx=Math.max(1,...keys.map(k=>Number(months[k].playedSec)||0));
  const list=lmsUnion(d.lprog||[]).sort((a,b)=>String(b.lastAt).localeCompare(String(a.lastAt)));
  const ing=list.filter(x=>!x.completed&&x.ratio>=0.025).length;
  const tot=Number(v.playedSec)||0;
  if(!tot&&!list.length)return `<div class="crm-empty">학습 기록이 없습니다.</div><div class="crm-hint">다음 소통 때 「자주 쓰는 말 → 교육 권유」로 데일리리포트 음성 듣기나 줌 교육을 권해 보세요.</div>`;
  const ymLabel=k=>{const s=String(k).replace('-','');return s.slice(0,4)+'. '+Number(s.slice(4,6))+'월';};
  return `<div class="crm-cards c4"><div class="card"><div class="k">이번 달 학습</div><div class="v">${hm(m.lm)}</div></div>
   <div class="card"><div class="k">누적 학습</div><div class="v">${hm(tot)}</div></div><div class="card grn"><div class="k">이수 강좌</div><div class="v">${fmt(v.done||0)}개</div><div class="s">진도 80% 이상</div></div>
   <div class="card"><div class="k">수강 중</div><div class="v">${ing}개</div><div class="s">진도 2.5~80%</div></div></div>
   ${keys.length?`<div class="psec"><h5>월별 학습 시간</h5><div class="mbar">${keys.map(k=>{const s=Number(months[k].playedSec)||0;return `<div title="${ymLabel(k)} ${hm(s)}"><i style="height:${Math.max(2,Math.round(s/mx*100))}%"></i><small>${Number(String(k).replace('-','').slice(4,6))}월</small><em>${Math.round(s/60)}분</em></div>`;}).join('')}</div></div>`:''}
   <div class="psec"><h5>강좌별 학습 (최근 순)</h5>${list.length?`<div class="ltbl">${list.slice(0,60).map(x=>`<div><span class="lt">${esc(x.title)}</span><span class="sub">${esc(LMS_TYPE[x.type]||x.type||'')}</span><span>${x.media}</span><span>${hm(x.playedSec)}</span><span class="pct"><span class="pbar"><i style="width:${Math.round(x.ratio*100)}%"></i></span>${Math.round(x.ratio*100)}%</span><span class="st ${x.completed||x.ratio>=0.8?'st-2':'st-1'}">${x.completed||x.ratio>=0.8?'이수':'수강 중'}</span></div>`).join('')}</div>`:'<div class="sub">강좌별 진도 기록이 없습니다.</div>'}</div>
   <div class="crm-hint">실제 재생한 시간만 셉니다(같은 10분을 10번 들어도 10분) · 진도 80% 이상이면 이수 · 학습 통계 집계(LMS) 값을 그대로 보여 줍니다</div>`;
}
/* 이용 기록 탭 */
function useRows(d){
  const from=Date.now()-d.useDays*864e5;
  const rows=(d.logs||[]).filter(r=>r.t>=from).map(r=>({...r}));
  (d.notes||[]).forEach(n=>{const t=new Date((n.d||'')+'T'+(n.t||'00:00')).getTime();if(t>=from)rows.push({t,c:'관리 기록',x:(n.how||'')+' '+(n.res||'')+' · '+(n.txt||''),s:n.writerName||n.byName||'',mg:1});});
  (d.reqs||[]).forEach(r=>{const t=new Date((r.d||'')+'T09:00').getTime();if(t>=from)rows.push({t,c:'요청',x:(r.no||'')+' '+(r.title||''),s:ST[r.st]||'',mg:1});});
  rows.sort((a,b)=>a.t-b.t);let g=null;const keep=[];rows.forEach(r=>{if(r.main&&g&&r.t-g.last<=30*60e3){g.n++;g.last=r.t;g.x='메인 화면 진입 ('+g.n+'회)';return;}if(r.main){g=r;g.n=1;g.last=r.t;}keep.push(r);});
  return keep.sort((a,b)=>b.t-a.t);
}
const CAT={'접속':['#E2F1F7','#155E7A'],'기능':['#EEF0FF','#3B3FA8'],'콘텐츠':['#E8F5E9','#2E7D32'],'계산기':['#E0F2F1','#00695C'],'결제·포인트':['#FFF8E1','#8D6E00'],'관리 기록':['#FFF1C9','#7A5600'],'요청':['#FFE0B2','#8A4B00']};
function tUse(d){
  let rows=useRows(d);const cnt={};rows.forEach(r=>cnt[r.c]=(cnt[r.c]||0)+1);
  if(d.useCat)rows=rows.filter(r=>r.c===d.useCat);if(d.useQ)rows=rows.filter(r=>(r.x+' '+(r.s||'')).includes(d.useQ));
  const g={};rows.slice(0,800).forEach(r=>{const k=ymd(new Date(r.t));(g[k]=g[k]||[]).push(r);});
  return `<div class="crm-fbar"><div class="crm-seg">${[[1,'오늘'],[7,'7일'],[30,'30일'],[90,'90일'],[365,'1년']].map(x=>`<button data-ud="${x[0]}" class="${d.useDays===x[0]?'on':''}">${x[1]}</button>`).join('')}</div>
   <input type="search" id="crm-uq" placeholder="내용 검색" value="${esc(d.useQ)}"></div>
   <div class="crm-chips" style="margin-bottom:8px"><button class="crm-chip ${d.useCat?'':'on'}" data-uc="">전체 ${Object.values(cnt).reduce((a,b)=>a+b,0)}</button>${Object.keys(CAT).filter(k=>cnt[k]).map(k=>`<button class="crm-chip ${d.useCat===k?'on':''}" data-uc="${k}">${k} ${cnt[k]}</button>`).join('')}</div>`+
   (rows.length?Object.keys(g).map(k=>`<div class="day">${dl(k)}${k===TODAY()?' · 오늘':''}<small>${g[k].length}건</small></div>`+g[k].map(r=>{const c=CAT[r.c]||['#F1F3F5','#5c6b78'];return `<div class="urow ${r.mg?'mg':''}"><span class="sub">${pad(new Date(r.t).getHours())}:${pad(new Date(r.t).getMinutes())}</span><span><span class="cat" style="background:${c[0]};color:${c[1]}">${r.c}</span></span><span class="x2">${esc(r.x)}${r.s?' <span class="sub">'+esc(r.s)+'</span>':''}</span><span class="sub x2">${esc(r.dev||'')}</span></div>`;}).join('')).join('')
   :'<div class="crm-empty">이 기간에는 이용 기록이 없습니다.</div>')+
   `<div class="crm-hint">회원이 한 일과 담당자 관리 기록·요청이 한 줄로 이어집니다 · 30분 안 메인 진입은 한 줄로 묶음 · 이용 기록은 최근 1년 보관${d.logDays<365&&d.useDays>d.logDays?'':''}</div>`;
}
/* 이용 패턴 탭 */
function tPat(d,m){
  const days=d.patDays;const now=Date.now();const L=(d.logs||[]).filter(r=>r.t>=now-days*864e5);const P=(d.logs||[]).filter(r=>r.t<now-days*864e5&&r.t>=now-2*days*864e5);
  const seg=`<div class="crm-fbar"><div class="crm-seg">${[30,90].map(x=>`<button data-pd="${x}" class="${days===x?'on':''}">최근 ${x}일</button>`).join('')}</div>${days*2>d.logDays?`<span class="sub">전 기간 비교는 「이용 기록 → 1년」을 한 번 불러오면 정확해집니다</span>`:''}</div>`;
  if(!L.length)return seg+`<div class="crm-empty">최근 ${days}일 이용 기록이 없어 패턴을 만들 수 없습니다.</div><div class="crm-hint">마지막 접속 ${agoTxt(m.ago)} · 「월별 요약」에서 예전 흐름을 확인하세요.</div>`;
  const SL=['06~08','08~10','10~12','12~14','14~16','16~18','18~20','20~22','22~24'];const H=Array.from({length:7},()=>Array(9).fill(0));
  const dayset=new Set(),first={};let fn=0;
  L.forEach(r=>{const x=new Date(r.t);const wd=(x.getDay()+6)%7;const h=x.getHours();const si=h<6?-1:Math.min(8,Math.floor((h-6)/2));if(si>=0)H[wd][si]++;const k=ymd(x);dayset.add(k);const mins=h*60+x.getMinutes();if(first[k]==null||mins<first[k])first[k]=mins;if(r.c!=='접속')fn++;});
  const hmx=Math.max(1,...H.flat());const tot=H.flat().reduce((a,b)=>a+b,0);const wk=H.slice(0,5).flat().reduce((a,b)=>a+b,0);
  let top=[0,0],top2=[0,0];H.forEach((rw,i)=>rw.forEach((v,j)=>{}));const slotSum=SL.map((_,j)=>H.reduce((a,rw)=>a+rw[j],0));const order=slotSum.map((v,j)=>[v,j]).sort((a,b)=>b[0]-a[0]);
  const col=v=>v?`rgba(46,134,171,${(.12+.88*v/hmx).toFixed(2)})`:'#F1F4F7';
  const dsorted=[...dayset].sort();let best=0,run=0,prev=null;dsorted.forEach(k=>{run=(prev&&addD(prev,1)===k)?run+1:1;best=Math.max(best,run);prev=k;});
  const fv=Object.values(first);const avgFirst=fv.length?Math.round(fv.reduce((a,b)=>a+b,0)/fv.length):null;
  const dev={};L.forEach(r=>{if(r.dev)dev[r.dev]=(dev[r.dev]||0)+1;});const devTot=Object.values(dev).reduce((a,b)=>a+b,0);
  const fc={},pc={};L.forEach(r=>{if(r.c==='접속'||r.c==='결제·포인트')return;const k=r.c==='콘텐츠'?'콘텐츠 열람':r.c==='계산기'?(r.k==='quick_use'?'간편계산기 사용':'계산기(전문가용)'):(SVC[r.k]||r.k);fc[k]=(fc[k]||0)+1;});
  P.forEach(r=>{if(r.c==='접속'||r.c==='결제·포인트')return;const k=r.c==='콘텐츠'?'콘텐츠 열람':r.c==='계산기'?(r.k==='quick_use'?'간편계산기 사용':'계산기(전문가용)'):(SVC[r.k]||r.k);pc[k]=(pc[k]||0)+1;});
  const F=Object.entries(fc).sort((a,b)=>b[1]-a[1]);const fmx=F.length?F[0][1]:1;
  const keyCnt={};L.forEach(r=>{if(r.k)keyCnt[r.k]=(keyCnt[r.k]||0)+1;});
  const TP=TOUCH.map(t=>[t[1],keyCnt[t[0]]||0,t[0]==='customer_letter']);
  const unusedAll=['client_report','morning_consensus','sales_talk','mypb_check','morning_reading','worklog','easy_memo','stat_corner','quick_calc','bizinfo','monthly_report'].filter(k=>!keyCnt[k]).map(k=>SVC[k]);
  // 흐름: 같은 날 이어진 기능 3개
  const flows={};const byDay={};L.slice().sort((a,b)=>a.t-b.t).forEach(r=>{if(r.c==='접속'||r.c==='결제·포인트')return;const k=ymd(new Date(r.t));(byDay[k]=byDay[k]||[]).push(r);});
  Object.values(byDay).forEach(arr=>{for(let i=0;i+1<arr.length;i++){const a=arr[i],b=arr[i+1];if(b.t-a.t>40*60e3)continue;const na=a.c==='콘텐츠'?'콘텐츠 열람':(SVC[a.k]||a.c),nb=b.c==='콘텐츠'?'콘텐츠 열람':(SVC[b.k]||b.c);if(na===nb)continue;const key=na+' → '+nb;flows[key]=(flows[key]||0)+1;}});
  const FL=Object.entries(flows).sort((a,b)=>b[1]-a[1]).slice(0,4);
  // 비교
  const ag=C.agg;const rr=ag&&ag.byRole[m.role];
  const cmp=ag?[['30일 접속일',m.d30+'일',ag.avgD.toFixed(1)+'일',rr&&rr.n?(rr.d/rr.n).toFixed(1)+'일':'-',pctOf(ag.sortedD,m.d30)],['30일 기능 이용',fmt(m.f30)+'회',Math.round(ag.avgF)+'회',rr&&rr.n?Math.round(rr.f/rr.n)+'회':'-',pctOf(ag.sortedF,m.f30)]]:[];
  // 이용 유형 꼬리표
  const tags=[];const am=H.reduce((a,rw)=>a+rw[0]+rw[1],0),lu=H.reduce((a,rw)=>a+rw[3],0),ev=H.reduce((a,rw)=>a+rw[6]+rw[7]+rw[8],0);
  if(am>=tot*.35)tags.push('☀️ 아침형');if(ev>=tot*.35)tags.push('🌙 저녁형');if(lu>=tot*.25)tags.push('🍱 점심 활용');
  if((keyCnt.client_report||0)+(keyCnt.morning_consensus||0)>=8)tags.push('📤 고객 접점 활발');if(wk/Math.max(1,tot)>=.9)tags.push('📅 평일 집중');
  if(dayset.size>=days*0.6)tags.push('🔁 매일 이용');else if(dayset.size<=days*0.15)tags.push('💤 가끔 이용');
  if(m.lm>=3600)tags.push('📚 학습 활발');else if(!m.lm)tags.push('📚 학습 없음');
  // 관리 포인트
  const tips=[];const unT=TP.filter(t=>!t[1]&&!t[2]).map(t=>t[0]);
  if(unT.length)tips.push(['🎯',unT.join(' · ')+' 를 쓰지 않았습니다','고객 접점 기능이라 사용법을 안내하면 영업 활용으로 바로 이어질 수 있습니다']);
  const pD=new Set(P.map(r=>ymd(new Date(r.t)))).size;if(pD>=4&&dayset.size<=pD/2)tips.push(['📉','접속일이 직전 '+days+'일보다 크게 줄었습니다 ('+pD+'일 → '+dayset.size+'일)','불편한 점이나 바쁜 사정이 있는지 안부 연락을 권합니다']);
  if(!m.lm)tips.push(['📚','이번 달 학습 기록이 없습니다','데일리리포트 음성 듣기나 줌 교육을 권해 보세요']);
  {let low=null;for(let j=2;j<=5;j++){const v=H.slice(0,5).reduce((a,rw)=>a+rw[j],0);if(low==null||v<low[0])low=[v,j];}if(low)tips.push(['⏰','통화하기 좋은 시간: 평일 '+SL[low[1]]+'시','업무 시간 중 자비아 이용이 가장 적은 시간대입니다'+(order[0][0]?' (가장 많이 쓰는 시간 '+SL[order[0][1]]+'시)':'')]);}
  Object.entries(fc).forEach(([k,v])=>{const p=pc[k]||0;if(p>=5&&v<=p/2)tips.push(['🔻',k+' 이용이 직전 기간보다 줄었습니다 ('+p+'회 → '+v+'회)','새 자료 안내나 활용 사례 공유가 도움이 될 수 있습니다']);});
  const sec=t=>`<div class="psec"><h5>${t}</h5>`;const bar=(v,mx,c)=>`<span class="pbar"><i style="width:${Math.max(2,Math.round(v/Math.max(1,mx)*100))}%;${c?'background:'+c:''}"></i></span>`;
  const wkPct=Math.round(wk/Math.max(1,tot)*100);
  return seg+`<div class="ptype"><div><b>🧭 이용 유형</b> ${tags.map(t=>`<span class="tag">${t}</span>`).join('')||'<span class="sub">특징이 뚜렷하지 않습니다</span>'}</div>
   <p>최근 ${days}일 동안 <b>${dayset.size}일</b> 접속했고, 주로 <b>${wkPct>=70?'평일':'요일 구분 없이'} ${order[0][0]?SL[order[0][1]]+'시':''}</b>${order[1]&&order[1][0]?'와 <b>'+SL[order[1][1]]+'시</b>':''}에 이용합니다.</p></div>
   <div class="pgrid">
   ${sec('📅 요일·시간대별 이용 (건수)')}<div class="heat2"><div></div>${SL.map(x=>`<div class="h">${x}</div>`).join('')}${'월화수목금토일'.split('').map((w,i)=>`<div class="h">${w}</div>`+H[i].map(v=>`<div style="background:${col(v)};color:${v/hmx>.55?'#fff':'#34495E'}">${v||''}</div>`).join('')).join('')}</div>
    <div class="pnote">평일 ${wkPct}% · 주말 ${100-wkPct}%${order[0][0]?' · 가장 많은 시간대 <b>'+SL[order[0][1]]+'시</b>':''}</div></div>
   ${sec('🔁 접속 규칙성')}<div class="kv"><div><span>접속일</span><b>${dayset.size}일 / ${days}일</b></div><div><span>평균 접속 간격</span><b>${dayset.size?(days/dayset.size).toFixed(1)+'일':'-'}</b></div>
    <div><span>최장 연속 접속</span><b>${best}일</b></div><div><span>평균 첫 이용 시각</span><b>${avgFirst==null?'-':(avgFirst<720?'오전 ':'오후 ')+(Math.floor(avgFirst/60)%12||12)+':'+pad(avgFirst%60)}</b></div>
    <div><span>접속한 날 평균 기능 이용</span><b>${dayset.size?(fn/dayset.size).toFixed(1)+'회':'-'}</b></div><div><span>마지막 접속</span><b>${agoTxt(m.ago)}</b></div></div></div>
   ${sec('💻 이용 기기')}${devTot?`<div class="devbar2">${Object.entries(dev).map(([k,v],i)=>`<i style="width:${Math.round(v/devTot*100)}%;background:${['#2E86AB','#48A6CB','#A9D3E4'][i%3]}"></i>`).join('')}</div><div class="kv">${Object.entries(dev).map(([k,v])=>`<div><span>${k}</span><b>${Math.round(v/devTot*100)}%</b></div>`).join('')}</div>`:'<div class="sub">기기 정보가 아직 기록되지 않았습니다 (2차 「접속 기록 보강」 후 표시)</div>'}</div>
   ${sec('🧩 자주 이어지는 이용 흐름')}${FL.length?FL.map(f=>`<div class="flow">${f[0].split(' → ').map(x=>`<span>${esc(x)}</span>`).join('<i>→</i>')}<b>${f[1]}회</b></div>`).join(''):'<div class="sub">이어진 이용이 아직 적습니다</div>'}<div class="pnote">같은 날 40분 안에 이어서 쓴 기능을 묶어 셉니다</div></div>
   </div>
   ${sec('🎯 고객 접점 5가지 활용도')}<div class="tp5">${TP.map(t=>`<div class="${t[1]?'on':''}"><b>${t[1]?'✅':'⬜'}</b><span>${t[0]}</span><small>${t[2]?'기록 준비 중':(t[1]?t[1]+'회':'안 씀')}</small></div>`).join('')}</div><div class="pnote">5개 중 <b>${TP.filter(t=>t[1]).length}개</b> 활용 · 고객 레터는 이용 기록이 2차에 추가됩니다</div></div>
   ${sec('📊 기능별 이용 (많이 쓴 순)')}${F.length?`<div class="ftbl"><div class="fh"><span>기능</span><span></span><span>횟수</span><span>직전 ${days}일</span></div>${F.slice(0,15).map(([k,v])=>{const p=pc[k]||0;const ch=p?Math.round((v-p)/p*100):null;return `<div><span>${esc(k)}</span>${bar(v,fmx)}<b>${fmt(v)}회</b><span class="${ch==null?'sub':ch>0?'up':ch<0?'dn':'sub'}">${ch==null?(p?'-':'새로 이용'):(ch>0?'▲ '+ch+'%':ch<0?'▼ '+(-ch)+'%':'-')}</span></div>`;}).join('')}</div>`:'<div class="sub">기능 이용 기록이 없습니다</div>'}
    ${unusedAll.length?`<div class="pnote">이 기간에 안 쓴 주요 기능: ${unusedAll.join(' · ')}</div>`:''}</div>
   ${cmp.length?sec('⚖️ 전체 회원과 비교 (최근 30일)')+`<div class="cmp2"><div class="fh"><span>항목</span><span>이 회원</span><span>전체 평균</span><span>같은 회원유형 평균</span><span>위치</span></div>${cmp.map(c=>`<div><span>${c[0]}</span><b>${c[1]}</b><span>${c[2]}</span><span>${c[3]}</span><span class="pct"><span class="pbar"><i style="width:${c[4]}%;background:${c[4]>=60?'#27AE60':c[4]>=40?'#95A5A6':'#E74C3C'}"></i></span><small>${c[4]>=60?'상위 '+Math.max(1,100-c[4])+'%':c[4]>=40?'보통':'하위 '+c[4]+'%'}</small></span></div>`).join('')}</div><div class="pnote">가입 30일이 지난 회원 기준 평균</div></div>`:''}
   ${sec('💡 관리 포인트 (자동 제안)')}${tips.length?tips.slice(0,6).map(t=>`<div class="tip"><b>${t[0]}</b><div><strong>${esc(t[1])}</strong><p>${esc(t[2])}</p></div></div>`).join(''):'<div class="sub">특별한 관리 포인트가 없습니다</div>'}<div class="pnote">이용 기록을 보고 자동으로 만든 제안입니다 · 소통할 때 참고하세요</div></div>
   <div class="crm-hint">고객 반응 흐름(공유 → 고객 열람 → 상담요청)은 2차 「이용 기록 보강」 후 이 탭에 추가됩니다</div>`;
}
/* 월별 요약 탭 */
function tMon(d,m){
  const R={};const add=(k,f)=>{const o=R[k]||(R[k]={days:new Set(),fn:0,view:0,note:0,req:0,lm:0});f(o);};
  (d.logs||[]).forEach(r=>{const x=new Date(r.t);const k=x.getFullYear()+'-'+pad(x.getMonth()+1);add(k,o=>{o.days.add(ymd(x));if(r.c==='콘텐츠')o.view++;else if(r.c!=='접속'&&r.c!=='결제·포인트')o.fn++;});});
  (d.notes||[]).forEach(n=>{if(n.d)add(n.d.slice(0,7),o=>o.note++);});(d.reqs||[]).forEach(r=>{if(r.d)add(r.d.slice(0,7),o=>o.req++);});
  const mo=(C.lms[d.uid]||{}).months||{};Object.keys(mo).forEach(k=>{const kk=String(k).includes('-')?k:String(k).slice(0,4)+'-'+String(k).slice(4,6);add(kk,o=>o.lm+=Number(mo[k].playedSec)||0);});
  const keys=Object.keys(R).sort().reverse().slice(0,24);
  return `<div class="crm-tw2"><table class="mtbl"><thead><tr><th>월</th><th>접속일</th><th>기능 이용</th><th>콘텐츠 열람</th><th>학습 시간</th><th>소통 기록</th><th>요청</th></tr></thead><tbody>
   ${keys.map(k=>{const o=R[k];return `<tr><td>${k.slice(0,4)}년 ${Number(k.slice(5,7))}월</td><td>${o.days.size}일</td><td>${fmt(o.fn)}회</td><td>${fmt(o.view)}회</td><td>${hm(o.lm)}</td><td>${o.note}건</td><td>${o.req}건</td></tr>`;}).join('')||'<tr><td colspan="7" class="crm-empty">기록이 없습니다</td></tr>'}</tbody></table></div>
   <div class="crm-hint">지금 불러온 이용 기록 범위: 최근 ${d.logDays}일${d.logDays<365?' · <a href="#" id="crm-y1">1년 치 불러오기</a>':''} · 이용 기록은 1년 보관, 관리 기록·요청사항은 계속 보관 · 1년이 지난 달의 월별 요약 보관은 2차에서 추가됩니다</div>`;
}
function bindTab(d,m){
  const el=$c('crm-tb');if(!el)return;
  const mo=$c('crm-more');if(mo)mo.onclick=()=>{d.nLim+=30;d.notes=null;renderTab();loadNotes();};
  el.querySelectorAll('[data-ud]').forEach(b=>b.onclick=()=>{d.useDays=+b.dataset.ud;if(d.useDays>d.logDays){d._lload=true;loadLogs(365);}else renderTab();});
  el.querySelectorAll('[data-uc]').forEach(b=>b.onclick=()=>{d.useCat=b.dataset.uc;renderTab();});
  const uq=$c('crm-uq');if(uq)uq.onchange=()=>{d.useQ=uq.value.trim();renderTab();};
  el.querySelectorAll('[data-pd]').forEach(b=>b.onclick=()=>{d.patDays=+b.dataset.pd;if(d.patDays*2>d.logDays&&d.logDays<180){loadLogs(180);}else renderTab();});
  const y1=$c('crm-y1');if(y1)y1.onclick=e=>{e.preventDefault();loadLogs(365);};
  const rs=$c('crm-r-save');if(rs)rs.onclick=()=>saveReq(d,m);
  el.querySelectorAll('.req-h').forEach(h=>h.onclick=()=>h.parentNode.classList.toggle('open'));
  el.querySelectorAll('.r-add').forEach(b=>b.onclick=()=>stepReq(d,m,b.closest('.crm-req')));
}
async function saveReq(d,m){
  const title=$c('crm-r-t').value.trim();if(!title){toast('제목을 입력해 주세요');$c('crm-r-t').focus();return;}
  const writer=needWriter();if(!writer)return;
  const g=C.mgrs.find(x=>x.id===$c('crm-r-m').value)||{id:C.me.id,name:C.me.name};const day=$c('crm-r-d').value||TODAY();
  const no='R-'+day.slice(2).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  const rec={no,memberUid:m.id,memberName:m.name,memberLoginId:m.loginId,orgId:m.orgId||'',d:day,via:$c('crm-r-v').value,type:$c('crm-r-y').value,title,body:$c('crm-r-b').value.trim()||title,
    due:$c('crm-r-due').value||'',mgrId:g.id,mgrName:g.name,st:0,steps:[{d:TODAY(),t:nowHM(),txt:'요청 접수',byName:C.me.name||'',byUid:C.me.uid||'',writer}],result:'',doneD:'',
    byUid:C.me.uid||'',byId:C.me.id||'',byName:C.me.name||'',writerName:writer,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  try{const ref=await addDoc(collection(C.db,'member_reqs'),rec);await updateDoc(doc(C.db,'users',m.id),{'crm.openReq':increment(1),'crm.updatedAt':serverTimestamp()});
    m.openR++;d.reqs=[{id:ref.id,...rec,createdAt:Timestamp.now()},...(d.reqs||[])];C.reqsAll=null;toast(no+' 요청을 등록했습니다');renderD(true);
  }catch(e){toast('등록 실패: '+e.message);}
}
async function stepReq(d,m,box){
  const r=(d.reqs||[]).find(x=>x.id===box.dataset.id);if(!r)return;const txt=box.querySelector('.r-step').value.trim();const st=+box.querySelector('.r-st').value;
  if(!txt&&st===r.st){toast('진행 내용을 입력해 주세요');return;}
  const writer=needWriter();if(!writer)return;
  const step={d:TODAY(),t:nowHM(),txt:txt||('상태 변경: '+ST[st]),byName:C.me.name||'',byUid:C.me.uid||'',writer};const steps=[...(r.steps||[]),step];
  const up={steps,st,updatedAt:serverTimestamp()};if(st===2&&r.st<2){up.result=txt||'처리 완료';up.doneD=TODAY();}
  const delta=(r.st<2&&st===2)?-1:(r.st===2&&st<2?1:0);
  try{await updateDoc(doc(C.db,'member_reqs',r.id),up);
    if(delta){await updateDoc(doc(C.db,'users',m.id),{'crm.openReq':increment(delta),'crm.updatedAt':serverTimestamp()});m.openR=Math.max(0,m.openR+delta);}
    Object.assign(r,up,{updatedAt:Timestamp.now()});C.reqsAll=null;
    if(st===2&&delta){const rec={memberUid:m.id,memberName:m.name,memberLoginId:m.loginId,orgId:m.orgId||'',d:TODAY(),t:nowHM(),at:serverTimestamp(),how:'🗒 기타',res:'통화 완료',txt:'요청 '+r.no+' 처리 완료 — '+up.result,next:'',reqNo:r.no,byUid:C.me.uid||'',byId:C.me.id||'',byName:C.me.name||'',writerName:writer,createdAt:serverTimestamp()};
      try{await addDoc(collection(C.db,'member_notes'),rec);await updateDoc(doc(C.db,'users',m.id),{'crm.noteCnt':increment(1),'crm.lastContact':TODAY()});m.nCnt++;m.lastC=TODAY();if(d.notes)d.notes.unshift({...rec,at:Timestamp.now()});}catch(_e){}}
    toast(st===2&&delta?'요청을 완료 처리했습니다':'진행 기록을 저장했습니다');renderD(true);
    setTimeout(()=>{const o=document.querySelector(`.crm-req[data-id="${r.id}"]`);if(o)o.classList.add('open');},0);
  }catch(e){toast('저장 실패: '+e.message);}
}

/* ═════ 스타일 (#crm-app 안에서만) ═════ */
function injectCss(){
  if(document.getElementById('crm-css'))return;const s=document.createElement('style');s.id='crm-css';
  s.textContent=`
#crm-app{--cp:#1B3A5C;--cpl:#2E5A88;--ca:#2E86AB;--cb:#E1E8EE;--cbl:#F0F3F6;--ct:#2C3E50;--cl:#7F8C8D;color:var(--ct);font-size:13px;line-height:1.5}
#crm-app *,#crm-mdl *{box-sizing:border-box}
#crm-app .crm-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#crm-app .crm-h h2{margin:0;font-size:19px;color:var(--cp)}#crm-app .crm-me{margin-left:auto;font-size:12.5px;color:var(--cl)}
#crm-app .crm-lead{font-size:12.5px;color:var(--cl);margin:4px 0 12px;word-break:keep-all}
#crm-app .crm-loading,#crm-mdl .crm-loading{padding:28px;text-align:center;color:var(--cl)}
#crm-app .crm-today{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:12px}
#crm-app .crm-tcard{background:#fff;border:1px solid var(--cb);border-radius:10px;padding:9px 12px;cursor:pointer;text-align:left;font-family:inherit}
#crm-app .crm-tcard:hover{border-color:var(--ca)}#crm-app .crm-tcard.on{border-color:var(--ca);box-shadow:0 0 0 2px rgba(46,134,171,.3)}
#crm-app .crm-tcard .k{font-size:11.5px;color:var(--cl)}#crm-app .crm-tcard .v{font-size:21px;font-weight:800;line-height:1.25}
.v-red{color:#C0392B}.v-org{color:#C25E00}.v-pur{color:#6A1B9A}.v-gry{color:#5c6b78}
#crm-app .crm-ptabs{display:flex;gap:4px;border-bottom:2px solid var(--cb);margin-bottom:10px;overflow-x:auto}
#crm-app .crm-ptabs button{background:none;border:none;padding:9px 14px;font-size:14px;font-weight:700;color:var(--cl);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;white-space:nowrap;font-family:inherit}
#crm-app .crm-ptabs button.on{color:var(--cp);border-bottom-color:var(--ca)}#crm-app .crm-ptabs small{font-weight:500;font-size:11.5px}
#crm-app .crm-fbar,#crm-mdl .crm-fbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
#crm-app .crm-fbar input[type=search],#crm-mdl .crm-fbar input[type=search]{flex:1;min-width:160px;max-width:320px;border:1px solid var(--cb);border-radius:8px;padding:7px 11px;font-family:inherit}
#crm-app .crm-fbar select,#crm-app .crm-fbar input[type=date],.crm-sel{border:1px solid #E1E8EE;border-radius:8px;padding:6px 8px;background:#fff;max-width:100%;font-family:inherit;font-size:12.5px}
#crm-app .crm-fbar .sp{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.crm-chips{display:flex;flex-wrap:wrap;gap:5px}.crm-chip{border:1px solid #E1E8EE;background:#fff;border-radius:16px;padding:4px 11px;font-size:12px;cursor:pointer;font-family:inherit}.crm-chip.on{background:#1B3A5C;color:#fff;border-color:#1B3A5C}
.crm-btn{background:#1B3A5C;color:#fff;border:none;padding:7px 13px;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit}.crm-btn:hover{background:#2E5A88}.crm-btn:disabled{opacity:.45;cursor:default}
.crm-btn.sec{background:#fff;color:#2C3E50;border:1px solid #E1E8EE}.crm-btn.sec:hover{border-color:#1B3A5C;color:#1B3A5C}.crm-btn.sm{padding:4px 9px;font-size:11.5px}.crm-btn.grn{background:#1E7D45}.crm-btn.grn:hover{background:#176238}
#crm-app .crm-assign{background:#FFF8E6;border:1px solid #F5DFA8;border-radius:8px;padding:7px 12px;margin-bottom:10px;font-size:12.5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#crm-app .crm-assign select{border:1px solid var(--cb);border-radius:7px;padding:4px 8px}
#crm-app .crm-tw{background:#fff;border:1px solid var(--cb);border-radius:10px;overflow-x:auto}
#crm-app table.crm-list{width:100%;border-collapse:collapse;min-width:1180px}
#crm-app .crm-list th{background:var(--cp);color:#fff;font-weight:600;font-size:12px;padding:9px 8px;text-align:left;white-space:nowrap;user-select:none}
#crm-app .crm-list th.s{cursor:pointer}#crm-app .crm-list th.s:hover{background:var(--cpl)}#crm-app .crm-list th .ar{opacity:.45;margin-left:3px;font-size:10px}#crm-app .crm-list th.on .ar{opacity:1;color:#FFD54F}
#crm-app .crm-list th.r,#crm-app .crm-list td.r{text-align:right}
#crm-app .crm-list td{padding:8px;border-bottom:1px solid var(--cbl);white-space:nowrap;vertical-align:middle}
#crm-app .crm-list tbody tr{cursor:pointer}#crm-app .crm-list tbody tr:hover td{background:#EEF6FB}
#crm-app .nm{font-weight:700;color:var(--cp)}.sub{font-size:11px;color:#7F8C8D}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:1px}.d-on{background:#27AE60}.d-mid{background:#F39C12}.d-off{background:#C0C8D0}
.bdg{display:inline-block;border-radius:5px;font-size:10.5px;font-weight:700;padding:0 6px;margin-right:3px;white-space:nowrap}.bdg.warn{background:#FDECEA;color:#C0392B}.bdg.req{background:#FFF1C9;color:#7A5600}.bdg.new{background:#EEF0FF;color:#3B3FA8}
.due{color:#C0392B;font-weight:700}.trunc{max-width:340px;overflow:hidden;text-overflow:ellipsis}
.how{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;background:#E2F1F7;color:#155E7A;white-space:nowrap}
.res{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;white-space:nowrap}.r-ok{background:#E8F5E9;color:#2E7D32}.r-miss{background:#F1F3F5;color:#5c6b78}.r-re{background:#FFF1C9;color:#7A5600}.r-msg{background:#EEF0FF;color:#3B3FA8}
.st{display:inline-block;border-radius:12px;padding:1px 9px;font-size:11px;font-weight:700;white-space:nowrap}.st-0{background:#FDECEA;color:#C0392B}.st-1{background:#FFF1C9;color:#7A5600}.st-2{background:#E8F5E9;color:#2E7D32}
.crm-pager{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#7F8C8D}.crm-pager .pg{display:flex;gap:4px;flex-wrap:wrap}
.crm-pager button{border:1px solid #E1E8EE;background:#fff;border-radius:6px;min-width:30px;padding:4px 8px;cursor:pointer;font-size:12px}.crm-pager button.on{background:#1B3A5C;color:#fff;border-color:#1B3A5C}.crm-pager button:disabled{opacity:.4;cursor:default}
.crm-empty{padding:26px;text-align:center;color:#7F8C8D}
.crm-hint{font-size:11.5px;color:#7F8C8D;background:#F7F9FC;border:1px dashed #E1E8EE;border-radius:8px;padding:8px 12px;margin-top:10px;word-break:keep-all}
.crm-sortm{display:none;gap:6px;align-items:center;margin-bottom:8px;font-size:12px}.crm-sortm select{border:1px solid #E1E8EE;border-radius:7px;padding:5px 8px;background:#fff}
/* 상세 창 */
#crm-mdl{position:fixed;inset:0;z-index:9000;display:none}#crm-mdl.on{display:block}
#crm-mdl .crm-mbg{position:absolute;inset:0;background:rgba(15,36,64,.5)}
#crm-mdl .crm-mbox{position:absolute;top:16px;left:50%;transform:translateX(-50%);width:min(1180px,calc(100% - 24px));max-height:calc(100% - 32px);background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;color:#2C3E50;font-size:13px;line-height:1.5}
#crm-mdl .crm-mh{flex:none;padding:12px 18px;border-bottom:1px solid #F0F3F6;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
#crm-mdl .av{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#2E86AB,#1B3A5C);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:16px;flex:none}
#crm-mdl .who{min-width:0}#crm-mdl .who h3{margin:0;font-size:17px;color:#1B3A5C;line-height:1.3}#crm-mdl .who .meta{font-size:12px;color:#7F8C8D;word-break:keep-all}#crm-mdl .tel{color:#1E7D45;font-weight:700;text-decoration:none}
#crm-mdl .nav{display:flex;align-items:center;gap:6px;margin-left:auto;flex-wrap:wrap}#crm-mdl .pos{font-size:12px;color:#7F8C8D}
#crm-mdl .x{background:none;border:none;font-size:26px;color:#8a97a3;cursor:pointer;line-height:1;padding:0 4px}
#crm-mdl .crm-mscroll{overflow-y:auto;overflow-x:hidden;flex:1}
#crm-mdl .crm-alert{background:#FFF4F2;border:1px solid #F5C6C1;color:#A93226;border-radius:8px;padding:6px 12px;font-size:12.5px;margin:10px 18px 0;word-break:keep-all}
#crm-mdl .crm-cards{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:10px 18px 0}#crm-mdl .crm-cards.c4{grid-template-columns:repeat(4,1fr);padding:0;margin-bottom:12px}
#crm-mdl .card{border:1px solid #E1E8EE;border-radius:9px;padding:8px 10px;background:#FBFCFE;min-width:0}#crm-mdl .card .k{font-size:11px;color:#7F8C8D}#crm-mdl .card .v{font-size:16px;font-weight:800;color:#1B3A5C;line-height:1.3;word-break:keep-all}#crm-mdl .card .s{font-size:10.5px;color:#9AA6B1}
#crm-mdl .card.warn{background:#FFF8F0;border-color:#F8D9B6}#crm-mdl .card.warn .v{color:#C25E00}#crm-mdl .card.grn{background:#F3FAF6;border-color:#CDE9D7}#crm-mdl .card.grn .v{color:#1E7D45}
#crm-mdl .crm-quick{margin:12px 18px 0;border:2px solid #BFDCEA;background:#F5FAFD;border-radius:12px;padding:12px 14px}
#crm-mdl .crm-quick h4{margin:0 0 8px;font-size:13.5px;color:#1B3A5C;display:flex;gap:8px;align-items:center;flex-wrap:wrap}#crm-mdl .crm-quick h4 small{font-weight:500;color:#7F8C8D;font-size:11.5px}
#crm-mdl .qrow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}#crm-mdl .qrow .lb{font-size:11.5px;color:#5c6b78;width:70px;flex:none}
#crm-mdl .qb{border:1px solid #E1E8EE;background:#fff;border-radius:7px;padding:5px 11px;font-size:12.5px;cursor:pointer;white-space:nowrap;font-family:inherit}#crm-mdl .qb.on{background:#1B3A5C;color:#fff;border-color:#1B3A5C}#crm-mdl .qb.ph{font-size:12px;background:#F4F7FA;border-radius:14px}
#crm-mdl .qrow textarea{flex:1;min-width:200px;border:1px solid #E1E8EE;border-radius:8px;padding:7px 10px;min-height:56px;resize:vertical;background:#fff;font-family:inherit;font-size:13px}
#crm-mdl .qsave{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;align-items:center}#crm-mdl .qsave small{margin-right:auto;color:#7F8C8D;font-size:11.5px}
#crm-mdl .crm-tabs{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid #E1E8EE;overflow-x:auto;margin-top:12px}
#crm-mdl .crm-tabs button{background:none;border:none;padding:9px 12px;font-size:13px;font-weight:600;color:#7F8C8D;cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap;font-family:inherit}#crm-mdl .crm-tabs button.on{color:#1B3A5C;border-bottom-color:#2E86AB}
#crm-mdl .crm-tabs .n{background:#E74C3C;color:#fff;border-radius:9px;font-size:10px;padding:0 5px;margin-left:3px}
#crm-mdl .crm-tbody{padding:12px 18px 20px}
#crm-mdl .day{padding:9px 2px 3px;font-weight:700;color:#1B3A5C;font-size:12.5px;display:flex;justify-content:space-between;gap:8px;border-bottom:2px solid #E8EEF3}#crm-mdl .day small{font-weight:500;color:#7F8C8D;font-size:11px}
#crm-mdl .note{display:grid;grid-template-columns:48px 170px 1fr;gap:10px;padding:8px 4px;border-bottom:1px solid #F0F3F6;align-items:start}#crm-mdl .note .t{color:#5c6b78}#crm-mdl .note .c{min-width:0;word-break:keep-all;white-space:pre-wrap}
#crm-mdl .note .by{font-size:11px;color:#9AA6B1;margin-top:2px}#crm-mdl .nx{display:inline-block;font-size:11px;color:#C25E00;background:#FFF4E5;border-radius:5px;padding:0 6px;margin-top:3px}#crm-mdl .lk{font-size:11px;color:#2E86AB}
#crm-mdl .more{text-align:center;margin-top:10px}
#crm-mdl .crm-req{border:1px solid #E1E8EE;border-radius:9px;margin-bottom:8px;overflow:hidden}#crm-mdl .req-h{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px 12px;cursor:pointer}
#crm-mdl .req-h:hover{background:#FAFCFE}#crm-mdl .req-h .ti{font-weight:700;word-break:keep-all;min-width:0}#crm-mdl .req-h .rmt{font-size:11px;color:#7F8C8D;font-weight:400}
#crm-mdl .req-b{display:none;border-top:1px solid #F0F3F6;padding:10px 12px;background:#FBFCFE}#crm-mdl .crm-req.open .req-b{display:block}
#crm-mdl .rbody{background:#fff;border:1px solid #F0F3F6;border-radius:7px;padding:7px 10px;margin-bottom:6px;word-break:keep-all;white-space:pre-wrap}#crm-mdl .rdone{background:#F3FAF6;border:1px solid #CDE9D7;border-radius:7px;padding:7px 10px;margin-bottom:6px}
#crm-mdl .steps{border-left:2px solid #D6E4EC;margin:4px 0 8px 6px;padding-left:12px}#crm-mdl .step{position:relative;padding:3px 0;font-size:12.5px;word-break:keep-all}#crm-mdl .step::before{content:'';position:absolute;left:-17px;top:9px;width:8px;height:8px;border-radius:50%;background:#2E86AB}
#crm-mdl .radd{display:flex;gap:6px;flex-wrap:wrap}#crm-mdl .radd input{flex:1;min-width:150px;border:1px solid #E1E8EE;border-radius:7px;padding:6px 9px;font-family:inherit}#crm-mdl .radd select{border:1px solid #E1E8EE;border-radius:7px;padding:6px 8px}
#crm-mdl .crm-rform{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}#crm-mdl .crm-rform label{font-size:11.5px;color:#5c6b78;display:flex;flex-direction:column;gap:3px;min-width:0}
#crm-mdl .crm-rform input,#crm-mdl .crm-rform select,#crm-mdl .crm-rform textarea{border:1px solid #E1E8EE;border-radius:7px;padding:6px 9px;background:#fff;width:100%;min-width:0;font-family:inherit;font-size:12.5px}
#crm-mdl .crm-rform .w2{grid-column:span 2}#crm-mdl .crm-rform .w4{grid-column:1/-1}
#crm-mdl .urow{display:grid;grid-template-columns:48px 86px 1fr auto;gap:10px;padding:7px 4px;border-bottom:1px solid #F0F3F6;align-items:center;font-size:12.5px}#crm-mdl .urow.mg{background:#FFFBEA}#crm-mdl .urow .x2{min-width:0;word-break:keep-all}
#crm-mdl .cat{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700}
.crm-seg{display:inline-flex;border:1px solid #E1E8EE;border-radius:8px;overflow:hidden}.crm-seg button{background:#fff;border:none;padding:5px 11px;font-size:12px;cursor:pointer;border-right:1px solid #E1E8EE;font-family:inherit}.crm-seg button:last-child{border-right:none}.crm-seg button.on{background:#1B3A5C;color:#fff}
#crm-mdl .crm-tw2{overflow-x:auto}#crm-mdl .mtbl{width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px}#crm-mdl .mtbl th{background:#F1F5F9;color:#1B3A5C;padding:7px 8px;text-align:right;white-space:nowrap}
#crm-mdl .mtbl th:first-child,#crm-mdl .mtbl td:first-child{text-align:left}#crm-mdl .mtbl td{padding:7px 8px;border-bottom:1px solid #F0F3F6;text-align:right;white-space:nowrap}
#crm-mdl .ptype{background:linear-gradient(135deg,#F0F7FB,#F7FBF9);border:1px solid #D6E8F0;border-radius:10px;padding:10px 14px;margin-bottom:12px;word-break:keep-all}
#crm-mdl .ptype .tag{display:inline-block;background:#fff;border:1px solid #CFE2EC;border-radius:14px;padding:1px 9px;font-size:11.5px;margin:2px 3px;color:#155E7A;font-weight:600}#crm-mdl .ptype p{font-size:12.5px;margin:6px 0 0;color:#34495E}
#crm-mdl .pgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}#crm-mdl .psec{border:1px solid #E1E8EE;border-radius:10px;padding:10px 12px;margin-bottom:12px;min-width:0;background:#fff}#crm-mdl .pgrid .psec{margin-bottom:0}
#crm-mdl .psec h5{margin:0 0 8px;font-size:13px;color:#1B3A5C}#crm-mdl .pnote{font-size:11.5px;color:#7F8C8D;margin-top:7px;word-break:keep-all}
#crm-mdl .heat2{display:grid;grid-template-columns:22px repeat(9,1fr);gap:2px;font-size:10.5px}#crm-mdl .heat2 div{border-radius:3px;text-align:center;padding:4px 0;min-width:0}#crm-mdl .heat2 .h{color:#7F8C8D;padding:2px 0;font-size:9.5px;letter-spacing:-.3px}
#crm-mdl .kv{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px}#crm-mdl .kv div{display:flex;flex-direction:column;font-size:12.5px;min-width:0;word-break:keep-all}#crm-mdl .kv span{font-size:11px;color:#7F8C8D}
#crm-mdl .devbar2{display:flex;height:14px;border-radius:7px;overflow:hidden;margin-bottom:8px}#crm-mdl .devbar2 i{display:block;height:100%}
#crm-mdl .flow{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:5px 0;border-bottom:1px solid #F0F3F6;font-size:12.5px}#crm-mdl .flow span{background:#EEF6FB;border-radius:6px;padding:1px 8px}#crm-mdl .flow i{color:#9AA6B1;font-style:normal}#crm-mdl .flow b{margin-left:auto;color:#1B3A5C}
#crm-mdl .tp5{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}#crm-mdl .tp5 div{border:1px solid #E1E8EE;border-radius:8px;padding:7px;text-align:center;font-size:12px;display:flex;flex-direction:column;gap:1px;background:#FAFBFC;word-break:keep-all}#crm-mdl .tp5 div.on{background:#F3FAF6;border-color:#CDE9D7}#crm-mdl .tp5 small{color:#7F8C8D;font-size:11px}
#crm-mdl .pbar{display:block;height:9px;background:#E8EEF3;border-radius:5px;overflow:hidden;min-width:40px}#crm-mdl .pbar i{display:block;height:100%;background:linear-gradient(90deg,#48A6CB,#2E86AB);border-radius:5px}
#crm-mdl .ftbl>div{display:grid;grid-template-columns:150px 1fr 60px 80px;gap:8px;align-items:center;padding:4px 0;font-size:12.5px;border-bottom:1px solid #F0F3F6}#crm-mdl .ftbl b{text-align:right}#crm-mdl .fh{font-size:11px!important;color:#7F8C8D;border-bottom:2px solid #E8EEF3!important}
#crm-mdl .up{color:#2E7D32;font-weight:700;font-size:11.5px}#crm-mdl .dn{color:#C0392B;font-weight:700;font-size:11.5px}
#crm-mdl .cmp2>div{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1.6fr;gap:8px;align-items:center;padding:5px 0;font-size:12.5px;border-bottom:1px solid #F0F3F6}
#crm-mdl .pct{display:flex;align-items:center;gap:6px}#crm-mdl .pct .pbar{flex:1}#crm-mdl .pct small{font-size:11px;white-space:nowrap;width:58px}
#crm-mdl .tip{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #F0F3F6;word-break:keep-all}#crm-mdl .tip>b{font-size:18px}#crm-mdl .tip strong{font-size:12.5px}#crm-mdl .tip p{margin:0;font-size:12px;color:#5c6b78}
#crm-mdl .mbar{display:flex;align-items:flex-end;gap:6px;height:120px}#crm-mdl .mbar div{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:1px;min-width:0}
#crm-mdl .mbar i{display:block;width:100%;background:linear-gradient(180deg,#48A6CB,#2E86AB);border-radius:4px 4px 0 0}#crm-mdl .mbar small{font-size:10px;color:#7F8C8D}#crm-mdl .mbar em{font-style:normal;font-size:9.5px;color:#5c6b78}
#crm-mdl .ltbl>div{display:grid;grid-template-columns:1fr 100px 64px 72px 130px 60px;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #F0F3F6;font-size:12.5px}#crm-mdl .ltbl .lt{min-width:0;word-break:keep-all}
.crm-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1B3A5C;color:#fff;padding:9px 18px;border-radius:20px;font-size:12.5px;display:none;z-index:9500}
@media(max-width:1100px){#crm-app .crm-today{grid-template-columns:repeat(3,1fr)}#crm-mdl .crm-cards{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){
 #crm-app .crm-today{grid-template-columns:repeat(2,1fr)}
 #crm-app .crm-tw{background:none;border:none;overflow:visible}#crm-app table.crm-list{min-width:0}#crm-app .crm-list thead{display:none}
 #crm-app .crm-list tbody tr{display:block;background:#fff;border:1px solid var(--cb);border-radius:10px;margin-bottom:8px;padding:8px 12px}
 #crm-app .crm-list td{display:flex;justify-content:space-between;gap:10px;border:none;padding:3px 0;white-space:normal;text-align:right}
 #crm-app .crm-list td::before{content:attr(data-l);color:var(--cl);font-size:11.5px;text-align:left;flex:none}#crm-app .crm-list td.no{display:none}#crm-app .crm-list td.crm-empty{display:block;text-align:center}#crm-app .crm-list td.crm-empty::before{content:none}
 #crm-app .trunc{max-width:none;white-space:normal}.crm-sortm{display:flex}
 #crm-mdl .crm-mbox{top:0;width:100%;max-height:100%;height:100%;border-radius:0}#crm-mdl .crm-mh{padding:10px 12px}#crm-mdl .nav{margin-left:0;width:100%;justify-content:space-between}
 #crm-mdl .crm-cards{grid-template-columns:repeat(2,1fr);padding:10px 12px 0}#crm-mdl .crm-cards.c4{grid-template-columns:repeat(2,1fr);padding:0}
 #crm-mdl .crm-quick{margin:10px 12px 0;padding:10px}#crm-mdl .qrow .lb{width:100%}#crm-mdl .crm-tbody{padding:12px}#crm-mdl .crm-tabs{padding:0 6px}#crm-mdl .crm-alert{margin:10px 12px 0}
 #crm-mdl .note{grid-template-columns:44px 1fr}#crm-mdl .note .c{grid-column:1/-1}#crm-mdl .urow{grid-template-columns:44px 1fr}#crm-mdl .urow .x2{grid-column:1/-1}
 #crm-mdl .crm-rform{grid-template-columns:1fr}#crm-mdl .crm-rform .w2{grid-column:auto}#crm-mdl .req-h{grid-template-columns:1fr auto}#crm-mdl .req-h .rno{display:none}
 #crm-mdl .pgrid{grid-template-columns:1fr}#crm-mdl .tp5{grid-template-columns:repeat(2,1fr)}#crm-mdl .kv{grid-template-columns:1fr}
 #crm-mdl .ftbl>div{grid-template-columns:1fr 56px 74px}#crm-mdl .ftbl>div .pbar{display:none}
 #crm-mdl .cmp2 .fh{display:none!important}#crm-mdl .cmp2>div{grid-template-columns:1fr 1fr;gap:2px 8px}#crm-mdl .cmp2 .pct{grid-column:1/-1}
 #crm-mdl .heat2{grid-template-columns:18px repeat(9,1fr)}#crm-mdl .heat2 .h{font-size:8px}
 #crm-mdl .ltbl>div{grid-template-columns:1fr auto;gap:2px 8px}#crm-mdl .ltbl .lt{grid-column:1/-1;font-weight:600}#crm-mdl .ltbl .pct{grid-column:1/-1}
}`;
  document.head.appendChild(s);
}
