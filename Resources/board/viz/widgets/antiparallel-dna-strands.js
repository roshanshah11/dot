// The two strands of a DNA double helix run in opposite directions. Each backbone is a chain of
// sugar-phosphate links from a 5' phosphate end to a 3' hydroxyl end; paired bases face each other, so one strand
// runs 5'->3' left to right and its partner 3'->5'. Read 5'->3', the partner is the reverse complement.
// A-T pairs share 2 hydrogen bonds, G-C pairs 3, so the bond count is 2 n_AT + 3 n_GC.
(function () {
  var PAIR = {A: "T", T: "A", G: "C", C: "G"};
  function top(v) {                                   // G/C pairs spread evenly along the strand
    var nGC = Math.round(v.gc * v.bp), s = "", a = 0, g = 0;
    for (var i = 0; i < v.bp; i++) {
      var isGC = Math.floor((i + 1) * nGC / v.bp) > Math.floor(i * nGC / v.bp);
      s += isGC ? "GCCG".charAt(g++ % 4) : "ATTA".charAt(a++ % 4);
    }
    return s;
  }
  function comp(s) { return s.split("").map(function (b) { return PAIR[b]; }).join(""); }
  function counts(s) { var gc = (s.match(/[GC]/g) || []).length; return {gc: gc, at: s.length - gc, h: 2 * (s.length - gc) + 3 * gc}; }

  Viz.register("antiparallel-dna-strands", {
    title: "Antiparallel DNA strands",
    subject: "biology",
    shows: "The two strands of DNA run opposite ways, 5′→3′ against 3′→5′: read the partner 5′→3′ and you get the reverse complement; A–T pairs hold by 2 hydrogen bonds, G–C by 3",
    params: {
      bp: {kind: "integer", default: 8, min: 4, max: 10, label: "\\text{base pairs}"},
      gc: {kind: "number", default: 0.5, min: 0, max: 1, step: 0.1, label: "\\text{GC share}"},
      read: {kind: "enum", values: ["top", "bottom"], default: "bottom", label: "\\text{read}"}
    },
    formula: function (v) {
      var t = top(v), b = comp(t), k = counts(t);
      return "\\begin{array}{l}5'\\text{-}\\texttt{" + t + "}\\text{-}3'\\\\3'\\text{-}\\texttt{" + b + "}\\text{-}5'\\end{array}\\newline H=2\\cdot\\underbrace{" + k.at + "}_{\\text{A–T}}+3\\cdot\\underbrace{" + k.gc + "}_{\\text{G–C}}=" + k.h;
    },
    status: function (v) {
      var t = top(v), b = comp(t), k = counts(t), rc = b.split("").reverse().join("");
      var lead = v.read === "top" ? "Read 5′→3′, the top strand is <b>5′-" + t + "-3′</b> and its partner, read the same way, is <b>5′-" + rc + "-3′</b>"
                                  : "Read 5′→3′ (right to left), the bottom strand is <b>5′-" + rc + "-3′</b>, the reverse complement of the top";
      return lead + "; its " + v.bp + " pairs (" + k.at + " A–T, " + k.gc + " G–C) share <b>" + k.h + "</b> hydrogen bonds.";
    },
    examples: [
      {name: "all A–T, shortest", values: {bp: 4, gc: 0, read: "top"}},
      {name: "all G–C, longest", values: {bp: 10, gc: 1, read: "bottom"}},
      {name: "half G–C", values: {bp: 8, gc: 0.5, read: "bottom"}}
    ],
    size: [400, 272],
    draw: function (api, v) {
      var c = api.color, t = top(v), b = comp(t), n = v.bp;
      var x0 = 70, x1 = 330, dx = n > 1 ? (x1 - x0) / (n - 1) : 0, X = function (i) { return x0 + i * dx; };
      var yT = 88, yB = 192, readTop = v.read === "top";
      // sugar = pentagon (flipped on the partner strand), phosphate = small circle linking one sugar's 3' carbon to the next one's 5'
      var sugar = function (x, y, flip, col) {
        var pts = [];
        for (var k = 0; k < 5; k++) { var a = -Math.PI / 2 + k * 2 * Math.PI / 5; pts.push([x + 8 * Math.cos(a), y + (flip ? -1 : 1) * 8 * Math.sin(a)]); }
        api.polygon(pts, {fill: col, fillOpacity: 0.28, stroke: col, width: 1.4});
      };
      var strand = function (y, col, dir, seq, flip) {   // dir +1: 5' at the left
        api.line([X(0) - 26, y], [X(n - 1) + 26, y], {color: col, width: 3, opacity: 0.55});
        for (var i = 0; i < n; i++) {
          if (i < n - 1) {
            var mx = (X(i) + X(i + 1)) / 2;
            api.circle([mx, y], 5, {fill: c.card, stroke: col, width: 1.5});
          }
          var by = flip ? y - 34 : y + 34;
          api.line([X(i), y], [X(i), by + (flip ? 9 : -9)], {color: col, width: 2.2});
          sugar(X(i), y, flip, col);
          api.label([X(i), by], seq.charAt(i), {color: col, size: 15, weight: 750, anchor: "middle", clamp: false});
        }
        var left = dir > 0 ? "5′" : "3′", right = dir > 0 ? "3′" : "5′";
        api.label([X(0) - 32, y], left, {color: col, size: 14, weight: 700, anchor: "end"});
        api.label([X(n - 1) + 32, y], right, {color: col, size: 14, weight: 700});
        api.label([X(0) - 32, y + (flip ? 16 : -16)], dir > 0 ? "P" : "OH", {color: col, size: 12, anchor: "end"});
        api.label([X(n - 1) + 32, y + (flip ? 16 : -16)], dir > 0 ? "OH" : "P", {color: col, size: 12});
      };
      strand(yT, c.c1, 1, t, false);
      strand(yB, c.c2, -1, b, true);
      // hydrogen bonds: 2 dashes for A-T, 3 for G-C
      for (var i = 0; i < n; i++) {
        var nb = /[GC]/.test(t.charAt(i)) ? 3 : 2;
        for (var k = 0; k < nb; k++) {
          var hx = X(i) + (k - (nb - 1) / 2) * 5;
          api.line([hx, yT + 45], [hx, yB - 45], {color: c.c3, width: 1.6, dash: "3 3"});
        }
      }
      // reading direction of each strand, the one being read in its own color
      var arrowY = function (isTop) { return isTop ? yT - 46 : yB + 46; };
      [[true, c.c1], [false, c.c2]].forEach(function (q) {
        var on = q[0] === readTop, y = arrowY(q[0]), a = q[0] ? [X(0), y] : [X(n - 1), y], z = q[0] ? [X(n - 1), y] : [X(0), y];
        api.arrow(a, z, {color: on ? q[1] : c.faint, width: on ? 3 : 1.6, halo: on});
        var seq = q[0] ? t : b.split("").reverse().join("");
        api.label([200, y + (q[0] ? -15 : 15)], (q[0] ? "top" : "bottom") + " 5′→3′: " + seq + (on ? "  (reading)" : ""),
          {color: on ? q[1] : c.muted, size: 12.5, weight: on ? 700 : 500, anchor: "middle"});
      });
      api.label([352, (yT + yB) / 2], "A–T: 2", {color: c.c3, size: 12, weight: 600, anchor: "start"});
      api.label([352, (yT + yB) / 2 + 16], "G–C: 3", {color: c.c3, size: 12, weight: 600, anchor: "start"});
      api.label([352, (yT + yB) / 2 - 16], "H-bonds", {color: c.c3, size: 12, anchor: "start"});
      // viz.css paints svg text ink; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
