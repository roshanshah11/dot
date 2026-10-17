// The eukaryotic cell cycle in time. A typical human cell in culture takes about 24 h: G1 ~11 h, S ~8 h, G2 ~4 h,
// M ~1 h. G1 is the phase that varies most between cell types (early embryo cycles skip it), so its length is a
// slider; S, G2 and M are held at 8, 4 and 1 h. DNA per cell is 2C in G1, rises linearly to 4C through S, stays 4C
// through G2 and M and halves at cytokinesis. Starting from one newborn cell whose descendants divide in step, the
// count after t hours is N = 2^floor(t / T). Mitosis is split into prophase (with prometaphase) 0-0.4 h, metaphase
// 0.4-0.7 h, anaphase 0.7-0.8 h and telophase with cytokinesis 0.8-1 h: rough, typical proportions. 2n = 4 is drawn
// (a long and a short pair; blue from one parent, purple from the other).
(function () {
  var S = 8, G2 = 4, M = 1;
  function phase(v) {
    var T = v.g1 + S + G2 + M, gen = Math.floor(v.t / T + 1e-9), tau = Math.round((v.t - gen * T) * 1000) / 1000, p, dna, sub = "", f = 0;
    if (tau < v.g1) { p = "G1"; dna = 2; }
    else if (tau < v.g1 + S) { p = "S"; f = (tau - v.g1) / S; dna = 2 + 2 * f; }
    else if (tau < v.g1 + S + G2) { p = "G2"; dna = 4; }
    else { p = "M"; dna = 4; var m = Math.round((tau - v.g1 - S - G2) * 1000) / 1000; sub = m < 0.4 ? "prophase" : m < 0.7 ? "metaphase" : m < 0.8 ? "anaphase" : "telophase"; }
    return {T: T, gen: gen, N: Math.pow(2, gen), tau: tau, p: p, sub: sub, dna: dna, f: f};
  }
  var WHAT = {G1: "growing and making proteins before it copies its DNA", S: "copying its chromosomes", G2: "with every chromosome copied, checking them and getting ready to divide",
    prophase: "chromosomes condensing into sister-chromatid pairs as the nuclear envelope breaks down", metaphase: "chromosomes lined up across the middle of the spindle",
    anaphase: "sister chromatids pulled apart to opposite poles", telophase: "two nuclei re-forming as the cell pinches in two"};
  Viz.register("cell-cycle", {
    title: "The cell cycle in hours",
    subject: "biology",
    shows: "Slide the clock through G1, S, G2 and mitosis: the DNA per cell climbs from 2C to 4C during S and halves at division, and changing G1 changes how fast the cells multiply",
    params: {
      t: {kind: "number", default: 23.5, min: 0, max: 48, step: 0.1, label: "t\\ (\\text{h})"},
      g1: {kind: "number", default: 11, min: 0, max: 20, step: 0.5, label: "G_1\\ (\\text{h})"}
    },
    formula: function (v) {
      var q = phase(v);
      return "T=\\underbrace{" + Viz.n(v.g1) + "}_{G_1}+\\underbrace{8}_{S}+\\underbrace{4}_{G_2}+\\underbrace{1}_{M}=" + Viz.n(q.T) + "\\ \\text{h}\\newline N=2^{\\lfloor t/T\\rfloor}=2^{\\lfloor " + Viz.n(v.t, 1) + "/" + Viz.n(q.T) + "\\rfloor}=" + q.N;
    },
    status: function (v) {
      var q = phase(v), name = q.p === "M" ? q.sub : q.p === "S" ? "S phase" : q.p;
      var lead = q.gen ? "After " + q.gen + " division" + (q.gen > 1 ? "s" : "") + " there are <b>" + q.N + " cells</b>, each" : "The cell is";
      return lead + " in <b>" + name + "</b> (hour " + Viz.fmt(q.tau, 1) + " of " + Viz.fmt(q.T, 1) + "), " + WHAT[q.p === "M" ? q.sub : q.p] +
        (q.p === "S" ? ": <b>" + Math.round(q.f * 100) + "%</b> done, " + Viz.fmt(q.dna, 2) + "C of DNA." : ", with <b>" + q.dna + "C</b> of DNA.");
    },
    examples: [
      {name: "newborn cell, no G1", values: {t: 0, g1: 0}},
      {name: "two days, long G1", values: {t: 48, g1: 20}},
      {name: "G1", values: {t: 5, g1: 11}},
      {name: "S phase half done", values: {t: 15, g1: 11}},
      {name: "G2", values: {t: 21, g1: 11}},
      {name: "prophase", values: {t: 23.2, g1: 11}},
      {name: "anaphase", values: {t: 23.7, g1: 11}},
      {name: "telophase", values: {t: 23.9, g1: 11}},
      {name: "after one division", values: {t: 30, g1: 11}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, q = phase(v);
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // ---- the ring: arcs in proportion to each phase's hours, clockwise from the top ----
      var cx = 86, cy = 98, R = 54, T = q.T;   // ring bottom (cy + R + 8 = 160) and its labels stay clear of the graph title at 188
      var pos = function (h, r) { var a = (-90 + 360 * h / T) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      var arc = function (h0, h1, r) { var a = pos(h0, r), b = pos(h1, r); return "M " + a[0] + " " + a[1] + " A " + r + " " + r + " 0 " + (h1 - h0 > T / 2 ? 1 : 0) + " 1 " + b[0] + " " + b[1]; };
      var PH = [["G_1", 0, v.g1, c.c1], ["S", v.g1, v.g1 + S, c.c2], ["G_2", v.g1 + S, v.g1 + S + G2, c.c6], ["M", v.g1 + S + G2, T, c.c3]];
      PH.forEach(function (p) {
        if (p[2] - p[1] < 1e-9) return;
        var here = (q.p === "G1" && p[0] === "G_1") || (q.p === "S" && p[0] === "S") || (q.p === "G2" && p[0] === "G_2") || (q.p === "M" && p[0] === "M");
        api.path(arc(p[1] + 0.06, p[2] - 0.06, R), {stroke: p[3], width: 16, opacity: here ? 0.85 : 0.3}).setAttribute("stroke-linecap", "butt");
        var mid = (p[1] + p[2]) / 2;   // labels sit outside the ring, where the "now" marker never covers them
        L(pos(mid, R + 18), p[0], p[3], {anchor: "middle", size: 12.5, weight: 700});
      });
      var me = pos(q.tau, R);
      api.circle(me, 7, {fill: c.ink, stroke: c.card, width: 2});
      L([cx, cy - 8], Viz.fmt(q.tau, 1) + " h", c.ink, {anchor: "middle", size: 13, weight: 650});
      L([cx, cy + 9], "of " + Viz.fmt(T, 1) + " h", c.muted, {anchor: "middle", weight: 500});
      // ---- the cell at this moment ----
      var X = 292, Y = 92, CH = [[26, c.c2, -24], [26, c.c6, -8], [16, c.c2, 8], [16, c.c6, 24]];   // length, parent, position
      var rod = function (x, y, h, col, w) { api.rect(x - (w || 6) / 2, y - h / 2, w || 6, h, {fill: col, rx: 3}); };
      var thread = function (x, y, len, col, dx) {   // a decondensed chromosome: a loose wavy strand
        var pts = []; for (var i = 0; i <= 12; i++) pts.push([x + dx + 1.2 * Math.sin(i * 1.3 + x), y - len / 2 + len * i / 12]);
        api.polyline(pts, {stroke: col, width: 1.8});
      };
      var title = q.p === "M" ? q.sub : q.p === "S" ? "S: DNA synthesis" : q.p === "G1" ? "G₁: growth" : "G₂: ready to divide";
      L([X, 18], title, c.ink, {anchor: "middle", size: 12.5});
      if (q.p !== "M" || q.sub === "prophase" || q.sub === "metaphase") api.circle([X, Y], 50, {stroke: c.muted, width: 1.8});
      if (q.p === "G1" || q.p === "S" || q.p === "G2") {
        api.circle([X, Y], 34, {stroke: c.faint, width: 1.4, fill: c.ink, fillOpacity: 0.03});
        CH.forEach(function (ch) {   // the copy runs 7 px beside its original, from the top down, as far as S has got
          var copied = q.p === "G1" ? 0 : q.p === "S" ? q.f : 1;
          thread(X + ch[2] - (copied > 0 || q.p === "S" ? 3.5 : 0), Y, ch[0], ch[1], 0);
          if (copied > 0) { var lc = ch[0] * copied; thread(X + ch[2] + 3.5, Y - ch[0] / 2 + lc / 2, lc, ch[1], 0); }
        });
        var nC = q.p === "G1" ? 1 : 2;
        for (var k = 0; k < nC; k++) api.circle([X + 38 - k * 8, Y - 30 + k * 4], 3, {fill: c.c4});
      } else if (q.sub === "prophase") {
        api.circle([X, Y], 30, {stroke: c.faint, width: 1.4, dash: "3 4"});
        CH.forEach(function (ch, i) { var x = X - 16 + i * 11, y = Y + (i % 2 ? 6 : -6); rod(x - 3, y, ch[0] * 0.7, ch[1], 5); rod(x + 3, y, ch[0] * 0.7, ch[1], 5); });
        api.circle([X - 42, Y], 3.5, {fill: c.c4}); api.circle([X + 42, Y], 3.5, {fill: c.c4});
      } else if (q.sub === "metaphase") {
        var P1 = [X - 44, Y], P2 = [X + 44, Y];
        CH.forEach(function (ch, i) {
          var y = Y - 27 + i * 18;
          api.line(P1, [X - 6, y], {color: c.c4, width: 1, opacity: 0.7}); api.line(P2, [X + 6, y], {color: c.c4, width: 1, opacity: 0.7});
          rod(X - 3, y, ch[0] * 0.55, ch[1], 5); rod(X + 3, y, ch[0] * 0.55, ch[1], 5);   // sisters face opposite poles
        });
        [P1, P2].forEach(function (p) { api.circle(p, 3.5, {fill: c.c4}); });
      } else if (q.sub === "anaphase") {
        api.path("M " + (X - 62) + " " + Y + " A 62 48 0 1 0 " + (X + 62) + " " + Y + " A 62 48 0 1 0 " + (X - 62) + " " + Y, {stroke: c.muted, width: 1.8});
        var A1 = [X - 46, Y], A2 = [X + 46, Y];
        CH.forEach(function (ch, i) {
          var y = Y - 27 + i * 18;
          [[-1, A1], [1, A2]].forEach(function (s) {
            var x = X + s[0] * 22; api.line(s[1], [x, y], {color: c.c4, width: 1, opacity: 0.7});
            api.rect(s[0] < 0 ? x - ch[0] * 0.7 + 2 : x - 2, y - 2.5, ch[0] * 0.7, 5, {fill: ch[1], rx: 2.5});
          });
        });
        [A1, A2].forEach(function (p) { api.circle(p, 3.5, {fill: c.c4}); });
      } else {
        api.path("M " + X + " " + (Y - 18) + " C " + (X - 20) + " " + (Y - 52) + " " + (X - 92) + " " + (Y - 44) + " " + (X - 92) + " " + Y + " C " + (X - 92) + " " + (Y + 44) + " " + (X - 20) + " " + (Y + 52) + " " + X + " " + (Y + 18) +
          " C " + (X + 20) + " " + (Y + 52) + " " + (X + 92) + " " + (Y + 44) + " " + (X + 92) + " " + Y + " C " + (X + 92) + " " + (Y - 44) + " " + (X + 20) + " " + (Y - 52) + " " + X + " " + (Y - 18), {stroke: c.muted, width: 1.8});
        [-1, 1].forEach(function (s) {
          var nx = X + s * 48; api.circle([nx, Y], 22, {stroke: c.faint, width: 1.4});
          CH.forEach(function (ch, i) { thread(nx - 12 + i * 8, Y, ch[0] * 0.8, ch[1], 0); });
        });
      }
      // ---- DNA per cell over time, with this moment marked ----
      var gx0 = 46, gx1 = 388, y2 = 258, y4 = 212, tx = function (h) { return gx0 + (gx1 - gx0) * h / 48; }, yd = function (d) { return y2 + (y4 - y2) * (d - 2) / 2; };
      L([gx0 - 4, 188], "DNA per cell", c.c2, {weight: 600});
      api.line([gx0, y2 + 8], [gx1, y2 + 8], {color: c.axis, width: 1.2});
      [[2, "2C"], [4, "4C"]].forEach(function (d) { api.line([gx0, yd(d[0])], [gx1, yd(d[0])], {color: c.grid, width: 1}); L([gx0 - 6, yd(d[0])], d[1], c.muted, {anchor: "end", weight: 500}); });
      var pts = [];
      for (var h = 0; h <= 48.001; h += 0.05) pts.push([tx(h), yd(phase({t: h, g1: v.g1}).dna)]);
      api.polyline(pts, {stroke: c.c2, width: 2.2});
      [0, 12, 24, 36, 48].forEach(function (h) { L([tx(h), y2 + 21], h + " h", c.muted, {anchor: "middle", weight: 500}); });
      for (var d = 1; d * T <= 48 + 1e-9; d++) L([tx(d * T), y4 - 9], "×2", c.c3, {anchor: "middle", weight: 650});
      api.line([tx(v.t), y4 - 4], [tx(v.t), y2 + 8], {color: c.accent, width: 1.4, dash: "3 3"});
      api.circle([tx(v.t), yd(q.dna)], 4.5, {fill: c.accent});
      L([132, 188], "· " + q.N + (q.N > 1 ? " cells" : " cell") + " at " + Viz.fmt(v.t, 1) + " h", c.c3, {weight: 650});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
