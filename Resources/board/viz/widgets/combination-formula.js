// Choosing r of n items without regard to order. Ordered picks fill r slots: n choices, then n − 1, ... down to
// n − r + 1, so n!/(n − r)! sequences. Each unordered group appears in exactly r! of those sequences (its r! orders),
// so the number of groups is n!/(r!(n − r)!). The middle band shows that division: the first few groups each drawn as
// the column of their r! orders, braced into one group tile. The bottom lays out every group as a tile in
// lexicographic order (past 35 groups only those that contain A, with the rest counted in a note), so the count can
// be checked by eye; the first group (the teal items) is teal throughout.
(function () {
  var L = "ABCDEFGH";
  function fact(k) { var x = 1; for (var i = 2; i <= k; i++) x *= i; return x; }
  function groups(n, r) {
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
  function orders(word) { // every ordering of the letters, lexicographic
    if (word.length <= 1) return [word];
    var out = [];
    for (var i = 0; i < word.length; i++) orders(word.slice(0, i) + word.slice(i + 1)).forEach(function (t) { out.push(word[i] + t); });
    return out;
  }
  function calc(v) {
    var ordered = 1, falling = [];
    for (var i = 0; i < v.r; i++) { ordered *= v.n - i; falling.push(v.n - i); }
    return {ordered: ordered, falling: falling, rf: fact(v.r), count: ordered / fact(v.r), list: groups(v.n, v.r)};
  }
  var big = function (x) { return x.toLocaleString("en-US"); };

  Viz.register("combination-formula", {
    title: "Combinations: choosing r of n",
    subject: "stats",
    shows: "Pick r of n items: count the ordered picks slot by slot, then divide by r! because every group shows up in r! orders",
    params: {
      n: {kind: "integer", default: 6, min: 4, max: 8, label: "n"},
      r: {kind: "integer", default: 3, min: 2, max: 4, label: "r"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\binom{n}{r}=\\frac{n!}{r!\\,(n-r)!}=\\frac{" + k.falling.join("\\cdot") + "}{" + v.r + "!}=\\frac{" + big(k.ordered).replace(/,/g, "{,}") + "}{" + k.rf + "}=" + k.count;
    },
    status: function (v) {
      var k = calc(v);
      if (v.r === v.n) return "Choosing all " + v.n + " of " + v.n + " leaves nothing to decide: exactly <b>1</b> group, even though it can be ordered " + k.rf + " ways.";
      return "There are <b>" + big(k.ordered) + "</b> ordered ways to pick " + v.r + " of " + v.n + ", but each group of " + v.r + " shows up in " + v.r +
        "! = " + k.rf + " orders, so there are <b>" + k.count + "</b> groups.";
    },
    examples: [
      {name: "Minimum supported values", values: {n: 4, r: 2}},
      {name: "Maximum supported values", values: {n: 8, r: 4}},
      {name: "choose all four", values: {n: 4, r: 4}},
      {name: "pairs from eight", values: {n: 8, r: 2}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, k = calc(v), sx = 18, W = 364;
      var ww = function (len) { return len * 8.6; };  // rendered width of a word of capitals at 12 px
      function tile(x, y, g, first, h) {  // one unordered group: a rounded box, teal for the first group
        var w = ww(g.length) + 8; h = h || 20;
        api.rect(x, y - h / 2, w, h, {fill: first ? c.c1 : "none", fillOpacity: first ? 0.85 : null, stroke: first ? c.c1 : c.muted, width: 1.2, rx: 4});
        api.label([x + w / 2, y], g, {color: first ? c.card : c.ink, size: 12, weight: first ? 700 : 600, anchor: "middle", clamp: false});
      }
      // the n items; the first group is teal
      var pitch = 34, x0 = 200 - (v.n - 1) * pitch / 2;
      for (var i = 0; i < v.n; i++) {
        var on = i < v.r, at = [x0 + i * pitch, 17];
        api.circle(at, 11, {fill: on ? c.c1 : "none", fillOpacity: on ? 0.85 : null, stroke: on ? c.c1 : c.muted, width: 1.4});
        api.label(at, L[i], {color: on ? c.card : c.ink, size: 13, weight: 700, anchor: "middle", clamp: false});
      }
      // ordered picks, slot by slot
      var sy = 36;
      api.label([sx, sy + 12], "ordered", {color: c.c2, size: 12.5, weight: 650});
      var bx = sx + 64;
      k.falling.forEach(function (m, j) {
        if (j) api.label([bx - 8, sy + 12], "×", {color: c.c2, size: 13, anchor: "middle"});
        api.rect(bx, sy, 30, 24, {fill: c.c2, fillOpacity: 0.14, stroke: c.c2, width: 1.3, rx: 5});
        api.label([bx + 15, sy + 12], String(m), {color: c.c2, size: 13, weight: 700, anchor: "middle"});
        bx += 46;
      });
      api.label([bx - 8, sy + 12], "= " + big(k.ordered) + " sequences", {color: c.c2, size: 12.5, weight: 650});
      // ÷ r!: the first few groups, each as the column of its r! orders (24 orders show as 5 and ⋮), braced into one tile
      api.label([sx, 74], "÷ " + v.r + "! = " + k.rf, {color: c.c3, size: 12.5, weight: 700});
      api.label([sx + 70, 74], "each group shows up " + k.rf + " times: count it once", {color: c.c3, size: 12});
      var ws = ww(v.r), blk = 2 * ws + 24, nc = Math.min(k.count, v.r === 4 ? 3 : 4), more = k.count > nc, mid = 124;
      var gap = Math.max(8, Math.min(40, (W - nc * blk - (more ? 16 : 0)) / Math.max(1, nc - (more ? 0 : 1))));
      for (var b = 0; b < nc; b++) {
        var ords = orders(k.list[b]), shown = ords.length > 6 ? ords.slice(0, 5).concat(["⋮"]) : ords;
        var bl = sx + b * (blk + gap), y0 = mid - (shown.length - 1) * 6.5, top = y0 - 7, bot = y0 + (shown.length - 1) * 13 + 7;
        shown.forEach(function (o, j) { api.label([bl + ws / 2, y0 + j * 13], o, {color: c.c3, size: 12, anchor: "middle", clamp: false}); });
        var x = bl + ws + 4, q = Math.min(6, (bot - top) / 4), h = 3.5;  // a right brace from top to bot, tip at mid
        api.path("M " + x + " " + top + " Q " + (x + h) + " " + top + " " + (x + h) + " " + (top + q) + " L " + (x + h) + " " + (mid - q) +
          " Q " + (x + h) + " " + mid + " " + (x + 2 * h) + " " + mid + " Q " + (x + h) + " " + mid + " " + (x + h) + " " + (mid + q) +
          " L " + (x + h) + " " + (bot - q) + " Q " + (x + h) + " " + bot + " " + x + " " + bot, {stroke: c.c3, width: 1.4});
        tile(bl + ws + 16, mid, k.list[b], b === 0);
      }
      if (more) api.label([sx + nc * blk + (nc - 1) * gap + 8, mid], "…", {color: c.muted, size: 14, weight: 700});
      // every group as a tile; past 35 groups only those containing A are drawn and the rest are counted
      api.line([sx, 170], [api.w - sx, 170], {color: c.grid, width: 1});
      api.label([sx, 183], "= " + k.count + " group" + (k.count > 1 ? "s" : ""), {color: c.ink, size: 13, weight: 700});
      var withA = k.count > 35 ? Math.round(fact(v.n - 1) / (fact(v.r - 1) * fact(v.n - v.r))) : k.count, list = k.list.slice(0, withA);
      var tw = ww(v.r) + 8, maxCols = Math.max(1, Math.floor((W - tw) / (tw + 8)) + 1);
      var rows = Math.max(Math.ceil(list.length / maxCols), Math.min(4, Math.ceil(list.length / 5))), cols = Math.ceil(list.length / rows);
      rows = Math.ceil(list.length / cols);
      var cp = cols > 1 ? Math.min(72, (W - tw) / (cols - 1)) : 0, rp = rows > 1 ? Math.min(28, ((withA < k.count ? 300 : 320) - 205) / (rows - 1)) : 0;
      list.forEach(function (g, j) { tile(sx + (j % cols) * cp, 205 + Math.floor(j / cols) * rp, g, j === 0, rp ? Math.min(20, rp - 4) : 20); });
      if (withA < k.count) api.label([sx, 205 + (rows - 1) * rp + 24], "… and " + (k.count - withA) + " more without A: " + k.count + " groups in all",
        {color: c.muted, size: 12});
    }
  });
})();
