/* ═══════════════════════════════════════════════════════════════════
   jv-memo.js — 이지메모 플로팅 버튼(A안 · 네이비+골드 링) + 「담기」 공통 모듈
   ★ [2026-10-17] 신규
   · 화면마다 같은 디자인·같은 동작 — 각 화면은 JvMemo.init(...) 한 번만 부른다 (lms-core.js 와 같은 방식)
   · 담기 = users/{uid}/memo_inbox/{자동ID} 에 한 건씩 저장 (본인만 쓰기·읽기·삭제 — firestore.rules)
     → memo.html 을 열 때 맨 위 「📥 받은 메모」 묶음으로 옮기고 받은 메모함에서 지운다.
     메모 본문 문서(users/{uid}/private/memo)는 이 모듈이 절대 건드리지 않는다 (다른 탭과 덮어쓰기 방지).
   · 노출 대상: 정규회원(EM_ROLES — memo.html 과 같은 목록) · 관리자 계정. 기간제(free_user)·일반회원은 표시 안 함
   · 사용:
       JvMemo.init({db,uid,email,role?,fs:{doc,getDoc,collection,setDoc,serverTimestamp},
                    from:'모닝 컨센서스', pill:'이 섹션 담기', getItem:()=>({text,link})|null,
                    z:96, bottom:'calc(...)', right:'16px', css:'화면별 추가 규칙', anchor:요소(선택)})
       JvMemo.add({text,from,link})  · JvMemo.todo({name,ctx,from})  · JvMemo.open()
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  if(window.JvMemo)return;
  var EM_ROLES=['admin','branch_manager','inner_circle','con_homepage','jarvia_member','jarvia_inner'];
  var LINK_RE=/^https:\/\/jarvia\.co\.kr\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*$/;
  var cfg=null,ok=false,wrap=null,lastAdd={t:'',at:0},closeT=null,styled=false;
  var PEN='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 8.5l3 3"/></svg>';

  function css(){
    if(styled)return;styled=true;
    var s=document.createElement('style');s.id='jvmStyle';
    s.textContent=''
      +'#jvmWrap{position:fixed;right:var(--jvm-r,16px);bottom:var(--jvm-b,calc(20px + env(safe-area-inset-bottom,0px)));z-index:var(--jvm-z,9500);display:none;align-items:center;gap:10px;font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;-webkit-tap-highlight-color:transparent}'
      +'#jvmWrap.on{display:flex}'
      +'#jvmWrap.jvm-in{position:absolute;right:12px;bottom:10px}'
      +'#jvmFab{width:62px;height:62px;border-radius:50%;border:2px solid #C9A96E;background:#14304F;box-shadow:0 10px 26px rgba(20,48,79,.35),inset 0 0 0 3px #14304F,inset 0 0 0 4px rgba(201,169,110,.35);display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;padding:0;margin:0;cursor:pointer;flex-shrink:0;transition:transform .18s ease;font-family:inherit}'
      +'#jvmFab:hover{transform:scale(1.06)}#jvmFab:active{transform:scale(.96)}'
      +'#jvmFab svg{width:21px;height:21px;stroke:#fff;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}'
      +'#jvmFab b{font-size:12px;font-weight:800;color:#E2C994;line-height:1;letter-spacing:-.2px}'
      +'#jvmMenu{display:none;flex-direction:column;align-items:flex-end;gap:8px}'
      +'#jvmWrap.open #jvmMenu{display:flex}'
      +'.jvm-pill{height:44px;padding:0 16px;border-radius:22px;border:none;background:#fff;color:#14304F;font-size:14.5px;font-weight:800;box-shadow:0 8px 22px rgba(20,48,79,.22);white-space:nowrap;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;max-width:62vw;overflow:hidden;text-overflow:ellipsis}'
      +'.jvm-pill.sub{height:38px;font-size:13px;font-weight:700;color:#3E4F66;background:#F4F6FA;box-shadow:0 6px 16px rgba(20,48,79,.16)}'
      +'.jvm-pill:active{transform:scale(.97)}'
      +'#jvmToast{position:fixed;left:50%;bottom:calc(110px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:100000;background:#14304F;color:#fff;border:1px solid #C9A96E;border-radius:22px;padding:11px 16px;font-size:14px;font-weight:600;display:none;align-items:center;gap:10px;width:max-content;max-width:calc(100vw - 32px);box-shadow:0 10px 26px rgba(20,48,79,.35);font-family:"Pretendard","Noto Sans KR",sans-serif;box-sizing:border-box}'
      +'#jvmToast.on{display:flex}#jvmToast span{min-width:0}#jvmToast a{color:#E2C994;font-weight:800;white-space:nowrap;cursor:pointer;text-decoration:none}'
      +'#jvmTd{position:fixed;inset:0;z-index:100001;background:rgba(15,23,40,.5);display:none;align-items:flex-end;justify-content:center;font-family:"Pretendard","Noto Sans KR",sans-serif}'
      +'#jvmTd.on{display:flex}'
      +'#jvmTd .bx{width:100%;max-width:440px;background:#fff;border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box}'
      +'#jvmTd h3{margin:0 0 4px;font-size:17px;color:#14304F;font-weight:800}#jvmTd .cx{font-size:13px;color:#5B6B82;margin:0 0 10px}'
      +'#jvmTd textarea{width:100%;box-sizing:border-box;min-height:84px;border:1px solid #D6DEEA;border-radius:12px;padding:11px 12px;font-size:16px;font-family:inherit;resize:vertical;outline:none}'
      +'#jvmTd textarea:focus{border-color:#14304F}'
      +'#jvmTd .bt{display:flex;gap:8px;margin-top:12px}#jvmTd .bt button{flex:1;height:48px;border-radius:12px;font-size:15px;font-weight:800;font-family:inherit;cursor:pointer}'
      +'#jvmTd .bt .c{border:1px solid #D6DEEA;background:#fff;color:#3E4F66}#jvmTd .bt .g{border:none;background:#14304F;color:#fff}'
      +'#jvmTd .nt{font-size:12px;color:#8A93A8;margin-top:8px;line-height:1.5}'
      +'@media(max-width:640px){#jvmFab{width:56px;height:56px}#jvmFab svg{width:19px;height:19px}#jvmFab b{font-size:11.5px}#jvmTd .bx{max-width:100%}}'
      +'@media(min-width:641px){#jvmTd{align-items:center}#jvmTd .bx{border-radius:18px}}';
    document.head.appendChild(s);
  }
  function el(id){return document.getElementById(id);}
  function toast(msg,withOpen){
    var t=el('jvmToast');
    if(!t){t=document.createElement('div');t.id='jvmToast';t.setAttribute('role','status');document.body.appendChild(t);}
    t.innerHTML='';var sp=document.createElement('span');sp.textContent=msg;t.appendChild(sp);
    if(withOpen){var a=document.createElement('a');a.textContent='받은 메모 열기 ›';a.onclick=function(){t.classList.remove('on');api.open();};t.appendChild(a);}
    t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('on');},3000);
  }
  function collapse(){if(wrap)wrap.classList.remove('open');clearTimeout(closeT);}
  function build(){
    css();
    wrap=el('jvmWrap');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='jvmWrap';
      wrap.innerHTML='<div id="jvmMenu"><button type="button" class="jvm-pill" id="jvmAdd"></button><button type="button" class="jvm-pill sub" id="jvmOpen">이지메모 열기 ↗</button></div>'
        +'<button type="button" id="jvmFab" aria-label="이지메모">'+PEN+'<b>메모</b></button>';
    }
    if(cfg.anchor){wrap.classList.add('jvm-in');cfg.anchor.appendChild(wrap);}
    else{wrap.classList.remove('jvm-in');document.body.appendChild(wrap);}
    wrap.querySelector('#jvmFab').onclick=function(e){
      e.stopPropagation();
      if(wrap.classList.contains('open')){collapse();return;}
      var it=null;try{it=cfg.getItem?cfg.getItem():null;}catch(_e){it=null;}
      if(!it||!it.text){api.open();return;}
      wrap.querySelector('#jvmAdd').textContent='📥 '+(it.pill||cfg.pill||'이 화면 담기');
      wrap.classList.add('open');clearTimeout(closeT);closeT=setTimeout(collapse,6000);
    };
    wrap.querySelector('#jvmAdd').onclick=function(e){
      e.stopPropagation();collapse();
      var it=null;try{it=cfg.getItem?cfg.getItem():null;}catch(_e){it=null;}
      if(!it||!it.text){toast('담을 내용이 없어요');return;}
      if(cfg.confirm){   /* 화면별 1회 안내 (예: AI 비서 — 담으면 이지메모에 저장됨) */
        var seen=false;try{seen=localStorage.getItem(cfg.confirmKey||'jvm_ok')==='1';}catch(_e){}
        if(!seen){if(!window.confirm(cfg.confirm))return;try{localStorage.setItem(cfg.confirmKey||'jvm_ok','1');}catch(_e){}}
      }
      api.add({text:it.text,link:it.link||'',from:it.from||cfg.from||''});
    };
    wrap.querySelector('#jvmOpen').onclick=function(e){e.stopPropagation();collapse();api.open();};
    if(!window.__jvmDoc){window.__jvmDoc=true;document.addEventListener('click',function(e){if(wrap&&!wrap.contains(e.target))collapse();});}
  }
  function vars(){
    var r=document.documentElement.style;
    if(cfg.bottom)r.setProperty('--jvm-b',cfg.bottom);
    if(cfg.right)r.setProperty('--jvm-r',cfg.right);
    if(cfg.z!=null)r.setProperty('--jvm-z',String(cfg.z));
    if(cfg.css){var s=el('jvmPageCss');if(!s){s=document.createElement('style');s.id='jvmPageCss';document.head.appendChild(s);}s.textContent=cfg.css;}
  }
  function clip(s,n){s=String(s==null?'':s).replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();return s.length>n?s.slice(0,n-1)+'…':s;}

  var api={
    EM_ROLES:EM_ROLES,
    ready:function(){return ok;},
    init:async function(o){
      cfg=o||{};ok=false;
      var role=cfg.role;
      var adm=/@javia-admin\.internal$/.test(cfg.email||'');
      if(role==null&&!adm&&cfg.db&&cfg.uid&&cfg.fs&&cfg.fs.getDoc){
        try{var d=await cfg.fs.getDoc(cfg.fs.doc(cfg.db,'users',cfg.uid));role=d.exists()?(d.data().role||''):'';}catch(_e){role='';}
      }
      ok=!!(cfg.uid&&(adm||EM_ROLES.indexOf(role||'')>=0));
      if(!ok){if(wrap)wrap.classList.remove('on');return false;}
      if(cfg.noFab){css();return true;}   /* 버튼 없이 담기·할 일만 쓰는 화면 (index.html — 자체 플로팅 버튼 사용) */
      build();vars();wrap.classList.add('on');
      return true;
    },
    hide:function(){if(wrap)wrap.classList.remove('on');collapse();},
    show:function(){if(wrap&&ok)wrap.classList.add('on');},
    open:function(){
      if(!cfg)return;
      try{if(cfg.db&&cfg.uid&&cfg.fs){var r=cfg.fs.doc(cfg.fs.collection(cfg.db,'service_logs'));cfg.fs.setDoc(r,{logId:r.id,userId:cfg.uid,service:'easy_memo',createdAt:cfg.fs.serverTimestamp()}).catch(function(){});}}catch(_e){}
      if(!cfg.newTab&&window.matchMedia('(max-width:767px)').matches)location.href='./memo.html';   /* 폰은 같은 화면(뒤로가기로 복귀) — 작업 중 화면(AI 비서 등)은 newTab */
      else{var w=window.open('./memo.html','_blank');if(w){try{w.opener=null;}catch(_e){}}else location.href='./memo.html';}
    },
    add:async function(o){
      if(!ok||!cfg){toast('이지메모는 정규회원 전용입니다');return false;}
      var text=clip(o&&o.text,3000);if(!text){toast('담을 내용이 없어요');return false;}
      var link=String((o&&o.link)||'');if(!LINK_RE.test(link)||link.length>500)link='';
      var from=clip((o&&o.from)||'',40);
      var key=String((o&&o.key)||'').slice(0,120);   /* ★ 같은 대상(예: 게시예정 찜)을 메모에서 한 줄로 관리 — 중복 방지·삭제 요청에 사용 */
      if(lastAdd.t===text&&Date.now()-lastAdd.at<30000){if(!(o&&o.silent))toast('방금 담은 내용이에요',true);return lastAdd.id||true;}
      try{
        var ref=cfg.fs.doc(cfg.fs.collection(cfg.db,'users',cfg.uid,'memo_inbox'));
        var data={text:text,from:from,createdAt:cfg.fs.serverTimestamp()};if(link)data.link=link;if(key)data.key=key;
        await cfg.fs.setDoc(ref,data);
        lastAdd={t:text,at:Date.now(),id:ref.id};
        if(!(o&&o.silent))toast('이지메모에 담았어요',true);
        return ref.id;   /* 받은 메모함 문서 id — 아직 메모로 옮겨지기 전이면 remove 에서 바로 지운다 */
      }catch(e){console.warn('[JvMemo] add',e);toast('담지 못했어요 — 잠시 후 다시 시도해 주세요');return false;}
    },
    /* ★ 담은 줄 지우기 — ① 아직 받은 메모함에 있으면 그 문서를 지우고 ② 이미 메모로 옮겨졌을 수 있으니 「삭제 요청」을 남긴다.
       memo.html 이 열릴 때 요청을 보고 그 줄을 지운다(노트·하위 줄이 있으면 지우지 않고 완료 표시) */
    remove:async function(key,inboxId){
      if(!ok||!cfg||!key)return false;key=String(key).slice(0,120);
      if(inboxId&&cfg.fs.deleteDoc){try{await cfg.fs.deleteDoc(cfg.fs.doc(cfg.db,'users',cfg.uid,'memo_inbox',String(inboxId)));}catch(_e){}}
      if(lastAdd.id&&lastAdd.id===inboxId)lastAdd={t:'',at:0};
      try{var ref=cfg.fs.doc(cfg.fs.collection(cfg.db,'users',cfg.uid,'memo_inbox'));await cfg.fs.setDoc(ref,{del:key,createdAt:cfg.fs.serverTimestamp()});return true;}
      catch(e){console.warn('[JvMemo] remove',e);return false;}
    },
    /* 고객 할 일 — 이름 + 직접 적은 할 일만 담는다 (연락처·주민번호 등은 담지 않음) */
    todo:function(o){
      if(!ok){toast('이지메모는 정규회원 전용입니다');return;}
      css();
      var name=clip(o&&o.name,30)||'고객';
      var ov=el('jvmTd');
      if(!ov){
        ov=document.createElement('div');ov.id='jvmTd';
        ov.innerHTML='<div class="bx" role="dialog" aria-modal="true" aria-labelledby="jvmTdH"><h3 id="jvmTdH"></h3><p class="cx" id="jvmTdC"></p>'
          +'<textarea id="jvmTdT" maxlength="500" placeholder="예: 안부 전화 · 연금 리모델링 제안 자료 보내기"></textarea>'
          +'<div class="bt"><button type="button" class="c" id="jvmTdX">취소</button><button type="button" class="g" id="jvmTdS">📥 이지메모에 담기</button></div>'
          +'<div class="nt">고객 이름과 적은 할 일만 담깁니다. 연락처 등 개인정보는 적지 마세요.</div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click',function(e){if(e.target===ov)ov.classList.remove('on');});
        el('jvmTdX').onclick=function(){ov.classList.remove('on');};
      }
      el('jvmTdH').textContent=name+' 님 할 일 메모';
      el('jvmTdC').textContent=clip(o&&o.ctx,80)||'';
      el('jvmTdC').style.display=(o&&o.ctx)?'':'none';
      var ta=el('jvmTdT');ta.value='';
      el('jvmTdS').onclick=async function(){
        var v=clip(ta.value,500);if(!v){ta.focus();return;}
        var t=name+' 님 — '+v+((o&&o.ctx)?' ('+clip(o.ctx,80)+')':'');
        if(await api.add({text:t,from:(o&&o.from)||'고객'}))ov.classList.remove('on');
      };
      ov.classList.add('on');setTimeout(function(){try{ta.focus();}catch(_e){}},60);
    }
  };
  window.JvMemo=api;
})();
