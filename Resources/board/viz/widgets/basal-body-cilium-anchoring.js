// A cilium and the basal body it grows from, cut at any height. The basal body is a modified centriole: 9 triplet
// microtubules (A, B, C), with the 9-spoked cartwheel that set its symmetry at the proximal end. At its distal end
// transition fibers dock it to the plasma membrane; a basal foot points the beat and a striated rootlet anchors it in
// the cytoplasm. In the transition zone the C tubules have ended (9 doublets) and Y-links tie the doublets to the
// membrane. The axoneme is 9+2 in a motile cilium (central pair, dynein arms, radial spokes) and 9+0 in a primary one;
// near the tip the B tubules end, leaving singlets. Heights are drawn not to scale (a cilium is ~10x its basal body).
(function () {
  var REG = [[10, "cartwheel"], [28, "bb"], [34, "tf"], [42, "tz"], [92, "ax"], [101, "tip"]];
  function region(z) { for (var i = 0; i < REG.length; i++) if (z < REG[i][0]) return REG[i][1]; return "tip"; }
  var NAME = {cartwheel: "proximal basal body", bb: "basal body", tf: "basal body, distal end", tz: "transition zone", ax: "axoneme", tip: "ciliary tip"};
  function count(v) {
    var r = region(v.cut), cp = v.type === "motile" && (r === "ax" || r === "tip") ? 2 : 0;
    var per = r === "tz" || r === "ax" ? 2 : r === "tip" ? 1 : 3;
    return {r: r, per: per, cp: cp, n: 9 * per + cp};
  }

  Viz.register("basal-body-cilium-anchoring", {
    title: "Basal body: how a cilium is anchored",
    subject: "biology",
    shows: "Drag the cut up a cilium: 9 triplets and a cartwheel in the basal body, transition fibers docking it to the membrane, 9 doublets in the transition zone, then a 9+2 or 9+0 axoneme and singlets at the tip",
    params: {
      cut: {kind: "number", default: 60, min: 0, max: 100, step: 1, label: "\\text{cut height}"},
      type: {kind: "enum", values: ["motile", "primary"], default: "motile", label: "\\text{cilium}"}
    },
    formula: function (v) {
      var k = count(v);
      return "\\text{" + NAME[k.r] + "}\\newline n_{\\text{MT}}=9\\times" + k.per + "+" + k.cp + "=" + k.n;
    },
    status: function (v) {
      var r = region(v.cut), mot = v.type === "motile";
      return {
        cartwheel: "At the proximal end sits the cartwheel, the 9-spoked scaffold that set the ninefold symmetry of the <b>9 triplets</b> when the centriole was built.",
        bb: "The basal body is a modified centriole: <b>9 triplets</b> of A, B and C tubules around an empty middle, with a basal foot and a striated rootlet holding it in place.",
        tf: "At its distal end, <b>transition fibers</b> reach from the triplets out to the plasma membrane and dock the basal body there, anchoring the cilium.",
        tz: "In the <b>transition zone</b> the C tubules have ended, leaving 9 doublets, and Y-links tie them to the membrane as a gate for what enters the cilium.",
        ax: mot ? "A motile axoneme is <b>9 + 2</b>: dynein arms on each doublet walk along the next one, and radial spokes to the central pair turn that sliding into bending."
                : "A primary cilium's axoneme is <b>9 + 0</b>: no central pair and no dynein arms, so it does not beat; it senses signals like an antenna.",
        tip: "Near the tip the B tubules stop, leaving <b>single A tubules</b>" + (mot ? " around the central pair." : " and no central pair.")
      }[r];
    },
    examples: [
      {name: "cartwheel, base of the basal body", values: {cut: 0}},
      {name: "transition fibers", values: {cut: 31}},
      {name: "transition zone", values: {cut: 38}},
      {name: "primary cilium, 9+0", values: {cut: 60, type: "primary"}},
      {name: "motile tip", values: {cut: 100}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = count(v), mot = v.type === "motile", LX = 92, Y = function (z) { return 246 - z * 2.1; };
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var yM = Y(34), top = Y(100);
      // ---- longitudinal view ----
      api.path("M 30 " + yM + " L " + (LX - 30) + " " + yM + " Q " + (LX - 21) + " " + yM + " " + (LX - 21) + " " + (yM - 10) + " L " + (LX - 21) + " " + (top + 4) +
        " Q " + LX + " " + (top - 16) + " " + (LX + 21) + " " + (top + 4) + " L " + (LX + 21) + " " + (yM - 10) + " Q " + (LX + 21) + " " + yM + " " + (LX + 30) + " " + yM + " L 190 " + yM,
        {stroke: c.muted, width: 2});
      L([186, yM - 10], "membrane", c.muted, {anchor: "end", weight: 500});
      var tubes = function (z0, z1, xs) { xs.forEach(function (dx) { api.line([LX + dx, Y(z0)], [LX + dx, Y(z1)], {color: c.ink, width: 1.6}); }); };
      tubes(0, 34, [-15, -12, -9, 9, 12, 15]);
      tubes(34, 92, [-14, -11, 11, 14]); tubes(92, 99, [-12, 12]);
      if (mot) tubes(42, 99, [-2.5, 2.5]);
      for (var z = 1; z < 10; z += 3) api.line([LX - 7, Y(z)], [LX + 7, Y(z)], {color: c.c6, width: 1.8});
      [-1, 1].forEach(function (sg) {
        api.line([LX + sg * 15, Y(30)], [LX + sg * 40, yM], {color: c.c4, width: 2.4});
        for (var zz = 35; zz < 42; zz += 2.5) api.line([LX + sg * 14, Y(zz)], [LX + sg * 21, Y(zz)], {color: c.c4, width: 1.4});
      });
      api.polygon([[LX + 15, Y(24)], [LX + 36, Y(20)], [LX + 15, Y(15)]], {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 1.2});
      L([LX + 40, Y(20)], "basal foot", c.c6, {weight: 500});
      L([LX + 44, yM + 12], "transition fibers", c.c4, {weight: 500});
      api.path("M " + (LX - 6) + " " + Y(0) + " L " + (LX + 22) + " 292 L " + (LX + 32) + " 290 L " + (LX + 6) + " " + Y(0) + " Z", {fill: c.c5, fillOpacity: 0.3, stroke: c.c5, width: 1.2});
      for (var f = 0.15; f < 1; f += 0.17) api.line([LX - 6 + 28 * f, Y(0) + (292 - Y(0)) * f], [LX + 6 + 26 * f, Y(0) + (290 - Y(0)) * f], {color: c.c5, width: 1.2});
      L([LX + 36, 284], "striated rootlet", c.c5, {weight: 500});
      L([LX + 30, top + 4], mot ? "motile cilium" : "primary cilium", c.ink, {weight: 500});
      // region bracket on the left, current region highlighted
      [[0, 34, "basal body"], [34, 42, "TZ"], [42, 92, "axoneme"], [92, 100, "tip"]].forEach(function (b) {
        var on = v.cut >= b[0] && (v.cut < b[1] || b[1] === 100);
        api.line([24, Y(b[0]) - 1.5], [24, Y(b[1]) + 1.5], {color: on ? c.accent : c.faint, width: on ? 4 : 2.5});
        var t = L([13, (Y(b[0]) + Y(b[1])) / 2], b[2], on ? c.accent : c.muted, {anchor: "middle", weight: on ? 700 : 500, clamp: false});
        t.setAttribute("transform", "rotate(-90 13 " + (Y(b[0]) + Y(b[1])) / 2 + ")");
      });
      // the cut and its handle
      var yc = Y(v.cut);
      api.line([30, yc], [LX + 26, yc], {color: c.accent, width: 1.8, dash: "6 4"});
      api.handle([46, yc], {color: c.accent, onDrag: function (q) { api.set({cut: Math.round(Math.max(0, Math.min(100, (246 - q[1]) / 2.1)))}); }});
      // ---- cross-section at the cut ----
      var C = [306, 116], RU = 46, RM = 70, r = k.r;
      L([306, 14], NAME[r] + (r === "ax" ? (mot ? " (9+2)" : " (9+0)") : ""), c.ink, {anchor: "middle", size: 13, weight: 700});
      if (r === "tz" || r === "ax" || r === "tip") api.circle(C, RM, {fill: c.ink, fillOpacity: 0.03, stroke: c.muted, width: 2});
      if (r === "tf") api.circle(C, RM + 12, {stroke: c.muted, width: 1.6, dash: "5 4"});
      var tilt = k.per === 3 ? 0.87 : 0.2, rT = 6.2;
      if (r === "cartwheel") api.circle(C, 9, {fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 1.6});
      if (k.cp) { api.circle(C, 17, {stroke: c.c2, width: 1, opacity: 0.6}); api.circle([C[0] - 7, C[1]], 6, {fill: c.c2, fillOpacity: 0.3, stroke: c.c2, width: 1.6}); api.circle([C[0] + 7, C[1]], 6, {fill: c.c2, fillOpacity: 0.3, stroke: c.c2, width: 1.6}); }
      for (var i = 0; i < 9; i++) {
        var ph = -Math.PI / 2 + i * 2 * Math.PI / 9, n = [Math.cos(ph), Math.sin(ph)], t2 = [-Math.sin(ph), Math.cos(ph)];
        var u = [t2[0] * Math.cos(tilt) + n[0] * Math.sin(tilt), t2[1] * Math.cos(tilt) + n[1] * Math.sin(tilt)], P = [C[0] + RU * n[0], C[1] + RU * n[1]];
        var off = (k.per - 1) / 2, cen = [];
        for (var j = 0; j < k.per; j++) cen.push([P[0] + u[0] * 2 * rT * (j - off), P[1] + u[1] * 2 * rT * (j - off)]);
        var A = cen[0];
        if (r === "cartwheel") api.line([C[0] + 9 * n[0], C[1] + 9 * n[1]], A, {color: c.c6, width: 1.8});
        if (r === "tf") api.line(cen[2], [C[0] + (RM + 12) * Math.cos(ph + 0.3), C[1] + (RM + 12) * Math.sin(ph + 0.3)], {color: c.c4, width: 2.6});
        if (r === "tz") {
          var m = [(cen[0][0] + cen[1][0]) / 2, (cen[0][1] + cen[1][1]) / 2], st = [C[0] + (RM - 10) * n[0], C[1] + (RM - 10) * n[1]];
          api.line(m, st, {color: c.c4, width: 1.6});
          [-0.09, 0.09].forEach(function (d) { api.line(st, [C[0] + RM * Math.cos(ph + d), C[1] + RM * Math.sin(ph + d)], {color: c.c4, width: 1.6}); });
        }
        if (r === "ax" && mot) {
          var tipS = [C[0] + 24 * n[0], C[1] + 24 * n[1]];
          api.line(A, tipS, {color: c.c1, width: 1.6}); api.circle(tipS, 2.6, {fill: c.c1});
          [[3.5, 1], [-3.5, 1]].forEach(function (q) {
            var b0 = [A[0] + n[0] * q[0], A[1] + n[1] * q[0]];
            api.line(b0, [b0[0] - t2[0] * 9 + n[0] * q[0] * 0.4, b0[1] - t2[1] * 9 + n[1] * q[0] * 0.4], {color: c.c3, width: 2.6});
          });
        }
        cen.forEach(function (q, j) { api.circle(q, rT, {fill: c.ink, fillOpacity: j === 0 ? 0.22 : 0.08, stroke: c.ink, width: 1.5}); });
        if (i === 0 && k.per > 1) cen.forEach(function (q, j) { L([q[0] + u[0] * 2 + n[0] * 14, q[1] + u[1] * 2 + n[1] * 14 - 2], "ABC".charAt(j), c.ink, {anchor: "middle", size: 12, weight: 700}); });
      }
      // what this cross-section shows, in the colors used above
      var feats = {cartwheel: [["9 triplets of A, B and C tubules", c.ink], ["cartwheel hub and 9 spokes", c.c6]],
                   bb: [["9 triplets of A, B and C tubules", c.ink], ["nothing in the middle", c.muted]],
                   tf: [["9 triplets", c.ink], ["transition fibers to the membrane", c.c4]],
                   tz: [["9 doublets: the C tubules have ended", c.ink], ["Y-links to the membrane", c.c4]],
                   ax: mot ? [["central pair of singlets", c.c2], ["dynein arms on each doublet", c.c3], ["radial spokes to the center", c.c1]]
                           : [["9 doublets, no central pair", c.ink], ["no dynein arms: it does not beat", c.muted]],
                   tip: mot ? [["9 single A tubules", c.ink], ["central pair continues", c.c2]] : [["single A tubules", c.ink], ["no central pair", c.muted]]}[r];
      feats.forEach(function (fq, j) { L([306, 216 + j * 18], fq[0], fq[1], {anchor: "middle", weight: 500}); });
      L([306, 290], "not to scale", c.faint, {anchor: "middle", weight: 500});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
