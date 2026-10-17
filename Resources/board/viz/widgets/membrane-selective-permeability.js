// What gets through bare lipid on its own, and how long it takes. Permeability coefficients P (cm/s) of protein-free
// phospholipid bilayers span 14 orders of magnitude: O2 about 1e2 (Subczynski, POPC, 114-157 cm/s), CO2 0.35
// (Gutknecht 1977), water 3.4e-3, urea 4e-6 (egg PC, Walter & Gutknecht 1986), glucose about 1e-10 (0.3-2.3e-10 in lipid
// vesicles), Na+ about 1e-12 (1e-12 to 1e-14 in PC bilayers). Exact values depend on the lipids; the ranking does not.
// For a spherical cell of radius r with no transport proteins, the inside approaches the outside with time constant
// V / (P A) = r / (3P), so the half-time is t1/2 = ln 2 * r / (3P) (ignoring voltage, volume change and unstirred layers).
(function () {
  var M = {
    O2: {name: "O₂", tex: "O_2", P: 100, ptex: "100", ptxt: "100", cls: "gas"},
    CO2: {name: "CO₂", tex: "CO_2", P: 0.35, ptex: "0.35", ptxt: "0.35", cls: "gas"},
    water: {name: "H₂O", tex: "H_2O", P: 3.4e-3, ptex: "3.4\\times10^{-3}", ptxt: "3.4×10⁻³", cls: "small"},
    urea: {name: "urea", tex: "\\text{urea}", P: 4e-6, ptex: "4\\times10^{-6}", ptxt: "4×10⁻⁶", cls: "small"},
    glucose: {name: "glucose", tex: "\\text{glucose}", P: 1e-10, ptex: "10^{-10}", ptxt: "~10⁻¹⁰", cls: "large"},
    Na: {name: "Na⁺", tex: "Na^+", P: 1e-12, ptex: "10^{-12}", ptxt: "~10⁻¹²", cls: "ion"}
  };
  var ORDER = ["O2", "CO2", "water", "urea", "glucose", "Na"];
  var WHY = {
    gas: "is small and nonpolar, so it dissolves in the lipid core and slips straight through",
    small: "is polar but small and uncharged, so some still leaks between the lipids",
    large: "is polar and large, so it barely enters the lipid core",
    ion: "is charged and wrapped in water, so the nonpolar core all but shuts it out"
  };
  function half(v) { return Math.LN2 * v.r * 1e-4 / (3 * M[v.mol].P); }
  function when(t) {   // [number, unit] with two significant figures
    var u = t < 1e-3 ? [1e-6, "µs"] : t < 1 ? [1e-3, "ms"] : t < 60 ? [1, "s"] : t < 3600 ? [60, "min"] : t < 86400 ? [3600, "h"] : t < 3.156e7 ? [86400, "days"] : [3.156e7, "years"];
    return [Number((t / u[0]).toPrecision(2)), u[1]];
  }
  Viz.register("membrane-selective-permeability", {
    title: "Selective permeability of the lipid bilayer",
    subject: "biology",
    shows: "Pick a molecule and a cell size: gases cross bare lipid in microseconds, water and urea in seconds to minutes, glucose in weeks and ions in years, which is why cells need transport proteins",
    params: {
      mol: {kind: "enum", values: ORDER, names: {O2: "O₂", CO2: "CO₂", water: "H₂O", urea: "urea", glucose: "glucose", Na: "Na⁺"}, default: "water", label: "\\text{molecule}"},
      r: {kind: "number", default: 10, min: 1, max: 50, step: 1, label: "r\\ (\\mu\\text{m})"}
    },
    formula: function (v) {
      var m = M[v.mol], w = when(half(v));
      return "t_{1/2}=\\ln 2\\,\\frac{r}{3P_{" + m.tex + "}}=0.693\\cdot\\frac{" + v.r + "\\times10^{-4}\\ \\text{cm}}{3\\cdot " + m.ptex + "\\ \\text{cm/s}}\\newline=" + w[0] + "\\ \\text{" + (w[1] === "µs" ? "}\\mu\\text{s" : w[1]) + "}";
    },
    status: function (v) {
      var m = M[v.mol], w = when(half(v)), tail = {gas: ".", small: ".", large: ", which is why cells carry glucose transporters.", ion: ", so ions cross only through channels and pumps."}[m.cls];
      return m.name.charAt(0).toUpperCase() + m.name.slice(1) + " " + WHY[m.cls] + " (P ≈ " + m.ptxt.replace("~", "") + " cm/s): a cell of radius " + v.r + " µm gets halfway to equilibrium in <b>" + w[0] + " " + w[1] + "</b>" + tail;
    },
    examples: [
      {name: "oxygen, smallest cell", values: {mol: "O2", r: 1}},
      {name: "sodium, largest cell", values: {mol: "Na", r: 50}},
      {name: "glucose without a transporter", values: {mol: "glucose", r: 10}},
      {name: "carbon dioxide", values: {mol: "CO2", r: 10}},
      {name: "urea", values: {mol: "urea", r: 25}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, col = {gas: c.c4, small: c.c2, large: c.c6, ion: c.c5}, sel = M[v.mol], sc = col[sel.cls];
      // the ladder: log10 P from 10^2 (top) to 10^-12 (bottom)
      var AX = 62, YT = 26, YB = 210, py = function (P) { return YT + (YB - YT) * (2 - Math.log10(P)) / 14; };
      api.line([AX, YT - 6], [AX, YB + 4], {color: c.axis, width: 1.2});
      [[2, "10²"], [-2, "10⁻²"], [-6, "10⁻⁶"], [-10, "10⁻¹⁰"]].forEach(function (q) { api.label([AX - 6, py(Math.pow(10, q[0]))], q[1], {color: c.muted, size: 12, anchor: "end", raw: true}); });
      api.label([AX - 6, 10], "P, cm/s", {color: c.muted, size: 12, anchor: "start"});
      ORDER.forEach(function (k) {
        var m = M[k], y = py(m.P), on = k === v.mol, cc = col[m.cls];
        if (on) api.rect(AX + 2, y - 10, 172, 20, {fill: cc, fillOpacity: 0.16, rx: 5});
        api.circle([AX, y], on ? 5.5 : 4, {fill: cc});
        api.label([AX + 10, y], m.name, {color: cc, size: on ? 13 : 12, weight: on ? 700 : 500});
        api.label([AX + 74, y], m.ptxt, {color: on ? c.ink : c.muted, size: 12});
      });
      // the cell: radius drawn to scale between 1 and 50 um, solute outside, arrows in
      var C = [318, 104], R = 18 + 42 * (v.r - 1) / 49, lp = Math.log10(sel.P), slow = lp < -8;
      api.circle(C, R, {fill: c.ink, fillOpacity: 0.04, stroke: c.c3, width: 3});
      api.circle(C, Math.max(1, R - 4), {stroke: c.c3, width: 1, opacity: 0.6});
      api.line(C, [C[0] + R * 0.707, C[1] + R * 0.707], {color: c.muted, width: 1.2, dash: "2 3"});
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4 + 0.39, d = R + 22;
        api.circle([C[0] + d * Math.cos(a), C[1] + d * Math.sin(a)], 4, {fill: sc});
        if (i % 2 === 0) {
          var p0 = [C[0] + (R + 15) * Math.cos(a), C[1] + (R + 15) * Math.sin(a)], p1 = [C[0] + (R - 7) * Math.cos(a), C[1] + (R - 7) * Math.sin(a)];
          api.arrow(p0, p1, {color: sc, width: 1 + 2.4 * (lp + 12) / 14, halo: false, dash: slow ? "2 3" : null, head: 7, opacity: slow ? 0.7 : 1});
        }
      }
      api.label([C[0], 12], sel.name + " outside a cell of r = " + v.r + " µm", {color: sc, size: 12, anchor: "middle"});
      // the half-time on a log clock from 0.1 us to 100 years
      var X0 = 20, X1 = 388, TY = 256, tx = function (t) { return X0 + (X1 - X0) * (Math.log10(t) + 7) / 16.5; };
      api.line([X0, TY], [X1, TY], {color: c.axis, width: 1.4});
      [[1e-6, "1 µs"], [1e-3, "1 ms"], [1, "1 s"], [60, "1 min"], [3600, "1 h"], [86400, "1 day"], [3.156e7, "1 yr"]].forEach(function (q) {
        api.line([tx(q[0]), TY - 4], [tx(q[0]), TY + 4], {color: c.axis, width: 1.2});
        api.label([tx(q[0]), TY + 16], q[1], {color: c.muted, size: 12, anchor: "middle"});
      });
      var t = half(v), w = when(t), x = tx(t);
      api.polygon([[x, TY - 3], [x - 6, TY - 13], [x + 6, TY - 13]], {fill: sc, fillOpacity: 1});
      api.label([x, TY - 24], "t½ = " + w[0] + " " + w[1], {color: sc, size: 13, weight: 700, anchor: x < 60 ? "start" : x > 340 ? "end" : "middle"});
      api.label([X1, 292], "time to get halfway (log scale)", {color: c.muted, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (q) { var f = q.getAttribute("fill"); if (f) q.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
