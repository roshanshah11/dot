// A cloning workflow from bench to clone: cut the gene and the plasmid, ligate, transform E. coli, plate on ampicillin +
// X-gal, then grow a white colony and check it. The plasmid carries ampR (selection) and lacZα with the cloning site
// inside it (an insert breaks lacZα, so the colony stays white instead of turning X-gal blue). One enzyme (EcoRI at both
// ends) lets the gene go in either way round (half the clones backwards) and lets the empty plasmid re-close (blue
// colonies); two enzymes (EcoRI + BamHI) leave unlike ends, so the gene goes in one way and the vector cannot close alone.
// Colony counts on the plate are illustrative, not data.
(function () {
  var D2R = Math.PI / 180;
  Viz.register("recombinant-dna-plasmid-workflow", {
    title: "Cloning a gene into a plasmid",
    subject: "biology",
    shows: "Step through digest, ligation, transformation, selection and screening; compare cutting with one enzyme against two",
    params: {
      cut: {kind: "enum", values: ["one", "two"], default: "one", label: "\\text{enzymes}", names: {one: "one (EcoRI)", two: "two (EcoRI + BamHI)"}}
    },
    steps: ["cut the gene and the plasmid", "ligate", "transform E. coli", "plate on ampicillin + X-gal", "grow a white colony and check it"],
    stepMs: 1900,
    formula: function (v) {
      return v.cut === "one" ? "\\begin{array}{l}\\text{ends: }\\texttt{AATT},\\ \\texttt{AATT}\\\\ P(\\text{gene forward})=\\tfrac12\\\\ \\text{empty vector can re-close}\\end{array}" :
        "\\begin{array}{l}\\text{ends: }\\texttt{AATT},\\ \\texttt{GATC}\\\\ P(\\text{gene forward})=1\\\\ \\text{empty vector cannot close}\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, one = v.cut === "one";
      if (s === 1) return one ? "EcoRI opens the plasmid inside lacZα and cuts the gene out; every end is the same <b>AATT</b> overhang." :
        "EcoRI and BamHI cut out a short piece of the plasmid's cloning site and cut the gene out, leaving <b>two different</b> ends, AATT and GATC.";
      if (s === 2) return one ? "Ligase joins any matching ends: the gene goes in <b>either way round</b>, and some plasmids simply re-close with no gene." :
        "Each end can only join its match, so the gene goes in <b>one way round</b> and the plasmid cannot re-close on its own.";
      if (s === 3) return "A heat shock at 42 °C lets plasmids into the cells, but only a <b>small fraction</b> of cells take one up.";
      if (s === 4) return "Ampicillin kills every cell without a plasmid; X-gal turns colonies with an intact lacZα <b>blue</b>, so the <b>white</b> ones carry the gene" +
        (one ? ", and empty plasmids give plenty of blue." : ", and blue ones are rare.");
      return one ? "Grow a white colony and sequence its plasmid: with one enzyme <b>about half</b> the clones hold the gene backwards." :
        "Grow a white colony and sequence its plasmid: with two enzymes <b>every</b> clone holds the gene the right way round.";
    },
    examples: [
      {name: "one enzyme: ligation products", values: {cut: "one", step: 2}},
      {name: "two enzymes: ligation products", values: {cut: "two", step: 2}},
      {name: "one enzyme: the plate", values: {cut: "one", step: 4}},
      {name: "two enzymes: checking a clone", values: {cut: "two", step: 5}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, one = v.cut === "one";
      function arc(o, r, a0, a1, color, w) {   // clockwise arc in degrees (0 = east, 90 = south)
        var A = [o[0] + r * Math.cos(a0 * D2R), o[1] + r * Math.sin(a0 * D2R)], B = [o[0] + r * Math.cos(a1 * D2R), o[1] + r * Math.sin(a1 * D2R)];
        api.path("M " + A[0] + " " + A[1] + " A " + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + B[0] + " " + B[1], {stroke: color, width: w || 6});
      }
      function plasmid(o, r, opts) {   // opts: gap [a0, a1], gene "fwd" | "rev", small
        var g = opts.gap, w = opts.small ? 5 : 7;
        if (g) arc(o, r, g[1], g[0] + 360, c.c1, w); else api.circle(o, r, {stroke: c.c1, width: w});
        arc(o, r, 110, 170, c.c5, w);
        if (!opts.gap) arc(o, r, -72, -8, c.c2, w);
        if (opts.gene) {
          arc(o, r, -62, -18, c.c3, w + 1);
          var a = opts.gene === "fwd" ? -18 : -62, d = opts.gene === "fwd" ? 1 : -1, P = [o[0] + r * Math.cos(a * D2R), o[1] + r * Math.sin(a * D2R)];
          var T = [-Math.sin(a * D2R) * d, Math.cos(a * D2R) * d];
          api.path("M " + (P[0] + T[0] * 9) + " " + (P[1] + T[1] * 9) + " L " + (P[0] - T[1] * 7) + " " + (P[1] + T[0] * 7) + " L " + (P[0] + T[1] * 7) + " " + (P[1] - T[0] * 7) + " Z", {fill: c.c3});
        }
        if (!opts.small) {
          api.label([o[0] - r - 10, o[1] + r * 0.62], "ampR", {color: c.c5, size: 12, anchor: "end"});
          api.label([o[0] + r + 10, o[1] - r * 0.45], "lacZα", {color: c.c2, size: 12});
        }
      }
      if (s === 1) {
        var O = [92, 132];
        plasmid(O, 52, {gap: one ? [-47, -33] : [-52, -28]});
        arc(O, 52, -72, one ? -47 : -52, c.c2, 7); arc(O, 52, one ? -33 : -28, -8, c.c2, 7);
        api.label([O[0] + 66 * Math.cos(-40 * D2R), O[1] + 66 * Math.sin(-40 * D2R)], "cut", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
        api.label([O[0], O[1]], "plasmid", {color: c.c1, size: 12, anchor: "middle"});
        api.label([O[0] + 30, O[1] - 84], one ? "cut with EcoRI" : "cut with EcoRI + BamHI", {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        if (!one) { arc(O, 80, -52, -28, c.c2, 5); api.label([O[0] + 84, O[1] - 52], "piece removed", {color: c.muted, size: 12}); }
        // the gene in its source DNA, cut out
        api.line([214, 96], [386, 96], {color: c.faint, width: 6});
        api.rect(254, 89, 92, 14, {rx: 3, fill: c.c3});
        api.label([300, 74], "gene", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
        api.label([250, 116], "EcoRI", {color: c.ink, size: 12, anchor: "middle"}); api.label([350, 116], one ? "EcoRI" : "BamHI", {color: c.ink, size: 12, anchor: "middle"});
        api.rect(254, 160, 92, 14, {rx: 3, fill: c.c3});
        api.line([300, 126], [300, 150], {color: c.muted, width: 1.4, arrow: true});
        api.label([248, 190], "AATT", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
        api.label([352, 190], one ? "AATT" : "GATC", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
        api.label([300, 214], one ? "both ends alike" : "two different ends", {color: c.ink, size: 12, anchor: "middle"});
      }
      if (s === 2) {
        var items = one ? [[[80, 128], "fwd", "gene →"], [[200, 128], "rev", "gene ← (backwards)"], [[320, 128], null, "empty, re-closed"]] :
                          [[[120, 128], "fwd", "gene →, every time"]];
        items.forEach(function (it) {
          plasmid(it[0], 40, {gene: it[1], small: true});
          api.label([it[0][0], it[0][1] + 62], it[2], {color: it[1] ? c.c3 : c.c2, size: 12, weight: 650, anchor: "middle"});
        });
        if (!one) {
          var Q = [290, 128];
          arc(Q, 40, -20, 300, c.c1, 5);
          api.label([Q[0] + 24, Q[1] - 44], "✕", {color: c.c5, size: 15, weight: 700, anchor: "middle"});
          api.label([Q[0], Q[1] + 62], "empty can't close", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
          api.label([Q[0], Q[1] + 80], "AATT ≠ GATC", {color: c.c5, size: 12, anchor: "middle"});
        }
        api.label([200, 30], "ligase seals matching ends", {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      }
      if (s === 3) {
        var cells = [[70, 100], [170, 92], [270, 104], [350, 120], [110, 180], [215, 176], [320, 192]];
        cells.forEach(function (q, i) {
          api.rect(q[0] - 34, q[1] - 17, 68, 34, {rx: 17, fill: c.muted, fillOpacity: 0.12, stroke: c.muted, width: 1.4});
          if (i === 1 || i === 5) plasmid([q[0], q[1]], 10, {gene: i === 1 || !one ? "fwd" : null, small: true});
        });
        api.label([200, 34], "heat shock, 42 °C", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
        api.label([200, 240], "E. coli: most cells take up no plasmid", {color: c.muted, size: 12, anchor: "middle"});
      }
      if (s === 4) {
        var P0 = [118, 140], R = 92;
        api.circle(P0, R, {fill: c.muted, fillOpacity: 0.08, stroke: c.muted, width: 2});
        var n = 0;
        for (var k = 0; k < 13; k++) {   // a fixed scatter of colonies; one enzyme: 4 blue, two enzymes: 1 blue
          var ang = k * 137.5 * D2R, rr = R * 0.82 * Math.sqrt((k + 0.6) / 13), q = [P0[0] + rr * Math.cos(ang), P0[1] + rr * Math.sin(ang)];
          var blue = one ? k % 3 === 1 : k === 7;
          api.circle(q, 7, {fill: blue ? c.c2 : c.ink, fillOpacity: blue ? 0.95 : 0.9});
          if (blue) n++;
        }
        api.label([232, 92], "white: has the gene", {color: c.ink, size: 12.5, weight: 650});
        api.label([232, 116], "blue: empty plasmid", {color: c.c2, size: 12.5, weight: 650});
        api.label([232, 140], "none: no plasmid,", {color: c.muted, size: 12});
        api.label([232, 158], "killed by ampicillin", {color: c.muted, size: 12});
        api.label([232, 190], (13 - n) + " white, " + n + " blue", {color: c.ink, size: 12.5});
        api.label([232, 208], "(illustrative)", {color: c.muted, size: 12});
      }
      if (s === 5) {
        api.rect(30, 90, 34, 110, {rx: 12, stroke: c.muted, width: 1.6, fill: c.c4, fillOpacity: 0.12});
        api.label([47, 216], "culture", {color: c.muted, size: 12, anchor: "middle"});
        api.arrow([74, 145], [104, 145], {color: c.muted, width: 2, halo: false});
        var checks = one ? [[[176, 140], "fwd", "right way: about 1/2", c.c4], [[300, 140], "rev", "backwards: about 1/2", c.c5]] : [[[220, 140], "fwd", "right way: every clone", c.c4]];
        checks.forEach(function (it) {
          plasmid(it[0], 40, {gene: it[1], small: true});
          api.label([it[0][0], it[0][1] + 62], it[2], {color: it[3], size: 12, weight: 650, anchor: "middle"});
        });
        api.label([200, 40], "plasmid prep, then sequence the gene", {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
