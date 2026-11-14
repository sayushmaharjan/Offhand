import { mkdir, copyFile, readdir, access, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(path.join(root, 'public/wasm'), { recursive: true });
await mkdir(path.join(root, 'public/models'), { recursive: true });
for (const file of await readdir(path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm'))) {
  await copyFile(
    path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm', file),
    path.join(root, 'public/wasm', file),
  );
}
const model = path.join(root, 'public/models/hand_landmarker.task');
try {
  await access(model);
} catch {
  console.log('Downloading the official MediaPipe hand model (one-time setup)…');
  const response = await fetch(
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  );
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}. Retry npm run assets.`);
  await writeFile(model, new Uint8Array(await response.arrayBuffer()));
}
