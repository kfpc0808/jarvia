/* ═══════════════════════════════════════════════════════════════
   calc-core.js — 머니 계산기 허브 공용 파일 (스타일·화면·스크립트 일체) — 2026-10-08
   · client-daily.html(고객 데일리 리포트)·consensus.html(모닝 컨센서스) 공용
   · 스타일·화면·계산기 정의·계산식은 client-daily.html 에 있던 원문을 한 글자도 바꾸지 않고 옮긴 것
     (스타일 끝의 「공용 보강」 4줄만 client-daily.html 다른 위치의 같은 규칙 사본)
   · 계산기를 고치거나 추가할 때는 이 파일만 고친다 → 두 리포트가 항상 같은 결과를 낸다
   · 스타일(#calcCoreStyle)과 화면(#chOverlay·#chSheet)은 이 스크립트가 자기 자리(script 태그 바로 앞)에 넣는다
     — 이미 있으면 다시 넣지 않는다
   · 페이지가 제공하면 쓰는 연결점(없어도 동작):
       #consultantNameRef(상담 버튼 컨설턴트명) · window.jvTrack(열람 기록) · window.cdOpenDiag(상담 신청)
       #calcHubBtn·#barCalcBtn(계산기 열기 버튼) · #formFieldGroup(상담 분야 칩)
   · 바깥으로 내보내는 것: window.dcOpenCalc(k) — 특정 계산기 바로 열기
   ═══════════════════════════════════════════════════════════════ */
