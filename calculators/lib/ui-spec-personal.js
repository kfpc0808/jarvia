/**
 * JARVIA 계산기 UI 명세 — ui-spec-personal.js (split-spec.js 생성, 직접 편집 금지)
 * 정본은 ui-spec.js이며 계산기를 추가하면 split-spec.js를 다시 실행한다.
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
            { k: 'numHouses', label: '보유 주택 수', unit: '채', type: 'num', def: 2 },
            { k: 'oneHouseTaxableConfirmed', label: '1주택일 때 과세 대상 여부', hint: '2주택 이상이면 무시', type: 'select', cast: 'bool', def: 'false',
              options: [{ v: 'false', t: '비과세 (기준시가 12억 이하 국내 1주택)' }, { v: 'true', t: '과세 (12억 초과 또는 국외주택)' }] },
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
    },

/* ── 금융소득종합과세계산기 ── */
    financialIncome: {
      id: 'financialIncome', bundle: 'personal', icon: '💹',
      title: '금융소득종합과세계산기',
      lead: '이자·배당 소득이 2천만원을 넘으면 세금이 어떻게 달라지는지 계산합니다.',
      note: '2026년 세법 기준 추정치입니다. 금융소득 2천만원 초과분은 다른 소득과 합산해 누진세율이 적용되며, 원천징수세액(15.4%)과 비교해 더 큰 쪽으로 과세합니다.',
      groups: [{ label: '금융소득', fields: [
        { k: 'interestIncome', label: '연간 이자소득', unit: '원', type: 'money', required: true, ph: '예) 15,000,000', quick: [1000000, 10000000] },
        { k: 'dividendIncome', label: '연간 배당소득', unit: '원', type: 'money', def: 0, ph: '예) 12,000,000' },
        { k: 'otherIncome', label: '금융 외 종합소득금액', hint: '근로·사업 등', unit: '원', type: 'money', def: 0, ph: '예) 50,000,000' }
      ]}],
      outputs: {
        main: { k: 'finalTax', label: '금융소득 관련 총 세부담', fmt: 'won' },
        sub: [
          { k: 'totalFinancial', label: '금융소득 합계', fmt: 'won' },
          { k: 'totalAdditionalTax', label: '추가 납부액', fmt: 'won' }
        ],
        rows: [
          { k: 'excessAmount', label: '2천만원 초과분' },
          { k: 'taxBase', label: '과세표준', sum: true },
          { k: 'globalTax', label: '종합과세 산출세액' },
          { k: 'withholdingComparisonTax', label: '비교과세(원천징수 기준)' },
          { k: 'finalNationalTax', label: '결정세액 (소득세)' },
          { k: 'localTax', label: '지방소득세' },
          { k: 'alreadyPaid', label: '기 원천징수세액' }
        ]
      }
    },

/* ── ISA 절세계산기 ── */
    isaSavings: {
      id: 'isaSavings', bundle: 'personal', icon: '💼',
      title: 'ISA 절세계산기',
      lead: 'ISA 계좌를 쓰면 일반 계좌보다 세금을 얼마나 아끼는지 비교합니다.',
      note: '연 납입한도 2천만원, 총 납입한도 1억원 기준입니다. 비과세 한도는 일반형 200만원, 서민형·청년형 400만원이며 초과분은 9.9% 분리과세됩니다. 2026년 기준 추정치입니다.',
      groups: [{ label: '납입 계획', fields: [
        { k: 'annualDeposit', label: '연간 납입액', hint: '한도 2,000만원', unit: '원', type: 'money', required: true, ph: '예) 20,000,000', quick: [1000000, 10000000] },
        { k: 'years', label: '납입 기간', unit: '년', type: 'num', def: 5 },
        { k: 'annualReturn', label: '연 수익률', unit: '%', type: 'num', def: 4, scale: 0.01 },
        { k: 'accountType', label: '계좌 유형', type: 'select', def: 'general',
          options: [{ v: 'general', t: '일반형 (비과세 200만원)' }, { v: 'preferential', t: '서민형 (400만원)' }, { v: 'youth', t: '청년형 (400만원)' }] }
      ]}],
      outputs: {
        main: { k: 'isaNetProfit', label: 'ISA 세후 수익', fmt: 'won' },
        sub: [
          { k: 'isaTax', label: 'ISA 세금', fmt: 'won' },
          { k: 'exemptLimit', label: '비과세 한도', fmt: 'won' }
        ],
        rows: [
          { k: 'totalDeposit', label: '총 납입액' },
          { k: 'isaFV', label: 'ISA 만기 평가액' },
          { k: 'isaProfit', label: 'ISA 수익' },
          { k: 'taxableProfit', label: '과세 대상 수익' },
          { k: 'generalFV', label: '일반계좌 만기 평가액', sum: true }
        ]
      }
    },

