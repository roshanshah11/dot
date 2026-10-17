// One transaction posted to a small balance sheet: the debit and the credit land on two accounts, and the
// two sides of Assets = Liabilities + Equity move together. `amount` is Dot's addition to the queue's schema,
// so the bars can show the size of the change; opening balances are big enough that no account goes negative.
Viz.register("double-entry-transaction-effects", {
  title: "Double entry: one transaction, two accounts",
  subject: "finance",
  shows: "Pick a transaction: one account is debited and one credited, and Assets = Liabilities + Equity stays balanced after every entry",
  params: {
    transaction_type: {kind: "enum", default: "owner investment for cash", label: "\\text{entry}",
      values: ["owner investment for cash", "equipment purchase for cash", "supplies purchase on account", "payment of accounts payable"],
      names: {"owner investment for cash": "owner invests cash", "equipment purchase for cash": "buy equipment for cash",
              "supplies purchase on account": "buy supplies on account", "payment of accounts payable": "pay accounts payable"}},
    amount: {kind: "number", default: 4000, min: 500, max: 5000, step: 100, label: "\\text{amount}"}
  },
  opening: {cash: 10000, supplies: 3000, equipment: 12000, ap: 6000, capital: 19000},
  names: {cash: "Cash", supplies: "Supplies", equipment: "Equipment", ap: "Accounts payable", capital: "Owner's capital"},
  // [debited account, credited account, sign on the debited account, sign on the credited account]
  entry: function (t) {
    return {"owner investment for cash": ["cash", "capital", 1, 1], "equipment purchase for cash": ["equipment", "cash", 1, -1],
            "supplies purchase on account": ["supplies", "ap", 1, 1], "payment of accounts payable": ["ap", "cash", -1, -1]}[t];
  },
  after: function (v) {
    var s = Viz.get("double-entry-transaction-effects"), e = s.entry(v.transaction_type), b = Object.assign({}, s.opening);
    b[e[0]] += e[2] * v.amount; b[e[1]] += e[3] * v.amount;
    return b;
  },
  formula: function (v) {
    var s = Viz.get("double-entry-transaction-effects"), a = s.after(v), o = s.opening;
    var d = function (x) { return (x < 0 ? "-" : x > 0 ? "+" : "") + Math.abs(x).toLocaleString("en-US").replace(/,/g, "{,}"); };
    var dA = a.cash + a.supplies + a.equipment - o.cash - o.supplies - o.equipment, dL = a.ap - o.ap, dE = a.capital - o.capital;
    var u = function (x, name) { return "\\underbrace{" + d(x) + "}_{\\Delta " + name + "}"; };
    return u(dA, "A") + "=" + u(dL, "L") + "\\;+\\;" + u(dE, "E");
  },
  status: function (v) {
    var s = Viz.get("double-entry-transaction-effects"), a = s.after(v), m = Viz.money(v.amount, 0), tot = Viz.money(a.cash + a.supplies + a.equipment, 0);
    return {
      "owner investment for cash": "Cash (an asset) and owner's capital (equity) both rise by " + m + ", so both sides grow to <b>" + tot + "</b>.",
      "equipment purchase for cash": "One asset is swapped for another: equipment up " + m + ", cash down " + m + ", so total assets stay <b>" + tot + "</b>.",
      "supplies purchase on account": "Supplies (an asset) and accounts payable (a liability) both rise by " + m + ", so both sides grow to <b>" + tot + "</b>.",
      "payment of accounts payable": "Cash (an asset) and accounts payable (a liability) both fall by " + m + ", so both sides shrink to <b>" + tot + "</b>."
    }[v.transaction_type];
  },
  examples: [
    {name: "equipment for cash", values: {transaction_type: "equipment purchase for cash", amount: 5000}},
    {name: "supplies on account", values: {transaction_type: "supplies purchase on account", amount: 500}},
    {name: "pay accounts payable", values: {transaction_type: "payment of accounts payable", amount: 5000}}
  ],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, s = Viz.get("double-entry-transaction-effects"), e = s.entry(v.transaction_type), a = s.after(v), o = s.opening;
    var base = 226, sc = 182 / 30000, bw = 56, xl = 140, xr = 260;
    var col = function (k) { return k === e[0] ? c.c1 : k === e[1] ? c.c3 : c.muted; };
    var stack = function (keys, xc, side) {
      var y = base, blocks = [];
      keys.forEach(function (k) {
        var h = a[k] * sc, changed = k === e[0] || k === e[1];
        api.rect(xc - bw / 2, y - h, bw, h, {fill: col(k), fillOpacity: changed ? 0.8 : 0.22, rx: 0});
        api.line([xc - bw / 2, y - h], [xc + bw / 2, y - h], {color: c.card, width: 2});
        if (changed && h >= 16) api.label([xc, y - h / 2], k === e[0] ? "Dr" : "Cr", {color: c.card, size: 12.5, weight: 700, anchor: "middle"});
        blocks.push({k: k, y: y - h / 2, changed: changed});
        y -= h;
      });
      // name + balance beside each block, pushed apart so two-line labels never collide
      for (var i = 1; i < blocks.length; i++) blocks[i].ly = Math.min(blocks[i].y, (blocks[i - 1].ly || blocks[i - 1].y) - 31);
      blocks[0].ly = blocks[0].y;
      blocks.forEach(function (b) {
        var lx = side < 0 ? xc - bw / 2 - 8 : xc + bw / 2 + 8, anc = side < 0 ? "end" : "start", dv = a[b.k] - o[b.k];
        var ly = Math.max(40, b.ly);
        api.label([lx, ly - 7], s.names[b.k], {color: b.changed ? col(b.k) : c.muted, size: 12, weight: b.changed ? 650 : 500, anchor: anc});
        api.label([lx, ly + 8], api.money(a[b.k], 0) + (dv ? " (" + (dv > 0 ? "+" : "−") + Math.abs(dv).toLocaleString("en-US") + ")" : ""),
          {color: b.changed ? c.ink : c.muted, size: 12, anchor: anc});
      });
    };
    api.label([xl, 14], "Assets", {color: c.ink, size: 13, weight: 650, anchor: "middle"});
    api.label([xr, 14], "Liabilities + Equity", {color: c.ink, size: 13, weight: 650, anchor: "middle"});
    stack(["equipment", "supplies", "cash"], xl, -1);
    stack(["capital", "ap"], xr, 1);
    api.line([xr - bw / 2, base - a.capital * sc], [xr + bw / 2, base - a.capital * sc], {color: c.ink, width: 1.5, opacity: 0.6});
    api.line([xl - bw / 2 - 6, base], [xr + bw / 2 + 6, base], {color: c.axis, width: 1.2});
    // where both sides stood before the entry
    var before = (o.cash + o.supplies + o.equipment) * sc, after = (a.cash + a.supplies + a.equipment);
    api.line([xl - bw / 2 - 4, base - before], [xr + bw / 2 + 4, base - before], {color: c.ink, width: 1.3, dash: "4 4", opacity: 0.8});
    api.label([200, base - before - 9], "before", {color: c.muted, size: 12, anchor: "middle"});
    api.label([xl, base + 15], api.money(after, 0), {color: c.ink, size: 13, weight: 650, anchor: "middle"});
    api.label([200, base + 15], "=", {color: c.ink, size: 15, weight: 650, anchor: "middle"});
    api.label([xr, base + 15], api.money(a.ap + a.capital, 0), {color: c.ink, size: 13, weight: 650, anchor: "middle"});
    // the journal entry in its usual form: debit first, credit indented under it
    var amt = v.amount.toLocaleString("en-US");
    api.line([84, 252], [346, 252], {color: c.grid, width: 1});
    api.label([96, 270], "Dr  " + s.names[e[0]], {color: c.c1, size: 12.5, weight: 650});
    api.label([282, 270], amt, {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
    api.label([126, 289], "Cr  " + s.names[e[1]], {color: c.c3, size: 12.5, weight: 650});
    api.label([338, 289], amt, {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
    // viz.css sets every svg text to ink, which beats the fill attribute; an inline style keeps each label in its own color
    api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
  }
});
