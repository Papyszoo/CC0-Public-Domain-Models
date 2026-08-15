// Generates store-manifest.json (repo root): the ModelibrStore "external pack"
// manifest for every pack under packs/ — one Model item per mesh, the GLB as
// role=Mesh, the PNG as a Thumbnail preview and the animated WebP as a
// Turntable preview, each with its SHA-256 and size, plus the pack's own
// cover.png as its pack-level Thumbnail (the catalog listing image).
//
// One pack = one directory under packs/, holding a pack.json (authored
// metadata), a cover.png and models/<slug>/<slug>.{glb,png,webp}. Adding a pack
// means adding a directory — this script needs no edit. The emitted shape
// ({ source, license, packs: [...] }) is the same multi-pack manifest the
// CC0-Public-Domain-Sounds repo emits, so one submitter handles both.
//
// Upload flow: ModelibrStore → Admin → Upload → External pack (GitHub-hosted)
// → "Load manifest file (.json)" → pick one pack → Publish. For all packs at
// once use the store repo's scripts/sound-packs/submit-sound-packs.mjs, which
// reads this same packs[] shape.
//
// Rerun after changing anything under packs/ — and commit + push that change
// first, because the URLs pin to the commit that last touched packs/.
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OWNER_REPO = 'Papyszoo/CC0-Public-Domain-Models';

// DECISION: URLs are pinned to the commit SHA of the last change to packs/ so
// a later push can never alter the bytes behind a published manifest (the
// store verifies these hashes at submission). Metadata commits (README, this
// script, the manifest itself) don't move that commit, so they don't require
// re-pinning. The SHA is derived, not hand-maintained: a stale hand-edited pin
// silently publishes URLs that serve different bytes than the hashes describe.
const PINNED_SHA = process.env.PINNED_SHA
  ?? execSync('git log -1 --format=%H -- packs', { cwd: REPO }).toString().trim();

const dirty = execSync('git status --porcelain -- packs', { cwd: REPO }).toString().trim();
if (dirty) {
  console.error(
    'packs/ has uncommitted changes — refusing to hash.\n' +
    'Commit and push them first: the manifest pins URLs to a commit GitHub must already serve.');
  process.exit(1);
}

// A pinned commit that was never pushed produces URLs that 404 for the store.
const onRemote = execSync(`git branch -r --contains ${PINNED_SHA}`, { cwd: REPO }).toString().trim();
if (!onRemote && !process.env.ALLOW_UNPUSHED) {
  console.error(
    `Commit ${PINNED_SHA} is not on any remote branch — push it before generating,\n` +
    'or set ALLOW_UNPUSHED=1 if you are deliberately generating a preview.');
  process.exit(1);
}

const rawBase = `https://raw.githubusercontent.com/${OWNER_REPO}/${PINNED_SHA}`;

