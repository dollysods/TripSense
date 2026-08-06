/**
 * Headless QA for v1.1c: the async cityPairs.json fetch (App.tsx) and
 * the 64-city dataset/autocomplete. Run against the PRODUCTION preview
 * server (not the dev server) since the fetch path and public/ asset
 * serving must be verified as they'll actually behave in prod:
 *   npx vite preview --port 5174 &   then   node scripts/qa-v11c.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.QA_URL ?? 'http://localhost:5174';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath:
    process.env.QA_CHROMIUM ??
    '/home/gilli/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const pickCity = async (nth, text) => {
  const combo = page.getByRole('combobox').nth(nth);
  await combo.click();
  await combo.pressSequentially(text, { delay: 20 });
  await page.keyboard.press('Enter');
};
const legRowText = (i) => page.locator('.ml-10', { hasText: '│' }).nth(i).textContent();

await page.goto(URL, { waitUntil: 'domcontentloaded' });

// The loading message should appear before the data resolves -- race
// is real but brief on localhost, so just check the eventual state.
const combo = page.getByRole('combobox').first();
await combo.waitFor({ timeout: 5000 });
check('itinerary builder renders once data loads', true);

// Direct fetch check of the runtime data endpoint (not bundled).
const dataResp = await page.evaluate(() => fetch('/data/cityPairs.json').then((r) => r.status));
check('cityPairs.json served from public/data at runtime', dataResp === 200, `HTTP ${dataResp}`);

// D4: 64-entry autocomplete -- spot-check a Tier 2 city resolves and
// its country label is correct (regression check for the COUNTRY_NAMES
// gaps found during Wave 1/Tier 2 additions).
await pickCity(0, 'Bucharest');
const bucharestOption = await page.getByText('Bucharest, Romania').count();
check('new Tier 2 city resolves with correct country name', bucharestOption > 0, `found ${bucharestOption}`);

await pickCity(1, 'Zagreb');
const zagrebOption = await page.getByText('Zagreb, Croatia').count();
check('second Tier 2 city resolves', zagrebOption > 0);

// A well-evidenced new-Tier-2-city pair should price normally (Graz is
// new in v1.1c, Vienna-Graz is a real 15-sample Railjet route -- unlike
// Bucharest-Zagreb, a 1-sample 31h claim the reliability guard
// correctly nulls, so it isn't a fair "does pricing work" test case).
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.getByRole('combobox').first().waitFor({ timeout: 5000 });
await pickCity(0, 'Vienna');
await pickCity(1, 'Graz');
const leg = (await legRowText(0)) ?? '';
check('new Tier2 city pair prices normally', /≈ \d+h/.test(leg), leg.slice(0, 80));

// D3 bug-fix regression: Paris<->new French cities must have real data
// (the multiTerminus routing-table gap that silently skipped these).
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.getByRole('combobox').first().waitFor({ timeout: 5000 });
await pickCity(0, 'Paris');
await pickCity(1, 'Marseille');
const parisLeg = (await legRowText(0)) ?? '';
check('Paris-Marseille has real data (routing-table fix)', /≈ \d+h/.test(parisLeg) && !/no train data/.test(parisLeg), parisLeg.slice(0, 80));

// Sea-crossing short-hop fix: Liverpool-Dublin must have a plane option
// (the <300km floor previously nulled the only viable mode for this pair).
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.getByRole('combobox').first().waitFor({ timeout: 5000 });
await pickCity(0, 'Liverpool');
await pickCity(1, 'Dublin');
const disabledModes = await page.locator('[role="radio"][disabled]').count();
check('Liverpool-Dublin has a usable mode (not all disabled)', disabledModes < 4, `${disabledModes}/4 disabled`);
const planeBtn = page.getByRole('radio', { name: /plane/i });
check('Liverpool-Dublin plane option enabled', !(await planeBtn.isDisabled()));

check('no page errors', errors.length === 0, errors.join('; '));

await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
