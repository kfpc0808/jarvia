/* ═══════════════════════════════════════════════════════════════
 * jv-trial-guard.js — 영업 체험 계정 감시 (2026-11-19)
 *  · 각 기능 페이지(fc·salestalk·worklog·memo 등)에 <script type="module" src="jv-trial-guard.js"> 한 줄로 연결
 *  · 페이지가 만든 Firebase 앱(10.12.0)을 그대로 쓴다 — 앱을 새로 만들지 않는다
 *  · 로그인한 계정이 체험 계정(uid 가 trial_ 로 시작)일 때만 users/{uid} 를 실시간으로 지켜본다
 *    → 삭제(문서 없음) · 사용 중지(status≠active) · 기간 만료(expiresAt 지남) 중 하나라도 되면
 *      안내 후 로그아웃하고 메인으로 보낸다. 세 경우 모두 같은 동작.
 *  · 일반 회원·고객에게는 아무 동작도 하지 않는다 (추가 조회 없음)
 * ═══════════════════════════════════════════════════════════════ */
import { getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

(function () {
  if (window.__jvTrialGuard) return;
  window.__jvTrialGuard = true;
  let tries = 0, unsub = null, timer = null, done = false;

  function stop(msg) {
    if (done) return; done = true;
    try { if (unsub) unsub(); } catch (_e) {}
    if (timer) clearInterval(timer);
    try { alert(msg); } catch (_e) {}
    const go = () => { try { location.replace('/'); } catch (_e) { location.href = '/'; } };
    try { const a = getApps()[0]; signOut(getAuth(a)).then(go, go); } catch (_e) { go(); }
  }
  function endOf(v) {
    try { if (!v || v === 'unlimited') return 0; const d = v.toDate ? v.toDate() : new Date(v); const t = d.getTime(); return isNaN(t) ? 0 : t; } catch (_e) { return 0; }
  }
  function watch(app) {
    let auth; try { auth = getAuth(app); } catch (_e) { return; }
    const db = getFirestore(app, 'javia-db');
    onAuthStateChanged(auth, (u) => {
      if (unsub) { try { unsub(); } catch (_e) {} unsub = null; }
      if (timer) { clearInterval(timer); timer = null; }
      if (!u || String(u.uid || '').indexOf('trial_') !== 0) return;
      let exp = 0;
      const msgStop = '체험 이용이 중지되었습니다.\n계속 이용하시려면 담당자에게 문의해 주세요.';
      const msgEnd = '체험 기간이 끝났습니다.\n계속 이용하시려면 담당자에게 문의해 주세요.';
      unsub = onSnapshot(doc(db, 'users', u.uid), (s) => {
        if (!s.exists()) { stop(msgStop); return; }
        const x = s.data() || {};
        if (x.status && x.status !== 'active') { stop(x.status === 'expired' ? msgEnd : msgStop); return; }
        exp = endOf(x.expiresAt);
        if (exp && exp < Date.now()) stop(msgEnd);
      }, () => { stop(msgStop); });   /* 읽기 실패(계정 삭제·잠금으로 권한 상실) = 중지와 같은 처리 */
      timer = setInterval(() => { if (exp && exp < Date.now()) stop(msgEnd); }, 30000);
    });
  }
  function find() {
    const apps = getApps();
    const app = apps.find((a) => a && a.options && a.options.projectId === 'jarvia-platform');
    if (app) { watch(app); return; }
    if (++tries < 60) setTimeout(find, 500);   /* 페이지가 앱을 늦게 만드는 경우 최대 30초 대기 */
  }
  find();
})();
