// Weight F_g = m g. Left: the mass hangs from a spring scale; the spring stretches in proportion to the pull, and the
// pointer reads it off a ruler in newtons, with the weight arrow drawn in proportion too. The ruler's full scale is
// 30 newtons per kilogram of the mass tier this mass falls in (up to 0.2, 2, 20 or 200 kg), so inside a tier more
// mass visibly stretches the spring and lengthens every bar (4, 8 and 16 kg share one), and g moves the reading
// smoothly and in proportion; the ruler relabels only when the mass crosses into the next tier. Right: what this same mass weighs here and on four
// real worlds, as bars on that same newton scale: the mass never changes, only the weight does. Ranges: the queue
// allows 0.01 to 10,000 for both, which no slider can use and no planet reaches (Jupiter is 24.79 m/s^2), so mass runs
// 0.1 to 200 kg and g 0 to 30 m/s^2. The queue's g default of 9.8 becomes 9.81 so the "here" row matches Earth's.
(function () {
  var WORLDS = [["Moon", 1.62], ["Mars", 3.71], ["Earth", 9.81], ["Jupiter", 24.79]];
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  var N = function (x) { return x >= 1000 ? Math.round(x).toLocaleString("en-US") : f(x, x >= 10 ? 1 : 2); };   // figure labels
  var tick = function (x) { return x >= 1000 ? Math.round(x).toLocaleString("en-US") : Viz.fmt(x, 3); };   // ruler numbers
  function tier(m) { return m <= 0.2 ? 0.2 : m <= 2 ? 2 : m <= 20 ? 20 : 200; }   // the scale's mass bucket, kg
  var exact = function (x) { var t = Viz.n(x, 2).split("."); return t[0].replace(/\B(?=(\d{3})+$)/g, "{,}") + (t[1] ? "." + t[1] : ""); };   // the formula keeps every digit
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; }); }   // viz.css paints text ink

  Viz.register("weight-force", {
    title: "Weight is mass times gravity",
    subject: "physics",
    shows: "Change the mass and the gravitational field: weight is mass times g, so the same mass weighs less on the Moon and more on Jupiter while its mass stays put",
    params: {
      mass: {kind: "number", default: 8, min: 0.1, max: 200, step: 0.1, label: "m\\ (\\mathrm{kg})"},
      gravity: {kind: "number", default: 9.81, min: 0, max: 30, step: 0.01, label: "g\\ (\\mathrm{m/s^2})"}
    },
    formula: function (v) {
      return "\\begin{array}{l}F_g=mg\\\\[3pt]\\phantom{F_g}=" + Viz.n(v.mass, 2) + "\\ \\mathrm{kg}\\times" + Viz.n(v.gravity, 2) + "\\ \\mathrm{m/s^2}=" +
        exact(v.mass * v.gravity) + "\\ \\mathrm{N}\\end{array}";
    },
    status: function (v) {
      var m = v.mass, g = v.gravity, F = m * g;
      if (g === 0) return "With <b>g = 0</b> (far from any planet) the " + f(m) + " kg mass weighs <b>0 N</b>, though its mass is still " + f(m) + " kg.";
      var near = WORLDS.filter(function (w) { return Math.abs(w[1] - g) < 0.05; })[0], same = near && Math.abs(near[1] - g) < 0.005;
      var name = near ? (near[0] === "Moon" ? "the Moon" : near[0]) : "";
      // only an exact match is called that world; a near miss says so, so the sentence and the table rows agree
      var where = same ? "On " + name : near ? "At g = " + f(g) + " m/s² (" + name + "'s is " + f(near[1]) + ")," : "Where g = " + f(g) + " m/s²";
      return where + " the " + f(m) + " kg mass weighs <b>" + N(F) + " N</b>; " +
        (same && near[0] === "Earth" ? "on the Moon the same mass would weigh " + N(m * 1.62) + " N." : "on Earth the same mass would weigh " + N(m * 9.81) + " N.");
    },
    examples: [
      {name: "Minimum supported values", values: {mass: 0.1, gravity: 0}},
      {name: "Maximum supported values", values: {mass: 200, gravity: 30}},
      {name: "a 70 kg person on the Moon", values: {mass: 70, gravity: 1.62}},
      {name: "the same person on Jupiter", values: {mass: 70, gravity: 24.79}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, m = v.mass, g = v.gravity, F = m * g, FS = 30 * tier(m);
      // the spring scale: ceiling, spring stretched in proportion to F, the ruler it reads against
      var sx = 96, top = 20, r0 = 50, travel = 156, yE = r0 + travel * Math.min(F / FS, 1);
      api.rect(sx - 38, top - 8, 76, 8, {fill: c.muted, fillOpacity: 0.35, rx: 2});
      var coils = 7, zig = [[sx, top], [sx, top + 6]];
      for (var i = 0; i < coils * 2; i++) zig.push([sx + (i % 2 ? -8 : 8), top + 6 + (yE - top - 12) * (i + 0.5) / (coils * 2)]);
      zig.push([sx, yE - 6], [sx, yE]);
      api.polyline(zig, {stroke: c.muted, width: 1.8});
      var rx = 42;
      api.line([rx, r0], [rx, r0 + travel], {color: c.axis, width: 1.4});
      for (var k = 0; k <= 5; k++) {
        var ty = r0 + travel * k / 5;
        api.line([rx, ty], [rx + 6, ty], {color: c.axis, width: 1.2});
        api.label([rx - 5, ty], tick(FS * k / 5), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([rx - 5, r0 - 16], "N", {color: c.muted, size: 12, anchor: "end"});
      api.line([rx + 2, yE], [sx - 10, yE], {color: c.c5, width: 1.5, dash: "3 3"});
      api.polygon([[rx + 1, yE], [rx + 9, yE - 5], [rx + 9, yE + 5]], {fill: c.c5, fillOpacity: 1});
      // the hanging mass, drawn bigger for more kilograms (side grows as the cube root, like a block of one material)
      var s = 16 + 34 * Math.cbrt(m / 200), bt = yE + 6, cy = bt + s / 2;
      api.circle([sx, yE + 2], 3, {stroke: c.muted, width: 1.5});
      api.rect(sx - s / 2, bt, s, s, {fill: c.c2, fillOpacity: 0.3, stroke: c.c2, rx: 3});
      api.label([sx + s / 2 + 7, cy], "m = " + f(m) + " kg", {color: c.c2, size: 12.5, weight: 650});
      // the weight arrow hangs from the box's bottom edge: a 16 px stub plus a length in proportion to F
      var L = F > 0 ? 18 + 34 * Math.min(F / FS, 1) : 0, yb = bt + s;
      if (L) api.arrow([sx, yb], [sx, yb + L], {color: c.c5, width: 3});
      api.label([sx - 22, yb + L + 13], "weight " + N(F) + " N", {color: c.c5, size: 13, weight: 700});   // starts right of the ruler's numbers
      // the same mass elsewhere: a small table, each row's bar on the scale's own newton axis (full width = full scale)
      var bx = 214, gxr = 300, bxr = 386, bw = bxr - bx;
      var rows = [["here", g, c.c5]].concat(WORLDS.map(function (w) { return [w[0], w[1], c.muted]; }));
      api.label([bx, 14], "the same " + f(m) + " kg weighs", {color: c.muted, size: 12});
      api.label([gxr, 34], "g (m/s²)", {color: c.muted, size: 12, anchor: "end"});
      api.label([bxr, 34], "weight", {color: c.muted, size: 12, anchor: "end"});
      rows.forEach(function (r, j) {
        var y = 62 + j * 46 + (j ? 14 : 0), w = bw * Math.min(m * r[1] / FS, 1), here = j === 0, col = here ? c.c5 : c.ink, wt = here ? 700 : 500;
        api.label([bx, y], r[0], {color: col, size: 12.5, weight: wt});
        api.label([gxr, y], f(r[1]), {color: col, size: 12.5, weight: wt, anchor: "end"});
        api.label([bxr, y], N(m * r[1]) + " N", {color: col, size: 12.5, weight: 700, anchor: "end"});
        api.rect(bx, y + 10, bw, 7, {fill: c.grid, rx: 2});
        if (w > 0.5) api.rect(bx, y + 10, w, 7, {fill: r[2], fillOpacity: here ? 0.9 : 0.55, rx: 2});
      });
      api.line([bx, 62 + 46 - 4], [bxr, 62 + 46 - 4], {color: c.grid, width: 1});
      tint(api);
    }
  });
})();
