// Clonal selection: every naive lymphocyte carries one receptor shape, made by random gene rearrangement, so any one
// specificity is rare (about 1 in 10^5 to 10^6 naive T cells for a given epitope). The antigen binds only the cell
// whose receptor fits; that cell is activated and divides n times into a clone of 2^n identical cells, most of which
// become short-lived effectors (about 90-95% die once the antigen is gone) while 5-10% stay as memory cells.
// Below: the clone's share of all lymphocytes, 2^n / (10^k - 1 + 2^n), assuming no other cell divides meanwhile.
(function () {
  var POOL = ["diamond", "triangle", "hexagon", "star", "square", "cross", "circle", "pentagon"];
  var big = function (x) { return Math.round(x).toLocaleString("en-US"); };
  function share(v) { var N = Math.pow(2, v.n); return N / (Math.pow(10, v.k) - 1 + N); }
  function sup(t) { return String(t).split("").map(function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]; }).join(""); }
  function pctText(f) { return f >= 0.01 ? (f * 100).toFixed(1) + "%" : "1 in " + big(1 / f); }

  Viz.register("antigen-specific-clonal-selection-and-expansion", {
    title: "Clonal selection and expansion",
    subject: "biology",
    shows: "Pick an antigen and step through: out of a pool of lymphocytes with different receptors only the matching one is selected, it divides into a clone, and the clone splits into effector and memory cells",
    params: {
      antigen: {kind: "enum", values: ["triangle", "square", "circle", "star"], default: "triangle", label: "\\text{antigen}"},
      n: {kind: "integer", default: 12, min: 0, max: 16, label: "n"},
      k: {kind: "integer", default: 5, min: 3, max: 6, label: "k"}
    },
    steps: ["a diverse pool of naive cells", "antigen selects its match", "the clone divides", "effector and memory cells"],
    stepMs: 1800,
    formula: function (v) {
      var N = Math.pow(2, v.n), f = share(v);
      return "N=2^{" + v.n + "}=" + big(N).replace(/,/g, "{,}") + "\\newline \\text{share}=\\frac{2^{" + v.n + "}}{10^{" + v.k + "}-1+2^{" + v.n + "}}=" +
        (f >= 0.01 ? (f * 100).toFixed(1) + "\\%" : "1/" + big(1 / f).replace(/,/g, "{,}"));
    },
    status: function (v) {
      var s = v.step || 1, N = Math.pow(2, v.n), f = share(v), rare = "1 in " + big(Math.pow(10, v.k));
      return ["Each naive lymphocyte carries one receptor shape made by random gene rearrangement, so any one shape is rare: here " + rare + " cells",
              "Only the cell whose receptor fits the " + v.antigen + " antigen binds it and is activated; every other cell is left alone",
              "The selected cell divides " + v.n + " time" + (v.n === 1 ? "" : "s") + " into a clone of <b>" + big(N) + "</b>" + (N === 1 ? " cell" : " identical cells") + ", so its receptor goes from " + rare + " to <b>" + pctText(f) + "</b> of lymphocytes",
              "Most of the clone become effector cells that fight now and mostly die once the antigen is gone; the 5 to 10% that survive are <b>memory cells</b>, " + big(Math.max(1, Math.round(N * 0.07))) + " here, ready for a faster second response"][s - 1] + ".";
    },
    examples: [
      {name: "the pool, no divisions", values: {antigen: "square", n: 0, k: 3, step: 1}},
      {name: "selection", values: {antigen: "star", n: 12, k: 5, step: 2}},
      {name: "sixteen divisions from 1 in a million", values: {antigen: "circle", n: 16, k: 6, step: 3}},
      {name: "memory", values: {antigen: "triangle", n: 14, k: 5, step: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1;
      var shape = function (kind, C, r, o) {   // the receptor (outline) or antigen (filled) shape, centred on C
        if (kind === "circle") return api.circle(C, r * 0.85, o);
        var n = {triangle: 3, square: 4, diamond: 4, pentagon: 5, hexagon: 6, star: 10, cross: 12}[kind], pts = [];
        for (var i = 0; i < n; i++) {
          var a = -Math.PI / 2 + 2 * Math.PI * i / n + (kind === "square" ? Math.PI / 4 : 0), rr = kind === "star" && i % 2 ? r * 0.45 : r;
          if (kind === "cross") { var q = [[-1, -3], [1, -3], [1, -1], [3, -1], [3, 1], [1, 1], [1, 3], [-1, 3], [-1, 1], [-3, 1], [-3, -1], [-1, -1]][i]; pts.push([C[0] + q[0] * r / 3, C[1] + q[1] * r / 3]); }
          else pts.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]);
        }
        return api.polygon(pts, Object.assign({fillOpacity: o.fill ? 1 : 0}, o));
      };
      var cell = function (C, r, kind, col, op, bound) {
        var g = api.group({opacity: op});
        api.circle(C, r, {stroke: col, width: bound ? 3.4 : 2, fill: col, fillOpacity: bound ? 0.16 : 0.08, parent: g});
        api.line([C[0], C[1] - r], [C[0], C[1] - r - 6], {color: col, width: 2, parent: g});
        shape(kind, [C[0], C[1] - r - 15], 9, {stroke: col, width: 2, parent: g});
        if (bound) shape(kind, [C[0], C[1] - r - 15], 6.5, {fill: c.c5, parent: g});
      };
      if (s <= 2) {
        POOL.forEach(function (kind, i) {
          // the matched cell keeps its size (so its receptor stays clear of the title) and is marked by colour and stroke
          var C = [44 + (i % 4) * 78, 70 + Math.floor(i / 4) * 84], match = kind === v.antigen;
          cell(C, 20, kind, s === 2 && match ? c.c1 : c.muted, s === 2 && !match ? 0.35 : 1, s === 2 && match);
        });
        if (s === 1) {
          shape(v.antigen, [372, 100], 9, {fill: c.c5});
          api.label([372, 124], "antigen", {color: c.c5, size: 12, anchor: "middle"});
          api.label([170, 16], "8 receptor shapes out of millions", {color: c.muted, size: 12, anchor: "middle"});
        } else api.label([170, 16], "only the matching cell binds and is activated", {color: c.c1, size: 12, anchor: "middle"});
      } else if (s === 3) {
        // draw the first generations of the tree, never more than the n divisions that actually happen
        var xs = [40, 108, 176, 244], rads = [15, 12, 9, 6], gap = [0, 72, 36, 18], tree = [];
        [1, 2, 4, 8].slice(0, Math.min(v.n, 3) + 1).forEach(function (g, gi) { var cur = []; for (var j = 0; j < g; j++) cur.push([xs[gi], 96 + (j - (g - 1) / 2) * gap[gi]]); tree.push(cur); });
        tree.forEach(function (cur, gi) { if (gi) cur.forEach(function (q, j) { api.line(tree[gi - 1][Math.floor(j / 2)], q, {color: c.faint, width: 1.2}); }); });
        tree.forEach(function (cur, gi) { cur.forEach(function (q) { api.circle(q, rads[gi], {stroke: c.c1, width: 1.8, fill: c.card}); shape(v.antigen, q, rads[gi] * 0.45, {stroke: c.c1, width: 1.2}); }); });
        api.label([318, 96], (v.n > 3 ? "… " : "") + "2" + sup(v.n), {color: c.c1, size: 15, weight: 650, anchor: "middle", raw: true});
        api.label([318, 118], big(Math.pow(2, v.n)) + (v.n ? " cells" : " cell"), {color: c.c1, size: 12, anchor: "middle"});
        api.label([170, 16], "every daughter carries the same receptor", {color: c.c1, size: 12, anchor: "middle"});
      } else {
        // 2 of 28 cells = 7%, the memory fraction the status uses; every cell keeps the clone's teal receptor
        for (var i = 0; i < 28; i++) {
          var C = [31 + (i % 14) * 26, 70 + Math.floor(i / 14) * 58], mem = i === 4 || i === 23;
          api.line([C[0], C[1] - 10], [C[0], C[1] - 14], {color: c.c1, width: 1.6});
          shape(v.antigen, [C[0], C[1] - 19], 5, {stroke: c.c1, width: 1.6});
          api.circle(C, 10, {stroke: mem ? c.c4 : c.c3, width: mem ? 2.6 : 1.6, fill: mem ? c.c4 : c.c3, fillOpacity: mem ? 0.25 : 0.1, opacity: mem ? 1 : 0.6});
          if (!mem) { api.line([C[0] - 4, C[1] - 4], [C[0] + 4, C[1] + 4], {color: c.c3, width: 1.4, opacity: 0.65}); api.line([C[0] - 4, C[1] + 4], [C[0] + 4, C[1] - 4], {color: c.c3, width: 1.4, opacity: 0.65}); }
        }
        api.label([12, 16], "effectors: fight, then most die", {color: c.c3, size: 12.5, weight: 650});
        api.label([388, 16], "memory: 5–10% stay", {color: c.c4, size: 12.5, weight: 650, anchor: "end"});
        api.label([200, 158], "2 of 28 drawn as memory (7%), all with the same receptor", {color: c.muted, size: 12, anchor: "middle"});
      }
      api.line([12, 178], [api.w - 12, 178], {color: c.grid, width: 1});
      // the clone's share of all lymphocytes, on a log axis
      var f = share(v), f0 = Math.pow(10, -v.k), X = function (p) { return 40 + (Math.log10(p) + 6) * 330 / 6; };
      api.label([12, 196], "share of lymphocytes with this receptor (log scale)", {color: c.muted, size: 12});
      api.label([12, 216], "before: 1 in " + big(1 / f0), {color: c.muted, size: 12.5, weight: 600});
      // the clone has not divided on steps 1-2: show only where it starts, and reveal the expansion from step 3
      var grown = s >= 3;
      if (grown) api.label([12, 234], "after 2" + sup(v.n) + " = " + big(Math.pow(2, v.n)) + (v.n ? " cells: " : " cell: ") + pctText(f), {color: c.c1, size: 12.5, weight: 650, raw: true});
      else api.label([12, 234], "divisions so far: 0 of " + v.n, {color: c.muted, size: 12.5});
      api.line([X(1e-6), 258], [X(1), 258], {color: c.axis, width: 1.2});
      [[1e-6, "10⁻⁶"], [1e-4, "10⁻⁴"], [1e-2, "1%"], [1, "100%"]].forEach(function (t) {
        api.line([X(t[0]), 254], [X(t[0]), 262], {color: c.axis, width: 1.2});
        api.label([X(t[0]), 280], t[1], {color: c.muted, size: 12, anchor: "middle", raw: true});
      });
      if (grown) api.rect(X(f0), 252, Math.max(0, X(f) - X(f0)), 12, {fill: c.c1, fillOpacity: 0.25, rx: 3});
      api.line([X(f0), 246], [X(f0), 270], {color: c.muted, width: 2.5});
      if (grown) api.line([X(f), 246], [X(f), 270], {color: c.c1, width: 3});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