/* ── 주택담보대출 이자공제계산기 ── */
    mortgageDeduction: {
      id: 'mortgageDeduction', bundle: 'personal', icon: '🏦',
      title: '주택담보대출 이자공제계산기',
      lead: '장기주택저당차입금 이자상환액 소득공제로 세금을 얼마나 줄일 수 있는지 계산합니다.',
      note: '2026년 세법 기준 추정치입니다. 취득가액·세대주 여부·주택 수·차입 시기 등 공제요건 확인 없이 한도만 계산하므로 실제 적용 여부는 별도 확인이 필요합니다. 절세액은 총급여 구간 기준 추정 한계세율입니다.',
      groups: [{ label: '대출 정보', fields: [
        { k: 'annualInterest', label: '연간 이자상환액', unit: '원', type: 'money', required: true, ph: '예) 6,000,000', quick: [1000000] },
        { k: 'grossSalary', label: '연간 총급여', unit: '원', type: 'money', def: 0, ph: '예) 70,000,000' },
        { k: 'acquisitionPrice', label: '주택 취득가액', unit: '원', type: 'money', def: 0, ph: '예) 500,000,000' },
        { k: 'termYears', label: '상환 기간', unit: '년', type: 'num', def: 15 },
        { k: 'loanType', label: '대출 유형', type: 'select', cast: 'num', def: '1',
          options: [{ v: '1', t: '15년 이상 고정금리·비거치' }, { v: '2', t: '15년 이상 (고정 또는 비거치)' }, { v: '3', t: '10~15년' }] }
      ]}],
      outputs: {
        main: { k: 'taxSaving', label: '예상 절세액', fmt: 'won' },
        sub: [
          { k: 'deductionAmount', label: '공제 적용액', fmt: 'won' },
          { k: 'marginalRate', label: '적용 한계세율', fmt: 'pct' }
        ],
        rows: [
          { k: 'annualInterest', label: '연간 이자상환액' },
          { k: 'limit', label: '공제 한도' },
          { k: 'effectiveInterest', label: '절세 반영 실질 이자', sum: true }
        ]
      }
    },

/* ── 4대보험계산기 ── */
    socialInsurancePersonal: {
      id: 'socialInsurancePersonal', bundle: 'personal', icon: '🩺',
      title: '4대보험계산기',
      lead: '월급에서 빠지는 4대보험료와 회사 부담분을 함께 계산합니다.',
      note: '2026년 요율 기준입니다. 국민연금은 기준소득월액 상한이 적용되며, 실제 공제액은 사업장 신고 기준소득월액에 따라 달라질 수 있습니다.',
      groups: [{ label: '급여 정보', fields: [
        { k: 'monthlySalary', label: '월 급여', hint: '세전 기준', unit: '원', type: 'money', required: true, ph: '예) 4,000,000', quick: [1000000] },
        { k: 'employeeType', label: '가입 형태', type: 'select', def: 'employee',
          options: [{ v: 'employee', t: '직장가입자' }, { v: 'selfEmployed', t: '지역가입자' }] }
      ]}],
      outputs: {
        main: { path: 'employee.total', k: 'employeeTotal', label: '본인 부담 월 보험료', fmt: 'won' },
        sub: [
          { path: 'employer.total', k: 'employerTotal', label: '회사 부담 월 보험료', fmt: 'won' },
          { path: 'employee.annual', k: 'employeeAnnual', label: '본인 부담 연간', fmt: 'won' }
        ],
        rows: [
          { path: 'employee.nationalPension', label: '국민연금' },
          { path: 'employee.healthInsurance', label: '건강보험' },
          { path: 'employee.longTermCare', label: '장기요양보험' },
          { path: 'employee.employment', label: '고용보험' },
          { k: 'annualSalary', label: '연 급여', sum: true },
          { k: 'nationalPensionCap', label: '국민연금 기준소득월액 상한' }
        ]
      }
    },

