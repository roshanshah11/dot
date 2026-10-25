// Inside a macrophage's phagosome after it swallows a bacterium. Lysosomes fuse with it (timescale ~10 min) and
// deliver acid hydrolases (cathepsins, lysozyme, lipases, nucleases); the V-ATPase pumps H+ in, so the lumen falls
// from about pH 7 toward 4.5-5, where those enzymes work best. Schematic model, stated so the numbers are honest:
//   pH(t) = pHf + (7 - pHf) e^(-t/8 min),  pHf = 4.6 (fused, pumping), 6.2 (fusion arrested), 7.0 (V-ATPase blocked)
//   hydrolase activity A(pH) = exp(-((pH - 4.8)/0.8)^2)  (acid optimum near pH 4.8, near zero at neutral pH)
//   enzyme delivered E(t) = lysosomes * (1 - e^(-t/10 min));  digestion rate k = 0.012 /min * E * A(pH)
//   intact fraction B(t) = exp(-integral k dt)  (left Riemann sum, dt = 0.5 min)
// Real points it shows: acidification needs the V-ATPase (bafilomycin A1 blocks it and digestion stalls);
// no lysosome fusion means no hydrolases (Mycobacterium tuberculosis arrests its phagosome near pH 6.2 this way).
(function () {
  var DT = 0.5, TMAX = 120;
  function pHf(v) { return !v.pump ? 7.0 : v.lyso > 0 ? 4.6 : 6.2; }
  function act(pH) { return Math.exp(-Math.pow((pH - 4.8) / 0.8, 2)); }
  function series(v) {
    var out = [], B = 1, f = pHf(v);
    for (var i = 0; i <= TMAX / DT; i++) {
      var t = i * DT, pH = f + (7 - f) * Math.exp(-t / 8), E = v.lyso * (1 - Math.exp(-t / 10)), k = 0.012 * E * act(pH);
      out.push({t: t, pH: pH, B: B, A: act(pH), F: 1 - Math.exp(-t / 10)});
      B *= Math.exp(-k * DT);
    }
    return out;
  }
  function now(v) { return series(v)[Math.round(v.t / DT)]; }
  var pc = function (x) { return Math.round(x * 100); };
  Viz.register("immune-phagocytosis-phagolysosome-digestion", {
    title: "Phagolysosome: acid and enzymes digest a microbe",
    subject: "biology",
    shows: "Scrub the minutes after a macrophage swallows a bacterium: lysosomes fuse and bring acid hydrolases, the V-ATPase pumps the lumen down to about pH 4.7, and the bacterium is broken down; block the pump or the fusion and digestion stalls",
    params: {
      t: {kind: "number", default: 30, min: 0, max: 120, step: 5, label: "t\\ (\\text{min})"},
      lyso: {kind: "integer", default: 3, min: 0, max: 6, label: "\\text{lysosomes}"},
      pump: {kind: "boolean", default: true, label: "\\text{pump}", on: "V-ATPase on", off: "blocked (bafilomycin)"}
    },
    formula: function (v) {
      var s = now(v), f = pHf(v);
      var l1 = !v.pump ? "\\text{pH}(t)=7.0\\ \\ (\\text{no H}^{+}\\ \\text{pumping})" :
        "\\text{pH}(t)=" + Viz.n(f) + "+(7-" + Viz.n(f) + ")\\,e^{-t/8}=" + s.pH.toFixed(2);
      return l1 + "\\newline \\text{intact}=e^{-\\int_0^t k\\,dt}=" + pc(s.B) + "\\%";
    },
    status: function (v) {
      var s = now(v);
      if (v.t === 0) return "The phagosome has just sealed around the bacterium at about <b>pH 7</b>; no lysosome has fused yet.";
      if (!v.pump) return "With the V-ATPase blocked the lumen stays near <b>pH 7</b>, where acid hydrolases barely work, so <b>" + pc(s.B) + "%</b> of the bacterium is still intact.";
      if (v.lyso === 0) return "No lysosome fuses (the trick Mycobacterium tuberculosis plays), so the phagosome stalls near <b>pH " + s.pH.toFixed(1) + "</b> with no hydrolases and the bacterium stays intact.";
      return v.lyso + " lysosome" + (v.lyso > 1 ? "s have" : " has") + " fused and the lumen is at <b>pH " + s.pH.toFixed(1) + "</b>; the hydrolases run at " + pc(s.A) + "% of peak and have digested <b>" + (100 - pc(s.B)) + "%</b> of the bacterium.";
    },
    examples: [
      {name: "just sealed", values: {t: 0, lyso: 3, pump: true}},
      {name: "digested", values: {t: 120, lyso: 6, pump: true}},
      {name: "fusion arrested (M. tuberculosis)", values: {t: 60, lyso: 0, pump: true}},
      {name: "V-ATPase blocked", values: {t: 60, lyso: 3, pump: false}},
      {name: "one lysosome", values: {t: 120, lyso: 1, pump: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, data = series(v), s = data[Math.round(v.t / DT)], C = [108, 150], R = 80;
      var P = function (a, r) { var q = a * Math.PI / 180; return [C[0] + r * Math.cos(q), C[1] + r * Math.sin(q)]; };
      var fused = v.lyso > 0 && s.F > 0.5, acid = (7 - s.pH) / 2.4;
      // the vesicle: acid tints the lumen amber
      api.circle(C, R, {fill: c.c3, fillOpacity: 0.04 + 0.26 * acid, stroke: fused ? c.c6 : c.c1, width: 2.4});
      api.label([12, 16], fused ? "phagolysosome" : v.lyso === 0 && v.t > 0 ? "phagosome: fusion blocked" : "phagosome", {color: fused ? c.c6 : c.c1, size: 13, weight: 700});
      // lysosomes approach and merge into the membrane as fusion proceeds
      for (var i = 0; i < v.lyso; i++) {
        var a = 270 + (i - (v.lyso - 1) / 2) * 26, q = P(a, R + 16 * (1 - s.F)), r = 11 - 5 * s.F;
        api.circle(q, r, {fill: c.c6, fillOpacity: 0.45, stroke: c.c6, width: 1.4});
      }
      if (v.lyso > 0) api.label([Math.min(150, C[0] + 22 + v.lyso * 7), 38], v.lyso + " lysosome" + (v.lyso > 1 ? "s" : ""), {color: c.c6, size: 12, weight: 600});
      // hydrolases delivered into the lumen
      var spots = [[-46, -30], [-20, -52], [18, -50], [46, -28], [-56, 6], [56, 10], [-40, 42], [-8, 56], [30, 48], [52, 36], [-30, -10], [34, -12], [0, -30], [-50, 26], [10, 30], [44, 54], [-24, 26], [24, 14]];
      for (var j = 0; s.F > 0.05 && j < v.lyso * 3 && j < spots.length; j++) {
        var h = [C[0] + spots[j][0], C[1] + spots[j][1]];
        api.path("M " + (h[0] - 4) + " " + (h[1] - 3) + " L " + (h[0] + 4) + " " + (h[1] + 3) + " M " + (h[0] - 4) + " " + (h[1] + 3) + " L " + (h[0] + 4) + " " + (h[1] - 3), {stroke: c.c6, width: 1.8, opacity: s.F});
      }
      // H+ ions: more of them as the pH falls
      var hs = [[-36, -44], [28, -36], [-58, -12], [60, -6], [-28, 50], [20, 60], [-60, 32], [58, 28], [4, -58]];
      for (var k = 0; k < Math.min(hs.length, Math.round(3.6 * (7 - s.pH))); k++) api.label([C[0] + hs[k][0], C[1] + hs[k][1]], "H⁺", {color: c.c3, size: 12, weight: 600, anchor: "middle", raw: true});
      // V-ATPase pumps on the lower membrane
      [35, 80, 125, 160].forEach(function (a, n) {
        var o = P(a, R), inn = P(a, R - 18);
        api.circle(o, 6, {fill: v.pump ? c.c3 : "none", stroke: c.c3, width: 1.6});
        if (v.pump) api.arrow(o, inn, {color: c.c3, width: 1.8, halo: false, head: 6});
        else { api.line([o[0] - 5, o[1] - 5], [o[0] + 5, o[1] + 5], {color: c.c5, width: 2}); api.line([o[0] - 5, o[1] + 5], [o[0] + 5, o[1] - 5], {color: c.c5, width: 2}); }
      });
      api.label([20, 250], v.pump ? "V-ATPase pumps H⁺ in" : "V-ATPase blocked", {color: v.pump ? c.c3 : c.c5, size: 12, weight: 600});
      // the bacterium fades and falls apart as it is digested
      api.rect(C[0] - 30, C[1] - 13, 60, 26, {fill: c.c5, fillOpacity: 0.12 + 0.78 * s.B, stroke: c.c5, width: 1.6, rx: 13, dash: s.B < 0.5 ? "4 3" : null});
      var bits = [[-44, -22], [40, -24], [-48, 20], [44, 22], [0, -30], [-16, 30], [18, 32], [-62, -2], [62, 0], [0, 34]];
      for (var m = 0; m < Math.round((1 - s.B) * 10); m++) api.circle([C[0] + bits[m][0] * 0.8, C[1] + bits[m][1] * 0.8], 3.2, {fill: c.c5, fillOpacity: 0.8});
      api.label([20, 270], "pH " + s.pH.toFixed(1), {color: c.c3, size: 13, weight: 700});
      api.label([82, 270], v.lyso === 0 ? "no hydrolases" : s.F < 0.05 ? "no hydrolases yet" : "hydrolases at " + pc(s.A) + "%", {color: c.c6, size: 12, weight: 600});
      api.label([20, 289], "bacterium " + pc(s.B) + "% intact", {color: c.c5, size: 12, weight: 600});
      // time courses: pH (top) and intact bacterium (bottom)
      var X0 = 240, X1 = 388, X = function (t) { return X0 + t / TMAX * (X1 - X0); };
      var pY = function (pH) { return 40 + (7.5 - pH) / 3.5 * 96; }, bY = function (b) { return 270 - b * 84; };
      api.rect(X0, pY(5.5), X1 - X0, pY(4.5) - pY(5.5), {fill: c.c6, fillOpacity: 0.12, rx: 0});
      api.label([X1 - 2, pY(5.28)], "enzyme optimum", {color: c.c6, size: 12, anchor: "end"});
      api.label([X0, 26], "lumen pH", {color: c.muted, size: 12});
      api.line([X0, pY(7.5)], [X0, pY(4)], {color: c.axis, width: 1.2}); api.line([X0, pY(4)], [X1, pY(4)], {color: c.axis, width: 1.2});
      [4, 5, 6, 7].forEach(function (q) { api.label([X0 - 5, pY(q)], String(q), {color: c.muted, size: 12, anchor: "end"}); });
      api.polyline(data.filter(function (d, i) { return i % 4 === 0; }).map(function (d) { return [X(d.t), pY(d.pH)]; }), {stroke: c.c3, width: 2.4});
      api.label([X0, 172], "bacterium intact", {color: c.muted, size: 12});
      api.line([X0, bY(1)], [X0, bY(0)], {color: c.axis, width: 1.2}); api.line([X0, bY(0)], [X1, bY(0)], {color: c.axis, width: 1.2});
      [0, 100].forEach(function (q) { api.label([X0 - 5, bY(q / 100)], q + "%", {color: c.muted, size: 12, anchor: "end"}); });
      api.polyline(data.filter(function (d, i) { return i % 4 === 0; }).map(function (d) { return [X(d.t), bY(d.B)]; }), {stroke: c.c5, width: 2.4});
      [0, 60, 120].forEach(function (q) { api.label([X(q), 284], q === 120 ? "120 min" : String(q), {color: c.muted, size: 12, anchor: q === 120 ? "end" : "middle"}); });
      api.line([X(v.t), pY(7.5)], [X(v.t), bY(0)], {color: c.ink, width: 1.2, dash: "3 3"});
      api.point([X(v.t), pY(s.pH)], {color: c.c3, r: 4});
      api.point([X(v.t), bY(s.B)], {color: c.c5, r: 4});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
