// 참가자 화면 흐름 (홈 → 사전 퀴즈 → 미션 5개 → 사후 퀴즈 → 인증서)과 자동 초기화
(function () {
  const G = window.Genetics;
  const S = window.Store;
  const IDLE_MS = 90 * 1000;
  const IDLE_COUNTDOWN = 10;

  const QUIZ = [
    { q: 'A형(AO) 엄마와 B형(BO) 아빠 사이에서 O형 아기가 태어날 수 있다.', a: true,
      why: '엄마의 O와 아빠의 O를 하나씩 받으면 OO, 즉 O형이에요. 확률은 4칸 중 1칸, 25%예요.' },
    { q: 'A형인 사람의 유전자형은 항상 AA이다.', a: false,
      why: 'A가 O보다 우성이라 AO도 겉으로는 A형이에요. 우리나라 A형 10명 중 약 8명은 AO예요.' },
    { q: '부모가 둘 다 A형이면 아기는 반드시 A형이다.', a: false,
      why: '두 분 다 AO라면 O를 하나씩 물려줘서 O형 아기가 태어날 수 있어요(25%).' }
  ];

  const MISSIONS = [
    { id: 'lab', icon: '🔬', title: '판정 랩', desc: '모의 혈액으로 아기 4명의 혈액형을 판정하라' },
    { id: 'reason', icon: '🧬', title: '추리 룸', desc: '내 혈액형 속 유전자는 AA일까, AO일까?' },
    { id: 'puzzle', icon: '🧩', title: '가족 퍼즐', desc: '펀넷 사각형으로 아기 혈액형 예측하기' },
    { id: 'case', icon: '🚨', title: '사건 파일', desc: '산부인과에서 바뀐 아기를 찾아라' },
    { id: 'sim', icon: '🎲', title: '확률 실험실', desc: '가상 아기 1,000명을 태어나게 해 보자' }
  ];

  const PUNNETT_POOL = [['AO', 'BO'], ['AO', 'AO'], ['AB', 'OO'], ['AB', 'AO'], ['BO', 'OO'], ['AA', 'BO'], ['AB', 'AB'], ['BO', 'BO']];
  const CYCLE = [null, 'A', 'B', 'AB', 'O'];

  let state;

  function fresh() {
    return {
      screen: 'home',
      name: '',
      pre: [null, null, null],
      post: [null, null, null],
      quizRecorded: false,
      stamps: {},
      lab: { active: 0, babies: [0, 1, 2, 3].map(() => ({ antiA: null, antiB: null, antiD: null })) },
      reason: { my: null, assistant: false, mom: null, dad: null },
      puzzle: newPuzzle(),
      kase: { sel: null, assign: {}, checked: false },
      sim: { g1: 'AO', g2: 'BO', counts: { A: 0, B: 0, AB: 0, O: 0 }, recent: [] }
    };
  }

  // ---------- 공통 도우미 ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const pct = (x) => Math.round(x * 100) + '%';
  const badge = (t) => t ? `<span class="badge t-${t}">${t}형</span>` : '<span class="badge t-none">?</span>';
  const gtLabel = (g) => `${g} (${G.phenotypeOf(g)}형)`;
  const stampCount = () => MISSIONS.filter((m) => state.stamps[m.id]).length;

  function go(screen) {
    state.screen = screen;
    render();
    window.scrollTo(0, 0);
  }

  function backBar() {
    return `<div class="actions" style="margin-top:0"><button class="btn small" data-act="go" data-to="map">← 수사 지도</button></div>`;
  }

  function bars(rows) {
    // rows: [{ type, value(0~1), mark(0~1|undefined), label }]
    return `<div class="bars">${rows.map((r) => `
      <div class="bar-row">
        <div>${badge(r.type)}</div>
        <div class="bar-track">
          <div class="bar-fill t-${r.type}" style="width:${(r.value * 100).toFixed(1)}%"></div>
          ${r.mark !== undefined ? `<div class="bar-mark" style="left:calc(${(r.mark * 100).toFixed(1)}% - 2px)"></div>` : ''}
        </div>
        <div class="bar-val">${r.label}</div>
      </div>`).join('')}</div>`;
  }

  // ---------- 화면 ----------
  const screens = {
    home() {
      return `
        <section class="hero">
          <div class="emoji">🕵️🩸</div>
          <h1>혈액형 탐정단</h1>
          <p class="muted">혈액형 속에 숨은 유전 법칙을 수사하라!</p>
        </section>
        <div class="card center">
          <h3>탐정 이름을 정해 주세요</h3>
          <p class="muted">진짜 이름 말고 별명도 좋아요. 이름은 저장되지 않아요.</p>
          <input id="name" class="name-input" maxlength="10" placeholder="예) 셜록 홈즈" autocomplete="off">
          <div class="actions" style="justify-content:center">
            <button class="btn primary" data-act="start">수사 시작 →</button>
          </div>
        </div>
        <p class="center"><a href="wall.html" class="muted" style="font-size:14px">스태프 · 결과 월</a></p>`;
    },

    pre() { return quizScreen('pre'); },
    post() { return quizScreen('post'); },

    map() {
      const n = stampCount();
      return `
        <h2>${esc(state.name)} 탐정의 수사 지도</h2>
        <p class="muted">순서대로 해도 되고, 원하는 미션부터 해도 돼요. 완료한 미션 ${n} / ${MISSIONS.length}</p>
        <div class="mission-grid">
          ${MISSIONS.map((m, i) => `
            <button class="mission ${state.stamps[m.id] ? 'done' : ''}" data-act="go" data-to="${m.id}">
              <div class="num">미션 ${i + 1}</div>
              <div class="title">${m.icon} ${m.title}</div>
              <div class="desc">${m.desc}</div>
              ${state.stamps[m.id] ? '<div class="stamp">해결!</div>' : ''}
            </button>`).join('')}
        </div>
        <div class="card tip center">
          <h3>🏅 최종 시험</h3>
          <p>미션을 마쳤다면 처음에 풀었던 퀴즈를 다시 풀어 보세요. 얼마나 달라졌을까요?</p>
          <button class="btn gold" data-act="go" data-to="post">최종 시험 보기</button>
        </div>`;
    },

    lab() {
      const L = state.lab, i = L.active, b = L.babies[i];
      const res = labResult(i);
      const well = (key, label) => {
        const v = b[key];
        const cls = v === null ? 'unset' : v ? 'clumped' : '';
        return `
          <div class="well ${cls}">
            <div class="label">${label}</div>
            <div class="drop"></div>
            <div class="state">${v === null ? '아직 안 봤어요' : v ? '엉겼어요 (응집)' : '그대로예요'}</div>
            <div class="chips" style="justify-content:center;margin-top:8px">
              <button class="chip ${v === true ? 'on' : ''}" style="font-size:16px;min-width:0" data-act="well" data-k="${key}" data-v="1">엉김</button>
              <button class="chip ${v === false ? 'on' : ''}" style="font-size:16px;min-width:0" data-act="well" data-k="${key}" data-v="0">그대로</button>
            </div>
          </div>`;
      };
      const allDone = labTypes().every(Boolean);
      return `
        ${backBar()}
        <h2>🔬 미션 1 · 판정 랩</h2>
        <div class="card tip">
          <b>방법</b> 아기 시료에 항A · 항B · 항D(Rh) 시약을 한 방울씩 떨어뜨리고 저어 주세요.
          피가 알갱이처럼 <b>엉기면(응집)</b> "엉김", 매끈하게 그대로면 "그대로"를 눌러요.
        </div>
        <div class="tabs">
          ${L.babies.map((_, k) => `<button class="tab ${k === i ? 'on' : ''}" data-act="labTab" data-i="${k}">👶 아기 ${k + 1} ${labTypes()[k] ? badge(labTypes()[k]) : ''}</button>`).join('')}
        </div>
        <div class="wells">
          ${well('antiA', '항A 시약')}${well('antiB', '항B 시약')}${well('antiD', '항D 시약')}
        </div>
        ${res ? `<div class="card"><h3>아기 ${i + 1}의 혈액형은 ${badge(res.abo)} Rh${res.rh}</h3>${labExplain(res, b)}</div>` : ''}
        <div class="actions">
          ${i < 3 ? `<button class="btn" data-act="labTab" data-i="${i + 1}" ${res ? '' : 'disabled'}>다음 아기 →</button>` : ''}
          <button class="btn primary" data-act="labDone" ${allDone ? '' : 'disabled'}>판정 완료</button>
          <button class="btn small" data-act="labExample">키트 없이 예시 결과로 하기</button>
        </div>`;
    },

    reason() {
      const R = state.reason;
      let body = '';
      if (R.my) {
        const base = G.genotypesOf(R.my);
        const filtered = G.myGenotypeCandidates(R.my, R.mom, R.dad);
        const usingParents = R.mom || R.dad;
        const cands = usingParents ? filtered : base;
        body = `
          <div class="card">
            <h3>${R.assistant ? '조수의' : '내'} 혈액형 ${badge(R.my)} 속 유전자 후보</h3>
            <div>${base.map((g) => `<span class="gene" style="${cands.indexOf(g) < 0 ? 'opacity:.25;text-decoration:line-through' : ''}">${g}</span>`).join(' 또는 ')}</div>
            <p>${reasonExplain(R.my)}</p>
          </div>
          ${base.length > 1 ? `<div class="card tip">💡 <b>알고 있나요?</b> 우리나라 ${R.my}형인 사람 10명 중 약 <b>${Math.round(G.genotypeWeights(R.my)[R.my + 'O'] * 10)}명</b>은 ${R.my}O예요. O 유전자를 가진 사람이 생각보다 많아요!</div>` : ''}
          ${R.assistant ? '' : parentSection(R, cands, usingParents)}
          <div class="actions end"><button class="btn primary" data-act="reasonDone">추리 완료</button></div>`;
      }
      return `
        ${backBar()}
        <h2>🧬 미션 2 · 추리 룸</h2>
        <p>혈액형은 엄마와 아빠에게서 받은 <b>유전자 두 개</b>로 정해져요. 유전자는 A, B, O 세 종류예요.</p>
        <div class="card">
          <h3>내 혈액형은?</h3>
          <div class="chips">
            ${G.PHENOTYPES.map((p) => `<button class="chip t-${p} ${R.my === p && !R.assistant ? 'on' : ''}" data-act="reasonMy" data-p="${p}">${p}형</button>`).join('')}
            <button class="chip ${R.assistant ? 'on' : ''}" style="font-size:18px" data-act="reasonUnknown">몰라요</button>
          </div>
          ${R.assistant ? '<p class="muted">괜찮아요! 오늘은 A형 조수 "혈액이"의 유전자를 추리해 봐요.</p>' : ''}
        </div>
        ${body}`;
    },

    puzzle() {
      const P = state.puzzle, prob = P.probs[P.round];
      const head = `${backBar()}<h2>🧩 미션 3 · 가족 퍼즐 <span class="muted" style="font-size:18px">${P.round + 1} / ${P.probs.length}</span></h2>`;
      if (prob.kind === 'punnett') return head + punnettView(P, prob);
      return head + reverseView(P, prob);
    },

    case() {
      const types = labTypes();
      if (!state.stamps.lab) {
        return `${backBar()}<h2>🚨 미션 4 · 사건 파일</h2>
          <div class="card warn"><h3>증거가 필요해요!</h3>
          <p>먼저 판정 랩에서 아기 4명의 혈액형을 판정해 주세요.</p>
          <div class="actions"><button class="btn primary" data-act="go" data-to="lab">판정 랩으로 가기</button>
          <button class="btn small" data-act="caseExample">예시 결과로 진행</button></div></div>`;
      }
      const K = state.kase;
      const solvable = G.solveCase(types).length > 0;
      const assignedBabies = Object.values(K.assign);
      const allAssigned = G.COUPLES.every((c) => K.assign[c.id] !== undefined);
      const allRight = K.checked && G.COUPLES.every((c) => G.canBeChildOf(c, types[K.assign[c.id]]));
      return `
        ${backBar()}
        <h2>🚨 미션 4 · 사건 파일</h2>
        <div class="card tip">
          <b>사건 개요</b> 새벽에 신생아실 아기들의 이름표가 모두 떨어졌다!
          판정 랩에서 알아낸 혈액형을 증거로 아기를 부모에게 돌려보내자.
          <br><span class="muted">아기를 누른 다음 부부 카드를 누르세요. 힌트는 가능한 혈액형이 딱 하나뿐인 부부부터!</span>
        </div>
        ${solvable ? '' : '<div class="feedback bad">판정 결과로는 짝이 맞지 않아요. 같은 혈액형이 두 명 있지 않나요? 판정 랩에서 다시 확인해 보세요.</div>'}
        <h3 style="margin-top:16px">👶 아기들</h3>
        <div class="babies">
          ${types.map((t, i) => `<button class="baby ${K.sel === i ? 'sel' : ''} ${assignedBabies.indexOf(i) >= 0 ? 'used' : ''}" data-act="caseBaby" data-i="${i}"><div class="face">👶</div>아기 ${i + 1} ${badge(t)}</button>`).join('')}
        </div>
        <h3 style="margin-top:18px">👪 부부들</h3>
        <div class="couples">
          ${G.COUPLES.map((c) => {
            const bi = K.assign[c.id];
            const st = K.checked && bi !== undefined ? (G.canBeChildOf(c, types[bi]) ? 'right' : 'wrong') : '';
            return `<button class="couple ${st}" data-act="caseCouple" data-c="${c.id}" style="text-align:left">
              <b>${c.name}</b><br>엄마 ${badge(c.parents[0])} · 아빠 ${badge(c.parents[1])}
              <div class="slot">${bi !== undefined ? `👶 아기 ${bi + 1} ${badge(types[bi])}` : '여기에 아기를'}</div>
              ${st === 'wrong' ? `<div style="font-size:15px;margin-top:6px;color:var(--bad)">이 부부의 아기는 ${G.possibleChildPhenotypes(c.parents[0], c.parents[1]).map((p) => p + '형').join(', ')}만 가능해요.</div>` : ''}
            </button>`;
          }).join('')}
        </div>
        ${allRight ? `<div class="feedback ok">🎉 사건 해결! 모든 아기가 부모 품으로 돌아갔어요.</div>
          <div class="actions end"><button class="btn primary" data-act="go" data-to="map">수사 지도로</button></div>`
          : `<div class="actions end"><button class="btn primary" data-act="caseCheck" ${allAssigned ? '' : 'disabled'}>판결 내리기</button></div>`}`;
    },

    sim() {
      const M = state.sim, total = M.counts.A + M.counts.B + M.counts.AB + M.counts.O;
      const dist = G.childPhenotypeDist(M.g1, M.g2);
      const geneChips = (who) => `<div class="chips">${G.GENOTYPES.map((g) => `<button class="chip ${M[who] === g ? 'on' : ''}" style="font-size:18px" data-act="simParent" data-w="${who}" data-g="${g}">${gtLabel(g)}</button>`).join('')}</div>`;
      return `
        ${backBar()}
        <h2>🎲 미션 5 · 확률 실험실</h2>
        <p>엄마와 아빠는 각자 유전자 두 개 중 <b>하나를 무작위로</b> 아기에게 물려줘요. 아기가 많이 태어나면 어떻게 될까요?</p>
        <div class="grid-2">
          <div class="card"><h3>👩 엄마 유전자형</h3>${geneChips('g1')}</div>
          <div class="card"><h3>👨 아빠 유전자형</h3>${geneChips('g2')}</div>
        </div>
        <div class="card">
          <h3>태어난 아기 <span style="font-size:28px">${total.toLocaleString()}</span>명</h3>
          <div class="dots">${M.recent.map((t) => `<span class="dot t-${t}"></span>`).join('')}</div>
          ${bars(G.PHENOTYPES.map((p) => ({ type: p, value: total ? M.counts[p] / total : 0, mark: dist[p], label: `${total ? pct(M.counts[p] / total) : '–'} <span class="muted" style="font-size:14px">/ 이론 ${pct(dist[p])}</span>` })))}
          <p class="legend">막대 = 실제로 태어난 비율<span class="mk"></span>검은 선 = 펀넷 사각형으로 계산한 확률</p>
          <div class="actions">
            ${[1, 10, 100, 1000].map((n) => `<button class="btn ${n === 1000 ? 'primary' : ''}" data-act="simRun" data-n="${n}">+${n.toLocaleString()}명</button>`).join('')}
            <button class="btn small" data-act="simReset">다시</button>
          </div>
          ${total >= 100 ? '<div class="feedback ok">아기가 많아질수록 막대가 검은 선에 가까워져요. 이것이 <b>큰 수의 법칙</b>! 확률은 "많이 반복했을 때의 비율"이에요.</div>' : total > 0 ? '<p class="muted">몇 명만 태어나면 들쭉날쭉해요. 100명 이상 태어나게 해 보세요.</p>' : ''}
        </div>
        <div class="card tip">🫘 책상 위 <b>구슬 주머니</b>로도 해 보세요. 엄마 주머니, 아빠 주머니에서 구슬을 하나씩 뽑으면 아기 한 명이에요.</div>
        ${state.stamps.sim ? '<div class="actions end"><button class="btn primary" data-act="go" data-to="map">수사 지도로</button></div>' : ''}`;
    },

    cert() {
      const preScore = state.pre.filter((v, i) => v === QUIZ[i].a).length;
      const postScore = state.post.filter((v, i) => v === QUIZ[i].a).length;
      const n = stampCount();
      return `
        <div class="certificate">
          <div style="font-size:56px">🏅</div>
          <div class="muted">혈액형 유전 수사 인증서</div>
          <div class="name">${esc(state.name)} 탐정</div>
          <p>해결한 미션 <b>${n} / ${MISSIONS.length}</b> · 퀴즈 <b>${preScore}점 → ${postScore}점</b></p>
          <p class="muted">이 화면을 스태프에게 보여 주고 스티커를 받으세요!<br>나가는 길에 결과 월에서 내 혈액형도 눌러 주세요.</p>
        </div>
        <div class="card">
          <h3>퀴즈 정답과 해설</h3>
          ${QUIZ.map((q, i) => `
            <div class="quiz-q" style="display:block">
              <div><b>${i + 1}. ${q.q}</b> → 정답 <b>${q.a ? 'O' : 'X'}</b>
                <span class="muted" style="font-size:15px">(처음 ${state.pre[i] === q.a ? '✔' : '✘'} · 마지막 ${state.post[i] === q.a ? '✔' : '✘'})</span></div>
              <div class="muted">${q.why}</div>
            </div>`).join('')}
        </div>
        ${n === MISSIONS.length ? `
          <div class="card warn">
            <h3>🔓 히든 파일 · 법칙이 틀렸다?</h3>
            <p>O형 엄마와 AB형 아빠 사이에서 <b>AB형 아기</b>가 태어난 사례가 있어요. 멘델 법칙으로는 불가능한데, 왜일까요?</p>
            <p><b>cis-AB형</b> 하나의 염색체에 A와 B 성질이 함께 들어 있는 드문 유전자예요. 그래서 부모 한 명이 A와 B를 한꺼번에 물려줄 수 있어요. 우리나라와 일본에서 비교적 많이 보고돼요.</p>
            <p><b>봄베이형</b> A·B 응집원을 만드는 바탕 물질(H 항원)이 없어서 유전자는 A나 B인데도 검사하면 O형처럼 나와요.</p>
            <p class="muted">그래서 과학자들은 "드문 조합"을 만나면 바로 결론 내리지 않고 판정 오차, 희귀 유전자 같은 다른 가능성부터 조사해요. 법칙에도 예외가 있다는 것, 그게 과학이에요.</p>
          </div>` : `<div class="card center muted">🔒 미션 5개를 모두 해결하면 히든 파일이 열려요.</div>`}
        <div class="actions" style="justify-content:center">
          <button class="btn" data-act="go" data-to="map">수사 지도로</button>
          <button class="btn primary" data-act="reset">다음 탐정에게 넘기기</button>
        </div>`;
    }
  };

  // ---------- 화면 조각 ----------
  function quizScreen(phase) {
    const ans = state[phase];
    const ready = ans.every((v) => v !== null);
    return `
      ${phase === 'post' ? backBar() : ''}
      <h2>${phase === 'pre' ? '📝 수사 전 실력 점검' : '🏅 최종 시험'}</h2>
      <p class="muted">${phase === 'pre' ? '맞으면 O, 틀리면 X! 정답은 수사가 끝나면 알려 줄게요.' : '처음에 풀었던 문제예요. 이번엔 맞힐 수 있을까요?'}</p>
      <div class="card">
        ${QUIZ.map((q, i) => `
          <div class="quiz-q">
            <div class="q">${i + 1}. ${q.q}</div>
            <div class="chips">
              <button class="chip ${ans[i] === true ? 'on' : ''}" data-act="quiz" data-ph="${phase}" data-i="${i}" data-v="1">O</button>
              <button class="chip ${ans[i] === false ? 'on' : ''}" data-act="quiz" data-ph="${phase}" data-i="${i}" data-v="0">X</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="actions end">
        <button class="btn primary" data-act="quizSubmit" data-ph="${phase}" ${ready ? '' : 'disabled'}>${phase === 'pre' ? '제출하고 미션 시작 →' : '제출하고 인증서 받기 →'}</button>
      </div>`;
  }

  function labResult(i) {
    const b = state.lab.babies[i];
    if (b.antiA === null || b.antiB === null || b.antiD === null) return null;
    return G.bloodTypeFromReactions(b);
  }
  function labTypes() { return [0, 1, 2, 3].map((i) => { const r = labResult(i); return r ? r.abo : null; }); }

  function labExplain(res) {
    const abo = {
      A: '항A 시약에만 엉겼어요 → 적혈구 표면에 <b>A 응집원</b>이 있어요 → A형',
      B: '항B 시약에만 엉겼어요 → 적혈구 표면에 <b>B 응집원</b>이 있어요 → B형',
      AB: '항A, 항B 둘 다 엉겼어요 → <b>A와 B 응집원</b>이 모두 있어요 → AB형',
      O: '항A, 항B 둘 다 그대로예요 → A, B 응집원이 <b>없어요</b> → O형'
    }[res.abo];
    const rh = res.rh === '+' ? '항D 시약에 엉겼어요 → D 항원이 있어요 → Rh+' : '항D 시약에 그대로예요 → D 항원이 없어요 → Rh− (우리나라에서는 아주 드물어요)';
    return `<p>${abo}</p><p>${rh}</p>`;
  }

  function reasonExplain(p) {
    return {
      A: 'A는 O보다 <b>우성</b>이라 AA여도, AO여도 겉으로는 A형이에요. 겉모습(표현형)만으로는 어느 쪽인지 알 수 없어요!',
      B: 'B는 O보다 <b>우성</b>이라 BB여도, BO여도 겉으로는 B형이에요. 겉모습(표현형)만으로는 어느 쪽인지 알 수 없어요!',
      AB: 'A와 B는 서로 힘이 같아서(<b>공동 우성</b>) 둘 다 나타나요. AB형은 유전자형이 AB 하나뿐이에요.',
      O: 'O는 <b>열성</b>이라 O 유전자가 두 개(OO)일 때만 O형이 돼요. O형은 유전자형이 확실해요.'
    }[p];
  }

  function parentSection(R, cands, usingParents) {
    const row = (who, label) => `
      <div style="margin:8px 0"><b>${label}</b>
        <div class="chips" style="margin-top:6px">
          ${G.PHENOTYPES.map((p) => `<button class="chip t-${p} ${R[who] === p ? 'on' : ''}" style="font-size:18px" data-act="reasonParent" data-w="${who}" data-p="${p}">${p}형</button>`).join('')}
          <button class="chip ${R[who] === null ? 'on' : ''}" style="font-size:18px" data-act="reasonParent" data-w="${who}" data-p="">모름</button>
        </div>
      </div>`;
    let result = '';
    if (usingParents) {
      if (!cands.length) {
        result = `<div class="feedback bad" style="color:var(--ink);background:#fff3f0">이 조합은 아주 <b>드문 조합</b>이에요. 판정 오차, 기억이 다른 경우, cis-AB형이나 봄베이형 같은 희귀 혈액형 등 여러 이유가 있을 수 있어요. 미션을 모두 마치면 히든 파일에서 자세히 알려 줄게요!</div>`;
      } else if (cands.length === 1 && G.genotypesOf(R.my).length > 1) {
        result = `<div class="feedback ok">수사 성공! 부모님 혈액형으로 보면 ${R.assistant ? '' : '내'} 유전자형은 <b>${cands[0]}</b>(으)로 좁혀져요.</div>`;
      } else {
        result = `<p class="muted">부모님 혈액형만으로는 아직 하나로 정할 수 없어요.</p>`;
      }
    }
    return `
      <div class="card">
        <h3>부모님 혈액형으로 더 좁혀 볼까요? <span class="muted" style="font-size:16px">(선택)</span></h3>
        <p class="muted" style="font-size:15px">입력한 가족 정보는 저장되지 않아요. 잘 모르면 "모름"으로 두고 넘어가도 돼요.</p>
        ${row('mom', '엄마')}${row('dad', '아빠')}
        ${result}
      </div>`;
  }

  function newPuzzle() {
    const pairs = shuffle(PUNNETT_POOL).slice(0, 2);
    return {
      round: 0,
      probs: [
        { kind: 'punnett', g1: pairs[0][0], g2: pairs[0][1] },
        { kind: 'punnett', g1: pairs[1][0], g2: pairs[1][1] },
        newReverse(),
        newReverse()
      ],
      cells: [[null, null], [null, null]],
      sel: [],
      checked: false
    };
  }

  function newReverse() {
    for (;;) {
      const mom = pick(G.PHENOTYPES), child = pick(G.PHENOTYPES);
      const ans = G.possibleParentPhenotypes(mom, child);
      if (ans.length > 0 && ans.length < 4) return { kind: 'reverse', mom, child, ans };
    }
  }

  function punnettView(P, prob) {
    const sq = G.punnett(prob.g1, prob.g2);
    const allFilled = P.cells.every((r) => r.every(Boolean));
    let right = 0;
    const cell = (r, c) => {
      const v = P.cells[r][c], g = sq.cells[r][c], ans = G.phenotypeOf(g);
      let cls = '', sub = '';
      if (P.checked) {
        cls = v === ans ? 'right' : 'wrong';
        if (v === ans) right++;
        sub = `<small>${g}${v === ans ? '' : ' → ' + ans + '형'}</small>`;
      }
      return `<td><button class="cell ${cls}" data-act="cell" data-r="${r}" data-c="${c}">${v ? v + '형' : '?'}${sub}</button></td>`;
    };
    const rows = [0, 1].map((r) => `<tr><th class="p1">${sq.rows[r]}</th>${cell(r, 0)}${cell(r, 1)}</tr>`).join('');
    const dist = G.childPhenotypeDist(prob.g1, prob.g2);
    return `
      <div class="card">
        <h3>👩 엄마 <span class="gene">${prob.g1}</span> × 👨 아빠 <span class="gene">${prob.g2}</span></h3>
        <p class="muted">왼쪽 글자(엄마) 하나 + 위쪽 글자(아빠) 하나 = 아기가 받는 유전자 두 개. 칸을 눌러 아기 혈액형을 고르세요.</p>
        <table class="punnett">
          <tr><th></th><th class="p2">${sq.cols[0]}</th><th class="p2">${sq.cols[1]}</th></tr>
          ${rows}
        </table>
        ${P.checked ? `
          <div class="feedback ${right === 4 ? 'ok' : 'bad'}">${right === 4 ? '완벽해요! 🎉' : `4칸 중 ${right}칸 정답. 빨간 칸의 정답을 확인해 보세요.`}</div>
          <p>한 칸 = 25%. 이 부부의 아기는 ${G.PHENOTYPES.filter((p) => dist[p] > 0).map((p) => `${badge(p)} ${pct(dist[p])}`).join(' · ')}</p>
          <div class="actions end"><button class="btn primary" data-act="puzzleNext">${P.round < P.probs.length - 1 ? '다음 문제 →' : '퍼즐 완료'}</button></div>`
        : `<div class="actions end"><button class="btn primary" data-act="puzzleCheck" ${allFilled ? '' : 'disabled'}>채점하기</button></div>`}
      </div>`;
  }

  function reverseView(P, prob) {
    const chip = (p) => {
      let style = '';
      if (P.checked) {
        const inAns = prob.ans.indexOf(p) >= 0;
        style = inAns ? 'box-shadow:0 0 0 4px var(--ok)' : '';
      }
      return `<button class="chip t-${p} ${P.sel.indexOf(p) >= 0 ? 'on' : ''}" style="${style}" data-act="revSel" data-p="${p}">${p}형</button>`;
    };
    const ok = P.checked && P.sel.slice().sort().join() === prob.ans.slice().sort().join();
    return `
      <div class="card">
        <h3>🔍 거꾸로 추리하기</h3>
        <p style="font-size:22px">엄마는 ${badge(prob.mom)}, 아기는 ${badge(prob.child)}예요.<br>아빠가 될 수 있는 혈액형을 <b>모두</b> 고르세요.</p>
        <div class="chips">${G.PHENOTYPES.map(chip).join('')}</div>
        <p class="muted" style="font-size:15px">힌트 · 아기는 엄마에게서 유전자 하나, 아빠에게서 유전자 하나를 받아요.</p>
        ${P.checked ? `
          <div class="feedback ${ok ? 'ok' : 'bad'}">${ok ? '정확해요! 🎉' : '아쉬워요!'} 가능한 아빠는 ${prob.ans.map((p) => p + '형').join(', ')}이에요. (초록 테두리)</div>
          <div class="actions end"><button class="btn primary" data-act="puzzleNext">${P.round < P.probs.length - 1 ? '다음 문제 →' : '퍼즐 완료'}</button></div>`
        : `<div class="actions end"><button class="btn primary" data-act="puzzleCheck" ${P.sel.length ? '' : 'disabled'}>채점하기</button></div>`}
      </div>`;
  }

  // ---------- 동작 ----------
  function fillLabExample() {
    const reactions = { A: [true, false], B: [false, true], AB: [true, true], O: [false, false] };
    state.lab.babies = shuffle(['A', 'B', 'AB', 'O']).map((t) => ({ antiA: reactions[t][0], antiB: reactions[t][1], antiD: true }));
    state.kase = { sel: null, assign: {}, checked: false };
  }

  const actions = {
    go(d) { go(d.to); },

    start() {
      const name = ($('#name').value || '').trim();
      state.name = name || '익명';
      go('pre');
    },

    quiz(d) {
      state[d.ph][+d.i] = d.v === '1';
      render();
    },

    quizSubmit(d) {
      if (d.ph === 'pre') return go('map');
      if (!state.quizRecorded) {
        S.recordQuiz(state.pre.map((v, i) => v === QUIZ[i].a), state.post.map((v, i) => v === QUIZ[i].a));
        state.quizRecorded = true;
      }
      go('cert');
    },

    labTab(d) { state.lab.active = +d.i; render(); },
    well(d) {
      state.lab.babies[state.lab.active][d.k] = d.v === '1';
      state.kase = { sel: null, assign: {}, checked: false };
      render();
    },
    labDone() { state.stamps.lab = true; go('map'); },
    labExample() { fillLabExample(); render(); },

    reasonMy(d) { Object.assign(state.reason, { my: d.p, assistant: false }); render(); },
    reasonUnknown() { Object.assign(state.reason, { my: 'A', assistant: true, mom: null, dad: null }); render(); },
    reasonParent(d) { state.reason[d.w] = d.p || null; render(); },
    reasonDone() { state.stamps.reason = true; go('map'); },

    cell(d) {
      const P = state.puzzle;
      if (P.checked) return;
      const cur = P.cells[+d.r][+d.c];
      P.cells[+d.r][+d.c] = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length] || 'A';
      render();
    },
    revSel(d) {
      const P = state.puzzle;
      if (P.checked) return;
      const i = P.sel.indexOf(d.p);
      if (i >= 0) P.sel.splice(i, 1); else P.sel.push(d.p);
      render();
    },
    puzzleCheck() { state.puzzle.checked = true; render(); },
    puzzleNext() {
      const P = state.puzzle;
      if (P.round >= P.probs.length - 1) {
        state.stamps.puzzle = true;
        state.puzzle = newPuzzle();
        return go('map');
      }
      Object.assign(P, { round: P.round + 1, cells: [[null, null], [null, null]], sel: [], checked: false });
      render();
    },

    caseExample() { fillLabExample(); state.stamps.lab = true; render(); },
    caseBaby(d) {
      const K = state.kase, i = +d.i;
      K.checked = false;
      K.sel = K.sel === i ? null : i;
      render();
    },
    caseCouple(d) {
      const K = state.kase;
      K.checked = false;
      if (K.sel === null) {
        delete K.assign[d.c];
      } else {
        // 이미 다른 부부에게 간 아기면 옮기기
        Object.keys(K.assign).forEach((c) => { if (K.assign[c] === K.sel) delete K.assign[c]; });
        K.assign[d.c] = K.sel;
        K.sel = null;
      }
      render();
    },
    caseCheck() {
      const K = state.kase, types = labTypes();
      K.checked = true;
      if (G.COUPLES.every((c) => G.canBeChildOf(c, types[K.assign[c.id]]))) state.stamps.case = true;
      render();
    },

    simParent(d) {
      const M = state.sim;
      M[d.w] = d.g;
      M.counts = { A: 0, B: 0, AB: 0, O: 0 };
      M.recent = [];
      render();
    },
    simRun(d) {
      const M = state.sim, n = +d.n;
      for (let i = 0; i < n; i++) {
        const c = G.simulate(M.g1, M.g2, 1);
        const t = G.PHENOTYPES.find((p) => c[p]);
        M.counts[t]++;
        M.recent.push(t);
      }
      M.recent = M.recent.slice(-60);
      if (M.counts.A + M.counts.B + M.counts.AB + M.counts.O >= 100) state.stamps.sim = true;
      render();
    },
    simReset() { state.sim.counts = { A: 0, B: 0, AB: 0, O: 0 }; state.sim.recent = []; render(); },

    reset() { state = fresh(); go('home'); },
    homeConfirm() {
      if (window.confirm('처음 화면으로 돌아갈까요? 지금까지의 수사 기록이 지워져요.')) actions.reset();
    },
    stayHere() { hideIdle(); }
  };

  // ---------- 렌더링 ----------
  function render() {
    $('#app').innerHTML = screens[state.screen]();
    const inGame = state.screen !== 'home';
    $('#who').textContent = inGame ? `${state.name} 탐정 · 미션 ${stampCount()}/${MISSIONS.length}` : '';
    $('#topActions').innerHTML = inGame
      ? `${state.screen !== 'map' && state.screen !== 'pre' ? '<button data-act="go" data-to="map">지도</button> ' : ''}<button data-act="homeConfirm">처음으로</button>`
      : '';
    if (state.screen === 'home') {
      const input = $('#name');
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') actions.start(); });
    }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el.dataset, el);
  });

  // ---------- 자동 초기화 (개인정보 보호·다음 참가자 대비) ----------
  let idleTimer = null, countdownTimer = null;

  function hideIdle() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    $('#overlay').innerHTML = '';
    armIdle();
  }

  function showIdle() {
    if (state.screen === 'home') return armIdle();
    let left = IDLE_COUNTDOWN;
    const draw = () => {
      $('#overlay').innerHTML = `<div class="overlay"><div class="box">
        <h2>아직 수사 중인가요?</h2>
        <div class="count">${left}</div>
        <p class="muted">아무것도 누르지 않으면 처음 화면으로 돌아가요.</p>
        <button class="btn primary" data-act="stayHere">계속할게요</button></div></div>`;
    };
    draw();
    countdownTimer = setInterval(() => {
      left--;
      if (left <= 0) { hideIdle(); actions.reset(); } else draw();
    }, 1000);
  }

  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showIdle, IDLE_MS);
  }

  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (!countdownTimer) armIdle(); }, true));

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 캐시 실패해도 앱은 동작 */ });
  }

  state = fresh();
  render();
  armIdle();
})();
