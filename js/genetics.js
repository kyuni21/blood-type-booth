// ABO 혈액형 유전 계산 (유전자형·교배·확률·시뮬레이션·판정) 순수 함수 모음
(function (root) {
  var PHENOTYPES = ['A', 'B', 'AB', 'O'];
  var GENOTYPES = ['AA', 'AO', 'BB', 'BO', 'AB', 'OO'];

  // 한국인 혈액형 분포 (A 34%, O 28%, B 27%, AB 11%)에서 역산한 대립유전자 빈도
  var KOREAN_PHENO = { A: 0.34, B: 0.27, AB: 0.11, O: 0.28 };
  var KOREAN_ALLELES = (function () {
    var r = Math.sqrt(KOREAN_PHENO.O);
    // A형 = p² + 2pr → p = -r + √(r² + A)
    var p = -r + Math.sqrt(r * r + KOREAN_PHENO.A);
    return { A: p, B: 1 - p - r, O: r };
  })();

  function norm(a, b) {
    return [a, b].sort().join('');
  }

  function phenotypeOf(g) {
    if (g === 'AB') return 'AB';
    if (g === 'OO') return 'O';
    return g.indexOf('A') >= 0 ? 'A' : 'B';
  }

  function genotypesOf(p) {
    return GENOTYPES.filter(function (g) { return phenotypeOf(g) === p; });
  }

  // 2×2 펀넷 사각형. rows = 부모1 대립유전자, cols = 부모2 대립유전자
  function punnett(g1, g2) {
    var rows = g1.split(''), cols = g2.split('');
    return {
      rows: rows,
      cols: cols,
      cells: rows.map(function (a) {
        return cols.map(function (b) { return norm(a, b); });
      })
    };
  }

  // 자녀 유전자형 분포 { 'AO': 0.5, ... }
  function cross(g1, g2) {
    var out = {};
    punnett(g1, g2).cells.forEach(function (row) {
      row.forEach(function (g) { out[g] = (out[g] || 0) + 0.25; });
    });
    return out;
  }

  // 자녀 표현형 분포 { A, B, AB, O }
  function childPhenotypeDist(g1, g2) {
    var out = { A: 0, B: 0, AB: 0, O: 0 };
    var c = cross(g1, g2);
    Object.keys(c).forEach(function (g) { out[phenotypeOf(g)] += c[g]; });
    return out;
  }

  function possibleChildPhenotypes(p1, p2) {
    var set = {};
    genotypesOf(p1).forEach(function (g1) {
      genotypesOf(p2).forEach(function (g2) {
        var d = childPhenotypeDist(g1, g2);
        PHENOTYPES.forEach(function (p) { if (d[p] > 0) set[p] = true; });
      });
    });
    return PHENOTYPES.filter(function (p) { return set[p]; });
  }

  // 한쪽 부모와 자녀를 알 때 다른 부모가 될 수 있는 표현형
  function possibleParentPhenotypes(knownParent, child) {
    return PHENOTYPES.filter(function (p) {
      return possibleChildPhenotypes(knownParent, p).indexOf(child) >= 0;
    });
  }

  // 내 표현형(+선택: 부모 표현형)으로 가능한 내 유전자형. 부모 값이 없으면 제한 없음.
  // 빈 배열 = 멘델 법칙만으로는 설명되지 않는 드문 조합
  function myGenotypeCandidates(myP, p1, p2) {
    var g1s = p1 ? genotypesOf(p1) : GENOTYPES;
    var g2s = p2 ? genotypesOf(p2) : GENOTYPES;
    return genotypesOf(myP).filter(function (g) {
      return g1s.some(function (a) {
        return g2s.some(function (b) { return (cross(a, b)[g] || 0) > 0; });
      });
    });
  }

  // 인구 분포 기준 유전자형 비중. 예) A형 → { AA: 약 0.2, AO: 약 0.8 }
  function genotypeWeights(p, freq) {
    freq = freq || KOREAN_ALLELES;
    var raw = {};
    genotypesOf(p).forEach(function (g) {
      var a = g[0], b = g[1];
      raw[g] = a === b ? freq[a] * freq[a] : 2 * freq[a] * freq[b];
    });
    var sum = Object.keys(raw).reduce(function (s, g) { return s + raw[g]; }, 0);
    Object.keys(raw).forEach(function (g) { raw[g] /= sum; });
    return raw;
  }

  // 가상 자녀 n명 출생. rand는 테스트용 주입 가능
  function simulate(g1, g2, n, rand) {
    rand = rand || Math.random;
    var counts = { A: 0, B: 0, AB: 0, O: 0 };
    for (var i = 0; i < n; i++) {
      var a = g1[rand() < 0.5 ? 0 : 1];
      var b = g2[rand() < 0.5 ? 0 : 1];
      counts[phenotypeOf(norm(a, b))]++;
    }
    return counts;
  }

  // ---------- Rh (D 우성, d 열성) ----------
  var RH_GENOTYPES = ['DD', 'Dd', 'dd'];
  var FULL_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  function rhPhenotypeOf(g) {
    return g.indexOf('D') >= 0 ? '+' : '-';
  }

  // 자녀 Rh 표현형 분포 { '+', '-' }. 'D' < 'd' 이므로 정렬하면 'Dd'로 정규화됨
  function rhDist(g1, g2) {
    var out = { '+': 0, '-': 0 };
    g1.split('').forEach(function (a) {
      g2.split('').forEach(function (b) { out[rhPhenotypeOf(norm(a, b))] += 0.25; });
    });
    return out;
  }

  // ABO와 Rh는 서로 독립 → 확률을 곱함. 키는 'A+', 'O-' 형식
  function fullDist(abo1, abo2, rh1, rh2) {
    var abo = childPhenotypeDist(abo1, abo2), rh = rhDist(rh1, rh2), out = {};
    FULL_TYPES.forEach(function (t) {
      out[t] = abo[t.slice(0, -1)] * rh[t.slice(-1)];
    });
    return out;
  }

  // 아기 한 명 출생 → 'A+' 형식
  function birth(abo1, abo2, rh1, rh2, rand) {
    rand = rand || Math.random;
    var pickAllele = function (g) { return g[rand() < 0.5 ? 0 : 1]; };
    var abo = phenotypeOf(norm(pickAllele(abo1), pickAllele(abo2)));
    var rh = rhPhenotypeOf(norm(pickAllele(rh1), pickAllele(rh2)));
    return abo + rh;
  }

  // 응집 반응 → 혈액형. antiA·antiB·antiD 는 응집 여부(boolean)
  function bloodTypeFromReactions(r) {
    var abo = r.antiA && r.antiB ? 'AB' : r.antiA ? 'A' : r.antiB ? 'B' : 'O';
    return { abo: abo, rh: r.antiD ? '+' : '-' };
  }

  // 바뀐 아기 사건: 아기가 A·B·AB·O 하나씩이면 짝이 하나로 정해지도록 설계한 부부
  var COUPLES = [
    { id: 'kim', name: '김씨 부부', parents: ['O', 'O'] },
    { id: 'lee', name: '이씨 부부', parents: ['AB', 'O'] },
    { id: 'park', name: '박씨 부부', parents: ['B', 'O'] },
    { id: 'choi', name: '최씨 부부', parents: ['A', 'AB'] }
  ];

  function canBeChildOf(couple, babyType) {
    return possibleChildPhenotypes(couple.parents[0], couple.parents[1]).indexOf(babyType) >= 0;
  }

  // 아기 혈액형 배열(길이 4)에 대해 가능한 짝짓기 전부. 결과 각 항목은 couples 순서의 아기 인덱스 배열
  function solveCase(babyTypes, couples) {
    couples = couples || COUPLES;
    var out = [];
    (function perm(prefix, rest) {
      if (!rest.length) { out.push(prefix); return; }
      rest.forEach(function (idx, i) {
        if (!canBeChildOf(couples[prefix.length], babyTypes[idx])) return;
        perm(prefix.concat(idx), rest.slice(0, i).concat(rest.slice(i + 1)));
      });
    })([], babyTypes.map(function (_, i) { return i; }));
    return out;
  }

  var G = {
    PHENOTYPES: PHENOTYPES,
    GENOTYPES: GENOTYPES,
    KOREAN_PHENO: KOREAN_PHENO,
    KOREAN_ALLELES: KOREAN_ALLELES,
    COUPLES: COUPLES,
    phenotypeOf: phenotypeOf,
    genotypesOf: genotypesOf,
    punnett: punnett,
    cross: cross,
    childPhenotypeDist: childPhenotypeDist,
    possibleChildPhenotypes: possibleChildPhenotypes,
    possibleParentPhenotypes: possibleParentPhenotypes,
    myGenotypeCandidates: myGenotypeCandidates,
    genotypeWeights: genotypeWeights,
    simulate: simulate,
    RH_GENOTYPES: RH_GENOTYPES,
    FULL_TYPES: FULL_TYPES,
    rhPhenotypeOf: rhPhenotypeOf,
    rhDist: rhDist,
    fullDist: fullDist,
    birth: birth,
    bloodTypeFromReactions: bloodTypeFromReactions,
    canBeChildOf: canBeChildOf,
    solveCase: solveCase
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  else root.Genetics = G;
})(this);