/* ── 창업중소기업 세액감면계산기 ── */
    startupTaxCredit: {
      id: 'startupTaxCredit', bundle: 'personal', icon: '🚀',
      title: '창업중소기업 세액감면계산기',
      lead: '창업 후 5년간 받을 수 있는 소득세·법인세 감면액을 계산합니다.',
      note: '조세특례제한법 제6조 기준 추정치입니다. 업종·지역·창업 시기 요건을 모두 충족해야 적용되며, 최초 소득 발생연도를 입력하지 않으면 창업연도 기준으로 추정합니다.',
      groups: [{ label: '창업 정보', fields: [
        { k: 'annualIncomeTax', label: '연간 산출세액', hint: '감면 전', unit: '원', type: 'money', required: true, ph: '예) 12,000,000', quick: [1000000] },
        { k: 'foundYear', alias: ['foundedYear'], label: '창업 연도', unit: '년', type: 'num', def: 2024 },
        { k: 'firstIncomeYear', label: '최초 소득 발생연도', hint: '있으면 우선 적용', unit: '년', type: 'num' },
        { k: 'founder', label: '창업자 유형', type: 'select', def: 'general',
          options: [{ v: 'general', t: '일반' }, { v: 'youth', t: '청년창업 (34세 이하)' }] },
        { k: 'region', label: '창업 지역', type: 'select', def: 'other',
          options: [{ v: 'other', t: '수도권 밖' }, { v: 'capital', t: '수도권' }] }
      ]}],
      outputs: {
        main: { k: 'taxExemption', label: '연간 감면세액', fmt: 'won' },
        sub: [
          { k: 'exemptionRate', label: '감면율', fmt: 'pct' },
          { k: 'totalExemption', label: '남은 기간 총 감면액', fmt: 'won' }
        ],
        rows: [
          { k: 'annualIncomeTax', label: '감면 전 산출세액' },
          { k: 'taxAfter', label: '감면 후 납부세액', sum: true },
          { k: 'yearsInBusiness', label: '창업 경과', fmt: 'year' },
          { k: 'remainingYears', label: '남은 감면 기간', fmt: 'year' }
        ]
      }
    },

/* ── 주택연금계산기 ── */
    housingPension: {
      id: 'housingPension', bundle: 'personal', icon: '🏡',
      title: '주택연금계산기',
      lead: '집을 담보로 평생 받을 수 있는 월 연금액을 추정합니다.',
      note: '추정치입니다. 실제 금액은 가입 시점 금리·감정평가액·지급방식에 따라 달라지므로 한국주택금융공사(hf.go.kr) 공식 계산기로 확인하셔야 합니다. 부부 공동 가입 시 연소자 기준입니다.',
      groups: [{ label: '기본 정보', fields: [
        { k: 'age', label: '가입 나이', hint: '부부는 연소자 기준', unit: '세', type: 'num', required: true, def: 65 },
        { k: 'homeValue', label: '주택 시세', unit: '원', type: 'money', required: true, ph: '예) 600,000,000', quick: [50000000, 100000000] }
      ]}],
      outputs: {
        main: { k: 'monthly', label: '예상 월 수령액', fmt: 'won' },
        sub: [
          { k: 'annualTotal', label: '연간 수령액', fmt: 'won' },
          { k: 'age', label: '가입 나이', fmt: 'age' }
        ],
        rows: [
          { k: 'homeValue', label: '주택 시세' },
          { k: 'note', label: '안내', fmt: 'text' }
        ]
      }
    },

/* ── 일시금·연금 세금비교계산기 ── */
    lumpSumVsPensionTax: {
      id: 'lumpSumVsPensionTax', bundle: 'personal', icon: '⚖️',
      title: '일시금·연금 세금비교계산기',
      lead: '퇴직금을 한 번에 받을지 연금으로 나눠 받을지, 세금 차이를 비교합니다.',
      note: '연금으로 10년 이하 수령 시 퇴직소득세의 70%, 10년 초과 수령 시 60%가 적용됩니다. 퇴직소득세 자체는 근속연수·퇴직급여에 따라 별도로 산출해야 하며, 퇴직금계산기에서 확인할 수 있습니다.',
      groups: [{ label: '퇴직급여', fields: [
        { k: 'severancePay', label: '퇴직금 총액', unit: '원', type: 'money', required: true, ph: '예) 100,000,000', quick: [10000000, 50000000] },
        { k: 'retirementIncomeTax', label: '퇴직소득세', hint: '퇴직금계산기 결과', unit: '원', type: 'money', def: 0, ph: '예) 5,000,000' }
      ]}],
      outputs: {
        main: { k: 'saving_over10y', label: '연금 10년 초과 수령 시 절감액', fmt: 'won' },
        sub: [
          { k: 'lumpSumTax', label: '일시금 세금', fmt: 'won' },
          { k: 'pensionTax_over10y', label: '연금 세금 (10년 초과)', fmt: 'won' }
        ],
        rows: [
          { k: 'severancePay', label: '퇴직금 총액' },
          { k: 'pensionTax_within10y', label: '연금 세금 (10년 이하)' },
          { k: 'saving_within10y', label: '10년 이하 절감액' },
          { k: 'saving_over10y', label: '10년 초과 절감액', sum: true }
        ]
      }
    },

