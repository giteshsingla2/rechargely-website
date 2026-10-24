// Site-wide settings. Change these in one place.
const SITE = {
  brand: 'Rechargely',
  appName: 'Rechargely app',
  playStoreUrl: '#', // TODO: real Google Play link
  appStoreUrl: '#',  // TODO: real App Store link
};

const OPERATORS = {
  jio:    { name: 'Jio',    full: 'Jio Prepaid',    mark: 'Jio', page: '/best-jio-recharge-plans' },
  airtel: { name: 'Airtel', full: 'Airtel Prepaid', mark: 'A',   page: '/best-airtel-recharge-plans' },
  vi:     { name: 'Vi',     full: 'Vi Prepaid',     mark: 'Vi',  page: '/best-vi-recharge-plans' },
  bsnl:   { name: 'BSNL',   full: 'BSNL Prepaid',   mark: 'B',   page: '/best-bsnl-recharge-plans' },
};

const CATEGORIES = [
  { id: 'popular',   label: 'Popular' },
  { id: 'unlimited', label: 'Unlimited' },
  { id: 'data',      label: 'Data packs' },
  { id: 'annual',    label: 'Long validity' },
  { id: 'ott',       label: 'OTT' },
];

// SAMPLE PLANS — illustrative only. Operators change prices often:
// replace with verified plans (or an API feed) before launch.
const PLANS = [
  // Jio
  { id: 'jio-299',  op: 'jio', price: 299,  days: 28,  data: '1.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['popular', 'unlimited'] },
  { id: 'jio-349',  op: 'jio', price: 349,  days: 28,  data: '2 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['popular', 'unlimited'], badge: 'Most popular', perks: ['Unlimited 5G on eligible devices'] },
  { id: 'jio-449',  op: 'jio', price: 449,  days: 28,  data: '3 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['unlimited'], perks: ['Unlimited 5G on eligible devices'] },
  { id: 'jio-799',  op: 'jio', price: 799,  days: 84,  data: '1.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['popular', 'unlimited', 'annual'], badge: 'Best value' },
  { id: 'jio-1029', op: 'jio', price: 1029, days: 84,  data: '2 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['ott'], perks: ['Amazon Prime Lite included'] },
  { id: 'jio-3599', op: 'jio', price: 3599, days: 365, data: '2.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['annual'], perks: ['Lowest cost per day'] },
  { id: 'jio-19',   op: 'jio', price: 19,   days: null, validity: 'Active plan', data: '1 GB',     calls: '—', sms: '—', cats: ['data'] },
  { id: 'jio-69',   op: 'jio', price: 69,   days: 7,   data: '6 GB',       calls: '—', sms: '—', cats: ['data'] },

  // Airtel
  { id: 'airtel-299',  op: 'airtel', price: 299,  days: 28,  data: '1 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['unlimited'] },
  { id: 'airtel-349',  op: 'airtel', price: 349,  days: 28,  data: '1.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['popular', 'unlimited'], badge: 'Most popular' },
  { id: 'airtel-379',  op: 'airtel', price: 379,  days: 30,  data: '2 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['popular', 'unlimited'], perks: ['Unlimited 5G on eligible devices'] },
  { id: 'airtel-859',  op: 'airtel', price: 859,  days: 84,  data: '1.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['popular', 'annual'], badge: 'Best value' },
  { id: 'airtel-598',  op: 'airtel', price: 598,  days: 28,  data: '2 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['ott'], perks: ['Streaming bundle included'] },
  { id: 'airtel-3599', op: 'airtel', price: 3599, days: 365, data: '2 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['annual'] },
  { id: 'airtel-22',   op: 'airtel', price: 22,   days: 1,   data: '1 GB',       calls: '—', sms: '—', cats: ['data'] },
  { id: 'airtel-77',   op: 'airtel', price: 77,   days: 7,   data: '5 GB',       calls: '—', sms: '—', cats: ['data'] },

  // Vi
  { id: 'vi-299',  op: 'vi', price: 299,  days: 28,  data: '1 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['unlimited'] },
  { id: 'vi-349',  op: 'vi', price: 349,  days: 28,  data: '1.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['popular', 'unlimited'], badge: 'Most popular', perks: ['Binge All Night data'] },
  { id: 'vi-409',  op: 'vi', price: 409,  days: 28,  data: '2.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['unlimited'], perks: ['Weekend data rollover'] },
  { id: 'vi-859',  op: 'vi', price: 859,  days: 84,  data: '1.5 GB/day', calls: 'Unlimited', sms: '100/day', cats: ['popular', 'annual'], badge: 'Best value' },
  { id: 'vi-3599', op: 'vi', price: 3599, days: 365, data: '2 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['annual'] },
  { id: 'vi-22',   op: 'vi', price: 22,   days: 1,   data: '1 GB',       calls: '—', sms: '—', cats: ['data'] },

  // BSNL
  { id: 'bsnl-107',  op: 'bsnl', price: 107,  days: 35,  data: '3 GB',       calls: '200 min',   sms: '—',       cats: ['popular'] },
  { id: 'bsnl-199',  op: 'bsnl', price: 199,  days: 30,  data: '2 GB/day',   calls: 'Unlimited', sms: '100/day', cats: ['popular', 'unlimited'], badge: 'Most popular' },
  { id: 'bsnl-397',  op: 'bsnl', price: 397,  days: 150, data: '2 GB/day*',  calls: 'Unlimited*', sms: '100/day*', cats: ['popular', 'annual'], badge: 'Best value', perks: ['*Benefits for first 30 days, validity for 150 days'] },
  { id: 'bsnl-1999', op: 'bsnl', price: 1999, days: 365, data: '600 GB',     calls: 'Unlimited', sms: '100/day', cats: ['annual'] },
  { id: 'bsnl-58',   op: 'bsnl', price: 58,   days: 7,   data: '2 GB/day',   calls: '—', sms: '—', cats: ['data'] },
];

function plansFor(op) {
  return PLANS.filter(p => p.op === op);
}

function findPlan(id) {
  return PLANS.find(p => p.id === id);
}

function perDay(plan) {
  return plan.days ? plan.price / plan.days : null;
}
