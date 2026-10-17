// One replication fork moving away from its origin, drawn to scale along the bottom axis. Ahead of the fork is the parent
// duplex (two old strands); behind it are two daughter duplexes, each one old strand + one new strand (semiconservative).
// Fork speed: about 1,000 nt/s in E. coli and about 50 nt/s in human cells (Alberts, Molecular Biology of the Cell; DNA
// fibre assays give 15-50 nt/s). Okazaki fragments: 1,000-2,000 nt in bacteria (drawn 1,500), 100-200 nt in eukaryotes
// (drawn 150). Model for the lagging strand: primase lays a primer every l nt of exposed template, and each fragment is
// extended back toward the previous one at fork speed, so about l nt of lagging template is single-stranded at any time.
// Primers laid so far: k = floor(d/l); the newest has grown s = d - kl nt. A fragment counts once it has DNA in it, so
// N = ceil(d/l) - 1 (a primer laid this instant is not yet a fragment). The newest piece is drawn ending 12 px behind the
// helicase (its length kept) so it does not hide under the helicase box; everything else is to scale.
(function () {
  var CELL = {"E. coli": {v: 1000, frag: 1500, unit: 1000, uname: "kb"}, "human": {v: 50, frag: 150, unit: 1, uname: "nt"}};
  var TMAX = 20;
  function texInt(x) { return Math.round(x).toLocaleString("en-US").replace(/,/g, "{,}"); }
  function txtInt(x) { return Math.round(x).toLocaleString("en-US"); }
  function lag(v) {
    var o = CELL[v.cell], d = o.v * v.t, k = Math.floor(d / o.frag);
    return {o: o, d: d, k: k, s: d - k * o.frag, n: Math.max(0, Math.ceil(d / o.frag) - 1)};
  }

  Viz.register("dna-replication-fork", {
    title: "The replication fork",
    subject: "biology",
    shows: "Slide time: the fork unzips the parent duplex and leaves two daughter duplexes behind it, each one old strand plus one new, the leading copy in one piece and the lagging copy in Okazaki fragments",
    params: {
      t: {kind: "integer", default: 8, min: 0, max: TMAX, label: "t\\ (\\text{s})"},
      cell: {kind: "enum", values: ["E. coli", "human"], default: "E. coli", label: "\\text{cell}"}
    },
    formula: function (v) {
      var r = lag(v);
      return "\\begin{array}{l}d=v\\,t=" + texInt(r.o.v) + "\\times" + v.t + "=" + texInt(r.d) + "\\ \\text{bp}\\\\ N_{\\text{frag}}=" +
        (r.d ? "\\left\\lceil\\tfrac{d}{\\ell}\\right\\rceil-1=\\left\\lceil\\tfrac{" + texInt(r.d) + "}{" + texInt(r.o.frag) + "}\\right\\rceil-1=" + r.n : "0\\quad(d=0)") + "\\end{array}";
    },
    status: function (v) {
      var r = lag(v), who = v.t + " s " + (v.cell === "human" ? "a human" : "an E. coli") + " fork unwinds <b>" + txtInt(r.d) + " bp</b>";
      if (!v.t) return "At t = 0 the fork is still at the origin: nothing has been copied yet.";
      if (!r.n) return "In " + who + ": the leading copy is already growing, but the lagging copy " +
        (r.k ? "has only a primer just laid, no Okazaki fragment yet." : "has not been primed yet.");
      return "In " + who + "; each copy pairs one old strand with one new one, and the lagging copy is in <b>" + r.n + "</b> Okazaki fragment" +
        (r.n > 1 ? "s" : "") + (r.s ? "" : " plus a primer just laid") + ".";
    },
    examples: [
      {name: "at the origin", values: {t: 0}},
      {name: "E. coli, 20 s", values: {t: 20, cell: "E. coli"}},
      {name: "human, 3 s", values: {t: 3, cell: "human"}},
      {name: "human, 20 s", values: {t: 20, cell: "human"}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, r = lag(v), o = r.o, d = r.d, dmax = o.v * TMAX;
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
      // lagging strand: fragment j covers [(j-1)l, jl]; the newest (j = k) has grown s nt back from its primer at kl
      var xNew = Math.min(X(r.k * o.frag), xf - 12), sPx = X(r.s) - xo;
      for (var j = 1; j <= r.k; j++) {
        var b = j < r.k ? X(j * o.frag) - 0.8 : xNew - 0.8, a = Math.min(j < r.k ? X((j - 1) * o.frag) + 0.8 : b - sPx, b - 3);
        for (x = a + 3; x < Math.min(b, xy) - 2; x += 8) api.line([x, yLg + 3], [x, yOB - 3], {color: c.faint, width: 1});
        if (j < r.k || r.s > 0) seg(a, b, fLg, c.c3, 4, -1);   // a primer laid this instant has no DNA yet
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
        if (r.k >= 2) api.label([16, yLg], "3′", {color: c.c3, size: 12, anchor: "middle"});   // the first fragment reaches the origin
        api.label([16, yOB], "5′", {color: c.c2, size: 12, anchor: "middle"});
      }
      // name the new strands: beside the fork where they end while there is room, else inside the copy labels
      var lagTag = r.n ? "lagging (fragments)" : r.k ? "lagging: primer only" : "lagging: no primer yet";
      var side = xe - (xf + 12) >= 130, copy2 = r.n ? "copy 2: old + new" : "copy 2: old, not yet copied";
      if (d > 0 && side) {
        api.label([xf + 12, yLd], "leading (one piece)", {color: c.c3, size: 12, weight: 650});
        api.label([xf + 12, yLg], lagTag, {color: c.c3, size: 12, weight: 650});
      }
      if (xf - xo > 40) {
        api.label([xo, yOT - 16], "copy 1: old + new" + (side ? "" : ", leading (one piece)"), {color: c.c3, size: 12});
        api.label([xo, yOB + 16], copy2 + (side ? "" : ", " + lagTag), {color: c.c3, size: 12});
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
      // key: the two small marks
      var yK = 310, kx = 74;
      api.polyline([[kx, yK], [kx + 26, yK]], {stroke: c.c3, width: 4});
      api.polygon([[kx - 3, yK], [kx + 5, yK - 4], [kx + 5, yK + 4]], {fill: c.c3, fillOpacity: 1});
      api.polyline([[kx + 23, yK], [kx + 26, yK]], {stroke: c.c5, width: 5});
      api.label([kx + 33, yK], "Okazaki fragment", {color: c.c3, size: 12});
      api.polyline([[kx + 160, yK], [kx + 165, yK]], {stroke: c.c5, width: 5});
      api.label([kx + 172, yK], "RNA primer", {color: c.c5, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