/* ── 은퇴크레바스계산기 ── */
    retirementCrevasse: {
      id: 'retirementCrevasse', bundle: 'personal', icon: '🕳️',
      title: '은퇴크레바스계산기',
      lead: '퇴직 후 연금이 나오기 전까지 소득 공백 기간에 얼마가 필요한지 계산합니다.',
      note: '물가상승률 2.5%, 운용수익률 3.5%를 기본 가정으로 한 추정치입니다. 실제 필요자금은 건강보험료·의료비 등 은퇴 직후 지출 변동에 따라 달라집니다.',
      groups: [{ label: '공백 기간', fields: [
        { k: 'retireAge', label: '퇴직 나이', unit: '세', type: 'num', required: true, def: 60 },
        { k: 'pensionStartAge', label: '연금 개시 나이', unit: '세', type: 'num', def: 65 },
        { k: 'monthlyExpense', alias: ['monthlyNeed'], label: '월 생활비', unit: '원', type: 'money', required: true, ph: '예) 3,000,000', quick: [500000, 1000000] },
        { k: 'otherMonthly', label: '공백기 월 소득', hint: '재취업·임대 등', unit: '원', type: 'money', def: 0 }
      ]}],
      outputs: {
        main: { k: 'totalFund', label: '공백기 필요자금', fmt: 'won' },
        sub: [
          { k: 'years', label: '공백 기간', fmt: 'year' },
          { k: 'monthlyNeed', label: '월 필요액', fmt: 'won' }
        ],
        rows: [
          { k: 'months', label: '공백 개월 수', fmt: 'num' },
          { k: 'nominalTotal', label: '단순 합계 (물가 미반영)' },
          { k: 'totalFund', label: '현재가치 기준 필요자금', sum: true }
        ]
      }
    },

/* ── 3층연금 점검계산기 ── */
    pensionByPillar: {
      id: 'pensionByPillar', bundle: 'personal', icon: '🏛️',
      title: '3층연금 점검계산기',
      lead: '국민연금·퇴직연금·개인연금을 합쳐 목표 노후 생활비를 얼마나 채우는지 점검합니다.',
      note: '입력한 월 수령액 기준 단순 합산이며 물가상승은 반영하지 않았습니다. 국민연금은 국민연금공단 예상연금액 조회, 퇴직연금은 가입 금융기관 조회 금액을 넣으시면 정확합니다.',
      groups: [{ label: '목표와 현재', fields: [
        { k: 'targetMonthly', label: '목표 월 생활비', unit: '원', type: 'money', required: true, ph: '예) 3,000,000', quick: [500000, 1000000] },
        { k: 'publicMonthly', label: '국민연금 예상 월액', unit: '원', type: 'money', def: 0, ph: '예) 1,200,000' },
        { k: 'retirementPensionMonthly', label: '퇴직연금 예상 월액', unit: '원', type: 'money', def: 0, ph: '예) 500,000' },
        { k: 'privatePensionMonthly', label: '개인연금 예상 월액', unit: '원', type: 'money', def: 0, ph: '예) 300,000' }
      ]}],
      outputs: {
        main: { k: 'gap', label: '부족한 월 생활비', fmt: 'won' },
        sub: [
          { k: 'coverageRate', label: '목표 대비 충족률', fmt: 'pct' },
          { k: 'covered', label: '확보한 월 연금', fmt: 'won' }
        ],
        rows: [
          { k: 'target', label: '목표 월 생활비' },
          { path: 'pillars.public', label: '1층 국민연금' },
          { path: 'pillars.retirement', label: '2층 퇴직연금' },
          { path: 'pillars.private', label: '3층 개인연금' },
          { k: 'covered', label: '합계', sum: true }
        ]
      }
    },

/* ── 연금 인출기간계산기 ── */
    withdrawDuration: {
      id: 'withdrawDuration', bundle: 'personal', icon: '📉',
      title: '연금 인출기간계산기',
      lead: '모아둔 자산에서 매달 얼마씩 빼 쓰면 몇 살까지 버티는지 계산합니다.',
      note: '운용수익률 4%, 물가상승률 2.5%를 기본 가정으로 한 추정치입니다. 실제 자산 소진 시점은 수익률 변동과 지출 변화에 따라 크게 달라집니다.',
      groups: [{ label: '자산과 인출', fields: [
        { k: 'balance', label: '은퇴 시점 자산', unit: '원', type: 'money', required: true, ph: '예) 500,000,000', quick: [50000000, 100000000] },
        { k: 'monthlyWithdraw', label: '월 인출액', unit: '원', type: 'money', required: true, ph: '예) 2,500,000', quick: [500000] },
        { k: 'currentAge', label: '인출 시작 나이', unit: '세', type: 'num', def: 65 },
        { k: 'returnRate', label: '연 운용수익률', unit: '%', type: 'num', def: 4, scale: 0.01 },
        { k: 'inflationRate', label: '연 물가상승률', unit: '%', type: 'num', def: 2.5, scale: 0.01 }
      ]}],
      outputs: {
        main: { k: 'exhaustAge', label: '자산 소진 예상 나이', fmt: 'age' },
        sub: [
          { k: 'years', label: '인출 가능 기간', fmt: 'year1' },
          { k: 'months', label: '인출 가능 개월', fmt: 'month' }
        ],
        rows: []
      }
    },

