// A five-year DCF: free cash flows grow at g, each is discounted by (1 + WACC)^t, a Gordon-growth terminal value
// sits at year 5 and is discounted back the same five years, and the pieces sum to enterprise value.
// Two panels, two scales: the yearly cash flows are an order of magnitude smaller than the terminal value.
// In both panels the outline is the cash flow when it arrives and the solid fill is what it is worth today.
// Every number shown is in whole $m and the totals are sums of the rounded pieces on screen (S = the five PV labels,
// T = the PV of TV label, EV = S + T), so the figure, the formula and the status always add up exactly.
(function () {
  function model(v) {
    var fcf = [], pv = [], sum = 0;
    for (var t = 1; t <= 5; t++) {
      var f = v.fcf * Math.pow(1 + v.g, t - 1), p = f / Math.pow(1 + v.wacc, t);
      fcf.push(f); pv.push(p); sum += p;
    }
    var tv = fcf[4] * (1 + v.tg) / (v.wacc - v.tg), pvtv = tv / Math.pow(1 + v.wacc, 5);
    var S = pv.reduce(function (a, p) { return a + Math.round(p); }, 0), T = Math.round(pvtv);
    return {fcf: fcf, pv: pv, sum: sum, tv: tv, pvtv: pvtv, ev: sum + pvtv, S: S, T: T, E: S + T, share: T / (S + T)};
  }
  function k(x) { return Math.round(x).toLocaleString("en-US"); }
  function kk(x) { return k(x).replace(/,/g, "{,}"); }
  // an SVG label whose {braced} parts are set as subscripts (Unicode has no subscript T or V)
  function subLabel(api, at, s, o) {
    var t = api.label(at, s.replace(/[{}]/g, ""), Object.assign({raw: true}, o)), lift = 0;
    t.textContent = "";
    s.split(/(\{[^}]*\})/).forEach(function (part) {
      if (!part) return;
      var ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan"), sb = part.charAt(0) === "{";
      ts.textContent = sb ? part.slice(1, -1) : part;
      if ((sb ? 3 : 0) !== lift) ts.setAttribute("dy", (sb ? 3 : 0) - lift);
      if (sb) ts.setAttribute("font-size", 11);
      lift = sb ? 3 : 0;
      t.appendChild(ts);
    });
    return t;
  }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }

  Viz.register("dcf", {
    title: "DCF: from free cash flows to enterprise value",
    subject: "finance",
    shows: "Free cash flows grow for five years, each is discounted back to today, and they add up with the discounted terminal value into enterprise value",
    params: {
      fcf: {kind: "number", default: 100, min: 10, max: 200, step: 5, label: "FCF_1"},
      g: {kind: "number", default: 0.08, min: -0.1, max: 0.25, step: 0.005, label: "g"},
      wacc: {kind: "number", default: 0.09, min: 0.05, max: 0.15, step: 0.005, label: "\\text{WACC}"},
      tg: {kind: "number", default: 0.025, min: 0, max: 0.04, step: 0.0025, label: "g_{TV}"}
    },
    formula: function (v) {
      var d = model(v);
      return "EV=\\sum_{t=1}^{5}\\frac{FCF_t}{(1+\\text{WACC})^t}+\\frac{TV}{(1+\\text{WACC})^5}=" + kk(d.S) + "+" + kk(d.T) + "=" + kk(d.E);
    },
    status: function (v) {
      var d = model(v), pct = Math.round(d.share * 100);
      return "Enterprise value <b>$" + k(d.E) + "m</b>; <b>" + pct + "%</b> of it is the terminal value" +
        (pct >= 85 ? ", so the answer rests almost entirely on WACC − g_TV = " + ((v.wacc - v.tg) * 100).toFixed(2).replace(/\.?0+$/, "") + "%." :
         pct <= 55 ? ", a DCF that leans on the forecast years more than most." : ", which is typical: most of a DCF's value sits beyond the forecast.");
    },
    examples: [
      {name: "terminal growth close to WACC", values: {wacc: 0.05, tg: 0.04}},
      {name: "shrinking cash flows, high WACC", values: {g: -0.1, wacc: 0.15, tg: 0}},
      {name: "fast growth", values: {fcf: 200, g: 0.25, wacc: 0.1, tg: 0.03}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, d = model(v), base = 236, top = 80, H = base - top;
      // left panel: the five yearly cash flows on their own scale
      var lx0 = 14, lx1 = 246, sp = (lx1 - lx0) / 5, bw = 30, maxF = Math.max.apply(null, d.fcf);
      var sy = H / maxF;
      api.label([lx0, 16], "free cash flow, $m", {color: c.ink, size: 12.5, weight: 650});
      api.label([lx0, 34], "outline: when it arrives", {color: c.muted, size: 12});
      api.label([lx0, 50], "solid: worth today", {color: c.c1, size: 12});
      api.line([lx0, base], [lx1, base], {color: c.axis, width: 1.2});
      for (var t = 0; t < 5; t++) {
        var cx = lx0 + sp * (t + 0.5), hf = d.fcf[t] * sy, hp = d.pv[t] * sy;
        api.rect(cx - bw / 2, base - hf, bw, hf, {fill: "none", stroke: c.c2, width: 1.5, dash: "4 3", rx: 2});
        api.rect(cx - bw / 2, base - hp, bw, hp, {fill: c.c1, fillOpacity: 0.85, rx: 2});
        api.label([cx, base - hf - 10], k(d.fcf[t]), {color: c.c2, size: 12, anchor: "middle"});
        api.label([cx, base - hp + 12], k(d.pv[t]), {color: c.card, size: 12, weight: 700, anchor: "middle"});
        api.label([cx, base + 14], String(t + 1), {color: c.muted, size: 12, anchor: "middle"});
        api.label([cx, base + 30], "÷" + (1 + v.wacc).toFixed(3).replace(/0+$/, "") + (t ? "^" + (t + 1) : ""), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.line([lx1 + 9, 60], [lx1 + 9, base + 34], {color: c.grid, width: 1});
      // right panel: the terminal value (outline) and its present value, then EV = sum of PVs + PV of TV
      var rx0 = lx1 + 22, rx1 = 396, tvx = rx0 + 28, evx = rx1 - 28, rbw = 46;
      var maxR = Math.max(d.tv, d.ev), ry = H / maxR;
      // the TV formula is wider than this panel, so it is right-aligned and runs left over the empty top of the left panel
      subLabel(api, [rx1, 16], "TV = FCF{5}(1 + g{TV})/(WACC − g{TV})", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      api.label([rx1, 34], "= $" + k(d.tv) + "m at year 5", {color: c.c3, size: 12, anchor: "end"});
      api.line([rx0, base], [rx1, base], {color: c.axis, width: 1.2});
      api.rect(tvx - rbw / 2, base - d.tv * ry, rbw, d.tv * ry, {fill: "none", stroke: c.c3, width: 1.5, dash: "4 3", rx: 2});
      api.rect(tvx - rbw / 2, base - d.pvtv * ry, rbw, d.pvtv * ry, {fill: c.c3, fillOpacity: 0.85, rx: 2});
      api.label([tvx, base - d.pvtv * ry + 12], k(d.T), {color: c.card, size: 12, weight: 700, anchor: "middle"});
      var hs = d.sum * ry, ht = d.pvtv * ry;
      api.rect(evx - rbw / 2, base - hs, rbw, hs, {fill: c.c1, fillOpacity: 0.85, rx: 2});
      api.rect(evx - rbw / 2, base - hs - ht, rbw, ht, {fill: c.c3, fillOpacity: 0.85, rx: 2});
      api.line([evx - rbw / 2, base - hs], [evx + rbw / 2, base - hs], {color: c.card, width: 2});
      if (hs >= 18) api.label([evx, base - hs / 2], k(d.S), {color: c.card, size: 12, weight: 700, anchor: "middle"});
      if (ht >= 18) api.label([evx, base - hs - ht / 2], k(d.T), {color: c.card, size: 12, weight: 700, anchor: "middle"});
      api.label([evx, base - hs - ht - 10], k(d.E), {color: c.ink, size: 12.5, weight: 700, anchor: "middle"});
      api.line([tvx + rbw / 2 + 3, base - d.pvtv * ry], [evx - rbw / 2 - 3, base - hs - ht / 2], {color: c.c3, width: 1.4, dash: "3 3", arrow: true});
      api.label([tvx, base + 14], "TV", {color: c.muted, size: 12, anchor: "middle"});
      api.label([tvx, base + 30], "÷" + (1 + v.wacc).toFixed(3).replace(/0+$/, "") + "^5", {color: c.muted, size: 12, anchor: "middle"});
      api.label([evx, base + 14], "EV", {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      api.label([evx, base + 30], Math.round(d.share * 100) + "% TV", {color: c.c3, size: 12, anchor: "middle"});
      tint(api);
    }
  });
})();
