// A eukaryotic flagellum (a sperm tail) swims by passing bends from base to tip. Inside is the 9+2 axoneme: dynein arms on
// each outer doublet use ATP to walk along the next doublet; nexin links and radial spokes stop the doublets sliding past
// each other freely, so sliding becomes bending, and the bend travels down the tail. At a cell's low Reynolds number only
// drag matters, and a thin filament is about twice as hard to drag sideways as lengthwise (drag ratio rho ~ 2), so a wave
// running backward along it pushes water back and the cell forward. Resistive-force theory for a planar sine wave
// y = A sin(k x - w t), k = 2 pi / lambda, wave speed c = f lambda, gives U / c = (rho - 1) S / (1 + (rho - 1) S), with
// S = <sin^2 theta> the arc-length mean over the tail's angle; with rho = 2 that is U = c S / (1 + S), which for small
// amplitude is Taylor's U ~ c (kA)^2 / 2. Tail alone: a head's drag slows a real sperm (human sperm swim ~50-100 um/s).
// The tail keeps its 50 um length, so a deeper wave spans less distance. Steps are quarter beats: the bends move tipward
// while the cell moves forward U T / 4. Colors: teal = the cell and its speed, amber = the bending wave, blue = water
// pushed back, purple = dynein.
(function () {
  var PX = 4.6, LT = 50;   // pixels per um; tail length in um
  function swim(v) {
    var k = 2 * Math.PI / v.lam, N = 400, sumL = 0, sumS = 0;
    for (var i = 0; i < N; i++) {
      var sl = v.A * k * Math.cos(k * (i + 0.5) / N * v.lam), ds = Math.sqrt(1 + sl * sl);
      sumL += ds; sumS += sl * sl / (1 + sl * sl) * ds;
    }
    var S = sumS / sumL, c = v.f * v.lam;
    return {k: k, S: S, c: c, U: c * S / (1 + S), stretch: sumL / N};
  }

  Viz.register("eukaryotic-flagellum-propulsion", {
    title: "Eukaryotic flagellum propulsion",
    subject: "biology",
    shows: "Set the beat frequency, wavelength and amplitude of a sperm tail and step through a beat: bends run from base to tip, push water back, and the cell swims head-first at a speed set by how steep the wave is",
    params: {
      f: {kind: "integer", default: 20, min: 5, max: 60, label: "f\\ (\\text{Hz})"},
      lam: {kind: "integer", default: 40, min: 20, max: 60, label: "\\lambda\\ (\\mu\\text{m})"},
      A: {kind: "number", default: 4, min: 0, max: 10, step: 0.5, label: "A\\ (\\mu\\text{m})"}
    },
    steps: ["t = 0", "t = T/4", "t = T/2", "t = 3T/4"],
    stepMs: 900,
    formula: function (v) {
      var w = swim(v);
      return "c=f\\lambda=" + v.f + "\\cdot" + v.lam + "=" + Viz.n(w.c, 0) + "\\ \\mu\\text{m/s}\\newline S=\\langle\\sin^2\\theta\\rangle=" + Viz.n(w.S, 2) +
        "\\newline U=c\\,\\tfrac{S}{1+S}=" + Viz.n(w.U, 0) + "\\ \\mu\\text{m/s}";
    },
    status: function (v) {
      var w = swim(v);
      if (v.A === 0) return "With zero amplitude the flagellum stays straight and pushes no water, so the cell does <b>not move</b>.";
      return "Bends run from base to tip at <b>" + Viz.fmt(w.c, 0) + " µm/s</b> and push water backward, so the cell swims head-first at about <b>" +
        Viz.fmt(w.U, 0) + " µm/s</b>, " + Viz.fmt(w.U / v.f, 1) + " µm per beat.";
    },
    examples: [
      {name: "straight tail: no thrust", values: {A: 0}},
      {name: "slow, shallow beat", values: {f: 5, lam: 20, A: 0.5}},
      {name: "fast, deep beat", values: {f: 60, lam: 60, A: 10, step: 3}},
      {name: "short steep waves", values: {f: 60, lam: 20, A: 10, step: 2}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, w = swim(v), y0 = 100, phi = 2 * Math.PI * (s - 1) / 4;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var x0 = 282, xb = x0 + (s - 1) * (w.U / (4 * v.f)) * PX, Lx = LT / w.stretch;
      // the tail: a sine wave of fixed arc length, its amplitude ramping up over the first 8 um from the head
      var pts = [];
      for (var j = 0; j <= 240; j++) {
        var u = Lx * j / 240, env = Math.min(1, u / 8);
        pts.push([xb - u * PX, y0 - v.A * env * Math.sin(w.k * u - phi) * PX]);
      }
      api.line([x0 + 26, y0 - 34], [x0 + 26, y0 + 34], {color: c.faint, width: 1.2, dash: "3 4"});
      L([x0 + 26, y0 - 42], "start", c.muted, {anchor: "middle", weight: 500});
      api.polyline(pts, {stroke: c.c1, width: 3});
      api.path("M " + xb + " " + y0 + " A 13 8 0 1 0 " + (xb + 26) + " " + y0 + " A 13 8 0 1 0 " + xb + " " + y0, {stroke: c.c1, width: 2, fill: c.c1, fillOpacity: 0.35});
      L([xb + 13, y0 + 20], "head", c.c1, {anchor: "middle", weight: 500});
      // the two outcomes: water goes back, the cell goes forward
      api.arrow([62, 24], [16, 24], {color: c.c2, width: 2.4, halo: false, head: 9});
      L([68, 24], "water pushed back", c.c2, {weight: 500});
      if (w.U > 0.05) {
        var len = 12 + 40 * Math.min(1, w.U / 600);
        L([232, 24], "swims " + Viz.fmt(w.U, 0) + " µm/s", c.c1);
        api.arrow([334, 24], [334 + len, 24], {color: c.c1, width: 2.6, halo: false, head: 9});
      } else L([232, 24], "no thrust", c.c1);
      // the wave runs from base (head end) to tip
      if (v.A > 0) {
        api.arrow([xb - 12, 166], [Math.max(24, xb - Lx * PX + 8), 166], {color: c.c3, width: 2.2, halo: false, head: 9});
        L([(xb + Math.max(24, xb - Lx * PX)) / 2, 182], "bends travel base → tip at c = " + Viz.fmt(w.c, 0) + " µm/s", c.c3, {anchor: "middle"});
      } else L([160, 172], "straight tail: no bend travels", c.c3, {anchor: "middle", weight: 500});
      // the engine: a 9+2 axoneme in cross-section
      var C = [58, 252];
      api.circle(C, 44, {stroke: c.muted, width: 1.5});
      for (var i = 0; i < 9; i++) {
        var a = (-90 + i * 40) * Math.PI / 180, ra = [Math.cos(a), Math.sin(a)], tg = [-Math.sin(a), Math.cos(a)];
        var A0 = [C[0] + 31 * ra[0], C[1] + 31 * ra[1]];
        api.line([C[0] + 13 * ra[0], C[1] + 13 * ra[1]], [C[0] + 25 * ra[0], C[1] + 25 * ra[1]], {color: c.faint, width: 1});
        api.circle(A0, 5, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.4});
        api.circle([A0[0] + 7.5 * tg[0] + 1.5 * ra[0], A0[1] + 7.5 * tg[1] + 1.5 * ra[1]], 4.2, {stroke: c.c1, width: 1.4});
        api.line([A0[0] - 5 * tg[0], A0[1] - 5 * tg[1]], [A0[0] - 11 * tg[0] + 3 * ra[0], A0[1] - 11 * tg[1] + 3 * ra[1]], {color: c.c6, width: 2.2});
        api.line([A0[0] - 5 * tg[0] - 3 * ra[0], A0[1] - 5 * tg[1] - 3 * ra[1]], [A0[0] - 10 * tg[0] - 3 * ra[0], A0[1] - 10 * tg[1] - 3 * ra[1]], {color: c.c6, width: 2.2});
      }
      api.circle([C[0] - 5, C[1]], 4.2, {stroke: c.c1, width: 1.4}); api.circle([C[0] + 5, C[1]], 4.2, {stroke: c.c1, width: 1.4});
      L([C[0], 304], "9 + 2 axoneme", c.muted, {anchor: "middle", weight: 500});
      L([118, 216], "dynein arms use ATP to slide", c.c6);
      L([118, 234], "each doublet past its neighbor;", c.muted, {weight: 500});
      L([118, 252], "links tie the doublets together,", c.muted, {weight: 500});
      L([118, 270], "so the sliding bends the tail", c.muted, {weight: 500});
      L([118, 292], "bacteria instead spin a rigid helix", c.muted, {weight: 500});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