/* ── 사적연금 과세계산기 ── */
    privatePensionTax: {
      id: 'privatePensionTax', bundle: 'personal', icon: '🧮',
      title: '사적연금 과세계산기',
      lead: '연금저축·IRP에서 받는 연금에 붙는 세금을 계산합니다. 연 1,500만원이 갈림길입니다.',
      note: '연 1,500만원 이하는 저율 분리과세(나이별 3.3~5.5%)로 종결되고, 초과하면 종합과세와 16.5% 분리과세 중 선택할 수 있습니다. 2026년 기준 추정치입니다.',
      groups: [{ label: '연금 수령', fields: [
        { k: 'annualPension', alias: ['annualPrivatePension'], label: '연간 사적연금 수령액', unit: '원', type: 'money', required: true, ph: '예) 12,000,000', quick: [1000000] },
        { k: 'age', label: '수령 나이', unit: '세', type: 'num', def: 65 }
      ]}],
      outputs: {
        main: { k: 'tax', label: '예상 연금소득세', fmt: 'won' },
        sub: [
          { k: 'lowRate', label: '적용 세율', fmt: 'pct' },
          { k: 'afterTax', label: '세후 수령액', fmt: 'won' }
        ],
        rows: [
          { k: 'annual', label: '연간 수령액' },
          { k: 'taxIfSeparate16_5', label: '16.5% 분리과세 시 세금' },
          { k: 'note', label: '적용 기준', fmt: 'text' }
        ]
      }
    },

/* ── IRP 적립계산기 ── */
    pensionDepositIRP: {
      id: 'pensionDepositIRP', bundle: 'personal', icon: '💵',
      title: 'IRP 적립계산기',
      lead: '매년 IRP에 넣으면 세액공제와 운용수익을 합쳐 최종적으로 얼마를 받는지 계산합니다.',
      note: '연 수익률 4%, 인출 시 연금소득세 5.5%를 기본 가정으로 한 추정치입니다. 세액공제는 총급여 5,500만원 기준으로 16.5% 또는 13.2%가 적용됩니다.',
      groups: [{ label: '적립 계획', fields: [
        { k: 'annualContribution', label: '연간 납입액', hint: '세액공제 한도 900만원', unit: '원', type: 'money', required: true, ph: '예) 9,000,000', quick: [1000000] },
        { k: 'yearsToContribute', label: '납입 기간', unit: '년', type: 'num', def: 15 },
        { k: 'globalIncome', label: '연간 총급여', hint: '공제율 판정용', unit: '원', type: 'money', def: 0, ph: '예) 60,000,000' },
        { k: 'expectedReturn', label: '연 수익률', unit: '%', type: 'num', def: 4, scale: 0.01 }
      ]}],
      outputs: {
        main: { k: 'netReceived', label: '최종 세후 수령액', fmt: 'won' },
        sub: [
          { k: 'annualTaxCredit', label: '연간 세액공제', fmt: 'won' },
          { k: 'totalCreditOverYears', label: '기간 총 세액공제', fmt: 'won' }
        ],
        rows: [
          { k: 'annualContribution', label: '연간 납입액' },
          { k: 'creditRate', label: '세액공제율', fmt: 'rate' },
          { k: 'finalValueBeforeTax', label: '만기 평가액 (세전)' },
          { k: 'withdrawTax', label: '인출 시 연금소득세' },
          { k: 'netReceived', label: '세후 수령액', sum: true }
        ]
      }
    },

