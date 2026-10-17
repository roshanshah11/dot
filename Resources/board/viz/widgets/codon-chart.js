// The standard genetic code as the usual 4 x 4 table: first base picks the row, second base the column,
// third base the line inside the box. The chosen codon lights up, and so do the other codons for the same
// amino acid, so the redundancy (and the wobble in the third position) is visible at a glance.
(function () {
  var B = ["U", "C", "A", "G"];
  // NCBI translation table 1, ordered U, C, A, G for the first, second and third base
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var AA = {F: ["Phe", "phenylalanine"], L: ["Leu", "leucine"], S: ["Ser", "serine"], Y: ["Tyr", "tyrosine"], C: ["Cys", "cysteine"],
            W: ["Trp", "tryptophan"], P: ["Pro", "proline"], H: ["His", "histidine"], Q: ["Gln", "glutamine"], R: ["Arg", "arginine"],
            I: ["Ile", "isoleucine"], M: ["Met", "methionine"], T: ["Thr", "threonine"], N: ["Asn", "asparagine"], K: ["Lys", "lysine"],
            V: ["Val", "valine"], A: ["Ala", "alanine"], D: ["Asp", "aspartate"], E: ["Glu", "glutamate"], G: ["Gly", "glycine"], "*": ["Stop", "stop"]};
  function aa(i, j, k) { return CODE.charAt(16 * i + 4 * j + k); }
  function pick(v) { return [B.indexOf(v.first_base), B.indexOf(v.second_base), B.indexOf(v.third_base)]; }
  function count(letter) { return CODE.split("").filter(function (c) { return c === letter; }).length; }

  Viz.register("codon-chart", {
    title: "The genetic code: reading a codon",
    subject: "biology",
    shows: "Pick the three bases of an mRNA codon: first base picks the row, second the column, third the line; the codon and every synonym for its amino acid light up",
    params: {
      first_base: {kind: "enum", values: B, default: "A", label: "1st"},
      second_base: {kind: "enum", values: B, default: "U", label: "2nd"},
      third_base: {kind: "enum", values: B, default: "G", label: "3rd"}
    },
    formula: function (v) {
      var q = pick(v), a = aa(q[0], q[1], q[2]), codon = v.first_base + v.second_base + v.third_base;
      var right = a === "*" ? "\\text{Stop}" : "\\text{" + AA[a][0] + " (" + a + ")}";
      return "5'\\text{-" + codon + "-}3'\\rightarrow" + right + ",\\ " + count(a) + "\\text{ of } 64";
    },
    status: function (v) {
      var q = pick(v), a = aa(q[0], q[1], q[2]), codon = v.first_base + v.second_base + v.third_base;
      if (a === "*") return codon + " is a <b>stop codon</b>: no tRNA pairs with it, so a release factor ends translation here.";
      if (a === "M") return "AUG codes for <b>methionine</b> and is the <b>start codon</b>, where the ribosome begins translating.";
      if (a === "W") return "UGG is the <b>only</b> codon for <b>tryptophan</b>, so any change to it changes the protein.";
      var same = [0, 1, 2, 3].filter(function (k) { return aa(q[0], q[1], k) === a; }).map(function (k) { return B[k]; });
      var wob = same.length === 4 ? "the third base doesn't matter here" :
        same.length === 1 ? "the third base must be " + same[0] :
        "the third base can be " + same.join(" or ") + (same.join("") === "UC" ? " (either pyrimidine)" : same.join("") === "AG" ? " (either purine)" : "");
      return codon + " codes for <b>" + AA[a][1] + "</b>, one of <b>" + count(a) + "</b> codons for it; " + wob + ".";
    },
    examples: [
      {name: "start codon", values: {first_base: "A", second_base: "U", third_base: "G"}},
      {name: "stop codon", values: {first_base: "U", second_base: "A", third_base: "A"}},
      {name: "six-codon leucine", values: {first_base: "C", second_base: "U", third_base: "C"}},
      {name: "tryptophan", values: {first_base: "U", second_base: "G", third_base: "G"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, q = pick(v), sel = aa(q[0], q[1], q[2]);
      var x0 = 38, y0 = 44, cw = 86, rh = 63, lh = rh / 4;
      // the reading path: the chosen row and column, faintly
      api.rect(x0, y0 + q[0] * rh, cw * 4, rh, {fill: c.c2, fillOpacity: 0.07, rx: 0});
      api.rect(x0 + q[1] * cw, y0, cw, rh * 4, {fill: c.c2, fillOpacity: 0.07, rx: 0});
      api.label([x0 + 2 * cw, 11], "second base", {color: c.muted, size: 12, anchor: "middle"});
      var side = api.label([13, y0 + 2 * rh], "first base", {color: c.muted, size: 12, anchor: "middle"});
      side.setAttribute("transform", "rotate(-90 13 " + (y0 + 2 * rh) + ")");
      for (var t = 0; t < 4; t++) {
        api.label([x0 + t * cw + cw / 2, 31], B[t], {color: t === q[1] ? c.c2 : c.ink, size: 15, weight: 700, anchor: "middle"});
        api.label([28, y0 + t * rh + rh / 2], B[t], {color: t === q[0] ? c.c2 : c.ink, size: 15, weight: 700, anchor: "middle"});
      }
      api.label([392, 31], "3rd", {color: c.muted, size: 12, anchor: "middle"});
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
        var bx = x0 + j * cw, by = y0 + i * rh;
        api.rect(bx + 1, by + 1, cw - 2, rh - 2, {stroke: c.grid, width: 1, rx: 4});
        for (var k = 0; k < 4; k++) {
          var a = aa(i, j, k), ly = by + k * lh + lh / 2, isSel = i === q[0] && j === q[1] && k === q[2], isSyn = !isSel && a === sel;
          if (isSel) api.rect(bx + 3, ly - lh / 2 + 1, cw - 6, lh - 2, {fill: c.c3, fillOpacity: 0.28, stroke: c.c3, width: 1.2, rx: 3});
          else if (isSyn) api.rect(bx + 3, ly - lh / 2 + 1, cw - 6, lh - 2, {fill: c.c1, fillOpacity: 0.16, rx: 3});
          var col = isSel ? c.c3 : isSyn ? c.c1 : a === "*" ? c.c5 : a === "M" ? c.c4 : c.muted;
          var wt = isSel || isSyn ? 700 : 500;
          api.label([bx + 8, ly], B[i] + B[j] + B[k], {color: isSel || isSyn ? col : c.ink, size: 12, weight: wt, clamp: false});
          api.label([bx + cw - 7, ly], AA[a][0], {color: col, size: 12, weight: wt, anchor: "end", clamp: false});
          if (j === 3) api.label([392, ly], B[k], {color: i === q[0] && k === q[2] ? c.c2 : c.muted, size: 12, weight: i === q[0] && k === q[2] ? 700 : 500, anchor: "middle", clamp: false});
        }
      }
    }
  });
})();
