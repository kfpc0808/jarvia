/* ═══════════════════════════════════════════════════════════════
   jv-interest-q.js — 「오늘의 질문」 공용 파일              ★ 2026-10-21
   ---------------------------------------------------------------
   쓰는 곳 : client-daily.html · consensus.html (고객 화면 — 질문·상담 제안)
             index.html (회원 화면 — 질문 목록·열람현황 표시·첫 통화 한마디)
   질문을 고칠 때는 이 파일 하나만 바꾼다. 세 화면이 같은 목록을 쓴다.

   ▣ 문항 형식  [키, 신호, 질문, 보기, (계절)]
     · 키   : 분야 글자 + 두 자리 번호 (P01 …). 서버 저장 키이므로 한 번 쓴 키는 바꾸지 않는다.
              문항을 빼면 키를 비워 두고, 새 문항은 다음 번호를 쓴다.
     · 신호 : 같은 내용을 다르게 묻는 문항끼리 묶는 이름 — 회원 화면에서 신호별로 모아 보여 준다.
     · 보기 : '|' 로 구분. 끝에 '*' 가 붙은 보기 = 상담 신호(🔥)
     · 계절 : '10~12월' — 이 기간에 먼저 낸다(연금계좌 세액공제 시즌)

   ▣ 노출 규칙 (pick)
     · 고객 1명당 하루 1문항 — 데일리·컨센서스 공통(서버가 최종 판정)
     · 10일 순환: 연금→보험→생활변화→연금→보험→세금→연금→보험→상속→(자녀·사업·상담 교대)
     · 같은 신호는 21일 안에 다시 묻지 않는다(남은 문항이 그것뿐이면 예외)
     · C01 「아니다」(사업 안 함) → 사업 문항 생략 / 자녀 문항에서 「자녀 없음」 → 자녀 문항 생략
   ═══════════════════════════════════════════════════════════════ */
