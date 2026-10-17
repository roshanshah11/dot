// Blue-white screening: the cloning site sits inside lacZα. An empty plasmid makes working β-galactosidase, which cuts
// X-gal into a blue dye (blue colony); an insert breaks lacZα, so the colony stays white. Ampicillin keeps only cells
// that took up a plasmid; X-gal is what makes the colour difference visible.
Viz.register("blue-white-screening", {
  title: "Blue-white screening",
  subject: "biology",
  shows: "Set how many plasmids carry the insert and what is in the plate: white colonies have the insert, blue ones are empty vector",
  params: {
    n: {kind: "integer", default: 60, min: 10, max: 150, label: "N"},
    p: {kind: "number", default: 0.3, min: 0, max: 1, step: 0.05, label: "p"},
    xgal: {kind: "boolean", default: true, label: "\\text{X-gal}", on: "in the plate", off: "left out"},
    amp: {kind: "boolean", default: true, label: "\\text{amp}", on: "in the plate", off: "left out"}
  },
  model: function (v) {   // expected white colonies: Np, rounded to whole colonies when it is not already whole
    var np = Number((v.n * v.p).toFixed(2)), w = Math.round(np);
    return {np: np, w: w, b: v.n - w, whole: np === w};
  },
  formula: function (v) {
    var m = Viz.get("blue-white-screening").model(v);
    if (!v.xgal) return v.amp ? "\\text{no X-gal: all } N=" + v.n + "\\text{ white}" :
      "\\begin{array}{l}\\text{no X-gal: all } N=" + v.n + "\\text{ white}\\\\\\text{plus a white lawn}\\end{array}";
    return "\\begin{array}{l}N_{\\text{white}}=Np=" + v.n + "\\cdot" + Viz.n(v.p) + "=" + Viz.n(m.np) + (m.whole ? "" : "\\approx " + m.w) +
      "\\\\N_{\\text{blue}}=N-N_{\\text{white}}=" + v.n + "-" + m.w + "=" + m.b + "\\end{array}";
  },
  status: function (v) {
    var m = Viz.get("blue-white-screening").model(v), w = m.w, b = m.b;
    if (!v.amp && !v.xgal) return "With no ampicillin and no X-gal the plate is just a <b>lawn</b>: nothing selected, nothing screened.";
    if (!v.amp) return "Without ampicillin, cells that never took up a plasmid grow too, a white <b>lawn</b> that " + (w ? "buries the " + w + " real white colonies." : "hides which cells were transformed.");
    if (!v.xgal) return "Without X-gal nothing turns blue, so the <b>" + w + "</b> insert colonies look the same as the " + b + " empty ones.";
    if (w === 0) return "Every colony is <b>blue</b>: all " + v.n + " plasmids closed up without the insert.";
    if (b === 0) return "Every colony is <b>white</b>: all " + v.n + " plasmids carry the insert.";
    return "Pick a <b>white</b> colony: " + w + " of " + v.n + " carry the insert, and the <b>" + b + "</b> blue ones are empty vector.";
  },
  examples: [
    {name: "no insert anywhere", values: {p: 0}},
    {name: "every plasmid has the insert", values: {p: 1, n: 150}},
    {name: "forgot X-gal", values: {xgal: false}},
    {name: "forgot ampicillin", values: {amp: false}}
  ],
  size: [400, 280],
  draw: function (api, v) {
    var c = api.color;
    var arc = function (C, r, d1, d2, color, w) {
      var a = [C[0] + r * Math.cos(d1 * Math.PI / 180), C[1] + r * Math.sin(d1 * Math.PI / 180)], b = [C[0] + r * Math.cos(d2 * Math.PI / 180), C[1] + r * Math.sin(d2 * Math.PI / 180)];
      api.path("M " + a[0] + " " + a[1] + " A " + r + " " + r + " 0 " + (d2 - d1 > 180 ? 1 : 0) + " 1 " + b[0] + " " + b[1], {stroke: color, width: w});
    };
    var ring = function (C, insert) {
      api.circle(C, 24, {stroke: c.muted, width: 3});
      arc(C, 24, 115, 195, c.c4, 6);
      arc(C, 24, -80, 30, c.c2, 6);
      if (insert) arc(C, 24, -40, -4, c.c3, 10);
    };
    // ---- the two kinds of plasmid ----
    ring([38, 72], false);
    api.label([72, 52], "no insert", {color: c.c2, size: 13, weight: 650});
    api.label([72, 72], "lacZα intact → β-gal", {color: c.ink, size: 12});
    api.label([72, 90], "cuts X-gal: blue", {color: c.c2, size: 12});
    ring([38, 170], true);
    api.label([72, 150], "insert in lacZα", {color: c.c3, size: 13, weight: 650});
    api.label([72, 170], "lacZα broken", {color: c.ink, size: 12});
    api.label([72, 188], "no β-gal: white", {color: c.ink, size: 12});
    api.label([14, 226], "ampR (green) lets", {color: c.c4, size: 12});
    api.label([14, 244], "plasmid cells live", {color: c.c4, size: 12});
    // ---- the plate ----
    var P = [306, 146], R = 82, seed = 17;
    var rnd = function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    var parts = ["LB"].concat(v.amp ? ["ampicillin"] : []).concat(v.xgal ? ["X-gal", "IPTG"] : []);
    api.label([P[0], 30], parts.join(" + "), {color: c.muted, size: 12, anchor: "middle"});
    api.circle(P, R, {stroke: c.muted, width: 1.6, fill: c.c3, fillOpacity: 0.05});
    var m = Viz.get("blue-white-screening").model(v), w = m.w, b = m.b, spots = [];
    seed = 91;
    for (var i = 0; i < v.n; i++) {
      var r2 = (R - 8) * Math.sqrt(rnd()), t2 = rnd() * 2 * Math.PI, white = i < w, at = [P[0] + r2 * Math.cos(t2), P[1] + r2 * Math.sin(t2)];
      api.circle(at, 4.2, {fill: (!v.xgal || white) ? c.ink : c.c2, stroke: c.card, width: 1});
      if (v.xgal && !white) spots.push(at);
    }
    if (!v.amp) {
      // no selection: untransformed (white) cells grow as one confluent lawn over the plate, so white colonies vanish in it
      api.circle(P, R - 1, {fill: c.card});
      api.circle(P, R - 1, {fill: c.ink, fillOpacity: 0.7});
      seed = 5;
      for (var j = 0; j < 700; j++) { var rr = (R - 4) * Math.sqrt(rnd()), th = rnd() * 2 * Math.PI;
        api.circle([P[0] + rr * Math.cos(th), P[1] + rr * Math.sin(th)], 2.2, {fill: rnd() < 0.5 ? c.card : c.ink, opacity: 0.18}); }
      spots.forEach(function (q) { api.circle(q, 3.6, {fill: c.c2, opacity: 0.8}); });   // blue cells still tint the lawn
    }
    if (!v.amp) {
      if (v.xgal) {
        api.label([P[0] + 22, 248], w + " white lost in the lawn,", {color: c.ink, size: 13, weight: 650, anchor: "end"});
        api.label([P[0] + 28, 248], b + " blue", {color: c.c2, size: 13, weight: 650});
      } else api.label([P[0], 248], v.n + " colonies hidden in the lawn", {color: c.ink, size: 13, weight: 650, anchor: "middle"});
    } else if (v.xgal) {
      api.label([P[0] - 8, 248], w + " white", {color: c.ink, size: 13, weight: 650, anchor: "end"});
      api.label([P[0] + 8, 248], b + " blue", {color: c.c2, size: 13, weight: 650});
    } else api.label([P[0], 248], v.n + " colonies, all white", {color: c.ink, size: 13, weight: 650, anchor: "middle"});
    if (!v.amp) api.label([P[0], 268], "+ a lawn of cells with no plasmid", {color: c.c5, size: 12, anchor: "middle"});
    else api.label([P[0], 268], v.xgal ? "white = insert, blue = empty" : "can't tell which have the insert", {color: v.xgal ? c.muted : c.c5, size: 12, anchor: "middle"});
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
