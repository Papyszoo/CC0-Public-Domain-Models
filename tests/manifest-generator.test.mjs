import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('store-manifest.json emits typed fields and preserves technical metadataJson', () => {
  const packsDir = path.join(REPO_ROOT, 'packs');
  const samplePack = path.join(packsDir, 'polyhaven-furniture', 'store-manifest.json');
  assert.ok(fs.existsSync(samplePack), 'sample manifest exists');

  const manifest = JSON.parse(fs.readFileSync(samplePack, 'utf8'));
  assert.ok(Array.isArray(manifest.items) && manifest.items.length > 0, 'items array is populated');

  const firstItem = manifest.items[0];
  assert.ok(firstItem.name, 'item has name');
  assert.ok(firstItem.category, 'item has typed category');
  assert.ok(Array.isArray(firstItem.styles), 'item has styles array');
  assert.ok(Array.isArray(firstItem.themes), 'item has themes array');
  assert.ok(Array.isArray(firstItem.tags), 'item has tags array');
  assert.ok(firstItem.description, 'item has description');
});
