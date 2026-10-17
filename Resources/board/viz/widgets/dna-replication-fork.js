// One replication fork moving away from its origin, drawn to scale along the bottom axis. Ahead of the fork is the parent
// duplex (two old strands); behind it are two daughter duplexes, each one old strand + one new strand (semiconservative).
// Fork speed: about 1,000 nt/s in E. coli and about 50 nt/s in human cells (Alberts, Molecular Biology of the Cell; DNA
// fibre assays give 15-50 nt/s). Okazaki fragments: 1,000-2,000 nt in bacteria (drawn 1,500), 100-200 nt in eukaryotes
// (drawn 150). Model for the lagging strand: primase lays a primer every l nt of exposed template, and each fragment is
// extended back toward the previous one at fork speed, so about l nt of lagging template is single-stranded at any time.
(function () {
  var CELL = {"E. coli": {v: 1000, frag: 1500, unit: 1000, uname: "kb"}, "human": {v: 50, frag: 150, unit: 1, uname: "nt"}};
  var TMAX = 20;
  function texInt(x) { return Math.round(x).toLocaleString("en-US").replace(/,/g, "{,}"); }
  function txtInt(x) { return Math.round(x).toLocaleString("en-US"); }

  Viz.register("dna-replication-fork", {
    title: "The replication fork",
    subject: "biology",
    shows: "Slide time: the fork unzips the parent duplex and leaves two daughter duplexes behind it, each one old strand plus one new, the leading copy in one piece and the lagging copy in Okazaki fragments",
    params: {
      t: {kind: "integer", default: 8, min: 0, max: TMAX, label: "t\\ (\\text{s})"},
      cell: {kind: "enum", values: ["E. coli", "human"], default: "E. coli", label: "\\text{cell}"}
    },
    formula: function (v) {
      var o = CELL[v.cell], d = o.v * v.t;
      return "\\begin{array}{l}d=v\\,t=" + texInt(o.v) + "\\times" + v.t + "=" + texInt(d) + "\\ \\text{bp}\\\\ N_{\\text{Okazaki}}=\\lfloor d/\\ell\\rfloor=\\lfloor " +
        texInt(d) + "/" + texInt(o.frag) + "\\rfloor=" + Math.floor(d / o.frag) + "\\end{array}";
    },
    status: function (v) {
      var o = CELL[v.cell], d = o.v * v.t, k = Math.floor(d / o.frag);
      if (!v.t) return "At t = 0 the fork is still at the origin: nothing has been copied yet.";
      return "In " + v.t + " s " + (v.cell === "human" ? "a human" : "an E. coli") + " fork copies <b>" + txtInt(d) + " bp</b>; each copy pairs one old strand with one new one, and the lagging copy " +
        (k ? "is in <b>" + k + "</b> Okazaki fragment" + (k > 1 ? "s" : "") + "." : "has not been primed yet.");
    },
    examples: [
      {name: "at the origin", values: {t: 0}},
      {name: "E. coli, 20 s", values: {t: 20, cell: "E. coli"}},
      {name: "human, 3 s", values: {t: 3, cell: "human"}},
      {name: "human, 20 s", values: {t: 20, cell: "human"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, o = CELL[v.cell], d = o.v * v.t, dmax = o.v * TMAX;
      var xo = 30, xR = 318, X = function (nt) { return xo + (xR - xo) * nt / dmax; }, xf = X(d), xy = xf - 26, xe = 382;
      var yOT = 70, yLd = 90, yLg = 202, yOB = 222, yP = 136, yQ = 156;
      // y of a strand at x: flat behind the fork, then a straight arm into the fork
      var arm = function (flat, end, xEnd) { return function (x) { return x <= xy ? flat : flat + (end - flat) * (x - xy) / (xEnd - xy); }; };
      var fOT = arm(yOT, yP, xf), fOB = arm(yOB, yQ, xf), fLd = arm(yLd, yP + 2, xf - 6), fLg = arm(yLg, yQ - 2, xf - 6);
      var pts = function (a, b, f) { var p = [[a, f(a)]]; if (a < xy && b > xy) p.push([xy, f(xy)]); p.push([b, f(b)]); return p; };
      var seg = function (a, b, f, col, w, head) {   // head: +1 at b, -1 at a
        if (b - a < 0.5) return;
        var p = pts(a, b, f);
        api.polyline(p, {stroke: col, width: w});
        if (head && b - a > 9) {
          var q = head > 0 ? p[p.length - 1] : p[0], r = head > 0 ? p[p.length - 2] : p[1], L = Math.hypot(q[0] - r[0], q[1] - r[1]) || 1;
          var ux = (q[0] - r[0]) / L, uy = (q[1] - r[1]) / L;
          api.polygon([[q[0] + ux * 3, q[1] + uy * 3], [q[0] - ux * 5 - uy * 4, q[1] - uy * 5 + ux * 4], [q[0] - ux * 5 + uy * 4, q[1] - uy * 5 - ux * 4]], {fill: col, fillOpacity: 1});
        }
      };
      // base-pair rungs: parent duplex ahead of the fork, daughters where new DNA exists
      for (var x = xf + 5; x < xe; x += 8) api.line([x, yP + 3], [x, yQ - 3], {color: c.faint, width: 1});
      // old strands (blue): parent duplex and the two arms
      var start = Math.min(xo, xf);
      api.polyline([[start, fOT(start)]].concat(xy > start ? [[xy, yOT]] : []).concat([[xf, yP], [xe, yP]]), {stroke: c.c2, width: 4});
      api.polyline([[start, fOB(start)]].concat(xy > start ? [[xy, yOB]] : []).concat([[xf, yQ], [xe, yQ]]), {stroke: c.c2, width: 4});
      // leading strand: one primer at the origin, one continuous piece to the fork
      if (d > 0) {
        var lEnd = Math.max(xo, xf - 6);
        for (x = xo + 4; x < Math.min(lEnd, xy) - 2; x += 8) api.line([x, yOT + 3], [x, yLd - 3], {color: c.faint, width: 1});
        seg(xo, lEnd, fLd, c.c3, 4, 1);
        seg(xo, Math.min(lEnd, xo + 3), fLd, c.c5, 5, 0);
      }
      // lagging strand: fragment j covers [(j-1)l, jl]; the newest has grown s = d - kl nt back from its primer at kl
      var k = Math.floor(d / o.frag), sNew = d - k * o.frag;
      for (var j = 1; j <= k; j++) {
        var hi = j * o.frag, lo = j < k ? (j - 1) * o.frag : hi - sNew;
        var b = Math.min(X(hi) - 0.8, xf - 6), a = Math.min(X(lo) + 0.8, b - 3);
        for (x = a + 3; x < Math.min(b, xy) - 2; x += 8) api.line([x, yLg + 3], [x, yOB - 3], {color: c.faint, width: 1});
        seg(a, b, fLg, c.c3, 4, j < k || sNew > 0 ? -1 : 0);
        seg(b - 3, b, fLg, c.c5, 5, 0);
      }
      // the helicase at the fork, and the fork's direction
      api.rect(xf - 7, yP - 14, 16, yQ - yP + 28, {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.6, rx: 8});
      if (xf - xo > 80) api.label([xf - 14, (yP + yQ) / 2], "helicase", {color: c.c6, size: 12, weight: 650, anchor: "end"});
      else api.label([xf + 14, yP - 24], "helicase", {color: c.c6, size: 12, weight: 650});
      api.arrow([322, 30], [382, 30], {color: c.muted, width: 2, halo: false});
      api.label([316, 30], "fork moves", {color: c.muted, size: 12, anchor: "end"});
      api.label([xe, yP - 14], xf > 250 ? "parent" : "parent: 2 old strands", {color: c.c2, size: 12, anchor: "end"});
      // strand ends
      api.label([xe + 9, yP], "5′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([xe + 9, yQ], "3′", {color: c.c2, size: 12, anchor: "middle"});
      if (xf - xo > 40) {
        api.label([16, yOT], "3′", {color: c.c2, size: 12, anchor: "middle"});
        api.label([16, yLd], "5′", {color: c.c3, size: 12, anchor: "middle"});
        if (k >= 2) api.label([16, yLg], "3′", {color: c.c3, size: 12, anchor: "middle"});   // the first fragment reaches the origin
        api.label([16, yOB], "5′", {color: c.c2, size: 12, anchor: "middle"});
      }
      if (xf - xo > 150) {
        api.label([xo, yOT - 16], "copy 1: old + new, leading (one piece)", {color: c.c3, size: 12});
        api.label([xo, yOB + 16], "copy 2: old + new, lagging (fragments)", {color: c.c3, size: 12});
      } else if (xf - xo > 40) {
        api.label([xo, yOT - 16], "copy 1: old + new", {color: c.c3, size: 12});
        api.label([xo, yOB + 16], "copy 2: old + new", {color: c.c3, size: 12});
      }
      // distance axis, to scale
      var yA = 262;
      api.line([xo, yA], [xR, yA], {color: c.axis, width: 1.2});
      for (var q = 0; q <= 4; q++) {
        var nt = dmax * q / 4, tx = X(nt);
        api.line([tx, yA - 3], [tx, yA + 3], {color: c.axis, width: 1.2});
        api.label([tx, yA + 14], api.fmt(nt / o.unit), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([(xo + xR) / 2, yA + 30], "distance from the origin (" + o.uname + ")", {color: c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
