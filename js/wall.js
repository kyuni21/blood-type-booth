// 결과 월 화면: 혈액형 탭 집계, 한국인 평균 비교, PIN으로 여는 스태프 패널
(function () {
  const G = window.Genetics;
  const S = window.Store;
  const $ = (sel) => document.querySelector(sel);
  const pct = (x) => Math.round(x * 100) + '%';
  const badge = (t) => `<span class="badge t-${t}">${t}형</span>`;
  const UNDO_MS = 5000;

  const state = { view: 'today', last: null, staff: false, pinError: false };
  let undoTimer = null;

  function counts(view) {
    const w = S.wall();
    if (view === 'today') return w[S.today()] || { A: 0, B: 0, AB: 0, O: 0 };
    return Object.keys(w).reduce((acc, d) => {
      G.PHENOTYPES.forEach((p) => { acc[p] += w[d][p]; });
      return acc;
    }, { A: 0, B: 0, AB: 0, O: 0 });
  }

  function bars(c, total) {
    return `<div class="bars">${G.PHENOTYPES.map((p) => {
      const v = total ? c[p] / total : 0;
      return `<div class="bar-row">
        <div>${badge(p)}</div>
        <div class="bar-track">
          <div class="bar-fill t-${p}" style="width:${(v * 100).toFixed(1)}%"></div>
          <div class="bar-mark" style="left:calc(${(G.KOREAN_PHENO[p] * 100).toFixed(1)}% - 2px)"></div>
        </div>
        <div class="bar-val">${total ? pct(v) : '–'} <span class="muted" style="font-size:14px">${c[p]}명</span></div>
      </div>`;
    }).join('')}</div>`;
  }

  function insight(c, total) {
    if (total < 10) return '<p class="muted">10명이 넘으면 우리 부스의 특징을 알려 줄게요.</p>';
    const top = G.PHENOTYPES.slice().sort((a, b) => c[b] - c[a])[0];
    const diffs = G.PHENOTYPES.map((p) => ({ p, d: c[p] / total - G.KOREAN_PHENO[p] }));
    const most = diffs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    return `<p>우리 부스에서 가장 많은 혈액형은 ${badge(top)}이에요.
      우리나라 평균과 비교하면 ${badge(most.p)}이 ${Math.abs(Math.round(most.d * 100))}%p ${most.d > 0 ? '더 많아요' : '더 적어요'}.
      <span class="muted">사람이 많아질수록 평균에 가까워질까요?</span></p>`;
  }

  function mainView() {
    const c = counts(state.view);
    const total = G.PHENOTYPES.reduce((s, p) => s + c[p], 0);
    return `
      <h1 class="center">오늘 연구원들의 혈액형은?</h1>
      <p class="center muted">탐구를 마쳤다면 내 혈액형을 눌러 주세요! (모르면 안 눌러도 돼요)</p>
      <div class="vote">${G.PHENOTYPES.map((p) => `<button class="t-${p}" data-act="vote" data-p="${p}">${p}형</button>`).join('')}</div>
      <div class="thanks">${state.last ? `${state.last}형 한 표, 고마워요! 🎉 <button class="btn small" data-act="undo" style="margin-left:8px">잘못 눌렀어요</button>` : ''}</div>
      <div class="card">
        <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:14px">
          <div><div class="muted">${state.view === 'today' ? '오늘' : '3일 누적'} 참가 연구원</div><div class="big-num">${total}<span style="font-size:24px">명</span></div></div>
          <div class="tabs" style="margin-left:auto">
            <button class="tab ${state.view === 'today' ? 'on' : ''}" data-act="view" data-v="today">오늘</button>
            <button class="tab ${state.view === 'all' ? 'on' : ''}" data-act="view" data-v="all">전체 누적</button>
          </div>
        </div>
        ${bars(c, total)}
        <p class="legend">막대 = 우리 부스 연구원들<span class="mk"></span>검은 선 = 우리나라 평균 (A 34% · O 28% · B 27% · AB 11%)</p>
        ${insight(c, total)}
      </div>`;
  }

  function staffLogin() {
    return `<div class="overlay"><div class="box">
      <h2>스태프 확인</h2>
      <p class="muted">PIN 4자리를 입력하세요.</p>
      <input id="pin" class="name-input" inputmode="numeric" type="password" maxlength="8" autocomplete="off">
      ${state.pinError ? '<div class="feedback bad">PIN이 달라요.</div>' : ''}
      <div class="actions" style="justify-content:center">
        <button class="btn" data-act="closeStaff">취소</button>
        <button class="btn primary" data-act="login">확인</button>
      </div></div></div>`;
  }

  function staffPanel() {
    const w = S.wall();
    const days = Object.keys(w).sort();
    const q = S.quizStats();
    const rate = (n) => q.done ? pct(n / q.done) : '–';
    const avg = (arr) => q.done ? (arr.reduce((s, n) => s + n, 0) / q.done).toFixed(2) : '–';
    return `
      <h2>⚙︎ 스태프 패널</h2>
      <p class="muted">아래 기록은 <b>이 기기</b>에만 저장돼요. 와이파이가 없어서 기기끼리 합쳐지지 않으니, 행사 후 기기별 숫자를 더해 주세요.</p>
      <div class="card">
        <h3>결과 월 집계 (일자별)</h3>
        ${days.length ? `<table class="stats"><tr><th>날짜</th>${G.PHENOTYPES.map((p) => `<th>${p}</th>`).join('')}<th>합계</th></tr>
          ${days.map((d) => `<tr><td>${d}</td>${G.PHENOTYPES.map((p) => `<td>${w[d][p]}</td>`).join('')}<td><b>${G.PHENOTYPES.reduce((s, p) => s + w[d][p], 0)}</b></td></tr>`).join('')}
        </table>` : '<p class="muted">아직 기록이 없어요.</p>'}
        <div class="actions">
          <button class="btn small" data-act="resetToday">오늘 집계 지우기</button>
          <button class="btn small" data-act="resetAll">전체 집계 지우기</button>
        </div>
      </div>
      <div class="card">
        <h3>사전·사후 퀴즈 효과 (이 기기)</h3>
        <p>최종 시험까지 마친 연구원 <b>${q.done}명</b> · 평균 점수 <b>${avg(q.pre)}점 → ${avg(q.post)}점</b> (3점 만점)</p>
        <table class="stats"><tr><th>문항</th><th>사전 정답률</th><th>사후 정답률</th></tr>
          ${[0, 1, 2].map((i) => `<tr><td>${i + 1}번</td><td>${rate(q.pre[i])}</td><td>${rate(q.post[i])}</td></tr>`).join('')}
        </table>
        <div class="actions"><button class="btn small" data-act="resetQuiz">퀴즈 기록 지우기</button></div>
      </div>
      <div class="card">
        <h3>PIN 바꾸기</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input id="newPin" class="name-input" style="max-width:200px" inputmode="numeric" maxlength="8" placeholder="새 PIN">
          <button class="btn small" data-act="setPin">저장</button>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" data-act="closeStaff">결과 월로 돌아가기</button>
        <a class="btn" href="index.html" style="text-decoration:none">참가자 앱 열기</a>
      </div>`;
  }

  function render() {
    $('#who').textContent = S.today();
    $('#app').innerHTML = state.staff === 'open' ? staffPanel() : mainView();
    $('#overlay').innerHTML = state.staff === 'login' ? staffLogin() : '';
    if (state.staff === 'login') {
      const pin = $('#pin');
      pin.focus();
      pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') actions.login(); });
    }
  }

  const confirmThen = (msg, fn) => { if (window.confirm(msg)) { fn(); render(); } };

  const actions = {
    vote(d) {
      S.addVote(d.p, 1);
      state.last = d.p;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => { state.last = null; render(); }, UNDO_MS);
      render();
    },
    undo() {
      if (state.last) S.addVote(state.last, -1);
      state.last = null;
      clearTimeout(undoTimer);
      render();
    },
    view(d) { state.view = d.v; render(); },
    staff() { state.staff = 'login'; state.pinError = false; render(); },
    login() {
      if (($('#pin').value || '') === S.pin()) { state.staff = 'open'; state.pinError = false; }
      else state.pinError = true;
      render();
    },
    closeStaff() { state.staff = false; render(); },
    resetToday() { confirmThen('오늘 집계를 지울까요?', S.resetWallToday); },
    resetAll() { confirmThen('3일 전체 집계를 지울까요? 되돌릴 수 없어요.', S.resetWallAll); },
    resetQuiz() { confirmThen('이 기기의 퀴즈 기록을 지울까요? 되돌릴 수 없어요.', S.resetQuiz); },
    setPin() {
      const v = ($('#newPin').value || '').trim();
      if (!/^\d{4,8}$/.test(v)) return window.alert('PIN은 숫자 4~8자리로 정해 주세요.');
      S.setPin(v);
      window.alert('PIN을 바꿨어요.');
    }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el.dataset, el);
  });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
})();
