/* Small helpers shared by the calculator pages. */
(function(){
  const $ = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const pct = (n, d=0) => (n*100).toFixed(d) + '%';
  function mount(cfg){
    const form = document.getElementById('inputs'), out = document.getElementById('results');
    let html = '';
    for (const f of cfg.fields){
      if (f.group){ html += `<div class="group">${f.group}</div>`; continue; }
      const id = 'f_' + f.id;
      if (f.options) html += `<div class="field"><label for="${id}">${f.label}</label><select id="${id}">` +
        f.options.map(o => `<option value="${o[0]}"${o[0]===f.value?' selected':''}>${o[1]}</option>`).join('') + `</select></div>`;
      else html += `<div class="field"><label for="${id}">${f.label}</label><input id="${id}" type="number" inputmode="decimal" min="${f.min??0}" ${f.max!=null?`max="${f.max}"`:''} step="${f.step||'any'}" value="${f.pct? +(f.value*100).toFixed(4) : f.value}"></div>`;
    }
    form.innerHTML = html;
    const read = () => { const v = {}; for (const f of cfg.fields){ if (f.group) continue;
      const el = document.getElementById('f_' + f.id); let x = f.options ? el.value : parseFloat(el.value);
      if (!f.options){ if (!isFinite(x) || x < 0) x = 0; if (f.max!=null && x > f.max) x = f.max; if (f.pct) x = x/100; if (f.int) x = Math.floor(x); }
      v[f.id] = x; } return v; };
    const run = () => { out.innerHTML = cfg.render(cfg.compute(read())); };
    form.addEventListener('input', run); run();
  }
  const tile = (label, value, cap, cls='') => `<div class="tile ${cls}"><div class="l">${label}</div><div class="v">${value}</div><div class="c">${cap||''}</div></div>`;
  const rows = (list) => '<table class="rows">' + list.map(r => `<tr${r[2]?' class="sum"':''}><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('') + '</table>';
  const bars = (list) => { const m = Math.max(1, ...list.map(b => Math.abs(b[1])));
    return list.map(b => `<div class="note">${b[0]}: <b>${$(b[1])}</b></div><div class="bar ${b[2]||''}" style="width:${Math.max(2, Math.abs(b[1])/m*100)}%"></div>`).join(''); };
  window.DMUI = { $, pct, mount, tile, rows, bars };
})();
