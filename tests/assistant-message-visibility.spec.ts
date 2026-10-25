import { expect, test } from '@playwright/test';

// Isolated UI: no account impersonation, generated answer or production write.
for (const viewport of [{ width: 390, height: 844 }, { width: 694, height: 604 }, { width: 768, height: 1024 }, { width: 1280, height: 1800 }]) {
  test(`keeps sent messages in the visible scroller at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/dashboard?e2eDemo=1&module=aqua-assistant');
    const input = page.locator('[data-chat-input]');
    await expect(input).toBeVisible();
    await page.getByRole('tab', { name: 'Synthèse', exact: true }).click();
    await page.getByRole('tab', { name: 'Conversation', exact: true }).click();
    await input.fill('Où se trouve ma discussion ?');
    await page.getByRole('button', { name: 'Envoyer la question', exact: true }).click();
    const log = page.getByRole('log');
    const sent = log.locator('.is-user').last();
    await expect(sent).toContainText('Où se trouve ma discussion ?');
    await expect.poll(async () => {
      const outer = await log.boundingBox();
      const inner = await sent.boundingBox();
      return Boolean(outer && inner && outer.height >= 90 && inner.y < outer.y + outer.height && inner.y + inner.height > outer.y);
    }).toBe(true);
    await page.getByRole('button', { name: 'Fermer AquaAssistant', exact: true }).click();
    await page.getByRole('button', { name: 'Discuter avec AquaAssistant', exact: true }).click();
    await expect(log.locator('.is-user').last()).toContainText('Où se trouve ma discussion ?');
  });
}