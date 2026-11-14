import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Saved locally')).toBeVisible();
});
test('mouse-only editing, page isolation, undo/redo, persistence and PNG download', async ({
  page,
}) => {
  await page.mouse.move(500, 350);
  await page.mouse.down();
  await page.mouse.move(550, 400, { steps: 10 });
  await page.mouse.move(620, 350, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Make room for your next idea.' }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'New page', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Make room for your next idea.' })).toBeVisible();
  await page.getByRole('button', { name: 'Open My first canvas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make room for your next idea.' })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Make room for your next idea.' }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: '120%' })).toBeVisible();
  await expect(page.getByText('Saved locally')).toBeVisible();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '120%' })).toBeVisible();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^AirCanvas_.*\.png$/);
  expect(await download.failure()).toBeNull();
});
test('white and mirrored camera exports have correct pixels and aligned ink', async ({ page }) => {
  const pixels = await page.evaluate(async () => {
    const exporter = '/src/export/pngExporter.ts',
      store = '/src/storage/pageStore.ts';
    const { renderExport } = await import(exporter),
      { Editor } = await import(store);
    const e = new Editor();
    e.configure({ color: '#00ff00', width: 10 });
    e.begin({ x: 100, y: 100, t: 0 });
    e.end();
    const source = document.createElement('canvas');
    source.width = 320;
    source.height = 180;
    const ctx = source.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 160, 180);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(160, 0, 160, 180);
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = source.captureStream(10);
    await video.play();
    const options = {
      background: 'camera',
      scope: 'viewport',
      scale: 1,
      width: 320,
      height: 180,
      overlayOpacity: 0,
    };
    const camera = renderExport(e.page, options, video).getContext('2d');
    const white = renderExport(e.page, { ...options, background: 'white' }).getContext('2d');
    const sample = (c: CanvasRenderingContext2D, x: number, y: number) =>
      Array.from(c.getImageData(x, y, 1, 1).data);
    const out = {
      left: sample(camera, 20, 20),
      right: sample(camera, 300, 20),
      cameraInk: sample(camera, 100, 100),
      white: sample(white, 20, 20),
      whiteInk: sample(white, 100, 100),
    };
    (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    return out;
  });
  // Video color conversion can round an RGB channel by one or two levels.
  for (const [actual, expected] of [
    [pixels.left, [0, 0, 255, 255]],
    [pixels.right, [255, 0, 0, 255]],
  ])
    actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(2));
  expect(pixels.cameraInk).toEqual([0, 255, 0, 255]);
  expect(pixels.white).toEqual([255, 255, 255, 255]);
  expect(pixels.whiteInk).toEqual([0, 255, 0, 255]);
});
test('camera failure leaves mouse drawing usable', async ({ page }) => {
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Test: no camera', 'NotFoundError');
    };
  });
  await page.getByRole('button', { name: 'Air draw', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('No webcam found');
  await page.getByRole('button', { name: 'Set up later' }).click();
  await page.getByRole('button', { name: 'Mouse', exact: true }).click();
  await page.mouse.move(600, 350);
  await page.mouse.down();
  await page.mouse.move(650, 400, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
});
test('responsive controls, settings, and project export work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Toggle pages' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Stroke smoothing', { exact: true }).fill('0.7');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('AirCanvas_project.json');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: 'Pen (B)', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png' });
});
test('no browser errors and desktop appearance', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await expect(page.getByText('Saved locally')).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop.png' });
  expect(errors).toEqual([]);
});
test('locally bundled MediaPipe model initializes and processes a synthetic video frame', async ({
  page,
}) => {
  test.setTimeout(90000);
  const count = await page.evaluate(async () => {
    const path = '/src/tracking/handTracker.ts';
    const { HandTracker } = await import(path);
    const source = document.createElement('canvas');
    source.width = 640;
    source.height = 360;
    const ctx = source.getContext('2d')!;
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, 640, 360);
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = source.captureStream(10);
    await video.play();
    const tracker = new HandTracker();
    try {
      return await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Model did not produce a result')),
          60000,
        );
        tracker
          .start(
            video,
            (hands: unknown[]) => {
              clearTimeout(timeout);
              resolve(hands.length);
            },
            (message: string) => {
              clearTimeout(timeout);
              reject(new Error(message));
            },
          )
          .catch(reject);
      });
    } finally {
      tracker.stop();
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
  });
  expect(count).toBe(0);
});
