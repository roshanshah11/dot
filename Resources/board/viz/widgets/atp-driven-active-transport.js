// Primary active transport by the Na+/K+-ATPase, one Post-Albers cycle: E1 binds 3 Na+ from the cytosol, ATP
// phosphorylates the pump, it flips to E2 and releases the Na+ outside, binds 2 K+, loses the phosphate, flips back
// and releases the K+ inside. The energy bill per cycle (T = 310 K, [Na+]o = 145 mM, [K+]i = 140 mM fixed):
//   dG = 3RT ln([Na]o/[Na]i) + 2RT ln([K]i/[K]o) - F Vm   (one net + charge leaves, so a negative Vm adds cost)
// compared with the ~55 kJ/mol one ATP releases in a working cell (it ranges about 50-65).
(function () {
  var RT = 8.314 * 310 / 1000, F = 96.485, NAO = 145, KI = 140, ATP = 55;
  function bill(v) {
    var na = 3 * RT * Math.log(NAO / v.naIn), k = 2 * RT * Math.log(KI / v.kOut), vt = -F * v.vm / 1000;
    var r1 = function (x) { return Math.round(x * 10) / 10; };   // shown to 0.1; the total is the sum of what is shown
    return {na: r1(na), k: r1(k), vt: r1(vt), tot: r1(r1(na) + r1(k) + r1(vt))};
  }
  var STEP = ["3 Na⁺ from the cytosol bind the pump, which is open to the inside",
              "ATP hands its phosphate to the pump (ADP leaves), locking the Na⁺ in",
              "The phosphorylated pump flips open to the outside and lets the 3 Na⁺ go",
              "2 K⁺ from outside bind, and that makes the pump drop its phosphate",
              "The pump flips back open to the inside and releases the 2 K⁺ into the cytosol"];
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

  Viz.register("atp-driven-active-transport", {
    title: "Active transport: the sodium-potassium pump",
    subject: "biology",
    shows: "Step through one cycle of the Na⁺/K⁺ pump (3 Na⁺ out, 2 K⁺ in per ATP) and change the gradients and membrane voltage to see what the cycle costs against the energy one ATP supplies",
    params: {
      naIn: {kind: "number", default: 12, min: 5, max: 40, step: 1, label: "[\\mathrm{Na^+}]_i"},
      kOut: {kind: "number", default: 4, min: 2, max: 10, step: 0.5, label: "[\\mathrm{K^+}]_o"},
      vm: {kind: "number", default: -70, min: -100, max: 0, step: 5, label: "V_m\\ (\\text{mV})"}
    },
    steps: ["3 Na⁺ bind inside", "ATP phosphorylates the pump", "flip: 3 Na⁺ out", "2 K⁺ bind, phosphate off", "flip back: 2 K⁺ in"],
    stepMs: 1700,
    formula: function (v) {
      var b = bill(v);
      return "\\Delta G=3RT\\ln\\tfrac{" + NAO + "}{" + Viz.n(v.naIn) + "}+2RT\\ln\\tfrac{" + KI + "}{" + Viz.n(v.kOut, 1) + "}-FV_m\\newline=" +
        b.na.toFixed(1) + "+" + b.k.toFixed(1) + "+" + b.vt.toFixed(1) + "=" + b.tot.toFixed(1) + "\\ \\text{kJ/mol}";
    },
    status: function (v) {
      var b = bill(v), ok = b.tot < ATP;
      return STEP[(v.step || 1) - 1] + "; the full cycle costs <b>" + b.tot.toFixed(1) + " kJ/mol</b>, " +
        (ok ? "less than the <b>≈55</b> one ATP releases, so the pump runs." : "more than the <b>≈55</b> one ATP releases, so the pump would stall.");
    },
    examples: [
      {name: "resting neuron", values: {naIn: 12, kOut: 4, vm: -70, step: 3}},
      {name: "steepest gradients: the pump stalls", values: {naIn: 5, kOut: 2, vm: -100, step: 1}},
      {name: "run-down gradients, no voltage", values: {naIn: 40, kOut: 10, vm: 0, step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, b = bill(v), m0 = 74, m1 = 124, px = 200;
      var L = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // membrane and the two compartments with their ion clouds
      api.rect(14, m0, 372, m1 - m0, {fill: c.c3, fillOpacity: 0.07, rx: 4});
      api.line([14, m0], [386, m0], {color: c.muted, width: 1.5}); api.line([14, m1], [386, m1], {color: c.muted, width: 1.5});
      var cloud = function (n, y0, y1, col, seed) {
        var r = rng(seed);
        for (var i = 0; i < n; i++) { var x = 18 + r() * 364, y = y0 + r() * (y1 - y0); if (Math.abs(x - px) > 56) api.circle([x, y], 2.6, {fill: col, opacity: 0.55}); else r(); }
      };
      cloud(Math.ceil(NAO / 6), 28, m0 - 16, c.c2, 7); cloud(Math.ceil(v.kOut / 6), 28, m0 - 16, c.c6, 11);
      cloud(Math.ceil(v.naIn / 6), m1 + 16, 172, c.c2, 13); cloud(Math.ceil(KI / 6), m1 + 16, 172, c.c6, 17);
      L([16, 12], "outside", c.muted, {weight: 500});
      L([300, 12], "Na⁺ " + NAO + " mM", c.c2, {anchor: "end"}); L([384, 12], "K⁺ " + api.fmt(v.kOut, 1) + " mM", c.c6, {anchor: "end"});
      L([16, 184], "cytosol", c.muted, {weight: 500});
      L([300, 184], "Na⁺ " + api.fmt(v.naIn, 0) + " mM", c.c2, {anchor: "end"}); L([384, 184], "K⁺ " + KI + " mM", c.c6, {anchor: "end"});
      L([20, (m0 + m1) / 2], "V_m = " + api.fmt(v.vm) + " mV", c.c1, {weight: 600});
      // membrane voltage as charges along each face
      var q = Math.round(Math.abs(v.vm) / 12.5);
      for (var i = 0; i < q; i++) {
        var x = i % 2 === 0 ? 30 + (i / 2) * 26 : 370 - ((i - 1) / 2) * 26;
        L([x, m0 - 8], v.vm < 0 ? "+" : "−", c.c1, {size: 13, anchor: "middle", weight: 700});
        L([x, m1 + 8], v.vm < 0 ? "−" : "+", c.c1, {size: 13, anchor: "middle", weight: 700});
      }
      // the pump: open inside (E1) at steps 1 and 5, occluded at 2 and 4, open outside (E2) at 3
      var wt = s === 3 ? 13 : 0, wb = s === 1 || s === 5 ? 13 : 0, pk = 9;
      var half = function (sgn) {
        var e = px + sgn * 44, pts = [[e, m0 - 14], [px + sgn * wt, m0 - 14], [px + sgn * pk, (m0 + m1) / 2], [px + sgn * wb, m1 + 14], [e, m1 + 14]];
        api.polygon(pts, {fill: c.ink, fillOpacity: 0.12, stroke: c.ink, width: 1.6});
      };
      half(-1); half(1);
      L([px + 52, (m0 + m1) / 2], s === 3 ? "E2: open outside" : s === 1 || s === 5 ? "E1: open inside" : "occluded", c.ink, {weight: 500, anchor: "start"});
      var ion = function (at, col) { api.circle(at, 5.5, {fill: col, stroke: c.card, width: 1}); };
      var naPocket = [[px, 90], [px - 4, 100], [px + 4, 108]], kPocket = [[px - 3, 94], [px + 3, 106]];
      if (s <= 2) naPocket.forEach(function (p) { ion(p, c.c2); });
      if (s === 1) api.arrow([px, m1 + 40], [px, m1 + 18], {color: c.c2, width: 2, halo: false});
      if (s === 3) {
        [[px - 14, 34], [px, 26], [px + 14, 38]].forEach(function (p) { ion(p, c.c2); });
        api.arrow([px, m0 - 14], [px, 44], {color: c.c2, width: 2, halo: false});
        L([px - 22, 32], "3 Na⁺ out", c.c2, {anchor: "end"});
      }
      if (s === 4) kPocket.forEach(function (p) { ion(p, c.c6); });
      if (s === 4) L([px - 50, 100], "2 K⁺", c.c6, {anchor: "end"});
      if (s === 5) {
        [[px - 9, 158], [px + 9, 164]].forEach(function (p) { ion(p, c.c6); });
        api.arrow([px, m1 + 14], [px, 150], {color: c.c6, width: 2, halo: false});
        L([px + 22, 162], "2 K⁺ in", c.c6);
      }
      if (s <= 2) L([px - 50, 100], "3 Na⁺", c.c2, {anchor: "end"});
      // ATP, the phosphate on the pump, ADP and Pi
      var site = [px + 36, m1 + 20];
      if (s === 1) { api.circle([px + 82, 152], 10, {fill: c.c3, fillOpacity: 0.25, stroke: c.c3, width: 1.5}); L([px + 82, 152], "ATP", c.c3, {anchor: "middle", size: 12}); }
      if (s === 2 || s === 3) { api.circle(site, 7, {fill: c.c3}); L([site[0], site[1]], "P", c.card, {anchor: "middle", size: 12, weight: 700}); }
      if (s === 2) { L([px + 90, 160], "ADP leaves", c.c3); api.arrow([site[0] + 12, site[1] + 6], [px + 86, 152], {color: c.c3, width: 1.6, halo: false}); }
      if (s === 4) { api.circle([px + 74, 160], 7, {fill: c.c3, opacity: 0.7}); L([px + 86, 160], "Pi leaves", c.c3); }
      // the energy bill against one ATP
      var x0 = 30, x1 = 370, sc = (x1 - x0) / 65, by = 226, X = function (e) { return x0 + e * sc; };
      L([x0, 202], "energy per cycle, kJ/mol", c.muted, {weight: 500});
      var segs = [[b.na, c.c2, "3 Na⁺ out " + b.na.toFixed(1)], [b.k, c.c6, "2 K⁺ in " + b.k.toFixed(1)], [b.vt, c.c1, "voltage " + b.vt.toFixed(1)]], acc = 0;
      segs.forEach(function (g) { if (g[0] > 0.05) api.rect(X(acc), by - 9, g[0] * sc, 18, {fill: g[1], fillOpacity: 0.85, rx: 2}); acc += g[0]; });
      [0, 20, 40].forEach(function (e) { api.line([X(e), by + 11], [X(e), by + 15], {color: c.axis, width: 1}); L([X(e), by + 24], String(e), c.muted, {anchor: "middle", weight: 500}); });
      var ok = b.tot < ATP;
      api.line([X(ATP), by - 18], [X(ATP), by + 14], {color: c.c3, width: 2.2, dash: "4 3"});
      L([X(ATP), by + 24], "1 ATP ≈ 55", c.c3, {anchor: "middle"});
      segs.forEach(function (g, i) {
        var lx = x0 + i * 118;
        api.rect(lx, by + 37, 10, 10, {fill: g[1], fillOpacity: 0.85, rx: 2});
        L([lx + 15, by + 42], g[2], g[1], {weight: 500});
      });
      L([x1, 202], ok ? "runs: " + (ATP - b.tot).toFixed(1) + " to spare" : "stalls: short by " + (b.tot - ATP).toFixed(1), ok ? c.c4 : c.c5, {anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
