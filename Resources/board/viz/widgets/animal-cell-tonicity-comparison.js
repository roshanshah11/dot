// A red blood cell in solutions of different tonicity. Inside, about 300 mOsm/L of solute that cannot leave. Water
// follows the non-penetrating solute only: NaCl stays outside, urea crosses the membrane and ends up equal on both sides,
// so it adds to osmolarity but not to tonicity. Volume at equilibrium follows Boyle-van 't Hoff,
// V/V0 = b + (1 - b) * 300/C_NaCl with b = 0.4 (the osmotically inactive fraction of a red cell). A red cell keeps its
// membrane area (about 135 um^2 for a 90 fL cell), so it can only swell to the sphere of that area, about 1.64 V0;
// past that (below about 145 mOsm/L of NaCl) it bursts. Shapes: the resting disc is the Evans-Fung profile, swelling
// morphs it toward that sphere, shrinking scales it down with crenations. Shapes are drawn, the volumes are computed.
(function () {
  var B = 0.4, VC = 1.64, R0 = 3.91, RS = 3.28, PX = 8;
  function vol(C) { return B + (1 - B) * 300 / C; }
  function disc(x) { return 0.5 * Math.sqrt(Math.max(0, 1 - x * x)) * (0.81 + 7.83 * x * x - 4.39 * Math.pow(x, 4)); }
  function halton(i, b) { var f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

  Viz.register("animal-cell-tonicity-comparison", {
    title: "Tonicity: a cell in three solutions",
    subject: "biology",
    shows: "Slide the salt outside a red blood cell: hypotonic swells it until it bursts, isotonic leaves it alone, hypertonic shrivels it; urea raises osmolarity but crosses the membrane, so it does not count toward tonicity",
    params: {
      nacl: {kind: "integer", default: 200, min: 50, max: 600, step: 10, label: "C_{\\text{NaCl}}"},
      urea: {kind: "integer", default: 0, min: 0, max: 600, step: 10, label: "C_{\\text{urea}}"}
    },
    formula: function (v) {
      var V = vol(v.nacl);
      return "\\frac{V}{V_0}=0.4+0.6\\cdot\\frac{300}{" + v.nacl + "}=" + V.toFixed(2) + (V > VC ? ">" + VC : "") +
        "\\newline C_{\\text{out}}=" + v.nacl + "+" + v.urea + "=" + (v.nacl + v.urea) + "\\ \\text{mOsm/L}";
    },
    status: function (v) {
      var V = vol(v.nacl), C = v.nacl, s;
      if (V > VC) s = "Strongly <b>hypotonic</b>: with only " + C + " mOsm/L of NaCl outside, water rushes in until the cell passes " + VC + " times its volume and <b>bursts</b> (hemolysis)";
      else if (Math.abs(C - 300) <= 10) s = "<b>Isotonic</b>: about 300 mOsm/L of non-penetrating solute on each side, so there is no net water flow and the cell keeps its disc shape";
      else if (C < 300) s = "<b>Hypotonic</b>: fewer trapped particles outside (" + C + " vs 300 mOsm/L), so water moves in and the cell <b>swells</b> to " + V.toFixed(2) + " times its volume";
      else s = "<b>Hypertonic</b>: more trapped particles outside (" + C + " vs 300 mOsm/L), so water leaves and the cell <b>shrinks</b> to " + V.toFixed(2) + " times its volume, crenated";
      return s + (v.urea ? "; the " + v.urea + " mOsm/L of urea crosses the membrane and evens out, so it raises the osmolarity to " + (C + v.urea) + " but not the tonicity." : ".");
    },
    examples: [
      {name: "isotonic saline", values: {nacl: 300, urea: 0}},
      {name: "hypertonic", values: {nacl: 600, urea: 0}},
      {name: "hypotonic, bursts", values: {nacl: 50, urea: 0}},
      {name: "isosmotic urea still bursts it", values: {nacl: 50, urea: 250}},
      {name: "lots of urea, still isotonic", values: {nacl: 300, urea: 600}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, V = vol(v.nacl), lysed = V > VC, F = [62, 92], S = [150, 92];
      // the solution
      api.rect(10, 24, 188, 140, {fill: c.c2, fillOpacity: 0.05, stroke: c.faint, width: 1, rx: 10});
      api.label([14, 12], "outside solution", {color: c.muted, size: 12});
      var sw = V >= 1 ? Math.min(1, (V - 1) / (VC - 1)) : 0, sh = V < 1 ? Math.cbrt(V) : 1, spikes = V < 1 ? 16 * (1 - V) : 0;
      var Rf = (lysed ? RS : (R0 + (RS - R0) * sw) * sh) * PX;
      var free = function (q, r) { return Math.hypot(q[0] - F[0], q[1] - F[1]) > Rf + 7 + r && (Math.abs(q[0] - S[0]) > 38 || Math.abs(q[1] - S[1]) > 30) && q[1] > 32 && q[1] < 156 && q[0] > 16 && q[0] < 192; };
      var dots = function (n, color, start) {
        for (var i = 0, k = start; i < n && k < start + 900; k++) {
          var q = [12 + 186 * halton(k, 2), 26 + 136 * halton(k, 3)];
          if (free(q, 3)) { api.circle(q, 2.4, {fill: color}); i++; }
        }
      };
      dots(Math.round(v.nacl / 30), c.c2, 1);
      dots(Math.round(v.urea / 30), c.c6, 1201);
      // face view: a red disc with a pale centre; swelling rounds it up, shrinking crenates it
      if (lysed) {
        api.circle(F, Rf, {stroke: c.c5, width: 1.6, dash: "4 3"});
        [[-38, -24], [-30, 30], [36, -30], [40, 18], [-6, -40], [10, 42]].forEach(function (q) { api.circle([F[0] + q[0], F[1] + q[1]], 2.4, {fill: c.c5}); });
        api.label([F[0], F[1]], "burst", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      } else {
        var pts = [];
        for (var i = 0; i <= 96; i++) { var a = i / 96 * 2 * Math.PI, rr = Rf + spikes * Math.max(0, Math.cos(12 * a)) ; pts.push([F[0] + rr * Math.cos(a), F[1] + rr * Math.sin(a)]); }
        api.polygon(pts, {fill: c.c5, fillOpacity: 0.55, stroke: c.c5, width: 1.5});
        var pal = 0.48 * Rf * (1 - sw);
        if (pal > 1) api.circle(F, pal, {fill: c.c5, fillOpacity: 0.35});
        [[-8, -6], [7, -9], [9, 7], [-6, 9], [0, 0]].forEach(function (q) { api.circle([F[0] + q[0] * Rf / 31, F[1] + q[1] * Rf / 31], 2.2, {fill: c.c3}); });
        for (i = 0; i < Math.min(4, Math.round(v.urea / 120)); i++) api.circle([F[0] + [-14, 13, -2, 15][i] * Rf / 31, F[1] + [3, -2, -16, 15][i] * Rf / 31], 2.2, {fill: c.c6});
      }
      // side view: the Evans-Fung disc morphing toward the sphere of the same area
      if (!lysed) {
        var top = [], bot = [], W = (R0 + (RS - R0) * sw) * sh;
        for (i = 0; i <= 60; i++) {
          var x = -1 + 2 * i / 60, h = ((1 - sw) * disc(x) + sw * RS * Math.sqrt(Math.max(0, 1 - x * x))) * (V < 1 ? sh : 1);
          top.push([S[0] + x * W * PX, S[1] - h * PX]); bot.unshift([S[0] + x * W * PX, S[1] + h * PX]);
        }
        api.polygon(top.concat(bot), {fill: c.c5, fillOpacity: 0.55, stroke: c.c5, width: 1.5});
      }
      if (lysed) api.circle(S, RS * PX, {stroke: c.c5, width: 1.6, dash: "4 3"});
      api.label([F[0], 150], "face", {color: c.muted, size: 12, anchor: "middle"});
      api.label([S[0], 150], "side", {color: c.muted, size: 12, anchor: "middle"});
      // net water movement on the way to equilibrium
      if (Math.abs(v.nacl - 300) > 10) {
        var inward = v.nacl < 300, rr0 = Rf + 4, rr1 = Rf + 18;
        [0.6, 2.2, 3.8, 5.4].forEach(function (a) {
          var p0 = [F[0] + rr1 * Math.cos(a), F[1] + rr1 * Math.sin(a)], p1 = [F[0] + rr0 * Math.cos(a), F[1] + rr0 * Math.sin(a)];
          api.arrow(inward ? p0 : p1, inward ? p1 : p0, {color: c.c1, width: 2, halo: false, head: 8});
        });
        api.label([104, 34], inward ? "water in" : "water out", {color: c.c1, size: 12.5, weight: 650});
      }
      // osmolarity bars: inside, outside total, outside non-penetrating (what water responds to)
      var bx = 214, bs = 170 / 1200, row = function (y, label, parts) {
        api.label([bx, y - 12], label + ": " + parts.reduce(function (s, p) { return s + p[0]; }, 0), {color: c.muted, size: 12});
        var x = bx;
        parts.forEach(function (p) { if (p[0] > 0) { api.rect(x, y - 2, p[0] * bs, 12, {fill: p[1], fillOpacity: 0.85, rx: 2}); x += p[0] * bs; } });
      };
      row(42, "inside the cell", [[300, c.c3]]);
      row(86, "outside, osmolarity", [[v.nacl, c.c2], [v.urea, c.c6]]);
      row(130, "tonicity (NaCl only)", [[v.nacl, c.c2]]);
      [42, 86, 130].forEach(function (y) { api.line([bx + 300 * bs, y - 6], [bx + 300 * bs, y + 14], {color: c.c3, width: 1.2, dash: "2 2"}); });
      api.label([bx, 156], "mOsm/L", {color: c.muted, size: 12});
      api.label([300, 156], "urea", {color: c.c6, size: 12}); api.label([340, 156], "NaCl", {color: c.c2, size: 12});
      // volume against NaCl outside
      var px = function (C) { return 44 + (C - 50) * 340 / 550; }, py = function (r) { return 276 - (r - 0.6) * 72 / 1.1; }, Cl = 180 / (VC - B);
      api.rect(px(50), py(1.7), px(Cl) - px(50), py(0.6) - py(1.7), {fill: c.c5, fillOpacity: 0.1, rx: 0});
      api.rect(px(290), py(1.7), px(310) - px(290), py(0.6) - py(1.7), {fill: c.c1, fillOpacity: 0.1, rx: 0});
      api.label([px(50) + 4, 190], "bursts", {color: c.c5, size: 12});
      api.label([px(220), 190], "hypotonic", {color: c.muted, size: 12, anchor: "middle"});
      api.label([px(300), 190], "iso", {color: c.c1, size: 12, anchor: "middle"});
      api.label([px(460), 190], "hypertonic", {color: c.muted, size: 12, anchor: "middle"});
      [[1, "1"], [0.6, "0.6"]].forEach(function (t) { api.label([px(50) - 5, py(t[0])], t[1], {color: c.muted, size: 12, anchor: "end"}); api.line([px(50), py(t[0])], [px(600), py(t[0])], {color: c.grid, width: 1}); });
      api.line([px(Cl), py(VC)], [px(600), py(VC)], {color: c.c5, width: 1.2, dash: "4 4"});
      api.label([px(600), py(VC) + 10], "burst size " + VC + " V₀", {color: c.c5, size: 12, anchor: "end"});
      api.label([12, py(1.3)], "V/V₀", {color: c.muted, size: 12});
      var ok = [];
      for (var C = Math.ceil(Cl); C <= 600; C += 5) ok.push([px(C), py(vol(C))]);
      api.polyline([[px(Cl), py(VC)]].concat(ok), {stroke: c.c1, width: 2.5});
      if (lysed) { api.line([px(v.nacl) - 5, py(VC) - 5], [px(v.nacl) + 5, py(VC) + 5], {color: c.c5, width: 2.5}); api.line([px(v.nacl) - 5, py(VC) + 5], [px(v.nacl) + 5, py(VC) - 5], {color: c.c5, width: 2.5}); }
      else api.point([px(v.nacl), py(V)], {color: c.c1, r: 5.5, stroke: c.ink});
      [100, 300, 500].forEach(function (t) { api.label([px(t), 290], String(t), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([px(600), 290], "NaCl", {color: c.muted, size: 12, anchor: "end"});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
