// Each template base calls for one ribonucleotide: template A -> U (RNA has no T), T -> A, G -> C, C -> G. The pair is always a
// purine (A, G: two rings, drawn long) across from a pyrimidine (C, T, U: one ring, drawn short), so every rung is the same
// width; A-U and T-A pairs share 2 hydrogen bonds and G-C pairs 3, so the more G-C the more tightly the RNA holds the
// template. The template is read 3'->5' and the RNA grows 5'->3', antiparallel. Pick the four template bases.
(function () {
  var RNA = {A: "U", T: "A", G: "C", C: "G"}, PURINE = {A: true, G: true};
  var KEYS = ["b1", "b2", "b3", "b4"];
  function tpl(v) { return KEYS.map(function (k) { return v[k]; }); }
  function bonds(b) { return b === "G" || b === "C" ? 3 : 2; }
  function total(v) { return tpl(v).reduce(function (s, b) { return s + bonds(b); }, 0); }
  var base = function (lab) { return {kind: "enum", values: ["A", "C", "G", "T"], label: lab}; };

  Viz.register("dna-template-rna-complementarity", {
    title: "Template DNA and RNA: complementary base pairing",
    subject: "biology",
    shows: "Pick the template bases: each calls for its partner ribonucleotide (A pairs with U, not T), a purine always faces a pyrimidine, and G–C pairs add a third hydrogen bond",
    params: {
      b1: Object.assign(base("\\text{base 1}"), {default: "T"}),
      b2: Object.assign(base("\\text{base 2}"), {default: "A"}),
      b3: Object.assign(base("\\text{base 3}"), {default: "C"}),
      b4: Object.assign(base("\\text{base 4}"), {default: "G"})
    },
    formula: function (v) {
      var t = tpl(v), r = t.map(function (b) { return RNA[b]; }), gc = t.filter(function (b) { return bonds(b) === 3; }).length;
      return "\\begin{array}{l}3'\\text{-}\\texttt{" + t.join("") + "}\\text{-}5'\\ \\to\\ 5'\\text{-}\\texttt{" + r.join("") + "}\\text{-}3'\\\\ H=2\\cdot" + (4 - gc) + "+3\\cdot" + gc + "=" + total(v) + "\\end{array}";
    },
    status: function (v) {
      var t = tpl(v), r = t.map(function (b) { return RNA[b]; }).join(""), gc = t.filter(function (b) { return bonds(b) === 3; }).length, a = t.filter(function (b) { return b === "A"; }).length;
      return "Template 3′-" + t.join("") + "-5′ calls for RNA <b>5′-" + r + "-3′</b>" + (a ? ", with U opposite each template A because RNA has no T," : "") +
        (gc ? " and its " + gc + " G–C pair" + (gc === 1 ? " brings" : "s bring") + " the total to <b>" : " and with no G–C pair it holds only <b>") + total(v) + "</b> hydrogen bonds of a possible 12.";
    },
    examples: [
      {name: "all A–U and T–A pairs", values: {b1: "A", b2: "T", b3: "A", b4: "T"}},
      {name: "all G–C pairs", values: {b1: "G", b2: "C", b3: "G", b4: "C"}},
      {name: "template A only", values: {b1: "A", b2: "A", b3: "A", b4: "A"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, t = tpl(v), yR = 62, yT = 228, X = function (i) { return 92 + i * 62; }, w = 34;
      var LONG = 80, SHORT = 48;                                     // purine and pyrimidine block heights; 80 + 48 + 38 = 166 = yT - yR
      // backbones: RNA (ribose) on top, template DNA (deoxyribose) below
      api.line([X(0) - 30, yR], [X(3) + 30, yR], {color: c.c5, width: 4});
      api.line([X(0) - 30, yT], [X(3) + 30, yT], {color: c.c2, width: 4});
      api.label([X(0) - 44, yR], "5′", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      api.label([X(3) + 44, yR], "3′", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      api.label([X(0) - 44, yT], "3′", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([X(3) + 44, yT], "5′", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([X(0) - 30, 20], "RNA: ribose sugars, grows 5′ → 3′", {color: c.c5, size: 12, weight: 650});
      api.label([X(0) - 30, 258], "template DNA: deoxyribose, read 3′ → 5′", {color: c.c2, size: 12, weight: 650});
      api.label([X(0) - 30, 278], "long block: purine (A, G)  ·  short: pyrimidine (C, T, U)", {color: c.muted, size: 12});
      t.forEach(function (b, i) {
        var r = RNA[b], x = X(i), hT = PURINE[b] ? LONG : SHORT, hR = PURINE[r] ? LONG : SHORT;
        var topEnd = yR + hR, botStart = yT - hT;
        api.circle([x, yR], 6, {fill: c.c5});
        api.circle([x, yT], 6, {fill: c.c2});
        api.rect(x - w / 2, yR + 6, w, hR - 6, {rx: 6, fill: c.c5, fillOpacity: 0.22, stroke: c.c5, width: 1.4});
        api.rect(x - w / 2, botStart, w, hT - 6, {rx: 6, fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.4});
        api.label([x, yR + 6 + (hR - 6) / 2], r, {color: c.c5, size: 16, weight: 750, anchor: "middle"});
        api.label([x, botStart + (hT - 6) / 2], b, {color: c.c2, size: 16, weight: 750, anchor: "middle"});
        // hydrogen bonds across the gap
        var n = bonds(b);
        for (var j = 0; j < n; j++) {
          var hx = x - (n - 1) * 6 + j * 12;
          api.line([hx, topEnd + 4], [hx, botStart - 4], {color: c.ink, width: 1.6, dash: "3 3", opacity: 0.85});
        }
        api.label([x + w / 2 + 4, (topEnd + botStart) / 2], String(n), {color: c.muted, size: 12});
        if (b === "A") api.label([x, yR - 18], "U, not T", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      });
      // hydrogen-bond tally: out of 12 (four G-C pairs)
      var bx = 356, top = 70, bot = 220, H = total(v);
      api.rect(bx, top, 22, bot - top, {rx: 6, fill: c.ink, fillOpacity: 0.05, stroke: c.faint, width: 1});
      for (var k = 0; k < 12; k++) {
        var y = bot - (k + 1) * (bot - top) / 12;
        api.rect(bx + 3, y + 1.5, 16, (bot - top) / 12 - 3, {rx: 2, fill: k < H ? c.c4 : "none", fillOpacity: 0.8});
      }
      api.label([bx + 11, top - 14], H + " / 12", {color: c.c4, size: 13, weight: 700, anchor: "middle"});
      api.label([bx + 11, bot + 14], "H-bonds", {color: c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (el) { var col = el.getAttribute("fill"); if (col) el.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
