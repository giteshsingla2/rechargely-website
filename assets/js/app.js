const STORAGE_KEY = 'rechargeRequest';

const rupees = n => '₹' + n.toLocaleString('en-IN');
const rupeesPerDay = n => '₹' + n.toFixed(2);
const validityText = p => p.days ? `${p.days} days` : p.validity;

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ---------- Home: comparison table ---------- */

function cheapest(op, minDays, maxDays) {
  return plansFor(op)
    .filter(p => p.cats.includes('unlimited') || p.cats.includes('annual') || p.cats.includes('popular'))
    .filter(p => p.calls.startsWith('Unlimited') && p.days >= minDays && p.days <= maxDays)
    .sort((a, b) => a.price - b.price)[0];
}

function renderCompareTable(mount) {
  const cols = [
    { label: 'Monthly', min: 28, max: 31 },
    { label: '84 days', min: 84, max: 90 },
    { label: 'Annual', min: 300, max: 366 },
  ];
  const rows = Object.keys(OPERATORS).map(op => ({ op, picks: cols.map(c => cheapest(op, c.min, c.max)) }));
  // Lowest price per day in each column gets highlighted.
  const best = cols.map((_, i) => Math.min(...rows.map(r => r.picks[i] ? perDay(r.picks[i]) : Infinity)));

  const cell = (p, i) => {
    if (!p) return '<td class="muted">—</td>';
    const cls = perDay(p) === best[i] ? ' class="best"' : '';
    return `<td${cls}><strong>${rupees(p.price)}</strong><span>${p.data}</span><span>${rupeesPerDay(perDay(p))}/day</span></td>`;
  };

  mount.innerHTML = `
    <div class="table-scroll compare">
      <table>
        <thead><tr><th>Operator</th>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr><td><a href="${OPERATORS[r.op].page}"><strong>${OPERATORS[r.op].name}</strong></a></td>${r.picks.map(cell).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ---------- Operator page: plan list ---------- */

function planCard(p) {
  const pd = perDay(p);
  const badge = p.badge ? `<span class="tag${p.badge === 'Most popular' ? ' hot' : ''}">${p.badge}</span>` : '';
  const perks = p.perks?.length ? `<ul class="perks">${p.perks.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
  return `
    <article class="plan${p.badge ? ' is-featured' : ''}">
      ${badge}
      <div class="plan-top">
        <div class="price">${rupees(p.price)}</div>
        ${pd ? `<div class="per-day">${rupeesPerDay(pd)}/day</div>` : ''}
      </div>
      <div class="plan-specs">
        <div class="spec"><span>Validity</span><strong>${validityText(p)}</strong></div>
        <div class="spec"><span>Data</span><strong>${p.data}</strong></div>
        <div class="spec"><span>Calls</span><strong>${p.calls}</strong></div>
      </div>
      ${perks}
      <div class="plan-foot">
        <span class="sms">SMS: ${p.sms}</span>
        <a class="btn" href="/before-you-recharge-checklist?plan=${p.id}">Select</a>
      </div>
    </article>`;
}

function renderPlans(op) {
  const tabsEl = document.getElementById('plan-tabs');
  const listEl = document.getElementById('plan-list');
  const all = plansFor(op);
  const cats = CATEGORIES.filter(c => all.some(p => p.cats.includes(c.id)));

  tabsEl.innerHTML = cats.map(c =>
    `<button class="tab" role="tab" data-cat="${c.id}" aria-selected="false">${c.label}</button>`
  ).join('');

  function show(cat) {
    tabsEl.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.cat === cat)));
    const list = all.filter(p => p.cats.includes(cat)).sort((a, b) => a.price - b.price);
    listEl.innerHTML = list.length ? list.map(planCard).join('') : '<p class="empty">No plans in this category yet.</p>';
  }

  tabsEl.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (tab) show(tab.dataset.cat);
  });
  show(cats[0].id);
}

/* ---------- Details form ---------- */

const VALIDATORS = {
  name:   v => v.trim().length >= 2,
  mobile: v => /^[6-9]\d{9}$/.test(v),
  pin:    v => /^[1-9]\d{5}$/.test(v),
  city:   v => v.trim().length >= 2,
};

function setFieldState(input, showErrors) {
  const field = input.closest('.field');
  const ok = VALIDATORS[input.name](input.value);
  field.classList.toggle('valid', ok);
  field.classList.toggle('invalid', !ok && showErrors);
  return ok;
}

