// A bacterial transcription unit: promoter, start site (+1), transcribed region, terminator. Positions are counted from
// +1 with no zero (the base before +1 is -1). The sigma-70 promoter is a -35 box (consensus TTGACA, at -35..-30 with the
// usual spacer) and a -10 box (TATAAT, at -12..-7), written on the coding strand. The spacer between them is best at
// 17 bp: B-DNA turns once per 10.5 bp, so each base off rotates the -35 box 360/10.5 = 34.3 degrees away from the face
// sigma reaches, besides moving it 3.4 A. The promoter's orientation sets the direction: the strand read 3'->5' from +1
// is the template, and the RNA (from +1 to the terminator, L nt) copies the other, coding strand.
(function () {
  var REV = {TTGACA: "TGTCAA", TATAAT: "ATTATA"};   // the top strand when the gene points left
  function boxes(s) { return {b35: [-(18 + s), -(13 + s)], b10: [-12, -7]}; }

  Viz.register("transcription-unit-promoter-terminator", {
    title: "A transcription unit: promoter to terminator",
    subject: "biology",
    shows: "Flip the gene's direction, change the spacer between the -35 and -10 boxes, and the RNA length: the promoter sets where and which way transcription runs, and which strand is the template",
    params: {
      dir: {kind: "enum", values: ["right", "left"], names: {right: "→ rightward", left: "← leftward"}, default: "right", label: "\\text{gene}"},
      spacer: {kind: "integer", default: 17, min: 15, max: 19, label: "\\text{spacer}"},
      len: {kind: "integer", default: 900, min: 300, max: 1500, step: 100, label: "L\\ \\text{(nt)}"}
    },
    formula: function (v) {
      var d = (v.spacer - 17) * 360 / 10.5;
      return "\\begin{array}{l}\\Delta\\theta=(" + v.spacer + "-17)\\cdot\\dfrac{360^\\circ}{10.5}=" + Viz.n(d, 0) + "^\\circ\\\\" +
        "L=(+" + v.len + ")-(+1)+1=" + v.len + "\\ \\text{nt}\\end{array}";
    },
    status: function (v) {
      var b = boxes(v.spacer), d = Math.abs((v.spacer - 17) * 360 / 10.5), right = v.dir === "right";
      var str = right ? "the bottom strand is the template and the RNA matches the top strand" : "the top strand is the template and the RNA matches the bottom strand";
      var fit = v.spacer === 17 ? "the boxes sit on the face sigma reaches, the strongest arrangement"
        : "the −35 box (now −" + -b.b35[0] + " to −" + -b.b35[1] + ") is turned <b>" + Viz.fmt(d, 0) + "°</b> off sigma's face, a weaker promoter";
      return "Pointing " + (right ? "right" : "left") + ", " + str + " for <b>" + v.len + " nt</b>; with " + (v.spacer === 18 ? "an " : "a ") + v.spacer + " bp spacer " + fit + ".";
    },
    examples: [
      {name: "short spacer, short gene", values: {spacer: 15, len: 300}},
      {name: "long spacer, long gene", values: {spacer: 19, len: 1500}},
      {name: "gene on the other strand", values: {dir: "left", spacer: 17, len: 900}}
    ],
    size: [400, 284],
    draw: function (api, v) {
      var c = api.color, right = v.dir === "right", b = boxes(v.spacer), L = v.len;
      var X = function (x) { return right ? x : 400 - x; }, A = function (a) { return right ? a : a === "start" ? "end" : a === "end" ? "start" : a; };
      var lab = function (at, t, col, o) { o = Object.assign({color: col, size: 12, anchor: "middle"}, o || {}); o.anchor = A(o.anchor); api.label([X(at[0]), at[1]], t, o); };
      var bp = function (p) { return 16 + (p < 0 ? p + 45 : p + 44) * 2.9; };              // left edge of base p, no zero
      var gx = function (p) { return p <= 14 ? bp(p) : 200 + (p - 15) / 1500 * 150; };       // bp scale, a break, then gene scale (+1500 at 348)
      var yT = 124, yB = 138, end = gx(L) + 2.9;
      // transcribed region
      var x1 = gx(1), xa = Math.min(X(x1), X(end)), xb = Math.max(X(x1), X(end));
      api.rect(xa, yT - 10, xb - xa, yB - yT + 20, {rx: 4, fill: c.c4, fillOpacity: 0.14});
      lab([(x1 + end) / 2 + 30, yB + 22], "transcribed region", c.c4, {weight: 600});
      // the two strands: top runs 5'->3' left to right
      var coding = right ? "top" : "bottom";
      api.line([22, yT], [378, yT], {color: coding === "top" ? c.c2 : c.c1, width: coding === "top" ? 2.5 : 4});   // ends clear of the 5'/3' labels
      api.line([22, yB], [378, yB], {color: coding === "top" ? c.c1 : c.c2, width: coding === "top" ? 4 : 2.5});
      api.label([4, yT], "5′", {color: c.muted, size: 12}); api.label([396, yT], "3′", {color: c.muted, size: 12, anchor: "end"});
      api.label([4, yB], "3′", {color: c.muted, size: 12}); api.label([396, yB], "5′", {color: c.muted, size: 12, anchor: "end"});
      api.rect(X(194) - 5, yT - 9, 10, yB - yT + 18, {rx: 2, fill: c.card});
      lab([194, (yT + yB) / 2], "//", c.muted, {size: 13, weight: 700});
      // which strand is which: a key, since the answer flips with the gene's direction
      api.line([14, 246], [32, 246], {color: c.c2, width: 2.5}); api.label([38, 246], "coding (" + coding + ")", {color: c.c2, size: 12, weight: 600});
      api.line([156, 246], [174, 246], {color: c.c1, width: 4}); api.label([180, 246], "template (" + (right ? "bottom" : "top") + "), read 3′→5′", {color: c.c1, size: 12, weight: 600});
      // promoter boxes, their sequence on the top strand, and the spacer between them
      [["b35", "TTGACA", "−35"], ["b10", "TATAAT", "−10"]].forEach(function (q) {
        var r = b[q[0]], xl = bp(r[0]), xr = bp(r[1]) + 2.9;
        api.rect(Math.min(X(xl), X(xr)), yT - 8, Math.abs(X(xr) - X(xl)), yB - yT + 16, {rx: 3, fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.4});
        lab([(xl + xr) / 2, yT - 22], right ? q[1] : REV[q[1]], c.c6, {weight: 700});
        lab([(xl + xr) / 2, yB + 20], q[2], c.c6, {weight: 650});
      });
      var s0 = bp(b.b35[1]) + 2.9, s1 = bp(b.b10[0]);
      api.line([X(s0), yB + 34], [X(s1), yB + 34], {color: c.muted, width: 1.2});
      api.line([X(s0), yB + 30], [X(s0), yB + 38], {color: c.muted, width: 1.2}); api.line([X(s1), yB + 30], [X(s1), yB + 38], {color: c.muted, width: 1.2});
      lab([(s0 + s1) / 2, yB + 48], v.spacer + " bp", c.muted, {weight: 600});
      // +1: the bent arrow points the way transcription runs
      var p1 = X(x1 + 1.45), dirx = right ? 1 : -1;
      api.line([p1, yT - 6], [p1, yT - 40], {color: c.ink, width: 2});
      api.line([p1, yT - 40], [p1 + dirx * 26, yT - 40], {color: c.ink, width: 2, arrow: true});
      lab([x1 + 1.45, yT - 52], "+1", c.ink, {weight: 700});
      // terminator: a hairpin at +L
      var tx = X(end + 4);
      api.path("M " + (tx - 5) + " " + (yT - 6) + " L " + (tx - 5) + " " + (yT - 30) + " A 5 5 0 0 1 " + (tx + 5) + " " + (yT - 30) + " L " + (tx + 5) + " " + (yT - 6), {stroke: c.c5, width: 2});
      var tl = Math.min(end + 4, 340);   // labels stop short of the panel edge for the longest genes
      lab([tl, yT - 46], "terminator", c.c5, {weight: 650});
      lab([tl, yT - 60], "+" + L, c.c5, {size: 12});
      // the RNA it makes, 5' at +1
      var yr = 214;
      api.arrow([X(x1), yr], [X(end), yr], {color: c.c3, width: 3, halo: false});
      lab([x1 - 6, yr], "5′", c.c3, {anchor: "end", weight: 600});
      lab([(x1 + end) / 2, yr - 14], "RNA, " + L + " nt", c.c3, {weight: 650});
      lab([20, 272], right ? "← upstream" : "upstream →", c.muted, {anchor: "start"});
      lab([380, 272], right ? "downstream →" : "← downstream", c.muted, {anchor: "end"});
      // end-on view of the helix: where each box faces, and the face sigma reaches
      // the fixed dot is where sigma touches the helix; the -35 box's dot turns with the spacer (hollow when it sits on it)
      var ix = X(58), iy = 56, R = 28, d = (v.spacer - 17) * 360 / 10.5, ang = function (deg) { return (deg - 90) * Math.PI / 180; };
      var on = function (deg, r) { return [ix + r * Math.cos(ang(deg)), iy + r * Math.sin(ang(deg))]; };
      api.circle([ix, iy], R, {stroke: c.faint, width: 1.5});
      api.path("M " + on(-22, R + 5).join(" ") + " A " + (R + 5) + " " + (R + 5) + " 0 0 1 " + on(22, R + 5).join(" "), {stroke: c.muted, width: 3, opacity: 0.55});
      api.circle(on(0, R), 3.5, {fill: c.ink, stroke: c.ink, width: 1});
      lab([58, iy - R - 15], "σ contact", c.ink, {weight: 600});
      if (d) api.circle(on(d, R), 4.5, {fill: c.c6, stroke: c.c6, width: 1});
      else api.circle(on(0, R), 7.5, {stroke: c.c6, width: 2.2});
      var l35 = on(d, R - 17);
      api.label(l35, "−35", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
      lab([100, 35], "helix end-on: σ grips the arc", c.muted, {anchor: "start"});
      lab([100, 52], d ? "−35 box " + Viz.fmt(Math.abs(d), 0) + "° off" : "−35 box aligned", d ? c.c5 : c.c4, {anchor: "start", weight: 650});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
