// Endocrine signaling: a gland releases a hormone into the blood, the circulation carries it to every tissue within about
// a minute, and only cells with the matching receptor respond. Insulin is a peptide from pancreatic beta cells, stored in
// granules and released by exocytosis; it dissolves in plasma, binds a receptor tyrosine kinase on the surface of liver,
// muscle and fat cells (which then take up glucose) and is cleared fast (half-life about 5 min). Cortisol is a steroid
// made on demand in the adrenal cortex; about 90% rides on carrier proteins (CBG, albumin), it crosses any membrane, binds
// the glucocorticoid receptor inside the cell, and the receptor changes transcription in the nucleus (half-life 60-90 min;
// 75 used). After one pulse the plasma level falls by first-order clearance: C(t) = C0 (1/2)^(t / t_half).
// Schematic counts: hormone dots in the blood = round(12 C/C0); occupied receptors on the target cell = round(4 C/C0).
// Colors: amber = hormone, purple = gland, red = blood, teal = target cell, blue = receptors, green = the response.
(function () {
  var H = {
    insulin: {half: 5, gland: "pancreatic β cells", target: "liver, muscle, fat", out: "exocytosis", rec: "receptor on the surface", resp: "→ takes up glucose"},
    cortisol: {half: 75, gland: "adrenal cortex", target: "liver, muscle, immune", out: "diffuses out", rec: "receptor inside the cell", resp: "→ nucleus: new transcription"}
  };
  function frac(v) { return Math.pow(0.5, v.t / H[v.hormone].half); }
  function pct(f) { return f >= 0.995 ? "100%" : f >= 0.095 ? Math.round(f * 100) + "%" : f >= 0.001 ? (f * 100).toFixed(1) + "%" : "under 0.1%"; }

  Viz.register("endocrine-long-distance-signaling", {
    title: "Endocrine signaling over distance",
    subject: "biology",
    shows: "Step a hormone from its gland into the blood and out to distant cells: only cells with its receptor respond, and the half-life sets how long the signal lasts",
    params: {
      hormone: {kind: "enum", values: ["insulin", "cortisol"], default: "insulin", label: "\\text{hormone}"},
      t: {kind: "integer", default: 10, min: 0, max: 120, label: "t\\ (\\text{min})"}
    },
    steps: ["the gland secretes", "the blood carries it everywhere", "only target cells respond"],
    stepMs: 1800,
    formula: function (v) {
      var h = H[v.hormone], f = frac(v);
      var val = f >= 0.01 ? "=" + Viz.n(f, 2) : f >= 0.001 ? "=" + Viz.n(f, 3) : "\\lt 0.001";
      return "C(t)=C_0\\left(\\tfrac12\\right)^{t/t_{1/2}}\\newline =C_0\\left(\\tfrac12\\right)^{" + v.t + "/" + h.half + "}" + val + "\\,C_0";
    },
    status: function (v) {
      var s = v.step || 1, ins = v.hormone === "insulin", f = frac(v), left = "<b>" + pct(f) + "</b> of the pulse is left after " + v.t + " min";
      if (s === 1) return (ins ? "Pancreatic β cells release insulin from secretory granules into nearby capillaries; with a 5-min half-life, "
                               : "The adrenal cortex makes cortisol on demand and it diffuses into nearby capillaries; with a 75-min half-life, ") + left + ".";
      if (s === 2) return (ins ? "Insulin dissolves in plasma and the circulation reaches every tissue within about a minute; "
                               : "Cortisol is fat-soluble, so about 90% rides on carrier proteins as the blood carries it everywhere; ") + left + ".";
      if (f < 0.05) return "Only cells with " + (ins ? "insulin" : "glucocorticoid") + " receptors could respond, but " + left + ", so their receptors sit empty and the signal is over.";
      return ins ? "Insulin cannot cross the membrane, so it binds receptors on the surface of liver, muscle and fat cells, which then take up glucose, while the cell without receptors ignores it (<b>" + pct(f) + "</b> left)."
                 : "Cortisol slips through every membrane, but only a cell with the glucocorticoid receptor responds: the bound receptor enters the nucleus and changes transcription (<b>" + pct(f) + "</b> left).";
    },
    examples: [
      {name: "insulin just released", values: {hormone: "insulin", t: 0, step: 1}},
      {name: "insulin gone after two hours", values: {hormone: "insulin", t: 120, step: 3}},
      {name: "cortisol acts inside the cell", values: {hormone: "cortisol", t: 30, step: 3}},
      {name: "cortisol still around at two hours", values: {hormone: "cortisol", t: 120, step: 2}}
    ],
    size: [400, 312],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, ins = v.hormone === "insulin", h = H[v.hormone], f = frac(v);
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // the gland
      [[48, 46], [66, 38], [84, 48], [56, 64], [76, 64]].forEach(function (p) {
        api.circle(p, 10, {fill: c.c6, fillOpacity: s === 1 ? 0.38 : 0.18, stroke: c.c6, width: 1.6});
        if (ins) api.circle([p[0] + 2, p[1] - 1], 2.4, {fill: c.c3});
      });
      L([66, 16], h.gland, c.c6, {anchor: "middle"});
      // the bloodstream
      api.rect(8, 96, 384, 28, {fill: c.c5, fillOpacity: s === 2 ? 0.22 : 0.12, stroke: c.c5, width: 1.6, rx: 14});
      L([16, 138], "bloodstream →", c.c5, {weight: 500});
      if (s === 1) {
        [[66, 80], [72, 89], [61, 97], [82, 106], [98, 112], [112, 105], [126, 113]].forEach(function (p) { api.circle(p, 3.6, {fill: c.c3}); });
        L([88, 80], h.out, c.c3, {weight: 500});
      } else {
        var n = Math.round(12 * f);
        for (var i = 0; i < n; i++) {
          var p = [118 + i * 22, i % 2 ? 116 : 104];
          if (!ins && i % 10 !== 9) api.circle(p, 7, {stroke: c.muted, width: 1.5});
          api.circle(p, 3.6, {fill: c.c3});
        }
        if (s === 2) L([112, 138], ins ? "dissolved in plasma" : "≈90% on carrier proteins", ins ? c.c3 : c.muted, {weight: 500});
      }
      // a cell without the receptor
      api.circle([318, 50], 24, {fill: c.muted, fillOpacity: 0.08, stroke: c.muted, width: 1.6});
      L([286, s === 3 ? 43 : 50], "no receptor", c.muted, {anchor: "end", weight: 500});
      if (s === 3) {
        L([286, 58], ins ? "ignores insulin" : "enters, no effect", c.muted, {anchor: "end", weight: 500});
        if (!ins && f >= 0.05) api.circle([322, 54], 3.6, {fill: c.c3});
      }
      // the target cell
      var T = [318, 178], R = 32, bound = s === 3 ? Math.round(4 * f) : 0;
      api.circle(T, R, {fill: c.c1, fillOpacity: 0.08, stroke: c.c1, width: 1.8});
      L([276, 152], "target cell", c.c1, {anchor: "end"});
      L([276, 167], h.target, c.c1, {anchor: "end", weight: 500});
      L([276, 182], h.rec, c.c2, {anchor: "end", weight: 500});
      if (ins) {
        [-140, -110, -70, -40].forEach(function (deg, k) {
          var a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
          var b = [T[0] + R * ux, T[1] + R * uy], tip = [T[0] + (R + 9) * ux, T[1] + (R + 9) * uy];
          api.line(b, tip, {color: c.c2, width: 2.2});
          api.line(tip, [tip[0] + 5 * ux + 4 * px, tip[1] + 5 * uy + 4 * py], {color: c.c2, width: 2});
          api.line(tip, [tip[0] + 5 * ux - 4 * px, tip[1] + 5 * uy - 4 * py], {color: c.c2, width: 2});
          if (k < bound) api.circle([tip[0] + 5 * ux, tip[1] + 5 * uy], 3.6, {fill: c.c3});
        });
        if (bound) {
          api.arrow([386, 196], [352, 186], {color: c.c4, width: 2, halo: false, head: 8});
          api.circle([380, 206], 2.6, {fill: c.c4}); api.circle([388, 186], 2.6, {fill: c.c4});
        }
      } else {
        var nuc = [330, 190];
        api.circle(nuc, 11, {fill: c.c4, fillOpacity: bound ? 0.35 : 0.06, stroke: bound ? c.c4 : c.muted, width: 1.5});
        [[298, 172], [310, 160], [334, 160], [302, 192]].forEach(function (p, k) {
          api.rect(p[0] - 4, p[1] - 4, 8, 8, {fill: c.c2, rx: 2});
          if (k < bound) api.circle([p[0] + 7, p[1] - 3], 3.6, {fill: c.c3});
        });
        if (bound) api.arrow([306, 176], [320, 186], {color: c.c4, width: 2, halo: false, head: 7});
      }
      if (bound) L([276, 197], h.resp, c.c4, {anchor: "end"});
      // the plasma level after one pulse, both hormones on one time axis
      var x0 = 44, x1 = 376, yb = 292, yt = 238;
      var X = function (t) { return x0 + (x1 - x0) * t / 120; }, Y = function (q) { return yb - (yb - yt) * q; };
      api.line([x0, yb], [x1, yb], {color: c.axis, width: 1.2});
      api.line([x0, yb], [x0, yt - 4], {color: c.axis, width: 1.2});
      L([16, 222], "level after one pulse (C/C_0)", c.muted, {weight: 500});
      ["insulin", "cortisol"].forEach(function (k) {
        var pts = [], me = k === v.hormone;
        for (var t = 0; t <= 120; t++) pts.push([X(t), Y(Math.pow(0.5, t / H[k].half))]);
        api.polyline(pts, {stroke: me ? c.c3 : c.muted, width: me ? 2.5 : 1.5, dash: me ? null : "4 4"});
      });
      L([X(22), Y(0.22)], "insulin  t½ = 5 min", ins ? c.c3 : c.muted, {weight: ins ? 650 : 500});
      L([X(30), Y(0.96)], "cortisol  t½ = 75 min", ins ? c.muted : c.c3, {weight: ins ? 500 : 650});
      api.line([X(v.t), yb], [X(v.t), Y(f)], {color: c.c3, width: 1.2, dash: "3 3"});
      api.point([X(v.t), Y(f)], {color: c.c3, r: 4.5});
      L([384, 222], "t = " + v.t + " min: " + pct(f) + " left", c.c3, {anchor: "end"});
      L([x0 - 6, yt], "1", c.muted, {anchor: "end", weight: 500});
      L([x0, yb + 12], "0", c.muted, {anchor: "middle", weight: 500});
      L([X(60), yb + 12], "60", c.muted, {anchor: "middle", weight: 500});
      L([x1, yb + 12], "120 min", c.muted, {anchor: "end", weight: 500});
      // the stylesheet paints all svg text ink; keep each label's own color
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
