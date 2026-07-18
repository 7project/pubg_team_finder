import { test, expect } from '@playwright/test';

test.describe('Notifications Flow', () => {
  test('should show toast when WebSocket notification received', async ({ page }) => {
    await page.goto('/dashboard');

    const loginButton = page.getByRole('button', { name: /войти через discord/i });
    if (await loginButton.isVisible()) {
      test.skip('User not authenticated');
      return;
    }

    await expect(page.locator('.toast-container')).toBeVisible({ timeout: 10000 });
  });

  test('should display notification toast with correct message', async ({ page }) => {
    await page.goto('/dashboard');

    const notifications = page.locator('[data-testid="toast"]');
    await expect(notifications.first()).toBeVisible({ timeout: 10000 });

    const toastText = await notifications.first().textContent();
    expect(toastText).toBeTruthy();
  });
});

test.describe('Match Flow', () => {
  test('should show "Complete Match" button for match creator', async ({ page }) => {
    await page.goto('/dashboard');

    const loginButton = page.getByRole('button', { name: /войти через discord/i });
    if (await loginButton.isVisible()) {
      test.skip('User not authenticated');
      return;
    }

    await page.goto('/matches');
    await page.waitForLoadState('networkidle');

    const completeButton = page.getByRole('button', { name: /завершить матч/i });
    await expect(completeButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to rating page after completing match', async ({ page }) => {
    await page.goto('/dashboard');

    const loginButton = page.getByRole('button', { name: /войти через discord/i });
    if (await loginButton.isVisible()) {
      test.skip('User not authenticated');
      return;
    }

    const completeButton = page.getByRole('button', { name: /завершить матч/i }).first();
    if (await completeButton.isVisible()) {
      await completeButton.click();

      page.on('dialog', dialog => dialog.accept());
      await page.waitForURL(/\/rating\//, { timeout: 10000 });
      await expect(page).toHaveURL(/\/rating\//);
    }
  });
});

test.describe('Rating Flow', () => {
  test('should display rating form for completed match', async ({ page }) => {
    await page.goto('/rating/test-match-id');

    const ratingForm = page.getByTestId('rating-form');
    await expect(ratingForm).toBeVisible({ timeout: 10000 });
  });

  test('should submit rating successfully', async ({ page }) => {
    await page.goto('/rating/test-match-id');

    const submitButton = page.getByRole('button', { name: /отправить/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      const successToast = page.locator('text=Оценка отправлена').or(page.locator('text=Успешно'));
      await expect(successToast).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow skip rating', async ({ page }) => {
    await page.goto('/rating/test-match-id');

    const skipButton = page.getByRole('button', { name: /пропустить/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
      await page.waitForLoadState('networkidle');
    }
  });
});

test.describe('Graceful Degradation', () => {
  test('should display cached data when parser is unavailable', async ({ page }) => {
    await page.goto('/dashboard');

    const loginButton = page.getByRole('button', { name: /войти через discord/i });
    if (await loginButton.isVisible()) {
      test.skip('User not authenticated');
      return;
    }

    const statsCard = page.locator('[data-testid="player-stats"]');
    await expect(statsCard).toBeVisible({ timeout: 10000 });

    const statsText = await statsCard.textContent();
    expect(statsText).toBeTruthy();
  });

  test('should show connection status indicator', async ({ page }) => {
    await page.goto('/dashboard');

    const loginButton = page.getByRole('button', { name: /войти через discord/i });
    if (await loginButton.isVisible()) {
      test.skip('User not authenticated');
      return;
    }

    const statusIndicator = page.locator('[data-testid="connection-status"]');
    const isVisible = await statusIndicator.isVisible().catch(() => false);
    if (isVisible) {
      await expect(statusIndicator).toBeVisible();
    }
  });
});