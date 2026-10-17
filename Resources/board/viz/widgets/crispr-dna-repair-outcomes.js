// What the cell does with a Cas9 double-strand break, read at the level of codons. NHEJ rejoins the ends and often
// gains or loses a few bases: unless the change is a multiple of 3, the reading frame shifts and a stop codon turns up
// (a knockout). HDR copies a donor template and writes exactly the planned change. The cut sits after nt 13, 3 bp from a
// PAM on the bottom strand (top-strand CCA at nt 8-10 reads 5'-TGG-3' there). Insertions duplicate the bases just 5' of
// the cut, the commonest NHEJ insertions. Every amino acid is translated live from the standard code.
(function () {
  var WT = "ATGGCTTCCAAGGAGCTGACTGATCACTTAGCTAAGGCCAGC", CUT = 13, B = "TCAG";
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met",
              T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "Stop"};
  function aa(cod) { return CODE.charAt(16 * B.indexOf(cod[0]) + 4 * B.indexOf(cod[1]) + B.indexOf(cod[2])); }
  function edited(v) {
    if (v.pathway === "HDR") return WT.slice(0, 12) + "GCG" + WT.slice(15);                       // codon 5 GAG -> GCG
    var k = v.indel;
    return k < 0 ? WT.slice(0, CUT) + WT.slice(CUT - k) : WT.slice(0, CUT) + WT.slice(CUT - k, CUT) + WT.slice(CUT);
  }
  function protein(seq, n) { var p = []; for (var i = 0; i < 3 * n; i += 3) p.push(aa(seq.substr(i, 3))); return p; }
  function summary(v) {
    var full = protein(WT, 14), a = full.slice(0, 10), seq = edited(v), b = protein(seq, 10), stop = b.indexOf("*");
    var shift = v.pathway !== "HDR" && Math.abs(v.indel) % 3 !== 0, changed, change = null;
    if (shift || v.pathway === "HDR") changed = b.map(function (x, j) { return x !== full[j]; });
    else {
      // in frame: line the old and new proteins up from both ends; whatever is left in the middle is the change
      var nb = protein(seq, Math.floor(seq.length / 3)), P = 0, S = 0, lim = Math.min(full.length, nb.length);
      while (P < lim && full[P] === nb[P]) P++;
      while (P + S < lim && full[full.length - 1 - S] === nb[nb.length - 1 - S]) S++;
      change = {at: P, old: full.slice(P, full.length - S), now: nb.slice(P, nb.length - S)};
      changed = b.map(function (x, j) { return j >= P && j < nb.length - S; });
    }
    return {a: a, b: b, stop: stop, first: changed.indexOf(true), shift: shift, changed: changed, change: change};
  }
  function names(list) { return list.map(function (x) { return NAME[x]; }).join("-"); }
  function codons(at, n) { return n > 1 ? "codons " + (at + 1) + "-" + (at + n) : "codon " + (at + 1); }
  // the in-frame change in words, from the aligned proteins: [status phrase, pill phrase]
  function inFrame(ch) {
    var o = ch.old, w = ch.now, one = function (l) { return (l.length === 1 ? "one " : l.length + " residues, ") + names(l); };
    if (!o.length) return ["gains " + one(w) + " after codon " + ch.at, one(w) + " gained after codon " + ch.at];
    if (!w.length) return ["loses " + names(o) + " at " + codons(ch.at, o.length), names(o) + " lost at " + codons(ch.at, o.length)];
    return [names(o) + " at " + codons(ch.at, o.length) + (o.length > 1 ? " become " : " becomes ") + (w.length === 1 ? "one " : "") + names(w),
            names(o) + " at " + codons(ch.at, o.length) + " → " + names(w)];
  }
  Viz.register("crispr-dna-repair-outcomes", {
    title: "Repairing a Cas9 cut: NHEJ or HDR",
    subject: "biology",
    shows: "Choose the repair pathway and the NHEJ indel size: indels that aren't a multiple of 3 shift the reading frame into an early stop codon, while HDR writes in the donor's exact change",
    params: {
      pathway: {kind: "enum", values: ["NHEJ", "HDR"], default: "NHEJ", label: "\\text{repair}", names: {NHEJ: "NHEJ (no template)", HDR: "HDR (donor)"}},
      indel: {kind: "integer", default: -1, min: -4, max: 4, label: "\\Delta\\ \\text{bp}"}
    },
    formula: function (v) {
      if (v.pathway === "HDR") return "\\text{codon 5: GAG (Glu)} \\rightarrow \\text{GCG (Ala)}";
      var k = v.indel, m = Math.abs(k) % 3;
      if (!k) return "\\Delta = 0 \\Rightarrow \\text{site restored}";
      return "|" + (k > 0 ? "+" : "") + k + "| \\bmod 3 = " + m + " \\Rightarrow \\text{" + (m ? "frameshift" : "in frame") + "}";
    },
    status: function (v) {
      var s = summary(v), k = v.indel;
      if (v.pathway === "HDR") return "HDR copies the donor across the break, writing exactly the planned change, <b>Glu → Ala at codon 5</b>, and nothing else (Δbp applies only to NHEJ).";
      if (!k) return "Perfect rejoining restores the original sequence, so <b>Cas9 can cut it again</b> until an error sticks.";
      var what = (k < 0 ? "Losing " : "Gaining ") + Math.abs(k) + " bp";
      if (s.shift) return what + " shifts the reading frame: amino acids change from codon " + (s.first + 1) + " and a <b>stop at codon " + (s.stop + 1) + "</b> cuts the protein short (a knockout).";
      var ch = s.change, d = ch.now.length - ch.old.length, words = inFrame(ch)[0];
      if (!ch.old.length || !ch.now.length) return what + " keeps the frame: the protein <b>" + words + "</b> and is otherwise the same, so it may still work.";
      return what + " keeps the frame: <b>" + words + "</b>, so the protein is " + (Math.abs(d) === 1 ? "one residue" : Math.abs(d) + " residues") +
        (d < 0 ? " shorter" : " longer") + " with one change and may still work.";
    },
    examples: [
      {name: "1-bp deletion", values: {pathway: "NHEJ", indel: -1}},
      {name: "in-frame deletion", values: {pathway: "NHEJ", indel: -3}},
      {name: "perfect rejoining", values: {pathway: "NHEJ", indel: 0}},
      {name: "4-bp insertion", values: {pathway: "NHEJ", indel: 4}},
      {name: "HDR edit", values: {pathway: "HDR"}}
    ],
    size: [400, 252],
    draw: function (api, v) {
      var c = api.color, s = summary(v), seq = edited(v), hdr = v.pathway === "HDR", k = v.indel;
      var x0 = 14, w = 37.2, yA = 34, yB = 150;
      var ntX = function (i) { return x0 + Math.floor(i / 3) * w + w / 2 + ((i % 3) - 1) * 10; };   // i is 0-based
      var cutX = (ntX(CUT - 1) + ntX(CUT)) / 2;
      function row(y, sq, prot, mark) {
        for (var j = 0; j < 10; j++) {
          var after = !mark ? false : s.stop >= 0 && j > s.stop, isStop = prot[j] === "*", changed = mark && s.changed[j];
          var fill = isStop ? c.c5 : hdr && mark && changed ? c.c4 : changed ? c.c3 : c.ink;
          api.rect(x0 + j * w + 1.5, y, w - 3, 42, {fill: fill, fillOpacity: isStop ? 0.3 : changed ? 0.2 : j % 2 ? 0.05 : 0.09, rx: 5, opacity: after ? 0.35 : 1});
          for (var t = 0; t < 3; t++) {
            var i = j * 3 + t, ins = mark && !hdr && k > 0 && i >= CUT && i < CUT + k;
            // text colour is fixed by the stylesheet, so inserted bases get a tinted chip behind them
            if (ins) api.rect(ntX(i) - 5, y + 4, 10, 16, {fill: c.c5, fillOpacity: 0.4, stroke: c.c5, width: 1, rx: 3});
            api.label([ntX(i), y + 12], sq.charAt(i), {color: ins ? c.c5 : c.ink, size: 12, weight: ins ? 800 : 600, anchor: "middle", clamp: false, opacity: after ? 0.4 : 1});
          }
          api.label([x0 + j * w + w / 2, y + 30], after ? "–" : NAME[prot[j]], {color: isStop ? c.c5 : fill === c.ink ? c.muted : fill, size: 12, weight: 650, anchor: "middle", clamp: false});
        }
      }
      api.label([x0, yA - 12], "original gene", {color: c.muted, size: 12.5, weight: 600});
      row(yA, WT, s.a, false);
      api.line([cutX, yA - 6], [cutX, yA + 48], {color: c.c5, width: 2.5, dash: "4 3"});
      api.label([cutX + 6, yA - 12], "Cas9 cut", {color: c.c5, size: 12.5, weight: 650});
      var lab = hdr ? "after HDR" : !k ? "after NHEJ: perfect rejoining" : "after NHEJ: " + (k < 0 ? "−" : "+") + Math.abs(k) + " bp";
      api.label([x0, yB - 12], lab, {color: hdr ? c.c4 : k ? c.c5 : c.muted, size: 12.5, weight: 650});
      if (hdr) {
        // the donor: homology arms matching both sides of the cut, the planned change between them
        var yD = 104, l = ntX(3) - 5, e0 = ntX(12) - 6, e1 = ntX(14) + 6, r = ntX(26) + 5;
        api.line([l, yD], [e0, yD], {color: c.ink, width: 5, opacity: 0.55});
        api.line([e1, yD], [r, yD], {color: c.ink, width: 5, opacity: 0.55});
        api.line([e0, yD], [e1, yD], {color: c.c4, width: 7});
        api.label([(l + e0) / 2, yD - 13], "left arm", {color: c.muted, size: 12, anchor: "middle"});
        api.label([(e1 + r) / 2, yD - 13], "right arm", {color: c.muted, size: 12, anchor: "middle"});
        api.label([(e0 + e1) / 2, yD + 15], "donor: GCG", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      } else {
        api.arrow([cutX, yA + 54], [cutX, yB - 22], {color: k ? c.c5 : c.muted, width: 2.5, halo: false});
        api.label([cutX + 10, (yA + yB) / 2 + 6], k ? "ends joined with an error" : "ends joined cleanly", {color: k ? c.c5 : c.muted, size: 12});
      }
      row(yB, seq, s.b, true);
      if (!hdr && k < 0) api.label([cutX, yB - 1], "▾", {color: c.c5, size: 14, anchor: "middle", clamp: false});
      // the outcome, in one pill
      var out = hdr ? "exact edit: Glu → Ala at codon 5" : !k ? "same sequence: Cas9 can cut again" :
        s.shift ? "frameshift → stop at codon " + (s.stop + 1) + ": knockout" : "in frame: " + inFrame(s.change)[1];
      var col = hdr ? c.c4 : !k ? c.muted : s.shift ? c.c5 : c.c3, pw = out.length * 7 + 26;
      api.rect(200 - pw / 2, 216, pw, 26, {fill: col, fillOpacity: 0.16, stroke: col, width: 1.2, rx: 13});
      api.label([200, 229], out, {color: col, size: 12.5, weight: 700, anchor: "middle"});
    }
  });
})();
