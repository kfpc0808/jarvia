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
      // 100건(dailyMax)은 '권장' — 넘어가도 발송 허용(상단 진행률 바가 권장선 표시). 500건(hardMax)만 절대 차단.
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
  // 문자앱 열기: 안드로이드는 숨은 iframe으로 열어 현재 화면(발송 리스트)을 유지 / iOS는 location.href
  function _openSms(url) {
    if (isIOS()) { window.location.href = url; return; }
    var f = document.createElement('iframe');
    f.style.display = 'none';
    document.body.appendChild(f);
    f.src = url;
    setTimeout(function () { try { document.body.removeChild(f); } catch (e) {} }, 2000);
  }
  // 단건 발송: 한도 확인 → 문자앱 열기(화면 유지) → 카운트 +1
  function sendOne(phone, body) {
    return canSend(1).then(function (c) {
      if (!c.ok) return { sent: false, reason: c.reason, msg: c.msg };
      try { _openSms(buildSmsUrl(phone, body)); }
      catch (e) {
        try { window.location.href = buildSmsUrl(phone, body); }
        catch (_e) { return { sent: false, reason: 'open', msg: '문자앱을 열 수 없습니다.' }; }
      }
      return addSent(1).then(function () { return { sent: true }; });
    });
  }

  // ── 주소록에서 번호 선택 (Contact Picker API: 안드로이드 Chrome·삼성인터넷 등 / iOS·PC 미지원) ──
  function contactPickerSupported() {
    return !!(navigator.contacts && typeof navigator.contacts.select === 'function' && window.ContactsManager);
  }
  function pickContact() {
    if (!contactPickerSupported()) return Promise.resolve(null);
    return navigator.contacts.select(['tel', 'name'], { multiple: false }).then(function (sel) {
      if (!sel || !sel.length) return null;
      var tels = sel[0].tel || [];
      if (!tels.length) return null;
      return normalizePhone(tels[0]);
    }).catch(function () { return null; });
  }
  // 여러 명 한 번에 선택 → [{name, tel}]
  function pickContactsMulti() {
    if (!contactPickerSupported()) return Promise.resolve([]);
    return navigator.contacts.select(['tel', 'name'], { multiple: true }).then(function (sels) {
      return (sels || []).map(function (c) {
        var nm = (c.name && c.name.length) ? String(c.name[0] || '') : '';
        var tl = (c.tel && c.tel.length) ? normalizePhone(c.tel[0]) : '';
        return { name: nm, tel: tl };
      }).filter(function (x) { return x.tel; });
    }).catch(function () { return []; });
  }

  // ── vCard(.vcf) 파싱 → [{name, tel}] (한글 Quoted-Printable 디코딩 포함) ──
  function _qpDecode(s) {
    s = String(s || '').replace(/=\r?\n/g, '');            // QP soft line break
    var bytes = [], i = 0;
    while (i < s.length) {
      if (s[i] === '=' && /^[0-9A-Fa-f]{2}/.test(s.substr(i + 1, 2))) { bytes.push(parseInt(s.substr(i + 1, 2), 16)); i += 3; }
      else { bytes.push(s.charCodeAt(i) & 0xff); i++; }
    }
    try { return new TextDecoder('utf-8').decode(new Uint8Array(bytes)); } catch (e) { return s; }
  }
  function _vLine(line) {
    var c = line.indexOf(':'); if (c < 0) return null;
    var head = line.slice(0, c), value = line.slice(c + 1);
    var parts = head.split(';'); var key = (parts.shift() || '').toUpperCase();
    if (parts.join(';').toUpperCase().indexOf('QUOTED-PRINTABLE') >= 0) value = _qpDecode(value);
    return { key: key, value: value.trim() };
  }
  function parseVCard(text) {
    var out = [];
    // RFC 2425 line folding(이어쓰기) 해제 후 카드 분리
    var unfolded = String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
    unfolded.split(/BEGIN:VCARD/i).forEach(function (b) {
      if (!/END:VCARD/i.test(b)) return;
      var fn = '', n = '', tel = '';
      b.split('\n').forEach(function (ln) {
        if (!ln) return;
        var p = _vLine(ln); if (!p) return;
        if (p.key === 'FN') { if (!fn) fn = p.value; }
        else if (p.key === 'N') { if (!n) n = p.value.split(';').filter(Boolean).join(' ').trim(); }
        else if (p.key === 'TEL') { if (!tel) tel = normalizePhone(p.value); }
      });
      var nm = fn || n;
      if (tel) out.push({ name: nm, tel: tel });
    });
    return out;
  }

  // ── 스마트 이름 매칭: 폰 이름이 고객명으로 시작하거나 포함하면 일치 ──
  function _normName(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
  function smartMatchName(customerName, contactName) {
    var a = _normName(customerName), b = _normName(contactName);
    if (!a || !b) return false;
    return b.indexOf(a) === 0 || (a.length >= 2 && b.indexOf(a) >= 0);
  }

  window.SmsCore = {
    LIMITS: LIMITS,
    normalizePhone: normalizePhone,
    getNumber: getNumber, setNumber: setNumber, bulkSetNumbers: bulkSetNumbers, exportNumbers: exportNumbers,
    getToday: getToday, canSend: canSend, addSent: addSent, addSession: addSession, sessionGate: sessionGate,
    buildSmsUrl: buildSmsUrl, sendOne: sendOne, isIOS: isIOS, todayStr: todayStr,
    contactPickerSupported: contactPickerSupported, pickContact: pickContact,
    pickContactsMulti: pickContactsMulti, parseVCard: parseVCard, smartMatchName: smartMatchName
  };
})();
