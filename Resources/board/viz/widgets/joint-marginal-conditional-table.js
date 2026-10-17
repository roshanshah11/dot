// One two-way table of 120 students (studied or not, passed or not) and the three kinds of probability read from it.
// Joint, P(A and B): one inner cell over everyone. Marginal, P(A): a row or column total over everyone. Conditional,
// P(A | B): one inner cell over only the B row or column, the group the condition keeps. The amber cell is the
// numerator, the blue outline is the group being counted, and the bar below draws both counts to the same scale.
(function () {
  var CNT = [[52, 14], [22, 32]], TOTAL = 120;          // rows: studied, didn't study; columns: passed, failed
  var EV = {passed: {ax: "col", i: 0, w: "passed"}, did_not_pass: {ax: "col", i: 1, w: "failed"},
            studied: {ax: "row", i: 0, w: "studied"}, did_not_study: {ax: "row", i: 1, w: "didn't study"}};
  var VALUES = ["passed_and_studied", "passed_and_did_not_study", "did_not_pass_and_studied", "did_not_pass_and_did_not_study",
    "passed", "did_not_pass", "studied", "did_not_study",
    "studied_given_passed", "did_not_study_given_passed", "studied_given_did_not_pass", "did_not_study_given_did_not_pass",
    "passed_given_studied", "did_not_pass_given_studied", "passed_given_did_not_study", "did_not_pass_given_did_not_study"];
  var short = {passed: "pass", did_not_pass: "fail", studied: "study", did_not_study: "no study"};
  var NAMES = {};
  VALUES.forEach(function (q) {
    var g = q.split("_given_"), a = q.split("_and_");
    NAMES[q] = g.length === 2 ? short[g[0]] + " | " + short[g[1]] : a.length === 2 ? short[a[0]] + " ∩ " + short[a[1]] : short[q];
  });
  function rowT(i) { return CNT[i][0] + CNT[i][1]; }
  function colT(j) { return CNT[0][j] + CNT[1][j]; }
  function parse(q) {
    var g = q.split("_given_"), a = q.split("_and_"), o;
    if (g.length === 2) {
      var A = EV[g[0]], B = EV[g[1]], r = A.ax === "row" ? A.i : B.i, c = A.ax === "col" ? A.i : B.i;
      o = {kind: "conditional", A: A, B: B, cell: [r, c], num: CNT[r][c], den: B.ax === "row" ? rowT(B.i) : colT(B.i),
           tex: "P(\\text{" + A.w + "}\\mid\\text{" + B.w + "})"};
    } else if (a.length === 2) {
      var X = EV[a[0]], Y = EV[a[1]];
      o = {kind: "joint", A: X, B: Y, cell: [Y.i, X.i], num: CNT[Y.i][X.i], den: TOTAL, tex: "P(\\text{" + X.w + "}\\cap\\text{" + Y.w + "})"};
    } else {
      var E = EV[q];
      o = {kind: "marginal", A: E, num: E.ax === "row" ? rowT(E.i) : colT(E.i), den: TOTAL, tex: "P(\\text{" + E.w + "})"};
    }
    o.p = o.num / o.den;
    return o;
  }
  var f3 = function (x) { return Viz.fmt(x, 3); };

  Viz.register("joint-marginal-conditional-table", {
    title: "Joint, marginal and conditional probability",
    subject: "stats",
    shows: "Pick a question about the 120 students: the amber count goes on top, and the blue group it is counted out of goes underneath",
    params: {
      probabilityQuestion: {kind: "enum", values: VALUES, names: NAMES, default: "passed_and_studied", label: "P(\\cdot)"}
    },
    formula: function (v) {
      var q = parse(v.probabilityQuestion);
      if (q.kind === "conditional") return "\\begin{aligned}&" + q.tex + "\\\\&\\quad=\\dfrac{P(\\text{both})}{P(\\text{" + q.B.w + "})}=\\dfrac{" + q.num + "/120}{" + q.den + "/120}" +
        "\\\\&\\quad=\\dfrac{" + q.num + "}{" + q.den + "}=" + Viz.n(q.p, 3) + "\\end{aligned}";
      return "\\begin{aligned}&" + q.tex + "\\\\&\\quad=\\dfrac{" + q.num + "}{120}=" + Viz.n(q.p, 3) + "\\end{aligned}";
    },
    status: function (v) {
      var q = parse(v.probabilityQuestion);
      if (q.kind === "joint") return "<b>" + q.num + "</b> of all 120 students both " + (q.A.i ? "failed" : "passed") + " and " + (q.B.i ? "didn't study" : "studied") +
        ": a joint probability of <b>" + f3(q.p) + "</b>, one cell over the grand total.";
      if (q.kind === "marginal") return "<b>" + q.num + "</b> of all 120 students " + q.A.w + " (a " + (q.A.ax === "row" ? "row" : "column") +
        " total), so the marginal probability is <b>" + f3(q.p) + "</b>.";
      return "Only the <b>" + q.den + "</b> who " + q.B.w + " count now, and " + q.num + " of them " + q.A.w + ": <b>" + f3(q.p) + "</b>, higher than the joint " + f3(q.num / TOTAL) + " because the denominator shrank from 120.";
    },
    examples: VALUES.slice(1).map(function (q) { return {name: q.replace(/_/g, " "), values: {probabilityQuestion: q}}; }),
    size: [400, 312],
    draw: function (api, v) {
      var c = api.color, q = parse(v.probabilityQuestion);
      var cx = [20, 132, 214, 296, 380], ry = [40, 70, 118, 166, 214];      // column and row edges of the table
      var cell = function (r, k) { return [cx[k], ry[r], cx[k + 1] - cx[k], ry[r + 1] - ry[r]]; };
      var ask = q.kind === "joint" ? "What share of all students " + (q.A.i ? "failed" : "passed") + " and " + (q.B.i ? "didn't study" : "studied") + "?" :
        q.kind === "marginal" ? "What share of all students " + q.A.w + "?" : "Of the students who " + q.B.w + ", what share " + q.A.w + "?";
      api.label([200, 16], ask, {color: c.ink, size: 13, weight: 650, anchor: "middle"});
      // the denominator group (blue): everyone, or only the row / column the condition keeps
      var den;
      if (q.kind !== "conditional") den = [cx[1], ry[1], cx[4] - cx[1], ry[4] - ry[1]];
      else if (q.B.ax === "row") den = [cx[1], ry[q.B.i + 1], cx[4] - cx[1], ry[q.B.i + 2] - ry[q.B.i + 1]];
      else den = [cx[q.B.i + 1], ry[1], cx[q.B.i + 2] - cx[q.B.i + 1], ry[4] - ry[1]];
      api.rect(den[0], den[1], den[2], den[3], {fill: c.c2, fillOpacity: 0.1, rx: 4});
      var denCell = q.kind !== "conditional" ? [3, 3] : q.B.ax === "row" ? [q.B.i + 1, 3] : [3, q.B.i + 1];
      var dc = cell(denCell[0], denCell[1]);
      api.rect(dc[0] + 3, dc[1] + 3, dc[2] - 6, dc[3] - 6, {fill: c.c2, fillOpacity: 0.35, rx: 4});
      // the numerator (amber): one inner cell, or for a marginal the whole row / column with its total
      var numCell;
      if (q.kind === "marginal") {
        var band = q.A.ax === "row" ? [cx[1], ry[q.A.i + 1], cx[4] - cx[1], ry[q.A.i + 2] - ry[q.A.i + 1]] : [cx[q.A.i + 1], ry[1], cx[q.A.i + 2] - cx[q.A.i + 1], ry[4] - ry[1]];
        api.rect(band[0] + 1, band[1] + 1, band[2] - 2, band[3] - 2, {fill: c.c3, fillOpacity: 0.12, stroke: c.c3, width: 1.5, dash: "4 3", rx: 4});
        numCell = q.A.ax === "row" ? [q.A.i + 1, 3] : [3, q.A.i + 1];
      } else numCell = [q.cell[0] + 1, q.cell[1] + 1];
      var nc = cell(numCell[0], numCell[1]);
      api.rect(nc[0] + 3, nc[1] + 3, nc[2] - 6, nc[3] - 6, {fill: c.c3, fillOpacity: 0.8, rx: 4});
      // grid lines and the numbers
      for (var r = 1; r <= 4; r++) api.line([cx[0], ry[r]], [cx[4], ry[r]], {color: r === 1 || r === 3 ? c.axis : c.grid, width: r === 1 || r === 3 ? 1.3 : 1});
      for (var k = 1; k <= 3; k++) api.line([cx[k], ry[0] + 4], [cx[k], ry[4]], {color: k === 1 || k === 3 ? c.axis : c.grid, width: k === 1 || k === 3 ? 1.3 : 1});
      api.rect(den[0], den[1], den[2], den[3], {stroke: c.c2, width: 2.5, rx: 4});
      ["passed", "failed", "total"].forEach(function (t, i) { api.label([(cx[i + 1] + cx[i + 2]) / 2, (ry[0] + ry[1]) / 2], t, {color: c.muted, size: 12.5, weight: 600, anchor: "middle"}); });
      ["studied", "didn't study", "total"].forEach(function (t, i) { api.label([cx[0] + 8, (ry[i + 1] + ry[i + 2]) / 2], t, {color: c.muted, size: 12.5, weight: 600}); });
      var vals = [[CNT[0][0], CNT[0][1], rowT(0)], [CNT[1][0], CNT[1][1], rowT(1)], [colT(0), colT(1), TOTAL]];
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
        var isNum = numCell[0] === i + 1 && numCell[1] === j + 1, isDen = denCell[0] === i + 1 && denCell[1] === j + 1;
        api.label([(cx[j + 1] + cx[j + 2]) / 2, (ry[i + 1] + ry[i + 2]) / 2], String(vals[i][j]),
          {color: isNum ? c.card : isDen ? c.c2 : c.ink, size: isNum || isDen ? 16 : 14, weight: isNum || isDen ? 750 : 500, anchor: "middle"});
      }
      // both counts on one scale: 3 px per student, so a conditional's shorter blue bar is its smaller denominator
      var bx = 20, by = 238, px = 360 / TOTAL;
      api.rect(bx, by, q.den * px, 18, {fill: c.c2, fillOpacity: 0.3, stroke: c.c2, width: 1.5, rx: 4});
      api.rect(bx, by, q.num * px, 18, {fill: c.c3, fillOpacity: 0.9, rx: 4});
      api.label([bx + q.num * px / 2, by + 9], String(q.num), {color: c.card, size: 12.5, weight: 750, anchor: "middle"});
      var dl = String(q.den), right = bx + q.den * px + 6 + dl.length * 8 < 396;
      api.label([right ? bx + q.den * px + 6 : bx + q.den * px - 6, by + 9], dl, {color: c.c2, size: 12.5, weight: 750, anchor: right ? "start" : "end"});
      var who = q.kind === "conditional" ? "who " + q.B.w : "students";
      api.label([200, by + 42], q.num + " of the " + q.den + " " + who + " = " + f3(q.p), {color: c.ink, size: 13, weight: 650, anchor: "middle"});
      api.label([200, by + 64], q.kind === "joint" ? "joint: one cell over the grand total" : q.kind === "marginal" ? "marginal: a table margin over the grand total" :
        "conditional: one cell over only the " + (q.B.ax === "row" ? "row" : "column") + " that is given", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
