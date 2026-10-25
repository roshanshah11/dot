// Innate versus adaptive recognition. Innate cells carry a few germline-encoded pattern-recognition receptors
// (humans have 10 TLRs) that bind molecular patterns whole classes of microbes share and cannot easily change:
// TLR4 senses lipid A of LPS (all Gram-negative bacteria), TLR5 a conserved part of flagellin, TLR3 dsRNA and TLR7
// ssRNA inside endosomes. Every macrophage carries the same set, so they act at once and the same way every time.
// Adaptive lymphocytes each carry one recombined receptor (V(D)J); only the rare clone that fits a strain's own
// epitope responds: about 1 naive cell in 10^5 per epitope (order of magnitude), and it must expand roughly 10^4-fold
// over about a week. After an infection memory cells of that clone are ~100x more common and answer in a day or two.
// If the epitope changes (a new O-antigen serotype, a drifted flu hemagglutinin) memory no longer fits, while the
// conserved patterns innate receptors read are unchanged. The 15 cells drawn are a sample of the repertoire.
(function () {
  var MICROBES = {
    "E. coli": {clone: 3, variant: 8, bact: true},
    "Salmonella": {clone: 11, variant: 6, bact: true},
    "influenza": {clone: 12, variant: 1, bact: false}
  };
  function glyph(api, k, p, r, col) {
    var shp = k % 5, sty = Math.floor(k / 5), x = p[0], y = p[1], o = {fill: sty === 1 ? "none" : col, fillOpacity: 1, stroke: col, width: 1.6};
    if (shp === 0) api.polygon([[x, y - r], [x + r * 0.95, y + r * 0.7], [x - r * 0.95, y + r * 0.7]], o);
    else if (shp === 1) api.rect(x - r * 0.78, y - r * 0.78, r * 1.56, r * 1.56, Object.assign({rx: 1}, o));
    else if (shp === 2) api.polygon([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], o);
    else if (shp === 3) api.circle(p, r * 0.85, o);
    else api.polygon([[x, y + r], [x + r * 0.95, y - r * 0.7], [x - r * 0.95, y - r * 0.7]], o);
    if (sty === 2) api.circle(shp === 0 ? [x, y + r * 0.15] : shp === 4 ? [x, y - r * 0.15] : p, r * 0.3, {fill: api.color.card});
  }
  function slots(v) {   // which clone sits in each of the 15 sampled cells
    var m = MICROBES[v.microbe], out = [];
    for (var i = 0; i < 15; i++) out.push(i);
    if (v.encounter === "second") [3, 6, 9, 12].forEach(function (d) { out[(m.clone + d) % 15] = m.clone; });
    return out;
  }
  Viz.register("innate-vs-adaptive-immunity", {
    title: "Innate versus adaptive recognition",
    subject: "biology",
    shows: "Pick a microbe: innate cells all use the same few receptors for patterns whole groups of microbes share, while adaptive immunity relies on the one rare clone whose receptor fits this strain; meet it again and memory makes that clone common, change its epitope and memory misses",
    params: {
      microbe: {kind: "enum", values: ["E. coli", "Salmonella", "influenza"], default: "E. coli", label: "\\text{microbe}"},
      encounter: {kind: "enum", values: ["first", "second"], default: "first", label: "\\text{meeting}"},
      variant: {kind: "boolean", default: false, label: "\\text{epitope}", on: "changed (new strain)", off: "same"}
    },
    formula: function (v) {
      var m = MICROBES[v.microbe], mem = v.encounter === "second" && !v.variant;
      return "\\text{innate: " + (m.bact ? "TLR4, TLR5" : "TLR7") + " on every cell}\\newline\\text{adaptive: one clone, }f" +
        (mem ? "_{\\text{memory}}\\approx 10^{-3}" : "_{\\text{naive}}\\approx 10^{-5}");
    },
    status: function (v) {
      var m = MICROBES[v.microbe], sec = v.encounter === "second";
      var inn = m.bact ? "<b>TLR4</b> and <b>TLR5</b> on every macrophage grab LPS and flagellin, patterns all Gram-negative bacteria share" :
        "<b>TLR7</b> in every macrophage's endosomes senses the virus's single-stranded RNA";
      if (sec && v.variant) return "The epitope has changed, so the <b>memory cells no longer fit</b> and a new naive clone must start from scratch, while the innate receptors still bind because " + (m.bact ? "lipid A and flagellin's core are conserved." : "viral RNA is still RNA.");
      if (sec) return "Second meeting: the innate receptors respond exactly as before, but the fitting clone is now a <b>memory</b> population about 100× larger, so the adaptive response starts within a day or two.";
      return "Innate: " + inn + "; adaptive: only the <b>one clone</b> whose receptor fits this " + (v.variant ? "new strain's" : "strain's") + " epitope responds, about 1 lymphocyte in 100,000.";
    },
    examples: [
      {name: "a Gram-negative bacterium", values: {microbe: "E. coli"}},
      {name: "a different bacterium, same innate receptors", values: {microbe: "Salmonella"}},
      {name: "a virus", values: {microbe: "influenza"}},
      {name: "memory", values: {microbe: "influenza", encounter: "second"}},
      {name: "drifted flu escapes memory", values: {microbe: "influenza", encounter: "second", variant: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = MICROBES[v.microbe], sec = v.encounter === "second", fit = v.variant ? m.variant : m.clone;
      var M = [200, 44], L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12}, o || {})); };
      L([8, 14], "innate", c.c1, {size: 13, weight: 700});
      L([392, 14], "adaptive", c.c2, {size: 13, weight: 700, anchor: "end"});
      api.line([200, 84], [200, 292], {color: c.grid, width: 1});
      // the macrophage, its surface TLRs and an endosome with TLR3 and TLR7 inside
      var C = [96, 168], R = 66, E = [96, 194], ER = 20;
      var tlr = function (center, rad, deg, inward) {
        var a = deg * Math.PI / 180, n = [Math.cos(a), Math.sin(a)], s = inward ? -1 : 1, t = [-n[1], n[0]];
        var base = [center[0] + n[0] * rad, center[1] + n[1] * rad], tip = [base[0] + s * n[0] * 10, base[1] + s * n[1] * 10];
        return {base: base, tip: tip, n: [s * n[0], s * n[1]], t: t};
      };
      var recs = [{name: "TLR4", g: tlr(C, R, -128), on: m.bact, lab: [44, 96], anchor: "end"},
                  {name: "TLR5", g: tlr(C, R, -52), on: m.bact, lab: [148, 96], anchor: "start"},
                  {name: "TLR3", g: tlr(E, ER, 180, true), on: false, lab: [70, 194], anchor: "end"},
                  {name: "TLR7", g: tlr(E, ER, 0, true), on: !m.bact, lab: [122, 194], anchor: "start"}];
      api.circle(C, R, {fill: c.c1, fillOpacity: 0.08, stroke: c.c1, width: 2});
      api.circle(E, ER, {fill: c.c1, fillOpacity: 0.08, stroke: c.c1, width: 1.4, dash: "4 3"});
      L([96, 223], "endosome", c.c1, {anchor: "middle"});
      // binding lines first so the receptors sit on top
      var src = m.bact ? [[176, 50], [184, 56]] : [[190, 58]];
      recs.filter(function (r) { return r.on; }).forEach(function (r, i) {
        var q = r.g, cup = [q.tip[0] + q.n[0] * 4, q.tip[1] + q.n[1] * 4];
        api.line(src[i] || src[0], cup, {color: c.c4, width: 1.6, dash: "4 3"});
      });
      recs.forEach(function (r) {
        var q = r.g, col = r.on ? c.c4 : c.muted, k = q.tip;
        api.line(q.base, k, {color: col, width: 2.4});
        api.path("M " + (k[0] + q.t[0] * 6 + q.n[0] * 7) + " " + (k[1] + q.t[1] * 6 + q.n[1] * 7) + " Q " + (k[0] - q.n[0] * 5) + " " + (k[1] - q.n[1] * 5) + " " + (k[0] - q.t[0] * 6 + q.n[0] * 7) + " " + (k[1] - q.t[1] * 6 + q.n[1] * 7), {stroke: col, width: 2.6});
        L(r.lab, r.name, col, {weight: 650, anchor: r.anchor});
      });
      L([8, 256], "same few TLRs on every cell", c.c1);
      L([8, 273], "about 10 TLR genes, inherited", c.muted);
      L([8, 290], m.bact ? "binds LPS and flagellin" : "binds viral ssRNA", c.c4, {weight: 600});
      // the microbe in the middle, carrying its strain-specific epitope
      if (m.bact) {
        api.path("M 170 44 q -8 -10 -16 -2 q -8 8 -16 0", {stroke: c.c5, width: 1.6});
        api.rect(M[0] - 30, M[1] - 12, 60, 24, {fill: c.c5, fillOpacity: 0.85, stroke: c.c5, rx: 12});
        [[-18, -12], [-6, -12], [6, -12], [18, -12], [-18, 12], [-6, 12], [6, 12], [18, 12]].forEach(function (o) { api.line([M[0] + o[0], M[1] + o[1]], [M[0] + o[0], M[1] + o[1] + (o[1] < 0 ? -4 : 4)], {color: c.c5, width: 1.4}); });
      } else {
        for (var s = 0; s < 12; s++) { var a = s * Math.PI / 6; api.line([M[0] + 16 * Math.cos(a), M[1] + 16 * Math.sin(a)], [M[0] + 22 * Math.cos(a), M[1] + 22 * Math.sin(a)], {color: c.c5, width: 2}); }
        api.circle(M, 16, {fill: c.c5, fillOpacity: 0.85, stroke: c.c5});
      }
      glyph(api, fit, [M[0] + (m.bact ? 12 : 0), M[1]], 6, c.ink);
      L([M[0], 14], v.microbe + (v.variant ? " (new strain)" : ""), c.c5, {weight: 650, anchor: "middle"});
      // a sample of 15 lymphocytes, each with its own receptor shape
      var sl = slots(v), pos = function (i) { return [228 + (i % 5) * 38, 104 + Math.floor(i / 5) * 38]; };
      var fitIdx = sl.indexOf(fit);
      api.line([M[0] + (m.bact ? 12 : 0), M[1] + 8], pos(fitIdx), {color: c.c4, width: 1.6, dash: "4 3"});
      sl.forEach(function (k, i) {
        var p = pos(i), isFit = k === fit, isMem = sec && k === m.clone;
        api.circle(p, 14, {fill: c.c2, fillOpacity: isFit ? 0.35 : 0.12, stroke: isFit ? c.c4 : c.c2, width: isFit ? 3 : isMem ? 2.6 : 1.2});
        glyph(api, k, p, 6, c.ink);
      });
      var mem = sec && !v.variant;
      L([392, 214], mem ? "the memory clone fits" : v.variant && sec ? "a new naive clone fits" : "one clone fits this epitope", c.c4, {weight: 650, anchor: "end"});
      L([392, 236], mem ? "about 100× more common now" : "naive: about 1 cell in 10⁵", mem ? c.c2 : c.muted, {anchor: "end"});
      L([392, 256], mem ? "answers in 1 to 2 days" : "must expand first: about a week", c.muted, {anchor: "end"});
      if (sec && v.variant) L([392, 276], "thick blue: memory cells, no fit", c.c2, {anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
