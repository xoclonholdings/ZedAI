import { test, expect } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import path from 'path';

// AGENT: This will trigger the open_simple_browser tool
async function openSimpleBrowser(url) {
  // AGENT: open_simple_browser {url}
}


test('UI loads, navigates to chat, and takes screenshot in Simple Browser', async ({ page }) => {
  // Kill any process using port 5173 (Vite dev server)
  try {
    execSync('fuser -k 5173/tcp || true', { stdio: 'ignore' });
  } catch {}

  // Start the advanced UI dev server in the background
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const viteDir = path.resolve(__dirname, '../');
  const viteProc = spawn('npm', ['run', 'dev'], {
    cwd: viteDir,
    detached: true,
    stdio: 'ignore',
  });

  // Wait for the server to be ready by polling the port
  const waitForServer = async (url, timeout = 20000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch {}
      await new Promise(res => setTimeout(res, 500));
    }
    throw new Error('Timeout: Vite dev server did not start in time');
  };
  const url = process.env.UI_URL || 'http://localhost:5173/';
  await waitForServer(url, 20000);

  // Open in Simple Browser
  await openSimpleBrowser(url);
  let error: any = null;
  try {
    // Set a timeout for the page load (e.g., 10 seconds)
    await Promise.race([
      page.goto(url, { waitUntil: 'domcontentloaded' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: UI did not load within 10 seconds')), 10000))
    ]);
    await page.waitForTimeout(2000);
    // Wait for the ENTER button and click it
    const enterButton = page.locator('button', { hasText: 'ENTER' });
    await enterButton.waitFor({ state: 'visible', timeout: 10000 });
    await expect(enterButton).toBeVisible();
    await expect(enterButton).toBeEnabled();
    await enterButton.click();
    // Wait for /chat page to render
    await page.waitForURL('**/chat', { timeout: 10000 });
  // Wait for chat input to be visible
  const chatInput = page.locator('textarea, input[type="text"], [data-testid="chat-input"]');
  await chatInput.first().waitFor({ state: 'visible', timeout: 15000 });
    // Send a chat message
    const message = 'Hello ZED!';
    if (await chatInput.count() > 0) {
      await chatInput.first().fill(message);
      await chatInput.first().press('Enter');
    } else {
      // Try to find a send button if input is not found
      const sendButton = page.locator('button', { hasText: /send/i });
      if (await sendButton.count() > 0) {
        await sendButton.first().click();
      }
    }
  // Wait for a new AI message from ZED to appear (not the welcome message)
  // AI messages have class bg-gray-800/80 and are left-aligned
  const aiMessages = page.locator('.bg-gray-800\\/80');
  // Wait for at least 2 AI messages (welcome + response)
  await expect(aiMessages).toHaveCount(2, { timeout: 20000 });
  // Optionally, wait for streaming indicator to disappear (▍)
  await page.waitForFunction(() => !document.body.innerText.includes('▍'), null, { timeout: 10000 });
  // Wait a bit for all styles/content to settle
  await page.waitForTimeout(1000);
  } catch (e) {
    error = e;
    console.error('Test error:', e);
  } finally {
    const screenshotPath = path.resolve(__dirname, '../ui-preview.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    // AGENT: open VS Code to screenshotPath
    // eslint-disable-next-line no-console
    console.log(`[AGENT] Open screenshot for inspection: ${screenshotPath}`);
    if (error) throw error;
  }
});