/* ══════════ 개인 · 보장·설계 7종 (회원 전용) ══════════ */

    lifeInsuranceNeed: {
      id: 'lifeInsuranceNeed', bundle: 'personal', icon: '🛡️', isPublic: false,
      title: '사망보장 필요액계산기',
      lead: '가장에게 일이 생겼을 때 남은 가족이 살아가는 데 필요한 자금을 계산합니다.',
      note: '운용수익률 4%, 물가상승률 2.5%를 가정한 현재가치 기준 추정치입니다. 유족연금·퇴직금 등 다른 수입원은 반영하지 않았으므로 실제 필요액은 달라질 수 있습니다.',
      groups: [{ label: '가족 생활', fields: [
        { k: 'monthlyLivingCost', label: '유족 월 생활비', unit: '원', type: 'money', required: true, ph: '예) 3,000,000', quick: [500000, 1000000] },
        { k: 'supportYears', label: '생활비 필요 기간', unit: '년', type: 'num', required: true, def: 20 },
        { k: 'educationCost', label: '자녀 교육비 총액', unit: '원', type: 'money', def: 0, ph: '예) 100,000,000' },
        { k: 'debt', label: '남은 부채', unit: '원', type: 'money', def: 0, ph: '예) 200,000,000' },
        { k: 'emergencyFund', label: '비상자금', unit: '원', type: 'money', def: 0 }
      ]},
      { label: '이미 준비된 것', collapsed: true, fields: [
        { k: 'liquidAssets', label: '즉시 현금화 가능 자산', unit: '원', type: 'money', def: 0 },
        { k: 'existingCoverage', label: '기존 사망보장액', unit: '원', type: 'money', def: 0 }
      ]}],
      outputs: {
        main: { k: 'requiredCoverageGap', label: '추가로 필요한 보장액', fmt: 'won' },
        sub: [
          { k: 'totalNeed', label: '총 필요자금', fmt: 'won' },
          { k: 'offset', label: '준비된 자금', fmt: 'won' }
        ],
        rows: [
          { k: 'livingCostPV', label: '생활비 현재가치' },
          { k: 'educationCost', label: '교육비' },
          { k: 'debt', label: '부채 상환' },
          { k: 'totalNeed', label: '총 필요자금', sum: true },
          { k: 'liquidAssets', label: '보유 자산' },
          { k: 'existingCoverage', label: '기존 보장' }
        ]
      }
    },

criticalIllnessNeed: {
      id: 'criticalIllnessNeed', bundle: 'personal', icon: '❤️‍🩹', isPublic: false,
      title: '중대질병 보장계산기',
      lead: '암·뇌·심장 질환 진단 시 치료비와 소득 공백까지 감안한 필요 자금을 계산합니다.',
      note: '치료비와 회복 기간 중 소득 손실을 합산한 추정치입니다. 실제 치료비는 질환·병기·비급여 항목에 따라 크게 달라지므로 참고용으로만 사용하세요.',
      groups: [{ label: '진단 시 부담', fields: [
        { k: 'treatmentCost', label: '예상 치료비', unit: '원', type: 'money', required: true, ph: '예) 50,000,000', quick: [10000000] },
        { k: 'monthlyIncome', label: '월 소득', unit: '원', type: 'money', def: 0, ph: '예) 5,000,000' },
        { k: 'recoveryMonths', label: '회복·휴직 기간', unit: '개월', type: 'num', def: 12 },
        { k: 'extraCost', label: '간병·요양 추가비용', unit: '원', type: 'money', def: 0 },
        { k: 'existingDiagnosisBenefit', label: '기존 진단비 보장액', unit: '원', type: 'money', def: 0 }
      ]}],
      outputs: {
        main: { k: 'requiredCoverageGap', label: '추가로 필요한 보장액', fmt: 'won' },
        sub: [
          { k: 'totalNeed', label: '총 필요자금', fmt: 'won' },
          { k: 'incomeLoss', label: '소득 공백 손실', fmt: 'won' }
        ],
        rows: [
          { k: 'treatmentCost', label: '치료비' },
          { k: 'incomeLoss', label: '소득 손실' },
          { k: 'extraCost', label: '추가 비용' },
          { k: 'totalNeed', label: '총 필요자금', sum: true },
          { k: 'existingDiagnosisBenefit', label: '기존 보장액' }
        ]
      }
    },

