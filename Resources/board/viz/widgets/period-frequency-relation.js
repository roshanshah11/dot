// Period and frequency are reciprocals: if one cycle takes T seconds, f = 1/T cycles happen each second.
// Top: the oscillation over a "nice" window (1, 2 or 5 times a power of ten seconds, the smallest that holds at
// least four cycles), each completed cycle marked, so f reads as cycles counted divided by the window. Bottom: f
// against T on log-log axes across the queue's whole range (0.01 to 1000 s): the reciprocal is a straight line of
// slope -1, so ten times the period is a tenth of the frequency. A linear slider over five decades is coarse at
// the small end, so the dot on the line is a handle that slides T on a log scale; the number box takes any value.
(function () {
  var TMIN = 0.01, TMAX = 1000;
  function sig(x) { // three significant figures, plain decimals
    if (x === 0) return "0";
    var e = Math.floor(Math.log10(Math.abs(x)) + 1e-9);
    return Viz.fmt(x, Math.max(0, 2 - e));
  }
  function win(T) { // the smallest 1-2-5 window holding at least four cycles
    var need = 4 * T, e = Math.floor(Math.log10(need)), best = null;
    [e, e + 1].forEach(function (k) { [1, 2, 5].forEach(function (m) { var w = m * Math.pow(10, k); if (w >= need * (1 - 1e-9) && (best === null || w < best)) best = w; }); });
    return best;
  }
  function calc(v) { var T = v.period, W = win(T); return {T: T, f: 1 / T, w: 2 * Math.PI / T, W: W, cycles: W / T}; }

  Viz.register("period-frequency-relation", {
    title: "Period and frequency",
    subject: "physics",
    shows: "Set the period T: one cycle takes T seconds, so 1/T cycles fit in each second, and f = 1/T is a straight line of slope −1 on log axes",
    params: {
      period: {kind: "number", default: 2, min: TMIN, max: TMAX, step: 0.01, label: "T\\ (\\text{s})"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}f=\\dfrac{1}{T}=\\dfrac{1}{" + sig(k.T) + "\\ \\text{s}}=" + sig(k.f) + "\\ \\text{Hz}\\\\[8pt]" +
        "\\omega=\\dfrac{2\\pi}{T}=" + sig(k.w) + "\\ \\text{rad/s}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (Math.abs(k.T - 1) < 1e-9) return "One cycle takes exactly <b>1 s</b>, so one cycle happens each second: <b>f = 1 Hz</b>.";
      if (k.T < 1) return "One cycle takes only <b>" + sig(k.T) + " s</b>, so <b>" + sig(k.f) + "</b> cycles fit in each second: f = " + sig(k.f) + " Hz.";
      return "One cycle takes <b>" + sig(k.T) + " s</b>, so each second holds only <b>" + sig(k.f) + "</b> of a cycle: f = " + sig(k.f) + " Hz.";
    },
    examples: [
      {name: "Minimum supported values", values: {period: TMIN}},
      {name: "Maximum supported values", values: {period: TMAX}},
      {name: "one second, one hertz", values: {period: 1}},
      {name: "resting heartbeat, 0.8 s", values: {period: 0.8}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v);
      // ---- the oscillation over the window
      var x0 = 40, x1 = 380, mid = 66, amp = 26, X = function (t) { return x0 + (x1 - x0) * t / k.W; };
      var nc = Math.floor(k.cycles + 1e-9);
      for (var j = 1; j <= nc; j++) api.line([X(j * k.T), mid - amp - 4], [X(j * k.T), mid + amp + 4], {color: c.faint, width: 1, dash: "3 3"});
      var wave = []; for (var i = 0; i <= 700; i++) { var t = k.W * i / 700; wave.push([X(t), mid - amp * Math.sin(2 * Math.PI * t / k.T)]); }
      api.polyline(wave, {stroke: c.c2, width: 2});
      // one period bracketed above the first cycle
      var yb = mid - amp - 12;
      api.line([X(0), yb], [X(k.T), yb], {color: c.c4, width: 2});
      api.line([X(0), yb - 5], [X(0), yb + 5], {color: c.c4, width: 2});
      api.line([X(k.T), yb - 5], [X(k.T), yb + 5], {color: c.c4, width: 2});
      api.label([X(0), yb - 13], "one cycle: T = " + sig(k.T) + " s", {color: c.c4, size: 12.5, weight: 650});
      // the window's time axis and the cycle count
      var ya = mid + amp + 12;
      api.line([x0, ya], [x1 + 4, ya], {color: c.axis, width: 1.2});
      [0, 0.5, 1].forEach(function (q) {
        api.line([X(q * k.W), ya - 3], [X(q * k.W), ya + 3], {color: c.axis, width: 1});
        api.label([X(q * k.W), ya + 13], sig(q * k.W), {color: c.muted, size: 12, anchor: q === 0 ? "start" : q === 1 ? "end" : "middle"});
      });
      api.label([x1, yb - 13], sig(k.cycles) + " cycles in " + sig(k.W) + " s", {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
      api.label([x0 - 6, ya + 13], "t (s)", {color: c.muted, size: 12, anchor: "end"});
      // ---- f against T, log-log
      var bx0 = 62, bx1 = 372, by0 = 160, by1 = 262;
      var LX = function (T) { return bx0 + (bx1 - bx0) * (Math.log10(T) + 2) / 5; };       // T: 0.01 .. 1000 s
      var LY = function (f) { return by1 - (by1 - by0) * (Math.log10(f) + 3) / 5; };       // f: 0.001 .. 100 Hz
      for (var d = -2; d <= 3; d++) {
        var gx = LX(Math.pow(10, d));
        api.line([gx, by0], [gx, by1], {color: c.grid, width: 1});
        api.label([gx, by1 + 13], sig(Math.pow(10, d)), {color: c.muted, size: 12, anchor: "middle"});
      }
      for (var e = -3; e <= 2; e++) {
        var gy = LY(Math.pow(10, e));
        api.line([bx0, gy], [bx1, gy], {color: c.grid, width: 1});
        api.label([bx0 - 6, gy], sig(Math.pow(10, e)), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([bx0, by1], [bx1 + 4, by1], {color: c.axis, width: 1.2});
      api.line([bx0, by1], [bx0, by0 - 4], {color: c.axis, width: 1.2});
      api.label([bx1, by1 + 28], "period T (s), log scale", {color: c.muted, size: 12, anchor: "end"});
      api.label([bx0 - 6, by0 - 14], "f (Hz)", {color: c.muted, size: 12, anchor: "end"});
      api.line([LX(TMIN), LY(1 / TMIN)], [LX(TMAX), LY(1 / TMAX)], {color: c.c1, width: 2.5});
      var lt = k.T < 0.3 ? 150 : 0.04;   // keep the line's name away from the dot's label
      api.label([LX(lt), LY(1 / lt) - 14], "f = 1/T", {color: c.c1, size: 12.5, weight: 650});
      var P = [LX(k.T), LY(k.f)];
      api.line([P[0], P[1]], [P[0], by1], {color: c.c4, width: 1.3, dash: "4 4"});
      api.line([P[0], P[1]], [bx0, P[1]], {color: c.c2, width: 1.3, dash: "4 4"});
      var right = k.T < 30;
      api.label(right ? [P[0] + 12, P[1] - 12] : [bx1 - 2, by0 + 8], sig(k.T) + " s → " + sig(k.f) + " Hz",
        {color: c.ink, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
      api.handle(P, {color: c.c1, r: 6.5, onDrag: function (q) {
        var lt = Math.max(-2, Math.min(3, (q[0] - bx0) / (bx1 - bx0) * 5 - 2)), T = Math.pow(10, lt);
        var s = Math.pow(10, Math.floor(lt) - 1);                     // keep two significant figures while dragging
        api.set({period: Math.max(TMIN, Math.min(TMAX, Math.round(T / s) * s))});
      }});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
