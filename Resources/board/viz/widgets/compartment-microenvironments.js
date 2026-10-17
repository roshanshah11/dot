// Membranes let a cell keep different chemistry in each compartment. Each organelle is coloured by its pH on an
// indicator scale (red acidic, green neutral, blue basic); pick one to see its value on the pH line and what it is for.
// Values (typical mammalian cell): cytosol and nucleus 7.2, reducing (glutathione), Ca2+ about 0.1 uM; ER 7.2,
// oxidizing so disulfide bonds form, Ca2+ about 0.1-1 mM; Golgi falls from about 6.7 (cis) to 6.0 (trans); endosomes
// from about 6.3 (early) to 5.5 (late); lysosome 4.5-5.0, held there by V-type H+ ATPases; mitochondrial matrix about
// 7.9 (7.8-8.0) because the electron transport chain pumps H+ out; peroxisome measurements disagree (about 7 to 8.2).
// pH = -log10[H+], so a compartment's [H+] relative to the cytosol is 10^(7.2 - pH).
(function () {
  var C = {
    cytosol: {lo: 7.2, hi: 7.2, ref: 7.2},
    ER: {lo: 7.2, hi: 7.2, ref: 7.2},
    Golgi: {lo: 6.0, hi: 6.7, ref: 6.0, name: "trans-Golgi"},
    endosome: {lo: 5.5, hi: 6.3, ref: 5.5, name: "late endosome"},
    lysosome: {lo: 4.5, hi: 5.0, ref: 4.7},
    mitochondrion: {lo: 7.8, hi: 8.0, ref: 7.9, name: "matrix"},
    peroxisome: {lo: 7.0, hi: 8.2, ref: 7.6}
  };
  var TEXT = {
    cytosol: "The cytosol sits at <b>pH 7.2</b> and is reducing (glutathione keeps cysteines as free –SH), with Ca²⁺ held near 0.1 µM; the nucleus shares it through its pores.",
    ER: "The ER lumen has the cytosol's pH but is <b>oxidizing</b>, so new secretory proteins form disulfide (S–S) bonds there, and it stores Ca²⁺ near 0.5 mM, about <b>5,000×</b> the cytosol's 0.1 µM.",
    Golgi: "The Golgi acidifies from about pH 6.7 at the cis face to <b>6.0</b> at the trans face, which tunes each cisterna's sugar enzymes and lets receptors grab cargo for sorting.",
    endosome: "Endosomes acidify from about pH 6.3 to <b>5.5</b> as they mature, and the falling pH makes receptors let go of their cargo (LDL, lysosomal enzymes) so the receptors can be recycled.",
    lysosome: "V-type ATPases pump H⁺ in until the lysosome reaches <b>pH 4.5 to 5</b>, about 300 times the cytosol's [H⁺]; its acid hydrolases work there and barely work if they leak into the cytosol.",
    mitochondrion: "The electron transport chain pumps H⁺ from the matrix into the intermembrane space, leaving the matrix <b>basic (about 7.9)</b> with about <b>5× fewer H⁺</b> than the cytosol (the 0.2), and H⁺ flowing back through ATP synthase makes most of the cell's ATP.",
    peroxisome: "Peroxisome pH is near neutral (measurements run from <b>about 7 to 8.2</b>); what sets it apart is chemistry: oxidases make H₂O₂ and catalase breaks it down to water and oxygen."
  };

  Viz.register("compartment-microenvironments", {
    title: "Compartments keep their own chemistry",
    subject: "biology",
    shows: "Pick an organelle: each membrane-bound compartment keeps its own pH and chemistry, from the acidic lysosome (pH 4.7) to the basic mitochondrial matrix (pH 7.9), and the pH line shows how far each sits from the cytosol",
    params: {
      part: {kind: "enum", values: ["cytosol", "ER", "Golgi", "endosome", "lysosome", "mitochondrion", "peroxisome"], default: "lysosome", label: "\\text{look at}"}
    },
    formula: function (v) {
      var q = C[v.part], who = q.name || v.part;
      if (v.part === "peroxisome") return "2\\,\\text{H}_2\\text{O}_2\\xrightarrow{\\text{catalase}}2\\,\\text{H}_2\\text{O}+\\text{O}_2\\newline\\text{pH}\\approx7\\text{ to }8.2\\ \\text{(reports differ)}";
      if (v.part === "ER") return "\\frac{[\\text{Ca}^{2+}]_{\\text{ER}}}{[\\text{Ca}^{2+}]_{\\text{cytosol}}}\\approx\\frac{0.5\\ \\text{mM}}{0.1\\ \\mu\\text{M}}=" + Viz.n(0.5e-3 / 0.1e-6, 0);
      if (v.part === "cytosol") return "[\\text{H}^+]=10^{-\\text{pH}}=10^{-7.2}\\,\\text{M}\\approx63\\ \\text{nM}";
      var r = Math.pow(10, 7.2 - q.ref);
      return "\\frac{[\\text{H}^+]_{\\text{" + who + "}}}{[\\text{H}^+]_{\\text{cytosol}}}=10^{7.2-" + q.ref.toFixed(1) + "}\\approx" + Viz.n(r, r < 10 ? 1 : 0);
    },
    status: function (v) { return TEXT[v.part]; },
    examples: [
      {name: "lysosome: the most acidic", values: {part: "lysosome"}},
      {name: "mitochondrial matrix: basic", values: {part: "mitochondrion"}},
      {name: "ER: neutral but oxidizing", values: {part: "ER"}},
      {name: "Golgi: a pH gradient", values: {part: "Golgi"}},
      {name: "cytosol: the reference", values: {part: "cytosol"}}
    ],
    size: [400, 312],
    draw: function (api, v) {
      var c = api.color, sel = v.part;
      // an indicator scale built from the palette: red at 4.5, amber at 5.6, green at 7, blue at 8.2
      var hex = function (h, fb) { var m = /^#([0-9a-f]{6})$/i.exec(String(h).trim()); h = m ? m[1] : fb; return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); };
      var stops = [[4.5, hex(c.c5, "f87171")], [5.6, hex(c.c3, "fbbf24")], [7.0, hex(c.c4, "4ade80")], [8.2, hex(c.c2, "60a5fa")]];
      var col = function (pH) {
        pH = Math.max(4.5, Math.min(8.2, pH));
        for (var i = 1; i < stops.length; i++) if (pH <= stops[i][0]) {
          var t = (pH - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]), a = stops[i - 1][1], b = stops[i][1];
          return "rgb(" + [0, 1, 2].map(function (k) { return Math.round(a[k] + t * (b[k] - a[k])); }).join(",") + ")";
        }
        return "rgb(" + stops[3][1].join(",") + ")";
      };
      var on = function (k) { return sel === k; };
      var nameLab = function (at, text, k, anchor) { api.label(at, text, {color: on(k) ? c.ink : c.muted, size: 12, weight: on(k) ? 700 : 500, anchor: anchor || "middle"}); };
      // the cell and cytosol
      api.path("M 14 124 a 186 104 0 1 0 372 0 a 186 104 0 1 0 -372 0", {fill: col(7.2), fillOpacity: 0.1, stroke: on("cytosol") ? c.ink : c.muted, width: on("cytosol") ? 3 : 1.6});
      nameLab([302, 48], "cytosol", "cytosol");
      // nucleus and ER sheets wrapped around it
      api.circle([110, 118], 38, {fill: col(7.2), fillOpacity: 0.16, stroke: c.muted, width: 1.4});
      api.label([110, 118], "nucleus", {color: c.muted, size: 12, anchor: "middle"});
      [48, 55, 62].forEach(function (r) {
        var a0 = -70 * Math.PI / 180, a1 = 40 * Math.PI / 180;
        var d = "M " + (110 + r * Math.cos(a0)) + " " + (118 + r * Math.sin(a0)) + " A " + r + " " + r + " 0 0 1 " + (110 + r * Math.cos(a1)) + " " + (118 + r * Math.sin(a1));
        if (on("ER")) api.path(d, {stroke: c.ink, width: 7});
        api.path(d, {stroke: col(7.2), width: 4});
      });
      nameLab([150, 52], "ER", "ER", "start");
      // calcium and redox, which the pH colours cannot show: Ca2+ packed in the ER (~0.5 mM) against a few in the
      // cytosol (~0.1 uM, 5000x less; the dots are a cartoon of that contrast), disulfides in the ER, free thiols outside
      if (on("ER") || on("cytosol")) {
        var ca = function (at) { api.circle(at, 1.7, {fill: c.ink}); };
        [48, 55, 62].forEach(function (r) { for (var a = -66; a <= 36; a += 8) ca([110 + r * Math.cos(a * Math.PI / 180), 118 + r * Math.sin(a * Math.PI / 180)]); });
        [[262, 70], [356, 128], [150, 196]].forEach(ca);
        ca([22, 24]); api.label([30, 24], "Ca²⁺", {color: c.ink, size: 12, raw: true});
        api.label([190, 98], "S–S", {color: c.ink, size: 12, weight: 700, anchor: "middle", raw: true});
        api.label([302, 64], "–SH", {color: c.ink, size: 12, weight: 700, anchor: "middle", raw: true});
      }
      // Golgi: four cisternae, cis (left, near the ER) to trans (right)
      [6.7, 6.5, 6.2, 6.0].forEach(function (pH, i) {
        var x = 214 + i * 9, d = "M " + (x + 6) + " 64 Q " + (x - 4) + " 92 " + (x + 6) + " 120";
        if (on("Golgi")) api.path(d, {stroke: c.ink, width: 8.5});
        api.path(d, {stroke: col(pH), width: 5});
      });
      nameLab([228, 136], "Golgi", "Golgi");
      if (on("Golgi")) { api.label([214, 54], "cis", {color: c.muted, size: 12, anchor: "middle"}); api.label([248, 54], "trans", {color: c.muted, size: 12, anchor: "middle"}); }
      // endosomes: early near the plasma membrane, late deeper in
      [[[340, 76], 10, 6.3], [[300, 106], 12, 5.5]].forEach(function (e) {
        api.circle(e[0], e[1], {fill: col(e[2]), fillOpacity: 0.55, stroke: on("endosome") ? c.ink : col(e[2]), width: on("endosome") ? 3 : 1.5});
      });
      nameLab([300, 132], "endosomes", "endosome");
      if (on("endosome")) { api.label([326, 76], "early", {color: c.muted, size: 12, anchor: "end"}); api.label([284, 106], "late", {color: c.muted, size: 12, anchor: "end"}); }
      // lysosome with a few hydrolases
      api.circle([318, 162], 17, {fill: col(4.7), fillOpacity: 0.55, stroke: on("lysosome") ? c.ink : col(4.7), width: on("lysosome") ? 3 : 1.5});
      [[-6, -4], [5, -6], [0, 6]].forEach(function (o) { api.circle([318 + o[0], 162 + o[1]], 2.2, {fill: c.card}); });
      nameLab([318, 192], "lysosome", "lysosome");
      // mitochondrion: outer membrane, matrix inside the folded inner membrane
      // (outer membrane rx 50, inner membrane around the matrix rx 32: the ring between is the intermembrane space)
      api.path("M 172 184 a 50 23 0 1 0 100 0 a 50 23 0 1 0 -100 0", {stroke: on("mitochondrion") ? c.ink : c.muted, width: on("mitochondrion") ? 3 : 1.5, fill: col(7.2), fillOpacity: 0.12});
      api.path("M 190 184 a 32 11 0 1 0 64 0 a 32 11 0 1 0 -64 0", {fill: col(7.9), fillOpacity: 0.6, stroke: col(7.9), width: 1.2});
      [200, 209, 218].forEach(function (x, i) { api.line([x, i % 2 ? 193 : 175], [x, i % 2 ? 183 : 185], {color: c.card, width: 2}); });
      nameLab([222, 219], "mitochondrion", "mitochondrion");
      // peroxisome with its catalase core
      api.circle([84, 178], 12, {fill: col(7.6), fillOpacity: 0.5, stroke: on("peroxisome") ? c.ink : col(7.6), width: on("peroxisome") ? 3 : 1.5});
      api.rect(79, 174, 10, 8, {fill: c.card, rx: 1.5});
      nameLab([102, 180], "peroxisome", "peroxisome", "start");
      if (on("peroxisome")) {   // H2O2 (H-O-O-H) made by the oxidases, broken down by catalase in the core
        api.line([39, 160], [46, 155], {color: c.muted, width: 2}); api.line([46, 155], [57, 155], {color: c.muted, width: 2}); api.line([57, 155], [64, 160], {color: c.muted, width: 2});
        [[46, 155], [57, 155]].forEach(function (o) { api.circle(o, 4.5, {fill: c.c5}); });
        [[39, 160], [64, 160]].forEach(function (h) { api.circle(h, 3, {fill: c.ink}); });
        api.label([52, 143], "H₂O₂", {color: c.ink, size: 12, weight: 650, anchor: "middle", raw: true});
        api.arrow([64, 166], [74, 172], {color: c.ink, width: 1.6, halo: false, head: 6});
      }
      // proton pumping for the two compartments that set their pH that way
      if (on("lysosome")) { api.arrow([356, 140], [334, 154], {color: c.ink, width: 2, halo: false, head: 8}); api.label([366, 134], "H⁺", {color: c.ink, size: 12.5, weight: 650, anchor: "middle", raw: true}); }
      if (on("mitochondrion")) { api.arrow([240, 184], [266, 184], {color: c.ink, width: 2, halo: false, head: 7}); api.label([237, 184], "H⁺", {color: c.ink, size: 12.5, weight: 650, anchor: "end", raw: true}); }
      // the pH line: every compartment's tick, named in one row (the leaders fan out where 7.2, 7.6 and 7.9 crowd)
      var X = function (pH) { return 40 + (pH - 4) * 340 / 4.5; }, yb = 280, yr = yb - 20;
      for (var p = 4; p < 8.5; p += 0.1) api.rect(X(p), yb, 340 / 45 + 0.6, 8, {fill: col(p + 0.05), rx: 0});
      for (var t = 4; t <= 8; t++) api.label([X(t), yb + 20], String(t), {color: c.muted, size: 12, anchor: "middle"});
      api.label([12, yb + 4], "pH", {color: c.muted, size: 12, weight: 650});
      var SLOT = {lysosome: [93, "lyso"], endosome: [153, "endo"], Golgi: [191, "Golgi"], cytosol: [250, "cytosol 7.2"], peroxisome: [314, "perox"], mitochondrion: [364, "mito"]};
      Object.keys(SLOT).forEach(function (k) {
        if (k === sel || (k === "cytosol" && sel === "ER")) return;   // the ER shares the cytosol's 7.2
        var x = X(C[k].ref), s = SLOT[k], ref = k === "cytosol";
        api.line([x, yb - 1], [x, yb - 6], {color: ref ? c.ink : c.muted, width: 2});
        api.line([x, yb - 6], [s[0], yr + 7], {color: ref ? c.ink : c.muted, width: 1, opacity: 0.6});
        api.label([s[0], yr], s[1], {color: ref ? c.ink : c.muted, size: 12, weight: ref ? 650 : 500, anchor: "middle"});
      });
      var q = C[sel], xs = X(q.ref);
      if (q.hi > q.lo) api.rect(X(q.lo), yb - 9, X(q.hi) - X(q.lo), 6, {fill: c.ink, rx: 3});
      api.polygon([[xs, yb - 1], [xs - 6, yb - 11], [xs + 6, yb - 11]], {fill: c.ink, fillOpacity: 1});
      api.line([xs, yb - 11], [xs, yb - 35], {color: c.ink, width: 1.4});
      var txt = q.hi > q.lo ? "pH " + q.lo.toFixed(1) + "–" + q.hi.toFixed(1) : "pH " + q.ref.toFixed(1);
      api.label([xs, yb - 43], txt, {color: c.ink, size: 12.5, weight: 700, anchor: "middle"});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
