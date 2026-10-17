// Point mutations in a short made-up gene (coding strand, 5' to 3'; 10 codons, the TAA stop, then 3' UTR), read
// with the standard genetic code. A substitution changes one codon: silent if it still codes for the same amino acid,
// missense if it codes for another, nonsense if it becomes a stop. An insertion or deletion of k bases shifts the reading
// frame downstream unless k is a multiple of 3: every later codon is read in the new frame, usually until a premature
// stop. Everything (codons, amino acids, the first stop, protein length) is translated live from the sequences.
(function () {
  var GENE = "ATGTCCTGGCAGCCTGTATCATTAAATAAATAA", UTR = "CCGCCATAC", B = "TCAG";
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var AA3 = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  function aa(cod) { return cod.length < 3 ? "" : CODE[16 * B.indexOf(cod[0]) + 4 * B.indexOf(cod[1]) + B.indexOf(cod[2])]; }
  function translate(seq) { // amino acids up to (not including) the first stop; stop = index of the stop codon or -1
    var p = "", i;
    for (i = 0; i + 3 <= seq.length; i += 3) { var a = aa(seq.substr(i, 3)); if (a === "*") return {p: p, stop: i / 3}; p += a; }
    return {p: p, stop: -1};
  }
  function mutate(v) {
    var full = GENE + UTR, i = v.pos, k = v.kind === "substitution" ? 1 : v.k, seq, marks = [];
    if (v.kind === "substitution") { seq = full.slice(0, i - 1) + v.base + full.slice(i); marks = [i - 1]; }
    else if (v.kind === "insertion") { var ins = new Array(k + 1).join(v.base); seq = full.slice(0, i) + ins + full.slice(i); for (var m = 0; m < k; m++) marks.push(i + m); }
    else seq = full.slice(0, i - 1) + full.slice(i - 1 + k);
    return {seq: seq, marks: marks, k: k};
  }
  function classify(v) {
    var o = translate(GENE), mu = mutate(v), t = translate(mu.seq), c = Math.ceil(v.pos / 3);
    var r = {o: o, m: t, mu: mu, codon: c, len: t.p.length, stopLost: t.stop < 0};
    if (v.kind === "substitution") {
      var oc = GENE.substr(3 * c - 3, 3), nc = mu.seq.substr(3 * c - 3, 3);
      r.oc = oc; r.nc = nc; r.oa = aa(oc); r.na = aa(nc);
      r.kind = oc === nc ? "none" : r.na === r.oa ? "silent" : r.na === "*" ? "nonsense" : "missense";
    } else r.kind = mu.k % 3 ? "frameshift" : "inframe";
    // which mutant amino acids differ: position by position after a frameshift; otherwise only the stretch between the
    // longest common start and the longest common end, so an in-frame insertion does not mark the shifted tail
    var ch = [], ostr = o.p + "*", mstr = t.p + (t.stop >= 0 ? "*" : ""), j;
    if (r.kind === "frameshift") for (j = 0; j < t.p.length; j++) ch.push(t.p[j] !== o.p[j]);
    else {
      var pre = 0, suf = 0;
      while (pre < Math.min(ostr.length, mstr.length) && ostr[pre] === mstr[pre]) pre++;
      while (suf < Math.min(ostr.length, mstr.length) - pre && ostr[ostr.length - 1 - suf] === mstr[mstr.length - 1 - suf]) suf++;
      for (j = 0; j < t.p.length; j++) ch.push(j >= pre && j < mstr.length - suf);
    }
    r.ch = ch; r.diff = ch.filter(Boolean).length;
    return r;
  }
  Viz.register("mutations", {
    title: "Mutations: substitutions and frameshifts",
    subject: "biology",
    shows: "Substitute, insert or delete bases anywhere in a short gene: one changed codon is silent, missense or nonsense, while inserting or deleting anything but a multiple of 3 bases shifts the reading frame and garbles everything downstream until a stop",
    params: {
      kind: {kind: "enum", values: ["substitution", "insertion", "deletion"], default: "insertion", label: "\\text{type}"},
      pos: {kind: "integer", default: 9, min: 4, max: 30, label: "\\text{base}\\ \\#"},
      base: {kind: "enum", values: ["A", "C", "G", "T"], default: "A", label: "\\text{new base}"},
      k: {kind: "integer", default: 1, min: 1, max: 3, label: "k\\ \\text{(indel)}"}
    },
    formula: function (v) {
      var r = classify(v), tail = "\\newline \\text{protein: }10\\to" + (r.stopLost ? "\\geq " : "") + r.len + "\\ \\text{aa}";
      if (v.kind === "substitution") return "\\text{codon " + r.codon + ": }\\texttt{" + r.oc + "}\\to\\texttt{" + r.nc + "}=\\text{" + AA3[r.oa] + "}\\to\\text{" + AA3[r.na] + "}" + tail;
      var k = r.mu.k;
      return "k=" + k + ",\\ \\ " + k + "\\bmod 3=" + (k % 3) + (k % 3 ? "\\neq 0\\Rightarrow\\text{frameshift}" : "\\Rightarrow\\text{frame kept}") + tail;
    },
    status: function (v) {
      var r = classify(v), len = "<b>" + r.len + " aa</b>";
      var end = r.stopLost ? "; no stop appears in this stretch, so the ribosome reads on past the old stop codon." : ", stopping at codon " + (r.m.stop + 1) + " with a protein of " + len + " instead of 10.";
      switch (r.kind) {
        case "none": return "That base is already " + v.base + ": <b>no mutation</b>, the protein is the normal 10 amino acids.";
        case "silent": return "<b>Silent</b>: " + r.oc + " and " + r.nc + " both code for " + AA3[r.oa] + ", so the protein is unchanged; the genetic code's redundancy absorbs it.";
        case "missense": return "<b>Missense</b>: codon " + r.codon + " now reads " + AA3[r.na] + " instead of " + AA3[r.oa] + "; the protein keeps all 10 amino acids but one is different.";
        case "nonsense": return "<b>Nonsense</b>: codon " + r.codon + " becomes the stop " + r.nc + ", so translation ends after " + len + " instead of 10.";
        case "frameshift": return "<b>Frameshift</b>: " + (v.kind === "insertion" ? "inserting " : "deleting ") + r.mu.k + " base" + (r.mu.k > 1 ? "s" : "") + " shifts every later codon, so <b>" + r.diff + "</b> amino acids come out different" + end;
        default: return "<b>In frame</b>: " + (v.kind === "insertion" ? "inserting" : "deleting") + " 3 bases " + (v.kind === "insertion" ? "adds" : "removes") + " one codon's worth and the frame downstream is kept" + end;
      }
    },
    examples: [
      {name: "frameshift: insert A after base 9", values: {kind: "insertion", pos: 9, base: "A", k: 1}},
      {name: "silent: TCC to TCT", values: {kind: "substitution", pos: 6, base: "T"}},
      {name: "missense: Pro to Ser", values: {kind: "substitution", pos: 13, base: "T"}},
      {name: "nonsense: TGG to TAG", values: {kind: "substitution", pos: 8, base: "A"}},
      {name: "in-frame deletion of 3 at base 4 (minimum)", values: {kind: "deletion", pos: 4, k: 3}},
      {name: "deletion at base 30 (maximum) loses the stop", values: {kind: "deletion", pos: 30, k: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, r = classify(v), x0 = 18, cw = 30.5, lw = 8.5, NC = 12, orig = GENE + UTR, mut = r.mu.seq;
      var bx = function (i) { return x0 + Math.floor(i / 3) * cw + (i % 3) * lw + lw / 2; };   // center of base i (0-based)
      var row = function (seq, y, prot, marks, stopAt, label, isMut) {
        api.label([x0 - 4, y - 20], label, {color: c.muted, size: 12, weight: 600});
        for (var q = 0; q < NC; q++) {
          var cod = seq.substr(3 * q, 3), x = x0 + q * cw + 1.5 * lw;
          if (cod.length < 3) break;
          var after = stopAt >= 0 && q > stopAt, isStop = q === stopAt, a = aa(cod);
          var changed = isMut && !after && !isStop && !!r.ch[q];
          if (isStop) api.rect(x - 1.5 * lw - 2, y - 9, 3 * lw + 4, 18, {fill: c.c5, fillOpacity: 0.2, stroke: c.c5, width: 1, rx: 4});
          else if (changed) api.rect(x - 1.5 * lw - 2, y - 9, 3 * lw + 4, 18, {fill: c.c6, fillOpacity: 0.16, rx: 4});
          for (var b = 0; b < 3; b++) {
            var gi = 3 * q + b, hit = marks.indexOf(gi) >= 0;
            if (hit) api.rect(bx(gi) - 4.5, y - 8, 9, 16, {fill: c.c3, fillOpacity: 0.9, rx: 2});
            api.label([bx(gi), y + 0.5], cod[b], {color: hit ? c.card : after ? c.faint : c.ink, size: 12.5, weight: 650, anchor: "middle"});
          }
          var txt = after ? "·" : isStop ? "Stop" : AA3[a];
          api.label([x, y + 19], txt, {color: isStop ? c.c5 : after ? c.faint : changed ? c.c6 : c.muted, size: 12, weight: changed || isStop ? 700 : 500, anchor: "middle"});
        }
      };
      // deleted bases are struck out on the original row
      row(orig, 46, r.o.p, [], 10, "original (made-up gene, coding strand)", false);
      if (v.kind === "deletion") for (var d = 0; d < r.mu.k; d++) {
        var di = v.pos - 1 + d; api.rect(bx(di) - 4.5, 37, 9, 18, {fill: c.c5, fillOpacity: 0.35, rx: 2});
        api.line([bx(di) - 5, 46], [bx(di) + 5, 46], {color: c.c5, width: 2});
      }
      if (v.kind === "substitution") api.rect(bx(v.pos - 1) - 5, 37, 10, 18, {stroke: c.c3, width: 1.2, rx: 2});
      var what = v.kind === "substitution" ? "base " + v.pos + " → " + v.base : v.kind === "insertion" ? "insert " + new Array(r.mu.k + 1).join(v.base) + " after base " + v.pos : "delete " + r.mu.k + " from base " + v.pos;
      row(mut, 120, r.m.p, r.mu.marks, r.m.stop, "mutant: " + what, true);
      // frame ticks: where the reading frame stands after the change
      if (r.kind === "frameshift") {
        var fx = bx(v.kind === "insertion" ? v.pos : v.pos - 1) - lw / 2;
        api.line([fx, 108], [fx, 150], {color: c.c6, width: 1.2, dash: "3 3"});
        api.label([Math.min(fx + 6, 300), 160], "new reading frame →", {color: c.c6, size: 12, weight: 600});
      }
      // effect and protein length
      var names = {none: "no change", silent: "silent", missense: "missense", nonsense: "nonsense", frameshift: "frameshift", inframe: "in-frame " + v.kind};
      var col = {none: c.muted, silent: c.c4, missense: c.c3, nonsense: c.c5, frameshift: c.c6, inframe: c.c2}[r.kind];
      api.label([x0, 188], names[r.kind], {color: col, size: 15, weight: 750});
      var sx = 22, y1 = 222, y2 = 252, X0 = 92;
      api.label([x0, y1], "normal", {color: c.muted, size: 12});
      api.label([x0, y2], "mutant", {color: c.muted, size: 12});
      for (var j = 0; j < 11; j++) {
        if (j < 10) api.rect(X0 + j * sx, y1 - 8, sx - 3, 16, {fill: c.c2, fillOpacity: 0.55, rx: 3});
        if (j < r.len) api.rect(X0 + j * sx, y2 - 8, sx - 3, 16, {fill: r.ch[j] ? c.c6 : c.c2, fillOpacity: r.ch[j] ? 0.85 : 0.55, rx: 3});
      }
      api.label([X0 + 10 * sx + 4, y1], "10 aa", {color: c.c2, size: 12, weight: 650});
      if (r.len > 11) api.label([X0 + 11 * sx + 2, y2], "…", {color: c.c6, size: 13, weight: 700});
      api.label([X0 + Math.min(11, r.len) * sx + (r.len > 11 ? 16 : 4), y2], r.len + (r.stopLost ? "+" : "") + " aa", {color: r.len === 10 && !r.diff ? c.c2 : col, size: 12, weight: 650});
      api.label([x0, 284], "each block is one amino acid; purple = different from normal", {color: c.faint, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
