// Google Ad Manager (GPT) setup.
// In-page slots are any element with data-ad="top|card|content"; the interstitial
// and bottom anchor are out-of-page formats that GPT positions itself.
// The page loader stays up until the top ad has loaded or come back empty.

window.googletag = window.googletag || { cmd: [] };

const AD_UNITS = {
  top:     { path: '/21753324030/punjigyan.com_300x600_1', sizes: [[300, 600]] },
  card:    { path: '/21753324030/punjigyan.com_300x250_1', sizes: [[300, 250]] },
  content: { path: '/21753324030/punjigyan.com_300x250_2', sizes: [[300, 250]] },
};
const INTERSTITIAL_UNIT = '/21753324030/punjigyan.com_1x1_1';
const ANCHOR_UNIT = '/21753324030/punjigyan.com_1x1_2';

// Never keep visitors waiting longer than this, e.g. on slow networks.
const LOADER_MAX_WAIT_MS = 4000;

/* ---------- loader ---------- */

const loader = document.querySelector('.page-loader');

function revealPage() {
  if (!loader || loader.classList.contains('done')) return;
  loader.classList.add('done');
  loader.addEventListener('transitionend', () => loader.remove(), { once: true });
}

setTimeout(revealPage, LOADER_MAX_WAIT_MS);
if (!document.querySelector('[data-ad="top"]')) revealPage();

/* ---------- load GPT ---------- */

// Loaded from here (not a static tag) so an ad blocker or network failure reveals the page at once.
const gpt = document.createElement('script');
gpt.async = true;
gpt.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
gpt.crossOrigin = 'anonymous';
gpt.onerror = revealPage;
document.head.appendChild(gpt);

/* ---------- slots ---------- */

googletag.cmd.push(() => {
  const pubads = googletag.pubads();
  const { OutOfPageFormat } = googletag.enums;

  // Out-of-page formats return null when the page/device isn't eligible, so check before using.
  const interstitial = googletag.defineOutOfPageSlot(INTERSTITIAL_UNIT, OutOfPageFormat.INTERSTITIAL);
  if (interstitial) interstitial.addService(pubads);

  // No anchor on the details page: it would sit on top of the sticky "Save details" bar
  // and invite accidental ad clicks.
  const anchor = document.body.dataset.page === 'details'
    ? null
    : googletag.defineOutOfPageSlot(ANCHOR_UNIT, OutOfPageFormat.BOTTOM_ANCHOR);
  if (anchor) anchor.addService(pubads);

  let topSlot = null;
  const inPage = [];
  document.querySelectorAll('[data-ad]').forEach((el, i) => {
    const unit = AD_UNITS[el.dataset.ad];
    if (!unit) return;
    el.id = el.id || `gpt-${el.dataset.ad}-${i}`;
    const slot = googletag.defineSlot(unit.path, unit.sizes, el.id);
    if (!slot) return;
    slot.addService(pubads);
    inPage.push(el.id);
    if (el.dataset.ad === 'top') topSlot = slot;
  });
  if (!topSlot) revealPage();

  // Filled: wait for the creative's own load event. Unfilled: reveal as soon as GPT knows.
  pubads.addEventListener('slotOnload', e => { if (e.slot === topSlot) revealPage(); });
  pubads.addEventListener('slotRenderEnded', e => { if (e.slot === topSlot && e.isEmpty) revealPage(); });

  pubads.enableSingleRequest();
  // Fetch slots shortly before they scroll into view: better viewability, fewer wasted impressions.
  pubads.enableLazyLoad({ fetchMarginPercent: 200, renderMarginPercent: 100, mobileScaling: 2.0 });
  pubads.collapseEmptyDivs();
  googletag.enableServices();

  inPage.forEach(id => googletag.display(id));
  if (interstitial) googletag.display(interstitial);
  if (anchor) googletag.display(anchor);
});
