// The 20 amino acids sorted by what their side chain does. Top: every residue placed on the Kyte-Doolittle hydropathy
// scale (Kyte & Doolittle 1982; positive = hydrophobic), colored by class; tap one to pick it. Below: the chosen side
// chain and its charge at the chosen pH from Henderson-Hasselbalch, q = -1/(1 + 10^(pKa - pH)) for an acidic group and
// q = +1/(1 + 10^(pH - pKa)) for a basic one. Side-chain pKa values are Lehninger's (table 3-1, free amino acids; inside
// a folded protein they shift). Classes follow the usual intro-biology split (nonpolar, polar uncharged, acidic, basic);
// biochemistry texts often pull F, Y and W out as a separate aromatic group.
(function () {
  // key: [name, three-letter, class, hydropathy, side chain (protonated), side chain (deprotonated), pKa, charge sign]
  var AA = {
    G: ["glycine", "Gly", "np", -0.4, "–H"], A: ["alanine", "Ala", "np", 1.8, "–CH₃"],
    V: ["valine", "Val", "np", 4.2, "–CH(CH₃)₂"], L: ["leucine", "Leu", "np", 3.8, "–CH₂–CH(CH₃)₂"],
    I: ["isoleucine", "Ile", "np", 4.5, "–CH(CH₃)–CH₂–CH₃"], M: ["methionine", "Met", "np", 1.9, "–CH₂–CH₂–S–CH₃"],
    F: ["phenylalanine", "Phe", "np", 2.8, "–CH₂–(benzene ring)"], W: ["tryptophan", "Trp", "np", -0.9, "–CH₂–(indole ring)"],
    P: ["proline", "Pro", "np", -1.6, "–(CH₂)₃– looped back onto its own N"],
    S: ["serine", "Ser", "po", -0.8, "–CH₂–OH"], T: ["threonine", "Thr", "po", -0.7, "–CH(OH)–CH₃"],
    C: ["cysteine", "Cys", "po", 2.5, "–CH₂–SH", "–CH₂–S⁻", 8.18, -1], N: ["asparagine", "Asn", "po", -3.5, "–CH₂–CO–NH₂"],
    Q: ["glutamine", "Gln", "po", -3.5, "–(CH₂)₂–CO–NH₂"], Y: ["tyrosine", "Tyr", "po", -1.3, "–CH₂–C₆H₄–OH", "–CH₂–C₆H₄–O⁻", 10.07, -1],
    D: ["aspartate", "Asp", "ac", -3.5, "–CH₂–COOH", "–CH₂–COO⁻", 3.65, -1], E: ["glutamate", "Glu", "ac", -3.5, "–(CH₂)₂–COOH", "–(CH₂)₂–COO⁻", 4.25, -1],
    K: ["lysine", "Lys", "ba", -3.9, "–(CH₂)₄–NH₃⁺", "–(CH₂)₄–NH₂", 10.53, 1],
    R: ["arginine", "Arg", "ba", -4.5, "–(CH₂)₃–NH–C(NH₂)₂⁺", "–(CH₂)₃–NH–C(=NH)–NH₂", 12.48, 1],
    H: ["histidine", "His", "ba", -3.2, "–CH₂–(imidazole)H⁺", "–CH₂–(imidazole)", 6.00, 1]
  };
  var KEYS = "GAVLIMFWPSTCNQYDEKRH".split(""), NAMES = {};
  KEYS.forEach(function (k) { NAMES[k] = AA[k][1]; });
  var CLS = {np: ["nonpolar", "c3"], po: ["polar", "c1"], ac: ["acidic (−)", "c5"], ba: ["basic (+)", "c2"]};
  var NOTE = {G: "the smallest side chain, so it fits tight turns", P: "its ring locks the backbone and kinks the chain",
              C: "two cysteines can link into a disulfide bond", H: "its pKa sits near 6, so it gains or loses H⁺ near body pH, which suits enzyme active sites",
              W: "its ring N–H makes it the least hydrophobic of the nonpolar group"};
  function charge(a, pH) { return a[6] == null ? 0 : a[7] < 0 ? -1 / (1 + Math.pow(10, a[6] - pH)) : 1 / (1 + Math.pow(10, pH - a[6])); }
  function q2(x) { var s = x.toFixed(2); return s === "-0.00" || s === "0.00" ? "0" : (x > 0 ? "+" : "") + s; }

  Viz.register("amino-acid-side-chain-properties", {
    title: "Amino acid side chains: properties",
    subject: "biology",
    shows: "Pick an amino acid and a pH: side chains sort into nonpolar, polar, acidic and basic, from hydrophobic to hydrophilic, and the ionizable ones gain or lose charge with pH",
    params: {
      aa: {kind: "enum", values: KEYS, names: NAMES, default: "H", label: "\\text{residue}"},
      pH: {kind: "number", default: 7.4, min: 0, max: 14, step: 0.1, label: "\\text{pH}"}
    },
    formula: function (v) {
      var a = AA[v.aa], hyd = "\\text{hydropathy } {" + (a[3] > 0 ? "+" : "") + Viz.n(a[3], 1) + "}";
      if (a[6] == null) return "\\text{" + a[1] + ": }" + hyd + "\\newline q_{\\text{side}}=0\\ \\text{at any pH}";
      var q = q2(charge(a, v.pH)), pk = Viz.n(a[6], 2), ph = Viz.n(v.pH, 1);
      return (a[7] < 0 ? "q=-\\frac{1}{1+10^{\\,pK_a-\\text{pH}}}=-\\frac{1}{1+10^{\\," + pk + "-" + ph + "}}"
                       : "q=\\frac{1}{1+10^{\\,\\text{pH}-pK_a}}=\\frac{1}{1+10^{\\," + ph + "-" + pk + "}}") + "=" + q + "\\newline \\text{" + a[1] + ": }" + hyd;
    },
    status: function (v) {
      var a = AA[v.aa], q = charge(a, v.pH), nm = a[0].charAt(0).toUpperCase() + a[0].slice(1), cls = CLS[a[2]][0].replace(/ \(.\)/, "");
      var head = nm + " is <b>" + cls + "</b>";
      var extra = NOTE[v.aa] ? "; " + NOTE[v.aa] + "." : ".";
      if (a[6] == null) return head + (a[2] === "np" ? " (hydropathy " + Viz.fmt(a[3], 1) + "), uncharged at any pH" + (a[3] > 0 ? ", so it tends to hide in the protein core" : "") :
        ": its side chain hydrogen-bonds with water and stays uncharged at any pH, so it tends to sit on the surface") + extra;
      var on = Math.abs(q) >= 0.5;
      return head + ": at pH " + Viz.fmt(v.pH, 1) + " its side chain carries <b>" + q2(q).replace("-", "−") + "</b>, " + (Math.abs(Math.abs(q) - 0.5) < 0.15 ? "about half charged" : on ? "charged" : "mostly uncharged") +
        " (pKa " + Viz.fmt(a[6], 2) + ")" + (on && a[2] !== "po" ? ", so it faces the water and can form salt bridges" : "") + extra;
    },
    examples: [
      {name: "histidine at body pH", values: {aa: "H", pH: 7.4}},
      {name: "aspartate, charged", values: {aa: "D", pH: 7.4}},
      {name: "aspartate at pH 2, neutral", values: {aa: "D", pH: 2}},
      {name: "lysine at pH 0", values: {aa: "K", pH: 0}},
      {name: "cysteine at pH 14", values: {aa: "C", pH: 14}},
      {name: "leucine, hydrophobic", values: {aa: "L", pH: 7}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, sel = AA[v.aa], X = function (h) { return 30 + (h + 4.5) * 340 / 9; }, base = 104;
      // the hydropathy beeswarm: each residue at its value, stacked up when it would overlap a neighbour
      var placed = [];
      KEYS.slice().sort(function (p, q) { return AA[p][3] - AA[q][3]; }).forEach(function (k) {
        var x = X(AA[k][3]), lv = 0;
        while (placed.some(function (o) { return o.lv === lv && Math.abs(o.x - x) < 21; })) lv++;
        placed.push({k: k, x: x, lv: lv});
      });
      api.line([24, 118], [376, 118], {color: c.axis, width: 1.2});
      [-4, -2, 0, 2, 4].forEach(function (t) {
        api.line([X(t), 115], [X(t), 121], {color: c.axis, width: 1.2});
        api.label([X(t), 131], (t > 0 ? "+" : "") + api.fmt(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([24, 147], "← hydrophilic", {color: c.muted, size: 12});
      api.label([200, 147], "hydropathy", {color: c.muted, size: 12, anchor: "middle"});
      api.label([376, 147], "hydrophobic →", {color: c.muted, size: 12, anchor: "end"});
      placed.forEach(function (o) {
        var a = AA[o.k], col = c[CLS[a[2]][1]], at = [o.x, base - 21 * o.lv], on = o.k === v.aa;
        var dot = api.circle(at, on ? 11.5 : 10, {fill: col, fillOpacity: on ? 1 : 0.8, stroke: on ? c.ink : null, width: 2.5});
        var t = api.label(at, o.k, {color: c.card, size: 12, weight: 750, anchor: "middle", clamp: false});
        [dot, t].forEach(function (e) { e.style.cursor = "pointer"; e.addEventListener("click", function () { api.set({aa: o.k}); }); });
      });
      // the class key, top right where the hydrophobic end leaves room
      [["np", 212], ["po", 282], ["ac", 212], ["ba", 282]].forEach(function (p, i) {
        api.label([p[1], i < 2 ? 16 : 34], CLS[p[0]][0], {color: c[CLS[p[0]][1]], size: 12, weight: 650});
      });
      // the chosen side chain, in the form that dominates at this pH
      var col = c[CLS[sel[2]][1]], q = charge(sel, v.pH), form = sel[6] == null ? sel[4] : v.pH < sel[6] ? sel[4] : sel[5];
      api.label([14, 172], sel[1] + " (" + v.aa + "), " + sel[0], {color: col, size: 14, weight: 700});
      api.label([386, 172], CLS[sel[2]][0], {color: col, size: 12.5, weight: 600, anchor: "end"});
      api.label([14, 193], "side chain R: " + form, {color: c.ink, size: 13, raw: true});
      // side-chain charge against pH for the chosen residue
      var px = function (p) { return 40 + p * 340 / 14; }, py = function (z) { return 261 - 29 * z; };
      api.label([14, 218], "side-chain charge vs pH", {color: c.muted, size: 12});
      api.line([px(0), py(0)], [px(14), py(0)], {color: c.axis, width: 1.2});
      [[1, "+1"], [0, "0"], [-1, "−1"]].forEach(function (z) {
        api.line([px(0), py(z[0])], [px(14), py(z[0])], {color: c.grid, width: 1});
        api.label([px(0) - 6, py(z[0])], z[1], {color: c.muted, size: 12, anchor: "end"});
      });
      for (var t = 0; t <= 14; t += 2) api.label([px(t), 304], String(t), {color: c.muted, size: 12, anchor: "middle"});
      api.line([px(v.pH), py(1.08)], [px(v.pH), py(-1.08)], {color: c.ink, width: 1, opacity: 0.35});
      if (sel[6] != null) {   // the pKa label goes in the half of the plot the curve leaves empty
        var acid = sel[7] < 0, endA = acid || sel[6] > 11;
        api.line([px(sel[6]), py(1.08)], [px(sel[6]), py(-1.08)], {color: c.muted, width: 1.2, dash: "4 4"});
        api.label([px(sel[6]) + (endA ? -5 : 5), py(-0.55)], "pKa " + api.fmt(sel[6], 2), {color: c.muted, size: 12, anchor: endA ? "end" : "start"});
      } else {
        api.label([px(7), py(0.5)], "no ionizable group: 0 at every pH", {color: c.muted, size: 12, anchor: "middle"});
      }
      var pts = [];
      for (var s = 0; s <= 140; s++) pts.push([px(s / 10), py(charge(sel, s / 10))]);
      api.polyline(pts, {stroke: col, width: 2.5});
      api.point([px(v.pH), py(q)], {color: col, r: 5.5, stroke: c.ink});
      api.label([386, 218], "at pH " + api.fmt(v.pH, 1) + ": " + q2(q).replace("-", "−"), {color: col, size: 12.5, weight: 650, anchor: "end"});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
