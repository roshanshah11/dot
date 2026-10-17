// Macroautophagy, the cell eating its own worn parts: a cup-shaped double membrane (the phagophore) wraps the cargo,
// seals into an autophagosome, fuses with a lysosome (acidic, about pH 4.5-5, full of hydrolases), the cargo is
// digested, and transporters return amino acids, fatty acids and sugars to the cytosol. Nutrients set the rate:
// fed, mTORC1 is active and keeps ULK1 off (basal, quality-control autophagy); starved, mTORC1 shuts off, ULK1 fires.
(function () {
  var TEXT = ["A cup-shaped double membrane, the <b>phagophore</b>, starts to form next to the cargo: a worn-out mitochondrion and a clump of misfolded protein",
              "The phagophore grows around the cargo, studded with LC3 proteins that receptors such as p62 use to tether the cargo",
              "Its edges seal into an <b>autophagosome</b>, a vesicle with two membranes around the cargo",
              "The autophagosome fuses with a <b>lysosome</b>, whose interior is acidic (about pH 4.5 to 5) and full of digestive enzymes",
              "Acid hydrolases (proteases, lipases, nucleases) break down the cargo and the inner membrane in the <b>autolysosome</b>",
              "Transporters release the <b>amino acids, fatty acids and sugars</b> back into the cytosol, where they become new proteins or fuel"];
  function arc(cx, cy, r, a0, a1) {
    var large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return "M " + (cx + r * Math.cos(a0)) + " " + (cy + r * Math.sin(a0)) + " A " + r + " " + r + " 0 " + large + " 1 " + (cx + r * Math.cos(a1)) + " " + (cy + r * Math.sin(a1));
  }
  function ellipse(cx, cy, rx, ry) { return "M " + (cx - rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx + rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx - rx) + " " + cy + " Z"; }

  Viz.register("autophagy-lysosome-recycling", {
    title: "Autophagy: recycling through the lysosome",
    subject: "biology",
    shows: "Step through autophagy: a double membrane wraps worn-out parts, fuses with a lysosome, digests them and returns the building blocks; switch fed to starved to see mTORC1 release the brake",
    params: {
      nutrients: {kind: "enum", values: ["fed", "starved"], default: "starved", label: "\\text{cell}"}
    },
    steps: ["phagophore forms", "engulfs the cargo", "autophagosome seals", "fuses with a lysosome", "digestion", "building blocks recycled"],
    stepMs: 1700,
    formula: function (v) {
      return v.nutrients === "fed" ? "\\text{nutrients}\\uparrow\\ \\Rightarrow\\ \\text{mTORC1 on}\\newline\\dashv\\ \\text{ULK1}\\ \\Rightarrow\\ \\text{basal autophagy}"
                                   : "\\text{nutrients}\\downarrow\\ \\Rightarrow\\ \\text{mTORC1 off}\\newline\\Rightarrow\\ \\text{ULK1 on}\\ \\Rightarrow\\ \\text{autophagy}\\uparrow";
    },
    status: function (v) {
      return TEXT[(v.step || 1) - 1] + (v.nutrients === "fed" ? "; fed, mTORC1 holds ULK1 back, so only a basal trickle runs for quality control."
                                                              : "; starved, mTORC1 is off, so ULK1 launches many autophagosomes at once.");
    },
    examples: [
      {name: "fed: basal autophagy", values: {nutrients: "fed", step: 1}},
      {name: "starved: sealing", values: {nutrients: "starved", step: 3}},
      {name: "fusion with the lysosome", values: {step: 4}},
      {name: "building blocks recycled", values: {nutrients: "fed", step: 6}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, fed = v.nutrients === "fed", O = [176, 156];
      var L = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // the nutrient switch: mTORC1 brakes ULK1
      var box = function (x, w, text, on, col) {
        api.rect(x, 10, w, 22, {fill: on ? col : "none", fillOpacity: on ? 0.25 : 0, stroke: col, width: 1.5, dash: on ? null : "4 3", rx: 6, opacity: on ? 1 : 0.6});
        L([x + w / 2, 21], text, col, {anchor: "middle", opacity: on ? 1 : 0.6});
      };
      box(14, 88, fed ? "mTORC1 on" : "mTORC1 off", fed, c.c5);
      api.line([106, 21], [124, 21], {color: c.c5, width: 2, opacity: fed ? 1 : 0.4}); api.line([124, 14], [124, 28], {color: c.c5, width: 2.5, opacity: fed ? 1 : 0.4});
      box(130, 76, fed ? "ULK1 off" : "ULK1 on", !fed, c.c1);
      L([214, 21], fed ? "→ basal rate" : "→ autophagy high", c.c1, {opacity: fed ? 0.6 : 1});
      // other autophagosomes in the cell: one when fed, many when starved
      (fed ? [[46, 238]] : [[46, 238], [362, 244], [372, 64], [30, 170], [300, 252]]).forEach(function (q) {
        api.circle(q, 11, {stroke: c.c1, width: 1.4, opacity: 0.5}); api.circle(q, 8, {stroke: c.c1, width: 1.2, opacity: 0.5}); api.circle(q, 3, {fill: c.c4, opacity: 0.6});
      });
      L([14, 268], fed ? "fed: a few autophagosomes" : "starved: autophagosomes everywhere", c.muted, {weight: 500});
      // the cargo (until it is digested)
      var cargo = function (op) {
        api.path(ellipse(O[0] - 8, O[1] - 6, 22, 11), {fill: c.c4, fillOpacity: 0.15, stroke: c.c4, width: 1.6, opacity: op});
        api.path("M " + (O[0] - 24) + " " + (O[1] - 6) + " l 6 -6 l 5 10 l 5 -9 l 6 8", {stroke: c.c4, width: 1.2, opacity: op});
        [[12, 16], [18, 10], [8, 22], [16, 22], [22, 17]].forEach(function (q) { api.circle([O[0] + q[0], O[1] + q[1]], 3.4, {fill: c.c6, opacity: op}); });
      };
      var lyso = function (at, r, op) {
        api.circle(at, r, {fill: c.c3, fillOpacity: 0.16, stroke: c.c3, width: 2, opacity: op});
        [[-0.4, -0.3], [0.35, -0.2], [0, 0.4]].forEach(function (q) { L([at[0] + q[0] * r, at[1] + q[1] * r], "H⁺", c.c3, {anchor: "middle", size: 12, weight: 500, opacity: op}); });
      };
      var R1 = 50, R2 = 44, ph = function (a0, a1) {
        api.path(arc(O[0], O[1], R1, a0, a1), {stroke: c.c1, width: 3}); api.path(arc(O[0], O[1], R2, a0, a1), {stroke: c.c1, width: 3});
        if (s >= 2) for (var a = a0 + 0.3; a < a1 - 0.1; a += 0.55) api.circle([O[0] + (R2 - 4) * Math.cos(a), O[1] + (R2 - 4) * Math.sin(a)], 2.2, {fill: c.c1});
      };
      if (s <= 3) {
        cargo(1);
        if (s === 1) ph(Math.PI * 0.45, Math.PI * 1.05);
        if (s === 2) ph(Math.PI * -0.1, Math.PI * 1.55);
        if (s === 3) ph(0, Math.PI * 2 - 0.001);
        lyso([330, 128], 26, 1);
        L([330, 170], "lysosome", c.c3, {anchor: "middle"});
        if (s === 1) { L([O[0] - 66, O[1] + 58], "phagophore", c.c1, {anchor: "middle"}); L([O[0] - 8, O[1] - 30], "worn mitochondrion", c.c4, {anchor: "middle"}); L([O[0] + 40, O[1] + 26], "protein clump", c.c6); }
        if (s === 2) L([O[0] - 70, O[1] + 60], "LC3 on the membrane", c.c1, {anchor: "middle"});
        if (s === 3) L([O[0], O[1] + 70], "autophagosome: two membranes", c.c1, {anchor: "middle"});
      } else if (s === 4) {
        api.circle(O, R1, {fill: c.c3, fillOpacity: 0.08, stroke: c.c1, width: 3});
        api.circle(O, R2, {stroke: c.c1, width: 2.4, opacity: 0.8});
        cargo(1);
        lyso([O[0] + 66, O[1] - 8], 24, 1);
        api.arrow([O[0] + 50, O[1] - 30], [O[0] + 32, O[1] - 18], {color: c.c3, width: 2, halo: false});
        L([O[0] + 96, O[1] - 8], "lysosome fuses", c.c3, {anchor: "start"});
        L([O[0] - 20, O[1] - 66], "acid and enzymes pour in", c.c3, {anchor: "middle"});
      } else if (s === 5) {
        api.circle(O, R1, {fill: c.c3, fillOpacity: 0.16, stroke: c.c3, width: 3});
        [[-20, -12, c.c4], [8, -20, c.c4], [-6, 14, c.c6], [18, 8, c.c6], [-24, 10, c.c4], [24, -6, c.c6], [0, -2, c.c4]].forEach(function (q) {
          api.path("M " + (O[0] + q[0] - 5) + " " + (O[1] + q[1]) + " q 5 -6 10 0", {stroke: q[2], width: 2, opacity: 0.6});
        });
        L([O[0], O[1] + 66], "autolysosome: cargo digested", c.c3, {anchor: "middle"});
      } else {
        api.circle(O, 34, {fill: c.c3, fillOpacity: 0.1, stroke: c.c3, width: 2.5});
        var outs = [[-2.5, "amino acids"], [-0.6, "fatty acids"], [0.7, "sugars"]];
        outs.forEach(function (o) {
          var a = o[0], p0 = [O[0] + 36 * Math.cos(a), O[1] + 36 * Math.sin(a)], p1 = [O[0] + 82 * Math.cos(a), O[1] + 82 * Math.sin(a)];
          api.arrow(p0, p1, {color: c.c2, width: 2, halo: false});
          [0.35, 0.6, 0.85].forEach(function (f) { api.circle([p0[0] + (p1[0] - p0[0]) * f + 7 * Math.sin(a), p0[1] + (p1[1] - p0[1]) * f - 7 * Math.cos(a)], 2.6, {fill: c.c2}); });
          L([p1[0] + 10 * Math.cos(a), p1[1] + 12 * Math.sin(a)], o[1], c.c2, {anchor: Math.cos(a) < 0 ? "end" : "start"});
        });
        L([O[0] + 140, O[1] + 2], "→ new proteins, fuel", c.ink, {anchor: "middle", weight: 500});
      }
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
