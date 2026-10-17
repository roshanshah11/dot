// How a microRNA turns a gene down. Dicer cuts the exported pre-miRNA hairpin into a ~22-nt duplex; Argonaute keeps one
// strand (the guide) and drops the passenger; the guide's seed (nucleotides 2-8) finds matching sites in the target's
// 3' UTR. With seed-only pairing (typical animal miRNA) GW182/TNRC6 recruits the CCR4-NOT deadenylase: the tail
// shortens, initiation is blocked, then the mRNA is decapped and decays. With full pairing (siRNA-like) Ago2 slices the
// mRNA across from guide nucleotides 10-11. Output is illustrative: each seed site leaves about 70% of the protein and
// sites multiply (most real targets drop by less than half); a full-match cut leaves about 10%.
(function () {
  var KEEP = 0.7, CUT = 0.1, SX = 236, SW = 30;
  function out(v) { return v.sites === 0 ? 1 : v.pairing === "full" ? CUT : Math.pow(KEEP, v.sites); }
  function pct(x) { return Math.round(100 * x); }
  Viz.register("microrna-mrna-translational-silencing", {
    title: "MicroRNA silencing of an mRNA",
    subject: "biology",
    shows: "Step from Dicer to silencing and change the sites in the 3′ UTR: seed-paired miRNAs trim the tail and block translation, a little more per site; a full match lets Argonaute slice the mRNA",
    params: {
      pairing: {kind: "enum", values: ["seed", "full"], names: {seed: "seed only (miRNA)", full: "full match (siRNA-like)"}, default: "seed", label: "\\text{pairing}"},
      sites: {kind: "integer", default: 2, min: 0, max: 4, label: "\\text{sites}"}
    },
    steps: ["Dicer cuts the hairpin", "Argonaute keeps the guide", "the seed finds the 3′ UTR", "silencing", "less protein"],
    stepMs: 1800,
    formula: function (v) {
      if (v.sites === 0) return "P = 100\\%\\ \\ (\\text{no site, no binding})";
      if (v.pairing === "full") return "P \\approx " + pct(CUT) + "\\%\\ \\ (\\text{one cut ruins the mRNA})";
      return "P = 0.7^{\\,n} = 0.7^{" + v.sites + "} = " + pct(out(v)) + "\\%";
    },
    status: function (v) {
      var s = v.step || 1, n = v.sites, full = v.pairing === "full";
      if (s === 1) return "Dicer cuts the pre-miRNA hairpin, exported from the nucleus, into a duplex about <b>22 nucleotides</b> long.";
      if (s === 2) return "Argonaute keeps one strand as the guide and throws the passenger strand away: guide plus Argonaute is the silencing complex, RISC.";
      if (s === 3) return n === 0 ? "This mRNA's 3′ UTR has <b>no</b> site matching the seed, so RISC never binds and the gene is not silenced."
        : "The guide's seed (nucleotides 2 to 8) pairs with <b>" + n + "</b> site" + (n > 1 ? "s" : "") + " in the 3′ UTR" + (full ? ", and here the rest of the guide matches too." : "; the rest of the guide stays unpaired.");
      if (s === 4) return n === 0 ? "With nothing bound, ribosomes keep translating at the normal rate."
        : full ? "Fully paired, Argonaute 2 <b>slices</b> the mRNA across from guide nucleotides 10 and 11, and the two pieces are degraded."
        : "Seed-bound RISC recruits the CCR4–NOT deadenylase: the <b>poly(A) tail shortens</b> and ribosomes stop starting on the message.";
      if (n === 0) return "No site, no silencing: protein output stays at <b>100%</b>.";
      return full ? "The cut mRNA is destroyed, so protein falls to about <b>" + pct(out(v)) + "%</b>, whatever the number of sites."
        : "With " + n + " site" + (n > 1 ? "s" : "") + " the tail-less mRNA is decapped and decays: protein made falls to about <b>" + pct(out(v)) + "%</b> (each site leaves about 70%).";
    },
    examples: [
      {name: "no site in the 3′ UTR", values: {pairing: "seed", sites: 0, step: 5}},
      {name: "four seed sites", values: {pairing: "seed", sites: 4, step: 5}},
      {name: "full match: Argonaute slices", values: {pairing: "full", sites: 1, step: 4}},
      {name: "seed pairing close up", values: {pairing: "seed", sites: 2, step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, n = v.sites, full = v.pairing === "full", P = out(v), silenced = s >= 4 && n > 0;
      var Y = 190, cut = silenced && full;
      // ---- top band: biogenesis (steps 1-2) or the guide pairing with one site (steps 3-5)
      if (s === 1) {
        api.line([40, 46], [150, 46], {color: c.c5, width: 2.4}); api.line([40, 58], [150, 58], {color: c.c5, width: 2.4});
        for (var x = 46; x < 150; x += 8) api.line([x, 48], [x, 56], {color: c.c5, width: 1, opacity: 0.6});
        api.path("M 150 46 C 172 34 172 70 150 58", {stroke: c.c5, width: 2.4});
        api.line([132, 34], [132, 70], {color: c.c3, width: 2, dash: "3 3"});
        api.label([132, 82], "Dicer cuts", {color: c.c3, size: 12, anchor: "middle"});
        api.label([40, 24], "pre-miRNA hairpin", {color: c.c5, size: 12});
        api.arrow([186, 52], [226, 52], {color: c.muted, width: 2, halo: false});
        api.line([244, 46], [354, 46], {color: c.c5, width: 2.4}); api.line([234, 58], [344, 58], {color: c.muted, width: 2.4});
        api.label([294, 76], "~22-nt duplex", {color: c.c5, size: 12, anchor: "middle"});
      } else if (s === 2) {
        api.rect(120, 30, 210, 46, {fill: c.c6, fillOpacity: 0.16, stroke: c.c6, width: 1.4, rx: 22});
        api.label([226, 20], "Argonaute + guide = RISC", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
        api.line([140, 53], [310, 53], {color: c.c5, width: 3});
        api.label([316, 53], "guide", {color: c.c5, size: 12});
        api.line([40, 92], [130, 104], {color: c.muted, width: 2.4, dash: "5 4"});
        api.label([40, 80], "passenger, discarded", {color: c.muted, size: 12});
      } else {
        // guide drawn 3' -> 5' left to right over the mRNA site 5' -> 3'; nt 1 is the guide's 5' end on the right
        var gx = function (k) { return 330 - (k - 1) * 10; };   // x of guide nucleotide k (1..22)
        api.rect(96, 26, 252, 36, {fill: c.c6, fillOpacity: 0.12, stroke: c.c6, width: 1.2, rx: 18});
        api.label([100, 18], "RISC", {color: c.c6, size: 12, weight: 650});
        api.line([gx(22), 46], [gx(1), 46], {color: c.c5, width: 3});
        api.label([gx(1) + 8, 46], "5′", {color: c.c5, size: 12});
        api.line([gx(22), 92], [gx(1), 92], {color: c.c2, width: 3, opacity: n ? 1 : 0.35});
        api.label([gx(1) + 8, 92], "3′", {color: c.c2, size: 12});
        api.label([gx(22) - 8, 92], "mRNA site 5′", {color: c.c2, size: 12, anchor: "end"});
        if (n) for (var k = 2; k <= 21; k++) {
          var paired = k <= 8 || full;
          if (paired) api.line([gx(k), 50], [gx(k), 88], {color: k <= 8 ? c.c3 : c.ink, width: 1.6, opacity: k <= 8 ? 1 : 0.7});
        }
        api.path("M " + (gx(8) - 4) + " 98 L " + (gx(8) - 4) + " 104 L " + (gx(2) + 4) + " 104 L " + (gx(2) + 4) + " 98", {stroke: c.c3, width: 1.2});
        api.label([(gx(8) + gx(2)) / 2, 116], "seed, nt 2–8", {color: c.c3, size: 12, anchor: "middle"});
        if (full && n) {
          api.line([(gx(10) + gx(11)) / 2, 84], [(gx(10) + gx(11)) / 2, 104], {color: c.c5, width: 2.4});
          api.label([(gx(10) + gx(11)) / 2 + 2, 116], "Ago2 cuts here", {color: c.c5, size: 12, anchor: "end"});
        }
        if (!n) api.label([180, 116], "no matching site", {color: c.muted, size: 12, anchor: "middle"});
      }
      // ---- the target mRNA: cap, 5' UTR, coding sequence, 3' UTR with its sites, poly(A) tail
      var tail = silenced && !full ? 8 : 30, gone = s === 5 && n > 0 ? 0.45 : 1;
      api.circle([22, Y], 6, {fill: c.c6, opacity: gone});
      api.line([28, Y], [70, Y], {color: c.c2, width: 2.4, opacity: gone});
      api.rect(70, Y - 6, 150, 12, {fill: c.c1, fillOpacity: 0.35, stroke: c.c1, width: 1.2, rx: 3, opacity: gone});
      var mid = cut ? SX + 11 : null;
      api.line([220, Y], [cut ? mid - 6 : 360, Y], {color: c.c2, width: 2.4, opacity: gone});
      if (cut) api.line([mid + 6, Y + 6], [360, Y + 6], {color: c.c2, width: 2.4, opacity: gone});
      api.rect(360, (cut ? Y + 6 : Y) - 4, tail, 8, {fill: c.c3, fillOpacity: 0.8, rx: 4, opacity: gone});
      api.label([376, Y + 18], silenced && !full ? "short tail" : "AAAA", {color: c.c3, size: 12, anchor: "middle"});
      api.label([145, Y + 22], "coding sequence", {color: c.c1, size: 12, anchor: "middle"});
      api.label([290, Y + 30], "3′ UTR", {color: c.c2, size: 12, anchor: "middle"});
      for (var i = 0; i < n; i++) {
        var x0 = SX + i * SW, w = full ? 22 : 9, dy = cut && i > 0 ? 6 : 0;
        api.rect(x0, Y - 5 + dy, w, 10, {fill: c.c3, fillOpacity: 0.5, stroke: c.c3, width: 1, rx: 2});
        if (s >= 3) api.circle([x0 + w / 2, Y - 18 + dy], 9, {fill: c.c6, fillOpacity: 0.5, stroke: c.c6, width: 1.4});
      }
      if (s >= 3 && n) api.label([SX + ((n - 1) * SW + (full ? 22 : 9)) / 2, Y - 36], n > 1 ? "RISCs" : "RISC", {color: c.c6, size: 12, anchor: "middle"});
      // ribosomes on the coding sequence: fewer once the message is silenced
      var ribo = silenced ? Math.round(5 * P) : 5;
      for (var r = 0; r < ribo; r++) {
        var rx = 82 + r * 28;
        api.rect(rx, Y - 20, 18, 12, {fill: c.muted, fillOpacity: 0.55, rx: 6});
        api.path("M " + (rx + 9) + " " + (Y - 20) + " q 3 -5 0 -9", {stroke: c.c4, width: 2});
      }
      api.label([22, Y - 34], "target mRNA, " + (silenced ? ribo + " ribosome" + (ribo === 1 ? "" : "s") : "5 ribosomes"), {color: c.muted, size: 12});
      if (silenced && !full && s === 4) {
        var lx = SX + (n - 1) * SW + 9;
        api.path("M " + (lx + 6) + " " + (Y - 24) + " Q " + ((lx + 364) / 2) + " " + (Y - 44) + " 364 " + (Y - 8), {stroke: c.c6, width: 1.4, dash: "3 3", arrow: true});
        api.label([392, Y - 46], "CCR4–NOT", {color: c.c6, size: 12, anchor: "end"});
      }
      if (s === 5 && n) api.label([200, Y + 46], full ? "pieces degraded" : "decapped, then degraded", {color: c.muted, size: 12, anchor: "middle"});
      // ---- protein output once silencing has run its course
      var BX = 120, BW = 250, BY = 262;
      api.rect(BX, BY, BW, 16, {stroke: c.muted, width: 1.2, dash: "4 3", rx: 4});
      api.rect(BX, BY, BW * P, 16, {fill: c.c4, fillOpacity: 0.8, rx: 4});
      api.label([BX - 8, BY + 8], "protein made", {color: c.c4, size: 12, anchor: "end"});
      api.label([BX + BW * P + (P > 0.8 ? -6 : 6), BY + 8], pct(P) + "%", {color: P > 0.8 ? c.card : c.c4, size: 12.5, weight: 700, anchor: P > 0.8 ? "end" : "start"});
      api.label([BX + BW, BY + 28], "dashed: no microRNA (100%)", {color: c.muted, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
