// A eukaryotic enhancer can sit kilobases to about a megabase from its gene, upstream or downstream, and still drive it:
// activators bound to the enhancer reach the promoter because the DNA between them loops out (cohesin helps), and the
// Mediator complex bridges the activators to RNA polymerase II and the general factors at the promoter. With no activators
// bound nothing is recruited and the gene runs at a low basal rate. An insulator (bound by CTCF) placed between the two puts
// them in separate loop domains, so that enhancer can no longer reach that promoter. Example at 1 Mb: the ZRS enhancer of
// Sonic hedgehog, about 1 Mb from the gene inside an intron of LMBR1. The loop's size is drawn on a log scale.
(function () {
  var DIST = ["2", "20", "100", "1000"];
  function looped(v) { return v.act && !v.ins; }
  function kb(v) { return v.dist === "1000" ? "1 Mb" : v.dist + " kb"; }

  Viz.register("eukaryotic-enhancer-promoter-looping", {
    title: "Enhancers: DNA looping brings activators to the promoter",
    subject: "biology",
    shows: "Move the enhancer near or far, upstream or downstream, and switch the activators or an insulator: the DNA loops so the enhancer touches the promoter through Mediator, unless nothing is bound or an insulator walls it off",
    params: {
      dist: {kind: "enum", values: DIST, default: "20", label: "\\text{distance}", names: {"2": "2 kb", "20": "20 kb", "100": "100 kb", "1000": "1 Mb"}},
      pos: {kind: "enum", values: ["upstream", "downstream"], default: "upstream", label: "\\text{enhancer}"},
      act: {kind: "boolean", default: true, label: "\\text{activator}", on: "bound", off: "absent"},
      ins: {kind: "boolean", default: false, label: "\\text{insulator}", on: "CTCF between", off: "none"}
    },
    formula: function (v) {
      var head = "\\begin{array}{l}\\text{enhancer } E\\text{: " + kb(v) + " " + v.pos + "}\\\\ ";
      if (looped(v)) return head + "E\\xrightarrow{\\text{loop + Mediator}}P\\ \\Rightarrow\\ \\text{high}\\end{array}";
      return head + "E\\ \\not\\!\\!\\longrightarrow\\ P\\ \\Rightarrow\\ \\text{basal (" + (v.act ? "insulator" : "no activators") + ")}\\end{array}";
    },
    status: function (v) {
      if (looped(v)) return "Activators on the enhancer, <b>" + kb(v) + " " + v.pos + "</b>, reach the promoter because the DNA between them loops out, and through Mediator they help load Pol II, so transcription runs <b>high</b>" +
        (v.dist === "1000" ? ", even across a megabase, as the Sonic hedgehog limb enhancer does." : ".");
      if (!v.act) return "With no activators bound the enhancer recruits nothing, no loop holds it at the promoter, and the gene runs only at its <b>basal</b> rate.";
      return "A CTCF-bound <b>insulator</b> between them puts the enhancer in a separate loop domain, so its activators cannot reach this promoter and transcription stays <b>basal</b>.";
    },
    examples: [
      {name: "looped, 2 kb", values: {dist: "2", act: true, ins: false}},
      {name: "looped, 1 Mb downstream", values: {dist: "1000", pos: "downstream"}},
      {name: "no activators", values: {act: false}},
      {name: "insulator between", values: {ins: true, dist: "100"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, y0 = 196, up = v.pos === "upstream", lg = Math.log10(Number(v.dist));
      var dna = function (d, col, w) { api.path(d, {stroke: col || c.muted, width: w || 4}); };
      var promoter = function (x) { api.rect(x - 12, y0 - 6, 24, 12, {rx: 3, fill: c.c2, fillOpacity: 0.5, stroke: c.c2, width: 1.2}); };
      var polII = function (x) {
        api.rect(x - 20, y0 + 6, 40, 26, {rx: 12, fill: c.c2, fillOpacity: 0.3, stroke: c.c2, width: 1.4});
        api.label([x, y0 + 19], "Pol II", {color: c.c2, size: 12, weight: 650, anchor: "middle"});
      };
      var enhancer = function (x) {
        api.rect(x - 16, y0 - 6, 32, 12, {rx: 3, fill: c.c3, fillOpacity: v.act ? 0.55 : 0.15, stroke: c.c3, width: 1.2});
        if (v.act) [-9, 9].forEach(function (dx) { api.circle([x + dx, y0 + 15], 8, {fill: c.c3, fillOpacity: 0.5, stroke: c.c3, width: 1.4}); });
      };
      var names = function (xE, xP, y, anchorE, anchorP) {
        api.label([xE, y], v.act ? "enhancer + activators" : "enhancer (empty)", {color: c.c3, size: 12, weight: 650, anchor: anchorE});
        api.label([xP, y], "promoter", {color: c.c2, size: 12, weight: 650, anchor: anchorP});
      };
      var geneArrow = function (x0, x1) { api.line([x0, y0], [x1, y0], {color: c.c4, width: 6}); api.arrow([x1 - 20, y0 - 18], [x1 + 2, y0 - 18], {color: c.c4, width: 2, halo: false, head: 7}); api.label([(x0 + x1) / 2, y0 - 18], "gene", {color: c.c4, size: 12, weight: 650, anchor: "middle"}); };
      if (looped(v)) {
        // the two feet of the loop sit side by side; Mediator bridges them under the DNA
        var xL = 176, xR = 236, K = (52 + 34 * lg) / 0.75, w = 34 + 26 * lg;
        var P = [[xL, y0], [xL - w, y0 - K], [xR + w, y0 - K], [xR, y0]];
        var bez = function (t) { var u = 1 - t; return [0, 1].map(function (i) { return u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]; }); };
        dna("M 14 " + y0 + " L " + xL + " " + y0); dna("M " + xR + " " + y0 + " L 386 " + y0);
        dna("M " + xL + " " + y0 + " C " + P[1].join(" ") + " " + P[2].join(" ") + " " + xR + " " + y0);
        if (up) { geneArrow(xR + 22, 360); }
        else {   // the gene starts at the left foot and runs up into the loop
          var g = []; for (var t = 0.03; t <= 0.36; t += 0.03) g.push(bez(t));
          api.polyline(g, {stroke: c.c4, width: 6});
          var gEnd = bez(0.4); api.line(g[g.length - 1], gEnd, {color: c.c4, width: 2.5, arrow: true});
          var gl = bez(0.2); api.label([gl[0] - 10, gl[1]], "gene", {color: c.c4, size: 12, weight: 650, anchor: "end"});
        }
        api.rect(xL - 22, y0 + 26, xR - xL + 44, 28, {rx: 14, fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.5});
        api.label([(xL + xR) / 2, y0 + 44], "Mediator", {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        var xE = up ? xL : xR, xP = up ? xR : xL;
        enhancer(xE); promoter(xP); polII(xP);
        names(up ? xL + 12 : xR - 12, up ? xR - 12 : xL + 12, y0 + 72, up ? "end" : "start", up ? "start" : "end");
        var top = bez(0.5);
        api.label([top[0], top[1] - 12], kb(v) + " looped out", {color: c.muted, size: 12, weight: 650, anchor: "middle"});
      } else {
        // straight DNA: the enhancer sits far away (the break stands for the distance)
        var xE = up ? 60 : 340, xP = up ? 230 : 60, xB = up ? 150 : 290;
        dna("M 14 " + y0 + " L " + (xB - 8) + " " + y0); dna("M " + (xB + 8) + " " + y0 + " L 386 " + y0);
        api.line([xB - 12, y0 + 10], [xB - 4, y0 - 10], {color: c.muted, width: 2}); api.line([xB + 4, y0 + 10], [xB + 12, y0 - 10], {color: c.muted, width: 2});
        api.label([xB, y0 + 24], kb(v), {color: c.muted, size: 12, weight: 650, anchor: "middle"});
        if (up) geneArrow(xP + 22, 360); else geneArrow(xP + 22, 218);
        enhancer(xE); promoter(xP); polII(xP);
        names(xE, xP, y0 + 50, "middle", "middle");
        if (v.ins) {
          var xI = up ? 190 : 250;
          api.polygon([[xI - 9, y0 - 12], [xI + 9, y0 - 12], [xI + 13, y0], [xI + 9, y0 + 12], [xI - 9, y0 + 12], [xI - 13, y0]], {fill: c.c1, fillOpacity: 0.6, stroke: c.c1});
          api.label([xI, y0 + 30], "CTCF", {color: c.c1, size: 12, weight: 700, anchor: "middle"});
          api.path("M " + xE + " " + (y0 - 14) + " Q " + ((xE + xI) / 2) + " " + (y0 - 90) + " " + (xI + (up ? -8 : 8)) + " " + (y0 - 22), {stroke: c.c3, width: 2, dash: "5 4", arrow: true});
          api.label([xI + (up ? 14 : -14), y0 - 34], "✕", {color: c.c5, size: 18, weight: 700, anchor: "middle", raw: true});
          api.label([(xE + xI) / 2, y0 - 72], "insulator: separate loop domain", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
        } else api.label([(xE + xP) / 2, y0 - 70], "no activators bound: no loop forms", {color: c.muted, size: 12, anchor: "middle"});
      }
      // output: transcripts per unit time, high when looped, basal otherwise
      var hi = looped(v), n = hi ? 5 : 1;
      api.label([386, 20], "transcription: " + (hi ? "high" : "basal"), {color: c.c5, size: 12.5, weight: 700, anchor: "end"});
      for (var k = 0; k < n; k++) {
        var x = 386 - k * 18, d = "M " + x + " 34";
        for (var j = 1; j <= 6; j++) d += " Q " + (x + (j % 2 ? 6 : -6)) + " " + (34 + j * 5 - 2.5) + " " + x + " " + (34 + j * 5);
        api.path(d, {stroke: c.c5, width: 2, opacity: hi ? 0.9 : 0.5});
      }
      api.label([386 - (n - 1) * 18 - 12, 50], "RNA", {color: c.c5, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (el) { var col = el.getAttribute("fill"); if (col) el.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