async function lookupCity(pin, cityInput) {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const [data] = await res.json();
    const po = data?.Status === 'Success' && data.PostOffice?.[0];
    if (po && !cityInput.dataset.edited) {
      cityInput.value = po.District;
      setFieldState(cityInput, false);
    }
  } catch {
    // Lookup is a convenience; the user can type the city.
  }
}

function initDetails() {
  const plan = findPlan(new URLSearchParams(location.search).get('plan'));
  if (!plan) { location.replace('/'); return; }
  const op = OPERATORS[plan.op];

  document.getElementById('back').href = op.page;
  document.getElementById('summary').innerHTML = `
    <div class="summary op-${plan.op}">
      <div class="op-badge">${op.mark}</div>
      <div>
        <div class="price">${rupees(plan.price)}</div>
        <p>${op.name} · ${validityText(plan)} · ${plan.data}</p>
      </div>
      <a class="edit" href="${op.page}">Change</a>
    </div>`;
  document.getElementById('cta-price').textContent = rupees(plan.price);
  document.querySelectorAll('[data-op-name]').forEach(n => { n.textContent = op.name; });
  document.querySelectorAll('[data-plan-price]').forEach(n => { n.textContent = rupees(plan.price); });

  const form = document.getElementById('details-form');
  const inputs = [...form.querySelectorAll('.input')];
  const consent = form.querySelector('#consent');
  const city = form.elements.city;

  inputs.forEach(input => {
    input.addEventListener('input', () => {
      if (input.inputMode === 'numeric') input.value = input.value.replace(/\D/g, '');
      if (input === city) city.dataset.edited = '1';
      setFieldState(input, input.closest('.field').classList.contains('invalid'));
      if (input.name === 'pin' && VALIDATORS.pin(input.value)) lookupCity(input.value, city);
    });
    input.addEventListener('blur', () => input.value && setFieldState(input, true));
  });
  consent.addEventListener('change', () => consent.closest('.check').classList.remove('invalid'));

  const submitBtn = form.querySelector('[type="submit"]');
  const formError = document.getElementById('form-error');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const allValid = inputs.map(i => setFieldState(i, true)).every(Boolean);
    consent.closest('.check').classList.toggle('invalid', !consent.checked);
    if (!allValid || !consent.checked) {
      (inputs.find(i => !VALIDATORS[i.name](i.value)) || consent).focus();
      return;
    }
    const request = {
      plan: plan.id,
      name: form.elements.name.value.trim(),
      mobile: form.elements.mobile.value,
      pin: form.elements.pin.value,
      city: city.value.trim(),
      consent: consent.checked,
      website: form.elements.website.value, // honeypot
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    formError.hidden = true;
    try {
      const res = await fetch('/api/recharge-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Show field errors from the server next to the matching inputs.
        for (const name of Object.keys(data.fields || {})) {
          form.elements[name]?.closest('.field')?.classList.add('invalid');
        }
        throw new Error(data.error || 'Could not save your details.');
      }
      delete request.website;
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...request, id: data.id })); } catch {}
      location.href = '/recharge-details-saved';
    } catch (err) {
      formError.textContent = err.message === 'Failed to fetch'
        ? 'No connection. Check your internet and try again.'
        : err.message;
      formError.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save details';
    }
  });
}

/* ---------- Success ---------- */

function initSuccess() {
  let req = null;
  try { req = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch {}
  const plan = req && findPlan(req.plan);

  document.querySelectorAll('[data-play]').forEach(a => { a.href = SITE.playStoreUrl; });
  document.querySelectorAll('[data-appstore]').forEach(a => { a.href = SITE.appStoreUrl; });

  const box = document.getElementById('saved-details');
  if (!plan) { box.hidden = true; return; }

  const op = OPERATORS[plan.op];
  const masked = req.mobile.slice(0, 2) + '••••••' + req.mobile.slice(-2);
  const rows = [
    ['Operator', op.name],
    ['Plan', `${rupees(plan.price)} · ${validityText(plan)}`],
    ['Data', plan.data],
    ['Name', req.name],
    ['Mobile', '+91 ' + masked],
    ['City', req.city],
  ];
  const dl = box.querySelector('dl');
  rows.forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  });
}

/* ---------- Boot ---------- */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-brand]').forEach(n => { n.textContent = SITE.brand; });
  document.querySelectorAll('[data-year]').forEach(n => { n.textContent = new Date().getFullYear(); });

  const page = document.body.dataset.page;
  if (page === 'home') renderCompareTable(document.getElementById('compare'));
  if (page === 'operator') renderPlans(document.body.dataset.op);
  if (page === 'details') initDetails();
  if (page === 'success') initSuccess();
});
