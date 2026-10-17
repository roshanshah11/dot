// The ribosome's three tRNA sites during one elongation cycle, drawn in the ribosome's frame (the ribosome stays put and
// the mRNA slides through it, which is the same relative motion as the ribosome walking 5'->3'). A (aminoacyl) site:
// a charged tRNA whose anticodon matches the codon there enters. P (peptidyl) site: holds the tRNA carrying the growing
// chain; the large subunit's rRNA (peptidyl transferase) moves the whole chain onto the A-site amino acid. E (exit) site:
// after translocation shifts everything one codon (3 nt), the now-empty tRNA sits here and then leaves. Cycle c decodes
// codon c + 1 of a fixed reading frame, so the chain holds c amino acids at the start and c + 1 after the peptide bond.
(function () {
  var CODONS = ["AUG", "UUC", "GGA", "AAG", "CUG", "UGG", "CAU", "GCC", "UAA"];
  var AA = ["Met", "Phe", "Gly", "Lys", "Leu", "Trp", "His", "Ala", "stop"], PAIR = {A: "U", U: "A", G: "C", C: "G"};
  function model(v) {
    var c = v.cycle, s = v.step || 1, p = s === 3 ? c + 1 : c;            // codon (1-based) under the P site
    var chainOn = s === 1 ? "P" : s === 2 ? "A" : "P", chain = AA.slice(0, s === 1 ? c : c + 1);
    var trna = {};                                                          // which codon's tRNA sits in each site
    if (s === 1) { trna.P = c; trna.A = c + 1; if (c > 1) trna.leaving = c - 1; }
    if (s === 2) { trna.P = c; trna.A = c + 1; }
    if (s === 3) { trna.E = c; trna.P = c + 1; }
    var cod = function (j) { return j >= 1 && j <= CODONS.length ? CODONS[j - 1] : "···"; };
    return {c: c, s: s, p: p, chain: chain, chainOn: chainOn, trna: trna, E: cod(p - 1), P: cod(p), A: cod(p + 1), next: p + 1};
  }
  function anti(codon) { return codon.split("").map(function (b) { return PAIR[b]; }).join(""); }
  Viz.register("ribosome-a-p-e-sites", {
    title: "The ribosome's A, P and E sites",
    subject: "biology",
    shows: "Step one elongation cycle: a tRNA enters the A site, the chain jumps onto its amino acid, then translocation shifts every tRNA one site (A to P to E) and opens the A site again",
    params: {
      cycle: {kind: "integer", default: 2, min: 1, max: 7, label: "\\text{cycle}"}
    },
    steps: ["a charged tRNA enters the A site", "peptide bond: chain moves to the A-site tRNA", "translocation: A → P → E"],
    stepMs: 1800,
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{l}E\\,|\\,P\\,|\\,A:\\ \\texttt{" + m.E + "}\\,|\\,\\texttt{" + m.P + "}\\,|\\,\\texttt{" + m.A + "}\\\\" +
        "\\text{chain: " + (m.chain.length > 6 ? m.chain.slice(0, 2).join("-") + "-…-" + m.chain.slice(-2).join("-") : m.chain.join("-")) + "}\\ (" + m.chain.length + "\\text{ aa)}\\end{array}";
    },
    status: function (v) {
      var m = model(v), c = m.c, s = m.s;
      if (s === 1) return "The tRNA whose anticodon pairs with <b>" + CODONS[c] + "</b> brings <b>" + AA[c] + "</b> into the A site, beside the P-site tRNA holding " +
        (c === 1 ? "Met" : "the " + c + "-amino-acid chain") + (c > 1 ? ", while the empty tRNA in the E site leaves." : ".");
      if (s === 2) return "The large subunit's rRNA joins " + AA[c - 1] + " to " + AA[c] + ": the whole chain, now <b>" + (c + 1) + " amino acids</b>, hangs on the A-site tRNA and the P-site tRNA is empty.";
      var nx = CODONS[c + 1];
      return "Everything shifts one codon: the chain's tRNA moves to <b>P</b>, the empty one to <b>E</b>, and codon <b>" + nx + "</b> opens in the A site" +
        (nx === "UAA" ? ", a stop codon, so a release factor comes next." : ", ready for cycle " + (c + 1) + ".");
    },
    examples: [
      {name: "first cycle: Met in P", values: {cycle: 1, step: 1}},
      {name: "peptide bond, cycle 3", values: {cycle: 3, step: 2}},
      {name: "last cycle: stop codon opens", values: {cycle: 7, step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), SX = {E: 140, P: 200, A: 260}, yCod = 240, yAnti = 218;
      var codX = function (j) { return SX.P + (j - m.p) * 60; };
      // the ribosome: large subunit above the mRNA, small subunit below it
      api.rect(96, 82, 208, 140, {rx: 44, fill: c.muted, fillOpacity: 0.12, stroke: c.faint, width: 1.2});
      api.rect(104, 228, 192, 38, {rx: 18, fill: c.muted, fillOpacity: 0.12, stroke: c.faint, width: 1.2});
      api.label([90, 96], "large", {color: c.muted, size: 12, anchor: "end"});
      api.label([90, 110], "subunit", {color: c.muted, size: 12, anchor: "end"});
      api.label([98, 270], "small subunit", {color: c.muted, size: 12, anchor: "end"});
      ["E", "P", "A"].forEach(function (k) {
        api.rect(SX[k] - 26, 96, 52, 112, {rx: 10, fill: c.ink, fillOpacity: 0.03, stroke: c.faint, width: 1, dash: "3 4"});
        api.label([SX[k], 258], k, {color: k === "A" ? c.c2 : k === "P" ? c.c4 : c.muted, size: 13, weight: 700, anchor: "middle"});
      });
      api.label([200, 291], "E exit   ·   P peptidyl-tRNA   ·   A aminoacyl-tRNA", {color: c.muted, size: 12, anchor: "middle"});
      // the mRNA, 5' left, sliding through
      api.line([14, yCod + 10], [386, yCod + 10], {color: c.c3, width: 2.5});
      api.label([16, yCod - 4], "5′", {color: c.c3, size: 12, weight: 650});
      api.label([384, yCod - 4], "3′", {color: c.c3, size: 12, weight: 650, anchor: "end"});
      for (var j = 0; j <= CODONS.length; j++) {
        var x = codX(j); if (x < 40 || x > 360) continue;
        var t = j === 0 ? "···" : CODONS[j - 1], inA = j === m.p + 1;
        if (j === 0) { api.label([x, yCod], t, {color: c.c3, size: 13, anchor: "middle"}); continue; }
        t.split("").forEach(function (b, i) { api.label([x + (i - 1) * 12, yCod], b, {color: c.c3, size: 13, weight: 700, anchor: "middle", opacity: x < 110 || x > 290 ? 0.55 : 1}); });
        if (inA && !m.trna.A) api.rect(x - 22, yCod - 11, 44, 22, {rx: 5, stroke: t === "UAA" ? c.c5 : c.ink, width: 1.3, dash: "4 3"});
      }
      // a tRNA: stem, body, anticodon over its codon
      function trna(j, site, o) {
        o = o || {};
        var x = SX[site] + (o.dx || 0), dy = o.dy || 0, g = api.group({opacity: o.fade ? 0.4 : 1});
        api.rect(x - 4, 136 + dy, 8, 24, {rx: 3, fill: c.c2, fillOpacity: 0.85, parent: g});
        api.rect(x - 19, 158 + dy, 38, 46, {rx: 11, fill: c.c2, fillOpacity: 0.2, stroke: c.c2, width: 1.6, parent: g});
        anti(CODONS[j - 1]).split("").forEach(function (b, i) {
          api.label([x + (i - 1) * 12, yAnti + dy], b, {color: c.c2, size: 12.5, weight: 700, anchor: "middle", parent: g});
          if (!dy) api.line([x + (i - 1) * 12, 225], [x + (i - 1) * 12, 231], {color: c.ink, width: 1.2, opacity: 0.6, parent: g});
        });
        return [x, 128 + dy];
      }
      // the chain: newest amino acid on the tRNA, older ones threading up the exit tunnel and out
      function chain(at, names) {
        var track = [[at[0], at[1]], [at[0], 104], [200, 82], [200, 32], [10, 32]], pts = [[at[0], at[1]]];
        for (var k = 0; k < track.length - 1 && pts.length < names.length; k++) {   // walk the track in 1 px steps; a new pill goes
          var a = track[k], b = track[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);   // where it no longer overlaps the last one
          for (var d = 1; d <= L && pts.length < names.length; d++) {
            var q = [a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L], last = pts[pts.length - 1];
            if (Math.max(Math.abs(q[0] - last[0]) / 38, Math.abs(q[1] - last[1]) / 24) >= 1) pts.push(q);
          }
        }
        var order = names.slice().reverse();   // order[0] = newest, sits on the tRNA
        for (var i = 1; i < pts.length; i++) api.line(pts[i - 1], pts[i], {color: i === 1 && m.s === 2 ? c.c6 : c.c4, width: i === 1 && m.s === 2 ? 3.5 : 2.5});
        pts.forEach(function (q, i) {
          api.rect(q[0] - 17, q[1] - 10, 34, 20, {rx: 10, fill: c.card});
          api.rect(q[0] - 17, q[1] - 10, 34, 20, {rx: 10, fill: c.c4, fillOpacity: 0.25, stroke: c.c4, width: 1.5});
          api.label(q, order[i], {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        });
        return pts;
      }
      if (m.trna.leaving) { trna(m.trna.leaving, "E", {fade: true, dx: -26, dy: -30}); api.label([88, 150], "leaves", {color: c.muted, size: 12, anchor: "end"}); }
      if (m.trna.E) trna(m.trna.E, "E", {});
      var P = trna(m.trna.P, "P", {}), A = m.trna.A ? trna(m.trna.A, "A", {}) : null;
      if (m.s === 1) {
        chain(P, m.chain);
        api.rect(A[0] - 17, A[1] - 10, 34, 20, {rx: 10, fill: c.card});
        api.rect(A[0] - 17, A[1] - 10, 34, 20, {rx: 10, fill: c.c4, fillOpacity: 0.25, stroke: c.c4, width: 1.5});
        api.label(A, AA[m.c], {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      }
      if (m.s === 2) {
        var pts = chain(A, m.chain);
        if (pts.length > 1) api.label([(pts[0][0] + pts[1][0]) / 2 + 26, (pts[0][1] + pts[1][1]) / 2 - 2], "new bond", {color: c.c6, size: 12, weight: 650});
        api.label([P[0], P[1] + 4], "empty", {color: c.muted, size: 12, anchor: "middle"});
      }
      if (m.s === 3) {
        chain(P, m.chain);
        api.label([SX.A, 150], m.A === "UAA" ? "stop" : "open", {color: m.A === "UAA" ? c.c5 : c.muted, size: 12.5, weight: 650, anchor: "middle"});
        api.arrow([376, 200], [326, 200], {color: c.c3, width: 2, halo: false, head: 8});   // the ribosome's frame: the mRNA slides toward 5'
        api.label([352, 168], "mRNA slides", {color: c.c3, size: 12, anchor: "middle"});
        api.label([352, 184], "one codon", {color: c.c3, size: 12, anchor: "middle"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
