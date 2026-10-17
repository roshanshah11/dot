// A single-base substitution in the first codons of human beta-globin (HBB coding strand: ATG GTG CAC CTG ACT CCT GAG
// GAG AAG TCT = Met Val His Leu Thr Pro Glu Glu Lys Ser). Residues use the traditional numbering of the mature chain,
// whose initiator Met is removed, so the sickle-cell change GAG -> GTG is Glu6Val (HbS; HGVS counts from the ATG and
// calls it p.Glu7Val) and GAG -> AAG is Glu6Lys (HbC). The new codon is read with the standard genetic code: same amino
// acid = silent, another = missense, a stop = nonsense. A<->G and C<->T keep the base's class (purine or pyrimidine) and
// are transitions; the other eight changes are transversions. Side-chain classes: nonpolar GAVLIMFWP, polar STCYNQ,
// acidic DE, basic KRH; a missense change within a class is called conservative.
(function () {
  var CDS = "ATGGTGCACCTGACTCCTGAGGAGAAGTCT", B = "TCAG";
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var AA3 = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function cls(a) { return a === "*" ? "stop" : "GAVLIMFWP".indexOf(a) >= 0 ? "nonpolar" : "STCYNQ".indexOf(a) >= 0 ? "polar" : "DE".indexOf(a) >= 0 ? "acidic (−)" : "basic (+)"; }
  function purine(b) { return b === "A" || b === "G"; }
  function sub(v) {
    var i = 3 * v.res + (v.pos - 1), oc = CDS.substr(3 * v.res, 3), ob = CDS[i], nc = oc.slice(0, v.pos - 1) + v.base + oc.slice(v.pos);
    var oa = aa(oc), na = aa(nc);
    var kind = ob === v.base ? "none" : na === oa ? "silent" : na === "*" ? "nonsense" : "missense";
    var named = v.res === 6 && kind === "missense" ? (na === "V" ? "HbS, sickle-cell hemoglobin" : na === "K" ? "HbC hemoglobin" : null) : null;
    return {oc: oc, nc: nc, ob: ob, oa: oa, na: na, kind: kind, ts: purine(ob) === purine(v.base), named: named};
  }
  Viz.register("mutation-base-substitution", {
    title: "Base substitution: silent, missense or nonsense",
    subject: "biology",
    shows: "Change one base in the start of the beta-globin gene: the new codon may still code for the same amino acid, swap it for another (GAG to GTG gives the sickle-cell Glu6Val) or become a stop; and A-G or C-T swaps are transitions, the rest transversions",
    params: {
      res: {kind: "integer", default: 6, min: 1, max: 9, label: "\\text{residue}"},
      pos: {kind: "integer", default: 2, min: 1, max: 3, label: "\\text{position}"},
      base: {kind: "enum", values: ["A", "C", "G", "T"], default: "T", label: "\\text{new base}"}
    },
    formula: function (v) {
      var s = sub(v), kind = s.kind === "none" ? "no change" : s.kind + (s.kind === "missense" ? (cls(s.oa) === cls(s.na) ? ", conservative" : ", non-conservative") : "");
      return "\\text{codon } " + v.res + ":\\ \\texttt{" + s.oc + "}\\to\\texttt{" + s.nc + "}\\newline \\text{" + AA3[s.oa] + "}\\to\\text{" + AA3[s.na] + "}\\newline \\text{" + kind + "}";
    },
    status: function (v) {
      var s = sub(v), tt = s.ts ? "a transition" : "a transversion", ch = s.ob + "→" + v.base;
      if (s.kind === "none") return "Base " + v.pos + " of codon " + v.res + " is already " + v.base + ": <b>no mutation</b>.";
      if (s.kind === "silent") return "<b>Silent</b>: " + s.nc + " still codes for " + AA3[s.oa] + " (" + ch + " is " + tt + "); third bases are where the code's redundancy hides most changes.";
      if (s.kind === "nonsense") return "<b>Nonsense</b>: " + s.nc + " is a stop codon, so translation would end after <b>" + (v.res - 1) + "</b> residue" + (v.res === 2 ? "" : "s") + " of the 146-residue chain (" + ch + ", " + tt + ").";
      var same = cls(s.oa) === cls(s.na);
      return "<b>Missense</b>: " + AA3[s.oa] + v.res + AA3[s.na] + (s.named ? ", <b>" + s.named + "</b>" : "") + "; " + cls(s.oa) + " to " + cls(s.na) +
        (same ? ", a conservative swap" : ", a <b>non-conservative</b> swap") + " (" + ch + ", " + tt + ").";
    },
    examples: [
      {name: "sickle cell: GAG to GTG (Glu6Val)", values: {res: 6, pos: 2, base: "T"}},
      {name: "HbC: GAG to AAG (Glu6Lys)", values: {res: 6, pos: 1, base: "A"}},
      {name: "silent: Val1, GTG to GTA", values: {res: 1, pos: 3, base: "A"}},
      {name: "nonsense: Lys8, AAG to TAG", values: {res: 8, pos: 1, base: "T"}},
      {name: "last residue, last base (maximum)", values: {res: 9, pos: 3, base: "G"}},
      {name: "first residue, first base (minimum)", values: {res: 1, pos: 1, base: "A"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = sub(v), x0 = 22, cw = 36, lw = 9, KC = {silent: c.c4, missense: c.c3, nonsense: c.c5, none: c.muted}[s.kind];
      api.label([x0 - 4, 16], "β-globin (HBB) coding strand, codons 1–10", {color: c.muted, size: 12, weight: 600});
      for (var q = 0; q < 10; q++) {
        var cod = CDS.substr(3 * q, 3), xc = x0 + q * cw + 1.5 * lw, sel = q === v.res;
        if (sel) api.rect(xc - 1.5 * lw - 3, 28, 3 * lw + 6, 52, {fill: KC, fillOpacity: 0.14, stroke: KC, width: 1.2, rx: 5});
        for (var b = 0; b < 3; b++) {
          var hit = sel && b === v.pos - 1;
          if (hit) api.rect(xc + (b - 1) * lw - 4.5, 31, 9, 16, {fill: c.c3, fillOpacity: 0.9, rx: 2});
          api.label([xc + (b - 1) * lw, 39.5], hit ? v.base : cod[b], {color: hit ? c.card : c.ink, size: 12.5, weight: 650, anchor: "middle"});
        }
        var a = sel ? s.na : aa(cod);
        api.label([xc, 58], AA3[a], {color: sel ? KC : c.muted, size: 12, weight: sel ? 700 : 500, anchor: "middle"});
        api.label([xc, 73], q === 0 ? "(start)" : String(q), {color: c.faint, size: 12, anchor: "middle"});
      }
      // zoom: old codon -> new codon, coding strand and mRNA
      var big = function (codon, x, y, mark, col) {
        for (var k = 0; k < 3; k++) {
          if (k === mark) api.rect(x + k * 22 - 10, y - 15, 20, 30, {fill: col, fillOpacity: 0.9, rx: 4});
          api.label([x + k * 22, y + 1], codon[k], {color: k === mark ? c.card : c.ink, size: 22, weight: 750, anchor: "middle"});
        }
      };
      var y = 122, mk = s.kind === "none" ? -1 : v.pos - 1;
      api.label([x0, 98], "DNA", {color: c.muted, size: 12});
      big(s.oc, 44, y, mk, c.faint);
      api.arrow([118, y], [152, y], {color: c.ink, width: 2, halo: false});
      big(s.nc, 176, y, mk, c.c3);
      api.label([66, y + 28], "mRNA " + s.oc.replace(/T/g, "U"), {color: c.muted, size: 12, anchor: "middle"});
      api.label([198, y + 28], "mRNA " + s.nc.replace(/T/g, "U"), {color: c.muted, size: 12, anchor: "middle"});
      api.label([66, y + 50], AA3[s.oa], {color: c.ink, size: 14, weight: 700, anchor: "middle"});
      api.label([198, y + 50], AA3[s.na], {color: KC, size: 14, weight: 700, anchor: "middle"});
      api.label([66, y + 67], cls(s.oa), {color: c.muted, size: 12, anchor: "middle"});
      api.label([198, y + 67], cls(s.na), {color: s.na === "*" ? c.c5 : c.muted, size: 12, anchor: "middle"});
      // purines on top, pyrimidines below: vertical edges are transitions, the rest transversions
      var P = {A: [300, 122], G: [366, 122], C: [300, 178], T: [366, 178]};
      api.label([333, 100], "purines", {color: c.muted, size: 12, anchor: "middle"});
      api.label([333, 204], "pyrimidines", {color: c.muted, size: 12, anchor: "middle"});
      var edges = [["A", "G"], ["C", "T"], ["A", "C"], ["G", "T"], ["A", "T"], ["G", "C"]];
      edges.forEach(function (e) {
        var on = s.kind !== "none" && ((e[0] === s.ob && e[1] === v.base) || (e[1] === s.ob && e[0] === v.base));
        var ts = purine(e[0]) === purine(e[1]);
        api.line(P[e[0]], P[e[1]], {color: on ? c.c3 : ts ? c.c2 : c.muted, width: on ? 3.5 : 1.2, opacity: on ? 1 : 0.45, dash: ts ? null : "4 3"});
      });
      Object.keys(P).forEach(function (k) {
        var isOld = k === s.ob, isNew = k === v.base && s.kind !== "none";
        api.circle(P[k], 13, {fill: isNew ? c.c3 : c.card, stroke: isOld || isNew ? c.c3 : c.muted, width: 1.8});
        api.label([P[k][0], P[k][1] + 0.5], k, {color: isNew ? c.card : c.ink, size: 13, weight: 750, anchor: "middle"});
      });
      // verdict
      var word = {none: "no change", silent: "silent", missense: "missense", nonsense: "nonsense"}[s.kind];
      api.rect(12, 222, 376, 66, {fill: KC, fillOpacity: 0.08, rx: 8});
      api.label([24, 242], word, {color: KC, size: 16, weight: 750});
      if (s.kind !== "none") api.label([376, 242], s.ob + " → " + v.base + ": " + (s.ts ? "transition" : "transversion"), {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      var line = s.kind === "none" ? "the codon is unchanged" : s.kind === "silent" ? "same amino acid, same protein"
        : s.kind === "nonsense" ? "stop at codon " + v.res + ": the chain ends after " + (v.res - 1) + " of 146"
        : (s.named ? s.named : AA3[s.oa] + v.res + AA3[s.na]) + (cls(s.oa) === cls(s.na) ? ": same side-chain class" : ": " + cls(s.oa) + " → " + cls(s.na));
      api.label([24, 268], line, {color: c.ink, size: 12.5});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