// ---------------------------------------------------------------------------
// Keyword → standard Model category (ModelibrStore docs/taxonomy.json v1).
// Matched against underscore-separated name segments (plural-insensitive),
// FIRST match in table order wins — put specific words before generic ones.
// Unmatched models default to "Props" (this is a props library). Category
// counts are printed after generation for review.
// ---------------------------------------------------------------------------
const KEYWORD_CATEGORIES = [
  // Weapons before Tools ("battle_axe" vs "axe" both → Weapons; "pickaxe" handled below)
  [['sword', 'dagger', 'shuriken', 'katana', 'mace', 'spear', 'shield', 'bow?', 'arrow', 'arrowhead', 'bullet', 'grenade', 'cannon', 'gun', 'rifle', 'pistol', 'ammo', 'battle', 'blade', 'axe', 'crossbow', 'quiver', 'sheath', 'scabbard', 'flail', 'halberd', 'club', 'cartridge', 'gladius', 'saber', 'sai', 'khukuri', 'kakute', 'bomb', 'duster', 'knuckle', 'harpoon', 'trident', 'whip', 'slingshot', 'cleaver?weapon', 'warhammer'], 'Weapons'],
  [['helmet', 'armor', 'armour', 'gauntlet', 'boot', 'glove', 'hat', 'cap', 'belt', 'cloak', 'shoe', 'sandal', 'crown', 'mask', 'shirt', 'pants', 'dress', 'sock', 'scarf', 'jacket', 'bowtie', 'tie', 'loafer', 'fedora', 'shoelace', 'glasses', 'sunglasses', 'spectacles', 'eyewear', 'goggles', 'backpack', 'buckle', 'badge'], 'Armor & Clothing'],
  [['guitar', 'drum', 'violin', 'flute', 'piano', 'trumpet', 'harp', 'banjo', 'accordion', 'microphone', 'metronome', 'tambourine', 'xylophone', 'bell', 'glockenspiel', 'kalimba', 'fretboard', 'plectrum', 'note', 'vinyl'], 'Music & Instruments'],
  [['dice', 'chess', 'domino', 'card', 'toy', 'teddy', 'puzzle', 'dart', 'billiard', 'bowling', 'baseball', 'basketball', 'football', 'tennis', 'golf', 'hockey', 'ski', 'skateboard', 'balloon', 'kite', 'yoyo', 'arcade', 'pinball', 'flipper', 'cricket', 'volleyball', 'dreidel', 'jigsaw', 'skatepark', 'ramp', 'kicker', 'goal', 'podium', 'dumbbell', 'kettlebell', 'strengthener', 'glowstick'], 'Toys & Games'],
  [['apple', 'avocado', 'banana', 'bread', 'cake', 'cheese', 'egg', 'meat', 'pizza', 'fruit', 'vegetable', 'carrot', 'potato', 'tomato', 'onion', 'lemon', 'orange', 'pear', 'grape', 'melon', 'berry', 'mushroom?food', 'mug', 'teapot', 'kettle', 'plate', 'bowl', 'cup', 'goblet', 'fork', 'spoon', 'whisk', 'pan', 'pot', 'jug', 'jar', 'bottle', 'glass', 'tray', 'chopstick', 'ladle', 'grater', 'colander', 'corkscrew', 'cutlery', 'saucer', 'pitcher', 'flask', 'tankard', 'cauldron', 'skillet', 'spatula', 'rolling', 'toaster', 'donut', 'doughnut', 'cookie', 'croissant', 'baguette', 'sausage', 'steak', 'fish?food', 'pumpkin', 'corn', 'wine', 'beer', 'coffee', 'tea', 'knife', 'cleaver', 'mezzaluna', 'chopper', 'tenderiser', 'canned', 'can', 'tin', 'cheeseburger', 'burger', 'chilli', 'squash', 'salmon', 'fillet', 'cork', 'champagne', 'drink', 'soda', 'ice', 'lolly', 'cupcake', 'flan', 'loaf', 'decanter', 'popcorn', 'pretzel', 'sushi', 'taco', 'waffle', 'pancake', 'toast', 'sandwich', 'noodle', 'rice', 'sauce', 'lollipop', 'chocolate'], 'Food & Kitchen'],
  [['table', 'chair', 'stool', 'bench', 'shelf', 'shelving', 'cabinet', 'drawer', 'desk', 'bed', 'bedside', 'couch', 'sofa', 'wardrobe', 'dresser', 'bookcase', 'ottoman', 'armchair', 'crib', 'bunk', 'nightstand', 'sideboard', 'stepstool', 'locker'], 'Furniture'],
  [['architrave', 'beam', 'column', 'pillar', 'door', 'window', 'wall', 'stair', 'staircase', 'roof', 'fence', 'arch', 'brick', 'gutter', 'awning', 'balustrade', 'banister', 'cornice', 'skirting', 'lintel', 'sill', 'chimney', 'gate', 'railing', 'scaffold', 'girder', 'truss', 'panel', 'panelling', 'building', 'church', 'tower', 'barrier', 'bollard', 'baluster', 'corrugated', 'drain', 'drainage', 'faucet', 'tap', 'sink', 'paving', 'tile', 'quoin', 'quoins', 'pergola', 'trellis', 'buttress', 'gazebo', 'bridge', 'well', 'fountain', 'curb', 'curbing', 'coping', 'dado', 'fascia', 'newel', 'ridge', 'spindle', 'grate', 'manhole', 'kennel', 'post', 'kerb', 'capping', 'onlay', 'rail', 'tram', 'skiff?arch'], 'Architecture'],
  [['screw', 'nut', 'bolt', 'hammer', 'wrench', 'spanner', 'saw', 'drill', 'plier', 'nail', 'anvil', 'bellows', 'hook', 'axle', 'chisel', 'screwdriver', 'clamp', 'vice', 'vise', 'file', 'rasp', 'trowel', 'shovel', 'spade', 'pickaxe', 'crowbar', 'mallet', 'allen', 'ratchet', 'socket', 'toolbox', 'tape', 'ruler', 'level', 'caliper', 'washer', 'rivet', 'hinge', 'padlock', 'chain', 'rope', 'pulley', 'gear', 'cog', 'spring', 'pipe', 'valve', 'ladder', 'wheelbarrow', 'rake', 'hoe', 'scythe', 'sickle', 'pitchfork', 'bradawl', 'hacksaw', 'sledgehammer', 'plasterers', 'float', 'tweezers', 'lock', 'latch', 'magnet', 'solder', 'wire', 'canister'], 'Tools & Hardware'],
  [['jack', 'cable', 'plug', 'phone', 'monitor', 'keyboard', 'speaker', 'headphone', 'camera', 'battery', 'switch', 'socket?power', 'laptop', 'computer', 'mouse', 'screen', 'television', 'tv', 'radio', 'antenna', 'circuit', 'led', 'usb', 'charger', 'remote', 'console', 'joystick', 'gamepad', 'alarm', 'detector', 'walkie', 'talkie', 'handset', 'dial', 'knob', 'microwave', 'dryer', 'keycap', 'cd'], 'Electronics'],
  [['acorn', 'leaf', 'rock', 'boulder', 'tree', 'branch', 'log', 'stump', 'mushroom', 'flower', 'plant', 'bush', 'grass', 'vine', 'pinecone', 'seashell', 'shell', 'coral', 'stone', 'pebble', 'stick', 'twig', 'root', 'cactus', 'fern', 'moss', 'lily', 'pad', 'firewood', 'crystal', 'gem', 'emerald', 'diamond', 'dirt', 'snow', 'snowflake', 'seaweed', 'stake'], 'Nature'],
  [['dog', 'cat', 'fish', 'bird', 'horse', 'cow', 'pig', 'sheep', 'chicken', 'duck', 'rabbit', 'frog', 'snake', 'rattlesnake', 'spider', 'deer', 'bull', 'stag', 'boar', 'bone', 'skull?animal', 'antler', 'horn', 'feather', 'egg?nest', 'wing', 'tooth', 'claw', 'fang'], 'Creatures & Animals'],
  [['car', 'truck', 'boat', 'ship', 'cart', 'wagon', 'wheel', 'tire', 'tyre', 'bicycle', 'bike', 'motorcycle', 'plane', 'helicopter', 'canoe', 'kayak', 'sled', 'anchor', 'oar', 'paddle?boat', 'rudder', 'propeller', 'skiff', 'cartwheel', 'wheelchair', 'hubcap', 'glider', 'traffic', 'guard'], 'Vehicles'],
  [['human', 'male', 'female', 'mannequin', 'peg_person'], 'Characters'],
  [['vase', 'statue', 'sculpture', 'picture', 'frame', 'painting', 'banner', 'flag', 'trophy', 'ornament', 'figurine', 'candelabra', 'chandelier', 'wreath', 'garland', 'ribbon', 'speech', 'sign', 'signpost', 'plaque', 'pedestal', 'plinth', 'birdhouse', 'wind_chime', 'gnome', 'symbol', 'logo', 'icon', 'bead', 'knot', 'star', 'fleur', 'urn', 'obelisk', 'crescent', 'moon', 'sun', 'sundial', 'poster', 'planter', 'pottery', 'brazier'], 'Decorative'],
  [['vent', 'candle', 'clock', 'mirror', 'lamp', 'lantern', 'broom', 'bucket', 'basket', 'bin', 'ashtray', 'ash', 'towel', 'soap', 'brush', 'comb', 'razor', 'toothbrush', 'pillow', 'cushion', 'blanket', 'curtain', 'rug', 'carpet', 'hanger', 'sponge', 'mop', 'dustpan', 'plunger', 'scissors', 'needle', 'thread', 'button', 'zipper', 'umbrella', 'cane', 'crutch', 'bandage', 'syringe', 'thermometer', 'pill', 'book', 'pen', 'pencil', 'paper', 'envelope', 'scroll', 'quill', 'inkwell', 'stamp', 'key', 'coin', 'wallet', 'purse', 'bag', 'suitcase', 'chest', 'crate', 'barrel', 'box', 'sack', 'pouch', 'abacus', 'hourglass', 'telescope', 'binoculars', 'magnifying', 'compass', 'globe', 'map', 'beaker', 'vial', 'test_tube', 'auction', 'adhesive', 'toilet', 'tongs', 'poker', 'fireplace', 'paintbrush', 'clip', 'paperclip', 'staple', 'stapler', 'lighter', 'funnel', 'pipette', 'petri', 'burner', 'diffuser', 'spray', 'peg', 'tag', 'folder', 'notebook', 'chalkboard', 'noticeboard', 'mat', 'straw', 'trolley', 'plaster', 'blister', 'lipstick', 'tube'], 'Household'],
];