ltcNeed: {
      id: 'ltcNeed', bundle: 'personal', icon: '🧑‍🦽', isPublic: false,
      title: '간병·장기요양 필요액계산기',
      lead: '장기요양이 필요해졌을 때 본인이 실제로 부담하는 간병비를 계산합니다.',
      note: '장기요양보험 급여를 제외한 본인부담분 기준입니다. 물가상승률 2.5%, 운용수익률 4%를 가정한 현재가치 추정치이며, 등급과 시설 종류에 따라 실제 부담은 크게 달라집니다.',
      groups: [{ label: '간병 부담', fields: [
        { k: 'monthlyCareCost', label: '월 간병·요양비', unit: '원', type: 'money', required: true, ph: '예) 2,000,000', quick: [500000] },
        { k: 'careYears', label: '간병 예상 기간', unit: '년', type: 'num', required: true, def: 5 },
        { k: 'startInYears', label: '몇 년 뒤 시작', unit: '년', type: 'num', def: 20 },
        { k: 'copayRate', label: '본인부담 비율', unit: '%', type: 'num', def: 20, scale: 0.01 },
        { k: 'existingLtcMonthly', label: '기존 간병보험 월 보장액', unit: '원', type: 'money', def: 0 }
      ]}],
      outputs: {
        main: { k: 'requiredCoverageGap', label: '추가로 필요한 자금', fmt: 'won' },
        sub: [
          { k: 'ownMonthlyCost', label: '월 본인부담액', fmt: 'won' },
          { k: 'needPV', label: '현재가치 필요액', fmt: 'won' }
        ],
        rows: [
          { k: 'ownMonthlyCost', label: '월 본인부담액' },
          { k: 'careMonths', label: '간병 개월 수', fmt: 'month' },
          { k: 'needAtOnset', label: '간병 시작 시점 필요액' },
          { k: 'needPV', label: '현재가치 환산액', sum: true },
          { k: 'existingCoveragePV', label: '기존 보장 현재가치' }
        ]
      }
    },

childInsuranceNeed: {
      id: 'childInsuranceNeed', bundle: 'personal', icon: '👶', isPublic: false,
      title: '자녀보험 필요액계산기',
      lead: '자녀가 크게 아플 때 필요한 진단비·입원비·교육 연속성 자금을 계산합니다.',
      note: '진단비, 입원비, 수술 대비 자금, 교육 연속성 자금을 합산한 추정치입니다. 실제 필요액은 질환 종류와 치료 기간에 따라 달라집니다.',
      groups: [{ label: '필요 보장', fields: [
        { k: 'diagnosisCost', label: '진단비 목표액', unit: '원', type: 'money', required: true, ph: '예) 30,000,000', quick: [10000000] },
        { k: 'hospitalDailyCost', label: '1일 입원비', unit: '원', type: 'money', def: 0, ph: '예) 100,000' },
        { k: 'expectedHospitalDays', label: '예상 입원일수', unit: '일', type: 'num', def: 30 },
        { k: 'surgeryReserve', label: '수술 대비 자금', unit: '원', type: 'money', def: 0, ph: '예) 10,000,000' },
        { k: 'eduContinuity', label: '교육 연속성 자금', unit: '원', type: 'money', def: 0, ph: '예) 20,000,000' },
        { k: 'existingChildCoverage', label: '기존 자녀보험 보장액', unit: '원', type: 'money', def: 0 }
      ]}],
      outputs: {
        main: { k: 'requiredCoverageGap', label: '추가로 필요한 보장액', fmt: 'won' },
        sub: [
          { k: 'totalNeed', label: '총 필요보장', fmt: 'won' },
          { k: 'hospitalCost', label: '입원비 합계', fmt: 'won' }
        ],
        rows: [
          { k: 'diagnosisCost', label: '진단비' },
          { k: 'hospitalCost', label: '입원비' },
          { k: 'surgeryReserve', label: '수술 대비 자금' },
          { k: 'eduContinuity', label: '교육 연속성 자금' },
          { k: 'totalNeed', label: '총 필요보장', sum: true },
          { k: 'existingChildCoverage', label: '기존 보장액' }
        ]
      }
    },

insuranceAffordability: {
      id: 'insuranceAffordability', bundle: 'personal', icon: '📐', isPublic: false,
      title: '적정보험료계산기',
      lead: '소득 대비 보험료가 적정한지 진단하고 여력이 얼마나 남았는지 보여줍니다.',
      note: '보장성 보험료는 월 소득의 10%, 상한 12%를 적정선으로 봅니다. 저축성 보험은 저축으로 분류되므로 보장성과 나눠서 판단해야 합니다.',
      groups: [{ label: '소득과 보험료', fields: [
        { k: 'monthlyIncome', label: '월 소득', unit: '원', type: 'money', required: true, ph: '예) 5,000,000', quick: [500000, 1000000] },
        { k: 'protectionPremium', label: '보장성 보험료 월납', unit: '원', type: 'money', required: true, ph: '예) 400,000', quick: [100000] },
        { k: 'savingsPremium', label: '저축성 보험료 월납', unit: '원', type: 'money', def: 0, ph: '예) 300,000' }
      ]}],
      outputs: {
        main: { k: 'status', label: '진단 결과', fmt: 'text' },
        sub: [
          { k: 'protectionRatio', label: '보장성 비중', fmt: 'rate' },
          { k: 'headroom', label: '남은 여력', fmt: 'wonSigned', sign: true }
        ],
        rows: [
          { k: 'monthlyIncome', label: '월 소득' },
          { k: 'protectionPremium', label: '보장성 보험료' },
          { k: 'savingsPremium', label: '저축성 보험료' },
          { k: 'totalRatio', label: '전체 비중', fmt: 'rate' },
          { k: 'recommendedPremium', label: '권장 보험료 (10%)' },
          { k: 'ceilingPremium', label: '상한 보험료 (12%)', sum: true }
        ]
      }
    },

