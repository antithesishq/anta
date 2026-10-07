import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(new URL('../../site/package.json', import.meta.url))('playwright');

export async function checkBrowser({ origin, artifacts, framework, mode, composed }) {
  const report = { origin, errors: [], warnings: [], failedRequests: [], badResponses: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.CAPTURE_TEST_BROWSER_CHANNEL || 'chrome' });
    report.browserVersion = browser.version();
    const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
    page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') report.errors.push(message.text());
      if (message.type() === 'warning') report.warnings.push(message.text());
    });
    page.on('requestfailed', request => report.failedRequests.push({ url: request.url(), error: request.failure() }));
    page.on('response', response => {
      if (response.status() >= 400) report.badResponses.push({ url: response.url(), status: response.status() });
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Anta consumer test', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Count: 0', exact: true }).waitFor();
    report.initial = await page.evaluate(() => {
      const names = ['a-title', 'a-tag', 'a-button', 'a-slider', 'a-breadcrumbs', 'a-steps', 'a-input-date', 'a-select', 'a-select-faceted'];
      const title = document.querySelector('a-title'), tag = document.querySelector('a-tag'), button = document.querySelector('a-button');
      return {
        registered: Object.fromEntries(names.map(name => [name, !!customElements.get(name)])),
        rootFont: getComputedStyle(document.documentElement).fontSize,
        titleFont: getComputedStyle(title).fontSize,
        tagRadius: getComputedStyle(tag).borderRadius,
        buttonHeight: button.getBoundingClientRect().height,
      };
    });
    assert.equal(report.initial.rootFont, '15px');
    assert.equal(report.initial.titleFont, '28px');
    assert.equal(report.initial.tagRadius, '22px');
    assert.equal(report.initial.buttonHeight, 28);
    assert.equal(report.initial.registered['a-button'], true);
    assert.equal(report.initial.registered['a-slider'], mode === 'full');
    for (const name of ['a-title', 'a-tag', 'a-breadcrumbs', 'a-steps', 'a-input-date', 'a-select', 'a-select-faceted']) {
      assert.equal(report.initial.registered[name], false, `${name} remains a CSS-only entry`);
    }
    await page.getByRole('button', { name: 'Count: 0', exact: true }).click();
    await page.getByRole('button', { name: 'Count: 1', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Count: 2', exact: true }).waitFor();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Count: 3', exact: true }).waitFor();
    report.buttonCount = 3;

    const steps = mode === 'granular' && (framework === 'nextjs' || composed);
    if (steps) {
      report.marker = await page.locator('a-step-marker').first().evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
      assert.deepEqual(report.marker, { width: 28, height: 28 });
      // ElementInternals exposes selection through the property/custom state, not aria-selected attributes.
      await page.getByRole('tab', { name: 'Review', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('a-tabs').getAttribute('state') === 'review');
      await page.getByRole('tab', { name: 'Build', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('a-tabs').getAttribute('state') === 'build');
      await page.getByRole('tab', { name: 'Build', exact: true }).focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('a-tabs').getAttribute('state') === 'deploy');
      report.selectedStep = await page.locator('a-tab[value="deploy"]').evaluate(element => ({ selected: element.selected, state: element.matches(':state(selected)') }));
      assert.deepEqual(report.selectedStep, { selected: true, state: true });
      await page.getByRole('tabpanel').filter({ hasText: framework === 'nextjs' ? 'Deploy the release.' : 'Deploy panel' }).waitFor();
      assert.equal(await page.locator(composed ? '#phase' : 'output').textContent(), 'Phase: deploy');
    }
    if (composed) {
      report.layouts = await page.evaluate(() => {
        const style = selector => { const css = getComputedStyle(document.querySelector(selector)); return { display: css.display, gap: css.gap }; };
        return { breadcrumbs: style('a-breadcrumbs'), select: style('a-select-field') };
      });
      assert.equal(report.layouts.breadcrumbs.display, 'flex');
      assert.deepEqual(report.layouts.select, { display: 'grid', gap: '4px' });
      await page.locator('#select').getByRole('button').click();
      await page.locator('#select a-menu').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#select a-button').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      await page.locator('#date > a-input').click();
      await page.locator('#date a-calendar').waitFor({ state: 'visible' });
      report.dateLayout = await page.locator('a-input-date-time-container').evaluate(element => ({ display: getComputedStyle(element).display, gap: getComputedStyle(element).gap }));
      assert.deepEqual(report.dateLayout, { display: 'flex', gap: '12px' });
      await page.screenshot({ path: join(artifacts, 'date-popup.png'), fullPage: true });
      await page.keyboard.press('Escape');
      await page.locator('#faceted > a-button').click();
      await page.locator('#faceted > a-menu').waitFor({ state: 'visible' });
      report.facetedSummary = await page.locator('a-select-faceted-summary').evaluate(element => ({ display: getComputedStyle(element).display, textOverflow: getComputedStyle(element).textOverflow }));
      assert.deepEqual(report.facetedSummary, { display: 'block', textOverflow: 'ellipsis' });
      await page.screenshot({ path: join(artifacts, 'faceted-popup.png'), fullPage: true });
      await page.keyboard.press('Escape');
    }
    if (framework === 'nextjs') {
      const response = await fetch(origin), html = await response.text();
      await writeFile(join(artifacts, 'ssr.html'), html);
      assert.equal(response.status, 200);
      for (const text of ['a-title', 'a-tag', 'a-button', 'Count: 0', ...(steps ? ['a-steps', 'a-tabpanel'] : [])]) assert.ok(html.includes(text), `SSR contains ${text}`);
      const noJs = await browser.newContext({ javaScriptEnabled: false });
      const serverPage = await noJs.newPage();
      await serverPage.goto(origin, { waitUntil: 'networkidle' });
      report.withoutJavaScript = {
        titleFont: await serverPage.locator('a-title').first().evaluate(element => getComputedStyle(element).fontSize),
        button: await serverPage.locator('a-button').textContent(),
      };
      assert.deepEqual(report.withoutJavaScript, { titleFont: '28px', button: 'Count: 0' });
      if (steps) assert.equal(await serverPage.locator('a-step-marker').first().evaluate(element => element.getBoundingClientRect().width), 28);
      await noJs.close();
    }
    await page.screenshot({ path: join(artifacts, 'consumer.png'), fullPage: true });
    for (const field of ['errors', 'warnings', 'failedRequests', 'badResponses']) assert.deepEqual(report[field], [], field);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.failure = error.stack;
    await page?.screenshot({ path: join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser?.close();
    await writeFile(join(artifacts, 'browser.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}
