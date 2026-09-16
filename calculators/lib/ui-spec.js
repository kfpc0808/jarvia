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
            { k: 'grossSalary', label: '연간 총급여', unit: '원', type: 'money', required: true, ph: '60,000,000', quick: [10000000, 50000000] },
            { k: 'dependents', label: '부양가족 수', hint: '본인 포함', unit: '명', type: 'num', def: 1 },
            { k: 'childrenUnder7', label: '8세 미만 자녀', unit: '명', type: 'num', def: 0 },
            { k: 'childrenOver7', label: '8세 이상 자녀', unit: '명', type: 'num', def: 0 },
            { k: 'withheld', label: '기납부 세액', hint: '원천징수 합계 · 선택', unit: '원', type: 'money', ph: '미입력 시 환급액 계산 안 함' }
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
        { t: '4대보험계산기', e: '🩺', u: './social-insurance-calculator.html' }
      ]
    }

  };

  global.JarviaCalcSpec = Object.assign(global.JarviaCalcSpec || {}, SPEC);
})(typeof window !== 'undefined' ? window : globalThis);
