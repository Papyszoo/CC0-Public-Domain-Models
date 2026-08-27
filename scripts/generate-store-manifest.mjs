#!/usr/bin/env node
// Generates store-manifest.json per pack (inside packs/<slug>/store-manifest.json):
// the ModelibrStore "external pack" manifest for each pack under packs/.
//
// Usage:
//   node scripts/generate-store-manifest.mjs --pack <slug>   # Generate manifest for one pack
//   node scripts/generate-store-manifest.mjs [--all]        # Generate manifests for all packs
//   node scripts/generate-store-manifest.mjs --root         # Also write combined root store-manifest.json
//
// One pack = one directory under packs/, holding a pack.json (authored
// metadata), a cover.png, models/<slug>/<slug>.{glb,png,webp}, and store-manifest.json.

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OWNER_REPO = 'Papyszoo/CC0-Public-Domain-Models';

const args = process.argv.slice(2);
const packArgIndex = args.indexOf('--pack');
const targetPackSlug = packArgIndex !== -1 ? args[packArgIndex + 1] : null;
const writeRoot = args.includes('--root');

// ---------------------------------------------------------------------------
// Keyword → standard Model category (ModelibrStore docs/taxonomy.json v1).
// ---------------------------------------------------------------------------
const KEYWORD_CATEGORIES = [
  [['sword', 'dagger', 'shuriken', 'katana', 'mace', 'spear', 'shield', 'bow?', 'arrow', 'arrowhead', 'bullet', 'grenade', 'cannon', 'gun', 'rifle', 'pistol', 'ammo', 'battle', 'blade', 'axe', 'crossbow', 'quiver', 'sheath', 'scabbard', 'flail', 'halberd', 'club', 'cartridge', 'gladius', 'saber', 'sai', 'khukuri', 'kakute', 'bomb', 'duster', 'knuckle', 'harpoon', 'trident', 'whip', 'slingshot', 'cleaver?weapon', 'warhammer', 'blaster', 'trap', 'spikes', 'turret', 'missile', 'laser'], 'Weapons'],
  [['helmet', 'armor', 'armour', 'gauntlet', 'boot', 'glove', 'hat', 'cap', 'belt', 'cloak', 'shoe', 'sandal', 'crown', 'mask', 'shirt', 'pants', 'dress', 'sock', 'scarf', 'jacket', 'bowtie', 'tie', 'loafer', 'fedora', 'shoelace', 'glasses', 'sunglasses', 'spectacles', 'eyewear', 'goggles', 'backpack', 'buckle', 'badge', 'headgear', 'costume'], 'Armor & Clothing'],
  [['guitar', 'drum', 'violin', 'flute', 'piano', 'trumpet', 'harp', 'banjo', 'accordion', 'microphone', 'metronome', 'tambourine', 'xylophone', 'bell', 'glockenspiel', 'kalimba', 'fretboard', 'plectrum', 'note', 'vinyl'], 'Music & Instruments'],
  [['dice', 'chess', 'domino', 'card', 'toy', 'teddy', 'puzzle', 'dart', 'billiard', 'bowling', 'baseball', 'basketball', 'football', 'tennis', 'golf', 'hockey', 'ski', 'skateboard', 'balloon', 'kite', 'yoyo', 'arcade', 'pinball', 'flipper', 'cricket', 'volleyball', 'dreidel', 'jigsaw', 'skatepark', 'ramp', 'kicker', 'goal', 'podium', 'dumbbell', 'kettlebell', 'strengthener', 'glowstick', 'block', 'target', 'checkpoint', 'dummy', 'coin', 'gem', 'flag', 'flagpole', 'brick', 'marble', 'coaster', 'minigolf', 'halfpipe', 'rail_skate'], 'Toys & Games'],
  [['apple', 'avocado', 'advocado', 'banana', 'bread', 'cake', 'cheese', 'egg', 'meat', 'pizza', 'fruit', 'vegetable', 'carrot', 'potato', 'tomato', 'onion', 'lemon', 'orange', 'pear', 'grape', 'melon', 'berry', 'mushroom?food', 'mug', 'teapot', 'kettle', 'plate', 'bowl', 'cup', 'goblet', 'fork', 'spoon', 'whisk', 'pan', 'pot', 'jug', 'jar', 'bottle', 'glass', 'tray', 'chopstick', 'ladle', 'grater', 'colander', 'corkscrew', 'cutlery', 'saucer', 'pitcher', 'flask', 'tankard', 'cauldron', 'skillet', 'spatula', 'rolling', 'toaster', 'donut', 'doughnut', 'cookie', 'croissant', 'baguette', 'sausage', 'steak', 'fish?food', 'pumpkin', 'corn', 'wine', 'beer', 'coffee', 'tea', 'knife', 'cleaver', 'mezzaluna', 'chopper', 'tenderiser', 'canned', 'can', 'tin', 'cheeseburger', 'burger', 'chilli', 'squash', 'salmon', 'fillet', 'cork', 'champagne', 'drink', 'soda', 'ice', 'lolly', 'cupcake', 'flan', 'loaf', 'decanter', 'popcorn', 'pretzel', 'sushi', 'taco', 'waffle', 'pancake', 'toast', 'sandwich', 'noodle', 'rice', 'sauce', 'lollipop', 'chocolate', 'food', 'kebab', 'sundae', 'pie', 'pasta', 'meal', 'soup', 'salt', 'pepper', 'stove', 'fryer', 'microwave', 'condiment', 'shaker', 'saucepan', 'ginger', 'turkey', 'soy', 'carton', 'milk', 'juice', 'honey', 'muffin', 'waffles', 'ham', 'bacon', 'chicken', 'pepperoni', 'olive', 'salami', 'candy'], 'Food & Kitchen'],
  [['table', 'chair', 'stool', 'bench', 'shelf', 'shelving', 'cabinet', 'drawer', 'desk', 'bed', 'bedside', 'couch', 'sofa', 'wardrobe', 'dresser', 'bookcase', 'ottoman', 'armchair', 'crib', 'bunk', 'nightstand', 'sideboard', 'stepstool', 'locker', 'counter', 'stand', 'closet', 'bathtub', 'sink', 'mirror', 'cushion', 'pillow'], 'Furniture'],
  [['architrave', 'beam', 'column', 'pillar', 'door', 'window', 'wall', 'stair', 'staircase', 'roof', 'fence', 'arch', 'brick_wall', 'gutter', 'awning', 'balustrade', 'banister', 'cornice', 'skirting', 'lintel', 'sill', 'chimney', 'gate', 'railing', 'scaffold', 'girder', 'truss', 'panel', 'panelling', 'building', 'church', 'tower', 'barrier', 'bollard', 'baluster', 'corrugated', 'drain', 'drainage', 'faucet', 'tap', 'paving', 'tile', 'quoin', 'quoins', 'pergola', 'trellis', 'buttress', 'gazebo', 'bridge', 'well', 'fountain', 'curb', 'curbing', 'coping', 'dado', 'fascia', 'newel', 'ridge', 'spindle', 'grate', 'manhole', 'kennel', 'post', 'kerb', 'capping', 'onlay', 'rail', 'tram', 'skiff?arch', 'floor', 'dungeon', 'castle', 'house', 'windmill', 'road', 'street', 'habitat', 'airlock', 'corridor', 'hex', 'hexagon', 'basemodule', 'module', 'cargodepot', 'depot', 'landingpad', 'tunnel', 'structure', 'garage', 'roofmodule', 'platform', 'dormer', 'balcony', 'monorail', 'track', 'overhang', 'room', 'hangar', 'supports', 'cave', 'stalagmite', 'factory', 'conveyor'], 'Architecture'],
  [['screw', 'nut', 'bolt', 'hammer', 'wrench', 'spanner', 'saw', 'drill', 'plier', 'nail', 'anvil', 'bellows', 'hook', 'axle', 'chisel', 'screwdriver', 'clamp', 'vice', 'vise', 'file', 'rasp', 'trowel', 'shovel', 'spade', 'pickaxe', 'crowbar', 'mallet', 'allen', 'ratchet', 'socket', 'toolbox', 'tape', 'ruler', 'level', 'caliper', 'washer', 'rivet', 'hinge', 'padlock', 'chain', 'rope', 'pulley', 'gear', 'cog', 'spring', 'pipe', 'valve', 'ladder', 'wheelbarrow', 'rake', 'hoe', 'scythe', 'sickle', 'pitchfork', 'bradawl', 'hacksaw', 'sledgehammer', 'plasterers', 'float', 'tweezers', 'lock', 'latch', 'magnet', 'solder', 'wire', 'canister', 'lever', 'switch', 'valve', 'crank', 'button?tool', 'pipes', 'silo', 'crane', 'workbench'], 'Tools & Hardware'],
  [['jack', 'cable', 'plug', 'phone', 'monitor', 'keyboard', 'speaker', 'headphone', 'camera', 'battery', 'switch', 'socket?power', 'laptop', 'computer', 'mouse', 'screen', 'television', 'tv', 'radio', 'antenna', 'circuit', 'led', 'usb', 'charger', 'remote', 'console', 'joystick', 'gamepad', 'alarm', 'detector', 'walkie', 'talkie', 'handset', 'dial', 'knob', 'microwave', 'dryer', 'keycap', 'cd', 'solar', 'panel?power', 'server', 'radar', 'dish', 'generator', 'solarpanel', 'windturbine', 'turbine', 'satellite', 'machine', 'robot'], 'Electronics'],
  [['acorn', 'leaf', 'rock', 'boulder', 'tree', 'branch', 'log', 'stump', 'mushroom', 'flower', 'plant', 'bush', 'grass', 'vine', 'pinecone', 'seashell', 'shell', 'coral', 'stone', 'pebble', 'stick', 'twig', 'root', 'cactus', 'fern', 'moss', 'lily', 'pad', 'firewood', 'crystal', 'diamond', 'dirt', 'snow', 'snowflake', 'seaweed', 'stake', 'river', 'water', 'coast', 'forest', 'terrain', 'cliff', 'ground', 'patch', 'flowerbed', 'sand', 'meteor'], 'Nature'],
  [['dog', 'cat', 'fish', 'bird', 'horse', 'cow', 'pig', 'sheep', 'chicken', 'duck', 'rabbit', 'frog', 'snake', 'rattlesnake', 'spider', 'deer', 'bull', 'stag', 'boar', 'bone', 'skull?animal', 'antler', 'horn', 'feather', 'egg?nest', 'wing', 'tooth', 'claw', 'fang', 'skeleton', 'skull', 'bat', 'ghost', 'creature', 'monster', 'alien', 'pet', 'cube_pet'], 'Creatures & Animals'],
  [['car', 'truck', 'boat', 'ship', 'cart', 'wagon', 'wheel', 'tire', 'tyre', 'bicycle', 'bike', 'motorcycle', 'plane', 'helicopter', 'canoe', 'kayak', 'sled', 'anchor', 'oar', 'paddle?boat', 'rudder', 'propeller', 'skiff', 'cartwheel', 'wheelchair', 'hubcap', 'glider', 'traffic', 'guard', 'rover', 'vehicle', 'van', 'taxi', 'bus', 'train', 'capsule', 'spacetruck', 'lander', 'trailer', 'ambulance', 'firetruck', 'police', 'tractor', 'chassis', 'cockpit', 'craft', 'ufo', 'rocket', 'speeder', 'race', 'locomotive', 'watercraft', 'speedboat', 'yacht', 'jetski'], 'Vehicles'],
  [['human', 'male', 'female', 'mannequin', 'peg_person', 'character', 'knight', 'mage', 'rogue', 'barbarian', 'adventurer', 'astronaut', 'survivor', 'pirate', 'worker', 'protagonist', 'survivor'], 'Characters'],
  [['vase', 'statue', 'sculpture', 'picture', 'frame', 'painting', 'banner', 'flag', 'trophy', 'ornament', 'figurine', 'candelabra', 'chandelier', 'wreath', 'garland', 'ribbon', 'speech', 'sign', 'signpost', 'plaque', 'pedestal', 'plinth', 'birdhouse', 'wind_chime', 'gnome', 'symbol', 'logo', 'icon', 'bead', 'knot', 'star', 'fleur', 'urn', 'obelisk', 'crescent', 'moon', 'sun', 'sundial', 'poster', 'planter', 'pottery', 'brazier', 'tombstone', 'gravestone', 'coffin', 'crypt', 'fountain', 'monument', 'cross', 'altar', 'snowman', 'present'], 'Decorative'],
  [['vent', 'candle', 'clock', 'mirror', 'lamp', 'lantern', 'broom', 'bucket', 'basket', 'bin', 'ashtray', 'ash', 'towel', 'soap', 'brush', 'comb', 'razor', 'toothbrush', 'pillow', 'cushion', 'blanket', 'curtain', 'rug', 'carpet', 'hanger', 'sponge', 'mop', 'dustpan', 'plunger', 'scissors', 'needle', 'thread', 'button', 'zipper', 'umbrella', 'cane', 'crutch', 'bandage', 'syringe', 'thermometer', 'pill', 'book', 'pen', 'pencil', 'paper', 'envelope', 'scroll', 'quill', 'inkwell', 'stamp', 'key', 'wallet', 'purse', 'bag', 'suitcase', 'chest', 'crate', 'barrel', 'box', 'sack', 'pouch', 'abacus', 'hourglass', 'telescope', 'binoculars', 'magnifying', 'compass', 'globe', 'map', 'beaker', 'vial', 'test_tube', 'auction', 'adhesive', 'toilet', 'tongs', 'poker', 'fireplace', 'paintbrush', 'clip', 'paperclip', 'staple', 'stapler', 'lighter', 'funnel', 'pipette', 'petri', 'burner', 'diffuser', 'spray', 'peg', 'tag', 'folder', 'notebook', 'chalkboard', 'noticeboard', 'mat', 'straw', 'trolley', 'plaster', 'blister', 'lipstick', 'tube', 'torch', 'plantpot', 'cargo', 'container', 'containers', 'cargobox', 'register', 'cart_grocery', 'cash'], 'Household'],
];

