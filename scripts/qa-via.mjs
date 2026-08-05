/**
 * One-off headless QA for the v1.1a via-routing feature against the dev
 * server. Not part of CI (needs a running server); run manually:
 *   npx vite --port 5173 &   then   node scripts/qa-via.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.QA_URL ?? 'http://localhost:5173';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Reuse the already-cached chromium build rather than downloading the
// exact-match revision this playwright version pins.
const browser = await chromium.launch({
  executablePath:
    process.env.QA_CHROMIUM ??
    '/home/gilli/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle' });

const pickCity = async (nth, text) => {
  const combo = page.getByRole('combobox').nth(nth);
  await combo.click();
  await combo.pressSequentially(text, { delay: 20 });
  await page.keyboard.press('Enter');
};

// --- Scenario 1: all-null pair Dublin -> Lugano offers a via routing ---
await pickCity(0, 'Dublin');
await pickCity(1, 'Lugano');
const viaBtn = page.getByRole('button', { name: /route via/i });
await viaBtn.waitFor({ timeout: 5000 }).catch(() => {});
const viaBtnText = (await viaBtn.count()) ? await viaBtn.textContent() : null;
check('via suggestion appears for Dublin→Lugano', !!viaBtnText, viaBtnText ?? 'no button');

// All four mode buttons should be disabled for this pair.
const disabledModes = await page.locator('[role="radio"][disabled]').count();
check('all 4 mode buttons disabled', disabledModes === 4, `${disabledModes} disabled`);

// The via chip is identified by its clear button; the leg row is the
// .ml-10 container (footer also contains the word "via", so text
// matching must stay scoped).
const viaChip = () => page.getByRole('button', { name: /remove via routing/i });
const legRowText = () => page.locator('.ml-10').first().textContent();

// --- Scenario 2: accepting the suggestion prices the leg ---
if (viaBtnText) {
  await viaBtn.click();
  await viaChip().waitFor({ timeout: 3000 });
  const legText = await legRowText();
  check('leg shows door-to-door time after accepting via', /≈ \d+h/.test(legText ?? ''), legText ?? '');
  const resultsVisible = await page.locator('text=/real time budget/i').count();
  check('results section renders', resultsVisible > 0);

  // --- Scenario 3: clearing the via returns to the suggestion state ---
  await viaChip().click();
  const suggestionBack = await page.getByRole('button', { name: /route via/i }).count();
  check('clearing via restores suggestion', suggestionBack > 0);

  // --- Scenario 4: changing a city drops the (re-accepted) via ---
  await page.getByRole('button', { name: /route via/i }).click();
  await viaChip().waitFor({ timeout: 3000 });
  await pickCity(1, 'Vienna');
  const staleChip = await viaChip().count();
  check('via cleared when city changes', staleChip === 0, `${staleChip} via chips left`);
}

// --- Scenario 5: normal pair still works (Cinque Terre -> Lugano is a train) ---
await pickCity(0, 'Cinque Terre');
await pickCity(1, 'Lugano');
const trainTime = await legRowText().catch(() => null);
check('Cinque Terre→Lugano prices as a normal train leg', /≈ \d+h/.test(trainTime ?? ''), trainTime ?? 'no time');

check('no page errors', errors.length === 0, errors.join('; '));

await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
