/**
 * JARVIA 계산기 UI 명세 — calculators/lib/ui-spec.js
 *
 * 계산기 하나당 이 블록 하나만 추가하면 화면이 자동으로 만들어진다.
 * id  : JarviaCalculators.listCalculators() 의 calculatorId
 * k   : 엔진 함수의 입력 파라미터명 / 결과 키
 *
 * type : money(금액, 한글 병기) | num(숫자) | select
 * fmt  : won | wonSigned | pct | num | cnt | year | text
 */
(function (global) {
  'use strict';

  const SPEC = {

    /* ─────────────────────────────────────────────
       근로소득세계산기  (tax-personal.calcEarnedIncome)
       ───────────────────────────────────────────── */
    earnedIncome: {
      id: 'earnedIncome',
      bundle: 'personal',
      icon: '🧾',
      title: '근로소득세계산기',
      lead: '총급여와 공제 항목을 넣으면 연말정산 결과를 미리 볼 수 있습니다. 환급인지 추가납부인지 바로 확인하세요.',
      note: '2026년 세법 기준 추정치입니다. 국민연금·건강보험 공제액은 총급여 기준 추정치이며, 실제 납부확인액을 입력하면 그 값이 우선 적용됩니다. 실제 연말정산 결과와 다를 수 있습니다.',
      fixed: { taxYear: 2026 },

      groups: [
        {
          label: '기본 정보',
          fields: [
            { k: 'grossSalary', label: '연간 총급여', unit: '원', type: 'money', required: true, ph: '예) 60,000,000', quick: [10000000, 50000000] },
            { k: 'dependents', label: '부양가족 수', hint: '본인 포함', unit: '명', type: 'num', def: 1 },
            { k: 'childrenUnder7', label: '8세 미만 자녀', unit: '명', type: 'num', def: 0 },
            { k: 'childrenOver7', label: '8세 이상 자녀', unit: '명', type: 'num', def: 0 },
            { k: 'withheld', label: '기납부 세액', hint: '원천징수 합계 · 선택', unit: '원', type: 'money', ph: '예) 5,000,000 · 비워두면 환급액 계산 안 함' }
          ]
        },
        {
          label: '공제 항목',
          collapsed: true,
          fields: [
            { k: 'pensionSaving', label: '연금저축 납입액', unit: '원', type: 'money', def: 0 },
            { k: 'irpAmount', label: 'IRP 납입액', unit: '원', type: 'money', def: 0 },
            { k: 'insurancePremium', label: '보장성보험료', unit: '원', type: 'money', def: 0 },
            { k: 'medicalExpense', label: '의료비', unit: '원', type: 'money', def: 0 },
            { k: 'educationExpense', label: '교육비', unit: '원', type: 'money', def: 0 },
            { k: 'donationExpense', label: '기부금', unit: '원', type: 'money', def: 0 },
            { k: 'housingFund', label: '주택자금 상환액', unit: '원', type: 'money', def: 0 }
          ]
        },
        {
          label: '확인된 납부액 (있으면 우선 적용)',
          collapsed: true,
          fields: [
            { k: 'confirmedNationalPensionDeduction', label: '국민연금 납부확인액', unit: '원', type: 'money' },
            { k: 'confirmedHealthInsuranceDeduction', label: '건강보험 납부확인액', unit: '원', type: 'money', def: 0 },
            { k: 'confirmedEmploymentInsuranceDeduction', label: '고용보험 납부확인액', unit: '원', type: 'money', def: 0 }
          ]
        }
      ],

      outputs: {
        main: { k: 'finalTotal', label: '결정세액 (지방소득세 포함)', fmt: 'won' },
        sub: [
          { k: 'effectiveRate', label: '실효세율', fmt: 'pct' },
          { k: 'refundOrPay', label: '환급(+) / 추가납부(−)', fmt: 'wonSigned', sign: true }
        ],
        rows: [
          { k: 'grossSalary', label: '총급여' },
          { k: 'earnedDeduction', label: '근로소득공제' },
          { k: 'earnedIncome', label: '근로소득금액' },
          { k: 'totalDeduction', label: '소득공제 합계' },
          { k: 'taxBase', label: '과세표준', sum: true },
          { k: 'calculatedTax', label: '산출세액' },
          { k: 'totalTaxCredit', label: '세액공제 합계' },
          { k: 'finalTax', label: '결정세액 (소득세)' },
          { k: 'localTax', label: '지방소득세' },
          { path: 'deductions.nationalPension', label: '국민연금 공제' },
          { path: 'breakdown.pensionCredit', label: '연금계좌 세액공제' }
        ]
      },

      related: [
        { t: '종합소득세계산기', e: '📋', u: './global-income-tax-calculator.html' },
        { t: '연금저축·IRP 세액공제계산기', e: '🎯', u: './pension-tax-credit-calculator.html' },
        { t: '퇴직금계산기', e: '💼', u: './severance-calculator.html' },
        { t: '임대소득세계산기', e: '🏘️', u: './rental-income-tax-calculator.html' }
      ]
    },

    /* ─────────────────────────────────────────────
       종합소득세계산기  (tax-personal.calcGlobalIncome)
       ───────────────────────────────────────────── */
    globalIncome: {
      id: 'globalIncome',
      bundle: 'personal',
      icon: '📋',
      title: '종합소득세계산기',
      lead: '사업·임대·근로·연금·기타 소득을 합산해 5월에 낼 종합소득세를 미리 계산합니다.',
      note: '2026년 세법 기준 추정치입니다. 국민연금 공제는 확인된 납부액이 없으면 0원으로 두며, 표준세액공제는 일반 사업소득자 기준을 적용합니다. 결손금·이월공제·세액감면은 단순화된 추정이므로 실제 신고액과 다를 수 있습니다.',
      fixed: { taxYear: 2026 },
      groups: [
        {
          label: '소득',
          fields: [
            { k: 'businessIncome', label: '사업소득 수입금액', unit: '원', type: 'money', required: true, ph: '예) 80,000,000', quick: [10000000, 50000000] },
            { k: 'businessExpense', label: '사업 필요경비', unit: '원', type: 'money', def: 0, ph: '예) 30,000,000' },
            { k: 'earnedIncome', label: '근로소득금액', unit: '원', type: 'money', def: 0 },
            { k: 'rentalIncome', label: '임대소득금액', unit: '원', type: 'money', def: 0 },
            { k: 'pensionIncome', label: '연금소득금액', unit: '원', type: 'money', def: 0 },
            { k: 'otherIncome', label: '기타소득금액', unit: '원', type: 'money', def: 0 }
          ]
        },
        {
          label: '공제',
          collapsed: true,
          fields: [
            { k: 'dependents', label: '부양가족 수', hint: '본인 포함', unit: '명', type: 'num', def: 1 },
            { k: 'pensionSaving', label: '연금저축 납입액', unit: '원', type: 'money', def: 0 },
            { k: 'irpAmount', label: 'IRP 납입액', unit: '원', type: 'money', def: 0 },
            { k: 'isSimpleBookkeeping', label: '기장 방식', type: 'select', cast: 'bool', def: 'false',
              options: [{ v: 'false', t: '복식부기' }, { v: 'true', t: '간편장부' }] },
            { k: 'confirmedNationalPensionDeduction', label: '국민연금 납부확인액', hint: '있으면 우선 적용', unit: '원', type: 'money' }
          ]
        }
      ],
      outputs: {
        main: { k: 'finalTotal', label: '종합소득세 (지방소득세 포함)', fmt: 'won' },
        sub: [
          { k: 'effectiveRate', label: '실효세율', fmt: 'pct' },
          { k: 'midYearEst', label: '11월 중간예납 예상', fmt: 'won' }
        ],
        rows: [
          { k: 'netBusiness', label: '사업소득금액' },
          { k: 'totalIncome', label: '종합소득금액' },
          { k: 'totalDeduct', label: '소득공제 합계' },
          { k: 'taxBase', label: '과세표준', sum: true },
          { k: 'calculatedTax', label: '산출세액' },
          { k: 'pensionCredit', label: '연금계좌 세액공제' },
          { k: 'totalCredit', label: '세액공제 합계' },
          { k: 'finalTax', label: '결정세액 (소득세)' },
          { k: 'localTax', label: '지방소득세' }
        ]
      }
    },

    /* ─────────────────────────────────────────────
       연금저축·IRP 세액공제계산기  (personal.calcTaxCredit)
       ───────────────────────────────────────────── */
    pensionTaxCredit: {
      id: 'taxCredit',
      bundle: 'personal',
      icon: '🎯',
      title: '연금저축·IRP 세액공제계산기',
      lead: '연금저축과 IRP에 얼마를 넣으면 세금을 얼마나 돌려받는지 계산합니다. 연말에 얼마를 더 넣을지 판단할 때 쓰세요.',
      note: '총급여 5,500만원 이하는 16.5%, 초과는 13.2%(지방소득세 포함)가 적용됩니다. 연금저축 한도 600만원, 연금저축+IRP 합산 한도 900만원입니다. 2026년 기준 추정치입니다.',
      groups: [
        {
          label: '기본 정보',
          fields: [
            { k: 'totalSalary', label: '연간 총급여', hint: '종합소득자는 종합소득금액', unit: '원', type: 'money', required: true, ph: '예) 60,000,000', quick: [10000000, 50000000] },
            { k: 'pensionSaving', label: '연금저축 납입액', hint: '한도 600만원', unit: '원', type: 'money', def: 0, ph: '예) 6,000,000', quick: [1000000] },
            { k: 'irp', label: 'IRP 납입액', hint: '연금저축과 합산 900만원', unit: '원', type: 'money', def: 0, ph: '예) 3,000,000', quick: [1000000] }
          ]
        }
      ],
      outputs: {
        main: { k: 'taxCredit', label: '돌려받는 세액', fmt: 'won' },
        sub: [
          { k: 'creditRate', label: '공제율', fmt: 'rate' },
          { k: 'realMonthlyBurden', label: '실질 월 부담액', fmt: 'won' }
        ],
        rows: [
          { k: 'pensionEffective', label: '연금저축 인정액' },
          { k: 'irpEffective', label: 'IRP 인정액' },
          { k: 'totalEffective', label: '공제 대상 합계', sum: true },
          { k: 'note', label: '적용 기준', fmt: 'text' }
        ]
      }
    },

    /* ─────────────────────────────────────────────
       국민연금 수령시기계산기  (personal.calcNationalPensionTiming)
       ───────────────────────────────────────────── */
    nationalPensionTiming: {
      id: 'nationalPensionTiming',
      bundle: 'personal',
      icon: '⏰',
      title: '국민연금 수령시기계산기',
      lead: '먼저 받을지, 제때 받을지, 미뤄서 더 받을지. 총 얼마를 받게 되는지와 손익분기 나이를 비교합니다.',
      note: '조기수령은 1년당 6% 감액(최대 30%), 연기수령은 1년당 7.2% 증액(최대 36%)을 적용한 추정치입니다. 물가상승률과 소득활동에 따른 감액은 반영하지 않았습니다.',
      groups: [
        {
          label: '기본 정보',
          fields: [
            { k: 'baseMonthly', alias: ['normalMonthly'], label: '정상수령 예상 월 연금액', hint: '국민연금공단 예상연금액 조회 기준', unit: '원', type: 'money', required: true, ph: '예) 1,200,000', quick: [100000, 500000] },
            { k: 'normalAge', label: '정상 수령 개시 나이', unit: '세', type: 'num', def: 65 },
            { k: 'earlyYears', label: '조기수령 앞당길 기간', hint: '최대 5년', unit: '년', type: 'num', def: 5 },
            { k: 'delayYears', label: '연기수령 미룰 기간', hint: '최대 5년', unit: '년', type: 'num', def: 5 },
            { k: 'lifeExpectancy', label: '기대수명', unit: '세', type: 'num', def: 90 }
          ]
        }
      ],
      outputs: {
        main: { path: 'normal.monthly', k: 'normalMonthly', label: '정상수령 월 연금액', fmt: 'won' },
        sub: [
          { path: 'early.monthly', k: 'earlyMonthly', label: '조기수령 월액', fmt: 'won' },
          { path: 'delay.monthly', k: 'delayMonthly', label: '연기수령 월액', fmt: 'won' }
        ],
        rows: [
          { path: 'early.cumulative', label: '조기수령 총 수령액' },
          { path: 'normal.cumulative', label: '정상수령 총 수령액' },
          { path: 'delay.cumulative', label: '연기수령 총 수령액', sum: true },
          { k: 'earlyReduction', label: '조기수령 감액률', fmt: 'pct' },
          { k: 'delayIncrease', label: '연기수령 증액률', fmt: 'pct' },
          { k: 'breakEvenNormalVsEarly', label: '정상 vs 조기 손익분기', fmt: 'age' },
          { k: 'breakEvenDelayVsNormal', label: '연기 vs 정상 손익분기', fmt: 'age' }
        ]
      }
    },

    /* ─────────────────────────────────────────────
       임대소득세계산기  (tax-personal.calcRentalIncome)
       ───────────────────────────────────────────── */
    rentalIncome: {
      id: 'rentalIncome',
      bundle: 'personal',
      icon: '🏘️',
      title: '임대소득세계산기',
      lead: '월세와 보증금으로 임대소득세를 계산합니다. 분리과세와 종합과세 중 어느 쪽이 유리한지 함께 비교합니다.',
      note: '2026년 세법 기준 추정치입니다. 임대수입 2천만원 이하만 분리과세를 선택할 수 있습니다. 간주임대료는 3주택 이상·보증금 합계 3억원 초과일 때 계산됩니다. 실제 장부·경비자료가 있으면 결과가 달라집니다.',
      fixed: { taxYear: 2026 },
      groups: [
        {
          label: '임대 현황',
          fields: [
            { k: 'annualRent', label: '연간 월세 수입', unit: '원', type: 'money', required: true, ph: '예) 24,000,000', quick: [1000000, 10000000] },
            { k: 'deposit', label: '임대보증금 합계', unit: '원', type: 'money', def: 0, ph: '예) 200,000,000' },
            { k: 'numHouses', label: '보유 주택 수', unit: '채', type: 'num', def: 1 },
            { k: 'highValueHouseCount', label: '기준시가 12억 초과 주택 수', unit: '채', type: 'num', def: 0 },
            { k: 'otherIncome', label: '임대 외 종합소득금액', hint: '근로·사업 등', unit: '원', type: 'money', def: 0, ph: '예) 40,000,000' }
          ]
        },
        {
          label: '등록 여부',
          collapsed: true,
          fields: [
            { k: 'isRegistered', label: '등록임대주택', hint: '지자체+세무서 등록, 임대료 인상 5% 이하', type: 'select', cast: 'bool', def: 'false',
              options: [{ v: 'false', t: '미등록' }, { v: 'true', t: '등록임대주택' }] },
            { k: 'isOverseasSingleHouse', label: '국외 1주택', type: 'select', cast: 'bool', def: 'false',
              options: [{ v: 'false', t: '아니오' }, { v: 'true', t: '예' }] }
          ]
        }
      ],
      outputs: {
        main: { k: 'recommendedTax', label: '예상 임대소득세', fmt: 'won' },
        sub: [
          { k: 'betterMethod', label: '유리한 과세 방식', fmt: 'text' },
          { k: 'effectiveRate', label: '실효세율', fmt: 'pct' }
        ],
        rows: [
          { k: 'totalRevenue', label: '총 임대수입' },
          { k: 'deemedRent', label: '간주임대료' },
          { k: 'separateTotal', label: '분리과세 세부담' },
          { k: 'compTotal', label: '종합과세 세부담', sum: true },
          { k: 'separateTaxBase', label: '분리과세 과세표준' },
          { k: 'compTaxBase', label: '종합과세 과세표준' }
        ]
      }
    }

  };

  global.JarviaCalcSpec = Object.assign(global.JarviaCalcSpec || {}, SPEC);
})(typeof window !== 'undefined' ? window : globalThis);
