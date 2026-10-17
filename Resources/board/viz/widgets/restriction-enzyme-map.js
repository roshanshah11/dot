// A restriction map: where each enzyme cuts a 6,000 bp molecule, in bp from position 0. The same sites give different
// fragment counts by topology: a circle has no ends, so n cuts make n pieces; linear DNA has two ends, so n cuts make
// n + 1. Either way the pieces add back up to the whole molecule, which is how a map is checked against a gel.
(function () {
  var TOTAL = 6000;
  var SITES = [{at: 400, e: "EcoRI", k: "ecoRI"}, {at: 1500, e: "HindIII", k: "hindIII"}, {at: 2800, e: "BamHI", k: "bamHI"}, {at: 4200, e: "HindIII", k: "hindIII"}];
  function model(v) {
    var circ = v.molecule_topology === "circular plasmid";
    var cuts = SITES.filter(function (s) { return v[s.k]; }).map(function (s) { return s.at; });
    var frags = [];
    if (circ) {
      if (cuts.length === 0) frags = [];
      else cuts.forEach(function (a, i) { var b = cuts[(i + 1) % cuts.length]; frags.push({from: a, to: b, len: ((b - a) + TOTAL) % TOTAL || TOTAL}); });
    } else {
      var ends = [0].concat(cuts, [TOTAL]);
      for (var i = 1; i < ends.length; i++) frags.push({from: ends[i - 1], to: ends[i], len: ends[i] - ends[i - 1]});
    }
    return {circ: circ, cuts: cuts, frags: frags};
  }
  Viz.register("restriction-enzyme-map", {
    title: "Restriction map: sites and fragments",
    subject: "biology",
    shows: "Pick enzymes and the topology: each site is a cut at a fixed bp position; a circle gives as many fragments as cuts, linear DNA one more, and they always add up to the whole",
    params: {
      molecule_topology: {kind: "enum", values: ["circular plasmid", "linear DNA"], default: "circular plasmid", label: "\\text{DNA}",
                          names: {"circular plasmid": "circular", "linear DNA": "linear"}},
      ecoRI: {kind: "boolean", default: true, label: "\\text{EcoRI}", on: "cuts", off: "left out"},
      hindIII: {kind: "boolean", default: true, label: "\\text{HindIII}", on: "cuts", off: "left out"},
      bamHI: {kind: "boolean", default: false, label: "\\text{BamHI}", on: "cuts", off: "left out"}
    },
    formula: function (v) {
      var m = model(v), n = m.cuts.length;
      if (m.circ && !n) return "\\text{no cuts: one closed circle of } 6000\\text{ bp}";
      var rule = m.circ ? "n_{\\text{frag}} = n_{\\text{cut}} = " + n : "n_{\\text{frag}} = n_{\\text{cut}} + 1 = " + (n + 1);
      return "\\small\\begin{array}{l}" + rule + "\\text{, sizes in bp:}\\\\ " + m.frags.map(function (f) { return f.len; }).join("+") + "=" + TOTAL + "\\end{array}";
    },
    status: function (v) {
      var m = model(v), n = m.cuts.length, f = m.frags.length;
      if (!n) return m.circ ? "No enzyme added: the plasmid stays <b>one closed circle</b>, with no ends to separate." : "No enzyme added: the linear molecule stays <b>one 6,000 bp piece</b>.";
      if (m.circ && n === 1) return "One cut in a circle just opens it: <b>one linear 6,000 bp</b> fragment, not two.";
      if (m.circ) return "A circle has no ends, so <b>" + n + " cuts</b> make <b>" + f + " fragments</b>; the same cuts in linear DNA would make " + (n + 1) + ".";
      return "Linear DNA already has two ends, so <b>" + n + " cut" + (n > 1 ? "s" : "") + "</b> make <b>" + f + " fragments</b>, one more than the same cuts in a circle.";
    },
    examples: [
      {name: "one cut in a circle", values: {molecule_topology: "circular plasmid", ecoRI: true, hindIII: false, bamHI: false}},
      {name: "one cut in linear DNA", values: {molecule_topology: "linear DNA", ecoRI: true, hindIII: false, bamHI: false}},
      {name: "all three enzymes, circular", values: {molecule_topology: "circular plasmid", ecoRI: true, hindIII: true, bamHI: true}},
      {name: "all three enzymes, linear", values: {molecule_topology: "linear DNA", ecoRI: true, hindIII: true, bamHI: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v);
      var col = {EcoRI: c.c1, HindIII: c.c6, BamHI: c.c3};
      if (m.circ) {
        var cx = 200, cy = 124, r = 72, ang = function (b) { return b / TOTAL * 2 * Math.PI; };
        var at = function (b, rr) { return [cx + rr * Math.sin(ang(b)), cy - rr * Math.cos(ang(b))]; };
        var arc = function (a, b, rr) {
          var span = ((b - a) + TOTAL) % TOTAL || TOTAL;
          return "M " + at(a, rr).join(" ") + " A " + rr + " " + rr + " 0 " + (span > TOTAL / 2 ? 1 : 0) + " 1 " + at(a + span, rr).join(" ");
        };
        if (!m.frags.length) api.circle([cx, cy], r, {stroke: c.c2, width: 6});
        m.frags.forEach(function (f, i) {
          var g = m.frags.length > 1 ? 60 : 0;
          if (m.frags.length === 1) api.path(arc(f.from + 150, f.from - 150, r), {stroke: c.c2, width: 6});   // opened: one linear piece
          else api.path(arc(f.from + g, f.to - g, r), {stroke: c.c2, width: 6, opacity: i % 2 ? 0.55 : 1});
          if (m.frags.length > 1) api.label(at(f.from + f.len / 2, r - 22), String(f.len), {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
        });
        api.label([cx, cy - 8], "6,000 bp", {color: c.muted, size: 12, anchor: "middle"});
        api.label([cx, cy + 9], m.frags.length ? m.frags.length + (m.frags.length > 1 ? " fragments" : " fragment") : "uncut", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.line(at(0, r - 6), at(0, r + 6), {color: c.muted, width: 1.5});
        api.label(at(0, r + 14), "0", {color: c.muted, size: 12, anchor: "middle"});
        SITES.forEach(function (s) {
          var on = v[s.k], side = Math.sin(ang(s.at)), lp = at(s.at, r + 16);
          api.line(at(s.at, r - 10), at(s.at, r + 10), {color: col[s.e], width: 3, opacity: on ? 1 : 0.3});
          api.label(lp, s.e + " " + s.at, {color: col[s.e], size: 12, weight: on ? 650 : 500, opacity: on ? 1 : 0.45,
            anchor: side > 0.3 ? "start" : side < -0.3 ? "end" : "middle"});
        });
      } else {
        var x0 = 34, x1 = 366, X = function (b) { return x0 + (x1 - x0) * b / TOTAL; }, y = 124;
        m.frags.forEach(function (f, i) {
          var a = X(f.from) + (f.from > 0 ? 2.5 : 0), b = X(f.to) - (f.to < TOTAL ? 2.5 : 0);
          api.line([a, y], [b, y], {color: c.c2, width: 6, opacity: i % 2 ? 0.55 : 1});
          api.label([(X(f.from) + X(f.to)) / 2, y + 20], String(f.len), {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
        });
        api.label([x0 - 6, y], "end", {color: c.muted, size: 12, anchor: "end"});
        api.label([x1 + 6, y], "end", {color: c.muted, size: 12});
        for (var t = 0; t <= TOTAL; t += 1000) {
          api.line([X(t), y + 34], [X(t), y + 40], {color: c.axis, width: 1.2});
          api.label([X(t), y + 52], String(t / 1000), {color: c.muted, size: 12, anchor: "middle"});
        }
        api.line([x0, y + 34], [x1, y + 34], {color: c.axis, width: 1.2});
        api.label([x1, y + 70], "position (kb)", {color: c.muted, size: 12, anchor: "end"});
        SITES.forEach(function (s, i) {
          var on = v[s.k], ly = y - 26 - (i % 2) * 18;
          api.line([X(s.at), y - 11], [X(s.at), y + 11], {color: col[s.e], width: 3, opacity: on ? 1 : 0.3});
          api.line([X(s.at), y - 13], [X(s.at), ly + 7], {color: col[s.e], width: 1, opacity: on ? 0.6 : 0.2});
          api.label([X(s.at), ly], s.e + " " + s.at, {color: col[s.e], size: 12, weight: on ? 650 : 500, opacity: on ? 1 : 0.45, anchor: "middle"});
        });
        api.label([200, 34], "linear DNA, 6,000 bp: " + m.frags.length + (m.frags.length > 1 ? " fragments" : " fragment"), {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      }
      // the fragments laid end to end: they always add back up to the whole molecule
      var bx = 34, bw = 332, by = 262, n = m.frags.length;
      api.label([bx, by - 20], n ? "fragments end to end" : "nothing cut", {color: c.muted, size: 12});
      api.label([bx + bw, by - 20], "= 6,000 bp", {color: c.muted, size: 12, anchor: "end"});
      if (!n) api.rect(bx, by - 7, bw, 14, {fill: c.c2, fillOpacity: 0.35, rx: 3});
      var acc = 0;
      m.frags.forEach(function (f, i) {
        var x = bx + bw * acc / TOTAL, w = bw * f.len / TOTAL;
        api.rect(x + 1, by - 7, w - 2, 14, {fill: c.c2, fillOpacity: i % 2 ? 0.4 : 0.85, rx: 3});
        if (w > 30) api.label([x + w / 2, by + 20], String(f.len), {color: c.c2, size: 12, anchor: "middle"});
        acc += f.len;
      });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
