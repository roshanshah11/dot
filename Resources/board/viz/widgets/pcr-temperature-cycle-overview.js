// A whole PCR program on the thermocycler: initial denaturation (95 °C, 2 min), then n cycles of denature (95 °C, 30 s),
// anneal (Ta, 30 s) and extend (72 °C, Taq's optimum, about 1 min per kb of product), a final extension (72 °C, 5 min)
// and a 4 °C hold. Ta is judged against the primers' melting temperature (Tm = 60 °C here): a few degrees below Tm
// binds only the exact site; above Tm primers will not stay on; far below, they also stick to near-matches.
// Times follow a standard Taq protocol and ignore ramping between temperatures; time is not drawn to scale.
// L is in bp (250 to 5000 in steps of 250) rather than kb so the number box shows the exact length (0.25 kb read 0.3).
// Bands: Tm-5..Tm specific; just under that a little loose; more than 8 below nonspecific; just over Tm weak; over Tm+2 nothing.
(function () {
  var TM = 60, TI = 2, TD = 0.5, TA = 0.5, TF = 5;   // minutes
  function fit(ta) { return ta > TM + 2 ? "hot" : ta > TM ? "warm" : ta >= TM - 5 ? "good" : ta >= TM - 8 ? "cool" : "low"; }
  function te(v) { return v.L / 1000; }   // extension minutes at about 1000 bp per minute
  function total(v) { return TI + v.n * (TD + TA + te(v)) + TF; }
  function secs(min) { return min < 1 ? Math.round(min * 60) + " s" : Viz.fmt(min, 2) + " min"; }

  Viz.register("pcr-temperature-cycle-overview", {
    title: "PCR: the temperature program",
    subject: "biology",
    shows: "Step through a full PCR run on the thermocycler; slide the annealing temperature against the primers' Tm, the product length (which sets the extension time) and the cycles",
    params: {
      Ta: {kind: "integer", default: 55, min: 45, max: 70, label: "T_a\\,(^\\circ\\mathrm{C})"},
      L: {kind: "integer", default: 1000, min: 250, max: 5000, step: 250, label: "L\\,(\\text{bp})"},
      n: {kind: "integer", default: 30, min: 20, max: 40, label: "n"}
    },
    steps: ["initial denaturation", "denature", "anneal", "extend", "final extension, then hold"],
    stepMs: 1600,
    formula: function (v) {
      return "\\begin{array}{l}t=t_i+n\\,\\big(t_d+t_a+\\tfrac{L}{1000}\\big)+t_f\\ \\text{(min)}\\\\ \\phantom{t}=2+" + v.n + "\\,(0.5+0.5+" + Viz.n(te(v), 2) + ")+5=" + Viz.n(total(v), 1) + "\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, f = fit(v.Ta), d = TM - v.Ta;
      if (s === 1) return "Initial denaturation: <b>2 min at 95 °C</b> separates even long or GC-rich template completely before cycling starts.";
      if (s === 2) return "Denature: <b>30 s at 95 °C</b> breaks the hydrogen bonds, so every double strand becomes two single-stranded templates.";
      if (s === 3) return f === "hot" ? "Anneal at " + v.Ta + " °C, " + (-d) + " °C <b>above</b> the primers' 60 °C Tm: primers cannot stay bound, so little or no product." :
        f === "warm" ? "Anneal at " + v.Ta + " °C, just above the primers' 60 °C Tm: they hold only briefly, so the product stays specific but <b>the yield drops</b>." :
        f === "good" ? "Anneal at " + v.Ta + " °C, " + (d ? d + " °C below" : "right at") + " the primers' Tm: they bind only their exact site, giving <b>one specific product</b>." :
        f === "cool" ? "Anneal at " + v.Ta + " °C, " + d + " °C below Tm: mostly the right product, but <b>faint extra bands</b> can start to appear." :
        "Anneal at " + v.Ta + " °C, " + d + " °C below Tm: primers also stick to near-matches, so <b>extra, nonspecific bands</b> are likely.";
      if (s === 4) return "Extend at <b>72 °C</b>, Taq's optimum: at about 1000 bp per minute a " + v.L.toLocaleString("en-US") + " bp product needs <b>" + secs(te(v)) + "</b> per cycle.";
      return "A <b>5 min</b> final extension finishes every strand, then the block holds at 4 °C; the whole run takes about <b>" + Viz.fmt(total(v), 1) + " min</b>.";
    },
    examples: [
      {name: "lowest settings", values: {Ta: 45, L: 250, n: 20, step: 3}},
      {name: "highest settings", values: {Ta: 70, L: 5000, n: 40, step: 3}},
      {name: "well-chosen anneal", values: {Ta: 56, L: 1000, n: 30, step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, f = fit(v.Ta), Y = function (t) { return 200 - 1.55 * t; }, R = 6;
      var annC = f === "good" ? c.c4 : f === "hot" || f === "warm" ? c.c5 : c.c3;   // green right, red too hot, amber too cool
      // plateaus: [step, temp, width, time label, color]; the cycle is steps 2-4
      var segs = [[1, 95, 44, "2 min", c.c5], [2, 95, 34, "30 s", c.c5], [3, v.Ta, 34, "30 s", annC], [4, 72, 22 + 16 * te(v), secs(te(v)), c.c2],
                  [5, 72, 38, "5 min", c.c2], [5, 4, 34, "hold", c.c1]];
      var x = 46, pts = [[x, Y(25)]], spans = [];
      segs.forEach(function (g, i) {
        x += R; var y = Y(g[1]); pts.push([x, y]);
        spans.push([x, x + g[2], y]); x += g[2]; pts.push([x, y]);
      });
      // highlight the current phase
      var hi = spans.filter(function (q, i) { return segs[i][0] === s; });
      hi.forEach(function (q) { api.rect(q[0] - 3, 30, q[1] - q[0] + 6, 170, {rx: 4, fill: c.ink, fillOpacity: 0.07}); });
      // axes
      api.line([36, 200], [388, 200], {color: c.axis, width: 1.2});
      api.line([36, 200], [36, 34], {color: c.axis, width: 1.2});
      [0, 50, 100].forEach(function (t) { api.label([31, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([40, 22], "°C", {color: c.muted, size: 12});
      api.label([388, 212], "time (not to scale)", {color: c.muted, size: 12, anchor: "end"});
      // primer Tm, across the cycle
      var cyc0 = spans[1][0] - R, cyc1 = spans[3][1] + 3;
      api.line([100, Y(TM)], [spans[2][1] + 3, Y(TM)], {color: c.muted, width: 1.2, dash: "4 4"});   // ends at the anneal: clear of the 72° labels
      api.label([58, Y(TM)], "Tm 60°", {color: c.muted, size: 12});
      // the trace
      api.polyline(pts, {stroke: c.faint, width: 2});
      spans.forEach(function (q, i) {
        var g = segs[i], on = g[0] === s;
        api.line([q[0], q[2]], [q[1], q[2]], {color: g[4], width: on ? 5 : 3.5});
        // the anneal labels go on the side of its plateau away from the Tm line: below when Ta <= Tm, above when hotter
        var ann = i === 2, yT = ann ? (g[1] <= TM ? q[2] + 15 : q[2] - 24) : q[2] - 10;
        var ty = ann ? (g[1] <= TM ? q[2] + 29 : q[2] - 10) : g[1] < 10 ? q[2] - 24 : q[2] + 13;
        api.label([(q[0] + q[1]) / 2, yT], g[1] + "°", {color: g[4], size: 12, weight: on ? 750 : 550, anchor: "middle"});
        api.label([(q[0] + q[1]) / 2, ty], g[3], {color: on ? c.ink : c.muted, size: 12, anchor: "middle"});
      });
      // the repeated block
      api.line([cyc0, 30], [cyc1, 30], {color: c.ink, width: 1.4});
      api.line([cyc0, 30], [cyc0, 36], {color: c.ink, width: 1.4}); api.line([cyc1, 30], [cyc1, 36], {color: c.ink, width: 1.4});
      api.label([(cyc0 + cyc1) / 2, 18], "× " + v.n + " cycles", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      // what the DNA is doing in this phase
      var dx = 90, dw = 170, yA = 240, yB = 268;   // strands left of centre so the side labels fit
      if (s === 5) {
        [0, 1].forEach(function (k) {
          api.line([dx - 40 + k * 140, yA + 4], [dx + 60 + k * 140, yA + 4], {color: c.c1, width: 4});
          api.line([dx - 40 + k * 140, yA + 14], [dx + 60 + k * 140, yA + 14], {color: c.c3, width: 4});
        });
        api.label([200, yB + 8], "finished copies, kept cold at 4 °C", {color: c.c1, size: 12, anchor: "middle"});
      } else {
        api.line([dx, yA], [dx + dw, yA], {color: c.c1, width: 4});
        api.line([dx, yB], [dx + dw, yB], {color: c.c2, width: 4});
        if (s <= 2) api.label([dx + dw + 14, (yA + yB) / 2], "strands apart", {color: c.c5, size: 12});
        if (s >= 3) {
          var lab = function (t, col) { api.label([dx + dw + 14, (yA + yB) / 2], t, {color: col, size: 12}); };
          if (f === "hot") {   // primers float free
            api.line([dx + 10, yB - 14], [dx + 40, yB - 18], {color: c.c5, width: 4});
            api.line([dx + dw - 40, yA + 18], [dx + dw - 10, yA + 14], {color: c.c5, width: 4});
            if (s === 3) lab("primers off", c.c5);
          } else {
            api.line([dx, yB - 7], [dx + 34, yB - 7], {color: c.c4, width: 4});
            if (f === "warm") api.line([dx + dw - 36, yA + 14], [dx + dw - 4, yA + 7], {color: c.c5, width: 4});   // just over Tm: one peels off
            else api.line([dx + dw - 34, yA + 7], [dx + dw, yA + 7], {color: c.c4, width: 4});
            if (f === "low" || f === "cool") api.line([dx + 70, yA + 7], [dx + 100, yA + 7], {color: c.c3, width: 4, opacity: f === "cool" ? 0.45 : 1});
            if (s === 3) lab({low: "a stray primer too", cool: "rare stray primer", warm: "one slips off", good: "primers bound"}[f],
                             {low: c.c3, cool: c.c3, warm: c.c5, good: c.c4}[f]);
          }
          if (s === 4) {
            if (f !== "hot") api.arrow([dx + 34, yB - 7], [dx + dw - 2, yB - 7], {color: c.c3, width: 3, halo: false});
            if (f !== "hot" && f !== "warm") api.arrow([dx + dw - 34, yA + 7], [dx + 2, yA + 7], {color: c.c3, width: 3, halo: false});
            lab(f === "hot" ? "nothing to extend" : f === "warm" ? "fewer copies" : "copies grow", f === "hot" ? c.c5 : c.c3);
          }
        }
      }
      api.root.querySelectorAll("text").forEach(function (t) { var fl = t.getAttribute("fill"); if (fl) t.style.fill = fl; });   // viz.css paints text ink
    }
  });
})();
