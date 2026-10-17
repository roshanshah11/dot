// PCR's exponential phase: each cycle copies a fraction E of the templates (E = 1 is perfect doubling), so after n
// cycles N = N0 (1 + E)^n. The bars are the copies after each cycle; the dashed outlines are perfect doubling, so the
// gap between them is what a slightly imperfect efficiency costs. On a linear axis nearly everything appears in the
// last few cycles (the last 3 make 1 - (1+E)^-3 of the DNA); on a log axis the same growth is a straight line.
// Real reactions leave this phase and plateau once primers and dNTPs run low; this is the phase the formula describes.
(function () {
  var SUP = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻"};
  function parts(x) { var e = Math.floor(Math.log10(x) + 1e-12), m = x / Math.pow(10, e); if (m >= 9.995) { m = 1; e += 1; } return [m, e]; }
  function sci(x) {   // text: 3,800 or 3.8 × 10⁶
    if (x < 1e4) return Math.round(x).toLocaleString("en-US");
    var q = parts(x); return Viz.fmt(q[0], 2) + " × 10" + String(q[1]).split("").map(function (d) { return SUP[d]; }).join("");
  }
  function sup(k) { return String(k).split("").map(function (d) { return SUP[d]; }).join(""); }
  function tex(x) {   // LaTeX: 3{,}800 or 3.76\times10^{6}
    if (x < 1e4) return Math.round(x).toLocaleString("en-US").replace(/,/g, "{,}");
    var q = parts(x); return Viz.n(q[0], 2) + "\\times10^{" + q[1] + "}";
  }
  function model(v) { var g = 1 + v.E; return {g: g, N: v.N0 * Math.pow(g, v.n), ideal: v.N0 * Math.pow(2, v.n), short: Math.pow(2 / g, v.n)}; }

  Viz.register("pcr-exponential-dna-amplification", {
    title: "PCR: exponential amplification",
    subject: "biology",
    shows: "Slide the cycles, the efficiency and the starting copies: the copies grow as N0(1 + E)^n, a hockey stick on a linear axis and a straight line on a log axis",
    params: {
      n: {kind: "integer", default: 20, min: 0, max: 35, label: "n"},
      E: {kind: "number", default: 0.9, min: 0.5, max: 1, step: 0.05, label: "E"},
      N0: {kind: "integer", default: 10, min: 1, max: 1000, label: "N_0"},
      scale: {kind: "enum", values: ["linear", "log"], default: "linear", label: "\\text{axis}"}
    },
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{l}N=N_0(1+E)^n\\\\ \\phantom{N}=" + v.N0 + "\\cdot" + Viz.n(m.g, 2) + "^{" + v.n + "}=" + tex(m.N) + "\\end{array}";
    },
    status: function (v) {
      var m = model(v);
      if (v.n === 0) return "Before the first cycle there " + (v.N0 > 1 ? "are just the <b>" + v.N0 + "</b> starting templates." : "is just <b>one</b> starting template.");
      if (v.E === 1) return "Perfect doubling: " + v.n + " cycle" + (v.n > 1 ? "s" : "") + " multiply " + sci(v.N0) + " cop" + (v.N0 > 1 ? "ies" : "y") + " by 2" + sup(v.n) + " to <b>" + sci(m.N) + "</b>.";
      return "Each cycle multiplies by " + Viz.fmt(m.g, 2) + ", not 2, so " + v.n + " cycles give <b>" + sci(m.N) + "</b> copies, <b>" +
        (m.short < 10 ? Viz.fmt(m.short, 1) : sci(m.short)) + "×</b> fewer than perfect doubling.";
    },
    examples: [
      {name: "fewest: no cycles, half efficiency", values: {n: 0, E: 0.5, N0: 1}},
      {name: "most: 35 perfect cycles from 1000", values: {n: 35, E: 1, N0: 1000, scale: "log"}},
      {name: "single molecule, 30 cycles", values: {n: 30, E: 0.95, N0: 1}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = model(v), n = v.n, log = v.scale === "log";
      var X0 = 62, X1 = 384, Y0 = 236, Y1 = 46, span = Math.max(n, 5), bw = (X1 - X0) / (span + 1);
      // linear: scale to the actual curve and clip the perfect-doubling outlines at a ceiling; log: room for both
      var top = log ? m.ideal * 2 : m.N * 1.12, bot = log ? v.N0 / 2 : 0, ceil = Y1 - 4;
      var yv = function (val) {
        if (log) return Y0 - (Y0 - Y1) * (Math.log10(val) - Math.log10(bot)) / (Math.log10(top) - Math.log10(bot));
        return Y0 - (Y0 - Y1) * val / top;
      };
      // axes and ticks
      api.line([X0, Y0], [X1, Y0], {color: c.axis, width: 1.2});
      api.line([X0, Y0], [X0, Y1 - 8], {color: c.axis, width: 1.2});
      if (log) {
        var d0 = Math.ceil(Math.log10(bot)), d1 = Math.floor(Math.log10(top)), every = Math.max(1, Math.ceil((d1 - d0 + 1) / 5));
        for (var d = d0; d <= d1; d++) {
          api.line([X0 - 4, yv(Math.pow(10, d))], [X1, yv(Math.pow(10, d))], {color: c.grid, width: 1});
          if ((d - d0) % every === 0) api.label([X0 - 7, yv(Math.pow(10, d))], d < 4 ? String(Math.pow(10, d)) : "10" + sup(d), {color: c.muted, size: 12, anchor: "end", raw: true});
        }
      } else {
        var raw = top / 3, mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 5, 10].map(function (f) { return f * mag; }).filter(function (q) { return q >= raw; })[0];
        for (var t = st; t <= top * 1.0001; t += st) {   // round ticks: 1, 2 or 5 times a power of ten
          api.line([X0 - 4, yv(t)], [X1, yv(t)], {color: c.grid, width: 1});
          api.label([X0 - 7, yv(t)], t < 10 ? Viz.fmt(t, 1) : sci(t), {color: c.muted, size: 12, anchor: "end"});
        }
        api.label([X0 - 7, Y0], "0", {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([X0 - 40, 20], "copies (" + v.scale + " axis)", {color: c.muted, size: 12});
      // bars: actual copies after each cycle, dashed outline = perfect doubling
      var tickEvery = span <= 10 ? 1 : 5, clipped = false;
      for (var k = 0; k <= n; k++) {
        var x = X0 + bw * (k + 0.5), w = Math.max(2, bw * 0.72), val = v.N0 * Math.pow(m.g, k), ide = v.N0 * Math.pow(2, k);
        var yi = yv(ide), ya = yv(val);
        if (v.E < 1 && yi >= ceil) api.rect(x - w / 2, yi, w, Y0 - yi, {rx: 1.5, stroke: c.muted, width: 1, dash: "3 2"});
        else if (v.E < 1) {   // off the top: open-ended sides only
          clipped = true;
          api.path("M " + (x - w / 2) + " " + Y0 + " V " + ceil + " M " + (x + w / 2) + " " + ceil + " V " + Y0, {stroke: c.muted, width: 1, dash: "3 2"});
        }
        api.rect(x - w / 2, ya, w, Math.max(0.5, Y0 - ya), {rx: 1.5, fill: c.c3, fillOpacity: k === n ? 1 : 0.55});
      }
      for (k = 0; k <= span; k += tickEvery) api.label([X0 + bw * (k + 0.5), Y0 + 13], String(k), {color: c.muted, size: 12, anchor: "middle"});
      if (n % tickEvery) api.label([X0 + bw * (n + 0.5), Y0 + 13], String(n), {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.label([X1, Y0 + 32], "cycle", {color: c.muted, size: 12, anchor: "end"});
      // the value at cycle n
      var xn = X0 + bw * (n + 0.5), yn = yv(m.N);
      var nl = api.label([Math.min(xn, X1 - 4), yn - 12], "N = " + sci(m.N), {color: c.c3, size: 13, weight: 700, anchor: n > span / 2 ? "end" : "start"});
      nl.setAttribute("stroke", c.card); nl.setAttribute("stroke-width", 4); nl.setAttribute("stroke-linejoin", "round"); nl.setAttribute("paint-order", "stroke");
      if (v.E < 1 && n > 0) api.label([X1, 20], "dashed: perfect doubling", {color: c.muted, size: 12, anchor: "end"});
      if (clipped) api.label([X1, 33], "↑ doubling would reach " + sci(m.ideal), {color: c.muted, size: 12, anchor: "end"});
      // what the axis teaches
      var note = log ? "straight line: up " + Viz.fmt(Math.log10(m.g), 2) + " decades per cycle" :
        n >= 3 ? "last 3 cycles made " + Math.round(100 * (1 - Math.pow(m.g, -3))) + "% of the DNA" : "×" + Viz.fmt(m.g, 2) + " each cycle";
      api.label([X0 - 40, Y0 + 32], note, {color: c.ink, size: 12.5, weight: 600});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
