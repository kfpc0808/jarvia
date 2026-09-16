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

    /* ══════════ 법인 · 세무 실무 20종 ══════════ */

    vehicleExpense: {
      id: 'vehicleExpense', bundle: 'corporate', icon: '🚗',
      title: '업무용승용차 비용계산기',
      lead: '법인 차량 비용 중 세법상 인정되는 금액과 한도 초과로 부인되는 금액을 계산합니다.',
      note: '법인세법 제27조의2 기준입니다. 운행기록부가 없으면 연 1,500만원까지만 업무사용으로 인정되고, 감가상각비는 연 800만원 한도로 이월됩니다. 업무전용 자동차보험 가입이 전제 요건입니다.',
      groups: [{ label: '차량 정보', fields: [
        { k: 'vehiclePrice', label: '차량 취득가액', unit: '원', type: 'money', required: true, ph: '예) 60,000,000', quick: [10000000] },
        { k: 'ownType', label: '보유 형태', type: 'select', def: 'purchase',
          options: [{ v: 'purchase', t: '구입' }, { v: 'lease', t: '리스' }, { v: 'rent', t: '렌트' }] },
        { k: 'annualFuelCost', label: '연간 유류·유지비', unit: '원', type: 'money', def: 0, ph: '예) 4,000,000' },
        { k: 'annualLeaseFee', label: '연간 리스료', unit: '원', type: 'money', def: 0 },
        { k: 'annualRentFee', label: '연간 렌트료', unit: '원', type: 'money', def: 0 },
        { k: 'businessRatio', label: '업무사용 비율', unit: '%', type: 'num', def: 80 },
        { k: 'hasLog', label: '운행기록부', type: 'select', cast: 'bool', def: 'true',
          options: [{ v: 'true', t: '작성함' }, { v: 'false', t: '미작성' }] }
      ]}],
      outputs: {
        main: { k: 'deductibleLimit', label: '손금 인정 한도', fmt: 'won' },
        sub: [
          { k: 'excessAmount', label: '한도 초과 부인액', fmt: 'won' },
          { k: 'totalCost', label: '총 차량 비용', fmt: 'won' }
        ],
        rows: [
          { k: 'vehiclePrice', label: '차량 취득가액' },
          { k: 'depreciationEquivalent', label: '감가상각비 상당액' },
          { k: 'allowedDepreciation', label: '인정 감가상각비' },
          { k: 'allowedOtherExpense', label: '인정 기타비용' },
          { k: 'deductibleLimit', label: '손금 인정 합계', sum: true }
        ]
      }
    },

    entertainmentLimit: {
      id: 'entertainmentLimit', bundle: 'corporate', icon: '🍽️',
      title: '접대비 한도계산기',
      lead: '기업업무추진비(접대비) 손금 한도와 초과로 부인되는 금액을 계산합니다.',
      note: '법인세법 제25조 기준입니다. 기본한도에 수입금액별 적용률을 더해 산출하며, 문화접대비는 별도 추가 한도가 적용됩니다. 2026년 기준 추정치입니다.',
      groups: [{ label: '수입과 지출', fields: [
        { k: 'revenue', label: '연간 수입금액', unit: '원', type: 'money', required: true, ph: '예) 5,000,000,000', quick: [100000000, 1000000000] },
        { k: 'actualExpense', label: '실제 접대비 지출액', unit: '원', type: 'money', required: true, ph: '예) 50,000,000', quick: [10000000] },
        { k: 'culturalExpense', label: '문화접대비', unit: '원', type: 'money', def: 0 },
        { k: 'relatedPartyRevenue', label: '특수관계자 매출', unit: '원', type: 'money', def: 0 }
      ]}],
      outputs: {
        main: { k: 'nonDeductible', label: '손금 부인액', fmt: 'won' },
        sub: [
          { k: 'finalLimit', label: '접대비 한도', fmt: 'won' },
          { k: 'deductible', label: '손금 인정액', fmt: 'won' }
        ],
        rows: [
          { k: 'revenue', label: '수입금액' },
          { k: 'baseLimit', label: '기본한도' },
          { k: 'revenueLimit', label: '수입금액 기준 한도' },
          { k: 'culturalAmt', label: '문화접대비 추가한도' },
          { k: 'finalLimit', label: '총 한도', sum: true },
          { k: 'actualExpense', label: '실제 지출액' }
        ]
      }
    },

    employmentCredit: {
      id: 'employmentCredit', bundle: 'corporate', icon: '👥',
      title: '고용증대 세액공제계산기',
      lead: '직원을 늘렸을 때 받을 수 있는 통합고용세액공제액을 계산합니다.',
      note: '조세특례제한법 제29조의8 기준 추정치입니다. 상시근로자 수는 월평균으로 산정하며, 공제 후 2년 내 인원이 줄면 추징됩니다. 정확한 금액은 연도별 근로자 수 확인이 필요합니다.',
      groups: [{ label: '고용 증가', fields: [
        { k: 'newEmployees', label: '증가한 상시근로자 수', unit: '명', type: 'num', required: true, def: 3 },
        { k: 'newYouthEmployees', label: '그중 청년·장애인 등', hint: '우대 대상', unit: '명', type: 'num', def: 0 },
        { k: 'region', label: '사업장 지역', type: 'select', def: 'other',
          options: [{ v: 'other', t: '수도권 밖' }, { v: 'capital', t: '수도권' }] },
        { k: 'isSME', label: '기업 규모', type: 'select', cast: 'bool', def: 'true',
          options: [{ v: 'true', t: '중소기업' }, { v: 'false', t: '중견·대기업' }] }
      ]}],
      outputs: {
        main: { k: 'totalCredit1st', label: '1차년도 세액공제', fmt: 'won' },
        sub: [
          { k: 'youthTotal', label: '청년 등 공제', fmt: 'won' },
          { k: 'generalTotal', label: '일반 공제', fmt: 'won' }
        ],
        rows: [
          { k: 'newEmployees', label: '증가 인원', fmt: 'cnt' },
          { k: 'newYouthEmployees', label: '청년 등 인원', fmt: 'cnt' },
          { k: 'empCredit', label: '고용증대 공제액' },
          { k: 'total3years', label: '3년 누적 공제액', sum: true }
        ]
      }
    },

    rnDCredit: {
      id: 'rnDCredit', bundle: 'corporate', icon: '🔬',
      title: '연구인력개발비 세액공제계산기',
      lead: 'R&D 지출에 대한 세액공제를 당기분과 증가분 방식으로 비교해 유리한 쪽을 찾습니다.',
      note: '조세특례제한법 제10조 기준 추정치입니다. 중소기업은 당기분 25%, 증가분 50%가 적용되며 둘 중 유리한 쪽을 선택할 수 있습니다. 기업부설연구소 인정 등 요건 충족이 전제입니다.',
      groups: [{ label: 'R&D 지출', fields: [
        { k: 'currentRnD', label: '당기 연구개발비', unit: '원', type: 'money', required: true, ph: '예) 200,000,000', quick: [10000000, 100000000] },
        { k: 'priorAvgRnD', label: '직전 4년 평균 연구개발비', unit: '원', type: 'money', def: 0, ph: '예) 150,000,000' },
        { k: 'corpTaxable', label: '법인 과세표준', unit: '원', type: 'money', def: 0, ph: '예) 500,000,000' },
        { k: 'isSME', label: '기업 규모', type: 'select', cast: 'bool', def: 'true',
          options: [{ v: 'true', t: '중소기업' }, { v: 'false', t: '중견·대기업' }] },
        { k: 'method', label: '공제 방식', type: 'select', def: 'better',
          options: [{ v: 'better', t: '유리한 쪽 자동 선택' }, { v: 'current', t: '당기분' }, { v: 'incremental', t: '증가분' }] }
      ]}],
      outputs: {
        main: { k: 'selectedCredit', label: '세액공제액', fmt: 'won' },
        sub: [
          { k: 'betterMethod', label: '유리한 방식', fmt: 'text' },
          { k: 'currentRate', label: '당기분 공제율', fmt: 'rate' }
        ],
        rows: [
          { k: 'currentRnD', label: '당기 연구개발비' },
          { k: 'priorAvgRnD', label: '직전 4년 평균' },
          { k: 'increaseAmt', label: '증가액' },
          { k: 'currentCredit', label: '당기분 공제액' },
          { k: 'incrementalCredit', label: '증가분 공제액' },
          { k: 'selectedCredit', label: '적용 공제액', sum: true }
        ]
      }
    },

    inventionCompensation: {
      id: 'inventionCompensation', bundle: 'corporate', icon: '💡',
      title: '직무발명보상금계산기',
      lead: '직원에게 지급하는 직무발명보상금의 비과세 한도와 절세 효과를 계산합니다.',
      note: '소득세법 시행령 제17조의3 기준으로 연 700만원까지 비과세됩니다. 지배주주 및 특수관계자는 비과세 대상에서 제외됩니다. 2026년 기준 추정치입니다.',
      groups: [{ label: '보상금', fields: [
        { k: 'compensation', label: '직무발명보상금', unit: '원', type: 'money', required: true, ph: '예) 10,000,000', quick: [1000000] },
        { k: 'otherIncome', label: '해당 직원 연간 급여', unit: '원', type: 'money', def: 0, ph: '예) 80,000,000' },
        { k: 'isControllingShareholder', label: '지배주주 여부', type: 'select', cast: 'bool', def: 'false',
          options: [{ v: 'false', t: '일반 직원' }, { v: 'true', t: '지배주주·특수관계자' }] }
      ]}],
      outputs: {
        main: { k: 'taxSaving', label: '비과세로 인한 절세액', fmt: 'won' },
        sub: [
          { k: 'exemptAmount', label: '비과세 금액', fmt: 'won' },
          { k: 'taxableAmount', label: '과세 대상 금액', fmt: 'won' }
        ],
        rows: [
          { k: 'compensation', label: '보상금 총액' },
          { k: 'exemptAmount', label: '비과세 (한도 700만원)' },
          { k: 'taxableAmount', label: '과세 대상' },
          { k: 'taxOnExcess', label: '과세분 세액', sum: true }
        ]
      }
    },

    patentCapitalization: {
      id: 'patentCapitalization', bundle: 'corporate', icon: '📜',
      title: '특허권 자본화계산기',
      lead: '대표 개인 특허를 법인에 양도할 때의 세부담과 급여로 받을 때를 비교합니다.',
      note: '특허권 양도대가는 기타소득으로 필요경비 60%가 인정됩니다. 법인은 무형자산으로 계상해 감가상각합니다. 실제 적용에는 특허 가치평가와 적정 대가 산정이 필요합니다.',
      groups: [{ label: '양도 조건', fields: [
        { k: 'transferPrice', label: '특허권 양도대가', unit: '원', type: 'money', required: true, ph: '예) 300,000,000', quick: [10000000, 100000000] },
        { k: 'otherIncome', label: '대표 기타 종합소득금액', unit: '원', type: 'money', def: 0 }
      ]}],
      outputs: {
        main: { k: 'netEffect', label: '순 절세 효과', fmt: 'won' },
        sub: [
          { k: 'personalTax', label: '개인 세부담', fmt: 'won' },
          { k: 'corpTaxSaving', label: '법인 절세액', fmt: 'won' }
        ],
        rows: [
          { k: 'transferPrice', label: '양도대가' },
          { k: 'otherIncomeAmt', label: '기타소득금액 (경비 60% 차감)' },
          { k: 'personalTax', label: '개인 세부담' },
          { k: 'salaryTax', label: '급여로 받을 때 세부담' },
          { k: 'vsSalarySaving', label: '급여 대비 절감액', sum: true }
        ]
      }
    },

    carryforwardLoss: {
      id: 'carryforwardLoss', bundle: 'corporate', icon: '📉',
      title: '이월결손금계산기',
      lead: '과거 결손금을 올해 얼마나 공제할 수 있는지와 남는 금액을 계산합니다.',
      note: '법인세법 제13조 기준입니다. 이월결손금은 발생 후 15년간 공제할 수 있으며, 중소기업은 100%, 그 외는 소득금액의 80%가 한도입니다. 2026년 기준 추정치입니다.',
      groups: [{ label: '결손금과 소득', fields: [
        { k: 'carryforwardLoss', label: '이월결손금 잔액', unit: '원', type: 'money', required: true, ph: '예) 500,000,000', quick: [10000000, 100000000] },
        { k: 'currentIncome', label: '당기 소득금액', unit: '원', type: 'money', required: true, ph: '예) 300,000,000', quick: [10000000, 100000000] },
        { k: 'isSME', label: '기업 규모', type: 'select', cast: 'bool', def: 'true',
          options: [{ v: 'true', t: '중소기업 (100% 공제)' }, { v: 'false', t: '그 외 (80% 한도)' }] }
      ]}],
      outputs: {
        main: { k: 'actualDeduction', label: '올해 공제 가능액', fmt: 'won' },
        sub: [
          { k: 'taxSaving', label: '절세액', fmt: 'won' },
          { k: 'remainingLoss', label: '남은 이월결손금', fmt: 'won' }
        ],
        rows: [
          { k: 'carryforwardLoss', label: '이월결손금 잔액' },
          { k: 'currentIncome', label: '당기 소득금액' },
          { k: 'limitRate', label: '공제 한도율', fmt: 'pct' },
          { k: 'deductLimit', label: '공제 한도액' },
          { k: 'taxBaseAfter', label: '공제 후 과세표준', sum: true }
        ]
      }
    },

    stockOption: {
      id: 'stockOption', bundle: 'corporate', icon: '🎟️',
      title: '주식매수선택권계산기',
      lead: '스톡옵션을 행사할 때 내야 하는 세금과 벤처기업 비과세 특례를 계산합니다.',
      note: '행사이익은 근로소득으로 과세됩니다. 벤처기업 주식매수선택권은 연 2억원·누적 5억원 한도로 비과세 특례가 적용됩니다. 조세특례제한법 제16조의2 기준 추정치입니다.',
      groups: [{ label: '행사 조건', fields: [
        { k: 'marketPrice', label: '행사 시 주당 시가', unit: '원', type: 'money', required: true, ph: '예) 50,000' },
        { k: 'exercisePrice', label: '주당 행사가액', unit: '원', type: 'money', required: true, ph: '예) 20,000' },
        { k: 'shares', alias: ['numShares'], label: '행사 주식 수', unit: '주', type: 'num', required: true, def: 10000 },
        { k: 'annualIncome', label: '연간 근로소득', hint: '행사이익 제외', unit: '원', type: 'money', def: 0, ph: '예) 80,000,000' },
        { k: 'isVenture', label: '벤처기업 여부', type: 'select', cast: 'bool', def: 'false',
          options: [{ v: 'false', t: '일반기업' }, { v: 'true', t: '벤처기업' }] }
      ]}],
      outputs: {
        main: { k: 'totalTax', label: '예상 세부담', fmt: 'won' },
        sub: [
          { k: 'exerciseGain', label: '행사이익', fmt: 'won' },
          { k: 'effectiveRate', label: '실효세율', fmt: 'pct' }
        ],
        rows: [
          { k: 'exerciseGain', label: '행사이익 (시가−행사가)' },
          { k: 'ventureExemptAmount', label: '벤처 비과세 적용액' },
          { k: 'taxableAfterExemption', label: '과세 대상 행사이익' },
          { k: 'taxBase', label: '과세표준', sum: true }
        ]
      }
    },

    welfareFund: {
      id: 'welfareFund', bundle: 'corporate', icon: '🎁',
      title: '사내근로복지기금계산기',
      lead: '사내근로복지기금 출연금의 손금 효과와 직원 1인당 혜택을 계산합니다.',
      note: '출연금은 전액 손금으로 인정되고 직원에게는 비과세 복지로 지급됩니다. 근로복지기본법에 따른 설립·운영 요건 충족이 전제이며, 출연 후 환원이 제한됩니다.',
      groups: [{ label: '출연 계획', fields: [
        { k: 'outputAmount', label: '출연 금액', unit: '원', type: 'money', required: true, ph: '예) 100,000,000', quick: [10000000] },
        { k: 'taxableIncomeBefore', label: '출연 전 과세표준', unit: '원', type: 'money', def: 0, ph: '예) 500,000,000' },
        { k: 'numEmployees', label: '직원 수', unit: '명', type: 'num', def: 10 },
        { k: 'isSME', label: '기업 규모', type: 'select', cast: 'bool', def: 'true',
          options: [{ v: 'true', t: '중소기업' }, { v: 'false', t: '그 외' }] },
        { k: 'deductibilityConfirmed', label: '손금산입 요건 충족', hint: '규정·집행자료 확인됨', type: 'select', cast: 'bool', def: 'true',
          options: [{ v: 'true', t: '충족 (전액 손금)' }, { v: 'false', t: '미확인 (절감액 계산 안 함)' }] }
      ]}],
      outputs: {
        main: { k: 'taxSaving', label: '법인세 절감액', fmt: 'won' },
        sub: [
          { k: 'netBurden', label: '실질 부담액', fmt: 'won' },
          { k: 'perEmployee', label: '직원 1인당 혜택', fmt: 'won' }
        ],
        rows: [
          { k: 'outputAmount', label: '출연 금액' },
          { k: 'taxableIncomeBefore', label: '출연 전 과세표준' },
          { k: 'taxableAfter', label: '출연 후 과세표준' },
          { k: 'taxBefore', label: '출연 전 법인세' },
          { k: 'taxAfter', label: '출연 후 법인세', sum: true }
        ]
      }
    },

    socialInsuranceCorp: {
      id: 'socialInsuranceCorp', bundle: 'corporate', icon: '🩺',
      title: '법인 4대보험계산기',
      lead: '급여 총액 기준으로 회사가 부담하는 4대보험료를 계산합니다.',
      note: '2026년 요율 기준 추정치입니다. 산재보험료율은 업종별로 달라 별도 확인이 필요하며, 고용보험 사업주 추가부담분은 기업 규모에 따라 달라집니다.',
      groups: [{ label: '급여 총액', fields: [
        { k: 'totalMonthlySalary', label: '월 급여 총액', hint: '전 직원 합계', unit: '원', type: 'money', required: true, ph: '예) 50,000,000', quick: [10000000] },
        { k: 'numEmployees', label: '직원 수', unit: '명', type: 'num', def: 10 }
      ]}],
      outputs: {
        main: { path: 'monthly.total', k: 'monthlyTotal', label: '회사 부담 월 보험료', fmt: 'won' },
        sub: [
          { k: 'annualBurden', label: '연간 부담액', fmt: 'won' },
          { k: 'totalMonthlySalary', label: '월 급여 총액', fmt: 'won' }
        ],
        rows: [
          { path: 'monthly.nationalPension', label: '국민연금' },
          { path: 'monthly.healthInsurance', label: '건강보험' },
          { path: 'monthly.longTermCare', label: '장기요양보험' },
          { path: 'monthly.employment', label: '고용보험' },
          { path: 'monthly.totalKnown', label: '확인 가능 합계', sum: true }
        ]
      }
    },

    corpInterimTax: {
      id: 'corpInterimTax', bundle: 'corporate', icon: '📆',
      title: '법인세 중간예납계산기',
      lead: '8월 중간예납 세액을 전년도 기준과 가결산 기준으로 비교해 유리한 쪽을 찾습니다.',
      note: '법인세법 제63조 기준입니다. 직전 사업연도 산출세액의 절반 또는 상반기 가결산 중 선택할 수 있습니다. 상반기 실적이 나쁘면 가결산이 유리합니다.',
      groups: [{ label: '기준 금액', fields: [
        { k: 'priorYearFinalTax', label: '직전 사업연도 산출세액', unit: '원', type: 'money', required: true, ph: '예) 60,000,000', quick: [10000000] },
        { k: 'firstHalfTaxableIncome', label: '상반기 과세표준', hint: '가결산 기준', unit: '원', type: 'money', def: 0, ph: '예) 200,000,000' }
      ]}],
      outputs: {
        main: { k: 'amount', label: '중간예납 세액', fmt: 'won' },
        sub: [
          { k: 'recommended', label: '유리한 방식', fmt: 'text', map: { prior: '전년도 기준', provisional: '가결산 기준' } },
          { k: 'saving', label: '절감액', fmt: 'won' }
        ],
        rows: [
          { k: 'priorBased', label: '전년도 기준 세액' },
          { k: 'provisional', label: '가결산 기준 세액' },
          { k: 'amount', label: '선택 세액', sum: true },
          { k: 'dueDate', label: '납부 기한', fmt: 'text' }
        ]
      }
    },

    vatPreliminaryChoice: {
      id: 'vatPreliminaryChoice', bundle: 'corporate', icon: '🧾',
      title: '부가세 예정신고 선택계산기',
      lead: '예정고지를 그대로 낼지, 예정신고를 해서 줄일지 판단합니다.',
      note: '부가가치세법 제48조 기준입니다. 직전 과세기간 납부세액의 절반이 예정고지되며, 사업이 부진하거나 조기환급 사유가 있으면 예정신고를 선택할 수 있습니다.',
      groups: [{ label: '고지와 실적', fields: [
        { k: 'priorPeriodVatPaid', label: '직전 과세기간 납부세액', unit: '원', type: 'money', required: true, ph: '예) 20,000,000', quick: [1000000] },
        { k: 'priorPeriodSales', label: '직전 과세기간 공급가액', unit: '원', type: 'money', def: 0, ph: '예) 2,000,000,000' },
        { k: 'currentQuarterSales', label: '이번 예정기간 공급가액', unit: '원', type: 'money', def: 0, ph: '예) 400,000,000' },
        { k: 'currentQuarterVatEstimate', label: '이번 예정기간 납부세액 추정', unit: '원', type: 'money', def: 0, ph: '예) 3,000,000' }
      ]}],
      outputs: {
        main: { k: 'noticeAmount', label: '예정고지 세액', fmt: 'won' },
        sub: [
          { k: 'recommended', label: '권장 선택', fmt: 'text', map: { notice: '예정고지 그대로 납부', return: '예정신고 권장' } },
          { k: 'eligibleForReturn', label: '예정신고 가능', fmt: 'yn' }
        ],
        rows: [
          { k: 'noticeAmount', label: '예정고지 세액' },
          { k: 'estimatedReturnVat', label: '예정신고 시 추정 세액' },
          { k: 'cashEffectIfReturn', label: '자금 효과', sum: true },
          { k: 'dueDate', label: '납부 기한', fmt: 'text' }
        ]
      }
    },

    corpRealEstateHold: {
      id: 'corpRealEstateHold', bundle: 'corporate', icon: '🏗️',
      title: '법인 부동산 보유·양도 비교계산기',
      lead: '같은 부동산을 개인이 보유할 때와 법인이 보유할 때의 양도 세부담을 비교합니다.',
      note: '법인은 양도차익에 법인세와 토지등 양도소득 추가과세가 적용되고, 개인은 양도소득세가 적용됩니다. 보유세와 취득세까지 포함한 총비용은 별도 검토가 필요합니다.',
      groups: [{ label: '양도 조건', fields: [
        { k: 'transferPrice', label: '양도가액', unit: '원', type: 'money', required: true, ph: '예) 1,500,000,000', quick: [100000000] },
        { k: 'acquirePrice', label: '취득가액', unit: '원', type: 'money', required: true, ph: '예) 1,000,000,000', quick: [100000000] },
        { k: 'expenses', label: '필요경비', unit: '원', type: 'money', def: 0 },
        { k: 'holdingYears', label: '보유 기간', unit: '년', type: 'num', def: 5 },
        { k: 'assetType', label: '자산 종류', type: 'select', def: 'house',
          options: [{ v: 'house', t: '주택' }, { v: 'land', t: '토지' }, { v: 'building', t: '건물·상가' }] }
      ]}],
      outputs: {
        main: { k: 'cheaper', label: '세부담이 낮은 쪽', fmt: 'text', map: { individual: '개인 보유가 유리', corporate: '법인 보유가 유리', equal: '차이 없음' } },
        sub: [
          { path: 'individual.totalTax', k: 'individualTotal', label: '개인 보유 시', fmt: 'won' },
          { path: 'corporate.totalTax', k: 'corporateTotal', label: '법인 보유 시', fmt: 'won' }
        ],
        rows: [
          { k: 'capitalGain', label: '양도차익' },
          { path: 'individual.totalTax', label: '개인 세부담' },
          { path: 'corporate.totalTax', label: '법인 세부담' },
          { k: 'difference', label: '차이', sum: true }
        ]
      }
    },

    acquisitionTaxSurcharge: {
      id: 'acquisitionTaxSurcharge', bundle: 'corporate', icon: '🏚️',
      title: '취득세 중과계산기',
      lead: '법인이 부동산을 취득할 때 중과세율이 적용되는지와 세액을 계산합니다.',
      note: '지방세법 제13조·제13조의2 기준입니다. 법인의 주택 취득은 12%가 적용되고, 과밀억제권역 내 설립 5년 이내 법인의 부동산 취득은 표준세율에 중과분이 더해집니다.',
      groups: [{ label: '취득 정보', fields: [
        { k: 'price', label: '취득가액', unit: '원', type: 'money', required: true, ph: '예) 800,000,000', quick: [100000000] },
        { k: 'propertyType', label: '부동산 종류', type: 'select', def: 'commercial',
          options: [{ v: 'commercial', t: '상가·업무용' }, { v: 'housing', t: '주택' }, { v: 'land', t: '토지' }] },
        { k: 'isOverConcentrationArea', label: '과밀억제권역', type: 'select', cast: 'bool', def: 'false',
          options: [{ v: 'false', t: '해당 없음' }, { v: 'true', t: '과밀억제권역 내' }] },
        { k: 'corpFoundedYears', label: '법인 설립 경과', unit: '년', type: 'num', def: 10 }
      ]}],
      outputs: {
        main: { k: 'tax', label: '취득세', fmt: 'won' },
        sub: [
          { k: 'appliedRate', label: '적용 세율', fmt: 'rate' },
          { k: 'extra', label: '중과 추가분', fmt: 'won' }
        ],
        rows: [
          { k: 'standardRate', label: '표준세율', fmt: 'rate' },
          { k: 'appliedRate', label: '적용세율', fmt: 'rate' },
          { k: 'normalTax', label: '표준세율 적용 시' },
          { k: 'tax', label: '실제 취득세', sum: true }
        ]
      }
    },

    relatedPartyRent: {
      id: 'relatedPartyRent', bundle: 'corporate', icon: '🔗',
      title: '특수관계자 임대료계산기',
      lead: '대표와 법인 간 임대차의 임대료가 시가 범위를 벗어나 부인되는지 판정합니다.',
      note: '법인세법 제52조 부당행위계산 부인 기준입니다. 시가와 5% 또는 3억원 이상 차이나면 부인 대상이 됩니다. 시가는 감정평가액 또는 시행령상 간주임대료로 산정합니다.',
      groups: [{ label: '임대 조건', fields: [
        { k: 'actualAnnualRent', label: '실제 연간 임대료', unit: '원', type: 'money', required: true, ph: '예) 24,000,000', quick: [1000000] },
        { k: 'propertyValue', label: '부동산 시가', unit: '원', type: 'money', def: 0, ph: '예) 1,000,000,000' },
        { k: 'marketAnnualRent', label: '시가 임대료', hint: '감정평가 있으면 입력', unit: '원', type: 'money', def: 0 },
        { k: 'corpIsLessee', label: '법인의 지위', type: 'select', cast: 'bool', def: 'true',
          options: [{ v: 'true', t: '법인이 임차 (대표 소유 부동산)' }, { v: 'false', t: '법인이 임대 (법인 소유)' }] }
      ]}],
      outputs: {
        main: { k: 'consequence', label: '판정 결과', fmt: 'text' },
        sub: [
          { k: 'difference', label: '시가와의 차이', fmt: 'won' },
          { k: 'differenceRate', label: '차이 비율', fmt: 'pct' }
        ],
        rows: [
          { k: 'actualAnnualRent', label: '실제 임대료' },
          { k: 'marketAnnualRent', label: '시가 임대료' },
          { k: 'marketBasis', label: '시가 산정 근거', fmt: 'text' },
          { k: 'difference', label: '차액', sum: true }
        ]
      }
    },

    holidayBonusCompare: {
      id: 'holidayBonusCompare', bundle: 'corporate', icon: '🎊',
      title: '상여금·복리후생비 비교계산기',
      lead: '명절 상여를 급여로 줄 때와 복리후생으로 줄 때의 회사·직원 부담을 비교합니다.',
      note: '급여로 지급하면 4대보험과 소득세가 붙고, 복리후생비는 요건에 따라 비과세될 수 있습니다. 실제 적용은 지급 방식과 사내 규정 정비가 전제입니다.',
      groups: [{ label: '지급 계획', fields: [
        { k: 'perPersonAmount', label: '1인당 지급액', unit: '원', type: 'money', required: true, ph: '예) 1,000,000', quick: [100000] },
        { k: 'headcount', label: '지급 인원', unit: '명', type: 'num', required: true, def: 20 }
      ]}],
      outputs: {
        main: { k: 'totalAmount', label: '총 지급액', fmt: 'won' },
        sub: [
          { k: 'employerCostGap', label: '회사 부담 차이', fmt: 'won' },
          { k: 'employeeNetGap', label: '직원 실수령 차이', fmt: 'won' }
        ],
        rows: [
          { k: 'perPersonAmount', label: '1인당 지급액' },
          { k: 'headcount', label: '지급 인원', fmt: 'cnt' },
          { k: 'totalAmount', label: '총 지급액', sum: true }
        ]
      }
    },

    dcContributionLimit: {
      id: 'dcContributionLimit', bundle: 'corporate', icon: '🏦',
      title: 'DC부담금 한도계산기',
      lead: '확정기여형 퇴직연금에 회사가 넣을 수 있는 금액과 손금 한도를 계산합니다.',
      note: '근로자퇴직급여보장법 기준으로 연간 임금총액의 1/12 이상을 부담해야 합니다. 임원 부담금은 정관·규정에 정한 한도 내에서만 손금으로 인정됩니다.',
      groups: [{ label: '급여와 부담금', fields: [
        { k: 'employeeAnnualSalaryTotal', label: '직원 연간 임금총액', unit: '원', type: 'money', required: true, ph: '예) 600,000,000', quick: [10000000, 100000000] },
        { k: 'executiveAnnualSalaryTotal', label: '임원 연간 급여총액', unit: '원', type: 'money', def: 0 },
        { k: 'executiveInPlan', label: '임원 가입 여부', type: 'select', cast: 'bool', def: 'false',
          options: [{ v: 'false', t: '직원만 가입' }, { v: 'true', t: '임원 포함' }] },
        { k: 'corpTaxableIncome', label: '법인 과세표준', hint: '절감액 계산용', unit: '원', type: 'money', def: 0, ph: '예) 500,000,000' }
      ]}],
      outputs: {
        main: { k: 'totalDeductible', label: '손금 인정 한도', fmt: 'won' },
        sub: [
          { k: 'employeeRequired', label: '직원 최소 부담금', fmt: 'won' },
          { k: 'corpTaxSaving', label: '법인세 절감액', fmt: 'won' }
        ],
        rows: [
          { k: 'employeeRequired', label: '직원 최소 부담금 (1/12)' },
          { k: 'executiveRequired', label: '임원 부담금' },
          { k: 'executiveDeductible', label: '임원분 손금 인정액' },
          { k: 'totalDeductible', label: '손금 합계', sum: true }
        ]
      }
    },

    corpInsuranceMaturity: {
      id: 'corpInsuranceMaturity', bundle: 'corporate', icon: '📑',
      title: '법인보험 만기계산기',
      lead: '법인 명의 보험의 만기·해약 시 익금 산입액과 법인세를 계산합니다.',
      note: '법인 계약은 개인의 10년 비과세가 적용되지 않아 만기·해약금이 전액 익금으로 산입됩니다. 대표에게 계약자를 변경하면 그 시점의 해약환급금이 상여로 처리됩니다.',
      groups: [{ label: '보험 정보', fields: [
        { k: 'receivedAmount', label: '수령액', hint: '만기금 또는 해약환급금', unit: '원', type: 'money', required: true, ph: '예) 200,000,000', quick: [10000000] },
        { k: 'bookedAsset', label: '장부상 자산 계상액', unit: '원', type: 'money', def: 0, ph: '예) 150,000,000' },
        { k: 'event', label: '처리 유형', type: 'select', def: 'maturity',
          options: [{ v: 'maturity', t: '만기 수령' }, { v: 'surrender', t: '중도 해약' }, { v: 'transferToExec', t: '대표에게 계약자 변경' }] }
      ]}],
      outputs: {
        main: { k: 'corpTaxOnGain', label: '법인세 부담', fmt: 'won' },
        sub: [
          { k: 'taxableGain', label: '익금 산입액', fmt: 'won' },
          { k: 'netToCorp', label: '법인 순수령액', fmt: 'won' }
        ],
        rows: [
          { k: 'receivedAmount', label: '수령액' },
          { k: 'bookedAsset', label: '장부상 자산' },
          { k: 'taxableGain', label: '익금 산입액' },
          { k: 'netToCorp', label: '세후 순수령액', sum: true }
        ]
      }
    },

    sincereReportCheck: {
      id: 'sincereReportCheck', bundle: 'corporate', icon: '✅',
      title: '성실신고 대상판정계산기',
      lead: '수입금액 기준으로 성실신고확인 대상인지 판정하고 기준까지 여유를 보여줍니다.',
      note: '소득세법 제70조의2 기준입니다. 업종별 수입금액 기준을 넘으면 성실신고확인서 제출이 의무이고, 미제출 시 가산세가 부과됩니다. 확인비용은 세액공제 대상입니다.',
      groups: [{ label: '수입금액', fields: [
        { k: 'revenue', label: '연간 수입금액', unit: '원', type: 'money', required: true, ph: '예) 1,500,000,000', quick: [100000000] },
        { k: 'businessGroup', label: '업종 구분', type: 'select', def: 'service',
          options: [{ v: 'trade', t: '도소매·부동산매매 (15억)' }, { v: 'manufacturing', t: '제조·건설·음식숙박 (7.5억)' }, { v: 'service', t: '서비스·임대·전문직 (5억)' }] }
      ]}],
      outputs: {
        main: { k: 'isTarget', label: '성실신고확인 대상 여부', fmt: 'yn' },
        sub: [
          { k: 'threshold', label: '업종별 기준금액', fmt: 'won' },
          { k: 'marginToThreshold', label: '기준까지 여유', fmt: 'wonSigned', sign: true }
        ],
        rows: [
          { k: 'revenue', label: '연간 수입금액' },
          { k: 'threshold', label: '기준금액' },
          { k: 'marginRate', label: '기준 대비 비율', fmt: 'pct' },
          { k: 'filingDeadline', label: '신고 기한', fmt: 'text' },
          { k: 'verificationCostCredit', label: '확인비용 세액공제 한도', sum: true }
        ]
      }
    },

    overseasAsset: {
      id: 'overseasAsset', bundle: 'corporate', icon: '🌏',
      title: '해외금융계좌 신고계산기',
      lead: '해외 계좌 잔액이 신고 기준을 넘는지와 미신고 시 과태료를 계산합니다.',
      note: '국제조세조정법 제53조 기준입니다. 매월 말일 중 하루라도 잔액 합계가 5억원을 넘으면 다음 해 6월에 신고해야 하며, 미신고 시 최대 20%의 과태료가 부과됩니다.',
      groups: [{ label: '해외 계좌', fields: [
        { k: 'overseasBalance', label: '해외금융계좌 최대 잔액', hint: '매월 말일 기준 최대', unit: '원', type: 'money', required: true, ph: '예) 800,000,000', quick: [100000000] },
        { k: 'overseasIncome', label: '해외 금융소득', unit: '원', type: 'money', def: 0 },
        { k: 'hasReported', label: '신고 여부', type: 'select', cast: 'bool', def: 'false',
          options: [{ v: 'false', t: '미신고' }, { v: 'true', t: '신고 완료' }] }
      ]}],
      outputs: {
        main: { k: 'penalty', label: '미신고 시 과태료', fmt: 'won' },
        sub: [
          { k: 'isSubject', label: '신고 대상 여부', fmt: 'yn' },
          { k: 'reportThreshold', label: '신고 기준금액', fmt: 'won' }
        ],
        rows: [
          { k: 'reportBalance', label: '신고 기준 잔액' },
          { k: 'reportThreshold', label: '기준금액' },
          { k: 'penalty', label: '과태료', sum: true },
          { k: 'riskLevel', label: '위험도', fmt: 'text' }
        ]
      }
    }

  };

  global.JarviaCalcSpec = Object.assign(global.JarviaCalcSpec || {}, SPEC);
})(typeof window !== 'undefined' ? window : globalThis);
