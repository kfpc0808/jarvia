/* ============================================================================
 * JARVIA 오류 수집 공통 모듈 (jarvia-error-collector.js)
 * ----------------------------------------------------------------------------
 *  · 역할: 각 페이지에서 발생하는 JS 오류 / 먹통(무반응) / 생존신호를 조용히
 *          Firestore(client_errors @ javia-db)로 전송한다.
 *  · 원칙:
 *     (1) 사용자 동작을 절대 방해하지 않는다 — 모든 로직은 try/catch로 격리,
 *         전송 실패해도 무해하게 넘어간다.
 *     (2) 개인정보(고객 이름·연락처·입력값)는 절대 저장하지 않는다.
 *         기록: 화면·버튼·기기·에러메시지·컨설턴트ID 메타만.
 *     (3) B2B2C — 사용자 화면엔 어떤 표시도 하지 않는다(백그라운드 전용).
 *  · 캡처(에러 리스너·버퍼)는 <head> 초반 인라인이 담당하고(window.__jvErr),
 *    이 모듈은 그 버퍼를 주기적으로 Firestore로 '전송'만 한다.
 *  · 사용법: 각 페이지 <head>에 인라인 버퍼 + 이 파일 한 줄만 추가.
 *      <script type="module" src="jarvia-error-collector.js"></script>
 * ========================================================================== */
