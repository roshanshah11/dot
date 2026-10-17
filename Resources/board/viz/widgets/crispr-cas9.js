// CRISPR-Cas9 gene editing end to end: Cas9 carries a guide RNA, finds the matching DNA beside a PAM,
// cuts both strands 3 bp from the PAM, and the cell's repair decides the edit: error-prone NHEJ (knockout)
// or homology-directed repair from a donor template (precise edit).
Viz.register("crispr-cas9", {
  title: "CRISPR-Cas9 gene editing",
  subject: "biology",
  shows: "Step through guide loading, PAM search, the double-strand cut and the repair; switch the goal to see NHEJ knock a gene out or HDR copy in a precise edit",
  params: {
    edit_intent: {kind: "enum", values: ["gene knockout", "precise sequence edit"], default: "gene knockout", label: "goal",
                  names: {"gene knockout": "knockout", "precise sequence edit": "precise edit"}}
  },
  steps: ["load the guide", "find the PAM", "cut both strands", "repair"],
  stepMs: 1800,
  formula: function (v) {
    var s = v.step || 1, hdr = v.edit_intent !== "gene knockout";
    if (s === 1) return "\\text{Cas9} + \\text{gRNA (20-nt spacer)}" + (hdr ? " + \\text{donor DNA}" : "");
    if (s === 2) return "\\text{spacer} = \\text{target, next to } 5'\\text{-NGG-}3'";
    if (s === 3) return "\\text{cut at PAM} - 3\\text{ bp} \\Rightarrow \\text{blunt DSB}";
    return hdr ? "\\text{DSB} + \\text{donor} \\xrightarrow{\\text{HDR}} \\text{exact edit}" : "\\text{DSB} \\xrightarrow{\\text{NHEJ}} \\text{indel} \\Rightarrow \\text{frameshift}";
  },
  status: function (v) {
    var s = v.step || 1, hdr = v.edit_intent !== "gene knockout";
    if (s === 1) return "The guide's 20-nt spacer is written to match the target gene, and Cas9 holds it ready" +
      (hdr ? "; a <b>donor template</b> carrying the change goes in alongside." : "; for a <b>knockout</b> nothing else is needed.");
    if (s === 2) return "Cas9 grips a <b>PAM</b> (5′-NGG-3′), unwinds the DNA beside it, and the spacer base-pairs with the <b>target strand</b>.";
    if (s === 3) return "Cas9's two nuclease domains each cut one strand <b>3 bp upstream of the PAM</b>, leaving a blunt double-strand break.";
    return hdr ? "<b>HDR</b> uses the donor's homology arms as a template and copies the planned change in exactly (it needs dividing cells and is rarer than NHEJ)."
               : "<b>NHEJ</b> glues the ends back but often adds or loses a few bases; a shift in the reading frame <b>knocks the gene out</b>.";
  },
  examples: [
    {name: "knockout after repair", values: {edit_intent: "gene knockout", step: 4}},
    {name: "precise edit after repair", values: {edit_intent: "precise sequence edit", step: 4}},
    {name: "the cut", values: {step: 3}}
  ],
  size: [400, 232],
  draw: function (api, v) {
    var c = api.color, s = v.step || 1, hdr = v.edit_intent !== "gene knockout";
    var X0 = 24, X1 = 376, yT = 150, yB = 172, yG = yB - 11, yO = yT - 28, ps = 150, pe = 250, pam = 265, cut = 235, open = s === 2 || s === 3;
    // base-pair rungs (none inside the unwound bubble)
    for (var x = X0 + 6; x < X1; x += 8) {
      if (open && x > ps - 4 && x < pe) continue;
      api.line([x, yT + 3], [x, yB - 3], {color: c.faint, width: 1.2});
    }
    // the non-target strand is pushed up into a bubble while the guide pairs with the target strand
    var top = open ? "M " + X0 + " " + yT + " L " + (ps - 4) + " " + yT + " C " + (ps + 2) + " " + yT + " " + (ps + 2) + " " + yO + " " + (ps + 10) + " " + yO + " L " + (pe - 14) + " " + yO + " C " +
      (pe - 6) + " " + yO + " " + (pe - 6) + " " + yT + " " + pe + " " + yT + " L " + X1 + " " + yT : "M " + X0 + " " + yT + " L " + X1 + " " + yT;
    api.path(top, {stroke: c.c1, width: 5});
    api.line([X0, yB], [X1, yB], {color: c.c2, width: 5});
    api.label([X0 - 10, yT], "5′", {color: c.c1, size: 12, anchor: "middle"});
    api.label([X1 + 11, yT], "3′", {color: c.c1, size: 12, anchor: "middle"});
    api.label([X0 - 10, yB], "3′", {color: c.c2, size: 12, anchor: "middle"});
    api.label([X1 + 11, yB], "5′", {color: c.c2, size: 12, anchor: "middle"});
    // the PAM on the non-target strand, just 3' of the target
    if (s < 4) {
      api.rect(pe + 1, yT - 6, pam - pe, 12, {fill: c.ink, fillOpacity: 0.22, stroke: c.ink, width: 1, rx: 3});
      api.label([pam + 3, yT - 14], "PAM", {color: c.ink, size: 12, weight: 650, anchor: "start"});   // beside the box, on the top strand's side
    }
    if (s === 1) {
      api.path("M " + ps + " " + (yB + 8) + " L " + ps + " " + (yB + 12) + " L " + (pe - 4) + " " + (yB + 12) + " L " + (pe - 4) + " " + (yB + 8), {stroke: c.muted, width: 1.3});
      api.label([(ps + pe) / 2 - 10, yB + 25], "target (20 bp)", {color: c.muted, size: 12, anchor: "middle"});
      api.path("M 110 62 a 105 46 0 1 0 210 0 a 105 46 0 1 0 -210 0", {fill: c.c6, fillOpacity: 0.14, stroke: c.c6, width: 1.5});
      api.label([215, 30], "Cas9", {color: c.c6, size: 13, weight: 700, anchor: "middle"});
      api.line([135, 76], [230, 76], {color: c.c3, width: 4});
      api.path("M 230 76 C 244 76 248 64 250 52 C 252 38 266 38 266 52 C 266 62 262 70 272 76 C 282 82 292 78 294 66 C 296 54 308 54 308 66", {stroke: c.c3, width: 3});
      api.label([182, 92], "guide RNA", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.line([215, 112], [215, 136], {color: c.muted, width: 1.5, dash: "3 4", arrow: true});
      api.label([207, 123], "scans DNA for a PAM", {color: c.muted, size: 12, anchor: "end"});
    }
    if (open) {
      api.path("M 113 " + (yT - 4) + " a 92 50 0 1 0 184 0 a 92 50 0 1 0 -184 0", {fill: c.c6, fillOpacity: 0.12, stroke: c.c6, width: 1.5});
      api.label([205, yT - 66], "Cas9", {color: c.c6, size: 13, weight: 700, anchor: "middle"});
      api.line([ps, yG], [pe, yG], {color: c.c3, width: 4});
      for (var g = ps + 4; g < pe; g += 8) api.line([g, yG + 2], [g, yB - 3], {color: c.c3, width: 1.2, opacity: 0.7});
      if (s === 2) api.label([200, yB + 42], "guide RNA pairs with the target strand", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
    }
    if (s === 3) {
      [yO, yB].forEach(function (y) {
        api.rect(cut - 2.5, y - 4, 5, 8, {fill: c.card, rx: 0});
        api.line([cut - 6, y - 9], [cut + 6, y + 9], {color: c.c5, width: 2.5});
      });
      api.label([cut - 20, yB + 42], "both strands cut, 3 bp from the PAM", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
    }
    if (s === 4 && !hdr) {
      api.rect(cut - 5, yT - 4, 10, yB - yT + 8, {fill: c.c5, fillOpacity: 0.85, rx: 2});
      api.label([cut, yT - 30], "indel", {color: c.c5, size: 12.5, weight: 700, anchor: "middle"});
      for (var t = X0 + 6; t < X1 - 4; t += 15) {
        var after = t > cut + 5, tx = after ? t + 5 : t;
        if (Math.abs(tx - cut) < 9 || tx > X1 - 4) continue;
        api.line([tx, yT - 15], [tx, yT - 7], {color: after ? c.c5 : c.muted, width: 1.5});
      }
      api.label([90, yT - 26], "codons in frame", {color: c.muted, size: 12, anchor: "middle"});
      api.label([316, yT - 26], "frame shifted", {color: c.c5, size: 12, anchor: "middle"});
      api.label([200, yB + 30], "NHEJ rejoins the ends, a few bases gained or lost", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
    }
    if (s === 4 && hdr) {
      var yD = 90;
      api.line([160, yD], [310, yD], {color: c.ink, width: 5, opacity: 0.6});
      api.line([cut - 10, yD], [cut + 10, yD], {color: c.c4, width: 6});
      [165, 215, 255, 305].forEach(function (x) { api.line([x, yD + 6], [x, yT - 8], {color: c.muted, width: 1.2, dash: "3 4"}); });
      api.label([190, yD - 14], "left arm", {color: c.muted, size: 12, anchor: "middle"});
      api.label([cut, yD - 32], "donor template with homology arms", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      api.label([280, yD - 14], "right arm", {color: c.muted, size: 12, anchor: "middle"});
      api.rect(cut - 10, yT - 4, 20, yB - yT + 8, {fill: c.c4, fillOpacity: 0.85, rx: 2});
      api.label([200, yB + 30], "HDR copies the donor: the exact planned change", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
    }
    if (hdr && s < 4) {
      api.label([57, 24], "donor DNA", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      api.line([16, 40], [98, 40], {color: c.ink, width: 5, opacity: 0.6});
      api.line([48, 40], [66, 40], {color: c.c4, width: 6});
    }
  }
});