(function(){
  var cs=document.currentScript,p=(cs&&cs.parentNode)||document.body,ref=(cs&&cs.parentNode)?cs:null;
  if(!document.getElementById('calcCoreStyle')){
    var st=document.createElement('style');st.id='calcCoreStyle';
    st.textContent=`  #chOverlay,#chOverlay *{box-sizing:border-box}
  .ch-entry{display:block;width:100%;text-align:left;border:none;cursor:pointer;font-family:inherit;
    position:relative;border-radius:18px;padding:18px 16px;overflow:hidden;
    background:radial-gradient(120% 140% at 88% 0%,#1f3e63 0%,#15294A 55%,#0f1f38 100%);
    box-shadow:0 10px 24px rgba(20,35,60,.26)}
  .ch-entry:active{transform:scale(.992)}
  .ch-entry .sp{position:absolute;right:-30px;top:-30px;width:140px;height:140px;border-radius:50%;
    background:radial-gradient(circle,rgba(224,182,90,.28),transparent 65%)}
  .ch-entry .bg{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#1a2a44;
    background:linear-gradient(90deg,#E0B65A,#C98A2E);padding:5px 10px;border-radius:999px}
  .ch-entry .ti{margin:11px 0 4px;color:#fff;font-size:20px;font-weight:800;letter-spacing:-.01em}
  .ch-entry .ti em{font-family:'Noto Serif KR',serif;color:#E0B65A;font-style:normal;font-weight:700}
  .ch-entry .su{color:#bcc9de;font-size:12.5px;line-height:1.5}
  .ch-entry .mi{display:flex;gap:6px;margin-top:13px;flex-wrap:wrap}
  .ch-entry .mi span{font-size:11px;color:#e8eef7;background:rgba(255,255,255,.1);
    border:1px solid rgba(255,255,255,.14);padding:5px 9px;border-radius:999px;font-weight:600}
  .ch-entry .go{position:absolute;right:14px;bottom:14px;width:32px;height:32px;border-radius:50%;
    background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;
    display:grid;place-items:center;font-size:15px}

  #chOverlay{position:fixed;inset:0;z-index:1240;background:#f4f6fa;transform:translateX(100%);
    transition:transform .3s cubic-bezier(.22,1,.36,1);display:flex;flex-direction:column;
    font-family:'Pretendard',-apple-system,sans-serif;color:#1c2434}
  #chOverlay.show{transform:translateX(0)}
  .ch-head{background:#15294A;color:#fff;padding:calc(14px + env(safe-area-inset-top)) 14px 13px;flex:0 0 auto}
  .ch-bar{display:flex;align-items:center;gap:10px}
  .ch-back{width:34px;height:34px;border-radius:10px;border:none;background:rgba(255,255,255,.12);color:#fff;font-size:18px}
  .ch-ttl{font-size:17px;font-weight:800;flex:1}
  .ch-ttl small{display:block;font-size:11px;color:#9fb0c9;font-weight:600;margin-top:2px}
  .ch-srch{margin-top:12px;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);
    border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:10px 12px}
  .ch-srch input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:15px;font-family:inherit}
  .ch-srch input::placeholder{color:#9fb0c9}
  .ch-chips{display:flex;gap:8px;overflow-x:auto;padding:11px 14px 3px;flex:0 0 auto;-webkit-overflow-scrolling:touch}
  .ch-chips::-webkit-scrollbar{display:none}
  .ch-chip{flex:0 0 auto;font-size:12.5px;font-weight:700;color:#6a778c;background:#fff;border:1px solid #e7ebf2;
    border-radius:999px;padding:8px 13px;cursor:pointer}
  .ch-chip.on{background:#15294A;color:#fff;border-color:#15294A}
  .ch-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 14px calc(28px + env(safe-area-inset-bottom));
    overflow-y:auto;flex:1 1 auto;-webkit-overflow-scrolling:touch}
  .ch-gcat{grid-column:1/-1;font-size:12px;font-weight:800;color:#15294A;margin:9px 2px 1px;display:flex;align-items:center;gap:7px}
  .ch-gcat .c{font-size:10.5px;font-weight:700;color:#fff;background:#C98A2E;border-radius:999px;padding:1px 7px}
  .ch-gcat::after{content:"";flex:1;height:1px;background:#e7ebf2}
  .ch-cell{background:#fff;border:1px solid #e7ebf2;border-radius:15px;padding:13px 12px 12px;cursor:pointer;
    transition:transform .12s,box-shadow .12s;position:relative;min-width:0;text-align:left;font-family:inherit}
  .ch-cell:active{transform:translateY(1px)}
  .ch-cell .ic{font-size:22px}
  .ch-cell .nm{font-size:13.5px;font-weight:800;margin-top:6px;letter-spacing:-.01em}
  .ch-cell .ds{font-size:11px;color:#6a778c;margin-top:3px;line-height:1.4}
  .ch-cell .tag{position:absolute;top:9px;right:9px;font-size:9px;font-weight:800;color:#fff;background:#C98A2E;border-radius:6px;padding:2px 5px}
  .ch-cell .tag.hot{background:#D9544D}
  .ch-tier{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;margin-top:7px;color:#6a778c}
  .ch-tier i{width:7px;height:7px;border-radius:50%;display:inline-block}
  .ch-tier.t-ok i{background:#3E9B6E}.ch-tier.t-ap i{background:#C98A2E}.ch-tier.t-rf i{background:#D9544D}

  /* 시트 */
  #chSheet{position:fixed;inset:0;z-index:1262;display:flex;flex-direction:column;justify-content:flex-end;pointer-events:none}
  #chSheet .dim{position:absolute;inset:0;background:rgba(15,24,40,.45);opacity:0;transition:opacity .3s}
  #chSheet .panel{position:relative;background:#fff;border-radius:22px 22px 0 0;max-height:94%;overflow-y:auto;
    transform:translateY(100%);transition:transform .32s cubic-bezier(.22,1,.36,1);box-shadow:0 -10px 40px rgba(0,0,0,.2);
    -webkit-overflow-scrolling:touch;padding-bottom:env(safe-area-inset-bottom)}
  #chSheet.show{pointer-events:auto}
  #chSheet.show .dim{opacity:1}
  #chSheet.show .panel{transform:translateY(0)}
  .ch-grip{width:40px;height:4px;border-radius:99px;background:#d7dde8;margin:9px auto 2px}
  .ch-shead{padding:6px 18px 12px;border-bottom:1px solid #e7ebf2;display:flex;align-items:flex-start;gap:11px}
  .ch-sic{font-size:26px;line-height:1}
  .ch-sh{flex:1;min-width:0}
  .ch-sh .nm{font-size:18px;font-weight:800;letter-spacing:-.01em}
  .ch-sh .ds{font-size:12px;color:#6a778c;margin-top:3px}
  .ch-sx{border:none;background:#f1f4f9;border-radius:9px;width:32px;height:32px;font-size:17px;color:#6a778c;flex:0 0 auto}
  .ch-sbody{padding:15px 18px 6px}

  .ch-warn{background:#fdeceb;border:1px solid #f3c6c2;border-radius:13px;padding:11px 13px;margin-bottom:12px;
    font-size:12px;color:#9e3b34;line-height:1.5;font-weight:600}
  .ch-warn b{color:#c0392b}

  .ch-res{background:radial-gradient(120% 140% at 90% 0%,#1f3e63,#15294A 60%,#10203a);border-radius:18px;
    padding:16px 18px 15px;color:#fff;margin-bottom:6px;position:relative;overflow:hidden}
  .ch-res .badge{display:inline-block;font-size:10px;font-weight:800;border-radius:7px;padding:3px 8px;margin-bottom:8px}
  .ch-res .badge.ap{background:rgba(224,182,90,.22);color:#E0B65A;border:1px solid rgba(224,182,90,.4)}
  .ch-res .badge.rf{background:rgba(217,84,77,.22);color:#f1a59f;border:1px solid rgba(217,84,77,.45)}
  .ch-res .rl{font-size:12px;color:#9fb0c9;font-weight:700}
  .ch-res .rv{font-family:'Noto Serif KR',serif;font-size:32px;font-weight:700;margin:3px 0 2px;line-height:1.1;letter-spacing:-.01em;word-break:keep-all}
  .ch-res .rv .u{font-size:15px;font-family:'Pretendard';color:#E0B65A;font-weight:700;margin-left:3px}
  .ch-res .ru{height:2px;width:50px;background:linear-gradient(90deg,#E0B65A,transparent);margin:6px 0 12px;border-radius:2px}
  .ch-res .subs{display:flex;gap:8px;flex-wrap:wrap}
  .ch-res .subs div{flex:1 1 40%;min-width:110px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:8px 11px}
  .ch-res .subs .k{font-size:11px;color:#9fb0c9}
  .ch-res .subs .v{font-size:14px;font-weight:800;margin-top:2px}
  .ch-bars{display:flex;align-items:flex-end;gap:5px;height:42px;margin-top:12px}
  .ch-bars i{flex:1;background:linear-gradient(180deg,#E0B65A,#C98A2E);border-radius:4px 4px 0 0;min-height:5px}
  .ch-bars i.alt{background:linear-gradient(180deg,#6f93c4,#3D6EA8)}

  .ch-tip{margin:9px 0 2px;background:#fff7ea;border:1px solid #f0dcb4;border-radius:12px;padding:10px 12px;font-size:12px;color:#7a5a1e;line-height:1.55}.ch-tip b{color:#15294A}
  .ch-seg{display:flex;gap:6px;margin:13px 0}
  .ch-seg button{flex:1;font-size:12.5px;font-weight:700;padding:10px;border-radius:11px;border:1px solid #e7ebf2;background:#fff;color:#6a778c;font-family:inherit}
  .ch-seg button.on{background:#15294A;color:#fff;border-color:#15294A}
  .ch-field{margin:14px 0}
  .ch-lab{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px}
  .ch-lab .nm{font-size:13.5px;font-weight:700}
  .ch-lab .vw{display:flex;align-items:baseline;gap:3px}
  .ch-lab .vw input{width:110px;text-align:right;font-size:15px;font-weight:800;color:#15294A;border:1px solid #e7ebf2;
    border-radius:9px;padding:7px 9px;font-family:inherit;outline:none}
  .ch-lab .vw input:focus{border-color:#3D6EA8}
  .ch-lab .u{font-size:12px;color:#6a778c;font-weight:600}
  .ch-rngrow{display:flex;align-items:center;gap:10px;margin-top:2px}.ch-rngrow input[type=range]{flex:1;width:auto;min-width:0}.ch-step{flex:0 0 auto;width:36px;height:36px;border-radius:10px;border:1px solid #e7ebf2;background:#fff;color:#15294A;font-size:20px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit;-webkit-user-select:none;user-select:none;touch-action:manipulation}.ch-step:active{background:#15294A;color:#fff}#chOverlay input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:99px;background:#e2e8f2;outline:none;margin:0}
  #chOverlay input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid #C98A2E;box-shadow:0 2px 6px rgba(201,138,46,.4)}
  #chOverlay input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid #C98A2E}

  .ch-cta{margin:14px 0 6px;background:#fff7ea;border:1px solid #f0dcb4;border-radius:15px;padding:13px;display:flex;align-items:center;gap:11px}
  .ch-cta.big{background:#15294A;border-color:#15294A}
  .ch-cta .av{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#22426b,#15294A);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px;flex:0 0 auto}
  .ch-cta.big .av{background:#E0B65A;color:#15294A}
  .ch-cta .tx{flex:1;min-width:0}
  .ch-cta .tx b{font-size:13px;color:#15294A;display:block}
  .ch-cta .tx span{font-size:11px;color:#6a778c}
  .ch-cta.big .tx b{color:#fff}.ch-cta.big .tx span{color:#bcc9de}
  .ch-cta button{background:#15294A;color:#fff;border:none;border-radius:11px;padding:11px 14px;font-size:13px;font-weight:800;font-family:inherit;white-space:nowrap}
  .ch-cta.big button{background:#E0B65A;color:#15294A}
  .ch-disc{font-size:10.5px;color:#9aa6ba;line-height:1.5;padding:4px 2px 18px}
  .ch-empty{grid-column:1/-1;text-align:center;color:#9aa6ba;padding:40px 0;font-size:13px}
  .ch-only{padding:6px 0 8px}
  .ch-only p{font-size:13px;color:#465061;line-height:1.65;margin:0 0 14px}

/* ── 공용 보강 (client-daily.html 의 같은 규칙과 동일 값) ── */
#chOverlay .ch-back{min-width:34px;min-height:34px;font-size:20px}
@media(min-width:641px){
  #chOverlay{left:50%;right:auto;width:100%;max-width:480px;transform:translateX(-50%) translateY(14px);opacity:0;visibility:hidden;transition:opacity .28s ease,transform .28s ease,visibility .28s;box-shadow:0 0 0 100vmax rgba(13,20,33,.5),0 24px 70px rgba(13,20,33,.35)}
  #chOverlay.show{transform:translateX(-50%) translateY(0);opacity:1;visibility:visible}
  #chSheet .panel{width:100%;max-width:480px;margin:0 auto}
}`;
    p.insertBefore(st,ref);
  }
  if(document.getElementById('chOverlay'))return;
  var w=document.createElement('div');
  w.innerHTML=`<div id="chOverlay" aria-hidden="true">
  <div class="ch-head">
    <div class="ch-bar">
      <button class="ch-back" id="chBack" aria-label="닫기">←</button>
      <div class="ch-ttl">머니 계산기<small id="chCount">30초 시뮬레이터</small></div>
      <button id="chMain" aria-label="메인으로" style="border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:700;white-space:nowrap"><i class="ti ti-home"></i> 메인</button>
    </div>
    <div class="ch-srch">🔎<input id="chQ" placeholder="연금, 대출, BMI 검색…" autocomplete="off"></div>
  </div>
  <div class="ch-chips" id="chChips"></div>
  <div class="ch-grid" id="chGrid"></div>
</div>

<div id="chSheet">
  <div class="dim" id="chDim"></div>
  <div class="panel">
    <div class="ch-grip"></div>
    <div class="ch-shead">
      <div class="ch-sic" id="chSic">📈</div>
      <div class="ch-sh"><div class="nm" id="chSnm">계산기</div><div class="ds" id="chSds"></div></div>
      <button class="ch-sx" id="chSx" aria-label="닫기">✕</button>
    </div>
    <div class="ch-sbody" id="chSbody"></div>
  </div>
</div>`;
  while(w.firstChild)p.insertBefore(w.firstChild,ref);
})();
/* 계산기 허브 스크립트 (fc 이식 · 자체 완결) */
var $=window.$||function(id){return document.getElementById(id);};window.$=$;