// Segment-based match, crude plural folding; entries with '?' are
// disambiguation notes and match on the part before it.
function categorize(name) {
  const segments = name.toLowerCase().split('_').filter(Boolean)
    .map((seg) => (seg.endsWith('s') && seg.length > 3 ? seg.slice(0, -1) : seg));
  for (const [keywords, category] of KEYWORD_CATEGORIES) {
    for (const raw of keywords) {
      const kw = raw.split('?')[0];
      if (segments.includes(kw)) return category;
    }
  }
  return 'Props';
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const displayName = (name) =>
  name
    .split('_')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' ');

const packsDir = path.join(REPO, 'packs');
const packSlugs = readdirSync(packsDir)
  .filter((n) => existsSync(path.join(packsDir, n, 'pack.json')))
  .sort();

if (packSlugs.length === 0) {
  console.error('No packs found. A pack is packs/<slug>/ containing pack.json, cover.png and models/.');
  process.exit(1);
}

// Store submission requires all of these; a pack missing one is rejected after
// the store has already downloaded every file, so fail here instead.
const REQUIRED_PACK_KEYS = ['name', 'creator', 'website', 'license', 'description'];

const packs = [];

for (const slug of packSlugs) {
  const packRoot = path.join(packsDir, slug);
  const meta = JSON.parse(readFileSync(path.join(packRoot, 'pack.json'), 'utf8'));

  const missing = REQUIRED_PACK_KEYS.filter((k) => !meta[k]);
  if (missing.length) {
    console.error(`packs/${slug}/pack.json is missing: ${missing.join(', ')}`);
    process.exit(1);
  }

  const modelsDir = path.join(packRoot, 'models');
  if (!existsSync(modelsDir)) {
    console.error(`packs/${slug} has no models/ directory.`);
    process.exit(1);
  }

  const files = [];
  const items = [];
  const previews = [];
  const skipped = [];
  const seenDisplay = new Set();

  const asset = (relPath) => ({
    rel: relPath,
    url: `${rawBase}/${relPath.split('/').map(encodeURIComponent).join('/')}`,
    abs: path.join(REPO, relPath),
  });

  // The pack cover goes first and carries no itemName: a preview without an
  // itemName is the pack-level listing image. Without it the store falls back
  // to the first item's thumbnail, which is why published packs were showing a
  // random mesh (or a waveform) as their catalog picture.
  const cover = asset(`packs/${slug}/cover.png`);
  if (!existsSync(cover.abs)) {
    console.error(`packs/${slug}/cover.png is missing — every pack needs a listing image.`);
    process.exit(1);
  }
  previews.push({
    fileName: 'cover.png',
    path: cover.rel,
    externalUrl: cover.url,
    sha256: sha256(cover.abs),
    size: statSync(cover.abs).size,
    contentType: 'image/png',
    type: 'Thumbnail',
  });

  const names = readdirSync(modelsDir)
    .filter((n) => statSync(path.join(modelsDir, n)).isDirectory())
    .sort();

  for (const name of names) {
    const glb = asset(`packs/${slug}/models/${name}/${name}.glb`);
    if (!existsSync(glb.abs)) {
      skipped.push(`${name} (no glb)`);
      continue;
    }
    const dn = displayName(name);
    if (seenDisplay.has(dn)) {
      console.error(`${slug}: duplicate display name '${dn}' — item matching would collide.`);
      process.exit(1);
    }
    seenDisplay.add(dn);

    files.push({
      fileName: `${name}.glb`,
      path: glb.rel,
      externalUrl: glb.url,
      sha256: sha256(glb.abs),
      size: statSync(glb.abs).size,
      role: 'Mesh',
    });

    const category = categorize(name);
    items.push({
      name: dn,
      itemType: 'Model',
      metadataJson: JSON.stringify({ category }),
      isPreviewable: true,
      files: [{ path: glb.rel, role: 'Mesh' }],
    });

    const png = asset(`packs/${slug}/models/${name}/${name}.png`);
    if (existsSync(png.abs)) {
      previews.push({
        fileName: `${name}.png`,
        path: png.rel,
        externalUrl: png.url,
        sha256: sha256(png.abs),
        size: statSync(png.abs).size,
        contentType: 'image/png',
        type: 'Thumbnail',
        itemName: dn,
      });
    } else {
      skipped.push(`${name} (no png preview)`);
    }

    const webp = asset(`packs/${slug}/models/${name}/${name}.webp`);
    if (existsSync(webp.abs)) {
      previews.push({
        fileName: `${name}.webp`,
        path: webp.rel,
        externalUrl: webp.url,
        sha256: sha256(webp.abs),
        size: statSync(webp.abs).size,
        contentType: 'image/webp',
        type: 'Turntable', // animated turntable; <img> plays it natively
        itemName: dn,
      });
    }
  }

  // Keys match the sounds repo's multi-pack manifest so one submitter reads both:
  // name/creator/website/description/license become the store listing's title,
  // credit fields and licence.
  packs.push({
    name: meta.name,
    creator: meta.creator,
    website: meta.website,
    description: meta.description,
    license: meta.license,
    folder: `packs/${slug}`,
    itemCount: items.length,
    items,
    files,
    previews,
  });

  const byCategory = new Map();
  for (const item of items) {
    const cat = JSON.parse(item.metadataJson).category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(item.name);
  }
  const bytes = files.reduce((a, f) => a + f.size, 0);
  console.log(
    `${meta.name}: ${items.length} models, ${files.length} files, ${previews.length} previews, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(
    '  categories:',
    [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)
      .map(([c, n]) => `${c}=${n.length}`).join(', '));
  if (skipped.length) console.log(`  skipped: ${skipped.join(', ')}`);
}

writeFileSync(
  path.join(REPO, 'store-manifest.json'),
  JSON.stringify({ source: `https://github.com/${OWNER_REPO}`, license: 'CC0', packs }, null, 1)
);

console.log(`\npinned to ${PINNED_SHA}`);
console.log(`wrote store-manifest.json (${packs.length} pack(s))`);
