/* ============================================================
 * sms-core.js — JARVIA 문자발송 공용 코어
 *   · 로컬 전화번호 저장 (IndexedDB · 서버 미전송)
 *   · sms: URI 빌더 (안드로이드 / iOS 분기 + 인코딩)
 *   · 안전 발송 일일 카운터
 *   index.html · message.html 공용. window.SmsCore 로 노출.
 *   같은 origin 이라 두 페이지가 동일 IndexedDB(번호·카운터)를 공유.
 * ============================================================ */
(function () {
  'use strict';

  var DB_NAME = 'jarvia-sms', DB_VER = 1;
  var STORE_NUM = 'numbers';  // key: cid → { cid, phone, updatedAt }
  var STORE_META = 'meta';    // key: 'daily' → { date:'YYYY-MM-DD', count, sessions, lastSessionAt }

  // 안전 발송 기준 (운영값은 관리자 조정 가능 · hardMax 500 은 고정 상한)
  var LIMITS = {
    dailyMax: 100,     // 하루 누적 권장 상한
    hardMax: 500,      // 절대 차단(통신사 공통 제한선)
    sessionMax: 50,    // 1세션 최대
    smallSession: 20,  // 이하 = 소량(간격 면제)
    largeSessions: 2,  // 대형 세션 1일 허용 횟수
    gapHours: 3        // 대형 세션 사이 권장 간격(시간)
  };

  var _dbp = null;
  function db() {
    if (_dbp) return _dbp;
    _dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NUM)) d.createObjectStore(STORE_NUM, { keyPath: 'cid' });
        if (!d.objectStoreNames.contains(STORE_META)) d.createObjectStore(STORE_META, { keyPath: 'key' });
      };
      r.onsuccess = function (e) { res(e.target.result); };
      r.onerror = function () { rej(r.error); };
    });
    return _dbp;
  }
  function store(name, mode) { return db().then(function (d) { return d.transaction(name, mode).objectStore(name); }); }
  function reqP(request) { return new Promise(function (res, rej) { request.onsuccess = function () { res(request.result); }; request.onerror = function () { rej(request.error); }; }); }

  function normalizePhone(p) { return String(p || '').replace(/[^0-9+]/g, ''); }

  // ── 번호 (로컬 전용) ──
  function getNumber(cid) {
    if (!cid) return Promise.resolve(null);
    return store(STORE_NUM, 'readonly').then(function (s) { return reqP(s.get(cid)); })
      .then(function (v) { return v && v.phone ? v.phone : null; })
      .catch(function () { return null; });
  }
  function setNumber(cid, phone) {
    var ph = normalizePhone(phone);
    if (!cid || !ph) return Promise.reject(new Error('cid/phone 필요'));
    return store(STORE_NUM, 'readwrite').then(function (s) { return reqP(s.put({ cid: cid, phone: ph, updatedAt: Date.now() })); });
  }
  function bulkSetNumbers(list) { // [{cid, phone}]
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE_NUM, 'readwrite'), s = t.objectStore(STORE_NUM), n = 0;
        (list || []).forEach(function (it) {
          var ph = normalizePhone(it.phone);
          if (it.cid && ph) { s.put({ cid: it.cid, phone: ph, updatedAt: Date.now() }); n++; }
        });
        t.oncomplete = function () { res(n); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function exportNumbers() {
    return store(STORE_NUM, 'readonly').then(function (s) { return reqP(s.getAll()); }).then(function (a) { return a || []; });
  }

  // ── KST 날짜 ──
  function todayStr() { var k = new Date(Date.now() + 9 * 3600000); return k.toISOString().slice(0, 10); }

  // ── 안전 발송 카운터 ──
  function getToday() {
    return store(STORE_META, 'readonly').then(function (s) { return reqP(s.get('daily')); }).then(function (v) {
      var t = todayStr();
      if (!v || v.date !== t) return { date: t, count: 0, sessions: 0, lastSessionAt: 0 };
      return v;
    }).catch(function () { return { date: todayStr(), count: 0, sessions: 0, lastSessionAt: 0 }; });
  }
  function _saveToday(o) { return store(STORE_META, 'readwrite').then(function (s) { o.key = 'daily'; return reqP(s.put(o)); }); }

  // n건 발송 가능 여부
  function canSend(n) {
    n = n || 1;
    return getToday().then(function (d) {
      if (d.count + n > LIMITS.hardMax) return { ok: false, reason: 'hard', msg: '안전을 위해 하루 ' + LIMITS.hardMax + '건까지만 보낼 수 있어요.', today: d };
      if (d.count + n > LIMITS.dailyMax) return { ok: false, reason: 'daily', msg: '오늘은 여기까지가 안전해요. 내일 이어서 보내면 가장 안전합니다.', today: d };
      return { ok: true, today: d };
    });
  }
  function addSent(n) {
    n = n || 1;
    return getToday().then(function (d) { d.count += n; return _saveToday(d).then(function () { return d; }); });
  }
  function addSession() {
    return getToday().then(function (d) { d.sessions += 1; d.lastSessionAt = Date.now(); return _saveToday(d).then(function () { return d; }); });
  }
  // 대형 세션 간격 판정
  function sessionGate() {
    return getToday().then(function (d) {
      if (d.sessions >= LIMITS.largeSessions) return { ok: false, reason: 'sessions', msg: '오늘 단체 발송 ' + LIMITS.largeSessions + '회를 채웠어요. 내일 이어서 보내면 안전합니다.' };
      if (d.lastSessionAt) {
        var elapsedH = (Date.now() - d.lastSessionAt) / 3600000;
        if (elapsedH < LIMITS.gapHours) {
          var remain = Math.ceil(LIMITS.gapHours - elapsedH);
          return { ok: false, reason: 'gap', msg: '큰 단체는 ' + LIMITS.gapHours + '시간 간격을 두는 게 안전해요. 약 ' + remain + '시간 뒤 가능합니다.' };
        }
      }
      return { ok: true };
    });
  }

  // ── sms: URI ──
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function buildSmsUrl(phone, body) {
    var ph = normalizePhone(phone), b = encodeURIComponent(body || '');
    // iOS는 구분자로 &, 안드로이드 등은 ?body=
    return isIOS() ? ('sms:' + ph + '&body=' + b) : ('sms:' + ph + '?body=' + b);
  }
  // 단건 발송: 한도 확인 → 문자앱 열기 → 카운트 +1
  function sendOne(phone, body) {
    return canSend(1).then(function (c) {
      if (!c.ok) return { sent: false, reason: c.reason, msg: c.msg };
      try { window.location.href = buildSmsUrl(phone, body); }
      catch (e) { return { sent: false, reason: 'open', msg: '문자앱을 열 수 없습니다.' }; }
      return addSent(1).then(function () { return { sent: true }; });
    });
  }

  window.SmsCore = {
    LIMITS: LIMITS,
    normalizePhone: normalizePhone,
    getNumber: getNumber, setNumber: setNumber, bulkSetNumbers: bulkSetNumbers, exportNumbers: exportNumbers,
    getToday: getToday, canSend: canSend, addSent: addSent, addSession: addSession, sessionGate: sessionGate,
    buildSmsUrl: buildSmsUrl, sendOne: sendOne, isIOS: isIOS, todayStr: todayStr
  };
})();
