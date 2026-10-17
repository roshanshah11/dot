// Bacterial transformation: a competent E. coli cell takes up free plasmid DNA (CaCl2 on ice, then a 42 °C heat shock),
// expresses the plasmid's ampR gene, and only transformed cells grow on ampicillin. Below: the lab arithmetic,
// transformation efficiency = colonies / µg of DNA actually spread on the plate.
Viz.register("bacterial-transformation-free-dna-uptake", {
  title: "Bacterial transformation: taking up free DNA",
  subject: "biology",
  shows: "Step a cell through taking up a free plasmid, then set the colonies, the DNA and the share plated to get the transformation efficiency",
  params: {
    colonies: {kind: "integer", default: 100, min: 0, max: 300, label: "N"},
    dna: {kind: "number", default: 0.8, min: 0.01, max: 1, step: 0.01, label: "m"},
    f: {kind: "number", default: 0.2, min: 0.05, max: 1, step: 0.05, label: "f"}
  },
  steps: ["free plasmid outside the cell", "chill in CaCl₂ on ice", "heat shock at 42 °C", "recover at 37 °C", "plate on ampicillin"],
  stepMs: 1800,
  formula: function (v) {
    var te = v.colonies / (v.dna * v.f);
    return "TE=\\frac{N}{m\\cdot f}=\\frac{" + v.colonies + "}{" + Viz.n(v.dna) + "\\cdot " + Viz.n(v.f) + "}=" +
      Math.round(te).toLocaleString("en-US").replace(/,/g, "{,}") + "\\ \\text{per}\\ \\mu\\text{g}";
  },
  status: function (v) {
    var s = v.step || 1, te = v.colonies / (v.dna * v.f);
    var what = ["Free plasmid DNA and the cell envelope are both negatively charged, so on their own they repel",
                "Ca²⁺ from the cold CaCl₂ shields those charges, so the DNA can settle on the cell surface",
                "A 42 °C heat shock makes the membrane briefly leaky and a plasmid slips inside",
                "In broth with no antibiotic the plasmid copies itself and its ampR gene makes β-lactamase",
                "On ampicillin only cells that took up a plasmid survive, and each grows into one colony"][s - 1];
    return what + (v.colonies === 0 ? "; with <b>no colonies</b> the efficiency is 0." :
      "; this plate works out to <b>" + Math.round(te).toLocaleString("en-US") + "</b> transformants per µg.");
  },
  examples: [
    {name: "classroom plate", values: {colonies: 100, dna: 0.8, f: 0.2, step: 5}},
    {name: "high-efficiency cells", values: {colonies: 300, dna: 0.01, f: 0.1, step: 5}},
    {name: "no transformants", values: {colonies: 0, dna: 1, f: 1, step: 3}}
  ],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1;
    var rnd = function (seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; };
    var plasmid = function (at, r) { api.circle(at, r, {stroke: c.c3, width: 3}); };
    // ---- the cell (top half) ----
    var cy = 80, R = 42, x0 = 58, y0 = cy - R, cw = 192, ccx = x0 + cw - R;   // capsule: x 58..250, y 38..122
    var cellColor = s === 5 ? c.c4 : c.c2;
    api.rect(x0, y0, cw, 2 * R, {rx: R, fill: cellColor, fillOpacity: 0.07, stroke: cellColor, width: 2.5});
    api.label([x0, 13], s === 5 ? "transformed cell grows" : "E. coli cell", {color: cellColor, size: 12.5, weight: 600});
    api.path("M 72 82 C 70 50, 140 48, 154 64 S 188 102, 156 108 S 76 112, 72 82 Z", {stroke: c.muted, width: 1.6});
    api.label([118, 82], "chromosome", {color: c.muted, size: 12, anchor: "middle"});
    // charge marks sit outside the envelope, clear of its outline
    var marks = [[112, y0 - 9], [154, y0 - 9], [196, y0 - 9], [112, y0 + 2 * R + 10], [154, y0 + 2 * R + 10], [196, y0 + 2 * R + 10]];
    var rim = function (deg, out) { var a = deg * Math.PI / 180; return [ccx + (R + out) * Math.cos(a), cy + (R + out) * Math.sin(a)]; };
    var tags = ["in the medium", "0 °C, CaCl₂", "42 °C for ~45 s", "37 °C, 1 h, no drug", "37 °C overnight + ampicillin"];
    api.label([392, 14], tags[s - 1], {color: c.ink, size: 12.5, weight: 600, anchor: "end"});
    if (s === 1) {
      marks.forEach(function (q) { api.label(q, "−", {color: c.c5, size: 19, weight: 700, anchor: "middle"}); });
      [[306, 56], [352, 92], [300, 118]].forEach(function (q) { plasmid(q, 11); api.label([q[0], q[1] + 1], "−", {color: c.c5, size: 13, weight: 700, anchor: "middle"}); });
      api.label([326, 140], "free plasmid DNA", {color: c.c3, size: 12.5, weight: 600, anchor: "middle"});
      api.label([150, 147], "− meets −: they repel", {color: c.c5, size: 12, anchor: "middle"});
    } else if (s === 2) {
      marks.forEach(function (q) { api.label(q, "+", {color: c.c1, size: 17, weight: 700, anchor: "middle"}); });
      [rim(-32, 13), rim(28, 13)].forEach(function (q) { plasmid(q, 11); });
      plasmid([340, cy], 11);
      api.label([150, 147], "Ca²⁺ (+) masks the negative charges", {color: c.c1, size: 12, anchor: "middle"});
      api.label([340, cy + 28], "free plasmid", {color: c.c3, size: 12, anchor: "middle"});
    } else if (s === 3) {
      plasmid([ccx + R, cy], 11);
      api.arrow([318, cy], [ccx + R + 16, cy], {color: c.c3, width: 2.5, halo: false});
      plasmid(rim(-34, 13), 11);
      api.label([330, cy + 28], "plasmid enters", {color: c.c3, size: 12, anchor: "middle"});
      api.label([150, 147], "heat makes the membrane briefly leaky", {color: c.c5, size: 12, anchor: "middle"});
    } else {
      plasmid([206, cy - 16], 9); plasmid([214, cy + 16], 9);
      var r4 = rnd(11);
      for (var i = 0; i < 14; i++) {
        var a = r4() * 2 * Math.PI, inner = [ccx + (R - 6) * Math.cos(a), cy + (R - 6) * Math.sin(a)];
        if (inner[0] < ccx) inner[0] = x0 + R + (ccx - x0 - R) * r4();
        api.circle(inner, 2.6, {fill: c.c4});
      }
      api.label([150, 147], "ampR → β-lactamase (green)", {color: c.c4, size: 12, anchor: "middle"});
      if (s === 4) api.label([258, cy - 20], "plasmid copies", {color: c.c3, size: 12});
      if (s === 5) {
        api.rect(292, cy - 20, 90, 40, {rx: 20, stroke: c.c5, width: 2, dash: "5 4"});
        api.line([318, cy - 14], [356, cy + 14], {color: c.c5, width: 2.5}); api.line([356, cy - 14], [318, cy + 14], {color: c.c5, width: 2.5});
        api.label([337, cy + 36], "no plasmid: killed", {color: c.c5, size: 12, anchor: "middle"});
      }
    }
    api.line([12, 156], [api.w - 12, 156], {color: c.grid, width: 1});
    // ---- the efficiency arithmetic (bottom half) ----
    var bx = 18, by = 194, bw = 160, bh = 26, spread = v.dna * v.f, te = v.colonies / spread;
    api.label([bx, 174], "m = " + api.fmt(v.dna) + " µg plasmid in the mix", {color: c.c3, size: 12.5, weight: 600});
    api.rect(bx, by, bw, bh, {rx: 8, stroke: c.muted, width: 1.2});
    api.rect(bx, by, bw * v.f, bh, {rx: 8, fill: c.c1, fillOpacity: 0.32});
    var k = Math.max(1, Math.min(16, Math.round(v.dna * 16)));
    for (var j = 0; j < k; j++) api.circle([bx + 9 + j * (bw - 18) / Math.max(1, 15), by + (j % 2 ? 17 : 9)], 3.4, {stroke: c.c3, width: 1.6});
    api.label([bx, 236], "f = " + api.fmt(v.f) + " of the mix spread", {color: c.c1, size: 12.5, weight: 600});
    // m has 2 decimals and f has 2, so 4 decimals print the exact product TE divides by
    api.label([bx, 260], "DNA spread: " + api.fmt(v.dna) + " × " + api.fmt(v.f) + " = " + api.fmt(spread, 4) + " µg", {color: c.ink, size: 12.5});
    api.label([bx, 284], "TE = " + Math.round(te).toLocaleString("en-US") + " per µg", {color: c.ink, size: 13, weight: 650});
    var P = [318, 234], pr = 60;
    api.arrow([bx + bw + 6, by + bh / 2], [P[0] - pr - 6, P[1] - 8], {color: c.c1, width: 2, halo: false});
    api.circle(P, pr, {stroke: s === 5 ? c.c4 : c.muted, width: 1.6, fill: c.ink, fillOpacity: 0.03});
    var r5 = rnd(7);
    for (var n = 0; n < v.colonies; n++) {
      var rr = (pr - 6) * Math.sqrt(r5()), th = r5() * 2 * Math.PI;
      api.circle([P[0] + rr * Math.cos(th), P[1] + rr * Math.sin(th)], 2.7, {fill: c.c4});
    }
    api.label([P[0], 166], "N = " + v.colonies + " colonies", {color: c.c4, size: 12.5, weight: 600, anchor: "middle"});
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
