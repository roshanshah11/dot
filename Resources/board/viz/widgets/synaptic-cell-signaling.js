// Synaptic signalling at a chemical synapse, step by step: an action potential depolarises the axon terminal, voltage-
// gated Ca2+ channels open, Ca2+ triggers m vesicles to fuse and release transmitter, it crosses the ~20 nm cleft and
// opens ligand-gated channels (AMPA receptors for glutamate: Na+ in, depolarising; GABA-A receptors: Cl- in,
// hyperpolarising here), then transporters clear it and the potential returns to rest.
// Size of the postsynaptic potential (quantal model): one vesicle alone gives q mV. Summing m vesicles' conductances in a
// simple steady-state conductance model gives  dV = m q / (1 + (m - 1) q / D),  D = E_syn - V_rest, which is m q for small
// responses and can never pass E_syn (the driving force shrinks). V_rest = -70 mV, threshold -55 mV, E_glu = 0 mV
// (D = 70), E_Cl = -80 mV (D = -10). The trace is an alpha function peaking 2.6 ms after the action potential arrives.
(function () {
  var REST = -70, THR = -55, T0 = 0.6, TAU = 2, NOW = [0, 0.3, 0.5, 0.7, 2.6, 12];
  function D(v) { return v.tx === "GABA" ? -10 : 70; }
  function dV(v) { var d = D(v), a = Math.abs(d); return v.m === 0 ? 0 : Math.sign(d) * v.m * v.q / (1 + (v.m - 1) * v.q / a); }
  function peak(v) { return REST + dV(v); }
  function fires(v) { return peak(v) >= THR; }
  function f1(x) { return Viz.fmt(Math.round(x * 10) / 10); }

  Viz.register("synaptic-cell-signaling", {
    title: "Synaptic signaling at a chemical synapse",
    subject: "biology",
    shows: "Step from an action potential arriving at the axon terminal to transmitter crossing the cleft and opening channels on the next cell; set how many vesicles fuse, the size of one, and an excitatory or inhibitory transmitter to see the postsynaptic potential",
    params: {
      tx: {kind: "enum", values: ["glutamate", "GABA"], default: "glutamate", label: "\\text{signal}"},
      m: {kind: "integer", default: 10, min: 0, max: 40, label: "m"},
      q: {kind: "number", default: 0.5, min: 0.1, max: 1, step: 0.1, label: "q\\ (\\text{mV})"}
    },
    steps: ["action potential arrives", "Ca²⁺ channels open", "vesicles release transmitter", "transmitter binds receptors", "postsynaptic potential", "transmitter cleared"],
    stepMs: 1700,
    formula: function (v) {
      var d = D(v), a = Math.abs(d), sg = d < 0 ? "-" : "";
      var dv = Viz.n(Math.round(dV(v) * 10) / 10);
      return "\\Delta V=" + sg + "\\tfrac{mq}{1+(m-1)\\,q/" + a + "}=" + sg + "\\tfrac{" + v.m + "\\cdot" + Viz.n(v.q) + "}{1+" + Math.max(0, v.m - 1) + "\\cdot" + Viz.n(v.q) + "/" + a + "}" +
        "\\newline =" + dv + "\\,\\text{mV},\\ \\ V_\\text{peak}=" + Viz.n(Math.round(peak(v) * 10) / 10) + "\\,\\text{mV}";
    },
    status: function (v) {
      var s = v.step || 1, glu = v.tx === "glutamate", name = glu ? "glutamate" : "GABA";
      if (s === 1) return "An action potential runs down the axon and <b>depolarizes the axon terminal</b>.";
      if (s === 2) return "Depolarization opens voltage-gated <b>Ca²⁺ channels</b>, and Ca²⁺ rushes into the terminal.";
      if (v.m === 0 && s >= 3) return "This time <b>no vesicle fuses</b> (release is probabilistic), so no " + name + " crosses the cleft and the next cell stays at −70 mV.";
      if (s === 3) return "Ca²⁺ makes <b>" + v.m + " vesicle" + (v.m > 1 ? "s" : "") + "</b> fuse with the membrane and release " + name + " into the cleft by exocytosis.";
      if (s === 4) return "The " + name + " crosses the 20 nm cleft in microseconds and binds <b>ligand-gated channels</b> (" + (glu ? "AMPA" : "GABAᴀ") + " receptors) on the next cell.";
      if (s === 5 && !glu) return "Cl⁻ flows in and the cell <b>hyperpolarizes</b> by " + f1(-dV(v)) + " mV to " + f1(peak(v)) + " mV: an IPSP that holds it further from threshold.";
      if (s === 5 && fires(v)) return "Na⁺ flows in and the " + f1(dV(v)) + " mV EPSP carries the cell past the −55 mV threshold, so the next neuron <b>fires</b> an action potential.";
      if (s === 5) return "Na⁺ flows in and the cell depolarizes by <b>" + f1(dV(v)) + " mV</b> to " + f1(peak(v)) + " mV: an EPSP below threshold, so it must <b>sum</b> with other inputs to fire.";
      return "Transporters pull the " + name + " back into the terminal and nearby glia, the channels close and the cell returns to <b>−70 mV</b>.";
    },
    examples: [
      {name: "reaches threshold", values: {tx: "glutamate", m: 40, q: 1, step: 5}},
      {name: "inhibitory: IPSP", values: {tx: "GABA", m: 10, q: 0.5, step: 5}},
      {name: "no vesicle released", values: {tx: "glutamate", m: 0, q: 0.5, step: 4}},
      {name: "every value at its minimum", values: {tx: "glutamate", m: 0, q: 0.1}},
      {name: "every value at its maximum", values: {tx: "GABA", m: 40, q: 1, step: 6}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, glu = v.tx === "glutamate", m = v.m, rel = m > 0;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var txc = glu ? c.c3 : c.c6, ion = glu ? c.c4 : c.c2, PM = 92, QM = 114;
      // presynaptic terminal: axon from the top-left into a bulb whose lower membrane faces the cleft
      api.path("M 20 4 L 20 30 Q 20 40 60 40 L 60 " + PM + " L 340 " + PM + " L 340 30 Q 340 10 300 10 L 60 10 Q 40 10 40 4",
        {fill: c.c1, fillOpacity: s === 1 ? 0.2 : 0.1, stroke: c.c1, width: s === 1 ? 2.4 : 1.4});
      if (s === 1) { api.arrow([30, 2], [30, 34], {color: c.accent, width: 2.4, halo: false, head: 8}); T([76, 26], "action potential", c.accent); }
      T([336, 24], "axon terminal", c.c1, {anchor: "end", weight: 500});
      // Ca2+ channels at the active zone
      [70, 328].forEach(function (x) {
        var open = s >= 2 && s <= 4;
        api.rect(x - 9, PM - 8, 6, 16, {fill: c.c5, fillOpacity: 0.7, rx: 2}); api.rect(x + 3 + (open ? 2 : 0), PM - 8, 6, 16, {fill: c.c5, fillOpacity: 0.7, rx: 2});
        if (open) { api.circle([x, PM - 16], 2.6, {fill: c.c5}); api.circle([x - 6, PM - 24], 2.6, {fill: c.c5}); api.circle([x + 5, PM - 30], 2.6, {fill: c.c5}); }
      });
      if (s === 2) T([72, 48], "Ca²⁺ in", c.c5, {anchor: "middle"});
      // vesicles: a reserve cluster, plus up to 5 drawn at the membrane (each stands for m / 5 when m > 5)
      var shown = Math.min(5, m), xs = [130, 165, 200, 235, 270];
      [[120, 52], [150, 46], [182, 54], [214, 46], [246, 52], [278, 46], [168, 66], [232, 66]].forEach(function (p) { api.circle(p, 7, {stroke: txc, width: 1.4, fill: txc, fillOpacity: 0.15}); });
      for (var i = 0; i < shown; i++) {
        var x = xs[i];
        if (s <= 2) { api.circle([x, PM - 10], 7, {stroke: txc, width: 1.6, fill: txc, fillOpacity: 0.45}); }
        else api.path("M " + (x - 9) + " " + PM + " Q " + (x - 8) + " " + (PM - 14) + " " + x + " " + (PM - 14) + " Q " + (x + 8) + " " + (PM - 14) + " " + (x + 9) + " " + PM, {stroke: txc, width: 1.6});
      }
      T([121, PM - 24], "m = " + m, txc, {anchor: "end"});                 // above the membrane, clear of the fused vesicles
      // cleft and postsynaptic cell
      api.rect(60, QM, 280, 46, {fill: c.c2, fillOpacity: 0.08, stroke: c.c2, width: 1.4, rx: 4});
      T([336, 152], "next cell", c.c2, {anchor: "end", weight: 500});
      T([352, (PM + QM) / 2], "cleft", c.muted, {weight: 500});
      // transmitter in the cleft: dots scale with m
      var nd = s >= 3 && s <= 5 ? Math.min(30, Math.round(m * 0.75)) : 0, seed = 7;
      for (var j = 0; j < nd; j++) { seed = (seed * 16807) % 2147483647; var rx = 120 + (seed % 1600) / 10; seed = (seed * 16807) % 2147483647; api.circle([rx, PM + 4 + (seed % 140) / 10], 2, {fill: txc}); }
      // receptors: ligand-gated channels on the postsynaptic membrane
      [140, 175, 210, 245].forEach(function (x) {
        var bound = rel && (s === 4 || s === 5), open = bound;
        api.rect(x - 8, QM - 4, 6, 16, {fill: ion, fillOpacity: 0.65, rx: 2}); api.rect(x + 2 + (open ? 3 : 0), QM - 4, 6, 16, {fill: ion, fillOpacity: 0.65, rx: 2});
        if (bound) api.circle([x, QM - 8], 3, {fill: txc});
        if (s === 5 && rel) api.line([x + 1.5, QM - 2], [x + 1.5, QM + 22], {color: ion, width: 1.8, arrow: true});
      });
      if (s === 4 && rel) T([200, QM + 30], (glu ? "AMPA" : "GABAᴀ") + " receptors open", ion, {anchor: "middle"});
      if (s === 5 && rel) T([200, QM + 34], (glu ? "Na⁺ in" : "Cl⁻ in"), ion, {anchor: "middle"});
      if (s === 6 && rel) {
        // reuptake transporters in the terminal membrane, between the release sites and the Ca2+ channels
        [96, 304].forEach(function (x) {
          api.rect(x - 5, PM - 7, 10, 14, {fill: txc, fillOpacity: 0.35, stroke: txc, width: 1.2, rx: 3});
          api.circle([x, PM + 18], 2.2, {fill: txc}); api.line([x, PM + 15], [x, PM - 10], {color: txc, width: 1.4, arrow: true});
        });
        T([200, QM + 20], "taken back up by transporters", txc, {anchor: "middle"});
      }
      // ---- the next cell's membrane potential over 20 ms ----
      var bx0 = 54, bx1 = 388, by0 = 186, by1 = 290, X = function (t) { return bx0 + t / 20 * (bx1 - bx0); }, Y = function (mv) { return by1 - (mv + 85) / 45 * (by1 - by0); };
      var d = dV(v), tc = null, pts = [];
      for (var t = 0; t <= 20.001; t += 0.1) {
        var u = Math.max(0, t - T0) / TAU, V = REST + d * u * Math.exp(1 - u);
        if (fires(v) && tc === null && V >= THR) tc = t;
        if (tc !== null) break;
        pts.push([t, V]);
      }
      if (tc !== null) { pts.push([tc, THR], [tc + 0.4, -40], [tc + 1.2, -77], [tc + 3, -72], [20, REST]); }
      var now = NOW[s - 1], cut = pts.filter(function (p) { return p[0] <= now + 1e-9; });
      api.polyline(pts.map(function (p) { return [X(p[0]), Y(Math.min(-40, p[1]))]; }), {stroke: c.faint, width: 1.4, dash: "3 3"});
      if (cut.length > 1) api.polyline(cut.map(function (p) { return [X(p[0]), Y(Math.min(-40, p[1]))]; }), {stroke: ion, width: 2.6});
      api.line([bx0, by0], [bx0, by1], {color: c.axis, width: 1.2}); api.line([bx0, by1], [bx1, by1], {color: c.axis, width: 1.2});
      api.line([bx0, Y(THR)], [bx1, Y(THR)], {color: c.c5, width: 1.2, dash: "5 4"});
      T([bx0 - 4, Y(THR)], "−55", c.c5, {anchor: "end", weight: 500}); T([bx0 - 4, Y(REST)], "−70", c.muted, {anchor: "end", weight: 500});
      if (!glu) { api.line([bx0, Y(-80)], [bx1, Y(-80)], {color: c.c2, width: 1, dash: "2 3"}); T([bx1, Y(-80) - 8], "Cl⁻ equilibrium −80 mV", c.c2, {anchor: "end", weight: 500}); }
      T([bx1, Y(THR) - 9], tc !== null ? "fires (spike off scale)" : "threshold", c.c5, {anchor: "end", weight: 500});
      api.line([X(now), by0], [X(now), by1], {color: c.accent, width: 1.4});
      T([bx0 + 4, by0 - 10], "next cell's potential (mV), 0 to 20 ms; now " + Viz.fmt(now) + " ms", c.muted, {weight: 500});
      T([bx1, 306], glu ? "driving force 0 − (−70) = 70 mV" : "driving force −80 − (−70) = −10 mV", c.muted, {anchor: "end", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