(function(){
"use strict";
var VER='iq-1';          /* 문항 목록 버전 — 서버 기록용 */
var NOTICE='view-2';     /* 동의 문구 버전 — 「질문에 고른 답」 전달이 들어간 문구 */

var CATS={
  P:['연금·노후','연금'], B:['보험·보장','보장'], L:['생활 변화','변화'], T:['세금·공제','세금'],
  S:['상속·증여','상속'], K:['자녀','자녀'], C:['사업·법인','법인'], R:['상담 방식','상담']
};
var CAT_ORDER=['P','B','L','T','S','K','C','R'];
var CYCLE=['P','B','L','P','B','T','P','B','S','X'];   /* X = 자녀·사업·상담 교대 */
var X_ROT=['K','C','R'];

var Q=[
  ["P01", "노후 준비도", "노후자금은 어느 정도 준비하셨나요?", "100%|70% 이상|50% 정도|30% 이하*|잘 모르겠어요*"],
  ["P02", "노후 준비도", "지금 은퇴한다면 모아둔 돈으로 몇 년을 버틸 수 있을 것 같으세요?", "20년 이상|10~20년|5~10년*|5년 미만*|생각해 본 적 없어요*"],
  ["P03", "노후 준비도", "내 노후 준비에 점수를 매긴다면?", "90점 이상|70점대|50점대*|30점 이하*"],
  ["P04", "노후 준비도", "비슷한 나이의 지인과 비교하면 내 노후 준비는?", "앞서 있다|비슷하다|뒤처진 것 같다*|비교해 본 적 없다*"],
  ["P05", "노후 준비도", "노후 준비에서 가장 막막한 것은 무엇인가요?", "얼마가 필요한지 모름*|어디서 시작할지 모름*|여윳돈이 없음|막막한 것 없음"],
  ["P06", "노후 준비도", "노후 준비, 언제부터 본격적으로 하실 생각이세요?", "이미 하고 있다|올해 안에*|1~2년 안에*|아직 생각 없다"],
  ["P07", "은퇴 시점", "은퇴까지 남은 기간은 어느 정도인가요?", "이미 은퇴|5년 이내*|5~10년*|10~20년|20년 이상"],
  ["P08", "은퇴 시점", "몇 살까지 일하고 싶으세요?", "55세 전|60세 전후*|65세 전후|70세 이후|잘 모르겠다"],
  ["P09", "은퇴 시점", "정년(또는 사업 정리) 시점을 정해 두셨나요?", "정확히 정했다*|대략 정했다*|아직 미정|해당 없음"],
  ["P10", "은퇴 시점", "은퇴 후에도 일을 계속하실 생각인가요?", "전업으로 계속|파트타임 정도|완전히 쉬고 싶다*|아직 모르겠다"],
  ["P11", "개인연금 보유", "국민연금 말고 따로 준비한 연금이 있나요?", "2개 이상|1개|없음*|잘 모름*"],
  ["P12", "개인연금 보유", "가진 연금을 모두 합치면 매달 얼마쯤 받을지 알고 계세요?", "정확히 안다|대략 안다|전혀 모른다*"],
  ["P13", "개인연금 보유", "연금보험·연금저축·IRP 중 몇 가지를 가지고 계세요?", "세 가지 모두|1~2가지|하나도 없음*|뭐가 뭔지 모름*"],
  ["P14", "개인연금 보유", "예전에 가입한 연금, 마지막으로 확인한 게 언제인가요?", "1년 이내|1~3년 전*|가입 후 본 적 없음*|연금 없음*"],
  ["P15", "세액공제 활용", "올해 연금저축·IRP 세액공제 한도를 얼마나 채우셨나요?", "다 채웠다|일부*|전혀*|잘 모름*", "10~12월"],
  ["P16", "세액공제 활용", "연말정산 때 연금계좌로 세금을 돌려받고 계세요?", "매년 받는다|가끔|받은 적 없다*|처음 듣는다*", "10~12월"],
  ["P17", "세액공제 활용", "12월 31일까지 연금계좌에 넣으면 올해 세액공제를 받는다는 것, 알고 계셨나요?", "이미 하고 있다|알지만 안 했다*|몰랐다*|소득 없음", "10~12월"],
  ["P18", "세액공제 활용", "올해 연말정산 환급액을 작년보다 늘리고 싶으세요?", "꼭 늘리고 싶다*|늘면 좋다*|지금도 충분|연말정산 대상 아님", "10~12월"],
  ["P19", "세액공제 활용", "연금계좌로 1년에 최대 얼마까지 세금을 돌려받을 수 있는지 아세요?", "정확히 안다|대충 안다*|모른다*"],
  ["P20", "세액공제 활용", "종합소득세 신고 때 연금저축 공제를 챙기세요?", "챙긴다|놓친 적 있다*|몰랐다*|신고 대상 아님"],
  ["P21", "퇴직금·IRP", "회사 퇴직연금은 어떤 형태인가요?", "DB형|DC형*|잘 모름*|해당 없음"],
  ["P22", "퇴직금·IRP", "퇴직금을 받으면 어떻게 하실 생각이세요?", "연금으로 나눠 받기*|한 번에 받아 굴리기*|대출 상환 등에 사용|아직 모르겠다*"],
  ["P23", "퇴직금·IRP", "퇴직금을 연금으로 받으면 퇴직소득세가 30~40% 줄어든다는 것, 알고 계셨나요?", "알고 있다|몰랐다*|해당 없음"],
  ["P24", "퇴직금·IRP", "회사 퇴직연금 계좌의 수익률을 확인해 보셨나요?", "자주 확인|가끔|한 번도 안 봄*|해당 없음"],
  ["P25", "퇴직금·IRP", "IRP 계좌를 가지고 계세요?", "있고 꾸준히 넣는다|있지만 비어 있다*|없다*|IRP가 뭔지 모른다*"],
  ["P26", "노후 생활비", "은퇴 후 한 달 생활비는 얼마면 될 것 같으세요?", "200만 원 미만|200~300만 원|300만 원 이상*|계산해 본 적 없음*"],
  ["P27", "노후 생활비", "은퇴 후 생활비 가운데 연금으로 채워지는 몫은 어느 정도일까요?", "절반 이상|절반 정도|3분의 1 이하*|모르겠다*"],
  ["P28", "노후 생활비", "은퇴 후 가장 걱정되는 지출은?", "의료·간병비*|생활비*|자녀 지원|여행·여가|특별히 없음"],
  ["P29", "노후 생활비", "노후에 매달 월급처럼 들어오는 돈이 얼마면 안심이 되세요?", "100만 원|200만 원|300만 원 이상|생각해 본 적 없음*"],
  ["P30", "노후 생활비", "은퇴 후 생활비가 바닥날까 걱정되시나요?", "많이 걱정된다*|조금 걱정된다*|걱정 없다"],
  ["P31", "국민연금 인지", "내 국민연금 예상 수령액을 확인해 보셨나요?", "최근 확인|오래전에|확인한 적 없음*"],
  ["P32", "국민연금 인지", "국민연금을 몇 살부터 받을 수 있는지 아세요?", "정확히 안다|대충 안다|모른다*"],
  ["P33", "국민연금 인지", "국민연금만으로 노후 생활이 가능하다고 보세요?", "충분하다|반 정도|턱없이 부족하다*|모르겠다*"],
  ["P34", "국민연금 인지", "배우자도 국민연금이나 개인연금을 받게 되나요?", "둘 다 받는다|한 사람만*|둘 다 없음*|해당 없음"],
  ["P35", "연금 가입 의향", "연금을 새로 들거나 늘릴 생각이 있으세요?", "3개월 이내*|올해 안*|언젠가는|생각 없음"],
  ["P36", "연금 가입 의향", "매달 노후 준비에 더 쓸 수 있는 금액은?", "10만 원 미만|10~30만 원*|30~50만 원*|50만 원 이상*|여유 없음"],
  ["P37", "연금 가입 의향", "연금을 고를 때 가장 중요하게 보는 것은?", "세금 혜택|평생 받는지|수익률|중간에 꺼낼 수 있는지"],
  ["P38", "연금 가입 의향", "평생 받는 종신형과 정해진 기간만 받는 확정형, 어느 쪽이 끌리세요?", "종신형|확정형|차이를 모르겠다*"],
  ["P39", "연금 가입 의향", "「연금은 나중에 들어도 된다」는 말, 어떻게 생각하세요?", "맞다, 아직 이르다|지금 시작해야 한다*|이미 늦은 것 같다*"],
  ["P40", "목돈·만기 자금", "1년 안에 만기가 돌아오는 예금·적금·보험이 있으세요?", "있다*|없다|잘 모름"],
  ["P41", "목돈·만기 자금", "여유 목돈이 생기면 어디에 두실 생각이세요?", "예금|투자|연금으로 묶어두기*|대출 상환|아직 모르겠다*"],
  ["P42", "목돈·만기 자금", "은행 예금에만 넣어 둔 돈, 그대로 두어도 괜찮다고 보세요?", "괜찮다|바꾸고 싶은데 방법을 모른다*|예금이 거의 없다"],
  ["P43", "목돈·만기 자금", "오래 묵히면 이자에 세금이 붙지 않는 저축 방법이 궁금하세요?", "궁금하다*|이미 하고 있다|관심 없다"],
  ["P44", "목돈·만기 자금", "목돈을 한 번에 넣고 다음 달부터 연금으로 받는 방법, 들어보셨어요?", "해 보고 싶다*|들어봤지만 잘 모른다*|관심 없다"],
  ["P45", "연금 수령 설계", "지금 받고 계신 연금이 있나요?", "국민연금만|개인연금도 함께|아직 받기 전|연금 없음*"],
  ["P46", "연금 수령 설계", "연금을 받을 때 세금이 얼마나 붙는지 아세요?", "안다|모른다*|해당 없음"],
  ["P47", "연금 수령 설계", "연금을 언제부터 받기 시작할지 정하셨나요?", "정했다|고민 중*|생각해 본 적 없음*"],
  ["P48", "연금 수령 설계", "부부가 함께 받을 연금을 한 번에 계산해 본 적 있으세요?", "있다|없다*|해당 없음"],
  ["P49", "연금 수령 설계", "은퇴 후 건강보험료가 얼마나 나올지 걱정되시나요?", "걱정된다*|괜찮다|생각해 본 적 없다*"],
  ["P50", "연금 수령 설계", "연금을 받다가 일찍 세상을 떠나면 남은 돈이 가족에게 가는지 아세요?", "안다|모른다*|연금 없음"],
  ["B01", "보험 점검 시기", "보험을 마지막으로 점검받은 게 언제인가요?", "1년 이내|1~3년|3년 이상*|받은 적 없음*"],
  ["B02", "보험 점검 시기", "가진 보험 가운데 가장 오래된 것은 몇 년 되었나요?", "5년 미만|5~10년|10~20년*|20년 이상*|모르겠다*"],
  ["B03", "보험 점검 시기", "보험 증권을 한곳에 모아 정리해 두셨나요?", "다 정리돼 있다|일부만*|어디 있는지 모름*"],
  ["B04", "보험 점검 시기", "결혼·출산·이직 뒤에 보험을 다시 살펴보셨나요?", "그때마다 봤다|한 번도 안 봤다*|해당 사항 없음"],
  ["B05", "보험 정리 계획", "최근 3개월 이내에 보험을 한번 정리할 계획을 갖고 계신가요?", "예*|아니오"],
  ["B06", "보험 정리 계획", "보험 정리는 언제쯤 하면 좋겠다고 생각하세요?", "이번 달*|3개월 안*|올해 안|당분간 생각 없음"],
  ["B07", "보험 정리 계획", "담당 컨설턴트가 가족 보험을 한 장으로 정리해 드린다면 받아보시겠어요?", "받아보겠다*|나중에|필요 없다"],
  ["B08", "보험 정리 계획", "보험에서 가장 바꾸고 싶은 한 가지는?", "보험료 줄이기*|보장 늘리기*|겹친 것 빼기*|바꿀 게 없다"],
  ["B09", "보험료 부담", "매달 내시는 보험료는 어느 정도인가요?", "10만 원 미만|10~30만 원|30~50만 원|50만 원 이상*|잘 모름*"],
  ["B10", "보험료 부담", "가족 보험료를 모두 합치면 한 달에 얼마인지 아세요?", "정확히 안다|대충 안다|모른다*"],
  ["B11", "보험료 부담", "지금 보험료, 생활비에 비해 어떠세요?", "적당하다|조금 부담된다*|많이 부담된다*"],
  ["B12", "보험료 부담", "보험료 납입이 언제 끝나는지 알고 계세요?", "모두 안다|일부만 안다*|모른다*"],
  ["B13", "보험료 부담", "내 보험료가 보장에 비해 적정한지 확인해 보고 싶으세요?", "확인하고 싶다*|괜찮다"],
  ["B14", "갱신 인상", "최근 1년 사이 갱신 때문에 보험료가 오른 적 있나요?", "예*|아니오|잘 모름*"],
  ["B15", "갱신 인상", "가입한 보험 가운데 갱신형이 있는지 아세요?", "있다*|없다|모른다*"],
  ["B16", "갱신 인상", "갱신형은 갱신 때마다 보험료가 다시 정해진다는 것, 알고 계셨나요?", "알고 있다|몰랐다*|갱신형 없음"],
  ["B17", "갱신 인상", "60대·70대에 갱신 보험료가 얼마나 될지 계산해 보셨나요?", "해 봤다|안 해 봤다*|갱신형 없음"],
  ["B18", "진단비 충분성", "암·뇌·심장 진단비가 충분하다고 보세요?", "충분하다|부족한 것 같다*|잘 모르겠다*"],
  ["B19", "진단비 충분성", "암 진단을 받으면 보험에서 얼마가 나오는지 아세요?", "정확히 안다|대략 안다|모른다*"],
  ["B20", "진단비 충분성", "큰 병으로 1~2년 일을 쉬게 되면 생활비는 어떻게 마련하시겠어요?", "저축으로|보험금으로|방법이 없다*|생각해 본 적 없다*"],
  ["B21", "진단비 충분성", "뇌·심장 보장이 특정 질환만 되는지, 더 넓게 되는지 아세요?", "안다|모른다*|해당 보장 없음*"],
  ["B22", "진단비 충분성", "치료비와 별도로, 진단 즉시 받는 목돈이 필요하다고 보세요?", "꼭 필요하다*|실손이면 충분하다|모르겠다*"],
  ["B23", "실손보험", "실손보험은 언제 가입하셨나요?", "2009년 9월 이전|2009~2017년|2017~2021년|2021년 7월 이후|모름*|실손 없음*"],
  ["B24", "실손보험", "최근 실손보험료가 많이 올랐나요?", "많이 올랐다*|조금 올랐다|모르겠다*|실손 없음*"],
  ["B25", "실손보험", "실손보험을 그대로 둘지 전환할지 고민해 보셨나요?", "고민 중*|유지하기로 했다|생각해 본 적 없다*"],
  ["B26", "실손보험", "실손보험만 있으면 다른 보험은 없어도 된다고 생각하세요?", "그렇다*|아니다|잘 모르겠다*"],
  ["B27", "간병·치매", "나중에 간병이 필요해지면 비용은 어떻게 하실 생각이세요?", "보험으로|저축으로|자녀에게 기대야 할 듯*|생각해 본 적 없다*"],
  ["B28", "간병·치매", "간병인을 쓰면 하루 비용이 얼마쯤인지 아세요?", "안다|모른다*"],
  ["B29", "간병·치매", "치매에 대비한 보장을 가지고 계세요?", "있다|없다*|모르겠다*"],
  ["B30", "간병·치매", "부모님 간병비를 누가 어떻게 부담할지 이야기해 보셨나요?", "정해져 있다|이야기 못 했다*|해당 없음"],
  ["B31", "사망보장·가족 책임", "내가 갑자기 없으면 가족이 몇 년을 버틸 수 있을까요?", "10년 이상|3~10년|3년 미만*|생각해 본 적 없다*"],
  ["B32", "사망보장·가족 책임", "남은 대출을 가족이 대신 갚아야 하는 상황, 대비돼 있으세요?", "대비돼 있다|일부만*|안 돼 있다*|대출 없음"],
  ["B33", "사망보장·가족 책임", "내 사망보험금이 얼마인지 알고 계세요?", "안다|대략 안다|모른다*|사망보장 없음*"],
  ["B34", "사망보장·가족 책임", "사망보장은 몇 살까지 되나요?", "평생|80세 이상|60~70세*|모른다*"],
  ["B35", "사망보장·가족 책임", "집안의 생활비는 주로 누가 버나요?", "본인 혼자*|부부 함께|다른 가족|은퇴해서 없음"],
  ["B36", "보장 이해도", "내 보험이 무엇을 보장하는지 한 문장으로 말할 수 있으세요?", "할 수 있다|대충|전혀*"],
  ["B37", "보장 이해도", "가진 보험이 몇 개인지 정확히 아세요?", "안다|대략 안다|모른다*"],
  ["B38", "보장 이해도", "지금 보험은 어떻게 가입하셨나요?", "직접 비교해서|지인 권유*|설계사 권유|기억 안 남*"],
  ["B39", "보장 이해도", "보험 약관이나 보장 내용을 직접 읽어 보신 적 있나요?", "있다|없다*"],
  ["B40", "미청구 보험금", "병원에 다녀오고 보험금을 청구하지 않은 적 있으세요?", "있다*|없다|모르겠다*"],
  ["B41", "미청구 보험금", "보험금은 3년이 지나면 청구할 수 없다는 것, 알고 계셨나요?", "알았다|몰랐다*"],
  ["B42", "미청구 보험금", "금액이 작아서 보험금 청구를 그냥 넘긴 적이 있나요?", "자주*|가끔*|없다"],
  ["B43", "미청구 보험금", "찾아가지 않은 숨은 보험금을 조회해 보신 적 있으세요?", "있다|없다*"],
  ["B44", "해지·유지 고민", "해지할까 고민 중인 보험이 있으세요?", "있다*|없다"],
  ["B45", "해지·유지 고민", "보험을 해지했다가 후회한 적 있으세요?", "있다*|없다|해지한 적 없음"],
  ["B46", "해지·유지 고민", "보험료 내기가 어려울 때 해지 말고 쓸 수 있는 방법, 알고 계세요?", "안다|모른다*"],
  ["B47", "가족 보장 공백", "배우자 보험도 함께 점검해 보셨나요?", "했다|안 했다*|해당 없음"],
  ["B48", "가족 보장 공백", "가족 중 보험이 하나도 없는 사람이 있나요?", "있다*|없다|모르겠다"],
  ["B49", "가족 보장 공백", "부모님의 보험 상황을 알고 계세요?", "잘 안다|조금|모른다*"],
  ["B50", "가족 보장 공백", "가족 보험은 누가 관리하나요?", "내가 관리|각자|아무도 안 함*"],
  ["L01", "1년 내 변화", "앞으로 1년 안에 생길 큰 변화가 있나요?", "결혼*|출산*|이사·집 구입*|퇴직·이직*|없음"],
  ["L02", "결혼", "올해 결혼하셨거나 결혼을 앞두고 계세요?", "예*|아니오"],
  ["L03", "가족 증가", "최근 1년 사이 가족이 늘었나요?", "예*|곧 예정*|아니오"],
  ["L04", "주택", "집을 사거나 옮길 계획이 있으세요?", "6개월 안*|1~2년 안|계획 없음"],
  ["L05", "대출", "최근 대출을 새로 받으셨거나 받을 예정인가요?", "받았다*|예정*|아니다"],
  ["L06", "이직·퇴직", "최근 직장을 옮기셨거나 옮길 예정인가요?", "옮겼다*|예정*|아니다"],
  ["L07", "이직·퇴직", "회사를 그만두면 회사 단체보험도 끝난다는 것, 알고 계세요?", "알고 대비했다|알지만 대비 못 했다*|몰랐다*|단체보험 없음"],
  ["L08", "소득 변화", "최근 소득에 변화가 있었나요?", "늘었다*|비슷하다|줄었다*"],
  ["L09", "목돈 유입", "올해 목돈이 들어올 일이 있으세요? (성과급·만기·매각 등)", "있다*|없다"],
  ["L10", "자녀 독립", "자녀가 독립했거나 곧 독립하나요?", "했다*|몇 년 안에*|아직 멀었다|자녀 없음"],
  ["L11", "은퇴 후 거주", "은퇴 후 이사(지방·전원)를 생각하고 계세요?", "계획 있다|고민 중|없다"],
  ["L12", "부모 부양", "부모님을 모시거나 경제적으로 돕고 계세요?", "모시고 있다*|생활비를 돕는다*|아니다"],
  ["L13", "외벌이 전환", "맞벌이에서 외벌이가 되었거나 될 예정인가요?", "예*|아니오|해당 없음"],
  ["L14", "창업", "사업이나 부업을 시작하셨나요?", "최근 시작*|준비 중*|아니다"],
  ["L15", "올해 돈 고민", "올해 가장 큰 돈 고민은 무엇인가요?", "노후*|보험료*|자녀 교육|집|대출"],
  ["L16", "재무 전망", "1년 뒤 내 재무 상태, 지금보다 나아질 것 같으세요?", "나아진다|비슷하다|나빠질 것 같다*|모르겠다"],
  ["L17", "가족 대화", "가족과 노후·보험 이야기를 터놓고 해 보셨나요?", "자주|가끔|한 번도*"],
  ["L18", "계기", "주변 일을 보며 보험을 다시 생각하게 된 적이 최근 있으세요?", "있다*|없다"],
  ["L19", "배우자 은퇴", "배우자의 은퇴는 언제쯤인가요?", "이미 은퇴|5년 이내*|5년 이후|해당 없음"],
  ["L20", "우선 과제", "지금 가장 먼저 정리하고 싶은 돈 문제는?", "보험*|연금·노후*|세금|대출|없음"],
  ["T01", "연말정산", "작년 연말정산 결과는 어땠나요?", "돌려받았다|더 냈다*|잘 모름*|대상 아님", "10~12월"],
  ["T02", "연말정산", "연말정산에서 놓치는 공제가 있을까 걱정되세요?", "그렇다*|아니다", "10~12월"],
  ["T03", "연말정산", "보장성 보험료도 연말정산 공제가 된다는 것, 알고 계세요?", "안다|몰랐다*", "10~12월"],
  ["T04", "종합소득세", "종합소득세 신고는 어떻게 하세요?", "직접 한다*|세무사가 한다|대상 아님"],
  ["T05", "금융소득", "이자·배당이 1년에 2,000만 원을 넘을까 신경 쓰이세요?", "넘는다*|근접했다*|해당 없음"],
  ["T06", "금융소득", "이자에 붙는 세금(15.4%)을 줄이는 방법이 궁금하세요?", "궁금하다*|이미 활용 중|관심 없다"],
  ["T07", "연금 세제", "연금계좌에서 연금으로 받으면 세율이 3.3~5.5%로 낮다는 것, 알고 계셨나요?", "알았다|몰랐다*"],
  ["T08", "연말정산", "올해 남은 기간에 세금 혜택을 더 챙기고 싶으세요?", "그렇다*|아니다", "10~12월"],
  ["T09", "ISA", "ISA 계좌를 가지고 계세요?", "있다|없다|곧 만기*"],
  ["T10", "ISA", "ISA 만기 자금을 연금계좌로 옮기면 세액공제를 더 받는다는 것, 아세요?", "안다|몰랐다*|ISA 없음"],
  ["T11", "건강보험료", "지금 내는 건강보험료가 부담되시나요?", "그렇다*|괜찮다"],
  ["T12", "건강보험료", "은퇴 후 피부양자 자격을 유지할 수 있을지 확인해 보셨나요?", "했다|안 했다*|해당 없음"],
  ["T13", "명의 설계", "부부 중 누구 명의로 연금·보험을 드는 게 유리한지 따져 보셨나요?", "해 봤다|안 해 봤다*"],
  ["T14", "세금 누수", "세금 때문에 놓치고 있는 돈이 있다고 느끼세요?", "그렇다*|아니다|모르겠다*"],
  ["T15", "연말정산", "올해 연말정산 환급액을 미리 계산해 보고 싶으세요?", "그렇다*|괜찮다", "10~12월"],
  ["S01", "상속 시점", "상속이나 증여가 언제쯤 현실적인 일이라고 보세요?", "이미 진행 중*|5년 안*|10년 이상 뒤|해당 없음"],
  ["S02", "상속세 규모", "상속세가 나올 만큼 재산이 있다고 보세요?", "그렇다*|아닐 것 같다|모르겠다*"],
  ["S03", "납부 재원", "상속세를 낼 현금이 따로 준비돼 있나요?", "있다|없다*|생각해 본 적 없다*"],
  ["S04", "납부 재원", "재산 대부분이 부동산이라 상속 때 현금이 걱정되세요?", "그렇다*|아니다"],
  ["S05", "납부 재원", "사망보험금으로 상속세를 준비하는 방법, 들어보셨어요?", "알아보고 싶다*|들어만 봤다*|관심 없다"],
  ["S06", "사전 증여", "10년마다 증여세 없이 줄 수 있는 금액이 있다는 것, 아세요?", "활용 중|알지만 안 했다*|몰랐다*"],
  ["S07", "사전 증여", "자녀에게 재산을 미리 나눠 줄 생각이 있으세요?", "있다*|고민 중*|없다"],
  ["S08", "재산 공유", "가족이 내 보험·예금 내역을 다 알고 있나요?", "안다|일부만*|모른다*"],
  ["S09", "분쟁 우려", "상속 문제로 가족이 다툴까 걱정되세요?", "걱정된다*|아니다"],
  ["S10", "받을 상속", "부모님께 받을 상속을 미리 준비하고 계세요?", "준비 중|못 하고 있다*|해당 없음"],
  ["S11", "계약 구조", "보험의 계약자와 수익자를 누구로 해 두었는지 아세요?", "안다|모른다*"],
  ["S12", "계약 구조", "사망보험금도 상속세 대상이 될 수 있다는 것, 알고 계셨나요?", "알았다|몰랐다*"],
  ["S13", "세대 생략", "손주에게 직접 물려주는 방법에 관심 있으세요?", "있다*|없다"],
  ["S14", "상속 계획", "유언장이나 상속 계획을 정리해 두셨나요?", "했다|안 했다*"],
  ["S15", "상속세 규모", "상속·증여 세금을 미리 한번 계산해 보고 싶으세요?", "그렇다*|나중에|필요 없다"],
  ["K01", "자녀 보험", "자녀 보험은 언제 마지막으로 살펴보셨나요?", "1년 이내|3년 이상*|자녀 보험 없음*|자녀 없음"],
  ["K02", "자녀 보험", "자녀 보험이 몇 살까지 보장되는지 아세요?", "안다|모른다*|해당 없음"],
  ["K03", "자녀 보험", "태아보험이나 어린이보험을 알아볼 계획이 있으세요?", "있다*|없다|해당 없음"],
  ["K04", "교육비 vs 노후", "자녀 교육비와 노후 준비 중 어디에 더 쓰고 계세요?", "교육비*|비슷하다|노후|자녀 없음"],
  ["K05", "자녀 자금", "자녀 명의로 모아 주는 돈이 있으세요?", "있다|없다*|해당 없음"],
  ["K06", "자녀 자금", "자녀 결혼·독립 자금을 얼마나 지원할 생각이세요?", "많이*|조금|안 한다|해당 없음"],
  ["K07", "계약 이전", "자녀가 성인이 되면 보험을 자녀 앞으로 넘겨줄 생각이 있으세요?", "있다*|없다|생각해 본 적 없다*"],
  ["K08", "사회초년생", "사회초년생 자녀의 첫 보험·연금을 챙겨 주고 싶으세요?", "그렇다*|아니다|해당 없음"],
  ["K09", "부양 기대", "자녀가 나중에 내 노후를 도와줄 거라 기대하세요?", "기대한다*|기대하지 않는다|모르겠다"],
  ["K10", "자녀 자금", "자녀에게 준 돈을 연금이나 장기 저축으로 불려 주고 싶으세요?", "그렇다*|아니다|해당 없음"],
  ["C01", "사업 여부", "지금 사업을 하고 계세요?", "법인 대표*|개인사업자*|아니다"],
  ["C02", "CEO 퇴직금", "대표님 본인 퇴직금이 회사에서 준비되고 있나요?", "되고 있다|안 되고 있다*|모르겠다*"],
  ["C03", "경영인 보장", "대표님 유고 시 회사가 버틸 장치가 있나요?", "있다|없다*"],
  ["C04", "경영인 보장", "법인 자금으로 대표 보장을 준비하는 방법에 관심 있으세요?", "있다*|없다"],
  ["C05", "가지급금", "회사에 가지급금이 있나요?", "있다*|없다|모르겠다*"],
  ["C06", "이익 인출", "회사 이익을 급여·배당·퇴직금으로 가져오는 방법을 정리해 보셨나요?", "했다|안 했다*"],
  ["C07", "직원 퇴직연금", "직원 퇴직연금은 어떻게 준비하고 계세요?", "DB형|DC형|아직 미가입*|직원 없음"],
  ["C08", "가업 승계", "사업을 자녀에게 물려줄 생각이 있으세요?", "있다*|고민 중*|없다"],
  ["C09", "노란우산", "(개인사업자) 노란우산공제에 가입하셨나요?", "가입|미가입*|모른다*|해당 없음"],
  ["C10", "종합 점검", "사업 관련 세금과 보험을 한 번에 점검받고 싶으세요?", "그렇다*|아니다"],
  ["R01", "연락 방법", "상담을 받는다면 어떤 방법이 편하세요?", "전화|카카오톡|방문|화상|아직 필요 없음"],
  ["R02", "연락 시간", "연락받기 편한 시간대는?", "오전|점심|오후|저녁|주말"],
  ["R03", "자료 형태", "받아보고 싶은 자료 형태는?", "한 장 요약|자세한 보고서|짧은 영상|직접 설명"],
  ["R04", "첫 상담 주제", "상담을 받는다면 가장 먼저 묻고 싶은 주제는?", "보험 정리*|연금·노후*|세금|상속|없음"],
  ["R05", "상담 장벽", "상담을 미루게 되는 가장 큰 이유는?", "시간이 없어서|가입 권유가 부담돼서|필요성을 못 느껴서|미룬 적 없다"],
  ["R06", "최근 접촉", "담당 컨설턴트와 마지막으로 이야기한 게 언제인가요?", "한 달 이내|6개월 이내|1년 이상*"],
  ["R07", "상담 길이", "상담 시간은 어느 정도가 적당하세요?", "15분|30분|1시간|상관없음"],
  ["R08", "동석", "배우자와 함께 상담받는 게 편하세요?", "함께|혼자|상관없음"],
  ["R09", "유용한 주제", "받아보신 자료 중 가장 도움이 된 주제는?", "연금·노후|보험|세금|경제 소식|아직 모르겠다"],
  ["R10", "상담 의향", "3개월 안에 상담을 한번 받아보실 생각이 있으세요?", "있다*|시간 되면*|없다"]
];

/* ── 상담 제안 — 🔥 답을 고른 날 고객 화면에 띄운다 ──
   t: 고객에게 보이는 제안 문구 / topic: 요청 주제(알림톡 관심분야·회원 팝업)
   field: 고객 요청 분야 코드(index.html _fcrFieldLabels) / talk: 회원용 첫 통화 한마디({a} = 고객이 고른 답) */
var OFFER={
  retire:   {t:'노후에 매달 얼마가 필요하고, 지금 준비로 얼마가 나오는지 한 장으로 계산해 드릴까요?', topic:'노후 필요자금 계산', field:'retirement',
             talk:'노후 준비 질문에 「{a}」라고 답해 주셔서, 매달 필요한 금액과 지금 준비로 나오는 금액을 계산해 드리려고 연락드렸습니다.'},
  taxcredit:{t:'올해 남은 기간에 연금계좌로 돌려받을 수 있는 세금을 계산해 드릴까요?', topic:'연금계좌 세금 환급 계산', field:'retirement',
             talk:'연금계좌 세액공제 질문에 「{a}」라고 하셔서, 올해 안에 돌려받을 수 있는 세금을 계산해 드리려고 연락드렸습니다.'},
  tax:      {t:'연금계좌나 비과세 저축으로 줄일 수 있는 세금을 계산해 드릴까요?', topic:'세금 줄이는 연금·저축 계산', field:'retirement',
             talk:'세금 질문에 「{a}」라고 답해 주셔서, 연금계좌와 비과세 저축으로 줄일 수 있는 세금을 계산해 드리려고 연락드렸습니다.'},
  irp:      {t:'퇴직금을 연금으로 받으면 세금이 얼마나 줄어드는지 계산해 드릴까요?', topic:'퇴직금 연금 수령 세금 계산', field:'retirement',
             talk:'퇴직금 질문에 「{a}」라고 하셔서, 연금으로 받을 때 줄어드는 세금을 계산해 드리려고 연락드렸습니다.'},
  pension:  {t:'가지신 연금을 모두 모아 매달 받을 금액을 정리해 드릴까요?', topic:'내 연금 수령액 정리', field:'retirement',
             talk:'연금 질문에 「{a}」라고 하셔서, 가지고 계신 연금을 모아 매달 받을 금액을 정리해 드리려고 연락드렸습니다.'},
  lump:     {t:'목돈이나 만기 자금을 연금으로 바꾸면 매달 얼마를 받는지 비교해 드릴까요?', topic:'목돈·만기 자금 연금 전환 비교', field:'retirement',
             talk:'「{a}」라고 답해 주셔서, 목돈을 연금으로 바꾸면 매달 얼마를 받는지 비교해 드리려고 연락드렸습니다.'},
  inscheck: {t:'가족 보험을 한 장으로 정리해 드릴까요? 겹친 보장과 빈 곳이 한눈에 보입니다.', topic:'가족 보험 한 장 정리', field:'insurance',
             talk:'보험 질문에 「{a}」라고 하셔서, 가족 보험을 한 장으로 정리해 드리려고 연락드렸습니다.'},
  premium:  {t:'지금 보험료가 보장에 비해 적정한지, 앞으로 얼마나 오를지 확인해 드릴까요?', topic:'보험료 적정성·갱신 확인', field:'insurance',
             talk:'보험료 질문에 「{a}」라고 하셔서, 지금 보험료가 적정한지와 앞으로 얼마나 오를지 확인해 드리려고 연락드렸습니다.'},
  cover:    {t:'큰 병이나 만일의 일이 생기면 가족이 실제로 받는 금액을 확인해 드릴까요?', topic:'진단·사망·간병 보장 확인', field:'insurance',
             talk:'보장 질문에 「{a}」라고 하셔서, 만일의 경우 가족이 실제로 받는 금액을 확인해 드리려고 연락드렸습니다.'},
  claim:    {t:'놓친 보험금이 있는지 함께 찾아 드릴까요?', topic:'놓친 보험금 찾기', field:'insurance',
             talk:'「{a}」라고 답해 주셔서, 놓친 보험금이 있는지 함께 찾아 드리려고 연락드렸습니다.'},
  cancel:   {t:'해지하기 전에 손해를 줄이는 방법이 있는지 먼저 확인해 드릴까요?', topic:'해지 전 손해 줄이기', field:'insurance',
             talk:'해지를 고민 중이라고 하셔서, 해지하기 전에 손해를 줄이는 방법을 먼저 확인해 드리려고 연락드렸습니다.'},
  life:     {t:'가족 상황이 바뀐 만큼 보장도 맞는지 다시 확인해 드릴까요?', topic:'생활 변화 맞춤 보장 점검', field:'insurance',
             talk:'「{a}」라고 알려 주셔서, 바뀐 상황에 맞게 보장을 다시 확인해 드리려고 연락드렸습니다.'},
  estate:   {t:'예상 상속세와 낼 현금 준비 방법을 미리 계산해 드릴까요?', topic:'상속세·납부 재원 계산', field:'inheritance',
             talk:'상속 질문에 「{a}」라고 하셔서, 예상 상속세와 낼 현금 준비 방법을 계산해 드리려고 연락드렸습니다.'},
  kids:     {t:'자녀 보험과 자녀 목돈 준비를 함께 점검해 드릴까요?', topic:'자녀 보험·목돈 점검', field:'insurance',
             talk:'자녀 질문에 「{a}」라고 하셔서, 자녀 보험과 목돈 준비를 함께 점검해 드리려고 연락드렸습니다.'},
  biz:      {t:'대표님 퇴직금과 보장 설계를 점검해 드릴까요?', topic:'대표 퇴직금·보장 점검', field:'corporate',
             talk:'「{a}」라고 답해 주셔서, 대표님 퇴직금과 보장 설계를 점검해 드리려고 연락드렸습니다.'},
  consult:  {t:'편한 방법과 시간을 알려주시면 담당 컨설턴트가 연락드리겠습니다.', topic:'상담 일정 잡기', field:'other',
             talk:'상담을 받아보고 싶다고 하셔서, 편하신 시간에 맞춰 연락드렸습니다.'}
};
/* 신호 → 제안 (없으면 분야 기본값) */
var SIG_OFFER={
  '세액공제 활용':'taxcredit','연말정산':'taxcredit','퇴직금·IRP':'irp',
  '개인연금 보유':'pension','국민연금 인지':'pension','연금 수령 설계':'pension',
  '연금 가입 의향':'lump','목돈·만기 자금':'lump','목돈 유입':'lump',
  '보험료 부담':'premium','갱신 인상':'premium','실손보험':'premium',
  '진단비 충분성':'cover','간병·치매':'cover','사망보장·가족 책임':'cover',
  '미청구 보험금':'claim','해지·유지 고민':'cancel','가족 보장 공백':'inscheck'
};
var CAT_OFFER={P:'retire',B:'inscheck',L:'life',T:'tax',S:'estate',K:'kids',C:'biz',R:'consult'};
/* 고른 보기에 따라 제안이 달라지는 문항 — {키:{보기번호:제안}} */
var ANS_OFFER={
  L15:{0:'retire',1:'premium'},     /* 올해 가장 큰 돈 고민 */
  L20:{0:'inscheck',1:'retire'},    /* 가장 먼저 정리하고 싶은 돈 문제 */
  R04:{0:'inscheck',1:'retire'}     /* 상담에서 가장 먼저 묻고 싶은 주제 */
};

/* ── 공통 도구 ── */
var BY={}; Q.forEach(function(r){BY[r[0]]=r;});
function catOf(k){return String(k||'').charAt(0);}
function opts(r){return String(r&&r[3]||'').split('|').map(function(o){var f=o.slice(-1)==='*';return {t:f?o.slice(0,-1):o,f:f};});}
function ansText(k,v){var r=BY[k];if(!r||v==null||v<0)return '';var o=opts(r)[v];return o?o.t:'';}
function isFire(k,v){var r=BY[k];if(!r||v==null||v<0)return false;var o=opts(r)[v];return !!(o&&o.f);}
function offerId(k,v){var a=ANS_OFFER[k];if(a&&a[v])return a[v];var r=BY[k];if(!r)return 'consult';return SIG_OFFER[r[1]]||CAT_OFFER[catOf(k)]||'consult';}
function talkFor(k,v){var o=OFFER[offerId(k,v)];return o?o.talk.replace('{a}',ansText(k,v)||'-'):'';}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function kstYmd(ms){var k=new Date((ms||Date.now())+9*3600000);return ''+k.getUTCFullYear()+String(k.getUTCMonth()+1).padStart(2,'0')+String(k.getUTCDate()).padStart(2,'0');}
function ymdMs(y){y=String(y||'');if(!/^\d{8}$/.test(y))return 0;return Date.UTC(+y.slice(0,4),+y.slice(4,6)-1,+y.slice(6,8));}

/* ── 다음 문항 고르기 — ans: {키:{v,d}} (서버가 돌려준 답변 기록) ── */
function pick(ans){
  ans=ans||{};
  var used=Object.keys(ans), n=used.length, today=ymdMs(kstYmd()), recent={};
  used.forEach(function(k){var r=BY[k],a=ans[k];if(!r||!a)return;var d=ymdMs(a.d);if(d&&today-d<21*86400000)recent[r[1]]=1;});
  var gateC=ans.C01&&ans.C01.v===2;
  var gateK=used.some(function(k){return catOf(k)==='K'&&ansText(k,ans[k].v)==='자녀 없음';});
  var season=(new Date(Date.now()+9*3600000).getUTCMonth()+1)>=10;
  var slot=CYCLE[n%CYCLE.length]; if(slot==='X')slot=X_ROT[Math.floor(n/CYCLE.length)%X_ROT.length];
  var order=[slot].concat(CAT_ORDER.filter(function(c){return c!==slot;}));
  for(var i=0;i<order.length;i++){
    var c=order[i];
    if((c==='C'&&gateC)||(c==='K'&&gateK))continue;
    var cand=Q.filter(function(r){return catOf(r[0])===c&&!ans[r[0]];});
    if(!cand.length)continue;
    var fresh=cand.filter(function(r){return !recent[r[1]];});
    var pool=fresh.length?fresh:cand;
    if(season){var s=pool.filter(function(r){return r[4]==='10~12월';});if(s.length)return s[0];}
    return pool[0];
  }
  return null;
}

/* ═══ 고객 화면 엔진 — client-daily·consensus 가 어댑터를 넘겨 붙인다 ═══
   ad = { call(name,data)→Promise<결과>, consented()→bool, openConsent(), meta()→{nv,ca} }
     meta.nv : 이 기기에서 동의할 때 본 동의 문구 버전 — 새 문구로 동의하지 않은 기기는 'q-notice'(질문 화면 안내만 봄)
     meta.ca : 이 기기에서 동의한 시각(ms) — 서버는 철회 뒤에 다시 동의한 기기의 저장만 받는다
   화면 요소: #ciSheet · #ciSheetBg · #ciBody · #ciCat (각 페이지에 이미 있음) */
var HOW=[['phone','전화'],['kakao','카카오톡'],['visit','방문']];
var WHEN=[['am','오전'],['pm','오후'],['eve','저녁']];
var OFF_DAYS=14;   /* 상담 제안 「괜찮아요」 후 쉬는 기간 */
/* ★ 자동 표시 — 리포트를 연 뒤 30초가 지나면 질문 창을 한 번 띄운다(종전 「오늘의 선택」 규칙)
   · 고객 1명당 하루 1문항 — 오늘 이미 답했으면(다른 화면 포함) 띄우지 않는다
   · 이 기기에서 하루 한 번만 자동으로 띄운다(데일리·컨센서스 합산)
   · 동의 팝업 등 다른 창이 떠 있거나 화면을 보고 있지 않으면 끝날 때까지 기다렸다 띄운다(최대 3분)
   · 자동으로 뜬 창을 답 없이 3번 연속 닫으면 7일 동안 자동으로 띄우지 않는다(버튼은 그대로) */
var AUTO_MS=30000, AUTO_WAIT_MS=180000, AUTO_SKIP_MAX=3, AUTO_SNOOZE_DAYS=7;

function mount(ad){
  var st={ans:{},today:false,reqAt:0,loaded:false,loading:null,open:false,cur:null,pending:null,busy:false,here:false};
  function body(){return document.getElementById('ciBody');}
  function meta(){try{var m=ad.meta?ad.meta():null;return (m&&typeof m==='object')?m:{};}catch(e){return {};}}
  function setCat(t){var e=document.getElementById('ciCat');if(e){e.textContent=t||'';e.style.display=t?'':'none';}}
  function lsGet(k){try{return localStorage.getItem(k)||'';}catch(e){return '';}}
  function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function load(){
    if(st.loaded)return Promise.resolve();
    if(st.loading)return st.loading;
    st.loading=Promise.resolve(ad.call('clientInterestLoad',{v:2})).then(function(r){
      r=r||{};
      if(r.success){st.ans=(r.ans&&typeof r.ans==='object')?r.ans:{};st.today=!!r.today;st.reqAt=+r.reqAt||0;}
      st.loaded=true;
    }).catch(function(){st.loaded=true;});
    return st.loading;
  }
  function todayKey(){var y=kstYmd();var ks=Object.keys(st.ans);for(var i=0;i<ks.length;i++){var a=st.ans[ks[i]];if(a&&a.d===y&&a.v>=0)return ks[i];}return '';}
  function offerOff(){return lsGet('iq_offer_off')>=kstYmd();}
  function offerOk(){return !(st.reqAt&&Date.now()-st.reqAt<OFF_DAYS*86400000)&&!offerOff();}

  function renderQ(){
    var r=pick(st.ans); if(!r)return renderAllDone();
    st.cur=r; setCat(CATS[catOf(r[0])][0]);
    var os=opts(r);
    body().innerHTML='<div class="ciQ">'+esc(r[2])+'</div>'
      +'<div class="ciQs">고르신 답은 담당 컨설턴트에게만 전달됩니다</div>'
      +os.map(function(o,i){return '<button type="button" class="ciOpt" data-v="'+i+'"><span class="ciOn">'+(i+1)+'</span><span>'+esc(o.t)+'</span></button>';}).join('')
      +'<button type="button" class="ciSkip" data-skip>이 질문은 넘길게요</button>';
    body().querySelectorAll('.ciOpt').forEach(function(b){b.onclick=function(){answer(+b.getAttribute('data-v'));};});
    body().querySelector('[data-skip]').onclick=skip;
  }
  function answer(v){
    var r=st.cur; if(!r||st.busy)return;
    if(!ad.consented()){st.pending={r:r,v:v};try{ad.openConsent();}catch(e){}return;}
    commit(r,v);
  }
  function skip(){
    var r=st.cur; if(!r||st.busy)return;
    if(!ad.consented())return close();   /* 동의 전에는 기록하지 않고 닫는다 */
    commit(r,-1);
  }
  function commit(r,v,retry){
    st.busy=true;
    body().querySelectorAll('button').forEach(function(b){b.disabled=true;});
    var f=isFire(r[0],v);
    Promise.resolve(ad.call('clientInterestSave',Object.assign({src:'iq',q:r[0],v:v,f:f,s:r[1],g:CATS[catOf(r[0])][1],ver:VER,nv:'q-notice',ca:0},meta()))).then(function(res){
      st.busy=false; res=res||{};
      if(res.success){st.ans[r[0]]={v:v,d:kstYmd(),f:f};st.today=true;st.here=true;if(v>=0)lsSet('iq_auto_skip','0');return v<0?renderDone():renderResult(r,v,f);}
      if(res.already){st.today=true;return renderDone();}
      /* 방금 동의해 서버에 동의 기록이 아직 닿지 않았으면 한 번 더 보낸다 — 동의 팝업을 다시 띄우지 않는다 */
      if(res.needConsent&&ad.consented()&&!retry){st.busy=true;return setTimeout(function(){commit(r,v,true);},1500);}
      if(res.needConsent){st.pending={r:r,v:v};try{ad.openConsent();}catch(e){}return renderQ();}
      renderErr();
    }).catch(function(){st.busy=false;renderErr();});
  }
  function renderResult(r,v,f){
    var a=ansText(r[0],v), oid=offerId(r[0],v), o=OFFER[oid];
    var head='<div class="ciMineL">나의 응답</div><div class="ciMine">'+esc(a)+'</div>'
      +'<div class="ciSent" style="margin:0 0 13px">✓ 담당 컨설턴트에게 전달했습니다</div>';
    if(!(f&&o&&offerOk())){
      body().innerHTML=head+'<button type="button" class="ciMain" data-close>확인</button>'
        +'<div class="ciSkip" style="cursor:default">내일 새 질문으로 찾아뵐게요</div>';
      body().querySelector('[data-close]').onclick=close; return;
    }
    var pill=function(list,name){return '<div class="ciPills" data-name="'+name+'">'+list.map(function(x){return '<button type="button" class="ciPill" data-val="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';};
    body().innerHTML=head
      +'<div class="ciOffer"><b>'+esc(o.t)+'</b><span>요청하시면 담당 컨설턴트가 이 주제로 연락드립니다.</span></div>'
      +'<div class="ciPickL">편한 방법</div>'+pill(HOW,'how')
      +'<div class="ciPickL">편한 시간</div>'+pill(WHEN,'when')
      +'<div class="ciPickE" data-err></div>'
      +'<button type="button" class="ciMain" data-req>상담 요청하기</button>'
      +'<button type="button" class="ciSkip" data-no>괜찮아요 · 내일 새 질문으로 찾아뵐게요</button>';
    var sel={how:'',when:''};
    body().querySelectorAll('.ciPills').forEach(function(g){
      var name=g.getAttribute('data-name');
      g.querySelectorAll('.ciPill').forEach(function(b){b.onclick=function(){
        g.querySelectorAll('.ciPill').forEach(function(x){x.classList.remove('on');});
        b.classList.add('on'); sel[name]=b.getAttribute('data-val');
      };});
    });
    body().querySelector('[data-no]').onclick=function(){
      var d=new Date(Date.now()+9*3600000+OFF_DAYS*86400000);
      lsSet('iq_offer_off',''+d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0'));
      close();
    };
    body().querySelector('[data-req]').onclick=function(){
      var err=body().querySelector('[data-err]');
      if(!sel.how||!sel.when){if(err)err.textContent='편한 방법과 시간을 골라 주세요';return;}
      if(st.busy)return; st.busy=true; this.disabled=true; this.textContent='전달하는 중…';
      Promise.resolve(ad.call('clientInterestRequest',{q:r[0],v:v,how:sel.how,when:sel.when,
        topic:o.topic,field:o.field,qt:r[2].slice(0,80),at:a.slice(0,40),s:r[1]})).then(function(res){
        st.busy=false; res=res||{};
        if(res.success){st.reqAt=Date.now();return renderRequested(sel.how,!!res.dup);}
        renderErr();
      }).catch(function(){st.busy=false;renderErr();});
    };
  }
  function renderRequested(how,dup){
    var msg={phone:'편하신 시간에 전화로 연락드리겠습니다.',kakao:'편하신 시간에 카카오톡으로 연락드리겠습니다.',visit:'방문 일정을 잡으려고 먼저 연락드리겠습니다.'}[how]||'편하신 시간에 연락드리겠습니다.';
    setCat('');
    body().innerHTML='<div class="ciDoneT">'+(dup?'이미 요청하신 상담이 있습니다':'상담 요청을 전달했습니다')+'</div>'
      +'<div class="ciSentBox"><div class="ciSentL">담당 컨설턴트가 연락드립니다</div><span class="ciOffTx">'
      +(dup?'먼저 남기신 요청으로 곧 연락드리겠습니다.':esc(msg))+'</span></div>'
      +'<button type="button" class="ciSkip" data-close>닫기</button>';
    body().querySelector('[data-close]').onclick=close;
  }
  function renderDone(){
    setCat('');
    var k=todayKey(), r=BY[k];
    body().innerHTML='<div class="ciDoneT">오늘의 질문 완료 · 내일 새 질문으로 찾아뵐게요</div>'
      +(r?'<div class="ciSentBox"><div class="ciSentL">오늘 알려주신 답</div><span class="ciOffTx">'+esc(r[2])+' → <b>'+esc(ansText(k,st.ans[k].v))+'</b></span></div>':'')
      +'<button type="button" class="ciSkip" data-close>닫기</button>';
    body().querySelector('[data-close]').onclick=close;
  }
  function renderAllDone(){
    setCat('');
    body().innerHTML='<div class="ciDoneT">준비한 질문에 모두 답해 주셨습니다</div>'
      +'<div class="ciSentBox"><div class="ciSentL">감사합니다</div><span class="ciOffTx">알려주신 내용으로 담당 컨설턴트가 자료를 준비합니다.</span></div>'
      +'<button type="button" class="ciSkip" data-close>닫기</button>';
    body().querySelector('[data-close]').onclick=close;
  }
  function renderErr(){
    setCat('');
    body().innerHTML='<div class="ciDoneT">잠시 연결이 원활하지 않습니다</div>'
      +'<div class="ciSentBox off"><span class="ciOffTx">조금 뒤에 다시 열어 주세요.</span></div>'
      +'<button type="button" class="ciSkip" data-close>닫기</button>';
    body().querySelector('[data-close]').onclick=close;
  }
  function close(){
    var s=document.getElementById('ciSheet');if(s)s.classList.remove('on');
    var b=document.getElementById('ciSheetBg');if(b)b.classList.remove('on');
    /* 자동으로 뜬 창을 답 없이 닫음 — 3번 연속이면 7일 쉰다 */
    if(st.open&&st.auto&&!st.here){
      var n=(parseInt(lsGet('iq_auto_skip'),10)||0)+1;
      if(n>=AUTO_SKIP_MAX){lsSet('iq_auto_snooze',kstYmd(Date.now()+AUTO_SNOOZE_DAYS*86400000));n=0;}
      lsSet('iq_auto_skip',''+n);
    }
    st.open=false; st.auto=false;
  }
  function open(auto){
    var s=document.getElementById('ciSheet'); if(!s)return;
    st.open=true; st.auto=auto===true;
    var b=document.getElementById('ciSheetBg'); if(b)b.classList.add('on');
    s.classList.add('on'); setCat('');
    body().innerHTML='<div class="ciLoad">잠시만 기다려 주세요…</div>';
    load().then(function(){ if(st.today)renderDone(); else renderQ(); });
  }
  /* 동의 모달에서 「맞춤으로 받아볼게요」 → 보류된 답을 이어서 저장 */
  function resume(){
    var p=st.pending; if(!p)return; st.pending=null;
    if(!st.open)return;
    commit(p.r,p.v);
  }
  /* 진입 버튼 — 오늘 다른 화면에서 이미 답했으면 숨긴다(하루 1문항, 고객 1명 기준) */
  function card(btn){
    if(!btn)return;
    load().then(function(){
      if(st.today&&!st.here){btn.style.display='none';return;}
      btn.style.display='flex';
      autoArm();
    });
  }
  /* 화면 가운데가 다른 고정 창(동의 팝업·시트·오버레이)에 덮여 있는지 */
  function covered(){
    try{
      var el=document.elementFromPoint(window.innerWidth/2,window.innerHeight/2);
      while(el&&el!==document.body&&el!==document.documentElement){
        var pos=getComputedStyle(el).position;
        if(pos==='fixed')return true;
        el=el.parentElement;
      }
    }catch(e){}
    return false;
  }
  function autoOk(){
    if(st.open||st.today||st.auto)return false;
    if(lsGet('iq_auto_day')===kstYmd())return false;      /* 이 기기에서 오늘 이미 자동으로 띄움 */
    if(lsGet('iq_auto_snooze')>=kstYmd())return false;    /* 3번 연속 닫음 — 쉬는 중 */
    if(ad.autoBlocked&&ad.autoBlocked())return false;      /* 화면별 추가 조건(잠금 화면 등) */
    return true;
  }
  function autoArm(){
    if(st.autoT||!autoOk())return;
    var t0=Date.now();
    st.autoT=setTimeout(function tick(){
      if(!autoOk())return;
      if(document.visibilityState==='hidden'||covered()){
        if(Date.now()-t0<AUTO_MS+AUTO_WAIT_MS)setTimeout(tick,5000);   /* 다른 창이 닫히면 띄운다 */
        return;
      }
      lsSet('iq_auto_day',kstYmd());
      open(true);
    },AUTO_MS);
  }
  window.ciOpen=function(){open(false);}; window.ciClose=close; window.ciResume=resume;
  return {open:function(){open(false);},close:close,resume:resume,card:card};
}

window.JVIQ={ver:VER,notice:NOTICE,cats:CATS,catOrder:CAT_ORDER,q:Q,by:BY,offer:OFFER,
  opts:opts,ansText:ansText,isFire:isFire,offerId:offerId,talkFor:talkFor,pick:pick,mount:mount};
})();
