// Gauss-Jordan on one 3 x 3 system, one row operation per step, in exact fractions. The forward pass makes
// each pivot 1 and clears below it (echelon form); the backward pass clears above (reduced form). The last
// equation is x + 2y + kz = m, so k and m decide between one solution, a line of them, or none.
(function () {
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function F(n, d) { if (d < 0) { n = -n; d = -d; } var g = gcd(n, d); return [n / g || 0, d / g]; }
  function sub(a, b, k) { return F(a[0] * b[1] * k[1] - k[0] * b[0] * a[1], a[1] * b[1] * k[1]); } // a - k b
  function div(a, b) { return F(a[0] * b[1], a[1] * b[0]); }
  function txt(a) { return Viz.fmt(a[0]) + (a[1] === 1 ? "" : "/" + a[1]); }
  function tex(a) { return a[1] === 1 ? String(a[0]) : (a[0] < 0 ? "-" : "") + "\\tfrac{" + Math.abs(a[0]) + "}{" + a[1] + "}"; }
  var NAMES = ["x", "y", "z"], ORD = ["first", "second", "third"];

  // every state of the matrix and the operation that produced it
  function run(v) {
    var M = [[2, 2, 2, 12], [3, 5, 7, 34], [1, 2, v.k, v.m]].map(function (r) { return r.map(function (x) { return F(x, 1); }); });
    var states = [M.map(function (r) { return r.slice(); })], ops = [{type: "start"}];
    function save(op) { ops.push(op); states.push(M.map(function (r) { return r.slice(); })); }
    function pivot(i) {
      var p = M[i][i];
      if (!p[0]) { save({type: "nopivot", row: i, col: i}); return; }
      M[i] = M[i].map(function (x) { return div(x, p); });
      save({type: "scale", row: i, col: i, by: p});
    }
    function clear(i, j, back) {
      if (!M[j][j][0] || M[j][j][0] !== M[j][j][1]) { save({type: "skip", row: i, src: j, col: j}); return; }
      var k = M[i][j];
      M[i] = M[i].map(function (x, c) { return sub(x, M[j][c], k); });
      save({type: "clear", row: i, src: j, col: j, k: k, back: back});
    }
    pivot(0); clear(1, 0); clear(2, 0); pivot(1); clear(2, 1); pivot(2);
    clear(1, 2, true); clear(0, 2, true); clear(0, 1, true);
    save({type: "done"});
    return {states: states, ops: ops};
  }
  function rowName(i) { return "R_" + (i + 1); }
  function opText(op, latex) {
    var arrow = latex ? "\\leftarrow " : "← ", minus = latex ? "-" : "−", R = function (i) { return latex ? "R_" + (i + 1) : rowName(i); };
    if (op.type === "scale") return R(op.row) + " " + arrow + R(op.row) + (latex ? "\\div " : " ÷ ") + (op.by[0] < 0 || op.by[1] !== 1 ? "(" + (latex ? tex(op.by) : txt(op.by)) + ")" : (latex ? tex(op.by) : txt(op.by)));
    if (op.type === "clear") {
      var k = op.k, neg = k[0] < 0, a = [Math.abs(k[0]), k[1]], coef = a[0] === 1 && a[1] === 1 ? "" : (latex ? tex(a) : txt(a));
      return R(op.row) + " " + arrow + R(op.row) + (neg ? " + " : " " + minus + " ") + coef + R(op.src);
    }
    return "";
  }
  // the answer read from the reduced matrix
  function answer(S, latex) {
    var f = latex ? tex : txt, sep = latex ? ",\\ " : ",  ", minus = latex ? "-" : " − ", plus = latex ? "+" : " + ";
    if (S[2][2][0]) return {kind: "one", text: NAMES.map(function (n, i) { return n + (latex ? "=" : " = ") + f(S[i][3]); }).join(sep)};
    if (S[2][3][0]) return {kind: "none", text: "0" + (latex ? "=" : " = ") + f(S[2][3]) + (latex ? "\\ (\\text{no solution})" : ": no solution")};
    var lin = function (i) {
      var cn = [-S[i][2][0], S[i][2][1]], a = [Math.abs(cn[0]), cn[1]];
      return NAMES[i] + (latex ? "=" : " = ") + f(S[i][3]) + (cn[0] ? (cn[0] < 0 ? minus : plus) + (a[0] === 1 && a[1] === 1 ? "" : f(a)) + "z" : "");
    };
    return {kind: "many", text: lin(0) + sep + lin(1) + sep + "z" + (latex ? "\\text{ free}" : " free")};
  }

  Viz.register("row-reduction-stepper", {
    title: "Row reduction, one step at a time",
    subject: "linear-algebra",
    shows: "Gaussian elimination one row operation at a time to reduced row echelon form",
    params: {
      k: {kind: "integer", default: 5, min: -2, max: 8, label: "k"},
      m: {kind: "integer", default: 20, min: 8, max: 26, label: "m"}
    },
    // captions hold in every branch: with k = 3 column 3 has no pivot, so steps 7-9 may find nothing to do
    steps: ["the augmented matrix", "first pivot to 1", "clear below it (row 2)", "clear below it (row 3)", "second pivot to 1", "clear below it (row 3)",
            "pivot in column 3, if any", "clear above pivot 3, if any (row 2)", "clear above pivot 3, if any (row 1)", "clear above pivot 2", "read the answer"],
    stepMs: 1500,
    formula: function (v) {
      var R = run(v), s = v.step || 1, op = R.ops[s - 1];
      if (op.type === "start") return "\\begin{cases}2x+2y+2z=12\\\\3x+5y+7z=34\\\\x+2y" + (v.k < 0 ? "" : "+") + v.k + "z=" + v.m + "\\end{cases}";
      if (op.type === "done") return answer(R.states[s - 1], true).text;
      if (op.type === "scale" || op.type === "clear") return opText(op, true);
      return op.type === "nopivot" ? "\\text{no pivot in column 3}" : "\\text{column 3 has no pivot: nothing to clear}";
    },
    status: function (v) {
      var R = run(v), s = v.step || 1, op = R.ops[s - 1], S = R.states[s - 1];
      // k decides whether column 3 gets a pivot (row 3 ends as 0 0 k-3 | m-14); m matters only when it does not
      if (op.type === "start") return v.k !== 3 ? "Each row is one equation, and k decides whether column 3 gets a pivot: k = " + v.k + " (anything but 3) gives one, so expect <b>one solution</b> whatever m is." :
        "Each row is one equation; k = 3 leaves column 3 without a pivot, so m decides consistency, and m = " + v.m + (v.m === 14 ? " gives <b>a line of solutions</b>." : " (anything but 14) gives <b>no solution</b>.");
      if (op.type === "scale") return "Divide row " + (op.row + 1) + " by " + txt(op.by) + " so the " + ORD[op.col] + " pivot becomes <b>1</b>.";
      if (op.type === "clear") return (op.k[0] < 0 ? "Add " + txt([-op.k[0], op.k[1]]) : "Subtract " + txt(op.k)) + " × row " + (op.src + 1) + (op.k[0] < 0 ? " to" : " from") + " row " + (op.row + 1) +
        " to make the entry " + (op.back ? "above" : "below") + " the " + ORD[op.col] + " pivot <b>0</b>.";
      if (op.type === "nopivot") return S[2][3][0] ? "Row 3 now reads 0 = " + txt(S[2][3]) + ", a contradiction: the system has <b>no solution</b>." : "Row 3 is all zeros: column 3 has no pivot, so <b>z is free</b>.";
      if (op.type === "skip") return S[2][3][0] ? "Column 3 has no pivot (row 3's only nonzero entry is right of the bar, not among the coefficients), so there is <b>nothing to clear</b>; move on." :
        "Row 3 is all zeros, so column 3 has no pivot and there is <b>nothing to clear</b> above it; move on.";
      var a = answer(S);
      return a.kind === "one" ? "Reduced row echelon form: each row now reads off one unknown, <b>" + a.text + "</b>." :
        a.kind === "none" ? "The last row says <b>" + a.text.split(":")[0] + "</b>, which no x, y, z can satisfy: no solution." : "Two pivots and a free column: <b>" + a.text + "</b>, a whole line of solutions.";
    },
    examples: [
      {name: "fractions (k = 6)", values: {k: 6, m: 21, step: 11}},
      {name: "a free variable (k = 3, m = 14)", values: {k: 3, m: 14, step: 11}},
      {name: "no solution (k = 3, m = 20)", values: {k: 3, m: 20, step: 7}}
    ],
    size: [400, 260],
    draw: function (api, v) {
      var c = api.color, R = run(v), s = v.step || 1, op = R.ops[s - 1], S = R.states[s - 1], prev = R.states[Math.max(0, s - 2)];
      var cw = 62, rh = 42, x0 = 82, y0 = 54, H = 3 * rh;
      // the operation, large, at the top
      var none = answer(S).kind === "none";
      var head = op.type === "start" ? "[A | b]" : op.type === "done" ? (none ? "row 3 says 0 = " + txt(S[2][3]) + ": inconsistent" : "reduced row echelon form") :
        op.type === "nopivot" ? "no pivot in column 3" : op.type === "skip" ? rowName(op.row) + " unchanged: column 3 has no pivot" : opText(op, false);
      api.label([api.w / 2, 22], head, {color: op.type === "nopivot" || op.type === "skip" || (op.type === "done" && none) ? c.c5 : c.c3, size: 16, weight: 650, anchor: "middle"});
      // rows: the one being changed (amber), the one used (teal)
      var tgt = op.row != null ? op.row : -1, src = op.src != null ? op.src : -1;
      if (op.type === "skip") { tgt = op.src; src = -1; }                       // mark the row with no pivot
      if (op.type === "done" && none) { tgt = 2; op = {type: "nopivot", row: 2, final: true}; } // the 0 = c row
      var L = x0 - 4, Rx = x0 + 4 * cw + 18, bandW = Rx - 5 - (x0 + 2); // bands sit inside the brackets
      if (tgt >= 0) api.rect(x0 + 2, y0 + tgt * rh + 2, bandW, rh - 4, {fill: op.type === "nopivot" || op.type === "skip" ? c.c5 : c.c3, fillOpacity: 0.16, rx: 8});
      if (src >= 0) api.rect(x0 + 2, y0 + src * rh + 2, bandW, rh - 4, {stroke: c.c1, width: 1.5, rx: 8});
      for (var i = 0; i < 3; i++) {
        api.label([x0 - 18, y0 + i * rh + rh / 2], rowName(i), {color: i === tgt ? (op.type === "nopivot" || op.type === "skip" ? c.c5 : c.c3) : i === src ? c.c1 : c.muted, size: 13, weight: 650, anchor: "end"});
        for (var j = 0; j < 4; j++) {
          var val = S[i][j], lead = j === i && val[0] === 1 && val[1] === 1 && s >= [2, 5, 7][i]; // a pivot already made
          var changed = i === tgt && (val[0] !== prev[i][j][0] || val[1] !== prev[i][j][1]);
          var cx = x0 + j * cw + cw / 2 + (j === 3 ? 10 : 0), cy = y0 + i * rh + rh / 2;
          if (lead) api.circle([cx, cy], 15, {fill: c.c1, fillOpacity: 0.22, stroke: c.c1, width: 1.2});
          api.label([cx, cy], txt(val), {color: changed ? c.c3 : val[0] ? c.ink : c.faint, size: 17, weight: changed || lead ? 700 : 500, anchor: "middle"});
        }
      }
      // brackets and the augmentation bar, drawn over the bands
      api.path("M " + (L + 7) + " " + y0 + " h -7 v " + H + " h 7", {stroke: c.ink, width: 1.6});
      api.path("M " + (Rx - 7) + " " + y0 + " h 7 v " + H + " h -7", {stroke: c.ink, width: 1.6});
      api.line([x0 + 3 * cw + 5, y0 + 6], [x0 + 3 * cw + 5, y0 + H - 6], {color: c.muted, width: 1.2, dash: "3 3"});
      // what the changed row was, and the stage of the algorithm
      if (op.type === "scale" || op.type === "clear") {
        api.label([api.w / 2, y0 + H + 22], "row " + (tgt + 1) + " was  " + prev[tgt].slice(0, 3).map(txt).join("   ") + "  |  " + txt(prev[tgt][3]), {color: c.muted, size: 12.5, anchor: "middle"});
      }
      var stage = s === 1 ? "start" : s <= 7 ? "forward pass: zeros below each pivot" : s <= 10 ? "backward pass: zeros above each pivot" : "";
      if (op.type === "done" || op.final) {
        var a = answer(S);
        api.label([api.w / 2, y0 + H + 26], a.text, {color: a.kind === "none" ? c.c5 : c.c3, size: 15, weight: 700, anchor: "middle"});
      } else if (stage) api.label([api.w / 2, api.h - 16], stage, {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