(function(){
  "use strict";
  var $=function(id){return document.getElementById(id);};
  /* ---------- 포맷터 ---------- */
  function won(v){v=Math.round(v);if(v<0)v=0;
    if(v>=100000000){var e=Math.floor(v/100000000),m=Math.round((v%100000000)/10000);return e+'억'+(m?' '+m.toLocaleString()+'만':'');}
    if(v>=10000){return Math.round(v/10000).toLocaleString()+'만';}
    return v.toLocaleString();}
  function comma(s){s=(''+s).replace(/[^\d]/g,'');return s?parseInt(s,10).toLocaleString():'';}
  function consultantName(){var el=$('consultantNameRef');var n=el?(el.textContent||'').trim():'';return n||'담당 컨설턴트';}

  /* ---------- 계산기 정의 ----------
     tier: ok(정확)/ap(약식)/rf(참고용)  |  in: {k,nm,min,max,step,v,u,dec?}
     seg: {k,opt:[],v}  |  fn(v)->{main,u,ml,plain?,fix?,subs:[[k,v]],bars:[]}
     only: 계산 없이 상담 진입 카드  */
  var C={
   /* 노후·연금 */
   pension:{cat:'노후·연금',ic:'🏦',nm:'국민연금 예상수령액',ds:'가입기간·소득으로 월 수령액',tag:'상담',tier:'ap',
     in:[{k:'yr',nm:'가입 기간',min:10,max:40,step:1,v:25,u:'년'},{k:'inc',nm:'평균 월소득',min:100,max:700,step:10,v:300,u:'만원'}],
     fn:function(v){var m=v.inc*10000*0.4*(v.yr/40);return{main:m,u:'원/월',ml:'예상 월 수령액(65세~)',subs:[['연 환산',won(m*12)+'원'],['가입 기간',v.yr+'년']],bars:[v.yr/40,.55,.7,.85,1]};}},
   retire:{cat:'노후·연금',ic:'🏖️',nm:'노후 필요자금',ds:'나이·물가 반영 필요자금',tag:'상담',tier:'ap',
     in:[{k:'age',nm:'현재 나이',min:25,max:70,step:1,v:45,u:'세'},{k:'rage',nm:'은퇴 나이',min:45,max:75,step:1,v:60,u:'세'},{k:'y',nm:'은퇴 후 기간',min:10,max:40,step:1,v:30,u:'년'},{k:'m',nm:'월 생활비(현재가치)',min:100,max:700,step:10,v:250,u:'만원'},{k:'inf',nm:'물가상승률',min:1,max:5,step:0.5,v:2.5,u:'%',dec:1}],
     fn:function(v){var n1=Math.max(0,v.rage-v.age),mRet=v.m*10000*Math.pow(1+v.inf/100,n1),total=mRet*12*v.y;return{main:total,u:'원',ml:'필요한 노후자금 총액',subs:[['은퇴 시점 월 생활비',won(mRet)+'원'],['은퇴까지 / 은퇴 후',n1+'년 / '+v.y+'년']],bars:[.3,.45,.6,.8,1]};}},
   goalback:{cat:'노후·연금',ic:'🎯',nm:'목표 금액 역산',ds:'얼마 모으려면 매달 얼마?',tag:'상담',tier:'ok',
     in:[{k:'t',nm:'목표 금액',min:1000,max:300000,step:1000,v:30000,u:'만원'},{k:'rate',nm:'연 수익률',min:1,max:12,step:.5,v:5,u:'%',dec:1},{k:'yr',nm:'기간',min:1,max:40,step:1,v:20,u:'년'}],
     fn:function(v){var F=v.t*10000,r=v.rate/100/12,n=v.yr*12,pmt=r>0?F*r/((Math.pow(1+r,n)-1)*(1+r)):F/n;return{main:pmt,u:'원/월',ml:'매달 필요한 적립액',subs:[['목표 금액',won(F)+'원'],['총 납입(원금)',won(pmt*n)+'원']],bars:[.2,.4,.6,.8,1]};}},
   house:{cat:'노후·연금',ic:'🏘️',nm:'주택연금 예상수령액',ds:'내 집으로 받는 월 연금',tag:'상담',tier:'ap',
     in:[{k:'p',nm:'주택 가격',min:10000,max:200000,step:1000,v:50000,u:'만원'},{k:'age',nm:'가입 나이',min:55,max:90,step:1,v:65,u:'세'}],
     fn:function(v){var f=0.00244+(v.age-65)*0.00012;if(f<0.0012)f=0.0012;var m=v.p*10000*f;return{main:m,u:'원/월',ml:'예상 월 수령액(종신)',subs:[['주택 가격',won(v.p*10000)+'원'],['가입 나이',v.age+'세']],bars:[.4,.55,.7,.85,1]};}},
   fv:{cat:'노후·연금',ic:'📈',nm:'미래가치',ds:'물가 반영 미래 금액',tier:'ok',
     in:[{k:'p',nm:'현재 금액',min:100,max:100000,step:100,v:5000,u:'만원'},{k:'rate',nm:'물가/수익률',min:1,max:8,step:.5,v:3,u:'%',dec:1},{k:'yr',nm:'기간',min:1,max:40,step:1,v:20,u:'년'}],
     fn:function(v){var P=v.p*10000,fvv=P*Math.pow(1+v.rate/100,v.yr);return{main:fvv,u:'원',ml:v.yr+'년 후 가치',subs:[['현재 금액',won(P)+'원'],['증가분',won(fvv-P)+'원']],bars:[1,2,3,4,5].map(function(x){return Math.pow(1+v.rate/100,x*v.yr/5);})};}},
   pv:{cat:'노후·연금',ic:'📉',nm:'현재가치',ds:'미래 금액의 지금 가치',tier:'ok',
     in:[{k:'f',nm:'미래 금액',min:100,max:200000,step:500,v:10000,u:'만원'},{k:'rate',nm:'할인율',min:1,max:8,step:.5,v:3,u:'%',dec:1},{k:'yr',nm:'기간',min:1,max:40,step:1,v:20,u:'년'}],
     fn:function(v){var Fv=v.f*10000,pvv=Fv/Math.pow(1+v.rate/100,v.yr);return{main:pvv,u:'원',ml:'현재 기준 가치',subs:[['미래 금액',won(Fv)+'원'],['차감분',won(Fv-pvv)+'원']],bars:[5,4,3,2,1].map(function(x){return 1/Math.pow(1+v.rate/100,x*v.yr/5);})};}},
   accum:{cat:'노후·연금',ic:'🪙',nm:'적립 시뮬',ds:'월 적립의 미래 총액',tier:'ok',
     in:[{k:'m',nm:'월 적립액',min:5,max:300,step:5,v:50,u:'만원'},{k:'rate',nm:'연 수익률',min:1,max:12,step:.5,v:5,u:'%',dec:1},{k:'yr',nm:'기간',min:1,max:40,step:1,v:20,u:'년'}],
     fn:function(v){var P=v.m*10000,n=v.yr*12,r=v.rate/100/12,fvv=r>0?P*((Math.pow(1+r,n)-1)/r)*(1+r):P*n,pr=P*n;return{main:fvv,u:'원',ml:'적립 만기 예상액',subs:[['원금',won(pr)+'원'],['수익',won(fvv-pr)+'원']],bars:[.2,.4,.6,.8,1]};}},
   compound:{cat:'노후·연금',ic:'🔢',nm:'복리 계산기',ds:'목돈 복리 불리기',tier:'ok',
     in:[{k:'p',nm:'초기 금액',min:100,max:100000,step:100,v:1000,u:'만원'},{k:'rate',nm:'연 수익률',min:1,max:15,step:.5,v:6,u:'%',dec:1},{k:'yr',nm:'기간',min:1,max:40,step:1,v:20,u:'년'}],
     fn:function(v){var P=v.p*10000,fvv=P*Math.pow(1+v.rate/100,v.yr);return{main:fvv,u:'원',ml:v.yr+'년 후 예상 금액',subs:[['원금',won(P)+'원'],['수익',won(fvv-P)+'원']],bars:[1,2,3,4,5].map(function(x){return Math.pow(1+v.rate/100,x*v.yr/5);})};}},
   rule72:{cat:'노후·연금',ic:'⚡',nm:'72의 법칙',ds:'원금 2배 되는 기간',tier:'ok',
     in:[{k:'rate',nm:'연 수익률',min:1,max:20,step:.5,v:6,u:'%',dec:1}],
     fn:function(v){var y=72/v.rate;return{main:y,u:'년',ml:'원금이 2배 되는 기간',plain:1,fix:1,subs:[['연 수익률',v.rate+'%'],['4배까지',(y*2).toFixed(1)+'년']],bars:[.9,.7,.55,.4,.3]};}},
   irp:{cat:'노후·연금',ic:'🧾',nm:'연금저축·IRP 세액공제',ds:'연말정산 환급 추정',tag:'상담',tier:'ap',
     in:[{k:'pay',nm:'연 납입액',min:0,max:900,step:30,v:600,u:'만원'},{k:'inc',nm:'총급여',min:3000,max:15000,step:500,v:5500,u:'만원'}],
     fn:function(v){var lim=Math.min(v.pay,900),rate=v.inc<=5500?0.165:0.132,ref=lim*10000*rate;return{main:ref,u:'원',ml:'예상 세액공제(환급)',subs:[['공제 대상',won(lim*10000)+'원'],['공제율',(rate*100).toFixed(1)+'%']],bars:[.3,.5,.7,.9,1]};}},
   pensiontax:{cat:'노후·연금',ic:'🧮',nm:'연금소득세',ds:'연금 수령 시 세금',tag:'상담',tier:'ap',
     in:[{k:'a',nm:'연 연금 수령액',min:300,max:5000,step:100,v:1200,u:'만원'}],
     fn:function(v){var A=v.a*10000,rate=v.a<=1200?0.033:0.05,tax=A*rate;return{main:tax,u:'원',ml:'예상 연금소득세(분리과세 가정)',subs:[['실수령 추정',won(A-tax)+'원'],['적용 세율',(rate*100).toFixed(1)+'%']],bars:[.5,.6,.7,.85,1]};}},

   /* 보험 */
   needins:{cat:'보험',ic:'🛡️',nm:'필요 보장액',ds:'유고 시 가족 필요 금액',tag:'상담',tier:'ap',
     in:[{k:'inc',nm:'연 소득',min:2000,max:15000,step:100,v:5000,u:'만원'},{k:'yr',nm:'보장 기간',min:5,max:30,step:1,v:15,u:'년'},{k:'asset',nm:'보유 자산',min:0,max:50000,step:500,v:10000,u:'만원'}],
     fn:function(v){var need=Math.max(0,v.inc*10000*0.7*v.yr-v.asset*10000);return{main:need,u:'원',ml:'권장 생명보험 가입금액',subs:[['가족 생활 필요',won(v.inc*10000*0.7*v.yr)+'원'],['보유 자산 차감',won(v.asset*10000)+'원']],bars:[.4,.55,.7,.85,1]};}},
   medself:{cat:'보험',ic:'🩺',nm:'실손 자기부담금',ds:'진료비 본인부담 추정',tier:'ap',
     in:[{k:'bill',nm:'총 진료비',min:1,max:1000,step:1,v:50,u:'만원'}],seg:{k:'t',opt:['통원','입원'],v:0},
     fn:function(v){var B=v.bill*10000,rate=v.t===0?0.3:0.2,self=B*rate;return{main:self,u:'원',ml:'예상 본인부담금',subs:[['보험 보장(추정)',won(B-self)+'원'],['구분',v.t===0?'통원 30%':'입원 20%']],bars:[.3,.4,.55,.7,1]};}},
   lifecmp:{cat:'보험',ic:'♻️',nm:'종신 vs 정기 비교',ds:'두 보험 월 보험료 비교',tag:'상담',tier:'rf',
     in:[{k:'age',nm:'가입 나이',min:30,max:60,step:1,v:40,u:'세'},{k:'amt',nm:'보장 금액',min:5000,max:50000,step:1000,v:10000,u:'만원'},{k:'yr',nm:'정기 보장기간',min:10,max:30,step:1,v:20,u:'년'}],
     fn:function(v){var A=v.amt*10000;var whole=A*(0.00075+(v.age-40)*0.00002);var term=A*(0.00012+(v.age-40)*0.000008);return{main:whole,u:'원/월',ml:'종신보험 월 보험료(추정)',subs:[['정기보험(같은 보장)',won(term)+'원/월'],['차액',won(whole-term)+'원/월']],bars:[1,.3,1,.3,1].map(function(x){return x;})};}},

   /* 돈·금융 */
   loan:{cat:'돈·금융',ic:'🏠',nm:'대출 이자',ds:'월 상환액·총이자',tag:'인기',tier:'ok',
     in:[{k:'amt',nm:'대출 금액',min:1000,max:80000,step:500,v:20000,u:'만원'},{k:'rate',nm:'연 금리',min:2,max:9,step:.1,v:4.5,u:'%',dec:1},{k:'yr',nm:'기간',min:1,max:35,step:1,v:30,u:'년'}],seg:{k:'type',opt:['원리금균등','원금균등'],v:0},
     fn:function(v){var P=v.amt*10000,r=v.rate/100/12,n=v.yr*12,m,tot;if(v.type===0){m=r>0?P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):P/n;tot=m*n;}else{m=P/n+P*r;tot=P+P*r*(n+1)/2;}return{main:m,u:'원/월',ml:v.type===0?'매월 상환액(균등)':'첫 달 상환액',subs:[['총 상환액',won(tot)+'원'],['총 이자',won(tot-P)+'원']],bars:[.35,.5,.62,.8,1]};}},
   saving:{cat:'돈·금융',ic:'💰',nm:'예·적금 이자',ds:'만기 수령액(단·복리)',tag:'인기',tier:'ok',
     in:[{k:'m',nm:'월 납입액',min:5,max:300,step:5,v:50,u:'만원'},{k:'yr',nm:'기간',min:1,max:20,step:1,v:5,u:'년'},{k:'rate',nm:'연 금리',min:1,max:7,step:.1,v:3.5,u:'%',dec:1}],seg:{k:'type',opt:['복리','단리'],v:0},
     fn:function(v){var P=v.m*10000,n=v.yr*12,r=v.rate/100/12,pr=P*n,fvv;if(v.type===0){fvv=r>0?P*((Math.pow(1+r,n)-1)/r)*(1+r):pr;}else{fvv=pr+P*r*n*(n+1)/2;}return{main:fvv,u:'원',ml:'세전 만기 수령액',subs:[['원금',won(pr)+'원'],['이자',won(fvv-pr)+'원']],bars:[.2,.4,.6,.8,1]};}},
   salary:{cat:'돈·금융',ic:'💳',nm:'연봉 실수령액',ds:'세후 월급 추정',tag:'상담',tier:'ap',ct:['salary'],
     in:[{k:'a',nm:'연봉',min:2000,max:20000,step:100,v:4000,u:'만원'},{k:'fam',nm:'부양가족 수',min:0,max:5,step:1,v:1,u:'명'}],
     fn:function(v){var A=v.a*10000;var ins=A*0.092;var taxable=Math.max(0,A-ins-v.fam*1500000);var t;if(v.a<=2500)t=taxable*0.01;else if(v.a<=4600)t=taxable*0.06;else if(v.a<=8800)t=taxable*0.13;else t=taxable*0.2;var net=A-ins-t;return{main:net/12,u:'원/월',ml:'예상 월 실수령액',subs:[['연 실수령',won(net)+'원'],['공제 합계',won(ins+t)+'원']],bars:[.9,.75,.6,.45,.3]};}},
   dutch:{cat:'돈·금융',ic:'🧮',nm:'더치페이(N빵)',ds:'1인당 금액',tier:'ok',
     in:[{k:'tot',nm:'총 금액',min:1,max:500,step:1,v:48,u:'만원'},{k:'n',nm:'인원',min:2,max:30,step:1,v:4,u:'명'}],
     fn:function(v){var per=v.tot*10000/v.n;return{main:per,u:'원',ml:'1인당 금액',subs:[['총액',won(v.tot*10000)+'원'],['인원',v.n+'명']],bars:[.9,.7,.55,.4,.3]};}},
   percent:{cat:'돈·금융',ic:'🏷️',nm:'할인가 계산',ds:'정가에서 N% 할인',tier:'ok',
     in:[{k:'price',nm:'정가',min:1000,max:2000000,step:1000,v:50000,u:'원'},{k:'d',nm:'할인율',min:0,max:90,step:1,v:20,u:'%'}],
     fn:function(v){var f=v.price*(1-v.d/100);return{main:f,u:'원',ml:v.d+'% 할인가',plain:1,subs:[['할인액',Math.round(v.price*v.d/100).toLocaleString()+'원'],['정가',v.price.toLocaleString()+'원']],bars:[1,.85,.7,.55,.4]};}},

   /* 세금 */
   retiretax:{cat:'세금',ic:'📋',nm:'퇴직소득세',ds:'퇴직금 세금 추정',tag:'상담',tier:'ap',
     in:[{k:'amt',nm:'퇴직금',min:1000,max:80000,step:500,v:10000,u:'만원'},{k:'yr',nm:'근속연수',min:1,max:40,step:1,v:20,u:'년'}],
     fn:function(v){var A=v.amt*10000,ded=A*0.4*(Math.min(v.yr,30)/30),base=Math.max(0,A-ded),tax=base*0.08;return{main:tax,u:'원',ml:'예상 퇴직소득세',subs:[['실수령 추정',won(A-tax)+'원'],['근속연수',v.yr+'년']],bars:[.6,.5,.4,.3,.2]};}},
   inherit:{cat:'세금',ic:'🏛️',nm:'상속세',ds:'예상세액 + 솔루션',tag:'상담',tier:'rf',
     in:[{k:'asset',nm:'상속 재산',min:5000,max:500000,step:5000,v:100000,u:'만원'},{k:'heir',nm:'상속인 수',min:1,max:6,step:1,v:3,u:'명'}],seg:{k:'sp',opt:['배우자 있음','배우자 없음'],v:0},
     fn:function(v){var a=v.asset*10000,sp=v.sp===0,ded=Math.max(500000000,(2+v.heir*0.5)*100000000)+(sp?500000000:0),base=Math.max(0,a-ded),tax;tax=base<=100000000?base*.1:base<=500000000?base*.2-10000000:base<=1000000000?base*.3-60000000:base<=3000000000?base*.4-160000000:base*.5-460000000;tax=Math.max(0,tax);return{main:tax,u:'원',ml:'예상 상속세(약식)',subs:[['공제액',won(ded)+'원'],['과세표준',won(base)+'원']],bars:[.3,.5,.7,.85,1]};}},
   gift:{cat:'세금',ic:'🎁',nm:'증여세',ds:'관계·인원 반영 증여세',tag:'상담',tier:'rf',ct:['inheritance','insurance'],
     in:[{k:'asset',nm:'증여 재산',min:1000,max:300000,step:1000,v:30000,u:'만원'},{k:'donee',nm:'받는 사람 수',min:1,max:5,step:1,v:1,u:'명'}],seg:{k:'rel',opt:['성인자녀','미성년','배우자','기타'],v:0},
     fn:function(v){var per=v.asset*10000/v.donee,ded=[50000000,20000000,600000000,10000000][v.rel];function tx(b){b=Math.max(0,b);return b<=100000000?b*.1:b<=500000000?b*.2-10000000:b<=1000000000?b*.3-60000000:b<=3000000000?b*.4-160000000:b*.5-460000000;}var pt=Math.max(0,tx(per-ded)),total=pt*v.donee;return{main:total,u:'원',ml:'예상 증여세(총, 약식)',subs:[['1인당 증여세',won(pt)+'원'],['1인당 증여액',won(per)+'원']],bars:[.5,.65,.8,.9,1]};}},
   giftcmp:{cat:'세금',ic:'⚖️',nm:'증여 vs 상속 비교',ds:'어느 쪽이 유리할까',tag:'상담',tier:'rf',
     in:[{k:'asset',nm:'대상 재산',min:5000,max:300000,step:5000,v:50000,u:'만원'}],
     fn:function(v){var a=v.asset*10000;function tx(b){b=Math.max(0,b);return b<=100000000?b*.1:b<=500000000?b*.2-10000000:b<=1000000000?b*.3-60000000:b<=3000000000?b*.4-160000000:b*.5-460000000;}var gift=Math.max(0,tx(a-50000000));var inh=Math.max(0,tx(a-500000000));return{main:gift,u:'원',ml:'증여세(추정)',subs:[['상속세(추정)',won(inh)+'원'],['차이',won(Math.abs(gift-inh))+'원']],bars:[gift?1:.2,.3,inh?1:.2,.3,.5]};}},
   transfer:{cat:'세금',ic:'🏚️',nm:'양도소득세',ds:'케이스별 상담 필요',tag:'상담',tier:'rf',only:1,ct:['real_estate'],
     onlyText:'양도소득세는 보유기간·1세대1주택·장기보유특별공제·다주택 중과 등 변수가 매우 많고 세법이 자주 바뀌어, 간이 계산으로는 실제와 크게 달라질 수 있습니다. 정확한 세액은 보유 현황을 바탕으로 한 전문가 진단이 필요합니다.'},

   /* 부동산 */
   jeonse:{cat:'부동산',ic:'🔑',nm:'전월세 전환',ds:'전세↔월세 환산',tier:'ok',
     in:[{k:'dep',nm:'전세 보증금',min:5000,max:150000,step:1000,v:30000,u:'만원'},{k:'rate',nm:'전환율',min:3,max:7,step:.1,v:5.5,u:'%',dec:1}],
     fn:function(v){var mth=v.dep*10000*(v.rate/100)/12;return{main:mth,u:'원/월',ml:'환산 월세',subs:[['보증금',won(v.dep*10000)+'원'],['전환율',v.rate+'%']],bars:[.5,.6,.7,.85,1]};}},
   dsr:{cat:'부동산',ic:'📊',nm:'대출 한도(DSR)',ds:'연소득 기준 한도',tag:'상담',tier:'ap',
     in:[{k:'inc',nm:'연 소득',min:2000,max:15000,step:100,v:5000,u:'만원'},{k:'rate',nm:'금리',min:2,max:8,step:.1,v:4.5,u:'%',dec:1},{k:'yr',nm:'기간',min:10,max:40,step:5,v:30,u:'년'},{k:'debt',nm:'기존 대출 월상환',min:0,max:500,step:10,v:0,u:'만원'}],
     fn:function(v){var ann=v.inc*10000*0.4,cap=Math.max(0,ann/12-v.debt*10000),r=v.rate/100/12,n=v.yr*12,lim=r>0?cap*(Math.pow(1+r,n)-1)/(r*Math.pow(1+r,n)):cap*n;return{main:lim,u:'원',ml:'예상 대출 한도(DSR 40%)',subs:[['월 상환 여력',won(cap)+'원'],['적용 DSR','40%']],bars:[.4,.6,.75,.9,1]};}},
   ltv:{cat:'부동산',ic:'🏦',nm:'LTV·DTI 한도',ds:'주택가격 기준 한도',tier:'ap',
     in:[{k:'p',nm:'주택 가격',min:10000,max:200000,step:1000,v:50000,u:'만원'},{k:'ltv',nm:'LTV 비율',min:40,max:80,step:5,v:70,u:'%'}],
     fn:function(v){var lim=v.p*10000*v.ltv/100;return{main:lim,u:'원',ml:'LTV 기준 대출 가능액',subs:[['주택 가격',won(v.p*10000)+'원'],['LTV',v.ltv+'%']],bars:[.4,.55,.7,.85,1]};}},
   pyeong:{cat:'부동산',ic:'📐',nm:'평 ↔ ㎡',ds:'면적 단위 변환',tier:'ok',
     in:[{k:'p',nm:'평수',min:1,max:120,step:1,v:25,u:'평'}],
     fn:function(v){var m2=v.p*3.305785;return{main:m2,u:'㎡',ml:v.p+'평 =',plain:1,fix:2,subs:[['제곱미터',m2.toFixed(2)+' ㎡'],['공급면적 예시',(m2*1.3).toFixed(1)+' ㎡']],bars:[.2,.4,.6,.8,1]};}},

   /* 건강 */
   bmi:{cat:'건강',ic:'⚖️',nm:'BMI',ds:'체질량지수',tag:'인기',tier:'ok',
     in:[{k:'h',nm:'키',min:130,max:200,step:1,v:170,u:'cm'},{k:'w',nm:'몸무게',min:35,max:130,step:1,v:68,u:'kg'}],
     fn:function(v){var b=v.w/Math.pow(v.h/100,2),s=b<18.5?'저체중':b<23?'정상':b<25?'과체중':'비만';return{main:b,u:'',ml:'BMI 지수 · '+s,plain:1,fix:1,subs:[['판정',s],['표준체중',(22*Math.pow(v.h/100,2)).toFixed(1)+'kg']],bars:[.3,.55,.75,.9,1]};}},
   bmr:{cat:'건강',ic:'🔥',nm:'기초대사량(BMR)',ds:'하루 소모 칼로리',tier:'ok',
     in:[{k:'h',nm:'키',min:130,max:200,step:1,v:170,u:'cm'},{k:'w',nm:'몸무게',min:35,max:130,step:1,v:68,u:'kg'},{k:'age',nm:'나이',min:15,max:80,step:1,v:35,u:'세'}],seg:{k:'sex',opt:['남','여'],v:0},
     fn:function(v){var b=v.sex===0?10*v.w+6.25*v.h-5*v.age+5:10*v.w+6.25*v.h-5*v.age-161;return{main:b,u:'kcal',ml:'기초대사량(BMR)',plain:1,subs:[['활동 포함(×1.5)',Math.round(b*1.5).toLocaleString()+' kcal'],['성별',v.sex===0?'남성':'여성']],bars:[.5,.65,.8,.9,1]};}},
   stdwt:{cat:'건강',ic:'📏',nm:'표준체중',ds:'키 기준 적정 체중',tier:'ok',
     in:[{k:'h',nm:'키',min:130,max:200,step:1,v:170,u:'cm'}],
     fn:function(v){var s=22*Math.pow(v.h/100,2);return{main:s,u:'kg',ml:'표준체중(BMI 22)',plain:1,fix:1,subs:[['정상 범위',(18.5*Math.pow(v.h/100,2)).toFixed(0)+'~'+(23*Math.pow(v.h/100,2)).toFixed(0)+'kg'],['키',v.h+'cm']],bars:[.4,.6,.75,.9,1]};}},
   burn:{cat:'건강',ic:'🏃',nm:'칼로리 소모',ds:'운동으로 태우는 열량',tier:'ok',
     in:[{k:'w',nm:'몸무게',min:35,max:130,step:1,v:68,u:'kg'},{k:'min',nm:'운동 시간',min:5,max:180,step:5,v:30,u:'분'}],seg:{k:'ex',opt:['걷기','달리기','자전거'],v:0},
     fn:function(v){var met=[3.5,8,6][v.ex],k=met*3.5*v.w/200*v.min;return{main:k,u:'kcal',ml:'예상 소모 칼로리',plain:1,fix:0,subs:[['운동',['걷기','달리기','자전거'][v.ex]],['공기밥 환산',(k/300).toFixed(1)+'공기']],bars:[.4,.6,.75,.9,1]};}},

   /* 생활 */
   unit:{cat:'생활',ic:'🔁',nm:'단위 변환(거리)',ds:'km → m·마일·걸음',tier:'ok',
     in:[{k:'km',nm:'거리',min:1,max:200,step:1,v:10,u:'km'}],
     fn:function(v){return{main:v.km*1000,u:'m',ml:v.km+'km =',plain:1,subs:[['마일',(v.km*0.621).toFixed(2)+' mi'],['걸음(약)',Math.round(v.km*1400).toLocaleString()+' 보']],bars:[.2,.4,.6,.8,1]};}},
   age:{cat:'생활',ic:'🎂',nm:'만 나이',ds:'출생 연도로 만 나이',tier:'ok',
     in:[{k:'y',nm:'출생 연도',min:1930,max:2025,step:1,v:1988,u:'년'}],
     fn:function(v){var a=2026-v.y;return{main:a,u:'세',ml:'2026년 기준 만 나이',plain:1,subs:[['출생 연도',v.y+'년'],['10년 후',(a+10)+'세']],bars:[.2,.4,.6,.8,1]};}}
  };

  var CATS=['전체','노후·연금','보험','돈·금융','세금','부동산','건강','생활'];
  var TIER={ok:['t-ok','정확'],ap:['t-ap','약식'],rf:['t-rf','참고용']};
  var CT_BY_CAT={'노후·연금':['retirement','insurance'],'보험':['insurance'],'세금':['inheritance','insurance'],'부동산':['real_estate']};
  var TIPS={pension:'국민연금만으론 노후 생활비의 절반도 어려워요. 부족분은 개인연금으로 채울 수 있어요.',retire:'필요자금과 현재 준비액의 차이는 연금·저축성보험으로 메우는 게 일반적이에요.',house:'주택연금에 개인연금을 더하면 매달 현금흐름이 더 안정적이에요.',goalback:'목표 적립을 비과세 저축성보험으로 하면 복리 효과를 세금 없이 누릴 수 있어요.',accum:'장기 적립은 10년 이상 비과세 저축성보험을 함께 비교해 보세요.',compound:'복리를 세금 없이 누리려면 비과세 연금·저축성보험을 활용할 수 있어요.',fv:'미래 가치를 지키려면 물가 이상으로 굴리는 연금·투자형 상품이 필요해요.',pv:'지금의 목돈을 연금으로 바꾸면 미래의 안정적 현금흐름을 만들 수 있어요.',saving:'예적금 이자는 15.4% 과세돼요. 10년 이상 비과세 저축성보험과 비교해 보세요.',irp:'세액공제 한도를 다 채우면 연 최대 약 148만원 환급. 추가 납입을 검토해 보세요.',pensiontax:'일시금보다 연금으로 나눠 받으면 세금이 보통 더 적어요.',needins:'이 금액은 종신·정기보험으로 준비해요. 가입은 나이가 빠를수록 보험료가 유리해요.',medself:'실손이 못 메우는 비급여·간병비는 별도 특약으로 보완할 수 있어요.',lifecmp:'평생 보장이면 종신, 특정 기간만이면 정기가 유리해요. 목적에 맞게 설계할 수 있어요.',retiretax:'퇴직금을 IRP로 받으면 퇴직소득세를 이연·절감할 수 있어요.',inherit:'상속세 재원을 종신보험으로 미리 마련하면 자녀가 세금 때문에 자산을 처분하지 않아도 돼요.',gift:'미리 나눠 증여하면 세금을 줄일 수 있어요. 증여 자금을 보험으로 설계하는 방법도 있어요.',giftcmp:'증여·상속 시점과 방법에 따라 세금 차이가 커요. 종신보험으로 재원을 준비할 수 있어요.',transfer:'양도 시점·보유 방식에 따라 세금이 크게 달라요. 전문가 상담으로 절세 전략을 잡으세요.',salary:'남는 가처분소득 일부를 연금저축으로 옮기면 세액공제까지 받을 수 있어요.',dsr:'무리한 대출보다, 여력 안에서 보험·연금으로 미래를 준비하는 균형이 중요해요.'};
  var curCat='전체',curKey=null,state=null;
  var total=Object.keys(C).length;

  /* ---------- 허브 열기/닫기 ---------- */
  function openHub(){$('chCount').textContent='30초 시뮬레이터 · '+total+'종';$('chOverlay').classList.add('show');$('chOverlay').setAttribute('aria-hidden','false');renderChips();render();}
  function closeHub(){$('chOverlay').classList.remove('show');$('chOverlay').setAttribute('aria-hidden','true');closeSheet();}

  function renderChips(){$('chChips').innerHTML=CATS.map(function(c){return '<button type="button" class="ch-chip'+(c===curCat?' on':'')+'" data-cat="'+c+'">'+c+'</button>';}).join('');}

  function render(){
    var q=($('chQ').value||'').trim();
    var keys=Object.keys(C).filter(function(k){var c=C[k];if(curCat!=='전체'&&c.cat!==curCat)return false;if(q&&(c.nm+c.ds+c.cat).indexOf(q)<0)return false;return true;});
    var byCat={};keys.forEach(function(k){(byCat[C[k].cat]=byCat[C[k].cat]||[]).push(k);});
    var html='';
    (curCat==='전체'?CATS.slice(1):[curCat]).forEach(function(cat){
      if(!byCat[cat])return;
      html+='<div class="ch-gcat">'+cat+'<span class="c">'+byCat[cat].length+'</span></div>';
      byCat[cat].forEach(function(k){var c=C[k],t=TIER[c.tier]||TIER.ok;
        html+='<button type="button" class="ch-cell" data-calc="'+k+'">'+(c.tag?'<span class="tag'+(c.tag==='인기'?' hot':'')+'">'+c.tag+'</span>':'')
          +'<div class="ic">'+c.ic+'</div><div class="nm">'+c.nm+'</div><div class="ds">'+c.ds+'</div>'
          +'<div class="ch-tier '+t[0]+'"><i></i>'+t[1]+'</div></button>';});
    });
    $('chGrid').innerHTML=html||'<div class="ch-empty">검색 결과가 없어요</div>';
  }

  /* ---------- 시트 ---------- */
  function openCalc(k){curKey=k;try{window.jvTrack&&window.jvTrack('card','calc_'+k);}catch(e){}var c=C[k];state={};
    if(c.in)c.in.forEach(function(f){state[f.k]=f.v;});if(c.seg)state[c.seg.k]=c.seg.v;
    $('chSic').textContent=c.ic;$('chSnm').textContent=c.nm;$('chSds').textContent=c.ds;
    buildBody();$('chSheet').classList.add('show');}
  function closeSheet(){$('chSheet').classList.remove('show');}

  function ctaHtml(big){var nm=consultantName();
    return '<div class="ch-cta'+(big?' big':'')+'"><div class="av">'+nm.charAt(0)+'</div>'
      +'<div class="tx"><b>'+(big?'정확한 진단은 상담으로 확인하세요':'이 결과, 내게 맞는지 상담받기')+'</b><span>'+nm+' · 무료 재무진단</span></div>'
      +'<button type="button" id="chConsult">재무상담 신청</button></div>';}

  function buildBody(){
    var c=C[curKey],h='';
    if(c.only){
      h+='<div class="ch-warn"><b>⚠️ 참고용 안내</b><br>'+c.onlyText+'</div>';
      if(TIPS[curKey])h+='<div class="ch-tip">\ud83d\udca1 <b>\ubcf4\ud5d8\u00b7\uc5f0\uae08 \uc194\ub8e8\uc158</b> '+TIPS[curKey]+'</div>';h+='<div class="ch-only">'+ctaHtml(true)+'</div>';
      h+='<div class="ch-disc">※ 본 항목은 계산 대신 전문가 상담을 권장합니다.</div>';
      $('chSbody').innerHTML=h;bindConsult();return;
    }
    if(c.tier==='rf')h+='<div class="ch-warn"><b>⚠️ 참고용 추정입니다.</b> 공제·감면·보유기간 등 조건에 따라 실제 금액은 크게 달라질 수 있어, 반드시 전문가 상담으로 확인하세요.</div>';
    h+='<div class="ch-res" id="chRes"></div>';if(TIPS[curKey])h+='<div class="ch-tip">\ud83d\udca1 <b>\ubcf4\ud5d8\u00b7\uc5f0\uae08 \uc194\ub8e8\uc158</b> '+TIPS[curKey]+'</div>';
    if(c.seg)h+='<div class="ch-seg" id="chSeg">'+c.seg.opt.map(function(o,i){return '<button type="button" data-seg="'+i+'" class="'+(state[c.seg.k]===i?'on':'')+'">'+o+'</button>';}).join('')+'</div>';
    c.in.forEach(function(f){
      var mode=f.dec?'decimal':'numeric';
      var disp=f.dec?state[f.k]:comma(state[f.k]);
      h+='<div class="ch-field"><div class="ch-lab"><span class="nm">'+f.nm+'</span>'
        +'<span class="vw"><input type="text" inputmode="'+mode+'" data-fld="'+f.k+'" value="'+disp+'"><span class="u">'+f.u+'</span></span></div>'
        +'<div class="ch-rngrow"><button type="button" class="ch-step" data-stepk="'+f.k+'" data-dir="-1">−</button>'+'<input type="range" data-rng="'+f.k+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'" value="'+state[f.k]+'">'+'<button type="button" class="ch-step" data-stepk="'+f.k+'" data-dir="1">＋</button></div></div>';
    });
    h+=(c.tier==='ap'?ctaHtml(false):c.tier==='rf'?ctaHtml(true):ctaHtml(false));
    h+='<div class="ch-disc">'+(c.tier==='ok'?'※ 간이 추정치입니다. 정확한 진단은 상담으로 확인하세요.':'※ 약식 계산으로 실제 값과 다를 수 있습니다. 정확한 금액은 상담으로 확인하세요.')+'</div>';
    $('chSbody').innerHTML=h;
    bindInputs();bindConsult();calc();
  }

  function bindInputs(){
    var c=C[curKey];
    // 세그먼트
    var seg=$('chSeg');
    if(seg)Array.prototype.forEach.call(seg.querySelectorAll('button'),function(b){b.addEventListener('click',function(){state[c.seg.k]=parseInt(b.getAttribute('data-seg'),10);Array.prototype.forEach.call(seg.querySelectorAll('button'),function(x){x.classList.remove('on');});b.classList.add('on');calc();});});
    // 슬라이더
    Array.prototype.forEach.call($('chSbody').querySelectorAll('[data-rng]'),function(r){
      r.addEventListener('input',function(){var k=r.getAttribute('data-rng'),f=fOf(k);state[k]=parseFloat(r.value);
        var inp=$('chSbody').querySelector('[data-fld="'+k+'"]');if(inp)inp.value=f.dec?state[k]:comma(state[k]);calc();});
    });
    Array.prototype.forEach.call($('chSbody').querySelectorAll('.ch-step'),function(b){
      var k=b.getAttribute('data-stepk'),dir=parseInt(b.getAttribute('data-dir'),10),hold=null,to=null;
      function step(){var f=fOf(k),st=f.step||1,nv=state[k]+dir*st;if(nv<f.min)nv=f.min;if(nv>f.max)nv=f.max;nv=parseFloat((Math.round(nv/st)*st).toFixed(4));state[k]=nv;var rng=$('chSbody').querySelector('[data-rng="'+k+'"]');if(rng)rng.value=nv;var inp=$('chSbody').querySelector('[data-fld="'+k+'"]');if(inp)inp.value=f.dec?nv:comma(nv);calc();}
      function start(e){e.preventDefault();step();to=setTimeout(function(){hold=setInterval(step,90);},400);}
      function stop(){clearTimeout(to);clearInterval(hold);hold=null;}
      b.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(function(ev){b.addEventListener(ev,stop);});
    });
    // 숫자 입력 (콤마/숫자전용/엔터이동)
    var flds=Array.prototype.slice.call($('chSbody').querySelectorAll('[data-fld]'));
    flds.forEach(function(inp,idx){
      var k=inp.getAttribute('data-fld'),f=fOf(k);
      inp.addEventListener('input',function(){
        var raw=inp.value;
        if(f.dec){raw=raw.replace(/[^\d.]/g,'');var p=raw.split('.');if(p.length>2)raw=p[0]+'.'+p.slice(1).join('');inp.value=raw;}
        else{raw=raw.replace(/[^\d]/g,'');inp.value=raw?parseInt(raw,10).toLocaleString():'';}
        var num=parseFloat(raw.replace(/,/g,''));if(isNaN(num))return;
        state[k]=num;var rng=$('chSbody').querySelector('[data-rng="'+k+'"]');if(rng)rng.value=num;calc();
      });
      inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var nx=flds[idx+1];if(nx){nx.focus();var val=nx.value;nx.value='';nx.value=val;}else{inp.blur();}}});
      inp.addEventListener('blur',function(){var k2=inp.getAttribute('data-fld'),f2=fOf(k2),mn=f2.min,mx=f2.max;var n=parseFloat((''+inp.value).replace(/,/g,''));if(isNaN(n))n=f2.v;if(n<mn)n=mn;if(n>mx)n=mx;state[k2]=n;inp.value=f2.dec?n:comma(n);var rng=$('chSbody').querySelector('[data-rng="'+k2+'"]');if(rng)rng.value=n;calc();});
    });
  }
  function fOf(k){var c=C[curKey];for(var i=0;i<c.in.length;i++)if(c.in[i].k===k)return c.in[i];return{};}

  function calc(){
    var c=C[curKey],o=c.fn(state);
    var rv=o.plain?(o.fix!=null?Number(o.main).toFixed(o.fix):Math.round(o.main).toLocaleString()):won(o.main);
    var bars=o.bars||[.3,.5,.7,.85,1],mx=Math.max.apply(null,bars)||1;
    var bh=bars.map(function(b,i){return '<i class="'+(i%2?'alt':'')+'" style="height:'+Math.max(8,b/mx*100)+'%"></i>';}).join('');
    var badge=c.tier==='ap'?'<span class="badge ap">약식 계산</span>':c.tier==='rf'?'<span class="badge rf">참고용 추정</span>':'';
    $('chRes').innerHTML=badge+'<div class="rl">'+o.ml+'</div><div class="rv">'+rv+'<span class="u">'+o.u+'</span></div><div class="ru"></div>'
      +'<div class="subs">'+o.subs.map(function(s){return '<div><div class="k">'+s[0]+'</div><div class="v">'+s[1]+'</div></div>';}).join('')+'</div>'
      +'<div class="ch-bars">'+bh+'</div>';
  }

  function bindConsult(){var b=$('chConsult');if(b)b.addEventListener('click',consult);}
  function consult(){
    var c=C[curKey]||{},tags=c.ct||CT_BY_CAT[c.cat]||[];
    closeHub();
    if(typeof window.cdOpenDiag==='function')window.cdOpenDiag();   /* ★ 신청서 오버레이 즉시 오픈 + 폼 이벤트 바인딩 (2026-09-14) */
    tags.forEach(function(t){var b=document.querySelector('#formFieldGroup .chipBtn[data-val="'+t+'"]');if(b&&!b.classList.contains('on'))b.click();});
  }

  /* ---------- 이벤트 위임 ---------- */
  function bind(){
    var btn=$('calcHubBtn');if(btn)btn.addEventListener('click',openHub);var bc=$('barCalcBtn');if(bc)bc.addEventListener('click',openHub);
    var bk=$('chBack');if(bk)bk.addEventListener('click',closeHub);
    var mb=$('chMain');if(mb)mb.addEventListener('click',function(){closeHub();try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){window.scrollTo(0,0);}});
    var q=$('chQ');if(q)q.addEventListener('input',render);
    var chips=$('chChips');if(chips)chips.addEventListener('click',function(e){var b=e.target.closest('[data-cat]');if(!b)return;curCat=b.getAttribute('data-cat');renderChips();render();});
    var grid=$('chGrid');if(grid)grid.addEventListener('click',function(e){var b=e.target.closest('[data-calc]');if(!b)return;openCalc(b.getAttribute('data-calc'));});
    var dim=$('chDim');if(dim)dim.addEventListener('click',closeSheet);
    var sx=$('chSx');if(sx)sx.addEventListener('click',closeSheet);
  }
  try{window.dcOpenCalc=function(k){if(C[k])openCalc(k);};}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();

try{window.CH_NAMES={};for(var _k in C)window.CH_NAMES[_k]=C[_k].nm;}catch(e){}

