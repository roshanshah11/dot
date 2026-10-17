// Accrual vs cash accounting over six months of one small business. Two things happen: a $1,200 job is done in one
// month and the customer pays some months later (or earlier, as a deposit); a $600 insurance policy covering all six
// months is paid up front in month 1. Cash basis books money when it moves; accrual books revenue when it is earned
// and the expense in the months it covers. The gap between them sits on the balance sheet as a receivable, deferred
// revenue or a prepaid expense: the bottom two rows show the job's balance and the prepaid insurance at each month-end.
(function () {
  var JOB = 1200, INS = 600, N = 6;
  function books(v) {
    var pay = v.month + v.lag, cash = [], acc = [], prepaid = [];
    for (var m = 1; m <= N; m++) {
      cash.push((m === pay ? JOB : 0) - (m === 1 ? INS : 0));
      acc.push((m === v.month ? JOB : 0) - INS / N);
      prepaid.push(INS - INS / N * m);                    // month-end balance: 500, 400, ..., 0
    }
    var sum = function (a) { return a.reduce(function (s, x) { return s + x; }, 0); };
    return {pay: pay, cash: cash, acc: acc, prepaid: prepaid, cashTot: sum(cash), accTot: sum(acc),
            jobCash: pay >= 1 && pay <= N ? JOB : 0};
  }
  function usd(x) { return (x < 0 ? "−$" : "$") + Math.abs(Math.round(x)).toLocaleString("en-US"); }
  function sg(x) { return x === 0 ? "0" : (x > 0 ? "+" : "−") + Math.abs(Math.round(x)).toLocaleString("en-US"); }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }
  var INSURE = "the $600 of insurance paid in month 1 is expensed $100 a month (a <b>prepaid</b> asset meanwhile)";

  Viz.register("accrual-vs-cash-accounting", {
    title: "Accrual vs cash accounting",
    subject: "finance",
    shows: "Move the month the work is done and how long the customer takes to pay: cash basis follows the money, accrual follows the work, and the gap is a receivable, deferred revenue or a prepaid expense",
    params: {
      month: {kind: "integer", default: 2, min: 1, max: 6, label: "\\text{work}"},
      lag: {kind: "integer", default: 2, min: -2, max: 4, label: "\\text{lag}"}
    },
    formula: function (v) {
      var b = books(v), n = function (x) { return (x < 0 ? "-" : "") + Math.abs(Math.round(x)).toLocaleString("en-US").replace(/,/g, "{,}"); };
      return "\\begin{aligned}\\textstyle\\sum_{1}^{6} NI_{\\text{accrual}}&=" + n(JOB) + "-6\\times" + n(INS / N) + "=" + n(b.accTot) +
        "\\\\\\textstyle\\sum_{1}^{6} NI_{\\text{cash}}&=" + n(b.jobCash) + "-" + n(INS) + "=" + n(b.cashTot) + "\\end{aligned}";
    },
    status: function (v) {
      var b = books(v), p = b.pay, m = v.month;
      if (v.lag === 0) return "Paid on delivery: the $1,200 lands in month " + m + " on both bases, so the only gap is the insurance, paid $600 in month 1 but expensed $100 a month (a <b>prepaid</b> asset meanwhile), and both total <b>" + usd(b.accTot) + "</b>.";
      if (p > N) return "Accrual books the $1,200 in month " + m + " when the work is done, but the cash comes after month 6, so the window's cash profit is <b>" + usd(JOB) + " lower</b> and a receivable is still open; " + INSURE + ".";
      if (p < 1) return "The customer pays before month 1, so the window's cash profit never sees the $1,200 while accrual books it in month " + m + "; " + INSURE + ".";
      if (v.lag > 0) return "Accrual books the $1,200 in month " + m + " when the work is done and the cash comes in month " + p + ", a <b>receivable</b> for " + v.lag + " month" + (v.lag > 1 ? "s" : "") + "; " + INSURE + ", and both total " + usd(b.accTot) + ".";
      return "The customer pays in month " + p + ", before the work, so accrual holds it as <b>deferred revenue</b> until month " + m + "; " + INSURE + ", and both total " + usd(b.accTot) + ".";
    },
    examples: [
      {name: "paid on delivery", values: {month: 3, lag: 0}},
      {name: "deposit two months ahead", values: {month: 4, lag: -2}},
      {name: "paid after the window", values: {month: 5, lag: 4}},
      {name: "deposit before the window", values: {month: 1, lag: -2}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, b = books(v), x0 = 86, cw = 43, k = 0.038;
      var X = function (m) { return x0 + (m - 0.5) * cw; }, xr = x0 + N * cw, tx = xr + 27;
      // faint month columns from the cash chart down to the month labels, so each bar reads against its month
      for (var i = 0; i <= N; i++) api.line([x0 + i * cw, 28], [x0 + i * cw, 306], {color: c.grid, width: 1});
      var chart = function (zero, vals, title, sub, tot) {
        api.label([8, zero - 8], title, {color: c.ink, size: 12.5, weight: 650});
        api.label([8, zero + 8], sub, {color: c.muted, size: 12});
        api.line([x0, zero], [xr, zero], {color: c.axis, width: 1.2});
        vals.forEach(function (val, i) {
          var x = X(i + 1), h = Math.abs(val) * k, up = val >= 0;
          api.rect(x - 14, up ? zero - h : zero, 28, Math.max(1, h), {fill: up ? c.c1 : c.c3, fillOpacity: 0.85, rx: 2});
          api.label([x, up ? zero - h - 9 : zero + h + 10], sg(val), {color: val === 0 ? c.muted : up ? c.c1 : c.c3, size: 12, weight: 650, anchor: "middle"});
        });
        api.label([tx, zero - 26], "6-mo", {color: c.muted, size: 12, anchor: "middle"});
        api.label([tx, zero - 10], usd(tot), {color: c.ink, size: 12.5, weight: 700, anchor: "middle"});
      };
      api.label([8, 12], "a $1,200 job, and $600 of insurance for m1–m6 paid in m1", {color: c.muted, size: 12});
      chart(104, b.cash, "cash", "when paid", b.cashTot);
      chart(210, b.acc, "accrual", "when earned", b.accTot);
      // payment outside the window: an arrow off the edge of the cash chart
      if (b.pay > N) { api.arrow([xr - 36, 50], [xr + 4, 50], {color: c.c1, width: 2, halo: false}); api.label([xr - 40, 50], "paid in m" + b.pay, {color: c.c1, size: 12, weight: 600, anchor: "end"}); }
      if (b.pay < 1) { api.arrow([x0 + 36, 50], [x0 - 4, 50], {color: c.c1, width: 2, halo: false}); api.label([x0 + 40, 50], "paid before m1", {color: c.c1, size: 12, weight: 600}); }
      // the balance sheet carries the gap at each month-end
      api.label([8, 246], "balance sheet at month-end", {color: c.ink, size: 12.5, weight: 650});
      // job row: receivable (work done, not paid) or deferred revenue (paid, not done)
      var y = 266, lo = Math.max(1, Math.min(v.month, b.pay)), hi = Math.min(N + 1, Math.max(v.month, b.pay));
      api.label([8, y + 1], "job", {color: c.ink, size: 12});
      api.rect(x0, y - 9, N * cw, 19, {fill: c.ink, fillOpacity: 0.04, rx: 4});
      if (v.lag !== 0 && hi > lo) {
        var ar = v.lag > 0, col = ar ? c.c2 : c.c6, bx = x0 + (lo - 1) * cw + 2, bw = (hi - lo) * cw - 4;
        var name = ar ? "receivable" : "deferred revenue", fits = name.length * 12 * 0.56 + 10 < bw;
        api.rect(bx, y - 9, bw, 19, {fill: col, fillOpacity: 0.85, rx: 4});
        if (fits) api.label([bx + bw / 2, y + 1], name, {color: c.card, size: 12, weight: 700, anchor: "middle"});
        else if (bx + bw + 6 + name.length * 6.8 < xr) api.label([bx + bw + 6, y + 1], name, {color: col, size: 12, weight: 700});
        else api.label([bx - 6, y + 1], name, {color: col, size: 12, weight: 700, anchor: "end"});
        api.label([tx, y + 1], "$1,200", {color: col, size: 12, weight: 650, anchor: "middle"});
      } else {
        api.label([x0 + N * cw / 2, y + 1], b.pay < 1 ? "deferred revenue, earned in m1" : "no receivable or deferred revenue", {color: c.muted, size: 12, anchor: "middle"});
      }
      // prepaid insurance row: $600 paid in m1, $100 expensed each month, so the asset steps down to zero
      var y2 = 292;
      api.label([8, y2 - 7], "prepaid", {color: c.ink, size: 12});
      api.label([8, y2 + 7], "insurance", {color: c.ink, size: 12});
      api.rect(x0, y2 - 9, N * cw, 19, {fill: c.ink, fillOpacity: 0.04, rx: 4});
      b.prepaid.forEach(function (bal, i) {
        if (bal > 0) api.rect(x0 + i * cw + 2, y2 - 9, cw - 4, 19, {fill: c.c4, fillOpacity: 0.15 + 0.6 * bal / (INS - INS / N), rx: 4});
        api.label([X(i + 1), y2 + 1], String(bal), {color: bal > 0 ? c.ink : c.muted, size: 12, weight: bal > 0 ? 650 : 500, anchor: "middle"});
      });
      for (var m = 1; m <= N; m++) api.label([X(m), 318], "m" + m, {color: m === v.month ? c.ink : c.muted, size: 12, weight: m === v.month ? 700 : 500, anchor: "middle"});
      api.label([X(v.month), 333], "work done", {color: c.ink, size: 12, anchor: "middle"});
      tint(api);
    }
  });
})();
