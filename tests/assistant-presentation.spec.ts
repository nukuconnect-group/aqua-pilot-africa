import { expect, test } from '@playwright/test';

test('keeps the unsent question when switching between sidebar and floating entry', async ({ page }) => {
  // Isolated local UI mode: no account impersonation, messages or production writes.
  await page.goto('/dashboard?e2eDemo=1&module=aqua-assistant');
  const input = page.locator('[data-chat-input]');
  await expect(input).toBeVisible();
  await input.fill('Question non envoyée à conserver');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('aquapilote:navigate', { detail: 'infrastructures' })));
  await expect(page.locator('[data-module-content]')).toHaveAttribute('data-module-content', 'infrastructures');
  await expect(input).toHaveCount(0);
  await page.getByRole('button', { name: 'Discuter avec AquaAssistant', exact: true }).click();
  await expect(input).toHaveValue('Question non envoyée à conserver');
  await page.getByRole('button', { name: 'Fermer AquaAssistant', exact: true }).click();
  await expect(input).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('aquapilote:navigate', { detail: 'aqua-assistant' })));
  await expect(input).toHaveValue('Question non envoyée à conserver');
});