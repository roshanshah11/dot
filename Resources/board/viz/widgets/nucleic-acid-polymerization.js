// Building a nucleic acid chain. Each incoming nucleoside triphosphate pairs with the next template base; the chain's
// free 3'-OH attacks its alpha-phosphate, a phosphodiester bond forms (3' C - O - P - O - 5' C) and the beta and gamma
// phosphates leave as pyrophosphate (PPi). So a chain only grows at its 3' end: 5' -> 3'. DNA polymerase cannot start a
// chain; it extends a primer's 3'-OH (an RNA primer in cells, a DNA one in PCR; drawn here as 2 nucleotides), one bond
// and one PPi per nucleotide: primer(k) + n dNTP -> chain(k + n) + n PPi. RNA polymerase starts from scratch: the first
// NTP keeps its 5' triphosphate, so n NTP -> pppN(pN)(n-1) + (n-1) PPi. The template strand runs the other way (3' -> 5'
// under the new 5' -> 3' strand), pairing A-T (A-U in RNA) and G-C. A new stretch of n bases could be any of 4^n
// sequences; the template picks one. Colors: A green, T red, U purple, G amber, C blue; amber links = bonds made here;
// purple = pyrophosphate; teal = new sugars and the free 3'-OH.
(function () {
  var NEW = {DNA: "ACGTTGCA", RNA: "ACGUUGCA"}, PRIMER = "GC", PAIR = {A: "T", T: "A", U: "A", G: "C", C: "G"}, NEXT = "G";
  function counts(v) { var dna = v.molecule === "DNA"; return {bonds: dna ? v.n : v.n - 1, ppi: dna ? v.n : v.n - 1, seqs: Math.pow(4, v.n)}; }
  function big(x) { return x.toLocaleString("en-US"); }
  Viz.register("nucleic-acid-polymerization", {
    title: "Nucleic acid polymerization",
    subject: "biology",
    shows: "Add nucleotides to a growing DNA or RNA chain: each one joins the 3′ end by a phosphodiester bond and releases pyrophosphate, DNA needs a primer while RNA starts from scratch, and n bases can spell 4^n sequences",
    params: {
      molecule: {kind: "enum", values: ["DNA", "RNA"], default: "DNA", label: "\\text{chain}"},
      n: {kind: "integer", default: 3, min: 1, max: 8, label: "n\\ \\text{added}"}
    },
    formula: function (v) {
      var k = counts(v), n = v.n, p = PRIMER.length, seq = "\\\\ 4^{" + n + "}=" + big(k.seqs).replace(/,/g, "{,}") + "\\ \\text{possible sequences}\\end{array}";
      if (v.molecule === "DNA") return "\\begin{array}{l}\\text{primer}_{" + p + "}+" + n + "\\,\\text{dNTP}\\to\\text{chain}_{" + (p + n) + "}+" + n + "\\,\\text{PP}_i" + seq;
      return "\\begin{array}{l}" + n + "\\,\\text{NTP}\\to\\text{pppN" + (n > 1 ? "(pN)}_{" + (n - 1) + "}" : "}") + "+" + (n - 1) + "\\,\\text{PP}_i" + seq;
    },
    status: function (v) {
      var k = counts(v), n = v.n;
      if (v.molecule === "DNA") return "DNA polymerase extends the primer's 3′-OH: " + (n > 1 ? "each of the <b>" + n + "</b> dNTPs" : "the <b>one</b> dNTP") + " pairs with the template and joins by a phosphodiester bond that releases PPi, so the strand grows 5′ → 3′ by " + n + " nucleotide" + (n > 1 ? "s" : "") + ".";
      if (n === 1) return "RNA polymerase needs no primer: the first NTP sits on the template with its 5′ triphosphate, but <b>no bond</b> forms until a second NTP arrives.";
      return "RNA polymerase needs no primer: the first NTP keeps its 5′ triphosphate and " + (n > 2 ? "each of the other " + (n - 1) : "the second") + " joins by a phosphodiester bond, so " + n + " NTPs make <b>" + k.bonds + "</b> bond" + (k.bonds > 1 ? "s" : "") + " and release " + k.ppi + " PPi.";
    },
    examples: [
      {name: "DNA: one nucleotide on a primer (minimum)", values: {molecule: "DNA", n: 1}},
      {name: "DNA: eight added (maximum)", values: {molecule: "DNA", n: 8}},
      {name: "RNA: a single NTP, no bond yet", values: {molecule: "RNA", n: 1}},
      {name: "RNA: eight NTPs, seven bonds", values: {molecule: "RNA", n: 8}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, dna = v.molecule === "DNA", n = v.n, P = 32, yS = 80, yB = 112, yT = 144, yTB = 166;
      var bc = function (b) { return {A: c.c4, T: c.c5, U: c.c6, G: c.c3, C: c.c2}[b]; };
      var chain = (dna ? PRIMER : "") + NEW[v.molecule].slice(0, n), first = dna ? PRIMER.length : 0, x0 = dna ? 28 : 58;
      var X = function (i) { return x0 + i * P; };
      var sugar = function (x, col, op) {
        var pts = []; for (var a = 0; a < 5; a++) { var t = (-90 + a * 72) * Math.PI / 180; pts.push([x + 9.5 * Math.cos(t), yS + 9.5 * Math.sin(t)]); }
        api.polygon(pts, {fill: col, fillOpacity: op, stroke: col, width: 1.5});
      };
      var phos = function (at, col, op) { api.circle(at, 7.5, {fill: col, fillOpacity: op, stroke: col, width: 1.3}); api.label([at[0], at[1] + 0.5], "P", {color: c.ink, size: 12, weight: 700, anchor: "middle"}); };
      var nt = function (x, b, op, dash) { api.rect(x - 9, yB - 10, 18, 20, {fill: bc(b), fillOpacity: op, rx: 3, stroke: dash ? bc(b) : null, dash: dash ? "3 2" : null, width: 1.2}); api.label([x, yB + 0.5], b, {color: op < 0.5 ? c.ink : c.card, size: 12.5, weight: 800, anchor: "middle"}); };
      api.label([10, 14], dna ? "DNA polymerase extends a primer, 5′ → 3′" : "RNA polymerase starts a new chain, 5′ → 3′", {color: c.muted, size: 12});
      // template strand underneath, running 3' -> 5'
      var last = X(chain.length - 1), nx = X(chain.length) + 14, ax = (last + nx) / 2;
      api.line([12, yTB], [388, yTB], {color: c.faint, width: 3});
      api.label([12, yTB + 15], "3′", {color: c.muted, size: 12}); api.label([388, yTB + 15], "5′", {color: c.muted, size: 12, anchor: "end"});
      api.label([200, yTB + 15], "template strand (DNA)", {color: c.muted, size: 12, anchor: "middle"});
      for (var j = 0; j <= chain.length; j++) {
        var tx = j < chain.length ? X(j) : nx, tb = PAIR[j < chain.length ? chain[j] : NEXT];
        api.line([tx, yT + 10], [tx, yTB], {color: c.faint, width: 1.4});
        api.rect(tx - 9, yT - 10, 18, 20, {fill: c.ink, fillOpacity: 0.07, stroke: c.faint, width: 1, rx: 3});
        api.label([tx, yT + 0.5], tb, {color: c.muted, size: 12.5, weight: 700, anchor: "middle"});
        [-3, 3].forEach(function (o) { api.line([tx + o, yB + 11], [tx + o, yT - 11], {color: c.muted, width: 1, dash: "2 2"}); });
      }
      // the 5' end: a primer (DNA) or the first NTP's triphosphate (RNA)
      if (dna) {
        api.label([X(0) - 13, yS - 16], "5′", {color: c.muted, size: 12.5, weight: 700, anchor: "end"});
        api.label([(X(0) + X(first - 1)) / 2, yS - 24], "primer", {color: c.muted, size: 12, weight: 650, anchor: "middle"});
      } else {
        [0, 1, 2].forEach(function (k) { phos([X(0) - 17 - k * 15, yS], c.c1, 0.15); });
        api.label([X(0) - 32, yS - 20], "5′ ppp", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      }
      // the chain: sugars, the phosphates joining them, bases paired to the template
      for (var i = 0; i < chain.length; i++) {
        var isNew = i >= first, b = chain[i];
        if (i > 0) {
          var made = i >= first;
          api.line([X(i - 1) + 9, yS], [X(i) - 9, yS], {color: made ? c.c3 : c.muted, width: made ? 3 : 2});
          phos([X(i) - P / 2, yS], made ? c.c3 : c.muted, made ? 0.4 : 0.15);
        }
        sugar(X(i), isNew ? c.c1 : c.muted, isNew ? 0.25 : 0.12);
        api.line([X(i), yS + 9.5], [X(i), yB - 10], {color: isNew ? c.ink : c.muted, width: 1.4});
        nt(X(i), b, isNew ? 0.9 : 0.3, false);
      }
      // the free 3'-OH and the next nucleotide arriving with its triphosphate
      api.label([last + 6, yS + 20], "3′-OH", {color: c.c1, size: 12, weight: 700});
      sugar(nx, c.c1, 0.08);
      api.line([nx, yS + 9.5], [nx, yB - 10], {color: c.faint, width: 1.4});
      nt(nx, NEXT, 0.35, true);
      phos([ax, yS], c.c3, 0.15);
      api.line([ax, yS - 7], [ax, yS - 15], {color: c.c6, width: 1.6});
      phos([ax, yS - 22], c.c6, 0.35); phos([ax, yS - 37], c.c6, 0.35);
      if (ax < 220) api.label([ax + 12, yS - 40], "PPi leaves", {color: c.c6, size: 12, weight: 650});
      else api.label([ax - 12, yS - 30], "PPi leaves", {color: c.c6, size: 12, weight: 650, anchor: "end"});
      api.label([nx + 2, yS - 19], "next", {color: c.muted, size: 12, anchor: "middle"});
      // tallies
      var k = counts(v), rows = [[dna ? "dNTPs added" : "NTPs used", n, c.c1], ["bonds formed", k.bonds, c.c3], ["PPi released", k.ppi, c.c6]];
      rows.forEach(function (r, ri) {
        var y = 210 + ri * 24;
        api.label([10, y], r[0], {color: r[2], size: 12.5, weight: 650});
        for (var t = 0; t < 8; t++) api.rect(124 + t * 21, y - 8, 17, 16, t < r[1] ? {fill: r[2], fillOpacity: 0.85, rx: 3} : {stroke: c.faint, width: 1, dash: "2 2", rx: 3});
        api.label([124 + 8 * 21 + 8, y], String(r[1]), {color: r[2], size: 13, weight: 750});
      });
      api.label([10, 286], "the template picks 1 of 4^" + n + " = " + big(k.seqs) + " possible sequences", {color: c.muted, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
