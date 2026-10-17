// Two linear equations in x and y are two lines. They cross once (det A ≠ 0), never (parallel: det A = 0 but the
// right sides disagree), or everywhere along one line (the same line). The ranks of A and [A | b] decide which.
(function () {
  function eq(a, b, c, tex) { // "2x − y = 2" (text) or "2x-y=2" (LaTeX), coefficients 1 and 0 dropped
    var out = "", m = tex ? "-" : "−";
    [[a, "x"], [b, "y"]].forEach(function (t) {
      if (Math.abs(t[0]) < 1e-12) return;
      var coef = Math.abs(t[0]) === 1 ? "" : Viz.n(Math.abs(t[0]));
      out += out === "" ? (t[0] < 0 ? m : "") + coef + t[1] : (t[0] < 0 ? " " + m + " " : " + ") + coef + t[1];
    });
    return (out || "0") + " = " + (c < 0 ? m : "") + Viz.n(Math.abs(c));
  }
  function solve(v) {
    var det = v.a1 * v.b2 - v.a2 * v.b1, z = function (x) { return Math.abs(x) < 1e-9; };
    var rankA = z(v.a1) && z(v.b1) && z(v.a2) && z(v.b2) ? 0 : !z(det) ? 2 : 1;
    var minors = [det, v.a1 * v.c2 - v.a2 * v.c1, v.b1 * v.c2 - v.b2 * v.c1];
    var allZero = [v.a1, v.b1, v.c1, v.a2, v.b2, v.c2].every(z);
    var rankAug = allZero ? 0 : minors.some(function (m) { return !z(m); }) ? 2 : 1;
    var kind = rankA === 2 ? "one" : rankA < rankAug ? "none" : "many";
    return {det: det, rankA: rankA, rankAug: rankAug, kind: kind,
            x: rankA === 2 ? (v.c1 * v.b2 - v.c2 * v.b1) / det : null, y: rankA === 2 ? (v.a1 * v.c2 - v.a2 * v.c1) / det : null,
            dead1: z(v.a1) && z(v.b1), dead2: z(v.a2) && z(v.b2)};
  }
  var coef = {kind: "number", min: -4, max: 4, step: 0.5}, rhs = {kind: "number", min: -8, max: 8, step: 0.5};
  Viz.register("system-linear-equations-cases", {
    title: "Two equations: one, none or infinitely many solutions",
    subject: "linear-algebra",
    shows: "Change the two equations: crossing lines give one solution, parallel lines none, the same line infinitely many; det A and the ranks say which",
    params: {
      a1: Object.assign({default: 1, label: "a_1"}, coef), b1: Object.assign({default: 1, label: "b_1"}, coef), c1: Object.assign({default: 4, label: "c_1"}, rhs),
      a2: Object.assign({default: 2, label: "a_2"}, coef), b2: Object.assign({default: -1, label: "b_2"}, coef), c2: Object.assign({default: 2, label: "c_2"}, rhs)
    },
    formula: function (v) {
      var s = solve(v), sys = "\\begin{cases}" + eq(v.a1, v.b1, v.c1, true) + "\\\\" + eq(v.a2, v.b2, v.c2, true) + "\\end{cases}\\newline ";
      if (s.kind === "one") return sys + "\\det A=" + Viz.p(v.a1) + "\\cdot" + Viz.p(v.b2) + "-" + Viz.p(v.b1) + "\\cdot" + Viz.p(v.a2) + "=" + Viz.n(s.det) + "\\neq0";
      return sys + "\\det A=0,\\ \\operatorname{rank}A=" + s.rankA + (s.kind === "none" ? "<" : "=") + "\\operatorname{rank}{[A\\,|\\,\\mathbf b]}=" + s.rankAug;
    },
    status: function (v) {
      var s = solve(v);
      if (s.kind === "one") return "<b>One solution</b>: det A = " + Viz.fmt(s.det) + " ≠ 0, so the lines cross exactly once, at <b>(" + Viz.fmt(s.x) + ", " + Viz.fmt(s.y) + ")</b>.";
      if (s.kind === "none") {
        if (s.dead1 || s.dead2) return "<b>No solution</b>: equation " + (s.dead1 && v.c1 ? 1 : 2) + " reads 0 = " + Viz.fmt(s.dead1 && v.c1 ? v.c1 : v.c2) + ", which no point satisfies.";
        return "<b>No solution</b>: the lines are parallel (det A = 0) but sit apart, so they never meet; rank A = 1 < rank [A | b] = 2.";
      }
      if (s.rankA === 0) return "<b>Every point</b> solves both: each equation reads 0 = 0, so the solution set is the whole plane.";
      if (s.dead1 || s.dead2) return "<b>Infinitely many</b>: equation " + (s.dead1 ? 1 : 2) + " reads 0 = 0 (always true), so every point on the other line works.";
      return "<b>Infinitely many</b>: one equation is a multiple of the other, so both are the same line and every point on it is a solution.";
    },
    examples: [
      {name: "parallel: no solution", values: {a1: 1, b1: 1, c1: 4, a2: 2, b2: 2, c2: 2}},
      {name: "same line: infinitely many", values: {a1: 1, b1: 1, c1: 4, a2: 2, b2: 2, c2: 8}},
      {name: "vertical and horizontal", values: {a1: 1, b1: 0, c1: -3, a2: 0, b2: 2, c2: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, W = api.w, H = api.h, s = solve(v);
      // three case chips; the live one is lit
      var cases = [["one", "one solution", c.c4], ["none", "no solution", c.c5], ["many", "infinitely many", c.c2]], cw = (W - 28 - 16) / 3;
      cases.forEach(function (k, i) {
        var on = s.kind === k[0], x = 14 + i * (cw + 8);
        api.rect(x, 6, cw, 26, {fill: on ? k[2] : "none", fillOpacity: on ? 0.22 : 0, stroke: on ? k[2] : c.grid, width: on ? 1.6 : 1.2, rx: 13});
        api.label([x + cw / 2, 19], k[1], {color: on ? k[2] : c.muted, size: 12.5, weight: on ? 700 : 500, anchor: "middle"});
      });
      var n1 = Math.hypot(v.a1, v.b1), n2 = Math.hypot(v.a2, v.b2);
      var reach = Math.max(s.dead1 ? 0 : Math.abs(v.c1) / n1, s.dead2 ? 0 : Math.abs(v.c2) / n2);
      if (s.kind === "one") reach = Math.max(reach, Math.abs(s.x) / 1.4, Math.abs(s.y));
      var e = Math.min(36, Math.max(5, Math.ceil(reach * 1.2) + 1)), big = e > 12;   // margin so the crossing and its tag sit inside
      var pl = api.plane({x: [-e * 1.5, e * 1.5], y: [-e, e], box: [14, 40, W - 28, H - 64], step: big ? 5 : e > 6 ? 2 : 1, tickEvery: big ? 10 : e > 6 ? 4 : 2});
      var tag = function (at, text, o) {
        var w = text.length * o.size * 0.56 + 8, x = o.anchor === "start" ? at[0] - 4 : o.anchor === "end" ? at[0] - w + 4 : at[0] - w / 2;
        api.rect(x, at[1] - o.size * 0.75, w, o.size * 1.5, {fill: c.card, fillOpacity: 0.86, rx: 4});
        api.label(at, text, o);
      };
      var lines = [[v.a1, v.b1, v.c1, c.c1, s.dead1], [v.a2, v.b2, v.c2, c.c3, s.dead2]], segs = [];
      lines.forEach(function (L, i) {
        if (L[4]) { segs.push(null); return; }
        var nn = L[0] * L[0] + L[1] * L[1], q = [L[0] * L[2] / nn, L[1] * L[2] / nn], d = [-L[1], L[0]];
        var seg = pl.through(q, d); segs.push(seg);
        if (!seg) return;
        var same = s.kind === "many" && i === 1;
        api.line(pl.px(seg[0]), pl.px(seg[1]), {color: L[3], width: same ? 3 : i === 0 && s.kind === "many" ? 7 : 3, dash: same ? "9 7" : null, opacity: i === 0 && s.kind === "many" ? 0.55 : 1});
        // equation tag near one end: line 1 at its right (or top) end, line 2 at its left (or bottom) end
        var P0 = pl.px(seg[0]), P1 = pl.px(seg[1]), pick = (P0[0] - P1[0]) || (P1[1] - P0[1]);
        var far = (i === 0) === (pick > 0) ? P0 : P1, near = far === P0 ? P1 : P0, len = Math.hypot(far[0] - near[0], far[1] - near[1]);
        // centred beside the line, pushed off it by the tag's own half-extent along the line's normal (upward side)
        var txt = eq(L[0], L[1], L[2], false), tw = txt.length * 12.5 * 0.56 + 8, ux = (near[0] - far[0]) / len, uy = (near[1] - far[1]) / len;
        var nx = -uy, ny = ux; if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
        var off = Math.abs(nx) * tw / 2 + Math.abs(ny) * 10 + 5, along = Math.min(len / 2, tw / 2 * Math.abs(ux) + 18);
        tag([far[0] + ux * along + nx * off, far[1] + uy * along + ny * off], txt, {color: L[3], size: 12.5, weight: 650, anchor: "middle"});
      });
      if (s.kind === "one") {
        var inView = Math.abs(s.x) <= e * 1.5 + 1e-9 && Math.abs(s.y) <= e + 1e-9;
        if (inView) {
          var X = pl.px([s.x, s.y]);
          api.circle(X, 11, {stroke: c.c4, width: 2});
          api.point(X, {color: c.ink, r: 4.5});
          var right = X[0] > W / 2;   // the tag leans toward the middle of the plane
          tag([X[0] + (right ? -16 : 16), X[1] + (X[1] < H / 2 ? 18 : -18)], "(" + api.fmt(s.x) + ", " + api.fmt(s.y) + ")", {color: c.c4, size: 13, weight: 700, anchor: right ? "end" : "start"});
        } else {
          tag([W / 2, H - 12], "they cross at (" + api.fmt(s.x, 1) + ", " + api.fmt(s.y, 1) + "), off the view", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
        }
      } else if (s.kind === "none" && segs[0] && segs[1]) {
        // the gap between the parallel lines, measured along their common normal
        var nx = v.a1 / n1, ny = v.b1 / n1, k1 = v.c1 / n1, k2 = (v.c2 / n2) * Math.sign(v.a1 * v.a2 + v.b1 * v.b2);
        var p1 = [nx * k1, ny * k1], p2 = [nx * k2, ny * k2], mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        api.line(pl.px(p1), pl.px(p2), {color: c.c5, width: 2, arrow: true, arrowStart: true});
        tag([pl.px(mid)[0] + 10, pl.px(mid)[1]], "gap " + api.fmt(Math.abs(k1 - k2)) + ": never meet", {color: c.c5, size: 12.5, weight: 650, anchor: "start"});
      } else if (s.kind === "many" && s.rankA === 1) {
        var live = segs[0] || segs[1];
        for (var t = 0.2; t < 0.85; t += 0.15) api.point([pl.px(live[0])[0] + (pl.px(live[1])[0] - pl.px(live[0])[0]) * t, pl.px(live[0])[1] + (pl.px(live[1])[1] - pl.px(live[0])[1]) * t], {color: c.c2, r: 4});
        tag([W / 2, H - 12], "every point on this line solves both", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      } else if (s.kind === "many") {
        api.rect(16, 44, W - 32, H - 54, {fill: c.c2, fillOpacity: 0.08, rx: 6});
        tag([W / 2, H - 12], "0 = 0 twice: the whole plane", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      } else if (s.kind === "none") {
        tag([W / 2, H - 12], "0 = " + api.fmt(s.dead1 && v.c1 ? v.c1 : v.c2) + " can never hold", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      }
    }
  });
})();
