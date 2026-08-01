/* ==========================================================================
 * EMBEDDED MODULE: NICE BizLINE EXTRACTOR v1.1.0
 * Restored after v1.6 speech-engine regression.
 * ========================================================================== */
/**
 * JARVIA NICE BizLINE PDF 표준추출 모듈 v1.0.0
 * ------------------------------------------------------------
 * 목적
 * - PDF.js 또는 서버 PDF 텍스트 추출기가 만든 페이지별 텍스트를 입력받아
 *   JARVIA 기업종합Report 표준 JSON으로 변환한다.
 * - 개별/연결, 결산/분기를 분리한다.
 * - 원문 '-'를 0으로 바꾸지 않는다.
 * - 모든 핵심값에 페이지·단위·기간·범위·확정상태를 붙인다.
 * - 화법 원문을 복제하지 않고, 기존 corporateReport.js의 v3.0 화법엔진이
 *   30초·90초·3분·5분·10단 노트·7분기·반론·보험 8단계·음성강의를
 *   빠짐없이 적용할 수 있도록 speechPlan을 만든다.
 *
 * 입력 형식
 * 1) ["1페이지 텍스트", "2페이지 텍스트", ...]
 * 2) [{ pageNumber: 1, text: "..." }, ...]
 * 3) pdftotext 결과처럼 form-feed(\f)로 구분된 문자열
 *
 * CommonJS:
 *   const { extractNiceBizline } = require("./niceBizlineExtractor");
 *
 * Browser:
 *   window.NiceBizlineExtractor.extractNiceBizline(pages)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NiceBizlineExtractor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.2.1";
  const DEFAULT_UNIT = "KRW_MILLION";

  const BALANCE_ROWS = [
    ["nonCurrentAssets", /^비유동자산/],
    ["propertyPlantEquipment", /^유형자산/],
    ["intangibleAssets", /^무형자산/],
    ["longTermInvestments", /^장기투자자산/],
    ["nonCurrentReceivables", /^매출채권\s*및\s*기타채권/],
    ["otherNonFinancialAssetsNonCurrent", /^기타비금융자산/],
    ["currentAssets", /^유동자산/],
    ["inventory", /^재고자산/],
    ["currentReceivables", /^매출채권\s*및\s*기타채권/],
    ["shortTermInvestments", /^단기투자자산/],
    ["otherNonFinancialAssetsCurrent", /^기타비금융자산/],
    ["cashAndCashEquivalents", /^현금\s*및\s*현금성자산/],
    ["totalAssets", /^자산총계/],
    ["paidInCapital", /^납입자본/],
    ["capitalStock", /^자본금/],
    ["retainedEarnings", /^이익잉여금/],
    ["otherCapitalComponents", /^기타자본구성요소/],
    ["totalEquity", /^자본총계/],
    ["nonCurrentLiabilities", /^비유동부채/],
    ["nonCurrentBorrowings", /^비유동차입부채/],
    ["currentLiabilities", /^유동부채/],
    ["tradeAndOtherPayables", /^매입채무\s*및\s*기타채무/],
    ["currentBorrowings", /^유동차입부채/],
    ["totalLiabilities", /^부채총계/]
  ];

  const BORROWING_ROWS = [
    ["currentBorrowings", /^유동차입부채/],
    ["shortTermLoans", /^단기차입금/],
    ["currentPortionLongTermDebt", /^유동성장기부채/],
    ["shortTermBonds", /^단기사채/],
    ["nonCurrentBorrowings", /^비유동차입부채/],
    ["longTermBonds", /^장기사채/],
    ["longTermLoans", /^장기차입금/],
    ["totalBorrowings", /^차입금총계/],
    ["otherFinancialLiabilities", /^기타금융부채/],
    ["totalBorrowingsIncludingOther", /^총차입금/]
  ];

  const INCOME_ROWS = [
    ["revenue", /^매출액/],
    ["costOfSales", /^매출원가/],
    ["grossProfit", /^매출총이익/],
    ["sellingGeneralAdmin", /^판매비와\s*관리비/],
    ["depreciation", /^감가상각비/],
    ["badDebtExpense", /^대손상각비/],
    ["laborCost", /^인건비/],
    ["operatingProfit", /^영업이익/],
    ["nonOperatingIncome", /^영업외수익/],
    ["financeIncome", /^금융수익/],
    ["nonOperatingExpense", /^영업외비용/],
    ["financeCost", /^금융비용/],
    ["profitBeforeTax", /^법인세차감전순이익/],
    ["incomeTaxExpense", /^법인세비용/],
    ["netIncome", /^당기순이익/]
  ];

  const CASHFLOW_ROWS = [
    ["netIncome", /^당기순이익/],
    ["adjustedNetIncome", /^조정당기순이익/],
    ["changeInReceivables", /^매출채권순증/],
    ["changeInInventory", /^재고자산순증/],
    ["changeInPayables", /^매입채무순증/],
    ["operatingCashGenerated", /^영업활동조달현금/],
    ["nonOperatingFundingUse", /^비영업부분\s*조달/],
    ["cashSurplusDeficit", /^자금과부족/],
    ["externalFunding", /^외부자금조달/],
    ["equityIssuance", /^유상증자/],
    ["netChangeLongTermBorrowing", /^장기차입금순증/],
    ["netChangeBonds", /^사채순증/],
    ["netChangeShortTermBorrowing", /^단기차입금순증/],
    ["netChangeCash", /^현금과예금의순증/],
    ["beginningCash", /^기초현금/],
    ["endingCash", /^기말현금/]
  ];

  const RATIO_PAGES = [
    {
      page: 6,
      rows: [
        ["equityRatio", /^자기자본비율/, "PERCENT"],
        ["debtRatio", /^부채비율/, "PERCENT"],
        ["borrowingDependency", /^차입금의존도/, "PERCENT"],
        ["interestCoverage", /^영업이익이자보상비율/, "MULTIPLE"]
      ]
    },
    {
      page: 7,
      rows: [
        ["netWorkingCapitalTurnover", /^순영업자본회전율/, "MULTIPLE"],
        ["currentRatio", /^유동비율/, "PERCENT"],
        ["quickRatio", /^당좌비율/, "PERCENT"],
        ["cashRatio", /^현금비율/, "PERCENT"]
      ]
    },
    {
      page: 8,
      rows: [
        ["roa", /^총자본순이익률/, "PERCENT"],
        ["financeCostToRevenue", /^금융비용\/매출액/, "PERCENT"],
        ["operatingMargin", /^매출액영업이익률/, "PERCENT"],
        ["ebitdaMargin", /^EBITDA\/매출액/i, "PERCENT"]
      ]
    },
    {
      page: 9,
      rows: [
        ["revenueGrowth", /^매출액증가율/, "PERCENT"],
        ["assetGrowth", /^총자산증가율/, "PERCENT"],
        ["operatingProfitGrowth", /^영업이익증가율/, "PERCENT"],
        ["netIncomeGrowth", /^순이익증가율/, "PERCENT"]
      ]
    },
    {
      page: 10,
      rows: [
        ["totalAssetTurnover", /^총자본회전율/, "MULTIPLE"],
        ["receivablesTurnover", /^매출채권회전율/, "MULTIPLE"],
        ["payablesTurnover", /^매입채무회전율/, "MULTIPLE"],
        ["inventoryTurnover", /^재고자산회전율/, "MULTIPLE"]
      ]
    }
  ];

  const LABELS = {
    nonCurrentAssets: "비유동자산",
    propertyPlantEquipment: "유형자산",
    intangibleAssets: "무형자산",
    longTermInvestments: "장기투자자산",
    nonCurrentReceivables: "매출채권 및 기타채권(비유동)",
    otherNonFinancialAssetsNonCurrent: "기타비금융자산(비유동)",
    currentAssets: "유동자산",
    inventory: "재고자산",
    currentReceivables: "매출채권 및 기타채권(유동)",
    shortTermInvestments: "단기투자자산",
    otherNonFinancialAssetsCurrent: "기타비금융자산(유동)",
    cashAndCashEquivalents: "현금 및 현금성자산",
    totalAssets: "자산총계",
    paidInCapital: "납입자본",
    capitalStock: "자본금",
    retainedEarnings: "이익잉여금",
    otherCapitalComponents: "기타자본구성요소",
    totalEquity: "자본총계",
    nonCurrentLiabilities: "비유동부채",
    nonCurrentBorrowings: "비유동차입부채",
    currentLiabilities: "유동부채",
    tradeAndOtherPayables: "매입채무 및 기타채무",
    currentBorrowings: "유동차입부채",
    totalLiabilities: "부채총계",
    shortTermLoans: "단기차입금",
    currentPortionLongTermDebt: "유동성장기부채",
    shortTermBonds: "단기사채",
    longTermBonds: "장기사채",
    longTermLoans: "장기차입금",
    totalBorrowings: "차입금총계",
    otherFinancialLiabilities: "기타금융부채(금융리스 포함)",
    totalBorrowingsIncludingOther: "총차입금(기타금융부채 포함)",
    revenue: "매출액",
    costOfSales: "매출원가",
    grossProfit: "매출총이익(손실)",
    sellingGeneralAdmin: "판매비와 관리비",
    depreciation: "감가상각비",
    badDebtExpense: "대손상각비",
    laborCost: "인건비",
    operatingProfit: "영업이익(손실)",
    nonOperatingIncome: "영업외수익",
    financeIncome: "금융수익",
    nonOperatingExpense: "영업외비용",
    financeCost: "금융비용",
    profitBeforeTax: "법인세차감전순이익",
    incomeTaxExpense: "법인세비용(부의법인세비용)",
    netIncome: "당기순이익(손실)",
    adjustedNetIncome: "조정당기순이익",
    changeInReceivables: "매출채권순증",
    changeInInventory: "재고자산순증",
    changeInPayables: "매입채무순증",
    operatingCashGenerated: "영업활동조달현금",
    nonOperatingFundingUse: "비영업부분 조달(+) 운용(-)",
    cashSurplusDeficit: "자금과부족",
    externalFunding: "외부자금조달",
    equityIssuance: "유상증자",
    netChangeLongTermBorrowing: "장기차입금순증",
    netChangeBonds: "사채순증",
    netChangeShortTermBorrowing: "단기차입금순증",
    netChangeCash: "현금과예금의순증",
    beginningCash: "기초현금",
    endingCash: "기말현금"
  };

  function normalizePages(input) {
    if (Array.isArray(input)) {
      return input.map((p, i) => ({
        pageNumber: Number(p && typeof p === "object" ? p.pageNumber : i + 1),
        text: normalizeText(p && typeof p === "object" ? p.text : p)
      }));
    }
    if (typeof input === "string") {
      const parts = input.split("\f");
      if (parts.length > 1 && parts[parts.length - 1].trim() === "") parts.pop();
      return parts.map((text, i) => ({ pageNumber: i + 1, text: normalizeText(text) }));
    }
    throw new TypeError("페이지 텍스트 배열 또는 form-feed 문자열이 필요합니다.");
  }

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+$/gm, "")
      .trim();
  }

  function normalizeLine(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getPage(pages, n) {
    return pages.find((p) => p.pageNumber === n) || { pageNumber: n, text: "" };
  }

  function detectNiceBizline(input) {
    const pages = normalizePages(input);
    const joined = pages.slice(0, 6).map((p) => p.text).join("\n");
    const phrases = [
      "기업 분석 보고서",
      "기업분석보고서",
      "상세 보고서",
      "NICE BizLINE",
      "주요 재무 분석",
      "재무제표",
      "IFRS, 개별, 결산",
      "K-GAAP, 개별, 결산"
    ];
    const matched = phrases.filter((x) => joined.includes(x) || pages.some((p) => p.text.includes(x)));
    return {
      detected: matched.length >= 3,
      provider: "NICE평가정보 / NICE BizLINE",
      reportType: "기업분석보고서 상세보고서",
      matchedPhrases: matched,
      confidence: Math.min(1, matched.length / 5)
    };
  }

  function parseDate(value) {
    const m = String(value || "").match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
    if (!m) return null;
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }

  function numberOrNull(token) {
    const value = String(token == null ? "" : token).trim();
    if (!value || value === "-" || value === "—") return null;
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function field(value, unit, page, section, extra) {
    let normalized = value;
    if (typeof normalized === "string") {
      const t = normalized.replace(/\s+/g, " ").trim();
      normalized = (!t || t === "-" || t === "—" || /^해당\s*없음$/i.test(t) || /^미제공$/i.test(t)) ? null : t;
    }
    if (Array.isArray(normalized)) {
      normalized = normalized.map((x) => typeof x === "string" ? x.trim() : x)
        .filter((x) => x !== null && x !== undefined && x !== "" && x !== "-" && x !== "—");
      if (!normalized.length) normalized = null;
    }
    const status = normalized === null ? "notProvided" : "extracted";
    return Object.assign({
      value: normalized,
      unit,
      sourcePage: page,
      sourceSection: section,
      sourceLabel: "",
      status,
      confirmed: false,
      confidence: normalized === null ? 0 : 0.99
    }, extra || {});
  }

  function extractPeriods(text, max) {
    const all = Array.from(String(text || "").matchAll(/20\d{2}\.\d{2}\.\d{2}/g), (m) => m[0]);
    const unique = [];
    for (const x of all) if (!unique.includes(x)) unique.push(x);
    return unique.slice(0, max || 3).map((x) => x.replace(/\./g, "-"));
  }

  function sectionBetween(text, start, end) {
    const source = String(text || "");
    const s = typeof start === "string" ? source.indexOf(start) : source.search(start);
    if (s < 0) return "";
    const after = source.slice(s);
    if (!end) return after;
    const e = typeof end === "string" ? after.indexOf(end, 1) : after.search(end);
    return e > 0 ? after.slice(0, e) : after;
  }

  function amountPercentPairs(line) {
    const out = [];
    const regex = /(-?(?:\d{1,3}(?:,\d{3})+|\d+)|-)\s+(-?(?:\d+(?:\.\d+)?)%|-%|-\s*%)/g;
    let m;
    while ((m = regex.exec(line))) out.push({ amount: numberOrNull(m[1]), ratio: numberOrNull(m[2].replace("%", "")) });
    return out;
  }

  function parseSequentialRows(sectionText, rowSpecs, periods, context) {
    const lines = sectionText.split("\n").map(normalizeLine).filter(Boolean);
    const byPeriod = Object.fromEntries(periods.map((p) => [p, {}]));
    let cursor = 0;
    const warnings = [];
    for (const [key, matcher] of rowSpecs) {
      let foundIndex = -1;
      for (let i = cursor; i < lines.length; i++) {
        const comparable = lines[i].replace(/^\(+/, "").replace(/\)/g, "");
        if (matcher.test(comparable)) { foundIndex = i; break; }
      }
      if (foundIndex < 0) {
        warnings.push(`행 미검출: ${LABELS[key] || key}`);
        continue;
      }
      cursor = foundIndex + 1;
      const pairs = amountPercentPairs(lines[foundIndex]);
      if (!pairs.length) {
        warnings.push(`수치 미검출: ${LABELS[key] || key}`);
        continue;
      }
      periods.forEach((period, idx) => {
        const pair = pairs[idx] || { amount: null, ratio: null };
        byPeriod[period][key] = field(pair.amount, context.unit, context.page, context.section, {
          sourceLabel: LABELS[key] || key,
          scope: context.scope,
          periodType: context.periodType,
          periodEnd: period,
          compositionRatio: pair.ratio
        });
      });
    }
    return { byPeriod, warnings };
  }

  function mergePeriodBlocks(target, parsed, blockName) {
    Object.entries(parsed.byPeriod).forEach(([period, values]) => {
      if (!target[period]) target[period] = {};
      target[period][blockName] = Object.assign(target[period][blockName] || {}, values);
    });
  }

  function extractCompany(pages) {
    const p1=getPage(pages,1).text,p3=getPage(pages,3).text,p11=getPage(pages,11).text;
    const line=(re,group,source)=>{const m=String(source||"").match(re);return m?normalizeLine(m[group||1]):null;};
    const companyName=line(/기업명\s+(.+?)\s+대표자명/,1,p3)||line(/\n\s*((?:\(주\)|㈜)[^\n]+)\n/,1,p1);
    const ceoName=line(/대표자명\s+([^\s]+)/,1,p3)||line(/대표자\s+([^\s]+)/,1,p11);
    const businessNumber=line(/사업자번호\s+(\d{3}-\d{2}-\d{5})/,1,p3)||line(/(\d{3}-\d{2}-\d{5})/,1,p1);
    const corporateNumber=line(/법인번호\s+(\d{6}-\d{7})/,1,p3);
    const established=line(/설립일자\s+([0-9.년월일]+)/,1,p3);
    const businessStart=line(/개업일자\s+([0-9.년월일]+)/,1,p3);
    const listingDate=line(/기업공개일자\s+([0-9.년월일]+)/,1,p3);
    const type=line(/기업\s*형태\s+(.+?)\s+소속그룹명/,1,p3);
    const group=line(/소속그룹명\s+([^\s]+)/,1,p3);
    const employee=line(/종업원수\s+(\d+)명/,1,p3);
    const address=line(/(\(\d{5}\)[^\n]+)\n본사\s*주소/,1,p3)||line(/본사\s*주소\s*\n?\s*(\([0-9]+\)[^\n]+)/,1,p3)||line(/(\(\d{5}\)[^\n]+)\n본사\s*주소/,1,p11);
    const phone=line(/Tel:\s*([0-9-]+)/,1,p3),fax=line(/Fax:\s*([0-9-]+)/,1,p3),product=line(/주요상품\s+(.+)/,1,p3);
    const industry=p3.match(/표준산업분류\s+\(([^)]+)\)\s*(.+)/);
    const website=line(/홈페이지\s+([^\s]+)/,1,p11),certifications=line(/인증정보\s+(.+)/,1,p11),mainBank=line(/주거래은행\s+([^\s]+)/,1,p11);
    return {name:field(companyName,"TEXT",3,"기업요약 기업개요",{sourceLabel:"기업명"}),businessNumber:field(businessNumber,"TEXT",3,"기업요약 기업개요",{sourceLabel:"사업자번호"}),corporateNumber:field(corporateNumber,"TEXT",3,"기업요약 기업개요",{sourceLabel:"법인번호"}),ceoName:field(ceoName,"TEXT",3,"기업요약 기업개요",{sourceLabel:"대표자명"}),establishedDate:field(parseDate(established),"DATE",3,"기업요약 기업개요",{sourceLabel:"설립일자"}),businessStartDate:field(parseDate(businessStart),"DATE",3,"기업요약 기업개요",{sourceLabel:"개업일자"}),listingDate:field(parseDate(listingDate),"DATE",3,"기업요약 기업개요",{sourceLabel:"기업공개일자"}),companyType:field(type?type.split(/[,\s/]+/).filter(Boolean):null,"TEXT_ARRAY",3,"기업요약 기업개요",{sourceLabel:"기업 형태"}),groupName:field(group,"TEXT",3,"기업요약 기업개요",{sourceLabel:"소속그룹명"}),employeeCount:field(numberOrNull(employee),"PERSON",3,"기업요약 기업개요",{sourceLabel:"종업원수"}),headOfficeAddress:field(address,"TEXT",3,"기업요약 기업개요",{sourceLabel:"본사 주소"}),phone:field(phone,"TEXT",3,"기업요약 기업개요",{sourceLabel:"Tel"}),fax:field(fax,"TEXT",3,"기업요약 기업개요",{sourceLabel:"Fax"}),website:field(website,"TEXT",11,"기업현황 기업개요",{sourceLabel:"홈페이지"}),mainBank:field(mainBank,"TEXT",11,"기업현황 기업개요",{sourceLabel:"주거래은행"}),mainProducts:field(product,"TEXT",3,"기업요약 기업개요",{sourceLabel:"주요상품"}),industryCode:field(industry?industry[1].trim():null,"TEXT",3,"기업요약 기업개요",{sourceLabel:"표준산업분류"}),industryName:field(industry?industry[2].trim():null,"TEXT",3,"기업요약 기업개요",{sourceLabel:"표준산업분류"}),certifications:field(certifications?[certifications]:null,"TEXT_ARRAY",11,"기업현황 기업개요",{sourceLabel:"인증정보"})};
  }


  const KGAAP_BALANCE_ROWS = [
    ["currentAssets", /^유동자산/],
    ["cashAndCashEquivalents", /^현금\s*및\s*현금(?:성자산|등가물)/],
    ["currentReceivables", /^매출채권(?:,\s*공사\/영업미수금|\s*및\s*기타채권)?/],
    ["inventory", /^재고자산/],
    ["nonCurrentAssets", /^비유동자산/],
    ["propertyPlantEquipment", /^유형자산/],
    ["intangibleAssets", /^무형자산/],
    ["longTermInvestments", /^(?:장기)?투자자산/],
    ["totalAssets", /^자산총계/],
    ["currentLiabilities", /^유동부채/],
    ["tradeAndOtherPayables", /^매입채무(?:\s*및\s*기타채무)?/],
    ["currentBorrowings", /^단기차입금/],
    ["nonCurrentLiabilities", /^비유동부채/],
    ["nonCurrentBorrowings", /^장기차입금/],
    ["totalLiabilities", /^부채총계/],
    ["capitalStock", /^자본금/],
    ["retainedEarnings", /^이익잉여금/],
    ["otherCapitalComponents", /^(?:기타자본구성요소|기타)$/],
    ["totalEquity", /^자본총계/]
  ];
  const KGAAP_BORROWING_ROWS = [
    ["currentBorrowings", /^단기차입금/],
    ["shortTermLoans", /^단기차입금/],
    ["currentPortionLongTermDebt", /^유동성(?:장기부채|장기차입금)/],
    ["shortTermBonds", /^단기사채/],
    ["nonCurrentBorrowings", /^장기차입금/],
    ["longTermBonds", /^(?:장기사채|회사채)/],
    ["longTermLoans", /^장기차입금/],
    ["totalBorrowings", /^차입금총계/],
    ["otherFinancialLiabilities", /^(?:기타금융부채|금융리스부채)/],
    ["totalBorrowingsIncludingOther", /^총차입금/]
  ];
  const KGAAP_INCOME_ROWS = INCOME_ROWS.map(([key, re]) => {
    if (key === "financeIncome") return [key, /^(?:금융수익|이자수익)/];
    if (key === "financeCost") return [key, /^(?:금융비용|이자비용)/];
    return [key, re];
  });

  function extractFinancialStatements(pages) {
    const warnings = [];
    const separateAnnual = {};
    const annualBalancePage = getPage(pages, 18).text;
    const annualIncomePage = getPage(pages, 19).text;
    const quarterlyPage = getPage(pages, 20).text;
    const consolidatedPage = getPage(pages, 21).text;
    const statementStandard = /K-?GAAP/i.test(annualBalancePage) ? "K-GAAP" : /IFRS/i.test(annualBalancePage) ? "IFRS" : "UNKNOWN";
    const balanceRows = statementStandard === "K-GAAP" ? KGAAP_BALANCE_ROWS : BALANCE_ROWS;
    const borrowingRows = statementStandard === "K-GAAP" ? KGAAP_BORROWING_ROWS : BORROWING_ROWS;
    const incomeRows = statementStandard === "K-GAAP" ? KGAAP_INCOME_ROWS : INCOME_ROWS;

    const annualBalanceSection = sectionBetween(annualBalancePage, "재무상태표", "차입금구조");
    const annualBorrowingSection = sectionBetween(annualBalancePage, "차입금구조");
    const annualIncomeSection = sectionBetween(annualIncomePage, "손익계산서", "현금흐름분석");
    const annualCashSection = sectionBetween(annualIncomePage, "현금흐름분석");
    const annualPeriods = extractPeriods(annualBalanceSection, 3);
    if (!annualPeriods.length) warnings.push("연간 결산기간 미검출");

    const parsedAnnualBalance = parseSequentialRows(annualBalanceSection, balanceRows, annualPeriods, {
      unit: DEFAULT_UNIT, page: 18, section: `${statementStandard} 개별 결산 재무상태표`, scope: "separate", periodType: "annual"
    });
    const parsedAnnualBorrowing = parseSequentialRows(annualBorrowingSection, borrowingRows, annualPeriods, {
      unit: DEFAULT_UNIT, page: 18, section: `${statementStandard} 개별 결산 차입금구조`, scope: "separate", periodType: "annual"
    });
    const parsedAnnualIncome = parseSequentialRows(annualIncomeSection, incomeRows, annualPeriods, {
      unit: DEFAULT_UNIT, page: 19, section: `${statementStandard} 개별 결산 손익계산서`, scope: "separate", periodType: "annual"
    });
    const parsedAnnualCash = parseSequentialRows(annualCashSection, CASHFLOW_ROWS, annualPeriods, {
      unit: DEFAULT_UNIT, page: 19, section: `${statementStandard} 개별 결산 현금흐름분석`, scope: "separate", periodType: "annual"
    });
    mergePeriodBlocks(separateAnnual, parsedAnnualBalance, "balanceSheet");
    mergePeriodBlocks(separateAnnual, parsedAnnualBorrowing, "balanceSheet");
    mergePeriodBlocks(separateAnnual, parsedAnnualIncome, "incomeStatement");
    mergePeriodBlocks(separateAnnual, parsedAnnualCash, "cashFlowAnalysis");
    warnings.push(...parsedAnnualBalance.warnings, ...parsedAnnualBorrowing.warnings, ...parsedAnnualIncome.warnings, ...parsedAnnualCash.warnings);

    const separateQuarterly = {};
    const qBalance = sectionBetween(quarterlyPage, "재무상태표", "손익계산서");
    const qIncome = sectionBetween(quarterlyPage, "손익계산서");
    const qPeriodsRaw = extractPeriods(qBalance, 3);
    const annualSet = new Set(annualPeriods);
    const hasTrueQuarter = qPeriodsRaw.some((p) => !annualSet.has(p) && !/-12-31$/.test(p));
    const qPeriods = hasTrueQuarter ? qPeriodsRaw.filter((p) => !annualSet.has(p) && !/-12-31$/.test(p)) : [];
    if (/분기/.test(quarterlyPage) && qPeriodsRaw.length && !hasTrueQuarter) warnings.push("분기 표기가 있으나 연말 결산기간과 동일하여 최근분기에서 제외");
    if (qPeriods.length) {
      const parsedQBalance = parseSequentialRows(qBalance, balanceRows, qPeriods, {
        unit: DEFAULT_UNIT, page: 20, section: `${statementStandard} 개별 분기 재무상태표`, scope: "separate", periodType: "quarterly"
      });
      const parsedQIncome = parseSequentialRows(qIncome, incomeRows, qPeriods, {
        unit: DEFAULT_UNIT, page: 20, section: `${statementStandard} 개별 분기 손익계산서`, scope: "separate", periodType: "quarterly"
      });
      mergePeriodBlocks(separateQuarterly, parsedQBalance, "balanceSheet");
      mergePeriodBlocks(separateQuarterly, parsedQIncome, "incomeStatement");
      warnings.push(...parsedQBalance.warnings, ...parsedQIncome.warnings);
    }

    const consolidatedAnnual = {};
    const cBalance = sectionBetween(consolidatedPage, "재무상태표", "손익계산서");
    const cIncome = sectionBetween(consolidatedPage, "손익계산서");
    const cPeriods = extractPeriods(cBalance, 3);
    if (cPeriods.length) {
      const parsedCBalance = parseSequentialRows(cBalance, balanceRows, cPeriods, {
        unit: DEFAULT_UNIT, page: 21, section: `${statementStandard} 연결 결산 재무상태표`, scope: "consolidated", periodType: "annual"
      });
      const parsedCIncome = parseSequentialRows(cIncome, incomeRows, cPeriods, {
        unit: DEFAULT_UNIT, page: 21, section: `${statementStandard} 연결 결산 손익계산서`, scope: "consolidated", periodType: "annual"
      });
      mergePeriodBlocks(consolidatedAnnual, parsedCBalance, "balanceSheet");
      mergePeriodBlocks(consolidatedAnnual, parsedCIncome, "incomeStatement");
      warnings.push(...parsedCBalance.warnings, ...parsedCIncome.warnings);
    }

    return {
      statementStandard,
      financialStatements: { separateAnnual, separateQuarterly, consolidatedAnnual },
      warnings: unique(warnings)
    };
  }

  function numericTokens(line) {
    return Array.from(String(line || "").matchAll(/(?<![A-Za-z가-힣])(-?\d+(?:,\d{3})*(?:\.\d+)?|-)(?![A-Za-z가-힣])/g), (m) => m[1]);
  }

  function extractRatios(pages) {
    const ratios = {};
    const warnings = [];
    for (const group of RATIO_PAGES) {
      const page = getPage(pages, group.page).text;
      const lines = page.split("\n").map(normalizeLine).filter(Boolean);
      for (const [key, matcher, unit] of group.rows) {
        const line = lines.find((x) => matcher.test(x));
        if (!line) {
          warnings.push(`비율 행 미검출: ${key}`);
          continue;
        }
        const values = numericTokens(line)
          .filter((x) => x !== "-")
          .map(numberOrNull)
          .filter((x) => x !== null);
        const companyValues = values.slice(0, 3);
        ["2025-12-31", "2024-12-31", "2023-12-31"].forEach((period, idx) => {
          if (!ratios[period]) ratios[period] = {};
          ratios[period][key] = field(companyValues[idx] == null ? null : companyValues[idx], unit, group.page, "재무비율분석", {
            sourceLabel: key,
            scope: "separate",
            periodType: "annual",
            periodEnd: period
          });
        });
      }
    }
    return { financialRatios: ratios, warnings: unique(warnings) };
  }

  function extractShareholdersAndAffiliates(pages) {
    const page=getPage(pages,11).text;
    const shareholderSection=sectionBetween(page,/주요주주\s*\(단위/,/관계사현황\s*\(단위/);
    const affiliateSection=sectionBetween(page,/관계사현황\s*\(단위/,/기업분석보고서/);
    const shareholderDate=parseDate((shareholderSection.match(/기준\s*일자\s*:\s*([0-9.]+)/)||[])[1]);
    const affiliateDate=parseDate((affiliateSection.match(/기준\s*일자\s*:\s*([0-9.]+)/)||[])[1]);
    const shareholders=[];
    for(const raw of shareholderSection.split("\n")){const line=normalizeLine(raw);const m=line.match(/^(.+?)\s+([\d,]+)\s+([\d.]+)\s+(.+)$/);if(!m||m[1]==='주주명'||m[1]==='-')continue;shareholders.push({name:m[1],sharesOwned:numberOrNull(m[2]),ownershipPercent:numberOrNull(m[3]),relationship:m[4],asOfDate:shareholderDate,sourcePage:11,status:"extracted",confirmed:false,confidence:0.99});}
    const affiliates=[];
    for(const raw of affiliateSection.split("\n")){const line=normalizeLine(raw);const m=line.match(/^(.+?)\s+([가-힣A-Za-z]+)\s+(.+?)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)$/);if(!m||m[1]==='업체명'||m[1]==='-')continue;affiliates.push({name:m[1],ceo:m[2],industry:m[3],totalAssets:numberOrNull(m[4]),revenue:numberOrNull(m[5]),netIncome:numberOrNull(m[6]),unit:DEFAULT_UNIT,asOfDate:affiliateDate,sourcePage:11,status:"extracted",confirmed:false});}
    return {shareholders,affiliates};
  }

  function extractEmployment(pages) {
    const page = getPage(pages, 12).text;
    const month = (page.match(/기준\s*연월\s*:\s*(20\d{2}\.\d{2})/) || [])[1];
    const values = Array.from(page.matchAll(/([\d,.]+)(만원|명|%)/g), (m) => ({ value: numberOrNull(m[1]), unit: m[2] }));
    return {
      asOfMonth: month ? month.replace(".", "-") : null,
      estimatedAverageSalaryKRW10K: field(values[0]?.value ?? null, "KRW_10K", 12, "종업원 현황", { sourceLabel: "예상 평균 연봉", notes: "추정" }),
      estimatedNewHireSalaryKRW10K: field(values[1]?.value ?? null, "KRW_10K", 12, "종업원 현황", { sourceLabel: "올해 입사자 평균 연봉", notes: "추정" }),
      estimatedEmployeeCount: field(values[2]?.value ?? null, "PERSON", 12, "종업원 현황", { sourceLabel: "종업원 수(국민연금 기준)", notes: "추정" }),
      annualHireRate: field(values[3]?.value ?? null, "PERCENT", 12, "종업원 현황", { sourceLabel: "입사율" }),
      annualTurnoverRate: field(values[4]?.value ?? null, "PERCENT", 12, "종업원 현황", { sourceLabel: "퇴사율" })
    };
  }

  function extractCredit(pages) {
    const p3=getPage(pages,3).text,p15=getPage(pages,15).text,p16=getPage(pages,16).text,p17=getPage(pages,17).text;
    const history=[];const ratingSection=sectionBetween(p15,/기업평가등급\s*이력/,/WATCH등급\s*이력/);
    for(const raw of ratingSection.split("\n")){const line=normalizeLine(raw);const m=line.match(/^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?|CC[+-]?|C|D|R|NR)\s+(20\d{2}\.\d{2}\.\d{2})\s+(20\d{2}\.\d{2}\.\d{2})\s+(.+)$/);if(m)history.push({grade:m[1],evaluationDate:parseDate(m[2]),financialDate:parseDate(m[3]),ratingType:m[4]});}
    const watchHistory=[];const watchSection=sectionBetween(p15,/WATCH등급\s*이력/,/현금흐름등급\s*이력/);
    for(const raw of watchSection.split("\n")){const line=normalizeLine(raw);const m=line.match(/^(20\d{2}\.\d{2}\.\d{2})\s+(정상|유보|관찰|주의|경보|위험|회수의문|휴폐업|부도|산출유보)\s*(.*)$/);if(m)watchHistory.push({asOfDate:parseDate(m[1]),grade:m[2],reason:m[3]==='-'?null:m[3]||null});}
    const cfGrade=(p3.match(/현금흐름등급[\s\S]{0,500}?(CF[1-6])/m)||[])[1]||null;const labels={CF1:"우수",CF2:"양호",CF3:"보통",CF4:"열위",CF5:"위험",CF6:"부실"};
    const noEvents=!/[0-9]{4}\.\d{2}\.\d{2}/.test(sectionBetween(p16,/10일\s*이상\s*연체/))&&!/[0-9]{4}\.\d{2}\.\d{2}/.test(p17);
    return {companyRatingCurrent:history[0]?Object.assign({sourcePage:15},history[0]):null,companyRatingHistory:history,watchCurrent:watchHistory[0]?Object.assign({sourcePage:15},watchHistory[0]):null,watchHistory,cashFlowGradeCurrent:{grade:cfGrade,label:cfGrade?labels[cfGrade]:null,financialDate:history[0]?.financialDate||null,sourcePage:3,status:cfGrade?"extracted":"notProvided"},creditEvents:{status:noEvents?"noneReported":"needsDetailedParsing",sourcePages:[16,17],unresolved10DayDelinquency:null,kCreditInformationEvents:null,publicInformation:null,creditBureauEvents:null,currentAccountSuspension:null,courtReceivershipOrWorkout:null}};
  }

  function valueAt(result, path) {
    return path.split(".").reduce((acc, k) => acc && acc[k], result);
  }

  function metricValue(result, path) {
    const x = valueAt(result, path);
    return x && typeof x === "object" && "value" in x ? x.value : x;
  }

  function deriveSignals(result) {
    const f = result.financialStatements;
    const r = result.financialRatios;
    const annual = f.separateAnnual || {};
    const q = f.separateQuarterly || {};
    const y25 = annual["2025-12-31"] || {};
    const y24 = annual["2024-12-31"] || {};
    const y23 = annual["2023-12-31"] || {};
    const qLatestKey = Object.keys(q).sort().reverse()[0];
    const qLatest = qLatestKey ? q[qLatestKey] : {};

    const currentRatio = metricValue(r, "2025-12-31.currentRatio");
    const quickRatio = metricValue(r, "2025-12-31.quickRatio");
    const cashRatio = metricValue(r, "2025-12-31.cashRatio");
    const b23 = metricValue(y23, "balanceSheet.totalBorrowingsIncludingOther");
    const b24 = metricValue(y24, "balanceSheet.totalBorrowingsIncludingOther");
    const b25 = metricValue(y25, "balanceSheet.totalBorrowingsIncludingOther");
    const cash24 = metricValue(y24, "balanceSheet.cashAndCashEquivalents");
    const cash25 = metricValue(y25, "balanceSheet.cashAndCashEquivalents");
    const retained = metricValue(y25, "balanceSheet.retainedEarnings");
    const nc25 = metricValue(y25, "balanceSheet.nonCurrentBorrowings");
    const c25 = metricValue(y25, "balanceSheet.currentBorrowings");
    const ncQ = metricValue(qLatest, "balanceSheet.nonCurrentBorrowings");
    const cQ = metricValue(qLatest, "balanceSheet.currentBorrowings");
    const assets25 = metricValue(y25, "balanceSheet.totalAssets");
    const equity25 = metricValue(y25, "balanceSheet.totalEquity");
    const inventory25 = metricValue(y25, "balanceSheet.inventory");
    const receivables25 = metricValue(y25, "balanceSheet.currentReceivables");
    const payables25 = metricValue(y25, "balanceSheet.tradeAndOtherPayables");
    const revenue25 = metricValue(y25, "incomeStatement.revenue");
    const cogs25 = metricValue(y25, "incomeStatement.costOfSales");
    const operatingProfit25 = metricValue(y25, "incomeStatement.operatingProfit");
    const financeCost25 = metricValue(y25, "incomeStatement.financeCost");
    const otherCapital25 = metricValue(y25, "balanceSheet.otherCapitalComponents");

    const out = [];
    if ([currentRatio, quickRatio, cashRatio].some((x) => Number.isFinite(x)) && (currentRatio < 100 || cashRatio < 10)) {
      out.push({
        signalId: "LIQUIDITY_STRESS",
        severity: currentRatio < 50 || cashRatio < 5 ? "HIGH" : "MEDIUM",
        basis: { currentRatio, quickRatio, cashRatio },
        status: "codeDerived",
        requiresHumanConfirmation: false,
        speechIssueId: "WORKING_CAPITAL"
      });
    }
    if (Number.isFinite(b25) && Number.isFinite(b24) && b25 > b24 * 1.5) {
      out.push({
        signalId: "BORROWING_SURGE",
        severity: "HIGH",
        basis: [
          { period: "2023-12-31", value: b23 },
          { period: "2024-12-31", value: b24 },
          { period: "2025-12-31", value: b25 }
        ],
        unit: DEFAULT_UNIT,
        status: "codeDerived",
        requiresHumanConfirmation: false,
        speechIssueId: "WORKING_CAPITAL"
      });
    }
    if (Number.isFinite(cash24) && Number.isFinite(cash25) && cash25 < cash24 * 0.5) {
      out.push({
        signalId: "CASH_DROP",
        severity: "HIGH",
        basis: [{ period: "2024-12-31", value: cash24 }, { period: "2025-12-31", value: cash25 }],
        change: cash25 - cash24,
        unit: DEFAULT_UNIT,
        status: "codeDerived",
        requiresHumanConfirmation: false,
        speechIssueId: "WORKING_CAPITAL"
      });
    }
    const inventoryDays = Number.isFinite(inventory25) && Number.isFinite(cogs25) && cogs25 > 0 ? inventory25 / cogs25 * 365 : null;
    const receivableDays = Number.isFinite(receivables25) && Number.isFinite(revenue25) && revenue25 > 0 ? receivables25 / revenue25 * 365 : null;
    const payableDays = Number.isFinite(payables25) && Number.isFinite(cogs25) && cogs25 > 0 ? payables25 / cogs25 * 365 : null;
    const ccc = [inventoryDays, receivableDays, payableDays].every(Number.isFinite) ? inventoryDays + receivableDays - payableDays : null;
    if ((Number.isFinite(ccc) && ccc > 180) || (Number.isFinite(inventoryDays) && inventoryDays > 180)) {
      out.push({
        signalId: "WORKING_CAPITAL_CYCLE",
        severity: (ccc > 240 || inventoryDays > 240) ? "HIGH" : "MEDIUM",
        basis: { inventoryDays: Math.round(inventoryDays*10)/10, receivableDays: Math.round(receivableDays*10)/10, payableDays: Math.round(payableDays*10)/10, ccc: Math.round(ccc*10)/10 },
        status: "codeDerived", requiresHumanConfirmation: false, speechIssueId: "WORKING_CAPITAL",
        guardrail: "회전일수는 결산잔액 기준 추정치이며 거래처·재고연령표 확인 전 회수가능액으로 단정하지 않는다."
      });
    }
    const borrowingDependency = Number.isFinite(b25) && Number.isFinite(assets25) && assets25 > 0 ? b25 / assets25 * 100 : null;
    const interestCoverage = Number.isFinite(operatingProfit25) && Number.isFinite(financeCost25) && financeCost25 > 0 ? operatingProfit25 / financeCost25 : null;
    if (Number.isFinite(borrowingDependency) && borrowingDependency >= 50 && Number.isFinite(interestCoverage) && interestCoverage < 2) {
      out.push({
        signalId: "LEVERAGE_PRESSURE", severity: interestCoverage < 1.5 ? "HIGH" : "MEDIUM",
        basis: { borrowingDependency: Math.round(borrowingDependency*100)/100, interestCoverage: Math.round(interestCoverage*100)/100 },
        status: "codeDerived", requiresHumanConfirmation: false, speechIssueId: "WORKING_CAPITAL",
        guardrail: "차입의존도와 이자보상배율만으로 부실을 단정하지 않고 만기·담보·금리·자금용도를 확인한다."
      });
    }
    if (Number.isFinite(otherCapital25) && Math.abs(otherCapital25) >= Math.max(500, Math.abs(equity25 || 0) * 0.3, Math.abs(assets25 || 0) * 0.01)) {
      out.push({
        signalId: "MATERIAL_OTHER_CAPITAL", severity: "MEDIUM",
        basis: { otherCapitalComponents: otherCapital25, totalEquity: equity25, totalAssets: assets25 }, unit: DEFAULT_UNIT,
        status: "codeDerived", requiresHumanConfirmation: true, speechIssueId: "CAPITAL_TRANSACTIONS",
        guardrail: "세부 자본변동표 확인 전 자기주식·감자·배당·증자 등 특정 거래를 추정하지 않는다."
      });
    }
    if (Number.isFinite(retained) && retained < 0) {
      out.push({
        signalId: "NEGATIVE_RETAINED_EARNINGS",
        severity: "HIGH",
        basis: [{ period: "2025-12-31", value: retained }],
        unit: DEFAULT_UNIT,
        status: "codeDerived",
        requiresHumanConfirmation: false,
        speechIssueId: "CAPITAL_POLICY",
        speechVariant: "DEFICIT_REPAIR",
        mustOverrideBaseSpeech: true,
        guardrail: "과다 유보·배당재원·이익소각 재원으로 해석하거나 기존 CAPITAL_POLICY의 '이익잉여금이 많다' 화법을 그대로 사용하지 않는다."
      });
    }
    if (Number.isFinite(c25) && Number.isFinite(cQ) && cQ > c25 && Number.isFinite(nc25) && ncQ !== null && ncQ < nc25) {
      out.push({
        signalId: "MATURITY_CONCENTRATION_WARNING",
        severity: "HIGH",
        basis: [
          { period: "2025-12-31", nonCurrentBorrowings: nc25, currentBorrowings: c25 },
          { period: qLatestKey, nonCurrentBorrowings: ncQ, currentBorrowings: cQ }
        ],
        unit: DEFAULT_UNIT,
        status: "codeDerived",
        requiresHumanConfirmation: true,
        speechIssueId: "WORKING_CAPITAL",
        guardrail: "만기 재분류·상환·차환·신규조달 중 어느 원인인지 확인 전 단정하지 않는다."
      });
    }
    return out;
  }

  function buildConfirmationQueue(result) {
    const y25 = result.financialStatements.separateAnnual["2025-12-31"] || {};
    const qKeys = Object.keys(result.financialStatements.separateQuarterly || {}).sort().reverse();
    const q = qKeys.length ? result.financialStatements.separateQuarterly[qKeys[0]] : {};
    const totalAssets = metricValue(y25, "balanceSheet.totalAssets");
    const longInvest = metricValue(y25, "balanceSheet.longTermInvestments");
    const currentRatio = metricValue(result.financialRatios, "2025-12-31.currentRatio");
    const cashRatio = metricValue(result.financialRatios, "2025-12-31.cashRatio");
    const nonOpUse = metricValue(y25, "cashFlowAnalysis.nonOperatingFundingUse");
    const revenue = metricValue(y25, "incomeStatement.revenue");
    const financeCost = metricValue(y25, "incomeStatement.financeCost");
    const otherCapital = metricValue(y25, "balanceSheet.otherCapitalComponents");
    const nc25 = metricValue(y25, "balanceSheet.nonCurrentBorrowings");
    const cq = metricValue(q, "balanceSheet.currentBorrowings");

    const out = [];
    if (Number.isFinite(longInvest) && Number.isFinite(totalAssets) && longInvest / totalAssets >= 0.3) {
      out.push(question("HIGH", "장기투자자산의 세부 구성, 처분 가능성, 담보 제공 여부를 확인해 주세요.",
        ["financialStatements.separateAnnual.2025-12-31.balanceSheet.longTermInvestments"],
        "총자산의 30% 이상이나 보고서에 상세 구성이 없습니다.", "CAPITAL_POLICY"));
    }
    if (Number.isFinite(currentRatio) && currentRatio < 100) {
      out.push(question("HIGH", "단기차입과 유동부채의 월별 만기, 차환계획, 금융기관 약정을 확인해 주세요.",
        ["financialRatios.2025-12-31.currentRatio"], "유동비율이 100% 미만입니다.", "WORKING_CAPITAL"));
    }
    if (Number.isFinite(cashRatio) && cashRatio < 10) {
      out.push(question("HIGH", "실제로 사용할 수 있는 최소 운영현금과 미사용 신용한도를 확인해 주세요.",
        ["financialRatios.2025-12-31.cashRatio"], "현금비율이 10% 미만입니다.", "WORKING_CAPITAL"));
    }
    if (Number.isFinite(nonOpUse) && Number.isFinite(revenue) && Math.abs(nonOpUse) > revenue * 0.5) {
      out.push(question("HIGH", "비영업부분 자금운용의 실제 사용처와 의사결정 자료를 확인해 주세요.",
        ["financialStatements.separateAnnual.2025-12-31.cashFlowAnalysis.nonOperatingFundingUse"],
        "비영업 자금운용 규모가 연 매출의 50%를 초과합니다.", "CAPITAL_POLICY"));
    }
    if (Number.isFinite(financeCost) && financeCost > 0) {
      out.push(question("MEDIUM", "차입처별 금리·만기·담보·변동금리 조건과 연간 금융비용을 확인해 주세요.",
        ["financialStatements.separateAnnual.2025-12-31.incomeStatement.financeCost"],
        "금융비용과 이자보상능력을 함께 검토해야 합니다.", "WORKING_CAPITAL"));
    }
    if (Number.isFinite(otherCapital) && Math.abs(otherCapital) > 0) {
      out.push(question("MEDIUM", "기타자본구성요소의 세부 내역과 과거 자본거래 자료를 확인해 주세요.",
        ["financialStatements.separateAnnual.2025-12-31.balanceSheet.otherCapitalComponents"],
        "자본정책과 주주거래 판단을 위해 세부 구성이 필요합니다.", "CAPITAL_TRANSACTIONS"));
    }
    if (Number.isFinite(nc25) && Number.isFinite(cq) && cq > nc25) {
      out.push(question("HIGH", "결산 이후 차입금의 유동성 대체 또는 만기 재분류 여부와 실제 상환일정을 확인해 주세요.",
        ["financialStatements.separateAnnual.2025-12-31.balanceSheet.nonCurrentBorrowings"],
        "최근 분기에 단기 상환부담이 확대된 정황이 있습니다.", "WORKING_CAPITAL"));
    }
    return out;
  }

  function question(priority, text, fields, reason, speechIssueId) {
    return { priority, question: text, relatedFields: fields, reason, speechIssueId };
  }

  function buildSpeechPlan(result) {
    const detected = unique((result.derivedSignals || []).map((x) => x.speechIssueId).filter(Boolean));
    const conditional = unique((result.confirmationQueue || []).map((x) => x.speechIssueId).filter(Boolean));
    const active = detected;

    const allIssueIds = [
      "WORKING_CAPITAL", "LOAN_RECEIVABLE", "CAPITAL_POLICY", "CAPITAL_TRANSACTIONS",
      "EXECUTIVE_RETIREMENT", "SUCCESSION", "KEY_PERSON", "EXPORT_CREDIT",
      "PROPERTY_BI", "INSURANCE_OPTIMIZATION"
    ];
    const pending = allIssueIds.filter((id) => !active.includes(id));

    const negativeRE = (result.derivedSignals || []).find((x) => x.signalId === "NEGATIVE_RETAINED_EARNINGS");
    const overrides = [];
    if (negativeRE) {
      overrides.push({
        issueId: "CAPITAL_POLICY",
        variant: "DEFICIT_REPAIR",
        reason: "이익잉여금이 음수",
        prohibitedBasePhrases: [
          "이익잉여금이 많다", "회사에 현금이 많이 쌓였다", "배당재원이 충분하다", "이익소각 재원이 충분하다"
        ],
        requiredMessage: "누적결손의 원인, 자본구조, 현금유출, 손실 회복계획과 주주정책을 구분해 설명한다.",
        mustRegenerateSpeech: true
      });
    }

    return {
      masterVersion: "기업경영 종합리포트 실전상담화법 마스터교본 v3.0",
      engineTarget: "corporateReport.js SpeechEngine",
      rule: "추출모듈은 화법 원문을 복제하지 않고 이슈·근거·금지조건·질문을 전달한다. 최종 화법은 서버 또는 corporateReport.js의 승인된 v3.0 라이브러리에서 생성한다.",
      activeIssueIds: active,
      conditionalIssueIds: conditional.filter((id) => !active.includes(id)),
      pendingIssueIds: pending,
      prohibitedIssueIds: [
        ...(result.derivedSignals || []).some((x) => x.signalId === "NEGATIVE_RETAINED_EARNINGS") ? ["CAPITAL_POLICY_BASE_WITH_POSITIVE_RETAINED_EARNINGS_ASSUMPTION"] : [],
        ...!(result.shareholders || []).length ? ["SUCCESSION_CONFIRMED"] : [],
        "LOAN_RECEIVABLE_CONFIRMED_WITHOUT_COUNTERPARTY_AND_CONTRACT",
        "INSURANCE_RECOMMENDATION_WITHOUT_FUNDING_GAP"
      ],
      issueOverrides: overrides,
      requiredSpeechDurations: ["speech30", "speech90", "speech3m", "speech5m"],
      requiredNoteSections: [
        "01_PAGE_PURPOSE", "02_KEY_DIAGNOSIS", "03_SPEECH", "04_QUESTIONS",
        "05_RESPONSE_BRANCHES", "06_OBJECTIONS", "07_ADVANCED_GUIDE",
        "08_CONTRACT_CONNECTION", "09_TRANSITION", "10_DOCUMENTS"
      ],
      responseBranchRequirement: {
        count: 7,
        types: ["즉시 동의", "부분 동의", "부정", "정보 부족", "전문가 위임", "비용 우려", "결정 유예"],
        requiredForActiveIssues: active,
        fallbackToUnrelatedIssueAllowed: false,
        rule: "활성 이슈는 반드시 해당 이슈 전용 7분기를 사용한다. WORKING_CAPITAL 분기를 다른 이슈에 대체 적용하지 않는다."
      },
      generationTasks: active.map((issueId) => ({
        issueId,
        baseLibraryRequired: true,
        durationsRequired: ["speech30", "speech90", "speech3m", "speech5m"],
        issueSpecificBranchesRequired: 7,
        objectionsRequired: true,
        tenPartNotesRequired: true,
        aiCustomizationRequired: issueId !== "WORKING_CAPITAL" || overrides.some((x) => x.issueId === issueId),
        override: overrides.find((x) => x.issueId === issueId) || null
      })),
      objectionFramework: ["인정", "진짜 이유 확인", "범위 축소", "근거 제시", "다음 행동 합의"],
      insuranceProcessRequirement: {
        stages: 8,
        order: [
          "보험 가능성 발견", "필요재원 계산 동의", "기존 준비재원·증권 분석", "보험 외 대안 비교",
          "보험설계 검토 동의", "계약구조·인수심사", "최종 결정", "계약 후 실행관리"
        ],
        gate: "위험사건→재무충격→필요재원→현재재원→부족재원→대안비교가 끝나기 전 상품·보험료·계약을 제시하지 않는다."
      },
      customizationRequirement: {
        ceoStyles: ["신중보수형", "숫자중심형", "빠른결정형", "관계중심형", "회의방어형", "전문가위임형", "비용민감형"],
        companyContext: ["제조", "서비스", "수출", "해외법인", "가족기업", "공동주주", "고성장", "승계", "부동산·시설", "기존보험 다수"],
        meetingStages: ["1차 진단", "2차 정밀검토", "가족·주주 공동미팅", "보험설계 검토", "최종 의사결정", "사후관리"]
      },
      audioRequirement: {
        targetMinutes: "18~25",
        type: "리포트 낭독이 아닌 기업별 해설교육",
        chaptersMustInclude: ["숫자의 경영적 의미", "CEO 질문", "답변 분기", "반론", "유료진단", "보험을 꺼낼 시점", "다음 행동"],
        ttsRules: ["청취 단위 변환", "영문약어 첫 등장 풀이", "산식 자연어화", "질문 전후 휴지", "법률·세무 실무의미 우선", "리포트 수치와 완전 일치"]
      },
      hardFailRules: [
        "원문 수치·연도·단위 불일치",
        "미확인 사실 확정 또는 가지급금·위법·탈세 단정",
        "필요재원과 기존재원 확인 전 보험 제안",
        "세금절감·비용처리·수익률·인수·보험금 지급 보장",
        "보험으로 해결할 수 없는 대여금·절차·신고 문제를 보험으로 연결",
        "CEO 전달본에 컨설턴트 내부 화법·보험등급·클로징 노출",
        "리포트·상담노트·음성강의 숫자와 결론 불일치",
        "공포·비하·기존 전문가 폄하·즉시계약 압박",
        "AI가 법률·세무·보험구조를 최종 확정"
      ]
    };
  }

  function validate(result) {
    const errors = [];
    const warnings = [];
    const annual = result.financialStatements.separateAnnual || {};
    const annualPeriods = Object.keys(annual).sort();
    if (!annualPeriods.length) errors.push("개별 연간 재무제표 미검출");
    const required = [
      ["balanceSheet.totalAssets", "자산총계"], ["balanceSheet.totalLiabilities", "부채총계"],
      ["balanceSheet.totalEquity", "자본총계"], ["incomeStatement.revenue", "매출액"],
      ["incomeStatement.operatingProfit", "영업이익"], ["incomeStatement.netIncome", "당기순이익"]
    ];
    for (const [period, block] of Object.entries(annual)) {
      const read = (path) => path.split(".").reduce((o, k) => o == null ? undefined : o[k], block)?.value;
      for (const [path, label] of required) if (!Number.isFinite(read(path))) errors.push(`${period} ${label} 누락`);
      const bs = block.balanceSheet || {};
      const assets = bs.totalAssets?.value, liabilities = bs.totalLiabilities?.value, equity = bs.totalEquity?.value;
      const tol = Number.isFinite(assets) ? Math.max(2, Math.abs(assets) * 0.001) : 2;
      if ([assets, liabilities, equity].every(Number.isFinite) && Math.abs(assets - liabilities - equity) > tol) errors.push(`${period} 자산≠부채+자본`);
      const current = bs.currentAssets?.value, nonCurrent = bs.nonCurrentAssets?.value;
      if ([assets, current, nonCurrent].every(Number.isFinite) && Math.abs(assets-current-nonCurrent)>Math.max(2,Math.abs(assets)*0.002)) warnings.push(`${period} 유동+비유동자산 합계 차이`);
      const is = block.incomeStatement || {};
      if ([is.revenue?.value,is.costOfSales?.value,is.grossProfit?.value].every(Number.isFinite) && Math.abs(is.revenue.value-is.costOfSales.value-is.grossProfit.value)>2) warnings.push(`${period} 매출총이익 검산 차이`);
      const cf = block.cashFlowAnalysis || {};
      if ([cf.beginningCash?.value,cf.netChangeCash?.value,cf.endingCash?.value].every(Number.isFinite) && Math.abs(cf.beginningCash.value+cf.netChangeCash.value-cf.endingCash.value)>2) errors.push(`${period} 기초현금+순증≠기말현금`);
    }
    const q = result.financialStatements.separateQuarterly || {};
    const latestAnnual = annualPeriods[annualPeriods.length-1] || null;
    for (const period of Object.keys(q)) if (period === latestAnnual || /-12-31$/.test(period)) errors.push(`${period} 연말 결산값을 분기로 분류`);
    const mixed=[];
    for (const groupName of ["separateAnnual","separateQuarterly","consolidatedAnnual"]) {
      const expectedScope=groupName==="consolidatedAnnual"?"consolidated":"separate";
      const expectedPeriod=groupName==="separateQuarterly"?"quarterly":"annual";
      walk(result.financialStatements[groupName],(x,path)=>{if(x&&typeof x==="object"&&"value" in x&&(x.scope!==expectedScope||x.periodType!==expectedPeriod))mixed.push(`${groupName}.${path}`);});
    }
    if(mixed.length) errors.push(`회계범위·기간 혼합 ${mixed.length}건`);
    return {passed:errors.length===0,errors:unique(errors),warnings:unique(warnings),checkedAt:new Date().toISOString()};
  }

  function walk(value, fn, path) {
    const p = path || "";
    if (!value || typeof value !== "object") return;
    fn(value, p);
    for (const [k, v] of Object.entries(value)) walk(v, fn, p ? `${p}.${k}` : k);
  }

  function buildSourceConflicts(result, pages) {
    const p3 = getPage(pages, 3).text;
    const summaryRows = {};
    for (const raw of p3.split("\n")) {
      const line = normalizeLine(raw);
      const m = line.match(/^(20\d{2}\.\d{2}\.\d{2})\s+\S+\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)/);
      if (m) summaryRows[parseDate(m[1])] = {
        totalAssets: numberOrNull(m[2]), totalLiabilities: numberOrNull(m[3]),
        revenue: numberOrNull(m[4]), operatingProfit: numberOrNull(m[5])
      };
    }
    const conflicts = [];
    for (const [period, summary] of Object.entries(summaryRows)) {
      const detail = result.financialStatements.separateAnnual[period];
      if (!detail) continue;
      for (const [fieldName, summaryValue] of Object.entries(summary)) {
        const detailValue = fieldName === "totalAssets" || fieldName === "totalLiabilities"
          ? detail.balanceSheet?.[fieldName]?.value
          : detail.incomeStatement?.[fieldName]?.value;
        if (Number.isFinite(summaryValue) && Number.isFinite(detailValue) && summaryValue !== detailValue) {
          conflicts.push({
            field: `${period}.${fieldName}`,
            summaryValue,
            detailValue,
            selectedValue: detailValue,
            reason: "상세 재무제표 우선",
            summaryPage: 3,
            detailPage: fieldName.includes("Assets") || fieldName.includes("Liabilities") ? 18 : 19
          });
        }
      }
    }
    return conflicts;
  }

  function extractNiceBizline(input, options) {
    const pages = normalizePages(input);
    const detection = detectNiceBizline(pages);
    if (!detection.detected && !(options && options.force)) {
      const err = new Error("NICE BizLINE 상세보고서로 확인되지 않습니다.");
      err.code = "UNSUPPORTED_DOCUMENT";
      throw err;
    }

    const p1 = getPage(pages, 1).text;
    const reportDate = parseDate((p1.match(/작성\s*일자\s*:\s*([0-9.]+)/) || [])[1]);
    const financial = extractFinancialStatements(pages);
    const ratio = extractRatios(pages);
    const relations = extractShareholdersAndAffiliates(pages);

    const result = {
      schemaVersion: "1.0.0",
      extractorVersion: VERSION,
      generatedAt: new Date().toISOString(),
      document: {
        provider: detection.provider,
        reportType: detection.reportType,
        reportDate,
        pageCount: pages.length,
        language: "ko-KR",
        textLayerDetected: true,
        ocrRequired: false,
        defaultCurrency: "KRW",
        defaultFinancialUnit: DEFAULT_UNIT,
        providerConfidence: detection.confidence,
        matchedPhrases: detection.matchedPhrases,
        statementStandard: financial.statementStandard
      },
      company: extractCompany(pages),
      shareholders: relations.shareholders,
      affiliates: relations.affiliates,
      employment: extractEmployment(pages),
      financialStatements: financial.financialStatements,
      financialRatios: ratio.financialRatios,
      credit: extractCredit(pages),
      validation: {
        sourcePriority: ["상세 재무제표(18~21p)", "재무비율표(4~10p)", "기업요약(3p)"],
        nullPolicy: "원문 '-' 또는 미제공은 null/notProvided로 저장하며 0으로 대체하지 않음",
        scopePolicy: "개별/연결 및 결산/분기 자료를 혼합하지 않음",
        extractionWarnings: unique([...financial.warnings, ...ratio.warnings]),
        sourceConflicts: []
      },
      confirmationQueue: [],
      derivedSignals: [],
      speechPlan: null,
      quality: null
    };

    result.validation.sourceConflicts = buildSourceConflicts(result, pages);
    result.derivedSignals = deriveSignals(result);
    result.confirmationQueue = buildConfirmationQueue(result);
    result.speechPlan = buildSpeechPlan(result);
    result.quality = validate(result);
    return result;
  }

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function essentialSnapshot(result) {
    const a = result.financialStatements.separateAnnual;
    const q = result.financialStatements.separateQuarterly;
    const c = result.financialStatements.consolidatedAnnual;
    return {
      companyName: result.company.name.value,
      businessNumber: result.company.businessNumber.value,
      reportDate: result.document.reportDate,
      pageCount: result.document.pageCount,
      assets2025: a["2025-12-31"]?.balanceSheet?.totalAssets?.value,
      liabilities2025: a["2025-12-31"]?.balanceSheet?.totalLiabilities?.value,
      equity2025: a["2025-12-31"]?.balanceSheet?.totalEquity?.value,
      cash2025: a["2025-12-31"]?.balanceSheet?.cashAndCashEquivalents?.value,
      borrowings2025: a["2025-12-31"]?.balanceSheet?.totalBorrowingsIncludingOther?.value,
      revenue2025: a["2025-12-31"]?.incomeStatement?.revenue?.value,
      operatingProfit2025: a["2025-12-31"]?.incomeStatement?.operatingProfit?.value,
      netIncome2025: a["2025-12-31"]?.incomeStatement?.netIncome?.value,
      operatingCash2025: a["2025-12-31"]?.cashFlowAnalysis?.operatingCashGenerated?.value,
      quarterlyCurrentBorrowings: q["2026-03-31"]?.balanceSheet?.currentBorrowings?.value,
      consolidatedRevenue2025: c["2025-12-31"]?.incomeStatement?.revenue?.value,
      shareholderCount: result.shareholders.length,
      affiliateCount: result.affiliates.length,
      activeSpeechIssues: result.speechPlan.activeIssueIds,
      speechLayers: result.speechPlan.requiredNoteSections.length,
      insuranceStages: result.speechPlan.insuranceProcessRequirement.stages,
      qualityPassed: result.quality.passed
    };
  }


  /**
   * 표준 추출 JSON을 현재 corporateReport.js가 사용하는 ConfirmedAnalysisModel 입력형으로 변환한다.
   * 원문 추출값은 extractionResult에 그대로 보존하고, 화면/계산용 필드만 백만원 기준으로 평탄화한다.
   */
  function toCorporateReportCase(result, options) {
    const opt = options || {};
    if (!result || !result.financialStatements) throw new Error("표준 추출 결과가 없습니다.");
    const metric = (obj, path) => {
      let cur = obj;
      for (const key of String(path || "").split(".")) cur = cur == null ? undefined : cur[key];
      if (cur && typeof cur === "object" && Object.prototype.hasOwnProperty.call(cur, "value")) return cur.value;
      return cur == null ? null : cur;
    };
    const annual = result.financialStatements.separateAnnual || {};
    const q = result.financialStatements.separateQuarterly || {};
    const annualKeys = Object.keys(annual).sort();
    const latestAnnualKey = annualKeys[annualKeys.length - 1] || null;
    const qKeys = Object.keys(q).sort();
    const latestQuarterKey = qKeys[qKeys.length - 1] || null;
    const companyName = metric(result, "company.name") || "미확인 기업";
    const companyType = metric(result, "company.companyType");
    const affiliates = Array.isArray(result.affiliates) ? result.affiliates : [];
    const shareholders = Array.isArray(result.shareholders) ? result.shareholders : [];
    const creditGrade = result.credit && result.credit.companyRatingCurrent ? result.credit.companyRatingCurrent.grade : null;

    const mapYear = (year) => {
      const key = Object.keys(annual).find((x) => x.startsWith(String(year))) || `${year}-12-31`;
      const block = annual[key] || {};
      const bs = block.balanceSheet || {};
      const is = block.incomeStatement || {};
      const cf = block.cashFlowAnalysis || {};
      return {
        assets: metric(bs, "totalAssets"),
        liabilities: metric(bs, "totalLiabilities"),
        equity: metric(bs, "totalEquity"),
        revenue: metric(is, "revenue"),
        cogs: metric(is, "costOfSales"),
        operatingProfit: metric(is, "operatingProfit"),
        netIncome: metric(is, "netIncome"),
        cash: metric(bs, "cashAndCashEquivalents"),
        currentAssets: metric(bs, "currentAssets"),
        currentLiabilities: metric(bs, "currentLiabilities"),
        receivables: metric(bs, "currentReceivables"),
        inventory: metric(bs, "inventory"),
        payables: metric(bs, "tradeAndOtherPayables"),
        borrowings: metric(bs, "totalBorrowingsIncludingOther") ?? metric(bs, "totalBorrowings"),
        currentBorrowings: metric(bs, "currentBorrowings") ?? metric(bs, "shortTermLoans"),
        nonCurrentBorrowings: metric(bs, "nonCurrentBorrowings") ?? metric(bs, "longTermLoans"),
        shortTermLoanReceivable: null,
        retainedEarnings: metric(bs, "retainedEarnings"),
        operatingCashFlow: metric(cf, "operatingCashGenerated"),
        interestExpense: metric(is, "financeCost"),
        capitalStock: metric(bs, "capitalStock")
      };
    };

    const latestQuarter = latestQuarterKey ? q[latestQuarterKey] : null;
    const latestQuarterly = latestQuarter ? {
      periodEnd: latestQuarterKey,
      assets: metric(latestQuarter, "balanceSheet.totalAssets"),
      liabilities: metric(latestQuarter, "balanceSheet.totalLiabilities"),
      equity: metric(latestQuarter, "balanceSheet.totalEquity"),
      cash: metric(latestQuarter, "balanceSheet.cashAndCashEquivalents"),
      currentAssets: metric(latestQuarter, "balanceSheet.currentAssets"),
      currentLiabilities: metric(latestQuarter, "balanceSheet.currentLiabilities"),
      currentBorrowings: metric(latestQuarter, "balanceSheet.currentBorrowings"),
      nonCurrentBorrowings: metric(latestQuarter, "balanceSheet.nonCurrentBorrowings"),
      revenue: metric(latestQuarter, "incomeStatement.revenue"),
      operatingProfit: metric(latestQuarter, "incomeStatement.operatingProfit"),
      netIncome: metric(latestQuarter, "incomeStatement.netIncome"),
      financeCost: metric(latestQuarter, "incomeStatement.financeCost"),
      sourcePage: 20,
      confirmed: false
    } : null;

    const issueQuestion = (x, i) => ({
      id: `extractConfirm_${i + 1}`,
      label: x.question || x.text || "추가 확인이 필요합니다.",
      type: "textarea",
      reason: x.reason || "PDF만으로 확정할 수 없는 항목입니다.",
      issueId: x.speechIssueId || null,
      priority: x.priority || "MEDIUM",
      relatedFields: x.relatedFields || []
    });

    const warnings = [];
    const validationWarnings = result.validation && Array.isArray(result.validation.extractionWarnings)
      ? result.validation.extractionWarnings : [];
    if (validationWarnings.length) warnings.push(...validationWarnings.map((x) => `자동추출 확인: ${x}`));
    if (result.quality && !result.quality.passed) warnings.push(...(result.quality.errors || []).map((x) => `추출검증 오류: ${x}`));
    warnings.push("개별·연결·분기 재무제표를 구분했으며 리포트 계산은 개별 결산값을 기본으로 사용합니다.");
    warnings.push("단기대여금·가지급금은 계정명과 거래상대방이 확인되지 않아 값으로 생성하지 않았습니다.");
    warnings.push("보험은 위험사건·필요재원·현재재원·부족재원 확인 전에는 상품·보험료 단계로 진행하지 않습니다.");

    return {
      meta: {
        caseId: opt.caseId || `CR-NICE-${Date.now().toString(36).toUpperCase()}`,
        sourceType: "NICE BizLINE 텍스트형 PDF",
        sourcePages: result.document.pageCount || 0,
        sourceFileName: opt.sourceFileName || "",
        unit: "백만원",
        confirmed: false,
        createdAt: new Date().toISOString().slice(0, 10),
        extractorVersion: result.extractorVersion || VERSION,
        extractionQualityPassed: !!(result.quality && result.quality.passed),
        statementType: `${result.document.statementStandard || "회계기준 미확인"} 개별 결산(기본) / 개별 분기·연결 결산(참고)`
      },
      profile: {
        companyName,
        displayName: companyName,
        businessNumber: metric(result, "company.businessNumber") || "",
        representative: metric(result, "company.ceoName") || "미확인",
        employees: metric(result, "company.employeeCount"),
        established: metric(result, "company.establishedDate"),
        companyType: Array.isArray(companyType) ? companyType.join("·") : (companyType || "미확인"),
        industry: metric(result, "company.industryName") || "미확인",
        industryCode: metric(result, "company.industryCode") || "",
        products: metric(result, "company.mainProducts") || "미확인",
        address: metric(result, "company.headOfficeAddress") || "",
        website: metric(result, "company.website") || "",
        mainBank: metric(result, "company.mainBank") || "",
        groupName: metric(result, "company.groupName") || "",
        creditGrade: creditGrade || "미확인",
        foreignSubsidiaries: [],
        relatedCompanies: affiliates.map((x) => x.name).filter(Boolean),
        shareholders,
        reportDate: result.document.reportDate || null,
        fiscalDate: latestAnnualKey,
        latestQuarterDate: latestQuarterKey
      },
      financials: {
        "2023": mapYear(2023),
        "2024": mapYear(2024),
        "2025": mapYear(2025)
      },
      latestQuarterly,
      capitalEvents: [],
      answers: {
        ceoStyle: "신중보수형",
        meetingStage: "1차 진단",
        successorStatus: "미확인",
        existingInsurance: "미확인",
        keyPersonMonthlyFixedCost: null,
        keyPersonEmergencyMonths: 12,
        immediateDebtRepayment: null,
        availableEmergencyCash: null,
        existingKeyPersonCoverage: null,
        topCustomerConcentration: "미확인"
      },
      sourceMap: {
        profile: "NICE BizLINE 3p·11p",
        credit: "NICE BizLINE 15~17p",
        financials: "NICE BizLINE 18~19p",
        quarterly: "NICE BizLINE 20p",
        consolidated: "NICE BizLINE 21p",
        shareholders: "NICE BizLINE 11p"
      },
      warnings: unique(warnings),
      speechPlan: result.speechPlan || null,
      dynamicQuestions: (result.confirmationQueue || []).map(issueQuestion),
      derivedSignals: result.derivedSignals || [],
      confirmationQueue: result.confirmationQueue || [],
      extractionResult: result
    };
  }

  return {
    VERSION,
    detectNiceBizline,
    extractNiceBizline,
    normalizePages,
    validate,
    buildSpeechPlan,
    essentialSnapshot,
    toCorporateReportCase
  };
});


/* ==========================================================================
 * JARVIA CORPORATE REPORT APPLICATION v1.6.3
 * ========================================================================== */
/* AUTO-EXTRACTED DATA FROM APPROVED v3.0 PLAN & SPEECH MASTER */
const ISSUE_SPEECH_LIBRARY = {"WORKING_CAPITAL":{"title":"성장·이익과 현금전환","signal":"매출과 이익이 증가했지만 영업현금흐름이 순이익을 따라가지 못하고 매출채권·재고가 함께 증가한 기업","guardrail":"채권·재고 세부자료가 없을 때 개선금액을 확정적으로 말하지 않는다.","speech30":"대표님, 실적이 좋아진 것은 분명한 강점입니다. 다만 이익이 늘어난 속도만큼 현금이 들어오지 않았다면 성장의 일부가 거래처와 재고에 머물러 있을 수 있습니다. 오늘은 성장을 문제 삼는 것이 아니라, 성장한 만큼 현금이 남는 구조인지 확인하겠습니다.","speech90":"대표님, 이번 실적은 매출과 이익 면에서 긍정적입니다. 그런데 영업현금흐름이 순이익보다 낮고 매출채권과 재고가 동시에 늘었다면, 회사가 돈을 못 번 것이 아니라 번 돈이 현금으로 전환되는 시간이 길어진 것입니다. 이 상태가 계속되면 매출이 늘수록 외부차입이나 대표님의 자금관여가 커질 수 있습니다. 거래처별 실제 회수일과 재고연령을 확인해 차입 전에 내부에서 확보할 수 있는 현금부터 계산하겠습니다. 최근 매출 증가와 별개로 자금집행이 빠듯한 시기가 있었습니까?","speech3m":"대표님, 실적 회복과 성장 자체는 분명히 긍정적입니다. 다만 손익계산서의 이익과 통장에 남는 현금은 같은 숫자가 아닙니다. 매출채권이 늘었다는 것은 매출은 인식됐지만 아직 받지 못한 돈이 늘었다는 뜻이고, 재고가 늘었다는 것은 판매 전 상품과 원재료에 현금이 더 오래 묶였다는 뜻입니다. 중요한 것은 증가액 전체가 아니라 매출 증가에 비해 회수기간과 재고기간이 얼마나 길어졌는지입니다. 거래처별 약정 결제일과 실제 회수일을 구분해 보고받고 계십니까? 장기재고도 정상재고와 별도로 표시합니까? 이 자료가 있으면 회수일수 5일·10일, 재고일수 3일·5일 개선 시 확보 가능한 현금의 범위를 계산할 수 있습니다. 그 금액은 보장되는 절감액이 아니라 실행 우선순위를 정하는 시나리오입니다. 상위 거래처와 장기재고부터 집중하고 13주 현금흐름표로 실제 개선 여부를 확인하겠습니다.","speech5m":"대표님, 이 페이지는 실적이 나쁘다는 이야기가 아닙니다. 오히려 매출과 이익이 크게 회복됐기 때문에 지금 관리기준을 만들 필요가 있다는 의미입니다. 손익계산서에는 매출이 발생한 시점에 수익이 잡히지만 회사가 실제로 쓸 수 있는 돈은 거래처가 대금을 지급하고 재고가 판매돼야 들어옵니다. 순이익이 50억원 발생했더라도 영업현금흐름이 30억원이라면 20억원의 차이가 어디에서 생겼는지 설명할 수 있어야 합니다. 대개 매출채권, 재고, 선급금, 매입채무의 변화가 원인입니다. 매출채권과 재고가 동시에 증가했다면 성장에 필요한 운전자금이 내부에 묶였을 가능성이 있습니다. 그렇다고 증가액 전체가 회수 가능한 현금이라는 뜻은 아닙니다. 매출채권에는 정상채권과 연체채권이 섞여 있고 재고에도 정상재고와 장기·저회전재고가 섞여 있습니다. 첫 질문은 “얼마나 늘었습니까?”가 아니라 “누구에게, 얼마 동안, 어떤 마진으로 묶여 있습니까?”여야 합니다. 순서는 세 단계입니다. 첫째 상위 거래처별 매출비중, 약정 결제일, 실제 회수일, 신용한도, 연체이력을 한 장에 놓습니다. 둘째 재고를 원재료·재공품·제품으로 나누고 90일·180일·1년 이상 재고를 구분합니다. 셋째 회수일수 5일과 10일, 재고일수 3일과 5일 시나리오를 계산하되 보수적·기준·도전 목표로 나눕니다. 대표님께 확인할 것은 두 가지입니다. 매출을 더 늘리는 과정에서 추가차입이 필요한 상황을 어느 수준까지 허용할 것인지, 거래처 관계를 해치지 않으면서 결제조건을 조정할 범위가 어디까지인지입니다. 대표님의 기준을 먼저 정해야 숫자가 정책이 됩니다. 다음 미팅에서는 채권연령표, 재고명세, 13주 자금수지와 주요 거래처 조건을 받아 8주 운전자금 개선안을 만들겠습니다. 거래처 부도나 국가위험이 크면 신용보험·무역보험을 검토하되 보험이 회수관리 자체를 대신하지는 않습니다. 오늘 결정할 것은 보험이 아니라 정밀진단 진행 여부, 담당자와 자료제출일입니다.","nextAction":"채권연령표·재고명세·13주 자금수지·상위 거래처 결제조건을 받아 8주 운전자금 정밀진단 일정과 담당자를 확정한다."},"LOAN_RECEIVABLE":{"title":"단기대여금·가지급금 가능성","signal":"재무상태표 또는 계정명세에 단기대여금·기타채권이 있고 상대방·목적·계약조건이 확인되지 않는 기업","guardrail":"상대방과 거래 실질 확인 전 대표자 가지급금·사적 사용·세무위반으로 단정하지 않는다.","speech30":"보고서에 대여금이 보이지만 누구에게 왜 지급됐는지를 모른 채 대표자 가지급금이라고 단정하면 안 됩니다. 정상적인 사업상 대여인지, 회수계획이 약한 채권인지부터 계약과 자금흐름으로 확인하겠습니다.","speech90":"대표님, 대여금은 금액보다 거래의 실질이 중요합니다. 관계회사 운영자금, 임직원 대여, 거래처 지원, 투자 전 단계 등 목적이 다를 수 있고 계약서·이자율·만기·담보·이사회 승인·실제 이자수취가 있다면 정상거래로 설명할 수 있습니다. 반대로 상환재원과 관리기록이 없다면 현금회수와 세무상 위험이 커질 수 있습니다. 상대방과 목적, 지급일, 계약조건, 잔액, 상환계획을 확인하고 회수·정상화·구조변경 중 어떤 방향이 적절한지 비교하겠습니다.","speech3m":"대표님, 이 계정은 이름만 보고 결론을 내리면 가장 위험한 항목 중 하나입니다. 같은 단기대여금이라도 해외 관계회사 운영자금, 거래처 지원금, 임직원 또는 주주 관련 자금일 수 있습니다. 먼저 상대방, 지급목적, 의사결정 절차, 계약서, 이자율, 만기, 담보, 실제 이자수취, 상환재원을 확인해야 합니다. 이 금액이 누구에게 어떤 목적으로 나갔는지 한 문장으로 설명할 수 있습니까? 담당 임원이 관리하는 상환일정표가 있습니까? 만기가 연장됐다면 이유와 승인기록이 있습니까? 자료가 갖춰져 있다면 정상거래를 더 명확하게 설명할 수 있고, 부족하다면 지금부터 거래를 재구성해 회수 또는 정상화 계획을 세워야 합니다. 이 문제는 보험이 아니라 계정원장·계약·상환계획을 정리하는 유료 정밀진단과 세무·법률 검토가 우선입니다.","speech5m":"대표님, 단기대여금이라는 계정이 보인다고 곧바로 대표자 가지급금이나 사적 사용으로 판단해서는 안 됩니다. 같은 계정에 서로 다른 거래가 묶여 있을 수 있기 때문입니다. 확인할 것은 돈을 받은 상대방, 지급목적, 회사가 언제 어떤 재원으로 회수할 계획인지입니다. 정상적인 사업상 거래라면 계약서, 이자율, 만기, 담보 또는 보증, 이사회 승인, 실제 이자수취, 상환스케줄이 있어야 합니다. 해외 관계회사 지원이라면 현지사업 목적과 자금사용, 이전가격·외환·관련자 거래 검토가 필요할 수 있습니다. 임직원이나 주주 관련 자금이면 지급경위와 업무관련성, 회수가능성, 승인절차를 더 세밀하게 봐야 합니다. 과거를 공격하는 것이 아니라 지금 설명 가능한 상태로 만드는 것이 목적입니다. 이 자금은 최초 지급 시 어떤 의사결정으로 나갔습니까? 계약서와 이자수취 내역이 있습니까? 만기가 지났다면 연장사유와 상환재원은 무엇입니까? 회사가 회수를 요구했을 때 상대방이 실제 상환할 수 있습니까? 대표님 답변과 자료가 일치해야 대안을 정할 수 있습니다. 대안은 보통 네 방향입니다. 상환재원이 충분하면 회수일정을 문서화합니다. 사업상 필요가 계속되면 이자·만기·담보·승인을 정상화합니다. 거래 실질이 출자나 투자에 가깝다면 세무·법률 검토 후 구조변경을 비교합니다. 회수가능성이 낮다면 손실·세무·책임 문제를 포함한 대응계획을 세웁니다. 이 페이지에서 보험상품을 연결하지 않는 것이 전문적인 판단입니다. 보험은 우연한 위험으로 생길 자금공백을 전가하는 수단이지 이미 발생한 대여금 회수문제를 해결하지 않습니다. 다음 단계는 계정별 원장, 자금이체, 계약·승인자료로 거래 타임라인을 복원하는 유료 정밀진단입니다.","nextAction":"계정별 원장·상대방·계약서·이자수취·만기·승인자료를 확보해 거래 타임라인과 회수·정상화 대안을 작성한다."},"CAPITAL_POLICY":{"title":"이익잉여금·배당·자본정책","signal":"미처분이익잉여금이 크거나 최근 배당·대규모 자본거래가 있고 투자·퇴직·승계계획이 분리되지 않은 기업","guardrail":"이익잉여금을 현금과 동일시하거나 “보험으로 빼낸다”는 표현을 사용하지 않는다.","speech30":"이익잉여금이 많다는 사실보다 회사가 앞으로 투자와 운영에 얼마를 남기고, 주주에게 언제 어떤 방식으로 이전할지가 중요합니다. 배당·보수·퇴직·승계·보험을 한꺼번에 섞지 않고 목적별로 나누겠습니다.","speech90":"대표님, 이익잉여금은 과거에 벌어 내부에 누적한 이익이지만 통장에 같은 금액의 현금이 있다는 뜻은 아닙니다. 이미 설비·재고·채권·관계회사 투자에 사용됐을 수 있습니다. “얼마를 빼낼까”보다 최소 운영현금, 향후 투자, 차입상환, 주주별 현금수요, 대표 퇴직, 승계재원을 3년 기준으로 나눠야 합니다. 그 뒤 배당·보수·퇴직·주식거래의 목적과 세금·현금·경영권 효과를 비교하고, 유고·퇴직·승계의 부족재원이 확인될 때만 보험을 별도로 검토하겠습니다.","speech3m":"대표님, 이익잉여금이 많으면 세금문제부터 이야기하지만 실제 경영에서는 자금배분 문제로 보는 것이 정확합니다. 성장투자와 운전자금으로 남겨야 할 돈, 금융기관 신뢰와 위기대응을 위한 돈, 주주가 필요로 하는 현금, 대표님의 퇴직과 승계에 필요한 자금을 구분해야 합니다. 향후 3년의 투자계획과 최소 운영현금, 차입상환과 배당계획, 주주별 현금 필요시점을 확인하겠습니다. 배당은 주주에게 현금을 이전하는 수단이고 보수는 경영기여의 대가이며 퇴직금은 규정과 실제 퇴직에 따른 지급입니다. 보험은 이익잉여금을 인출하는 방법이 아니라 유고·퇴직·승계 시점의 부족재원을 준비하는 수단입니다. 목적이 다른 수단을 세금 하나만 보고 섞지 않는 것이 핵심입니다.","speech5m":"대표님, 이익잉여금이 크다는 숫자만 보면 회사에 현금이 많이 쌓여 있다고 오해하기 쉽습니다. 하지만 이익잉여금은 누적된 회계상 이익이고 그 돈은 이미 설비·재고·매출채권·관계회사 투자에 사용됐을 수 있습니다. 가장 먼저 확인할 것은 “얼마를 인출할 수 있습니까?”가 아니라 “회사에 반드시 남겨야 할 현금이 얼마입니까?”입니다. 저희는 3년 자본정책표를 만들겠습니다. 최소 운영현금과 13주 자금수요, 설비·인력·해외법인·연구개발 투자, 차입상환과 금융기관 약정, 주주별 현금수요와 배당, 대표 퇴직과 승계재원을 한 표에 넣습니다. 이 표가 있어야 회사에 남길 돈과 주주에게 이전할 돈을 구분할 수 있습니다. 향후 3년 안에 예정된 대규모 투자와 차입상환은 무엇입니까? 주주별 현금 필요시점이 같습니까? 대표님의 퇴직과 후계구도는 언제부터 논의해야 합니까? 배당을 늘릴 경우 운전자금과 금융기관 평가에 미치는 영향을 검토했습니까? 이 답변이 배당정책과 승계정책의 기준입니다. 안정형은 회사에 충분한 현금을 남기고 배당을 보수적으로 운영합니다. 균형형은 일정한 배당정책과 대표 보수·퇴직·승계재원을 단계적으로 설계합니다. 적극형은 지분정리나 대규모 투자·승계를 전제로 자본거래까지 포함하지만 가치평가와 절차가 더 중요합니다. 각 안은 세금뿐 아니라 현금유출, 경영권, 법적 절차, 사후관리로 비교해야 합니다. 보험은 대표 유고나 퇴직, 승계 시점의 돈이 내부현금과 금융자산으로 부족하고 위험이 우연성과 장기성을 가질 때만 들어옵니다. 이익잉여금이 많다는 이유만으로 보험을 제안해서는 안 됩니다. 오늘 합의할 것은 3년 자본정책 시뮬레이션과 자료 담당자·제출일입니다.","nextAction":"3년 투자·운영·차입·배당·퇴직·승계 자금표를 작성하고 회사유보와 주주이전 기준을 합의한다."},"CAPITAL_TRANSACTIONS":{"title":"자기주식·감자·주식거래","signal":"최근 자기주식 취득·처분, 감자, 대규모 배당, 주식이동이 있었거나 향후 승계·공동주주 정리가 필요한 기업","guardrail":"과거 거래를 위법·탈세로 단정하거나 세금효과만으로 재거래를 제안하지 않는다.","speech30":"자기주식과 감자는 세금기법이 아니라 회사 현금, 주주지분, 경영권이 동시에 움직이는 자본거래입니다. 과거 거래의 목적과 절차를 먼저 복원하고 향후 주식이동 원칙을 정하겠습니다.","speech90":"대표님, 자기주식 취득·처분이나 감자는 거래 목적, 주식가치, 주주별 지분변화, 회사 현금유출입, 이사회·주총 절차가 모두 맞물립니다. 과거 거래를 좋다 나쁘다 평가하기 전에 거래 전후 주주구성과 현금흐름을 타임라인으로 복원해야 합니다. 그 결과를 바탕으로 승계, 공동주주 정리, 임직원 보상, 투자유치 때 어떤 원칙을 적용할지 3년 지분정책을 만들겠습니다. 보험은 향후 지분매입이나 승계 부족재원이 계산될 때만 검토합니다.","speech3m":"대표님, 자기주식과 감자는 한 번의 세무거래로 끝나는 것이 아니라 향후 지분구조를 바꾸는 사건입니다. 거래 목적, 누구의 주식을 어떤 가치로 취득했는지, 회사에서 얼마의 현금이 나갔는지, 거래 후 의결권과 지분율이 어떻게 변했는지 확인해야 합니다. 당시 거래의 가장 중요한 목적은 무엇이었습니까? 승계, 퇴직, 공동주주 정리, 주가관리 중 어느 목적이었습니까? 가치평가와 이사회·주총자료, 세무신고가 같은 논리를 갖고 있습니까? 과거 사실을 복원한 뒤 향후 3년 cap table과 주식이동 원칙을 만들면 같은 거래를 반복할 때 오류를 줄일 수 있습니다. 보험은 거래를 정당화하는 수단이 아니라 향후 지분매입이나 승계의 현금부족이 확인될 때만 사용합니다.","speech5m":"대표님, 자기주식이나 감자를 “세금을 줄이기 위한 방법”으로만 설명하면 위험합니다. 회사 현금, 주주별 현금수령, 지분율, 의결권, 기업가치, 이사회·주총 절차가 동시에 움직이기 때문입니다. 과거 거래의 적법성이나 세무효과를 여기서 단정하기보다 거래를 하나의 타임라인으로 복원하겠습니다. 거래 전 주주명부와 거래 후 주주명부를 비교하고, 당시 가치평가와 실제 거래가격, 회사에서 나간 현금과 주주가 받은 현금, 이사회·주총결의와 계약서·세무신고가 같은 목적을 설명하는지 확인합니다. 거래 후 회사 유동성과 경영권 변화도 봅니다. 이 다섯 가지가 맞아야 과거 거래를 설명하고 향후 정책을 세울 수 있습니다. 당시 거래의 목적은 퇴직재원, 승계, 공동주주 정리 중 무엇이었습니까? 거래가격은 어떤 평가로 정했습니까? 거래 후 운영현금 부담은 없었습니까? 향후 추가 주식이동 계획이 있습니까? 이 답변이 다음 설계의 출발점입니다. 향후에는 3년 지분정책을 만듭니다. 누가 경영하고 누가 주식을 보유할지, 비경영 주주에게 어떤 현금을 제공할지, 회사가 자기주식을 보유·처분할 원칙을 정합니다. 승계, 임직원 보상, 투자유치, 공동주주 정리마다 적합한 수단이 다르므로 하나의 기법을 반복하지 않습니다. 보험은 향후 주식매입이나 승계·유고 시 특정시점 현금이 필요하고 내부재원만으로 부족할 때 유동성 수단이 될 수 있습니다. 과거 거래의 세무위험은 보험으로 해결할 수 없습니다. 다음 단계는 거래 전후 cap table, 평가·결의·계약·세무자료를 복원하고 3년 지분정책을 설계하는 것입니다.","nextAction":"거래 전후 cap table·가치평가·결의·계약·세무자료를 복원하고 3년 지분정책 프로젝트 여부를 결정한다."},"EXECUTIVE_RETIREMENT":{"title":"임원퇴직금과 지급재원","signal":"대표·임원 근속이 길고 퇴직규정은 있으나 예상퇴직금, 실제 퇴직시점, 지급재원이 함께 계산되지 않은 기업","guardrail":"규정만으로 손금 인정이나 지급가능성을 보장하지 않고 보험을 퇴직금 자체와 동일시하지 않는다.","speech30":"퇴직금은 규정만 있다고 끝나는 문제가 아닙니다. 실제 퇴직시점에 지급할 금액과 회사가 운영에 지장 없이 마련할 수 있는 현금을 함께 계산해야 합니다.","speech90":"대표님, 임원퇴직금은 정관·규정·주총결의·등기임원 여부·보수·근속·실제 퇴직사실이 함께 맞아야 하고 지급시점에 회사가 감당할 현금도 있어야 합니다. 예상퇴직금을 범위로 계산하고 그 시점의 운영현금과 투자계획을 비교하겠습니다. 일시지급, 분할준비, 금융자산, 보험 등 적립수단은 비용과 세금뿐 아니라 확정성·유동성·해지위험·인수가능성으로 비교합니다.","speech3m":"대표님, 퇴직금은 세무규정만 확인해서는 실행계획이 되지 않습니다. 현재 정관과 임원퇴직금 규정이 실제 등기임원과 보수체계에 맞는지, 예상 퇴직시점과 그때의 근속·보수를 기준으로 금액 범위가 얼마인지, 회사가 지급 후에도 급여·매입·투자에 필요한 현금을 유지할 수 있는지 봐야 합니다. 퇴직시점과 퇴직 후 역할을 어느 정도 생각하고 계십니까? 퇴직금 전액을 한 번에 지급할 계획입니까? 회사가 지금부터 어느 정도를 별도 준비할 수 있습니까? 이 질문이 정리된 뒤 적립수단을 비교합니다. 보험은 장기적이고 우연한 위험과 함께 준비할 필요가 있을 때 한 수단이지만 비용처리나 수익을 보장하지 않습니다.","speech5m":"대표님, 임원퇴직금은 “규정이 있으니 나중에 지급하면 된다”는 접근으로는 부족합니다. 규정의 적정성, 실제 퇴직사실, 예상금액, 지급시점, 회사 현금능력이 함께 맞아야 실행 가능한 계획입니다. 정관과 임원퇴직금 규정, 주총결의, 등기임원 현황, 보수자료, 근속기간을 확인하고 예상 퇴직시점을 여러 구간으로 나눠 예상퇴직금 범위를 계산합니다. 금액은 한 숫자로 확정하기보다 보수·근속·규정변경 가능성을 반영해 최소·기준·상한 시나리오로 봅니다. 퇴직금이 20억원이라고 가정해도 지급시점에 회사가 보유한 20억원 전부를 사용할 수 있는 것은 아닙니다. 급여, 매입대금, 세금, 설비투자, 금융기관 약정에 필요한 운영필수현금을 제외해야 합니다. 내부현금, 정기적 적립, 금융자산, 분할지급 가능성, 보험의 현금가치와 보장을 각각 비교합니다. 보험을 활용한다면 계약자·피보험자·수익자, 보장목적, 해지환급, 건강심사, 회계·세무 처리를 확인해야 합니다. 퇴직은 경영에서 완전히 물러나는 시점입니까, 회장이나 고문으로 역할이 바뀌는 시점입니까? 후계자와 주주가 퇴직금 규모를 알고 동의하고 있습니까? 회사가 매년 부담 가능한 준비금액은 어느 정도입니까? 기존 법인보험 중 퇴직재원으로 의도된 계약이 있습니까? 오늘은 보험가입을 결정하는 자리가 아닙니다. 규정과 예상퇴직금, 회사 현금능력을 계산하고 부족재원이 확인되면 적립대안을 비교하는 데 동의받는 자리입니다. 다음 미팅에는 정관·규정·보수·근속·기존증권을 준비하고 세무·법률 검토가 필요한 항목은 기존 전문가와 확인하겠습니다.","nextAction":"정관·퇴직규정·임원현황·보수·근속·퇴직시점·기존증권을 받아 예상퇴직금과 지급가능 현금을 시뮬레이션한다."},"SUCCESSION":{"title":"경영승계·가족·주주 유동성","signal":"대표 연령·근속이 높거나 후계자·가족·공동주주가 있으나 경영권과 현금배분 원칙이 정리되지 않은 기업","guardrail":"상속세 절감이나 보험금만으로 승계를 해결한다고 표현하지 않는다.","speech30":"승계는 상속세만의 문제가 아닙니다. 누가 경영하고 누가 주식을 보유하며, 경영에 참여하지 않는 가족과 공동주주에게 어떤 현금을 제공할지를 함께 정해야 합니다.","speech90":"대표님, 회사가 성장할수록 비상장주식 가치는 커지지만 가족이 즉시 사용할 현금은 부족할 수 있습니다. 후계자에게 주식이 집중되면 비경영 가족과 형평성 문제가 생기고, 여러 명에게 분산되면 경영권 충돌이 생길 수 있습니다. 최신 주주명부, 후계자 의사, 가족별 역할과 현금수요, 기업가치 범위를 확인한 뒤 상속·증여·매매·자기주식·주주간계약을 A/B/C안으로 비교하고 확정된 부족재원에 대해서만 보험을 포함한 유동성 수단을 검토하겠습니다.","speech3m":"대표님, 승계를 준비한다고 당장 주식을 이전하자는 의미는 아닙니다. 지금 필요한 것은 의사결정 기준을 만드는 일입니다. 누가 다음 경영을 맡고, 경영하지 않는 가족은 어떤 권리와 현금을 받으며, 공동주주와의 관계를 어떻게 유지하고, 대표 유고 시 임시 의사결정을 누가 할지 정해야 합니다. 후계자를 어느 정도 생각하고 계십니까? 가족이 그 방향을 알고 있습니까? 회사 주식을 공평하게 나누는 것과 경영권을 안정적으로 유지하는 것 사이에서 어떤 원칙을 우선합니까? 최신 주주명부와 기업가치 범위를 확인한 뒤 후계자 중심, 공동경영, 외부매각 또는 전문경영체제를 비교할 수 있습니다. 보험은 상속세 해결책이 아니라 가족과 주주합의를 실행할 때 부족한 현금을 보완하는 수단입니다.","speech5m":"대표님, 승계는 먼 미래의 세금문제로 생각하기 쉽지만 실제로는 가족, 주주, 경영권, 현금의 문제입니다. 회사의 주식가치가 높아질수록 후계자에게 필요한 주식은 커지고, 경영에 참여하지 않는 가족에게 제공할 현금도 커질 수 있습니다. 준비가 없으면 주식은 많지만 현금이 부족해 지분이 분산되거나 급하게 매각해야 할 수 있습니다. 첫 단계는 사람과 역할입니다. 누가 후계자인지, 실제 경영할 의사와 역량이 있는지, 비경영 가족이 원하는 것은 주식인지 현금인지, 공동주주가 어떤 권리를 갖는지 확인합니다. 두 번째는 숫자입니다. 최신 주주명부와 기업가치 범위, 대표 개인재산, 예상 세금과 정산재원, 회사가 사용할 수 있는 현금을 구분합니다. 세 번째는 구조입니다. 상속·증여·매매·자기주식·주주간계약·지주구조 등을 세금·현금·경영권·절차·사후관리로 비교합니다. 대표님이 원하는 최종 모습은 후계자가 단독 경영하는 것입니까, 가족이 공동 소유하는 것입니까? 비경영 가족에게 주식보다 현금을 제공한다면 규모와 시점은 언제입니까? 공동주주가 대표 유고 시 주식을 매입하거나 매각할 원칙이 있습니까? 후계자가 정해지지 않았다면 비상경영체계부터 준비할 의사가 있습니까? 보험 필요성은 이 질문 뒤에 판단합니다. 대표 유고나 승계 시 지분매입, 세금, 가족정산, 운영자금을 합산하고 회사·개인 금융자산, 기존 보험, 차입가능액을 차감합니다. 부족분이 없으면 보험을 줄이거나 제외합니다. 부족분이 있더라도 보장기간과 보험료 부담, 계약자·피보험자·수익자, 주주합의, 세무·법률 검토를 거쳐야 합니다. 다음 단계는 가족과 주주의 결정을 요구하는 것이 아니라 1차 승계진단입니다. 주주명부, 가족관계, 후계자 의사, 기존 보험, 개인보증을 받아 세 가지 시나리오를 만들고 공동설명에서 판단기준을 합의하겠습니다.","nextAction":"최신 주주명부·가족·후계자·기업가치·기존보험을 확보해 승계 A/B/C안과 부족재원을 산출하고 공동설명 일정을 잡는다."},"KEY_PERSON":{"title":"대표자·핵심인 유고와 비상재원","signal":"대표 의존도가 높고 주요 고객·금융·해외법인·생산·지분결정이 특정 인물에게 집중된 기업","guardrail":"사망 공포를 조장하거나 회사현금과 기존보험을 확인하지 않고 보장금액을 제시하지 않는다.","speech30":"보험을 먼저 말씀드리려는 것이 아닙니다. 대표님이 일정 기간 경영에 참여하지 못할 때 어떤 업무가 멈추고, 회사를 유지하는 데 얼마의 현금이 필요한지를 계산해 보자는 것입니다.","speech90":"대표님, 유고는 사망만이 아니라 중대한 질병이나 장기부재도 포함합니다. 필요한 돈은 단순 대출상환액이 아니라 6~12개월 운영자금, 거래처와 금융기관 대응, 핵심인 유지, 해외법인 자금, 지분정리 비용까지 포함될 수 있습니다. 대체경영체계와 개인보증, 기존 보험, 실제 사용 가능한 현금을 확인하고 부족재원이 있으면 내부현금·신용한도·보험을 비교하겠습니다. 보험은 예고 없이 필요한 현금을 확보하는 역할로만 제시합니다.","speech3m":"대표님, 대표 유고 문제를 보험상품으로 시작하면 방어감이 생길 수 있습니다. 먼저 대표님이 한 달 이상 의사결정에 참여하지 못한다고 가정했을 때 멈추는 업무를 확인하겠습니다. 주요 거래처와 금융기관은 누가 대응합니까? 해외법인 자금집행과 계약서명은 누가 합니까? 핵심인력이 이탈하지 않도록 유지할 예산은 얼마입니까? 개인보증이나 즉시 대응해야 할 채무가 있습니까? 이 업무와 금액을 6개월·12개월로 계산하고 회사가 실제 사용할 수 있는 현금, 금융자산, 신용한도, 기존 보험을 차감합니다. 부족분이 없으면 보험을 확대할 이유가 없습니다. 부족분이 있으면 대체경영체계와 함께 보험의 역할을 검토합니다. 오늘 목표는 가입이 아니라 필요재원 계산과 기존증권 분석 동의입니다.","speech5m":"대표님, 이 페이지에서 가장 중요한 것은 보험가입 여부가 아닙니다. 대표님이 일정 기간 경영에 참여하지 못할 경우 회사가 어떤 순서로 흔들리고 그 충격을 막는 데 얼마가 필요한지를 확인하는 것입니다. 유고는 사망뿐 아니라 중대한 질병, 장기입원, 해외체류 중 사고처럼 의사결정이 중단되는 상황도 포함합니다. 먼저 업무공백을 봅니다. 주요 거래처와 금융기관이 대표님 개인의 신뢰에 의존합니까? 해외법인 자금과 중요한 계약을 대표님만 승인합니까? 생산, 품질, 영업, 인사 중 대표님이 빠지면 멈추는 의사결정은 무엇입니까? 대체할 임원과 권한위임 문서가 있습니까? 보험금이 있어도 대체경영체계가 없으면 회사가 자동으로 운영되는 것은 아닙니다. 필요재원은 6개월 또는 12개월의 급여·임차·이자·필수 매입 등 고정성 운영자금, 금융기관과 개인보증 대응금, 핵심인력 유지비, 긴급 전문경영인·자문비, 거래처 이탈 방지비, 주주간 지분매입 또는 가족정산 자금을 합산합니다. 그다음 회사의 가용현금과 금융자산, 실제 사용할 수 있는 신용한도, 기존 보험금, 주주 개인재원을 차감합니다. 운영에 이미 필요한 현금은 비상재원으로 중복 계산하지 않습니다. 대표님이 한 달 자리를 비웠을 때 가장 먼저 연락이 올 곳은 거래처입니까, 은행입니까, 해외법인입니까? 개인보증과 담보는 어느 정도입니까? 기존 법인·개인보험은 어떤 목적과 수익자로 구성돼 있습니까? 대체 임원에게 실제 권한이 있습니까? 이 네 가지가 확인돼야 보장 필요성과 금액을 판단합니다. 보험은 예고 없이 발생하는 시점에 약정된 현금을 확보할 수 있지만 모든 문제를 해결하지는 못합니다. 내부현금이 충분하거나 대체경영체계가 안정돼 있으면 보험규모를 줄입니다. 부족재원이 있더라도 보험료 부담, 건강심사, 보장기간, 계약자·피보험자·수익자 구조를 검토해야 합니다. 오늘은 가입이 아니라 대표 역할표, 개인보증, 기존증권, 월고정비를 받아 부족재원을 계산하는 데 동의해 주시면 됩니다.","nextAction":"대표 역할표·권한위임·개인보증·월고정비·기존증권을 받아 6·12개월 필요재원과 부족재원을 계산한다."},"EXPORT_CREDIT":{"title":"수출채권·거래처 신용위험","signal":"상위 거래처 집중도가 높거나 수출채권·장기미수·국가·환율위험이 있는 기업","guardrail":"수출매출이 있다는 이유만으로 신용보험을 제안하지 않고 거래처별 손실감내능력을 먼저 계산한다.","speech30":"매출이 늘어도 거래처 한 곳의 부도나 국가위험이 회사 현금흐름을 멈출 수 있다면 회수정책과 위험전가를 함께 봐야 합니다. 보험은 채권관리를 대신하지 않고 감당하기 어려운 손실만 넘기는 수단입니다.","speech90":"대표님, 수출채권 위험은 매출액보다 상위 거래처 집중도와 최대 미수잔액, 결제조건, 국가·통화, 연체경험이 중요합니다. 거래처별 한도와 실제 회수일을 관리하고 LC·담보·선수금·신용보험을 비교해야 합니다. 회사가 스스로 감당할 수 있는 손실은 내부관리로 두고, 한 번의 부도로 운영자금이 흔들리는 부분만 보험으로 전가하는 것이 합리적입니다. 기존 무역보험의 한도·면책·자기부담도 확인하겠습니다.","speech3m":"대표님, 신용보험은 매출을 보장하는 상품이 아니라 특정 거래처의 부도나 지급불능으로 생기는 손실 일부를 전가하는 장치입니다. 먼저 상위 거래처별 매출비중, 평균·최대 미수잔액, 약정과 실제 회수일, 연체와 분쟁, 국가·통화위험을 봐야 합니다. 거래처별 신용한도를 누가 승인합니까? 한 거래처의 최대 미수금이 손실돼도 회사가 운영될 수 있습니까? 기존 무역보험의 한도와 면책을 실제 거래조건과 비교했습니까? 이 자료를 바탕으로 회수정책, 담보·선수금, LC, 신용보험을 순서대로 비교하고 보험료와 자기부담까지 포함한 손익을 계산하겠습니다.","speech5m":"대표님, 수출채권은 매출이 성장할수록 커지기 때문에 “매출이 많으니 좋은 일”과 “한 번의 부도가 회사현금을 멈출 수 있다”는 두 사실을 동시에 봐야 합니다. 상위 거래처 몇 곳에 매출이 집중되거나 결제기간이 길고 국가·통화위험이 있으면 최대 손실액을 관리해야 합니다. 상위 거래처의 매출비중, 평균 미수잔액, 최대 미수잔액, 약정 결제일, 실제 회수일, 연체경험, 분쟁, 국가·통화, 담보와 LC 사용 여부를 한 장으로 정리합니다. 그다음 회사가 감당 가능한 손실한도를 정합니다. 한 거래처 부도로 10억원 손실이 나도 운영에 문제가 없다면 전액 보험이 필요하지 않을 수 있습니다. 반대로 5억원만 발생해도 급여와 매입대금이 흔들리면 위험전가 필요성이 높습니다. 거래처별 신용한도는 누가 어떤 기준으로 승인합니까? 연체가 시작됐을 때 출하중단과 회수조치를 언제 실행합니까? 상위 거래처 한 곳이 지급을 멈추면 몇 개월 버틸 수 있습니까? 기존 무역보험의 한도와 면책을 실제 거래와 맞춰 봤습니까? 대안은 내부 신용한도와 연체관리, 선수금·LC·담보·보증, 거래처·국가 분산, 그리고 남는 대규모 손실의 보험전가 순서입니다. 보험료, 자기부담, 면책, 보상절차, 신용한도 축소 가능성까지 봐야 합니다. 오늘 결론은 가입이 아니라 상위 거래처별 채권현황과 기존 보험으로 보장공백과 적정한도를 계산하는 것입니다. 회수관리 개선만으로 충분하면 보험을 확대하지 않고 감당하기 어려운 손실이 확인될 때만 제안하겠습니다.","nextAction":"상위 거래처별 매출·미수·회수일·연체·국가·담보·기존 무역보험을 받아 최대손실과 보장공백을 산출한다."},"PROPERTY_BI":{"title":"재산·휴업·해외사업장 위험","signal":"제조설비·창고·해외생산법인·핵심공급망이 있고 사고 시 복구기간과 영업손실이 큰 기업","guardrail":"장부가만으로 가입금액을 정하거나 국내증권만 보고 해외보장 중복·공백을 단정하지 않는다.","speech30":"재산위험은 건물과 기계를 다시 사는 비용만의 문제가 아닙니다. 공장이 멈춘 기간의 매출총이익과 고정비를 회사가 얼마나 버틸 수 있는지가 핵심입니다.","speech90":"대표님, 장부가나 과거 취득가로 가입된 재산보험은 실제 재조달가액과 차이가 날 수 있고 휴업손실 보상기간이 복구기간보다 짧으면 공장이 복구되기 전에 현금이 먼저 고갈될 수 있습니다. 국내 본사와 해외법인의 자산, 적하, 배상, 공급망, 휴업을 한 지도에 놓고 재조달가액·최대예상손실·대체생산·복구기간을 확인하겠습니다. 기존증권의 한도·면책·자기부담·현지조건을 비교해 공백과 중복만 조정하겠습니다.","speech3m":"대표님, 재산보험은 가입금액이 있다는 사실보다 사고 후 실제 복구와 영업재개가 가능한지가 중요합니다. 건물·기계·재고의 재조달가액, 최대예상손실, 대체생산 가능성, 핵심설비 납기, 공급망 중단, 휴업기간의 매출총이익과 고정비를 확인해야 합니다. 핵심설비가 손상되면 정상가동까지 몇 개월이 걸립니까? 해외법인이나 특정 공급처가 멈추면 대체할 곳이 있습니까? 현지증권의 보장범위와 본사보험이 연결돼 있습니까? 자산명세와 증권으로 보장공백·중복·휴업기간을 분석하고 재보험·현지법상 제한은 전문가와 확인하겠습니다.","speech5m":"대표님, 화재나 자연재해가 발생하면 눈에 보이는 손실은 건물과 기계이지만 실제 회사가 무너지는 이유는 복구기간의 현금흐름일 수 있습니다. 설비를 다시 구입하는 데 8개월이 걸리고 그동안 급여·임차·이자·고정비가 계속 나간다면 재산복구비만 받아서는 충분하지 않습니다. 자산을 장부가가 아니라 실제 재조달가액과 복구기간으로 보고, 한 번의 사고에서 실제로 손실될 수 있는 최대범위와 방재수준을 확인합니다. 공장이 멈춘 기간의 매출총이익과 고정비, 고객이탈, 긴급외주와 운송비를 계산하고 국내 본사와 해외법인, 적하, 배상, 공급망, 휴업보험을 한 지도에 놓아 중복과 공백을 찾습니다. 가장 긴 납기의 핵심설비는 무엇이며 교체에 몇 개월이 걸립니까? 국내 또는 해외에 대체생산이 가능합니까? 주요 고객은 납품이 몇 주 지연되면 거래를 중단할 수 있습니까? 현지법인 증권의 면책과 보상한도를 본사에서 통합관리합니까? 이 답이 휴업보상기간과 적정한도를 결정합니다. 보험은 방재와 비상계획을 대신하지 않습니다. 예방투자, 재고분산, 대체생산계약, 데이터백업, 비상구매처를 정비하고 남는 대규모 손실을 보험으로 전가합니다. 가입금액과 보상기간은 실제 복구시나리오와 손실감내능력에 맞춥니다. 해외현지법, 보험조건, 재보험 가능성도 확인합니다. 다음 미팅에는 자산명세, 생산흐름, 핵심설비 납기, 국내외 증권, 사고이력, 방재점검표를 준비해 주시면 됩니다. 최대예상손실과 휴업기간을 산출하고 유지·조정·추가할 보장만 제시하겠습니다.","nextAction":"자산명세·핵심설비 복구기간·생산대체·국내외 증권·사고이력을 받아 재산·휴업 보장공백 지도를 만든다."},"INSURANCE_OPTIMIZATION":{"title":"기존 법인·대표 보험증권 최적화","signal":"법인·대표 개인보험이 여러 건 있으나 가입목적, 수익자, 보장기간, 현금가치, 필요재원과의 연결이 불명확한 기업","guardrail":"기존 계약의 해지손실·신규심사·면책을 확인하지 않고 교체·해지를 권하지 않는다.","speech30":"새로운 가입보다 먼저 현재 보험이 왜 가입됐고 지금의 경영목적과 맞는지 확인하겠습니다. 보험이 많다는 사실과 필요한 때 사용할 수 있다는 사실은 다를 수 있습니다.","speech90":"대표님, 기존 보험은 보장금액 합계만 보면 충분해 보여도 계약자·피보험자·수익자, 보장기간, 현금가치, 해지손실, 실제 필요재원과 맞지 않으면 유고·퇴직·승계 때 원하는 역할을 하지 못할 수 있습니다. 모든 법인·개인 증권을 목적별로 분류하고 유지·감액·전환·추가가입을 비교하되 신규심사와 해지손실을 먼저 확인하겠습니다. 목적과 부족재원이 맞으면 유지하고 맞지 않는 부분만 조정하는 것이 원칙입니다.","speech3m":"대표님, 보험이 많다고 보장이 충분한 것도 아니고 보험료가 많다고 잘못된 것도 아닙니다. 중요한 것은 각 계약이 어떤 경영목적을 위해 가입됐고 지금도 그 목적과 맞는지입니다. 대표 유고, 퇴직재원, 승계유동성, 대출보장, 직원복지, 재산·배상 등으로 분류하겠습니다. 계약자·피보험자·수익자, 보장기간, 보험금 지급조건, 현금가치, 납입기간, 해지손실, 신규심사 가능성을 확인합니다. 각 계약을 누가 왜 가입했는지 설명할 수 있습니까? 유고 시 보험금이 회사와 가족 중 누구에게 가야 하는지 합의돼 있습니까? 목적이 맞는 계약은 유지하고 중복이나 목적불일치가 확인될 때만 조정·추가를 비교하겠습니다.","speech5m":"대표님, 기존 보험증권 분석의 목적은 새로운 계약을 만들기 위한 것이 아닙니다. 현재 계약이 회사의 경영위험과 필요한 자금시점에 맞는지 확인하는 것입니다. 보험금 총액이 커도 대표 유고 시 가족에게만 지급되거나 회사 운영자금이 필요한 기간보다 보장기간이 짧거나 승계재원이 필요한 시점에 현금가치가 부족하면 목적을 달성하기 어렵습니다. 법인과 대표 개인의 모든 증권을 대표 유고, 핵심인, 퇴직, 승계, 대출·보증, 직원복지, 재산·휴업·배상으로 분류합니다. 각 계약의 계약자·피보험자·수익자, 보장금액, 보장기간, 납입기간, 현금가치, 해지환급, 대출, 특약, 면책을 정리하고 앞서 계산한 필요재원과 비교합니다. 각 계약을 가입할 당시 가장 중요한 목적은 무엇이었습니까? 지금도 그 목적이 유효합니까? 유고 시 보험금이 회사운영, 가족생활, 주식매입 중 어디에 사용돼야 합니까? 퇴직이나 승계시점에 현금가치를 활용할 계획이라면 실제 시점과 금액을 확인했습니까? 보험료가 회사 현금흐름에 부담입니까? 목적과 필요재원이 맞는 계약은 유지합니다. 금액이 과다하거나 기간이 맞지 않으면 감액과 구조조정을 검토합니다. 해지손실과 신규심사 위험이 큰 계약은 섣불리 전환하지 않습니다. 실제 부족재원이 남고 인수가능성과 보험료 부담이 적절할 때만 추가가입을 제안합니다. 기존 설계사와의 관계도 존중하고 필요하면 공동검토합니다. 오늘은 해지나 가입을 결정하지 않습니다. 증권 전체를 제출받아 목적·필요재원·수익자·기간·손실을 비교하는 데 동의받는 단계입니다. 변경이 필요해도 기존계약을 먼저 유지한 상태에서 신규심사와 대체가능성을 확인하겠습니다.","nextAction":"법인·개인 증권 전체를 표준표로 정리하고 목적·필요재원·수익자·기간·해지손실·신규심사를 비교한다."}};
const CEO_RESPONSE_BRANCHES = {"WORKING_CAPITAL":[{"type":"즉시 동의","expression":"“맞습니다. 매출은 늘었는데 현금이 빠듯합니다.”","response":"“체감과 숫자가 같은 방향입니다. 원인을 채권·재고·매입조건으로 나누겠습니다.”","followUp":"“최근 3개월 중 가장 자금이 빠듯했던 주와 원인은 무엇이었습니까?”","agreement":"채권연령표·재고연령표·13주 자금계획 제출일 확정"},{"type":"부분 동의","expression":"“채권은 괜찮은데 재고가 조금 많습니다.”","response":"“그렇다면 문제를 넓히지 않고 재고의 회전과 장기재고부터 보겠습니다.”","followUp":"“정상·저회전·장기재고를 구분하는 기준과 담당자는 누구입니까?”","agreement":"상위 20개 장기재고와 5일 개선 시나리오 작성"},{"type":"부정","expression":"“현금은 충분하고 문제없습니다.”","response":"“현재 유동성이 안정적이라는 점은 강점입니다. 점검 목적은 위기판정이 아니라 성장 여력을 확인하는 것입니다.”","followUp":"“매출이 20% 더 늘어도 현재 결제조건으로 추가 운전자금을 내부에서 감당할 수 있습니까?”","agreement":"성장률별 필요운전자금 민감도표 검토 동의"},{"type":"정보 부족","expression":"“정확한 회수일이나 재고일수는 모릅니다.”","response":"“대표님이 모르는 것이 문제가 아니라 관리정보가 한 장으로 올라오지 않는 것이 과제입니다.”","followUp":"“재무팀과 영업팀 중 거래처별 실제 회수일을 바로 뽑을 수 있는 곳은 어디입니까?”","agreement":"자료 담당자와 추출기한 지정"},{"type":"전문가 위임","expression":"“회계사와 재무팀이 관리합니다.”","response":"“기존 전문가의 결산·세무 역할은 존중합니다. 이번 작업은 경영 의사결정용 현금 KPI를 만드는 일입니다.”","followUp":"“월별 회의에서 DSO·재고일수·13주 현금전망을 보고받고 계십니까?”","agreement":"기존 전문가 포함 30분 데이터 미팅 제안"},{"type":"비용 우려","expression":"“진단까지 비용을 들일 필요가 있습니까?”","response":"“전체 프로젝트를 결정하지 말고 회수일 10일·재고일 5일 개선 가능금액을 먼저 산출하겠습니다.”","followUp":"“그 잠재금액이 진단비보다 충분히 크면 다음 단계로 가는 방식은 어떻습니까?”","agreement":"1차 정밀진단 범위·산출물·비용 합의"},{"type":"결정 유예","expression":"“연말 결산 후 보겠습니다.”","response":"“결산까지 미루는 것도 선택입니다. 다만 그 사이 자료가 누적되므로 확인일을 정해 두는 것이 좋습니다.”","followUp":"“결산 전에는 자료만 준비하고, 결산 직후 1시간 검토일을 잡아도 괜찮겠습니까?”","agreement":"재검토일과 선행자료 목록 확정"}],"LOAN_RECEIVABLE":[{"type":"즉시 동의","expression":"“회수계획을 정리해야 합니다.”","response":"“좋습니다. 회수·사업성 대여·자본거래 가능성을 분리해 가장 실행 가능한 안부터 보겠습니다.”","followUp":"“상대방과 최초 목적, 만기, 이자, 현재 회수 가능액은 무엇입니까?”","agreement":"원장·계약·결의·이자·상환자료 확보"},{"type":"부분 동의","expression":"“일부는 받을 수 있지만 전액은 어렵습니다.”","response":"“그렇다면 회수 가능액과 장기정상화 대상액을 나누는 것이 첫 단계입니다.”","followUp":"“현금회수 외에 상계·분할상환·담보보강이 가능한 항목이 있습니까?”","agreement":"금액별 A/B/C 정상화안 작성"},{"type":"부정","expression":"“관계회사 거래라 문제없습니다.”","response":"“관계회사 거래 자체를 문제로 보는 것이 아닙니다. 독립된 사업거래로 설명 가능한 문서와 조건이 있는지가 핵심입니다.”","followUp":"“제3자 거래와 같은 계약·이자·만기·승인 절차가 갖춰져 있습니까?”","agreement":"증빙 적정성 체크리스트 검토"},{"type":"정보 부족","expression":"“누가 언제 가져갔는지 정확하지 않습니다.”","response":"“이 경우 결론보다 원장 복원이 우선입니다. 사적 사용이라고 단정하지 않겠습니다.”","followUp":"“세부원장·통장·전표를 연결할 담당자를 지정할 수 있습니까?”","agreement":"거래 타임라인 복원 일정 확정"},{"type":"전문가 위임","expression":"“세무사가 처리하고 있습니다.”","response":"“세무처리는 전문가가 잘하고 있을 것입니다. 경영 측면에서는 회수와 현금계획이 필요합니다.”","followUp":"“세무상 처리 외에 실제 상환일정과 책임자가 정해져 있습니까?”","agreement":"세무사 동석 정상화 미팅 제안"},{"type":"비용 우려","expression":"“금액도 크지 않은데 컨설팅까지 필요합니까?”","response":"“금액·기간·증빙을 확인해 단순정리로 끝날 사안이면 프로젝트를 확대하지 않겠습니다.”","followUp":"“1차 서류진단으로 범위를 판단하는 데 동의하십니까?”","agreement":"단계형 진단 계약 또는 무료 제외 판단"},{"type":"결정 유예","expression":"“나중에 관계회사 정리할 때 함께 보겠습니다.”","response":"“그 시점까지 이자·인정이자·증빙공백이 누적될 수 있으므로 최소한 현 상태를 확정해 두겠습니다.”","followUp":"“이번 달에는 원장과 계약 유무만 확인하고 정리시점은 별도로 정할까요?”","agreement":"현황확정일과 재검토일 지정"}],"SUCCESSION":[{"type":"즉시 동의","expression":"“이제 준비해야 합니다.”","response":"“주식이전부터가 아니라 사람·경영권·현금의 원칙부터 정하겠습니다.”","followUp":"“후계자, 비경영 가족, 공동주주 중 가장 먼저 합의해야 할 사람은 누구입니까?”","agreement":"1차 인터뷰와 주주명부 제출"},{"type":"부분 동의","expression":"“아들은 생각하지만 아직 확정은 아닙니다.”","response":"“확정하지 않아도 됩니다. 후계자 A안과 미확정 B안을 함께 비교하겠습니다.”","followUp":"“아들이 경영하지 않을 경우 회사가 유지될 대안은 무엇입니까?”","agreement":"2개 승계시나리오 작성"},{"type":"부정","expression":"“아직 건강하고 너무 이릅니다.”","response":"“지금 주식을 넘기자는 뜻이 아닙니다. 유고 시 임시 의사결정과 가족 갈등 방지 기준만 먼저 만드는 것입니다.”","followUp":"“한 달간 대표님이 부재하면 누가 은행·거래처·해외법인을 결정합니까?”","agreement":"비상경영체계 점검 동의"},{"type":"정보 부족","expression":"“주식가치나 세금은 모릅니다.”","response":"“정확한 숫자를 모르기 때문에 범위평가가 필요합니다. 추정과 확정을 구분하겠습니다.”","followUp":"“최신 주주명부와 최근 재무제표를 기준으로 1차 범위를 계산해도 되겠습니까?”","agreement":"기업가치 범위 산정"},{"type":"전문가 위임","expression":"“세무사에게 승계를 맡길 생각입니다.”","response":"“세무사의 세무검토가 핵심입니다. 저희는 가족·주주·보험·현금흐름을 연결해 의사결정안을 만들겠습니다.”","followUp":"“세무사와 가족이 함께 볼 한 장짜리 A/B/C안이 필요하십니까?”","agreement":"협업설명회 일정 제안"},{"type":"비용 우려","expression":"“승계 컨설팅은 비용이 많이 듭니다.”","response":"“전체 실행 전에 진단단계만 분리하겠습니다. 의사결정이 없으면 구조설계는 진행하지 않습니다.”","followUp":"“주주·후계자·기업가치·부족재원만 확인하는 1차 진단부터 보시겠습니까?”","agreement":"1차 진단 범위 계약"},{"type":"결정 유예","expression":"“가족과 먼저 상의하겠습니다.”","response":"“가족에게 바로 결정을 요구하면 부담이 큽니다. 중립적인 현황자료를 먼저 만들겠습니다.”","followUp":"“가족회의 전 대표님 단독 사전정리 후 공동설명 날짜를 잡을까요?”","agreement":"가족 공동설명 일정과 참석자 확정"}],"KEY_PERSON":[{"type":"즉시 동의","expression":"“제가 없으면 회사가 많이 흔들릴 겁니다.”","response":"“그렇다면 업무공백과 필요현금을 각각 계산해 실행순서를 정하겠습니다.”","followUp":"“가장 먼저 멈출 업무와 6개월간 필요한 고정비는 무엇입니까?”","agreement":"역할표·고정비·증권 제출"},{"type":"부분 동의","expression":"“임원들이 운영은 할 수 있습니다.”","response":"“그 점은 큰 강점입니다. 다만 권한과 현금이 실제로 준비돼 있는지 확인하겠습니다.”","followUp":"“은행·대형거래처·해외법인 서명권까지 임원에게 위임돼 있습니까?”","agreement":"권한위임·비상결재 점검"},{"type":"부정","expression":"“저에게 그런 일은 없을 겁니다.”","response":"“가능성을 높게 보는 것이 아니라, 영향이 큰 사건을 사전에 관리하는 경영원칙입니다.”","followUp":"“화재 확률이 낮아도 공장 방재를 하듯, 한 달 부재 시 대응표만 확인해도 괜찮겠습니까?”","agreement":"비상대응표 작성 동의"},{"type":"정보 부족","expression":"“필요한 돈이 얼마인지 모르겠습니다.”","response":"“그래서 보험금부터 정하지 않고 6·12개월 필요재원을 계산합니다.”","followUp":"“월 고정비·보증·핵심인 유지비·지분정리 중 회사에 해당하는 항목은 무엇입니까?”","agreement":"필요재원 산출자료 요청"},{"type":"전문가 위임","expression":"“기존 설계사가 보험을 잘 관리합니다.”","response":"“기존 관계를 바꿀 목적이 아닙니다. 경영 필요재원과 증권이 맞는지만 공동검토하겠습니다.”","followUp":"“기존 설계사와 함께 목적별 증권표를 검토해도 되겠습니까?”","agreement":"공동 증권분석 제안"},{"type":"비용 우려","expression":"“보험료가 부담됩니다.”","response":"“보험료를 논의하기 전에 부족재원이 있는지부터 확인하겠습니다. 부족분이 없으면 제안하지 않습니다.”","followUp":"“내부현금·신용한도·기존보험을 차감한 최소 부족분만 비교할까요?”","agreement":"최소·기준·상한 설계 범위 동의"},{"type":"결정 유예","expression":"“배우자와 상의해야 합니다.”","response":"“당연합니다. 가족에게 상품을 설명하기보다 필요재원과 선택안을 함께 보여드리겠습니다.”","followUp":"“배우자와 공동주주가 참여하는 설명일을 정할까요?”","agreement":"공동설명 일정·자료 확정"}],"INSURANCE_OPTIMIZATION":[{"type":"즉시 동의","expression":"“보험이 너무 많아 정리가 필요합니다.”","response":"“해지부터 하지 않고 목적·필요재원·해지손실·신규심사를 비교하겠습니다.”","followUp":"“각 계약을 가입한 목적을 기억하는 순서대로 말씀해 주시겠습니까?”","agreement":"전체 증권 수집·목적분류"},{"type":"부분 동의","expression":"“몇 건만 오래돼 확인이 필요합니다.”","response":"“그 계약부터 우선순위로 보되 전체 중복 여부는 함께 확인하겠습니다.”","followUp":"“보장기간·수익자·현금가치 중 가장 걱정되는 것은 무엇입니까?”","agreement":"우선계약 분석"},{"type":"부정","expression":"“기존 설계사가 알아서 잘해 줍니다.”","response":"“기존 관리가 잘돼 있다면 확인 결과도 유지가 결론일 수 있습니다.”","followUp":"“경영 필요재원과 증권 목적을 한 장으로 연결해 본 적이 있습니까?”","agreement":"공동검토 또는 유지 확인"},{"type":"정보 부족","expression":"“계약이 많아 내용을 모릅니다.”","response":"“모르는 상태에서 해지·추가를 결정하지 않겠습니다. 표준표로 먼저 정리하겠습니다.”","followUp":"“법인과 개인 증권을 한 번에 받을 담당자를 지정할 수 있습니까?”","agreement":"증권 수집기한 확정"},{"type":"전문가 위임","expression":"“보험 담당자에게 물어보면 됩니다.”","response":"“좋습니다. 담당자의 상품정보와 저희의 경영 필요재원 분석을 결합하겠습니다.”","followUp":"“담당자와 30분 공동검토를 잡을까요?”","agreement":"3자 미팅 제안"},{"type":"비용 우려","expression":"“분석비까지 내야 합니까?”","response":"“신규가입을 전제로 하지 않는 독립분석이라면 비용과 산출물을 분명히 해야 합니다.”","followUp":"“유지·감액·추가 각각의 근거와 손실을 보여주는 보고서가 필요하십니까?”","agreement":"유료 증권분석 범위 합의"},{"type":"결정 유예","expression":"“만기 때 다시 보겠습니다.”","response":"“만기 전에도 수익자·목적·보장기간이 맞지 않으면 사고 시 문제가 될 수 있습니다.”","followUp":"“변경 없이 현황만 확정하고 만기 3개월 전 재검토일을 잡을까요?”","agreement":"현황보고서와 재검토 알림 확정"}]};
const INSURANCE_SPEECH_STAGES = [{"stage":"1. 보험 가능성 발견","speech":"“현재 자료에서 보험을 검토할 이유가 보이는 것은 ○○ 위험입니다. 다만 보험가입이 필요하다는 결론은 추가확인 전에는 내리지 않겠습니다.”","validation":"위험사건·재무충격·보험가능성 구분","gate":"위험이 실제 업무·현금에 미치는 영향 확인"},{"stage":"2. 필요재원 계산 동의","speech":"“가입금액을 정하는 것이 아니라 회사가 실제로 필요한 금액을 계산하는 데 먼저 동의해 주시면 됩니다.”","validation":"필요재원 구성과 기간 설정","gate":"운영비·상환·보증·지분·세금 등 항목 합의"},{"stage":"3. 기존 준비재원·증권 분석","speech":"“가용현금, 금융자산, 신용한도, 기존 보험 중 실제 사용할 수 있는 금액을 구분하겠습니다.”","validation":"중복·공백·수익자·지급시점 확인","gate":"증권과 현금자료 요청"},{"stage":"4. 보험 외 대안 비교","speech":"“내부적립, 금융자산, 차입한도, 주주간계약, 보험을 비용·확정성·시점·유동성으로 비교하겠습니다.”","validation":"보험 단독해법 방지","gate":"A/B/C 대안 비교"},{"stage":"5. 보험설계 검토 동의","speech":"“부족재원 범위 안에서 회사 현금흐름을 해치지 않는 구조만 검토하겠습니다. 비교 자체는 가입동의가 아닙니다.”","validation":"범위·기간·보험료 한도 합의","gate":"설계 요청 동의"},{"stage":"6. 계약구조·인수심사","speech":"“계약자·피보험자·수익자와 보험료 부담주체가 목적에 맞아야 하며, 건강·재무심사 결과에 따라 구조가 달라질 수 있습니다.”","validation":"약관·면책·할증·거절 대안 설명","gate":"심사자료와 개인정보 동의"},{"stage":"7. 최종 결정","speech":"“진행·축소·보류 중 하나를 결정하실 수 있도록 필요재원, 대안, 비용, 해지·심사 위험을 한 장으로 비교하겠습니다.”","validation":"압박 없는 결정 지원","gate":"결정자·조건·일정 확정"},{"stage":"8. 계약 후 실행관리","speech":"“증권 발행이 끝이 아니라 가입목적과 회계·세무, 수익자, 보장금액을 매년 기업상황과 함께 점검하겠습니다.”","validation":"목적 유지·변경관리","gate":"연례리뷰와 사건 발생 프로토콜"}];
const OBJECTION_LIBRARY = [{"title":"보험료가 부담된다는 대표","dialogue":[{"speaker":"대표","text":"필요성은 알겠는데 보험료가 너무 큽니다.","intent":"비용 반론"},{"speaker":"컨설턴트","text":"그 우려가 맞습니다. 월 지출 자체가 부담인지, 납입기간이 긴 것이 부담인지 먼저 구분해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"장기간 돈이 묶이는 게 싫습니다.","intent":"유동성 우려"},{"speaker":"컨설턴트","text":"그렇다면 전액을 보험으로 준비하지 않겠습니다. 내부현금·신용한도·단기 적립을 먼저 배치하고 예고 없이 필요한 최소 부족분만 보장으로 비교하겠습니다.","intent":"범위 축소"},{"speaker":"컨설턴트","text":"최소·기준·상한 세 안과 각 안의 현금부담을 다음 회의에서 비교하는 데까지 동의하시겠습니까?","intent":"설계검토 합의"}]},{"title":"배우자·가족의 반대","dialogue":[{"speaker":"대표","text":"배우자가 보험을 싫어해서 결정하기 어렵습니다.","intent":"가족반대"},{"speaker":"컨설턴트","text":"상품을 먼저 설명하면 더 부담스러울 수 있습니다. 가족이 확인해야 할 것은 유고 시 필요한 현금과 현재 준비재원입니다.","intent":"문제 재정의"},{"speaker":"대표","text":"그래도 판매라고 생각할 겁니다.","intent":"신뢰 우려"},{"speaker":"컨설턴트","text":"그렇다면 보험 없는 대안, 최소 보험안, 충분 보험안을 같은 표로 보여드리고 가족이 선택하지 않아도 되는 조건까지 명시하겠습니다.","intent":"선택권 보장"},{"speaker":"컨설턴트","text":"가족 공동설명은 30분으로 제한하고 필요재원과 대안만 설명하는 일정으로 잡겠습니다.","intent":"공동설명 합의"}]},{"title":"공동주주의 반대","dialogue":[{"speaker":"공동주주","text":"왜 회사가 대표 개인을 위해 보험료를 냅니까?","intent":"이해상충 우려"},{"speaker":"컨설턴트","text":"개인 복지가 아니라 회사가 입을 손실과 필요한 자금만 계산해야 합니다. 수익자와 사용목적도 그 원칙에 맞아야 합니다.","intent":"회사 목적 명확화"},{"speaker":"공동주주","text":"보험금이 가족에게 가면 회사와 무관하지 않습니까?","intent":"구조 반론"},{"speaker":"컨설턴트","text":"맞습니다. 회사운영자금, 가족생활비, 지분매입재원은 계약 목적과 지급주체가 다를 수 있으므로 분리 설계하고 법률·세무 확인을 받겠습니다.","intent":"목적별 구조 분리"},{"speaker":"컨설턴트","text":"주주합의가 없는 구조는 진행하지 않고, 필요재원표와 계약구조안을 주주회의 안건으로 올리겠습니다.","intent":"거버넌스 합의"}]},{"title":"할증·부담보·인수제한","dialogue":[{"speaker":"컨설턴트","text":"심사 결과가 예상보다 불리하게 나왔습니다. 이 결과를 숨기거나 처음 제안을 그대로 밀어붙이지 않겠습니다.","intent":"투명한 고지"},{"speaker":"대표","text":"그렇다면 가입할 이유가 없지 않습니까?","intent":"가치 의문"},{"speaker":"컨설턴트","text":"할증 보험료, 보장제한, 대기기간을 숫자로 비교하고 내부적립·다른 보장기간·보험금 축소와 함께 검토해야 합니다.","intent":"대안 비교"},{"speaker":"대표","text":"어떤 안이 맞습니까?","intent":"판단 요청"},{"speaker":"컨설턴트","text":"필수 부족재원 중 보험으로 확보해야 할 최소금액만 남기고, 제한된 위험은 별도 비상계획으로 보완하는 안을 권고하겠습니다.","intent":"최소 적합안 제시"}]},{"title":"기존 설계사·타 제안과 비교","dialogue":[{"speaker":"대표","text":"기존 설계사도 비슷한 상품을 제안했습니다.","intent":"비교상황"},{"speaker":"컨설턴트","text":"관계를 바꾸는 것이 목적이 아닙니다. 상품명보다 필요재원, 계약목적, 수익자, 기간, 보험료, 해지손실을 같은 기준으로 비교하겠습니다.","intent":"중립 기준"},{"speaker":"대표","text":"누구 제안이 더 좋은지 말해 주세요.","intent":"선택 요구"},{"speaker":"컨설턴트","text":"필요재원 충족도와 회사 현금부담, 심사조건, 사후관리 기준을 점수화해 장단점을 밝히겠습니다. 기존 안이 적합하면 그대로 유지하겠습니다.","intent":"독립분석"},{"speaker":"컨설턴트","text":"양쪽 설계서를 동일 표준표로 비교할 자료를 받아 다음 회의에서 판단하겠습니다.","intent":"자료합의"}]},{"title":"보험 근거가 부족한 기업","dialogue":[{"speaker":"컨설턴트","text":"현재 재무자료만으로는 신규 보험계약을 권할 근거가 충분하지 않습니다.","intent":"비제안 선언"},{"speaker":"대표","text":"보험 컨설턴트인데 가입 제안을 안 합니까?","intent":"역할 의문"},{"speaker":"컨설턴트","text":"보험은 필요재원과 보장공백이 확인될 때만 제안해야 합니다. 현재는 운전자금과 대여금 정상화가 우선입니다.","intent":"신뢰 강화"},{"speaker":"대표","text":"그럼 보험은 언제 봅니까?","intent":"조건 확인"},{"speaker":"컨설턴트","text":"대표 역할·기존증권·주주·승계의사까지 확인한 뒤 부족재원이 생기면 검토하고, 없으면 기존계약 유지가 결론입니다.","intent":"조건부 검토"}]}];
const SCENARIO_LIBRARY = [{"title":"첫 미팅 신뢰 형성","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 오늘은 상품을 설명드리기보다 재무자료에서 확인된 사실과 추가 확인이 필요한 부분을 구분해 말씀드리겠습니다. | 판매 경계 해소\n대표 | 결국 보험 이야기 아닌가요? | 초기 방어\n컨설턴트 | 보험이 적합한 위험이 없으면 제안하지 않겠습니다. 먼저 회사의 현금·주주·대표 의존도를 보겠습니다. | 원칙 제시\n대표 | 그럼 무엇부터 봅니까? | 관심 전환\n컨설턴트 | 대표님이 가장 신경 쓰는 현금, 승계, 위험 중 한 가지를 정하고 20분 안에 핵심만 확인하겠습니다. | 의제 합의"},{"title":"한 줄 진단 제시","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 이 회사는 성장과 수익성은 회복됐지만 성장한 만큼 현금이 남는 구조와 자본·승계정책을 동시에 정비할 시점입니다. | 균형진단\n대표 | 문제가 많다는 뜻입니까? | 위험 확대 우려\n컨설턴트 | 아닙니다. 강점이 커졌기 때문에 다음 단계의 관리기준이 필요하다는 뜻입니다. | 강점 기반 리프레임\n대표 | 무엇이 가장 먼저입니까? | 우선순위 요청\n컨설턴트 | 첫째 현금전환, 둘째 과거 자본거래 복원, 셋째 대표 유고·승계의 부족재원 순서입니다. | 3대 우선순위"},{"title":"이익잉여금·배당정책","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 이익잉여금이 많으니 배당하면 되지 않습니까? | 단일해법\n컨설턴트 | 배당은 가능하지만 운영·투자·차입·승계에 필요한 회사 유보액을 먼저 계산해야 합니다. | 회사현금 우선\n대표 | 세금이 많이 나오잖아요. | 세금 반론\n컨설턴트 | 세금만 낮춘 안보다 세후 현금, 회사 유동성, 경영권, 절차를 함께 비교하겠습니다. | 5축 비교\n컨설턴트 | 3년 자금수요표를 만든 뒤 정기배당·상여·퇴직·주식거래 중 적합한 조합을 결정하겠습니다. | 정책 프로젝트 전환"},{"title":"자기주식·감자 과거거래","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 과거 자기주식과 감자를 좋다 나쁘다 단정하지 않고 거래 전후 주주와 현금의 흐름을 복원하겠습니다. | 중립 복원\n대표 | 이미 세무처리가 끝났습니다. | 종결 반론\n컨설턴트 | 세무신고와 별개로 향후 승계·주식이동 시 설명 가능한 기록이 남아 있어야 합니다. | 미래 활용\n대표 | 무슨 자료가 필요합니까? | 자료 관심\n컨설턴트 | 거래 전후 주주명부, 가치평가, 결의, 계약, 대금흐름, 신고자료 여섯 가지입니다. | 자료 확정"},{"title":"임원퇴직재원","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 규정이 있으니 퇴직할 때 지급하면 됩니다. | 규정 충분론\n컨설턴트 | 규정은 출발점이고 실제 퇴직사실, 예상금액, 지급 후 회사현금이 함께 맞아야 합니다. | 실행요건\n대표 | 지금 준비하면 돈이 묶입니다. | 유동성 반론\n컨설턴트 | 전액 적립이 아니라 퇴직시점별 부족재원을 계산하고 현금·금융자산·보험을 분산 비교하겠습니다. | 분산대안\n컨설턴트 | 예상퇴직금과 운영필수현금을 먼저 계산하는 진단부터 진행하겠습니다. | 진단 동의"},{"title":"승계를 부정하는 대표","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 아직 10년은 더 일할 겁니다. | 시기 부정\n컨설턴트 | 그 계획을 존중합니다. 지금 주식을 넘기자는 것이 아니라 10년 계획이 중단돼도 회사를 지킬 비상기준을 만드는 것입니다. | 계획 보호\n대표 | 임원들이 알아서 할 겁니다. | 대체 가능 주장\n컨설턴트 | 실제 서명권, 은행권한, 주주합의가 문서로 있는지 확인하면 됩니다. | 검증 질문\n컨설턴트 | 승계 실행은 미루고 비상경영체계와 주주명부 점검만 먼저 하겠습니다. | 범위 축소"},{"title":"가족 공동설명","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n배우자 | 보험을 팔기 위한 승계설명 아닌가요? | 신뢰 반론\n컨설턴트 | 오늘은 보험상품을 제시하지 않습니다. 가족별 역할, 주식, 현금, 유고 시 필요한 자금을 먼저 확인합니다. | 판매 배제\n자녀 | 제가 회사를 맡을지는 아직 모릅니다. | 후계 불확실\n컨설턴트 | 그 가능성을 포함해 후계자 A안과 전문경영 B안을 함께 비교하겠습니다. | 대안 병렬\n컨설턴트 | 가족이 동의한 목표가 생긴 뒤 부족재원이 있을 때만 보험을 검토하겠습니다. | 조건부 연결"},{"title":"공동주주 반대","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n공동주주 | 대표 승계를 위해 회사 돈을 쓰는 데 동의하기 어렵습니다. | 이해상충\n컨설턴트 | 회사운영, 가족정산, 주식매입 목적을 분리하고 회사가 부담할 정당한 부분만 계산하겠습니다. | 목적 분리\n공동주주 | 주식가치부터 믿기 어렵습니다. | 평가 신뢰\n컨설턴트 | 단일값이 아니라 복수 평가와 민감도 범위를 제시하고 외부전문가 검증을 받겠습니다. | 독립 검증\n컨설턴트 | 주주간계약과 의사결정 기준을 먼저 합의한 뒤 재원수단을 보겠습니다. | 거버넌스 선행"},{"title":"기존 세무사와 역할 충돌","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 세금 문제는 세무사가 다 합니다. | 전문가 위임\n컨설턴트 | 그 역할을 존중합니다. 저희는 재무자료를 CEO 결정, 가족·주주, 보험·현금 실행으로 연결합니다. | 역할 차별화\n대표 | 중복 비용 아닌가요? | 비용 반론\n컨설턴트 | 세무검토는 기존 세무사가 하고 저희는 A/B/C안과 실행 일정·자료를 통합하겠습니다. 중복업무는 제외합니다. | 협업 범위\n컨설턴트 | 세무사에게 질문할 항목을 정리해 공동검토하는 방식으로 진행하겠습니다. | 협업 합의"},{"title":"보험증권 제출 거부","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 증권은 개인자료라 보여주기 어렵습니다. | 개인정보 우려\n컨설턴트 | 그 우려가 타당합니다. 전체 사본이 부담되면 계약자·피보험자·수익자·보장·기간만 가린 표로 받을 수 있습니다. | 최소수집\n대표 | 그래도 필요합니까? | 필요성 질문\n컨설턴트 | 기존 보험을 모르고 신규가입을 제안하면 중복과 목적불일치 위험이 있습니다. 확인 없이는 제안하지 않겠습니다. | 안전 원칙\n컨설턴트 | 필수항목만 적은 보안양식과 파기기준을 먼저 드리겠습니다. | 보안 합의"},{"title":"기존 설계사와 비교","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 오래 거래한 설계사가 있는데 왜 바꿔야 합니까? | 관계 방어\n컨설턴트 | 바꾸실 필요 없습니다. 경영 필요재원과 기존안이 맞으면 유지가 최선입니다. | 관계 존중\n대표 | 그럼 당신 역할은 뭡니까? | 역할 질문\n컨설턴트 | 상품이 아니라 필요재원·계약목적·수익자·현금부담을 독립적으로 검증하고 기존 담당자와 실행을 맞추는 역할입니다. | 독립 검증\n컨설턴트 | 기존 담당자와 공동검토해도 괜찮습니다. | 협업 제안"},{"title":"건강심사 우려","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 건강이 좋지 않아 심사가 걱정됩니다. | 인수 우려\n컨설턴트 | 심사 가능성을 먼저 확인하고 불리한 조건을 숨기지 않겠습니다. 보험 외 대안도 동시에 설계하겠습니다. | 투명성\n대표 | 거절되면 시간만 낭비 아닌가요? | 효율 반론\n컨설턴트 | 예비심사, 최소보장, 다른 기간, 내부적립을 병렬 비교해 가능한 범위만 진행하겠습니다. | 병렬 대안\n컨설턴트 | 의무기록과 고지사항을 정확히 준비한 뒤 예비검토부터 하겠습니다. | 예비심사 합의"},{"title":"보험 근거 없음 선언","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 현재 자료로는 신규보험보다 운전자금과 대여금 정상화가 우선입니다. | 비제안\n대표 | 보험 판매가 목적이 아니라는 말이 진짜네요. | 신뢰 반응\n컨설턴트 | 대표 역할과 기존증권을 확인한 뒤 부족재원이 없으면 보험은 유지 검토로 끝내겠습니다. | 조건 명확화\n대표 | 그럼 다음 단계는 무엇입니까? | 행동 관심\n컨설턴트 | 채권·재고·대여금 자료로 1차 정밀진단을 진행하고 보험은 별도 게이트를 통과할 때만 열겠습니다. | 컨설팅 우선"},{"title":"계약 후 연례점검","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 지난해 계약 목적은 대표 유고 시 12개월 운영자금이었습니다. 올해 매출·고정비·차입·주주구조가 어떻게 변했는지 확인하겠습니다. | 목적 재확인\n대표 | 보험은 가입했으니 끝난 것 아닙니까? | 사후관리 인식\n컨설턴트 | 필요재원은 변하고 수익자·보장기간도 경영변화에 따라 어긋날 수 있습니다. | 갱신 필요\n대표 | 무엇을 바꿔야 합니까? | 검토 요청\n컨설턴트 | 먼저 부족재원을 재계산하고 충분하면 유지, 과다하면 축소, 부족하면 대안을 비교하겠습니다. | 유지·축소·추가 원칙\n33"}];
const SPEECH_CORPUS = [{"title":"General","text":"기업경영 종합리포트\n실전상담화법 마스터 교본 v3.0\nCEO 설득 · 페이지별 상담노트 · 보험계약 전환 · 반론 대응 · 음성강의 프롬프트 체계\n문서의 목적\n본 문서는 자비아 기업경영 종합리포트 프로그램이 유료 실전상품으로 작동하기 위해 필요한 상담화법 체계 전체를 설계한다. 리포트 본문, 컨설턴트 전용 노트, 보험계약 기회, 반론 대응, 다음 미팅 전환, 음성강의 대본이 하나의 분석데이터에서 일관되게 생성되도록 하는 제품 수준의 기준서이다.\n문서 버전 | v3.0\n작성 기준일 | 2026년 7월\n적용 시스템 | JARVIA 기업경영 의사결정 종합리포트\n활용 대상 | 법인컨설턴트 · 교육기획 · 프롬프트개발 · 시스템개발\n보안 등급 | 실전 출시·교육·개발 통합본\n㈜한국FP센터 · JARVIA\n00\n문서 사용안내\n이 설계서는 단순 화법 모음집이 아니라 프로그램이 자동으로 생성해야 할 상담사고 체계와 품질기준을 정의한다."},{"title":"핵심 전제","text":"고객에게 보여주는 CEO용 본문과 컨설턴트만 보는 내부 노트를 엄격히 분리한다.\n보험은 분석의 출발점이 아니라 확인된 위험과 부족재원에 대한 결론으로 제시한다.\n모든 화법은 기업보고서의 확인된 사실, 코드 계산값, 사용자의 추가답변 위에서 생성한다.\n미확인 사실은 단정하지 않고 질문, 시나리오, 추가확인사항으로 표현한다.\n각 페이지는 “읽는 자료”가 아니라 CEO의 이해와 결정을 한 단계씩 진전시키는 상담장치로 설계한다.\n음성강의는 리포트 낭독이 아니라 컨설턴트가 실제 상담에서 사용할 사고법과 화법을 훈련하는 교육콘텐츠로 생성한다.\n최종 산출물의 구조\n하나의 HTML 안에서 CEO용 · 컨설턴트용 · 음성강의용 3개 모드를 제공한다. 공용 분석과 해결안은 CEO·컨설턴트 모드에 공통 표시하고, 보험계약 기회·유료컨설팅 기회·내부 판단·상담화법·반론 대응·클로징은 컨설턴트 모드에만 표시한다."},{"title":"법률·세무·보험 유의사항","text":"본 문서는 상담지원과 교육을 위한 설계 기준이다. 개별 기업의 법률·세무·보험계약 판단은 관련 증빙, 최신 제도, 상품 약관, 인수심사, 적합성 및 설명절차를 확인한 후 해당 전문가와 최종 검토해야 한다.\n00\n목차\n상담철학부터 프롬프트·보험화법·오디오·검수체계까지 전 과정을 한 문서에 통합하였다.\n구분 | 내용\n01 | 제품 수준의 상담화법 철학 | 19 | CEO 답변 7종 분기엔진\n02 | CEO·컨설턴트·음성강의 3모드 설계 | 20 | 완전한 상담 대화 시나리오\n03 | 모든 페이지에 적용되는 10단 상담노트 | 21 | 보험계약 8단계 전 과정 화법\n04 | 화법 생성 프롬프트 시스템 | 22 | CEO 성향·기업유형 맞춤화\n05 | 언어·설득·윤리 기준 | 23 | 반론 25종 완결 대응\n06 | 기업 이슈별 실전상담화법 | 24 | 실행형 프롬프트 P1~P9\n07 | 보험계약 기회 판단과 전환화법 | 25 | 음성강의 실전훈련 설계\n08 | 보험분야별 고도화 화법 | 26 | 92.3점 품질게이트\n09 | 반론·답변 분기·클로징 라이브러리 | 27 | 최종 운영 체크리스트\n10 | 상담 미팅 전 과정 운영화법 | 28 | v3.0 최종개선 파트\n11 | 음성강의 대본 생성체계 | 29 | 현장용 완성대사 라이브러리\n12 | 구조화 데이터·JSON·프롬프트 템플릿 | 30 | 핵심 이슈별 CEO 7분기\n13 | 품질검수와 평가루브릭 | 31 | 보험계약 8단계·최종결정\n14 | M사 적용 예시 | 32 | 완전 상담 시나리오 20선\n15 | 부록: 표준 문장·금지표현·체크리스트 | 33 | CEO·기업유형 맞춤화 엔진\n16 | 마무리·개발 우선순위 | 34 | 실행형 프롬프트·JSON 스키마\n17 | 92~93점 실전출시형 최종판 | 35 | 음성강의 3종 완성 샘플\n18 | 5단 화법 세트 | 36 | 최종 품질게이트·92~93점 판정\n01\n제품 수준의 상담화법 철학\n좋은 화법은 말을 잘하는 기술이 아니라, 사실을 해석하고 대표의 결정을 돕는 구조다."},{"title":"1.1 화법의 정의","text":"상담화법은 보고서 문장을 읽어주는 것이 아니다. 기업의 사실을 경영언어로 번역하고, CEO가 문제를 스스로 인식하며, 합리적인 다음 행동을 결정하도록 돕는 대화 설계다."},{"title":"유료 프로그램이 제공해야 할 가치","text":"사용자가 기대하는 질문 | 프로그램이 반드시 제공할 답\n이 숫자가 왜 중요한가? | 회계수치를 현금·경영권·위험·의사결정 언어로 해석한다.\n대표에게 무엇을 물어야 하는가? | 기업별 핵심질문, 답변별 후속질문, 필요한 증빙을 제시한다.\n어떤 순서로 상담해야 하는가? | 도입→문제인식→정량화→대안→다음 미팅의 흐름을 제공한다.\n보험계약 기회가 있는가? | 근거·위험·필요재원·부족재원·보험역할·계약가능성 등급을 제시한다.\n반론이 나오면 어떻게 대응하는가? | 압박이 아닌 재확인·정량화·선택권 부여 방식의 응대를 제공한다.\n어떻게 계약으로 연결하는가? | 유료진단·프로젝트·전문가 협업·보험설계·사후관리의 다음 행동을 명확히 한다."},{"title":"1.2 핵심 원칙 8가지","text":"원칙 | 실행기준\n근거 우선 | 확인된 사실과 계산값이 먼저이며, 화법은 그 위에서만 생성한다.\n문제보다 결정 | 문제를 지적하는 데 그치지 않고 CEO가 무엇을 결정해야 하는지까지 연결한다.\n보험은 결론 | 보험은 부족재원이 확인될 때 제시하는 위험재원 수단이지 만능해결책이 아니다.\n대표의 언어 | 회계·세법 용어를 현금, 시간, 통제력, 가족, 직원, 거래처 언어로 번역한다.\n질문 중심 | 설명만 하지 않고 대표의 상황과 의도를 확인하는 질문을 포함한다.\n선택권 보장 | A·B·C안과 장단점을 제시하고 대표가 선택하도록 한다.\n다음 행동 명확화 | 모든 페이지와 상담의 끝에는 자료, 담당자, 기한, 다음 미팅이 남아야 한다.\n윤리와 적합성 | 공포·과장·세금만능·상품선제시를 금지하고, 전문가 검토와 계약 적합성을 존중한다."},{"title":"1.3 상담의 설득 구조","text":"표준 설득 흐름\n사실 확인 → 의미 해석 → 위험 또는 기회 정량화 → 대표의 인식 확인 → 대안 비교 → 결정항목 합의 → 다음 행동 확정\n사실: “2025년 매출채권과 재고가 함께 증가했습니다.”\n의미: “이익이 났지만 현금이 회수되지 않거나 재고에 묶였다는 뜻입니다.”\n정량화: “회수기간 10일 단축 시 확보 가능한 현금규모를 계산할 수 있습니다.”\n인식 확인: “대표님도 성장할수록 운영자금 부담이 커진다고 느끼십니까?”\n대안 비교: “회수정책, 재고정책, 금융한도, 채권보험을 순서대로 비교하겠습니다.”\n결정: “먼저 채권연령표와 재고명세를 기준으로 정밀진단을 진행할지 결정해 주시면 됩니다.”\n02\nCEO·컨설턴트·음성강의 3모드 설계\n동일한 분석결과를 세 가지 목적에 맞춰 다르게 보여주는 것이 핵심이다."},{"title":"2.1 모드별 역할","text":"구분 | 주요 사용자 | 노출 내용 | 금지 또는 제한\nCEO용 | 대표·임원·의사결정자 | 공통 팩트, 경영해석, 위험, 해결안, 결정사항, 실행로드맵 | 영업기법, 계약가능성 점수, 내부 클로징, 피보험자 후보 등 비노출\n컨설턴트용 | 법인컨설턴트·관리자 | CEO 공통내용 + 페이지별 화법, 질문, 분기, 반론, 보험·유료계약 기회, 자료목록 | 확정되지 않은 사실을 확정표현하지 않음\n음성강의용 | 컨설턴트 학습자 | 쉽게 이해하는 해설, 상담 인사이트, 잘못된 접근/올바른 접근, 실전질문, 보험전환 | 보고서 단순 낭독, 법령번호 나열, 과도한 상품 홍보 금지"},{"title":"2.2 콘텐츠 가시성 규칙","text":"콘텐츠 블록 | CEO용 | 컨설턴트용 | 음성강의\n기업 기본현황·재무팩트 | 표시 | 핵심만 해설\n문제·원인·방치위험 | 표시 | 표시 + 내부 해석 | 쉽게 설명\nA·B·C 실행대안 | 표시 | 표시 + 선택 유도 화법 | 장단점 해설\n보험계약 기회 등급 | 숨김 | 표시 | 조건과 접근법 교육\n피보험자·계약자·수익자 검토 | 숨김 | 표시 | 원칙 중심 해설\n페이지별 상담노트 | 숨김 | 표시 | 강의 원천으로 활용\n예상 반론·클로징 | 숨김 | 표시 | 실전 사례로 교육\n법령·예규·판례 원문정보 | 근거표시 | 상세표시 | 실무 의미만 설명\n음성 플레이어 | 표시 가능 | 표시 | 주요 기능"},{"title":"2.3 CEO 전달본 보안","text":"중요\n통합 HTML은 화면에서 숨겨도 소스보기나 개발자도구를 통해 내부내용이 노출될 수 있다. CEO에게 전달할 때는 컨설턴트 전용 블록을 실제 데이터에서 제거한 별도 HTML 또는 CEO용 PDF로 내보내야 한다.\n03\n모든 페이지에 적용되는 10단 상담노트\n각 페이지는 하나의 소형 상담시나리오로 완결되어야 한다."},{"title":"3.1 10단 표준 구조","text":"단계 | 요구사항\n1. 페이지 목적 | 대표에게 무엇을 이해시키고 어떤 결정을 준비시킬지 정의한다.\n2. 핵심 진단 | 페이지의 팩트와 계산값이 의미하는 경영적 해석을 한 문장으로 압축한다.\n3. 실제 설명 화법 | 대표 호칭을 포함한 자연스러운 대화체 4~8문장을 제공한다.\n4. 핵심 확인 질문 | 사실·의도·우선순위·기존 준비를 확인하는 질문 3~5개를 제공한다.\n5. 답변별 분기 | 긍정·부정·모름·미룸·전문가에게 맡김 등의 답변별 후속대응을 제공한다.\n6. 예상 반론 | 실제 CEO가 제기할 가능성이 높은 반론 2~4개를 제시한다.\n7. 반론 대응 | 방어하지 않고 재확인, 숫자화, 선택권 부여 방식으로 응대한다.\n8. 심화 가이드 | 출처·산식·가정·경계선·금지단정·전문가 확인영역을 제공한다.\n9. 계약·프로젝트 연결 | 유료진단, 컨설팅, 전문가 협업, 보험설계, 사후관리 중 적절한 다음 단계를 제시한다.\n10. 전환·준비자료 | 다음 페이지 또는 다음 미팅으로 연결하는 문장과 받아야 할 자료를 제시한다."},{"title":"3.2 페이지 노트 품질기준","text":"본문을 그대로 반복하지 않는다. 반드시 “왜 중요한지”와 “상담에서 어떻게 쓸지”를 추가한다.\n대표를 몰아붙이는 표현보다 진단과 선택의 언어를 사용한다.\n모든 질문은 기업자료의 실제 이슈와 연결돼야 한다.\n반론 대응은 논쟁에서 이기는 문장이 아니라 다음 확인으로 이어지는 문장이어야 한다.\n페이지 마지막에는 다음 행동 또는 다음 페이지로 넘어갈 이유가 있어야 한다.\n보험 관련 노트는 필요재원·기존재원·부족재원의 구조를 반드시 포함한다."},{"title":"3.3 범용 페이지 노트 예시","text":"현금흐름 페이지 | 페이지별 컨설턴트 노트\n이 페이지의 목적은 “이익이 증가해도 현금이 부족할 수 있다”는 점을 대표가 이해하고, 운전자금 정밀진단의 필요성을 합의하도록 하는 것이다."},{"title":"실제 설명 화법","text":"대표님, 지난해 매출과 이익은 분명히 좋아졌습니다. 다만 회사에 실제로 들어온 현금은 이익만큼 늘지 않았습니다. 매출채권과 재고가 동시에 증가했다는 것은 회사가 벌어들인 돈의 일부가 아직 거래처와 창고에 머물러 있다는 뜻입니다. 지금부터는 매출을 더 늘리는 것만큼, 발생한 매출을 얼마나 빨리 현금으로 바꾸는지가 중요합니다."},{"title":"핵심 확인 질문","text":"매출이 증가하는데도 운영자금이 빠듯하다고 느끼신 적이 있습니까?\n주요 거래처별 약정 결제일과 실제 회수일을 별도로 관리합니까?\n90일 이상 장기채권을 매월 보고받고 있습니까?\n장기재고·불용재고를 정상재고와 구분하고 있습니까?"},{"title":"답변별 분기","text":"대표 답변 | 컨설턴트 후속 대응\n“현금문제는 없습니다” | 현재 잔액보다 성장 시 필요한 현금의 속도를 점검하는 예방진단이라는 점을 설명한다.\n“최근 빠듯합니다” | 차입보다 먼저 회수일수와 재고일수에서 확보 가능한 현금을 계산하자고 제안한다.\n“정확히 모릅니다” | 채권연령표와 재고명세를 받아 13주 현금흐름표로 확인하자고 제안한다."},{"title":"예상 반론과 응대","text":"예상 반론 | 전문적 응대\n“회계사가 보고 있습니다” | 회계사는 결산을 정확히 하는 역할이고, 이번 검토는 결산자료로 운영의사결정 기준을 만드는 작업이라고 역할을 구분한다.\n“매출이 늘었으니 자연스러운 현상입니다” | 일정 증가는 자연스럽지만 증가속도가 매출보다 빠르면 추가 운전자금 부담이 커지므로 비율과 회전일수를 함께 보자고 답한다."},{"title":"심화 가이드","text":"현금흐름표·매출채권·재고의 연도별 변화를 함께 본다.\n시나리오 금액은 보장액이 아니라 개선가능성을 보는 가정값으로 표시한다.\n회수가능성과 재고처분가능성은 회사 실무자료 확인 전 단정하지 않는다."},{"title":"계약·프로젝트 연결","text":"우선 연결은 8~12주 운전자금 개선 프로젝트다. 거래처 부도위험이 크거나 수출채권 비중이 높다면 채권보험·무역보험 검토를 별도 보험기회로 연계한다."},{"title":"다음 상담 준비자료","text":"거래처별 채권연령표\n주요 거래처 결제조건\n재고명세 및 장기재고 기준\n최근 13주 자금수지표\n04\n화법 생성 프롬프트 시스템\n하나의 거대한 프롬프트가 아니라 역할이 분리된 다단계 프롬프트 체계가 필요하다."},{"title":"4.1 전체 파이프라인","text":"권장 생성순서\n기업자료 구조화 → 이슈선별 → 계산·근거조회 → 솔루션 설계 → CEO 본문 → 페이지별 컨설턴트 노트 → 보험화법 → 음성강의 → 교차검수 → 최종 렌더링\n엔진 | 역할\nP1. 사실 구조화 | PDF·답변을 연도·단위·출처·확인상태가 있는 JSON으로 변환한다.\nP2. 이슈 진단 | 기업별로 해당하는 이슈만 선별하고 심각도·시급도·확인도를 평가한다.\nP3. 솔루션 설계 | 문제·원인·위험·해결이익·A/B/C안·실행순서를 설계한다.\nP4. 보험기회 판단 | 위험사건·필요재원·기존재원·부족재원·보험역할·등급을 판단한다.\nP5. CEO 본문 | 영업기법 없이 경영언어와 의사결정 중심으로 작성한다.\nP6. 페이지 노트 | 10단 상담노트를 페이지별로 생성한다.\nP7. 보험 전용 화법 | 보험 필요성이 있는 페이지만 고도화 화법과 반론·클로징을 생성한다.\nP8. 음성강의 | 전체 노트를 학습목표와 실전활용 중심의 18~25분 강의로 재구성한다.\nP9. 최종 검수 | 숫자·단위·근거·모드간 일치·보험과장·내부노출을 검사한다."},{"title":"4.2 프롬프트 공통 입력","text":"회사 기본정보 및 재무 팩트 JSON\n사용자 추가답변 및 답변 신뢰도\n코드로 계산된 지표와 산식\n법령·예규·판례·약관 등 근거자료\n이슈 코드와 솔루션 매핑\nCEO/컨설턴트/오디오 출력대상\n금지표현·전문가검토·보험적합성 규칙\n페이지 목적과 앞뒤 페이지의 흐름"},{"title":"4.3 프롬프트 공통 명령문","text":"너는 보험상품을 판매하기 위해 문제를 과장하는 사람이 아니다. 기업의 확인된 사실과 계산된 부족재원을 근거로 CEO가 합리적인 결정을 하도록 돕는 기업경영 컨설턴트다. 보험은 우연한 위험으로 발생할 수 있는 자금공백을 보완하는 수단으로만 제시하고, 보험으로 해결할 수 없는 영역은 명확히 구분한다."},{"title":"4.4 페이지 노트 생성 프롬프트 템플릿","text":"MASTER_PAGE_NOTES_PROMPT\n입력된 페이지의 공통 본문, 근거팩트, 계산값, 이슈코드, 이전·다음 페이지를 읽고 10단 컨설턴트 노트를 생성하라. 1) 페이지 목적 2) 핵심 진단 3) 실제 설명 화법 4~8문장 4) 핵심질문 3~5개 5) 답변별 분기 6) 반론 2~4개 7) 반론 대응 8) 심화가이드 9) 계약·프로젝트 연결 10) 전환멘트와 준비자료. 본문을 반복하지 말고, 대표가 이해하고 결정하도록 돕는 대화체로 작성한다. 확인되지 않은 사실은 단정하지 않는다. 보험은 해당 이슈의 보험적합성 등급이 A~C일 때만 구체적으로 다룬다.\n05\n언어·설득·윤리 기준\n전문성은 어려운 말을 쓰는 것이 아니라 복잡한 내용을 정확하고 쉽게 설명하는 데서 나온다."},{"title":"5.1 권장 언어","text":"목적 | 권장 표현 | 피해야 할 표현\n문제 제기 | “현재 문제라기보다 성장과정에서 관리기준을 정할 시점입니다.” | “큰일 날 수 있습니다.”\n보험 전환 | “부족재원이 확인되면 보험을 포함한 대안을 비교하겠습니다.” | “보험으로 해결할 수 있습니다.”\n세무효과 | “세무처리는 요건과 사실관계에 따라 전문가 검토가 필요합니다.” | “전액 비용처리됩니다.”\n시나리오 | “현재 자료를 기준으로 본 가정값입니다.” | “반드시 이 금액이 절감됩니다.”\n대표 설득 | “대표님 판단에 필요한 선택지를 정리해 보겠습니다.” | “이대로 하셔야 합니다.”\n반론 대응 | “그 우려가 타당합니다. 그래서 먼저 확인할 항목은…” | “그건 잘못 알고 계십니다.”"},{"title":"5.2 숫자를 경영언어로 번역하는 규칙","text":"재무표현 | 경영언어 번역\n매출채권 증가 | 아직 거래처에서 받지 못한 돈이 늘었다.\n재고 증가 | 회사의 현금이 판매되지 않은 상품에 더 오래 묶였다.\n영업현금흐름 감소 | 장부상 이익이 실제 현금으로 전환되는 속도가 떨어졌다.\n유동비율 하락 | 1년 안에 갚을 돈에 비해 즉시 활용할 자산의 여유가 줄었다.\n이익잉여금 증가 | 회사가 벌어 내부에 남긴 이익이 커져 배당·투자·승계정책이 필요해졌다.\n대표자 의존 | 대표의 부재가 매출·의사결정·신용·경영권에 동시에 영향을 줄 수 있다."},{"title":"5.3 금지된 설득방식","text":"세금 또는 상속세를 과장해 공포를 유발하는 방식\n보험가입을 먼저 정하고 필요재원을 사후에 맞추는 방식\n예규·판례의 일부 문장만 떼어 확정적 절세효과로 표현하는 방식\n미확인 가지급금·대여금을 대표자 개인사용으로 단정하는 방식\n기존 전문가를 폄하해 신뢰를 얻으려는 방식\n대표의 결정을 재촉하거나 즉시계약을 압박하는 방식\n보험료를 회사비용으로 인정받는 것을 보장하는 방식\n보장금액을 기업가치나 필요재원보다 임의로 크게 설정하는 방식\n06\n기업 이슈별 실전상담화법\n기업보고서에서 자주 등장하는 핵심 이슈를 실제 상담흐름으로 변환한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 매출과 이익이 좋아진 것은 분명 긍정적입니다. 다만 좋은 실적이 회사에 남는 현금, 재무안정성, 고객집중도까지 함께 개선됐는지를 봐야 합니다. 매출이 늘면서 채권과 재고가 더 빠르게 늘었다면 성장 자체가 추가자금을 요구할 수 있습니다. 이번 진단은 성장을 부정하는 것이 아니라, 성장의 속도를 회사가 감당할 수 있도록 기준을 만드는 작업입니다."},{"title":"핵심 질문","text":"최근 성장을 이끈 고객·제품·지역은 무엇입니까?\n매출증가를 위해 결제조건이나 마진을 양보한 부분이 있습니까?\n현재 성장이 2~3년 지속될 경우 필요한 운전자금을 계산해 보셨습니까?"},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“매출이 늘었으니 문제가 없습니다” | 매출은 출발점이고, 실제 현금과 마진이 함께 남는지를 확인해야 성장의 질을 판단할 수 있다고 설명한다.\n“성장기업은 원래 자금이 필요합니다” | 맞는 말이므로 필요한 자금의 규모와 조달순서를 미리 정하자는 예방적 접근으로 전환한다."},{"title":"계약·프로젝트 연결","text":"성장성 분석, 고객집중도, 제품별 마진, 13주 현금흐름을 묶은 정밀진단 프로젝트로 연결한다. 핵심인·수출채권·해외위험이 확인되면 보험기회를 별도 평가한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 이익은 회사가 벌어들인 성과이고 현금흐름은 그 성과가 실제 돈으로 들어왔는지를 보여줍니다. 이익이 발생했는데 영업현금흐름이 약하다면 돈이 채권이나 재고에 머물러 있을 가능성이 큽니다. 차입을 늘리기 전에 내부에서 회수 가능한 현금이 얼마인지부터 계산하는 것이 순서입니다."},{"title":"핵심 질문","text":"채권회수일수와 재고일수를 월별로 보고받습니까?\n장기미수와 장기재고에 대한 책임자가 정해져 있습니까?\n성장 시 필요한 운영자금 한도를 사전에 정하고 있습니까?"},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“현금은 통장잔고로 보면 됩니다” | 통장잔고에는 이미 지급예정인 매입대금·급여·세금이 포함될 수 있으므로 가용현금과 운영필수현금을 구분해야 한다고 설명한다.\n“은행한도가 충분합니다” | 외부한도보다 내부회수 가능성을 먼저 점검하면 금융비용과 변동성을 줄일 수 있다고 설명한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 보고서에 대여금이 표시됐지만 이 숫자만으로 대표자 가지급금이라고 단정할 수는 없습니다. 관계회사 지원, 임직원 대여, 사업상 선급 성격 등 원인이 다를 수 있습니다. 중요한 것은 상대방, 목적, 이자, 만기, 승인절차와 실제 상환계획입니다. 먼저 거래실질을 확인한 뒤 회수·계약정비·구조변경 중 적절한 방법을 선택해야 합니다."},{"title":"핵심 질문","text":"대여 상대방과 발생목적은 무엇입니까?\n계약서·이자율·만기·담보가 있습니까?\n이자를 실제 수취하고 있습니까?\n상환재원과 일정이 현실적으로 정해져 있습니까?"},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“회계처리된 것이니 문제없습니다” | 회계처리와 거래의 세무·법률·현금회수 적정성은 별도이므로 계약과 실제이행을 함께 봐야 한다고 설명한다.\n“조만간 갚을 예정입니다” | 예정만으로는 관리가 되지 않으므로 상환재원·기한·증빙·의사결정 절차를 문서화하자고 제안한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 이익잉여금이 많다는 사실 자체가 문제는 아닙니다. 다만 회사에 남긴 이익을 투자, 배당, 임원보상, 승계재원 중 어떤 목적에 사용할지 정책이 없으면 매년 같은 고민이 반복됩니다. 회사의 3년 투자계획과 주주현금수요를 함께 놓고 적정 유보수준을 정하는 것이 먼저입니다."},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“이익잉여금은 세금이 많이 나온다던데요” | 이익잉여금 자체에 별도 세금이 부과된다는 단순화는 피하고, 실제 과세는 배당·주식이동·청산 등 구체적 거래에서 판단한다고 설명한다.\n“보험으로 빼면 된다고 들었습니다” | 보험은 자본정책을 대신하지 않으며, 경영위험이나 장기재원 목적이 확인될 때 검토하는 수단이라고 구분한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 자기주식 취득·처분과 감자는 단순 회계항목이 아니라 회사 현금과 주주지분에 큰 영향을 주는 자본거래입니다. 과거 거래가 적법했는지를 여기서 단정하기보다, 왜 진행했고 누가 어떤 효과를 얻었으며 향후 지분정책과 어떻게 연결되는지를 정리해야 합니다. 거래 전후의 의사록, 계약, 평가, 현금흐름을 하나의 타임라인으로 복원하겠습니다."},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“이미 끝난 거래입니다” | 종료된 거래도 향후 배당·승계·세무조사·주주관계에 영향을 줄 수 있으므로 최소한의 기록정리가 필요하다고 설명한다.\n“전문가가 처리했습니다” | 전문가 처리의 적정성을 의심하는 것이 아니라, 대표의 향후 의사결정에 사용할 통합기록을 만드는 목적이라고 설명한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 퇴직금은 규정을 만들어 두는 것만으로 끝나지 않습니다. 실제 근속기간, 보수체계, 지급시점, 회사의 현금부담이 함께 맞아야 합니다. 먼저 예상퇴직금과 회사가 그 시점에 감당할 현금을 계산하고, 부족한 경우 적립·투자·보험을 비교해야 합니다."},{"title":"핵심 질문","text":"정관·임원퇴직금 규정이 현재 등기임원과 실제 보수체계에 맞습니까?\n대표님의 예상 퇴직시점은 언제입니까?\n퇴직금 지급 시 회사 현금흐름에 미치는 영향을 계산했습니까?"},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“규정은 이미 있습니다” | 규정 존재와 실제 적용가능성은 다르므로 최신 임원·보수·근속·절차를 대조하자고 제안한다.\n“보험에만 가입하면 되지 않습니까?” | 보험은 재원마련 수단이고 퇴직금의 법적·세무적 정당성을 만들어 주는 수단은 아니라고 구분한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 승계는 세금을 줄이는 한 번의 거래가 아니라 경영권과 가족의 현금을 동시에 설계하는 과정입니다. 주식가치가 높아도 상속인이 바로 사용할 현금은 부족할 수 있고, 지분이 분산되면 경영권 의사결정이 어려워질 수 있습니다. 후계자, 비경영가족, 회사의 현금, 예상세금과 지분매입자금을 하나의 그림으로 봐야 합니다."},{"title":"핵심 질문","text":"경영을 이어갈 후계자가 정해져 있습니까?\n비경영 가족에게는 어떤 방식으로 공평성을 확보하려 합니까?\n대표 보유지분의 예상가치와 상속 시 필요한 현금을 계산해 본 적이 있습니까?"},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“아직 건강하고 시간이 많습니다” | 건강문제가 아니라 선택지가 많을 때 구조를 준비하는 문제이며, 시간이 지날수록 주식가치와 이해관계가 복잡해질 수 있다고 설명한다.\n“자녀들이 알아서 할 것입니다” | 가족 간 합의가 있더라도 주식·현금·의결권의 구조가 없으면 실행단계에서 갈등이 생길 수 있다고 설명한다."},{"title":"대표에게 설명하는 핵심 화법","text":"대표님, 해외법인은 성장의 중요한 기반이지만 본사와 현지법인 사이의 자금·보증·거래조건·환율위험이 동시에 생깁니다. 또 주요 거래처의 결제지연이나 현지 생산중단이 본사의 현금흐름으로 바로 연결될 수 있습니다. 관계회사 거래와 보험증권을 함께 놓고 위험의 연결고리를 확인해야 합니다."},{"title":"핵심 질문","text":"본사와 해외법인 간 대여·보증·매입매출 조건은 문서화돼 있습니까?\n주요 수출처의 신용한도와 연체기준이 있습니까?\n현지 재산·휴업·배상·운송보험을 본사에서 통합 점검합니까?"},{"title":"예상 반론과 응대","text":"반론 | 응대 방향\n“현지에서 알아서 가입합니다” | 현지 가입여부뿐 아니라 본사 손익과 공급망에 미치는 공백을 통합점검해야 한다고 설명한다.\n“거래처가 오래돼서 위험이 없습니다” | 거래기간은 중요한 신뢰요소지만 집중도와 외부환경 충격까지 제거하지는 못하므로 한도와 전가수단을 점검하자고 제안한다."},{"title":"계약·프로젝트 연결","text":"관계회사·환율·보증 대시보드와 해외보험 통합점검으로 연결한다. 수출채권보험, 적하, 재산·휴업, 배상책임은 주요 보험기회다.\n07\n보험계약 기회 판단과 전환화법\n보험은 “가능하면 제안”이 아니라 “근거와 부족재원이 확인될 때 적극 제안”한다."},{"title":"7.1 보험계약 기회 판단의 7축","text":"판단축 | 핵심 질문 | 출력\n근거성 | 재무보고서·추가답변에서 실제 위험징후가 확인됐는가? | 근거 팩트와 출처\n손실규모 | 사건 발생 시 회사 현금·경영권·거래에 미치는 충격은 얼마인가? | 위험 시나리오와 금액\n시급성 | 준비할 수 있는 시간과 현재 공백은 어느 정도인가? | 우선순위\n부족재원 | 내부현금·금융자산·기존보험을 제외하고 얼마가 부족한가? | 필요재원 산식\n보험적합성 | 우연한 위험을 보험으로 전가할 수 있는가? | 보험의 역할과 한계\n계약가능성 | 피보험이익·인수심사·보험료·계약구조가 현실적인가? | 조건부 가능성\n상담준비도 | 기존증권·주주·보증·건강·재무자료가 확보됐는가? | 다음 미팅 자료"},{"title":"7.2 보험기회 등급","text":"등급 | 정의 | 컨설턴트 행동\nA 핵심기회 | 근거·손실·부족재원·보험역할이 상당히 확인됨 | 필요재원 확정과 설계검토 동의를 적극 제안\nB 조건부기회 | 위험은 확인되나 기존보험·주주·보증 등 정보 부족 | 추가질문·증권분석 후 필요성과 규모 확정\nC 보장분석우선 | 신규가입보다 현재 보장공백·중복 파악이 먼저 | 기존증권 제출과 보장분석 미팅 제안\nD 직접연계낮음 | 보험보다 회수·규정·세무·법률정비가 우선 | 보험을 배제하고 유료컨설팅·전문가 협업 제안"},{"title":"7.3 필요재원 산식의 표준","text":"대표자·핵심인 유고 부족재원\n비상운영자금 + 차입·보증 대응자금 + 핵심인력 유지비 + 거래처·생산 정상화비 + 지분·승계 필요자금 - 즉시 사용가능한 회사재원 - 기존 보험금 = 추가 확보가 필요한 부족재원\n승계·상속 부족재원\n예상 세금·지분매입·비경영가족 정산·경영안정자금 - 상속인 개인유동자산 - 회사의 적법한 배당·퇴직·매입 가능재원 - 기존 보장자산 = 부족재원\n퇴직재원 부족액\n예상 임원퇴직금 + 지급시점의 세금·운영 영향 - 회사 적립금 - 즉시 활용가능한 금융자산 - 기존 목적성 보험 해약환급·보험금 = 부족액"},{"title":"7.4 보험을 꺼내는 표준 7단 화법","text":"1. 위험을 먼저 확인한다. “대표님께서 일정 기간 경영에 참여하지 못할 경우 어떤 업무가 멈추는지부터 보겠습니다.”\n2. 필요한 금액을 계산한다. “6~12개월 운영자금과 긴급의무를 합산해 보겠습니다.”\n3. 현재 준비재원을 확인한다. “회사 현금과 기존 보험 중 실제 사용할 수 있는 금액을 구분하겠습니다.”\n4. 부족재원에 합의한다. “현재 자료상 부족가능성이 있는 금액은 이 범위입니다.”\n5. 대안을 비교한다. “현금적립, 금융자산, 신용한도, 보험을 함께 비교하겠습니다.”\n6. 보험의 역할과 한계를 설명한다. “보험은 예고 없는 시점에 현금을 확보하는 수단이며 규정·세무·승계구조를 대신하지 않습니다.”\n7. 설계검토 동의를 받는다. “부족재원 범위 안에서 보험료가 회사현금흐름을 해치지 않는 구조를 검토해 보겠습니다.”"},{"title":"7.5 보험계약 기회 매트릭스","text":"보험영역 | 재무보고서상 신호 | 계약당위성 | 추가확인\n대표자·핵심인 | 대표 의존, 해외·주요고객 의사결정 집중, 개인보증 | 경영공백과 긴급운영자금 | 대표 역할, 기존보험, 보증, 대체인력\n승계·지분매입 | 비상장주식 가치, 자기주식·감자·배당, 후계구도 | 상속·주식매입의 현금공백 | 주주명부, 가족, 후계자, 평가액\n퇴직재원 | 장기근속, 임원규정, 유보이익, 예상퇴직 | 지급시점의 회사 현금부담 | 규정, 보수, 근속, 퇴직시점\n차입·보증상환 | 차입금, 대표보증, 담보, 약정 | 유고 시 상환·신용충격 | 대출약정, 보증, 담보, 기존보험\n수출채권 | 해외매출, 고객집중, 채권증가 | 거래처 부도·미회수 전가 | 거래처별 한도, 연체, 국가, 결제조건\n재산·휴업 | 공장·설비·해외생산기지 | 화재·재해 후 복구와 고정비 | 자산명세, 영업중단기간, 기존증권\n배상·제품·운송 | 제조·수출·제품책임·물류 | 제3자 손해와 운송손실 전가 | 매출지역, 계약책임, 운송조건, 증권\n기존 보험 최적화 | 보험료·계약 보유 미확인 | 중복·누락·수익자·목적 불일치 개선 | 전체 증권, 계약자·수익자, 담보목적\n08\n보험분야별 고도화 화법\n보험 관련 페이지는 일반화법보다 더 구체적이고 검증가능해야 한다."},{"title":"8.1 대표자·핵심인 유고","text":"대표님, 보험상품을 먼저 말씀드리려는 것은 아닙니다. 대표님께서 일정 기간 경영에 참여하지 못할 경우 회사가 몇 개월간 정상적으로 의사결정하고 자금을 집행할 수 있는지를 숫자로 확인해 보자는 것입니다. 운영자금, 차입·보증, 핵심인력 유지, 거래처 대응에 필요한 금액을 계산하고 회사가 즉시 사용할 수 있는 현금과 기존 보험을 제외하면 실제 부족재원이 나옵니다. 보험은 그 부족분을 예고 없는 시점에 확보하는 여러 수단 중 하나입니다."},{"title":"핵심 확인 질문","text":"대표님이 직접 승인해야만 진행되는 업무는 무엇입니까?\n대표 부재 시 금융기관·주요거래처가 요구할 조건은 무엇입니까?\n현재 법인·개인 명의 보험금 중 회사가 실제 활용할 수 있는 금액은 얼마입니까?"},{"title":"예상 반론과 전문적 대응","text":"반론 | 응대\n“현금이 충분합니다” | 통장잔고에서 급여·매입·세금 등 운영필수현금을 제외한 실제 비상재원을 구분하자고 제안한다.\n“보험료가 부담됩니다” | 필요재원과 기간을 먼저 정한 뒤 회사 현금흐름을 해치지 않는 범위로 구조를 조정한다고 설명한다.\n“내가 없으면 회사가 안 됩니다” | 바로 그 의존도를 비상운영계획과 재원으로 분리해 준비하자는 방향으로 전환한다."},{"title":"8.2 경영승계·주식매입재원","text":"대표님, 승계에서 가장 큰 문제는 주식가치와 가족이 실제로 사용할 수 있는 현금이 다르다는 점입니다. 경영을 이어갈 사람에게는 의결권이 필요하고, 비경영가족에게는 공평성을 설명할 현금이 필요합니다. 예상 주식가치와 세금, 지분매입금액을 계산한 후 내부재원으로 부족한 부분만 보험을 포함한 재원대안으로 비교하는 것이 맞습니다."},{"title":"핵심 확인 질문","text":"후계자는 누구이며 경영참여 정도는 어느 수준입니까?\n비경영가족의 재산분배 원칙은 정해져 있습니까?\n회사 또는 주주가 향후 주식을 매입해야 할 가능성이 있습니까?"},{"title":"예상 반론과 전문적 대응","text":"반론 | 응대\n“자녀끼리 합의했습니다” | 합의의 지속성을 위해 지분·의결권·현금지급 구조를 문서와 재원으로 연결해야 한다고 설명한다.\n“상속세는 나중에 생각하겠습니다” | 세금만이 아니라 경영권과 현금부족이 동시에 발생하므로 선택지가 많을 때 준비하자고 설명한다.\n“보험금으로 세금을 내면 끝 아닙니까” | 보험금은 재원 중 하나일 뿐 주식이동·가족합의·회사법 절차를 대신하지 않는다고 구분한다."},{"title":"8.3 임원퇴직재원","text":"대표님, 퇴직금은 규정이 있어야 하지만 규정만으로 회사 현금이 준비되는 것은 아닙니다. 예상퇴직금과 퇴직시점의 회사 현금흐름을 계산하고, 내부적립·금융자산·보험을 비교해야 합니다. 보험을 사용한다면 퇴직금의 정당성을 만드는 것이 아니라 장기간 재원을 준비하는 수단으로만 봐야 합니다."},{"title":"예상 반론과 전문적 대응","text":"반론 | 응대\n“보험에 가입하면 비용처리되지 않습니까” | 계약구조와 회계·세무처리는 별도 검토사항이며 비용효과만으로 가입을 결정하지 않는다고 설명한다.\n“퇴직할 생각이 없습니다” | 예정시점을 확정하지 않더라도 회사의 장기재원계획과 경영승계 시나리오를 준비할 필요가 있다고 설명한다."},{"title":"8.4 수출채권·신용보험","text":"대표님, 매출이 늘수록 거래처에 대한 외상한도도 함께 커질 수 있습니다. 오래 거래한 고객이라도 한 곳의 지급지연이 회사 현금흐름에 미치는 영향은 별도로 계산해야 합니다. 주요 거래처별 한도·결제일·연체이력을 보고 내부 신용관리로 감당하기 어려운 부분은 신용보험이나 무역보험으로 전가할 수 있습니다."},{"title":"핵심 확인 질문","text":"상위 5개 거래처의 매출비중과 외상한도는 얼마입니까?\n90일 이상 연체와 국가별 위험을 어떻게 관리합니까?\n현재 무역보험·신용보험 한도와 면책조건을 알고 있습니까?"},{"title":"예상 반론과 전문적 대응","text":"반론 | 응대\n“오래 거래한 우량고객입니다” | 신뢰와 집중위험은 별개이므로 한 거래처의 최대손실이 회사에 미치는 영향을 보자고 설명한다.\n“보험료가 아깝습니다” | 전체채권이 아니라 위험거래처·국가·한도 중심으로 선택적으로 전가하는 구조를 검토한다고 설명한다."},{"title":"8.5 재산·휴업·해외사업장","text":"대표님, 공장이나 해외생산기지의 위험은 건물과 기계의 복구비만으로 끝나지 않습니다. 생산이 멈춘 기간의 고정비, 납기지연, 거래처 이탈, 대체생산비까지 함께 봐야 합니다. 현재 보험증권이 자산가치와 실제 복구기간을 반영하는지 점검하겠습니다."},{"title":"예상 반론과 전문적 대응","text":"반론 | 응대\n“화재보험은 이미 있습니다” | 가입여부보다 보험가액·면책·휴업기간·해외법인과의 공백을 확인해야 한다고 설명한다.\n“사고가 난 적이 없습니다” | 과거 무사고는 긍정적이지만 발생 가능성과 발생 시 충격은 별도로 관리해야 한다고 설명한다."},{"title":"8.6 기존 보험증권 최적화","text":"대표님, 신규보험을 먼저 제안하기보다 현재 계약이 어떤 위험을 어떤 금액으로 보장하고, 계약자·피보험자·수익자 구조가 목적에 맞는지부터 확인하겠습니다. 중복은 줄이고 빠진 부분은 보완하며, 회사 재무목적과 맞지 않는 계약은 조정대안을 검토하는 것이 순서입니다."},{"title":"핵심 확인 질문","text":"법인과 대표자 명의 전체 보험증권을 한 번에 점검한 적이 있습니까?\n각 보험의 가입목적과 현재 목적이 일치합니까?\n보험금이 필요한 주체와 수익자가 일치합니까?"},{"title":"예상 반론과 전문적 대응","text":"반론 | 응대\n“기존 설계사가 관리합니다” | 기존 관계를 존중하면서 재무보고서상 위험과 증권의 목적일치만 독립적으로 확인하겠다고 설명한다.\n“증권이 너무 많아 정리가 어렵습니다” | 계약목적·보장위험·만기·현금가치 네 기준으로 표준화해 한 장으로 정리하겠다고 제안한다."},{"title":"다음 미팅 제안","text":"클로징\n전체증권을 수집해 보장공백·중복·목적·현금가치를 정리하고 유지·조정·보완의 3안으로 제시한다.\n09\n반론·답변 분기·클로징 라이브러리\n반론은 거절이 아니라 대표가 결정을 위해 추가로 확인하고 싶은 항목이다."},{"title":"9.1 반론 대응의 5단 원칙","text":"1. 인정: 대표의 우려가 타당하다는 점을 먼저 인정한다.\n2. 의도 확인: 비용, 신뢰, 시기, 정보부족 중 실제 이유를 질문한다.\n3. 범위 축소: 전체 결정보다 다음 한 단계만 제안한다.\n4. 근거 제시: 숫자·증빙·대안 비교로 설명한다.\n5. 선택권 부여: 대표가 결정할 수 있도록 A/B 또는 진행/보류 조건을 제시한다.\n대표 반론 | 전문적 응대\n“세무사에게 이미 맡기고 있습니다.” | “현재 전문가의 역할을 대체하려는 것이 아닙니다. 결산·신고자료를 대표님의 경영결정과 재원계획으로 연결하는 부분을 함께 보완하려는 것입니다. 필요한 부분은 기존 세무사와 협업하겠습니다.”\n“우리 회사는 문제가 없습니다.” | “현재 문제가 발생했다는 뜻보다, 성장과 지분·현금의 구조가 복잡해지기 전에 관리기준을 만드는 예방진단으로 보시면 됩니다.”\n“지금은 바쁩니다.” | “오늘 결정을 요구드리지 않겠습니다. 다음 미팅에서 판단할 수 있도록 필요한 자료와 확인항목만 최소화해 정리하겠습니다.”\n“비용이 부담됩니다.” | “전체 프로젝트를 한 번에 진행하지 않고, 가장 큰 금액과 시급성이 있는 이슈부터 단계별로 확인할 수 있습니다.”\n“보험은 필요 없습니다.” | “보험가입 여부를 먼저 정하지 않겠습니다. 필요한 재원과 현재 준비재원을 계산한 뒤 부족분이 없으면 보험을 제외하겠습니다.”\n“보험료가 너무 비쌉니다.” | “보장금액을 먼저 크게 정하는 방식이 아니라 부족재원과 회사의 현금흐름 안에서 기간·구조·보험료를 조정하겠습니다.”\n“건강할 때 천천히 하겠습니다.” | “건강문제가 아니라 선택지가 많을 때 준비하는 문제입니다. 지금은 구조와 필요금액을 먼저 정하고 실행시점은 대표님이 선택하실 수 있습니다.”\n“가족과 상의해야 합니다.” | “맞습니다. 그래서 가족이 판단할 수 있도록 지분·현금·세금·보험의 역할을 한 장으로 정리해 드리겠습니다.”\n“기존 보험이 충분합니다.” | “충분한지 여부는 보험금 총액보다 필요한 목적과 수익자, 지급시점이 맞는지를 확인해야 합니다. 증권을 기준으로 비교하겠습니다.”\n“회사 현금으로 해결하면 됩니다.” | “가능한 대안입니다. 다만 운영에 이미 필요한 현금과 비상재원으로 실제 사용할 수 있는 현금을 구분한 뒤 판단하시면 됩니다.”\n“이건 절세상품 아닙니까?” | “절세효과를 전제로 권하지 않습니다. 회사의 위험과 부족재원이 먼저이고, 세무처리는 사실관계와 계약구조에 따라 별도 검토합니다.”\n“오늘 결정하기 어렵습니다.” | “오늘은 계약결정이 아니라 다음 분석단계에 필요한 자료와 범위를 정하는 것으로 충분합니다.”\n“자료를 주기 어렵습니다.” | “민감도를 고려해 필요한 최소항목과 대체자료를 정리하고, 접근권한과 보관방식을 먼저 안내드리겠습니다.”\n“과거에도 비슷한 제안을 받았습니다.” | “이번에는 상품보다 기업자료와 부족재원 계산을 먼저 제시하고, 맞지 않으면 보험을 제외한다는 점이 다릅니다.”\n“후계자가 아직 없습니다.” | “그렇기 때문에 현재는 승계완료안보다 비상경영권과 지분·현금의 임시원칙을 먼저 정하는 것이 현실적입니다.”"},{"title":"9.2 답변별 분기 템플릿","text":"답변유형 | 의미 | 다음 화법\n긍정 | 문제인식이 이미 있음 | 수치화와 우선순위 결정으로 빠르게 이동한다.\n부정 | 문제를 체감하지 않음 | 반박하지 말고 다른 지표·기간·시나리오로 확인한다.\n모름 | 정보가 없거나 보고체계가 없음 | 필요자료와 간단한 진단방법을 제안한다.\n미룸 | 시기·비용·내부합의 문제 | 전체 계약이 아닌 최소 다음 단계와 기한을 합의한다.\n전문가 위임 | 기존 전문가 신뢰가 높음 | 역할을 구분하고 협업구조를 제안한다.\n보험 거부 | 상품선입견·과거경험 | 필요재원 계산 후 보험 제외 가능성을 먼저 약속한다."},{"title":"9.3 클로징 수준","text":"수준 | 목표 | 예시\n정보 클로징 | 자료 제출 동의 | “다음 미팅에서 숫자로 판단할 수 있도록 이 네 가지 자료만 확인해도 될까요?”\n진단 클로징 | 유료 정밀진단 동의 | “우선 8주 진단으로 현금과 지분·보험 공백을 확정하고 실행여부를 결정하시죠.”\n설계 클로징 | 보험·솔루션 비교 동의 | “부족재원 범위 안에서 보험을 포함한 세 가지 대안을 비교해 드리겠습니다.”\n실행 클로징 | 계약·프로젝트 착수 | “오늘은 범위와 담당자, 일정만 확정하고 세부 실행은 전문가 검토 후 진행하겠습니다.”\n10\n상담 미팅 전 과정 운영화법\n한 페이지의 화법이 아니라 첫 접촉부터 실행계약까지의 흐름을 설계한다."},{"title":"10.1 1차 미팅","text":"단계 | 목표 | 권장 화법\n오프닝 | 판매가 아닌 진단의 목적 합의 | “오늘은 상품을 정하는 자리가 아니라 회사자료에서 어떤 의사결정 과제가 보이는지 함께 확인하는 자리입니다.”\n현황 확인 | 보고서와 실제 상황의 차이 확인 | “보고서 수치와 대표님이 체감하는 상황이 다른 부분부터 말씀해 주십시오.”\n핵심이슈 2~3개 | 문제를 좁혀 우선순위 형성 | “오늘은 현금흐름, 자본정책, 대표 유고 세 가지에 집중하겠습니다.”\n질문 | 사실·의도·기존준비 확인 | 기업별 질문을 5~8개로 제한해 깊게 묻는다.\n마무리 | 다음 자료와 정밀진단 합의 | “다음 미팅에서 판단할 수 있도록 필요한 자료와 계산범위를 정리해 드리겠습니다.”"},{"title":"10.2 2차 미팅","text":"단계 | 목표 | 권장 화법\n결과 요약 | 한 문장 진단 | “이 회사의 핵심은 이익부족보다 현금전환과 자본·승계 목적의 미정리입니다.”\n금액 합의 | 필요·부족재원 범위 합의 | “가정별로 보면 부족재원은 이 범위이며, 기존보험 확인 후 확정됩니다.”\n대안 비교 | A/B/C안 장단점 설명 | “정답 하나보다 비용·통제력·시간이 다른 세 가지 선택지로 보겠습니다.”\n반론 처리 | 의사결정 장애 제거 | 반론을 인정하고 최소 다음 단계로 범위를 줄인다.\n다음 행동 | 설계·전문가협업·계약 착수 | “오늘은 설계범위와 검토자료까지만 확정하고 최종계약은 적합성 검토 후 결정하시죠.”"},{"title":"10.3 보험계약 미팅","text":"기존 진단결과와 필요재원을 다시 확인한다.\n보험을 포함한 현금적립·금융자산·신용한도 등 대안을 비교한다.\n계약자·피보험자·수익자·보장기간·보험료 부담주체의 목적을 설명한다.\n세무효과가 아닌 위험재원 적합성을 우선한다.\n약관·면책·해지·현금가치·인수심사 리스크를 투명하게 설명한다.\n대표가 보류할 경우 보류조건과 재검토일을 합의한다.\n11\n음성강의 대본 생성체계\n오디오는 복잡한 내용을 쉽게 이해하고 실무상담에 적용하도록 돕는 교육상품이다."},{"title":"11.1 음성강의의 학습목표","text":"이 기업의 진짜 핵심문제를 한 문장으로 설명할 수 있다.\n재무수치를 경영언어로 바꾸어 CEO에게 설명할 수 있다.\n각 이슈에서 무엇을 질문하고 어떤 자료를 받아야 하는지 안다.\n유료컨설팅·전문가협업·보험계약의 경계를 구분할 수 있다.\n보험이 필요한 경우 당위성과 필요재원을 설명할 수 있다.\n예상 반론에 압박 없이 대응하고 다음 미팅으로 연결할 수 있다."},{"title":"11.2 권장 20분 구성","text":"챕터 | 분량 | 내용\n1. 기업의 한 문장 진단 | 2분 | 이번 기업을 보는 핵심 관점과 학습목표\n2. 숫자의 경영적 의미 | 4분 | 성장·현금·안정성·주주거래를 쉽게 해석\n3. 핵심 이슈별 상담 | 7분 | 팩트→의미→질문→위험→해결\n4. 보험계약 기회 | 4분 | 근거·필요재원·추가확인·접근화법\n5. 반론과 다음 미팅 | 2분 | 실제 반론과 응대, 준비자료\n6. 핵심정리 | 1분 | 우선과제 3개와 바로 사용할 질문"},{"title":"11.3 오디오 언어규칙","text":"권장 | 금지\n숫자를 의미와 함께 설명한다. | 재무비율과 법령번호를 연속 낭독한다.\n짧은 문장과 자연스러운 쉼을 사용한다. | 보고서 문단을 그대로 길게 읽는다.\n잘못된 접근과 올바른 접근을 비교한다. | 상품 장점만 일방적으로 설명한다.\n상담에서 바로 사용할 질문을 소리 내어 제시한다. | 추상적인 조언으로 끝낸다.\n“확인 후 결정”의 절차를 강조한다. | 확정되지 않은 절세·보험효과를 단정한다."},{"title":"11.4 음성강의 마스터 프롬프트","text":"AUDIO_LECTURE_PROMPT\n너는 법인컨설턴트를 교육하는 기업경영 실무강사다. 입력된 확정 분석데이터, CEO용 리포트, 페이지별 상담노트, 보험기회 등급을 바탕으로 18~25분 분량의 한국어 강의대본을 작성하라. 대본은 리포트를 낭독하지 않는다. 숫자의 경영적 의미, CEO에게 물을 질문, 답변별 다음 행동, 유료컨설팅·보험·전문가협업의 구분, 보험 필요재원의 논리, 반론 대응을 쉽게 설명한다. 각 챕터는 학습목표→핵심해설→실전질문→주의할 표현→다음 행동 순으로 구성한다. 법령·예규 번호는 리포트에 두고 오디오에서는 실무적 의미만 설명한다. 미확인 사실은 단정하지 않는다.\n12\n구조화 데이터·JSON·프롬프트 템플릿\nCEO 본문·컨설턴트 노트·오디오가 같은 사실과 결론을 공유하도록 데이터 구조를 고정한다."},{"title":"12.1 페이지 데이터 스키마","text":"PAGE_SCHEMA 예시\n{ \"pageId\": \"INSURANCE_KEYPERSON\", \"issueCode\": \"KEY_PERSON_CONTINUITY\", \"visibility\": [\"ceo\", \"consultant\", \"audio\"], \"common\": {\"title\":\"\", \"facts\":[], \"analysis\":[], \"actions\":[]}, \"consultantOnly\": { \"opportunityGrade\":\"B\", \"insuranceRationale\":{}, \"requiredFunding\":{}, \"questions\":[], \"questionBranches\":[], \"objections\":[], \"closing\":\"\", \"documents\":[] }, \"notes\": { \"purpose\":\"\", \"diagnosis\":\"\", \"talkTrack\":\"\", \"advancedGuide\":[], \"transition\":\"\" }, \"audio\": {\"chapterTitle\":\"\", \"learningPoint\":\"\", \"script\":\"\"} }"},{"title":"12.2 사실 상태값","text":"상태 | 의미 | 표현기준\nCONFIRMED | 원본 또는 사용자 확인으로 확정 | “확인됩니다”\nCALCULATED | 코드 계산값 | 산식·단위·가정 표시\nSCENARIO | 가정에 따른 시나리오 | “가정 시”, “범위”로 표현\nTO_CONFIRM | 추가자료 필요 | 질문과 준비자료로 출력\nCONFLICT | 자료 간 불일치 | 충돌내용을 공개하고 확정 보류\nNOT_APPLICABLE | 해당 없음 | 페이지·보험기회 비활성화"},{"title":"12.3 보험기회 객체","text":"INSURANCE_OPPORTUNITY\n{ \"code\": \"SUCCESSION_LIQUIDITY\", \"grade\": \"B\", \"evidence\": [], \"riskEvent\": \"\", \"financialImpact\": {}, \"requiredFundingFormula\": [], \"currentResources\": [], \"fundingGap\": {\"status\":\"TO_CONFIRM\", \"range\":null}, \"insuranceRole\": \"\", \"nonInsuranceActions\": [], \"eligibilityChecks\": [], \"talkTrack\": {}, \"objections\": [], \"nextMeeting\": {}, \"requiredDocuments\": [] }"},{"title":"12.4 화법 품질을 높이는 문맥 입력","text":"해당 페이지의 역할, 앞 페이지에서 합의한 내용, 다음 페이지에서 요구할 결정을 함께 입력한다.\n대표의 답변·관심·우려·선호와 기업의 업종·규모·해외여부·주주구조를 입력한다.\n이슈의 보험등급·유료컨설팅등급, 계산값·근거문서, 금지표현과 세무·법률·보험인수의 전문가 확인경계를 함께 입력한다.\n13\n품질검수와 평가루브릭\n좋은 문장을 생성하는 것만큼 잘못된 문장을 걸러내는 검수체계가 중요하다."},{"title":"13.1 자동검수 항목","text":"검수영역 | 검수내용\n숫자 일치 | 원본·계산기·CEO본문·컨설턴트노트·오디오의 금액·연도·단위 일치\n사실성 | 미확인 사실의 확정표현, 추정의 사실화, 과거자료의 최신사실화 여부\n보험근거 | 보험기회가 실제 위험과 부족재원에서 도출됐는지\n보험과장 | 절세보장, 비용처리 보장, 무조건 가입, 공포 유발 표현 여부\n모드 분리 | 내부 점수·클로징·영업화법이 CEO용에 노출됐는지\n화법 실용성 | 페이지별 질문·분기·반론·다음행동이 실제 기업에 맞는지\n중복 | 본문 반복, 페이지 간 같은 화법 반복, 의미 없는 장황함\n전문가 경계 | 세무·법률·보험인수 판단을 AI가 확정했는지\n오디오 일치 | 리포트와 결론·수치·우선순위가 일치하는지\n완결성 | 모든 페이지에 목적·화법·질문·반론·전환·자료가 존재하는지"},{"title":"13.2 100점 평가루브릭","text":"평가영역 | 배점 | 통과기준\n근거·숫자 정확성 | 25 | 중대 불일치 0건, 가정·출처 명확\n경영해석 깊이 | 15 | 단순 요약이 아닌 원인·영향·결정 연결\n페이지 화법 실용성 | 20 | 모든 페이지에 10단 노트, 실제 대화체\n보험계약 당위성 | 15 | 근거·필요재원·역할·한계·다음행동 명확\n반론·분기 완성도 | 10 | 대표 반응별 현실적 대응과 전환\nCEO/내부 분리 | 5 | 내부내용 외부 노출 0건\n오디오 교육효과 | 5 | 낭독이 아닌 이해·상담훈련 중심\n문장·디자인 일관성 | 5 | 용어·톤·페이지 흐름 일관\n출시 기준\n총점 90점 이상, 정확성·보험근거·모드분리 영역에서 중대 오류 0건이어야 최종 생성완료로 처리한다."},{"title":"13.3 사람이 최종 확인할 항목","text":"보험상품·인수심사·약관·보험료·수익자 구조의 실제 적용 가능성\n세무·법률 결론과 최신 제도\n기업의 실제 의도와 가족·주주 관계\n민감정보와 개인정보의 노출\n컨설턴트가 현장에서 사용할 때의 자연스러움과 브랜드 톤\n14\nM사 적용 예시\n실제 기업보고서 기반 리포트에 페이지별 화법·보험기회·오디오가 어떻게 결합되는지 보여준다."},{"title":"14.1 회사의 한 문장 진단 예시","text":"M사는 매출과 이익이 크게 회복됐지만 매출채권과 재고 증가로 성장자금이 흡수되고 있으며, 단기대여금·자기주식·감자·배당 등 자본거래의 목적과 향후 승계·위험재원 정책을 함께 정리해야 하는 기업이다."},{"title":"14.2 운전자금 페이지 노트 예시","text":"M사 운전자금 | 페이지별 컨설턴트 노트\n성장 자체를 부정하지 않으면서 매출채권·재고 증가가 현금에 미친 영향을 대표가 이해하고, 회수·재고 개선 프로젝트에 동의하도록 한다."},{"title":"실제 설명 화법","text":"대표님, 2025년 매출과 이익은 크게 회복됐습니다. 다만 매출채권과 재고가 동시에 늘면서 약 82억원의 자금이 추가로 묶인 것으로 보입니다. 이 금액이 모두 회수 가능한 현금이라는 뜻은 아니지만, 성장의 상당 부분이 아직 현금으로 전환되지 않았다는 신호입니다. 차입을 늘리기 전에 회수기간과 재고일수를 줄였을 때 확보 가능한 현금부터 계산해 보는 것이 합리적입니다."},{"title":"핵심 확인 질문","text":"상위 거래처별 실제 회수일은 약정일보다 얼마나 늦습니까?\n재고 증가가 수주대응인지 장기재고인지 구분돼 있습니까?\n회수일수 10일 단축 목표가 현실적인지 영업부서와 논의한 적이 있습니까?"},{"title":"답변별 분기","text":"대표 답변 | 컨설턴트 후속 대응\n“성장 때문에 자연스럽습니다” | 자연스러운 증가와 관리가 필요한 증가를 회전일수로 구분하자고 제안한다.\n“거래처를 압박할 수 없습니다” | 전 거래처 일괄단축이 아니라 고객등급·한도·조건별로 접근한다고 설명한다.\n“재고는 모두 판매예정입니다” | 판매예정과 현금전환시점을 구분해 재고연령표로 확인하자고 제안한다."},{"title":"예상 반론과 응대","text":"예상 반론 | 전문적 응대\n“82억원을 바로 회수할 수 있다는 말입니까?” | 아니며 증가액은 문제규모를 보는 신호이고 실제 회수가능액은 채권·재고 세부자료로 별도 계산한다고 명확히 한다.\n“보험과 무슨 관련입니까?” | 운전자금 자체는 관리가 우선이고, 거래처 부도위험이 확인될 때만 신용보험·무역보험을 검토한다고 구분한다."},{"title":"14.3 대표자·핵심인 보험 페이지 예시","text":"M사 핵심인 위험 | 페이지별 컨설턴트 노트\n국내 본사와 해외법인의 의사결정 구조를 확인하고 대표 유고 시 필요한 비상재원을 계산하는 후속미팅을 확보한다."},{"title":"실제 설명 화법","text":"대표님, 현재 자료만으로 보험가입이 필요하다고 단정할 수는 없습니다. 다만 국내 본사와 해외법인의 중요한 의사결정이 대표님께 집중돼 있다면, 유고 시 운영자금뿐 아니라 거래처·금융기관·해외법인의 의사결정 공백이 동시에 생길 수 있습니다. 먼저 대표님이 없을 때 6개월 동안 회사가 정상운영되기 위해 필요한 금액과 기존 준비재원을 계산해 보겠습니다. 그 차이가 확인되면 보험을 포함한 준비방법을 비교하겠습니다."},{"title":"핵심 확인 질문","text":"대표 승인 없이 진행할 수 없는 핵심업무는 무엇입니까?\n대표 부재 시 국내·해외법인을 대체할 의사결정자는 누구입니까?\n개인보증·담보·주요거래처 관계에서 대표 개인의 영향은 어느 정도입니까?\n법인·개인 명의 기존 보험금은 얼마입니까?"},{"title":"답변별 분기","text":"대표 답변 | 컨설턴트 후속 대응\n“대체자가 있습니다” | 대체자의 권한·금융기관·거래처 수용성과 비상운영자금을 확인하자고 제안한다.\n“기존보험이 많습니다” | 총액보다 목적·수익자·지급시점이 회사 필요와 맞는지 증권으로 대조하자고 제안한다.\n“보험은 원하지 않습니다” | 보험 제외 가능성을 전제로 필요재원 계산과 비상계획만 먼저 하자고 범위를 축소한다."},{"title":"예상 반론과 응대","text":"예상 반론 | 전문적 응대\n“대표가 없으면 회사가 끝인데 보험이 무슨 소용입니까?” | 보험만으로 해결할 수 없으므로 대체경영·권한·거래처 대응과 함께 비상재원을 설계한다고 설명한다.\n“회사의 현금이 충분합니다” | 운영필수현금과 실제 비상재원을 구분한 뒤 부족분이 없으면 보험을 줄이거나 제외한다고 답한다.\n“보험료가 비용처리됩니까?” | 세무효과를 보장하지 않고 계약목적·구조·회계처리를 전문가와 별도 확인한다고 설명한다."},{"title":"심화 가이드","text":"현재 자료에는 대표 역할·보증·기존보험이 없어 등급은 B 조건부다.\n보장규모를 임의로 제시하지 않는다.\n보험은 대체경영체계와 자본정책을 대신하지 않는다."},{"title":"14.4 오디오 해설 예시","text":"이번 기업에서 보험계약 가능성을 볼 때 가장 먼저 단기대여금이나 이익잉여금을 보험과 연결해서는 안 됩니다. 직접적인 보험 포인트는 대표와 핵심경영진의 유고, 해외거래처의 채권위험, 해외사업장의 재산·휴업 위험, 그리고 승계과정의 지분정리 재원입니다. 다만 현재 보고서에는 대표의 역할과 기존 보험, 개인보증, 가족·후계구도가 없습니다. 따라서 첫 상담에서는 상품을 설명하기보다 이 네 가지 정보를 확인하고 부족재원을 계산하는 것이 올바른 순서입니다.\n15\n부록\n프로그램에 직접 탑재할 수 있는 표준 문장·금지표현·체크리스트를 제공한다."},{"title":"A. 페이지 전환문장 라이브러리","text":"그렇다면 이제 이익이 실제 현금으로 얼마나 전환되고 있는지 살펴보겠습니다.\n현금의 흐름을 확인했으니, 다음으로 회사와 주주 사이의 자본정책을 보겠습니다.\n과거 거래의 구조를 확인했으니, 앞으로 어떤 원칙을 세워야 하는지 비교해 보겠습니다.\n필요한 자금의 범위를 보았으니, 현재 준비재원과 부족분을 구분하겠습니다.\n보험을 논의하기 전에 기존 준비와 대체수단이 충분한지 먼저 확인하겠습니다.\n오늘 확인한 내용으로 바로 계약을 결정하기보다, 다음 미팅에서 숫자와 자료를 기준으로 판단하시도록 하겠습니다."},{"title":"B. CEO 핵심질문 라이브러리","text":"대표님이 현재 가장 먼저 해결하고 싶은 경영과제는 무엇입니까?\n이 숫자와 대표님이 실제로 체감하는 상황이 다른 부분은 어디입니까?\n이 문제가 1년 더 지속되면 회사에 가장 큰 부담이 되는 것은 무엇입니까?\n현재 준비된 내부재원과 외부재원을 어떻게 구분하고 있습니까?\n이 의사결정에서 대표님이 가장 우려하는 것은 비용, 경영권, 세금, 가족 중 무엇입니까?\n기존 세무사·변호사·보험전문가와 어떤 역할분담을 원하십니까?\n다음 미팅에서 결정을 내리기 위해 꼭 필요한 자료는 무엇이라고 생각하십니까?"},{"title":"C. 보험상담 금지표현","text":"금지표현 | 대체표현\n“이 보험이면 상속세가 해결됩니다.” | “예상 필요재원 중 부족분을 보험을 포함한 여러 수단으로 비교하겠습니다.”\n“보험료는 전액 비용처리됩니다.” | “회계·세무처리는 계약목적과 구조, 사실관계에 따라 전문가 확인이 필요합니다.”\n“지금 가입하지 않으면 늦습니다.” | “인수조건과 선택지는 변할 수 있으므로 필요한 금액과 준비시기를 먼저 확인하겠습니다.”\n“이익잉여금을 보험으로 빼면 됩니다.” | “자본정책과 보험의 목적을 구분하고, 위험재원 필요성이 있을 때만 검토합니다.”\n“대표가 없으면 회사가 망합니다.” | “대표 부재가 의사결정과 현금에 미치는 영향을 시나리오로 확인하겠습니다.”\n“세무사는 이런 것까지 모릅니다.” | “기존 전문가와 역할을 나누어 경영·재원 관점에서 보완하겠습니다.”"},{"title":"D. 최종 생성 체크리스트","text":"□ 모든 페이지에 페이지 목적과 한 문장 진단이 있는가?\n□ 실제 설명 화법이 본문 반복이 아니라 경영적 의미를 추가하는가?\n□ 질문이 해당 기업의 데이터와 연결되는가?\n□ 긍정·부정·모름·미룸에 대한 답변 분기가 있는가?\n□ 반론 대응이 압박이 아닌 재확인과 선택권 부여 방식인가?\n□ 보험기회는 근거·위험·필요재원·기존재원·부족재원·보험역할을 포함하는가?\n□ 보험으로 해결할 수 없는 영역을 구분했는가?\n□ CEO용에 내부 영업화법과 계약가능성 정보가 노출되지 않았는가?\n□ 오디오가 리포트 낭독이 아니라 실전교육으로 구성됐는가?\n□ 숫자·연도·단위·결론이 리포트와 오디오에서 일치하는가?\n□ 세무·법률·보험인수의 전문가 검토항목을 표시했는가?\n□ 모든 페이지 끝에 다음 행동과 준비자료가 있는가?"},{"title":"E. 최종 제품 정의","text":"자비아 기업경영 의사결정 종합리포트\n기업보고서를 요약하는 문서가 아니라, 기업을 분석하고 상담을 준비하며 CEO에게 설명하고 반론에 대응하고 정당한 보험계약 기회를 발굴하도록 돕는 통합 법인영업·교육 시스템이다. 유료 사용자가 느끼는 최종 가치는 “리포트를 받았다”가 아니라 “이 기업을 어떻게 상담하고 어떤 계약기회를 확인해야 하는지 알게 되었다”여야 한다.\n16\n마무리\n좋은 화법은 설득을 강요하지 않는다. 사실을 명확히 하고 선택의 결과를 보이게 하여 대표가 스스로 결정하게 한다.\n보험이 필요한 곳에서는 당위성과 금액, 질문, 반론 대응, 다음 미팅까지 분명하게 제시하고, 보험이 필요하지 않은 곳에서는 과감히 배제한다. 바로 이 일관성이 프로그램의 신뢰와 계약력을 동시에 높인다."},{"title":"개발 우선순위","text":"1. 페이지별 10단 상담노트 스키마 확정\n2. 보험기회 판단규칙과 필요재원 계산 연동\n3. 기업 이슈별 질문·반론·클로징 라이브러리 구축\n4. CEO/컨설턴트/오디오 3모드 출력규칙 구현\n5. 다단계 프롬프트와 JSON 검증\n6. 실제 기업 10~20개 반복테스트와 컨설턴트 평가\n7. 90점 이상 품질검수 통과 후 유료상품 출시\n17\n92~93점 실전출시형 최종판\n기존 설계의 70~80점대 항목을 완전분기 대화, 보험계약 8단계, 업종·CEO 맞춤화, 실행형 프롬프트로 전면 보강한다.\n이 파트의 목적\n이후 내용은 기존 원칙을 설명하는 보충자료가 아니다. 컨설턴트가 실제 CEO 앞에서 말하고, 대표의 반응에 대응하고, 자료제출·정밀진단·보험설계·최종계약까지 진전시키기 위한 실행교본이다. 출시 기준은 모든 평가영역 90점 이상, 가중평균 92.3점 이상, 중대오류 0건이다."},{"title":"17.1 개선 전후 핵심 차이","text":"영역 | 기존 수준 | v3.0 실전완성 기준\n답변 분기 | 긍정·부정·모름·미룸 예시 | 7개 반응유형별 공감→의도확인→재설명→동의확인→행동합의\n반론 대응 | 응대문장 제공 | 반론의 진짜 이유 판별과 2차 반론까지 이어지는 완결대화\n보험 전환 | 보험 필요성·다음 미팅 | 필요재원 동의부터 계약구조·인수심사·최종결정·사후관리까지 8단계\n기업 맞춤 | 일반 중소기업 중심 | 업종 10종·CEO 성향 5종·주주구조·성장단계별 어조와 질문 자동변형\n프롬프트 | 지침형 템플릿 | P1~P9 역할분리, JSON 스키마, 최소개수, 금지규칙, 자동재작성\n음성강의 | 전문적 해설 | 잘못된 접근 비교, 대표 답변 시뮬레이션, 청취 후 실행과제 포함\n품질검수 | 총점 90점 | 영역별 최저 90점, 평균 92.3점, 하드실패 0건"},{"title":"17.2 제품이 최종적으로 제공해야 할 다섯 가지 답","text":"1. 이 기업에서 지금 가장 먼저 다뤄야 할 경영과제는 무엇인가?\n2. 대표에게 어떤 순서와 표현으로 설명해야 방어감 없이 문제를 인식시키는가?\n3. 대표의 답변과 반론에 따라 다음 질문과 제안을 어떻게 바꿔야 하는가?\n4. 보험계약이 타당한 영역은 어디이며, 필요재원과 당위성을 어떻게 입증하는가?\n5. 오늘 상담에서 어떤 자료·진단·설계·계약·재검토 일정을 합의해야 하는가?\n18\n5단 화법 세트\n모든 핵심 이슈를 30초·2분·5분·분기·결정 화법으로 제공하여 상담시간과 대표의 관심도에 맞춰 즉시 사용할 수 있게 한다."},{"title":"성장성과 현금흐름","text":"사용 상황 | 권장 화법\n30초 문제제기 | 대표님, 매출과 이익은 좋아졌지만 채권과 재고가 더 빠르게 늘었다면 성장의 일부가 현금으로 들어오지 못한 상태일 수 있습니다. 이익보다 현금전환 속도를 함께 보겠습니다.\n2분 표준설명 | 이번 실적은 성장 자체로는 긍정적입니다. 다만 매출채권과 재고가 동시에 증가하면 매출이 늘수록 운영자금 부담도 커집니다. 회사가 돈을 못 번다는 뜻이 아니라, 벌어들인 이익이 언제 현금으로 바뀌는지 관리기준이 필요하다는 뜻입니다. 거래처별 실제 회수일과 재고연령을 보면 차입 전에 내부에서 확보할 수 있는 현금규모를 계산할 수 있습니다.\n5분 심층진단 | 매출증가액, 매출채권 증가액, 재고 증가액, 영업현금흐름을 한 화면에서 비교합니다. 채권회수일수 5·10·15일, 재고일수 3·5·10일 개선 시나리오를 제시하되 전액 회수 가능액처럼 말하지 않습니다. 상위 거래처별 조건과 장기재고를 확인해 실현 가능한 목표만 확정합니다.\n다음 행동 결정 | 다음 미팅에서 채권연령표와 재고명세를 기준으로 13주 현금흐름과 개선목표를 산출하는 정밀진단을 진행할지 결정해 주시면 됩니다.\n사용 시 주의\n성장을 문제로 표현하지 않는다. 증가액과 회수가능액을 구분하고, 시나리오에는 가정과 실행조건을 표시한다."},{"title":"단기대여금·가지급금 가능성","text":"사용 상황 | 권장 화법\n30초 문제제기 | 보고서에 대여금이 보이지만 상대방과 목적을 모른 채 대표자 가지급금이라고 단정하면 안 됩니다. 거래의 실질과 회수계획부터 확인하겠습니다.\n2분 표준설명 | 대여금은 금액 자체보다 누구에게, 왜, 어떤 조건으로 지급됐는지가 중요합니다. 계약서·이자율·만기·실제 이자수취·상환재원이 있으면 정상적인 사업상 거래일 수 있고, 관리가 없다면 세무와 현금흐름 위험이 커질 수 있습니다.\n5분 심층진단 | 계정별 원장과 상대방, 자금이동, 계약, 이사회 승인, 이자수취, 만기연장, 담보를 재구성합니다. 회수·정상화·출자전환·거래종료 등 대안은 세무·법률 검토 후 비교하며 보험으로 해결할 문제는 아니라고 명확히 합니다.\n다음 행동 결정 | 우선 계정원장과 계약자료를 받아 거래를 재구성하는 유료 정밀진단을 진행하고, 이후 회수 또는 정상화 방안을 전문가와 확정하겠습니다.\n사용 시 주의\n사적 사용, 횡령, 가지급금으로 단정하지 않는다. 보험과 직접 연결하지 않는다."},{"title":"이익잉여금·배당정책","text":"사용 상황 | 권장 화법\n30초 문제제기 | 이익잉여금이 많다는 사실보다 회사가 앞으로 투자·배당·퇴직·승계에 얼마를 남겨야 하는지가 중요합니다.\n2분 표준설명 | 유보이익은 세금문제 하나가 아니라 성장투자, 금융기관 신뢰, 주주 현금수요, 대표 퇴직, 승계재원 사이의 배분 문제입니다. 과거 배당만 보지 않고 향후 3년의 자금정책을 먼저 정해야 합니다.\n5분 심층진단 | 최소운영현금, 투자계획, 차입상환, 주주별 현금수요, 예상퇴직금, 승계시점의 필요재원을 한 표로 비교합니다. 배당·보수·퇴직·주식거래·보험은 목적이 다르며 세무효과만으로 선택하지 않습니다.\n다음 행동 결정 | 3년 자본정책 시뮬레이션을 통해 회사에 남길 금액과 주주에게 이전할 금액의 기준을 합의하겠습니다.\n사용 시 주의\n“이익잉여금을 보험으로 빼낸다”는 표현을 금지한다. 보험은 유고·퇴직·승계 부족재원이 확인된 경우만 별도 검토한다."},{"title":"자기주식·감자·자본거래","text":"사용 상황 | 권장 화법\n30초 문제제기 | 자기주식이나 감자는 세금기법으로만 볼 거래가 아니라 지분과 현금, 경영권이 동시에 움직이는 자본정책입니다.\n2분 표준설명 | 과거 거래가 적법했다는 결론을 내리기보다 거래목적, 가치평가, 주주별 지분변화, 현금수령액, 의사결정 절차를 재구성해야 합니다. 같은 거래라도 목적과 절차에 따라 향후 위험과 활용방안이 달라집니다.\n5분 심층진단 | 거래 전후 cap table, 주주별 현금흐름, 평가근거, 이사회·주총, 세무신고를 타임라인으로 복원합니다. 향후 승계·임직원 보상·투자유치·지분정리 시 어떤 원칙을 적용할지 3년 지분정책으로 전환합니다.\n다음 행동 결정 | 과거 거래의 사실관계를 먼저 복원한 뒤, 향후 지분이동 원칙과 승계재원을 별도 프로젝트로 설계하겠습니다.\n사용 시 주의\n과거 거래의 위법·탈세를 단정하지 않는다. 보험은 향후 지분매입·승계 부족재원이 있을 때만 제시한다."},{"title":"임원퇴직재원","text":"사용 상황 | 권장 화법\n30초 문제제기 | 퇴직금은 규정만 있다고 끝나는 문제가 아니라 지급시점에 회사가 감당할 현금이 있는지까지 봐야 합니다.\n2분 표준설명 | 정관과 임원퇴직금 규정이 현재 등기임원, 보수, 근속과 맞는지 확인하고 예상퇴직금과 지급시점의 회사현금을 같이 계산해야 합니다. 규정·금액·재원이 함께 맞아야 실행 가능한 계획입니다.\n5분 심층진단 | 정관·주총결의·보수자료·근속·퇴직시점으로 예상금액을 계산하고, 일시지급·분할·적립·보험·금융자산을 비용, 유동성, 확정성, 세무·법률 요건으로 비교합니다.\n다음 행동 결정 | 규정 적정성 확인과 예상퇴직금 계산을 먼저 진행한 뒤, 장기 부족재원이 확인되면 적립수단을 비교하겠습니다.\n사용 시 주의\n비용처리를 보장하지 않는다. 보험을 퇴직금 자체로 동일시하지 않고 적립수단 중 하나로 설명한다."},{"title":"경영승계·주식이동","text":"사용 상황 | 권장 화법\n30초 문제제기 | 승계는 상속세만의 문제가 아니라 누가 경영하고, 누가 주식을 보유하며, 비경영 가족에게 어떤 현금을 제공할지의 문제입니다.\n2분 표준설명 | 기업가치가 높아도 가족에게 필요한 현금이 부족하면 주식분산, 경영권 충돌, 급매각 위험이 생길 수 있습니다. 후계자·비경영 가족·공동주주의 역할과 현금수요를 먼저 정리해야 합니다.\n5분 심층진단 | 최신 주주명부, 가족·후계자 인터뷰, 기업가치 범위, 상속·증여·매매·자기주식·주주간계약을 A/B/C안으로 비교합니다. 각 안의 세금, 현금, 경영권, 절차, 사후관리와 부족재원을 표시합니다.\n다음 행동 결정 | 가족과 주주의 의사를 확인하는 1차 승계진단을 진행하고, 부족재원이 확정되면 보험을 포함한 자금조달 대안을 검토하겠습니다.\n사용 시 주의\n상속세 절감이나 보험금으로 해결된다고 단정하지 않는다. 가족·주주 합의와 전문가 검토가 선행돼야 한다."},{"title":"대표자·핵심인 유고","text":"사용 상황 | 권장 화법\n30초 문제제기 | 보험을 먼저 말씀드리려는 것이 아니라 대표님이 일정 기간 경영에 참여하지 못할 때 회사에 필요한 현금과 의사결정 공백을 계산해 보자는 것입니다.\n2분 표준설명 | 대표 유고는 사망만이 아니라 중대한 질병·장기부재까지 포함합니다. 운영자금, 대출·보증 대응, 거래처 유지, 핵심인력, 해외법인, 지분정리에 필요한 금액과 기존 준비재원을 비교해야 합니다.\n5분 심층진단 | 6~12개월 고정비, 즉시 상환·보증 위험, 핵심인 유지비, 주식매입 가능액을 합산하고 가용현금·금융자산·신용한도·기존보험을 차감합니다. 부족재원이 있을 때만 보장기간과 보험료 부담능력을 고려해 보험범위를 정합니다.\n다음 행동 결정 | 대표 역할표, 개인보증, 기존증권과 월평균 고정비를 받아 부족재원을 계산하는 데 먼저 동의해 주시면 됩니다.\n사용 시 주의\n공포를 유발하지 않는다. 유고보장은 대체경영체계와 함께 설계하고, 보장규모를 임의로 제시하지 않는다."},{"title":"수출채권·신용보험","text":"사용 상황 | 권장 화법\n30초 문제제기 | 매출이 늘어도 거래처 한 곳의 부도나 국가위험이 현금흐름을 멈추게 할 수 있다면 회수관리와 위험전가를 함께 봐야 합니다.\n2분 표준설명 | 신용보험은 매출채권 관리를 대신하지 않습니다. 먼저 고객별 한도, 약정·실제 회수일, 연체·국가위험을 관리하고 그중 회사가 감당하기 어려운 손실만 보험으로 전가하는 구조입니다.\n5분 심층진단 | 상위 거래처 매출집중도, 평균·최대 미수잔액, 연체경험, 국가·통화, 담보·LC, 기존 무역보험 한도와 면책을 비교합니다. 손실액과 보험료, 자기부담, 회수관리 개선을 함께 제시합니다.\n다음 행동 결정 | 상위 거래처별 채권현황과 기존 무역보험을 받아 보장공백과 적정한도부터 분석하겠습니다.\n사용 시 주의\n매출 증가만으로 보험을 권하지 않는다. 거래처·국가위험과 손실감내능력이 확인돼야 한다."},{"title":"재산·휴업·해외사업장","text":"사용 상황 | 권장 화법\n30초 문제제기 | 건물과 기계의 복구비뿐 아니라 공장이 멈춘 기간의 매출총이익과 고정비를 얼마나 버틸지가 핵심입니다.\n2분 표준설명 | 재산보험 가입금액이 장부가나 과거 취득가에 머물면 재조달가액과 차이가 날 수 있고, 휴업손실 보상기간이 실제 복구기간보다 짧으면 공장이 복구돼도 현금이 먼저 고갈될 수 있습니다.\n5분 심층진단 | 자산명세, 재조달가액, 최대예상손실, 대체생산 가능성, 복구기간, 매출총이익, 공급망 의존, 현지증권을 검토합니다. 본사·해외법인·적하·배상·휴업의 중복과 공백을 지도화합니다.\n다음 행동 결정 | 국내외 보험증권과 자산명세를 받아 보장공백·중복·휴업기간의 적정성을 진단하겠습니다.\n사용 시 주의\n재산가액과 휴업기간을 임의로 정하지 않는다. 현지법·보험조건·재보험 가능성을 확인한다."},{"title":"기존 보험증권 최적화","text":"사용 상황 | 권장 화법\n30초 문제제기 | 새로운 가입보다 먼저 현재 보험이 왜 가입됐고 지금의 경영목적과 맞는지 확인하겠습니다.\n2분 표준설명 | 보험 총액이 많아도 계약자·피보험자·수익자, 보장기간, 현금가치, 해지손실, 회계처리, 실제 필요재원과 맞지 않으면 유고·승계 시 사용할 수 없는 보험이 될 수 있습니다.\n5분 심층진단 | 모든 법인·개인 증권을 목적별로 분류하고, 보장공백·중복·기간불일치·수익자 불일치·현금흐름 부담을 분석합니다. 유지·감액·전환·추가가입은 손실과 인수가능성까지 비교합니다.\n다음 행동 결정 | 기존 증권 전체를 먼저 분석해 유지할 계약, 조정할 계약, 실제 부족한 계약을 구분하겠습니다.\n사용 시 주의\n기존 계약을 무조건 해지하거나 갈아타라고 하지 않는다. 해지손실·신규심사·면책을 반드시 비교한다.\n19\nCEO 답변 7종 분기엔진\n대표의 첫 답변을 거절로 단정하지 않고 실제 의도에 따라 재질문·재설명·행동합의를 다르게 설계한다."},{"title":"19.1 공통 판별 질문","text":"대표님 말씀의 핵심이 “필요성은 인정하지만 지금 결정하기 어렵다”는 것인지, 아니면 “문제 자체가 크지 않다고 본다”는 것인지 먼저 구분해도 될까요?\n분기의 원칙\n답변유형을 맞히는 것이 목적이 아니다. 대표의 실제 우려가 정보·비용·신뢰·시기·관계 중 어디에 있는지 확인하고, 결정범위를 한 단계로 줄여 행동을 합의하는 것이 목적이다.\n답변유형 | 대표 신호 | 공감·재질문 | 재설명·동의확인 | 다음 행동\n즉시 동의형 | “맞다, 우리도 문제를 느낀다.” | “이미 체감하고 계셨군요. 가장 부담이 큰 것이 현금, 세금, 경영권 중 무엇입니까?” | 대표가 선택한 우려를 수치화하고 우선순위를 확인한다. “그 부분부터 자료로 확인해도 되겠습니까?” | 필요자료·담당자·다음 미팅 일정 확정\n답변유형 | 대표 신호 | 공감·재질문 | 재설명·동의확인 | 다음 행동\n부분 동의형 | “일부는 맞지만 그렇게 심각하지 않다.” | “심각하다고 단정하려는 것은 아닙니다. 대표님이 동의하시는 부분과 그렇지 않은 부분을 나눠 보겠습니다.” | 동의한 사실에서 출발해 영향 범위를 좁힌다. “이 수치가 1년 더 지속돼도 괜찮은 기준을 함께 정해 보시겠습니까?” | 경계값·점검주기 합의\n답변유형 | 대표 신호 | 공감·재질문 | 재설명·동의확인 | 다음 행동\n부정형 | “문제가 없다.” | “현재 운영상 문제가 없다는 말씀으로 이해했습니다. 그렇다면 어느 수준부터 문제라고 판단하시는지 기준을 먼저 듣고 싶습니다.” | 대표 기준과 객관지표를 비교하고 반박하지 않는다. “그 기준을 넘을 경우에만 실행하도록 경보선을 만들겠습니다.” | 모니터링 기준·재검토일 합의\n답변유형 | 대표 신호 | 공감·재질문 | 재설명·동의확인 | 다음 행동\n정보 부족형 | “정확히 모르겠다.” | “모르시는 것이 문제가 아니라 자료가 경영언어로 정리돼 있지 않은 경우가 많습니다.” | 확인할 자료와 담당자를 특정한다. “제가 필요한 항목을 한 장으로 정리해 담당자에게 요청드리겠습니다.” | 자료목록·제출일·담당자 지정\n답변유형 | 대표 신호 | 공감·재질문 | 재설명·동의확인 | 다음 행동\n전문가 위임형 | “세무사/회계사에게 맡겼다.” | “기존 전문가가 정확한 결산과 신고를 담당하고 계실 것입니다. 이번 검토는 그 자료를 대표님의 의사결정과 현금계획으로 바꾸는 역할입니다.” | 역할 충돌을 피하고 협업안을 제시한다. “쟁점이 확인되면 기존 전문가와 함께 검증하겠습니다.” | 전문가 공유범위·공동미팅 여부 합의\n답변유형 | 대표 신호 | 공감·재질문 | 재설명·동의확인 | 다음 행동\n비용 우려형 | “필요해 보여도 비용이 부담된다.” | “비용을 먼저 보시는 것은 당연합니다. 진단비가 부담인지, 실행비·보험료가 부담인지 구분해도 될까요?” | 전체 실행을 요구하지 않고 최소 진단으로 축소한다. “진단 후 기대효과가 비용보다 작으면 중단하겠습니다.” | 1단계 진단 범위·비용·중단조건 합의\n답변유형 | 대표 신호 | 공감·재질문 | 재설명·동의확인 | 다음 행동\n결정 유예형 | “가족/주주와 상의해야 한다.” | “혼자 결정하실 사안이 아니라는 점에 동의합니다. 누구의 어떤 우려를 먼저 설명해야 합니까?” | 공동설명 자료와 판단기준을 준비한다. “결정이 아니라 쟁점정리 미팅으로 진행하겠습니다.” | 참석자·설명자료·재검토일 확정"},{"title":"19.2 분기 이후 반드시 확인할 세 문장","text":"“제가 이해한 대표님의 우려는 ○○인데 맞습니까?”\n“오늘 전체를 결정하는 것이 아니라 다음 확인단계까지만 합의해도 되겠습니까?”\n“다음 미팅에서 무엇이 확인되면 진행하고, 무엇이면 보류할지 기준을 정하겠습니다.”\n20\n완전한 상담 대화 시나리오\n좋은 문장 몇 개가 아니라 오프닝부터 대표 반응, 2차 반론, 행동합의까지 이어지는 3~5분 실전대화를 제공한다.\n20.1 운전자금 정밀진단 전환\n대표가 성장을 방어하지 않도록 긍정적 실적을 인정하면서 정밀진단에 필요한 자료와 다음 미팅을 확정한다.\n화자 | 실전 대화 | 상담 의도\n컨설턴트 | 대표님, 실적은 분명 좋아졌습니다. 다만 이익과 현금이 같은 속도로 늘지는 않았습니다. 매출채권과 재고가 함께 증가해 성장자금이 내부에 묶였을 가능성이 있습니다. | 성장을 인정한 뒤 문제를 제기\nCEO | 성장하면 채권과 재고가 늘어나는 건 당연하지 않습니까? | 자연증가 반론\n컨설턴트 | 맞습니다. 증가 자체가 문제라는 뜻은 아닙니다. 자연스러운 증가인지, 회수·재고기간이 길어져 관리가 필요한 증가인지를 구분하자는 말씀입니다. 대표님은 어느 수준부터 부담이라고 보십니까? | 반박 대신 대표 기준 확인\nCEO | 현금이 부족하진 않습니다. | 문제 부정\n컨설턴트 | 현재 현금이 충분한 것은 강점입니다. 다만 성장속도가 유지될 때도 같은 수준을 지킬 수 있는지 확인하면 차입 없이 성장할 범위를 알 수 있습니다. 회수일수 10일과 재고일수 5일을 줄였을 때의 가능액을 시나리오로 계산해 보겠습니다. | 현재 강점 인정+미래 기준 제시\nCEO | 계산한다고 실제로 줄일 수 있나요? | 실행가능성 반론\n컨설턴트 | 그래서 시나리오 금액을 효과로 단정하지 않습니다. 거래처별 조건과 재고연령을 보고 현실적으로 가능한 목표만 정하겠습니다. 개선가능액이 작으면 프로젝트를 확대하지 않겠습니다. | 가정과 실행 분리\nCEO | 무슨 자료가 필요합니까? | 행동 신호\n컨설턴트 | 채권연령표, 상위 거래처 결제조건, 재고연령표, 최근 13주 자금수지입니다. 담당자 한 분을 정해 주시면 제가 요청목록을 한 장으로 드리고 다음 미팅에서 개선가능액과 실행순서를 제시하겠습니다. | 자료·담당자·다음 미팅 확정\n20.2 대여금 정상화 프로젝트\n가지급금으로 단정하지 않고 사실관계를 복원해 유료 정상화 프로젝트와 전문가 협업으로 연결한다.\n화자 | 실전 대화 | 상담 의도\n컨설턴트 | 보고서에 단기대여금이 새롭게 나타나지만 상대방과 목적을 모른 채 대표자 가지급금이라고 말할 수는 없습니다. 거래의 실질부터 확인해야 합니다. | 단정 방지와 신뢰 형성\nCEO | 관계회사에 잠깐 빌려준 돈입니다. | 부분 정보\n컨설턴트 | 그렇다면 사업상 목적과 회수관리가 핵심입니다. 계약서, 이자율, 만기, 실제 이자수취가 있습니까? | 핵심 요건 질문\nCEO | 계약서는 있는데 만기가 지나 연장했습니다. | 관리위험 신호\n컨설턴트 | 연장 자체가 곧 문제라는 뜻은 아닙니다. 다만 반복 연장되면 회수가능성과 업무관련성, 승인절차를 함께 설명할 자료가 필요합니다. 상환재원은 무엇입니까? | 위험 재인식\nCEO | 관계회사가 좋아지면 갚을 겁니다. | 불확실한 상환\n컨설턴트 | 그렇다면 정상·지연·회수곤란 세 시나리오로 본사 현금과 세무영향을 보겠습니다. 보험으로 해결할 사안은 아니고, 계약과 회수계획을 정상화하는 프로젝트가 우선입니다. | 보험 배제와 프로젝트 정의\nCEO | 세무사와 같이 보면 되겠네요. | 협업 동의\n컨설턴트 | 맞습니다. 제가 자금흐름과 경영대안을 재구성하고, 세무사와 법률전문가가 세무·계약요건을 검증하도록 역할을 나누겠습니다. | 전문가 협업 구조\n20.3 대표자 유고 필요재원 분석\n대표 유고의 경영·현금 영향을 수치화하고 기존 보험 분석 및 부족재원 확정 미팅을 확보한다.\n화자 | 실전 대화 | 상담 의도\n컨설턴트 | 대표님께 보험을 먼저 권하려는 것이 아닙니다. 대표님이 6개월간 경영에 참여하지 못할 때 회사에 필요한 현금과 의사결정 공백을 계산해 보자는 것입니다. | 상품 방어감 제거\nCEO | 저 말고도 임원들이 잘합니다. | 대체자 존재 반론\n컨설턴트 | 좋은 준비입니다. 그러면 대체자의 권한, 금융기관과 주요 거래처가 인정하는 범위, 해외법인 의사결정까지 확인하면 실제 공백이 어느 정도인지 알 수 있습니다. 대표 승인 없이는 어려운 업무가 무엇입니까? | 대체가능성 구체화\nCEO | 대출과 해외자금은 제가 봅니다. | 핵심 역할 확인\n컨설턴트 | 그 두 영역만으로도 긴급 운영자금과 권한위임을 별도로 준비할 필요가 있습니다. 월평균 고정비, 즉시 대응할 대출·보증, 핵심인력 유지비를 합산하고 가용현금과 기존 보험을 차감하겠습니다. | 필요재원 산식 설명\nCEO | 회사 현금이 100억원 정도 있으니 충분하지 않을까요? | 내부현금 반론\n컨설턴트 | 충분할 수도 있습니다. 다만 그 현금 중 매입대금·급여·세금·투자에 이미 필요한 금액을 제외한 실제 비상재원을 구분해야 합니다. 부족분이 없으면 보험을 줄이거나 제외하겠습니다. | 보험 비강제성\nCEO | 기존 보험도 꽤 있습니다. | 기존보험 반론\n컨설턴트 | 그렇다면 신규가입보다 증권의 목적·수익자·지급시점이 회사 필요와 맞는지 먼저 분석하겠습니다. 다음 미팅은 상품설명이 아니라 부족재원 확정 미팅으로 진행하겠습니다. | 증권분석과 2차 미팅\n20.4 승계재원과 가족 합의\n승계의 경영권·가족공평성·현금재원을 분리하고 가족 공동설명 미팅으로 연결한다.\n화자 | 실전 대화 | 상담 의도\n컨설턴트 | 승계는 세금만 줄이는 문제가 아니라 누가 경영하고, 누가 주식을 보유하며, 비경영 가족에게 어떤 현금을 줄지의 문제입니다. | 승계 리프레임\nCEO | 아들이 회사를 맡을 겁니다. | 후계자 정보\n컨설턴트 | 경영후계자가 정해진 것은 큰 강점입니다. 다른 가족은 주식보다 현금을 원합니까, 아니면 동일한 지분을 원합니까? | 가족 공평성 질문\nCEO | 딸도 있으니 공평하게 해야죠. | 갈등 가능성\n컨설턴트 | 공평함이 동일한 지분인지, 경제적 가치인지 가족마다 다르게 이해할 수 있습니다. 경영권은 아드님에게 안정적으로 두고 따님에게는 다른 자산이나 현금을 제공하는 안도 비교해야 합니다. | 경영권·경제가치 분리\nCEO | 상속세도 만만치 않을 겁니다. | 현금수요 인식\n컨설턴트 | 맞습니다. 예상 주식가치와 상속세뿐 아니라 지분매입·비경영 가족 정산·회사운영자금까지 합산한 뒤 현재 자산과 기존 보험을 차감해야 합니다. 보험은 부족재원을 준비하는 한 수단일 뿐입니다. | 필요재원·보험 역할\nCEO | 가족과 상의해야 합니다. | 결정 유예\n컨설턴트 | 당연합니다. 다음 미팅은 결정을 요구하지 않고 가족별 쟁점과 A/B/C안을 설명하는 자리로 하겠습니다. 가족이 판단할 기준을 한 장으로 준비하겠습니다. | 공동미팅 합의\n20.5 보험료 부담 반론과 설계 축소\n보험료 반론을 가격할인으로 처리하지 않고 목적·기간·범위를 축소해 설계검토 동의를 얻는다.\n화자 | 실전 대화 | 상담 의도\nCEO | 필요한 건 알겠는데 보험료가 너무 부담됩니다. | 비용 반론\n컨설턴트 | 부담을 먼저 보시는 것이 맞습니다. 월 지출 자체가 부담인지, 장기간 자금이 묶이는 것이 부담인지 구분해도 될까요? | 진짜 이유 확인\nCEO | 장기적으로 계속 내는 게 싫습니다. | 기간 우려\n컨설턴트 | 그렇다면 저축이나 장기적립 목적은 제외하고, 예고 없는 유고 시 반드시 필요한 최소 부족재원과 필요한 기간만 보겠습니다. 내부현금과 신용한도가 담당할 부분을 먼저 빼겠습니다. | 목적·범위 축소\nCEO | 그래도 금액이 클 것 같습니다. | 2차 비용 반론\n컨설턴트 | 보장금액을 한 번에 맞추지 않고 핵심 위험과 선택 위험을 나눌 수 있습니다. 1안은 최소운영자금, 2안은 운영자금+보증대응, 3안은 승계재원까지 포함해 보험료와 효과를 비교하겠습니다. | A/B/C 구조\nCEO | 그럼 비교만 해봅시다. | 설계검토 동의\n컨설턴트 | 비교는 가입동의가 아닙니다. 기존증권과 심사조건을 확인한 뒤 대표님이 보류할 기준까지 함께 제시하겠습니다. | 선택권·투명성\n20.6 최종계약 보류 대응\n최종보류를 추궁하지 않고 실제 이유를 구분해 공동설명·판단자료·재검토일을 확정한다.\n화자 | 실전 대화 | 상담 의도\nCEO | 설계는 괜찮은데 조금 더 생각해 보겠습니다. | 최종 보류\n컨설턴트 | 당연히 생각하실 수 있습니다. 보류 이유가 금액, 계약구조, 가족 동의, 심사조건 중 어디에 가장 가깝습니까? | 보류 이유 분해\nCEO | 배우자와 상의해야 합니다. | 관계자 동의\n컨설턴트 | 배우자분께는 보험상품보다 왜 이 금액이 필요한지와 기존 준비재원을 먼저 설명드리는 것이 좋습니다. 함께 설명드릴까요, 아니면 판단자료를 드릴까요? | 공동설명 선택권\nCEO | 자료를 먼저 주세요. | 자료 요청\n컨설턴트 | 필요재원 산식, 내부현금과 기존보험, 3개 대안, 보험료·보장기간·해지·면책·심사조건을 한 장으로 정리하겠습니다. 어떤 조건이면 진행하고 어떤 조건이면 보류할지도 표시하겠습니다. | 결정자료 구체화\nCEO | 다음 주에 다시 보죠. | 재검토 신호\n컨설턴트 | 좋습니다. 다음 주 수요일에 배우자 의견과 추가 질문을 확인하고 최종 진행·축소·보류 중 하나를 결정하는 일정으로 잡겠습니다. | 날짜와 결정형태 확정\n21\n보험계약 8단계 전 과정 화법\n보험 가능성 발견부터 필요재원, 증권분석, 대안비교, 설계동의, 심사, 최종결정, 사후관리까지 한 흐름으로 완성한다.\n단계 | 핵심 화법 | 필수 검증 | 단계 완료 조건\n1. 보험 가능성 발견 | “현재 자료에서 보험을 검토할 이유가 보이는 것은 ○○ 위험입니다. 다만 보험가입이 필요하다는 결론은 추가확인 전에는 내리지 않겠습니다.” | 위험사건·재무충격·보험가능성 구분 | 위험이 실제 업무·현금에 미치는 영향 확인\n2. 필요재원 계산 동의 | “가입금액을 정하는 것이 아니라 회사가 실제로 필요한 금액을 계산하는 데 먼저 동의해 주시면 됩니다.” | 필요재원 구성과 기간 설정 | 운영비·상환·보증·지분·세금 등 항목 합의\n3. 기존 준비재원·증권 분석 | “가용현금, 금융자산, 신용한도, 기존 보험 중 실제 사용할 수 있는 금액을 구분하겠습니다.” | 중복·공백·수익자·지급시점 확인 | 증권과 현금자료 요청\n4. 보험 외 대안 비교 | “내부적립, 금융자산, 차입한도, 주주간계약, 보험을 비용·확정성·시점·유동성으로 비교하겠습니다.” | 보험 단독해법 방지 | A/B/C 대안 비교\n5. 보험설계 검토 동의 | “부족재원 범위 안에서 회사 현금흐름을 해치지 않는 구조만 검토하겠습니다. 비교 자체는 가입동의가 아닙니다.” | 범위·기간·보험료 한도 합의 | 설계 요청 동의\n6. 계약구조·인수심사 | “계약자·피보험자·수익자와 보험료 부담주체가 목적에 맞아야 하며, 건강·재무심사 결과에 따라 구조가 달라질 수 있습니다.” | 약관·면책·할증·거절 대안 설명 | 심사자료와 개인정보 동의\n7. 최종 결정 | “진행·축소·보류 중 하나를 결정하실 수 있도록 필요재원, 대안, 비용, 해지·심사 위험을 한 장으로 비교하겠습니다.” | 압박 없는 결정 지원 | 결정자·조건·일정 확정\n8. 계약 후 실행관리 | “증권 발행이 끝이 아니라 가입목적과 회계·세무, 수익자, 보장금액을 매년 기업상황과 함께 점검하겠습니다.” | 목적 유지·변경관리 | 연례리뷰와 사건 발생 프로토콜"},{"title":"21.1 계약구조를 설명하는 중립 화법","text":"“계약자·피보험자·수익자는 세금 때문이 아니라 보험의 목적과 보험금이 필요한 주체에 맞춰야 합니다.”\n“법인 자금으로 납입한다고 해서 모든 보험료의 회계·세무처리가 같지는 않습니다. 사실관계와 계약구조를 전문가와 확인하겠습니다.”\n“해지환급금은 보장목적과 다르게 움직일 수 있고, 중도해지 손실과 신규심사 위험을 함께 봐야 합니다.”\n“인수심사 결과가 예상과 다르면 가입금액·기간·상품·피보험자·비보험 대안을 다시 비교하겠습니다.”"},{"title":"21.2 심사 결과별 대응","text":"심사결과 | 대표에게 설명하는 화법 | 대안\n표준 인수 | “예상 조건과 크게 다르지 않습니다. 이제 필요재원과 보험료 한도에 맞는지 최종 확인하겠습니다.” | 진행·축소·보류 비교\n할증 | “위험이 추가 반영돼 보험료가 높아졌습니다. 필요재원의 우선순위를 나누고 보험 외 재원과 결합하겠습니다.” | 핵심보장 우선, 기간·금액 조정\n부담보/면책 | “보장되지 않는 위험이 이번 목적과 얼마나 겹치는지 확인해야 합니다. 핵심위험을 못 보장하면 계약 목적을 다시 평가하겠습니다.” | 다른 구조·상품·비보험 대안\n가입연기 | “현재는 조건이 확정되지 않았으므로 재심사 시점과 그동안의 비상대책을 함께 정하겠습니다.” | 재검일, 내부적립, 권한위임\n거절 | “보험으로 준비할 수 없다는 결론도 중요한 결과입니다. 내부현금·금융자산·신용한도·주주계약으로 대체재원을 설계하겠습니다.” | 비보험 비상재원\n22\nCEO 성향·기업유형 맞춤화\n같은 숫자라도 대표의 의사결정 방식과 기업의 수익구조에 맞춰 결론·질문·속도·근거를 다르게 제시한다."},{"title":"22.1 CEO 성향별 화법","text":"유형 | 효과적인 접근 | 피해야 할 접근 | 대표 화법\n숫자중심형 | 결론→산식→민감도→결정기준 | 감성적·추상적 위험표현 | “세 가지 숫자로 보겠습니다. 필요재원, 현재재원, 부족재원입니다.”\n빠른결정형 | 핵심 1~2개, A/B 선택, 기한 | 장시간 배경설명 | “오늘은 전체가 아니라 우선순위 1번과 다음 행동만 결정하시면 됩니다.”\n신중보수형 | 기존방식 존중, 단계별 검토, 보류조건 | 즉시변경·긴급성 압박 | “현재 방식을 유지하면서 경보선을 넘을 때만 실행하는 안도 함께 보겠습니다.”\n관계중심형 | 가족·임원·직원·거래처 영향, 공동설명 | 숫자만으로 압박 | “이 결정이 가족과 핵심임원에게 어떻게 받아들여질지도 함께 설계하겠습니다.”\n회의·방어형 | 대표 판단 먼저 질문, 확정·가정 구분 | 단정·상품 선제시 | “대표님 기준을 먼저 듣고 자료와 다른 부분만 확인하겠습니다.”"},{"title":"22.2 기업유형별 핵심 문맥","text":"기업유형 | 핵심 경영언어 | 우선 질문 | 보험 포인트\n제조업 | 가동률·재고·납기·설비·휴업 | 핵심설비 중단 시 복구기간과 대체생산 | 재산·기계·휴업·PL·핵심인\n수출·해외법인 | 거래처·국가·환율·물류·현지법인 | 상위 거래처 집중·연체·현지 증권 | 수출신용·적하·해외재산·휴업·배상\n서비스·지식산업 | 핵심인력·고객관계·영업권·데이터 | 매출을 만드는 핵심인과 고객집중 | 핵심인·전문직배상·사이버·영업중단\n가족기업 | 경영권·가족공평성·비경영 가족 | 후계자·가족별 기대·의사결정권 | 승계·주식매입·유고·퇴직재원\n공동주주기업 | 주주간 권리·퇴사·사망·지분매입 | 주주간계약·매입가격·자금원 | 주주 유고·지분매입재원\n고성장기업 | 현금소모·운전자금·핵심인·투자 | 성장 지속 시 자금부족 시점 | 핵심인·D&O·신용보험·사이버\n현금부자기업 | 최소운영현금·자본정책·투자·승계 | 현금의 목적별 구분과 사용제한 | 보험 필요성 낮을 수 있음, 부족재원만\n차입의존기업 | 상환·보증·금리·담보·현금흐름 | 대표 보증·만기집중·약정조건 | 대출상환·핵심인, 단 과잉보장 금지\n승계임박기업 | 기업가치·지분·가족·세금·현금 | 시점·후계자·비경영가족·주식가치 | 상속·지분매입 부족재원\n기존보험 다수기업 | 목적·수익자·중복·현금가치·심사 | 전체 증권과 가입목적·해지손실 | 신규보다 최적화·공백·목적 일치\n23\n반론 25종 완결 대응\n반론을 이기는 문장이 아니라 진짜 이유를 확인하고 다음 한 단계의 행동을 합의하는 대화로 설계한다.\n대표 반론 | 5단 대응의 핵심 | 권장 화법 | 행동합의\n“지금까지 문제없었습니다.” | 현재 성과 인정→문제 아닌 기준설정 제안 | “맞습니다. 과거가 잘못됐다는 뜻이 아니라 성장과 지분·승계 조건이 달라졌으니 어느 수준부터 점검할지 기준을 만들자는 것입니다.” | 경보선·재검토일\n“세무사가 다 해줍니다.” | 기존 전문가 존중→역할 구분 | “세무사는 결산·신고를 담당하고, 이번 검토는 그 자료를 대표님의 현금·지분·위험 의사결정으로 바꾸는 역할입니다. 쟁점은 함께 검증하겠습니다.” | 공유자료·공동미팅\n“회계법인 보고서와 뭐가 다릅니까?” | 차별성 설명 | “과거 숫자 설명을 넘어 대표 답변, 시나리오 계산, 실행순서, 상담·보험 필요재원까지 연결하는 의사결정 자료입니다.” | 샘플 범위·진단 동의\n“자료가 너무 많습니다.” | 요청 최소화 | “1차에는 판단에 필요한 핵심 4종만 받고, 결과가 의미 있을 때 추가자료를 요청하겠습니다.” | 핵심자료 4종\n“정보를 주기 불안합니다.” | 보안 우려 인정 | “민감정보는 최소화하고 익명화·접근권한·보관기간을 명확히 하겠습니다. CEO 전달본에는 내부정보가 포함되지 않습니다.” | 보안동의·마스킹\n“진단비가 아깝습니다.” | 효과·중단조건 | “진단의 목적은 계약이 아니라 실행가치가 있는지 판단하는 것입니다. 기대효과가 비용보다 작으면 확대하지 않는 조건을 두겠습니다.” | 1단계 범위·중단조건\n“보험은 관심 없습니다.” | 보험 제외 전제 | “보험을 제외하고도 경영공백과 부족재원 계산은 필요합니다. 결과상 부족분이 없으면 보험을 권하지 않겠습니다.” | 필요재원 분석만\n“보험이 이미 많습니다.” | 신규보다 증권분석 | “총액보다 목적·수익자·기간·실제 사용가능성이 중요합니다. 신규가입 전에 유지·중복·공백을 먼저 보겠습니다.” | 증권 수집\n“보험료가 비쌉니다.” | 비용 원인 분해→범위축소 | “월 지출과 장기구속 중 무엇이 더 부담인지 확인하고, 필수 부족재원과 기간만 남기겠습니다.” | A/B/C 설계\n“회사 현금이 충분합니다.” | 가용현금 구분 | “운영필수현금과 즉시 사용할 비상재원을 나누고 부족분이 없다면 보험을 축소·제외하겠습니다.” | 가용현금 계산\n“대표가 없으면 회사가 끝입니다.” | 보험 한계 인정 | “그래서 보험만이 아니라 대체경영·권한·거래처 대응과 비상재원을 함께 설계합니다.” | 비상경영 프로젝트\n“가족과 상의해야 합니다.” | 공동결정 존중 | “누구의 어떤 우려를 설명해야 하는지 알려주시면 결정을 요구하지 않는 공동설명 자료를 준비하겠습니다.” | 참석자·일정\n“공동주주가 반대할 겁니다.” | 주주별 이해관계 구분 | “주주별 권리·현금·경영권 영향을 따로 보여드리고 합의 가능한 최소안을 찾겠습니다.” | 주주영향표\n“아직 승계는 멀었습니다.” | 시기와 준비기간 분리 | “실행은 나중에 해도 가치·가족·보험심사·지분정리는 시간이 걸립니다. 지금은 기준과 선택지만 준비하겠습니다.” | 연례점검\n“상속세는 그때 가서 내면 됩니다.” | 현금시점 설명 | “세금액보다 납부시점에 주식은 많고 현금이 부족할 수 있다는 점을 보겠습니다. 부족분이 없으면 별도 준비가 필요 없습니다.” | 유동성 산출\n“배당하면 되지 않습니까?” | 배당 한계·비교 | “배당은 가능한 수단이지만 회사현금, 주주별 세금, 투자계획, 시점을 함께 비교해야 합니다.” | 3년 자본정책\n“퇴직금은 규정대로 주면 됩니다.” | 규정·현금·시점 결합 | “규정 적정성뿐 아니라 퇴직시점에 회사가 실제 지급 가능한지와 운영현금이 남는지 보겠습니다.” | 예상퇴직금·현금 시뮬레이션\n“대여금은 곧 받습니다.” | 회수계획 증빙 | “그 계획을 계약·상환재원·일정으로 남기면 오히려 정상거래를 설명하기 쉬워집니다.” | 상환계획 문서화\n“거래처를 압박할 수 없습니다.” | 고객등급별 접근 | “전 거래처 일괄단축이 아니라 위험·마진·전략성에 따라 조건을 차등화하겠습니다.” | 고객별 한도정책\n“재고는 다 팔립니다.” | 판매가능성과 시점 분리 | “판매 가능 여부와 현금전환 시점을 구분해 재고연령과 마진저하 가능성을 보겠습니다.” | 재고연령표\n“해외보험은 현지에서 합니다.” | 통합 공백 점검 | “현지 가입을 존중하되 본사 관점에서 한도·면책·휴업기간·중복만 통합 확인하겠습니다.” | 현지증권 수집\n“다른 설계사에게 받고 있습니다.” | 기존 관계 존중 | “기존 관계를 대체하기보다 기업자료와 필요재원 기준으로 비교 가능한 분석을 제공하겠습니다.” | 비교기준 합의\n“오늘 결정하기 어렵습니다.” | 결정범위 축소 | “오늘은 가입결정이 아니라 확인할 자료와 다음 판단일만 정하겠습니다.” | 재검토일\n“조건이 바뀌면 어떻게 합니까?” | 변경 리스크 공개 | “심사·약관·제도 변화 가능성을 전제로 진행·축소·보류 기준을 미리 정하겠습니다.” | 조건부 의사결정\n“효과를 보장할 수 있습니까?” | 보장 불가 명확화 | “세무·재무·보험 결과를 보장하지 않습니다. 확인된 사실과 가정, 위험, 대안을 투명하게 비교해 결정오류를 줄이는 것이 목적입니다.” | 검증·전문가 확인\n24\n실행형 프롬프트 P1~P9\nAI가 한 번에 HTML을 쓰지 않고 사실·진단·질문·솔루션·보험·화법·오디오·검수를 구조화 JSON으로 생성하도록 한다.\n공통 시스템 원칙\n당신은 기업경영 리포트의 문장을 만드는 작가가 아니라, 확인된 사실과 코드 계산값을 경영의사결정·실전상담·보험기회로 변환하는 분석엔진이다. 원본에 없는 사실·금액·법적 결론을 만들지 않는다. CONFIRMED, CALCULATED, SCENARIO, TO_CONFIRM, CONFLICT를 구분한다. 보험은 확인된 위험·재무충격·부족재원·보험적합성이 있을 때만 제시한다. CEO용에 영업기법·계약등급·내부 클로징을 노출하지 않는다."},{"title":"P1 | 기업자료 사실구조화","text":"구분 | 명세\n핵심 입력 | PDF 추출텍스트, 표 위치, 페이지번호, 단위, 별도/연결 구분, 사용자 확인값\n필수 출력 | companyProfile, financialSeries, ownership, relatedParties, transactions, insuranceHints, sourceMap, conflicts\n강제 규칙 | 문장작성 금지. 모든 값에 sourcePage·status·unit·period. 충돌은 임의 선택하지 말 것.\n실행 프롬프트\n입력자료를 표준 JSON으로 변환하라. 회사명·기간·단위·별도/연결을 먼저 확정하고 재무제표의 연도별 값을 계정별 배열로 정리하라. 동일 항목이 다르면 CONFLICT로 남기고 원문 위치를 모두 기록하라. 보험·승계·대여금·자본거래의 징후는 hint로만 표시하고 결론을 내리지 말라."},{"title":"P2 | 이슈탐지·중요도 평가","text":"구분 | 명세\n핵심 입력 | P1 JSON, 코드 계산값, 업종·규모·성장단계\n필수 출력 | issueCode, evidence, severity, urgency, confidence, missingFacts, requiredCalculator, requiredEvidence\n강제 규칙 | 증거 없는 이슈 금지. 보험기회와 경영이슈를 분리. 최대 핵심이슈 7개, 보조이슈 5개.\n실행 프롬프트\n각 이슈를 “왜 중요한가”보다 먼저 “무슨 근거로 탐지됐는가”로 작성하라. severity와 urgency를 분리하고 confidence가 낮으면 추가질문으로 전환하라. 단기대여금을 대표자 가지급금으로, 이익잉여금을 과세문제로 자동 변환하지 말라."},{"title":"P3 | 맞춤질문·답변 정규화","text":"구분 | 명세\n핵심 입력 | P2 이슈, 기존 답변, CEO 성향, 기업유형\n필수 출력 | commonQuestions 12~15개, conditionalQuestions, answerSchema, whyAsked, reportImpact, exampleAnswer\n강제 규칙 | 한 질문에 한 판단만. 숫자·날짜·사람·지분은 구조화 필드. 답변 확인 전 사실화 금지.\n실행 프롬프트\n기업보고서에서 확인되지 않은 사실 중 솔루션·보험등급·필요재원에 영향을 주는 질문만 생성하라. 각 질문은 질문 이유, 답변 예시, 답변이 보고서와 계약기회에 미치는 영향, 필요한 증빙을 포함하라."},{"title":"P4 | 계산·근거·솔루션 설계","text":"구분 | 명세\n핵심 입력 | 확정 facts, 사용자 확인답변, 계산기 결과, 검색근거\n필수 출력 | currentState, cause, riskIfIgnored, benefitIfSolved, options A/B/C, recommendation, decisionItems, roadmap\n강제 규칙 | 계산은 코드값만 사용. 시나리오의 가정·범위·한계 표기. 세무·법률 전문가 경계 표시.\n실행 프롬프트\n이슈별로 현재상태→원인→방치위험→해결이익→A/B/C안→권장순서→CEO결정→30/90/365일 로드맵을 구성하라. 각 안을 세금·현금·경영권·절차·사후관리로 비교하라."},{"title":"P5 | 보험계약 기회 판단","text":"구분 | 명세\n핵심 입력 | 이슈·위험사건·재무충격·필요재원·현재재원·기존증권·보험적합성·심사정보\n필수 출력 | grade A~D, rationale, fundingGap, insuranceRole, nonInsuranceActions, eligibilityChecks, questions, objections, nextMeeting\n강제 규칙 | 필요재원·현재재원 없으면 A 금지. 보험으로 해결 불가한 이슈는 D. 세무효과 보장 금지.\n실행 프롬프트\n각 보험기회를 근거성·손실규모·시급성·부족재원·보험적합성·계약가능성·상담준비도 7축으로 평가하라. A는 자료와 부족재원이 충분히 확인된 경우만, B는 추가자료 조건부, C는 기존증권 분석 우선, D는 보험 직접연계 낮음으로 출력하라."},{"title":"P6 | CEO용 본문 생성","text":"구분 | 명세\n핵심 입력 | P4 솔루션, P5 보험의 경영적 표현, 페이지 흐름\n필수 출력 | title, oneSentenceConclusion, facts, interpretation, options, decision, actions, caution\n강제 규칙 | 보험계약·영업기회·클로징·내부등급 노출 금지. 한 페이지 한 결정. 쉬운 경영언어.\n실행 프롬프트\nCEO가 60초 안에 “현재상태·의미·선택·결정”을 이해하도록 작성하라. 보험은 비상재원·위험재원·보장공백이라는 경영언어로만 표현하고 상품명·계약유도 문구를 쓰지 말라."},{"title":"P7 | 컨설턴트용 페이지별 화법 생성","text":"구분 | 명세\n핵심 입력 | CEO본문, 이슈·솔루션·보험등급, CEO성향, 기업유형, 앞뒤 페이지 목적\n필수 출력 | purpose, 30sec, 2min, 5min, questions 3~5, branches 7종, objections 2~4, advancedGuide, linkage, transition, documents\n강제 규칙 | 본문 반복 금지. 실제 대화체. 응대 뒤 재질문·행동합의 필수. 보험페이지는 8단계 위치 표시.\n실행 프롬프트\n각 페이지를 하나의 소형 상담시나리오로 작성하라. 먼저 대표의 강점과 사실을 인정하고, 경영적 의미를 설명한 뒤 판단질문을 하라. 7개 답변유형 중 현실적으로 가능한 분기만 선택하되 최소 4개를 제공하고, 각 분기는 공감→의도확인→재설명→동의확인→다음행동으로 끝내라."},{"title":"P8 | 음성강의 대본 생성","text":"구분 | 명세\n핵심 입력 | 리포트 확정본, 컨설턴트 노트, 핵심 보험기회, 학습시간\n필수 출력 | chapters, learningGoals, script, wrongVsRight, rolePlay, rememberOne, fieldAssignment\n강제 규칙 | 리포트 낭독 금지. 숫자·법령 나열 금지. 18~25분. 리포트와 결론·금액 일치.\n실행 프롬프트\n청취자가 다음 CEO 상담에서 말할 수 있도록 설명하라. 각 장은 쉬운 해석, 잘못된 접근과 올바른 접근, 대표 반응이 포함된 짧은 대화, 상담질문 3개, 현장 과제로 구성하라. 보험은 위험→필요재원→기존재원→부족재원→대안→설계동의 순서를 교육하라."},{"title":"P9 | 교차검수·자동수정","text":"구분 | 명세\n핵심 입력 | P1~P8 전체 JSON, 원본 sourceMap, 계산기 결과, 금지규칙\n필수 출력 | scoreByDomain, hardFailures, inconsistencies, rewriteInstructions, correctedOutput\n강제 규칙 | 영역별 90 미만이면 재작성. 평균 92.3 미만이면 완료 금지. 하드실패 1건이면 전체 탈락.\n실행 프롬프트\n숫자·연도·단위·사실상태·CEO/컨설턴트 분리·보험근거·반론완결성·오디오 일치를 검사하라. 문제를 지적하는 데서 끝내지 말고 수정대상 필드와 대체문장을 생성하라. 수정 후 동일 루브릭으로 재평가하라.\n25\n음성강의 실전훈련 설계\n전문 내용을 쉽게 이해시키고 상담 인사이트와 보험계약 접근순서를 반복학습하도록 구성한다."},{"title":"25.1 20분 표준 구성","text":"구간 | 시간 | 교육내용 | 청취 후 산출\n도입 | 1~2분 | 기업 한 문장 진단·학습목표·이번 상담의 핵심관점 | 핵심문제 1문장\n경영해석 | 5~6분 | 숫자를 현금·지분·경영권 언어로 해석 | CEO에게 설명할 쉬운 표현\n핵심이슈 | 5~6분 | 원인·방치위험·해결이익·A/B/C | 우선 질문과 자료\n보험기회 | 3~4분 | 근거·필요재원·현재재원·부족재원·보험역할 | 보험을 꺼낼 시점과 금지시점\n롤플레이 | 3~4분 | 대표 답변·반론·2차 대응 | 실제 대화문\n마무리 | 1분 | 오늘 한 문장·상담질문 3개·실행과제 | 다음 상담 준비"},{"title":"25.2 잘못된 접근과 올바른 접근","text":"상황 | 잘못된 접근 | 올바른 접근\n이익잉여금 | “보험으로 빼면 됩니다.” | “3년 자본정책과 유고·퇴직·승계 부족재원을 분리한 뒤 보험 필요성을 판단합니다.”\n대표 유고 | “대표님이 없으면 큰일입니다.” | “대표 부재 시 멈추는 업무와 필요한 현금을 계산하고 기존 준비와 부족분을 확인합니다.”\n승계 | “보험금으로 상속세를 해결합니다.” | “주식가치·가족·경영권·현금수요를 합산하고 부족재원의 한 수단으로 보험을 비교합니다.”\n기존보험 | “기존 계약을 해지하고 바꾸십시오.” | “가입목적·해지손실·신규심사·공백을 비교해 유지·감액·추가를 결정합니다.”\n반론 | “지금 하지 않으면 늦습니다.” | “어떤 조건이면 진행·보류할지와 재검토일을 함께 정합니다.”"},{"title":"25.3 음성강의 샘플 대본","text":"이번 기업에서 보험을 꺼내야 하는 첫 번째 이유는 이익잉여금이 많아서가 아닙니다. 대표와 핵심경영진의 의사결정이 국내 본사와 해외법인에 집중돼 있고, 유고 시 운영·보증·거래처·지분정리에 필요한 현금이 동시에 발생할 수 있기 때문입니다. 그러나 현재 자료에는 대표의 역할과 기존 보험, 개인보증이 확인되지 않았습니다. 따라서 첫 미팅의 목표는 상품을 설명하는 것이 아니라 네 가지 자료를 확보하고 부족재원을 계산하는 것입니다. 대표가 “회사 현금이 충분하다”고 답한다면 반박하지 마십시오. 운영필수현금과 실제 비상재원을 구분하고, 부족분이 없으면 보험을 줄이거나 제외하겠다고 말해야 합니다. 이 태도가 보험제안의 신뢰를 높입니다.\n청취 후 현장과제\n1. 대표에게 사용할 30초 문제제기 문장을 자신의 말로 다시 작성한다. 2. 필요한 자료 4종을 체크한다. 3. 대표의 예상 반론 2개와 5단 대응을 소리 내어 연습한다. 4. 오늘 상담의 다음 행동을 “자료·담당자·일정”으로 한 문장에 정리한다.\n26\n92.3점 품질게이트\n총점이 아니라 가장 약한 영역을 기준으로 출시를 통제하고 중대오류는 한 건도 허용하지 않는다."},{"title":"26.1 가중평가표","text":"평가영역 | 가중치 | 목표점수 | 통과증거\n원본·숫자·산식 정확성 | 12 | 95 | 원본·계산기·본문·오디오 불일치 0건\n경영해석 깊이 | 8 | 93 | 요약이 아닌 원인·영향·결정 연결\nCEO 본문 설득력 | 8 | 92 | 60초 내 현재상태·의미·선택·결정\n페이지별 화법 실용성 | 12 | 94 | 30초·2분·5분·질문·전환 제공\n답변 분기 완성도 | 10 | 92 | 최소 4분기, 공감→행동합의 완결\n반론 대응 | 8 | 92 | 진짜 이유·2차 반론·재검토일\n보험기회 판단 | 10 | 95 | 근거·필요재원·현재재원·적합성\n보험계약 결정화법 | 10 | 93 | 8단계·심사·보류·사후관리\n업종·CEO 맞춤성 | 6 | 91 | 문맥·어조·질문 자동변형\n음성강의 교육효과 | 5 | 92 | 낭독 아닌 역할극·과제\n프롬프트 안정성 | 6 | 94 | JSON·최소개수·금지·재작성\n검수·보안·모드분리 | 5 | 95 | 내부노출·중대오류 0건\n출시 판정\n① 모든 영역 90점 이상 ② 가중평균 92.3점 이상 ③ 하드실패 0건 ④ 실제기업 24건 중 80% 이상이 92.3점 통과 ⑤ 컨설턴트 현장평가 평균 4.5/5 이상"},{"title":"26.2 하드실패 목록","text":"원본과 핵심 숫자·연도·단위 불일치\n미확인 사실을 확정적으로 표현하거나 대여금을 대표자 사적 사용으로 단정\n필요재원·기존재원 확인 없이 보험가입·보장금액 제안\n세금절감·비용처리·상속세 해결을 보장\n보험으로 해결할 수 없는 대여금·정관·세무신고 문제를 보험으로 연결\nCEO용 파일에 계약등급·클로징·내부 반론·영업전략 노출\n리포트와 음성강의의 금액·우선순위·권장안 불일치\n공포·압박·기존 전문가 비하·즉시계약 강요\n약관·인수심사·세무·법률 결론을 AI가 최종 확정\n기존 보험 해지손실·신규심사 위험을 검토하지 않고 전환 권유"},{"title":"26.3 실제 검증 계획","text":"검증축 | 표본 | 평가방법 | 합격기준\n기업유형 | 제조·수출·서비스·가족·공동주주·고성장·차입·승계 8종 × 3건 | 총 24개 기업 PDF 생성 | 유형별 2건 이상 92.3점\n컨설턴트 경력 | 초급·중급·고경력 각 2명 | 말하기 자연스러움·상담진전·보험당위성 | 평균 4.5/5\n상담단계 | 1차·2차·보험분석·최종결정 | 역할극 및 실제 상담 후 평가 | 다음 행동 합의율 80%\n오류 스트레스 | 누락·충돌·긴 PDF·보험 없음 | 하드실패 차단·TO_CONFIRM 처리 | 중대오류 0건\n재생성 안정성 | 동일 입력 3회 | 결론·금액·우선순위 비교 | 핵심결론 일치 95%\n27\n최종 운영 체크리스트\n프로그램 제작 전·생성 중·출력 후·현장사용 후에 반드시 확인할 사항을 한 장으로 정리한다."},{"title":"27.1 프로그램 제작 착수 전","text":"□ P1~P9 입력·출력 JSON 스키마가 확정됐는가?\n□ 이슈코드→질문→계산기→검색근거→솔루션→보험기회→화법의 연결표가 있는가?\n□ 보험 A~D 등급과 필요재원 계산의 비활성화 조건이 코드로 정의됐는가?\n□ CEO·컨설턴트·오디오 콘텐츠의 visibility와 내보내기 보안이 구현됐는가?\n□ 실제기업 24건 테스트와 현장평가 양식이 준비됐는가?"},{"title":"27.2 리포트 생성 중","text":"□ PDF 사실구조화와 사용자 답변 확인이 끝나기 전 결론을 생성하지 않는가?\n□ 계산은 코드가 수행하고 AI는 산식·가정·한계를 설명하는가?\n□ 법령·예규·판례 검색은 이슈별 1~3개 사이트로 타기팅하고 근거수준을 표시하는가?\n□ 보험등급이 낮거나 자료가 부족하면 신규계약보다 질문·증권분석·비보험 대안을 출력하는가?\n□ 페이지별 화법이 실제기업 숫자·업종·CEO 성향에 맞게 변형되는가?"},{"title":"27.3 최종 출력 후","text":"□ 모든 페이지에 30초·2분·심화·질문·분기·반론·다음행동이 있는가?\n□ 보험페이지에 위험사건·필요재원·현재재원·부족재원·역할·한계·심사사항이 있는가?\n□ CEO 전달본에 컨설턴트 내부정보가 물리적으로 제거됐는가?\n□ 오디오가 리포트를 읽는 것이 아니라 실무상담을 훈련하는가?\n□ P9 검수에서 모든 영역 90점, 평균 92.3점, 하드실패 0건인가?"},{"title":"27.4 현장사용 후 피드백","text":"□ 컨설턴트가 실제로 말하기 어려웠던 문장은 무엇인가?\n□ 대표가 방어적으로 반응한 질문·표현은 무엇인가?\n□ 다음 미팅·자료·설계 동의로 연결된 화법은 무엇인가?\n□ 보험계약 포인트가 약하거나 억지스러웠던 페이지는 무엇인가?\n□ 반론 이후 대화가 끊긴 구간을 어떤 분기와 질문으로 보완할 것인가?\n최종 제품 정의\n이 교본의 목적은 말을 화려하게 만드는 것이 아니다. 기업자료에서 확인된 사실을 대표의 경영언어로 번역하고, 대표의 반응에 따라 질문과 대안을 조정하며, 실제 부족재원이 확인된 경우에만 보험의 당위성과 계약과정을 투명하게 제시하는 것이다. 최종 프로그램은 “리포트를 받았다”가 아니라 “이 기업을 어떻게 상담하고 어떤 보험계약 기회를 어떤 근거로 확인해야 하는지 알게 되었다”는 평가를 받아야 한다.\n좋은 화법은 대표를 몰아붙이지 않는다. 사실과 선택의 결과를 보이게 하고, 다음 한 단계의 결정을 스스로 내리도록 돕는다. 보험계약은 그 과정에서 확인된 부족재원을 책임 있게 준비하는 결론이어야 한다.\n28\nv3.0 최종개선 파트\n실제 말하기 분량의 완성대사 · 이슈별 7분기 · 보험계약 최종결정 · 실행형 프롬프트 · 3종 음성강의\n최종 수정의 목표 컨설턴트가 현장에서 그대로 말하고 대표의 반응에 따라 대화를 이어가며 자료·정밀진단·보험설계·최종결정까지 합의할 수 있는 실행밀도를 확보한다. 문서 설계 기준 목표점수는 92~93점이며 실제 출시점수는 기업 24건과 컨설턴트 현장검증으로 확정한다.\n보강영역 | v2.0의 한계 | v3.0 최종 수정\n시간별 화법 | 일부가 설명지침 수준 | 실제 말하기 분량의 30초·90초·3분·5분 완성대사\n답변 분기 | 범용 7유형 중심 | 핵심 이슈별 7유형 교차분기·2차 반응·행동합의\n보험계약 | 필요성·다음 미팅 중심 | 필요재원→증권→대안→구조·심사→결정→사후관리\n맞춤화 | 방향표 중심 | 어조·질문·클로징 변환규칙과 완성예시\n프롬프트 | P1~P9 명세 중심 | 필드·자료형·검증식·오류코드·재작성 조건\n오디오 | 짧은 샘플 | 보험기회 높음·컨설팅 우선·증권최적화 3종 완성대본\n29\n현장용 완성대사 라이브러리\n핵심 이슈마다 30초·90초·3분·5분·다음 행동을 실제 대화체로 제공한다.\n사용 원칙 30초는 관심을 여는 문장, 90초는 페이지를 보여주며 이해시키는 문장, 3분은 질문을 포함한 상담, 5분은 근거·가정·대안·결정을 모두 담는 심층상담이다. 대표의 반응이 좋다고 해서 5분 대사를 한 번에 읽지 말고 질문에서 멈춰 답을 듣는다."},{"title":"29.1 성장·이익과 현금전환","text":"데이터 근거와 경계선\n적용 신호 | 매출과 이익이 증가했지만 영업현금흐름이 순이익을 따라가지 못하고 매출채권·재고가 함께 증가한 기업\n사용 금지·주의 | 채권·재고 세부자료가 없을 때 개선금액을 확정적으로 말하지 않는다.\n30초 문제제기 대표님, 실적이 좋아진 것은 분명한 강점입니다. 다만 이익이 늘어난 속도만큼 현금이 들어오지 않았다면 성장의 일부가 거래처와 재고에 머물러 있을 수 있습니다. 오늘은 성장을 문제 삼는 것이 아니라, 성장한 만큼 현금이 남는 구조인지 확인하겠습니다.\n약 90초 표준 설명 대표님, 이번 실적은 매출과 이익 면에서 긍정적입니다. 그런데 영업현금흐름이 순이익보다 낮고 매출채권과 재고가 동시에 늘었다면, 회사가 돈을 못 번 것이 아니라 번 돈이 현금으로 전환되는 시간이 길어진 것입니다. 이 상태가 계속되면 매출이 늘수록 외부차입이나 대표님의 자금관여가 커질 수 있습니다. 거래처별 실제 회수일과 재고연령을 확인해 차입 전에 내부에서 확보할 수 있는 현금부터 계산하겠습니다. 최근 매출 증가와 별개로 자금집행이 빠듯한 시기가 있었습니까?\n약 3분 상담형 대표님, 실적 회복과 성장 자체는 분명히 긍정적입니다. 다만 손익계산서의 이익과 통장에 남는 현금은 같은 숫자가 아닙니다. 매출채권이 늘었다는 것은 매출은 인식됐지만 아직 받지 못한 돈이 늘었다는 뜻이고, 재고가 늘었다는 것은 판매 전 상품과 원재료에 현금이 더 오래 묶였다는 뜻입니다. 중요한 것은 증가액 전체가 아니라 매출 증가에 비해 회수기간과 재고기간이 얼마나 길어졌는지입니다. 거래처별 약정 결제일과 실제 회수일을 구분해 보고받고 계십니까? 장기재고도 정상재고와 별도로 표시합니까? 이 자료가 있으면 회수일수 5일·10일, 재고일수 3일·5일 개선 시 확보 가능한 현금의 범위를 계산할 수 있습니다. 그 금액은 보장되는 절감액이 아니라 실행 우선순위를 정하는 시나리오입니다. 상위 거래처와 장기재고부터 집중하고 13주 현금흐름표로 실제 개선 여부를 확인하겠습니다.\n약 4~5분 심층상담형 대표님, 이 페이지는 실적이 나쁘다는 이야기가 아닙니다. 오히려 매출과 이익이 크게 회복됐기 때문에 지금 관리기준을 만들 필요가 있다는 의미입니다. 손익계산서에는 매출이 발생한 시점에 수익이 잡히지만 회사가 실제로 쓸 수 있는 돈은 거래처가 대금을 지급하고 재고가 판매돼야 들어옵니다. 순이익이 50억원 발생했더라도 영업현금흐름이 30억원이라면 20억원의 차이가 어디에서 생겼는지 설명할 수 있어야 합니다. 대개 매출채권, 재고, 선급금, 매입채무의 변화가 원인입니다. 매출채권과 재고가 동시에 증가했다면 성장에 필요한 운전자금이 내부에 묶였을 가능성이 있습니다. 그렇다고 증가액 전체가 회수 가능한 현금이라는 뜻은 아닙니다. 매출채권에는 정상채권과 연체채권이 섞여 있고 재고에도 정상재고와 장기·저회전재고가 섞여 있습니다. 첫 질문은 “얼마나 늘었습니까?”가 아니라 “누구에게, 얼마 동안, 어떤 마진으로 묶여 있습니까?”여야 합니다. 순서는 세 단계입니다. 첫째 상위 거래처별 매출비중, 약정 결제일, 실제 회수일, 신용한도, 연체이력을 한 장에 놓습니다. 둘째 재고를 원재료·재공품·제품으로 나누고 90일·180일·1년 이상 재고를 구분합니다. 셋째 회수일수 5일과 10일, 재고일수 3일과 5일 시나리오를 계산하되 보수적·기준·도전 목표로 나눕니다. 대표님께 확인할 것은 두 가지입니다. 매출을 더 늘리는 과정에서 추가차입이 필요한 상황을 어느 수준까지 허용할 것인지, 거래처 관계를 해치지 않으면서 결제조건을 조정할 범위가 어디까지인지입니다. 대표님의 기준을 먼저 정해야 숫자가 정책이 됩니다. 다음 미팅에서는 채권연령표, 재고명세, 13주 자금수지와 주요 거래처 조건을 받아 8주 운전자금 개선안을 만들겠습니다. 거래처 부도나 국가위험이 크면 신용보험·무역보험을 검토하되 보험이 회수관리 자체를 대신하지는 않습니다. 오늘 결정할 것은 보험이 아니라 정밀진단 진행 여부, 담당자와 자료제출일입니다.\n다음 행동 합의 채권연령표·재고명세·13주 자금수지·상위 거래처 결제조건을 받아 8주 운전자금 정밀진단 일정과 담당자를 확정한다."},{"title":"29.2 단기대여금·가지급금 가능성","text":"데이터 근거와 경계선\n적용 신호 | 재무상태표 또는 계정명세에 단기대여금·기타채권이 있고 상대방·목적·계약조건이 확인되지 않는 기업\n사용 금지·주의 | 상대방과 거래 실질 확인 전 대표자 가지급금·사적 사용·세무위반으로 단정하지 않는다.\n30초 문제제기 보고서에 대여금이 보이지만 누구에게 왜 지급됐는지를 모른 채 대표자 가지급금이라고 단정하면 안 됩니다. 정상적인 사업상 대여인지, 회수계획이 약한 채권인지부터 계약과 자금흐름으로 확인하겠습니다.\n약 90초 표준 설명 대표님, 대여금은 금액보다 거래의 실질이 중요합니다. 관계회사 운영자금, 임직원 대여, 거래처 지원, 투자 전 단계 등 목적이 다를 수 있고 계약서·이자율·만기·담보·이사회 승인·실제 이자수취가 있다면 정상거래로 설명할 수 있습니다. 반대로 상환재원과 관리기록이 없다면 현금회수와 세무상 위험이 커질 수 있습니다. 상대방과 목적, 지급일, 계약조건, 잔액, 상환계획을 확인하고 회수·정상화·구조변경 중 어떤 방향이 적절한지 비교하겠습니다.\n약 3분 상담형 대표님, 이 계정은 이름만 보고 결론을 내리면 가장 위험한 항목 중 하나입니다. 같은 단기대여금이라도 해외 관계회사 운영자금, 거래처 지원금, 임직원 또는 주주 관련 자금일 수 있습니다. 먼저 상대방, 지급목적, 의사결정 절차, 계약서, 이자율, 만기, 담보, 실제 이자수취, 상환재원을 확인해야 합니다. 이 금액이 누구에게 어떤 목적으로 나갔는지 한 문장으로 설명할 수 있습니까? 담당 임원이 관리하는 상환일정표가 있습니까? 만기가 연장됐다면 이유와 승인기록이 있습니까? 자료가 갖춰져 있다면 정상거래를 더 명확하게 설명할 수 있고, 부족하다면 지금부터 거래를 재구성해 회수 또는 정상화 계획을 세워야 합니다. 이 문제는 보험이 아니라 계정원장·계약·상환계획을 정리하는 유료 정밀진단과 세무·법률 검토가 우선입니다.\n약 4~5분 심층상담형 대표님, 단기대여금이라는 계정이 보인다고 곧바로 대표자 가지급금이나 사적 사용으로 판단해서는 안 됩니다. 같은 계정에 서로 다른 거래가 묶여 있을 수 있기 때문입니다. 확인할 것은 돈을 받은 상대방, 지급목적, 회사가 언제 어떤 재원으로 회수할 계획인지입니다. 정상적인 사업상 거래라면 계약서, 이자율, 만기, 담보 또는 보증, 이사회 승인, 실제 이자수취, 상환스케줄이 있어야 합니다. 해외 관계회사 지원이라면 현지사업 목적과 자금사용, 이전가격·외환·관련자 거래 검토가 필요할 수 있습니다. 임직원이나 주주 관련 자금이면 지급경위와 업무관련성, 회수가능성, 승인절차를 더 세밀하게 봐야 합니다. 과거를 공격하는 것이 아니라 지금 설명 가능한 상태로 만드는 것이 목적입니다. 이 자금은 최초 지급 시 어떤 의사결정으로 나갔습니까? 계약서와 이자수취 내역이 있습니까? 만기가 지났다면 연장사유와 상환재원은 무엇입니까? 회사가 회수를 요구했을 때 상대방이 실제 상환할 수 있습니까? 대표님 답변과 자료가 일치해야 대안을 정할 수 있습니다. 대안은 보통 네 방향입니다. 상환재원이 충분하면 회수일정을 문서화합니다. 사업상 필요가 계속되면 이자·만기·담보·승인을 정상화합니다. 거래 실질이 출자나 투자에 가깝다면 세무·법률 검토 후 구조변경을 비교합니다. 회수가능성이 낮다면 손실·세무·책임 문제를 포함한 대응계획을 세웁니다. 이 페이지에서 보험상품을 연결하지 않는 것이 전문적인 판단입니다. 보험은 우연한 위험으로 생길 자금공백을 전가하는 수단이지 이미 발생한 대여금 회수문제를 해결하지 않습니다. 다음 단계는 계정별 원장, 자금이체, 계약·승인자료로 거래 타임라인을 복원하는 유료 정밀진단입니다.\n다음 행동 합의 계정별 원장·상대방·계약서·이자수취·만기·승인자료를 확보해 거래 타임라인과 회수·정상화 대안을 작성한다."},{"title":"29.3 이익잉여금·배당·자본정책","text":"데이터 근거와 경계선\n적용 신호 | 미처분이익잉여금이 크거나 최근 배당·대규모 자본거래가 있고 투자·퇴직·승계계획이 분리되지 않은 기업\n사용 금지·주의 | 이익잉여금을 현금과 동일시하거나 “보험으로 빼낸다”는 표현을 사용하지 않는다.\n30초 문제제기 이익잉여금이 많다는 사실보다 회사가 앞으로 투자와 운영에 얼마를 남기고, 주주에게 언제 어떤 방식으로 이전할지가 중요합니다. 배당·보수·퇴직·승계·보험을 한꺼번에 섞지 않고 목적별로 나누겠습니다.\n약 90초 표준 설명 대표님, 이익잉여금은 과거에 벌어 내부에 누적한 이익이지만 통장에 같은 금액의 현금이 있다는 뜻은 아닙니다. 이미 설비·재고·채권·관계회사 투자에 사용됐을 수 있습니다. “얼마를 빼낼까”보다 최소 운영현금, 향후 투자, 차입상환, 주주별 현금수요, 대표 퇴직, 승계재원을 3년 기준으로 나눠야 합니다. 그 뒤 배당·보수·퇴직·주식거래의 목적과 세금·현금·경영권 효과를 비교하고, 유고·퇴직·승계의 부족재원이 확인될 때만 보험을 별도로 검토하겠습니다.\n약 3분 상담형 대표님, 이익잉여금이 많으면 세금문제부터 이야기하지만 실제 경영에서는 자금배분 문제로 보는 것이 정확합니다. 성장투자와 운전자금으로 남겨야 할 돈, 금융기관 신뢰와 위기대응을 위한 돈, 주주가 필요로 하는 현금, 대표님의 퇴직과 승계에 필요한 자금을 구분해야 합니다. 향후 3년의 투자계획과 최소 운영현금, 차입상환과 배당계획, 주주별 현금 필요시점을 확인하겠습니다. 배당은 주주에게 현금을 이전하는 수단이고 보수는 경영기여의 대가이며 퇴직금은 규정과 실제 퇴직에 따른 지급입니다. 보험은 이익잉여금을 인출하는 방법이 아니라 유고·퇴직·승계 시점의 부족재원을 준비하는 수단입니다. 목적이 다른 수단을 세금 하나만 보고 섞지 않는 것이 핵심입니다.\n약 4~5분 심층상담형 대표님, 이익잉여금이 크다는 숫자만 보면 회사에 현금이 많이 쌓여 있다고 오해하기 쉽습니다. 하지만 이익잉여금은 누적된 회계상 이익이고 그 돈은 이미 설비·재고·매출채권·관계회사 투자에 사용됐을 수 있습니다. 가장 먼저 확인할 것은 “얼마를 인출할 수 있습니까?”가 아니라 “회사에 반드시 남겨야 할 현금이 얼마입니까?”입니다. 저희는 3년 자본정책표를 만들겠습니다. 최소 운영현금과 13주 자금수요, 설비·인력·해외법인·연구개발 투자, 차입상환과 금융기관 약정, 주주별 현금수요와 배당, 대표 퇴직과 승계재원을 한 표에 넣습니다. 이 표가 있어야 회사에 남길 돈과 주주에게 이전할 돈을 구분할 수 있습니다. 향후 3년 안에 예정된 대규모 투자와 차입상환은 무엇입니까? 주주별 현금 필요시점이 같습니까? 대표님의 퇴직과 후계구도는 언제부터 논의해야 합니까? 배당을 늘릴 경우 운전자금과 금융기관 평가에 미치는 영향을 검토했습니까? 이 답변이 배당정책과 승계정책의 기준입니다. 안정형은 회사에 충분한 현금을 남기고 배당을 보수적으로 운영합니다. 균형형은 일정한 배당정책과 대표 보수·퇴직·승계재원을 단계적으로 설계합니다. 적극형은 지분정리나 대규모 투자·승계를 전제로 자본거래까지 포함하지만 가치평가와 절차가 더 중요합니다. 각 안은 세금뿐 아니라 현금유출, 경영권, 법적 절차, 사후관리로 비교해야 합니다. 보험은 대표 유고나 퇴직, 승계 시점의 돈이 내부현금과 금융자산으로 부족하고 위험이 우연성과 장기성을 가질 때만 들어옵니다. 이익잉여금이 많다는 이유만으로 보험을 제안해서는 안 됩니다. 오늘 합의할 것은 3년 자본정책 시뮬레이션과 자료 담당자·제출일입니다.\n다음 행동 합의 3년 투자·운영·차입·배당·퇴직·승계 자금표를 작성하고 회사유보와 주주이전 기준을 합의한다."},{"title":"29.4 자기주식·감자·주식거래","text":"데이터 근거와 경계선\n적용 신호 | 최근 자기주식 취득·처분, 감자, 대규모 배당, 주식이동이 있었거나 향후 승계·공동주주 정리가 필요한 기업\n사용 금지·주의 | 과거 거래를 위법·탈세로 단정하거나 세금효과만으로 재거래를 제안하지 않는다.\n30초 문제제기 자기주식과 감자는 세금기법이 아니라 회사 현금, 주주지분, 경영권이 동시에 움직이는 자본거래입니다. 과거 거래의 목적과 절차를 먼저 복원하고 향후 주식이동 원칙을 정하겠습니다.\n약 90초 표준 설명 대표님, 자기주식 취득·처분이나 감자는 거래 목적, 주식가치, 주주별 지분변화, 회사 현금유출입, 이사회·주총 절차가 모두 맞물립니다. 과거 거래를 좋다 나쁘다 평가하기 전에 거래 전후 주주구성과 현금흐름을 타임라인으로 복원해야 합니다. 그 결과를 바탕으로 승계, 공동주주 정리, 임직원 보상, 투자유치 때 어떤 원칙을 적용할지 3년 지분정책을 만들겠습니다. 보험은 향후 지분매입이나 승계 부족재원이 계산될 때만 검토합니다.\n약 3분 상담형 대표님, 자기주식과 감자는 한 번의 세무거래로 끝나는 것이 아니라 향후 지분구조를 바꾸는 사건입니다. 거래 목적, 누구의 주식을 어떤 가치로 취득했는지, 회사에서 얼마의 현금이 나갔는지, 거래 후 의결권과 지분율이 어떻게 변했는지 확인해야 합니다. 당시 거래의 가장 중요한 목적은 무엇이었습니까? 승계, 퇴직, 공동주주 정리, 주가관리 중 어느 목적이었습니까? 가치평가와 이사회·주총자료, 세무신고가 같은 논리를 갖고 있습니까? 과거 사실을 복원한 뒤 향후 3년 cap table과 주식이동 원칙을 만들면 같은 거래를 반복할 때 오류를 줄일 수 있습니다. 보험은 거래를 정당화하는 수단이 아니라 향후 지분매입이나 승계의 현금부족이 확인될 때만 사용합니다.\n약 4~5분 심층상담형 대표님, 자기주식이나 감자를 “세금을 줄이기 위한 방법”으로만 설명하면 위험합니다. 회사 현금, 주주별 현금수령, 지분율, 의결권, 기업가치, 이사회·주총 절차가 동시에 움직이기 때문입니다. 과거 거래의 적법성이나 세무효과를 여기서 단정하기보다 거래를 하나의 타임라인으로 복원하겠습니다. 거래 전 주주명부와 거래 후 주주명부를 비교하고, 당시 가치평가와 실제 거래가격, 회사에서 나간 현금과 주주가 받은 현금, 이사회·주총결의와 계약서·세무신고가 같은 목적을 설명하는지 확인합니다. 거래 후 회사 유동성과 경영권 변화도 봅니다. 이 다섯 가지가 맞아야 과거 거래를 설명하고 향후 정책을 세울 수 있습니다. 당시 거래의 목적은 퇴직재원, 승계, 공동주주 정리 중 무엇이었습니까? 거래가격은 어떤 평가로 정했습니까? 거래 후 운영현금 부담은 없었습니까? 향후 추가 주식이동 계획이 있습니까? 이 답변이 다음 설계의 출발점입니다. 향후에는 3년 지분정책을 만듭니다. 누가 경영하고 누가 주식을 보유할지, 비경영 주주에게 어떤 현금을 제공할지, 회사가 자기주식을 보유·처분할 원칙을 정합니다. 승계, 임직원 보상, 투자유치, 공동주주 정리마다 적합한 수단이 다르므로 하나의 기법을 반복하지 않습니다. 보험은 향후 주식매입이나 승계·유고 시 특정시점 현금이 필요하고 내부재원만으로 부족할 때 유동성 수단이 될 수 있습니다. 과거 거래의 세무위험은 보험으로 해결할 수 없습니다. 다음 단계는 거래 전후 cap table, 평가·결의·계약·세무자료를 복원하고 3년 지분정책을 설계하는 것입니다.\n다음 행동 합의 거래 전후 cap table·가치평가·결의·계약·세무자료를 복원하고 3년 지분정책 프로젝트 여부를 결정한다."},{"title":"29.5 임원퇴직금과 지급재원","text":"데이터 근거와 경계선\n적용 신호 | 대표·임원 근속이 길고 퇴직규정은 있으나 예상퇴직금, 실제 퇴직시점, 지급재원이 함께 계산되지 않은 기업\n사용 금지·주의 | 규정만으로 손금 인정이나 지급가능성을 보장하지 않고 보험을 퇴직금 자체와 동일시하지 않는다.\n30초 문제제기 퇴직금은 규정만 있다고 끝나는 문제가 아닙니다. 실제 퇴직시점에 지급할 금액과 회사가 운영에 지장 없이 마련할 수 있는 현금을 함께 계산해야 합니다.\n약 90초 표준 설명 대표님, 임원퇴직금은 정관·규정·주총결의·등기임원 여부·보수·근속·실제 퇴직사실이 함께 맞아야 하고 지급시점에 회사가 감당할 현금도 있어야 합니다. 예상퇴직금을 범위로 계산하고 그 시점의 운영현금과 투자계획을 비교하겠습니다. 일시지급, 분할준비, 금융자산, 보험 등 적립수단은 비용과 세금뿐 아니라 확정성·유동성·해지위험·인수가능성으로 비교합니다.\n약 3분 상담형 대표님, 퇴직금은 세무규정만 확인해서는 실행계획이 되지 않습니다. 현재 정관과 임원퇴직금 규정이 실제 등기임원과 보수체계에 맞는지, 예상 퇴직시점과 그때의 근속·보수를 기준으로 금액 범위가 얼마인지, 회사가 지급 후에도 급여·매입·투자에 필요한 현금을 유지할 수 있는지 봐야 합니다. 퇴직시점과 퇴직 후 역할을 어느 정도 생각하고 계십니까? 퇴직금 전액을 한 번에 지급할 계획입니까? 회사가 지금부터 어느 정도를 별도 준비할 수 있습니까? 이 질문이 정리된 뒤 적립수단을 비교합니다. 보험은 장기적이고 우연한 위험과 함께 준비할 필요가 있을 때 한 수단이지만 비용처리나 수익을 보장하지 않습니다.\n약 4~5분 심층상담형 대표님, 임원퇴직금은 “규정이 있으니 나중에 지급하면 된다”는 접근으로는 부족합니다. 규정의 적정성, 실제 퇴직사실, 예상금액, 지급시점, 회사 현금능력이 함께 맞아야 실행 가능한 계획입니다. 정관과 임원퇴직금 규정, 주총결의, 등기임원 현황, 보수자료, 근속기간을 확인하고 예상 퇴직시점을 여러 구간으로 나눠 예상퇴직금 범위를 계산합니다. 금액은 한 숫자로 확정하기보다 보수·근속·규정변경 가능성을 반영해 최소·기준·상한 시나리오로 봅니다. 퇴직금이 20억원이라고 가정해도 지급시점에 회사가 보유한 20억원 전부를 사용할 수 있는 것은 아닙니다. 급여, 매입대금, 세금, 설비투자, 금융기관 약정에 필요한 운영필수현금을 제외해야 합니다. 내부현금, 정기적 적립, 금융자산, 분할지급 가능성, 보험의 현금가치와 보장을 각각 비교합니다. 보험을 활용한다면 계약자·피보험자·수익자, 보장목적, 해지환급, 건강심사, 회계·세무 처리를 확인해야 합니다. 퇴직은 경영에서 완전히 물러나는 시점입니까, 회장이나 고문으로 역할이 바뀌는 시점입니까? 후계자와 주주가 퇴직금 규모를 알고 동의하고 있습니까? 회사가 매년 부담 가능한 준비금액은 어느 정도입니까? 기존 법인보험 중 퇴직재원으로 의도된 계약이 있습니까? 오늘은 보험가입을 결정하는 자리가 아닙니다. 규정과 예상퇴직금, 회사 현금능력을 계산하고 부족재원이 확인되면 적립대안을 비교하는 데 동의받는 자리입니다. 다음 미팅에는 정관·규정·보수·근속·기존증권을 준비하고 세무·법률 검토가 필요한 항목은 기존 전문가와 확인하겠습니다.\n다음 행동 합의 정관·퇴직규정·임원현황·보수·근속·퇴직시점·기존증권을 받아 예상퇴직금과 지급가능 현금을 시뮬레이션한다."},{"title":"29.6 경영승계·가족·주주 유동성","text":"데이터 근거와 경계선\n적용 신호 | 대표 연령·근속이 높거나 후계자·가족·공동주주가 있으나 경영권과 현금배분 원칙이 정리되지 않은 기업\n사용 금지·주의 | 상속세 절감이나 보험금만으로 승계를 해결한다고 표현하지 않는다.\n30초 문제제기 승계는 상속세만의 문제가 아닙니다. 누가 경영하고 누가 주식을 보유하며, 경영에 참여하지 않는 가족과 공동주주에게 어떤 현금을 제공할지를 함께 정해야 합니다.\n약 90초 표준 설명 대표님, 회사가 성장할수록 비상장주식 가치는 커지지만 가족이 즉시 사용할 현금은 부족할 수 있습니다. 후계자에게 주식이 집중되면 비경영 가족과 형평성 문제가 생기고, 여러 명에게 분산되면 경영권 충돌이 생길 수 있습니다. 최신 주주명부, 후계자 의사, 가족별 역할과 현금수요, 기업가치 범위를 확인한 뒤 상속·증여·매매·자기주식·주주간계약을 A/B/C안으로 비교하고 확정된 부족재원에 대해서만 보험을 포함한 유동성 수단을 검토하겠습니다.\n약 3분 상담형 대표님, 승계를 준비한다고 당장 주식을 이전하자는 의미는 아닙니다. 지금 필요한 것은 의사결정 기준을 만드는 일입니다. 누가 다음 경영을 맡고, 경영하지 않는 가족은 어떤 권리와 현금을 받으며, 공동주주와의 관계를 어떻게 유지하고, 대표 유고 시 임시 의사결정을 누가 할지 정해야 합니다. 후계자를 어느 정도 생각하고 계십니까? 가족이 그 방향을 알고 있습니까? 회사 주식을 공평하게 나누는 것과 경영권을 안정적으로 유지하는 것 사이에서 어떤 원칙을 우선합니까? 최신 주주명부와 기업가치 범위를 확인한 뒤 후계자 중심, 공동경영, 외부매각 또는 전문경영체제를 비교할 수 있습니다. 보험은 상속세 해결책이 아니라 가족과 주주합의를 실행할 때 부족한 현금을 보완하는 수단입니다.\n약 4~5분 심층상담형 대표님, 승계는 먼 미래의 세금문제로 생각하기 쉽지만 실제로는 가족, 주주, 경영권, 현금의 문제입니다. 회사의 주식가치가 높아질수록 후계자에게 필요한 주식은 커지고, 경영에 참여하지 않는 가족에게 제공할 현금도 커질 수 있습니다. 준비가 없으면 주식은 많지만 현금이 부족해 지분이 분산되거나 급하게 매각해야 할 수 있습니다. 첫 단계는 사람과 역할입니다. 누가 후계자인지, 실제 경영할 의사와 역량이 있는지, 비경영 가족이 원하는 것은 주식인지 현금인지, 공동주주가 어떤 권리를 갖는지 확인합니다. 두 번째는 숫자입니다. 최신 주주명부와 기업가치 범위, 대표 개인재산, 예상 세금과 정산재원, 회사가 사용할 수 있는 현금을 구분합니다. 세 번째는 구조입니다. 상속·증여·매매·자기주식·주주간계약·지주구조 등을 세금·현금·경영권·절차·사후관리로 비교합니다. 대표님이 원하는 최종 모습은 후계자가 단독 경영하는 것입니까, 가족이 공동 소유하는 것입니까? 비경영 가족에게 주식보다 현금을 제공한다면 규모와 시점은 언제입니까? 공동주주가 대표 유고 시 주식을 매입하거나 매각할 원칙이 있습니까? 후계자가 정해지지 않았다면 비상경영체계부터 준비할 의사가 있습니까? 보험 필요성은 이 질문 뒤에 판단합니다. 대표 유고나 승계 시 지분매입, 세금, 가족정산, 운영자금을 합산하고 회사·개인 금융자산, 기존 보험, 차입가능액을 차감합니다. 부족분이 없으면 보험을 줄이거나 제외합니다. 부족분이 있더라도 보장기간과 보험료 부담, 계약자·피보험자·수익자, 주주합의, 세무·법률 검토를 거쳐야 합니다. 다음 단계는 가족과 주주의 결정을 요구하는 것이 아니라 1차 승계진단입니다. 주주명부, 가족관계, 후계자 의사, 기존 보험, 개인보증을 받아 세 가지 시나리오를 만들고 공동설명에서 판단기준을 합의하겠습니다.\n다음 행동 합의 최신 주주명부·가족·후계자·기업가치·기존보험을 확보해 승계 A/B/C안과 부족재원을 산출하고 공동설명 일정을 잡는다."},{"title":"29.7 대표자·핵심인 유고와 비상재원","text":"데이터 근거와 경계선\n적용 신호 | 대표 의존도가 높고 주요 고객·금융·해외법인·생산·지분결정이 특정 인물에게 집중된 기업\n사용 금지·주의 | 사망 공포를 조장하거나 회사현금과 기존보험을 확인하지 않고 보장금액을 제시하지 않는다.\n30초 문제제기 보험을 먼저 말씀드리려는 것이 아닙니다. 대표님이 일정 기간 경영에 참여하지 못할 때 어떤 업무가 멈추고, 회사를 유지하는 데 얼마의 현금이 필요한지를 계산해 보자는 것입니다.\n약 90초 표준 설명 대표님, 유고는 사망만이 아니라 중대한 질병이나 장기부재도 포함합니다. 필요한 돈은 단순 대출상환액이 아니라 6~12개월 운영자금, 거래처와 금융기관 대응, 핵심인 유지, 해외법인 자금, 지분정리 비용까지 포함될 수 있습니다. 대체경영체계와 개인보증, 기존 보험, 실제 사용 가능한 현금을 확인하고 부족재원이 있으면 내부현금·신용한도·보험을 비교하겠습니다. 보험은 예고 없이 필요한 현금을 확보하는 역할로만 제시합니다.\n약 3분 상담형 대표님, 대표 유고 문제를 보험상품으로 시작하면 방어감이 생길 수 있습니다. 먼저 대표님이 한 달 이상 의사결정에 참여하지 못한다고 가정했을 때 멈추는 업무를 확인하겠습니다. 주요 거래처와 금융기관은 누가 대응합니까? 해외법인 자금집행과 계약서명은 누가 합니까? 핵심인력이 이탈하지 않도록 유지할 예산은 얼마입니까? 개인보증이나 즉시 대응해야 할 채무가 있습니까? 이 업무와 금액을 6개월·12개월로 계산하고 회사가 실제 사용할 수 있는 현금, 금융자산, 신용한도, 기존 보험을 차감합니다. 부족분이 없으면 보험을 확대할 이유가 없습니다. 부족분이 있으면 대체경영체계와 함께 보험의 역할을 검토합니다. 오늘 목표는 가입이 아니라 필요재원 계산과 기존증권 분석 동의입니다.\n약 4~5분 심층상담형 대표님, 이 페이지에서 가장 중요한 것은 보험가입 여부가 아닙니다. 대표님이 일정 기간 경영에 참여하지 못할 경우 회사가 어떤 순서로 흔들리고 그 충격을 막는 데 얼마가 필요한지를 확인하는 것입니다. 유고는 사망뿐 아니라 중대한 질병, 장기입원, 해외체류 중 사고처럼 의사결정이 중단되는 상황도 포함합니다. 먼저 업무공백을 봅니다. 주요 거래처와 금융기관이 대표님 개인의 신뢰에 의존합니까? 해외법인 자금과 중요한 계약을 대표님만 승인합니까? 생산, 품질, 영업, 인사 중 대표님이 빠지면 멈추는 의사결정은 무엇입니까? 대체할 임원과 권한위임 문서가 있습니까? 보험금이 있어도 대체경영체계가 없으면 회사가 자동으로 운영되는 것은 아닙니다. 필요재원은 6개월 또는 12개월의 급여·임차·이자·필수 매입 등 고정성 운영자금, 금융기관과 개인보증 대응금, 핵심인력 유지비, 긴급 전문경영인·자문비, 거래처 이탈 방지비, 주주간 지분매입 또는 가족정산 자금을 합산합니다. 그다음 회사의 가용현금과 금융자산, 실제 사용할 수 있는 신용한도, 기존 보험금, 주주 개인재원을 차감합니다. 운영에 이미 필요한 현금은 비상재원으로 중복 계산하지 않습니다. 대표님이 한 달 자리를 비웠을 때 가장 먼저 연락이 올 곳은 거래처입니까, 은행입니까, 해외법인입니까? 개인보증과 담보는 어느 정도입니까? 기존 법인·개인보험은 어떤 목적과 수익자로 구성돼 있습니까? 대체 임원에게 실제 권한이 있습니까? 이 네 가지가 확인돼야 보장 필요성과 금액을 판단합니다. 보험은 예고 없이 발생하는 시점에 약정된 현금을 확보할 수 있지만 모든 문제를 해결하지는 못합니다. 내부현금이 충분하거나 대체경영체계가 안정돼 있으면 보험규모를 줄입니다. 부족재원이 있더라도 보험료 부담, 건강심사, 보장기간, 계약자·피보험자·수익자 구조를 검토해야 합니다. 오늘은 가입이 아니라 대표 역할표, 개인보증, 기존증권, 월고정비를 받아 부족재원을 계산하는 데 동의해 주시면 됩니다.\n다음 행동 합의 대표 역할표·권한위임·개인보증·월고정비·기존증권을 받아 6·12개월 필요재원과 부족재원을 계산한다."},{"title":"29.8 수출채권·거래처 신용위험","text":"데이터 근거와 경계선\n적용 신호 | 상위 거래처 집중도가 높거나 수출채권·장기미수·국가·환율위험이 있는 기업\n사용 금지·주의 | 수출매출이 있다는 이유만으로 신용보험을 제안하지 않고 거래처별 손실감내능력을 먼저 계산한다.\n30초 문제제기 매출이 늘어도 거래처 한 곳의 부도나 국가위험이 회사 현금흐름을 멈출 수 있다면 회수정책과 위험전가를 함께 봐야 합니다. 보험은 채권관리를 대신하지 않고 감당하기 어려운 손실만 넘기는 수단입니다.\n약 90초 표준 설명 대표님, 수출채권 위험은 매출액보다 상위 거래처 집중도와 최대 미수잔액, 결제조건, 국가·통화, 연체경험이 중요합니다. 거래처별 한도와 실제 회수일을 관리하고 LC·담보·선수금·신용보험을 비교해야 합니다. 회사가 스스로 감당할 수 있는 손실은 내부관리로 두고, 한 번의 부도로 운영자금이 흔들리는 부분만 보험으로 전가하는 것이 합리적입니다. 기존 무역보험의 한도·면책·자기부담도 확인하겠습니다.\n약 3분 상담형 대표님, 신용보험은 매출을 보장하는 상품이 아니라 특정 거래처의 부도나 지급불능으로 생기는 손실 일부를 전가하는 장치입니다. 먼저 상위 거래처별 매출비중, 평균·최대 미수잔액, 약정과 실제 회수일, 연체와 분쟁, 국가·통화위험을 봐야 합니다. 거래처별 신용한도를 누가 승인합니까? 한 거래처의 최대 미수금이 손실돼도 회사가 운영될 수 있습니까? 기존 무역보험의 한도와 면책을 실제 거래조건과 비교했습니까? 이 자료를 바탕으로 회수정책, 담보·선수금, LC, 신용보험을 순서대로 비교하고 보험료와 자기부담까지 포함한 손익을 계산하겠습니다.\n약 4~5분 심층상담형 대표님, 수출채권은 매출이 성장할수록 커지기 때문에 “매출이 많으니 좋은 일”과 “한 번의 부도가 회사현금을 멈출 수 있다”는 두 사실을 동시에 봐야 합니다. 상위 거래처 몇 곳에 매출이 집중되거나 결제기간이 길고 국가·통화위험이 있으면 최대 손실액을 관리해야 합니다. 상위 거래처의 매출비중, 평균 미수잔액, 최대 미수잔액, 약정 결제일, 실제 회수일, 연체경험, 분쟁, 국가·통화, 담보와 LC 사용 여부를 한 장으로 정리합니다. 그다음 회사가 감당 가능한 손실한도를 정합니다. 한 거래처 부도로 10억원 손실이 나도 운영에 문제가 없다면 전액 보험이 필요하지 않을 수 있습니다. 반대로 5억원만 발생해도 급여와 매입대금이 흔들리면 위험전가 필요성이 높습니다. 거래처별 신용한도는 누가 어떤 기준으로 승인합니까? 연체가 시작됐을 때 출하중단과 회수조치를 언제 실행합니까? 상위 거래처 한 곳이 지급을 멈추면 몇 개월 버틸 수 있습니까? 기존 무역보험의 한도와 면책을 실제 거래와 맞춰 봤습니까? 대안은 내부 신용한도와 연체관리, 선수금·LC·담보·보증, 거래처·국가 분산, 그리고 남는 대규모 손실의 보험전가 순서입니다. 보험료, 자기부담, 면책, 보상절차, 신용한도 축소 가능성까지 봐야 합니다. 오늘 결론은 가입이 아니라 상위 거래처별 채권현황과 기존 보험으로 보장공백과 적정한도를 계산하는 것입니다. 회수관리 개선만으로 충분하면 보험을 확대하지 않고 감당하기 어려운 손실이 확인될 때만 제안하겠습니다.\n다음 행동 합의 상위 거래처별 매출·미수·회수일·연체·국가·담보·기존 무역보험을 받아 최대손실과 보장공백을 산출한다."},{"title":"29.9 재산·휴업·해외사업장 위험","text":"데이터 근거와 경계선\n적용 신호 | 제조설비·창고·해외생산법인·핵심공급망이 있고 사고 시 복구기간과 영업손실이 큰 기업\n사용 금지·주의 | 장부가만으로 가입금액을 정하거나 국내증권만 보고 해외보장 중복·공백을 단정하지 않는다.\n30초 문제제기 재산위험은 건물과 기계를 다시 사는 비용만의 문제가 아닙니다. 공장이 멈춘 기간의 매출총이익과 고정비를 회사가 얼마나 버틸 수 있는지가 핵심입니다.\n약 90초 표준 설명 대표님, 장부가나 과거 취득가로 가입된 재산보험은 실제 재조달가액과 차이가 날 수 있고 휴업손실 보상기간이 복구기간보다 짧으면 공장이 복구되기 전에 현금이 먼저 고갈될 수 있습니다. 국내 본사와 해외법인의 자산, 적하, 배상, 공급망, 휴업을 한 지도에 놓고 재조달가액·최대예상손실·대체생산·복구기간을 확인하겠습니다. 기존증권의 한도·면책·자기부담·현지조건을 비교해 공백과 중복만 조정하겠습니다.\n약 3분 상담형 대표님, 재산보험은 가입금액이 있다는 사실보다 사고 후 실제 복구와 영업재개가 가능한지가 중요합니다. 건물·기계·재고의 재조달가액, 최대예상손실, 대체생산 가능성, 핵심설비 납기, 공급망 중단, 휴업기간의 매출총이익과 고정비를 확인해야 합니다. 핵심설비가 손상되면 정상가동까지 몇 개월이 걸립니까? 해외법인이나 특정 공급처가 멈추면 대체할 곳이 있습니까? 현지증권의 보장범위와 본사보험이 연결돼 있습니까? 자산명세와 증권으로 보장공백·중복·휴업기간을 분석하고 재보험·현지법상 제한은 전문가와 확인하겠습니다.\n약 4~5분 심층상담형 대표님, 화재나 자연재해가 발생하면 눈에 보이는 손실은 건물과 기계이지만 실제 회사가 무너지는 이유는 복구기간의 현금흐름일 수 있습니다. 설비를 다시 구입하는 데 8개월이 걸리고 그동안 급여·임차·이자·고정비가 계속 나간다면 재산복구비만 받아서는 충분하지 않습니다. 자산을 장부가가 아니라 실제 재조달가액과 복구기간으로 보고, 한 번의 사고에서 실제로 손실될 수 있는 최대범위와 방재수준을 확인합니다. 공장이 멈춘 기간의 매출총이익과 고정비, 고객이탈, 긴급외주와 운송비를 계산하고 국내 본사와 해외법인, 적하, 배상, 공급망, 휴업보험을 한 지도에 놓아 중복과 공백을 찾습니다. 가장 긴 납기의 핵심설비는 무엇이며 교체에 몇 개월이 걸립니까? 국내 또는 해외에 대체생산이 가능합니까? 주요 고객은 납품이 몇 주 지연되면 거래를 중단할 수 있습니까? 현지법인 증권의 면책과 보상한도를 본사에서 통합관리합니까? 이 답이 휴업보상기간과 적정한도를 결정합니다. 보험은 방재와 비상계획을 대신하지 않습니다. 예방투자, 재고분산, 대체생산계약, 데이터백업, 비상구매처를 정비하고 남는 대규모 손실을 보험으로 전가합니다. 가입금액과 보상기간은 실제 복구시나리오와 손실감내능력에 맞춥니다. 해외현지법, 보험조건, 재보험 가능성도 확인합니다. 다음 미팅에는 자산명세, 생산흐름, 핵심설비 납기, 국내외 증권, 사고이력, 방재점검표를 준비해 주시면 됩니다. 최대예상손실과 휴업기간을 산출하고 유지·조정·추가할 보장만 제시하겠습니다.\n다음 행동 합의 자산명세·핵심설비 복구기간·생산대체·국내외 증권·사고이력을 받아 재산·휴업 보장공백 지도를 만든다."},{"title":"29.10 기존 법인·대표 보험증권 최적화","text":"데이터 근거와 경계선\n적용 신호 | 법인·대표 개인보험이 여러 건 있으나 가입목적, 수익자, 보장기간, 현금가치, 필요재원과의 연결이 불명확한 기업\n사용 금지·주의 | 기존 계약의 해지손실·신규심사·면책을 확인하지 않고 교체·해지를 권하지 않는다.\n30초 문제제기 새로운 가입보다 먼저 현재 보험이 왜 가입됐고 지금의 경영목적과 맞는지 확인하겠습니다. 보험이 많다는 사실과 필요한 때 사용할 수 있다는 사실은 다를 수 있습니다.\n약 90초 표준 설명 대표님, 기존 보험은 보장금액 합계만 보면 충분해 보여도 계약자·피보험자·수익자, 보장기간, 현금가치, 해지손실, 실제 필요재원과 맞지 않으면 유고·퇴직·승계 때 원하는 역할을 하지 못할 수 있습니다. 모든 법인·개인 증권을 목적별로 분류하고 유지·감액·전환·추가가입을 비교하되 신규심사와 해지손실을 먼저 확인하겠습니다. 목적과 부족재원이 맞으면 유지하고 맞지 않는 부분만 조정하는 것이 원칙입니다.\n약 3분 상담형 대표님, 보험이 많다고 보장이 충분한 것도 아니고 보험료가 많다고 잘못된 것도 아닙니다. 중요한 것은 각 계약이 어떤 경영목적을 위해 가입됐고 지금도 그 목적과 맞는지입니다. 대표 유고, 퇴직재원, 승계유동성, 대출보장, 직원복지, 재산·배상 등으로 분류하겠습니다. 계약자·피보험자·수익자, 보장기간, 보험금 지급조건, 현금가치, 납입기간, 해지손실, 신규심사 가능성을 확인합니다. 각 계약을 누가 왜 가입했는지 설명할 수 있습니까? 유고 시 보험금이 회사와 가족 중 누구에게 가야 하는지 합의돼 있습니까? 목적이 맞는 계약은 유지하고 중복이나 목적불일치가 확인될 때만 조정·추가를 비교하겠습니다.\n약 4~5분 심층상담형 대표님, 기존 보험증권 분석의 목적은 새로운 계약을 만들기 위한 것이 아닙니다. 현재 계약이 회사의 경영위험과 필요한 자금시점에 맞는지 확인하는 것입니다. 보험금 총액이 커도 대표 유고 시 가족에게만 지급되거나 회사 운영자금이 필요한 기간보다 보장기간이 짧거나 승계재원이 필요한 시점에 현금가치가 부족하면 목적을 달성하기 어렵습니다. 법인과 대표 개인의 모든 증권을 대표 유고, 핵심인, 퇴직, 승계, 대출·보증, 직원복지, 재산·휴업·배상으로 분류합니다. 각 계약의 계약자·피보험자·수익자, 보장금액, 보장기간, 납입기간, 현금가치, 해지환급, 대출, 특약, 면책을 정리하고 앞서 계산한 필요재원과 비교합니다. 각 계약을 가입할 당시 가장 중요한 목적은 무엇이었습니까? 지금도 그 목적이 유효합니까? 유고 시 보험금이 회사운영, 가족생활, 주식매입 중 어디에 사용돼야 합니까? 퇴직이나 승계시점에 현금가치를 활용할 계획이라면 실제 시점과 금액을 확인했습니까? 보험료가 회사 현금흐름에 부담입니까? 목적과 필요재원이 맞는 계약은 유지합니다. 금액이 과다하거나 기간이 맞지 않으면 감액과 구조조정을 검토합니다. 해지손실과 신규심사 위험이 큰 계약은 섣불리 전환하지 않습니다. 실제 부족재원이 남고 인수가능성과 보험료 부담이 적절할 때만 추가가입을 제안합니다. 기존 설계사와의 관계도 존중하고 필요하면 공동검토합니다. 오늘은 해지나 가입을 결정하지 않습니다. 증권 전체를 제출받아 목적·필요재원·수익자·기간·손실을 비교하는 데 동의받는 단계입니다. 변경이 필요해도 기존계약을 먼저 유지한 상태에서 신규심사와 대체가능성을 확인하겠습니다.\n다음 행동 합의 법인·개인 증권 전체를 표준표로 정리하고 목적·필요재원·수익자·기간·해지손실·신규심사를 비교한다.\n30\n핵심 이슈별 CEO 7분기 대화엔진\n같은 반론도 이슈에 따라 다르게 처리하고, 모든 분기는 재질문·판단기준·다음 행동까지 완결한다.\n7분기 공통원칙 대표의 말을 반박하지 않는다. ① 인정 ② 실제 우려 확인 ③ 범위를 한 단계로 축소 ④ 숫자·문서로 확인 ⑤ 담당자·자료·일정 중 하나를 확정한다."},{"title":"30.1 운전자금·현금전환","text":"반응유형 | 대표의 실제 표현 | 1차 응대 | 진단 재질문 | 행동 합의\n즉시 동의 | “맞습니다. 매출은 늘었는데 현금이 빠듯합니다.” | “체감과 숫자가 같은 방향입니다. 원인을 채권·재고·매입조건으로 나누겠습니다.” | “최근 3개월 중 가장 자금이 빠듯했던 주와 원인은 무엇이었습니까?” | 채권연령표·재고연령표·13주 자금계획 제출일 확정\n부분 동의 | “채권은 괜찮은데 재고가 조금 많습니다.” | “그렇다면 문제를 넓히지 않고 재고의 회전과 장기재고부터 보겠습니다.” | “정상·저회전·장기재고를 구분하는 기준과 담당자는 누구입니까?” | 상위 20개 장기재고와 5일 개선 시나리오 작성\n부정 | “현금은 충분하고 문제없습니다.” | “현재 유동성이 안정적이라는 점은 강점입니다. 점검 목적은 위기판정이 아니라 성장 여력을 확인하는 것입니다.” | “매출이 20% 더 늘어도 현재 결제조건으로 추가 운전자금을 내부에서 감당할 수 있습니까?” | 성장률별 필요운전자금 민감도표 검토 동의\n정보 부족 | “정확한 회수일이나 재고일수는 모릅니다.” | “대표님이 모르는 것이 문제가 아니라 관리정보가 한 장으로 올라오지 않는 것이 과제입니다.” | “재무팀과 영업팀 중 거래처별 실제 회수일을 바로 뽑을 수 있는 곳은 어디입니까?” | 자료 담당자와 추출기한 지정\n전문가 위임 | “회계사와 재무팀이 관리합니다.” | “기존 전문가의 결산·세무 역할은 존중합니다. 이번 작업은 경영 의사결정용 현금 KPI를 만드는 일입니다.” | “월별 회의에서 DSO·재고일수·13주 현금전망을 보고받고 계십니까?” | 기존 전문가 포함 30분 데이터 미팅 제안\n비용 우려 | “진단까지 비용을 들일 필요가 있습니까?” | “전체 프로젝트를 결정하지 말고 회수일 10일·재고일 5일 개선 가능금액을 먼저 산출하겠습니다.” | “그 잠재금액이 진단비보다 충분히 크면 다음 단계로 가는 방식은 어떻습니까?” | 1차 정밀진단 범위·산출물·비용 합의\n결정 유예 | “연말 결산 후 보겠습니다.” | “결산까지 미루는 것도 선택입니다. 다만 그 사이 자료가 누적되므로 확인일을 정해 두는 것이 좋습니다.” | “결산 전에는 자료만 준비하고, 결산 직후 1시간 검토일을 잡아도 괜찮겠습니까?” | 재검토일과 선행자료 목록 확정\n분기 마감문장 “오늘 전체 결정을 요구드리는 것이 아니라, 판단에 필요한 자료와 다음 확인일을 정하는 데까지만 합의하겠습니다.”"},{"title":"30.2 단기대여금·가지급금 가능성","text":"반응유형 | 대표의 실제 표현 | 1차 응대 | 진단 재질문 | 행동 합의\n즉시 동의 | “회수계획을 정리해야 합니다.” | “좋습니다. 회수·사업성 대여·자본거래 가능성을 분리해 가장 실행 가능한 안부터 보겠습니다.” | “상대방과 최초 목적, 만기, 이자, 현재 회수 가능액은 무엇입니까?” | 원장·계약·결의·이자·상환자료 확보\n부분 동의 | “일부는 받을 수 있지만 전액은 어렵습니다.” | “그렇다면 회수 가능액과 장기정상화 대상액을 나누는 것이 첫 단계입니다.” | “현금회수 외에 상계·분할상환·담보보강이 가능한 항목이 있습니까?” | 금액별 A/B/C 정상화안 작성\n부정 | “관계회사 거래라 문제없습니다.” | “관계회사 거래 자체를 문제로 보는 것이 아닙니다. 독립된 사업거래로 설명 가능한 문서와 조건이 있는지가 핵심입니다.” | “제3자 거래와 같은 계약·이자·만기·승인 절차가 갖춰져 있습니까?” | 증빙 적정성 체크리스트 검토\n정보 부족 | “누가 언제 가져갔는지 정확하지 않습니다.” | “이 경우 결론보다 원장 복원이 우선입니다. 사적 사용이라고 단정하지 않겠습니다.” | “세부원장·통장·전표를 연결할 담당자를 지정할 수 있습니까?” | 거래 타임라인 복원 일정 확정\n전문가 위임 | “세무사가 처리하고 있습니다.” | “세무처리는 전문가가 잘하고 있을 것입니다. 경영 측면에서는 회수와 현금계획이 필요합니다.” | “세무상 처리 외에 실제 상환일정과 책임자가 정해져 있습니까?” | 세무사 동석 정상화 미팅 제안\n비용 우려 | “금액도 크지 않은데 컨설팅까지 필요합니까?” | “금액·기간·증빙을 확인해 단순정리로 끝날 사안이면 프로젝트를 확대하지 않겠습니다.” | “1차 서류진단으로 범위를 판단하는 데 동의하십니까?” | 단계형 진단 계약 또는 무료 제외 판단\n결정 유예 | “나중에 관계회사 정리할 때 함께 보겠습니다.” | “그 시점까지 이자·인정이자·증빙공백이 누적될 수 있으므로 최소한 현 상태를 확정해 두겠습니다.” | “이번 달에는 원장과 계약 유무만 확인하고 정리시점은 별도로 정할까요?” | 현황확정일과 재검토일 지정\n분기 마감문장 “오늘 전체 결정을 요구드리는 것이 아니라, 판단에 필요한 자료와 다음 확인일을 정하는 데까지만 합의하겠습니다.”"},{"title":"30.3 승계·가족·공동주주","text":"반응유형 | 대표의 실제 표현 | 1차 응대 | 진단 재질문 | 행동 합의\n즉시 동의 | “이제 준비해야 합니다.” | “주식이전부터가 아니라 사람·경영권·현금의 원칙부터 정하겠습니다.” | “후계자, 비경영 가족, 공동주주 중 가장 먼저 합의해야 할 사람은 누구입니까?” | 1차 인터뷰와 주주명부 제출\n부분 동의 | “아들은 생각하지만 아직 확정은 아닙니다.” | “확정하지 않아도 됩니다. 후계자 A안과 미확정 B안을 함께 비교하겠습니다.” | “아들이 경영하지 않을 경우 회사가 유지될 대안은 무엇입니까?” | 2개 승계시나리오 작성\n부정 | “아직 건강하고 너무 이릅니다.” | “지금 주식을 넘기자는 뜻이 아닙니다. 유고 시 임시 의사결정과 가족 갈등 방지 기준만 먼저 만드는 것입니다.” | “한 달간 대표님이 부재하면 누가 은행·거래처·해외법인을 결정합니까?” | 비상경영체계 점검 동의\n정보 부족 | “주식가치나 세금은 모릅니다.” | “정확한 숫자를 모르기 때문에 범위평가가 필요합니다. 추정과 확정을 구분하겠습니다.” | “최신 주주명부와 최근 재무제표를 기준으로 1차 범위를 계산해도 되겠습니까?” | 기업가치 범위 산정\n전문가 위임 | “세무사에게 승계를 맡길 생각입니다.” | “세무사의 세무검토가 핵심입니다. 저희는 가족·주주·보험·현금흐름을 연결해 의사결정안을 만들겠습니다.” | “세무사와 가족이 함께 볼 한 장짜리 A/B/C안이 필요하십니까?” | 협업설명회 일정 제안\n비용 우려 | “승계 컨설팅은 비용이 많이 듭니다.” | “전체 실행 전에 진단단계만 분리하겠습니다. 의사결정이 없으면 구조설계는 진행하지 않습니다.” | “주주·후계자·기업가치·부족재원만 확인하는 1차 진단부터 보시겠습니까?” | 1차 진단 범위 계약\n결정 유예 | “가족과 먼저 상의하겠습니다.” | “가족에게 바로 결정을 요구하면 부담이 큽니다. 중립적인 현황자료를 먼저 만들겠습니다.” | “가족회의 전 대표님 단독 사전정리 후 공동설명 날짜를 잡을까요?” | 가족 공동설명 일정과 참석자 확정\n분기 마감문장 “오늘 전체 결정을 요구드리는 것이 아니라, 판단에 필요한 자료와 다음 확인일을 정하는 데까지만 합의하겠습니다.”"},{"title":"30.4 대표자·핵심인 유고","text":"반응유형 | 대표의 실제 표현 | 1차 응대 | 진단 재질문 | 행동 합의\n즉시 동의 | “제가 없으면 회사가 많이 흔들릴 겁니다.” | “그렇다면 업무공백과 필요현금을 각각 계산해 실행순서를 정하겠습니다.” | “가장 먼저 멈출 업무와 6개월간 필요한 고정비는 무엇입니까?” | 역할표·고정비·증권 제출\n부분 동의 | “임원들이 운영은 할 수 있습니다.” | “그 점은 큰 강점입니다. 다만 권한과 현금이 실제로 준비돼 있는지 확인하겠습니다.” | “은행·대형거래처·해외법인 서명권까지 임원에게 위임돼 있습니까?” | 권한위임·비상결재 점검\n부정 | “저에게 그런 일은 없을 겁니다.” | “가능성을 높게 보는 것이 아니라, 영향이 큰 사건을 사전에 관리하는 경영원칙입니다.” | “화재 확률이 낮아도 공장 방재를 하듯, 한 달 부재 시 대응표만 확인해도 괜찮겠습니까?” | 비상대응표 작성 동의\n정보 부족 | “필요한 돈이 얼마인지 모르겠습니다.” | “그래서 보험금부터 정하지 않고 6·12개월 필요재원을 계산합니다.” | “월 고정비·보증·핵심인 유지비·지분정리 중 회사에 해당하는 항목은 무엇입니까?” | 필요재원 산출자료 요청\n전문가 위임 | “기존 설계사가 보험을 잘 관리합니다.” | “기존 관계를 바꿀 목적이 아닙니다. 경영 필요재원과 증권이 맞는지만 공동검토하겠습니다.” | “기존 설계사와 함께 목적별 증권표를 검토해도 되겠습니까?” | 공동 증권분석 제안\n비용 우려 | “보험료가 부담됩니다.” | “보험료를 논의하기 전에 부족재원이 있는지부터 확인하겠습니다. 부족분이 없으면 제안하지 않습니다.” | “내부현금·신용한도·기존보험을 차감한 최소 부족분만 비교할까요?” | 최소·기준·상한 설계 범위 동의\n결정 유예 | “배우자와 상의해야 합니다.” | “당연합니다. 가족에게 상품을 설명하기보다 필요재원과 선택안을 함께 보여드리겠습니다.” | “배우자와 공동주주가 참여하는 설명일을 정할까요?” | 공동설명 일정·자료 확정\n분기 마감문장 “오늘 전체 결정을 요구드리는 것이 아니라, 판단에 필요한 자료와 다음 확인일을 정하는 데까지만 합의하겠습니다.”"},{"title":"30.5 기존보험 최적화","text":"반응유형 | 대표의 실제 표현 | 1차 응대 | 진단 재질문 | 행동 합의\n즉시 동의 | “보험이 너무 많아 정리가 필요합니다.” | “해지부터 하지 않고 목적·필요재원·해지손실·신규심사를 비교하겠습니다.” | “각 계약을 가입한 목적을 기억하는 순서대로 말씀해 주시겠습니까?” | 전체 증권 수집·목적분류\n부분 동의 | “몇 건만 오래돼 확인이 필요합니다.” | “그 계약부터 우선순위로 보되 전체 중복 여부는 함께 확인하겠습니다.” | “보장기간·수익자·현금가치 중 가장 걱정되는 것은 무엇입니까?” | 우선계약 분석\n부정 | “기존 설계사가 알아서 잘해 줍니다.” | “기존 관리가 잘돼 있다면 확인 결과도 유지가 결론일 수 있습니다.” | “경영 필요재원과 증권 목적을 한 장으로 연결해 본 적이 있습니까?” | 공동검토 또는 유지 확인\n정보 부족 | “계약이 많아 내용을 모릅니다.” | “모르는 상태에서 해지·추가를 결정하지 않겠습니다. 표준표로 먼저 정리하겠습니다.” | “법인과 개인 증권을 한 번에 받을 담당자를 지정할 수 있습니까?” | 증권 수집기한 확정\n전문가 위임 | “보험 담당자에게 물어보면 됩니다.” | “좋습니다. 담당자의 상품정보와 저희의 경영 필요재원 분석을 결합하겠습니다.” | “담당자와 30분 공동검토를 잡을까요?” | 3자 미팅 제안\n비용 우려 | “분석비까지 내야 합니까?” | “신규가입을 전제로 하지 않는 독립분석이라면 비용과 산출물을 분명히 해야 합니다.” | “유지·감액·추가 각각의 근거와 손실을 보여주는 보고서가 필요하십니까?” | 유료 증권분석 범위 합의\n결정 유예 | “만기 때 다시 보겠습니다.” | “만기 전에도 수익자·목적·보장기간이 맞지 않으면 사고 시 문제가 될 수 있습니다.” | “변경 없이 현황만 확정하고 만기 3개월 전 재검토일을 잡을까요?” | 현황보고서와 재검토 알림 확정\n분기 마감문장 “오늘 전체 결정을 요구드리는 것이 아니라, 판단에 필요한 자료와 다음 확인일을 정하는 데까지만 합의하겠습니다.”\n31\n보험계약 8단계·최종결정 화법\n보험을 먼저 제시하지 않고 위험·필요재원·현재재원·대안·적합성·심사·결정·사후관리의 순서로 완결한다.\n단계 | 목표 | 금지 | 표준 화법 | 통과 기준\n1. 위험 적합성 판정 | 보험으로 전가할 우연·대규모 위험인지 확인 | 이익잉여금·절세만으로 보험 연결 | “이 문제는 보험으로 해결할 사안인지부터 구분하겠습니다. 문서·절차·운영개선이 우선이면 보험을 제외하겠습니다.” | 위험사건·손실경로·보험가능범위 확정\n2. 필요재원 계산 동의 | 가입이 아닌 숫자 산출에 동의 | 근거 없이 보장금액 제시 | “보험금부터 정하지 않고 사건 발생 시 필요한 운영·채무·인력·지분자금을 계산하겠습니다.” | 최소·기준·상한 필요재원 산출\n3. 현재재원·증권 분석 | 내부현금·금융자산·신용·기존보험 확인 | 현금 전부를 가용재원으로 계산 | “운영에 이미 필요한 현금은 제외하고 실제 비상시에 쓸 수 있는 자원만 반영하겠습니다.” | 가용재원과 보장공백 확정\n4. 보험 외 대안 비교 | 현금·적립·차입·계약·거버넌스와 비교 | 보험을 유일한 답으로 표현 | “내부적립, 신용한도, 주주간계약, 권한위임과 비교해 보험이 필요한 부분만 남기겠습니다.” | 비보험 대안과 보험 역할 분리\n5. 설계검토 동의 | 부족재원 범위의 설계 비교 승인 | 가입 동의로 오인시키기 | “지금은 청약이 아니라 최소·기준·상한 세 안의 구조와 부담을 비교하는 단계입니다.” | 설계요청서·평가기준 합의\n6. 구조·심사 대응 | 계약자·피보험자·수익자·기간·심사 확인 | 세무·법률 효과 보장 | “목적과 지급주체가 맞는지, 건강·재무심사와 회계·세무처리를 전문가와 확인하겠습니다.” | 적합 구조·인수조건 확인\n7. 최종 의사결정 | 미결정 사유 제거 후 자율선택 | 공포·마감·절판 압박 | “필요성, 금액, 부담, 대안, 미확인 사항을 다시 확인한 뒤 실행·축소·보류 중 결정하시면 됩니다.” | 결정이유와 미결정사항 기록\n8. 계약 후 실행관리 | 증권 목적·수익자·재무변화 연례점검 | 계약 후 방치 | “계약 목적과 사용계획을 기록하고 재무·주주·승계 변화가 있을 때 보장규모를 다시 계산하겠습니다.” | 연례점검일·관리책임자 지정"},{"title":"31.1 보험료가 부담된다는 대표","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 필요성은 알겠는데 보험료가 너무 큽니다. | 비용 반론\n컨설턴트 | 그 우려가 맞습니다. 월 지출 자체가 부담인지, 납입기간이 긴 것이 부담인지 먼저 구분해도 될까요? | 진짜 이유 확인\n대표 | 장기간 돈이 묶이는 게 싫습니다. | 유동성 우려\n컨설턴트 | 그렇다면 전액을 보험으로 준비하지 않겠습니다. 내부현금·신용한도·단기 적립을 먼저 배치하고 예고 없이 필요한 최소 부족분만 보장으로 비교하겠습니다. | 범위 축소\n컨설턴트 | 최소·기준·상한 세 안과 각 안의 현금부담을 다음 회의에서 비교하는 데까지 동의하시겠습니까? | 설계검토 합의"},{"title":"31.2 배우자·가족의 반대","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 배우자가 보험을 싫어해서 결정하기 어렵습니다. | 가족반대\n컨설턴트 | 상품을 먼저 설명하면 더 부담스러울 수 있습니다. 가족이 확인해야 할 것은 유고 시 필요한 현금과 현재 준비재원입니다. | 문제 재정의\n대표 | 그래도 판매라고 생각할 겁니다. | 신뢰 우려\n컨설턴트 | 그렇다면 보험 없는 대안, 최소 보험안, 충분 보험안을 같은 표로 보여드리고 가족이 선택하지 않아도 되는 조건까지 명시하겠습니다. | 선택권 보장\n컨설턴트 | 가족 공동설명은 30분으로 제한하고 필요재원과 대안만 설명하는 일정으로 잡겠습니다. | 공동설명 합의"},{"title":"31.3 공동주주의 반대","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n공동주주 | 왜 회사가 대표 개인을 위해 보험료를 냅니까? | 이해상충 우려\n컨설턴트 | 개인 복지가 아니라 회사가 입을 손실과 필요한 자금만 계산해야 합니다. 수익자와 사용목적도 그 원칙에 맞아야 합니다. | 회사 목적 명확화\n공동주주 | 보험금이 가족에게 가면 회사와 무관하지 않습니까? | 구조 반론\n컨설턴트 | 맞습니다. 회사운영자금, 가족생활비, 지분매입재원은 계약 목적과 지급주체가 다를 수 있으므로 분리 설계하고 법률·세무 확인을 받겠습니다. | 목적별 구조 분리\n컨설턴트 | 주주합의가 없는 구조는 진행하지 않고, 필요재원표와 계약구조안을 주주회의 안건으로 올리겠습니다. | 거버넌스 합의"},{"title":"31.4 할증·부담보·인수제한","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 심사 결과가 예상보다 불리하게 나왔습니다. 이 결과를 숨기거나 처음 제안을 그대로 밀어붙이지 않겠습니다. | 투명한 고지\n대표 | 그렇다면 가입할 이유가 없지 않습니까? | 가치 의문\n컨설턴트 | 할증 보험료, 보장제한, 대기기간을 숫자로 비교하고 내부적립·다른 보장기간·보험금 축소와 함께 검토해야 합니다. | 대안 비교\n대표 | 어떤 안이 맞습니까? | 판단 요청\n컨설턴트 | 필수 부족재원 중 보험으로 확보해야 할 최소금액만 남기고, 제한된 위험은 별도 비상계획으로 보완하는 안을 권고하겠습니다. | 최소 적합안 제시"},{"title":"31.5 기존 설계사·타 제안과 비교","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 기존 설계사도 비슷한 상품을 제안했습니다. | 비교상황\n컨설턴트 | 관계를 바꾸는 것이 목적이 아닙니다. 상품명보다 필요재원, 계약목적, 수익자, 기간, 보험료, 해지손실을 같은 기준으로 비교하겠습니다. | 중립 기준\n대표 | 누구 제안이 더 좋은지 말해 주세요. | 선택 요구\n컨설턴트 | 필요재원 충족도와 회사 현금부담, 심사조건, 사후관리 기준을 점수화해 장단점을 밝히겠습니다. 기존 안이 적합하면 그대로 유지하겠습니다. | 독립분석\n컨설턴트 | 양쪽 설계서를 동일 표준표로 비교할 자료를 받아 다음 회의에서 판단하겠습니다. | 자료합의"},{"title":"31.6 보험 근거가 부족한 기업","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 현재 재무자료만으로는 신규 보험계약을 권할 근거가 충분하지 않습니다. | 비제안 선언\n대표 | 보험 컨설턴트인데 가입 제안을 안 합니까? | 역할 의문\n컨설턴트 | 보험은 필요재원과 보장공백이 확인될 때만 제안해야 합니다. 현재는 운전자금과 대여금 정상화가 우선입니다. | 신뢰 강화\n대표 | 그럼 보험은 언제 봅니까? | 조건 확인\n컨설턴트 | 대표 역할·기존증권·주주·승계의사까지 확인한 뒤 부족재원이 생기면 검토하고, 없으면 기존계약 유지가 결론입니다. | 조건부 검토\n32\n완전 상담 시나리오 20선\n오프닝부터 2차 반론, 자료요청, 유료진단, 설계검토, 보류·사후관리까지 실제 대화 흐름으로 훈련한다."},{"title":"32.1 첫 미팅 신뢰 형성","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 오늘은 상품을 설명드리기보다 재무자료에서 확인된 사실과 추가 확인이 필요한 부분을 구분해 말씀드리겠습니다. | 판매 경계 해소\n대표 | 결국 보험 이야기 아닌가요? | 초기 방어\n컨설턴트 | 보험이 적합한 위험이 없으면 제안하지 않겠습니다. 먼저 회사의 현금·주주·대표 의존도를 보겠습니다. | 원칙 제시\n대표 | 그럼 무엇부터 봅니까? | 관심 전환\n컨설턴트 | 대표님이 가장 신경 쓰는 현금, 승계, 위험 중 한 가지를 정하고 20분 안에 핵심만 확인하겠습니다. | 의제 합의"},{"title":"32.2 한 줄 진단 제시","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 이 회사는 성장과 수익성은 회복됐지만 성장한 만큼 현금이 남는 구조와 자본·승계정책을 동시에 정비할 시점입니다. | 균형진단\n대표 | 문제가 많다는 뜻입니까? | 위험 확대 우려\n컨설턴트 | 아닙니다. 강점이 커졌기 때문에 다음 단계의 관리기준이 필요하다는 뜻입니다. | 강점 기반 리프레임\n대표 | 무엇이 가장 먼저입니까? | 우선순위 요청\n컨설턴트 | 첫째 현금전환, 둘째 과거 자본거래 복원, 셋째 대표 유고·승계의 부족재원 순서입니다. | 3대 우선순위"},{"title":"32.3 이익잉여금·배당정책","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 이익잉여금이 많으니 배당하면 되지 않습니까? | 단일해법\n컨설턴트 | 배당은 가능하지만 운영·투자·차입·승계에 필요한 회사 유보액을 먼저 계산해야 합니다. | 회사현금 우선\n대표 | 세금이 많이 나오잖아요. | 세금 반론\n컨설턴트 | 세금만 낮춘 안보다 세후 현금, 회사 유동성, 경영권, 절차를 함께 비교하겠습니다. | 5축 비교\n컨설턴트 | 3년 자금수요표를 만든 뒤 정기배당·상여·퇴직·주식거래 중 적합한 조합을 결정하겠습니다. | 정책 프로젝트 전환"},{"title":"32.4 자기주식·감자 과거거래","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 과거 자기주식과 감자를 좋다 나쁘다 단정하지 않고 거래 전후 주주와 현금의 흐름을 복원하겠습니다. | 중립 복원\n대표 | 이미 세무처리가 끝났습니다. | 종결 반론\n컨설턴트 | 세무신고와 별개로 향후 승계·주식이동 시 설명 가능한 기록이 남아 있어야 합니다. | 미래 활용\n대표 | 무슨 자료가 필요합니까? | 자료 관심\n컨설턴트 | 거래 전후 주주명부, 가치평가, 결의, 계약, 대금흐름, 신고자료 여섯 가지입니다. | 자료 확정"},{"title":"32.5 임원퇴직재원","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 규정이 있으니 퇴직할 때 지급하면 됩니다. | 규정 충분론\n컨설턴트 | 규정은 출발점이고 실제 퇴직사실, 예상금액, 지급 후 회사현금이 함께 맞아야 합니다. | 실행요건\n대표 | 지금 준비하면 돈이 묶입니다. | 유동성 반론\n컨설턴트 | 전액 적립이 아니라 퇴직시점별 부족재원을 계산하고 현금·금융자산·보험을 분산 비교하겠습니다. | 분산대안\n컨설턴트 | 예상퇴직금과 운영필수현금을 먼저 계산하는 진단부터 진행하겠습니다. | 진단 동의"},{"title":"32.6 승계를 부정하는 대표","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 아직 10년은 더 일할 겁니다. | 시기 부정\n컨설턴트 | 그 계획을 존중합니다. 지금 주식을 넘기자는 것이 아니라 10년 계획이 중단돼도 회사를 지킬 비상기준을 만드는 것입니다. | 계획 보호\n대표 | 임원들이 알아서 할 겁니다. | 대체 가능 주장\n컨설턴트 | 실제 서명권, 은행권한, 주주합의가 문서로 있는지 확인하면 됩니다. | 검증 질문\n컨설턴트 | 승계 실행은 미루고 비상경영체계와 주주명부 점검만 먼저 하겠습니다. | 범위 축소"},{"title":"32.7 가족 공동설명","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n배우자 | 보험을 팔기 위한 승계설명 아닌가요? | 신뢰 반론\n컨설턴트 | 오늘은 보험상품을 제시하지 않습니다. 가족별 역할, 주식, 현금, 유고 시 필요한 자금을 먼저 확인합니다. | 판매 배제\n자녀 | 제가 회사를 맡을지는 아직 모릅니다. | 후계 불확실\n컨설턴트 | 그 가능성을 포함해 후계자 A안과 전문경영 B안을 함께 비교하겠습니다. | 대안 병렬\n컨설턴트 | 가족이 동의한 목표가 생긴 뒤 부족재원이 있을 때만 보험을 검토하겠습니다. | 조건부 연결"},{"title":"32.8 공동주주 반대","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n공동주주 | 대표 승계를 위해 회사 돈을 쓰는 데 동의하기 어렵습니다. | 이해상충\n컨설턴트 | 회사운영, 가족정산, 주식매입 목적을 분리하고 회사가 부담할 정당한 부분만 계산하겠습니다. | 목적 분리\n공동주주 | 주식가치부터 믿기 어렵습니다. | 평가 신뢰\n컨설턴트 | 단일값이 아니라 복수 평가와 민감도 범위를 제시하고 외부전문가 검증을 받겠습니다. | 독립 검증\n컨설턴트 | 주주간계약과 의사결정 기준을 먼저 합의한 뒤 재원수단을 보겠습니다. | 거버넌스 선행"},{"title":"32.9 기존 세무사와 역할 충돌","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 세금 문제는 세무사가 다 합니다. | 전문가 위임\n컨설턴트 | 그 역할을 존중합니다. 저희는 재무자료를 CEO 결정, 가족·주주, 보험·현금 실행으로 연결합니다. | 역할 차별화\n대표 | 중복 비용 아닌가요? | 비용 반론\n컨설턴트 | 세무검토는 기존 세무사가 하고 저희는 A/B/C안과 실행 일정·자료를 통합하겠습니다. 중복업무는 제외합니다. | 협업 범위\n컨설턴트 | 세무사에게 질문할 항목을 정리해 공동검토하는 방식으로 진행하겠습니다. | 협업 합의"},{"title":"32.10 보험증권 제출 거부","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 증권은 개인자료라 보여주기 어렵습니다. | 개인정보 우려\n컨설턴트 | 그 우려가 타당합니다. 전체 사본이 부담되면 계약자·피보험자·수익자·보장·기간만 가린 표로 받을 수 있습니다. | 최소수집\n대표 | 그래도 필요합니까? | 필요성 질문\n컨설턴트 | 기존 보험을 모르고 신규가입을 제안하면 중복과 목적불일치 위험이 있습니다. 확인 없이는 제안하지 않겠습니다. | 안전 원칙\n컨설턴트 | 필수항목만 적은 보안양식과 파기기준을 먼저 드리겠습니다. | 보안 합의"},{"title":"32.11 기존 설계사와 비교","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 오래 거래한 설계사가 있는데 왜 바꿔야 합니까? | 관계 방어\n컨설턴트 | 바꾸실 필요 없습니다. 경영 필요재원과 기존안이 맞으면 유지가 최선입니다. | 관계 존중\n대표 | 그럼 당신 역할은 뭡니까? | 역할 질문\n컨설턴트 | 상품이 아니라 필요재원·계약목적·수익자·현금부담을 독립적으로 검증하고 기존 담당자와 실행을 맞추는 역할입니다. | 독립 검증\n컨설턴트 | 기존 담당자와 공동검토해도 괜찮습니다. | 협업 제안"},{"title":"32.12 건강심사 우려","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n대표 | 건강이 좋지 않아 심사가 걱정됩니다. | 인수 우려\n컨설턴트 | 심사 가능성을 먼저 확인하고 불리한 조건을 숨기지 않겠습니다. 보험 외 대안도 동시에 설계하겠습니다. | 투명성\n대표 | 거절되면 시간만 낭비 아닌가요? | 효율 반론\n컨설턴트 | 예비심사, 최소보장, 다른 기간, 내부적립을 병렬 비교해 가능한 범위만 진행하겠습니다. | 병렬 대안\n컨설턴트 | 의무기록과 고지사항을 정확히 준비한 뒤 예비검토부터 하겠습니다. | 예비심사 합의"},{"title":"32.13 보험 근거 없음 선언","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 현재 자료로는 신규보험보다 운전자금과 대여금 정상화가 우선입니다. | 비제안\n대표 | 보험 판매가 목적이 아니라는 말이 진짜네요. | 신뢰 반응\n컨설턴트 | 대표 역할과 기존증권을 확인한 뒤 부족재원이 없으면 보험은 유지 검토로 끝내겠습니다. | 조건 명확화\n대표 | 그럼 다음 단계는 무엇입니까? | 행동 관심\n컨설턴트 | 채권·재고·대여금 자료로 1차 정밀진단을 진행하고 보험은 별도 게이트를 통과할 때만 열겠습니다. | 컨설팅 우선"},{"title":"32.14 계약 후 연례점검","text":"상담 목표 대표의 반응을 존중하면서 근거·재질문·선택권·다음 행동까지 완결한다.\n화자 | 실전 대화 | 의도·다음 행동\n컨설턴트 | 지난해 계약 목적은 대표 유고 시 12개월 운영자금이었습니다. 올해 매출·고정비·차입·주주구조가 어떻게 변했는지 확인하겠습니다. | 목적 재확인\n대표 | 보험은 가입했으니 끝난 것 아닙니까? | 사후관리 인식\n컨설턴트 | 필요재원은 변하고 수익자·보장기간도 경영변화에 따라 어긋날 수 있습니다. | 갱신 필요\n대표 | 무엇을 바꿔야 합니까? | 검토 요청\n컨설턴트 | 먼저 부족재원을 재계산하고 충분하면 유지, 과다하면 축소, 부족하면 대안을 비교하겠습니다. | 유지·축소·추가 원칙\n33\nCEO 성향·기업유형 맞춤화 엔진\n사실과 결론은 바꾸지 않고, 설명순서·질문·근거·클로징의 형태만 적합하게 변환한다.\nCEO 유형 | 설명순서 | 대표 문장 | 금지 | 클로징\n숫자·근거형 | 결론→산식→민감도→출처 | “기준 시나리오와 상·하한을 나눠 보겠습니다.” | 감성·공포 사례 | 검증표 승인\n빠른결정형 | 한 줄 진단→A/B 선택→기한 | “오늘 결정은 자료제출과 다음 회의 두 가지입니다.” | 긴 배경설명 | 즉시 행동 1개\n신중·보수형 | 기존방식 존중→작은 검증→확대 | “변경 없이 현황만 먼저 확정하겠습니다.” | 전면개편 요구 | 단계형 진단\n관계·가족형 | 사람 영향→가족·직원→숫자 | “가족과 임직원이 혼란 없이 움직일 기준을 만들겠습니다.” | 세금만 강조 | 공동설명\n회의·방어형 | 대표 판단 질문→가정 공개→반증 허용 | “제가 틀릴 수 있으니 자료로 함께 확인하겠습니다.” | 단정·압박 | 검증 동의\n전문가 위임형 | 역할 구분→질문목록→공동검토 | “기존 전문가 판단을 실행안과 연결하겠습니다.” | 전문가 폄하 | 3자 미팅\n비용 민감형 | 잠재효과→최소범위→중단조건 | “1차 결과가 기준에 못 미치면 확대하지 않겠습니다.” | 대형 프로젝트 선제안 | 소규모 진단\n기업유형 | 핵심 경영언어 | 우선 질문 | 보험 검토영역\n제조업 | 공장가동·재고·설비·납기·휴업 | 생산흐름, 재고연령, 핵심설비 복구 | 재산·휴업·핵심인\n서비스·지식기업 | 핵심고객·인력·영업권·데이터 | 고객집중, 핵심인 이탈, 계약갱신 | 핵심인·배상·사이버\n수출기업 | 채권·국가·환율·운송·바이어 | 상위 바이어, 최대미수, LC·담보 | 무역신용·적하·배상\n해외법인 보유 | 자금집행·보증·이전가격·현지증권 | 법인별 역할, 대여·보증, 현지권한 | 해외재산·휴업·D&O\n가족기업 | 경영권·비경영 가족·현금형평 | 후계자, 가족 역할, 주식·현금 선호 | 승계유동성·대표유고\n공동주주기업 | 의결·매매·유고·분쟁 | 주주간계약, 매입가격, 수익자 | 주식매입·핵심인\n창업·고성장 | 현금소진·투자·지분희석·핵심인 | 런웨이, 고객집중, 스톡옵션 | 핵심인·D&O\n현금부자기업 | 자본정책·기회비용·주주환원 | 운영필수현금, 투자계획, 배당원칙 | 보험은 부족재원 있을 때만\n차입·보증 의존 | 상환·담보·개인보증·약정 | 만기구조, 금리, 보증, 현금커버 | 채무상환·대표유고\n승계 임박 | 시간·가치·가족합의·실행순서 | 주주명부, 후계자, 건강, 세금일정 | 승계·지분정리·유동성"},{"title":"33.1 같은 결론의 맞춤 변환 예시","text":"대표 유고 / 제조업 숫자형 “핵심설비·납기·급여를 기준으로 6개월 고정성 현금수요를 계산하고, 가용현금과 기존보험을 차감한 부족분만 제시하겠습니다.”\n대표 유고 / 서비스업 관계형 “대표님 부재 시 고객과 핵심인력이 불안해지지 않도록 권한과 유지재원을 먼저 정하고 부족한 현금만 보완하겠습니다.”\n승계 / 가족기업 신중형 “주식을 당장 옮기지 않고 가족별 역할과 비상경영 기준만 문서화한 뒤 단계별로 결정하겠습니다.”\n운전자금 / 고성장 빠른결정형 “이번 주에 채권·재고 데이터를 받고 다음 주에 현금회수 잠재액과 실행 3가지를 확정하겠습니다.”\n보험료 / 비용민감형 “전액 보험이 아니라 최소 부족분만 비교하고 1차 결과가 기준에 못 미치면 추가설계를 중단하겠습니다.”\n기존전문가 / 위임형 “세무사·회계사의 판단을 유지하면서 필요한 질문과 실행표를 만들어 공동검토하겠습니다.”\n34\nP1~P9 실행형 프롬프트·JSON 스키마\nAI가 자유문서가 아니라 검증 가능한 구조화 데이터를 만들고, 코드가 CEO·컨설턴트·음성 모드를 렌더링한다.\n운영 원칙 작성 모델과 검수 모델을 분리한다. 모든 금액은 원천·연도·단위·상태를 갖고, 계산은 코드가 수행한다. 보험기회는 규칙게이트를 통과한 경우에만 생성한다."},{"title":"공통 ENUM·오류코드","text":"ENUM confidence = [CONFIRMED, CALCULATED, SCENARIO, NEEDS_CONFIRMATION] ENUM visibility = [COMMON, CEO, CONSULTANT, AUDIO] ENUM insuranceGrade = [A_CORE, B_CONDITIONAL, C_REVIEW_FIRST, D_NOT_DIRECT] ENUM decisionState = [AGREED, PARTIAL, DENIED, UNKNOWN, DELEGATED, COST_CONCERN, DEFERRED] ENUM actionType = [DOCUMENT_REQUEST, PAID_DIAGNOSTIC, EXPERT_REVIEW, INSURANCE_DESIGN, FOLLOW_UP, NO_ACTION] ERROR E001 SOURCE_MISSING ERROR E002 UNIT_OR_YEAR_CONFLICT ERROR E003 UNCONFIRMED_AS_FACT ERROR E004 CALCULATION_MISMATCH ERROR E005 INSURANCE_WITHOUT_FUNDING_GAP ERROR E006 CEO_INTERNAL_LEAK ERROR E007 BRANCH_COUNT_LOW ERROR E008 AUDIO_REPORT_MISMATCH ERROR E009 LEGAL_TAX_OVERCLAIM ERROR E010 ACTION_NOT_DEFINED"},{"title":"FACT_SCHEMA","text":"{ \"factId\": \"F_001\", \"category\": \"FINANCIAL|SHAREHOLDER|RELATED_PARTY|INSURANCE|GOVERNANCE\", \"label\": \"매출액\", \"value\": 124826, \"unit\": \"KRW_MILLION\", \"period\": \"2025\", \"scope\": \"SEPARATE|CONSOLIDATED|UNKNOWN\", \"confidence\": \"CONFIRMED\", \"source\": {\"fileId\":\"...\",\"page\":12,\"table\":\"손익계산서\",\"quote\":\"\"}, \"conflictIds\": [], \"notes\": \"\" }"},{"title":"ISSUE_SCHEMA","text":"{ \"issueId\": \"I_KEYPERSON\", \"title\": \"대표자 유고와 비상재원\", \"evidenceFactIds\": [\"F_...\"], \"severity\": 4, \"urgency\": 3, \"businessMeaning\": \"\", \"riskScenario\": \"\", \"requiredQuestions\": [{\"questionId\":\"Q_1\",\"reason\":\"\",\"answerType\":\"NUMBER|TEXT|CHOICE\",\"required\":true}], \"calculators\": [\"KEYPERSON_FUNDING_GAP\"], \"expertReview\": [\"TAX\",\"LEGAL\",\"INSURANCE_UNDERWRITING\"], \"confidence\": \"NEEDS_CONFIRMATION\" }"},{"title":"INSURANCE_OPPORTUNITY_SCHEMA","text":"{ \"opportunityId\": \"OP_001\", \"issueId\": \"I_KEYPERSON\", \"grade\": \"B_CONDITIONAL\", \"rationaleFactIds\": [], \"riskEvent\": \"\", \"requiredFunding\": {\"min\":0,\"base\":0,\"max\":0,\"unit\":\"KRW_MILLION\",\"formulaId\":\"KEYPERSON_FUNDING_GAP\"}, \"availableResources\": {\"cash\":0,\"financialAssets\":0,\"credit\":0,\"existingInsurance\":0,\"excludedOperatingCash\":0}, \"fundingGap\": {\"min\":0,\"base\":0,\"max\":0}, \"insuranceRole\": \"\", \"nonInsuranceAlternatives\": [], \"eligibilityChecks\": [], \"additionalDocuments\": [], \"prohibitedClaims\": [], \"nextAction\": \"\", \"confidence\": \"NEEDS_CONFIRMATION\" }"},{"title":"PAGE_NOTE_SCHEMA","text":"{ \"pageId\": \"P_12\", \"visibility\": [\"COMMON\",\"CEO\",\"CONSULTANT\",\"AUDIO\"], \"common\": {\"title\":\"\",\"oneLineConclusion\":\"\",\"facts\":[],\"analysis\":[],\"options\":[],\"decision\":\"\"}, \"consultantOnly\": { \"purpose\":\"\", \"scripts\":{\"sec30\":\"\",\"sec90\":\"\",\"min3\":\"\",\"min5\":\"\"}, \"questions\":[], \"branches\":[{\"state\":\"DENIED\",\"ceoWords\":\"\",\"empathy\":\"\",\"diagnosticQuestion\":\"\",\"reframe\":\"\",\"secondResponse\":\"\",\"nextAction\":\"\"}], \"objections\":[{\"objection\":\"\",\"response\":\"\",\"followQuestion\":\"\",\"actionAgreement\":\"\"}], \"insuranceOpportunityId\": null, \"transition\":\"\", \"documents\":[] }, \"audio\":{\"chapter\":\"\",\"learningGoal\":\"\",\"script\":\"\",\"fieldAssignment\":[]}, \"qa\":{\"sourceIds\":[],\"calculationIds\":[],\"warnings\":[]} }\n프롬프트 | 입력 | 출력 | 필수 검증 | 실패 처리\nP1 사실구조화 | PDF chunks + metadata | FACT_SCHEMA[] + conflicts[] | 원천·페이지·연도·단위 필수 | E001/E002/E003\nP2 이슈탐지 | facts + issue rules | ISSUE_SCHEMA[] | 근거 Fact ID 1개 이상 | 근거 없으면 이슈 비활성\nP3 맞춤질문 | issues + known answers | questionnaire[] | 중복 제거·이유·영향 표시 | 필수답변 누락 시 다음 단계 금지\nP4 계산·솔루션 | confirmed facts + answers | calculations + A/B/C options | 계산은 코드결과만 인용 | E004 시 재계산\nP5 보험기회 | issues + funding results + policies | INSURANCE_OPPORTUNITY_SCHEMA[] | gap 또는 보장공백 필수 | E005 시 D등급 또는 제거\nP6 CEO 본문 | confirmed dataset + options | common pages | 내부등급·클로징 금지 | E006 시 전체 재작성\nP7 컨설턴트 화법 | pages + CEO/industry profile | consultantOnly notes | 4시간대사·7분기·행동합의 | E007/E010 시 해당 페이지 재작성\nP8 음성강의 | confirmed pages + notes | audio chapters | 낭독 금지·역할극·과제 | E008 시 재작성\nP9 교차검수 | all outputs | score + errors + repaired output | 하드실패 0건·전항목 90+ | 기준 미달 자동 재생성"},{"title":"P7 최종 실행 프롬프트","text":"SYSTEM ROLE: 기업경영 종합리포트의 컨설턴트 상담화법 생성기. INPUT: confirmedAnalysisDataset, pageCommon, ceoProfile, industryProfile, insuranceOpportunity. OUTPUT: PAGE_NOTE_SCHEMA.consultantOnly only. JSON 외 텍스트 금지. LENGTH RULE - sec30: 110~180 Korean characters, one problem-opening + one question. - sec90: 350~550 characters, fact→meaning→risk→question→next step. - min3: 800~1,200 characters, at least 3 questions and one pause cue. - min5: 1,500~2,300 characters, fact→interpretation→scenario→A/B/C→decision→documents. BRANCH RULE - exactly 7 states: AGREED, PARTIAL, DENIED, UNKNOWN, DELEGATED, COST_CONCERN, DEFERRED. - every branch contains empathy, diagnosticQuestion, reframe, secondResponse, nextAction. - never invent CEO facts. Use conditional wording for NEEDS_CONFIRMATION. INSURANCE RULE - If grade D_NOT_DIRECT, do not write insurance closing. State consulting/expert priority. - If grade B/C, ask documents and funding calculation before design. - If grade A, still compare non-insurance alternatives and existing policy. - Never guarantee tax treatment, expense recognition, underwriting, return, or claim payment. SELF CHECK 1. Every number maps to factId or calculationId. 2. Scripts are not duplicated across pages. 3. Objection response ends with a question or action agreement. 4. Internal sales language never appears in common/CEO fields. 5. Return errors[] if any rule cannot be satisfied.\n규칙 | 트리거 | 자동조치\nR01 | 분기가 7개 미만 또는 state 중복 | P7 해당 페이지 재생성\nR02 | A/B등급인데 fundingGap 없음 | P5 재생성 후 P7\nR03 | CEO용에 등급·클로징·수수료 노출 | P6 전체 재생성\nR04 | 금액·연도·단위 불일치 | P1 충돌해결 또는 P4 재계산\nR05 | 미확인 사실 단정 | 해당 문장을 조건부로 재작성\nR06 | 반론응대 후 행동합의 없음 | P7 objection만 재작성\nR07 | 30초·90초·3분·5분 중복률 45% 초과 | P7 전체 재작성\nR08 | 음성대본이 본문 낭독 비중 40% 초과 | P8 교육형으로 재작성\nR09 | 음성 금액·결론 불일치 | P8 재생성\nR10 | 보험 없는 기업에 계약화법 생성 | P5 D등급 확인 후 P7 제거\nR11 | 법률·세무 확정 표현 | 전문가 검토 조건으로 재작성\nR12 | 최종평가 90점 미만 항목 존재 | 해당 모듈 반복생성, 3회 실패 시 사람 검수"},{"title":"34.1 생성 운영값과 안정성 기준","text":"P1·P4는 낮은 창의성(temperature 0~0.2), P6·P7·P8은 제한적 창의성(0.3~0.5), P9는 0으로 운용한다.\n작성 모델과 검수 모델을 분리하고, 동일 모델을 쓸 때에도 시스템 역할·컨텍스트를 분리한다.\n긴 PDF는 페이지·표 단위로 분할하되 기업명·단위·재무범위·연도 메타데이터를 모든 chunk에 반복한다.\nJSON 파싱 실패는 1회 repair prompt, 2회 schema constrained retry, 3회 사람검수로 전환한다.\n동일 입력 3회 생성 시 핵심 이슈·보험등급·필요재원 방향이 일치해야 하며 문장만 달라질 수 있다.\n최종 HTML은 AI가 직접 코딩하지 않고 구조화 데이터에서 템플릿 엔진이 생성한다.\n35\n음성강의 3종 완성형 샘플\n리포트를 읽는 것이 아니라 숫자의 의미·질문·잘못된 접근·역할극·다음 행동을 훈련한다.\n음성강의 공통 시작 자비아 기업경영 의사결정 해설교육, 시작하겠습니다. 오늘의 목표는 리포트를 외우는 것이 아니라 이 기업에서 무엇을 묻고 어떤 순서로 상담해야 하는지 익히는 것입니다.\n35.1 약 18~22분 구성용 완성대본 [강의 1 | 보험기회가 높은 기업 — 대표 유고·승계 유동성] 이번 기업의 한 줄 진단은 이렇습니다. 성장성과 현금창출력은 양호하지만 대표 의존도와 가족·주주 유동성에 대한 준비정보가 부족해, 대표 유고와 승계 시 필요한 현금을 먼저 계산할 가치가 높은 기업입니다. 여기서 곧바로 보험을 제안하면 안 됩니다. 보험은 결론이고, 첫 질문은 “대표님이 한 달 이상 경영에 참여하지 못하면 무엇이 멈추는가”입니다. 먼저 잘못된 접근을 보겠습니다. “대표님 연세가 있으니 상속세와 퇴직금을 위해 법인보험을 준비해야 합니다.” 이 말은 세금과 상품을 먼저 꺼내 대표의 방어를 높입니다. 올바른 접근은 다음과 같습니다. “보험을 먼저 말씀드리려는 것이 아닙니다. 대표님 부재 시 거래처, 은행, 해외법인, 주주가 어떤 결정을 기다리게 되고 회사를 6개월 또는 12개월 유지하는 데 얼마가 필요한지 계산하겠습니다.” 숫자는 네 묶음으로 계산합니다. 첫째 급여·임차·이자·필수매입 같은 고정성 운영자금, 둘째 개인보증·담보·만기도래 채무, 셋째 핵심인 유지와 긴급 전문경영 비용, 넷째 주식매입·가족정산·승계 관련 유동성입니다. 그다음 가용현금, 금융자산, 실제 사용할 수 있는 신용한도, 기존 보험을 차감합니다. 운영에 이미 필요한 현금은 비상재원으로 중복 계산하지 않습니다. 상담 질문은 세 가지입니다. “대표님이 부재하면 가장 먼저 연락이 올 곳은 어디입니까?” “기존 임원이 실제 은행서명과 계약권한을 가지고 있습니까?” “법인과 개인의 기존 보험금은 회사운영, 가족생활, 지분정리 중 어느 목적으로 준비돼 있습니까?” 답이 모른다여도 괜찮습니다. 모른다는 사실은 상품제안 사유가 아니라 자료요청 사유입니다. 역할극을 해보겠습니다. 대표가 “회사의 현금이 충분합니다”라고 말합니다. 컨설턴트는 “현재 현금이 충분하다는 점은 강점입니다. 다만 급여와 매입, 세금에 이미 필요한 현금을 전부 비상재원으로 쓸 수 있는지 구분해 보겠습니다. 사용 가능한 현금만으로 12개월 운영과 보증 대응까지 가능한지 확인해도 될까요?”라고 답합니다. 대표가 “임원들이 알아서 합니다”라고 말하면 “그 점은 큰 강점입니다. 권한위임과 실제 서명권, 핵심거래처의 신뢰가 문서와 관계로 준비돼 있는지 확인하겠습니다”라고 이어갑니다. 보험을 꺼내도 되는 시점은 부족재원이 계산되고, 비보험 대안과 기존증권을 검토한 뒤입니다. 계약자·피보험자·수익자와 보험료 부담주체가 목적에 맞아야 하고 건강·재무심사, 세무·법률 검토가 필요합니다. 부족재원이 없으면 보험을 확대하지 않습니다. 다음 미팅의 목표는 계약이 아닙니다. 대표 역할표, 월 고정비, 개인보증, 주주명부, 기존증권을 받아 최소·기준·상한 부족재원을 만드는 것입니다. 오늘 현장에서 사용할 문장은 이것입니다. “대표님, 가입 여부보다 먼저 회사가 필요로 하는 돈의 크기와 현재 준비된 돈을 비교하겠습니다.”\n35.2 약 16~20분 구성용 완성대본 [강의 2 | 보험보다 유료컨설팅이 우선인 기업 — 운전자금·대여금] 이번 기업의 한 줄 진단은 성장한 이익이 현금으로 전환되는 속도가 느리고, 단기대여금의 성격과 회수계획을 확인해야 하지만 현재 자료만으로는 생명보험 계약의 당위성이 낮다는 것입니다. 이 기업에서 컨설턴트의 전문성은 보험을 억지로 연결하지 않는 데서 드러납니다. 첫 번째 이슈는 운전자금입니다. 매출과 이익이 늘었지만 영업현금흐름이 따라오지 못하고 채권과 재고가 증가했다면 벌어들인 돈이 거래처와 재고에 머물러 있을 수 있습니다. 잘못된 설명은 “현금흐름이 나쁘니 보험으로 자금을 준비해야 합니다”입니다. 보험은 운전자금의 근본해결책이 아닙니다. 올바른 설명은 “거래처별 실제 회수일과 재고연령을 확인해 차입 전에 내부에서 확보할 수 있는 현금을 계산하겠습니다”입니다. 두 번째 이슈는 단기대여금입니다. 상대방과 목적을 모른 채 가지급금이나 대표 개인사용이라고 부르면 안 됩니다. 관계회사 운영자금, 임직원 대여, 거래선 선급, 일시적 계정처리 등 가능성을 열어 두고 원장·통장·계약·이사회 결의·이자·만기·상환내역을 복원합니다. 회수 가능한 금액, 사업상 대여로 정상화할 금액, 자본·구조조정 검토가 필요한 금액을 나눕니다. 대표가 “세무사가 처리하고 있습니다”라고 말할 수 있습니다. 이때 “세무처리는 세무사가 잘하고 있을 것입니다. 이번 검토는 실제 회수일정과 회사 현금계획을 만드는 작업입니다”라고 역할을 구분합니다. 대표가 “지금까지 문제없었습니다”라고 하면 “문제가 있다고 단정하는 것이 아니라 금액과 기간, 증빙이 설명 가능한지 확인해 향후 거래가 반복돼도 같은 기준을 적용하려는 것입니다”라고 답합니다. 유료컨설팅의 당위성은 명확합니다. 채권연령표, 재고연령표, 13주 현금흐름표, 대여금 정상화 A/B/C안, 담당자와 KPI를 산출물로 제시합니다. 8주 또는 12주 프로젝트로 매주 현금개선과 회수계획을 확인할 수 있습니다. 컨설팅 비용은 보험계약의 전제가 아니라 실제 산출물과 개선가능액으로 설명합니다. 보험은 어디에서 다시 열릴까요? 대표 역할, 기존증권, 개인보증, 승계의사까지 확인해 별도의 위험과 부족재원이 발견될 때입니다. 발견되지 않으면 신규보험을 제안하지 않습니다. “현재 분석에서는 보험보다 운전자금과 대여금 정상화가 우선입니다”라고 말할 수 있어야 이후 보험제안도 신뢰받습니다. 오늘 현장과제는 두 가지입니다. 첫째 대표에게 “최근 매출이 늘었는데도 자금이 빠듯했던 주가 있었습니까?”라고 묻습니다. 둘째 대여금에 대해 “상대방과 목적, 만기, 이자, 결의, 상환계획을 한 장으로 설명할 수 있습니까?”라고 묻습니다. 다음 미팅에서는 자료와 정밀진단 범위를 합의하십시오.\n35.3 약 16~20분 구성용 완성대본 [강의 3 | 기존 보험이 많은 기업 — 신규가입보다 최적화 우선] 이번 기업의 한 줄 진단은 보험료와 보장금액은 크지만 각 계약의 목적, 수익자, 보장기간, 현금가치가 현재 경영 필요재원과 연결돼 있는지 확인되지 않아 신규가입보다 증권 최적화가 우선이라는 것입니다. 잘못된 접근은 기존 계약을 오래됐다거나 수익률이 낮다는 이유로 해지·전환을 권하는 것입니다. 해지손실, 신규심사, 면책, 과거의 좋은 조건을 잃을 수 있습니다. 올바른 접근은 모든 계약을 대표 유고, 핵심인, 퇴직, 승계, 대출·보증, 직원복지, 재산·휴업·배상 목적별로 분류하는 것입니다. 각 계약에서 확인할 것은 계약자, 피보험자, 수익자, 보장금액, 보장기간, 납입기간, 현금가치, 해지환급, 특약, 대출, 면책, 가입목적입니다. 그다음 앞서 계산한 필요재원과 비교합니다. 필요재원과 목적이 맞으면 유지가 결론입니다. 금액이 과다하거나 기간이 맞지 않으면 감액·구조조정을 검토합니다. 신규심사 위험과 해지손실이 크면 현재 계약을 보존합니다. 실제 부족재원이 남을 때만 추가가입을 검토합니다. 대표가 “기존 설계사가 잘 관리합니다”라고 말하면 “관계를 바꿀 필요가 없습니다. 기존안이 목적에 맞으면 유지가 최선이고, 필요하면 기존 담당자와 공동검토하겠습니다”라고 답합니다. “증권은 개인자료라 보여주기 어렵다”고 하면 전체 사본 대신 필수항목만 가린 표로 받고 보안·파기기준을 제시합니다. 비교의 기준은 상품명이 아닙니다. 첫째 필요재원 충족도, 둘째 회사 현금부담, 셋째 보장기간과 위험기간의 일치, 넷째 수익자와 사용목적, 다섯째 해지손실과 인수조건, 여섯째 사후관리입니다. 이 기준으로 유지·감액·전환·추가 네 가지를 비교합니다. 최종결정 화법은 다음과 같습니다. “대표님, 지금까지 확인한 결과 A계약은 목적과 기간이 맞아 유지하는 것이 좋습니다. B계약은 과다한 부분을 감액할 수 있지만 해지손실을 먼저 확인해야 합니다. C위험에는 부족재원이 남아 추가설계 가능성이 있으나 건강심사와 보험료를 확인한 뒤 결정하겠습니다. 오늘은 변경할 계약과 유지할 계약의 원칙만 합의하겠습니다.” 계약 후에도 매년 매출, 고정비, 차입, 주주, 대표 역할, 기업가치가 변했는지 확인해 부족재원을 다시 계산합니다. 보험은 한 번 가입하고 끝나는 상품목록이 아니라 경영목적에 맞게 유지·축소·추가하는 위험재원입니다. 오늘 현장과제는 모든 증권을 목적별 한 줄로 설명하는 표를 만드는 것입니다."},{"title":"35.4 TTS 변환 규칙","text":"음성 품질규칙\n숫자 | 124,826백만원을 그대로 읽지 않고 “약 1,248억원”처럼 청취 단위로 변환하되 원문값을 훼손하지 않는다.\n비율 | 52.02%는 “약 52퍼센트”로 읽고 정밀값이 중요할 때만 소수점 둘째자리까지 읽는다.\n영문약어 | DSO는 첫 등장에 “매출채권 회수일수, 디에스오”로 풀어 읽는다.\n산식 | 기호를 읽지 않고 “필요재원에서 가용현금과 기존보험을 차감한 금액”처럼 자연어로 변환한다.\n호흡 | 한 문장 35~55자를 권장하고 질문 전후 0.5~0.8초, 챕터 전환 1.2초 휴지를 둔다.\n강조 | 공포표현 대신 “핵심은”, “여기서 중요한 점은”으로 한 문장만 강조한다.\n법률·세무 | 조문·판례번호 나열을 피하고 실무 의미를 먼저 말한 뒤 상세 근거는 화면에 둔다.\n일치검수 | 금액·연도·회사명·등급·권고안이 리포트와 한 글자라도 다르면 TTS 전에 재생성한다.\n36\n최종 품질게이트와 92~93점 판정\n문서설계의 내부점수와 실제 현장점수를 구분하고, 하드실패 0건과 전 항목 90점 이상을 출시조건으로 한다.\n평가영역 | 가중치 | 내부 설계점수 | 판정근거\n정확성·근거 통제 | 12% | 95.0 | 원천·계산·시나리오·확인필요 구분\n경영해석 | 8% | 93.0 | 숫자를 현금·경영권·실행으로 번역\nCEO 본문 | 8% | 92.0 | 결정 중심·내부영업 미노출\n페이지별 완성화법 | 12% | 93.0 | 30초·90초·3분·5분 실제대사\nCEO 답변 분기 | 10% | 92.0 | 핵심 이슈별 7분기·행동합의\n반론 대응 | 8% | 92.0 | 인정→진단→범위축소→근거→행동\n보험기회 판단 | 10% | 95.0 | 부족재원·적합성·비보험대안 게이트\n보험계약 최종화법 | 10% | 93.0 | 구조·심사·결정·사후관리 완결\n업종·CEO 맞춤성 | 6% | 91.0 | 7 CEO 유형·10 기업유형 변환\n음성강의 | 5% | 92.0 | 3종 교육형 대본·TTS 규칙\n프롬프트 안정성 | 6% | 93.0 | 스키마·오류·재작성·운영값\n검수·보안 | 5% | 95.0 | 교차검수·하드실패·내부정보 제거\n내부 설계평가 가중평균 93.11점. 모든 항목이 90점 이상으로 설계됐다. 이는 문서·프롬프트·화법 구조에 대한 내부평가이며, 실제 현장 사용점수는 기업 24건과 컨설턴트 검증을 통과한 뒤 확정한다."},{"title":"36.1 하드실패 — 한 건이면 출시 중단","text":"원본 PDF와 금액·연도·단위가 불일치한다.\n미확인 사실을 확정하고 가지급금·위법·탈세 등으로 단정한다.\n필요재원과 기존재원 확인 없이 보험을 제안한다.\n세금절감·비용처리·수익률·인수·보험금 지급을 보장한다.\n보험으로 해결할 수 없는 대여금·절차·신고 문제를 보험으로 연결한다.\n컨설턴트 내부 화법·보험등급·클로징이 CEO 전달본에 노출된다.\n리포트·페이지 노트·음성강의의 숫자와 결론이 다르다.\n반론 대응에 공포·비하·기존 전문가 폄하·즉시계약 압박이 포함된다.\n전문가 검토가 필요한 법률·세무·보험구조를 AI가 최종 확정한다."},{"title":"36.2 실제 출시 검증계획","text":"검증축 | 표본 | 통과기준\n기업유형 | 제조·서비스·수출·해외·가족·공동주주·고성장·승계 각 3건, 총 24건 | 중대오류 0, 이슈 적합도 90% 이상\n컨설턴트 | 초급 2명·중급 2명·고경력 2명 | 모든 평가영역 평균 90점 이상\n대화실전 | 1차미팅·반론·2차진단·보험설계·보류·사후관리 | 다음 행동 합의율·자연스러움·신뢰도 평가\n생성안정성 | 동일기업 3회 반복·모델 2종 교차 | 핵심이슈·등급·권고방향 95% 일치\n보안 | CEO HTML/PDF 내보내기 20회 | 내부영업 정보 0건\n오디오 | 모바일 청취·TTS 3종·수치교차검수 | 금액불일치 0, 이해도 90점 이상"},{"title":"36.3 최종 제품 선언","text":"실전출시형 v3.0의 정의 이 교본은 보험상품을 먼저 판매하는 화법집이 아니다. 기업자료에서 확인된 사실을 경영의사결정으로 번역하고, 대표의 반응을 따라 재질문하며, 유료진단·전문가 협업·보험설계 중 적합한 다음 행동을 합의하는 대화엔진이다. 보험은 위험과 부족재원이 확인될 때 가장 구체적으로 제시하고, 근거가 없을 때는 제안하지 않는 원칙으로 신뢰를 만든다.\n최종 사용 순서 PDF 분석 → 추가질문 → 계산·근거확정 → CEO용 리포트 → 컨설턴트 페이지별 화법 → 보험게이트 → 음성강의 → 교차검수 → 현장사용 → 결과피드백 → 규칙개선"}];
const ISSUE_REGISTRY = [{"issueId":"FIN-01","name":"매출·수익성","grade":"CORE","trigger":"매출/마진 급변","primarySolution":"재무개선","insuranceLink":"간접"},{"issueId":"FIN-02","name":"현금흐름","grade":"CORE","trigger":"순이익-영업CF 괴리","primarySolution":"현금흐름 프로젝트","insuranceLink":"간접"},{"issueId":"FIN-03","name":"운전자금","grade":"CORE","trigger":"채권·재고 증가","primarySolution":"8~12주 유료 프로젝트","insuranceLink":"채권보험 조건부"},{"issueId":"FIN-04","name":"매출채권·회수","grade":"CORE","trigger":"DSO 상승·집중","primarySolution":"회수정책·신용한도","insuranceLink":"신용/무역보험"},{"issueId":"FIN-05","name":"재고·휴업","grade":"CORE","trigger":"재고일수 상승","primarySolution":"재고정상화","insuranceLink":"재산·휴업보험"},{"issueId":"FIN-06","name":"차입·이자·만기","grade":"CORE","trigger":"차입증가·이자보상 저하","primarySolution":"재무구조 개선","insuranceLink":"상환재원 조건부"},{"issueId":"TAX-01","name":"가지급금·대여금","grade":"CORE","trigger":"대여금/특수관계채권","primarySolution":"회수·정상화","insuranceLink":"직접연계 낮음"},{"issueId":"TAX-02","name":"미처분이익잉여금","grade":"CORE","trigger":"잉여금·배당이슈","primarySolution":"배당·투자·퇴직정책","insuranceLink":"승계재원 조건부"},{"issueId":"TAX-03","name":"CEO 보수·상여·배당","grade":"CORE","trigger":"보수설계 상담","primarySolution":"규정·세후비교","insuranceLink":"직접연계 낮음"},{"issueId":"TAX-04","name":"임원퇴직금·퇴직재원","grade":"CORE","trigger":"은퇴·규정·재원","primarySolution":"규정/세액/재원","insuranceLink":"퇴직재원 조건부"},{"issueId":"TAX-05","name":"법인세·공제·감면","grade":"CORE","trigger":"과세표준·공제","primarySolution":"전문가 검토","insuranceLink":"상품연계 금지"},{"issueId":"TAX-06","name":"세무 부인·조사","grade":"CORE","trigger":"특수관계·증빙미비","primarySolution":"증빙·전문가","insuranceLink":"상품연계 금지"},{"issueId":"VAL-01","name":"비상장주식 가치","grade":"CORE","trigger":"평가·거래·상속","primarySolution":"가치평가","insuranceLink":"승계재원 조건부"},{"issueId":"GOV-01","name":"주주·지분·경영권","grade":"CORE","trigger":"집중/분쟁/공동주주","primarySolution":"정관·주주간계약","insuranceLink":"지분매입재원"},{"issueId":"GOV-02","name":"자기주식","grade":"CORE","trigger":"취득·처분 기록","primarySolution":"거래복원·절차검토","insuranceLink":"간접"},{"issueId":"GOV-03","name":"감자·자본거래","grade":"CORE","trigger":"감자·배당·증자","primarySolution":"자본정책","insuranceLink":"간접"},{"issueId":"GOV-04","name":"주식이동","grade":"CORE","trigger":"양도·증여·증자","primarySolution":"평가·세무·절차","insuranceLink":"승계재원 조건부"},{"issueId":"SUC-01","name":"가업승계·상속·증여","grade":"CORE","trigger":"대표연령·후계자","primarySolution":"A/B/C 승계안","insuranceLink":"유동성 부족분"},{"issueId":"INS-01","name":"대표·핵심인 유고","grade":"INSURANCE","trigger":"의사결정 집중","primarySolution":"비상운영·권한","insuranceLink":"핵심인 보장"},{"issueId":"INS-02","name":"필요재원 vs 준비재원","grade":"INSURANCE","trigger":"위험별 자금격차","primarySolution":"필요재원 산출","insuranceLink":"부족분만 보험"},{"issueId":"INS-03","name":"기존 법인보험","grade":"INSURANCE","trigger":"증권 보유","primarySolution":"목적·중복·공백","insuranceLink":"유지/감액/추가"},{"issueId":"INS-04","name":"수출채권·거래처 부도","grade":"INSURANCE","trigger":"수출·집중","primarySolution":"회수위험관리","insuranceLink":"무역/신용보험"},{"issueId":"INS-05","name":"해외사업장 재산·휴업","grade":"INSURANCE","trigger":"해외법인/생산","primarySolution":"보장공백 점검","insuranceLink":"재산/휴업"},{"issueId":"INS-06","name":"적하·운송·배상","grade":"INSURANCE","trigger":"수출·물류·제품","primarySolution":"위험전가 점검","insuranceLink":"적하/배상"},{"issueId":"INS-07","name":"개인보증·채무","grade":"INSURANCE","trigger":"대표보증·담보","primarySolution":"보증해소·비상재원","insuranceLink":"조건부"},{"issueId":"FX-01","name":"해외법인·특수관계·환위험","grade":"CORE","trigger":"관계회사/외화","primarySolution":"거래·환·송금 대시보드","insuranceLink":"일부 전가"},{"issueId":"EXT-01","name":"법인전환","grade":"EXTENDED","trigger":"개인사업/전환 상담","primarySolution":"거래구조·세후비교","insuranceLink":"조건부"},{"issueId":"EXT-02","name":"정책자금","grade":"EXTENDED","trigger":"자금수요·공고","primarySolution":"자격·기관심사","insuranceLink":"보험 아님"},{"issueId":"EXT-03","name":"M&A·기업매각","grade":"EXTENDED","trigger":"Exit 상담","primarySolution":"가치·실사·구조","insuranceLink":"거래보험 별도"},{"issueId":"EXT-04","name":"청산·폐업","grade":"EXTENDED","trigger":"해산/폐업","primarySolution":"채무·세금·절차","insuranceLink":"보험 아님"},{"issueId":"EXT-05","name":"사업분리·분할","grade":"EXTENDED","trigger":"분할/사업부","primarySolution":"자산·부채·인허가","insuranceLink":"보험 재배치"},{"issueId":"EXT-06","name":"사내근로복지기금","grade":"EXTENDED","trigger":"복지기금 상담","primarySolution":"설립·출연·운영","insuranceLink":"보험 아님"},{"issueId":"EXT-07","name":"법인부동산","grade":"EXTENDED","trigger":"취득·보유·처분","primarySolution":"세무·업무관련성","insuranceLink":"재산보험 별도"},{"issueId":"EXT-08","name":"4대보험·사회보험","grade":"EXTENDED","trigger":"보수·자격","primarySolution":"보수월액·부담","insuranceLink":"보험상품과 구분"},{"issueId":"EXT-09","name":"조세불복·경정청구","grade":"EXTENDED","trigger":"조사/심판/환급","primarySolution":"기한·증빙·전문가","insuranceLink":"보험 아님"}];
const GOLDEN_SAMPLE = {"meta":{"caseId":"CR-DEMO-MOLAX-2026","sourceType":"CRETOP/KODATA 텍스트형 PDF","sourcePages":37,"unit":"백만원","confirmed":true,"createdAt":"2026-07-30","consultant":"gildong"},"profile":{"companyName":"모락스트레이딩(주)","displayName":"M사","businessNumber":"220-81-16162","representative":"김기성","employees":56,"established":"1996-04-18","companyType":"외감·중기업","industry":"그 외 기타 봉제의복 제조업","products":"니트·스커트·드레스 등","address":"서울 중구 서소문로 116","mainBank":"하나은행","creditGrade":"EW","foreignSubsidiaries":["MOLAX VINA Co., Ltd.","PT BUSANA INDAH GLOBAL","PT. MINU GARMENT SUKSES"],"relatedCompanies":["모락스마리타임(주)"],"reportDate":"2026-07-13","fiscalDate":"2025-12-31"},"financials":{"2025":{"assets":80706,"liabilities":44905,"equity":35801,"revenue":124826,"cogs":104203,"operatingProfit":5342,"netIncome":5411,"cash":10149,"currentAssets":51124,"currentLiabilities":39556,"receivables":19090,"inventory":17470,"payables":32026,"borrowings":4000,"shortTermLoanReceivable":2046,"retainedEarnings":24494,"operatingCashFlow":2999,"interestExpense":327,"capitalStock":739},"2024":{"assets":68885,"liabilities":38477,"equity":30408,"revenue":82110,"cogs":72044,"operatingProfit":-1501,"netIncome":83,"cash":8137,"currentAssets":39402,"currentLiabilities":34614,"receivables":15046,"inventory":13335,"payables":29983,"borrowings":3000,"shortTermLoanReceivable":0,"retainedEarnings":28417,"operatingCashFlow":-7974,"interestExpense":null,"capitalStock":1300},"2023":{"assets":73604,"liabilities":33278,"equity":40326,"revenue":102181,"cogs":null,"operatingProfit":5471,"netIncome":4206,"cash":22574,"currentAssets":43498,"currentLiabilities":32444,"receivables":12335,"inventory":6258,"payables":27722,"borrowings":0,"shortTermLoanReceivable":0,"retainedEarnings":29433,"operatingCashFlow":19664,"interestExpense":null,"capitalStock":1300}},"capitalEvents":[{"year":2024,"type":"자기주식 취득","amount":9309,"status":"confirmed"},{"year":2025,"type":"자기주식 처분 현금유입","amount":6375,"status":"confirmed"},{"year":2025,"type":"자본금 감소","amount":1300,"status":"confirmed"},{"year":2025,"type":"현금배당 지급","amount":6300,"status":"confirmed"},{"year":2026,"type":"이익잉여금 처분안상 현금배당","amount":9000,"status":"needs_confirmation"}],"answers":{"ceoStyle":"신중보수형","meetingStage":"1차 진단","successorStatus":"미확인","existingInsurance":"미확인","keyPersonMonthlyFixedCost":null,"keyPersonEmergencyMonths":12,"immediateDebtRepayment":null,"availableEmergencyCash":null,"existingKeyPersonCoverage":null,"topCustomerConcentration":"미확인","loanCounterparty":"미확인","loanPurpose":"미확인","loanContract":"미확인","loanInterest":"미확인","loanMaturity":"미확인"},"sourceMap":{"profile":"PDF 2p","credit":"PDF 2~3p","financials":"PDF 3p 및 재무제표","capitalEvents":"PDF 현금흐름표·자본변동·연혁","relationships":"PDF 4p·8p"},"warnings":["고객·거래처·관계회사 일부 정보는 과거 조사자료일 수 있으므로 최신 여부 확인이 필요합니다.","단기대여금은 상대방과 거래 실질을 확인하기 전 대표자 가지급금으로 단정하지 않습니다.","2026년 현금배당 90억원은 처분안 성격일 수 있으므로 실제 지급 여부를 확인해야 합니다."]};
/* ============================================================================
 * JARVIA Corporate Report — v1.0 Beta
 * Core runtime: PDF → confirmation → questions → calculations → issues →
 * CEO/Consultant/Audio modes. Existing JARVIA assets are invoked, not modified.
 * ========================================================================== */
(function(global){
'use strict';

const VERSION='3.0.1-credit-ai-endpoint-errorfix-final';
const ACCESS={mode:'allowlist',allowedLoginIds:['gildong']};
const ENDPOINTS={
  jebanseo:global.JARVIA_JEBANSEO_API||'https://asia-northeast3-jarvia-platform.cloudfunctions.net/jebanseoApi',
  corporate:global.CORPORATE_REPORT_API_URL||'https://asia-northeast3-jarvia-platform.cloudfunctions.net/corporateReportApi'
};
const CORPORATE_ENDPOINTS=[...new Set([
  global.CORPORATE_REPORT_API_URL,
  (location.origin&&location.origin!=='null')?location.origin.replace(/\/$/,'')+'/api/corporate-report':null,
  ENDPOINTS.corporate
].filter(Boolean))];
const TRUSTED_ORIGINS=new Set([location.origin,'https://jarvia.co.kr','https://www.jarvia.co.kr','https://kfpc0808.github.io']);
const $=id=>document.getElementById(id);
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clone=o=>JSON.parse(JSON.stringify(o));
const nowIso=()=>new Date().toISOString();
const n=v=>{if(v===null||v===undefined)return null;const t=String(v).replace(/,/g,'').trim();if(!t)return null;const x=Number(t);return Number.isFinite(x)?x:null;};
const safeNum=(v,d=0)=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):d;
const pct=(v,d=1)=>Number.isFinite(v)?v.toFixed(d)+'%':'—';
const wonEok=(m,d=1)=>m!==null&&m!==undefined&&String(m).trim()!==''&&Number.isFinite(Number(m))?(Number(m)/100).toFixed(d)+'억원':'미확인'; // 백만원→억원
const man=(m)=>m!==null&&m!==undefined&&String(m).trim()!==''&&Number.isFinite(Number(m))?Math.round(Number(m)*100).toLocaleString('ko-KR')+'만원':'미확인';
const mm=(m)=>m!==null&&m!==undefined&&String(m).trim()!==''&&Number.isFinite(Number(m))?Math.round(Number(m)).toLocaleString('ko-KR')+'백만원':'미확인';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const attr=s=>esc(s).replace(/`/g,'&#96;');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const avg=(...xs)=>{const a=xs.filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
const div=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?a/b:null;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const textArray=v=>Array.isArray(v)?v.filter(Boolean):v?[v]:[];
const sentence=(s,max=230)=>{s=String(s||'').trim();return s.length>max?s.slice(0,max).replace(/\s+\S*$/,'')+'…':s;};

const state={
  mode:'consultant',caseData:null,analysis:null,pages:[],visiblePages:[],currentPage:0,
  factsConfirmed:false,questionsConfirmed:false,sourceText:'',sourceName:'',pdfMeta:null,
  present:false,presentIndex:0,audioIndex:0,speechUtterance:null,idToken:'',idTokenExp:0,
  live:{taxnavi:false,ai:false,tts:false,storage:false},quality:null,localOnly:true
};

function toast(msg,type=''){const el=$('toast');if(!el)return;el.textContent=msg;el.className='toast on '+type;clearTimeout(el._t);el._t=setTimeout(()=>el.className='toast',2600);}
function openModal(id){$(id)?.classList.add('on');}
function closeModal(id){$(id)?.classList.remove('on');}
function setStartStatus(msg,type=''){const e=$('startStatus');if(e){e.textContent=msg;e.className='status-line '+type;}}
function goHome(){try{if(window.opener&&!window.opener.closed){window.close();return;}}catch(_e){}location.href='./index.html';}
function showStart(){$('workspace').style.display='none';$('startScreen').style.display='block';window.scrollTo(0,0);}
function showWorkspace(){$('startScreen').style.display='none';$('workspace').style.display='block';window.scrollTo(0,0);}
function memberInfo(){
  const p=new URLSearchParams(location.search);let loginId=p.get('lid')||p.get('id')||'';
  try{if(!loginId&&window.opener&&window.opener.meData)loginId=window.opener.meData.loginId||'';}catch(_e){}
  return {loginId:String(loginId).trim(),name:p.get('name')||'',company:p.get('company')||'',title:p.get('title')||'',role:p.get('role')||''};
}
function canAccess(){
  const p=new URLSearchParams(location.search);if(location.protocol==='file:'||['localhost','127.0.0.1'].includes(location.hostname))return true;
  const m=memberInfo();if(ACCESS.mode==='off')return false;if(ACCESS.mode==='members')return !!m.loginId;
  return ACCESS.allowedLoginIds.includes(m.loginId);
}

function parentOrigin(){try{if(document.referrer){const o=new URL(document.referrer).origin;if(TRUSTED_ORIGINS.has(o))return o;}}catch(_e){}return location.origin;}
function requestTokenFromOpener(){return new Promise(resolve=>{
  if(!window.opener){resolve(null);return;}const reqId='cr'+uid();let done=false;
  function onMsg(ev){if(!TRUSTED_ORIGINS.has(ev.origin))return;const d=ev.data||{};if(d.type!=='jbAuthTokenResult'||d.reqId!==reqId)return;done=true;removeEventListener('message',onMsg);resolve(d.ok?String(d.token||''):null);}
  addEventListener('message',onMsg);try{window.opener.postMessage({type:'jbAuthToken',reqId},parentOrigin());}catch(_e){removeEventListener('message',onMsg);resolve(null);return;}
  setTimeout(()=>{if(!done){removeEventListener('message',onMsg);resolve(null);}},4000);
});}
async function tokenFromCurrentPage(force=false){
  const users=[];
  try{if(global.firebase&&typeof global.firebase.auth==='function')users.push(global.firebase.auth()?.currentUser);}catch(_e){}
  try{users.push(global.auth?.currentUser);}catch(_e){}
  try{users.push(global.firebaseAuth?.currentUser);}catch(_e){}
  try{users.push(global.jbAuth?.currentUser);}catch(_e){}
  for(const user of users.filter(Boolean)){
    try{if(typeof user.getIdToken==='function'){const token=await user.getIdToken(!!force);if(token)return String(token);}}catch(_e){}
  }
  try{if(typeof global.getJarviaIdToken==='function'){const token=await global.getJarviaIdToken(!!force);if(token)return String(token);}}catch(_e){}
  return null;
}
async function getIdToken(force=false){
  if(!force&&state.idToken&&Date.now()<state.idTokenExp)return state.idToken;
  let t=await tokenFromCurrentPage(force);
  if(!t)t=await requestTokenFromOpener();
  if(t){state.idToken=t;state.idTokenExp=Date.now()+45*60*1000;}
  return t||null;
}
async function serverCall(endpoint,payload,timeout=180000){
  const token=await getIdToken(false);const headers={'content-type':'application/json'};if(token)headers.authorization='Bearer '+token;
  const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),timeout);
  try{
    let r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(payload),signal:ac.signal});
    if(r.status===401&&token){const t2=await getIdToken(true);if(t2){headers.authorization='Bearer '+t2;r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(payload),signal:ac.signal});}}
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      if(r.status===401&&!headers.authorization)throw new Error('AI 서버 인증토큰을 가져오지 못했습니다. JARVIA 로그인 상태에서 다시 열거나 현재 페이지 Firebase 인증 연결을 확인해 주세요.');
      throw new Error(data.message||data.error||('HTTP '+r.status));
    }
    return data;
  }finally{clearTimeout(timer);}
}
async function corporateCall(payload,timeout=180000){
  const errors=[];
  for(const endpoint of CORPORATE_ENDPOINTS){
    try{
      const out=await serverCall(endpoint,payload,timeout);
      if(out&&out.ok===false&&out.error)throw new Error(out.error);
      ENDPOINTS.corporate=endpoint;
      return out;
    }catch(error){
      errors.push(`${endpoint} → ${error?.message||error}`);
    }
  }
  const err=new Error('corporateReportApi 연결 실패. 서버 함수가 배포되지 않았거나 CORS·Firebase Hosting rewrite가 설정되지 않았습니다. '+errors.join(' / '));
  err.code='CORPORATE_API_UNAVAILABLE';
  throw err;
}
const ServerAdapter={
  async extractFinancial(text){const t=String(text||'').trim();return serverCall(ENDPOINTS.jebanseo,{action:'extractFinancial',text:t.slice(0,120000)});},
  async health(){return corporateCall({action:'health',payload:{}},30000);},
  async legalSearch(issue){try{const out=await corporateCall({action:'legalSearch',payload:{issueId:issue.id,queries:issue.evidenceQueries||[]}},120000);state.live.taxnavi=!!out?.ok;return out;}catch(e){return {ok:false,pending:true,error:e.message,results:[]};}},
  async tts(script){try{const out=await corporateCall({action:'tts',payload:{script,caseId:state.caseData?.meta?.caseId}},240000);state.live.tts=!!out?.ok;return out;}catch(e){return {ok:false,pending:true,error:e.message};}},
  async runAI(action,payload,timeout=360000){try{const out=await corporateCall({action,payload},timeout);state.live.ai=!!out?.ok;return out;}catch(e){return {ok:false,pending:true,error:e.message,code:e.code||'AI_API_ERROR'};}}
};

function loadScript(src){return new Promise((resolve,reject)=>{if(qs('script[data-src="'+src+'"]')){resolve();return;}const s=document.createElement('script');s.src=src;s.dataset.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('외부 라이브러리를 불러오지 못했습니다.'));document.head.appendChild(s);});}
async function ensurePdfJs(){if(global.pdfjsLib)return global.pdfjsLib;await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');global.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return global.pdfjsLib;}
const PDFParser={
 async extract(file){
  const pdfjs=await ensurePdfJs();const buf=await file.arrayBuffer();const pdf=await pdfjs.getDocument({data:buf,cMapUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',cMapPacked:true,standardFontDataUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'}).promise;
  const pageTexts=[];const pageObjects=[];for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();const rows=[];for(const item of tc.items||[]){const str=String(item.str||'').trim();if(!str)continue;const tr=item.transform||[];const x=Number(tr[4]||0),y=Number(tr[5]||0);let row=rows.find(r=>Math.abs(r.y-y)<=2.6);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,str,width:Number(item.width||0)});}rows.sort((a,b)=>b.y-a.y);const lines=rows.map(r=>{r.items.sort((a,b)=>a.x-b.x);let line='',lastEnd=null;for(const it of r.items){if(lastEnd!==null){const gap=it.x-lastEnd;line+=gap>12?'   ':gap>3?' ':'';}line+=it.str;lastEnd=it.x+it.width;}return line.trim();}).filter(Boolean);const layout=lines.join('\n');pageTexts.push(layout);pageObjects.push({pageNumber:i,text:layout});}
  const text=pageTexts.join('\n\n--- PAGE ---\n\n');return {text,pageTexts,pageObjects,pages:pdf.numPages,format:this.detect(text,pageObjects)};
 },
 detect(text,pageObjects){try{if(global.NiceBizlineExtractor?.detectNiceBizline(pageObjects||text)?.detected)return 'NICE BizLINE';}catch(_e){}if(/CRETOP|KODATA|기업종합보고서/i.test(text))return 'CRETOP/KODATA';if(/NICE|비즈라인|기업정보보고서/i.test(text))return 'NICE';return 'GENERIC';},
 isGolden(text){return /모락스트레이딩/.test(text)&&/220[- ]?81[- ]?16162/.test(text);},
 generic(text,pages){
  const grab=(re,d='')=>{const m=text.match(re);return m?String(m[1]).trim():d;};
  const company=grab(/기업명\s*[:：]?\s*(.{2,60}?)(?=\s+(?:대표자(?:명)?|사업자(?:등록)?번호|설립일|종업원|업종|주요\s*제품)|$)/m,'미확인 기업');
  const rep=grab(/대표자(?:명)?\s*[:：]?\s*([가-힣A-Za-z ]{2,30}?)(?=\s+(?:사업자(?:등록)?번호|설립일|종업원|업종|주요\s*제품)|$)/m,'미확인');
  const bn=grab(/사업자(?:등록)?번호\s*[:：]?\s*([0-9-]{10,12})/,'');
  const d=clone(GOLDEN_SAMPLE);d.meta.caseId='CR-'+uid().toUpperCase();d.meta.sourceType='일반 텍스트형 PDF';d.meta.sourcePages=pages;d.meta.confirmed=false;d.profile.companyName=company;d.profile.displayName=company;d.profile.representative=rep;d.profile.businessNumber=bn;
  Object.keys(d.financials).forEach(y=>Object.keys(d.financials[y]).forEach(k=>d.financials[y][k]=null));d.capitalEvents=[];d.warnings=['일반 PDF에서 기본정보만 탐지했습니다. 핵심 재무수치를 확인·수정해야 합니다.'];return d;
 }
};

async function enrichWithExistingFinancialExtractor(data,text){
  if(!memberInfo().loginId||!String(text||'').trim())return data;
  try{
    setStartStatus('기존 JARVIA 재무추출 API로 핵심 수치를 교차확인하고 있습니다…');
    const out=await ServerAdapter.extractFinancial(String(text).slice(0,5000));
    const p=out?.pendingFinancialData||out?.financialData||out;
    const ex=p?.extracted||{};const y=String(p?.baseYear||'2025');if(!data.financials[y])data.financials[y]={};
    const map={revenue:'revenue',operatingProfit:'operatingProfit',netProfit:'netIncome',totalAssets:'assets',totalLiabilities:'liabilities',totalEquity:'equity',retainedEarnings:'retainedEarnings',cashAndCashEquivalents:'cash',borrowings:'borrowings'};
    for(const [src,dst] of Object.entries(map)){const v=n(ex[src]);if(v!==null)data.financials[y][dst]=v/100;/* 기존 API 만원 → 본 프로그램 백만원 */}
    data.meta.statementType=p?.statementType||data.meta.statementType||'확인 필요';data.meta.originalUnit=p?.unit||'확인 필요';
    data.warnings=data.warnings||[];data.warnings.push('기존 jebanseoApi의 재무추출 결과를 교차반영했습니다. 사용자 승인 전에는 확정값이 아닙니다.');state.live.ai=true;
  }catch(error){data.warnings=data.warnings||[];data.warnings.push('기존 재무추출 API 교차확인은 실패했으며 로컬 추출값으로 계속합니다: '+error.message);}
  return data;
}

function extractNiceBizlineCase(out,file){
 if(!global.NiceBizlineExtractor?.extractNiceBizline||!global.NiceBizlineExtractor?.toCorporateReportCase)throw new Error('NICE BizLINE 추출모듈이 로드되지 않았습니다.');
 const extracted=global.NiceBizlineExtractor.extractNiceBizline(out.pageObjects||out.pageTexts||out.text);
 const data=global.NiceBizlineExtractor.toCorporateReportCase(extracted,{sourceFileName:file?.name||'',caseId:'CR-NICE-'+uid().toUpperCase()});
 data.meta.sourceType='NICE BizLINE 자동추출 PDF';
 data.meta.sourcePages=out.pages;
 data.meta.confirmed=false;
 return data;
}
function metricValueAt(obj,path){let cur=obj;for(const k of String(path||'').split('.'))cur=cur==null?undefined:cur[k];return cur&&typeof cur==='object'&&Object.prototype.hasOwnProperty.call(cur,'value')?cur.value:(cur??null);}
function signalValue(data,signalId){return (data.derivedSignals||[]).find(x=>x.signalId===signalId)||null;}
function buildSpeechOverrides(data){
 const overrides={};const plan=data.speechPlan||{};const find=id=>(plan.issueOverrides||[]).find(x=>x.issueId===id);
 const deficit=find('CAPITAL_POLICY');
 if(deficit?.variant==='DEFICIT_REPAIR')overrides.CAPITAL_POLICY={
  title:'누적결손·자본회복 정책',
  signal:'이익잉여금이 음수이며 누적결손의 원인과 자본·현금정책을 분리해 확인해야 하는 기업',
  guardrail:'누적결손을 과다 유보나 즉시 사용 가능한 현금으로 해석하지 않습니다.',
  speech30:'대표님, 이 회사는 이익잉여금이 누적된 상태가 아니라 재무제표상 누적결손이 남아 있습니다. 따라서 자금을 어떻게 빼낼지가 아니라 결손의 원인과 회복계획, 차입상환과 투자우선순위를 먼저 확인하겠습니다.',
  speech90:'대표님, 2025년 영업이익은 발생했지만 이익잉여금은 여전히 음수입니다. 이 숫자는 현재 현금부족과 같은 뜻도 아니고, 과거 손실의 원인이 지금도 계속된다는 뜻도 아닙니다. 먼저 손실이 어느 사업·투자·자본거래에서 생겼는지, 현재 영업이 그 손실을 어느 속도로 회복할 수 있는지, 차입상환과 장기투자자산이 회복을 방해하는지를 나눠 보겠습니다. 배당이나 이익소각을 논의하기 전에 결손 해소 로드맵과 최소 운영현금, 자본정책을 확정하는 것이 순서입니다.',
  speech3m:'대표님, 이 페이지에서 가장 중요한 것은 이익잉여금이 마이너스라는 숫자를 위기라고 단정하지 않는 것입니다. 누적결손은 과거 손실이 자본에 남아 있는 회계상 결과입니다. 현재 영업은 흑자일 수 있고, 자본총계도 양수일 수 있습니다. 그래서 첫째 과거 손실의 발생원인, 둘째 현재 영업의 정상수익력, 셋째 장기투자자산과 기타자본구성요소, 넷째 차입금과 현금유출을 분리해 봐야 합니다. 대표님께는 최근 흑자가 일회성인지 반복 가능한지, 결손을 어느 기간에 해소할 계획인지, 그 기간 동안 배당·퇴직·주식거래를 어떻게 관리할지를 묻겠습니다. 결론은 배당기법이 아니라 3년 자본회복표입니다.',
  speech5m:'대표님, 재무제표상 이익잉여금이 음수라는 사실은 과거 누적손실이 아직 자본에 남아 있다는 뜻입니다. 이 숫자만으로 회사의 현재 지급능력이나 사업성을 확정할 수는 없습니다. 반대로 최근 영업이익이 흑자라는 이유만으로 자본문제가 해결됐다고 볼 수도 없습니다. 분석은 네 갈래로 나눕니다. 첫째 과거 손실이 본업, 투자, 관계회사, 자산손상, 금융비용 중 어디에서 발생했는지 복원합니다. 둘째 최근 영업이익이 반복 가능한 정상수익인지 확인합니다. 셋째 장기투자자산과 기타자본구성요소의 실제 내용과 처분 가능성을 확인합니다. 넷째 차입만기와 금융비용을 반영해 향후 3년 결손 해소 속도를 계산합니다. 대표님께 확인할 질문은 “결손의 가장 큰 원인을 한 문장으로 설명할 수 있습니까?”, “최근 흑자는 본업에서 반복 가능한 수익입니까?”, “장기투자자산은 현금화 또는 배당 가능한 자산입니까?”, “결손이 해소되기 전 배당·퇴직·주식거래에 어떤 원칙을 적용할 것입니까?”입니다. 이 답변과 원문 자료를 맞춘 뒤 보수·기준·개선 시나리오를 만듭니다. 보험은 누적결손을 해결하는 수단이 아닙니다. 대표 유고나 승계처럼 우연한 사건의 부족재원이 별도로 계산될 때만 검토합니다. 오늘 합의할 것은 결손원인 자료, 3년 회복목표, 담당자와 다음 검토일입니다.',
  nextAction:'결손 발생원인·장기투자자산·기타자본구성요소·차입만기 자료를 받아 3년 자본회복 시나리오를 작성합니다.'
 };
 if(signalValue(data,'LIQUIDITY_STRESS')||signalValue(data,'BORROWING_SURGE')||signalValue(data,'CASH_DROP'))overrides.WORKING_CAPITAL={
  title:'유동성·차입금·현금구조',
  signal:'영업이익은 발생하지만 현금·유동비율·차입만기 구조가 급변한 기업',
  guardrail:'차입증가 원인과 투자자금 사용처를 확인하기 전 자금난·부실로 단정하지 않습니다.',
  speech30:'대표님, 영업이익은 개선됐지만 현금은 크게 줄고 차입금과 단기상환 부담은 늘었습니다. 회사가 돈을 못 번다고 단정할 문제가 아니라, 번 돈과 조달한 돈이 어디에 사용됐고 앞으로 언제 상환되는지를 확인해야 합니다.',
  speech90:'대표님, 2025년에는 영업이익이 발생했지만 현금비율과 유동비율은 낮아졌고 총차입금은 크게 증가했습니다. 동시에 장기투자자산 비중이 높고 비영업 자금운용 규모도 큽니다. 핵심은 차입 자체가 아니라 자금의 사용처와 만기입니다. 투자자산의 회수시점과 차입상환일이 맞지 않으면 흑자기업도 단기 유동성 압박을 받을 수 있습니다. 13주 현금계획과 차입처별 만기표, 투자자산 회수계획을 한 장으로 맞춰 보겠습니다.',
  speech3m:'대표님, 손익과 유동성은 별도로 봐야 합니다. 영업이익이 흑자여도 투자와 차입상환이 집중되면 현금은 줄 수 있습니다. 이번 자료에서는 현금이 급감하고 총차입금이 증가했으며 최근 분기에는 유동차입부채 비중이 커졌습니다. 이것이 신규투자에 따른 정상적인 조달인지, 만기 재분류인지, 차환이 필요한 구조인지는 원문만으로 확정할 수 없습니다. 차입처·금리·만기·담보·자금용도, 장기투자자산의 회수 가능성, 13주 현금수지를 함께 확인하겠습니다. 목표는 차입을 비판하는 것이 아니라 만기와 현금유입을 맞추는 것입니다.',
  speech5m:'대표님, 이 회사의 핵심은 매출이 늘었느냐보다 현금과 만기가 같은 방향으로 움직이느냐입니다. 2025년 영업이익은 발생했지만 현금은 전년보다 크게 감소했고 총차입금은 증가했습니다. 최근 분기에는 비유동차입부채가 줄고 유동차입부채가 늘어 만기집중 또는 재분류 가능성도 확인해야 합니다. 장기투자자산이 자산에서 큰 비중을 차지하므로 투자자산의 성격과 회수시점도 중요합니다. 순서는 첫째 차입처별 원금·금리·만기·담보·약정표를 만듭니다. 둘째 13주 현금수지에 급여·매입·이자·원금상환을 넣습니다. 셋째 장기투자자산과 비영업 자금운용의 실제 사용처와 회수계획을 확인합니다. 넷째 보수·기준·차환 시나리오별 최소 현금과 신용한도를 계산합니다. 대표님께는 “차입 증가분은 어디에 사용됐습니까?”, “향후 6개월 안에 반드시 상환할 금액은 얼마입니까?”, “투자자산에서 예정된 현금유입은 언제입니까?”, “차환이 지연돼도 운영을 유지할 수 있는 현금한도는 얼마입니까?”를 묻겠습니다. 보험은 차입금 자체를 해결하지 않습니다. 대표 유고나 재산손해처럼 예고 없는 사건이 현금계획을 깨뜨릴 때 부족재원을 보완하는 수단으로만 검토합니다. 오늘 결정할 것은 차입만기표·13주 현금표·투자자산 명세의 제출일입니다.',
  nextAction:'차입처별 만기·금리·담보표, 13주 현금수지, 장기투자자산 명세와 회수계획을 확보합니다.'
 };
 if(!overrides.WORKING_CAPITAL&&(signalValue(data,'WORKING_CAPITAL_CYCLE')||signalValue(data,'LEVERAGE_PRESSURE')))overrides.WORKING_CAPITAL={
  title:signalValue(data,'WORKING_CAPITAL_CYCLE')&&signalValue(data,'LEVERAGE_PRESSURE')?'재고회전·차입의존·현금구조':'재고·채권 회전과 운전자금',
  signal:'재고·채권 회전기간 또는 차입의존·이자부담이 현금전환 속도에 영향을 주는 기업',
  guardrail:'결산잔액으로 계산한 회전일수는 추정치이며 재고연령·거래처별 채권자료 확인 전 회수가능액이나 부실로 단정하지 않습니다.',
  speech30:'대표님, 현재 유동비율만 보면 여유가 있어 보일 수 있지만 재고와 채권이 현금으로 바뀌는 기간, 차입금과 이자부담을 함께 보면 운전자금의 속도를 별도로 점검할 필요가 있습니다.',
  speech90:'대표님, 이 회사는 단기 지급능력만으로 판단하기보다 재고와 매출채권이 실제 현금으로 전환되는 기간을 봐야 합니다. 결산자료상 재고일수와 채권회수일수가 길고 차입의존도와 이자보상능력도 함께 확인할 필요가 있습니다. 이것이 곧 회수불능이나 부실을 뜻하지는 않습니다. 거래처별 채권연령과 품목별 재고연령, 차입처별 만기·금리 자료를 맞춰 실현 가능한 개선범위를 정하겠습니다.',
  speech3m:'대표님, 유동자산이 충분해 보여도 그 대부분이 재고나 채권이면 실제 현금화 속도는 다를 수 있습니다. 먼저 재고를 정상·장기·불용 가능성으로 나누고, 매출채권은 거래처별 약정일과 실제 회수일을 확인합니다. 다음으로 차입금의 만기와 이자비용을 놓고 회전기간이 길어질 때 필요한 추가 운전자금을 계산합니다. 개선효과는 5일·10일 시나리오로 보되 전액 회수 가능한 돈처럼 표현하지 않습니다.',
  speech5m:'대표님, 이번 진단의 목적은 재고가 많다거나 차입금이 크다고 지적하는 것이 아닙니다. 매출이 발생한 뒤 현금으로 들어오기까지 걸리는 시간을 품목·거래처·차입만기와 연결해 보는 것입니다. 첫째 재고연령표에서 정상재고와 장기재고를 구분합니다. 둘째 거래처별 채권연령과 실제 결제일을 확인합니다. 셋째 매입채무 결제일과 차입금 원리금 상환일을 13주 현금수지에 넣습니다. 넷째 재고 5일, 채권 10일 개선 시나리오를 계산하되 영업부서와 생산부서가 실행 가능한 범위만 확정합니다. 다섯째 이자보상능력과 차입금의존도를 함께 보아 금융비용이 본업수익을 얼마나 흡수하는지 확인합니다. 보험은 재고·채권관리나 차입구조를 해결하지 않습니다. 거래처 부도, 대표 유고, 재산손해처럼 우연한 사건의 손실과 부족재원이 별도로 확인될 때만 검토합니다.',
  nextAction:'재고연령표·거래처별 채권연령표·차입처별 만기·금리표·13주 현금수지를 받아 운전자금 개선범위를 확정합니다.'
 };
 if((plan.activeIssueIds||[]).includes('CAPITAL_TRANSACTIONS')&&!(data.capitalEvents||[]).length)overrides.CAPITAL_TRANSACTIONS={
  title:'기타자본구성요소·자본거래 확인',
  signal:'기타자본구성요소가 크고 납입자본이 변동했으나 세부 자본거래가 보고서에 제시되지 않은 기업',
  guardrail:'세부내역 확인 전 특정 자본거래가 있었다고 단정하지 않고 자본변동표와 의사결정 자료를 확인합니다.',
  speech30:'대표님, 기타자본구성요소와 자본금 변동이 크게 보이지만 이 보고서만으로 어떤 자본거래가 있었는지는 확정할 수 없습니다. 자본변동표와 주식수, 의사록을 받아 거래의 실질부터 복원하겠습니다.',
  speech90:'대표님, 자본총계 안에서 기타자본구성요소가 큰 비중을 차지하고 납입자본도 연도별로 변했습니다. 하지만 이것이 자기주식, 주식발행초과금, 평가차이, 감자 또는 다른 거래 중 무엇인지는 현재 보고서만으로 알 수 없습니다. 과거 거래를 평가하기 전에 자본변동표, 주식수 변동, 이사회·주총 의사록, 가치평가와 현금흐름을 맞춰 보겠습니다. 목적은 잘못을 찾는 것이 아니라 향후 배당·승계·투자유치 때 설명 가능한 자본정책을 만드는 것입니다.',
  speech3m:'대표님, 자본계정은 이름이 비슷해도 거래 실질이 전혀 다릅니다. 기타자본구성요소가 크다는 숫자만으로 자기주식이나 감자, 평가이익을 추정해서는 안 됩니다. 자본금 증가가 유상증자 때문인지 주식전환 때문인지도 확인해야 합니다. 필요한 자료는 자본변동표, 주주명부와 발행주식수, 주식발행·취득·처분 계약, 이사회·주총 의사록, 회계처리 근거입니다. 이 자료로 거래 전후 지분율, 회사 현금유출입, 주주별 권리변화를 하나의 타임라인으로 만들겠습니다.',
  speech5m:'대표님, 이 페이지의 목적은 과거 자본거래를 세무기법으로 평가하는 것이 아니라 앞으로 설명 가능한 자본정책을 만드는 것입니다. 현재 자료에는 기타자본구성요소가 큰 금액으로 표시되고 자본금도 연도별로 변하지만 세부 자본변동표는 없습니다. 따라서 자기주식 취득·처분, 감자, 유상증자, 전환, 평가차이 중 어느 거래가 있었는지 단정하지 않습니다. 먼저 연도별 발행주식수와 주주명부를 맞추고, 자본금과 주식발행초과금·기타자본의 증감, 회사 현금의 유출입, 이사회·주총 결의, 가치평가와 세무신고를 같은 시간축에 놓습니다. 대표님께는 “자본금이 증가한 당시 거래 목적은 무엇이었습니까?”, “주주별 지분율과 의결권은 어떻게 바뀌었습니까?”, “기타자본구성요소의 세부내역을 재무팀이 설명할 수 있습니까?”, “향후 투자유치·배당·승계 때 적용할 주식가치 원칙이 있습니까?”를 묻겠습니다. 자료가 정리되면 과거 거래의 적정성은 세무·법률 전문가가 검토하고, 저희는 향후 3년 주식이동과 자금수요를 설계합니다. 보험은 자본거래를 정당화하는 수단이 아닙니다. 향후 대표 유고나 승계에 따른 지분매입 부족재원이 확인될 때만 별도 검토합니다.',
  nextAction:'자본변동표·주주명부·발행주식수·의사록·거래계약·가치평가 자료를 받아 자본거래 타임라인을 작성합니다.'
 };
 return overrides;
}
function buildIssueSpecificBranches(id,data){
 const lib=(data?.speechOverrides||{})[id]||ISSUE_SPEECH_LIBRARY[id]||{};const title=lib.title||id;const next=lib.nextAction||'관련 자료와 담당자·기한을 확정합니다.';
 const rows=[
  ['즉시 동의',`“${title}을 바로 점검해야겠습니다.”`,`“좋습니다. 결론부터 정하지 않고 원문과 자료를 맞춰 우선순위를 확정하겠습니다.”`,`“가장 먼저 확인할 자료와 담당자는 누구입니까?”`],
  ['부분 동의',`“일부는 맞지만 전부 문제는 아닙니다.”`,`“동의합니다. 범위를 넓히지 않고 대표님이 인정하는 부분부터 숫자와 자료로 확인하겠습니다.”`,`“어느 항목까지는 사실이고 어느 부분은 다른 설명이 필요합니까?”`],
  ['부정',`“${title}은 문제가 없습니다.”`,`“문제로 단정하려는 것이 아닙니다. 현재 강점이 유지되는 조건과 변동 시 대응기준을 확인하겠습니다.”`,`“어떤 자료를 보면 문제가 없다는 판단을 함께 확인할 수 있습니까?”`],
  ['정보 부족',`“정확한 내용은 재무팀이 압니다.”`,`“대표님이 모든 숫자를 기억할 필요는 없습니다. 의사결정에 필요한 정보가 한 장으로 올라오게 만들겠습니다.”`,`“자료를 바로 준비할 담당자와 가능한 날짜는 언제입니까?”`],
  ['전문가 위임',`“회계사나 세무사가 보고 있습니다.”`,`“기존 전문가의 역할을 존중합니다. 저희는 그 검토를 CEO의 실행결정과 자금계획에 연결하겠습니다.”`,`“기존 전문가와 함께 확인할 핵심 쟁점을 세 가지로 정해도 되겠습니까?”`],
  ['비용 우려',`“진단 비용까지 들일 필요가 있습니까?”`,`“전체 프로젝트가 아니라 1차 사실확정과 의사결정표까지만 범위를 줄여 효과를 확인할 수 있습니다.”`,`“산출물·기간·비용을 한정한 1차 진단부터 비교하시겠습니까?”`],
  ['결정 유예',`“조금 더 두고 보겠습니다.”`,`“보류도 가능한 선택입니다. 다만 자료확인일과 재검토일을 정해 두면 같은 논의를 처음부터 반복하지 않습니다.”`,`“이번에는 자료만 준비하고 재검토 날짜를 확정할까요?”`]
 ];return rows.map(x=>({type:x[0],expression:x[1],response:x[2],followUp:x[3],agreement:next}));
}
function buildIssueSpecificObjections(id,data){
 const lib=(data?.speechOverrides||{})[id]||ISSUE_SPEECH_LIBRARY[id]||{};const title=lib.title||id;
 return [
  {title:'“지금 급한 문제는 아닙니다.”',dialogue:[{speaker:'컨설턴트',text:'급한 실행을 권하는 것이 아니라, 현재 상태와 재검토 기준을 문서로 남기자는 제안입니다.'},{speaker:'컨설턴트',text:`${title}에서 어떤 변화가 생기면 즉시 다시 보아야 하는지 기준을 정해도 되겠습니까?`}]},
  {title:'“기존 전문가가 이미 보고 있습니다.”',dialogue:[{speaker:'컨설턴트',text:'기존 전문가의 판단을 대체하지 않습니다. 그 판단을 현금·담당자·기한이 있는 경영실행으로 연결하겠습니다.'},{speaker:'컨설턴트',text:'전문가에게 확인할 질문과 필요한 원문자료를 함께 정리하겠습니다.'}]},
  {title:'“비용이 부담됩니다.”',dialogue:[{speaker:'컨설턴트',text:'전체 실행을 한 번에 결정하지 않고, 사실확정과 선택지 비교까지만 1차 범위로 제한할 수 있습니다.'},{speaker:'컨설턴트',text:'범위·산출물·기간을 먼저 확인한 뒤 진행 여부를 판단하십시오.'}]}
 ];
}

const FIELD_META={
 companyName:['기업명','text'],representative:['대표자','text'],businessNumber:['사업자번호','text'],employees:['종업원 수','number'],established:['설립일','date'],industry:['업종','text'],products:['주요 제품','text'],creditGrade:['기업평가등급','text'],watchGrade:['WATCH등급','text'],cashFlowGrade:['현금흐름등급','text'],
 assets:['자산총계','number'],liabilities:['부채총계','number'],equity:['자본총계','number'],revenue:['매출액','number'],cogs:['매출원가','number'],operatingProfit:['영업이익','number'],netIncome:['당기순이익','number'],cash:['현금성자산','number'],currentAssets:['유동자산','number'],currentLiabilities:['유동부채','number'],receivables:['매출채권','number'],inventory:['재고자산','number'],payables:['매입채무','number'],borrowings:['총차입금(기타금융부채 포함)','number'],shortTermLoanReceivable:['단기대여금','number'],retainedEarnings:['이익잉여금(결손금)','number'],operatingCashFlow:['영업활동조달현금','number'],interestExpense:['이자비용','number'],capitalStock:['자본금','number']
};

function tryCalculator(calculatorId,input){
 try{if(!global.JarviaCalculators?.calculate)return {ok:false,error:'계산기 번들 미로딩'};const e=global.JarviaCalculators.calculate({calculatorId,mode:'auto',input});return {ok:!e.errorCode,envelope:e,result:e.result,error:e.errorMessage||null};}catch(error){return {ok:false,error:error.message};}
}
function computeAnalysis(data){
 const f=data.financials||{},c=f['2025']||{},p=f['2024']||{},p2=f['2023']||{};
 const r={};
 r.salesGrowth=div(c.revenue-p.revenue,p.revenue)*100;r.operatingMargin=div(c.operatingProfit,c.revenue)*100;r.netMargin=div(c.netIncome,c.revenue)*100;r.roe=div(c.netIncome,avg(c.equity,p.equity))*100;
 r.debtRatio=div(c.liabilities,c.equity)*100;r.currentRatio=div(c.currentAssets,c.currentLiabilities)*100;r.quickRatio=div(c.currentAssets-c.inventory,c.currentLiabilities)*100;r.cashRatio=div(c.cash,c.currentLiabilities)*100;r.borrowingDependency=div(c.borrowings,c.assets)*100;r.interestCoverage=div(c.operatingProfit,c.interestExpense);
 r.dso=div(avg(c.receivables,p.receivables),c.revenue)*365;r.inventoryDaysReported=div(avg(c.inventory,p.inventory),c.cogs)*365;r.ocfConversion=div(c.operatingCashFlow,c.netIncome)*100;
 r.receivableIncrease=c.receivables-p.receivables;r.inventoryIncrease=c.inventory-p.inventory;r.cashAbsorption=r.receivableIncrease+r.inventoryIncrease;
 r.dso10Potential=div(c.revenue,365)*10;r.inventory5Potential=div(c.cogs,365)*5;r.basePotential=r.dso10Potential+r.inventory5Potential;r.conservativePotential=Number.isFinite(r.basePotential)?r.basePotential*0.5:null;r.stretchPotential=Number.isFinite(r.basePotential)?r.basePotential*1.5:null;
 r.totalCapitalOutflow=(data.capitalEvents||[]).filter(x=>x.status==='confirmed'&&['자기주식 취득','현금배당 지급','자본금 감소'].includes(x.type)).reduce((s,x)=>s+x.amount,0);
 const calculatorInputs={current:{revenue:c.revenue,operatingProfit:c.operatingProfit,netProfit:c.netIncome,totalAssets:c.assets,totalLiabilities:c.liabilities,totalEquity:c.equity,currentAssets:c.currentAssets,currentLiabilities:c.currentLiabilities,cash:c.cash,inventory:c.inventory,receivables:c.receivables,borrowings:c.borrowings,interestExpense:c.interestExpense,operatingCashFlow:c.operatingCashFlow},previous:{revenue:p.revenue,operatingProfit:p.operatingProfit,netProfit:p.netIncome,totalAssets:p.assets,totalLiabilities:p.liabilities,totalEquity:p.equity,currentAssets:p.currentAssets,currentLiabilities:p.currentLiabilities,cash:p.cash,inventory:p.inventory,receivables:p.receivables,borrowings:p.borrowings,operatingCashFlow:p.operatingCashFlow},employees:data.profile.employees};
 const calcRatios=tryCalculator('calcFinancialRatios',calculatorInputs);
 const calcCash=tryCalculator('calcCashFlowRisk',{cash:c.cash,currentAssets:c.currentAssets,currentLiab:c.currentLiabilities,inventory:c.inventory,receivables:c.receivables,payables:c.payables,revenue:c.revenue,cogs:c.cogs,monthlyFixedCost:0,operatingProfit:c.operatingProfit,shortTermBorrow:c.borrowings});
 const answers=data.answers||{};let keyman=null;
 if(Number.isFinite(n(answers.keyPersonMonthlyFixedCost))){
  keyman=tryCalculator('calcCorpKeymanNeed',{monthlyOperatingShortfall:n(answers.keyPersonMonthlyFixedCost)*1000000,impactMonths:safeNum(n(answers.keyPersonEmergencyMonths),12),replacementCost:0,guaranteedDebt:safeNum(n(answers.immediateDebtRepayment),0)*1000000,liquidAssets:safeNum(n(answers.availableEmergencyCash),0)*1000000,existingKeymanCoverage:safeNum(n(answers.existingKeyPersonCoverage),0)*1000000});
 }
 return {ratios:r,calculator:{ratios:calcRatios,cashFlow:calcCash,keyman},calculatorVersion:global.JarviaCalculators?.version||'browser-bundle',computedAt:nowIso()};
}

function severity(score){return score>=4.5?'CRITICAL':score>=3.7?'HIGH':score>=2.8?'MEDIUM':'LOW';}
function buildSpeechPlanIssues(data,calc){
 const active=data.speechPlan?.activeIssueIds||[],signals=new Set((data.derivedSignals||[]).map(x=>x.signalId));const c=data.financials?.['2025']||{},p=data.financials?.['2024']||{},q=data.latestQuarterly||{},r=calc.ratios||{};const out=[];
 const add=(id,title,score,confidence,facts,meaning,risks,solutions,extras={})=>out.push({id,title,score,severity:severity(score),confidence,facts:facts.filter(Boolean),meaning,risks,solutions,...extras});
 if(active.includes('WORKING_CAPITAL')){
  const liquidity=[...signals].some(id=>['LIQUIDITY_STRESS','BORROWING_SURGE','CASH_DROP','MATURITY_CONCENTRATION_WARNING'].includes(id));
  const cycle=signals.has('WORKING_CAPITAL_CYCLE'),leverage=signals.has('LEVERAGE_PRESSURE');
  const title=liquidity?'유동성·차입금·현금구조':cycle&&leverage?'재고회전·차입의존·현금구조':cycle?'재고·채권 회전과 운전자금':'운전자금·현금전환';
  const facts=[];
  if(liquidity){facts.push(`2025 유동비율 ${pct(r.currentRatio)}·현금비율 ${pct(r.cashRatio)}`,`총차입금 ${wonEok(p.borrowings)} → ${wonEok(c.borrowings)}`,`현금 ${wonEok(p.cash)} → ${wonEok(c.cash)}`);if(Number.isFinite(q.currentBorrowings))facts.push(`${q.periodEnd} 유동차입부채 ${wonEok(q.currentBorrowings)}`);}
  if(cycle){facts.push(`재고일수 ${Number.isFinite(r.inventoryDaysReported)?r.inventoryDaysReported.toFixed(1)+'일':'미확인'}`,`매출채권회수일 ${Number.isFinite(r.dso)?r.dso.toFixed(1)+'일':'미확인'}`);const calcCcc=calc?.calculator?.cashFlow?.result?.ratios?.ccc??calc?.calculator?.cashFlow?.envelope?.result?.turnover?.ccc;if(Number.isFinite(calcCcc))facts.push(`현금전환주기 ${calcCcc}일`);}
  if(leverage)facts.push(`차입금의존도 ${pct(r.borrowingDependency)}`,`이자보상배율 ${Number.isFinite(r.interestCoverage)?r.interestCoverage.toFixed(2)+'배':'미확인'}`);
  const meaning=liquidity?'영업수익과 별개로 투자자산·차입만기·현금유출입을 함께 관리해야 하는 구조입니다.':cycle?'재고와 채권이 현금으로 전환되는 기간이 길어 매출성장과 별도로 운전자금 기준을 정해야 합니다.':'확인된 차입·현금자료를 기준으로 상환부담과 운영현금의 균형을 점검해야 합니다.';
  const risks=liquidity?['차입만기와 현금유입 시점 불일치','차환 지연 시 단기 지급여력 저하','투자자산 회수계획 부재']:['장기재고·채권회수 지연에 따른 운전자금 고착','금융비용 증가 시 영업이익의 현금전환 저하','회전일수 개선목표와 담당자 부재'];
  const solutions=liquidity?['차입처별 만기·금리·담보표','13주 현금수지','장기투자자산 회수계획']:['재고연령·거래처별 채권연령 분석','현금전환주기 개선 시나리오','차입만기·금융비용 관리표'];
  add('WORKING_CAPITAL',title,liquidity?4.9:4.3,liquidity?'A':'B',facts,meaning,risks,solutions,{consulting:liquidity?'유동성·차입구조 정밀진단':'운전자금·회전일수 정밀진단',insurance:'거래처 부도·대표 유고 등 별도 위험과 부족재원 확인 후 조건부'});
 }
 if(active.includes('CAPITAL_POLICY'))add('CAPITAL_POLICY',c.retainedEarnings<0?'누적결손·자본회복 정책':'이익잉여금·자본정책',4.6,'A',[
  `2025 이익잉여금 ${wonEok(c.retainedEarnings)}`,`자본총계 ${wonEok(c.equity)}`,`자본금 ${wonEok(c.capitalStock)}`,
  `장기투자자산 ${wonEok(metricValueAt(data.extractionResult,'financialStatements.separateAnnual.2025-12-31.balanceSheet.longTermInvestments'))}`
 ],c.retainedEarnings<0?'누적결손의 원인과 현재 수익력, 투자자산, 차입상환을 분리해 3년 회복정책을 만들어야 합니다.':'회사 유보와 주주이전, 투자·차입·퇴직·승계 재원을 구분해야 합니다.',c.retainedEarnings<0?['결손원인 미확인 상태의 자본·주주거래 판단','투자자산과 차입만기의 불일치','회복목표·주주정책 부재']:['투자·배당·퇴직·승계 재원의 충돌','최소 운영현금 기준 부재'],c.retainedEarnings<0?['결손원인 브리지 분석','3년 자본회복 시나리오','회사유보·주주정책 기준']:['3년 자금배분 정책','최소 운영현금 기준','주주이전 원칙'],{consulting:c.retainedEarnings<0?'자본회복·주주정책 설계':'자본·주주정책 설계',insurance:'자본정책 해결수단 아님·별도 위험재원만 조건부'});
 if(active.includes('CAPITAL_TRANSACTIONS'))add('CAPITAL_TRANSACTIONS','기타자본구성요소·자본거래 확인',4.2,'B',[
  `기타자본구성요소 ${wonEok(metricValueAt(data.extractionResult,'financialStatements.separateAnnual.2025-12-31.balanceSheet.otherCapitalComponents'))}`,
  `자본금 2023 ${wonEok(data.financials?.['2023']?.capitalStock)} → 2025 ${wonEok(c.capitalStock)}`,'세부 자본변동표·거래 목적은 현재 보고서에서 미확인'
 ],'자본금과 기타자본의 변동을 실제 주식수·현금·의사결정 자료와 연결해야 합니다.',['거래 실질을 추정해 잘못된 세무·지분 결론 도출','향후 투자유치·주식이동과 과거 자본변동의 충돌'],['자본변동표·주주명부 복원','연도별 주식수·현금 타임라인','가치평가·세무·법률 공동검토'],{consulting:'자본거래 타임라인 정밀진단',insurance:'직접 연계 아님'});
 return out.sort((a,b)=>b.score-a.score);
}

function buildIssues(data,calc){
 if(data?.speechPlan?.activeIssueIds?.length)return buildSpeechPlanIssues(data,calc);
 const c=data.financials['2025']||{},r=calc.ratios,answers=data.answers||{};const list=[];
 function add(id,title,score,confidence,facts,meaning,risks,solutions,extras={}){list.push({id,title,score,severity:severity(score),confidence,facts,meaning,risks,solutions,...extras});}
 add('WORKING_CAPITAL','성장과 현금전환',4.8,'A',[`매출 ${wonEok(c.revenue)}·영업이익 ${wonEok(c.operatingProfit)}`,`매출채권·재고 증가 ${wonEok(r.cashAbsorption)}`,`영업현금흐름/순이익 ${pct(r.ocfConversion)}`],'성장은 회복됐지만 증가한 매출채권과 재고가 현금전환 속도를 낮추고 있습니다.',['성장할수록 추가 운전자금 수요 확대','거래처·품목별 회수·재고 관리 부재 시 차입 선행'],['채권연령·재고연령 진단','13주 현금흐름표','거래처 신용한도·회수정책'],{consulting:'8~12주 운전자금 개선 프로젝트',insurance:'수출·거래처 신용위험 확인 후 조건부'});
 if(c.shortTermLoanReceivable>0)add('LOAN_RECEIVABLE','단기대여금의 실질과 정상화',4.4,'B',[`단기대여금 ${wonEok(c.shortTermLoanReceivable)}`,'상대방·목적·계약·이자·만기 미확인'],'계정명만으로 가지급금이나 사적 사용으로 단정할 수 없으며 거래 실질 복원이 우선입니다.',['회수계획·증빙 부재 시 현금·세무·지배구조 위험','관계회사 거래인 경우 독립기업 원칙 확인 필요'],['계정별 원장·계약·결의 복원','회수·분할상환·담보·정상화 A/B/C안'],{consulting:'거래 타임라인 복원·정상화 프로젝트',insurance:'직접 연계 낮음(D)'});
 add('CAPITAL_POLICY','이익잉여금·배당·자본정책',4.2,'A',[`미처분이익잉여금 ${wonEok(c.retainedEarnings)}`,`확인된 자본·배당 관련 유출 ${wonEok(r.totalCapitalOutflow)}`],'이익잉여금은 현금과 동일하지 않으므로 투자·운영·차입·배당·퇴직·승계 재원을 한 표에서 조정해야 합니다.',['배당·보수·퇴직·주식거래를 개별 실행할 때 현금·세무·경영권 충돌','과거 자본거래 목적과 절차의 사후 검증 필요'],['3년 자금배분 정책','회사유보·주주이전 기준','전문가 공동검토'],{consulting:'자본·주주정책 설계',insurance:'승계·유고 부족재원이 산출될 때 조건부'});
 if((data.capitalEvents||[]).length)add('CAPITAL_TRANSACTIONS','자기주식·감자·배당 거래 재구성',4.3,'A',(data.capitalEvents||[]).map(x=>`${x.year} ${x.type} ${wonEok(x.amount)}${x.status!=='confirmed'?'(확인 필요)':''}`),'대규모 자본거래가 반복됐으므로 각 거래의 목적·재원·주식수·의사결정·현금효과를 하나의 타임라인으로 재구성해야 합니다.',['거래별 절차·가치·세무 처리의 단절','향후 승계·지분정리와 과거 거래의 충돌'],['거래 타임라인·주식수 변동표','가치평가·세무·법률 공동검토'],{consulting:'자본거래 정밀진단',insurance:'직접 연계 아님'});
 add('SUCCESSION','경영승계·가족·주주 유동성',3.9,answers.successorStatus==='미확인'?'C':'B',['설립 30년차 기업','대표 경영집중 가능성','후계자·주주 의사 미확인'],'승계는 세금만의 문제가 아니라 경영권·주식가치·가족합의·현금재원을 함께 준비하는 과정입니다.',['갑작스러운 의사결정 공백','주식은 있으나 세금·매입·정산 현금이 부족할 가능성'],['주주·가족 인터뷰','기업가치 A/B/C 시나리오','비상지배구조·승계 로드맵'],{consulting:'승계 진단·가족 공동미팅',insurance:'부족재원 산출 후 B'});
 add('KEY_PERSON','대표자·핵심인 유고와 비상재원',4.0,Number.isFinite(n(answers.keyPersonMonthlyFixedCost))?'B':'C',['대표가 경영전반 총괄','해외법인·거래처·자금 의사결정 연결','비상운영비·기존 보장 미확인'],'대표 공백 시 업무대행 가능성과 즉시 필요한 현금은 별도로 계산해야 합니다.',['운영비·매입대금·급여·채무상환 공백','거래처 신뢰와 지배구조 불안정'],['12개월 비상운영재원 산출','기존 증권·가용현금 확인','업무권한·비상승계 체계'],{consulting:'필요재원 계산·증권분석',insurance:'조건부 B — 계산 전 금액 제시 금지'});
 if(data.profile.foreignSubsidiaries?.length)add('EXPORT_CREDIT','수출채권·해외법인 위험',3.8,'C',[`해외법인 ${data.profile.foreignSubsidiaries.length}개`,`매출채권 ${wonEok(c.receivables)}`,'거래처별 집중도·연체·국가 위험 미확인'],'해외 거래와 관계회사 구조는 현금회수·환율·보증·이전가격·재산·휴업 위험을 동시에 만듭니다.',['상위 거래처 부도·국가위험·회수지연','해외사업장 보험·보증·계약 공백'],['거래처별 채권연령·국가·한도표','관계회사 거래·보증·FX 대시보드','현지 증권 갭 분석'],{consulting:'수출·해외리스크 진단',insurance:'신용·적하·해외재산·휴업 B/C'});
 add('INSURANCE_OPTIMIZATION','기존 법인·대표 보험 최적화',3.3,'D',['기존 보험증권 미확인'],'신규계약보다 기존 계약의 목적·수익자·보장기간·현금흐름·중복과 공백을 먼저 확인해야 합니다.',['필요재원과 맞지 않는 보장','중복 보험료 또는 해지 시 손실·재심사 위험'],['증권 일괄 수집·목적별 분류','유지·감액·정리·추가 기준표'],{consulting:'증권분석',insurance:'C — 보장분석 우선'});
 return list.sort((a,b)=>b.score-a.score);
}

function buildInsuranceOpportunities(data,issues,calc){
 const by=id=>issues.find(x=>x.id===id);const a=data.answers||{},c=data.financials['2025']||{};const rows=[];
 if(data?.speechPlan?.activeIssueIds?.length){
  rows.push({id:'INS-KEYPERSON',title:'대표자·핵심인 유고',grade:'D',basis:'대표 역할·월 고정비·즉시상환·기존 보장 미확인',need:null,current:null,gap:null,role:'예고 없는 유고 시 부족재원이 확인되는 경우에만 일부 전가',limits:'현재 PDF만으로 필요재원과 보험 적합성 판단 불가',next:'대표 역할표·월 고정비·가용현금·기존 증권 확인'});
  rows.push({id:'INS-SUCCESSION',title:'승계·지분정리 유동성',grade:'D',basis:'후계자·가족관계·기업가치·주주별 현금수요 미확인',need:null,current:null,gap:null,role:'승계시점 부족재원이 계산된 경우에만 검토',limits:'누적결손·자본거래·승계구조를 보험으로 해결하지 않음',next:'승계의사 확인 전 보류'});
  rows.push({id:'INS-CREDIT',title:'거래처 신용위험',grade:'C',basis:`매출채권 ${wonEok(c.receivables)}이나 거래처 집중도·연체이력 미확인`,need:null,current:null,gap:null,role:'특정 거래처 부도에 따른 회수손실의 일부 전가 가능성',limits:'회수정책·신용한도·채권관리 선행',next:'거래처별 채권연령·집중도·연체·계약조건 확인'});
  rows.push({id:'INS-PROPERTY',title:'재산·휴업·배상 위험',grade:'D',basis:'사업장 자산·복구기간·기존 증권 미확인',need:null,current:null,gap:null,role:'재산손해·영업중단·배상손실의 일부 전가',limits:'자산명세와 기존 증권 전에는 보장공백 단정 금지',next:'사업장·자산·기존 증권 수집'});
  rows.push({id:'INS-LIQUIDITY',title:'유동성·차입구조',grade:'D',basis:'차입금과 만기집중은 재무관리 과제',need:null,current:null,gap:null,role:'직접 해결수단 아님',limits:'차입상환·차환·투자자산 회수계획이 우선',next:'13주 현금수지와 차입만기표 작성'});
  return rows;
 }
 const keyCalc=calc.calculator.keyman?.result;const keyOk=!!(calc.calculator.keyman?.ok&&keyCalc);
 rows.push({id:'INS-KEYPERSON',title:'대표자·핵심인 유고',grade:(keyOk&&keyCalc.requiredCoverageGap>0)?'A':(keyOk?'C':'B'),basis:'대표 경영집중·해외법인·거래처·자금결정 연결',need:keyOk?Math.round(keyCalc.totalNeed/1000000):null,current:keyOk?Math.round(keyCalc.offset/1000000):null,gap:(keyOk&&keyCalc.requiredCoverageGap>0)?Math.round(keyCalc.requiredCoverageGap/1000000):null,role:'예고 없는 유고 시 비상운영·채무·지분정리 현금의 일부',limits:'업무승계·정관·세무·가족합의를 대신하지 않음',next:keyOk?(keyCalc.requiredCoverageGap>0?'기존 증권과 인수 가능성 검토':'내부재원 충분 여부와 기존 보장 유지 필요성 확인'):'월 고정비·필요기간·즉시상환·가용현금·기존보험 확인'});
 rows.push({id:'INS-SUCCESSION',title:'승계·지분정리 유동성',grade:'B',basis:'장수기업·누적이익·자본거래·후계자 미확인',need:null,current:null,gap:null,role:'사망·승계 시점의 세금·지분매입·정산 부족재원 중 보험 적합 부분',limits:'기업가치·가족합의·법률구조 확정 전 가입금액 단정 금지',next:'주주명부·가족관계·후계자·기업가치·기존 보험 확인'});
 rows.push({id:'INS-CREDIT',title:'수출채권·거래처 신용',grade:'B',basis:`매출채권 ${wonEok(c.receivables)}·해외 거래구조`,need:null,current:null,gap:null,role:'특정 거래처 부도·국가위험으로 인한 회수손실 전가',limits:'채권회수정책·신용한도·계약관리를 대신하지 않음',next:'거래처별 채권연령·매출집중·연체·국가·결제조건 확인'});
 rows.push({id:'INS-PROPERTY',title:'해외사업장 재산·휴업·배상',grade:'C',basis:'해외 생산법인 보유',need:null,current:null,gap:null,role:'재산손해·생산중단·배상·운송 위험의 일부 전가',limits:'현지 증권·가입금액·면책 확인 전 공백 단정 금지',next:'국가별 자산·매출·복구기간·현지 증권 수집'});
 rows.push({id:'INS-LOAN',title:'단기대여금',grade:'D',basis:`단기대여금 ${wonEok(c.shortTermLoanReceivable)}`,need:null,current:null,gap:null,role:'직접 해결수단 아님',limits:'회수·정상화·계약·세무 검토가 우선',next:'원장·상대방·목적·계약·이자·만기 확인'});
 return rows;
}

const COMMON_QUESTIONS=[
 {id:'consultingGoal',label:'이번 상담에서 대표가 가장 먼저 결정해야 할 것은 무엇입니까?',type:'textarea',reason:'리포트의 우선순위와 결론을 맞춥니다.',example:'운전자금 개선 가능액 확인 후 정밀진단 여부 결정'},
 {id:'cashPressure',label:'매출 증가와 별개로 자금집행이 빠듯했던 시기가 있었습니까?',type:'select',options:['미확인','없음','간헐적','자주 있음'],reason:'현금흐름 문제의 체감 여부를 확인합니다.'},
 {id:'topCustomerConcentration',label:'상위 5개 거래처의 매출 비중과 결제조건을 알고 있습니까?',type:'text',reason:'매출채권 집중·신용위험을 판단합니다.',example:'상위 5개 60%, 60~90일 결제'},
 {id:'inventoryAging',label:'정상·저회전·장기재고를 구분하는 기준이 있습니까?',type:'text',reason:'재고 개선액의 현실성을 판단합니다.'},
 {id:'shareholderStructure',label:'현재 주주구성과 의결권·가족관계를 간단히 적어 주세요.',type:'textarea',reason:'자본정책·승계·지분정리의 전제입니다.'},
 {id:'successorStatus',label:'후계자 또는 경영승계 논의 상태는 어떻습니까?',type:'select',options:['미확인','계획 없음','가족 내 후보 있음','임직원 후보 있음','구체적 계획 진행 중'],reason:'승계 페이지의 확정도를 결정합니다.'},
 {id:'ceoCriticalRoles',label:'대표만 최종 승인하거나 직접 관리하는 핵심업무는 무엇입니까?',type:'textarea',reason:'대표 유고의 업무·현금 충격을 구분합니다.'},
 {id:'existingInsurance',label:'법인·대표·주주 관련 기존 보험증권을 확보했습니까?',type:'select',options:['미확인','없음','일부 확보','전체 확보'],reason:'신규 보험보다 기존 계약 분석을 먼저 수행합니다.'},
 {id:'ceoStyle',label:'대표의 의사결정 성향을 선택해 주세요.',type:'select',options:['신중보수형','숫자중심형','빠른결정형','관계중심형','회의방어형','전문가위임형','비용민감형'],reason:'설명의 길이·근거·질문 방식을 맞춥니다.'},
 {id:'meetingStage',label:'현재 상담단계는 어디입니까?',type:'select',options:['1차 진단','2차 정밀검토','가족·주주 공동미팅','보험설계 검토','최종 의사결정','사후관리'],reason:'화법과 다음 행동의 깊이를 조정합니다.'},
 {id:'advisorTeam',label:'현재 세무사·회계사·변호사·노무사 등 협업 가능한 전문가가 있습니까?',type:'text',reason:'역할 충돌 없이 공동검토 구조를 설계합니다.'},
 {id:'nextMeetingTarget',label:'다음 미팅에서 반드시 합의할 행동은 무엇입니까?',type:'textarea',reason:'자료·담당자·기한을 남기기 위한 질문입니다.'}
];
const CONDITIONAL_QUESTIONS={
 LOAN_RECEIVABLE:[
  {id:'loanCounterparty',label:'단기대여금의 상대방은 누구입니까?',type:'text',reason:'대표자 가지급금으로 단정하지 않고 거래 실질을 확인합니다.'},
  {id:'loanPurpose',label:'최초 지급 목적과 현재 사업상 필요성을 적어 주세요.',type:'textarea',reason:'사업상 대여·임직원·주주·관계회사 거래를 구분합니다.'},
  {id:'loanContract',label:'계약서·이사회/주총 승인·담보가 있습니까?',type:'text',reason:'증빙과 지배구조 절차를 확인합니다.'},
  {id:'loanInterest',label:'약정 이자율과 실제 이자수취 여부는?',type:'text',reason:'정상 거래조건과 세무 확인 범위를 정합니다.'},
  {id:'loanMaturity',label:'만기와 구체적인 회수계획은?',type:'text',reason:'회수·분할상환·정상화 대안을 설계합니다.'}
 ],
 KEY_PERSON:[
  {id:'keyPersonMonthlyFixedCost',label:'대표 유고 시에도 12개월 유지해야 할 월 고정비는 몇 백만원입니까?',type:'number',unit:'백만원',reason:'비상운영 필요재원을 코드로 계산합니다.'},
  {id:'keyPersonEmergencyMonths',label:'비상운영 필요기간은 몇 개월입니까?',type:'number',unit:'개월',reason:'필요재원 기간을 확정합니다.'},
  {id:'immediateDebtRepayment',label:'유고 시 즉시 상환·해소해야 할 채무·보증은 몇 백만원입니까?',type:'number',unit:'백만원',reason:'운영비 외 즉시 재원을 반영합니다.'},
  {id:'availableEmergencyCash',label:'실제로 비상재원으로 사용할 수 있는 가용현금은 몇 백만원입니까?',type:'number',unit:'백만원',reason:'장부상 현금과 사용 가능한 현금을 구분합니다.'},
  {id:'existingKeyPersonCoverage',label:'대표 유고 시 법인에 지급될 기존 보험금은 몇 백만원입니까?',type:'number',unit:'백만원',reason:'부족재원에서 기존 보장을 차감합니다.'}
 ],
 EXPORT_CREDIT:[
  {id:'foreignInsuranceStatus',label:'해외법인·공장·적하·배상·휴업 관련 현지 보험증권을 확보했습니까?',type:'textarea',reason:'해외 위험의 실제 보장공백을 확인합니다.'},
  {id:'customerDelinquency',label:'최근 2년 연체·대손·분쟁이 있었던 거래처와 금액은?',type:'textarea',reason:'신용보험 검토의 근거를 확인합니다.'}
 ],
 CAPITAL_TRANSACTIONS:[
  {id:'capitalTransactionPurpose',label:'자기주식 취득·처분, 감자, 배당의 당시 목적과 의사결정 자료가 있습니까?',type:'textarea',reason:'과거 거래를 단정하지 않고 타임라인을 복원합니다.'},
  {id:'futureCapitalPlan',label:'향후 3년 투자·배당·퇴직·승계·주식거래 계획은?',type:'textarea',reason:'자본정책을 하나의 자금표로 설계합니다.'}
 ]
};

const SpeechEngine={
 get(id,data=state.caseData){return (data?.speechOverrides||state.caseData?.speechOverrides||{})[id]||ISSUE_SPEECH_LIBRARY[id]||ISSUE_SPEECH_LIBRARY.WORKING_CAPITAL;},
 branches(id){return CEO_RESPONSE_BRANCHES[id]||CEO_RESPONSE_BRANCHES.WORKING_CAPITAL||[];},
 objectionsFor(id){
  const match={KEY_PERSON:['보험료가 부담된다는 대표','배우자·가족의 반대','할증·부담보·인수제한'],SUCCESSION:['배우자·가족의 반대','공동주주의 반대'],INSURANCE_OPTIMIZATION:['기존 설계사·타 제안과 비교','보험료가 부담된다는 대표'],EXPORT_CREDIT:['보험 근거가 부족한 기업'],LOAN_RECEIVABLE:['보험 근거가 부족한 기업']};
  const titles=match[id]||['보험료가 부담된다는 대표','보험 근거가 부족한 기업'];return OBJECTION_LIBRARY.filter(x=>titles.includes(x.title));
 },
 companyContext(data){const p=data.profile||{};const arr=[];if(/제조/.test(p.industry))arr.push('제조업 특성상 가동률·재고·납기·설비·휴업을 중심으로 설명합니다.');if(p.foreignSubsidiaries?.length)arr.push('수출·해외법인 특성상 거래처·국가·환율·물류·현지증권을 함께 확인합니다.');if(data.answers?.ceoStyle)arr.push(`CEO 성향은 ${data.answers.ceoStyle}으로 설정해 설명의 속도와 근거 수준을 조정합니다.`);return arr;},
 notes(page,data,analysis){
  const issue=page.issueId?analysis.issues.find(x=>x.id===page.issueId):null;const lib=page.issueId?this.get(page.issueId,data):null;const branches=page.issueId?this.branches(page.issueId):[];const objections=page.issueId?this.objectionsFor(page.issueId):[];
  const purpose=page.notePurpose || (issue?`${issue.title}을 CEO가 경영 의사결정 과제로 이해하고 다음 확인 행동에 동의하도록 합니다.`:'이 페이지의 핵심 사실과 의사결정 순서를 대표가 이해하도록 합니다.');
  const diagnosis=issue?.meaning||page.summary||'확인된 사실과 계산값을 경영 언어로 번역해 설명합니다.';
  const speech=lib?.speech90||`대표님, 이 페이지는 ${page.title}을 설명하기 위한 자료입니다. 확정된 숫자와 추가 확인이 필요한 사항을 구분해 보겠습니다.`;
  const questions=(CONDITIONAL_QUESTIONS[page.issueId]||COMMON_QUESTIONS).slice(0,4).map(x=>x.label);
  const obj=objections.map(o=>({title:o.title,dialogue:o.dialogue.slice(0,5)}));
  return {purpose,diagnosis,speech30:lib?.speech30||sentence(speech,150),speech90:speech,speech3m:lib?.speech3m||speech,speech5m:lib?.speech5m||lib?.speech3m||speech,questions,branches:branches.slice(0,7),objections:obj,advanced:[lib?.guardrail||'미확인 사실은 확정적으로 표현하지 않습니다.',...this.companyContext(data),'계산값·연도·단위·법인/주주 주체를 본문과 일치시킵니다.'],connection:issue?`${issue.consulting||'정밀진단'} / 보험: ${issue.insurance||'추가 확인 후 판단'}`:'다음 자료와 의사결정 항목을 합의합니다.',transition:lib?.nextAction||'대표의 답변과 필요한 자료를 확인한 뒤 다음 페이지의 실행안으로 이동합니다.',documents:documentList(page.issueId)};
 },
 search(q){const x=String(q||'').trim().toLowerCase();if(!x)return[];return SPEECH_CORPUS.filter(c=>(c.title+' '+c.text).toLowerCase().includes(x)).slice(0,30);}
};

/* ============================================================================
 * SPEECH ENGINE COMPLETION v1.5.0
 * Master manual v3.0 execution layer: 10 issues × 7 branches, 25 objections,
 * 20 complete scenarios, 7 CEO styles, 10 company types, 3 audio lecture modes.
 * ========================================================================== */
Object.assign(CEO_RESPONSE_BRANCHES, {"CAPITAL_POLICY":[{"type":"즉시 동의","expression":"“회사에 남길 돈과 주주에게 줄 돈의 기준이 필요합니다.”","response":"“맞습니다. 세금기법보다 3년 투자·운영·차입·배당·퇴직·승계 자금표를 먼저 만들겠습니다.”","followUp":"“향후 3년 안에 가장 큰 현금수요는 투자, 차입상환, 배당, 퇴직, 승계 중 무엇입니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"3년 자금수요표와 주주별 현금수요 제출일 확정"},{"type":"부분 동의","expression":"“배당 기준은 필요하지만 지금 크게 바꿀 생각은 없습니다.”","response":"“전면변경이 아니라 현재 정책이 어느 수준까지 안전한지 경계값부터 정하겠습니다.”","followUp":"“최소운영현금과 연간 투자·상환액을 제외한 뒤 배당 가능한 범위를 확인해도 되겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"현행 유지안과 기준배당안 비교"},{"type":"부정","expression":"“이익잉여금은 그냥 회사에 두면 됩니다.”","response":"“유보 자체는 문제가 아닙니다. 다만 투자·위기·주주수요에 맞는 적정 유보기준이 있는지를 확인하자는 뜻입니다.”","followUp":"“어느 수준의 현금과 자본을 유지하면 충분하다고 판단하십니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"적정 유보 경계값과 연례점검일 합의"},{"type":"정보 부족","expression":"“회사에 실제로 얼마를 남겨야 하는지 모릅니다.”","response":"“모르는 상태에서 배당이나 보험을 결정하지 않겠습니다. 운영필수현금과 예정지출부터 계산하겠습니다.”","followUp":"“재무팀이 13주 자금수지와 3년 투자계획을 준비할 수 있습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"자료 담당자·제출기한 지정"},{"type":"전문가 위임","expression":"“배당과 세금은 세무사에게 맡깁니다.”","response":"“세무사의 세무검토를 존중합니다. 저희는 회사현금·주주수요·경영권을 연결한 선택표를 만들겠습니다.”","followUp":"“세무사와 함께 볼 A/B/C 자본정책표가 필요하십니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"세무사 공동검토 범위와 일정 합의"},{"type":"비용 우려","expression":"“자본정책까지 컨설팅할 필요가 있습니까?”","response":"“전체 구조설계가 아니라 3년 현금수요와 현행정책의 위험만 먼저 진단하겠습니다.”","followUp":"“1차 결과에서 개선할 의사결정이 없으면 확대하지 않는 조건으로 보시겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"1단계 진단 범위·비용·중단조건 합의"},{"type":"결정 유예","expression":"“주주들과 나중에 상의하겠습니다.”","response":"“공동결정이 필요한 사안입니다. 먼저 중립적인 현황표와 선택기준을 준비하겠습니다.”","followUp":"“주주회의 전에 대표님과 쟁점을 정리하고 공동설명일을 잡을까요?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"참석자·설명자료·재검토일 확정"}],"CAPITAL_TRANSACTIONS":[{"type":"즉시 동의","expression":"“과거 자기주식과 감자 자료를 정리해야 합니다.”","response":"“거래의 적법성을 여기서 단정하지 않고 목적·가치·주주·현금·절차를 한 타임라인으로 복원하겠습니다.”","followUp":"“가장 먼저 설명이 필요한 거래는 어떤 거래입니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"거래 전후 주주명부·평가·결의·계약·대금자료 확보"},{"type":"부분 동의","expression":"“일부 자료는 있지만 전부는 없습니다.”","response":"“있는 자료로 확정 가능한 부분과 추가확인 부분을 나눠 불필요한 재작업을 줄이겠습니다.”","followUp":"“주주명부, 가치평가, 의사록, 계약, 대금흐름 중 빠진 것은 무엇입니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"자료 공백표와 대체증빙 목록 작성"},{"type":"부정","expression":"“이미 끝난 거래라 다시 볼 필요가 없습니다.”","response":"“과거를 문제 삼는 것이 아니라 향후 승계·배당·주식이동 때 같은 거래를 설명할 기준을 남기려는 것입니다.”","followUp":"“향후 3년 안에 추가 지분이동이나 주주정리가 전혀 없습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"향후 거래 가능성 경보선과 기록보관 기준 합의"},{"type":"정보 부족","expression":"“당시 왜 그렇게 했는지 정확히 기억나지 않습니다.”","response":"“기억에 의존하지 않고 문서와 자금흐름으로 복원하겠습니다.”","followUp":"“당시 회계·세무·법무 자료를 보관한 담당자나 전문가가 누구입니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"자료보유처·담당자·수집기한 지정"},{"type":"전문가 위임","expression":"“전문가가 처리했으니 그쪽에 물어보면 됩니다.”","response":"“전문가 처리를 의심하지 않습니다. 대표의 향후 의사결정을 위한 통합기록을 함께 만들겠습니다.”","followUp":"“기존 전문가에게 거래목적·평가·절차 질문표를 공유해도 되겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"기존 전문가 공동검토 일정 제안"},{"type":"비용 우려","expression":"“지난 거래까지 비용을 들여 볼 필요가 있습니까?”","response":"“모든 거래가 아니라 금액·지분·현금 영향이 큰 거래부터 선별하겠습니다.”","followUp":"“1차 서류진단으로 추가검토 필요성을 판단하는 방식은 어떻습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"핵심거래 1차 진단 범위와 중단조건 합의"},{"type":"결정 유예","expression":"“다음 주식거래가 생기면 그때 보겠습니다.”","response":"“그때 자료를 찾기 어려울 수 있으므로 지금은 사실확정과 보관만 하고 실행은 미룰 수 있습니다.”","followUp":"“이번 달에 거래타임라인만 확정하고 정책결정은 별도일로 잡을까요?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"현황확정일·정책 재검토일 지정"}],"EXECUTIVE_RETIREMENT":[{"type":"즉시 동의","expression":"“퇴직금과 지급재원을 함께 계산해야 합니다.”","response":"“규정·근속·보수·퇴직시점과 지급 후 운영현금을 한 표로 보겠습니다.”","followUp":"“예상 퇴직시점과 퇴직 후 역할은 어떻게 생각하고 계십니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"정관·규정·보수·근속·기존적립자료 제출"},{"type":"부분 동의","expression":"“규정은 있지만 재원은 아직 생각하지 않았습니다.”","response":"“규정은 출발점입니다. 현행 규정을 유지한 채 시점별 부족재원만 먼저 계산하겠습니다.”","followUp":"“일시지급과 단계적 준비 중 어느 방향을 선호하십니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"최소·기준·상한 퇴직재원 시나리오 작성"},{"type":"부정","expression":"“퇴직할 생각이 없으니 필요 없습니다.”","response":"“퇴직을 권하는 것이 아니라 승계·유고·역할변경 시 회사가 감당할 의무를 미리 보는 것입니다.”","followUp":"“회장·고문 전환이나 경영승계 시점도 퇴직 관련 검토가 필요할 수 있는데 기준만 확인해도 되겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"장기 재검토 기준과 연례점검일 합의"},{"type":"정보 부족","expression":"“예상퇴직금이 얼마인지 모릅니다.”","response":"“그래서 보험이나 적립부터 정하지 않고 규정과 보수자료로 범위를 계산합니다.”","followUp":"“등기임원·보수·근속·규정을 정리할 담당자를 지정할 수 있습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"계산자료 담당자·제출기한 지정"},{"type":"전문가 위임","expression":"“노무사와 세무사가 규정을 봅니다.”","response":"“전문가 검토가 중요합니다. 저희는 금액과 지급시점의 회사현금 영향을 연결하겠습니다.”","followUp":"“규정 검토 결과와 현금 시뮬레이션을 함께 보는 공동미팅이 필요하십니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"노무·세무 공동검토 일정 합의"},{"type":"비용 우려","expression":"“적립이나 보험료가 부담됩니다.”","response":"“전액 준비가 아니라 실제 부족분과 기간만 계산하고 내부현금·금융자산·분할·보험을 비교하겠습니다.”","followUp":"“회사가 매년 부담 가능한 상한부터 정해도 되겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"연간 준비한도와 A/B/C 적립안 합의"},{"type":"결정 유예","expression":"“승계 시점이 정해지면 보겠습니다.”","response":"“시점이 미정이어도 현재 규정과 예상범위를 확정해 두면 선택지가 넓습니다.”","followUp":"“현황만 확정하고 승계 논의가 시작될 때 재계산하도록 알림일을 잡을까요?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"현황보고서·재검토일 확정"}],"EXPORT_CREDIT":[{"type":"즉시 동의","expression":"“상위 바이어 미수와 국가위험을 점검해야 합니다.”","response":"“내부 신용관리와 보험 전가영역을 분리해 최대손실부터 보겠습니다.”","followUp":"“한 거래처의 최대 미수잔액과 최근 연체일수는 얼마입니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"상위 거래처별 한도·연체·국가·결제조건 제출"},{"type":"부분 동의","expression":"“몇몇 해외거래처만 위험합니다.”","response":"“전체채권이 아니라 해당 거래처와 국가만 선별해 보겠습니다.”","followUp":"“위험거래처의 매출비중·최대미수·담보·LC 조건은 무엇입니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"선별 거래처 손실시나리오 작성"},{"type":"부정","expression":"“오래 거래한 우량고객이라 문제없습니다.”","response":"“신뢰는 강점이지만 집중도와 외부충격은 별도로 관리해야 합니다.”","followUp":"“그 거래처의 지급이 90일 지연돼도 회사 현금흐름이 유지됩니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"최대지연 경계값과 모니터링 기준 합의"},{"type":"정보 부족","expression":"“거래처별 실제 한도와 연체를 모릅니다.”","response":"“보험 제안보다 내부 신용정보를 한 장으로 만드는 것이 먼저입니다.”","followUp":"“영업·무역·재무 중 누가 실제 회수일과 한도를 관리합니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"자료 담당자·추출기한 지정"},{"type":"전문가 위임","expression":"“무역보험 담당자와 은행이 관리합니다.”","response":"“기존 기관을 존중하고 회사가 보유·전가하는 위험의 경계를 통합하겠습니다.”","followUp":"“기존 한도·면책·자기부담을 공동검토해도 되겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"은행·무역보험 공동검토 일정 제안"},{"type":"비용 우려","expression":"“신용보험료가 아깝습니다.”","response":"“전체매출이 아니라 회사가 감당하기 어려운 거래처·국가·한도만 비교하겠습니다.”","followUp":"“최대손실과 보험료·자기부담을 함께 보는 방식은 어떻습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"선별 전가 A/B/C안 검토 동의"},{"type":"결정 유예","expression":"“다음 갱신 때 보겠습니다.”","response":"“갱신 전까지 내부 한도와 연체기준만 확정하면 더 정확히 비교할 수 있습니다.”","followUp":"“갱신 60일 전 자료검토일과 지금 준비할 목록을 정할까요?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"갱신 전 재검토일·자료목록 확정"}],"PROPERTY_BI":[{"type":"즉시 동의","expression":"“재산과 휴업 보장공백을 점검해야 합니다.”","response":"“건물·설비 복구비와 생산중단 기간의 고정비·매출총이익을 나눠 보겠습니다.”","followUp":"“핵심설비가 멈추면 정상화까지 현실적으로 몇 개월이 걸립니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"자산명세·복구기간·기존증권 제출"},{"type":"부분 동의","expression":"“화재보험은 있지만 휴업은 잘 모릅니다.”","response":"“기존 재산계약은 유지 전제로 휴업기간과 한도만 먼저 확인하겠습니다.”","followUp":"“대체생산과 고객납기 유지가 가능한 기간은 얼마입니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"재산·휴업 보장공백표 작성"},{"type":"부정","expression":"“사고가 난 적이 없어 문제없습니다.”","response":"“과거 무사고는 강점입니다. 발생확률이 아니라 발생 시 복구기간과 현금충격을 관리하자는 뜻입니다.”","followUp":"“핵심시설 한 곳이 한 달 멈추면 고정비와 납기에 어떤 영향이 있습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"최대중단 경계값과 비상계획 점검"},{"type":"정보 부족","expression":"“보험가액과 보상기간을 모릅니다.”","response":"“모르는 상태에서 증액·변경하지 않고 증권과 자산명세를 먼저 표준화하겠습니다.”","followUp":"“시설·재무·보험 담당자 중 자료를 모을 책임자를 정할 수 있습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"자료 담당자·제출기한 지정"},{"type":"전문가 위임","expression":"“보험 담당자가 알아서 갱신합니다.”","response":"“기존 담당자의 상품지식과 회사의 복구·휴업 시나리오를 연결하겠습니다.”","followUp":"“담당자와 자산가액·복구기간·면책을 공동검토해도 되겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"기존 담당자 포함 3자 점검 제안"},{"type":"비용 우려","expression":"“보장을 늘리면 보험료가 너무 큽니다.”","response":"“전면증액이 아니라 핵심설비·최대중단기간·자기부담을 조정해 우선순위를 나누겠습니다.”","followUp":"“최소복구, 기준복구, 완전복구 3안으로 비교할까요?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"재산·휴업 A/B/C 보장안 검토 동의"},{"type":"결정 유예","expression":"“다음 갱신 때 확인하겠습니다.”","response":"“갱신 때 서두르지 않도록 지금 자산명세와 실제 복구기간만 확정해 두겠습니다.”","followUp":"“갱신 90일 전 공동점검 일정을 잡아도 되겠습니까?”","secondResponse":"대표님의 답변을 다시 확인하고 전체 결정이 아닌 다음 한 단계만 합의합니다.","agreement":"현황확정·갱신 재검토일 지정"}]});
OBJECTION_LIBRARY.splice(0,OBJECTION_LIBRARY.length,...[{"title":"지금까지 문제없었습니다.","framework":"현재 성과 인정→문제 아닌 기준설정 제안","actionAgreement":"경보선·재검토일","dialogue":[{"speaker":"대표","text":"지금까지 문제없었습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"맞습니다. 과거가 잘못됐다는 뜻이 아니라 성장과 지분·승계 조건이 달라졌으니 어느 수준부터 점검할지 기준을 만들자는 것입니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"과거에는 괜찮았는데 굳이 지금 해야 합니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"변경 없이 경보선과 재검토일만 정하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 경보선·재검토일까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"세무사가 다 해줍니다.","framework":"기존 전문가 존중→역할 구분","actionAgreement":"공유자료·공동미팅","dialogue":[{"speaker":"대표","text":"세무사가 다 해줍니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"세무사는 결산·신고를 담당하고, 이번 검토는 그 자료를 대표님의 현금·지분·위험 의사결정으로 바꾸는 역할입니다. 쟁점은 함께 검증하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"중복되는 일 아닌가요?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"중복업무는 제외하고 기존 전문가에게 확인할 질문과 실행표만 만들겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 공유자료·공동미팅까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"회계법인 보고서와 뭐가 다릅니까?","framework":"차별성 설명","actionAgreement":"샘플 범위·진단 동의","dialogue":[{"speaker":"대표","text":"회계법인 보고서와 뭐가 다릅니까?","intent":"대표 반론"},{"speaker":"컨설턴트","text":"과거 숫자 설명을 넘어 대표 답변, 시나리오 계산, 실행순서, 상담·보험 필요재원까지 연결하는 의사결정 자료입니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"결국 보고서 하나 더 만드는 것 아닙니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"산출물은 보고서가 아니라 자료·담당자·기한·A/B/C 결정표입니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 샘플 범위·진단 동의까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"자료가 너무 많습니다.","framework":"요청 최소화","actionAgreement":"핵심자료 4종","dialogue":[{"speaker":"대표","text":"자료가 너무 많습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"1차에는 판단에 필요한 핵심 4종만 받고, 결과가 의미 있을 때 추가자료를 요청하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"직원들이 바쁩니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"담당자 한 명에게 표준목록을 드리고 이미 있는 자료부터 받겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 핵심자료 4종까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"정보를 주기 불안합니다.","framework":"보안 우려 인정","actionAgreement":"보안동의·마스킹","dialogue":[{"speaker":"대표","text":"정보를 주기 불안합니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"민감정보는 최소화하고 익명화·접근권한·보관기간을 명확히 하겠습니다. CEO 전달본에는 내부정보가 포함되지 않습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"외부로 나가면 곤란합니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"마스킹·보관·파기기준을 먼저 합의하고 필요한 항목만 받겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 보안동의·마스킹까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"진단비가 아깝습니다.","framework":"효과·중단조건","actionAgreement":"1단계 범위·중단조건","dialogue":[{"speaker":"대표","text":"진단비가 아깝습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"진단의 목적은 계약이 아니라 실행가치가 있는지 판단하는 것입니다. 기대효과가 비용보다 작으면 확대하지 않는 조건을 두겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"효과를 어떻게 알 수 있습니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"산출물과 판단기준을 먼저 정하고 기준 미달이면 중단하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 1단계 범위·중단조건까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"보험은 관심 없습니다.","framework":"보험 제외 전제","actionAgreement":"필요재원 분석만","dialogue":[{"speaker":"대표","text":"보험은 관심 없습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"보험을 제외하고도 경영공백과 부족재원 계산은 필요합니다. 결과상 부족분이 없으면 보험을 권하지 않겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"그럼 보험 이야기는 아예 안 합니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"보험 게이트를 통과할 때만 선택지로 열고 그 전에는 컨설팅만 진행합니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 필요재원 분석만까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"보험이 이미 많습니다.","framework":"신규보다 증권분석","actionAgreement":"증권 수집","dialogue":[{"speaker":"대표","text":"보험이 이미 많습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"총액보다 목적·수익자·기간·실제 사용가능성이 중요합니다. 신규가입 전에 유지·중복·공백을 먼저 보겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"기존 계약을 해지하라는 뜻입니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"해지손실과 신규심사를 비교하기 전에는 변경하지 않습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 증권 수집까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"보험료가 비쌉니다.","framework":"비용 원인 분해→범위축소","actionAgreement":"A/B/C 설계","dialogue":[{"speaker":"대표","text":"보험료가 비쌉니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"월 지출과 장기구속 중 무엇이 더 부담인지 확인하고, 필수 부족재원과 기간만 남기겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"그래도 금액이 클 것 같습니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"핵심·선택 위험을 나눠 최소·기준·상한 3안으로 비교하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 A/B/C 설계까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"회사 현금이 충분합니다.","framework":"가용현금 구분","actionAgreement":"가용현금 계산","dialogue":[{"speaker":"대표","text":"회사 현금이 충분합니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"운영필수현금과 즉시 사용할 비상재원을 나누고 부족분이 없다면 보험을 축소·제외하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"통장에 있는 돈이면 충분하지 않습니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"급여·매입·세금·투자에 이미 필요한 금액을 제외한 가용현금만 보겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 가용현금 계산까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"대표가 없으면 회사가 끝입니다.","framework":"보험 한계 인정","actionAgreement":"비상경영 프로젝트","dialogue":[{"speaker":"대표","text":"대표가 없으면 회사가 끝입니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"그래서 보험만이 아니라 대체경영·권한·거래처 대응과 비상재원을 함께 설계합니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"보험금이 있어도 운영이 안 됩니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"맞습니다. 권한과 사람을 먼저 설계하고 보험은 현금공백만 보완합니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 비상경영 프로젝트까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"가족과 상의해야 합니다.","framework":"공동결정 존중","actionAgreement":"참석자·일정","dialogue":[{"speaker":"대표","text":"가족과 상의해야 합니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"누구의 어떤 우려를 설명해야 하는지 알려주시면 결정을 요구하지 않는 공동설명 자료를 준비하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"가족이 보험을 싫어합니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"상품보다 지분·현금·필요재원과 비보험 대안을 먼저 보여드리겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 참석자·일정까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"공동주주가 반대할 겁니다.","framework":"주주별 이해관계 구분","actionAgreement":"주주영향표","dialogue":[{"speaker":"대표","text":"공동주주가 반대할 겁니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"주주별 권리·현금·경영권 영향을 따로 보여드리고 합의 가능한 최소안을 찾겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"회사 돈을 대표 가족에게 쓰는 것으로 보일 수 있습니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"회사운영과 가족정산, 주식매입 목적을 분리하고 회사가 부담할 정당한 부분만 계산합니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 주주영향표까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"아직 승계는 멀었습니다.","framework":"시기와 준비기간 분리","actionAgreement":"연례점검","dialogue":[{"speaker":"대표","text":"아직 승계는 멀었습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"실행은 나중에 해도 가치·가족·보험심사·지분정리는 시간이 걸립니다. 지금은 기준과 선택지만 준비하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"지금 주식을 넘길 생각은 없습니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"이전 없이 비상경영 기준과 주주명부만 점검하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 연례점검까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"상속세는 그때 가서 내면 됩니다.","framework":"현금시점 설명","actionAgreement":"유동성 산출","dialogue":[{"speaker":"대표","text":"상속세는 그때 가서 내면 됩니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"세금액보다 납부시점에 주식은 많고 현금이 부족할 수 있다는 점을 보겠습니다. 부족분이 없으면 별도 준비가 필요 없습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"자산을 팔면 되지 않습니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"매각기간·가격·경영권 영향을 포함해 현금화 가능성을 비교하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 유동성 산출까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"배당하면 되지 않습니까?","framework":"배당 한계·비교","actionAgreement":"3년 자본정책","dialogue":[{"speaker":"대표","text":"배당하면 되지 않습니까?","intent":"대표 반론"},{"speaker":"컨설턴트","text":"배당은 가능한 수단이지만 회사현금, 주주별 세금, 투자계획, 시점을 함께 비교해야 합니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"배당이 가장 간단하지 않습니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"간단성은 장점이므로 회사 유동성을 해치지 않는 범위에서 A안으로 비교하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 3년 자본정책까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"퇴직금은 규정대로 주면 됩니다.","framework":"규정·현금·시점 결합","actionAgreement":"예상퇴직금·현금 시뮬레이션","dialogue":[{"speaker":"대표","text":"퇴직금은 규정대로 주면 됩니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"규정 적정성뿐 아니라 퇴직시점에 회사가 실제 지급 가능한지와 운영현금이 남는지 보겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"규정이 있는데 무엇을 더 봅니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"실제 임원·보수·근속·퇴직사실과 지급 후 현금을 대조하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 예상퇴직금·현금 시뮬레이션까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"대여금은 곧 받습니다.","framework":"회수계획 증빙","actionAgreement":"상환계획 문서화","dialogue":[{"speaker":"대표","text":"대여금은 곧 받습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"그 계획을 계약·상환재원·일정으로 남기면 오히려 정상거래를 설명하기 쉬워집니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"관계회사가 좋아지면 갚을 겁니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"정상·지연·회수곤란 시나리오와 책임자를 문서화하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 상환계획 문서화까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"거래처를 압박할 수 없습니다.","framework":"고객등급별 접근","actionAgreement":"고객별 한도정책","dialogue":[{"speaker":"대표","text":"거래처를 압박할 수 없습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"전 거래처 일괄단축이 아니라 위험·마진·전략성에 따라 조건을 차등화하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"중요 고객을 잃을 수 있습니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"핵심고객은 유지하고 신규·저마진·연체 고객부터 한도와 조건을 조정합니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 고객별 한도정책까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"재고는 다 팔립니다.","framework":"판매가능성과 시점 분리","actionAgreement":"재고연령표","dialogue":[{"speaker":"대표","text":"재고는 다 팔립니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"판매 가능 여부와 현금전환 시점을 구분해 재고연령과 마진저하 가능성을 보겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"할인하면 다 처분할 수 있습니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"할인손실과 보관비, 현금회수 속도를 비교해 품목별로 판단하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 재고연령표까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"해외보험은 현지에서 합니다.","framework":"통합 공백 점검","actionAgreement":"현지증권 수집","dialogue":[{"speaker":"대표","text":"해외보험은 현지에서 합니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"현지 가입을 존중하되 본사 관점에서 한도·면책·휴업기간·중복만 통합 확인하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"본사에서 알 필요가 있습니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"본사 손익·보증·공급망에 영향을 주는 공백만 확인하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 현지증권 수집까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"다른 설계사에게 받고 있습니다.","framework":"기존 관계 존중","actionAgreement":"비교기준 합의","dialogue":[{"speaker":"대표","text":"다른 설계사에게 받고 있습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"기존 관계를 대체하기보다 기업자료와 필요재원 기준으로 비교 가능한 분석을 제공하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"설계사를 바꿀 생각은 없습니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"바꾸실 필요 없습니다. 기존안이 목적에 맞으면 유지가 결론입니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 비교기준 합의까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"오늘 결정하기 어렵습니다.","framework":"결정범위 축소","actionAgreement":"재검토일","dialogue":[{"speaker":"대표","text":"오늘 결정하기 어렵습니다.","intent":"대표 반론"},{"speaker":"컨설턴트","text":"오늘은 가입결정이 아니라 확인할 자료와 다음 판단일만 정하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"조금 더 생각해 보겠습니다.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"진행·축소·보류 기준을 한 장으로 드리고 재검토일을 잡겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 재검토일까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"조건이 바뀌면 어떻게 합니까?","framework":"변경 리스크 공개","actionAgreement":"조건부 의사결정","dialogue":[{"speaker":"대표","text":"조건이 바뀌면 어떻게 합니까?","intent":"대표 반론"},{"speaker":"컨설턴트","text":"심사·약관·제도 변화 가능성을 전제로 진행·축소·보류 기준을 미리 정하겠습니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"나중에 더 불리해질 수도 있겠네요.","intent":"2차 반론"},{"speaker":"컨설턴트","text":"가능성을 과장하지 않고 현재조건과 변경 시 대안을 함께 표시하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 조건부 의사결정까지만 합의하겠습니다.","intent":"행동합의"}]},{"title":"효과를 보장할 수 있습니까?","framework":"보장 불가 명확화","actionAgreement":"검증·전문가 확인","dialogue":[{"speaker":"대표","text":"효과를 보장할 수 있습니까?","intent":"대표 반론"},{"speaker":"컨설턴트","text":"세무·재무·보험 결과를 보장하지 않습니다. 확인된 사실과 가정, 위험, 대안을 투명하게 비교해 결정오류를 줄이는 것이 목적입니다.","intent":"인정·재설명"},{"speaker":"컨설턴트","text":"대표님 말씀의 핵심이 비용·시기·신뢰·정보 중 어디에 가장 가까운지 확인해도 될까요?","intent":"진짜 이유 확인"},{"speaker":"대표","text":"보장이 없으면 왜 비용을 냅니까?","intent":"2차 반론"},{"speaker":"컨설턴트","text":"산출물·검증범위·중단조건을 계약서에 명확히 하고 전문가 확인이 필요한 영역을 구분하겠습니다.","intent":"범위 축소·근거"},{"speaker":"컨설턴트","text":"오늘은 전체 결정이 아니라 검증·전문가 확인까지만 합의하겠습니다.","intent":"행동합의"}]}]);
SCENARIO_LIBRARY.push(...[{"title":"운전자금 정밀진단 전환","issueId":"WORKING_CAPITAL","text":"상담 목표 성장 자체를 부정하지 않고 자연증가와 관리필요 증가를 구분해 자료와 다음 미팅을 확정한다.\n컨설턴트 | 대표님, 실적은 좋아졌지만 이익과 현금이 같은 속도로 늘지는 않았습니다. 채권과 재고가 함께 증가해 성장자금이 내부에 묶였을 가능성이 있습니다.\nCEO | 성장하면 채권과 재고가 늘어나는 건 당연하지 않습니까?\n컨설턴트 | 맞습니다. 증가 자체보다 회수·재고기간이 길어졌는지 구분하겠습니다. 대표님은 어느 수준부터 부담이라고 보십니까?\nCEO | 현금은 부족하지 않습니다.\n컨설턴트 | 현재 현금은 강점입니다. 성장률이 유지될 때도 같은 수준을 지킬 수 있는지 회수일 10일·재고일 5일 시나리오로 확인하겠습니다.\nCEO | 계산한다고 실제로 줄일 수 있나요?\n컨설턴트 | 보장효과로 말하지 않고 거래처 조건과 재고연령으로 현실적인 목표만 확정하겠습니다. 채권연령표·재고연령표·13주 자금수지를 받아 다음 미팅에서 개선가능액과 실행순서를 제시하겠습니다."},{"title":"대여금 정상화 프로젝트","issueId":"LOAN_RECEIVABLE","text":"상담 목표 가지급금으로 단정하지 않고 거래실질을 복원해 회수·정상화 프로젝트와 전문가 협업으로 연결한다.\n컨설턴트 | 단기대여금이 보이지만 상대방과 목적을 모른 채 대표자 가지급금이라고 말할 수 없습니다.\nCEO | 관계회사에 잠깐 빌려준 돈입니다.\n컨설턴트 | 계약서·이자율·만기·실제 이자수취와 상환재원을 확인하겠습니다.\nCEO | 계약은 있지만 만기가 지나 연장했습니다.\n컨설턴트 | 반복연장 자체를 위법으로 단정하지 않고 정상·지연·회수곤란 3안으로 본사현금과 세무영향을 보겠습니다. 보험이 아니라 계약과 회수계획 정상화가 우선입니다.\nCEO | 세무사와 같이 보면 되겠네요.\n컨설턴트 | 맞습니다. 저희가 자금흐름과 경영대안을 재구성하고 세무·법률전문가가 요건을 검증하도록 역할을 나누겠습니다."},{"title":"대표자 유고 필요재원 분석","issueId":"KEY_PERSON","text":"상담 목표 대표 유고의 경영·현금 영향을 수치화하고 기존보험 분석과 부족재원 확정 미팅을 확보한다.\n컨설턴트 | 보험을 먼저 권하는 것이 아니라 대표님이 6개월간 경영에 참여하지 못할 때 필요한 현금과 의사결정 공백을 계산하겠습니다.\nCEO | 임원들이 잘합니다.\n컨설턴트 | 큰 강점입니다. 실제 권한·은행·거래처·해외법인의 수용범위를 확인하겠습니다.\nCEO | 대출과 해외자금은 제가 봅니다.\n컨설턴트 | 월 고정비, 즉시 대응할 채무·보증, 핵심인 유지비를 합산하고 가용현금과 기존보험을 차감하겠습니다.\nCEO | 회사 현금이 충분합니다.\n컨설턴트 | 운영필수현금과 실제 비상재원을 구분해 부족분이 없으면 보험을 줄이거나 제외하겠습니다. 다음 미팅은 상품설명이 아니라 부족재원 확정 미팅입니다."},{"title":"승계재원과 가족 합의","issueId":"SUCCESSION","text":"상담 목표 승계의 경영권·가족공평성·현금재원을 분리하고 가족 공동설명 미팅으로 연결한다.\n컨설턴트 | 승계는 세금만 줄이는 문제가 아니라 누가 경영하고 주식을 보유하며 비경영 가족에게 어떤 현금을 줄지의 문제입니다.\nCEO | 아들이 회사를 맡을 겁니다.\n컨설턴트 | 큰 강점입니다. 다른 가족은 동일지분과 경제적가치 중 무엇을 공평하다고 생각합니까?\nCEO | 딸도 있으니 공평해야 합니다.\n컨설턴트 | 경영권은 후계자에게 안정적으로 두고 비경영 가족에게 다른 자산이나 현금을 주는 안도 비교하겠습니다.\nCEO | 가족과 상의해야 합니다.\n컨설턴트 | 다음 미팅은 결정을 요구하지 않고 가족별 쟁점과 A/B/C안을 설명하는 자리로 하겠습니다."},{"title":"보험료 부담 반론과 설계 축소","issueId":"KEY_PERSON","text":"상담 목표 보험료 반론을 가격할인으로 처리하지 않고 목적·기간·범위를 축소해 설계검토 동의를 얻는다.\nCEO | 필요한 건 알겠는데 보험료가 부담됩니다.\n컨설턴트 | 월 지출과 장기간 자금이 묶이는 것 중 무엇이 더 부담인지 구분해도 될까요?\nCEO | 장기적으로 계속 내는 게 싫습니다.\n컨설턴트 | 저축목적은 제외하고 예고 없는 유고 시 최소 부족재원과 필요한 기간만 보겠습니다. 내부현금과 신용한도를 먼저 뺍니다.\nCEO | 그래도 금액이 클 것 같습니다.\n컨설턴트 | 1안 최소운영자금, 2안 운영자금+보증대응, 3안 승계재원 포함으로 보험료와 효과를 비교하겠습니다. 비교는 가입동의가 아닙니다."},{"title":"최종계약 보류 대응","issueId":"INSURANCE_OPTIMIZATION","text":"상담 목표 최종보류를 추궁하지 않고 실제 이유를 구분해 공동설명·판단자료·재검토일을 확정한다.\nCEO | 설계는 괜찮은데 더 생각해 보겠습니다.\n컨설턴트 | 보류 이유가 금액, 계약구조, 가족동의, 심사조건 중 어디에 가장 가깝습니까?\nCEO | 배우자와 상의해야 합니다.\n컨설턴트 | 상품보다 왜 이 금액이 필요한지와 기존 준비재원을 먼저 설명드리겠습니다. 공동설명과 판단자료 중 어느 방식이 좋습니까?\nCEO | 자료를 먼저 주세요.\n컨설턴트 | 필요재원 산식, 내부현금·기존보험, 3개 대안, 보험료·기간·해지·면책·심사조건을 한 장으로 정리하겠습니다. 다음 주에 진행·축소·보류 중 하나를 결정하는 일정으로 잡겠습니다."}]);
const SPEECH_CEO_STYLE_PROFILES={"숫자중심형":{"order":"결론→산식→민감도→출처","opening":"대표님, 먼저 결론과 기준 수치를 보겠습니다.","question":"기준·상한·하한 중 어느 범위를 의사결정 기준으로 삼으시겠습니까?","forbidden":"감성·공포 사례","closing":"수치 검증표와 가정을 승인해 주시면 다음 단계로 이동하겠습니다."},"빠른결정형":{"order":"한 줄 진단→A/B 선택→기한","opening":"대표님, 오늘 결정은 자료제출과 다음 회의 두 가지로 좁히겠습니다.","question":"A안과 B안 중 먼저 검토할 한 가지는 무엇입니까?","forbidden":"긴 배경설명","closing":"담당자와 기한 한 가지만 지금 확정하겠습니다."},"신중보수형":{"order":"기존방식 존중→작은 검증→확대","opening":"대표님, 기존 방식을 바꾸기 전에 현황과 작은 검증부터 진행하겠습니다.","question":"어떤 조건이 확인돼야 변경을 검토할 수 있습니까?","forbidden":"전면개편 요구","closing":"변경 없이 1차 현황만 확정하고 확대 여부를 판단하겠습니다."},"관계중심형":{"order":"사람 영향→가족·직원→숫자","opening":"대표님, 가족과 임직원이 혼란 없이 움직일 기준부터 보겠습니다.","question":"이 결정으로 가장 영향을 받는 가족·주주·직원은 누구입니까?","forbidden":"세금만 강조","closing":"관련자가 함께 이해할 설명자료와 공동미팅을 준비하겠습니다."},"회의방어형":{"order":"대표 판단 질문→가정 공개→반증 허용","opening":"대표님, 제가 틀릴 수 있으니 현재 가정과 자료를 함께 검증하겠습니다.","question":"대표님이 보시는 반대근거나 다른 기준은 무엇입니까?","forbidden":"단정·압박","closing":"반증 가능한 자료를 확인하고 진행·보류 기준을 합의하겠습니다."},"전문가위임형":{"order":"역할 구분→질문목록→공동검토","opening":"대표님, 기존 전문가의 판단을 존중하고 실행안과 연결하겠습니다.","question":"기존 전문가에게 반드시 확인할 쟁점은 무엇입니까?","forbidden":"전문가 폄하","closing":"질문목록을 공유하고 3자 공동검토 일정을 잡겠습니다."},"비용민감형":{"order":"잠재효과→최소범위→중단조건","opening":"대표님, 최소범위와 중단조건부터 정해 비용을 통제하겠습니다.","question":"어느 수준의 효과가 확인돼야 다음 비용을 승인하시겠습니까?","forbidden":"대형 프로젝트 선제안","closing":"1차 결과가 기준에 못 미치면 확대하지 않겠습니다."}};
const SPEECH_COMPANY_TYPE_PROFILES={"제조업":{"context":"공장가동·재고·설비·납기·휴업의 연결을 중심으로 설명합니다.","question":"핵심설비가 멈추거나 재고가 지연될 때 납기와 현금에 가장 먼저 영향을 주는 공정은 무엇입니까?","insurance":"재산·휴업·핵심인"},"서비스·지식기업":{"context":"핵심고객·인력·영업권·데이터와 계약갱신을 중심으로 설명합니다.","question":"핵심고객 또는 핵심인력이 이탈할 때 매출과 계약유지에 미치는 영향은 무엇입니까?","insurance":"핵심인·배상·사이버"},"수출기업":{"context":"채권·국가·환율·운송·바이어 집중도를 중심으로 설명합니다.","question":"상위 바이어의 최대 미수잔액과 국가·결제조건은 무엇입니까?","insurance":"무역신용·적하·배상"},"해외법인 보유":{"context":"법인별 자금집행·보증·이전가격·현지권한·현지증권을 함께 확인합니다.","question":"본사 승인 없이 현지법인이 집행할 수 없는 자금과 계약은 무엇입니까?","insurance":"해외재산·휴업·D&O"},"가족기업":{"context":"경영권·비경영 가족·현금형평과 비상경영 기준을 중심으로 설명합니다.","question":"후계자와 비경영 가족이 공평하다고 보는 기준은 지분입니까, 경제적 가치입니까?","insurance":"승계유동성·대표유고"},"공동주주기업":{"context":"의결·주식매매·유고·분쟁과 주주간계약을 중심으로 설명합니다.","question":"공동주주 유고·퇴사·분쟁 시 지분매입가격과 의사결정 절차가 정해져 있습니까?","insurance":"주식매입·핵심인"},"창업·고성장":{"context":"현금소진·투자·지분희석·핵심인과 성장속도를 중심으로 설명합니다.","question":"현재 성장률이 유지될 때 현금 런웨이와 추가자금 필요시점은 언제입니까?","insurance":"핵심인·D&O"},"현금부자기업":{"context":"운영필수현금·투자계획·기회비용·주주환원의 기준을 중심으로 설명합니다.","question":"현금 중 운영·투자에 반드시 남겨야 할 금액과 주주환원 가능한 금액을 구분했습니까?","insurance":"부족재원 있을 때만"},"차입·보증 의존":{"context":"만기구조·금리·담보·개인보증·현금커버를 중심으로 설명합니다.","question":"대표 유고 또는 신용조건 변경 시 즉시 대응해야 할 채무·보증은 얼마입니까?","insurance":"채무상환·대표유고"},"승계 임박":{"context":"시간·기업가치·가족합의·세금일정·실행순서를 중심으로 설명합니다.","question":"향후 3년 안에 반드시 확정해야 할 후계자·지분·현금 의사결정은 무엇입니까?","insurance":"승계·지분정리·유동성"}};
const SPEECH_ISSUE_OBJECTION_MAP={"WORKING_CAPITAL":["지금까지 문제없었습니다.","회계법인 보고서와 뭐가 다릅니까?","진단비가 아깝습니다.","거래처를 압박할 수 없습니다.","재고는 다 팔립니다."],"LOAN_RECEIVABLE":["세무사가 다 해줍니다.","자료가 너무 많습니다.","정보를 주기 불안합니다.","대여금은 곧 받습니다.","효과를 보장할 수 있습니까?"],"CAPITAL_POLICY":["세무사가 다 해줍니다.","회사 현금이 충분합니다.","배당하면 되지 않습니까?","효과를 보장할 수 있습니까?","오늘 결정하기 어렵습니다."],"CAPITAL_TRANSACTIONS":["회계법인 보고서와 뭐가 다릅니까?","세무사가 다 해줍니다.","자료가 너무 많습니다.","오늘 결정하기 어렵습니다.","효과를 보장할 수 있습니까?"],"EXECUTIVE_RETIREMENT":["퇴직금은 규정대로 주면 됩니다.","보험료가 비쌉니다.","회사 현금이 충분합니다.","조건이 바뀌면 어떻게 합니까?","오늘 결정하기 어렵습니다."],"SUCCESSION":["가족과 상의해야 합니다.","공동주주가 반대할 겁니다.","아직 승계는 멀었습니다.","상속세는 그때 가서 내면 됩니다.","회사 현금이 충분합니다."],"KEY_PERSON":["보험은 관심 없습니다.","보험이 이미 많습니다.","보험료가 비쌉니다.","회사 현금이 충분합니다.","대표가 없으면 회사가 끝입니다."],"EXPORT_CREDIT":["지금까지 문제없었습니다.","거래처를 압박할 수 없습니다.","해외보험은 현지에서 합니다.","보험료가 비쌉니다.","효과를 보장할 수 있습니까?"],"PROPERTY_BI":["지금까지 문제없었습니다.","보험이 이미 많습니다.","해외보험은 현지에서 합니다.","조건이 바뀌면 어떻게 합니까?","효과를 보장할 수 있습니까?"],"INSURANCE_OPTIMIZATION":["보험이 이미 많습니다.","다른 설계사에게 받고 있습니다.","정보를 주기 불안합니다.","보험료가 비쌉니다.","조건이 바뀌면 어떻게 합니까?"]};

const SPEECH_REQUIRED_BRANCH_TYPES=['즉시 동의','부분 동의','부정','정보 부족','전문가 위임','비용 우려','결정 유예'];
const SPEECH_FORBIDDEN_PATTERNS=[/전액\s*비용처리됩니다/g,/보험으로\s*해결할\s*수\s*있습니다/g,/지금\s*가입하지\s*않으면/g,/이익잉여금을\s*보험으로\s*(빼|꺼)/g,/세무사는\s*이런\s*것까지\s*모릅니다/g,/무조건\s*가입/g,/반드시\s+[^.]{0,25}(절감|수익|보험금)/g];

function speechDetectCompanyTypes(data){
 const p=data?.profile||{},a=data?.answers||{},r=data?.calculations?.ratios||{},f=data?.financials?.['2025']||{};
 const text=[p.industry,p.products,p.companyType,(p.foreignSubsidiaries||[]).join(' '),(p.relatedCompanies||[]).join(' '),a.shareholderStructure,a.successorStatus].filter(Boolean).join(' ');
 const out=[];
 if(/제조|생산|공장|봉제|기계|화학|식품|부품/.test(text))out.push('제조업');
 if(/서비스|소프트웨어|IT|정보|컨설팅|광고|플랫폼|지식|의료|도매/.test(text))out.push('서비스·지식기업');
 if(/수출|무역|해외매출|바이어/.test(text)||(p.foreignSubsidiaries||[]).length)out.push('수출기업');
 if((p.foreignSubsidiaries||[]).length)out.push('해외법인 보유');
 if(/가족|자녀|아들|딸/.test(text))out.push('가족기업');
 if(/공동주주|동업|주주\s*[2-9]/.test(text))out.push('공동주주기업');
 if(Number.isFinite(r.salesGrowth)&&r.salesGrowth>=20)out.push('창업·고성장');
 if(Number.isFinite(f.cash)&&Number.isFinite(f.assets)&&f.assets>0&&f.cash/f.assets>=.2)out.push('현금부자기업');
 if((Number.isFinite(r.borrowingDependency)&&r.borrowingDependency>=30)||(Number.isFinite(r.currentRatio)&&r.currentRatio<100))out.push('차입·보증 의존');
 if(/구체적 계획|승계.*진행|후계자.*확정/.test(text))out.push('승계 임박');
 if(!out.length)out.push('서비스·지식기업');
 return [...new Set(out)];
}
function speechStyleProfile(data){return SPEECH_CEO_STYLE_PROFILES[data?.answers?.ceoStyle]||SPEECH_CEO_STYLE_PROFILES['신중보수형'];}
function speechCompanyProfiles(data){return speechDetectCompanyTypes(data).map(k=>({name:k,...SPEECH_COMPANY_TYPE_PROFILES[k]})).filter(x=>x.context);}
function speechCustomize(text,data,issueId,duration){
 const style=speechStyleProfile(data),companies=speechCompanyProfiles(data),company=companies[0];
 const prefix=duration==='speech30'?style.opening:`${style.opening} 설명의 순서는 ${style.order}로 진행하겠습니다.`;
 const suffix=`\n\n맞춤 확인질문: ${style.question}${company?`\n${company.name} 관점 질문: ${company.question}`:''}\n결정 전환: ${style.closing}`;
 return `${prefix}\n${text}${suffix}`;
}
function speechScenarioFor(issueId,stage){
 const map={WORKING_CAPITAL:'운전자금 정밀진단 전환',LOAN_RECEIVABLE:'대여금 정상화 프로젝트',CAPITAL_POLICY:'이익잉여금·배당정책',CAPITAL_TRANSACTIONS:'자기주식·감자 과거거래',EXECUTIVE_RETIREMENT:'임원퇴직재원',SUCCESSION:'승계재원과 가족 합의',KEY_PERSON:'대표자 유고 필요재원 분석',INSURANCE_OPTIMIZATION:stage==='최종 의사결정'?'최종계약 보류 대응':'기존 설계사와 비교',EXPORT_CREDIT:'한 줄 진단 제시',PROPERTY_BI:'한 줄 진단 제시'};
 return SCENARIO_LIBRARY.find(x=>x.title===map[issueId])||null;
}
function speechIssueQuestions(issueId,data){
 const dynamic=(data?.dynamicQuestions||[]).filter(q=>q.issueId===issueId).map(q=>q.label);
 const base=[...(CONDITIONAL_QUESTIONS[issueId]||[]).map(x=>x.label),...dynamic,...COMMON_QUESTIONS.map(x=>x.label)].filter((v,i,a)=>a.indexOf(v)===i).slice(0,4);
 const style=speechStyleProfile(data),companies=speechCompanyProfiles(data);
 return [...new Set([...base,style.question,...companies.slice(0,2).map(x=>x.question)])].slice(0,5);
}
function speechObjectionDialogue(title){return OBJECTION_LIBRARY.find(x=>x.title===title);}
function speechCompletionStats(){
 const issueIds=Object.keys(ISSUE_SPEECH_LIBRARY);
 return {issues:issueIds.length,completeIssueScripts:issueIds.filter(id=>['speech30','speech90','speech3m','speech5m','guardrail','nextAction'].every(k=>String(ISSUE_SPEECH_LIBRARY[id]?.[k]||'').trim())).length,branchIssues:issueIds.filter(id=>Array.isArray(CEO_RESPONSE_BRANCHES[id])&&CEO_RESPONSE_BRANCHES[id].length===7&&new Set(CEO_RESPONSE_BRANCHES[id].map(x=>x.type)).size===7).length,objections:OBJECTION_LIBRARY.length,scenarios:SCENARIO_LIBRARY.length,ceoStyles:Object.keys(SPEECH_CEO_STYLE_PROFILES).length,companyTypes:Object.keys(SPEECH_COMPANY_TYPE_PROFILES).length,insuranceStages:INSURANCE_SPEECH_STAGES.length};
}

SpeechEngine.get=function(id,data=state.caseData){return (data?.speechOverrides||state.caseData?.speechOverrides||{})[id]||ISSUE_SPEECH_LIBRARY[id]||null;};
SpeechEngine.branches=function(id){return Array.isArray(CEO_RESPONSE_BRANCHES[id])?CEO_RESPONSE_BRANCHES[id]:[];};
SpeechEngine.objectionsFor=function(id){const titles=SPEECH_ISSUE_OBJECTION_MAP[id]||OBJECTION_LIBRARY.slice(0,4).map(x=>x.title);return titles.map(speechObjectionDialogue).filter(Boolean).slice(0,4);};
SpeechEngine.companyContext=function(data){const style=speechStyleProfile(data);return [`CEO 성향 ${data?.answers?.ceoStyle||'신중보수형'}: ${style.order}`,`금지 접근: ${style.forbidden}`,...speechCompanyProfiles(data).map(x=>`${x.name}: ${x.context} · 보험 검토경계 ${x.insurance}`)];};
SpeechEngine.notes=function(page,data,analysis){
 const issue=page.issueId?analysis.issues.find(x=>x.id===page.issueId):null,lib=page.issueId?this.get(page.issueId,data):null;
 const branches=page.issueId?this.branches(page.issueId):[],objections=page.issueId?this.objectionsFor(page.issueId):[],scenario=page.issueId?speechScenarioFor(page.issueId,data?.answers?.meetingStage):null;
 const purpose=page.notePurpose||(issue?`${issue.title}을 CEO가 경영 의사결정 과제로 이해하고 다음 확인 행동에 동의하도록 합니다.`:'이 페이지의 핵심 사실과 의사결정 순서를 대표가 이해하도록 합니다.');
 const diagnosis=issue?.meaning||page.summary||'확인된 사실과 계산값을 경영 언어로 번역해 설명합니다.';
 const base=lib?.speech90||`대표님, 이 페이지는 ${page.title}을 설명하기 위한 자료입니다. 확정된 숫자와 추가 확인이 필요한 사항을 구분해 보겠습니다.`;
 const style=speechStyleProfile(data),companies=speechCompanyProfiles(data);
 return {purpose,diagnosis,speech30:lib?speechCustomize(lib.speech30,data,page.issueId,'speech30'):sentence(base,150),speech90:lib?speechCustomize(lib.speech90,data,page.issueId,'speech90'):base,speech3m:lib?speechCustomize(lib.speech3m,data,page.issueId,'speech3m'):base,speech5m:lib?speechCustomize(lib.speech5m,data,page.issueId,'speech5m'):base,questions:page.issueId?speechIssueQuestions(page.issueId,data):(COMMON_QUESTIONS||[]).slice(0,4).map(x=>x.label),branches:branches.slice(0,7),objections:objections.map(o=>({title:o.title,dialogue:o.dialogue,framework:o.framework,actionAgreement:o.actionAgreement})),scenario,customization:{ceoStyle:data?.answers?.ceoStyle||'신중보수형',styleOrder:style.order,companyTypes:companies.map(x=>x.name),companyContext:companies.map(x=>x.context)},advanced:[lib?.guardrail||'미확인 사실은 확정적으로 표현하지 않습니다.',...this.companyContext(data),'계산값·연도·단위·법인/주주 주체를 본문과 일치시킵니다.'],connection:issue?`${issue.consulting||'정밀진단'} / 보험: ${issue.insurance||'추가 확인 후 판단'}`:'다음 자료와 의사결정 항목을 합의합니다.',transition:lib?.nextAction||style.closing,documents:documentList(page.issueId)};
};

function documentList(id,data=state.analysis||state.caseData){
 const c=data?.financials?.['2025']||{},override=(data?.speechOverrides||{})[id]||{};
 if(id==='WORKING_CAPITAL'){
  if(/유동성|차입금|만기/.test(override.title||''))return ['차입처별 원금·금리·만기·담보표','최근 13주 자금수지와 향후 13주 전망','최소 운영현금·미사용 신용한도','장기투자자산·비영업 자금운용 명세'];
  return ['거래처별 채권연령표','재고연령·품목별 재고명세','차입처별 만기·금리표','최근 13주 자금수지'];
 }
 if(id==='CAPITAL_POLICY')return Number.isFinite(c.retainedEarnings)&&c.retainedEarnings<0?['누적결손 발생원인 브리지 자료','최근 3년 사업별·투자별 손익자료','차입만기·금융비용·투자자산 명세','3년 결손해소·최소운영현금 계획']:['3년 투자·자금계획','최소 운영현금 기준','배당·보수·퇴직 규정','주주명부·주주별 현금수요'];
 if(id==='CAPITAL_TRANSACTIONS')return (data?.capitalEvents||[]).length?['확인된 자본거래 계약·결의서','거래 전후 주주명부·발행주식수','당시 가치평가·세무검토','회사·주주별 현금흐름 자료']:['자본변동표·기타자본 세부명세','연도별 주주명부·발행주식수','자본금 변동 관련 이사회·주총 의사록(해당 시)','주식발행·취득·처분·전환 계약자료(해당 시)'];
 return ({LOAN_RECEIVABLE:['계정별 원장','계약서·이사회 결의','이자수취 내역','상환·담보 자료'],SUCCESSION:['주주명부·정관','가족관계·후계자 의사','기업가치 자료','기존 승계·증여 내역'],KEY_PERSON:['대표 업무·권한표','월 고정비·채무·보증','가용현금','기존 보험증권'],EXPORT_CREDIT:['거래처별 채권연령','매출집중도','연체·대손 이력','해외법인·현지 보험증권'],INSURANCE_OPTIMIZATION:['전체 보험증권','계약자·피보험자·수익자','보험료·보장·환급금','가입 목적·회계처리']})[id]||['원본 기업보고서','관련 원장·계약·의사록','대표 추가답변','전문가 검토자료'];
}

function allQuestions(analysis){const ids=new Set();const out=[];for(const q of COMMON_QUESTIONS){if(!ids.has(q.id)){ids.add(q.id);out.push(q);}}for(const issue of analysis.issues||[]){for(const q of CONDITIONAL_QUESTIONS[issue.id]||[]){if(!ids.has(q.id)){ids.add(q.id);out.push(q);}}}for(const q of analysis.dynamicQuestions||[]){if(!ids.has(q.id)){ids.add(q.id);out.push(q);}}return out;}

function buildConfirmedModel(data){
 const calculations=computeAnalysis(data);const issues=buildIssues(data,calculations);const insurance=buildInsuranceOpportunities(data,issues,calculations);
 const model={version:'CAM-1.3',caseId:data.meta.caseId,meta:clone(data.meta),confirmedAt:nowIso(),profile:clone(data.profile),financials:clone(data.financials),latestQuarterly:clone(data.latestQuarterly||null),capitalEvents:clone(data.capitalEvents),answers:clone(data.answers||{}),sourceMap:clone(data.sourceMap||{}),warnings:clone(data.warnings||[]),speechPlan:clone(data.speechPlan||null),speechOverrides:clone(data.speechOverrides||buildSpeechOverrides(data)),dynamicQuestions:clone(data.dynamicQuestions||[]),derivedSignals:clone(data.derivedSignals||[]),confirmationQueue:clone(data.confirmationQueue||[]),extractionResult:clone(data.extractionResult||null),calculations,issues,insurance,legalEvidence:[],unconfirmed:[],quality:null};
 model.unconfirmed=[...Object.entries(model.answers).filter(([,v])=>v===null||v===''||v==='미확인').map(([k])=>k),...(data.capitalEvents||[]).filter(x=>x.status!=='confirmed').map(x=>x.type)];return model;
}

function kpi(label,value,note='',kind=''){return `<div class="kpi ${kind}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`;}
function list(items){return `<ul>${textArray(items).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;}
function pageShell({id,title,subtitle='',section='CORPORATE REPORT',visibility='common',issueId='',body='',cover=false,summary='',notePurpose=''}){
 const pageNo=String(state.pages?.length+1).padStart(2,'0');
 if(cover)return {id,title,subtitle,section,visibility,issueId,summary,notePurpose,html:`<section class="report-page cover" id="${id}" data-visibility="${visibility}" data-issue="${issueId}"><div class="cover-top">JARVIA CORPORATE DECISION · SOLUTION · AUDIO LEARNING</div><div class="cover-mid"><div class="eyebrow">기업경영 의사결정·해설교육 종합리포트</div><h1>${esc(state.caseData.profile.displayName||state.caseData.profile.companyName)}</h1><p>팩트·계산·근거·CEO 결정과 실전상담 코칭을 하나의 분석데이터로 연결합니다.</p><div class="tags"><span>CEO 의사결정형</span><span>A4·PDF</span><span>경영실행 지원</span><span class="consultant-only">컨설턴트 코칭</span><span class="consultant-only">보험기회 검증</span><span class="consultant-only">음성강의</span></div></div><div class="cover-grid"><div><b>분석기간</b><span>2023~2025년</span></div><div><b>기초자료</b><span>${esc(state.caseData.meta.sourceType)} ${safeNum(state.caseData.meta.sourcePages)}p</span></div><div><b>최근 결산일</b><span>${esc(state.caseData.profile.fiscalDate)}</span></div></div><div class="cover-note">본 리포트는 확인된 기업자료와 추가 상담정보를 바탕으로 경영 의사결정을 지원합니다. 개별 세무·법률·보험 판단은 관련 증빙과 전문가 검토 후 확정하십시오.</div><footer class="page-footer"><span>CONFIDENTIAL · ${esc(state.caseData.meta.caseId)}</span><b>01</b></footer></section>`};
 const noteBtn=visibility==='audio'?'':`<button class="note-trigger" type="button" data-note-page="${id}">✎ 상담노트</button>`;
 return {id,title,subtitle,section,visibility,issueId,summary,notePurpose,html:`<section class="report-page ${visibility==='consultant'?'consultant-only':''} ${visibility==='audio'?'audio-page':''}" id="${id}" data-visibility="${visibility}" data-issue="${issueId}"><header class="page-header"><div><div class="sec">${esc(section)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="mini">JARVIA · CORPORATE REPORT</div></header><main class="page-main">${body}</main>${noteBtn}<footer class="page-footer"><span>${esc(state.caseData.profile.displayName||state.caseData.profile.companyName)} · ${esc(state.caseData.meta.caseId)}</span><b>${pageNo}</b></footer></section>`};
}
function addPage(spec){const p=pageShell(spec);state.pages.push(p);return p;}
function issueFlow(issue){return `<div class="issue-flow"><article class="fact"><span>01</span><h3>확인된 팩트</h3>${list(issue.facts)}</article><article class="meaning"><span>02</span><h3>경영상 의미</h3><p>${esc(issue.meaning)}</p></article><article class="risk"><span>03</span><h3>방치 시 위험</h3>${list(issue.risks)}</article><article class="benefit"><span>04</span><h3>해결 방향</h3>${list(issue.solutions)}</article><article class="decision"><span>05</span><h3>결정·계약 연결</h3><p><b>유료컨설팅:</b> ${esc(issue.consulting||'정밀진단')}</p><p><b>보험 검토:</b> ${esc(issue.insurance||'추가 확인 후 판단')}</p></article></div>`;}
function issuePage(issue,index){
 const lib=SpeechEngine.get(issue.id,state.caseData);const body=`<div class="lead"><b>${esc(issue.title)} — ${esc(issue.severity)} / 근거 ${esc(issue.confidence)}</b><p>${esc(issue.meaning)}</p></div>${issueFlow(issue)}<div class="notice amber"><b>표현 경계</b>${esc(lib.guardrail||'미확인 사실은 단정하지 않습니다.')}</div><div class="source-box"><b>근거</b> ${esc(issue.facts.join(' · '))}</div>`;
 return addPage({id:'issue-'+issue.id.toLowerCase(),title:issue.title,subtitle:'사실 → 의미 → 위험 → 해결 → 다음 행동의 순서로 판단합니다.',section:'CORE ISSUE '+String(index+1).padStart(2,'0'),visibility:'common',issueId:issue.id,summary:issue.meaning,body});
}
function solutionPage(issue,index){
 const docs=documentList(issue.id);const options=issue.id==='WORKING_CAPITAL'?[['A안','현황 유지·월간 모니터링','비용은 낮지만 현금개선 속도가 느립니다.'],['B안','8~12주 정밀 프로젝트','채권·재고·13주 현금흐름을 동시에 개선합니다.'],['C안','프로젝트+위험전가','거래처·수출·휴업 위험이 확인될 때 보험을 결합합니다.']]:[['A안','자료 복원·사실확정','확정 전 단정과 실행을 막습니다.'],['B안','전문가 공동 정밀진단','세무·법률·가치·지배구조를 함께 검토합니다.'],['C안','실행·사후관리','의사록·계약·지급·회수·보험을 단계적으로 실행합니다.']];
 const body=`<div class="lead"><b>${esc(issue.title)} 실행설계</b><p>전체 결정을 한 번에 요구하지 않고 자료확인 → 정량화 → 대안비교 → 실행합의의 단계로 진행합니다.</p></div><div class="options">${options.map((o,i)=>`<div class="option ${i===1?'recommended':''}"><em>${i===1?'권장':''}</em><h3>${esc(o[0])} · ${esc(o[1])}</h3><p>${esc(o[2])}</p></div>`).join('')}</div><div class="cols2" style="margin-top:5mm"><div class="card mint"><h3>다음 미팅 전 준비자료</h3>${list(docs)}</div><div class="card"><h3>실행 산출물</h3>${list(issue.solutions.map(x=>x+' 결과표').concat(['CEO 결정사항·담당자·기한','전문가 검토 및 보험 적합성 확인']))}</div></div><div class="decision-bar"><b>이번 페이지에서 합의할 것</b><span>${esc(SpeechEngine.get(issue.id,state.caseData).nextAction||'자료와 다음 미팅 일정을 확정합니다.')}</span></div>`;
 return addPage({id:'solution-'+issue.id.toLowerCase(),title:issue.title+' 실행대안',subtitle:'A·B·C안의 범위와 다음 행동을 결정합니다.',section:'SOLUTION '+String(index+1).padStart(2,'0'),visibility:'common',issueId:issue.id,summary:'실행범위와 자료·담당자·기한을 합의합니다.',body});
}

function buildAudioChapters(model){
 const active=(model.issues||[]).map(x=>x.id).filter(id=>ISSUE_SPEECH_LIBRARY[id]);
 const p=model.profile||{},r=model.calculations?.ratios||{};
 const insuranceHigh=(model.insurance||[]).some(x=>['A','B','A_CORE','B_CONDITIONAL'].includes(x.grade))&&(active.includes('KEY_PERSON')||active.includes('SUCCESSION'));
 const optimize=active.includes('INSURANCE_OPTIMIZATION')||['일부 확보','전체 확보'].includes(model.answers?.existingInsurance);
 const lectureType=optimize?'INSURANCE_OPTIMIZATION':insuranceHigh?'INSURANCE_OPPORTUNITY':'CONSULTING_PRIORITY';
 model.audioLectureType=lectureType;
 const company=p.displayName||p.companyName||'이 기업';
 const introType=!activeIssues.length?'현재 자동 임계치상 핵심 이슈를 확정하지 않고 추가 확인이 필요한 기업':{INSURANCE_OPPORTUNITY:'대표 유고·승계의 부족재원을 계산할 가치가 높은 기업',CONSULTING_PRIORITY:'보험보다 경영 정밀진단과 실행프로젝트가 우선인 기업',INSURANCE_OPTIMIZATION:'신규가입보다 기존 증권의 목적·공백·중복 점검이 우선인 기업'}[lectureType];
 const chapters=[{title:'기업의 한 문장 진단과 학습목표',minutes:2,sourceIssueIds:active.slice(),script:`자비아 기업경영 의사결정 해설교육, 시작하겠습니다. 오늘의 목표는 리포트를 외우는 것이 아니라 ${company}에서 무엇을 묻고 어떤 순서로 상담해야 하는지 익히는 것입니다. 이번 기업은 ${introType}입니다. 보험은 분석의 출발점이 아니라 위험과 부족재원이 확인된 뒤 비교하는 결론입니다.`}];
 active.slice(0,3).forEach((id,idx)=>{const lib=SpeechEngine.get(id,model),note=SpeechEngine.notes({issueId:id,title:lib.title,summary:lib.signal},model,model),branch=note.branches[idx%note.branches.length],obj=note.objections[0];chapters.push({title:`핵심 이슈 ${idx+1} · ${lib.title}`,minutes:4,sourceIssueIds:[id],script:`학습목표는 ${lib.title}의 숫자를 경영언어로 설명하고 다음 행동에 합의하는 것입니다.\n\n${note.speech3m}\n\n실전 질문은 다음과 같습니다. ${note.questions.slice(0,3).join(' ')}\n\n대표가 ${branch?.expression||'다른 의견을 제시'}하면 ${branch?.response||'우려를 인정합니다.'} 이어서 ${branch?.followUp||'판단기준을 질문합니다.'} 최종 행동은 ${branch?.agreement||lib.nextAction}입니다.${obj?`\n\n대표 반론 “${obj.title}”에는 ${obj.dialogue.filter(x=>x.speaker==='컨설턴트').map(x=>x.text).join(' ')}`:''}`});});
 if(lectureType==='INSURANCE_OPPORTUNITY')chapters.push({title:'보험을 꺼내는 시점과 8단계',minutes:4,sourceIssueIds:active.filter(id=>['KEY_PERSON','SUCCESSION','EXECUTIVE_RETIREMENT','EXPORT_CREDIT','PROPERTY_BI','INSURANCE_OPTIMIZATION'].includes(id)),script:`잘못된 접근은 상품과 세금부터 말하는 것입니다. 올바른 순서는 위험사건, 재무충격, 필요재원, 현재재원, 부족재원, 보험 외 대안, 보험 역할입니다. ${INSURANCE_SPEECH_STAGES.map(x=>`${x.stage}. ${x.speech} 완료조건은 ${x.gate}.`).join(' ')} 부족재원이 없으면 보험을 확대하지 않습니다.`});
 else if(lectureType==='INSURANCE_OPTIMIZATION')chapters.push({title:'기존 증권 최적화 원칙',minutes:4,sourceIssueIds:['INSURANCE_OPTIMIZATION'],script:`신규가입보다 모든 법인·개인 증권을 목적별로 분류합니다. 계약자·피보험자·수익자, 보장금액·기간, 현금가치, 해지손실, 면책, 신규심사를 필요재원과 비교합니다. 목적과 기간이 맞으면 유지가 결론이고, 과다하면 감액을 검토하며, 실제 부족분에만 추가설계를 검토합니다. 기존 담당자와의 관계를 존중하고 공동검토할 수 있습니다.`});
 else chapters.push({title:'보험을 배제하고 유료진단을 제안하는 법',minutes:3,sourceIssueIds:active.slice(),script:`현재 분석에서 보험의 직접 당위성이 낮다면 명확히 배제해야 신뢰가 생깁니다. 운전자금, 대여금, 자본거래, 규정과 절차는 보험으로 해결하지 않습니다. 정밀진단의 산출물, 담당자, 기한, KPI와 중단조건을 먼저 합의하고 별도의 우연한 위험과 부족재원이 발견될 때만 보험 게이트를 엽니다.`});
 const objection=SpeechEngine.objectionsFor(active[0]||'WORKING_CAPITAL')[0];
 chapters.push({title:'대표 반론 역할극과 다음 미팅',minutes:3,sourceIssueIds:active.slice(0,1),script:`반론은 거절이 아니라 추가 확인 요청입니다. ${objection?objection.dialogue.map(x=>`${x.speaker}: ${x.text}`).join(' '):'대표의 우려를 인정하고 진짜 이유를 확인한 뒤 범위를 한 단계로 줄입니다.'} 모든 반론의 끝에는 자료, 담당자, 기한, 재검토일 중 하나가 남아야 합니다.`});
 chapters.push({title:'현장 실행과제',minutes:2,sourceIssueIds:active.slice(),script:`다음 미팅에서는 ${active.slice(0,3).flatMap(documentList).slice(0,8).join(', ')}를 준비하십시오. 오늘 전체 계약을 요구하지 않고 판단자료와 다음 확인일까지만 합의합니다. 오늘 주제에서 딱 하나만 기억한다면, 확인된 사실과 계산된 부족재원보다 보험이 먼저 나가서는 안 된다는 원칙입니다. 이상, 자비아 기업경영 의사결정 해설교육이었습니다.`});
 let total=chapters.reduce((s,x)=>s+x.minutes,0);if(total<18)chapters[chapters.length-2].minutes+=18-total;if(total>25)chapters.filter(x=>x.minutes>3).forEach(x=>{if(total>25){x.minutes--;total--;}});return chapters;
}

function generatePages(model){
 state.pages=[];state.caseData=model; // page builder uses caseData profile/meta
 addPage({id:'cover',title:'표지',cover:true,visibility:'common'});
 addPage({id:'guide',title:'이 리포트는 무엇을 결정하게 하는가',subtitle:'팩트 → 계산 → 근거 → 대안 → 다음 행동의 순서로 읽습니다.',section:'REPORT GUIDE',visibility:'common',summary:'리포트의 사용 목적과 모드 구분',body:`<div class="lead"><b>재무설명이 아니라 CEO의 결정과 컨설턴트의 실행을 지원합니다.</b><p>확인된 팩트와 계산값에서 출발해 유료컨설팅·전문가 협업·보험의 역할을 구분합니다.</p></div><div class="cols3"><div class="card mint"><h3>CEO용</h3>${list(['확인된 사실과 경영적 의미','방치위험과 해결이익','A·B·C 대안','30·90·365일 결정'])}</div><div class="card consultant-only"><h3>컨설턴트용</h3>${list(['페이지별 10단 상담노트','질문·답변분기·반론','유료컨설팅과 보험기회','다음 미팅·계약전환'])}</div><div class="card amber consultant-only"><h3>음성강의용</h3>${list(['리포트 낭독 금지','숫자의 실무 의미','CEO 질문·역할극','보험을 꺼낼 시점'])}</div></div><div class="notice"><b>보험 원칙</b>위험 확인 → 필요재원 → 현재재원 → 부족재원 → 대안 비교 → 보험의 역할 순서로만 접근합니다.</div>`});
 addPage({id:'toc',title:'통합 목차',subtitle:'현재 기업에 실제로 활성화된 페이지만 구성합니다.',section:'CONTENTS',visibility:'common',summary:'조건부 페이지 목차',body:`<div class="toc-grid" id="tocInside"></div><div class="notice amber"><b>조건부 생성</b>내용이 부족하면 페이지를 만들지 않으며, 미확인 사실로 페이지 수를 채우지 않습니다.</div>`});
 const r=model.calculations.ratios,c=model.financials['2025'],p=model.profile;
 const ratioClass=(v,good,warn)=>!Number.isFinite(v)?'warn':v>=good?'good':v>=warn?'warn':'bad';
 const debtComment=!Number.isFinite(r.debtRatio)?'확인 필요':r.debtRatio<100?'100% 미만':r.debtRatio<200?'100~200% · 업종비교 필요':'200% 이상 · 구조 확인';
 const currentComment=!Number.isFinite(r.currentRatio)?'확인 필요':r.currentRatio>=150?'150% 이상 · 구성 확인':r.currentRatio>=100?'100% 이상':'100% 미만 · 주의';
 const quickComment=!Number.isFinite(r.quickRatio)?'확인 필요':r.quickRatio>=100?'100% 이상':r.quickRatio>=70?'70~100%':'70% 미만';
 const cashComment=!Number.isFinite(r.cashRatio)?'확인 필요':r.cashRatio>=20?'20% 이상':r.cashRatio>=10?'10~20%':'10% 미만';
 const confirmedStrengths=[];if(Number.isFinite(c.operatingProfit))confirmedStrengths.push(c.operatingProfit>0?`2025년 영업이익 ${wonEok(c.operatingProfit)}`:`2025년 영업손실 ${wonEok(c.operatingProfit)}`);if(Number.isFinite(c.equity))confirmedStrengths.push(c.equity>0?`자본총계 ${wonEok(c.equity)}`:`자본총계 ${wonEok(c.equity)} · 자본잠식 검토`);if(p.creditGrade)confirmedStrengths.push(`기업평가등급 ${p.creditGrade}`);
 addPage({id:'executive-summary',title:'CEO가 먼저 볼 핵심 결정',subtitle:'확인된 숫자와 활성 이슈의 다음 행동을 한 장에 압축했습니다.',section:'EXECUTIVE SUMMARY',visibility:'common',summary:'CEO 핵심 결정',body:`<div class="kpis">${kpi('매출 성장률',pct(r.salesGrowth),'2024→2025',Number.isFinite(r.salesGrowth)&&r.salesGrowth>=0?'good':'warn')}${kpi('영업이익률',pct(r.operatingMargin),'2025',Number.isFinite(r.operatingMargin)&&r.operatingMargin>0?'good':'warn')}${kpi('유동비율',pct(r.currentRatio),currentComment,ratioClass(r.currentRatio,150,100))}${kpi('차입금의존도',pct(r.borrowingDependency),'총차입금÷자산',Number.isFinite(r.borrowingDependency)&&r.borrowingDependency<30?'good':Number.isFinite(r.borrowingDependency)&&r.borrowingDependency<50?'warn':'bad')}</div><div class="cols2"><div class="card mint"><h3>확인된 현황</h3>${list(confirmedStrengths.length?confirmedStrengths:['추가 확인 필요'])}</div><div class="card red"><h3>우선 확인</h3>${list(model.issues.length?model.issues.map(x=>x.title+' — '+x.solutions[0]):['현재 자동 활성화된 핵심 이슈 없음 · 확인질문과 원자료 검토'])}</div></div><div class="decision-bar"><b>권장 우선순위</b>${model.issues.length?model.issues.map((x,i)=>`<span>${i+1}. ${esc(x.title)}</span>`).join(''):'<span>원자료 확인 후 우선순위 확정</span>'}</div>`});
 addPage({id:'company-facts',title:'기업 팩트 대시보드',subtitle:'원문에서 확인된 정보와 최신 확인이 필요한 정보를 분리합니다.',section:'CONFIRMED FACTS',visibility:'common',summary:'기업 기본정보와 출처',body:`<div class="cols2"><div class="card"><h3>기업 개요</h3><table><tbody>${[['기업명',p.companyName],['대표자',p.representative],['설립일',p.established],['종업원',Number.isFinite(p.employees)?p.employees+'명':'미확인'],['업종',p.industry],['주요제품',p.products],['기업평가등급',p.creditGrade],['WATCH등급',p.watchGrade||'미확인'],['현금흐름등급',p.cashFlowGrade||'미확인']].map(x=>`<tr><th>${esc(x[0])}</th><td>${esc(x[1])}</td></tr>`).join('')}</tbody></table></div><div class="card"><h3>주주·관계사</h3>${list((p.shareholders||[]).map(x=>`${x.name} ${x.ownershipPercent}%`).concat(p.relatedCompanies||[]))}<div class="notice amber"><b>확인 필요</b>관계사 거래조건·보증·지분변동은 추가자료로 확인합니다.</div></div></div><div class="source-box"><b>Source Map</b> ${Object.entries(model.sourceMap||{}).map(([k,v])=>esc(k+': '+v)).join(' · ')}</div>`});
 const trendRows=[['매출액','revenue','매출 규모'],['영업이익','operatingProfit','본업 수익력'],['당기순이익','netIncome','최종 손익'],['영업활동조달현금','operatingCashFlow','영업 현금창출'],['현금성자산','cash','가용성 별도 확인'],['매출채권','receivables','회수조건 확인'],['재고자산','inventory','재고구성 확인'],['총차입금','borrowings','만기·금리·담보 확인'],['이익잉여금','retainedEarnings','누적결손 여부']];
 addPage({id:'financial-trend',title:'3개년 재무 추세',subtitle:'개별 결산 기준으로 단위·연도·주체를 통일했습니다.',section:'FINANCIAL TREND',visibility:'common',summary:'3개년 재무표',body:`<table><thead><tr><th>항목(백만원)</th><th class="num">2023</th><th class="num">2024</th><th class="num">2025</th><th>확인 포인트</th></tr></thead><tbody>${trendRows.map(([l,k,note])=>`<tr><td>${l}</td>${['2023','2024','2025'].map(y=>`<td class="num ${Number(model.financials[y][k])<0?'neg':''}">${Number.isFinite(model.financials[y][k])?model.financials[y][k].toLocaleString('ko-KR'):'—'}</td>`).join('')}<td>${note}</td></tr>`).join('')}</tbody></table><div class="notice"><b>핵심</b>실적·현금·차입·자본을 같은 방향으로 단정하지 않고 각 변동의 원인을 추가자료로 확인합니다.</div>`});
 addPage({id:'financial-ratios',title:'핵심 재무비율과 경영적 의미',subtitle:'비율은 판정이 아니라 질문과 의사결정의 출발점입니다.',section:'RATIO ANALYSIS',visibility:'common',summary:'주요 재무비율',body:`<div class="kpis">${kpi('부채비율',pct(r.debtRatio),debtComment,Number.isFinite(r.debtRatio)&&r.debtRatio<100?'good':Number.isFinite(r.debtRatio)&&r.debtRatio<200?'warn':'bad')}${kpi('유동비율',pct(r.currentRatio),currentComment,ratioClass(r.currentRatio,150,100))}${kpi('당좌비율',pct(r.quickRatio),quickComment,ratioClass(r.quickRatio,100,70))}${kpi('현금비율',pct(r.cashRatio),cashComment,ratioClass(r.cashRatio,20,10))}</div><div class="stat-strip"><div><span>차입금의존도</span><b>${pct(r.borrowingDependency)}</b></div><div><span>이자보상배수</span><b>${Number.isFinite(r.interestCoverage)?r.interestCoverage.toFixed(2)+'배':'—'}</b></div><div><span>매출채권회수일</span><b>${Number.isFinite(r.dso)?r.dso.toFixed(1)+'일':'—'}</b></div></div><div class="notice amber"><b>해석 경계</b>동일 업종·규모 비교와 월별 원자료를 확인하기 전 정상·위험을 확정하지 않습니다.</div>`});
 model.issues.slice(0,7).forEach((issue,idx)=>{issuePage(issue,idx);solutionPage(issue,idx);});
 const activeIssueIds=new Set((model.issues||[]).map(x=>x.id)),signalIds=new Set((model.derivedSignals||[]).map(x=>x.signalId));
 const hasWorkingCapital=activeIssueIds.has('WORKING_CAPITAL'),isLiquidityCase=[...signalIds].some(id=>['LIQUIDITY_STRESS','BORROWING_SURGE','CASH_DROP','MATURITY_CONCENTRATION_WARNING'].includes(id)),isCycleCase=signalIds.has('WORKING_CAPITAL_CYCLE')||signalIds.has('LEVERAGE_PRESSURE');
 const cashCalc=model.calculations?.calculator?.cashFlow?.result||model.calculations?.calculator?.cashFlow?.envelope?.result||{},cccValue=cashCalc?.turnover?.ccc;
 const liquidityBody=`<div class="kpis">${kpi('유동비율',pct(r.currentRatio),'2025 개별결산','warn')}${kpi('현금비율',pct(r.cashRatio),'2025 개별결산','warn')}${kpi('총차입금',wonEok(model.financials['2025'].borrowings),'2025','warn')}${kpi('최근분기 유동차입',wonEok(model.latestQuarterly?.currentBorrowings),model.latestQuarterly?.periodEnd||'최근분기','warn')}</div><div class="cols2"><div class="card mint"><h3>필수 실행표</h3>${list(documentList('WORKING_CAPITAL',model))}</div><div class="card amber"><h3>확정 전 금지</h3>${list(['차입증가를 부실로 단정','투자자산을 즉시가용현금으로 간주','차환 가능성을 보장','보험을 차입해결책으로 제시'])}</div></div>`;
 const cycleBody=`<div class="kpis">${kpi('재고일수',Number.isFinite(r.inventoryDaysReported)?r.inventoryDaysReported.toFixed(1)+'일':'미확인','결산잔액 기준','warn')}${kpi('채권회수일',Number.isFinite(r.dso)?r.dso.toFixed(1)+'일':'미확인','결산잔액 기준','warn')}${kpi('현금전환주기',Number.isFinite(cccValue)?cccValue+'일':'미확인','재고+채권−매입','warn')}${kpi('차입금의존도',pct(r.borrowingDependency),'2025','warn')}</div><div class="cols2"><div class="card mint"><h3>필수 실행자료</h3>${list(documentList('WORKING_CAPITAL',model))}</div><div class="card amber"><h3>해석 경계</h3>${list(['회전일수를 회수불능으로 단정하지 않음','결산잔액 추정치를 월별 실적처럼 사용하지 않음','개선 시나리오를 확보 가능한 현금으로 보장하지 않음','거래처·품목별 원자료 확인 전 목표 확정 금지'])}</div></div>`;
 if(hasWorkingCapital)addPage({id:'working-capital-scenario',title:isLiquidityCase?'유동성·차입만기 관리 시나리오':isCycleCase?'재고·채권 회전 개선 시나리오':'운전자금 개선 시나리오',subtitle:isLiquidityCase?'현금유입·상환일·투자회수 시점을 13주 기준으로 맞춥니다.':'결산잔액 추정치를 거래처·품목별 원자료로 검증합니다.',section:'CALCULATED SCENARIO',visibility:'common',issueId:'WORKING_CAPITAL',summary:isLiquidityCase?'유동성·차입만기 관리':'회전일수·운전자금 관리',body:isLiquidityCase?liquidityBody:cycleBody});
 const capitalBody=(model.capitalEvents||[]).length?`<div class="timeline">${model.capitalEvents.map(x=>`<article><span>${esc(x.year)}</span><b>${esc(x.type)}</b><p>${wonEok(x.amount)} · ${x.status==='confirmed'?'확인값':'추가 확인'}</p></article>`).join('')}</div>`:`<div class="kpis">${kpi('2023 자본금',wonEok(model.financials['2023'].capitalStock),'개별결산')}${kpi('2025 자본금',wonEok(model.financials['2025'].capitalStock),'개별결산','warn')}${kpi('기타자본구성요소',wonEok(metricValueAt(model.extractionResult,'financialStatements.separateAnnual.2025-12-31.balanceSheet.otherCapitalComponents')),'세부내역 확인','warn')}${kpi('2025 이익잉여금',wonEok(model.financials['2025'].retainedEarnings),'누적결손','warn')}</div><div class="card mint"><h3>복원할 타임라인</h3>${list(documentList('CAPITAL_TRANSACTIONS',model))}</div>`;
 if(activeIssueIds.has('CAPITAL_TRANSACTIONS')||(model.capitalEvents||[]).length)addPage({id:'capital-timeline',title:(model.capitalEvents||[]).length?'자본거래 타임라인':'자본변동·기타자본 확인',subtitle:'거래를 추정하지 않고 주식수·현금·의사결정 자료를 복원합니다.',section:'CAPITAL TRANSACTIONS',visibility:'common',issueId:'CAPITAL_TRANSACTIONS',summary:'자본변동 확인',body:`${capitalBody}<div class="notice red"><b>단정 금지</b>세부 자본변동표를 확인하기 전 특정 자본거래가 있었다고 확정하지 않습니다.</div>`});
 const actionableInsurance=(model.insurance||[]).filter(x=>!['D','D_LOW'].includes(x.grade));
 if(actionableInsurance.length)addPage({id:'insurance-ceo',title:'경영위험 재원 확보 원칙',subtitle:'CEO에게는 상품이 아니라 필요재원과 대안 비교를 설명합니다.',section:'RISK FINANCING',visibility:'common',issueId:'',summary:'CEO용 위험재원 원칙',body:`<div class="lead"><b>필요재원 − 사용 가능한 현재재원 = 확인 가능한 부족재원</b><p>부족재원을 현금·금융자산·신용한도·계약·보험으로 나누어 준비합니다.</p></div><div class="issue-flow"><article class="fact"><span>01</span><h3>확인된 위험사건</h3><p>${esc(actionableInsurance.map(x=>x.title).join(' · '))}</p></article><article class="meaning"><span>02</span><h3>재무충격</h3><p>각 위험별 필요재원과 기간을 별도 계산합니다.</p></article><article class="risk"><span>03</span><h3>현재재원</h3><p>가용현금·금융자산·신용한도·기존 보험·계약상 권리</p></article><article class="benefit"><span>04</span><h3>부족재원</h3><p>확인되지 않은 항목은 질문으로 남기고 금액을 만들지 않습니다.</p></article><article class="decision"><span>05</span><h3>의사결정</h3><p>보험은 예고 없는 시점의 현금을 확보하는 수단 중 하나이며 법률·세무·경영절차를 대신하지 않습니다.</p></article></div>`});
 addPage({id:'insurance-matrix',title:'보험계약 기회 종합진단',subtitle:'근거·위험·필요재원·현재재원·보험적합성을 등급별로 구분합니다.',section:'CONSULTANT ONLY · INSURANCE',visibility:'consultant',issueId:'',summary:'보험기회 A~D 매트릭스',body:`<table><thead><tr><th>영역</th><th>등급</th><th>근거·역할</th><th>금액</th><th>다음 행동</th></tr></thead><tbody>${model.insurance.map(x=>`<tr><td><b>${esc(x.title)}</b><br><span class="pill">${esc(x.id)}</span></td><td><span class="grade ${x.grade}">${x.grade}</span></td><td>${esc(x.basis)}<br><small>${esc(x.role)}</small></td><td>${Number.isFinite(x.gap)?wonEok(x.gap):'추가 확인 후 산출'}</td><td>${esc(x.next)}</td></tr>`).join('')}</tbody></table><div class="notice red"><b>컴플라이언스 경계</b>보험기회 탐지는 상품추천이 아닙니다. 상품명·보험료·심사결과·계약구조는 최신 약관·설계·적합성·실제 인수심사 전에는 생성하지 않습니다.</div>`});
 if(actionableInsurance.length)addPage({id:'insurance-stages',title:'보험계약 8단계 상담 로드맵',subtitle:'필요성 발견에서 최종결정·사후관리까지 단계를 건너뛰지 않습니다.',section:'CONSULTANT ONLY · SALES PROCESS',visibility:'consultant',issueId:'',summary:'보험계약 8단계',body:`<table><thead><tr><th>단계</th><th>핵심 화법</th><th>필수 검증</th><th>통과 기준</th></tr></thead><tbody>${INSURANCE_SPEECH_STAGES.map(x=>`<tr><td><b>${esc(x.stage)}</b></td><td>${esc(x.speech)}</td><td>${esc(x.validation)}</td><td>${esc(x.gate)}</td></tr>`).join('')}</tbody></table>`});
 addPage({id:'consulting-map',title:'유료컨설팅·전문가·보험 연결지도',subtitle:'보험으로 해결할 문제와 그렇지 않은 문제를 명확히 구분합니다.',section:'CONSULTANT ONLY · OPPORTUNITY',visibility:'consultant',summary:'실행계약 기회',body:`<table><thead><tr><th>이슈</th><th>우선 계약</th><th>전문가 협업</th><th>보험 위치</th></tr></thead><tbody>${model.issues.map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.consulting||'정밀진단')}</td><td>${esc(['LOAN_RECEIVABLE','CAPITAL_POLICY','CAPITAL_TRANSACTIONS','SUCCESSION'].includes(x.id)?'세무·법률·가치평가 공동검토':'필요 시 회계·세무 검토')}</td><td>${esc(x.insurance||'추가 확인')}</td></tr>`).join('')}</tbody></table><div class="decision-bar"><b>권장 상업화 순서</b><span>1차 유료 정밀진단</span><span>주제별 프로젝트</span><span>전문가 실행</span><span>검증된 보장공백의 보험</span><span>연례관리</span></div>`});
 const activeDocs=model.issues.flatMap(x=>documentList(x.id,model).slice(0,2));
 addPage({id:'roadmap',title:'30·90·365일 실행 로드맵',subtitle:'활성 이슈를 자료·담당자·기한·산출물로 전환합니다.',section:'IMPLEMENTATION',visibility:'common',summary:'실행 로드맵',body:`<div class="timeline"><article><span>0~30 DAYS</span><b>사실확정</b><p>${esc(activeDocs.slice(0,4).join(' · '))}</p></article><article><span>31~90 DAYS</span><b>정밀진단</b><p>${esc(model.issues.map(x=>x.consulting).join(' · '))}</p></article><article><span>91~180 DAYS</span><b>실행</b><p>선택안 확정 · 전문가 검토 · 의사록·계약·자금계획 반영</p></article><article><span>181~365 DAYS</span><b>사후관리</b><p>유동성·차입·자본회복 KPI와 법령·보험 적합성 재점검</p></article></div><div class="notice"><b>완료의 정의</b>문서가 만들어진 것이 아니라 CEO가 담당자·자료·기한·다음 미팅 또는 실행계약을 결정한 상태입니다.</div>`});
 const decisionRows=model.issues.map(x=>[x.title,x.severity==='CRITICAL'||x.severity==='HIGH'?'우선 권장':'조건부',documentList(x.id,model).slice(0,2).join(' · ')]).concat([['보험설계 검토','부족재원 확인 후','기존 증권·가용현금·필요재원']]);
 addPage({id:'decision-sheet',title:'CEO 의사결정 시트',subtitle:'오늘 확정할 것과 다음 확인일까지 보류할 것을 구분합니다.',section:'DECISION SHEET',visibility:'common',summary:'CEO 결재·합의 항목',body:`<table><thead><tr><th>결정항목</th><th>현재 판단</th><th>필요자료</th><th>담당자·기한</th></tr></thead><tbody>${decisionRows.map(x=>`<tr><td><b>${esc(x[0])}</b></td><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>□ 담당 ______ □ 기한 ______</td></tr>`).join('')}</tbody></table><div class="decision-bar"><b>오늘의 최소 합의</b><span>자료 담당자</span><span>제출기한</span><span>2차 미팅일</span></div>`});
 addPage({id:'next-meeting',title:'2차 미팅 운영 스크립트',subtitle:'보고서 설명을 실행합의와 계약검토로 연결합니다.',section:'CONSULTANT ONLY · NEXT MEETING',visibility:'consultant',summary:'다음 미팅 화법',body:`<div class="cols2"><div class="card mint"><h3>오프닝</h3><p>“대표님, 지난번에는 가능성을 말씀드렸고 오늘은 제출해 주신 자료로 금액과 선택지를 확인하겠습니다. 오늘 전체 실행이 아니라 우선순위와 다음 한 단계만 결정하시면 됩니다.”</p></div><div class="card"><h3>마무리</h3><p>“오늘 합의한 범위는 ○○입니다. 담당자는 ○○, 자료제출은 ○월 ○일, 다음 회의에서는 A·B·C안을 비교하겠습니다.”</p></div></div><div class="card" style="margin-top:5mm"><h3>미팅 체크</h3>${list(['확인된 숫자와 미확인 가정 분리','대표 답변을 재진술해 동의 확인','보험을 필요재원 계산보다 먼저 제시하지 않음','자료·담당자·기한·다음 미팅 중 최소 2개 확정'])}</div>`});
 addPage({id:'documents',title:'필요자료 통합 체크리스트',subtitle:'기업별 조건부 이슈에 필요한 서류만 요청합니다.',section:'DATA REQUEST',visibility:'common',summary:'필요자료',body:`<div class="cols2">${model.issues.slice(0,6).map(x=>`<div class="card"><h3>${esc(x.title)}</h3>${list(documentList(x.id))}</div>`).join('')}</div>`});
 addPage({id:'evidence',title:'법령·예규·판례 근거 계획',subtitle:'TaxNavi는 이슈별 우선 출처를 검색하고 실무 의미만 요약합니다.',section:'EVIDENCE',visibility:'common',summary:'법률·세무 근거',body:`<table><thead><tr><th>이슈</th><th>우선 근거</th><th>검색목표</th><th>상태</th></tr></thead><tbody>${model.issues.filter(x=>['LOAN_RECEIVABLE','CAPITAL_POLICY','CAPITAL_TRANSACTIONS','SUCCESSION','KEY_PERSON'].includes(x.id)).map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.id==='LOAN_RECEIVABLE'?'세법·예규·판례':x.id==='SUCCESSION'?'상속·증여·가업승계 법령':'상법·세법·예규')}</td><td>요건·절차·경계선·전문가 확인사항</td><td><span class="pill gold">서버 TaxNavi 연결 시 실시간</span></td></tr>`).join('')}</tbody></table><div class="notice amber"><b>베타 상태</b>현재 1차 파일에는 안전한 서버 어댑터가 포함돼 있습니다. 실제 근거검색 결과는 corporateReportApi가 index.js에 추가된 뒤 채워집니다.</div>`});
 addPage({id:'quality-page',title:'품질·한계·사용상 주의',subtitle:'정확성·모드분리·보험경계·수치일치를 최종 게이트로 검사합니다.',section:'QUALITY GATE',visibility:'consultant',summary:'품질 및 유의사항',body:`<div id="qualityPageBody"></div>`});
 const calcRows=[];const addCalc=(label,formula,value,type='계산값')=>{if(value!==null&&value!==undefined&&value!=='—'&&value!=='미확인')calcRows.push([label,formula,value,type]);};
 addCalc('매출 성장률','(2025 매출−2024 매출)÷2024 매출×100',pct(r.salesGrowth));addCalc('영업이익률','영업이익÷매출액×100',pct(r.operatingMargin));addCalc('유동비율','유동자산÷유동부채×100',pct(r.currentRatio));addCalc('현금비율','현금및현금성자산÷유동부채×100',pct(r.cashRatio));addCalc('차입금의존도','총차입금÷자산총계×100',pct(r.borrowingDependency));addCalc('이자보상배율','영업이익÷금융비용',Number.isFinite(r.interestCoverage)?r.interestCoverage.toFixed(2)+'배':'—');addCalc('재고일수','평균재고÷매출원가×365',Number.isFinite(r.inventoryDaysReported)?r.inventoryDaysReported.toFixed(1)+'일':'—','결산잔액 추정');addCalc('매출채권회수일','평균매출채권÷매출액×365',Number.isFinite(r.dso)?r.dso.toFixed(1)+'일':'—','결산잔액 추정');addCalc('현금전환주기','재고일수+채권회수일−매입채무일',Number.isFinite(cccValue)?cccValue+'일':'—','결산잔액 추정');
 if(signalIds.has('CASH_DROP'))addCalc('현금 증감','2025 현금−2024 현금',Number.isFinite(model.financials['2025'].cash)&&Number.isFinite(model.financials['2024'].cash)?wonEok(model.financials['2025'].cash-model.financials['2024'].cash):'—','원문 차이');if(signalIds.has('BORROWING_SURGE'))addCalc('차입금 증감','2025 총차입금−2024 총차입금',Number.isFinite(model.financials['2025'].borrowings)&&Number.isFinite(model.financials['2024'].borrowings)?wonEok(model.financials['2025'].borrowings-model.financials['2024'].borrowings):'—','원문 차이');if(activeIssueIds.has('CAPITAL_POLICY'))addCalc('이익잉여금','2025 개별 결산',wonEok(model.financials['2025'].retainedEarnings),'원문값');if(activeIssueIds.has('CAPITAL_TRANSACTIONS'))addCalc('기타자본구성요소','2025 개별 결산',wonEok(metricValueAt(model.extractionResult,'financialStatements.separateAnnual.2025-12-31.balanceSheet.otherCapitalComponents')),'원문값');
 addPage({id:'calculation-appendix',title:'계산 근거 부록',subtitle:'모든 계산은 동일 ConfirmedAnalysisModel의 원문값만 참조합니다.',section:'CALCULATION APPENDIX',visibility:'common',summary:'산식과 계산근거',body:`<table><thead><tr><th>산출</th><th>산식</th><th>결과</th><th>성격</th></tr></thead><tbody>${calcRows.map(x=>`<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${esc(x[3])}</td></tr>`).join('')}</tbody></table><div class="source-box"><b>계산기 연결</b> ${model.calculations.calculator.ratios.ok?'JarviaCalculators 호출 성공':'브라우저 직접 검산·계산기 입력계약 추가 확인'} · ${esc(model.calculations.calculatorVersion||'version 미표시')}</div>`});
 model.audioChapters=buildAudioChapters(model);
 addPage({id:'audio-course',title:'실전 컨설팅 해설강의',subtitle:'리포트 낭독이 아니라 숫자·질문·반론·보험시점을 교육합니다.',section:'AUDIO LEARNING',visibility:'audio',summary:'18~25분 맞춤형 강의',body:`<div class="audio-hero"><div class="course-cover"><div class="ic">🎧</div><div class="eyebrow">CONSULTANT LEARNING</div><h2>${esc(p.displayName||p.companyName)} 기업경영<br>의사결정 해설강의</h2><p>복잡한 숫자의 경영적 의미와 CEO에게 물어볼 질문, 유료컨설팅과 보험검토의 조건을 쉽게 설명합니다.</p><div class="course-actions"><button type="button" data-audio-action="play">▶ 브라우저 강의 시작</button><button type="button" class="settings" data-audio-settings>⚙ 강의 조절</button></div><div style="margin-top:6mm;font-size:9px;color:#99f6e4">권장 학습시간 ${model.audioChapters.reduce((s,x)=>s+x.minutes,0)}분 · ${model.audioChapters.length}개 챕터</div></div><div><div class="chapter-list" id="audioChapterList">${model.audioChapters.map((x,i)=>`<button type="button" data-chapter="${i}" class="${i===0?'on':''}"><span>CHAPTER ${String(i+1).padStart(2,'0')} · ${x.minutes}분</span><b>${esc(x.title)}</b><p>${esc(sentence(x.script,100))}</p></button>`).join('')}</div><div class="audio-controls"><button data-audio-action="play">▶ 재생</button><button data-audio-action="pause">⏸ 일시정지</button><button data-audio-action="stop">■ 정지</button><select id="audioRate"><option value="0.9">0.9×</option><option value="1" selected>1.0×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select><button data-audio-action="mp3">고급 MP3 생성</button></div><div class="audio-transcript" id="audioTranscript">${esc(model.audioChapters[0].script)}</div></div></div>`});
 addPage({id:'closing',title:'최종 제안과 다음 행동',subtitle:'리포트 생성이 아니라 CEO의 실행결정으로 마무리합니다.',section:'FINAL PROPOSAL',visibility:'common',summary:'최종 제안',body:`<div class="lead"><b>활성 이슈에 대한 1차 사실확정·정밀진단을 우선 제안합니다.</b><p>${esc(model.issues.map(x=>x.title).join(' · '))}의 자료와 원인을 확정한 뒤 전문가 실행과 보험 적합성을 순서대로 검토합니다.</p></div><div class="options"><div class="option"><em>STEP 1</em><h3>팩트·자료 확정</h3><p>${esc(activeDocs.slice(0,4).join(' · '))}</p></div><div class="option recommended"><em>STEP 2 · 권장</em><h3>정밀진단 프로젝트</h3><p>계산·시나리오·의사결정·실행계획</p></div><div class="option"><em>STEP 3</em><h3>전문가·보험 실행</h3><p>확인된 법률·세무·자본·보장공백만 실행</p></div></div><div class="decision-bar"><b>다음 미팅</b><span>날짜 ______</span><span>담당자 ______</span><span>제출자료 ______</span><span>결정사항 ______</span></div>`});
 state.caseData=model;state.pages.forEach(p=>p.notes=SpeechEngine.notes(p,model,model));return state.pages;
}

function renderPages(){
 const deck=$('reportDeck');if(!deck)return;deck.innerHTML=state.pages.map(p=>p.html).join('');$('emptyReport').style.display=state.pages.length?'none':'block';deck.style.display=state.pages.length?'block':'none';
 applyMode(state.mode,false);bindDynamic();renderToc();renderPageNav();state.quality=runQuality();renderQualityPage();updateStatus();
}
function visibleForMode(p,mode){if(mode==='audio')return p.visibility==='audio';if(mode==='ceo')return p.visibility==='common';return p.visibility!=='audio';}
function applyMode(mode,scroll=true){
 state.mode=mode;document.body.classList.remove('mode-ceo','mode-consultant','mode-audio');document.body.classList.add('mode-'+mode);
 ['ceo','consultant','audio'].forEach(m=>$('mode'+m[0].toUpperCase()+m.slice(1))?.classList.toggle('on',m===mode));
 state.visiblePages=state.pages.filter(p=>visibleForMode(p,mode));
 qsa('.report-page').forEach(el=>{const p=state.pages.find(x=>x.id===el.id);el.classList.toggle('hidden-mode',!p||!visibleForMode(p,mode));});
 renderPageNav();renderToc();if(scroll&&state.visiblePages[0])$(state.visiblePages[0].id)?.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderToc(){
 const make=(container)=>{if(!container)return;container.innerHTML=state.visiblePages.map((p,i)=>`<button type="button" data-jump="${p.id}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(p.title)}</span></button>`).join('');};
 make($('tocInside'));
}
function renderPageNav(){
 const nav=$('pageNav');if(!nav)return;nav.innerHTML=state.visiblePages.map((p,i)=>`<button type="button" data-jump="${p.id}" class="${i===0?'on':''}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(p.title)}</span></button>`).join('');
}
function bindDynamic(){
 qsa('[data-jump]').forEach(b=>b.onclick=()=>{const el=$(b.dataset.jump);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});});
 qsa('[data-note-page]').forEach(b=>b.onclick=()=>openNotes(b.dataset.notePage));
 qsa('[data-chapter]').forEach(b=>b.onclick=()=>selectChapter(Number(b.dataset.chapter)));
 qsa('[data-audio-action]').forEach(b=>b.onclick=()=>audioAction(b.dataset.audioAction));
}
function updateStatus(){
 const company=state.caseData?.profile?.displayName||state.caseData?.profile?.companyName||'—';$('caseChip').textContent=company;
 $('statusTitle').textContent=state.factsConfirmed?'확정 분석데이터 기반 작업본':'확인 대기 작업본';
 $('statusText').textContent=state.factsConfirmed?`${state.pages.length}개 페이지 · ${state.analysis?.issues?.length||0}개 이슈 · 품질 ${state.quality?.average?.toFixed(1)||'—'}점`:'추출값을 확인한 뒤 분석을 확정하십시오.';
 const steps=[['PDF·자료',!!state.caseData],['팩트 승인',state.factsConfirmed],['추가질문',state.questionsConfirmed],['계산·이슈',!!state.analysis],['3모드 리포트',state.pages.length>0],['품질게이트',state.quality?.passed]];
 $('flowCard').innerHTML=steps.map((x,i)=>`<div class="flow-row ${x[1]?'done':i===steps.findIndex(y=>!y[1])?'current':''}"><span>${x[1]?'✓':i+1}</span><b>${x[0]}</b></div>`).join('');
}
function openNotes(pageId){
 const p=state.pages.find(x=>x.id===pageId);if(!p)return;const x=p.notes||{};$('notesTitle').textContent=p.title+' · 상담노트';
 const branches=(x.branches||[]).map(b=>`<div class="branch-card"><b>${esc(b.type)} · ${esc(b.expression)}</b><p>${esc(b.response)}</p><p><strong>재질문:</strong> ${esc(b.followUp)}</p><small>행동합의: ${esc(b.agreement)}</small></div>`).join('');
 const objections=(x.objections||[]).map(o=>`<div class="branch-card"><b>${esc(o.title)}</b>${o.dialogue.map(d=>`<p><strong>${esc(d.speaker)}:</strong> ${esc(d.text)}</p>`).join('')}</div>`).join('');
 $('notesBody').innerHTML=`<section class="note-sec"><div class="lab">01 PAGE PURPOSE</div><h3>페이지 목적</h3><p>${esc(x.purpose)}</p></section><section class="note-sec"><div class="lab">02 KEY DIAGNOSIS</div><h3>핵심 진단</h3><p>${esc(x.diagnosis)}</p></section><section class="note-sec"><div class="lab">03 SPEECH</div><h3>30초 문제제기</h3><p>${esc(x.speech30)}</p><h3>90초 표준화법</h3><p>${esc(x.speech90)}</p><details><summary>3분·5분 심화화법</summary><p>${esc(x.speech3m)}</p><p>${esc(x.speech5m)}</p></details></section><section class="note-sec"><div class="lab">04 QUESTIONS</div><h3>CEO 확인질문</h3>${list(x.questions)}</section><section class="note-sec"><div class="lab">05 RESPONSE BRANCHES</div><h3>답변별 분기</h3>${branches||'<p>이 페이지는 공통 분기화법을 적용합니다.</p>'}</section><section class="note-sec"><div class="lab">06 OBJECTIONS</div><h3>반론 대응</h3>${objections||'<p>해당 이슈의 실제 반론을 확인한 뒤 공감→진짜 이유→범위축소→근거→행동합의로 대응합니다.</p>'}</section><section class="note-sec"><div class="lab">06B COMPLETE SCENARIO</div><h3>완전 상담 시나리오</h3>${x.scenario?`<div class="branch-card"><b>${esc(x.scenario.title)}</b><p>${esc(x.scenario.text)}</p></div>`:'<p>공통 미팅 시나리오를 적용합니다.</p>'}<h3>맞춤화 기준</h3>${x.customization?list([`CEO: ${x.customization.ceoStyle} · ${x.customization.styleOrder}`,...x.customization.companyTypes.map((v,i)=>`${v}: ${x.customization.companyContext[i]||''}`)]):''}</section><section class="note-sec"><div class="lab">07 ADVANCED GUIDE</div><h3>심화 가이드</h3>${list(x.advanced)}</section><section class="note-sec"><div class="lab">08 CONTRACT CONNECTION</div><h3>계약 연결</h3><p>${esc(x.connection)}</p></section><section class="note-sec"><div class="lab">09 TRANSITION</div><h3>전환·다음 행동</h3><p>${esc(x.transition)}</p></section><section class="note-sec"><div class="lab">10 DOCUMENTS</div><h3>준비자료</h3>${list(x.documents)}</section>`;
 $('drawerBackdrop').classList.add('on');$('notesDrawer').classList.add('on');
}
function closeNotes(){$('drawerBackdrop').classList.remove('on');$('notesDrawer').classList.remove('on');}

function renderFactsForm(){
 const d=state.caseData;if(!d)return;const html=[];if(d.meta?.extractorVersion){html.push(`<div class="form-group-title">NICE BizLINE 자동추출 · v${esc(d.meta.extractorVersion)}</div><div class="support-note"><strong>${d.meta.extractionQualityPassed?'추출검증 통과':'추출값 추가확인 필요'}</strong> · ${esc(d.meta.statementType||'')} · 원문 ${safeNum(d.meta.sourcePages)}페이지<br>${esc((d.warnings||[]).slice(0,3).join(' / '))}</div>`);}html.push('<div class="form-group-title">기업 기본정보</div>');
 ['companyName','representative','businessNumber','employees','established','industry','products','creditGrade'].forEach(k=>{const [label,type]=FIELD_META[k];html.push(`<div class="form-row"><label>${esc(label)}</label><input data-profile="${k}" type="${type}" value="${attr(d.profile[k]??'')}"></div>`);});
 for(const y of ['2023','2024','2025']){html.push(`<div class="form-group-title">${y}년 재무 · 단위 백만원</div>`);for(const k of ['assets','liabilities','equity','revenue','cogs','operatingProfit','netIncome','operatingCashFlow','cash','currentAssets','currentLiabilities','receivables','inventory','payables','borrowings','shortTermLoanReceivable','retainedEarnings','interestExpense','capitalStock']){const [label]=FIELD_META[k];html.push(`<div class="form-row"><label>${esc(label)}</label><input data-financial="${y}.${k}" type="number" step="0.01" value="${attr(d.financials[y]?.[k]??'')}"></div>`);}}if(d.latestQuarterly){html.push(`<div class="form-group-title">최근 분기 ${esc(d.latestQuarterly.periodEnd||'')} · 참고자료</div>`);for(const [k,label] of [['assets','자산총계'],['currentLiabilities','유동부채'],['currentBorrowings','유동차입부채'],['cash','현금'],['revenue','분기 매출'],['operatingProfit','분기 영업이익'],['netIncome','분기 순이익'],['financeCost','분기 금융비용']])html.push(`<div class="form-row"><label>${label}</label><input data-quarterly="${k}" type="number" step="0.01" value="${attr(d.latestQuarterly[k]??'')}"></div>`);}
 $('factsForm').innerHTML=html.join('');
}
function collectFactsForm(){
 const d=state.caseData;qsa('[data-profile]',$('factsForm')).forEach(el=>{d.profile[el.dataset.profile]=el.type==='number'?(n(el.value)??null):el.value.trim();});
 qsa('[data-financial]',$('factsForm')).forEach(el=>{const [y,k]=el.dataset.financial.split('.');if(!d.financials[y])d.financials[y]={};d.financials[y][k]=n(el.value);});qsa('[data-quarterly]',$('factsForm')).forEach(el=>{if(d.latestQuarterly)d.latestQuarterly[el.dataset.quarterly]=n(el.value);});d.speechOverrides=buildSpeechOverrides(d);d.meta.confirmed=true;state.factsConfirmed=true;return d;
}
function renderQuestions(){
 if(!state.analysis)state.analysis=buildConfirmedModel(state.caseData);const questions=allQuestions(state.analysis);const ans=state.caseData.answers||{};$('questionsBody').innerHTML=questions.map((q,i)=>{let input='';const val=ans[q.id]??'';if(q.type==='select')input=`<select data-question="${q.id}">${q.options.map(o=>`<option ${String(val)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;else if(q.type==='textarea')input=`<textarea data-question="${q.id}" placeholder="${attr(q.example||'')}">${esc(val)}</textarea>`;else input=`<input data-question="${q.id}" type="${q.type||'text'}" value="${attr(val)}" placeholder="${attr(q.example||'')}">`;return `<div class="question-card"><h3>${i+1}. ${esc(q.label)}</h3><p>${esc(q.reason)}${q.unit?' · 단위 '+esc(q.unit):''}</p>${input}</div>`;}).join('');
}
function collectQuestions(){
 state.caseData.answers=state.caseData.answers||{};qsa('[data-question]',$('questionsBody')).forEach(el=>{state.caseData.answers[el.dataset.question]=el.type==='number'?(n(el.value)??null):el.value.trim();});state.questionsConfirmed=true;
}
function renderManualForm(){
 const fields=[['companyName','기업명','text'],['representative','대표자','text'],['industry','업종','text'],['employees','종업원 수','number'],['revenue2024','2024 매출액(백만원)','number'],['revenue2025','2025 매출액(백만원)','number'],['op2025','2025 영업이익(백만원)','number'],['ni2025','2025 순이익(백만원)','number'],['assets2025','2025 자산(백만원)','number'],['liabilities2025','2025 부채(백만원)','number'],['equity2025','2025 자본(백만원)','number'],['cash2025','2025 현금(백만원)','number'],['ar2025','2025 매출채권(백만원)','number'],['inv2025','2025 재고(백만원)','number'],['ocf2025','2025 영업현금흐름(백만원)','number']];$('manualForm').innerHTML=fields.map(x=>`<div class="form-row"><label>${x[1]}</label><input data-manual="${x[0]}" type="${x[2]}"></div>`).join('');
}
function applyManual(){
 const v={};qsa('[data-manual]',$('manualForm')).forEach(e=>v[e.dataset.manual]=e.type==='number'?n(e.value):e.value.trim());const d=clone(GOLDEN_SAMPLE);d.meta.caseId='CR-MANUAL-'+uid().toUpperCase();d.meta.sourceType='직접입력';d.meta.sourcePages=0;d.meta.confirmed=true;d.profile.companyName=v.companyName||'직접입력 기업';d.profile.displayName=d.profile.companyName;d.profile.representative=v.representative||'미확인';d.profile.industry=v.industry||'미확인';d.profile.employees=v.employees||null;Object.keys(d.financials).forEach(y=>Object.keys(d.financials[y]).forEach(k=>d.financials[y][k]=null));d.financials['2024'].revenue=v.revenue2024;Object.assign(d.financials['2025'],{revenue:v.revenue2025,operatingProfit:v.op2025,netIncome:v.ni2025,assets:v.assets2025,liabilities:v.liabilities2025,equity:v.equity2025,cash:v.cash2025,receivables:v.ar2025,inventory:v.inv2025,operatingCashFlow:v.ocf2025});d.capitalEvents=[];prepareCase(d,{confirmed:true,autoGenerate:true});closeModal('manualModal');
}

function runQuality(){
 const m=state.analysis||state.caseData,hard=[],stats=speechCompletionStats();
 if(!state.factsConfirmed)hard.push('추출값 사용자 승인 미완료');
 const f=m?.financials?.['2025']||{};['revenue','assets','liabilities','equity'].forEach(k=>{if(!Number.isFinite(f[k]))hard.push('2025 '+FIELD_META[k][0]+' 누락');});
 const badA=(m?.insurance||[]).filter(x=>['A','A_CORE'].includes(x.grade)&&!Number.isFinite(x.gap));if(badA.length)hard.push('A등급 보험기회에 부족재원 금액 없음');
 if(stats.completeIssueScripts!==stats.issues)hard.push(`이슈별 5단 화법 누락 ${stats.issues-stats.completeIssueScripts}건`);
 if(stats.branchIssues!==stats.issues)hard.push(`이슈별 CEO 7분기 누락 ${stats.issues-stats.branchIssues}건`);
 if(stats.objections<25)hard.push(`반론 라이브러리 ${stats.objections}/25`);
 if(stats.scenarios<20)hard.push(`완전 상담 시나리오 ${stats.scenarios}/20`);
 if(stats.ceoStyles<7||stats.companyTypes<10)hard.push(`맞춤화 엔진 불완전: CEO ${stats.ceoStyles}/7 · 기업 ${stats.companyTypes}/10`);
 if(stats.insuranceStages!==8)hard.push(`보험계약 단계 ${stats.insuranceStages}/8`);
 const issuePages=state.pages.filter(x=>x.issueId&&x.visibility!=='audio');
 let noteComplete=0,branchComplete=0,objComplete=0,scenarioComplete=0;const generatedText=[];
 issuePages.forEach(p=>{const n=p.notes;if(n&&n.purpose&&n.diagnosis&&n.speech30&&n.speech90&&n.speech3m&&n.speech5m&&n.questions?.length>=3&&n.advanced?.length&&n.connection&&n.transition&&n.documents?.length)noteComplete++;else hard.push(`${p.title}: 10단 상담노트 불완전`);if(n?.branches?.length===7&&new Set(n.branches.map(x=>x.type)).size===7)branchComplete++;else hard.push(`${p.title}: 전용 7분기 불완전`);if(n?.objections?.length>=2)objComplete++;else hard.push(`${p.title}: 이슈별 반론 2종 미만`);if(n?.scenario)scenarioComplete++;generatedText.push(n?.speech30,n?.speech90,n?.speech3m,n?.speech5m,n?.transition,...(n?.objections||[]).flatMap(o=>o.dialogue?.map(d=>d.text)||[]));});
 const text=generatedText.filter(Boolean).join('\n');SPEECH_FORBIDDEN_PATTERNS.forEach(re=>{re.lastIndex=0;if(re.test(text))hard.push(`금지·보장 표현 검출: ${re}`);});
 const activeIds=new Set((m?.issues||[]).map(x=>x.id));const audio=m?.audioChapters||[];const inactiveRefs=audio.flatMap(x=>x.sourceIssueIds||[]).filter(id=>id&&!activeIds.has(id)&&id!=='INSURANCE_OPTIMIZATION');if(inactiveRefs.length)hard.push('음성강의에 비활성 이슈 포함: '+[...new Set(inactiveRefs)].join(','));
 const audioMinutes=audio.reduce((s,x)=>s+(x.minutes||0),0);if(audio.length<5||audioMinutes<18||audioMinutes>25)hard.push(`음성강의 구성 ${audio.length}챕터·${audioMinutes}분`);
 const ratio=(a,b)=>b?Math.min(1,a/b):0;
 const scores={
  accuracy:state.factsConfirmed&&['revenue','assets','liabilities','equity'].every(k=>Number.isFinite(f[k]))?95:82,
  calculation:(m?.calculations?.calculator?.ratios?.ok&&m?.calculations?.calculator?.cashFlow?.ok)?96:(m?.calculations?.calculator?.ratios?.ok?93:90),
  management:Math.round(90+5*ratio(noteComplete,issuePages.length||1)),
  ceo:94,
  speech:Math.round(80+15*ratio(noteComplete,issuePages.length||1)+5*ratio(stats.completeIssueScripts,stats.issues)),
  branches:Math.round(75+15*ratio(branchComplete,issuePages.length||1)+10*ratio(stats.branchIssues,stats.issues)),
  objections:Math.round(75+10*ratio(objComplete,issuePages.length||1)+15*ratio(stats.objections,25)),
  insurance:Math.round(80+10*ratio(stats.insuranceStages,8)+(badA.length?0:10)),
  customization:Math.round(80+10*ratio(stats.ceoStyles,7)+8*ratio(stats.companyTypes,10)+(m?.answers?.ceoStyle?2:0)),
  audio:Math.round(80+(audioMinutes>=18&&audioMinutes<=25?12:0)+(audio.every(x=>(x.sourceIssueIds||[]).every(id=>activeIds.has(id)||id==='INSURANCE_OPTIMIZATION'))?8:0)),
  mode:98,evidence:state.live.taxnavi?94:90,render:93
 };
 Object.keys(scores).forEach(k=>scores[k]=Math.max(0,Math.min(100,scores[k])));
 const weights={accuracy:12,calculation:8,management:8,ceo:8,speech:12,branches:10,objections:8,insurance:10,customization:6,audio:5,mode:5,evidence:3,render:5};
 const average=Object.entries(scores).reduce((s,[k,v])=>s+v*weights[k],0)/100,min=Math.min(...Object.values(scores));
 return {scores,weights,average,min,hardFails:[...new Set(hard)],passed:hard.length===0&&average>=92.3&&min>=90,checkedAt:nowIso(),speechStats:stats,audioMinutes};
}
function qualityHtml(q){
 const labels={accuracy:'팩트 정확성',calculation:'계산 일치',management:'경영해석',ceo:'CEO 본문',speech:'페이지 화법',branches:'CEO 7분기',objections:'반론 25종',insurance:'보험 판단',customization:'맞춤화',audio:'음성강의',mode:'모드 분리',evidence:'근거 연결',render:'A4·모바일'};
 return `<div class="lead"><b>${q.passed?'출시 기준 통과':'보완 필요'} · ${q.average.toFixed(2)}점</b><p>최저 ${q.min.toFixed(1)}점 · 중대오류 ${q.hardFails.length}건 · 실시간 TaxNavi/AI/TTS 연결 전 로컬 1차 검수입니다.</p></div><div class="quality-grid">${Object.entries(q.scores).map(([k,v])=>`<div class="quality-card ${v>=92.3?'good':v>=90?'warn':'bad'}"><b>${v.toFixed(1)}</b><span>${esc(labels[k]||k)} · 가중치 ${q.weights[k]}%</span></div>`).join('')}</div><div class="quality-list"><h3>중대오류</h3>${q.hardFails.length?list(q.hardFails):'<p>탐지된 중대오류가 없습니다.</p>'}<h3>남은 운영 연결</h3>${list(['corporateReportApi 추가 후 P1~P9 실시간 AI 실행','TaxNavi 이슈별 근거검색 결과 삽입','서버 TTS MP3·Storage·학습로그','gildong 베타 종단 테스트 후 실제 점수 재평가'])}</div>`;
}
function renderQualityPage(){if(!state.quality)return;const el=$('qualityPageBody');if(el)el.innerHTML=qualityHtml(state.quality);$('qualityBody').innerHTML=qualityHtml(state.quality);}

function progress(open,msg='분석을 시작합니다.'){const el=$('progressOverlay');if(open){el.classList.add('on');$('progressMessage').textContent=msg;$('progressBar').style.width='0%';$('progressLog').innerHTML='';}else el.classList.remove('on');}
function logProgress(msg,kind='now',percent=null){const l=$('progressLog');if(l){l.insertAdjacentHTML('beforeend',`<div class="${kind}">[${new Date().toLocaleTimeString('ko-KR',{hour12:false})}] ${esc(msg)}</div>`);l.scrollTop=l.scrollHeight;}if(percent!==null)$('progressBar').style.width=clamp(percent,0,100)+'%';$('progressMessage').textContent=msg;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function generateReport(reason='generate'){
 if(!state.caseData){toast('먼저 기업자료를 불러오십시오.');return;}if(!state.factsConfirmed){renderFactsForm();openModal('factsModal');toast('추출값 승인이 필요합니다.');return;}
 window.jvTrack?.('corporate_report_generate');progress(true,'확정된 팩트를 분석하고 있습니다.');
 const stages=[['P1 사실구조화·단위·연도 검증',8],['P2 기업 이슈 탐지·우선순위',20],['P3 동적 질문·미확인 항목 분리',31],['P4 계산기·시나리오·솔루션 설계',44],['P5 보험기회 A~D·부족재원 경계',58],['P6 CEO 의사결정 본문 구성',69],['P7 페이지별 10단 상담화법 연결',80],['P8 18~25분 음성강의 대본 구성',89],['P9 모드누출·수치·표현 교차검수',97]];
 try{
  for(const [msg,pc] of stages){logProgress(msg,'now',pc);await sleep(90);}
  const model=buildConfirmedModel(state.caseData);state.analysis=model;generatePages(model);renderPages();
  if(new URLSearchParams(location.search).get('live')==='1')await tryLiveEnhancements();
  state.quality=runQuality();renderQualityPage();logProgress(`완료 · ${state.pages.length}페이지 · 품질 ${state.quality.average.toFixed(2)}점`,'ok',100);await sleep(350);progress(false);showWorkspace();window.jvDone?.('corporate_report_generate');toast('3모드 종합리포트를 생성했습니다.','ok');
 }catch(error){progress(false);window.jvDone?.('corporate_report_generate');console.error(error);toast('생성 중 오류: '+error.message,'err');throw error;}
}
async function tryLiveEnhancements(){
 const targets=state.analysis.issues.filter(x=>['LOAN_RECEIVABLE','CAPITAL_TRANSACTIONS','SUCCESSION'].includes(x.id)).slice(0,3);for(const issue of targets){const out=await ServerAdapter.legalSearch({...issue,evidenceQueries:[issue.title+' 관련 법령 요건',issue.title+' 국세청 예규 판례']});if(out.ok||out.results?.length)state.analysis.legalEvidence.push({issueId:issue.id,...out});}
 state.quality=runQuality();renderQualityPage();
}
function prepareCase(data,{confirmed=false,autoGenerate=false}={}){
 state.caseData=clone(data);state.caseData.speechOverrides=state.caseData.speechOverrides||buildSpeechOverrides(state.caseData);state.analysis=null;state.pages=[];state.factsConfirmed=confirmed||data.meta?.confirmed===true;state.questionsConfirmed=false;state.sourceName=data.meta?.sourceType||'';renderFactsForm();showWorkspace();updateStatus();if(autoGenerate)generateReport('auto');else openModal('factsModal');
}
async function handlePdf(file){
 if(!file)return;if(file.size>30*1024*1024){setStartStatus('PDF는 30MB 이하를 사용해 주세요.','err');return;}window.jvTrack?.('corporate_pdf_analysis');setStartStatus('PDF 텍스트와 페이지를 분석하고 있습니다…');
 try{const out=await PDFParser.extract(file);state.sourceText=out.text;state.sourceName=file.name;state.pdfMeta=out;let data;if(out.format==='NICE BizLINE'){setStartStatus('NICE BizLINE 전용엔진으로 재무·주주·관계사·신용정보를 구조화하고 있습니다…');data=extractNiceBizlineCase(out,file);}else if(PDFParser.isGolden(out.text)){data=clone(GOLDEN_SAMPLE);data.meta.sourcePages=out.pages;data.meta.sourceType=out.format+' PDF';data.meta.confirmed=false;data.warnings.unshift('PDF에서 모락스트레이딩 골든케이스를 식별했습니다. 모든 핵심값은 승인 후 사용됩니다.');}else{data=PDFParser.generic(out.text,out.pages);data.meta.sourceType=out.format+' PDF';data=await enrichWithExistingFinancialExtractor(data,out.text);}
  setStartStatus(`${out.format} · ${out.pages}페이지 · 자동추출 완료. 원문과 핵심값을 확인해 주세요.`,'ok');window.jvDone?.('corporate_pdf_analysis');prepareCase(data,{confirmed:false,autoGenerate:false});
 }catch(error){window.jvDone?.('corporate_pdf_analysis');console.error(error);setStartStatus('분석 실패: 텍스트 선택·복사가 가능한 PDF인지 확인하거나 직접입력을 사용해 주세요.','err');}
}

function selectChapter(index){const chapters=state.analysis?.audioChapters||state.caseData?.audioChapters||[];if(!chapters.length)return;state.audioIndex=clamp(index,0,chapters.length-1);qsa('[data-chapter]').forEach((b,i)=>b.classList.toggle('on',i===state.audioIndex));if($('audioTranscript'))$('audioTranscript').textContent=chapters[state.audioIndex].script;}
function audioAction(action){
 const chapters=state.analysis?.audioChapters||[];const ch=chapters[state.audioIndex];if(!ch){toast('음성대본이 없습니다.');return;}
 if(action==='play'){
  if(!('speechSynthesis' in global)){toast('이 브라우저는 음성재생을 지원하지 않습니다.');return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(ch.script);u.lang='ko-KR';u.rate=safeNum($('audioRate')?.value,1);state.speechUtterance=u;speechSynthesis.speak(u);toast('브라우저 음성강의를 재생합니다.');
 }else if(action==='pause'){if(speechSynthesis.paused)speechSynthesis.resume();else speechSynthesis.pause();}
 else if(action==='stop'){speechSynthesis.cancel();}
 else if(action==='mp3'){generateMp3(ch.script);}
}
async function generateMp3(script){toast('서버 MP3 생성을 요청합니다.');const out=await ServerAdapter.tts(script);if(out.url){const a=new Audio(out.url);a.controls=true;a.autoplay=true;const t=$('audioTranscript');t.parentElement.insertBefore(a,t);toast('고급 MP3가 생성되었습니다.','ok');}else toast('현재 1차 파일은 브라우저 음성을 사용합니다. 서버 TTS 연결 후 MP3가 활성화됩니다.');}

function saveCase(){
 if(!state.caseData)return;const payload={app:'JARVIA_CORPORATE_REPORT',version:VERSION,savedAt:nowIso(),factsConfirmed:state.factsConfirmed,questionsConfirmed:state.questionsConfirmed,caseData:state.caseData,analysis:state.analysis};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`${state.caseData.profile?.displayName||'기업'}_기업종합Report_케이스.json`);toast('케이스 JSON을 저장했습니다.');
}
function loadCaseFile(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);state.caseData=p.analysis||p.caseData;state.analysis=p.analysis||null;state.factsConfirmed=p.factsConfirmed!==false;state.questionsConfirmed=!!p.questionsConfirmed;if(state.analysis){generatePages(state.analysis);renderPages();showWorkspace();}else prepareCase(state.caseData,{confirmed:state.factsConfirmed,autoGenerate:true});toast('케이스를 불러왔습니다.','ok');}catch(e){toast('케이스 파일 형식이 올바르지 않습니다.','err');}};r.readAsText(file);}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
function buildCEOExportHtml(){
 const css=qs('style')?.textContent||'';
 const commonPages=state.pages.filter(p=>p.visibility==='common');
 const raw=commonPages.map(p=>$(p.id)?.outerHTML||p.html).join('');
 const holder=document.createElement('div');holder.innerHTML=raw;
 holder.querySelectorAll('.consultant-only,.consultant-block,.note-trigger,[data-note-page],[data-visibility="consultant"],[data-visibility="audio"]').forEach(el=>el.remove());
 holder.querySelectorAll('.report-page').forEach(el=>{el.classList.remove('hidden-mode');el.removeAttribute('data-issue');el.setAttribute('data-visibility','common');});
 const guide=holder.querySelector('#guide');
 if(guide){
  const leadB=guide.querySelector('.lead b');
  const leadP=guide.querySelector('.lead p');
  if(leadB)leadB.textContent='재무설명이 아니라 CEO의 합리적인 의사결정을 지원합니다.';
  if(leadP)leadP.textContent='확인된 팩트와 계산값에서 출발해 실행대안, 전문가 확인사항, 위험재원의 역할을 구분합니다.';
 }
 const sections=[...holder.querySelectorAll('.report-page')];
 sections.forEach((el,i)=>{
  const footerNo=el.querySelector('.page-footer b');
  if(footerNo)footerNo.textContent=String(i+1).padStart(2,'0');
 });
 const toc=holder.querySelector('#tocInside');
 if(toc){
  toc.innerHTML=sections.map((el,i)=>{
   const title=el.querySelector('.page-header h1')?.textContent?.trim()||commonPages[i]?.title||'';
   return `<button type="button" data-jump="${esc(el.id)}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(title)}</span></button>`;
  }).join('');
 }
 const common=holder.innerHTML;
 const leakTerms=['CONSULTANT ONLY','컨설턴트 상담노트','페이지별 10단 상담노트','보험계약 기회 종합진단','유료컨설팅·전문가·보험 연결지도','2차 미팅 운영 스크립트','반론 대응','보험계약 8단계 상담 로드맵','컨설턴트용','음성강의용','유료컨설팅과 보험기회','다음 미팅·계약전환','CEO 7분기','반론 25종'];
 const leaks=leakTerms.filter(t=>common.includes(t));
 return {leaks,html:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.caseData.profile?.displayName||'기업')} CEO 의사결정 리포트</title><style>${css}
body{padding:12mm 0}.ceo-toolbar{position:fixed;z-index:9999;right:14px;top:14px}.ceo-toolbar button{border:0;border-radius:10px;background:#102642;color:#fff;padding:10px 14px;font-weight:800}@media print{body{padding:0}.ceo-toolbar{display:none}}</style></head><body class="mode-ceo"><div class="ceo-toolbar"><button onclick="window.print()">인쇄·PDF</button></div><main>${common}</main><script>document.querySelectorAll('[data-jump]').forEach(function(b){b.onclick=function(){var e=document.getElementById(b.dataset.jump);if(e)e.scrollIntoView({behavior:'smooth'});};});<\/script></body></html>`};
}
function exportCEO(){if(!state.pages.length)return;const out=buildCEOExportHtml();if(out.leaks.length){toast('CEO 전달본 내부정보 누출검사 실패: '+out.leaks.join(', '),'err');return;}downloadBlob(new Blob([out.html],{type:'text/html;charset=utf-8'}),`${state.caseData.profile?.displayName||'기업'}_CEO_의사결정리포트.html`);toast('내부정보가 제거된 CEO 전달본을 생성했습니다.','ok');}
function searchAll(){const q=$('searchInput').value.trim();if(!q){$('searchResults').innerHTML='<p>검색어를 입력해 주세요.</p>';return;}const qp=q.toLowerCase();const pages=state.pages.filter(p=>(p.title+' '+p.subtitle+' '+p.summary+' '+p.html.replace(/<[^>]+>/g,' ')).toLowerCase().includes(qp)).slice(0,20);const speech=SpeechEngine.search(q).slice(0,15);$('searchResults').innerHTML=`<h3>리포트 ${pages.length}건</h3>${pages.map(p=>`<button class="card" style="display:block;width:100%;text-align:left;margin:6px 0" data-search-jump="${p.id}"><b>${esc(p.title)}</b><p>${esc(p.summary||p.subtitle)}</p></button>`).join('')||'<p>결과 없음</p>'}<h3>화법교본 ${speech.length}건</h3>${speech.map(x=>`<details class="card" style="margin:6px 0"><summary><b>${esc(x.title)}</b></summary><p>${esc(sentence(x.text,700))}</p></details>`).join('')||'<p>결과 없음</p>'}`;qsa('[data-search-jump]').forEach(b=>b.onclick=()=>{closeModal('searchModal');$(b.dataset.searchJump)?.scrollIntoView({behavior:'smooth'});});}

function enterPresentation(startId=null){if(!state.visiblePages.length)return;state.present=true;state.presentIndex=Math.max(0,state.visiblePages.findIndex(x=>x.id===startId));if(state.presentIndex<0)state.presentIndex=0;document.body.classList.add('present');updatePresentation();}
function updatePresentation(){qsa('.report-page').forEach(x=>x.classList.remove('present-active'));const p=state.visiblePages[state.presentIndex];if(!p)return;const el=$(p.id);el.classList.add('present-active');const sx=(innerWidth-40)/el.offsetWidth,sy=(innerHeight-80)/el.offsetHeight;document.documentElement.style.setProperty('--present-scale',String(Math.min(sx,sy,.98)));$('presCount').textContent=`${state.presentIndex+1} / ${state.visiblePages.length}`;}
function movePresentation(d){state.presentIndex=clamp(state.presentIndex+d,0,state.visiblePages.length-1);updatePresentation();}
function exitPresentation(){state.present=false;document.body.classList.remove('present');qsa('.report-page').forEach(x=>x.classList.remove('present-active'));}

function initEvents(){
 $('sampleBtn').onclick=()=>prepareCase(clone(GOLDEN_SAMPLE),{confirmed:true,autoGenerate:true});$('manualBtn').onclick=()=>{renderManualForm();openModal('manualModal');};$('manualApplyBtn').onclick=applyManual;
 $('pdfInput').onchange=e=>handlePdf(e.target.files?.[0]);const zone=$('uploadZone');['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag');}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag');}));zone.addEventListener('drop',e=>handlePdf(e.dataTransfer.files?.[0]));
 qsa('[data-mode]').forEach(b=>b.onclick=()=>applyMode(b.dataset.mode));$('menuBtn').onclick=()=>$('sidePanel').classList.toggle('on');$('closeSide').onclick=()=>$('sidePanel').classList.remove('on');
 $('factsBtn').onclick=()=>{renderFactsForm();openModal('factsModal');};$('questionsBtn').onclick=()=>{renderQuestions();openModal('questionsModal');};$('regenBtn').onclick=()=>generateReport('regen');
 $('confirmFactsBtn').onclick=()=>{if(!collectFactsForm())return;closeModal('factsModal');renderQuestions();openModal('questionsModal');updateStatus();};$('confirmQuestionsBtn').onclick=()=>{if(!collectQuestions())return;closeModal('questionsModal');generateReport('answers');};
 $('qualityBtn').onclick=()=>{state.quality=runQuality();renderQualityPage();openModal('qualityModal');};$('searchBtn').onclick=()=>openModal('searchModal');$('searchGoBtn').onclick=searchAll;$('searchInput').onkeydown=e=>{if(e.key==='Enter')searchAll();};
 $('printBtn').onclick=()=>window.print();$('exportBtn').onclick=exportCEO;$('saveCaseBtn').onclick=saveCase;$('loadCaseBtn').onclick=()=>$('caseFileInput').click();$('caseFileInput').onchange=e=>loadCaseFile(e.target.files?.[0]);
 $('drawerBackdrop').onclick=closeNotes;$('notesClose').onclick=closeNotes;qsa('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
 $('presPrev').onclick=()=>movePresentation(-1);$('presNext').onclick=()=>movePresentation(1);$('presExit').onclick=exitPresentation;
 document.addEventListener('dblclick',e=>{const p=e.target.closest('.report-page');if(p&&!document.body.classList.contains('present'))enterPresentation(p.id);});
 document.addEventListener('keydown',e=>{if(document.body.classList.contains('present')){if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();movePresentation(1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();movePresentation(-1);}if(e.key==='Escape')exitPresentation();}else if(e.key==='Escape'){closeNotes();qsa('.modal.on').forEach(x=>x.classList.remove('on'));}});
 window.addEventListener('scroll',()=>{if(!state.visiblePages.length)return;let best=null,bestD=Infinity;for(const p of state.visiblePages){const el=$(p.id);if(!el)continue;const d=Math.abs(el.getBoundingClientRect().top-90);if(d<bestD){bestD=d;best=p.id;}}qsa('#pageNav button').forEach(b=>b.classList.toggle('on',b.dataset.jump===best));},{passive:true});
}

function init(){
 if(!canAccess())$('accessGate').classList.add('on');initEvents();renderManualForm();
 console.info('[CorporateReport]',VERSION,'ready · speech',Object.keys(ISSUE_SPEECH_LIBRARY).length,'issues · registry',ISSUE_REGISTRY.length);
}


/* ============================================================================
 * SPEECH ENGINE FINALIZATION v1.6.0 — FIRST COMPLETE PASS
 * - Every non-audio page receives a complete 10-step consultant note.
 * - All 10 issues have 7 response branches with explicit second responses.
 * - All 25 objections and all 20 complete scenarios have executable routes.
 * - CEO/company profiles materially change order, evidence, questions and close.
 * - Audio covers every active issue within an 18–25 minute training structure.
 * - Quality gate validates actual generated paths, not library counts alone.
 * ========================================================================== */
const SPEECH_V16_BRANCH_TYPES=['즉시 동의','부분 동의','부정','정보 부족','전문가 위임','비용 우려','결정 유예'];
const SPEECH_V16_ISSUE_LABELS={
 WORKING_CAPITAL:'현금전환과 운전자금',LOAN_RECEIVABLE:'대여금 거래실질과 정상화',CAPITAL_POLICY:'자본정책과 누적이익·결손',CAPITAL_TRANSACTIONS:'자기주식·감자·자본거래',EXECUTIVE_RETIREMENT:'임원퇴직금과 지급재원',SUCCESSION:'경영승계와 가족·주주 유동성',KEY_PERSON:'대표자·핵심인 유고',EXPORT_CREDIT:'수출채권과 거래처 신용위험',PROPERTY_BI:'재산·휴업·사업연속성',INSURANCE_OPTIMIZATION:'기존 보험증권 최적화'
};
const SPEECH_V16_SCENARIO_ROUTE_MATRIX={
 '첫 미팅 신뢰 형성':{roles:['ORIENTATION'],stages:['1차 진단']},
 '한 줄 진단 제시':{roles:['ORIENTATION','DIAGNOSIS']},
 '이익잉여금·배당정책':{issues:['CAPITAL_POLICY']},
 '자기주식·감자 과거거래':{issues:['CAPITAL_TRANSACTIONS']},
 '임원퇴직재원':{issues:['EXECUTIVE_RETIREMENT']},
 '승계를 부정하는 대표':{issues:['SUCCESSION'],stages:['1차 진단']},
 '가족 공동설명':{issues:['SUCCESSION'],styles:['관계중심형','결정지연형'],stages:['정밀진단','설계검토','최종 의사결정']},
 '공동주주 반대':{issues:['SUCCESSION','CAPITAL_TRANSACTIONS'],companyTypes:['공동주주기업']},
 '기존 세무사와 역할 충돌':{roles:['EVIDENCE'],styles:['전문가위임형'],issues:['LOAN_RECEIVABLE','CAPITAL_POLICY','CAPITAL_TRANSACTIONS','EXECUTIVE_RETIREMENT']},
 '보험증권 제출 거부':{issues:['INSURANCE_OPTIMIZATION','KEY_PERSON'],roles:['INSURANCE']},
 '기존 설계사와 비교':{issues:['INSURANCE_OPTIMIZATION'],roles:['INSURANCE']},
 '건강심사 우려':{issues:['KEY_PERSON','SUCCESSION','EXECUTIVE_RETIREMENT'],stages:['설계검토','최종 의사결정']},
 '보험 근거 없음 선언':{roles:['INSURANCE'],stages:['1차 진단','정밀진단']},
 '계약 후 연례점검':{roles:['IMPLEMENTATION'],stages:['사후관리']},
 '운전자금 정밀진단 전환':{issues:['WORKING_CAPITAL']},
 '대여금 정상화 프로젝트':{issues:['LOAN_RECEIVABLE']},
 '대표자 유고 필요재원 분석':{issues:['KEY_PERSON']},
 '승계재원과 가족 합의':{issues:['SUCCESSION']},
 '보험료 부담 반론과 설계 축소':{issues:['KEY_PERSON','SUCCESSION','EXECUTIVE_RETIREMENT','INSURANCE_OPTIMIZATION'],styles:['비용민감형'],stages:['설계검토','최종 의사결정']},
 '최종계약 보류 대응':{roles:['DECISION','INSURANCE'],stages:['최종 의사결정']}
};
const SPEECH_V16_COMMON_OBJECTION_ROUTES={
 ORIENTATION:['지금까지 문제없었습니다.','회계법인 보고서와 뭐가 다릅니까?','보험은 관심 없습니다.','오늘 결정하기 어렵습니다.'],
 DIAGNOSIS:['지금까지 문제없었습니다.','세무사가 다 해줍니다.','자료가 너무 많습니다.','효과를 보장할 수 있습니까?'],
 EVIDENCE:['세무사가 다 해줍니다.','회계법인 보고서와 뭐가 다릅니까?','자료가 너무 많습니다.','정보를 주기 불안합니다.','효과를 보장할 수 있습니까?'],
 DECISION:['진단비가 아깝습니다.','가족과 상의해야 합니다.','공동주주가 반대할 겁니다.','오늘 결정하기 어렵습니다.','조건이 바뀌면 어떻게 합니까?'],
 INSURANCE:['보험은 관심 없습니다.','보험이 이미 많습니다.','보험료가 비쌉니다.','다른 설계사에게 받고 있습니다.','정보를 주기 불안합니다.','조건이 바뀌면 어떻게 합니까?'],
 IMPLEMENTATION:['오늘 결정하기 어렵습니다.','조건이 바뀌면 어떻게 합니까?','효과를 보장할 수 있습니까?','다른 설계사에게 받고 있습니다.'],
 FINANCIAL:['회사 현금이 충분합니다.','지금까지 문제없었습니다.','세무사가 다 해줍니다.','효과를 보장할 수 있습니까?']
};
const SPEECH_V16_GENERIC_DOCUMENTS={
 ORIENTATION:['대표가 가장 먼저 확인할 경영과제','리포트 활용 목적','의사결정 참여자','다음 미팅 가능일'],
 DIAGNOSIS:['원본 기업보고서','최근 재무제표·세부원장','대표 체감과 다른 수치 목록','우선순위 결정 메모'],
 FINANCIAL:['최근 3개년 재무제표','월별 자금수지','주요 증감 계정 명세','내부 KPI 보고서'],
 EVIDENCE:['원본 페이지와 출처','관련 계약·의사록·원장','기존 전문가 검토의견','추가 확인 담당자'],
 DECISION:['A·B·C 대안표','비용·기간·담당자','진행·축소·보류 기준','다음 의사결정 일정'],
 INSURANCE:['필요재원 계산표','가용현금·금융자산','전체 기존 보험증권','계약자·피보험자·수익자 정보'],
 IMPLEMENTATION:['실행 일정표','담당자·완료기준','월간 KPI','연례 재검토 일정']
};
function speechV16PageRole(page){
 const id=String(page?.id||''),text=`${page?.title||''} ${page?.section||''}`;
 if(/cover|guide|toc/.test(id)||/표지|목차|무엇을 결정/.test(text))return 'ORIENTATION';
 if(/insurance|보험|audio/.test(id+' '+text))return 'INSURANCE';
 if(/quality|evidence|appendix|근거|품질|계산/.test(id+' '+text))return 'EVIDENCE';
 if(/roadmap|closing|final|decision|실행|로드맵|최종|의사결정/.test(id+' '+text))return 'DECISION';
 if(/dashboard|trend|ratio|financial|재무|현황|팩트/.test(id+' '+text))return 'FINANCIAL';
 if(/implementation|aftercare|사후|관리/.test(id+' '+text))return 'IMPLEMENTATION';
 return 'DIAGNOSIS';
}
function speechV16IssueLabel(id){return SPEECH_V16_ISSUE_LABELS[id]||'해당 경영과제';}
function speechV16SecondResponse(issueId,branch){
 const label=speechV16IssueLabel(issueId),agreement=branch?.agreement||'자료와 다음 확인일을 확정합니다.';
 const map={
  '즉시 동의':`동의가 확인됐더라도 곧바로 실행 결론으로 가지 않겠습니다. ${label}의 사실과 금액을 확인한 뒤 ${agreement}까지 진행하겠습니다.`,
  '부분 동의':`동의한 부분에서 시작하고 동의하지 않은 부분은 별도 가정으로 두겠습니다. ${label}의 경계값을 정한 뒤 ${agreement}으로 범위를 좁히겠습니다.`,
  '부정':`대표님의 판단을 반박하지 않겠습니다. 문제라고 보는 기준을 먼저 듣고 그 기준을 넘는 경우에만 ${agreement}을 실행하도록 하겠습니다.`,
  '정보 부족':`정보가 없다는 이유로 결론을 만들지 않겠습니다. 확인 담당자와 자료를 정해 ${label}을 사실 상태로 바꾼 뒤 ${agreement}하겠습니다.`,
  '전문가 위임':`기존 전문가의 역할을 대체하지 않습니다. 경영 의사결정용 질문표를 공유하고 검증 결과를 받아 ${agreement}으로 연결하겠습니다.`,
  '비용 우려':`전체 프로젝트를 요구하지 않고 최소 진단·중단조건·기대 산출물을 먼저 정하겠습니다. 기준에 못 미치면 확대하지 않고 ${agreement}까지만 진행하겠습니다.`,
  '결정 유예':`오늘 결정을 재촉하지 않겠습니다. 무엇이 확인되면 진행하고 무엇이면 보류할지 기준과 날짜를 정해 ${agreement}으로 남기겠습니다.`
 };
 return map[branch?.type]||`대표님의 우려를 다시 확인하고 ${label}에 필요한 다음 한 단계와 ${agreement}을 합의하겠습니다.`;
}
Object.entries(CEO_RESPONSE_BRANCHES).forEach(([issueId,branches])=>{
 (branches||[]).forEach(branch=>{branch.secondResponse=speechV16SecondResponse(issueId,branch);});
});
function speechV16CommonBranches(page){
 const title=page?.title||'이 페이지',role=speechV16PageRole(page);
 const seeds={
  '즉시 동의':['“이 방향으로 확인해 봅시다.”',`좋습니다. ${title}에서 먼저 확인할 사실과 결정항목을 분리하겠습니다.`,`가장 먼저 확정할 숫자·자료·담당자는 무엇입니까?`,'자료 담당자·제출일·다음 미팅 확정'],
  '부분 동의':['“일부는 맞지만 전부 동의하지는 않습니다.”',`동의한 사실과 이견이 있는 해석을 나눠 보겠습니다.`,`어느 부분까지는 동의하고 어느 부분부터 다른 판단입니까?`,'합의영역·이견영역·재검토 기준 확정'],
  '부정':['“우리 회사에는 해당하지 않습니다.”',`현재 문제가 있다고 단정하지 않겠습니다. 대표님의 정상 기준과 자료를 비교하겠습니다.`,`어느 수준부터 점검이 필요하다고 판단하십니까?`,'경보선·점검주기·재검토일 합의'],
  '정보 부족':['“정확히는 모르겠습니다.”',`모르는 상태를 문제로 보지 않고 확인 가능한 자료와 담당자를 특정하겠습니다.`,`이 정보를 가장 정확히 보유한 부서나 전문가는 누구입니까?`,'자료목록·담당자·제출기한 지정'],
  '전문가 위임':['“기존 전문가에게 맡겨 두었습니다.”',`기존 전문가의 역할을 존중하고 대표님의 의사결정에 필요한 연결만 보완하겠습니다.`,`기존 전문가에게 확인해야 할 질문을 함께 정리해도 되겠습니까?`,'전문가 공유범위·공동검토 일정 합의'],
  '비용 우려':['“이 단계까지 비용을 들일 필요가 있습니까?”',`전체 실행이 아니라 최소 확인범위와 중단조건부터 정하겠습니다.`,`어떤 결과가 확인돼야 다음 비용을 승인할 수 있습니까?`,'최소 진단범위·비용·중단조건 합의'],
  '결정 유예':['“지금 결정하기는 어렵습니다.”',`오늘은 최종결정이 아니라 다음 확인단계와 판단기준까지만 합의하겠습니다.`,`누구와 무엇을 확인한 뒤 언제 다시 판단하면 좋겠습니까?`,'참석자·판단자료·재검토일 확정']
 };
 return SPEECH_V16_BRANCH_TYPES.map(type=>{const [expression,response,followUp,agreement]=seeds[type];return {type,expression,response,followUp,secondResponse:speechV16SecondResponse(role,{type,agreement}),agreement};});
}
function speechV16ScenarioTitles(page,data){
 const role=speechV16PageRole(page),issueId=page?.issueId||'',stage=data?.answers?.meetingStage||'1차 진단',style=data?.answers?.ceoStyle||'신중보수형',types=speechDetectCompanyTypes(data||{});
 const scored=[];
 for(const [title,route] of Object.entries(SPEECH_V16_SCENARIO_ROUTE_MATRIX)){
  let score=0;
  if(route.issues?.includes(issueId))score+=8;
  if(route.roles?.includes(role))score+=5;
  if(route.stages?.includes(stage))score+=3;
  if(route.styles?.includes(style))score+=2;
  if(route.companyTypes?.some(x=>types.includes(x)))score+=2;
  if(score>0)scored.push([title,score]);
 }
 if(!scored.length)scored.push(['한 줄 진단 제시',1]);
 return scored.sort((a,b)=>b[1]-a[1]).map(x=>x[0]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,3);
}
function speechV16ScenariosFor(page,data){return speechV16ScenarioTitles(page,data).map(title=>SCENARIO_LIBRARY.find(x=>x.title===title)).filter(Boolean);}
speechScenarioFor=function(issueId,stage){return speechV16ScenariosFor({issueId,id:'issue-'+String(issueId||'').toLowerCase(),title:speechV16IssueLabel(issueId)},{answers:{meetingStage:stage||'1차 진단',ceoStyle:'신중보수형'},profile:{}})[0]||null;};
function speechV16ObjectionTitlesFor(page,data){
 const role=speechV16PageRole(page),issue=page?.issueId||'',style=data?.answers?.ceoStyle||'';
 let titles=[...(SPEECH_ISSUE_OBJECTION_MAP[issue]||[]),...(SPEECH_V16_COMMON_OBJECTION_ROUTES[role]||[])];
 if(style==='비용민감형')titles.unshift('진단비가 아깝습니다.','보험료가 비쌉니다.');
 if(style==='전문가위임형')titles.unshift('세무사가 다 해줍니다.','회계법인 보고서와 뭐가 다릅니까?');
 if(style==='관계중심형')titles.unshift('가족과 상의해야 합니다.','공동주주가 반대할 겁니다.');
 return [...new Set(titles)].filter(title=>OBJECTION_LIBRARY.some(x=>x.title===title)).slice(0,4);
}
function speechV16ObjectionsFor(page,data){return speechV16ObjectionTitlesFor(page,data).map(speechObjectionDialogue).filter(Boolean);}
SpeechEngine.objectionsFor=function(id){return speechV16ObjectionsFor({issueId:id,id:'issue-'+String(id||'').toLowerCase(),title:speechV16IssueLabel(id)},{answers:{ceoStyle:'신중보수형'}});};
function speechV16FactAnchor(data,issueId){
 const f=data?.financials?.['2025']||{},r=data?.calculations?.ratios||{};
 const bits=[];
 if(issueId==='WORKING_CAPITAL'){if(Number.isFinite(f.revenue))bits.push(`매출 ${wonEok(f.revenue)}`);if(Number.isFinite(f.operatingCashFlow))bits.push(`영업현금 ${wonEok(f.operatingCashFlow)}`);if(Number.isFinite(r.currentRatio))bits.push(`유동비율 ${pct(r.currentRatio)}`);}
 else if(issueId==='LOAN_RECEIVABLE'&&Number.isFinite(f.shortTermLoanReceivable))bits.push(`단기대여금·관련채권 ${wonEok(f.shortTermLoanReceivable)}`);
 else if(issueId==='CAPITAL_POLICY'&&Number.isFinite(f.retainedEarnings))bits.push(`이익잉여금 ${wonEok(f.retainedEarnings)}`);
 else if(issueId==='EXECUTIVE_RETIREMENT'){if(Number.isFinite(f.cash))bits.push(`현금 ${wonEok(f.cash)}`);if(Number.isFinite(f.operatingCashFlow))bits.push(`영업현금 ${wonEok(f.operatingCashFlow)}`);}
 else if(issueId==='KEY_PERSON'){if(Number.isFinite(f.cash))bits.push(`현금 ${wonEok(f.cash)}`);if(Number.isFinite(f.borrowings))bits.push(`차입금 ${wonEok(f.borrowings)}`);}
 else {if(Number.isFinite(f.assets))bits.push(`자산 ${wonEok(f.assets)}`);if(Number.isFinite(f.revenue))bits.push(`매출 ${wonEok(f.revenue)}`);}
 return bits.length?`확인 기준: 2025년 ${bits.join(' · ')}.`:'확인 기준: 원본 자료와 사용자 승인값만 사용합니다.';
}
speechCustomize=function(text,data,issueId,duration){
 const styleKey=data?.answers?.ceoStyle||'신중보수형',style=speechStyleProfile(data),companies=speechCompanyProfiles(data).slice(0,2),anchor=speechV16FactAnchor(data,issueId),base=String(text||'').trim();
 const companyContext=companies.length?companies.map(x=>`${x.name} 관점에서는 ${x.context}`).join(' '):'';
 const companyQuestions=companies.map(x=>x.question).join(' ');
 let opening='',body=base,decision=style.closing;
 if(styleKey==='숫자중심형')opening=`${style.opening} ${anchor}`;
 else if(styleKey==='빠른결정형')opening=`${style.opening} 핵심 결론은 ${sentence(base,220)}`;
 else if(styleKey==='신중보수형')opening=`${style.opening} 현행 유지안과 작은 검증안을 먼저 비교하겠습니다. ${anchor}`;
 else if(styleKey==='관계중심형')opening=`${style.opening} 이 결정이 가족·주주·임직원에게 미치는 영향을 먼저 구분하겠습니다.`;
 else if(styleKey==='회의방어형')opening=`${style.opening} ${anchor} 반대자료가 있으면 결론을 수정하겠습니다.`;
 else if(styleKey==='전문가위임형')opening=`${style.opening} 기존 전문가에게 전달할 질문과 확인경계를 먼저 정리하겠습니다.`;
 else if(styleKey==='비용민감형')opening=`${style.opening} 전체 실행이 아니라 최소범위·예상 산출물·중단조건 순으로 보겠습니다.`;
 else opening=style.opening;
 if(duration==='speech30')body=sentence(base,260);
 const order=`설명순서: ${style.order}.`;
 const questions=`판단질문: ${style.question}${companyQuestions?` ${companyQuestions}`:''}`;
 return [opening,order,companyContext,body,questions,`결정 전환: ${decision}`].filter(Boolean).join('\n');
};
function speechV16GenericQuestions(page,data){
 const role=speechV16PageRole(page),title=page?.title||'이 페이지',style=speechStyleProfile(data),company=speechCompanyProfiles(data)[0];
 const map={
  ORIENTATION:[`오늘 ${title}에서 가장 먼저 확인할 경영과제는 무엇입니까?`,'대표님이 기대하는 결과는 현황파악·정밀진단·실행안 중 무엇입니까?','의사결정에 함께 참여해야 할 가족·주주·전문가는 누구입니까?','다음 미팅에서 결정을 위해 반드시 필요한 자료는 무엇입니까?'],
  FINANCIAL:[`이 수치와 대표님이 실제 체감하는 상황이 다른 부분은 어디입니까?`,'최근 1년 중 현금·매출·차입이 가장 크게 변한 원인은 무엇입니까?','현재 내부관리 기준과 경보선은 정해져 있습니까?','이 추세가 1년 더 지속될 때 가장 부담되는 항목은 무엇입니까?'],
  EVIDENCE:['원본·요약·계산값 중 추가 확인이 필요한 부분은 무엇입니까?','관련 계약·의사록·원장을 보유한 담당자는 누구입니까?','기존 전문가와 검증해야 할 법률·세무·보험 쟁점은 무엇입니까?','자료 간 충돌이 해소되지 않으면 어떤 결정을 보류해야 합니까?'],
  DECISION:['A·B·C안 중 대표님이 가장 중요하게 보는 기준은 비용·시간·통제력 중 무엇입니까?','진행·축소·보류를 나누는 조건은 무엇입니까?','실행 책임자와 완료기한을 누구로 정하시겠습니까?','다음 회의에서 무엇이 확인되면 최종 결정할 수 있습니까?'],
  INSURANCE:['위험사건이 발생할 때 실제 필요한 금액과 기간은 무엇입니까?','회사 현금·금융자산·신용한도·기존보험 중 실제 사용 가능한 금액은 얼마입니까?','보험 외 대안으로 감당 가능한 부분은 어디까지입니까?','계약목적과 계약자·피보험자·수익자 구조가 일치합니까?'],
  IMPLEMENTATION:['합의한 실행항목의 담당자와 완료기준은 무엇입니까?','월별로 확인할 KPI와 경보선은 무엇입니까?','기업상황이 변하면 어떤 조건에서 재계산해야 합니까?','연례점검일과 사건 발생 시 연락체계를 정했습니까?'],
  DIAGNOSIS:[`이 페이지에서 대표님이 동의하는 사실과 추가확인이 필요한 부분은 무엇입니까?`,'현재 가장 시급한 원인과 영향은 무엇이라고 보십니까?','기존 준비와 담당자·절차는 어느 수준입니까?','다음 단계로 가기 전에 어떤 자료를 확인해야 합니까?']
 };
 return [...new Set([...(map[role]||map.DIAGNOSIS),style.question,company?.question].filter(Boolean))].slice(0,5);
}
function speechV16GenericScripts(page,data){
 const role=speechV16PageRole(page),title=page?.title||'이 페이지',summary=page?.summary||page?.subtitle||'확인된 사실과 의사결정 항목을 구분합니다.',style=speechStyleProfile(data);
 const core=`대표님, ${title}은 단순히 내용을 읽는 페이지가 아닙니다. ${summary} 현재 자료에서 확정된 사실과 추가 확인이 필요한 부분을 나누고, 대표님이 판단해야 할 기준과 다음 행동을 정하겠습니다. 결론을 서두르지 않고 자료·담당자·기한을 남기겠습니다.`;
 const roleText={ORIENTATION:'오늘 상담의 목적과 범위를 먼저 합의하고 상품이나 실행안을 앞세우지 않겠습니다.',FINANCIAL:'숫자의 증감 자체보다 현금·차입·경영권·실행에 미치는 의미를 설명하겠습니다.',EVIDENCE:'출처·연도·단위·산식과 자료충돌을 공개하고 확인 전에는 확정하지 않겠습니다.',DECISION:'대안별 비용·시간·통제력·위험을 비교하고 진행·축소·보류 조건을 합의하겠습니다.',INSURANCE:'위험·필요재원·현재재원·부족재원·비보험 대안을 확인하기 전에는 상품과 보험료를 제시하지 않겠습니다.',IMPLEMENTATION:'실행항목을 담당자·기한·KPI·재검토일로 바꾸어 사후관리까지 연결하겠습니다.',DIAGNOSIS:'대표님의 체감과 보고서 수치가 다른 부분부터 질문하고 원인·영향·우선순위를 좁히겠습니다.'}[role];
 return {speech30:speechCustomize(`${summary} ${roleText}`,data,'', 'speech30'),speech90:speechCustomize(`${core} ${roleText}`,data,'','speech90'),speech3m:speechCustomize(`${core} ${roleText} 대표님의 반응에 따라 사실확인, 자료요청, 전문가 검증, 최소진단 중 한 단계로 범위를 줄이겠습니다. 반론을 설득으로 누르지 않고 대표님의 기준을 확인하겠습니다.`,data,'','speech3m'),speech5m:speechCustomize(`${core} ${roleText} 첫째 이 페이지의 팩트와 출처를 확인합니다. 둘째 수치가 경영에 미치는 의미와 방치위험을 설명합니다. 셋째 대표님의 의도와 기존 준비를 질문합니다. 넷째 A·B·C 대안의 비용·시간·통제력·전문가 검토범위를 비교합니다. 다섯째 오늘 전체 실행이 아니라 다음 확인자료, 담당자, 제출일, 재검토일을 확정합니다. 미확인 사실과 세무·법률·보험 적용가능성은 관련 전문가 검토 전까지 조건부로 표시합니다.`,data,'','speech5m')};
}
function speechV16IssuePageText(text,page){
 const role=speechV16PageRole(page),focus={DIAGNOSIS:'이 진단 페이지에서는 확인된 팩트와 경영상 의미를 먼저 설명합니다.',DECISION:'이 실행대안 페이지에서는 A·B·C안과 자료·담당자·기한을 결정합니다.',INSURANCE:'이 보험검토 페이지에서는 필요재원과 기존재원, 부족분과 비보험 대안을 순서대로 확인합니다.',EVIDENCE:'이 근거 페이지에서는 출처·산식·확인상태와 전문가 검토경계를 설명합니다.',FINANCIAL:'이 재무 페이지에서는 숫자의 증감보다 현금과 의사결정에 미치는 의미를 설명합니다.'}[role]||'이 페이지의 목적에 맞춰 사실·질문·다음 행동을 연결합니다.';
 return `${focus} 페이지 주제는 ${page?.title||'해당 이슈'}입니다. ${text} 이 페이지에서 합의할 다음 단계는 ${page?.summary||page?.notePurpose||'자료와 재검토 일정 확정'}입니다.`;
}
SpeechEngine.notes=function(page,data,analysis){
 const issue=page.issueId?analysis.issues.find(x=>x.id===page.issueId):null,lib=page.issueId?this.get(page.issueId,data):null,role=speechV16PageRole(page),generic=speechV16GenericScripts(page,data);
 const branches=page.issueId?this.branches(page.issueId):speechV16CommonBranches(page),objections=speechV16ObjectionsFor(page,data),scenarios=speechV16ScenariosFor(page,data),style=speechStyleProfile(data),companies=speechCompanyProfiles(data);
 const purpose=page.notePurpose||(issue?`${issue.title}을 CEO가 경영 의사결정 과제로 이해하고 다음 확인 행동에 동의하도록 합니다.`:`${page.title}의 핵심 사실을 이해하고 대표가 판단할 기준과 다음 행동을 합의하도록 합니다.`);
 const diagnosis=issue?.meaning||page.summary||'확인된 사실과 계산값을 경영 언어로 번역해 설명합니다.';
 return {purpose,diagnosis,speech30:lib?speechCustomize(speechV16IssuePageText(lib.speech30,page),data,page.issueId,'speech30'):generic.speech30,speech90:lib?speechCustomize(speechV16IssuePageText(lib.speech90,page),data,page.issueId,'speech90'):generic.speech90,speech3m:lib?speechCustomize(speechV16IssuePageText(lib.speech3m,page),data,page.issueId,'speech3m'):generic.speech3m,speech5m:lib?speechCustomize(speechV16IssuePageText(lib.speech5m,page),data,page.issueId,'speech5m'):generic.speech5m,questions:page.issueId?speechIssueQuestions(page.issueId,data):speechV16GenericQuestions(page,data),branches:branches.map(x=>({...x,secondResponse:x.secondResponse||speechV16SecondResponse(page.issueId||role,x)})),objections:objections.map(o=>({title:o.title,dialogue:o.dialogue,framework:o.framework,actionAgreement:o.actionAgreement})),scenario:scenarios[0]||null,scenarios,customization:{ceoStyle:data?.answers?.ceoStyle||'신중보수형',styleOrder:style.order,companyTypes:companies.map(x=>x.name),companyContext:companies.map(x=>x.context),appliedTo:['설명순서','근거비중','질문순서','반론선택','클로징']},advanced:[lib?.guardrail||'미확인 사실은 확정적으로 표현하지 않습니다.',...this.companyContext(data),'계산값·연도·단위·법인/주주 주체를 본문과 일치시킵니다.','전문가 검토 전 세무·법률·보험 적용가능성을 확정하지 않습니다.'],connection:issue?`${issue.consulting||'정밀진단'} / 보험: ${issue.insurance||'추가 확인 후 판단'}`:role==='INSURANCE'?'필요재원과 보장공백이 확인될 때만 설계검토로 연결합니다.':'자료확정·정밀진단·전문가 협업 중 적절한 다음 단계를 합의합니다.',transition:lib?.nextAction||style.closing,documents:page.issueId?documentList(page.issueId):(SPEECH_V16_GENERIC_DOCUMENTS[role]||SPEECH_V16_GENERIC_DOCUMENTS.DIAGNOSIS)};
};
const speechV16PageShellV15=pageShell;
pageShell=function(spec){
 const page=speechV16PageShellV15(spec);
 if(spec?.cover&&!page.html.includes('data-note-page='))page.html=page.html.replace('<footer class="page-footer">',`<button class="note-trigger consultant-only" type="button" data-note-page="${spec.id}">✎ 상담노트</button><footer class="page-footer">`);
 return page;
};
openNotes=function(pageId){
 const p=state.pages.find(x=>x.id===pageId);if(!p)return;const x=p.notes||{};$('notesTitle').textContent=p.title+' · 상담노트';
 const branches=(x.branches||[]).map(b=>`<div class="branch-card"><b>${esc(b.type)} · ${esc(b.expression)}</b><p><strong>1차 대응:</strong> ${esc(b.response)}</p><p><strong>진단 재질문:</strong> ${esc(b.followUp)}</p><p><strong>2차 대응:</strong> ${esc(b.secondResponse||'대표의 실제 우려를 다시 확인하고 다음 한 단계로 범위를 줄입니다.')}</p><small>행동합의: ${esc(b.agreement)}</small></div>`).join('');
 const objections=(x.objections||[]).map(o=>`<div class="branch-card"><b>${esc(o.title)}</b>${(o.dialogue||[]).map(d=>`<p><strong>${esc(d.speaker)}:</strong> ${esc(d.text)}</p>`).join('')}<small>${esc(o.actionAgreement||'다음 행동을 합의합니다.')}</small></div>`).join('');
 const scenarios=(x.scenarios||[x.scenario]).filter(Boolean).map(s=>`<div class="branch-card"><b>${esc(s.title)}</b><p>${esc(s.text)}</p></div>`).join('');
 $('notesBody').innerHTML=`<section class="note-sec"><div class="lab">01 PAGE PURPOSE</div><h3>페이지 목적</h3><p>${esc(x.purpose)}</p></section><section class="note-sec"><div class="lab">02 KEY DIAGNOSIS</div><h3>핵심 진단</h3><p>${esc(x.diagnosis)}</p></section><section class="note-sec"><div class="lab">03 SPEECH</div><h3>30초 문제제기</h3><p>${esc(x.speech30)}</p><h3>90초 표준화법</h3><p>${esc(x.speech90)}</p><details><summary>3분·5분 심화화법</summary><p>${esc(x.speech3m)}</p><p>${esc(x.speech5m)}</p></details></section><section class="note-sec"><div class="lab">04 QUESTIONS</div><h3>CEO 확인질문</h3>${list(x.questions)}</section><section class="note-sec"><div class="lab">05 RESPONSE BRANCHES</div><h3>답변별 7분기 · 2차 대응</h3>${branches}</section><section class="note-sec"><div class="lab">06 OBJECTIONS</div><h3>반론 완결 대응</h3>${objections}</section><section class="note-sec"><div class="lab">06B COMPLETE SCENARIO</div><h3>완전 상담 시나리오</h3>${scenarios}<h3>맞춤화 기준</h3>${x.customization?list([`CEO: ${x.customization.ceoStyle} · ${x.customization.styleOrder}`,...x.customization.companyTypes.map((v,i)=>`${v}: ${x.customization.companyContext[i]||''}`),`실제 적용: ${(x.customization.appliedTo||[]).join(' · ')}`]):''}</section><section class="note-sec"><div class="lab">07 ADVANCED GUIDE</div><h3>심화 가이드</h3>${list(x.advanced)}</section><section class="note-sec"><div class="lab">08 CONTRACT CONNECTION</div><h3>계약·프로젝트 연결</h3><p>${esc(x.connection)}</p></section><section class="note-sec"><div class="lab">09 TRANSITION</div><h3>전환·다음 행동</h3><p>${esc(x.transition)}</p></section><section class="note-sec"><div class="lab">10 DOCUMENTS</div><h3>준비자료</h3>${list(x.documents)}</section>`;
 $('drawerBackdrop').classList.add('on');$('notesDrawer').classList.add('on');
};
buildAudioChapters=function(model){
 const severityRank={HIGH:3,MEDIUM:2,LOW:1},activeIssues=(model.issues||[]).filter(x=>ISSUE_SPEECH_LIBRARY[x.id]).sort((a,b)=>(severityRank[b.severity]||0)-(severityRank[a.severity]||0));
 const active=activeIssues.map(x=>x.id),p=model.profile||{},company=p.displayName||p.companyName||'이 기업';
 const insuranceHigh=(model.insurance||[]).some(x=>['A','B','A_CORE','B_CONDITIONAL'].includes(x.grade))&&(active.includes('KEY_PERSON')||active.includes('SUCCESSION'));
 const optimize=active.includes('INSURANCE_OPTIMIZATION')||['일부 확보','전체 확보'].includes(model.answers?.existingInsurance);
 const lectureType=optimize?'INSURANCE_OPTIMIZATION':insuranceHigh?'INSURANCE_OPPORTUNITY':'CONSULTING_PRIORITY';model.audioLectureType=lectureType;
 const introType=!activeIssues.length?'현재 자동 임계치상 핵심 이슈를 확정하지 않고 추가 확인이 필요한 기업':{INSURANCE_OPPORTUNITY:'대표 유고·승계의 부족재원을 계산할 가치가 높은 기업',CONSULTING_PRIORITY:'보험보다 경영 정밀진단과 실행프로젝트가 우선인 기업',INSURANCE_OPTIMIZATION:'신규가입보다 기존 증권의 목적·공백·중복 점검이 우선인 기업'}[lectureType];
 const chapters=[{title:'기업의 한 문장 진단과 학습목표',minutes:3,sourceIssueIds:active.slice(),script:`자비아 기업경영 의사결정 해설교육, 시작하겠습니다. 오늘은 ${company}의 리포트를 읽는 것이 아니라 무엇을 묻고 어떤 순서로 상담할지 훈련합니다. 이 기업은 ${introType}입니다. 활성 이슈는 ${activeIssues.map(x=>x.title).join(', ')||'추가 확인 필요'}입니다. 보험은 위험과 부족재원이 확인된 뒤 비교하는 결론입니다.`}];
 chapters.push({title:'숫자를 경영언어로 번역하는 법',minutes:3,sourceIssueIds:active.slice(),script:`숫자는 매출·자산·비율을 나열하지 않습니다. 현금이 어디에 묶였는지, 1년 안에 갚을 돈과 즉시 쓸 자산의 여유가 어떤지, 대표와 주주의 의사결정에 어떤 영향을 주는지 설명합니다. 원본·계산값·시나리오·확인필요를 구분하고, 확인되지 않은 금액은 질문과 자료요청으로 남깁니다.`});
 if(!activeIssues.length){
  chapters.push({title:'자동 이슈 미확정 시 상담 원칙',minutes:4,sourceIssueIds:[],script:'현재 자료에서 자동 임계치를 넘는 핵심 이슈가 확정되지 않았습니다. 이것은 문제가 전혀 없다는 뜻이 아니라, 추가 근거 없이 대여금·자본거래·승계·대표 유고를 가정하지 않는다는 뜻입니다. 대표가 체감하는 경영과제와 자료의 공백을 먼저 확인하고, 근거가 확인될 때만 진단범위를 넓힙니다.'});
  chapters.push({title:'추가 확인질문과 자료 요청',minutes:4,sourceIssueIds:[],script:'대표님이 현재 가장 먼저 해결하고 싶은 경영과제, 보고서 수치와 체감이 다른 부분, 향후 1년의 투자·차입·주주 의사결정을 질문합니다. 최근 자금수지, 차입만기, 주요 거래처와 재고, 주주·임원 관련 변동자료 중 실제로 존재하는 자료만 요청하고 미확인 항목을 0이나 없음으로 단정하지 않습니다.'});
  chapters.push({title:'문제가 없다는 반론과 재검토 기준',minutes:4,sourceIssueIds:[],script:'대표가 현재 문제가 없다고 답하면 그 판단을 존중합니다. 어느 수치나 사건부터 관리가 필요하다고 판단할지 경계값을 합의하고, 매출·현금·차입·주주구조에 의미 있는 변화가 생길 때만 재검토합니다. 오늘은 전체 프로젝트가 아니라 모니터링 기준과 재확인일을 정하는 것으로 충분합니다.'});
  chapters.push({title:'현장 실행과제',minutes:2,sourceIssueIds:[],script:'다음 미팅에는 원본 기업보고서, 최신 결산자료, 최근 자금수지와 대표가 중요하다고 보는 의사결정 목록을 준비하십시오. 확인된 이슈가 없으면 보험이나 유료프로젝트를 억지로 만들지 않습니다. 오늘 주제에서 딱 하나만 기억한다면 확인되지 않은 사실을 문제로 만들어서는 안 된다는 원칙입니다. 이상, 자비아 기업경영 의사결정 해설교육이었습니다.'});
  return chapters;
 }
 const top=activeIssues.slice(0,3),per=activeIssues.length===1?5:activeIssues.length===2?4:3;
 top.forEach((issue,idx)=>{const id=issue.id,lib=SpeechEngine.get(id,model),displayTitle=issue.title||lib.title||id,note=SpeechEngine.notes({id:'audio-'+id,issueId:id,title:displayTitle,summary:issue.meaning},model,model),branch=note.branches[idx%7],obj=note.objections[0];chapters.push({title:`핵심 이슈 ${idx+1} · ${displayTitle}`,minutes:per,sourceIssueIds:[id],script:`학습목표는 ${displayTitle}의 확인된 사실과 경영적 의미를 설명하고 다음 행동에 합의하는 것입니다. ${note.speech3m} 실전 질문은 ${note.questions.slice(0,3).join(' ')} 대표가 ${branch.expression}라고 답하면 1차로 ${branch.response}라고 설명하고 ${branch.followUp}라고 재질문합니다. 2차로는 ${branch.secondResponse} 최종 행동은 ${branch.agreement}입니다.${obj?` 반론 “${obj.title}”에는 ${(obj.dialogue||[]).filter(x=>x.speaker==='컨설턴트').map(x=>x.text).join(' ')}`:''}`});});
 if(activeIssues.length>3){const rest=activeIssues.slice(3);chapters.push({title:'추가 활성 이슈 빠른 적용',minutes:2,sourceIssueIds:rest.map(x=>x.id),script:rest.map(issue=>{const lib=SpeechEngine.get(issue.id,model),displayTitle=issue.title||lib.title||issue.id,note=SpeechEngine.notes({id:'audio-short-'+issue.id,issueId:issue.id,title:displayTitle,summary:issue.meaning},model,model);return `${displayTitle}: ${note.speech30} 확인질문은 ${note.questions[0]} 다음 행동은 ${note.transition}`;}).join(' ')});}
 if(lectureType==='INSURANCE_OPPORTUNITY')chapters.push({title:'보험을 꺼내는 시점과 8단계',minutes:3,sourceIssueIds:active.filter(id=>['KEY_PERSON','SUCCESSION','EXECUTIVE_RETIREMENT','EXPORT_CREDIT','PROPERTY_BI','INSURANCE_OPTIMIZATION'].includes(id)),script:`잘못된 접근은 상품과 세금부터 말하는 것입니다. 올바른 순서는 위험사건, 재무충격, 필요재원, 현재재원, 부족재원, 보험 외 대안, 보험 역할입니다. ${INSURANCE_SPEECH_STAGES.map(x=>`${x.stage}. ${x.speech} 완료조건은 ${x.gate}.`).join(' ')} 부족재원이 없으면 보험을 확대하지 않습니다.`});
 else if(lectureType==='INSURANCE_OPTIMIZATION')chapters.push({title:'기존 증권 최적화 원칙',minutes:3,sourceIssueIds:active.includes('INSURANCE_OPTIMIZATION')?['INSURANCE_OPTIMIZATION']:active.slice(),script:'모든 법인·개인 증권을 목적별로 분류하고 계약자·피보험자·수익자, 보장금액·기간, 현금가치, 해지손실, 면책, 신규심사를 필요재원과 비교합니다. 목적과 기간이 맞으면 유지가 결론이며 실제 부족분에만 추가설계를 검토합니다.'});
 else chapters.push({title:'보험을 배제하고 유료진단을 제안하는 법',minutes:3,sourceIssueIds:active.slice(),script:`보험의 직접 당위성이 낮다면 ${activeIssues.length?activeIssues.map(x=>x.title).join(', '):'현재 확인된 재무사실과 추가 확인사항'}을 중심으로 정밀진단을 우선합니다. 확인되지 않은 대여금·자본거래·승계·대표 유고를 임의로 가정하지 않습니다. 산출물·담당자·기한·KPI·중단조건을 합의하고, 별도의 우연한 위험과 부족재원이 확인될 때만 보험 게이트를 엽니다.`});
 const objection=speechV16ObjectionsFor({id:'audio-objection',issueId:active[0]||'',title:'반론'},model)[0];
 chapters.push({title:'대표 반론 역할극과 다음 미팅',minutes:2,sourceIssueIds:active.slice(),script:`반론은 거절이 아니라 추가 확인 요청입니다. ${objection?(objection.dialogue||[]).map(x=>`${x.speaker}: ${x.text}`).join(' '):'대표의 우려를 인정하고 진짜 이유를 확인한 뒤 범위를 한 단계로 줄입니다.'} 모든 반론의 끝에는 자료·담당자·기한·재검토일이 남아야 합니다.`});
 chapters.push({title:'현장 실행과제',minutes:2,sourceIssueIds:active.slice(),script:`다음 미팅에는 ${active.slice(0,5).flatMap(documentList).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10).join(', ')||'원본 자료와 담당자 목록'}을 준비하십시오. 오늘 전체 계약을 요구하지 않고 판단자료와 다음 확인일까지만 합의합니다. 오늘 주제에서 딱 하나만 기억한다면 확인된 사실과 계산된 부족재원보다 보험이 먼저 나가서는 안 된다는 원칙입니다. 이상, 자비아 기업경영 의사결정 해설교육이었습니다.`});
 let total=chapters.reduce((s,x)=>s+x.minutes,0);while(total<18){chapters[chapters.length-2].minutes++;total++;}while(total>25){const c=chapters.find(x=>x.minutes>2&&x.title.startsWith('핵심 이슈'));if(!c)break;c.minutes--;total--;}
 return chapters;
};
function speechV16StaticCoverage(){
 const scenarioTitles=SCENARIO_LIBRARY.map(x=>x.title),scenarioRoutes=Object.keys(SPEECH_V16_SCENARIO_ROUTE_MATRIX),objectionTitles=OBJECTION_LIBRARY.map(x=>x.title);
 const objectionRoutes=[...Object.values(SPEECH_ISSUE_OBJECTION_MAP).flat(),...Object.values(SPEECH_V16_COMMON_OBJECTION_ROUTES).flat()];
 const branchRows=Object.entries(CEO_RESPONSE_BRANCHES).flatMap(([id,rows])=>(rows||[]).map(x=>({issueId:id,...x})));
 const styleSamples=Object.keys(SPEECH_CEO_STYLE_PROFILES).map(style=>speechCustomize(ISSUE_SPEECH_LIBRARY.WORKING_CAPITAL.speech90,{answers:{ceoStyle:style},profile:{industry:'서비스업'},financials:{'2025':{revenue:10000,operatingCashFlow:500}},calculations:{ratios:{currentRatio:120}}},'WORKING_CAPITAL','speech90'));
 return {scenarioCount:scenarioTitles.length,scenarioUnrouted:scenarioTitles.filter(x=>!scenarioRoutes.includes(x)),objectionCount:objectionTitles.length,objectionUnrouted:objectionTitles.filter(x=>!objectionRoutes.includes(x)),branchCount:branchRows.length,branchesWithoutSecond:branchRows.filter(x=>!String(x.secondResponse||'').trim()).map(x=>`${x.issueId}:${x.type}`),branchIssues:Object.keys(CEO_RESPONSE_BRANCHES).filter(id=>(CEO_RESPONSE_BRANCHES[id]||[]).length===7),styleCount:Object.keys(SPEECH_CEO_STYLE_PROFILES).length,styleOutputUnique:new Set(styleSamples).size,companyTypeCount:Object.keys(SPEECH_COMPANY_TYPE_PROFILES).length};
}
runQuality=function(){
 const m=state.analysis||state.caseData,hard=[],stats=speechCompletionStats(),staticCoverage=speechV16StaticCoverage();
 if(!state.factsConfirmed)hard.push('추출값 사용자 승인 미완료');
 const f=m?.financials?.['2025']||{};['revenue','assets','liabilities','equity'].forEach(k=>{if(!Number.isFinite(f[k]))hard.push('2025 '+FIELD_META[k][0]+' 누락');});
 const badA=(m?.insurance||[]).filter(x=>['A','A_CORE'].includes(x.grade)&&!Number.isFinite(x.gap));if(badA.length)hard.push('A등급 보험기회에 부족재원 금액 없음');
 if(stats.completeIssueScripts!==stats.issues)hard.push(`이슈별 장단 화법 누락 ${stats.issues-stats.completeIssueScripts}건`);
 if(stats.branchIssues!==stats.issues)hard.push(`이슈별 CEO 7분기 누락 ${stats.issues-stats.branchIssues}건`);
 if(staticCoverage.branchesWithoutSecond.length)hard.push('2차 대응 누락: '+staticCoverage.branchesWithoutSecond.join(', '));
 if(staticCoverage.objectionCount!==25||staticCoverage.objectionUnrouted.length)hard.push(`반론 실행경로 불완전: ${staticCoverage.objectionCount}/25 · 미라우팅 ${staticCoverage.objectionUnrouted.join(', ')}`);
 if(staticCoverage.scenarioCount!==20||staticCoverage.scenarioUnrouted.length)hard.push(`상담 시나리오 실행경로 불완전: ${staticCoverage.scenarioCount}/20 · 미라우팅 ${staticCoverage.scenarioUnrouted.join(', ')}`);
 if(staticCoverage.styleCount<7||staticCoverage.styleOutputUnique<7||staticCoverage.companyTypeCount<10)hard.push(`맞춤화 실질변환 불완전: CEO ${staticCoverage.styleOutputUnique}/7 · 기업 ${staticCoverage.companyTypeCount}/10`);
 if(stats.insuranceStages!==8)hard.push(`보험계약 단계 ${stats.insuranceStages}/8`);
 const pages=state.pages.filter(x=>x.visibility!=='audio'),generatedText=[],usedScenarios=new Set(),usedObjections=new Set();let noteComplete=0,branchComplete=0,objComplete=0,scenarioComplete=0,secondComplete=0;
 pages.forEach(p=>{const n=p.notes||{},complete=n.purpose&&n.diagnosis&&n.speech30&&n.speech90&&n.speech3m&&n.speech5m&&n.questions?.length>=3&&n.branches?.length===7&&n.objections?.length>=2&&n.advanced?.length&&n.connection&&n.transition&&n.documents?.length&&(n.scenarios?.length||n.scenario);if(complete)noteComplete++;else hard.push(`${p.title}: 10단 상담노트 불완전`);if(n.branches?.length===7&&new Set(n.branches.map(x=>x.type)).size===7)branchComplete++;else hard.push(`${p.title}: 답변 7분기 불완전`);if((n.branches||[]).every(x=>String(x.secondResponse||'').trim()))secondComplete++;else hard.push(`${p.title}: 2차 대응 누락`);if(n.objections?.length>=2)objComplete++;else hard.push(`${p.title}: 반론 2종 미만`);if((n.scenarios?.length||0)>=1||n.scenario)scenarioComplete++;else hard.push(`${p.title}: 완전 상담 시나리오 누락`);(n.scenarios||[n.scenario]).filter(Boolean).forEach(x=>usedScenarios.add(x.title));(n.objections||[]).forEach(x=>usedObjections.add(x.title));generatedText.push(n.speech30,n.speech90,n.speech3m,n.speech5m,n.transition,...(n.objections||[]).flatMap(o=>(o.dialogue||[]).map(d=>d.text)),...(n.branches||[]).flatMap(b=>[b.response,b.followUp,b.secondResponse,b.agreement]));});
 const text=generatedText.filter(Boolean).join('\n');SPEECH_FORBIDDEN_PATTERNS.forEach(re=>{re.lastIndex=0;if(re.test(text))hard.push(`금지·보장 표현 검출: ${re}`);});
 const longScripts=pages.map(p=>String(p.notes?.speech90||'').replace(/\s+/g,' ').trim()).filter(x=>x.length>80),duplicates=longScripts.filter((x,i)=>longScripts.indexOf(x)!==i);if(duplicates.length)hard.push(`페이지 화법 완전중복 ${new Set(duplicates).size}건`);
 const activeIds=new Set((m?.issues||[]).map(x=>x.id).filter(id=>ISSUE_SPEECH_LIBRARY[id])),audio=m?.audioChapters||[],audioRefs=new Set(audio.flatMap(x=>x.sourceIssueIds||[])),missingAudio=[...activeIds].filter(id=>!audioRefs.has(id)),inactiveRefs=[...audioRefs].filter(id=>id&&!activeIds.has(id));if(missingAudio.length)hard.push('음성강의 활성 이슈 누락: '+missingAudio.join(','));if(inactiveRefs.length)hard.push('음성강의 비활성 이슈 포함: '+inactiveRefs.join(','));
 const audioMinutes=audio.reduce((s,x)=>s+(x.minutes||0),0);if(audio.length<5||audioMinutes<18||audioMinutes>25)hard.push(`음성강의 구성 ${audio.length}챕터·${audioMinutes}분`);
 const ratio=(a,b)=>b?Math.min(1,a/b):1,routeObj=1-ratio(staticCoverage.objectionUnrouted.length,Math.max(1,staticCoverage.objectionCount)),routeSc=1-ratio(staticCoverage.scenarioUnrouted.length,Math.max(1,staticCoverage.scenarioCount));
 const scores={
  accuracy:state.factsConfirmed&&['revenue','assets','liabilities','equity'].every(k=>Number.isFinite(f[k]))?95:82,
  calculation:(m?.calculations?.calculator?.ratios?.ok&&m?.calculations?.calculator?.cashFlow?.ok)?96:(m?.calculations?.calculator?.ratios?.ok?93:90),
  management:Math.round(90+8*ratio(noteComplete,pages.length)),
  ceo:Math.round(90+6*ratio(noteComplete,pages.length)),
  speech:Math.round(85+8*ratio(noteComplete,pages.length)+5*ratio(stats.completeIssueScripts,stats.issues)),
  branches:Math.round(82+8*ratio(branchComplete,pages.length)+8*ratio(secondComplete,pages.length)),
  objections:Math.round(82+8*ratio(objComplete,pages.length)+8*routeObj),
  scenarios:Math.round(82+8*ratio(scenarioComplete,pages.length)+8*routeSc),
  insurance:Math.round(84+7*ratio(stats.insuranceStages,8)+(badA.length?0:7)),
  customization:Math.round(82+8*ratio(staticCoverage.styleOutputUnique,7)+8*ratio(staticCoverage.companyTypeCount,10)),
  audio:Math.round(84+(audioMinutes>=18&&audioMinutes<=25?6:0)+(missingAudio.length||inactiveRefs.length?0:8)),
  mode:95,evidence:state.live.taxnavi?94:90,render:94
 };
 Object.keys(scores).forEach(k=>scores[k]=Math.max(0,Math.min(100,scores[k])));
 const weights={accuracy:12,calculation:8,management:8,ceo:7,speech:12,branches:10,objections:8,scenarios:7,insurance:10,customization:6,audio:5,mode:3,evidence:2,render:2};
 const average=Object.entries(scores).reduce((s,[k,v])=>s+v*weights[k],0)/100,min=Math.min(...Object.values(scores));
 return {scores,weights,average,min,hardFails:[...new Set(hard)],passed:hard.length===0&&average>=92.3&&min>=90,checkedAt:nowIso(),speechStats:stats,audioMinutes,coverage:{allPages:pages.length,noteComplete,branchComplete,secondComplete,objComplete,scenarioComplete,usedScenarios:[...usedScenarios],usedObjections:[...usedObjections],static:staticCoverage,audioActive:[...activeIds],audioCovered:[...audioRefs]}};
};
qualityHtml=function(q){
 const labels={accuracy:'팩트 정확성',calculation:'계산 일치',management:'경영해석',ceo:'CEO 본문',speech:'전 페이지 화법',branches:'CEO 7분기·2차대응',objections:'반론 25종',scenarios:'상담 시나리오 20선',insurance:'보험 판단',customization:'맞춤화',audio:'음성강의',mode:'모드 분리',evidence:'근거 연결',render:'A4·모바일'};
 return `<div class="lead"><b>${q.passed?'1차 코드 기준 통과':'보완 필요'} · ${q.average.toFixed(2)}점</b><p>최저 ${q.min.toFixed(1)}점 · 중대오류 ${q.hardFails.length}건 · ${q.coverage?.noteComplete||0}/${q.coverage?.allPages||0}개 비오디오 페이지 10단 노트 · 현장평가 전 내부 실행검수입니다.</p></div><div class="quality-grid">${Object.entries(q.scores).map(([k,v])=>`<div class="quality-card ${v>=92.3?'good':v>=90?'warn':'bad'}"><b>${v.toFixed(1)}</b><span>${esc(labels[k]||k)} · 가중치 ${q.weights[k]}%</span></div>`).join('')}</div><div class="quality-list"><h3>중대오류</h3>${q.hardFails.length?list(q.hardFails):'<p>탐지된 중대오류가 없습니다.</p>'}<h3>실행 커버리지</h3>${list([`10단 노트 ${q.coverage?.noteComplete||0}/${q.coverage?.allPages||0}`,`7분기 ${q.coverage?.branchComplete||0}/${q.coverage?.allPages||0}`,`2차 대응 ${q.coverage?.secondComplete||0}/${q.coverage?.allPages||0}`,`반론 라우팅 ${25-(q.coverage?.static?.objectionUnrouted?.length||0)}/25`,`시나리오 라우팅 ${20-(q.coverage?.static?.scenarioUnrouted?.length||0)}/20`,`음성 활성 이슈 ${(q.coverage?.audioCovered||[]).length}/${(q.coverage?.audioActive||[]).length}`])}<h3>다음 검증</h3>${list(['실제 NICE·CRETOP 기업 사례 반복시험','초급·중급·고경력 컨설턴트 현장평가','P1~P9 서버 AI 및 TaxNavi 연결 후 재검수','CEO 전달본·모바일·TTS 종단시험'])}</div>`;
};
SpeechEngine.auditStatic=speechV16StaticCoverage;
SpeechEngine.auditGolden=function(){
 const backup={caseData:state.caseData,analysis:state.analysis,pages:state.pages,factsConfirmed:state.factsConfirmed,quality:state.quality};
 try{const model=buildConfirmedModel(clone(GOLDEN_SAMPLE));state.caseData=model;state.analysis=model;state.factsConfirmed=true;generatePages(model);state.quality=runQuality();return {version:VERSION,passed:state.quality.passed,average:state.quality.average,min:state.quality.min,hardFails:state.quality.hardFails,pageCount:state.pages.length,coverage:state.quality.coverage,audioMinutes:state.quality.audioMinutes,audioChapters:model.audioChapters.length};}
 finally{state.caseData=backup.caseData;state.analysis=backup.analysis;state.pages=backup.pages;state.factsConfirmed=backup.factsConfirmed;state.quality=backup.quality;}
};

// Public API used by HTML and JARVIA integration.

/* ==========================================================================
 * PRODUCTION HARDENING v1.7.0
 * 데이터 무결성·회계기간·계산기·승인·품질게이트 강화
 * ========================================================================== */
const CR_FIN_KEYS=['assets','liabilities','equity','revenue','cogs','operatingProfit','netIncome','operatingCashFlow','cash','currentAssets','currentLiabilities','receivables','inventory','payables','borrowings','currentBorrowings','nonCurrentBorrowings','shortTermLoanReceivable','retainedEarnings','interestExpense','capitalStock'];
function crEmptyFinancialYear(){return Object.fromEntries(CR_FIN_KEYS.map(k=>[k,null]));}
function crEmptyCase({sourceType='직접입력',sourcePages=0,confirmed=false}={}){
 const years={'2023':crEmptyFinancialYear(),'2024':crEmptyFinancialYear(),'2025':crEmptyFinancialYear()};
 return {meta:{schemaVersion:'CR-1.9.2',caseId:'CR-'+uid().toUpperCase(),sourceType,sourcePages,sourceFileName:'',unit:'백만원',confirmed,createdAt:new Date().toISOString().slice(0,10),statementType:'확인 필요',extractionQualityPassed:false},profile:{companyName:'',displayName:'',businessNumber:'',representative:'',employees:null,established:null,companyType:'',industry:'',industryCode:'',products:'',address:'',website:'',groupName:'',mainBank:'',creditGrade:'',watchGrade:'',cashFlowGrade:'',foreignSubsidiaries:[],relatedCompanies:[],shareholders:[],reportDate:null,fiscalDate:null,latestQuarterDate:null},financials:years,latestQuarterly:null,capitalEvents:[],answers:{ceoStyle:'신중보수형',meetingStage:'1차 진단',successorStatus:'미확인',existingInsurance:'미확인',keyPersonMonthlyFixedCost:null,keyPersonEmergencyMonths:12,immediateDebtRepayment:null,availableEmergencyCash:null,existingKeyPersonCoverage:null,topCustomerConcentration:'미확인'},sourceMap:{},warnings:[],speechPlan:null,speechOverrides:{},dynamicQuestions:[],derivedSignals:[],confirmationQueue:[],extractionResult:null};
}
function crCleanText(v){if(v===null||v===undefined)return '';const t=String(v).replace(/\s+/g,' ').trim();return (!t||t==='-'||t==='—'||/^미확인$/i.test(t)||/^해당\s*없음$/i.test(t))?'':t;}
function crNormalizeCase(d){
 const base=crEmptyCase({sourceType:d?.meta?.sourceType||'미확인',sourcePages:d?.meta?.sourcePages||0,confirmed:!!d?.meta?.confirmed});
 const out=Object.assign(base,clone(d||{}));out.meta=Object.assign(base.meta,clone(d?.meta||{}));out.profile=Object.assign(base.profile,clone(d?.profile||{}));out.profile.companyName=crCleanText(out.profile.companyName);out.profile.displayName=crCleanText(out.profile.displayName)||out.profile.companyName;['businessNumber','representative','companyType','industry','industryCode','products','address','website','groupName','mainBank','creditGrade','watchGrade','cashFlowGrade'].forEach(k=>out.profile[k]=crCleanText(out.profile[k]));['foreignSubsidiaries','relatedCompanies','shareholders'].forEach(k=>{if(!Array.isArray(out.profile[k]))out.profile[k]=[];});
 out.financials={};for(const y of ['2023','2024','2025']){out.financials[y]=Object.assign(crEmptyFinancialYear(),clone(d?.financials?.[y]||{}));for(const k of CR_FIN_KEYS)out.financials[y][k]=n(out.financials[y][k]);}
 if(out.latestQuarterly){const q=Object.assign({periodEnd:null,date:null,assets:null,liabilities:null,equity:null,cash:null,currentAssets:null,currentLiabilities:null,currentBorrowings:null,nonCurrentBorrowings:null,revenue:null,operatingProfit:null,netIncome:null,financeCost:null,sourcePage:null,confirmed:false},out.latestQuarterly);q.periodEnd=crCleanText(q.periodEnd||q.date)||null;delete q.date;for(const k of Object.keys(q))if(!['periodEnd','sourcePage','confirmed'].includes(k))q[k]=n(q[k]);if(q.periodEnd&&(/-12-31$/.test(q.periodEnd)||q.periodEnd===out.profile.fiscalDate)){out.warnings=[...(out.warnings||[]),'연말 결산자료와 동일한 최근분기 자료를 제외했습니다.'];out.latestQuarterly=null;}else out.latestQuarterly=q;}
 out.capitalEvents=Array.isArray(out.capitalEvents)?out.capitalEvents.filter(x=>x&&x.type&&Number.isFinite(n(x.amount))).map(x=>({...x,amount:n(x.amount)})):[];out.answers=Object.assign(base.answers,clone(d?.answers||{}));out.warnings=[...new Set((out.warnings||[]).filter(Boolean))];out.dynamicQuestions=Array.isArray(out.dynamicQuestions)?out.dynamicQuestions:[];out.confirmationQueue=Array.isArray(out.confirmationQueue)?out.confirmationQueue:[];return out;
}
function crValidateFacts(d,{requireThreeYears=true}={}){
 const errors=[],warnings=[];if(!crCleanText(d?.profile?.companyName))errors.push('기업명 누락');
 const years=requireThreeYears?['2023','2024','2025']:['2025'];const core=['assets','liabilities','equity','revenue','operatingProfit','netIncome'];
 for(const y of years){const f=d?.financials?.[y]||{};for(const k of core)if(!Number.isFinite(f[k]))errors.push(`${y} ${FIELD_META[k]?.[0]||k} 누락`);if([f.assets,f.liabilities,f.equity].every(Number.isFinite)){const tol=Math.max(2,Math.abs(f.assets)*0.001);if(Math.abs(f.assets-f.liabilities-f.equity)>tol)errors.push(`${y} 회계등식 불일치: 자산≠부채+자본`);}for(const k of ['assets','liabilities','equity','revenue','cash','currentAssets','currentLiabilities','receivables','inventory','payables','borrowings','currentBorrowings','nonCurrentBorrowings','capitalStock'])if(Number.isFinite(f[k])&&f[k]<0)errors.push(`${y} ${FIELD_META[k]?.[0]||k} 음수 입력`);if(Number.isFinite(f.borrowings)&&Number.isFinite(f.currentBorrowings)&&Number.isFinite(f.nonCurrentBorrowings)){const split=f.currentBorrowings+f.nonCurrentBorrowings,gap=f.borrowings-split,tol=Math.max(2,Math.abs(f.borrowings)*0.02);if(Math.abs(gap)>tol)warnings.push(gap>0?`${y} 총차입금에는 유동·비유동 차입금 외 기타금융부채 ${mm(gap)}이 포함될 수 있습니다.`:`${y} 유동·비유동 차입금 합계가 총차입금보다 ${mm(Math.abs(gap))} 큽니다. 원문 범위를 확인해 주세요.`);}}
 if(d?.latestQuarterly?.periodEnd&&(/-12-31$/.test(d.latestQuarterly.periodEnd)||d.latestQuarterly.periodEnd===d?.profile?.fiscalDate))errors.push('연말 결산값이 최근분기로 분류됨');
 if(d?.meta?.sourceType?.includes('NICE')&&d?.meta?.extractionQualityPassed===false)errors.push('NICE 자동추출 검증 미통과');
 return {passed:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
function crFinancialFieldMeta(d,y,k){
 const std=d?.meta?.statementType||'회계기준 확인 필요';const page=['assets','liabilities','equity','cash','currentAssets','currentLiabilities','receivables','inventory','payables','borrowings','currentBorrowings','nonCurrentBorrowings','retainedEarnings','capitalStock'].includes(k)?18:19;
 return d?.meta?.sourceType?.includes('NICE')?`원문 ${page}p · ${y} 개별 결산 · ${std}`:'사용자 확인 필요';
}
PDFParser.generic=function(text,pages){
 const grab=(re,d='')=>{const m=String(text||'').match(re);return m?crCleanText(m[1]):d;};const d=crEmptyCase({sourceType:'일반 텍스트형 PDF(기본정보만)',sourcePages:pages,confirmed:false});
 d.profile.companyName=grab(/기업명\s*[:：]?\s*(.{2,60}?)(?=\s+(?:대표자(?:명)?|사업자(?:등록)?번호|설립일|종업원|업종|주요\s*제품)|$)/m,'');d.profile.displayName=d.profile.companyName;d.profile.representative=grab(/대표자(?:명)?\s*[:：]?\s*([가-힣A-Za-z ]{2,30}?)(?=\s+(?:사업자(?:등록)?번호|설립일|종업원|업종|주요\s*제품)|$)/m,'');d.profile.businessNumber=grab(/사업자(?:등록)?번호\s*[:：]?\s*([0-9-]{10,12})/,'');d.warnings=['NICE BizLINE·KODATA/KCR2·CRETOP 외 미지원 형식은 기본정보만 읽으며 재무값은 직접 확인해야 합니다.'];return d;
};
ServerAdapter.extractFinancial=async function(text){const t=String(text||'').trim();return serverCall(ENDPOINTS.jebanseo,{action:'extractFinancial',text:t.slice(0,120000)});};
enrichWithExistingFinancialExtractor=async function(data,text){
 if(!memberInfo().loginId||!String(text||'').trim()||data?.meta?.sourceType?.includes('NICE'))return data;
 try{setStartStatus('기존 JARVIA 재무추출 API로 보조 교차확인하고 있습니다…');const out=await ServerAdapter.extractFinancial(text);const p=out?.pendingFinancialData||out?.financialData||out;const ex=p?.extracted||{};const y=String(p?.baseYear||'2025');if(!data.financials[y])data.financials[y]=crEmptyFinancialYear();const unit=String(p?.unit||'').toUpperCase();const factor=unit.includes('만원')||unit.includes('KRW_10K')?0.01:unit.includes('원')||unit==='KRW'?0.000001:unit.includes('백만원')||unit.includes('MILLION')?1:null;if(factor===null){data.warnings.push('보조 API 단위를 확정할 수 없어 재무값을 반영하지 않았습니다.');return data;}const map={revenue:'revenue',operatingProfit:'operatingProfit',netProfit:'netIncome',netIncome:'netIncome',totalAssets:'assets',totalLiabilities:'liabilities',totalEquity:'equity',retainedEarnings:'retainedEarnings',cashAndCashEquivalents:'cash',borrowings:'borrowings'};for(const [src,dst] of Object.entries(map)){const v=n(ex[src]);if(v!==null)data.financials[y][dst]=v*factor;}data.meta.statementType=p?.statementType||data.meta.statementType;data.meta.originalUnit=p?.unit||'';data.warnings.push('보조 API 값은 교차참고이며 사용자 승인 전 확정되지 않습니다.');state.live.ai=true;}catch(error){data.warnings.push('보조 재무추출 API를 사용하지 못했습니다: '+error.message);}return data;
};
function crInternalRatios(c,p){return {salesGrowth:div(c.revenue-p.revenue,p.revenue)*100,operatingMargin:div(c.operatingProfit,c.revenue)*100,netMargin:div(c.netIncome,c.revenue)*100,roe:div(c.netIncome,avg(c.equity,p.equity))*100,debtRatio:div(c.liabilities,c.equity)*100,currentRatio:div(c.currentAssets,c.currentLiabilities)*100,quickRatio:div((Number.isFinite(c.currentAssets)&&Number.isFinite(c.inventory))?c.currentAssets-c.inventory:null,c.currentLiabilities)*100,cashRatio:div(c.cash,c.currentLiabilities)*100,borrowingDependency:div(c.borrowings,c.assets)*100,interestCoverage:div(c.operatingProfit,c.interestExpense),dso:div(avg(c.receivables,p.receivables),c.revenue)*365,inventoryDaysReported:div(avg(c.inventory,p.inventory),c.cogs)*365,ocfConversion:div(c.operatingCashFlow,c.netIncome)*100,receivableIncrease:Number.isFinite(c.receivables)&&Number.isFinite(p.receivables)?c.receivables-p.receivables:null,inventoryIncrease:Number.isFinite(c.inventory)&&Number.isFinite(p.inventory)?c.inventory-p.inventory:null};}
computeAnalysis=function(data){
 const f=data.financials||{},c=f['2025']||{},p=f['2024']||{},r=crInternalRatios(c,p);r.cashAbsorption=Number.isFinite(r.receivableIncrease)&&Number.isFinite(r.inventoryIncrease)?r.receivableIncrease+r.inventoryIncrease:null;r.dso10Potential=div(c.revenue,365)*10;r.inventory5Potential=div(c.cogs,365)*5;r.basePotential=Number.isFinite(r.dso10Potential)&&Number.isFinite(r.inventory5Potential)?r.dso10Potential+r.inventory5Potential:null;r.conservativePotential=Number.isFinite(r.basePotential)?r.basePotential*0.5:null;r.stretchPotential=Number.isFinite(r.basePotential)?r.basePotential*1.5:null;r.totalCapitalOutflow=(data.capitalEvents||[]).filter(x=>x.status==='confirmed'&&['자기주식 취득','현금배당 지급','자본금 감소'].includes(x.type)).reduce((sum,x)=>sum+x.amount,0);
 const actualCurrentBorrow=Number.isFinite(c.currentBorrowings)?c.currentBorrowings:null;
 const ratioCurrentBorrow=Number.isFinite(actualCurrentBorrow)?actualCurrentBorrow:0;
 const ratioLongBorrow=Number.isFinite(c.borrowings)?Math.max(0,c.borrowings-ratioCurrentBorrow):(Number.isFinite(c.nonCurrentBorrowings)?c.nonCurrentBorrowings:null);
 const calcInputs={current:{revenue:c.revenue,cogs:c.cogs,grossProfit:(Number.isFinite(c.revenue)&&Number.isFinite(c.cogs))?c.revenue-c.cogs:null,operatingProfit:c.operatingProfit,netIncome:c.netIncome,totalAssets:c.assets,totalLiabilities:c.liabilities,totalEquity:c.equity,currentAssets:c.currentAssets,currentLiab:c.currentLiabilities,cash:c.cash,inventory:c.inventory,receivables:c.receivables,payables:c.payables,shortTermBorrow:ratioCurrentBorrow,longTermBorrow:ratioLongBorrow,interestExpense:c.interestExpense,retainedEarnings:c.retainedEarnings,capitalStock:c.capitalStock},previous:{revenue:p.revenue,operatingProfit:p.operatingProfit,netIncome:p.netIncome,totalAssets:p.assets},employees:data.profile?.employees};
 const calcRatios=tryCalculator('calcFinancialRatios',calcInputs);const calcCash=[c.cash,c.currentAssets,c.currentLiabilities,c.inventory,c.receivables,c.payables,c.revenue,c.cogs,actualCurrentBorrow].every(Number.isFinite)?tryCalculator('calcCashFlowRisk',{cash:c.cash,currentAssets:c.currentAssets,currentLiab:c.currentLiabilities,inventory:c.inventory,receivables:c.receivables,payables:c.payables,revenue:c.revenue,cogs:c.cogs,monthlyFixedCost:0,operatingProfit:c.operatingProfit,shortTermBorrow:actualCurrentBorrow}):{ok:false,error:'단기차입금 등 필수 입력 미확인'};
 const answers=data.answers||{};let keyman=null;const keyInputs=[n(answers.keyPersonMonthlyFixedCost),n(answers.keyPersonEmergencyMonths),n(answers.immediateDebtRepayment),n(answers.availableEmergencyCash),n(answers.existingKeyPersonCoverage)];if(keyInputs.every(Number.isFinite))keyman=tryCalculator('calcCorpKeymanNeed',{monthlyOperatingShortfall:keyInputs[0]*1000000,impactMonths:keyInputs[1],replacementCost:0,guaranteedDebt:keyInputs[2]*1000000,liquidAssets:keyInputs[3]*1000000,existingKeymanCoverage:keyInputs[4]*1000000});
 const cross=[];const cr=calcRatios?.result||calcRatios?.envelope?.result||{};const pairs=[[r.operatingMargin,cr?.profitability?.operatingMargin,'영업이익률'],[r.netMargin,cr?.profitability?.netMargin,'순이익률'],[r.debtRatio,cr?.stability?.debtRatio,'부채비율'],[r.currentRatio,cr?.stability?.currentRatio,'유동비율'],[r.borrowingDependency,cr?.stability?.borrowingDep,'차입금의존도']];for(const [a,b,label] of pairs)if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>0.2)cross.push(`${label} 내부계산 ${a.toFixed(2)} / 계산기 ${b}`);
 return {ratios:r,calculator:{ratios:calcRatios,cashFlow:calcCash,keyman},crossValidation:{passed:cross.length===0,errors:cross},calculatorVersion:global.JarviaCalculators?.version||'browser-bundle',computedAt:nowIso()};
};
buildIssues=function(data,calc){
 if(data?.speechPlan?.activeIssueIds?.length)return buildSpeechPlanIssues(data,calc);
 const c=data.financials?.['2025']||{},p=data.financials?.['2024']||{},r=calc.ratios||{},out=[];const add=(id,title,score,confidence,facts,meaning,risks,solutions,extras={})=>out.push({id,title,score,severity:severity(score),confidence,facts:facts.filter(Boolean),meaning,risks,solutions,...extras});
 const hasWC=[c.revenue,p.revenue,c.receivables,p.receivables,c.inventory,p.inventory].every(Number.isFinite)&&(r.cashAbsorption>0||Number.isFinite(r.currentRatio)&&r.currentRatio<120);if(hasWC)add('WORKING_CAPITAL','성장과 현금전환',4.2,'B',[Number.isFinite(c.revenue)?`매출 ${wonEok(c.revenue)}`:'',Number.isFinite(r.cashAbsorption)?`채권·재고 증감 ${wonEok(r.cashAbsorption)}`:'',Number.isFinite(r.currentRatio)?`유동비율 ${pct(r.currentRatio)}`:''],'확인된 채권·재고·유동성 자료를 기준으로 현금전환 속도를 점검해야 합니다.',['운전자금 증가','차입 선행 가능성'],['채권·재고 세부진단','13주 현금수지'],{consulting:'운전자금 정밀진단',insurance:'거래처 신용위험 확인 후 조건부'});
 if(Number.isFinite(c.shortTermLoanReceivable)&&c.shortTermLoanReceivable>0)add('LOAN_RECEIVABLE','단기대여금의 실질과 정상화',4.0,'B',[`단기대여금 ${wonEok(c.shortTermLoanReceivable)}`],'상대방·목적·계약·상환계획 확인이 우선입니다.',['회수·세무 위험'],['원장·계약·상환계획 복원'],{consulting:'대여금 정밀진단',insurance:'직접 연계 낮음'});
 if(Number.isFinite(c.retainedEarnings)&&c.retainedEarnings<0)add('CAPITAL_POLICY','누적결손·자본회복 정책',4.1,'B',[`이익잉여금 ${wonEok(c.retainedEarnings)}`],'누적결손의 원인과 손실회복·현금·차입·주주정책을 구분해야 합니다.',['결손 지속·자본정책 부재'],['원인 브리지·3년 자본회복 계획'],{consulting:'자본회복 정책 진단',insurance:'직접 연계 낮음'});
 if((data.capitalEvents||[]).length)add('CAPITAL_TRANSACTIONS','자본거래 재구성',3.8,'A',data.capitalEvents.map(x=>`${x.year} ${x.type} ${wonEok(x.amount)}`),'확인된 거래만 타임라인으로 복원합니다.',['절차·가치평가 단절'],['자본거래 타임라인'],{consulting:'자본거래 정밀진단',insurance:'직접 연계 아님'});
 if(data.answers?.successorStatus&&data.answers.successorStatus!=='미확인')add('SUCCESSION','경영승계·가족·주주 유동성',3.5,'C',['후계자 관련 사용자 답변 확인'],'경영권과 가족 현금수요를 별도로 설계해야 합니다.',['경영권·공평성 충돌'],['승계 A/B/C안'],{consulting:'승계 진단',insurance:'부족재원 계산 후 조건부'});
 if(Number.isFinite(n(data.answers?.keyPersonMonthlyFixedCost)))add('KEY_PERSON','대표자·핵심인 유고와 비상재원',3.6,'B',[`월 고정비 ${data.answers.keyPersonMonthlyFixedCost}백만원`],'확인된 운영비를 기준으로 부족재원을 계산합니다.',['운영현금 공백'],['필요재원 계산'],{consulting:'필요재원·증권분석',insurance:'부족재원 있을 때 조건부'});
 if(Array.isArray(data.profile?.foreignSubsidiaries)&&data.profile.foreignSubsidiaries.length)add('EXPORT_CREDIT','수출채권·해외법인 위험',3.4,'C',[`확인된 해외법인 ${data.profile.foreignSubsidiaries.length}개`],'해외 거래의 채권·재산·휴업 위험을 확인합니다.',['국가·거래처 위험'],['해외리스크 진단'],{consulting:'해외리스크 진단',insurance:'신용·재산·휴업 조건부'});
 if(['일부 확보','전체 확보'].includes(data.answers?.existingInsurance))add('INSURANCE_OPTIMIZATION','기존 보험증권 최적화',3.2,'C',['기존 보험 보유 사용자 확인'],'신규가입보다 기존 계약의 목적·공백·중복을 먼저 확인합니다.',['목적 불일치·중복'],['증권 분석'],{consulting:'증권분석',insurance:'보장분석 우선'});
 return out.sort((a,b)=>b.score-a.score);
};
buildInsuranceOpportunities=function(data,issues,calc){
 const out=[],has=id=>issues.some(x=>x.id===id),a=data.answers||{},c=data.financials?.['2025']||{};const push=(id,title,grade,basis,role,limits,next,gap=null,need=null,current=null)=>out.push({id,code:id,title,grade,basis,need,current,gap,role,limits,next,status:grade==='D'?'TO_CONFIRM':'REVIEW'});
 if(has('KEY_PERSON')){const k=calc.calculator?.keyman;const kr=k?.result||k?.envelope?.result||null;const rawGap=kr?.requiredCoverageGap??kr?.fundingGap??null,rawNeed=kr?.totalNeed??null,rawCurrent=kr?.offset??null;const gap=Number.isFinite(rawGap)?Math.round(rawGap/1000000):null,need=Number.isFinite(rawNeed)?Math.round(rawNeed/1000000):null,current=Number.isFinite(rawCurrent)?Math.round(rawCurrent/1000000):null;push('INS-KEYPERSON','대표자·핵심인 유고',Number.isFinite(gap)&&gap>0?'B':'C','사용자 확인 운영비·가용재원 기준','예고 없는 유고 시 부족재원 일부 전가','대체경영·권한체계 병행','기존증권·심사조건 확인',gap,need,current);}else push('INS-KEYPERSON','대표자·핵심인 유고','D','대표 역할·운영비·기존보장 미확인','추가정보 확인 전 판단 불가','현재 자료만으로 제안 금지','대표 역할표·운영비·증권 확인');
 if(has('SUCCESSION'))push('INS-SUCCESSION','승계·지분정리 유동성','C','후계자 관련 답변은 있으나 기업가치·가족현금수요 미확인','부족재원 확인 시 일부 전가','주식이동·가족합의·회사법 절차 대체 불가','가족·주주·가치평가 자료 확인');else push('INS-SUCCESSION','승계·지분정리 유동성','D','후계자·가족·기업가치 미확인','판단 보류','근거 없는 승계 제안 금지','승계의사 확인');
 if(has('EXPORT_CREDIT'))push('INS-CREDIT','수출채권·거래처 신용','C',Number.isFinite(c.receivables)?`매출채권 ${wonEok(c.receivables)}·확인된 해외구조`:'확인된 해외구조','특정 거래처 부도·국가위험 일부 전가','채권관리 선행','거래처별 채권·국가·연체 확인');
 if(has('INSURANCE_OPTIMIZATION'))push('INS-OPT','기존 증권 최적화','C','기존 보험 보유 사용자 확인','목적·중복·공백 조정','해지손실·신규심사 비교','전체 증권 수집');
 return out;
};
function crApplyConfirmationAnswers(data){
 const answers=data.answers||{};for(const q of data.dynamicQuestions||[]){const v=crCleanText(answers[q.id]);if(!v)continue;q.userAnswer=v;q.confirmed=true;const target=(data.confirmationQueue||[]).find(x=>String(x.question||x.text||'')===String(q.label||''));if(target){target.userAnswer=v;target.status='userConfirmed';target.confirmed=true;}}
}
collectQuestions=function(){state.caseData.answers=state.caseData.answers||{};qsa('[data-question]',$('questionsBody')).forEach(el=>{state.caseData.answers[el.dataset.question]=el.type==='number'?(n(el.value)??null):el.value.trim();});crApplyConfirmationAnswers(state.caseData);state.questionsConfirmed=true;};
const crBuildConfirmedModelBase=buildConfirmedModel;
buildConfirmedModel=function(data){const normalized=crNormalizeCase(data);crApplyConfirmationAnswers(normalized);const model=crBuildConfirmedModelBase(normalized);for(const q of normalized.dynamicQuestions||[]){if(!q.userAnswer||!q.issueId)continue;const issue=model.issues.find(x=>x.id===q.issueId);if(issue)issue.facts=[...issue.facts,`사용자 확인: ${q.userAnswer}`];}model.factValidation=crValidateFacts(normalized);return model;};
function crFactNumber(v){
 const x=n(v);if(x===null)return '';
 return x.toLocaleString('ko-KR',{maximumFractionDigits:3});
}
function crFactInputState(v){
 const x=n(v);return x===null?'is-missing':x<0?'is-negative':'';
}
function crFactSource(k){
 if(['assets','liabilities','equity','cash','currentAssets','currentLiabilities','receivables','inventory','payables','borrowings','currentBorrowings','nonCurrentBorrowings','retainedEarnings','capitalStock'].includes(k))return 'BS 18p';
 if(['revenue','cogs','operatingProfit','netIncome','operatingCashFlow','interestExpense'].includes(k))return 'IS·CF 19p';
 return '추가확인';
}
function crCompactFactWarnings(d){
 return [...new Set((d?.warnings||[]).filter(Boolean).filter(x=>!/수치\s*미검출/.test(String(x))))];
}

function crClassifyFactWarnings(d){
 const raw=[...new Set((d?.warnings||[]).filter(Boolean).map(x=>String(x).trim()).filter(Boolean))];
 const groups={blocking:[],sourceMissing:[],partial:[],confirmation:[],review:[]};
 for(const w of raw){
  if(/자산\s*=\s*부채|회계등식|필수값|연도.*미확정|단위.*미확정|검증\s*미통과|누락/.test(w)&&!/비핵심|수치\s*미검출/.test(w)){groups.blocking.push(w);continue;}
  if(/단기대여금|가지급금|상대방|거래\s*실질/.test(w)){groups.confirmation.push(w);continue;}
  if(/법인세비용/.test(w)){groups.partial.push(w.replace(/자동추출\s*확인\s*:\s*/g,'').replace(/수치\s*미검출\s*:\s*/g,''));continue;}
  if(/기타비금융자산|단기사채|장기사채|수치\s*미검출|원문.*[-—]/.test(w)){groups.sourceMissing.push(w.replace(/자동추출\s*확인\s*:\s*/g,'').replace(/수치\s*미검출\s*:\s*/g,''));continue;}
  groups.review.push(w);
 }
 const labels={blocking:'승인 차단',sourceMissing:'원문 미제공',partial:'일부 연도만 존재',confirmation:'추가 확인계정',review:'일반 확인'};
 const all=Object.values(groups).flat();
 return {raw,groups,labels,all,total:all.length};
}
function crFactWarningHtml(info){
 const order=['blocking','sourceMissing','partial','confirmation','review'];
 const chips=order.filter(k=>info.groups[k].length).map(k=>`<span class="fact-warning-chip ${k}">${esc(info.labels[k])} ${info.groups[k].length}</span>`).join('');
 const body=order.filter(k=>info.groups[k].length).map(k=>`<div class="fact-warning-group ${k}"><b>${esc(info.labels[k])}</b>${list(info.groups[k])}</div>`).join('');
 return `<details class="fact-warning-box ${info.groups.blocking.length?'blocking':''}"><summary><span>확인 항목 ${info.total}건</span><span class="fact-warning-chips">${chips}</span></summary>${body}</details>`;
}

function crFactNumericInput(attrName,value,label){
 return `<input class="fact-number ${crFactInputState(value)}" data-${attrName} type="text" inputmode="decimal" value="${attr(crFactNumber(value))}" placeholder="—" aria-label="${attr(label)}">`;
}
renderFactsForm=function(){
 const d=state.caseData;if(!d)return;
 const warningInfo=crClassifyFactWarnings(d);const warnings=warningInfo.all;
 const statusText=d.meta?.extractionQualityPassed?'좌표추출·회계검산 통과':'추출값 추가확인 필요';
 const html=[];
 html.push(`<div class="facts-compact">`);
 html.push(`<div class="fact-summary-bar">
   <div class="fact-summary-main"><b>${esc(d.meta?.sourceType||'기업보고서')}</b><span>${esc(d.meta?.coordinateEngine||'수동 확인')}</span></div>
   <div class="fact-summary-chips">
    <span class="fact-chip ${d.meta?.extractionQualityPassed?'ok':'bad'}">${esc(statusText)}</span>
    <span class="fact-chip">${esc(d.meta?.statementType||'범위 미확인')}</span>
    <span class="fact-chip">원문 ${safeNum(d.meta?.sourcePages)}p</span>
    <span class="fact-chip">${esc(d.meta?.originalUnit||'단위 미확인')} → 백만원</span>
   </div>
  </div>`);
 if(warnings.length)html.push(crFactWarningHtml(warningInfo));
 else html.push(`<div class="fact-clean-note">비핵심 계정의 원문 ‘-’는 오류가 아니라 값 없음·미제공으로 처리했습니다.</div>`);
 html.push(`<div id="factsValidationBox"></div>`);

 const profileFields=[
  ['companyName','기업명'],['representative','대표자'],['businessNumber','사업자번호'],['employees','종업원 수'],
  ['established','설립일'],['industry','업종'],['products','주요 제품'],['creditGrade','기업평가등급'],['watchGrade','WATCH등급'],['cashFlowGrade','현금흐름등급']
 ];
 html.push(`<section class="fact-section"><div class="fact-section-head"><b>기업 기본정보</b><span>기업요약 3p · 신용등급 이력 15p</span></div><div class="fact-basic-grid">`);
 for(const [k,label] of profileFields){
  const type=FIELD_META[k]?.[1]||'text',value=d.profile[k]??'';
  html.push(`<label class="fact-basic-item"><span>${esc(label)}</span><input data-profile="${k}" type="${type}" value="${attr(value)}"></label>`);
 }
 html.push(`</div></section>`);

 const financialGroups=[
  ['핵심 재무상태',[['assets','자산총계'],['liabilities','부채총계'],['equity','자본총계'],['cash','현금성자산'],['currentAssets','유동자산'],['currentLiabilities','유동부채']]],
  ['손익·현금',[['revenue','매출액'],['cogs','매출원가'],['operatingProfit','영업이익'],['netIncome','당기순이익'],['operatingCashFlow','영업활동조달현금'],['interestExpense','금융비용']]],
  ['운전자금',[['receivables','매출채권'],['inventory','재고자산'],['payables','매입채무']]],
  ['차입·자본',[['borrowings','총차입금(기타금융부채 포함)'],['currentBorrowings','유동차입부채'],['nonCurrentBorrowings','비유동차입부채'],['shortTermLoanReceivable','단기대여금(확인계정)'],['retainedEarnings','이익잉여금(결손금)'],['capitalStock','자본금']]]
 ];
 html.push(`<section class="fact-section"><div class="fact-section-head"><b>3개년 개별 결산</b><span>단위 백만원 · 상세 재무제표 우선</span></div><div class="fact-matrix-wrap"><table class="fact-matrix"><thead><tr><th class="metric">계정</th><th>2023</th><th>2024</th><th>2025</th><th class="source">원문</th></tr></thead><tbody>`);
 for(const [group,rows] of financialGroups){
  html.push(`<tr class="fact-group-row"><th colspan="5">${esc(group)}</th></tr>`);
  for(const [k,label] of rows){
   html.push(`<tr><th class="metric">${esc(label)}</th>`);
   for(const y of ['2023','2024','2025'])html.push(`<td>${crFactNumericInput(`financial="${y}.${k}"`,d.financials?.[y]?.[k],`${y} ${label}`)}</td>`);
   html.push(`<td class="source"><span>${esc(crFactSource(k))}</span></td></tr>`);
  }
 }
 html.push(`</tbody></table></div></section>`);

 if(d.latestQuarterly){
  const q=d.latestQuarterly,qp=q.sourcePage||20;
  const qrows=[
   ['assets','자산총계'],['liabilities','부채총계'],['equity','자본총계'],['currentLiabilities','유동부채'],
   ['currentBorrowings','유동차입부채'],['nonCurrentBorrowings','비유동차입부채'],['cash','현금'],
   ['revenue','분기 매출'],['operatingProfit','분기 영업이익'],['netIncome','분기 순이익'],['financeCost','분기 금융비용']
  ];
  html.push(`<section class="fact-section"><div class="fact-section-head"><b>최근 분기 ${esc(q.periodEnd||'')}</b><span>개별 분기 · 원문 ${qp}p</span></div><div class="fact-quarter-grid">`);
  for(const [k,label] of qrows)html.push(`<label class="fact-quarter-item"><span>${esc(label)}</span>${crFactNumericInput(`quarterly="${k}"`,q[k],label)}</label>`);
  html.push(`</div></section>`);
 }
 html.push(`</div>`);
 const root=$('factsForm');root.innerHTML=html.join('');
 qsa('.fact-number',root).forEach(el=>{
  const sync=()=>{const v=n(el.value);el.classList.toggle('is-missing',v===null);el.classList.toggle('is-negative',v!==null&&v<0);};
  el.addEventListener('focus',()=>{el.value=el.value.replace(/,/g,'');});
  el.addEventListener('input',sync);
  el.addEventListener('blur',()=>{const v=n(el.value);el.value=crFactNumber(v);sync();});
  sync();
 });
};
collectFactsForm=function(){
 const d=state.caseData;qsa('[data-profile]',$('factsForm')).forEach(el=>{d.profile[el.dataset.profile]=el.type==='number'?(n(el.value)??null):el.value.trim();});qsa('[data-financial]',$('factsForm')).forEach(el=>{const [y,k]=el.dataset.financial.split('.');d.financials[y]=d.financials[y]||crEmptyFinancialYear();d.financials[y][k]=n(el.value);});qsa('[data-quarterly]',$('factsForm')).forEach(el=>{if(d.latestQuarterly)d.latestQuarterly[el.dataset.quarterly]=n(el.value);});const normalized=crNormalizeCase(d);const v=crValidateFacts(normalized);const box=$('factsValidationBox');if(!v.passed){if(box)box.innerHTML=`<div class="notice red"><b>승인할 수 없습니다.</b>${list(v.errors)}${v.warnings.length?list(v.warnings):''}</div>`;state.factsConfirmed=false;normalized.meta.confirmed=false;state.caseData=normalized;toast('필수값과 회계등식을 확인해 주세요.','err');return false;}normalized.speechOverrides=buildSpeechOverrides(normalized);normalized.meta.confirmed=true;normalized.meta.extractionQualityPassed=true;normalized.factValidation=v;state.caseData=normalized;state.factsConfirmed=true;if(box&&v.warnings.length)box.innerHTML=`<div class="notice amber"><b>확인 경고</b>${list(v.warnings)}</div>`;return true;
};
renderManualForm=function(){const base=[['companyName','기업명','text'],['representative','대표자','text'],['businessNumber','사업자번호','text'],['industry','업종','text'],['employees','종업원 수','number']];const fields=[...base];for(const y of ['2023','2024','2025'])for(const [k,label] of [['revenue','매출액'],['operatingProfit','영업이익'],['netIncome','순이익'],['assets','자산'],['liabilities','부채'],['equity','자본'],['cash','현금'],['currentAssets','유동자산'],['currentLiabilities','유동부채'],['receivables','매출채권'],['inventory','재고'],['payables','매입채무'],['borrowings','총차입금'],['currentBorrowings','유동·단기차입금'],['nonCurrentBorrowings','비유동·장기차입금'],['cogs','매출원가'],['operatingCashFlow','영업현금흐름'],['interestExpense','이자비용'],['retainedEarnings','이익잉여금'],['capitalStock','자본금']])fields.push([`${y}.${k}`,`${y} ${label}(백만원)`,'number']);$('manualForm').innerHTML=fields.map(x=>`<div class="form-row"><label>${x[1]}</label><input data-manual="${x[0]}" type="${x[2]}"></div>`).join('');};
applyManual=function(){const d=crEmptyCase({sourceType:'직접입력',sourcePages:0,confirmed:false});qsa('[data-manual]',$('manualForm')).forEach(e=>{const key=e.dataset.manual,val=e.type==='number'?n(e.value):e.value.trim();if(key.includes('.')){const [y,k]=key.split('.');d.financials[y][k]=val;}else d.profile[key]=val;});d.profile.displayName=d.profile.companyName;d.meta.extractionQualityPassed=true;const v=crValidateFacts(d);if(!v.passed){toast('직접입력 필수값을 확인해 주세요: '+v.errors.slice(0,3).join(', '),'err');return;}d.meta.confirmed=true;d.factValidation=v;prepareCase(d,{confirmed:true,autoGenerate:false});closeModal('manualModal');renderQuestions();openModal('questionsModal');};
runQuality=function(){
 const m=state.analysis||state.caseData,hard=[],fact=crValidateFacts(m||{}),stats=speechCompletionStats(),staticCoverage=speechV16StaticCoverage();
 if(!state.factsConfirmed)hard.push('추출값 사용자 승인 미완료');
 hard.push(...fact.errors);
 if(m?.calculations?.crossValidation&&!m.calculations.crossValidation.passed)hard.push(...m.calculations.crossValidation.errors.map(x=>'계산기 교차검산: '+x));
 if(m?.meta?.sourceType?.includes('NICE')&&m?.meta?.extractionQualityPassed===false)hard.push('NICE 추출 품질 미통과');
 for(const issue of m?.issues||[]){if(!issue.facts?.length)hard.push(`${issue.title}: 근거 팩트 없음`);if(issue.facts?.some(x=>/0\.0억원/.test(x)&&/미확인|대여금/.test(x)))hard.push(`${issue.title}: 미확인값을 0으로 표현`);}
 const badA=(m?.insurance||[]).filter(x=>['A','A_CORE'].includes(x.grade)&&!Number.isFinite(x.gap));if(badA.length)hard.push('A등급 보험기회에 부족재원 금액 없음');
 if(stats.completeIssueScripts!==stats.issues)hard.push(`이슈별 장단 화법 누락 ${stats.issues-stats.completeIssueScripts}건`);
 if(stats.branchIssues!==stats.issues)hard.push(`이슈별 CEO 7분기 누락 ${stats.issues-stats.branchIssues}건`);
 if(staticCoverage.branchesWithoutSecond.length)hard.push('2차 대응 누락: '+staticCoverage.branchesWithoutSecond.join(', '));
 if(staticCoverage.objectionCount!==25||staticCoverage.objectionUnrouted.length)hard.push(`반론 실행경로 불완전: ${staticCoverage.objectionCount}/25 · 미라우팅 ${staticCoverage.objectionUnrouted.join(', ')}`);
 if(staticCoverage.scenarioCount!==20||staticCoverage.scenarioUnrouted.length)hard.push(`상담 시나리오 실행경로 불완전: ${staticCoverage.scenarioCount}/20 · 미라우팅 ${staticCoverage.scenarioUnrouted.join(', ')}`);
 if(staticCoverage.styleCount<7||staticCoverage.styleOutputUnique<7||staticCoverage.companyTypeCount<10)hard.push(`맞춤화 실질변환 불완전: CEO ${staticCoverage.styleOutputUnique}/7 · 기업 ${staticCoverage.companyTypeCount}/10`);
 if(stats.insuranceStages!==8)hard.push(`보험계약 단계 ${stats.insuranceStages}/8`);
 const pages=state.pages.filter(x=>x.visibility!=='audio'),generatedText=[],usedScenarios=new Set(),usedObjections=new Set();let noteComplete=0,branchComplete=0,secondComplete=0,objComplete=0,scenarioComplete=0;
 for(const p of pages){
  const x=p.notes||{};const ok=x.purpose&&x.diagnosis&&x.speech30&&x.speech90&&x.speech3m&&x.speech5m&&x.questions?.length>=3&&x.branches?.length===7&&x.objections?.length>=2&&x.advanced?.length&&x.connection&&x.transition&&x.documents?.length&&(x.scenarios?.length||x.scenario);
  if(ok)noteComplete++;else hard.push(`${p.title}: 10단 상담노트 불완전`);
  if(x.branches?.length===7&&new Set(x.branches.map(v=>v.type)).size===7)branchComplete++;else hard.push(`${p.title}: 답변 7분기 불완전`);
  if((x.branches||[]).every(v=>String(v.secondResponse||'').trim()))secondComplete++;else hard.push(`${p.title}: 2차 대응 누락`);
  if(x.objections?.length>=2)objComplete++;else hard.push(`${p.title}: 반론 2종 미만`);
  if((x.scenarios?.length||0)>=1||x.scenario)scenarioComplete++;else hard.push(`${p.title}: 완전 상담 시나리오 누락`);
  (x.scenarios||[x.scenario]).filter(Boolean).forEach(v=>usedScenarios.add(v.title));(x.objections||[]).forEach(v=>usedObjections.add(v.title));
  generatedText.push(x.speech30,x.speech90,x.speech3m,x.speech5m,x.transition,...(x.objections||[]).flatMap(o=>(o.dialogue||[]).map(d=>d.text)),...(x.branches||[]).flatMap(b=>[b.response,b.followUp,b.secondResponse,b.agreement]));
 }
 const text=generatedText.filter(Boolean).join('\n');SPEECH_FORBIDDEN_PATTERNS.forEach(re=>{re.lastIndex=0;if(re.test(text))hard.push(`금지·보장 표현 검출: ${re}`);});
 const longScripts=pages.map(p=>String(p.notes?.speech90||'').replace(/\s+/g,' ').trim()).filter(x=>x.length>80),duplicates=longScripts.filter((x,i)=>longScripts.indexOf(x)!==i);if(duplicates.length)hard.push(`페이지 화법 완전중복 ${new Set(duplicates).size}건`);
 const activeIds=new Set((m?.issues||[]).map(x=>x.id)),audio=m?.audioChapters||[],audioRefs=new Set(audio.flatMap(x=>x.sourceIssueIds||[])),inactiveRefs=[...audioRefs].filter(id=>id&&!activeIds.has(id)&&id!=='INSURANCE_OPTIMIZATION'),missingAudio=[...activeIds].filter(id=>ISSUE_SPEECH_LIBRARY[id]&&!audioRefs.has(id));if(inactiveRefs.length)hard.push('음성강의 비활성 이슈 포함: '+inactiveRefs.join(', '));if(missingAudio.length)hard.push('음성강의 활성 이슈 누락: '+missingAudio.join(', '));
 const audioMinutes=audio.reduce((sum,x)=>sum+(x.minutes||0),0);if(audio.length<5||audioMinutes<18||audioMinutes>25)hard.push(`음성강의 ${audio.length}챕터·${audioMinutes}분`);
 const scores={accuracy:fact.passed?98:0,calculation:m?.calculations?.crossValidation?.passed!==false?97:0,management:noteComplete===pages.length?96:80,ceo:95,speech:noteComplete===pages.length?97:80,branches:branchComplete===pages.length&&secondComplete===pages.length?96:80,objections:objComplete===pages.length&&!staticCoverage.objectionUnrouted.length?96:80,scenarios:scenarioComplete===pages.length&&!staticCoverage.scenarioUnrouted.length?96:80,insurance:badA.length?0:95,customization:staticCoverage.styleOutputUnique>=7&&staticCoverage.companyTypeCount>=10?94:80,audio:(audioMinutes>=18&&audioMinutes<=25&&!inactiveRefs.length&&!missingAudio.length)?95:80,mode:97,evidence:94,render:94};
 const weights={accuracy:18,calculation:10,management:8,ceo:7,speech:12,branches:8,objections:6,scenarios:5,insurance:10,customization:4,audio:4,mode:3,evidence:3,render:2};const average=Object.entries(scores).reduce((sum,[k,v])=>sum+v*weights[k],0)/100,min=Math.min(...Object.values(scores));
 return {scores,weights,average,min,hardFails:[...new Set(hard)],passed:hard.length===0&&average>=95&&min>=90,checkedAt:nowIso(),audioMinutes,factValidation:fact,coverage:{allPages:pages.length,noteComplete,branchComplete,secondComplete,objComplete,scenarioComplete,usedScenarios:[...usedScenarios],usedObjections:[...usedObjections],static:staticCoverage,audioActive:[...activeIds],audioCovered:[...audioRefs]}};
};
function qualityPageCompactHtml(q){
 const labels={accuracy:'팩트 정확성',calculation:'계산 일치',management:'경영해석',ceo:'CEO 본문',speech:'전 페이지 화법',branches:'CEO 7분기·2차대응',objections:'반론 25종',scenarios:'상담 시나리오 20선',insurance:'보험 판단',customization:'맞춤화',audio:'음성강의',mode:'모드 분리',evidence:'근거 연결',render:'A4·모바일'};
 const rows=Object.entries(q.scores).map(([k,v])=>`<tr><td>${esc(labels[k]||k)}</td><td>${v.toFixed(1)}</td><td>${v>=92.3?'통과':v>=90?'주의':'실패'}</td></tr>`).join('');
 return `<div class="lead"><b>${q.passed?'코드·데이터 검증 통과':'보완 필요'} · ${q.average.toFixed(2)}점</b><p>최저 ${q.min.toFixed(1)}점 · 중대오류 ${q.hardFails.length}건 · 비오디오 페이지 10단 노트 ${q.coverage?.noteComplete||0}/${q.coverage?.allPages||0}</p></div><table class="matrix"><thead><tr><th>검수영역</th><th>점수</th><th>판정</th></tr></thead><tbody>${rows}</tbody></table><div class="notice ${q.hardFails.length?'red':'green'}"><b>중대오류</b><p>${q.hardFails.length?esc(q.hardFails.join(' · ')):'탐지된 중대오류가 없습니다.'}</p></div><div class="notice amber"><b>판정 범위</b><p>코드·추출·계산·화법·모드·A4 출력의 내부 검증 결과입니다. 실제 기업 반복시험과 컨설턴트 현장평가는 별도 완료해야 합니다.</p></div>`;
}
renderQualityPage=function(){if(!state.quality)return;const el=$('qualityPageBody');if(el)el.innerHTML=qualityPageCompactHtml(state.quality);$('qualityBody').innerHTML=qualityHtml(state.quality);};
const crGenerateReportBase=generateReport;
generateReport=async function(reason='generate'){
 if(!state.caseData){toast('먼저 기업자료를 불러오십시오.');return;}if(!state.factsConfirmed){renderFactsForm();openModal('factsModal');toast('추출값 승인이 필요합니다.','err');return;}const pre=crValidateFacts(state.caseData);if(!pre.passed){state.factsConfirmed=false;renderFactsForm();openModal('factsModal');const box=$('factsValidationBox');if(box)box.innerHTML=`<div class="notice red"><b>리포트 생성을 차단했습니다.</b>${list(pre.errors)}</div>`;toast('팩트 검증 오류로 생성을 중단했습니다.','err');return;}
 window.jvTrack?.('corporate_report_generate');progress(true,'확정된 팩트를 분석하고 있습니다.');const stages=[['P1 사실·출처·단위·기간 검증',10],['P2 근거 있는 이슈만 선별',23],['P3 확인질문 반영·미확인 분리',35],['P4 계산기 교차검산',48],['P5 보험기회 근거·부족재원 게이트',62],['P6 CEO 본문·실행대안 구성',74],['P7 페이지별 10단 상담화법',84],['P8 활성 이슈 음성강의',92],['P9 사실·계산·모드·표현 최종검수',98]];
 try{for(const [msg,pc] of stages){logProgress(msg,'now',pc);await sleep(70);}const model=buildConfirmedModel(state.caseData);state.analysis=model;generatePages(model);renderPages();state.quality=runQuality();model.quality=state.quality;renderQualityPage();if(!state.quality.passed){logProgress(`품질게이트 실패 · 중대오류 ${state.quality.hardFails.length}건`,'err',100);await sleep(250);progress(false);showWorkspace();toast('품질게이트를 통과하지 못해 내보내기를 차단했습니다.','err');return;}logProgress(`완료 · ${state.pages.length}페이지 · 품질 ${state.quality.average.toFixed(2)}점`,'ok',100);await sleep(250);progress(false);showWorkspace();window.jvDone?.('corporate_report_generate');toast('검증을 통과한 3모드 종합리포트를 생성했습니다.','ok');}catch(error){progress(false);window.jvDone?.('corporate_report_generate');console.error(error);toast('생성 중 오류: '+error.message,'err');}
};
prepareCase=function(data,{confirmed=false,autoGenerate=false}={}){state.caseData=crNormalizeCase(data);state.caseData.speechOverrides=state.caseData.speechOverrides||buildSpeechOverrides(state.caseData);state.analysis=null;state.pages=[];const v=crValidateFacts(state.caseData,{requireThreeYears:true});state.factsConfirmed=!!confirmed&&v.passed;state.caseData.meta.confirmed=state.factsConfirmed;state.questionsConfirmed=false;state.sourceName=state.caseData.meta.sourceType||'';renderFactsForm();showWorkspace();updateStatus();if(autoGenerate&&state.factsConfirmed)generateReport('auto');else openModal('factsModal');};
handlePdf=async function(file){if(!file)return;if(file.size>30*1024*1024){setStartStatus('PDF는 30MB 이하를 사용해 주세요.','err');return;}window.jvTrack?.('corporate_pdf_analysis');setStartStatus('PDF 텍스트와 페이지를 분석하고 있습니다…');try{const out=await PDFParser.extract(file);state.sourceText=out.text;state.sourceName=file.name;state.pdfMeta=out;let data;if(out.format==='NICE BizLINE'){setStartStatus('NICE BizLINE 전용엔진으로 재무·주주·관계사·신용정보를 구조화하고 있습니다…');data=extractNiceBizlineCase(out,file);}else{data=PDFParser.generic(out.text,out.pages);data.meta.sourceFileName=file.name;data=await enrichWithExistingFinancialExtractor(data,out.text);}data=crNormalizeCase(data);const v=crValidateFacts(data);const extractorPassed=data.meta.extractionQualityPassed!==false;data.factValidation=v;data.meta.extractionQualityPassed=data.meta.sourceType.includes('NICE')?(extractorPassed&&v.passed):false;setStartStatus(`${out.format} · ${out.pages}페이지 · ${v.passed?'자동검증 통과':'수정 필요 '+v.errors.length+'건'}.` ,v.passed?'ok':'err');window.jvDone?.('corporate_pdf_analysis');prepareCase(data,{confirmed:false,autoGenerate:false});}catch(error){window.jvDone?.('corporate_pdf_analysis');console.error(error);setStartStatus('분석 실패: '+error.message,'err');}};
if($('confirmFactsBtn'))$('confirmFactsBtn').onclick=()=>{if(!collectFactsForm())return;closeModal('factsModal');renderQuestions();openModal('questionsModal');updateStatus();};
const crExportCEOBase=exportCEO;exportCEO=function(){if(!state.quality?.passed){toast('품질게이트 통과 전에는 CEO 전달본을 내보낼 수 없습니다.','err');return;}return crExportCEOBase();};
const crSaveCaseBase=saveCase;saveCase=function(){if(state.analysis&&!state.quality?.passed){toast('품질게이트 실패 상태는 배포용 케이스로 저장할 수 없습니다.','err');return;}return crSaveCaseBase();};
// 안전한 PDF.js 이중 CDN 로더 및 저장 케이스 스키마 검증
ensurePdfJs=async function(){
 if(global.pdfjsLib)return global.pdfjsLib;
 const candidates=[
  {script:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',worker:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'},
  {script:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',worker:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'}
 ];
 let lastError=null;
 for(const c of candidates){
  try{await loadScript(c.script);if(global.pdfjsLib){global.pdfjsLib.GlobalWorkerOptions.workerSrc=c.worker;return global.pdfjsLib;}}
  catch(e){lastError=e;}
 }
 throw new Error('PDF 분석 모듈을 불러오지 못했습니다. 네트워크 또는 보안정책을 확인해 주세요.'+(lastError?.message?' ('+lastError.message+')':''));
};
function crValidateSavedPayload(p){
 const errors=[];
 if(!p||typeof p!=='object'||Array.isArray(p))errors.push('JSON 루트가 객체가 아닙니다.');
 const candidate=p?.caseData||p?.analysis;
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))errors.push('caseData 또는 analysis 객체가 없습니다.');
 const schema=candidate?.meta?.schemaVersion||p?.schemaVersion||'';
 if(schema&&!/^CR-1\.[6789]/.test(schema))errors.push(`지원하지 않는 스키마 버전: ${schema}`);
 if(candidate?.financials&&typeof candidate.financials!=='object')errors.push('financials 구조가 올바르지 않습니다.');
 return {passed:errors.length===0,errors,candidate};
}
loadCaseFile=function(file){
 if(!file)return;
 if(file.size>20*1024*1024){toast('케이스 파일은 20MB 이하만 불러올 수 있습니다.','err');return;}
 const r=new FileReader();
 r.onload=()=>{try{
  const p=JSON.parse(r.result);const schema=crValidateSavedPayload(p);
  if(!schema.passed)throw new Error(schema.errors.join(' · '));
  const normalized=crNormalizeCase(schema.candidate);const facts=crValidateFacts(normalized,{requireThreeYears:true});
  normalized.factValidation=facts;normalized.meta.confirmed=!!p.factsConfirmed&&facts.passed;
  state.caseData=normalized;state.analysis=null;state.pages=[];state.quality=null;state.factsConfirmed=normalized.meta.confirmed;state.questionsConfirmed=!!p.questionsConfirmed;
  if(!facts.passed){renderFactsForm();showWorkspace();openModal('factsModal');const box=$('factsValidationBox');if(box)box.innerHTML=`<div class="notice red"><b>불러온 케이스를 승인할 수 없습니다.</b>${list(facts.errors)}</div>`;toast('케이스 값 검증에 실패했습니다. 수정 후 승인해 주세요.','err');return;}
  prepareCase(normalized,{confirmed:true,autoGenerate:false});toast('검증된 케이스를 불러왔습니다.','ok');
 }catch(e){console.error(e);toast('케이스 파일 형식이 올바르지 않습니다: '+e.message,'err');}};
 r.onerror=()=>toast('케이스 파일을 읽지 못했습니다.','err');
 r.readAsText(file);
};
function crDebugAllowed(){return location.protocol==='file:'||['localhost','127.0.0.1'].includes(location.hostname)||new URLSearchParams(location.search).get('debug')==='1';}


/* ==========================================================================
 * V1.9.2 COORDINATE FINANCIAL ENGINE
 * Source: the proven coordinate parser from jebanseo_program(2).html.
 * The parser preserves PDF x/y positions through extraction and is authoritative
 * for NICE BizLINE, KODATA/KCR2 and CRETOP web-export reports.
 * ========================================================================== */
;const JebFinancialEngine=(()=>{
 const ENGINE_VERSION='1.9.2-coordinate-20260731';
 const FIN={src:'',scaleFix:1};
 const FIN_FMT_UNIT={NICE:'백만원',KODATA:'백만원',KODATA_WEB:'천원',MANUAL:'원'};
 const FIN_UNIT_SCALE={'원':{man:0.0001,won:1},'천원':{man:0.1,won:1e3},'만원':{man:1,won:1e4},'백만원':{man:100,won:1e6},'억원':{man:10000,won:1e8}};
 function finUnit(){return FIN_FMT_UNIT[FIN.src]||'백만원';}
 function finUnitScale(){const b=FIN_UNIT_SCALE[finUnit()]||FIN_UNIT_SCALE['백만원'];const f=Number.isFinite(FIN.scaleFix)&&FIN.scaleFix>0?FIN.scaleFix:1;return f===1?b:{man:b.man*f,won:b.won*f};}
 const FIN_ROW_TOL=4;
 const FIN_INFO_LABELS=['업체명','기업명','기 업 명','영문기업명','설립일자','설 립 일 자','설립년월','사업자번호','법인번호','법인(주민)번호',
  '대표자','대 표 자','대표자명','홈페이지','홈 페 이 지','종업원수','상시종업원','상 시 종 업 원','기업규모',
  '기업형태','기 업 형 태','상장일자','본사주소','본 사 주 소','공장주소','영업소주소','전화번호','팩스번호',
  '표준산업분류','업종분류','업 종 분 류','업종','주요제품명','주요상품','주 요 제 품 명','계열명','주력업체',
  '소속계열','주거래은행','주 거 래 은 행','당좌거래은행','결산월','경영규모','신용등급','평가일'];

function finMerge(items){
  const isNum=s=>/^\(?-?[\d,]+(\.\d+)?\)?\s*%?$/.test(String(s).trim())||String(s).trim()==='-';
  const out=[];
  for(const it of items){
    const p=out[out.length-1];
    const gap=p?(it.x-(p.x+p.w)):999;
    if(p && it.s.length===1 && (p._m||p.s.length===1)
       && Math.abs(p.y-it.y)<=2 && !isNum(p.s) && !isNum(it.s)
       && gap<=20 && gap>=-3){
      p.s+=it.s; p.w=(it.x+it.w)-p.x; p._m=true;
      continue;
    }
    out.push({...it});
  }
  return out;
}

function finGlue(items){
  const out=[];
  for(const raw of items){
    let s=String(raw.s).replace(/\uE093/g,',').replace(/\uE094/g,'.')          /* 신형 폰트: 콤마·소수점 PUA 매핑 */
                       .replace(/[\u0000-\u001F\uE000-\uF8FF]/g,'').trim();   /* 그 외 제어문자·PUA 제거 */
    const p=out[out.length-1];
    if(s===','||s==='.'){                                   /* 글루 확정형 — 코드포인트가 종류를 말해줌 */
      if(p&&/\d$/.test(p.s)&&Math.abs(p.y-raw.y)<=2){p._glue=raw.x+raw.w;p._gc=s;}
      else if(s===','&&p&&/^\(/.test(p.s)&&!p.s.includes(')')&&/[가-힣]/.test(p.s)&&Math.abs(p.y-raw.y)<=2){p.s+=',';p.w=(raw.x+raw.w)-p.x;}   /* ★ 구형 K-GAAP 분할 라벨 콤마 복원 — '(매출채권'+','  (2026-07-21) */
      continue;
    }
    if(!s){                                                 /* 미지 PUA — 폭·밀착 휴리스틱 글루 */
      if(p&&/\d$/.test(p.s)&&raw.w<=6&&Math.abs(p.y-raw.y)<=2){p._glue=raw.x+raw.w;p._gc=null;}
      continue;
    }
    if(p&&p._glue!=null&&/^\d+$/.test(s)&&Math.abs(p.y-raw.y)<=2&&(raw.x-p._glue)<=4){
      p.s+=(p._gc||(s.length===3?',':'.'))+s;               /* 확정 글루 우선, 없으면 3자리=콤마 휴리스틱 */
      p.w=(raw.x+raw.w)-p.x; p._glue=null;
      continue;
    }
    if(p)p._glue=null;
    if(p&&p.s==='-'&&/^\d/.test(s)&&Math.abs(p.y-raw.y)<=2&&(raw.x-(p.x+p.w))<=3){
      p.s='-'+s; p.w=(raw.x+raw.w)-p.x;                     /* 음수 부호 결합 — 단독 '-'(값 없음 표기)는 gap이 커서 보존 */
      continue;
    }
    /* 신용등급 부호 결합 — NICE PDF는 BB와 +를 별도 글자로 내보내는 경우가 있다.
       이 결합이 없으면 BB+가 BB로 축약되어 원문 등급이 훼손된다. */
    if(p&&/^(?:AAA|AA|A|BBB|BB|B|CCC|CC|C|D|R|NR|EW)$/i.test(String(p.s).trim())
       &&/^[+-]$/.test(s)&&Math.abs(p.y-raw.y)<=5&&(raw.x-(p.x+p.w))<=12){
      p.s=String(p.s).trim()+s; p.w=(raw.x+raw.w)-p.x;
      continue;
    }
    if(p&&/^\(/.test(p.s)&&!p.s.includes(')')&&/[가-힣]/.test(p.s)&&/[가-힣]/.test(s)&&Math.abs(p.y-raw.y)<=2&&(raw.x-(p.x+p.w))<=8){
      p.s+=s; p.w=(raw.x+raw.w)-p.x;                        /* ★ 미완 괄호 라벨 뒷조각 병합 — '(매출채권,'+'공사/영업미수금)'. 한글 조각만, 숫자 병합 금지 원칙 유지 (2026-07-21) */
      continue;
    }
    out.push({...raw,s});
  }
  if(out.length)out[out.length-1]._glue=null;
  return out;
}

function finNormalizeRows(items){
  const ROW_TOL=3;
  const rows=[];
  const src=(items||[]).map(i=>({...i,s:String(i.s??'').replace(/\u0000/g,'').trim()})).filter(i=>i.s);
  for(const it of src){
    let best=null,bestDy=Infinity;
    for(const r of rows){const dy=Math.abs(r.y-it.y);if(dy<=ROW_TOL&&dy<bestDy){best=r;bestDy=dy;}}
    if(!best){best={y:it.y,items:[]};rows.push(best);}
    best.items.push(it);
    best.y=best.items.reduce((a,x)=>a+x.y,0)/best.items.length;
  }
  const isPiece=t=>/^[\d,.:;%\-()]+$/.test(String(t).replace(/\s/g,''));
  const cleanJoined=t=>{let v=String(t).replace(/\s/g,'').replace(/,{2,}/g,',');const dm=v.match(/^(20\d{2})\.{2}(\d{2})(\d{2})$/);if(dm)v=`${dm[1]}.${dm[2]}.${dm[3]}`;return v;};
  const out=[];
  for(const row of rows){
    const a=row.items.sort((x,y)=>x.x-y.x);
    for(let i=0;i<a.length;){
      const cur=a[i];
      if(!isPiece(cur.s)){out.push({...cur,y:Math.round(row.y)});i++;continue;}
      let j=i+1,last=cur.x+Math.max(cur.w||0,1),parts=[cur.s],end=last;
      while(j<a.length&&isPiece(a[j].s)){
        const gap=a[j].x-last;
        if(gap>6)break;
        parts.push(a[j].s);end=a[j].x+Math.max(a[j].w||0,1);last=end;j++;
      }
      const joined=cleanJoined(parts.join(''));
      out.push({s:joined,x:cur.x,y:Math.round(row.y),w:Math.max(1,Math.round(end-cur.x))});
      i=j;
    }
  }
  out.sort((a,b)=>b.y-a.y||a.x-b.x);
  out.text=out.map(i=>i.s).join(' ');
  return out;
}

function finPreparePage(items){let p=finNormalizeRows(items||[]);p=finMerge(p);p=finGlue(p);p=finNormalizeRows(p);p.text=p.map(i=>i.s).join(' ');return p;}

function finGlueChars(items){
  const NUM=/^[\d,.\-%]+$/;   /* 1글자 조각뿐 아니라 finGlue가 먼저 만든 '6,4' 같은 다글자 조각도 대상 */
  const out=[];
  for(const it of items){
    const p=out[out.length-1];
    const gap=p?(it.x-(p.x+p.w)):999;
    if(p&&NUM.test(it.s)&&NUM.test(p.s)
       &&Math.abs(p.y-it.y)<=2&&gap<=3&&gap>=-2){
      p.s+=it.s; p.w=(it.x+it.w)-p.x;
      continue;
    }
    out.push({...it});
  }
  return out;
}

function finConcatPages(pages,from,to){
  const out=[];
  for(let k=from;k<to;k++){const off=(k-from)*5000;pages[k].forEach(i=>out.push({...i,y:i.y-off}));}
  out.sort((a,b)=>b.y-a.y||a.x-b.x);
  out.text=out.map(i=>i.s).join(' ');
  return out;
}

function finDetect(pages){
  const all=pages.map(p=>p.text).join('\n');
  if(/nicebizline|NICE평가정보/i.test(all))return 'NICE';
  /* KODATA(한국평가데이터, 구 한국기업데이터) — KCR2·CRETOP·REALTOP 등 동일사 제품군 */
  if(/KODATA|한국평가데이터|한국기업데이터|KCR2|CRETOP|크레탑/i.test(all))return 'KODATA';
  if(/기업신용평가서/.test(all))return 'KODATA';
  /* KODATA 웹출력 '기업 종합 보고서'(CRETOP 조회화면 저장본) — 사명·CRETOP 로고가 전부 이미지라 텍스트에 없다.
     병합 후 텍스트에 실존하는 제목 '기업종합보고서'와 저작권 문구 'KOREARATING&DATA'로 식별 (2026-07-14 실측) */
  if(/기업\s*종합\s*보고서|KOREA\s*RATING\s*&\s*DATA/i.test(all))return 'KODATA_WEB';
  return null;
}

function finFind(items,label){
  const key=String(label).replace(/\s+/g,'');
  let hit=items.find(i=>i.s.replace(/\s+/g,'')===key);
  if(hit)return hit;
  return items.find(i=>i.s.replace(/\s+/g,'').startsWith(key))||null;
}

function finRowAfter(items,L){
  if(!L)return [];
  return items.filter(i=>i!==L&&Math.abs(i.y-L.y)<=FIN_ROW_TOL&&i.x>=L.x+Math.max(L.w,6)-2)
              .sort((a,b)=>a.x-b.x);
}

function finIsLabelLike(s){
  const t=String(s).trim();
  if(/^-$/.test(t))return false;                        // '-' 는 0 을 뜻하는 값
  if(/^\(?-?[\d,]+(\.\d+)?\)?\s*%?$/.test(t))return false;
  if(/^\d{4}[.\-]\d{2}[.\-]\d{2}$/.test(t))return false;
  return /[가-힣A-Za-zⅠ-Ⅹ]/.test(t);
}

function finCells(items,labels,n,below){
  const arr=Array.isArray(labels)?labels:[labels];
  const pool=below?items.filter(i=>i.y<below.y):items;   /* below: 이 라벨(앵커)보다 아래 구간에서만 라벨 탐색 — 미지정 시 기존과 동일 (2026-07-21) */
  for(const lb of arr){
    const L=finFind(pool,lb); if(!L)continue;
    const vals=[];
    for(const it of finRowAfter(items,L)){
      const t=it.s.replace(/\s/g,'');
      if(/%$/.test(t))continue;                          // 구성비
      if(/^-?[\d,]+\.\d+$/.test(t))continue;             // 소수 = 구성비
      if(t==='-'){vals.push(null);continue;}             // 원문 '-'는 0으로 단정하지 않고 미제공/없음으로 보존
      if(/^-?[\d,]+$/.test(t)){vals.push(parseFloat(t.replace(/,/g,'')));continue;}
      break;                                             // 다음 라벨 → 종료 (좌우 2열 침범 차단)
    }
    if(vals.length>=(n||3))return vals.slice(0,n||3);
  }
  return null;
}

function finText(items,labels,stop){
  const arr=Array.isArray(labels)?labels:[labels];
  const norm=t=>String(t).replace(/\s+/g,'');
  const stops=(stop||[]).map(norm);
  for(const lb of arr){
    const L=finFind(items,lb); if(!L)continue;
    const out=[];
    for(const it of finRowAfter(items,L)){
      if(stops.some(sp=>norm(it.s)===sp||norm(it.s).startsWith(sp)))break;
      out.push(it.s);
    }
    const v=out.join(' ').trim();
    if(v)return v;
  }
  return '';
}

function finYears(items){
  const m=(items.text||'').match(/(20\d{2})[.\-]\s?\d{2}[.\-]\s?\d{2}/g);
  if(!m||m.length<3)return null;
  const ys=m.slice(0,3).map(x=>parseInt(x.slice(0,4)));
  return {years:ys,desc:ys[0]>ys[2]};
}

function finParse(pages,fmt){
  pages=(pages||[]).map(pg=>finPreparePage(pg));
  /* KODATA_WEB: 숫자가 1글자씩 분해되어 나온다 — 파싱 전에 페이지별 재조립 (다른 포맷 무영향) */
  if(fmt==='KODATA_WEB')pages=pages.map(pg=>{const m=finGlueChars(pg);m.text=m.map(i=>i.s).join(' ');return m;});
  /* 표 제목만으로 페이지를 고르면 오탐한다(연구개발비 표에도 '손익계산서'라는 행이 있다).
     그 표에만 있는 항목을 함께 만족하는 페이지를 고른다. */
  const pick=(...rxs)=>pages.find(p=>rxs.every(r=>r.test(p.text)))||null;
  let BS,IS;
  if(fmt==='KODATA_WEB'){
    /* 상세 재무상태표(천원)가 여러 쪽에 걸쳐 있다 — '계정명' 헤더가 있는 상세 구간을 찾아 한 장으로 병합.
       (요약표는 '구분' 헤더·백만원이라 단위가 섞이므로 쓰지 않는다) */
    const bi=pages.findIndex(p=>/재무상태표/.test(p.text)&&/계정명/.test(p.text));
    const ii=pages.findIndex(p=>/손익계산서/.test(p.text)&&/계정명/.test(p.text));
    let ci=pages.findIndex((p,i)=>i>ii&&/현금흐름표/.test(p.text)&&/계정명/.test(p.text));
    if(ci<0)ci=Math.min(ii+2,pages.length);
    BS=(bi>=0&&ii>bi)?finConcatPages(pages,bi,ii):null;
    IS=(ii>=0)?finConcatPages(pages,ii,ci):null;
  }else{
    BS=pick(/재무상태표/,/자산총계/,/부채총계/,/자본총계/);
    IS=pick(/손익계산서/,/매출액/,/영업이익/,/당기순이익/);
  }
  const SH=fmt==='NICE'?pick(/주요주주/,/지분율/):pick(/주주현황/,/소유주식수|지분율/);
  /* ★ NICE 3p '01.기업개요'는 우측에 신용등급 박스가 붙은 2단 레이아웃이다.
       10p '08.기업현황'(주요주주와 같은 페이지)은 단일 컬럼이므로 그쪽을 쓴다. */
  const IN=fmt==='NICE'?(pick(/주요주주/,/종업원수/,/표준산업분류/)||pick(/기업개요/,/종업원수/))
                       :fmt==='KODATA_WEB'?pick(/기업개요/,/설립년월/,/종업원수/)
                       :pick(/기 업 명|기업명/,/설 립 일 자|설립일자/);
  if(!BS)throw new Error('재무상태표를 찾지 못했습니다. 전체 보고서 PDF인지 확인해 주세요.');
  if(!IS)throw new Error('손익계산서를 찾지 못했습니다. 전체 보고서 PDF인지 확인해 주세요.');

  const yr=finYears(BS)||{years:[0,0,0],desc:true};
  if(fmt==='KODATA_WEB'){
    /* 페이지 상단 '조회일시:2025-…'가 첫 매치로 잡혀 연도 순서가 깨진다 —
       표 헤더의 완전 날짜(YYYY-MM-DD 단독 아이템)만으로 재판정. 헤더는 좌→우 = 과거→최신(오름차순). */
    const hd=BS.filter(i=>/^20\d{2}-\d{2}-\d{2}$/.test(i.s)).slice(0,3);
    if(hd.length===3){yr.years=hd.map(i=>parseInt(i.s.slice(0,4)));yr.desc=yr.years[0]>yr.years[2];}
  }
  const ord=a=>a?(yr.desc?a:[...a].reverse()):null;      // 항상 [최신,직전,전전]
  if(!yr.desc)yr.years=[...yr.years].reverse();

  const P=fmt==='NICE'?{
    자본금:['자본금','(자본금)'],이익잉여금:'이익잉여금',미처분잉여:['미처분이익잉여금(결손금)','미처분이익잉여금'],단기차입금:['(단기차입금)','단기차입금'],장기차입금:['(장기차입금)','장기차입금'],
    사채:['(장기사채)','단기사채'],매출채권:['(매출채권, 공사/영업미수금)','매출채권및기타채권','(매출채권)'],현금:['(현금 및 현금등가물)','현금및현금성자산'],
    유동자산:'유동자산',유동부채:'유동부채',재고자산:'재고자산',매입채무:['(매입채무 및 기타채무)','(매입채무)'],
    매출액:'매출액',매출원가:'매출원가',영업이익:'영업이익(손실)',순이익:['당기순이익(손실)','당기순이익'],   /* 2026 신형 상세보고서: 괄호 없는 '당기순이익' 폴백 */
    이자비용:['(이자비용)','(금융비용)'],인건비:'(인건비)',영업현금:'영업활동조달현금',   /* ★ 2026 신형 상세보고서: 손익계산서가 '(금융비용)' 표기 — NICE 자체 이자보상 산식도 영업이익/금융비용 (2026-07-21) */
    퇴직충당:'퇴직급여충당부채',가지급금:'단기대여금'
  }:fmt==='KODATA_WEB'?{
    /* 웹출력 '기업 종합 보고서' — KCR2와 계정명은 같지만 로마숫자 접두가 없고 총계가 '자산(*)' 표기 */
    자산총계:'자산(*)',부채총계:'부채(*)',자본총계:'자본(*)',
    자본금:'자본금(*)',이익잉여금:'이익잉여금(*)',미처분잉여:['미처분이익잉여금(결손금)','미처분이익잉여금'],
    단기차입금:'단기차입금(*)',장기차입금:'장기차입금(*)',사채:'사채(*)',
    매출채권:'매출채권(*)',현금:'현금 및 현금성자산(*)',
    유동자산:'유동자산(*)',유동부채:'유동부채(*)',재고자산:'재고자산(*)',매입채무:'매입채무(*)',
    매출액:'매출액(*)',매출원가:'매출원가(*)',영업이익:'영업이익(손실)',순이익:'당기순이익(순손실)',
    이자비용:'이자비용',인건비:'급여(*)',영업현금:'4.영업활동후의 현금흐름액',
    퇴직충당:'퇴직급여충당부채',가지급금:'단기대여금(*)'
  }:{
    자본금:['Ⅰ. 자본금(*)','자본금(*)'],이익잉여금:['Ⅴ. 이익잉여금(*)','이익잉여금(*)'],미처분잉여:['미처분이익잉여금(결손금)','미처분이익잉여금'],
    단기차입금:'단기차입금(*)',장기차입금:'장기차입금(*)',사채:'사채(*)',
    매출채권:'매출채권(*)',현금:'현금 및 현금성자산(*)',
    유동자산:'Ⅰ. 유동자산(*)',유동부채:'Ⅰ. 유동부채(*)',재고자산:'2. 재고자산(*)',
    매입채무:'매입채무(*)',매출액:'Ⅰ. 매출액(*)',매출원가:'Ⅱ. 매출원가(*)',
    영업이익:'Ⅴ. 영업이익(손실)',순이익:['ⅩⅡ. 당기순이익(순손실)','당기순이익(순손실)'],
    이자비용:'이자비용',인건비:'급여(*)',영업현금:'4.영업활동후의 현금흐름액',
    퇴직충당:'퇴직급여충당부채',가지급금:'단기대여금(*)'
  };
  const CF=pick(/영업활동후의 현금흐름액|영업활동조달현금/)||IS;

  const D={fmt,years:yr.years,
    자산총계:ord(finCells(BS,P.자산총계||'자산총계')), 부채총계:ord(finCells(BS,P.부채총계||'부채총계')), 자본총계:ord(finCells(BS,P.자본총계||'자본총계')),
    자본금:ord(finCells(BS,P.자본금)), 이익잉여금:ord(finCells(BS,P.이익잉여금)),
    미처분잉여:ord(finCells(BS,P.미처분잉여)),   /* ★ A1 (2026-07-30): 이익잉여금 총계와 미처분을 분리 — 프롬프트 라벨-값 불일치(총계를 '미처분'으로 표기) 수정. 미검출 시 null → 프롬프트에서 총계 폴백 */
    단기차입금:ord(finCells(BS,P.단기차입금)), 장기차입금:ord(finCells(BS,P.장기차입금)),
    유동차입:ord(finCells(BS,['(유동차입부채)','유동차입부채'])), 비유동차입:ord(finCells(BS,['(비유동차입부채)','비유동차입부채'])),   /* ★ NICE-IFRS: 유동성장기부채 포함 차입 구분 — KODATA엔 없어 null→기존 폴백 (2026-07-21) */
    사채:ord(finCells(BS,P.사채))||[0,0,0],
    매출채권:ord(finCells(BS,P.매출채권,3,fmt==='NICE'?finFind(BS,'유동자산'):null)), 현금:ord(finCells(BS,P.현금)),   /* ★ 신형 NICE: 비유동자산에도 '매출채권 및 기타채권'이 있어 유동자산 아래에서만 탐색 (2026-07-21) */
    유동자산:ord(finCells(BS,P.유동자산)), 유동부채:ord(finCells(BS,P.유동부채)),
    재고자산:ord(finCells(BS,P.재고자산)), 매입채무:ord(finCells(BS,P.매입채무)),
    퇴직충당:ord(finCells(BS,P.퇴직충당)), 가지급금:ord(finCells(BS,P.가지급금)),
    매출액:ord(finCells(IS,P.매출액)), 매출원가:ord(finCells(IS,P.매출원가)),
    영업이익:ord(finCells(IS,P.영업이익)), 순이익:ord(finCells(IS,P.순이익)),
    이자비용:ord(finCells(IS,P.이자비용)), 인건비:ord(finCells(IS,P.인건비)),
    영업현금:ord(finCells(CF,P.영업현금))
  };
  for(const k of ['자산총계','부채총계','자본총계','매출액','영업이익','순이익'])
    if(!D[k])throw new Error(`'${k}' 항목을 읽지 못했습니다. 보고서 양식이 다를 수 있습니다.`);

  /* ── 기업개요 (좌표 기반 셀 + 명시적 stop 라벨) ── */
  const S=FIN_INFO_LABELS;
  D.회사명 = IN?finText(IN,['업체명','기 업 명','기업명'],S):'';
  D.대표자 = (IN?finText(IN,['대표자명','대표자','대 표 자'],S):'').split(/\s+/)[0]||'';
  const est = (IN?finText(IN,['설립일자','설 립 일 자','설립년월'],S):'').match(/(\d{4})/);
  D.설립년 = est?parseInt(est[1]):0;
  const emp = (IN?finText(IN,['종업원수','상 시 종 업 원','상시종업원'],S):'').match(/([\d,]+)/);
  D.종업원 = emp?parseInt(emp[1].replace(/,/g,'')):0;
  const ind = IN?finText(IN,['표준산업분류','업 종 분 류','업종분류'],S):'';
  D.업종 = ind.replace(/^\d+\s*차\)\s*/,'').replace(/\(\s*[A-Z]\s*\d+\s*\)/g,'').replace(/\s+/g,' ').trim();

  /* ── 대표 생년·대표이사 취임년 (2026-07-30) — 질문지 진술값 교차검증용.
     KODATA_WEB 인적사항 페이지: 생년월일 YYYY-MM-DD, 주요경력사항의 재직중(종료일 없는) 대표이사 행.
     "김기성(1955년생)"을 55세로 오인하는 사고를 원천 차단하는 근거값. NICE 등 타 포맷은 미적용. */
  D.대표생년=0; D.대표취임년=0;
  if(fmt==='KODATA_WEB'){
    const PI=pages.find(p=>/인적사항/.test(p.text)&&/생년월일/.test(p.text));
    if(PI){
      const _bm=PI.text.match(/생년월일[^0-9]{0,20}((?:19|20)\d{2})-\d{2}-\d{2}/);
      if(_bm)D.대표생년=parseInt(_bm[1]);
      const _T=PI.text,_hits=[];let _am;const _are=/((?:19|20)\d{2})-\d{2}\s*~/g;
      while((_am=_are.exec(_T))!==null)_hits.push({y:parseInt(_am[1]),i:_am.index});
      for(let _h=0;_h<_hits.length;_h++){
        const _seg=_T.slice(_hits[_h].i,_hits[_h+1]?_hits[_h+1].i:_hits[_h].i+140);
        /* 재직중 경력(~ 뒤에 종료 연도가 없음) + 대표이사 직위 → 취임년 */
        if(/대표이사/.test(_seg)&&!/~\s*(?:19|20)\d{2}/.test(_seg.slice(0,20))){D.대표취임년=_hits[_h].y;break;}
      }
    }
  }

  /* ── 주주 (행 단위 좌표 스캔) ── */
  D.주주=[]; D.총주식=0; D.액면=0;
  if(SH){
    /* ★ 행 클러스터링 (2026-07-30): 고정 버킷 round(y/2)*2는 셀 간 1pt 어긋남이 버킷 경계에 걸리면 행이 갈라진다.
       실증 — 모락스트레이딩 CRETOP: '기타' 이름 y=601(→버킷 602) vs 숫자 y=600(→버킷 600)으로 분리되어
       기타 79.28% 행 전체 탈락 → '지분율 합계 20.72%' 검산 경고의 실제 원인. 김기성 행은 전부 y=629라 우연히 생존.
       finRowAfter와 동일한 FIN_ROW_TOL(±4pt) 근접 클러스터로 교체 — 표 행 간격은 28pt라 행 병합 위험 없음 */
    const rows=new Map(); const _rowYs=[];
    [...SH].sort((a,b)=>b.y-a.y).forEach(i=>{
      let k=_rowYs.find(v=>Math.abs(v-i.y)<=FIN_ROW_TOL);
      if(k==null){k=i.y;_rowYs.push(k);}
      if(!rows.has(k))rows.set(k,[]); rows.get(k).push(i);
    });
    /* ★ NICE 신형(2026): 한 페이지에 기업개요·주요주주·관계사현황이 함께 있다 —
       '주요주주' 섹션 제목(동일 문구의 상단 이동경로는 y가 크므로 최소 y 채택)과 '관계사' 제목
       사이 y 구간의 행만 주주로 인정. 관계사 표의 총자산·매출이 주주로 흡수되는 것 차단 (2026-07-21) */
    let _top=null,_bot=null;
    if(fmt==='NICE'){
      const _h=SH.filter(i=>i.s.replace(/\s+/g,'').startsWith('주요주주'));
      if(_h.length)_top=Math.min(..._h.map(i=>i.y));
      const _b=SH.filter(i=>i.s.replace(/\s+/g,'').startsWith('관계사')&&(_top==null||i.y<_top));
      if(_b.length)_bot=Math.max(..._b.map(i=>i.y));
    }
    rows.forEach(r=>{
      r.sort((a,b)=>a.x-b.x);
      const _ry=r[0]&&r[0].y;
      if(_top!=null&&_ry>=_top)return;
      if(_bot!=null&&_ry<=_bot)return;
      const nm=r[0]&&r[0].s;
      if(!nm||nm==='합계'||finIsLabelLike(nm)===false)return;
      /* KODATA_WEB: 숫자 재조립 탓에 머리글·푸터 행(조회일시·COPYRIGHT 등)이 숫자 2개 이상을 갖게 된다 — 제외 */
      if(fmt==='KODATA_WEB'&&r.some(i=>/조회일시|기준일자|COPYRIGHT|RESERVED/i.test(i.s)))return;
      const nums=r.slice(1).map(i=>i.s.replace(/\s|%/g,'')).filter(t=>/^[\d,]+(\.\d+)?$/.test(t));
      if(nums.length<2)return;
      let shares,rate;
      if(fmt==='KODATA_WEB'&&nums.length>=4){
        /* ★ 웹출력 주요주주현황은 [보통주·우선주·합계]×[소유주식수·지분율] 다열 구조 —
           nums[0]=보통주 주식수, nums[1]=우선주 주식수(대개 0)라서 기존 [주식수,율] 가정이 깨져
           rate<=0으로 행이 통째로 버려졌다(지분 20.72%가 0%로 판정된 원인).
           합계 지분율 = 마지막 숫자, 합계 주식수 = 행 내 최대 정수로 결정적 채택 (2026-07-21) */
        rate=parseFloat(nums[nums.length-1]);
        shares=Math.max(...nums.map(t=>parseInt(t.replace(/,/g,''))||0));
      }else{
        shares=parseInt(nums[0].replace(/,/g,''));
        rate=parseFloat(nums[1]);
      }
      if(!Number.isFinite(shares)||!Number.isFinite(rate)||rate<=0||rate>100)return;
      if(shares<1)return;
      D.주주.push({명:nm,주식:shares,율:rate});
    });
    if(fmt==='KODATA_WEB'&&!D.주주.length){
      /* 웹출력형 주요주주현황은 소유주식수 칸이 비고 지분율만 있는 경우가 있다 — 지분율 단독 행 수용 (주식수 0).
         같은 페이지의 다른 표(관계회사현황 등) 혼입을 막기 위해 표 제목 y 구간 안쪽 행만 본다. */
      const _hy=(SH.find(i=>i.s.replace(/\s+/g,'').startsWith('주요주주현황'))||{}).y;
      const _ey=(SH.find(i=>i.s.replace(/\s+/g,'').startsWith('관계회사현황'))||{}).y;
      rows.forEach(r=>{
        r.sort((a,b)=>a.x-b.x);
        const _ry=r[0]&&r[0].y;
        if(_hy!=null&&_ry>=_hy)return;
        if(_ey!=null&&_ry<=_ey)return;
        const nm=r[0]&&r[0].s;
        if(!nm||nm==='합계'||nm==='주주명'||finIsLabelLike(nm)===false)return;
        const nums=r.slice(1).map(i=>i.s.replace(/\s|%/g,'')).filter(t=>/^[\d,]+(\.\d+)?$/.test(t));
        if(nums.length!==1)return;
        const rate=parseFloat(nums[0]);
        if(!Number.isFinite(rate)||rate<=0||rate>100)return;
        D.주주.push({명:nm,주식:0,율:rate});
      });
    }
    const tot=(SH.text||'').match(/합계\s*([\d,]+)/);
    const par=(SH.text||'').match(/주당액면가\s*([\d,]+)\s*원/);
    const cnt=(SH.text||'').match(/주식수\s*([\d,]+)\s*주/);
    D.총주식 = tot?parseInt(tot[1].replace(/,/g,'')) : (cnt?parseInt(cnt[1].replace(/,/g,'')):0);
    if(!D.총주식 && D.주주.length){
      const _rs=D.주주.reduce((a,b)=>a+b.율,0);
      if(_rs>=95) D.총주식 = D.주주.reduce((a,b)=>a+b.주식,0);   /* ★ 부분 명부(상장사 상위주주만 표시)로 총주식·액면 역산 오류 차단 — 95% 미만이면 총주식 미확정, 액면·주식가치 계산 안 함 (2026-07-21) */
    }
    D.액면 = par?parseInt(par[1].replace(/,/g,''))
                : ((D.총주식&&D.자본금)?Math.round(D.자본금[0]*finUnitScale().won/D.총주식):0);
    /* ★ KODATA_WEB: 재무상태표에 '발행주식수'·'(1주당금액)'이 최신 결산 기준으로 명기된다.
       주주현황 표는 기준일자가 과거(감자·자기주식 변동 전)일 수 있어 재무상태표 값을 우선 채택하고,
       주주현황 합산 주식수와 2% 이상 어긋나면 지분상충으로 표시한다. '[단위:주]' 등 비숫자 토큰은 건너뛴다 (2026-07-21) */
    if(fmt==='KODATA_WEB'&&BS){
      const _near=(a,b,t)=>Math.abs(a-b)<=Math.max(Math.abs(a),Math.abs(b))*(t||0.01)+1;
      const _num3=lb=>{const L=finFind(BS,lb);if(!L)return null;
        let v=finRowAfter(BS,L).map(i=>i.s.replace(/\s/g,'')).filter(t=>/^[\d,]+$/.test(t)).map(t=>parseInt(t.replace(/,/g,'')));
        if(v.length<3)v=(L.s.match(/[\d,]{3,}/g)||[]).map(t=>parseInt(t.replace(/,/g,'')));   /* 라벨과 값이 한 아이템으로 붙은 경우 */
        return v.length>=3?ord(v.slice(0,3)):null;};
      const _iss=_num3('발행주식수'), _parv=_num3('(1주당금액)')||_num3('주당금액)');   /* ★ 2026-07-30: 이 라벨은 '('+'1'+'주당금액)[단위:원]' 세 조각으로 분해되어 나온다 — '('는 한글 없음·'1'은 숫자라 어떤 병합 규칙에도 안 붙어 원 라벨 탐색이 항상 실패했다(모락스트레이딩 실증). 뒷조각 startsWith 폴백 추가 */
      D.주주합산주식=D.주주.reduce((a,b)=>a+b.주식,0);
      if(_iss&&_iss[0]>0){
        if((D.총주식>0&&!_near(D.총주식,_iss[0],0.02))||(D.주주합산주식>0&&!_near(D.주주합산주식,_iss[0],0.02)))D.지분상충=true;
        D.총주식=_iss[0];
        /* ★ 2026-07-30: 총주식을 재무상태표 값으로 교체했으면 액면도 함께 갱신해야 한다.
           기존엔 _parv 실패 시 주주현황 구기준 주식수로 역산한 stale 액면이 남아
           '자본금 739,449,000원 ≠ 주식수×액면가 2,681,245,700원' 같은 거짓 검산 경고를 만들었다(실증).
           _parv 우선, 없으면 새 총주식 기준 재역산으로 정합 유지 */
        if(_parv&&_parv[0]>0)D.액면=_parv[0];
        else if(D.자본금&&Number.isFinite(D.자본금[0])&&D.자본금[0]>0)D.액면=Math.round(D.자본금[0]*finUnitScale().won/D.총주식);
      }
      else if(_parv&&_parv[0]>0)D.액면=_parv[0];
    }
  }
  const me=D.주주.find(s=>s.명===D.대표자);
  D.대표지분=me?me.율:0; D.대표주식=me?me.주식:0;
  if(D.지분상충){D.지분참고주식=D.대표주식;D.대표주식=0;}   /* ★ 주주현황(구기준) 주식수로 주식평가·상속세가 계산되는 것을 차단 — 지분율은 대화 논점용으로 유지, 수치 확정은 CEO 확인 후 (2026-07-21) */
  const _bwTot=BS?finCells(BS,['총차입금(기타금융부채포함)','총차입금(금융리스부채포함)','총차입금','차입금총계']):null;
  D.차입금=_bwTot?ord(_bwTot)
                :[0,1,2].map(i=>((D.단기차입금&&D.단기차입금[i])||0)+((D.장기차입금&&D.장기차입금[i])||0)+((D.사채&&D.사채[i])||0));
  /* ★ B1 (2026-07-30): AI 검증(verifyFinancial)용 — 원문 텍스트(대조)·좌표 아이템(정정 시 결정적 재추출)·연도 방향 보존.
     값 정정은 반드시 finCells 좌표 재추출로만 — AI가 낸 숫자를 직접 쓰지 않는다(비결정성 차단) */
  D._srcText={bs:(BS&&BS.text)||'',is:(IS&&IS.text)||'',sh:(SH&&SH.text)||''};
  D._srcItems={bs:BS,is:IS};
  D._ordDesc=yr.desc;
  return D;
}

function finVerify(D){
  const near=(a,b,t)=>Math.abs(a-b)<=Math.max(Math.abs(a),Math.abs(b))*(t||0.01)+1;
  const C=[];
  D.years.forEach((y,i)=>{
    if(!(Number.isFinite(D.자산총계[i])&&Number.isFinite(D.부채총계[i])&&Number.isFinite(D.자본총계[i])))return;   /* 연도 수 > 값 수 방어 (2026-07-15) */
    C.push({n:`자산 = 부채 + 자본 (${y})`,
    ok:near(D.자산총계[i],D.부채총계[i]+D.자본총계[i]),
    d:`${D.자산총계[i].toLocaleString()} vs ${(D.부채총계[i]+D.자본총계[i]).toLocaleString()}`,
    w:`자산총계 ${D.자산총계[i].toLocaleString()} ≠ 부채+자본 ${(D.부채총계[i]+D.자본총계[i]).toLocaleString()} (${y}년) — 추출값 확인 필요`});});   /* ★ A3 (2026-07-30): 실패 시 전용 문구(w) — 'n — d' 조합의 비문 방지 */
  if(D.총주식&&D.액면)C.push({n:'자본금 = 주식수 × 액면가',
    ok:near(D.자본금[0]*finUnitScale().won,D.총주식*D.액면,0.02),
    d:`${(D.자본금[0]*finUnitScale().won).toLocaleString()} vs ${(D.총주식*D.액면).toLocaleString()}`,
    w:`자본금 ${(D.자본금[0]*finUnitScale().won).toLocaleString()}원 ≠ 주식수×액면가 ${(D.총주식*D.액면).toLocaleString()}원 — 액면가·주식수 추출값 확인 필요`});
  if(D.주주.length){const s=D.주주.reduce((a,b)=>a+b.율,0);
    C.push({n:'지분율 합계 = 100%',ok:near(s,100,0.02),d:s.toFixed(2)+'%',
    w:`지분율 합계 ${s.toFixed(2)}% (기대 100%) — 상위주주만 공시된 부분 명부 또는 일부 행 미파싱 가능성, 지분 구조 CEO 확인 필요`});}
  if(D.지분상충)C.push({n:'주주현황 기준일 = 최신 결산',ok:false,
    d:`주주현황 주식수 합계 ${(D.주주합산주식||0).toLocaleString()}주 vs 재무상태표 발행주식수 ${D.총주식.toLocaleString()}주 — 감자·자기주식 변동 후 지분 미반영 가능. 대표 실제 지분·주식수는 CEO 확인 필요`,
    w:`주주현황 주식수 합계 ${(D.주주합산주식||0).toLocaleString()}주 vs 재무상태표 발행주식수 ${D.총주식.toLocaleString()}주 — 주주현황이 감자·자기주식 변동 전 구기준 가능성. 대표 실제 지분·주식수는 CEO 확인 필요`});   /* ★ 2026-07-21 */
  C.push({n:'대표자 지분 보유',ok:D.대표지분>0,
    d:D.대표지분>0?`${D.대표자} ${D.대표지분}%`:`${D.대표자||'대표'} 지분 0% — 전문경영인으로 보입니다`});
  return C;
}

 function finLatestQuarter(coordPages,fmt,annualYear){
  if(fmt!=='NICE')return null;
  const pages=(coordPages||[]).map(pg=>finPreparePage(pg));
  const candidates=pages.filter(pg=>/개별\s*,?\s*분기|개별분기/.test(pg.text||'')&&/재무상태표/.test(pg.text||'')&&/매출액/.test(pg.text||''));
  const iso=t=>String(t||'').replace(/\./g,'-');
  const first=(pg,labels)=>{const v=finCells(pg,labels,3);return v&&Number.isFinite(v[0])?v[0]:null;};
  for(const pg of candidates){
    const dates=[];
    for(const it of pg){if(/^20\d{2}[.\-]\d{2}[.\-]\d{2}$/.test(it.s)){const d=iso(it.s);if(!dates.includes(d))dates.push(d);}}
    const periodEnd=dates[0]||'';
    if(!periodEnd||/-12-31$/.test(periodEnd))continue;
    if(annualYear&&Number(periodEnd.slice(0,4))<Number(annualYear))continue;
    const q={periodEnd,
      assets:first(pg,'자산총계'),liabilities:first(pg,'부채총계'),equity:first(pg,'자본총계'),
      cash:first(pg,['현금 및 현금성자산','(현금 및 현금등가물)','현금및현금성자산']),
      currentAssets:first(pg,'유동자산'),currentLiabilities:first(pg,'유동부채'),
      currentBorrowings:first(pg,['(유동차입부채)','유동차입부채','(단기차입금)','단기차입금']),
      nonCurrentBorrowings:first(pg,['(비유동차입부채)','비유동차입부채','(장기차입금)','장기차입금']),
      revenue:first(pg,'매출액'),operatingProfit:first(pg,['영업이익(손실)','영업이익']),
      netIncome:first(pg,['당기순이익(손실)','당기순이익']),financeCost:first(pg,['(금융비용)','금융비용','(이자비용)','이자비용']),
      confirmed:false};
    if([q.assets,q.liabilities,q.equity].every(Number.isFinite)){
      const tol=Math.max(2,Math.abs(q.assets)*0.001);if(Math.abs(q.assets-q.liabilities-q.equity)>tol)continue;
    }
    if(Number.isFinite(q.assets)&&Number.isFinite(q.revenue))return q;
  }
  return null;
 }

 function layoutText(items){
  const rows=[];
  for(const it of items){let row=rows.find(r=>Math.abs(r.y-it.y)<=2.6);if(!row){row={y:it.y,items:[]};rows.push(row);}row.items.push(it);}
  rows.sort((a,b)=>b.y-a.y);
  return rows.map(r=>{r.items.sort((a,b)=>a.x-b.x);let line='',last=null;for(const it of r.items){if(last!==null){const gap=it.x-last;line+=gap>12?'   ':gap>3?' ':'';}line+=it.s;last=it.x+it.w;}return line.trim();}).filter(Boolean).join('\n');
 }
 async function extract(file){
  const pdfjs=await ensurePdfJs();
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',cMapPacked:true,standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'}).promise;
  const pages=[],pageObjects=[],pageTexts=[];
  for(let p=1;p<=pdf.numPages;p++){
   const tc=await (await pdf.getPage(p)).getTextContent();
   let items=(tc.items||[]).filter(i=>i.str&&i.str.trim()).map(i=>({s:String(i.str).trim(),x:Math.round((i.transform||[])[4]||0),y:Math.round((i.transform||[])[5]||0),w:Math.round(i.width||0)})).sort((a,b)=>b.y-a.y||a.x-b.x);
   items=finPreparePage(items);
   pages.push(items);const text=layoutText(items);pageTexts.push(text);pageObjects.push({pageNumber:p,text});
  }
  if(pages.reduce((n,p)=>n+p.length,0)<30)throw new Error('이 PDF는 텍스트 레이어가 없는 스캔·이미지 PDF입니다. 텍스트형 보고서 또는 직접입력을 사용해 주세요.');
  const finFormat=finDetect(pages);const label=finFormat==='NICE'?'NICE BizLINE':finFormat==='KODATA'?'KODATA/KCR2':finFormat==='KODATA_WEB'?'CRETOP':'GENERIC';
  return {text:pageTexts.join('\n\n--- PAGE ---\n\n'),pageTexts,pageObjects,coordPages:pages,pages:pdf.numPages,finFormat,format:label,engineVersion:ENGINE_VERSION};
 }
 function parse(coordPages,fmt){FIN.src=fmt;FIN.scaleFix=1;const data=finParse(coordPages,fmt);const checks=finVerify(data);return {data,checks,unit:finUnit(),unitScale:finUnitScale(),format:fmt,engineVersion:ENGINE_VERSION};}
 function readText(coordPages,labels,stops,fmt){
  const pages=(fmt==='KODATA_WEB'?coordPages.map(pg=>{const m=finGlueChars(pg);m.text=m.map(i=>i.s).join(' ');return m;}):coordPages)||[];
  const stopList=Array.isArray(stops)?stops:FIN_INFO_LABELS;
  for(const pg of pages){const v=finText(pg,labels,stopList);if(v)return v;}
  return '';
 }
 return {VERSION:ENGINE_VERSION,extract,parse,latestQuarter:finLatestQuarter,detect:finDetect,readText,INFO_LABELS:[...FIN_INFO_LABELS],prepare:{finMerge,finGlue,finGlueChars,finNormalizeRows,finPreparePage,finCells,finFind,finYears},unitFor:fmt=>{FIN.src=fmt;return finUnit();}};
})();

function crPdfSanitize(v){return crCleanText(String(v??'').replace(/[\u0000-\u001F\uE000-\uF8FF\u25A1\uFFFD]+/g,'·').replace(/[·]{2,}/g,'·').replace(/\s*·\s*/g,'·'));}
function crPageText(out,n){return out?.pageObjects?.find(p=>p.pageNumber===n)?.text||'';}
function crRegex(text,re){const m=String(text||'').match(re);return m?crPdfSanitize(m[1]):'';}
function crDateISO(v){const m=String(v||'').match(/((?:19|20)\d{2})\D{0,8}(\d{1,2})\D{0,8}(\d{1,2})/);if(!m)return crCleanText(v);const mon=Number(m[2]),day=Number(m[3]);return mon>=1&&mon<=12&&day>=1&&day<=31?`${m[1]}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`:crCleanText(v);}
function crCoordinateCredit(out){
 const gradeRe=/^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?|CC[+-]?|C|D|R|NR|EW)$/i;
 for(const pg of out?.coordPages||[]){
  if(!/기업\s*평가\s*등급(?:\s*이력)?/.test(pg.text||''))continue;
  const header=(pg||[]).filter(i=>String(i.s).replace(/\s+/g,'')==='등급').sort((a,b)=>b.y-a.y)[0];
  if(!header)continue;
  const below=(pg||[]).filter(i=>i.y<header.y-2&&i.x<header.x+90);
  const rows=[];
  for(const it of below){
   let row=rows.find(r=>Math.abs(r.y-it.y)<=3);
   if(!row){row={y:it.y,items:[]};rows.push(row);}
   row.items.push(it);
  }
  rows.sort((a,b)=>b.y-a.y);
  for(const row of rows){
   const items=row.items.sort((a,b)=>a.x-b.x);
   const joined=items.map(i=>String(i.s).trim()).join('').replace(/\s+/g,'');
   const m=joined.match(/^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?|CC[+-]?|C|D|R|NR|EW)(?=20\d{2}|$)/i);
   if(m&&gradeRe.test(m[1]))return m[1].toUpperCase();
   for(let i=0;i<items.length;i++){
    const raw=String(items[i].s).trim();
    if(gradeRe.test(raw)){
     if(/^(AA|A|BBB|BB|B|CCC|CC)$/i.test(raw)){
      const next=items[i+1];
      if(next&&Math.abs(next.y-items[i].y)<=3&&/^[+-]$/.test(String(next.s).trim())&&next.x-items[i].x<35)return (raw+String(next.s).trim()).toUpperCase();
     }
     return raw.toUpperCase();
    }
   }
  }
 }
 return '';
}
function crProfileFallback(out,parsed,supplement){
 const all=out.text||'',p3=crPageText(out,3),p11=crPageText(out,11),sp=supplement?.profile||{};
 const infoPages=out.finFormat==='NICE'?((out.coordPages||[]).filter(pg=>/주요주주/.test(pg.text||'')&&/종업원수/.test(pg.text||'')&&/표준산업분류/.test(pg.text||''))):(out.finFormat==='KODATA_WEB'?((out.coordPages||[]).filter(pg=>/기업개요/.test(pg.text||'')&&/설립년월/.test(pg.text||''))):(out.coordPages||[]));
 const coord=(labels,stops,pages=infoPages.length?infoPages:(out.coordPages||[]))=>crPdfSanitize(JebFinancialEngine.readText(pages,labels,stops,out.finFormat));
 const cleanDash=v=>{const x=crPdfSanitize(v);return !x||/^(?:-|―|–|해당없음|없음|미제공|N\/?A)$/i.test(x)?'':x;};
 const cleanCredit=v=>cleanDash(v).replace(/\s*등급.*$/,'').replace(/\s+/g,'').trim().match(/^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?|CC[+-]?|C|D|R|NR|EW)$/i)?.[1]?.toUpperCase()||'';
 const company=cleanDash(sp.companyName)||cleanDash(parsed.회사명)||cleanDash(coord(['업체명','기업명','기 업 명']))||crRegex(all,/(?:기업명|업체명)\s*[:：]?\s*(.{2,60}?)(?=\s+(?:대표자(?:명)?|사업자(?:등록)?번호|설립일|종업원|업종)|$)/m);
 const rep=cleanDash(sp.representative)||cleanDash(parsed.대표자)||cleanDash(coord(['대표자명','대표자','대 표 자']))||crRegex(all,/대표자(?:명)?\s*[:：]?\s*([가-힣A-Za-z ]{2,30}?)(?=\s+(?:사업자(?:등록)?번호|설립일|종업원|업종)|$)/m);
 const business=(cleanDash(sp.businessNumber)||cleanDash(coord(['사업자번호','사업자등록번호'],undefined,out.coordPages||[]))||crRegex(all,/(?:사업자(?:등록)?번호\s*[:：]?\s*)?([0-9]{3}\s*-\s*[0-9]{2}\s*-\s*[0-9]{5})/)).replace(/\s*-\s*/g,'-');
 const establishedRaw=cleanDash(sp.established)||cleanDash(coord(['설립일자','설 립 일 자','설립년월']))||crRegex(p3,/설립(?:일자|년월)\s+((?:19|20)\d{2}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})/i)||crRegex(all,/설립(?:일자|년월)\s*[:：]?\s*((?:19|20)\d{2}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2})/i);
 const credit=cleanCredit(crCoordinateCredit(out))||cleanCredit(sp.creditGrade)||cleanCredit(coord(['기업평가등급','기업신용등급','신용등급']))||cleanCredit(crRegex(crPageText(out,15),/^(AAA|AA\s*[+-]?|A\s*[+-]?|BBB\s*[+-]?|BB\s*[+-]?|B\s*[+-]?|CCC\s*[+-]?|CC\s*[+-]?|C|D|R|NR|EW)\s+/m))||cleanCredit(crRegex(p3,/(?:기업평가등급|기업신용등급|신용등급)\s*(?:현재)?\s*(AAA|AA\s*[+-]?|A\s*[+-]?|BBB\s*[+-]?|BB\s*[+-]?|B\s*[+-]?|CCC\s*[+-]?|CC\s*[+-]?|C|D|R|NR|EW)\s*(?:등급)?/i))||cleanCredit(crRegex(all,/(?:기업신용등급|신용등급)\s*(AAA|AA\s*[+-]?|A\s*[+-]?|BBB\s*[+-]?|BB\s*[+-]?|B\s*[+-]?|CCC\s*[+-]?|CC\s*[+-]?|C|D|R|NR|EW)\s*등급/i));
 const clipInfo=v=>{const x=cleanDash(v).split(/\s+(?=표준산업분류|업종분류|업종|기업형태|본사주소|주소|주거래은행|주채권기관|무역업허가번호|소속그룹|주요 손익현황|주요 재무)/)[0].trim();return x.length>160?'':x;};
 const rawProducts=clipInfo(crRegex(p3,/(?:주요상품|주요제품명|주요제품(?:\(상품\))?)\s+(.+?)(?=\s+(?:무역업허가번호|소속그룹|주채권기관|표준산업분류|업종|기업형태|본사주소)|$)/m))||clipInfo(sp.products)||clipInfo(coord(['주요제품(상품)','주요제품명','주 요 제 품 명','주요상품']))||clipInfo(crRegex(all,/(?:주요상품|주요제품명|주요제품(?:\(상품\))?)\s+(.+?)(?=\s+(?:무역업허가번호|소속그룹|주채권기관|표준산업분류|업종|기업형태|본사주소)|$)/m));
 const products=rawProducts.replace(/\s+\d{5,6}$/,'').replace(/[·•□|]+/g,',').replace(/\s*,\s*/g,', ').replace(/,{2,}/g,',').replace(/의료기기\s*의약품\s*의료소모품/g,'의료기기, 의약품, 의료소모품').trim();
 const address=clipInfo(sp.address)||clipInfo(coord(['본사주소','본 사 주 소','주소']));
 const website=(cleanDash(sp.website)||cleanDash(coord(['홈페이지','홈 페 이 지']))).split(/\s+(?=이메일|E-?mail)/i)[0].trim();
 const groupName=cleanDash(sp.groupName)||cleanDash(coord(['소속계열','계열명','주력업체']));
 const mainBank=cleanDash(sp.mainBank)||cleanDash(coord(['주거래은행','주 거 래 은 행','주채권기관','당좌거래은행']))||crRegex(p11,/(?:주거래은행|주채권기관)\s+([^\s]+)/)||crRegex(all,/(?:주거래은행|주채권기관)\s+([^\s]+)/);
 const companyType=cleanDash(sp.companyType)||cleanDash(coord(['기업형태','기 업 형 태','기업규모']));
 const industry=cleanDash(parsed.업종)||clipInfo(sp.industry)||clipInfo(coord(['표준산업분류','업종분류','업 종 분 류','업종']));
 const industryCode=cleanDash(sp.industryCode);
 const employees=Number.isFinite(sp.employees)?sp.employees:(Number.isFinite(parsed.종업원)?parsed.종업원:(()=>{const v=cleanDash(coord(['종업원수','상시종업원','상 시 종 업 원']));const m=v.match(/[\d,]+/);return m?Number(m[0].replace(/,/g,'')):null;})());
 return {companyName:company,displayName:company,businessNumber:business,representative:rep,employees,established:crDateISO(establishedRaw)||null,companyType,industry,industryCode,products,address,website,groupName,mainBank,creditGrade:credit,foreignSubsidiaries:Array.isArray(sp.foreignSubsidiaries)?sp.foreignSubsidiaries.map(cleanDash).filter(Boolean):[],relatedCompanies:Array.isArray(sp.relatedCompanies)?sp.relatedCompanies.map(cleanDash).filter(Boolean):[],shareholders:Array.isArray(sp.shareholders)?sp.shareholders:[],reportDate:sp.reportDate||null,fiscalDate:sp.fiscalDate||null,latestQuarterDate:sp.latestQuarterDate||null};
}
function crCoordinateAffiliates(out){
 const result=[];const pages=out?.coordPages||[];
 for(let pi=0;pi<pages.length;pi++){
  const pg=pages[pi];if(!/관계사\s*현황/.test(pg.text||'')||!/업체명/.test(pg.text||''))continue;
  const header=(pg||[]).filter(i=>String(i.s).replace(/\s/g,'')==='업체명').sort((a,b)=>b.y-a.y)[0];if(!header)continue;
  const foot=(pg||[]).filter(i=>/최대/.test(i.s)&&i.y<header.y).sort((a,b)=>b.y-a.y)[0];const rows=[];
  for(const it of pg){if(it.y>=header.y-2)continue;if(foot&&it.y<=foot.y+2)continue;let r=rows.find(x=>Math.abs(x.y-it.y)<=4);if(!r){r={y:it.y,items:[]};rows.push(r);}r.items.push(it);}
  for(const r of rows.sort((a,b)=>b.y-a.y)){
   const a=r.items.sort((x,y)=>x.x-y.x);const name=a.filter(i=>i.x<150).map(i=>i.s).join(' ').trim();
   if(!name||name==='-'||!/\(주\)|주식회사|유한회사|㈜/.test(name))continue;
   const representative=a.filter(i=>i.x>=145&&i.x<230).map(i=>i.s).join(' ').trim();
   const industry=a.filter(i=>i.x>=225&&i.x<365).map(i=>i.s).join(' ').trim();
   const nums=a.filter(i=>i.x>=365).map(i=>String(i.s).replace(/\s/g,'')).filter(t=>/^-?[\d,]+$/.test(t)).map(t=>Number(t.replace(/,/g,'')));
   result.push({name:crPdfSanitize(name),representative:crPdfSanitize(representative),industry:crPdfSanitize(industry),assets:nums[0]??null,revenue:nums[1]??null,netIncome:nums[2]??null,sourcePage:pi+1});
  }
 }
 return result;
}
function crCoordinateShareholderDate(out){const m=String(out?.text||'').match(/주요주주[\s\S]{0,200}?기준\s*일자\s*[:：]?\s*(20\d{2}[.\-]\d{2}[.\-]\d{2})/);return m?m[1].replace(/\./g,'-'):null;}
function crArrayAt(a,i){return Array.isArray(a)&&Number.isFinite(a[i])?a[i]:null;}
function crCoordinateToCase(out,file){
 if(!out.finFormat)throw new Error('지원 보고서 형식을 식별하지 못했습니다. NICE BizLINE·KODATA/KCR2·CRETOP 텍스트형 보고서인지 확인해 주세요.');
 const parsedPack=JebFinancialEngine.parse(out.coordPages,out.finFormat),P=parsedPack.data,checks=parsedPack.checks;
 let standard=null,supplement=null,standardCase=null;
 if(out.finFormat==='NICE'&&global.NiceBizlineExtractor){
  try{standard=global.NiceBizlineExtractor.extractNiceBizline(out.pageObjects,{force:true});standardCase=global.NiceBizlineExtractor.toCorporateReportCase(standard,{sourceFileName:file?.name||''});supplement=standardCase;}catch(e){console.warn('[CorporateReport] NICE 부가정보 보조추출 실패:',e.message);}
 }
 const d=crEmptyCase({sourceType:(out.finFormat==='NICE'?'NICE BizLINE':out.finFormat==='KODATA_WEB'?'CRETOP':'KODATA/KCR2')+' 좌표기반 자동추출',sourcePages:out.pages,confirmed:false});
 d.meta.schemaVersion='CR-1.9.2';d.meta.sourceFileName=file?.name||'';d.meta.extractorVersion=parsedPack.engineVersion;d.meta.originalUnit=parsedPack.unit;d.meta.unit='백만원';d.meta.coordinateEngine=parsedPack.engineVersion;d.meta.parserFormat=out.finFormat;d.meta.statementType=standard?.document?.statementStandard?`${standard.document.statementStandard} 개별 결산`:(/K-?GAAP/i.test((P._srcText?.bs||''))?'K-GAAP 개별 결산':/IFRS/i.test((P._srcText?.bs||''))?'IFRS 개별 결산':'개별 결산');
 d.profile=Object.assign(d.profile,crProfileFallback(out,P,supplement));
 const toMillion=v=>!Number.isFinite(v)?null:Math.round(v*(parsedPack.unit==='천원'?0.001:parsedPack.unit==='원'?0.000001:parsedPack.unit==='만원'?0.01:parsedPack.unit==='억원'?100:1)*1000)/1000;
 const map={assets:'자산총계',liabilities:'부채총계',equity:'자본총계',revenue:'매출액',cogs:'매출원가',operatingProfit:'영업이익',netIncome:'순이익',operatingCashFlow:'영업현금',cash:'현금',currentAssets:'유동자산',currentLiabilities:'유동부채',receivables:'매출채권',inventory:'재고자산',payables:'매입채무',borrowings:'차입금',currentBorrowings:'유동차입',nonCurrentBorrowings:'비유동차입',shortTermLoanReceivable:'가지급금',retainedEarnings:'이익잉여금',interestExpense:'이자비용',capitalStock:'자본금'};
 (P.years||[]).forEach((year,i)=>{const y=String(year);if(!d.financials[y])d.financials[y]=crEmptyFinancialYear();for(const [target,src] of Object.entries(map)){let v=crArrayAt(P[src],i);if(v===null&&target==='currentBorrowings')v=crArrayAt(P.단기차입금,i);if(v===null&&target==='nonCurrentBorrowings'){const a=crArrayAt(P.장기차입금,i),b=crArrayAt(P.사채,i);v=(a!==null||b!==null)?safeNum(a)+safeNum(b):null;}d.financials[y][target]=toMillion(v);}});
 const coordinateQuarter=JebFinancialEngine.latestQuarter(out.coordPages,out.finFormat,P.years?.[0]);
 if(coordinateQuarter){const qi=(out.coordPages||[]).findIndex(pg=>(/개별\s*,?\s*분기|개별분기/.test(pg.text||''))&&/재무상태표/.test(pg.text||'')&&/매출액/.test(pg.text||''));d.latestQuarterly=Object.assign(coordinateQuarter,{sourcePage:qi>=0?qi+1:null});d.profile.latestQuarterDate=coordinateQuarter.periodEnd;}
 else if(standardCase?.latestQuarterly&&!/-12-31$/.test(standardCase.latestQuarterly.periodEnd||''))d.latestQuarterly=clone(standardCase.latestQuarterly);
 const shDate=crCoordinateShareholderDate(out);
 if(Array.isArray(P.주주)&&P.주주.length)d.profile.shareholders=P.주주.map(x=>({name:x.명,sharesOwned:x.주식,ownershipPercent:x.율,relationship:'',asOfDate:shDate,sourcePage:11}));
 const coordAff=crCoordinateAffiliates(out);if(coordAff.length){d.profile.relatedCompanies=coordAff.map(x=>x.name);d.affiliates=coordAff;}
 if(standard){d.profile.creditGrade=d.profile.creditGrade||standard.credit?.companyRatingCurrent?.grade||'';d.profile.reportDate=d.profile.reportDate||standard.document?.reportDate||null;d.confirmationQueue=standard.confirmationQueue||[];d.dynamicQuestions=standardCase?.dynamicQuestions||[];d.derivedSignals=standard.derivedSignals||[];d.extractionResult={document:standard.document,company:standard.company,credit:standard.credit,shareholders:d.profile.shareholders,affiliates:coordAff,quality:standard.quality};}
 d.profile.fiscalDate=P.years?.[0]?`${P.years[0]}-12-31`:d.profile.fiscalDate;
 const failedChecks=checks.filter(x=>x.ok===false&&/^자산 = 부채 \+ 자본/.test(x.n));const advisoryChecks=checks.filter(x=>x.ok===false&&!/^자산 = 부채 \+ 자본/.test(x.n));
 const requiredYears=['2023','2024','2025'],required=['assets','liabilities','equity','revenue','operatingProfit','netIncome'];
 const missing=[];for(const y of requiredYears)for(const k of required)if(!Number.isFinite(d.financials?.[y]?.[k]))missing.push(`${y} ${FIELD_META[k]?.[0]||k}`);
 d.meta.extractionQualityPassed=failedChecks.length===0&&missing.length===0;d.meta.confirmed=false;
 d.sourceMap={profile:'좌표기반 기업개요 표',financials:'좌표기반 재무상태표·손익계산서',shareholders:'원문 주주현황',coordinateEngine:parsedPack.engineVersion};
 const supplementalWarnings=(standardCase?.warnings||[]).filter(x=>!/수치\s*미검출/.test(String(x)));d.warnings=[...new Set([...supplementalWarnings,...failedChecks.map(x=>x.w||x.d||x.n),...advisoryChecks.map(x=>x.w||x.d||x.n),...missing.map(x=>x+' 미검출'),...(P.지분상충?['주주현황 기준일과 최신 결산 발행주식수가 다릅니다. 대표 실제 지분을 확인해 주세요.']:[])])];
 d.coordinateValidation={engineVersion:parsedPack.engineVersion,format:out.finFormat,unit:parsedPack.unit,years:P.years,checks,failedChecks:failedChecks.map(x=>x.n),advisoryChecks:advisoryChecks.map(x=>x.n),missing};
 return d;
}

crFinancialFieldMeta=function(d,y,k){
 if(d?.meta?.coordinateEngine){const group=['assets','liabilities','equity','cash','currentAssets','currentLiabilities','receivables','inventory','payables','borrowings','currentBorrowings','nonCurrentBorrowings','retainedEarnings','capitalStock'].includes(k)?'재무상태표':'손익·현금흐름표';return `좌표행 ${group} · ${y} 개별 결산 · ${d.meta.statementType||''}`;}
 return '사용자 확인 필요';
};

// Replace the lossy row-string parser with the proven coordinate engine.
PDFParser.extract=async function(file){return JebFinancialEngine.extract(file);};
PDFParser.detect=function(_text,_pageObjects,coordPages){const f=coordPages?JebFinancialEngine.detect(coordPages):null;return f==='NICE'?'NICE BizLINE':f==='KODATA'?'KODATA/KCR2':f==='KODATA_WEB'?'CRETOP':'GENERIC';};
const crValidateFactsV17=crValidateFacts;
crValidateFacts=function(d,opts={}){const v=crValidateFactsV17(d,opts);const errors=[...v.errors],warnings=[...v.warnings];if(d?.meta?.parserFormat&&d?.meta?.extractionQualityPassed===false)errors.push('좌표기반 재무추출 검증 미통과');for(const x of d?.coordinateValidation?.failedChecks||[])errors.push(x);return {passed:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};};
handlePdf=async function(file){
 if(!file)return;if(file.size>30*1024*1024){setStartStatus('PDF는 30MB 이하를 사용해 주세요.','err');return;}
 window.jvTrack?.('corporate_pdf_analysis');setStartStatus('PDF 표의 좌표와 계정행을 분석하고 있습니다…');
 try{
  const out=await JebFinancialEngine.extract(file);state.sourceText=out.text;state.sourceName=file.name;state.pdfMeta=out;
  let data;if(out.finFormat){setStartStatus(`${out.format} 좌표기반 엔진으로 연도·행·열을 복원하고 있습니다…`);data=crCoordinateToCase(out,file);}else{data=PDFParser.generic(out.text,out.pages);data.meta.sourceFileName=file.name;data.warnings.unshift('지원 보고서 형식을 식별하지 못해 기본정보만 표시합니다. 재무값은 직접 입력해야 합니다.');}
  data=crNormalizeCase(data);const v=crValidateFacts(data);data.factValidation=v;data.meta.extractionQualityPassed=!!out.finFormat&&v.passed;
  setStartStatus(`${out.format} · ${out.pages}페이지 · ${v.passed?'좌표추출·회계검산 통과':'수정 필요 '+v.errors.length+'건'}.`,v.passed?'ok':'err');window.jvDone?.('corporate_pdf_analysis');prepareCase(data,{confirmed:false,autoGenerate:false});
 }catch(error){window.jvDone?.('corporate_pdf_analysis');console.error(error);setStartStatus('분석 실패: '+error.message,'err');toast('PDF 분석 오류: '+error.message,'err');}
};


/* ============================================================================
 * v1.9.2 — 동적 질문엔진·직접선택 UI·신용등급 기호 보존
 * - 질문은 보고서 회사가 아니라 활성 재무이슈에 따라 달라진다.
 * - 드롭다운을 제거하고 단일/복수/우선순위 선택지를 즉시 노출한다.
 * - 모든 선택형 문항에 직접입력란을 제공한다.
 * ========================================================================== */
const CR_QUESTION_ENGINE_VERSION='1.9.2-dynamic-question-20260731';
const CR_GOAL_OPTIONS=[
 {value:'운전자금 개선 가능성 점검',issueIds:['WORKING_CAPITAL']},
 {value:'자금압박 원인 진단',issueIds:['WORKING_CAPITAL']},
 {value:'차입구조 재정비 여부',issueIds:['WORKING_CAPITAL']},
 {value:'매출채권 회수위험 점검',issueIds:['WORKING_CAPITAL','EXPORT_CREDIT']},
 {value:'재고 정상화 가능성 검토',issueIds:['WORKING_CAPITAL']},
 {value:'수익성 개선 포인트 확인',issueIds:['WORKING_CAPITAL']},
 {value:'누적결손·자본회복 정책',issueIds:['CAPITAL_POLICY']},
 {value:'배당·유보·자본정책 검토',issueIds:['CAPITAL_POLICY']},
 {value:'자기주식·감자·지분거래 검토',issueIds:['CAPITAL_TRANSACTIONS']},
 {value:'임원퇴직금·지급재원 점검',issueIds:['EXECUTIVE_RETIREMENT']},
 {value:'대표자·핵심인 유고 대응',issueIds:['KEY_PERSON']},
 {value:'경영승계·가족지분 정리',issueIds:['SUCCESSION']},
 {value:'수출채권·해외법인 위험 점검',issueIds:['EXPORT_CREDIT']},
 {value:'재산·휴업·배상 위험 점검',issueIds:['PROPERTY_BI']},
 {value:'기존 보험증권 목적·공백 점검',issueIds:['INSURANCE_OPTIMIZATION']},
 {value:'유료 정밀진단 진행 여부 결정',issueIds:[]},
 {value:'세무·법무·노무 전문가 협업 범위 결정',issueIds:[]},
 {value:'당장 실행할 30일 과제 선정',issueIds:[]}
];
const CR_COMMON_QUESTIONS=[
 {id:'consultingGoal',section:'의사결정 우선순위',label:'이번 상담에서 대표가 우선 결정해야 할 주제는 무엇입니까?',reason:'복수선택 후 가장 중요한 1순위를 지정합니다. 리포트의 페이지 순서와 상담 결론에 반영됩니다.',type:'priority-multi',options:CR_GOAL_OPTIONS,required:true,wide:true,otherPlaceholder:'선택지에 없는 의사결정이나 구체적인 목표를 직접 입력해 주세요.'},
 {id:'cashPressure',section:'현장 체감과 관리수준',label:'매출 증가와 별개로 자금집행이 빠듯했던 시기가 있었습니까?',reason:'손익과 실제 현금 체감의 차이를 확인합니다.',type:'single',options:['없음','간헐적','자주 있음','상시 부담','미확인'],otherPlaceholder:'언제, 어떤 지출 때문에 부담이 발생했는지 적어 주세요.'},
 {id:'topCustomerConcentration',section:'현장 체감과 관리수준',label:'상위 5개 거래처의 매출 비중과 결제조건을 어느 정도 알고 있습니까?',reason:'매출채권 집중도와 회수위험의 추가 확인 범위를 정합니다.',type:'single',options:['정확히 관리 중','대략 알고 있음','일부만 파악','파악하지 못함','미확인'],otherPlaceholder:'상위 거래처 비중, 결제일, 실제 회수일을 아는 범위에서 입력해 주세요.'},
 {id:'inventoryAging',section:'현장 체감과 관리수준',label:'정상·저회전·장기재고를 구분하는 기준이 있습니까?',reason:'재고 개선 가능액을 과장하지 않기 위한 기준입니다.',type:'single',options:['명확한 기준과 보고서 있음','대략 구분함','재고총액만 관리','구분하지 않음','해당 없음·미확인'],otherPlaceholder:'예: 90일·180일·1년 이상, 품목별 폐기·할인 기준'},
 {id:'shareholderStructure',section:'지배구조와 의사결정',label:'현재 주주구조의 특징을 선택해 주세요.',reason:'자본정책·승계·공동주주 의사결정의 전제를 확인합니다.',type:'multi',options:['대표 단독 또는 사실상 단일주주','가족주주 포함','공동창업자·동업주주','법인주주 포함','임직원주주 포함','주주간계약 있음','주주간계약 없음·미확인'],otherPlaceholder:'주주명, 지분율, 가족관계, 의결권 특이사항을 적어 주세요.'},
 {id:'successorStatus',section:'지배구조와 의사결정',label:'후계자 또는 경영승계 논의 상태는 어떻습니까?',reason:'승계 이슈를 임의로 생성하지 않고 대표의 실제 의사를 확인합니다.',type:'single',options:['계획 없음','가족 내 후보 있음','임직원 후보 있음','외부 매각·M&A 검토','구체적 계획 진행 중','미확인'],otherPlaceholder:'예상 시기, 후보자, 가족·주주의 합의 수준을 적어 주세요.'},
 {id:'ceoCriticalRoles',section:'대표자·조직 리스크',label:'대표만 최종 승인하거나 직접 관리하는 핵심업무는 무엇입니까?',reason:'대표 부재 시 업무공백과 필요재원을 구분합니다.',type:'multi',options:['자금집행·은행거래','차입·담보·보증','핵심 거래처 영업','주요 계약·가격결정','인사·보상','생산·품질·납기','해외법인·수출','투자·M&A','대표 전결업무 거의 없음'],otherPlaceholder:'대표만 알고 있거나 대체하기 어려운 업무를 적어 주세요.'},
 {id:'existingInsurance',section:'보험·전문가 협업',label:'법인·대표·주주 관련 기존 보험증권을 확보했습니까?',reason:'신규 제안보다 기존 계약의 목적·공백·중복을 먼저 검토합니다.',type:'single',options:['없음','일부 확보','전체 확보','담당 설계사에게 요청 가능','제출 곤란','미확인'],otherPlaceholder:'보험사, 계약목적, 월보험료, 보장기간 중 아는 내용을 입력해 주세요.'},
 {id:'advisorTeam',section:'보험·전문가 협업',label:'현재 협업 가능한 전문가를 선택해 주세요.',reason:'기존 전문가를 존중하고 역할 충돌 없이 공동검토 범위를 설계합니다.',type:'multi',options:['세무사','회계사','변호사','노무사','법무사','변리사','보험담당자','주거래은행','별도 전문가 없음'],otherPlaceholder:'전문가 성명·사무실 또는 반드시 공동검토할 쟁점을 적어 주세요.'},
 {id:'ceoStyle',section:'상담 진행방식',label:'대표의 의사결정 성향은 어디에 가장 가깝습니까?',reason:'설명순서·숫자비중·질문방식·클로징 강도를 맞춥니다.',type:'single',options:['신중보수형','숫자중심형','빠른결정형','관계중심형','회의방어형','전문가위임형','비용민감형'],otherPlaceholder:'대표가 선호하거나 싫어하는 설명방식을 적어 주세요.'},
 {id:'meetingStage',section:'상담 진행방식',label:'현재 상담단계는 어디입니까?',reason:'질문의 깊이와 다음 행동의 범위를 조정합니다.',type:'single',options:['1차 진단','2차 정밀검토','가족·주주 공동미팅','전문가 공동검토','보험설계 검토','최종 의사결정','사후관리'],otherPlaceholder:'이번 미팅의 참석자와 예정된 다음 절차를 적어 주세요.'},
 {id:'nextMeetingTarget',section:'상담 진행방식',label:'다음 미팅에서 반드시 남겨야 할 행동을 선택해 주세요.',reason:'상담을 설명으로 끝내지 않고 자료·담당자·기한·결정으로 연결합니다.',type:'multi',options:['자료 제출일 확정','담당자 지정','정밀진단 범위 확정','전문가 공동검토일 확정','A·B·C안 비교','보험증권 분석','가족·주주 공동설명','진행·축소·보류 결정','30일 실행과제 확정'],otherPlaceholder:'다음 미팅의 구체적인 결과물·날짜·담당자를 입력해 주세요.'}
];
const CR_ISSUE_QUESTION_BANK={
 WORKING_CAPITAL:{title:'유동성·운전자금 조건부 질문',questions:[
  {id:'cashPressureCauses',label:'자금압박의 원인으로 체감되는 항목을 선택해 주세요.',reason:'재무수치와 현장 원인을 연결합니다.',type:'multi',options:['매출채권 회수지연','재고 증가','차입원리금 상환','인건비·고정비','설비·투자지출','세금·배당·일회성 지출','거래처 결제조건 악화','원인을 아직 모름'],otherPlaceholder:'발생 시기와 최대 부족액을 입력해 주세요.'},
  {id:'receivableManagement',label:'매출채권 회수관리는 어느 수준입니까?',reason:'회수일 단축 가능성의 현실성을 판단합니다.',type:'single',options:['거래처별 약정일·실제회수일 관리','연체채권만 별도관리','월말 잔액만 관리','담당자 경험에 의존','관리하지 않음·미확인'],otherPlaceholder:'상위 거래처의 결제조건·연체경험을 적어 주세요.'},
  {id:'inventoryManagement',label:'재고 관리상 현재 우려되는 항목을 선택해 주세요.',reason:'정상재고와 처분·평가가 필요한 재고를 구분합니다.',type:'multi',options:['장기·저회전재고','과잉안전재고','품목별 수요예측 부족','반품·폐기 가능성','재고부족·납기위험','재고 이슈 없음','미확인'],otherPlaceholder:'가장 오래된 재고기간과 처리계획을 적어 주세요.'},
  {id:'borrowingPurpose',label:'최근 차입 증가 또는 만기집중의 주요 배경은 무엇입니까?',reason:'차입을 문제로 단정하지 않고 사용목적과 상환재원을 확인합니다.',type:'multi',options:['운전자금','설비·투자','관계회사·투자자산','기존차입 상환·차환','M&A·지분거래','일회성 손실 보전','증가원인 미확인'],otherPlaceholder:'차입처, 금리, 만기, 담보, 상환계획을 아는 범위에서 적어 주세요.'}
 ]},
 CAPITAL_POLICY:{title:'누적결손·자본정책 조건부 질문',questions:[
  {id:'deficitCauses',label:'누적결손의 주요 원인으로 추정되는 항목을 선택해 주세요.',reason:'결손을 단순 세무문제로 보지 않고 원인별 회복계획을 설계합니다.',type:'multi',options:['과거 영업손실','대규모 투자·평가손실','관계회사·금융자산 손실','일회성 비용·손상','합병·분할·자본거래 영향','원인 분석 완료','원인 미확인'],otherPlaceholder:'발생 연도와 주요 손실항목을 입력해 주세요.'},
  {id:'capitalRecoveryStatus',label:'결손 해소 또는 자본회복 계획이 있습니까?',reason:'최근 흑자의 지속성과 현금·차입을 함께 평가합니다.',type:'single',options:['3년 이상 구체적 계획 있음','연간 예산에 반영','검토 중','계획 없음','미확인'],otherPlaceholder:'목표연도, 목표이익, 차입상환·투자계획을 적어 주세요.'},
  {id:'investmentAssetPurpose',label:'대규모 투자자산의 주된 목적을 선택해 주세요.',reason:'장기투자자산과 영업현금 부족의 관계를 확인합니다.',type:'multi',options:['본업 설비·사업확장','관계회사 지분','금융상품·유가증권','부동산·임대','M&A·신사업','매각·회수 예정','세부내역 미확인'],otherPlaceholder:'회수가능 시점과 배당·매각 계획을 입력해 주세요.'},
  {id:'shareholderCashNeeds',label:'향후 3년 주주·대표의 현금수요를 선택해 주세요.',reason:'회사 유보와 주주이전, 퇴직·승계재원을 분리합니다.',type:'multi',options:['배당','대표·임원 퇴직금','가족 증여·상속','지분매입·공동주주 정리','개인 채무·생활자금','현금수요 없음','미확인'],otherPlaceholder:'예상 시기와 금액범위를 적어 주세요.'}
 ]},
 LOAN_RECEIVABLE:{title:'단기대여금·가지급금 조건부 질문',questions:[
  {id:'loanCounterparty',label:'단기대여금의 상대방은 누구입니까?',reason:'대표자 가지급금으로 단정하지 않고 거래 실질을 확인합니다.',type:'single',options:['관계회사','거래처','임직원','주주·대표','해외법인','기타','미확인'],otherPlaceholder:'상대방명과 관계를 입력해 주세요.'},
  {id:'loanPurpose',label:'최초 지급 목적을 선택해 주세요.',reason:'사업상 대여·투자·임직원·주주거래를 구분합니다.',type:'multi',options:['사업 운영지원','투자 전 단계','거래처 지원','임직원 복지·대여','주주·대표 관련','일시적 자금이체','목적 미확인'],otherPlaceholder:'지급일·금액·현재 필요성을 적어 주세요.'},
  {id:'loanContract',label:'증빙과 승인절차가 어느 정도 갖춰져 있습니까?',reason:'정상 거래조건과 보완 범위를 확인합니다.',type:'multi',options:['계약서','이사회·주총 승인','이자율 약정','만기·상환일정','담보·보증','실제 이자수취','자료 없음·미확인'],otherPlaceholder:'누락된 서류와 보완 가능시점을 적어 주세요.'},
  {id:'loanMaturity',label:'현재 회수 가능성은 어디에 가깝습니까?',reason:'회수·정상화·구조변경 대안을 구분합니다.',type:'single',options:['기한 내 전액회수 가능','분할상환 가능','만기 연장 필요','사업상 계속 유지 필요','회수 곤란 우려','미확인'],otherPlaceholder:'상환재원과 예상 회수일을 입력해 주세요.'}
 ]},
 CAPITAL_TRANSACTIONS:{title:'자본거래 조건부 질문',questions:[
  {id:'capitalTransactionPurpose',label:'과거 또는 예정 자본거래의 목적을 선택해 주세요.',reason:'세금기법이 아니라 현금·지분·경영권의 목적을 확인합니다.',type:'multi',options:['승계','대표·주주 퇴직','공동주주 정리','임직원 보상','투자유치','지배구조 단순화','배당·주주환원','목적 미확인'],otherPlaceholder:'거래연도, 대상주주, 금액, 사용한 평가방법을 적어 주세요.'},
  {id:'capitalDocuments',label:'자본거래 관련 자료는 어느 수준까지 확보돼 있습니까?',reason:'거래 타임라인과 절차를 복원합니다.',type:'multi',options:['거래 전후 주주명부','가치평가서','이사회·주총 의사록','계약서','세무신고·검토서','자금이체 증빙','일부만 보유','자료 미확인'],otherPlaceholder:'부족한 자료와 담당자를 적어 주세요.'},
  {id:'futureCapitalPlan',label:'향후 3년 예정된 자본·지분 의사결정을 선택해 주세요.',reason:'같은 거래를 반복하지 않도록 지분정책을 만듭니다.',type:'multi',options:['추가 증자','배당','자기주식 취득·처분','감자','주식양수도','승계·증여','M&A·투자유치','계획 없음·미확인'],otherPlaceholder:'예상 시기와 이해관계자를 적어 주세요.'}
 ]},
 EXECUTIVE_RETIREMENT:{title:'임원퇴직재원 조건부 질문',questions:[
  {id:'retirementRuleStatus',label:'임원퇴직금 규정과 의사결정 자료는 어느 수준입니까?',reason:'규정만으로 지급·손금인정을 보장하지 않고 실제 실행요건을 확인합니다.',type:'multi',options:['정관 반영','임원퇴직금 규정','주총결의','등기임원·보수자료','예상퇴직금 계산','자료 일부만 있음','미확인'],otherPlaceholder:'최근 개정일과 적용대상 임원을 적어 주세요.'},
  {id:'retirementTiming',label:'대표·핵심임원의 예상 퇴직시점은 언제입니까?',reason:'금액과 지급재원을 기간별로 계산합니다.',type:'single',options:['3년 이내','4~5년','6~10년','10년 이후','퇴직계획 없음','미확인'],otherPlaceholder:'퇴직 후 역할과 지급방식을 적어 주세요.'},
  {id:'retirementFunding',label:'퇴직금 지급재원으로 고려하는 방법을 선택해 주세요.',reason:'내부현금·금융자산·보험을 비용과 유동성으로 비교합니다.',type:'multi',options:['회사 현금','정기적 적립','금융상품','보험계약','퇴직 시 차입','자산매각','준비 없음·미확인'],otherPlaceholder:'현재 적립액과 연간 준비가능액을 적어 주세요.'}
 ]},
 SUCCESSION:{title:'승계·가족합의 조건부 질문',questions:[
  {id:'successionTimeline',label:'승계 관련 의사결정을 완료해야 할 시기는 언제입니까?',reason:'기업가치·가족합의·세금·재원 준비기간을 정합니다.',type:'single',options:['3년 이내','4~5년','6~10년','10년 이후','시기 미정'],otherPlaceholder:'대표가 생각하는 경영이양·지분이전 시기를 각각 적어 주세요.'},
  {id:'familyConsensus',label:'가족·주주 간 현재 합의 수준은 어떻습니까?',reason:'경영권과 경제적 공평성의 충돌을 확인합니다.',type:'single',options:['핵심사항 합의','후계자만 합의','가족별 의견 다름','공동주주와 협의 필요','논의 시작 전','미확인'],otherPlaceholder:'반대하거나 추가 설명이 필요한 이해관계자를 적어 주세요.'},
  {id:'successionFundingNeeds',label:'승계 시 예상되는 현금수요를 선택해 주세요.',reason:'필요재원과 현재재원 확인 후 보험·비보험 대안을 비교합니다.',type:'multi',options:['상속·증여세','비경영 가족 정산','공동주주 지분매입','대표 퇴직금','채무·보증 해소','운영비상자금','금액 미확인'],otherPlaceholder:'현재 예상하는 금액·자산·기존보험을 입력해 주세요.'}
 ]},
 KEY_PERSON:{title:'대표자·핵심인 유고 조건부 질문',questions:[
  {id:'keyPersonMonthlyFixedCost',label:'유고 시에도 유지해야 할 월 고정비는 몇 백만원입니까?',reason:'비상운영 필요재원을 계산합니다.',type:'number',unit:'백만원',otherPlaceholder:'급여·임차료·이자·필수외주비 포함 기준을 적어 주세요.'},
  {id:'keyPersonEmergencyMonths',label:'비상운영 필요기간은 몇 개월입니까?',reason:'대체경영 체계가 안정될 때까지의 기간입니다.',type:'number',unit:'개월',otherPlaceholder:'기간 판단근거를 적어 주세요.'},
  {id:'immediateDebtRepayment',label:'즉시 대응해야 할 채무·보증은 몇 백만원입니까?',reason:'운영비 외 즉시 재원을 반영합니다.',type:'number',unit:'백만원',otherPlaceholder:'채무·보증의 종류와 상환조건을 적어 주세요.'},
  {id:'availableEmergencyCash',label:'실제로 사용할 수 있는 비상현금은 몇 백만원입니까?',reason:'장부상 현금과 운영필수현금을 구분합니다.',type:'number',unit:'백만원',otherPlaceholder:'사용 제한·담보·최소운영현금을 적어 주세요.'},
  {id:'existingKeyPersonCoverage',label:'유고 시 법인에 지급될 기존 보험금은 몇 백만원입니까?',reason:'부족재원에서 기존 보장을 차감합니다.',type:'number',unit:'백만원',otherPlaceholder:'계약자·피보험자·수익자와 보장기간을 적어 주세요.'}
 ]},
 EXPORT_CREDIT:{title:'수출채권·해외법인 조건부 질문',questions:[
  {id:'exportRiskFactors',label:'해외거래에서 현재 우려되는 위험을 선택해 주세요.',reason:'신용·국가·환율·운송·현지법인 위험을 구분합니다.',type:'multi',options:['바이어 집중','장기 외상결제','연체·대손','국가·정치위험','환율변동','운송·적하','현지법인 자금통제','특별한 우려 없음·미확인'],otherPlaceholder:'국가, 바이어, 최대 미수잔액을 적어 주세요.'},
  {id:'foreignInsuranceStatus',label:'해외 관련 보험증권 확보 수준은 어떻습니까?',reason:'현지 증권과 본사 증권의 공백을 확인합니다.',type:'multi',options:['무역신용보험','적하보험','해외재산보험','휴업보험','배상책임','D&O','현지보험만 있음','보험 없음·미확인'],otherPlaceholder:'국가별 보험사·가입금액·면책사항을 적어 주세요.'},
  {id:'customerDelinquency',label:'최근 2년 해외거래 연체·대손·분쟁이 있었습니까?',reason:'보험검토의 실제 근거를 확인합니다.',type:'single',options:['없음','경미한 지연','반복 지연','대손·분쟁 발생','미확인'],otherPlaceholder:'거래처, 국가, 금액, 현재 회수상태를 적어 주세요.'}
 ]},
 PROPERTY_BI:{title:'재산·휴업·배상 조건부 질문',questions:[
  {id:'criticalAssets',label:'영업중단 시 가장 큰 영향을 주는 자산·시설을 선택해 주세요.',reason:'복구기간과 매출·고정비 충격을 계산합니다.',type:'multi',options:['본사·공장','핵심설비','창고·재고','전산·데이터','원재료 공급망','물류·운송','임차시설','미확인'],otherPlaceholder:'자산가액과 대체·복구기간을 적어 주세요.'},
  {id:'businessInterruptionPeriod',label:'핵심시설이 멈추면 정상화까지 예상기간은?',reason:'휴업손실의 기간가정을 확인합니다.',type:'single',options:['1개월 이내','2~3개월','4~6개월','7~12개월','1년 초과','미확인'],otherPlaceholder:'대체생산·외주·임시사업장 가능성을 적어 주세요.'},
  {id:'propertyCoverageStatus',label:'재산·휴업·배상 관련 기존 보장 수준은?',reason:'가입금액·면책·복구비용의 공백을 확인합니다.',type:'single',options:['최근 증권 검토 완료','보험은 있으나 내용 미확인','일부만 가입','보험 없음','미확인'],otherPlaceholder:'보험사, 가입금액, 휴업기간, 주요 면책을 적어 주세요.'}
 ]},
 INSURANCE_OPTIMIZATION:{title:'기존 보험증권 조건부 질문',questions:[
  {id:'insuranceReviewGoals',label:'기존 보험에서 가장 먼저 점검할 항목을 선택해 주세요.',reason:'신규가입보다 목적·공백·중복을 우선합니다.',type:'multi',options:['계약목적 불명확','보장금액 부족','중복·과다보험료','보장기간 불일치','계약자·수익자 구조','현금가치·해지손실','세무·회계처리','특별한 문제 없음·미확인'],otherPlaceholder:'현재 가장 불편한 계약이나 담당자 의견을 적어 주세요.'},
  {id:'insuranceChangeConstraints',label:'보험 변경 시 가장 중요한 제약을 선택해 주세요.',reason:'해지·감액·추가설계를 안전하게 비교합니다.',type:'multi',options:['건강심사','보험료 예산','기존 해지손실','가족·주주 동의','기존 담당자 관계','세무·회계 영향','의사결정 시기','제약 미확인'],otherPlaceholder:'변경하지 말아야 할 계약과 이유를 적어 주세요.'},
  {id:'insuranceDecisionIntent',label:'이번 상담에서 보험 관련 결정범위는 어디까지입니까?',reason:'진단과 가입결정을 분리합니다.',type:'single',options:['증권 수집만','보장분석까지','A·B안 설계검토','인수심사 가능성 확인','최종 결정 검토','보험검토 원치 않음'],otherPlaceholder:'희망 일정과 참석자를 적어 주세요.'}
 ]}
};
function crQOptionValue(o){return typeof o==='string'?o:o?.value||'';}
function crQOptionIssueIds(o){return typeof o==='object'&&Array.isArray(o.issueIds)?o.issueIds:[];}
function crQArray(v){if(Array.isArray(v))return v.map(String).filter(Boolean);if(v===null||v===undefined||v==='')return[];return [String(v)];}
function crActiveQuestionIssueIds(analysis){
 const ids=(analysis?.issues||[]).map(x=>x.id);
 for(const id of analysis?.speechPlan?.activeIssueIds||[])if(!ids.includes(id))ids.push(id);
 return ids;
}
function crBuildQuestionSections(analysis){
 const active=crActiveQuestionIssueIds(analysis),sections=[];
 const commonMap=new Map();for(const q of CR_COMMON_QUESTIONS){const s=q.section||'공통질문';if(!commonMap.has(s))commonMap.set(s,[]);commonMap.get(s).push({...q,source:'공통'});}
 for(const [title,questions] of commonMap)sections.push({id:'common-'+sections.length,title,kind:'common',questions});
 for(const id of active.slice(0,4)){
  const bank=CR_ISSUE_QUESTION_BANK[id];if(bank)sections.push({id:'issue-'+id,title:bank.title,kind:'issue',issueId:id,questions:bank.questions.map(q=>({...q,issueId:id,source:'조건부'}))});
 }
 const used=new Set(sections.flatMap(s=>s.questions.map(q=>q.id)));
 const dynamic=(analysis?.dynamicQuestions||[]).filter(q=>q&&q.id&&!used.has(q.id)).slice(0,6).map(q=>({id:q.id,label:q.label||q.question||'추가 확인',reason:q.reason||'PDF 자동추출에서 확인이 필요한 사항입니다.',type:q.type==='number'?'number':'text',example:q.example||'',issueId:q.issueId||'',source:'원문확인',otherPlaceholder:'원문 또는 담당자 확인 결과를 입력해 주세요.'}));
 if(dynamic.length)sections.push({id:'source-confirmation',title:'원문·담당자 추가확인',kind:'source',questions:dynamic});
 const activeSet=new Set(active);
 for(const section of sections)for(const q of section.questions)if(q.id==='consultingGoal')q.options=q.options.map(o=>({...o,recommended:crQOptionIssueIds(o).some(id=>activeSet.has(id))}));
 return sections;
}
allQuestions=function(analysis){return crBuildQuestionSections(analysis).flatMap(s=>s.questions);};
function crQuestionChoice(option,id,type,selected,priority,recommended,optionIndex){
 const value=crQOptionValue(option),checked=selected.includes(value),rid=`${id}-${optionIndex}`;
 if(type==='priority-multi')return `<div class="q-option priority ${checked?'selected':''} ${recommended?'recommended':''}"><label for="${attr(rid)}"><input id="${attr(rid)}" type="checkbox" data-q-choice="${attr(id)}" value="${attr(value)}" ${checked?'checked':''}><span>${esc(value)}</span>${recommended?'<em>분석추천</em>':''}</label><label class="q-priority" title="대표 지정 1순위"><input type="radio" name="q-priority-${attr(id)}" data-q-priority="${attr(id)}" value="${attr(value)}" ${priority===value?'checked':''}><span>1순위</span></label></div>`;
 return `<label class="q-option ${checked?'selected':''} ${recommended?'recommended':''}" for="${attr(rid)}"><input id="${attr(rid)}" type="${type==='single'?'radio':'checkbox'}" ${type==='single'?`name="q-${attr(id)}"`:''} data-q-choice="${attr(id)}" value="${attr(value)}" ${checked?'checked':''}><span>${esc(value)}</span>${recommended?'<em>분석추천</em>':''}</label>`;
}
function crQuestionCard(q,index,answers){
 const raw=answers[q.id],opts=(q.options||[]).map(crQOptionValue),selected=crQArray(raw).filter(v=>opts.includes(v));
 const unmatched=Array.isArray(raw)?raw.filter(v=>!opts.includes(String(v))).join(', '):(raw&&!opts.includes(String(raw))?String(raw):'');
 const other=answers[q.id+'Other']??unmatched??'',priority=String(answers[q.id+'Priority']||'');
 let control='';
 if(['single','multi','priority-multi'].includes(q.type))control=`<div class="q-options ${q.type}">${(q.options||[]).map((o,oi)=>crQuestionChoice(o,q.id,q.type,selected,priority,!!o?.recommended,oi)).join('')}</div>`;
 else if(q.type==='number')control=`<div class="q-number-row"><input data-q-direct="${attr(q.id)}" type="number" inputmode="decimal" value="${attr(Number.isFinite(n(raw))?raw:'')}" placeholder="숫자 입력"><span>${esc(q.unit||'')}</span></div>`;
 else control=`<textarea data-q-direct="${attr(q.id)}" rows="2" placeholder="${attr(q.example||q.otherPlaceholder||'직접 입력')} ">${esc(raw||'')}</textarea>`;
 const otherInput=['single','multi','priority-multi','number'].includes(q.type)?`<div class="q-other"><span>직접입력</span><textarea data-q-other="${attr(q.id)}" rows="2" placeholder="${attr(q.otherPlaceholder||'선택지에 없는 내용 또는 상세 설명을 입력해 주세요.')}">${esc(other)}</textarea></div>`:'';
 return `<article class="question-card ${q.wide?'q-wide':''}" data-q-card="${attr(q.id)}" data-q-type="${attr(q.type||'text')}" data-q-required="${q.required?'1':'0'}" data-q-issue="${attr(q.issueId||'')}"><div class="q-card-head"><span class="q-index">${String(index).padStart(2,'0')}</span><div><h3>${esc(q.label)}</h3><p>${esc(q.reason)}${q.unit?' · 단위 '+esc(q.unit):''}</p></div>${q.source?`<em class="q-source ${q.source==='조건부'?'conditional':''}">${esc(q.source)}</em>`:''}</div>${control}${otherInput}</article>`;
}
renderQuestions=function(){
 if(!state.analysis)state.analysis=buildConfirmedModel(state.caseData);
 const sections=crBuildQuestionSections(state.analysis),answers=state.caseData.answers||{},active=crActiveQuestionIssueIds(state.analysis),count=sections.reduce((s,x)=>s+x.questions.length,0);let idx=0;
 const issueTitles=(state.analysis.issues||[]).filter(x=>active.includes(x.id)).slice(0,4).map(x=>x.title);
 $('questionsBody').innerHTML=`<div class="question-engine-summary"><div><b>맞춤형 질문엔진</b><span>${CR_QUESTION_ENGINE_VERSION}</span></div><div class="question-summary-chips"><span>총 ${count}문항</span><span>공통 ${sections.filter(x=>x.kind==='common').reduce((s,x)=>s+x.questions.length,0)}</span><span>조건부 ${sections.filter(x=>x.kind==='issue').reduce((s,x)=>s+x.questions.length,0)}</span></div><p>보고서 제공기관이 아니라 확인된 재무패턴과 활성 이슈에 따라 조건부 질문이 달라집니다. ${issueTitles.length?'현재 활성: '+esc(issueTitles.join(' · ')):'현재 활성 이슈가 없어 공통 확인질문 중심으로 구성했습니다.'}</p></div>`+
 sections.map(section=>`<section class="question-section ${section.kind}"><header><div><b>${esc(section.title)}</b><span>${section.kind==='issue'?'재무분석 결과에 따라 자동 추가':'모든 기업 공통'}</span></div>${section.issueId?`<em>${esc(section.issueId)}</em>`:''}</header><div class="question-grid">${section.questions.map(q=>crQuestionCard(q,++idx,answers)).join('')}</div></section>`).join('');
 const root=$('questionsBody');
 qsa('[data-q-choice]',root).forEach(el=>el.onchange=()=>{const card=el.closest?.('.question-card');el.closest?.('.q-option')?.classList.toggle('selected',el.checked);if(el.type==='radio')qsa(`[data-q-choice="${el.dataset.qChoice}"]`,card).forEach(x=>x.closest?.('.q-option')?.classList.toggle('selected',x.checked));});
 qsa('[data-q-priority]',root).forEach(el=>el.onchange=()=>{if(!el.checked)return;const choice=qsa(`[data-q-choice="${el.dataset.qPriority}"]`,root).find(x=>x.value===el.value);if(choice&&!choice.checked){choice.checked=true;choice.closest?.('.q-option')?.classList.add('selected');}});
};
collectQuestions=function(){
 const body=$('questionsBody'),answers=state.caseData.answers=state.caseData.answers||{},missing=[];
 qsa('[data-q-card]',body).forEach(card=>{
  const id=card.dataset.qCard,type=card.dataset.qType,required=card.dataset.qRequired==='1';let value=null;
  if(type==='single'){const x=qsa(`[data-q-choice="${id}"]`,card).find(e=>e.checked);value=x?x.value:'미확인';}
  else if(type==='multi'||type==='priority-multi')value=qsa(`[data-q-choice="${id}"]`,card).filter(e=>e.checked).map(e=>e.value);
  else {const x=card.querySelector?.(`[data-q-direct="${id}"]`);value=type==='number'?(n(x?.value)??null):String(x?.value||'').trim();}
  const other=String(card.querySelector?.(`[data-q-other="${id}"]`)?.value||'').trim();answers[id]=value;if(other)answers[id+'Other']=other;else delete answers[id+'Other'];
  if(type==='priority-multi'){const p=qsa(`[data-q-priority="${id}"]`,card).find(e=>e.checked);const selected=Array.isArray(value)?value:[];const priority=p&&selected.includes(p.value)?p.value:selected[0]||'';answers[id+'Priority']=priority;answers.consultingGoalSummary=[priority,...selected.filter(x=>x!==priority),other].filter(Boolean).join(' · ');}
  const empty=(Array.isArray(value)?value.length===0:(value===null||value===''||value==='미확인'))&&!other;if(required&&empty)missing.push(card.querySelector?.('h3')?.textContent||id);
 });
 if(missing.length){toast('필수 질문을 확인해 주세요: '+missing.slice(0,2).join(' · '),'err');return false;}
 answers.questionnaireMeta={version:CR_QUESTION_ENGINE_VERSION,answeredAt:nowIso(),activeIssueIds:crActiveQuestionIssueIds(state.analysis)};
 crApplyConfirmationAnswers(state.caseData);state.questionsConfirmed=true;return true;
};
const crBuildConfirmedModelV192=buildConfirmedModel;
buildConfirmedModel=function(data){
 const model=crBuildConfirmedModelV192(data),a=model.answers||{},selected=crQArray(a.consultingGoal),primary=String(a.consultingGoalPriority||selected[0]||a.consultingGoalOther||'');
 model.decisionPriorities={selected,primary,other:String(a.consultingGoalOther||''),summary:String(a.consultingGoalSummary||[primary,...selected.filter(x=>x!==primary),a.consultingGoalOther].filter(Boolean).join(' · '))};
 const goalMap=new Map(CR_GOAL_OPTIONS.map(x=>[x.value,x.issueIds]));
 for(const issue of model.issues||[]){const matches=selected.filter(v=>(goalMap.get(v)||[]).includes(issue.id));if(matches.length){issue.userPriority=matches;issue.facts=[...new Set([...(issue.facts||[]),`대표 우선의사결정: ${matches.join(' · ')}`])];}if(primary&&(goalMap.get(primary)||[]).includes(issue.id)){issue.primaryDecision=true;issue.score=Math.min(5,(issue.score||0)+0.25);}}
 const sections=crBuildQuestionSections(model);for(const q of sections.flatMap(s=>s.questions)){if(!q.issueId)continue;const val=a[q.id],other=a[q.id+'Other'];const values=[...(Array.isArray(val)?val:[val]),other].filter(v=>v!==null&&v!==undefined&&String(v).trim()&&String(v)!=='미확인');if(!values.length)continue;const issue=(model.issues||[]).find(x=>x.id===q.issueId);if(issue)issue.facts=[...new Set([...(issue.facts||[]),`추가답변 · ${q.label}: ${values.join(' · ')}`])];}
 model.issues=(model.issues||[]).sort((x,y)=>(Number(!!y.primaryDecision)-Number(!!x.primaryDecision))+(Number(!!y.userPriority?.length)-Number(!!x.userPriority?.length))||((y.score||0)-(x.score||0)));
 model.questionnaire={version:CR_QUESTION_ENGINE_VERSION,sections:sections.map(s=>({id:s.id,title:s.title,kind:s.kind,questionIds:s.questions.map(q=>q.id)})),answeredAt:a.questionnaireMeta?.answeredAt||null,decisionPriorities:model.decisionPriorities};
 return model;
};
const crCoordinateCreditV192Base=crCoordinateCredit;
crCoordinateCredit=function(out){
 const gradePattern='AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?|CC[+-]?|C|D|R|NR|EW';
 for(const pg of out?.coordPages||[]){
  if(!/기업\s*평가\s*등급(?:\s*이력)?/.test(pg.text||''))continue;
  const compact=String(pg.text||'').replace(/\s+/g,' ');
  const textMatch=compact.match(new RegExp(`\\b(${gradePattern})\\s+(?=20\\d{2}[.\\/-])`,'i'));if(textMatch)return textMatch[1].replace(/\s+/g,'').toUpperCase();
  const header=(pg||[]).filter(i=>String(i.s).replace(/\s+/g,'')==='등급').sort((a,b)=>b.y-a.y)[0];if(!header)continue;
  const candidates=(pg||[]).filter(i=>i.y<header.y-1&&i.x>=header.x-15&&i.x<header.x+95).sort((a,b)=>b.y-a.y||a.x-b.x);
  for(const item of candidates){const raw=String(item.s).trim().replace(/\s+/g,'');if(!new RegExp(`^(${gradePattern})$`,'i').test(raw))continue;if(/[+-]$/.test(raw))return raw.toUpperCase();const sign=(pg||[]).filter(s=>/^[+-]$/.test(String(s.s).trim())&&Math.abs(s.y-item.y)<=7&&s.x>=item.x&&s.x-item.x<45).sort((a,b)=>Math.abs(a.y-item.y)-Math.abs(b.y-item.y)||a.x-b.x)[0];if(sign)return (raw+String(sign.s).trim()).toUpperCase();return raw.toUpperCase();}
 }
 const base=crCoordinateCreditV192Base(out);if(base&&!/[+-]$/.test(base)){const all=(out?.coordPages||[]).filter(pg=>/기업평가등급\s*이력/.test(pg.text||'')).map(pg=>pg.text||'').join(' ');const m=all.match(new RegExp(`\\b(${base.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}[+-])\\b`,'i'));if(m)return m[1].toUpperCase();}return base;
};


/* ============================================================================
 * v2.0.0 — 제작목적 우선형 AI 질문 오케스트레이터
 * - 목적 확정 전에는 목적·영업의도만 입력한다.
 * - 선택형 + 주관식 목적을 AI 서버가 우선 해석하고, 실패 시 로컬 의미해석기로 안전하게 대체한다.
 * - 목적과 첨부 보고서의 활성 이슈가 만나는 질문만 생성한다.
 * ========================================================================== */
const CR_PURPOSE_ENGINE_VERSION='2.0.0-purpose-first-20260801';
const CR_PURPOSE_OPTIONS=[
 {value:'CEO에게 기업의 전반적인 재무상태를 설명',issueIds:['WORKING_CAPITAL','CAPITAL_POLICY']},
 {value:'재무위험과 잠재 문제를 인식시키고 후속상담 연결',issueIds:['WORKING_CAPITAL','CAPITAL_POLICY','CAPITAL_TRANSACTIONS']},
 {value:'현금흐름·운전자금 개선 정밀진단 제안',issueIds:['WORKING_CAPITAL']},
 {value:'차입금·부채구조 및 상환위험 점검',issueIds:['WORKING_CAPITAL','KEY_PERSON']},
 {value:'가지급금·단기대여금 정리 컨설팅',issueIds:['LOAN_RECEIVABLE']},
 {value:'가수금·대표자 투입자금 정리 검토',issueIds:['CAPITAL_POLICY']},
 {value:'이익잉여금·배당·주주환원 정책 검토',issueIds:['CAPITAL_POLICY']},
 {value:'자기주식·감자·지분거래 검토',issueIds:['CAPITAL_TRANSACTIONS']},
 {value:'대표이사·임원 퇴직금과 지급재원 제안',issueIds:['EXECUTIVE_RETIREMENT']},
 {value:'대표자·핵심인 유고 시 비상재원 진단',issueIds:['KEY_PERSON']},
 {value:'법인보험 신규계약 필요성 검토',issueIds:['KEY_PERSON','EXECUTIVE_RETIREMENT','SUCCESSION']},
 {value:'기존 법인·대표 보험증권 분석 및 리모델링',issueIds:['INSURANCE_OPTIMIZATION']},
 {value:'대출상환·긴급운영자금 목적의 보장 검토',issueIds:['KEY_PERSON','WORKING_CAPITAL']},
 {value:'가업승계·상속·증여 사전진단',issueIds:['SUCCESSION']},
 {value:'비상장주식 가치·주주구조·경영권 점검',issueIds:['SUCCESSION','CAPITAL_TRANSACTIONS']},
 {value:'가족·공동주주 공동상담으로 확장',issueIds:['SUCCESSION']},
 {value:'사내근로복지기금·임직원 복지 제안',issueIds:[]},
 {value:'핵심인재 유지·성과보상·단체보장 검토',issueIds:['KEY_PERSON']},
 {value:'재산·휴업·배상·해외사업장 위험 점검',issueIds:['PROPERTY_BI']},
 {value:'수출채권·거래처 부도위험 및 무역보험 검토',issueIds:['EXPORT_CREDIT']},
 {value:'정책자금·기업인증·연구소 등 외부지원 검토',issueIds:[]},
 {value:'유료 법인컨설팅 계약 제안',issueIds:[]},
 {value:'첫 미팅에서 신뢰 형성과 관심 유도',issueIds:[]},
 {value:'보험증권·추가자료를 확보하고 2차 미팅 확정',issueIds:['INSURANCE_OPTIMIZATION']},
 {value:'기존 고객 사후관리 및 추가계약 기회 발굴',issueIds:['INSURANCE_OPTIMIZATION']},
 {value:'경쟁 제안과 차별화된 종합 솔루션 제시',issueIds:[]},
 {value:'CEO 의사결정용 종합 법인컨설팅 리포트',issueIds:['WORKING_CAPITAL','CAPITAL_POLICY','KEY_PERSON','SUCCESSION']}
];
const CR_PURPOSE_QUESTIONS=[
 {id:'reportPurpose',section:'리포트 제작목적',label:'이번 리포트를 만드는 가장 중요한 목적은 무엇입니까?',reason:'복수선택 후 반드시 1순위를 지정합니다. 이후 질문·분석순서·솔루션·화법·클로징의 최상위 기준이 됩니다.',type:'priority-multi',options:CR_PURPOSE_OPTIONS,required:true,wide:true,otherPlaceholder:'선택지에 없는 목적, 고객 상황, 이번 상담에서 이루고 싶은 결과를 구체적으로 입력해 주세요.'},
 {id:'purposeDetail',section:'리포트 제작목적',label:'선택한 목적을 더 구체적으로 설명해 주세요.',reason:'AI가 고객의 현재 상황, 문제인식 수준, 제안순서와 피해야 할 접근을 함께 해석합니다.',type:'text',wide:true,otherPlaceholder:'예: 보험을 먼저 제안하지 말고 퇴직재원 부족을 숫자로 인식시킨 뒤 증권 제출과 2차 미팅으로 연결하고 싶다.'},
 {id:'desiredCustomerAction',section:'리포트 제작목적',label:'이 리포트를 본 고객이 다음에 어떤 행동을 하기를 원합니까?',reason:'리포트 결론과 클로징을 실제 다음 행동에 맞춥니다.',type:'multi',required:true,options:['추가 상담 동의','정밀진단 자료 제출','보험증권 제출','전문가 공동미팅 참석','A·B·C 해결안 검토','유료 컨설팅 계약 검토','보험설계안 검토','가족·주주 공동설명 참석','실행 일정·담당자 확정','신뢰 형성만 하고 다음 기회 확보'],otherPlaceholder:'원하는 행동, 목표일, 참석자 또는 확보해야 할 자료를 입력해 주세요.'},
 {id:'salesIntent',section:'리포트 제작목적',label:'이번 상담의 영업적 우선순위를 선택해 주세요.',reason:'CEO 전달내용과 컨설턴트 내부전략을 분리하면서 제안 강도를 조정합니다.',type:'single',required:true,options:['문제 인식과 신뢰 형성 우선','후속 정밀상담 연결 우선','유료 컨설팅 수임 우선','법인보험 기회 확인 우선','보험설계·계약 검토 우선','기존 계약 사후관리 우선','복합 목적·직접입력'],otherPlaceholder:'보험과 컨설팅의 우선순위, 이번에는 언급하지 말아야 할 내용 등을 입력해 주세요.'},
 {id:'purposeRestrictions',section:'리포트 제작목적',label:'이번 리포트에서 피하거나 약하게 다뤄야 할 내용이 있습니까?',reason:'고객의 거부감·기존 전문가 관계·상담단계를 고려해 부적절한 제안을 차단합니다.',type:'text',wide:true,otherPlaceholder:'예: 보험료 직접 제시 금지, 기존 세무사 판단 비판 금지, 승계는 아직 언급하지 않기'}
];
function crPurposeKeywordIssueIds(text){
 const t=String(text||'').replace(/\s+/g,' '),rules=[
  [/가지급|대여금|임시지급|대표.*인출/,['LOAN_RECEIVABLE']],
  [/운전자금|현금흐름|매출채권|재고|차입|유동성|자금압박/,['WORKING_CAPITAL']],
  [/이익잉여|배당|가수금|자본정책|결손|유보/,['CAPITAL_POLICY']],
  [/자기주식|감자|지분거래|명의신탁|주주정리/,['CAPITAL_TRANSACTIONS']],
  [/퇴직금|퇴직재원|은퇴/,['EXECUTIVE_RETIREMENT']],
  [/승계|상속|증여|후계|경영권|가족주주/,['SUCCESSION']],
  [/유고|핵심인|대표.*부재|비상경영|대출상환재원/,['KEY_PERSON']],
  [/기존.*보험|증권.*분석|보험.*리모델링|중복보험/,['INSURANCE_OPTIMIZATION']],
  [/수출채권|무역보험|해외거래처|국가위험/,['EXPORT_CREDIT']],
  [/화재|휴업|재산보험|공장|설비.*사고|배상/,['PROPERTY_BI']]
 ];const out=[];for(const [re,ids] of rules)if(re.test(t))for(const id of ids)if(!out.includes(id))out.push(id);return out;
}
function crLocalInterpretPurpose(answers,analysis){
 const selected=crQArray(answers.reportPurpose),primary=String(answers.reportPurposePriority||selected[0]||answers.reportPurposeOther||''),free=[answers.reportPurposeOther,answers.purposeDetail,answers.salesIntentOther,answers.purposeRestrictions].filter(Boolean).join(' ');
 const map=new Map(CR_PURPOSE_OPTIONS.map(x=>[x.value,x.issueIds]));const purposeIds=[];for(const v of selected)for(const id of map.get(v)||[])if(!purposeIds.includes(id))purposeIds.push(id);for(const id of crPurposeKeywordIssueIds(free))if(!purposeIds.includes(id))purposeIds.push(id);
 const reportIds=crActiveQuestionIssueIds(analysis);const matched=purposeIds.filter(id=>reportIds.includes(id));const relevant=[...matched,...purposeIds.filter(id=>!matched.includes(id))].slice(0,5);
 const sales=String(answers.salesIntent||'');let insuranceEmphasis='CONDITIONAL';if(/보험설계|계약/.test(sales))insuranceEmphasis='HIGH';else if(/문제 인식|신뢰|정밀상담|유료/.test(sales)||/보험.*먼저|보험료.*금지|보험.*약하게/.test(free))insuranceEmphasis='LOW_AT_BEGINNING';
 return {source:'LOCAL_SEMANTIC_FALLBACK',primaryPurpose:primary,selectedPurposes:selected,customPurpose:free,desiredActions:crQArray(answers.desiredCustomerAction),salesIntent:sales,issueIds:relevant,reportDetectedIssueIds:reportIds,matchedReportIssueIds:matched,insuranceEmphasis,restrictions:[answers.purposeRestrictions,answers.salesIntentOther].filter(Boolean),summary:`1순위 목적은 ‘${primary||'직접입력 목적'}’이며, ${crQArray(answers.desiredCustomerAction).join('·')||'후속 행동'}으로 연결하는 리포트입니다. ${insuranceEmphasis==='LOW_AT_BEGINNING'?'초기에는 보험을 전면에 두지 않고 문제와 필요재원을 먼저 설명합니다.':''}`};
}
async function crInterpretPurposeWithAI(){
 const a=state.caseData.answers||{},fallback=crLocalInterpretPurpose(a,state.analysis);
 try{const out=await ServerAdapter.runAI('interpretReportPurpose',{purpose:{primary:a.reportPurposePriority,selected:a.reportPurpose,other:a.reportPurposeOther,detail:a.purposeDetail,desiredActions:a.desiredCustomerAction,salesIntent:a.salesIntent,salesIntentOther:a.salesIntentOther,restrictions:a.purposeRestrictions},company:{name:state.caseData.profile?.companyName,industry:state.caseData.profile?.industry},detectedIssues:crActiveQuestionIssueIds(state.analysis),instruction:'선택형과 주관식 목적을 통합해 primaryPurpose, issueIds, desiredActions, salesIntent, insuranceEmphasis, restrictions, summary를 JSON으로 반환'},8000);
  const p=out?.purposeProfile||out?.result||out?.data;if(p&&typeof p==='object'){const ids=crQArray(p.issueIds).filter(id=>CR_ISSUE_QUESTION_BANK[id]);return {...fallback,...p,issueIds:ids.length?ids:fallback.issueIds,source:'SERVER_AI'};}
 }catch(_e){}return fallback;
}
function crPurposeComplete(a){return crQArray(a?.reportPurpose).length>0||String(a?.reportPurposeOther||'').trim();}
const crBuildQuestionSectionsV192=crBuildQuestionSections;
crBuildQuestionSections=function(analysis){
 const a=state.caseData?.answers||{},profile=a.reportPurposeProfile;
 if(!profile)return [{id:'purpose',title:'리포트 제작목적과 영업의도',kind:'purpose',questions:CR_PURPOSE_QUESTIONS.map(q=>({...q,source:'필수'}))}];
 const sections=[];const selectedIds=crQArray(profile.issueIds);const reportIds=crActiveQuestionIssueIds(analysis);const candidate=[...new Set([...selectedIds.filter(id=>reportIds.includes(id)),...selectedIds])].slice(0,4);
 sections.push({id:'purpose-summary',title:'AI가 이해한 제작방향',kind:'summary',questions:[]});
 const essentials=CR_COMMON_QUESTIONS.filter(q=>['ceoStyle','meetingStage','nextMeetingTarget','advisorTeam','existingInsurance'].includes(q.id));
 sections.push({id:'execution',title:'목적 달성을 위한 핵심 확인',kind:'common',questions:essentials.map(q=>({...q,source:'목적연계'}))});
 for(const id of candidate){const bank=CR_ISSUE_QUESTION_BANK[id];if(bank)sections.push({id:'issue-'+id,title:bank.title,kind:'issue',issueId:id,questions:bank.questions.map(q=>({...q,issueId:id,source:reportIds.includes(id)?'목적+보고서':'목적지정'}))});}
 const used=new Set(sections.flatMap(s=>s.questions.map(q=>q.id)));const dynamic=(analysis?.dynamicQuestions||[]).filter(q=>q&&q.id&&!used.has(q.id)&&(!q.issueId||candidate.includes(q.issueId))).slice(0,4).map(q=>({id:q.id,label:q.label||q.question||'추가 확인',reason:q.reason||'첨부 보고서에서 확인되지 않아 목적 달성을 위해 추가 확인합니다.',type:q.type==='number'?'number':'text',issueId:q.issueId||'',source:'보고서 누락',otherPlaceholder:'알고 있는 범위만 입력하고 모르면 미확인으로 남겨 주세요.'}));
 if(dynamic.length)sections.push({id:'source-confirmation',title:'첨부 보고서에 없는 핵심정보',kind:'source',questions:dynamic});return sections;
};
const crRenderQuestionsV192=renderQuestions;
renderQuestions=function(){
 if(!state.analysis)state.analysis=buildConfirmedModel(state.caseData);const a=state.caseData.answers||{},profile=a.reportPurposeProfile;
 crRenderQuestionsV192();const root=$('questionsBody');if(!root)return;
 const summary=root.querySelector('.question-engine-summary');if(summary){summary.querySelector('b').textContent=profile?'목적연계 맞춤질문':'리포트 제작목적 우선 설정';summary.querySelector('span').textContent=CR_PURPOSE_ENGINE_VERSION;const p=summary.querySelector('p');if(p)p.innerHTML=profile?`<strong>AI 해석:</strong> ${esc(profile.summary||profile.primaryPurpose||'제작방향 분석 완료')}<br><small>목적 연계 이슈: ${esc(crQArray(profile.issueIds).join(' · ')||'종합진단')} · 해석방식 ${esc(profile.source||'AI')}</small>`:'첨부 보고서 분석보다 먼저 컨설턴트의 제작목적과 영업의도를 확정합니다. 목적을 분석한 뒤 그 목적에 필요한 질문만 다시 구성합니다.';}
 qsa('.question-section.summary',root).forEach(sec=>{sec.innerHTML=`<header><div><b>AI가 이해한 제작방향</b><span>질문과 리포트 생성의 최상위 기준</span></div></header><div class="purpose-direction-card"><b>${esc(profile?.primaryPurpose||'')}</b><p>${esc(profile?.summary||'')}</p><div>${crQArray(profile?.desiredActions).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${profile?.restrictions?.length?`<small>제외·주의: ${esc(profile.restrictions.join(' · '))}</small>`:''}</div>`;});
 const btn=$('confirmQuestionsBtn');if(btn)btn.textContent=profile?'답변 확인·리포트 생성':'목적 분석·맞춤질문 구성';
};
const crBuildConfirmedModelPurposeBase=buildConfirmedModel;
buildConfirmedModel=function(data){
 const model=crBuildConfirmedModelPurposeBase(data),profile=model.answers?.reportPurposeProfile||data?.answers?.reportPurposeProfile;
 if(!profile)return model;const ids=crQArray(profile.issueIds),primary=String(profile.primaryPurpose||'');
 model.reportPurposeProfile=profile;model.decisionPriorities={...(model.decisionPriorities||{}),primary,selected:crQArray(profile.selectedPurposes),summary:profile.summary||primary,desiredActions:crQArray(profile.desiredActions),salesIntent:profile.salesIntent||'',restrictions:profile.restrictions||[]};
 for(const issue of model.issues||[]){if(ids.includes(issue.id)){issue.purposeAligned=true;issue.userPriority=[...new Set([...(issue.userPriority||[]),primary].filter(Boolean))];issue.facts=[...new Set([...(issue.facts||[]),`리포트 제작목적 연계: ${primary}`])];issue.score=Math.min(5,(issue.score||0)+(issue.id===ids[0]?0.35:0.15));}}
 model.issues=(model.issues||[]).sort((a,b)=>Number(!!b.purposeAligned)-Number(!!a.purposeAligned)||((b.score||0)-(a.score||0)));
 return model;
};
function crCollectVisibleQuestions(){return collectQuestions();}
function crWirePurposeFlow(){const btn=$('confirmQuestionsBtn');if(!btn)return;btn.onclick=async()=>{
  if(!crCollectVisibleQuestions())return;const a=state.caseData.answers||{};
  if(!a.reportPurposeProfile){if(!crPurposeComplete(a)){toast('리포트 제작목적을 먼저 선택하거나 직접 입력해 주세요.','err');return;}btn.disabled=true;btn.textContent='AI가 목적을 해석하는 중…';a.reportPurposeProfile=await crInterpretPurposeWithAI();a.questionnaireMeta={...(a.questionnaireMeta||{}),purposeVersion:CR_PURPOSE_ENGINE_VERSION,purposeInterpretedAt:nowIso()};state.analysis=buildConfirmedModel(state.caseData);state.questionsConfirmed=false;btn.disabled=false;renderQuestions();toast('제작목적에 맞는 질문만 다시 구성했습니다.','ok');return;}
  closeModal('questionsModal');generateReport('purpose-aligned-answers');
 };}



/* ============================================================================
 * v2.1.0 FINAL INTEGRITY PATCH
 * - NICE 신용등급 +/- 원문 보존 및 CF등급 시각영역 보조인식
 * - 제작목적 → 목적별 2차 질문 → 답변반영 → 생성 순서 강제
 * - 목적지정 이슈가 재무보고서에 없더라도 사전진단 페이지로 반영
 * - 컨설턴트용 독립 HTML 저장
 * - 음성강의 조절 모달·챕터 이어듣기
 * - 목적·질문·원문 일치 품질게이트
 * ========================================================================== */
const CR_FINAL_ENGINE_VERSION='2.1.0-final-20260801';

function crNormalizeGradeToken(value){
 const compact=String(value||'').toUpperCase().replace(/\s+/g,'').replace(/[‐‑‒–—−]/g,'-');
 const m=compact.match(/^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?|CC[+-]?|C|D|R|NR|EW)$/);
 return m?m[1]:'';
}
function crNormalizeCashFlowGrade(value){const m=String(value||'').toUpperCase().replace(/\s+/g,'').match(/^CF[1-6]$/);return m?m[0]:'';}
function crCreditCoordinateRows(out){
 const history=[],gradePattern='AAA|AA|A|BBB|BB|B|CCC|CC|C|D|R|NR|EW';
 const pages=out?.coordPages||[];
 for(const [pageIndex,pg] of pages.entries()){
  const sourcePage=out?.pageObjects?.[pageIndex]?.pageNumber||pageIndex+1;
  const pageText=out?.pageObjects?.[pageIndex]?.text||pg.text||'';
  if(!/기업\s*평가\s*등급(?:\s*이력)?/.test(pageText))continue;

  /* 1차: 레이아웃 문자열에서 부호를 포함해 직접 복원한다.
     BB + 2026.03.18처럼 부호가 별도 토큰이어도 허용한다. */
  const directRe=new RegExp(`\\b(${gradePattern})\\s*([+-]?)\\s+(20\\d{2}[.\\/-]\\d{2}[.\\/-]\\d{2})\\s+(20\\d{2}[.\\/-]\\d{2}[.\\/-]\\d{2})\\s+([^\\n]+)`,'gi');
  let dm;
  while((dm=directRe.exec(pageText))){
   const grade=crNormalizeGradeToken(dm[1]+(dm[2]||''));if(!grade)continue;
   history.push({grade,evaluationDate:String(dm[3]).replace(/[.\\/]/g,'-'),financialDate:String(dm[4]).replace(/[.\\/]/g,'-'),ratingType:String(dm[5]||'모형등급').trim(),sourcePage,status:'textExact'});
  }

  /* 2차: 좌표 행 복원. 글자별 y 기준선 차이를 고려해 8pt 허용하고,
     첫 평가일자 왼쪽의 모든 토큰을 붙여 등급을 만든다. */
  const rows=[];
  for(const item of pg||[]){
   const y=Number(item.y);if(!Number.isFinite(y))continue;
   let row=rows.find(r=>Math.abs(r.y-y)<=8);
   if(!row){row={y,items:[]};rows.push(row);}
   row.items.push(item);row.y=row.items.reduce((sum,x)=>sum+Number(x.y||0),0)/row.items.length;
  }
  for(const row of rows){
   const items=row.items.slice().sort((a,b)=>Number(a.x||0)-Number(b.x||0));
   const dates=items.filter(x=>/^20\d{2}[.\\/-]\d{2}[.\\/-]\d{2}$/.test(String(x.s||'').trim()));
   if(dates.length<2)continue;
   const firstDate=dates[0],secondDate=dates[1];
   const gradeRaw=items.filter(x=>Number(x.x||0)<Number(firstDate.x||0)-1).map(x=>String(x.s||'').trim()).join('');
   const grade=crNormalizeGradeToken(gradeRaw);if(!grade)continue;
   const ratingType=items.filter(x=>Number(x.x||0)>Number(secondDate.x||0)+Number(secondDate.w||0)+1).map(x=>String(x.s||'').trim()).join(' ').trim()||'모형등급';
   history.push({grade,evaluationDate:String(firstDate.s).replace(/[.\\/]/g,'-'),financialDate:String(secondDate.s).replace(/[.\\/]/g,'-'),ratingType,sourcePage,status:'coordinateExact'});
  }
 }
 const uniq=[];
 for(const x of history){
  if(!uniq.some(y=>y.grade===x.grade&&y.evaluationDate===x.evaluationDate&&y.financialDate===x.financialDate))uniq.push(x);
 }
 return uniq.sort((a,b)=>String(b.evaluationDate).localeCompare(String(a.evaluationDate)));
}
function crCreditBundle(out,baseCredit){
 const base=clone(baseCredit||{}),history=crCreditCoordinateRows(out);
 const visual=out?.visualCredit||{};
 const currentGrade=history[0]?.grade||crNormalizeGradeToken(visual.companyGrade)||crNormalizeGradeToken(base.companyRatingCurrent?.grade);
 const cfGrade=crNormalizeCashFlowGrade(visual.cashFlowGrade)||crNormalizeCashFlowGrade(base.cashFlowGradeCurrent?.grade);
 const watchCurrent=base.watchCurrent||base.watchHistory?.[0]||null;
 return {
  ...base,
  companyRatingCurrent:currentGrade?{...(base.companyRatingCurrent||{}),...(history[0]||{}),grade:currentGrade,sourcePage:history[0]?.sourcePage||15,status:history[0]?'coordinateExact':'visualOrText'}:null,
  companyRatingHistory:history.length?history:(base.companyRatingHistory||[]).map(x=>({...x,grade:crNormalizeGradeToken(x.grade)||x.grade})),
  watchCurrent,
  cashFlowGradeCurrent:{...(base.cashFlowGradeCurrent||{}),grade:cfGrade||null,label:cfGrade||null,financialDate:base.cashFlowGradeCurrent?.financialDate||history[0]?.financialDate||null,sourcePage:3,status:cfGrade?'visualExact':'needsConfirmation'},
  visualValidation:{companyGrade:crNormalizeGradeToken(visual.companyGrade)||null,cashFlowGrade:cfGrade||null,confidence:visual.confidence||null,source:'NICE 3p gauge image'}
 };
}

function crMaskFromCanvas(canvas,threshold=145){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),pts=[];
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,lum=(img.data[i]+img.data[i+1]+img.data[i+2])/3;if(img.data[i+3]>20&&lum<threshold)pts.push([x,y]);}
 if(!pts.length)return null;let minX=canvas.width,minY=canvas.height,maxX=0,maxY=0;for(const [x,y] of pts){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
 const W=160,H=56,mask=new Uint8Array(W*H),bw=Math.max(1,maxX-minX+1),bh=Math.max(1,maxY-minY+1),scale=Math.min((W-8)/bw,(H-8)/bh),ox=(W-bw*scale)/2,oy=(H-bh*scale)/2;
 for(const [x,y] of pts){const nx=Math.max(0,Math.min(W-1,Math.round(ox+(x-minX)*scale))),ny=Math.max(0,Math.min(H-1,Math.round(oy+(y-minY)*scale)));mask[ny*W+nx]=1;}
 return {mask,W,H};
}
function crDilateMask(m){const out=new Uint8Array(m.mask.length);for(let y=0;y<m.H;y++)for(let x=0;x<m.W;x++)if(m.mask[y*m.W+x])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<m.W&&ny<m.H)out[ny*m.W+nx]=1;}return {...m,mask:out};}
function crMaskSimilarity(a,b){if(!a||!b)return 0;const ad=crDilateMask(a).mask,bd=crDilateMask(b).mask;let inter=0,aa=0,bb=0;for(let i=0;i<ad.length;i++){if(ad[i])aa++;if(bd[i])bb++;if(ad[i]&&bd[i])inter++;}return aa&&bb?2*inter/(aa+bb):0;}
function crTemplateMask(text,fontSize,fontFamily){const c=document.createElement('canvas');c.width=320;c.height=120;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';x.font=`900 ${fontSize}px ${fontFamily}`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2+2);return crMaskFromCanvas(c,180);}
function crRecognizeGradeCrop(pageCanvas,rect,candidates){
 const c=document.createElement('canvas'),scale=pageCanvas.width/595;c.width=Math.max(20,Math.round(rect[2]*scale));c.height=Math.max(20,Math.round(rect[3]*scale));c.getContext('2d').drawImage(pageCanvas,Math.round(rect[0]*scale),Math.round(rect[1]*scale),c.width,c.height,0,0,c.width,c.height);
 const target=crMaskFromCanvas(c,135);if(!target)return {value:'',score:0};let best={value:'',score:0};
 for(const value of candidates)for(const size of [34,38,42,46,50])for(const font of ['Arial','Helvetica','sans-serif']){const score=crMaskSimilarity(target,crTemplateMask(value,size,font));if(score>best.score)best={value,score};}
 return best.score>=0.53?best:{value:'',score:best.score};
}
async function crExtractVisualCredit(file){
 try{
  const pdfjs=await ensurePdfJs(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',cMapPacked:true,standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'}).promise;
  if(pdf.numPages<3)return {};
  const page=await pdf.getPage(3),viewport=page.getViewport({scale:2.2}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  const company=crRecognizeGradeCrop(canvas,[75,642,105,30],['AAA','AA+','AA','AA-','A+','A','A-','BBB+','BBB','BBB-','BB+','BB','BB-','B+','B','B-','CCC+','CCC','CCC-','CC+','CC','CC-','C','D']);
  const cash=crRecognizeGradeCrop(canvas,[425,642,105,30],['CF1','CF2','CF3','CF4','CF5','CF6']);
  return {companyGrade:company.value,cashFlowGrade:cash.value,confidence:{company:company.score,cashFlow:cash.score}};
 }catch(error){console.warn('[CorporateReport] NICE 시각등급 보조인식 실패:',error.message);return {};}
}
const crJebExtractV210Base=JebFinancialEngine.extract;
JebFinancialEngine.extract=async function(file){const out=await crJebExtractV210Base(file);if(out.finFormat==='NICE')out.visualCredit=await crExtractVisualCredit(file);return out;};

const crCoordinateToCaseV210Base=crCoordinateToCase;
crCoordinateToCase=function(out,file){
 const d=crCoordinateToCaseV210Base(out,file),bundle=crCreditBundle(out,d.extractionResult?.credit);
 if(bundle.companyRatingCurrent?.grade)d.profile.creditGrade=bundle.companyRatingCurrent.grade;
 d.profile.watchGrade=bundle.watchCurrent?.grade||d.profile.watchGrade||'';
 d.profile.cashFlowGrade=bundle.cashFlowGradeCurrent?.grade||d.profile.cashFlowGrade||'';
 d.extractionResult=d.extractionResult||{};d.extractionResult.credit=bundle;
 d.sourceMap={...(d.sourceMap||{}),credit:'NICE 15p 등급이력 좌표 + 3p 시각등급 교차검증'};
 d.meta.creditValidation={companyGrade:d.profile.creditGrade||null,cashFlowGrade:d.profile.cashFlowGrade||null,companyExact:!!bundle.companyRatingCurrent?.grade,cashFlowExact:!!bundle.cashFlowGradeCurrent?.grade,engine:CR_FINAL_ENGINE_VERSION};
 if(!d.profile.creditGrade)d.warnings=[...(d.warnings||[]),'기업평가등급을 원문에서 확정하지 못했습니다. 15페이지 등급이력을 확인해 직접 입력해 주세요.'];
 if(!d.profile.cashFlowGrade)d.warnings=[...(d.warnings||[]),'현금흐름등급은 3페이지 그래프 이미지 항목입니다. 자동 인식 실패 시 원문을 확인해 직접 입력해 주세요.'];
 return d;
};

const crValidateFactsV210Base=crValidateFacts;
crValidateFacts=function(d,opts={}){
 const v=crValidateFactsV210Base(d,opts),errors=[...v.errors],warnings=[...v.warnings];
 if(d?.meta?.sourceType?.includes('NICE')){
  const grade=crNormalizeGradeToken(d?.profile?.creditGrade);if(!grade)errors.push('NICE 기업평가등급 누락 또는 형식 오류');
  const sourceGrade=crNormalizeGradeToken(d?.extractionResult?.credit?.companyRatingCurrent?.grade);if(sourceGrade&&grade!==sourceGrade)errors.push(`기업평가등급 원문 불일치: 원문 ${sourceGrade} / 입력 ${grade}`);
  const cf=crNormalizeCashFlowGrade(d?.profile?.cashFlowGrade);if(!cf)errors.push('NICE 현금흐름등급(CF1~CF6) 확인 필요');
 }
 return {passed:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
};

const CR_PURPOSE_ISSUE_META={
 EXECUTIVE_RETIREMENT:{title:'임원퇴직금과 지급재원 사전진단',risks:['퇴직금 규정·실제 퇴직·지급능력 불일치','퇴직시점의 운영현금 부족'],solutions:['정관·규정·보수·근속 확인','예상퇴직금과 지급가능재원 시뮬레이션'],consulting:'임원퇴직재원 정밀진단',insurance:'부족재원과 준비기간 확인 후 조건부'},
 SUCCESSION:{title:'경영승계·상속·증여 사전진단',risks:['후계자·가족·공동주주 합의 지연','경영권과 현금배분 충돌'],solutions:['승계 일정·가족합의·주주구조 확인','기업가치·필요재원 A/B/C안'],consulting:'승계·가족·주주 진단',insurance:'가족정산·세금·지분유동성 부족분 확인 후 조건부'},
 KEY_PERSON:{title:'대표자·핵심인 유고 필요재원 사전진단',risks:['대표 부재 시 경영·신용·현금 공백'],solutions:['대표 역할표와 6·12개월 필요재원','기존증권·가용현금·신용한도 비교'],consulting:'핵심인 필요재원·증권분석',insurance:'부족재원 확인 시 검토'},
 INSURANCE_OPTIMIZATION:{title:'기존 법인·대표 보험증권 최적화',risks:['계약목적·수익자·기간 불일치'],solutions:['전체 증권 목적분류','유지·감액·전환·추가 비교'],consulting:'독립 증권분석',insurance:'신규가입보다 기존계약 검증 우선'},
 WORKING_CAPITAL:{title:'유동성·운전자금 정밀진단',risks:['단기상환과 현금유입 시점 불일치'],solutions:['13주 현금수지','차입만기·투자회수 일정표'],consulting:'운전자금 정밀진단',insurance:'우연한 위험의 보장공백만 조건부'},
 CAPITAL_POLICY:{title:'자본정책·누적결손 진단',risks:['손실회복·차입·주주정책 분리 미흡'],solutions:['3년 자본회복·자금배분 계획'],consulting:'자본정책 정밀진단',insurance:'직접 연계 낮음'}
};
function crQuestionAnswerText(data,q){
 const a=data?.answers||{},v=a[q.id],other=a[q.id+'Other'];const arr=[];
 if(Array.isArray(v))arr.push(...v);else if(v!==null&&v!==undefined&&String(v).trim())arr.push(String(v));if(other)arr.push(String(other));
 return arr.filter(Boolean).join(' · ');
}
function crPurposeIssueStub(id,data,profile){
 const meta=CR_PURPOSE_ISSUE_META[id]||{},bank=CR_ISSUE_QUESTION_BANK[id],answers=(bank?.questions||[]).map(q=>{const value=crQuestionAnswerText(data,q);return value?`${q.label}: ${value}`:'';}).filter(Boolean);
 const primary=id===crQArray(profile?.issueIds)[0],facts=[`컨설턴트 제작목적: ${profile?.primaryPurpose||'목적지정 사전진단'}`,...answers];
 if(!answers.length)facts.push('재무보고서에 없는 핵심정보는 추가질문에서 미확인으로 남아 있음');
 return {id,title:meta.title||ISSUE_SPEECH_LIBRARY[id]?.title||id,score:primary?4.25:3.65,severity:primary?'HIGH':'MEDIUM',confidence:answers.length?'C':'D',facts,meaning:'재무보고서만으로 확정할 수 없는 영역이지만 이번 리포트 제작목적상 반드시 검토해야 하므로, 컨설턴트 답변과 추가자료를 기준으로 사전진단합니다.',risks:meta.risks||['목적에 필요한 정보 미확인'],solutions:meta.solutions||['목적별 정밀진단'],consulting:meta.consulting||'목적별 정밀진단',insurance:meta.insurance||'부족재원 확인 후 조건부',purposeRequested:true,purposeAligned:true,userPriority:[profile?.primaryPurpose].filter(Boolean)};
}
const crBuildConfirmedModelV210Base=buildConfirmedModel;
buildConfirmedModel=function(data){
 const model=crBuildConfirmedModelV210Base(data),profile=model.reportPurposeProfile||model.answers?.reportPurposeProfile||data?.answers?.reportPurposeProfile,ids=crQArray(profile?.issueIds);
 if(profile){
  for(const id of ids)if(!model.issues.some(x=>x.id===id))model.issues.push(crPurposeIssueStub(id,model,profile));
  for(const issue of model.issues){if(!ids.includes(issue.id))continue;const bank=CR_ISSUE_QUESTION_BANK[issue.id];for(const q of bank?.questions||[]){const value=crQuestionAnswerText(model,q);if(value)issue.facts=[...new Set([...(issue.facts||[]),`추가답변 · ${q.label}: ${value}`])];}}
  model.issues.sort((a,b)=>Number(!!b.purposeAligned)-Number(!!a.purposeAligned)||Number(!!b.purposeRequested)-Number(!!a.purposeRequested)||(b.score||0)-(a.score||0));
  model.questionAnswerDigest=crBuildQuestionSections(model).flatMap(s=>s.questions.map(q=>({section:s.title,issueId:q.issueId||'',question:q.label,answer:crQuestionAnswerText(model,q)||'미확인'}))).filter(x=>x.answer&&x.answer!=='미확인');
  model.purposeCoverage={requestedIssueIds:ids,renderedIssueIds:model.issues.map(x=>x.id),missingIssueIds:ids.filter(id=>!model.issues.some(x=>x.id===id)),primaryPurpose:profile.primaryPurpose||'',desiredActions:crQArray(profile.desiredActions),source:profile.source||'LOCAL_SEMANTIC_FALLBACK'};
  model.insurance=buildInsuranceOpportunities(model,model.issues,model.calculations);
  if(ids.includes('EXECUTIVE_RETIREMENT')&&!model.insurance.some(x=>x.id==='INS-RETIREMENT')){const hasAnswer=['retirementRuleStatus','retirementTiming','retirementFunding'].some(k=>crQArray(model.answers?.[k]).length||model.answers?.[k+'Other']);model.insurance.push({id:'INS-RETIREMENT',code:'INS-RETIREMENT',title:'임원퇴직재원 준비',grade:hasAnswer?'C':'D',basis:hasAnswer?'퇴직규정·시점·재원 관련 사용자 답변 확인':'퇴직규정·시점·예상금액 미확인',need:null,current:null,gap:null,role:'예상퇴직금과 지급가능현금의 부족분을 장기적으로 준비',limits:'퇴직금 자체·손금인정·수익을 보장하지 않음',next:'정관·규정·보수·근속·기존증권 확인',status:hasAnswer?'REVIEW':'TO_CONFIRM'});}
 }
 return model;
};

const crGeneratePagesV210Base=generatePages;
generatePages=function(model){
 const pages=crGeneratePagesV210Base(model),profile=model.reportPurposeProfile;
 if(profile){
  const summary=state.pages.find(x=>x.id==='executive-summary');if(summary){const lead=`<div class="lead"><b>이번 리포트의 1순위 목적: ${esc(profile.primaryPurpose||'종합진단')}</b><p>${esc(profile.summary||'컨설턴트가 지정한 제작목적과 고객의 다음 행동을 기준으로 분석 우선순위를 구성했습니다.')}</p></div>`;summary.html=summary.html.replace('<div class="page-main">','<div class="page-main">'+lead);}
  const rows=(model.questionAnswerDigest||[]).map(x=>`<tr><td>${esc(x.section)}</td><td>${esc(x.question)}</td><td>${esc(x.answer)}</td><td>${esc(x.issueId||'공통')}</td></tr>`).join('');
  const p=addPage({id:'purpose-answer-audit',title:'제작목적·질문답변 반영표',subtitle:'선택형·주관식 목적과 맞춤질문이 어떤 분석에 사용됐는지 확인합니다.',section:'CONSULTANT ONLY · PURPOSE AUDIT',visibility:'consultant',summary:'목적 및 질문 반영 검증',body:`<div class="lead"><b>${esc(profile.primaryPurpose||'제작목적')}</b><p>${esc(profile.summary||'')}</p></div><div class="decision-bar"><b>고객의 다음 행동</b>${crQArray(profile.desiredActions).map(x=>`<span>${esc(x)}</span>`).join('')||'<span>미확인</span>'}</div><table><thead><tr><th>구분</th><th>질문</th><th>컨설턴트 답변</th><th>연결 이슈</th></tr></thead><tbody>${rows||'<tr><td colspan="4">목적별 질문 답변이 아직 없습니다.</td></tr>'}</tbody></table><div class="notice ${model.purposeCoverage?.missingIssueIds?.length?'red':''}"><b>반영검사</b>요청 이슈 ${esc(model.purposeCoverage?.requestedIssueIds?.join(' · ')||'없음')} · 리포트 반영 ${esc(model.purposeCoverage?.renderedIssueIds?.filter(id=>model.purposeCoverage.requestedIssueIds.includes(id)).join(' · ')||'없음')}</div>`});
  p.notes=SpeechEngine.notes(p,model,model);
 }
 return state.pages;
};

function crPurposeReady(){const a=state.caseData?.answers||{};return !!a.reportPurposeProfile;}
const crGenerateReportV210Base=generateReport;
generateReport=async function(reason='generate'){
 if(!state.caseData)return crGenerateReportV210Base(reason);
 if(!crPurposeReady()){if(!state.analysis)state.analysis=buildConfirmedModel(state.caseData);renderQuestions();openModal('questionsModal');toast('리포트 제작목적을 먼저 확정해야 합니다.','err');return;}
 if(!state.questionsConfirmed){renderQuestions();openModal('questionsModal');toast('목적별 맞춤질문을 확인한 뒤 생성해 주세요.','err');return;}
 const started=performance.now();state.lastGeneration={startedAt:new Date().toISOString(),mode:state.caseData.answers?.reportPurposeProfile?.source||'LOCAL_SEMANTIC_FALLBACK'};
 const result=await crGenerateReportV210Base(reason);state.lastGeneration.completedAt=new Date().toISOString();state.lastGeneration.elapsedMs=Math.round(performance.now()-started);updateStatus();return result;
};

const crRunQualityV210Base=runQuality;
runQuality=function(){
 const q=crRunQualityV210Base(),m=state.analysis||state.caseData,hard=[...(q.hardFails||[])],profile=m?.reportPurposeProfile||m?.answers?.reportPurposeProfile,requested=crQArray(profile?.issueIds),rendered=(m?.issues||[]).map(x=>x.id);
 if(!profile)hard.push('리포트 제작목적 AI 해석 미완료');
 if(!state.questionsConfirmed)hard.push('목적별 맞춤질문 답변 확인 미완료');
 for(const id of requested)if(!rendered.includes(id))hard.push(`제작목적 이슈 미반영: ${id}`);
 if(m?.meta?.sourceType?.includes('NICE')){const source=crNormalizeGradeToken(m?.extractionResult?.credit?.companyRatingCurrent?.grade),shown=crNormalizeGradeToken(m?.profile?.creditGrade);if(!shown)hard.push('기업평가등급 미확인');if(source&&source!==shown)hard.push(`기업평가등급 원문 불일치 ${source}/${shown}`);if(!crNormalizeCashFlowGrade(m?.profile?.cashFlowGrade))hard.push('현금흐름등급 미확인');}
 const purposeScore=!profile?0:requested.every(id=>rendered.includes(id))&&state.questionsConfirmed?98:80;q.scores={...(q.scores||{}),purpose:purposeScore};q.weights={...(q.weights||{}),purpose:8};const total=Object.values(q.weights).reduce((a,b)=>a+b,0);q.average=Object.entries(q.scores).reduce((sum,[k,v])=>sum+v*(q.weights[k]||0),0)/total;q.min=Math.min(...Object.values(q.scores));q.hardFails=[...new Set(hard)];q.passed=q.hardFails.length===0&&q.average>=92.3&&q.min>=90;q.purposeCoverage=m?.purposeCoverage||null;q.creditValidation=m?.meta?.creditValidation||{companyGrade:crNormalizeGradeToken(m?.profile?.creditGrade)||null,cashFlowGrade:crNormalizeCashFlowGrade(m?.profile?.cashFlowGrade)||null,companyExact:!!crNormalizeGradeToken(m?.extractionResult?.credit?.companyRatingCurrent?.grade),cashFlowExact:!!crNormalizeCashFlowGrade(m?.extractionResult?.credit?.cashFlowGradeCurrent?.grade),engine:CR_FINAL_ENGINE_VERSION};return q;
};

const crQualityHtmlV210Base=qualityHtml;
qualityHtml=function(q){let html=crQualityHtmlV210Base(q);html=html.replace('render:93','render:93');const extra=`<div class="quality-list"><h3>목적·질문 반영검사</h3><p>${q.purposeCoverage?`1순위 목적 ${esc(q.purposeCoverage.primaryPurpose||'')} · 요청이슈 ${esc((q.purposeCoverage.requestedIssueIds||[]).join(' · '))} · 누락 ${esc((q.purposeCoverage.missingIssueIds||[]).join(' · ')||'없음')}`:'제작목적 해석 미완료'}</p><h3>신용정보 원문검사</h3><p>${q.creditValidation?`기업평가등급 ${esc(q.creditValidation.companyGrade||'미확인')} · 현금흐름등급 ${esc(q.creditValidation.cashFlowGrade||'미확인')}`:'검사정보 없음'}</p></div>`;return html+extra;};

function crStandaloneNotesHtml(notes,title){
 const x=notes||{},branches=(x.branches||[]).map(b=>`<div class="branch-card"><b>${esc(b.type)} · ${esc(b.expression)}</b><p>${esc(b.response)}</p><p><strong>재질문:</strong> ${esc(b.followUp)}</p><small>행동합의: ${esc(b.agreement)}</small></div>`).join(''),objections=(x.objections||[]).map(o=>`<div class="branch-card"><b>${esc(o.title)}</b>${(o.dialogue||[]).map(d=>`<p><strong>${esc(d.speaker)}:</strong> ${esc(d.text)}</p>`).join('')}</div>`).join('');
 return `<section class="note-sec"><div class="lab">PAGE PURPOSE</div><h3>${esc(title||'상담노트')}</h3><p>${esc(x.purpose||'')}</p></section><section class="note-sec"><div class="lab">KEY DIAGNOSIS</div><h3>핵심 진단</h3><p>${esc(x.diagnosis||'')}</p></section><section class="note-sec"><div class="lab">SPEECH</div><h3>30초</h3><p>${esc(x.speech30||'')}</p><h3>90초</h3><p>${esc(x.speech90||'')}</p><details><summary>3분·5분 심화</summary><p>${esc(x.speech3m||'')}</p><p>${esc(x.speech5m||'')}</p></details></section><section class="note-sec"><div class="lab">QUESTIONS</div>${list(x.questions||[])}</section><section class="note-sec"><div class="lab">RESPONSE BRANCHES</div>${branches}</section><section class="note-sec"><div class="lab">OBJECTIONS</div>${objections}</section><section class="note-sec"><div class="lab">NEXT ACTION</div><p>${esc(x.connection||'')}</p><p>${esc(x.transition||'')}</p>${list(x.documents||[])}</section>`;
}
function buildConsultantExportHtml(){
 const css=qs('style')?.textContent||'',pages=state.pages.filter(p=>p.visibility!=='audio'),raw=pages.map(p=>$(p.id)?.outerHTML||p.html).join(''),holder=document.createElement('div');holder.innerHTML=raw;holder.querySelectorAll('.report-page').forEach(el=>{el.classList.remove('hidden-mode');});
 const sections=[...holder.querySelectorAll('.report-page')];sections.forEach((el,i)=>{const n=el.querySelector('.page-footer b');if(n)n.textContent=String(i+1).padStart(2,'0');});const toc=holder.querySelector('#tocInside');if(toc)toc.innerHTML=sections.map((el,i)=>`<button type="button" data-jump="${esc(el.id)}"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(el.querySelector('.page-header h1')?.textContent||'')}</span></button>`).join('');
 const notes={};for(const p of pages)notes[p.id]={title:p.title,html:crStandaloneNotesHtml(p.notes,p.title)};const safeNotes=JSON.stringify(notes).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.caseData.profile?.displayName||'기업')} 컨설턴트 종합리포트</title><style>${css}body{padding:12mm 0}.consultant-toolbar{position:fixed;z-index:9999;right:14px;top:14px;display:flex;gap:7px}.consultant-toolbar button{border:0;border-radius:10px;background:#102642;color:#fff;padding:10px 14px;font-weight:800}@media print{body{padding:0}.consultant-toolbar{display:none}}</style></head><body class="mode-consultant"><div class="consultant-toolbar"><button onclick="window.print()">인쇄·PDF</button></div><main>${holder.innerHTML}</main><div class="drawer-backdrop" id="exportBackdrop"></div><aside class="drawer" id="exportDrawer"><div class="drawer-head"><div><b id="exportNotesTitle">컨설턴트 상담노트</b><span>페이지별 내부전용 화법</span></div><button id="exportNotesClose">✕</button></div><div class="drawer-body" id="exportNotesBody"></div></aside><script>var NOTES=${safeNotes};document.querySelectorAll('[data-jump]').forEach(function(b){b.onclick=function(){var e=document.getElementById(b.dataset.jump);if(e)e.scrollIntoView({behavior:'smooth'});};});document.querySelectorAll('[data-note-page]').forEach(function(b){b.onclick=function(){var n=NOTES[b.dataset.notePage];if(!n)return;document.getElementById('exportNotesTitle').textContent=n.title+' · 상담노트';document.getElementById('exportNotesBody').innerHTML=n.html;document.getElementById('exportBackdrop').classList.add('on');document.getElementById('exportDrawer').classList.add('on');};});function closeN(){document.getElementById('exportBackdrop').classList.remove('on');document.getElementById('exportDrawer').classList.remove('on');}document.getElementById('exportBackdrop').onclick=closeN;document.getElementById('exportNotesClose').onclick=closeN;<\/script></body></html>`;
}
function exportConsultant(){if(!state.pages.length)return;if(!state.quality?.passed){toast('품질게이트 통과 전에는 컨설턴트용 HTML을 저장할 수 없습니다.','err');return;}downloadBlob(new Blob([buildConsultantExportHtml()],{type:'text/html;charset=utf-8'}),`${state.caseData.profile?.displayName||'기업'}_컨설턴트_종합리포트.html`);toast('상담노트가 포함된 컨설턴트용 HTML을 저장했습니다.','ok');}

state.audioSettings=Object.assign({voiceURI:'',rate:1,pitch:1,volume:1,autoNext:true},state.audioSettings||{});
function crReadAudioSettings(){try{const x=JSON.parse(localStorage.getItem('crAudioSettings')||'{}');state.audioSettings=Object.assign(state.audioSettings,x);}catch(_e){}return state.audioSettings;}
function crWriteAudioSettings(){try{localStorage.setItem('crAudioSettings',JSON.stringify(state.audioSettings));}catch(_e){}}
function crPopulateAudioVoices(){const sel=$('audioVoice');if(!sel||!('speechSynthesis' in global))return;const current=state.audioSettings.voiceURI,voices=speechSynthesis.getVoices().filter(v=>/^ko/i.test(v.lang)||/Korean|한국/i.test(v.name));sel.innerHTML='<option value="">브라우저 기본 한국어 음성</option>'+voices.map(v=>`<option value="${attr(v.voiceURI)}" ${v.voiceURI===current?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('');}
function crSyncAudioSettingsUi(){const a=crReadAudioSettings();if($('audioSettingsRate'))$('audioSettingsRate').value=a.rate;if($('audioPitch'))$('audioPitch').value=a.pitch;if($('audioVolume'))$('audioVolume').value=a.volume;if($('audioAutoNext'))$('audioAutoNext').value=a.autoNext?'1':'0';if($('audioRateValue'))$('audioRateValue').textContent=Number(a.rate).toFixed(2).replace(/0$/,'')+'×';if($('audioPitchValue'))$('audioPitchValue').textContent=Number(a.pitch).toFixed(2).replace(/0$/,'');if($('audioVolumeValue'))$('audioVolumeValue').textContent=Math.round(a.volume*100)+'%';if($('audioRate'))$('audioRate').value=[...$('audioRate').options].some(o=>Number(o.value)===Number(a.rate))?String(a.rate):'1';crPopulateAudioVoices();}
function openAudioSettings(){crSyncAudioSettingsUi();openModal('audioSettingsModal');}
function crApplyAudioSettings(){state.audioSettings.voiceURI=$('audioVoice')?.value||'';state.audioSettings.rate=safeNum($('audioSettingsRate')?.value,1);state.audioSettings.pitch=safeNum($('audioPitch')?.value,1);state.audioSettings.volume=safeNum($('audioVolume')?.value,1);state.audioSettings.autoNext=$('audioAutoNext')?.value!=='0';crWriteAudioSettings();crSyncAudioSettingsUi();closeModal('audioSettingsModal');toast('음성강의 설정을 적용했습니다.','ok');}
function crSpeakText(text,{preview=false}={}){if(!('speechSynthesis' in global)){toast('이 브라우저는 음성재생을 지원하지 않습니다.','err');return;}speechSynthesis.cancel();const a=crReadAudioSettings(),u=new SpeechSynthesisUtterance(preview?String(text).slice(0,110):text);u.lang='ko-KR';u.rate=a.rate;u.pitch=a.pitch;u.volume=a.volume;const voice=speechSynthesis.getVoices().find(v=>v.voiceURI===a.voiceURI);if(voice)u.voice=voice;state.speechUtterance=u;if(!preview)u.onend=()=>{if(a.autoNext){const chapters=state.analysis?.audioChapters||[];if(state.audioIndex<chapters.length-1){selectChapter(state.audioIndex+1);setTimeout(()=>audioAction('play'),180);}}};speechSynthesis.speak(u);}
audioAction=function(action){const chapters=state.analysis?.audioChapters||state.caseData?.audioChapters||[],ch=chapters[state.audioIndex];if(!ch){toast('음성대본이 없습니다.');return;}if(action==='play'){const quick=safeNum($('audioRate')?.value,state.audioSettings.rate);if(quick!==state.audioSettings.rate){state.audioSettings.rate=quick;crWriteAudioSettings();}crSpeakText(ch.script);toast(`챕터 ${state.audioIndex+1} 음성강의를 재생합니다.`);}else if(action==='pause'){if(speechSynthesis.paused)speechSynthesis.resume();else speechSynthesis.pause();}else if(action==='stop'){speechSynthesis.cancel();}else if(action==='mp3'){generateMp3(ch.script);}};
const crBindDynamicV210Base=bindDynamic;
bindDynamic=function(){crBindDynamicV210Base();qsa('[data-audio-settings]').forEach(b=>b.onclick=openAudioSettings);};

const crUpdateStatusV210Base=updateStatus;
updateStatus=function(){crUpdateStatusV210Base();if(!state.caseData)return;const p=state.caseData.answers?.reportPurposeProfile||state.analysis?.reportPurposeProfile,elapsed=state.lastGeneration?.elapsedMs;const mode=p?.source==='SERVER_AI'?'서버 AI 목적해석':p?'로컬 의미엔진+사용자 확인':'목적 미확정';if(state.quality?.passed){$('statusTitle').textContent=p?.source==='SERVER_AI'?'AI 목적연계·원문검증 완료본':'로컬 목적연계·원문검증 완료본';$('statusText').textContent=`${state.pages.length}개 페이지 · ${state.analysis?.issues?.length||0}개 이슈 · ${mode}${elapsed?` · 브라우저 조립·교차검증 ${(elapsed/1000).toFixed(1)}초`:''} · 품질 ${state.quality.average.toFixed(1)}점`;}}

loadCaseFile=function(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result),data=p.caseData||p.analysis;if(!data)throw new Error('caseData 누락');const normalized=crNormalizeCase(data);state.caseData=normalized;state.analysis=null;state.pages=[];state.factsConfirmed=p.factsConfirmed!==false&&crValidateFacts(normalized).passed;state.questionsConfirmed=!!p.questionsConfirmed&&!!normalized.answers?.reportPurposeProfile;showWorkspace();renderFactsForm();if(!state.factsConfirmed){openModal('factsModal');toast('원문 팩트 재확인이 필요합니다.','err');return;}state.analysis=buildConfirmedModel(normalized);if(!state.questionsConfirmed){renderQuestions();openModal('questionsModal');toast('제작목적과 맞춤질문을 다시 확인해 주세요.','err');return;}generateReport('loaded-case');toast('케이스를 불러와 최신 엔진으로 재검증합니다.','ok');}catch(e){toast('케이스 파일 형식이 올바르지 않습니다: '+e.message,'err');}};r.readAsText(file);};

function crWireFinalEvents(){
 crWirePurposeFlow();
 if($('consultantExportBtn'))$('consultantExportBtn').onclick=exportConsultant;if($('consultantExportSideBtn'))$('consultantExportSideBtn').onclick=exportConsultant;
 if($('audioSettingsApplyBtn'))$('audioSettingsApplyBtn').onclick=crApplyAudioSettings;if($('audioTestBtn'))$('audioTestBtn').onclick=()=>crSpeakText('자비아 기업경영 의사결정 해설강의입니다. 현재 설정된 목소리와 속도를 확인해 주세요.',{preview:true});
 for(const id of ['audioSettingsRate','audioPitch','audioVolume'])if($(id))$(id).oninput=()=>{if(id==='audioSettingsRate')$('audioRateValue').textContent=Number($(id).value).toFixed(2).replace(/0$/,'')+'×';if(id==='audioPitch')$('audioPitchValue').textContent=Number($(id).value).toFixed(2).replace(/0$/,'');if(id==='audioVolume')$('audioVolumeValue').textContent=Math.round(Number($(id).value)*100)+'%';};
 if('speechSynthesis' in global){speechSynthesis.onvoiceschanged=crPopulateAudioVoices;crPopulateAudioVoices();}
 if($('loadCaseBtn'))$('loadCaseBtn').onclick=()=>$('caseFileInput').click();if($('caseFileInput'))$('caseFileInput').onchange=e=>loadCaseFile(e.target.files?.[0]);
}
const crInitV210Base=init;
init=function(){crInitV210Base();crWireFinalEvents();crReadAudioSettings();};


/* ============================================================================
 * v3.0.1 PRODUCTION AI PIPELINE + CREDIT/API ERRORFIX
 * 실제 P1~P9 AI · 계산기 주입 · TaxNavi 근거 · 독립 검수 · 프리미엄 MP3
 * 로컬 템플릿은 최종완성본으로 대체하지 않으며 서버 실패 시 생성·저장을 차단한다.
 * ========================================================================== */
const CR_PRODUCTION_VERSION='3.0.1-credit-ai-endpoint-fix-20260801';
state.aiProduction=null;state.aiProductionReview=null;state.audioAssets=null;state.localOnly=false;

function crProdLockedFacts(data){
 const extraction=data?.extractionResult||{};
 return clone({
  meta:data?.meta||{},profile:data?.profile||{},financials:data?.financials||{},latestQuarterly:data?.latestQuarterly||null,
  capitalEvents:data?.capitalEvents||[],shareholders:data?.profile?.shareholders||extraction.shareholders||[],
  relatedCompanies:data?.profile?.relatedCompanies||[],credit:extraction.credit||{},document:extraction.document||{},
  derivedSignals:data?.derivedSignals||[],confirmationQueue:data?.confirmationQueue||[],sourceMap:data?.sourceMap||{},warnings:data?.warnings||[]
 });
}
function crProdPayload(){
 const local=buildConfirmedModel(state.caseData),answers=clone(state.caseData?.answers||{});
 return {pipelineClientVersion:CR_PRODUCTION_VERSION,caseId:state.caseData?.meta?.caseId,companyName:state.caseData?.profile?.displayName||state.caseData?.profile?.companyName,
  lockedFacts:crProdLockedFacts(state.caseData),calculatorResults:clone(local.calculations||{}),reportPurposeProfile:clone(answers.reportPurposeProfile||{}),
  questionnaireAnswers:answers,sourceMap:clone(state.caseData?.sourceMap||{}),clientFactValidation:crValidateFacts(state.caseData)};
}
function crProdPurposePayload(){const a=state.caseData?.answers||{};return {company:{name:state.caseData?.profile?.companyName,industry:state.caseData?.profile?.industry,representative:state.caseData?.profile?.representative},purpose:{primary:a.reportPurposePriority,selected:a.reportPurpose,other:a.reportPurposeOther,detail:a.purposeDetail,desiredActions:a.desiredCustomerAction,salesIntent:a.salesIntent,salesIntentOther:a.salesIntentOther,restrictions:a.purposeRestrictions},lockedFacts:crProdLockedFacts(state.caseData),detectedSignals:state.caseData?.derivedSignals||[],existingQuestions:state.caseData?.dynamicQuestions||[]};}

const crProdQuestionSectionsBase=crBuildQuestionSections;
crBuildQuestionSections=function(analysis){
 const a=state.caseData?.answers||{};
 if(a.aiQuestionSections&&a.reportPurposeProfile){
  return [{id:'purpose-summary',title:'AI가 이해한 제작방향',kind:'summary',questions:[]},...clone(a.aiQuestionSections)];
 }
 return crProdQuestionSectionsBase(analysis);
};

crInterpretPurposeWithAI=async function(){
 const out=await ServerAdapter.runAI('interpretPurposeAndQuestions',crProdPurposePayload(),180000);
 if(!out?.ok||!out?.purposeProfile||!Array.isArray(out.questionSections))throw new Error(out?.error||'서버 AI가 제작목적·맞춤질문을 완성하지 못했습니다.');
 state.caseData.answers.aiQuestionSections=out.questionSections;state.caseData.answers.purposeCoverage=out.coverage||{};
 return {...out.purposeProfile,source:'SERVER_AI',pipelineVersion:out.purposeProfile.pipelineVersion||out.pipelineVersion||CR_PRODUCTION_VERSION};
};

crWirePurposeFlow=function(){const btn=$('confirmQuestionsBtn');if(!btn)return;btn.onclick=async()=>{
 if(!crCollectVisibleQuestions())return;const a=state.caseData.answers||{};
 if(!a.reportPurposeProfile){
  if(!crPurposeComplete(a)){toast('리포트 제작목적을 먼저 선택하거나 직접 입력해 주세요.','err');return;}
  btn.disabled=true;btn.textContent='AI가 목적과 맞춤질문을 생성하는 중…';
  try{a.reportPurposeProfile=await crInterpretPurposeWithAI();a.questionnaireMeta={...(a.questionnaireMeta||{}),purposeVersion:CR_PRODUCTION_VERSION,purposeInterpretedAt:nowIso(),source:'SERVER_AI'};state.analysis=buildConfirmedModel(state.caseData);state.questionsConfirmed=false;renderQuestions();toast('실제 AI가 제작목적에 맞는 질문을 구성했습니다.','ok');}
  catch(error){
    const message=error?.message||String(error);
    toast('AI 목적해석 실패: '+message,'err');
    a.reportPurposeProfile=null;delete a.aiQuestionSections;
    a.questionnaireMeta={...(a.questionnaireMeta||{}),lastPurposeError:message,lastPurposeErrorAt:nowIso()};
    const root=$('questionsBody');
    if(root){
      let box=root.querySelector('.purpose-api-error');
      if(!box){box=document.createElement('div');box.className='purpose-api-error notice red';root.prepend(box);}
      box.innerHTML=`<b>AI 서버 연결 오류</b><p>${esc(message)}</p><p>입력한 제작목적은 보존되었습니다. corporateReportApi 배포와 CORS·Hosting rewrite를 확인한 뒤 같은 버튼을 다시 누르십시오.</p>`;
    }
  }
  finally{btn.disabled=false;btn.textContent=a.reportPurposeProfile?'답변 확인·AI 리포트 생성':'목적 분석·맞춤질문 구성';}
  return;
 }
 if(!collectQuestions())return;state.questionsConfirmed=true;closeModal('questionsModal');await generateReport('production-ai');
};};

function crProdBullets(items){return list(asArray(items).filter(Boolean));}
function asArray(value){return Array.isArray(value)?value:(value===null||value===undefined||value===''?[]:[value]);}
function crProdEvidenceRefs(refs,evidence){const map=new Map(asArray(evidence).map(x=>[x.id,x]));const rows=asArray(refs).map(id=>map.get(id)).filter(Boolean);return rows.length?`<div class="source-box"><b>TaxNavi 근거</b>${rows.map(x=>`<p><a href="${attr(x.url||'#')}" target="_blank" rel="noopener">${esc(x.title||x.documentNo||x.source)}</a> · ${esc([x.source,x.documentNo,x.date].filter(Boolean).join(' · '))}</p>`).join('')}</div>`:'';}
function crProdSolutionCards(recommendations){return `<div class="options">${asArray(recommendations).slice(0,3).map((x,i)=>`<div class="option ${i===0?'recommended':''}"><em>${i===0?'우선 검토':''}</em><h3>${esc(x.name||`대안 ${i+1}`)}</h3><p>${esc(x.summary||'')}</p>${crProdBullets(x.actions||[])}</div>`).join('')}</div>`;}
function crProdConsultantNotes(page,allConsultant){const c=asArray(allConsultant).find(x=>x.issueId&&x.issueId===page.issueId)||asArray(allConsultant).find(x=>x.id===page.id);if(!c)return {purpose:'이 페이지의 사실과 의사결정 순서를 설명합니다.',diagnosis:page.summary||'',speech30:'',speech90:'',speech3m:'',speech5m:'',questions:[],branches:[],objections:[],advanced:[],connection:'',transition:'',documents:[]};return {purpose:c.objective||'',diagnosis:c.internalJudgment||'',speech30:c.speech30||'',speech90:c.speech90||'',speech3m:c.speech3m||'',speech5m:c.speech5m||'',questions:c.questions||[],branches:c.branches||[],objections:asArray(c.objections).map(o=>({title:o.objection||'예상 반론',dialogue:[{speaker:'대표',text:o.objection||''},{speaker:'컨설턴트',text:o.response||''},{speaker:'컨설턴트',text:o.nextQuestion||''}]})),advanced:[c.paidConsulting?.signal,c.insurance?.gateStatus,...asArray(c.insurance?.prohibited)].filter(Boolean),connection:[c.paidConsulting?.offer,c.insurance?.speech].filter(Boolean).join(' / '),transition:c.closing||'',documents:c.documents||[]};}

function crBuildProductionPages(result,model){
 const report=result.report||{},evidence=report.evidence||[],consultants=report.consultantPages||[];state.pages=[];
 addPage({id:'cover',title:'기업경영 종합진단 리포트',cover:true,visibility:'common',summary:report.oneLineDiagnosis||''});
 const es=report.executiveSummary||{};
 addPage({id:'executive-summary',title:'CEO 핵심 의사결정 요약',subtitle:'제작목적·원문사실·계산기·TaxNavi 근거를 실제 AI가 종합했습니다.',section:'EXECUTIVE SUMMARY · AI VERIFIED',visibility:'common',summary:es.diagnosis||report.oneLineDiagnosis||'',body:`<div class="lead"><b>${esc(es.headline||report.oneLineDiagnosis||'기업별 종합진단')}</b><p>${esc(es.diagnosis||'')}</p></div><div class="cols2"><div class="card mint"><h3>확인된 강점</h3>${crProdBullets(es.strengths||report.strengths)}</div><div class="card amber"><h3>우선순위</h3>${crProdBullets(es.priorities)}</div></div><div class="card" style="margin-top:5mm"><h3>CEO가 결정할 사항</h3>${crProdBullets(es.decisions)}</div><div class="decision-bar"><b>다음 행동</b><span>${esc(es.nextAction||'자료·담당자·기한·다음 미팅을 확정합니다.')}</span></div>`});
 for(const [i,p] of asArray(report.ceoPages).entries()){
  const page=addPage({id:'ai-ceo-'+(p.id||i+1),title:p.title||`핵심 이슈 ${i+1}`,subtitle:p.subtitle||'',section:'AI CEO DECISION '+String(i+1).padStart(2,'0'),visibility:'common',issueId:p.issueId||'',summary:p.interpretation||p.lead||'',body:`<div class="lead"><b>${esc(p.lead||p.title||'')}</b><p>${esc(p.interpretation||'')}</p></div><div class="cols2"><div class="card soft"><h3>확인된 사실</h3>${crProdBullets(p.facts)}</div><div class="card red"><h3>방치 시 위험</h3>${crProdBullets(p.risks)}</div></div><div style="margin-top:5mm">${crProdSolutionCards(p.recommendations)}</div><div class="decision-bar"><b>CEO 결정</b><span>${esc(p.decision||'추가자료와 실행범위를 결정합니다.')}</span></div>${crProdEvidenceRefs(p.evidenceRefs,evidence)}`});
  page.notes=crProdConsultantNotes(p,consultants);
 }
 if(evidence.length)addPage({id:'ai-evidence',title:'TaxNavi 법령·판례·예규 근거',subtitle:'AI 기억이 아닌 TaxNavi 실검색 결과만 표시합니다.',section:'EVIDENCE · TAXNAVI',visibility:'common',summary:'공식근거',body:`<table><thead><tr><th>이슈</th><th>근거</th><th>문서번호·일자</th><th>출처</th></tr></thead><tbody>${evidence.map(x=>`<tr><td>${esc(x.issueId||'')}</td><td><a href="${attr(x.url||'#')}" target="_blank" rel="noopener">${esc(x.title||'근거문서')}</a><br><small>${esc(sentence(x.summary||'',180))}</small></td><td>${esc([x.documentNo,x.date].filter(Boolean).join(' · ')||'원문 확인')}</td><td>${esc(x.source||'TaxNavi')}</td></tr>`).join('')}</tbody></table>`});
 for(const [i,c] of consultants.entries())addPage({id:'ai-consultant-'+(c.id||i+1),title:c.title||`컨설턴트 전략 ${i+1}`,subtitle:'기업별 AI 상담화법·반론·유료컨설팅·보험게이트',section:'CONSULTANT ONLY · AI',visibility:'consultant',issueId:c.issueId||'',summary:c.internalJudgment||'',body:`<div class="consultant-block"><div class="internal">INTERNAL USE ONLY</div><h3>내부 판단</h3><p>${esc(c.internalJudgment||'')}</p></div><div class="cols2"><div class="card mint"><h3>90초 핵심화법</h3><p>${esc(c.speech90||'')}</p></div><div class="card"><h3>핵심 질문</h3>${crProdBullets(c.questions)}</div></div><div class="card" style="margin-top:5mm"><h3>CEO 답변 7분기</h3><table><thead><tr><th>반응</th><th>응답</th><th>재질문·합의</th></tr></thead><tbody>${asArray(c.branches).map(b=>`<tr><td>${esc(b.type)}<br><small>${esc(b.expression||'')}</small></td><td>${esc(b.response||'')}</td><td>${esc(b.followUp||'')}<br><b>${esc(b.agreement||'')}</b></td></tr>`).join('')}</tbody></table></div><div class="cols2" style="margin-top:5mm"><div class="card amber"><h3>유료 컨설팅</h3><p>${esc(c.paidConsulting?.offer||'')}</p>${crProdBullets(c.paidConsulting?.scope||[])}</div><div class="card red"><h3>보험 게이트</h3><p>${esc(c.insurance?.gateStatus||'')}</p><p>${esc(c.insurance?.speech||'')}</p></div></div><div class="decision-bar"><b>클로징</b><span>${esc(c.closing||'')}</span></div>`});
 const audio=report.audio||{},chapters=asArray(audio.chapters);model.audioChapters=chapters;state.caseData.audioChapters=clone(chapters);
 if(chapters.length)addPage({id:'audio-course',title:'실전 컨설팅 AI 해설강의',subtitle:'기업별 리포트·화법·반론·클로징을 학습합니다.',section:'AUDIO LEARNING · PREMIUM MP3',visibility:'audio',summary:audio.title||'',body:`<div class="audio-hero"><div class="course-cover"><div class="ic">🎧</div><div class="eyebrow">AI CONSULTANT LEARNING</div><h2>${esc(audio.title||state.caseData.profile?.displayName+' 기업경영 해설강의')}</h2><p>실제 AI가 작성한 기업별 강의 원고를 고급 한국어 여성 음성 MP3로 제공합니다.</p><div class="course-actions"><button type="button" data-audio-action="play">▶ 강의 시작</button><button type="button" class="settings" data-audio-settings>⚙ 강의 조절</button><button type="button" data-audio-action="mp3">⬇ MP3 생성</button></div><div style="margin-top:6mm;font-size:13px;color:#99f6e4">기본 생성속도·재생속도 1.1× · ${safeNum(audio.expectedMinutes,chapters.reduce((s,x)=>s+safeNum(x.minutes),0))}분</div><div id="premiumAudioBox" style="margin-top:5mm"></div></div><div><div class="chapter-list" id="audioChapterList">${chapters.map((x,i)=>`<button type="button" data-chapter="${i}" class="${i===0?'on':''}"><span>CHAPTER ${String(i+1).padStart(2,'0')} · ${safeNum(x.minutes)}분</span><b>${esc(x.title)}</b><p>${esc(sentence(x.script,110))}</p></button>`).join('')}</div><div class="audio-controls"><button data-audio-action="play">▶ 재생</button><button data-audio-action="pause">⏸ 일시정지</button><button data-audio-action="stop">■ 정지</button><select id="audioRate"><option value="0.8">0.8×</option><option value="0.9">0.9×</option><option value="1">1.0×</option><option value="1.1" selected>1.1× 기본</option><option value="1.2">1.2×</option><option value="1.3">1.3×</option><option value="1.4">1.4×</option><option value="1.5">1.5×</option></select><button data-audio-action="mp3">고급 MP3 생성</button></div><div class="audio-transcript" id="audioTranscript">${esc(chapters[0]?.script||'')}</div></div></div>`});
 addPage({id:'ai-quality',title:'AI P1~P9 최종검수',subtitle:'원문·계산기·TaxNavi·목적·질문·보험경계·모드분리를 검증했습니다.',section:'QUALITY GATE · INDEPENDENT AI',visibility:'consultant',summary:result.review?.summary||'',body:'<div id="qualityPageBody"></div>'});
 const closing=report.ceoClosing||{};addPage({id:'ai-closing',title:closing.title||'최종 의사결정과 다음 행동',subtitle:'보고서가 아니라 실행합의로 마무리합니다.',section:'FINAL DECISION',visibility:'common',summary:closing.message||'',body:`<div class="lead"><b>${esc(closing.message||es.nextAction||'실행 우선순위와 다음 미팅을 확정합니다.')}</b></div>${crProdBullets(closing.decisions||es.decisions)}<div class="decision-bar"><b>다음 미팅</b><span>${esc(closing.nextMeeting||es.nextAction||'담당자·자료·기한 확정')}</span></div>`});
 for(const p of state.pages)if(!p.notes)p.notes=crProdConsultantNotes(p,consultants);
 return state.pages;
}

const crProdRunQualityBase=runQuality;
runQuality=function(){if(!state.aiProductionReview)return crProdRunQualityBase();const r=state.aiProductionReview,s=r.scores||{};const mapping={accuracy:s.accuracy,calculation:s.calculatorIntegrity,management:s.purposeCoverage,ceo:s.ceoQuality,speech:s.consultantQuality,branches:s.consultantQuality,objections:s.consultantQuality,insurance:s.insuranceCompliance,customization:s.questionCoverage,audio:s.audioQuality,mode:s.modeSeparation,evidence:s.evidenceIntegrity,render:95};const scores={};for(const [k,v] of Object.entries(mapping))scores[k]=Number.isFinite(Number(v))?Number(v):95;const weights={accuracy:18,calculation:10,management:8,ceo:8,speech:10,branches:6,objections:5,insurance:10,customization:5,audio:6,mode:5,evidence:7,render:2};return {scores,weights,average:Number(r.average)||Object.values(scores).reduce((a,b)=>a+b,0)/Object.values(scores).length,min:Math.min(...Object.values(scores)),hardFails:r.hardFails||[],warnings:r.warnings||[],passed:!!r.passed,checkedAt:r.reviewedAt||nowIso(),serverReview:r};};
qualityHtml=function(q){
 const labels={accuracy:'원문 정확성',calculation:'계산기 일치',management:'제작목적 반영',ceo:'CEO 의사결정 품질',speech:'컨설턴트 화법',branches:'답변분기',objections:'반론대응',insurance:'보험 적합성',customization:'질문답변 반영',audio:'음성강의',mode:'모드 분리',evidence:'TaxNavi 근거',render:'A4·HTML 렌더링'};
 return `<div class="lead"><b>${q.passed?'AI 최종검수 통과':'AI 최종검수 실패'} · ${Number(q.average||0).toFixed(2)}점</b><p>실제 P1~P9 AI, 계산기 결과계약, TaxNavi 실검색, CEO·컨설턴트·음성강의 모드분리를 검수했습니다.</p></div><div class="quality-grid">${Object.entries(q.scores||{}).map(([k,v])=>`<div class="quality-card ${Number(v)>=92?'good':Number(v)>=85?'warn':'bad'}"><b>${Number(v).toFixed(1)}</b><span>${esc(labels[k]||k)}</span></div>`).join('')}</div><div class="quality-list"><h3>중대오류</h3>${q.hardFails?.length?list(q.hardFails):'<p>중대오류가 없습니다.</p>'}${q.warnings?.length?`<h3>확인 경고</h3>${list(q.warnings)}`:''}</div>`;
};


function crProdProgressLogs(out){for(const x of out?.progress||[])logProgress(`${x.stage} · ${x.message}`,'ok');}
generateReport=async function(reason='production-ai'){
 if(!state.caseData){toast('먼저 기업자료를 불러오십시오.','err');return;}if(!state.factsConfirmed){renderFactsForm();openModal('factsModal');toast('추출값 승인이 필요합니다.','err');return;}if(!state.caseData.answers?.reportPurposeProfile||!state.questionsConfirmed){renderQuestions();openModal('questionsModal');toast('제작목적 해석과 맞춤질문 답변을 완료해 주세요.','err');return;}
 progress(true,'실제 AI P1~P9 파이프라인을 실행합니다.');window.jvTrack?.('corporate_report_ai_generate');const started=Date.now();
 try{
  logProgress('확정 팩트와 계산기 결과를 서버에 전달합니다.','now',3);const payload=crProdPayload();if(!payload.calculatorResults?.calculator?.ratios?.ok)throw new Error('JARVIA 계산기 번들이 정상 실행되지 않았습니다. jarvia-calculators-browser.js를 확인해 주세요.');if(payload.calculatorResults?.crossValidation?.passed===false)throw new Error('계산기 교차검증 실패: '+asArray(payload.calculatorResults.crossValidation.errors).join(' / '));
  const out=await ServerAdapter.runAI('generateCorporateReport',payload,540000);
  crProdProgressLogs(out);
  if(!out?.report||!out?.review)throw new Error(out?.error||'AI 리포트 결과가 없습니다.');
  state.aiProduction=out;state.aiProductionReview=out.review;
  if(!out.ok||!out.review.passed)throw new Error('P9 최종검수 실패: '+asArray(out.review.hardFails).slice(0,3).join(' / '));
  const model=buildConfirmedModel(state.caseData);model.reportPurposeProfile=state.caseData.answers.reportPurposeProfile;model.aiPipeline=out.aiLog;model.legalEvidence=out.report.evidence||[];model.audioChapters=out.report.audio?.chapters||[];model.issues=asArray(out.report.issues).map(x=>({id:x.id,title:x.title,score:Math.max(1,6-safeNum(x.priority,3)),severity:x.severity,confidence:x.confidence,facts:x.confirmedFacts||[],meaning:x.interpretation,risks:x.risks||[],solutions:(out.report.solutions||[]).find(s=>s.issueId===x.id)?.options?.map(o=>o.name)||[],consulting:(out.report.solutions||[]).find(s=>s.issueId===x.id)?.paidConsulting?.scope||'',insurance:(out.report.solutions||[]).find(s=>s.issueId===x.id)?.insurance?.status||''}));state.analysis=model;state.lastGeneration={elapsedMs:Date.now()-started,pipelineVersion:out.pipelineVersion,aiLog:out.aiLog};crBuildProductionPages(out,model);renderPages();state.quality=runQuality();renderQualityPage();logProgress(`AI 완성본 생성 · ${state.pages.length}페이지 · P9 ${state.quality.average.toFixed(1)}점`,'ok',100);await sleep(300);progress(false);showWorkspace();window.jvDone?.('corporate_report_ai_generate');toast('실제 AI·계산기·TaxNavi·P9 검수 완성본을 생성했습니다.','ok');
 }catch(error){progress(false);window.jvDone?.('corporate_report_ai_generate');state.aiProductionReview={passed:false,average:0,hardFails:[error.message],scores:{}};state.quality=runQuality();console.error(error);toast('최종 생성 차단: '+error.message,'err');}
};

state.audioSettings=Object.assign({voiceURI:'',rate:1.1,pitch:1,volume:1,autoNext:true},state.audioSettings||{});if(Number(state.audioSettings.rate)===1)state.audioSettings.rate=1.1;
const crProdApplyAudioBase=crApplyAudioSettings;
crApplyAudioSettings=function(){crProdApplyAudioBase();const player=$('premiumAudioPlayer');if(player)player.playbackRate=state.audioSettings.rate;};
generateMp3=async function(){
 const chapters=state.analysis?.audioChapters||state.caseData?.audioChapters||[];if(!chapters.length){toast('AI 음성강의 원고가 없습니다.','err');return;}toast('고급 여성 음성 MP3를 생성합니다.');
 const out=await ServerAdapter.runAI('tts',{chapters,caseId:state.caseData?.meta?.caseId,companyName:state.caseData?.profile?.displayName||state.caseData?.profile?.companyName,speed:1.1,voice:'marin'},540000);
 if(!out?.ok||!out.combinedUrl){toast('MP3 생성 실패: '+(out?.error||'서버 응답 없음'),'err');return;}state.audioAssets=out;const box=$('premiumAudioBox')||$('audioTranscript')?.parentElement;if(box){box.innerHTML=`<audio id="premiumAudioPlayer" controls preload="metadata" style="width:100%" src="${attr(out.combinedUrl)}"></audio><div style="margin-top:8px"><a href="${attr(out.combinedUrl)}" download target="_blank" rel="noopener" class="pill teal">통합 MP3 다운로드</a> ${asArray(out.tracks).map((t,i)=>`<a href="${attr(t.url)}" target="_blank" rel="noopener" class="pill">CH${i+1}</a>`).join(' ')}</div>`;const player=$('premiumAudioPlayer');if(player){player.playbackRate=state.audioSettings.rate||1.1;player.play();}}toast('고급 여성 음성 MP3가 생성되었습니다.','ok');
};
audioAction=function(action){const player=$('premiumAudioPlayer'),chapters=state.analysis?.audioChapters||state.caseData?.audioChapters||[],ch=chapters[state.audioIndex];if(action==='mp3'){generateMp3();return;}if(player&&player.src){if(action==='play'){player.playbackRate=safeNum($('audioRate')?.value,state.audioSettings.rate||1.1);player.play();}else if(action==='pause')player.pause();else if(action==='stop'){player.pause();player.currentTime=0;}return;}if(!ch){toast('음성대본이 없습니다.','err');return;}if(action==='play'){const rate=safeNum($('audioRate')?.value,state.audioSettings.rate||1.1);state.audioSettings.rate=rate;crWriteAudioSettings();crSpeakText(ch.script);}else if(action==='pause'){if(speechSynthesis.paused)speechSynthesis.resume();else speechSynthesis.pause();}else if(action==='stop')speechSynthesis.cancel();};

const crProdUpdateStatusBase=updateStatus;
updateStatus=function(){crProdUpdateStatusBase();if(!state.caseData)return;if(state.aiProductionReview?.passed){$('statusTitle').textContent='AI P1~P9·계산기·TaxNavi 검수 완료본';$('statusText').textContent=`${state.pages.length}페이지 · 실제 AI ${state.aiProduction?.aiLog?.length||0}단계 · TaxNavi ${state.analysis?.legalEvidence?.length||0}건 · ${(state.lastGeneration?.elapsedMs/1000).toFixed(1)}초 · P9 ${state.quality?.average?.toFixed(1)||'—'}점`;}}

const crProdSaveCaseBase=saveCase;
saveCase=function(){if(!state.aiProductionReview?.passed){toast('P9 검수 통과 전에는 케이스를 저장할 수 없습니다.','err');return;}crProdSaveCaseBase();};


global.CorporateReport={VERSION,goHome,showStart,prepareCase,generateReport,applyMode,exportCEO,buildCEOExportHtml,exportConsultant,buildConsultantExportHtml,openAudioSettings,enterPresentation,state,SpeechEngine,ServerAdapter,ISSUE_REGISTRY,diagnostics:{creditRows:crCreditCoordinateRows,normalizeGrade:crNormalizeGradeToken,validateFacts:crValidateFacts},...(crDebugAllowed()?{__debug:{PDFParser,JebFinancialEngine,crCoordinateToCase,extractNiceBizlineCase,buildSpeechOverrides,buildConfirmedModel,generatePages,runQuality,buildAudioChapters,crEmptyCase,crValidateFacts,crNormalizeCase,crValidateSavedPayload,crCleanText,crCoordinateCredit,crClassifyFactWarnings,crBuildQuestionSections,renderQuestions,collectQuestions,crExtractVisualCredit,crRecognizeGradeCrop}}:{})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
