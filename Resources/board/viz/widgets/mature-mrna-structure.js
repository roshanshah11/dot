// A mature eukaryotic mRNA, introns already spliced out, drawn to scale from 5' to 3': the cap (7-methylguanosine
// joined 5'-to-5' by a triphosphate, not counted in the length), the 5' UTR, the coding sequence from the AUG start
// codon through the stop codon (n amino acids need n codons plus the stop: 3(n + 1) nt), the 3' UTR with its AAUAAA
// polyadenylation signal, and the poly(A) tail added after cleavage. Segments thinner than 6 px are widened to stay
// visible; their lengths are always labelled.
(function () {
  var X0 = 62, W = 318, BY = 112, BH = 20, MIN = 6;
  function parts(v) { return [{k: "utr5", len: v.utr5}, {k: "cds", len: 3 * (v.aa + 1)}, {k: "utr3", len: v.utr3}, {k: "polyA", len: v.polyA}]; }
  function layout(v) {   // pixel widths to scale, with a floor so a short segment never vanishes
    var ps = parts(v).filter(function (p) { return p.len > 0; }), fixed = 0, free = ps.slice(), k;
    for (var it = 0; it < 4; it++) {
      var tot = free.reduce(function (s, p) { return s + p.len; }, 0);
      k = (W - fixed) / tot;
      var small = free.filter(function (p) { return p.len * k < MIN; });
      if (!small.length) break;
      small.forEach(function (p) { p.w = MIN; fixed += MIN; free.splice(free.indexOf(p), 1); });
    }
    var x = X0, out = {};
    ps.forEach(function (p) { if (p.w == null) p.w = p.len * k; p.x = x; x += p.w; out[p.k] = p; });
    out.end = x;
    return out;
  }
  function total(v) { return v.utr5 + 3 * (v.aa + 1) + v.utr3 + v.polyA; }
  Viz.register("mature-mrna-structure", {
    title: "Mature mRNA: cap, UTRs, coding sequence, tail",
    subject: "biology",
    shows: "Step from the 5′ cap to the poly(A) tail of a spliced mRNA and change the lengths: only the stretch from AUG to the stop codon is translated, 3 nt per amino acid",
    params: {
      utr5: {kind: "integer", default: 80, min: 20, max: 300, step: 10, label: "5'\\,\\text{UTR}"},
      aa: {kind: "integer", default: 300, min: 50, max: 1000, step: 10, label: "n_{\\text{aa}}"},
      utr3: {kind: "integer", default: 600, min: 50, max: 2000, step: 50, label: "3'\\,\\text{UTR}"},
      polyA: {kind: "integer", default: 200, min: 0, max: 250, step: 10, label: "\\text{poly(A)}"}
    },
    steps: ["5′ cap", "5′ UTR", "start codon", "coding sequence", "stop codon", "3′ UTR", "poly(A) tail"],
    stepMs: 1700,
    formula: function (v) {
      return "L=L_{5'}+3(n_{\\text{aa}}+1)+L_{3'}+L_{A}\\newline=" + v.utr5 + "{+}3\\cdot " + (v.aa + 1) + "{+}" + v.utr3 + "{+}" + v.polyA + "=" + String(total(v)).replace(/(\d)(?=(\d{3})+$)/, "$1{,}") + "\\ \\text{nt}";
    },
    status: function (v) {
      var s = v.step || 1;
      if (s === 1) return "The <b>5′ cap</b> is a 7-methylguanosine joined backwards (5′ to 5′) by a triphosphate: it guards the end from exonucleases, helps export, and is where the ribosome loads.";
      if (s === 2) return "The <b>" + v.utr5 + "-nt</b> 5′ UTR is not translated: the small ribosomal subunit binds at the cap and scans along it for the first AUG.";
      if (s === 3) return "The start codon <b>AUG</b> sets the reading frame and codes methionine, the first of the protein's " + v.aa + " amino acids.";
      if (s === 4) return "From AUG to the stop is <b>" + 3 * (v.aa + 1) + " nt</b>: " + v.aa + " codons read 3 nt at a time give a <b>" + v.aa + "-amino-acid</b> protein, then the stop.";
      if (s === 5) return "The stop codon (UAA, UAG or UGA) has no matching tRNA: a release factor binds and lets the " + v.aa + "-amino-acid protein go; the stop codes no amino acid.";
      if (s === 6) return "The <b>" + v.utr3 + "-nt</b> 3′ UTR is not translated: it holds signals for stability, location and microRNA binding, plus the AAUAAA that marked where the tail went on.";
      if (v.polyA === 0) return "With <b>no tail</b> left the mRNA is deadenylated: decapping and decay follow quickly.";
      return "About <b>" + v.polyA + " A's</b> were added after cleavage, not copied from DNA: the tail and its binding proteins protect the mRNA and help translation, and it shortens with age.";
    },
    examples: [
      {name: "shortest settings, tail gone", values: {utr5: 20, aa: 50, utr3: 50, polyA: 0, step: 7}},
      {name: "longest settings", values: {utr5: 300, aa: 1000, utr3: 2000, polyA: 250, step: 4}},
      {name: "the 5′ cap", values: {step: 1}},
      {name: "the start codon", values: {step: 3}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, L = layout(v), mid = BY + BH / 2;
      var col = {utr5: c.c2, cds: c.c1, utr3: c.c2, polyA: c.c3};
      var name = {utr5: "5′ UTR", cds: "coding sequence", utr3: "3′ UTR", polyA: "poly(A)"};
      var focus = ["cap", "utr5", "start", "cds", "stop", "utr3", "polyA"][s - 1];
      // the segments
      ["utr5", "cds", "utr3"].forEach(function (k) {
        var p = L[k];
        api.rect(p.x, BY, p.w, BH, {fill: col[k], fillOpacity: focus === k ? 0.6 : 0.25, stroke: focus === k ? c.ink : null, width: 1.4, rx: 2});
      });
      if (L.polyA) {
        api.rect(L.polyA.x, mid - 5, L.polyA.w, 10, {fill: c.c3, fillOpacity: focus === "polyA" ? 0.85 : 0.45, stroke: focus === "polyA" ? c.ink : null, width: 1.4, rx: 5});
      }
      // start and stop codons: 3 nt each, drawn at least 5 px wide
      var cw = Math.max(5, 3 * L.cds.w / L.cds.len), sx = L.cds.x, ex = L.cds.x + L.cds.w - cw;
      api.rect(sx, BY - 3, cw, BH + 6, {fill: c.c4, stroke: focus === "start" ? c.ink : null, width: 1.4, rx: 1.5});
      api.rect(ex, BY - 3, cw, BH + 6, {fill: c.c5, stroke: focus === "stop" ? c.ink : null, width: 1.4, rx: 1.5});
      api.label([sx + cw / 2, BY - 14], "AUG", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      api.label([ex + cw / 2, BY - 14], "UAA", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      // AAUAAA, 10-30 nt upstream of where the tail starts
      var sig = L.utr3.x + L.utr3.w - Math.max(4, 25 * L.utr3.w / L.utr3.len);
      api.line([sig, BY + 2], [sig, BY + BH - 2], {color: c.ink, width: 2, opacity: 0.7});
      // the cap: m7G joined to the first nucleotide by three phosphates
      api.line([46, mid], [X0, mid], {color: c.c6, width: 2});
      [50, 54.5, 59].forEach(function (x) { api.circle([x, mid], 2.2, {fill: c.c6}); });
      api.circle([32, mid], 14, {fill: c.c6, fillOpacity: focus === "cap" ? 0.6 : 0.25, stroke: focus === "cap" ? c.ink : c.c6, width: 1.4});
      api.label([32, mid + 0.5], "m^7G", {color: c.ink, size: 12, anchor: "middle", weight: 600});
      api.label([4, mid], "5′", {color: c.muted, size: 12, anchor: "start"});
      api.label([L.end + 4, mid], "3′", {color: c.muted, size: 12, anchor: "start"});
      // names under the bar, staggered into a second row when they would collide
      var rows = [[], []];
      [["cap", 32, "cap", c.c6]].concat(["utr5", "cds", "utr3", "polyA"].filter(function (k) { return L[k]; }).map(function (k) { return [k, L[k].x + L[k].w / 2, name[k], col[k]]; }), L.polyA ? [] : [["polyA", L.end - 4, "no tail", c.c5]])
        .forEach(function (e) {
          var w = e[2].length * 12 * 0.56 + 8, lo = e[1] - w / 2, r = rows[0].some(function (q) { return lo < q; }) ? 1 : 0;
          rows[r].push(e[1] + w / 2);
          var y = BY + BH + 16 + r * 15;
          if (r) api.line([e[1], BY + BH + 2], [e[1], y - 7], {color: e[3], width: 1});
          api.label([e[1], y], e[2], {color: e[3], size: 12, weight: focus === e[0] ? 700 : 500, anchor: "middle"});
        });
      // what the ribosome makes: only AUG..stop is read
      var by = 196;
      api.path("M " + sx + " " + (by - 8) + " L " + sx + " " + by + " L " + (ex + cw) + " " + by + " L " + (ex + cw) + " " + (by - 8), {stroke: c.c1, width: 1.4});
      api.label([(sx + ex + cw) / 2, by + 13], (v.aa + 1) + " codons = " + 3 * (v.aa + 1) + " nt", {color: c.c1, size: 12, anchor: "middle"});
      var pw = 40 + 280 * v.aa / 1000, px = 200 - pw / 2, py = 252, d = "M " + px + " " + py;
      for (var x = px; x < px + pw; x += 8) d += " q 2 -6 4 0 t 4 0";
      api.path(d, {stroke: c.c4, width: 2.4, opacity: s >= 3 ? 1 : 0.45});
      api.line([200, by + 22], [200, py - 12], {color: c.muted, width: 1.4, arrow: true});
      api.label([200, py + 22], "protein: " + v.aa + " amino acids (the stop adds none)", {color: c.c4, size: 12.5, weight: 600, anchor: "middle"});
      // callout for the current part
      var info = {cap: ["5′ cap (m⁷G)", 32], utr5: [v.utr5 + " nt, untranslated", L.utr5.x + L.utr5.w / 2], start: ["start: AUG = Met", sx],
        cds: [3 * (v.aa + 1) + " nt, translated", L.cds.x + L.cds.w / 2], stop: ["stop: UAA, UAG or UGA", ex], utr3: [v.utr3 + " nt, untranslated; AAUAAA near its end", sig],
        polyA: [v.polyA ? v.polyA + " A's, not in the gene" : "tail gone: decay next", L.polyA ? L.polyA.x + L.polyA.w / 2 : L.end]}[focus];
      api.line([info[1], 50], [info[1], BY - 24], {color: c.accent, width: 1.2, dash: "3 3"});
      api.label([info[1], 40], info[0], {color: c.accent, size: 13, weight: 650, anchor: info[1] < 110 ? "start" : info[1] > 290 ? "end" : "middle"});
      api.label([200, 300], "mature mRNA: exons only, introns already spliced out", {color: c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