termVsWholeLife: {
      id: 'termVsWholeLife', bundle: 'personal', icon: '🔁', isPublic: false,
      title: '정기·종신 비교계산기',
      lead: '같은 보장을 정기보험으로 들고 차액을 굴렸을 때와 종신보험을 비교합니다.',
      note: '운용수익률 4%를 가정한 추정치입니다. 종신보험의 해지환급금과 평생 보장 가치는 반영하지 않았으므로 단순 납입액 비교로만 보셔야 합니다.',
      groups: [{ label: '보험료 비교', fields: [
        { k: 'wholeLifeMonthlyPremium', label: '종신보험 월 보험료', unit: '원', type: 'money', required: true, ph: '예) 300,000', quick: [50000] },
        { k: 'termMonthlyPremium', label: '정기보험 월 보험료', unit: '원', type: 'money', required: true, ph: '예) 80,000', quick: [10000] },
        { k: 'payYears', label: '납입 기간', unit: '년', type: 'num', required: true, def: 20 },
        { k: 'coverageAmount', label: '보장금액', unit: '원', type: 'money', def: 0, ph: '예) 300,000,000' },
        { k: 'investReturn', label: '차액 운용수익률', unit: '%', type: 'num', def: 4, scale: 0.01 }
      ]}],
      outputs: {
        main: { k: 'diffInvestFV', label: '차액 운용 시 최종 금액', fmt: 'won' },
        sub: [
          { k: 'monthlyDiff', label: '월 보험료 차이', fmt: 'won' },
          { k: 'premiumSaved', label: '납입 기간 총 차액', fmt: 'won' }
        ],
        rows: [
          { k: 'coverageAmount', label: '보장금액' },
          { k: 'wholeLifeTotalPaid', label: '종신보험 총 납입액' },
          { k: 'termTotalPaid', label: '정기보험 총 납입액' },
          { k: 'premiumSaved', label: '총 차액' },
          { k: 'diffInvestFV', label: '차액 운용 결과', sum: true }
        ]
      }
    },

medicalExpenseExposure: {
      id: 'medicalExpenseExposure', bundle: 'personal', icon: '💊', isPublic: false,
      title: '의료비 부담계산기',
      lead: '실손보험이 있을 때와 없을 때 실제로 부담하는 의료비 차이를 계산합니다.',
      note: '급여 비율 60%, 급여 본인부담 20%, 비급여 본인부담 30%, 의료비 상승률 4%를 가정한 추정치입니다. 실손보험 세대와 특약에 따라 실제 보장률은 달라집니다.',
      groups: [{ label: '의료비', fields: [
        { k: 'annualMedicalCost', label: '연간 의료비', unit: '원', type: 'money', required: true, ph: '예) 5,000,000', quick: [1000000] },
        { k: 'years', label: '누적 기간', unit: '년', type: 'num', def: 10 },
        { k: 'coveredRate', label: '급여 비율', unit: '%', type: 'num', def: 60, scale: 0.01 },
        { k: 'medicalInflation', label: '의료비 상승률', unit: '%', type: 'num', def: 4, scale: 0.01 }
      ]}],
      outputs: {
        main: { k: 'cumulativeBenefit', label: '기간 누적 보장 효과', fmt: 'won' },
        sub: [
          { k: 'exposedNoInsurance', label: '보험 없을 때 연 부담', fmt: 'won' },
          { k: 'exposedWithInsurance', label: '보험 있을 때 연 부담', fmt: 'won' }
        ],
        rows: [
          { k: 'annualMedicalCost', label: '연간 의료비' },
          { k: 'exposedNoInsurance', label: '무보험 본인부담' },
          { k: 'exposedWithInsurance', label: '실손 적용 후 부담' },
          { k: 'annualBenefit', label: '연간 보장 효과' },
          { k: 'cumulativeBenefit', label: '누적 보장 효과', sum: true }
        ]
      }
    }
  };

  global.JarviaCalcSpec = Object.assign(global.JarviaCalcSpec || {}, SPEC);
})(typeof window !== 'undefined' ? window : globalThis);
