// The leading strand: its template runs 3'->5' toward the fork, so the new strand (5'->3') can follow the helicase in one
// continuous run from a single RNA primer laid at the origin. E. coli numbers: the fork moves about 1,000 nt/s; pol III
// held on by the beta sliding clamp copies more than 50,000 nt per binding (Lehninger lists >= 500,000), while the pol III
// core alone falls off after about 10 nt. So copying d nt takes ceil(d / P) bindings: 1 with the clamp, about d / 10
// without it. The bar chart is on a log scale.
(function () {
  var V = 1000, P_CORE = 10, TMAX = 20;
  function txtInt(x) { return Math.round(x).toLocaleString("en-US"); }
  function texInt(x) { return txtInt(x).replace(/,/g, "{,}"); }
  function binds(v) { return v.clamp ? 1 : Math.ceil(V * v.t / P_CORE); }

  Viz.register("dna-replication-leading-strand-synthesis", {
    title: "Leading strand: one primer, one continuous run",
    subject: "biology",
    shows: "Slide time and toggle the sliding clamp: the leading strand follows the fork in one continuous piece from one primer, and the clamp is what keeps the polymerase on for the whole run",
    params: {
      t: {kind: "integer", default: 8, min: 1, max: TMAX, label: "t\\ (\\text{s})"},
      clamp: {kind: "boolean", default: true, label: "\\beta\\ \\text{clamp}", on: "on", off: "off"}
    },
    formula: function (v) {
      var d = V * v.t;
      return "\\begin{array}{l}d=v\\,t=" + texInt(V) + "\\times" + v.t + "=" + texInt(d) + "\\ \\text{nt}\\\\ " +
        (v.clamp ? "P>50{,}000\\ \\text{nt}\\Rightarrow 1\\ \\text{binding}" : "P\\approx" + P_CORE + "\\ \\text{nt}\\Rightarrow\\lceil " + texInt(d) + "/" + P_CORE + "\\rceil=" + texInt(binds(v))) + "\\end{array}";
    },
    status: function (v) {
      var d = V * v.t;
      return v.clamp ? "In " + v.t + " s pol III, held on by the β clamp, extends the one leading-strand primer by <b>" + txtInt(d) + " nt</b> in <b>one</b> continuous run."
        : "Without the clamp the pol III core falls off after about 10 nt, so " + txtInt(d) + " nt would take about <b>" + txtInt(binds(v)) + "</b> separate bindings.";
    },
    examples: [
      {name: "one second", values: {t: 1}},
      {name: "twenty seconds", values: {t: 20}},
      {name: "no clamp", values: {t: 8, clamp: false}},
      {name: "no clamp, twenty seconds", values: {t: 20, clamp: false}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, d = V * v.t, on = v.clamp;
      // ---- close-up at the fork (not to scale) ----
      var yT = 52, yN = 72, xf = 318;
      api.line([12, yT], [xf - 14, yT], {color: c.c2, width: 3.5});
      api.polyline([[xf - 14, yT], [xf, yT + 26], [392, yT + 26]], {stroke: c.c2, width: 3.5});
      api.polyline([[392, yT + 42], [xf, yT + 42], [xf - 14, yT + 70], [190, yT + 70]], {stroke: c.c2, width: 3.5, opacity: 0.45});
      api.label([186, yT + 70], "lagging-strand template", {color: c.c2, size: 12, anchor: "end", opacity: 0.7});
      for (var x = xf + 6; x < 392; x += 8) api.line([x, yT + 29], [x, yT + 39], {color: c.faint, width: 1});
      api.rect(xf - 6, yT + 14, 12, 40, {fill: c.muted, fillOpacity: 0.2, stroke: c.muted, width: 1.2, rx: 6});
      api.label([xf + 10, yT + 2], "helicase", {color: c.muted, size: 12});
      api.label([10, yT - 13], "3′", {color: c.c2, size: 12});
      api.label([10, yN + 14], "5′", {color: c.c3, size: 12});
      var xe = 262;
      for (x = 26; x < xe - 2; x += 8) api.line([x, yT + 3], [x, yN - 3], {color: c.faint, width: 1});
      api.line([16, yN], [xe, yN], {color: c.c3, width: 4});
      api.line([16, yN], [34, yN], {color: c.c5, width: 5});
      api.label([25, yN + 16], "primer", {color: c.c5, size: 12, anchor: "start"});
      api.label([150, yN + 16], "leading strand, 5′ → 3′", {color: c.c3, size: 12, anchor: "middle"});
      if (on) {
        api.rect(xe - 2, yT - 12, 40, 44, {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.8, rx: 12});
        api.label([xe + 18, yT + 10], "pol III", {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        api.rect(xe - 14, yT - 10, 10, 40, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.8, rx: 5});
        api.label([xe - 18, yT - 22], "β clamp", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      } else {
        api.rect(xe + 6, yT - 46, 40, 34, {fill: c.c6, fillOpacity: 0.12, stroke: c.c6, width: 1.5, rx: 12, dash: "4 3"});
        api.label([xe + 26, yT - 29], "pol III", {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        api.arrow([xe + 2, yT - 2], [xe + 12, yT - 12], {color: c.c6, width: 2, halo: false, head: 7});
        api.label([xe, yT - 29], "falls off every ~10 nt", {color: c.c5, size: 12, weight: 650, anchor: "end"});
      }
      // ---- how far it has gone, to scale ----
      var x0 = 30, x1 = 370, X = function (nt) { return x0 + (x1 - x0) * nt / (V * TMAX); }, yS = 150;
      api.line([x0, yS + 12], [x1, yS + 12], {color: c.axis, width: 1});
      [0, 5, 10, 15, 20].forEach(function (k) { api.label([X(k * 1000), yS + 25], String(k), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([x1, yS + 40], "kb from the origin", {color: c.muted, size: 12, anchor: "end"});
      api.line([x0, yS], [X(d) - 6, yS], {color: c.c3, width: 4});
      api.polygon([[X(d) + 2, yS], [X(d) - 8, yS - 5], [X(d) - 8, yS + 5]], {fill: c.c3, fillOpacity: 1});
      api.rect(x0, yS - 3.5, 3, 7, {fill: c.c5, rx: 1});
      api.label([Math.min(X(d), 330), yS - 14], txtInt(d) + " nt", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // ---- polymerase bindings needed, log scale ----
      var bx = 112, bw = 250, lmax = Math.log10(V * TMAX / P_CORE), BX = function (n) { return bx + bw * Math.log10(n) / lmax; };
      var rows = [["with clamp", 1, true], ["without", Math.ceil(d / P_CORE), false]];
      api.label([16, 214], "bindings (log scale)", {color: c.muted, size: 12});
      rows.forEach(function (r, i) {
        var y = 236 + i * 26, cur = r[2] === on;
        api.label([bx - 8, y], r[0], {color: cur ? c.ink : c.muted, size: 12, weight: cur ? 650 : 500, anchor: "end"});
        api.rect(bx, y - 8, Math.max(3, BX(r[1]) - bx), 16, {fill: c.c6, fillOpacity: cur ? 0.85 : 0.25, rx: 3});
        api.label([Math.max(bx + 3, BX(r[1])) + 6, y], txtInt(r[1]), {color: cur ? c.ink : c.muted, size: 12, weight: 650});
      });
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
