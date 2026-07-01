/* JARVIA calculators browser bundle — generated from functions/calculators */
(function(global){
'use strict';
var modules={
"./personal": function(module, exports, require, __filename, __dirname) {
/**
 * JARVIA 개인용 PPT 계산 모듈
 * 원본: GitHub kfpc0808/jarvia/calculators/*.html에서 JS 로직 추출
 * 용도: Cloud Functions에서 PPT 생성 파이프라인 내 계산 결과 제공
 * 
 * 모든 함수는 순수 함수 (DOM 의존성 없음, Node.js 환경 실행 가능)
 */

function _invalidCalculation(calculator, missingInputs = [], warnings = []) {
  return { calculated: false, calculator, missingInputs, invalidInputs: [], warnings };
}

function _missingFinite(params, keys) {
  const source = params && typeof params === 'object' ? params : {};
  return keys.filter(key => !Number.isFinite(Number(source[key])));
}

// ═══════════════════════════════════════════════════════════
// 1. 기본 재무 함수 (financial-calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 미래가치(FV) 계산
 * @param {number} rate - 기간 이자율 (예: 월이율 0.003333)
 * @param {number} nper - 총 기간 수 (예: 300개월)
 * @param {number} pmt - 기간별 납입액 (음수: 납입)
 * @param {number} pv - 현재가치 (음수: 투자원금)
 * @param {number} type - 0: 기말납, 1: 기초납
 * @returns {number} 미래가치
 */
function calculateFV(rate, nper, pmt, pv, type = 0) {
  if (![rate, nper, pmt, pv, type].every(Number.isFinite)) {
    throw new TypeError('calculateFV: 모든 인자는 유한한 숫자여야 합니다.');
  }
  if (nper < 0) throw new RangeError('calculateFV: nper는 0 이상이어야 합니다.');
  if (rate <= -1) throw new RangeError('calculateFV: rate는 -1보다 커야 합니다.');
  if (rate === 0) return -(pv + pmt * nper);
  const pvFactor = Math.pow(1 + rate, nper);
  const pmtFactor = (1 + rate * type) * ((pvFactor - 1) / rate);
  const result = -(pv * pvFactor + pmt * pmtFactor);
  if (!Number.isFinite(result)) throw new RangeError('calculateFV: 계산결과가 유효 범위를 벗어났습니다.');
  return result;
}

/**
 * 현재가치(PV) 계산
 */
function calculatePV(rate, nper, pmt, fv = 0, type = 0) {
  if (![rate, nper, pmt, fv, type].every(Number.isFinite)) {
    throw new TypeError('calculatePV: 모든 인자는 유한한 숫자여야 합니다.');
  }
  if (nper < 0) throw new RangeError('calculatePV: nper는 0 이상이어야 합니다.');
  if (rate <= -1) throw new RangeError('calculatePV: rate는 -1보다 커야 합니다.');
  if (rate === 0) return -(fv + pmt * nper);
  const pvFactor = Math.pow(1 + rate, nper);
  const pmtFactor = (1 + rate * type) * ((pvFactor - 1) / rate);
  const result = -(fv + pmt * pmtFactor) / pvFactor;
  if (!Number.isFinite(result)) throw new RangeError('calculatePV: 계산결과가 유효 범위를 벗어났습니다.');
  return result;
}

/**
 * 기간납입액(PMT) 계산
 */
function calculatePMT(rate, nper, pv, fv = 0, type = 0) {
  if (![rate, nper, pv, fv, type].every(Number.isFinite)) {
    throw new TypeError('calculatePMT: 모든 인자는 유한한 숫자여야 합니다.');
  }
  if (nper <= 0) throw new RangeError('calculatePMT: nper는 0보다 커야 합니다.');
  if (rate <= -1) throw new RangeError('calculatePMT: rate는 -1보다 커야 합니다.');
  if (rate === 0) return -(pv + fv) / nper;
  const pvFactor = Math.pow(1 + rate, nper);
  const denominator = (1 + rate * type) * (pvFactor - 1);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-15) {
    throw new RangeError('calculatePMT: 계산 가능한 이자율·기간 조합이 아닙니다.');
  }
  return -(rate * (fv + pv * pvFactor)) / denominator;
}

/**
 * 이자율(RATE) 계산 - 뉴턴-랩슨법
 */
function calculateRate(nper, pmt, pv, fv = 0, type = 0) {
  if (![nper, pmt, pv, fv, type].every(Number.isFinite)) {
    throw new TypeError('calculateRate: 모든 인자는 유한한 숫자여야 합니다.');
  }
  if (nper <= 0) throw new RangeError('calculateRate: nper는 0보다 커야 합니다.');
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = calculateFV(rate, nper, pmt, pv, type) - fv;
    const h = 0.0000001;
    const df = (calculateFV(rate + h, nper, pmt, pv, type) - fv - f) / h;
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-14) {
      throw new RangeError('calculateRate: 이자율을 안정적으로 수렴시킬 수 없습니다.');
    }
    const newRate = rate - f / df;
    if (!Number.isFinite(newRate) || newRate <= -0.999999999) {
      throw new RangeError('calculateRate: 유효한 이자율 범위를 벗어났습니다.');
    }
    if (Math.abs(newRate - rate) < 0.0000001) return newRate;
    rate = newRate;
  }
  throw new RangeError('calculateRate: 100회 반복 후에도 수렴하지 않았습니다.');
}

/**
 * 기간수(NPER) 계산
 */
function calculateNPER(rate, pmt, pv, fv = 0, type = 0) {
  if (![rate, pmt, pv, fv, type].every(Number.isFinite)) {
    throw new TypeError('calculateNPER: 모든 인자는 유한한 숫자여야 합니다.');
  }
  if (pmt === 0) throw new RangeError('calculateNPER: pmt는 0일 수 없습니다.');
  if (rate <= -1) throw new RangeError('calculateNPER: rate는 -1보다 커야 합니다.');
  if (rate === 0) return -(pv + fv) / pmt;
  const numerator = pmt * (1 + rate * type) - fv * rate;
  const denominator = pmt * (1 + rate * type) + pv * rate;
  const ratio = numerator / denominator;
  const logBase = Math.log(1 + rate);
  if (!(ratio > 0) || !Number.isFinite(ratio) || !Number.isFinite(logBase) || logBase === 0) {
    throw new RangeError('calculateNPER: 기간을 계산할 수 없는 현금흐름 조합입니다.');
  }
  return Math.log(ratio) / logBase;
}


// ═══════════════════════════════════════════════════════════
// 2. 은퇴 계산기 (retirement-calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 은퇴 필요자금 계산 (need 모드)
 * @param {Object} params
 * @param {number} params.currentAge - 현재 나이
 * @param {number} params.retireAge - 은퇴 나이
 * @param {number} params.lifeExpectancy - 기대 수명
 * @param {number} params.annualIncome - 연소득 (원)
 * @param {number} params.replacementRate - 소득대체율 (0~1)
 * @param {number} params.ssMonthly - 국민연금 월 수령액 (원)
 * @param {number} params.otherMonthly - 기타 월 수입 (원)
 * @param {number} params.currentSaving - 현재 저축액 (원)
 * @param {number} params.saveRate - 저축률 (0~1)
 * @param {number} params.returnRate - 명목 수익률 (0~1, 예: 0.04)
 * @param {number} params.inflationRate - 물가상승률 (0~1, 예: 0.025)
 * @returns {Object} 계산 결과
 */
function calcRetirementNeed(params) {
  const safeParams = params && typeof params === 'object' ? params : {};
  const required = ['currentAge', 'retireAge', 'lifeExpectancy'];
  if ((safeParams.needBasis || 'income') === 'expense') required.push('monthlyExpense');
  else required.push('annualIncome');
  const missingInputs = _missingFinite(safeParams, required);
  if (missingInputs.length) return _invalidCalculation('calcRetirementNeed', missingInputs);
  const {
    currentAge, retireAge, lifeExpectancy,
    annualIncome, replacementRate = 0.8,
    ssMonthly = 0, otherMonthly = 0,
    currentSaving = 0, saveRate = 0,
    returnRate = 0.04, inflationRate = 0.025,
    needBasis = 'income',   // 'income'=연소득×소득대체율 / 'expense'=희망 월 생활비 직접 사용
    monthlyExpense = 0,     // 은퇴 후 희망 월 생활비(오늘 물가 기준 실질) — needBasis='expense'일 때 사용
  } = safeParams;

  const invalidInputs = [];
  if (currentAge < 0 || currentAge > 150) invalidInputs.push('currentAge');
  if (retireAge < currentAge || retireAge > 150) invalidInputs.push('retireAge');
  if (lifeExpectancy <= retireAge || lifeExpectancy > 150) invalidInputs.push('lifeExpectancy');
  if (returnRate <= -1) invalidInputs.push('returnRate');
  if (inflationRate <= -1) invalidInputs.push('inflationRate');
  if (replacementRate < 0 || replacementRate > 1) invalidInputs.push('replacementRate');
  if (saveRate < 0 || saveRate > 1) invalidInputs.push('saveRate');
  if ([annualIncome, monthlyExpense, ssMonthly, otherMonthly, currentSaving].some(value => Number.isFinite(value) && value < 0)) invalidInputs.push('negativeAmount');
  if (invalidInputs.length) return { ..._invalidCalculation('calcRetirementNeed', [], ['연령·수익률·금액 범위를 확인해 주세요.']), invalidInputs };

  const ny = Math.max(0, retireAge - currentAge); // 은퇴까지 년수
  const nd = Math.max(0, lifeExpectancy - retireAge); // 은퇴 후 년수
  const r_real_y = (1 + returnRate) / (1 + inflationRate) - 1; // 실질수익률
  const r_real_m = Math.pow(1 + r_real_y, 1 / 12) - 1; // 월 실질수익률

  // 은퇴 후 필요 월 총소득(실질) — 기준 선택
  //  · income : 연소득 × 소득대체율 ÷ 12
  //  · expense: 사용자가 입력한 희망 생활비를 그대로 목표로 사용 (대체율 미적용)
  const grossMonthlyNeed = needBasis === 'expense'
    ? Math.max(0, monthlyExpense)
    : Math.max(0, (annualIncome * replacementRate) / 12);

  // 공적·기타연금 차감 후 순필요 월액
  const needMonthReal = Math.max(0, grossMonthlyNeed - (ssMonthly + otherMonthly));

  // 은퇴 시점 필요 총자금 (연금의 현재가치)
  const N = Math.max(1, Math.round(nd * 12));
  const r = r_real_m;
  const annuityPV = r === 0 ? needMonthReal * N : needMonthReal * (1 - Math.pow(1 + r, -N)) / r;
  const needAtRetire = annuityPV;

  // 현재→은퇴까지 누적 자금
  const Y = Math.max(0, Math.round(ny * 12));
  const saveMonth = (annualIncome * saveRate) / 12;
  const grow = r_real_m;
  const curFV = currentSaving * Math.pow(1 + grow, Y);
  const saveFV = grow === 0 ? saveMonth * Y : saveMonth * (Math.pow(1 + grow, Y) - 1) / grow;
  const totalProjected = curFV + saveFV;
  const gap = Math.max(0, needAtRetire - totalProjected);

  // 부족분 해결을 위한 추가 월 저축액
  const additionalMonthly = gap > 0 && Y > 0 ?
    (grow === 0 ? gap / Y : gap * grow / (Math.pow(1 + grow, Y) - 1)) : 0;

  return {
    // 기본 정보
    yearsToRetire: ny,
    yearsInRetire: nd,
    realReturnRate: r_real_y,
    realReturnRateMonthly: r_real_m,
    
    // 은퇴 후 필요
    needBasis: needBasis,
    grossMonthlyNeed: grossMonthlyNeed,
    needMonthlyReal: needMonthReal,
    needAtRetire: needAtRetire,
    
    // 현재 준비 상황
    currentSavingFV: curFV,
    monthlySavingFV: saveFV,
    totalProjected: totalProjected,
    monthlySaving: saveMonth,
    
    // 부족분
    gap: gap,
    additionalMonthlyNeeded: additionalMonthly,
    sufficiencyRate: needAtRetire > 0 ? totalProjected / needAtRetire : 0, // 충족률 = 준비÷필요 (1.0=100%)
    
    // 요약
    summary: {
      needTotal_억: Math.round(needAtRetire / 10000000) / 10,
      projected_억: Math.round(totalProjected / 10000000) / 10,
      gap_억: Math.round(gap / 10000000) / 10,
      충족률_퍼센트: needAtRetire > 0 ? Math.round(totalProjected / needAtRetire * 1000) / 10 : 0,
    }
  };
}

/**
 * 은퇴자금 적립 계산 (save 모드)
 * @param {Object} params
 * @param {number} params.goalAmount - 목표 금액 (원)
 * @param {number} params.currentSaving - 현재 저축액 (원)
 * @param {number} params.currentAge - 현재 나이
 * @param {number} params.retireAge - 은퇴 나이
 * @param {number} params.returnRate - 수익률 (0~1)
 * @param {number} params.inflationRate - 물가상승률 (0~1)
 * @returns {Object}
 */
function calcRetirementSave(params) {
  const safeParams = params && typeof params === 'object' ? params : {};
  const missingInputs = _missingFinite(safeParams, ['goalAmount', 'currentAge', 'retireAge']);
  if (missingInputs.length) return _invalidCalculation('calcRetirementSave', missingInputs);
  const {
    goalAmount, currentSaving = 0,
    currentAge, retireAge,
    returnRate = 0.04, inflationRate = 0.025
  } = safeParams;

  const invalidInputs = [];
  if (goalAmount < 0 || currentSaving < 0) invalidInputs.push('amount');
  if (currentAge < 0 || currentAge > 150) invalidInputs.push('currentAge');
  if (retireAge <= currentAge || retireAge > 150) invalidInputs.push('retireAge');
  if (returnRate <= -1) invalidInputs.push('returnRate');
  if (inflationRate <= -1) invalidInputs.push('inflationRate');
  if (invalidInputs.length) return { ..._invalidCalculation('calcRetirementSave', [], ['입력 범위를 확인해 주세요.']), invalidInputs };

  const ny = Math.max(0, retireAge - currentAge);
  const r_real_y = (1 + returnRate) / (1 + inflationRate) - 1;
  const r_real_m = Math.pow(1 + r_real_y, 1 / 12) - 1;
  const Y = Math.max(1, Math.round(ny * 12));

  const curFV = currentSaving * Math.pow(1 + r_real_m, Y);
  const remain = Math.max(0, goalAmount - curFV);
  const monthlyNeeded = r_real_m === 0 ? remain / Y : remain * r_real_m / (Math.pow(1 + r_real_m, Y) - 1);

  return {
    yearsToRetire: ny,
    currentSavingFV: curFV,
    remainingGoal: remain,
    monthlyNeeded: monthlyNeeded,
    totalDeposit: monthlyNeeded * Y,
    totalReturn: remain - monthlyNeeded * Y,
  };
}

/**
 * 인출 가능 기간 계산 (duration 모드)
 */
function calcWithdrawDuration(params) {
  const safeParams = params && typeof params === 'object' ? params : {};
  const missingInputs = _missingFinite(safeParams, ['balance', 'monthlyWithdraw']);
  if (missingInputs.length) return _invalidCalculation('calcWithdrawDuration', missingInputs);
  const {
    balance, monthlyWithdraw,
    returnRate = 0.04, inflationRate = 0.025,
    currentAge = 65
  } = safeParams;

  const invalidInputs = [];
  if (balance < 0) invalidInputs.push('balance');
  if (monthlyWithdraw <= 0) invalidInputs.push('monthlyWithdraw');
  if (returnRate <= -1) invalidInputs.push('returnRate');
  if (inflationRate <= -1) invalidInputs.push('inflationRate');
  if (currentAge < 0 || currentAge > 150) invalidInputs.push('currentAge');
  if (invalidInputs.length) return { ..._invalidCalculation('calcWithdrawDuration', [], ['입력 범위를 확인해 주세요.']), invalidInputs };

  const r_real_y = (1 + returnRate) / (1 + inflationRate) - 1;
  const r = Math.pow(1 + r_real_y, 1 / 12) - 1;
  const bal = balance;
  const pmt = monthlyWithdraw;

  if (r === 0) {
    const N = bal / pmt;
    return { months: Math.floor(N), years: N / 12, exhaustAge: currentAge + N / 12 };
  }
  if (pmt <= r * bal) {
    return {
      months: Infinity,
      years: Infinity,
      exhaustAge: null,
      isPerpetual: true,
      serializationSafeMonths: null,
      serializationSafeYears: null,
      message: '현재 인출액 조건에서는 자금이 소진되지 않습니다',
    };
  }

  const N = Math.log(pmt / (pmt - r * bal)) / Math.log(1 + r);
  return {
    months: Math.floor(N),
    years: N / 12,
    exhaustAge: currentAge + N / 12,
  };
}


// ═══════════════════════════════════════════════════════════
// 3. 복리/미래가치 계산기 (compound-interest / future-value 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 복리 계산 (적립식)
 * @param {Object} params
 * @param {number} params.principal - 초기 원금 (원)
 * @param {number} params.monthlyDeposit - 월 적립액 (원)
 * @param {number} params.annualRate - 연이율 (0~1)
 * @param {number} params.years - 기간 (년)
 * @param {number} params.compoundFreq - 복리 주기 (12=월복리, 4=분기, 1=연복리)
 * @param {number} params.timing - 0: 기말납, 1: 기초납
 * @returns {Object}
 */
function calcCompoundInterest(params) {
  const {
    principal = 0, monthlyDeposit = 0,
    annualRate = 0.04, years = 25,
    compoundFreq = 12, timing = 0
  } = params || {};

  if (![principal, monthlyDeposit, annualRate, years, compoundFreq, timing].every(Number.isFinite)) {
    throw new TypeError('calcCompoundInterest: 모든 입력은 유한한 숫자여야 합니다.');
  }
  if (compoundFreq <= 0) throw new RangeError('calcCompoundInterest: compoundFreq는 0보다 커야 합니다.');
  if (years < 0) throw new RangeError('calcCompoundInterest: years는 0 이상이어야 합니다.');
  if (annualRate <= -1) throw new RangeError('calcCompoundInterest: annualRate는 -1보다 커야 합니다.');

  const periodicRate = annualRate / compoundFreq;
  const totalPeriods = years * compoundFreq;
  const depositPerPeriod = monthlyDeposit * (12 / compoundFreq);

  // 원금의 미래가치
  const principalFV = principal * Math.pow(1 + periodicRate, totalPeriods);

  // 적립금의 미래가치
  let depositFV;
  if (periodicRate === 0) {
    depositFV = depositPerPeriod * totalPeriods;
  } else {
    depositFV = depositPerPeriod * ((Math.pow(1 + periodicRate, totalPeriods) - 1) / periodicRate);
    if (timing === 1) depositFV *= (1 + periodicRate);
  }

  const totalFV = principalFV + depositFV;
  const totalDeposited = principal + monthlyDeposit * 12 * years;
  const totalInterest = totalFV - totalDeposited;

  // 연도별 스케줄
  const schedule = [];
  let balance = principal;
  for (let y = 1; y <= years; y++) {
    const yearDeposit = monthlyDeposit * 12;
    // 해당 연도 말 잔액
    const periodsThisYear = compoundFreq;
    const startBalance = balance;
    for (let p = 0; p < periodsThisYear; p++) {
      if (timing === 1) balance += depositPerPeriod;
      balance *= (1 + periodicRate);
      if (timing === 0) balance += depositPerPeriod;
    }
    const yearInterest = balance - startBalance - yearDeposit;
    schedule.push({
      year: y,
      deposit: yearDeposit,
      interest: Math.round(yearInterest),
      balance: Math.round(balance),
      totalDeposited: principal + yearDeposit * y,
    });
  }

  return {
    principalFV: Math.round(principalFV),
    depositFV: Math.round(depositFV),
    totalFV: Math.round(totalFV),
    totalDeposited: Math.round(totalDeposited),
    totalInterest: Math.round(totalInterest),
    effectiveReturn: totalDeposited > 0 ? (totalFV / totalDeposited - 1) : 0,
    schedule,
    summary: {
      total_억: Math.round(totalFV / 10000000) / 10, // 원→억원 (소수1자리)
      deposited_억: Math.round(totalDeposited / 10000000) / 10,
      interest_억: Math.round(totalInterest / 10000000) / 10,
    }
  };
}


// ═══════════════════════════════════════════════════════════
// 4. 연금 계산기 (pension-calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 연금 수령액 시뮬레이션
 * @param {Object} params
 * @param {number} params.principal - 일시납 원금 (원)
 * @param {number} params.monthlyPmt - 월 납입액 (원)
 * @param {number} params.accumYears - 적립 기간 (년)
 * @param {number} params.receiveYears - 수령 기간 (년, 0=종신)
 * @param {number} params.accumRate - 적립기 수익률 (0~1)
 * @param {number} params.receiveRate - 수령기 수익률 (0~1)
 * @param {number} params.inflationRate - 물가상승률 (0~1)
 * @returns {Object}
 */
function calcPension(params) {
  const safeParams = params && typeof params === 'object' ? params : {};
  const {
    principal = 0, monthlyPmt = 0,
    accumYears = 25, receiveYears = 25,
    accumRate = 0.04, receiveRate = 0.03,
    inflationRate = 0.025
  } = safeParams;

  const values = [principal, monthlyPmt, accumYears, receiveYears, accumRate, receiveRate, inflationRate];
  if (!values.every(Number.isFinite)) return _invalidCalculation('calcPension', [], ['모든 입력은 유한한 숫자여야 합니다.']);
  const invalidInputs = [];
  if (principal < 0) invalidInputs.push('principal');
  if (monthlyPmt < 0) invalidInputs.push('monthlyPmt');
  if (accumYears < 0) invalidInputs.push('accumYears');
  if (receiveYears < 0) invalidInputs.push('receiveYears');
  if (accumRate <= -1) invalidInputs.push('accumRate');
  if (receiveRate <= -1) invalidInputs.push('receiveRate');
  if (inflationRate <= -1) invalidInputs.push('inflationRate');
  if (invalidInputs.length) return { ..._invalidCalculation('calcPension', [], ['입력 범위를 확인해 주세요.']), invalidInputs };

  // 적립기: 미래가치 계산
  const r_accum_m = accumRate / 12;
  const n_accum = accumYears * 12;
  
  const principalFV = principal * Math.pow(1 + r_accum_m, n_accum);
  let pmtFV;
  if (r_accum_m === 0) {
    pmtFV = monthlyPmt * n_accum;
  } else {
    pmtFV = monthlyPmt * ((Math.pow(1 + r_accum_m, n_accum) - 1) / r_accum_m);
  }
  const totalFund = principalFV + pmtFV;

  // 수령기: PMT 계산 (실질 기준)
  const r_real_y = (1 + receiveRate) / (1 + inflationRate) - 1;
  const r_real_m = Math.pow(1 + r_real_y, 1 / 12) - 1;
  const n_receive = Math.max(0, Math.round(receiveYears * 12)); // 음수(기대수명<65) 방지 → 종신 처리

  let monthlyReceive;
  if (receiveYears === 0 || n_receive === 0) {
    // 종신: 이자만 수령
    monthlyReceive = totalFund * r_real_m;
  } else if (r_real_m === 0) {
    monthlyReceive = totalFund / n_receive;
  } else {
    monthlyReceive = totalFund * r_real_m / (1 - Math.pow(1 + r_real_m, -n_receive));
  }

  const totalDeposited = principal + monthlyPmt * 12 * accumYears;
  const isLifetime = receiveYears === 0 || n_receive === 0;
  const totalReceived = isLifetime ? 0 : monthlyReceive * n_receive;

  return {
    totalFund: Math.round(totalFund),
    monthlyReceive: Math.round(monthlyReceive),
    totalDeposited: Math.round(totalDeposited),
    // 기존 필드는 하위 호환을 위해 유지. 종신형은 총수령기간이 정해지지 않아 0으로 두고 별도 상태를 제공한다.
    totalReceived: Math.round(totalReceived),
    isLifetime,
    totalReceivedNotApplicable: isLifetime,
    returnMultiple: isLifetime ? null : (totalDeposited > 0 ? totalReceived / totalDeposited : 0),
    summary: {
      fund_억: Math.round(totalFund / 10000000) / 10,
      monthly_원: Math.round(monthlyReceive),
      deposited_억: Math.round(totalDeposited / 10000000) / 10,
    }
  };
}


// ═══════════════════════════════════════════════════════════
// 4-B. 은퇴·연금 종합 설계 (pension-calculator.html 재설계판과 동일 엔진)
//      2단계(적립→인출) · 국민연금 개시시점 반영 · 부족분 · 추가가입 시뮬
//      모든 금액은 실질(오늘 물가 기준)
// ═══════════════════════════════════════════════════════════

/**
 * 은퇴·연금 종합 설계
 * @param {Object} p
 * @param {number} p.currentAge      - 현재 나이
 * @param {number} p.retireAge       - 은퇴 나이
 * @param {number} p.lifeExpectancy  - 자금 사용 종료 나이(기대수명)
 * @param {Array}  p.streams         - 보유/가입 연금 [{lump, monthly, years}] (years=납입기간년, 0/미지정=은퇴까지)
 * @param {boolean}p.useDirectProjected - true면 streams 대신 directProjected 사용
 * @param {number} p.directProjected - 은퇴시점 예상 적립액 직접입력(오늘 가치)
 * @param {number} p.ssMonthly       - 국민연금 예상 월수령액(오늘 가치)
 * @param {number} p.ssStartAge      - 국민연금 개시 나이
 * @param {number} p.otherMonthly    - 기타 평생 월수입(오늘 가치)
 * @param {number} p.monthlyExpense  - 은퇴 후 목표 월생활비
 * @param {string} p.expenseBasis    - 'today'(오늘가치) | 'retire'(은퇴시점가치)
 * @param {number} p.accumRate       - 은퇴 전 수익률(0~1)
 * @param {number} p.receiveRate     - 은퇴 후 수익률(0~1)
 * @param {number} p.inflationRate   - 물가상승률(0~1)
 * @param {number} p.addMonthly      - 추가 가입 월납입(시뮬)
 * @param {number} p.addYears        - 추가 가입 납입기간(년, 0=은퇴까지)
 * @returns {Object}
 */
function calcPensionPlan(p){
  const safeInput = p && typeof p === 'object' ? p : {};
  const missingInputs = _missingFinite(safeInput, ['currentAge', 'retireAge', 'lifeExpectancy', 'monthlyExpense', 'accumRate', 'receiveRate', 'inflationRate']);
  if (missingInputs.length) return _invalidCalculation('calcPensionPlan', missingInputs);
  p = safeInput;
  const invalidInputs = [];
  if (p.currentAge < 0 || p.currentAge > 150) invalidInputs.push('currentAge');
  if (p.retireAge < p.currentAge || p.retireAge > 150) invalidInputs.push('retireAge');
  if (p.lifeExpectancy <= p.retireAge || p.lifeExpectancy > 150) invalidInputs.push('lifeExpectancy');
  if (p.accumRate <= -1) invalidInputs.push('accumRate');
  if (p.receiveRate <= -1) invalidInputs.push('receiveRate');
  if (p.inflationRate <= -1) invalidInputs.push('inflationRate');
  if (p.monthlyExpense < 0) invalidInputs.push('monthlyExpense');
  if (invalidInputs.length) return { ..._invalidCalculation('calcPensionPlan', [], ['입력 범위를 확인해 주세요.']), invalidInputs };
  const currentAge   = p.currentAge,
        retireAge    = p.retireAge,
        lifeExpectancy = p.lifeExpectancy,
        streams      = p.streams || [],
        useDirect    = !!p.useDirectProjected,
        directProj   = p.directProjected || 0,
        ssMonthly    = p.ssMonthly || 0,
        ssStartAge   = p.ssStartAge || retireAge,
        otherMonthly = p.otherMonthly || 0,
        expenseBasis = p.expenseBasis || 'today',
        accumRate    = p.accumRate,
        receiveRate  = p.receiveRate,
        inflationRate= p.inflationRate,
        addMonthly   = p.addMonthly || 0,
        addYears     = p.addYears || 0;

  const ny = Math.max(0, retireAge - currentAge);     // 은퇴까지(년)
  const nd = Math.max(0, lifeExpectancy - retireAge); // 은퇴기간(년)
  const Y  = Math.round(ny*12);
  const N  = Math.round(nd*12);

  // 실질(인플레 차감) 월 수익률
  const rAccY  = (1+accumRate)/(1+inflationRate) - 1;
  const rAcc   = Math.pow(1+rAccY, 1/12) - 1;
  const rRecY  = (1+receiveRate)/(1+inflationRate) - 1;
  const rRec   = Math.pow(1+rRecY, 1/12) - 1;

  // 적립 항목 → 은퇴시점 미래가치(FV)
  function streamFV(lump, monthly, years){
    const lumpFV = lump * Math.pow(1+rAcc, Y);
    let pm = (years && years>0) ? Math.round(years*12) : Y; // 0/빈값 = 은퇴까지
    pm = Math.min(pm, Y);
    let annFV;
    if(rAcc === 0) annFV = monthly * pm;
    else annFV = monthly * ((Math.pow(1+rAcc, pm) - 1)/rAcc);
    annFV *= Math.pow(1+rAcc, Y - pm); // 납입 종료 후 은퇴까지 추가 성장
    return lumpFV + annFV;
  }

  let projected = 0;
  if(useDirect){
    projected = directProj;
  } else {
    for(const s of streams){ projected += streamFV(s.lump||0, s.monthly||0, s.years||0); }
  }

  // 목표 월생활비(실질, 오늘 가치)
  let expToday = p.monthlyExpense || 0;
  if(expenseBasis === 'retire') expToday = expToday / Math.pow(1+inflationRate, ny);
  const grossNeed = Math.max(0, expToday);

  // 은퇴시점 필요자산 = 인출액(국민연금 차감)의 은퇴시점 현재가치
  let needAtRetire = 0;
  for(let k=1;k<=N;k++){
    const age = retireAge + k/12;
    const ss = (age >= ssStartAge) ? ssMonthly : 0;
    const net = Math.max(0, grossNeed - otherMonthly - ss);
    needAtRetire += net / Math.pow(1+rRec, k);
  }

  const gap = Math.max(0, needAtRetire - projected);
  const surplus = projected - needAtRetire;
  const sufficiencyRate = needAtRetire > 0 ? projected/needAtRetire : (projected>0?2:1);

  // 부족분 메우는 추가 월저축(은퇴 전, 실질)
  let additionalMonthly = 0;
  if(gap > 0 && Y > 0){
    additionalMonthly = (rAcc === 0) ? gap/Y : gap*rAcc/(Math.pow(1+rAcc,Y)-1);
  }

  // 추가 가입 시뮬
  const addFV = (addMonthly>0) ? streamFV(0, addMonthly, addYears) : 0;
  const projectedAfter = projected + addFV;
  const gapAfter = Math.max(0, needAtRetire - projectedAfter);
  const surplusAfter = projectedAfter - needAtRetire;
  const sufficientAfter = projectedAfter >= needAtRetire;

  // 자산 잔액 곡선 + 소진 나이 (월 시뮬, 실질)
  const curve = [];
  let depletionAge = null;
  const eqLump = Math.pow(1+rAcc, Y) !== 0 ? projected / Math.pow(1+rAcc, Y) : projected;
  let bal = eqLump;
  curve.push({age: currentAge, balance: Math.max(0, bal)});
  for(let k=1;k<=Y;k++){
    bal *= (1+rAcc);
    if(k%12===0) curve.push({age: currentAge + k/12, balance: Math.max(0,bal)});
  }
  bal = projected;
  for(let k=1;k<=N;k++){
    bal *= (1+rRec);
    const age = retireAge + k/12;
    const ss = (age >= ssStartAge) ? ssMonthly : 0;
    const net = Math.max(0, grossNeed - otherMonthly - ss);
    bal -= net;
    if(bal <= 0 && depletionAge === null){ depletionAge = Math.round((retireAge + k/12)*10)/10; bal = 0; }
    if(k%12===0) curve.push({age: retireAge + k/12, balance: Math.max(0,bal)});
  }
  const endBalance = Math.max(0, bal);

  return {
    yearsToRetire: ny, yearsInRetire: nd,
    projected: Math.round(projected),
    needAtRetire: Math.round(needAtRetire),
    gap: Math.round(gap),
    surplus: Math.round(surplus),
    sufficiencyRate,
    additionalMonthlyNeeded: Math.round(additionalMonthly),
    grossMonthlyNeed: Math.round(grossNeed),
    depletionAge, endBalance: Math.round(endBalance),
    addSim: {
      addFV: Math.round(addFV),
      projectedAfter: Math.round(projectedAfter),
      gapAfter: Math.round(gapAfter),
      surplusAfter: Math.round(surplusAfter),
      sufficientAfter
    },
    curve,
    summary: {
      need_억: Math.round(needAtRetire/10000000)/10,
      projected_억: Math.round(projected/10000000)/10,
      gap_억: Math.round(gap/10000000)/10,
      충족률_퍼센트: needAtRetire>0 ? Math.round(projected/needAtRetire*1000)/10 : 0,
    }
  };
}


// ═══════════════════════════════════════════════════════════
// 4-C. 은퇴 후 연도별 현금흐름 시뮬레이션
//      목표생활비·연금수입·월 부족액·누적 부족액을 명시 입력값으로 계산
// ═══════════════════════════════════════════════════════════

/**
 * 은퇴 후 연도별 현금흐름
 * @param {Object} params
 * @param {number} params.retireAge         - 은퇴 시작 나이
 * @param {number} params.lifeExpectancy    - 계산 종료 나이
 * @param {number} params.monthlyExpense    - 은퇴 시작 시점 월 목표생활비(원)
 * @param {number} params.monthlyPension    - 은퇴 시작 시점 월 연금수입(원)
 * @param {number} params.inflationRate     - 생활비 연 증가율(0~1)
 * @param {number} params.pensionGrowthRate - 연금 연 증가율(0~1)
 * @returns {Object}
 */
function calcPensionYearlyProjection(params) {
  const safe = params && typeof params === 'object' ? params : {};
  const required = ['retireAge', 'lifeExpectancy', 'monthlyExpense', 'monthlyPension', 'inflationRate', 'pensionGrowthRate'];
  const missingInputs = required.filter(key => safe[key] === undefined || safe[key] === null || safe[key] === '' || !Number.isFinite(Number(safe[key])));
  if (missingInputs.length) return _invalidCalculation('calcPensionYearlyProjection', missingInputs);

  const retireAge = Number(safe.retireAge);
  const lifeExpectancy = Number(safe.lifeExpectancy);
  const monthlyExpense = Number(safe.monthlyExpense);
  const monthlyPension = Number(safe.monthlyPension);
  const inflationRate = Number(safe.inflationRate);
  const pensionGrowthRate = Number(safe.pensionGrowthRate);
  const invalidInputs = [];
  if (!Number.isInteger(retireAge) || retireAge < 0 || retireAge > 150) invalidInputs.push('retireAge');
  if (!Number.isInteger(lifeExpectancy) || lifeExpectancy < retireAge || lifeExpectancy > 150) invalidInputs.push('lifeExpectancy');
  if (monthlyExpense < 0) invalidInputs.push('monthlyExpense');
  if (monthlyPension < 0) invalidInputs.push('monthlyPension');
  if (inflationRate <= -1 || inflationRate > 1) invalidInputs.push('inflationRate');
  if (pensionGrowthRate <= -1 || pensionGrowthRate > 1) invalidInputs.push('pensionGrowthRate');
  if (invalidInputs.length) {
    return { ..._invalidCalculation('calcPensionYearlyProjection', [], ['입력 범위를 확인해 주세요.']), invalidInputs };
  }

  const rows = [];
  let cumulativeGap = 0;
  let gapSum = 0;
  for (let age = retireAge; age <= lifeExpectancy; age += 1) {
    const year = age - retireAge;
    const targetMonthlyExpense = monthlyExpense * Math.pow(1 + inflationRate, year);
    const projectedMonthlyPension = monthlyPension * Math.pow(1 + pensionGrowthRate, year);
    const monthlyGap = Math.max(0, targetMonthlyExpense - projectedMonthlyPension);
    cumulativeGap += monthlyGap * 12;
    gapSum += monthlyGap;
    rows.push({
      age,
      year,
      targetMonthlyExpense: Math.round(targetMonthlyExpense),
      projectedMonthlyPension: Math.round(projectedMonthlyPension),
      monthlyGap: Math.round(monthlyGap),
      cumulativeGap: Math.round(cumulativeGap),
    });
  }

  return {
    calculated: true,
    retireAge,
    lifeExpectancy,
    inflationRate,
    pensionGrowthRate,
    rows,
    cumulativeGap: Math.round(cumulativeGap),
    averageMonthlyGap: rows.length ? Math.round(gapSum / rows.length) : 0,
    warnings: [],
  };
}


// ═══════════════════════════════════════════════════════════
// 4-D. 연도별 연금 수입 일정
//      개인연금(고정) + 국민연금(명시 인상률) 표 생성용
// ═══════════════════════════════════════════════════════════

function calcPensionIncomeSchedule(params) {
  const safe = params && typeof params === 'object' ? params : {};
  const required = ['currentAge', 'currentYear', 'retireAge', 'lifeExpectancy', 'privateMonthly', 'nationalMonthly', 'nationalGrowthRate'];
  const missingInputs = required.filter(key => safe[key] === undefined || safe[key] === null || safe[key] === '' || !Number.isFinite(Number(safe[key])));
  if (missingInputs.length) return _invalidCalculation('calcPensionIncomeSchedule', missingInputs);

  const currentAge = Number(safe.currentAge);
  const currentYear = Number(safe.currentYear);
  const retireAge = Number(safe.retireAge);
  const lifeExpectancy = Number(safe.lifeExpectancy);
  const privateMonthly = Number(safe.privateMonthly);
  const nationalMonthly = Number(safe.nationalMonthly);
  const nationalGrowthRate = Number(safe.nationalGrowthRate);
  const invalidInputs = [];
  if (!Number.isInteger(currentAge) || currentAge < 0 || currentAge > 150) invalidInputs.push('currentAge');
  if (!Number.isInteger(currentYear) || currentYear < 1900 || currentYear > 2500) invalidInputs.push('currentYear');
  if (!Number.isInteger(retireAge) || retireAge < currentAge || retireAge > 150) invalidInputs.push('retireAge');
  if (!Number.isInteger(lifeExpectancy) || lifeExpectancy < retireAge || lifeExpectancy > 150) invalidInputs.push('lifeExpectancy');
  if (privateMonthly < 0) invalidInputs.push('privateMonthly');
  if (nationalMonthly < 0) invalidInputs.push('nationalMonthly');
  if (nationalGrowthRate <= -1 || nationalGrowthRate > 1) invalidInputs.push('nationalGrowthRate');
  if (invalidInputs.length) {
    return { ..._invalidCalculation('calcPensionIncomeSchedule', [], ['입력 범위를 확인해 주세요.']), invalidInputs };
  }

  const startYear = currentYear + Math.max(0, retireAge - currentAge);
  const rows = [];
  for (let age = retireAge; age <= lifeExpectancy; age += 1) {
    const yearIndex = age - retireAge;
    const national = nationalMonthly * Math.pow(1 + nationalGrowthRate, yearIndex);
    rows.push({
      age,
      calendarYear: startYear + yearIndex,
      privateMonthly: Math.round(privateMonthly),
      nationalMonthly: Math.round(national),
      totalMonthly: Math.round(privateMonthly + national),
    });
  }
  return {
    calculated: true,
    currentAge,
    currentYear,
    retireAge,
    lifeExpectancy,
    nationalGrowthRate,
    rows,
    warnings: [],
  };
}

// ═══════════════════════════════════════════════════════════
// 5. 세액공제/연금저축 계산
// ═══════════════════════════════════════════════════════════

/**
 * 연금저축 + IRP 세액공제 계산 (2024년 기준)
 * @param {Object} params
 * @param {number} params.totalSalary - 총급여 (원)
 * @param {number} params.pensionSaving - 연금저축 연납입액 (원)
 * @param {number} params.irp - IRP 연납입액 (원)
 * @returns {Object}
 */
function calcTaxCredit(params) {
  const safeParams = params && typeof params === 'object' ? params : {};
  const missingInputs = _missingFinite(safeParams, ['totalSalary']);
  if (missingInputs.length) return _invalidCalculation('calcTaxCredit', missingInputs);
  const { totalSalary, pensionSaving = 0, irp = 0 } = safeParams;
  if (![pensionSaving, irp].every(Number.isFinite) || totalSalary < 0 || pensionSaving < 0 || irp < 0) {
    return { ..._invalidCalculation('calcTaxCredit', [], ['급여와 납입액은 0 이상의 유한한 숫자여야 합니다.']), invalidInputs: ['amount'] };
  }

  // 세액공제 한도 (2023년 개정 반영)
  const pensionLimit = 6000000; // 연금저축 한도 600만원
  const totalLimit = 9000000; // 연금저축+IRP 합산 한도 900만원

  const effectivePension = Math.min(pensionSaving, pensionLimit);
  const effectiveIRP = Math.min(irp, totalLimit - effectivePension);
  const effectiveTotal = effectivePension + effectiveIRP;

  // 세액공제율: 총급여 5,500만(종합소득 4,500만) 이하 16.5%, 초과 13.2% (지방세 포함)
  const creditRate = totalSalary <= 55000000 ? 0.165 : 0.132;
  const taxCredit = Math.round(effectiveTotal * creditRate);

  return {
    pensionEffective: effectivePension,
    irpEffective: effectiveIRP,
    totalEffective: effectiveTotal,
    creditRate: creditRate,
    taxCredit: taxCredit,
    realMonthlyBurden: Math.round((pensionSaving + irp - taxCredit) / 12),
    note: totalSalary <= 55000000 ? '총급여 5,500만원 이하: 16.5%(지방세 포함) 적용' : '총급여 5,500만원 초과: 13.2%(지방세 포함) 적용',
  };
}


// ═══════════════════════════════════════════════════════════
// 6. 기회비용 계산 (지연 시 추가 부담)
// ═══════════════════════════════════════════════════════════

/**
 * 적립 시작 시점별 비교
 * @param {Object} params
 * @param {number} params.monthlyAmount - 기준 월 납입액 (원)
 * @param {number} params.baseYears - 기준 적립 기간 (년)
 * @param {number} params.annualRate - 연이율 (0~1)
 * @param {number[]} params.delayYears - 지연 년수 배열 (예: [5, 10])
 * @returns {Object}
 */
function calcOpportunityCost(params) {
  const safeParams = params && typeof params === 'object' ? params : {};
  const missingInputs = _missingFinite(safeParams, ['monthlyAmount', 'baseYears']);
  if (missingInputs.length) return _invalidCalculation('calcOpportunityCost', missingInputs);
  const {
    monthlyAmount, baseYears, annualRate = 0.04,
    delayYears = [5, 10]
  } = safeParams;

  if (monthlyAmount < 0 || baseYears <= 0 || annualRate <= -1) {
    return { ..._invalidCalculation('calcOpportunityCost', [], ['월 납입액·기간·수익률 범위를 확인해 주세요.']), invalidInputs: ['inputRange'] };
  }
  const normalizedDelayYears = Array.isArray(delayYears)
    ? delayYears.map(Number).filter(Number.isFinite)
    : (Number.isFinite(Number(delayYears)) ? [Number(delayYears)] : [5, 10]);
  const monthlyRate = annualRate / 12;

  // 기준 FV
  const baseMonths = baseYears * 12;
  const baseFV = monthlyRate === 0
    ? monthlyAmount * baseMonths
    : monthlyAmount * ((Math.pow(1 + monthlyRate, baseMonths) - 1) / monthlyRate);

  const comparisons = normalizedDelayYears
    .filter(delay => delay >= 0 && baseYears - delay > 0)   // 잔여기간 0 이하 시나리오 제외 (0나눗셈·음수 방지)
    .map(delay => {
      const reducedYears = baseYears - delay;
      const reducedMonths = reducedYears * 12;
      const reducedFV = monthlyRate === 0
        ? monthlyAmount * reducedMonths
        : monthlyAmount * ((Math.pow(1 + monthlyRate, reducedMonths) - 1) / monthlyRate);

      // 동일 목표 달성을 위한 월 필요액
      const denom = Math.pow(1 + monthlyRate, reducedMonths) - 1;
      const monthlyNeeded = (monthlyRate === 0 || denom === 0)
        ? (reducedMonths > 0 ? baseFV / reducedMonths : 0)
        : baseFV * monthlyRate / denom;

      return {
        delayYears: delay,
        remainingYears: reducedYears,
        fvWithSameAmount: Math.round(reducedFV),
        fvLoss: Math.round(baseFV - reducedFV),
        monthlyNeeded: Math.round(monthlyNeeded),
        monthlyIncrease: Math.round(monthlyNeeded - monthlyAmount),
      };
    });

  return {
    baseFV: Math.round(baseFV),
    baseMonthly: monthlyAmount,
    baseYears: baseYears,
    comparisons,
    summary: {
      baseFV_억: Math.round(baseFV / 10000000) / 10,
    }
  };
}


// ═══════════════════════════════════════════════════════════
// 7. PPT용 통합 계산 함수
// ═══════════════════════════════════════════════════════════

/**
 * 개인용 은퇴설계 PPT에 필요한 모든 계산을 한번에 수행
 * @param {Object} input - 사용자 입력 데이터
 * @returns {Object} PPT 슬라이드에 사용할 계산 결과 전체
 */
/**
 * 은퇴 크레바스 — 연금 개시 전 '소득 공백' 필요자금
 * 은퇴 시점 ~ 국민연금 개시(기본 65세) 사이, 국민연금이 아직 안 나오는 무연금 기간의
 * 생활비를 충당하기 위해 은퇴 시점에 따로 확보해야 하는 목돈.
 * @param {Object} p
 * @param {number} p.retireAge       - 은퇴 나이
 * @param {number} p.pensionStartAge - 국민연금 개시 나이 (기본 65)
 * @param {number} p.monthlyNeed     - 은퇴 후 월 생활비(원, 국민연금 차감 전 총액)
 * @param {number} p.otherMonthly    - 공백기간에도 들어오는 기타 월수입(퇴직/개인연금·임대 등, 원)
 * @param {number} p.returnRate      - 명목 수익률 (0~1, 기본 0.035)
 * @param {number} p.inflationRate   - 물가상승률 (0~1, 기본 0.025)
 * @returns {Object} { hasCrevasse, years, months, monthlyNeed, totalFund(은퇴시점 현재가치), nominalTotal }
 */
function calcRetirementCrevasse(p) {
  const {
    retireAge, pensionStartAge = 65,
    monthlyNeed = 0, otherMonthly = 0,
    returnRate = 0.035, inflationRate = 0.025,
  } = p || {};
  const years = Math.max(0, (pensionStartAge || 65) - (retireAge || 0));
  const N = Math.round(years * 12);
  const mNeed = Math.max(0, monthlyNeed - otherMonthly); // 공백기간 순 필요 월액(국민연금 없음)
  const r_real_y = (1 + returnRate) / (1 + inflationRate) - 1;
  const r = Math.pow(1 + r_real_y, 1 / 12) - 1; // 월 실질수익률
  // 공백기간 생활비의 은퇴시점 현재가치(연금현가)
  const totalFund = N <= 0 ? 0 : (r === 0 ? mNeed * N : mNeed * (1 - Math.pow(1 + r, -N)) / r);
  return {
    hasCrevasse: years > 0,
    years,
    months: N,
    monthlyNeed: mNeed,
    totalFund: Math.round(totalFund),     // 은퇴시점 기준 필요 목돈
    nominalTotal: Math.round(mNeed * N),  // 단순 명목 합계(참고)
    summary: { 공백기간_년: years, 필요자금_억: Math.round(totalFund / 10000000) / 10 },
  };
}

/**
 * 3층 연금 분해 — 국민(공적)·퇴직·개인 연금이 은퇴 후 목표 생활비를 얼마나 채우는지.
 * @param {Object} p
 * @param {number} p.targetMonthly            - 은퇴 후 목표 월 생활비 (원)
 * @param {number} p.publicMonthly            - 국민연금 예상 월 수령액 (원)
 * @param {number} p.retirementPensionMonthly - 퇴직연금 예상 월 수령액 (원)
 * @param {number} p.privatePensionMonthly    - 개인연금(연금저축·연금보험 등) 예상 월 수령액 (원)
 * @returns {Object} 층별 금액·비중, 합산 충족액·부족액·충족률
 */
function calcPensionByPillar(p) {
  const {
    targetMonthly = 0,
    publicMonthly = 0, retirementPensionMonthly = 0, privatePensionMonthly = 0,
  } = p || {};
  const pillars = {
    public:     Math.max(0, publicMonthly),
    retirement: Math.max(0, retirementPensionMonthly),
    private:    Math.max(0, privatePensionMonthly),
  };
  const covered = pillars.public + pillars.retirement + pillars.private;
  const gap = Math.max(0, targetMonthly - covered);
  const rate = (x) => targetMonthly > 0 ? Math.round(x / targetMonthly * 1000) / 10 : 0;
  return {
    target: targetMonthly,
    pillars,
    covered,
    gap,                              // 3층으로도 부족한 월 연금액
    coverageRate: rate(covered),      // 전체 충족률(%)
    byPillarRate: {                   // 층별 기여 비중(%)
      public: rate(pillars.public),
      retirement: rate(pillars.retirement),
      private: rate(pillars.private),
    },
  };
}

// ═══════════════════════════════════════════════════════════
// 요율 의존 연금 계산 (현행 공식 수치 기준, 2026)
//  - 국민연금 조기/연기 수령 (조기 연6% 감액·최대30% / 연기 연7.2% 증액·최대36%)
//  - 주택연금 월수령액 (한국주택금융공사 종신지급 정액형, 연령별 추정계수)
//  - 사적연금 연금소득세 (연1,500만 이하 저율 3.3~5.5% / 초과 16.5% 분리과세)
//  - 퇴직급여 일시금 vs 연금 (연금수령 시 퇴직소득세 30~40% 감면)
//  주의: 주택연금 계수·세제 수치는 매년/세법 개정 시 변동 → 각 함수 상단 상수만 갱신.
// ═══════════════════════════════════════════════════════════

/**
 * 국민연금 조기수령 / 연기연금 비교.
 * 조기: 1년당 6% 감액(최대 5년 30%). 연기: 1년당 7.2% 증액(최대 5년 36%).
 * @param {Object} p
 * @param {number} p.baseMonthly     - 정상 개시 기준 월 수령액 (원)
 * @param {number} p.normalAge       - 정상 개시 나이 (기본 65)
 * @param {number} p.earlyYears      - 조기 연수 (0~5, 기본 5)
 * @param {number} p.delayYears      - 연기 연수 (0~5, 기본 5)
 * @param {number} p.lifeExpectancy  - 기대수명 (누적·손익분기용, 기본 90)
 */
function calcNationalPensionTiming(p) {
  const source = p && typeof p === 'object' ? p : {};
  const numericBase = Number(source.baseMonthly ?? 0);
  const numericNormalAge = Number(source.normalAge ?? 65);
  const numericEarlyYears = Number(source.earlyYears ?? 5);
  const numericDelayYears = Number(source.delayYears ?? 5);
  const numericLifeExpectancy = Number(source.lifeExpectancy ?? 90);
  const invalidInputs = [];
  for (const [key, value] of Object.entries({
    baseMonthly: numericBase, normalAge: numericNormalAge,
    earlyYears: numericEarlyYears, delayYears: numericDelayYears,
    lifeExpectancy: numericLifeExpectancy,
  })) {
    if (!Number.isFinite(value)) invalidInputs.push(key);
  }
  if (invalidInputs.length) {
    return { calculated: false, calculator: 'calcNationalPensionTiming', missingInputs: [], invalidInputs, warnings: ['숫자형 입력값을 확인해 주세요.'] };
  }
  const baseMonthly = Math.max(0, numericBase);
  const normalAge = numericNormalAge;
  const lifeExpectancy = numericLifeExpectancy;
  const EARLY_PER_YEAR = 0.06, EARLY_MAX = 0.30;   // 조기 감액
  const DELAY_PER_YEAR = 0.072, DELAY_MAX = 0.36;  // 연기 증액
  const e = Math.min(5, Math.max(0, Math.round(numericEarlyYears)));
  const d = Math.min(5, Math.max(0, Math.round(numericDelayYears)));
  const earlyCut = Math.min(EARLY_MAX, EARLY_PER_YEAR * e);
  const delayUp = Math.min(DELAY_MAX, DELAY_PER_YEAR * d);

  const scenario = (label, startAge, monthly) => {
    const months = Math.max(0, Math.round((lifeExpectancy - startAge) * 12));
    return { label, startAge, monthly: Math.round(monthly), cumulative: Math.round(monthly * months) };
  };
  const early  = scenario('조기수령', normalAge - e, baseMonthly * (1 - earlyCut));
  const normal = scenario('정상수령', normalAge,     baseMonthly);
  const delay  = scenario('연기수령', normalAge + d, baseMonthly * (1 + delayUp));

  // 손익분기 나이: 적게(먼저)·많이(늦게) 두 안의 누적이 같아지는 나이
  const breakEven = (a, b) => {
    if (b.monthly <= a.monthly) return null;
    const age = (b.monthly * b.startAge - a.monthly * a.startAge) / (b.monthly - a.monthly);
    return Math.round(age * 10) / 10;
  };
  return {
    early, normal, delay,
    earlyReduction: Math.round(earlyCut * 1000) / 10, // %
    delayIncrease: Math.round(delayUp * 1000) / 10,   // %
    breakEvenNormalVsEarly: breakEven(early, normal), // 이 나이 넘기면 정상이 유리
    breakEvenDelayVsNormal: breakEven(normal, delay), // 이 나이 넘기면 연기가 유리
    summary: { 조기_월: early.monthly, 정상_월: normal.monthly, 연기_월: delay.monthly },
  };
}

/**
 * 주택연금 월수령액 (한국주택금융공사 종신지급·정액형, 2026 공개예시 기반 추정).
 * @param {Object} p
 * @param {number} p.age        - 부부 중 연소자 나이 (만)
 * @param {number} p.homeValue  - 주택 가격 (원)
 */
function calcHousingPension(p) {
  const { age = 0, homeValue = 0 } = p || {};
  // 연령별 월지급률(주택가격 대비) — 종신 정액형, 2026 공개예시 기반 근사
  // 앵커: 65세·3억=75만, 70세·3억=92.3만(HF공식), 75세·3억=114만, 80세·3억=138만
  const TABLE = [
    [55, 0.00155], [60, 0.00195], [65, 0.00250],
    [70, 0.00307], [75, 0.00380], [80, 0.00460], [85, 0.00520],
  ];
  const HOME_CAP = 1200000000; // 가입 한도(공시가 12억) — 초과분 산정 제외(추정)
  const v = Math.min(Math.max(0, homeValue), HOME_CAP);
  let rate;
  if (age <= TABLE[0][0]) rate = TABLE[0][1];
  else if (age >= TABLE[TABLE.length - 1][0]) rate = TABLE[TABLE.length - 1][1];
  else {
    rate = TABLE[0][1];
    for (let i = 0; i < TABLE.length - 1; i++) {
      const a0 = TABLE[i][0], r0 = TABLE[i][1];
      const a1 = TABLE[i + 1][0], r1 = TABLE[i + 1][1];
      if (age >= a0 && age <= a1) { rate = r0 + (r1 - r0) * (age - a0) / (a1 - a0); break; }
    }
  }
  const monthly = Math.round(v * rate);
  return {
    eligible: age >= 55 && homeValue > 0,
    age, homeValue,
    monthly, annualTotal: monthly * 12,
    isEstimate: true,
    note: '추정치 — 실제 금액은 가입시점 금리·감정가·지급방식에 따라 달라집니다. 한국주택금융공사(hf.go.kr) 공식 계산기로 확인하세요.',
    summary: { 월수령_추정_만원: Math.round(monthly / 10000) },
  };
}

/**
 * 사적연금(연금저축·IRP 세액공제분+운용수익) 연금소득세.
 * 연 1,500만원 이하: 저율 분리과세(나이별 3.3~5.5%). 초과: 16.5% 분리과세 또는 종합과세 선택.
 * @param {Object} p
 * @param {number} p.annualPrivatePension - 연 사적연금 수령액 (원)
 * @param {number} p.age       - 수령 당시 나이
 * @param {boolean} p.lifelong - 종신형 수령(55~69세도 4.4% 적용)
 */
function calcPrivatePensionTax(p) {
  const { annualPrivatePension = 0, age = 65, lifelong = false } = p || {};
  const THRESHOLD = 15000000;     // 저율 분리과세 한도 (연 1,500만원)
  const SEPARATE_HIGH = 0.165;    // 한도 초과 분리과세율(지방세 포함)
  let lowRate;
  if (age >= 80) lowRate = 0.033;
  else if (age >= 70) lowRate = 0.044;
  else lowRate = lifelong ? 0.044 : 0.055;
  const amt = Math.max(0, annualPrivatePension);
  const overThreshold = amt > THRESHOLD;
  const taxLow = Math.round(amt * lowRate);
  const taxHigh = Math.round(amt * SEPARATE_HIGH);
  const tax = overThreshold ? taxHigh : taxLow;
  return {
    annual: amt, age, overThreshold,
    lowRate: Math.round(lowRate * 1000) / 10, // %
    tax, taxIfSeparate16_5: taxHigh, afterTax: amt - tax,
    note: overThreshold
      ? '연 1,500만원 초과 — 16.5% 분리과세 또는 종합과세 중 선택. 1,500만원 이하로 수령시기를 분산하면 저율(3.3~5.5%) 적용.'
      : '연 1,500만원 이하 — 저율 분리과세로 과세 종결.',
    summary: { 적용세율_퍼센트: overThreshold ? 16.5 : Math.round(lowRate * 1000) / 10, 예상세금_만원: Math.round(tax / 10000) },
  };
}

/**
 * 퇴직급여(이연퇴직소득) 일시금 vs 연금 수령 세금 비교.
 * 연금수령 감면: 1~10년차 30%(70% 납부), 11년차 이상 40%(60% 납부).
 * @param {Object} p
 * @param {number} p.retirementIncomeTax - 일시금 기준 산출 퇴직소득세 (원)
 * @param {number} p.severancePay        - (참고) 퇴직급여 총액 (원)
 */
function calcLumpSumVsPensionTax(p) {
  const { retirementIncomeTax = 0, severancePay = 0 } = p || {};
  const tax = Math.max(0, retirementIncomeTax);
  const lumpSum = tax;                          // 일시금: 100%
  const pension10 = Math.round(tax * 0.70);     // 1~10년차: 70% 납부
  const pension11 = Math.round(tax * 0.60);     // 11년차~: 60% 납부
  return {
    severancePay,
    lumpSumTax: lumpSum,
    pensionTax_within10y: pension10,
    pensionTax_over10y: pension11,
    saving_within10y: lumpSum - pension10,       // 30% 감면액
    saving_over10y: lumpSum - pension11,         // 40% 감면액
    note: '연금으로 10년 이상 분할 수령 시 퇴직소득세 최대 40% 절감. 퇴직소득세 자체는 근속연수·퇴직급여에 따라 별도 산출 필요.',
    summary: { 일시금세금_만원: Math.round(lumpSum / 10000), 연금세금_만원: Math.round(pension11 / 10000), 절감_만원: Math.round((lumpSum - pension11) / 10000) },
  };
}

function calcPersonalPPT(input) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const missingInputs = _missingFinite(safeInput, ['currentAge', 'annualIncome', 'monthlyExpense']);
  if (missingInputs.length) return _invalidCalculation('calcPersonalPPT', missingInputs);
  const {
    clientName = '고객',
    currentAge, retireAge = 65, lifeExpectancy = 90,
    annualIncome, // 연소득 (원)
    monthlyExpense, // 월 지출 (원)
    replacementRate = 0.8, // 소득대체율
    needBasis = 'income', // 'income'=연소득×대체율 / 'expense'=희망 생활비 직접 (calcRetirementNeed와 통일)
    ssMonthly = 0, // 국민연금 예상 월 수령액 (원)
    currentSaving = 0, // 현재 저축/투자 총액 (원)
    monthlyInvestment = 0, // 월 투자 가능액 (원)
    returnRateA = 0.05, // A안 수익률
    returnRateB = 0.035, // B안 수익률
    inflationRate = 0.025,
    pensionSaving = 0, // 연금저축 월납입
    irpAmount = 0, // IRP 월납입
    investorType = 'conservative', // conservative/moderate/aggressive
    pensionStartAge = 65, // 국민연금 개시 나이 (은퇴 크레바스)
    retirementPensionMonthly = 0, // 퇴직연금 예상 월 수령액 (3층 분해)
    privatePensionMonthly = 0, // 개인연금 예상 월 수령액 (3층 분해)
    otherMonthly = 0, // 기타 은퇴 후 월수입(임대·배당 등)
    homeValue = 0, // 주택 가격 (원) — 주택연금 추정용
    retirementIncomeTax = 0, // 일시금 기준 퇴직소득세 (원) — 일시금vs연금 비교용
    lifelongPension = false, // 사적연금 종신형 수령 여부
  } = safeInput;

  const invalidInputs = [];
  if (!(retireAge > currentAge)) invalidInputs.push('retireAge');
  if (!(lifeExpectancy > retireAge)) invalidInputs.push('lifeExpectancy');
  if (annualIncome < 0) invalidInputs.push('annualIncome');
  if (monthlyExpense < 0) invalidInputs.push('monthlyExpense');
  if (invalidInputs.length) {
    return {
      calculated: false,
      calculator: 'calcPersonalPPT',
      missingInputs: [],
      invalidInputs,
      warnings: ['은퇴나이는 현재나이보다 커야 하고 기대수명은 은퇴나이보다 커야 합니다. 금액 입력은 0 이상이어야 합니다.'],
    };
  }

  const yearsToRetire = retireAge - currentAge;
  const retireMonthlyNeed = needBasis === 'expense'
    ? Math.max(0, monthlyExpense)
    : Math.max(0, (annualIncome * replacementRate) / 12);
  const monthlyGap = retireMonthlyNeed - ssMonthly;

  // 1. 복리 계산 - A안
  const compoundA = calcCompoundInterest({
    principal: currentSaving,
    monthlyDeposit: monthlyInvestment,
    annualRate: returnRateA,
    years: yearsToRetire,
  });

  // 2. 복리 계산 - B안
  const compoundB = calcCompoundInterest({
    principal: currentSaving,
    monthlyDeposit: monthlyInvestment,
    annualRate: returnRateB,
    years: yearsToRetire,
  });

  // 3. 은퇴 필요자금
  const retireNeed = calcRetirementNeed({
    currentAge, retireAge, lifeExpectancy,
    annualIncome,
    replacementRate,
    needBasis, monthlyExpense,
    ssMonthly,
    currentSaving,
    saveRate: monthlyInvestment > 0 ? (monthlyInvestment * 12) / annualIncome : 0,
    returnRate: returnRateB, // 보수적 기준
    inflationRate,
  });

  // 은퇴 크레바스 (국민연금 개시 전 공백) — 공백기간엔 퇴직/개인연금·기타수입만 차감(국민연금 없음)
  const crevasse = calcRetirementCrevasse({
    retireAge, pensionStartAge,
    monthlyNeed: retireMonthlyNeed,
    otherMonthly: retirementPensionMonthly + privatePensionMonthly + otherMonthly,
    returnRate: returnRateB, inflationRate,
  });

  // 3층 연금 분해 (국민·퇴직·개인이 목표 생활비를 얼마나 채우나)
  const pensionPillars = calcPensionByPillar({
    targetMonthly: retireMonthlyNeed,
    publicMonthly: ssMonthly,
    retirementPensionMonthly, privatePensionMonthly,
  });

  // 국민연금 조기/연기 비교 (국민연금 예상액이 있을 때만)
  const pensionTiming = ssMonthly > 0 ? calcNationalPensionTiming({
    baseMonthly: ssMonthly, normalAge: pensionStartAge,
    earlyYears: 5, delayYears: 5, lifeExpectancy,
  }) : null;

  // 주택연금 추정 (주택 가격이 있을 때만) — 가입나이는 은퇴나이 기준
  const housingPension = homeValue > 0 ? calcHousingPension({
    age: retireAge, homeValue,
  }) : null;

  // 사적연금 연금소득세 (개인연금 월액이 있을 때만)
  const privatePensionTax = privatePensionMonthly > 0 ? calcPrivatePensionTax({
    annualPrivatePension: privatePensionMonthly * 12, age: retireAge, lifelong: lifelongPension,
  }) : null;

  // 퇴직급여 일시금 vs 연금 (퇴직소득세가 주어졌을 때만)
  const lumpSumVsPension = retirementIncomeTax > 0 ? calcLumpSumVsPensionTax({
    retirementIncomeTax,
  }) : null;

  // 4. 연금 수령액 시뮬레이션 - A안
  const pensionA = calcPension({
    principal: currentSaving,
    monthlyPmt: monthlyInvestment,
    accumYears: yearsToRetire,
    receiveYears: lifeExpectancy - retireAge,
    accumRate: returnRateA,
    receiveRate: returnRateA * 0.7, // 수령기 보수적
    inflationRate,
  });

  // 5. 연금 수령액 시뮬레이션 - B안
  const pensionB = calcPension({
    principal: currentSaving,
    monthlyPmt: monthlyInvestment,
    accumYears: yearsToRetire,
    receiveYears: lifeExpectancy - retireAge,
    accumRate: returnRateB,
    receiveRate: returnRateB * 0.7,
    inflationRate,
  });

  // 6. 세액공제
  const taxCredit = calcTaxCredit({
    totalSalary: annualIncome,
    pensionSaving: pensionSaving * 12,
    irp: irpAmount * 12,
  });

  // 7. 기회비용
  const opportunityCost = calcOpportunityCost({
    monthlyAmount: monthlyInvestment,
    baseYears: yearsToRetire,
    annualRate: returnRateB, // 보수적 기준
    delayYears: [5, 10],
  });

  // 8. 인출 지속기간
  const withdrawA = calcWithdrawDuration({
    balance: compoundA.totalFV,
    monthlyWithdraw: monthlyGap,
    returnRate: returnRateA * 0.7,
    inflationRate,
    currentAge: retireAge,
  });

  const withdrawB = calcWithdrawDuration({
    balance: compoundB.totalFV,
    monthlyWithdraw: monthlyGap,
    returnRate: returnRateB * 0.7,
    inflationRate,
    currentAge: retireAge,
  });

  return {
    // 기본 정보
    clientName,
    currentAge,
    retireAge,
    lifeExpectancy,
    yearsToRetire,

    // 현재 상황
    annualIncome,
    monthlyExpense,
    monthlyGap,
    retireMonthlyNeed,
    ssMonthly,

    // 복리 계산 결과
    planA: {
      label: 'A안 (성장형)',
      returnRate: returnRateA,
      totalFV: compoundA.totalFV,
      totalFV_억: compoundA.summary.total_억,
      monthlyPension: pensionA.monthlyReceive,
      withdrawYears: withdrawA.years,
    },
    planB: {
      label: 'B안 (안정형)',
      returnRate: returnRateB,
      totalFV: compoundB.totalFV,
      totalFV_억: compoundB.summary.total_억,
      monthlyPension: pensionB.monthlyReceive,
      withdrawYears: withdrawB.years,
    },

    // 은퇴 필요자금
    retirementNeed: retireNeed,

    // 은퇴 크레바스 (연금 개시 전 공백)
    crevasse,

    // 3층 연금 분해 (국민·퇴직·개인)
    pensionPillars,

    // 요율 의존 계산 (입력 없으면 null)
    pensionTiming,       // 국민연금 조기/연기 비교
    housingPension,      // 주택연금 추정
    privatePensionTax,   // 사적연금 연금소득세
    lumpSumVsPension,    // 퇴직급여 일시금 vs 연금

    // 세액공제
    taxCredit,

    // 기회비용
    opportunityCost,

    // 상세 데이터
    compoundA,
    compoundB,
    pensionA,
    pensionB,
  };
}


// ═══════════════════════════════════════════════════════════
// Module Exports
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 9. 보장성 needs 계산 (간병·생명·암)
//    개인 사례 보고서의 '보장성 필요액(needs analysis)' 산출.
//    설계 원칙: 함수가 모든 산수를 담당, AI는 결과만 인용.
//    금액·기간 등은 페르소나/프로필이 정한 입력값(설정값)으로 받음.
// ═══════════════════════════════════════════════════════════

/** 내부 헬퍼: 실질 월수익률 */
function _realMonthlyRate(returnRate, inflationRate) {
  const realY = (1 + returnRate) / (1 + inflationRate) - 1;
  return Math.pow(1 + realY, 1 / 12) - 1;
}

/** 내부 헬퍼: 월 금액을 months개월 받을 때의 현재가치 (월 실질이율 r) */
function _annuityPV(monthlyAmount, months, r) {
  const N = Math.max(0, Math.round(months));
  if (N === 0) return 0;
  return r === 0 ? monthlyAmount * N : monthlyAmount * (1 - Math.pow(1 + r, -N)) / r;
}

const _round억 = (v) => Math.round(v / 10000000) / 10;   // 억(소수1)
const _round만 = (v) => Math.round(v / 10000);            // 만원(정수)

// ── 9-1. 생명보험 필요보장액 (가장 사망보장 갭) ────────────────
/**
 * @param {object} params
 * @param {number} params.monthlyLivingCost   - 유가족 월 생활비 (원)
 * @param {number} params.supportYears        - 생활비 지원 기간 (년)
 * @param {number} [params.educationCost=0]   - 자녀 교육비 총액 (원)
 * @param {number} [params.debt=0]            - 상환 필요 부채(주담대 등) (원)
 * @param {number} [params.emergencyFund=0]   - 장례·긴급 예비자금 (원)
 * @param {number} [params.liquidAssets=0]    - 즉시 활용 가능 자산 (원)
 * @param {number} [params.existingCoverage=0]- 기존 사망보장 합계 (원)
 * @param {number} [params.returnRate=0.04]
 * @param {number} [params.inflationRate=0.025]
 */
function calcLifeInsuranceNeed(params) {
  const {
    monthlyLivingCost = 0, supportYears = 0,
    educationCost = 0, debt = 0, emergencyFund = 0,
    liquidAssets = 0, existingCoverage = 0,
    returnRate = 0.04, inflationRate = 0.025,
  } = params || {};

  const r = _realMonthlyRate(returnRate, inflationRate);
  const livingPV = _annuityPV(Math.max(0, monthlyLivingCost), supportYears * 12, r);

  const totalNeed = livingPV + Math.max(0, educationCost) + Math.max(0, debt) + Math.max(0, emergencyFund);
  const offset = Math.max(0, liquidAssets) + Math.max(0, existingCoverage);
  const gap = Math.max(0, totalNeed - offset);

  return {
    livingCostPV: livingPV,
    educationCost: Math.max(0, educationCost),
    debt: Math.max(0, debt),
    emergencyFund: Math.max(0, emergencyFund),
    totalNeed,
    liquidAssets: Math.max(0, liquidAssets),
    existingCoverage: Math.max(0, existingCoverage),
    offset,
    requiredCoverageGap: gap,
    summary: {
      totalNeed_억: _round억(totalNeed),
      offset_억: _round억(offset),
      gap_억: _round억(gap),
      gap_만: _round만(gap),
    },
  };
}

// ── 9-2. 암·중대질병 필요자금 ──────────────────────────────────
/**
 * @param {object} params
 * @param {number} params.treatmentCost              - 진단·치료·요양 비용 가정 (원)
 * @param {number} [params.recoveryMonths=12]        - 소득 공백/요양 기간 (개월)
 * @param {number} [params.monthlyIncome=0]          - 월 소득 (원)
 * @param {number} [params.incomeLossRate=1.0]       - 소득 상실률 (0~1)
 * @param {number} [params.extraCost=0]              - 회복기 추가비용 (원)
 * @param {number} [params.existingDiagnosisBenefit=0] - 기존 진단비/치료보장 (원)
 */
function calcCriticalIllnessNeed(params) {
  const {
    treatmentCost = 0, recoveryMonths = 12,
    monthlyIncome = 0, incomeLossRate = 1.0,
    extraCost = 0, existingDiagnosisBenefit = 0,
  } = params || {};

  const lossRate = Math.min(1, Math.max(0, incomeLossRate));
  const incomeLoss = Math.max(0, monthlyIncome) * lossRate * Math.max(0, recoveryMonths);
  const totalNeed = Math.max(0, treatmentCost) + incomeLoss + Math.max(0, extraCost);
  const gap = Math.max(0, totalNeed - Math.max(0, existingDiagnosisBenefit));

  return {
    treatmentCost: Math.max(0, treatmentCost),
    incomeLoss,
    extraCost: Math.max(0, extraCost),
    totalNeed,
    existingDiagnosisBenefit: Math.max(0, existingDiagnosisBenefit),
    requiredCoverageGap: gap,
    summary: {
      totalNeed_억: _round억(totalNeed),
      incomeLoss_만: _round만(incomeLoss),
      gap_억: _round억(gap),
      gap_만: _round만(gap),
    },
  };
}

// ── 9-3. 간병(장기요양) 필요자금 ───────────────────────────────
/**
 * @param {object} params
 * @param {number} params.monthlyCareCost        - 월 간병/요양 비용 가정 (원)
 * @param {number} [params.careYears=5]          - 예상 간병 기간 (년)
 * @param {number} [params.startInYears=0]       - 몇 년 후 발생 가정
 * @param {number} [params.copayRate=1.0]        - 본인부담 비율 0~1
 * @param {number} [params.existingLtcMonthly=0] - 기존 간병/요양 보장(월액) (원)
 * @param {number} [params.returnRate=0.04]
 * @param {number} [params.inflationRate=0.025]
 */
function calcLtcNeed(params) {
  const {
    monthlyCareCost = 0, careYears = 5, startInYears = 0,
    copayRate = 1.0, existingLtcMonthly = 0,
    returnRate = 0.04, inflationRate = 0.025,
  } = params || {};

  const r = _realMonthlyRate(returnRate, inflationRate);
  const copay = Math.min(1, Math.max(0, copayRate));
  const monthsCare = Math.max(0, careYears) * 12;

  const ownMonthly = Math.max(0, monthlyCareCost) * copay;
  const needAtOnset = _annuityPV(ownMonthly, monthsCare, r);
  const existAtOnset = _annuityPV(Math.max(0, existingLtcMonthly), monthsCare, r);

  const realY = (1 + returnRate) / (1 + inflationRate) - 1;
  const discount = Math.pow(1 + realY, -Math.max(0, startInYears));
  const needPV = needAtOnset * discount;
  const existPV = existAtOnset * discount;
  const gap = Math.max(0, needPV - existPV);

  return {
    ownMonthlyCost: ownMonthly,
    careMonths: monthsCare,
    needAtOnset,
    needPV,
    existingCoveragePV: existPV,
    requiredCoverageGap: gap,
    summary: {
      needTotal_억: _round억(needPV),
      ownMonthly_만: _round만(ownMonthly),
      gap_억: _round억(gap),
      gap_만: _round만(gap),
    },
  };
}

// ═══════════════════════════════════════════════════════════
// 10. 은퇴 후 건강보험료 (지역가입자 / 피부양자)
//    은퇴 후 직장가입자 자격 상실 → 지역가입자 전환 시 보험료 시뮬.
//    피부양자 등재 가능 여부도 함께 판정.
//    2026 기준 단순화 모델 (소득점수 + 재산점수 + 자동차점수)
// ═══════════════════════════════════════════════════════════

/**
 * @param {object} params
 * @param {number} params.retireAge              - 은퇴 시점 나이
 * @param {number} [params.lifeExpectancy=85]    - 기대수명
 * @param {number} [params.annualIncome=0]       - 은퇴 후 연 소득 (연금·임대 등)
 * @param {number} [params.totalAssets=0]        - 총 재산 (부동산·금융자산 합)
 * @param {number} [params.propertyValue=0]      - 부동산 평가액 (재산점수용)
 * @param {number} [params.monthlyPension=0]     - 월 연금 수령액 (국민·사적 합)
 * @param {number} [params.hasCar=0]             - 자동차 보유 (0=없음, 1=소형, 2=중·대형)
 */
function calcHealthInsuranceRetiree(params) {
  const {
    retireAge = 60, lifeExpectancy = 85,
    annualIncome = 0, totalAssets = 0, propertyValue = 0,
    monthlyPension = 0,
    confirmedDependentEligible,
    confirmedMonthlyInsurance,
    useLegacyEstimate = false,
  } = params || {};

  const yearsToLE = Math.max(0, Number(lifeExpectancy) - Number(retireAge));
  const totalAnnualIncome = Math.max(0, Number(annualIncome)) + Math.max(0, Number(monthlyPension)) * 12;

  if (confirmedDependentEligible === true) {
    return {
      calculated: true,
      eligibleAsDependent: true,
      eligibilityConfirmed: true,
      monthlyInsurance: 0,
      annualBurden: 0,
      yearsToLifeExpectancy: yearsToLE,
      totalBurden: 0,
      warnings: [],
      summary: { eligibility: '피부양자 등재 확인', monthly_만: 0, annual_만: 0, total_억: 0 },
    };
  }

  if (confirmedDependentEligible === false && Number.isFinite(Number(confirmedMonthlyInsurance))) {
    const monthlyInsurance = Math.max(0, Number(confirmedMonthlyInsurance));
    const annualBurden = monthlyInsurance * 12;
    const totalBurden = annualBurden * yearsToLE;
    return {
      calculated: true,
      eligibleAsDependent: false,
      eligibilityConfirmed: true,
      monthlyInsurance,
      annualBurden,
      yearsToLifeExpectancy: yearsToLE,
      totalBurden,
      warnings: [],
      summary: {
        eligibility: '지역가입자 보험료 확인값 적용',
        monthly_만: Math.round(monthlyInsurance / 10000),
        annual_만: Math.round(annualBurden / 10000),
        total_억: Math.round(totalBurden / 100000000 * 10) / 10,
      },
    };
  }

  if (useLegacyEstimate === true) {
    // 이전 프로그램 호환용 참고 추정치. 현행 지역보험료는 소득과 재산을 각각 법정 산식으로 계산하므로
    // 이 결과를 확정 보험료로 사용해서는 안 된다. 자동차 점수는 반영하지 않는다.
    const POINT_VALUE = 211.5;
    const monthlyIncome = totalAnnualIncome / 12;
    const incomePoint = Math.max(0, (monthlyIncome / 10000 - 100) * 0.5);
    const propertyPoint = Math.max(0, (Math.max(0, Number(propertyValue)) / 10000000) * 0.3);
    const totalPoints = incomePoint + propertyPoint;
    const monthlyInsurance = totalPoints * POINT_VALUE;
    const annualBurden = monthlyInsurance * 12;
    const totalBurden = annualBurden * yearsToLE;
    return {
      calculated: true,
      eligibleAsDependent: null,
      eligibilityConfirmed: false,
      estimateOnly: true,
      incomePoint, propertyPoint, carPoint: 0, totalPoints,
      monthlyInsurance,
      annualBurden,
      yearsToLifeExpectancy: yearsToLE,
      totalBurden,
      warnings: [
        '피부양자 여부는 사업소득·재산과표·가족관계 등 전체 요건을 확인하지 않아 판정하지 않았습니다.',
        '지역가입자 보험료는 이전 프로그램 호환용 단순 추정이며 국민건강보험공단 모의계산 또는 확인 보험료를 사용해야 합니다.',
      ],
      summary: {
        eligibility: '확인 필요(참고 추정)',
        monthly_만: Math.round(monthlyInsurance / 10000),
        annual_만: Math.round(annualBurden / 10000),
        total_억: Math.round(totalBurden / 100000000 * 10) / 10,
      },
    };
  }

  return {
    calculated: false,
    calculator: 'calcHealthInsuranceRetiree',
    eligibleAsDependent: null,
    eligibilityConfirmed: false,
    monthlyInsurance: null,
    annualBurden: null,
    yearsToLifeExpectancy: yearsToLE,
    totalBurden: null,
    missingInputs: ['confirmedDependentEligible', 'confirmedMonthlyInsurance'],
    invalidInputs: [],
    warnings: [
      '소득과 재산만으로 피부양자 자격 또는 지역가입자 보험료를 확정할 수 없습니다.',
      '피부양자 자격 확인값 또는 국민건강보험공단에서 확인한 월 보험료를 입력해야 합니다.',
    ],
    summary: { eligibility: '확인 필요', monthly_만: null, annual_만: null, total_억: null },
  };
}

// ═══════════════════════════════════════════════════════════
// 11. 연금저축·IRP 통합 시뮬 (세액공제 + 누적 + 인출시점 세금)
//    연 900만 한도 (연금저축 600 + IRP 추가 300).
//    세액공제율: 종합소득 4,500만 이하 16.5%, 초과 13.2%.
//    인출시점: 55세+ 5년이상 가입 + 연 1,500만 한도 분리과세 5.5%.
// ═══════════════════════════════════════════════════════════

/**
 * @param {object} params
 * @param {number} params.annualContribution    - 연 납입액 (원) — 최대 900만 자동 캡
 * @param {number} [params.yearsToContribute=15] - 납입 기간 (년)
 * @param {number} [params.globalIncome=0]      - 종합소득금액 (원) — 세액공제율 결정
 * @param {number} [params.expectedReturn=0.04] - 연 기대수익률
 * @param {number} [params.withdrawTaxRate=0.055] - 인출시점 분리과세율 (기본 5.5%)
 */
function calcPensionDepositIRP(params) {
  const {
    annualContribution = 0,
    yearsToContribute = 15,
    globalIncome = 0,
    expectedReturn = 0.04,
    withdrawTaxRate = 0.055,
    confirmedTaxableWithdrawalBase,
  } = params || {};

  const LIMIT = 9000000;
  const contribution = Math.min(Math.max(0, annualContribution), LIMIT);

  // 세액공제율 — 종합소득 4,500만 이하 16.5%(지방세 포함), 초과 13.2%
  const isLowIncome = Math.max(0, globalIncome) <= 45000000;
  const creditRate = isLowIncome ? 0.165 : 0.132;
  const annualTaxCredit = contribution * creditRate;
  const totalCreditOverYears = annualTaxCredit * Math.max(0, yearsToContribute);

  // 누적 (연 단위 단순 복리, 매년 말 납입)
  const r = Math.max(0, expectedReturn);
  const N = Math.max(0, yearsToContribute);
  const finalValueBeforeTax = r === 0
    ? contribution * N
    : contribution * (Math.pow(1 + r, N) - 1) / r;

  // 인출세액은 세액공제를 받은 원금과 운용수익 등 과세대상 인출재원을 기준으로 한다.
  // 확인값이 없으면 전체 적립액이 과세대상이라는 보수적 단순 가정을 사용한다.
  const taxableBaseConfirmed = Number.isFinite(Number(confirmedTaxableWithdrawalBase));
  const taxableWithdrawalBase = taxableBaseConfirmed
    ? Math.min(finalValueBeforeTax, Math.max(0, Number(confirmedTaxableWithdrawalBase)))
    : finalValueBeforeTax;
  const withdrawTax = taxableWithdrawalBase * Math.max(0, withdrawTaxRate);
  const netReceived = finalValueBeforeTax - withdrawTax;

  return {
    annualContribution: contribution,
    creditRate,
    annualTaxCredit,
    yearsToContribute: N,
    totalCreditOverYears,
    finalValueBeforeTax,
    taxableWithdrawalBase,
    withdrawTax,
    netReceived,
    estimateOnly: !taxableBaseConfirmed,
    warnings: taxableBaseConfirmed ? [] : ['과세대상 인출재원 확인값이 없어 전체 적립액을 과세대상으로 가정한 단순 추정입니다.'],
    summary: {
      annualCredit_만: Math.round(annualTaxCredit / 10000),
      totalCredit_만: Math.round(totalCreditOverYears / 10000),
      finalValue_억: Math.round(finalValueBeforeTax / 100000000 * 10) / 10,
      netReceived_억: Math.round(netReceived / 100000000 * 10) / 10,
      creditRateLabel: isLowIncome ? "16.5% (저소득)" : "13.2% (고소득)",
    },
  };
}

// ── 9-5. 보험료 적정성 진단 (소득 대비 보장성 보험료 비중) ──────────
/**
 * 가구의 보장성 보험료가 소득 대비 적정 범위인지 진단한다.
 * 일반 재무설계 가이드: 보장성(보장 위주) 보험료는 월 소득의 8~12% 이내 권장.
 * @param {object} params
 * @param {number} params.monthlyIncome        - 월 소득(가구, 원)
 * @param {number} params.protectionPremium    - 현재 보장성 월 보험료(원)
 * @param {number} [params.savingsPremium=0]   - 저축·연금성 월 보험료(원, 참고용)
 * @param {number} [params.targetRate=0.10]    - 권장 보장성 비중(기본 10%)
 * @param {number} [params.maxRate=0.12]       - 적정 상한 비중(기본 12%)
 */
function calcInsuranceAffordability(params) {
  const {
    monthlyIncome = 0, protectionPremium = 0, savingsPremium = 0,
    targetRate = 0.10, maxRate = 0.12,
  } = params || {};
  const inc = Math.max(0, monthlyIncome);
  const prot = Math.max(0, protectionPremium);
  const sav = Math.max(0, savingsPremium);
  if (inc <= 0) {
    return {
      monthlyIncome: 0, protectionPremium: prot, savingsPremium: sav,
      protectionRatio: 0, totalRatio: 0,
      recommendedPremium: 0, ceilingPremium: 0,
      status: "소득 정보 없음", headroom: 0,
      summary: { protectionRatio_pct: 0, totalRatio_pct: 0, recommended_만: 0, ceiling_만: 0, headroom_만: 0, status: "소득 정보 없음" },
    };
  }
  const protectionRatio = inc > 0 ? prot / inc : 0;
  const totalRatio = inc > 0 ? (prot + sav) / inc : 0;
  const recommended = inc * targetRate;   // 권장 보장성 보험료
  const ceiling = inc * maxRate;          // 적정 상한
  let status, headroom;                    // headroom>0=추가여력 / <0=초과
  if (protectionRatio > maxRate) { status = "과다"; headroom = ceiling - prot; }
  else if (protectionRatio >= targetRate) { status = "적정(상단)"; headroom = ceiling - prot; }
  else { status = "여력 있음"; headroom = recommended - prot; }
  return {
    monthlyIncome: inc, protectionPremium: prot, savingsPremium: sav,
    protectionRatio, totalRatio,
    recommendedPremium: recommended, ceilingPremium: ceiling,
    status, headroom,
    summary: {
      protectionRatio_pct: Math.round(protectionRatio * 1000) / 10,
      totalRatio_pct: Math.round(totalRatio * 1000) / 10,
      recommended_만: _round만(recommended),
      ceiling_만: _round만(ceiling),
      headroom_만: _round만(headroom),
      status,
    },
  };
}

// ── 9-6. 정기 vs 종신 비교 (보험료 효율 + 차액 투자) ─────────────────
/**
 * 동일 사망보장에 대해 종신 vs 정기 보험료를 비교하고,
 * '정기 + 차액 투자' 전략의 만기 적립액을 산출한다.
 * @param {object} params
 * @param {number} params.wholeLifeMonthlyPremium - 종신 월 보험료(원)
 * @param {number} params.termMonthlyPremium      - 정기 월 보험료(원)
 * @param {number} [params.payYears=20]           - 납입 기간(년)
 * @param {number} [params.termYears=payYears]    - 정기 보장 기간(년)
 * @param {number} [params.investReturn=0.04]     - 차액 투자 연수익률
 * @param {number} [params.coverageAmount=0]      - (참고) 사망보장액(원)
 */
function calcTermVsWholeLife(params) {
  const {
    wholeLifeMonthlyPremium = 0, termMonthlyPremium = 0,
    payYears = 20, termYears, investReturn = 0.04, coverageAmount = 0,
  } = params || {};
  const whole = Math.max(0, wholeLifeMonthlyPremium);
  const term = Math.max(0, termMonthlyPremium);
  const pY = Math.max(0, payYears);
  const tY = Math.max(0, (termYears == null ? payYears : termYears));
  const wholeTotal = whole * 12 * pY;
  const termTotal = term * 12 * tY;
  const monthlyDiff = Math.max(0, whole - term);
  // 월 차액을 tY년간 월말 적립 투자
  const mr = Math.pow(1 + investReturn, 1 / 12) - 1;
  const n = Math.round(tY * 12);
  const investFV = mr === 0 ? monthlyDiff * n : monthlyDiff * (Math.pow(1 + mr, n) - 1) / mr;
  return {
    coverageAmount: Math.max(0, coverageAmount),
    wholeLifeTotalPaid: wholeTotal,
    termTotalPaid: termTotal,
    monthlyDiff,
    premiumSaved: wholeTotal - termTotal,   // 정기 선택 시 총 절감 보험료
    diffInvestFV: investFV,                  // 차액 투자 만기 적립액
    summary: {
      wholeLifeTotal_억: _round억(wholeTotal),
      wholeLifeTotal_만: _round만(wholeTotal),
      termTotal_억: _round억(termTotal),
      termTotal_만: _round만(termTotal),
      premiumSaved_만: _round만(wholeTotal - termTotal),
      monthlyDiff_만: _round만(monthlyDiff),
      diffInvestFV_억: _round억(investFV),
      diffInvestFV_만: _round만(investFV),
    },
  };
}

// ── 9-7. 실손 의료비 본인부담 노출 (실손 가입 효익) ──────────────────
/**
 * 연간 본인부담 의료비에 대해 실손 가입/미가입 시 본인부담을 비교한다.
 * 자기부담률은 세대별로 달라 파라미터로 받는다(기본: 4세대 — 급여 20%/비급여 30%).
 * @param {object} params
 * @param {number} params.annualMedicalCost    - 연간 본인부담 의료비 가정(원)
 * @param {number} [params.coveredRate=0.6]    - 급여 비중(0~1)
 * @param {number} [params.copayCovered=0.20]  - 급여 자기부담률
 * @param {number} [params.copayNonCovered=0.30]- 비급여 자기부담률
 * @param {number} [params.years=10]           - 분석 기간(년)
 * @param {number} [params.medicalInflation=0.04] - 의료비 상승률
 */
function calcMedicalExpenseExposure(params) {
  const {
    annualMedicalCost = 0, coveredRate = 0.6,
    copayCovered = 0.20, copayNonCovered = 0.30,
    years = 10, medicalInflation = 0.04,
  } = params || {};
  const cost = Math.max(0, annualMedicalCost);
  const cov = Math.min(1, Math.max(0, coveredRate));
  const nonCov = 1 - cov;
  const ccov = Math.min(1, Math.max(0, copayCovered));
  const cnon = Math.min(1, Math.max(0, copayNonCovered));
  const exposedNoInsurance = cost;  // 미가입: 전액 본인부담
  const exposedWithInsurance = cost * (cov * ccov + nonCov * cnon);
  const annualBenefit = Math.max(0, exposedNoInsurance - exposedWithInsurance);
  const g = 1 + medicalInflation;
  const yN = Math.max(0, Math.round(years));
  const factor = g === 1 ? yN : (Math.pow(g, yN) - 1) / (g - 1);
  const cumulativeBenefit = annualBenefit * factor;
  return {
    annualMedicalCost: cost,
    exposedNoInsurance, exposedWithInsurance,
    annualBenefit, years: yN, cumulativeBenefit,
    summary: {
      noInsurance_만: _round만(exposedNoInsurance),
      withInsurance_만: _round만(exposedWithInsurance),
      annualBenefit_만: _round만(annualBenefit),
      cumulative_억: _round억(cumulativeBenefit),
    },
  };
}

// ── 9-8. 어린이·태아 보장 필요액 ────────────────────────────────────
/**
 * 자녀(태아 포함) 보장 필요액과 갭을 산출한다.
 * @param {object} params
 * @param {number} [params.diagnosisCost=0]       - 중대질병 진단·치료비 가정(원)
 * @param {number} [params.hospitalDailyCost=0]   - 입원 일당(원)
 * @param {number} [params.expectedHospitalDays=0]- 예상 입원일수
 * @param {number} [params.surgeryReserve=0]      - 수술·치료 예비비(원)
 * @param {number} [params.eduContinuity=0]       - 치료기간 교육 연속성 자금(원)
 * @param {number} [params.existingChildCoverage=0]- 기존 자녀 보장(원)
 */
function calcChildInsuranceNeed(params) {
  const {
    diagnosisCost = 0, hospitalDailyCost = 0, expectedHospitalDays = 0,
    surgeryReserve = 0, eduContinuity = 0, existingChildCoverage = 0,
  } = params || {};
  const hospital = Math.max(0, hospitalDailyCost) * Math.max(0, expectedHospitalDays);
  const totalNeed = Math.max(0, diagnosisCost) + hospital + Math.max(0, surgeryReserve) + Math.max(0, eduContinuity);
  const gap = Math.max(0, totalNeed - Math.max(0, existingChildCoverage));
  return {
    diagnosisCost: Math.max(0, diagnosisCost),
    hospitalCost: hospital,
    surgeryReserve: Math.max(0, surgeryReserve),
    eduContinuity: Math.max(0, eduContinuity),
    totalNeed,
    existingChildCoverage: Math.max(0, existingChildCoverage),
    requiredCoverageGap: gap,
    summary: {
      totalNeed_억: _round억(totalNeed),
      totalNeed_만: _round만(totalNeed),
      gap_억: _round억(gap),
      gap_만: _round만(gap),
    },
  };
}

module.exports = {
  // 기본 재무 함수
  calculateFV,
  calculatePV,
  calculatePMT,
  calculateRate,
  calculateNPER,

  // 은퇴 계산
  calcRetirementNeed,
  calcRetirementSave,
  calcWithdrawDuration,

  // 복리/미래가치
  calcCompoundInterest,

  // 연금
  calcPension,
  calcPensionPlan,

  // 세액공제
  calcTaxCredit,

  // 기회비용
  calcOpportunityCost,

  // PPT 통합
  calcPersonalPPT,

  // 보장성 needs (간병·생명·암)
  calcLifeInsuranceNeed,
  calcCriticalIllnessNeed,
  calcLtcNeed,

  // 은퇴 후 건강보험료 (지역가입자/피부양자)
  calcHealthInsuranceRetiree,

  // 보험 진단·전략 (적정성·정기vs종신·실손·어린이) [신규]
  calcInsuranceAffordability,
  calcTermVsWholeLife,
  calcMedicalExpenseExposure,
  calcChildInsuranceNeed,
  // 연금저축·IRP 통합
  calcPensionDepositIRP,

  // 은퇴 크레바스 / 3층 연금 분해
  calcRetirementCrevasse,
  calcPensionByPillar,

  // 요율 의존 계산 (조기/연기·주택연금·연금세금)
  calcNationalPensionTiming,
  calcHousingPension,
  calcPrivatePensionTax,
  calcLumpSumVsPensionTax,
};

// 브라우저 UI 전용 계산기는 직접 호출 가능하되 기존 export 열거/자동 레지스트리에는 영향을 주지 않는다.
Object.defineProperty(module.exports, 'calcPensionYearlyProjection', {
  value: calcPensionYearlyProjection,
  enumerable: false,
  writable: false,
  configurable: false,
});
Object.defineProperty(module.exports, 'calcPensionIncomeSchedule', {
  value: calcPensionIncomeSchedule,
  enumerable: false,
  writable: false,
  configurable: false,
});

},
"./corporate": function(module, exports, require, __filename, __dirname) {
/**
 * JARVIA 기업용 PPT 계산 모듈
 * 원본: GitHub kfpc0808/jarvia/calculators/*.html에서 JS 로직 추출
 * 용도: Cloud Functions에서 PPT 생성 파이프라인 내 계산 결과 제공
 * 
 * 세율/공제 기준: 주요 계산 항목은 2026년 5월 현재 기준 반영, 실제 적용 전 전문가 확인 필요
 * 
 * 변경 이력:
 *   v3.0 (2026-05-15): calcInheritanceTax 정밀화 — HTML 계산기 v2와 동일 수준
 *     - 신고세액공제 3% (기존 유지), 영농상속공제 30억, 최대주주 할증 위치 정정,
 *       세대생략 비율 적용 + 미성년 40% + 대습상속 예외, 사전증여 가산 순서 정정,
 *       증여세액공제, 공제한도 정밀화, 자녀·연로자·장애인공제, 장례비 의제공제 등
 *     - 기존 인터페이스 100% 호환 (모든 신규 파라미터 default 값 부여)
 */

// ═══════════════════════════════════════════════════════════
// 1. 상속세 계산기 (inheritance-tax-calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 상속세/증여세 누진세율 (상속세및증여세법 제26조)
 */
function calcProgressiveTax(taxBase) {
  if (taxBase <= 0) return 0;
  if (taxBase <= 100000000) return taxBase * 0.1;
  if (taxBase <= 500000000) return taxBase * 0.2 - 10000000;
  if (taxBase <= 1000000000) return taxBase * 0.3 - 60000000;
  if (taxBase <= 3000000000) return taxBase * 0.4 - 160000000;
  return taxBase * 0.5 - 460000000;
}

/**
 * 상속세 계산 (v3.0 정밀화 — 2026-05-15)
 * 
 * v3.0 변경 사항 (HTML 계산기 v2와 동일 정밀도):
 *  - 신고세액공제 3% (상증법 §69, 2019년 이후) — 기존 동일
 *  - 영농상속공제 30억 한도 (상증법 §18조의3, 2023.1.1~) — 신규
 *  - 최대주주 할증 (상증법 §63③): 비상장주식 평가단계에만 적용 — 신규
 *  - 세대생략 할증 (상증법 §27): 이중 할증 제거, 비율 적용, 미성년 20억 초과 40% — 정정
 *  - 대습상속 예외 (상증법 §27 단서, 자녀 사망) — 신규
 *  - 사전증여 가산 순서 (상증법 §13): 채무·장례비 차감 후 가산 — 정정
 *  - 증여세액공제 (상증법 §28): 사전증여 합산 시 기납부 증여세 공제 — 신규
 *  - 공제한도 정밀화 (상증법 §24): 사전증여 + 비상속인 유증재산 차감 — 정정
 *  - 자녀공제 5천만원·연로자공제 5천만원·장애인공제 — 신규
 *  - 배우자공제: 음수 방지, 최소 5억 보장 — 정정
 *  - isLumpSum 명시적 분기 — 정정
 *  - 장례비 의제공제 500만원 (시행령 §9②) — 정정
 *  - 가업상속공제·동거주택상속공제·재해손실공제 입력 지원 — 신규
 * 
 * 옛 인터페이스 호환 (모든 신규 파라미터에 default 값 부여)
 * 
 * @param {Object} params
 * @param {number}  params.totalAssets          - 총 상속재산 (비상장주식 제외 권장, 원)
 * @param {number}  params.estimatedAssets      - 추정상속재산 (원)
 * @param {number}  params.preGifts             - 사전증여재산 합계 (원) — 옛 호환용
 * @param {number}  params.spouseGift           - 배우자 사전증여 (원) — 신규, 미지정 시 0
 * @param {number}  params.otherGift            - 기타 사전증여 (원) — 신규
 * @param {number}  params.giftTaxPaid          - 사전증여 기납부 증여세 (원) — 신규 (§28)
 * @param {number}  params.nonHeirBequest       - 비상속인 유증·사인증여 (원) — 신규 (§24)
 * @param {number}  params.debts                - 채무 (원)
 * @param {number}  params.publicCharges        - 공과금 (원) — 신규
 * @param {number}  params.funeralCost          - 일반 장례비 (원)
 * @param {number}  params.burialCost           - 봉안시설 비용 (원) — 신규 분리
 * @param {number}  params.financialAssets      - 금융재산 (원)
 * @param {number}  params.financialDebts       - 금융채무 (원)
 * @param {number}  params.unlistedStock        - 비상장주식 평가액 (원) — 신규
 * @param {boolean} params.majorShareholder     - 최대주주 여부 (비상장주식 20% 할증) — 신규
 * @param {number}  params.retirement           - 퇴직금/보험금 (원) — 신규
 * @param {number}  params.taxExempt            - 비과세/불산입액 (원) — 신규
 * @param {boolean} params.hasSpouse            - 배우자 유무
 * @param {boolean} params.isSingleInheritance  - 배우자 단독상속 여부 (일괄공제 불가) — 신규
 * @param {number}  params.spouseInheritance    - 배우자 실제 상속받은 금액 (원) — 신규
 * @param {number}  params.spouseLegalShare    - 배우자 법정상속비율 (옛 호환용)
 * @param {number}  params.numChildren          - 자녀 수
 * @param {number}  params.numMinors            - 미성년 자녀 수
 * @param {Array}   params.minorAges            - 미성년 자녀 나이 배열
 * @param {number}  params.numElderly           - 연로자 수 (65세 이상) — 신규
 * @param {number}  params.disabledDeduction    - 장애인공제액 (원, 사용자 계산) — 신규
 * @param {number}  params.residenceDeduction   - 동거주택상속공제 (원, 최대 6억) — 신규
 * @param {number}  params.familyBusinessDeduction - 가업상속공제 (원) — 신규
 * @param {number}  params.farmDeduction        - 영농상속공제 (원, 최대 30억) — 신규
 * @param {number}  params.disasterLoss         - 재해손실공제 (원) — 신규
 * @param {boolean} params.isGenSkip            - 세대생략 상속 여부 (옛 호환용)
 * @param {number}  params.genSkipAmount        - 세대생략 상속재산 (원) — 신규
 * @param {boolean} params.isMinorGenSkip       - 미성년자 상속인 (20억 초과 시 40%) — 신규
 * @param {boolean} params.isDaeseupInheritance - 대습상속 여부 (§27 단서, 할증 제외) — 신규
 * @returns {Object}
 */
function calcInheritanceTax(params) {
  const {
    totalAssets = 0, estimatedAssets = 0, preGifts = 0,
    spouseGift = 0, otherGift = 0,
    giftTaxPaid = 0, nonHeirBequest = 0,
    debts = 0, publicCharges = 0,
    funeralCost = 5000000, burialCost = 0,
    financialAssets = 0, financialDebts = 0,
    unlistedStock = 0, majorShareholder = false,
    totalAssetsIncludesUnlistedStock = false, isSMEUnlistedStock = false,
    retirement = 0, taxExempt = 0,
    hasSpouse = true, isSingleInheritance = false,
    spouseInheritance = 0, spouseLegalShare = 0,
    numChildren = 0, numMinors = 0, minorAges = [],
    numElderly = 0, disabledDeduction = 0,
    residenceDeduction: rawResidence = 0,
    familyBusinessDeduction = 0,
    farmDeduction: rawFarm = 0,
    disasterLoss = 0,
    isGenSkip = false, genSkipAmount = 0,
    isMinorGenSkip = false, isDaeseupInheritance = false
  } = params || {};

  const inheritanceValues = [totalAssets, estimatedAssets, preGifts, spouseGift, otherGift, giftTaxPaid, nonHeirBequest, debts, publicCharges, funeralCost, burialCost, financialAssets, financialDebts, unlistedStock, retirement, taxExempt, spouseInheritance, spouseLegalShare, numChildren, numMinors, numElderly, disabledDeduction, rawResidence, familyBusinessDeduction, rawFarm, disasterLoss, genSkipAmount];
  if (!inheritanceValues.every(value => Number.isFinite(Number(value))) || inheritanceValues.some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'calcInheritanceTax', missingInputs: [], invalidInputs: ['amount'], warnings: ['상속재산·채무·공제 입력은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  // 1. 사전증여 (옛 인터페이스 호환: preGifts가 양수면 사용, 아니면 spouseGift+otherGift)
  const preGift = (preGifts > 0) ? preGifts : (spouseGift + otherGift);

  // 2. 장례비 의제공제 (시행령 §9② — 일반 500만~1,000만, 봉안시설 별도 500만)
  let funeralFinal = Math.min(Math.max(funeralCost, 5000000), 10000000);
  let burialFinal = Math.min(burialCost, 5000000);

  // 3. 한도 적용
  const residenceDeduction = Math.min(rawResidence, 600000000);          // 동거주택 6억
  const farmDeduction = Math.min(rawFarm, 3000000000);                   // 영농 30억 (§18조의3)

  // 4. 최대주주 할증 (상증법 §63③) — 비상장주식 평가단계에만 적용
  //    중소기업은 제외 (사용자가 majorShareholder 체크로 판단)
  const stockSurcharge = (majorShareholder && !isSMEUnlistedStock && unlistedStock > 0)
    ? unlistedStock * 0.20 : 0;

  // 5. 총 상속재산 (사전증여 제외)
  // 기존 호출은 totalAssets에 비상장주식이 포함되지 않은 것으로 처리한다.
  // 포함된 금액이라면 totalAssetsIncludesUnlistedStock=true를 명시해 이중 합산을 방지한다.
  const unlistedStockAddition = totalAssetsIncludesUnlistedStock ? 0 : unlistedStock;
  const grossAssets = totalAssets + estimatedAssets + unlistedStockAddition + stockSurcharge
                      + retirement - taxExempt;

  // 6. 배우자공제 한도 산정용 (상증법 §19)
  //    = 총재산 + 가산되는 증여재산 - 채무·공과금 - 배우자 사전증여
  const inheritanceBase = grossAssets + preGift - debts - publicCharges - spouseGift;

  // 7. 상속세 과세가액 (§13: 사전증여는 채무·장례비 차감 후 가산)
  const taxableAmount = Math.max(0,
    grossAssets - debts - publicCharges - funeralFinal - burialFinal + preGift);

  // 8. 기초공제
  const basicDeduction = 200000000;

  // 9. 인적공제 (§20)
  const childDeduction = numChildren * 50000000;                         // 자녀공제 5천만/인
  let minorDeduction = 0;
  if (numMinors > 0 && minorAges.length > 0) {
    minorAges.forEach(age => {
      if (age >= 0 && age < 19) {
        minorDeduction += (19 - age) * 10000000;                         // 1천만 × 잔여연수
      }
    });
  }
  const elderlyDeduction = numElderly * 50000000;                        // 연로자공제 5천만/인
  const personalDeduction = childDeduction + minorDeduction + elderlyDeduction + disabledDeduction;

  // 10. 일괄공제 5억 vs (기초+인적) 중 큰 금액 (배우자 단독상속 시 일괄공제 불가)
  const lumpSumDeduction = 500000000;
  let selectedDeduction, isLumpSum;
  if (isSingleInheritance) {
    selectedDeduction = basicDeduction + personalDeduction;
    isLumpSum = false;
  } else {
    const personalTotal = basicDeduction + personalDeduction;
    if (lumpSumDeduction >= personalTotal) {
      selectedDeduction = lumpSumDeduction;
      isLumpSum = true;
    } else {
      selectedDeduction = personalTotal;
      isLumpSum = false;
    }
  }

  // 11. 배우자공제 (§19, 최소 5억 ~ 최대 30억)
  let spouseDeduction = 0;
  if (hasSpouse) {
    const sMin = 500000000, sMax = 3000000000;
    let legalRatio, legalBase;
    if (spouseLegalShare > 0) {
      // 옛 인터페이스: spouseLegalShare 직접 사용
      const safeShare = Math.max(0, inheritanceBase * spouseLegalShare);
      if (spouseInheritance === 0 || spouseInheritance < sMin) {
        spouseDeduction = sMin;
      } else {
        spouseDeduction = Math.min(spouseInheritance, Math.min(safeShare, sMax));
        spouseDeduction = Math.max(spouseDeduction, sMin);
      }
    } else {
      // 신규 인터페이스: 자녀 수로 법정상속분 자동 계산
      legalRatio = numChildren > 0 ? 1.5 : 1;
      legalBase = numChildren > 0 ? numChildren + 1.5 : 1;
      const safeShare = Math.max(0, inheritanceBase * legalRatio / legalBase);
      if (spouseInheritance === 0 || spouseInheritance < sMin) {
        spouseDeduction = sMin;
      } else {
        spouseDeduction = Math.min(spouseInheritance, Math.min(safeShare, sMax));
        spouseDeduction = Math.max(spouseDeduction, sMin);
      }
    }
  }

  // 12. 금융재산공제 (§22) — 비상장주식 제외 (별도 입력)
  const netFinancial = financialAssets - financialDebts;
  let financialDeduction = 0;
  if (netFinancial > 0) {
    if (netFinancial <= 20000000) {
      financialDeduction = netFinancial;                                 // 2천만 이하 전액
    } else {
      financialDeduction = Math.max(netFinancial * 0.2, 20000000);       // 20% (최소 2천만)
    }
    financialDeduction = Math.min(financialDeduction, 200000000);        // 최대 2억
  }

  // 13. 총 공제액 (상증법 §24 공제한도)
  //     한도 = 과세가액 - 사전증여 - 비상속인 유증재산
  const deductionLimit = Math.max(0, taxableAmount - preGift - nonHeirBequest);
  const rawTotalDeduction = selectedDeduction + spouseDeduction + financialDeduction
                          + residenceDeduction + familyBusinessDeduction
                          + farmDeduction + disasterLoss;
  const totalDeduction = Math.min(rawTotalDeduction, deductionLimit);

  // 14. 과세표준 (최대주주 할증은 위 5단계에서 이미 반영, 별도 ×1.2 없음)
  const taxBase = Math.max(0, taxableAmount - totalDeduction);

  // 15. 산출세액 (§26 누진세율)
  const calculatedTax = calcProgressiveTax(taxBase);

  // 16. 세대생략 할증과세 (§27)
  //     비율 분모 = 상속세 과세가액 (국세청 실무 기준)
  //     미성년자 20억 초과 시 40%
  //     단서: 대습상속(자녀 사망)은 할증 적용 안 함
  let generationSurcharge = 0;
  let genSkipRatio = 0;
  let genSkipRate = 0;
  // 옛 호환: isGenSkip=true이고 genSkipAmount 미지정 시 과세가액 전체를 세대생략으로 간주
  const effGenSkipAmount = genSkipAmount > 0 ? genSkipAmount : (isGenSkip ? taxableAmount : 0);
  if (effGenSkipAmount > 0 && taxableAmount > 0 && !isDaeseupInheritance) {
    genSkipRatio = Math.min(effGenSkipAmount / taxableAmount, 1);
    genSkipRate = (isMinorGenSkip && effGenSkipAmount > 2000000000) ? 0.40 : 0.30;
    generationSurcharge = calculatedTax * genSkipRatio * genSkipRate;
  }
  const taxWithSurcharge = calculatedTax + generationSurcharge;

  // 17. 신고세액공제 (§69, 2019년 이후 3%)
  const reportDeduction = Math.round(taxWithSurcharge * 0.03);

  // 18. 증여세액공제 (§28) — 사전증여재산 합산 시 기납부 증여세 공제
  const finalTax = Math.max(0, taxWithSurcharge - reportDeduction - giftTaxPaid);

  // 19. 실효세율
  const effectiveRate = taxableAmount > 0 ? finalTax / taxableAmount : 0;

  return {
    // 옛 인터페이스 호환 필드
    grossEstate: Math.round(grossAssets + preGift),
    taxableAmount: Math.round(taxableAmount),
    mainDeduction: Math.round(selectedDeduction),
    spouseDeduction: Math.round(spouseDeduction),
    financialDeduction: Math.round(financialDeduction),
    totalDeduction: Math.round(totalDeduction),
    taxBase: Math.round(taxBase),
    calculatedTax: Math.round(calculatedTax),
    generationSurcharge: Math.round(generationSurcharge),
    reportDeduction: Math.round(reportDeduction),
    finalTax: Math.round(finalTax),
    effectiveRate,
    // 상속세는 지방소득세 과세대상이 아니므로 기존 필드명은 유지하되 0으로 반환한다.
    localTax: 0,
    totalWithLocal: Math.round(finalTax),
    // 신규 정밀 필드
    grossAssets: Math.round(grossAssets),
    totalAssetsIncludesUnlistedStock,
    isSMEUnlistedStock,
    preGift: Math.round(preGift),
    stockSurcharge: Math.round(stockSurcharge),
    inheritanceBase: Math.round(inheritanceBase),
    basicDeduction,
    childDeduction: Math.round(childDeduction),
    minorDeduction: Math.round(minorDeduction),
    elderlyDeduction: Math.round(elderlyDeduction),
    disabledDeduction: Math.round(disabledDeduction),
    personalDeduction: Math.round(personalDeduction),
    isLumpSum,
    lumpSumDeduction,
    residenceDeduction: Math.round(residenceDeduction),
    familyBusinessDeduction: Math.round(familyBusinessDeduction),
    farmDeduction: Math.round(farmDeduction),
    disasterLoss: Math.round(disasterLoss),
    deductionLimit: Math.round(deductionLimit),
    genSkipAmount: Math.round(effGenSkipAmount),
    genSkipRatio,
    genSkipRate,
    isDaeseupInheritance,
    giftTaxPaid: Math.round(giftTaxPaid),
    nonHeirBequest: Math.round(nonHeirBequest),
    // [통합 추가] PIIC 호환 필드
    itemizedDeduction: Math.round(basicDeduction + personalDeduction),
    funeralDeduction: Math.round(funeralFinal + burialFinal),
    estimateOnly: !totalAssetsIncludesUnlistedStock && unlistedStock > 0,
    warnings: [
      ...(!totalAssetsIncludesUnlistedStock && unlistedStock > 0
        ? ['totalAssets에서 비상장주식이 제외됐다는 전제로 별도 합산했습니다. 이미 포함된 경우 totalAssetsIncludesUnlistedStock=true가 필요합니다.'] : []),
      ...(familyBusinessDeduction > 0 || residenceDeduction > 0 || farmDeduction > 0
        ? ['가업·동거주택·영농상속공제는 법정 요건 충족 여부가 외부에서 확인된 입력액이라는 전제로 반영했습니다.'] : []),
    ],
  };
}


// ═══════════════════════════════════════════════════════════
// 2. 증여세 계산기 (gift-tax-calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 증여세 계산
 * @param {Object} params
 * @param {number} params.giftAmount - 증여재산가액 (원)
 * @param {string} params.relation - 관계 (spouse/lineal_descendant_adult/lineal_descendant_minor/lineal_ascendant/other_relative/other)
 * @param {number} params.priorGifts - 10년 내 기증여액 (원)
 * @param {number} params.debts - 부담부증여 채무 (원)
 * @param {boolean} params.isMarriage - 혼인공제 적용 여부
 * @param {boolean} params.isChildbirth - 출산공제 적용 여부
 * @returns {Object}
 */
function calcGiftTax(params) {
  const {
    giftAmount = 0, relation = 'other',
    priorGifts = 0, debts = 0,
    isMarriage = false, isChildbirth = false,
    priorMarriageChildbirthDeduction = 0,
    confirmedPriorGiftTax,
    reportCreditEligible = true,
  } = params || {};

  const giftValues = [giftAmount, priorGifts, debts, priorMarriageChildbirthDeduction];
  if (!giftValues.every(value => Number.isFinite(Number(value))) || giftValues.some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'calcGiftTax', missingInputs: [], invalidInputs: ['amount'], warnings: ['증여가액·채무·기증여액은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  // 증여재산공제 (10년간 합산)
  const deductions = {
    'spouse': 600000000, // 6억
    'lineal_descendant_adult': 50000000, // 5천만
    'lineal_descendant_minor': 20000000, // 2천만
    'lineal_ascendant': 50000000, // 5천만
    'other_relative': 10000000, // 1천만
    'other': 0,
  };

  const baseDeduction = deductions[relation] || 0;

  // 혼인·출산 증여재산공제는 두 제도를 합쳐 통산 1억원 한도다.
  // 과거 동일 특례 사용액이 있으면 priorMarriageChildbirthDeduction으로 차감한다.
  const isDirectAscendantGift = relation === 'lineal_descendant_adult'
    || relation === 'lineal_descendant_minor';
  const specialDeductionRemaining = Math.max(
    0,
    100000000 - Math.max(0, Number(priorMarriageChildbirthDeduction) || 0)
  );
  let marriageDeduction = 0;
  let childbirthDeduction = 0;
  if (isDirectAscendantGift && isMarriage) {
    marriageDeduction = specialDeductionRemaining;
  } else if (isDirectAscendantGift && isChildbirth) {
    childbirthDeduction = specialDeductionRemaining;
  }

  const totalDeduction = baseDeduction + marriageDeduction + childbirthDeduction;

  // 과세가액
  const taxableGift = giftAmount - debts + priorGifts;
  const taxBase = Math.max(0, taxableGift - totalDeduction);

  // 산출세액
  const calculatedTax = calcProgressiveTax(taxBase);

  // [Y-1I 수정] 기납부세액 공제 — 한국 상증세법 §58
  //   기존: priorGifts에 totalDeduction(혼인·출산공제 포함) 차감 → 이중공제 위험
  //   수정: priorGifts에는 baseDeduction(평생/10년 한도 공제)만 차감
  //   혼인·출산공제는 현재 증여 한정이므로 사전증여에서 제외
  const priorTaxEstimated = priorGifts > 0 ? calcProgressiveTax(Math.max(0, priorGifts - baseDeduction)) : 0;
  const priorTax = Number.isFinite(Number(confirmedPriorGiftTax))
    ? Math.max(0, Number(confirmedPriorGiftTax))
    : priorTaxEstimated;
  const netTax = Math.max(0, calculatedTax - priorTax);

  // 신고세액공제 (기한 내 신고·납부 요건 충족 시 3%)
  const reportDeduction = reportCreditEligible ? Math.round(netTax * 0.03) : 0;
  const finalTax = Math.max(0, netTax - reportDeduction);

  return {
    giftAmount,
    debts,
    priorGifts,
    baseDeduction,
    marriageDeduction,
    childbirthDeduction,
    priorMarriageChildbirthDeduction: Math.max(0, Number(priorMarriageChildbirthDeduction) || 0),
    specialDeductionRemaining,
    totalDeduction,
    taxBase,
    calculatedTax: Math.round(calculatedTax),
    priorTaxCredit: Math.round(priorTax),
    priorTaxCreditConfirmed: Number.isFinite(Number(confirmedPriorGiftTax)),
    reportCreditEligible,
    reportDeduction,
    finalTax: Math.round(finalTax),
    effectiveRate: giftAmount > 0 ? finalTax / giftAmount : 0,
    estimateOnly: priorGifts > 0 && !Number.isFinite(Number(confirmedPriorGiftTax)),
    warnings: priorGifts > 0 && !Number.isFinite(Number(confirmedPriorGiftTax))
      ? ['기증여재산의 실제 납부 증여세액이 없어 동일 관계·동일 공제조건으로 추정한 세액을 공제했습니다.'] : [],
  };
}


// ═══════════════════════════════════════════════════════════
// 3. 양도소득세 계산기 (capital-gains-tax-calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 소득세 누진세율 (소득세법 제55조)
 */
function calcIncomeTaxProgressive(taxBase) {
  if (taxBase <= 0) return 0;
  if (taxBase <= 14000000) return taxBase * 0.06;
  if (taxBase <= 50000000) return taxBase * 0.15 - 1260000;
  if (taxBase <= 88000000) return taxBase * 0.24 - 5760000;
  if (taxBase <= 150000000) return taxBase * 0.35 - 15440000;
  if (taxBase <= 300000000) return taxBase * 0.38 - 19940000;
  if (taxBase <= 500000000) return taxBase * 0.40 - 25940000;
  if (taxBase <= 1000000000) return taxBase * 0.42 - 35940000;
  return taxBase * 0.45 - 65940000;
}

/**
 * 양도소득세 계산
 * @param {Object} params
 * @param {number} params.transferPrice - 양도가액 (원)
 * @param {number} params.acquirePrice - 취득가액 (원)
 * @param {number} params.expenses - 필요경비 (원)
 * @param {string} params.assetType - 자산유형 (house/land/stock/etc)
 * @param {number} params.houseCount - 주택 수
 * @param {number} params.holdingYears - 보유기간 (년)
 * @param {string|Date} [params.transferDate] - 양도일자. 미입력 시 실행일 기준으로 중과 한시 배제 여부 판단
 * @param {number} params.residenceYears - 거주기간 (년)
 * @param {boolean} params.isRegulated - 조정대상지역 여부
 * @param {boolean} params.isUnregistered - 미등기 여부
 * @param {boolean} params.isNonBusinessLand - 비사업용토지 여부
 * @param {number} params.basicDeduction - 기본공제 (기본 2,500,000원)
 * @returns {Object}
 */
function parseTransferDate(value, fallbackToNow = true) {
  if (!value) return fallbackToNow ? new Date() : null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addCalendarMonths(date, months) {
  const d = new Date(date.getTime());
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Math.max(0, Number(months) || 0));
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDay));
  return d;
}

function getMultiHouseSurchargeSuspensionStatus(
  transferDate,
  holdingYears,
  {
    contractDate = null,
    depositPaidConfirmed = false,
    surchargeGraceMonths = 4,
  } = {}
) {
  const d = parseTransferDate(transferDate, false);
  if (!d || Number(holdingYears) < 2) {
    return { suspended: false, reliefType: null, transitionDeadline: null };
  }

  const start = new Date('2022-05-10T00:00:00');
  const originalEnd = new Date('2026-05-09T23:59:59');
  if (d >= start && d <= originalEnd) {
    return { suspended: true, reliefType: 'original-period', transitionDeadline: null };
  }

  const contract = parseTransferDate(contractDate, false);
  if (!depositPaidConfirmed || !contract || contract > originalEnd || d < contract) {
    return { suspended: false, reliefType: null, transitionDeadline: null };
  }

  const months = Math.min(6, Math.max(1, Number(surchargeGraceMonths) || 4));
  const transitionDeadline = addCalendarMonths(contract, months);
  transitionDeadline.setHours(23, 59, 59, 999);
  return {
    suspended: d <= transitionDeadline,
    reliefType: d <= transitionDeadline ? 'transition-contract' : null,
    transitionDeadline,
  };
}

function isMultiHouseSurchargeSuspended(transferDate, holdingYears, options = {}) {
  return getMultiHouseSurchargeSuspensionStatus(transferDate, holdingYears, options).suspended;
}

function calcSurcharge(taxBase, rate) {
  return Math.round(Math.max(0, taxBase) * rate);
}

function calcHouseCapitalGainsTaxAmount(
  taxBase,
  houseCount,
  isRegulated,
  holdingYears,
  transferDate,
  suspensionOptions = {}
) {
  const baseTax = calcIncomeTaxProgressive(taxBase);
  const suspensionStatus = isRegulated && houseCount >= 2
    ? getMultiHouseSurchargeSuspensionStatus(transferDate, holdingYears, suspensionOptions)
    : { suspended: false, reliefType: null, transitionDeadline: null };
  const suspended = suspensionStatus.suspended;
  let surchargeRate = 0;
  if (isRegulated && !suspended) {
    if (houseCount >= 3) surchargeRate = 0.30;
    else if (houseCount === 2) surchargeRate = 0.20;
  }
  const multiTax = baseTax + calcSurcharge(taxBase, surchargeRate);

  if (holdingYears < 1) {
    const shortTax = Math.round(taxBase * 0.70);
    if (surchargeRate > 0 && multiTax > shortTax) {
      return { tax: multiTax, taxNote: `1년 미만 70%와 다주택 중과 비교과세 → 기본세율 + ${Math.round(surchargeRate * 100)}%p 적용`, suspended, suspensionStatus };
    }
    return { tax: shortTax, taxNote: '단기보유 중과 (주택 1년 미만, 70%)', suspended, suspensionStatus };
  }
  if (holdingYears < 2) {
    const shortTax = Math.round(taxBase * 0.60);
    if (surchargeRate > 0 && multiTax > shortTax) {
      return { tax: multiTax, taxNote: `2년 미만 60%와 다주택 중과 비교과세 → 기본세율 + ${Math.round(surchargeRate * 100)}%p 적용`, suspended, suspensionStatus };
    }
    return { tax: shortTax, taxNote: '단기보유 중과 (주택 2년 미만, 60%)', suspended, suspensionStatus };
  }
  if (suspended) {
    return { tax: baseTax, taxNote: '다주택 중과 한시 배제기간 적용 — 기본세율 (2022.5.10.~2026.5.9. 양도분)', suspended, suspensionStatus };
  }
  if (surchargeRate > 0) {
    return { tax: multiTax, taxNote: `기본세율 + ${Math.round(surchargeRate * 100)}%p 다주택 중과`, suspended, suspensionStatus };
  }
  return { tax: baseTax, taxNote: '기본세율 (누진)', suspended, suspensionStatus };
}

function calcNonHouseCapitalGainsTaxAmount(taxBase, holdingYears, assetType) {
  const baseTax = calcIncomeTaxProgressive(taxBase);
  if ((assetType === 'land' || assetType === 'building') && holdingYears < 1) {
    return { tax: Math.max(baseTax, Math.round(taxBase * 0.50)), taxNote: '단기보유 중과 (토지·건물 1년 미만, 50%와 기본세율 중 큰 세액)' };
  }
  if ((assetType === 'land' || assetType === 'building') && holdingYears < 2) {
    return { tax: Math.max(baseTax, Math.round(taxBase * 0.40)), taxNote: '단기보유 중과 (토지·건물 2년 미만, 40%와 기본세율 중 큰 세액)' };
  }
  return { tax: baseTax, taxNote: '기본세율 (누진)' };
}

function calcCapitalGainsTax(params) {
  const {
    transferPrice = 0, acquirePrice = 0, expenses = 0,
    assetType = 'house', houseCount = 1,
    holdingYears = 0, residenceYears = 0,
    transferDate = null,
    contractDate = null,
    depositPaidConfirmed = false,
    surchargeGraceMonths = 4,
    oneHouseExemptionConfirmed,
    confirmedStockTaxRate,
    stockLocalTaxRate = 0.1,
    isRegulated = false, isUnregistered = false, isNonBusinessLand = false,
    basicDeduction = 2500000
  } = params || {};

  const capitalValues = [transferPrice, acquirePrice, expenses, houseCount, holdingYears, residenceYears, basicDeduction];
  if (!capitalValues.every(value => Number.isFinite(Number(value))) || [transferPrice, acquirePrice, expenses, houseCount, holdingYears, residenceYears, basicDeduction].some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'capitalGainsTax', missingInputs: [], invalidInputs: ['amount'], warnings: ['양도가액·취득가액·기간 입력은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  // 1. 양도차익
  const capitalGain = transferPrice - acquirePrice - expenses;
  if (capitalGain <= 0) {
    return { capitalGain: 0, taxBase: 0, tax: 0, totalTax: 0, message: '양도차익 없음' };
  }

  if (assetType === 'stock') {
    if (!Number.isFinite(Number(confirmedStockTaxRate))) {
      return {
        calculated: false,
        calculator: 'capitalGainsTax',
        missingInputs: ['confirmedStockTaxRate'],
        invalidInputs: [],
        warnings: ['주식 양도소득세율은 상장 여부·대주주 여부·중소기업 여부·보유기간에 따라 달라 확인된 적용세율이 필요합니다.'],
      };
    }
    let rate = Math.max(0, Number(confirmedStockTaxRate));
    if (rate > 1) rate /= 100;
    let localRate = Math.max(0, Number(stockLocalTaxRate) || 0);
    if (localRate > 1) localRate /= 100;
    const taxBase = Math.max(0, capitalGain - Math.max(0, Number(basicDeduction) || 0));
    const tax = Math.round(taxBase * rate);
    const localTax = Math.round(tax * localRate);
    return {
      calculated: true,
      transferPrice,
      acquirePrice,
      expenses,
      capitalGain,
      taxableGain: capitalGain,
      basicDeduction: Math.max(0, Number(basicDeduction) || 0),
      taxBase,
      tax,
      localTax,
      totalTax: tax + localTax,
      confirmedStockTaxRate: rate,
      taxNote: '외부에서 확인된 주식 양도소득세율 적용',
      effectiveRate: capitalGain > 0 ? (tax + localTax) / capitalGain : 0,
    };
  }

  // 2. 1세대 1주택 비과세 및 고가주택 부분과세
  let taxableGain = capitalGain;
  let exemptAmount = 0;
  let highPriceAdjust = false;
  const legacyOneHouseEstimate = assetType === 'house'
    && Number(houseCount) === 1
    && Number(holdingYears) >= 2
    && Number(residenceYears) >= 2;
  const oneHouseQualified = typeof oneHouseExemptionConfirmed === 'boolean'
    ? oneHouseExemptionConfirmed
    : legacyOneHouseEstimate;
  const oneHouseEligibilityEstimated = typeof oneHouseExemptionConfirmed !== 'boolean';

  if (oneHouseQualified && transferPrice <= 1200000000) {
    return {
      transferPrice,
      acquirePrice,
      expenses,
      capitalGain,
      taxableGain: 0,
      isExempt: true,
      tax: 0,
      localTax: 0,
      totalTax: 0,
      message: '1세대 1주택 비과세 요건 충족',
      oneHouseEligibilityEstimated,
      warnings: oneHouseEligibilityEstimated
        ? ['1세대 1주택 비과세 요건은 입력된 보유·거주기간으로 추정했습니다. 실제 취득시기·조정대상지역·세대요건 확인이 필요합니다.']
        : [],
    };
  }

  if (oneHouseQualified && transferPrice > 1200000000) {
    highPriceAdjust = true;
    const highPriceRatio = (transferPrice - 1200000000) / transferPrice;
    taxableGain = Math.round(capitalGain * highPriceRatio);
    exemptAmount = Math.max(0, capitalGain - taxableGain);
  }

  // 3. 장기보유특별공제
  let longTermRate = 0;
  const transferDateForCalc = parseTransferDate(transferDate, true);
  if (!transferDateForCalc) {
    return {
      calculated: false,
      missingInputs: [],
      invalidInputs: ['transferDate'],
      warnings: ['양도일자 형식이 올바르지 않아 계산하지 않았습니다.'],
      calculator: 'capitalGainsTax',
    };
  }
  const suspensionOptions = { contractDate, depositPaidConfirmed, surchargeGraceMonths };
  const multiHouseSuspensionStatus = assetType === 'house' && Number(houseCount) >= 2 && isRegulated
    ? getMultiHouseSurchargeSuspensionStatus(transferDateForCalc, holdingYears, suspensionOptions)
    : { suspended: false, reliefType: null, transitionDeadline: null };
  const multiHouseSuspended = multiHouseSuspensionStatus.suspended;

  if (assetType === 'house' && houseCount === 1 && oneHouseQualified && residenceYears >= 2) {
    // 1세대 1주택 고가주택 장기보유특별공제 — 한국 소득세법 §95② 표2
    //   (거주기간 2년 이상 충족 시에만 적용)
    //   - 보유기간 공제율: 연 4% (3년 이상, 최대 40% = 10년)
    //   - 거주기간 공제율: 연 4% (2년 이상, 최대 40% = 10년)
    //   - 합계 최대 80% 한도
    //   ※ 거주 2년 미만이면 아래 else if 의 일반표(표1, 연 2%·최대 30%) 적용
    const holdRate = holdingYears >= 3 ? Math.min(Math.floor(holdingYears), 10) * 0.04 : 0;
    const resRate  = residenceYears >= 2 ? Math.min(Math.floor(residenceYears), 10) * 0.04 : 0;
    longTermRate = Math.min(holdRate + resRate, 0.8);
  } else if (holdingYears >= 3) {
    // 일반: 3년 6%부터 매년 2%p 증가, 최대 30% (소득세법 제95조)
    if (holdingYears >= 15)      longTermRate = 0.30;
    else if (holdingYears >= 14) longTermRate = 0.28;
    else if (holdingYears >= 13) longTermRate = 0.26;
    else if (holdingYears >= 12) longTermRate = 0.24;
    else if (holdingYears >= 11) longTermRate = 0.22;
    else if (holdingYears >= 10) longTermRate = 0.20;
    else if (holdingYears >= 9)  longTermRate = 0.18;
    else if (holdingYears >= 8)  longTermRate = 0.16;
    else if (holdingYears >= 7)  longTermRate = 0.14;
    else if (holdingYears >= 6)  longTermRate = 0.12;
    else if (holdingYears >= 5)  longTermRate = 0.10;
    else if (holdingYears >= 4)  longTermRate = 0.08;
    else                         longTermRate = 0.06;
  }

  // 다주택 중과 적용 구간에서는 장기보유특별공제 배제. 한시 배제기간에는 배제하지 않음.
  if (assetType === 'house' && houseCount >= 2 && isRegulated && !multiHouseSuspended) {
    longTermRate = 0;
  }

  const longTermDeduction = Math.round(taxableGain * longTermRate);
  const taxableIncome = Math.max(0, taxableGain - longTermDeduction);

  // 4. 기본공제
  const finalBasicDeduction = isUnregistered ? 0 : basicDeduction;
  const taxBase = Math.max(0, taxableIncome - finalBasicDeduction);

  // 5. 세율 적용
  let taxResult;
  if (isUnregistered) {
    taxResult = { tax: Math.round(taxBase * 0.70), taxNote: '미등기 중과 (70%)', suspended: false };
  } else if (assetType === 'house') {
    taxResult = calcHouseCapitalGainsTaxAmount(
      taxBase,
      Number(houseCount),
      isRegulated,
      holdingYears,
      transferDateForCalc,
      suspensionOptions
    );
  } else {
    taxResult = calcNonHouseCapitalGainsTaxAmount(taxBase, holdingYears, assetType);
  }

  let tax = taxResult.tax;
  let taxNote = taxResult.taxNote;

  if (isNonBusinessLand && !isUnregistered) {
    tax += calcSurcharge(taxBase, 0.10);
    taxNote += ' + 비사업용토지 중과 (+10%p)';
  }

  const roundedTax = Math.round(tax);
  const localTax = Math.round(roundedTax * 0.1);
  const totalTax = roundedTax + localTax;

  return {
    transferPrice,
    acquirePrice,
    expenses,
    capitalGain,
    exemptAmount,
    taxableGain,
    highPriceAdjust,
    longTermRate,
    longTermDeduction,
    taxableIncome,
    basicDeduction: finalBasicDeduction,
    taxBase,
    tax: roundedTax,
    localTax,
    totalTax,
    taxNote,
    isMultiHouseSurchargeSuspended: !!taxResult.suspended || multiHouseSuspended,
    multiHouseReliefType: (taxResult.suspensionStatus && taxResult.suspensionStatus.reliefType)
      || multiHouseSuspensionStatus.reliefType,
    transitionDeadline: (
      (taxResult.suspensionStatus && taxResult.suspensionStatus.transitionDeadline)
      || multiHouseSuspensionStatus.transitionDeadline
    )
      ? ((taxResult.suspensionStatus && taxResult.suspensionStatus.transitionDeadline)
        || multiHouseSuspensionStatus.transitionDeadline).toISOString().slice(0, 10)
      : null,
    oneHouseEligibilityEstimated,
    warnings: oneHouseEligibilityEstimated && assetType === 'house' && Number(houseCount) === 1
      ? ['1세대 1주택 비과세·장기보유특별공제 요건은 입력값으로 추정했습니다. 실제 취득시기·조정대상지역·세대요건 확인이 필요합니다.']
      : [],
    transferDate: transferDateForCalc.toISOString().slice(0, 10),
    estimateOnly: oneHouseEligibilityEstimated || assetType === 'etc',
    effectiveRate: capitalGain > 0 ? totalTax / capitalGain : 0,
  };
}


// ═══════════════════════════════════════════════════════════
// 4. 퇴직소득세 계산기 (severance-calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 근속연수공제 (소득세법 제48조)
 */
function calcYearDeduction(years) {
  if (years <= 0) return 0;
  if (years <= 5) return years * 1000000;
  if (years <= 10) return 5000000 + (years - 5) * 2000000;
  if (years <= 20) return 15000000 + (years - 10) * 2500000;
  return 40000000 + (years - 20) * 3000000;
}

/**
 * 환산급여 공제 (소득세법 시행령 제40조)
 */
function calcConvertedDeduction(convertedSalary) {
  if (convertedSalary <= 0) return 0;
  if (convertedSalary <= 8000000) return convertedSalary;
  if (convertedSalary <= 70000000) return 8000000 + (convertedSalary - 8000000) * 0.6;
  if (convertedSalary <= 100000000) return 45200000 + (convertedSalary - 70000000) * 0.55;
  if (convertedSalary <= 300000000) return 61700000 + (convertedSalary - 100000000) * 0.45;
  return 151700000 + (convertedSalary - 300000000) * 0.35;
}

/**
 * 퇴직소득세 계산
 * @param {Object} params
 * @param {number} params.severancePay - 퇴직금 (원)
 * @param {number} params.serviceYears - 근속연수 (년, 소수점 가능)
 * @param {number} params.priorSettlement - 중간정산 금액 (원)
 * @param {number} params.priorYears - 중간정산 근속연수 (년)
 * @returns {Object}
 */
function calcSeveranceTax(params) {
  const {
    severancePay = 0,
    serviceYears = 0,
    priorSettlement = 0,
    priorYears = 0
  } = params || {};

  if (![severancePay, serviceYears, priorSettlement, priorYears].every(Number.isFinite)
      || [severancePay, serviceYears, priorSettlement, priorYears].some(value => value < 0)
      || priorYears > serviceYears) {
    return { calculated: false, calculator: 'calcSeveranceTax', missingInputs: [], invalidInputs: ['input'], warnings: ['퇴직금·근속연수·중간정산 입력을 확인해 주세요.'] };
  }

  const taxableYears = Math.max(0, serviceYears - priorYears);
  const taxableSeverance = Math.max(0, severancePay - priorSettlement);

  if (taxableSeverance <= 0 || taxableYears <= 0) {
    return { tax: 0, message: '과세대상 퇴직소득 없음' };
  }

  // 1. 근속연수공제 (근속연수는 1년 미만 切上)
  const yearsForCalc = Math.ceil(taxableYears);
  const yearDeduction = calcYearDeduction(yearsForCalc);
  const afterYearDeduction = Math.max(0, taxableSeverance - yearDeduction);

  // 2. 환산급여 = (퇴직소득 - 근속연수공제) × 12 / 근속연수
  const convertedSalary = afterYearDeduction * 12 / Math.max(1, yearsForCalc);

  // 3. 환산급여 공제
  const convertedDeduction = calcConvertedDeduction(convertedSalary);

  // 4. 과세표준
  const taxBase = Math.max(0, convertedSalary - convertedDeduction);

  // 5. 환산산출세액
  const convertedTax = calcIncomeTaxProgressive(taxBase);

  // 6. 실제 퇴직소득 산출세액 = 환산세액 × 근속연수 / 12
  const actualTax = Math.round(convertedTax * yearsForCalc / 12);
  const localTax = Math.round(actualTax * 0.1);

  return {
    taxableSeverance,
    taxableYears,
    yearDeduction,
    afterYearDeduction,
    convertedSalary: Math.round(convertedSalary),
    convertedDeduction: Math.round(convertedDeduction),
    taxBase: Math.round(taxBase),
    convertedTax: Math.round(convertedTax),
    actualTax,
    localTax,
    totalTax: actualTax + localTax,
    effectiveRate: taxableSeverance > 0 ? (actualTax + localTax) / taxableSeverance : 0,
    netSeverance: taxableSeverance - actualTax - localTax,
  };
}


// ═══════════════════════════════════════════════════════════
// 5. 법인세 계산기 (Corporate_Tax_Calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 법인세 계산
 * @param {Object} params
 * @param {number} params.taxableIncome - 과세표준 (원)
 * @param {string} params.corpType - 법인유형 (sme/general/sme_realty)
 * @param {number} params.taxYear - 적용연도. 2026년 이후는 인상 세율 적용
 * @returns {Object}
 */
function calcCorporateTax(params) {
  const {
    taxableIncome = 0,
    corpType = 'sme',
    taxYear = new Date().getFullYear()
  } = params || {};

  if (!Number.isFinite(Number(taxableIncome)) || Number(taxableIncome) < 0 || !Number.isFinite(Number(taxYear))) {
    return { calculated: false, calculator: 'calcCorporateTax', missingInputs: [], invalidInputs: ['input'], warnings: ['과세표준과 적용연도를 확인해 주세요.'] };
  }

  // 법인세율: 2026.1.1. 이후 개시 사업연도는 전 구간 1%p 인상
  const isYear2026OrLater = Number(taxYear) >= 2026;
  let brackets;
  if (corpType === 'sme_realty') {
    // 성실신고확인대상 소규모법인 등: 2억 이하 구간 없이 200억 이하 단일구간
    brackets = isYear2026OrLater ? [
      { cap: 20000000000, rate: 0.20 },
      { cap: 300000000000, rate: 0.22 },
      { cap: Infinity, rate: 0.25 },
    ] : [
      { cap: 20000000000, rate: 0.19 },
      { cap: 300000000000, rate: 0.21 },
      { cap: Infinity, rate: 0.24 },
    ];
  } else {
    // 일반/중소기업
    brackets = isYear2026OrLater ? [
      { cap: 200000000, rate: 0.10 },
      { cap: 20000000000, rate: 0.20 },
      { cap: 300000000000, rate: 0.22 },
      { cap: Infinity, rate: 0.25 },
    ] : [
      { cap: 200000000, rate: 0.09 },
      { cap: 20000000000, rate: 0.19 },
      { cap: 300000000000, rate: 0.21 },
      { cap: Infinity, rate: 0.24 },
    ];
  }

  let tax = 0;
  let remaining = taxableIncome;
  let prevCap = 0;
  const details = [];

  for (const bracket of brackets) {
    const taxable = Math.min(remaining, bracket.cap - prevCap);
    if (taxable <= 0) break;
    const bracketTax = taxable * bracket.rate;
    tax += bracketTax;
    details.push({
      range: `${prevCap / 100000000}억 ~ ${bracket.cap === Infinity ? '∞' : bracket.cap / 100000000 + '억'}`,
      rate: bracket.rate,
      taxable: Math.round(taxable),
      tax: Math.round(bracketTax),
    });
    remaining -= taxable;
    prevCap = bracket.cap;
  }

  const roundedTax = Math.round(tax);
  const localTax = Math.round(roundedTax * 0.1);

  return {
    taxableIncome,
    corpType,
    taxYear,
    taxRateBasis: isYear2026OrLater ? '2026년 이후 법인세율' : '2023~2025년 법인세율',
    tax: roundedTax,
    localTax,
    totalTax: roundedTax + localTax,
    effectiveRate: taxableIncome > 0 ? (roundedTax + localTax) / taxableIncome : 0,
    details,
  };
}


// ═══════════════════════════════════════════════════════════
// 6. 인정이자 계산기 (Deemed_Interest_Calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 인정이자 계산
 * @param {Object} params
 * @param {number} params.loanAmount - 가지급금/대여금 (원)
 * @param {number} params.interestRate - 약정 이자율 (0~1)
 * @param {number} params.deemedRate - 인정이자율 (0~1, 기본 0.046)
 * @param {number} params.days - 적용일수
 * @returns {Object}
 */
function calcDeemedInterest(params) {
  const safeParams = params || {};
  const {
    loanAmount = 0,
    interestRate = 0,
    deemedRate = 0.046,
    days = 365,
    corpType = 'sme',
    taxYear = new Date().getFullYear(),
  } = safeParams;
  const corpIncomeProvided = Number.isFinite(Number(safeParams.corpTaxableIncome));
  const marginalProvided = Number.isFinite(Number(safeParams.marginalRate));
  const corpTaxableIncome = corpIncomeProvided ? Math.max(0, Number(safeParams.corpTaxableIncome)) : null;
  let marginalRate = marginalProvided ? Math.max(0, Number(safeParams.marginalRate)) : null;
  if (marginalRate !== null && marginalRate > 1) marginalRate /= 100;

  if (![loanAmount, interestRate, deemedRate, days, taxYear].every(value => Number.isFinite(Number(value)))
      || Number(loanAmount) < 0 || Number(days) < 0 || Number(interestRate) < 0 || Number(deemedRate) < 0
      || (marginalRate !== null && marginalRate > 1)) {
    return { calculated: false, calculator: 'calcDeemedInterest', missingInputs: [], invalidInputs: ['input'], warnings: ['대여금·이자율·적용일수·세율 입력을 확인해 주세요.'] };
  }

  const actualInterest = Math.round(Number(loanAmount) * Number(interestRate) * Number(days) / 365);
  const deemedInterestAmount = Math.round(Number(loanAmount) * Number(deemedRate) * Number(days) / 365);
  const difference = Math.max(0, deemedInterestAmount - actualInterest);

  let corpTaxEffect = null;
  let corpRate = null;
  if (corpIncomeProvided) {
    const before = calcCorporateTax({ taxableIncome: corpTaxableIncome, corpType, taxYear });
    const after = calcCorporateTax({ taxableIncome: corpTaxableIncome + difference, corpType, taxYear });
    corpTaxEffect = Math.max(0, after.tax - before.tax);
    corpRate = difference > 0 ? corpTaxEffect / difference : 0;
  }
  const incomeTaxEffect = marginalRate === null ? null : Math.round(difference * marginalRate);
  const corpLocalTaxEffect = corpTaxEffect === null ? null : Math.round(corpTaxEffect * 0.1);
  const incomeLocalTaxEffect = incomeTaxEffect === null ? null : Math.round(incomeTaxEffect * 0.1);
  const totalTaxBurden = corpTaxEffect === null || incomeTaxEffect === null
    ? null : corpTaxEffect + incomeTaxEffect;
  const totalTaxBurdenIncludingLocal = totalTaxBurden === null
    ? null : Math.round(totalTaxBurden * 1.1);
  const warnings = [];
  if (!corpIncomeProvided) warnings.push('법인 과세표준이 없어 인정이자 익금산입에 따른 법인세 증가액은 계산하지 않았습니다.');
  if (!marginalProvided) warnings.push('대표자 확인 한계소득세율이 없어 상여처분 소득세 효과는 계산하지 않았습니다.');
  warnings.push('실제 소득처분, 약정·회수 사실, 지방소득세와 법인세 과세표준 변동을 함께 확인해야 합니다.');

  return {
    calculated: true,
    loanAmount: Number(loanAmount),
    interestRate: Number(interestRate),
    deemedRate: Number(deemedRate),
    days: Number(days),
    actualInterest,
    deemedInterest: deemedInterestAmount,
    difference,
    corpTaxableIncome,
    corpRate,
    corpTaxEffect,
    marginalRate,
    incomeTaxEffect,
    corpLocalTaxEffect,
    incomeLocalTaxEffect,
    totalTaxBurden,
    totalTaxBurdenIncludingLocal,
    taxEffectsCalculated: corpTaxEffect !== null && incomeTaxEffect !== null,
    estimateOnly: warnings.length > 1,
    warnings,
    annualDifference: Math.round(Number(loanAmount) * (Number(deemedRate) - Number(interestRate))),
  };
}


// ═══════════════════════════════════════════════════════════
// 7. 비상장주식 평가 (Unlisted_Stock_Valuation_Calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 비상장주식 순자산가치/순손익가치 가중평균 평가
 * @param {Object} params
 * @param {number} params.netAssets - 순자산가치 (회사 전체, 원)
 * @param {number} params.earningsValue - 순손익가치 (회사 전체, 원)
 * @param {string} params.industry - 업종 (general/realty/special)
 * @param {number} params.totalShares - 총 발행주식수
 * @param {number} params.targetShares - 평가 대상 주식수
 * @returns {Object}
 */
function calcUnlistedStockValue(params) {
  const {
    netAssets = 0, earningsValue = 0,
    industry = 'general',
    totalShares = 1, targetShares = 1,
    confirmedFloorRate,
  } = params || {};

  if (![netAssets, earningsValue, totalShares, targetShares].every(Number.isFinite)
      || totalShares <= 0 || targetShares < 0) {
    return { calculated: false, calculator: 'calcUnlistedStockValue', missingInputs: [], invalidInputs: ['input'], warnings: ['순자산·순손익가치·주식 수 입력을 확인해 주세요.'] };
  }

  // 가중치: 일반업종 순손익3 + 순자산2, 부동산업 순손익2 + 순자산3
  let earningsWeight, assetWeight;
  if (industry === 'realty') {
    earningsWeight = 2;
    assetWeight = 3;
  } else {
    earningsWeight = 3;
    assetWeight = 2;
  }

  // ★ 회사 전체 가치 가중평균 (상증령 제54조)
  const totalWeightedValue = (earningsValue * earningsWeight + netAssets * assetWeight) / (earningsWeight + assetWeight);

  // ★ 주당 가치 = 가중평균 가치 ÷ 총 발행주식수
  const safeTotalShares = Math.max(1, totalShares);
  const weightedValuePerShare = totalWeightedValue / safeTotalShares;

  // 순자산가치 하한 (80%) — 주당 기준으로 환산
  const floorRate = Number.isFinite(Number(confirmedFloorRate))
    ? Math.min(1, Math.max(0, Number(confirmedFloorRate)))
    : 0.8;
  const floorValuePerShare = (netAssets * floorRate) / safeTotalShares;
  const finalValuePerShare = Math.max(weightedValuePerShare, floorValuePerShare);

  // 평가대상 주식수 × 주당 가치
  const totalValuation = finalValuePerShare * targetShares;

  return {
    netAssets,
    earningsValue,
    earningsWeight,
    assetWeight,
    totalShares: safeTotalShares,
    weightedValue: Math.round(weightedValuePerShare),   // 주당 가중평균 (API 호환 유지)
    floorValue: Math.round(floorValuePerShare),         // 주당 80% 하한
    finalValue: Math.round(finalValuePerShare),         // 주당 최종가치
    targetShares,
    floorRate,
    totalValuation: Math.round(totalValuation),         // 평가대상 주식 총액
    usedFloor: finalValuePerShare === floorValuePerShare,
    estimateOnly: !Number.isFinite(Number(confirmedFloorRate)),
    warnings: !Number.isFinite(Number(confirmedFloorRate))
      ? ['순손익가치 산정근거·부동산과다보유법인 여부·순자산가치 하한 등 세부 요건이 확인되지 않아 일반 80% 하한으로 추정했습니다.'] : [],
  };
}


// ═══════════════════════════════════════════════════════════
// 8. 급여 vs 배당 비교 (Salary_vs_Dividend_Comparison_Calculator.html 기반)
// ═══════════════════════════════════════════════════════════

/**
 * 근로소득 공제
 */
function calcEarnedIncomeDeduction(salary) {
  if (salary <= 5000000) return salary * 0.7;
  if (salary <= 15000000) return 3500000 + (salary - 5000000) * 0.4;
  if (salary <= 45000000) return 7500000 + (salary - 15000000) * 0.15;
  if (salary <= 100000000) return 12000000 + (salary - 45000000) * 0.05;
  return Math.min(20000000, 14750000 + (salary - 100000000) * 0.02);
}

/**
 * 급여 vs 배당 세부담 비교
 * @param {Object} params
 * @param {number} params.totalAmount - 총 인출 금액 (원)
 * @param {number} params.corpTaxableIncome - 법인 과세소득 (원)
 * @returns {Object}
 */
function calcSalaryVsDividend(params) {
  const {
    totalAmount = 0,
    corpTaxableIncome = 0,
    otherIncome = 0,
    confirmedDividendTax,
    taxYear = new Date().getFullYear(),
    corpType = 'sme',
  } = params || {};
  if (![totalAmount, corpTaxableIncome, otherIncome].every(Number.isFinite) || totalAmount < 0 || corpTaxableIncome < 0 || otherIncome < 0) {
    return { calculated: false, calculator: 'calcSalaryVsDividend', missingInputs: [], invalidInputs: ['input'], warnings: ['인출액과 소득 입력을 확인해 주세요.'] };
  }

  // 급여 경로
  const salary = totalAmount;
  const earnedDeduction = calcEarnedIncomeDeduction(salary);
  const salaryTaxBase = Math.max(0, salary - earnedDeduction - 1500000); // 기본공제
  const salaryIncomeTax = calcIncomeTaxProgressive(salaryTaxBase);
  const salaryLocalTax = Math.round(salaryIncomeTax * 0.1);
  // 4대보험 (근로자 부담분 약 9%)
  const insurance = Math.round(Math.min(salary, 120000000) * 0.09);
  const salaryNetAmount = salary - Math.round(salaryIncomeTax) - salaryLocalTax - insurance;

  // 배당 경로
  const corpTaxResult = calcCorporateTax({ taxableIncome: corpTaxableIncome, taxYear, corpType });
  const corpTax = corpTaxResult && corpTaxResult.calculated === false ? 0 : corpTaxResult.totalTax;
  const afterCorpTax = corpTaxableIncome - corpTax;
  const dividend = Math.min(totalAmount, afterCorpTax);
  const dividendCapped = dividend < totalAmount; // 세후이익(배당재원) 한도로 인출액이 제한됨
  // 배당소득세 (2천만원 이하 15.4% 분리과세, 초과 시 종합과세 + Gross-up + 배당세액공제)
  // 법령: 소득세법 §17③ Gross-up, §55 누진세, §56 배당세액공제, 지방세법 §103의3
  let dividendTax;
  let dividendTaxDetail = {};
  if (Number.isFinite(Number(confirmedDividendTax))) {
    dividendTax = Math.max(0, Number(confirmedDividendTax));
    dividendTaxDetail = { method: '확인된 배당세액', confirmed: true };
  } else if (dividend <= 20000000) {
    dividendTax = Math.round(dividend * 0.154);
    dividendTaxDetail = { method: '원천징수 15.4% 추정', confirmed: false };
  } else {
    // 배당가산·배당세액공제 대상 여부를 모르는 경우에는 일반 금융소득 비교과세로 보수적으로 추정한다.
    const threshold = 20000000;
    const otherTax = calcIncomeTaxProgressive(Math.max(0, otherIncome - 1500000));
    const method1 = calcIncomeTaxProgressive(Math.max(0, otherIncome + dividend - threshold - 1500000)) + threshold * 0.14;
    const method2 = otherTax + dividend * 0.14;
    const attributableNational = Math.max(0, Math.max(method1, method2) - otherTax);
    dividendTax = Math.round(attributableNational * 1.1);
    dividendTaxDetail = { method: '금융소득 비교과세 추정', method1: Math.round(method1), method2: Math.round(method2), confirmed: false };
  }
  const dividendNetAmount = dividend - dividendTax;

  return {
    salary: {
      grossAmount: salary,
      earnedDeduction: Math.round(earnedDeduction),
      taxBase: Math.round(salaryTaxBase),
      incomeTax: Math.round(salaryIncomeTax),
      localTax: salaryLocalTax,
      insurance,
      netAmount: Math.round(salaryNetAmount),
      effectiveRate: salary > 0 ? 1 - salaryNetAmount / salary : 0,
    },
    dividend: {
      grossAmount: dividend,
      capped: dividendCapped,
      cappedNote: dividendCapped ? '인출액이 세후이익(배당재원) 한도로 제한됨 — 급여경로와 동일 인출액 비교 아님' : null,
      corpTaxPaid: corpTax,
      dividendTax,
      detail: dividendTaxDetail,
      netAmount: Math.round(dividendNetAmount),
      effectiveRate: dividend > 0 ? 1 - dividendNetAmount / dividend : 0,
    },
    recommendation: salaryNetAmount > dividendNetAmount ? 'salary' : 'dividend',
    recommendationPreliminary: true,
    difference: Math.round(Math.abs(salaryNetAmount - dividendNetAmount)),
    estimateOnly: true,
    warnings: [
      '급여와 배당은 법인 손금·사업주 사회보험료·다른 금융소득·배당가산 및 배당세액공제에 따라 결과가 달라지는 사전 비교입니다.',
      ...(Number.isFinite(Number(confirmedDividendTax)) ? [] : ['배당세액은 확인세액이 없어 일반 비교과세 방식으로 추정했습니다.']),
    ],
  };
}


// ═══════════════════════════════════════════════════════════
// Module Exports
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// 키맨·CEO 유고 시 회사 운영자금 필요액
//    CEO/핵심임원 유고 시 회사가 단기간 내 필요한 자금 갭 산출.
//    개인 사례보고서의 calcLifeInsuranceNeed 의 법인 대응 함수.
//    설계 원칙: 함수가 모든 산수를 담당, AI는 결과만 인용.
// ═══════════════════════════════════════════════════════════

/**
 * 키맨·CEO 유고 시 회사 운영자금 필요액
 * @param {object} params
 * @param {number} params.monthlyOperatingShortfall - 월 운영자금 부족분(직원급여·임대·기본비용 등) (원)
 * @param {number} [params.impactMonths=12]         - 영향 지속 기간(개월). 90일 즉시 자금이면 3, 통상 6~12
 * @param {number} [params.replacementCost=0]       - 후임자 채용·교육 일회성 비용 (원)
 * @param {number} [params.guaranteedDebt=0]        - CEO 보증부 부채 즉시 상환 필요액 (원)
 * @param {number} [params.liquidAssets=0]          - 회사 즉시활용 가능 자산 (원)
 * @param {number} [params.existingKeymanCoverage=0]- 기존 키맨/경영자 보장 합계 (원)
 */
function calcCorpKeymanNeed(params) {
  const {
    monthlyOperatingShortfall = 0,
    impactMonths = 12,
    replacementCost = 0,
    guaranteedDebt = 0,
    liquidAssets = 0,
    existingKeymanCoverage = 0,
  } = params || {};

  const months = Math.max(0, impactMonths);
  const shortfallTotal = Math.max(0, monthlyOperatingShortfall) * months;
  const totalNeed = shortfallTotal + Math.max(0, replacementCost) + Math.max(0, guaranteedDebt);
  const offset = Math.max(0, liquidAssets) + Math.max(0, existingKeymanCoverage);
  const gap = Math.max(0, totalNeed - offset);

  return {
    shortfallTotal,
    replacementCost: Math.max(0, replacementCost),
    guaranteedDebt: Math.max(0, guaranteedDebt),
    totalNeed,
    liquidAssets: Math.max(0, liquidAssets),
    existingKeymanCoverage: Math.max(0, existingKeymanCoverage),
    offset,
    requiredCoverageGap: gap,
    summary: {
      totalNeed_억: Math.round(totalNeed / 10000000) / 10,
      shortfall_억: Math.round(shortfallTotal / 10000000) / 10,
      gap_억: Math.round(gap / 10000000) / 10,
      gap_만: Math.round(gap / 10000),
    },
  };
}

// [통합] 양쪽 환경 호환 export (PIIC + JARVIA + 브라우저 모두 지원)
const _Corp_exports = {
  // 세율 계산 유틸
  calcProgressiveTax,
  calcIncomeTaxProgressive,

  // 상속세
  calcInheritanceTax,

  // 증여세
  calcGiftTax,

  // 양도소득세
  calcCapitalGainsTax,

  // 퇴직소득세
  calcSeveranceTax,

  // 법인세
  calcCorporateTax,

  // 인정이자
  calcDeemedInterest,

  // 비상장주식
  calcUnlistedStockValue,

  // 급여 vs 배당
  calcSalaryVsDividend,

  // 유틸
  calcYearDeduction,
  calcConvertedDeduction,
  calcEarnedIncomeDeduction,

  // 키맨·CEO 유고 시 회사 운영자금
  calcCorpKeymanNeed,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _Corp_exports;
}
if (typeof window !== 'undefined') {
  window.Corp = _Corp_exports;
}

},
"./tax-personal": function(module, exports, require, __filename, __dirname) {
/**
 * JARVIA 개인 세금 계산기 모듈 (신규)
 * 용도: Cloud Functions에서 PPT 생성 파이프라인 내 계산 결과 제공
 *
 * 세율/공제 기준: 2026년 5월 현재 기준 반영, 실제 적용 전 전문가 확인 필요
 * 모든 함수는 순수 함수 (DOM 의존성 없음, Node.js 환경 실행 가능)
 *
 * 변경 이력:
 *   v3.2 (2026-05-15): 추가 점검에서 발견된 1건 정밀화
 *     - calcRentalIncome 분리과세 산식 (소득세법 §64조의2):
 *         필요경비율: 일률 60% → 미등록 50% / 등록 60% 분기
 *         기본공제:   일률 150만 → 미등록 200만 / 등록 400만 (다른 종합소득 2천만 이하 시만)
 *         + isRegistered 파라미터 추가 (지자체+세무서 등록 + 임대료 증가율 5% 이하)
 *
 *   v3.1 (2026-05-15): 점검 재발견 3건 추가 수정
 *     - calcEarnedIncome 근로소득 세액공제 산출세액 300만 초과 공제율:
 *         20% → 30% (소득세법 §59 ①, 2023.1.1 이후 30% 통일)
 *     - calcEarnedIncome 근로소득 세액공제 한도 7,000만 초과:
 *         일률 44만 4천원 → 50만원 (최저 적용)
 *         + 3,300만~7,000만 구간 최저 66만 가드 추가
 *     - calcRentalIncome 간주임대료 정기예금이자율:
 *         3.5% → 3.1% (2026.1 시행규칙 개정, 2026년 귀속분~)
 *
 *   v3.0 (2026-05-15): 5건 정밀화
 *     - calcEarnedIncome 자녀세액공제 산식 (소득세법 §59조의2, 2024.12.31 개정):
 *         1명 15만→25만, 2명 35만→55만, 3명 이상 (n-2)×30만→40만
 *     - 7세 미만 자녀 추가 20만 공제 제거 (현행 자녀세액공제는 8세 이상만)
 *     - calcEarnedIncome/calcGlobalIncome 국민연금 직장가입자 상한:
 *         옛: 590만 × 4.5% × 12 = 233만 2,800
 *         현행: 637만 × 4.75% × 12 = 363만 900 (2025.7~2026.6 + 2026.1 인상)
 *     - calcSocialInsurancePersonal 4대보험 요율 2026년 인상:
 *         국민연금 4.5%→4.75%, 상한 590만→637만
 *         건강보험 3.545%→3.595%
 *         장기요양 12.81%→13.14% (0.9448/7.19)
 *
 * 포함 계산기:
 *  1. 부동산 임대소득세 (calcRentalIncome)
 *  2. 금융소득 종합과세 (calcFinancialIncome)
 *  3. 근로소득·연말정산  (calcEarnedIncome)
 *  4. 종합소득세         (calcGlobalIncome)
 *  5. ISA·절세상품 수익  (calcISASavings)
 *  6. 주담대 이자공제    (calcMortgageDeduction)
 *  7. 창업·중소기업 감면 (calcStartupTaxCredit)
 *  8. 사회보험료         (calcSocialInsurance)
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// 유틸: 종합소득세 누진세율 (소득세법 제55조)
// ═══════════════════════════════════════════════════════════
function _incomeTax(taxBase) {
  if (taxBase <= 0) return 0;
  if (taxBase <= 14000000)  return taxBase * 0.06;
  if (taxBase <= 50000000)  return taxBase * 0.15 - 1260000;
  if (taxBase <= 88000000)  return taxBase * 0.24 - 5760000;
  if (taxBase <= 150000000) return taxBase * 0.35 - 15440000;
  if (taxBase <= 300000000) return taxBase * 0.38 - 19940000;
  if (taxBase <= 500000000) return taxBase * 0.40 - 25940000;
  if (taxBase <= 1000000000) return taxBase * 0.42 - 35940000;
  return taxBase * 0.45 - 65940000;
}


function _effectiveYyyymm(value) {
  const raw = String(value || '').replace(/[^0-9]/g, '');
  if (raw.length >= 6) return Number(raw.slice(0, 6));
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth() + 1;
}

function _npsMonthlyCap(value) {
  return _effectiveYyyymm(value) >= 202607 ? 6590000 : 6370000;
}

function _estimatedAnnualNpsEmployeeContribution(grossSalary, taxYear = 2026) {
  const salary = Math.max(0, Number(grossSalary) || 0);
  const monthly = salary / 12;
  const year = Number(taxYear) || 2026;
  if (year === 2026) {
    return Math.min(monthly, 6370000) * 0.0475 * 6
      + Math.min(monthly, 6590000) * 0.0475 * 6;
  }
  const cap = year >= 2027 ? 6590000 : 6370000;
  return Math.min(monthly, cap) * 0.0475 * 12;
}

// ═══════════════════════════════════════════════════════════
// 1. 부동산 임대소득세 계산기
//    (소득세법 제19조, 제25조, 제64조의2)
// ═══════════════════════════════════════════════════════════

/**
 * 부동산 임대소득세 계산
 * @param {Object} params
 * @param {number} params.annualRent        - 연간 임대수입 (원)
 * @param {number} params.deposit           - 보증금 합계 (원)
 * @param {number} params.numHouses         - 주택 수
 * @param {boolean} params.isSmallLandlord  - 소규모 임대사업자 여부 (연 2천만원 이하)
 * @param {number} params.necessaryExpense  - 필요경비율 (0~1, 기본 0.6 분리과세 / 0.4 종합과세)
 * @param {number} params.otherIncome       - 다른 종합소득 (원, 종합과세 시 합산)
 * @param {number} params.basicDeduction    - 기본공제 (원, 기본 1,500,000)
 * @returns {Object}
 */
function calcRentalIncome(params) {
  const {
    annualRent       = 0,
    deposit          = 0,
    numHouses        = 1,
    isSmallLandlord  = false,
    isRegistered     = false,  // 등록임대주택 여부 (지자체+세무서 등록, 임대료 증가율 5% 이하)
    necessaryExpense = null,
    otherIncome      = 0,
    basicDeduction   = 1500000,
    taxYear          = 2026,
    highValueHouseCount = 0,   // 해당 과세기간 기준시가 12억원 초과 주택 수
    isOverseasSingleHouse = false,
    oneHouseTaxableConfirmed,
    deemedRentFinancialIncome = 0,  // 임대보증금 운용수익(시행령 §53④ 차감분), 미입력 시 0
  } = params || {};

  const rentalValues = [annualRent, deposit, numHouses, otherIncome, basicDeduction, deemedRentFinancialIncome, highValueHouseCount];
  if (!rentalValues.every(value => Number.isFinite(Number(value))) || Number(annualRent) < 0 || Number(deposit) < 0 || Number(numHouses) < 0) {
    return { calculated: false, calculator: 'calcRentalIncome', missingInputs: [], invalidInputs: ['amount'], warnings: ['임대수입·보증금·주택 수는 0 이상의 유한한 숫자여야 합니다.'] };
  }
  if (necessaryExpense !== null && (!Number.isFinite(Number(necessaryExpense)) || Number(necessaryExpense) < 0 || Number(necessaryExpense) > 1)) {
    return { calculated: false, calculator: 'calcRentalIncome', missingInputs: [], invalidInputs: ['necessaryExpense'], warnings: ['필요경비율은 0~1 범위여야 합니다.'] };
  }

  // 1. 간주임대료 (보증금 3억 초과분 × 60% × 정기예금이자율 − 보증금 운용수익)
  //    소득세법 §25, 시행령 §53, 시행규칙 §23 — 기획재정부 매년 고시
  //    ※ 주택 간주임대료는 부부합산 3주택 이상 보유 + 보증금 합계 3억 초과 시에만 과세
  //    2024~2025년 귀속: 3.5%  /  2026년 귀속~: 3.1% (2026.1 시행규칙 개정)
  const deemedRentRate = 0.031;
  const normalizedHouseCount = Math.max(0, Number(numHouses) || 0);
  const normalizedHighValueCount = Math.max(0, Number(highValueHouseCount) || 0);
  const twoHighValueHouseRule = Number(taxYear) >= 2026
    && normalizedHouseCount === 2
    && normalizedHighValueCount >= 2;
  const deemedRentEligible = normalizedHouseCount >= 3 || twoHighValueHouseRule;
  const depositThreshold = twoHighValueHouseRule ? 1200000000 : 300000000;
  const excessDeposit = Math.max(0, Number(deposit) - depositThreshold);
  const deemedRentGross = deemedRentEligible ? excessDeposit * 0.6 * deemedRentRate : 0;
  const deemedRent = Math.max(0, deemedRentGross - Math.max(0, Number(deemedRentFinancialIncome) || 0));

  // 1주택은 국외주택 또는 기준시가 12억원 초과 주택의 월세만 과세한다.
  const oneHouseTaxable = typeof oneHouseTaxableConfirmed === 'boolean'
    ? oneHouseTaxableConfirmed
    : (isOverseasSingleHouse === true || normalizedHighValueCount >= 1);
  if (normalizedHouseCount === 1 && Number(annualRent) > 0 && !oneHouseTaxable) {
    return {
      calculated: true,
      totalRevenue: 0,
      deemedRent: 0,
      isRegistered,
      canSeparate: false,
      betterMethod: '비과세',
      recommendedTax: 0,
      effectiveRate: 0,
      oneHouseTaxable: false,
      taxableStatusConfirmed: typeof oneHouseTaxableConfirmed === 'boolean'
        || isOverseasSingleHouse === true
        || normalizedHighValueCount >= 1,
      warnings: typeof oneHouseTaxableConfirmed === 'boolean'
        ? []
        : ['1주택의 국내 기준시가 12억원 이하 주택으로 보아 월세소득을 비과세 처리했습니다. 고가주택 또는 국외주택이면 관련 입력을 확인해야 합니다.'],
      summary: '1주택 월세소득 비과세 요건 적용',
    };
  }

  // 2. 총수입금액
  const totalRevenue = Math.max(0, Number(annualRent) || 0) + deemedRent;

  // === 분리과세 (연 2천만원 이하 주택임대 선택 가능, 소득세법 §64조의2) ===
  //   미등록 임대주택: 필요경비율 50%, 기본공제 200만
  //   등록 임대주택:   필요경비율 60%, 기본공제 400만 (지자체+세무서 등록 + 임대료 증가율 5% 이하)
  //   기본공제 조건: 분리과세 주택임대소득 제외 종합소득금액이 2천만 이하인 경우만
  const separateExpenseRate = isRegistered ? 0.60 : 0.50;
  const separateDeduction   = (otherIncome <= 20000000)
    ? (isRegistered ? 4000000 : 2000000)
    : 0;
  const separateBase = Math.max(0,
    totalRevenue * (1 - separateExpenseRate) - separateDeduction
  );
  const separateTax = separateBase * 0.14; // 분리과세 세율 14%
  const separateLocal = separateTax * 0.1;
  const separateTotal = separateTax + separateLocal;

  // === 종합과세 ===
  const compExpenseRate = necessaryExpense !== null ? necessaryExpense : 0.40;
  const compExpense     = totalRevenue * compExpenseRate;
  const rentalIncome    = Math.max(0, totalRevenue - compExpense);
  const combinedIncome  = rentalIncome + otherIncome;
  const compTaxBase     = Math.max(0, combinedIncome - basicDeduction); // 종합과세 시 인적공제
  const compTax         = _incomeTax(compTaxBase);
  // 임대소득으로 인해 증가한 세액을 차액 방식으로 계산한다(누진세율 비율안분 왜곡 방지).
  const otherTaxBase    = Math.max(0, otherIncome - basicDeduction);
  const taxWithoutRental = _incomeTax(otherTaxBase);
  const rentalTax       = Math.max(0, compTax - taxWithoutRental);
  const compLocal       = rentalTax * 0.1;
  const compTotal       = rentalTax + compLocal;

  // 주택 수와 무관하게 주택임대 총수입금액 합계가 2천만원 이하이면 선택적 분리과세 가능.
  const canSeparate     = totalRevenue <= 20000000;
  const betterMethod    = canSeparate
    ? (separateTotal <= compTotal ? "분리과세" : "종합과세")
    : "종합과세(의무)";
  const recommendedTax  = canSeparate && separateTotal <= compTotal
    ? separateTotal : compTotal;

  return {
    totalRevenue:        Math.round(totalRevenue),
    deemedRent:          Math.round(deemedRent),
    deemedRentEligible,
    deemedRentDepositThreshold: depositThreshold,
    twoHighValueHouseRule,
    highValueHouseCount: normalizedHighValueCount,
    isRegistered,
    // 분리과세
    separateExpenseRate,
    separateDeduction,
    separateTaxBase:     Math.round(separateBase),
    separateTax:         Math.round(separateTax),
    separateLocal:       Math.round(separateLocal),
    separateTotal:       Math.round(separateTotal),
    // 종합과세
    compExpense:         Math.round(compExpense),
    rentalIncome:        Math.round(rentalIncome),
    compTaxBase:         Math.round(compTaxBase),
    compTax:             Math.round(compTax),
    compLocal:           Math.round(compLocal),
    compTotal:           Math.round(compTotal),
    // 추천
    canSeparate,
    betterMethod,
    recommendedTax:      Math.round(recommendedTax),
    effectiveRate:       totalRevenue > 0
      ? Math.round((recommendedTax / totalRevenue) * 1000) / 10 : 0,
    summary: `연 임대수입 ${Math.round(totalRevenue).toLocaleString()}원 → ${betterMethod} 선택 시 세부담 ${Math.round(recommendedTax).toLocaleString()}원 (실효세율 ${totalRevenue > 0 ? ((recommendedTax / totalRevenue) * 100).toFixed(1) : 0}%)`,
  };
}

// ═══════════════════════════════════════════════════════════
// 2. 금융소득 종합과세 계산기
//    (소득세법 제14조, 제17조, 제62조)
// ═══════════════════════════════════════════════════════════

/**
 * 금융소득 종합과세 계산
 * @param {Object} params
 * @param {number} params.interestIncome    - 이자소득 합계 (원)
 * @param {number} params.dividendIncome    - 배당소득 합계 (원)
 * @param {number} params.otherIncome       - 다른 종합소득 (원)
 * @param {number} params.personalDeduction - 기본공제 등 (원, 기본 1,500,000)
 * @returns {Object}
 */
function calcFinancialIncome(params) {
  const {
    interestIncome    = 0,
    dividendIncome    = 0,
    otherIncome       = 0,
    personalDeduction = 1500000,
    confirmedFinancialWithholdingTax,
    confirmedOtherIncomePrepaidTax = 0,
  } = params || {};

  const financialValues = [interestIncome, dividendIncome, otherIncome, personalDeduction];
  if (!financialValues.every(value => Number.isFinite(Number(value))) || financialValues.some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'calcFinancialIncome', missingInputs: [], invalidInputs: ['amount'], warnings: ['금융소득·기타소득·공제액은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  const totalFinancial = Number(interestIncome) + Number(dividendIncome);
  const threshold      = 20000000; // 2천만원 기준

  // 2천만원 이하 — 원천징수(14%)로 종결
  if (totalFinancial <= threshold) {
    const withholding      = totalFinancial * 0.154; // 14% + 지방소득세 1.4%
    return {
      totalFinancial:   Math.round(totalFinancial),
      isSubjectToGlobal: false,
      withholding:      Math.round(withholding),
      excessAmount:     0,
      additionalTax:    0,
      totalTax:         Math.round(withholding),
      effectiveRate:    15.4,
      summary: `금융소득 ${Math.round(totalFinancial).toLocaleString()}원으로 종합과세 기준(2천만원) 이하 → 원천징수(15.4%) 종결, 세부담 ${Math.round(withholding).toLocaleString()}원`,
    };
  }

  // 2천만원 초과 — 소득세법 제62조 비교산출세액
  const excessAmount = totalFinancial - threshold;
  const otherTaxBase = Math.max(0, otherIncome - personalDeduction);
  const otherIncomeNationalTax = _incomeTax(otherTaxBase);

  // 제62조 제1호: (금융소득 초과분 + 다른 종합소득)의 누진세 + 기준금액 2천만원×14%
  const method1TaxBase = Math.max(0, excessAmount + otherIncome - personalDeduction);
  const method1NationalTax = _incomeTax(method1TaxBase) + threshold * 0.14;

  // 제62조 제2호: 금융소득 원천징수세율 세액 + 다른 종합소득의 산출세액
  // 배당가산·배당세액공제 대상은 별도 상세자료가 필요하므로 본 함수는 일반 국내 금융소득 기준이다.
  const method2NationalTax = totalFinancial * 0.14 + otherIncomeNationalTax;

  const finalNationalTax = Math.max(method1NationalTax, method2NationalTax);
  const localTax = finalNationalTax * 0.1;
  const finalTax = finalNationalTax + localTax;

  const financialWithholding = Number.isFinite(Number(confirmedFinancialWithholdingTax))
    ? Math.max(0, Number(confirmedFinancialWithholdingTax))
    : totalFinancial * 0.154;
  const otherIncomePrepaidTax = Math.max(0, Number(confirmedOtherIncomePrepaidTax) || 0);
  const otherIncomeTaxIncludingLocal = otherIncomeNationalTax * 1.1;
  const financialAttributableTax = Math.max(0, finalTax - otherIncomeTaxIncludingLocal);
  const additionalTax = Math.max(0, financialAttributableTax - financialWithholding);
  const totalAdditionalTax = Math.max(0, finalTax - financialWithholding - otherIncomePrepaidTax);

  return {
    totalFinancial:    Math.round(totalFinancial),
    isSubjectToGlobal: true,
    excessAmount:      Math.round(excessAmount),
    taxBase:           Math.round(method1TaxBase),
    globalTax:         Math.round(method1NationalTax),
    globalTotal:       Math.round(method1NationalTax * 1.1),
    compareTax:        Math.round(method1NationalTax * 1.1),
    withholdingComparisonTax: Math.round(method2NationalTax * 1.1),
    finalNationalTax:  Math.round(finalNationalTax),
    localTax:          Math.round(localTax),
    finalTax:          Math.round(finalTax),
    alreadyPaid:       Math.round(financialWithholding),
    otherIncomePrepaidTax: Math.round(otherIncomePrepaidTax),
    financialAttributableTax: Math.round(financialAttributableTax),
    additionalTax:     Math.round(additionalTax),
    totalAdditionalTax: Math.round(totalAdditionalTax),
    estimateOnly: dividendIncome > 0,
    warnings: dividendIncome > 0
      ? ['배당가산·배당세액공제 대상 배당 여부가 구분되지 않아 일반 금융소득 기준으로 계산했습니다.']
      : [],
    effectiveRate:     totalFinancial > 0
      ? Math.round((financialAttributableTax / totalFinancial) * 1000) / 10 : 0,
    summary: `금융소득 ${Math.round(totalFinancial).toLocaleString()}원 (2천만원 초과 ${Math.round(excessAmount).toLocaleString()}원) → 금융소득 귀속 추가세액 ${Math.round(additionalTax).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. 근로소득·연말정산 계산기
//    (소득세법 제20조, 제47조, 제52조, 제59조의4)
// ═══════════════════════════════════════════════════════════

/**
 * 근로소득 연말정산 세액 계산
 * @param {Object} params
 * @param {number} params.grossSalary       - 총급여 (원)
 * @param {number} params.dependents        - 부양가족 수 (본인 포함)
 * @param {number} params.childrenUnder7    - 7세 미만 자녀 수
 * @param {number} params.childrenOver7     - 7세 이상 자녀 수
 * @param {number} params.insurancePremium  - 보험료 납입액 (원)
 * @param {number} params.medicalExpense    - 의료비 지출액 (원)
 * @param {number} params.educationExpense  - 교육비 지출액 (원)
 * @param {number} params.donationExpense   - 기부금 (원)
 * @param {number} params.pensionSaving     - 연금저축 납입액 (원)
 * @param {number} params.irpAmount         - IRP 납입액 (원)
 * @param {number} params.housingFund       - 주택청약저축 납입액 (원)
 * @param {number} params.withheld          - 기납부세액 원천징수 (원, 0이면 자동계산)
 * @returns {Object}
 */
function calcEarnedIncome(params) {
  const {
    grossSalary      = 0,
    dependents       = 1,
    childrenUnder7   = 0,
    childrenOver7    = 0, // 기존 호환 입력: 2025년까지는 8세 이상 수로 사용
    eligibleChildrenCount,
    childBirthYears,
    legacyChildrenCountConfirmed = false,
    insurancePremium = 0,
    medicalExpense   = 0,
    educationExpense = 0,
    donationExpense  = 0,
    pensionSaving    = 0,
    irpAmount        = 0,
    housingFund      = 0,
    withheld,
    taxYear          = 2026,
    confirmedNationalPensionDeduction,
    confirmedHealthInsuranceDeduction = 0,
    confirmedEmploymentInsuranceDeduction = 0,
    confirmedHousingFundDeduction,
  } = params || {};

  const earnedValues = [grossSalary, dependents, childrenUnder7, childrenOver7, insurancePremium, medicalExpense, educationExpense, donationExpense, pensionSaving, irpAmount, housingFund];
  if (!earnedValues.every(value => Number.isFinite(Number(value))) || earnedValues.some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'calcEarnedIncome', missingInputs: [], invalidInputs: ['amount'], warnings: ['급여·인원·지출액은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  // 1. 근로소득공제 (소득세법 제47조)
  let earnedDeduction = 0;
  if (grossSalary <= 5000000)         earnedDeduction = grossSalary * 0.70;
  else if (grossSalary <= 15000000)   earnedDeduction = 3500000 + (grossSalary - 5000000) * 0.40;
  else if (grossSalary <= 45000000)   earnedDeduction = 7500000 + (grossSalary - 15000000) * 0.15;
  else if (grossSalary <= 100000000)  earnedDeduction = 12000000 + (grossSalary - 45000000) * 0.05;
  else                                earnedDeduction = 14750000 + (grossSalary - 100000000) * 0.02;
  earnedDeduction = Math.min(earnedDeduction, 20000000); // 한도 2천만원

  // 2. 근로소득금액
  const earnedIncome = grossSalary - earnedDeduction;

  // 3. 인적공제 (소득공제)
  const basicDeduction   = dependents * 1500000;
  // ※ 자녀 관련 공제는 소득공제가 아닌 세액공제로 처리 (아래 7. 세액공제 참조)
  //   childrenOver7 → childTaxCredit, childrenUnder7 → infantTaxCredit

  // 4. 보험료·주택자금 소득공제
  // 2026년 국민연금 기준소득월액 상한은 1~6월 637만원, 7~12월 659만원을 적용한다.
  // 실제 연말정산에서는 확인된 납부액을 우선 사용하고, 없을 때만 총급여 기준 추정액을 사용한다.
  const estimatedNationalPension = _estimatedAnnualNpsEmployeeContribution(grossSalary, taxYear);
  const nationalPension = Number.isFinite(Number(confirmedNationalPensionDeduction))
    ? Math.max(0, Number(confirmedNationalPensionDeduction))
    : estimatedNationalPension;
  const healthInsuranceDeduction = Math.max(0, Number(confirmedHealthInsuranceDeduction) || 0);
  const employmentInsuranceDeduction = Math.max(0, Number(confirmedEmploymentInsuranceDeduction) || 0);
  const housingFundDeduction = Number.isFinite(Number(confirmedHousingFundDeduction))
    ? Math.max(0, Number(confirmedHousingFundDeduction))
    : Math.min(housingFund * 0.4, 3000000);

  // 5. 소득공제 합계
  const totalDeduction = basicDeduction + nationalPension + healthInsuranceDeduction
    + employmentInsuranceDeduction + housingFundDeduction;
  const taxBase          = Math.max(0, earnedIncome - totalDeduction);

  // 6. 산출세액
  const calculatedTax    = _incomeTax(taxBase);

  // 7. 세액공제
  // 근로소득 세액공제 (소득세법 §59 ①, 2023.1.1 이후 300만 초과 공제율 30% 통일)
  let earnedTaxCredit    = 0;
  if (calculatedTax <= 1300000)       earnedTaxCredit = calculatedTax * 0.55;
  else if (calculatedTax <= 3000000)  earnedTaxCredit = 715000 + (calculatedTax - 1300000) * 0.30;
  else                                earnedTaxCredit = 1225000 + (calculatedTax - 3000000) * 0.30;  // 0.20 → 0.30
  // 총급여 구간별 한도 (소득세법 §59 ②)
  //   3,300만 이하:        74만
  //   3,300만~7,000만:     74만 - (총급여 - 3,300만) × 0.008, 최저 66만
  //   7,000만~1억2,000만:   점감하나 최저 50만 (가파른 감소로 사실상 50만 적용)
  //   1억2,000만 초과:      50만에서 점감, 최저 20만 (단순화로 50만 유지)
  if (grossSalary <= 33000000) {
    earnedTaxCredit = Math.min(earnedTaxCredit, 740000);
  } else if (grossSalary <= 70000000) {
    earnedTaxCredit = Math.min(earnedTaxCredit, Math.max(660000, 740000 - (grossSalary - 33000000) * 0.008));
  } else if (grossSalary <= 120000000) {
    earnedTaxCredit = Math.min(earnedTaxCredit, Math.max(500000, 660000 - (grossSalary - 70000000) * 0.5));
  } else {
    earnedTaxCredit = Math.min(earnedTaxCredit, Math.max(200000, 500000 - (grossSalary - 120000000) * 0.5));
  }

  // 자녀 세액공제 (소득세법 §59조의2)
  //   1명 25만 / 2명 55만 / 3명 이상 55만 + (n-2) × 40만
  //   2026년 법 개정 경과기준: 2026년 9세, 2027년 10세, 2028년 11세,
  //   2029년 12세, 2030년부터 13세 이상. 2017년 출생자는 경과기준 제외.
  const childThresholdByYear = Number(taxYear) <= 2025 ? 8
    : Number(taxYear) === 2026 ? 9
    : Number(taxYear) === 2027 ? 10
    : Number(taxYear) === 2028 ? 11
    : Number(taxYear) === 2029 ? 12 : 13;
  let eligibleChildCount = 0;
  let childCountBasis = 'notProvided';
  const childCreditWarnings = [];
  if (Number.isFinite(Number(eligibleChildrenCount))) {
    eligibleChildCount = Math.max(0, Math.floor(Number(eligibleChildrenCount)));
    childCountBasis = 'confirmedEligibleCount';
  } else if (Array.isArray(childBirthYears)) {
    eligibleChildCount = childBirthYears.map(Number).filter(Number.isFinite).filter(birthYear => {
      const ageAtYearEnd = Number(taxYear) - birthYear;
      const threshold = birthYear === 2017 && Number(taxYear) >= 2026 && Number(taxYear) <= 2029
        ? 13 : childThresholdByYear;
      return ageAtYearEnd >= threshold;
    }).length;
    childCountBasis = 'birthYears';
  } else if (Number(taxYear) <= 2025 || legacyChildrenCountConfirmed) {
    eligibleChildCount = Math.max(0, Math.floor(Number(childrenOver7) || 0));
    childCountBasis = 'legacyConfirmed';
  } else if (Number(childrenOver7) > 0) {
    childCreditWarnings.push(`2026년 이후 자녀공제 연령기준은 ${childThresholdByYear}세 이상이므로 childrenOver7만으로는 적격 인원을 확정할 수 없어 자녀세액공제를 0원으로 처리했습니다.`);
  }
  const childTaxCredit   = eligibleChildCount === 1 ? 250000
    : eligibleChildCount === 2 ? 550000
    : eligibleChildCount >= 3  ? 550000 + (eligibleChildCount - 2) * 400000 : 0;
  const infantTaxCredit  = 0;

  // 보험료 세액공제 (12%, 한도 100만원)
  const insurCredit      = Math.min(insurancePremium, 1000000) * 0.12;

  // 의료비 세액공제 (총급여 3% 초과분 × 15%)
  //   ※ 단순화: 일반 의료비 연 700만 한도 미반영(본인·65세이상·장애인·난임은 한도 없음) → 일반의료비 多인 경우 과대 가능
  const medThreshold     = grossSalary * 0.03;
  const medCredit        = Math.max(0, medicalExpense - medThreshold) * 0.15;

  // 교육비 세액공제 (15%)
  //   ※ 단순화: 1인당 한도(대학 900만·취학전/초중고 300만) 미반영 → 고액 교육비 시 과대 가능
  const eduCredit        = educationExpense * 0.15;

  // 기부금 세액공제 (15%, 1천만원 초과 30%)
  const donCredit        = donationExpense <= 10000000
    ? donationExpense * 0.15
    : 1500000 + (donationExpense - 10000000) * 0.30;

  // 연금저축·IRP 세액공제 (연금저축 600만 한도 + IRP 포함 통합 900만 한도)
  const effPensionSaving = Math.min(pensionSaving, 6000000);
  const effIRP           = Math.min(irpAmount, 9000000 - effPensionSaving);
  const pensionTotal     = effPensionSaving + effIRP;
  const pensionRate      = grossSalary <= 55000000 ? 0.15 : 0.12; // 종합소득 산출세액에서 공제하는 국세 공제율
  const pensionCredit    = pensionTotal * pensionRate;

  // 세액공제 합계
  const totalTaxCredit   = earnedTaxCredit + childTaxCredit + infantTaxCredit
    + insurCredit + medCredit + eduCredit + donCredit + pensionCredit;

  // 8. 결정세액
  const finalTax         = Math.max(0, calculatedTax - totalTaxCredit);
  const localTax         = finalTax * 0.1;
  const finalTotal       = finalTax + localTax;

  // 9. 환급/추납
  const withheldProvided = Number.isFinite(Number(withheld));
  const withheldAmt = withheldProvided ? Math.max(0, Number(withheld)) : finalTotal;
  const refundOrPay = withheldAmt - finalTotal;

  return {
    grossSalary:      Math.round(grossSalary),
    earnedDeduction:  Math.round(earnedDeduction),
    earnedIncome:     Math.round(earnedIncome),
    totalDeduction:   Math.round(totalDeduction),
    taxBase:          Math.round(taxBase),
    calculatedTax:    Math.round(calculatedTax),
    totalTaxCredit:   Math.round(totalTaxCredit),
    finalTax:         Math.round(finalTax),
    localTax:         Math.round(localTax),
    finalTotal:       Math.round(finalTotal),
    refundOrPay:      Math.round(refundOrPay),
    withheldProvided,
    withheldAmount:   Math.round(withheldAmt),
    effectiveRate:    grossSalary > 0
      ? Math.round((finalTotal / grossSalary) * 1000) / 10 : 0,
    taxYear,
    estimateOnly: !Number.isFinite(Number(confirmedNationalPensionDeduction))
      || medicalExpense > 0 || educationExpense > 0 || donationExpense > 0,
    warnings: [
      ...(!Number.isFinite(Number(confirmedNationalPensionDeduction))
        ? ['국민연금 공제액은 총급여 기준 추정치입니다. 실제 납부확인액 입력 시 그 값을 우선 적용합니다.'] : []),
      ...(medicalExpense > 0 ? ['의료비는 일반의료비 한도·난임·미숙아·본인·65세 이상 등 대상별 공제율과 한도가 구분되지 않은 추정치입니다.'] : []),
      ...(educationExpense > 0 ? ['교육비는 취학 전·초중고·대학 등 대상별 1인당 한도가 구분되지 않은 추정치입니다.'] : []),
      ...(donationExpense > 0 ? ['기부금은 유형별 공제한도와 이월공제를 구분하지 않은 추정치입니다.'] : []),
      ...childCreditWarnings,
    ],
    deductions: {
      nationalPension: Math.round(nationalPension),
      healthInsurance: Math.round(healthInsuranceDeduction),
      employmentInsurance: Math.round(employmentInsuranceDeduction),
      housingFund: Math.round(housingFundDeduction),
    },
    breakdown: {
      earnedTaxCredit:  Math.round(earnedTaxCredit),
      childTaxCredit:   Math.round(childTaxCredit),
      eligibleChildCount,
      childCountBasis,
      childAgeThreshold: childThresholdByYear,
      pensionCredit:    Math.round(pensionCredit),
      medCredit:        Math.round(medCredit),
      eduCredit:        Math.round(eduCredit),
      insurCredit:      Math.round(insurCredit),
    },
    summary: `총급여 ${Math.round(grossSalary).toLocaleString()}원 → 결정세액 ${Math.round(finalTotal).toLocaleString()}원 (실효세율 ${grossSalary > 0 ? ((finalTotal / grossSalary) * 100).toFixed(1) : 0}%)`,
  };
}

// ═══════════════════════════════════════════════════════════
// 4. 종합소득세 계산기
//    (소득세법 제70조, 제45조, 제160조)
// ═══════════════════════════════════════════════════════════

/**
 * 종합소득세 계산 (프리랜서·사업소득 포함)
 * @param {Object} params
 * @param {number} params.businessIncome    - 사업소득 (원)
 * @param {number} params.rentalIncome      - 부동산임대소득 (원)
 * @param {number} params.earnedIncome      - 근로소득 (원, 근무소득공제 후)
 * @param {number} params.pensionIncome     - 연금소득 (원)
 * @param {number} params.otherIncome       - 기타소득 (원)
 * @param {number} params.businessExpense   - 사업소득 필요경비 (원)
 * @param {number} params.dependents        - 부양가족 수 (본인 포함)
 * @param {number} params.pensionSaving     - 연금저축 납입액 (원)
 * @param {number} params.irpAmount         - IRP 납입액 (원)
 * @param {number} params.isSimpleBookkeeping - 간편장부 여부
 * @returns {Object}
 */
function calcGlobalIncome(params) {
  const {
    businessIncome      = 0,
    rentalIncome        = 0,
    earnedIncome        = 0,
    pensionIncome       = 0,
    otherIncome         = 0,
    businessExpense     = 0,
    dependents          = 1,
    pensionSaving       = 0,
    irpAmount           = 0,
    isSimpleBookkeeping = false,
    taxYear             = 2026,
    confirmedNationalPensionDeduction,
    confirmedStandardTaxCredit,
  } = params || {};

  const globalValues = [businessIncome, rentalIncome, earnedIncome, pensionIncome, otherIncome, businessExpense, dependents, pensionSaving, irpAmount];
  if (!globalValues.every(value => Number.isFinite(Number(value))) || globalValues.some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'calcGlobalIncome', missingInputs: [], invalidInputs: ['amount'], warnings: ['소득·경비·공제 입력은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  // 1. 소득금액 계산
  const netBusiness  = Math.max(0, businessIncome - businessExpense);
  const totalIncome  = netBusiness + rentalIncome + earnedIncome + pensionIncome + otherIncome;

  // 2. 소득공제
  const basicDeduct  = dependents * 1500000;
  // 연금계좌 세액공제 대상: 연금저축 600만 한도 + IRP 포함 통합 900만 한도
  const effPensionSaving = Math.min(pensionSaving, 6000000);
  const effIRP           = Math.min(irpAmount, 9000000 - effPensionSaving);
  const pensionTotal = effPensionSaving + effIRP;

  // 국민연금 보험료 공제: 확인된 실제 납부액을 우선 사용하고, 없을 때만 소득 기준으로 추정한다.
  const nationalPensionConfirmed = Number.isFinite(Number(confirmedNationalPensionDeduction));
  const nationalPension = nationalPensionConfirmed
    ? Math.max(0, Number(confirmedNationalPensionDeduction))
    : 0;

  const totalDeduct  = basicDeduct + nationalPension;
  const taxBase      = Math.max(0, totalIncome - totalDeduct);

  // 3. 산출세액
  const calculatedTax = _incomeTax(taxBase);

  // 4. 세액공제
  // 연금계좌 세액공제: 종합소득금액 4,500만(총급여 5,500만) 이하 16.5%, 초과 13.2% (지방세 포함)
  const pensionRate   = totalIncome <= 45000000 ? 0.15 : 0.12;
  const pensionCredit = pensionTotal * pensionRate;

  // 사업소득자의 일반 표준세액공제는 7만원을 기본으로 하되,
  // 다른 특별세액공제와의 선택·배제 관계가 확인된 경우에는 확인액을 직접 사용한다.
  const standardCreditConfirmed = Number.isFinite(Number(confirmedStandardTaxCredit));
  const stdCredit = standardCreditConfirmed
    ? Math.max(0, Number(confirmedStandardTaxCredit))
    : 70000;

  const totalCredit   = pensionCredit + stdCredit;
  const finalTax      = Math.max(0, calculatedTax - totalCredit);
  const localTax      = finalTax * 0.1;
  const finalTotal    = finalTax + localTax;

  // 5. 중간예납 추정 (전년도 세액 50%)
  const midYearEst    = finalTotal * 0.5;

  return {
    netBusiness:      Math.round(netBusiness),
    totalIncome:      Math.round(totalIncome),
    totalDeduct:      Math.round(totalDeduct),
    taxBase:          Math.round(taxBase),
    calculatedTax:    Math.round(calculatedTax),
    pensionCredit:    Math.round(pensionCredit),
    totalCredit:      Math.round(totalCredit),
    finalTax:         Math.round(finalTax),
    localTax:         Math.round(localTax),
    finalTotal:       Math.round(finalTotal),
    midYearEst:       Math.round(midYearEst),
    taxYear,
    nationalPension: Math.round(nationalPension),
    estimateOnly: true,
    warnings: [
      ...(!nationalPensionConfirmed ? ['종합소득자의 국민연금 공제액은 실제 납부확인액이 없어 0원으로 두었습니다. 확인액 입력 시 반영됩니다.'] : []),
      ...(!standardCreditConfirmed ? ['표준세액공제는 일반 사업소득자 기준 7만원을 적용했습니다. 특별세액공제와의 선택관계가 다르면 확인액을 입력해야 합니다.'] : []),
      '연금·기타소득의 소득금액 계산, 결손금·이월공제 및 세액감면은 단순화된 추정입니다.',
    ],
    effectiveRate:    totalIncome > 0
      ? Math.round((finalTotal / totalIncome) * 1000) / 10 : 0,
    summary: `종합소득 ${Math.round(totalIncome).toLocaleString()}원 → 최종세액 ${Math.round(finalTotal).toLocaleString()}원 (실효세율 ${totalIncome > 0 ? ((finalTotal / totalIncome) * 100).toFixed(1) : 0}%)`,
  };
}

// ═══════════════════════════════════════════════════════════
// 5. ISA·절세상품 수익 계산기
//    (조세특례제한법 제91조의18)
// ═══════════════════════════════════════════════════════════

/**
 * ISA 절세 효과 계산
 * @param {Object} params
 * @param {number} params.annualDeposit     - 연간 납입액 (원, 한도 2천만원)
 * @param {number} params.years             - 납입 기간 (년, 최소 3년)
 * @param {number} params.annualReturn      - 예상 연수익률 (0~1)
 * @param {string} params.accountType       - 계좌 유형: 'general'|'preferential'|'youth'
 *                                            일반형|서민형|청년형
 * @param {number} params.taxRate           - 적용 세율 (0~1, 기본 0.154)
 * @returns {Object}
 */
function calcISASavings(params) {
  const {
    annualDeposit = 10000000,
    years         = 5,
    annualReturn  = 0.04,
    accountType   = 'general',
    taxRate       = 0.154,
  } = params || {};

  if (![annualDeposit, years, annualReturn, taxRate].every(Number.isFinite)
      || annualDeposit < 0 || years < 0 || annualReturn <= -1 || taxRate < 0 || taxRate > 1) {
    return { calculated: false, calculator: 'calcISASavings', missingInputs: [], invalidInputs: ['input'], warnings: ['납입액·기간·수익률·세율의 입력 범위를 확인해 주세요.'] };
  }

  const annualLimit = 20000000;
  const totalLimit = 100000000;
  const cappedDeposit = Math.min(annualDeposit, annualLimit);
  const wholeYears = Math.max(0, Math.floor(years));
  const contributionSchedule = [];
  let remainingLimit = totalLimit;
  for (let i = 0; i < wholeYears; i++) {
    const contribution = Math.min(cappedDeposit, remainingLimit);
    contributionSchedule.push(contribution);
    remainingLimit -= contribution;
  }
  const totalDeposit = contributionSchedule.reduce((sum, value) => sum + value, 0);

  const exemptLimit = accountType === 'preferential' || accountType === 'youth' ? 4000000 : 2000000;

  let isaFV = 0;
  for (const contribution of contributionSchedule) isaFV = (isaFV + contribution) * (1 + annualReturn);
  const isaProfit = isaFV - totalDeposit;
  const taxableProfit = Math.max(0, isaProfit - exemptLimit);
  const isaTax = taxableProfit * 0.099;

  let generalFV = 0;
  const afterTaxReturn = annualReturn * (1 - taxRate);
  for (const contribution of contributionSchedule) generalFV = (generalFV + contribution) * (1 + afterTaxReturn);
  const generalProfit = generalFV - totalDeposit;
  const generalNetProfit = generalProfit;
  const generalTax = Math.max(0, isaProfit - generalProfit);
  const isaNetProfit = isaProfit - isaTax;
  const taxSaving = Math.max(0, isaNetProfit - generalNetProfit);
  const warnings = [];
  if (years < 3) warnings.push('ISA 세제혜택은 원칙적으로 계약기간 3년 이상 요건을 충족해야 하므로 현재 입력은 세제혜택 확정값이 아닙니다.');
  if (wholeYears * cappedDeposit > totalLimit) warnings.push('총납입한도 1억원을 적용해 이후 연도 납입액을 0원으로 제한했습니다.');
  warnings.push('일반계좌 비교는 수익이 매년 동일하게 발생하고 즉시 과세된다는 단순화 가정입니다.');

  return {
    totalDeposit: Math.round(totalDeposit),
    annualDepositApplied: Math.round(cappedDeposit),
    annualLimit,
    totalLimit,
    contributionSchedule: contributionSchedule.map(Math.round),
    isaFV: Math.round(isaFV),
    isaProfit: Math.round(isaProfit),
    exemptLimit,
    taxableProfit: Math.round(taxableProfit),
    isaTax: Math.round(isaTax),
    isaNetProfit: Math.round(isaNetProfit),
    generalFV: Math.round(generalFV),
    generalProfit: Math.round(generalProfit),
    generalNetProfit: Math.round(generalNetProfit),
    generalTax: Math.round(generalTax),
    taxSaving: Math.round(taxSaving),
    accountType,
    eligibilityConfirmed: years >= 3,
    estimateOnly: true,
    warnings,
    effectiveRate: isaProfit > 0 ? Math.round((isaTax / isaProfit) * 1000) / 10 : 0,
    summary: `${wholeYears}년간 ${Math.round(totalDeposit).toLocaleString()}원 납입 → ISA 절세효과 추정 ${Math.round(taxSaving).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 6. 주담대 이자공제 계산기
//    (소득세법 제52조, 시행령 제112조)
// ═══════════════════════════════════════════════════════════

/**
 * 장기주택저당차입금 이자상환액 소득공제 계산
 * @param {Object} params
 * @param {number} params.annualInterest    - 연간 이자 납부액 (원)
 * @param {number} params.loanType          - 대출 유형: 15년이상고정=1, 15년이상비거치=2, 10~15년=3
 * @param {number} params.grossSalary       - 총급여 (원, 세액 절감 계산용)
 * @param {number} params.acquisitionPrice  - 취득 당시 기준시가 (원)
 * @returns {Object}
 */
function calcMortgageDeduction(params) {
  const {
    annualInterest = 0,
    loanType = 1,
    grossSalary = 0,
    acquisitionPrice = 0,
    termYears,
    fixedRate,
    nonGraceAmortization,
    allRequirementsMet,
    confirmedDeductionLimit,
    confirmedMarginalRate,
  } = params || {};

  if (![annualInterest, grossSalary, acquisitionPrice].every(value => Number.isFinite(Number(value)))
      || Number(annualInterest) < 0 || Number(grossSalary) < 0 || Number(acquisitionPrice) < 0) {
    return { calculated: false, calculator: 'calcMortgageDeduction', missingInputs: [], invalidInputs: ['amount'], warnings: ['이자·급여·취득가액은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  let limit;
  if (Number.isFinite(Number(confirmedDeductionLimit))) {
    limit = Math.max(0, Number(confirmedDeductionLimit));
  } else if (Number.isFinite(Number(termYears))) {
    const years = Number(termYears);
    const fixed = fixedRate === true;
    const amort = nonGraceAmortization === true;
    if (years >= 15) limit = fixed && amort ? 20000000 : (fixed || amort ? 18000000 : 8000000);
    else if (years >= 10 && (fixed || amort)) limit = 6000000;
    else limit = 0;
  } else {
    // 기존 숫자형 인터페이스 보존: 1=15년 이상 고정, 2=15년 이상 비거치,
    // 3=10년 이상 고정/비거치, 4=15년 이상 고정+비거치, 5=15년 이상 기타.
    const deductionLimits = { 1: 18000000, 2: 18000000, 3: 6000000, 4: 20000000, 5: 8000000 };
    limit = deductionLimits[loanType] || 0;
  }

  const eligibilityConfirmed = typeof allRequirementsMet === 'boolean';
  const meetsRequirement = eligibilityConfirmed
    ? allRequirementsMet
    : (acquisitionPrice > 0 ? acquisitionPrice <= 600000000 : true);
  const deductionAmount = meetsRequirement ? Math.min(Math.max(0, annualInterest), limit) : 0;

  let marginalRate;
  if (Number.isFinite(Number(confirmedMarginalRate))) {
    marginalRate = Math.max(0, Number(confirmedMarginalRate));
    if (marginalRate > 1) marginalRate /= 100;
  } else if (grossSalary > 1000000000) marginalRate = 0.45;
  else if (grossSalary > 500000000) marginalRate = 0.42;
  else if (grossSalary > 300000000) marginalRate = 0.40;
  else if (grossSalary > 150000000) marginalRate = 0.38;
  else if (grossSalary > 88000000) marginalRate = 0.35;
  else if (grossSalary > 50000000) marginalRate = 0.24;
  else if (grossSalary > 14000000) marginalRate = 0.15;
  else marginalRate = 0.06;

  const taxSaving = deductionAmount * marginalRate * 1.1;
  const effectiveInterest = Math.max(0, annualInterest - taxSaving);
  const warnings = [];
  if (!eligibilityConfirmed) warnings.push('취득가액·세대주·주택 수·차입시기 등 공제요건이 확인되지 않아 한도 시뮬레이션으로만 사용해야 합니다.');
  if (!Number.isFinite(Number(confirmedMarginalRate))) warnings.push('절세액은 총급여 구간을 이용한 추정 한계세율입니다.');

  return {
    annualInterest: Math.round(annualInterest),
    limit: Math.round(limit),
    deductionAmount: Math.round(deductionAmount),
    meetsRequirement,
    eligibilityConfirmed,
    marginalRate: marginalRate * 100,
    taxSaving: Math.round(taxSaving),
    effectiveInterest: Math.round(effectiveInterest),
    estimateOnly: !eligibilityConfirmed || !Number.isFinite(Number(confirmedMarginalRate)),
    warnings,
    summary: `연 이자 ${Math.round(annualInterest).toLocaleString()}원 중 ${Math.round(deductionAmount).toLocaleString()}원 공제 → 절세액 ${Math.round(taxSaving).toLocaleString()}원, 실질이자 ${Math.round(effectiveInterest).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 7. 창업·중소기업 세액감면 계산기
//    (조세특례제한법 제6조, 제30조)
// ═══════════════════════════════════════════════════════════

/**
 * 창업중소기업 세액감면 계산
 * @param {Object} params
 * @param {number} params.annualIncomeTax   - 연간 소득세 또는 법인세 (원)
 * @param {string} params.founder           - 창업자 유형: 'youth'|'general' (청년|일반)
 * @param {string} params.region            - 지역: 'capital'|'other' (수도권|비수도권)
 * @param {string} params.industry          - 업종: 'excluded'|'included' (감면제외|감면대상)
 * @param {number} params.foundYear         - 창업 연도 (4자리 숫자)
 * @param {number} params.currentYear       - 현재 연도
 * @returns {Object}
 */
function calcStartupTaxCredit(params) {
  const {
    annualIncomeTax = 0,
    founder = 'general',
    region = 'other',
    industry = 'included',
    foundYear = new Date().getFullYear(),
    firstIncomeYear,
    currentYear = new Date().getFullYear(),
  } = params || {};

  if (![annualIncomeTax, foundYear, currentYear].every(value => Number.isFinite(Number(value))) || Number(annualIncomeTax) < 0) {
    return { calculated: false, calculator: 'calcStartupTaxCredit', missingInputs: [], invalidInputs: ['input'], warnings: ['세액과 연도 입력을 확인해 주세요.'] };
  }

  const benefitStartYear = Number.isFinite(Number(firstIncomeYear)) ? Number(firstIncomeYear) : Number(foundYear);
  const yearsInBusiness = Number(currentYear) - benefitStartYear + 1;
  const isWithin5Years = yearsInBusiness >= 1 && yearsInBusiness <= 5;
  const warnings = [];
  if (!Number.isFinite(Number(firstIncomeYear))) warnings.push('감면기간은 최초 소득 발생연도 미입력으로 창업연도를 기준으로 추정했습니다.');

  const normalizedRegion = String(region || '').toLowerCase();
  let regionType;
  if (['other','outsidecapital','noncapital','populationdecline','비수도권','인구감소지역'].includes(normalizedRegion)) regionType = 'outside';
  else if (['capital_general','capitalnonoverconcentration','수도권일반'].includes(normalizedRegion)) regionType = 'capitalGeneral';
  else if (['overconcentration','capital_overconcentration','과밀억제권역'].includes(normalizedRegion)) regionType = 'overconcentration';
  else if (normalizedRegion === 'capital') regionType = Number(foundYear) >= 2026 ? 'ambiguousCapital' : 'overconcentration';
  else regionType = 'outside';

  let exemptionRate = 0;
  let requiresRegionDetail = false;
  if (industry !== 'excluded' && isWithin5Years) {
    if (Number(foundYear) <= 2025) {
      exemptionRate = founder === 'youth'
        ? (regionType === 'outside' ? 1.00 : 0.50)
        : (regionType === 'outside' ? 0.50 : 0.00);
    } else if (regionType === 'ambiguousCapital') {
      requiresRegionDetail = true;
      warnings.push('2026년 이후 수도권 창업은 수도권 일반지역과 과밀억제권역을 구분해야 감면율을 확정할 수 있습니다.');
    } else if (founder === 'youth') {
      exemptionRate = regionType === 'outside' ? 1.00 : (regionType === 'capitalGeneral' ? 0.75 : 0.50);
    } else {
      exemptionRate = regionType === 'outside' ? 0.50 : (regionType === 'capitalGeneral' ? 0.25 : 0.00);
    }
  }

  const taxExemption = Math.round(annualIncomeTax * exemptionRate);
  const taxAfter = annualIncomeTax - taxExemption;
  const remainingYears = Math.max(0, 5 - yearsInBusiness + 1);
  const totalExemption = taxExemption * remainingYears;

  return {
    calculated: !requiresRegionDetail,
    yearsInBusiness,
    isWithin5Years,
    exemptionRate: exemptionRate * 100,
    annualIncomeTax: Math.round(annualIncomeTax),
    taxExemption,
    taxAfter: Math.round(taxAfter),
    remainingYears,
    totalExemption: Math.round(totalExemption),
    regionType,
    requiresRegionDetail,
    estimateOnly: !Number.isFinite(Number(firstIncomeYear)),
    warnings,
    summary: requiresRegionDetail
      ? '2026년 이후 수도권 지역 구분이 필요하여 감면액을 확정하지 않았습니다.'
      : `창업 ${yearsInBusiness}년차 → 감면율 ${exemptionRate * 100}%, 연간 감면액 ${Math.round(taxExemption).toLocaleString()}원, 잔여 감면기간 ${remainingYears}년`,
  };
}

// ═══════════════════════════════════════════════════════════
// 8. 사회보험료 계산기 (개인)
//    (국민건강보험법, 국민연금법, 고용보험법)
// ═══════════════════════════════════════════════════════════

/**
 * 개인 사회보험료 계산
 * @param {Object} params
 * @param {number} params.monthlySalary     - 월 보수월액 (원)
 * @param {string} params.employeeType      - 'employee'|'selfEmployed' (직장|지역)
 * @param {boolean} params.hasEmployer      - 사업주 부담분 포함 여부
 * @returns {Object}
 */
function calcSocialInsurancePersonal(params) {
  const {
    monthlySalary = 0,
    employeeType = 'employee',
    hasEmployer = false,
    includeEmployer,
    effectiveDate,
    effectivePeriod,
    industry = 'manufacturing',
  } = params || {};

  if (!Number.isFinite(Number(monthlySalary)) || Number(monthlySalary) < 0) {
    return { calculated: false, calculator: 'calcSocialInsurancePersonal', missingInputs: [], invalidInputs: ['monthlySalary'], warnings: ['월 보수는 0 이상의 유한한 숫자여야 합니다.'] };
  }

  const includeEmployerBurden = typeof includeEmployer === 'boolean' ? includeEmployer : hasEmployer;
  if (employeeType !== 'employee') {
    return {
      calculated: false,
      missingInputs: ['regionalInsuranceAssessmentData'],
      invalidInputs: [],
      warnings: ['지역가입자 보험료는 소득·재산 등 별도 부과자료가 필요하므로 직장가입자 방식으로 계산하지 않았습니다.'],
      employeeType,
    };
  }

  const annualSalary = monthlySalary * 12;
  const period = effectiveDate || effectivePeriod;
  const npCap = _npsMonthlyCap(period);
  const npBase = Math.min(Math.max(0, monthlySalary), npCap);
  const npEmployee = Math.round(npBase * 0.0475);
  const npEmployer = npEmployee;

  const hiEmployee = Math.round(monthlySalary * 0.03595);
  const hiEmployer = hiEmployee;
  const ltcEmployee = Math.round(hiEmployee * (0.9448 / 7.19));
  const ltcEmployer = ltcEmployee;
  const eiEmployee = Math.round(monthlySalary * 0.009);
  const eiEmployer = Math.round(monthlySalary * 0.009);

  const accidentRates = { general: 0.007, manufacturing: 0.014, construction: 0.036 };
  const accidentRate = accidentRates[industry] || accidentRates.manufacturing;
  const wcEmployer = Math.round(monthlySalary * accidentRate);

  const employeeTotal = npEmployee + hiEmployee + ltcEmployee + eiEmployee;
  const employerTotal = npEmployer + hiEmployer + ltcEmployer + eiEmployer + wcEmployer;
  const totalBurden = employeeTotal + (includeEmployerBurden ? employerTotal : 0);

  return {
    calculated: true,
    monthlySalary: Math.round(monthlySalary),
    annualSalary: Math.round(annualSalary),
    employeeType,
    effectivePeriod: _effectiveYyyymm(period),
    nationalPensionCap: npCap,
    employee: {
      nationalPension: npEmployee,
      healthInsurance: hiEmployee,
      longTermCare: ltcEmployee,
      employment: eiEmployee,
      total: employeeTotal,
      annual: employeeTotal * 12,
    },
    employer: {
      nationalPension: npEmployer,
      healthInsurance: hiEmployer,
      longTermCare: ltcEmployer,
      employment: eiEmployer,
      accident: wcEmployer,
      total: employerTotal,
      annual: employerTotal * 12,
    },
    totalBurden: Math.round(totalBurden),
    estimateOnly: true,
    warnings: ['건강보험 보수월액 상·하한, 고용·산재보험의 업종별 추가요율 등은 실제 사업장 자료에 따라 달라질 수 있습니다.'],
    summary: `월급 ${Math.round(monthlySalary).toLocaleString()}원 → 근로자 4대보험 월 ${Math.round(employeeTotal).toLocaleString()}원 (연 ${Math.round(employeeTotal * 12).toLocaleString()}원)`,
  };
}

// ═══════════════════════════════════════════════════════════
// exports
// ═══════════════════════════════════════════════════════════
module.exports = {
  calcRentalIncome,
  calcFinancialIncome,
  calcEarnedIncome,
  calcGlobalIncome,
  calcISASavings,
  calcMortgageDeduction,
  calcStartupTaxCredit,
  calcSocialInsurancePersonal,
};

},
"./tax-corporate": function(module, exports, require, __filename, __dirname) {
/**
 * JARVIA 기업 세금 계산기 모듈 (신규)
 * 용도: Cloud Functions에서 PPT 생성 파이프라인 내 계산 결과 제공
 *
 * 세율/공제 기준: 법인세는 연도 인자 기반(2026.1.1~ 전 구간 1%p 인상 반영). 그 외 2024~2025 현행 세법.
 * 모든 함수는 순수 함수 (DOM 의존성 없음, Node.js 환경 실행 가능)
 *
 * 포함 계산기:
 *  1. 법인 설립 손익분기   (calcCorpVsIndividual)
 *  2. 법인 청산세          (calcCorpLiquidation)
 *  3. 업무용 차량 비용     (calcVehicleExpense)
 *  4. 접대비 한도          (calcEntertainmentLimit)
 *  5. 고용세액공제          (calcEmploymentCredit)
 *  6. R&D 세액공제         (calcRnDCredit)
 *  7. 명의신탁 증여의제     (calcNomineeTrust)
 *  8. 사회보험료 (법인)     (calcSocialInsuranceCorp)
 *  9. 스톡옵션 세금        (calcStockOption)
 * 10. 해외자산 신고 기준   (calcOverseasAsset)
 * 11. 지주회사 절세효과    (calcHoldingCompany)
 * 12. 법인 합병 절세효과   (calcMergerTax)
 */

'use strict';

function _isProvidedFinite(value) {
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '') && Number.isFinite(Number(value));
}

// ═══════════════════════════════════════════════════════════
// 유틸: 법인세 누진세율 (법인세법 제55조)
//   ※ 법인세 기본세율은 중소기업 여부와 무관하게 동일 (중소기업 혜택은 조특법 감면으로 별도)
//   ※ 성실신고확인대상 소규모법인(corpType='sme_realty')은 2억 이하 구간 없이 200억 이하 단일세율(19→20%)
//   ※ 2026.1.1. 이후 개시 사업연도부터 전 구간 1%p 인상 (2025.12 개정)
// ═══════════════════════════════════════════════════════════
function _corpTax(taxBase, isSME = true, taxYear = new Date().getFullYear(), corpType = 'sme') {
  if (taxBase <= 0) return 0;
  const y2026 = Number(taxYear) >= 2026;
  // 성실신고확인대상 소규모법인(부동산임대 주업 등): 2억 이하 구간 없이 200억 이하 단일세율 (19→20%)
  if (corpType === 'sme_realty') {
    if (y2026) {
      if (taxBase <= 20000000000)  return taxBase * 0.20;
      if (taxBase <= 300000000000) return 4000000000 + (taxBase - 20000000000) * 0.22;
      return 65600000000 + (taxBase - 300000000000) * 0.25;
    }
    if (taxBase <= 20000000000)  return taxBase * 0.19;
    if (taxBase <= 300000000000) return 3800000000 + (taxBase - 20000000000) * 0.21;
    return 62600000000 + (taxBase - 300000000000) * 0.24;
  }
  if (y2026) {
    // 2026~: 2억 10% / 200억 20% / 3,000억 22% / 초과 25%
    if (taxBase <= 200000000)    return taxBase * 0.10;
    if (taxBase <= 20000000000)  return 20000000 + (taxBase - 200000000) * 0.20;
    if (taxBase <= 300000000000) return 3980000000 + (taxBase - 20000000000) * 0.22;
    return 65580000000 + (taxBase - 300000000000) * 0.25;
  }
  // ~2025: 2억 9% / 200억 19% / 3,000억 21% / 초과 24%
  if (taxBase <= 200000000)    return taxBase * 0.09;
  if (taxBase <= 20000000000)  return 18000000 + (taxBase - 200000000) * 0.19;
  if (taxBase <= 300000000000) return 3780000000 + (taxBase - 20000000000) * 0.21;
  return 62580000000 + (taxBase - 300000000000) * 0.24;
}

// 유틸: 소득세 누진세율
function _incomeTax(taxBase) {
  if (taxBase <= 0) return 0;
  if (taxBase <= 14000000)   return taxBase * 0.06;
  if (taxBase <= 50000000)   return taxBase * 0.15 - 1260000;
  if (taxBase <= 88000000)   return taxBase * 0.24 - 5760000;
  if (taxBase <= 150000000)  return taxBase * 0.35 - 15440000;
  if (taxBase <= 300000000)  return taxBase * 0.38 - 19940000;
  if (taxBase <= 500000000)  return taxBase * 0.40 - 25940000;
  if (taxBase <= 1000000000) return taxBase * 0.42 - 35940000;
  return taxBase * 0.45 - 65940000;
}

// ═══════════════════════════════════════════════════════════
// 1. 법인 설립 vs 개인사업자 세부담 비교 계산기
//    (법인세법 제4조, 조세특례제한법 제6조)
// ═══════════════════════════════════════════════════════════

/**
 * 개인사업자 vs 법인 세부담 비교
 * @param {Object} params
 * @param {number} params.annualProfit      - 연간 순이익 (원)
 * @param {number} params.ceoSalary         - 대표이사 급여 (원, 법인 시 손금산입)
 * @param {number} params.dividendRatio     - 배당 비율 (0~1, 법인 잉여금 중 배당 비율)
 * @param {boolean} params.isSME            - 중소기업 여부
 * @returns {Object}
 */
function calcCorpVsIndividual(params) {
  const {
    annualProfit  = 0,
    ceoSalary     = 0,
    dividendRatio = 0.5,
    isSME         = true,
    corpType      = 'sme',   // 'sme'|'general'|'sme_realty'(성실신고 소규모법인)
    taxYear       = new Date().getFullYear(),
    otherFinancialIncome = 0,
  } = params || {};

  // ── 개인사업자 세부담 ──
  // 근로소득공제 없음, 전액 종합소득 과세
  const indivDeduct    = 1500000; // 기본공제만
  const indivTaxBase   = Math.max(0, annualProfit - indivDeduct);
  const indivTax       = _incomeTax(indivTaxBase);
  const indivLocal     = indivTax * 0.1;
  const indivTotal     = indivTax + indivLocal;

  // ── 법인 세부담 ──
  // 법인: 대표 급여 손금산입 후 법인세
  const corpProfit     = Math.max(0, annualProfit - ceoSalary);
  const corpTaxAmt     = _corpTax(corpProfit, isSME, taxYear, corpType);
  const corpLocal      = corpTaxAmt * 0.1;
  const corpTaxTotal   = corpTaxAmt + corpLocal;

  // 대표 급여에 대한 소득세 (근로소득공제 적용)
  let earnedDeduction  = 0;
  if (ceoSalary <= 5000000)         earnedDeduction = ceoSalary * 0.70;
  else if (ceoSalary <= 15000000)   earnedDeduction = 3500000 + (ceoSalary - 5000000) * 0.40;
  else if (ceoSalary <= 45000000)   earnedDeduction = 7500000 + (ceoSalary - 15000000) * 0.15;
  else if (ceoSalary <= 100000000)  earnedDeduction = 12000000 + (ceoSalary - 45000000) * 0.05;
  else                              earnedDeduction = 14750000;
  earnedDeduction      = Math.min(earnedDeduction, 20000000);

  const salaryTaxBase  = Math.max(0, ceoSalary - earnedDeduction - 1500000);
  const salaryTax      = _incomeTax(salaryTaxBase) * 1.1;

  // 배당 세금 (15.4% 원천징수 기준, 종합과세 시 추가납부 발생 가능)
  const afterCorpProfit = corpProfit - corpTaxTotal;
  const dividend        = afterCorpProfit * dividendRatio;
  const dividendTax     = _dividendTax(dividend, Math.max(0, otherFinancialIncome));

  const corpTotalBurden = corpTaxTotal + salaryTax + dividendTax;

  // 절세금액
  const saving          = indivTotal - corpTotalBurden;

  return {
    annualProfit:      Math.round(annualProfit),
    // 개인사업자
    indivTaxBase:      Math.round(indivTaxBase),
    indivTax:          Math.round(indivTax),
    indivTotal:        Math.round(indivTotal),
    indivEffectiveRate: annualProfit > 0
      ? Math.round((indivTotal / annualProfit) * 1000) / 10 : 0,
    // 법인
    corpProfit:        Math.round(corpProfit),
    corpTaxAmt:        Math.round(corpTaxAmt),
    corpTaxTotal:      Math.round(corpTaxTotal),
    salaryTax:         Math.round(salaryTax),
    dividendTax:       Math.round(dividendTax),
    corpTotalBurden:   Math.round(corpTotalBurden),
    corpEffectiveRate: annualProfit > 0
      ? Math.round((corpTotalBurden / annualProfit) * 1000) / 10 : 0,
    // 비교
    saving:            Math.round(saving),
    betterChoice:      saving > 0 ? '법인' : '개인사업자',
    taxYear: Number(taxYear),
    estimateOnly: true,
    warnings: ['대표 급여의 인적공제·사회보험료와 배당 gross-up·배당세액공제 등은 단순화된 비교입니다.'],
    summary: `연 순이익 ${Math.round(annualProfit).toLocaleString()}원 기준 → ${saving > 0 ? '법인 전환 시' : '개인사업자 유지 시'} 연 ${Math.round(Math.abs(saving)).toLocaleString()}원 절세`,
  };
}

// ═══════════════════════════════════════════════════════════
// 2. 법인 청산세 계산기
//    (법인세법 제79조, 제80조, 소득세법 제17조)
// ═══════════════════════════════════════════════════════════

/**
 * 법인 청산 시 세부담 계산
 * @param {Object} params
 * @param {number} params.residualAssets    - 청산 잔여재산 (원)
 * @param {number} params.paidInCapital     - 납입자본금 (원)
 * @param {number} params.retainedEarnings  - 이익잉여금 (원)
 * @param {number} params.numShares         - 총 발행주식수
 * @param {number} params.ownedShares       - 대주주 보유 주식수
 * @param {number} params.acquisitionCost   - 주식 취득원가 (원)
 * @param {boolean} params.isSME            - 중소기업 여부
 * @returns {Object}
 */
function calcCorpLiquidation(params) {
  const {
    residualAssets   = 0,
    paidInCapital    = 0,
    retainedEarnings = 0,
    numShares        = 1,
    ownedShares      = 1,
    acquisitionCost  = 0,
    isSME            = true,
    corpType         = 'sme',   // 'sme'|'general'|'sme_realty'
    taxYear          = new Date().getFullYear(),
    otherFinancialIncome = 0,
  } = params || {};

  // 1. 법인 청산소득 (법인세법 제79조)
  const liquidationIncome = Math.max(0, residualAssets - paidInCapital);
  const corpTaxOnLiq      = _corpTax(liquidationIncome, isSME, taxYear, corpType);
  const corpLocalTax      = corpTaxOnLiq * 0.1;
  const corpTaxTotal      = corpTaxOnLiq + corpLocalTax;

  // 2. 주주 의제배당 (잔여재산분배액 - 취득원가)
  const ownershipRatio    = numShares > 0 ? Math.min(1, Math.max(0, ownedShares / numShares)) : 1;
  const distributedAmt    = Math.max(0, residualAssets - corpTaxTotal) * ownershipRatio;
  const deemedDividend    = Math.max(0, distributedAmt - acquisitionCost);

  // 의제배당 세금: 15.4% (2천만 초과 시 종합과세로 추가납부 발생 가능, 여기서는 원천징수 기준)
  const dividendTax       = _dividendTax(deemedDividend, Math.max(0, otherFinancialIncome));

  // 3. 총 세부담
  const totalTax          = corpTaxTotal + dividendTax;
  const netReceived       = distributedAmt - dividendTax;

  return {
    residualAssets:       Math.round(residualAssets),
    liquidationIncome:    Math.round(liquidationIncome),
    corpTaxOnLiq:         Math.round(corpTaxOnLiq),
    corpTaxTotal:         Math.round(corpTaxTotal),
    distributedAmt:       Math.round(distributedAmt),
    deemedDividend:       Math.round(deemedDividend),
    dividendTax:          Math.round(dividendTax),
    totalTax:             Math.round(totalTax),
    netReceived:          Math.round(netReceived),
    taxYear: Number(taxYear),
    estimateOnly: true,
    warnings: ['청산소득은 세무상 잔여재산가액·자기자본총액·세무조정에 따라 달라지며, 의제배당 gross-up·배당세액공제는 별도 확인이 필요합니다.'],
    effectiveRate:        residualAssets > 0
      ? Math.round((totalTax / residualAssets) * 1000) / 10 : 0,
    summary: `청산 잔여재산 ${Math.round(residualAssets).toLocaleString()}원 → 총 세부담 ${Math.round(totalTax).toLocaleString()}원, 대주주 실수령 ${Math.round(netReceived).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. 업무용 차량 비용 계산기
//    (법인세법 제27조의2, 시행령 제50조의2)
// ═══════════════════════════════════════════════════════════

/**
 * 업무용 승용차 손금 한도 계산
 * @param {Object} params
 * @param {number} params.vehiclePrice      - 차량 취득가액 (원)
 * @param {string} params.ownType           - 'purchase'|'lease'|'rent' (구입|리스|렌트)
 * @param {number} params.annualLeaseCost   - 연간 리스/렌트 비용 (원, 해당 시)
 * @param {number} params.businessUseRatio  - 업무 사용 비율 (0~1, 운행기록부 기준)
 * @param {number} params.annualFuelCost    - 연간 유류비·보험료·수리비 등 (원)
 * @param {boolean} params.hasLogbook       - 운행기록부 작성 여부
 * @returns {Object}
 */
function calcVehicleExpense(params) {
  const {
    vehiclePrice = 0,
    ownType = 'purchase',
    annualLeaseCost = 0,
    leaseDepreciationEquivalent,
    businessUseRatio = 1.0,
    annualFuelCost = 0,
    hasLogbook = false,
    hasExclusiveInsurance = true,
    businessMonths = 12,
    taxableIncomeBefore,
    taxYear = 2026,
    corpType = 'sme',
    confirmedMarginalRate,
  } = params || {};

  const values = [vehiclePrice, annualLeaseCost, businessUseRatio, annualFuelCost, businessMonths];
  if (!values.every(value => Number.isFinite(Number(value))) || values.some((value, index) => index !== 2 && Number(value) < 0)
      || businessUseRatio < 0 || businessUseRatio > 1 || businessMonths <= 0 || businessMonths > 12
      || !['purchase', 'lease', 'rent'].includes(ownType)) {
    return { calculated: false, calculator: 'calcVehicleExpense', missingInputs: [], invalidInputs: ['vehicleInputs'], warnings: ['차량가액·비용·업무사용비율·사용월수 입력 범위를 확인해야 합니다.'] };
  }

  const monthRatio = Number(businessMonths) / 12;
  const depreciationLimit = 8000000 * monthRatio;
  const noLogbookTotalLimit = 15000000 * monthRatio;
  const warnings = [];
  let depreciationEquivalent;
  let otherRelatedExpense;

  if (ownType === 'purchase') {
    depreciationEquivalent = vehiclePrice / 5;
    otherRelatedExpense = annualFuelCost;
  } else {
    if (Number.isFinite(Number(leaseDepreciationEquivalent))) {
      depreciationEquivalent = Math.max(0, Number(leaseDepreciationEquivalent));
    } else if (ownType === 'rent') {
      depreciationEquivalent = Math.max(0, annualLeaseCost * 0.70);
      warnings.push('렌트료의 감가상각비 상당액 미입력으로 렌트료의 70%를 간이 추정했습니다.');
    } else {
      depreciationEquivalent = Math.max(0, annualLeaseCost);
      warnings.push('리스료 중 보험료·자동차세·수선유지비 구분이 없어 리스료 전액을 감가상각비 상당액으로 보수적으로 추정했습니다.');
    }
    otherRelatedExpense = Math.max(0, annualLeaseCost - depreciationEquivalent) + annualFuelCost;
  }

  const totalCost = depreciationEquivalent + otherRelatedExpense;
  let allowedDepreciation = 0;
  let allowedOtherExpense = 0;

  if (!hasExclusiveInsurance) {
    warnings.push('임직원 전용 자동차보험 미가입으로 업무용승용차 관련비용을 손금으로 계산하지 않았습니다.');
  } else if (hasLogbook) {
    allowedDepreciation = Math.min(depreciationEquivalent * businessUseRatio, depreciationLimit);
    allowedOtherExpense = otherRelatedExpense * businessUseRatio;
  } else {
    allowedDepreciation = Math.min(depreciationEquivalent, depreciationLimit, noLogbookTotalLimit);
    allowedOtherExpense = Math.min(otherRelatedExpense, Math.max(0, noLogbookTotalLimit - allowedDepreciation));
    warnings.push(`운행기록부 미작성으로 업무용승용차 관련비용은 사용월수 환산 ${Math.round(noLogbookTotalLimit).toLocaleString()}원 한도 내에서 계산했습니다.`);
  }

  const deductibleLimit = hasExclusiveInsurance ? allowedDepreciation + allowedOtherExpense : 0;
  const excessAmount = Math.max(0, totalCost - deductibleLimit);
  const depreciationCarryforward = Math.max(0, depreciationEquivalent * (hasLogbook ? businessUseRatio : 1) - allowedDepreciation);

  let marginalRate = null;
  if (Number.isFinite(Number(confirmedMarginalRate))) {
    marginalRate = Math.min(1, Math.max(0, Number(confirmedMarginalRate)));
  }
  let taxSaving = null;
  if (marginalRate !== null) {
    taxSaving = deductibleLimit * marginalRate * 1.1;
  } else if (Number.isFinite(Number(taxableIncomeBefore))) {
    const before = _corpTax(Math.max(0, Number(taxableIncomeBefore)), true, taxYear, corpType);
    const after = _corpTax(Math.max(0, Number(taxableIncomeBefore) - deductibleLimit), true, taxYear, corpType);
    taxSaving = (before - after) * 1.1;
  } else {
    warnings.push('과세표준 또는 확인된 한계세율이 없어 법인세 절감액은 계산하지 않았습니다.');
  }

  return {
    vehiclePrice: Math.round(vehiclePrice),
    ownType,
    effectiveRatio: hasLogbook ? businessUseRatio * 100 : null,
    totalCost: Math.round(totalCost),
    depreciationEquivalent: Math.round(depreciationEquivalent),
    allowedDepreciation: Math.round(allowedDepreciation),
    allowedOtherExpense: Math.round(allowedOtherExpense),
    deductibleLimit: Math.round(deductibleLimit),
    excessAmount: Math.round(excessAmount),
    depreciationCarryforward: Math.round(depreciationCarryforward),
    taxSaving: taxSaving === null ? null : Math.round(taxSaving),
    taxSavingCalculated: taxSaving !== null,
    hasLogbook,
    hasExclusiveInsurance,
    businessMonths: Number(businessMonths),
    calculated: true,
    estimateOnly: warnings.length > 0,
    warnings,
    warning: warnings[0] || null,
    summary: `차량 관련비용 ${Math.round(totalCost).toLocaleString()}원 중 손금인정 추정 ${Math.round(deductibleLimit).toLocaleString()}원, 당기 미인정·이월검토액 ${Math.round(excessAmount).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 4. 접대비 한도 계산기
//    (법인세법 제25조, 시행령 제40조)
// ═══════════════════════════════════════════════════════════

/**
 * 접대비 손금 한도 계산
 * @param {Object} params
 * @param {number} params.revenue           - 연간 수입금액 (원)
 * @param {number} params.actualExpense     - 실제 접대비 지출액 (원)
 * @param {boolean} params.isSME            - 중소기업 여부 (기본 한도 다름)
 * @param {number} params.culturalRatio     - 문화접대비 비율 (0~1, 추가 한도 20%)
 * @returns {Object}
 */
function calcEntertainmentLimit(params) {
  const {
    revenue = 0,
    relatedPartyRevenue = 0,
    actualExpense = 0,
    isSME = true,
    culturalRatio = 0,
    culturalExpense,
    taxableIncomeBefore,
    taxYear = 2026,
    corpType = 'sme',
    confirmedMarginalRate,
  } = params || {};

  const values = [revenue, relatedPartyRevenue, actualExpense, culturalRatio];
  if (!values.every(value => Number.isFinite(Number(value))) || values.some(value => Number(value) < 0)
      || relatedPartyRevenue > revenue || culturalRatio > 1) {
    return { calculated: false, calculator: 'calcEntertainmentLimit', missingInputs: [], invalidInputs: ['expenseInputs'], warnings: ['수입금액·특수관계인 수입·지출액·문화비 비율의 범위를 확인해야 합니다.'] };
  }

  const baseLimit = isSME ? 36000000 : 12000000;
  const revenueLimitFor = amount => {
    const a = Math.max(0, Number(amount));
    if (a <= 10000000000) return a * 0.003;
    if (a <= 50000000000) return 30000000 + (a - 10000000000) * 0.002;
    return 110000000 + (a - 50000000000) * 0.0003;
  };
  const ordinaryRevenue = Math.max(0, revenue - relatedPartyRevenue);
  const revenueLimit = revenueLimitFor(ordinaryRevenue) + revenueLimitFor(relatedPartyRevenue) * 0.10;
  const totalLimit = baseLimit + revenueLimit;
  const confirmedCulturalExpense = Number.isFinite(Number(culturalExpense))
    ? Math.max(0, Number(culturalExpense))
    : actualExpense * Math.min(1, Math.max(0, culturalRatio));
  const culturalLimit = totalLimit * 0.20;
  const culturalAmt = Math.min(confirmedCulturalExpense, culturalLimit);
  const finalLimit = totalLimit + culturalAmt;
  const deductible = Math.min(actualExpense, finalLimit);
  const nonDeductible = Math.max(0, actualExpense - finalLimit);

  const warnings = [];
  let marginalRate = null;
  if (Number.isFinite(Number(confirmedMarginalRate))) marginalRate = Math.min(1, Math.max(0, Number(confirmedMarginalRate)));
  let addedTax = null;
  if (marginalRate !== null) {
    addedTax = nonDeductible * marginalRate * 1.1;
  } else if (Number.isFinite(Number(taxableIncomeBefore))) {
    const before = _corpTax(Math.max(0, Number(taxableIncomeBefore) + nonDeductible), isSME, taxYear, corpType);
    const after = _corpTax(Math.max(0, Number(taxableIncomeBefore)), isSME, taxYear, corpType);
    addedTax = (before - after) * 1.1;
  } else {
    warnings.push('과세표준 또는 확인된 한계세율이 없어 손금불산입에 따른 추가 법인세는 계산하지 않았습니다.');
  }
  if (!Number.isFinite(Number(culturalExpense)) && culturalRatio > 0) warnings.push('문화비 실제 지출액 미입력으로 전체 지출액에 문화비 비율을 곱해 추정했습니다.');

  return {
    revenue: Math.round(revenue),
    relatedPartyRevenue: Math.round(relatedPartyRevenue),
    baseLimit: Math.round(baseLimit),
    revenueLimit: Math.round(revenueLimit),
    totalLimit: Math.round(totalLimit),
    culturalAmt: Math.round(culturalAmt),
    finalLimit: Math.round(finalLimit),
    actualExpense: Math.round(actualExpense),
    deductible: Math.round(deductible),
    nonDeductible: Math.round(nonDeductible),
    addedTax: addedTax === null ? null : Math.round(addedTax),
    addedTaxCalculated: addedTax !== null,
    calculated: true,
    estimateOnly: warnings.length > 0,
    warnings,
    summary: `기업업무추진비 한도 ${Math.round(finalLimit).toLocaleString()}원 / 실지출 ${Math.round(actualExpense).toLocaleString()}원 → 손금불산입 ${Math.round(nonDeductible).toLocaleString()}원`,
  };
}

function _effectiveYyyymm(value) {
  const raw = String(value || '').replace(/[^0-9]/g, '');
  if (raw.length >= 6) return Number(raw.slice(0, 6));
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth() + 1;
}

function _npsMonthlyCap(value) {
  return _effectiveYyyymm(value) >= 202607 ? 6590000 : 6370000;
}

function _sustainedIncrease(current, prior1, prior2, prior3) {
  const a = Math.max(0, current - prior1);
  const b = Math.max(0, Math.min(current, prior1) - prior2);
  const c = Math.max(0, Math.min(current, prior1, prior2) - prior3);
  return [a, b, c];
}

// ═══════════════════════════════════════════════════════════
// 5. 고용세액공제 계산기
//    (조세특례제한법 제29조의7, 제29조의8, 제30조의4)
// ═══════════════════════════════════════════════════════════

/**
 * 고용증대 세액공제 계산
 * @param {Object} params
 * @param {number} params.newEmployees      - 상시근로자 증가 인원 수
 * @param {number} params.newYouthEmployees - 청년·장애인·60세이상 등 증가 인원 수
 * @param {string} params.region            - 'capital'|'other' (수도권|비수도권)
 * @param {boolean} params.isSME            - 중소기업 여부
 * @param {number} params.socialInsurance   - 사회보험료 사업주 부담분 (원, 세액공제용)
 * @returns {Object}
 */
function calcEmploymentCredit(params) {
  const {
    newEmployees = 0,
    newYouthEmployees = 0,
    region = 'other',
    isSME = true,
    companySize = isSME ? 'sme' : 'large',
    socialInsurance = 0,
    taxYear = 2026,
    currentEmployees,
    prior1Employees,
    prior2Employees,
    prior3Employees,
    currentYouthEmployees,
    prior1YouthEmployees,
    prior2YouthEmployees,
    prior3YouthEmployees,
  } = params || {};

  const isCapital = region === 'capital' || region === 'capitalArea';
  const generalNew = Math.max(0, newEmployees - newYouthEmployees);

  // 2025년 이전 방식은 기존 호출 결과를 보존한다.
  if (Number(taxYear) <= 2025) {
    const youthCredit = isSME ? (isCapital ? 14500000 : 15500000) : 7000000;
    const generalCredit = isSME ? (isCapital ? 8500000 : 9500000) : 4500000;
    const youthTotal = newYouthEmployees * youthCredit;
    const generalTotal = generalNew * generalCredit;
    const empCredit = youthTotal + generalTotal;
    const socialCredit = Number(taxYear) <= 2024 ? (isSME ? socialInsurance : socialInsurance * 0.5) : 0;
    const total3years = empCredit + empCredit * 0.75 + empCredit * 0.5;
    return {
      newEmployees, newYouthEmployees, youthCredit, generalCredit,
      youthTotal: Math.round(youthTotal), generalTotal: Math.round(generalTotal),
      empCredit: Math.round(empCredit), socialCredit: Math.round(socialCredit),
      totalCredit1st: Math.round(empCredit + socialCredit), total3years: Math.round(total3years),
      taxYear, estimateOnly: true,
      summary: `신규고용 ${newEmployees}명(청년 ${newYouthEmployees}명) → 1년차 세액공제 ${Math.round(empCredit + socialCredit).toLocaleString()}원, 3년 합계 약 ${Math.round(total3years).toLocaleString()}원`,
    };
  }

  const rateTable = {
    sme: {
      youth: isCapital ? [7000000, 16000000, 17000000] : [10000000, 19000000, 20000000],
      general: isCapital ? [4000000, 9000000, 10000000] : [7000000, 12000000, 13000000],
    },
    mid: { youth: [5000000, 9000000, 9000000], general: [3000000, 5000000, 5000000] },
    large: { youth: [3000000, 5000000, 0], general: [0, 0, 0] },
  };
  const normalizedSize = ['sme','mid','large'].includes(companySize) ? companySize : (isSME ? 'sme' : 'large');
  const rates = rateTable[normalizedSize];
  const historyValues = [currentEmployees, prior1Employees, prior2Employees, prior3Employees,
    currentYouthEmployees, prior1YouthEmployees, prior2YouthEmployees, prior3YouthEmployees].map(Number);
  const hasFullHistory = historyValues.every(Number.isFinite);

  let totalIncreases;
  let youthIncreases;
  if (hasFullHistory) {
    totalIncreases = _sustainedIncrease(Number(currentEmployees), Number(prior1Employees), Number(prior2Employees), Number(prior3Employees));
    const rawYouth = _sustainedIncrease(Number(currentYouthEmployees), Number(prior1YouthEmployees), Number(prior2YouthEmployees), Number(prior3YouthEmployees));
    youthIncreases = rawYouth.map((value, index) => Math.min(value, totalIncreases[index]));
  } else {
    totalIncreases = [Math.max(0, Number(newEmployees) || 0), 0, 0];
    youthIncreases = [Math.min(totalIncreases[0], Math.max(0, Number(newYouthEmployees) || 0)), 0, 0];
  }
  const generalIncreases = totalIncreases.map((value, index) => Math.max(0, value - youthIncreases[index]));
  const youthCredits = youthIncreases.map((value, index) => value * rates.youth[index]);
  const generalCredits = generalIncreases.map((value, index) => value * rates.general[index]);
  const annualCredits = youthCredits.map((value, index) => value + generalCredits[index]);
  const empCredit = annualCredits[0];
  const total3years = annualCredits.reduce((sum, value) => sum + value, 0);
  const warnings = [];
  if (!hasFullHistory) warnings.push('2026년 이후 2·3차년도 공제는 직전 3개 과세연도의 상시근로자·청년등 근로자 수가 필요하여 1차년도만 계산했습니다.');

  return {
    newEmployees: totalIncreases[0],
    newYouthEmployees: youthIncreases[0],
    youthCredit: rates.youth[0],
    generalCredit: rates.general[0],
    youthTotal: Math.round(youthCredits[0]),
    generalTotal: Math.round(generalCredits[0]),
    empCredit: Math.round(empCredit),
    socialCredit: 0,
    totalCredit1st: Math.round(empCredit),
    total3years: Math.round(total3years),
    annualCredits: annualCredits.map(Math.round),
    sustainedIncreases: { total: totalIncreases, youth: youthIncreases, general: generalIncreases },
    taxYear,
    companySize: normalizedSize,
    estimateOnly: !hasFullHistory,
    exactHistoryRequired: !hasFullHistory,
    warnings,
    summary: hasFullHistory
      ? `통합고용세액공제 1~3차년도 합계 ${Math.round(total3years).toLocaleString()}원`
      : `신규고용 ${totalIncreases[0]}명(청년 등 ${youthIncreases[0]}명) → 1차년도 세액공제 ${Math.round(empCredit).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 6. R&D 세액공제 계산기
//    (조세특례제한법 제10조, 제11조)
// ═══════════════════════════════════════════════════════════

/**
 * 연구·인력개발비 세액공제 계산
 * @param {Object} params
 * @param {number} params.currentRnD        - 당기 연구개발비 (원)
 * @param {number} params.priorAvgRnD       - 직전 4년 평균 연구개발비 (원)
 * @param {boolean} params.isSME            - 중소기업 여부
 * @param {string} params.method            - 'current'|'incremental' (당기분|증가분 중 선택)
 * @param {number} params.corpTaxable       - 법인세 산출세액 (원, 최저한세 검토용)
 * @returns {Object}
 */
function calcRnDCredit(params) {
  const {
    currentRnD = 0,
    priorRnD,
    priorAvgRnD = 0,
    isSME = true,
    companySize = isSME ? 'sme' : 'large',
    method = 'current',
    taxableIncome,
    corpTaxable = 0,
    calculatedCorporateTax,
    revenue = 0,
    taxYear = 2026,
    corpType = 'sme',
  } = params || {};

  if (![currentRnD, priorAvgRnD, corpTaxable, revenue].every(value => Number.isFinite(Number(value)))
      || [currentRnD, priorAvgRnD, corpTaxable, revenue].some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'calcRnDCredit', missingInputs: [], invalidInputs: ['amount'], warnings: ['연구개발비·과세표준·수입금액은 0 이상의 유한한 숫자여야 합니다.'] };
  }
  const normalizedSize = ['sme','mid','large'].includes(companySize) ? companySize : (isSME ? 'sme' : 'large');
  const previousRnD = Number.isFinite(Number(priorRnD)) ? Number(priorRnD) : Number(priorAvgRnD) || 0;
  let currentRate;
  if (normalizedSize === 'sme') currentRate = 0.25;
  else if (normalizedSize === 'mid') currentRate = 0.08;
  else currentRate = revenue > 0 ? Math.min(0.02, (currentRnD / revenue) * 0.5) : 0;
  const incrementalRate = normalizedSize === 'sme' ? 0.50 : (normalizedSize === 'mid' ? 0.40 : 0.25);
  const currentCredit = currentRnD * currentRate;
  const increaseAmt = Math.max(0, currentRnD - previousRnD);
  const incrementalCredit = increaseAmt * incrementalRate;
  const maxCredit = Math.max(currentCredit, incrementalCredit);
  const betterMethod = currentCredit >= incrementalCredit ? '당기분' : '증가분';
  const selectedMethod = method === 'incremental' ? 'incremental' : (method === 'better' ? (currentCredit >= incrementalCredit ? 'current' : 'incremental') : 'current');
  const selectedCredit = selectedMethod === 'incremental' ? incrementalCredit : currentCredit;

  const incomeBase = Number.isFinite(Number(taxableIncome)) ? Math.max(0, Number(taxableIncome)) : Math.max(0, Number(corpTaxable) || 0);
  const beforeCreditTax = Number.isFinite(Number(calculatedCorporateTax))
    ? Math.max(0, Number(calculatedCorporateTax))
    : (incomeBase > 0 ? _corpTax(incomeBase, normalizedSize === 'sme', taxYear, corpType) : null);
  const minimumTaxExempt = normalizedSize === 'sme';
  let minTax = 0;
  if (!minimumTaxExempt && incomeBase > 0) {
    if (incomeBase <= 10000000000) minTax = incomeBase * 0.10;
    else if (incomeBase <= 100000000000) minTax = 1000000000 + (incomeBase - 10000000000) * 0.12;
    else minTax = 11800000000 + (incomeBase - 100000000000) * 0.17;
  }
  const availableTax = beforeCreditTax === null ? null : Math.max(0, beforeCreditTax - minTax);
  const creditAfterMin = availableTax === null ? selectedCredit : Math.max(0, Math.min(selectedCredit, availableTax));
  const warnings = [];
  if (normalizedSize === 'large' && !(revenue > 0)) warnings.push('일반기업 당기분 공제율(최대 2%) 산정을 위한 수입금액이 없어 당기분 공제율을 0%로 적용했습니다.');
  if (!Number.isFinite(Number(priorRnD))) warnings.push('증가분 방식은 직전연도 연구·인력개발비가 필요하며, 기존 priorAvgRnD 값은 호환 입력으로만 사용했습니다.');
  if (beforeCreditTax === null) warnings.push('산출 법인세 또는 과세표준이 없어 최저한세 제한 전 금액을 반환했습니다.');

  return {
    currentRnD: Math.round(currentRnD),
    priorAvgRnD: Math.round(previousRnD),
    priorRnD: Math.round(previousRnD),
    increaseAmt: Math.round(increaseAmt),
    currentRate,
    incrementalRate,
    currentCredit: Math.round(currentCredit),
    incrementalCredit: Math.round(incrementalCredit),
    maxCredit: Math.round(maxCredit),
    selectedMethod,
    selectedCredit: Math.round(selectedCredit),
    betterMethod,
    minimumTaxExempt,
    minTax: Math.round(minTax),
    creditAfterMin: Math.round(creditAfterMin),
    companySize: normalizedSize,
    estimateOnly: warnings.length > 0,
    warnings,
    summary: `연구개발비 ${Math.round(currentRnD).toLocaleString()}원 → ${selectedMethod === 'incremental' ? '증가분' : '당기분'} 방식 세액공제 ${Math.round(selectedCredit).toLocaleString()}원 (유리한 방식: ${betterMethod}, 최저한세 검토 후 ${Math.round(creditAfterMin).toLocaleString()}원)`,
  };
}

// ═══════════════════════════════════════════════════════════
// 7. 명의신탁 증여의제 계산기
//    (상속세 및 증여세법 제45조의2, 국세기본법 제14조)
// ═══════════════════════════════════════════════════════════

/**
 * 명의신탁 주식 증여의제 세부담 추정
 * @param {Object} params
 * @param {number} params.stockValue        - 명의신탁 주식 평가액 (원)
 * @param {number} params.priorGifts        - 10년 내 기증여액 (원)
 * @param {boolean} params.hasEvasionIntent - 조세회피 목적 여부
 * @returns {Object}
 */
function calcNomineeTrust(params) {
  const {
    stockValue        = 0,
    priorGifts        = 0,
    hasEvasionIntent  = true,
    aggregatePriorGifts = false,
    confirmedPriorGiftTax,
    confirmedPenaltyAmount,
  } = params || {};

  // 증여의제 세금 (상증세법 제45조의2)
  // 증여재산공제 없음 (명의신탁은 공제 미적용)
  if (![stockValue, priorGifts].every(value => Number.isFinite(Number(value))) || stockValue < 0 || priorGifts < 0) {
    return { calculated: false, calculator: 'calcNomineeTrust', missingInputs: [], invalidInputs: ['amount'], warnings: ['주식가액과 과거 증여액은 0 이상의 유한한 숫자여야 합니다.'] };
  }
  const taxBase       = stockValue + (aggregatePriorGifts ? priorGifts : 0);

  // 누진세율
  let giftTax = 0;
  if (taxBase <= 100000000)       giftTax = taxBase * 0.1;
  else if (taxBase <= 500000000)  giftTax = taxBase * 0.2 - 10000000;
  else if (taxBase <= 1000000000) giftTax = taxBase * 0.3 - 60000000;
  else if (taxBase <= 3000000000) giftTax = taxBase * 0.4 - 160000000;
  else                            giftTax = taxBase * 0.5 - 460000000;

  // 기납부 증여세 차감 (5구간 누진세율 동일 적용)
  let priorGiftTax = 0;
  if (aggregatePriorGifts && Number.isFinite(Number(confirmedPriorGiftTax))) {
    priorGiftTax = Math.max(0, Number(confirmedPriorGiftTax));
  } else if (aggregatePriorGifts && priorGifts <= 100000000)       priorGiftTax = priorGifts * 0.1;
  else if (aggregatePriorGifts && priorGifts <= 500000000)  priorGiftTax = priorGifts * 0.2 - 10000000;
  else if (aggregatePriorGifts && priorGifts <= 1000000000) priorGiftTax = priorGifts * 0.3 - 60000000;
  else if (aggregatePriorGifts && priorGifts <= 3000000000) priorGiftTax = priorGifts * 0.4 - 160000000;
  else if (aggregatePriorGifts)      priorGiftTax = priorGifts * 0.5 - 460000000;

  const finalGiftTax  = Math.max(0, giftTax - priorGiftTax);
  const localTax      = 0; // 증여세는 지방소득세 과세대상이 아님

  // 조세회피 목적은 증여의제 적용 판단요소이며 가산세액을 자동 확정하는 입력이 아니다.
  const penaltyTax = Number.isFinite(Number(confirmedPenaltyAmount))
    ? Math.max(0, Number(confirmedPenaltyAmount)) : 0;
  const totalBurden = finalGiftTax + localTax + penaltyTax;
  const nomineeWarnings = [];
  if (!aggregatePriorGifts && priorGifts > 0) nomineeWarnings.push('명의신탁 증여의제의 과거 증여 합산 여부가 확인되지 않아 priorGifts를 과세표준에 합산하지 않았습니다.');
  if (aggregatePriorGifts && !Number.isFinite(Number(confirmedPriorGiftTax))) nomineeWarnings.push('과거 증여세액이 확인되지 않아 누진세액 차감 방식으로 추정했습니다.');
  if (!Number.isFinite(Number(confirmedPenaltyAmount))) nomineeWarnings.push('가산세는 신고내용·부정행위·경과일수 확인이 필요하여 자동 가산하지 않았습니다.');

  return {
    stockValue:       Math.round(stockValue),
    taxBase:          Math.round(taxBase),
    giftTax:          Math.round(giftTax),
    finalGiftTax:     Math.round(finalGiftTax),
    localTax:         Math.round(localTax),
    penaltyTax:       Math.round(penaltyTax),
    aggregatePriorGifts,
    totalBurden:      Math.round(totalBurden),
    hasEvasionIntent,
    riskLevel:        hasEvasionIntent ? '고위험(조세회피 목적 추정)' : '중위험',
    calculated: true,
    estimateOnly: true,
    warnings: nomineeWarnings,
    note: '명의신탁 증여의제 적용 여부, 과거 증여 합산, 신고세액공제 및 가산세는 사실관계별 확인이 필요합니다.',
    summary: `명의신탁 주식 ${Math.round(stockValue).toLocaleString()}원 → 증여의제 세부담 ${Math.round(totalBurden).toLocaleString()}원 (가산세 ${Math.round(penaltyTax).toLocaleString()}원 포함)`,
  };
}

// ═══════════════════════════════════════════════════════════
// 8. 사회보험료 계산기 (법인)
//    (국민건강보험법, 국민연금법, 고용보험법)
// ═══════════════════════════════════════════════════════════

/**
 * 법인 사회보험료 부담 계산
 * @param {Object} params
 * @param {number} params.totalMonthlySalary  - 전체 직원 월 급여 합계 (원)
 * @param {number} params.numEmployees        - 직원 수
 * @param {string} params.industry            - 업종 (산재보험료율 결정)
 * @returns {Object}
 */
function calcSocialInsuranceCorp(params) {
  const {
    totalMonthlySalary = 0,
    monthlySalaries,
    numEmployees = Array.isArray(monthlySalaries) ? monthlySalaries.length : 1,
    industry = 'general',
    effectiveDate,
    effectivePeriod,
    taxableIncomeBefore,
    confirmedMarginalRate,
    taxYear = new Date().getFullYear(),
    corpType = 'sme',
    isSME = true,
  } = params || {};

  const accidentRates = { general: 0.007, manufacturing: 0.014, construction: 0.036 };
  const accidentRate = accidentRates[industry] || 0.007;
  const period = effectiveDate || effectivePeriod;
  const npCap = _npsMonthlyCap(period);
  const salaryList = Array.isArray(monthlySalaries)
    ? monthlySalaries.map(Number).filter(Number.isFinite).map(value => Math.max(0, value))
    : null;
  const payroll = salaryList ? salaryList.reduce((sum, value) => sum + value, 0) : Math.max(0, totalMonthlySalary);
  const npAssessmentBase = salaryList
    ? salaryList.reduce((sum, value) => sum + Math.min(value, npCap), 0)
    : payroll;

  const npEmployer = Math.round(npAssessmentBase * 0.0475);
  const hiEmployer = Math.round(payroll * 0.03595);
  const ltcEmployer = Math.round(hiEmployer * 0.1314);
  const eiEmployer = Math.round(payroll * 0.009);
  const wcEmployer = Math.round(payroll * accidentRate);
  const monthlyBurden = npEmployer + hiEmployer + ltcEmployer + eiEmployer + wcEmployer;
  const annualBurden = monthlyBurden * 12;
  const actualEmployees = salaryList ? salaryList.length : numEmployees;
  const avgMonthly = actualEmployees > 0 ? Math.round(monthlyBurden / actualEmployees) : 0;

  let taxSaving;
  let marginalRateUsed;
  if (Number.isFinite(Number(confirmedMarginalRate))) {
    marginalRateUsed = Math.max(0, Number(confirmedMarginalRate));
    if (marginalRateUsed > 1) marginalRateUsed /= 100;
    taxSaving = annualBurden * marginalRateUsed * 1.1;
  } else if (Number.isFinite(Number(taxableIncomeBefore)) && Number(taxableIncomeBefore) > 0) {
    const before = _corpTax(Number(taxableIncomeBefore), isSME, taxYear, corpType);
    const after = _corpTax(Math.max(0, Number(taxableIncomeBefore) - annualBurden), isSME, taxYear, corpType);
    taxSaving = (before - after) * 1.1;
    marginalRateUsed = null;
  } else {
    marginalRateUsed = null;
    taxSaving = null;
  }
  const warnings = [];
  if (!salaryList) warnings.push('직원별 월급여가 없어 국민연금 개인별 상한을 적용하지 못한 총급여 기준 추정치입니다.');
  if (taxSaving === null) warnings.push('과세표준 또는 확인된 한계세율이 없어 사회보험료 손금산입에 따른 법인세 절감액은 계산하지 않았습니다.');
  warnings.push('고용보험 사업주 추가요율과 산재보험 개별실적요율 등은 실제 사업장 요율에 따라 달라질 수 있습니다.');

  return {
    calculated: true,
    totalMonthlySalary: Math.round(payroll),
    numEmployees: actualEmployees,
    effectivePeriod: _effectiveYyyymm(period),
    nationalPensionCap: npCap,
    taxYear: Number(taxYear),
    corpType,
    monthly: {
      nationalPension: npEmployer,
      healthInsurance: hiEmployer,
      longTermCare: ltcEmployer,
      employment: eiEmployer,
      accident: wcEmployer,
      total: monthlyBurden,
    },
    annualBurden: Math.round(annualBurden),
    avgMonthly,
    taxSaving: taxSaving === null ? null : Math.round(taxSaving),
    taxSavingCalculated: taxSaving !== null,
    marginalRateUsed,
    netAnnualBurden: taxSaving === null ? null : Math.round(annualBurden - taxSaving),
    estimateOnly: warnings.length > 0,
    warnings,
    summary: taxSaving === null
      ? `직원 ${actualEmployees}명 월 급여 ${Math.round(payroll).toLocaleString()}원 → 사업주 4대보험 연 ${Math.round(annualBurden).toLocaleString()}원 (세후 실부담은 과세표준 확인 필요)`
      : `직원 ${actualEmployees}명 월 급여 ${Math.round(payroll).toLocaleString()}원 → 사업주 4대보험 연 ${Math.round(annualBurden).toLocaleString()}원 (세금절감 후 실부담 ${Math.round(annualBurden - taxSaving).toLocaleString()}원)`,
  };
}

// ═══════════════════════════════════════════════════════════
// 9. 사내근로복지기금 계산기
//    (근로복지기본법, 법인세법 손금 규정)
// ═══════════════════════════════════════════════════════════

/**
 * 사내근로복지기금 출연 시뮬레이션
 *  - 누진세율(_corpTax) 기반으로 출연 전/후 법인세를 실제 계산하여 절감액 산출
 *  - 임원퇴직금 등 다른 함수의 22% 단일가정 폴백과 달리, 케이스별 정확한 한계세율이 자동 반영됨
 *  - 출연 손금 한도 및 임직원 비과세 한도는 별도 검토 영역(warning으로 안내)
 *
 * @param {Object} params
 * @param {number} params.outputAmount         - 출연금 (원)
 * @param {number} params.taxableIncomeBefore  - 출연 전 과세표준 (원, 통상 영업이익으로 근사)
 * @param {boolean} params.isSME               - 중소기업 여부 (기본 true)
 * @param {number} params.numEmployees         - 임직원 수 (1인당 복지액 산출용)
 * @returns {Object}
 */
function calcWelfareFund(params) {
  const {
    outputAmount        = 0,
    taxableIncomeBefore,
    isSME               = true,
    numEmployees        = 0,
    corpType            = 'sme',
    taxYear             = new Date().getFullYear(),
    deductibilityConfirmed = false,
    confirmedDeductibleAmount,
    confirmedMarginalRate,
  } = params || {};

  const amount = Number(outputAmount);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(Number(numEmployees)) || Number(numEmployees) < 0) {
    return { calculated: false, calculator: 'calcWelfareFund', missingInputs: [], invalidInputs: ['outputAmount|numEmployees'], warnings: ['출연금과 인원은 0 이상의 유한한 숫자여야 합니다.'] };
  }

  const warnings = [];
  const confirmedDeductible = Number.isFinite(Number(confirmedDeductibleAmount))
    ? Math.min(amount, Math.max(0, Number(confirmedDeductibleAmount)))
    : (deductibilityConfirmed ? amount : null);
  if (confirmedDeductible === null) {
    warnings.push('출연금의 손금산입 가능 여부와 금액이 확인되지 않아 법인세 절감액을 계산하지 않았습니다.');
  }

  const incomeKnown = Number.isFinite(Number(taxableIncomeBefore));
  let taxableAfter = null;
  let taxBefore = null;
  let taxAfter = null;
  let taxSaving = null;
  let rateUsed = null;
  if (confirmedDeductible !== null && Number.isFinite(Number(confirmedMarginalRate))) {
    rateUsed = Math.max(0, Number(confirmedMarginalRate));
    if (rateUsed > 1) rateUsed /= 100;
    taxSaving = confirmedDeductible * rateUsed * 1.1;
  } else if (confirmedDeductible !== null && incomeKnown) {
    const beforeIncome = Math.max(0, Number(taxableIncomeBefore));
    taxableAfter = Math.max(0, beforeIncome - confirmedDeductible);
    taxBefore = _corpTax(beforeIncome, isSME, taxYear, corpType) * 1.1;
    taxAfter = _corpTax(taxableAfter, isSME, taxYear, corpType) * 1.1;
    taxSaving = Math.max(0, taxBefore - taxAfter);
  } else if (confirmedDeductible !== null) {
    warnings.push('출연 전 과세표준 또는 확인된 한계세율이 없어 법인세 절감액을 계산하지 않았습니다.');
  }

  const effectiveSavingRate = taxSaving !== null && amount > 0 ? taxSaving / amount : null;
  const perEmployee = Number(numEmployees) > 0 ? amount / Number(numEmployees) : 0;
  const netBurden = taxSaving === null ? null : amount - taxSaving;
  warnings.push('사내근로복지기금 출연·사용 요건, 수혜대상, 손금산입 범위와 임직원 과세 여부는 실제 규정과 집행자료 확인이 필요합니다.');

  return {
    outputAmount: Math.round(amount),
    taxableIncomeBefore: incomeKnown ? Math.round(Number(taxableIncomeBefore)) : null,
    taxableAfter: taxableAfter === null ? null : Math.round(taxableAfter),
    deductibleAmount: confirmedDeductible === null ? null : Math.round(confirmedDeductible),
    deductibilityConfirmed: confirmedDeductible !== null,
    taxBefore: taxBefore === null ? null : Math.round(taxBefore),
    taxAfter: taxAfter === null ? null : Math.round(taxAfter),
    taxSaving: taxSaving === null ? null : Math.round(taxSaving),
    taxSavingCalculated: taxSaving !== null,
    marginalRateUsed: rateUsed,
    effectiveSavingRate: effectiveSavingRate === null ? null : Math.round(effectiveSavingRate * 1000) / 10,
    perEmployee: Math.round(perEmployee),
    netBurden: netBurden === null ? null : Math.round(netBurden),
    numEmployees: Math.floor(Number(numEmployees)),
    isSME,
    calculated: true,
    estimateOnly: true,
    warnings,
    warning: warnings.join(' '),
    summary: taxSaving === null
      ? `출연 ${Math.round(amount).toLocaleString()}원 — 손금산입 가능액과 과세표준 확인 후 세액 산출 필요`
      : `출연 ${Math.round(amount).toLocaleString()}원 → 법인세 절감 추정 ${Math.round(taxSaving).toLocaleString()}원 / 1인당 복지 ${Math.round(perEmployee).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 10. 스톡옵션 세금 계산기
//    (소득세법 제20조, 조세특례제한법 제16조의2)
// ═══════════════════════════════════════════════════════════

/**
 * 스톡옵션 행사 세부담 계산
 * @param {Object} params
 * @param {number} params.exercisePrice     - 행사가격 (원/주)
 * @param {number} params.marketPrice       - 시가 (원/주)
 * @param {number} params.numShares         - 행사 주식 수
 * @param {boolean} params.isVenture        - 벤처기업 여부 (과세특례 적용)
 * @param {number} params.annualIncome      - 연간 근로소득 (원, 합산 과세용)
 * @returns {Object}
 */
function calcStockOption(params) {
  const {
    exercisePrice = 0,
    marketPrice   = 0,
    numShares     = 0,
    isVenture     = false,
    annualIncome  = 0,
    qualifiesForVentureExemption = false,
    priorCumulativeVentureExemption = 0,
    electCapitalGainsDeferral = false,
    confirmedDeferredCapitalGainsTax = null,
  } = params || {};

  const values = [exercisePrice, marketPrice, numShares, annualIncome, priorCumulativeVentureExemption];
  if (!values.every(Number.isFinite) || values.some(value => value < 0)) {
    return { calculated: false, calculator: 'calcStockOption', missingInputs: [], invalidInputs: ['amount'], warnings: ['금액과 주식 수는 0 이상의 유한한 숫자여야 합니다.'] };
  }

  const exerciseGain  = Math.max(0, (marketPrice - exercisePrice) * numShares);

  function earnedIncomeDeduction(salary) {
    let deduction = 0;
    if (salary <= 5000000) deduction = salary * 0.70;
    else if (salary <= 15000000) deduction = 3500000 + (salary - 5000000) * 0.40;
    else if (salary <= 45000000) deduction = 7500000 + (salary - 15000000) * 0.15;
    else if (salary <= 100000000) deduction = 12000000 + (salary - 45000000) * 0.05;
    else deduction = 14750000;
    return Math.min(deduction, 20000000);
  }

  const totalIncome = annualIncome + exerciseGain;
  const totalDeduction = earnedIncomeDeduction(totalIncome);
  const baseDeduction = earnedIncomeDeduction(annualIncome);
  const taxBase = Math.max(0, totalIncome - totalDeduction - 1500000);
  const totalTax = _incomeTax(taxBase) * 1.1;
  const baseTaxBase = Math.max(0, annualIncome - baseDeduction - 1500000);
  const baseTax = _incomeTax(baseTaxBase) * 1.1;
  const stockTax = Math.max(0, totalTax - baseTax);

  const annualExemptionLimit = 200000000;
  const cumulativeExemptionLimit = 500000000;
  const remainingCumulativeLimit = Math.max(0, cumulativeExemptionLimit - Math.max(0, priorCumulativeVentureExemption));
  const ventureExemptAmount = (isVenture && qualifiesForVentureExemption)
    ? Math.min(exerciseGain, annualExemptionLimit, remainingCumulativeLimit)
    : 0;
  const taxableAfterExemption = Math.max(0, exerciseGain - ventureExemptAmount);

  let deferredCapitalGainsTax = null;
  if (isVenture && electCapitalGainsDeferral && _isProvidedFinite(confirmedDeferredCapitalGainsTax)) {
    deferredCapitalGainsTax = Math.max(0, Number(confirmedDeferredCapitalGainsTax));
  }

  const warnings = [];
  if (isVenture && !qualifiesForVentureExemption) warnings.push('벤처기업이라는 사실만으로 비과세가 자동 적용되지 않습니다. 부여일·대상자·연간 및 누적 한도 등 법정 요건 확인이 필요합니다.');
  if (isVenture && electCapitalGainsDeferral && deferredCapitalGainsTax === null) warnings.push('과세이연 특례는 적격주식매수선택권·신청·전용계좌 등 요건이 필요하므로 확인된 양도소득세액 없이는 자동 계산하지 않았습니다.');
  warnings.push('일반 근로소득세는 인적공제·보험료공제·세액공제 등을 단순화한 증가세액 추정치입니다.');

  return {
    exerciseGain: Math.round(exerciseGain),
    taxBase: Math.round(taxBase),
    totalTax: Math.round(totalTax),
    stockTax: Math.round(stockTax),
    effectiveRate: exerciseGain > 0 ? Math.round((stockTax / exerciseGain) * 1000) / 10 : 0,
    isVenture,
    qualifiesForVentureExemption,
    ventureExemptAmount: Math.round(ventureExemptAmount),
    taxableAfterExemption: Math.round(taxableAfterExemption),
    remainingCumulativeLimit: Math.round(remainingCumulativeLimit),
    // 기존 필드 유지: 확인된 과세이연 세액이 있을 때만 제공한다.
    ventureDefer: deferredCapitalGainsTax === null ? null : Math.round(deferredCapitalGainsTax),
    ventureSaving: deferredCapitalGainsTax === null ? null : Math.round(Math.max(0, stockTax - deferredCapitalGainsTax)),
    estimateOnly: true,
    warnings,
    summary: isVenture
      ? `행사이익 ${Math.round(exerciseGain).toLocaleString()}원 / 확인된 벤처 비과세 적용액 ${Math.round(ventureExemptAmount).toLocaleString()}원 / 일반과세 증가세액 추정 ${Math.round(stockTax).toLocaleString()}원`
      : `행사이익 ${Math.round(exerciseGain).toLocaleString()}원 → 근로소득세 증가액 추정 ${Math.round(stockTax).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 10. 해외자산 신고 기준 계산기
//     (국제조세조정에 관한 법률 제34조)
// ═══════════════════════════════════════════════════════════

/**
 * 해외금융계좌 신고 의무 및 과태료 추정
 * @param {Object} params
 * @param {number} params.overseasBalance   - 해외금융계좌 잔액 (원)
 * @param {boolean} params.hasReported      - 기신고 여부
 * @param {number} params.overseasIncome    - 해외 발생 소득 (원)
 * @param {boolean} params.isResident       - 거주자 여부
 * @returns {Object}
 */
function calcOverseasAsset(params) {
  const {
    overseasBalance = 0,
    monthlyEndBalances = null,
    hasReported     = false,
    overseasIncome  = 0,
    isResident      = true,
    otherGlobalIncome,
    foreignTaxPaid = 0,
    confirmedOverseasIncomeTax,
  } = params || {};

  const normalizedMonthlyBalances = Array.isArray(monthlyEndBalances)
    ? monthlyEndBalances.map(Number).filter(Number.isFinite).map(value => Math.max(0, value))
    : [];
  const reportBalance = normalizedMonthlyBalances.length
    ? Math.max(...normalizedMonthlyBalances)
    : Math.max(0, overseasBalance);
  const reportThreshold = 500000000; // 매월 말일 잔액 중 최고금액 5억원 기준
  const isSubject       = isResident && reportBalance > reportThreshold;

  // 과태료 (미신고 시): 미신고금액의 10~20%
  let penalty           = 0;
  if (isSubject && !hasReported) {
    penalty = reportBalance * 0.10;
    penalty = Math.min(penalty, 1000000000); // 과태료 한도 10억원
  }

  // 해외소득 세금은 다른 종합소득과 외국납부세액공제를 함께 확인해야 한다.
  const overseasWarnings = [];
  let overseasTax = null;
  if (Number.isFinite(Number(confirmedOverseasIncomeTax))) {
    overseasTax = Math.max(0, Number(confirmedOverseasIncomeTax));
  } else if (!isResident) {
    overseasTax = 0;
  } else if (Number.isFinite(Number(otherGlobalIncome))) {
    const baseIncome = Math.max(0, Number(otherGlobalIncome));
    const grossIncrement = (_incomeTax(baseIncome + Math.max(0, overseasIncome)) - _incomeTax(baseIncome)) * 1.1;
    overseasTax = Math.max(0, grossIncrement - Math.max(0, Number(foreignTaxPaid) || 0));
    overseasWarnings.push('외국납부세액공제 한도와 소득구분을 단순화한 증가세액 추정치입니다.');
  } else {
    overseasWarnings.push('다른 종합소득과 외국납부세액이 없어 해외소득 관련 국내 추가세액은 계산하지 않았습니다.');
  }
  if (!normalizedMonthlyBalances.length) overseasWarnings.push('월말 잔액 12개가 없어 제공된 단일 잔액을 신고판단 잔액으로 사용했습니다.');

  return {
    overseasBalance:  Math.round(overseasBalance),
    reportBalance:     Math.round(reportBalance),
    balanceBasis:      normalizedMonthlyBalances.length ? 'monthlyEndMaximum' : 'providedBalance',
    reportThreshold,
    isSubject,
    hasReported,
    penalty:          Math.round(penalty),
    overseasIncome:   Math.round(overseasIncome),
    overseasTax:      overseasTax === null ? null : Math.round(overseasTax),
    calculated: true,
    estimateOnly: overseasWarnings.length > 0,
    warnings: overseasWarnings,
    riskLevel:        !isSubject ? '신고의무 없음'
      : hasReported ? '신고 완료'
      : '미신고 — 과태료 위험',
    summary: `해외계좌 신고판단 잔액 ${Math.round(reportBalance).toLocaleString()}원 → ${isSubject ? (hasReported ? '신고 완료 (적법)' : `미신고 과태료 위험: 최대 ${Math.round(penalty).toLocaleString()}원`) : '신고의무 없음(5억 미만)'}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 11. 지주회사 절세효과 계산기
//     (법인세법 제18조의3, 조세특례제한법 제38조의2)
// ═══════════════════════════════════════════════════════════

/**
 * 지주회사 수입배당금 익금불산입 절세효과
 * @param {Object} params
 * @param {number} params.dividendReceived  - 수취 배당금 (원)
 * @param {number} params.ownershipRatio    - 자회사 주식 보유비율 (0~1)
 * @param {boolean} params.isListedSub      - 자회사 상장 여부
 * @param {number} params.corpTaxRate       - 법인세율 (0~1, 기본 0.22)
 * @returns {Object}
 */
function calcHoldingCompany(params) {
  const {
    dividendReceived = 0,
    ownershipRatio   = 1.0,
    isListedSub      = false,
    corpTaxRate      = 0.22,
    taxYear          = new Date().getFullYear(),
    useTransitionalHoldingRule = false,
    confirmedExemptRatio = null,
  } = params || {};

  const ratio = Math.min(1, Math.max(0, Number(ownershipRatio) || 0));
  let exemptRatio;
  let ruleProfile;
  const warnings = [];

  if (_isProvidedFinite(confirmedExemptRatio)) {
    exemptRatio = Math.min(1, Math.max(0, Number(confirmedExemptRatio)));
    ruleProfile = 'confirmed';
  } else if (useTransitionalHoldingRule && Number(taxYear) <= 2026) {
    // 종전 지주회사 특례는 경과규정 적용요건을 확인한 경우에만 선택한다.
    if (ratio >= 0.80) exemptRatio = 1.00;
    else if (ratio >= 0.40) exemptRatio = 0.80;
    else if (ratio >= 0.20 && isListedSub) exemptRatio = 0.40;
    else exemptRatio = 0.20;
    ruleProfile = 'holding-transition-through-2026';
    warnings.push('종전 지주회사 특례 경과규정 적용요건을 외부에서 확인했다는 전제로 계산했습니다.');
  } else {
    // 2023년 이후 일반 내국법인 수입배당금 익금불산입률
    if (ratio >= 0.50) exemptRatio = 1.00;
    else if (ratio >= 0.20) exemptRatio = 0.80;
    else exemptRatio = 0.30;
    ruleProfile = 'general-current';
    if (Number(taxYear) <= 2026) warnings.push('2026년 말까지 적용 가능한 종전 지주회사 특례는 경과요건 확인 후 useTransitionalHoldingRule로 별도 선택해야 합니다.');
  }

  const received = Math.max(0, Number(dividendReceived) || 0);
  const exemptAmount = received * exemptRatio;
  const taxableAmount = received - exemptAmount;
  let taxWithout = null;
  let taxWith = null;
  let taxSaving = null;
  if (_isProvidedFinite(params && params.confirmedMarginalRate)) {
    const rate = Math.min(1, Math.max(0, Number(params.confirmedMarginalRate)));
    taxWithout = received * rate * 1.1;
    taxWith = taxableAmount * rate * 1.1;
    taxSaving = taxWithout - taxWith;
  } else if (_isProvidedFinite(params && params.taxableIncomeBefore)) {
    const beforeIncome = Math.max(0, Number(params.taxableIncomeBefore));
    const isSME = (params && params.isSME) !== false;
    const type = (params && params.corpType) || 'sme';
    taxWithout = (_corpTax(beforeIncome + received, isSME, taxYear, type) - _corpTax(beforeIncome, isSME, taxYear, type)) * 1.1;
    taxWith = (_corpTax(beforeIncome + taxableAmount, isSME, taxYear, type) - _corpTax(beforeIncome, isSME, taxYear, type)) * 1.1;
    taxSaving = taxWithout - taxWith;
  } else if (params && Object.prototype.hasOwnProperty.call(params, 'corpTaxRate') && _isProvidedFinite(corpTaxRate)) {
    const rate = Math.min(1, Math.max(0, Number(corpTaxRate)));
    taxWithout = received * rate * 1.1;
    taxWith = taxableAmount * rate * 1.1;
    taxSaving = taxWithout - taxWith;
    warnings.push('사용자가 명시한 단일 법인세율로 절세액을 계산했습니다.');
  } else {
    warnings.push('과세표준 또는 확인된 한계세율이 없어 법인세 절감액은 계산하지 않았습니다.');
  }
  warnings.push('차입금 지급이자 차감과 피출자법인·배당 유형별 제외사항은 별도 세무조정이 필요합니다.');

  return {
    dividendReceived: Math.round(received),
    ownershipRatio: ratio * 100,
    exemptRatio: exemptRatio * 100,
    exemptAmount: Math.round(exemptAmount),
    taxableAmount: Math.round(taxableAmount),
    taxWithout: taxWithout === null ? null : Math.round(taxWithout),
    taxWith: taxWith === null ? null : Math.round(taxWith),
    taxSaving: taxSaving === null ? null : Math.round(taxSaving),
    taxSavingCalculated: taxSaving !== null,
    taxYear: Number(taxYear),
    ruleProfile,
    estimateOnly: true,
    warnings,
    summary: `배당금 ${Math.round(received).toLocaleString()}원 × 익금불산입 ${Math.round(exemptRatio * 1000) / 10}%${taxSaving === null ? ' (세액은 과세표준 확인 필요)' : ` → 법인세 절감 추정 ${Math.round(taxSaving).toLocaleString()}원`}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 12. 법인 적격합병 절세효과 계산기
//     (법인세법 제44조, 제46조, 조세특례제한법 제38조)
// ═══════════════════════════════════════════════════════════

/**
 * 적격합병 vs 비적격합병 세부담 비교
 * @param {Object} params
 * @param {number} params.bookValue         - 피합병법인 자산 장부가액 (원)
 * @param {number} params.fairValue         - 피합병법인 자산 시가 (원)
 * @param {number} params.paidInCapital     - 피합병법인 납입자본금 (원)
 * @param {boolean} params.isSME            - 중소기업 여부
 * @returns {Object}
 */
function calcMergerTax(params) {
  const {
    bookValue = 0,
    fairValue = 0,
    paidInCapital = 0,
    isSME = true,
    corpType = 'sme',
    taxYear = new Date().getFullYear(),
    qualifiedMergerConfirmed = false,
    deferYears,
    discountRate,
    confirmedDeferredTax,
  } = params || {};

  const values = [bookValue, fairValue, paidInCapital];
  if (!values.every(value => Number.isFinite(Number(value))) || values.some(value => Number(value) < 0)) {
    return { calculated: false, calculator: 'calcMergerTax', missingInputs: [], invalidInputs: ['amount'], warnings: ['장부가액·시가·납입자본금은 0 이상의 유한한 숫자여야 합니다.'] };
  }
  const mergerGain = Math.max(0, Number(fairValue) - Number(bookValue));
  const nonQualTax = _corpTax(mergerGain, isSME, taxYear, corpType);
  const nonQualLocal = nonQualTax * 0.1;
  const nonQualTotal = nonQualTax + nonQualLocal;

  const warnings = [];
  let deferredTax = null;
  let presentValue = null;
  let deferSaving = null;
  const yearsConfirmed = Number.isFinite(Number(deferYears)) && Number(deferYears) >= 0;
  const rateConfirmed = Number.isFinite(Number(discountRate)) && Number(discountRate) >= 0;
  if (!qualifiedMergerConfirmed) {
    warnings.push('적격합병의 사업계속·지분교부·고용승계 등 법정요건이 확인되지 않아 과세이연 효과를 계산하지 않았습니다.');
  } else {
    deferredTax = Number.isFinite(Number(confirmedDeferredTax))
      ? Math.max(0, Number(confirmedDeferredTax)) : nonQualTotal;
    if (yearsConfirmed && rateConfirmed) {
      const r = Number(discountRate) > 1 ? Number(discountRate) / 100 : Number(discountRate);
      presentValue = deferredTax / Math.pow(1 + r, Number(deferYears));
      deferSaving = deferredTax - presentValue;
    } else {
      warnings.push('과세이연 기간과 할인율이 확인되지 않아 현재가치 절감액은 계산하지 않았습니다.');
    }
    if (!Number.isFinite(Number(confirmedDeferredTax))) warnings.push('이연세액은 비적격 즉시과세액과 동일하다고 단순 가정한 추정치입니다.');
  }
  warnings.push('합병 시 양도손익, 자산조정계정, 주주 과세와 사후관리 위반 추징은 본 단순 비교에 포함되지 않습니다.');

  return {
    bookValue: Math.round(Number(bookValue)),
    fairValue: Math.round(Number(fairValue)),
    paidInCapital: Math.round(Number(paidInCapital)),
    mergerGain: Math.round(mergerGain),
    nonQualTax: Math.round(nonQualTax),
    nonQualTotal: Math.round(nonQualTotal),
    qualifiedMergerConfirmed,
    deferredTax: deferredTax === null ? null : Math.round(deferredTax),
    presentValue: presentValue === null ? null : Math.round(presentValue),
    deferSaving: deferSaving === null ? null : Math.round(deferSaving),
    calculated: true,
    estimateOnly: true,
    warnings,
    summary: !qualifiedMergerConfirmed
      ? `합병차익 ${Math.round(mergerGain).toLocaleString()}원 → 비적격 즉시과세 추정 ${Math.round(nonQualTotal).toLocaleString()}원; 적격 여부 확인 필요`
      : deferSaving === null
        ? `적격합병 확인: 이연세액 추정 ${Math.round(deferredTax).toLocaleString()}원; 기간·할인율 입력 시 현재가치 계산 가능`
        : `적격합병 과세이연 세액 ${Math.round(deferredTax).toLocaleString()}원 → 현재가치 효과 ${Math.round(deferSaving).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// exports
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 가족법인 일감몰아주기 증여의제 (상증법 §45-3, §45-4)
//    특수관계법인 매출 비중 30% 초과 시 증여의제 적용.
//    수혜주주(지분율 30% 초과)의 지분 비율만큼 증여로 간주.
//    2026 기준 단순화 모델.
// ═══════════════════════════════════════════════════════════

/**
 * @param {object} params
 * @param {number} params.familyCorpRevenue        - 가족법인 매출 (원)
 * @param {number} params.relatedPartyRevenueRatio - 특수관계법인 매출 비율 (0~1)
 * @param {number} params.shareRatio               - 수혜주주 지분율 (0~1)
 * @param {number} [params.afterTaxProfitRate=0.05] - 매출 대비 세후이익률 (기본 5%)
 */
function calcFamilyCorpGiftPresumption(params) {
  const {
    familyCorpRevenue = 0,
    relatedPartyRevenueRatio = 0,
    shareRatio = 0,
    afterTaxProfitRate = 0.05,
    afterTaxOperatingProfit,
    companyScale = 'sme',
    priorGifts = 0,
    giftDeduction = 0,
    confirmedGiftTax,
  } = params || {};

  const inputs = [familyCorpRevenue, relatedPartyRevenueRatio, shareRatio, priorGifts, giftDeduction];
  if (!inputs.every(value => Number.isFinite(Number(value))) || Number(familyCorpRevenue) < 0 || Number(priorGifts) < 0 || Number(giftDeduction) < 0) {
    return { calculated: false, calculator: 'calcFamilyCorpGiftPresumption', missingInputs: [], invalidInputs: ['input'], warnings: ['매출·비율·과거 증여·공제 입력을 확인해 주세요.'] };
  }
  const relatedRatio = Math.min(1, Math.max(0, Number(relatedPartyRevenueRatio)));
  const ownerRatio = Math.min(1, Math.max(0, Number(shareRatio)));
  const NORMAL_RATIO = companyScale === 'sme' ? 0.50 : (companyScale === 'mid' ? 0.40 : 0.30);
  const LIMIT_HOLDING = (companyScale === 'sme' || companyScale === 'mid') ? 0.10 : 0.03;
  const excessRatio = Math.max(0, relatedRatio - NORMAL_RATIO);
  const effectiveShare = Math.max(0, ownerRatio - LIMIT_HOLDING);

  const profitConfirmed = Number.isFinite(Number(afterTaxOperatingProfit));
  const afterTaxProfit = profitConfirmed
    ? Math.max(0, Number(afterTaxOperatingProfit))
    : Math.max(0, Number(familyCorpRevenue)) * Math.max(0, Number(afterTaxProfitRate) || 0);
  const giftPresumed = afterTaxProfit * excessRatio * effectiveShare;

  const priorTaxable = Math.max(0, Number(priorGifts) - Number(giftDeduction));
  const combinedTaxable = Math.max(0, Number(priorGifts) + giftPresumed - Number(giftDeduction));
  const estimatedGiftTax = Math.max(0, _giftTaxProgressive(combinedTaxable) - _giftTaxProgressive(priorTaxable));
  const giftTax = Number.isFinite(Number(confirmedGiftTax))
    ? Math.max(0, Number(confirmedGiftTax)) : estimatedGiftTax;
  const warnings = [];
  if (!profitConfirmed) warnings.push('세후영업이익이 없어 매출액×세후이익률로 추정했습니다. 정확한 증여의제이익에는 수혜법인의 세후영업이익이 필요합니다.');
  if (!Number.isFinite(Number(confirmedGiftTax))) warnings.push('증여세는 과거 증여·공제·세액공제 등을 단순화한 증가세액 추정치입니다.');
  warnings.push('과세제외매출액, 간접보유비율, 지배주주·친족 합산 및 사업연도별 조정사항은 별도 확인이 필요합니다.');

  return {
    companyScale,
    normalTradeRatio: NORMAL_RATIO,
    limitHoldingRatio: LIMIT_HOLDING,
    relatedPartyRevenueRatio: relatedRatio,
    excessRatio,
    shareRatio: ownerRatio,
    effectiveShare,
    afterTaxOperatingProfit: Math.round(afterTaxProfit),
    profitConfirmed,
    giftPresumed: Math.round(giftPresumed),
    priorGifts: Math.round(Number(priorGifts)),
    giftDeduction: Math.round(Number(giftDeduction)),
    giftTax: Math.round(giftTax),
    estimatedGiftTax: Math.round(estimatedGiftTax),
    giftTaxConfirmed: Number.isFinite(Number(confirmedGiftTax)),
    netReceived: Math.round(giftPresumed - giftTax),
    isSubject: excessRatio > 0 && effectiveShare > 0 && afterTaxProfit > 0,
    calculated: true,
    estimateOnly: warnings.length > 0,
    warnings,
    summary: {
      giftPresumed_억: Math.round(giftPresumed / 100000000 * 10) / 10,
      giftTax_만: Math.round(giftTax / 10000),
      giftTax_억: Math.round(giftTax / 100000000 * 10) / 10,
      netReceived_억: Math.round((giftPresumed - giftTax) / 100000000 * 10) / 10,
    },
  };
}

// ═══════════════════════════════════════════════════════════
// 이익소각 (자기주식 취득 후 소각) — 의제배당 소득세
//   소득세법 §17①(의제배당), §62(금융소득종합과세 비교과세)
//   ※ gross-up·배당세액공제는 보수적으로 미반영(과대추정 방지) — 실제 세액은 이보다 낮을 수 있음
//   ※ 소각 재원(이익/자본잉여금) 구분·증권거래세·조세회피 부인 리스크는 세무사 검토
// ═══════════════════════════════════════════════════════════
/**
 * 이익소각 의제배당 소득세
 * @param {Object} params
 * @param {number} params.redemptionValue - 소각 대가(자기주식 취득가액 합계, 원)
 * @param {number} params.acquisitionCost - 대주주의 당초 주식 취득가액(원)
 * @param {number} params.otherIncome     - 대주주의 다른 종합소득(근로·사업 등, 원). 없으면 0
 * @returns {Object}
 */
function calcProfitRetirement(params) {
  const {
    redemptionValue = 0,
    acquisitionCost = 0,
    otherIncome = 0,
  } = params || {};

  const THRESHOLD = 20000000; // 금융소득종합과세 기준 2천만원
  const SEP_RATE = 0.14;      // 14% 원천(국세)
  const LOCAL = 1.1;          // 지방소득세 10%

  const deemedDividend = Math.max(0, redemptionValue - acquisitionCost);
  let nationalTax = 0, method;

  if (deemedDividend <= 0) {
    method = '의제배당 없음(취득가액 ≥ 소각대가)';
  } else if (deemedDividend <= THRESHOLD) {
    nationalTax = deemedDividend * SEP_RATE;
    method = '분리과세(2천만원 이하, 14%)';
  } else {
    // 금융소득종합과세 비교과세(소득세법 §62): max(일반산출, 비교산출) 중 의제배당 귀속분
    const generalTotal = _incomeTax(otherIncome + (deemedDividend - THRESHOLD)) + THRESHOLD * SEP_RATE;
    const compareTotal = _incomeTax(otherIncome) + deemedDividend * SEP_RATE;
    const totalTax = Math.max(generalTotal, compareTotal);
    nationalTax = Math.max(0, totalTax - _incomeTax(otherIncome));
    method = '종합과세 비교과세(2천만원 초과)';
  }

  const dividendTax = Math.round(nationalTax * LOCAL);
  const netReceived = redemptionValue - dividendTax;
  const effectiveRate = redemptionValue > 0 ? Math.round(dividendTax / redemptionValue * 1000) / 10 : 0;

  return {
    redemptionValue: Math.round(redemptionValue),
    acquisitionCost: Math.round(acquisitionCost),
    deemedDividend: Math.round(deemedDividend),
    method,
    dividendTax,
    netReceived: Math.round(netReceived),
    effectiveRate,
    warning: '이익소각은 조세회피 목적 부인(부당행위계산부인) 리스크가 있어 실행 전 세무사 검토 필수. 본 계산은 의제배당 소득세 추정치이며 배당세액공제(gross-up)·증권거래세·소각 재원(이익/자본잉여금) 구분 미반영 — 실제 세액은 이보다 낮을 수 있음. 대주주의 다른 종합소득이 있으면 합산되어 세액이 증가.',
    summary: `소각대가 ${Math.round(redemptionValue).toLocaleString()}원 − 취득가액 ${Math.round(acquisitionCost).toLocaleString()}원 = 의제배당 ${Math.round(deemedDividend).toLocaleString()}원 → 배당소득세 ${dividendTax.toLocaleString()}원(${method}, 지방세 포함, 실효 ${effectiveRate}%), 실수령 ${Math.round(netReceived).toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 차등배당(초과배당의 증여) — 상증법 §41-2 (2021 개정: 소득세+증여세 모두 과세)
//   증여재산가액 = 초과배당 − 소득세 상당액(초과배당이 유발한 한계 소득세)
//   ※ 법정 소득세상당액은 기재부령 율(잠정) → 다음해 실제 소득세로 정산. 본 계산은 정산 최종값에 근접한 한계분 추정.
//   ※ 최대주주 판정·특수관계 요건·10년 합산은 세무사 검토
// ═══════════════════════════════════════════════════════════
// 공통: 배당소득세 비교과세(지방세 10% 포함)
function _dividendTax(dividend, otherIncome) {
  const TH = 20000000, SEP = 0.14, LOCAL = 1.1;
  if (dividend <= 0) return 0;
  let nat;
  if (dividend <= TH) {
    nat = dividend * SEP;
  } else {
    const general = _incomeTax(otherIncome + (dividend - TH)) + TH * SEP;
    const compare = _incomeTax(otherIncome) + dividend * SEP;
    nat = Math.max(0, Math.max(general, compare) - _incomeTax(otherIncome));
  }
  return Math.round(nat * LOCAL);
}
// 공통: 증여세 누진세율(상증법 §26, 공제 전 산출세액)
function _giftTaxProgressive(base) {
  if (base <= 0) return 0;
  if (base <= 100000000)   return base * 0.10;
  if (base <= 500000000)   return 10000000 + (base - 100000000) * 0.20;
  if (base <= 1000000000)  return 90000000 + (base - 500000000) * 0.30;
  if (base <= 3000000000)  return 240000000 + (base - 1000000000) * 0.40;
  return 1040000000 + (base - 3000000000) * 0.50;
}
/**
 * 차등배당(초과배당) 세부담
 * @param {Object} params
 * @param {number} params.totalDividend             - 총 배당재원(원)
 * @param {number} params.beneficiaryShareRatio     - 수혜주주 지분율(0~1)
 * @param {number} params.beneficiaryActualDividend - 수혜주주가 실제 받은 배당(원)
 * @param {number} params.otherIncome               - 수혜주주의 다른 종합소득(원)
 * @param {number} params.priorGifts                - 10년 내 사전증여(원)
 * @param {boolean} params.beneficiaryIsMinor       - 수증자 미성년 여부
 */
function calcDifferentialDividend(params) {
  const {
    totalDividend = 0,
    beneficiaryShareRatio = 0,
    beneficiaryActualDividend = 0,
    otherIncome = 0,
    priorGifts = 0,
    beneficiaryIsMinor = false,
  } = params || {};

  const equalShare = Math.round(totalDividend * beneficiaryShareRatio);     // 균등배당 몫
  const excessDividend = Math.max(0, beneficiaryActualDividend - equalShare); // 초과배당
  const dividendTaxTotal = _dividendTax(beneficiaryActualDividend, otherIncome); // 실제수령 배당세
  const dividendTaxEqual = _dividendTax(equalShare, otherIncome);            // 균등배당 배당세
  const incomeTaxOnExcess = Math.max(0, dividendTaxTotal - dividendTaxEqual); // 초과배당 유발 소득세(한계분)
  const giftBase = Math.max(0, excessDividend - incomeTaxOnExcess);          // 증여재산가액

  // 증여세(직계비속: 성인 5천만/미성년 2천만 공제, 10년 합산 근사)
  const giftDeduction = beneficiaryIsMinor ? 20000000 : 50000000;
  const giftTaxable = Math.max(0, giftBase + priorGifts - giftDeduction);
  const priorTaxable = Math.max(0, priorGifts - giftDeduction);
  const giftTax = Math.round(Math.max(0, _giftTaxProgressive(giftTaxable) - _giftTaxProgressive(priorTaxable)));

  const totalBurden = dividendTaxTotal + giftTax;
  const effectiveRate = beneficiaryActualDividend > 0 ? Math.round(totalBurden / beneficiaryActualDividend * 1000) / 10 : 0;

  return {
    equalShare,
    excessDividend,
    beneficiaryActualDividend: Math.round(beneficiaryActualDividend),
    totalDividend: Math.round(totalDividend),
    dividendTaxTotal,
    incomeTaxOnExcess,
    giftBase,
    giftTax,
    totalBurden,
    effectiveRate,
    warning: '상증법 §41-2(2021 개정): 초과배당은 소득세와 증여세를 모두 부담. 본 계산의 소득세상당액은 초과배당이 유발한 한계 소득세 추정치이며, 실제는 다음해 소득세 신고 시 정산으로 확정. 최대주주 판정·특수관계 요건·10년 증여합산은 세무사 검토 필수.',
    summary: `실제수령 ${Math.round(beneficiaryActualDividend).toLocaleString()}원(균등 ${equalShare.toLocaleString()}원 + 초과 ${excessDividend.toLocaleString()}원) → 배당소득세 ${dividendTaxTotal.toLocaleString()}원 + 증여세 ${giftTax.toLocaleString()}원(증여재산가액 ${giftBase.toLocaleString()}원) = 총 ${totalBurden.toLocaleString()}원(실효 ${effectiveRate}%)`,
  };
}

// ═══════════════════════════════════════════════════════════
// 직무발명보상금 비과세 — 소득세법 §12 3호 어목, 시행령 §17의3
//   비과세 한도 연 700만원(2024년 500만→700만). 초과분 근로소득 합산(퇴직 후 기타소득).
//   ★ 2024.2.29~ 사용자(법인)의 지배주주등·특수관계인은 비과세 제외(대표·지배주주 본인 불가)
// ═══════════════════════════════════════════════════════════
/**
 * 직무발명보상금 비과세 절세
 * @param {Object} params
 * @param {number} params.compensation            - 연 보상금 총액(원)
 * @param {number} params.otherIncome             - 수령자 다른 근로/종합소득(원, 한계세율 산정)
 * @param {boolean} params.isControllingShareholder - 수령자가 지배주주등/특수관계인 여부
 */
function calcInventionCompensation(params) {
  const { compensation = 0, otherIncome = 0, isControllingShareholder = false } = params || {};
  const LIMIT = 7000000; // 비과세 한도 연 700만원
  const LOCAL = 1.1;

  const exemptAmount = isControllingShareholder ? 0 : Math.min(compensation, LIMIT);
  const taxableAmount = compensation - exemptAmount;

  // 근로소득 합산 한계세율 기준(지방세 포함)
  const marginalAll = _incomeTax(otherIncome + compensation) - _incomeTax(otherIncome);
  const marginalTaxable = _incomeTax(otherIncome + taxableAmount) - _incomeTax(otherIncome);
  const taxSaving = Math.round(Math.max(0, marginalAll - marginalTaxable) * LOCAL); // 비과세 절세액
  const taxOnExcess = Math.round(Math.max(0, marginalTaxable) * LOCAL);             // 과세분 세금

  return {
    compensation: Math.round(compensation),
    exemptAmount: Math.round(exemptAmount),
    taxableAmount: Math.round(taxableAmount),
    taxSaving,
    taxOnExcess,
    warning: isControllingShareholder
      ? '★ 2024.2.29부터 사용자(법인)의 지배주주등·특수관계인은 직무발명보상금 비과세 제외 — 대표·지배주주 본인은 비과세 불가(전액 과세). 발명 실재성·적정 보상규정 필요(과다 지급 시 부인 리스크).'
      : '비과세 한도 연 700만원(2024년 500만→700만 상향). 초과분은 재직 중 근로소득 합산(퇴직 후 수령은 기타소득). ★수령자가 지배주주등·특수관계인이면 비과세 제외되니 확인 필수. 발명 실재성·적정 보상규정 필요.',
    summary: isControllingShareholder
      ? `보상금 ${Math.round(compensation).toLocaleString()}원 — 지배주주등은 비과세 제외(2024.2.29~) → 비과세 0원, 전액 근로소득 과세(세금 ${taxOnExcess.toLocaleString()}원)`
      : `보상금 ${Math.round(compensation).toLocaleString()}원 중 비과세 ${Math.round(exemptAmount).toLocaleString()}원(연 700만 한도) → 절세 ${taxSaving.toLocaleString()}원` + (taxableAmount > 0 ? `, 초과 과세분 ${Math.round(taxableAmount).toLocaleString()}원(세금 ${taxOnExcess.toLocaleString()}원)` : ''),
  };
}

// ═══════════════════════════════════════════════════════════
// 특허(산업재산권) 자본화 — 개인→법인 양도
//   개인: 기타소득(소득세법 §21①7, 시행령 §87 — 필요경비 60% 의제, 40%만 과세)
//   법인: 무형자산 자본화 → 감가상각 손금 → 법인세 절감
//   ※ 특허 가치평가(감정) 적정성·부당행위계산부인 리스크는 세무사·감정 검토
// ═══════════════════════════════════════════════════════════
/**
 * 특허 자본화 절세 (개인 기타소득세 vs 법인 절감, 급여 비교)
 * @param {Object} params
 * @param {number} params.transferPrice     - 특허 양도대가(원, 감정평가액)
 * @param {number} params.otherIncome       - 대표(양도자) 다른 종합소득(원)
 * @param {number} params.corpTaxableIncome - 법인 과세표준(원, 절감 한계세율용)
 */
function calcPatentCapitalization(params) {
  const { transferPrice = 0, otherIncome = 0, corpTaxableIncome = 0, taxYear = new Date().getFullYear(), corpType = 'sme' } = params || {};
  const LOCAL = 1.1;
  const otherIncomeAmt = Math.round(transferPrice * 0.4); // 기타소득금액 = 양도가 × 40%(필요경비 60%)

  // 개인 기타소득세
  let personalTax, method;
  if (otherIncomeAmt <= 3000000) {
    personalTax = Math.round(otherIncomeAmt * 0.20 * LOCAL); // 분리과세 20%(지방포함 22%)
    method = '분리과세(기타소득금액 300만원 이하)';
  } else {
    const marginal = _incomeTax(otherIncome + otherIncomeAmt) - _incomeTax(otherIncome);
    personalTax = Math.round(Math.max(0, marginal) * LOCAL); // 종합과세 한계(지방포함)
    method = '종합과세(기타소득금액 300만원 초과)';
  }

  // 법인 감가상각 누적 절감(양도가 × 법인 한계세율, 지방포함)
  const corpMarginal = (_corpTax(corpTaxableIncome + 1000000, true, taxYear, corpType) - _corpTax(corpTaxableIncome, true, taxYear, corpType)) / 1000000;
  const corpTaxSaving = Math.round(transferPrice * corpMarginal * LOCAL);

  // 같은 금액을 급여로 인출 시 개인 세부담(비교)
  const salaryTax = Math.round(Math.max(0, _incomeTax(otherIncome + transferPrice) - _incomeTax(otherIncome)) * LOCAL);
  const vsSalarySaving = salaryTax - personalTax; // 급여 대비 개인세 절감

  const netEffect = corpTaxSaving - personalTax; // 법인절감 − 개인세

  return {
    transferPrice: Math.round(transferPrice),
    otherIncomeAmt,
    sepTaxThreshold: 3000000,
    personalTax,
    method,
    corpTaxSaving,
    salaryTax,
    vsSalarySaving,
    netEffect,
    warning: '특허 가치평가는 감정평가 등 적정액이어야 하며(과다 시 부당행위계산부인·증여 리스크), 특수관계 거래이므로 시가 입증 필수. 법인세 절감은 감가상각 내용연수(통상 7년) 동안 분할 실현. 기타소득금액 300만원 초과 시 다음해 종합소득세 정산.',
    summary: `양도대가 ${Math.round(transferPrice).toLocaleString()}원 → 기타소득금액 ${otherIncomeAmt.toLocaleString()}원(40%만 과세) → 개인세 ${personalTax.toLocaleString()}원(${method}). 같은 금액 급여 인출 대비 ${vsSalarySaving.toLocaleString()}원 절감. 법인 감가상각 절감(누적) 약 ${corpTaxSaving.toLocaleString()}원`,
  };
}

// ═══════════════════════════════════════════════════════════
// 이월결손금 공제 — 법인세법 §13
//   이월기간 15년(2020년 이후 발생분; 2009~2019년 10년, 2008년 이전 5년)
//   공제한도: 일반법인 각 사업연도 소득의 80%, 중소기업·회생기업 100%
//   ※ 추계결정 시 공제 불가, 신고·경정된 과세표준 포함분만 인정
// ═══════════════════════════════════════════════════════════
/**
 * 이월결손금 공제 절세
 * @param {Object} params
 * @param {number} params.carryforwardLoss - 이월결손금 잔액(원)
 * @param {number} params.currentIncome    - 당기 각 사업연도 소득(원)
 * @param {boolean} params.isSME           - 중소기업 여부(true=100% 한도)
 */
function calcCarryforwardLoss(params) {
  const { carryforwardLoss = 0, currentIncome = 0, isSME = true, taxYear = new Date().getFullYear(), corpType = 'sme' } = params || {};
  const LOCAL = 1.1;

  const deductLimit = isSME ? currentIncome : Math.floor(currentIncome * 0.8); // 공제한도
  const actualDeduction = Math.max(0, Math.min(carryforwardLoss, deductLimit));  // 실제 공제액
  const taxBaseAfter = currentIncome - actualDeduction;                          // 공제 후 과세표준
  const taxSaving = Math.round(Math.max(0, _corpTax(currentIncome, isSME, taxYear, corpType) - _corpTax(taxBaseAfter, isSME, taxYear, corpType)) * LOCAL); // 법인세 절감(지방포함)
  const remainingLoss = Math.max(0, carryforwardLoss - actualDeduction);         // 잔여 이월결손금

  return {
    carryforwardLoss: Math.round(carryforwardLoss),
    currentIncome: Math.round(currentIncome),
    deductLimit: Math.round(deductLimit),
    actualDeduction: Math.round(actualDeduction),
    taxBaseAfter: Math.round(taxBaseAfter),
    taxSaving,
    remainingLoss: Math.round(remainingLoss),
    limitRate: isSME ? 100 : 80,
    warning: '이월기간 15년(2020년 이후 발생분; 2009~2019년 10년). 공제한도: 일반법인 각 사업연도 소득의 80%, 중소기업·회생기업 100%. 추계결정 시 공제 불가, 신고·경정된 과세표준에 포함된 결손금만 인정.',
    summary: `이월결손금 ${Math.round(carryforwardLoss).toLocaleString()}원 중 ${Math.round(actualDeduction).toLocaleString()}원 공제(${isSME ? '중소기업 100%' : '일반 80%'} 한도) → 과세표준 ${Math.round(currentIncome).toLocaleString()}→${Math.round(taxBaseAfter).toLocaleString()}원, 법인세 ${taxSaving.toLocaleString()}원 절감` + (remainingLoss > 0 ? `, 잔여 ${Math.round(remainingLoss).toLocaleString()}원(향후 15년 내 공제)` : ''),
  };
}

module.exports = {
  calcProfitRetirement,
  calcDifferentialDividend,
  calcInventionCompensation,
  calcPatentCapitalization,
  calcCarryforwardLoss,
  calcCorpVsIndividual,
  calcCorpLiquidation,
  calcVehicleExpense,
  calcEntertainmentLimit,
  calcEmploymentCredit,
  calcRnDCredit,
  calcNomineeTrust,
  calcSocialInsuranceCorp,
  calcWelfareFund,
  calcStockOption,
  calcOverseasAsset,
  calcHoldingCompany,
  calcMergerTax,
  calcFamilyCorpGiftPresumption,
};

},
"./analysis": function(module, exports, require, __filename, __dirname) {
/**
 * JARVIA 기업분석 계산기 모듈
 * 용도: Cloud Functions에서 기업분석 파이프라인 내 계산 결과 제공
 *
 * 세율/공제 기준: 2026년 5월 현재 기준 반영, 실제 적용 전 전문가 확인 필요
 * 모든 함수는 순수 함수 (DOM 의존성 없음, Node.js 환경 실행 가능)
 *
 * 변경 이력:
 *   v3.5 (2026-05-15): calcSMETaxBenefits 추가 정밀화 (통합투자 + 중복 매트릭스)
 *     - 통합투자세액공제(§24) 추가공제율 4% → 3% (일반 중소기업, 국가전략기술만 4%)
 *     - 통합투자세액공제 추가공제 한도 추가 (기본공제의 2배)
 *     - 중복 적용 매트릭스 정확화:
 *         그룹 A (중복불가, 최대 하나): 특별감면(§7), 창업감면(§6), 통합투자(§24)
 *         그룹 B (그룹A와 중복가능): 통합고용(§29의8), R&D(§10)
 *         특별제약: 창업감면 + 통합고용 — 2025.1.1 이후 중복불가
 *
 *   v3.4 (2026-05-15): calcSMETaxBenefits 정밀화
 *     - 고용증대세액공제 §29의7 → 통합고용세액공제 §29의8 전환 (2023.1.1~ 신설, 2025년 이후 §29의7 폐지)
 *     - 공제액 현행 (중소기업 기본공제):
 *         청년 등 우대: 수도권 1,100만 → 1,450만 / 비수도권 1,300만 → 1,550만
 *         일반:         770만 → 수도권 850만, 비수도권 950만
 *     - 사회보험료 세액공제 §30조의4: 2025년 이후 통합고용에 흡수 (별도 적용 0)
 *
 *   v3.3 (2026-05-15): calcSeveranceAdequacy 정밀화
 *     - 임원 퇴직소득 인정 한도 배수 3 → 2 (소득세법 §22 ③, 2020.1.1 이후 현행)
 *     - 한도 산식에 × 1/10 추가 (연봉 환산 후 10% 적용, 법인세법 §44)
 *     - 옛 코드: 월급 × 근속 × 3 (25% 과대 + 옛 배수)
 *     - 새 코드: 연봉 × 1/10 × 근속 × 2 (정확)
 *
 *   v3.2 (2026-05-15): _estimateCorpTax 정밀화
 *     - 법인세 3,000억 초과 24% 분기 추가 (법인세법 §55 ①, 4단계 누진)
 *     - 옛 코드: 3,000억 초과도 21% (대기업 3%p 과소 계산)
 *     - 새 코드: 4단계 (2억/200억/3,000억 경계)
 *
 *   v3.1 (2026-05-15): calcBusinessSuccession 추가 정정
 *     - 매출액 기준 4천억 → 5천억 (조특법 §30조의6, 2023.1.1~)
 *     - 자산총액 5천억 미만 요건 추가 (assetTotal 파라미터, 0이면 미체크)
 *     - 증여자(CEO) 연령 58세 → 60세 (조특법 §30조의6 ①)
 *     - 가업승계 한도 600억 초과분에 일반 증여세 추가 적용
 *     - eligible=false 시 successionSaving = 0 (이전: 잘못된 절감액 표시)
 *
 *   v3.0 (2026-05-15): calcBusinessSuccession 1차 정밀화
 *     - 상속·증여세 지방세 1.1 가산 제거 (9곳) — 국세에는 지방세 없음
 *     - 가업승계 증여특례 공제 5억 → 10억 (조특법 §30조의6)
 *     - 가업승계 증여특례 세율 분기점 30억 → 120억 (조특법 §30조의6, 2024.1.1~)
 *     - 가업상속공제 한도 200/300/500억 → 300/400/600억 (상증법 §18조의2, 2023.1.1~)
 *     - 일반 증여세·상속세에 신고세액공제 3% 적용 (상증법 §69)
 *     - 가업승계 증여특례는 신고세액공제 배제 유지 (조특법 §30조의5 ⑪ 준용)
 *
 * 포함 계산기:
 *  1. 재무비율 종합 분석      (calcFinancialRatios)
 *  2. 중소기업 세제혜택 통합  (calcSMETaxBenefits)
 *  3. 가지급금 종합 분석      (calcDeemedInterestFull)
 *  4. 가업승계 시뮬레이션     (calcBusinessSuccession)
 *  5. 현금흐름 위기 진단      (calcCashFlowRisk)
 *  6. 퇴직금 적정성 분석      (calcSeveranceAdequacy)
 *  7. 업종 평균 비교 분석     (calcIndustryComparison)
 *  8. 정책자금 자격 판단      (calcPolicyFundEligibility)
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// 유틸: 소득세 누진세율 (소득세법 제55조)
// ═══════════════════════════════════════════════════════════
function _incomeTax(taxBase) {
  if (taxBase <= 0) return 0;
  if (taxBase <= 14000000)   return taxBase * 0.06;
  if (taxBase <= 50000000)   return taxBase * 0.15 - 1260000;
  if (taxBase <= 88000000)   return taxBase * 0.24 - 5760000;
  if (taxBase <= 150000000)  return taxBase * 0.35 - 15440000;
  if (taxBase <= 300000000)  return taxBase * 0.38 - 19940000;
  if (taxBase <= 500000000)  return taxBase * 0.40 - 25940000;
  if (taxBase <= 1000000000) return taxBase * 0.42 - 35940000;
  return taxBase * 0.45 - 65940000;
}

// 유틸: 상속·증여세 누진세율 (상속세및증여세법 제26조)
function _giftTax(taxBase) {
  if (taxBase <= 0) return 0;
  if (taxBase <= 100000000)   return taxBase * 0.1;
  if (taxBase <= 500000000)   return taxBase * 0.2 - 10000000;
  if (taxBase <= 1000000000)  return taxBase * 0.3 - 60000000;
  if (taxBase <= 3000000000)  return taxBase * 0.4 - 160000000;
  return taxBase * 0.5 - 460000000;
}

// 유틸: 안전 나눗셈 (0으로 나누기 방지)
function _safeDiv(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}


function _sustainedIncrease(current, prior1, prior2, prior3) {
  return [
    Math.max(0, current - prior1),
    Math.max(0, Math.min(current, prior1) - prior2),
    Math.max(0, Math.min(current, prior1, prior2) - prior3),
  ];
}

// 유틸: 퍼센트 포맷 (소수 둘째자리)
function _pct(value) {
  return Math.round(value * 10000) / 100;
}


// ═══════════════════════════════════════════════════════════
// 1. 재무비율 종합 분석
//    금융위원회 기업재무정보 API 데이터를 입력받아 전체 비율 산출
// ═══════════════════════════════════════════════════════════

/**
 * 재무비율 종합 계산
 * @param {Object} params
 * @param {Object} params.current  - 당기 재무데이터
 * @param {Object} params.previous - 전기 재무데이터 (증가율 계산용, 없으면 {})
 * @param {number} params.employees - 종업원 수
 * @returns {Object} 성장성/수익성/안정성/활동성/현금흐름/생산성 비율
 */
function calcFinancialRatios(params) {
  const {
    current  = {},
    previous = {},
    employees = 0,
    effectiveTaxRate = 0.22,
  } = params || {};

  // ── 당기 데이터 (재무상태표 + 손익계산서) ──
  const c = {
    revenue:          current.revenue          || 0, // 매출액
    cogs:             current.cogs             || 0, // 매출원가
    grossProfit:      current.grossProfit      || 0, // 매출총이익
    operatingProfit:  current.operatingProfit  || 0, // 영업이익
    netIncome:        current.netIncome        || 0, // 당기순이익
    totalAssets:      current.totalAssets      || 0, // 총자산
    totalLiabilities: current.totalLiabilities || 0, // 총부채
    totalEquity:      current.totalEquity      || 0, // 자기자본
    currentAssets:    current.currentAssets     || 0, // 유동자산
    currentLiab:      current.currentLiab      || 0, // 유동부채
    inventory:        current.inventory        || 0, // 재고자산
    receivables:      current.receivables      || 0, // 매출채권
    payables:         current.payables         || 0, // 매입채무
    cash:             current.cash             || 0, // 현금및현금성자산
    shortTermBorrow:  current.shortTermBorrow  || 0, // 단기차입금
    longTermBorrow:   current.longTermBorrow   || 0, // 장기차입금
    interestExpense:  current.interestExpense  || 0, // 이자비용
    depreciation:     current.depreciation     || 0, // 감가상각비
    laborCost:        current.laborCost        || 0, // 인건비(급여+퇴직급여+복리후생비)
    tangibleAssets:   current.tangibleAssets    || 0, // 유형자산
    capex:             Number.isFinite(current.capex) ? current.capex : null, // 자본적지출(미입력 시 기존 추정 유지)
    retainedEarnings: current.retainedEarnings || 0, // 이익잉여금
    capitalStock:     current.capitalStock     || 0, // 자본금
  };

  // ── 전기 데이터 ──
  const p = {
    revenue:         previous.revenue         || 0,
    operatingProfit: previous.operatingProfit || 0,
    netIncome:       previous.netIncome       || 0,
    totalAssets:     previous.totalAssets     || 0,
  };

  // ── 파생값 ──
  const totalBorrowings = c.shortTermBorrow + c.longTermBorrow;

  // ════════════════════════════════════════
  // 성장성 지표
  // ════════════════════════════════════════
  const revenueGrowth = p.revenue > 0
    ? _pct((c.revenue - p.revenue) / p.revenue) : null;
  const opProfitGrowth = p.operatingProfit > 0
    ? _pct((c.operatingProfit - p.operatingProfit) / p.operatingProfit) : null;
  const netIncomeGrowth = p.netIncome > 0
    ? _pct((c.netIncome - p.netIncome) / p.netIncome) : null;
  const assetGrowth = p.totalAssets > 0
    ? _pct((c.totalAssets - p.totalAssets) / p.totalAssets) : null;

  // ════════════════════════════════════════
  // 수익성 지표
  // ════════════════════════════════════════
  const grossMargin       = _pct(_safeDiv(c.grossProfit, c.revenue));
  const operatingMargin   = _pct(_safeDiv(c.operatingProfit, c.revenue));
  const netMargin         = _pct(_safeDiv(c.netIncome, c.revenue));
  const roe               = _pct(_safeDiv(c.netIncome, c.totalEquity));
  const roa               = _pct(_safeDiv(c.netIncome, c.totalAssets));
  // ROIC = NOPAT / 투하자본 (투하자본 = 자기자본 + 총차입금 - 현금)
  const safeEffectiveTaxRate = Number.isFinite(Number(effectiveTaxRate))
    ? Math.min(1, Math.max(0, Number(effectiveTaxRate))) : 0.22;
  const nopat             = c.operatingProfit * (1 - safeEffectiveTaxRate); // 입력 세후율 또는 22% 추정
  const investedCapital   = c.totalEquity + totalBorrowings - c.cash;
  const roic              = _pct(_safeDiv(nopat, investedCapital));

  // ════════════════════════════════════════
  // 안정성 지표
  // ════════════════════════════════════════
  const debtRatio         = _pct(_safeDiv(c.totalLiabilities, c.totalEquity));
  const currentRatio      = _pct(_safeDiv(c.currentAssets, c.currentLiab));
  const quickRatio        = _pct(_safeDiv(c.currentAssets - c.inventory, c.currentLiab));
  const equityRatio       = _pct(_safeDiv(c.totalEquity, c.totalAssets));
  const borrowingDep      = _pct(_safeDiv(totalBorrowings, c.totalAssets));
  const interestCoverage  = c.interestExpense > 0
    ? Math.round(c.operatingProfit / c.interestExpense * 100) / 100 : null; // 배수

  // ════════════════════════════════════════
  // 활동성 지표
  // ════════════════════════════════════════
  const assetTurnover         = Math.round(_safeDiv(c.revenue, c.totalAssets) * 100) / 100;
  const inventoryTurnoverBase = c.cogs > 0 ? c.cogs : c.revenue;
  const inventoryTurnover     = Math.round(_safeDiv(inventoryTurnoverBase, c.inventory) * 100) / 100;
  const receivableTurnover    = Math.round(_safeDiv(c.revenue, c.receivables) * 100) / 100;
  const payableTurnover       = Math.round(_safeDiv(c.cogs, c.payables) * 100) / 100;

  const inventoryDays     = inventoryTurnover > 0 ? Math.round(365 / inventoryTurnover) : null;
  const receivableDays    = receivableTurnover > 0 ? Math.round(365 / receivableTurnover) : null;
  const payableDays       = payableTurnover > 0 ? Math.round(365 / payableTurnover) : null;

  // 현금전환주기 CCC
  const ccc = (inventoryDays !== null && receivableDays !== null && payableDays !== null)
    ? inventoryDays + receivableDays - payableDays : null;

  // ════════════════════════════════════════
  // 현금흐름 (추정)
  // ════════════════════════════════════════
  const estimatedOpCF = c.netIncome + c.depreciation; // 간이 영업CF
  const legacyFcfProxy = estimatedOpCF - (c.tangibleAssets > 0 ? c.depreciation : 0);
  const fcf = c.capex === null ? legacyFcfProxy : estimatedOpCF - c.capex;
  const fcfBasis = c.capex === null ? 'legacyProxyWithoutCapex' : 'operatingCashFlowMinusCapex';

  // ════════════════════════════════════════
  // 생산성 지표
  // ════════════════════════════════════════
  const revenuePerEmployee  = employees > 0 ? Math.round(c.revenue / employees) : null;
  const opProfitPerEmployee = employees > 0 ? Math.round(c.operatingProfit / employees) : null;
  const laborCostRatio      = _pct(_safeDiv(c.laborCost, c.revenue));
  const laborCostPerPerson  = employees > 0 ? Math.round(c.laborCost / employees) : null;

  // ════════════════════════════════════════
  // 자본구조
  // ════════════════════════════════════════
  const retainedToCapital   = _pct(_safeDiv(c.retainedEarnings, c.capitalStock));

  return {
    // 성장성
    growth: {
      revenueGrowth,       // 매출액 증가율 (%)
      opProfitGrowth,      // 영업이익 증가율 (%)
      netIncomeGrowth,     // 순이익 증가율 (%)
      assetGrowth,         // 총자산 증가율 (%)
    },
    // 수익성
    profitability: {
      grossMargin,         // 매출총이익률 (%)
      operatingMargin,     // 영업이익률 (%)
      netMargin,           // 순이익률 (%)
      roe,                 // 자기자본이익률 (%)
      roa,                 // 총자산이익률 (%)
      roic,                // 투하자본수익률 (%)
      effectiveTaxRateUsed: safeEffectiveTaxRate,
    },
    // 안정성
    stability: {
      debtRatio,           // 부채비율 (%)
      currentRatio,        // 유동비율 (%)
      quickRatio,          // 당좌비율 (%)
      equityRatio,         // 자기자본비율 (%)
      borrowingDep,        // 차입금의존도 (%)
      interestCoverage,    // 이자보상배율 (배)
    },
    // 활동성
    activity: {
      assetTurnover,           // 총자산회전율 (회)
      inventoryTurnover,       // 재고자산회전율 (회)
      receivableTurnover,      // 매출채권회전율 (회)
      payableTurnover,         // 매입채무회전율 (회)
      inventoryDays,           // 재고자산 회전일수 (일)
      receivableDays,          // 매출채권 회수일수 (일)
      payableDays,             // 매입채무 지급일수 (일)
      ccc,                     // 현금전환주기 (일)
      inventoryTurnoverBasis: c.cogs > 0 ? 'cogs' : 'revenueFallback',
    },
    // 현금흐름
    cashFlow: {
      estimatedOpCF:  Math.round(estimatedOpCF), // 추정 영업현금흐름
      fcf:            Math.round(fcf),            // 추정 잉여현금흐름
      fcfBasis,
      capex: c.capex === null ? null : Math.round(c.capex),
      warning: c.capex === null ? '자본적지출이 없어 기존 간이 추정값을 유지했습니다.' : null,
    },
    // 생산성
    productivity: {
      revenuePerEmployee,      // 1인당 매출액 (원)
      opProfitPerEmployee,     // 1인당 영업이익 (원)
      laborCostRatio,          // 인건비/매출 비율 (%)
      laborCostPerPerson,      // 1인당 인건비 (원)
    },
    // 자본구조
    capitalStructure: {
      totalBorrowings: Math.round(totalBorrowings),  // 총차입금
      retainedToCapital,                              // 잉여금/자본금 비율 (%)
      retainedEarnings: Math.round(c.retainedEarnings),
      capitalStock:     Math.round(c.capitalStock),
    },
    // 원본 데이터 (AI에게 전달용)
    rawData: {
      revenue:         Math.round(c.revenue),
      operatingProfit: Math.round(c.operatingProfit),
      netIncome:       Math.round(c.netIncome),
      totalAssets:     Math.round(c.totalAssets),
      totalEquity:     Math.round(c.totalEquity),
      totalLiabilities:Math.round(c.totalLiabilities),
      employees,
    },
    calculated: true,
    estimateOnly: c.capex === null || !Number.isFinite(Number(effectiveTaxRate)),
    warnings: [
      ...(c.capex === null ? ['자본적지출이 없어 잉여현금흐름은 간이 추정값입니다.'] : []),
      ...(!Number.isFinite(Number(effectiveTaxRate)) ? ['실효세율 미입력으로 ROIC의 NOPAT에 22% 추정세율을 사용했습니다.'] : []),
      ...(c.cogs <= 0 && c.inventory > 0 ? ['매출원가가 없어 재고회전율에 매출액을 대체 사용했습니다.'] : []),
    ],
  };
}


// ═══════════════════════════════════════════════════════════
// 2. 중소기업 세제혜택 통합 체크
//    (조특법 제7조, 제6조, 제29조의8 [통합고용], 제24조, 제10조)
// ═══════════════════════════════════════════════════════════

/**
 * 중소기업이 받을 수 있는 세제혜택 통합 계산
 * @param {Object} params
 * @param {string}  params.industryCode   - 업종코드 (KSIC 앞2자리, 예: '10'=식품, '25'=금속가공)
 * @param {number}  params.revenue        - 매출액 (원)
 * @param {number}  params.employees      - 종업원 수
 * @param {number}  params.foundedYear    - 설립연도 (예: 2020)
 * @param {boolean} params.isCapitalArea  - 수도권 여부
 * @param {number}  params.operatingProfit - 영업이익 (원)
 * @param {number}  params.investAmount   - 당해 사업용자산 투자액 (원)
 * @param {number}  params.prevInvestAvg  - 직전 3년 평균 투자액 (원, 추가공제용)
 * @param {number}  params.newHires       - 신규 고용 인원
 * @param {number}  params.newYouthHires  - 신규 청년 고용 인원
 * @param {number}  params.rndExpense     - R&D 비용 (원)
 * @param {number}  params.rndType        - R&D 유형: 'self'=자체, 'consign'=위탁, 'coop'=공동
 * @param {number}  params.socialInsurance - 신규고용 사회보험료 사업주 부담분 (원)
 * @param {number}  params.currentYear    - 현재 연도
 * @returns {Object}
 */
function calcSMETaxBenefits(params) {
  const {
    industryCode    = '',
    revenue         = 0,
    employees       = 0,
    foundedYear     = 2000,
    isCapitalArea   = false,
    operatingProfit = 0,
    investAmount    = 0,
    prevInvestAvg   = 0,
    newHires        = 0,
    newYouthHires   = 0,
    rndExpense      = 0,
    rndType         = 'self',
    socialInsurance = 0,
    currentYear     = 2026,
    corpType        = 'sme',   // 'sme'|'general'|'sme_realty'
    startupFounder  = 'general',
    startupRegionType,
    firstIncomeYear,
    currentEmployees,
    prior1Employees,
    prior2Employees,
    prior3Employees,
    currentYouthEmployees,
    prior1YouthEmployees,
    prior2YouthEmployees,
    prior3YouthEmployees,
    rndEligibleConfirmed = false,
  } = params || {};

  const results = [];
  let totalBenefit = 0;

  // ── ① 중소기업 특별세액감면 (조특법 제7조) ──
  // 감면율: 소기업 수도권 20%, 비수도권 30% / 중기업 수도권 0~10%, 비수도권 15%
  // 적용제외 업종: 부동산업, 유흥업 등
  const excludedIndustries = ['68', '91', '92']; // 부동산업, 유흥업
  const isExcluded = excludedIndustries.includes(industryCode.substring(0, 2));

  // 소기업 판단 (업종별 매출 기준)
  const smallBizCriteria = {
    '10': 12000000000, '11': 12000000000, '13': 12000000000, '14': 12000000000, // 제조업류
    '20': 12000000000, '21': 12000000000, '22': 12000000000, '24': 12000000000,
    '25': 12000000000, '26': 12000000000, '27': 12000000000, '28': 12000000000,
    '29': 12000000000, '30': 12000000000, '31': 12000000000, '32': 12000000000,
    '33': 12000000000, // 기타 제조업
    '41': 8000000000,  '42': 8000000000,  // 건설업
    '45': 5000000000,  '46': 5000000000, '47': 5000000000,  // 도소매업
    '49': 5000000000,  '50': 5000000000, '52': 5000000000,  // 운수업
    '55': 5000000000,  '56': 5000000000,  // 숙박음식
    '58': 5000000000,  '62': 5000000000, '63': 5000000000,  // 정보서비스
    '69': 5000000000,  '70': 5000000000, '71': 5000000000,  // 전문서비스
    '72': 5000000000,  '73': 5000000000, '74': 5000000000,
    default: 5000000000,
  };
  const smallCriterion = smallBizCriteria[industryCode.substring(0, 2)] || smallBizCriteria.default;
  const isSmallBiz = revenue <= smallCriterion;

  let smeReductionRate = 0;
  if (!isExcluded) {
    if (isSmallBiz) {
      smeReductionRate = isCapitalArea ? 0.20 : 0.30;
    } else {
      smeReductionRate = isCapitalArea ? 0.10 : 0.15;
    }
  }
  // 감면세액 = 산출세액 × 감면율 (여기서는 영업이익 기준 법인세 추정)
  const estimatedCorpTax = operatingProfit > 0 ? _estimateCorpTax(operatingProfit, currentYear, corpType) : 0;
  const smeReduction = Math.round(estimatedCorpTax * smeReductionRate);

  results.push({
    name: '중소기업 특별세액감면',
    law: '조특법 제7조',
    eligible: !isExcluded && smeReductionRate > 0,
    rate: smeReductionRate * 100 + '%',
    amount: smeReduction,
    note: isSmallBiz ? '소기업 기준 적용' : '중기업 기준 적용',
    canCombine: false, // 다른 감면과 중복 시 선택적용
  });
  if (!isExcluded && smeReduction > 0) totalBenefit += smeReduction;

  // ── ② 창업중소기업 세액감면 (조특법 제6조) ──
  const companyAge = currentYear - foundedYear;
  const benefitStartYear = Number.isFinite(Number(firstIncomeYear)) ? Number(firstIncomeYear) : Number(foundedYear);
  const benefitYear = currentYear - benefitStartYear + 1;
  const withinStartupPeriod = benefitYear >= 1 && benefitYear <= 5;
  const normalizedStartupRegion = startupRegionType
    || (!isCapitalArea ? 'outside' : (Number(foundedYear) >= 2026 ? 'ambiguousCapital' : 'overconcentration'));
  let startupRate = 0;
  let startupEligible = withinStartupPeriod;
  let startupRequiresRegionDetail = false;
  const startupWarnings = [];
  if (!Number.isFinite(Number(firstIncomeYear))) startupWarnings.push('최초 소득 발생연도 미입력으로 설립연도를 감면 시작연도로 사용했습니다.');
  if (withinStartupPeriod) {
    if (Number(foundedYear) <= 2025) {
      startupRate = startupFounder === 'youth'
        ? (normalizedStartupRegion === 'outside' ? 1.00 : 0.50)
        : (normalizedStartupRegion === 'outside' ? 0.50 : 0.00);
    } else if (normalizedStartupRegion === 'ambiguousCapital') {
      startupRequiresRegionDetail = true;
      startupEligible = false;
      startupWarnings.push('2026년 이후 수도권 창업은 수도권 일반지역과 과밀억제권역 구분이 필요합니다.');
    } else if (startupFounder === 'youth') {
      startupRate = normalizedStartupRegion === 'outside' ? 1.00
        : (normalizedStartupRegion === 'capitalGeneral' ? 0.75 : 0.50);
    } else {
      startupRate = normalizedStartupRegion === 'outside' ? 0.50
        : (normalizedStartupRegion === 'capitalGeneral' ? 0.25 : 0.00);
    }
  }
  const startupReduction = startupEligible ? Math.round(estimatedCorpTax * startupRate) : 0;

  results.push({
    name: '창업중소기업 세액감면',
    law: '조특법 제6조',
    eligible: startupEligible,
    rate: startupRate * 100 + '%',
    amount: startupReduction,
    note: startupRequiresRegionDetail
      ? '2026년 이후 수도권 세부지역 구분 필요'
      : (startupEligible
        ? `감면 ${benefitYear}년차, ${normalizedStartupRegion}, ${startupFounder === 'youth' ? '청년' : '일반'} 창업`
        : `감면기간 5년 초과 또는 적용요건 미충족`),
    warnings: startupWarnings,
    requiresRegionDetail: startupRequiresRegionDetail,
    canCombine: false,
  });
  // 창업감면과 특별세액감면은 중복불가 → 큰 쪽만 반영
  // totalBenefit은 나중에 정리

  // ── ③ 통합고용세액공제 (조특법 §29의8) ──
  let youthCreditPerPerson;
  let generalCreditPerPerson;
  let empCredit;
  let empAnnualCredits;
  let employmentEstimateOnly = true;
  const employmentWarnings = [];

  if (Number(currentYear) >= 2026) {
    const youthRates = isCapitalArea ? [7000000, 16000000, 17000000] : [10000000, 19000000, 20000000];
    const generalRates = isCapitalArea ? [4000000, 9000000, 10000000] : [7000000, 12000000, 13000000];
    const historyValues = [currentEmployees, prior1Employees, prior2Employees, prior3Employees,
      currentYouthEmployees, prior1YouthEmployees, prior2YouthEmployees, prior3YouthEmployees].map(Number);
    const hasHistory = historyValues.every(Number.isFinite);
    let totalInc;
    let youthInc;
    if (hasHistory) {
      totalInc = _sustainedIncrease(Number(currentEmployees), Number(prior1Employees), Number(prior2Employees), Number(prior3Employees));
      const rawYouth = _sustainedIncrease(Number(currentYouthEmployees), Number(prior1YouthEmployees), Number(prior2YouthEmployees), Number(prior3YouthEmployees));
      youthInc = rawYouth.map((value, index) => Math.min(value, totalInc[index]));
      employmentEstimateOnly = false;
    } else {
      totalInc = [Math.max(0, newHires), 0, 0];
      youthInc = [Math.min(totalInc[0], Math.max(0, newYouthHires)), 0, 0];
      employmentWarnings.push('2026년 이후 2·3차년도 계산에는 직전 3개 과세연도의 상시근로자 수가 필요하여 1차년도만 계산했습니다.');
    }
    const generalInc = totalInc.map((value, index) => Math.max(0, value - youthInc[index]));
    empAnnualCredits = youthInc.map((value, index) => value * youthRates[index] + generalInc[index] * generalRates[index]);
    empCredit = empAnnualCredits[0];
    youthCreditPerPerson = youthRates[0];
    generalCreditPerPerson = generalRates[0];
  } else {
    youthCreditPerPerson = isCapitalArea ? 14500000 : 15500000;
    generalCreditPerPerson = isCapitalArea ? 8500000 : 9500000;
    const generalHires = Math.max(0, newHires - newYouthHires);
    empCredit = newYouthHires * youthCreditPerPerson + generalHires * generalCreditPerPerson;
    empAnnualCredits = [empCredit, empCredit * 0.75, empCredit * 0.5];
  }

  results.push({
    name: '통합고용세액공제',
    law: '조특법 제29조의8',
    eligible: newHires > 0 || Number(currentEmployees) > Number(prior1Employees),
    rate: null,
    amount: Math.round(empCredit),
    annualCredits: empAnnualCredits.map(Math.round),
    note: `1차년도 청년등 ${youthCreditPerPerson.toLocaleString()}원/명, 일반 ${generalCreditPerPerson.toLocaleString()}원/명 (${isCapitalArea ? '수도권' : '비수도권'})`,
    estimateOnly: employmentEstimateOnly,
    warnings: employmentWarnings,
    canCombine: true,
  });
  if (empCredit > 0) totalBenefit += empCredit;

  // ── ④ 통합투자세액공제 (조특법 제24조) ──
  // 기본공제율 (2026년 현행): 중소기업 10%, 중견기업 3%, 일반기업 1%
  //   - 신성장·원천기술 사업화 시설: 중소 12%, 중견 5%, 일반 3%
  //   - 국가전략기술 사업화 시설: 중소 16%, 중견 8%, 일반 6%
  // 추가공제율: 직전 3년 평균 초과분의 10% (2025.1.1~ 일괄 상향, 종전 3~4%)
  // 추가공제 한도: 기본공제액의 2배
  // 중복 적용 불가: 특별세액감면(§7), 창업감면(§6)
  const investBaseCredit = Math.round(investAmount * 0.10);
  const investExcess = Math.max(0, investAmount - prevInvestAvg);
  const investAddCreditRaw = Math.round(investExcess * 0.10);  // 추가공제율 10% (2025.1.1~)
  const investAddCredit = Math.min(investAddCreditRaw, investBaseCredit * 2);  // 기본공제의 2배 한도
  const investTotalCredit = investBaseCredit + investAddCredit;

  results.push({
    name: '통합투자세액공제',
    law: '조특법 제24조',
    eligible: investAmount > 0,
    rate: '기본10% + 추가10% (한도: 기본의 2배)',
    amount: investTotalCredit,
    note: investAddCredit > 0
      ? `기본 ${investBaseCredit.toLocaleString()}원 + 추가 ${investAddCredit.toLocaleString()}원 (특별감면·창업감면과 중복 불가)`
      : `기본공제만 적용 (3년 평균 초과분 없음)`,
    canCombine: false,  // 특별감면·창업감면과 중복 불가, 통합고용·R&D와는 중복 가능 (그룹 처리)
  });
  if (investTotalCredit > 0) totalBenefit += investTotalCredit;

  // ── ⑤ R&D 세액공제 (조특법 제10조) ──
  // 중소기업 일반 연구·인력개발비 당기분 방식은 적격비용의 25%이다.
  // 자체·위탁·공동 여부는 비용의 적격성 판단 요소이며 공제율 자체를 8%·12%로 낮추는 기준이 아니다.
  const rndRate = 0.25;
  const rndCredit = rndEligibleConfirmed ? Math.round(rndExpense * rndRate) : 0;

  results.push({
    name: '연구인력개발비 세액공제',
    law: '조특법 제10조',
    eligible: rndExpense > 0 && rndEligibleConfirmed,
    rate: rndRate * 100 + '%',
    amount: rndCredit,
    note: rndEligibleConfirmed
      ? `중소기업 일반 연구·인력개발비 당기분 25% (${rndType} 비용의 적격성은 별도 확인)`
      : '연구·인력개발비 적격성 미확인으로 공제액을 계산하지 않음',
    warnings: rndEligibleConfirmed ? [] : ['전담부서·비용구분·위탁연구 범위 등 적격요건 확인이 필요합니다.'],
    canCombine: true,
  });
  if (rndCredit > 0) totalBenefit += rndCredit;

  // ── ⑥ 사회보험료 세액공제 (조특법 제30조의4) ──
  // ※ 2023.1.1 이후 통합고용세액공제(§29의8) 기본공제에 흡수됨
  //    - 2023~2024년: 종전 §29의7 + §30조의4 vs 통합 §29의8 중 선택 적용
  //    - 2025년 이후: 통합 §29의8만 적용 (별도 §30조의4 적용 불가)
  // 본 시뮬레이션은 2025년 이후 기준이므로 별도 항목 처리 안 함 (이미 §29의8에 포함)
  const socialCredit = 0;

  results.push({
    name: '사회보험료 세액공제',
    law: '조특법 제30조의4 (2025년 이후 §29의8 통합고용에 흡수)',
    eligible: false,
    rate: '0% (통합고용에 흡수)',
    amount: 0,
    note: '2025.1.1 이후 별도 적용 불가, 통합고용세액공제(§29의8) 기본공제에 포함',
    canCombine: false,
  });

  // ── 중복적용 정리 (중복 매트릭스) ──
  // ▣ 그룹 A (서로 중복 불가, 최대 하나 선택):
  //    - 중소기업 특별세액감면 §7
  //    - 창업중소기업 세액감면 §6
  //    - 통합투자세액공제 §24
  // ▣ 그룹 B (그룹 A 및 서로 간 중복 가능):
  //    - 통합고용세액공제 §29의8
  //    - R&D 세액공제 §10
  // ▣ 특별 제약: 창업감면(§6) + 통합고용(§29의8): 2025.1.1 이후 중복 불가
  // ▣ 사회보험료(§30조의4): 2025년 이후 통합고용에 흡수 (별도 적용 0)

  // 그룹 A: 가장 큰 혜택 선택
  const groupAOptions = [
    { name: '중소기업 특별세액감면', amount: smeReduction },
    { name: '창업중소기업 세액감면', amount: startupReduction },
    { name: '통합투자세액공제',     amount: investTotalCredit },
  ];
  const bestGroupA = groupAOptions.reduce((best, cur) => cur.amount > best.amount ? cur : best, { name: '', amount: 0 });
  const exclusiveName = bestGroupA.name;
  const bestExclusive = bestGroupA.amount;

  // 그룹 B: 통합고용 + R&D (창업감면 선택 시 2025.1.1 이후 통합고용 제외)
  const empCreditApplied = (currentYear >= 2025 && bestGroupA.name === '창업중소기업 세액감면')
    ? 0  // 창업감면 + 통합고용 중복 불가
    : empCredit;
  const combinableTotal = empCreditApplied + rndCredit + socialCredit;  // socialCredit = 0

  const potentialBenefit = bestExclusive + combinableTotal;
  // 실제 당기 사용액은 산출세액, 최저한세, 이월공제 및 중복배제 확인이 필요하다.
  // 최소한 추정 법인세를 초과하는 금액을 당기 절세액으로 표시하지 않는다.
  const currentYearUsableBenefit = Math.min(Math.max(0, estimatedCorpTax), Math.max(0, potentialBenefit));
  const benefitWarnings = [];
  if (potentialBenefit > estimatedCorpTax && estimatedCorpTax > 0) {
    benefitWarnings.push('잠재 공제·감면액이 추정 법인세를 초과하여 당기 사용 가능액은 추정 법인세 한도로 제한했습니다. 초과분의 이월 여부는 제도별 확인이 필요합니다.');
  }
  benefitWarnings.push('최저한세, 농어촌특별세, 세액공제 이월, 업종·자산·근로자 적격요건은 반영 전이므로 신고 전 전문가 확인이 필요합니다.');

  return {
    items: results,
    estimatedCorpTax: Math.round(estimatedCorpTax),
    bestExclusiveBenefit: {
      name: exclusiveName,
      amount: Math.round(bestExclusive),
    },
    combinableBenefits: Math.round(combinableTotal),
    potentialBenefit: Math.round(potentialBenefit),
    totalBenefit: Math.round(currentYearUsableBenefit),
    currentYearUsableBenefit: Math.round(currentYearUsableBenefit),
    effectiveTaxSaving: estimatedCorpTax > 0
      ? _pct(currentYearUsableBenefit / estimatedCorpTax) : 0,
    isSmallBiz,
    companyAge,
    calculated: true,
    estimateOnly: true,
    warnings: benefitWarnings,
    summary: `추정 법인세 ${Math.round(estimatedCorpTax).toLocaleString()}원 중 당기 사용 가능 추정액 ${Math.round(currentYearUsableBenefit).toLocaleString()}원 (잠재액 ${Math.round(potentialBenefit).toLocaleString()}원; 최저한세·적격요건 확인 필요)`,
  };
}

// 간이 법인세 추정 (법인세법 §55 ①) — 연도 인자 기반
//   ~2025: 2억 9% / 200억 19% / 3,000억 21% / 초과 24%
//   2026~: 2억 10% / 200억 20% / 3,000억 22% / 초과 25% (2025.12 개정, 전 구간 1%p 인상)
//   성실신고 소규모법인(corpType='sme_realty'): 2억 이하 구간 없이 200억 이하 단일세율(19→20%)
function _estimateCorpTax(taxableIncome, taxYear = new Date().getFullYear(), corpType = 'sme') {
  if (taxableIncome <= 0) return 0;
  const y2026 = Number(taxYear) >= 2026;
  if (corpType === 'sme_realty') {
    if (y2026) {
      if (taxableIncome <= 20000000000)  return taxableIncome * 0.20;
      if (taxableIncome <= 300000000000) return 4000000000 + (taxableIncome - 20000000000) * 0.22;
      return 65600000000 + (taxableIncome - 300000000000) * 0.25;
    }
    if (taxableIncome <= 20000000000)  return taxableIncome * 0.19;
    if (taxableIncome <= 300000000000) return 3800000000 + (taxableIncome - 20000000000) * 0.21;
    return 62600000000 + (taxableIncome - 300000000000) * 0.24;
  }
  if (y2026) {
    if (taxableIncome <= 200000000)    return taxableIncome * 0.10;
    if (taxableIncome <= 20000000000)  return 20000000 + (taxableIncome - 200000000) * 0.20;
    if (taxableIncome <= 300000000000) return 3980000000 + (taxableIncome - 20000000000) * 0.22;
    return 65580000000 + (taxableIncome - 300000000000) * 0.25;
  }
  if (taxableIncome <= 200000000)    return taxableIncome * 0.09;
  if (taxableIncome <= 20000000000)  return 18000000 + (taxableIncome - 200000000) * 0.19;
  if (taxableIncome <= 300000000000) return 3780000000 + (taxableIncome - 20000000000) * 0.21;
  return 62580000000 + (taxableIncome - 300000000000) * 0.24;
}


// ═══════════════════════════════════════════════════════════
// 3. 가지급금 종합 분석 (기존 calcDeemedInterest 확장)
//    (법인세법 시행령 제89조, 소득세법 제20조)
// ═══════════════════════════════════════════════════════════

/**
 * 가지급금 종합 분석 — 현황 진단 + 정리 방안별 비교
 * @param {Object} params
 * @param {number} params.loanAmount    - 가지급금 잔액 (원)
 * @param {number} params.actualRate    - 실제 적용 이자율 (0이면 무이자)
 * @param {number} params.deemedRate    - 인정이자율 (기본 4.6%)
 * @param {number} params.ceoSalary     - 대표이사 현재 연봉 (원)
 * @param {number} params.ceoOtherIncome - 대표이사 기타소득 (원)
 * @param {number} params.shareRatio    - 대표이사 지분율 (0~1)
 * @param {number} params.corpTaxableIncome - 법인 과세소득 (원)
 * @returns {Object}
 */
function calcDeemedInterestFull(params) {
  const {
    loanAmount       = 0,
    actualRate       = 0,
    deemedRate       = 0.046,
    ceoSalary        = 0,
    ceoOtherIncome   = 0,
    shareRatio       = 1.0,
    corpTaxableIncome = 0,
    corpType         = 'sme',   // 'sme'|'general'|'sme_realty'
  } = params || {};

  if (![loanAmount, actualRate, deemedRate, ceoSalary, ceoOtherIncome, shareRatio, corpTaxableIncome].every(value => Number.isFinite(Number(value)))) {
    return { calculated: false, missingInputs: [], invalidInputs: ['numericInputs'], warnings: ['가지급금 계산 입력은 유한한 숫자여야 합니다.'] };
  }
  if (loanAmount < 0 || actualRate < 0 || deemedRate < 0 || shareRatio < 0 || shareRatio > 1) {
    return { calculated: false, missingInputs: [], invalidInputs: ['loanAmount/rates/shareRatio'], warnings: ['가지급금 잔액·이자율은 음수가 아니어야 하며 지분율은 0~1이어야 합니다.'] };
  }

  // ── 현황 진단 ──
  const actualInterest = Math.round(loanAmount * actualRate);
  const deemedInterest = Math.round(loanAmount * deemedRate);
  const difference = Math.max(0, deemedInterest - actualInterest);

  // 상여처분 시 세부담 (차액이 대표이사 근로소득에 가산)
  const totalIncome = ceoSalary + ceoOtherIncome + difference;
  const taxOnTotal = _incomeTax(totalIncome) * 1.1; // 지방세 포함
  const taxWithout = _incomeTax(ceoSalary + ceoOtherIncome) * 1.1;
  const additionalIncomeTax = Math.round(taxOnTotal - taxWithout);

  // 4대보험 추가 부담 (상여처분분에 대해 약 9.5% 사업주+근로자 합산)
  const insuranceCap = 120000000; // 건보 상한
  const insurableAmount = Math.min(difference, Math.max(0, insuranceCap - ceoSalary));
  const additionalInsurance = Math.round(insurableAmount * 0.095);

  const annualBurden = additionalIncomeTax + additionalInsurance;

  // ── 정리 방안별 비교 ──

  // 방안1: 급여 분할 상환
  const monthlyRepay = [3000000, 5000000, 8000000, 10000000]; // 월 상환액 시나리오
  const salaryRepayPlans = monthlyRepay.map(monthly => {
    const annualRepay = monthly * 12;
    const years = Math.ceil(loanAmount / annualRepay * 10) / 10;
    // 상환 급여에 대한 소득세 추가분
    const newTotalIncome = ceoSalary + ceoOtherIncome + annualRepay;
    const taxNew = _incomeTax(newTotalIncome) * 1.1;
    const taxOld = _incomeTax(ceoSalary + ceoOtherIncome) * 1.1;
    const additionalTax = Math.round(taxNew - taxOld);
    return {
      monthlyAmount: monthly,
      annualAmount: annualRepay,
      completionYears: years,
      additionalTaxPerYear: additionalTax,
      totalCost: Math.round(additionalTax * years),
    };
  });

  // 방안2: 배당 상계
  const dividendAmount = loanAmount;
  let dividendTax;
  if (dividendAmount <= 20000000) {
    dividendTax = Math.round(dividendAmount * 0.154); // 15.4% 분리과세
  } else {
    // 종합과세: Gross-up (배당가산 11%)
    const grossUp = dividendAmount * 0.11;
    const grossIncome = ceoSalary + ceoOtherIncome + dividendAmount + grossUp;
    dividendTax = Math.round((_incomeTax(grossIncome) - _incomeTax(ceoSalary + ceoOtherIncome)) * 1.1);
  }
  // 배당 전 법인세 (배당재원 = 세후이익이어야 함) — 2026 기본세율 20% 기준 역산
  const corpTaxOnDividend = Math.round(_estimateCorpTax(dividendAmount / (1 - 0.20), undefined, corpType) - _estimateCorpTax(0, undefined, corpType));

  // 방안3: 자기주식 취득 후 소각 (의제배당)
  // 주주에게 취득대가 지급 → 의제배당 과세
  const treasuryDividendTax = dividendTax; // 의제배당 세율은 배당과 동일

  // 방안4: 부동산 현물출자 (대표 → 법인)
  // 양도소득세 + 취득세 발생
  const realEstateTransferTax = Math.round(loanAmount * 0.30); // 양도세 약 30% 추정
  const acquisitionTax = Math.round(loanAmount * 0.046); // 취득세 4.6%
  const realEstateTotalCost = realEstateTransferTax + acquisitionTax;

  // ── 방안별 비교 정리 ──
  const plans = [
    {
      name: '급여 분할상환 (월500만원)',
      totalCost: salaryRepayPlans[1].totalCost,
      duration: salaryRepayPlans[1].completionYears + '년',
      pros: '점진적 정리, 현금흐름 부담 분산',
      cons: '정리기간 중 인정이자 계속 발생',
    },
    {
      name: '배당 상계',
      totalCost: dividendTax,
      duration: '즉시',
      pros: '일시 정리 가능, 배당소득세율이 상여처분보다 낮을 수 있음',
      cons: '배당재원(이익잉여금) 필요, 금융소득종합과세 주의',
    },
    {
      name: '자기주식 취득 후 소각',
      totalCost: treasuryDividendTax,
      duration: '즉시',
      pros: '자본 구조 정리 동시 가능',
      cons: '절차 복잡, 상법상 자기주식 취득 제한',
    },
    {
      name: '부동산 현물출자',
      totalCost: realEstateTotalCost,
      duration: '1~3개월',
      pros: '법인 자산 확충, 감가상각 활용 가능',
      cons: '양도세+취득세 이중부담, 적정 부동산 보유 시만 가능',
    },
  ];

  // 최적안 추천 (비용이 가장 낮은 방안)
  plans.sort((a, b) => a.totalCost - b.totalCost);

  return {
    // 현황 진단
    diagnosis: {
      loanAmount,
      actualRate,
      deemedRate,
      actualInterest:     Math.round(actualInterest),
      deemedInterest:     Math.round(deemedInterest),
      difference:         Math.round(difference),
      additionalIncomeTax,
      additionalInsurance,
      annualBurden,
    },
    // 방안별 비교
    salaryRepayPlans,
    dividendPlan: {
      dividendAmount,
      dividendTax,
      corpTaxOnDividend,
      totalCost: dividendTax,
    },
    treasuryPlan: {
      cost: treasuryDividendTax,
    },
    realEstatePlan: {
      transferTax:    realEstateTransferTax,
      acquisitionTax,
      totalCost:      realEstateTotalCost,
    },
    // 비교 요약
    planComparison: plans,
    recommendation: `추정 최소비용안: ${plans[0].name}`,
    lowestEstimatedCostOption: plans[0].name,
    calculated: true,
    estimateOnly: true,
    warnings: [
      '4대보험 추가부담률 9.5%, 부동산 양도세율 30%, 취득세율 4.6%는 단순 비교용 가정입니다.',
      '배당·자기주식·현물출자는 배당가능이익, 상법 절차, 시가·부당행위계산 및 개인별 종합소득을 확인해야 합니다.',
      '비용이 가장 낮은 안은 자동 추천이 아니라 입력 가정상 추정 최소비용안입니다.',
    ],
    summary: `가지급금 ${loanAmount.toLocaleString()}원 → 연간 추가 세부담 ${annualBurden.toLocaleString()}원 발생 중. 최적 정리방안: ${plans[0].name} (비용 ${plans[0].totalCost.toLocaleString()}원)`,
  };
}


// ═══════════════════════════════════════════════════════════
// 4. 가업승계 시뮬레이션
//    (조특법 제30조의6 가업승계 증여세 과세특례,
//     상증법 제18조 가업상속공제)
// ═══════════════════════════════════════════════════════════

/**
 * 가업승계 시뮬레이션
 * @param {Object} params
 * @param {number} params.netAssets       - 순자산가치 (회사 전체, 원)
 * @param {number} params.earningsValue   - 순손익가치 (회사 전체, 원)
 * @param {string} params.industry        - 업종: 'general' | 'realty'
 * @param {number} params.totalShares     - 총 발행주식수
 * @param {number} params.ceoShares       - 대표 보유 주식수
 * @param {number} params.ceoAge          - 대표 나이
 * @param {number} params.successorAge    - 후계자 나이
 * @param {number} params.yearsInBusiness - 가업 영위 기간 (년)
 * @param {number} params.revenue         - 매출액 (원)
 * @param {number} params.annualGrowth    - 연평균 주식가치 성장률 (예: 0.05 = 5%)
 * @param {number} params.priorGifts      - 10년 내 사전증여 (원)
 * @returns {Object}
 */
function calcBusinessSuccession(params) {
  const {
    netAssets       = 0,
    earningsValue   = 0,
    industry        = 'general',
    totalShares     = 1,
    ceoShares       = 0,
    ceoAge          = 60,
    successorAge    = 30,
    yearsInBusiness = 10,
    revenue         = 0,
    assetTotal      = 0,    // 자산총액 (5천억 미만 요건, 0이면 미체크)
    annualGrowth    = 0.05,
    priorGifts      = 0,
    assetRequirementConfirmed = false,
    businessRequirementConfirmed = false,
  } = params || {};

  if (![netAssets, earningsValue, totalShares, ceoShares, ceoAge, successorAge, yearsInBusiness, revenue, assetTotal, annualGrowth, priorGifts].every(value => Number.isFinite(Number(value)))) {
    return { calculated: false, missingInputs: [], invalidInputs: ['numericInputs'], warnings: ['가업승계 계산 입력은 유한한 숫자여야 합니다.'] };
  }
  if (netAssets < 0 || earningsValue < 0 || totalShares <= 0 || ceoShares < 0 || ceoShares > totalShares || revenue < 0 || assetTotal < 0) {
    return { calculated: false, missingInputs: [], invalidInputs: ['valuation/share/businessInputs'], warnings: ['주식수·지분·재무 입력 범위를 확인해야 합니다.'] };
  }

  // ── 1. 현재 비상장주식 평가 (상증령 제54조) ──
  let ew, aw;
  if (industry === 'realty') { ew = 2; aw = 3; }
  else { ew = 3; aw = 2; }

  // ★ 회사 전체 가치 가중평균
  const totalWeightedValue = (earningsValue * ew + netAssets * aw) / (ew + aw);
  // ★ 주당 가치 = 전체 가중평균 ÷ 총 발행주식수
  const safeTotalShares = Math.max(1, totalShares);
  const weightedValuePerShare = totalWeightedValue / safeTotalShares;
  const floorPerShare = (netAssets * 0.8) / safeTotalShares;
  const perShareValue = Math.max(weightedValuePerShare, floorPerShare);
  // 대표 지분 평가액 = 주당가치 × 대표 보유 주식수
  const ceoSharesValue = perShareValue * ceoShares;
  const totalValuation = perShareValue * safeTotalShares;

  // ── 2. 현재 일반증여 시 증여세 (상증법 §69 신고세액공제 3%) ──
  const giftDeduction = 50000000; // 성인 직계비속 5천만원
  const normalGiftBase = Math.max(0, ceoSharesValue - giftDeduction - priorGifts);
  const _normalCalc = _giftTax(normalGiftBase);
  const normalGiftTax = Math.round(Math.max(0, _normalCalc - _normalCalc * 0.03)); // 신고세액공제 3% 적용 (상속·증여세는 지방세 없음)

  // ── 3. 가업승계 증여 특례 (조특법 §30조의6) ──
  // 요건 (2026-05-15 기준 현행):
  //   - 영위 10년 이상
  //   - 매출액 평균 5천억 미만 (2023.1.1~, 이전 4천억에서 상향)
  //   - 자산총액 5천억 미만 (입력 시 체크, 0이면 미체크)
  //   - 증여자(대표) 60세 이상
  //   - 수증자 18세 이상
  //   - 특례 한도 600억, 10억 공제
  const assetRequirementMet = assetRequirementConfirmed && assetTotal < 500000000000;
  const successionEligible =
    businessRequirementConfirmed &&
    yearsInBusiness >= 10 &&
    revenue < 500000000000 &&
    assetRequirementMet &&
    ceoAge >= 60 &&
    successorAge >= 18;

  const successionLimit = 60000000000; // 600억
  const successionTaxableBase = Math.max(0,
    Math.min(ceoSharesValue, successionLimit) - 1000000000 - priorGifts // 10억 공제 (조특법 §30조의6, 2023.1.1~)
  );
  // 특례세율: 과세표준 120억 이하 10%, 120억 초과 20% (조특법 §30조의6, 2024.1.1~)
  // ※ 가업승계 증여특례는 신고세액공제 배제 (조특법 §30조의5 ⑪ 준용)
  // ※ 상속·증여세는 지방세 부과 없음 (국세만 부과)
  let successionTax = 0;
  let excessGiftTax = 0;  // 600억 한도 초과분에 대한 일반 증여세
  if (successionEligible) {
    // 600억 한도 내: 특례 세율
    if (successionTaxableBase <= 12000000000) {  // 120억
      successionTax = Math.round(successionTaxableBase * 0.10);
    } else {
      successionTax = Math.round(1200000000 + (successionTaxableBase - 12000000000) * 0.20);
    }
    // 600억 초과분: 일반 증여세 추가 (신고세액공제 3% 적용)
    if (ceoSharesValue > successionLimit) {
      const excessBase = Math.max(0, ceoSharesValue - successionLimit - giftDeduction);
      const _excess = _giftTax(excessBase);
      excessGiftTax = Math.round(Math.max(0, _excess - _excess * 0.03));
    }
  }
  const totalSuccessionTax = successionTax + excessGiftTax;
  // eligible=false면 특례 적용 불가 → 절감액 0
  const successionSaving = successionEligible ? (normalGiftTax - totalSuccessionTax) : 0;

  // ── 4. 가업상속공제 시뮬레이션 (상증법 §18조의2) ──
  // 공제한도 (2023.1.1 이후 상속개시분): 10년 이상 300억, 20년 이상 400억, 30년 이상 600억
  // 사후관리 5년 (2023.1.1~, 이전 7년에서 단축)
  let inheritanceDeductionLimit;
  if (yearsInBusiness >= 30) inheritanceDeductionLimit = 60000000000;        // 600억
  else if (yearsInBusiness >= 20) inheritanceDeductionLimit = 40000000000;   // 400억
  else if (yearsInBusiness >= 10) inheritanceDeductionLimit = 30000000000;   // 300억
  else inheritanceDeductionLimit = 0;

  // 상속 시 세금 (공제 전 vs 후) — 신고세액공제 3% 적용, 지방세 없음
  const _itBefore = _giftTax(ceoSharesValue);
  const inheritanceTaxBefore = Math.round(Math.max(0, _itBefore - _itBefore * 0.03));
  const deductedAmount = Math.min(ceoSharesValue, inheritanceDeductionLimit);
  const _itAfter = _giftTax(Math.max(0, ceoSharesValue - deductedAmount));
  const inheritanceTaxAfter = Math.round(Math.max(0, _itAfter - _itAfter * 0.03));
  const inheritanceSaving = inheritanceTaxBefore - inheritanceTaxAfter;

  // ── 5. 미래 주식가치 예측 (5년, 10년 후) — 신고세액공제 3% 적용, 지방세 없음 ──
  const futureValue5y  = Math.round(ceoSharesValue * Math.pow(1 + annualGrowth, 5));
  const futureValue10y = Math.round(ceoSharesValue * Math.pow(1 + annualGrowth, 10));
  const _ft5  = _giftTax(Math.max(0, futureValue5y - giftDeduction));
  const futureTax5y    = Math.round(Math.max(0, _ft5 - _ft5 * 0.03));
  const _ft10 = _giftTax(Math.max(0, futureValue10y - giftDeduction));
  const futureTax10y   = Math.round(Math.max(0, _ft10 - _ft10 * 0.03));

  // ── 6. 단계적 증여 전략 (신고세액공제 3% 적용, 지방세 없음) ──
  // 10년마다 5천만원 공제 활용: 지금 + 10년 후 분할 증여
  const halfShares = Math.floor(ceoShares / 2);
  const halfValue = perShareValue * halfShares;
  const _g1 = _giftTax(Math.max(0, halfValue - giftDeduction));
  const gift1st = Math.round(Math.max(0, _g1 - _g1 * 0.03));
  const futureHalfValue = Math.round(halfValue * Math.pow(1 + annualGrowth, 10));
  const _g2 = _giftTax(Math.max(0, futureHalfValue - giftDeduction));
  const gift2nd = Math.round(Math.max(0, _g2 - _g2 * 0.03));
  const splitTotal = gift1st + gift2nd;
  const splitSaving = normalGiftTax - splitTotal;

  return {
    // 현재 평가
    valuation: {
      perShareValue:   Math.round(perShareValue),
      ceoSharesValue:  Math.round(ceoSharesValue),
      totalValuation:  Math.round(totalValuation),
      ceoShareRatio:   _pct(ceoShares / totalShares),
    },
    // 일반 증여
    normalGift: {
      taxBase:  Math.round(normalGiftBase),
      tax:      normalGiftTax,
    },
    // 가업승계 증여 특례
    succession: {
      eligible:      successionEligible,
      requirements: {
        yearsInBusiness: yearsInBusiness >= 10,
        revenue:         revenue < 500000000000,                                   // 5천억 (현행)
        assetTotal:      assetRequirementMet,
        businessRequirementsConfirmed: businessRequirementConfirmed,
        ceoAge:          ceoAge >= 60,                                              // 60세 (현행)
        successorAge:    successorAge >= 18,
      },
      taxBase:           Math.round(successionTaxableBase),
      tax:               successionTax,                  // 600억 한도 내 특례세
      excessGiftTax:     excessGiftTax,                  // 600억 초과분 일반 증여세
      totalTax:          totalSuccessionTax,             // 합계 (실제 부담 세액)
      saving:            Math.round(successionSaving),   // eligible=false면 0
    },
    // 가업상속공제
    inheritance: {
      deductionLimit: inheritanceDeductionLimit,
      taxBefore:      inheritanceTaxBefore,
      taxAfter:       inheritanceTaxAfter,
      saving:         Math.round(inheritanceSaving),
    },
    // 미래 가치 예측
    futureProjection: {
      growthRate:   annualGrowth * 100 + '%',
      value5y:      futureValue5y,
      tax5y:        futureTax5y,
      value10y:     futureValue10y,
      tax10y:       futureTax10y,
    },
    // 분할 증여 전략
    splitGiftStrategy: {
      firstGift:   { shares: halfShares, value: Math.round(halfValue), tax: gift1st },
      secondGift:  { shares: ceoShares - halfShares, value: futureHalfValue, tax: gift2nd },
      totalTax:    splitTotal,
      savingVsNow: Math.round(splitSaving),
    },
    calculated: true,
    estimateOnly: true,
    warnings: [
      ...(!assetRequirementConfirmed ? ['자산총액 요건이 확인되지 않아 가업승계 증여특례 적격으로 판정하지 않았습니다.'] : []),
      ...(!businessRequirementConfirmed ? ['가업 업종·지분·대표자·수증자·사후관리 등 법정요건이 확인되지 않아 적격으로 판정하지 않았습니다.'] : []),
      '가업상속공제는 가업상속재산 비율, 피상속인·상속인 요건 및 사후관리 조건을 반영하지 않은 한도 시뮬레이션입니다.',
    ],
    summary: successionEligible
      ? `주식가치 ${Math.round(ceoSharesValue).toLocaleString()}원 → 일반증여세 ${normalGiftTax.toLocaleString()}원 / 가업승계특례 ${successionTax.toLocaleString()}원 (절세 ${Math.round(successionSaving).toLocaleString()}원)`
      : `주식가치 ${Math.round(ceoSharesValue).toLocaleString()}원 → 가업승계특례 요건 미충족. 분할증여 시 ${Math.round(splitSaving).toLocaleString()}원 절세 가능`,
  };
}


// ═══════════════════════════════════════════════════════════
// 5. 현금흐름 위기 진단
// ═══════════════════════════════════════════════════════════

/**
 * 현금흐름 위기 진단
 * @param {Object} params
 * @param {number} params.cash             - 현금및현금성자산 (원)
 * @param {number} params.currentAssets    - 유동자산 (원)
 * @param {number} params.currentLiab      - 유동부채 (원)
 * @param {number} params.inventory        - 재고자산 (원)
 * @param {number} params.receivables      - 매출채권 (원)
 * @param {number} params.payables         - 매입채무 (원)
 * @param {number} params.revenue          - 매출액 (원)
 * @param {number} params.cogs             - 매출원가 (원)
 * @param {number} params.monthlyFixedCost - 월 고정비 (원, 없으면 추정)
 * @param {number} params.operatingProfit  - 영업이익 (원)
 * @param {number} params.shortTermBorrow  - 단기차입금 (원)
 * @returns {Object}
 */
function calcCashFlowRisk(params) {
  const {
    cash             = 0,
    currentAssets    = 0,
    currentLiab      = 0,
    inventory        = 0,
    receivables      = 0,
    payables         = 0,
    revenue          = 0,
    cogs             = 0,
    monthlyFixedCost = 0,
    operatingProfit  = 0,
    shortTermBorrow  = 0,
  } = params || {};

  const numericInputs = [cash, currentAssets, currentLiab, inventory, receivables, payables, revenue, cogs, monthlyFixedCost, operatingProfit, shortTermBorrow];
  if (!numericInputs.every(value => Number.isFinite(Number(value)))) {
    return { calculated: false, missingInputs: [], invalidInputs: ['numericInputs'], warnings: ['현금흐름 입력은 유한한 숫자여야 합니다.'] };
  }
  if ([cash, currentAssets, currentLiab, inventory, receivables, payables, revenue, cogs, monthlyFixedCost, shortTermBorrow].some(value => value < 0)) {
    return { calculated: false, missingInputs: [], invalidInputs: ['negativeInputs'], warnings: ['현금흐름의 자산·부채·매출·비용 입력은 음수가 아니어야 합니다.'] };
  }

  // ── 기본 비율 ──
  const currentRatio = _pct(_safeDiv(currentAssets, currentLiab));
  const quickRatio   = _pct(_safeDiv(currentAssets - inventory, currentLiab));
  const netWorkingCapital = currentAssets - currentLiab;

  // ── 회전일수 계산 ──
  const inventoryTurnover  = _safeDiv(cogs > 0 ? cogs : revenue, inventory);
  const receivableTurnover = _safeDiv(revenue, receivables);
  const payableTurnover    = _safeDiv(cogs, payables);

  const inventoryDays  = inventoryTurnover > 0 ? Math.round(365 / inventoryTurnover) : 0;
  const receivableDays = receivableTurnover > 0 ? Math.round(365 / receivableTurnover) : 0;
  const payableDays    = payableTurnover > 0 ? Math.round(365 / payableTurnover) : 0;

  // ── 현금전환주기 CCC ──
  const ccc = inventoryDays + receivableDays - payableDays;

  // ── 현금 보유일수 ──
  // 월 고정비가 없으면 매출원가 기준으로 추정
  const estimatedMonthlyFixed = monthlyFixedCost > 0
    ? monthlyFixedCost
    : Math.max(0, Math.round((revenue - operatingProfit) / 12));
  const dailyFixedCost = estimatedMonthlyFixed / 30;
  const cashCoverDays = dailyFixedCost > 0 ? Math.round(cash / dailyFixedCost) : null;

  // ── 단기상환 압박도 ──
  const shortTermPressure = _pct(_safeDiv(shortTermBorrow, currentAssets));

  // ── 위험 등급 판단 ──
  let riskLevel, riskScore = 0;

  // 유동비율 기반 (가중치 30점)
  if (currentRatio < 80)       riskScore += 30;
  else if (currentRatio < 100) riskScore += 20;
  else if (currentRatio < 150) riskScore += 10;
  else                         riskScore += 0;

  // 당좌비율 기반 (가중치 25점)
  if (quickRatio < 50)       riskScore += 25;
  else if (quickRatio < 80)  riskScore += 15;
  else if (quickRatio < 100) riskScore += 8;
  else                       riskScore += 0;

  // 현금보유일수 기반 (가중치 25점)
  if (cashCoverDays === null)  riskScore += 0;
  else if (cashCoverDays < 15) riskScore += 25;
  else if (cashCoverDays < 30) riskScore += 15;
  else if (cashCoverDays < 60) riskScore += 8;
  else                         riskScore += 0;

  // CCC 기반 (가중치 20점)
  if (ccc > 120)      riskScore += 20;
  else if (ccc > 90)  riskScore += 12;
  else if (ccc > 60)  riskScore += 6;
  else                riskScore += 0;

  if (riskScore >= 70)      riskLevel = '위험';
  else if (riskScore >= 45) riskLevel = '경고';
  else if (riskScore >= 25) riskLevel = '주의';
  else                      riskLevel = '안전';

  // ── 월별 자금수지 시뮬레이션 (향후 6개월, 현 추세 유지 가정) ──
  const monthlyRevenue = Math.round(revenue / 12);
  const monthlyCost    = estimatedMonthlyFixed;
  const monthlyNet     = monthlyRevenue - monthlyCost;

  const cashProjection = [];
  let runningCash = cash;
  for (let m = 1; m <= 6; m++) {
    runningCash += monthlyNet;
    cashProjection.push({
      month: m,
      projectedCash: Math.round(runningCash),
      isNegative: runningCash < 0,
    });
  }

  // 현금 고갈 시점
  let depletionMonth = null;
  if (monthlyNet < 0) {
    depletionMonth = Math.ceil(cash / Math.abs(monthlyNet));
  }

  return {
    ratios: {
      currentRatio,
      quickRatio,
      netWorkingCapital: Math.round(netWorkingCapital),
    },
    turnover: {
      inventoryDays,
      receivableDays,
      payableDays,
      ccc,
    },
    cashAnalysis: {
      cash:              Math.round(cash),
      monthlyFixedCost:  Math.round(estimatedMonthlyFixed),
      cashCoverDays,
      shortTermBorrow:   Math.round(shortTermBorrow),
      shortTermPressure,
    },
    risk: {
      score:    riskScore,
      level:    riskLevel,
      factors: [
        { name: '유동비율', value: currentRatio + '%', status: currentRatio >= 150 ? '양호' : currentRatio >= 100 ? '보통' : '위험' },
        { name: '당좌비율', value: quickRatio + '%', status: quickRatio >= 100 ? '양호' : quickRatio >= 80 ? '보통' : '위험' },
        { name: '현금보유일수', value: cashCoverDays === null ? '산정불가' : cashCoverDays + '일', status: cashCoverDays === null ? '미확인' : cashCoverDays >= 60 ? '양호' : cashCoverDays >= 30 ? '보통' : '위험' },
        { name: '현금전환주기', value: ccc + '일', status: ccc <= 60 ? '양호' : ccc <= 90 ? '보통' : '위험' },
      ],
    },
    projection: {
      monthlyNet:      Math.round(monthlyNet),
      cashProjection,
      depletionMonth,
    },
    calculated: true,
    estimateOnly: monthlyFixedCost <= 0,
    warnings: monthlyFixedCost <= 0 ? ['월 고정비 미입력으로 매출액과 영업이익의 차액을 월 비용으로 추정했습니다.'] : [],
    summary: `유동성 위험등급: ${riskLevel} (${riskScore}점/100점). 현금보유 ${cashCoverDays === null ? '산정불가' : cashCoverDays + '일'}, CCC ${ccc}일.${depletionMonth ? ` 현 추세 시 약 ${depletionMonth}개월 후 현금 고갈 위험.` : ''}`,
  };
}


// ═══════════════════════════════════════════════════════════
// 6. 퇴직금 적정성 분석
//    (근로기준법 제34조, 근로자퇴직급여보장법, 법인세법 시행령 제44조)
// ═══════════════════════════════════════════════════════════

/**
 * 퇴직금 적정성 분석
 * @param {Object} params
 * @param {number} params.severanceReserve  - 퇴직급여충당부채 (원)
 * @param {number} params.numExecutives     - 임원 수
 * @param {number} params.numEmployees      - 직원 수
 * @param {number} params.avgYearsService   - 평균 근속년수
 * @param {number} params.avgSalary         - 직원 평균 월급여 (원)
 * @param {number} params.executiveAvgSalary - 임원 평균 월급여 (원)
 * @param {number} params.executiveAvgYears - 임원 평균 근속년수
 * @param {number} params.charterMultiplier - 정관 규정 배수 (없으면 0)
 * @param {number} params.annualSalaryIncrease - 연평균 급여인상률 (예: 0.03)
 * @returns {Object}
 */
function calcSeveranceAdequacy(params) {
  const {
    severanceReserve    = 0,
    numExecutives       = 0,
    numEmployees        = 0,
    avgYearsService     = 0,
    avgSalary           = 0,
    executiveAvgSalary  = 0,
    executiveAvgYears   = 0,
    charterMultiplier   = 0,
    annualSalaryIncrease = 0.03,
    taxYear = 2026,
    confirmedMarginalCorpTaxRate,
  } = params || {};

  const severanceInputs = [severanceReserve, numExecutives, numEmployees, avgYearsService, avgSalary, executiveAvgSalary, executiveAvgYears, charterMultiplier, annualSalaryIncrease];
  if (!severanceInputs.every(value => Number.isFinite(Number(value))) || severanceInputs.slice(0, 8).some(value => value < 0) || annualSalaryIncrease <= -1) {
    return { calculated: false, missingInputs: [], invalidInputs: ['severanceInputs'], warnings: ['퇴직금 입력값의 숫자·범위를 확인해야 합니다.'] };
  }

  // ── 직원 법정 퇴직금 필요액 ──
  // 퇴직금 = 30일분 평균임금 × 근속년수
  const employeeSeveranceNeed = numEmployees * avgSalary * avgYearsService;

  // ── 임원 퇴직금 ──
  // 법인세법 시행령 §44 (손금산입 한도):
  //   - 정관 규정 있음: 정관 금액 손금산입
  //   - 정관 규정 없음: 1년간 총급여 × 1/10 × 근속연수
  // 소득세법 §22 ③ (퇴직소득 인정 한도):
  //   - 2011.12.31 이전: 배수 없음
  //   - 2012.1.1~2019.12.31: 3년평균 연급여 × 1/10 × 근속 × 3배
  //   - 2020.1.1 이후 (현행): 3년평균 연급여 × 1/10 × 근속 × 2배
  // ※ executiveAvgSalary는 월급여로 가정 → 연봉 = × 12
  let executiveSeveranceNeed;
  let executiveTaxLimit;
  const executiveAnnualSalary = executiveAvgSalary * 12;

  if (charterMultiplier > 0) {
    // 정관 규정 있음: 필요액 = 정관 배수 × 월급 × 근속 (간편 계산)
    executiveSeveranceNeed = numExecutives * executiveAvgSalary * executiveAvgYears * charterMultiplier;
    // 세법 한도 = 연봉 × 1/10 × 근속 × 2배 (소득세법 §22 ③, 2020.1.1 이후)
    executiveTaxLimit = numExecutives * executiveAnnualSalary * 0.10 * executiveAvgYears * 2;
  } else {
    // 정관 규정 없음: 법인세법 한도 = 연봉 × 1/10 × 근속 (배수 없음)
    executiveSeveranceNeed = numExecutives * executiveAnnualSalary * 0.10 * executiveAvgYears;
    executiveTaxLimit = executiveSeveranceNeed;
  }

  // 세법 한도 초과분 → 손금불산입
  const excessOverLimit = Math.max(0, executiveSeveranceNeed - executiveTaxLimit);
  const marginalRate = Number.isFinite(Number(confirmedMarginalCorpTaxRate))
    ? Math.min(1, Math.max(0, Number(confirmedMarginalCorpTaxRate)))
    : null;
  const nonDeductibleTax = marginalRate === null ? null : Math.round(excessOverLimit * marginalRate);

  // ── 총 퇴직금 필요액 ──
  const totalNeed = employeeSeveranceNeed + executiveSeveranceNeed;
  const adequacyRatio = totalNeed > 0
    ? Math.round(severanceReserve / totalNeed * 100) : 0;
  const shortfall = Math.max(0, totalNeed - severanceReserve);

  // ── DC vs DB 비교 ──
  // DB(확정급여): 회사가 퇴직 시 일시금 부담, 시장 리스크 회사 부담
  // DC(확정기여): 연간 임금총액의 1/12 이상을 매년 불입
  const totalAnnualSalary = (numEmployees * avgSalary * 12) + (numExecutives * executiveAvgSalary * 12);
  const dcAnnualCost = Math.round(totalAnnualSalary / 12); // 1/12

  // DB 유지 시 향후 5년 누적 비용 추정 (급여 인상 반영)
  let dbCumulative = 0;
  let dcCumulative = 0;
  const projection = [];
  for (let y = 1; y <= 5; y++) {
    const growthFactor = Math.pow(1 + annualSalaryIncrease, y);
    // DB: 근속 1년 추가분 × 퇴직시점 급여 (인상 반영)
    const dbYearly = Math.round((numEmployees * avgSalary + numExecutives * executiveAvgSalary) * growthFactor);
    const dcYearly = Math.round(dcAnnualCost * growthFactor);
    dbCumulative += dbYearly;
    dcCumulative += dcYearly;
    projection.push({
      year: y,
      dbAnnual: dbYearly,
      dcAnnual: dcYearly,
      dbCumulative: Math.round(dbCumulative),
      dcCumulative: Math.round(dcCumulative),
    });
  }

  const dbDcDiff = Math.abs(dbCumulative - dcCumulative);
  const dbVsDc = dbDcDiff < 1
    ? '동일 추정(추가정보 필요)'
    : (dbCumulative > dcCumulative ? 'DC유리' : 'DB유리');

  return {
    employee: {
      count:   numEmployees,
      avgSalary,
      avgYears: avgYearsService,
      need:    Math.round(employeeSeveranceNeed),
    },
    executive: {
      count:            numExecutives,
      avgSalary:        executiveAvgSalary,
      avgYears:         executiveAvgYears,
      charterMultiplier,
      need:             Math.round(executiveSeveranceNeed),
      taxLimit:         Math.round(executiveTaxLimit),
      excessOverLimit:  Math.round(excessOverLimit),
      nonDeductibleTax,
      taxEffectCalculated: nonDeductibleTax !== null,
    },
    adequacy: {
      totalNeed:       Math.round(totalNeed),
      currentReserve:  Math.round(severanceReserve),
      adequacyRatio,   // %
      shortfall:       Math.round(shortfall),
    },
    dbVsDc: {
      dcAnnualCost: Math.round(dcAnnualCost),
      projection,
      recommendation: dbVsDc,
      difference5y:   Math.round(dbDcDiff),
      comparisonLimit: 'DB·DC의 운용수익률, 임금상승, 퇴직시점 및 수수료를 입력하지 않은 단순 부담액 비교입니다.',
    },
    calculated: true,
    estimateOnly: !Number.isFinite(Number(confirmedMarginalCorpTaxRate)),
    warnings: [
      'DB·DC 비교는 운용수익률·퇴직시점·수수료가 없어 제도 유불리를 확정할 수 없습니다.',
      ...(!Number.isFinite(Number(confirmedMarginalCorpTaxRate)) ? ['세법한도 초과분의 법인세 영향은 확인된 한계세율이 없어 계산하지 않았습니다.'] : []),
    ],
    summary: `퇴직급여 적립률 ${adequacyRatio}% (필요 ${Math.round(totalNeed).toLocaleString()}원 / 적립 ${Math.round(severanceReserve).toLocaleString()}원). 부족액 ${Math.round(shortfall).toLocaleString()}원.${excessOverLimit > 0 ? ` 임원퇴직금 세법한도 초과 ${Math.round(excessOverLimit).toLocaleString()}원${nonDeductibleTax === null ? ' (세액은 한계세율 확인 필요).' : ` → 추가 법인세 ${nonDeductibleTax.toLocaleString()}원.`}` : ''} 향후 5년 ${dbVsDc} (차이 ${Math.round(dbDcDiff).toLocaleString()}원).`,
  };
}


// ═══════════════════════════════════════════════════════════
// 7. 업종 평균 비교 분석
//    ECOS/KOSIS 업종별 평균 데이터와 개별 기업 비율 비교
// ═══════════════════════════════════════════════════════════

/**
 * 업종 평균 비교 분석
 * @param {Object} params
 * @param {Object} params.companyRatios  - 기업 재무비율 (calcFinancialRatios 출력)
 * @param {Object} params.industryAvg   - 업종 평균 비율
 * @param {string} params.industryName  - 업종명
 * @returns {Object}
 */
function calcIndustryComparison(params) {
  const {
    companyRatios = {},
    industryAvg   = {},
    industryName  = '',
  } = params || {};

  if (!companyRatios || typeof companyRatios !== 'object' || !industryAvg || typeof industryAvg !== 'object') {
    return { calculated: false, missingInputs: [], invalidInputs: ['companyRatios/industryAvg'], warnings: ['기업비율과 업종평균은 객체여야 합니다.'] };
  }

  // 비교 항목 정의 (항목명, 기업값, 업종평균, 높을수록 좋은지)
  const compareItems = [
    // 수익성
    { category: '수익성', name: '매출총이익률',   company: companyRatios.profitability?.grossMargin,     avg: industryAvg.grossMargin,     higherBetter: true },
    { category: '수익성', name: '영업이익률',     company: companyRatios.profitability?.operatingMargin, avg: industryAvg.operatingMargin, higherBetter: true },
    { category: '수익성', name: '순이익률',       company: companyRatios.profitability?.netMargin,       avg: industryAvg.netMargin,       higherBetter: true },
    { category: '수익성', name: 'ROE',            company: companyRatios.profitability?.roe,             avg: industryAvg.roe,             higherBetter: true },
    { category: '수익성', name: 'ROA',            company: companyRatios.profitability?.roa,             avg: industryAvg.roa,             higherBetter: true },
    // 안정성
    { category: '안정성', name: '부채비율',       company: companyRatios.stability?.debtRatio,           avg: industryAvg.debtRatio,       higherBetter: false },
    { category: '안정성', name: '유동비율',       company: companyRatios.stability?.currentRatio,        avg: industryAvg.currentRatio,    higherBetter: true },
    { category: '안정성', name: '자기자본비율',   company: companyRatios.stability?.equityRatio,         avg: industryAvg.equityRatio,     higherBetter: true },
    { category: '안정성', name: '차입금의존도',   company: companyRatios.stability?.borrowingDep,        avg: industryAvg.borrowingDep,    higherBetter: false },
    { category: '안정성', name: '이자보상배율',   company: companyRatios.stability?.interestCoverage,    avg: industryAvg.interestCoverage, higherBetter: true },
    // 활동성
    { category: '활동성', name: '총자산회전율',   company: companyRatios.activity?.assetTurnover,        avg: industryAvg.assetTurnover,   higherBetter: true },
    { category: '활동성', name: '매출채권회수일수', company: companyRatios.activity?.receivableDays,     avg: industryAvg.receivableDays,  higherBetter: false },
    { category: '활동성', name: '재고회전일수',   company: companyRatios.activity?.inventoryDays,        avg: industryAvg.inventoryDays,   higherBetter: false },
    // 생산성
    { category: '생산성', name: '1인당매출액',    company: companyRatios.productivity?.revenuePerEmployee,  avg: industryAvg.revenuePerEmployee,  higherBetter: true },
    { category: '생산성', name: '인건비/매출비율', company: companyRatios.productivity?.laborCostRatio,     avg: industryAvg.laborCostRatio,     higherBetter: false },
  ];

  // 각 항목별 편차 및 등급 계산
  const comparisons = compareItems.map(item => {
    const company = item.company;
    const avg = item.avg;

    if (company == null || avg == null || avg === 0) {
      return { ...item, deviation: null, grade: '데이터없음', status: 'unknown' };
    }

    // 편차율 (%) = (기업 - 평균) / 평균 × 100
    const deviation = Math.round((company - avg) / Math.abs(avg) * 100 * 10) / 10;

    // 등급 판정
    let grade, status;
    const effectiveDeviation = item.higherBetter ? deviation : -deviation;

    if (effectiveDeviation >= 30)       { grade = '매우우수'; status = 'excellent'; }
    else if (effectiveDeviation >= 10)  { grade = '우수';     status = 'good'; }
    else if (effectiveDeviation >= -10) { grade = '보통';     status = 'average'; }
    else if (effectiveDeviation >= -30) { grade = '미흡';     status = 'below'; }
    else                                { grade = '취약';     status = 'weak'; }

    return {
      category: item.category,
      name:     item.name,
      company,
      industryAvg: avg,
      deviation,
      grade,
      status,
    };
  });

  // 카테고리별 요약
  const categories = ['수익성', '안정성', '활동성', '생산성'];
  const categorySummary = categories.map(cat => {
    const items = comparisons.filter(c => c.category === cat && c.status !== 'unknown');
    const grades = items.map(i => {
      if (i.status === 'excellent') return 5;
      if (i.status === 'good') return 4;
      if (i.status === 'average') return 3;
      if (i.status === 'below') return 2;
      return 1;
    });
    const avgGrade = grades.length > 0
      ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10
      : null;

    let categoryGrade;
    if (avgGrade === null) categoryGrade = '데이터없음';
    else if (avgGrade >= 4.0) categoryGrade = '우수';
    else if (avgGrade >= 3.0) categoryGrade = '보통';
    else if (avgGrade >= 2.0) categoryGrade = '미흡';
    else categoryGrade = '취약';

    return { category: cat, avgScore: avgGrade, grade: categoryGrade };
  });

  // 강점/약점 분류
  const strengths = comparisons.filter(c => c.status === 'excellent' || c.status === 'good');
  const weaknesses = comparisons.filter(c => c.status === 'below' || c.status === 'weak');

  // 종합점수 (100점 만점)
  const allGrades = comparisons.filter(c => c.status !== 'unknown');
  const totalScore = allGrades.length > 0
    ? Math.round(allGrades.reduce((sum, c) => {
        if (c.status === 'excellent') return sum + 100;
        if (c.status === 'good')      return sum + 75;
        if (c.status === 'average')   return sum + 50;
        if (c.status === 'below')     return sum + 25;
        return sum + 0;
      }, 0) / allGrades.length)
    : null;

  return {
    industryName,
    comparisons,
    categorySummary,
    strengths: strengths.map(s => s.name),
    weaknesses: weaknesses.map(w => w.name),
    totalScore,
    calculated: allGrades.length > 0,
    missingInputs: allGrades.length > 0 ? [] : ['companyRatios/industryAvg'],
    warnings: allGrades.length > 0 ? [] : ['비교 가능한 기업비율 또는 업종평균 데이터가 없습니다.'],
    summary: allGrades.length > 0 ? `업종(${industryName}) 대비 종합 ${totalScore}점. 강점: ${strengths.map(s => s.name).join(', ') || '없음'}. 약점: ${weaknesses.map(w => w.name).join(', ') || '없음'}.` : `업종(${industryName}) 비교 데이터가 부족합니다.`,
  };
}


// ═══════════════════════════════════════════════════════════
// 8. 정책자금 자격 판단
//    (중소기업기본법 시행령 제3조 별표1 — 업종별 매출기준)
// ═══════════════════════════════════════════════════════════

/**
 * 정책자금 자격 판단
 * @param {Object} params
 * @param {string} params.industryCode  - 업종코드 (KSIC 앞2자리)
 * @param {number} params.revenue       - 매출액 (원)
 * @param {number} params.employees     - 종업원 수
 * @param {number} params.foundedYear   - 설립연도
 * @param {number} params.totalAssets   - 총자산 (원)
 * @param {boolean} params.isCapitalArea - 수도권 여부
 * @param {number} params.ceoAge        - 대표자 나이
 * @param {number} params.exportAmount  - 수출실적 (원)
 * @param {boolean} params.isVenture    - 벤처기업확인서 보유 여부
 * @param {number} params.currentYear   - 현재 연도
 * @returns {Object}
 */
function calcPolicyFundEligibility(params) {
  const {
    industryCode   = '',
    revenue        = 0,
    employees      = 0,
    foundedYear    = 2000,
    totalAssets    = 0,
    isCapitalArea  = false,
    ceoAge         = 50,
    exportAmount   = 0,
    isVenture      = false,
    currentYear    = 2026,
  } = params || {};

  if (![revenue, employees, foundedYear, totalAssets, ceoAge, exportAmount, currentYear].every(value => Number.isFinite(Number(value)))) {
    return { calculated: false, missingInputs: [], invalidInputs: ['numericInputs'], warnings: ['정책자금 사전판정 입력은 유한한 숫자여야 합니다.'] };
  }
  if (revenue < 0 || employees < 0 || totalAssets < 0 || exportAmount < 0 || foundedYear > currentYear) {
    return { calculated: false, missingInputs: [], invalidInputs: ['inputRanges'], warnings: ['정책자금 사전판정 입력 범위를 확인해야 합니다.'] };
  }

  const companyAge = currentYear - foundedYear;
  const code2 = industryCode.substring(0, 2);

  // ── 중소기업 판단 (중소기업기본법 시행령 별표1) ──
  // 업종별 평균매출액 기준 (3년 평균, 원)
  const smeCriteria = {
    // 제조업
    '10': 150000000000, '11': 150000000000, '12': 150000000000,
    '13': 150000000000, '14': 150000000000, '15': 150000000000,
    '16': 150000000000, '17': 150000000000, '18': 150000000000,
    '19': 150000000000, '20': 150000000000, '21': 150000000000,
    '22': 150000000000, '23': 150000000000, '24': 150000000000,
    '25': 150000000000, '26': 150000000000, '27': 150000000000,
    '28': 150000000000, '29': 150000000000, '30': 150000000000,
    '31': 150000000000, '32': 150000000000, '33': 150000000000,
    // 건설업
    '41': 100000000000, '42': 100000000000,
    // 도소매업
    '45': 100000000000, '46': 100000000000, '47': 100000000000,
    // 운수/창고
    '49': 80000000000, '50': 80000000000, '52': 80000000000,
    // 숙박/음식
    '55': 40000000000, '56': 40000000000,
    // 정보통신
    '58': 80000000000, '59': 80000000000, '60': 80000000000,
    '61': 80000000000, '62': 80000000000, '63': 80000000000,
    // 전문/과학/기술
    '69': 60000000000, '70': 60000000000, '71': 60000000000,
    '72': 60000000000, '73': 60000000000, '74': 60000000000,
    // 사업서비스
    '75': 40000000000, '76': 40000000000,
    // 교육
    '85': 40000000000,
    // 보건
    '86': 60000000000, '87': 60000000000,
    // 예술/스포츠
    '90': 40000000000, '91': 40000000000,
    // 수리/기타
    '95': 40000000000, '96': 40000000000,
  };

  const smeCriterion = smeCriteria[code2] || 60000000000; // 기본 600억
  const isSME = revenue <= smeCriterion && totalAssets <= 500000000000; // 자산 5천억 미만

  // ── 소기업 판단 ──
  const smallBizCriteria = {
    '10': 12000000000, '11': 12000000000, '13': 12000000000, '14': 12000000000,
    '20': 12000000000, '21': 12000000000, '22': 12000000000, '24': 12000000000,
    '25': 12000000000, '26': 12000000000, '27': 12000000000, '28': 12000000000,
    '29': 12000000000, '30': 12000000000, '31': 12000000000, '32': 12000000000,
    '33': 12000000000, // 제조업
    '41': 8000000000,  '42': 8000000000,  // 건설업
    '45': 5000000000,  '46': 5000000000, '47': 5000000000,  // 도소매
    default: 5000000000,
  };
  const smallCriterion = smallBizCriteria[code2] || smallBizCriteria.default;
  const isSmallBiz = revenue <= smallCriterion;

  // ── 창업기업 여부 ──
  const isStartup = companyAge <= 7;
  const isEarlyStartup = companyAge <= 3;

  // ── 신청 가능한 정책자금 분류 ──
  const eligibleFunds = [];

  // 1. 중진공 정책자금 — 혁신성장지원
  if (isSME) {
    eligibleFunds.push({
      name: '혁신성장지원자금',
      provider: '중소벤처기업진흥공단',
      limit: '최대 100억원',
      rate: '정책자금 기준금리 (연 2~3%대)',
      eligible: true,
      priority: isVenture ? '벤처기업 우대' : '일반',
      note: '시설자금 및 운전자금',
    });
  }

  // 2. 중진공 — 긴급경영안정자금
  if (isSME) {
    eligibleFunds.push({
      name: '긴급경영안정자금',
      provider: '중소벤처기업진흥공단',
      limit: '최대 7억원',
      rate: '정책자금 기준금리',
      eligible: true,
      priority: '일반',
      note: '경영애로 해소 목적',
    });
  }

  // 3. 창업기업지원자금
  if (isSME && isStartup) {
    eligibleFunds.push({
      name: '창업기업지원자금',
      provider: '중소벤처기업진흥공단',
      limit: '최대 100억원',
      rate: '정책자금 기준금리 (창업 3년 이내 0.3%p 우대)',
      eligible: true,
      priority: isEarlyStartup ? '초기창업 우대' : '일반 창업',
      note: '설립 7년 이내 기업',
    });
  }

  // 4. 청년창업지원
  if (isSME && isStartup && ceoAge <= 39) {
    eligibleFunds.push({
      name: '청년전용 창업자금',
      provider: '중소벤처기업진흥공단',
      limit: '최대 1억원',
      rate: '연 2%대 (고정)',
      eligible: true,
      priority: '청년 우대',
      note: '만 39세 이하 대표',
    });
  }

  // 5. 신용보증기금 보증
  if (isSME) {
    eligibleFunds.push({
      name: '신용보증부 대출',
      provider: '신용보증기금',
      limit: '최대 30억원 (보증비율 85~100%)',
      rate: '은행금리 (보증료 연 0.5~1.5%)',
      eligible: true,
      priority: isSmallBiz ? '소기업 우대보증' : '일반보증',
      note: '담보 부족 시 활용',
    });
  }

  // 6. 기술보증기금
  if (isSME) {
    eligibleFunds.push({
      name: '기술보증부 대출',
      provider: '기술보증기금',
      limit: '최대 30억원',
      rate: '은행금리 (보증료 연 0.5~2.0%)',
      eligible: true,
      priority: isVenture ? '벤처기업 우대' : '일반',
      note: '기술력 기반 보증',
    });
  }

  // 7. 수출기업 글로벌화
  if (isSME && exportAmount > 0) {
    eligibleFunds.push({
      name: '수출기업 글로벌화자금',
      provider: '중소벤처기업진흥공단',
      limit: '최대 100억원',
      rate: '정책자금 기준금리',
      eligible: true,
      priority: exportAmount >= 1000000000 ? '수출유공 우대' : '일반',
      note: `수출실적 ${Math.round(exportAmount / 100000000)}억원`,
    });
  }

  // 8. 소상공인 지원: 광업·제조업·건설업·운수업은 상시근로자 10명 미만, 그 밖은 5명 미만.
  const tenEmployeeIndustries = new Set([
    '05','06','07','08','09',
    '10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34',
    '41','42','49','50','51','52'
  ]);
  const smallBusinessEmployeeLimit = tenEmployeeIndustries.has(code2) ? 10 : 5;
  const meetsSmallBusinessEmployeeLimit = employees < smallBusinessEmployeeLimit;
  if (isSmallBiz && meetsSmallBusinessEmployeeLimit) {
    eligibleFunds.push({
      name: '소상공인 정책자금',
      provider: '소상공인시장진흥공단',
      limit: '최대 7천만원 (직접대출)',
      rate: '연 2~3%대',
      eligible: true,
      priority: '소상공인',
      note: `상시근로자 ${smallBusinessEmployeeLimit}명 미만 기준 적용`,
    });
  }

  return {
    classification: {
      isSME,
      isSmallBiz,
      isStartup,
      isEarlyStartup,
      isVenture,
      companyAge,
      smeCriterion:  Math.round(smeCriterion),
      revenue:       Math.round(revenue),
      totalAssets:   Math.round(totalAssets),
    },
    eligibleFunds,
    totalOptions: eligibleFunds.length,
    summary: `${isSME ? '중소기업' : '중소기업 기준 초과'} (${isSmallBiz ? '소기업' : '중기업'}), 설립 ${companyAge}년차${isVenture ? ', 벤처기업' : ''}. 신청가능 정책자금 ${eligibleFunds.length}건.`,
  };
}


// ═══════════════════════════════════════════════════════════
// exports
// ═══════════════════════════════════════════════════════════
module.exports = {
  calcFinancialRatios,
  calcSMETaxBenefits,
  calcDeemedInterestFull,
  calcBusinessSuccession,
  calcCashFlowRisk,
  calcSeveranceAdequacy,
  calcIndustryComparison,
  calcPolicyFundEligibility,
};

},
"./index": function(module, exports, require, __filename, __dirname) {
/**
 * JARVIA 계산기 모듈 통합 인덱스
 * 여러 프로그램에서 공용으로 require('./calculators') 하여 사용
 *
 * 호환 원칙
 *  - 기존 5개 모듈과 기존 export를 그대로 유지한다.
 *  - 기존 trigger id를 유지한다.
 *  - 구조화 입력(calcInputs/calculators/trigger별 객체)이 있으면 Advanced 함수를 우선 사용한다.
 *  - 구조화 입력이 아직 없는 기존 호출은 auto 모드에서 legacy 계산으로 호환한다.
 *  - calculationMode='advanced'에서는 Advanced 함수를 우선 사용하고, Advanced 래퍼가 없는 기존 계산기는 모든 가정을 명시한 구조화 입력이 있을 때만 실행한다.
 */

'use strict';

const personal     = require('./personal');
const corporate    = require('./corporate');
const taxPersonal  = require('./tax-personal');
const taxCorporate = require('./tax-corporate');
const analysis     = require('./analysis');

const _MODULES = { personal, corporate, taxPersonal, taxCorporate, analysis };

function _isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function _hasValue(value) {
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
}

function _firstDefined(...values) {
  return values.find(_hasValue);
}

function _uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
}

function _mergeDefined(...objects) {
  const output = {};
  const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);
  for (const object of objects) {
    if (!_isPlainObject(object)) continue;
    for (const [key, value] of Object.entries(object)) {
      if (blockedKeys.has(key)) continue;
      if (_hasValue(value)) output[key] = value;
    }
  }
  return output;
}

function _sectionInput(params, id, aliases = []) {
  const p = _isPlainObject(params) ? params : {};
  const containers = [p.calcInputs, p.calculators, p.sections]
    .filter(_isPlainObject);
  const names = [id, ...aliases];
  const found = [];
  for (const container of containers) {
    for (const name of names) {
      if (_isPlainObject(container[name])) found.push(container[name]);
    }
  }
  for (const name of names) {
    if (_isPlainObject(p[name])) found.push(p[name]);
  }
  return _mergeDefined(...found);
}

function _hasStructuredInput(params, id, aliases = []) {
  return Object.keys(_sectionInput(params, id, aliases)).length > 0;
}




function _validateExecutionInput(value, path = '', output = [], depth = 0, ancestors = new WeakSet()) {
  if (depth > 12) {
    output.push(`${path || '(root)'}:maxDepth`);
    return output;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      output.push(`${path || '(root)'}:nonFinite`);
      return output;
    }
    if (Math.abs(value) > 1e18) output.push(`${path || '(root)'}:tooLarge`);
    const lower = path.toLowerCase();
    const leaf = lower.replace(/\[\d+\]$/, '').split('.').pop();
    const ageKeys = new Set(['age', 'currentage', 'retireage', 'lifeexpectancy', 'ceoage', 'successorage', 'exhaustage', 'pensionstartage']);
    const durationYearKeys = new Set([
      'years', 'yearstocontribute', 'accumyears', 'receiveyears', 'supportyears',
      'careyears', 'startinyears', 'baseyears', 'serviceyears', 'prioryears',
      'delayyears', 'withdrawalyears', 'targetyears', 'impactyears',
    ]);
    const durationMonthKeys = new Set([
      'months', 'recoverymonths', 'impactmonths', 'incomeinterruptionmonths',
      'monthsrequired', 'caremonths',
    ]);
    const durationDayKeys = new Set(['days', 'applicationdays']);
    if (ageKeys.has(leaf) && (value < 0 || value > 150)) {
      output.push(`${path}:ageOutOfRange`);
    } else if (durationYearKeys.has(leaf) && Math.abs(value) > 200) {
      output.push(`${path}:yearsOutOfRange`);
    } else if (durationMonthKeys.has(leaf) && Math.abs(value) > 2400) {
      output.push(`${path}:monthsOutOfRange`);
    } else if (durationDayKeys.has(leaf) && Math.abs(value) > 3660) {
      output.push(`${path}:daysOutOfRange`);
    }
    return output;
  }
  if (typeof value === 'string') {
    if (value.length > 100000) output.push(`${path || '(root)'}:stringTooLong`);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (ancestors.has(value)) {
    output.push(`${path || '(root)'}:circularReference`);
    return output;
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > 1000) {
        output.push(`${path || '(root)'}:arrayTooLong`);
        return output;
      }
      value.forEach((item, index) => _validateExecutionInput(item, `${path}[${index}]`, output, depth + 1, ancestors));
    } else {
      const entries = Object.entries(value);
      if (entries.length > 1000) {
        output.push(`${path || '(root)'}:objectTooLarge`);
        return output;
      }
      for (const [key, item] of entries) {
        const nextPath = path ? `${path}.${key}` : key;
        _validateExecutionInput(item, nextPath, output, depth + 1, ancestors);
      }
    }
  } finally {
    ancestors.delete(value);
  }
  return output;
}

function _findNonFiniteNumbers(value, path = '', output = [], ancestors = new WeakSet()) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) output.push(path || '(root)');
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (ancestors.has(value)) {
    output.push(`${path || '(root)'}:circularReference`);
    return output;
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) => _findNonFiniteNumbers(item, `${path}[${index}]`, output, ancestors));
    } else {
      for (const [key, item] of Object.entries(value)) {
        const nextPath = path ? `${path}.${key}` : key;
        _findNonFiniteNumbers(item, nextPath, output, ancestors);
      }
    }
  } finally {
    ancestors.delete(value);
  }
  return output;
}

function _incompleteResult(name, missingInputs = [], warnings = [], extra = {}) {
  return {
    calculated: false,
    missingInputs: [...new Set(missingInputs)],
    invalidInputs: [],
    warnings: [...new Set(warnings)],
    calculator: name,
    ...extra,
  };
}

function _checkedLegacyInput(name, input, requiredFields) {
  const missingInputs = _missingRequired(input, requiredFields);
  if (missingInputs.length) {
    return {
      ok: false,
      result: _incompleteResult(name, missingInputs, [
        '필수 입력값이 확인되지 않아 기존 계산기의 숨은 기본값을 적용하지 않았습니다.',
      ]),
    };
  }
  return { ok: true, input };
}

// 모듈 export 충돌을 사전에 탐지한다. 뒤 모듈이 앞 모듈을 조용히 덮어쓰지 않도록 한다.
const _exportOwners = {};
for (const [moduleName, moduleExports] of Object.entries(_MODULES)) {
  for (const exportName of Object.keys(moduleExports)) {
    if (!_exportOwners[exportName]) _exportOwners[exportName] = [];
    _exportOwners[exportName].push(moduleName);
  }
}
const _exportCollisions = Object.fromEntries(
  Object.entries(_exportOwners).filter(([, owners]) => owners.length > 1)
);

// 현재 검증 완료본은 충돌이 없어야 한다. 충돌 시 통합 조회에서 첫 번째 함수를 보존한다.
const _allCalcs = {};
for (const moduleExports of Object.values(_MODULES)) {
  for (const [name, fn] of Object.entries(moduleExports)) {
    if (!Object.prototype.hasOwnProperty.call(_allCalcs, name)) _allCalcs[name] = fn;
  }
}

function _retirementNeedAdvancedInput(p) {
  return _mergeDefined({
    currentAge: _firstDefined(p.currentAge, p.age),
    retireAge: p.retireAge,
    lifeExpectancy: p.lifeExpectancy,
    annualIncome: p.annualIncome,
    replacementRate: p.replacementRate,
    ssMonthly: p.ssMonthly,
    otherMonthly: p.otherMonthly,
    currentSaving: p.currentSaving,
    saveRate: p.saveRate,
    returnRate: p.returnRate,
    inflationRate: p.inflationRate,
    needBasis: p.needBasis,
    monthlyExpense: p.monthlyExpense,
  }, _sectionInput(p, 'retirementNeed', ['retirement']));
}

function _earnedIncomeAdvancedInput(p) {
  return _mergeDefined({
    taxYear: p.taxYear,
    grossSalary: _firstDefined(p.grossSalary, p.totalSalary, p.annualIncome),
    dependents: p.dependents,
    childrenOver7: p.childrenOver7,
    eligibleChildrenCount: _firstDefined(p.eligibleChildrenCount, p.childrenCountEligible),
    childBirthYears: p.childBirthYears,
    legacyChildrenCountConfirmed: p.legacyChildrenCountConfirmed,
    pensionSaving: p.pensionSaving,
    irp: p.irp,
    insurancePremium: p.insurancePremium,
    medicalExpense: p.medicalExpense,
    educationExpense: p.educationExpense,
    confirmedNationalPensionDeduction: p.confirmedNationalPensionDeduction,
    confirmedHealthInsuranceDeduction: p.confirmedHealthInsuranceDeduction,
    confirmedEmploymentInsuranceDeduction: p.confirmedEmploymentInsuranceDeduction,
    confirmedHousingFundDeduction: p.confirmedHousingFundDeduction,
    withholdingTax: p.withholdingTax,
  }, _sectionInput(p, 'earnedIncome'));
}

function _mortgageAdvancedInput(p) {
  return _mergeDefined({
    taxYear: p.taxYear,
    annualInterest: p.annualInterest,
    housePrice: _firstDefined(p.housePrice, p.acquisitionPrice),
    loanType: p.loanType,
    allRequirementsMet: p.allRequirementsMet,
    confirmedDeductionLimit: p.confirmedDeductionLimit,
    confirmedMarginalRate: p.confirmedMarginalRate,
  }, _sectionInput(p, 'mortgageDeduction', ['mortgage']));
}

function _corporateTaxAdvancedInput(p) {
  return _mergeDefined({
    taxableIncome: p.taxableIncome,
    taxYear: p.taxYear,
    corpType: p.corpType,
  }, _sectionInput(p, 'corporateTax'));
}

function _deemedInterestAdvancedInput(p) {
  return _mergeDefined({
    loanAmount: p.loanAmount,
    interestRate: _firstDefined(p.interestRate, p.loanRate, p.actualRate),
    deemedRate: p.deemedRate,
    days: _firstDefined(p.days, p.applicationDays),
    corpTaxableIncome: _firstDefined(p.corpTaxableIncome, p.taxableIncome),
    corpType: p.corpType,
    taxYear: p.taxYear,
    marginalRate: _firstDefined(p.marginalRate, p.incomeMarginalRate),
  }, _sectionInput(p, 'deemedInterest'));
}

function _inheritanceAdvancedInput(p) {
  return _mergeDefined({
    totalAssets: _firstDefined(p.inheritanceAssets, p.totalAssets),
    totalAssetsScope: p.totalAssetsScope,
    hasSpouse: p.hasSpouse,
    numChildren: p.numChildren,
    financialAssets: p.financialAssets,
    debts: p.debts,
    valuationDate: p.valuationDate,
    taxYear: p.taxYear,
  }, _sectionInput(p, 'inheritanceTax', ['inheritance']));
}

function _unlistedAdvancedInput(p) {
  return _mergeDefined({
    netAssets: p.netAssets,
    earningsValue: _firstDefined(p.earningsValue, p.netProfitValue),
    industry: p.industry,
    totalShares: p.totalShares,
    targetShares: _firstDefined(p.targetShares, p.ceoShares),
    financialYear: p.financialYear,
    statementType: p.statementType,
    valuationDate: p.valuationDate,
  }, _sectionInput(p, 'unlistedStock', ['unlistedStockValue']));
}

function _socialInsurancePersonalAdvancedInput(p) {
  return _mergeDefined({
    taxYear: p.taxYear,
    monthlySalary: p.monthlySalary,
    employeeType: p.employeeType,
    includeEmployer: p.includeEmployer,
    hasEmployer: p.hasEmployer,
    effectiveDate: p.effectiveDate,
    effectivePeriod: p.effectivePeriod,
    rateProfile: p.rateProfile,
  }, _sectionInput(p, 'socialInsurance', ['socialInsurancePersonal']));
}

function _socialInsuranceCorpAdvancedInput(p) {
  return _mergeDefined({
    taxYear: p.taxYear,
    numEmployees: p.numEmployees,
    totalMonthlySalary: p.totalMonthlySalary,
    monthlySalaries: p.monthlySalaries,
    effectiveDate: p.effectiveDate,
    effectivePeriod: p.effectivePeriod,
    taxableIncomeBefore: _firstDefined(p.taxableIncomeBefore, p.taxableIncome),
    corpType: p.corpType,
    rateProfile: p.rateProfile,
    assessmentBaseProfile: p.assessmentBaseProfile,
  }, _sectionInput(p, 'socialInsuranceCorp'));
}


// ───────────────────────────────────────────────────────────
// 현재 계산기 파일과 고도화 인덱스 사이의 비파괴 호환 어댑터
// 기존 계산기 함수명·입력·반환값은 변경하지 않고, 공용 게이트웨이와
// Advanced 트리거가 기존 검증된 계산기를 안전하게 재사용하도록 한다.
// ───────────────────────────────────────────────────────────
function _getInputPath(source, path) {
  if (!_isPlainObject(source) || typeof path !== 'string' || !path) return undefined;
  return path.split('.').reduce((value, key) => (value != null ? value[key] : undefined), source);
}

function _missingRequired(input, required = []) {
  const source = _isPlainObject(input) ? input : {};
  return required.filter(rule => {
    const alternatives = String(rule).split('|').map(value => value.trim()).filter(Boolean);
    return !alternatives.some(path => {
      const value = _getInputPath(source, path);
      if (Array.isArray(value)) return value.length > 0;
      if (_isPlainObject(value)) return Object.keys(value).length > 0;
      return _hasValue(value);
    });
  });
}

function _compatCall(name, fn, input, required = []) {
  const missing = _missingRequired(input, required);
  if (missing.length) {
    return _incompleteResult(name, missing, ['필수 입력값이 없어 계산을 실행하지 않았습니다.']);
  }
  if (typeof fn !== 'function') {
    return _incompleteResult(name, [], [`${name} 계산기 함수를 찾을 수 없습니다.`], { unsupported: true });
  }
  return fn(input);
}

function _mapEarnedIncomeAdvanced(input) {
  return _mergeDefined(input, {
    irpAmount: _firstDefined(input.irpAmount, input.irp),
    withheld: _firstDefined(input.withheld, input.withholdingTax),
  });
}

function _mapMortgageAdvanced(input) {
  let loanType = input.loanType;
  if (typeof loanType === 'string') {
    const normalized = loanType.toLowerCase();
    const hasFixed = normalized.includes('고정') || normalized.includes('fixed');
    const hasAmort = normalized.includes('비거치') || normalized.includes('amort');
    const isFifteen = normalized.includes('15');
    const isTen = normalized.includes('10');
    if (isFifteen && hasFixed && hasAmort) loanType = 4;       // 15년 이상 + 고정 + 비거치: 2,000만원
    else if (isFifteen && hasFixed) loanType = 1;              // 15년 이상 + 고정: 1,800만원
    else if (isFifteen && hasAmort) loanType = 2;              // 15년 이상 + 비거치: 1,800만원
    else if (isFifteen) loanType = 5;                          // 15년 이상 기타: 800만원
    else if (isTen && (hasFixed || hasAmort)) loanType = 3;    // 10년 이상 + 고정 또는 비거치: 600만원
  }
  return _mergeDefined(input, {
    loanType,
    acquisitionPrice: _firstDefined(input.acquisitionPrice, input.housePrice),
    allRequirementsMet: input.allRequirementsMet,
    confirmedDeductionLimit: input.confirmedDeductionLimit,
    confirmedMarginalRate: input.confirmedMarginalRate,
  });
}

function _mapSocialInsurancePersonalAdvanced(input) {
  return _mergeDefined(input, {
    hasEmployer: _firstDefined(input.hasEmployer, input.includeEmployer),
    effectiveDate: _firstDefined(input.effectiveDate, input.effectivePeriod),
  });
}

function _mapSocialInsuranceCorpAdvanced(input) {
  return _mergeDefined(input, {
    effectiveDate: _firstDefined(input.effectiveDate, input.effectivePeriod),
    totalMonthlySalary: _firstDefined(input.totalMonthlySalary, input.monthlyPayroll),
  });
}

function _resolveNpsMonthlyCap(input = {}) {
  const raw = String(_firstDefined(input.effectiveDate, input.effectivePeriod, '') || '');
  const digits = raw.replace(/[^0-9]/g, '');
  const yyyymm = digits.length >= 6 ? Number(digits.slice(0, 6)) : 0;
  return yyyymm >= 202607 ? 6590000 : 6370000;
}

function _calcInsurancePortfolioAnalysis(input) {
  const policies = Array.isArray(input.policies) ? input.policies : [];
  const protectionPremium = policies.reduce((sum, policy) => {
    const premium = Number(_firstDefined(policy.monthlyPremium, policy.premium, 0));
    return sum + (Number.isFinite(premium) ? Math.max(0, premium) : 0);
  }, 0);
  const coverageTotals = {};
  for (const policy of policies) {
    const coverage = _isPlainObject(policy.coverage) ? policy.coverage : {};
    for (const [key, value] of Object.entries(coverage)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) coverageTotals[key] = (coverageTotals[key] || 0) + Math.max(0, numeric);
    }
  }
  const requiredCoverage = _isPlainObject(input.requiredCoverage) ? input.requiredCoverage : {};
  const coverageGaps = {};
  for (const [key, value] of Object.entries(requiredCoverage)) {
    const required = Number(value);
    if (Number.isFinite(required)) coverageGaps[key] = Math.max(0, required - (coverageTotals[key] || 0));
  }
  const affordability = typeof _allCalcs.calcInsuranceAffordability === 'function'
    ? _allCalcs.calcInsuranceAffordability({
        monthlyIncome: _firstDefined(input.monthlyIncome, 0),
        protectionPremium,
        savingsPremium: _firstDefined(input.savingsPremium, 0),
        targetRate: input.targetPremiumRate,
        maxRate: input.maxPremiumRate,
      })
    : null;
  if (!policies.length && !_hasValue(input.monthlyIncome) && !Object.keys(requiredCoverage).length) {
    return _incompleteResult('insurancePortfolioAnalysis', ['policies|monthlyIncome|requiredCoverage']);
  }
  return { calculated: true, policyCount: policies.length, protectionPremium, coverageTotals, coverageGaps, affordability };
}

function _calcRetirementScenarioMatrix(input) {
  const missing = _missingRequired(input, ['currentAge', 'retireAge', 'annualIncome']);
  if (missing.length) return _incompleteResult('retirementScenarioMatrix', missing);
  const lifeExpectancies = Array.isArray(input.lifeExpectancies) && input.lifeExpectancies.length
    ? input.lifeExpectancies : [_firstDefined(input.lifeExpectancy, 85)];
  const returnScenarios = Array.isArray(input.returnScenarios) && input.returnScenarios.length
    ? input.returnScenarios : [_firstDefined(input.returnRate, 0.04)];
  const scenarios = [];
  for (const lifeExpectancy of lifeExpectancies) {
    for (const returnRate of returnScenarios) {
      const result = _allCalcs.calcRetirementNeed({ ...input, lifeExpectancy, returnRate });
      scenarios.push({ lifeExpectancy, returnRate, result });
    }
  }
  return { calculated: true, scenarios };
}

function _calcPensionWithdrawalOrder(input) {
  const accounts = Array.isArray(input.accounts) ? input.accounts : [];
  if (!accounts.length) return _incompleteResult('pensionWithdrawalOrder', ['accounts']);
  const strategy = typeof input.strategy === 'string' ? input.strategy : 'taxEfficient';
  const normalized = accounts.map((account, index) => ({
    index,
    name: account.name || `account${index + 1}`,
    balance: Math.max(0, Number(account.balance) || 0),
    taxRate: Math.max(0, Number(account.taxRate) || 0),
    priority: Number.isFinite(Number(account.priority)) ? Number(account.priority) : index,
  }));
  normalized.sort(strategy === 'manual'
    ? (a, b) => a.priority - b.priority
    : (a, b) => a.taxRate - b.taxRate || a.priority - b.priority);
  const annualNeed = Math.max(0, Number(input.monthlyNetNeed) || 0) * 12;
  const years = Math.max(0, Number(_firstDefined(input.years, 0)) || 0);
  const targetWithdrawal = annualNeed * years;
  let remaining = targetWithdrawal;
  const order = normalized.map(account => {
    const withdrawal = Math.min(account.balance, remaining);
    remaining = Math.max(0, remaining - withdrawal);
    return { ...account, suggestedWithdrawal: withdrawal };
  });
  return { calculated: true, strategy, targetWithdrawal, fundedAmount: targetWithdrawal - remaining, shortfall: remaining, order };
}

function _calcGoalFundingPlan(input) {
  const goals = Array.isArray(input.goals) ? input.goals : [];
  if (!goals.length) return _incompleteResult('goalFundingPlan', ['goals']);
  const plans = goals.map((goal, index) => {
    const targetAmount = Math.max(0, Number(goal.targetAmount) || 0);
    const currentAmount = Math.max(0, Number(goal.currentAmount) || 0);
    const years = Math.max(0, Number(goal.years) || 0);
    const annualRate = Number.isFinite(Number(goal.annualRate)) ? Number(goal.annualRate) : 0.04;
    const months = Math.round(years * 12);
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    const currentFV = currentAmount * Math.pow(1 + monthlyRate, months);
    const gap = Math.max(0, targetAmount - currentFV);
    const monthlyRequired = months <= 0 ? gap
      : (monthlyRate === 0 ? gap / months : gap * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1));
    return { index, name: goal.name || `goal${index + 1}`, targetAmount, currentAmount, years, annualRate, currentFV, gap, monthlyRequired };
  });
  const totalMonthlyRequired = plans.reduce((sum, plan) => sum + plan.monthlyRequired, 0);
  const availableMonthly = Math.max(0, Number(input.availableMonthly) || 0);
  return { calculated: true, plans, totalMonthlyRequired, availableMonthly, monthlyShortfall: Math.max(0, totalMonthlyRequired - availableMonthly) };
}

function _calcEmergencyFundAdequacy(input) {
  const expense = Number(input.monthlyEssentialExpense);
  if (!Number.isFinite(expense) || expense < 0) return _incompleteResult('emergencyFundAdequacy', ['monthlyEssentialExpense']);
  const desiredMonths = Math.max(0, Number(_firstDefined(input.desiredMonths, 6)) || 0);
  const requiredFund = expense * desiredMonths;
  const liquidAssets = ['cash', 'demandDeposit', 'shortTermDeposit', 'otherLiquidAssets']
    .reduce((sum, key) => sum + Math.max(0, Number(input[key]) || 0), 0);
  const netLiquidAssets = Math.max(0, liquidAssets - Math.max(0, Number(input.shortTermLiabilities) || 0));
  return { calculated: true, requiredFund, liquidAssets, netLiquidAssets, gap: Math.max(0, requiredFund - netLiquidAssets), adequacyRate: requiredFund > 0 ? netLiquidAssets / requiredFund : 1 };
}

function _calcPortfolioStressTest(input) {
  const assets = Array.isArray(input.assets) ? input.assets : [];
  const scenarios = Array.isArray(input.scenarios) ? input.scenarios : [];
  if (!assets.length || !scenarios.length) return _incompleteResult('portfolioStressTest', !assets.length ? ['assets'] : ['scenarios']);
  const baseValue = assets.reduce((sum, asset) => sum + Math.max(0, Number(asset.value) || 0), 0);
  const results = scenarios.map((scenario, index) => {
    const shocks = _isPlainObject(scenario.shocks) ? scenario.shocks : {};
    const stressedValue = assets.reduce((sum, asset) => {
      const shock = Number(_firstDefined(shocks[asset.type], scenario.defaultShock, 0));
      return sum + Math.max(0, Number(asset.value) || 0) * (1 + (Number.isFinite(shock) ? shock : 0));
    }, 0);
    return { index, name: scenario.name || `scenario${index + 1}`, stressedValue, loss: baseValue - stressedValue, lossRate: baseValue > 0 ? (baseValue - stressedValue) / baseValue : 0 };
  });
  return { calculated: true, baseValue, scenarios: results };
}

function _calcRebalancingPlan(input) {
  const currentAssets = _isPlainObject(input.currentAssets) ? input.currentAssets : {};
  const targetWeights = _isPlainObject(input.targetWeights) ? input.targetWeights : {};
  if (!Object.keys(currentAssets).length || !Object.keys(targetWeights).length) {
    return _incompleteResult('rebalancingPlan', !Object.keys(currentAssets).length ? ['currentAssets'] : ['targetWeights']);
  }
  const total = Object.values(currentAssets).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const minTradeAmount = Math.max(0, Number(input.minTradeAmount) || 0);
  const trades = Object.keys(targetWeights).map(asset => {
    const current = Math.max(0, Number(currentAssets[asset]) || 0);
    const targetWeight = Math.max(0, Number(targetWeights[asset]) || 0);
    const target = total * targetWeight;
    const trade = target - current;
    return { asset, current, targetWeight, target, trade: Math.abs(trade) >= minTradeAmount ? trade : 0 };
  });
  return { calculated: true, total, trades, buyTotal: trades.reduce((s,t)=>s+Math.max(0,t.trade),0), sellTotal: trades.reduce((s,t)=>s+Math.max(0,-t.trade),0) };
}

function _calcBusinessValueAdvanced(input) {
  const netAssets = Number(input.netAssets);
  const earningsValue = Number(_firstDefined(input.earningsValue, input.netProfitValue));
  if (!Number.isFinite(netAssets) && !Number.isFinite(earningsValue)) return _incompleteResult('businessValue', ['netAssets|earningsValue']);
  const assetValue = Math.max(0, Number.isFinite(netAssets) ? netAssets : 0);
  const incomeValue = Math.max(0, Number.isFinite(earningsValue) ? earningsValue : 0);
  const industry = input.industry || 'general';
  const earningsWeight = industry === 'realty' ? 2 : 3;
  const assetWeight = industry === 'realty' ? 3 : 2;
  const weightedValue = (incomeValue * earningsWeight + assetValue * assetWeight) / (earningsWeight + assetWeight);
  const floorValue = assetValue * 0.8;
  return { calculated: true, estimateOnly: true, assetValue, incomeValue, weightedValue, floorValue, estimatedBusinessValue: Math.max(weightedValue, floorValue) };
}

function _calcShareBuyoutNeed(input) {
  const companyValue = Number(_firstDefined(input.companyValue, input.businessValue));
  const shareRatio = Number(_firstDefined(input.shareRatio, input.targetShareRatio));
  if (!Number.isFinite(companyValue) || !Number.isFinite(shareRatio)) return _incompleteResult('shareBuyoutNeed', ['companyValue', 'shareRatio']);
  const grossNeed = Math.max(0, companyValue) * Math.max(0, shareRatio);
  const existingFunding = Math.max(0, Number(input.existingFunding) || 0);
  return { calculated: true, grossNeed, existingFunding, fundingGap: Math.max(0, grossNeed - existingFunding) };
}

function _calcSuccessionFundingNeed(input) {
  const shareValue = Math.max(0, Number(_firstDefined(input.shareValue, input.businessValue, 0)) || 0);
  const estimatedTax = Math.max(0, Number(input.estimatedTax) || 0);
  const liquidityNeed = Math.max(0, Number(input.liquidityNeed) || 0);
  const existingFunding = Math.max(0, Number(input.existingFunding) || 0);
  if (shareValue === 0 && estimatedTax === 0 && liquidityNeed === 0) return _incompleteResult('successionFundingNeed', ['shareValue|estimatedTax|liquidityNeed']);
  const totalNeed = estimatedTax + liquidityNeed;
  return { calculated: true, shareValue, estimatedTax, liquidityNeed, totalNeed, existingFunding, fundingGap: Math.max(0, totalNeed - existingFunding) };
}

function _validateFinancialStatements(input) {
  const statements = Array.isArray(input.statements) ? input.statements : (_isPlainObject(input.statements) ? [input.statements] : []);
  if (!statements.length) return _incompleteResult('financialValidation', ['statements']);
  const toleranceRate = Math.max(0, Number(_firstDefined(input.balanceToleranceRate, 0.001)) || 0);
  const validations = statements.map((statement, index) => {
    const assets = Number(statement.totalAssets);
    const liabilities = Number(statement.totalLiabilities);
    const equity = Number(statement.totalEquity);
    const available = [assets, liabilities, equity].every(Number.isFinite);
    const difference = available ? assets - liabilities - equity : null;
    const tolerance = available ? Math.max(1, Math.abs(assets) * toleranceRate) : null;
    return { index, available, difference, tolerance, balanced: available ? Math.abs(difference) <= tolerance : false };
  });
  return { calculated: true, valid: validations.every(item => item.balanced), validations };
}

function _calcFinancialTrendAdvanced(input) {
  const statements = Array.isArray(input.statements) ? input.statements : [];
  if (statements.length < 2) return _incompleteResult('financialTrend', ['statements[2+]']);
  const metrics = Array.isArray(input.metrics) && input.metrics.length ? input.metrics : ['revenue','operatingProfit','netIncome','totalAssets','totalLiabilities','totalEquity'];
  const trends = {};
  for (const metric of metrics) {
    trends[metric] = statements.map((statement, index) => {
      const value = Number(statement[metric]);
      const previous = index > 0 ? Number(statements[index - 1][metric]) : null;
      return { period: statement.period || statement.year || index, value: Number.isFinite(value) ? value : null, growthRate: index > 0 && Number.isFinite(value) && Number.isFinite(previous) && previous !== 0 ? (value - previous) / Math.abs(previous) : null };
    });
  }
  return { calculated: true, trends };
}

function _calcCorporateTaxBaseChangeAdvanced(input) {
  const before = Number(_firstDefined(input.taxableIncomeBefore, input.beforeTaxBase));
  const after = Number(_firstDefined(input.taxableIncomeAfter, input.afterTaxBase));
  if (!Number.isFinite(before) || !Number.isFinite(after)) return _incompleteResult('corporateTaxBaseChange', ['taxableIncomeBefore', 'taxableIncomeAfter']);
  const baseInput = { taxYear: input.taxYear, corpType: input.corpType };
  const beforeResult = _allCalcs.calcCorporateTax({ ...baseInput, taxableIncome: before });
  const afterResult = _allCalcs.calcCorporateTax({ ...baseInput, taxableIncome: after });
  const beforeTax = Number(_firstDefined(beforeResult.totalTax, beforeResult.finalTax, beforeResult.tax, 0)) || 0;
  const afterTax = Number(_firstDefined(afterResult.totalTax, afterResult.finalTax, afterResult.tax, 0)) || 0;
  return { calculated: true, beforeTaxBase: before, afterTaxBase: after, taxBaseChange: after - before, beforeTax, afterTax, taxChange: afterTax - beforeTax, beforeResult, afterResult };
}

function _calcSuite(input, mapping, name) {
  let requested = Array.isArray(input.components) ? input.components : Object.keys(mapping).filter(key => _isPlainObject(input[key]));
  // 스위트 트리거를 명시했지만 구성요소를 따로 지정하지 않은 기존 호출은 전체 스위트를 시도한다.
  if (!requested.length && _isPlainObject(input) && Object.keys(input).length) requested = Object.keys(mapping);
  if (!requested.length) return _incompleteResult(name, ['components|sectionInputs']);
  const results = {};
  const successfulComponents = [];
  const incompleteComponents = [];
  for (const component of requested) {
    const fnName = mapping[component];
    const fn = fnName && (_INTERNAL_CALCS[fnName] || _allCalcs[fnName]);
    if (typeof fn !== 'function') {
      results[component] = _incompleteResult(component, [], ['지원하지 않는 구성요소입니다.'], { unsupported: true });
      incompleteComponents.push(component);
      continue;
    }
    try {
      const result = fn(_isPlainObject(input[component]) ? input[component] : input);
      results[component] = result;
      if (result && result.calculated === false) incompleteComponents.push(component);
      else successfulComponents.push(component);
    } catch (error) {
      results[component] = _incompleteResult(component, [], [error.message || '실행 오류'], { executionError: true });
      incompleteComponents.push(component);
    }
  }
  return { calculated: successfulComponents.length > 0, requestedComponents: requested, successfulComponents, incompleteComponents, results };
}

const _INTERNAL_CALCS = {};

const _ADVANCED_COMPATIBILITY = {
  calcRetirementNeedAdvanced: ['calcRetirementNeed', input => input],
  calcSocialInsurancePersonalAdvanced: ['calcSocialInsurancePersonal', _mapSocialInsurancePersonalAdvanced],
  calcEarnedIncomeAdvanced: ['calcEarnedIncome', _mapEarnedIncomeAdvanced],
  calcMortgageDeductionAdvanced: ['calcMortgageDeduction', _mapMortgageAdvanced],
  calcCorporateTaxAdvanced: ['calcCorporateTax', input => input],
  calcSeveranceTaxAdvanced: ['calcSeveranceTax', input => input],
  calcDeemedInterestAdvanced: ['calcDeemedInterest', input => input],
  calcInheritanceTaxAdvanced: ['calcInheritanceTax', input => input],
  calcCorpVsIndividualAdvanced: ['calcCorpVsIndividual', input => input],
  calcUnlistedStockValueAdvanced: ['calcUnlistedStockValue', input => input],
  calcCorpLiquidationAdvanced: ['calcCorpLiquidation', input => input],
  calcSocialInsuranceCorpAdvanced: ['calcSocialInsuranceCorp', _mapSocialInsuranceCorpAdvanced],
  calcRentalIncomeAdvanced: ['calcRentalIncome', input => input],
  calcGlobalIncomeAdvanced: ['calcGlobalIncome', input => input],
  calcISASavingsAdvanced: ['calcISASavings', input => input],
  calcStartupTaxCreditAdvanced: ['calcStartupTaxCredit', input => input],
  calcEntertainmentLimitAdvanced: ['calcEntertainmentLimit', input => input],
  calcEmploymentCreditAdvanced: ['calcEmploymentCredit', input => input],
  calcRnDCreditAdvanced: ['calcRnDCredit', input => input],
  calcWelfareFundAdvanced: ['calcWelfareFund', input => input],
  calcStockOptionAdvanced: ['calcStockOption', input => input],
  calcOverseasAssetAdvanced: ['calcOverseasAsset', input => input],
  calcHoldingCompanyAdvanced: ['calcHoldingCompany', input => input],
  calcMergerTaxAdvanced: ['calcMergerTax', input => input],
  calcProfitRetirementAdvanced: ['calcProfitRetirement', input => input],
  calcDifferentialDividendAdvanced: ['calcDifferentialDividend', input => input],
  calcInventionCompensationAdvanced: ['calcInventionCompensation', input => input],
  calcPatentCapitalizationAdvanced: ['calcPatentCapitalization', input => input],
  calcCarryforwardLossAdvanced: ['calcCarryforwardLoss', input => input],
  calcFinancialRatiosAdvanced: ['calcFinancialRatios', input => input],
  calcFinancialIncomeAdvanced: ['calcFinancialIncome', input => input],
  calcGiftTaxAdvanced: ['calcGiftTax', input => input],
  calcFamilyCorpGiftPresumptionAdvanced: ['calcFamilyCorpGiftPresumption', input => input],
  calcVehicleExpenseAdvanced: ['calcVehicleExpense', input => input],
  calcNomineeTrustAdvanced: ['calcNomineeTrust', input => input],
};
for (const [advancedName, [legacyName, mapper]] of Object.entries(_ADVANCED_COMPATIBILITY)) {
  _INTERNAL_CALCS[advancedName] = input => _compatCall(advancedName, _allCalcs[legacyName], mapper(input || {}));
}

Object.assign(_INTERNAL_CALCS, {
  calcInsurancePortfolioAnalysis: _calcInsurancePortfolioAnalysis,
  calcRetirementScenarioMatrix: _calcRetirementScenarioMatrix,
  calcPensionWithdrawalOrder: _calcPensionWithdrawalOrder,
  calcGoalFundingPlan: _calcGoalFundingPlan,
  calcEmergencyFundAdequacy: _calcEmergencyFundAdequacy,
  calcPortfolioStressTest: _calcPortfolioStressTest,
  calcRebalancingPlan: _calcRebalancingPlan,
  calcBusinessValueAdvanced: _calcBusinessValueAdvanced,
  calcKeyPersonLossNeed: input => _compatCall('keyPersonLossNeed', _allCalcs.calcCorpKeymanNeed, input, ['monthlyOperatingShortfall']),
  calcShareBuyoutNeed: _calcShareBuyoutNeed,
  calcDeemedLoanResolutionOptions: input => _compatCall('deemedLoanResolutionOptions', _allCalcs.calcDeemedInterestFull, input, ['loanAmount']),
  calcOwnerCompensationMix: input => _compatCall('ownerCompensationMix', _allCalcs.calcSalaryVsDividend, {
    totalAmount: _firstDefined(input.totalAmount, input.ceoSalary, input.distributableAmount),
    corpTaxableIncome: _firstDefined(input.corpTaxableIncome, input.taxableIncome, 0),
  }, ['totalAmount']),
  calcSuccessionFundingNeed: _calcSuccessionFundingNeed,
  validateFinancialStatements: _validateFinancialStatements,
  calcFinancialTrendAdvanced: _calcFinancialTrendAdvanced,
  calcCorporateTaxBaseChangeAdvanced: _calcCorporateTaxBaseChangeAdvanced,
});

_INTERNAL_CALCS.calcPersonalAdvanced = input => _calcSuite(input, {
  retirementNeed: 'calcRetirementNeedAdvanced', insurancePortfolio: 'calcInsurancePortfolioAnalysis',
  retirementScenarios: 'calcRetirementScenarioMatrix', emergencyFund: 'calcEmergencyFundAdequacy',
  goalFunding: 'calcGoalFundingPlan', portfolioStress: 'calcPortfolioStressTest', rebalancing: 'calcRebalancingPlan',
}, 'personalAdvanced');
_INTERNAL_CALCS.calcCorporateAdvanced = input => _calcSuite(input, {
  corporateTax: 'calcCorporateTaxAdvanced', businessValue: 'calcBusinessValueAdvanced',
  keyPersonLoss: 'calcKeyPersonLossNeed', shareBuyout: 'calcShareBuyoutNeed',
  deemedLoanOptions: 'calcDeemedLoanResolutionOptions', ownerCompensationMix: 'calcOwnerCompensationMix',
  successionFunding: 'calcSuccessionFundingNeed',
}, 'corporateAdvanced');
_INTERNAL_CALCS.calcPersonalTaxAdvanced = input => _calcSuite(input, {
  rentalIncome: 'calcRentalIncomeAdvanced', financialIncome: 'calcFinancialIncomeAdvanced',
  earnedIncome: 'calcEarnedIncomeAdvanced', globalIncome: 'calcGlobalIncomeAdvanced',
  isaSavings: 'calcISASavingsAdvanced', mortgageDeduction: 'calcMortgageDeductionAdvanced',
  startupTaxCredit: 'calcStartupTaxCreditAdvanced', socialInsurance: 'calcSocialInsurancePersonalAdvanced',
}, 'personalTaxAdvanced');
_INTERNAL_CALCS.calcCorporateTaxSuiteAdvanced = input => _calcSuite(input, {
  corporateTax: 'calcCorporateTaxAdvanced', taxBaseChange: 'calcCorporateTaxBaseChangeAdvanced',
  entertainmentLimit: 'calcEntertainmentLimitAdvanced', employmentCredit: 'calcEmploymentCreditAdvanced',
  rndCredit: 'calcRnDCreditAdvanced', welfareFund: 'calcWelfareFundAdvanced', stockOption: 'calcStockOptionAdvanced',
  overseasAsset: 'calcOverseasAssetAdvanced', holdingCompany: 'calcHoldingCompanyAdvanced', mergerTax: 'calcMergerTaxAdvanced',
  profitRetirement: 'calcProfitRetirementAdvanced', differentialDividend: 'calcDifferentialDividendAdvanced',
  inventionCompensation: 'calcInventionCompensationAdvanced', patentCapitalization: 'calcPatentCapitalizationAdvanced',
  carryforwardLoss: 'calcCarryforwardLossAdvanced',
}, 'corporateTaxSuiteAdvanced');
_INTERNAL_CALCS.calcFinancialAnalysisAdvanced = input => {
  const statements = input.statements;
  const validation = _validateFinancialStatements({ statements, balanceToleranceRate: input.balanceToleranceRate });
  let ratios = null;
  if (Array.isArray(statements) && statements.length) {
    ratios = _allCalcs.calcFinancialRatios({ current: statements[statements.length - 1], previous: statements[statements.length - 2] || {}, employees: input.employees });
  } else if (_isPlainObject(statements)) {
    ratios = _allCalcs.calcFinancialRatios({ current: statements, previous: {}, employees: input.employees });
  }
  const trend = Array.isArray(statements) && statements.length >= 2 ? _calcFinancialTrendAdvanced({ statements }) : null;
  if (!ratios && validation.calculated === false) return _incompleteResult('financialAnalysisAdvanced', ['statements']);
  return { calculated: true, validation, ratios, trend };
};

const _gatewayCalcs = { ..._allCalcs, ..._INTERNAL_CALCS };

/**
 * 토픽별 계산기 디스패처.
 * calculationMode:
 *  - 'auto'     : 구조화 입력이 있으면 Advanced, 없으면 기존 호출을 호환한다.
 *  - 'advanced' : Advanced 함수를 우선 사용한다. Advanced 래퍼가 없는 기존 계산기는 명시적 구조화 입력이 있을 때만 실행한다.
 *  - 'legacy'   : 기존 계산기만 사용한다.
 */
function calculateForTopic(slug, persona) {
  const C = _gatewayCalcs;
  const safePersona = _isPlainObject(persona) ? persona : {};
  const p = _isPlainObject(safePersona.calcParams) ? safePersona.calcParams : {};
  const meta = _isPlainObject(safePersona.meta) ? safePersona.meta : {};
  const triggers = _uniqueStrings(meta.triggerCalcs);
  const requestedMode = ['auto', 'advanced', 'legacy'].includes(meta.calculationMode)
    ? meta.calculationMode : 'auto';
  const results = {};
  const dispatch = {
    slug: typeof slug === 'string' ? slug : '',
    requestedMode,
    requested: triggers.slice(),
    successful: [],
    partial: [],
    incomplete: [],
    unsupported: [],
    errors: [],
    modesByTrigger: {},
  };


const storeResult = (name, result, mode) => {
  results[name] = result;
  dispatch.modesByTrigger[name] = mode;

  let status = 'successful';
  if (result && result.calculated === false) {
    status = 'incomplete';
  } else if (result && Array.isArray(result.successfulSections)) {
    const successfulCount = result.successfulSections.length;
    const incompleteCount = Array.isArray(result.incompleteSections)
      ? result.incompleteSections.length : 0;
    const requestedCount = Array.isArray(result.calculatedSections)
      ? result.calculatedSections.length
      : (Array.isArray(result.requestedSections) ? result.requestedSections.length : successfulCount + incompleteCount);

    if (successfulCount === 0) status = 'incomplete';
    else if (incompleteCount > 0 || requestedCount > successfulCount) status = 'partial';
  } else if (result && Array.isArray(result.requestedComponents)) {
    const requestedCount = result.requestedComponents.length;
    const successfulCount = Array.isArray(result.successfulComponents)
      ? result.successfulComponents.length : 0;
    const incompleteCount = Array.isArray(result.incompleteComponents)
      ? result.incompleteComponents.length : 0;
    if (requestedCount === 0 || successfulCount === 0) status = 'incomplete';
    else if (incompleteCount > 0 || requestedCount > successfulCount) status = 'partial';
  }

  dispatch[status].push(name);
};

const tryCalc = (name, fn, input, mode) => {
    if (requestedMode === 'legacy' && mode === 'advanced') {
      storeResult(name, _incompleteResult(name, [], [
        'legacy 모드에서는 Advanced 전용 계산기를 실행하지 않았습니다.',
      ], { modeBlocked: true }), 'legacy-blocked');
      return;
    }
    if (requestedMode === 'advanced' && mode === 'legacy') {
      storeResult(name, _incompleteResult(name, ['structuredInput'], [
        'advanced 모드에서는 숨은 기본값이 있는 legacy 계산을 실행하지 않았습니다.',
      ], { modeBlocked: true }), 'advanced-blocked');
      return;
    }
    if (typeof fn !== 'function') {
      const result = _incompleteResult(name, [], [`${name} 계산기 함수를 찾을 수 없습니다.`], { unsupported: true });
      results[name] = result;
      console.warn(`[calculateForTopic] ${name}: 함수 없음`);
      dispatch.unsupported.push(name);
      dispatch.modesByTrigger[name] = mode;
      return;
    }
    try {
      const unsafeInputPaths = _validateExecutionInput(input);
      if (unsafeInputPaths.length) {
        storeResult(name, _incompleteResult(name, [], [
          '계산기 실행 전에 비정상 입력 또는 과도한 반복 가능성이 있는 값을 차단했습니다.',
        ], { invalidInputPaths: unsafeInputPaths }), mode);
        return;
      }
      const value = fn(input);
      if (value && typeof value === 'object') {
        const nonFinitePaths = _findNonFiniteNumbers(value);
        if (nonFinitePaths.length) {
          storeResult(name, _incompleteResult(name, [], [
            '계산결과에 NaN 또는 Infinity가 발생해 결과 사용을 차단했습니다.',
          ], { invalidResultPaths: nonFinitePaths }), mode);
        } else {
          storeResult(name, value, mode);
        }
      } else {
        storeResult(name, _incompleteResult(name, [], ['계산기가 유효한 결과 객체를 반환하지 않았습니다.']), mode);
      }
    } catch (error) {
      const message = error && error.message ? error.message : '알 수 없는 계산 오류';
      results[name] = _incompleteResult(name, [], [`계산 실행 중 오류가 발생했습니다: ${message}`], { executionError: true });
      console.warn(`[calculateForTopic] ${name} 실행 실패: ${message}`);
      dispatch.errors.push(name);
      dispatch.modesByTrigger[name] = mode;
    }
  };

  const tryLegacyChecked = (name, fn, input, requiredFields) => {
    const checked = _checkedLegacyInput(name, input, requiredFields);
    if (!checked.ok) {
      storeResult(name, checked.result, 'legacy-checked');
      return;
    }
    tryCalc(name, fn, checked.input, 'legacy');
  };


const choose = ({
  name, advancedFn, advancedInput, legacyFn, legacyInput,
  legacyRequired = [], structuredAliases = [],
}) => {
  const structured = _hasStructuredInput(p, name, structuredAliases);
  const useAdvanced = requestedMode === 'advanced'
    || (requestedMode === 'auto' && structured);

  if (useAdvanced) {
    if (typeof advancedFn === 'function') {
      tryCalc(name, advancedFn, advancedInput, 'advanced');
      return;
    }
    // Advanced 전용 함수가 없어도 구조화 입력과 기존 검증된 함수가 있으면 안전 호환 실행한다.
    if (typeof legacyFn === 'function') {
      const checked = _checkedLegacyInput(name, advancedInput, legacyRequired);
      if (!checked.ok) {
        storeResult(name, checked.result, 'advanced-compatible');
        return;
      }
      tryCalc(name, legacyFn, checked.input, 'advanced-compatible');
      return;
    }
    storeResult(name, _incompleteResult(name, ['advancedCalculator'], [
      '해당 트리거에 연결된 계산기 함수가 없습니다.',
    ]), 'advanced');
    return;
  }

  // 구조화 입력이 없는 기존 auto/legacy 호출은 원본 매핑과 기본값을 그대로 유지한다.
  tryCalc(name, legacyFn, legacyInput, 'legacy');
};


const runLegacyOnly = ({
  name, fn, legacyInput, structuredInput = {}, explicitRequired = [],
}) => {
  const hasStructured = _isPlainObject(structuredInput) && Object.keys(structuredInput).length > 0;
  const useExplicit = requestedMode === 'advanced' || (requestedMode === 'auto' && hasStructured);

  if (useExplicit) {
    if (!hasStructured) {
      storeResult(name, _incompleteResult(name, ['structuredInput'], [
        'Advanced 전용 래퍼가 없는 계산기이므로, 모든 가정을 명시한 구조화 입력이 필요합니다.',
      ]), 'advanced-explicit');
      return;
    }
    const checked = _checkedLegacyInput(name, structuredInput, explicitRequired);
    if (!checked.ok) {
      storeResult(name, checked.result, 'advanced-explicit');
      return;
    }
    tryCalc(name, fn, checked.input, 'advanced-explicit');
    return;
  }

  // legacy 모드 또는 구조화 입력이 없는 auto 모드는 원본 매핑을 그대로 사용한다.
  tryCalc(name, fn, legacyInput, 'legacy');
};


const RUN = {
    // ── 개인 기존 trigger + Advanced 우선 연결 ──
    retirementNeed: () => choose({
      name: 'retirementNeed',
      advancedFn: C.calcRetirementNeedAdvanced,
      advancedInput: _retirementNeedAdvancedInput(p),
      legacyFn: C.calcRetirementNeed,
      legacyInput: {
        currentAge: p.age, retireAge: p.retireAge,
        lifeExpectancy: p.lifeExpectancy || 85, annualIncome: p.annualIncome,
        currentSaving: p.currentSaving || 0, needBasis: p.needBasis || 'income',
        monthlyExpense: p.monthlyExpense || 0,
      },
      legacyRequired: ['currentAge', 'retireAge', 'annualIncome'],
      structuredAliases: ['retirement'],
    }),
    retirementSave: () => {
      const structured = _sectionInput(p, 'retirementSave');
      const legacyInput = {
        currentAge: p.age, retireAge: p.retireAge, lifeExpectancy: p.lifeExpectancy || 85,
        goalAmount: Math.round((p.annualIncome || 0) * 0.7 * Math.max(1, (p.lifeExpectancy || 85) - (p.retireAge || 60))),
        currentSaving: p.currentSaving || 0,
      };
      runLegacyOnly({
        name: 'retirementSave',
        fn: C.calcRetirementSave,
        legacyInput,
        structuredInput: structured,
        explicitRequired: ['currentAge', 'retireAge', 'goalAmount', 'currentSaving', 'returnRate', 'inflationRate'],
      });
    },
    taxCredit: () => {
      const structured = _sectionInput(p, 'taxCredit');
      const legacyInput = {
        totalSalary: p.totalSalary || p.annualIncome,
        pensionSaving: p.pensionSaving || 0,
        irp: p.irp || 0,
      };
      runLegacyOnly({
        name: 'taxCredit',
        fn: C.calcTaxCredit,
        legacyInput,
        structuredInput: structured,
        explicitRequired: ['totalSalary', 'pensionSaving', 'irp'],
      });
    },
    pension: () => {
      const structured = _sectionInput(p, 'pension');
      const base = Math.min(p.monthlySalary || 0, _resolveNpsMonthlyCap(p));
      const legacyInput = {
        monthlyPmt: Math.round(base * 0.0475),
        accumYears: Math.max(0, 65 - (p.age || 0)),
        receiveYears: (p.lifeExpectancy || 85) - 65,
      };
      runLegacyOnly({
        name: 'pension',
        fn: C.calcPension,
        legacyInput,
        structuredInput: structured,
        explicitRequired: ['principal', 'monthlyPmt', 'accumYears', 'receiveYears', 'accumRate', 'receiveRate', 'inflationRate'],
      });
    },
    socialInsurance: () => choose({
      name: 'socialInsurance',
      advancedFn: C.calcSocialInsurancePersonalAdvanced,
      advancedInput: _socialInsurancePersonalAdvancedInput(p),
      legacyFn: C.calcSocialInsurancePersonal,
      legacyInput: { monthlySalary: p.monthlySalary, employeeType: 'employee' },
      legacyRequired: ['monthlySalary'],
      structuredAliases: ['socialInsurancePersonal'],
    }),
    earnedIncome: () => choose({
      name: 'earnedIncome', advancedFn: C.calcEarnedIncomeAdvanced,
      advancedInput: _earnedIncomeAdvancedInput(p), legacyFn: C.calcEarnedIncome,
      legacyInput: { grossSalary: p.totalSalary || p.annualIncome, dependents: p.dependents || 1 },
      legacyRequired: ['grossSalary'],
    }),
    mortgageDeduction: () => choose({
      name: 'mortgageDeduction', advancedFn: C.calcMortgageDeductionAdvanced,
      advancedInput: _mortgageAdvancedInput(p), legacyFn: C.calcMortgageDeduction,
      legacyInput: {
        annualInterest: Math.round((p.housingLoan || 0) * (p.housingLoanRate || 0.045)),
        grossSalary: p.totalSalary || p.annualIncome || 0,
      },
      legacyRequired: ['annualInterest', 'grossSalary'], structuredAliases: ['mortgage'],
    }),
    compoundInterest: () => {
      const structured = _sectionInput(p, 'compoundInterest');
      const legacyInput = {
        principal: p.currentSaving,
        monthlyDeposit: Math.round((p.monthlySalary || 0) * 0.15),
        years: Math.max(1, (p.retireAge || 60) - (p.age || 0)),
      };
      runLegacyOnly({
        name: 'compoundInterest',
        fn: C.calcCompoundInterest,
        legacyInput,
        structuredInput: structured,
        explicitRequired: ['principal', 'monthlyDeposit', 'annualRate', 'years', 'compoundFreq', 'timing'],
      });
    },
    opportunityCost: () => {
      const structured = _sectionInput(p, 'opportunityCost');
      const legacyInput = {
        monthlyAmount: p.insurancePremium,
        baseYears: Math.max(1, (p.retireAge || 60) - (p.age || 35)),
      };
      runLegacyOnly({
        name: 'opportunityCost',
        fn: C.calcOpportunityCost,
        legacyInput,
        structuredInput: structured,
        explicitRequired: ['monthlyAmount', 'baseYears', 'annualRate', 'delayYears'],
      });
    },

    // ── 개인 신규 상위 엔진 ──
    insurancePortfolio: () => tryCalc('insurancePortfolio', C.calcInsurancePortfolioAnalysis,
      _mergeDefined({
        policies: p.policies, requiredCoverage: p.requiredCoverage, planOptions: p.planOptions,
        monthlyIncome: p.monthlyIncome, currentAge: _firstDefined(p.currentAge, p.age),
        projectionYears: p.projectionYears, annualRenewalRate: p.annualRenewalRate,
        targetPremiumRate: p.targetPremiumRate, maxPremiumRate: p.maxPremiumRate,
      }, _sectionInput(p, 'insurancePortfolio', ['insurance'])), 'advanced'),
    retirementScenarios: () => tryCalc('retirementScenarios', C.calcRetirementScenarioMatrix,
      _mergeDefined({
        currentAge: _firstDefined(p.currentAge, p.age), retireAge: p.retireAge,
        monthlyExpense: p.monthlyExpense, currentSaving: p.currentSaving,
        ssMonthly: p.ssMonthly, otherMonthly: p.otherMonthly, saveRate: p.saveRate,
        annualIncome: p.annualIncome, inflationRate: p.inflationRate,
        lifeExpectancies: p.lifeExpectancies, returnScenarios: p.returnScenarios,
      }, _sectionInput(p, 'retirementScenarios', ['retirementScenarioMatrix'])), 'advanced'),
    pensionWithdrawalOrder: () => tryCalc('pensionWithdrawalOrder', C.calcPensionWithdrawalOrder,
      _mergeDefined({
        accounts: p.accounts, strategies: p.strategies, monthlyNetNeed: p.monthlyNetNeed,
        years: p.withdrawalYears, currentAge: _firstDefined(p.currentAge, p.age),
        inflationRate: p.inflationRate,
      }, _sectionInput(p, 'pensionWithdrawalOrder')), 'advanced'),
    goalFunding: () => tryCalc('goalFunding', C.calcGoalFundingPlan,
      _mergeDefined({ goals: p.goals, availableMonthly: p.availableMonthly },
        _sectionInput(p, 'goalFunding', ['goals'])), 'advanced'),
    emergencyFund: () => tryCalc('emergencyFund', C.calcEmergencyFundAdequacy,
      _mergeDefined({
        monthlyEssentialExpense: p.monthlyEssentialExpense, desiredMonths: p.desiredMonths,
        cash: p.cash, demandDeposit: p.demandDeposit, shortTermDeposit: p.shortTermDeposit,
        otherLiquidAssets: p.otherLiquidAssets, shortTermLiabilities: p.shortTermLiabilities,
      }, _sectionInput(p, 'emergencyFund')), 'advanced'),
    portfolioStress: () => tryCalc('portfolioStress', C.calcPortfolioStressTest,
      _mergeDefined({
        assets: p.assets, scenarios: p.scenarios, incomeInterruptionMonths: p.incomeInterruptionMonths,
        monthlyCashDeficit: p.monthlyCashDeficit, maxTolerableLoss: p.maxTolerableLoss,
        maxTolerableLossRate: p.maxTolerableLossRate,
      }, _sectionInput(p, 'portfolioStress', ['stressTest'])), 'advanced'),
    rebalancing: () => tryCalc('rebalancing', C.calcRebalancingPlan,
      _mergeDefined({
        currentAssets: p.currentAssets, targetWeights: p.targetWeights, minTradeAmount: p.minTradeAmount,
      }, _sectionInput(p, 'rebalancing')), 'advanced'),
    personalAdvanced: () => tryCalc('personalAdvanced', C.calcPersonalAdvanced,
      _sectionInput(p, 'personalAdvanced', ['personal']), 'advanced'),

    // ── 법인 기존 trigger + Advanced 우선 연결 ──
    corporateTax: () => choose({
      name: 'corporateTax', advancedFn: C.calcCorporateTaxAdvanced,
      advancedInput: _corporateTaxAdvancedInput(p), legacyFn: C.calcCorporateTax,
      legacyInput: { taxableIncome: p.taxableIncome, corpType: p.corpType || 'sme' },
      legacyRequired: ['taxableIncome'],
    }),
    severanceTax: () => choose({
      name: 'severanceTax', advancedFn: C.calcSeveranceTaxAdvanced,
      advancedInput: _mergeDefined({ severancePay: p.severancePay, serviceYears: p.serviceYears,
        priorSettlement: p.priorSettlement, priorYears: p.priorYears,
        retirementRuleConfirmed: p.retirementRuleConfirmed,
        realisticRetirementConfirmed: p.realisticRetirementConfirmed,
        taxLimitConfirmed: p.taxLimitConfirmed }, _sectionInput(p, 'severanceTax')),
      legacyFn: C.calcSeveranceTax,
      legacyInput: { severancePay: p.severancePay, serviceYears: p.serviceYears },
      legacyRequired: ['severancePay', 'serviceYears'],
    }),
    deemedInterest: () => choose({
      name: 'deemedInterest', advancedFn: C.calcDeemedInterestAdvanced,
      advancedInput: _deemedInterestAdvancedInput(p), legacyFn: C.calcDeemedInterest,
      legacyInput: {
        loanAmount: p.loanAmount, interestRate: p.loanRate || 0, deemedRate: 0.046,
        corpTaxableIncome: p.taxableIncome, corpType: p.corpType || 'sme',
        marginalRate: p.incomeMarginalRate,
      },
      legacyRequired: ['loanAmount'],
    }),
    deemedInterestFull: () => {
      const structured = _sectionInput(p, 'deemedInterestFull');
      const legacyInput = {
        loanAmount: p.loanAmount, actualRate: 0, ceoSalary: p.ceoSalary,
        corpTaxableIncome: p.taxableIncome || 0, shareRatio: p.shareRatio || 1.0,
        corpType: p.corpType || 'sme',
      };
      runLegacyOnly({
        name: 'deemedInterestFull',
        fn: C.calcDeemedInterestFull,
        legacyInput,
        structuredInput: structured,
        explicitRequired: ['loanAmount', 'actualRate', 'deemedRate', 'ceoSalary', 'ceoOtherIncome', 'shareRatio', 'corpTaxableIncome', 'corpType'],
      });
    },
    salaryVsDividend: () => {
      const advancedInput = _sectionInput(p, 'salaryVsDividend', ['ownerCompensationMix']);
      if (requestedMode === 'advanced' || (requestedMode === 'auto' && Object.keys(advancedInput).length)) {
        tryCalc('salaryVsDividend', C.calcOwnerCompensationMix, advancedInput, 'advanced');
      } else {
        tryCalc('salaryVsDividend', C.calcSalaryVsDividend,
          { totalAmount: p.ceoSalary, corpTaxableIncome: p.taxableIncome || 0 },
          'legacy');
      }
    },
    inheritanceTax: () => choose({
      name: 'inheritanceTax', advancedFn: C.calcInheritanceTaxAdvanced,
      advancedInput: _inheritanceAdvancedInput(p), legacyFn: C.calcInheritanceTax,
      legacyInput: {
        totalAssets: p.totalAssets, debts: p.debts || 0,
        hasSpouse: p.hasSpouse !== false, numChildren: (p.numChildren != null ? p.numChildren : 2),
        financialAssets: p.financialAssets || 0,
      },
      legacyRequired: ['totalAssets'], structuredAliases: ['inheritance'],
    }),
    corpVsIndividual: () => choose({
      name: 'corpVsIndividual', advancedFn: C.calcCorpVsIndividualAdvanced,
      advancedInput: _sectionInput(p, 'corpVsIndividual'), legacyFn: C.calcCorpVsIndividual,
      legacyInput: { annualProfit: p.annualProfit, ceoSalary: p.ceoSalary,
        isSME: (p.corpType || 'sme') === 'sme', corpType: p.corpType || 'sme' },
      legacyRequired: ['annualProfit', 'ceoSalary'],
    }),
    unlistedStock: () => choose({
      name: 'unlistedStock', advancedFn: C.calcUnlistedStockValueAdvanced,
      advancedInput: _unlistedAdvancedInput(p), legacyFn: C.calcUnlistedStockValue,
      legacyInput: {
        netAssets: p.netAssets, earningsValue: p.netProfitValue || ((p.annualProfit || 0) / 0.1),
        industry: p.industry, totalShares: p.totalShares || 10000,
        targetShares: p.ceoShares || p.totalShares || 10000,
      },
      legacyRequired: ['netAssets'],
      structuredAliases: ['unlistedStockValue'],
    }),
    businessSuccession: () => {
      const structured = _sectionInput(p, 'businessSuccession');
      const legacyInput = {
        netAssets: p.netAssets, earningsValue: p.netProfitValue || ((p.annualProfit || 0) / 0.1),
        industry: p.industry, ceoAge: p.ceoAge, successorAge: Math.max(20, (p.ceoAge || 50) - 28),
        ceoShares: p.ceoShares || 0, totalShares: p.totalShares || 10000,
      };
      runLegacyOnly({
        name: 'businessSuccession',
        fn: C.calcBusinessSuccession,
        legacyInput,
        structuredInput: structured,
        explicitRequired: ['netAssets', 'earningsValue', 'industry', 'totalShares', 'ceoShares', 'ceoAge', 'successorAge', 'yearsInBusiness', 'revenue', 'assetTotal', 'annualGrowth', 'priorGifts'],
      });
    },
    corpLiquidation: () => choose({
      name: 'corpLiquidation', advancedFn: C.calcCorpLiquidationAdvanced,
      advancedInput: _sectionInput(p, 'corpLiquidation'), legacyFn: C.calcCorpLiquidation,
      legacyInput: { residualAssets: p.totalAssets, retainedEarnings: p.retainedEarnings,
        isSME: (p.corpType || 'sme') === 'sme', corpType: p.corpType || 'sme' },
      legacyRequired: ['residualAssets', 'retainedEarnings'],
    }),
    socialInsuranceCorp: () => choose({
      name: 'socialInsuranceCorp', advancedFn: C.calcSocialInsuranceCorpAdvanced,
      advancedInput: _socialInsuranceCorpAdvancedInput(p), legacyFn: C.calcSocialInsuranceCorp,
      legacyInput: { totalMonthlySalary: Math.round((p.ceoSalary || 0) / 12), numEmployees: p.numEmployees || 10 },
      legacyRequired: ['totalMonthlySalary'],
    }),

    // ── 법인 신규 상위 엔진 ──
    businessValue: () => tryCalc('businessValue', C.calcBusinessValueAdvanced,
      _mergeDefined(p, _sectionInput(p, 'businessValue')), 'advanced'),
    keyPersonLoss: () => tryCalc('keyPersonLoss', C.calcKeyPersonLossNeed,
      _mergeDefined(p, _sectionInput(p, 'keyPersonLoss', ['corpKeymanNeed'])), 'advanced'),
    shareBuyout: () => tryCalc('shareBuyout', C.calcShareBuyoutNeed,
      _mergeDefined(p, _sectionInput(p, 'shareBuyout')), 'advanced'),
    deemedLoanOptions: () => tryCalc('deemedLoanOptions', C.calcDeemedLoanResolutionOptions,
      _mergeDefined(p, _sectionInput(p, 'deemedLoanOptions')), 'advanced'),
    ownerCompensationMix: () => tryCalc('ownerCompensationMix', C.calcOwnerCompensationMix,
      _mergeDefined(p, _sectionInput(p, 'ownerCompensationMix')), 'advanced'),
    successionFunding: () => tryCalc('successionFunding', C.calcSuccessionFundingNeed,
      _mergeDefined(p, _sectionInput(p, 'successionFunding')), 'advanced'),
    corporateAdvanced: () => tryCalc('corporateAdvanced', C.calcCorporateAdvanced,
      _sectionInput(p, 'corporateAdvanced', ['corporate']), 'advanced'),
    corporateTaxSuite: () => tryCalc('corporateTaxSuite', C.calcCorporateTaxSuiteAdvanced,
      _sectionInput(p, 'corporateTaxSuite', ['taxCorporate']), 'advanced'),
    financialAnalysis: () => tryCalc('financialAnalysis', C.calcFinancialAnalysisAdvanced,
      _mergeDefined({
        statements: p.statements, balanceToleranceRate: p.balanceToleranceRate,
        employeesByYear: p.employeesByYear, effectiveTaxRate: p.effectiveTaxRate,
        monthlyFixedCost: p.monthlyFixedCost, industryAvg: p.industryAvg,
      }, _sectionInput(p, 'financialAnalysis', ['financialStatements'])), 'advanced'),

    // ── 개인 세무 추가 연결 ──
    rentalIncome: () => tryCalc('rentalIncome', C.calcRentalIncomeAdvanced,
      _mergeDefined(p, _sectionInput(p, 'rentalIncome')), 'advanced'),
    globalIncome: () => tryCalc('globalIncome', C.calcGlobalIncomeAdvanced,
      _mergeDefined(p, _sectionInput(p, 'globalIncome')), 'advanced'),
    isaSavings: () => tryCalc('isaSavings', C.calcISASavingsAdvanced,
      _mergeDefined(p, _sectionInput(p, 'isaSavings', ['isa'])), 'advanced'),
    startupTaxCredit: () => tryCalc('startupTaxCredit', C.calcStartupTaxCreditAdvanced,
      _mergeDefined(p, _sectionInput(p, 'startupTaxCredit')), 'advanced'),
    personalTaxSuite: () => tryCalc('personalTaxSuite', C.calcPersonalTaxAdvanced,
      _sectionInput(p, 'personalTaxSuite', ['taxPersonal']), 'advanced'),

    // ── 기업 세무 추가 연결 ──
    taxBaseChange: () => tryCalc('taxBaseChange', C.calcCorporateTaxBaseChangeAdvanced,
      _mergeDefined(p, _sectionInput(p, 'taxBaseChange')), 'advanced'),
    entertainmentLimit: () => tryCalc('entertainmentLimit', C.calcEntertainmentLimitAdvanced,
      _mergeDefined(p, _sectionInput(p, 'entertainmentLimit')), 'advanced'),
    employmentCredit: () => tryCalc('employmentCredit', C.calcEmploymentCreditAdvanced,
      _mergeDefined(p, _sectionInput(p, 'employmentCredit')), 'advanced'),
    rndCredit: () => tryCalc('rndCredit', C.calcRnDCreditAdvanced,
      _mergeDefined(p, _sectionInput(p, 'rndCredit')), 'advanced'),
    welfareFund: () => tryCalc('welfareFund', C.calcWelfareFundAdvanced,
      _mergeDefined(p, _sectionInput(p, 'welfareFund')), 'advanced'),
    stockOption: () => tryCalc('stockOption', C.calcStockOptionAdvanced,
      _mergeDefined(p, _sectionInput(p, 'stockOption')), 'advanced'),
    overseasAsset: () => tryCalc('overseasAsset', C.calcOverseasAssetAdvanced,
      _mergeDefined(p, _sectionInput(p, 'overseasAsset')), 'advanced'),
    holdingCompany: () => tryCalc('holdingCompany', C.calcHoldingCompanyAdvanced,
      _mergeDefined(p, _sectionInput(p, 'holdingCompany')), 'advanced'),
    mergerTax: () => tryCalc('mergerTax', C.calcMergerTaxAdvanced,
      _mergeDefined(p, _sectionInput(p, 'mergerTax')), 'advanced'),
    profitRetirement: () => tryCalc('profitRetirement', C.calcProfitRetirementAdvanced,
      _mergeDefined(p, _sectionInput(p, 'profitRetirement')), 'advanced'),
    differentialDividend: () => tryCalc('differentialDividend', C.calcDifferentialDividendAdvanced,
      _mergeDefined(p, _sectionInput(p, 'differentialDividend')), 'advanced'),
    inventionCompensation: () => tryCalc('inventionCompensation', C.calcInventionCompensationAdvanced,
      _mergeDefined(p, _sectionInput(p, 'inventionCompensation')), 'advanced'),
    patentCapitalization: () => tryCalc('patentCapitalization', C.calcPatentCapitalizationAdvanced,
      _mergeDefined(p, _sectionInput(p, 'patentCapitalization')), 'advanced'),
    carryforwardLoss: () => tryCalc('carryforwardLoss', C.calcCarryforwardLossAdvanced,
      _mergeDefined(p, _sectionInput(p, 'carryforwardLoss')), 'advanced'),

    // ── 기업분석 추가 연결 ──
    financialValidation: () => tryCalc('financialValidation', C.validateFinancialStatements,
      _mergeDefined({ statements: p.statements, balanceToleranceRate: p.balanceToleranceRate },
        _sectionInput(p, 'financialValidation')), 'advanced'),
    financialTrend: () => tryCalc('financialTrend', C.calcFinancialTrendAdvanced,
      _mergeDefined(p, _sectionInput(p, 'financialTrend')), 'advanced'),
    financialRatiosAdvanced: () => tryCalc('financialRatiosAdvanced', C.calcFinancialRatiosAdvanced,
      _mergeDefined(p, _sectionInput(p, 'financialRatiosAdvanced')), 'advanced'),
    cashFlowRisk: () => runLegacyOnly({
      name: 'cashFlowRisk',
      fn: C.calcCashFlowRisk,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'cashFlowRisk'),
      explicitRequired: ['cash', 'currentAssets', 'currentLiab', 'inventory', 'receivables', 'payables', 'revenue', 'cogs', 'monthlyFixedCost', 'operatingProfit', 'shortTermBorrow'],
    }),
    industryComparison: () => runLegacyOnly({
      name: 'industryComparison',
      fn: C.calcIndustryComparison,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'industryComparison'),
      explicitRequired: ['companyRatios', 'industryAvg'],
    }),
    smeTaxBenefits: () => runLegacyOnly({
      name: 'smeTaxBenefits',
      fn: C.calcSMETaxBenefits,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'smeTaxBenefits'),
      explicitRequired: ['industryCode', 'revenue', 'employees', 'foundedYear', 'isCapitalArea', 'operatingProfit', 'investAmount', 'prevInvestAvg', 'newHires', 'newYouthHires', 'rndExpense', 'rndType', 'socialInsurance', 'currentYear', 'corpType'],
    }),
    severanceAdequacy: () => runLegacyOnly({
      name: 'severanceAdequacy',
      fn: C.calcSeveranceAdequacy,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'severanceAdequacy'),
      explicitRequired: ['severanceReserve', 'numExecutives', 'numEmployees', 'avgYearsService', 'avgSalary', 'executiveAvgSalary', 'executiveAvgYears', 'charterMultiplier', 'annualSalaryIncrease'],
    }),
    policyFundEligibility: () => runLegacyOnly({
      name: 'policyFundEligibility',
      fn: C.calcPolicyFundEligibility,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'policyFundEligibility'),
      explicitRequired: ['industryCode', 'revenue', 'employees', 'foundedYear', 'totalAssets', 'isCapitalArea', 'ceoAge', 'exportAmount', 'isVenture', 'currentYear'],
    }),

    // ── 기존 클로징 trigger ──
    ltcNeed: () => runLegacyOnly({
      name: 'ltcNeed',
      fn: C.calcLtcNeed,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'ltcNeed'),
      explicitRequired: ['monthlyCareCost', 'careYears', 'startInYears', 'copayRate', 'existingLtcMonthly', 'returnRate', 'inflationRate'],
    }),
    lifeInsuranceNeed: () => runLegacyOnly({
      name: 'lifeInsuranceNeed',
      fn: C.calcLifeInsuranceNeed,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'lifeInsuranceNeed'),
      explicitRequired: ['monthlyLivingCost', 'supportYears', 'educationCost', 'debt', 'emergencyFund', 'liquidAssets', 'existingCoverage', 'returnRate', 'inflationRate'],
    }),
    criticalIllnessNeed: () => runLegacyOnly({
      name: 'criticalIllnessNeed',
      fn: C.calcCriticalIllnessNeed,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'criticalIllnessNeed'),
      explicitRequired: ['treatmentCost', 'recoveryMonths', 'monthlyIncome', 'incomeLossRate', 'extraCost', 'existingDiagnosisBenefit'],
    }),
    healthInsuranceRetiree: () => runLegacyOnly({
      name: 'healthInsuranceRetiree',
      fn: C.calcHealthInsuranceRetiree,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'healthInsuranceRetiree'),
      explicitRequired: ['retireAge', 'lifeExpectancy', 'confirmedDependentEligible|confirmedMonthlyInsurance|useLegacyEstimate'],
    }),
    pensionDepositIRP: () => runLegacyOnly({
      name: 'pensionDepositIRP',
      fn: C.calcPensionDepositIRP,
      legacyInput: p,
      structuredInput: _sectionInput(p, 'pensionDepositIRP'),
      explicitRequired: ['annualContribution', 'yearsToContribute', 'globalIncome', 'expectedReturn', 'withdrawTaxRate'],
    }),
    financialIncome: () => choose({
      name: 'financialIncome', advancedFn: C.calcFinancialIncomeAdvanced,
      advancedInput: _mergeDefined(p, _sectionInput(p, 'financialIncome')),
      legacyFn: C.calcFinancialIncome, legacyInput: p,
      legacyRequired: ['interestIncome', 'dividendIncome'],
    }),
    giftTax: () => choose({
      name: 'giftTax', advancedFn: C.calcGiftTaxAdvanced,
      advancedInput: _mergeDefined(p, _sectionInput(p, 'giftTax')),
      legacyFn: C.calcGiftTax, legacyInput: p,
      legacyRequired: ['giftAmount', 'relation'],
    }),
    corpKeymanNeed: () => {
      const advancedInput = _sectionInput(p, 'corpKeymanNeed', ['keyPersonLoss']);
      if (requestedMode === 'advanced' || (requestedMode === 'auto' && Object.keys(advancedInput).length)) {
        tryCalc('corpKeymanNeed', C.calcKeyPersonLossNeed, advancedInput, 'advanced');
      } else {
        tryCalc('corpKeymanNeed', C.calcCorpKeymanNeed, p, 'legacy');
      }
    },
    familyCorpGiftPresumption: () => choose({
      name: 'familyCorpGiftPresumption', advancedFn: C.calcFamilyCorpGiftPresumptionAdvanced,
      advancedInput: _mergeDefined(p, _sectionInput(p, 'familyCorpGiftPresumption')),
      legacyFn: C.calcFamilyCorpGiftPresumption, legacyInput: p,
      legacyRequired: ['familyCorpRevenue', 'relatedPartyRevenueRatio', 'shareRatio'],
    }),
    vehicleExpense: () => choose({
      name: 'vehicleExpense', advancedFn: C.calcVehicleExpenseAdvanced,
      advancedInput: _mergeDefined(p, _sectionInput(p, 'vehicleExpense')),
      legacyFn: C.calcVehicleExpense, legacyInput: p,
      legacyRequired: ['vehiclePrice', 'annualFuelCost'],
    }),
    nomineeTrust: () => choose({
      name: 'nomineeTrust', advancedFn: C.calcNomineeTrustAdvanced,
      advancedInput: _mergeDefined({
        stockValue: _firstDefined(p.stockValue,
          _hasValue(p.shareValue) && _hasValue(p.nomineeShares) ? Number(p.shareValue) * Number(p.nomineeShares) : undefined),
        priorGifts: p.priorGifts, taxYear: p.taxYear,
        aggregatePriorGifts: p.aggregatePriorGifts,
        confirmedPriorGiftTax: p.confirmedPriorGiftTax,
        confirmedPenaltyAmount: p.confirmedPenaltyAmount,
      }, _sectionInput(p, 'nomineeTrust')),
      legacyFn: C.calcNomineeTrust,
      legacyInput: {
        stockValue: p.stockValue || (p.shareValue || 0) * (p.nomineeShares || 0),
        priorGifts: p.priorGifts || 0,
        hasEvasionIntent: p.hasEvasionIntent !== false,
      },
      legacyRequired: ['stockValue'],
    }),
  };

  for (const id of triggers) {
    if (typeof RUN[id] === 'function') RUN[id]();
    else {
      results[id] = _incompleteResult(id, [], [`지원하지 않는 계산기 트리거입니다: ${id}`], { unsupported: true });
      console.warn(`[calculateForTopic] 미지원 트리거: ${id} (slug=${slug})`);
      dispatch.unsupported.push(id);
      dispatch.modesByTrigger[id] = 'unsupported';
    }
  }

  console.log(
    `[calculateForTopic] ${slug}: 완료 ${dispatch.successful.length}, 부분완료 ${dispatch.partial.length}, ` +
    `미완료 ${dispatch.incomplete.length}, 미지원 ${dispatch.unsupported.length}, 오류 ${dispatch.errors.length}`
  );

  Object.defineProperty(results, '_dispatch', {
    value: dispatch,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return results;
}

// ═══════════════════════════════════════════════════════════════════
// 공용 계산기 게이트웨이
// ───────────────────────────────────────────────────────────────────
// 여러 프로그램이 계산기 내부 파일이나 함수 조합을 직접 알지 않아도 되도록
// 단일 표준 호출 calculate({ calculatorId, mode, input }) 을 제공한다.
// 기존 직접 export와 calculateForTopic()은 하위 호환을 위해 그대로 유지한다.
// ═══════════════════════════════════════════════════════════════════

const CALCULATOR_GATEWAY_VERSION = '1.3.0';
const _GATEWAY_MODES = new Set(['auto', 'advanced', 'legacy']);

function _toLogicalCalculatorId(exportName) {
  if (typeof exportName !== 'string' || !/^calc[A-Z]/.test(exportName) || exportName.length <= 4) {
    return null;
  }
  const withoutPrefix = exportName.slice(4).replace(/Advanced$/, '');
  const acronymNormalized = withoutPrefix.replace(/^[A-Z]+(?=[A-Z][a-z]|$)/, value => value.toLowerCase());
  return acronymNormalized.charAt(0).toLowerCase() + acronymNormalized.slice(1);
}

const _ADVANCED_SEMANTIC_FUNCTIONS = new Set([
  'calcInsurancePortfolioAnalysis', 'calcRetirementScenarioMatrix', 'calcPensionWithdrawalOrder',
  'calcGoalFundingPlan', 'calcEmergencyFundAdequacy', 'calcPortfolioStressTest', 'calcRebalancingPlan',
  'calcKeyPersonLossNeed', 'calcShareBuyoutNeed', 'calcDeemedLoanResolutionOptions',
  'calcOwnerCompensationMix', 'calcSuccessionFundingNeed',
]);

// 위치 인자를 받거나 단일 숫자를 반환하는 보조함수는 객체형 공용 게이트웨이에 등록하지 않는다.
const _SCALAR_UTILITY_FUNCTIONS = new Set([
  'calculateFV','calculatePV','calculatePMT','calculateRate','calculateNPER',
  'calcProgressiveTax','calcIncomeTaxProgressive','calcYearDeduction','calcConvertedDeduction','calcEarnedIncomeDeduction',
]);

function _buildCalculatorRegistry() {
  const registry = {};
  for (const [exportName, fn] of Object.entries(_gatewayCalcs)) {
    if (typeof fn !== 'function' || _SCALAR_UTILITY_FUNCTIONS.has(exportName)) continue;
    const logicalId = _toLogicalCalculatorId(exportName);
    if (!logicalId) continue;
    if (!registry[logicalId]) {
      registry[logicalId] = {
        calculatorId: logicalId,
        legacyFunction: null,
        advancedFunction: null,
      };
    }
    if (exportName.endsWith('Advanced') || _ADVANCED_SEMANTIC_FUNCTIONS.has(exportName)) {
      registry[logicalId].advancedFunction = exportName;
    } else {
      registry[logicalId].legacyFunction = exportName;
    }
  }

  // calc 접두어가 없는 공용 분석 함수도 표준 id로 노출한다.
  if (typeof _gatewayCalcs.validateFinancialStatements === 'function') {
    registry.financialValidation = {
      calculatorId: 'financialValidation',
      legacyFunction: null,
      advancedFunction: 'validateFinancialStatements',
    };
  }

  return registry;
}

const _calculatorRegistry = _buildCalculatorRegistry();

// 프로그램에서 이미 사용하던 짧은 trigger id를 표준 계산기 id에 연결한다.
const _calculatorAliases = Object.freeze({
  insurancePortfolio: 'insurancePortfolioAnalysis',
  retirementScenarios: 'retirementScenarioMatrix',
  personalAdvanced: 'personal',
  corporateAdvanced: 'corporate',
  emergencyFund: 'emergencyFundAdequacy',
  goalFunding: 'goalFundingPlan',
  portfolioStress: 'portfolioStressTest',
  rebalancing: 'rebalancingPlan',
  personalTaxSuite: 'personalTax',
  socialInsurance: 'socialInsurancePersonal',
  unlistedStock: 'unlistedStockValue',
  rndCredit: 'rnDCredit',
  businessValue: 'businessValue',
  keyPersonLoss: 'keyPersonLossNeed',
  corpKeymanNeedAdvanced: 'keyPersonLossNeed',
  shareBuyout: 'shareBuyoutNeed',
  deemedLoanOptions: 'deemedLoanResolutionOptions',
  successionFunding: 'successionFundingNeed',
  corporateTaxSuite: 'corporateTaxSuite',
  taxBaseChange: 'corporateTaxBaseChange',
  financialAnalysis: 'financialAnalysis',
  financialRatiosAdvanced: 'financialRatios',
});

function _gatewayEnvelope({
  requestedCalculatorId = '',
  calculatorId = '',
  requestedMode = 'auto',
  executedMode = null,
  functionName = null,
  result = null,
  errorCode = null,
  errorMessage = null,
}) {
  const resultObject = result && typeof result === 'object' ? result : null;
  const missingInputs = resultObject && Array.isArray(resultObject.missingInputs)
    ? resultObject.missingInputs.slice() : [];
  const invalidInputs = resultObject && Array.isArray(resultObject.invalidInputs)
    ? resultObject.invalidInputs.slice() : [];
  const warnings = resultObject && Array.isArray(resultObject.warnings)
    ? resultObject.warnings.slice() : [];
  if (errorMessage && !warnings.includes(errorMessage)) warnings.push(errorMessage);

  const calculated = !!resultObject && resultObject.calculated !== false && !errorCode;
  return {
    ok: calculated,
    calculated,
    gatewayVersion: CALCULATOR_GATEWAY_VERSION,
    requestedCalculatorId,
    calculatorId,
    requestedMode,
    executedMode,
    functionName,
    result: resultObject,
    missingInputs,
    invalidInputs,
    warnings,
    error: errorCode ? { code: errorCode, message: errorMessage || errorCode } : null,
  };
}

function _resolveGatewayCalculator(calculatorId) {
  if (typeof calculatorId !== 'string' || !calculatorId.trim()) return null;
  const requested = calculatorId.trim();

  // 기존 export 함수명을 정확히 지정하면 그 함수를 그대로 실행한다.
  if (typeof _gatewayCalcs[requested] === 'function') {
    const logicalId = _toLogicalCalculatorId(requested) || requested;
    return {
      requested,
      calculatorId: logicalId,
      exactFunctionName: requested,
      entry: _calculatorRegistry[logicalId] || null,
    };
  }

  const aliased = _calculatorAliases[requested] || requested;
  const entry = _calculatorRegistry[aliased];
  if (!entry) return null;
  return {
    requested,
    calculatorId: aliased,
    exactFunctionName: null,
    entry,
  };
}

const _GATEWAY_REQUIRED_INPUTS = Object.freeze({
  businessSuccession: ['netAssets','earningsValue','totalShares','ceoShares'],
  businessValue: ['statements|financials|revenue'],
  capitalGainsTax: ['transferPrice','acquisitionPrice','assetType'],
  carryforwardLoss: ['carryforwardLoss','currentIncome'],
  cashFlowRisk: ['currentAssets','currentLiab','revenue'],
  childInsuranceNeed: ['diagnosisCost|hospitalDailyCost|surgeryReserve|eduContinuity'],
  compoundInterest: ['principal|monthlyDeposit','years'],
  corpKeymanNeed: ['annualRevenue|annualProfit|guaranteedDebt|replacementCost'],
  corpLiquidation: ['residualAssets'],
  corporateTax: ['taxableIncome'],
  corpVsIndividual: ['annualProfit','ceoSalary'],
  criticalIllnessNeed: ['treatmentCost|monthlyIncome'],
  deemedInterest: ['loanAmount'],
  deemedInterestFull: ['loanAmount'],
  differentialDividend: ['totalDividend|dividendAmount'],
  earnedIncome: ['grossSalary'],
  employmentCredit: ['newEmployees|currentEmployees'],
  entertainmentLimit: ['revenue','actualExpense'],
  familyCorpGiftPresumption: ['relatedPartyRevenue|familyCorpRevenue','shareRatio'],
  financialIncome: ['interestIncome|dividendIncome'],
  financialRatios: ['current'],
  giftTax: ['giftAmount','relation'],
  globalIncome: ['businessIncome|rentalIncome|earnedIncome|pensionIncome|otherIncome'],
  healthInsuranceRetiree: ['confirmedDependentEligible|confirmedMonthlyInsurance|useLegacyEstimate'],
  holdingCompany: ['dividendReceived','ownershipRatio'],
  housingPension: ['age','homeValue'],
  industryComparison: ['companyRatios','industryAvg'],
  inheritanceTax: ['totalAssets'],
  insuranceAffordability: ['monthlyIncome','protectionPremium'],
  inventionCompensation: ['compensation'],
  isaSavings: ['annualDeposit','years'],
  lifeInsuranceNeed: ['monthlyLivingCost','supportYears'],
  ltcNeed: ['monthlyCareCost','careYears'],
  lumpSumVsPensionTax: ['severancePay'],
  medicalExpenseExposure: ['annualMedicalCost'],
  mergerTax: ['bookValue','fairValue'],
  mortgageDeduction: ['annualInterest'],
  nationalPensionTiming: ['normalMonthly'],
  nomineeTrust: ['stockValue'],
  opportunityCost: ['monthlyAmount','baseYears'],
  overseasAsset: ['overseasBalance|monthlyEndBalances'],
  patentCapitalization: ['transferPrice'],
  pension: ['monthlyPmt|principal','accumYears','receiveYears'],
  pensionByPillar: ['targetMonthly'],
  pensionDepositIRP: ['annualContribution','yearsToContribute'],
  pensionPlan: ['currentAge','retireAge','monthlyContribution'],
  personalPPT: ['age','annualIncome'],
  policyFundEligibility: ['industryCode','revenue','employees'],
  privatePensionTax: ['annualPension'],
  profitRetirement: ['redemptionValue','acquisitionCost'],
  rentalIncome: ['annualRent|deposit'],
  retirementCrevasse: ['retireAge','pensionStartAge','monthlyExpense'],
  retirementNeed: ['currentAge','retireAge','annualIncome'],
  retirementSave: ['currentAge','retireAge','goalAmount'],
  rnDCredit: ['currentRnD'],
  salaryVsDividend: ['totalAmount'],
  severanceAdequacy: ['severanceReserve','numEmployees|numExecutives'],
  severanceTax: ['severancePay','serviceYears'],
  smeTaxBenefits: ['industryCode','revenue','operatingProfit'],
  socialInsuranceCorp: ['totalMonthlySalary|monthlySalaries'],
  socialInsurancePersonal: ['monthlySalary'],
  startupTaxCredit: ['annualIncomeTax','foundedYear|foundYear'],
  stockOption: ['marketPrice','exercisePrice','shares'],
  taxCredit: ['totalSalary','pensionSaving|irp'],
  termVsWholeLife: ['wholeLifeMonthlyPremium','termMonthlyPremium','payYears'],
  unlistedStockValue: ['netAssets'],
  vehicleExpense: ['vehiclePrice','annualFuelCost|annualLeaseFee|annualRentFee'],
  welfareFund: ['outputAmount'],
  withdrawDuration: ['balance','monthlyWithdraw'],
});

function _normalizeGatewayResult(functionName, result) {
  if (functionName === 'calcWithdrawDuration' && result && typeof result === 'object') {
    const perpetual = result.months === Infinity || result.years === Infinity;
    if (perpetual) return { ...result, months: null, years: null, exhaustAge: null, isPerpetual: true };
  }
  return result;
}

/**
 * 여러 프로그램이 공유하는 단일 표준 계산 호출.
 *
 * @param {Object} request
 * @param {string} request.calculatorId 논리 id 또는 기존 export 함수명
 * @param {'auto'|'advanced'|'legacy'} [request.mode='auto']
 * @param {Object} [request.input={}] 계산기 입력
 * @returns {Object} 공통 응답 envelope. 실제 계산결과는 result에 들어간다.
 *
 * 모드 규칙
 *  - 정확한 export 함수명을 지정한 경우: 해당 함수를 그대로 실행
 *  - 논리 id + auto: Advanced가 있으면 Advanced, 없으면 Legacy
 *  - 논리 id + advanced/legacy: 요청한 계열만 실행하고 없으면 미실행 응답
 */
function calculate(request) {
  const safeRequest = _isPlainObject(request) ? request : {};
  const requestedCalculatorId = typeof safeRequest.calculatorId === 'string'
    ? safeRequest.calculatorId.trim() : '';
  const requestedMode = _GATEWAY_MODES.has(safeRequest.mode) ? safeRequest.mode : 'auto';
  const input = _isPlainObject(safeRequest.input) ? safeRequest.input : {};

  if (!requestedCalculatorId) {
    return _gatewayEnvelope({
      requestedCalculatorId,
      requestedMode,
      errorCode: 'CALCULATOR_ID_REQUIRED',
      errorMessage: 'calculatorId가 필요합니다.',
    });
  }
  if (!_isPlainObject(safeRequest.input) && safeRequest.input !== undefined) {
    return _gatewayEnvelope({
      requestedCalculatorId,
      requestedMode,
      errorCode: 'INVALID_INPUT_OBJECT',
      errorMessage: 'input은 일반 객체여야 합니다.',
    });
  }

  const resolved = _resolveGatewayCalculator(requestedCalculatorId);
  if (!resolved) {
    return _gatewayEnvelope({
      requestedCalculatorId,
      requestedMode,
      errorCode: 'CALCULATOR_NOT_FOUND',
      errorMessage: `계산기를 찾을 수 없습니다: ${requestedCalculatorId}`,
    });
  }

  if (_SCALAR_UTILITY_FUNCTIONS.has(resolved.exactFunctionName)) {
    return _gatewayEnvelope({
      requestedCalculatorId,
      calculatorId: resolved.calculatorId,
      requestedMode,
      errorCode: 'POSITIONAL_UTILITY_NOT_SUPPORTED',
      errorMessage: '해당 함수는 위치 인자를 사용하는 내부 유틸리티이므로 공용 객체형 게이트웨이 대상이 아닙니다.',
    });
  }

  const requiredInputs = _GATEWAY_REQUIRED_INPUTS[resolved.calculatorId] || [];
  const missingGatewayInputs = _missingRequired(input, requiredInputs);
  if (missingGatewayInputs.length) {
    return _gatewayEnvelope({
      requestedCalculatorId,
      calculatorId: resolved.calculatorId,
      requestedMode,
      result: _incompleteResult(resolved.calculatorId, missingGatewayInputs, ['필수 입력값이 없어 계산을 실행하지 않았습니다.']),
    });
  }

  const unsafeInputPaths = _validateExecutionInput(input);
  if (unsafeInputPaths.length) {
    return _gatewayEnvelope({
      requestedCalculatorId,
      calculatorId: resolved.calculatorId,
      requestedMode,
      errorCode: 'UNSAFE_INPUT',
      errorMessage: '비정상 입력 또는 과도한 반복 가능성이 있는 값을 차단했습니다.',
      result: {
        calculated: false,
        missingInputs: [],
        invalidInputs: unsafeInputPaths,
        warnings: ['계산기 실행 전에 입력 안전검사에서 차단됐습니다.'],
      },
    });
  }

  let functionName = resolved.exactFunctionName;
  let executedMode = resolved.exactFunctionName
    ? (resolved.exactFunctionName.endsWith('Advanced') ? 'advanced-exact' : 'legacy-exact')
    : null;

  if (!functionName) {
    const entry = resolved.entry;
    if (requestedMode === 'advanced') {
      functionName = entry && entry.advancedFunction;
      executedMode = 'advanced';
    } else if (requestedMode === 'legacy') {
      functionName = entry && entry.legacyFunction;
      executedMode = 'legacy';
    } else {
      functionName = entry && (entry.advancedFunction || entry.legacyFunction);
      executedMode = entry && entry.advancedFunction ? 'advanced' : 'legacy';
    }
  }

  if (_SCALAR_UTILITY_FUNCTIONS.has(functionName)) {
    return _gatewayEnvelope({
      requestedCalculatorId,
      calculatorId: resolved.calculatorId,
      requestedMode,
      errorCode: 'POSITIONAL_UTILITY_NOT_SUPPORTED',
      errorMessage: '해당 함수는 위치 인자를 사용하거나 단일 숫자를 반환하는 내부 유틸리티이므로 공용 객체형 게이트웨이 대상이 아닙니다.',
    });
  }

  if (!functionName || typeof _gatewayCalcs[functionName] !== 'function') {
    const unavailableMode = requestedMode === 'auto' ? 'requested' : requestedMode;
    return _gatewayEnvelope({
      requestedCalculatorId,
      calculatorId: resolved.calculatorId,
      requestedMode,
      executedMode: null,
      errorCode: 'CALCULATOR_MODE_UNAVAILABLE',
      errorMessage: `${resolved.calculatorId} 계산기는 ${unavailableMode} 모드를 지원하지 않습니다.`,
    });
  }

  try {
    const rawResult = _gatewayCalcs[functionName](input);
    const result = _normalizeGatewayResult(functionName, rawResult);
    if (!result || typeof result !== 'object') {
      return _gatewayEnvelope({
        requestedCalculatorId,
        calculatorId: resolved.calculatorId,
        requestedMode,
        executedMode,
        functionName,
        errorCode: 'INVALID_CALCULATOR_RESULT',
        errorMessage: '계산기가 유효한 결과 객체를 반환하지 않았습니다.',
      });
    }

    const invalidResultPaths = _findNonFiniteNumbers(result);
    if (invalidResultPaths.length) {
      return _gatewayEnvelope({
        requestedCalculatorId,
        calculatorId: resolved.calculatorId,
        requestedMode,
        executedMode,
        functionName,
        errorCode: 'NON_FINITE_RESULT',
        errorMessage: '계산결과에 NaN 또는 Infinity가 포함돼 사용을 차단했습니다.',
        result: {
          calculated: false,
          missingInputs: [],
          invalidInputs: invalidResultPaths,
          warnings: ['계산결과 안전검사를 통과하지 못했습니다.'],
        },
      });
    }

    return _gatewayEnvelope({
      requestedCalculatorId,
      calculatorId: resolved.calculatorId,
      requestedMode,
      executedMode,
      functionName,
      result,
    });
  } catch (error) {
    const message = error && error.message ? error.message : '알 수 없는 계산 오류';
    return _gatewayEnvelope({
      requestedCalculatorId,
      calculatorId: resolved.calculatorId,
      requestedMode,
      executedMode,
      functionName,
      errorCode: 'CALCULATOR_EXECUTION_ERROR',
      errorMessage: message,
    });
  }
}


function _uiFailure(calculator, missingInputs = [], invalidInputs = [], warnings = []) {
  return { calculated: false, calculator, missingInputs, invalidInputs, warnings };
}

function _uiFinite(input, names) {
  for (const name of names) {
    const value = input && input[name];
    if (_hasValue(value) && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function _uiRate(input, names) {
  const value = _uiFinite(input, names);
  if (value === null) return null;
  return Math.abs(value) > 1 ? value / 100 : value;
}

function _uiWarnings(...results) {
  const values = [];
  for (const result of results) {
    if (!result || typeof result !== 'object') continue;
    if (Array.isArray(result.warnings)) values.push(...result.warnings);
    if (typeof result.warning === 'string' && result.warning.trim()) values.push(result.warning.trim());
    if (typeof result.note === 'string' && result.note.trim()) values.push(result.note.trim());
  }
  return _uniqueStrings(values);
}

/**
 * 브라우저 슬라이더용 고정 계약.
 * HTML은 이 함수만 호출하고 계산식·세율·공제 로직은 계산기 모듈에만 둔다.
 */
function calculateForUI(type, rawInput = {}) {
  const input = _isPlainObject(rawInput) ? rawInput : {};
  const requestedType = String(type || '').trim();
  const normalizedType = ({
    asset: 'financialIncome',
    corporate: 'inheritance',
    pensionYearlyProjection: 'pensionYearly',
  })[requestedType] || requestedType;

  if (normalizedType === 'pension') {
    const view = String(input.view || input.mode || 'full').trim().toLowerCase();
    const currentAge = _uiFinite(input, ['currentAge', 'ca']);
    const retireAge = _uiFinite(input, ['retireAge', 'ra']);
    const lifeExpectancy = _uiFinite(input, ['lifeExpectancy', 'le']);
    const currentAsset = _uiFinite(input, ['currentAsset', 'principal', 'asset']);
    const monthlyDeposit = _uiFinite(input, ['monthlyDeposit', 'monthlyPmt', 'dep']);
    const depositYears = _uiFinite(input, ['depositYears', 'depy']);
    const accumRate = _uiRate(input, ['accumRate', 'annualReturnRate', 'rate']);
    const receiveRate = _uiRate(input, ['receiveRate', 'rrate']);
    const inflationRate = _uiRate(input, ['inflationRate', 'infl']);
    const rawTargetMonthlyExpense = _uiFinite(input, ['targetMonthlyExpense', 'monthlyExpense', 'exp']);
    const rawPensionMonthly = _uiFinite(input, ['pensionMonthly', 'ssMonthly', 'pen']);
    const targetMonthlyExpense = view === 'accum' && rawTargetMonthlyExpense === null ? 0 : rawTargetMonthlyExpense;
    const pensionMonthly = view === 'accum' && rawPensionMonthly === null ? 0 : rawPensionMonthly;
    const values = { currentAge, retireAge, lifeExpectancy, currentAsset, monthlyDeposit, depositYears, accumRate, receiveRate, inflationRate, targetMonthlyExpense, pensionMonthly };
    const missingInputs = Object.entries(values).filter(([, value]) => value === null).map(([key]) => key);
    if (missingInputs.length) return _uiFailure('pension', missingInputs);
    const invalidInputs = [];
    if (retireAge < currentAge) invalidInputs.push('retireAge');
    if (lifeExpectancy <= retireAge) invalidInputs.push('lifeExpectancy');
    if ([currentAsset, monthlyDeposit, depositYears, targetMonthlyExpense, pensionMonthly].some(value => value < 0)) invalidInputs.push('amount');
    if ([accumRate, receiveRate, inflationRate].some(value => value <= -1 || value > 1)) invalidInputs.push('rate');
    if (invalidInputs.length) return _uiFailure('pension', [], invalidInputs, ['입력 범위를 확인해 주세요.']);

    const plan = personal.calcPensionPlan({
      currentAge,
      retireAge,
      lifeExpectancy,
      streams: [{ lump: currentAsset, monthly: monthlyDeposit, years: depositYears }],
      ssMonthly: pensionMonthly,
      ssStartAge: retireAge,
      otherMonthly: 0,
      monthlyExpense: targetMonthlyExpense,
      expenseBasis: 'today',
      accumRate,
      receiveRate,
      inflationRate,
      addMonthly: 0,
      addYears: 0,
    });
    if (plan && plan.calculated === false) return { ...plan, calculator: 'pension' };
    const payout = personal.calcPension({
      principal: Math.max(0, Number(plan && plan.projected) || 0),
      monthlyPmt: 0,
      accumYears: 0,
      receiveYears: lifeExpectancy - retireAge,
      accumRate: 0,
      receiveRate,
      inflationRate,
    });
    if (payout && payout.calculated === false) return { ...payout, calculator: 'pension' };
    const fundMonthly = Math.max(0, Number(payout.monthlyReceive) || 0);
    const totalMonthlyIncome = pensionMonthly + fundMonthly;
    const monthlyGap = Math.max(0, targetMonthlyExpense - totalMonthlyIncome);
    return {
      calculated: true,
      calculator: 'pension',
      corpus: Math.round(Number(plan.projected) || 0),
      recv: Math.round(fundMonthly),
      pensionMonthly: Math.round(pensionMonthly),
      totalMonthlyIncome: Math.round(totalMonthlyIncome),
      futExp: Math.round(targetMonthlyExpense),
      gap: Math.round(monthlyGap),
      years: lifeExpectancy - retireAge,
      needAtRetire: Math.round(Number(plan.needAtRetire) || 0),
      capitalGap: Math.round(Number(plan.gap) || 0),
      _need: Math.round(targetMonthlyExpense),
      _have: Math.round(totalMonthlyIncome),
      warnings: _uniqueStrings([
        ..._uiWarnings(plan, payout),
        ...(view === 'accum' ? ['적립총액과 월수령액은 입력한 적립기·수령기 수익률 및 물가상승률 기준입니다.'] : ['월 생활비·월 수령액은 오늘 가치 기준으로 비교했습니다.']),
      ]),
    };
  }

  if (normalizedType === 'pensionYearly') {
    const result = personal.calcPensionYearlyProjection({
      retireAge: _uiFinite(input, ['retireAge', 'ra']),
      lifeExpectancy: _uiFinite(input, ['lifeExpectancy', 'le']),
      monthlyExpense: _uiFinite(input, ['monthlyExpense', 'targetMonthlyExpense', 'exp']),
      monthlyPension: _uiFinite(input, ['monthlyPension', 'pensionMonthly', 'pen']),
      inflationRate: _uiRate(input, ['inflationRate', 'infl']),
      pensionGrowthRate: _uiRate(input, ['pensionGrowthRate', 'pinfl']),
    });
    if (!result || result.calculated === false) return result || _uiFailure('pensionYearly');
    return {
      calculated: true,
      calculator: 'pensionYearly',
      rows: result.rows,
      cumGap: result.cumulativeGap,
      avgGap: result.averageMonthlyGap,
      warnings: _uiWarnings(result),
    };
  }

  if (normalizedType === 'pensionIncomeTable') {
    const result = personal.calcPensionIncomeSchedule({
      currentAge: _uiFinite(input, ['currentAge', 'ca']),
      currentYear: _uiFinite(input, ['currentYear', 'year']),
      retireAge: _uiFinite(input, ['retireAge', 'ra']),
      lifeExpectancy: _uiFinite(input, ['lifeExpectancy', 'le']),
      privateMonthly: _uiFinite(input, ['privateMonthly', 'privatePensionMonthly', 'priv']),
      nationalMonthly: _uiFinite(input, ['nationalMonthly', 'nationalPensionMonthly', 'nat']),
      nationalGrowthRate: _uiRate(input, ['nationalGrowthRate', 'growthRate', 'rate']),
    });
    if (!result || result.calculated === false) return result || _uiFailure('pensionIncomeTable');
    return {
      calculated: true,
      calculator: 'pensionIncomeTable',
      rows: result.rows,
      warnings: _uiWarnings(result),
    };
  }

  if (normalizedType === 'insurance') {
    const monthlyLivingCost = _uiFinite(input, ['monthlyLivingCost', 'surv']);
    const supportYears = _uiFinite(input, ['supportYears', 'supy']);
    const educationCost = _uiFinite(input, ['educationCost', 'edu']);
    const existingCoverage = _uiFinite(input, ['existingCoverage', 'cover']);
    const debt = _uiFinite(input, ['debt']);
    const emergencyFund = _uiFinite(input, ['emergencyFund', 'emergency']);
    const liquidAssets = _uiFinite(input, ['liquidAssets', 'liquid']);
    const returnRate = _uiRate(input, ['returnRate', 'irate']);
    const inflationRate = _uiRate(input, ['inflationRate', 'iinfl']);
    const values = { monthlyLivingCost, supportYears, educationCost, existingCoverage, debt, emergencyFund, liquidAssets, returnRate, inflationRate };
    const missingInputs = Object.entries(values).filter(([, value]) => value === null).map(([key]) => key);
    if (missingInputs.length) return _uiFailure('insurance', missingInputs);
    const result = personal.calcLifeInsuranceNeed(values);
    if (!result || result.calculated === false) return result || _uiFailure('insurance');
    return {
      calculated: true,
      calculator: 'insurance',
      needCover: Math.round(Number(result.totalNeed) || 0),
      gapCover: Math.round(Number(result.requiredCoverageGap) || 0),
      _need: Math.round(Number(result.totalNeed) || 0),
      _have: Math.round(Number(result.offset) || 0),
      warnings: _uiWarnings(result),
    };
  }

  if (normalizedType === 'termcompare') {
    const wholeLifeMonthlyPremium = _uiFinite(input, ['wholeLifeMonthlyPremium', 'wholePrem']);
    const termMonthlyPremium = _uiFinite(input, ['termMonthlyPremium', 'termPrem']);
    const payYears = _uiFinite(input, ['payYears', 'payY']);
    const investReturn = _uiRate(input, ['investReturn', 'investR']);
    const values = { wholeLifeMonthlyPremium, termMonthlyPremium, payYears, investReturn };
    const missingInputs = Object.entries(values).filter(([, value]) => value === null).map(([key]) => key);
    if (missingInputs.length) return _uiFailure('termcompare', missingInputs);
    const result = personal.calcTermVsWholeLife(values);
    if (!result || result.calculated === false) return result || _uiFailure('termcompare');
    return {
      calculated: true,
      calculator: 'termcompare',
      wholeTotal: Math.round(Number(result.wholeLifeTotalPaid) || 0),
      termTotal: Math.round(Number(result.termTotalPaid) || 0),
      saved: Math.round(Number(result.premiumSaved) || 0),
      investFV: Math.round(Number(result.diffInvestFV) || 0),
      warnings: _uiWarnings(result),
    };
  }

  if (normalizedType === 'financialIncome') {
    const interestIncome = _uiFinite(input, ['interestIncome', 'interest', 'fin']);
    const dividendIncome = _uiFinite(input, ['dividendIncome', 'dividend']);
    const otherIncome = _uiFinite(input, ['otherIncome', 'oth']);
    const personalDeduction = _uiFinite(input, ['personalDeduction', 'pded']);
    const values = { interestIncome, dividendIncome, otherIncome, personalDeduction };
    const missingInputs = Object.entries(values).filter(([, value]) => value === null).map(([key]) => key);
    if (missingInputs.length) return _uiFailure('financialIncome', missingInputs);
    const result = taxPersonal.calcFinancialIncome(values);
    if (!result || result.calculated === false) return result || _uiFailure('financialIncome');
    const taxAmount = result.isSubjectToGlobal
      ? Number(result.financialAttributableTax)
      : Number(result.totalTax ?? result.withholding);
    return {
      calculated: true,
      calculator: 'financialIncome',
      taxMode: !!result.isSubjectToGlobal,
      taxAmt: Math.round(Number.isFinite(taxAmount) ? taxAmount : 0),
      margRate: Number(result.effectiveRate) || 0,
      additionalTax: Math.round(Number(result.additionalTax) || 0),
      warnings: _uiWarnings(result),
    };
  }

  if (normalizedType === 'inheritance') {
    const totalAssets = _uiFinite(input, ['totalAssets', 'tasset']);
    const cashRatio = _uiRate(input, ['cashRatio', 'cash']);
    const hasSpouseValue = _firstDefined(input.hasSpouse, input.spouse);
    const numChildren = _uiFinite(input, ['numChildren', 'child']);
    const debts = _uiFinite(input, ['debts', 'estateDebt']);
    const financialAssets = _uiFinite(input, ['financialAssets', 'fasset']);
    const funeralCost = _uiFinite(input, ['funeralCost', 'funeral']);
    const missingInputs = [];
    if (totalAssets === null) missingInputs.push('totalAssets');
    if (cashRatio === null) missingInputs.push('cashRatio');
    if (!_hasValue(hasSpouseValue)) missingInputs.push('hasSpouse');
    if (numChildren === null) missingInputs.push('numChildren');
    if (debts === null) missingInputs.push('debts');
    if (financialAssets === null) missingInputs.push('financialAssets');
    if (funeralCost === null) missingInputs.push('funeralCost');
    if (missingInputs.length) return _uiFailure('inheritance', missingInputs);
    if ([totalAssets, numChildren, debts, financialAssets, funeralCost].some(value => value < 0) || cashRatio < 0 || cashRatio > 1) {
      return _uiFailure('inheritance', [], ['inputRange'], ['입력 범위를 확인해 주세요.']);
    }
    const hasSpouse = hasSpouseValue === true || hasSpouseValue === 1 || hasSpouseValue === '1' || hasSpouseValue === 'true';
    const inheritance = corporate.calcInheritanceTax({
      totalAssets,
      debts,
      funeralCost,
      hasSpouse,
      numChildren: Math.floor(numChildren),
      financialAssets,
      financialDebts: 0,
    });
    if (!inheritance || inheritance.calculated === false) return inheritance || _uiFailure('inheritance');
    const liquidity = Math.max(0, totalAssets * cashRatio);
    const funding = _calcSuccessionFundingNeed({
      shareValue: totalAssets,
      estimatedTax: Number(inheritance.finalTax) || 0,
      liquidityNeed: 0,
      existingFunding: liquidity,
    });
    return {
      calculated: true,
      calculator: 'inheritance',
      estTax: Math.round(Number(inheritance.finalTax) || 0),
      liquidity: Math.round(liquidity),
      gapLiq: Math.round(Number(funding.fundingGap) || 0),
      _need: Math.round(Number(inheritance.finalTax) || 0),
      _have: Math.round(liquidity),
      warnings: _uniqueStrings([..._uiWarnings(inheritance, funding), '입력된 항목 범위의 상속세·유동성 시나리오입니다.']),
    };
  }

  return _uiFailure(requestedType || 'unknown', [], ['unsupportedType'], ['지원하지 않는 UI 계산기입니다.']);
}

function listCalculators() {
  return Object.values(_calculatorRegistry)
    .map(entry => ({
      calculatorId: entry.calculatorId,
      hasLegacy: !!entry.legacyFunction,
      hasAdvanced: !!entry.advancedFunction,
      legacyFunction: entry.legacyFunction,
      advancedFunction: entry.advancedFunction,
    }))
    .sort((a, b) => a.calculatorId.localeCompare(b.calculatorId));
}

function getCalculatorDiagnostics() {
  return {
    moduleExportCounts: Object.fromEntries(
      Object.entries(_MODULES).map(([name, moduleExports]) => [name, Object.keys(moduleExports).length])
    ),
    totalUniqueCalculatorExports: Object.keys(_allCalcs).length,
    exportCollisions: JSON.parse(JSON.stringify(_exportCollisions)),
    hasExportCollision: Object.keys(_exportCollisions).length > 0,
  };
}

const _publicExports = {
  personal,
  corporate,
  taxPersonal,
  taxCorporate,
  analysis,

  // 편의 alias — 모든 계산기 함수 직접 접근 가능
  ..._allCalcs,

  // 기존 토픽 디스패처는 열거형 export를 유지한다.
  calculateForTopic,
};

// 신규 공용 게이트웨이는 직접 접근할 수 있지만 Object.keys()/spread에는 나타나지 않는다.
// 기존 프로그램이 export 개수를 세거나 전체 export를 자동 순회하는 경우의 영향을 최소화한다.
Object.defineProperties(_publicExports, {
  calculate: {
    value: calculate,
    enumerable: false,
    writable: false,
    configurable: false,
  },
  listCalculators: {
    value: listCalculators,
    enumerable: false,
    writable: false,
    configurable: false,
  },
  CALCULATOR_GATEWAY_VERSION: {
    value: CALCULATOR_GATEWAY_VERSION,
    enumerable: false,
    writable: false,
    configurable: false,
  },
  getCalculatorDiagnostics: {
    value: getCalculatorDiagnostics,
    enumerable: false,
    writable: false,
    configurable: false,
  },
  calculateForUI: {
    value: calculateForUI,
    enumerable: false,
    writable: false,
    configurable: false,
  },
});

module.exports = _publicExports;

// 추가 소스파일 없이 이 파일 자체가 브라우저 번들을 생성한다.
// 사용: node functions/calculators/index.js --build-browser ../jarvia-calculators-browser.js
function _buildBrowserBundle(outputPath) {
  const fs = require('fs');
  const path = require('path');
  const moduleFiles = {
    './personal': 'personal.js',
    './corporate': 'corporate.js',
    './tax-personal': 'tax-personal.js',
    './tax-corporate': 'tax-corporate.js',
    './analysis': 'analysis.js',
    './index': 'index.js',
  };
  const wrappers = Object.entries(moduleFiles).map(([id, file]) => {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    return `${JSON.stringify(id)}: function(module, exports, require, __filename, __dirname) {
${source}
}`;
  }).join(',\n');
  const bundle = `/* JARVIA calculators browser bundle — generated from functions/calculators */
(function(global){
'use strict';
var modules={
${wrappers}
};
var cache={};
function req(id){
  if(cache[id]) return cache[id].exports;
  if(!modules[id]) throw new Error('Unknown calculator module: '+id);
  var module={exports:{}}; cache[id]=module;
  function localRequire(child){ return req(child); }
  localRequire.main=null;
  modules[id](module,module.exports,localRequire,id,'calculators');
  return module.exports;
}
var api=req('./index');
global.JarviaCalculators=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
`;
  const target = path.resolve(process.cwd(), outputPath || '../jarvia-calculators-browser.js');
  fs.writeFileSync(target, bundle, 'utf8');
  return target;
}

if (typeof process !== 'undefined' && require.main === module && process.argv[2] === '--build-browser') {
  const target = _buildBrowserBundle(process.argv[3] || '../jarvia-calculators-browser.js');
  console.log(`[calculators] browser bundle created: ${target}`);
}

}
};
var cache={};
function req(id){
  if(cache[id]) return cache[id].exports;
  if(!modules[id]) throw new Error('Unknown calculator module: '+id);
  var module={exports:{}}; cache[id]=module;
  function localRequire(child){ return req(child); }
  localRequire.main=null;
  modules[id](module,module.exports,localRequire,id,'calculators');
  return module.exports;
}
var api=req('./index');
global.JarviaCalculators=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
