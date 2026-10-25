// Lateral fluidity of the plasma membrane. Lipids and many proteins diffuse sideways within their own leaflet; in two
// dimensions the root-mean-square distance after time t is r = sqrt(4 D t). Typical diffusion coefficients in a cell's
// plasma membrane: a phospholipid D ~ 1 um^2/s (it swaps places with a neighbour ~10^7 times a second); a free
// transmembrane protein D ~ 0.01-0.1 um^2/s (0.05 used: big, crowded, dragging through more lipid); a protein tethered
// to the actin cortex, like band 3 held by ankyrin in red cells, D ~ 0.001 um^2/s. Time to drift across a 10 um cell:
// L^2 / (4D). Moving to the other leaflet (flip-flop) is the opposite: a polar head must cross the oily core, so a
// phospholipid does it spontaneously only about once in hours to days (flippases and scramblases speed it up), and
// proteins never flip. The walk drawn is one seeded sample path whose size scales with sqrt(D t), as Brownian paths do;
// the patch is scaled to the lipid's rms circle so all three circles keep their true relative sizes.
(function () {
  var MOL = {
    lipid: {D: 1, name: "phospholipid", key: "c1"},
    protein: {D: 0.05, name: "membrane protein", key: "c2"},
    tethered: {D: 0.001, name: "tethered protein", key: "c3"}
  };
  var ORDER = ["lipid", "protein", "tethered"], CELL = 10;
  var PATH = (function () {   // seed 42: a typical walk, ends at 0.92 r_rms, never strays past 1.06 r_rms
    var s = 42, x = 0, y = 0, out = [[0, 0]], N = 240, k = Math.sqrt(2 * N);
    function r() { s = (s * 1664525 + 1013904223) >>> 0; return (s + 0.5) / 4294967296; }
    for (var i = 0; i < N; i++) { var m = Math.sqrt(-2 * Math.log(r())), a = 2 * Math.PI * r(); x += m * Math.cos(a); y += m * Math.sin(a); out.push([x / k, y / k]); }
    return out;
  })();
  function rms(D, t) { return Math.sqrt(4 * D * t); }
  function sig(x) { return x >= 100 ? String(Math.round(x)) : String(Number(x.toPrecision(x < 0.1 ? 2 : 3))); }
  function dist(um) { return um < 1 ? sig(um * 1000) + " nm" : sig(um) + " µm"; }
  function dur(s) { var two = function (x) { return String(Number(x.toPrecision(2))); }; return s < 90 ? two(s) + " s" : s < 5400 ? two(s / 60) + " min" : two(s / 3600) + " h"; }
  function nice(x) { var e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * e; }

  Viz.register("plasma-membrane-lateral-fluidity", {
    title: "Lateral fluidity of the plasma membrane",
    subject: "biology",
    shows: "Pick a molecule and a time: lipids wander microns a second within their leaflet, proteins slower, tethered ones barely, while flipping to the other leaflet takes hours",
    params: {
      molecule: {kind: "enum", values: ORDER, default: "lipid", label: "\\text{molecule}"},
      t: {kind: "number", default: 2, min: 0.1, max: 30, step: 0.1, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var m = MOL[v.molecule];
      return "r_{\\text{rms}}=\\sqrt{4Dt}=\\sqrt{4\\cdot" + m.D + "\\,\\tfrac{\\mu\\text{m}^2}{\\text{s}}\\cdot" + Viz.n(v.t, 1) + "\\text{ s}}=" +
        dist(rms(m.D, v.t)).replace(" µm", "\\ \\mu\\text{m}").replace(" nm", "\\ \\text{nm}");
    },
    status: function (v) {
      var m = MOL[v.molecule], r = rms(m.D, v.t), cross = CELL * CELL / (4 * m.D);
      var tail = v.molecule === "lipid" ? ", yet it flips to the other leaflet only about once in hours to days."
        : v.molecule === "protein" ? ", and it never flips to the other leaflet." : ": the cortex holds it nearly in place.";
      return "In " + sig(v.t) + " s a " + m.name + " wanders about <b>" + dist(r) + "</b>; crossing a 10 µm cell would take about <b>" + dur(cross) + "</b>" + tail;
    },
    examples: [
      {name: "lipid, a tenth of a second", values: {molecule: "lipid", t: 0.1}},
      {name: "lipid, half a minute", values: {molecule: "lipid", t: 30}},
      {name: "protein, 30 s", values: {molecule: "protein", t: 30}},
      {name: "tethered protein", values: {molecule: "tethered", t: 10}}
    ],
    size: [400, 270],
    draw: function (api, v) {
      var c = api.color, sel = MOL[v.molecule], col = c[sel.key];
      var L = function (at, t, o) { return api.label(at, t, Object.assign({size: 12, color: c.muted}, o || {})); };
      // ---- top view of one leaflet, zoomed in 1-2-5 steps so the lipid's rms circle grows with t until the view jumps out
      var P = [10, 24, 200, 200], O = [90, 134], Rl = rms(1, v.t), H = 1;
      [0.5, 1, 2, 5, 10, 20, 50].some(function (h) { H = h; return Rl / h <= 0.8; });
      var k = 70 / H, g = nice(H / 4);
      api.rect(P[0], P[1], P[2], P[3], {fill: c.c1, fillOpacity: 0.04, stroke: c.faint, width: 1, rx: 10});
      for (var gi = -12; gi <= 12; gi++) {
        var gx = O[0] + gi * g * k, gy = O[1] + gi * g * k;
        if (gx > P[0] + 2 && gx < P[0] + P[2] - 2) api.line([gx, P[1] + 1], [gx, P[1] + P[3] - 1], {color: c.grid, width: 1});
        if (gy > P[1] + 2 && gy < P[1] + P[3] - 2) api.line([P[0] + 1, gy], [P[0] + P[2] - 1, gy], {color: c.grid, width: 1});
      }
      L([P[0], 12], "top view of one leaflet");
      L([P[0] + P[2] - 8, P[1] + P[3] - 11], "grid " + dist(g), {anchor: "end"});
      ORDER.forEach(function (id) {
        var r = rms(MOL[id].D, v.t) * k, on = id === v.molecule;
        api.circle(O, Math.max(r, 1.5), {stroke: c[MOL[id].key], width: on ? 2.2 : 1.3, dash: on ? null : "4 3", fill: on ? c[MOL[id].key] : "none", fillOpacity: on ? 0.08 : null, opacity: on ? 1 : 0.65});
      });
      var rLip = Rl * k, rSel = rms(sel.D, v.t), rp = rSel * k;
      var trace = function (scale, at) { return PATH.map(function (q) { return [at[0] + q[0] * scale, at[1] - q[1] * scale]; }); };
      if (v.molecule === "lipid") {
        api.polyline(trace(rp, O), {stroke: col, width: 1.4, opacity: 0.9});
        api.point(trace(rp, O)[PATH.length - 1], {color: col, r: 4});
        L([O[0], O[1] - rLip - 9], "r = " + dist(rSel), {color: col, anchor: "middle", weight: 650});
      } else {
        L([O[0], O[1] + rLip + 12], "lipid " + dist(Rl), {color: c.c1, anchor: "middle"});
        // too small to see at the lipid's scale: a magnified inset in the patch corner
        var mag = nice(26 / rp), box = [120, 30, 84, 80], ic = [box[0] + 42, box[1] + 34], ir = rp * mag;
        api.line([O[0] + rp * 0.7, O[1] - rp * 0.7], [box[0], box[1] + box[3]], {color: col, width: 1, dash: "2 3"});
        api.rect(box[0], box[1], box[2], box[3], {fill: c.card, stroke: col, width: 1.2, rx: 6});
        api.circle(ic, ir, {stroke: col, width: 1.8, fill: col, fillOpacity: 0.08});
        api.polyline(trace(ir, ic), {stroke: col, width: 1.2});
        api.point(trace(ir, ic)[PATH.length - 1], {color: col, r: 3});
        api.point(ic, {color: c.ink, r: 2});
        L([box[0] + 5, box[1] + 10], "×" + mag, {color: col, weight: 650});
        L([box[0] + 42, box[1] + box[3] - 11], "r = " + dist(rSel), {color: col, anchor: "middle", weight: 650});
      }
      api.point(O, {color: c.ink, r: 2.6});
      // ---- side view: the bilayer, the chosen molecule, lateral move versus flip-flop
      var x0 = 222, x1 = 392, yT = 62, yB = 100, sx = 300;
      L([x0, 12], "side view");
      for (var x = x0 + 5; x <= x1 - 2; x += 11) {
        [[yT, 1], [yB, -1]].forEach(function (row) {
          var hit = v.molecule === "lipid" && row[1] === 1 && Math.abs(x - sx) < 5.5;
          if (v.molecule !== "lipid" && Math.abs(x - sx) < 15) return;
          var hc = hit ? c.c1 : c.faint;
          api.line([x - 2, row[0] + 5 * row[1]], [x - 2, row[0] + 15 * row[1]], {color: hc, width: 1.3});
          api.line([x + 2, row[0] + 5 * row[1]], [x + 2, row[0] + 15 * row[1]], {color: hc, width: 1.3});
          api.circle([x, row[0]], 4, {fill: hit ? c.c1 : c.muted, fillOpacity: hit ? 1 : 0.55});
        });
      }
      sx = v.molecule === "lipid" ? x0 + 5 + 11 * Math.round((sx - x0 - 5) / 11) : sx;
      if (v.molecule !== "lipid") api.rect(sx - 11, yT - 12, 22, yB - yT + 24, {fill: col, fillOpacity: 0.75, rx: 9});
      api.line([sx - 34, 38], [sx + 34, 38], {color: col, width: 2, arrow: true, arrowStart: true});
      L([sx, 25], v.molecule === "lipid" ? "lateral: ~10^7 swaps/s" : v.molecule === "protein" ? "lateral: slower" : "lateral: barely", {color: col, anchor: "middle", weight: 600});
      if (v.molecule === "lipid") {
        api.path("M " + (sx + 6) + " " + (yT + 1) + " C " + (sx + 66) + " " + (yT + 4) + " " + (sx + 66) + " " + (yB - 4) + " " + (sx + 8) + " " + (yB + 1), {stroke: c.c5, width: 1.8, dash: "4 3", arrow: true});
        L([x1, yB + 22], "flip-flop: hours to days", {color: c.c5, anchor: "end", weight: 600});
      } else if (v.molecule === "protein") {
        L([x1, yB + 22], "proteins never flip", {color: c.muted, anchor: "end"});
      } else {
        api.line([sx, yB + 12], [sx, yB + 20], {color: c.c3, width: 2.5});
        for (var b = 0; b < 12; b++) api.circle([x0 + 10 + b * 13.5, yB + 25], 5.5, {fill: c.muted, fillOpacity: 0.45});
        L([x1, yB + 42], "held by the actin cortex", {color: c.c3, anchor: "end"});
      }
      // ---- time to drift across a 10 um cell, log scale 1 s .. 10^5 s (about 28 h)
      var ty = 168, lg = function (s) { return x0 + (x1 - x0) * Math.log10(s) / 5; };
      L([x0, ty - 6], "time to cross a 10 µm cell", {color: c.ink});
      ORDER.forEach(function (id, i) {
        var s = CELL * CELL / (4 * MOL[id].D), y = ty + 14 + i * 24, on = id === v.molecule;
        L([x0, y], (id === "tethered" ? "tethered" : id) + ": " + dur(s), {color: on ? c[MOL[id].key] : c.muted, weight: on ? 650 : 500});
        api.rect(x0, y + 7, lg(s) - x0, 8, {fill: c[MOL[id].key], fillOpacity: on ? 0.9 : 0.3, rx: 3});
      });
      L([x0, ty + 92], "1 s", {anchor: "start"});
      L([lg(60), ty + 92], "1 min", {anchor: "middle"});
      L([lg(3600), ty + 92], "1 h", {anchor: "middle"});
      // viz.css paints svg text ink; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
