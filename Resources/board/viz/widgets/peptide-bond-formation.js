// Building a real peptide one peptide bond at a time: angiotensin I, Asp-Arg-Val-Tyr-Ile-His-Pro-Phe-His-Leu, added
// N-terminus first the way a ribosome adds residues (each new amino acid joins the free carboxyl at the C-terminus).
// Each bond is a condensation: the carboxyl OH of the chain's last residue and an H from the new residue's amino group
// leave as water, and C bonds to N. n residues are held by n - 1 bonds, so M = sum(M_i) - 18.015 (n - 1).
// Average masses from C 12.011, H 1.008, N 14.007, O 15.999 (neutral forms): Asp 133.103, Arg 174.204, Val 117.148,
// Tyr 181.191, Ile 131.175, His 155.157, Pro 115.132, Phe 165.192, Leu 131.175. Check: 8 residues = angiotensin II
// 1046.197 (listed 1046.2), 10 = angiotensin I 1296.499 (listed 1296.5). Proline's amino group is secondary, so the
// N of a bond made to Pro carries the ring CH2 instead of an H. The C-N bond is partly double (resonance with C=O), so
// the six atoms around it lie in one plane, almost always trans.
(function () {
  var SEQ = ["Asp", "Arg", "Val", "Tyr", "Ile", "His", "Pro", "Phe", "His", "Leu"];
  var M = {Asp: 133.103, Arg: 174.204, Val: 117.148, Tyr: 181.191, Ile: 131.175, His: 155.157, Pro: 115.132, Phe: 165.192, Leu: 131.175};
  var ONE = {Asp: "D", Arg: "R", Val: "V", Tyr: "Y", Ile: "I", His: "H", Pro: "P", Phe: "F", Leu: "L"};   // one-letter codes for the chain row
  var WATER = 18.015;
  function sum(n) { var s = 0; for (var i = 0; i < n; i++) s += M[SEQ[i]]; return Math.round(s * 1000) / 1000; }
  function mass(n) { return Math.round((sum(n) - WATER * (n - 1)) * 1000) / 1000; }
  Viz.register("peptide-bond-formation", {
    title: "Peptide bonds, one at a time",
    subject: "biology",
    shows: "Add residues to a real peptide: every new amino acid joins the C-terminus by a condensation that releases one water, so n residues hold n − 1 peptide bonds and weigh 18.015 × (n − 1) less than their free amino acids",
    params: {
      n: {kind: "integer", default: 3, min: 2, max: 10, label: "n\\ \\text{residues}"}
    },
    formula: function (v) {
      return "M=\\sum M_i-18.015\\,(n-1)\\newline=" + sum(v.n).toFixed(3) + "-18.015\\cdot" + (v.n - 1) + "=" + mass(v.n).toFixed(3) + "\\ \\text{g/mol}";
    },
    status: function (v) {
      var n = v.n, newest = SEQ[n - 2] + "–" + SEQ[n - 1];
      var tail = n === 8 ? " This chain is <b>angiotensin II</b>, the hormone that narrows blood vessels." :
                 n === 10 ? " This is <b>angiotensin I</b>; cutting its last bond to release His-Leu gives angiotensin II." : "";
      return "<b>" + (n - 1) + "</b>" + (n > 2 ? " peptide bonds now join " : " peptide bond now joins ") + n + " residues, the newest " + newest +
        (SEQ[n - 1] === "Pro" ? " (to proline, whose N keeps no H)" : "") + "; " + (n > 2 ? "each" : "it") + " released one water, so the chain weighs <b>" +
        mass(n).toFixed(1) + " g/mol</b>." + tail;
    },
    examples: [
      {name: "a dipeptide", values: {n: 2}},
      {name: "bond to proline", values: {n: 7}},
      {name: "angiotensin II", values: {n: 8}},
      {name: "angiotensin I", values: {n: 10}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, n = v.n, pep = c.c1, wat = c.c2, res = c.c3, CY = 54, R = 13;
      var bx = function (i) { return 52 + i * 36; };
      // the chain: residues joined by peptide bonds, the rest of the sequence still waiting
      api.label([bx(0), CY - 26], "H₂N", {color: c.muted, size: 12, weight: 600, anchor: "middle"});
      api.label([bx(n - 1), CY - 26], "COOH", {color: c.muted, size: 12, weight: 600, anchor: "middle"});
      for (var i = 0; i < 10; i++) {
        var on = i < n, nxt = i === n, x = bx(i), mid = (bx(i - 1) + x) / 2;
        if (i > 0 && on) {
          api.line([bx(i - 1) + R, CY], [x - R, CY], {color: pep, width: i === n - 1 ? 5 : 3.5});
          api.line([mid, CY + 5], [mid, CY + 26], {color: wat, width: 1.2, dash: "2 3", arrow: true, opacity: 0.8});
          api.label([mid, CY + 38], "H₂O", {color: wat, size: 12, weight: 600, anchor: "middle"});
        }
        api.circle([x, CY], R, {fill: on ? res : "none", fillOpacity: on ? (i === n - 1 ? 0.55 : 0.25) : 0, stroke: on || nxt ? res : c.faint, width: on ? 1.6 : 1, dash: on ? null : "3 3"});
        api.label([x, CY + 0.5], ONE[SEQ[i]], {color: on ? c.ink : nxt ? res : c.faint, size: 13, weight: on ? 700 : 500, anchor: "middle"});
      }
      if (n < 10) api.label([bx(n), CY + 24], "next", {color: res, size: 12, anchor: "middle"});
      api.label([14, CY + 62], (n - 1) + " peptide bond" + (n > 2 ? "s" : "") + " in the chain, " + (n - 1) + " water" + (n > 2 ? "s" : "") + " released", {color: pep, size: 12.5, weight: 650});
      // the newest bond, atom by atom
      var y0 = 186, A = [44, y0], C = [104, y0], N = [170, y0], B = [232, y0], O = [104, y0 - 34];
      var atom = function (at, t, col) { api.label(at, t, {color: col, size: 15, weight: 650, anchor: "middle"}); };
      var bond = function (a, b, col, w) {
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), r = 11;
        api.line([a[0] + dx / L * r, a[1] + dy / L * r], [b[0] - dx / L * r, b[1] - dy / L * r], {color: col, width: w || 2});
      };
      api.label([14, 131], "newest bond: " + SEQ[n - 2] + " carbonyl C to " + SEQ[n - 1] + " amino N", {color: c.muted, size: 12});
      // the amide plane holds six atoms: Cα, C, O, N, the H (or Pro ring CH₂) on N, and the next Cα
      api.rect(A[0] - 16, O[1] - 13, (B[0] - A[0]) + 32, (y0 + 42) - (O[1] - 13), {fill: pep, fillOpacity: 0.07, stroke: pep, dash: "4 4", width: 1, rx: 8});
      atom(A, "Cα", c.ink); atom(C, "C", c.ink); atom(N, "N", c.ink); atom(B, "Cα", c.ink); atom(O, "O", c.ink);
      bond(A, C, c.ink); bond(N, B, c.ink);
      api.line([C[0] - 4, O[1] + 11], [C[0] - 4, C[1] - 10], {color: c.ink, width: 2}); api.line([C[0] + 4, O[1] + 11], [C[0] + 4, C[1] - 10], {color: c.ink, width: 2});
      bond(C, N, pep, 3.5);
      api.line([C[0] + 13, y0 + 6], [N[0] - 13, y0 + 6], {color: pep, width: 1.5, dash: "3 3"});
      api.label([C[0] + 22, O[1]], "planar", {color: pep, size: 12, weight: 650});
      var pro = SEQ[n - 1] === "Pro";
      atom([N[0], y0 + 32], pro ? "CH₂" : "H", pro ? res : c.ink); bond(N, [N[0], y0 + 32], pro ? res : c.ink);
      if (pro) api.label([N[0] + 20, y0 + 32], "Pro ring", {color: res, size: 12});
      api.label([A[0], y0 + 20], SEQ[n - 2], {color: res, size: 12, anchor: "middle"});
      api.label([B[0], y0 + 20], SEQ[n - 1], {color: res, size: 12, anchor: "middle"});
      // what left: the carboxyl OH plus one H from the amino group
      api.label([330, 152], "leave as", {color: c.muted, size: 12, anchor: "middle"});
      api.label([330, 170], "OH  +  H", {color: wat, size: 14, weight: 650, anchor: "middle"});
      api.arrow([330, 181], [330, 201], {color: wat, width: 2, halo: false, head: 8});
      api.label([330, 214], "H₂O", {color: wat, size: 15, weight: 700, anchor: "middle"});
      // mass bookkeeping bar: free amino acids minus the waters
      var X0 = 14, X1 = 386, MAX = sum(10), sx = (X1 - X0) / MAX, by = 256, s = sum(n), w = WATER * (n - 1);
      api.rect(X0, by, (s - w) * sx, 14, {fill: res, fillOpacity: 0.55, rx: 2});
      api.rect(X0 + (s - w) * sx, by, w * sx, 14, {fill: wat, fillOpacity: 0.8, rx: 2});
      api.label([X0, by - 12], "peptide " + mass(n).toFixed(1) + " g/mol", {color: res, size: 12, weight: 650});
      api.label([X1, by - 12], "− " + (n - 1) + " × 18.015 = " + w.toFixed(1) + " g/mol water", {color: wat, size: 12, weight: 650, anchor: "end"});
      api.label([X0, by + 28], "the free amino acids together: " + s.toFixed(1) + " g/mol", {color: c.muted, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
