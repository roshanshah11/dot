// Biotechnology's core move, recombinant DNA: cut a plasmid and a gene with restriction enzymes, let the sticky ends
// base-pair, seal them with ligase, put the plasmid into E. coli and select the cells that make the protein.
// The close-up shows why the two cuts must leave matching overhangs (BamHI and BglII differ but both leave GATC).
Viz.register("biotechnology", {
  title: "Recombinant DNA: putting a gene into a plasmid",
  subject: "biology",
  shows: "Pick the enzyme that cuts the plasmid and the one that cuts the gene, then step through pairing, ligation, transformation and expression",
  params: {
    vec: {kind: "enum", values: ["EcoRI", "BamHI", "HindIII", "BglII"], default: "EcoRI", label: "\\text{plasmid}"},
    ins: {kind: "enum", values: ["EcoRI", "BamHI", "HindIII", "BglII"], default: "EcoRI", label: "\\text{gene}"}
  },
  steps: ["cut the plasmid and the gene", "sticky ends pair up", "ligase seals the backbone", "put the plasmid into E. coli", "select, grow and express"],
  stepMs: 1800,
  formula: function (v) {
    var S = {EcoRI: "GAATTC", BamHI: "GGATCC", HindIII: "AAGCTT", BglII: "AGATCT"}, a = S[v.vec].slice(1, 5), b = S[v.ins].slice(1, 5);
    var row = function (e) { return "\\text{" + e + ":}&\\text{" + S[e][0] + "}{\\downarrow}\\text{" + S[e].slice(1) + "}\\to\\text{" + S[e].slice(1, 5) + "}"; };
    return "\\begin{array}{rl}" + row(v.vec) + "\\\\" + row(v.ins) + "\\\\ &\\text{" + a + "}" + (a === b ? "=" : "\\neq") + "\\text{" + b + "}\\end{array}";
  },
  status: function (v) {
    var S = {EcoRI: "GAATTC", BamHI: "GGATCC", HindIII: "AAGCTT", BglII: "AGATCT"}, a = S[v.vec].slice(1, 5), b = S[v.ins].slice(1, 5), ok = a === b, s = v.step || 1;
    if (s === 1) return v.vec + " opens the plasmid and " + v.ins + " cuts out the gene, each leaving a single-stranded end: <b>" + a + "</b> and <b>" + b + "</b>.";
    if (s === 2) return ok ? (v.vec === v.ins ? "Both ends are " : v.vec + " and " + v.ins + " are different enzymes but both leave ") + "<b>" + a + "</b>, so the gene's ends base-pair with the plasmid's." :
      "<b>" + a + "</b> and <b>" + b + "</b> are not complementary, so the gene cannot base-pair into this plasmid.";
    if (s === 3) return ok ? "DNA ligase seals the sugar-phosphate backbone, giving a <b>recombinant plasmid</b>" + (v.vec === v.ins ? "." : "; the joined site is cut by neither enzyme.") :
      "Only the plasmid's own two matching ends can join, so it <b>re-closes empty</b>.";
    if (s === 4) return "A heat shock gets the " + (ok ? "recombinant" : "empty") + " plasmid into E. coli, which copies it every time the cell divides.";
    return ok ? "On ampicillin only plasmid-carrying cells form colonies, and they <b>make the protein</b> (the gene is a cDNA, since bacteria cannot splice out introns)." :
      "Colonies still grow on ampicillin, but their plasmids carry <b>no gene</b>, so no protein.";
  },
  examples: [
    {name: "same enzyme", values: {vec: "EcoRI", ins: "EcoRI", step: 3}},
    {name: "different enzymes, same overhang", values: {vec: "BamHI", ins: "BglII", step: 3}},
    {name: "ends don't match", values: {vec: "EcoRI", ins: "HindIII", step: 2}}
  ],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1, S = {EcoRI: "GAATTC", BamHI: "GGATCC", HindIII: "AAGCTT", BglII: "AGATCT"};
    var sv = S[v.vec], si = S[v.ins], ok = sv.slice(1, 5) === si.slice(1, 5);
    var comp = function (b) { return {A: "T", T: "A", G: "C", C: "G"}[b]; };
    var P = [92, 88], R = 46, pt = function (deg, r) { var a = deg * Math.PI / 180; return [P[0] + (r || R) * Math.cos(a), P[1] + (r || R) * Math.sin(a)]; };
    var arc = function (d1, d2, color, w) { var a = pt(d1), b = pt(d2), big = ((d2 - d1 + 360) % 360) > 180 ? 1 : 0;
      api.path("M " + a[0] + " " + a[1] + " A " + R + " " + R + " 0 " + big + " 1 " + b[0] + " " + b[1], {stroke: color, width: w || 6}); };
    // ---- top: the plasmid, the gene, the cell ----
    var inserted = ok && s >= 2;
    if (s === 1 || (!ok && s === 2)) { arc(-38, 308, c.c2); api.label(pt(-45, R + 16), "cut: " + v.vec, {color: c.c2, size: 12, weight: 600}); }
    else if (inserted) { arc(-8, 278, c.c2); arc(-82, -10, c.c3); if (s === 2) { arc(-10, -8, c.card, 7); arc(278, 280, c.card, 7); } }
    else arc(0, 359.9, c.c2);
    if (inserted && s >= 3) [pt(-9), pt(-81)].forEach(function (q) { api.circle(q, 4.5, {fill: c.c6}); });
    arc(125, 175, c.c4, 7);
    api.label(pt(150, R + 20), "ampR", {color: c.c4, size: 12, weight: 600, anchor: "end"});
    api.label([P[0], P[1]], inserted ? "recombinant" : s >= 3 ? "empty" : "plasmid", {color: c.c2, size: 12, anchor: "middle"});
    if (inserted) api.label(pt(-46, R + 16), "gene", {color: c.c3, size: 12.5, weight: 650});
    if (s <= 2 && !inserted) {
      var gx = s === 1 ? 236 : 214;
      api.line([gx - 34, 60], [gx - 6, 60], {color: c.muted, width: 6}); api.line([gx + 126, 60], [gx + 154, 60], {color: c.muted, width: 6});
      api.line([gx, 60], [gx + 120, 60], {color: c.c3, width: 6});
      api.label([gx + 60, 40], "gene (cDNA)", {color: c.c3, size: 12.5, weight: 600, anchor: "middle"});
      api.label([gx + 60, 80], "cut out with " + v.ins, {color: c.c3, size: 12, anchor: "middle"});
      if (!ok && s === 2) api.label([gx + 60, 104], "ends don't pair: no insert", {color: c.c5, size: 12.5, weight: 600, anchor: "middle"});
    }
    if (s === 3 && !ok) { api.line([236, 60], [356, 60], {color: c.c3, width: 6, opacity: 0.3}); api.label([296, 80], "gene left out", {color: c.c5, size: 12.5, weight: 600, anchor: "middle"}); }
    if (s === 4) {
      api.rect(206, 44, 170, 88, {rx: 44, stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.04});
      api.label([291, 30], "E. coli", {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      api.arrow([146, 88], [214, 88], {color: c.muted, width: 2, halo: false});
      [[262, 76], [300, 102], [334, 74]].forEach(function (q) {
        api.circle(q, 11, {stroke: c.c2, width: 3});
        if (ok) api.path("M " + (q[0] + 11) + " " + q[1] + " A 11 11 0 0 0 " + q[0] + " " + (q[1] - 11), {stroke: c.c3, width: 3.5});
      });
    }
    if (s === 5) {
      var Q = [272, 88], rnd = 5;
      api.circle(Q, 48, {stroke: c.muted, width: 1.5});
      api.label([Q[0], 28], "ampicillin plate", {color: c.muted, size: 12, anchor: "middle"});
      for (var k = 0; k < 26; k++) { rnd = (rnd * 1664525 + 1013904223) % 4294967296; var a = rnd / 4294967296 * 6.283, rr = 40 * Math.sqrt(((k * 37) % 26 + 0.5) / 26);
        api.circle([Q[0] + rr * Math.cos(a), Q[1] + rr * Math.sin(a)], 3.6, {fill: c.c4}); }
      if (ok) { [[352, 64], [370, 84], [350, 100]].forEach(function (q) { api.circle(q, 6, {fill: c.c3}); });
        api.label([360, 126], "protein made", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"}); }
      else api.label([Q[0], 150], "colonies, but no gene", {color: c.c5, size: 12.5, weight: 600, anchor: "middle"});
    }
    api.line([12, 162], [api.w - 12, 162], {color: c.grid, width: 1});
    // ---- bottom: one junction, base by base ----
    var x = function (col) { return 50 + col * 23; }, yT = 226, yB = 258, dx = s === 1 ? 34 : 0;
    api.label([12, 178], "one junction, base by base", {color: c.muted, size: 12});
    var vt = ["C", "T", "G", sv[0]], vb = vt.map(comp).concat(sv.slice(1, 5).split("").map(comp));
    var it = si.slice(1, 6).split("").concat(["A", "T", "G"]), ib = [comp(si[5]), "T", "A", "C"];
    vt.forEach(function (b, i) { api.label([x(i), yT], b, {color: c.c2, size: 14, weight: 650, anchor: "middle"}); });
    vb.forEach(function (b, i) { api.label([x(i), yB], b, {color: c.c2, size: 14, weight: 650, anchor: "middle"}); });
    it.forEach(function (b, i) { api.label([x(i + 4) + dx, yT], b, {color: c.c3, size: 14, weight: 650, anchor: "middle"}); });
    ib.forEach(function (b, i) { api.label([x(i + 8) + dx, yB], b, {color: c.c3, size: 14, weight: 650, anchor: "middle"}); });
    api.line([x(0) - 8, yT - 13], [x(3) + 6, yT - 13], {color: c.c2, width: 2.5});
    api.line([x(0) - 8, yB + 13], [x(7) + 6, yB + 13], {color: c.c2, width: 2.5});
    api.line([x(4) - 6 + dx, yT - 13], [x(11) + 8 + dx, yT - 13], {color: c.c3, width: 2.5});
    api.line([x(8) - 6 + dx, yB + 13], [x(11) + 8 + dx, yB + 13], {color: c.c3, width: 2.5});
    var bonds = function (col, pair, xx) { var n = pair === "GC" || pair === "CG" ? 3 : 2;
      for (var j = 0; j < n; j++) api.line([xx - (n - 1) * 2.5 + j * 5, yT + 10], [xx - (n - 1) * 2.5 + j * 5, yB - 10], {color: c.muted, width: 1.4}); };
    for (var i = 0; i < 4; i++) bonds(i, vt[i] + vb[i], x(i));
    for (i = 8; i < 12; i++) bonds(i, it[i - 4] + ib[i - 8], x(i) + dx);
    var mism = 0;
    if (s >= 2) for (i = 4; i < 8; i++) {
      if (comp(vb[i]) === it[i - 4]) bonds(i, vb[i] + it[i - 4], x(i));
      else { mism++; api.label([x(i), (yT + yB) / 2], "×", {color: c.c5, size: 16, weight: 700, anchor: "middle"}); }
    }
    if (s >= 3 && ok) {
      api.line([x(3) + 6, yT - 13], [x(4) - 6, yT - 13], {color: c.c6, width: 4}); api.line([x(7) + 6, yB + 13], [x(8) - 6, yB + 13], {color: c.c6, width: 4});
      api.label([x(5.5), yT - 26], "ligase seals the nicks", {color: c.c6, size: 12, weight: 600, anchor: "middle"});
    } else if (s === 1) api.label([x(5.5) + 17, yT - 26], "single-stranded ends", {color: c.muted, size: 12, anchor: "middle"});
    else if (s >= 2 && ok) api.label([x(5.5), yT - 26], "ends paired, backbone still nicked", {color: c.muted, size: 12, anchor: "middle"});
    else api.label([x(5.5), yT - 26], mism + " of 4 overhang bases mismatch", {color: c.c5, size: 12, weight: 600, anchor: "middle"});
    api.label([x(0) - 20, yT], "5′", {color: c.c2, size: 12, anchor: "end"}); api.label([x(0) - 20, yB], "3′", {color: c.c2, size: 12, anchor: "end"});
    api.label([x(11) + 20 + dx, yT], "3′", {color: c.c3, size: 12}); api.label([x(11) + 20 + dx, yB], "5′", {color: c.c3, size: 12});
    api.label([x(1.5), 288], "plasmid end", {color: c.c2, size: 12, anchor: "middle"});
    api.label([x(9.5) + dx, 288], "gene end", {color: c.c3, size: 12, anchor: "middle"});
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
