// Translation at the scale of one mRNA: ribosomes start at the AUG one after another, each lengthens its own chain as it
// moves 5'->3', and each lets go of a finished protein at the stop codon. All three stages (initiation, elongation,
// termination) show at once along a polysome. Steady state: a ribosome needs T = L / v seconds from start to stop; one
// starts every dt seconds, so N = T / dt ride the mRNA on average, spaced 3 v dt nt apart, and the mRNA turns out
// 60 / dt proteins a minute. Elongation runs about 10-20 aa/s in E. coli and about 5-6 aa/s in mammalian cells. The
// ranges keep the spacing at or above the ~30 nt a ribosome covers (3 x 5 aa/s x 2 s), the point where they would queue.
// The picture is a snapshot taken halfway between two initiations, so it shows round(N) ribosomes.
(function () {
  function model(v) {
    var T = v.L / v.v, N = T / v.dt, gap = 3 * v.v * v.dt, orf = 3 * v.L, pos = [];
    for (var k = 0; (k + 0.5) * gap < orf; k++) pos.push((k + 0.5) * gap);   // nt from the start codon
    return {T: T, N: N, gap: gap, orf: orf, pos: pos, perMin: 60 / v.dt};
  }
  function sec(x) { return x < 90 ? Viz.fmt(x, 1) + " s" : Viz.fmt(x / 60, 1) + " min"; }

  Viz.register("translation", {
    title: "Translation along an mRNA: the polysome",
    subject: "biology",
    shows: "Set the protein length, the ribosome speed and how often a ribosome starts: chains grow as ribosomes move 5′ to 3′, and the start rate sets how many ride the mRNA and how much protein it makes",
    params: {
      L: {kind: "integer", default: 300, min: 50, max: 600, step: 10, label: "L\\ \\text{(aa)}"},
      v: {kind: "integer", default: 15, min: 5, max: 20, label: "v\\ \\text{(aa/s)}"},
      dt: {kind: "integer", default: 4, min: 2, max: 30, label: "\\Delta t\\ \\text{(s)}"}
    },
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{l}T=\\dfrac{L}{v}=\\dfrac{" + v.L + "}{" + v.v + "}=" + Viz.n(m.T, 1) + "\\ \\text{s}\\\\" +
        "N=\\dfrac{T}{\\Delta t}=\\dfrac{" + Viz.n(m.T, 1) + "}{" + v.dt + "}=" + Viz.n(m.N, 1) + "\\ \\text{ribosome" + (Viz.fmt(m.N, 1) === "1" ? "" : "s") + "}\\end{array}";
    },
    status: function (v) {
      var m = model(v), per = Viz.fmt(m.perMin, 1);
      if (m.N < 0.5) return "A ribosome needs only <b>" + sec(m.T) + "</b> but starts every " + v.dt + " s, so this mRNA is bare <b>" + Viz.fmt(100 - m.N * 100, 0) + "%</b> of the time and makes " + per + " proteins a minute.";
      var where = m.pos.length > 1 ? " ride this mRNA " + Viz.fmt(m.gap, 0) + " nt apart" + (m.gap <= 30 ? " (nose to tail)" : "") : (Viz.fmt(m.N, 1) === "1" ? " rides" : " ride") + " this mRNA at a time";
      return "Each ribosome takes <b>" + sec(m.T) + "</b> from start to stop and a new one starts every " + v.dt + " s, so about <b>" + Viz.fmt(m.N, 1) + "</b>" + where + ", making <b>" + per + "</b> proteins a minute.";
    },
    examples: [
      {name: "all at minimum", values: {L: 50, v: 5, dt: 2}},
      {name: "all at maximum", values: {L: 600, v: 20, dt: 30}},
      {name: "crowded polysome", values: {L: 600, v: 5, dt: 2}},
      {name: "E. coli-like", values: {L: 300, v: 15, dt: 3}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = model(v), yM = 214, xs = 44, xe = 356, hMax = 132;
      var X = function (nt) { return xs + (xe - xs) * nt / m.orf; }, tag = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, anchor: "middle"}, o || {})); };
      // the mRNA: 5' UTR, reading frame from AUG to stop, 3' UTR
      api.line([20, yM], [378, yM], {color: c.c3, width: 2.5});
      api.rect(xs, yM - 3, xe - xs, 6, {rx: 3, fill: c.c3, fillOpacity: 0.35});
      tag([10, yM], "5′", c.c3, {weight: 650}); tag([394, yM], "3′", c.c3, {weight: 650, anchor: "end"});
      tag([xs, yM + 20], "AUG", c.c3, {weight: 650}); tag([xe, yM + 20], "stop", c.c5, {weight: 650});
      tag([(xs + xe) / 2, yM + 20], m.orf + 3 + " nt reading frame", c.muted);
      // ribosomes, each with the chain it has made so far (aa = nt travelled / 3)
      var gapPx = X(m.gap) - xs, foot = X(30) - xs, w = Math.max(foot, Math.min(22, gapPx - 2)), amp = Math.max(0.6, Math.min(3, gapPx / 4));
      var pos = m.pos.length ? m.pos : [m.orf / 2], ghost = !m.pos.length;
      pos.forEach(function (p) {
        var x = X(p), aa = p / 3, h = hMax * aa / v.L, g = api.group({opacity: ghost ? 0.35 : 1});
        var pts = []; for (var t = 0; t <= h; t += 2) pts.push([x + amp * Math.sin(t / 3), yM - 12 - t]);
        if (pts.length > 1) api.polyline(pts, {stroke: c.c4, width: Math.min(2, Math.max(1, gapPx / 5)), parent: g});
        api.rect(x - w / 2, yM - 12, w, 11, {rx: Math.min(5, w / 2), fill: c.c6, fillOpacity: 0.55, parent: g});
        api.rect(x - w / 2 + 1, yM + 2, w - 2, 7, {rx: Math.min(3.5, w / 2), fill: c.c6, fillOpacity: 0.35, parent: g});
      });
      if (ghost) tag([X(m.orf / 2) + 16, yM - 26], "bare most of the time", c.muted, {anchor: "start"});
      // the three stages, read off the same picture
      tag([xs + 4, 52], "initiation", c.c6, {anchor: "start", weight: 650});
      api.line([xs + 8, 60], [xs + 8, yM - 18], {color: c.c6, width: 1, dash: "3 3", opacity: 0.6});
      tag([(xs + xe) / 2, 34], "elongation: chains grow 5′ → 3′", c.c4, {weight: 650});
      tag([xe, 52], "termination", c.c5, {anchor: "end", weight: 650});
      // a finished protein leaving at the stop codon
      var fp = []; for (var t = 0; t <= 56; t += 2) fp.push([xe + 4 + t * 0.5, 70 + 8 * Math.sin(t / 4) + t * 0.2]);
      api.polyline(fp, {stroke: c.c4, width: 2});
      tag([xe + 20, 104], v.L + " aa", c.c4, {weight: 650});
      api.line([xe, 60], [xe, yM - 18], {color: c.c5, width: 1, dash: "3 3", opacity: 0.6});
      // spacing between neighbours, and the output
      if (m.pos.length > 1) {
        var a = X(m.pos[0]), b = X(m.pos[1]), yb = yM + 40;
        api.line([a, yb], [b, yb], {color: c.ink, width: 1.2}); api.line([a, yb - 4], [a, yb + 4], {color: c.ink, width: 1.2}); api.line([b, yb - 4], [b, yb + 4], {color: c.ink, width: 1.2});
        tag([b + 8, yb], Viz.fmt(m.gap, 0) + " nt apart" + (m.gap <= 30 ? ": nose to tail" : ""), c.ink, {anchor: "start"});
      }
      tag([12, yM + 66], (ghost ? "0" : String(m.pos.length)) + " ribosome" + (m.pos.length === 1 ? "" : "s") + " now · 1 protein every " + v.dt + " s = " + Viz.fmt(m.perMin, 1) + " per minute", c.muted, {anchor: "start"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