function categorize(name) {
  const segments = name.toLowerCase().split('_').filter(Boolean)
    .map((seg) => (seg.endsWith('s') && seg.length > 3 ? seg.slice(0, -1) : seg));
  const rawLower = name.toLowerCase();
  for (const [keywords, category] of KEYWORD_CATEGORIES) {
    for (const raw of keywords) {
      const kw = raw.split('?')[0];
      if (segments.includes(kw) || rawLower.startsWith(kw)) return category;
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
let packSlugs = readdirSync(packsDir)
  .filter((n) => existsSync(path.join(packsDir, n, 'pack.json')))
  .sort();

if (targetPackSlug) {
  if (!packSlugs.includes(targetPackSlug)) {
    console.error(`Pack '${targetPackSlug}' not found under packs/`);
    process.exit(1);
  }
  packSlugs = [targetPackSlug];
}

const REQUIRED_PACK_KEYS = ['name', 'creator', 'website', 'license', 'description'];
const allPacks = [];

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

  // Get pinned commit SHA for this pack
  let packSha;
  try {
    packSha = execSync(`git log -1 --format=%H -- packs/${slug}`, { cwd: REPO }).toString().trim();
  } catch {}
  if (!packSha) {
    try {
      packSha = execSync('git log -1 --format=%H', { cwd: REPO }).toString().trim();
    } catch {}
  }
  const rawBase = `https://raw.githubusercontent.com/${OWNER_REPO}/${packSha || 'main'}`;

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

  const itemsJsonPath = path.join(packRoot, 'items.json');
  let itemsData = {};
  if (existsSync(itemsJsonPath)) {
    try {
      itemsData = JSON.parse(readFileSync(itemsJsonPath, 'utf8'));
    } catch {}
  }

  const names = readdirSync(modelsDir)
    .filter((n) => statSync(path.join(modelsDir, n)).isDirectory())
    .sort();

  for (const name of names) {
    const glb = asset(`packs/${slug}/models/${name}/${name}.glb`);
    if (!existsSync(glb.abs)) {
      skipped.push(`${name} (no glb)`);
      continue;
    }
    const itemData = itemsData[name] || {};
    const dn = itemData.name || displayName(name);
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

    const category = itemData.category || categorize(name);
    const subcategory = itemData.subcategory || null;
    const description = itemData.description || null;
    const tags = Array.isArray(itemData.tags) ? itemData.tags : [];
    const styles = Array.isArray(itemData.styles) ? itemData.styles : [];
    const themes = Array.isArray(itemData.themes) ? itemData.themes : [];

    const technicalMeta = {};
    for (const [k, v] of Object.entries(itemData)) {
      if (!['name', 'category', 'subcategory', 'description', 'tags', 'styles', 'themes', 'themeNeutral'].includes(k)) {
        technicalMeta[k] = v;
      }
    }
    const metadataJson = Object.keys(technicalMeta).length > 0 ? JSON.stringify(technicalMeta) : null;

    items.push({
      name: dn,
      itemType: 'Model',
      description,
      tags,
      category,
      subcategory,
      styles,
      themes,
      metadataJson,
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
        type: 'Turntable',
        itemName: dn,
      });
    }
  }

  const packManifest = {
    source: `https://github.com/${OWNER_REPO}`,
    license: meta.license || 'CC0',
    name: meta.name,
    creator: meta.creator,
    website: meta.website,
    description: meta.description,
    folder: `packs/${slug}`,
    pinnedSha: packSha,
    itemCount: items.length,
    items,
    files,
    previews,
  };

  // Write per-pack manifest: packs/<slug>/store-manifest.json
  const packManifestPath = path.join(packRoot, 'store-manifest.json');
  writeFileSync(packManifestPath, JSON.stringify(packManifest, null, 2));

  allPacks.push(packManifest);

  const byCategory = new Map();
  for (const item of items) {
    const cat = JSON.parse(item.metadataJson).category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(item.name);
  }
  const bytes = files.reduce((a, f) => a + f.size, 0);
  console.log(
    `[${slug}] ${meta.name}: ${items.length} models, ${files.length} files, ${previews.length} previews, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB (pinned: ${packSha ? packSha.slice(0, 8) : 'HEAD'})`);
}

if (writeRoot) {
  writeFileSync(
    path.join(REPO, 'store-manifest.json'),
    JSON.stringify({ source: `https://github.com/${OWNER_REPO}`, license: 'CC0', packs: allPacks }, null, 1)
  );
  console.log(`\nwrote root store-manifest.json (${allPacks.length} pack(s))`);
}
