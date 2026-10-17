// The skeleton every amino acid shares: an alpha carbon bonded to an amino group, a carboxyl group, an H and a side
// chain R. In water both groups trade protons with the solution. With h = [H+], K1 = 10^-pKa1 (alpha-COOH) and
// K2 = 10^-pKa2 (alpha-NH3+), the three forms are cation (NH3+, COOH) = h^2/D, zwitterion (NH3+, COO-) = h*K1/D and
// anion (NH2, COO-) = K1*K2/D with D = h^2 + h*K1 + K1*K2; the net charge is cation - anion and is 0 at
// pI = (pKa1 + pKa2)/2. The structure drawn is the form that dominates at this pH. pKa values: Lehninger table 3-1.
(function () {
  var AA = {
    Gly: {name: "glycine", R: "H", k1: 2.34, k2: 9.60}, Ala: {name: "alanine", R: "CH₃", k1: 2.34, k2: 9.69},
    Val: {name: "valine", R: "CH(CH₃)₂", k1: 2.32, k2: 9.62}, Ser: {name: "serine", R: "CH₂–OH", k1: 2.21, k2: 9.15},
    Phe: {name: "phenylalanine", R: "CH₂–C₆H₅", k1: 1.83, k2: 9.13}
  };
  function forms(a, pH) {
    var h = Math.pow(10, -pH), K1 = Math.pow(10, -a.k1), K2 = Math.pow(10, -a.k2), D = h * h + h * K1 + K1 * K2;
    var f = {cat: h * h / D, zw: h * K1 / D, an: K1 * K2 / D};
    f.q = f.cat - f.an;
    f.main = f.cat >= f.zw && f.cat >= f.an ? "cat" : f.an > f.zw ? "an" : "zw";
    return f;
  }
  function qs(x) { var s = x.toFixed(2); return s === "0.00" || s === "-0.00" ? "0" : (x > 0 ? "+" : "") + s; }
  var WORD = {cat: "cation", zw: "zwitterion", an: "anion"};

  Viz.register("amino-acid-structure", {
    title: "Amino acid structure and charge",
    subject: "biology",
    shows: "Slide the pH: every amino acid is an alpha carbon carrying an amino group, a carboxyl group, an H and a side chain, and the two groups gain or lose H+ to give a cation, a zwitterion or an anion",
    params: {
      aa: {kind: "enum", values: ["Gly", "Ala", "Val", "Ser", "Phe"], default: "Ala", label: "\\text{R group}"},
      pH: {kind: "number", default: 7, min: 0, max: 14, step: 0.1, label: "\\text{pH}"}
    },
    formula: function (v) {
      var a = AA[v.aa], f = forms(a, v.pH), pI = (a.k1 + a.k2) / 2;
      return "\\text{pI}=\\frac{pK_{a1}+pK_{a2}}{2}=\\frac{" + a.k1.toFixed(2) + "+" + a.k2.toFixed(2) + "}{2}=" + pI.toFixed(2) +
        "\\newline q=f_{+}-f_{-}=" + f.cat.toFixed(2) + "-" + f.an.toFixed(2) + "=" + qs(f.q);
    },
    status: function (v) {
      var a = AA[v.aa], f = forms(a, v.pH), ph = Viz.fmt(v.pH, 1), q = "<b>" + qs(f.q).replace("-", "−") + "</b>", pc = function (x) { return Math.round(x * 100) + "%"; };
      var tail = v.aa === "Gly" ? "; glycine's R is a second H, so its alpha carbon is not chiral." : ".";
      if (f[f.main] < 0.75) {
        var two = ["cat", "zw", "an"].sort(function (p, r) { return f[r] - f[p]; }).slice(0, 2);
        return "At pH " + ph + ", near a pKa, " + a.name + " is a mix: " + pc(f[two[0]]) + " " + WORD[two[0]] + " and " + pc(f[two[1]]) + " " + WORD[two[1]] + ", net charge " + q + tail;
      }
      if (f.main === "cat") return "At pH " + ph + " the carboxyl keeps its H⁺, so " + a.name + " is mostly a <b>cation</b> (NH₃⁺, COOH), net charge " + q + tail;
      if (f.main === "an") return "At pH " + ph + " the amino group has lost its H⁺ too, so " + a.name + " is mostly an <b>anion</b> (NH₂, COO⁻), net charge " + q + tail;
      return "At pH " + ph + " " + a.name + " is a <b>zwitterion</b>: NH₃⁺ and COO⁻ cancel, so the net charge is " + q + tail;
    },
    examples: [
      {name: "zwitterion at pH 7", values: {aa: "Ala", pH: 7}},
      {name: "cation in strong acid", values: {aa: "Ala", pH: 0}},
      {name: "anion in strong base", values: {aa: "Ser", pH: 14}},
      {name: "at pKa1, half and half", values: {aa: "Gly", pH: 2.3}},
      {name: "phenylalanine at its pI", values: {aa: "Phe", pH: 5.5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, a = AA[v.aa], f = forms(a, v.pH), C = [196, 84];
      var nh = f.main === "an" ? "H₂N" : "H₃N⁺", oh = f.main === "cat" ? "OH" : "O⁻";
      // bonds from the alpha carbon
      api.line([C[0] - 17, C[1]], [148, C[1]], {color: c.ink, width: 2});
      api.line([C[0] + 17, C[1]], [244, C[1]], {color: c.ink, width: 2});
      api.line([C[0], C[1] - 12], [C[0], 48], {color: c.ink, width: 2});
      api.line([C[0], C[1] + 12], [C[0], 116], {color: c.ink, width: 2});
      api.label(C, "Cα", {color: c.ink, size: 18, weight: 700, anchor: "middle"});
      api.label([C[0], 37], "H", {color: c.muted, size: 17, weight: 600, anchor: "middle"});
      // amino group
      api.rect(80, 66, 72, 36, {stroke: c.c2, dash: "4 4", width: 1.2, rx: 8});
      api.label([142, C[1]], nh, {color: c.c2, size: 17, weight: 700, anchor: "end", raw: true});
      api.label([116, 116], "amino group", {color: c.c2, size: 12, anchor: "middle"});
      // carboxyl group: C=O above, C-O(H) below
      api.rect(242, 36, 76, 98, {stroke: c.c5, dash: "4 4", width: 1.2, rx: 8});
      api.label([254, C[1]], "C", {color: c.c5, size: 17, weight: 700, anchor: "middle"});
      api.line([261, 75], [281, 57], {color: c.c5, width: 2}); api.line([265, 79], [285, 61], {color: c.c5, width: 2});
      api.line([262, 92], [282, 110], {color: c.c5, width: 2});
      api.label([292, 50], "O", {color: c.c5, size: 17, weight: 700, anchor: "middle"});
      api.label([287, 118], oh, {color: c.c5, size: 17, weight: 700, anchor: "start", raw: true});
      api.label([280, 148], "carboxyl group", {color: c.c5, size: 12, anchor: "middle"});
      // side chain
      api.label([C[0], 129], a.R, {color: c.c3, size: 16, weight: 700, anchor: "middle", raw: true});
      api.label([C[0], 151], "side chain R", {color: c.c3, size: 12, anchor: "middle"});
      // net charge readout and chirality
      api.label([14, 22], "net charge " + qs(f.q).replace("-", "−"), {color: c.c1, size: 15, weight: 700});
      api.label([14, 42], Math.round(f[f.main] * 100) + "% " + WORD[f.main], {color: c.c1, size: 12.5});
      api.label([386, 18], v.aa === "Gly" ? "not chiral: R is H" : "chiral α carbon", {color: c.muted, size: 12, anchor: "end"});
      // net charge against pH
      var px = function (p) { return 40 + p * 340 / 14; }, py = function (z) { return 232 - 37 * z; }, pI = (a.k1 + a.k2) / 2;
      api.label([14, 178], "net charge vs pH", {color: c.muted, size: 12});
      api.label([386, 178], "at pH " + api.fmt(v.pH, 1) + ": " + qs(f.q).replace("-", "−"), {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      [[1, "+1"], [0, "0"], [-1, "−1"]].forEach(function (z) {
        api.line([px(0), py(z[0])], [px(14), py(z[0])], {color: z[0] ? c.grid : c.axis, width: z[0] ? 1 : 1.2});
        api.label([px(0) - 6, py(z[0])], z[1], {color: c.muted, size: 12, anchor: "end"});
      });
      for (var t = 0; t <= 14; t += 2) api.label([px(t), 288], String(t), {color: c.muted, size: 12, anchor: "middle"});
      api.line([px(v.pH), py(1.1)], [px(v.pH), py(-1.1)], {color: c.ink, width: 1, opacity: 0.35});
      api.line([px(a.k1), py(1.1)], [px(a.k1), py(-1.1)], {color: c.c5, width: 1.2, dash: "4 4", opacity: 0.8});
      api.line([px(a.k2), py(1.1)], [px(a.k2), py(-1.1)], {color: c.c2, width: 1.2, dash: "4 4", opacity: 0.8});
      api.label([px(a.k1) + 5, py(0.95)], "pKa₁ " + a.k1.toFixed(2), {color: c.c5, size: 12, raw: true});
      api.label([px(a.k2) - 5, py(-0.62)], "pKa₂ " + a.k2.toFixed(2), {color: c.c2, size: 12, anchor: "end", raw: true});
      api.point([px(pI), py(0)], {color: c.ink, r: 3.5});
      api.label([px(pI), py(0) - 13], "pI " + pI.toFixed(2), {color: c.ink, size: 12, anchor: "middle"});
      var pts = [];
      for (var s = 0; s <= 140; s++) pts.push([px(s / 10), py(forms(a, s / 10).q)]);
      api.polyline(pts, {stroke: c.c1, width: 2.5});
      api.point([px(v.pH), py(f.q)], {color: c.c1, r: 5.5, stroke: c.ink});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
