// Permutations against combinations, as one table. Every column is one group of r items chosen from n (a
// combination: its tile on top), and under it are the r! orders those same items can come in (permutations). So the
// table holds P(n, r) = n!/(n - r)! cells in C(n, r) = P(n, r)/r! columns. The toggle asks the real question, does
// order matter: when it does (president, VP, treasurer), every cell is its own outcome and the cells light blue; when
// it doesn't (a committee), each column collapses into its one group and the columns light amber.
// The queue gives no parameters; n runs 3 to 6 and r 1 to 3 so all P(n, r) cells (at most 120) can be drawn and read.
(function () {
  var L = "ABCDEF";
  function fact(k) { var x = 1; for (var i = 2; i <= k; i++) x *= i; return x; }
  function groups(n, r) { // every r-subset of the first n letters, lexicographic
    var out = [], idx = [];
    for (var i = 0; i < r; i++) idx.push(i);
    for (;;) {
      out.push(idx.map(function (j) { return L[j]; }).join(""));
      var k = r - 1;
      while (k >= 0 && idx[k] === n - r + k) k--;
      if (k < 0) return out;
      idx[k]++;
      for (var j = k + 1; j < r; j++) idx[j] = idx[j - 1] + 1;
    }
  }
  function orders(w) { // every ordering of a word's letters, lexicographic
    if (w.length <= 1) return [w];
    var out = [];
    for (var i = 0; i < w.length; i++) orders(w.slice(0, i) + w.slice(i + 1)).forEach(function (t) { out.push(w[i] + t); });
    return out;
  }
  function calc(v) { var P = fact(v.n) / fact(v.n - v.r); return {P: P, rf: fact(v.r), C: P / fact(v.r), list: groups(v.n, v.r)}; }
  var roles = ["", "a chair", "a president and a VP", "a president, VP and treasurer"];
  var sets = ["", "one member", "a pair", "a committee of 3"];

  Viz.register("permutations-vs-combinations", {
    title: "Permutations vs combinations",
    subject: "stats",
    shows: "Toggle whether order matters: each column is one group of r, and its r! orders are the cells under it, so permutations = combinations × r!",
    params: {
      n: {kind: "integer", default: 5, min: 3, max: 6, label: "n"},
      r: {kind: "integer", default: 3, min: 1, max: 3, label: "r"},
      order: {kind: "boolean", default: true, label: "order", on: "matters", off: "doesn't matter"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}P(" + v.n + "," + v.r + ")=\\dfrac{" + v.n + "!}{" + (v.n - v.r) + "!}=" + k.P + "\\\\[10pt]" +
        "C(" + v.n + "," + v.r + ")=\\dfrac{P(" + v.n + "," + v.r + ")}{" + v.r + "!}=\\dfrac{" + k.P + "}{" + k.rf + "}=" + k.C + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (v.r === 1) return "With r = 1 a single pick has no order to it, so both counts are <b>" + k.P + "</b>.";
      if (v.order) return "Order matters (" + roles[v.r] + " from " + v.n + " people): <b>" + k.P + "</b> outcomes, because each group of " + v.r +
        " can be ordered " + v.r + "! = " + k.rf + " ways.";
      if (k.C === 1) return "Order doesn't matter (" + sets[v.r] + " from " + v.n + " people): only <b>1</b> group, since everyone is in it; its " + k.rf + " orders are the same group.";
      return "Order doesn't matter (" + sets[v.r] + " from " + v.n + " people): only <b>" + k.C + "</b> outcomes, because the " + k.rf + " orders of a group are the same group.";
    },
    examples: [
      {name: "Minimum supported values", values: {n: 3, r: 1, order: true}},
      {name: "Maximum supported values", values: {n: 6, r: 3, order: false}},
      {name: "pairs from four, order ignored", values: {n: 4, r: 2, order: false}},
      {name: "three from three: one group, six orders", values: {n: 3, r: 3, order: false}}
    ],
    size: [400, 330],
    draw: function (api, v) {
      var c = api.color, k = calc(v), on = v.order;
      // the n items
      var pitch0 = 30, ix = 200 - (v.n - 1) * pitch0 / 2;
      for (var i = 0; i < v.n; i++) {
        api.circle([ix + i * pitch0, 16], 11, {stroke: c.muted, width: 1.4});
        api.label([ix + i * pitch0, 16], L[i], {color: c.ink, size: 12.5, weight: 700, anchor: "middle", clamp: false});
      }
      api.label([ix - 20, 16], v.n + " items", {color: c.muted, size: 12, anchor: "end"});
      api.label([200, 40], v.r === 1 ? "each column: one item, and only 1! = 1 way to order it" :
        "each column: one group of " + v.r + " on top, its " + v.r + "! = " + k.rf + " orders below", {color: c.muted, size: 12, anchor: "middle"});
      // the table: one column per group, its orders under it. Tiles are sized from the room there is: as wide as the
      // column pitch allows (up to 64), rows as tall as the span allows (up to 30 for six orders, more for one or two),
      // and the letters grow to 16 px when the cells are big, so a small case fills the panel instead of sitting in it.
      var tmin = v.r * 8 + 8, perBand = Math.floor(368 / (tmin + 4)), bands = Math.ceil(k.C / perBand), cols = Math.ceil(k.C / bands);
      var pitch = Math.min(84, 368 / cols), tw = Math.max(tmin, Math.min(64, 0.8 * pitch));
      var y0 = 56, y1 = 294, gapB = 14, span = (y1 - y0 - (bands - 1) * gapB) / bands;
      var hh = bands > 1 ? (k.rf >= 6 ? 19 : 26) : k.rf === 1 ? 52 : 32, cap = k.rf >= 6 ? 30 : k.rf === 2 ? 56 : 84;
      var rowH = Math.min(cap, (span - hh - 6) / k.rf), bandH = hh + 6 + k.rf * rowH;
      var fs = Math.min(16, Math.max(12, Math.min(rowH * 0.55, (tw - 10) / (v.r * 0.72))));
      var hfs = Math.min(16, Math.max(12, Math.min(hh * 0.55, (tw - 10) / (v.r * 0.72))));
      var cellH = Math.max(12, Math.min(rowH - (rowH > 24 ? 6 : 2), k.rf === 1 ? 68 : 44));
      var pad = Math.max(1, Math.min(3, (pitch - tw) / 2 - 1)), inset = tw - 4 > v.r * fs * 0.72 + 4 ? 2 : 1;
      var top = y0 + (y1 - y0 - (bands * bandH + (bands - 1) * gapB)) / 2;
      k.list.forEach(function (g, j) {
        var b = Math.floor(j / cols), col = j % cols, inBand = Math.min(cols, k.C - b * cols);
        var cx = 200 + (col - (inBand - 1) / 2) * pitch, y = top + b * (bandH + gapB);
        var bottom = y + bandH;
        if (!on) api.rect(cx - tw / 2 - pad, y - pad, tw + 2 * pad, bottom - y + 2 * pad - 1, {fill: c.c3, fillOpacity: 0.08, stroke: c.c3, width: 1.3, rx: 6});
        api.rect(cx - tw / 2, y, tw, hh, {fill: on ? "none" : c.c3, fillOpacity: on ? null : 0.9, stroke: on ? c.faint : c.c3, width: 1.2, rx: Math.min(10, hh / 2)});
        api.label([cx, y + hh / 2 + 0.5], g, {color: on ? c.muted : c.card, size: hfs, weight: 700, anchor: "middle", clamp: false});
        orders(g).forEach(function (o, q) {
          var oy = y + hh + 6 + q * rowH + rowH / 2;
          if (on) api.rect(cx - tw / 2 + inset, oy - cellH / 2, tw - 2 * inset, cellH, {fill: c.c2, fillOpacity: 0.16, stroke: c.c2, width: 0.8, rx: Math.min(6, cellH / 4)});
          api.label([cx, oy + 0.5], o, {color: on ? c.c2 : c.muted, size: fs, weight: on ? 650 : 500, anchor: "middle", clamp: false});
        });
      });
      // the count that answers the question, as the product the table is built from
      var yb = api.h - 14, gw = k.C === 1 ? " group" : " groups";
      api.line([18, yb - 16], [api.w - 18, yb - 16], {color: c.grid, width: 1});
      if (v.r === 1) api.label([200, yb], k.C + " groups × 1! = " + k.P + " picks either way: one item has one order", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      else if (on) api.label([200, yb], k.C + gw + " × " + v.r + "! orders = " + k.C + " × " + k.rf + " = " + k.P + " cells, all different", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      else api.label([200, yb], k.P + " cells ÷ " + v.r + "! = " + k.P + " ÷ " + k.rf + " = " + k.C + gw + ", order ignored",
        {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
