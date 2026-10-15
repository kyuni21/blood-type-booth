// 기기별 localStorage 저장소 (퀴즈 통계·결과 월 집계·스태프 PIN). 접근 실패해도 앱은 동작
(function (root) {
  var PREFIX = 'btb.';

  function read(key, fallback) {
    try {
      var v = localStorage.getItem(PREFIX + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function emptyQuiz() { return { done: 0, pre: [0, 0, 0], post: [0, 0, 0] }; }

  var Store = {
    today: today,

    // 사전·사후 퀴즈 각 문항 정답 여부(boolean 배열)를 한 명분 기록
    recordQuiz: function (preOk, postOk) {
      var q = read('quiz', emptyQuiz());
      q.done++;
      preOk.forEach(function (ok, i) { if (ok) q.pre[i]++; });
      postOk.forEach(function (ok, i) { if (ok) q.post[i]++; });
      write('quiz', q);
    },
    quizStats: function () { return read('quiz', emptyQuiz()); },
    resetQuiz: function () { write('quiz', emptyQuiz()); },

    // 결과 월 집계 { 'YYYY-MM-DD': { A, B, AB, O } }
    wall: function () { return read('wall', {}); },
    addVote: function (type, delta) {
      var w = read('wall', {}), d = today();
      w[d] = w[d] || { A: 0, B: 0, AB: 0, O: 0 };
      w[d][type] = Math.max(0, w[d][type] + (delta || 1));
      write('wall', w);
      return w;
    },
    resetWallToday: function () {
      var w = read('wall', {});
      delete w[today()];
      write('wall', w);
    },
    resetWallAll: function () { write('wall', {}); },

    pin: function () { return read('pin', '0000'); },
    setPin: function (p) { write('pin', p); }
  };

  root.Store = Store;
})(this);
