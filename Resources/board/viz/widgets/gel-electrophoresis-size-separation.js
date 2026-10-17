// Why a gel sorts DNA by size. In free solution every DNA fragment has the same charge per base, so all sizes run at the
// same speed; the agarose mesh is what holds big fragments back. Model (a Ferguson-style relation, calibrated, stated):
// d = v0 t 10^(-k T sqrt(L)), with T the agarose %, L the size in kb, v0 = 1.5 mm/min (the speed with no gel at a
// typical field) and k = 0.32. Defining "separates well" as bands spreading at least 30% of the run distance per tenfold
// change in size gives the range L = (0.165 / kT)^2 to (0.9 / kT)^2 kb: about 1-30 kb at 0.5%, 0.3-8 kb at 1%,
// 0.07-2 kb at 2%, close to the usual gel-percentage tables. Two bands count as resolved 1.5 mm or more apart.
(function () {
  var V0 = 1.5, K = 0.32, GEL = 70, PX = 3, Y0 = 46;
  var LADDER = [[10000, "10 kb"], [5000, "5 kb"], [3000, "3 kb"], [2000, "2 kb"], [1000, "1 kb"], [500, "500"], [300, "300"], [200, "200"], [100, "100"]];
  function dist(L, v) { return V0 * v.t * Math.pow(10, -K * v.T * Math.sqrt(L / 1000)); }
  function pair(a, b, v) { var da = dist(a, v), db = dist(b, v); return {da: da, db: db, sep: Math.abs(db - da), off: da > GEL || db > GEL, ok: Math.abs(db - da) >= 1.5 && da <= GEL && db <= GEL}; }
  function range(v) { return [Math.pow(0.165 / (K * v.T), 2) * 1000, Math.pow(0.9 / (K * v.T), 2) * 1000]; }
  function size(bp) { return bp < 1000 ? Math.round(bp / 10) * 10 + " bp" : Viz.fmt(bp / 1000, bp < 10000 ? 1 : 0) + " kb"; }

  Viz.register("gel-electrophoresis-size-separation", {
    title: "Gel electrophoresis: separating by size",
    subject: "biology",
    shows: "Change the agarose percentage and run time: the gel mesh holds big fragments back, so a denser gel separates small fragments and a looser one separates large ones",
    params: {
      T: {kind: "number", default: 1, min: 0.5, max: 2, step: 0.1, label: "\\text{gel }\\%"},
      t: {kind: "integer", default: 40, min: 10, max: 60, step: 5, label: "t\\ (\\text{min})"}
    },
    formula: function (v) {
      return "\\begin{array}{l}d=v_0\\,t\\cdot 10^{-k\\,T\\sqrt{L}}\\\\ d_{1\\,\\text{kb}}=1.5\\cdot " + v.t + "\\cdot 10^{-0.32\\cdot " + Viz.n(v.T, 1) + "}\\\\ \\phantom{d_{1\\,\\text{kb}}}=" + Viz.n(dist(1000, v), 1) + "\\text{ mm}\\end{array}";
    },
    status: function (v) {
      var s = pair(200, 250, v), b = pair(4000, 5000, v), r = range(v), tail = "; this gel separates best from " + size(r[0]) + " to " + size(Math.min(r[1], 50000)) + ".";
      var say = function (p, name) { return p.off ? name + " have run off the end" : p.ok ? name + " come apart (" + Viz.fmt(p.sep, 1) + " mm)" : name + " overlap (" + Viz.fmt(p.sep, 1) + " mm apart)"; };
      return "In a " + Viz.fmt(v.T, 1) + "% gel after " + v.t + " min, " + say(b, "4 and 5 kb") + " and " + say(s, "200 and 250 bp") + tail.replace("best", "<b>best</b>");
    },
    examples: [
      {name: "loose gel, short run", values: {T: 0.5, t: 10}},
      {name: "dense gel, long run", values: {T: 2, t: 60}},
      {name: "0.5% gel, 60 min: small ones run off", values: {T: 0.5, t: 60}},
      {name: "2% gel, 40 min", values: {T: 2, t: 40}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, y = function (d) { return Y0 + d * PX; }, laneL = 57, laneS = 113;   // room left of the ladder for "10 kb"
      // ---- the gel: wells at the top (−), ladder and sample lanes ----
      api.rect(4, Y0 - 12, 134, GEL * PX + 18, {fill: c.c2, fillOpacity: 0.06, stroke: c.axis, width: 1, rx: 6});
      [laneL, laneS].forEach(function (x) { api.rect(x - 19, Y0 - 6, 38, 5, {fill: c.ink, fillOpacity: 0.5, rx: 1.5}); });
      api.label([71, 14], "− end (wells)", {color: c.muted, size: 12, anchor: "middle"});
      api.label([71, y(GEL) + 32], "+ end", {color: c.c5, size: 12, anchor: "middle"});
      api.label([laneL, 29], "ladder", {color: c.muted, size: 12, anchor: "middle"});
      api.label([laneS, 29], "sample", {color: c.muted, size: 12, anchor: "middle"});
      var lastY = -99, off = 0;   // a band label needs 12.5 px of room and stays off the well bar (y < Y0 + 8)
      LADDER.forEach(function (b) {
        var d = dist(b[0], v); if (d > GEL) { off++; return; }
        api.rect(laneL - 18, y(d) - 1.5, 36, 3, {fill: c.ink, fillOpacity: 0.8, rx: 1});
        if (y(d) - lastY >= 12.5 && y(d) >= Y0 + 8) { api.label([laneL - 22, y(d)], b[1], {color: c.muted, size: 12, anchor: "end"}); lastY = y(d); }
      });
      // sample: two pairs; a pair closer than 1.5 mm smears into one thick band
      [[200, 250, c.c3, "200/250"], [4000, 5000, c.c2, "4/5 kb"]].forEach(function (q) {
        var p = pair(q[0], q[1], v), top = Math.min(p.da, p.db), bot = Math.max(p.da, p.db);
        if (p.off) { api.label([laneS, y(GEL) + 17], "ran off", {color: q[2], size: 12, anchor: "middle"}); return; }
        if (p.ok) { [p.da, p.db].forEach(function (d) { api.rect(laneS - 18, y(d) - 1.5, 36, 3, {fill: q[2], rx: 1}); }); }
        else api.rect(laneS - 18, y(top) - 1.5, 36, (bot - top) * PX + 3, {fill: q[2], rx: 1.5});
        api.label([laneS + 26, y((top + bot) / 2)], q[3], {color: q[2], size: 12, weight: 650});
      });
      if (off) api.label([laneL, y(GEL) + 17], off + " ran off", {color: c.muted, size: 12, anchor: "middle"});
      // ---- the mesh: more fibres per % (pores shrink), with a small and a large coil drawn to scale ----
      var bx = 200, by = 30, bw = 190, bh = 104, n = Math.round(9 * Math.pow(v.T, 0.75));
      api.rect(bx, by, bw, bh, {fill: c.ink, fillOpacity: 0.03, stroke: c.faint, width: 1, rx: 8});
      var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      var edge = function (u) { var s = u * 2 * (bw + bh); return s < bw ? [bx + s, by] : s < bw + bh ? [bx + bw, by + s - bw] : s < 2 * bw + bh ? [bx + 2 * bw + bh - s, by + bh] : [bx, by + 2 * (bw + bh) - s]; };
      for (var i = 0; i < 18; i++) {
        var a = rnd(), b2 = (a + 0.3 + 0.4 * rnd()) % 1;
        if (i < n) api.line(edge(a), edge(b2), {color: c.muted, width: 1.3, opacity: 0.55});
      }
      api.circle([248, 84], 4, {fill: c.c3});
      api.circle([334, 84], 18, {fill: c.c2, fillOpacity: 0.35, stroke: c.c2, width: 1.5});
      api.label([bx + 8, by + 13], "agarose mesh, " + Viz.fmt(v.T, 1) + "%", {color: c.ink, size: 12, weight: 650});
      api.label([248, 104], "250 bp", {color: c.c3, size: 12, anchor: "middle"});
      api.label([334, 116], "5 kb", {color: c.c2, size: 12, anchor: "middle"});
      // ---- the size range this gel separates well, on a log axis ----
      var ax0 = 206, ax1 = 386, lx = function (bp) { return ax0 + (Math.log10(bp) - 2) / (Math.log10(30000) - 2) * (ax1 - ax0); };
      var r = range(v), r0 = Math.max(100, r[0]), r1 = Math.min(30000, r[1]);
      api.label([bx, 160], "separates well:", {color: c.muted, size: 12});
      api.label([bx + 92, 160], size(r[0]) + " – " + size(r[1]), {color: c.c4, size: 12.5, weight: 700});
      api.line([ax0, 184], [ax1, 184], {color: c.axis, width: 1.2});
      api.rect(lx(r0), 177, lx(r1) - lx(r0), 14, {fill: c.c4, fillOpacity: 0.45, rx: 3});
      [[100, "100 bp"], [1000, "1 kb"], [10000, "10 kb"]].forEach(function (t) {
        api.line([lx(t[0]), 184], [lx(t[0]), 194], {color: c.axis, width: 1.2});
        api.label([lx(t[0]), 205], t[1], {color: c.muted, size: 12, anchor: "middle"});
      });
      [[pair(200, 250, v), "200+250 bp", c.c3, 236], [pair(4000, 5000, v), "4+5 kb", c.c2, 258]].forEach(function (q) {
        var p = q[0], verdict = p.off ? "ran off the gel" : p.ok ? "2 bands, " + api.fmt(p.sep, 1) + " mm" : "1 band, " + api.fmt(p.sep, 1) + " mm";
        api.label([bx, q[3]], q[1] + ": " + verdict, {color: q[2], size: 12});
      });
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
