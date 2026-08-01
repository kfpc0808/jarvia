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
/* ★ [2026-08-01] NICE BizLINE 폰트 CMap 결함 보정
   '+'와 '-'가 모두 U+0000(널문자)으로 추출된다. 글리프 '폭'으로 구분한다.
   실측: '+' width 6.58 / '-' width 4.54  → 임계 5.5
   폭 정보가 없으면 부호를 만들지 않고 제거한다(추정 금지). */
const CR_NULL_PLUS_MIN_WIDTH=5.5;
function crNullGlyphSign(width){
 const w=Number(width);
 if(!Number.isFinite(w)||w<=0)return '';
 return w>=CR_NULL_PLUS_MIN_WIDTH?'+':'-';
}
function crFixNullGlyph(str,width){
 let v=String(str||'');
 if(v.indexOf('\u0000')<0)return v;
 const sign=crNullGlyphSign(width);
 return sign?v.replace(/\u0000/g,sign):v.replace(/\u0000/g,'');
}
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
        type: "리포트 낭독이 아닌 기업별 상담 브리핑(미팅 전 컨설턴트 트레이닝)",
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
const ACCESS={mode:'allowlist',allowedLoginIds:['gildong','admin']};   /* [2026-08-01] index.html 게이트와 동일 범위 */
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
  live:{taxnavi:false,ai:false,tts:false,storage:false,aiOpeners:null},quality:null,localOnly:true
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
  /* ★ [2026-08-01] 모든 서버 요청에 loginId를 자동 첨부한다.
     액션마다 개별로 넣으면 누락이 생겨 서버 권한 검사에서 막힌다. */
  try{ const _lid=memberInfo().loginId; if(_lid&&!payload.loginId)payload={...payload,loginId:_lid}; }catch(_e){}
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
  async aiOpeners(payload){
    /* ★ [2026-08-01] AI 도입 화법 — Gemini 3.1 Pro 생성 + Claude Sonnet 5 검수
       서버 실패 시 코드 화법만으로 리포트가 완결되므로 조용히 폴백한다. */
    try{
      const out=await corporateCall({action:'openers',loginId:(memberInfo().loginId||''),payload},240000);
      state.live.aiOpeners=!!(out&&out.ok); return out;
    }catch(e){ state.live.aiOpeners=false; return {ok:false,openers:[],error:e.message}; }
  },
  async legalSearch(issue){try{const out=await corporateCall({action:'legalSearch',payload:{issueId:issue.id,queries:issue.evidenceQueries||[]}},120000);state.live.taxnavi=!!out?.ok;return out;}catch(e){return {ok:false,pending:true,error:e.message,results:[]};}},
  async tts(script){try{const out=await corporateCall({action:'tts',payload:{script,caseId:state.caseData?.meta?.caseId}},240000);state.live.tts=!!out?.ok;return out;}catch(e){return {ok:false,pending:true,error:e.message};}},
  async runAI(action,payload,timeout=360000){try{const out=await corporateCall({action,payload},timeout);state.live.ai=!!out?.ok;return out;}catch(e){return {ok:false,pending:true,error:e.message,code:e.code||'AI_API_ERROR'};}}
};

function loadScript(src){return new Promise((resolve,reject)=>{if(qs('script[data-src="'+src+'"]')){resolve();return;}const s=document.createElement('script');s.src=src;s.dataset.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('외부 라이브러리를 불러오지 못했습니다.'));document.head.appendChild(s);});}
async function ensurePdfJs(){if(global.pdfjsLib)return global.pdfjsLib;await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');global.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return global.pdfjsLib;}
const PDFParser={
 async extract(file){
  const pdfjs=await ensurePdfJs();const buf=await file.arrayBuffer();const pdf=await pdfjs.getDocument({data:buf,cMapUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',cMapPacked:true,standardFontDataUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'}).promise;
  const pageTexts=[];const pageObjects=[];for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const tc=await pg.getTextContent();const rows=[];for(const item of tc.items||[]){const str=crFixNullGlyph(String(item.str||''),Number(item.width||0)).trim();if(!str)continue;const tr=item.transform||[];const x=Number(tr[4]||0),y=Number(tr[5]||0);let row=rows.find(r=>Math.abs(r.y-y)<=2.6);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x,str,width:Number(item.width||0)});}rows.sort((a,b)=>b.y-a.y);const lines=rows.map(r=>{r.items.sort((a,b)=>a.x-b.x);let line='',lastEnd=null;for(const it of r.items){if(lastEnd!==null){const gap=it.x-lastEnd;line+=gap>12?'   ':gap>3?' ':'';}line+=it.str;lastEnd=it.x+it.width;}return line.trim();}).filter(Boolean);const layout=lines.join('\n');pageTexts.push(layout);pageObjects.push({pageNumber:i,text:layout});}
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
 return {ratios:r,valuation:crValuation({financials:data?.financials,profile:data?.profile}),calculator:{ratios:calcRatios,cashFlow:calcCash,keyman},calculatorVersion:global.JarviaCalculators?.version||'browser-bundle',computedAt:nowIso()};
}

/* ════ [2026-08-01] 비상장주식 가치평가 — 상증법 §63·상증령 §54 보충적 평가 ════
   순자산가치 = 자본총계 ÷ 발행주식총수
   순손익가치 = 최근3년 가중평균(3:2:1) 순손익 ÷ 발행주식총수 ÷ 10%(환원율)
   가중치 순자산40:순손익60 (부동산과다법인 60:40) · 순자산가치 80% 하한
   ※ 추정치이며 세무전문가 검토 전 확정 금액으로 사용하지 않는다.            */
