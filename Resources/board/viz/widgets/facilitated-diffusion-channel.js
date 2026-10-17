// Facilitated diffusion through a channel: a K+ channel, a water-filled pore with a selectivity filter and a gate.
// Open, it lets K+ run down its electrochemical gradient with no binding cycle and no ATP; closed, nothing crosses.
// Direction comes from the driving force V_m - E_K, with E_K from the Nernst equation at 37 C (RT/F ln 10 = 61.5 mV).
// The flux in the plot is the Goldman-Hodgkin-Katz flux for one open channel (u = V_m F/RT):
//   J_out = P u (Ci - Co e^-u) / (1 - e^-u),   which is P (Ci - Co) at 0 mV and exactly 0 at V_m = E_K,
// a straight line in the outside concentration (no saturation, unlike a carrier). P is left in relative units.
(function () {
  var RTF = 61.5 / Math.LN10;                                        // RT/F in mV at 37 C, matching the 61.5 shown
  function ek(v) { return 61.5 * Math.log10(v.kOut / v.kIn); }
  function jOut(co, ci, vm) { var u = vm / RTF; return Math.abs(u) < 1e-6 ? ci - co : u * (ci - co * Math.exp(-u)) / (1 - Math.exp(-u)); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

  Viz.register("facilitated-diffusion-channel", {
    title: "Facilitated diffusion: channel proteins",
    subject: "biology",
    shows: "Open or close a K⁺ channel and change the concentrations and membrane voltage: ions run through the pore down their electrochemical gradient, with no carrier cycle to saturate and no ATP",
    params: {
      kOut: {kind: "number", default: 5, min: 1, max: 150, step: 1, label: "[\\mathrm{K^+}]_o"},
      kIn: {kind: "number", default: 140, min: 1, max: 150, step: 1, label: "[\\mathrm{K^+}]_i"},
      vm: {kind: "number", default: -70, min: -120, max: 60, step: 1, label: "V_m\\ (\\text{mV})"},
      open: {kind: "boolean", default: true, label: "\\text{gate}", on: "open", off: "closed"}
    },
    formula: function (v) {
      var E = r1(ek(v)), d = r1(v.vm - E);
      return "E_K=61.5\\log_{10}\\tfrac{" + Viz.n(v.kOut) + "}{" + Viz.n(v.kIn) + "}=" + E.toFixed(1) + "\\ \\text{mV}\\newline V_m-E_K=" + Viz.n(v.vm) + "-" +
        (E < 0 ? "(" + E.toFixed(1) + ")" : E.toFixed(1)) + "=" + d.toFixed(1) + "\\ \\text{mV}";
    },
    status: function (v) {
      var E = r1(ek(v)), d = r1(v.vm - E), side = d > 0 ? "out" : "in";
      if (!v.open && Math.abs(d) < 0.05) return "The gate is <b>closed</b>, and with Vₘ at Eₖ there would be no net flow even if it opened.";
      if (!v.open) return "The gate is <b>closed</b>, so nothing crosses even with a " + Viz.fmt(Math.abs(d), 1) + " mV driving force; voltage, a ligand or stretch opens gated channels.";
      if (Math.abs(d) < 0.05) return "Vₘ equals the K⁺ equilibrium potential: the electrical pull exactly balances the concentration gradient, so there is <b>no net flow</b> (Vₘ = Eₖ).";
      var chem = Math.sign(v.kIn - v.kOut), elec = Math.sign(v.vm), dir = Math.sign(d);   // +1 = pushes K+ out
      var why = !chem ? "only the voltage drives it" : !elec ? "only the concentration gradient drives it" :
        chem === elec ? "the concentration gradient and the voltage both push it " + side :
        chem === dir ? "the concentration gradient outweighs the voltage" : "the voltage outweighs the concentration gradient";
      return "Open: K⁺ flows <b>" + side + "</b> through the pore, down its electrochemical gradient (Vₘ is " + Viz.fmt(Math.abs(d), 1) + " mV " + (d > 0 ? "above" : "below") + " Eₖ, so " + why + "), with no ATP.";
    },
    examples: [
      {name: "resting neuron: K⁺ leaks out", values: {kOut: 5, kIn: 140, vm: -70, open: true}},
      {name: "at Eₖ: no net flow", values: {kOut: 5, kIn: 140, vm: -89, open: true}},
      {name: "no voltage: concentration alone", values: {kOut: 5, kIn: 140, vm: 0, open: true}},
      {name: "gate closed", values: {kOut: 5, kIn: 140, vm: -70, open: false}},
      {name: "high outside K⁺: flows in", values: {kOut: 140, kIn: 10, vm: -70, open: true}},
      {name: "every value at its minimum", values: {kOut: 1, kIn: 1, vm: -120, open: false}},
      {name: "every value at its maximum", values: {kOut: 150, kIn: 150, vm: 60, open: true}}
    ],
    size: [400, 330],
    draw: function (api, v) {
      var c = api.color, E = r1(ek(v)), d = r1(v.vm - E), m0 = 52, m1 = 80, mid = (m0 + m1) / 2, cx = 200;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // membrane, K+ on each side (one dot per 6 mM) kept clear of the channel and its labels, charges for the voltage
      api.rect(14, m0, 372, m1 - m0, {fill: c.ink, fillOpacity: 0.06, rx: 3});
      api.line([14, m0], [386, m0], {color: c.muted, width: 1.3}); api.line([14, m1], [386, m1], {color: c.muted, width: 1.3});
      var dots = function (conc, y0, y1, seed) {                     // x spread over [20, 380] minus the channel zone
        var r = rng(seed), k = Math.max(1, Math.round(conc / 6));
        for (var i = 0; i < k; i++) { var x = 20 + r() * 250; if (x > 160) x += 110; api.circle([x, y0 + r() * (y1 - y0)], 2.8, {fill: c.c6, opacity: 0.8}); }
      };
      dots(v.kOut, 20, m0 - 10, 3); dots(v.kIn, m1 + 10, 108, 7);
      T([16, 8], "outside  K⁺ " + api.fmt(v.kOut) + " mM", c.muted, {weight: 500});
      T([16, 119], "cytosol  K⁺ " + api.fmt(v.kIn) + " mM", c.muted, {weight: 500});
      var q = Math.min(6, Math.round(Math.abs(v.vm) / 20));
      for (var i = 0; i < q; i++) {
        var x = i % 2 === 0 ? 318 + (i / 2) * 26 : 140 - ((i - 1) / 2) * 26;
        T([x, m0 + 7], v.vm < 0 ? "+" : "−", c.c3, {anchor: "middle", size: 12, weight: 700});
        T([x, m1 - 7], v.vm < 0 ? "−" : "+", c.c3, {anchor: "middle", size: 12, weight: 700});
      }
      // the channel: two walls, a narrow selectivity filter near the outside, a gate at the cytosolic end
      [-1, 1].forEach(function (sg) {
        api.polygon([[cx + sg * 30, m0 - 9], [cx + sg * 6, m0 - 9], [cx + sg * 4, m0 + 4], [cx + sg * 9, m1 - 4], [cx + sg * (v.open ? 9 : 2), m1 + 9], [cx + sg * 30, m1 + 9]],
          {fill: c.c1, fillOpacity: 0.28, stroke: c.c1, width: 1.4});
      });
      api.line([272, 13], [cx + 8, m0 - 2], {color: c.c1, width: 1, dash: "2 2"});
      T([386, 8], "selectivity filter", c.c1, {anchor: "end"});
      var gcol = v.open ? c.c1 : c.c5;
      api.line([300, 114], [cx + 10, m1 + 8], {color: gcol, width: 1, dash: "2 2"});
      T([386, 119], v.open ? "gate open" : "gate closed", gcol, {anchor: "end"});
      var flow = v.open && Math.abs(d) >= 0.05;
      if (flow) {
        [m0 + 2, mid + 2, m1 - 2].forEach(function (y) { api.circle([cx, y], 3, {fill: c.c6}); });
        var w = 2 + 4 * Math.min(1, Math.abs(d) / 120);
        api.arrow([cx + 48, d > 0 ? m1 + 18 : m0 - 18], [cx + 48, d > 0 ? m0 - 18 : m1 + 18], {color: c.c4, width: w, halo: false, head: 9});
        T([cx + 58, mid], "K⁺ " + (d > 0 ? "out" : "in"), c.c4, {anchor: "start"});
      } else T([cx + 38, mid], v.open ? "no net flow" : "blocked", v.open ? c.c4 : c.c5, {anchor: "start"});
      // ---- driving force on a millivolt line: E_K, V_m and the arrow between them ----
      var sx0 = 44, sx1 = 344, sy = 152, S = function (mv) { return sx0 + (mv + 150) / 300 * (sx1 - sx0); };
      api.line([sx0, sy], [sx1, sy], {color: c.axis, width: 1.2});
      [-150, -100, -50, 0, 50, 100, 150].forEach(function (mv) { api.line([S(mv), sy - 3], [S(mv), sy + 3], {color: c.axis, width: 1}); });
      T([sx0 - 4, sy], "−150", c.muted, {anchor: "end", weight: 500}); T([sx1 + 4, sy], "+150 mV", c.muted, {anchor: "start", weight: 500});
      if (Math.abs(S(v.vm) - S(0)) > 22) T([S(0), sy + 13], "0", c.muted, {anchor: "middle", weight: 500});
      if (Math.abs(d) >= 0.05) api.arrow([S(E), sy], [S(v.vm), sy], {color: v.open ? c.c4 : c.faint, width: 3, halo: false, head: Math.min(9, Math.abs(S(v.vm) - S(E)))});
      api.line([S(E), sy - 10], [S(E), sy + 4], {color: c.c6, width: 2.2});
      T([S(E), sy - 17], "Eₖ " + api.fmt(E, 1), c.c6, {anchor: "middle"});
      api.polygon([[S(v.vm), sy + 3], [S(v.vm) - 5, sy + 11], [S(v.vm) + 5, sy + 11]], {fill: c.c3, fillOpacity: 1});
      T([S(v.vm), sy + 21], "V_m " + api.fmt(v.vm), c.c3, {anchor: "middle"});
      // ---- outward flux vs outside K+ at this voltage: a straight line through zero where V_m = E_K ----
      // The Co axis zooms to fit this setting (the point, and the zero crossing with room past it), up to 150 mM: on a fixed
      // 0-150 axis a resting neuron's point (5 mM, flux 14.7 against 395 at 150 mM) sat 1.6 px above zero and looked like no flux.
      var zc = v.kIn * Math.exp(v.vm / RTF);                         // outside K+ at which this V_m is E_K
      var want = Math.min(150, Math.max(20, 2 * v.kOut, 1.5 * zc)), AX = [[20, 5], [30, 10], [50, 10], [80, 20], [100, 25], [150, 50]];
      var ax = AX.filter(function (a) { return a[0] >= want - 1e-9; })[0], coMax = ax[0];
      var bx0 = 52, bx1 = 360, by0 = 200, by1 = 292, yc = (by0 + by1) / 2, X = function (co) { return bx0 + co / coMax * (bx1 - bx0); };
      var j0 = jOut(0, v.kIn, v.vm), j1 = jOut(coMax, v.kIn, v.vm), top = Math.max(Math.abs(j0), Math.abs(j1), 1) * 1.08;
      var Y = function (j) { return yc - j / top * (by1 - by0) / 2; };
      api.line([bx0, by0 - 4], [bx0, by1 + 4], {color: c.axis, width: 1.2}); api.line([bx0, yc], [bx1 + 4, yc], {color: c.axis, width: 1.2});
      T([bx0 - 6, by0 + 2], "out", c.muted, {anchor: "end", weight: 500}); T([bx0 - 6, by1 - 2], "in", c.muted, {anchor: "end", weight: 500}); T([bx0 - 6, yc], "0", c.muted, {anchor: "end", weight: 500});
      for (var co = 0; co <= coMax + 1e-9; co += ax[1]) { api.line([X(co), by1 + 4], [X(co), by1 + 8], {color: c.axis, width: 1}); T([X(co), by1 + 16], String(co), c.muted, {anchor: "middle", weight: 500}); }
      T([(bx0 + bx1) / 2, 322], "net K⁺ flux (units of P) vs outside K⁺ (mM) at V_m = " + api.fmt(v.vm) + " mV", c.muted, {anchor: "middle", weight: 500});
      if (!v.open) api.line([X(0), Y(j0)], [X(coMax), Y(j1)], {color: c.c2, width: 1.2, dash: "4 4", opacity: 0.5});
      api.line([X(0), Y(v.open ? j0 : 0)], [X(coMax), Y(v.open ? j1 : 0)], {color: c.c2, width: 2.6});
      if (!v.open) T([X(coMax), yc - 10], "closed: 0", c.c2, {anchor: "end"});
      var jy = v.open ? jOut(v.kOut, v.kIn, v.vm) : 0, px = X(v.kOut), py = Y(jy);
      // labels: the value at the point (it agrees with the status) and the zero crossing, each at the first spot around its
      // dot that stays in the plot and clear of the flux line, the zero axis, both dots and the other label
      var box = function (x, y, t, a) { var w = t.length * 6.9, x0 = a === "end" ? x - w : a === "middle" ? x - w / 2 : x; return {x: x, y: y, a: a, x0: x0, x1: x0 + w, y0: y - 7, y1: y + 7}; };
      var hit = function (p, q) { return p.x0 < q.x1 + 3 && q.x0 < p.x1 + 3 && p.y0 < q.y1 + 1 && q.y0 < p.y1 + 1; };
      var lj0 = v.open ? j0 : 0, lj1 = v.open ? j1 : 0, yAt = function (x) { return Y(lj0 + (lj1 - lj0) * (x - bx0) / (bx1 - bx0)); };
      var dots = [[px, py]].concat(v.open && zc <= coMax ? [[X(zc), yc]] : []);
      var clear = function (p) {
        if (p.x0 < bx0 + 4 || p.x1 > 396 || p.y0 < by0 - 16 || p.y1 > by1 + 2 || (p.y0 - 1 < yc && p.y1 + 1 > yc)) return false;
        var ya = yAt(p.x0), yb = yAt(p.x1);
        if (!(Math.min(ya, yb) > p.y1 + 1 || Math.max(ya, yb) < p.y0 - 1)) return false;
        return dots.every(function (q) { return !hit(p, {x0: q[0] - 5, x1: q[0] + 5, y0: q[1] - 5, y1: q[1] + 5}); });
      };
      var spots = function (x, y, t) {
        return [[8, -11, "start"], [-8, 11, "end"], [-8, -11, "end"], [8, 11, "start"], [0, -16, "middle"], [0, 16, "middle"], [-8, -24, "end"], [8, 24, "start"]]
          .map(function (o) { return box(x + o[0], y + o[1], t, o[2]); }).filter(clear);
      };
      var vt = v.open && Math.abs(d) >= 0.05 ? (d > 0 ? "out " : "in ") + api.fmt(Math.abs(jy), 1) + " P" : null, et = "Eₖ = Vₘ here";
      var vOpt = vt ? spots(px, py, vt) : [], eOpt = dots.length > 1 ? spots(X(zc), yc, et) : [], pick = null;
      (vOpt.length ? vOpt : [null]).forEach(function (a) { (eOpt.length ? eOpt : [null]).forEach(function (b) { if (!pick && !(a && b && hit(a, b))) pick = [a, b]; }); });
      if (dots.length > 1) api.circle([X(zc), yc], 4, {fill: c.c6});
      if (pick[1]) T([pick[1].x, pick[1].y], et, c.c6, {anchor: pick[1].a});
      api.circle([px, py], 5, {fill: c.c4, stroke: c.card, width: 1.5});
      if (pick[0]) T([pick[0].x, pick[0].y], vt, c.c4, {anchor: pick[0].a});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
