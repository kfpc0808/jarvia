/**
 * Netlify Edge Function: mypb-check                                  ★ 2026-11-04
 * 역할: 마이PB 재무검진 고객 링크(mypb.kr/mypb-check.html?k=번호)를 카톡 등이 미리보기로 읽을 때,
 *       회원이 「보내기」 화면에서 본 모습과 똑같은 미리보기가 나가도록 og 태그를 바꿔 준다.
 *   · 그림: 그 링크로 보낸 검진의 전용 그림 mypb/share_{검진}.png (검진 제목이 그대로 들어간 그림)
 *   · 제목: 「○○님께 · 성춘향 팀장이 보낸 1분 재무검진」 (마이페이지 「내 플랫폼」 이름·직함, 직함이 없으면 「○○○ 컨설턴트가」 · 이/가 자동)
 *   · 설명: 「{검진 제목} · 답하면 바로 결과가 나옵니다」
 * · 미리보기 수집기(카톡 스크랩 등)에게만 바꿔 준다 — 실제 고객이 열 때는 아무것도 하지 않고 원본 그대로(지연 없음)
 * · 서버 함수 mypbMeta 는 읽기 전용(「열람」으로 기록하지 않음)
 * · 조회가 실패하거나 늦으면(1.5초) 원본의 기본 그림·제목 그대로
 * 배포: netlify.toml [[edge_functions]] path="/mypb-check.html" function="mypb-check"
 * 검진을 새로 추가하면 TITLES 에 한 줄 넣고 mypb/share_{검진}.png 그림을 올린다 (없으면 분야 그림으로 나감)
 */
const META_URL = "https://asia-northeast3-jarvia-platform.cloudfunctions.net/mypbMeta";
const IMG_BASE = "https://mypb.kr/mypb/share_";
const TITLES = {"inheritance.1":"우리 가족 상속세, 생길까요? 얼마나 클까요?","inheritance.2":"상속세, 우리 가족은 현금으로 낼 수 있을까요?","inheritance.3":"재산 나눌 때, 우리 가족은 다툼 없을까요?","inheritance.4":"미리 준 재산, 상속 때 다시 계산됩니다","inheritance.5":"상속이 시작됐다면, 놓치면 안 되는 기한","gift.1":"자녀에게 세금 없이 줄 수 있는 돈, 얼마 남았을까요?","gift.2":"집을 물려줄 때, 증여세만 내면 끝일까요?","gift.3":"회사 지분, 언제 넘겨주는 게 유리할까요?","gift.4":"자녀가 서른이 될 때까지, 세금 없이 얼마나 줄 수 있을까요?","gift.5":"증여세, 받는 사람이 3개월 안에 낼 돈이 있나요?","retirement.1":"지금 준비로, 몇 살에 은퇴할 수 있을까요?","retirement.2":"은퇴 후 매달, 얼마가 모자랄까요?","retirement.3":"은퇴하고 국민연금 받기 전까지, 몇 년을 버텨야 할까요?","retirement.4":"지금 노후자금, 몇 살에 바닥날까요?","retirement.5":"한 사람이 아프면, 남은 배우자의 생활은 괜찮을까요?","pension.1":"내 국민연금, 생활비의 몇 %를 채워 줄까요?","pension.2":"퇴직금, 한꺼번에 받으면 세금을 더 낸다는 것 아세요?","pension.3":"매년 돌려받을 수 있는 세금, 다 받고 계신가요?","pension.4":"국민연금, 앞당길까 미룰까?","pension.5":"연금 받을 때, 세금과 건강보험료가 새로 생길까요?","coverage.1":"내 보험, 정작 필요할 때 보장될까요?","coverage.2":"앞으로 낼 보험료, 모두 합치면 얼마일까요?","coverage.3":"보험 해지, 하기 전에 꼭 확인할 5가지","coverage.4":"같은 보험금인데, 우리 집은 세금이 붙을까요?","coverage.5":"내가 없으면, 우리 가족은 몇 개월을 버틸 수 있을까요?","tax.1":"5월에 신고해야 할 소득, 빠짐없이 챙기고 계신가요?","tax.2":"이자·배당, 세금이 크게 달라지는 선까지 얼마 남았을까요?","tax.3":"팔기 전에, 세금이 0원인지 큰지부터 확인하세요","tax.4":"연말정산에서 놓치고 있는 공제, 몇 개나 될까요?","tax.5":"집을 갖고만 있어도, 10년이면 얼마가 나갈까요?","property.1":"집을 팔면, 실제로 손에 얼마가 남을까요?","property.2":"월세 받는 그 집, 비용 빼면 실제로 몇 % 남을까요?","family.1":"아이 대학 들어갈 때까지, 매달 얼마씩 모아야 할까요?","family.2":"자녀 결혼 때 도울 돈, 세금 없이 얼마까지 줄 수 있을까요?","family.3":"자녀 집 마련을 돕고 나면, 내 노후는 괜찮을까요?","family.4":"부모님 생활비, 앞으로 모두 합치면 얼마일까요?","family.5":"우리 가족 목표, 지금 속도로 제때 이룰 수 있을까요?","assets.1":"계산상 남아야 할 돈, 실제로 통장에 쌓이고 있나요?","assets.2":"지금 대출, 은퇴 전에 다 갚을 수 있을까요?","assets.3":"내일 수입이 끊기면, 우리 집은 몇 달을 버틸까요?","assets.4":"우리 집 자산, 필요할 때 바로 쓸 수 있는 돈은 몇 %일까요?","assets.5":"지금 속도로라면, 목표 금액은 언제 모일까요?","risk.1":"큰 병으로 1년을 쉬게 되면, 우리 집 돈은 버틸까요?","risk.2":"1년 동안 일을 못 하면, 얼마가 모자랄까요?","risk.3":"낸 병원비, 보험에서 다 돌려받고 계신가요?"};
const FIELDS = ["inheritance", "gift", "retirement", "pension", "coverage", "tax", "property", "family", "assets", "risk"];
const BOT_RE = /kakaotalk-scrap|kakaostory|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|linkedinbot|whatsapp|line\/|naver|yeti|daum|bot|crawler|spider|scrap|preview/i;

export default async function handler(request, context) {
  const url = new URL(request.url);
  const k = url.searchParams.get("k") || "";
  const ua = request.headers.get("user-agent") || "";
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(k) || !BOT_RE.test(ua)) return context.next();

  let meta = null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch(META_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { k } }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (res.ok) { const j = await res.json(); meta = j && j.result; }
  } catch (_e) { /* 실패하면 기본 그림·제목 */ }

  const response = await context.next();
  if (!meta || FIELDS.indexOf(meta.field) < 0) return response;
  const title = TITLES[meta.design] || "";
  const image = IMG_BASE + (title ? meta.design.replace(".", "-") : meta.field) + ".png";
  const who = (meta.c || "담당") + " " + (meta.t || "컨설턴트");
  const ogTitle = meta.n ? meta.n + "님께 · " + josa(who) + " 보낸 1분 재무검진" : "1분 재무검진";
  const ogDesc = (title ? title + " · " : "") + "답하면 바로 결과가 나옵니다";

  const html = await response.text();
  const updated = html
    .replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + esc(image) + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(ogTitle) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(ogDesc) + '">');
  return new Response(updated, {
    status: response.status,
    headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-cache, no-store, must-revalidate" },
  });
}

/** 받침 있으면 「이」, 없으면 「가」 (한글이 아니면 「이」) — 화면의 josa() 와 같은 규칙 */
function josa(w) { const c = w.charCodeAt(w.length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + "이"; return w + ((c - 0xAC00) % 28 ? "이" : "가"); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