(async function () {
  "use strict";
  try {
    // 중복 초기화 방지
    if (window.__jvErrSenderReady) return;
    window.__jvErrSenderReady = true;

    // 조기 버퍼가 없으면(=인라인 스니펫 누락) 안전하게 생성
    if (!window.__jvErr) window.__jvErr = { buf: [], track: {} };

    // ── 설정 ────────────────────────────────────────────────────────────
    var CFG = {
      page: (window.__jvPage || "unknown"),   // 페이지가 window.__jvPage='fc' 등으로 지정
      maxPerSession: 40,       // 세션당 최대 전송 수(폭주 방지)
      dedupeWindowMs: 60000,   // 동일 오류 60초 내 중복 스킵
      deadClickMs: 6000,       // 클릭 후 완료 없으면 '먹통'으로 추정하는 시간
      flushMs: 4000,           // 버퍼 → 전송 주기
      msgMax: 800, stackMax: 1200, uaMax: 300
    };

    var sent = 0;
    var seen = {};             // 중복 방지 서명 → 마지막 전송시각
    var sessionId = _sid();

    // ── Firebase (자체 앱 인스턴스 · 메인 앱과 분리) ──────────────────────
    var addDocFn = null, colFn = null, dbRef = null, serverTs = null;
    try {
      var appMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      var fsMod  = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      var authMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      var FC = {
        apiKey: "AIzaSyBD9p-bf162RiiD1Y3BsY-NvbYjpOSrzmg",
        authDomain: "jarvia-platform.firebaseapp.com",
        projectId: "jarvia-platform",
        storageBucket: "jarvia-platform.firebasestorage.app",
        messagingSenderId: "388025068900",
        appId: "1:388025068900:web:09ba8e12e9e9e2ec49de71"
      };
      var errApp;
      try { errApp = appMod.initializeApp(FC, "jvErr"); }
      catch (e) { errApp = appMod.initializeApp(FC); } // 이름 충돌 시 폴백
      dbRef = fsMod.getFirestore(errApp, "javia-db");
      addDocFn = fsMod.addDoc; colFn = fsMod.collection; serverTs = fsMod.serverTimestamp;
      // 익명 로그인(베스트에포트) — 실패해도 계속 진행
      try { authMod.signInAnonymously(authMod.getAuth(errApp)); } catch (e) {}
    } catch (e) {
      // Firebase 로드 실패 → 전송 불가하지만 캡처 버퍼는 계속 쌓임(무해)
      return;
    }

    // ── 컨텍스트(누가·어디서) — 개인정보 없음 ────────────────────────────
    function ctx() {
      var loginId = "";
      try {
        var q = new URLSearchParams(location.search);
        loginId = q.get("fc") || q.get("id") || "";
        if (!loginId) {
          var seg = location.pathname.split("/").filter(Boolean);
          if (seg.length) loginId = seg[seg.length - 1].replace(/\.html?$/i, "");
        }
      } catch (e) {}
      return {
        consultantLoginId: (loginId || "").slice(0, 60),
        viewer: (window.__jvViewer || "unknown"),   // 페이지가 'owner'/'customer'로 지정 가능
        screen: (window.__jvScreen || CFG.page),
        url: (location.pathname + location.search).slice(0, 300)
      };
    }

    // ── 기기 파싱(UA) ────────────────────────────────────────────────────
    function device() {
      var ua = "";
      try { ua = navigator.userAgent || ""; } catch (e) {}
      var os = "기타", model = "기타", browser = "기타", mobile = false;
      try {
        if (/iPhone|iPad|iPod/i.test(ua)) { os = "iOS"; model = /iPad/i.test(ua) ? "iPad" : "iPhone"; mobile = true; }
        else if (/Android/i.test(ua)) { os = "Android"; mobile = true; var m = ua.match(/;\s?([^;)]+)\sBuild/i); model = m ? m[1].trim() : "Android"; }
        else if (/Windows/i.test(ua)) { os = "Windows"; model = "PC"; }
        else if (/Mac OS X/i.test(ua)) { os = "macOS"; model = "Mac"; }
        var iosV = ua.match(/OS (\d+[_\.]\d+)/); if (iosV) os += " " + iosV[1].replace("_", ".");
        if (/CriOS/i.test(ua)) browser = "Chrome(iOS)";
        else if (/EdgiOS|Edg\//i.test(ua)) browser = "Edge";
        else if (/SamsungBrowser/i.test(ua)) browser = "삼성인터넷";
        else if (/Chrome\//i.test(ua)) browser = "Chrome";
        else if (/Safari\//i.test(ua)) browser = "Safari";
        else if (/FBAN|FBAV|KAKAOTALK/i.test(ua)) browser = "인앱브라우저";
      } catch (e) {}
      var w = 0; try { w = window.innerWidth || (screen && screen.width) || 0; } catch (e) {}
      return { model: model, os: os, browser: browser, isMobile: mobile, screenW: w, ua: ua.slice(0, CFG.uaMax) };
    }

    // ── 전송 ─────────────────────────────────────────────────────────────
    async function send(ev) {
      try {
        if (sent >= CFG.maxPerSession) return;
        // 중복 스킵
        var sig = (ev.t || "") + "|" + (ev.message || "") + "|" + (ev.lineno || "");
        var now = Date.now();
        if (seen[sig] && (now - seen[sig]) < CFG.dedupeWindowMs) return;
        seen[sig] = now;

        var c = ctx();
        var payload = {
          page: CFG.page,
          type: ev.t || "js_error",
          screen: c.screen,
          consultantLoginId: c.consultantLoginId,
          viewer: c.viewer,
          message: (ev.message || "").toString().slice(0, CFG.msgMax),
          source: (ev.source || "").toString().slice(0, 300),
          lineno: ev.lineno || 0,
          colno: ev.colno || 0,
          func: (ev.func || "").toString().slice(0, 120),
          stack: (ev.stack || "").toString().slice(0, CFG.stackMax),
          device: device(),
          url: c.url,
          sessionId: sessionId,
          createdDate: _kstDate(),
          ts: serverTs()
        };
        sent++;
        await addDocFn(colFn(dbRef, "client_errors"), payload);
      } catch (e) { /* 전송 실패는 조용히 무시 (사용자 무영향) */ }
    }

    // ── 버퍼 비우기(에러/거부) ───────────────────────────────────────────
    function flush() {
      try {
        var b = window.__jvErr.buf;
        while (b && b.length) { send(b.shift()); }
        scanDeadClicks();
      } catch (e) {}
    }

    // ── 먹통(무반응) 추정: 클릭 후 완료 없음 ─────────────────────────────
    function scanDeadClicks() {
      try {
        var t = window.__jvErr.track, now = Date.now();
        for (var name in t) {
          if (!t.hasOwnProperty(name)) continue;
          if (now - t[name] > CFG.deadClickMs) {
            delete t[name];
            send({ t: "dead_click", message: "클릭 후 완료 로그 없음", func: name, source: "", lineno: 0 });
          }
        }
      } catch (e) {}
    }

    // ── 생존신호(하트비트): 세션당 1회 — 0건일 때 '수집실패 vs 무오류' 구분용 ──
    function heartbeat() {
      try {
        var k = "jv_hb_" + CFG.page;
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
        send({ t: "heartbeat", message: "pipeline_alive", source: "", lineno: 0 });
      } catch (e) {}
    }

    // ── 유틸 ─────────────────────────────────────────────────────────────
    function _sid() { try { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); } catch (e) { return "sid"; } }
    function _kstDate() { try { var d = new Date(Date.now() + 9 * 3600000); return d.toISOString().slice(0, 10); } catch (e) { return ""; } }

    // ── 구동 ─────────────────────────────────────────────────────────────
    heartbeat();
    flush(); // 로드 전 쌓인 초기 오류 즉시 전송
    setInterval(flush, CFG.flushMs);
    // 페이지 떠날 때 마지막으로 한 번 더
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });

  } catch (e) { /* 최상위 방어 — 어떤 경우에도 사용자에게 영향 없음 */ }
})();
