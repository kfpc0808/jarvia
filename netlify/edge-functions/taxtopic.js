/**
 * Netlify Edge Function: taxtopic                                    ★ 2026-11-26
 * 역할: 세무예규·판례 영업주제 고객 링크(mypb.kr/topic.html?k=번호)를 카톡 등이 미리보기로 읽을 때,
 *       회원이 「고객에게 보내기」 화면에서 본 모습과 같은 미리보기가 나가도록 og 태그를 바꿔 준다.
 *   · 그림: 그 주제의 공유 그림 (/taxtopic/og_no000.jpg 또는 관리자 화면이 만든 Storage 그림, 회사·플랫폼 이름 없음)
 *   · 제목: 「○○님께 · 성춘향 팀장이 보낸 세무 점검 안내」 (마이페이지 「내 플랫폼」 이름·직함, 직함이 없으면 「컨설턴트」 · 이/가 자동)
 *   · 설명: 주제 제목(고객 화면 큰 글씨)
 * · 미리보기 수집기(카톡 스크랩 등)에게만 바꿔 준다 — 실제 고객이 열 때는 아무것도 하지 않고 원본 그대로(지연 없음)
 * · 서버 함수 ttMeta 는 읽기 전용(「열람」으로 기록하지 않음) · 3초까지만 기다리고 늦으면 원본(기본 그림·「세무 점검 안내」)
 * 배포: 이 파일을 netlify/edge-functions/taxtopic.js 로 두고 netlify.toml [[edge_functions]] path="/topic.html" function="taxtopic"
 */
const META_URL = "https://asia-northeast3-jarvia-platform.cloudfunctions.net/ttMeta";
const SITE = "https://mypb.kr";
const BOT_RE = /kakaotalk-scrap|kakaostory|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|linkedinbot|whatsapp|line\/|naver|yeti|daum|bot|crawler|spider|scrap|preview/i;

export default async function handler(request, context) {
  const url = new URL(request.url);
  const k = url.searchParams.get("k") || "";
  const ua = request.headers.get("user-agent") || "";
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(k) || !BOT_RE.test(ua)) return context.next();

  let meta = null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const res = await fetch(META_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { k } }),
      signal: ctl.signal,
    });
    if (res.ok) { const j = await res.json(); meta = j && j.result; }
    clearTimeout(timer);
  } catch (_e) { /* 실패하면 원본 그대로 */ }

  const response = await context.next();
  if (!meta || !meta.tid) return response;
  const who = (meta.c || "담당") + " " + (meta.t || "컨설턴트");
  const ogTitle = (meta.n ? meta.n + "님께 · " : "") + josa(who) + " 보낸 세무 점검 안내";
  const ogDesc = meta.title || meta.desc || "판례로 보는 1분 자가 점검";
  const im = String(meta.img || "");   /* 사이트 그림(/taxtopic/…) 또는 관리자 화면이 만든 Storage 그림 */
  const img = /^\/taxtopic\/[a-z0-9_-]+\.(jpg|png)$/.test(im) ? SITE + im
    : /^https:\/\/storage\.googleapis\.com\/jarvia-platform\.firebasestorage\.app\/taxtopic\/og_no\d{3,4}\.jpg(\?v=\d+)?$/.test(im) ? im : "";

  const html = await response.text();
  let updated = html
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(ogTitle) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(ogDesc) + '">');
  if (img) updated = updated.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + esc(img) + '">');
  return new Response(updated, {
    status: response.status,
    headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "no-cache, no-store, must-revalidate" },
  });
}

/** 받침 있으면 「이」, 없으면 「가」 (한글이 아니면 「이」) */
function josa(w) { const c = w.charCodeAt(w.length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + "이"; return w + ((c - 0xAC00) % 28 ? "이" : "가"); }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
