// Two amino acids joined by a peptide bond in a condensation (dehydration) reaction: the carboxyl OH of the first and
// one H of the second's amino group leave as water, and the carbonyl C bonds to the N. The dipeptide keeps a free
// amino group (N-terminus) and a free carboxyl group (C-terminus); the C-N bond has partial double-bond character, so
// the peptide group is planar and does not rotate. Neutral (un-ionized) forms are drawn, as textbooks do for this
// reaction. Average molar masses from C 12.011, H 1.008, N 14.007, O 15.999: Gly C2H5NO2 75.067, Ala C3H7NO2 89.094,
// Ser C3H7NO3 105.093, Val C5H11NO2 117.148, water 18.015; Gly-Ala C5H10N2O3 146.146, Ser-Val C8H16N2O4 204.226.
(function () {
  var P = {
    "generic R1 and R2": {a: ["amino acid 1", "R_1", null], b: ["amino acid 2", "R_2", null], name: "a dipeptide", short: ["\\text{aa}_1", "\\text{aa}_2", "\\text{dipeptide}"]},
    "glycine and alanine": {a: ["glycine", "H", 75.067], b: ["alanine", "CH₃", 89.094], name: "glycylalanine (Gly-Ala)", short: ["\\text{Gly}", "\\text{Ala}", "\\text{Gly-Ala}"],
      rs: "glycine's R is just H, alanine's is CH₃"},
    "serine and valine": {a: ["serine", "CH₂OH", 105.093], b: ["valine", "CH(CH₃)₂", 117.148], name: "serylvaline (Ser-Val)", short: ["\\text{Ser}", "\\text{Val}", "\\text{Ser-Val}"],
      rs: "serine's R is polar CH₂OH, valine's is nonpolar CH(CH₃)₂"}
  };
  function mass(p) { return p.a[2] ? Math.round((p.a[2] + p.b[2] - 18.015) * 1000) / 1000 : null; }

  Viz.register("amino-acids-and-peptide-bonds", {
    title: "Amino acids and the peptide bond",
    subject: "biology",
    shows: "Step through a condensation: the carboxyl OH of one amino acid and an H from the next one's amino group leave as water, and the new C–N peptide bond joins them into a dipeptide with an N-terminus and a C-terminus",
    params: {
      aminoAcidExample: {kind: "enum", values: ["generic R1 and R2", "glycine and alanine", "serine and valine"], default: "generic R1 and R2", label: "\\text{pair}",
        names: {"generic R1 and R2": "R₁ + R₂", "glycine and alanine": "Gly + Ala", "serine and valine": "Ser + Val"}}
    },
    steps: ["two free amino acids", "condensation: water leaves", "the dipeptide"],
    stepMs: 1800,
    formula: function (v) {
      var p = P[v.aminoAcidExample], s = p.short, m = mass(p);
      return s[0] + " + " + s[1] + " \\to " + s[2] + " + \\text{H}_2\\text{O}\\newline M = " +
        (m ? p.a[2].toFixed(3) + " + " + p.b[2].toFixed(3) + " - 18.015 = " + m.toFixed(3) + "\\ \\text{g/mol}" : "M_1 + M_2 - 18.015\\ \\text{g/mol}");
    },
    status: function (v) {
      var p = P[v.aminoAcidExample], s = v.step || 1, m = mass(p);
      if (s === 1) return "Each amino acid has an <b>amino group</b>, a <b>carboxyl group</b>, an H and a side chain R on its α carbon" + (p.rs ? "; " + p.rs + "." : ".");
      if (s === 2) return "<b>Condensation</b>: the OH from the first carboxyl and an H from the second amino group leave as <b>water</b>, and the carbonyl carbon bonds to the nitrogen.";
      return "The <b>peptide bond</b> makes " + p.name + (m ? ", " + Viz.fmt(m, 3) + " g/mol," : "") + " with a free amino N-terminus and carboxyl C-terminus; its C–N bond is partly double, so it stays flat and does not rotate.";
    },
    examples: [
      {name: "two free amino acids", values: {aminoAcidExample: "generic R1 and R2", step: 1}},
      {name: "glycine and alanine lose water", values: {aminoAcidExample: "glycine and alanine", step: 2}},
      {name: "serylvaline", values: {aminoAcidExample: "serine and valine", step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, p = P[v.aminoAcidExample], s = v.step || 1, ny = 150, amino = c.c2, carb = c.c5, side = c.c3, pep = c.c1;
      var atom = function (at, t, col, o) { api.label(at, t, Object.assign({color: col || c.ink, size: 16, weight: 650, anchor: "middle"}, o || {})); };
      var bond = function (a, b, col, w, dash) {
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), r = 9;
        api.line([a[0] + dx / L * r, a[1] + dy / L * r], [b[0] - dx / L * r, b[1] - dy / L * r], {color: col || c.ink, width: w || 2, dash: dash});
      };
      // one amino acid with its N at nx; parts can be left out where the peptide bond replaces them
      var aa = function (nx, R, opt) {
        var N = [nx, ny], Ca = [nx + 36, ny], C = [nx + 72, ny];
        if (!opt.noH) { atom([nx - 34, ny], "H", amino, {opacity: opt.fadeH ? 0.45 : 1}); bond([nx - 34, ny], N, amino); }
        atom(N, "N", amino); atom([nx, ny + 30], "H", amino); bond(N, [nx, ny + 30], amino);
        atom(Ca, "C", c.ink); api.label([nx + 44, ny + 7], "α", {color: c.muted, size: 12});
        atom([nx + 36, ny - 30], "H", c.ink); bond(Ca, [nx + 36, ny - 30]);
        atom([nx + 36, ny + 54], R, side, {size: 15}); bond(Ca, [nx + 36, ny + 54], side);
        bond(N, Ca); bond(Ca, C);
        atom(C, "C", carb); atom([nx + 72, ny - 30], "O", carb);
        api.line([nx + 68, ny - 9], [nx + 68, ny - 21], {color: carb, width: 2}); api.line([nx + 76, ny - 9], [nx + 76, ny - 21], {color: carb, width: 2});
        if (!opt.noOH) { atom([nx + 110, ny], "OH", carb, {opacity: opt.fadeOH ? 0.45 : 1}); bond(C, [nx + 98, ny], carb); }
      };
      if (s < 3) {
        var n1 = 60, n2 = 250;
        aa(n1, p.a[1], {fadeOH: s === 2}); aa(n2, p.b[1], {fadeH: s === 2});
        api.label([n1 + 36, ny - 62], p.a[0], {color: c.ink, size: 13, anchor: "middle"});
        api.label([n2 + 36, ny - 62], p.b[0], {color: c.ink, size: 13, anchor: "middle"});
        if (s === 1) {
          atom([197, ny], "+", c.muted, {size: 18});
          api.label([n1 - 34, ny - 30], "amino", {color: amino, size: 12});
          api.label([n1 + 110, ny - 30], "carboxyl", {color: carb, size: 12, anchor: "middle"});
          api.label([n1 + 36, ny + 78], "side chain", {color: side, size: 12, anchor: "middle"});
        } else {
          api.path("M " + (n1 + 94) + " " + ny + " a 16 12 0 1 0 32 0 a 16 12 0 1 0 -32 0", {stroke: carb, width: 1.6, dash: "4 3"});
          api.path("M " + (n2 - 46) + " " + ny + " a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0", {stroke: amino, width: 1.6, dash: "4 3"});
          api.path("M " + (n1 + 112) + " " + (ny - 14) + " Q " + (n1 + 118) + " 78 186 76", {stroke: carb, width: 1.6, arrow: true});
          api.path("M " + (n2 - 34) + " " + (ny - 14) + " Q " + (n2 - 40) + " 78 214 76", {stroke: amino, width: 1.6, arrow: true});
          atom([200, 64], "H₂O", c.ink, {size: 16});
          api.path("M " + (n1 + 76) + " " + (ny + 12) + " Q 190 " + (ny + 70) + " " + (n2 - 4) + " " + (ny + 12), {stroke: pep, width: 2, dash: "5 4"});
          api.label([196, ny + 58], "new C–N bond", {color: pep, size: 12, anchor: "middle"});
        }
      } else {
        var m1 = 104, m2 = 212;
        api.rect(m1 + 46, ny - 42, (m2 + 26) - (m1 + 46), 84, {fill: pep, fillOpacity: 0.08, stroke: pep, dash: "4 4", width: 1, rx: 8});
        aa(m1, p.a[1], {noOH: true}); aa(m2, p.b[1], {noH: true});
        api.line([m1 + 81, ny], [m2 - 9, ny], {color: pep, width: 4});
        api.line([(m1 + m2 + 72) / 2, ny - 46], [(m1 + m2 + 72) / 2, ny - 8], {color: pep, width: 1.2});
        api.label([(m1 + m2 + 72) / 2, ny - 54], "peptide bond (flat, no rotation)", {color: pep, size: 12.5, weight: 650, anchor: "middle"});
        api.label([m1 - 34, ny - 30], "N-terminus", {color: amino, size: 12, anchor: "middle"});
        api.label([m2 + 110, ny + 30], "C-terminus", {color: carb, size: 12, anchor: "middle"});
        atom([368, ny], "+ H₂O", c.muted, {size: 15});
        api.label([200, 52], p.name, {color: c.ink, size: 14, weight: 650, anchor: "middle"});
      }
      var m = mass(p);
      api.label([14, 262], m ? "mass: " + api.fmt(p.a[2], 3) + " + " + api.fmt(p.b[2], 3) + " − 18.015 = " + api.fmt(m, 3) + " g/mol" : "every peptide bond releases one water (18.015 g/mol)", {color: c.muted, size: 12});
      api.label([14, 286], "amino group", {color: amino, size: 12});
      api.label([104, 286], "carboxyl group", {color: carb, size: 12});
      api.label([210, 286], "side chain R", {color: side, size: 12});
      api.label([306, 286], "peptide bond", {color: pep, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
