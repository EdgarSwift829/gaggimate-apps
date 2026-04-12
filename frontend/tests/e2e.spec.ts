import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('GaggiMate E2E', () => {
  test('ホーム画面が表示される', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/home.png' });
  });

  test('ナビゲーション全リンクが存在する', async ({ page }) => {
    await page.goto(BASE);
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    // exact: true でレシピとAIレシピを区別。スマホは「スマホ連携」にマッチ。
    for (const label of ['ホーム', 'ログ', '分析', '設定']) {
      const link = nav.getByText(label, { exact: true });
      await expect(link.first()).toBeVisible();
    }
    // レシピは exact: true でAIレシピと区別
    await expect(nav.getByText('レシピ', { exact: true })).toBeVisible();
    // AIレシピリンク
    await expect(nav.getByText('AI レシピ', { exact: false }).first()).toBeVisible();
    // スマホ連携
    await expect(nav.getByText('スマホ', { exact: false }).first()).toBeVisible();
  });

  test('ログ画面が表示される', async ({ page }) => {
    await page.goto(`${BASE}/log`);
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/log.png' });
  });

  test('レシピ画面が表示される', async ({ page }) => {
    await page.goto(`${BASE}/recipes`);
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/recipes.png' });
  });

  test('分析ダッシュボードが表示される', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/dashboard.png' });
  });

  test('ショット比較画面が表示される', async ({ page }) => {
    await page.goto(`${BASE}/compare`);
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/compare.png' });
  });

  test('トレンド画面が表示される', async ({ page }) => {
    await page.goto(`${BASE}/trends`);
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/trends.png' });
  });

  test('AIレシピ画面が表示される', async ({ page }) => {
    await page.goto(`${BASE}/recipe-ai`);
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/recipe-ai.png' });
  });

  test('スマホ連携画面とQR表示', async ({ page }) => {
    await page.goto(`${BASE}/mobile`);
    await expect(page.locator('h1')).toBeVisible();
    const qrImg = page.locator('img[alt="QR Code"]');
    await expect(qrImg).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'tests/screenshots/mobile-connect.png' });
  });

  test('設定画面が表示される', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByPlaceholder(/LINE Notify/)).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/settings.png' });
  });
});
