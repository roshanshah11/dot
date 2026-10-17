// Permutations: ordered picks of r from n. Bottom: r places filled one after another; the first has all n items to
// choose from, each later place one fewer, because an item used in an earlier place (struck out) cannot be used
// again. One example run is traced in amber. Top: n! written out as factors; the first r factors are exactly those
// choice counts (blue, the same numbers as the places), and the last n - r factors make (n - r)!, which the
// denominator cancels. So P(n, r) = n!/(n - r)! = n(n - 1)...(n - r + 1).
(function () {
  var L = "ABCDEFGH", ORD = ["1st", "2nd", "3rd", "4th"];
  function fact(k) { var x = 1; for (var i = 2; i <= k; i++) x *= i; return x; }
  function calc(v) {
    var f = []; for (var i = 0; i < v.r; i++) f.push(v.n - i);
    return {f: f, P: fact(v.n) / fact(v.n - v.r), pick: [2, 0, v.n - 1, 1].slice(0, v.r)};
  }

  Viz.register("permutation-formula", {
    title: "Permutation formula",
    subject: "stats",
    shows: "Fill r places in order from n items: n choices, then n − 1, and so on, which is n! with the last (n − r)! factors cancelled",
    params: {
      n: {kind: "integer", default: 6, min: 4, max: 8, label: "n"},
      r: {kind: "integer", default: 3, min: 2, max: 4, label: "r"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}P(n,r)=\\dfrac{n!}{(n-r)!}=\\dfrac{" + v.n + "!}{" + (v.n - v.r) + "!}\\\\[10pt]\\qquad\\ \\ =" + k.f.join("\\cdot") + "=" +
        k.P.toLocaleString("en-US").replace(/,/g, "{,}") + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (v.r === v.n) return "Ordering all " + v.n + " items: " + k.f.join(" × ") + " = <b>" + k.P + "</b>, and (n\u00a0−\u00a0r)! = 0! = 1 cancels nothing.";
      return "Fill " + v.r + " ordered places from " + v.n + ": " + k.f.join(", then ") + " choices, so <b>" + k.P.toLocaleString("en-US") + "</b> arrangements; the " +
        (v.n - v.r) + "! orders of the unused items cancel out of " + v.n + "!.";
    },
    examples: [
      {name: "Minimum supported values", values: {n: 4, r: 2}},
      {name: "Maximum supported values", values: {n: 8, r: 4}},
      {name: "all four of four", values: {n: 4, r: 4}},
      {name: "podium from eight runners", values: {n: 8, r: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), n = v.n, r = v.r;
      // ---- n! as factors, the tail (n - r)! cancelled
      var tw = 30, tp = 38, tx0 = 62, ty = 14;
      api.label([18, ty + 12], n + "! =", {color: c.ink, size: 13, weight: 650});
      for (var i = 0; i < n; i++) {
        var keep = i < r, x = tx0 + i * tp;
        if (i) api.label([x - 4, ty + 12], "·", {color: c.muted, size: 14, anchor: "middle"});
        api.rect(x, ty, tw, 24, {fill: keep ? c.c2 : "none", fillOpacity: keep ? 0.2 : null, stroke: keep ? c.c2 : c.faint, width: 1.3, rx: 5});
        api.label([x + tw / 2, ty + 12], String(n - i), {color: keep ? c.c2 : c.muted, size: 13, weight: 700, anchor: "middle"});
        if (!keep) api.line([x + 3, ty + 21], [x + tw - 3, ty + 3], {color: c.c5, width: 1.6});
      }
      // bracket labels sit flush left on their brackets; when the kept label would run into the cancelled one (short
      // groups, e.g. 4 of which 2 are kept), the cancelled label takes a second row so the two never touch
      var bl = tx0, br = tx0 + (r - 1) * tp + tw, by = ty + 32, keptTxt = "kept: " + r + " factor" + (r > 1 ? "s" : "");
      api.path("M " + bl + " " + (by - 4) + " L " + bl + " " + by + " L " + br + " " + by + " L " + br + " " + (by - 4), {stroke: c.c2, width: 1.5});
      api.label([bl, by + 12], keptTxt, {color: c.c2, size: 12, weight: 650, anchor: "start"});
      if (r < n) {
        var cl = tx0 + r * tp, cr = tx0 + (n - 1) * tp + tw, row2 = bl + keptTxt.length * 12 * 0.5 + 10 > cl;
        api.path("M " + cl + " " + (by - 4) + " L " + cl + " " + by + " L " + cr + " " + by + " L " + cr + " " + (by - 4), {stroke: c.c5, width: 1.5});
        api.label([cl, by + (row2 ? 28 : 12)], "(n − r)! = " + (n - r) + "! cancels", {color: c.c5, size: 12, weight: 650, anchor: "start"});
      } else {
        api.label([tx0 + n * tp, ty + 12], "÷ 0! = 1", {color: c.c5, size: 12, weight: 650});
      }
      // ---- the r places, filled in order
      var pw = 360 / r, py = 94;
      for (var s = 0; s < r; s++) {
        var cx = 20 + pw * (s + 0.5);
        if (s) api.label([20 + pw * s, py + 26], "×", {color: c.c2, size: 15, weight: 700, anchor: "middle"});
        api.label([cx, py], ORD[s] + " place", {color: c.muted, size: 12, anchor: "middle"});
        api.rect(cx - 24, py + 12, 48, 28, {fill: c.c2, fillOpacity: 0.2, stroke: c.c2, width: 1.4, rx: 6});
        api.label([cx, py + 26], String(k.f[s]), {color: c.c2, size: 16, weight: 750, anchor: "middle"});
        api.label([cx, py + 52], k.f[s] + " to choose", {color: c.c2, size: 12, anchor: "middle"});
        // the items as this place sees them: used earlier (struck), picked here (amber), still free
        var rowH = Math.min(16, 120 / n), ly0 = py + 70;
        for (var j = 0; j < n; j++) {
          var used = k.pick.slice(0, s).indexOf(j) >= 0, here = k.pick[s] === j, yy = ly0 + j * rowH;
          if (here) api.rect(cx - 11, yy - 7.5, 22, 15, {fill: c.c3, fillOpacity: 0.9, rx: 4});
          api.label([cx, yy], L[j], {color: here ? c.card : used ? c.faint : c.ink, size: 12, weight: here ? 750 : 550, anchor: "middle"});
          if (used) api.line([cx - 8, yy], [cx + 8, yy], {color: c.c5, width: 1.4});
        }
      }
      var ex = k.pick.map(function (j) { return L[j]; }).join(", ");
      api.label([200, api.h - 10], k.f.join(" × ") + " = " + k.P.toLocaleString("en-US") + " orders; one of them: " + ex, {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
