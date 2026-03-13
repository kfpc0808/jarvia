/**
 * Netlify Edge Function: client-daily
 * 역할: ?fc=xxx 파라미터로 fc_share_profiles Firestore 조회 후
 *       client-daily.html의 OG태그를 컨설턴트별로 동적 교체
 * 배포: netlify.toml [[edge_functions]] path="/client-daily.html"
 */

const FIREBASE_PROJECT = "kfpc-company-support-project";
const FIREBASE_API_KEY = "AIzaSyCf7CsUTgfIWY-RW_mvTJOhczDtk1xM9sA";
const DEFAULT_IMAGE    = "https://jarvia.co.kr/client_report_share_v2.png";
const DEFAULT_TITLE    = "오늘의 금융 브리핑";
const DEFAULT_DESC     = "매일 아침 전해드리는 금융 인사이트";
const BASE_URL         = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT + "/databases/(default)/documents";

export default async function handler(request, context) {
  const url   = new URL(request.url);
  const fcId  = url.searchParams.get("fc");

  // fc 파라미터 없으면 원본 파일 그대로 서빙
  if (!fcId) return context.next();

  let shareTitle = DEFAULT_TITLE;
  let shareDesc  = DEFAULT_DESC;
  let shareImage = DEFAULT_IMAGE;
  const shareUrl = "https://jarvia.co.kr/client-daily.html?fc=" + encodeURIComponent(fcId);

  try {
    // ① fc_share_profiles 컬렉션에서 공유 설정 조회
    const spRes = await fetch(
      BASE_URL + "/fc_share_profiles/" + encodeURIComponent(fcId) + "?key=" + FIREBASE_API_KEY
    );

    if (spRes.ok) {
      const spData = await spRes.json();
      const f = spData.fields || {};
      if (f.shareTitle?.stringValue)    shareTitle = f.shareTitle.stringValue;
      if (f.shareDesc?.stringValue)     shareDesc  = f.shareDesc.stringValue;
      if (f.shareImageUrl?.stringValue) shareImage = f.shareImageUrl.stringValue;
    } else {
      // ② 공유 설정 없으면 consultants 컬렉션에서 이름만 조회
      const cRes = await fetch(
        BASE_URL + "/consultants/" + encodeURIComponent(fcId) + "?key=" + FIREBASE_API_KEY
      );
      if (cRes.ok) {
        const cData = await cRes.json();
        const cf = cData.fields || {};
        const name    = cf.name?.stringValue    || "";
        const company = cf.company?.stringValue || "";
        const title   = cf.title?.stringValue   || "";
        if (name) shareTitle = [company, name, title].filter(Boolean).join(" ") + "의 금융 브리핑";
      }
    }
  } catch (_e) {
    // 오류 시 기본값 그대로 사용
  }

  // 원본 HTML 가져오기
  const response    = await context.next();
  const originalHtml = await response.text();

  // OG태그 교체 (id 속성 포함/미포함 모두 대응)
  const updated = originalHtml
    .replace(/<meta property="og:title"[^>]*>/,
      `<meta property="og:title" content="${esc(shareTitle)}">`)
    .replace(/<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${esc(shareDesc)}">`)
    .replace(/<meta property="og:image"[^>]*>/,
      `<meta property="og:image" content="${esc(shareImage)}">`)
    .replace(/<meta property="og:url"[^>]*>/,
      `<meta property="og:url" content="${esc(shareUrl)}">`);

  return new Response(updated, {
    status: 200,
    headers: {
      "content-type":  "text/html; charset=UTF-8",
      "cache-control": "no-cache, no-store, must-revalidate"
    }
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
