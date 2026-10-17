// Solving two equations by elimination, drawn as lines. A row operation swaps a line for another line through the
// same crossing: a1·R2 − a2·R1 kills x, so the new row is a horizontal line at the answer's height; then
// back-substitution drops a vertical line at x. Integer coefficients keep every row operation exact.
(function () {
  function eq(a, b, c, tex) {
    var out = "", m = tex ? "-" : "−";
    [[a, "x"], [b, "y"]].forEach(function (t) {
      if (Math.abs(t[0]) < 1e-12) return;
      var coef = Math.abs(t[0]) === 1 ? "" : Viz.n(Math.abs(t[0]));
      out += out === "" ? (t[0] < 0 ? m : "") + coef + t[1] : (t[0] < 0 ? " " + m + " " : " + ") + coef + t[1];
    });
    return (out || "0") + " = " + (c < 0 ? m : "") + Viz.n(Math.abs(c));
  }
  function work(v) {
    var r1 = [v.a1, v.b1, v.c1], r2 = [v.a2, v.b2, v.c2], w = {swapped: false};
    if (r1[0] === 0 && r2[0] !== 0) { var t = r1; r1 = r2; r2 = t; w.swapped = true; }
    w.r1 = r1; w.r2 = r2;
    if (r1[0] !== 0) {
      w.m1 = r2[0] === 0 ? 1 : r1[0]; w.m2 = r2[0];   // a row 2 with no x already is kept as it is
      w.D = w.m1 * r2[1] - w.m2 * r1[1]; w.E = w.m1 * r2[2] - w.m2 * r1[2];   // new R2: D y = E
      if (w.D !== 0) { w.kind = "one"; w.y = w.E / w.D; w.x = (r1[2] - r1[1] * w.y) / r1[0]; }
      else w.kind = w.E !== 0 ? "none" : "many";
    } else { // x appears in neither equation: each row is b y = c on its own
      w.noX = true;
      var ok = function (b, c) { return b !== 0 || c === 0; };
      var agree = v.b1 === 0 || v.b2 === 0 || v.b1 * v.c2 - v.b2 * v.c1 === 0;
      w.kind = ok(v.b1, v.c1) && ok(v.b2, v.c2) && agree ? "many" : "none";
    }
    return w;
  }
  function mult(k, R) { return (k === 1 ? "" : k === -1 ? "-" : Viz.n(k)) + R; }
  function multText(k, R) { return (k === 1 ? "" : k === -1 ? "−" : Viz.fmt(k)) + R; }
  // half-height e of the view (half-width 1.5 e): both lines' nearest points and the crossing, with margin
  function extent(v, w) {
    var rows = [[v.a1, v.b1, v.c1], [v.a2, v.b2, v.c2]], reach = 0;
    rows.forEach(function (L) { var n = Math.hypot(L[0], L[1]); if (n) reach = Math.max(reach, Math.abs(L[2]) / n); });
    if (w.kind === "one") reach = Math.max(reach, Math.abs(w.x) / 1.45, Math.abs(w.y));
    var e = Math.min(36, Math.max(5, Math.ceil(reach * 1.2) + 1));
    // a line that ends at an axis arrow tip looks like part of the axis: add a unit of margin until none does
    // (the axis letters move to whichever side of their tip is clear, in draw)
    var atTip = function (e) {
      var s = 125 / e, X = 1.5 * e, spots = [[-6 / s, 6 / s, e - 3 / s, e], [X - 3 / s, X, -6 / s, 6 / s]];
      return rows.some(function (L) { return (L[0] || L[1]) && spots.some(function (q) {
        var f = [[q[0], q[2]], [q[0], q[3]], [q[1], q[2]], [q[1], q[3]]].map(function (p) { return L[0] * p[0] + L[1] * p[1] - L[2]; });
        return Math.min.apply(null, f) <= 0 && Math.max.apply(null, f) >= 0; }); });
    };
    for (var k = 0; k < 3 && e < 36 && atTip(e); k++) e++;
    return e;
  }
  function inView(w, e) { return w.kind === "one" && Math.abs(w.x) <= e * 1.5 + 1e-9 && Math.abs(w.y) <= e + 1e-9; }
  function firstStatus(v, w) {
    var L1 = [v.a1, v.b1, v.c1], L2 = [v.a2, v.b2, v.c2], flat = function (L) { return L[0] === 0 && L[1] === 0; };
    if (flat(L1) || flat(L2)) {
      var bad = flat(L1) && L1[2] !== 0 ? L1 : flat(L2) && L2[2] !== 0 ? L2 : null;
      if (bad) return "Row " + (bad === L1 ? 1 : 2) + " reads <b>" + eq(0, 0, bad[2], false) + "</b>, which no point satisfies, so the system has <b>no solution</b>.";
      if (flat(L1) && flat(L2)) return "Both rows read <b>0 = 0</b>, so <b>every point</b> (x, y) solves the system.";
      var real = flat(L1) ? L2 : L1;
      return "Row " + (flat(L1) ? 1 : 2) + " reads <b>0 = 0</b>, true everywhere, so only <b>" + eq(real[0], real[1], real[2], false) + "</b> limits the answer: a whole line of solutions.";
    }
    var both = "<b>" + eq(v.a1, v.b1, v.c1, false) + "</b> and <b>" + eq(v.a2, v.b2, v.c2, false) + "</b>";
    if (w.noX) return both + " are both horizontal lines with no x, so x is free and only their heights matter.";
    var op = "R₂ ← " + multText(w.m1, "R₂") + (w.m2 > 0 ? " − " : " + ") + multText(Math.abs(w.m2), "R₁");
    if (w.m2 !== 0) op = (w.swapped ? "swap the rows, then " : "") + op + " removes x";
    if (w.kind === "none") return both + " are parallel lines, so no point is on both; next, " + op + " and shows it.";
    if (w.kind === "many") return both + " are the same line, so every point on it is on both; next, " + op + " and shows it.";
    var spot = "the answer is the one point on both " + (inView(w, extent(v, w)) ? "(the ?)" : "(off this view)");
    if (w.m2 === 0) return both + " are two lines; " + spot + ", and " + (w.swapped ? "once the rows are swapped, row 2 has no x and gives y directly." : "row 2 has no x, so it gives y directly.");
    return both + " are two lines; " + spot + ", and next " + op + ".";
  }
  var co = {kind: "integer", min: -6, max: 6}, rh = {kind: "integer", min: -12, max: 12};
  Viz.register("system-of-equations", {
    title: "Solving two equations by elimination",
    subject: "linear-algebra",
    shows: "Step through elimination: subtracting a multiple of one equation kills x, which turns one line horizontal through the crossing, then back-substitution finds x",
    params: {
      a1: Object.assign({default: 2, label: "a_1"}, co), b1: Object.assign({default: 1, label: "b_1"}, co), c1: Object.assign({default: 5, label: "c_1"}, rh),
      a2: Object.assign({default: 1, label: "a_2"}, co), b2: Object.assign({default: -1, label: "b_2"}, co), c2: Object.assign({default: 1, label: "c_2"}, rh)
    },
    steps: ["two lines", "eliminate x", "solve for y", "back-substitute for x"],
    stepMs: 1800,
    formula: function (v) {
      var w = work(v), s = v.step || 1;
      if (s === 1) return "\\begin{cases}" + eq(v.a1, v.b1, v.c1, true) + "\\\\" + eq(v.a2, v.b2, v.c2, true) + "\\end{cases}";
      if (w.noX) return "\\text{no }x\\text{ in either row:}\\ " + eq(0, v.b1, v.c1, true) + ",\\ " + eq(0, v.b2, v.c2, true);
      var op = (w.swapped ? "R_1\\leftrightarrow R_2,\\ " : "") + (w.m2 === 0 ? "R_2\\ \\text{has no }x" : "R_2\\leftarrow " + mult(w.m1, "R_2") + (w.m2 > 0 ? "-" : "+") + mult(Math.abs(w.m2), "R_1"));
      var row = eq(0, w.D, w.E, true);
      if (s === 2) return op + ":\\ " + row;
      if (s === 3) return w.kind === "one" ? "y=\\frac{" + Viz.n(w.E) + "}{" + Viz.n(w.D) + "}=" + Viz.n(w.y) : row + (w.kind === "none" ? "\\ \\text{is never true}" : "\\ \\text{is always true}");
      if (w.kind === "one") return "x=\\frac{" + Viz.n(w.r1[2]) + "-" + Viz.p(w.r1[1]) + "\\cdot" + Viz.p(w.y) + "}{" + Viz.n(w.r1[0]) + "}=" + Viz.n(w.x);
      return w.kind === "none" ? "\\text{no }(x,y)\\text{ solves both}" : "x=\\frac{" + Viz.n(w.r1[2]) + "-" + Viz.p(w.r1[1]) + "y}{" + Viz.n(w.r1[0]) + "},\\ y\\text{ free}";
    },
    status: function (v) {
      var w = work(v), s = v.step || 1;
      if (s === 1) return firstStatus(v, w);
      if (w.noX) return "Neither row has an x, so x is free: " + (w.kind === "many" ? "<b>infinitely many</b> solutions along a horizontal line." : "the rows ask for two different heights, so there is <b>no solution</b>.");
      if (s === 2) return (w.swapped ? "Row 1 has no x, so swap the rows first; then t" : "T") + (w.D !== 0 ? "he new row 2 has <b>no x</b>: it is a horizontal line through the same crossing." :
        "he x and y terms cancel together and leave <b>" + eq(0, 0, w.E, false) + "</b>, because the lines are parallel" + (w.E === 0 ? " and identical." : "."));
      if (w.kind === "none") return "<b>" + eq(0, 0, w.E, false) + "</b> can never hold, so the system has <b>no solution</b>: the lines never meet.";
      if (w.kind === "many") return "<b>0 = 0</b> always holds, so row 2 adds nothing: <b>infinitely many</b> solutions, every point on line 1.";
      if (s === 3) return "Divide by " + Viz.fmt(w.D) + ": <b>y = " + Viz.fmt(w.y) + "</b>, the height where the lines cross.";
      return "Put y = " + Viz.fmt(w.y) + " back into row 1 to get <b>x = " + Viz.fmt(w.x) + "</b>: the solution is <b>(" + Viz.fmt(w.x) + ", " + Viz.fmt(w.y) + ")</b>.";
    },
    examples: [
      {name: "elimination done", values: {step: 4}},
      {name: "row swap needed", values: {a1: 0, b1: 2, c1: 4, a2: 3, b2: 1, c2: 8, step: 2}},
      {name: "parallel: no solution", values: {a1: 1, b1: 2, c1: 4, a2: 2, b2: 4, c2: 3, step: 3}},
      {name: "fractional answer", values: {a1: 3, b1: 1, c1: 7, a2: 1, b2: -2, c2: -3, step: 4}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, W = api.w, H = api.h, w = work(v), s = v.step || 1, e = extent(v, w), big = e > 12, tk = big ? 10 : e > 6 ? 4 : 2;
      var pl = api.plane({x: [-e * 1.5, e * 1.5], y: [-e, e], box: [12, 8, W - 24, H - 40], step: big ? 5 : e > 6 ? 2 : 1, ticks: false, labels: false});
      var O = pl.px([0, 0]), xR = pl.x(e * 1.5), yT = pl.y(e), shown = inView(w, e);
      var tw = function (text, size) { return String(text).length * size * 0.56 + 8; };
      var box = function (at, wd, hh) { return [at[0] - wd / 2, at[1] - hh, at[0] + wd / 2, at[1] + hh]; };
      var meets = function (a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; };
      var crosses = function (sg, b) { // does the segment pass through the box (Liang-Barsky)
        var t0 = 0, t1 = 1, dx = sg[1][0] - sg[0][0], dy = sg[1][1] - sg[0][1], p = [-dx, dx, -dy, dy];
        var q = [sg[0][0] - b[0], b[2] - sg[0][0], sg[0][1] - b[1], b[3] - sg[0][1]];
        for (var i = 0; i < 4; i++) {
          if (p[i] === 0) { if (q[i] < 0) return false; continue; }
          var r = q[i] / p[i]; if (p[i] < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
          if (t0 > t1) return false;
        }
        return true;
      };
      // what a tag must not cover: the arrow tips, the axis letters, marks and earlier tags (tick labels yield)
      var tickLayer = api.group(), ticks = [], avoid = [[xR - 4, O[1] - 6, xR + 8, O[1] + 6], [O[0] - 6, yT - 8, O[0] + 6, yT + 4]];
      var axes = [[[pl.x(-e * 1.5), O[1]], [xR, O[1]]], [[O[0], pl.y(-e)], [O[0], yT]]];
      // the lines first as data, so the tick labels and tags can steer clear of them
      var lines = [], E1 = [v.a1, v.b1, v.c1], E2 = [v.a2, v.b2, v.c2], faded = s >= 2 && !w.noX;
      var add = function (L, color, o, which, text) { // which: 0 = tag at the right/top end, 1 = left/bottom end
        var nn = L[0] * L[0] + L[1] * L[1]; if (!nn) return null;
        var seg = pl.through([L[0] * L[2] / nn, L[1] * L[2] / nn], [-L[1], L[0]]); if (!seg) return null;
        var ln = {L: L, color: color, o: o, which: which, text: text, px: [pl.px(seg[0]), pl.px(seg[1])], faint: o.opacity != null};
        lines.push(ln); return ln;
      };
      // from step 2 the replaced row (row 2 after any swap) fades; each equation keeps its step-1 color; with no single
      // crossing the faded line keeps a faded name, since both parallel lines matter to the verdict
      var keep = add(w.swapped ? E2 : E1, w.swapped ? c.c3 : c.c1, {}, 0);
      add(w.swapped ? E1 : E2, w.swapped ? c.c1 : c.c3, faded ? {dash: "5 6", opacity: 0.45, width: 2} : {}, 1, faded && w.kind === "one" ? false : null);
      if (w.kind === "one" && s >= 2) add([0, w.D, w.E], c.c6, {width: 3.5}, 1, s === 2 ? "new row 2: " + eq(0, w.D, w.E, false) : "y = " + api.fmt(w.y));
      if (w.kind === "one" && s === 4) add([1, 0, w.x], c.c4, {width: 2.5, dash: "7 5"}, 1, "x = " + api.fmt(w.x));
      // each axis letter beside its arrow tip, on the first side no line runs through
      [[[O[0] + 13, yT + 6], [O[0] - 13, yT + 6], "y"], [[xR - 6, O[1] - 11], [xR - 6, O[1] + 13], "x"]].forEach(function (L) {
        var b = function (q) { return [q[0] - 6, q[1] - 8, q[0] + 6, q[1] + 8]; };
        var q = lines.some(function (ln) { return crosses(ln.px, b(L[0])); }) && !lines.some(function (ln) { return crosses(ln.px, b(L[1])); }) ? L[1] : L[0];
        api.label(q, L[2], {color: c.muted, size: 12.5, anchor: "middle", parent: tickLayer}); avoid.push(b(q));
      });
      // tick labels, skipping any that a horizontal or vertical line runs through; drawn last, minus any a tag covers
      var flat = lines.filter(function (ln) { return ln.L[0] === 0 || ln.L[1] === 0; });
      var tick = function (at, val, anchor) {
        var t = api.fmt(val), wd = t.length * 12 * 0.56 + 2;
        var b = anchor === "end" ? [at[0] - wd, at[1] - 7, at[0], at[1] + 7] : [at[0] - wd / 2, at[1] - 7, at[0] + wd / 2, at[1] + 7];
        if (flat.some(function (ln) { return crosses(ln.px, [b[0] - 3, b[1] - 1, b[2] + 3, b[3] + 1]); })) return;
        ticks.push({at: at, t: t, anchor: anchor, b: b});
      };
      // (none at the very ends either, where they would sit on the arrow tips and the plane's edge)
      for (var tx = Math.ceil(-e * 1.5 / tk) * tk; tx <= e * 1.5 + 1e-9; tx += tk) if (tx && Math.abs(tx) < e * 1.5 - 0.5) tick([pl.x(tx), O[1] + 14], tx, "middle");
      for (var ty = Math.ceil(-e / tk) * tk; ty <= e + 1e-9; ty += tk) if (ty && Math.abs(ty) < e - 0.5) tick([O[0] - 6, pl.y(ty)], ty, "end");
      lines.forEach(function (ln) { api.line(ln.px[0], ln.px[1], Object.assign({color: ln.color, width: 3}, ln.o)); });
      var tag = function (at, text, o) { // a label on a card-colored plate, kept whole inside the viewBox
        var wd = tw(text, o.size), x = Math.max(wd / 2 + 2, Math.min(W - wd / 2 - 2, at[0])), y = Math.max(o.size * 0.75 + 2, Math.min(H - o.size * 0.75 - 2, at[1]));
        api.rect(x - wd / 2, y - o.size * 0.75, wd, o.size * 1.5, {fill: c.card, fillOpacity: 0.86, rx: 4});
        api.label([x, y], text, Object.assign({anchor: "middle"}, o));
      };
      var cost = function (b, own) {
        var k = b[0] < 2 || b[1] < 2 || b[2] > W - 2 || b[3] > H - 2 ? 1000 : 0, pb = [b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2];
        avoid.forEach(function (a) { if (meets(b, a)) k += 100; });
        ticks.forEach(function (t) { if (meets(b, t.b)) k += 15; });
        axes.forEach(function (sg) { if (crosses(sg, [b[0] + 4, b[1] + 3, b[2] - 4, b[3] - 3])) k += 50; }); // grazing an axis is fine
        lines.forEach(function (ln) { if (ln !== own && crosses(ln.px, pb)) k += ln.faint ? 6 : 40; });
        return k;
      };
      var place = function (cands, text, size, own) { // cands: [x, y, preference]; the cheapest spot wins
        var wd = tw(text, size), best = null;
        cands.forEach(function (q) { var k = q[2] + cost(box(q, wd, size * 0.75), own); if (!best || k < best[2]) best = [q[0], q[1], k]; });
        avoid.push(box(best, wd, size * 0.75));
        return best;
      };
      var foot = null, Xp = w.kind === "one" ? pl.px([w.x, w.y]) : null;
      if (w.kind === "one") {
        if (s === 1 && shown) {
          api.circle(Xp, 11, {stroke: c.ink, width: 1.6, dash: "3 3"}); avoid.push([Xp[0] - 12, Xp[1] - 12, Xp[0] + 12, Xp[1] + 12]);
          api.label(place([[Xp[0] + 21, Xp[1] - 13, 0], [Xp[0] - 21, Xp[1] - 13, 1], [Xp[0] + 21, Xp[1] + 13, 1], [Xp[0] - 21, Xp[1] + 13, 2]], "?", 15), "?", {color: c.ink, size: 15, weight: 700, anchor: "middle"});
        }
        if (s === 3 && Math.abs(w.y) <= e) { var Yp = pl.px([0, w.y]); api.point(Yp, {color: c.c6, r: 6}); avoid.push([Yp[0] - 7, Yp[1] - 7, Yp[0] + 7, Yp[1] + 7]); }
        if (s === 4 && shown) { api.circle(Xp, 12, {stroke: c.c4, width: 2.2}); api.point(Xp, {color: c.ink, r: 5}); avoid.push([Xp[0] - 13, Xp[1] - 13, Xp[0] + 13, Xp[1] + 13]); }
        if (!shown && s >= 3) foot = ["the crossing (" + api.fmt(w.x, 1) + ", " + api.fmt(w.y, 1) + ") is off the view", c.c4];
      } else if (s >= 2) {
        var bad = w.kind === "none", col = bad ? c.c5 : c.c2;
        if (s === 2 && !w.noX) foot = ["new row 2: " + eq(0, 0, w.E, false), col];
        if (s >= 3 || w.noX) foot = [bad ? "no point is on both lines: no solution" : "every point on the line solves both", col];
        if (s === 4 && !bad && keep) for (var t = 0.15; t < 0.9; t += 0.14) {
          var q = [keep.px[0][0] + (keep.px[1][0] - keep.px[0][0]) * t, keep.px[0][1] + (keep.px[1][1] - keep.px[0][1]) * t];
          api.point(q, {color: c.c2, r: 4}); avoid.push([q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5]);
        }
        if (s === 4 && bad) api.rect(14, 10, W - 28, H - 44, {stroke: c.c5, width: 2, dash: "6 5", rx: 8});
      }
      if (foot) { tag([W / 2, H - 13], foot[0], {color: foot[1], size: 12.5, weight: 650}); avoid.push(box([W / 2, H - 13], tw(foot[0], 12.5), 10)); }
      // the answer's tag goes in the quadrant away from both axes when that spot is clear
      if (s === 4 && shown) {
        var pt = "(" + api.fmt(w.x) + ", " + api.fmt(w.y) + ")", pw = tw(pt, 13), sx = Xp[0] >= O[0] ? 1 : -1, sy = Xp[1] <= O[1] ? -1 : 1, cs = [];
        [[sx, sy, 0], [sx, -sy, 3], [-sx, sy, 3], [-sx, -sy, 6]].forEach(function (d) {
          for (var k = 0; k < 4; k++) cs.push([Xp[0] + d[0] * (pw / 2 + 14 + k * 8), Xp[1] + d[1] * (16 + k * 5), d[2] + k]);
        });
        tag(place(cs, pt, 13), pt, {color: c.c4, size: 13, weight: 700});
      }
      // each line's equation beside its chosen end, slid along the line (either side) until it covers nothing
      lines.slice().reverse().forEach(function (ln) {
        if (ln.text === false) return;
        var P0 = ln.px[0], P1 = ln.px[1], pick = (P0[0] - P1[0]) || (P1[1] - P0[1]);
        var far = (ln.which === 0) === (pick > 0) ? P0 : P1, near = far === P0 ? P1 : P0, len = Math.hypot(near[0] - far[0], near[1] - far[1]);
        if (len < 1) return;
        var txt = ln.text || eq(ln.L[0], ln.L[1], ln.L[2], false), wd = tw(txt, 12.5), ux = (near[0] - far[0]) / len, uy = (near[1] - far[1]) / len;
        var nx = -uy, ny = ux; if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
        var off = Math.abs(nx) * wd / 2 + Math.abs(ny) * 10 + 5, base = Math.min(len / 2, wd / 2 * Math.abs(ux) + 18), cs = [];
        for (var a = base, k = 0; a <= Math.max(base, len - base) + 1e-9; a += 14, k++) {
          cs.push([far[0] + ux * a + nx * off, far[1] + uy * a + ny * off, k * 0.5]);
          cs.push([far[0] + ux * a - nx * off, far[1] + uy * a - ny * off, k * 0.5 + 5]);
        }
        tag(place(cs, txt, 12.5, ln), txt, {color: ln.color, size: 12.5, weight: 650, opacity: ln.faint ? 0.75 : null});
      });
      ticks.forEach(function (t) { if (!avoid.some(function (a) { return meets(t.b, a); })) api.label(t.at, t.t, {color: c.muted, size: 12, anchor: t.anchor, parent: tickLayer}); });
    }
  });
})();
