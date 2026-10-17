// Gap junctions: each cell puts a connexon (a ring of six connexins) in its membrane; two connexons dock across the
// 2-4 nm gap and make one channel, about 1.5 nm wide, from cytoplasm to cytoplasm. Ions and small molecules under
// about 1 kDa pass (K+, glucose, cAMP, IP3); proteins do not. High cytosolic Ca2+ or a low pH closes the channels.
// The row below shows the cargo spreading from cell 1 along a line of coupled cells (discrete diffusion between
// neighbours, faster for smaller molecules; schematic time, not seconds).
(function () {
  var CARGO = {
    ion: {name: "K⁺", mass: "39 Da", kda: 0.039, r: 2.6, k: 0.32, use: "ions carry current, so coupled heart cells beat together (electrical coupling)"},
    glucose: {name: "glucose", mass: "180 Da", kda: 0.18, r: 3.4, k: 0.27, use: "neighbouring cells share nutrients (metabolic coupling)"},
    camp: {name: "cAMP", mass: "329 Da", kda: 0.329, r: 4, k: 0.23, use: "one cell's second-messenger signal reaches its neighbours"},
    ip3: {name: "IP₃", mass: "420 Da", kda: 0.42, r: 4.4, k: 0.21, use: "IP₃ passing cell to cell spreads a calcium wave through the tissue"},
    protein: {name: "a protein", mass: "27 kDa", kda: 27, r: 10, k: 0, use: ""}
  };
  var GATE = {open: "", calcium: "high cytosolic Ca²⁺ has closed the connexons (a damaged, leaky cell seals itself off this way)",
              acid: "a low pH has closed the connexons (as in heart muscle starved of oxygen)"};
  function passes(v) { return v.gate === "open" && CARGO[v.cargo].kda < 1; }
  function spread(v) {
    var conc = [1, 0, 0, 0, 0], n = [0, 2, 9][(v.step || 1) - 1], k = passes(v) ? CARGO[v.cargo].k : 0;
    for (var t = 0; t < n; t++) {
      var nx = conc.slice();
      for (var i = 0; i < 5; i++) nx[i] += k * ((i > 0 ? conc[i - 1] - conc[i] : 0) + (i < 4 ? conc[i + 1] - conc[i] : 0));
      conc = nx;
    }
    return conc;
  }

  Viz.register("gap-junction-cell-communication", {
    title: "Gap junctions: cell-to-cell channels",
    subject: "biology",
    shows: "Pick what cell 1 holds and whether the channels are open: ions and small molecules under about 1 kDa pass straight into the next cell through connexon pores and spread along the row; proteins are too big, and Ca²⁺ or acid closes the gates",
    params: {
      cargo: {kind: "enum", values: ["ion", "glucose", "camp", "ip3", "protein"], names: {ion: "K⁺", glucose: "glucose", camp: "cAMP", ip3: "IP₃", protein: "protein"}, default: "camp", label: "\\text{cargo}"},
      gate: {kind: "enum", values: ["open", "calcium", "acid"], names: {open: "open", calcium: "high Ca²⁺", acid: "low pH"}, default: "open", label: "\\text{channels}"}
    },
    steps: ["cell 1 is loaded", "a moment later", "later"],
    stepMs: 1500,
    formula: function (v) {
      var C = CARGO[v.cargo];
      if (v.gate !== "open") return "\\text{" + (v.gate === "calcium" ? "high Ca}^{2+}" : "low pH}") + "\\Rightarrow\\text{connexons close}\\newline\\text{nothing passes, whatever its size}";
      return "\\text{pore}\\approx 1.5\\ \\text{nm: under}\\approx 1\\ \\text{kDa passes}\\newline\\text{" + C.name.replace("⁺", "}^{+}\\text{").replace("₃", "}_3\\text{") + ": " + C.mass + "}" +
        (C.kda < 1 ? "<1\\ \\text{kDa}\\Rightarrow\\text{passes}" : ">1\\ \\text{kDa}\\Rightarrow\\text{blocked}");
    },
    status: function (v) {
      var C = CARGO[v.cargo], s = v.step || 1, ok = passes(v), Name = C.name.charAt(0).toUpperCase() + C.name.slice(1);
      var big = v.gate === "open" && !ok;
      if (s === 1) return "Cell 1 holds " + C.name + " (" + C.mass + ")" + (ok ? "; it is small enough to pass through the gap junctions." :
        big ? ", far over the ~1 kDa limit of the pore." : "; " + GATE[v.gate] + ".");
      if (!ok) return "<b>Blocked</b>: " + (big ? "a " + C.mass + " protein cannot fit through the ~1.5 nm pore" : GATE[v.gate]) + ", so the neighbours never get any.";
      return s === 2 ? Name + " passes through the connexon pores straight into <b>cell 2</b>, never touching the space outside the cells." :
        Name + " has <b>spread along the row</b>: " + C.use + ".";
    },
    examples: [
      {name: "ions spread: electrical coupling", values: {cargo: "ion", gate: "open", step: 3}},
      {name: "cAMP reaches cell 2", values: {cargo: "camp", gate: "open", step: 2}},
      {name: "a protein is too big", values: {cargo: "protein", gate: "open", step: 3}},
      {name: "high Ca²⁺ closes the channels", values: {cargo: "ion", gate: "calcium", step: 3}},
      {name: "low pH closes the channels", values: {cargo: "glucose", gate: "acid", step: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, C = CARGO[v.cargo], s = v.step || 1, ok = passes(v), shut = v.gate !== "open", conc = spread(v);
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // ---- close-up: two membranes, the 2-4 nm gap, two docked connexon pairs ----
      var a0 = 150, a1 = 166, b0 = 180, b1 = 196, top = 24, bot = 150;
      [[a0, a1], [b0, b1]].forEach(function (m) {
        api.rect(m[0], top, m[1] - m[0], bot - top, {fill: c.ink, fillOpacity: 0.12, rx: 2});
        api.line([m[0], top], [m[0], bot], {color: c.muted, width: 1.3}); api.line([m[1], top], [m[1], bot], {color: c.muted, width: 1.3});
      });
      var mem = [a0 - 4, top + 9];                                   // at the top of the membrane, clear of the blocked marks
      T(mem, "membrane", c.muted, {anchor: "end", weight: 500});
      T([80, 12], "cell 1", c.ink, {anchor: "middle"}); T([248, 12], "cell 2", c.ink, {anchor: "middle"});
      T([(a1 + b0) / 2, bot + 12], "gap 2–4 nm", c.muted, {anchor: "middle", weight: 500});
      var chY = [62, 116], cargo = c.c3, con = c.c1;
      chY.forEach(function (y, j) {
        [[a0 - 4, a1 + 2], [b0 - 2, b1 + 4]].forEach(function (m) {
          var open = !shut, half = open ? 4 : 0.6;
          api.rect(m[0], y - 15, m[1] - m[0], 15 - half, {fill: con, fillOpacity: 0.45, stroke: con, width: 1.2, rx: 3});
          api.rect(m[0], y + half, m[1] - m[0], 15 - half, {fill: con, fillOpacity: 0.45, stroke: con, width: 1.2, rx: 3});
        });
        if (ok && s >= 2) api.circle([(a1 + b0) / 2, y], Math.min(C.r, 3.4), {fill: cargo});
        if (s >= 2 && !ok) {                                          // stopped at the pore mouth: the ✕ sits at the arrow's tip
          api.arrow([a0 - 50, y - 18], [a0 - 17, y - 3], {color: c.c5, width: 2, halo: false, head: 8});
          T([a0 - 10, y], "✕", c.c5, {anchor: "middle", weight: 700, size: 13});
        }
        if (j === 0 && s >= 2 && ok) api.arrow([a0 - 40, y], [b1 + 40, y], {color: c.c4, width: 2.2, halo: false, head: 9, opacity: 0.85});
      });
      T([(a1 + b0) / 2, top - 8 + 2], "connexons", con, {anchor: "middle"});
      // cargo molecules in each cell: cell 1 always holds them; cell 2 gets them from step 2 if they pass
      var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      // each molecule takes a random spot that keeps clear of the channel mouths, the membrane label and the molecules
      // already placed (2r + 2 apart), retrying up to 40 times; a molecule that finds no free spot is left out
      var molecules = function (x0, x1, n) {
        var put = [], r = C.r, cell1 = x0 < a0;
        for (var i = 0; i < n; i++) for (var tr = 0; tr < 40; tr++) {
          var x = x0 + rnd() * (x1 - x0), y = top + 6 + r + rnd() * (bot - top - 12 - 2 * r);
          var mouth = (cell1 ? x > a0 - 58 : x < b1 + 58) && Math.min(Math.abs(y - 62), Math.abs(y - 116)) < 12 + r;
          var onLabel = cell1 && x + r > mem[0] - 58 && y - r < mem[1] + 8;
          if (mouth || onLabel || put.some(function (q) { return Math.hypot(q[0] - x, q[1] - y) < 2 * r + 2; })) continue;
          put.push([x, y]); api.circle([x, y], r, {fill: cargo, opacity: 0.85}); break;
        }
      };
      molecules(18, a0 - 26, Math.round(4 + 10 * conc[0] / (C.r > 6 ? 2.5 : 1)));
      if (ok) molecules(b1 + 22, 300, Math.round(14 * conc[1] / conc[0] * (conc[0] > 0 ? 1 : 0) * 0.9));
      T([18, bot + 12], C.name + " · " + C.mass, cargo, {anchor: "start"});
      // ---- top view of one connexon: six connexins around a pore that opens or twists shut ----
      var ox = 352, oy = 78;
      for (var q = 0; q < 6; q++) {
        var ang = q * Math.PI / 3 + (shut ? 0.45 : 0), rr = shut ? 11 : 15;
        api.circle([ox + rr * Math.cos(ang), oy + rr * Math.sin(ang)], 8.5, {fill: con, fillOpacity: 0.5, stroke: con, width: 1.2});
      }
      if (!shut) api.circle([ox, oy], 5.5, {fill: c.card, stroke: c.muted, width: 1});
      T([ox, 38], "top view", c.muted, {anchor: "middle", weight: 500});
      T([ox, 118], shut ? "twisted shut" : "pore ≈ 1.5 nm", shut ? c.c5 : con, {anchor: "middle"});
      // ---- a row of five coupled cells: shading = how much cargo each one holds ----
      var rx = 22, rw = 64, gap = 8.5, ry = 196, rh = 58, mx = Math.max.apply(null, conc);
      T([rx, ry - 14], s === 1 ? "start: only cell 1 is loaded" : s === 2 ? "a moment later" : "later", c.muted, {weight: 500});
      for (var i = 0; i < 5; i++) {
        var x = rx + i * (rw + gap), f = conc[i] / mx;
        api.rect(x, ry, rw, rh, {fill: cargo, fillOpacity: 0.06 + 0.6 * f, stroke: c.muted, width: 1.2, rx: 10});
        T([x + rw / 2, ry + rh / 2], String(i + 1), f > 0.55 ? c.card : c.ink, {anchor: "middle", weight: 700});
        if (i < 4) {
          var jx = x + rw + gap / 2, blocked = !ok && s >= 2 && i === 0;
          [ry + 18, ry + 29, ry + 40].forEach(function (y) { api.line([jx, y - 3], [jx, y + 3], {color: shut ? c.c5 : con, width: 3}); });
          if (blocked) T([jx, ry + rh + 12], "✕", c.c5, {anchor: "middle", weight: 700, size: 13});
        }
      }
      T([378, ry + rh + 14], "▮ gap junctions", shut ? c.c5 : con, {anchor: "end", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
