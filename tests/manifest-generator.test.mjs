import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('manifest generator preserves arbitrary technical metadata and strips taxonomy & confidence from metadataJson', () => {
  const testPackSlug = 'test-fixture-pack';
  const testPackDir = path.join(REPO_ROOT, 'packs', testPackSlug);
  const testModelDir = path.join(testPackDir, 'models', 'test_chair');

  try {
    fs.mkdirSync(testModelDir, { recursive: true });

    // 1. Write pack.json & cover.png
    const packJson = {
      name: 'Test Fixture Pack',
      creator: 'Test Creator',
      website: 'https://example.com/models',
      license: 'CC0',
      description: 'A pack created for contract testing.',
    };
    fs.writeFileSync(path.join(testPackDir, 'pack.json'), JSON.stringify(packJson, null, 2));
    fs.writeFileSync(path.join(testPackDir, 'cover.png'), Buffer.from('png-cover-data'));

    // 2. Write dummy glb and png
    fs.writeFileSync(path.join(testModelDir, 'test_chair.glb'), Buffer.from('glTF-dummy-binary-data'));
    fs.writeFileSync(path.join(testModelDir, 'test_chair.png'), Buffer.from('png-dummy-data'));

    // 3. Write items.json with rich taxonomy + arbitrary technical keys + confidence
    const itemsData = [
      {
        name: 'test_chair',
        category: 'Furniture',
        subcategory: 'Seating',
        description: 'A comfortable wooden test chair.',
        tags: ['chair', 'wood', 'furniture'],
        styles: ['Low Poly'],
        themes: ['Medieval'],
        themeNeutral: false,
        confidence: 0.95,
        // Arbitrary technical keys that must survive
        polyHavenId: 'wooden_armchair_01',
        polycount: 1420,
        resolution: '1k',
        hdTextureUrl: 'https://cdn.example.com/textures/chair.jpg',
        customVendorProp: 'vendor-asset-9988',
      },
    ];
    fs.writeFileSync(path.join(testPackDir, 'items.json'), JSON.stringify(itemsData, null, 2));

    // 4. Execute generator
    execFileSync('node', ['scripts/generate-store-manifest.mjs', '--pack', testPackSlug], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    const manifestPath = path.join(testPackDir, 'store-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'store-manifest.json was generated');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.items.length, 1);

    const item = manifest.items[0];
    assert.equal(item.category, 'Furniture');
    assert.equal(item.subcategory, 'Seating');
    assert.equal(item.description, 'A comfortable wooden test chair.');
    assert.deepEqual(item.tags, ['chair', 'wood', 'furniture']);
    assert.deepEqual(item.styles, ['Low Poly']);
    assert.deepEqual(item.themes, ['Medieval']);

    assert.ok(item.metadataJson, 'metadataJson must be present for technical keys');
    const parsedMeta = JSON.parse(item.metadataJson);

    // Assert survival of technical keys
    assert.equal(parsedMeta.polyHavenId, 'wooden_armchair_01');
    assert.equal(parsedMeta.polycount, 1420);
    assert.equal(parsedMeta.resolution, '1k');
    assert.equal(parsedMeta.hdTextureUrl, 'https://cdn.example.com/textures/chair.jpg');
    assert.equal(parsedMeta.customVendorProp, 'vendor-asset-9988');

    // Assert exclusion of taxonomy and confidence
    assert.equal(parsedMeta.category, undefined);
    assert.equal(parsedMeta.subcategory, undefined);
    assert.equal(parsedMeta.description, undefined);
    assert.equal(parsedMeta.tags, undefined);
    assert.equal(parsedMeta.styles, undefined);
    assert.equal(parsedMeta.themes, undefined);
    assert.equal(parsedMeta.themeNeutral, undefined);
    assert.equal(parsedMeta.confidence, undefined);
  } finally {
    if (fs.existsSync(testPackDir)) {
      fs.rmSync(testPackDir, { recursive: true, force: true });
    }
  }
});

test('manifest generator pins authored pack content, not a later manifest-only commit', () => {
  const packSlug = 'kaykit-character-pack-adventures';
  const manifestPath = path.join(REPO_ROOT, 'packs', packSlug, 'store-manifest.json');
  const originalManifest = fs.readFileSync(manifestPath);
  const expectedSha = execFileSync('git', [
    'log', '-1', '--format=%H', '--',
    `packs/${packSlug}`,
    `:(exclude)packs/${packSlug}/store-manifest.json`,
  ], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

  try {
    execFileSync('node', ['scripts/generate-store-manifest.mjs', '--pack', packSlug], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.pinnedSha, expectedSha);
  } finally {
    fs.writeFileSync(manifestPath, originalManifest);
  }
});
