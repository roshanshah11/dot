// Rolling dice: what you see vs what you should expect. The bars are the share of rolls that landed on each total; the
// dots are the exact chance, the number of ways to make that total over 6^k. One die is flat, two make a triangle peaking
// at 7, more dice round it into a bell. The rolls are one fixed seeded sequence (mulberry32), so adding rolls extends the
// same run and the bars settle onto the dots (the law of large numbers). Queue entry has no schema: dice and rolls are
// Dot's own.
(function () {
  var MAXR = 1000, FACES = (function () {
    var s = 2026, out = [];
    function rnd() { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    for (var i = 0; i < MAXR * 4; i++) out.push(1 + Math.floor(rnd() * 6));
    return out;
  })();
  function ways(k) { // number of ways to roll each total with k dice, by repeated convolution
    var w = [1];
    for (var d = 0; d < k; d++) { var nw = []; for (var i = 0; i < w.length + 6; i++) nw.push(0); w.forEach(function (x, i) { for (var f = 1; f <= 6; f++) nw[i + f] += x; }); w = nw; }
    return w; // index = total
  }
  function calc(v) {
    var k = v.dice, w = ways(k), tot = Math.pow(6, k), counts = {}, s, i;
    for (s = k; s <= 6 * k; s++) counts[s] = 0;
    for (i = 0; i < v.rolls; i++) { var sum = 0; for (var d = 0; d < k; d++) sum += FACES[i * 4 + d]; counts[sum]++; }
    var wmax = Math.max.apply(null, w), modes = [], gap = 0, gapAt = k;
    for (s = k; s <= 6 * k; s++) {
      if (w[s] === wmax) modes.push(s); // every total that ties for the most ways (10 and 11 with 3 dice)
      var g = Math.abs(counts[s] * tot - w[s] * v.rolls) / (v.rolls * tot); if (g > gap) { gap = g; gapAt = s; } // integer numerator: an exact half (0.055) rounds up
    }
    if (k === 1) modes = [3]; // every face ties at 1/6: the status says so and the formula reports one of them
    var hot = {}; if (k > 1) modes.forEach(function (m) { hot[m] = true; });
    return {k: k, w: w, tot: tot, counts: counts, modes: modes, mode: modes[0], hot: hot, gap: gap, gapAt: gapAt, last: FACES.slice((v.rolls - 1) * 4, (v.rolls - 1) * 4 + k)};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };

  Viz.register("dice-rolling", {
    title: "Rolling dice: chance vs what you see",
    subject: "stats",
    shows: "Add dice and rolls: the exact chance of each total is ways / 6^k (flat for one die, a triangle for two, a bell for more), and the rolled shares settle onto it",
    params: {
      dice: {kind: "integer", default: 2, min: 1, max: 4, label: "\\text{dice}"},
      rolls: {kind: "integer", default: 60, min: 1, max: MAXR, label: "\\text{rolls}"}
    },
    formula: function (v) {
      var q = calc(v), m = q.mode, ms = q.modes, def = "P(S=s)", ways = "\\frac{\\text{ways to make }s}{6^{" + q.k + "}}";
      var ex = "\\frac{" + q.w[m] + "}{" + q.tot + "}=" + Viz.n(q.w[m] / q.tot, 3);
      var rolled = function (s) { return "\\frac{" + q.counts[s] + "}{" + v.rolls + "}=" + Viz.n(q.counts[s] / v.rolls, 3); };
      if (ms.length === 1) return "\\begin{array}{l}" + def + "=" + ways + "\\\\[2pt]P(S=" + m + ")=" + ex + "\\\\[2pt]\\text{rolled: }\\hat p=" + rolled(m) + "\\end{array}";
      // a tie (10 and 11 with 3 dice) is too wide for one line: align on the equals signs instead
      var eq = "&\\textstyle{}=";  // aligned cells default to display style; keep the fractions text-sized like the other lines
      var rows = [def + eq + ways, "P(S=" + ms[0] + ")" + eq + ms.slice(1).map(function (s) { return "P(S=" + s + ")"; }).join("=") + "\\\\" + eq + ex];
      ms.forEach(function (s, i) { rows.push((i ? "" : "\\text{rolled: }") + "\\hat p_{" + s + "}" + eq + rolled(s)); });
      return "\\begin{aligned}" + rows.join("\\\\[2pt]") + "\\end{aligned}";
    },
    status: function (v) {
      var q = calc(v), m = q.mode, n = v.rolls, ms = q.modes;
      var lead = q.k === 1 ? "Every face has the same chance, 1/6 ≈ 0.167" : ms.length > 1 ?
        "The likeliest totals with " + q.k + " dice are <b>" + ms.slice(0, -1).join(", ") + " and " + ms[ms.length - 1] + "</b> (" + q.w[m] + " of " + q.tot + " ways each, " + f(q.w[m] / q.tot) + ")" :
        "The likeliest total with " + q.k + " dice is <b>" + m + "</b> (" + q.w[m] + " of " + q.tot + " ways, " + f(q.w[m] / q.tot) + ")";
      if (n === 1) return lead + ", but one roll can only land on one total, so a single bar shoots to 1.";
      return lead + "; after " + n + " rolls the biggest gap between a bar and its dot is <b>" + f(q.gap + 1e-12, 2) + "</b> (at " + q.gapAt + "), and it tends to shrink as rolls pile up.";
    },
    examples: [
      {name: "one die: flat", values: {dice: 1, rolls: 600}},
      {name: "two dice: a triangle at 7", values: {dice: 2, rolls: 1000}},
      {name: "three dice: 10 and 11 tie", values: {dice: 3, rolls: 200}},
      {name: "every input at its minimum", values: {dice: 1, rolls: 1}},
      {name: "every input at its maximum", values: {dice: 4, rolls: 1000}},
      {name: "few rolls: noisy", values: {dice: 2, rolls: 20}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, q = calc(v), k = q.k, lo = k, hi = 6 * k, nS = hi - lo + 1;
      // the last roll, as dice faces
      var PIPS = {1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
                  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]};
      api.label([14, 24], "roll " + v.rolls + ":", {color: c.muted, size: 12.5});
      var dx = 82, sum = 0;
      q.last.forEach(function (face, i) {
        var cx = dx + i * 32 + 13, cy = 24; sum += face;
        api.rect(cx - 13, cy - 13, 26, 26, {fill: c.ink, fillOpacity: 0.92, rx: 5});
        PIPS[face].forEach(function (p) { api.circle([cx + p[0] * 6.5, cy + p[1] * 6.5], 2.4, {fill: c.card}); });
      });
      api.label([dx + k * 32 + 4, 24], "= " + sum, {color: c.ink, size: 14, weight: 650});
      api.rect(262, 12, 11, 11, {fill: c.c2, fillOpacity: 0.7, rx: 2});
      api.label([278, 18], "share rolled", {color: c.c2, size: 12});
      api.circle([267.5, 36], 4.5, {fill: c.c3});
      api.label([278, 36], "exact chance", {color: c.c3, size: 12});
      // the distribution
      var x0 = 46, x1 = 392, base = 248, top = 60, bw = (x1 - x0) / nS;
      var pMax = 0, s;
      for (s = lo; s <= hi; s++) pMax = Math.max(pMax, q.counts[s] / v.rolls, q.w[s] / q.tot);
      var ymax = [0.1, 0.15, 0.2, 0.3, 0.4, 0.6, 0.8, 1].filter(function (m) { return pMax <= m * 0.94; })[0] || 1;
      var Y = function (p) { return base - (base - top) * p / ymax; }, tick = ymax <= 0.2 ? 0.05 : ymax <= 0.4 ? 0.1 : 0.2;
      for (var t = 0; t <= ymax + 1e-9; t += tick) {
        api.line([x0, Y(t)], [x1, Y(t)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(t)], api.fmt(t, 2), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.3});
      var every = nS <= 11 ? 1 : nS <= 16 ? 2 : 4, dots = [];
      for (s = lo; s <= hi; s++) {
        var xc = x0 + (s - lo + 0.5) * bw, obs = q.counts[s] / v.rolls, ex = q.w[s] / q.tot;
        if (obs > 0) api.rect(xc - bw * 0.36, Y(obs), bw * 0.72, base - Y(obs), {fill: c.c2, fillOpacity: q.hot[s] ? 0.85 : 0.55, rx: 2});
        dots.push([xc, Y(ex)]);
        // the likeliest totals always get a label, even between the every-other ones
        if (q.hot[s] || (s - lo) % every === 0 || s === hi) api.label([xc, base + 13], String(s), {color: q.hot[s] ? c.ink : c.muted, size: 12, anchor: "middle", weight: q.hot[s] ? 650 : 500});
      }
      api.polyline(dots, {stroke: c.c3, width: 1.6, opacity: 0.8});
      dots.forEach(function (d) { api.circle(d, nS > 16 ? 3 : 4, {fill: c.c3}); });
      if (k > 1) { // one label over the likeliest total, or one "each" label centred over a tied pair
        var ms = q.modes, mx = x0 + ((ms[0] + ms[ms.length - 1]) / 2 - lo + 0.5) * bw, my = Infinity;
        var txt = q.w[q.mode] + "/" + q.tot + (ms.length > 1 ? " each" : ""), half = txt.length * 12.5 * 0.28 + 2;
        for (s = lo; s <= hi; s++) { // sit above every bar and dot the label spans, not only the likeliest ones
          var sx = x0 + (s - lo + 0.5) * bw;
          if (Math.abs(sx - mx) < half + bw * 0.36) my = Math.min(my, Y(q.w[s] / q.tot), Y(q.counts[s] / v.rolls));
        }
        api.label([mx, Math.max(50, my - 13)], txt, {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      }
      api.label([(x0 + x1) / 2, 286], k === 1 ? "face rolled" : "total of " + k + " dice", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
