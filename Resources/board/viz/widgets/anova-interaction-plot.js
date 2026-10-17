// A 2 x 2 experiment: plant growth (cm) under fertilizer (none, added) and water (low, high). The interaction plot
// puts one factor on the x axis and draws a line for each level of the other. The effect of the x-axis factor at
// each line's level is that line's rise (the arrows on the right); the interaction is the difference between those
// two simple effects. Parallel lines mean zero interaction; lines that spread mean a non-crossover interaction;
// lines that cross mean the effect flips sign. Dot's addition: swap which factor sits on the x axis. The picture
// changes but the interaction number does not, because (a - b) - (c - d) = (a - c) - (b - d).
(function () {
  // cell means, growth in cm: MEANS[pattern][water][fertilizer], water 0 = low, 1 = high; fertilizer 0 = none, 1 = added
  var MEANS = {
    "no-interaction": [[10, 16], [18, 24]],
    "non-crossover-interaction": [[10, 13], [16, 28]],
    "crossover-interaction": [[16, 10], [12, 22]]
  };
  var FACT = {fertilizer: {name: "fertilizer", levels: ["none", "added"], lines: ["no fertilizer", "fertilizer"]},
              water: {name: "water", levels: ["low", "high"], lines: ["low water", "high water"]}};
  function calc(v) {
    var m = MEANS[v.initial_pattern], xw = v.xAxis === "water";
    // cell(line, x): the mean for line level i at x level j
    var cell = function (i, j) { return xw ? m[j][i] : m[i][j]; };
    var e = [cell(0, 1) - cell(0, 0), cell(1, 1) - cell(1, 0)];
    var gapL = cell(1, 0) - cell(0, 0), gapR = cell(1, 1) - cell(0, 1);
    return {cell: cell, e: e, inter: e[1] - e[0], cross: gapL * gapR < 0, X: FACT[v.xAxis], L: FACT[xw ? "fertilizer" : "water"]};
  }
  function sgn(x) { return (x > 0 ? "+" : x < 0 ? "−" : "") + Viz.fmt(Math.abs(x)); }

  Viz.register("anova-interaction-plot", {
    title: "Two-way ANOVA interaction plot",
    subject: "stats",
    shows: "Pick a pattern: parallel lines mean no interaction, spreading lines a non-crossover one, crossing lines a crossover one; the interaction is the difference between the two simple effects",
    params: {
      initial_pattern: {kind: "enum", values: ["no-interaction", "non-crossover-interaction", "crossover-interaction"], default: "no-interaction",
        label: "\\text{pattern}", names: {"no-interaction": "none", "non-crossover-interaction": "non-crossover", "crossover-interaction": "crossover"}},
      xAxis: {kind: "enum", values: ["fertilizer", "water"], default: "fertilizer", label: "x\\text{ axis}"}
    },
    formula: function (v) {
      var k = calc(v), a = k.L.levels;
      return "\\begin{array}{l}\\text{interaction}=\\Delta_{\\text{" + a[1] + "}}-\\Delta_{\\text{" + a[0] + "}}\\\\" +
        "\\quad=(" + k.cell(1, 1) + "-" + k.cell(1, 0) + ")-(" + k.cell(0, 1) + "-" + k.cell(0, 0) + ")=" + Viz.n(k.inter) + "\\ \\text{cm}\\end{array}";
    },
    status: function (v) {
      var k = calc(v), X = k.X.name, a = k.L.lines;
      if (Math.abs(k.inter) < 1e-9) return "<b>Parallel lines, no interaction</b>: " + X + " adds the same " + Viz.fmt(k.e[0]) + " cm with " + a[0] + " or " + a[1] + ".";
      if (k.cross) return "<b>Lines cross</b>: " + X + " changes growth by <b>" + sgn(k.e[0]) + " cm</b> with " + a[0] + " but <b>" + sgn(k.e[1]) +
        " cm</b> with " + a[1] + "; its average (main) effect of " + sgn((k.e[0] + k.e[1]) / 2) + " cm hides that flip.";
      return "<b>Lines spread, no crossing</b>: " + X + " helps either way, " + sgn(k.e[0]) + " cm with " + a[0] + " but " + sgn(k.e[1]) +
        " cm with " + a[1] + ", so its effect depends on the other factor (interaction " + sgn(k.inter) + " cm).";
    },
    examples: [
      {name: "initial_pattern: non-crossover-interaction", values: {initial_pattern: "non-crossover-interaction"}},
      {name: "initial_pattern: crossover-interaction", values: {initial_pattern: "crossover-interaction"}},
      {name: "crossover, water on the x axis", values: {initial_pattern: "crossover-interaction", xAxis: "water"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), col = [c.c2, c.c3], xs = [74, 176], yB = 238, yT = 40;
      var Y = function (cm) { return yB - (yB - yT) * cm / 30; };
      [0, 10, 20, 30].forEach(function (t) {
        api.line([40, Y(t)], [210, Y(t)], {color: c.grid, width: 1});
        api.label([34, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      });
      api.label([8, 18], "growth (cm)", {color: c.muted, size: 12});
      api.line([40, yB], [210, yB], {color: c.axis, width: 1.2});
      xs.forEach(function (x, j) { api.label([x, yB + 15], k.X.levels[j], {color: c.ink, size: 12.5, anchor: "middle", weight: 600}); });
      api.label([(xs[0] + xs[1]) / 2, yB + 33], k.X.name, {color: c.muted, size: 12, anchor: "middle"});
      // one line per level of the other factor
      [0, 1].forEach(function (i) {
        var a = [xs[0], Y(k.cell(i, 0))], b = [xs[1], Y(k.cell(i, 1))];
        api.line(a, b, {color: col[i], width: 3});
        api.label([b[0] + 10, b[1]], k.L.lines[i], {color: col[i], size: 12.5, weight: 650});
        [0, 1].forEach(function (j) {
          var val = k.cell(i, j), other = k.cell(1 - i, j), P = [xs[j], Y(val)];
          api.point(P, {color: col[i], r: 5.5});
          api.label([P[0] + (j ? 0 : -10), P[1] + (val >= other ? -13 : 15)], String(val), {color: col[i], size: 12, weight: 600, anchor: j ? "middle" : "end"});
        });
      });
      // the simple effect of the x-axis factor at each line's level, side by side
      var px = [318, 368], y0 = 160, s = 5;
      api.label([343, 30], "effect of", {color: c.muted, size: 12, anchor: "middle"});
      api.label([343, 46], k.X.name, {color: c.ink, size: 12.5, anchor: "middle", weight: 650});
      api.line([296, y0], [392, y0], {color: c.axis, width: 1.2});
      api.label([296, y0 + 14], "0", {color: c.muted, size: 12, anchor: "start"});
      [0, 1].forEach(function (i) {
        var e = k.e[i], tip = [px[i], y0 - e * s];
        if (Math.abs(e) > 1e-9) api.arrow([px[i], y0], tip, {color: col[i], width: 4, halo: false});
        api.label([px[i], tip[1] + (e >= 0 ? -12 : 14)], sgn(e), {color: col[i], size: 13, weight: 700, anchor: "middle"});
      });
      api.label([343, 230], "difference", {color: c.muted, size: 12, anchor: "middle"});
      api.label([343, 248], "= interaction", {color: c.muted, size: 12, anchor: "middle"});
      api.label([343, 270], sgn(k.e[1]) + " − (" + sgn(k.e[0]) + ") = " + Viz.fmt(k.inter), {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
    }
  });
})();
