/**
 * Netlify Edge Function: mypb-check                                  ★ 2026-11-04
 * 역할: 마이PB 재무검진 고객 링크(mypb.kr/mypb-check.html?k=번호)를 카톡 등이 미리보기로 읽을 때,
 *       그 링크로 보낸 검진 분야의 공유 그림(mypb/share_분야.png)으로 og:image 를 바꿔 준다.
 * · 미리보기 수집기(카톡 스크랩 등)에게만 바꿔 준다 — 실제 고객이 열 때는 아무것도 하지 않고 원본 그대로(지연 없음)
 * · 서버 함수 mypbMeta 는 읽기 전용(「열람」으로 기록하지 않음)이고 분야 이름만 돌려준다
 * · 조회가 실패하거나 늦으면(1.5초) 원본의 기본 그림(share_default.png) 그대로
 * 배포: netlify.toml [[edge_functions]] path="/mypb-check.html" function="mypb-check"
 */
const META_URL = "https://asia-northeast3-jarvia-platform.cloudfunctions.net/mypbMeta";
const IMG_BASE = "https://mypb.kr/mypb/share_";
const FIELDS = ["inheritance", "gift", "retirement", "pension", "coverage", "tax", "property", "family", "assets", "risk"];
const BOT_RE = /kakaotalk-scrap|kakaostory|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|linkedinbot|whatsapp|line\/|naver|yeti|daum|bot|crawler|spider|scrap|preview/i;

export default async function handler(request, context) {
  const url = new URL(request.url);
  const k = url.searchParams.get("k") || "";
  const ua = request.headers.get("user-agent") || "";
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(k) || !BOT_RE.test(ua)) return context.next();

  let field = "";
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
    if (res.ok) {
      const j = await res.json();
      const f = j && j.result && j.result.field;
      if (FIELDS.indexOf(f) >= 0) field = f;
    }
  } catch (_e) { /* 실패하면 기본 그림 */ }

  const response = await context.next();
  if (!field) return response;
  const html = await response.text();
  const updated = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${IMG_BASE}${field}.png">`);
  return new Response(updated, {
    status: response.status,
    headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-cache, no-store, must-revalidate" },
  });
}
