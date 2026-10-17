// One microtubule, plus end on the right. Alpha/beta-tubulin dimers stack head to tail into protofilaments, so the
// lattice is polar: beta-tubulin faces the plus end, alpha-tubulin the minus end. Each end in its growth phase adds
// GTP-tubulin at k_on*c and loses it at k_off; rate constants are Walker et al. 1988 (J Cell Biol 107:1437), in vitro:
// plus end k_on 8.9 /uM/s, k_off 44 /s; minus end 4.3 /uM/s and 23 /s; rapid shortening 733 /s (plus) and 915 /s
// (minus), independent of c. One dimer adds 8 nm / 13 protofilaments = 0.615 nm of length. Behind the growing tip the
// GTP is hydrolysed; a tip that loses its GTP cap undergoes catastrophe: GDP protofilaments curl outward and peel off.
// In cells the minus end usually sits capped in a gamma-TuRC at the centrosome, so dynamics happen at the plus end.
(function () {
  var D = 0.615, K = {p: [8.9, 44, 733], m: [4.3, 23, 915]};
  function rate(end, state, c) {      // dimers per second, positive = growth
    if (state === "capped") return 0;
    var k = K[end];
    return state === "shrinking" ? -k[2] : k[0] * c - k[1];
  }
  function umin(dimers) { return dimers * D * 0.06; }   // dimers/s -> micrometres per minute
  function sg(x, d) { return (x < -1e-9 ? "−" : "+") + Viz.fmt(Math.abs(x), d == null ? 2 : d); }

  Viz.register("microtubule-polarity-and-growth", {
    title: "Microtubule polarity and dynamic instability",
    subject: "biology",
    shows: "Slide the free tubulin and switch each end between growth and catastrophe: the beta-exposed plus end grows about twice as fast as the minus end while its GTP cap lasts, and either end shrinks 5 to over 1,000 times faster than it grows once the cap is lost",
    params: {
      c: {kind: "number", default: 10, min: 5, max: 20, step: 0.5, label: "c\\ (\\mu\\text{M})"},
      plus: {kind: "enum", values: ["growing", "shrinking"], default: "growing", label: "+\\ \\text{end}", names: {growing: "growth", shrinking: "catastrophe"}},
      minus: {kind: "enum", values: ["growing", "shrinking", "capped"], default: "growing", label: "-\\ \\text{end}", names: {growing: "growth", shrinking: "catastrophe", capped: "γ-TuRC cap"}}
    },
    formula: function (v) {
      var line = function (end, st) {
        var r = rate(end, st, v.c), k = K[end], s = end === "p" ? "+" : "-";
        if (st === "capped") return "v_{" + s + "}=0\\ (\\gamma\\text{-TuRC cap})";
        var inner = st === "shrinking" ? "-" + k[2] : "(" + k[0] + "\\cdot" + Viz.n(v.c) + "-" + k[1] + ")";
        return "v_{" + s + "}=" + inner + "\\,\\delta=" + Viz.n(r * D, 1) + "\\ \\text{nm/s}";
      };
      return "v=(k_{on}c-k_{off})\\,\\delta,\\ \\ \\delta=0.615\\ \\text{nm}\\newline " + line("p", v.plus) + "\\newline " + line("m", v.minus);
    },
    status: function (v) {
      var rp = rate("p", v.plus, v.c), rm = rate("m", v.minus, v.c), um = umin(Math.abs(rm)), up = umin(Math.abs(rp));
      var plusTxt = v.plus === "growing"
        ? "The β-exposed <b>+ end</b> grows <b>" + Viz.fmt(up) + " µm/min</b> while its GTP cap lasts"
        : "<b>Catastrophe</b>: the + end lost its GTP cap and shrinks at <b>" + Viz.fmt(up, 1) + " µm/min</b>, " + Viz.fmt(rp / (K.p[0] * v.c - K.p[1]), 0).replace("−", "") + " times its growth speed at this c";
      var minusTxt = v.minus === "capped" ? "the − end sits in a γ-TuRC cap, so it neither grows nor loses dimers"
        : v.minus === "shrinking" ? "the − end is in catastrophe" + (v.plus === "shrinking" ? " too" : "") + ", losing " + Viz.fmt(um, 1) + " µm/min"
        : rm < 0 ? "below its critical concentration of 5.35 µM the − end loses " + Viz.fmt(um) + " µm/min even in its growth phase"
        : "the α-exposed − end grows only " + Viz.fmt(um) + " µm/min";
      return plusTxt + "; " + minusTxt + ".";
    },
    examples: [
      {name: "lowest tubulin (5 µM)", values: {c: 5}},
      {name: "highest tubulin (20 µM)", values: {c: 20}},
      {name: "plus-end catastrophe", values: {c: 10, plus: "shrinking"}},
      {name: "in a cell: minus end capped", values: {c: 12, minus: "capped"}},
      {name: "both ends shrinking", values: {c: 10, plus: "shrinking", minus: "shrinking"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, x0 = 80, nD = 8, dw = 14, hh = 7, gap = 0.6, L = 2 * dw + 2 * gap, yc = 80;
      var rp = rate("p", v.plus, v.c), rm = rate("m", v.minus, v.c);
      var cap = v.plus === "growing" ? (rp > 60 ? 2 : 1) : 0;   // the cap is a few layers deep, longer when growth is faster
      var capM = v.minus === "growing" && rm > 0 ? (rm > 60 ? 2 : 1) : 0;
      // one tubulin monomer as a rotated square: alpha dim, beta bright
      var quad = function (cx, cy, ang, col, op) {
        var ux = Math.cos(ang) * dw / 2, uy = Math.sin(ang) * dw / 2, vx = -Math.sin(ang) * hh, vy = Math.cos(ang) * hh;
        api.polygon([[cx - ux - vx, cy - uy - vy], [cx + ux - vx, cy + uy - vy], [cx + ux + vx, cy + uy + vy], [cx - ux + vx, cy - uy + vy]], {fill: col, fillOpacity: op});
      };
      var dimer = function (cx, cy, ang, col) { // center, direction of the + end
        var ox = Math.cos(ang) * (dw / 2 + gap / 2), oy = Math.sin(ang) * (dw / 2 + gap / 2);
        quad(cx - ox, cy - oy, ang, col, 0.42);   // alpha (toward -)
        quad(cx + ox, cy + oy, ang, col, 0.95);   // beta (toward +)
      };
      var rows = [-26, -9, 9, 26], xEnd = x0 + nD * L + 6;
      rows.forEach(function (dy, r) {
        var y = yc + dy, sh = r * 2;   // a small stagger hints at the helical lattice
        for (var i = 0; i < nD; i++) {
          var col = (i >= nD - cap) || (i < capM) ? c.c3 : c.c2;
          dimer(x0 + sh + L * (i + 0.5), y, 0, col);
        }
        // a peeling end: GDP protofilaments curl outward, away from the axis
        var curl = function (sx, dir) {
          var px = sx, py = y, ang = dir > 0 ? 0 : Math.PI, bend = (dy < 0 ? -1 : 1) * dir * 0.36;
          for (var k = 0; k < 2; k++) {
            ang += bend; var cx = px + Math.cos(ang) * L / 2, cy = py + Math.sin(ang) * L / 2;
            dimer(cx, cy, dir > 0 ? ang : ang + Math.PI, c.c2);
            px = cx + Math.cos(ang) * L / 2; py = cy + Math.sin(ang) * L / 2;
          }
        };
        if (v.plus === "shrinking") curl(x0 + sh + nD * L, 1);
        if (v.minus === "shrinking") curl(x0 + sh, -1);
      });
      // what happens at each end: a GTP dimer arriving (growth) or a GDP dimer leaving (shrinkage), its speed under it
      // (under the free dimer; in catastrophe the peeling protofilaments fill that spot, so it goes just below them)
      var rlab = function (r, x, peel, anchor) {
        var u = umin(r), col = r === 0 ? c.muted : r < 0 ? c.c5 : c.c4, num = r === 0 ? "0" : sg(u, Math.abs(u) >= 10 ? 1 : 2);
        if (peel) { api.label([anchor === "end" ? 392 : 8, yc + 67], num + " µm/min", {color: col, size: 13, weight: 700, anchor: anchor}); return; }
        api.label([x, yc + 22], num, {color: col, size: 13, weight: 700, anchor: "middle"});
        api.label([x, yc + 37], "µm/min", {color: col, size: 12, anchor: "middle"});
      };
      var free = function (x, y, toward, col, out) {
        dimer(x, y, 0, col);
        if (out) api.arrow([x - toward * 17, y], [x - toward * 34, y], {color: c.c5, width: 2, halo: false});
        else api.arrow([x + toward * 17, y], [x + toward * 31, y], {color: c.c4, width: 2, halo: false});
      };
      if (v.plus === "growing") free(xEnd + 36, yc, -1, c.c3, false);
      else free(xEnd + 38, yc, -1, c.c2, true);
      rlab(rp, xEnd + 36, v.plus === "shrinking", "end");
      if (v.minus === "capped") {
        api.path("M " + (x0 - 3) + " " + (yc - 38) + " Q " + (x0 - 22) + " " + yc + " " + (x0 - 3) + " " + (yc + 38), {stroke: c.c6, width: 6});
        api.label([x0 - 24, yc - 2], "γ-TuRC", {color: c.c6, size: 12.5, weight: 650, anchor: "end"});
        rlab(0, x0 - 40);
      } else {
        if (v.minus === "shrinking" || rm < 0) free(x0 - 38, yc, 1, c.c2, true);
        else free(x0 - 36, yc, 1, c.c3, false);
        rlab(rm, x0 - 38, v.minus === "shrinking", "start");
      }
      // the ends, and a key on one dimer: alpha is the dim monomer, beta the bright one
      api.label([x0, yc - 45], "− end (α exposed)", {color: c.ink, size: 12.5, weight: 650});
      api.label([xEnd, yc - 45], "+ end (β exposed)", {color: c.ink, size: 12.5, weight: 650, anchor: "end"});
      var kx = x0 + 6, ky = yc + 26 + hh + 4;
      api.path("M " + (kx + 1) + " " + ky + " v 4 h " + (L - 2) + " v -4", {stroke: c.muted, width: 1.2});
      api.label([kx + dw / 2, ky + 13], "α", {color: c.c2, size: 13, weight: 700, anchor: "middle", raw: true}).setAttribute("opacity", 0.55);
      api.label([kx + L - dw / 2, ky + 13], "β", {color: c.c2, size: 13, weight: 700, anchor: "middle", raw: true});
      api.label([kx + L + 4, ky + 13], "one dimer", {color: c.muted, size: 12});
      if (cap) api.label([x0 + nD * L - cap * L / 2 + 3, yc + 50], "GTP cap", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([x0 + 4.7 * L, yc + 50], "GDP lattice", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      // speeds side by side: growth (at this c) against rapid shortening; red marks a net loss, as the − end has below 5.35 µM
      var bx = 132, bw = 236, top = 164, max = 36, sx = bw / max, dy0 = 24;
      var bars = [["+ end growth", umin(rate("p", "growing", v.c)), v.plus === "growing"], ["− end growth", umin(rate("m", "growing", v.c)), v.minus === "growing"],
                  ["+ end catastrophe", umin(-733), v.plus === "shrinking"], ["− end catastrophe", umin(-915), v.minus === "shrinking"]];
      bars.forEach(function (b, i) {
        var y = top + i * dy0, val = b[1], col = val < 0 ? c.c5 : c.c4, w = Math.max(1.5, Math.min(bw + 12, Math.abs(val) * sx));
        api.label([12, y + 8], b[0], {color: b[2] ? c.ink : c.muted, size: 12, weight: b[2] ? 650 : 500});
        api.rect(bx, y, w, 16, {fill: col, fillOpacity: b[2] ? 0.95 : 0.3, rx: 3});
        api.label([bx + w + 6, y + 8], sg(val, i < 2 ? 2 : 1), {color: b[2] ? col : c.muted, size: 12, weight: 600});
      });
      var yA = top + 4 * dy0 + 2;
      api.line([bx, top - 4], [bx, yA], {color: c.axis, width: 1});
      api.line([bx, yA], [bx + bw, yA], {color: c.axis, width: 1.2});
      [0, 10, 20, 30].forEach(function (t) { api.label([bx + t * sx, yA + 12], String(t), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([bx + 30 * sx + 14, yA + 12], "µm/min", {color: c.muted, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
