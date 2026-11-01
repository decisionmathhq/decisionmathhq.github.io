/* Decision Math calculator math.
   Every formula mirrors the matching Google Sheets / xlsx viewer calculator cell for cell,
   and is tested against those sheets (recalculated in LibreOffice) before publishing.
   Tax figures: IRS Rev. Proc. 2025-32 (tax year 2026 brackets, standard deduction, health FSA limit,
   capital gain breakpoints); IRS Rev. Proc. 2026-24 (2027 HSA limits); IRS IR-2025-111 (2026 401(k) limits);
   SSA 2026 fact sheet (Social Security wage base). Update each year. */
(function (root) {
  const D = {
    year: 2026,
    rates: [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37],
    over: { single: [0, 12400, 50400, 105700, 201775, 256225, 640600],
            mfj:    [0, 24800, 100800, 211400, 403550, 512450, 768700] },
    sd: { single: 16100, mfj: 32200 },
    ss: 0.062, medicare: 0.0145, ssWageBase: 184500,
    hsaSelf: 4500, hsaFamily: 9000, hsaCatchUp55: 1000,       // 2027
    fsa: 3400,                                                 // 2026 (2027 not yet published)
    k401: 24500, k401CatchUp50: 8000, k401CatchUp6063: 11250, rothCatchUpWages: 150000, // 2026
    cgBreaks: { single: [49450, 545500], mfj: [98900, 613700] }, lossLimit: 3000,
  };
  const pos = x => Math.max(0, x);
  // Tax on taxable income: same as the sheets' SUMPRODUCT over rate steps.
  function tax(ti, st) {
    const o = D.over[st]; let t = 0;
    for (let i = 0; i < o.length; i++) if (ti > o[i]) t += (ti - o[i]) * (D.rates[i] - (i ? D.rates[i - 1] : 0));
    return t;
  }
  // Bracket: the sheets' LOOKUP (last threshold <= taxable income).
  function bracket(ti, st) { const o = D.over[st]; let r = D.rates[0]; for (let i = 0; i < o.length; i++) if (o[i] <= ti) r = D.rates[i]; return r; }
  const payroll = wages => D.medicare + (wages <= D.ssWageBase ? D.ss : 0);
  const fv = (amt, r, n) => r === 0 ? amt * n : amt * (Math.pow(1 + r, n) - 1) / r;

  // ---- Video 1: HSA vs FSA (hsa-vs-fsa-calculator) ----
  function hsaFsa(i) {
    const r = {};
    r.taxable = pos(i.salary - D.sd[i.status]);
    r.bracket = bracket(r.taxable, i.status);
    r.fedSaved = tax(r.taxable, i.status) - tax(pos(r.taxable - i.amount), i.status);
    r.payrollSaved = i.amount * payroll(i.salary);
    r.savedPayroll = r.fedSaved + r.payrollSaved;
    r.savedOwn = r.fedSaved;
    r.hsaLimit = (i.coverage === 'family' ? D.hsaFamily : D.hsaSelf) + (i.age55 ? D.hsaCatchUp55 : 0);
    r.fsaLimit = D.fsa;
    r.unused = pos(i.amount - i.fsaSpend);
    r.lost = pos(r.unused - i.carryover);
    r.fsaNet = r.savedPayroll - r.lost;
    r.leftover = pos(Math.min(i.hsaYearly, r.hsaLimit) - i.expected);
    r.hsaGrown = fv(r.leftover, i.ret, i.years);
    r.hsaReceipts = fv(Math.min(i.hsaYearly, r.hsaLimit), i.ret, i.years);
    r.limitCheck = (i.amount > r.hsaLimit || i.hsaYearly > r.hsaLimit) ? 'Over the HSA limit'
                 : i.amount > r.fsaLimit ? 'Over the FSA limit' : 'Within both limits';
    return r;
  }

  // ---- Video 2: HDHP (HSA plan) vs PPO, family coverage (hdhp-vs-ppo-calculator) ----
  function hdhpPpo(i) {
    const r = {}, oop = (p) => Math.min(p.oopMax, i.costs <= p.ded ? i.costs : p.ded + p.coins * (i.costs - p.ded));
    const pr = payroll(i.wages);
    r.taxable = pos(i.wages - D.sd[i.status]);
    r.bracket = bracket(r.taxable, i.status);
    r.hsaLimit = D.hsaFamily + (i.age55 ? D.hsaCatchUp55 : 0);
    r.ppoOop = oop(i.ppo); r.ppoTotal = i.ppo.premium + r.ppoOop;
    r.hsaOop = oop(i.hsa); r.hsaGross = i.hsa.premium + r.hsaOop;
    r.employer = Math.min(i.employer, r.hsaLimit);
    r.own = pos(Math.min(r.hsaOop - i.employer, r.hsaLimit - i.employer));
    r.taxSaved = tax(r.taxable, i.status) - tax(pos(r.taxable - r.own), i.status) + r.own * pr;
    r.hsaTotal = r.hsaGross - r.employer - r.taxSaved;
    r.diff = r.ppoTotal - r.hsaTotal;                       // >= 0: HSA plan saves
    const ownHeavy = pos(Math.min(i.hsa.oopMax - i.employer, r.hsaLimit - i.employer));
    r.taxSavedHeavy = tax(r.taxable, i.status) - tax(pos(r.taxable - ownHeavy), i.status) + ownHeavy * pr;
    r.ppoHeavy = i.ppo.premium + i.ppo.oopMax;
    r.hsaHeavy = i.hsa.premium + i.hsa.oopMax - r.employer - r.taxSavedHeavy;
    r.diffHeavy = r.ppoHeavy - r.hsaHeavy;
    return r;
  }

  // ---- Video 3: 401(k) year-end (401k-year-end-calculator) ----
  function k401(i) {
    const r = {};
    r.perCheck = i.salary / i.checks;
    r.limit = D.k401 + (i.age === 'under50' ? 0 : i.age === '60to63' ? D.k401CatchUp6063 : D.k401CatchUp50);
    r.soFar = Math.min(r.limit, i.rate * r.perCheck * (i.checks - i.left));
    r.room = pos(r.limit - r.soFar);
    r.needed = i.left > 0 ? r.room / i.left : 0;
    r.maxPerCheck = Math.min(i.newRate, i.planMax) * r.perCheck;
    r.canReach = r.maxPerCheck * i.left >= r.room;
    r.extra = pos(Math.min(r.room, r.maxPerCheck * i.left) - Math.min(r.room, i.rate * r.perCheck * i.left));
    r.taxable = pos(i.salary - D.sd[i.status] - Math.min(r.limit, i.rate * i.salary));
    r.bracket = bracket(r.taxable, i.status);
    r.taxSaved = tax(r.taxable, i.status) - tax(pos(r.taxable - r.extra), i.status);
    r.shrink = i.left > 0 ? (r.extra - r.taxSaved) / i.left : 0;
    r.costPerDollar = r.extra > 0 ? (r.extra - r.taxSaved) / r.extra : 0;
    r.extraMatch = i.match * r.perCheck * i.left * pos(Math.min(i.matchCap, Math.min(i.newRate, i.planMax)) - Math.min(i.matchCap, i.rate));
    r.missedMatch = i.match * r.perCheck * (i.checks - i.left) * pos(i.matchCap - i.rate);
    r.trueUpBack = i.trueUp ? r.missedMatch : 0;
    r.belowMatch = i.rate < i.matchCap;
    r.rothWarning = i.age !== 'under50' && i.salary > D.rothCatchUpWages && r.extra > 0;
    return r;
  }

  // ---- Video 4: tax-loss harvesting (port of v04_tax_loss_harvest.py total_tax) ----
  function totalTax(wages, netSt, netLt, st) {
    const sd = D.sd[st]; let s = netSt, l = netLt;
    if (s < 0 && 0 < l) { const u = Math.min(-s, l); s += u; l -= u; }
    else if (l < 0 && 0 < s) { const u = Math.min(-l, s); l += u; s -= u; }
    const net = s + l;
    if (net < 0) {
      const ded = Math.min(-net, D.lossLimit), stLoss = -Math.min(s, 0), ltLoss = -Math.min(l, 0);
      const fromSt = Math.min(stLoss, ded);
      return { tax: tax(pos(wages - sd - ded), st), ded, carrySt: stLoss - fromSt, carryLt: ltLoss - (ded - fromSt) };
    }
    const ltcg = pos(l), ord = pos(wages + pos(s) - sd), taxable = ord + ltcg, [z, f] = D.cgBreaks[st];
    const at0 = pos(Math.min(taxable, z) - ord), at15 = pos(Math.min(taxable, f) - Math.max(ord, z)), at20 = ltcg - at0 - at15;
    return { tax: tax(ord, st) + 0.15 * at15 + 0.20 * at20, ded: 0, carrySt: 0, carryLt: 0 };
  }
  function tlh(i) {
    const base = totalTax(i.wages, i.otherSt, i.otherLt, i.status);
    const w = totalTax(i.wages, i.otherSt - i.lossSt, i.otherLt - i.lossLt, i.status);
    const r = { taxWithout: base.tax, taxWith: w.tax, saved: base.tax - w.tax, deducted: w.ded,
                carry: w.carrySt + w.carryLt, years: [] };
    // Later years: carryover against the same wages and no other gains (today's law as a proxy).
    let cs = w.carrySt, cl = w.carryLt, n = 0;
    const b2 = totalTax(i.wages, 0, 0, i.status).tax;
    while ((cs + cl) > 0 && n < 40) {
      const t = totalTax(i.wages, -cs, -cl, i.status);
      r.years.push(b2 - t.tax); cs = t.carrySt; cl = t.carryLt; n++;
    }
    r.laterSaved = r.years.reduce((a, b) => a + b, 0);
    r.harvested = i.lossSt + i.lossLt;
    r.futureTax = [0, 0.15, 0.20].map(x => r.harvested * x);
    return r;
  }

  const api = { D, tax, bracket, payroll, fv, hsaFsa, hdhpPpo, k401, totalTax, tlh };
  if (typeof module !== 'undefined') module.exports = api; else root.DM = api;
})(this);
