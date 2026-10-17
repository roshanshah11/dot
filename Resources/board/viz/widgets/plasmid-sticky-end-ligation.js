// Sticky-end ligation at one junction, base by base. The vector is opened with EcoRI (G^AATTC), whose staggered cut leaves
// a 4-nt 5' overhang, AATT. The insert's end pairs with it only if its own overhang is complementary: EcoRI's and MfeI's
// (C^AATTG) both leave AATT; BamHI's GATC does not match, and SmaI (CCC^GGG) cuts blunt. Paired ends are held by only a few
// hydrogen bonds (A-T 2, G-C 3), so they part again unless DNA ligase seals the two nicks with phosphodiester bonds.
(function () {
  var SITE = {EcoRI: "GAATTC", MfeI: "CAATTG", BamHI: "GGATCC", SmaI: "CCCGGG"}, CUT = {EcoRI: 1, MfeI: 1, BamHI: 1, SmaI: 3};
  var COMP = {A: "T", T: "A", G: "C", C: "G"}, HB = {A: 2, T: 2, G: 3, C: 3};
  var VEC = "CGTC", GENE = "ATGG";   // flanking bases: vector before the cut, insert after it
  function comp(s) { return s.split("").map(function (b) { return COMP[b]; }).join(""); }
  function model(v) {
    var s = SITE[v.ins], p = CUT[v.ins], ov = s.slice(p, 6 - p), vov = "AATT";
    var ok = ov === vov, hb = ok ? ov.split("").reduce(function (t, b) { return t + HB[b]; }, 0) : 0;
    return {site: s, p: p, ov: ov, ok: ok, hb: hb, blunt: !ov.length, junction: "G" + s.slice(p), insTop: s.slice(p) + GENE,
            insBot: comp(s + GENE).slice(6 - p), rebuilt: ok && v.ins === "EcoRI"};
  }
  function cutText(e) { return SITE[e].slice(0, CUT[e]) + "↓" + SITE[e].slice(CUT[e]); }

  Viz.register("plasmid-sticky-end-ligation", {
    title: "Sticky ends and ligation",
    subject: "biology",
    shows: "Pick the enzyme that cut the insert and step through cutting, pairing and sealing: only complementary overhangs pair, and only ligase makes the join permanent",
    params: {
      ins: {kind: "enum", values: ["EcoRI", "MfeI", "BamHI", "SmaI"], default: "EcoRI", label: "\\text{insert cut}"},
      ligase: {kind: "boolean", default: true, label: "\\text{ligase}", on: "added", off: "left out"}
    },
    steps: ["cut: staggered ends", "the overhangs pair", "ligase seals the nicks"],
    stepMs: 1800,
    formula: function (v) {
      var m = model(v);
      if (m.blunt) return "\\text{blunt}\\ \\text{vs}\\ 5'\\text{-}\\texttt{AATT}:\\ \\text{nothing to pair}";
      if (!m.ok) return "5'\\text{-}\\texttt{" + m.ov + "}\\ \\text{vs}\\ 3'\\text{-}\\texttt{TTAA}:\\ \\text{not complementary}";
      return "\\begin{array}{l}5'\\text{-}\\texttt{" + m.ov + "}\\ \\text{pairs with}\\ 3'\\text{-}\\texttt{TTAA}\\\\ " + m.ov.length + "\\text{ bp},\\ " +
        m.ov.split("").map(function (b) { return HB[b]; }).join("+") + "=" + m.hb + "\\text{ H-bonds}\\end{array}";
    },
    status: function (v) {
      var m = model(v), s = v.step || 1;
      if (s === 1) return m.blunt ? "EcoRI leaves the vector a 5′ AATT overhang, but SmaI cuts straight across CCC↓GGG, leaving the insert a <b>blunt end</b>." :
        "EcoRI (G↓AATTC) and " + v.ins + " (" + cutText(v.ins) + ") cut each strand at a different place, leaving single-stranded 5′ ends: <b>AATT</b> and <b>" + m.ov + "</b>.";
      if (!m.ok) return m.blunt ? "A blunt end has no single strand to pair with the vector's AATT, so <b>nothing holds them together</b>" + (s === 3 ? " and ligase has nothing to seal." : ".") :
        m.ov + " is not complementary to the vector's AATT, so the ends <b>cannot base-pair</b>" + (s === 3 ? " and ligase has nothing to seal." : ".");
      if (s === 2) return "The insert's " + m.ov + " pairs with the vector's overhang: <b>" + m.ov.length + " base pairs, " + m.hb + " hydrogen bonds</b>, enough to hold the ends together only briefly.";
      if (!v.ligase) return "Without ligase both nicks stay open, and " + m.hb + " hydrogen bonds are too few to last: <b>the ends come apart again</b>.";
      return "Ligase seals both nicks with phosphodiester bonds, so the insert is <b>covalently joined</b>; the junction " + m.junction +
        (m.rebuilt ? " is an EcoRI site again." : " is a site neither enzyme cuts.");
    },
    examples: [
      {name: "matching ends, sealed", values: {ins: "EcoRI", step: 3}},
      {name: "different enzyme, same overhang", values: {ins: "MfeI", step: 3}},
      {name: "ends that do not match", values: {ins: "BamHI", step: 2}},
      {name: "blunt end", values: {ins: "SmaI", step: 2}},
      {name: "no ligase", values: {ins: "EcoRI", ligase: false, step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), s = v.step || 1, apart = s === 3 && m.ok && !v.ligase, joined = s >= 2 && m.ok && !apart, sealed = joined && s === 3 && v.ligase;
      var gap = joined ? 0 : m.blunt ? 96 : 50, X = function (col, ins) { return 112 + col * 17.5 + (ins ? gap : 0); };
      var yT = 198, yB = 234;
      // overview: the plasmid ring, opened at the top, and the insert
      var O = [62, 76], R = 40, arc = function (a0, a1, r) {
        var p = function (a) { return [O[0] + r * Math.cos(a * Math.PI / 180), O[1] + r * Math.sin(a * Math.PI / 180)]; }, A = p(a0), B = p(a1);
        return "M " + A[0] + " " + A[1] + " A " + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + B[0] + " " + B[1];
      };
      api.path(arc(-62, 242, R), {stroke: c.c2, width: 7});
      api.label([O[0], O[1]], "vector", {color: c.c2, size: 12, anchor: "middle"});
      if (joined) api.path(arc(-118, -62, R + (sealed ? 0 : 5)), {stroke: c.c3, width: 7});
      else { api.line([O[0] - 22, 18], [O[0] + 22, 18], {color: c.c3, width: 7}); if (s >= 2 && !apart) api.label([O[0] + 34, 18], "✕", {color: c.c5, size: 13, weight: 700}); }
      api.label([O[0], joined ? 22 : 6 + 26], "insert", {color: c.c3, size: 12, anchor: "middle"});
      if (sealed) [-118, -62].forEach(function (a) { api.circle([O[0] + R * Math.cos(a * Math.PI / 180), O[1] + R * Math.sin(a * Math.PI / 180)], 4.5, {fill: c.c4}); });
      // the enzymes and the verdict
      api.label([132, 26], "vector cut by EcoRI: G↓AATTC", {color: c.c2, size: 12.5, weight: 600});
      api.label([132, 48], "insert cut by " + v.ins + ": " + cutText(v.ins), {color: c.c3, size: 12.5, weight: 600});
      var verdict = m.blunt ? "blunt end vs AATT: no pairing" : m.ok ? "AATT pairs with AATT" : m.ov + " vs AATT: no pairing";
      api.label([132, 74], verdict, {color: m.ok ? c.c6 : c.c5, size: 12.5, weight: 650});
      if (sealed) api.label([132, 96], "junction " + m.junction + (m.rebuilt ? ": EcoRI site again" : ": cut by neither"), {color: c.c4, size: 12.5, weight: 650});
      // close-up of the left junction
      api.label([20, 146], "the left junction, base by base", {color: c.muted, size: 12});
      var vTop = VEC + "G", vBot = comp(VEC + "GAATT");
      vTop.split("").forEach(function (b, i) { api.label([X(i - 4), yT], b, {color: c.c2, size: 14, weight: 700, anchor: "middle"}); });
      vBot.split("").forEach(function (b, i) { api.label([X(i - 4), yB], b, {color: c.c2, size: 14, weight: 700, anchor: "middle"}); });
      var bot0 = 1 + m.ov.length;   // first column of the insert's bottom strand
      m.insTop.split("").forEach(function (b, i) { api.label([X(1 + i, true), yT], b, {color: c.c3, size: 14, weight: 700, anchor: "middle"}); });
      m.insBot.split("").forEach(function (b, i) { api.label([X(bot0 + i, true), yB], b, {color: c.c3, size: 14, weight: 700, anchor: "middle"}); });
      // hydrogen bonds: 2 for A-T, 3 for G-C, drawn as short dashes between the paired bases
      function bonds(x, base, color) { var n = HB[base]; for (var k = 0; k < n; k++) api.line([x - (n - 1) * 3 + k * 6, yT + 10], [x - (n - 1) * 3 + k * 6, yB - 10], {color: color, width: 1.4, opacity: 0.8}); }
      for (var i = -4; i <= 0; i++) bonds(X(i), vTop[i + 4], c.faint);
      for (i = bot0; i < 1 + m.insTop.length; i++) bonds(X(i, true), m.insTop[i - 1], c.faint);
      if (joined) for (i = 1; i <= 4; i++) bonds(X(i), m.insTop[i - 1], c.c6);
      // backbones (outside the bases), with the two nicks between vector and insert
      api.line([X(-4) - 8, yT - 13], [X(0) + 6, yT - 13], {color: c.c2, width: 3});
      api.line([X(-4) - 8, yB + 13], [X(4) + 6, yB + 13], {color: c.c2, width: 3});
      api.line([X(1, true) - 6, yT - 13], [X(m.insTop.length, true) + 8, yT - 13], {color: c.c3, width: 3});
      api.line([X(bot0, true) - 6, yB + 13], [X(bot0 + m.insBot.length - 1, true) + 8, yB + 13], {color: c.c3, width: 3});
      api.label([X(-4) - 14, yT - 13], "5′", {color: c.c2, size: 12, anchor: "end"}); api.label([X(-4) - 14, yB + 13], "3′", {color: c.c2, size: 12, anchor: "end"});
      api.label([X(m.insTop.length, true) + 14, yT - 13], "3′", {color: c.c3, size: 12}); api.label([X(bot0 + m.insBot.length - 1, true) + 14, yB + 13], "5′", {color: c.c3, size: 12});
      if (joined) {
        [[X(0.5), yT - 13, yT - 30], [X(4.5), yB + 13, yB + 30]].forEach(function (q) {
          if (sealed) { api.line([q[0] - 7, q[1]], [q[0] + 7, q[1]], {color: c.c4, width: 3}); api.circle([q[0], q[1]], 4.5, {fill: c.c4}); }
          api.label([q[0], q[2]], sealed ? "sealed" : "nick", {color: sealed ? c.c4 : c.muted, size: 12, weight: 650, anchor: "middle"});
        });
      } else if (apart) api.label([(X(0) + X(1, true)) / 2 + 2, (yT + yB) / 2], "came apart", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      else if (s >= 2) api.label([X(1) + gap / 2 - 4, yB - 16], "✕", {color: c.c5, size: 15, weight: 700, anchor: "middle"});
      if (!joined) api.label([X(m.blunt ? 1 : 2.5, true), yT - 32], m.blunt ? "blunt end" : "overhang 5′-" + m.ov + "-3′", {color: c.c3, size: 12, anchor: m.blunt ? "start" : "middle"});
      if (!joined) api.label([X(2.5), yB + 32], "overhang 3′-TTAA-5′", {color: c.c2, size: 12, anchor: "middle"});
      // the ligase in the tube (or not)
      api.rect(318, 134, 72, 24, {rx: 12, fill: v.ligase ? c.c4 : "none", fillOpacity: 0.22, stroke: v.ligase ? c.c4 : c.muted, width: 1.4, dash: v.ligase ? null : "4 3"});
      api.label([354, 146], v.ligase ? "ligase" : "no ligase", {color: v.ligase ? c.c4 : c.muted, size: 12, weight: 650, anchor: "middle"});
      api.label([X(-2), 284], "vector", {color: c.c2, size: 12, anchor: "middle"});
      api.label([X(6, true), 284], "insert", {color: c.c3, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
