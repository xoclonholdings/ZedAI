import { test, expect } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import path from 'path';

// This function will be replaced by the agent to open the Simple Browser in Codespaces
async function openSimpleBrowser(url: string) {
  // AGENT: This will trigger the open_simple_browser tool
}

// This test opens the Vite preview (or dev server) in Chromium and logs any errors found in the console

test('UI loads, is visible, and buttons are clickable in Simple Browser', async ({ page }) => {
  // Kill any process using port 5174 (Vite dev server)
  try {
    execSync('fuser -k 5173/tcp || true', { stdio: 'ignore' });
  } catch {}

  // Start the advanced UI dev server in the background
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const viteDir = path.resolve(__dirname, '../../client');
  const viteProc = spawn('npm', ['run', 'dev'], {
    cwd: viteDir,
    detached: true,
    stdio: 'ignore',
  });
  // Give the server time to start
  await new Promise(res => setTimeout(res, 7000));

  const url = process.env.UI_URL || 'http://localhost:5173/';
  await openSimpleBrowser(url);
  let error: any = null;
  try {
      // Set a timeout for the page load (e.g., 10 seconds)
      await Promise.race([
        page.goto(url, { waitUntil: 'domcontentloaded' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: UI did not load within 10 seconds')), 10000))
      ]);
    await page.waitForTimeout(2000);
    const app = page.locator('.app');
    await expect(app, 'Main app container should be visible').toBeVisible();
    const indexBtn = await page.getByRole('button', { name: /index sample/i });
    const evalBtn = await page.getByRole('button', { name: /run eval/i });
    await expect(indexBtn).toBeVisible();
    await expect(indexBtn).toBeEnabled();
    await expect(evalBtn).toBeVisible();
    await expect(evalBtn).toBeEnabled();
    const textarea = await page.getByPlaceholder('Ask Zed…');
    const sendBtn = await page.getByRole('button', { name: /send/i });
    await expect(textarea).toBeVisible();
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeEnabled();
    await indexBtn.click();
    await evalBtn.click();
  } catch (e) {
    error = e;
    console.error('Test error:', e);
  } finally {
  const screenshotPath = '../ui-preview.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  // Open the screenshot for visual inspection (agent will run the task or command)
  // AGENT: Open the screenshot file in VS Code
  // eslint-disable-next-line no-console
  console.log(`[AGENT] Open screenshot for inspection: ${screenshotPath}`);
    if (error) throw error;
  }
});
