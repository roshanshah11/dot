// Cholesterol as a fluidity buffer. A bilayer of one phospholipid melts from a packed gel to a fluid at its transition
// temperature Tm (DPPC, two saturated tails: 41 °C; POPC, one cis kink: about -2 °C). Cholesterol's rigid rings sit
// beside the top of the tails: above Tm they hold the tails straighter (less fluid), below Tm they keep the tails from
// packing (more fluid), so the sharp melt is smeared into a gentle slope. The curve is a schematic model of relative
// fluidity, F = 0.5 + A (s - 0.5) with s a logistic in (T - Tm) / w, where cholesterol widens w and shrinks A: the
// shape and the direction of each effect are the science; the heights are not measured values.
(function () {
  var TM = {saturated: 41, unsaturated: -2}, NAME = {saturated: "DPPC", unsaturated: "POPC"};
  function F(T, chol, tails) {
    var x = chol / 100, w = 1.2 + 30 * x, A = 0.8 * (1 - 1.3 * x);
    return 0.5 + A * (1 / (1 + Math.exp(-(T - TM[tails]) / w)) - 0.5);
  }
  function u(i) { var s = Math.sin(i * 91.7 + 3.1) * 43758.5453; return s - Math.floor(s); }
  function deg(t) { return Viz.fmt(t, 0) + "\u00a0°C"; }   // non-breaking space: "41 °C" never wraps
  Viz.register("cholesterol-membrane-fluidity", {
    title: "Cholesterol and membrane fluidity",
    subject: "biology",
    shows: "Change the temperature and the cholesterol: above the melting point cholesterol stiffens the membrane, below it cholesterol keeps it from freezing into a gel",
    params: {
      T: {kind: "number", default: 37, min: -20, max: 60, step: 1, label: "T\\,(^\\circ\\text{C})"},
      chol: {kind: "number", default: 20, min: 0, max: 50, step: 5, label: "\\text{chol}\\,\\%"},
      tails: {kind: "enum", values: ["unsaturated", "saturated"], default: "unsaturated", label: "\\text{lipid}",
        names: {unsaturated: "POPC (one kink)", saturated: "DPPC (saturated)"}}
    },
    formula: function (v) {
      var tm = TM[v.tails], d = v.T - tm, rel = Math.abs(d) <= 2 ? "\\approx " : d > 0 ? ">" : "<";
      var eff = v.chol === 0 ? (Math.abs(d) <= 2 ? "\\text{melting}" : d > 0 ? "\\text{fluid}" : "\\text{gel}")
        : Math.abs(d) <= 2 ? "\\text{melt smeared out}" : d > 0 ? "\\text{less fluid with cholesterol}" : "\\text{more fluid with cholesterol}";
      return "T=" + Viz.n(v.T) + "^\\circ\\text{C}" + rel + "T_m=" + Viz.n(tm) + "^\\circ\\text{C}\\Rightarrow" + eff;
    },
    status: function (v) {
      var tm = TM[v.tails], d = v.T - tm;
      if (v.chol === 0) {
        if (Math.abs(d) <= 2) return "No cholesterol: at " + deg(v.T) + " " + NAME[v.tails] + " sits right at its melting point (" + deg(tm) + "), where the bilayer <b>switches sharply</b> from gel to fluid.";
        return d > 0 ? "No cholesterol: at " + deg(v.T) + " the " + NAME[v.tails] + " tails are above their melting point (" + deg(tm) + "), so they flex freely and the membrane is <b>fully fluid</b>."
                     : "No cholesterol: below " + NAME[v.tails] + "'s melting point (" + deg(tm) + ") the tails pack tightly into a <b>gel</b> and the lipids barely move.";
      }
      var pct = v.chol + "% cholesterol";
      if (Math.abs(d) <= 2) return "Near the melting point (" + deg(tm) + ") a pure bilayer would switch sharply from gel to fluid; " + pct + " <b>smears that switch</b> into a gradual change.";
      if (d > 0) return "Above the melting point, cholesterol's rigid rings hold the nearby tails straighter, so " + pct + " makes the membrane <b>less fluid</b> than without it.";
      return "Below the melting point, cholesterol wedges between the tails so they cannot pack into a gel: " + pct + " keeps the membrane <b>more fluid</b> than without it.";
    },
    examples: [
      {name: "minimum: cold, no cholesterol", values: {T: -20, chol: 0, tails: "unsaturated"}},
      {name: "maximum: hot, 50% cholesterol", values: {T: 60, chol: 50, tails: "saturated"}},
      {name: "saturated gel at body temperature", values: {T: 37, chol: 0, tails: "saturated"}},
      {name: "cholesterol rescues a cold gel", values: {T: 25, chol: 40, tails: "saturated"}},
      {name: "right at the melting point", values: {T: 41, chol: 0, tails: "saturated"}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, f = F(v.T, v.chol, v.tails), f0 = F(v.T, 0, v.tails), tm = TM[v.tails];
      // ---- the bilayer: heads on both faces, tails meeting in the middle, cholesterol tucked between ----
      // tails meet at the midplane; a fluid bilayer is thinner because its disordered tails are shorter end to end
      var sp = 17 + 6 * f, L = 46 - 9 * f, yT = 89 - 5 - L, yB = 89 + 5 + L, n = Math.floor(352 / sp), x0 = 200 - (n - 1) * sp / 2;
      api.rect(8, 24, 384, 130, {fill: c.ink, fillOpacity: 0.025, rx: 8});
      [[yT, 1, 0], [yB, -1, 0.5]].forEach(function (lf) {
        var yh = lf[0], dir = lf[1];
        for (var i = 0; i < n; i++) {
          var x = x0 + i * sp, key = i + lf[2] * 1000, isChol = ((i * 0.618034 + lf[2]) % 1) < v.chol / 100;
          if (isChol) {
            api.circle([x, yh + dir * 3], 2.6, {fill: c.c3});
            api.rect(x - 3.5, dir > 0 ? yh + 7 : yh - 27, 7, 20, {fill: c.c3, fillOpacity: 0.85, rx: 2});
            api.line([x, yh + dir * 27], [x + 1.5, yh + dir * 35], {color: c.c3, width: 1.6});
            continue;
          }
          [-2.6, 2.6].forEach(function (off, t) {
            var pts = [], amp = 0.4 + 4.2 * f, ph = u(key * 2 + t) * 6.28, kink = v.tails === "unsaturated" && t === 1;
            var bx = x + off, by = yh + dir * 5, ang = 0;
            for (var s = 0; s <= 8; s++) {
              if (kink && s === 4) ang = 0.5;
              var yy = by + dir * (s * L / 8) * Math.cos(ang), xx = bx + (s * L / 8) * Math.sin(ang) + amp * Math.sin(ph + s * 1.9) * (s / 8);
              pts.push([xx, yy]);
            }
            api.polyline(pts, {stroke: c.muted, width: 1.3});
          });
          api.circle([x, yh], 5, {fill: c.c2, fillOpacity: 0.9});
        }
      });
      // lateral movement: an arrow whose length is the relative fluidity
      var al = 16 + 120 * f;
      api.line([372 - al, 12], [372, 12], {color: c.c1, width: 2, arrow: true, arrowStart: true});
      api.label([366 - al, 12], "lateral movement", {color: c.c1, size: 12, anchor: "end"});
      var word = f < 0.3 ? "gel: tails packed tight" : f > 0.7 ? "fluid: tails disordered" : "in between: tails ordered, still mobile";
      api.label([14, 168], word, {color: c.ink, size: 12.5, weight: 650});
      if (v.chol > 0) api.label([386, 168], "cholesterol", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      // ---- fluidity against temperature, with and without cholesterol ----
      var P = {x0: 40, x1: 388, y0: 288, y1: 186};
      var X = function (t) { return P.x0 + (t + 20) / 80 * (P.x1 - P.x0); }, Y = function (q) { return P.y0 - q * (P.y0 - P.y1); };
      api.line([P.x0, P.y0], [P.x1, P.y0], {color: c.axis, width: 1.2});
      api.line([P.x0, P.y0], [P.x0, P.y1 - 4], {color: c.axis, width: 1.2});
      [-20, 0, 20, 40, 60].forEach(function (t) { api.label([X(t), P.y0 + 12], t + (t === 60 ? " °C" : ""), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([P.x0 - 6, P.y1 + 4], "fluid", {color: c.muted, size: 12, anchor: "end"});
      api.label([P.x0 - 6, P.y0 - 6], "gel", {color: c.muted, size: 12, anchor: "end"});
      api.line([X(tm), P.y0], [X(tm), P.y1], {color: c.faint, width: 1, dash: "3 3"});
      // beside the top of the dashed Tm line, on the side away from it (left for DPPC, right for POPC)
      api.label([X(tm) + (tm > 30 ? -4 : 4), P.y1 + 2], "T_m " + deg(tm), {color: c.muted, size: 12, anchor: tm > 30 ? "end" : "start"});
      var curve = function (ch) { var pts = []; for (var t = -20; t <= 60; t += 0.5) pts.push([X(t), Y(F(t, ch, v.tails))]); return pts; };
      api.polyline(curve(0), {stroke: c.muted, width: 1.6, dash: v.chol ? "5 4" : null});
      if (v.chol) api.polyline(curve(v.chol), {stroke: c.c3, width: 2.4});
      if (v.chol && Math.abs(f - f0) * (P.y0 - P.y1) > 7) api.line([X(v.T), Y(f0)], [X(v.T), Y(f) + (f > f0 ? 3 : -3)], {color: c.c3, width: 1.6, arrow: true});
      api.circle([X(v.T), Y(f0)], 3.5, {fill: c.muted});
      api.point([X(v.T), Y(f)], {color: v.chol ? c.c3 : c.ink, r: 5.5});
      // legend for the two curves, in a corner the curves never reach: DPPC stays low on the left (gel until 41 °C),
      // POPC stays high on the right (fluid above -2 °C)
      if (v.chol) {
        var lx = v.tails === "saturated" ? X(-18) : X(29), ly = v.tails === "saturated" ? 198 : 254;
        api.line([lx, ly], [lx + 18, ly], {color: c.muted, width: 1.6, dash: "5 4"});
        api.label([lx + 23, ly], "no cholesterol", {color: c.muted, size: 12});
        api.line([lx, ly + 16], [lx + 18, ly + 16], {color: c.c3, width: 2.4});
        api.label([lx + 23, ly + 16], v.chol + "% cholesterol", {color: c.c3, size: 12});
      }
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