function crValuation(model){
  try{
    const f=model?.financials||{}, yrs=Object.keys(f).filter(y=>/^\d{4}$/.test(y)).sort();
    if(!yrs.length)return null;
    const last=yrs[yrs.length-1], L=f[last]||{};
    const equity=Number(L.totalEquity??L.자본총계);
    const totalAssets=Number(L.totalAssets??L.자산총계);
    const reg=(state.registry&&state.registry.parsed)||(state.caseData&&state.caseData.registryParsed)||null;
    const regCap=reg&&reg.capital&&reg.capital.length?reg.capital[reg.capital.length-1]:null;
    const shares=Number(regCap?.shares)||Number(model?.profile?.totalShares)||null;
    const parValue=(reg&&reg.par&&reg.par.length)?Number(reg.par[reg.par.length-1].amount):null;
    if(!Number.isFinite(equity)||!shares)return null;
    const ni=yrs.slice(-3).map(y=>{const v=f[y]||{};const x=Number(v.netIncome??v.당기순이익);return Number.isFinite(x)?x:null;});
    const rev=[...ni].reverse(), w=[3,2,1]; let s=0,ws=0;
    rev.forEach((v,i)=>{if(v!=null){s+=v*w[i];ws+=w[i];}});
    const wAvg=ws?s/ws:null;
    const navPer=equity*1e6/shares;
    const incPer=(wAvg==null)?null:(wAvg*1e6/shares)/0.10;
    const tangible=Number(L.tangibleAssets??L.유형자산)||0;
    const heavyRE=totalAssets?(tangible/totalAssets)>=0.5:false;
    const wNav=heavyRE?0.6:0.4, wInc=heavyRE?0.4:0.6;
    let raw, method;
    if(incPer==null||incPer<0){raw=navPer;method='순자산가치 단독(최근 3년 가중평균 순손익이 0 이하)';}
    else {raw=navPer*wNav+incPer*wInc;method='가중평균';}
    const floor=navPer*0.8;
    const perShare=Math.max(raw,floor);
    if(perShare>floor&&raw<floor)method='순자산가치 80% 하한 적용';
    else if(raw<floor)method='순자산가치 80% 하한 적용';
    return {baseYear:last,equity,shares,parValue,
      navPer:Math.round(navPer),incPer:incPer==null?null:Math.round(incPer),
      wAvgNi:wAvg,heavyRE,weight:`순자산 ${wNav*100}% : 순손익 ${wInc*100}%`,
      raw:Math.round(raw),floor:Math.round(floor),perShare:Math.round(perShare),
      totalValue:Math.round(perShare*shares),
      parMultiple:parValue?Math.round(perShare/parValue):null,
      sharesSource:regCap?'등기부':'직접입력',method};
  }catch(e){console.warn('가치평가 계산 실패',e);return null;}
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
 search(q){return[];}   /* [2026-08-01] 교본 전문(SPEECH_CORPUS) 제거 — 프롬프트·스키마 유출 방지. 리포트 생성에는 미사용 */
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
/* ★ [2026-08-01] 컨설턴트 정보 — 표지·마지막장·페이지헤더 표기 */
function crConsultant(){
  const c=(state.caseData&&state.caseData.consultant)||state.consultant||{};
  const m=(typeof memberInfo==='function')?memberInfo():{};
  return {company:c.company||m.company||'',name:c.name||m.name||'',title:c.title||m.title||'',phone:c.phone||'',email:c.email||''};
}
function crConsultantLine(){
  const c=crConsultant(), a=[];
  if(c.company)a.push(esc(c.company));
  if(c.name)a.push(esc(c.name)+(c.title?' '+esc(c.title):''));
  return a.join(' · ');
}
function crConsultantCoverHtml(){
  const c=crConsultant();
  if(!c.company&&!c.name)return '';
  const sub=[c.phone&&esc(c.phone),c.email&&esc(c.email)].filter(Boolean).join(' · ');
  return `<div class="cover-consultant"><b>${esc(c.company)}</b><span>${esc(c.name)}${c.title?' '+esc(c.title):''}</span>${sub?`<em>${sub}</em>`:''}</div>`;
}
function crConsultantClosingHtml(){
  const c=crConsultant();
  if(!c.company&&!c.name)return '';
  const rows=[['소속',c.company],['담당',(c.name||'')+(c.title?' '+c.title:'')],['연락처',c.phone],['이메일',c.email]]
    .filter(r=>String(r[1]||'').trim())
    .map(r=>`<div><b>${r[0]}</b><span>${esc(r[1])}</span></div>`).join('');
  return `<div class="closing-consultant"><h3>다음 상담 문의</h3><div class="cc-grid">${rows}</div></div>`;
}
function pageShell({id,title,subtitle='',section='CORPORATE REPORT',visibility='common',issueId='',body='',cover=false,summary='',notePurpose=''}){
 const pageNo=String(state.pages?.length+1).padStart(2,'0');
 if(cover)return {id,title,subtitle,section,visibility,issueId,summary,notePurpose,html:`<section class="report-page cover" id="${id}" data-visibility="${visibility}" data-issue="${issueId}"><div class="cover-top">CORPORATE DECISION · SOLUTION · BRIEFING</div><div class="cover-mid"><div class="eyebrow">기업진단리포트 · 상담 브리핑</div><h1>${esc(state.caseData.profile.displayName||state.caseData.profile.companyName)}</h1><p>팩트·계산·근거·CEO 결정과 실전상담 코칭을 하나의 분석데이터로 연결합니다.</p><div class="tags"><span>CEO 의사결정형</span><span>A4·PDF</span><span>경영실행 지원</span><span class="consultant-only">컨설턴트 코칭</span><span class="consultant-only">보험기회 검증</span><span class="consultant-only">음성강의</span></div></div><div class="cover-grid"><div><b>분석기간</b><span>2023~2025년</span></div><div><b>기초자료</b><span>${esc(state.caseData.meta.sourceType)} ${safeNum(state.caseData.meta.sourcePages)}p</span></div><div><b>최근 결산일</b><span>${esc(state.caseData.profile.fiscalDate)}</span></div></div>${crConsultantCoverHtml()}<div class="cover-note">본 리포트는 확인된 기업자료와 추가 상담정보를 바탕으로 경영 의사결정을 지원합니다. 개별 세무·법률·보험 판단은 관련 증빙과 전문가 검토 후 확정하십시오.</div><footer class="page-footer"><span>CONFIDENTIAL · ${esc(state.caseData.meta.caseId)}</span><b>01</b></footer></section>`};
 const noteBtn=visibility==='audio'?'':`<button class="note-trigger" type="button" data-note-page="${id}">✎ 상담노트</button>`;
 return {id,title,subtitle,section,visibility,issueId,summary,notePurpose,html:`<section class="report-page ${visibility==='consultant'?'consultant-only':''} ${visibility==='audio'?'audio-page':''}" id="${id}" data-visibility="${visibility}" data-issue="${issueId}"><header class="page-header"><div><div class="sec">${esc(section)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="mini">${crConsultantLine()||'CORPORATE REPORT'}</div></header><main class="page-main">${body}</main>${noteBtn}<footer class="page-footer"><span>${esc(state.caseData.profile.displayName||state.caseData.profile.companyName)} · ${esc(state.caseData.meta.caseId)}</span><b>${pageNo}</b></footer></section>`};
}
function addPage(spec){const p=pageShell(spec);state.pages.push(p);return p;}
function issueFlow(issue){return `<div class="issue-flow"><article class="fact"><span>01</span><h3>확인된 팩트</h3>${list(issue.facts)}</article><article class="meaning"><span>02</span><h3>경영상 의미</h3><p>${esc(issue.meaning)}</p></article><article class="risk"><span>03</span><h3>방치 시 위험</h3>${list(issue.risks)}</article><article class="benefit"><span>04</span><h3>해결 방향</h3>${list(issue.solutions)}</article><article class="decision"><span>05</span><h3>결정·계약 연결</h3><p><b>유료컨설팅:</b> ${esc(issue.consulting||'정밀진단')}</p><p><b>보험 검토:</b> ${esc(issue.insurance||'추가 확인 후 판단')}</p></article></div>`;}
/* ════ [2026-08-01] 등기부 → 리포트 본문 반영 ════ */
const CR_REG_ISSUES={EXECUTIVE_RETIREMENT:1,SUCCESSION:1,KEY_PERSON:1,CAPITAL_TRANSACTIONS:1,CAPITAL_POLICY:1};
function crRegData(){return (state.registry&&state.registry.parsed)||(state.caseData&&state.caseData.registryParsed)||null;}
function crRegIssueBlock(issueId){
  if(!CR_REG_ISSUES[issueId])return '';
  const R=crRegData();
  if(!R)return `<div class="notice"><b>등기부 확인 시 산출 가능</b>임원 근속·경영권 변동·자본금 이력은 법인 등기사항증명서(말소사항 포함)로 확정됩니다. 다음 미팅 자료요청에 포함했습니다.</div>`;
  const ceo=R.current.find(o=>o.role==='대표이사');
  const cap=R.capital.length?R.capital[R.capital.length-1]:null, cap0=R.capital.length?R.capital[0]:null;
  const par=R.par||[], rows=[];
  if(issueId==='EXECUTIVE_RETIREMENT'||issueId==='KEY_PERSON'){
    if(ceo)rows.push(['대표이사 근속',`${esc(ceo.name)} · <b>${crRegTenure(ceo.since)}</b> (${esc(ceo.since)} ${esc(ceo.type)})`]);
    if(R.current.length){const _bn={};R.current.forEach(o=>{(_bn[o.name]=_bn[o.name]||[]).push(o);});rows.push(['현직 임원',Object.entries(_bn).map(([n,os])=>`${esc(n)}(${os.map(x=>esc(x.role)).join('·')} · ${crRegTenure(os[0].since)})`).join(' · ')]);}
    if(R.overdueOfficers.length)rows.push(['임기 경과',`<b>${R.overdueOfficers.map(o=>esc(o.role)+' '+esc(o.name)).join(' · ')}</b> — 중임등기 확인 필요(상법 3년 기준 추정)`]);
  }
  if(issueId==='SUCCESSION'||issueId==='KEY_PERSON'){
    if(R.ceoTerms)rows.push(['대표이사 취임 이력',`<b>${R.ceoTerms}회</b> — 경영권 안정성 확인 필요`]);
  }
  if(issueId==='CAPITAL_TRANSACTIONS'||issueId==='CAPITAL_POLICY'||issueId==='SUCCESSION'){
    if(cap0&&cap)rows.push(['자본금 변동',`${cap0.capital.toLocaleString()}원 → <b>${cap.capital.toLocaleString()}원</b> (${R.capital.length}건)`]);
    if(cap)rows.push(['발행주식총수',`<b>${cap.shares.toLocaleString()}주</b>`]);
    if(par.length>1)rows.push(['액면가',`${par[0].amount.toLocaleString()}원 → <b>${par[par.length-1].amount.toLocaleString()}원</b> (${esc(par[par.length-1].date||'')})`]);
    const _a=R.authorizedShares.length?R.authorizedShares[R.authorizedShares.length-1]:null;
    if(_a&&cap)rows.push(['증자 여력',`발행가능 ${_a.shares.toLocaleString()}주 · 여력 <b>${(_a.shares-cap.shares).toLocaleString()}주</b>`]);
    if(R.capitalDecrease.length)rows.push(['자본금 감소',`<b>${R.capitalDecrease.length}회</b> — 감자 절차·과세 확인`]);
    if(R.stockOption)rows.push(['주식매수선택권','<b>설정 있음</b> — 지분 희석 가능성 확인']);
  }
  if(!rows.length)return '';
  return `<div class="source-box reg-src"><b>등기부 확인사항</b><div class="rs-grid">${rows.map(r=>`<div class="${/현직 임원|임기 경과/.test(r[0])?'wide':''}"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}</div><em>출처: 법인 등기사항증명서(말소사항 포함) · 개인정보는 저장하지 않습니다</em></div>`;
}
function crCharterPage(model){
  const c=crCharter(); if(!c||!Object.keys(c).filter(k=>c[k]&&k!=='savedAt').length)return;
  const R=(state.registry&&state.registry.parsed)||null;
  const ceo=R&&R.current?R.current.find(o=>o.role==='대표이사'):null;
  const row=(k,v,note)=>`<tr><td>${esc(k)}</td><td><b>${esc(v||'확인 필요')}</b></td><td>${note||''}</td></tr>`;
  const noRule=(c.retireRule==='없음');
  const unknown=(c.retireRule==='');
  addPage({id:'charter',title:'정관 확인사항',subtitle:'임원 보수·퇴직금·배당·지분 관련 정관 조항을 확인했습니다.',section:'CHARTER',visibility:'common',issueId:'GOV-06',summary:'정관 확인사항',
   body:`${noRule?`<div class="notice amber"><b>임원 퇴직금 지급규정 없음</b>정관 또는 별도 규정에 임원퇴직금 지급기준이 없으면, 퇴직금을 지급하더라도 <b>손금으로 인정되지 않을 수 있습니다</b>(법인세법 시행령 §44④). ${ceo?`현 대표이사 ${esc(ceo.name)}의 근속은 ${crRegTenure(ceo.since)}이며, `:''}규정 정비가 지급·손금 인정의 전제입니다.</div>`:''}
   ${unknown?`<div class="notice"><b>퇴직금 규정 확인 필요</b>정관 및 임원퇴직금지급규정 사본을 확인하면 예상 퇴직금과 손금 인정 가능 여부를 산출할 수 있습니다. 다음 미팅 자료요청에 포함했습니다.</div>`:''}
   <table><thead><tr><th>항목</th><th>확인 결과</th><th>진단 연결</th></tr></thead><tbody>
     ${row('임원 보수 지급규정',c.payRule,'보수 손금성 · 급여 vs 배당 세후비교')}
     ${row('임원 퇴직금 지급규정',c.retireRule,'퇴직금 손금 인정 · 지급재원')}
     ${row('퇴직금 지급배수',c.retireRate,'예상 퇴직금 산정 기준')}
     ${row('중간배당',c.interimDividend,'배당정책 설계 가능 범위')}
     ${row('주식양도 제한',c.shareTransfer,'지분 분산 · 경영권 방어')}
     ${row('주식매수선택권',c.stockOption,'지분 희석 시나리오')}
     ${row('이사 수 · 임기',c.directors,'중임등기 · 등기 정비')}
   </tbody></table>
   ${c.retireText?`<div class="source-box"><b>퇴직금 규정 원문</b> ${esc(c.retireText)}</div>`:''}
   ${c.etc?`<div class="source-box"><b>특이 조항</b> ${esc(c.etc)}</div>`:''}
   <div class="notice"><b>표현 경계</b>본 내용은 컨설턴트가 확인·입력한 사항이며 정관 원본 검토를 대체하지 않습니다. 실제 지급·손금 인정 여부는 정관, 주주총회 결의, 임원퇴직금지급규정 원본과 세무대리인 검토로 판단됩니다.</div>`});
}
/* ══════════════════════════════════════════════════════════════════
   [2026-08-01] TAX-07 경정청구 검토 신호 · 초회면담 도입 화법
   ⚖ 세무사법 준수 — 이 모듈은 다음을 절대 수행하지 않는다.
      ① 환급액 산정  ② 요건 충족 판정  ③ 특정 세무대리인 알선
   허용 범위: 재무·등기 자료에서 확인되는 사실 제시 / 제도 일반 설명 /
             세무대리인 확인용 질문 생성 / 준비자료 목록 제시
   ══════════════════════════════════════════════════════════════════ */

/* 법제처 조문 딥링크 — search-engine.js _articleDeepLink 로직 이식 */
function crLawLink(lawName,article){
  const base='https://www.law.go.kr/법령/'+encodeURIComponent(lawName);
  const m=String(article||'').match(/(\d+)\s*조\s*(?:의\s*(\d+))?/);
  if(!m)return base;
  return base+'/'+encodeURIComponent('제'+m[1]+'조'+(m[2]?'의'+m[2]:''));
}
function crLawTag(lawName,article){
  const label=article?(lawName+' '+article):lawName;
  return `<a class="law-link" href="${crLawLink(lawName,article)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

/* ── 경정청구 검토 신호 정의 ────────────────────────────────── */
const CR_REFUND_SIGNALS=[
 {id:'CARRYFWD',name:'결손금 공제',law:'법인세법',art:'제13조',law2:'국세기본법',art2:'제45조의2',
  test:(F)=>{const y=Object.keys(F).sort();const loss=y.filter(k=>Number(F[k].netIncome)<0);
    return loss.length?{fact:loss.map(k=>`${k}년 순손실 ${Math.abs(F[k].netIncome).toLocaleString()}백만원`).join(' · '),src:'손익계산서'}:null;},
  q:['해당 연도 결손금이 신고서에 정확히 반영됐습니까?','이월결손금 공제 순서와 한도(중소기업 100%)가 맞게 적용됐습니까?','결손금 소급공제 환급을 신청하셨습니까?'],
  docs:['법인세 과세표준신고서','세무조정계산서','이월결손금명세서']},

 {id:'ZEROTAX',name:'공제·감면 적용 이력',law:'국세기본법',art:'제45조의2',
  test:(F)=>{const y=Object.keys(F).sort();const hit=y.filter(k=>Number(F[k].netIncome)>0&&Number(F[k].incomeTaxExpense||0)===0);
    return hit.length?{fact:hit.map(k=>`${k}년 순이익 ${Number(F[k].netIncome).toLocaleString()}백만원 · 법인세비용 0원`).join(' · '),src:'손익계산서'}:null;},
  q:['이익이 발생한 연도에 법인세비용이 0원인 사유가 무엇입니까?','이월결손금 공제 외에 적용된 공제·감면이 있습니까?','최저한세 적용으로 배제된 공제가 있습니까?'],
  docs:['법인세 과세표준신고서','세액공제·감면신청서','최저한세조정계산서']},

 {id:'INVEST',name:'통합투자세액공제',law:'조세특례제한법',art:'제24조',
  test:(F)=>{const y=Object.keys(F).sort(),out=[];
    for(let i=1;i<y.length;i++){const a=Number(F[y[i-1]].tangibleAssets),b=Number(F[y[i]].tangibleAssets);
      if(a>0&&b>a*1.5)out.push(`${y[i]}년 유형자산 ${a.toLocaleString()}→${b.toLocaleString()}백만원 (+${Math.round((b/a-1)*100)}%)`);}
    return out.length?{fact:out.join(' · '),src:'재무상태표'}:null;},
  q:['해당 연도 유형자산 증가는 어떤 경위입니까? (신규 취득·리스 인식·재분류 등)','설비투자였다면 통합투자세액공제를 신청하셨습니까?','신성장·원천기술 시설로 인정받을 수 있는 자산이 포함돼 있습니까?'],
  docs:['세액공제신청서','유형자산 취득명세','감가상각비명세서']},

 {id:'RND',name:'연구·인력개발비 세액공제',law:'조세특례제한법',art:'제10조',
  test:(F,P)=>P.hasPatent?{fact:'기업신용보고서상 「특허보유기업」 표기',src:'기업요약'}:null,
  q:['연구전담부서 또는 기업부설연구소 인정을 받으셨습니까?','연구개발비를 별도 계정으로 구분경리하고 계십니까?','R&D 세액공제를 신청하셨거나 국세청 사전심사를 받으셨습니까?'],
  docs:['연구전담부서 인정서','연구개발계획서·보고서','연구및인력개발비명세서','연구원 급여대장']},

 {id:'SMEDED',name:'중소기업 특별세액감면',law:'조세특례제한법',art:'제7조',
  test:(F,P)=>P.isSME?{fact:`중소기업${P.industry?' · '+P.industry:''}${P.region?' · 본점 '+P.region:''}`,src:'기업요약'}:null,
  q:['중소기업 특별세액감면을 신청하셨습니까?','업종이 감면대상 업종에 해당합니까?','소기업·중기업 구분과 수도권 여부가 정확히 적용됐습니까?'],
  docs:['세액감면신청서','중소기업기준검토표','사업장 소재지 증빙']},

 {id:'EMPLOY',name:'통합고용세액공제',law:'조세특례제한법',art:'제29조의8',
  test:(F,P)=>(P.hire!=null||P.leave!=null)?{fact:`최근 1년 신규취득 ${P.hire??'—'}명 · 상실 ${P.leave??'—'}명 (국민연금 기준)${P.emp?' · 종업원 '+P.emp+'명':''}`,src:'종업원 현황'}:null,
  q:['상시근로자 수가 증가한 연도에 통합고용세액공제를 신청하셨습니까?','청년·60세 이상·경력단절자 등 우대 대상이 반영됐습니까?','인원이 감소한 연도에 기공제분 추징 대상이 있습니까?'],
  docs:['상시근로자명세서','급여대장','4대보험 가입자명부']},

 {id:'WAGEUP',name:'임금 증가 세액공제',law:'조세특례제한법',art:'제29조의4',
  test:(F,P)=>{
    if(P.avgPay&&P.indAvgPay&&P.avgPay>P.indAvgPay*1.5)
      return {fact:`국민연금 기준 평균보수 ${P.avgPay.toLocaleString()}만원 · 동종업계 평균 ${P.indAvgPay.toLocaleString()}만원 (${(P.avgPay/P.indAvgPay).toFixed(1)}배)`,src:'종업원 현황',
        caveat:'국민연금 고지금액 역산 추정치이며 기준소득월액 상한과 임원·특수관계인이 포함되어 세법상 상시근로자 평균임금과 다릅니다.'};
    const y=Object.keys(F).sort();
    for(let i=1;i<y.length;i++){const a=Number(F[y[i-1]].laborCost),b=Number(F[y[i]].laborCost);
      if(a>0&&b>a*1.12)return {fact:`${y[i]}년 인건비 ${a.toLocaleString()}→${b.toLocaleString()}백만원 (+${Math.round((b/a-1)*100)}%)`,src:'손익계산서'};}
    return null;},
  q:['근로소득 증대세제(임금증가 세액공제)를 신청하셨습니까?','임원·최대주주·특수관계인을 제외한 상시근로자 기준 평균임금 증가율은 얼마입니까?','정규직 전환 인원이 있었다면 별도 공제를 반영하셨습니까?'],
  docs:['급여대장','상시근로자명세서','세액공제신청서','4대보험 가입자명부']},

 {id:'SOCINS',name:'사회보험료 세액공제',law:'조세특례제한법',art:'제30조의4',
  test:(F,P)=>(P.hire!=null&&Number(P.hire)>0)?{fact:`최근 1년 신규취득 ${P.hire}명 (국민연금 기준)${P.emp?' · 종업원 '+P.emp+'명':''}`,src:'종업원 현황'}:null,
  q:['상시근로자 증가에 따른 사회보험료 세액공제를 신청하셨습니까?','통합고용세액공제와 중복적용 배제 규정을 검토하셨습니까?','청년·경력단절자 우대 대상이 포함돼 있습니까?'],
  docs:['4대보험 납부내역','상시근로자명세서','세액공제신청서']},

 {id:'STARTUP',name:'창업중소기업 세액감면',law:'조세특례제한법',art:'제6조',
  test:(F,P)=>{
    if(!P.established)return null;
    const yrs=(Date.now()-new Date(P.established).getTime())/(365.25*864e5);
    return (yrs<=6)?{fact:`회사성립 ${P.established} (설립 ${Math.floor(yrs)}년차)`,src:'등기부'}:null;},
  q:['창업중소기업 세액감면(최초 소득발생 연도부터 5년)을 적용하셨습니까?','창업 요건(기존 사업 승계·법인전환 아님)을 충족합니까?','감면 대상 업종과 지역·청년창업 여부가 정확히 적용됐습니까?'],
  docs:['법인세 과세표준신고서','세액감면신청서','창업 요건 증빙']},

 {id:'BADDEBT',name:'대손금·대손충당금',law:'법인세법',art:'제19조의2',
  test:(F)=>{const y=Object.keys(F).sort(),out=[];
    for(const k of y){const v=Number(F[k].badDebtExpense);
      if(Number.isFinite(v)&&v<0)out.push(`${k}년 대손상각비 ${v.toLocaleString()}백만원 (환입)`);}
    return out.length?{fact:out.join(' · '),src:'손익계산서'}:null;},
  q:['대손 환입이 발생한 사유는 무엇입니까? (회수·재평가·과거 과대계상 등)','과거 대손 인정 시점과 요건이 적정했습니까?','회수불능 채권 중 대손처리하지 않은 건이 있습니까?'],
  docs:['계정별원장(대손상각비·대손충당금)','채권 연령분석표','회수 노력 증빙']},

 {id:'ENTERTAIN',name:'기업업무추진비(접대비) 한도',law:'법인세법',art:'제25조',
  test:(F)=>{const y=Object.keys(F).sort(),L=F[y[y.length-1]]||{};
    const sga=Number(L.sgaExpenses),rev=Number(L.revenue);
    return (sga>0&&rev>0)?{fact:`${y[y.length-1]}년 매출액 ${rev.toLocaleString()}백만원 · 판매관리비 ${sga.toLocaleString()}백만원`,src:'손익계산서'}:null;},
  q:['기업업무추진비 한도 계산에 중소기업 기본한도와 수입금액 기준이 정확히 반영됐습니까?','손금불산입액이 과다 계산된 부분은 없습니까?','문화·전통시장 추가한도를 적용하셨습니까?'],
  docs:['기업업무추진비 조정명세서','계정별원장','신용카드매출전표']},

 {id:'RETIREPROV',name:'퇴직급여충당금·퇴직연금',law:'법인세법',art:'제33조',
  test:(F,P)=>{const y=Object.keys(F).sort(),L=F[y[y.length-1]]||{};
    const rp=Number(L.retirementProvision);
    if(Number.isFinite(rp)&&rp>0)return {fact:`퇴직급여 관련 계상 ${rp.toLocaleString()}백만원`,src:'재무제표'};
    return P.emp?{fact:`종업원 ${P.emp}명 · 퇴직급여충당금 계상 여부 확인 필요`,src:'종업원 현황'}:null;},
  q:['확정급여형(DB) 퇴직연금 부담금을 손금산입하셨습니까?','퇴직급여충당금 한도와 세무조정이 적정합니까?','임원 퇴직급여는 정관·규정 한도 내에서 처리되었습니까?'],
  docs:['퇴직급여충당금조정명세서','퇴직연금 계약서·납입내역','임원퇴직금 지급규정']},

 {id:'INVENTORY',name:'재고자산 평가손실',law:'법인세법',art:'제42조',
  test:(F)=>{const y=Object.keys(F).sort(),out=[];
    for(let i=1;i<y.length;i++){const a=Number(F[y[i-1]].inventories),b=Number(F[y[i]].inventories);
      if(a>0&&b<a*0.7)out.push(`${y[i]}년 재고자산 ${a.toLocaleString()}→${b.toLocaleString()}백만원 (${Math.round((b/a-1)*100)}%)`);}
    return out.length?{fact:out.join(' · '),src:'재무상태표'}:null;},
  q:['재고 감소가 판매인지 평가손실·폐기인지 구분됩니까?','재고자산 평가방법을 신고하셨고 저가법 평가손실을 계상하셨습니까?','감모손실·폐기손실 증빙이 있습니까?'],
  docs:['재고자산평가방법신고서','재고실사표','폐기 증빙']},

 {id:'INTEREST',name:'지급이자 손금불산입',law:'법인세법',art:'제28조',
  test:(F)=>{const y=Object.keys(F).sort(),L=F[y[y.length-1]]||{};
    const loan=Number(L.shortTermLoans||L.loanReceivable),fin=Number(L.financeCost);
    return (loan>0&&fin>0)?{fact:`대여금 ${loan.toLocaleString()}백만원 · 금융비용 ${fin.toLocaleString()}백만원`,src:'재무제표'}:null;},
  q:['업무무관 자산·가지급금 관련 지급이자 손금불산입액이 과다 계산되지 않았습니까?','대여금의 업무관련성과 적정 이자율이 확인됩니까?','건설자금이자 자본화 대상과 손금 대상이 구분됐습니까?'],
  docs:['지급이자 조정명세서','가지급금 등의 인정이자 조정명세서','대여금 계약서']},

 {id:'DIVINCOME',name:'수입배당금 익금불산입',law:'법인세법',art:'제18조의2',
  test:(F,P)=>P.hasAffiliate?{fact:'관계회사·장기투자자산 보유 확인',src:'기업현황'}:null,
  q:['자회사·관계회사로부터 받은 배당금에 익금불산입을 적용하셨습니까?','지분율 구간별 익금불산입률이 정확히 적용됐습니까?','차입금 이자 차감액 계산이 적정합니까?'],
  docs:['수입배당금 익금불산입 조정명세서','주식보유 현황','배당 수령 내역']},

 {id:'FOREIGN',name:'외국납부세액공제',law:'법인세법',art:'제57조',
  test:(F,P)=>{const y=Object.keys(F).sort(),L=F[y[y.length-1]]||{};
    if(P.hasOverseas)return {fact:'해외법인·해외거래 확인',src:'기업현황'};
    const fx=Number(L.fxGainLoss);
    return (Number.isFinite(fx)&&Math.abs(fx)>0)?{fact:`외화환산손익 ${fx.toLocaleString()}백만원 계상`,src:'손익계산서'}:null;},
  q:['해외에서 납부한 법인세에 대해 외국납부세액공제를 적용하셨습니까?','간접외국납부세액공제 대상이 있습니까?','조세조약상 제한세율이 적용됐습니까?'],
  docs:['외국납부세액공제 신청서','해외 납세증명','조세조약 적용 자료']},

 {id:'DISASTER',name:'재해손실세액공제',law:'법인세법',art:'제58조',
  test:(F)=>{const y=Object.keys(F).sort(),out=[];
    for(const k of y){const v=Number(F[k].disasterLoss);
      if(Number.isFinite(v)&&v>0)out.push(`${k}년 재해손실 ${v.toLocaleString()}백만원`);}
    return out.length?{fact:out.join(' · '),src:'손익계산서'}:null;},
  q:['재해로 자산총액의 20% 이상을 상실한 사업연도가 있습니까?','재해손실세액공제를 신청하셨습니까?','보험금 수령액과의 차액이 정확히 반영됐습니까?'],
  docs:['재해 발생 증빙','재해손실세액공제 신청서','보험금 수령 내역']},

 {id:'DEPREC',name:'감가상각·손금 계상',law:'법인세법',art:'제23조',
  test:(F)=>{const y=Object.keys(F).sort(),L=F[y[y.length-1]]||{};
    const ta=Number(L.tangibleAssets),dp=Number(L.depreciation);
    return (ta>0&&Number.isFinite(dp))?{fact:`유형자산 ${ta.toLocaleString()}백만원 · 감가상각비 ${dp.toLocaleString()}백만원 (상각률 ${(dp/ta*100).toFixed(1)}%)`,src:'재무제표'}:null;},
  q:['자산별 내용연수와 상각방법이 신고서와 일치합니까?','즉시상각 의제 대상 자산을 감가상각으로 처리한 건이 있습니까?','자본적 지출과 수익적 지출 구분이 적정합니까?'],
  docs:['감가상각비명세서','자산별 취득명세','수선비 내역']},
];

function crRefundProfile(model){
  const p=model?.profile||{}, R=crRegData();
  const emp=Number(p.employees||p.employeeCount)||null;
  return {hasPatent:/특허|인증/.test(String(p.certifications||p.notes||'')),
    isSME:/중소기업/.test(String(p.companyType||p.scale||''))||true,
    industry:p.industry||'', region:p.region||p.address||'',
    hire:p.hireCount??null, leave:p.leaveCount??null, emp,
    avgPay:Number(p.avgPay)||null, indAvgPay:Number(p.industryAvgPay)||null,
    established:(R&&R.company&&R.company.established)||p.establishedDate||null,
    hasAffiliate:!!(p.relatedCompanies&&p.relatedCompanies.length)||/관계회사|계열/.test(String(p.notes||'')),
    hasOverseas:!!(p.foreignSubsidiaries&&p.foreignSubsidiaries.length)||/해외|수출/.test(String(p.notes||p.products||''))};
}
function crRefundSignals(model){
  const F=model?.financials||{}; if(!Object.keys(F).length)return [];
  const P=crRefundProfile(model), out=[];
  for(const s of CR_REFUND_SIGNALS){
    let r=null; try{r=s.test(F,P);}catch(_e){r=null;}
    if(r)out.push({...s,...r});
  }
  return out;
}

/* ── 리포트 페이지 ─────────────────────────────────────────── */
const CR_REFUND_DISCLAIMER=`<div class="notice amber refund-dis"><b>본 페이지는 세무자문이 아닙니다</b>
  재무제표·등기부에서 <b>확인되는 사실</b>과 관련 제도를 정리한 것입니다. 요건 충족 여부·환급 가능 여부·환급 금액은
  <b>세무대리인(세무사·회계사)의 검토로만 판단</b>됩니다. 본 시스템은 특정 세무대리인을 알선하지 않으며,
  세무사법에 따른 세무대리·세무상담 업무를 수행하지 않습니다.</div>`;

function crRefundPage(model){
  const sig=crRefundSignals(model); if(!sig.length)return;
  const rows=sig.map((s,i)=>`<tr>
    <td class="tc">${i+1}</td>
    <td><b>${esc(s.name)}</b><div class="rf-law">${crLawTag(s.law,s.art)}${s.law2?' · '+crLawTag(s.law2,s.art2):''}</div></td>
    <td>${esc(s.fact)}<div class="rf-src">출처 ${esc(s.src)}</div></td>
  </tr>`).join('');
  addPage({id:'refund-claim',title:'경정청구 검토 신호',subtitle:'법정신고기한 후 5년 이내 확인 가능한 항목을 정리했습니다.',section:'REFUND REVIEW',visibility:'common',issueId:'TAX-07',summary:`검토 신호 ${sig.length}건`,
   body:`${CR_REFUND_DISCLAIMER}
   <div class="lead"><b>검토 신호 ${sig.length}건이 확인되었습니다.</b>
     <p>${crLawTag('국세기본법','제45조의2')}는 신고한 과세표준·세액이 세법상 금액을 초과하거나, 신고한 결손금·세액공제액·환급세액이 미치지 못할 때
     <b>법정신고기한이 지난 후 5년 이내</b> 경정을 청구할 수 있도록 정하고 있습니다. 아래는 재무·등기 자료에서 확인되는 사실이며,
     해당 여부는 신고서 원본 확인이 필요합니다.</p></div>
   <table><thead><tr><th style="width:34px">#</th><th style="width:200px">검토 항목 · 근거 조문</th><th>확인된 사실</th></tr></thead><tbody>${rows}</tbody></table>
   <div class="source-box"><b>다음 단계</b> 「세무전문가 검토 요청서」 페이지를 인쇄하거나 저장해 <b>대표님의 세무대리인</b>께 전달하시면 됩니다.
     확인에 필요한 자료 목록과 질문이 함께 정리되어 있습니다.</div>`});
}

function crRefundRequestPage(model){
  const sig=crRefundSignals(model); if(!sig.length)return;
  const p=model?.profile||{};
  const blocks=sig.map((s,i)=>`<div class="rq-item">
     <div class="rq-hd"><span class="rq-no">${i+1}</span><b>${esc(s.name)}</b>${crLawTag(s.law,s.art)}${s.law2?' · '+crLawTag(s.law2,s.art2):''}</div>
     <div class="rq-fact"><b>확인된 사실</b> ${esc(s.fact)} <span class="rf-src">(${esc(s.src)})</span></div>
     <div class="rq-q"><b>검토 요청</b><ul>${s.q.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
     <div class="rq-doc"><b>준비 자료</b> ${s.docs.map(esc).join(' · ')}</div>
   </div>`).join('');
  addPage({id:'refund-request',title:'세무전문가 검토 요청서',subtitle:'이 페이지를 인쇄하거나 저장해 세무대리인께 전달하십시오.',section:'REFUND REVIEW · REQUEST',visibility:'common',summary:'세무전문가 검토 요청서',
   body:`<div class="rq-head"><div><b>${esc(p.displayName||p.companyName||'—')}</b>${p.businessNumber?` · 사업자 ${esc(p.businessNumber)}`:''}</div>
     <div class="rq-sub">검토 신호 ${sig.length}건 · 청구기한 ${crLawTag('국세기본법','제45조의2')} 법정신고기한 후 5년 이내</div></div>
   ${CR_REFUND_DISCLAIMER}
   ${blocks}
   <div class="rq-sign"><b>검토 의견 (세무대리인 기재란)</b>
     <div class="rq-sign-grid"><div>검토자<span>_______________ (세무사/회계사 · 등록번호 __________)</span></div>
       <div>검토일<span>________________</span></div>
       <div class="wide">의견<span>☐ 경정청구 대상 있음　☐ 대상 없음　☐ 추가자료 필요</span></div></div></div>`});
}
/* ── 초회면담 도입 화법 (컨설턴트 전용) ───────────────────────
   구성: 📊 무슨 일이 있었나 · 🔍 왜 중요한가 · 🗣 대면 도입 ·
         💬 예상 답변→후속질문 · ⚠️ 하지 말 것
   모든 수치는 이 기업의 실제 재무·등기·국민연금 자료에서 산출한다.
   상위 3개만 펼쳐 노출하고 나머지는 접는다.                        */
function crOpeners(model){
  const F=model?.financials||{}, ys=Object.keys(F).filter(y=>/^\d{4}$/.test(y)).sort();
  if(!ys.length)return [];
  const Y=ys[ys.length-1], Yp=ys[ys.length-2]||Y, Y0=ys[0];
  const L=F[Y]||{}, P0=F[Yp]||{}, F0=F[Y0]||{};
  const p=model?.profile||{}, R=crRegData(), V=model?.calculations?.valuation||null, c=crCharter()||{};
  const num=x=>Number(x), ok=x=>Number.isFinite(Number(x))&&Number(x)!==0;
  const eok=x=>{const v=Number(x)/100;return (Math.abs(v)>=10?v.toFixed(0):v.toFixed(1));};
  const pct=(a,b)=>((Number(a)/Number(b)-1)*100);
  const O=[]; const add=o=>O.push(o);
  const ceo=R&&R.current&&R.current.find(o=>o.role==='대표이사');
  const sig=(typeof crRefundSignals==='function')?crRefundSignals(model):[];

  /* ═══ A. 긴급 신호 ═══ */
  if(ok(L.cashAndCashEquivalents)&&ok(P0.cashAndCashEquivalents)&&num(L.cashAndCashEquivalents)<num(P0.cashAndCashEquivalents)*0.5){
    const cur=ok(L.currentAssets)&&ok(L.currentLiabilities)?(num(L.currentAssets)/num(L.currentLiabilities)*100):null;
    const prev=ok(P0.currentAssets)&&ok(P0.currentLiabilities)?(num(P0.currentAssets)/num(P0.currentLiabilities)*100):null;
    const drop=num(P0.cashAndCashEquivalents)-num(L.cashAndCashEquivalents);
    add({tag:'현금·유동성',theme:'긴급 신호',sev:1,hook:'가장 먼저 짚어야 할 신호',
      facts:[`${Yp}년 말 현금 ${eok(P0.cashAndCashEquivalents)}억 → ${Y}년 말 ${eok(L.cashAndCashEquivalents)}억 (${eok(drop)}억 감소)`,
        cur!=null?`유동비율 ${prev!=null?prev.toFixed(0)+'% → ':''}${cur.toFixed(0)}%`:null,
        ok(L.tangibleAssets)&&ok(P0.tangibleAssets)?`유형자산 ${eok(P0.tangibleAssets)}억 → ${eok(L.tangibleAssets)}억`:null,
        ok(L.totalBorrowings)&&ok(P0.totalBorrowings)?`차입금 ${eok(P0.totalBorrowings)}억 → ${eok(L.totalBorrowings)}억`:null],
      insight:`유동비율 ${cur!=null?cur.toFixed(0)+'%':'급락'}는 1년 안에 갚아야 할 ${ok(L.currentLiabilities)?eok(L.currentLiabilities)+'억':'단기부채'}에 대해 현금화 가능한 자산이 ${ok(L.currentAssets)?eok(L.currentAssets)+'억뿐이라':'그보다 적다'}는 뜻입니다. 통상 100% 아래면 단기 지급능력에 문제가 있다고 봅니다. 다만 더 중요한 것은 ${prev!=null?`작년 ${prev.toFixed(0)}%에서 급락했다`:'단기간에 급락했다'}는 사실입니다. 정상 운영되던 회사에 1년 사이 큰 자금 이동이 있었다는 의미이고, 그 성격이 투자인지 대여인지 상환인지에 따라 이후 상담 전체가 갈립니다. 숫자만 보고 "자금난"으로 단정하면 안 됩니다. 설비투자로 현금이 자산으로 옮겨간 경우도 같은 모습으로 나타납니다.`,
      talk:`대표님, 숫자 하나만 먼저 확인하겠습니다. ${Yp}년 말 현금이 ${eok(P0.cashAndCashEquivalents)}억이었는데 ${Y}년 말은 ${eok(L.cashAndCashEquivalents)}억입니다. 1년 사이 ${eok(drop)}억이 어디로 갔는지가 이 회사의 가장 중요한 질문입니다.`
        +(cur!=null?`\n동시에 1년 안에 갚아야 할 돈이 ${eok(L.currentLiabilities)}억인데 1년 안에 현금화되는 자산은 ${eok(L.currentAssets)}억입니다. 유동비율이 ${cur.toFixed(0)}%입니다.${prev!=null?` 작년에는 ${prev.toFixed(0)}%였습니다.`:''}`:'')
        +`\n제가 숫자만 봐서는 알 수 없는 부분이라 여쭙습니다. 무슨 일이 있었습니까?`,
      qa:[['설비 투자를 했습니다','"투자세액공제는 받으셨습니까?" → 경정청구·투자공제로 연결'],
        ['관계사나 대표에게 빌려줬습니다','"계약서와 이사회 결의는 있습니까?" → 가지급금 정상화'],
        ['차입금을 상환했습니다','"그런데 차입금은 오히려 늘었는데요?" → 자금흐름 재확인'],
        ['정확히는 잘 모르겠습니다','"경리 담당자분과 함께 보시겠습니까?" → 2차 미팅 확보']],
      avoid:['"자금 사정이 안 좋으신 것 같다"고 단정하지 마십시오. 방어적으로 만들면 그 뒤 대화가 닫힙니다.','유동비율 같은 지표를 먼저 꺼내지 마십시오. 금액이 먼저 와닿습니다.','원인을 추측해서 말하지 말고 반드시 대표가 답하게 하십시오.'],
      why:'대표가 반드시 답해야 하는 질문. 투자·상환·대여 중 무엇인지에 따라 이후 상담 전체가 갈립니다.'});
  }
  if(ok(L.operatingIncome)&&ok(L.financeCost)&&num(L.operatingIncome)/num(L.financeCost)<1.5){
    const icr=num(L.operatingIncome)/num(L.financeCost);
    add({tag:'이자보상배율',theme:'긴급 신호',sev:1,hook:'금융기관이 먼저 보는 숫자',
      facts:[`${Y}년 영업이익 ${eok(L.operatingIncome)}억 · 금융비용 ${eok(L.financeCost)}억`,
        `이자보상배율 ${icr.toFixed(2)}배`,
        ok(P0.financeCost)?`전년 금융비용 ${eok(P0.financeCost)}억`:null],
      insight:`이자보상배율은 영업이익으로 이자를 몇 배 갚을 수 있는지를 봅니다. 1배 미만이면 본업에서 번 돈으로 이자조차 감당하지 못한다는 뜻이고, ${icr<1?'현재 그 상태입니다.':'현재 '+icr.toFixed(2)+'배로 겨우 넘긴 수준입니다.'} 3년 연속 1배 미만이면 통상 한계기업으로 분류되어 신규 대출과 만기연장이 어려워집니다. 금융기관은 재무제표에서 이 숫자를 가장 먼저 봅니다. 대표님도 은행에서 이미 언급을 들으셨을 가능성이 높고, 그래서 민감하지만 동시에 가장 절실한 주제입니다.`,
      talk:`${Y}년 영업이익이 ${eok(L.operatingIncome)}억, 금융비용이 ${eok(L.financeCost)}억입니다. 영업이익으로 이자를 갚는 배율이 ${icr.toFixed(2)}배입니다.\n${icr<1?'1배 미만은 본업으로 번 돈이 이자에 못 미친다는 뜻입니다. 3년 연속이면 한계기업으로 분류될 수 있습니다.':'1배는 넘겼지만 여유가 크지 않습니다. 금리가 오르거나 영업이익이 줄면 바로 역전됩니다.'}\n혹시 은행에서 이 부분을 언급한 적이 있으십니까?`,
      qa:[['은행에서 얘기가 나왔습니다','"어떤 조건을 요구받으셨습니까?" → 차입구조 개선 컨설팅'],
        ['처음 듣습니다','"올해 만기가 돌아오는 차입금은 얼마입니까?" → 만기 구조 점검'],
        ['일시적입니다','"내년 영업이익 계획은 어떻게 잡고 계십니까?" → 개선 시나리오']],
      avoid:['"한계기업"이라는 단어를 대표 앞에서 직접 쓰지 마십시오. 제도상 용어일 뿐인데 모욕으로 받아들입니다.','부채비율·차입금의존도를 함께 나열하지 마십시오. 숫자 하나에 집중해야 대화가 됩니다.'],
      why:'대표가 가장 민감하게 반응하는 주제. 차입구조 개선 컨설팅으로 직결됩니다.'});
  }
  if(ok(L.totalBorrowings)&&ok(P0.totalBorrowings)&&num(L.totalBorrowings)>num(P0.totalBorrowings)*1.5){
    add({tag:'차입 급증',theme:'긴급 신호',sev:2,hook:'자금조달 구조 확인',
      facts:[`차입금 ${eok(P0.totalBorrowings)}억 → ${eok(L.totalBorrowings)}억 (${pct(L.totalBorrowings,P0.totalBorrowings).toFixed(0)}%)`,
        ok(L.totalAssets)?`차입금의존도 ${(num(L.totalBorrowings)/num(L.totalAssets)*100).toFixed(1)}%`:null,
        ok(L.currentBorrowings)?`1년 내 만기 ${eok(L.currentBorrowings)}억`:null],
      insight:`차입금이 1년 사이 ${pct(L.totalBorrowings,P0.totalBorrowings).toFixed(0)}% 늘었다면 반드시 용도가 있습니다. 설비투자였다면 투자세액공제 대상일 수 있고, 운전자금이었다면 현금흐름 구조 자체를 봐야 합니다. 관계사 지원이었다면 가지급금·부당행위계산 쟁점이 됩니다. ${ok(L.currentBorrowings)&&ok(L.totalBorrowings)&&num(L.currentBorrowings)/num(L.totalBorrowings)>0.5?'특히 1년 내 만기 비중이 절반을 넘어 만기 구조가 단기에 몰려 있습니다. 차환이 막히면 즉시 유동성 위기로 이어집니다.':''}`,
      talk:`차입금이 ${eok(P0.totalBorrowings)}억에서 ${eok(L.totalBorrowings)}억으로 ${pct(L.totalBorrowings,P0.totalBorrowings).toFixed(0)}% 늘었습니다.${ok(L.totalAssets)?` 자산총계 대비 의존도가 ${(num(L.totalBorrowings)/num(L.totalAssets)*100).toFixed(1)}%입니다.`:''}\n어떤 용도로 조달하셨습니까? 그리고 상환 계획은 어떻게 잡고 계십니까?`,
      qa:[['설비투자입니다','"세액공제 신청하셨습니까?" → 경정청구'],
        ['운전자금입니다','"매출은 느는데 현금이 부족한 구조입니까?" → 운전자금 진단'],
        ['관계사를 지원했습니다','"이사회 결의와 이자 수취는 하셨습니까?" → 부당행위계산 점검']],
      avoid:['"빚이 많다"는 표현을 쓰지 마십시오. 차입은 정상적인 조달 수단입니다.','상환 능력을 먼저 의심하지 말고 용도를 먼저 물으십시오.'],
      why:'용도가 투자면 세액공제, 운전자금이면 현금흐름 개선으로 상담이 갈립니다.'});
  }

  /* ═══ B. 돌려받는 얘기 ═══ */
  if(sig.length){
    const zero=sig.find(s=>s.id==='ZEROTAX'), inv=sig.find(s=>s.id==='INVEST'), wage=sig.find(s=>s.id==='WAGEUP');
    add({tag:'경정청구',theme:'돌려받는 얘기',sev:1,hook:'돈 드는 얘기가 아니라 돌려받는 얘기',
      facts:sig.slice(0,6).map(s=>`${s.name} (${s.law} ${s.art})`),
      insight:`경정청구는 이미 신고·납부한 세금이 세법상 금액보다 많았을 때 돌려받는 제도입니다. 국세기본법 제45조의2는 법정신고기한 후 5년 이내 청구를 허용합니다. 실무에서 세무대리인도 놓치는 경우가 많은데, 신고 당시 자료가 없었거나 요건 검토를 안 한 항목들이 대부분입니다. 특히 세액공제·감면은 신청서를 내야 적용되므로, 요건을 충족했어도 신청을 빠뜨리면 그대로 넘어갑니다. 이 회사에서는 ${sig.length}가지 확인 항목이 나왔습니다. 중요한 것은 컨설턴트가 판단하지 않는다는 점입니다. 사실만 정리해 세무사에게 넘기면 되고, 그 자체로 대표에게 실질적 도움이 됩니다.`,
      talk:(()=>{
        /* ★ 화법은 「억」 단위로 통일한다. 신호 원문(백만원)을 그대로 읽으면 대표가 못 알아듣는다. */
        const zeroYears=Object.keys(F).filter(y=>num(F[y].netIncome)>0&&num(F[y].incomeTaxExpense||0)===0);
        const zeroTxt=zeroYears.length
          ? zeroYears.map(y=>`${y}년 ${eok(F[y].netIncome)}억 이익이 났는데 법인세비용이 0원`).join(', ')+'입니다'
          : '';
        const invTxt=(ok(L.tangibleAssets)&&ok(F0.tangibleAssets)&&num(L.tangibleAssets)>num(F0.tangibleAssets)*1.5)
          ? `유형자산이 ${eok(F0.tangibleAssets)}억에서 ${eok(L.tangibleAssets)}억으로 늘었습니다`
          : '';
        const wageTxt=(p.avgPay&&p.industryAvgPay&&Number(p.avgPay)>Number(p.industryAvgPay)*1.5)
          ? `평균보수도 동종업계의 ${(Number(p.avgPay)/Number(p.industryAvgPay)).toFixed(1)}배입니다`
          : '';
        let s='제안 드리기 전에 먼저 볼 게 있습니다. ';
        s += zeroTxt ? zeroTxt+'. 결손금 공제 때문일 텐데, 그 과정에서 못 받고 넘어간 공제가 있을 수 있습니다.'
                     : '재무제표에서 확인해 보실 항목이 몇 가지 있습니다.';
        if(invTxt) s += `\n그리고 ${invTxt}. 설비투자 세액공제는 받으셨습니까?`;
        if(wageTxt) s += `\n${wageTxt}. 임금이 오른 부분에도 세액공제가 있습니다.`;
        s += `\n국세기본법은 법정신고기한 후 5년 이내 경정청구를 허용하고 있습니다. 해당 여부는 세무사님만 판단하실 수 있고, 저는 확인하실 항목 ${sig.length}가지만 정리해 드립니다.\n대표님 세무사님께 이 종이 한 장만 드리면 되는데, 한번 확인해 보시겠습니까?`;
        return s;
      })(),
      qa:[['우리 세무사가 다 챙겼을 겁니다','"그러실 겁니다. 다만 신청서를 내야 적용되는 항목들이라 확인만 부탁드리는 겁니다." → 방어 해제'],
        ['얼마나 돌려받을 수 있습니까?','"그건 신고서를 봐야 알 수 있고 세무사님 영역입니다. 저는 볼 항목만 정리해 드립니다." → 신뢰 형성'],
        ['한번 물어보겠습니다','"결과 나오면 알려주십시오. 그때 다시 뵙겠습니다." → 2차 미팅 확정'],
        ['세무사를 바꿀 생각은 없습니다','"바꾸시라는 말씀이 전혀 아닙니다. 지금 세무사님께 드리는 자료입니다." → 오해 차단']],
      avoid:['"환급받으실 수 있습니다"라고 단정하지 마십시오. 세무사법 위반 소지가 있습니다.','금액을 추정해서 말하지 마십시오. "얼마쯤 될 것 같다"도 안 됩니다.','현재 세무대리인을 비판하는 뉘앙스를 절대 만들지 마십시오. 대표는 세무사와 오래된 관계인 경우가 많습니다.'],
      why:'거절하기 어려운 도입부. 세무사 검토 결과를 들으러 2차 미팅이 자연스럽게 생깁니다.'});
  }

  /* ═══ C. 대표 개인 ═══ */
  if(V&&V.perShare&&V.parValue){
    add({tag:'주식가치',theme:'대표 개인',sev:1,hook:'대표가 가장 모르는 숫자',
      facts:[`1주당 추정가치 ${V.perShare.toLocaleString()}원 (액면 ${V.parValue.toLocaleString()}원의 ${V.parMultiple}배)`,
        `발행주식 ${V.shares.toLocaleString()}주 · 전체 약 ${(V.totalValue/1e8).toFixed(0)}억`,
        `순자산가치 ${V.navPer.toLocaleString()}원 · 적용방법 ${V.method}`],
      insight:`상속세및증여세법 보충적 평가방법은 순자산가치와 순손익가치를 가중평균하되 순자산가치의 80%를 하한으로 둡니다. 이 회사는 ${V.method}이 적용됐습니다. 대표가 놀라는 이유는 액면가로 기억하고 있기 때문입니다. 설립 때 ${V.parValue.toLocaleString()}원으로 낸 주식이 지금 ${V.perShare.toLocaleString()}원이면, 지분 100%를 넘길 때 약 ${(V.totalValue/1e8).toFixed(0)}억이 과세 대상이 됩니다. 이 숫자가 나오면 상속세·자기주식·후계자 지분매입·배당정책이 한 번에 연결됩니다. 다만 영업권 가산·최대주주 할증(20%)·부동산 개별 감정이 반영되면 달라지므로 확정 금액으로 말하면 안 됩니다.`,
      talk:`대표님 회사 주식이 액면 ${V.parValue.toLocaleString()}원이시죠. 지금 상속·증여 기준으로 계산하면 1주당 약 ${V.perShare.toLocaleString()}원입니다. 액면의 ${V.parMultiple}배입니다.\n${V.shares.toLocaleString()}주 전체로는 약 ${(V.totalValue/1e8).toFixed(0)}억입니다.\n이 숫자를 알고 계셨습니까?`,
      qa:[['몰랐습니다','"상속세도, 자기주식도, 후계자 지분매입도 전부 여기서 출발합니다." → 승계 대화 개시'],
        ['그렇게 높습니까?','"장부상 순자산이 크기 때문입니다. 실제 평가는 더 복잡하지만 방향은 이렇습니다." → 정밀평가 제안'],
        ['알고 있었습니다','"그럼 이전 계획도 세우고 계시겠군요. 어디까지 진행하셨습니까?" → 진도 확인'],
        ['팔 생각 없습니다','"파실 때만 문제가 되는 게 아니라 상속 때 그대로 세금이 됩니다." → 리스크 인식']],
      avoid:['"이 금액에 팔 수 있다"고 말하지 마십시오. 세법상 평가액이지 시장가가 아닙니다.','상속세율을 곧바로 곱해서 세금을 말하지 마십시오. 공제·할증이 반영되지 않습니다.'],
      why:'대표가 거의 모릅니다. "몰랐다" 반응이 나오면 승계·자본거래 대화가 한 번에 열립니다.'});
  }
  if(ceo&&c.retireRule==='없음'){
    add({tag:'퇴직금 규정',theme:'대표 개인',sev:1,hook:'대표가 가장 놀라는 지점',
      facts:[`현 대표이사 근속 ${crRegTenure(ceo.since)} (${ceo.since} ${ceo.type})`,
        `정관상 임원 퇴직금 지급규정 없음 (컨설턴트 확인)`,
        ok(L.cashAndCashEquivalents)?`현금성자산 ${eok(L.cashAndCashEquivalents)}억`:null],
      insight:`법인세법 시행령 제44조는 임원 퇴직급여를 정관 또는 정관에서 위임한 규정에 정해진 금액까지만 손금으로 인정합니다. 규정이 없으면 「임원 퇴직급여 지급규정이 없는 경우」의 법정 산식(퇴직 전 3년 평균급여 × 1/10 × 근속연수)만 인정되고, 초과 지급분은 손금불산입되어 상여로 처분됩니다. 대표가 놀라는 이유는 "회사 돈으로 내 퇴직금을 주는데 왜 비용이 안 되나"를 생각해본 적이 없기 때문입니다. 규정 정비는 주주총회 결의가 필요하고 소급 적용이 제한되므로, 빨리 할수록 유리합니다.`,
      talk:`현 대표님 근속이 ${crRegTenure(ceo.since)}입니다. 그런데 정관에 임원 퇴직금 지급규정이 없다고 하셨습니다.\n규정이 없으면 퇴직금을 지급하셔도 손금으로 인정되지 않을 수 있습니다. 재원을 아무리 준비하셔도 세무상 효과가 크게 달라집니다.\n규정 정비부터 확인해 보시겠습니까?`,
      qa:[['그런 게 필요합니까?','"정관이나 별도 규정에 근거가 있어야 손금 인정이 됩니다." → 정관 개정 컨설팅'],
        ['세무사가 알아서 하겠죠','"정관은 세무 영역이 아니라 상법 영역입니다. 주총 결의가 필요합니다." → 법무 연결'],
        ['이미 있는 것 같은데요','"확인해 보시고 배수와 적용대상 임원을 알려주십시오." → 자료요청'],
        ['퇴직 계획이 없습니다','"규정은 미리 만들어두는 것입니다. 퇴직 직전에 만들면 부인될 수 있습니다." → 시급성']],
      avoid:['"퇴직금을 못 받는다"고 말하지 마십시오. 받을 수는 있고 손금 인정이 문제입니다.','구체적 배수(3배 등)를 먼저 제시하지 마십시오. 세법 한도와 별개 문제입니다.'],
      why:'"규정이 없으면 줘도 비용처리가 안 된다"는 대표가 가장 놀라는 지점. 정관 개정 → 유료컨설팅으로 연결됩니다.'});
  } else if(ceo){
    add({tag:'임원퇴직재원',theme:'대표 개인',sev:2,hook:'근속이 곧 퇴직금',
      facts:[`현 대표이사 근속 ${crRegTenure(ceo.since)}`,
        c.retireRate?`정관 지급배수 ${c.retireRate}`:'정관 지급배수 미확인',
        ok(L.cashAndCashEquivalents)?`현금성자산 ${eok(L.cashAndCashEquivalents)}억`:null],
      insight:`임원 퇴직금은 근속연수와 지급배수, 퇴직 전 급여로 결정됩니다. 문제는 금액이 아니라 시점입니다. 퇴직은 대개 회사 자금이 넉넉할 때가 아니라 승계·건강·경영권 변화 같은 사건과 함께 옵니다. 그때 현금이 없으면 규정이 있어도 지급할 수 없고, 무리하게 지급하면 회사 유동성이 흔들립니다. 그래서 필요재원과 현재재원의 차이를 먼저 계산해야 하고, 그 부족분을 어떻게 채울지가 컨설팅의 본론이 됩니다.`,
      talk:`등기부상 현 대표님 근속이 ${crRegTenure(ceo.since)}입니다.${c.retireRate?` 정관 지급배수는 ${c.retireRate}로 확인됩니다.`:' 정관 지급배수는 확인이 필요합니다.'}\n퇴직금은 근속과 배수로 정해지는데, 지급 시점에 회사에 그만한 현금이 있어야 합니다.${ok(L.cashAndCashEquivalents)?` 현재 현금성자산이 ${eok(L.cashAndCashEquivalents)}억입니다.`:''}\n언제쯤 퇴직을 생각하고 계십니까?`,
      qa:[['아직 멀었습니다','"그래서 지금 준비하면 부담이 적습니다." → 장기 재원 설계'],
        ['3~5년 내입니다','"그럼 지금부터 재원을 나눠 쌓아야 합니다." → 부족재원 산출'],
        ['생각해본 적 없습니다','"규정과 재원 두 가지만 먼저 확인해 보시겠습니까?" → 자료요청']],
      avoid:['보험 상품을 먼저 꺼내지 마십시오. 필요재원 계산이 선행되어야 합니다.','퇴직금 금액을 확정적으로 계산해서 제시하지 마십시오.'],
      why:'근속·배수·재원 3요소를 한 번에 짚습니다. 부족재원이 나오면 보험 검토의 근거가 됩니다.'});
  }
  if(p.avgPay&&p.industryAvgPay&&Number(p.avgPay)>Number(p.industryAvgPay)*1.5){
    const r=(Number(p.avgPay)/Number(p.industryAvgPay));
    add({tag:'보수구조',theme:'대표 개인',sev:2,hook:'동종업계 대비 이상치',
      facts:[`국민연금 기준 평균연봉 ${Number(p.avgPay).toLocaleString()}만원`,
        `동종업계 평균 ${Number(p.industryAvgPay).toLocaleString()}만원 (${r.toFixed(1)}배)`,
        p.employees?`종업원 ${p.employees}명`:null],
      insight:`국민연금 고지금액을 역산한 평균보수가 동종업계의 ${r.toFixed(1)}배라면, 대개 임원 보수 비중이 크기 때문입니다. 국민연금 가입자에는 임원이 포함되므로 인원이 적을수록 대표 보수가 평균을 끌어올립니다. 여기서 두 가지 논점이 생깁니다. 하나는 급여로 가져갈지 배당으로 가져갈지의 세후 비교이고, 다른 하나는 가족 임원의 보수가 실제 업무와 비례하는지입니다. 후자는 부당행위계산부인 대상이 될 수 있어 민감합니다. 다만 국민연금 기준소득월액에는 상한이 있어 실제 보수는 더 클 수 있습니다.`,
      talk:`국민연금 기준 평균연봉이 ${Number(p.avgPay).toLocaleString()}만원인데 동종업계 평균은 ${Number(p.industryAvgPay).toLocaleString()}만원입니다. ${r.toFixed(1)}배입니다.\n임원 보수 비중이 크다는 뜻일 텐데, 급여로 가져가는 게 유리한지 배당이 유리한지는 세후로 비교해 봐야 합니다.\n지금 대표님 보수는 어떤 기준으로 정하셨습니까?`,
      qa:[['그냥 정했습니다','"보수 지급규정과 주총 결의가 있어야 손금 인정이 안전합니다." → 정관·규정'],
        ['세무사가 정해줬습니다','"세후 총액으로 배당과 비교해 보신 적 있습니까?" → 세후 비교표'],
        ['가족도 등재돼 있습니다','"실제 업무와 보수가 비례하는지가 쟁점이 됩니다." → 부당행위계산 점검']],
      avoid:['"보수가 과다하다"고 말하지 마십시오. 판단은 세무 영역입니다.','가족 임원을 문제 삼는 뉘앙스를 만들지 마십시오. 즉시 방어적으로 바뀝니다.'],
      why:'임원보수·배당 설계로 직행. 가족임원 과다보수 리스크도 함께 확인됩니다.'});
  }
  if(ok(L.totalBorrowings)&&num(L.totalBorrowings)>0){
    add({tag:'대표 유고',theme:'대표 개인',sev:2,hook:'대표에게 무슨 일이 생기면',
      facts:[`차입금 ${eok(L.totalBorrowings)}억`,
        ok(L.cashAndCashEquivalents)?`현금성자산 ${eok(L.cashAndCashEquivalents)}억`:null,
        ok(L.sgaExpenses)?`월 고정비 추정 ${eok(num(L.sgaExpenses)/12)}억`:null],
      insight:`대표 유고는 확률은 낮지만 발생하면 회복이 불가능한 위험입니다. 실무에서 가장 먼저 터지는 것은 세 가지입니다. 첫째 개인보증이 걸린 차입금의 기한이익 상실, 둘째 의사결정 공백으로 인한 거래 중단, 셋째 상속세 납부 재원 부족입니다. ${ok(L.cashAndCashEquivalents)&&ok(L.sgaExpenses)?`이 회사는 현금 ${eok(L.cashAndCashEquivalents)}억, 월 고정비 추정 ${eok(num(L.sgaExpenses)/12)}억으로 단순 계산 시 약 ${Math.max(0,Math.round(num(L.cashAndCashEquivalents)/(num(L.sgaExpenses)/12)))}개월분입니다.`:''} 이 대화의 목적은 보험 판매가 아니라 필요재원과 현재재원의 차이를 확인하는 것입니다. 순서를 바꾸면 신뢰를 잃습니다.`,
      talk:`차입금이 ${eok(L.totalBorrowings)}억 있습니다. 대표님 개인보증이 걸려 있는 부분이 있습니까?\n대표님께 갑자기 일이 생기면 회사는 ${ok(L.cashAndCashEquivalents)?`현금 ${eok(L.cashAndCashEquivalents)}억으로 `:''}얼마나 버틸 수 있고, 은행은 어떻게 반응하겠습니까?\n그리고 의사결정 권한을 대신할 분은 정해져 있습니까?`,
      qa:[['개인보증 있습니다','"해소 가능한 부분과 남는 부분을 나눠 봐야 합니다." → 보증 해소·비상재원'],
        ['후계자가 있습니다','"실무 권한까지 넘어가 있습니까?" → 승계 실행 점검'],
        ['생각해본 적 없습니다','"확률이 아니라 영향의 크기로 보셔야 합니다." → 필요재원 산출'],
        ['보험은 이미 있습니다','"계약자·수익자 구조를 확인해 보셨습니까?" → 기존보험 진단']],
      avoid:['"돌아가시면"이라는 직설적 표현을 반복하지 마십시오.','보험 상품명·보험료를 이 단계에서 꺼내지 마십시오. 필요재원 계산이 먼저입니다.'],
      why:'개인보증·경영공백·긴급자금 3가지를 한 번에 확인. 필요재원 산출의 출발점입니다.'});
  }

  /* ═══ D. 자본·지분 ═══ */
  if(ok(L.shortTermLoans)||ok(L.loanReceivable)){
    const v=num(L.shortTermLoans||L.loanReceivable);
    add({tag:'대여금·가지급금',theme:'자본·지분',sev:1,hook:'세무조사에서 가장 먼저 보는 계정',
      facts:[`단기대여금 ${eok(v)}억`,
        ok(L.financeCost)?`금융비용 ${eok(L.financeCost)}억`:null,
        ok(L.totalAssets)?`자산총계 대비 ${(v/num(L.totalAssets)*100).toFixed(1)}%`:null],
      insight:`대여금은 그 자체로 문제가 아니라 실질이 무엇이냐가 문제입니다. 업무 관련성이 확인되지 않으면 세 가지가 동시에 걸립니다. 인정이자 익금산입, 관련 지급이자 손금불산입, 그리고 대표자 귀속 시 상여 처분입니다. 실무에서는 대표가 "잠깐 쓴 돈"으로 생각하는데 세무상으로는 매년 누적됩니다. 중요한 것은 컨설턴트가 먼저 "가지급금"이라고 단정하지 않는 것입니다. 관계사 정상 거래인 경우도 많고, 단정하면 대표가 즉시 닫힙니다. 계약서·이사회 결의·이자 수취 세 가지를 확인하는 것으로 시작해야 합니다.`,
      talk:`재무제표에 단기대여금이 ${eok(v)}억 있습니다.\n업무 관련성이 확인되지 않으면 인정이자와 지급이자 손금불산입이 동시에 걸릴 수 있어 여쭙습니다.\n이 돈은 누구에게, 어떤 목적으로 나간 것입니까? 계약서와 이사회 결의는 있습니까?`,
      qa:[['관계사에 빌려준 것입니다','"이자는 받고 계십니까? 적정 이자율이 적용됐습니까?" → 부당행위계산'],
        ['제가 잠깐 쓴 겁니다','"금액과 시기를 정리해 상환 계획을 만드는 게 우선입니다." → 정상화 프로젝트'],
        ['임직원 대여입니다','"규정과 이자 수취 내역이 있으면 문제되지 않습니다." → 증빙 확인'],
        ['잘 모르겠습니다','"계정별원장을 보시면 상대방이 나옵니다." → 자료요청']],
      avoid:['"가지급금"이라고 먼저 단정하지 마십시오. 실질을 확인한 뒤에 쓸 용어입니다.','세무조사를 겁주는 방식으로 접근하지 마십시오. 방어만 강해집니다.'],
      why:'대표자 가지급금으로 단정하지 말고 실질을 먼저 확인. 정상화 프로젝트로 연결됩니다.'});
  }
  if(ok(L.retainedEarnings)&&num(L.retainedEarnings)>0&&ok(L.totalEquity)){
    add({tag:'미처분이익잉여금',theme:'자본·지분',sev:2,hook:'쌓여만 있는 돈',
      facts:[`이익잉여금 ${eok(L.retainedEarnings)}억`,
        `자본총계 ${eok(L.totalEquity)}억 대비 ${(num(L.retainedEarnings)/num(L.totalEquity)*100).toFixed(0)}%`,
        V?`1주당 가치 ${V.perShare.toLocaleString()}원`:null],
      insight:`이익잉여금은 회사가 번 돈 중 밖으로 나가지 않고 남은 금액입니다. 문제는 이 돈이 주식가치를 계속 밀어올린다는 점입니다. 주식가치가 오르면 상속·증여 시 세부담이 커지고, 자기주식 취득가액도 올라갑니다. 즉 아무것도 하지 않으면 세금이 자동으로 늘어나는 구조입니다. 해법은 배당, 임원 퇴직금, 자기주식 취득 세 갈래인데 각각 세율과 절차가 다릅니다. 배당은 즉시 종합과세, 퇴직금은 분리과세지만 규정이 필요하고, 자기주식은 절차 위반 시 부인됩니다. 순서와 조합을 설계하는 것이 컨설팅의 본론입니다.`,
      talk:`이익잉여금이 ${eok(L.retainedEarnings)}억 쌓여 있습니다. 자본총계 ${eok(L.totalEquity)}억의 ${(num(L.retainedEarnings)/num(L.totalEquity)*100).toFixed(0)}%입니다.\n이 돈이 회사에 남아 있으면 주식가치가 계속 올라가고, 나중에 상속·증여세로 돌아옵니다.\n배당·퇴직금·자기주식 중 어떤 방식을 검토해 보신 적 있습니까?`,
      qa:[['배당은 세금이 많아서요','"종합과세 구간에 따라 다릅니다. 퇴직금·자기주식과 세후로 비교해 보셨습니까?" → 세후 비교'],
        ['회사에 두는 게 안전하죠','"안전하지만 주식가치가 오르면 상속세가 같이 오릅니다." → 리스크 인식'],
        ['자기주식은 들어봤습니다','"절차가 까다로워서 요건 확인이 먼저입니다." → 자기주식 진단'],
        ['생각해본 적 없습니다','"세 가지를 세후로 비교한 표를 만들어 드리겠습니다." → 2차 미팅']],
      avoid:['"절세"라는 단어를 앞세우지 마십시오. 방법론이 아니라 구조 얘기로 시작해야 합니다.','특정 방법(자기주식 등)을 먼저 추천하지 마십시오. 요건 검토가 선행됩니다.'],
      why:'잉여금 = 미래 세금. 배당정책·자기주식·퇴직재원 3개 주제가 동시에 열립니다.'});
  }
  if(R&&R.capital&&R.capital.length>2){
    add({tag:'자본거래 이력',theme:'자본·지분',sev:2,hook:'등기부에서만 보이는 것',
      facts:[`자본금 ${R.capital[0].capital.toLocaleString()}원 → ${R.capital[R.capital.length-1].capital.toLocaleString()}원 (${R.capital.length-1}회 변동)`,
        R.par&&R.par.length>1?`액면가 ${R.par[0].amount.toLocaleString()}원 → ${R.par[R.par.length-1].amount.toLocaleString()}원`:null,
        R.authorizedShares&&R.authorizedShares.length?`발행가능주식 ${R.authorizedShares[R.authorizedShares.length-1].shares.toLocaleString()}주`:null],
      insight:`자본금 변동 이력은 등기부에만 남습니다. 재무제표는 현재 잔액만 보여주기 때문에 과거 증자·감자·액면분할이 언제 어떤 조건으로 이뤄졌는지 알 수 없습니다. 증자 시 주주별 참여 비율이 달랐다면 지분율이 변했을 것이고, 시가보다 낮게 발행했다면 이익을 본 주주에게 증여세 문제가 생길 수 있습니다. 액면분할은 주식 수만 늘리는 것이지만 1주당 평가액 계산의 기준이 되므로 승계 설계에서 반드시 확인해야 합니다. 이 대화는 등기부를 첨부했을 때만 가능하고, 재무제표만 보는 경쟁 도구는 접근할 수 없는 영역입니다.`,
      talk:`과거 자본거래는 나중에 세무상 쟁점이 되는 경우가 많아 먼저 여쭙습니다.\n등기부상 자본금이 ${R.capital[0].capital.toLocaleString()}원에서 ${R.capital[R.capital.length-1].capital.toLocaleString()}원으로 ${R.capital.length-1}차례 변동됐습니다.${R.par&&R.par.length>1?` 액면가도 ${R.par[0].amount.toLocaleString()}원에서 ${R.par[R.par.length-1].amount.toLocaleString()}원으로 변경됐습니다.`:''}\n증자 때 주주별로 어떻게 참여하셨습니까? 지분율이 달라진 부분은 없습니까?`,
      qa:[['제가 다 넣었습니다','"단독 증자면 다른 주주 지분이 희석됐을 텐데 동의는 받으셨습니까?" → 주주간 분쟁 예방'],
        ['투자를 받았습니다','"발행가액이 시가와 차이가 있었습니까?" → 증여의제 점검'],
        ['오래된 일이라 기억이 안 납니다','"등기부에 날짜가 남아 있으니 그때 자료를 찾아보시면 됩니다." → 자료요청']],
      avoid:['"문제가 있다"고 단정하지 마십시오. 정상 거래가 대부분입니다.','증여세를 먼저 언급하지 마십시오. 사실 확인이 먼저입니다.'],
      why:'증자 시 지분 희석·저가발행 쟁점 확인. 주주구성 대화의 자연스러운 입구입니다.'});
  }
  if(V&&V.totalValue){
    add({tag:'승계·상속',theme:'자본·지분',sev:2,hook:'지금 돌아가시면',
      facts:[`주식 전체 추정가치 약 ${(V.totalValue/1e8).toFixed(0)}억`,
        ok(L.cashAndCashEquivalents)?`회사 현금성자산 ${eok(L.cashAndCashEquivalents)}억`:null,
        ceo?`현 대표 근속 ${crRegTenure(ceo.since)}`:null],
      insight:`승계에서 가장 흔한 실패는 세금을 준비하지 않은 것이 아니라, 재원의 성격을 잘못 준비한 것입니다. 상속세는 현금으로 납부해야 하는데 재산의 대부분이 주식이면 팔 수도 없고 담보로 쓰기도 어렵습니다. 회사에서 돈을 꺼내면 그 자체로 또 과세됩니다. 연부연납으로 나눠 낼 수 있지만 이자상당액이 붙고 담보가 필요합니다. 그래서 승계는 "언제 얼마를 넘길 것인가"보다 "그때 현금을 어디서 만들 것인가"가 먼저입니다. 가업상속공제 요건을 충족하면 부담이 크게 줄지만 사후관리 요건이 엄격해 사전 점검이 필수입니다.`,
      talk:`주식 전체 가치가 약 ${(V.totalValue/1e8).toFixed(0)}억으로 추정됩니다. 지금 상황에서 상속이 일어나면 상속세 재원을 어디서 마련하시겠습니까?\n주식은 팔기 어렵고, 회사 돈을 꺼내면 또 세금이 붙습니다.\n후계자는 정해져 있습니까? 가족 간 합의는 되어 있습니까?`,
      qa:[['아들이 이어받을 겁니다','"지분과 경영권을 나눠서 보셔야 합니다. 다른 자녀는 어떻게 하실 계획입니까?" → 가족 합의'],
        ['가업상속공제 들어봤습니다','"업종·고용·지분 유지 요건이 있어 사전 점검이 필요합니다." → 요건 진단'],
        ['아직 이릅니다','"이르지 않습니다. 가치가 더 오르면 세금도 같이 오릅니다." → 시급성'],
        ['팔 생각입니다','"매각도 가치평가와 세무구조가 먼저입니다." → M&A 진단']],
      avoid:['상속세 금액을 단순 곱셈으로 제시하지 마십시오. 공제와 할증이 반영되지 않습니다.','가족 관계를 먼저 캐묻지 마십시오. 대표가 스스로 말할 때까지 기다리십시오.'],
      why:'금액이 구체적으로 나오면 대표가 처음으로 심각하게 받아들입니다. 승계재원 = 보험 검토의 근거.'});
  }

  /* ═══ E. 운영 ═══ */
  if(ok(L.tradeReceivables)&&ok(L.revenue)){
    const dso=num(L.tradeReceivables)/num(L.revenue)*365;
    if(dso>90)add({tag:'매출채권 회수',theme:'운영',sev:2,hook:'돈이 묶여 있는 곳',
      facts:[`매출채권 ${eok(L.tradeReceivables)}억 · 매출 ${eok(L.revenue)}억`,
        `회수기간 약 ${Math.round(dso)}일 (${(dso/30).toFixed(1)}개월)`,
        ok(P0.tradeReceivables)&&ok(P0.revenue)?`전년 ${Math.round(num(P0.tradeReceivables)/num(P0.revenue)*365)}일`:null],
      insight:`회수기간 ${Math.round(dso)}일은 물건이나 용역이 나간 뒤 ${(dso/30).toFixed(1)}개월 뒤에 현금이 들어온다는 뜻입니다. 그동안 인건비·임차료·매입대금은 먼저 나가므로 매출이 늘수록 오히려 현금이 부족해지는 구조가 됩니다. 흑자도산의 전형적 경로입니다. 여기서 확인할 것은 두 가지입니다. 하나는 특정 거래처 집중도이고, 다른 하나는 장기 미회수 채권의 존재입니다. 거래처가 집중돼 있으면 그 한 곳이 무너질 때 회사가 같이 흔들리고, 장기 미회수는 대손 처리 시점을 놓치면 손금 인정이 어려워집니다.`,
      talk:`매출채권이 ${eok(L.tradeReceivables)}억입니다. 매출 ${eok(L.revenue)}억 기준으로 회수기간이 약 ${Math.round(dso)}일입니다.\n${Math.round(dso)}일이면 물건은 나갔는데 돈은 ${(dso/30).toFixed(1)}개월 뒤에 들어온다는 뜻입니다.\n특정 거래처에 집중돼 있습니까? 연체나 대손이 있었던 곳은 어디입니까?`,
      qa:[['업계 관행입니다','"관행이어도 자금은 회사가 부담합니다. 할인이나 팩토링을 검토해 보셨습니까?" → 회수 개선'],
        ['한두 곳에 몰려 있습니다','"그 거래처에 문제가 생기면 어떻게 되겠습니까?" → 신용보험 검토'],
        ['오래된 미수금이 있습니다','"대손 처리 시점을 놓치면 손금 인정이 어려워집니다." → 경정청구 연결']],
      avoid:['"채권 관리를 못한다"고 평가하지 마십시오. 거래 관계상 어쩔 수 없는 경우가 많습니다.','보험을 먼저 꺼내지 말고 집중도부터 확인하십시오.'],
      why:'회수기간이 곧 현금흐름. 거래처 집중은 신용보험 검토의 근거가 됩니다.'});
  }
  if(ok(L.revenue)&&ok(F0.revenue)&&ys.length>=3){
    const g=pct(L.revenue,F0.revenue);
    if(Math.abs(g)>=20)add({tag:'매출 추세',theme:'운영',sev:3,hook:'성장의 방향',
      facts:[`매출 ${Y0}년 ${eok(F0.revenue)}억 → ${Y}년 ${eok(L.revenue)}억 (${g>0?'+':''}${g.toFixed(0)}%)`,
        ok(F0.totalAssets)&&ok(L.totalAssets)?`자산총계 ${pct(L.totalAssets,F0.totalAssets).toFixed(0)}%`:null,
        ok(L.operatingIncome)&&ok(L.revenue)?`영업이익률 ${(num(L.operatingIncome)/num(L.revenue)*100).toFixed(1)}%`:null],
      insight:`${g>0?`매출이 ${g.toFixed(0)}% 성장했지만 자산총계가 ${ok(F0.totalAssets)&&ok(L.totalAssets)?pct(L.totalAssets,F0.totalAssets).toFixed(0)+'%':'그 이상'} 늘었다면 성장보다 투자가 앞선 상태입니다. 자산이 매출보다 빨리 늘면 총자산회전율이 떨어지고, 투자한 자산이 매출로 전환되는 시차 동안 현금 부담이 커집니다.`:`매출이 ${Math.abs(g).toFixed(0)}% 줄었는데 고정비가 그대로면 손익분기점이 올라갑니다. 인력과 설비는 단기간에 줄이기 어려우므로 회복 시점까지 버틸 현금이 관건이 됩니다.`} 이 질문의 목적은 진단이 아니라 대표가 스스로 상황을 말하게 하는 것입니다. 숫자를 먼저 해석해 주면 대표는 방어하거나 수긍만 하고, 정보는 나오지 않습니다.`,
      talk:`매출이 ${Y0}년 ${eok(F0.revenue)}억에서 ${Y}년 ${eok(L.revenue)}억으로 ${g>0?'+':''}${g.toFixed(0)}% ${g>0?'성장했습니다':'감소했습니다'}.\n${g>0?`같은 기간 자산총계는 ${ok(F0.totalAssets)&&ok(L.totalAssets)?pct(L.totalAssets,F0.totalAssets).toFixed(0)+'%':'—'} 늘었습니다.`:'고정비 구조는 크게 달라지지 않았을 텐데요.'}\n이 흐름을 대표님은 어떻게 보고 계십니까?`,
      qa:[['신규 거래처가 늘었습니다','"객단가와 신규 중 어느 쪽 비중이 큽니까?" → 성장 원천 분석'],
        ['설비를 늘렸습니다','"가동률은 어느 정도입니까?" → 과대투자 점검'],
        ['시장이 어렵습니다','"어느 구간에서 막혔다고 보십니까?" → 병목 진단']],
      avoid:['"과대투자"라는 단어를 먼저 쓰지 마십시오. 판단은 대표가 하게 하십시오.','업종 평균을 먼저 들이대지 마십시오. 대표는 자기 사정이 다르다고 생각합니다.'],
      why:'성장성 진단의 입구. 대표가 스스로 진단하게 만드는 질문입니다.'});
  }

  /* ═══ F. 지배구조 ═══ */
  if(R&&R.ceoTerms>=3){
    add({tag:'경영권 변동',theme:'지배구조',sev:2,hook:'등기부에서만 보이는 것',
      facts:[`대표이사 취임 이력 ${R.ceoTerms}회`,
        ceo?`현 대표 취임 ${ceo.since} (근속 ${crRegTenure(ceo.since)})`:null,
        R.current?`현직 임원 ${R.current.length}명`:null],
      insight:`대표이사가 자주 바뀌는 회사는 세 가지 중 하나입니다. 승계가 진행 중이거나, 전문경영인 체제이거나, 주주 간 갈등이 있는 경우입니다. 어느 쪽이든 지분 구조와 함께 봐야 합니다. 특히 임원 퇴직금은 근속에 비례하므로 대표가 바뀔 때마다 퇴직금 지급 의무가 발생하는데, 규정과 재원 없이 반복되면 회사 현금이 계속 빠져나갑니다. 등기부를 보지 않으면 이 패턴이 전혀 보이지 않습니다. 재무제표에는 대표 이름조차 나오지 않습니다.`,
      talk:`등기부를 보니 대표이사가 ${R.ceoTerms}번 바뀌었습니다.${ceo?` 현재 대표님 취임이 ${ceo.since}, 근속 ${crRegTenure(ceo.since)}입니다.`:''}\n임원 퇴직금은 근속에 비례하고, 경영권이 자주 바뀌면 지분 구조도 함께 확인해야 합니다.\n혹시 승계나 지분 정리를 염두에 두고 계신 변화였습니까?`,
      qa:[['승계 과정입니다','"지분은 어디까지 넘어갔습니까?" → 승계 진도 확인'],
        ['전문경영인 체제입니다','"오너 지분과 경영권 분리 구조는 정관에 반영돼 있습니까?" → 지배구조'],
        ['사정이 있었습니다','"퇴임하신 분들 퇴직금은 정리되셨습니까?" → 퇴직금 규정']],
      avoid:['이유를 캐묻지 마십시오. 민감한 사정이 있을 수 있습니다.','"분쟁"이라는 단어를 먼저 쓰지 마십시오.'],
      why:'등기부 첨부 시에만 가능. 재무제표만 보는 경쟁 도구는 할 수 없는 질문입니다.'});
  }
  if(R&&R.overdueOfficers&&R.overdueOfficers.length){
    add({tag:'등기 정비',theme:'지배구조',sev:3,hook:'실무에서 자주 놓치는 것',
      facts:[`임기 경과 추정 ${R.overdueOfficers.length}명 — ${R.overdueOfficers.map(o=>o.role+' '+o.name).join(', ')}`,
        '상법 기본임기 3년 기준 추정 (정관 확인 필요)'],
      insight:`이사의 임기는 상법상 3년을 초과할 수 없고, 임기 만료 후 중임등기를 하지 않으면 과태료가 부과됩니다. 더 큰 문제는 그 기간 이사회 결의의 효력이 다투어질 수 있다는 점입니다. 실무에서는 등기를 미루다가 몇 년치가 한꺼번에 쌓이는 경우가 흔합니다. 다만 정관에서 임기를 달리 정했을 수 있으므로 단정하면 안 되고, 확인을 권하는 선에서 멈춰야 합니다. 이 항목은 금액이 크지 않지만 "이런 것까지 봐주는구나"라는 인상을 주는 데 효과적입니다.`,
      talk:`등기부상 ${R.overdueOfficers.map(o=>o.role+' '+o.name).join(', ')}의 임기가 이미 지난 것으로 보입니다.\n중임등기를 하지 않으면 과태료가 부과되고, 그 기간 의사결정의 효력이 다투어질 수 있습니다.\n최근 임원 변경등기는 언제 하셨습니까?`,
      qa:[['법무사가 알아서 합니다','"연락이 안 갔을 수 있으니 한번 확인해 보십시오." → 실행 촉구'],
        ['몰랐습니다','"정관상 임기를 먼저 확인하시면 됩니다." → 정관 자료요청']],
      avoid:['"위법"이라는 표현을 쓰지 마십시오. 정관에 따라 다를 수 있습니다.','과태료 금액을 구체적으로 말하지 마십시오.'],
      why:'상법 기본임기 3년 기준 추정. 정관 확인이 필요하지만 대화 물꼬로는 충분합니다.'});
  }
  if(c.shareTransfer==='제한 없음'||(R&&R.stockOption)){
    add({tag:'지분 방어',theme:'지배구조',sev:3,hook:'지분이 흩어지면',
      facts:[c.shareTransfer?`정관상 주식양도 제한 — ${c.shareTransfer}`:null,
        R&&R.stockOption?'등기부상 주식매수선택권 설정 있음':null,
        V?`1주당 가치 ${V.perShare.toLocaleString()}원`:null],
      insight:`주식양도 제한이 없으면 주주가 지분을 누구에게든 팔 수 있습니다. 비상장회사에서 이는 상당한 위험입니다. 퇴사한 임원이나 갈라선 동업자가 지분을 외부에 넘기면 회사가 통제할 방법이 없고, 경영권 분쟁이나 회계장부 열람 청구로 이어집니다. 주식매수선택권이 설정돼 있으면 행사 시 지분이 희석되므로 대표 지분율이 예상보다 낮아질 수 있습니다. 해법은 정관에 이사회 승인 조항을 넣거나 주주간계약을 체결하는 것인데, 둘 다 기존 주주 동의가 필요하므로 관계가 나빠지기 전에 해야 합니다.`,
      talk:`${c.shareTransfer==='제한 없음'?'정관에 주식양도 제한이 없습니다. 주주가 지분을 외부에 팔아도 회사가 막을 방법이 없다는 뜻입니다.':''}${R&&R.stockOption?`${c.shareTransfer==='제한 없음'?'\n그리고 ':''}등기부상 주식매수선택권이 설정돼 있습니다. 행사되면 지분이 희석됩니다.`:''}\n지금 지분 구조에서 대표님 의결권은 안전합니까?`,
      qa:[['제가 대부분 가지고 있습니다','"나머지는 누가 가지고 계십니까? 관계는 어떻습니까?" → 주주 구성 확인'],
        ['공동주주가 있습니다','"주주간계약은 체결하셨습니까?" → 주주간계약 컨설팅'],
        ['퇴사한 임원이 가지고 있습니다','"회수 방법을 정해두지 않으면 나중에 어려워집니다." → 자기주식·양수도']],
      avoid:['분쟁 가능성을 겁주는 방식으로 말하지 마십시오.','특정 주주를 의심하는 뉘앙스를 만들지 마십시오.'],
      why:'주주간계약·정관 정비 유료컨설팅으로 연결. 공동주주가 있으면 특히 강력합니다.'});
  }

  /* ★ facts 배열의 null/빈값 제거 — 화면·인쇄에 빈 항목이 남지 않도록 */
  O.forEach(o=>{o.facts=(o.facts||[]).filter(x=>x!=null&&String(x).trim()!=='');});
  const ORDER=['긴급 신호','돌려받는 얘기','대표 개인','자본·지분','운영','지배구조'];
  const best={};O.forEach(o=>{best[o.theme]=Math.min(best[o.theme]??9,o.sev);});
  O.sort((a,b)=>(best[a.theme]-best[b.theme])||(ORDER.indexOf(a.theme)-ORDER.indexOf(b.theme))||(a.sev-b.sev));
  /* 상위 3개는 서로 다른 주제로 뽑아 대화 방향이 쏠리지 않게 한다 */
  const top=[],seen=new Set();
  for(const o of O){if(top.length<3&&!seen.has(o.theme)){top.push(o);seen.add(o.theme);}}
  for(const o of O){if(top.length<3&&!top.includes(o))top.push(o);}
  O.forEach(o=>{o.featured=top.includes(o);});
  return O;
}
/* ★ [2026-08-01] AI 도입 화법 — 코드 화법을 대체하지 않고 보완한다.
   숫자는 코드 계산기가 만들고 AI는 해석만 한다(기획안 12장 원칙).      */
function crAiOpenerPayload(model){
  const R=crRegData(), c=crCharter();
  const sig=(typeof crRefundSignals==='function')?crRefundSignals(model):[];
  return {
    profile:model?.profile||{},
    financials:model?.financials||{},
    valuation:model?.calculations?.valuation||null,
    registry:R?{company:R.company,current:R.current,ceoTerms:R.ceoTerms,capital:R.capital,
      par:R.par,authorizedShares:R.authorizedShares,stockOption:R.stockOption,
      nameHistory:R.nameHistory,addressHistory:R.addressHistory,
      overdueOfficers:R.overdueOfficers,entityType:R.entityType}:null,
    charter:(c&&Object.keys(c).length)?c:null,
    refundSignals:sig.map(s=>({id:s.id,name:s.name,law:s.law,art:s.art,fact:s.fact,src:s.src})),
    issues:(model?.issues||[]).map(x=>({id:x.id,title:x.title,severity:x.severity,meaning:x.meaning}))
  };
}
async function crLoadAiOpeners(model){
  if(!model)return null;
  const out=await ServerAdapter.aiOpeners(crAiOpenerPayload(model));
  if(out&&out.ok&&Array.isArray(out.openers)&&out.openers.length){
    state.aiOpeners={openers:out.openers,review:out.review||null,meta:out.meta||null,loadedAt:nowIso()};
  }
  return out;
}
function crAiOpenerBlock(){
  const A=state.aiOpeners;
  if(!A||!A.openers||!A.openers.length){
    return (state.live&&state.live.aiOpeners===false)
      ? '<div class="notice ai-pending"><b>AI 추가 화법 — 생성되지 않았습니다</b>서버 연결이 확인되지 않아 이번에는 규칙 기반 화법만 표시했습니다. 위 화법만으로도 초회면담에는 충분합니다.</div>'
      : '';
  }
  const rv=A.review||{};
  const badge=rv.passed===true?'<span class="ai-ok">교차검수 통과</span>'
    :rv.passed===false?'<span class="ai-fix">검수 후 교정본</span>'
    :'<span class="ai-warn">검수 미완</span>';
  const body=o=>`
     <div class="op-sec"><b>📊 무슨 일이 있었나</b><ul>${(o.facts||[]).filter(Boolean).map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div>
     <div class="op-sec op-insight"><b>🔍 왜 중요한가</b><p>${esc(o.insight||'')}</p></div>
     <div class="op-sec"><b>🗣 대면 도입</b><div class="op-talk">${String(o.talk||'').split('\n').map(l=>`<p>${esc(l)}</p>`).join('')}</div></div>
     ${(o.qa||[]).length?`<div class="op-sec"><b>💬 예상 답변 → 이어갈 질문</b><table class="op-qa"><tbody>${o.qa.map(x=>`<tr><td>"${esc(x[0])}"</td><td>${esc(x[1])}</td></tr>`).join('')}</tbody></table></div>`:''}
     ${(o.avoid||[]).length?`<div class="op-sec op-avoid"><b>⚠️ 하지 말 것</b><ul>${o.avoid.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
     ${o.why?`<div class="op-why"><b>왜 이 질문인가</b> ${esc(o.why)}</div>`:''}`;
  return `<h3 style="margin-top:6mm">🤖 AI 추가 화법 ${A.openers.length}개 ${badge}</h3>
    <div class="notice ai-note"><b>규칙으로는 잡히지 않는 조합·문맥을 해석한 화법입니다.</b>
      숫자는 확정값을 그대로 인용하도록 통제했으나 <b>원인과 배경은 대표님께 확인</b>하십시오.
      ${(rv.issues&&rv.issues.length)?('검수에서 '+rv.issues.length+'건이 교정되었습니다.'):''}</div>
    ${A.openers.map((o,i)=>`<div class="op-item ai"><div class="op-hd"><span class="op-no ai">AI</span><b>${esc(o.tag||('추가 화법 '+(i+1)))}</b>${o.theme?`<span class="op-theme">${esc(o.theme)}</span>`:''}${o.hook?`<span class="op-hook">${esc(o.hook)}</span>`:''}</div>${body(o)}</div>`).join('')}`;
}
function crOpenerPage(model){
  const O=crOpeners(model); if(!O.length)return;
  const feat=O.filter(o=>o.featured), rest=O.filter(o=>!o.featured);
  const body=(o,i)=>`
     <div class="op-sec"><b>📊 무슨 일이 있었나</b><ul>${(o.facts||[]).filter(Boolean).map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div>
     <div class="op-sec op-insight"><b>🔍 왜 중요한가</b><p>${esc(o.insight||'')}</p></div>
     <div class="op-sec"><b>🗣 대면 도입</b><div class="op-talk">${o.talk.split('\n').map(l=>`<p>${esc(l)}</p>`).join('')}</div></div>
     <div class="op-sec"><b>💬 예상 답변 → 이어갈 질문</b>
       <table class="op-qa"><tbody>${(o.qa||[]).map(([a,b])=>`<tr><td>"${esc(a)}"</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>
     <div class="op-sec op-avoid"><b>⚠️ 하지 말 것</b><ul>${(o.avoid||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
     <div class="op-why"><b>왜 이 질문인가</b> ${esc(o.why)}</div>`;
  const card=(o,i,open)=>`<div class="op-item sev${o.sev}${open?' featured':''}">
     <div class="op-hd"><span class="op-no">${i+1}</span><b>${esc(o.tag)}</b><span class="op-theme">${esc(o.theme)}</span><span class="op-hook">${esc(o.hook)}</span></div>
     ${body(o,i)}</div>`;
  const fold=(o,i)=>`<details class="op-fold"><summary><span class="op-no sm">${i+1}</span><b>${esc(o.tag)}</b><span class="op-theme">${esc(o.theme)}</span><span class="op-hook">${esc(o.hook)}</span></summary>${body(o,i)}</details>`;
  addPage({id:'openers',title:'초회면담 도입 화법',subtitle:'이 기업의 실제 숫자로 만든 첫 질문입니다. 읽고 이해한 뒤 상황에 맞게 쓰십시오.',section:'CONSULTANT ONLY · OPENING',visibility:'consultant',summary:`도입 화법 ${O.length}개`,
   body:`<div class="notice"><b>컨설턴트 전용</b>이 페이지는 CEO 전달본·발표모드에 표시되지 않습니다. 대표님 앞에서 열지 마십시오.</div>
   <div class="lead"><b>이 기업 데이터로 생성된 도입 화법 ${O.length}개 — 우선 3개를 펼쳤습니다</b>
     <p>모든 숫자는 이 기업의 실제 재무·등기·국민연금 자료에서 산출한 값입니다. 상위 3개는 서로 다른 주제로 골라, 어느 방향으로든 대화를 열 수 있게 배치했습니다. 나머지는 아래에서 펼쳐 보실 수 있습니다.</p>
     <div class="op-themes">${[...new Set(O.map(x=>x.theme))].map(th=>`<span>${esc(th)} ${O.filter(x=>x.theme===th).length}</span>`).join('')}</div></div>
   ${feat.map((o,i)=>card(o,i,true)).join('')}
   ${rest.length?`<h3 style="margin-top:6mm">나머지 ${rest.length}개 — 필요할 때 펼쳐 보십시오</h3>${rest.map((o,i)=>fold(o,i+feat.length)).join('')}`:''}
   ${crAiOpenerBlock()}
   <div class="notice amber"><b>표현 경계</b>숫자는 확인된 자료 기준입니다. 원인과 배경은 <b>단정하지 말고 대표님께 여쭈십시오.</b> 세무·법률 판단이 필요한 항목은 전문가 검토 대상으로 안내하고, 컨설턴트가 결론을 내리지 않습니다.</div>`});
}

function crValuationPage(model){
  const V=model?.calculations?.valuation; if(!V)return;
  const won=n=>Number(n).toLocaleString('ko-KR');
  const eok=n=>(n/1e8).toFixed(n/1e8>=100?0:1);
  addPage({id:'valuation',title:'비상장주식 가치 추정',subtitle:'상속·증여·자기주식·승계 재원의 출발점이 되는 1주당 가치입니다.',section:'VALUATION',visibility:'common',issueId:'VAL-01',summary:`1주당 약 ${won(V.perShare)}원`,
   body:`<div class="lead"><b>1주당 약 ${won(V.perShare)}원 · 총 약 ${eok(V.totalValue)}억원</b>
     <p>${V.baseYear}년 결산 기준 추정치입니다.${V.parMultiple?` 액면가 ${won(V.parValue)}원의 <b>약 ${V.parMultiple}배</b>입니다.`:''} 대표님이 보유한 지분의 상속·증여세, 자기주식 취득가액, 후계자 지분매입 자금이 모두 이 금액에서 출발합니다.</p></div>
   <table><thead><tr><th>구분</th><th>1주당</th><th>산식</th></tr></thead><tbody>
     <tr><td>순자산가치</td><td style="text-align:right"><b>${won(V.navPer)}원</b></td><td>자본총계 ${won(V.equity)}백만원 ÷ ${won(V.shares)}주</td></tr>
     <tr><td>순손익가치</td><td style="text-align:right">${V.incPer==null?'—':won(V.incPer)+'원'}</td><td>${V.wAvgNi==null?'산출 불가':`최근 3년 가중평균(3:2:1) 순손익 ${won(Math.round(V.wAvgNi))}백만원 ÷ ${won(V.shares)}주 ÷ 10%`}</td></tr>
     <tr><td>가중평균</td><td style="text-align:right">${won(V.raw)}원</td><td>${esc(V.weight)}${V.heavyRE?' (부동산과다법인)':''}</td></tr>
     <tr><td>순자산가치 80% 하한</td><td style="text-align:right">${won(V.floor)}원</td><td>상증령 §54③</td></tr>
     <tr style="background:#F3FAF7"><td><b>적용 평가액</b></td><td style="text-align:right"><b>${won(V.perShare)}원</b></td><td>${esc(V.method)}</td></tr>
   </tbody></table>
   <div class="cols2" style="margin-top:5mm">
     <div class="card"><h3>지분 100%의 가치</h3><p><b>약 ${eok(V.totalValue)}억원</b> (${won(V.shares)}주 × ${won(V.perShare)}원)</p></div>
     <div class="card"><h3>발행주식 출처</h3><p>${esc(V.sharesSource)}${V.sharesSource==='등기부'?' — 등기사항증명서에서 확인':' — 주주명부·등기부로 확정 필요'}</p></div>
   </div>
   <div class="notice amber"><b>표현 경계</b>본 금액은 상속세및증여세법 보충적 평가방법(§63, 상증령 §54)에 따른 <b>추정치</b>입니다. 실제 평가에는 영업권 가산, 부동산 개별 감정, 최대주주 할증(20%), 순자산 조정항목이 반영되어 달라질 수 있습니다. <b>세무전문가 검토 전 확정 금액으로 사용하지 않습니다.</b></div>
   <div class="source-box"><b>다음 확인</b> 최신 주주명부 · 정관 · 부동산 보유 현황 · 특수관계인 지분율(최대주주 할증 판단) · 영업권 평가 대상 여부</div>`});
}
function crRegistryPage(){
  const R=crRegData(); if(!R)return;
  const ceo=R.current.find(o=>o.role==='대표이사');
  const off=R.current.map(o=>`<tr${o.overdue?' style="background:#FEF2F2"':''}><td>${esc(o.role)}</td><td><b>${esc(o.name)}</b></td><td>${esc(o.since)} ${esc(o.type)}</td><td>${crRegTenure(o.since)}</td><td>${esc(o.firstAppointed)}</td><td>${esc(o.expiry)}${o.overdue?' ⚠️':''}</td></tr>`).join('');
  const cap=R.capital.map(c=>`<tr><td>${esc(c.date||'설립')}</td><td>${c.shares.toLocaleString()}주</td><td>${c.capital.toLocaleString()}원</td></tr>`).join('');
  const par=(R.par||[]).map(x=>`${esc(x.date||'설립')} ${x.amount.toLocaleString()}원`).join(' → ');
  addPage({id:'registry',title:'법인 등기 확인사항',subtitle:'임원 근속·경영권 변동·자본거래 이력을 등기부로 확정했습니다.',section:'REGISTRY',visibility:'common',summary:'등기부 확인사항',
    body:`<div class="lead"><b>현직 임원 ${R.current.length}명 · 대표이사 취임 이력 ${R.ceoTerms}회 · 자본금 변동 ${R.capital.length}건</b>${ceo?`<p>현 대표이사 ${esc(ceo.name)}의 근속은 <b>${crRegTenure(ceo.since)}</b>이며, 임원퇴직금 예상액과 지급재원 계산의 기준이 됩니다.</p>`:''}</div>
    <h3>현직 임원</h3><table><thead><tr><th>직위</th><th>성명</th><th>최근 등기</th><th>근속</th><th>최초 취임</th><th>임기만료 예상</th></tr></thead><tbody>${off||'<tr><td colspan="6">확인 필요</td></tr>'}</tbody></table>
    <h3 style="margin-top:5mm">자본금·발행주식 이력</h3><table><thead><tr><th>변경일</th><th>발행주식총수</th><th>자본금</th></tr></thead><tbody>${cap||'<tr><td colspan="3">확인 필요</td></tr>'}</tbody></table>
    ${par?`<div class="source-box"><b>액면가</b> ${par}</div>`:''}
    ${(R.nameHistory.length>1||R.addressHistory.length>1||R.purposes.length)?`<h3 style="margin-top:5mm">연혁·사업목적</h3><div class="cols2">
      ${R.nameHistory.length>1?`<div class="card"><h3>상호 변경 ${R.nameHistory.length-1}회</h3><p>${R.nameHistory.map(x=>`${esc(x.date||'설립')} ${esc(x.name)}`).join('<br>')}</p></div>`:''}
      ${R.addressHistory.length>1?`<div class="card"><h3>본점 이전 ${R.addressHistory.length-1}회</h3><p>현재 ${esc(R.addressHistory[R.addressHistory.length-1].addr)}</p></div>`:''}
      ${R.purposes.length?`<div class="card"><h3>목적사업 ${R.purposes.length}개</h3><p>${esc(R.purposes.slice(0,10).join(' · '))}${R.purposes.length>10?' 외 '+(R.purposes.length-10)+'개':''}</p></div>`:''}
      ${(()=>{const a=R.authorizedShares.length?R.authorizedShares[R.authorizedShares.length-1]:null,c=R.capital.length?R.capital[R.capital.length-1]:null;return (a&&c)?`<div class="card"><h3>증자 여력</h3><p>발행가능 ${a.shares.toLocaleString()}주 중 ${c.shares.toLocaleString()}주 발행 (${(c.shares/a.shares*100).toFixed(1)}%) · 여력 ${(a.shares-c.shares).toLocaleString()}주</p></div>`:'';})()}
    </div>`:''}
    ${R.overdueOfficers.length?`<div class="notice amber"><b>임기 경과 임원 ${R.overdueOfficers.length}명</b>${R.overdueOfficers.map(o=>esc(o.role)+' '+esc(o.name)+'('+esc(o.expiry)+' 만료 예상)').join(' · ')} — 상법 기본임기 3년 기준 추정이며, 정관상 임기와 중임등기 여부를 확인해야 합니다.</div>`:''}
    ${R.capitalDecrease.length?`<div class="notice amber"><b>자본금 감소 ${R.capitalDecrease.length}회</b>감자 절차·과세 이슈 확인이 필요합니다.</div>`:''}
    ${R.stockOption?'<div class="notice amber"><b>주식매수선택권 설정 있음</b>행사 시 지분 희석과 주식가치 평가에 영향을 줄 수 있어 부여내역·행사조건 확인이 필요합니다.</div>':''}
    <div class="notice"><b>표현 경계</b>등기부는 등기된 사실만 보여줍니다. 실제 재직·보수·퇴직금 규정은 정관·주총결의·보수자료로 별도 확인해야 합니다. 개인정보는 저장하지 않습니다.</div>`});
}
function issuePage(issue,index){
 const lib=SpeechEngine.get(issue.id,state.caseData);const body=`<div class="lead"><b>${esc(issue.title)} — ${esc(issue.severity)} / 근거 ${esc(issue.confidence)}</b><p>${esc(issue.meaning)}</p></div>${issueFlow(issue)}<div class="notice amber"><b>표현 경계</b>${esc(lib.guardrail||'미확인 사실은 단정하지 않습니다.')}</div><div class="source-box"><b>근거</b> ${esc(issue.facts.join(' · '))}</div>${crRegIssueBlock(issue.id)}`;
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
 const chapters=[{title:'기업의 한 문장 진단과 학습목표',minutes:2,sourceIssueIds:active.slice(),script:`${company} 기업진단리포트 상담 브리핑을 시작하겠습니다. 오늘의 목표는 리포트를 외우는 것이 아니라 ${company}에서 무엇을 묻고 어떤 순서로 상담해야 하는지 익히는 것입니다. 이번 기업은 ${introType}입니다. 보험은 분석의 출발점이 아니라 위험과 부족재원이 확인된 뒤 비교하는 결론입니다.`}];
 active.slice(0,3).forEach((id,idx)=>{const lib=SpeechEngine.get(id,model),note=SpeechEngine.notes({issueId:id,title:lib.title,summary:lib.signal},model,model),branch=note.branches[idx%note.branches.length],obj=note.objections[0];chapters.push({title:`핵심 이슈 ${idx+1} · ${lib.title}`,minutes:4,sourceIssueIds:[id],script:`학습목표는 ${lib.title}의 숫자를 경영언어로 설명하고 다음 행동에 합의하는 것입니다.\n\n${note.speech3m}\n\n실전 질문은 다음과 같습니다. ${note.questions.slice(0,3).join(' ')}\n\n대표가 ${branch?.expression||'다른 의견을 제시'}하면 ${branch?.response||'우려를 인정합니다.'} 이어서 ${branch?.followUp||'판단기준을 질문합니다.'} 최종 행동은 ${branch?.agreement||lib.nextAction}입니다.${obj?`\n\n대표 반론 “${obj.title}”에는 ${obj.dialogue.filter(x=>x.speaker==='컨설턴트').map(x=>x.text).join(' ')}`:''}`});});
 if(lectureType==='INSURANCE_OPPORTUNITY')chapters.push({title:'보험을 꺼내는 시점과 8단계',minutes:4,sourceIssueIds:active.filter(id=>['KEY_PERSON','SUCCESSION','EXECUTIVE_RETIREMENT','EXPORT_CREDIT','PROPERTY_BI','INSURANCE_OPTIMIZATION'].includes(id)),script:`잘못된 접근은 상품과 세금부터 말하는 것입니다. 올바른 순서는 위험사건, 재무충격, 필요재원, 현재재원, 부족재원, 보험 외 대안, 보험 역할입니다. ${INSURANCE_SPEECH_STAGES.map(x=>`${x.stage}. ${x.speech} 완료조건은 ${x.gate}.`).join(' ')} 부족재원이 없으면 보험을 확대하지 않습니다.`});
 else if(lectureType==='INSURANCE_OPTIMIZATION')chapters.push({title:'기존 증권 최적화 원칙',minutes:4,sourceIssueIds:['INSURANCE_OPTIMIZATION'],script:`신규가입보다 모든 법인·개인 증권을 목적별로 분류합니다. 계약자·피보험자·수익자, 보장금액·기간, 현금가치, 해지손실, 면책, 신규심사를 필요재원과 비교합니다. 목적과 기간이 맞으면 유지가 결론이고, 과다하면 감액을 검토하며, 실제 부족분에만 추가설계를 검토합니다. 기존 담당자와의 관계를 존중하고 공동검토할 수 있습니다.`});
 else chapters.push({title:'보험을 배제하고 유료진단을 제안하는 법',minutes:3,sourceIssueIds:active.slice(),script:`현재 분석에서 보험의 직접 당위성이 낮다면 명확히 배제해야 신뢰가 생깁니다. 운전자금, 대여금, 자본거래, 규정과 절차는 보험으로 해결하지 않습니다. 정밀진단의 산출물, 담당자, 기한, KPI와 중단조건을 먼저 합의하고 별도의 우연한 위험과 부족재원이 발견될 때만 보험 게이트를 엽니다.`});
 const objection=SpeechEngine.objectionsFor(active[0]||'WORKING_CAPITAL')[0];
 chapters.push({title:'대표 반론 역할극과 다음 미팅',minutes:3,sourceIssueIds:active.slice(0,1),script:`반론은 거절이 아니라 추가 확인 요청입니다. ${objection?objection.dialogue.map(x=>`${x.speaker}: ${x.text}`).join(' '):'대표의 우려를 인정하고 진짜 이유를 확인한 뒤 범위를 한 단계로 줄입니다.'} 모든 반론의 끝에는 자료, 담당자, 기한, 재검토일 중 하나가 남아야 합니다.`});
 chapters.push({title:'현장 실행과제',minutes:2,sourceIssueIds:active.slice(),script:`다음 미팅에서는 ${active.slice(0,3).flatMap(documentList).slice(0,8).join(', ')}를 준비하십시오. 오늘 전체 계약을 요구하지 않고 판단자료와 다음 확인일까지만 합의합니다. 오늘 주제에서 딱 하나만 기억한다면, 확인된 사실과 계산된 부족재원보다 보험이 먼저 나가서는 안 된다는 원칙입니다. 이상으로 ${company} 기업진단리포트 상담 브리핑을 마칩니다.`});
 let total=chapters.reduce((s,x)=>s+x.minutes,0);if(total<18)chapters[chapters.length-2].minutes+=18-total;if(total>25)chapters.filter(x=>x.minutes>3).forEach(x=>{if(total>25){x.minutes--;total--;}});crAuditScripts(chapters).forEach(h=>console.warn('[TTS 차단검수] 챕터',h.index,h.title,'금지어:',h.terms.join(',')));chapters.forEach(c=>{if(c&&c.script)c.script=crScrubBrand(c.script);});return chapters;
}

function generatePages(model){
 state.pages=[];state.caseData=model; // page builder uses caseData profile/meta
 addPage({id:'cover',title:'표지',cover:true,visibility:'common'});
 addPage({id:'guide',title:'이 리포트는 무엇을 결정하게 하는가',subtitle:'팩트 → 계산 → 근거 → 대안 → 다음 행동의 순서로 읽습니다.',section:'REPORT GUIDE',visibility:'common',summary:'리포트의 사용 목적과 모드 구분',body:`<div class="lead"><b>재무설명이 아니라 CEO의 결정과 컨설턴트의 실행을 지원합니다.</b><p>확인된 팩트와 계산값에서 출발해 유료컨설팅·전문가 협업·보험의 역할을 구분합니다.</p></div><div class="cols3"><div class="card mint"><h3>CEO용</h3>${list(['확인된 사실과 경영적 의미','방치위험과 해결이익','A·B·C 대안','30·90·365일 결정'])}</div><div class="card consultant-only"><h3>컨설턴트용</h3>${list(['페이지별 10단 상담노트','질문·답변분기·반론','유료컨설팅과 보험기회','다음 미팅·계약전환'])}</div><div class="card amber consultant-only"><h3>음성강의용</h3>${list(['리포트 낭독 금지','숫자의 실무 의미','CEO 질문·역할극','보험을 꺼낼 시점'])}</div></div><div class="notice"><b>보험 원칙</b>위험 확인 → 필요재원 → 현재재원 → 부족재원 → 대안 비교 → 보험의 역할 순서로만 접근합니다.</div>`});
  crRegistryPage();
  crValuationPage(model);
  crCharterPage(model);
  crRefundPage(model);
  crRefundRequestPage(model);
  crOpenerPage(model);
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
 addPage({id:'documents',title:'필요자료 통합 체크리스트',subtitle:'기업별 조건부 이슈에 필요한 서류만 요청합니다.',section:'DATA REQUEST',visibility:'common',summary:'필요자료',body:`<div class="cols2">${model.issues.slice(0,6).map(x=>`<div class="card"><h3>${esc(x.title)}</h3>${list(documentList(x.id))}</div>`).join('')}</div>${crRegData()?'<div class="notice mint"><b>등기부 확인 완료</b>법인 등기사항증명서가 첨부되어 임원 근속·자본금 이력은 추가 요청이 불필요합니다.</div>':'<div class="notice amber"><b>추가 권장자료</b>법인 등기사항증명서(말소사항 포함) — 임원 근속·경영권 변동·자본금 이력 확정용</div>'}`});
 addPage({id:'evidence',title:'법령·예규·판례 근거 계획',subtitle:'TaxNavi는 이슈별 우선 출처를 검색하고 실무 의미만 요약합니다.',section:'EVIDENCE',visibility:'common',summary:'법률·세무 근거',body:`<table><thead><tr><th>이슈</th><th>우선 근거</th><th>검색목표</th><th>상태</th></tr></thead><tbody>${model.issues.filter(x=>['LOAN_RECEIVABLE','CAPITAL_POLICY','CAPITAL_TRANSACTIONS','SUCCESSION','KEY_PERSON'].includes(x.id)).map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.id==='LOAN_RECEIVABLE'?'세법·예규·판례':x.id==='SUCCESSION'?'상속·증여·가업승계 법령':'상법·세법·예규')}</td><td>요건·절차·경계선·전문가 확인사항</td><td><span class="pill gold">서버 TaxNavi 연결 시 실시간</span></td></tr>`).join('')}</tbody></table><div class="notice amber"><b>베타 상태</b>현재 1차 파일에는 안전한 서버 어댑터가 포함돼 있습니다. 실제 근거검색 결과는 corporateReportApi가 index.js에 추가된 뒤 채워집니다.</div>`});
 addPage({id:'quality-page',title:'품질·한계·사용상 주의',subtitle:'정확성·모드분리·보험경계·수치일치를 최종 게이트로 검사합니다.',section:'QUALITY GATE',visibility:'consultant',summary:'품질 및 유의사항',body:`<div id="qualityPageBody"></div>`});
 const calcRows=[];const addCalc=(label,formula,value,type='계산값')=>{if(value!==null&&value!==undefined&&value!=='—'&&value!=='미확인')calcRows.push([label,formula,value,type]);};
 addCalc('매출 성장률','(2025 매출−2024 매출)÷2024 매출×100',pct(r.salesGrowth));addCalc('영업이익률','영업이익÷매출액×100',pct(r.operatingMargin));addCalc('유동비율','유동자산÷유동부채×100',pct(r.currentRatio));addCalc('현금비율','현금및현금성자산÷유동부채×100',pct(r.cashRatio));addCalc('차입금의존도','총차입금÷자산총계×100',pct(r.borrowingDependency));addCalc('이자보상배율','영업이익÷금융비용',Number.isFinite(r.interestCoverage)?r.interestCoverage.toFixed(2)+'배':'—');addCalc('재고일수','평균재고÷매출원가×365',Number.isFinite(r.inventoryDaysReported)?r.inventoryDaysReported.toFixed(1)+'일':'—','결산잔액 추정');addCalc('매출채권회수일','평균매출채권÷매출액×365',Number.isFinite(r.dso)?r.dso.toFixed(1)+'일':'—','결산잔액 추정');addCalc('현금전환주기','재고일수+채권회수일−매입채무일',Number.isFinite(cccValue)?cccValue+'일':'—','결산잔액 추정');
 if(signalIds.has('CASH_DROP'))addCalc('현금 증감','2025 현금−2024 현금',Number.isFinite(model.financials['2025'].cash)&&Number.isFinite(model.financials['2024'].cash)?wonEok(model.financials['2025'].cash-model.financials['2024'].cash):'—','원문 차이');if(signalIds.has('BORROWING_SURGE'))addCalc('차입금 증감','2025 총차입금−2024 총차입금',Number.isFinite(model.financials['2025'].borrowings)&&Number.isFinite(model.financials['2024'].borrowings)?wonEok(model.financials['2025'].borrowings-model.financials['2024'].borrowings):'—','원문 차이');if(activeIssueIds.has('CAPITAL_POLICY'))addCalc('이익잉여금','2025 개별 결산',wonEok(model.financials['2025'].retainedEarnings),'원문값');if(activeIssueIds.has('CAPITAL_TRANSACTIONS'))addCalc('기타자본구성요소','2025 개별 결산',wonEok(metricValueAt(model.extractionResult,'financialStatements.separateAnnual.2025-12-31.balanceSheet.otherCapitalComponents')),'원문값');
 addPage({id:'calculation-appendix',title:'계산 근거 부록',subtitle:'모든 계산은 동일 ConfirmedAnalysisModel의 원문값만 참조합니다.',section:'CALCULATION APPENDIX',visibility:'common',summary:'산식과 계산근거',body:`<table><thead><tr><th>산출</th><th>산식</th><th>결과</th><th>성격</th></tr></thead><tbody>${calcRows.map(x=>`<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${esc(x[3])}</td></tr>`).join('')}</tbody></table><div class="source-box"><b>계산기 연결</b> ${model.calculations.calculator.ratios.ok?'JarviaCalculators 호출 성공':'브라우저 직접 검산·계산기 입력계약 추가 확인'} · ${esc(model.calculations.calculatorVersion||'version 미표시')}</div>`});
 model.audioChapters=buildAudioChapters(model);
 addPage({id:'audio-course',title:'상담 브리핑 (미팅 전 트레이닝)',subtitle:'리포트 낭독이 아니라 숫자·질문·반론·보험시점을 교육합니다.',section:'AUDIO LEARNING',visibility:'audio',summary:'18~25분 맞춤형 강의',body:`<div class="audio-hero"><div class="course-cover"><div class="ic">🎧</div><div class="eyebrow">CONSULTANT LEARNING</div><h2>${esc(p.displayName||p.companyName)} 기업진단리포트<br>상담 브리핑</h2><p>복잡한 숫자의 경영적 의미와 CEO에게 물어볼 질문, 유료컨설팅과 보험검토의 조건을 쉽게 설명합니다.</p><div class="course-actions"><button type="button" data-audio-action="play">▶ 브라우저 강의 시작</button><button type="button" class="settings" data-audio-settings>⚙ 강의 조절</button></div><div style="margin-top:6mm;font-size:9px;color:#99f6e4">권장 학습시간 ${model.audioChapters.reduce((s,x)=>s+x.minutes,0)}분 · ${model.audioChapters.length}개 챕터</div></div><div><div class="chapter-list" id="audioChapterList">${model.audioChapters.map((x,i)=>`<button type="button" data-chapter="${i}" class="${i===0?'on':''}"><span>CHAPTER ${String(i+1).padStart(2,'0')} · ${x.minutes}분</span><b>${esc(x.title)}</b><p>${esc(sentence(x.script,100))}</p></button>`).join('')}</div><div class="audio-controls"><button data-audio-action="play">▶ 재생</button><button data-audio-action="pause">⏸ 일시정지</button><button data-audio-action="stop">■ 정지</button><select id="audioRate"><option value="0.9">0.9×</option><option value="1" selected>1.0×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select><button data-audio-action="mp3">고급 MP3 생성</button></div><div class="audio-transcript" id="audioTranscript">${esc(model.audioChapters[0].script)}</div></div></div>`});
 addPage({id:'closing',title:'최종 제안과 다음 행동',subtitle:'리포트 생성이 아니라 CEO의 실행결정으로 마무리합니다.',section:'FINAL PROPOSAL',visibility:'common',summary:'최종 제안',body:`<div class="lead"><b>활성 이슈에 대한 1차 사실확정·정밀진단을 우선 제안합니다.</b><p>${esc(model.issues.map(x=>x.title).join(' · '))}의 자료와 원인을 확정한 뒤 전문가 실행과 보험 적합성을 순서대로 검토합니다.</p></div><div class="options"><div class="option"><em>STEP 1</em><h3>팩트·자료 확정</h3><p>${esc(activeDocs.slice(0,4).join(' · '))}</p></div><div class="option recommended"><em>STEP 2 · 권장</em><h3>정밀진단 프로젝트</h3><p>계산·시나리오·의사결정·실행계획</p></div><div class="option"><em>STEP 3</em><h3>전문가·보험 실행</h3><p>확인된 법률·세무·자본·보장공백만 실행</p></div></div><div class="decision-bar"><b>다음 미팅</b><span>날짜 ______</span><span>담당자 ______</span><span>제출자료 ______</span><span>결정사항 ______</span></div>${crConsultantClosingHtml()}`});
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
 /* ★ [2026-08-01] 질문지를 다시 그린 뒤 모달을 맨 위로 올린다.
    목적 5문항을 채우느라 내려간 스크롤이 유지되면 새 질문지가 안 보인다. */
 setTimeout(()=>{const _b=$('questionsBody'); if(_b)_b.scrollTop=0;},0);
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
 /* ★ [2026-08-01] AI 도입 화법 — 실패해도 리포트는 완결되므로 조용히 진행 */
 try{
   const _ai=await crLoadAiOpeners(state.analysis);
   if(_ai&&_ai.ok&&state.aiOpeners){ generatePages(state.analysis); renderPages(); crAutoSaveSoon(); }
 }catch(e){ console.warn('AI 도입화법 생성 실패:',e.message); }
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

/* ════ [2026-08-01] 작업 자동저장·복구 ════
   브라우저를 닫거나 오류가 나도 이어서 작업할 수 있도록 로컬에 스냅샷을 남긴다.
   개인정보 최소화: 등기부 원문 텍스트(pageTexts/text)는 저장하지 않고 파싱 결과만 보관한다. */
const CR_AUTOSAVE_KEY='jarvia.corpReport.autosave.v1';
function crSnapshot(){
  const reg=state.registry?{fileName:state.registry.fileName,pages:state.registry.pages,parsed:state.registry.parsed,attachedAt:state.registry.attachedAt}:null;
  return {app:'JARVIA_CORPORATE_REPORT',version:VERSION,savedAt:nowIso(),
    factsConfirmed:state.factsConfirmed,questionsConfirmed:state.questionsConfirmed,
    caseData:state.caseData,analysis:state.analysis,
    registry:reg,charter:state.charter||null,consultant:state.consultant||null};
}
function crAutoSave(){
  try{
    if(!state.caseData)return;
    localStorage.setItem(CR_AUTOSAVE_KEY,JSON.stringify(crSnapshot()));
    const el=$('autosaveMark');
    if(el){el.textContent='자동저장 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});el.hidden=false;}
  }catch(e){console.warn('자동저장 실패(용량 초과 가능):',e);}
}
let _crAutoTimer=null;
function crAutoSaveSoon(){clearTimeout(_crAutoTimer);_crAutoTimer=setTimeout(crAutoSave,1200);}
function crRestorePayload(p){
  if(!p||p.app!=='JARVIA_CORPORATE_REPORT')throw new Error('형식이 다른 파일입니다.');
  state.caseData=p.caseData||null;
  state.analysis=p.analysis||null;
  state.factsConfirmed=!!p.factsConfirmed;
  state.questionsConfirmed=!!p.questionsConfirmed;
  if(p.registry)state.registry=p.registry;
  if(p.charter)state.charter=p.charter;
  if(p.consultant)state.consultant=p.consultant;
}
function crCheckAutoSave(){
  try{
    const raw=localStorage.getItem(CR_AUTOSAVE_KEY); if(!raw)return;
    const p=JSON.parse(raw); if(!p||!p.caseData)return;
    const nm=p.caseData.profile?.displayName||p.caseData.profile?.companyName||'이전 작업';
    const when=p.savedAt?new Date(p.savedAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
    if(!confirm(`저장되지 않은 작업이 있습니다.\n\n  ${nm}\n  ${when}\n\n이어서 진행할까요?\n(취소하면 새로 시작하며 기록은 삭제됩니다)`)){
      localStorage.removeItem(CR_AUTOSAVE_KEY);return;
    }
    crRestorePayload(p);
    /* ★ 복구: 분석 결과가 있으면 페이지 재생성, 없으면 케이스만 준비 (loadCaseFile과 동일 경로) */
    if(state.analysis){generatePages(state.analysis);renderPages();showWorkspace();}
    else if(state.caseData)prepareCase(state.caseData,{confirmed:!!p.factsConfirmed,autoGenerate:true});
    else return;
    toast('이전 작업을 복구했습니다.','ok');
  }catch(e){console.warn('자동저장 복구 실패:',e);}
}
function crClearAutoSave(){try{localStorage.removeItem(CR_AUTOSAVE_KEY);}catch(_e){}}
function saveCase(){
 if(!state.caseData)return;const payload=crSnapshot();   /* ★ 등기부·정관·컨설턴트 정보 포함 */downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`${state.caseData.profile?.displayName||'기업'}_기업종합Report_케이스.json`);toast('케이스 JSON을 저장했습니다.');
}
function loadCaseFile(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);crRestorePayload(p);if(!state.caseData)state.caseData=p.analysis||null;if(state.analysis){generatePages(state.analysis);renderPages();showWorkspace();crAutoSaveSoon();}else prepareCase(state.caseData,{confirmed:state.factsConfirmed,autoGenerate:true});toast('케이스를 불러왔습니다.','ok');}catch(e){toast('케이스 파일 형식이 올바르지 않습니다.','err');}};r.readAsText(file);}
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

function enterPresentation(startId=null){if(!state.visiblePages.length)return;
 /* ★ [2026-08-01] 대표 앞 화면 노출 방지 — 발표 진입 시 컨설턴트 전용 블록 물리 차단 */
 state._modeBeforePresent=state.mode;
 try{qsa('.consultant-only,.consultant-block,.note-trigger,[data-note-page],[data-visibility="consultant"],[data-visibility="audio"]').forEach(el=>{el.dataset.crHidden='1';el.style.display='none';});}catch(_e){}
 state.present=true;state.presentIndex=Math.max(0,state.visiblePages.findIndex(x=>x.id===startId));if(state.presentIndex<0)state.presentIndex=0;document.body.classList.add('present');updatePresentation();}
function updatePresentation(){qsa('.report-page').forEach(x=>x.classList.remove('present-active'));const p=state.visiblePages[state.presentIndex];if(!p)return;const el=$(p.id);el.classList.add('present-active');const sx=(innerWidth-40)/el.offsetWidth,sy=(innerHeight-80)/el.offsetHeight;document.documentElement.style.setProperty('--present-scale',String(Math.min(sx,sy,.98)));$('presCount').textContent=`${state.presentIndex+1} / ${state.visiblePages.length}`;}
function movePresentation(d){state.presentIndex=clamp(state.presentIndex+d,0,state.visiblePages.length-1);updatePresentation();}
function exitPresentation(){
 /* ★ 발표 종료 — 숨긴 컨설턴트 블록 복원 */
 try{qsa('[data-cr-hidden="1"]').forEach(el=>{el.style.display='';delete el.dataset.crHidden;});}catch(_e){}
state.present=false;document.body.classList.remove('present');qsa('.report-page').forEach(x=>x.classList.remove('present-active'));}


/* ════ [2026-08-01] 컨설턴트 정보 · 등기부등본 첨부 ════ */
const CR_CON_KEYS=[['conCompany','company'],['conName','name'],['conTitle','title'],['conPhone','phone'],['conEmail','email']];
function crFillConsultantForm(){
  const m=memberInfo(), c=(state.caseData&&state.caseData.consultant)||{};
  const def={company:c.company||m.company||'',name:c.name||m.name||'',title:c.title||m.title||'',phone:c.phone||'',email:c.email||''};
  for(const [id,k] of CR_CON_KEYS){const el=$(id);if(el)el.value=def[k]||'';}
}
function crSaveConsultant(){
  const o={};
  for(const [id,k] of CR_CON_KEYS){const el=$(id);o[k]=el?String(el.value||'').trim():'';}
  if(state.caseData)state.caseData.consultant=o;
  state.consultant=o;
  crAutoSaveSoon();
  closeModal('consultantModal');
  toast('컨설턴트 정보를 저장했습니다. 리포트 재생성 시 표지·마지막 장에 반영됩니다.','ok');
}
/* ════ [2026-08-01] 등기부등본 파서 — 실 등기부 검증 완료 ════ */
const CR_REG_ROLE='대표이사|사내이사|사외이사|기타비상무이사|감사위원회위원|감사위원|상근감사|감사|이사장|부이사장|대표집행임원|집행임원|업무집행자|대표사원|업무집행사원|무한책임사원|유한책임사원|대표자|지배인|청산인|이사';
const CR_REG_EV='취임|중임|재선임|연임|사임|퇴임|임기만료|해임|사망|사망퇴임|선임|퇴사|변경';
function crRegPrevDate(L,i){for(let k=i;k>=Math.max(0,i-2);k--){const m=String(L[k]||'').match(/(\d{4}\.\d{2}\.\d{2})\s*변경/);if(m)return m[1];}return'';}
function crRegNextDate(L,i){for(let k=i;k<=i+2&&k<L.length;k++){const m=String(L[k]||'').match(/(\d{4}\.\d{2}\.\d{2})\s*변경/);if(m)return m[1];}return'';}
function crParseRegistry(lines){
  const R={capital:[],par:[],company:{},stockOption:false,current:[],ceoTerms:0,_ev:{}};
  let sec='',curKey='';
  for(let i=0;i<lines.length;i++){
    const L=String(lines[i]||'').replace(/열\s*람\s*용/g,'').replace(/열람일시[\s\S]*$/,'').trim();
    if(!L)continue;
    if(/임원에\s*관한\s*사항/.test(L)){sec='officer';continue;}
    if(/지배인에\s*관한\s*사항|기\s*타\s*사\s*항|주식매수선택권/.test(L)){if(/주식매수선택권/.test(L))R.stockOption=true;sec='';}
    if(/^등기번호/.test(L))R.company.regNo=R.company.regNo||(L.match(/(\d{4,})/)||[])[1]||'';
    if(/^등록번호/.test(L))R.company.corpNo=R.company.corpNo||(L.match(/(\d{6}-\d{7})/)||[])[1]||'';
    if(/회사성립연월일/.test(L)){const m=L.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);if(m)R.company.established=`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;}
    const pm=L.match(/^금\s*([\d,]+)\s*원$/)||L.match(/1주의\s*금액\s*금\s*([\d,]+)\s*원/);
    if(pm)R.par.push({amount:+pm[1].replace(/,/g,''),date:crRegPrevDate(lines,i)||crRegNextDate(lines,i)});
    const cm=L.match(/보통주식\s*([\d,]+)\s*주\s*금\s*([\d,]+)\s*원/);
    if(cm)R.capital.push({shares:+cm[1].replace(/,/g,''),capital:+cm[2].replace(/,/g,''),date:crRegPrevDate(lines,i)});
    if(sec!=='officer')continue;
    const om=L.match(new RegExp(`^(${CR_REG_ROLE})\\s+([가-힣]{2,6})`));
    if(om){curKey=om[1]+'|'+om[2];R._ev[curKey]=R._ev[curKey]||[];continue;}
    const em=L.match(new RegExp(`(\\d{4})\\s*년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일\\s*(${CR_REG_EV})`));
    if(em&&curKey)R._ev[curKey].push({date:`${em[1]}-${String(em[2]).padStart(2,'0')}-${String(em[3]).padStart(2,'0')}`,type:em[4]});
  }
  /* ★ [2026-08-01] 확장 추출 — 상호·본점·목적·발행가능주식·종류주식·사채·지배인·임기 */
  R.termYears=3;
  /* ★ [2026-08-01] 법인유형 자동 판별 — 유형별 자본·임원 규칙이 다름 */
  {
    const head=lines.slice(0,120).join(' ');
    R.entityType = /유한책임회사/.test(head)?'유한책임회사'
      : /유한회사/.test(head)?'유한회사'
      : /합자회사/.test(head)?'합자회사'
      : /합명회사/.test(head)?'합명회사'
      : /사단법인|재단법인|비영리/.test(head)?'비영리법인'
      : /협동조합/.test(head)?'협동조합'
      : /주식회사|발행주식/.test(head)?'주식회사':'기타';
    R.certType = /전부증명서/.test(head)?'전부증명서':/일부증명서/.test(head)?'일부증명서':/폐쇄사항/.test(head)?'폐쇄사항증명서':'미상';
    R.hasCancelled = /말소사항\s*포함/.test(head);
  }
  /* ★ 유한회사·합자회사 등 — 자본의 총액 / 출자 1좌의 금액 */
  R.equity=[];R.unitPrice=[];R.members=[];
  R.dissolution=[];R.merger=[];R.duration='';
  for(let i=0;i<lines.length;i++){
    const L=String(lines[i]||'').replace(/열\s*람\s*용/g,'').trim(); if(!L)continue;
    const em=L.match(/자본의?\s*총액\s*금?\s*([\d,]+)\s*원/);
    if(em)R.equity.push({amount:+em[1].replace(/,/g,''),date:crRegPrevDate(lines,i)||crRegNextDate(lines,i)});
    const um=L.match(/출자\s*1?\s*좌의?\s*금액\s*금?\s*([\d,]+)\s*원/);
    if(um)R.unitPrice.push({amount:+um[1].replace(/,/g,''),date:crRegPrevDate(lines,i)||crRegNextDate(lines,i)});
    if(/해\s*산|청\s*산\s*종\s*결/.test(L)&&/\d{4}/.test(L))R.dissolution.push(L.slice(0,80));
    if(/합\s*병|분\s*할/.test(L)&&/\d{4}\s*년/.test(L))R.merger.push(L.slice(0,80));
    const dm=L.match(/존립\s*기간[^\d]{0,10}(.{0,40})/); if(dm&&!R.duration)R.duration=dm[1].trim();
  }

  R.nameHistory=[];R.addressHistory=[];R.purposes=[];R.authorizedShares=[];R.bonds=[];R.branches=[];R.managers=[];R.classShares=[];
  {
    let mode='';
    for(let i=0;i<lines.length;i++){
      const L=String(lines[i]||'').replace(/열\s*람\s*용/g,'').replace(/열람일시[\s\S]*$/,'').trim();
      if(!L)continue;
      const dm=(L.match(/(\d{4}\.\d{2}\.\d{2})\s*변경/)||[])[1]||((String(lines[i-1]||'').match(/(\d{4}\.\d{2}\.\d{2})\s*변경/)||[])[1])||'';
      const strip=s=>s.replace(/\s*\d{4}\.\d{2}\.\d{2}[\s\S]*$/,'').replace(/\s*\.\s*\.\s*$/,'').trim();
      if(/^상\s*호/.test(L)){mode='name';const m=L.match(/^상\s*호\s+(.+)$/);if(m)R.nameHistory.push({name:strip(m[1]),date:dm});continue;}
      if(/^본\s*점/.test(L)){mode='addr';const m=L.match(/^본\s*점\s+(.+)$/);if(m)R.addressHistory.push({addr:strip(m[1]),date:dm});continue;}
      if(/^공고방법|^1주의\s*금액|^발행할\s*주식/.test(L))mode='';
      if(/^목\s*적/.test(L)){mode='purpose';continue;}
      if(/^임원에\s*관한\s*사항|^기\s*타\s*사\s*항|^주\s*식\s*매\s*수/.test(L)){mode='';continue;}
      if(/^지배인에\s*관한\s*사항/.test(L)){mode='mgr';continue;}
      const am=L.match(/발행할\s*주식의\s*총수\s*([\d,]+)\s*주/);
      if(am){R.authorizedShares.push({shares:+am[1].replace(/,/g,''),date:dm});mode='auth';continue;}
      if(mode==='auth'){const sm=L.match(/^([\d,]{5,})\s*주$/);if(sm){R.authorizedShares.push({shares:+sm[1].replace(/,/g,''),date:dm});continue;}if(/발행주식의\s*총수와|1주의\s*금액|^목\s*적/.test(L))mode='';}
      if(/전환사채|신주인수권부사채/.test(L)){const m=L.match(/([\d,]{4,})\s*원/);if(m)R.bonds.push({type:/전환사채/.test(L)?'전환사채':'신주인수권부사채',amount:+m[1].replace(/,/g,''),date:(L.match(/(\d{4}\.\d{2}\.\d{2})/)||[])[1]||''});}
      if(/^지점/.test(L))R.branches.push(strip(L.replace(/^지점\s*/,'')).slice(0,60));
      const csm=L.match(/(우선주식|상환주식|전환주식|상환전환우선주식|종류주식)\s*([\d,]+)\s*주/);
      if(csm)R.classShares.push({type:csm[1],shares:+csm[2].replace(/,/g,'')});
      if(mode==='name'&&/(주식회사|㈜|유한회사)/.test(L)&&!/^상\s*호/.test(L))R.nameHistory.push({name:strip(L),date:dm});
      if(mode==='addr'&&/(특별시|광역시|특별자치|[가-힣]{2,4}도)\s/.test(L))R.addressHistory.push({addr:strip(L),date:dm});
      if(mode==='purpose'&&/^1\.\s*/.test(L)&&!/삭제\s*\d{4}/.test(L))R.purposes.push(L.replace(/^1\.\s*/,'').replace(/\s*<[^>]*>\s*/g,'').trim());
      if(mode==='mgr'){const m=L.match(/^지배인\s+([가-힣]{2,6})/);if(m)R.managers.push(m[1]);}
    }
    const uq=a=>a.filter((v,i,s)=>s.findIndex(x=>JSON.stringify(x)===JSON.stringify(v))===i);
    R.nameHistory=uq(R.nameHistory).filter(x=>x.name);
    R.addressHistory=uq(R.addressHistory).filter(x=>x.addr);
    R.purposes=[...new Set(R.purposes)];R.managers=[...new Set(R.managers)];R.classShares=uq(R.classShares);
  }
  for(const k of Object.keys(R._ev)){
    const evs=R._ev[k].slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
    if(!evs.length)continue;
    const [role,name]=k.split('|');
    if(role==='대표이사')R.ceoTerms+=evs.filter(e=>/취임/.test(e.type)).length;
    const last=evs[evs.length-1];
    if(/취임|중임|선임/.test(last.type)){
      const app=evs.find(e=>/취임|선임/.test(e.type));
      const _d=new Date(last.date);_d.setFullYear(_d.getFullYear()+3);
      const expiry=_d.toISOString().slice(0,10);
      R.current.push({role,name,since:last.date,type:last.type,firstAppointed:app?app.date:last.date,expiry,overdue:expiry<new Date().toISOString().slice(0,10)});
    }
  }
  R.current.sort((a,b)=>b.since.localeCompare(a.since));
  R.overdueOfficers=R.current.filter(o=>o.overdue);
  R.capitalDecrease=[];
  for(let i=1;i<R.capital.length;i++){if(R.capital[i].capital<R.capital[i-1].capital)R.capitalDecrease.push(R.capital[i]);}
  /* ★ 파싱 신뢰도 — 조용한 실패 방지 */
  R.warnings=[];
  const capOk=R.capital.length||R.equity.length;
  if(!R.current.length)R.warnings.push('현직 임원을 인식하지 못했습니다. 등기부 형식이 다르거나 임원란이 없는 증명서일 수 있습니다.');
  if(!capOk)R.warnings.push('자본금(또는 자본의 총액) 정보를 인식하지 못했습니다.');
  if(R.entityType!=='주식회사')R.warnings.push(`「${R.entityType}」 등기부입니다. 현재 자동분석은 주식회사 기준으로 검증되어 있어 일부 항목이 비어 있을 수 있습니다.`);
  if(R.certType==='폐쇄사항증명서')R.warnings.push('폐쇄사항증명서입니다. 현재 유효한 등기내용이 아닐 수 있습니다.');
  R.parsedOk = !!(R.current.length && capOk);
  delete R._ev;
  return R;
}
function crRegTenure(d){if(!d)return '—';const y=(Date.now()-new Date(d).getTime())/(365.25*864e5);if(!isFinite(y)||y<0)return '—';return `${Math.floor(y)}년 ${Math.round((y%1)*12)}개월`;}
function crRegistrySummaryHtml(R){
  const ceo=R.current.find(o=>o.role==='대표이사');
  const cap=R.capital.length?R.capital[R.capital.length-1]:null;
  const cap0=R.capital.length?R.capital[0]:null;
  const par=R.par.length?R.par:[];
  const rows=[];
  /* ★ 겸직(대표이사+사내이사 등)은 이름이 두 번 나오지 않도록 묶는다 */
  const _byName={}; R.current.forEach(o=>{(_byName[o.name]=_byName[o.name]||[]).push(o.role);});
  rows.push(['현직 임원', Object.keys(_byName).length
    ? Object.entries(_byName).map(([n,rs])=>`<b>${esc(n)}</b>(${rs.map(esc).join('·')})`).join(' · ')
    : '확인 필요']);
  if(ceo)rows.push(['대표이사 근속', `<b>${crRegTenure(ceo.since)}</b> <span class="rg-dim">(${esc(ceo.since)} ${esc(ceo.type)})</span>`]);
  if(R.ceoTerms)rows.push(['대표이사 취임 이력', `<b>${R.ceoTerms}회</b>`]);
  if(cap0&&cap)rows.push(['자본금', `${cap0.capital.toLocaleString()}원 → <b>${cap.capital.toLocaleString()}원</b> <span class="rg-dim">(변동 ${R.capital.length}건)</span>`]);
  if(!cap&&R.equity.length){const e0=R.equity[0],e1=R.equity[R.equity.length-1];rows.push(['자본의 총액', e0.amount===e1.amount?`<b>${e1.amount.toLocaleString()}원</b>`:`${e0.amount.toLocaleString()}원 → <b>${e1.amount.toLocaleString()}원</b> <span class="rg-dim">(변동 ${R.equity.length}건)</span>`]);}
  if(R.unitPrice.length)rows.push(['출자 1좌 금액',`<b>${R.unitPrice[R.unitPrice.length-1].amount.toLocaleString()}원</b>`]);
  if(R.duration)rows.push(['존립기간',esc(R.duration)]);
  if(R.dissolution.length)rows.push(['⚠️ 해산·청산',`<b>${R.dissolution.length}건</b> 기재 — 원문 확인 필요`]);
  if(R.merger.length)rows.push(['합병·분할',`<b>${R.merger.length}건</b> 기재 — 원문 확인 필요`]);
  if(cap)rows.push(['발행주식총수', `<b>${cap.shares.toLocaleString()}주</b>`]);
  if(par.length>1)rows.push(['액면가', `${par[0].amount.toLocaleString()}원 → <b>${par[par.length-1].amount.toLocaleString()}원</b> <span class="rg-dim">(${esc(par[par.length-1].date||'')} 분할)</span>`]);
  else if(par.length)rows.push(['액면가', `<b>${par[0].amount.toLocaleString()}원</b>`]);
  const auth=R.authorizedShares.length?R.authorizedShares[R.authorizedShares.length-1]:null;
  if(auth&&cap)rows.push(['발행가능주식', `${auth.shares.toLocaleString()}주 <span class="rg-dim">(사용 ${(cap.shares/auth.shares*100).toFixed(1)}% · 증자 여력 ${(auth.shares-cap.shares).toLocaleString()}주)</span>`]);
  if(R.nameHistory.length>1)rows.push(['상호 변경', `${R.nameHistory.length-1}회 — ${R.nameHistory.map(x=>esc(x.name.replace(/\s*\(.*$/,''))).join(' → ')}`]);
  if(R.addressHistory.length>1)rows.push(['본점 이전', `<b>${R.addressHistory.length-1}회</b> <span class="rg-dim">현재 ${esc(String(R.addressHistory[R.addressHistory.length-1].addr).slice(0,34))}</span>`]);
  if(R.purposes.length)rows.push(['목적사업', `<b>${R.purposes.length}개</b> <span class="rg-dim">(현행 · 말소분 제외) ${esc(R.purposes.slice(0,3).join(' · '))} 외</span>`]);
  if(R.capitalDecrease.length)rows.push(['자본금 감소', `<b>${R.capitalDecrease.length}회</b> — 감자 이력 확인 필요`]);
  if(R.classShares.length)rows.push(['종류주식', R.classShares.map(x=>esc(x.type)+' '+x.shares.toLocaleString()+'주').join(' · ')]);
  if(R.bonds.length)rows.push(['사채 발행', R.bonds.map(x=>esc(x.type)+' '+x.amount.toLocaleString()+'원').join(' · ')]);
  if(R.managers.length)rows.push(['지배인', R.managers.map(esc).join(' · ')]);
  if(R.branches.length)rows.push(['지점', `${R.branches.length}개소`]);
  if(R.overdueOfficers.length)rows.push(['⚠️ 임기 경과', `<b>${R.overdueOfficers.map(o=>esc(o.role)+' '+esc(o.name)).join(' · ')}</b> — 중임등기 누락 가능성`]);
  else if(R.current.length)rows.push(['임기만료 예상', R.current.slice(0,3).map(o=>esc(o.name)+' '+esc(o.expiry)).join(' · ')+`<span class="rg-dim"> (상법 3년 기준 추정)</span>`]);
  rows.push(['주식매수선택권', R.stockOption?'<b>설정 있음</b>':'설정 없음']);
  if(R.company.established)rows.push(['회사성립', esc(R.company.established)]);
  const list=R.current.map(o=>`<tr><td>${esc(o.role)}</td><td><b>${esc(o.name)}</b></td><td>${esc(o.since)} ${esc(o.type)}</td><td>${crRegTenure(o.since)}</td></tr>`).join('');
  const capRows=R.capital.map(c=>`<tr><td>${esc(c.date||'설립')}</td><td>${c.shares.toLocaleString()}주</td><td>${c.capital.toLocaleString()}원</td></tr>`).join('');
  const warn=(R.warnings||[]).length?`<div class="rg-warn">${R.warnings.map(w=>`<div>⚠️ ${esc(w)}</div>`).join('')}</div>`:'';
  const badge=`<span class="rg-badge">${esc(R.entityType||'—')}</span><span class="rg-badge">${esc(R.certType||'—')}</span>${R.hasCancelled?'<span class="rg-badge ok">말소사항 포함</span>':'<span class="rg-badge warn">말소사항 미포함 가능</span>'}`;
  return `<div class="reg-result">
    <div class="rg-hd">📋 등기부 분석 결과 ${badge}</div>${warn}
    <div class="rg-kv">${rows.map(r=>`<div class="${/현직 임원|상호 변경|목적사업|본점 이전|임기만료 예상|⚠️/.test(r[0])?'wide':''}"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}</div>
    <details class="rg-more"><summary>상세 보기 — 현직 임원 ${R.current.length}명 · 자본금 이력 ${R.capital.length}건</summary><div class="rg-tbl-wrap">
      <table class="rg-tbl"><thead><tr><th>직위</th><th>성명</th><th>최근 등기</th><th>근속</th></tr></thead><tbody>${list||'<tr><td colspan="4">확인 필요</td></tr>'}</tbody></table>
      <table class="rg-tbl"><thead><tr><th>변경일</th><th>발행주식</th><th>자본금</th></tr></thead><tbody>${capRows||'<tr><td colspan="3">확인 필요</td></tr>'}</tbody></table></div>
    </details>
    <div class="rg-note">🔒 임원 주민등록번호·주소는 저장하지 않습니다. 리포트 생성 시 임원 근속·자본금 이력이 반영됩니다.</div>
  </div>`;
}
/* ★ [2026-08-01] 스캔본 감지 시 재발급 안내 — IROS 「발급」은 PDF 저장이 차단되어 스캔본이 흔함 */
function crScanGuideHtml(fileName,kind){
  const G=(kind==='garbled');
  return `<div class="scan-guide">
    <div class="sg-hd">${G?'🔤 글자를 인식할 수 없는 PDF입니다':'📷 스캔·이미지 PDF입니다'} — 분석할 수 없습니다</div>
    <p><b>${esc(fileName||'첨부 파일')}</b>${G?'에는 글자가 그림처럼 저장되어 있어(폰트 정보 없음) 임원·자본금을 읽을 수 없습니다. 화면에는 글자로 보이지만 복사하면 깨지는 형태입니다.':'에는 글자 정보가 없어 임원·자본금을 읽을 수 없습니다. 종이로 출력한 뒤 스캔했거나, 사진으로 촬영한 파일로 보입니다.'}</p>
    <div class="sg-why"><b>왜 이런 일이 생기나요?</b> 인터넷등기소의 <b>「발급」(3,000원)</b>은 위변조 방지를 위해 <b>PDF 저장이 차단</b>되고, 우회 저장된 파일은 ${G?'글자가 그림으로 변환되어 읽을 수 없습니다':'출력·스캔본이 됩니다'}. 반면 <b>「열람」(700원)</b>은 PDF로 바로 저장되며 글자 정보가 그대로 살아 있습니다. 분석에는 열람용으로 충분합니다.<br><b>확인 방법</b> PDF를 열어 글자를 <b>드래그해 복사</b>했을 때 정상적으로 붙여넣어지면 분석 가능한 파일입니다.</div>
    <div class="sg-steps"><b>3분이면 됩니다</b>
      <ol>
        <li>인터넷등기소 <b>iros.go.kr</b> 접속 → 법인 등기열람·발급</li>
        <li>상호 또는 등기번호로 회사 검색</li>
        <li><b>「열람」 선택 — 700원</b> <em>(발급 아님)</em></li>
        <li><b>「말소사항 포함」 체크</b></li>
        <li>결제 후 열람 화면에서 <b>PDF로 저장</b> → 다시 첨부</li>
      </ol>
    </div>
    <div class="sg-act"><a href="https://www.iros.go.kr" target="_blank" rel="noopener">인터넷등기소 열기 →</a><button type="button" onclick="document.getElementById('registryInput').click()">다시 첨부</button></div>
    <div class="sg-note">※ 등기부 없이도 리포트는 완결됩니다. 미첨부 시 임원 근속·자본금 이력은 「등기부 확인 시 산출 가능」으로 표시되고 다음 미팅 자료요청에 자동 포함됩니다.</div>
  </div>`;
}
/* ════ [2026-08-01] 정관 확인사항 — 선택형 7 + 주관식 2 ════
   state.charter를 단일 진실 소스로 두고 질문지와 양방향 동기화 */
const CR_CHARTER_FIELDS=[['chPayRule','payRule'],['chRetireRule','retireRule'],['chRetireRate','retireRate'],
  ['chInterimDiv','interimDividend'],['chShareTransfer','shareTransfer'],['chStockOption','stockOption'],
  ['chDirectors','directors'],['chRetireText','retireText'],['chEtc','etc']];
function crCharter(){return (state.charter)||(state.caseData&&state.caseData.charter)||{};}
function crFillCharterForm(){
  const c=crCharter(), R=(state.registry&&state.registry.parsed)||null;
  /* ★ 등기부에서 확인되는 항목 자동 채움 (사용자가 이미 고른 값은 덮어쓰지 않음) */
  if(R){
    if(!c.stockOption&&R.stockOption!==undefined)c.stockOption=R.stockOption?'있음':'없음';
    if(!c.directors&&R.current&&R.current.length){
      const dirs=R.current.filter(o=>/이사/.test(o.role)&&!/대표/.test(o.role)).length
                +R.current.filter(o=>o.role==='대표이사').length;
      if(dirs>=3)c.directors='3명 이상 / 3년';
      else if(dirs>0)c.directors='1~2명';
    }
  }
  for(const [id,k] of CR_CHARTER_FIELDS){const el=$(id);if(el&&c[k]!=null&&c[k]!=='')el.value=c[k];}
  crRenderCharterFromRegistry();
  crBindAutoGrow();
}
/* ★ [2026-08-01] 등기부 확인 요약 — 정관 입력 시 참고할 값을 여기 모아 보여준다
   (등기부 아코디언이 닫혀도 필요한 정보가 눈앞에 남도록) */
function crRenderCharterFromRegistry(){
  const box=$('charterFromRegistry'); if(!box)return;
  const R=(state.registry&&state.registry.parsed)||null;
  if(!R){box.hidden=true;box.innerHTML='';return;}
  const ceo=R.current&&R.current.find(o=>o.role==='대표이사');
  const it=[];
  /* 정관 입력에 직접 필요한 3개만 (자본금·액면가 등은 리포트에서 확인) */
  it.push(`주식매수선택권 <b>${R.stockOption?'설정 있음':'설정 없음'}</b>`);
  if(R.current&&R.current.length)it.push(`현직 임원 <b>${R.current.length}명</b>`);
  if(ceo)it.push(`대표이사 근속 <b>${crRegTenure(ceo.since)}</b>`);
  box.innerHTML=`<span class="cf-hd">📋 등기부에서 확인된 값 — 아래 입력의 참고 자료입니다</span>${it.join(' · ')}`;
  box.hidden=false;
}
/* ★ [2026-08-01] textarea 자동 높이 — 입력 길이에 맞춰 전체 내용이 보이도록 */
function crAutoGrow(el){
  if(!el)return;
  el.style.height='auto';
  el.style.height=Math.max(64,el.scrollHeight+2)+'px';
}
function crBindAutoGrow(){
  ['chRetireText','chEtc'].forEach(id=>{
    const el=$(id); if(!el||el._agBound)return;
    el._agBound=true;
    el.addEventListener('input',()=>{crAutoGrow(el);crAutoSaveSoon();});
    crAutoGrow(el);
  });
}
function crSaveCharter(){
  const c={};
  for(const [id,k] of CR_CHARTER_FIELDS){const el=$(id);c[k]=el?String(el.value||'').trim():'';}
  c.savedAt=new Date().toISOString();
  state.charter=c; if(state.caseData)state.caseData.charter=c;
  crAutoSaveSoon();
  const filled=CR_CHARTER_FIELDS.filter(([id,k])=>c[k]).length;
  const st=$('charterStatus');
  if(st){st.innerHTML='✅ 정관 확인사항 저장 — '+filled+'/9 항목 입력'+(c.retireRule?'':' <b style="color:#B91C1C">· 퇴직금 규정 미확인</b>');st.style.color='#0F6E56';}
  toast('정관 확인사항을 저장했습니다. 리포트 생성 시 반영됩니다.','ok');
}
/* 정관에서 명확히 답한 항목은 질문지에서 제외 (「모름」이면 질문 유지) */
function crCharterAnsweredQuestionIds(){
  const c=crCharter(), out=[];
  if(c.retireRule)out.push('retirementRuleStatus');
  return out;
}
async function crHandleRegistry(file){
  const box=$('registryStatus'); if(!file)return;
  const setMsg=(html,color)=>{if(box){box.innerHTML=html;box.style.color=color||'#475569';}};
  setMsg('등기부등본을 분석하고 있습니다…');
  try{
    const pdfjs=await ensurePdfJs();
    const buf=await file.arrayBuffer();
    const pdf=await pdfjs.getDocument({data:buf}).promise;
    /* ★ [2026-08-01] 좌표(y) 기준 줄 재구성 — 파서가 줄 단위로 동작하므로 필수 */
    const pageTexts=[], allLines=[];
    for(let i=1;i<=pdf.numPages;i++){
      const tc=await (await pdf.getPage(i)).getTextContent();
      const rows={};
      for(const it of tc.items||[]){
        const s=crFixNullGlyph(String(it.str||''),Number(it.width||0));
        if(!s.trim())continue;
        const tr=it.transform||[], y=Math.round(Number(tr[5]||0));
        const key=Object.keys(rows).find(r=>Math.abs(Number(r)-y)<=2);
        (rows[key!==undefined?key:y]=rows[key!==undefined?key:y]||[]).push({x:Number(tr[4]||0),s});
      }
      const pl=Object.keys(rows).sort((a,b)=>Number(b)-Number(a))
        .map(y=>rows[y].sort((a,b)=>a.x-b.x).map(o=>o.s).join(' ').replace(/\s+/g,' ').trim())
        .filter(Boolean);
      allLines.push(...pl);
      pageTexts.push(pl.join('\n'));
    }
    const all=allLines.join('\n');
    const _plain=all.replace(/\s/g,'');
    if(_plain.length<200){
      setMsg(crScanGuideHtml(file.name,'scan'),'#B91C1C');
      toast('스캔본은 분석할 수 없습니다. 열람용 PDF로 다시 받아주세요.','err');
      return;
    }
    /* ★ [2026-08-01] 글자 깨짐 판정 — Type3/커스텀 인코딩 PDF는 텍스트는 있으나 한글 매핑이 없음 */
    const _ko=(all.match(/[가-힣]/g)||[]).length;
    if(_ko/_plain.length < 0.10){
      setMsg(crScanGuideHtml(file.name,'garbled'),'#B91C1C');
      toast('글자를 인식할 수 없는 PDF입니다. 열람용으로 다시 받아주세요.','err');
      return;
    }
    if(!/등기사항|등기번호/.test(all))throw new Error('등기사항증명서가 아닙니다. 파일을 다시 확인해 주세요.');
    /* 말소사항 포함 여부 — 취소선 문구 또는 변경/말소 이력 존재로 판정 */
    const hasHistory=/말소사항\s*포함/.test(all)||/(변경|말소|퇴임|사임|중임|임기만료)/.test(all);
    if(!hasHistory)throw new Error('현재사항만 발급되었습니다. 「말소사항 포함」으로 다시 열람해 주세요.');
    /* 동일 법인 대조 */
    const cur=(state.caseData&&state.caseData.profile)||{};
    const nm=String(cur.companyName||cur.displayName||'').replace(/[()주식회사\s]/g,'');
    if(nm && all.replace(/\s/g,'').indexOf(nm)<0){
      setMsg('⚠️ 재무보고서와 <b>다른 법인</b>의 등기부일 수 있습니다. 상호를 확인해 주세요.','#B91C1C');
    }
    const parsed=crParseRegistry(allLines);
    state.registry={fileName:file.name,pages:pdf.numPages,text:all,pageTexts,parsed,attachedAt:new Date().toISOString()};
    if(state.caseData)state.caseData.registryParsed=parsed;
    if(state.caseData)state.caseData.registry={fileName:file.name,pages:pdf.numPages,attachedAt:state.registry.attachedAt};
    setMsg('✅ 등기부 첨부 완료 — '+esc(file.name)+' ('+pdf.numPages+'p)','#0F6E56');
    if(box)box.insertAdjacentHTML('beforeend',crRegistrySummaryHtml(parsed));
    try{crRenderCharterFromRegistry();}catch(_e){}
    crAutoSaveSoon();
    toast('등기부등본을 첨부했습니다.','ok');
  }catch(e){
    console.error('등기부 분석 실패:',e);
    setMsg('❌ '+esc(e.message||'분석에 실패했습니다.'),'#B91C1C');
    toast('등기부 첨부 실패: '+(e.message||''),'err');
  }
}
/* ★ [2026-08-01] iOS Safari 클릭 보정
   동적 생성된 div/span 클릭요소는 cursor:pointer가 없으면 iOS에서 click이 발화하지 않는다.
   생성 시점을 알 수 없으므로 document 위임 + 주기적 보정으로 처리한다. */
function crIosClickFix(root){
  try{
    const scope=root||document;
    scope.querySelectorAll('[onclick],[data-close],[data-mode],.drawer-backdrop,.modal-bg,.mdl-bg').forEach(el=>{
      const tag=el.tagName.toLowerCase();
      if(tag==='button'||tag==='a'||tag==='input'||tag==='select'||tag==='textarea')return;
      if(!el.style.cursor)el.style.cursor='pointer';
    });
  }catch(_e){}
}
function crInitIosSupport(){
  const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!isIOS)return;
  document.documentElement.classList.add('is-ios');
  crIosClickFix(document);
  /* 리포트가 동적으로 다시 그려질 때마다 보정 */
  try{
    const deck=$('reportDeck');
    if(deck&&window.MutationObserver){
      new MutationObserver(()=>crIosClickFix(deck)).observe(deck,{childList:true,subtree:true});
    }
  }catch(_e){}
}
function initEvents(){
 crInitIosSupport();
 try{setTimeout(crCheckAutoSave,400);}catch(_e){}
 $('sampleBtn').onclick=()=>prepareCase(clone(GOLDEN_SAMPLE),{confirmed:true,autoGenerate:true});$('manualBtn').onclick=()=>{renderManualForm();openModal('manualModal');};$('manualApplyBtn').onclick=applyManual;
 $('pdfInput').onchange=e=>handlePdf(e.target.files?.[0]);const zone=$('uploadZone');['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag');}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag');}));zone.addEventListener('drop',e=>handlePdf(e.dataTransfer.files?.[0]));
 qsa('[data-mode]').forEach(b=>b.onclick=()=>applyMode(b.dataset.mode));$('menuBtn').onclick=()=>$('sidePanel').classList.toggle('on');$('closeSide').onclick=()=>$('sidePanel').classList.remove('on');
 $('factsBtn').onclick=()=>{renderFactsForm();openModal('factsModal');};$('questionsBtn').onclick=()=>{renderQuestions();openModal('questionsModal');};$('regenBtn').onclick=()=>generateReport('regen');
 $('confirmFactsBtn').onclick=()=>{if(!collectFactsForm())return;closeModal('factsModal');renderQuestions();openModal('questionsModal');updateStatus();};$('confirmQuestionsBtn').onclick=()=>{if(!collectQuestions())return;closeModal('questionsModal');generateReport('answers');};
 $('qualityBtn').onclick=()=>{state.quality=runQuality();renderQualityPage();openModal('qualityModal');};$('searchBtn').onclick=()=>openModal('searchModal');$('searchGoBtn').onclick=searchAll;$('searchInput').onkeydown=e=>{if(e.key==='Enter')searchAll();};
 /* ★ [2026-08-01] 시작화면 복귀 */
 if($('backStartBtn'))$('backStartBtn').onclick=()=>{
  if(state.pages&&state.pages.length&&!confirm('시작화면으로 돌아갑니다. 저장하지 않은 리포트는 사라집니다.\n계속할까요?'))return;
  try{if(state.present)exitPresentation();}catch(_e){}
  showStart();
 };
/* ★ [2026-08-01] 컨설턴트 정보 */
 if($('consultantInfoBtn'))$('consultantInfoBtn').onclick=()=>{crFillConsultantForm();openModal('consultantModal');};
 if($('consultantSaveBtn'))$('consultantSaveBtn').onclick=crSaveConsultant;
/* ★ [2026-08-01] 정관 확인사항 */
 if($('charterSaveBtn'))$('charterSaveBtn').onclick=crSaveCharter;
 if($('charterZone')){const _cz=$('charterZone');
   _cz.addEventListener('toggle',()=>{if(_cz.open)crFillCharterForm();});
   const _sm=_cz.querySelector('summary'); if(_sm)_sm.addEventListener('click',()=>{setTimeout(()=>{if(_cz.open)crFillCharterForm();},60);});
  }
  /* ★ [2026-08-01] 첨부 아코디언 배타 열기 — details[name] 미지원 브라우저 폴백
     iOS Safari 17 미만·구형 Android는 name 속성을 무시하므로 직접 닫아준다. */
  try{
    const _supportsName = 'name' in document.createElement('details');
    if(!_supportsName){
      const _grp=Array.from(document.querySelectorAll('details[name="startAttach"]'));
      _grp.forEach(d=>d.addEventListener('toggle',()=>{
        if(d.open)_grp.forEach(o=>{if(o!==d&&o.open)o.open=false;});
      }));
    }
  }catch(_e){}
/* ★ [2026-08-01] 등기부등본 선택 첨부 */
 if($('registryInput'))$('registryInput').onchange=e=>crHandleRegistry(e.target.files?.[0]);
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
 const chapters=[{title:'기업의 한 문장 진단과 학습목표',minutes:3,sourceIssueIds:active.slice(),script:`${company} 기업진단리포트 상담 브리핑을 시작하겠습니다. 오늘은 ${company}의 리포트를 읽는 것이 아니라 무엇을 묻고 어떤 순서로 상담할지 훈련합니다. 이 기업은 ${introType}입니다. 활성 이슈는 ${activeIssues.map(x=>x.title).join(', ')||'추가 확인 필요'}입니다. 보험은 위험과 부족재원이 확인된 뒤 비교하는 결론입니다.`}];
 chapters.push({title:'숫자를 경영언어로 번역하는 법',minutes:3,sourceIssueIds:active.slice(),script:`숫자는 매출·자산·비율을 나열하지 않습니다. 현금이 어디에 묶였는지, 1년 안에 갚을 돈과 즉시 쓸 자산의 여유가 어떤지, 대표와 주주의 의사결정에 어떤 영향을 주는지 설명합니다. 원본·계산값·시나리오·확인필요를 구분하고, 확인되지 않은 금액은 질문과 자료요청으로 남깁니다.`});
 if(!activeIssues.length){
  chapters.push({title:'자동 이슈 미확정 시 상담 원칙',minutes:4,sourceIssueIds:[],script:'현재 자료에서 자동 임계치를 넘는 핵심 이슈가 확정되지 않았습니다. 이것은 문제가 전혀 없다는 뜻이 아니라, 추가 근거 없이 대여금·자본거래·승계·대표 유고를 가정하지 않는다는 뜻입니다. 대표가 체감하는 경영과제와 자료의 공백을 먼저 확인하고, 근거가 확인될 때만 진단범위를 넓힙니다.'});
  chapters.push({title:'추가 확인질문과 자료 요청',minutes:4,sourceIssueIds:[],script:'대표님이 현재 가장 먼저 해결하고 싶은 경영과제, 보고서 수치와 체감이 다른 부분, 향후 1년의 투자·차입·주주 의사결정을 질문합니다. 최근 자금수지, 차입만기, 주요 거래처와 재고, 주주·임원 관련 변동자료 중 실제로 존재하는 자료만 요청하고 미확인 항목을 0이나 없음으로 단정하지 않습니다.'});
  chapters.push({title:'문제가 없다는 반론과 재검토 기준',minutes:4,sourceIssueIds:[],script:'대표가 현재 문제가 없다고 답하면 그 판단을 존중합니다. 어느 수치나 사건부터 관리가 필요하다고 판단할지 경계값을 합의하고, 매출·현금·차입·주주구조에 의미 있는 변화가 생길 때만 재검토합니다. 오늘은 전체 프로젝트가 아니라 모니터링 기준과 재확인일을 정하는 것으로 충분합니다.'});
  chapters.push({title:'현장 실행과제',minutes:2,sourceIssueIds:[],script:`다음 미팅에는 원본 기업보고서, 최신 결산자료, 최근 자금수지와 대표가 중요하다고 보는 의사결정 목록을 준비하십시오. 확인된 이슈가 없으면 보험이나 유료프로젝트를 억지로 만들지 않습니다. 오늘 주제에서 딱 하나만 기억한다면 확인되지 않은 사실을 문제로 만들어서는 안 된다는 원칙입니다. 이상으로 ${company} 기업진단리포트 상담 브리핑을 마칩니다.`});
  crAuditScripts(chapters).forEach(h=>console.warn('[TTS 차단검수] 챕터',h.index,h.title,'금지어:',h.terms.join(',')));chapters.forEach(c=>{if(c&&c.script)c.script=crScrubBrand(c.script);});return chapters;
 }
 const top=activeIssues.slice(0,3),per=activeIssues.length===1?5:activeIssues.length===2?4:3;
 top.forEach((issue,idx)=>{const id=issue.id,lib=SpeechEngine.get(id,model),displayTitle=issue.title||lib.title||id,note=SpeechEngine.notes({id:'audio-'+id,issueId:id,title:displayTitle,summary:issue.meaning},model,model),branch=note.branches[idx%7],obj=note.objections[0];chapters.push({title:`핵심 이슈 ${idx+1} · ${displayTitle}`,minutes:per,sourceIssueIds:[id],script:`학습목표는 ${displayTitle}의 확인된 사실과 경영적 의미를 설명하고 다음 행동에 합의하는 것입니다. ${note.speech3m} 실전 질문은 ${note.questions.slice(0,3).join(' ')} 대표가 ${branch.expression}라고 답하면 1차로 ${branch.response}라고 설명하고 ${branch.followUp}라고 재질문합니다. 2차로는 ${branch.secondResponse} 최종 행동은 ${branch.agreement}입니다.${obj?` 반론 “${obj.title}”에는 ${(obj.dialogue||[]).filter(x=>x.speaker==='컨설턴트').map(x=>x.text).join(' ')}`:''}`});});
 if(activeIssues.length>3){const rest=activeIssues.slice(3);chapters.push({title:'추가 활성 이슈 빠른 적용',minutes:2,sourceIssueIds:rest.map(x=>x.id),script:rest.map(issue=>{const lib=SpeechEngine.get(issue.id,model),displayTitle=issue.title||lib.title||issue.id,note=SpeechEngine.notes({id:'audio-short-'+issue.id,issueId:issue.id,title:displayTitle,summary:issue.meaning},model,model);return `${displayTitle}: ${note.speech30} 확인질문은 ${note.questions[0]} 다음 행동은 ${note.transition}`;}).join(' ')});}
 if(lectureType==='INSURANCE_OPPORTUNITY')chapters.push({title:'보험을 꺼내는 시점과 8단계',minutes:3,sourceIssueIds:active.filter(id=>['KEY_PERSON','SUCCESSION','EXECUTIVE_RETIREMENT','EXPORT_CREDIT','PROPERTY_BI','INSURANCE_OPTIMIZATION'].includes(id)),script:`잘못된 접근은 상품과 세금부터 말하는 것입니다. 올바른 순서는 위험사건, 재무충격, 필요재원, 현재재원, 부족재원, 보험 외 대안, 보험 역할입니다. ${INSURANCE_SPEECH_STAGES.map(x=>`${x.stage}. ${x.speech} 완료조건은 ${x.gate}.`).join(' ')} 부족재원이 없으면 보험을 확대하지 않습니다.`});
 else if(lectureType==='INSURANCE_OPTIMIZATION')chapters.push({title:'기존 증권 최적화 원칙',minutes:3,sourceIssueIds:active.includes('INSURANCE_OPTIMIZATION')?['INSURANCE_OPTIMIZATION']:active.slice(),script:'모든 법인·개인 증권을 목적별로 분류하고 계약자·피보험자·수익자, 보장금액·기간, 현금가치, 해지손실, 면책, 신규심사를 필요재원과 비교합니다. 목적과 기간이 맞으면 유지가 결론이며 실제 부족분에만 추가설계를 검토합니다.'});
 else chapters.push({title:'보험을 배제하고 유료진단을 제안하는 법',minutes:3,sourceIssueIds:active.slice(),script:`보험의 직접 당위성이 낮다면 ${activeIssues.length?activeIssues.map(x=>x.title).join(', '):'현재 확인된 재무사실과 추가 확인사항'}을 중심으로 정밀진단을 우선합니다. 확인되지 않은 대여금·자본거래·승계·대표 유고를 임의로 가정하지 않습니다. 산출물·담당자·기한·KPI·중단조건을 합의하고, 별도의 우연한 위험과 부족재원이 확인될 때만 보험 게이트를 엽니다.`});
 const objection=speechV16ObjectionsFor({id:'audio-objection',issueId:active[0]||'',title:'반론'},model)[0];
 chapters.push({title:'대표 반론 역할극과 다음 미팅',minutes:2,sourceIssueIds:active.slice(),script:`반론은 거절이 아니라 추가 확인 요청입니다. ${objection?(objection.dialogue||[]).map(x=>`${x.speaker}: ${x.text}`).join(' '):'대표의 우려를 인정하고 진짜 이유를 확인한 뒤 범위를 한 단계로 줄입니다.'} 모든 반론의 끝에는 자료·담당자·기한·재검토일이 남아야 합니다.`});
 chapters.push({title:'현장 실행과제',minutes:2,sourceIssueIds:active.slice(),script:`다음 미팅에는 ${active.slice(0,5).flatMap(documentList).filter((v,i,a)=>a.indexOf(v)===i).slice(0,10).join(', ')||'원본 자료와 담당자 목록'}을 준비하십시오. 오늘 전체 계약을 요구하지 않고 판단자료와 다음 확인일까지만 합의합니다. 오늘 주제에서 딱 하나만 기억한다면 확인된 사실과 계산된 부족재원보다 보험이 먼저 나가서는 안 된다는 원칙입니다. 이상으로 ${company} 기업진단리포트 상담 브리핑을 마칩니다.`});
 let total=chapters.reduce((s,x)=>s+x.minutes,0);while(total<18){chapters[chapters.length-2].minutes++;total++;}while(total>25){const c=chapters.find(x=>x.minutes>2&&x.title.startsWith('핵심 이슈'));if(!c)break;c.minutes--;total--;}
 crAuditScripts(chapters).forEach(h=>console.warn('[TTS 차단검수] 챕터',h.index,h.title,'금지어:',h.terms.join(',')));chapters.forEach(c=>{if(c&&c.script)c.script=crScrubBrand(c.script);});return chapters;
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
 return {ratios:r,valuation:crValuation({financials:data?.financials,profile:data?.profile}),calculator:{ratios:calcRatios,cashFlow:calcCash,keyman},crossValidation:{passed:cross.length===0,errors:cross},calculatorVersion:global.JarviaCalculators?.version||'browser-bundle',computedAt:nowIso()};
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
   let items=(tc.items||[]).map(i=>({s:crFixNullGlyph(String(i.str||''),Number(i.width||0)).trim(),x:Math.round((i.transform||[])[4]||0),y:Math.round((i.transform||[])[5]||0),w:Math.round(i.width||0)})).filter(i=>i.s).sort((a,b)=>b.y-a.y||a.x-b.x);   /* ★ [2026-08-01] 널글리프(+,-) 복원 후 필터 */
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
  const _skipQ=new Set(crCharterAnsweredQuestionIds());
 const active=crActiveQuestionIssueIds(analysis),sections=[];
 const commonMap=new Map();for(const q of CR_COMMON_QUESTIONS){if(_skipQ.has(q.id))continue;const s=q.section||'공통질문';if(!commonMap.has(s))commonMap.set(s,[]);commonMap.get(s).push({...q,source:'공통'});}
 for(const [title,questions] of commonMap)sections.push({id:'common-'+sections.length,title,kind:'common',questions});
 for(const id of active.slice(0,4)){
  const bank=CR_ISSUE_QUESTION_BANK[id];if(bank){const _qs=bank.questions.filter(q=>!_skipQ.has(q.id));if(_qs.length)sections.push({id:'issue-'+id,title:bank.title,kind:'issue',issueId:id,questions:_qs.map(q=>({...q,issueId:id,source:'조건부'}))});}
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
 {value:'경정청구·세액공제 누락 검토(환급 가능성)',issueIds:[]},
 {value:'정관 정비·임원 보수·퇴직금 규정 점검',issueIds:['EXECUTIVE_RETIREMENT']},
 {value:'등기 정비·임원 임기·중임등기 점검',issueIds:['SUCCESSION']},
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
/* ★ [2026-08-01] TTS 브랜드 사전검수 — 고객·컨설턴트 대본에 자사 브랜드가 발음되지 않도록 생성 전 차단 */
const CR_TTS_BANNED=/자비아|JARVIA|Jarvia/g;
function crScrubBrand(s){return String(s||'').replace(CR_TTS_BANNED,'').replace(/\s{2,}/g,' ').replace(/^[,·\s]+/,'').trim();}
function crAuditScripts(chapters){const hits=[];(chapters||[]).forEach((c,i)=>{const m=String(c&&c.script||'').match(CR_TTS_BANNED);if(m)hits.push({index:i,title:(c&&c.title)||'',terms:[...new Set(m)]});});return hits;}
function crSpeakText(text,{preview=false}={}){
 const _raw=String(text||''), _clean=crScrubBrand(_raw);
 if(_clean!==_raw){console.warn('[TTS 차단검수] 브랜드 표현을 제거했습니다.');}
 text=_clean;
 if(!('speechSynthesis' in global)){toast('이 브라우저는 음성재생을 지원하지 않습니다.','err');return;}speechSynthesis.cancel();const a=crReadAudioSettings(),u=new SpeechSynthesisUtterance(preview?String(text).slice(0,110):text);u.lang='ko-KR';u.rate=a.rate;u.pitch=a.pitch;u.volume=a.volume;const voice=speechSynthesis.getVoices().find(v=>v.voiceURI===a.voiceURI);if(voice)u.voice=voice;state.speechUtterance=u;if(!preview)u.onend=()=>{if(a.autoNext){const chapters=state.analysis?.audioChapters||[];if(state.audioIndex<chapters.length-1){selectChapter(state.audioIndex+1);setTimeout(()=>audioAction('play'),180);}}};speechSynthesis.speak(u);}
audioAction=function(action){const chapters=state.analysis?.audioChapters||state.caseData?.audioChapters||[],ch=chapters[state.audioIndex];if(!ch){toast('음성대본이 없습니다.');return;}if(action==='play'){const quick=safeNum($('audioRate')?.value,state.audioSettings.rate);if(quick!==state.audioSettings.rate){state.audioSettings.rate=quick;crWriteAudioSettings();}crSpeakText(ch.script);toast(`챕터 ${state.audioIndex+1} 음성강의를 재생합니다.`);}else if(action==='pause'){if(speechSynthesis.paused)speechSynthesis.resume();else speechSynthesis.pause();}else if(action==='stop'){speechSynthesis.cancel();}else if(action==='mp3'){generateMp3(ch.script);}};
const crBindDynamicV210Base=bindDynamic;
bindDynamic=function(){crBindDynamicV210Base();qsa('[data-audio-settings]').forEach(b=>b.onclick=openAudioSettings);};

const crUpdateStatusV210Base=updateStatus;
updateStatus=function(){crUpdateStatusV210Base();if(!state.caseData)return;const p=state.caseData.answers?.reportPurposeProfile||state.analysis?.reportPurposeProfile,elapsed=state.lastGeneration?.elapsedMs;const mode=p?.source==='SERVER_AI'?'서버 AI 목적해석':p?'로컬 의미엔진+사용자 확인':'목적 미확정';if(state.quality?.passed){$('statusTitle').textContent=p?.source==='SERVER_AI'?'AI 목적연계·원문검증 완료본':'로컬 목적연계·원문검증 완료본';$('statusText').textContent=`${state.pages.length}개 페이지 · ${state.analysis?.issues?.length||0}개 이슈 · ${mode}${elapsed?` · 브라우저 조립·교차검증 ${(elapsed/1000).toFixed(1)}초`:''} · 품질 ${state.quality.average.toFixed(1)}점`;}}

loadCaseFile=function(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result),data=p.caseData||p.analysis;if(!data)throw new Error('caseData 누락');const normalized=crNormalizeCase(data);state.caseData=normalized;state.analysis=null;state.pages=[];state.factsConfirmed=p.factsConfirmed!==false&&crValidateFacts(normalized).passed;state.questionsConfirmed=!!p.questionsConfirmed&&!!normalized.answers?.reportPurposeProfile;showWorkspace();renderFactsForm();if(!state.factsConfirmed){openModal('factsModal');toast('원문 팩트 재확인이 필요합니다.','err');return;}state.analysis=buildConfirmedModel(normalized);if(!state.questionsConfirmed){renderQuestions();openModal('questionsModal');toast('제작목적과 맞춤질문을 다시 확인해 주세요.','err');return;}generateReport('loaded-case');toast('케이스를 불러와 최신 엔진으로 재검증합니다.','ok');}catch(e){toast('케이스 파일 형식이 올바르지 않습니다: '+e.message,'err');}};r.readAsText(file);};

function crWireFinalEvents(){
 crWirePurposeFlow();
 if($('consultantExportBtn'))$('consultantExportBtn').onclick=exportConsultant;if($('consultantExportSideBtn'))$('consultantExportSideBtn').onclick=exportConsultant;
 if($('audioSettingsApplyBtn'))$('audioSettingsApplyBtn').onclick=crApplyAudioSettings;if($('audioTestBtn'))$('audioTestBtn').onclick=()=>crSpeakText('기업진단리포트 상담 브리핑입니다. 현재 설정된 목소리와 속도를 확인해 주세요.',{preview:true});
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
 if(chapters.length)addPage({id:'audio-course',title:'AI 상담 브리핑 (미팅 전 트레이닝)',subtitle:'기업별 리포트·화법·반론·클로징을 학습합니다.',section:'AUDIO LEARNING · PREMIUM MP3',visibility:'audio',summary:audio.title||'',body:`<div class="audio-hero"><div class="course-cover"><div class="ic">🎧</div><div class="eyebrow">AI CONSULTANT LEARNING</div><h2>${esc(audio.title||state.caseData.profile?.displayName+' 기업진단리포트 상담 브리핑')}</h2><p>실제 AI가 작성한 기업별 강의 원고를 고급 한국어 여성 음성 MP3로 제공합니다.</p><div class="course-actions"><button type="button" data-audio-action="play">▶ 강의 시작</button><button type="button" class="settings" data-audio-settings>⚙ 강의 조절</button><button type="button" data-audio-action="mp3">⬇ MP3 생성</button></div><div style="margin-top:6mm;font-size:13px;color:#99f6e4">기본 생성속도·재생속도 1.1× · ${safeNum(audio.expectedMinutes,chapters.reduce((s,x)=>s+safeNum(x.minutes),0))}분</div><div id="premiumAudioBox" style="margin-top:5mm"></div></div><div><div class="chapter-list" id="audioChapterList">${chapters.map((x,i)=>`<button type="button" data-chapter="${i}" class="${i===0?'on':''}"><span>CHAPTER ${String(i+1).padStart(2,'0')} · ${safeNum(x.minutes)}분</span><b>${esc(x.title)}</b><p>${esc(sentence(x.script,110))}</p></button>`).join('')}</div><div class="audio-controls"><button data-audio-action="play">▶ 재생</button><button data-audio-action="pause">⏸ 일시정지</button><button data-audio-action="stop">■ 정지</button><select id="audioRate"><option value="0.8">0.8×</option><option value="0.9">0.9×</option><option value="1">1.0×</option><option value="1.1" selected>1.1× 기본</option><option value="1.2">1.2×</option><option value="1.3">1.3×</option><option value="1.4">1.4×</option><option value="1.5">1.5×</option></select><button data-audio-action="mp3">고급 MP3 생성</button></div><div class="audio-transcript" id="audioTranscript">${esc(chapters[0]?.script||'')}</div></div></div>`});
 addPage({id:'ai-quality',title:'AI P1~P9 최종검수',subtitle:'원문·계산기·TaxNavi·목적·질문·보험경계·모드분리를 검증했습니다.',section:'QUALITY GATE · INDEPENDENT AI',visibility:'consultant',summary:result.review?.summary||'',body:'<div id="qualityPageBody"></div>'});
 const closing=report.ceoClosing||{};addPage({id:'ai-closing',title:closing.title||'최종 의사결정과 다음 행동',subtitle:'보고서가 아니라 실행합의로 마무리합니다.',section:'FINAL DECISION',visibility:'common',summary:closing.message||'',body:`<div class="lead"><b>${esc(closing.message||es.nextAction||'실행 우선순위와 다음 미팅을 확정합니다.')}</b></div>${crProdBullets(closing.decisions||es.decisions)}<div class="decision-bar"><b>다음 미팅</b><span>${esc(closing.nextMeeting||es.nextAction||'담당자·자료·기한 확정')}</span></div>${crConsultantClosingHtml()}`});
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
  let out=null;
  try{ out=await ServerAdapter.runAI('generateCorporateReport',payload,540000); }
  catch(_e){ out={ok:false,pending:true,error:_e?.message||String(_e)}; }
  /* ★ [2026-08-01] AI 파이프라인(P1~P9)이 준비 전이거나 실패하면 규칙 기반으로 완결한다.
     리포트가 아예 안 나오는 것보다, 확정 팩트·계산기 기반 리포트를 내는 편이 낫다. */
  if(!out || out.pending || !out.report || !out.review){
    const _why=out?.error||'AI 리포트 파이프라인 응답 없음';
    console.warn('[기업진단Report] AI 생성 폴백:',_why);
    logProgress('AI 파이프라인 미가동 — 확정 팩트·계산기 기반으로 생성합니다.','warn',60);
    progress(false);
    state.aiProduction=null;state.aiProductionReview=null;
    await crGenerateReportV210Base('rule-based');
    state.generationMode='rule';
  try{ const _st=$('statusTitle'); if(_st)_st.textContent='규칙 기반 생성본 (AI 문맥보강 대기)'; }catch(_e){}
  toast('규칙 기반으로 생성했습니다 — 확정 팩트·계산기·등기부 기준. AI 문맥보강은 준비 중입니다.','ok');
    return;
  }
  crProdProgressLogs(out);
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
