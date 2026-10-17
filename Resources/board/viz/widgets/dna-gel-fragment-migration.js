// Agarose gel electrophoresis: DNA is negatively charged, so it runs from the wells toward the + electrode, and smaller
// fragments slip through the gel faster. Over the resolving range (about 100 bp to 2 kb in a ~1% gel) the distance run is
// close to linear in log(size) and grows with run time: d = k t (3.9 - log10 L), with k = 0.71 mm per minute per decade
// (3.9 = log10 of about 7.9 kb), which puts 100 bp 54 mm down a 60 mm gel after 40 minutes. The plot shares the gel's distance axis.
(function () {
  var K = 0.71, A = 3.9, GEL = 60, LADDER = [100, 200, 300, 500, 700, 1000, 1500, 2000];
  function dist(L, t) { return K * t * (A - Math.log10(L)); }
  Viz.register("dna-gel-fragment-migration", {
    title: "Gel electrophoresis: how far a fragment runs",
    subject: "biology",
    shows: "Slide the run time and the fragment size: DNA runs toward +, small fragments run farther, and distance is a straight line against log size (log base 10)",
    params: {
      runTimeMinutes: {kind: "integer", default: 40, min: 1, max: 40, label: "t\\ (\\text{min})"},
      fragmentSizeBasePairs: {kind: "integer", default: 700, min: 100, max: 2000, step: 10, label: "L\\ (\\text{bp})"}
    },
    formula: function (v) {
      var L = v.fragmentSizeBasePairs, t = v.runTimeMinutes;
      // \small keeps the widest case (a 4-digit L and d = 17.1) on one line in the wide layout
      return "\\small d = " + K + "\\cdot " + t + "\\cdot(" + A + "-\\log " + L + ") = " + Viz.n(dist(L, t), 1) + "\\text{ mm}";
    },
    status: function (v) {
      var L = v.fragmentSizeBasePairs, t = v.runTimeMinutes, d = dist(L, t), spread = dist(100, t) - dist(2000, t);
      if (spread < 8) return "After " + t + " min the whole 100–2000 bp ladder spans only <b>" + Viz.fmt(spread, 1) + " mm</b> near the wells: run longer to separate the bands.";
      var lo = null, hi = null;
      LADDER.forEach(function (b) { if (b <= L) lo = b; if (b >= L && hi === null) hi = b; });
      var where = lo === hi ? "level with the " + L + " bp ladder band" : "between the " + lo + " and " + hi + " bp ladder bands";
      return "After " + t + " min the " + L + " bp fragment has run <b>" + Viz.fmt(d, 1) + " mm</b>, " + where + ".";
    },
    examples: [
      {name: "one minute: still in the wells", values: {runTimeMinutes: 1, fragmentSizeBasePairs: 100}},
      {name: "long run, 2 kb fragment", values: {runTimeMinutes: 40, fragmentSizeBasePairs: 2000}},
      {name: "small fragment, long run", values: {runTimeMinutes: 40, fragmentSizeBasePairs: 150}}
    ],
    size: [400, 292],
    draw: function (api, v) {
      var c = api.color, t = v.runTimeMinutes, L = v.fragmentSizeBasePairs;
      var gx = 54, gw = 124, top = 52, len = 196, Y = function (d) { return top + d * len / GEL; };
      var lanes = [gx + 32, gx + 92];
      // the gel slab, the wells, the electrodes
      api.rect(gx, top - 10, gw, len + 16, {fill: c.c2, fillOpacity: 0.07, stroke: c.axis, width: 1, rx: 6});
      lanes.forEach(function (x) { api.rect(x - 20, top - 6, 40, 6, {fill: c.ink, fillOpacity: 0.55, rx: 1.5}); });
      api.label([gx + gw / 2, 16], "− wells (cathode)", {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx + gw / 2, top + len + 22], "+ anode", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      api.label([lanes[0], 30], "ladder", {color: c.muted, size: 12, anchor: "middle"});
      api.label([lanes[1], 30], "sample", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // ladder bands, labelled where they are far enough apart to read
      var lastY = -99;
      LADDER.slice().reverse().forEach(function (b) {
        var y = Y(dist(b, t));
        api.rect(lanes[0] - 19, y - 2, 38, 4, {fill: c.ink, fillOpacity: 0.75, rx: 1.5});
        if (y - lastY >= 13) { api.label([gx - 5, y], String(b), {color: c.muted, size: 12, anchor: "end"}); lastY = y; }
      });
      var d = dist(L, t), yS = Y(d);
      api.rect(lanes[1] - 21, yS - 5, 42, 10, {fill: c.c3, fillOpacity: 0.22, rx: 4});
      api.rect(lanes[1] - 19, yS - 2.5, 38, 5, {fill: c.c3, rx: 1.5});
      var moved = yS - top >= 8;   // a band still at the wells gets no leaders (they would sit on the wells and the 0 tick)
      if (yS - 8 > top + 4) api.line([lanes[1], top + 4], [lanes[1], yS - 8], {color: c.c3, width: 1.5, dash: "3 4", opacity: 0.7});
      // standard curve: distance (shared with the gel) against size on a log axis
      var px0 = 236, px1 = 382, lx = function (b) { return px0 + (Math.log10(b) - 2) / (Math.log10(2000) - 2) * (px1 - px0); };
      api.line([px0 - 8, top], [px0 - 8, Y(GEL)], {color: c.axis, width: 1.2});
      api.line([px0 - 8, Y(GEL)], [px1 + 6, Y(GEL)], {color: c.axis, width: 1.2});
      [0, 20, 40, 60].forEach(function (m) {
        api.line([px0 - 12, Y(m)], [px0 - 8, Y(m)], {color: c.axis, width: 1.2});
        api.label([px0 - 15, Y(m)], String(m), {color: c.muted, size: 12, anchor: "end"});
      });
      api.label([px0 - 8, 16], "distance (mm) after " + t + " min", {color: c.muted, size: 12});
      [100, 200, 500, 1000, 2000].forEach(function (b) {
        api.line([lx(b), Y(GEL)], [lx(b), Y(GEL) + 4], {color: c.axis, width: 1.2});
        api.label([lx(b), Y(GEL) + 15], String(b), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([(px0 + px1) / 2, Y(GEL) + 32], "size (bp, log scale)", {color: c.muted, size: 12, anchor: "middle"});
      api.line([lx(100), Y(dist(100, t))], [lx(2000), Y(dist(2000, t))], {color: c.c2, width: 2.5});
      LADDER.forEach(function (b) { api.point([lx(b), Y(dist(b, t))], {color: c.ink, r: 3}); });
      if (moved) api.line([lanes[1] + 22, yS], [lx(L), yS], {color: c.c3, width: 1.3, dash: "4 4", opacity: 0.8});
      api.point([lx(L), yS], {color: c.c3, r: 5.5});
      // the line climbs to the right, so the label goes above-left of the point or below-right of it
      var left = lx(L) > 318;
      api.label([lx(L) + (left ? -9 : 9), yS + (left ? -14 : 14)], L + " bp: " + api.fmt(d, 1) + " mm", {color: c.c3, size: 12.5, weight: 650, anchor: left ? "end" : "start"});
    }
  });
})();
