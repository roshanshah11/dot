// One nucleotide of DNA next to one of RNA: phosphate(s) on the 5' carbon, a five-carbon sugar, a base on the
// 1' carbon. The sugar differs at one atom: deoxyribose has H on its 2' carbon, ribose has OH. The bases differ in one
// pair: DNA's thymine is uracil with a methyl group on C5. Heteroatom hydrogens are drawn (OH, NH2, ring NH: the
// N-H groups are H-bond donors in base pairing); carbon hydrogens are implicit. Formulas are the neutral forms; each
// extra phosphate adds HPO3. M from atomic masses C 12.011, H 1.008, N 14.007, O 15.999, P 30.974.
// Colors: teal = the 2' position, amber = thymine's methyl (or uracil's H), purple = phosphates, blue = the base.
(function () {
  var MONO = {   // nucleoside monophosphates: [C, H, N, O, P]
    DNA: {A: [10, 14, 5, 6, 1], G: [10, 14, 5, 7, 1], C: [9, 14, 3, 7, 1], "T/U": [10, 15, 2, 8, 1]},
    RNA: {A: [10, 14, 5, 7, 1], G: [10, 14, 5, 8, 1], C: [9, 14, 3, 8, 1], "T/U": [9, 13, 2, 9, 1]}
  };
  var MASS = [12.011, 1.008, 14.007, 15.999, 30.974], SYM = ["C", "H", "N", "O", "P"];
  var BASE = {A: ["adenine", "purine"], G: ["guanine", "purine"], C: ["cytosine", "pyrimidine"], T: ["thymine", "pyrimidine"], U: ["uracil", "pyrimidine"]};
  function letter(v) { return v.base === "T/U" ? (v.molecule === "DNA" ? "T" : "U") : v.base; }
  function counts(v) { var m = MONO[v.molecule][v.base].slice(), k = v.phosphates - 1; m[1] += k; m[3] += 3 * k; m[4] += k; return m; }
  function name(v) { return (v.molecule === "DNA" ? "d" : "") + letter(v) + ["M", "D", "T"][v.phosphates - 1] + "P"; }
  function mass(v) { return counts(v).reduce(function (s, x, i) { return s + x * MASS[i]; }, 0); }
  Viz.register("dna-rna-nucleotide-comparison", {
    title: "DNA and RNA nucleotides compared",
    subject: "biology",
    shows: "Switch DNA and RNA and pick a base: the sugar differs by one oxygen on the 2′ carbon, and thymine is uracil with a methyl group",
    params: {
      molecule: {kind: "enum", values: ["DNA", "RNA"], default: "DNA", label: "\\text{type}"},
      base: {kind: "enum", values: ["A", "G", "C", "T/U"], default: "T/U", label: "\\text{base}", names: {"T/U": "T or U"}},
      phosphates: {kind: "integer", default: 1, min: 1, max: 3, label: "n_{\\text{P}}"}
    },
    formula: function (v) {
      var f = counts(v).map(function (x, i) { return x ? SYM[i] + (x > 1 ? "_{" + x + "}" : "") : ""; }).join("");
      return "\\text{" + name(v) + ":}\\ \\mathrm{" + f + "}\\;(" + Viz.n(mass(v), 1) + "\\,\\text{g/mol})";
    },
    status: function (v) {
      var dna = v.molecule === "DNA", L = letter(v), nm = name(v), tail = "";
      var other = Object.assign({}, v, {molecule: dna ? "RNA" : "DNA"}), d = mass(v) - mass(other);
      if (v.phosphates === 3) tail = " As a triphosphate it is a building block: polymerase keeps one phosphate and releases the other two as pyrophosphate.";
      var head = dna ? "<b>" + nm + "</b>: deoxyribose has only <b>H</b> on its 2′ carbon" : "<b>" + nm + "</b>: ribose carries an <b>OH</b> on its 2′ carbon";
      if (L === "T") return head + ", and thymine has a <b>methyl group</b> on C5 that uracil lacks; " + Viz.fmt(Math.abs(d), 1) + " g/mol lighter than " + name(other) + "." + tail;
      if (L === "U") return head + ", and uracil has <b>H</b> where thymine has a methyl group; " + Viz.fmt(Math.abs(d), 1) + " g/mol heavier than " + name(other) + "." + tail;
      return head + "; " + BASE[L][0] + " is the same in both, so " + nm + " is one oxygen (" + Viz.fmt(Math.abs(d), 1) + " g/mol) " + (dna ? "lighter" : "heavier") + " than " + name(other) + "." + tail;
    },
    examples: [
      {name: "dTMP (DNA, thymine)", values: {molecule: "DNA", base: "T/U"}},
      {name: "UMP (RNA, uracil)", values: {molecule: "RNA", base: "T/U"}},
      {name: "ATP", values: {molecule: "RNA", base: "A", phosphates: 3}},
      {name: "dGTP", values: {molecule: "DNA", base: "G", phosphates: 3}},
      {name: "CMP", values: {molecule: "RNA", base: "C", phosphates: 1}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, dna = v.molecule === "DNA", L = letter(v), pur = BASE[L][1] === "purine";
      var P = function (a, r, cx, cy) { return [cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)]; };
      var bond = function (a, b, col, w) { api.line(a, b, {color: col || c.ink, width: w || 2}); };
      var atom = function (at, t, col, o) { api.circle(at, 8, {fill: c.card}); api.label(at, t, Object.assign({color: col || c.ink, size: 12.5, weight: 650, anchor: "middle"}, o || {})); };
      // a ring N-H (an H-bond donor in base pairing): N on the vertex, its H outward to the right, on a wider backing
      var nh = function (at, col) {
        api.rect(at[0] - 8, at[1] - 8, 27, 16, {fill: c.card, rx: 8});
        api.label(at, "N", {color: col, size: 12.5, weight: 650, anchor: "middle"});
        api.label([at[0] + 10, at[1]], "H", {color: col, size: 12.5, weight: 650, anchor: "middle"});
      };
      // ---- sugar ----
      var S = [180, 176], R = 34, O4 = P(90, R, S[0], S[1]), C1 = P(18, R, S[0], S[1]), C2 = P(-54, R, S[0], S[1]), C3 = P(-126, R, S[0], S[1]), C4 = P(162, R, S[0], S[1]);
      [[O4, C1], [C1, C2], [C2, C3], [C3, C4], [C4, O4]].forEach(function (b) { bond(b[0], b[1], c.ink, 2.4); });
      atom(O4, "O");
      var C5 = [C4[0] - 22, C4[1] - 26];
      bond(C4, C5); atom(C5, "CH₂", c.ink, {size: 12});
      api.label([C1[0] + 4, C1[1] + 14], "1′", {color: c.muted, size: 12});
      api.label([C2[0] + 10, C2[1] + 2], "2′", {color: c.c1, size: 12, weight: 650});
      api.label([C3[0] - 12, C3[1] + 2], "3′", {color: c.muted, size: 12, anchor: "end"});
      api.label([C4[0] - 6, C4[1] + 12], "4′", {color: c.muted, size: 12, anchor: "end"});
      api.label([C5[0] - 16, C5[1] + 10], "5′", {color: c.muted, size: 12, anchor: "end"});
      var two = [C2[0], C2[1] + 28];
      bond(C2, [two[0], two[1] - 8], c.c1, 2.4);
      api.circle(two, 15, {fill: c.c1, fillOpacity: 0.16, stroke: c.c1, width: 1.5});
      api.label(two, dna ? "H" : "OH", {color: c.c1, size: 13, weight: 750, anchor: "middle"});
      var three = [C3[0], C3[1] + 28];
      bond(C3, [three[0], three[1] - 8]);
      api.label(three, "OH", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.label([S[0], S[1] + 2], dna ? "deoxy-" : "ribose", {color: c.ink, size: 12, anchor: "middle", opacity: 0.85});
      if (dna) api.label([S[0], S[1] + 16], "ribose", {color: c.ink, size: 12, anchor: "middle", opacity: 0.85});
      // ---- phosphates up the 5' end ----
      var O5 = [C5[0], C5[1] - 22];
      bond([C5[0], C5[1] - 8], O5); atom(O5, "O");
      for (var k = 0; k < v.phosphates; k++) {
        var pp = [O5[0], O5[1] - 21 - k * 32], last = k === v.phosphates - 1;
        bond([pp[0], pp[1] + 9], [pp[0], pp[1] + (k ? 11 : 13)], c.c6);
        api.circle(pp, 9, {fill: c.c6, fillOpacity: 0.85});
        api.label(pp, "P", {color: c.card, size: 12, weight: 800, anchor: "middle"});
        bond([pp[0] - 9, pp[1]], [pp[0] - 16, pp[1]], c.c6); api.label([pp[0] - 19, pp[1]], "O⁻", {color: c.c6, size: 12, anchor: "end"});
        bond([pp[0] + 9, pp[1] - 2], [pp[0] + 16, pp[1] - 2], c.c6); bond([pp[0] + 9, pp[1] + 2], [pp[0] + 16, pp[1] + 2], c.c6);
        api.label([pp[0] + 19, pp[1]], "O", {color: c.c6, size: 12});
        if (!last) {
          bond([pp[0], pp[1] - 9], [pp[0], pp[1] - 23], c.c6);
          api.circle([pp[0], pp[1] - 16], 6, {fill: c.card});
          api.label([pp[0], pp[1] - 16], "O", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
        } else { bond([pp[0], pp[1] - 9], [pp[0], pp[1] - 13], c.c6); api.label([pp[0], pp[1] - 20], "O⁻", {color: c.c6, size: 12, anchor: "middle"}); }
      }
      api.label([16, 16], ["monophosphate", "diphosphate", "triphosphate"][v.phosphates - 1], {color: c.c6, size: 12.5, weight: 650});
      // ---- base on C1' ----
      var dbl = function (a, b, ctr) {   // the inner line of a ring double bond
        var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(ctr[0] - m[0], ctr[1] - m[1]), ox = (ctr[0] - m[0]) / d * 4.5, oy = (ctr[1] - m[1]) / d * 4.5;
        bond([a[0] + (b[0] - a[0]) * 0.22 + ox, a[1] + (b[1] - a[1]) * 0.22 + oy], [a[0] + (b[0] - a[0]) * 0.78 + ox, a[1] + (b[1] - a[1]) * 0.78 + oy], c.c2, 1.6);
      };
      var s = 26, N1x = C1[0] + 26, N1y = C1[1] - 8, rings = [], subs = [];
      bond(C1, [N1x - 7, N1y + 2], c.c2);
      if (!pur) {
        var cx = N1x + 0.866 * s, cy = N1y - 0.5 * s, ang = [210, 270, 330, 30, 90, 150], V = ang.map(function (a) { return P(a, s, cx, cy); });
        for (var i = 0; i < 6; i++) bond(V[i], V[(i + 1) % 6], c.c2, 2.2);
        dbl(V[4], V[5], [cx, cy]); if (L === "C") dbl(V[2], V[3], [cx, cy]);
        atom(V[0], "N", c.c2);
        if (L === "C") atom(V[2], "N", c.c2); else nh(V[2], c.c2);   // N3: bare in cytosine, N-H in thymine and uracil
        subs.push([V[1], P(270, s + 22, cx, cy), "O"]);
        subs.push([V[3], P(30, s + 24, cx, cy), L === "C" ? "NH₂" : "O"]);
        if (L === "T" || L === "U") subs.push([V[4], P(90, s + 22, cx, cy), L === "T" ? "CH₃" : "H", true]);
      } else {
        var x0 = N1x + 0.951 * s, y0 = N1y - 0.809 * s, pc = [x0 - 0.688 * s, y0], hc = [x0 + 0.866 * s, y0], Rp = 0.8507 * s;
        var C5b = P(36, Rp, pc[0], pc[1]), C4b = P(-36, Rp, pc[0], pc[1]), N7 = P(108, Rp, pc[0], pc[1]), C8 = P(180, Rp, pc[0], pc[1]), N9 = P(252, Rp, pc[0], pc[1]);
        var C6 = P(90, s, hc[0], hc[1]), N1 = P(30, s, hc[0], hc[1]), C2b = P(330, s, hc[0], hc[1]), N3 = P(270, s, hc[0], hc[1]);
        [[C4b, C5b], [C5b, N7], [N7, C8], [C8, N9], [N9, C4b], [C4b, N3], [N3, C2b], [C2b, N1], [N1, C6], [C6, C5b]].forEach(function (b) { bond(b[0], b[1], c.c2, 2.2); });
        dbl(C2b, N3, hc); dbl(C4b, C5b, hc); dbl(N7, C8, pc); if (L === "A") dbl(N1, C6, hc);
        [N7, N9, N3].forEach(function (q) { atom(q, "N", c.c2); });
        if (L === "G") nh(N1, c.c2); else atom(N1, "N", c.c2);   // N1: N-H in guanine, bare in adenine
        subs.push([C6, P(90, s + 22, hc[0], hc[1]), L === "A" ? "NH₂" : "O"]);
        if (L === "G") subs.push([C2b, P(330, s + 24, hc[0], hc[1]), "NH₂"]);
      }
      subs.forEach(function (q) {
        var col = q[3] ? c.c3 : c.c2;
        var e = [q[0][0] + (q[1][0] - q[0][0]) * 0.62, q[0][1] + (q[1][1] - q[0][1]) * 0.62];
        if (q[2] === "O") {   // C=O: a double bond
          var dx = e[0] - q[0][0], dy = e[1] - q[0][1], ln = Math.hypot(dx, dy), ox = -dy / ln * 2, oy = dx / ln * 2;
          bond([q[0][0] + ox, q[0][1] + oy], [e[0] + ox, e[1] + oy], col, 1.8); bond([q[0][0] - ox, q[0][1] - oy], [e[0] - ox, e[1] - oy], col, 1.8);
        } else bond(q[0], e, col, 2);
        if (q[3]) api.circle(q[1], 15, {fill: c.c3, fillOpacity: 0.16, stroke: c.c3, width: 1.5});
        api.label(q[1], q[2], {color: col, size: 12.5, weight: 700, anchor: "middle"});
      });
      api.label([388, 16], BASE[L][0] + " (" + BASE[L][1] + ")", {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
      // ---- what to notice ----
      api.label([388, 254], dna ? "2′: H (deoxyribose)" : "2′: OH (ribose)", {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      api.label([388, 272], L === "T" ? "thymine: CH₃ on C5" : L === "U" ? "uracil: H on C5, no CH₃" : "base: same in DNA and RNA",
        {color: L === "T" || L === "U" ? c.c3 : c.c2, size: 12.5, weight: 650, anchor: "end"});
      api.label([388, 290], "3′-OH: next nucleotide joins here", {color: c.muted, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
