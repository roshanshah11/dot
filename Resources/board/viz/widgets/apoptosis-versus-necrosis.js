// Two ways a cell dies, side by side. Apoptosis is a program: the cell spends ATP to shrink, condense its chromatin,
// cut its DNA between nucleosomes (a ~180 bp ladder on a gel) and bud into sealed apoptotic bodies that phagocytes eat
// without inflammation. Necrosis is injury: ATP runs out, ion pumps fail, the cell swells and bursts, its DNA is
// degraded at random (a smear) and the spilled contents act as danger signals that call in neutrophils.
(function () {
  var ROWS = [["cause", "programmed signal", "injury or toxin"],
              ["size", "shrinks · ATP used", "swells · ATP gone"],
              ["membrane", "blebs, stays sealed", "ruptures, leaks"],
              ["DNA", "ladder (n × 180 bp)", "random smear"],
              ["after", "eaten, no inflammation", "inflammation"]];
  var TEXT = ["Apoptosis starts from a signal the cell answers on purpose; necrosis starts from an injury it cannot survive, such as lost blood supply, a toxin or a burn",
              "The apoptotic cell <b>shrinks</b> and condenses its chromatin, spending ATP to run the program; the necrotic cell <b>swells</b>, because without ATP its ion pumps fail and water floods in",
              "The apoptotic membrane blebs but <b>stays sealed</b> as the cell buds into apoptotic bodies; the necrotic membrane <b>ruptures</b> and spills the cell's contents",
              "A caspase-activated DNase cuts apoptotic DNA between nucleosomes into multiples of about 180 bp, a <b>ladder</b> on a gel; necrotic DNA is degraded at random into a <b>smear</b>",
              "Phagocytes quietly eat the apoptotic bodies, so there is <b>no inflammation</b>; a necrotic cell's spilled contents are danger signals that call in neutrophils and cause <b>inflammation</b>"];
  function ellipse(cx, cy, rx, ry) { return "M " + (cx - rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx + rx) + " " + cy + " A " + rx + " " + ry + " 0 1 0 " + (cx - rx) + " " + cy + " Z"; }

  Viz.register("apoptosis-versus-necrosis", {
    title: "Apoptosis versus necrosis",
    subject: "biology",
    shows: "Step through two cell deaths side by side: apoptosis shrinks the cell and packages it into sealed bodies that are eaten quietly; necrosis swells it until it bursts and inflames the tissue",
    params: {},
    steps: ["the trigger", "shrink or swell", "the membrane", "the DNA", "the aftermath"],
    stepMs: 2000,
    formula: function (v) {
      var r = [["\\text{a signal}", "\\text{an injury}"], ["V\\downarrow\\text{, ATP used}", "V\\uparrow\\text{, ATP gone}"], ["\\text{sealed blebs}", "\\text{bursts}"],
               ["n\\times 180\\text{ bp}", "\\text{random smear}"], ["\\text{quiet}", "\\text{inflamed}"]][(v.step || 1) - 1];
      return "\\begin{array}{c|c}\\text{apoptosis}&\\text{necrosis}\\\\\\hline " + r[0] + "&" + r[1] + "\\end{array}";
    },
    status: function (v) { return TEXT[(v.step || 1) - 1] + "."; },
    examples: [
      {name: "the trigger", values: {step: 1}},
      {name: "shrink versus swell", values: {step: 2}},
      {name: "ladder versus smear", values: {step: 4}},
      {name: "quiet versus inflamed", values: {step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, A = [100, 96], N = [300, 96];   // cells centred under their column headings
      var L = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600, anchor: "middle"}, o || {})); };
      L([100, 14], "apoptosis", c.c1, {size: 13.5, weight: 750});
      L([300, 14], "necrosis", c.c5, {size: 13.5, weight: 750});
      api.line([200, 26], [200, 166], {color: c.grid, width: 1.5});
      var mito = function (x, y, rx, ry, op) {
        api.path(ellipse(x, y, rx, ry), {fill: c.c4, fillOpacity: 0.12, stroke: c.c4, width: 1.4, opacity: op || 1});
        api.line([x - rx * 0.6, y], [x + rx * 0.6, y], {color: c.c4, width: 1, dash: "2 2", opacity: op || 1});
      };
      var chromatin = function (x, y, r, op) {
        api.circle([x, y], r, {fill: c.c6, fillOpacity: 0.1, stroke: c.c6, width: 1.6, opacity: op});
        api.path("M " + (x - r * 0.6) + " " + (y - r * 0.2) + " q " + r * 0.3 + " " + (-r * 0.5) + " " + r * 0.6 + " 0 t " + r * 0.6 + " 0", {stroke: c.c6, width: 1.6, opacity: op});
        api.path("M " + (x - r * 0.5) + " " + (y + r * 0.35) + " q " + r * 0.25 + " " + (-r * 0.4) + " " + r * 0.5 + " 0 t " + r * 0.5 + " 0", {stroke: c.c6, width: 1.6, opacity: op});
      };
      var healthy = function (P) {
        api.path(ellipse(P[0], P[1], 46, 40), {fill: c.ink, fillOpacity: 0.05, stroke: c.ink, width: 2});
        chromatin(P[0] - 8, P[1] - 4, 17, 1); mito(P[0] + 22, P[1] + 18, 9, 4.5); mito(P[0] + 20, P[1] - 20, 8, 4);
      };
      // ---- apoptosis column ----
      if (s === 1) {
        healthy(A);   // the cause: a death ligand docks on its receptor in the membrane
        [-3.5, 3.5].forEach(function (d) { api.rect(A[0] + d - 2, A[1] - 50, 4, 18, {fill: c.muted, rx: 2}); });
        api.polygon([[A[0] - 10, A[1] - 64], [A[0] + 10, A[1] - 64], [A[0], A[1] - 51]], {fill: c.c1, fillOpacity: 0.95});
        L([A[0] + 16, A[1] - 58], "death ligand", c.c1, {anchor: "start"});
      }
      else if (s === 2) {
        api.path(ellipse(A[0], A[1], 34, 30), {fill: c.ink, fillOpacity: 0.12, stroke: c.c1, width: 2.2});
        api.circle([A[0] - 6, A[1] - 3], 11, {fill: c.c6, fillOpacity: 0.9});
        mito(A[0] + 16, A[1] + 13, 7, 3.5); mito(A[0] + 15, A[1] - 15, 6, 3);
        [[-1, 0], [1, 0]].forEach(function (d) { api.arrow([A[0] + d[0] * 56, A[1] + d[1] * 50], [A[0] + d[0] * 40, A[1] + d[1] * 35], {color: c.c1, width: 2, halo: false}); });
        L([A[0], A[1] + 62], "condensed chromatin", c.c6, {weight: 500});
      } else if (s === 3) {
        api.path(ellipse(A[0], A[1], 34, 30), {fill: c.ink, fillOpacity: 0.1, stroke: c.c1, width: 2.2});
        [[-0.3, -1], [0.7, -0.75], [1, 0.2], [0.4, 0.95], [-0.7, 0.75], [-1, -0.15]].forEach(function (q) { api.circle([A[0] + 34 * q[0], A[1] + 30 * q[1]], 7.5, {fill: c.card, stroke: c.c1, width: 1.8}); });
        [[-12, -6, 5.5], [-2, 4, 4.5], [-10, 8, 4]].forEach(function (q) { api.circle([A[0] + q[0], A[1] + q[1]], q[2], {fill: c.c6}); });
        mito(A[0] + 14, A[1] - 10, 6, 3);
        L([A[0], A[1] + 56], "blebs: membrane intact", c.c1, {weight: 500});
      } else {
        var eat = s === 5, k = eat ? 0.7 : 1;
        if (eat) {
          api.path("M " + (A[0] - 58) + " " + (A[1] + 10) + " C " + (A[0] - 60) + " " + (A[1] - 50) + " " + (A[0] + 40) + " " + (A[1] - 62) + " " + (A[0] + 52) + " " + (A[1] - 12) +
            " C " + (A[0] + 62) + " " + (A[1] + 34) + " " + (A[0] + 10) + " " + (A[1] + 56) + " " + (A[0] - 20) + " " + (A[1] + 46) + " C " + (A[0] - 46) + " " + (A[1] + 40) + " " + (A[0] - 56) + " " + (A[1] + 30) + " " + (A[0] - 58) + " " + (A[1] + 10) + " Z",
            {fill: c.muted, fillOpacity: 0.1, stroke: c.muted, width: 2});
          L([A[0], A[1] + 64], "eaten by a phagocyte", c.muted, {weight: 500});
        }
        [[-18, -14, 13, "n"], [17, -16, 11, "m"], [-14, 19, 11, "n"], [19, 15, 12, "n"]].forEach(function (q) {
          var x = A[0] + q[0] * k, y = A[1] + q[1] * k, r = q[2] * k;
          if (eat) api.circle([x, y], r + 3.5, {stroke: c.muted, width: 1, dash: "2 2"});
          api.circle([x, y], r, {fill: c.ink, fillOpacity: 0.06, stroke: c.c1, width: 1.8});
          if (q[3] === "n") api.circle([x - 1, y + 1], r * 0.42, {fill: c.c6}); else mito(x, y, r * 0.55, r * 0.3);
        });
        if (!eat) L([A[0], A[1] + 56], "sealed apoptotic bodies", c.c1, {weight: 500});
      }
      // ---- necrosis column ----
      if (s === 1) {
        healthy(N);   // the cause: an injury strikes and toxin crosses the membrane
        api.polygon([[N[0] + 51, N[1] - 66], [N[0] + 64, N[1] - 66], [N[0] + 53, N[1] - 48], [N[0] + 60, N[1] - 48], [N[0] + 36, N[1] - 22], [N[0] + 43, N[1] - 42], [N[0] + 37, N[1] - 42]],
          {fill: c.c5, fillOpacity: 0.95});
        L([N[0] + 58, N[1] - 78], "injury", c.c5);
        [[-76, -36], [-64, -30], [-68, -18], [-52, -22], [-42, -12]].forEach(function (q) { api.circle([N[0] + q[0], N[1] + q[1]], 2.6, {fill: c.c5}); });
        L([N[0] - 74, N[1] - 52], "toxin", c.c5);
      }
      else {
        var broken = s >= 3;
        if (s === 5) api.circle(N, 70, {fill: c.c5, fillOpacity: 0.1});
        api.path(ellipse(N[0], N[1], 56, 50), {fill: c.ink, fillOpacity: 0.025, stroke: c.c5, width: 2, dash: broken ? "26 14" : null, opacity: s === 5 ? 0.6 : 1});
        chromatin(N[0] - 10, N[1] - 6, 18, broken ? 0.35 : 0.75);
        mito(N[0] + 26, N[1] + 20, 12, 9, broken ? 0.6 : 1); mito(N[0] + 22, N[1] - 22, 11, 8.5, broken ? 0.6 : 1);
        if (s === 2) {
          [[-1, 0], [1, 0]].forEach(function (d) { api.arrow([N[0] + d[0] * 82, N[1] + d[1] * 72], [N[0] + d[0] * 62, N[1] + d[1] * 55], {color: c.c2, width: 2, halo: false}); });
          [-72, 72].forEach(function (dx) { L([N[0] + dx, N[1] - 14], "H₂O", c.c2, {weight: 650}); });   // above each arrow, clear of the outline
          L([N[0], N[1] + 68], "swollen mitochondria", c.c4, {weight: 500});
        } else {
          var spill = s === 3 ? [[66, -10], [72, 8], [-62, 24], [-70, 10], [40, 52], [30, -58]] : [[66, -10], [80, 8], [-62, 24], [-78, 6], [44, 54], [30, -60], [48, -62], [84, 30], [-74, -22], [84, -24]];
          spill.forEach(function (q) { api.circle([N[0] + q[0], N[1] + q[1]], 3, {fill: c.c3}); });
          if (s === 3) L([N[0], N[1] + 68], "bursts, contents spill", c.c3, {weight: 500});
          if (s === 4) L([N[0], N[1] + 68], "nucleus fades", c.c6, {weight: 500});
          if (s === 5) {
            [[-62, -34], [-60, 40], [66, -36], [64, 42]].forEach(function (q) {   // kept inside the column, off the divider
              var x = N[0] + q[0], y = N[1] + q[1];
              api.circle([x, y], 11, {fill: c.card, stroke: c.ink, width: 1.6});
              [[-4, -2], [0, 3], [4, -2]].forEach(function (d) { api.circle([x + d[0], y + d[1]], 2.8, {fill: c.c6}); });
            });
            L([N[0] - 30, N[1] - 66], "neutrophils", c.ink, {weight: 600});
            L([N[0], N[1] + 68], "inflamed tissue", c.c5, {weight: 650});
          }
        }
      }
      // ---- the comparison table: every row heading from the start, faint until its step fills the pair in ----
      for (var i = 0; i < ROWS.length; i++) {
        var y0 = 190 + i * 22, now = i === s - 1;
        L([200, y0], ROWS[i][0], i < s ? c.muted : c.faint, {weight: 500});
        if (i >= s) continue;
        if (i === 3) {   // the DNA row is a gel: wells at the left, small fragments run farthest right
          var gx = function (x0, bp) { return x0 + 100 * (Math.log(1500) - Math.log(bp)) / (Math.log(1500) - Math.log(150)); };
          [[24, c.c1, "ladder"], [228, c.c5, "smear"]].forEach(function (g) {
            api.rect(g[0] - 6, y0 - 7, 112, 14, {fill: c.ink, fillOpacity: 0.04, stroke: c.faint, width: 1, rx: 3});
            api.rect(g[0] - 4, y0 - 5, 3, 10, {fill: c.muted, rx: 1});
            if (g[2] === "ladder") for (var n = 1; n <= 8; n++) api.rect(gx(g[0], 180 * n) - 1.2, y0 - 5, 2.4, 10, {fill: g[1], rx: 1, opacity: Math.max(0.35, 1 - n * 0.08)});
            else for (var x = g[0]; x < g[0] + 100; x += 4) api.rect(x, y0 - 5, 4, 10, {fill: g[1], rx: 0, opacity: 0.12 + 0.55 * (x - g[0]) / 100});
            L([g[0] + 112, y0], g[2], g[1], {anchor: "start", weight: now ? 700 : 500, opacity: now ? 1 : 0.7});
          });
          continue;
        }
        L([100, y0], ROWS[i][1], c.c1, {weight: now ? 700 : 500, opacity: now ? 1 : 0.7});
        L([300, y0], ROWS[i][2], c.c5, {weight: now ? 700 : 500, opacity: now ? 1 : 0.7});
      }
      api.line([20, 178], [380, 178], {color: c.grid, width: 1.5});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
