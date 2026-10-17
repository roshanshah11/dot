// One model gene, three optional (cassette) exons, eight possible mRNAs and the proteins they encode. Coding lengths:
// exon 1 150 nt (start codon, 50 aa), exon 2 90 nt (30 aa, binding site), exon 3 100 nt, exon 4 75 nt (25 aa,
// regulatory site), exon 5 243 nt (80 aa + stop, catalytic domain). An exon whose length is a multiple of 3 keeps the
// reading frame; exon 3 (100 = 3*33 + 1) shifts everything after it by one nucleotide. In this model the shifted frame
// meets a stop codon 3 codons into exon 4 or 6 codons into exon 5. A premature stop more than 50-55 nt before the last
// exon-exon junction marks the mRNA for nonsense-mediated decay (NMD); one in the last exon escapes it, so a truncated
// protein is made. The protein bar sits under the codons that encode it (1 aa = 3 nt).
(function () {
  var EX = {1: [150, "N-term"], 2: [90, "binding"], 3: [100, "linker"], 4: [75, "reg."], 5: [243, "catalytic"]}, WRONG = {4: 3, 5: 6};
  function iso(e2, e3, e4) {
    var ids = [1].concat(e2 ? [2] : [], e3 ? [3] : [], e4 ? [4] : [], [5]), off = 0, segs = [], r = {ids: ids, shift: e3, segs: segs};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], L = EX[id][0];
      segs.push({id: id, nt0: off, nt: L});
      if (e3 && id === 3) {
        var nxt = ids[i + 1], w = WRONG[nxt];
        r.aa = (off + 99) / 3 + w; r.wrong = [off + 99, 3 * w]; r.stopNt = off + 99 + 3 * w; r.stopExon = nxt; r.nmd = nxt === 4;
        r.cut = off + L; off += L; segs.push({id: nxt, nt0: off, nt: EX[nxt][0]});
        if (nxt === 4) segs.push({id: 5, nt0: off + EX[4][0], nt: EX[5][0]});
        return r;
      }
      off += L;
    }
    r.aa = off / 3 - 1; r.stopNt = off - 3;
    return r;
  }
  function ins(v) { return [v.e2 ? 90 : 0, v.e3 ? 100 : 0, v.e4 ? 75 : 0].filter(function (x) { return x; }); }

  Viz.register("alternative-rna-splicing-protein-isoforms", {
    title: "Splicing makes protein isoforms",
    subject: "biology",
    shows: "Switch the three optional exons on and off: in-frame exons add or remove protein domains, while an exon whose length is not a multiple of 3 shifts the reading frame into an early stop codon",
    params: {
      e2: {kind: "boolean", default: true, label: "\\text{exon 2}", on: "included", off: "skipped"},
      e3: {kind: "boolean", default: false, label: "\\text{exon 3}", on: "included", off: "skipped"},
      e4: {kind: "boolean", default: true, label: "\\text{exon 4}", on: "included", off: "skipped"}
    },
    formula: function (v) {
      var a = ins(v), s = a.reduce(function (p, q) { return p + q; }, 0), r = iso(v.e2, v.e3, v.e4);
      var d = "\\Delta = " + (a.length ? a.join("+") + (a.length > 1 ? " = " + s : "") : "0") + "\\ \\text{nt}";
      d += "\\newline " + s + " \\bmod 3 = " + (s % 3) + (s % 3 ? " \\Rightarrow \\text{frameshift}" : " \\Rightarrow \\text{in frame}");
      return d + "\\newline \\text{protein: } " + (r.shift ? "\\text{stop after } " + r.aa : "\\tfrac{" + (r.stopNt + 3) + "}{3} - 1 = " + r.aa) + "\\ \\text{aa}";
    },
    status: function (v) {
      var r = iso(v.e2, v.e3, v.e4);
      if (r.nmd) return "Exon 3 (100 nt) shifts the frame, and a stop codon appears in exon 4, more than 50 nt before the last exon junction: <b>nonsense-mediated decay</b> destroys this mRNA, so little of the " + r.aa + " aa fragment is made.";
      if (r.shift) return "Exon 3 is 100 nt, not a multiple of 3, so the frame shifts: 6 wrong amino acids, then a stop in the last exon, giving " + (/^(8|11$|18$)/.test(String(r.aa)) ? "an" : "a") + " <b>" + r.aa + " aa</b> truncated protein with no catalytic domain.";
      var has = [v.e2 ? "the binding site" : "", v.e4 ? "the regulatory site" : ""].filter(Boolean);
      return "In frame: " + (/^(8|11$|18$)/.test(String(r.aa)) ? "an" : "a") + " <b>" + r.aa + " aa</b> isoform with " + (has.length ? has.join(" and ") + " plus " : "only ") + "the catalytic domain; 3 optional exons allow 2³ = 8 different mRNAs.";
    },
    examples: [
      {name: "minimum: all three skipped", values: {e2: false, e3: false, e4: false}},
      {name: "maximum: all three included (NMD)", values: {e2: true, e3: true, e4: true}},
      {name: "frameshift, truncated protein", values: {e2: true, e3: true, e4: false}},
      {name: "regulatory site only", values: {e2: false, e3: false, e4: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = 0.46, x0 = 56, r = iso(v.e2, v.e3, v.e4), on = {1: true, 2: v.e2, 3: v.e3, 4: v.e4, 5: true};
      var col = {1: c.muted, 2: c.c4, 3: c.c3, 4: c.c6, 5: c.c1};
      // ---- the gene ----
      var gx = x0;
      api.label([14, 30], "gene", {color: c.muted, size: 12});
      [1, 2, 3, 4, 5].forEach(function (id, i) {
        var w = EX[id][0] * k;
        if (i) { api.line([gx, 30], [gx + 8, 30], {color: c.muted, width: 1.5}); gx += 8; }
        api.rect(gx, 22, w, 16, {fill: col[id], fillOpacity: on[id] ? 0.9 : 0.18, stroke: on[id] ? null : col[id], dash: "3 3", width: 1, rx: 3});
        api.label([gx + w / 2, 30], String(id), {color: on[id] ? "#111" : col[id], size: 12, weight: 700, anchor: "middle"});
        api.label([gx + w / 2, 50], EX[id][0] + (id === 1 ? " nt" : ""), {color: id === 3 ? c.c3 : c.muted, size: 12, anchor: "middle"});
        gx += w;
      });
      // ---- the mRNA (coding part), frame-shifted stretch outlined in red ----
      var X = function (nt) { return x0 + nt * k; };
      api.label([14, 92], "mRNA", {color: c.muted, size: 12});
      r.segs.forEach(function (s) { api.rect(X(s.nt0), 84, s.nt * k, 16, {fill: col[s.id], fillOpacity: 0.9, rx: 2, stroke: c.card, width: 1}); });
      if (r.shift) {
        var endNt = r.segs[r.segs.length - 1].nt0 + r.segs[r.segs.length - 1].nt;
        api.rect(X(r.cut), 81, (endNt - r.cut) * k, 22, {stroke: c.c5, width: 1.8, dash: "4 3", rx: 3});
        api.label([X(r.cut) + 4, 72], "shifted frame", {color: c.c5, size: 12});
      }
      api.line([X(r.stopNt + 3), 78], [X(r.stopNt + 3), 106], {color: r.shift ? c.c5 : c.ink, width: 2.5});
      api.label([X(r.stopNt + 3) + (r.shift ? 0 : -2), 114], "stop", {color: r.shift ? c.c5 : c.ink, size: 12, anchor: r.shift ? "middle" : "end"});
      // ---- the protein, under its codons ----
      api.label([14, 140], "protein", {color: c.muted, size: 12});
      var faint = r.nmd ? 0.25 : 0.9;
      r.segs.forEach(function (s) {
        var lim = r.shift ? Math.min(s.nt0 + s.nt, r.wrong[0]) : Math.min(s.nt0 + s.nt, r.stopNt);
        if (lim <= s.nt0) return;
        api.rect(X(s.nt0), 133, (lim - s.nt0) * k, 14, {fill: col[s.id], fillOpacity: faint, rx: 2, stroke: c.card, width: 1});
        if ((lim - s.nt0) * k > 20 && !r.nmd) api.label([X((s.nt0 + lim) / 2), 160], EX[s.id][1], {color: col[s.id], size: 12, anchor: "middle"});
      });
      if (r.shift) api.rect(X(r.wrong[0]), 133, r.wrong[1] * k, 14, {fill: c.c5, fillOpacity: r.nmd ? 0.3 : 0.9, rx: 2});
      var pEnd = X(r.shift ? r.stopNt : r.stopNt);
      api.label([pEnd + 6, 140], r.aa + " aa" + (r.shift && !r.nmd ? ", truncated" : ""), {color: r.shift ? c.c5 : c.ink, size: 12.5, weight: 650});
      if (r.nmd) api.label([X(0), 172], "NMD destroys the mRNA: little protein is made", {color: c.c5, size: 12.5, weight: 650});
      // ---- all eight combinations ----
      api.line([10, 186], [390, 186], {color: c.grid, width: 1});
      api.label([14, 198], "all 8 mRNAs from 3 optional exons", {color: c.muted, size: 12});
      var n = 0;
      [0, 1].forEach(function (a2) { [0, 1].forEach(function (a3) { [0, 1].forEach(function (a4) {
        var q = iso(a2, a3, a4), cx = n < 4 ? 14 : 204, cy = 216 + (n % 4) * 20, cur = !!v.e2 === !!a2 && !!v.e3 === !!a3 && !!v.e4 === !!a4;
        if (cur) api.rect(cx - 4, cy - 9, 186, 18, {stroke: c.ink, width: 1.2, rx: 4});
        api.label([cx, cy], q.ids.join("-"), {color: cur ? c.ink : c.muted, size: 12});
        var bw = q.aa * 0.4, bc = q.shift ? c.c5 : c.c1;
        api.rect(cx + 64, cy - 4, bw, 8, {fill: q.nmd ? "none" : bc, fillOpacity: 0.85, stroke: q.nmd ? c.c5 : null, dash: q.nmd ? "3 2" : null, width: 1, rx: 2});
        api.label([cx + 68 + bw, cy], q.nmd ? "NMD" : q.aa + " aa", {color: q.shift ? c.c5 : cur ? c.ink : c.muted, size: 12});
        n++;
      }); }); });
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
