// Equity value to enterprise value. The bridge view is the banker's waterfall: start from the market value of the
// common equity, add every other claim on the business (debt, preferred, minority interest), subtract the cash a
// buyer of the whole firm would get back. The balance-sheet view shows why: what the firm owns (the operating
// business, worth EV, plus its cash) equals what everyone has a claim to (equity + debt + preferred + minority).
(function () {
  function vals(v) {
    var claims = v.E + v.D + v.P + v.MI;
    return {claims: claims, ev: claims - v.C};
  }
  function b(x) { return (x < 0 ? "−" : "") + Math.abs(x).toFixed(1); }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }

  Viz.register("ev-equity-bridge", {
    title: "Equity value to enterprise value",
    subject: "finance",
    shows: "Equity value plus debt, preferred and minority interest, minus cash, equals enterprise value; the balance-sheet view shows why cash comes off",
    params: {
      E: {kind: "number", default: 10, min: 1, max: 20, step: 0.5, label: "E"},
      D: {kind: "number", default: 4, min: 0, max: 10, step: 0.1, label: "D"},
      P: {kind: "number", default: 0.5, min: 0, max: 3, step: 0.1, label: "P"},
      MI: {kind: "number", default: 0.5, min: 0, max: 3, step: 0.1, label: "MI"},
      C: {kind: "number", default: 2, min: 0, max: 8, step: 0.1, label: "C"},
      view: {kind: "enum", values: ["bridge", "balance sheet"], default: "bridge", label: "view"}
    },
    formula: function (v) {
      var d = vals(v);
      return "EV=E+D+P+MI-C=" + Viz.n(v.E, 1) + "+" + Viz.n(v.D, 1) + "+" + Viz.n(v.P, 1) + "+" + Viz.n(v.MI, 1) + "-" + Viz.n(v.C, 1) + "=" + Viz.n(d.ev, 1);
    },
    status: function (v) {
      var d = vals(v);
      if (d.ev < -0.05) return "<b>Negative EV (" + b(d.ev) + "bn)</b>: the market prices the business below the net cash it holds.";
      return "EV <b>$" + b(d.ev) + "bn</b>: a buyer of the whole firm pays the $" + b(v.E) + "bn equity and takes on $" + b(v.D + v.P + v.MI) +
        "bn of other claims, but gets <b>$" + b(v.C) + "bn</b> of cash back.";
    },
    examples: [
      {name: "balance sheet view", values: {view: "balance sheet"}},
      {name: "no debt, lots of cash", values: {E: 6, D: 0, P: 0, MI: 0, C: 5}},
      {name: "negative EV", values: {E: 2, D: 0, P: 0, MI: 0, C: 6}},
      {name: "negative EV, balance sheet", values: {E: 2, D: 1, P: 0, MI: 0, C: 7, view: "balance sheet"}},
      {name: "highly levered", values: {E: 3, D: 10, P: 3, MI: 3, C: 0.5}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, d = vals(v), top = 34, bot = 236;
      if (v.view === "bridge") {
        var x0 = 10, x1 = 392, cw = (x1 - x0) / 6, bw = 40;
        var lo = Math.min(0, d.ev), hi = d.claims, Y = function (x) { return bot - 16 - (x - lo) / (hi - lo) * (bot - 16 - top - 14); };
        api.line([x0, Y(0)], [x1, Y(0)], {color: c.axis, width: 1.2});
        var cols = [
          {a: 0, b: v.E, col: c.c1, name: ["equity", "value"], sign: ""},
          {a: v.E, b: v.E + v.D, col: c.c2, name: ["debt", ""], sign: "+"},
          {a: v.E + v.D, b: v.E + v.D + v.P, col: c.c2, name: ["preferred", ""], sign: "+"},
          {a: v.E + v.D + v.P, b: d.claims, col: c.c2, name: ["minority", "interest"], sign: "+"},
          {a: d.claims, b: d.ev, col: c.c3, name: ["cash", ""], sign: "−"},
          {a: 0, b: d.ev, col: c.c6, name: ["enterprise", "value"], sign: ""}
        ];
        cols.forEach(function (k, i) {
          var cx = x0 + cw * (i + 0.5), yt = Y(Math.max(k.a, k.b)), yb = Y(Math.min(k.a, k.b)), h = yb - yt;
          api.rect(cx - bw / 2, yt, bw, Math.max(1.5, h), {fill: k.col, fillOpacity: i === 0 || i === 5 ? 0.9 : 0.75, rx: 3});
          if (i < 5) api.line([cx + bw / 2, Y(k.b)], [cx + cw - bw / 2, Y(k.b)], {color: c.faint, width: 1, dash: "3 3"});
          var amt = Math.abs(k.b - k.a), txt = (k.sign && amt > 0 ? k.sign : "") + b(i === 5 ? d.ev : amt);
          var below = i === 4 || (i === 5 && d.ev < 0);
          api.label([cx, below ? yb + 11 : yt - 10], txt, {color: amt < 0.05 && i > 0 && i < 5 ? c.muted : k.col, size: 12.5, weight: 650, anchor: "middle"});
          api.label([cx, 250], k.name[0], {color: c.muted, size: 12, anchor: "middle"});
          if (k.name[1]) api.label([cx, 265], k.name[1], {color: c.muted, size: 12, anchor: "middle"});
        });
        api.label([x0, 14], "$bn, market values", {color: c.muted, size: 12});
      } else {
        // what the firm owns (left) = who has a claim on it (right), same scale
        var hiB = Math.max(d.claims, v.C), Yb = function (x) { return bot - x / hiB * (bot - top - 10); }, w = 76;
        var lx = 142, rx = 268;
        api.line([40, bot], [370, bot], {color: c.axis, width: 1.2});
        api.label([lx, 16], "what it owns", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.label([rx, 16], "who has a claim", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.label([(lx + rx) / 2, Yb(d.claims / 2)], "=", {color: c.muted, size: 20, anchor: "middle"});
        var tags = {"-1": [], "1": []};   // side labels per column, spread apart before drawing
        var seg = function (x, from, to, col, op, name, side, valueAt) {
          var yt = Yb(Math.max(from, to)), yb = Yb(Math.min(from, to)), h = yb - yt;
          if (h < 0.5) return;
          api.rect(x - w / 2, yt, w, h, {fill: col, fillOpacity: op, rx: 2});
          api.line([x - w / 2, yt], [x + w / 2, yt], {color: c.card, width: 1.5});
          var mid = valueAt == null ? (yt + yb) / 2 : valueAt;
          if (h >= 15) api.label([x, mid], b(to - from), {color: c.card, size: 12, weight: 700, anchor: "middle"});
          tags[side].push({y: mid, x: side < 0 ? x - w / 2 - 8 : x + w / 2 + 8, text: name + (h < 15 ? " " + b(to - from) : ""), col: col, side: side});
        };
        var flush = function () {
          ["-1", "1"].forEach(function (sd) {
            var list = tags[sd].sort(function (p, q) { return q.y - p.y; });
            for (var i = 1; i < list.length; i++) list[i].y = Math.min(list[i].y, list[i - 1].y - 14);
            list.forEach(function (t) { api.label([t.x, t.y], t.text, {color: t.col, size: 12, weight: 600, anchor: t.side < 0 ? "end" : "start"}); });
          });
        };
        if (d.ev >= 0) {
          seg(lx, 0, d.ev, c.c6, 0.85, "business (EV)", -1);
          seg(lx, d.ev, d.claims, c.c3, 0.85, "cash", -1);
        } else {
          // cash is bigger than every claim: the part of it above the claims is cancelled by a negative EV
          seg(lx, 0, v.C, c.c3, 0.85, "cash", -1, (Yb(0) + Yb(d.claims)) / 2);
          var yt = Yb(v.C), yb = Yb(d.claims);
          api.rect(lx - w / 2, yt, w, yb - yt, {fill: c.card, fillOpacity: 0.55, stroke: c.c6, dash: "4 3", rx: 2});
          api.label([lx, (yt + yb) / 2], "EV " + b(d.ev), {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        }
        var run = 0, parts = [[v.E, c.c1, 0.85, "equity"], [v.D, c.c2, 0.85, "debt"], [v.P, c.c2, 0.6, "preferred"], [v.MI, c.c2, 0.4, "minority"]];
        parts.forEach(function (p) { seg(rx, run, run + p[0], p[1], p[2], p[3], 1); run += p[0]; });
        flush();
        api.label([(lx + rx) / 2, 254], "EV = what it owns − cash = all claims − cash", {color: c.muted, size: 12, anchor: "middle"});
        api.label([(lx + rx) / 2, 270], d.ev < 0 ? "here cash exceeds every claim, so EV < 0" : "so the claims, minus the cash, price the business", {color: c.muted, size: 12, anchor: "middle"});
      }
      tint(api);
    }
  });
})();
