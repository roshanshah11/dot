// Termination: no tRNA reads a stop codon, so a protein release factor takes the A site instead. In bacteria RF1 reads
// UAA and UAG and RF2 reads UAA and UGA; in eukaryotes eRF1 reads all three and arrives with the GTPase eRF3. The factor's
// GGQ loop reaches the peptidyl-transferase center and has water hydrolyze the ester bond holding the chain to the
// P-site tRNA, so the protein leaves with a free C-terminal COOH. Then the ribosome is recycled: in bacteria RF3-GTP
// removes RF1/RF2 and RRF with EF-G-GTP splits the 70S; in eukaryotes ABCE1 splits the 80S. The subunits, the mRNA and
// the empty tRNA come apart and can start again.
(function () {
  var READ = {bacterium: {UAA: ["RF1", "RF2"], UAG: ["RF1"], UGA: ["RF2"]}, eukaryote: {UAA: ["eRF1"], UAG: ["eRF1"], UGA: ["eRF1"]}};
  var ORF = ["AUG", "GCU", "AAA", "GGC", "UUC"], AFTER = ["GCA", "AAU"], PAIR = {A: "U", U: "A", G: "C", C: "G"};
  function rf(v) { var r = READ[v.cell][v.stop]; return r.join(" or "); }
  function chain(v) { return [v.cell === "bacterium" ? "fMet" : "Met", "Ala", "Lys", "Gly", "Phe"]; }

  Viz.register("translation-termination", {
    title: "Translation termination: releasing the protein",
    subject: "biology",
    shows: "Pick the stop codon and the cell, then step through: a release factor reads the stop codon, water cuts the finished chain off the tRNA and the ribosome comes apart",
    params: {
      stop: {kind: "enum", values: ["UAA", "UAG", "UGA"], default: "UAG", label: "\\text{stop}"},
      cell: {kind: "enum", values: ["bacterium", "eukaryote"], default: "bacterium", label: "\\text{cell}"}
    },
    steps: ["stop codon reaches the A site", "release factor binds", "water releases the chain", "ribosome splits"],
    stepMs: 1700,
    formula: function (v) {
      return "\\begin{array}{l}\\texttt{" + v.stop + "}\\text{ in A site}\\Rightarrow\\text{" + rf(v) + "}\\\\" +
        "\\text{(5 aa)-tRNA}+\\text{H}_2\\text{O}\\to\\text{5 aa}+\\text{tRNA}\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, bac = v.cell === "bacterium", r = READ[v.cell][v.stop];
      return ["Stop codon <b>" + v.stop + "</b> enters the A site, and no tRNA has an anticodon that pairs with it.",
        (bac ? (r.length > 1 ? "<b>RF1 or RF2</b> (both read UAA)" : "<b>" + r[0] + "</b>, which reads " + (r[0] === "RF1" ? "UAA and UAG" : "UAA and UGA") + ",")
             : "<b>eRF1</b>, which reads all three stops, arrives with eRF3·GTP and") + " fills the A site, shaped like a tRNA.",
        "The factor's GGQ loop has <b>water</b> cut the bond to the P-site tRNA, and the 5-amino-acid protein leaves with a free COOH end.",
        bac ? "RF3·GTP removes the release factor, then <b>RRF and EF-G·GTP</b> split the 70S ribosome; mRNA and tRNA fall away."
            : "<b>ABCE1</b> splits the 80S ribosome into 40S and 60S; the mRNA and the empty tRNA fall away."][s - 1];
    },
    examples: [
      {name: "UAA in bacteria", values: {stop: "UAA", cell: "bacterium", step: 2}},
      {name: "UGA in bacteria", values: {stop: "UGA", cell: "bacterium", step: 3}},
      {name: "eukaryote, recycled", values: {stop: "UAG", cell: "eukaryote", step: 4}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, bac = v.cell === "bacterium", nt = 14, cw = 3 * nt, P = 200, yM = 228, Ax = P + cw;
      var tag = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, anchor: "middle"}, o || {})); };
      var split = s === 4, up = split ? -8 : 0, dn = split ? 20 : 0;
      // ribosome: large subunit (lifts off at step 4) and small subunit (drops away)
      api.rect(P - cw * 1.5 - 14, 72 + up, cw * 3 + 28, yM - 88, {rx: 34, fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.3, dash: split ? "5 4" : null});
      api.rect(P - cw * 1.5 - 6, yM + 12 + dn, cw * 3 + 12, 28, {rx: 14, fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.3, dash: split ? "5 4" : null});
      ["E", "P", "A"].forEach(function (t, j) { tag([P + (j - 1) * cw, yM + 26 + dn], t, c.c6, {weight: 700}); });
      tag([P + cw * 1.5 + 12, yM + 26 + dn], split ? (bac ? "30S" : "40S") : "ribosome", c.c6, {anchor: "start"});
      if (split) {
        tag([P - cw * 1.5 - 20, 100], bac ? "50S" : "60S", c.c6, {anchor: "end", weight: 650});
        var ax = P + cw * 1.5 + 30;
        api.arrow([ax, 128], [ax, 100], {color: c.c6, width: 1.8, halo: false}); api.arrow([P - cw * 1.5 - 22, yM + 30], [P - cw * 1.5 - 22, yM + 50], {color: c.c6, width: 1.8, halo: false});
        tag([ax + 8, 160], bac ? "RRF + EF-G·GTP" : "ABCE1", c.c2, {anchor: "start", weight: 650}); tag([ax + 8, 176], "split it", c.c2, {anchor: "start"});
      }
      // mRNA: the last codons of the reading frame, the stop codon, then the 3' UTR
      api.line([12, yM + 8], [388, yM + 8], {color: c.c3, width: 2.5, opacity: 0.7});
      tag([12, yM - 6], "5′", c.c3, {anchor: "start", weight: 650}); tag([388, yM - 6], "3′", c.c3, {anchor: "end", weight: 650});
      ORF.concat([v.stop]).concat(AFTER).forEach(function (cod, i) {
        var cx = P + (i - 4) * cw; if (cx < 40 || cx > 362) return;
        cod.split("").forEach(function (b, j) { tag([cx + (j - 1) * nt, yM], b, i === 5 ? c.c5 : c.c3, {weight: i === 5 ? 800 : 700}); });
      });
      if (!split) tag([Ax, yM + 56], "stop", c.c5, {weight: 650});
      // the P-site tRNA (Phe), its anticodon paired with UUC until the ribosome splits
      var g = api.group({opacity: split ? 0.45 : 1}), ty = split ? -40 : 0;
      api.rect(P - 4, 120 + ty, 8, 18, {rx: 3, fill: c.c1, fillOpacity: 0.85, parent: g});
      api.rect(P - 18, 136 + ty, 36, 50, {rx: 10, fill: c.c1, fillOpacity: 0.2, stroke: c.c1, width: 1.5, parent: g});
      "AAG".split("").forEach(function (b, j) {
        api.label([P + (j - 1) * nt, 196 + ty], b, {color: c.c1, size: 12.5, weight: 700, anchor: "middle", parent: g});
        if (!split) api.line([P + (j - 1) * nt, 204], [P + (j - 1) * nt, yM - 8], {color: c.ink, width: 1.3, opacity: 0.7, parent: g});
      });
      if (split) tag([P - 26, 120], "empty tRNA", c.muted, {anchor: "end"});
      // the chain: on the tRNA until step 3, then free with its COOH end
      var names = chain(v), freed = s >= 3;
      var base = freed ? [214, 30] : [P, 120];
      var pts = names.map(function (n, j) { var r = names.length - 1 - j; return freed ? [base[0] - 38 * r, base[1]] : [base[0] - 26 * r, base[1] - 12 - 21 * r]; });
      for (var j = 1; j < pts.length; j++) api.line(pts[j - 1], pts[j], {color: c.c4, width: 2.5});
      pts.forEach(function (q, j) {
        api.rect(q[0] - 17, q[1] - 10, 34, 20, {rx: 10, fill: c.card});
        api.rect(q[0] - 17, q[1] - 10, 34, 20, {rx: 10, fill: c.c4, fillOpacity: 0.25, stroke: c.c4, width: 1.5});
        tag(q, names[j], c.ink, {weight: 650});
      });
      if (freed) { tag([base[0] + 22, base[1]], "COOH", c.c4, {anchor: "start", weight: 700}); tag([pts[0][0] - 20, base[1]], "H₂N", c.c4, {anchor: "end", weight: 700, raw: true}); tag([138, 52], "free protein, 5 aa", c.c4); }
      // A site: empty at step 1, the release factor at 2-3, gone at 4
      if (s === 1) {
        api.rect(Ax - 21, yM - 12, 42, 24, {rx: 5, stroke: c.c5, width: 1.4, dash: "4 3"});
        tag([Ax + 30, 150], "no tRNA", c.c5, {anchor: "start", weight: 650}); tag([Ax + 30, 166], "pairs with " + v.stop, c.c5, {anchor: "start"});
      }
      if (s === 2 || s === 3) {
        var name = READ[v.cell][v.stop][0];
        api.path("M " + (Ax - 15) + " " + (yM - 14) + " L " + (Ax - 15) + " 150 Q " + (Ax - 15) + " 128 " + (P + 10) + " 124 L " + (P + 14) + " 136 Q " + (Ax + 15) + " 146 " + (Ax + 15) + " 160 L " + (Ax + 15) + " " + (yM - 14) + " Z",
          {fill: c.c5, fillOpacity: 0.25, stroke: c.c5, width: 1.5});
        tag([Ax, 180], READ[v.cell][v.stop].length > 1 ? "RF1/2" : name, c.c5, {weight: 700});
        tag([P + 36, 128], "GGQ", c.c5, {anchor: "start", weight: 650});
        tag([Ax + 30, 196], "reads " + v.stop, c.c5, {anchor: "start"});
        if (!bac) { api.rect(Ax + 34, 120, 48, 30, {rx: 10, fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.3}); tag([Ax + 58, 129], "eRF3", c.c2, {weight: 650}); tag([Ax + 58, 143], "GTP", c.c2); }
        if (s === 3) { tag([P - 30, 100], "H₂O", c.c2, {anchor: "end", weight: 700, raw: true}); api.line([P - 28, 104], [P - 6, 116], {color: c.c2, width: 1.5, arrow: true}); }
      }
      // which factor reads which stop codon
      var tx0 = 300, rows = ["UAA", "UAG", "UGA"], cols = bac ? ["RF1", "RF2"] : ["eRF1"];
      cols.forEach(function (h, k) { tag([tx0 + 44 + k * 36, 14], h, c.c5, {weight: 650}); });
      rows.forEach(function (r, i) {
        var y = 30 + i * 15, on = r === v.stop;
        if (on) api.rect(tx0 - 4, y - 7.5, bac ? 98 : 70, 15, {rx: 4, fill: c.c5, fillOpacity: 0.18});
        tag([tx0 + 12, y], r, on ? c.ink : c.muted, {weight: on ? 700 : 500});
        cols.forEach(function (h, k) { var ok = READ[v.cell][r].indexOf(h) >= 0; tag([tx0 + 44 + k * 36, y], ok ? "✓" : "–", ok ? c.c4 : c.faint, {weight: 700}); });
      });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
