// One origin, two forks. E. coli opens its circular 4.6 Mb chromosome at oriC and sends two forks off in opposite
// directions, each at about 1,000 nt/s; they meet near ter, so the whole genome takes G / 2v = 4.6e6 / 2000 s, about
// 38 min (textbooks: about 40). One fork alone would need G / v, about 77 min. The circle shows the theta structure: the
// replicated arc is two daughter duplexes (outer ring and inner loop), each one old (blue) + one new (amber) strand.
// The bubble on the right is a close-up near the origin, not to scale: top template runs 5'->3' left to right, so its
// copy grows leftward (leading for the left fork, Okazaki fragments for the right fork); the bottom template is the
// reverse. Each template strand is copied continuously on one side of the origin and in fragments on the other.
(function () {
  var G = 4.6e6, V = 1000, TMAX = 80;
  function copied(v) { return Math.min(G, (v.forks === "two forks" ? 2 : 1) * V * 60 * v.t); }
  function finish(v) { return G / ((v.forks === "two forks" ? 2 : 1) * V) / 60; }
  function mb(x) { return Viz.fmt(x / 1e6, 2); }

  Viz.register("dna-replication-origin-bidirectional-forks", {
    title: "One origin, two forks",
    subject: "biology",
    shows: "Slide time on the E. coli chromosome: two forks leave oriC in opposite directions and meet at ter in about 38 minutes, half the time one fork would take; the bubble shows each fork's leading and lagging strand",
    params: {
      t: {kind: "integer", default: 20, min: 0, max: TMAX, label: "t\\ (\\text{min})"},
      forks: {kind: "enum", values: ["two forks", "one fork"], default: "two forks", label: "\\text{origin}"}
    },
    formula: function (v) {
      var two = v.forks === "two forks";
      return "\\begin{array}{l}T=\\dfrac{G}{" + (two ? "2v" : "v") + "}=\\dfrac{4.6\\times10^6}{" + (two ? "2\\times" : "") + "1000\\ \\text{nt/s}}\\approx" + Math.round(finish(v)) + "\\ \\text{min}" +
        "\\\\[4pt] \\text{copied at }" + v.t + "\\text{ min}=" + mb(copied(v)) + "\\ \\text{Mb}\\end{array}";
    },
    status: function (v) {
      var two = v.forks === "two forks", T = finish(v), f = copied(v) / G;
      if (!v.t) return "At t = 0 the origin has just opened: " + (two ? "two forks are about to head off in opposite directions." : "one fork is about to set off.");
      if (f >= 1) return (two ? "Done: the two forks met at ter after about <b>" : "Done: the lone fork came back round to oriC after about <b>") + Math.round(T) + " min</b>" + (two ? ", half the time one fork would take." : ", twice as long as two forks.");
      return "At " + v.t + " min " + (two ? "two forks have" : "one fork has") + " copied <b>" + mb(copied(v)) + " Mb</b> of 4.6 Mb (" + Math.round(f * 100) + "%); finishing takes about <b>" + Math.round(T) + " min</b>.";
    },
    examples: [
      {name: "just opened", values: {t: 0}},
      {name: "two forks, 80 min", values: {t: 80, forks: "two forks"}},
      {name: "two forks, nearly met", values: {t: 36, forks: "two forks"}},
      {name: "one fork, 40 min", values: {t: 40, forks: "one fork"}},
      {name: "one fork, 80 min", values: {t: 80, forks: "one fork"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, two = v.forks === "two forks", f = copied(v) / G, cx = 104, cy = 152;
      var P = function (r, th) { return [cx + r * Math.sin(th), cy - r * Math.cos(th)]; };
      var arc = function (r, a, b, col, w) {
        if (b - a < 1e-6) return;
        var pts = [], n = Math.max(2, Math.ceil((b - a) / 0.05));
        for (var i = 0; i <= n; i++) pts.push(P(r, a + (b - a) * i / n));
        api.polyline(pts, {stroke: col, width: w || 3});
      };
      var a0 = two ? -Math.PI * f : 0, a1 = two ? Math.PI * f : 2 * Math.PI * f, full = f >= 1 - 1e-9;
      // parent strands, then the replicated arc as two daughters (outer ring and inner loop), each old + new
      arc(80, 0, 2 * Math.PI, c.c2, 3);
      if (!full) arc(74, a1, a0 + 2 * Math.PI, c.c2, 3);
      arc(74, a0, a1, c.c3, 3);
      arc(58, a0, a1, c.c2, 3);
      arc(52, a0, a1, c.c3, 3);
      for (var th = a1 + 0.06; th < a0 + 2 * Math.PI - 0.04; th += 0.09) api.line(P(76.5, th), P(77.5, th), {color: c.faint, width: 1});
      var forkAt = [];
      if (v.t > 0 && !full) { forkAt.push([a1, 1]); if (two) forkAt.push([a0, -1]); }
      if (v.t > 0 && !full && !two) api.line(P(77, 0), P(55, 0), {color: c.c2, width: 3});   // the origin end of a one-way bubble
      forkAt.forEach(function (q) {
        api.line(P(77, q[0]), P(55, q[0]), {color: c.c2, width: 3});
        api.circle(P(66, q[0]), 7, {fill: c.c6, fillOpacity: 0.5, stroke: c.c6, width: 1.8});
        var ang = ((q[0] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (Math.min(ang, 2 * Math.PI - ang) > 0.4 && Math.abs(ang - Math.PI) > 0.4) api.arrow(P(92, q[0]), P(92, q[0] + q[1] * 0.32), {color: c.c6, width: 2, halo: false, head: 8});
      });
      api.label([cx, cy - 92], "oriC", {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      api.label([cx, cy + 96], "ter", {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      api.line(P(70, 0), P(84, 0), {color: c.ink, width: 2});
      api.line(P(70, Math.PI), P(84, Math.PI), {color: c.muted, width: 2});
      api.label([cx, cy - 6], Math.round(f * 100) + "%", {color: c.c3, size: 18, weight: 700, anchor: "middle"});
      api.label([cx, cy + 14], "copied", {color: c.muted, size: 12, anchor: "middle"});
      api.label([cx, 18], "E. coli, 4.6 Mb circle", {color: c.muted, size: 12, anchor: "middle"});
      // ---- the bubble near the origin (not to scale) ----
      var xl = 228, xr = 376, xo = two ? 302 : xl, yU = 50, yD = 150, yM1 = 96, yM2 = 104, yNu = 64, yNd = 136;
      api.line([210, yM1], [xl, yM1], {color: c.c2, width: 3}); api.line([210, yM2], [xl, yM2], {color: c.c2, width: 3});
      api.line([xr, yM1], [394, yM1], {color: c.c2, width: 3}); api.line([xr, yM2], [394, yM2], {color: c.c2, width: 3});
      api.path("M " + xl + " " + yM1 + " C " + (xl + 12) + " " + yM1 + " " + (xl + 6) + " " + yU + " " + (xl + 22) + " " + yU + " L " + (xr - 22) + " " + yU + " C " + (xr - 6) + " " + yU + " " + (xr - 12) + " " + yM1 + " " + xr + " " + yM1, {stroke: c.c2, width: 3});
      api.path("M " + xl + " " + yM2 + " C " + (xl + 12) + " " + yM2 + " " + (xl + 6) + " " + yD + " " + (xl + 22) + " " + yD + " L " + (xr - 22) + " " + yD + " C " + (xr - 6) + " " + yD + " " + (xr - 12) + " " + yM2 + " " + xr + " " + yM2, {stroke: c.c2, width: 3});
      var strand = function (a, b, y, col, dir) {   // dir: +1 grows rightward (arrowhead at b), -1 leftward (at a); primer at the 5' end
        api.line([a, y], [b, y], {color: col, width: 3.5});
        var tip = dir > 0 ? b : a, five = dir > 0 ? a : b;
        api.polygon([[tip + dir * 3, y], [tip - dir * 6, y - 4.5], [tip - dir * 6, y + 4.5]], {fill: col, fillOpacity: 1});
        api.line([five, y], [five - dir * 6, y], {color: c.c5, width: 4.5});
      };
      var frags = function (a, b, y, col, dir) { var n = Math.max(1, Math.round((b - a) / 30)), w = (b - a) / n; for (var k = 0; k < n; k++) strand(a + k * w + 4, a + (k + 1) * w - 3, y, col, dir); };
      // right fork: bottom copy leads (grows right), top copy lags (fragments growing left)
      strand(two ? xo + 4 : xl + 22, xr - 22, yNd, c.c4, 1);
      frags(two ? xo + 2 : xl + 20, xr - 22, yNu, c.c1, -1);
      api.label([(xo + xr) / 2 - 6, yNd - 16], "leading", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      api.label([(xo + xr) / 2 - 6, yNu + 16], "lagging", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      api.rect(xr - 8, yM1 - 12, 14, 28, {fill: c.c6, fillOpacity: 0.4, stroke: c.c6, width: 1.6, rx: 7});
      api.arrow([xr - 10, 34], [xr + 14, 34], {color: c.c6, width: 2, halo: false, head: 8});
      if (two) {
        strand(xl + 22, xo - 4, yNu, c.c4, -1);
        frags(xl + 22, xo - 2, yNd, c.c1, 1);
        api.label([(xl + xo) / 2 + 8, yNu + 16], "leading", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        api.label([(xl + xo) / 2 + 8, yNd - 16], "lagging", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
        api.rect(xl - 6, yM1 - 12, 14, 28, {fill: c.c6, fillOpacity: 0.4, stroke: c.c6, width: 1.6, rx: 7});
        api.arrow([xl + 10, 34], [xl - 14, 34], {color: c.c6, width: 2, halo: false, head: 8});
      }
      api.line([xo, yD + 6], [xo, yD + 14], {color: c.ink, width: 2});
      api.label([xo, yD + 25], "ori", {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      api.label([302, 18], "close-up near the origin", {color: c.muted, size: 12, anchor: "middle"});
      // ---- time to finish ----
      var tx0 = 218, tx1 = 384, TX = function (m) { return tx0 + (tx1 - tx0) * m / TMAX; }, ty = 236, T = finish(v);
      api.rect(tx0, ty - 7, tx1 - tx0, 14, {fill: c.grid, rx: 7});
      api.rect(tx0, ty - 7, Math.max(0, TX(Math.min(v.t, T)) - tx0), 14, {fill: c.c3, fillOpacity: 0.8, rx: 7});
      api.line([TX(T), ty - 14], [TX(T), ty + 14], {color: c.c6, width: 2});
      api.label([TX(T), ty - 24], "done at " + Math.round(T) + " min", {color: c.c6, size: 12, weight: 650, anchor: TX(T) > 330 ? "end" : "middle"});
      api.line([TX(v.t), ty + 9], [TX(v.t), ty + 16], {color: c.ink, width: 2});
      api.label([tx0, ty + 26], "0", {color: c.muted, size: 12, anchor: "middle"});
      api.label([tx1, ty + 26], TMAX + " min", {color: c.muted, size: 12, anchor: "end"});
      api.label([(tx0 + tx1) / 2, ty + 26], "t = " + v.t + " min", {color: c.ink, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
