// Transcription of one gene, start to finish, in a bacterium or a eukaryote. Initiation: in bacteria the σ factor of RNA
// polymerase reads the -35 and -10 boxes; in eukaryotes TFIID (its TBP subunit) binds the TATA box near -30 and the other
// general factors bring in RNA polymerase II. The DNA opens (about 13 bp) and RNA starts at +1 with no primer. Elongation:
// the template strand is read 3'->5' and RNA grows 5'->3'; bacterial ribosomes start translating the RNA while it is still
// being made, while a eukaryotic transcript gets a 5' cap early. Termination: a bacterial (intrinsic) terminator makes a
// GC-rich hairpin followed by a run of U's that pulls the RNA out; a eukaryotic transcript is cut 10-30 nt past its AAUAAA
// signal and given a poly(A) tail, and Pol II falls off further downstream. The gene is drawn schematically, not to scale.
(function () {
  var TXT = {
    bacterium: {
      pol: "RNA polymerase", factor: "σ factor",
      f: ["\\begin{array}{l}\\text{core }(\\alpha_2\\beta\\beta'\\omega)+\\sigma\\\\ =\\text{holoenzyme}\\end{array}",
          "\\begin{array}{l}\\text{NTP}+\\text{NTP}\\to\\text{pppNpN}+\\text{PP}_i\\\\ \\text{at }{+1}\\text{, no primer}\\end{array}",
          "\\begin{array}{l}(\\text{NMP})_n+\\text{NTP}\\\\ \\to(\\text{NMP})_{n+1}+\\text{PP}_i\\end{array}",
          "\\begin{array}{l}\\text{GC hairpin}+\\text{U-tract}\\\\ \\Rightarrow\\text{RNA released}\\end{array}"],
      s: ["The σ factor steers RNA polymerase to the promoter by reading the <b>−35</b> and <b>−10</b> boxes, about 17 bp apart",
          "Polymerase melts about 13 bp around the start site and joins the first two NTPs at <b>+1</b>, no primer needed; σ usually lets go after the first ~10 nt",
          "The core enzyme reads the template 3′→5′ while the RNA grows 5′→3′, and <b>ribosomes</b> already translate its 5′ end, since bacteria have no nucleus",
          "The terminator's GC-rich RNA forms a <b>hairpin</b> right before a run of U's, which pulls the RNA free and releases polymerase"]
    },
    eukaryote: {
      pol: "RNA Pol II", factor: "TFIID",
      f: ["\\begin{array}{l}\\text{TFIID (TBP)}+\\text{TATA}\\\\ \\to\\text{TFIIB, E, F, H}+\\text{Pol II}\\end{array}",
          "\\begin{array}{l}\\text{TFIIH melts DNA}\\\\ \\text{RNA begins at }{+1}\\end{array}",
          "\\begin{array}{l}(\\text{NMP})_n+\\text{NTP}\\\\ \\to(\\text{NMP})_{n+1}+\\text{PP}_i\\end{array}",
          "\\begin{array}{l}\\text{cleave 10–30 nt past AAUAAA}\\\\ +\\ \\text{poly(A) tail}\\end{array}"],
      s: ["TFIID's TBP grips the <b>TATA box</b> about 30 bp upstream, and the other general factors bring RNA polymerase II to the start site",
          "TFIIH unwinds the DNA and Pol II begins the RNA at <b>+1</b> with no primer, then escapes the promoter and leaves TFIID behind",
          "Pol II reads the template 3′→5′ while the RNA grows 5′→3′, and the RNA's 5′ end gets a <b>cap</b> (7-methyl-G) once it is ~25 nt long",
          "Once the <b>AAUAAA</b> signal is made, the RNA is cut 10–30 nt beyond it and a poly(A) tail added; Pol II drops off further downstream"]
    }
  };
  Viz.register("dna-transcription", {
    title: "Transcription: initiation, elongation, termination",
    subject: "biology",
    shows: "Step through one gene being transcribed in a bacterium or a eukaryote: polymerase finds the promoter, opens the DNA, builds RNA 5′→3′ off the template, and lets go at the end",
    params: {
      cell: {kind: "enum", values: ["bacterium", "eukaryote"], default: "bacterium", label: "\\text{cell}"}
    },
    steps: ["polymerase finds the promoter", "the DNA opens, RNA starts at +1", "elongation", "termination"],
    stepMs: 1900,
    formula: function (v) { return TXT[v.cell].f[(v.step || 1) - 1]; },
    status: function (v) { return TXT[v.cell].s[(v.step || 1) - 1] + "."; },
    examples: [
      {name: "bacterial promoter", values: {cell: "bacterium", step: 1}},
      {name: "coupled translation", values: {cell: "bacterium", step: 3}},
      {name: "eukaryotic start", values: {cell: "eukaryote", step: 2}},
      {name: "cleavage and poly(A)", values: {cell: "eukaryote", step: 4}}
    ],
    size: [400, 240],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, bac = v.cell === "bacterium", T = TXT[v.cell];
      var X = function (p) { return p <= 0 ? 160 + p * 2 : 160 + p * 1.8; };   // position relative to +1 -> px (gene drawn 0..100)
      var yC = 118, yTm = 130, end = bac ? 96 : 92, rowE = 172, rowS = 190, rowB = 210;
      // polymerase body per step: at the promoter it covers about -20..+16 (with sigma or TBP upstream of it), later it is a 60-wide body
      var body = s <= 2 ? [bac ? X(-20) : X(-16), X(16), yC - 40, yTm + 24] : [0, 0, yC - 30, yTm + 30];
      var polX = [0, 0, X(55), bac ? X(97) : X(112)][s - 1];
      if (s >= 3) { body[0] = polX - 30; body[1] = polX + 30; }
      var bx = s === 2 ? X(-2) : polX, open = s >= 2 && !(bac && s === 4);
      api.label([14, 18], ["closed complex at the promoter", "open complex: about 13 bp unwound", "elongation complex moving along the gene", bac ? "termination at the terminator" : "termination past the poly(A) signal"][s - 1],
        {color: c.ink, size: 12.5, weight: 650});
      // DNA: coding strand above, template strand below, opened into a bubble under polymerase
      var strand = function (y, dy, col) {
        var d = "M 14 " + y;
        if (open) d += " L " + (bx - 28) + " " + y + " Q " + (bx - 18) + " " + (y + dy) + " " + (bx - 10) + " " + (y + dy) + " L " + (bx + 10) + " " + (y + dy) + " Q " + (bx + 18) + " " + (y + dy) + " " + (bx + 28) + " " + y;
        api.path(d + " L 388 " + y, {stroke: col, width: 3});
      };
      strand(yC, -14, c.faint); strand(yTm, 14, c.c2);
      api.label([10, yC - 13], "5′ coding", {color: c.muted, size: 12});
      api.label([10, yTm + 15], "3′ template", {color: c.c2, size: 12});
      // the polymerase body goes under the factors and boxes
      api.rect(body[0], body[2], body[1] - body[0], body[3] - body[2], {rx: 24, fill: c.c6, fillOpacity: s === 4 ? 0.08 : 0.2, stroke: c.c6, width: 1.6, dash: s === 4 ? "4 3" : null});
      // start factors (teal), each sitting on the DNA element it reads; an opaque underlay hides the polymerase edge beneath
      var factor = function (x0, x1, name) {
        api.rect(x0, yC - 25, x1 - x0, 23, {rx: 10, fill: c.card, fillOpacity: 1});
        api.rect(x0, yC - 25, x1 - x0, 23, {rx: 10, fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.4});
        api.label([(x0 + x1) / 2, yC - 13], name, {color: c.c1, size: 12, weight: 700, anchor: "middle"});
      };
      if (s <= 2 && bac) factor(X(-42), X(-4), "σ factor");                 // sigma region 4 on -35, region 2 on -10
      if (s <= 2 && !bac) { factor(X(-36), X(-19), "TBP"); api.label([X(-27.5), yC - 34], "TFIID", {color: c.c1, size: 12, weight: 650, anchor: "middle"}); }
      if (s === 2 && !bac) factor(X(17), X(42), "TFIIH");
      if (s <= 2) {   // the whole initiation complex, start factor(s) plus polymerase, as one footprint on the promoter
        var f0 = bac ? X(-42) : X(-36), f1 = s === 2 && !bac ? X(42) : X(16);
        api.path("M " + f0 + " 52 L " + f0 + " 46 L " + f1 + " 46 L " + f1 + " 52", {stroke: c.muted, width: 1.3});
        api.label([(f0 + f1) / 2, 36], bac ? "holoenzyme = core + σ" : "preinitiation complex", {color: c.muted, size: 12, anchor: "middle"});
      }
      // promoter elements, start site, terminator
      var box = function (p0, p1, name, col) {
        api.rect(X(p0), yC - 4, X(p1) - X(p0), yTm - yC + 8, {rx: 3, fill: col, fillOpacity: 0.35, stroke: col, width: 1.2});
        api.label([(X(p0) + X(p1)) / 2, rowE], name, {color: col, size: 12, weight: 650, anchor: "middle"});
      };
      if (bac) { box(-38, -30, "−35", c.c3); box(-14, -6, "−10", c.c3); } else box(-31, -24, "TATA", c.c3);
      box(end - 6, end, bac ? "terminator" : "AATAAA", c.c4);                // the DNA reads AATAAA; its RNA copy is AAUAAA
      api.label([(X(8) + X(end - 6)) / 2, rowE], "gene", {color: c.muted, size: 12, anchor: "middle"});
      api.path("M " + X(0) + " " + (yC - 4) + " L " + X(0) + " " + (yC - 18) + " L " + (X(0) + 14) + " " + (yC - 18), {stroke: c.ink, width: 1.6, arrow: true});
      api.label([X(0), rowS], s === 2 ? "+1: RNA starts here" : "+1", {color: s === 2 ? c.c5 : c.ink, size: 12, weight: 650, anchor: "middle"});
      // RNA
      if (s === 2) api.line([X(0), yTm + 8], [X(0) + 8, yTm + 8], {color: c.c5, width: 3});
      if (s === 3) {
        // the RNA-DNA hybrid along the template inside the bubble, then the exiting RNA up and back to its 5' end
        var ex = [polX - 36, yC - 36], x0 = 122, y0 = 64, n = 16, pts = [];
        for (var k = 0; k <= n; k++) { var t = k / n; pts.push([x0 + (ex[0] - x0) * t, y0 + (ex[1] - y0) * t + Math.sin(t * Math.PI * 4) * 4 * (1 - t)]); }
        api.polyline(pts, {stroke: c.c5, width: 3});
        api.path("M " + (polX + 10) + " " + (yTm + 8) + " L " + (polX - 8) + " " + (yTm + 8) + " C " + (polX - 24) + " " + (yTm + 8) + " " + (polX - 22) + " " + (yC - 22) + " " + ex[0] + " " + ex[1], {stroke: c.c5, width: 3});
        api.label([ex[0] + 12, ex[1] - 6], "RNA", {color: c.c5, size: 12, weight: 650});
        if (bac) {
          api.label([x0 - 8, y0], "5′", {color: c.c5, size: 12, weight: 650, anchor: "end"});
          [3, 10].forEach(function (k) {   // mRNA runs through the small subunit, under the large one
            var q = pts[k];
            api.circle([q[0], q[1] - 9], 10, {fill: c.c4, fillOpacity: 0.35, stroke: c.c4, width: 1.4});
            api.circle([q[0], q[1] + 6], 7, {fill: c.c4, fillOpacity: 0.35, stroke: c.c4, width: 1.4});
          });
          api.label([(pts[3][0] + pts[10][0]) / 2, 38], "ribosomes translate it as it is made", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        } else {
          api.circle([x0 - 7, y0], 7, {fill: c.c3, fillOpacity: 0.5, stroke: c.c3, width: 1.4});   // the cap sits on the 5' end
          api.label([x0 - 7, y0 - 16], "5′ cap", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
        }
      }
      if (s === 4) {   // the finished transcript, released above the DNA
        var r0 = 96, r1 = 286, yR = 66;
        api.line([r0, yR], [r1, yR], {color: c.c5, width: 3});
        api.label([r0 - (bac ? 8 : 22), yR], "5′", {color: c.c5, size: 12, weight: 650, anchor: "end"});
        if (bac) {
          api.path("M " + r1 + " " + yR + " L " + (r1 + 8) + " " + (yR - 26) + " A 9 9 0 1 1 " + (r1 + 22) + " " + (yR - 26) + " L " + (r1 + 30) + " " + yR, {stroke: c.c5, width: 3});
          api.label([r1 + 36, yR + 1], "UUUU 3′", {color: c.c5, size: 12, weight: 650});
          api.label([r1 + 15, yR - 52], "GC-rich hairpin", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        } else {
          api.circle([r0 - 7, yR], 7, {fill: c.c3, fillOpacity: 0.5, stroke: c.c3, width: 1.4});
          api.label([r0 - 7, yR - 18], "cap", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
          api.line([r1 + 4, yR], [r1 + 46, yR], {color: c.c3, width: 3, dash: "2 3"});
          api.label([r1 + 50, yR], "AAA… 3′", {color: c.c3, size: 12, weight: 650});
          api.label([r1 + 25, yR - 18], "poly(A) tail", {color: c.c3, size: 12, anchor: "middle"});
          api.line([r1 + 2, yR - 7], [r1 + 2, yR + 7], {color: c.muted, width: 1.4});   // where the cleavage made the 3' end
          api.label([r1 + 6, yR + 18], "cut 10–30 nt past AAUAAA", {color: c.muted, size: 12, anchor: "end"});
        }
        api.label([(r0 + r1) / 2, yR - 18], bac ? "RNA released" : "mRNA", {color: c.c5, size: 12.5, weight: 700, anchor: "middle"});
      }
      // polymerase label
      if (s <= 2) api.label([(body[0] + body[1]) / 2 + (bac ? 8 : 0), body[2] - 10], T.pol, {color: c.c6, size: 12, weight: 700, anchor: "middle"});
      else api.label([s === 4 && !bac ? 386 : polX, rowB], s === 4 ? T.pol + (bac ? " lets go" : " runs on, then falls off") : T.pol, {color: c.c6, size: 12, weight: 700, anchor: s === 4 && !bac ? "end" : "middle"});
      api.root.querySelectorAll("text").forEach(function (el) { var col = el.getAttribute("fill"); if (col) el.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
