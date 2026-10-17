// Two draws without replacement from an urn of n_A balls of kind A (amber) and n_B of kind B (blue). The tree's
// first branches carry n_A/N and n_B/N; the second branches carry the counts left after the first ball is gone, so
// they depend on what came first. Leaf probabilities are the products along each path and add to 1. Branch
// thickness follows the branch probability. The urn shows the path A then A: the first A drawn (above, its old slot
// dashed) and what is left for the second draw. The formula compares P(A, A) with the with-replacement value.
(function () {
  function calc(v) {
    var a = v.category_a_count, b = v.category_b_count, N = a + b;
    return {a: a, b: b, N: N, AA: a * (a - 1) / (N * (N - 1)), AB: a * b / (N * (N - 1)), BA: b * a / (N * (N - 1)), BB: b * (b - 1) / (N * (N - 1)), rep: a * a / (N * N)};
  }
  var f3 = function (x) { return Viz.fmt(x, 3); };

  Viz.register("sampling-without-replacement", {
    title: "Sampling without replacement",
    subject: "stats",
    shows: "Set the urn: the second draw's chances change with what the first draw took out, so the draws are dependent",
    params: {
      category_a_count: {kind: "integer", default: 4, min: 1, max: 10, label: "n_A"},
      category_b_count: {kind: "integer", default: 3, min: 1, max: 10, label: "n_B"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}P(A,A)=\\dfrac{n_A}{N}\\cdot\\dfrac{n_A-1}{N-1}\\\\[10pt]\\qquad\\quad\\ \\ =\\dfrac{" + k.a + "}{" + k.N + "}\\cdot\\dfrac{" + (k.a - 1) + "}{" + (k.N - 1) + "}=" + Viz.n(k.AA, 3) +
        "\\\\[10pt]\\text{with replacement: }\\left(\\tfrac{" + k.a + "}{" + k.N + "}\\right)^2=" + Viz.n(k.rep, 3) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.a === 1) return "With a single A, once it is drawn no A is left: the second A has chance <b>0</b>, so P(A, A) = 0 instead of " + f3(k.rep) + " with replacement.";
      return "After an A comes out, only " + (k.a - 1) + " of the " + (k.N - 1) + " balls left are A, so a second A has chance <b>" + f3((k.a - 1) / (k.N - 1)) +
        "</b> instead of " + f3(k.a / k.N) + ": the draws are dependent, and P(A, A) = " + f3(k.AA) + ", not " + f3(k.rep) + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {category_a_count: 1, category_b_count: 1}},
      {name: "Maximum supported values", values: {category_a_count: 10, category_b_count: 10}},
      {name: "one A: no second A", values: {category_a_count: 1, category_b_count: 6}},
      {name: "big urn, little dependence", values: {category_a_count: 10, category_b_count: 8}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), colA = c.c3, colB = c.c2;
      // the urn, then the first A taken out of it
      api.label([72, 14], "urn: " + k.a + " A, " + k.b + " B", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.path("M 12 150 L 12 268 Q 12 282 26 282 L 118 282 Q 132 282 132 268 L 132 150", {stroke: c.muted, width: 2});
      var slot = function (i) { return [27 + (i % 5) * 22.5, 268 - Math.floor(i / 5) * 22]; };
      for (var i = 0; i < k.N; i++) {
        var isA = i < k.a, at = slot(i);
        if (i === 0) api.circle(at, 8.5, {stroke: colA, width: 1.5, dash: "3 3"});
        else api.circle(at, 8.5, {fill: isA ? colA : colB, fillOpacity: 0.9});
      }
      api.arrow([72, 140], [72, 92], {color: colA, width: 2, halo: false});
      // what the second draw sees
      api.circle([72, 70], 11, {fill: colA, fillOpacity: 0.95});
      api.label([72, 44], "1st draw: A", {color: colA, size: 12.5, weight: 650, anchor: "middle"});
      api.label([72, 294], "left: " + (k.a - 1) + " A, " + k.b + " B", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      // the tree
      var R = [154, 160], nA = [224, 90], nB = [224, 230];
      var L = {AA: [292, 52], AB: [292, 126], BA: [292, 194], BB: [292, 268]};
      api.label([224, 14], "1st draw", {color: c.muted, size: 12, anchor: "middle"});
      api.label([300, 14], "2nd draw", {color: c.muted, size: 12, anchor: "middle"});
      function branch(p, q, prob, col, num, den, above) {
        var zero = prob <= 0;
        api.line(p, q, {color: zero ? c.faint : col, width: zero ? 1.2 : 1.5 + 7 * prob, dash: zero ? "4 4" : null, opacity: zero ? 1 : 0.85});
        var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        api.label([m[0] - 4, m[1] + (above ? -13 : 14)], num + "/" + den, {color: zero ? c.muted : col, size: 12.5, weight: 650, anchor: "middle"});
      }
      branch(R, nA, k.a / k.N, colA, k.a, k.N, true);
      branch(R, nB, k.b / k.N, colB, k.b, k.N, false);
      branch(nA, L.AA, (k.a - 1) / (k.N - 1), colA, k.a - 1, k.N - 1, true);
      branch(nA, L.AB, k.b / (k.N - 1), colB, k.b, k.N - 1, false);
      branch(nB, L.BA, k.a / (k.N - 1), colA, k.a, k.N - 1, true);
      branch(nB, L.BB, (k.b - 1) / (k.N - 1), colB, k.b - 1, k.N - 1, false);
      api.point(R, {color: c.ink, r: 4.5});
      api.circle(nA, 9, {fill: colA, fillOpacity: 0.95});
      api.circle(nB, 9, {fill: colB, fillOpacity: 0.95});
      [["AA", colA, colA], ["AB", colA, colB], ["BA", colB, colA], ["BB", colB, colB]].forEach(function (q) {
        var at = L[q[0]], p = k[q[0]], hl = q[0] === "AA";
        api.circle(at, 6, {fill: q[2], fillOpacity: p > 0 ? 0.95 : 0.25});
        api.label([at[0] + 12, at[1] - 8], q[0].charAt(0) + " then " + q[0].charAt(1), {color: hl ? c.ink : c.muted, size: 12, weight: hl ? 700 : 500});
        api.label([at[0] + 12, at[1] + 9], "P = " + f3(p), {color: hl ? c.ink : c.muted, size: 12.5, weight: hl ? 700 : 500});
      });
      api.label([396, 292], "sum = " + f3(k.AA + k.AB + k.BA + k.BB), {color: c.muted, size: 12, anchor: "end"});
    }
  });
})();
