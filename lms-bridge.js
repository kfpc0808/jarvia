/* ═══════════════════════════════════════════════════════════════
 *  JARVIA LMS — 외부 도메인 중계  (lms-bridge.js)
 *  ★ [2026-09-21] Storage에 있는 생성물(데일리리포트·월간 영업리포트)은
 *    다른 도메인이라 Firestore에 직접 쓸 수 없다. 들은 구간만 모아
 *    부모 뷰어(dr-viewer.html · monthly-report.html)에 postMessage로 넘긴다.
 *    저장은 부모의 JvLms.applyRemote()가 한다.
 *
 *  [원칙]
 *    · 생성물 내부 구조에 의존하지 않는다 — 페이지 안의 모든 음성 재생을
 *      자동으로 감지하고, 재생 파일 주소로 강좌·트랙을 판별한다.
 *    · 판별 규칙과 이름표는 functions/lmsCollect.js 와 같다.
 *      목록에 없는 음성(5분 요약 등)은 기록하지 않는다.
 *    · 10초 칸 단위, 전송은 일시정지·종료·탭 숨김 때와 2분마다.
 *    · 부모 창이 없으면(직접 열람) 아무것도 하지 않는다.
 *
 *  [보내는 메시지]
 *    { type:'jvLmsProgress', payload:{ courseId, courseType, courseTitle,
 *      trackId, trackTitle, slots:'0,1,2', pos, dur } }
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.__jvLmsBridge) return;
  window.__jvLmsBridge = true;
  if (!window.parent || window.parent === window) return;

  var SLOT = 10;
  var SEND_MS = 120000;

  /* ── 이름표 (lmsCollect.js 와 동일) ────────────────────── */
  var DAILY = {
    "full": "풀버전",
    "sec-news": "금융·보험 뉴스 Top 3",
    "sec-hot": "Today Hot Issue",
    "sec-insurance": "보험정보",
    "sec-consult": "Consulting Focus",
    "sec-skill": "상담 Skill-Up Point",
    "sec-weekly-issue": "요일별 이슈"
  };
  var CD = { "cd-insight": "인사이트", "cd-sec2": "섹션 2", "cd-sec3": "섹션 3", "cd-sec4": "섹션 4", "cd-sec5": "섹션 5" };
  var MC = { "mc-guide": "가이드", "mc-blk01": "블록 1", "mc-blk02": "블록 2", "mc-blk03": "블록 3", "mc-blk04": "블록 4", "mc-recap": "리캡", "mc-tip": "팁" };

  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  function dateLabel(ymd) {
    var y = +ymd.slice(0, 4), m = +ymd.slice(4, 6), d = +ymd.slice(6, 8);
    return m + "월 " + d + "일(" + WD[new Date(y, m - 1, d).getDay()] + ")자";
  }

  /* ── 파일 주소 → 강좌·트랙 ─────────────────────────────── */
  var infoCache = {};
  function infoOf(src) {
    if (!src) return null;
    if (infoCache[src] !== undefined) return infoCache[src];
    var p;
    try { p = decodeURIComponent(src); } catch (_) { p = src; }
    var m, r = null;
    if ((m = p.match(/daily-reports\/(\d{8})_audio\.m4a/i))) {
      r = { courseId: "daily_" + m[1], courseType: "daily", courseTitle: "데일리리포트 · " + dateLabel(m[1]),
            trackId: "full", trackTitle: DAILY.full };
    } else if ((m = p.match(/tts\/(\d{8})\/([^\/?#]+)\.mp3/i))) {
      var d = m[1], base = m[2].split("_")[0];
      if (DAILY[base] && base !== "full") {
        r = { courseId: "daily_" + d, courseType: "daily", courseTitle: "데일리리포트 · " + dateLabel(d), trackId: base, trackTitle: DAILY[base] };
      } else if (CD[base]) {
        r = { courseId: "client_" + d, courseType: "client", courseTitle: "고객데일리리포트 · " + dateLabel(d), trackId: base, trackTitle: CD[base] };
      } else if (MC[base]) {
        r = { courseId: "consensus_" + d, courseType: "consensus", courseTitle: "모닝 컨센서스 · " + dateLabel(d), trackId: base, trackTitle: MC[base] };
      }
    } else if ((m = p.match(/monthly-reports\/(\d{6})\/audio\/(track\d+)\.(mp3|m4a)/i))) {
      var ym = m[1], tk = m[2].toLowerCase(), no = parseInt(tk.replace("track", ""), 10);
      r = { courseId: "monthly_" + ym, courseType: "monthly",
            courseTitle: "월간 영업리포트 · " + (+ym.slice(0, 4)) + "년 " + (+ym.slice(4, 6)) + "월호",
            trackId: tk, trackTitle: no === 0 ? "종합 대담" : "트랙 " + no };
    }
    infoCache[src] = r;
    return r;
  }

  /* ── 트랙별 누적 ──────────────────────────────────────── */
  var entries = {};   // courseId|trackId -> { info, slots:Set, pos, dur, dirty }

  function entryOf(info) {
    var k = info.courseId + "|" + info.trackId;
    if (!entries[k]) entries[k] = { info: info, slots: new Set(), pos: 0, dur: 0, dirty: false };
    return entries[k];
  }

  function flush() {
    Object.keys(entries).forEach(function (k) {
      var e = entries[k];
      if (!e.dirty) return;
      e.dirty = false;
      var i = e.info;
      try {
        window.parent.postMessage({
          type: "jvLmsProgress",
          payload: {
            courseId: i.courseId, courseType: i.courseType, courseTitle: i.courseTitle,
            trackId: i.trackId, trackTitle: i.trackTitle,
            slots: Array.from(e.slots).sort(function (a, b) { return a - b; }).join(","),
            pos: e.pos, dur: e.dur
          }
        }, "*");
      } catch (_) { e.dirty = true; }
    });
  }

  /* ── 음성 요소에 붙이기 ───────────────────────────────── */
  var timer = null;
  function hook(el) {
    if (!el || el.__jvLmsB) return;
    el.__jvLmsB = true;

    el.addEventListener("timeupdate", function () {
      var info = infoOf(el.currentSrc || el.src);
      if (!info) return;
      var e = entryOf(info);
      var t = el.currentTime || 0;
      var k = Math.floor(t / SLOT);
      if (k >= 0 && !e.slots.has(k)) { e.slots.add(k); e.dirty = true; }
      e.pos = Math.floor(t);
      if (el.duration && isFinite(el.duration)) e.dur = Math.round(el.duration);
    });
    ["pause", "ended", "emptied"].forEach(function (ev) { el.addEventListener(ev, flush); });

    if (!timer) timer = setInterval(flush, SEND_MS);
  }

  /* new Audio() 처럼 문서에 없는 요소는 play() 호출 시점에 붙인다 */
  try {
    var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (proto && proto.play && !proto.play.__jvLms) {
      var origPlay = proto.play;
      var wrapped = function () { try { hook(this); } catch (_) {} return origPlay.apply(this, arguments); };
      wrapped.__jvLms = true;
      proto.play = wrapped;
    }
  } catch (_) {}

  /* 문서 안 요소의 기본 컨트롤·자동재생 — play 이벤트를 캡처 단계에서 잡는다 */
  document.addEventListener("play", function (e) { hook(e.target); }, true);

  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);
})();
