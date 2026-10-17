// The multiplication rule, P(A and B) = P(A) P(B | A), two ways. Left: the sample space as a unit square (area =
// probability). A is the blue strip of width P(A); inside A, B takes the share P(B | A) of the strip's height, so the
// amber corner has area P(A) times P(B | A): a fraction of a fraction. Outside A nothing is drawn for B, because the rule
// never needs P(B | not A). Right: the same numbers as a tree, where the amber path multiplies along its branches.
// Drag the amber corner, or use the sliders.
(function () {
  var f = function (x, d) { return Viz.fmt(x, d == null ? 4 : d); };

  Viz.register("probability-intersection", {
    title: "P(A and B): the multiplication rule",
    subject: "stats",
    shows: "Set P(A) and P(B | A): the chance both happen is the share P(B | A) of the share P(A), so P(A ∩ B) = P(A) · P(B | A)",
    params: {
      pA: {kind: "number", default: 0.6, min: 0, max: 1, step: 0.01, label: "P(A)"},
      pBGivenA: {kind: "number", default: 0.35, min: 0, max: 1, step: 0.01, label: "P(B\\,|\\,A)"}
    },
    formula: function (v) {
      return "\\begin{aligned}P(A\\cap B)&=P(A)\\cdot P(B\\,|\\,A)\\\\&=" + Viz.n(v.pA, 4) + "\\cdot" + Viz.n(v.pBGivenA, 4) + "=" + Viz.n(v.pA * v.pBGivenA, 4) + "\\end{aligned}";
    },
    status: function (v) {
      var ab = v.pA * v.pBGivenA, pc = function (x) { return Viz.fmt(x * 100, 1) + "%"; };
      if (v.pA === 0) return "A never happens, so A and B never happen together: <b>P(A ∩ B) = 0</b> whatever P(B | A) would be.";
      if (v.pBGivenA === 0) return "B never happens when A does, so <b>P(A ∩ B) = 0</b> even though A happens " + pc(v.pA) + " of the time.";
      if (v.pA === 1) return "A is certain, so A and B together is just B given A: <b>P(A ∩ B) = " + f(v.pBGivenA) + "</b>.";
      if (v.pBGivenA === 1) return "B always comes with A, so A and B happen together exactly as often as A: <b>" + f(v.pA) + "</b>.";
      return "A happens " + pc(v.pA) + " of the time and B follows in " + pc(v.pBGivenA) + " of those, so both happen <b>" + pc(ab) + "</b> of the time.";
    },
    examples: [
      {name: "Minimum supported values", values: {pA: 0, pBGivenA: 0}},
      {name: "Maximum supported values", values: {pA: 1, pBGivenA: 1}},
      {name: "40% of parts from line A, 5% of those faulty", values: {pA: 0.4, pBGivenA: 0.05}},
      {name: "A is certain: P(A ∩ B) = P(B | A)", values: {pA: 1, pBGivenA: 0.35}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, S = 180, x0 = 58, y0 = 28, yB = y0 + S, wA = v.pA * S, hB = v.pBGivenA * S, ab = v.pA * v.pBGivenA;
      // ---- the unit square
      api.rect(x0, y0, S, S, {fill: c.faint, fillOpacity: 0.05, stroke: c.muted, width: 1.4, rx: 2});
      if (wA > 0) api.rect(x0, y0, wA, S, {fill: c.c2, fillOpacity: 0.2, rx: 0});
      if (wA > 0 && hB > 0) api.rect(x0, yB - hB, wA, hB, {fill: c.c3, fillOpacity: 0.6, stroke: c.c3, width: 2, rx: 0});
      if (wA > 0 && wA < S) api.line([x0 + wA, y0], [x0 + wA, yB], {color: c.c2, width: 2});
      if (wA > 26 && S - hB > 26) api.label([x0 + wA / 2, y0 + 13], "A", {color: c.c2, size: 13, weight: 700, anchor: "middle"});
      if (S - wA > 50) api.label([x0 + wA + (S - wA) / 2, y0 + S / 2], "not A", {color: c.muted, size: 12.5, anchor: "middle"});
      if (wA >= 46 && hB >= 34) {
        api.label([x0 + wA / 2, yB - hB / 2 - 8], "A ∩ B", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.label([x0 + wA / 2, yB - hB / 2 + 9], f(ab, 4), {color: c.ink, size: 14, weight: 750, anchor: "middle"});
      } else if (ab > 0) {
        api.label([x0 + wA + 8, Math.max(y0 + 30, yB - hB - 10)], "A ∩ B = " + f(ab, 4), {color: c.c3, size: 12.5, weight: 700});
      }
      // width P(A) along the bottom
      api.line([x0, yB + 10], [x0 + S, yB + 10], {color: c.grid, width: 1});
      if (wA > 0) {
        api.line([x0, yB + 10], [x0 + wA, yB + 10], {color: c.c2, width: 3});
        [x0, x0 + wA].forEach(function (x) { api.line([x, yB + 5], [x, yB + 15], {color: c.c2, width: 2}); });
      }
      api.label([x0 + Math.max(wA / 2, 34), yB + 27], "P(A) = " + f(v.pA), {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      // height share P(B | A) up the left side: a share of A's strip, not of the square
      api.line([x0 - 10, yB], [x0 - 10, y0], {color: c.grid, width: 1});
      if (hB > 0) {
        api.line([x0 - 10, yB], [x0 - 10, yB - hB], {color: c.c3, width: 3});
        [yB, yB - hB].forEach(function (y) { api.line([x0 - 15, y], [x0 - 5, y], {color: c.c3, width: 2}); });
      }
      api.label([x0 - 16, yB - Math.max(hB / 2, 8)], f(v.pBGivenA), {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      api.label([x0 + S / 2, yB + 50], "amber = " + f(v.pBGivenA) + " of the blue strip", {color: c.muted, size: 12, anchor: "middle"});
      // ---- the tree: multiply along the amber path
      var R = [250, 150], A = [292, 94], N = [292, 224], B = [334, 58], Bn = [334, 130];
      function branch(p, q, prob, on, col, lab, below) {
        api.line(p, q, {color: on ? col : c.faint, width: on ? 3 : 1.6});
        var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        api.label([m[0] - 7, m[1] + (below ? 10 : -10)], lab, {color: on ? col : c.muted, size: 12, weight: on ? 700 : 500, anchor: "end"});
      }
      branch(R, A, v.pA, true, c.c2, f(v.pA), false);
      branch(R, N, 1 - v.pA, false, c.muted, f(1 - v.pA), true);
      branch(A, B, v.pBGivenA, true, c.c3, f(v.pBGivenA), false);
      branch(A, Bn, 1 - v.pBGivenA, false, c.muted, f(1 - v.pBGivenA), true);
      api.point(R, {color: c.ink, r: 4});
      api.point(A, {color: c.c2, r: 5}); api.label([A[0] + 8, A[1] + 1], "A", {color: c.c2, size: 12.5, weight: 700});
      api.point(N, {color: c.muted, r: 4}); api.label([N[0] + 8, N[1] - 8], "not A", {color: c.muted, size: 12});
      api.label([N[0] + 8, N[1] + 8], f(1 - v.pA, 4), {color: c.muted, size: 12});
      api.point(B, {color: c.c3, r: 5}); api.label([B[0] + 8, B[1] - 8], "A ∩ B", {color: c.c3, size: 12, weight: 700});
      api.label([B[0] + 8, B[1] + 8], f(ab, 4), {color: c.c3, size: 13, weight: 750});
      api.point(Bn, {color: c.muted, r: 4}); api.label([Bn[0] + 8, Bn[1] - 8], "A, not B", {color: c.muted, size: 12});
      api.label([Bn[0] + 8, Bn[1] + 8], f(v.pA * (1 - v.pBGivenA), 4), {color: c.muted, size: 12});
      api.label([318, 266], "multiply along each path", {color: c.muted, size: 12, anchor: "middle"});
      api.handle([x0 + wA, yB - hB], {color: c.c3, r: 6.5, onDrag: function (p) {
        api.set({pA: Math.max(0, Math.min(1, Math.round((p[0] - x0) / S * 100) / 100)), pBGivenA: Math.max(0, Math.min(1, Math.round((yB - p[1]) / S * 100) / 100))});
      }});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
