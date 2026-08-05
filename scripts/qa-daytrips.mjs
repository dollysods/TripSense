/**
 * Headless UI QA for the day-trip feature (v1.1b) against the dev
 * server. Not part of CI; run manually with the dev server up:
 *   node scripts/qa-daytrips.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.QA_URL ?? 'http://localhost:5173';
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
const addCity = () => page.getByRole('button', { name: '+ Add city' }).click();
// Leg rows all start with the │ marker; the indented day-trip stop rows
// share the ml-10 class but not the marker.
const legRowText = (i) => page.locator('.ml-10', { hasText: '│' }).nth(i).textContent();

// ---- Scenario 1: Munich -> Vienna -> Bratislava (day trip) -> Budapest ----
await page.goto(URL, { waitUntil: 'networkidle' });
await pickCity(0, 'Munich');
await pickCity(1, 'Vienna');
await addCity();
await pickCity(2, 'Bratislava');
await addCity();
await pickCity(3, 'Budapest');

const boxes = page.getByRole('checkbox');
check('toggle disabled on first stop', await boxes.nth(0).isDisabled());
check('toggle disabled on last stop', await boxes.nth(3).isDisabled());
check('toggle enabled mid-itinerary', !(await boxes.nth(2).isDisabled()));

await boxes.nth(2).check();
check('day-trip label names the base', (await page.getByText('day trip from Vienna').count()) > 0);
check('nights input replaced by on-site hours', (await page.getByLabel('Hours on site for stop 3').count()) === 1);

const bratLeg = (await legRowText(1)) ?? '';
check('leg into day trip shows round trip', /round trip/.test(bratLeg), bratLeg.slice(0, 80));

const tableText = (await page.locator('table').textContent()) ?? '';
check('results nest the day trip under Vienna', /↳/.test(tableText) && /day trip/.test(tableText));
check('day-trip nights shown as —', /—/.test(tableText));

// Leg 3 (into Budapest) must price from Vienna (base), i.e. show a time.
const budLeg = (await legRowText(2)) ?? '';
check('leg after day trip still prices (from base)', /≈ \d+h/.test(budLeg), budLeg.slice(0, 60));

// ---- Scenario 2: off-list Hallstatt day trip with override ----
await page.goto(URL, { waitUntil: 'networkidle' });
await pickCity(0, 'Salzburg');
await pickCity(1, 'Prague');
await addCity();
await pickCity(2, 'Vienna'); // becomes last; middle stop gets Hallstatt
// Rearrange: we want Salzburg -> Hallstatt(dt) -> Prague; rebuild simply:
await page.goto(URL, { waitUntil: 'networkidle' });
await pickCity(0, 'Salzburg');
await addCity();
await pickCity(1, 'Hallstatt'); // no dataset match -> creatable option
await pickCity(2, 'Prague');

check('off-list stop accepted', (await page.getByText('Hallstatt (off-list)').count()) > 0);
await page.getByRole('checkbox').nth(1).check();
const hallLeg0 = (await legRowText(0)) ?? '';
check('off-list day trip asks for a one-way time', /one-way/.test(hallLeg0), hallLeg0.slice(0, 90));

await page.getByLabel('Override travel time in minutes').first().fill('120');
const hallLeg = (await legRowText(0)) ?? '';
check('override doubles to 4h round trip', /custom: 4h/.test(hallLeg) && /×2 round trip/.test(hallLeg), hallLeg.slice(0, 90));

const tbl2 = (await page.locator('table').textContent()) ?? '';
check('Hallstatt appears in results as day trip', /Hallstatt/.test(tbl2) && /↳/.test(tbl2));

// ---- Scenario 3: long-round-trip warning ----
await page.goto(URL, { waitUntil: 'networkidle' });
await pickCity(0, 'Madrid');
await addCity();
await pickCity(1, 'Krakow');
await pickCity(2, 'Barcelona');
await page.getByRole('checkbox').nth(1).check();
const warnLeg = (await legRowText(0)) ?? '';
check('>10h round trip warns', /long round trip/.test(warnLeg), warnLeg.slice(0, 110));

check('no page errors', errors.length === 0, errors.join('; '));

await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
