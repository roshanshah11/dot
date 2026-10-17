// Meselson and Stahl (1958): E. coli grown on heavy 15N, then moved to 14N; DNA spun in a CsCl gradient bands by density
// (15N/15N 1.724 g/mL, 14N/14N 1.710, hybrid 1.717, so rho = 1.710 + 0.014 f where f is the 15N share). Three models of
// copying predict different bands after n generations: semiconservative (each daughter keeps one old strand: 2/2^n hybrid,
// the rest light), conservative (the old duplex stays whole: 1/2^n heavy, the rest light) and dispersive (every strand a
// patchwork: one band at f = 1/2^n). They saw one hybrid band at n = 1 and hybrid + light at n = 2: semiconservative.
(function () {
  var MODELS = ["semiconservative", "conservative", "dispersive"];
  function grow(model, n) {             // molecules per generation; a molecule is [heavy share of strand 1, of strand 2]
    var rows = [[[1, 1]]];
    for (var k = 1; k <= n; k++) {
      var next = [];
      rows[k - 1].forEach(function (m) {
        if (model === "semiconservative") next.push([m[0], 0], [0, m[1]]);
        else if (model === "conservative") next.push([m[0], m[1]], [0, 0]);
        else next.push([m[0] / 2, m[1] / 2], [m[0] / 2, m[1] / 2]);
      });
      rows.push(next);
    }
    return rows;
  }
  function bands(model, n) {           // {density share f: fraction of the DNA}
    var out = {};
    grow(model, n)[n].forEach(function (m, i, all) { var f = (m[0] + m[1]) / 2, key = f.toFixed(4); out[key] = (out[key] || 0) + 1 / all.length; });
    return out;
  }
  function pc(x) { return Viz.fmt(100 * x, 2) + "%"; }
  function rho(f) { return 1.710 + 0.014 * f; }

  Viz.register("dna-replication-semiconservative-inheritance", {
    title: "Semiconservative replication: the Meselson–Stahl result",
    subject: "biology",
    shows: "Move heavy-labeled DNA into light medium for n generations: each model of copying predicts different bands in a density gradient, and only semiconservative matches what was seen",
    params: {
      n: {kind: "integer", default: 2, min: 0, max: 4, label: "n\\ \\text{(gens)}"},
      model: {kind: "enum", values: MODELS, default: "semiconservative", label: "\\text{model}", names: {semiconservative: "semi", conservative: "conservative", dispersive: "dispersive"}}
    },
    formula: function (v) {
      var n = v.n, p = Math.pow(2, n);
      if (n === 0) return "\\text{heavy}=100\\%,\\ \\rho=1.710+0.014\\cdot 1=1.724\\ \\text{g/mL}";
      if (v.model === "semiconservative") return "\\begin{array}{l}\\text{hybrid}=\\dfrac{2}{2^{" + n + "}}=" + Viz.n(100 * 2 / p, 1) + "\\%,\\ \\text{light}=" + Viz.n(100 - 200 / p, 1) + "\\%\\\\ \\rho_{\\text{hybrid}}=1.710+0.014\\cdot\\tfrac12=1.717\\end{array}";
      if (v.model === "conservative") return "\\begin{array}{l}\\text{heavy}=\\dfrac{1}{2^{" + n + "}}=" + Viz.n(100 / p, 2) + "\\%,\\ \\text{light}=" + Viz.n(100 - 100 / p, 2) + "\\%\\\\ \\text{hybrid}=0\\end{array}";
      return "\\begin{array}{l}f=\\dfrac{1}{2^{" + n + "}}=" + Viz.n(1 / p, 4) + "\\ \\text{in every duplex}\\\\ \\rho=1.710+0.014\\cdot" + Viz.n(1 / p, 4) + "=" + Viz.n(rho(1 / p), 4) + "\\end{array}";
    },
    status: function (v) {
      var n = v.n, p = Math.pow(2, n), g = n + " generation" + (n === 1 ? "" : "s");
      if (n === 0) return "Before the switch every duplex is <b>¹⁵N/¹⁵N</b>, one heavy band at 1.724 g/mL, whatever the model.";
      if (v.model === "semiconservative") return "After " + g + " <b>" + pc(2 / p) + "</b> of the DNA is hybrid and " + pc(1 - 2 / p) + " light: the two original strands survive intact, each paired with a new one, exactly the bands Meselson and Stahl saw.";
      if (v.model === "conservative") return "After " + g + " this model gives <b>" + pc(1 / p) + " heavy</b> and " + pc(1 - 1 / p) + " light with no hybrid band, but the real gradient showed a hybrid band after one generation, so it is ruled out.";
      return "Every duplex is " + pc(1 / p) + " ¹⁵N, so there is <b>one band</b> at " + Viz.fmt(rho(1 / p), 4) + " g/mL" + (n === 1 ? ", which matches generation 1, but generation 2 showed two bands (hybrid and light), ruling it out." : ", but the real gradient showed separate hybrid and light bands, so it is ruled out.");
    },
    examples: [
      {name: "before the switch", values: {n: 0}},
      {name: "one generation", values: {n: 1}},
      {name: "four generations", values: {n: 4}},
      {name: "conservative, one generation", values: {n: 1, model: "conservative"}},
      {name: "dispersive, two generations", values: {n: 2, model: "dispersive"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, rows = grow(v.model, v.n), x0 = 32, wT = 226, H = 28;
      var Y = function (k) { return 46 + k * 50; };
      api.label([x0 - 22, 16], "gen", {color: c.muted, size: 12});
      api.label([x0 + wT / 2, 16], Math.pow(2, v.n) + " duplex" + (v.n ? "es" : "") + " after " + v.n + " generation" + (v.n === 1 ? "" : "s"), {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      var strand = function (x, yTop, f) {                   // f = heavy share; heavy pieces blue, light amber
        api.line([x, yTop], [x, yTop + H], {color: c.c3, width: 3});
        if (f >= 0.999) { api.line([x, yTop], [x, yTop + H], {color: c.c2, width: 3}); return; }
        if (f > 0) [0.22, 0.68].forEach(function (t) { var len = Math.max(1.6, f * H / 2); api.line([x, yTop + t * H], [x, yTop + t * H + len], {color: c.c2, width: 3}); });
      };
      rows.forEach(function (row, k) {
        var slot = wT / row.length, y = Y(k);
        api.label([x0 - 18, y], String(k), {color: c.muted, size: 12, anchor: "middle"});
        row.forEach(function (m, j) {
          var cx = x0 + slot * (j + 0.5);
          if (k > 0) { var ps = wT / rows[k - 1].length, pcx = x0 + ps * (Math.floor(j / 2) + 0.5); api.line([pcx, Y(k - 1) + H / 2 + 3], [cx, y - H / 2 - 3], {color: c.faint, width: 1, opacity: 0.6}); }
          strand(cx - 3, y - H / 2, m[0]); strand(cx + 3, y - H / 2, m[1]);
        });
      });
      // the CsCl tube: lighter DNA floats higher
      var tx = 282, tw = 28, top = 34, bot = 262, yR = function (r) { return 70 + (r - 1.706) / 0.022 * 170; };
      api.label([tx + tw / 2, 16], "CsCl gradient", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.path("M " + tx + " " + top + " L " + tx + " " + (bot - 14) + " Q " + tx + " " + bot + " " + (tx + tw / 2) + " " + bot + " Q " + (tx + tw) + " " + bot + " " + (tx + tw) + " " + (bot - 14) + " L " + (tx + tw) + " " + top,
        {stroke: c.muted, width: 1.4});
      api.label([tx + tw + 6, top + 8], "less dense", {color: c.muted, size: 12});
      api.label([tx + tw + 6, bot - 6], "denser", {color: c.muted, size: 12});
      var seen = bands(v.model, v.n), ref = {"0.0000": "light", "0.5000": "hybrid", "1.0000": "heavy"};
      Object.keys(ref).forEach(function (key) {             // where the three pure bands would sit
        var y = yR(rho(Number(key)));
        var near = Object.keys(seen).some(function (k2) { return Math.abs(yR(rho(Number(k2))) - y) < 24; });
        if (!seen[key]) { api.line([tx + 3, y], [tx + tw - 3, y], {color: c.faint, width: 1, dash: "2 3"}); if (!near) api.label([tx + tw + 6, y], ref[key], {color: c.faint, size: 12}); }
      });
      Object.keys(seen).forEach(function (key) {
        var f = Number(key), y = yR(rho(f)), share = seen[key], col = f > 0.75 ? c.c2 : f > 0.25 ? c.c6 : c.c3;
        api.rect(tx + 2, y - 4, tw - 4, 8, {rx: 4, fill: col, fillOpacity: 0.25 + 0.75 * share});
        if (ref[key]) api.label([tx + tw + 6, y], ref[key] + " " + pc(share), {color: col, size: 12, weight: 700});
        else { api.label([tx + tw + 6, y - 7], "one band", {color: col, size: 12, weight: 700}); api.label([tx + tw + 6, y + 8], "¹⁵N " + pc(f), {color: col, size: 12}); }
      });
      api.label([200, 290], "blue: ¹⁵N (heavy) strand  ·  amber: ¹⁴N (light) strand", {color: c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
