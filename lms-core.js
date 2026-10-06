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
  var CARRY_MONTHS = 24;    /* ★ [2026-10-01] 이전 달 기록을 이어받을 범위(개월) */
  var VIDEO_TRACK = "video"; /* ★ [2026-10-05] 해설 영상 트랙 — 음성과 따로 진도를 계산해 둘 중 높은 쪽으로 이수 판정 */

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
    playedBase: null,        /* ★ [2026-09-23] 일자별 학습시간 계산 기준값 */
    baseByCourse: null,      /* ★ [2026-09-23] 강좌별 기준값 — 일자·강좌별 학습시간용 */
    ensuring: {},            /* ★ [2026-10-01] 강좌 준비(생성·이어받기) 중복 실행 방지 */
    prevDocs: {},            /* ★ [2026-10-01] 이전 달 진도 문서 사본 */
    carryPending: {},        /* ★ [2026-10-01] 이어받았지만 아직 저장 안 된 몫(초) — 오늘 학습분에서 뺀다 */
    touched: {},             /* ★ [2026-10-01] 이 기기에서 재생한 트랙 — 이어 듣기 위치는 이 기기 값으로 */
    syncers: [],             /* ★ [2026-10-01] 저장 직전 모든 플레이어의 들은 칸을 반영 */
  };

  function ymNow() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0");
  }
  /* ★ [2026-10-01] YYYYMM 에서 n달 앞뒤 */
  function ymShift(ym, n) {
    var d = new Date(+String(ym).slice(0, 4), +String(ym).slice(4, 6) - 1 + n, 1);
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0");
  }
  function hourKey() { return String(new Date().getHours()); }
  function wdayKey() { return String(new Date().getDay()); }   /* 0=일 */
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
    var pv = 0, dv = 0, hasV = false;      /* ★ [2026-10-05] 해설 영상 트랙은 따로 센다 */
    Object.keys(c.tracks).forEach(function (k) {
      var t = c.tracks[k];
      var n = slotsToSet(t.slots).size * SLOT;
      if (t.dur > 0) n = Math.min(n, t.dur);   /* ★ [2026-10-01] 트랙 길이를 넘지 않게 */
      if (k === VIDEO_TRACK) { hasV = true; pv += n; dv += (t.dur || 0); return; }
      played += n;
    });
    var total = c.totalSec || 0;
    if (!total) {
      /* 강좌 전체 길이를 모르면 알고 있는 트랙 길이 합으로 대신한다 (해설 영상 제외) */
      Object.keys(c.tracks).forEach(function (k) { if (k !== VIDEO_TRACK) total += (c.tracks[k].dur || 0); });
    }
    var ratio = total > 0 ? Math.min(1, played / total) : 0;
    if (!hasV) return { playedSec: Math.min(played, total || played), ratio: ratio, totalSec: total,
                        ratioA: ratio, ratioV: 0, secA: total, secV: 0 };   /* ★ [2026-10-06] 매체별 진도·길이 (수료증 인정 기준용) */
    /* ★ [2026-10-05] 음성·영상 중 높은 진도로 이수 판정, 학습시간은 실제로 들은 시간 + 본 시간 */
    var rv = dv > 0 ? Math.min(1, pv / dv) : 0;
    var useV = rv > ratio;
    return {
      playedSec: Math.min(played, total || played) + Math.min(pv, dv || pv),
      ratio: Math.max(ratio, rv),
      totalSec: useV ? dv : total,          /* 이수한 쪽(음성 또는 영상)의 길이 */
      media: useV ? "video" : "audio",
      ratioA: ratio, ratioV: rv, secA: total, secV: dv,   /* ★ [2026-10-06] 매체별 진도·길이 (수료증 인정 기준용) */
    };
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
      /* 문서에 이미 쌓인 학습시간을 기준값으로 잡는다 — 이후 늘어난 만큼만 오늘 몫으로 센다 */
      if (S.playedBase === null) {
        var b0 = 0;
        S.baseByCourse = {};
        Object.keys(S.cache.courses).forEach(function (k) {
          var v = S.cache.courses[k].playedSec || 0;
          b0 += v; S.baseByCourse[k] = v;
        });
        S.playedBase = b0;
      }
    } catch (e) {
      console.warn("[LMS] 진도 로드 실패", e);
      S.cache = base;
    }
    return S.cache;
  }

  /* ── 강좌 전체 길이 조회 (lms_courses) ─────────────────── */
  var courseMetaCache = {};
  var courseMetaAt = {};    /* ★ [2026-10-01] 길이를 못 찾은 강좌는 10분 뒤 다시 조회 (등록 전에 들은 경우) */
  async function courseTotal(courseId) {
    if (courseMetaCache[courseId] > 0) return courseMetaCache[courseId];
    if (courseMetaCache[courseId] !== undefined && Date.now() - (courseMetaAt[courseId] || 0) < 600000) return courseMetaCache[courseId];
    try {
      var snap = await S.fs.getDoc(S.fs.doc(S.db, "lms_courses", courseId));
      courseMetaCache[courseId] = snap.exists() ? (snap.data().totalSec || 0) : 0;
    } catch (e) {
      courseMetaCache[courseId] = 0;
    }
    courseMetaAt[courseId] = Date.now();
    return courseMetaCache[courseId];
  }

  /* ★ [2026-10-01] 강좌 합치기 — 들은 칸은 합집합, 이수는 먼저 이수한 날 */
  function mergeCourseInto(dst, src) {
    if (!src) return dst;
    if (!dst.title && src.title) dst.title = src.title;
    if (!dst.type && src.type) dst.type = src.type;
    dst.totalSec = Math.max(dst.totalSec || 0, src.totalSec || 0);
    dst.tracks = dst.tracks || {};
    Object.keys(src.tracks || {}).forEach(function (k) {
      var s = src.tracks[k] || {}, d = dst.tracks[k];
      if (!d) { dst.tracks[k] = { title: s.title || "", slots: s.slots || "", pos: s.pos || 0, dur: s.dur || 0 }; if (s.at) dst.tracks[k].at = s.at; return; }
      var u = slotsToSet(d.slots);
      slotsToSet(s.slots).forEach(function (v) { u.add(v); });
      d.slots = setToSlots(u);
      if (!d.dur && s.dur) d.dur = s.dur;
      if ((s.at || 0) > (d.at || 0)) d.at = s.at;   /* ★ [2026-10-05] 마지막 학습 시각은 최신 값 */
      if (!d.title && s.title) d.title = s.title;
    });
    if (src.completed) {
      if (!dst.completed) { dst.completed = true; dst.completedAt = src.completedAt || dst.completedAt || ""; if (src.eduSec) dst.eduSec = src.eduSec; if (src.doneMedia) dst.doneMedia = src.doneMedia; }
      else if (src.completedAt && (!dst.completedAt || String(src.completedAt) < String(dst.completedAt))) { dst.completedAt = src.completedAt; if (src.eduSec) dst.eduSec = src.eduSec; if (src.doneMedia) dst.doneMedia = src.doneMedia; }
      else if (!dst.eduSec && src.eduSec) { dst.eduSec = src.eduSec; if (src.doneMedia) dst.doneMedia = src.doneMedia; }
    }
    /* ★ [2026-10-06] 매체별 이수일 — 먼저 이수한 날, 길이는 큰 값 */
    ["A", "V"].forEach(function (x) {
      var k = "done" + x, e = "edu" + x;
      if (src[k] && (!dst[k] || String(src[k]) < String(dst[k]))) dst[k] = src[k];
      if ((src[e] || 0) > (dst[e] || 0)) dst[e] = src[e];
    });
    if (src.carried) dst.carried = true;
    if (src.lastAt && String(src.lastAt) > String(dst.lastAt || "")) dst.lastAt = src.lastAt;
    return dst;
  }

  /* ★ [2026-10-01] 이전 달 문서 — 읽기 실패는 저장하지 않고 다음에 다시 읽는다 */
  async function prevDoc(ym) {
    if (S.prevDocs[ym] !== undefined) return S.prevDocs[ym];
    try {
      var snap = await S.fs.getDoc(S.fs.doc(S.db, "lms_progress", S.uid + "_" + ym));
      S.prevDocs[ym] = snap.exists() ? (snap.data() || {}) : null;
      return S.prevDocs[ym];
    } catch (e) {
      return { __err: true };
    }
  }

  /* ★ [2026-10-01] 이전 달에 들은 칸·이수를 이어받는다 — 달이 바뀌어도 같은 구간을 두 번 세지 않는다.
     이어받은 몫은 오늘 학습분이 아니므로 carryPending 에 적어 두고 저장 때 뺀다. */
  async function carryPrev(cid, c) {
    var before = calcCourse(c).playedSec;
    var yms = [];
    for (var i = 1; i <= CARRY_MONTHS; i++) yms.push(ymShift(S.ym, -i));
    var docs = await Promise.all(yms.map(prevDoc));
    var failed = false;
    docs.forEach(function (d) {
      if (d && d.__err) { failed = true; return; }
      var p = d && d.courses && d.courses[cid];
      if (p) mergeCourseInto(c, p);
    });
    if (!failed) c.carried = true;
    var gained = calcCourse(c).playedSec - before;
    if (gained > 0) {
      var k = S.ym + "|" + cid;
      S.carryPending[k] = (S.carryPending[k] || 0) + gained;
      S.dirty = true;
    }
  }

  /* ★ [2026-10-01] 강좌 준비 — 이번 달 문서에 강좌를 만들고 이전 달 기록을 한 번 이어받는다 */
  function ensureCourse(cid, info) {
    var key = S.ym + "|" + cid;
    if (S.ensuring[key]) return S.ensuring[key];
    S.ensuring[key] = (async function () {
      var doc = await load();
      if (!doc.courses[cid]) {
        doc.courses[cid] = {
          courseId: cid,
          type: info.courseType || "",
          title: info.courseTitle || "",
          totalSec: info.courseTotalSec || await courseTotal(cid),
          tracks: {},
          completed: false,
        };
      }
      var c = doc.courses[cid];
      if (!c.title && info.courseTitle) c.title = info.courseTitle;
      if (!c.carried) await carryPrev(cid, c);
    })();
    S.ensuring[key].catch(function () { delete S.ensuring[key]; });
    return S.ensuring[key];
  }

  /* ── 저장 ──────────────────────────────────────────────── */
  /* ★ [2026-10-01] 저장 직전에 최신 문서를 다시 읽어 합친다.
     PC·폰·여러 탭이 동시에 써도 서로 덮어쓰지 않고, 들은 칸은 합집합으로 남는다.
     오늘 학습분(days·dayC)은 "합친 결과에서 실제로 늘어난 만큼"만 더한다. */
  async function writeMerged() {
    var ym = S.ym, mine = S.cache;
    if (!mine) return;
    /* 진행 중인 강좌 준비(이어받기)를 먼저 끝낸다 */
    var pend = Object.keys(S.ensuring).map(function (k) { return S.ensuring[k].catch(function () {}); });
    await Promise.all(pend);
    var carrySnap = Object.assign({}, S.carryPending);

    var ref = S.fs.doc(S.db, "lms_progress", S.uid + "_" + ym);
    var snap = await S.fs.getDoc(ref);          /* 못 읽으면 저장하지 않는다 — 덮어쓰기 방지 */
    var fresh = snap.exists() ? (snap.data() || {}) : {};
    var day = todayKey();
    var copy2 = function (m) { var o = {}; Object.keys(m || {}).forEach(function (k) { o[k] = Object.assign({}, m[k]); }); return o; };
    var out = {
      uid: S.uid, ym: ym, courses: {},
      days: Object.assign({}, fresh.days), dones: Object.assign({}, fresh.dones),
      dayC: copy2(fresh.dayC), doneC: copy2(fresh.doneC),
      hours: Object.assign({}, fresh.hours), wdays: Object.assign({}, fresh.wdays),
    };
    var bId = S.meta.branchId || fresh.branchId, tId = S.meta.teamId || fresh.teamId;
    if (bId) out.branchId = bId;
    if (tId) out.teamId = tId;

    var fc = fresh.courses || {}, mc = mine.courses || {};
    var ids = Object.keys(fc);
    Object.keys(mc).forEach(function (k) { if (ids.indexOf(k) < 0) ids.push(k); });
    var gainAll = 0, newDone = 0;
    ids.forEach(function (cid) {
      var f = fc[cid], m = mc[cid];
      var c = { courseId: cid, type: "", title: "", totalSec: 0, tracks: {}, completed: false };
      mergeCourseInto(c, f);
      mergeCourseInto(c, m);
      /* 이어 듣기 위치 — 이 기기에서 재생한 트랙만 이 기기 값으로 */
      if (m) Object.keys(m.tracks || {}).forEach(function (tid) {
        if (S.touched[cid + "|" + tid] && c.tracks[tid]) c.tracks[tid].pos = m.tracks[tid].pos || 0;
      });
      var r = calcCourse(c);
      c.playedSec = r.playedSec;
      c.ratio = Math.round(r.ratio * 1000) / 1000;
      /* 늘어난 만큼 = 합친 결과 − (이미 저장된 값 + 이어받은 몫) */
      var base = f ? (f.playedSec || 0) : 0;
      if (!(f && f.carried)) base += (carrySnap[ym + "|" + cid] || 0);
      var gain = r.playedSec - base;
      if (gain > 0) {
        out.dayC[day] = out.dayC[day] || {};
        out.dayC[day][cid] = (out.dayC[day][cid] || 0) + gain;
        gainAll += gain;
      }
      if (!c.completed && r.ratio >= DONE_RATIO) {
        c.completed = true;
        c.completedAt = day;
        c.eduSec = r.totalSec || 0;         /* ★ [2026-10-05] 교육시간 — 이수한 쪽(음성 또는 영상)의 길이 */
        c.doneMedia = r.media || "audio";
        newDone++;
        out.doneC[day] = out.doneC[day] || {};
        out.doneC[day][cid] = 1;
      }
      /* ★ [2026-10-06] 매체별 이수 기록 — 강좌 이수 후에도 음성·영상 각각 80% 도달일·길이를 남긴다 (수료증 「음성+영상 / 영상만」) */
      /*   이미 그 매체로 강좌를 이수한 기록이 있으면 그 이수일을 쓴다 (지난 기록이 오늘 날짜로 잡히지 않게) */
      if (!c.doneA && (r.ratioA || 0) >= DONE_RATIO) { c.doneA = (c.completedAt && c.doneMedia !== "video") ? c.completedAt : day; c.eduA = r.secA || 0; }
      if (!c.doneV && (r.ratioV || 0) >= DONE_RATIO) { c.doneV = (c.completedAt && c.doneMedia === "video") ? c.completedAt : day; c.eduV = r.secV || 0; }
      out.courses[cid] = c;
    });
    if (gainAll > 0) out.days[day] = (out.days[day] || 0) + gainAll;
    if (newDone > 0) out.dones[day] = (out.dones[day] || 0) + newDone;
    /* 학습 시각 분포 — 저장 시점의 시간대·요일을 센다 (관리자 통계용) */
    out.hours[hourKey()] = (out.hours[hourKey()] || 0) + 1;
    out.wdays[wdayKey()] = (out.wdays[wdayKey()] || 0) + 1;
    out.lastAt = String(fresh.lastAt || "") > day ? String(fresh.lastAt) : day;
    out.updatedAt = S.fs.serverTimestamp();

    await S.fs.setDoc(ref, out, { merge: true });

    /* 저장 성공 — 메모리 사본을 합친 결과로 맞춘다 (저장 중에 새로 생긴 강좌는 그대로 둔다) */
    ids.forEach(function (cid) {
      mine.courses[cid] = out.courses[cid];
      var k = ym + "|" + cid;
      if (carrySnap[k]) {
        S.carryPending[k] = (S.carryPending[k] || 0) - carrySnap[k];
        if (S.carryPending[k] <= 0) delete S.carryPending[k];
      }
    });
    ["days", "dones", "dayC", "doneC", "hours", "wdays", "lastAt"].forEach(function (k) { mine[k] = out[k]; });
  }

  async function save(force) {
    if (!S.ready || !S.dirty || S.saving) return;
    var now = Date.now();
    if (!force && now - S.lastSave < MIN_SAVE_GAP) return;

    S.saving = true;
    try {
      /* 모든 플레이어의 들은 칸을 먼저 반영한다 (탭 이동·창 닫기 때도) */
      await Promise.all(S.syncers.map(function (f) { return f().catch(function () {}); }));
      S.dirty = false;
      await writeMerged();
      S.lastSave = Date.now();
      /* 달이 바뀌었으면 다음 저장부터 새 달 문서에 쓴다 (지난달 기록은 이어받기로 연결) */
      if (ymNow() !== S.ym) {
        S.ym = ymNow();
        S.cache = null;
        S.playedBase = null;
        S.baseByCourse = null;
      }
    } catch (e) {
      S.dirty = true;
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

      /* ★ [2026-10-01] 강좌·트랙 준비 — 메모리의 들은 칸은 버리지 않고 합친다 */
      async function ensure() {
        await ensureCourse(cid, info);
        var doc = await load();
        var c = doc.courses[cid];
        if (!c) return null;
        if (!c.title && info.courseTitle) c.title = info.courseTitle;
        if (!c.tracks[tid]) c.tracks[tid] = { title: info.trackTitle || "", slots: "", pos: 0, dur: 0 };
        var u = slotsToSet(c.tracks[tid].slots);
        if (slots) slots.forEach(function (v) { u.add(v); });
        slots = u;
        return c;
      }

      /* ★ [2026-10-01] 실제로 재생된 구간만 칸으로 인정한다.
         · 재생 중이고, 직전 위치에서 흐른 시간만큼 이어진 구간만 센다 — 건너뛰기·탐색바 이동은 제외
         · 휴대폰 잠금 화면처럼 코드가 멈췄다 깨어나도, 그동안 실제 시간이 흘렀으면 인정한다
         · 한 칸의 절반 이상을 실제로 들어야 그 칸을 인정한다 (오차 ±5초) */
      var playing = false, prevT = null, prevW = 0, acc = {}, chg = false;
      function credit(a, b) {
        var dur = (el.duration && isFinite(el.duration)) ? el.duration : 0;
        var t = a;
        while (t < b - 1e-6) {
          var k = Math.floor(t / SLOT);
          var end = Math.min(b, (k + 1) * SLOT);
          acc[k] = (acc[k] || 0) + (end - t);
          t = end;
          if (slots && !slots.has(k)) {
            var len = dur ? Math.min(SLOT, dur - k * SLOT) : SLOT;
            if (!(len > 0)) len = SLOT;
            if (acc[k] >= len / 2) { slots.add(k); chg = true; S.dirty = true; }
          }
        }
      }
      function tick() {
        var cur = el.currentTime || 0, w = Date.now();
        if (!slots) { ensure(); prevT = cur; prevW = w; return; }
        if (playing && prevT !== null) {
          var d = cur - prevT, wall = (w - prevW) / 1000, rate = el.playbackRate || 1;
          if (d > 0 && d <= wall * rate * 1.25 + 1.5) credit(prevT, cur);
        }
        prevT = cur; prevW = w;
      }

      async function sync() {
        var c = await ensure();
        if (!c) return;
        var t = c.tracks[tid];
        chg = false;
        t.slots = setToSlots(slots || new Set());
        c.lastAt = todayKey();            /* ★ [2026-09-23] 강좌별 마지막 학습일 */
        t.pos = Math.floor(el.currentTime || 0);
        t.at = Date.now();                /* ★ [2026-10-05] 트랙별 마지막 학습 시각 — 이어 듣기가 마지막에 쓴 매체(음성/영상)를 연다 */
        S.touched[cid + "|" + tid] = true;
        if (el.duration && isFinite(el.duration)) t.dur = Math.round(el.duration);
        /* ★ [2026-10-01] 강좌 전체 길이 — 등록(lms_courses)되면 그 값으로 보강 */
        var tt = await courseTotal(cid);
        if (tt > (c.totalSec || 0)) c.totalSec = tt;
        /* 강좌 전체 길이를 아직 모르면 트랙 길이 합으로 채워둔다 */
        if (!c.totalSec) {
          var sum = 0;
          Object.keys(c.tracks).forEach(function (k) { if (k !== VIDEO_TRACK) sum += (c.tracks[k].dur || 0); });   /* ★ [2026-10-05] 해설 영상 제외 */
          c.totalSec = sum;
        }
      }
      S.syncers.push(function () { return (slots && chg) ? sync() : Promise.resolve(); });   /* 새로 들은 칸이 있는 플레이어만 */

      el.addEventListener("loadedmetadata", function () { ensure(); });

      el.addEventListener("timeupdate", tick);

      el.addEventListener("play", function () {
        ensure();
        playing = true; prevT = el.currentTime || 0; prevW = Date.now();
        if (S.timer) clearInterval(S.timer);
        S.timer = setInterval(function () { sync().then(function () { save(false); }); }, SAVE_MS);
      });

      ["pause", "ended", "emptied"].forEach(function (ev) {
        el.addEventListener(ev, function () {
          tick();                          /* 멈춘 지점까지 반영 */
          playing = false; prevT = null;
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
        var ek = S.ym + "|" + courseId;              /* ★ [2026-10-01] 이어받기 끝난 뒤 위치 조회 */
        if (S.ensuring[ek]) await S.ensuring[ek].catch(function () {});
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
      var cid = payload.courseId, tid = payload.trackId;
      /* ★ [2026-10-01] 강좌 준비를 공통 함수로 — 이전 달 기록 이어받기 포함 */
      await ensureCourse(cid, { courseType: payload.courseType, courseTitle: payload.courseTitle, courseTotalSec: payload.courseTotalSec });
      var doc = await load();
      var c = doc.courses[cid];
      if (!c) return;
      if (!c.tracks[tid]) c.tracks[tid] = { title: payload.trackTitle || "", slots: "", pos: 0, dur: 0 };
      var t = c.tracks[tid];
      /* 들은 칸은 합집합으로 — 다른 기기에서 들은 것을 덮어쓰지 않는다 */
      var merged = slotsToSet(t.slots);
      slotsToSet(payload.slots).forEach(function (v) { merged.add(v); });
      t.slots = setToSlots(merged);
      c.lastAt = todayKey();              /* ★ [2026-09-23] 강좌별 마지막 학습일 */
      if (payload.pos !== undefined) { t.pos = payload.pos | 0; t.at = Date.now(); S.touched[cid + "|" + tid] = true; }
      if (payload.dur) t.dur = payload.dur | 0;
      if (!c.totalSec) {
        var sum = 0;
        Object.keys(c.tracks).forEach(function (k) { if (k !== VIDEO_TRACK) sum += (c.tracks[k].dur || 0); });   /* ★ [2026-10-05] 해설 영상 제외 */
        c.totalSec = sum;
      }
      S.dirty = true;
      await save(true);
    },

    _debug: function () { return { ready: S.ready, ym: S.ym, cache: S.cache }; },
  };

  global.JvLms = Jv;
})(window);
