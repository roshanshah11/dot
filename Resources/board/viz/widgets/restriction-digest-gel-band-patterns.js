// A 5,000 bp plasmid cut by EcoRI (one site, at 300 bp) and BamHI (two sites, 1,500 bp and a movable one), run on an
// agarose gel next to a 1 kb ladder. Cuts on a circle give as many fragments as cuts; the fragments always add back up
// to 5,000 bp; smaller fragments run farther (distance roughly linear in log size); band brightness follows DNA mass, so
// for equal moles a longer fragment glows brighter and two fragments of the same size stack into one band twice as bright.
// Uncut plasmid is mostly supercoiled, which runs ahead of a linear 5 kb piece; nicked (open) circles lag behind it.
(function () {
  var TOTAL = 5000, ECO = 300, BAM1 = 1500, LADDER = [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 500];
  var LANES = ["uncut", "EcoRI", "BamHI", "EcoRI + BamHI"];
  function sites(v, digest) {
    var s = [];
    if (digest === "EcoRI" || digest === "EcoRI + BamHI") s.push({at: ECO, e: "EcoRI"});
    if (digest === "BamHI" || digest === "EcoRI + BamHI") { s.push({at: BAM1, e: "BamHI"}); s.push({at: v.p, e: "BamHI"}); }
    return s.sort(function (a, b) { return a.at - b.at; });
  }
  function fragments(v, digest) {   // in map order, each from one cut to the next going clockwise
    var s = sites(v, digest), out = [];
    if (!s.length) return out;
    s.forEach(function (q, i) { var nx = s[(i + 1) % s.length].at; out.push({from: q.at, to: nx, len: ((nx - q.at) + TOTAL) % TOTAL || TOTAL}); });
    return out;
  }
  function bands(v, digest) {   // equal sizes stack into one band
    var m = {};
    fragments(v, digest).forEach(function (f) { m[f.len] = (m[f.len] || 0) + 1; });
    return Object.keys(m).map(function (k) { return {len: +k, n: m[k]}; }).sort(function (a, b) { return b.len - a.len; });
  }
  function bp(x) { return x.toLocaleString("en-US"); }
  function list(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  Viz.register("restriction-digest-gel-band-patterns", {
    title: "Restriction digest: reading the gel bands",
    subject: "biology",
    shows: "Choose a digest and drag the second BamHI site: n cuts in a circle give n fragments that add up to the plasmid, and each fragment becomes a band by size",
    params: {
      digest: {kind: "enum", values: LANES, default: "EcoRI + BamHI", label: "\\text{digest}",
               names: {"uncut": "uncut", "EcoRI": "EcoRI", "BamHI": "BamHI", "EcoRI + BamHI": "both"}},
      p: {kind: "integer", default: 3600, min: 2000, max: 4800, step: 100, label: "\\text{BamHI 2}"}
    },
    formula: function (v) {
      var f = fragments(v, v.digest);
      if (!f.length) return "\\text{uncut: one circle of } 5000\\text{ bp, no ends}";
      var lens = f.map(function (q) { return q.len; });
      return "\\small " + f.length + "\\text{ cut" + (f.length > 1 ? "s" : "") + "} \\to " + f.length + "\\text{ fragment" + (f.length > 1 ? "s" : "") + ": } " +
        lens.join("+") + "=" + TOTAL + "\\text{ bp}";
    },
    status: function (v) {
      var f = fragments(v, v.digest), b = bands(v, v.digest);
      if (!f.length) return "Uncut plasmid is not a size readout: the <b>supercoiled</b> form runs ahead of a 5,000 bp linear piece and nicked circles lag behind it.";
      if (f.length === 1) return "One cut opens the circle into a single linear <b>5,000 bp</b> band, level with the 5 kb ladder band.";
      var stacked = b.filter(function (q) { return q.n > 1; });
      if (stacked.length) return f.length + " fragments but only <b>" + b.length + (b.length > 1 ? " bands" : " band") + "</b>: the two " + bp(stacked[0].len) + " bp pieces run together, so that band is twice as bright.";
      var sorted = f.map(function (q) { return q.len; }).sort(function (a, c) { return a - c; });
      var close = sorted.some(function (x, i) { return i && sorted[i] / sorted[i - 1] < 1.08; });
      return f.length + " cuts in a circle give <b>" + f.length + " bands</b> (" + list(sorted.slice().reverse().map(bp)) + " bp); the " + bp(sorted[0]) + " bp piece runs farthest" +
        (close ? ", and the two closest sizes barely separate." : ".");
    },
    examples: [
      {name: "two fragments the same size", values: {digest: "EcoRI + BamHI", p: 3400}},
      {name: "BamHI alone, site 2 at its minimum", values: {digest: "BamHI", p: 2000}},
      {name: "uncut plasmid", values: {digest: "uncut"}},
      {name: "site 2 at its maximum", values: {digest: "EcoRI + BamHI", p: 4800}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, sel = v.digest;
      // ---- the plasmid map: 0 bp at 12 o'clock, clockwise ----
      var cx = 100, cy = 166, r = 48, ang = function (b) { return b / TOTAL * 2 * Math.PI; };
      var at = function (b, rr) { return [cx + rr * Math.sin(ang(b)), cy - rr * Math.cos(ang(b))]; };
      var arc = function (a, b, rr) {
        var span = ((b - a) + TOTAL) % TOTAL || TOTAL;
        return "M " + at(a, rr).join(" ") + " A " + rr + " " + rr + " 0 " + (span > TOTAL / 2 ? 1 : 0) + " 1 " + at(a + span, rr).join(" ");
      };
      api.label([cx, 22], "plasmid, 5,000 bp", {color: c.muted, size: 12, anchor: "middle"});
      api.label([cx, 40], "0 bp at the top", {color: c.muted, size: 12, anchor: "middle"});
      var frags = fragments(v, sel);
      if (!frags.length) api.circle([cx, cy], r, {stroke: c.c2, width: 5});
      frags.forEach(function (f, i) {
        api.path(arc(f.from + 70, f.to - 70, r), {stroke: c.c2, width: 5, opacity: i % 2 ? 0.55 : 1});   // a small gap at each cut
        api.label(at(f.from + f.len / 2, r - 20), String(f.len), {color: c.c2, size: 12, weight: 650, anchor: "middle"});
      });
      // every site is drawn; sites the chosen digest does not cut are faint. Two-line labels keep the map narrow.
      var cutAt = sites(v, sel).map(function (q) { return q.at; });
      [{at: ECO, e: "EcoRI", col: c.c1}, {at: BAM1, e: "BamHI", col: c.c3}, {at: v.p, e: "BamHI", col: c.c3}].forEach(function (s) {
        var cut = cutAt.indexOf(s.at) >= 0, side = Math.sin(ang(s.at)), up = Math.cos(ang(s.at)) > 0.2, lp = at(s.at, r + 15);
        var anchor = side > 0.35 ? "start" : side < -0.35 ? "end" : "middle", y0 = up ? lp[1] - 14 : lp[1];
        if (anchor === "middle") y0 = up ? lp[1] - 18 : lp[1] + 4;
        api.line(at(s.at, r - 9), at(s.at, r + 9), {color: s.col, width: 3, opacity: cut ? 1 : 0.35});
        api.label([lp[0], y0], s.e, {color: s.col, size: 12, weight: cut ? 650 : 500, anchor: anchor, opacity: cut ? 1 : 0.5});
        api.label([lp[0], y0 + 14], String(s.at), {color: s.col, size: 12, anchor: anchor, opacity: cut ? 1 : 0.5});
      });
      api.handle(at(v.p, r), {color: c.c3, r: 6, onDrag: function (q) {
        var a = Math.atan2(q[0] - cx, -(q[1] - cy)); if (a < 0) a += 2 * Math.PI;
        api.set({p: Math.max(2000, Math.min(4800, Math.round(a / (2 * Math.PI) * TOTAL / 100) * 100))});
      }});
      // ---- the gel: lanes uncut, EcoRI, BamHI, both, ladder; wells on top (-), DNA runs down toward + ----
      var gx = 222, lw = 30, top = 64, len = 188, hiL = Math.log10(12000), loL = Math.log10(380);
      var Y = function (L) { return top + len * (hiL - Math.log10(L)) / (hiL - loL); };
      api.rect(gx - 4, top - 12, lw * 5 + 8, len + 26, {fill: c.c2, fillOpacity: 0.06, stroke: c.axis, width: 1, rx: 6});
      ["uncut", "EcoRI", "BamHI", "both", "ladder"].forEach(function (h, i) {
        var x = gx + lw * i + lw / 2, isSel = LANES[i] === sel;
        api.rect(x - 11, top - 9, 22, 6, {stroke: c.axis, width: 1.2, rx: 1});   // the well: an empty slot, not a band
        api.label([x, i % 2 ? 44 : 28], h, {color: isSel ? c.c2 : c.muted, size: 12, weight: isSel ? 700 : 500, anchor: "middle"});
        if (isSel) api.rect(x - 14, top - 10, 28, len + 20, {stroke: c.c2, width: 1.2, dash: "3 3", rx: 4});
      });
      var band = function (i, L, mass, col) {
        var x = gx + lw * i + lw / 2, op = Math.min(1, 0.3 + 0.7 * mass / TOTAL);
        api.rect(x - 11, Y(L) - 2.5, 22, 5, {fill: col, fillOpacity: op, rx: 1.5});
      };
      LANES.forEach(function (d, i) {
        var col = d === sel ? c.c2 : c.ink;
        if (d === "uncut") { band(i, 3100, TOTAL * 0.8, col); band(i, 8500, TOTAL * 0.25, col); return; }   // supercoiled ahead, nicked behind
        bands(v, d).forEach(function (q) { band(i, q.len, q.len * q.n, col); });
      });
      var LABELED = [10000, 5000, 3000, 2000, 1500, 1000, 500];   // 5 kb is always named (the status compares to it); 8, 6, 4 stay unlabeled
      LADDER.forEach(function (L) {
        band(4, L, L === 3000 ? 5000 : 2600, c.ink);   // the 3 kb reference band is the bright one
        if (LABELED.indexOf(L) >= 0) api.label([gx + lw * 5 + 7, Y(L)], String(L / 1000), {color: c.muted, size: 12});
      });
      api.label([gx + lw * 5 + 7, 44], "kb", {color: c.muted, size: 12});
      api.label([gx + lw * 2.5, top + len + 30], "DNA runs down toward +", {color: c.muted, size: 12, anchor: "middle"});
      if (sel === "uncut") {
        api.label([gx - 10, Y(3100)], "supercoiled", {color: c.c2, size: 12, anchor: "end"});
        api.label([gx - 10, Y(8500)], "nicked", {color: c.c2, size: 12, anchor: "end"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
