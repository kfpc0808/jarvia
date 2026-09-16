/**
 * JARVIA 계산기 공통 템플릿 — calculators/lib/calc-ui.js
 *
 * ui-spec.js의 명세 하나만 있으면 입력 폼과 결과 화면을 자동으로 그린다.
 * 계산은 전부 JarviaCalculators.calculate({calculatorId, input}) 게이트웨이를 통한다.
 *
 * 사용: lib/calc-personal.js → lib/ui-spec.js → lib/calc-ui.js 순서로 로드한 뒤
 *       JarviaCalcUI.mount('earnedIncome') 호출
 */
(function (global) {
  'use strict';

  // ── 포맷 ──
  function num(v) {
    const s = String(v == null ? '' : v).replace(/[^0-9.-]/g, '');
    if (s === '' || s === '-' || s === '.') return null;   // 빈 칸은 0이 아니라 '미입력'
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function comma(n) { return (Math.round(n) || 0).toLocaleString('ko-KR'); }

  function korMoney(n) {
    n = Math.round(Math.abs(Number(n) || 0));
    if (!n) return '';
    const u = [[1e12, '조'], [1e8, '억'], [1e4, '만']];
    let out = '', rest = n;
    for (const [v, label] of u) {
      const q = Math.floor(rest / v);
      if (q) { out += (out ? ' ' : '') + comma(q) + label; rest -= q * v; }
      if (out && rest === 0) break;
    }
    if (rest && !out) out = comma(rest);
    else if (rest) out += ' ' + comma(rest);
    return out + '원';
  }

  const FMT = {
    won: v => comma(v) + '원',
    wonSigned: v => (Number(v) > 0 ? '+' : Number(v) < 0 ? '−' : '') + comma(Math.abs(v)) + '원',
    pct: v => (Math.round(Number(v) * 100) / 100) + '%',
    num: v => comma(v),
    cnt: v => comma(v) + '명',
    year: v => v + '년',
    text: v => String(v)
  };
  function fmt(kind, v) { return (FMT[kind] || FMT.num)(v); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ── 상태 ──
  let SPEC = null, VALS = {}, ROOT = null;

  function allFields() {
    return SPEC.groups.reduce((a, g) => a.concat(g.fields), []);
  }

  // ── 폼 그리기 ──
  function fieldHtml(f) {
    const req = f.required ? '<span class="req">*</span>' : '';
    const hint = f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '';
    let input;
    if (f.type === 'select') {
      input = '<select data-k="' + f.k + '">' +
        f.options.map(o => '<option value="' + esc(o.v) + '"' + (o.v === f.def ? ' selected' : '') + '>' + esc(o.t) + '</option>').join('') +
        '</select>';
    } else {
      const val = (f.def !== undefined && f.def !== null) ? comma(f.def) : '';
      input = '<input type="text" inputmode="numeric" class="num" data-k="' + f.k + '" value="' + val + '" placeholder="' + esc(f.ph || '0') + '">';
    }
    const unit = f.unit ? '<span class="unit">' + esc(f.unit) + '</span>' : '';
    const quick = (f.quick && f.quick.length)
      ? '<div class="quick">' + f.quick.map(q => '<button type="button" data-k="' + f.k + '" data-add="' + q + '">+' + korMoney(q).replace('원', '') + '</button>').join('') + '</div>'
      : '';
    const ko = f.type === 'money' ? '<div class="ko" data-ko="' + f.k + '"></div>' : '';
    return '<div class="fld" data-f="' + f.k + '"><label>' + esc(f.label) + req + hint + '</label>' +
      '<div class="inw">' + input + unit + '</div>' + ko + quick + '</div>';
  }

  function formHtml() {
    return SPEC.groups.map((g, i) =>
      '<div class="grp' + (g.collapsed ? ' fold' : '') + '" data-g="' + i + '">' +
      (g.label ? '<div class="grp-h" data-gt="' + i + '">' + esc(g.label) +
        (g.collapsed !== undefined ? '<span class="tg">' + (g.collapsed ? '펼치기' : '접기') + '</span>' : '') + '</div>' : '') +
      '<div class="grp-b">' + g.fields.map(fieldHtml).join('') + '</div></div>'
    ).join('');
  }

  // ── 입력 수집 ──
  function collect() {
    const out = {};
    allFields().forEach(f => {
      const el = ROOT.querySelector('[data-k="' + f.k + '"]');
      if (!el) return;
      if (f.type === 'select') { out[f.k] = el.value; return; }
      const v = num(el.value);
      if (v !== null) out[f.k] = f.scale ? v * f.scale : v;
      else if (f.def !== undefined) out[f.k] = f.def;
    });
    if (SPEC.fixed) Object.assign(out, SPEC.fixed);
    return out;
  }

  function syncKo() {
    allFields().forEach(f => {
      if (f.type !== 'money') return;
      const el = ROOT.querySelector('[data-k="' + f.k + '"]');
      const ko = ROOT.querySelector('[data-ko="' + f.k + '"]');
      if (!el || !ko) return;
      const v = num(el.value);
      ko.textContent = v ? korMoney(f.scale ? v * f.scale : v) : '';
    });
  }

  // ── 결과 그리기 ──
  function resultHtml(r) {
    const o = SPEC.outputs, d = r.result || {};
    let h = '';

    const mv = d[o.main.k];
    h += '<div class="res-main"><div class="lb">' + esc(o.main.label) + '</div>' +
      '<div class="vl">' + fmt(o.main.fmt, mv) + '</div>' +
      (o.main.fmt === 'won' ? '<div class="ko">' + korMoney(mv) + '</div>' : '') + '</div>';

    if (o.sub && o.sub.length) {
      h += '<div class="res-sub">' + o.sub.map(s => {
        const v = d[s.k];
        let cls = '';
        if (s.sign) cls = Number(v) > 0 ? ' pos' : Number(v) < 0 ? ' neg' : '';
        return '<div><div class="lb">' + esc(s.label) + '</div><div class="vl' + cls + '">' + fmt(s.fmt, v) + '</div></div>';
      }).join('') + '</div>';
    }

    if (o.rows && o.rows.length) {
      h += '<table class="rows">' + o.rows.map(row => {
        const v = row.path ? row.path.split('.').reduce((a, k) => (a == null ? a : a[k]), d) : d[row.k];
        if (v === undefined || v === null) return '';
        return '<tr' + (row.sum ? ' class="sum"' : '') + '><th>' + esc(row.label) + '</th><td>' + fmt(row.fmt || 'won', v) + '</td></tr>';
      }).join('') + '</table>';
    }

    const w = [].concat(r.warnings || [], d.warnings || []);
    if (w.length) {
      h += '<div class="msg warn" style="margin:14px 0 0"><b>확인해 주세요</b><ul>' +
        [...new Set(w)].map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
    }
    if (SPEC.note) h += '<div class="note">' + esc(SPEC.note) + '</div>';
    return h;
  }

  function errHtml(r) {
    const labels = {};
    allFields().forEach(f => { labels[f.k] = f.label; });
    const miss = (r.missingInputs || []).map(k => labels[String(k).split('|')[0]] || k);
    const bad = (r.invalidInputs || []).map(k => labels[k] || k);
    let h = '<div class="msg err"><b>계산할 수 없습니다</b><ul>';
    if (miss.length) h += '<li>필수 입력이 비어 있습니다 — ' + esc([...new Set(miss)].join(', ')) + '</li>';
    if (bad.length) h += '<li>값을 확인해 주세요 — ' + esc([...new Set(bad)].join(', ')) + '</li>';
    if (!miss.length && !bad.length) h += '<li>' + esc((r.warnings || [])[0] || '입력값을 확인해 주세요.') + '</li>';
    h += '</ul></div>';
    return h;
  }

  function placeholder() {
    return '<div class="ph"><div class="ico">🧮</div><p>값을 입력하면 결과가 표시됩니다.<br>필수 항목만 넣어도 계산됩니다.</p></div>';
  }

  // ── 계산 ──
  function run() {
    const out = ROOT.querySelector('[data-res]');
    const api = global.JarviaCalculators;
    if (!api || typeof api.calculate !== 'function') {
      out.innerHTML = '<div class="msg err">계산 모듈을 불러오지 못했습니다. 새로고침(Ctrl+F5) 후 다시 시도해 주세요.</div>';
      return;
    }
    const input = collect();
    const need = allFields().filter(f => f.required);
    if (need.some(f => input[f.k] === undefined || input[f.k] === null || input[f.k] === 0)) {
      out.innerHTML = placeholder();
      ROOT.querySelectorAll('.fld').forEach(e => e.classList.remove('bad'));
      return;
    }

    let r;
    try { r = api.calculate({ calculatorId: SPEC.id, input: input }); }
    catch (e) { out.innerHTML = '<div class="msg err">계산 중 오류가 발생했습니다.</div>'; return; }

    ROOT.querySelectorAll('.fld').forEach(e => e.classList.remove('bad'));
    const flag = [].concat(r.missingInputs || [], r.invalidInputs || []);
    flag.forEach(k => {
      const el = ROOT.querySelector('.fld[data-f="' + String(k).split('|')[0] + '"]');
      if (el) el.classList.add('bad');
    });

    out.innerHTML = (r.ok && r.result) ? resultHtml(r) : errHtml(r);
  }

  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

  // ── 마운트 ──
  function mount(specId, target) {
    SPEC = (global.JarviaCalcSpec || {})[specId];
    if (!SPEC) { console.error('[calc-ui] spec 없음:', specId); return; }
    ROOT = target ? (typeof target === 'string' ? document.querySelector(target) : target)
      : document.getElementById('calcRoot');
    if (!ROOT) { console.error('[calc-ui] 마운트 대상 없음'); return; }

    ROOT.innerHTML =
      '<div class="cols">' +
      '<div class="box"><div class="box-h">입력<span class="n">* 필수</span></div>' +
      '<form data-form autocomplete="off">' + formHtml() + '</form>' +
      '<div class="acts"><button type="button" class="btn btn-main" data-run>계산하기</button>' +
      '<button type="button" class="btn btn-sub" data-reset>초기화</button></div></div>' +
      '<div class="box"><div class="box-h">결과</div><div data-res>' + placeholder() + '</div></div>' +
      '</div>';

    const auto = debounce(() => { syncKo(); run(); }, 260);

    ROOT.querySelectorAll('input[data-k]').forEach(el => {
      el.addEventListener('input', () => {
        const p = el.selectionStart, before = el.value.length;
        const v = num(el.value);
        el.value = v === null ? '' : comma(v);
        const after = el.value.length;
        try { el.setSelectionRange(Math.max(0, p + (after - before)), Math.max(0, p + (after - before))); } catch (e) {}
        auto();
      });
    });
    ROOT.querySelectorAll('select[data-k]').forEach(el => el.addEventListener('change', auto));

    ROOT.querySelectorAll('.quick button').forEach(b => b.addEventListener('click', () => {
      const el = ROOT.querySelector('input[data-k="' + b.dataset.k + '"]');
      el.value = comma((num(el.value) || 0) + Number(b.dataset.add));
      syncKo(); run();
    }));

    ROOT.querySelectorAll('.grp-h[data-gt]').forEach(h => h.addEventListener('click', () => {
      const g = h.parentElement;
      g.classList.toggle('fold');
      const t = h.querySelector('.tg');
      if (t) t.textContent = g.classList.contains('fold') ? '펼치기' : '접기';
    }));

    ROOT.querySelector('[data-run]').addEventListener('click', () => { syncKo(); run(); });
    ROOT.querySelector('[data-reset]').addEventListener('click', () => {
      allFields().forEach(f => {
        const el = ROOT.querySelector('[data-k="' + f.k + '"]');
        if (!el) return;
        if (f.type === 'select') el.value = f.def || f.options[0].v;
        else el.value = (f.def !== undefined && f.def !== null) ? comma(f.def) : '';
      });
      ROOT.querySelectorAll('.fld').forEach(e => e.classList.remove('bad'));
      syncKo();
      ROOT.querySelector('[data-res]').innerHTML = placeholder();
    });

    syncKo();
  }

  global.JarviaCalcUI = { mount, korMoney, fmt };
})(typeof window !== 'undefined' ? window : globalThis);
