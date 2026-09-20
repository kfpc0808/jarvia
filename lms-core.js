/* ═══════════════════════════════════════════════════════════════
 *  JARVIA LMS — 진도 기록 공통 모듈  (lms-core.js)
 *  ★ [2026-09-20] 회원이 어느 강좌를 얼마나 들었는지 기록한다.
 *
 *  [원칙]
 *    · 10초 칸 단위로 "들은 곳"만 표시한다 — 같은 곳을 반복해 들어도 한 번만 센다.
 *    · 저장은 멈출 때(일시정지·탭이동·창닫기)와 2분마다. 재생 내내 쓰지 않는다.
 *    · 문서는 회원·월 단위 하나 — lms_progress/{uid}_{YYYYMM}
 *    · 이 파일은 기록만 한다. 화면을 건드리지 않는다.
 *
 *  [사용법]
 *    JvLms.init({ db, uid, meta });            // 페이지 1회
 *    JvLms.attach(audioEl, {
 *      courseId: 'daily_20260918',
 *      courseType: 'daily',
 *      courseTitle: '데일리리포트 · 9월 18일(금)자',
 *      trackId: 'sec-news',
 *      trackTitle: '금융·보험 뉴스 Top 3'
 *    });
 *    JvLms.resumeAt(courseId, trackId) -> 초  // 이어 듣기 위치
 *
 *  [의존]
 *    Firestore v9 모듈러 — init 시 { doc, getDoc, setDoc, serverTimestamp } 전달
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  var SLOT = 10;            // 칸 크기(초) — 들은 구간 판정 단위
  var SAVE_MS = 120000;     // 재생 중 주기 저장 (2분)
  var MIN_SAVE_GAP = 8000;  // 연속 저장 최소 간격 — 과도한 쓰기 방지
  var DONE_RATIO = 0.8;     // 이수 기준

  var S = {
    ready: false,
    db: null, uid: null, fs: null,
    meta: {},               // { branchId, teamId, name }
    ym: "",
    cache: null,            // 이번 달 문서 내용 (메모리 사본)
    dirty: false,
    lastSave: 0,
    saving: false,
    timer: null,
    bound: false,
  };

  function ymNow() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0");
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  }

  /* ── 들은 칸을 문자열로 보관한다 ────────────────────────────
     "0,1,2,5,6" 형태. 배열보다 문서가 작고 병합이 쉽다. */
  function slotsToSet(str) {
    var s = new Set();
    if (!str) return s;
    String(str).split(",").forEach(function (v) { if (v !== "") s.add(+v); });
    return s;
  }
  function setToSlots(set) {
    return Array.from(set).sort(function (a, b) { return a - b; }).join(",");
  }

  /* ── 진도 계산 ─────────────────────────────────────────── */
  function calcCourse(c) {
    if (!c || !c.tracks) return { playedSec: 0, ratio: 0 };
    var played = 0;
    Object.keys(c.tracks).forEach(function (k) {
      var t = c.tracks[k];
      played += slotsToSet(t.slots).size * SLOT;
    });
    var total = c.totalSec || 0;
    if (!total) {
      /* 강좌 전체 길이를 모르면 알고 있는 트랙 길이 합으로 대신한다 */
      Object.keys(c.tracks).forEach(function (k) { total += (c.tracks[k].dur || 0); });
    }
    var ratio = total > 0 ? Math.min(1, played / total) : 0;
    return { playedSec: Math.min(played, total || played), ratio: ratio, totalSec: total };
  }

  /* ── 문서 로드 ─────────────────────────────────────────── */
  async function load() {
    if (S.cache) return S.cache;
    var id = S.uid + "_" + S.ym;
    var base = { uid: S.uid, ym: S.ym, courses: {} };
    if (S.meta.branchId) base.branchId = S.meta.branchId;
    if (S.meta.teamId) base.teamId = S.meta.teamId;
    try {
      var snap = await S.fs.getDoc(S.fs.doc(S.db, "lms_progress", id));
      S.cache = snap.exists() ? Object.assign(base, snap.data()) : base;
      if (!S.cache.courses) S.cache.courses = {};
    } catch (e) {
      console.warn("[LMS] 진도 로드 실패", e);
      S.cache = base;
    }
    return S.cache;
  }

  /* ── 강좌 전체 길이 조회 (lms_courses) ─────────────────── */
  var courseMetaCache = {};
  async function courseTotal(courseId) {
    if (courseMetaCache[courseId] !== undefined) return courseMetaCache[courseId];
    try {
      var snap = await S.fs.getDoc(S.fs.doc(S.db, "lms_courses", courseId));
      courseMetaCache[courseId] = snap.exists() ? (snap.data().totalSec || 0) : 0;
    } catch (e) {
      courseMetaCache[courseId] = 0;
    }
    return courseMetaCache[courseId];
  }

  /* ── 저장 ──────────────────────────────────────────────── */
  async function save(force) {
    if (!S.ready || !S.dirty || S.saving) return;
    var now = Date.now();
    if (!force && now - S.lastSave < MIN_SAVE_GAP) return;

    S.saving = true;
    var payload = S.cache;
    try {
      /* 이수 여부를 저장 직전에 갱신한다 */
      Object.keys(payload.courses).forEach(function (cid) {
        var c = payload.courses[cid];
        var r = calcCourse(c);
        c.playedSec = r.playedSec;
        c.ratio = Math.round(r.ratio * 1000) / 1000;
        if (!c.completed && r.ratio >= DONE_RATIO) {
          c.completed = true;
          c.completedAt = todayKey();
        }
      });
      payload.updatedAt = S.fs.serverTimestamp();
      payload.lastAt = todayKey();
      await S.fs.setDoc(S.fs.doc(S.db, "lms_progress", S.uid + "_" + S.ym), payload, { merge: true });
      S.dirty = false;
      S.lastSave = Date.now();
    } catch (e) {
      console.warn("[LMS] 진도 저장 실패", e);
    } finally {
      S.saving = false;
    }
  }

  /* ── 창을 닫을 때를 대비한 전역 처리 ───────────────────── */
  function bindGlobal() {
    if (S.bound) return;
    S.bound = true;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") save(true);
    });
    window.addEventListener("pagehide", function () { save(true); });
    window.addEventListener("beforeunload", function () { save(true); });
  }

  /* ── 공개 API ──────────────────────────────────────────── */
  var Jv = {
    /* 페이지 1회 — Firestore 와 회원 정보를 넘긴다 */
    init: function (opt) {
      if (!opt || !opt.db || !opt.uid || !opt.fs) {
        console.warn("[LMS] init 인자 부족 — 기록하지 않습니다");
        return false;
      }
      S.db = opt.db; S.uid = opt.uid; S.fs = opt.fs;
      S.meta = opt.meta || {};
      S.ym = ymNow();
      S.ready = true;
      bindGlobal();
      return true;
    },

    /* 오디오/비디오 엘리먼트에 기록을 붙인다 */
    attach: function (el, info) {
      if (!S.ready || !el || !info || !info.courseId || !info.trackId) return;
      if (el.__jvLms) return;            // 중복 부착 방지
      el.__jvLms = true;

      var cid = info.courseId, tid = info.trackId;
      var slots = null;                  // Set — 이 트랙에서 들은 칸

      async function ensure() {
        var doc = await load();
        if (!doc.courses[cid]) {
          doc.courses[cid] = {
            courseId: cid,
            type: info.courseType || "",
            title: info.courseTitle || "",
            totalSec: await courseTotal(cid),
            tracks: {},
            completed: false,
          };
        }
        var c = doc.courses[cid];
        if (!c.title && info.courseTitle) c.title = info.courseTitle;
        if (!c.tracks[tid]) c.tracks[tid] = { title: info.trackTitle || "", slots: "", pos: 0, dur: 0 };
        slots = slotsToSet(c.tracks[tid].slots);
        return c;
      }

      function mark(sec) {
        if (!slots) return;
        var k = Math.floor(sec / SLOT);
        if (k < 0 || slots.has(k)) return;
        slots.add(k);
        S.dirty = true;
      }

      async function sync() {
        var doc = await load();
        var c = doc.courses[cid];
        if (!c) return;
        var t = c.tracks[tid];
        if (!t) return;
        t.slots = setToSlots(slots || new Set());
        t.pos = Math.floor(el.currentTime || 0);
        if (el.duration && isFinite(el.duration)) t.dur = Math.round(el.duration);
        /* 강좌 전체 길이를 아직 모르면 트랙 길이 합으로 채워둔다 */
        if (!c.totalSec) {
          var sum = 0;
          Object.keys(c.tracks).forEach(function (k) { sum += (c.tracks[k].dur || 0); });
          c.totalSec = sum;
        }
      }

      el.addEventListener("loadedmetadata", function () { ensure(); });

      el.addEventListener("timeupdate", function () {
        if (!slots) { ensure(); return; }
        mark(el.currentTime || 0);
      });

      el.addEventListener("play", function () {
        ensure();
        if (S.timer) clearInterval(S.timer);
        S.timer = setInterval(function () { sync().then(function () { save(false); }); }, SAVE_MS);
      });

      ["pause", "ended", "emptied"].forEach(function (ev) {
        el.addEventListener(ev, function () {
          if (S.timer) { clearInterval(S.timer); S.timer = null; }
          sync().then(function () { save(true); });
        });
      });

      ensure();
    },

    /* 이어 듣기 위치(초). 없으면 0 */
    resumeAt: async function (courseId, trackId) {
      if (!S.ready) return 0;
      try {
        var doc = await load();
        var c = doc.courses[courseId];
        if (!c || !c.tracks || !c.tracks[trackId]) return 0;
        var p = c.tracks[trackId].pos || 0;
        /* 끝까지 들은 트랙은 처음부터 */
        var d = c.tracks[trackId].dur || 0;
        if (d && p >= d - 5) return 0;
        return p;
      } catch (e) { return 0; }
    },

    /* 강좌 진도 요약 — 화면에서 쓸 수 있다 */
    progressOf: async function (courseId) {
      if (!S.ready) return null;
      var doc = await load();
      var c = doc.courses[courseId];
      if (!c) return null;
      var r = calcCourse(c);
      return {
        playedSec: r.playedSec,
        totalSec: r.totalSec,
        ratio: r.ratio,
        completed: !!c.completed,
        completedAt: c.completedAt || null,
      };
    },

    /* 즉시 저장 — 화면 전환 직전 등에 호출 */
    flush: function () { return save(true); },

    /* 외부 도메인 중계용 — lms-bridge.js 가 보낸 진도를 그대로 반영 */
    applyRemote: async function (payload) {
      if (!S.ready || !payload || !payload.courseId || !payload.trackId) return;
      var doc = await load();
      var cid = payload.courseId, tid = payload.trackId;
      if (!doc.courses[cid]) {
        doc.courses[cid] = {
          courseId: cid,
          type: payload.courseType || "",
          title: payload.courseTitle || "",
          totalSec: payload.courseTotalSec || await courseTotal(cid),
          tracks: {},
          completed: false,
        };
      }
      var c = doc.courses[cid];
      if (!c.tracks[tid]) c.tracks[tid] = { title: payload.trackTitle || "", slots: "", pos: 0, dur: 0 };
      var t = c.tracks[tid];
      /* 들은 칸은 합집합으로 — 다른 기기에서 들은 것을 덮어쓰지 않는다 */
      var merged = slotsToSet(t.slots);
      slotsToSet(payload.slots).forEach(function (v) { merged.add(v); });
      t.slots = setToSlots(merged);
      if (payload.pos !== undefined) t.pos = payload.pos | 0;
      if (payload.dur) t.dur = payload.dur | 0;
      if (!c.totalSec) {
        var sum = 0;
        Object.keys(c.tracks).forEach(function (k) { sum += (c.tracks[k].dur || 0); });
        c.totalSec = sum;
      }
      S.dirty = true;
      await save(true);
    },

    _debug: function () { return { ready: S.ready, ym: S.ym, cache: S.cache }; },
  };

  global.JvLms = Jv;
})(window);
