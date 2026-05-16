/* ═══════════════════════════════════════════════════════════════
   calendarData.js — JARVIA FC 채널 일정·이벤트 데이터
   ─────────────────────────────────────────────────────────────
   • 정기 일정 (recurring): 매년 반복되는 핵심 15건
   • 수시 체크 (checklist): 인생 이벤트 영업 트리거 6건
   • 시즌 이슈 (seasonalIssues): Firestore 컬렉션 별도 (이 파일에는 없음)
   ─────────────────────────────────────────────────────────────
   target: ['personal'] | ['corporate'] | ['both']
   category: 'tax' | 'finance' | 'life'
   ═══════════════════════════════════════════════════════════════ */
window.CALENDAR_DATA={
  recurring:[
    /* ── 세무 11건 ── */
    {id:'r-01', month:1,  day:25, name:'부가가치세 2기 확정신고',  deadline:'1.25',  desc:'전년 7~12월분, 모든 사업자',         target:['both'],      category:'tax'},
    {id:'r-02', month:3,  day:31, name:'법인세 신고·납부',         deadline:'3.31',  desc:'12월 결산법인',                       target:['corporate'], category:'tax'},
    {id:'r-03', month:4,  day:25, name:'부가세 1기 예정신고',      deadline:'4.25',  desc:'법인사업자',                          target:['corporate'], category:'tax'},
    {id:'r-04', month:5,  day:31, name:'종합소득세 신고·납부',     deadline:'5.31',  desc:'개인사업자·프리랜서·임대소득자',      target:['personal'],  category:'tax'},
    {id:'r-05', month:5,  day:31, name:'양도소득세 확정신고',      deadline:'5.31',  desc:'전년도 양도분 합산',                  target:['personal'],  category:'tax'},
    {id:'r-06', month:7,  day:31, name:'재산세 주택 1기분',        deadline:'7.31',  desc:'주택분 1/2 + 건물분 전액 (납부기간 7.16~7.31)', target:['personal'],  category:'tax'},
    {id:'r-07', month:7,  day:25, name:'부가세 1기 확정신고',      deadline:'7.25',  desc:'1~6월분, 모든 사업자',                target:['both'],      category:'tax'},
    {id:'r-08', month:8,  day:31, name:'법인세 중간예납',          deadline:'8.31',  desc:'전년 산출세액의 1/2',                 target:['corporate'], category:'tax'},
    {id:'r-09', month:9,  day:30, name:'재산세 주택 2기분',        deadline:'9.30',  desc:'주택분 나머지 1/2',                   target:['personal'],  category:'tax'},
    {id:'r-10', month:10, day:25, name:'부가세 2기 예정신고',      deadline:'10.25', desc:'법인사업자',                          target:['corporate'], category:'tax'},
    {id:'r-11', month:12, day:15, name:'종합부동산세 납부',        deadline:'12.15', desc:'12.1~12.15',                          target:['personal'],  category:'tax'},
    /* ── 금융 3건 ── */
    {id:'r-12', month:1,  day:31, name:'자동차세 연납 할인',       deadline:'1.31',  desc:'1월 일시납부 시 약 9% 할인',          target:['both'],      category:'finance'},
    {id:'r-13', month:12, day:31, name:'연금저축·IRP 한도 마감',   deadline:'12.31', desc:'합산 900만원 세액공제 한도',          target:['personal'],  category:'finance'},
    {id:'r-14', month:12, day:31, name:'ISA 납입한도 마감',        deadline:'12.31', desc:'연 2,000만원 납입 한도',              target:['personal'],  category:'finance'},
    /* ── 생애 1건 ── */
    {id:'r-15', month:11, day:30, name:'건강보험 피부양자 자격 점검', deadline:'11월', desc:'매년 11월 소득·재산 기준 재산정',   target:['personal'],  category:'life'}
  ],
  checklist:[
    {
      id:'c-01', icon:'🏠', title:'이사·주택매매',
      deadlines:[
        {name:'취득세 신고·납부', when:'취득일 60일 이내', urgent:true,  highlight:true},
        {name:'주택임대차 신고',  when:'계약일 30일 이내', urgent:true,  highlight:false},
        {name:'1세대1주택 비과세 점검', when:'양도 전 검토', urgent:false, highlight:false}
      ],
      cta:'real_estate',
      ctaLabel:'부동산·세무 컨설팅 받기'
    },
    {
      id:'c-02', icon:'💼', title:'이직·퇴직',
      deadlines:[
        {name:'IRP 이전',         when:'퇴직 후 60일 이내', urgent:true,  highlight:true},
        {name:'퇴직소득세 정산',  when:'지급 시점',         urgent:true,  highlight:false},
        {name:'4대보험 자격 변동', when:'14일 이내',        urgent:false, highlight:false}
      ],
      cta:'retirement,salary',
      ctaLabel:'퇴직금·재무 설계 받기'
    },
    {
      id:'c-03', icon:'💍', title:'결혼·출산',
      deadlines:[
        {name:'결혼자금 증여공제 1억',     when:'혼인신고일 ±2년 이내', urgent:false, highlight:true},
        {name:'부모급여·아동수당 신청',    when:'출생 1년 이내',         urgent:false, highlight:false},
        {name:'자녀 청약통장·증여 설계',   when:'출생 후 즉시',          urgent:false, highlight:false}
      ],
      cta:'inheritance,salary',
      ctaLabel:'신혼·가족 재무 컨설팅'
    },
    {
      id:'c-04', icon:'⚰️', title:'가족 사망 (상속 발생)',
      deadlines:[
        {name:'상속세 신고·납부', when:'사망일 속한 달 말일 + 6개월', urgent:true, highlight:true},
        {name:'보험금 청구',      when:'시효 3년 이내',                urgent:true, highlight:false},
        {name:'가족관계·재산 정리', when:'상속 전 검토',                urgent:false, highlight:false}
      ],
      cta:'inheritance',
      ctaLabel:'상속 종합 컨설팅 받기'
    },
    {
      id:'c-05', icon:'💝', title:'증여 발생',
      deadlines:[
        {name:'증여세 신고·납부',          when:'증여일 속한 달 말일 + 3개월', urgent:true,  highlight:true},
        {name:'10년 합산과세 점검',        when:'증여 전 검토',                urgent:false, highlight:false},
        {name:'창업·혼인 증여공제 활용',   when:'사전 설계 필수',              urgent:false, highlight:false}
      ],
      cta:'inheritance',
      ctaLabel:'증여 설계 컨설팅'
    },
    {
      id:'c-06', icon:'🏥', title:'중대질병 진단',
      deadlines:[
        {name:'보험금 청구',         when:'진단일 이후 즉시',      urgent:true,  highlight:true},
        {name:'장해등급 판정',       when:'치료 후 6개월~',        urgent:false, highlight:false},
        {name:'세무·자산 정리 검토', when:'장기 입원·치료 시',     urgent:false, highlight:false}
      ],
      cta:'insurance',
      ctaLabel:'보험금 청구 지원 + 자산 설계'
    }
  ]
};
