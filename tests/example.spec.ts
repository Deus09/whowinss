import { test, expect } from '@playwright/test';

test('yük testi senaryosu', async ({ page }) => {
    await page.goto('http://example.com');
    const response = await page.request.get('/api/load-test');
    expect(response.status()).toBe(200);
});