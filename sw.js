// ════════════════════════════════════════════
//  JARVIA FC 채널 — 최소 서비스워커 (2026-06)
//  목적: PWA 설치 기준 충족 (beforeinstallprompt 발생 조건)
//  동작: 캐시 없음 — 모든 요청은 네트워크 그대로 통과
// ════════════════════════════════════════════
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {}); // 설치 기준용 fetch 핸들러 (no-op)
