// What a vaccine leaves behind: antibody that wanes and memory B cells that stay. Left: the schedule in weeks (antibody on
// a log scale, in multiples of a protective level); right: the 21 days after the real pathogen arrives, this person against
// someone never vaccinated (dashed). The shapes are a textbook model, not data for any one vaccine:
//  - dose 1 (a primary response): flat for 1 week, then a log-linear rise to a peak of 2x protective at week 3;
//  - each later meeting with the antigen k (k = 2, 3, ...) starts after 0.3 weeks and peaks 1.5 weeks after the dose at
//    F times the previous peak, F = 1 + (10/(k-1) - 1)(1 - e^{-w/8}), w = weeks since the previous dose: a boost given
//    while antibody from the last dose is still high is smaller (the antigen is cleared before it restimulates), and
//    each extra dose adds less;
//  - after a peak P the level falls as A = L 2^{-dt/156} + (P - L) 2^{-dt/4} (dt in weeks since the peak): short-lived
//    plasma cells and IgG decay within weeks; long-lived plasma cells hold a plateau L = P/20 that fades over years;
//  - memory B cells rise over 4 weeks after each dose to 1 - 0.6^k of a full pool (k doses) and stay;
//  - after exposure, memory responds in 2 days and peaks on day 7 (at F times the last peak); a naive response waits
//    7 days and reaches 2x protective on day 21.
(function () {
  var BASE = 0.01, P1 = 2;
  function boost(k, w) { return 1 + (10 / (k - 1) - 1) * (1 - Math.exp(-w / 8)); }
  function model(v) {
    var ds = [], P = 0;
    for (var k = 1; k <= v.doses; k++) {
      var t = (k - 1) * v.gap;
      P = k === 1 ? P1 : P * boost(k, v.gap);
      ds.push({t: t, P: P, L: P / 20, lag: k === 1 ? 1 : 0.3, tp: t + (k === 1 ? 3 : 1.5), M: 1 - Math.pow(0.6, k)});
    }
    var last = ds[ds.length - 1], te = (last ? last.t : 0) + v.after, m = {ds: ds, last: last, te: te};
    m.ae = A(m, te);
    m.R = last ? Math.max(m.ae, last.P * boost(v.doses + 1, v.after)) : 0;
    m.naiveDay = 7 + 14 * Math.log(1 / BASE) / Math.log(P1 / BASE);
    m.day = !last ? m.naiveDay : m.ae >= 1 ? 0 : 2 + 5 * Math.log(1 / m.ae) / Math.log(m.R / m.ae);
    return m;
  }
  function decay(d, t) { var u = t - d.tp; return d.L * Math.pow(2, -u / 156) + (d.P - d.L) * Math.pow(2, -u / 4); }
  function A(m, t) {
    var i = -1;
    m.ds.forEach(function (d, k) { if (t >= d.t) i = k; });
    if (i < 0) return BASE;
    var d = m.ds[i], prev = i ? function (x) { return decay(m.ds[i - 1], x); } : function () { return BASE; };
    if (t <= d.t + d.lag) return prev(t);
    var a0 = prev(d.t + d.lag);
    return t <= d.tp ? a0 * Math.pow(d.P / a0, (t - d.t - d.lag) / (d.tp - d.t - d.lag)) : decay(d, t);
  }
  function mem(m, t) {
    var lvl = 0;
    m.ds.forEach(function (d, k) { if (t >= d.t) { var p = k ? m.ds[k - 1].M : 0; lvl = p + (d.M - p) * Math.min(1, (t - d.t) / 4); } });
    return lvl;
  }
  function after(m, day) {   // antibody and memory on a day after exposure: [this person, never vaccinated]
    var naive = day <= 7 ? BASE : BASE * Math.pow(P1 / BASE, (day - 7) / 14), nm = day <= 7 ? 0 : 0.4 * (day - 7) / 21;
    if (!m.last) return {a: naive, m: nm, naive: naive};
    var R = m.R, a = day <= 2 ? m.ae : day <= 7 ? m.ae * Math.pow(R / m.ae, (day - 2) / 5) : R / 20 + R * 0.95 * Math.pow(2, -(day - 7) / 28);
    var k = m.ds.length, mm = m.last.M + (1 - Math.pow(0.6, k + 1) - m.last.M) * Math.max(0, Math.min(1, (day - 3) / 18));
    return {a: a, m: mm, naive: naive};
  }
  var r1 = function (x) { return Viz.fmt(x, x < 0.1 ? 3 : x < 10 ? 2 : 1); };

  Viz.register("vaccine-induced-immune-memory", {
    title: "Vaccine-induced immune memory",
    subject: "biology",
    shows: "Set the doses, the gap between them and how long until the real pathogen arrives: antibody wanes, but the memory cells each dose leaves behind bring it back within days instead of the two to three weeks a first response takes",
    params: {
      doses: {kind: "integer", default: 2, min: 0, max: 3, label: "\\text{doses}"},
      gap: {kind: "integer", default: 4, min: 3, max: 26, label: "\\text{gap (wk)}"},
      after: {kind: "integer", default: 52, min: 4, max: 104, label: "\\text{wait (wk)}"}
    },
    formula: function (v) {
      var m = model(v);
      if (!m.last) return "\\text{no vaccine: }A=" + BASE + ",\\ \\text{no memory}\\newline\\text{first response protects by day }" + Viz.n(m.naiveDay, 1);
      var d = m.last, dt = v.after - (d.tp - d.t);
      return "P:\\ " + m.ds.map(function (q) { return Viz.n(q.P, 1); }).join("\\to ") + ",\\ \\ \\Delta t=" + Viz.n(dt, 1) + "\\ \\text{wk}" +
        "\\newline A=\\tfrac{P}{20}\\,2^{-\\Delta t/156}+\\tfrac{19P}{20}\\,2^{-\\Delta t/4}=" + Viz.n(m.ae, m.ae < 0.1 ? 3 : m.ae < 10 ? 2 : 1);
    },
    status: function (v) {
      var m = model(v), nd = "<b>" + Viz.fmt(m.naiveDay, 0) + "</b>", wk = v.after + " weeks after the last dose";
      if (!m.last) return "No vaccine and no memory cells: antibody against the real pathogen reaches the protective level only around day " + nd + ", time enough for it to cause disease.";
      if (m.ae >= 1) return "Antibody is still <b>" + r1(m.ae) + "×</b> the protective level " + wk + ", so the pathogen is neutralized on arrival while memory cells push the level higher.";
      return wk.charAt(0).toUpperCase() + wk.slice(1) + ", antibody has waned to <b>" + r1(m.ae) + "×</b> the protective level, but memory B cells bring it back over the line by day <b>" + Viz.fmt(m.day, 1) + "</b> instead of day " + nd + " without the vaccine.";
    },
    examples: [
      {name: "no vaccine", values: {doses: 0}},
      {name: "one dose, a year later", values: {doses: 1, after: 52}},
      {name: "three spaced doses, still protected", values: {doses: 3, gap: 26, after: 26}},
      {name: "doses close together, two years later", values: {doses: 2, gap: 3, after: 104}},
      {name: "maximum gap and wait", values: {doses: 3, gap: 26, after: 104}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v);
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12}, o || {})); };
      var X0 = 52, X1 = 264, R1 = 390, YT = 34, YB = 182, MT = 214, MB = 252, te = m.te;
      var xw = function (t) { return X0 + t / te * (X1 - X0); }, xd = function (d) { return X1 + d / 21 * (R1 - X1); };
      var ya = function (a) { return YB - (Math.log10(Math.max(BASE, Math.min(1000, a))) + 2) / 5 * (YB - YT); };
      var ym = function (q) { return MB - q * (MB - MT); };
      // grid, y ticks, the protective level
      for (var e = -2; e <= 3; e++) {
        api.line([X0, ya(Math.pow(10, e))], [R1, ya(Math.pow(10, e))], {color: c.grid, width: 1});
        L([X0 - 5, ya(Math.pow(10, e))], e < 0 ? String(Math.pow(10, e)) : e === 0 ? "1×" : String(Math.pow(10, e)), e === 0 ? c.c4 : c.muted, {anchor: "end"});
      }
      var cap = L([10, (YT + YB) / 2], "antibody (× protective)", c.muted, {anchor: "middle", clamp: false});
      cap.setAttribute("transform", "rotate(-90 10 " + (YT + YB) / 2 + ")");
      api.line([X0, ya(1)], [R1, ya(1)], {color: c.c4, width: 1.6, dash: "6 4"});
      api.rect(X0, MT, R1 - X0, MB - MT, {fill: c.c6, fillOpacity: 0.05, rx: 3});
      // doses and exposure
      m.ds.forEach(function (d) {
        api.line([xw(d.t), YT - 4], [xw(d.t), MB], {color: c.c3, width: 1.2, dash: "3 3"});
        api.polygon([[xw(d.t) - 5, YT - 14], [xw(d.t) + 5, YT - 14], [xw(d.t), YT - 6]], {fill: c.c3, fillOpacity: 1});
      });
      if (m.ds.length) L([X0 - 4, YT - 12], m.ds.length > 1 ? "doses" : "dose", c.c3, {anchor: "end", weight: 600});
      api.line([X1, YT - 4], [X1, MB], {color: c.c5, width: 2});
      L([X1, YT - 13], "exposure", c.c5, {anchor: "middle", weight: 650});
      // antibody: the schedule in weeks, then the days after exposure
      var pts = [], mpts = [], k, n = 240;
      for (k = 0; k <= n; k++) { var t = te * k / n; pts.push([xw(t), ya(A(m, t))]); mpts.push([xw(t), ym(mem(m, t))]); }
      var naive = [], rpts = [], rm = [];
      for (k = 0; k <= 84; k++) { var dd = 21 * k / 84, q = after(m, dd); rpts.push([xd(dd), ya(q.a)]); rm.push([xd(dd), ym(q.m)]); naive.push([xd(dd), ya(q.naive)]); }
      if (m.last) api.polyline(naive, {stroke: c.muted, width: 2, dash: "5 4"});
      api.polyline(pts.concat(rpts), {stroke: c.c2, width: 2.6});
      api.polyline(mpts.concat(rm), {stroke: c.c6, width: 2.4});
      // when antibody is back over the line
      api.circle([xd(m.day), ya(Math.max(1, Math.min(m.ae, 1000)))], 4, {fill: c.c2});
      if (m.last) api.circle([xd(m.naiveDay), ya(1)], 3.5, {fill: c.muted});
      // labels, each placed where the curves are not
      var all = pts.concat(rpts, naive);
      var clear = function (x, y, w) { return all.every(function (p) { return p[0] < x - 3 || p[0] > x + w + 3 || Math.abs(p[1] - y) > 9; }) &&
        m.ds.every(function (d) { return xw(d.t) < x - 3 || xw(d.t) > x + w + 3; }); };
      var place = function (text, col, y0s, x0, x1) {
        var w = text.length * 6.6;
        for (var x = x0; x + w <= x1; x += 6) for (var j = 0; j < y0s.length; j++) if (clear(x, y0s[j], w)) return L([x, y0s[j]], text, col, {weight: 600});
        return L([x0, y0s[0]], text, col, {weight: 600});
      };
      place("protective level", c.c4, [ya(1) - 9, ya(1) + 10], X0 + 4, X1 - 4);
      var top = m.ds.reduce(function (b, d) { return d.P > b.P ? d : b; }, {P: 0});
      if (top.P) place("antibody", c.c2, [ya(top.P) - 2, ya(top.P) - 14, ya(top.P / 3)], Math.min(xw(top.tp) + 6, X1 - 60), X1 - 2);
      else L([X0 + 6, ya(BASE) - 10], "antibody", c.c2, {weight: 600});
      if (m.last) L([X1 + 6, YB + 11], "no vaccine", c.muted);
      L([X0 + 4, MT - 9], "memory B cells", c.c6, {weight: 600});
      // time axes
      var step = [1, 2, 4, 8, 13, 26, 52].find(function (s) { return te / s <= 5; });
      for (var w = 0; w <= te - step * 0.4; w += step) L([xw(w), MB + 13], String(w), c.muted, {anchor: "middle"});
      [7, 14, 21].forEach(function (d) { L([xd(d), MB + 13], String(d), c.muted, {anchor: "middle"}); });
      L([X0, MB + 31], m.ds.length ? "weeks after first dose" : "weeks", c.muted);
      L([R1, MB + 31], "days after exposure", c.muted, {anchor: "end"});
      // viz.css sets every svg text fill to ink, which overrides the fill attribute: restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
