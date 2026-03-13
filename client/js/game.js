// Constants (inline since we can't import Python files)
// THREE.js is loaded via script tag in HTML

const BLOCK_TYPES = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  WATER: 6,
  SAND: 7,
  CHEST: 8,
  COAL_ORE: 10,
  IRON_ORE: 11,
  GOLD_ORE: 12,
  DIAMOND_ORE: 13,
  FLOWERS: 18,
  TALL_GRASS: 19,
  LOG: 20,
  PLANKS: 21,
  COBBLESTONE: 30,
  BRICK: 31,
  GLASS: 32,
  WOOL: 40,
  FURNACE: 41,
  CRAFTING_TABLE: 43,
  // New material source blocks
  OAK_LOG: 50,
  PINE_LOG: 51,
  BIRCH_LOG: 52,
  OAK_LEAVES: 53,
  PINE_LEAVES: 54,
  BIRCH_LEAVES: 55,
  BERRY_BUSH: 56,
  THORN_BUSH: 57,
  HERB_SHRUB: 58,
  MUSHROOM_CLUSTER: 59,
  REED_BED: 60,
  FLINT_NODULE: 61,
  CLAY_DEPOSIT: 62,
  SALT_DEPOSIT: 63,
  COPPER_VEIN: 64,
  TIN_VEIN: 65,
  SILVER_VEIN: 66,
  GEM_SEAM: 67,
  // Workstations
  CAMPFIRE: 70,
  TANNING_RACK: 71,
  CARPENTRY_BENCH: 72,
  LOOM: 73,
  SPINNING_WHEEL: 74,
  MASON_TABLE: 75,
  FORGE: 76,
  ANVIL: 77,
  SMELTER: 78,
  ALCHEMY_TABLE: 79,
  ENCHANTING_ALTAR: 80,
  TAILOR_BENCH: 81,
  LEATHERWORKER_BENCH: 82,
  FLETCHING_BENCH: 83
};

const BLOCK_NAMES = Object.fromEntries(Object.entries(BLOCK_TYPES).map(([k, v]) => [v, k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())]));

const TERRAIN_COLORS = {
  [BLOCK_TYPES.GRASS]:       [86, 160, 70],
  [BLOCK_TYPES.DIRT]:        [139, 101, 72],
  [BLOCK_TYPES.STONE]:       [120, 120, 120],
  [BLOCK_TYPES.WOOD]:        [90,  60,  30],
  [BLOCK_TYPES.LEAVES]:      [40, 120, 40],
  [BLOCK_TYPES.WATER]:       [40,  90, 200],
  [BLOCK_TYPES.SAND]:        [210, 190, 120],
  [BLOCK_TYPES.COAL_ORE]:    [80,  80,  80],
  [BLOCK_TYPES.IRON_ORE]:    [150, 130, 110],
  [BLOCK_TYPES.GOLD_ORE]:    [220, 180, 50],
  [BLOCK_TYPES.DIAMOND_ORE]: [70, 200, 220],
  [BLOCK_TYPES.LOG]:         [80,  55,  30],
  [BLOCK_TYPES.PLANKS]:      [195, 165, 100],
  [BLOCK_TYPES.COBBLESTONE]: [105, 105, 105],
  [BLOCK_TYPES.BRICK]:       [160,  80,  70],
  [BLOCK_TYPES.GLASS]:       [170, 215, 230],
  [BLOCK_TYPES.WOOL]:        [200, 200, 200],
  [BLOCK_TYPES.OAK_LOG]:     [90,  60,  30],
  [BLOCK_TYPES.PINE_LOG]:    [80,  50,  25],
  [BLOCK_TYPES.BIRCH_LOG]:   [110,  90,  70],
  [BLOCK_TYPES.OAK_LEAVES]:  [40, 120, 40],
  [BLOCK_TYPES.PINE_LEAVES]: [30,  90,  30],
  [BLOCK_TYPES.BIRCH_LEAVES]:[50, 140,  50],
  [BLOCK_TYPES.BERRY_BUSH]:  [120,  60,  40],
  [BLOCK_TYPES.THORN_BUSH]:  [80,  40,  20],
  [BLOCK_TYPES.HERB_SHRUB]:  [60, 120,  60],
  [BLOCK_TYPES.MUSHROOM_CLUSTER]: [150,  80, 120],
  [BLOCK_TYPES.REED_BED]:    [100, 120,  60],
  [BLOCK_TYPES.FLINT_NODULE]:[90,  90,  95],
  [BLOCK_TYPES.CLAY_DEPOSIT]:[140, 110,  80],
  [BLOCK_TYPES.SALT_DEPOSIT]:[220, 220, 200],
  [BLOCK_TYPES.COPPER_VEIN]: [160, 120,  80],
  [BLOCK_TYPES.TIN_VEIN]:    [140, 140, 130],
  [BLOCK_TYPES.SILVER_VEIN]: [180, 180, 190],
  [BLOCK_TYPES.GEM_SEAM]:    [120,  80, 180],
  [BLOCK_TYPES.CAMPFIRE]:    [100,  50,  30],
  [BLOCK_TYPES.TANNING_RACK]:[80,  50,  30],
  [BLOCK_TYPES.CARPENTRY_BENCH]:[120,  80,  50],
  [BLOCK_TYPES.LOOM]:       [110,  70,  40],
  [BLOCK_TYPES.SPINNING_WHEEL]:[90,  60,  40],
  [BLOCK_TYPES.MASON_TABLE]:[100, 100, 100],
  [BLOCK_TYPES.FORGE]:      [60,  40,  30],
  [BLOCK_TYPES.ANVIL]:      [120, 120, 130],
  [BLOCK_TYPES.SMELTER]:    [80,  60,  50],
  [BLOCK_TYPES.ALCHEMY_TABLE]:[60,  80,  60],
  [BLOCK_TYPES.ENCHANTING_ALTAR]:[100,  60, 120],
  [BLOCK_TYPES.TAILOR_BENCH]:[70,  50,  40],
  [BLOCK_TYPES.LEATHERWORKER_BENCH]:[60,  40,  30],
  [BLOCK_TYPES.FLETCHING_BENCH]:[80,  60,  40],
};

const ITEM_TYPES = {
  // Include all block types as placeable items
  ...BLOCK_TYPES,
  // Raw materials
  STICK: 300,
  COAL: 301,
  IRON_INGOT: 302,
  GOLD_INGOT: 303,
  DIAMOND: 304,
  // Plant materials
  WOOD_LOG: 305,
  BRANCH: 306,
  BARK: 307,
  SAP: 308,
  RESIN: 309,
  LEAVES: 310,
  REED: 311,
  GRASS_FIBER: 312,
  HEMP_STALK: 313,
  FLAX_STALK: 314,
  COTTON_BOLL: 315,
  VINE: 316,
  MUSHROOM: 317,
  HERB: 318,
  BERRIES: 319,
  SEEDS: 320,
  NUTS: 321,
  ROOTS: 322,
  FRUIT: 323,
  // Animal materials
  HIDE: 324,
  PELT: 325,
  FUR: 326,
  WOOL_BUNDLE: 327,
  SINEW: 328,
  BONE: 329,
  ANTLER: 330,
  HORN: 331,
  FEATHERS: 332,
  CLAWS: 333,
  TEETH: 334,
  SCALES: 335,
  MEAT: 336,
  FAT: 337,
  MILK: 338,
  EGGS: 339,
  BLOOD_VIAL: 340,
  // Stone and earth materials
  FLINT: 341,
  GRANITE: 342,
  SLATE: 343,
  LIMESTONE: 344,
  MARBLE: 345,
  OBSIDIAN: 346,
  GRAVEL: 347,
  SAND: 348,
  CLAY: 349,
  CHALK: 350,
  SALT: 351,
  SULFUR: 352,
  // Metal ores and ingots
  COPPER_ORE: 353,
  TIN_ORE: 354,
  SILVER_ORE: 355,
  COPPER_INGOT: 356,
  TIN_INGOT: 357,
  SILVER_INGOT: 358,
  BRONZE_INGOT: 359,
  STEEL_INGOT: 360,
  // Processed materials
  PLANKS: 361,
  POLE: 362,
  CARVED_WOOD: 363,
  PULP: 364,
  CHARCOAL: 365,
  FIBER_BUNDLE: 366,
  THREAD: 367,
  TWINE: 368,
  ROPE: 369,
  CLOTH_BOLT: 370,
  FELT: 371,
  PAPER: 372,
  HERBAL_PASTE: 373,
  DYE: 374,
  FLOUR: 375,
  PLANT_OIL: 376,
  DRIED_HERBS: 377,
  CURED_HIDE: 378,
  LEATHER: 379,
  RAWHIDE: 380,
  BONE_NEEDLE: 381,
  BONE_PLATE: 382,
  GLUE: 383,
  TALLOW: 384,
  PARCHMENT: 385,
  CUT_STONE: 386,
  STONE_BRICK: 387,
  CERAMIC: 388,
  POTTERY: 389,
  GLASS_VIAL: 390,
  MORTAR: 391,
  METAL_WIRE: 392,
  METAL_BAND: 393,
  NAILS: 394,
  RIVETS: 395,
  CHAIN_LINKS: 396,
  // Tools
  KNIFE: 400,
  HATCHET: 401,
  SICKLE: 402,
  SHOVEL: 403,
  HAMMER: 404,
  FISHING_ROD: 405,
  SKINNING_KNIFE: 406,
  SHEARS: 407,
  MORTAR_PESTLE: 408,
  NEEDLE_SET: 409,
  HAND_DRILL: 410,
  TONGS: 411,
  // Food items
  ROASTED_MEAT: 450,
  ROASTED_FISH: 451,
  ROASTED_MUSHROOM: 452,
  MUSHROOM_SOUP: 453,
  PORRIDGE: 454,
  HERB_TEA: 455,
  JERKY: 456,
  STEW: 457,
  BREAD: 458,
  BERRY_MASH: 459,
  // Weapons
  WOODEN_SWORD: 100,
  STONE_SWORD: 101,
  IRON_SWORD: 102,
  GOLD_SWORD: 103,
  DIAMOND_SWORD: 104,
  // Pickaxes
  WOODEN_PICKAXE: 110,
  STONE_PICKAXE: 111,
  IRON_PICKAXE: 112,
  GOLD_PICKAXE: 113,
  DIAMOND_PICKAXE: 114,
  // Axes
  WOODEN_AXE: 120,
  STONE_AXE: 121,
  IRON_AXE: 122,
  GOLD_AXE: 123,
  DIAMOND_AXE: 124,
  // Armor
  LEATHER_HELMET: 200,
  LEATHER_CHESTPLATE: 201,
  LEATHER_LEGGINGS: 202,
  LEATHER_BOOTS: 203,
  IRON_HELMET: 210,
  IRON_CHESTPLATE: 211,
  IRON_LEGGINGS: 212,
  IRON_BOOTS: 213,
  DIAMOND_HELMET: 220,
  DIAMOND_CHESTPLATE: 221,
  DIAMOND_LEGGINGS: 222,
  DIAMOND_BOOTS: 223
};

const ITEM_NAMES = {
  // Block items
  0: 'Air',
  1: 'Grass',
  2: 'Dirt',
  3: 'Stone',
  4: 'Wood',
  5: 'Leaves',
  6: 'Water',
  7: 'Sand',
  8: 'Chest',
  10: 'Coal Ore',
  11: 'Iron Ore',
  12: 'Gold Ore',
  13: 'Diamond Ore',
  18: 'Flowers',
  19: 'Tall Grass',
  20: 'Log',
  21: 'Planks',
  30: 'Cobblestone',
  31: 'Brick',
  32: 'Glass',
  40: 'Wool',
  41: 'Furnace',
  43: 'Crafting Table',
  50: 'Oak Log',
  51: 'Pine Log',
  52: 'Birch Log',
  53: 'Oak Leaves',
  54: 'Pine Leaves',
  55: 'Birch Leaves',
  56: 'Berry Bush',
  57: 'Thorn Bush',
  58: 'Herb Shrub',
  59: 'Mushroom Cluster',
  60: 'Reed Bed',
  61: 'Flint Nodule',
  62: 'Clay Deposit',
  63: 'Salt Deposit',
  64: 'Copper Vein',
  65: 'Tin Vein',
  66: 'Silver Vein',
  67: 'Gem Seam',
  70: 'Campfire',
  71: 'Tanning Rack',
  72: 'Carpentry Bench',
  73: 'Loom',
  74: 'Spinning Wheel',
  75: 'Mason Table',
  76: 'Forge',
  77: 'Anvil',
  78: 'Smelter',
  79: 'Alchemy Table',
  80: 'Enchanting Altar',
  81: 'Tailor Bench',
  82: 'Leatherworker Bench',
  83: 'Fletching Bench',
  // Crafted items
  300: 'Stick',
  301: 'Coal',
  302: 'Iron Ingot',
  303: 'Gold Ingot',
  304: 'Diamond',
  305: 'Wood Log',
  306: 'Branch',
  307: 'Bark',
  308: 'Sap',
  309: 'Resin',
  310: 'Leaves',
  311: 'Reed',
  312: 'Grass Fiber',
  313: 'Hemp Stalk',
  314: 'Flax Stalk',
  315: 'Cotton Boll',
  316: 'Vine',
  317: 'Mushroom',
  318: 'Herb',
  319: 'Berries',
  320: 'Seeds',
  321: 'Nuts',
  322: 'Roots',
  323: 'Fruit',
  324: 'Hide',
  325: 'Pelt',
  326: 'Fur',
  327: 'Wool Bundle',
  328: 'Sinew',
  329: 'Bone',
  330: 'Antler',
  331: 'Horn',
  332: 'Feathers',
  333: 'Claws',
  334: 'Teeth',
  335: 'Scales',
  336: 'Meat',
  337: 'Fat',
  338: 'Milk',
  339: 'Eggs',
  340: 'Blood Vial',
  341: 'Flint',
  342: 'Granite',
  343: 'Slate',
  344: 'Limestone',
  345: 'Marble',
  346: 'Obsidian',
  347: 'Gravel',
  348: 'Sand',
  349: 'Clay',
  350: 'Chalk',
  351: 'Salt',
  352: 'Sulfur',
  353: 'Copper Ore',
  354: 'Tin Ore',
  355: 'Silver Ore',
  356: 'Copper Ingot',
  357: 'Tin Ingot',
  358: 'Silver Ingot',
  359: 'Bronze Ingot',
  360: 'Steel Ingot',
  361: 'Planks',
  362: 'Pole',
  363: 'Carved Wood',
  364: 'Pulp',
  365: 'Charcoal',
  366: 'Fiber Bundle',
  367: 'Thread',
  368: 'Twine',
  369: 'Rope',
  370: 'Cloth Bolt',
  371: 'Felt',
  372: 'Paper',
  373: 'Herbal Paste',
  374: 'Dye',
  375: 'Flour',
  376: 'Plant Oil',
  377: 'Dried Herbs',
  378: 'Cured Hide',
  379: 'Leather',
  380: 'Rawhide',
  381: 'Bone Needle',
  382: 'Bone Plate',
  383: 'Glue',
  384: 'Tallow',
  385: 'Parchment',
  386: 'Cut Stone',
  387: 'Stone Brick',
  388: 'Ceramic',
  389: 'Pottery',
  390: 'Glass Vial',
  391: 'Mortar',
  392: 'Metal Wire',
  393: 'Metal Band',
  394: 'Nails',
  395: 'Rivets',
  396: 'Chain Links',
  400: 'Knife',
  401: 'Hatchet',
  402: 'Sickle',
  403: 'Shovel',
  404: 'Hammer',
  405: 'Fishing Rod',
  406: 'Skinning Knife',
  407: 'Shears',
  408: 'Mortar & Pestle',
  409: 'Needle Set',
  410: 'Hand Drill',
  411: 'Tongs',
  450: 'Roasted Meat',
  451: 'Roasted Fish',
  452: 'Roasted Mushroom',
  453: 'Mushroom Soup',
  454: 'Porridge',
  455: 'Herb Tea',
  456: 'Jerky',
  457: 'Stew',
  458: 'Bread',
  459: 'Berry Mash',
  100: 'Wooden Sword',
  101: 'Stone Sword',
  102: 'Iron Sword',
  103: 'Gold Sword',
  104: 'Diamond Sword',
  110: 'Wooden Pickaxe',
  111: 'Stone Pickaxe',
  112: 'Iron Pickaxe',
  113: 'Gold Pickaxe',
  114: 'Diamond Pickaxe',
  120: 'Wooden Axe',
  121: 'Stone Axe',
  122: 'Iron Axe',
  123: 'Gold Axe',
  124: 'Diamond Axe',
  200: 'Leather Helmet',
  201: 'Leather Chestplate',
  202: 'Leather Leggings',
  203: 'Leather Boots',
  210: 'Iron Helmet',
  211: 'Iron Chestplate',
  212: 'Iron Leggings',
  213: 'Iron Boots',
  220: 'Diamond Helmet',
  221: 'Diamond Chestplate',
  222: 'Diamond Leggings',
  223: 'Diamond Boots',
  112: 'Iron Pickaxe',
  113: 'Gold Pickaxe',
  114: 'Diamond Pickaxe',
  120: 'Wooden Axe',
  121: 'Stone Axe',
  122: 'Iron Axe',
  123: 'Gold Axe',
  124: 'Diamond Axe',
  130: 'Wooden Shovel',
  131: 'Stone Shovel',
  132: 'Iron Shovel',
  133: 'Gold Shovel',
  134: 'Diamond Shovel',
  200: 'Leather Helmet',
  201: 'Leather Chestplate',
  202: 'Leather Leggings',
  203: 'Leather Boots',
  210: 'Iron Helmet',
  211: 'Iron Chestplate',
  212: 'Iron Leggings',
  213: 'Iron Boots',
  220: 'Diamond Helmet',
  221: 'Diamond Chestplate',
  222: 'Diamond Leggings',
  223: 'Diamond Boots'
};

const ITEM_COLORS = {
  300: '#8B4513', // Stick - brown
  301: '#1C1C1C', // Coal - black
  302: '#B8B8B8', // Iron Ingot - light gray
  303: '#FFD700', // Gold Ingot - gold
  304: '#00FFFF', // Diamond - cyan
  305: '#FFFFFF', // String - white
  306: '#FFFF99', // Feather - light yellow
  307: '#666666', // Flint - gray
  100: '#8B4513', // Wooden Sword - brown
  101: '#888888', // Stone Sword - gray
  102: '#B8B8B8', // Iron Sword - light gray
  103: '#FFD700', // Gold Sword - gold
  104: '#00FFFF', // Diamond Sword - cyan
  110: '#8B4513', // Wooden Pickaxe - brown
  111: '#888888', // Stone Pickaxe - gray
  112: '#B8B8B8', // Iron Pickaxe - light gray
  113: '#FFD700', // Gold Pickaxe - gold
  114: '#00FFFF', // Diamond Pickaxe - cyan
  120: '#8B4513', // Wooden Axe - brown
  121: '#888888', // Stone Axe - gray
  122: '#B8B8B8', // Iron Axe - light gray
  123: '#FFD700', // Gold Axe - gold
  124: '#00FFFF', // Diamond Axe - cyan
  130: '#8B4513', // Wooden Shovel - brown
  131: '#888888', // Stone Shovel - gray
  132: '#B8B8B8', // Iron Shovel - light gray
  133: '#FFD700', // Gold Shovel - gold
  134: '#00FFFF', // Diamond Shovel - cyan
  200: '#A0522D', // Leather Helmet - sienna
  201: '#A0522D', // Leather Chestplate - sienna
  202: '#A0522D', // Leather Leggings - sienna
  203: '#A0522D', // Leather Boots - sienna
  210: '#B8B8B8', // Iron Helmet - light gray
  211: '#B8B8B8', // Iron Chestplate - light gray
  212: '#B8B8B8', // Iron Leggings - light gray
  213: '#B8B8B8', // Iron Boots - light gray
  220: '#00FFFF', // Diamond Helmet - cyan
  221: '#00FFFF', // Diamond Chestplate - cyan
  222: '#00FFFF', // Diamond Leggings - cyan
  223: '#00FFFF'  // Diamond Boots - cyan
};

// Crafting recipes database
const CRAFTING_RECIPES = [
  // Tools
  {
    id: 'wooden_sword',
    result: { type: ITEM_TYPES.WOODEN_SWORD, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.PLANKS, count: 2 },
      { type: ITEM_TYPES.STICK, count: 1 }
    ],
    shape: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 2, 0]
    ]
  },
  {
    result: { type: ITEM_TYPES.STONE_SWORD, count: 1 },
    id: 'stone_sword',
    ingredients: [
      { type: BLOCK_TYPES.COBBLESTONE, count: 2 },
      { type: ITEM_TYPES.STICK, count: 1 }
    ],
    shape: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 2, 0]
    ]
  },
  {
    id: 'iron_sword',
    result: { type: ITEM_TYPES.IRON_SWORD, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.IRON_INGOT, count: 2 },
      { type: ITEM_TYPES.STICK, count: 1 }
    ],
    shape: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 2, 0]
    ]
  },
  {
    id: 'diamond_sword',
    result: { type: ITEM_TYPES.DIAMOND_SWORD, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.DIAMOND, count: 2 },
      { type: ITEM_TYPES.STICK, count: 1 }
    ],
    shape: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 2, 0]
    ]
  },
  {
    result: { type: ITEM_TYPES.WOODEN_PICKAXE, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.PLANKS, count: 3 },
      { type: ITEM_TYPES.STICK, count: 2 }
    ],
    shape: [
      [1, 1, 1],
      [0, 2, 0],
      [0, 2, 0]
    ]
  },
  {
    result: { type: ITEM_TYPES.STONE_PICKAXE, count: 1 },
    ingredients: [
      { type: BLOCK_TYPES.COBBLESTONE, count: 3 },
      { type: ITEM_TYPES.STICK, count: 2 }
    ],
    shape: [
      [1, 1, 1],
      [0, 2, 0],
      [0, 2, 0]
    ]
  },
  {
    result: { type: ITEM_TYPES.IRON_PICKAXE, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.IRON_INGOT, count: 3 },
      { type: ITEM_TYPES.STICK, count: 2 }
    ],
    shape: [
      [1, 1, 1],
      [0, 2, 0],
      [0, 2, 0]
    ]
  },
  {
    result: { type: ITEM_TYPES.DIAMOND_PICKAXE, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.DIAMOND, count: 3 },
      { type: ITEM_TYPES.STICK, count: 2 }
    ],
    shape: [
      [1, 1, 1],
      [0, 2, 0],
      [0, 2, 0]
    ]
  },
  // Basic materials
  {
    id: 'planks',
    result: { type: ITEM_TYPES.PLANKS, count: 4 },
    ingredients: [
      { type: BLOCK_TYPES.WOOD, count: 1 }
    ],
    shape: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  },
  {
    id: 'planks_from_log',
    result: { type: ITEM_TYPES.PLANKS, count: 4 },
    ingredients: [
      { type: ITEM_TYPES.WOOD_LOG, count: 1 }
    ],
    shape: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  },
  {
    id: 'sticks',
    result: { type: ITEM_TYPES.STICK, count: 4 },
    ingredients: [
      { type: ITEM_TYPES.PLANKS, count: 2 }
    ],
    shape: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    id: 'sticks_from_log',
    result: { type: ITEM_TYPES.STICK, count: 4 },
    ingredients: [
      { type: ITEM_TYPES.WOOD_LOG, count: 2 }
    ],
    shape: [
      [1, 1, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  },
  {
    id: 'crafting_table',
    result: { type: BLOCK_TYPES.CRAFTING_TABLE, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.PLANKS, count: 4 }
    ],
    shape: [
      [1, 1, 0],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    result: { type: BLOCK_TYPES.CHEST, count: 1 },
    ingredients: [
      { type: ITEM_TYPES.PLANKS, count: 8 }
    ],
    shape: [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1]
    ]
  },
  // Smelting recipes (handled by furnace)
  {
    result: { type: ITEM_TYPES.IRON_INGOT, count: 1 },
    ingredients: [
      { type: BLOCK_TYPES.IRON_ORE, count: 1 }
    ],
    requiresFurnace: true
  },
  {
    result: { type: ITEM_TYPES.GOLD_INGOT, count: 1 },
    ingredients: [
      { type: BLOCK_TYPES.GOLD_ORE, count: 1 }
    ],
    requiresFurnace: true
  },
  {
    result: { type: ITEM_TYPES.COAL, count: 1 },
    ingredients: [
      { type: BLOCK_TYPES.COAL_ORE, count: 1 }
    ],
    requiresFurnace: true
  }
];

// Equipment stats
const EQUIPMENT_STATS = {
  // Weapons (damage)
  [ITEM_TYPES.WOODEN_SWORD]: { damage: 4, durability: 59 },
  [ITEM_TYPES.STONE_SWORD]: { damage: 5, durability: 131 },
  [ITEM_TYPES.IRON_SWORD]: { damage: 6, durability: 250 },
  [ITEM_TYPES.GOLD_SWORD]: { damage: 4, durability: 32 },
  [ITEM_TYPES.DIAMOND_SWORD]: { damage: 7, durability: 1561 },
  // Tools (efficiency)
  [ITEM_TYPES.WOODEN_PICKAXE]: { efficiency: 1, durability: 59 },
  [ITEM_TYPES.STONE_PICKAXE]: { efficiency: 2, durability: 131 },
  [ITEM_TYPES.IRON_PICKAXE]: { efficiency: 3, durability: 250 },
  [ITEM_TYPES.GOLD_PICKAXE]: { efficiency: 1, durability: 32 },
  [ITEM_TYPES.DIAMOND_PICKAXE]: { efficiency: 4, durability: 1561 },
  // Armor (protection)
  [ITEM_TYPES.LEATHER_HELMET]: { protection: 1, durability: 55 },
  [ITEM_TYPES.LEATHER_CHESTPLATE]: { protection: 3, durability: 80 },
  [ITEM_TYPES.LEATHER_LEGGINGS]: { protection: 2, durability: 75 },
  [ITEM_TYPES.LEATHER_BOOTS]: { protection: 1, durability: 65 },
  [ITEM_TYPES.IRON_HELMET]: { protection: 2, durability: 165 },
  [ITEM_TYPES.IRON_CHESTPLATE]: { protection: 5, durability: 240 },
  [ITEM_TYPES.IRON_LEGGINGS]: { protection: 4, durability: 225 },
  [ITEM_TYPES.IRON_BOOTS]: { protection: 2, durability: 195 },
  [ITEM_TYPES.DIAMOND_HELMET]: { protection: 3, durability: 363 },
  [ITEM_TYPES.DIAMOND_CHESTPLATE]: { protection: 8, durability: 528 },
  [ITEM_TYPES.DIAMOND_LEGGINGS]: { protection: 6, durability: 495 },
  [ITEM_TYPES.DIAMOND_BOOTS]: { protection: 3, durability: 429 }
};

const MESSAGE_TYPES = {
  REGISTER: 'register',
  LOGIN: 'login',
  LOGOUT: 'logout',
  JOIN: 'join',
  MOVE: 'move',
  JUMP: 'jump',
  PLACE_BLOCK: 'place_block',
  BREAK_BLOCK: 'break_block',
  INTERACT: 'interact',
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave',
  PLAYER_MOVE: 'player_move',
  WORLD_UPDATE: 'world_update',
  CHUNK_DATA: 'chunk_data',
  INVENTORY_UPDATE: 'inventory_update',
  GAME_STATE: 'game_state',
  OPEN_CONTAINER: 'open_container',
  CLOSE_CONTAINER: 'close_container',
  CONTAINER_DATA: 'container_data',
  MOVE_ITEM: 'move_item',
  SELECT_QUICKBAR: 'select_quickbar',
  SPAWN_ITEM_ENTITY: 'spawn_item_entity',
  REMOVE_ITEM_ENTITY: 'remove_item_entity',
  COLLECT_ITEM: 'collect_item',
  TOGGLE_ITEM_LOCK: 'toggle_item_lock',
  ITEM_LOCK_STATUS: 'item_lock_status',
  CHAT_MESSAGE: 'chat_message',
  CHAT_COMMAND: 'chat_command',
  CHAT_WHISPER: 'chat_whisper',
  CHAT_SYSTEM: 'chat_system',
  DROP_ITEM: 'drop_item',
  CRAFT_ITEM: 'craft_item',
  CRAFTING_RECIPE: 'crafting_recipe',
  EQUIP_ITEM: 'equip_item',
  UNEQUIP_ITEM: 'unequip_item',
  EQUIPMENT_UPDATE: 'equipment_update',
  COMBAT_HIT: 'combat_hit',
  COMBAT_DAMAGE: 'combat_damage',
  MOB_SPAWN: 'mob_spawn',
  MOB_DESPAWN: 'mob_despawn',
  MOB_MOVE: 'mob_move',
  MOB_ATTACK: 'mob_attack',
  PLAYER_DAMAGE: 'player_damage',
  PLAYER_HEAL: 'player_heal',
  PLAYER_DEATH: 'player_death',
  PLAYER_UPDATE: 'player_update',
  GIVE_ITEMS: 'give_items',
  NPC_SPAWN: 'npc_spawn',
  NPC_INTERACT: 'npc_interact',
  NPC_DIALOGUE: 'npc_dialogue',
  QUEST_ACCEPT: 'quest_accept',
  QUEST_PROGRESS: 'quest_progress',
  QUEST_COMPLETE: 'quest_complete',
  PLAYER_STATS: 'player_stats',
  PLAYER_LEVEL_UP: 'player_level_up'
};

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;
const BLOCK_SIZE = 1;
const GRAVITY = -9.81;
const PLAYER_SPEED = 2.5;
const JUMP_FORCE = 8;
const INTERACTION_RANGE = 5;

// Block harvest difficulty (seconds to mine with bare hands)
const BLOCK_HARDNESS = {
  [BLOCK_TYPES.GRASS]: 0.6,
  [BLOCK_TYPES.DIRT]: 0.5,
  [BLOCK_TYPES.STONE]: 3.0,
  [BLOCK_TYPES.WOOD]: 1.5,
  [BLOCK_TYPES.LEAVES]: 0.3,
  [BLOCK_TYPES.SAND]: 0.5,
  [BLOCK_TYPES.CHEST]: 2.5,
};

class VoxelGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.username = '';
    this.socket = null;
    this.scene = null;
    this.camera = null;
    
    // Authentication state
    this.isAuthenticated = false;
    this.sessionId = null;
    this.userId = null;
    
    // Chat state
    this.chatVisible = true;
    this.chatHistory = [];
    this.maxChatMessages = 100;
    
    this.renderer = null;
    this.world = new World();
    this.player = null;
    this.otherPlayers = new Map();
    this.controls = new Controls();
    this.physics = new Physics();
    this.raycaster = new Raycaster();
    this.inventory = new Inventory(this);
    this.ui = new UI();
    this.crafting = new Crafting(this);
    this.playerVOXModel = null; // Cache for player VOX model
    
    this.chunks = new Map();
    this.blockMeshes = new Map();
    this.selectedBlock = BLOCK_TYPES.GRASS;
    
    // Mining (explore/play mode only - edit mode reserved for authorized accounts)
    this.editMode = false;
    this.mining = null; // { position, startTime, hardness }
    this.mineSound = null;
    
    // Item entities
    this.itemEntities = new Map(); // position -> { type, mesh, velocity }
    
    // Enemies
    this.enemies = new Map(); // id -> Enemy
    
    // Equipment panel (initialized after DOM ready)
    this.equipmentPanel = null;
    
    // Status effects
    this.statusEffects = new StatusEffects();
    
    // Item lock state
    this.itemLockEnabled = true;
    
    this.init();
  }

  async init() {
    try {
      console.log('Initializing game...');
      await this.loadPlayerVOXModel();
      this.setupAuth();
      console.log('Auth setup complete');
    } catch (error) {
      console.error('Error during init:', error);
    }
  }

  async loadPlayerVOXModel() {
    if (this.playerVOXModel) {
      return this.playerVOXModel;
    }
    
    try {
      const voxData = await VOXLoader.load('assets/models/villager.vox');
      const geometry = VOXLoader.createGeometry(voxData);
      const material = new THREE.MeshLambertMaterial({ 
        vertexColors: true,
        transparent: true,
        alphaTest: 0.9
      });
      
      this.playerVOXModel = new THREE.Mesh(geometry, material);
      this.playerVOXModel.castShadow = true;
      this.playerVOXModel.receiveShadow = true;
      
      // Scale the model appropriately
      this.playerVOXModel.scale.set(0.5, 0.5, 0.5);
      
      return this.playerVOXModel;
    } catch (error) {
      console.error('Failed to load player VOX model:', error);
      return null;
    }
  }
  
  async createPlayerMesh() {
    // Create a simple player mesh for the local player (mostly for testing)
    // In first-person view, you won't see this
    try {
      const voxModel = await this.loadPlayerVOXModel();
      if (voxModel) {
        this.player.mesh = voxModel.clone();
        this.player.mesh.material = this.player.mesh.material.clone();
        this.player.mesh.material.color.set(0x4488ff); // Blue for local player
      } else {
        // Fallback
        const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const material = new THREE.MeshLambertMaterial({ color: 0x4488ff });
        this.player.mesh = new THREE.Mesh(geometry, material);
      }
      
      this.player.mesh.position.copy(this.player.position);
      this.player.mesh.castShadow = true;
      // Don't add to scene for first-person view
      // this.scene.add(this.player.mesh);
    } catch (error) {
      console.error('Failed to create player mesh:', error);
    }
  }
  
  setupAuth() {
    console.log('Setting up auth...');
    // Hide game canvas initially
    this.canvas.style.display = 'none';
    
    // Show auth screen
    const authScreen = document.getElementById('authScreen');
    if (!authScreen) {
      console.error('authScreen not found!');
      return;
    }
    authScreen.style.display = 'block';
    
    // Setup auth forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    
    console.log('Auth elements:', {
      loginForm: !!loginForm,
      registerForm: !!registerForm,
      showRegister: !!showRegister,
      showLogin: !!showLogin
    });
    
    // Log error if any elements are missing
    if (!loginForm || !registerForm || !showRegister || !showLogin) {
      console.error('Error: Some auth elements not found!');
      return;
    }
    
    // Login form handler
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (username && password) {
        this.login(username, password);
      }
    });
    
    // Register form handler
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('registerUsername').value.trim();
      const password = document.getElementById('registerPassword').value;
      const email = document.getElementById('registerEmail').value.trim();
      if (username && password) {
        this.register(username, password, email);
      }
    });
    
    // Toggle between forms
    showRegister.addEventListener('click', () => {
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'block';
    });
    
    showLogin.addEventListener('click', () => {
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
    });
  }
  
  login(username, password) {
    this.connectToServer();
    this.socket.onopen = () => {
      console.log('Connected to server');
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.LOGIN,
        data: { username, password }
      }));
    };
  }
  
  register(username, password, email) {
    this.connectToServer();
    this.socket.onopen = () => {
      console.log('Connected to server');
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.REGISTER,
        data: { username, password, email }
      }));
    };
  }
  
  handleAuthSuccess(data) {
    this.isAuthenticated = true;
    this.sessionId = data.session_id;
    this.userId = data.user_id;
    this.username = data.username;
    
    // Hide auth screen and show game
    document.getElementById('authScreen').style.display = 'none';
    this.canvas.style.display = 'block';
    
    // Initialize game
    this.initGame();
    
    // Send join message
    this.socket.send(JSON.stringify({
      type: MESSAGE_TYPES.JOIN,
      data: { username: this.username }
    }));
    
    this.ui.showConsole(`Logged in as ${this.username}`);
  }

  connectToServer() {
    this.socket = new WebSocket('ws://localhost:3001');
    
    this.socket.onopen = () => {
      console.log('Connected to server');
    };
    
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      // Handle authentication messages
      if (message.type === 'auth_success') {
        this.handleAuthSuccess(message.data);
        return;
      } else if (message.type === 'error') {
        this.ui.showConsole(`Error: ${message.data.message}`);
        return;
      }
      
      // Only handle game messages if authenticated
      if (!this.isAuthenticated) {
        return;
      }
      
      this.handleServerMessage(message);
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.ui.showConsole('Connection error');
    };
    
    this.socket.onclose = () => {
      console.log('Disconnected from server');
      this.isAuthenticated = false;
      this.sessionId = null;
      this.userId = null;
      // Show auth screen again
      document.getElementById('authScreen').style.display = 'block';
      this.canvas.style.display = 'none';
    };
  }

  initGame() {
    this.setupRenderer();
    this.setupScene();
    this.setupCamera();
    this.setupLights();
    this.setupEventListeners();
    this.setupChatInput();
    this.equipmentPanel    = new EquipmentPanel(this);
    this.explorationTracker = new ExplorationTracker(this);
    this.compass            = new Compass(this);
    this.questJournal       = new QuestJournal(this);
    this._mapTickCounter    = 0;
    this.animate();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x87CEEB); // Sky blue
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      500
    );
    this.camera.position.set(0, 80, 5);
    
    // Orbit camera state
    this.orbitMode = false;
    this.orbitDistance = 30;
    this.orbitYaw = 0;
    this.orbitPitch = -0.5;
  }

  setupLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    
    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Mouse controls - use mousedown for reliable detection during pointer lock
    this._placeTimer = null;
    document.addEventListener('mousedown', (e) => {
      if (!this.controls.pointerLocked) return;
      if (e.button === 0) this.handleMouseDown(e);    // Left click = break/mine
      if (e.button === 2) this.handleRightClickDown(e);  // Right click = place (delayed)
    });
    document.addEventListener('mouseup', (e) => {
      if (!this.controls.pointerLocked) return;
      if (e.button === 2) { clearTimeout(this._placeTimer); this._placeTimer = null; }
      if (e.button === 0) this.handleMouseUp(e);      // Stop mining
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      // Chat toggle - only if not already in chat
      if (e.code === 'KeyT' && document.activeElement.id !== 'chatInput') {
        e.preventDefault();
        this.openChat();
        return;
      }
      
      // Chat input handling
      if (document.activeElement.id === 'chatInput') {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeChat();
          return;
        }
        // Don't process other game keys while typing in chat
        return;
      }
      
      // Quickbar 1-9 selection
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const slot = parseInt(e.code.charAt(5)) - 1;
        this.inventory.selectQuickbar(slot);
        if (this.socket) {
          this.socket.send(JSON.stringify({
            type: MESSAGE_TYPES.SELECT_QUICKBAR,
            data: { slot }
          }));
        }
        return;
      }
      if (e.code === 'KeyE') {
        this.inventory.togglePanel();
        return;
      }
      if (e.code === 'Escape') {
        this.inventory.closeAll();
        if (this.equipmentPanel)    this.equipmentPanel.close();
        if (this.explorationTracker) this.explorationTracker.closeMap();
        if (this.questJournal)      this.questJournal.close();
        return;
      }
      if (e.code === 'KeyL') {
        this.toggleItemLock();
        return;
      }
      if (e.code === 'KeyR') {
        this.interactWithNPC();
        return;
      }
      if (e.code === 'KeyE') {
        this.toggleInventory();
        return;
      }
      // Test enemy spawn (temporary)
      if (e.code === 'KeyK') {
        this.spawnTestEnemy();
        return;
      }
      if (e.code === 'KeyG') {
        this.equipmentPanel.toggle();
        return;
      }
      if (e.code === 'KeyM') {
        if (this.explorationTracker._mapOpen) this.explorationTracker.closeMap();
        else this.explorationTracker.openMap();
        return;
      }
      if (e.code === 'KeyJ') {
        this.questJournal.toggle();
        return;
      }
      this.controls.handleKeyDown(e);
      if (e.code === 'KeyV') this.toggleOrbitMode();
      if (e.code === 'KeyP') this.dumpVoxelDiagnostic();
    });
    document.addEventListener('keyup', (e) => this.controls.handleKeyUp(e));
    
    // Mouse movement for camera
    document.addEventListener('mousemove', (e) => this.controls.handleMouseMove(e));
    
    // Scroll wheel for orbit zoom
    this.canvas.addEventListener('wheel', (e) => {
      if (this.orbitMode) {
        this.orbitDistance = Math.max(5, Math.min(100, this.orbitDistance + e.deltaY * 0.05));
        e.preventDefault();
      }
    }, { passive: false });
    
    // Lock pointer on canvas click
    this.canvas.addEventListener('click', () => {
      if (!this.orbitMode) this.canvas.requestPointerLock();
    });
    
    // Handle pointer lock changes
    document.addEventListener('pointerlockchange', () => {
      this.controls.pointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  handleMouseDown(event) {
    // Check for enemy hits first
    const enemyTarget = this.raycaster.getTargetEnemy(this.camera, this.scene);
    if (enemyTarget && this.player.canAttack()) {
      this.player.attack();
      
      // Calculate damage based on weapon
      const weapon = this.inventory.slots[this.inventory.selectedSlot];
      let damage = 5; // Base damage
      
      if (weapon && weapon.stats && weapon.stats.damage) {
        damage = weapon.stats.damage;
      }
      
      // Add critical hit chance
      const isCritical = Math.random() < 0.1; // 10% chance
      if (isCritical) {
        damage *= 2;
        console.log('CRITICAL HIT!');
      }
      
      // Apply status effects based on weapon type or enchantments
      if (weapon && weapon.enchantments) {
        weapon.enchantments.forEach(enchantment => {
          if (Math.random() < enchantment.chance) {
            this.statusEffects.applyEffect(
              enemyTarget.enemy.id,
              enchantment.effect,
              enchantment.duration
            );
            console.log(`Applied ${enchantment.effect} to enemy!`);
          }
        });
      }
      
      enemyTarget.enemy.takeDamage(damage);
      
      // Send damage to server
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.COMBAT_HIT,
        data: {
          targetId: enemyTarget.enemy.id,
          damage: Math.floor(damage),
          isCritical: isCritical
        }
      }));
      
      return;
    }
    
    const target = this.raycaster.getTargetBlock(this.camera, this.scene);
    if (!target) return;
    
    if (this.editMode) {
      // Instant break in edit mode
      console.log('Breaking block at:', target.position, 'type:', typeof target.position);
      console.log('position.x:', target.position.x, 'position.y:', target.position.y, 'position.z:', target.position.z);
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.BREAK_BLOCK,
        data: { position: { x: target.position.x, y: target.position.y, z: target.position.z } }
      }));
    } else {
      // Start mining in explore mode
      const blockType = this.world.getBlock(target.position.x, target.position.y, target.position.z);
      if (blockType !== BLOCK_TYPES.AIR) {
        const hardness = BLOCK_HARDNESS[blockType] || 1.0;
        console.log('Mining block type', blockType, 'hardness:', hardness);
        this.mining = {
          position: target.position,
          startTime: Date.now(),
          hardness: hardness
        };
        this.startMineSound();
      }
    }
  }

  handleMouseUp(event) {
    if (this.mining) {
      this.mining = null;
      this.stopMineSound();
    }
  }

  toggleEditMode() {
    this.ui.showConsole('Edit mode is not available.');
    if (false) {
    }
  }

  toggleItemLock() {
    if (this.socket) {
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.TOGGLE_ITEM_LOCK,
        data: {}
      }));
    }
  }

  startMineSound() {
    // Simple audio feedback using Web Audio API
    try {
      if (!this.mineSound) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.mineSound = { context: audioContext, oscillator: null };
      }
      const { context } = this.mineSound;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, context.currentTime);
      gain.gain.setValueAtTime(0.05, context.currentTime);
      osc.start();
      this.mineSound.oscillator = osc;
    } catch (e) {
      console.error('Audio error:', e);
    }
  }

  stopMineSound() {
    if (this.mineSound && this.mineSound.oscillator) {
      this.mineSound.oscillator.stop();
      this.mineSound.oscillator = null;
    }
  }

  handleRightClickDown(event) {
    const target = this.raycaster.getTargetBlock(this.camera, this.scene);
    if (!target) return;

    // Chest interaction — always immediate, no delay needed
    const blockType = this.world.getBlock(target.position.x, target.position.y, target.position.z);
    if (blockType === BLOCK_TYPES.CHEST) {
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.OPEN_CONTAINER,
        data: { x: target.position.x, y: target.position.y, z: target.position.z }
      }));
      return;
    }

    // Guard: only place if a block-type item is selected in the quickbar
    const selectedItem = this.inventory.getSelectedItem();
    if (!selectedItem || !BLOCK_NAMES[selectedItem.type]) return;

    // Delay placement — cancel if the mouse is released before 250 ms
    const placePos = target.position.clone().add(target.normal);
    const blockToPlace = selectedItem.type;
    clearTimeout(this._placeTimer);
    this._placeTimer = setTimeout(() => {
      this._placeTimer = null;
      if (!this.controls.pointerLocked) return;
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.PLACE_BLOCK,
        data: {
          position: { x: placePos.x, y: placePos.y, z: placePos.z },
          blockType: blockToPlace
        }
      }));
    }, 250);
  }

  handleRightClick(event) {
    this.handleRightClickDown(event);
  }
  
  handleServerMessage(message) {
    const messageType = message.type;
    
    // Debug log all message types except player_move, block_update, and world_update
    if (messageType !== MESSAGE_TYPES.PLAYER_MOVE && 
        messageType !== MESSAGE_TYPES.BLOCK_UPDATE && 
        messageType !== MESSAGE_TYPES.WORLD_UPDATE) {
      console.log('Received message type:', messageType, 'data:', message.data);
    }
    
    switch (messageType) {
      case MESSAGE_TYPES.GAME_STATE:
        this.handleGameState(message.data);
        break;
      case MESSAGE_TYPES.PLAYER_JOIN:
        this.handlePlayerJoin(message.data);
        break;
      case MESSAGE_TYPES.PLAYER_LEAVE:
        this.handlePlayerLeave(message.data);
        break;
      case MESSAGE_TYPES.PLAYER_MOVE:
        this.handlePlayerMove(message.data);
        break;
      case MESSAGE_TYPES.CHUNK_DATA:
        this.handleChunkData(message.data);
        break;
      case MESSAGE_TYPES.WORLD_UPDATE:
        this.handleWorldUpdate(message.data);
        break;
      case MESSAGE_TYPES.INVENTORY_UPDATE:
        this.inventory.updateFromServer(message.data);
        break;
      case MESSAGE_TYPES.CONTAINER_DATA:
        this.inventory.openContainer(message.data);
        break;
      case MESSAGE_TYPES.SPAWN_ITEM_ENTITY:
        this.spawnItemEntity(
          new THREE.Vector3(message.data.x, message.data.y, message.data.z),
          message.data.type,
          message.data.harvester_id
        );
        break;
      case MESSAGE_TYPES.REMOVE_ITEM_ENTITY:
        this.removeItemEntity(
          new THREE.Vector3(message.data.x, message.data.y, message.data.z)
        );
        break;
      case MESSAGE_TYPES.ITEM_LOCK_STATUS:
        this.itemLockEnabled = message.data.enabled;
        this.ui.showConsole(`Item Lock ${this.itemLockEnabled ? 'ENABLED' : 'DISABLED'} (L key to toggle)`);
        break;
      case MESSAGE_TYPES.PLAYER_DAMAGE:
        this.handlePlayerDamage(message.data);
        break;
      case MESSAGE_TYPES.CHAT_MESSAGE:
        this.addChatMessage(message.data.message, 'normal', {
          username: message.data.username
        });
        break;
      case MESSAGE_TYPES.CHAT_WHISPER:
        this.addChatMessage(message.data.message, 'whisper', {
          direction: message.data.direction,
          from_player: message.data.from_player,
          to_player: message.data.to_player,
          otherPlayer: message.data.direction === 'sent' ? message.data.to_player : message.data.from_player
        });
        break;
      case MESSAGE_TYPES.CHAT_SYSTEM:
        this.addChatMessage(message.data.message, 'system');
        break;
      case MESSAGE_TYPES.CRAFT_ITEM:
        // Crafting result handled by inventory update
        if (message.data.success) {
          this.addChatMessage(`Crafted ${message.data.count}x ${message.data.itemName}`, 'system');
        } else {
          this.addChatMessage(`Crafting failed: ${message.data.reason}`, 'system');
        }
        break;
      case MESSAGE_TYPES.NPC_SPAWN:
        console.log('Received NPC_SPAWN message:', message.data);
        this.spawnNPC(message.data);
        break;
      case MESSAGE_TYPES.NPC_DIALOGUE:
        console.log('Received NPC_DIALOGUE message:', message.data);
        this.showNPCDialogue(message.data);
        break;
      case MESSAGE_TYPES.QUEST_ACCEPT:
        console.log('Received QUEST_ACCEPT message:', message.data);
        this.acceptQuest(message.data);
        break;
      case MESSAGE_TYPES.QUEST_COMPLETE:
        console.log('Received QUEST_COMPLETE message:', message.data);
        this.completeQuest(message.data);
        break;
      case MESSAGE_TYPES.PLAYER_STATS:
        console.log('Received PLAYER_STATS message:', message.data);
        this.updatePlayerStats(message.data);
        break;
      case MESSAGE_TYPES.PLAYER_LEVEL_UP:
        console.log('Received PLAYER_LEVEL_UP message:', message.data);
        this.handleLevelUp(message.data);
        break;
      case MESSAGE_TYPES.QUEST_ACCEPT:
        if (this.questJournal) this.questJournal.addQuest(message.data);
        break;
      case MESSAGE_TYPES.QUEST_COMPLETE:
        if (this.questJournal) this.questJournal.completeQuest(message.data);
        break;
      case MESSAGE_TYPES.MOB_SPAWN:
        this.spawnEnemy(message.data);
        break;
      case MESSAGE_TYPES.MOB_DESPAWN:
        this.despawnEnemy(message.data);
        break;
      case MESSAGE_TYPES.MOB_MOVE:
        this.updateEnemyFromServer(message.data);
        break;
      case MESSAGE_TYPES.MOB_ATTACK:
        this.handleMobAttack(message.data);
        break;
      case MESSAGE_TYPES.EQUIPMENT_UPDATE:
        this.equipmentPanel.applyUpdate(message.data);
        break;
    }
  }

  async handleGameState(data) {
    console.log('Received game state:', data);
    // Store our client ID
    this.clientId = data.playerId;
    console.log('Our client ID:', this.clientId);
    
    this.player = new Player(data.playerId, this.username);
    const playerData = data.players.find(p => p.id === data.playerId);
    this.player.position.fromArray(playerData.position);
    
    // Initialize player stats if provided
    if (playerData.health !== undefined) {
      this.player.health = playerData.health;
      this.player.maxHealth = playerData.max_health || 100;
      this.player.mana = playerData.mana || 50;
      this.player.maxMana = playerData.max_mana || 50;
      this.player.experience = playerData.experience || 0;
      this.player.level = playerData.level || 1;
      this.player.experienceToNextLevel = playerData.experience_to_next_level || 100;
      this.updateStatsUI();
    }
    
    // Create player mesh (for third-person view or testing)
    this.createPlayerMesh();
    
    // Create other players
    console.log('Creating other players from game state...');
    for (const p of data.players) {
      console.log(`Checking player ${p.id} vs local ${data.playerId}`);
      if (p.id !== data.playerId) {
        console.log('Creating other player from game state:', p);
        await this.createOtherPlayer(p);
      }
    }
    
    this.updatePlayerCount(data.players.length);
  }

  async handlePlayerJoin(data) {
    console.log('Player joined:', data);
    await this.createOtherPlayer(data);
    this.updatePlayerCount(this.otherPlayers.size + 1);
    this.ui.showConsole(`${data.username} joined the game`);
  }

  handlePlayerLeave(data) {
    const player = this.otherPlayers.get(data.playerId);
    if (player) {
      this.scene.remove(player.mesh);
      this.otherPlayers.delete(data.playerId);
    }
    this.updatePlayerCount(this.otherPlayers.size + 1);
    this.ui.showConsole(`Player left the game`);
  }

  handlePlayerMove(data) {
    // Ignore move messages for our own player
    if (data.playerId === this.clientId) {
      // Update our own player position on the server
      if (this.player && Array.isArray(data.position)) {
        this.player.position.fromArray(data.position);
      }
      return;
    }
    
    const player = this.otherPlayers.get(data.playerId);
    if (player) {
      console.log(`Moving player ${data.playerId} to`, data.position);
      if (Array.isArray(data.position)) {
        player.position.fromArray(data.position);
      } else {
        player.position.set(data.position.x, data.position.y, data.position.z);
      }
      player.mesh.position.copy(player.position);
    } else {
      console.log(`Player ${data.playerId} not found in otherPlayers`);
    }
  }

  handleChunkData(data) {
    this.world.loadChunk(data.chunkX, data.chunkZ, data.data);
    this.renderChunk(this.scene, data.chunkX, data.chunkZ, this.blockMeshes);
    
    // Re-render already-loaded neighbors so their border faces update correctly
    const neighbors = [
      [data.chunkX + 1, data.chunkZ],
      [data.chunkX - 1, data.chunkZ],
      [data.chunkX, data.chunkZ + 1],
      [data.chunkX, data.chunkZ - 1],
    ];
    for (const [nx, nz] of neighbors) {
      if (this.world.chunks.has(`${nx},${nz}`)) {
        this.renderChunk(this.scene, nx, nz, this.blockMeshes);
      }
    }

    // Render structures if metadata is available
    if (data.metadata) {
      this.renderStructures(data.chunkX, data.chunkZ, { metadata: data.metadata });
    }
    
    console.log(`Loaded chunk (${data.chunkX}, ${data.chunkZ}) - ${data.data.length} blocks`);
    
    // Verify spawn chunk has terrain
    if (data.chunkX === 0 && data.chunkZ === 0) {
      for (let y = 30; y < 40; y++) {
        const block = this.world.getBlock(0, y, 0);
        if (block !== BLOCK_TYPES.AIR) {
          console.log(`Spawn chunk ground at y=${y}: block type ${block}`);
        }
      }
    }
  }

  handleWorldUpdate(data) {
    if (data.action === 'place') {
      this.world.setBlock(data.position.x, data.position.y, data.position.z, data.blockType);
      // Rerender affected chunk
      const chunkX = Math.floor(data.position.x / CHUNK_SIZE);
      const chunkZ = Math.floor(data.position.z / CHUNK_SIZE);
      this.renderChunk(this.scene, chunkX, chunkZ, this.blockMeshes);
    } else if (data.action === 'break') {
      this.world.setBlock(data.position.x, data.position.y, data.position.z, BLOCK_TYPES.AIR);
      // Rerender affected chunk
      const chunkX = Math.floor(data.position.x / CHUNK_SIZE);
      const chunkZ = Math.floor(data.position.z / CHUNK_SIZE);
      this.renderChunk(this.scene, chunkX, chunkZ, this.blockMeshes);
    }
  }

  handleInventoryUpdate(data) {
    this.inventory.updateFromServer(data);
    if (this.questJournal) this.questJournal.updateProgress(data.slots || []);
  }

  async createOtherPlayer(data) {
    const playerId = data.id || data.playerId;  // Handle both field names
    console.log(`Creating other player: ${data.username} (${playerId}) at position`, data.position);
    
    let mesh;
    
    // Try to use VOX model if available
    const voxModel = await this.loadPlayerVOXModel();
    if (voxModel) {
      mesh = voxModel.clone();
      // Give each player a unique color based on their username
      const hue = data.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
      mesh.material = mesh.material.clone();
      mesh.material.color.setHSL(hue / 360, 0.7, 0.5);
    } else {
      // Fallback to simple box
      const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
      const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      mesh = new THREE.Mesh(geometry, material);
    }
    
    // Handle both array and object position formats
    let x, y, z;
    if (Array.isArray(data.position)) {
      x = data.position[0];
      y = data.position[1];
      z = data.position[2];
    } else {
      x = data.position.x;
      y = data.position.y;
      z = data.position.z;
    }
    
    console.log(`Setting player mesh position to: (${x}, ${y}, ${z})`);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    
    this.scene.add(mesh);
    this.otherPlayers.set(playerId, {
      id: playerId,
      username: data.username,
      position: new THREE.Vector3(x, y, z),
      mesh
    });
  }

  updatePlayerCount(count) {
    document.getElementById('playerCount').textContent = count;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = 0.016; // 60 FPS
    
    if (this.player) {
      this.updatePlayer();
      this.updateCamera();
      this.physics.update(this.player, this.world);
      this.raycaster.update(this.camera, this.scene);
      this.ui.updateTargetName(this.raycaster, this.camera, this.world);
      this.updateMining();
      this.updateItemEntities();
      this.updateEnemies(deltaTime);
      
      // Regenerate stamina
      this.player.regenerateStamina(deltaTime);
      this.player.updateDodge();
      
      
      // Update status effects
      this.statusEffects.update(deltaTime);
      this.applyStatusEffects(deltaTime);
      
      // Update stamina UI
      this.updateStaminaUI();
      
      // Update chunk visibility for render optimization
      this.world.updateChunkVisibility(this.camera);

      // Compass every frame (cheap canvas draw)
      if (this.compass) this.compass.update();

      // Exploration tracker tick every ~60 frames (~1 s)
      this._mapTickCounter = (this._mapTickCounter || 0) + 1;
      if (this._mapTickCounter >= 60) {
        this._mapTickCounter = 0;
        if (this.explorationTracker) this.explorationTracker.tick();
      }
    }
    
    // Update biome particle effects
    if (this.biomeParticles) {
      this.biomeParticles.forEach(particle => {
        if (particle.animate) particle.animate();
      });
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer() {
    const moveVector = new THREE.Vector3();
    
    // Track last movement direction for dodge
    if (!this.lastMoveDirection) {
      this.lastMoveDirection = new THREE.Vector3();
      this.lastMoveTime = {};
      this.dodgeThreshold = 200; // ms for double tap
    }
    
    if (this.controls.keys.forward) {
      moveVector.z -= 1;
      this.checkDodge('forward');
    }
    if (this.controls.keys.backward) {
      moveVector.z += 1;
      this.checkDodge('backward');
    }
    if (this.controls.keys.left) {
      moveVector.x -= 1;
      this.checkDodge('left');
    }
    if (this.controls.keys.right) {
      moveVector.x += 1;
      this.checkDodge('right');
    }
    
    if (moveVector.length() > 0) {
      moveVector.normalize();
      
      // Sprint multiplier
      const speedMultiplier = this.controls.keys.sprint && this.player.stamina > 0 ? 1.5 : 1;
      moveVector.multiplyScalar(PLAYER_SPEED * speedMultiplier);
      
      // Apply movement relative to camera direction
      const yaw = this.controls.yaw;
      const rotatedMove = new THREE.Vector3();
      rotatedMove.x = moveVector.x * Math.cos(yaw) + moveVector.z * Math.sin(yaw);
      rotatedMove.z = -moveVector.x * Math.sin(yaw) + moveVector.z * Math.cos(yaw);
      
      // Store last movement direction for dodge
      this.lastMoveDirection.copy(rotatedMove).normalize();
      
      // Apply dodge velocity if dodging
      if (this.player.isDodging) {
        const dodgeSpeed = 8;
        rotatedMove.multiplyScalar(dodgeSpeed);
      }
      
      this.player.velocity.x = rotatedMove.x;
      this.player.velocity.z = rotatedMove.z;
      
      // Drain stamina while sprinting
      if (this.controls.keys.sprint && speedMultiplier > 1) {
        this.player.stamina = Math.max(0, this.player.stamina - 10 * 0.016); // 10 stamina per second
      }
    } else {
      this.player.velocity.x *= 0.8; // Friction
      this.player.velocity.z *= 0.8;
    }
    
    if (this.controls.keys.jump && this.player.onGround) {
      this.player.velocity.y = JUMP_FORCE;
      this.player.onGround = false;
      
      // Send jump to server
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.JUMP
      }));
    }
    
    // Send position update to server
    if (Date.now() - (this.lastPositionUpdate || 0) > 50) { // 20 FPS updates
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.MOVE,
        data: {
          position: [this.player.position.x, this.player.position.y, this.player.position.z],
          velocity: [this.player.velocity.x, this.player.velocity.y, this.player.velocity.z]
        }
      }));
      this.lastPositionUpdate = Date.now();
    }
  }

  checkDodge(direction) {
    const now = Date.now();
    const lastTime = this.lastMoveTime[direction] || 0;
    
    if (now - lastTime < this.dodgeThreshold && this.player.canDodge()) {
      this.player.dodge();
      console.log(`Dodged ${direction}!`);
    }
    
    this.lastMoveTime[direction] = now;
  }

  applyStatusEffects(deltaTime) {
    // Apply effects to player
    this.applyEffectToEntity(this.player, deltaTime);
    
    // Apply effects to enemies
    this.enemies.forEach(enemy => {
      this.applyEffectToEntity(enemy, deltaTime);
    });
  }
  
  applyEffectToEntity(entity, deltaTime) {
    const effects = this.statusEffects.effects.get(entity.id);
    if (!effects) return;
    
    effects.forEach((effect, effectName) => {
      const effectType = StatusEffects.EFFECTS[effectName];
      if (!effectType) return;
      
      // Apply damage over time
      if (effectType.damagePerSecond) {
        entity.health = Math.max(0, entity.health - effectType.damagePerSecond * deltaTime);
      }
      
      // Apply healing over time
      if (effectType.healPerSecond) {
        entity.health = Math.min(entity.maxHealth, entity.health + effectType.healPerSecond * deltaTime);
      }
      
      // Visual effects would go here (particles, etc.)
    });
  }

  updateCamera() {
    if (this.orbitMode) {
      // Orbit camera: circle around player
      if (this.controls.pointerLocked) {
        document.exitPointerLock();
      }
      this.orbitYaw += 0.005; // Auto-spin
      
      const target = this.player.position.clone();
      target.y += 1.0;
      const cx = target.x + this.orbitDistance * Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch);
      const cy = target.y + this.orbitDistance * Math.sin(this.orbitPitch);
      const cz = target.z + this.orbitDistance * Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch);
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(target);
    } else {
      // First-person camera
      this.camera.position.copy(this.player.position);
      this.camera.position.y += 1.6; // Eye level
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.controls.yaw;
      this.camera.rotation.x = this.controls.pitch;
    }
  }

  updateMining() {
    if (!this.mining) return;
    
    // Check if still looking at the same block
    const target = this.raycaster.getTargetBlock(this.camera, this.scene);
    if (!target || !target.position.equals(this.mining.position)) {
      this.mining = null;
      this.stopMineSound();
      return;
    }
    
    // Check if mining time elapsed
    const elapsed = (Date.now() - this.mining.startTime) / 1000;
    if (elapsed >= this.mining.hardness) {
      // Break the block
      console.log(`Mining complete! Breaking block at ${this.mining.position.x}, ${this.mining.position.y}, ${this.mining.position.z}`);
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.BREAK_BLOCK,
        data: { position: { x: this.mining.position.x, y: this.mining.position.y, z: this.mining.position.z } }
      }));
      this.mining = null;
      this.stopMineSound();
    }
  }

  updateItemEntities() {
    const dt = 0.016;
    const collectRadius = 1.5;
    
    for (const [key, entity] of this.itemEntities) {
      // Apply gravity
      entity.velocity.y -= 9.81 * dt;
      
      // Update position
      entity.position.add(entity.velocity.clone().multiplyScalar(dt));
      
      // Ground collision
      const groundY = this.getGroundHeight(entity.position.x, entity.position.z);
      if (entity.position.y <= groundY + 0.2) {
        entity.position.y = groundY + 0.2;
        entity.velocity.y = 0;
        entity.velocity.multiplyScalar(0.8); // Friction
      }
      
      // Update mesh
      entity.mesh.position.copy(entity.position);
      entity.mesh.rotation.y += dt * 2; // Spin animation
      
      // Check collection
      if (this.player && entity.position.distanceTo(this.player.position) < collectRadius) {
        this.collectItem(key, entity);
      }
    }
  }

  updateEnemies(deltaTime) {
    // Update enemy positions and behaviors
    for (const [id, enemy] of this.enemies) {
      if (enemy.health <= 0) continue;
      
      // Simple AI: move towards player if close enough
      const distance = enemy.position.distanceTo(this.player.position);
      if (distance < 20 && distance > 2) {
        const direction = new THREE.Vector3();
        direction.subVectors(this.player.position, enemy.position);
        direction.y = 0; // Keep movement on ground level
        direction.normalize();
        
        enemy.position.add(direction.multiplyScalar(enemy.speed * deltaTime));
        enemy.mesh.position.copy(enemy.position);
      }
      
      // Simple floating animation
      enemy.mesh.position.y = enemy.position.y + Math.sin(Date.now() * 0.002 + id) * 0.1;
    }
  }

  getGroundHeight(x, z) {
    // Simple ground height check
    for (let y = 60; y >= 0; y--) {
      if (this.world.getBlock(Math.floor(x), y, Math.floor(z)) !== BLOCK_TYPES.AIR) {
        return y + 1;
      }
    }
    return 0;
  }

  collectItem(key, entity) {
    // Don't collect if not owned by this player
    if (entity.harvesterId && this.clientId && this.clientId !== entity.harvesterId) {
      return;
    }
    
    // Add to inventory
    const remaining = this.inventory.slots[this.inventory.selectedSlot] === null
      ? 0
      : this.inventory.slots[this.inventory.selectedSlot].count || 0;
    
    // For now just add to selected slot (server will handle proper stacking)
    this.socket.send(JSON.stringify({
      type: MESSAGE_TYPES.COLLECT_ITEM,
      data: { 
        position: entity.position, 
        type: entity.type,
        harvester_id: entity.harvesterId
      }
    }));
    
    // Remove entity
    this.scene.remove(entity.mesh);
    this.itemEntities.delete(key);
  }

  spawnItemEntity(position, itemType, harvesterId = null) {
    console.log('Spawning item entity at', position, 'type:', itemType, 'harvester:', harvesterId);
    const key = `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`;
    if (this.itemEntities.has(key)) return; // Already exists
    
    // Create floating cube
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const color = ITEM_COLORS[itemType] || '#fff';
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y += 0.5; // Float above ground
    mesh.castShadow = true;
    
    // Make item slightly transparent if not owned by this player
    if (harvesterId && this.clientId && this.clientId !== harvesterId) {
      material.transparent = true;
      material.opacity = 0.5;
    }
    
    this.scene.add(mesh);
    
    // Random bounce velocity
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2 + 1,
      (Math.random() - 0.5) * 2
    );
    
    this.itemEntities.set(key, {
      type: itemType,
      mesh,
      position: mesh.position.clone(),
      velocity,
      harvesterId
    });
  }

  removeItemEntity(position) {
    const key = `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`;
    const entity = this.itemEntities.get(key);
    if (entity) {
      this.scene.remove(entity.mesh);
      this.itemEntities.delete(key);
    }
  }
  
  // NPC methods
  spawnNPC(data) {
    console.log('Spawning NPC:', data);
    
    // Create NPC mesh
    const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(data.position[0], data.position[1] + 0.9, data.position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add name label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = 'white';
    context.fillRect(0, 0, 256, 64);
    context.fillStyle = 'black';
    context.font = '24px Arial';
    context.textAlign = 'center';
    context.fillText(data.name, 128, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, 1.2, 0);
    sprite.scale.set(2, 0.5, 1);
    mesh.add(sprite);
    
    this.scene.add(mesh);
    
    // Store NPC
    this.npcs = this.npcs || {};
    this.npcs[data.npc_id] = {
      mesh,
      data
    };
    
    console.log('NPC spawned successfully, total NPCs:', Object.keys(this.npcs).length);
  }
  
  showNPCDialogue(data) {
    console.log('NPC Dialogue:', data);
    
    // Create dialogue UI
    const dialogueBox = document.createElement('div');
    dialogueBox.className = 'npc-dialogue';
    dialogueBox.innerHTML = `
      <div class="npc-dialogue-content">
        <h3>${data.npc_name}</h3>
        <p>${data.dialogue.text}</p>
        <div class="dialogue-options">
          ${data.dialogue.options.map(opt => 
            `<button class="dialogue-option" data-action="${opt.action || ''}" data-next="${opt.next || ''}" data-quest="${opt.quest_id || ''}">${opt.text}</button>`
          ).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(dialogueBox);
    
    // Handle option clicks
    dialogueBox.querySelectorAll('.dialogue-option').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        const next = button.dataset.next;
        const questId = button.dataset.quest;
        
        if (action === 'accept_quest' && questId) {
          this.acceptQuest({ quest_id: questId });
        }
        
        // Remove dialogue box
        document.body.removeChild(dialogueBox);
        
        // Request pointer lock back
        if (this.canvas.requestPointerLock) {
          this.canvas.requestPointerLock();
        }
      });
    });
  }
  
  // Quest methods
  acceptQuest(data) {
    console.log('Accepted quest:', data);
    this.addChatMessage(`Quest accepted: ${data.quest_id}`, 'system');
    
    // Send quest acceptance to server
    if (this.socket) {
      this.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.QUEST_ACCEPT,
        data: { quest_id: data.quest_id }
      }));
    }
  }
  
  completeQuest(data) {
    console.log('Completed quest:', data);
    this.addChatMessage(data.completion_text, 'system');
    
    // Show rewards
    if (data.rewards) {
      let rewardText = 'Rewards: ';
      data.rewards.forEach(reward => {
        if (reward.type === 'item') {
          rewardText += `${reward.count}x ${reward.item_name} `;
        } else if (reward.type === 'experience') {
          rewardText += `${reward.amount} XP `;
        }
      });
      this.addChatMessage(rewardText, 'system');
    }
  }
  
  updatePlayerStats(data) {
    if (!this.player) return;
    
    this.player.health = data.health;
    this.player.maxHealth = data.max_health;
    this.player.mana = data.mana;
    this.player.maxMana = data.max_mana;
    this.player.experience = data.experience;
    this.player.level = data.level;
    this.player.experienceToNextLevel = data.experience_to_next_level;
    
    // Update UI
    this.updateStatsUI();
  }
  
  handleLevelUp(data) {
    console.log('Level up!', data);
    this.addChatMessage(`LEVEL UP! You are now level ${data.level}!`, 'system');
    
    // Show level up effect
    this.showLevelUpEffect();
  }
  
  // Enemy methods
  spawnEnemy(data) {
    const existing = this.enemies.get(data.id);
    if (existing) return;
    const enemy = new Enemy(data.id, data.type, {
      x: data.position[0], y: data.position[1], z: data.position[2]
    });
    if (data.health !== undefined) {
      enemy.health = data.health;
      enemy.maxHealth = data.max_health || data.health;
    }
    this.enemies.set(data.id, enemy);
    this.scene.add(enemy.mesh);
  }
  
  despawnEnemy(data) {
    const enemy = this.enemies.get(data.mobId);
    if (enemy) {
      this.scene.remove(enemy.mesh);
      if (enemy.mesh.geometry) enemy.mesh.geometry.dispose();
      this.enemies.delete(data.mobId);
    }
  }
  
  updateEnemyFromServer(data) {
    const enemy = this.enemies.get(data.mobId);
    if (!enemy) return;
    if (data.position) {
      enemy.position.set(data.position[0], data.position[1], data.position[2]);
      enemy.mesh.position.copy(enemy.position);
    }
    if (data.health !== undefined) {
      enemy.health = data.health;
      enemy.maxHealth = data.max_health || enemy.maxHealth;
      enemy.healthBar.scale.x = Math.max(0, enemy.health / enemy.maxHealth);
      enemy.healthBar.position.x = -(1 - enemy.health / enemy.maxHealth) / 2;
    }
    if (data.state) enemy.state = data.state;
  }
  
  handleMobAttack(data) {
    if (data.targetId !== this.clientId) return;
    this.player.health = Math.max(0, this.player.health - (data.damage || 0));
    this.updateStatsUI();
    const flash = document.getElementById('hud');
    if (flash) { flash.style.boxShadow = 'inset 0 0 40px rgba(255,0,0,0.6)'; setTimeout(() => { flash.style.boxShadow = ''; }, 300); }
  }
  
  handlePlayerDamage(data) {
    // Update player health
    this.player.health = data.health;
    this.updateStatsUI();
    
    // Show damage alert
    this.showDamageAlert(data.damage, data.attacker);
    
    // Red screen flash effect
    const flash = document.getElementById('hud');
    if (flash) { 
      flash.style.boxShadow = 'inset 0 0 40px rgba(255,0,0,0.6)'; 
      setTimeout(() => { flash.style.boxShadow = ''; }, 300); 
    }
    
    // Log to console
    console.log(`Took ${data.damage} damage from ${data.attacker}`);
  }
  
  showDamageAlert(damage, attacker) {
    // Create or update damage alert element
    let alertEl = document.getElementById('damageAlert');
    if (!alertEl) {
      alertEl = document.createElement('div');
      alertEl.id = 'damageAlert';
      alertEl.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.8);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 24px;
        font-weight: bold;
        z-index: 1000;
        pointer-events: none;
        animation: damagePulse 0.5s ease-out;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      `;
      document.body.appendChild(alertEl);
      
      // Add animation keyframes
      if (!document.getElementById('damageAlertStyle')) {
        const style = document.createElement('style');
        style.id = 'damageAlertStyle';
        style.textContent = `
          @keyframes damagePulse {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
            50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // Update alert text
    alertEl.textContent = `-${Math.floor(damage)} HP ${attacker ? `from ${attacker}` : ''}`;
    
    // Trigger animation
    alertEl.style.animation = 'none';
    setTimeout(() => {
      alertEl.style.animation = 'damagePulse 0.5s ease-out';
    }, 10);
  }
  
  spawnTestEnemy() {
    const types = ['zombie', 'skeleton', 'slime'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Spawn in front of player
    const spawnPos = this.player.position.clone();
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.multiplyScalar(5);
    spawnPos.add(direction);
    
    const enemy = new Enemy(`test_${Date.now()}`, type, {
      x: spawnPos.x,
      y: spawnPos.y,
      z: spawnPos.z
    });
    
    this.enemies.set(enemy.id, enemy);
    this.scene.add(enemy.mesh);
    
    console.log(`Spawned test ${type} enemy at position:`, spawnPos);
  }
  
  updateStatsUI() {
    // Update health bar
    const healthBar = document.getElementById('healthBar');
    const healthText = healthBar?.nextElementSibling;
    if (healthBar) {
      healthBar.style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
      if (healthText && healthText.classList.contains('bar-text')) {
        healthText.textContent = `${Math.floor(this.player.health)}/${this.player.maxHealth}`;
      }
    }
    
    // Update mana bar
    const manaBar = document.getElementById('manaBar');
    const manaText = manaBar?.nextElementSibling;
    if (manaBar) {
      manaBar.style.width = `${(this.player.mana / this.player.maxMana) * 100}%`;
      if (manaText && manaText.classList.contains('bar-text')) {
        manaText.textContent = `${Math.floor(this.player.mana)}/${this.player.maxMana}`;
      }
    }
    
    // Update experience bar
    const expBar = document.getElementById('expBar');
    const expText = expBar?.nextElementSibling;
    if (expBar) {
      expBar.style.width = `${(this.player.experience / this.player.experienceToNextLevel) * 100}%`;
      if (expText && expText.classList.contains('bar-text')) {
        expText.textContent = `${Math.floor(this.player.experience)}/${this.player.experienceToNextLevel}`;
      }
    }
    
    // Update level display
    const levelEl = document.getElementById('level');
    if (levelEl) {
      levelEl.textContent = `Level ${this.player.level}`;
    }
  }
  
  updateStaminaUI() {
    const staminaBar = document.getElementById('staminaBar');
    const staminaText = staminaBar?.nextElementSibling;
    if (staminaBar) {
      staminaBar.style.width = `${(this.player.stamina / this.player.maxStamina) * 100}%`;
      if (staminaText && staminaText.classList.contains('bar-text')) {
        staminaText.textContent = `${Math.floor(this.player.stamina)}/${this.player.maxStamina}`;
      }
    }
  }
  
  showLevelUpEffect() {
    // Create level up visual effect
    const effect = document.createElement('div');
    effect.className = 'level-up-effect';
    effect.innerHTML = '<div class="level-up-text">LEVEL UP!</div>';
    document.body.appendChild(effect);
    
    // Remove after animation
    setTimeout(() => {
      if (document.body.contains(effect)) {
        document.body.removeChild(effect);
      }
    }, 2000);
  }
  
  interactWithNPC() {
    console.log('R key pressed - attempting NPC interaction');
    console.log('Available NPCs:', this.npcs ? Object.keys(this.npcs) : 'none');
    console.log('Player position:', this.player ? this.player.position : 'no player');
    
    // Check if player is looking at an NPC
    const npc = this.getNPCInCrosshair();
    if (npc) {
      console.log('Interacting with NPC:', npc.data.npc_id);
      
      // Send interaction to server
      if (this.socket) {
        const message = JSON.stringify({
          type: MESSAGE_TYPES.NPC_INTERACT,
          data: { npc_id: npc.data.npc_id }
        });
        console.log('Sending NPC interaction message:', message);
        this.socket.send(message);
      } else {
        console.error('No socket connection!');
      }
    } else {
      console.log('No NPC in crosshair');
    }
  }
  
  getNPCInCrosshair() {
    if (!this.player || !this.npcs) {
      return null;
    }
    
    // Simple distance check - find nearest NPC within 3 blocks
    let nearestNPC = null;
    let nearestDistance = 3.0; // Interaction range
    
    const playerPos = this.player.position;
    
    for (const npcId in this.npcs) {
      const npc = this.npcs[npcId];
      const npcPos = new THREE.Vector3(
        npc.data.position[0],
        npc.data.position[1],
        npc.data.position[2]
      );
      
      const distance = playerPos.distanceTo(npcPos);
      
      if (distance < nearestDistance) {
        // Check if player is looking at the NPC
        // Get camera direction
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        const toNPC = npcPos.clone().sub(playerPos).normalize();
        const dot = direction.dot(toNPC);
        
        // If looking roughly in the direction of the NPC (within 60 degrees)
        if (dot > 0.5) {
          nearestDistance = distance;
          nearestNPC = npc;
        }
      }
    }
    
    return nearestNPC;
  }
  
  // Chat methods
  openChat() {
    // Release pointer lock if active
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    
    const chatInput = document.getElementById('chatInput');
    chatInput.classList.add('active');
    chatInput.value = '';
    
    // Focus the input after a brief delay to ensure pointer lock is released
    setTimeout(() => {
      chatInput.focus();
    }, 10);
  }
  
  closeChat() {
    const chatInput = document.getElementById('chatInput');
    chatInput.classList.remove('active');
    chatInput.blur();
    if (this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  }
  
  sendChatMessage(message) {
    if (!this.socket || !message.trim()) return;
    
    // Check for commands
    if (message.startsWith('/')) {
      const parts = message.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      
      if (command === 'help') {
        this.addChatMessage('Commands:', 'system');
        this.addChatMessage('  /help - Show this help', 'system');
        this.addChatMessage('  /who - List online players', 'system');
        this.addChatMessage('  /whisper <player> <message> - Send private message', 'system');
        this.addChatMessage('  /give [material] [amount] - Get materials for testing', 'system');
        this.addChatMessage('    Materials: wood, stone, iron, gold, diamond, tools, weapons, armor, all', 'system');
        this.addChatMessage('    Example: /give diamond 64 or /give tools', 'system');
        return;
      } else if (command === 'whisper' || command === 'w' || command === 'msg') {
        if (parts.length < 3) {
          this.addChatMessage('Usage: /whisper <player> <message>', 'system');
          return;
        }
        const targetPlayer = parts[1];
        const whisperMessage = parts.slice(2).join(' ');
        
        this.socket.send(JSON.stringify({
          type: MESSAGE_TYPES.CHAT_WHISPER,
          data: {
            target: targetPlayer,
            message: whisperMessage
          }
        }));
        return;
      } else if (command === 'who') {
        this.socket.send(JSON.stringify({
          type: MESSAGE_TYPES.CHAT_COMMAND,
          data: { command: 'who' }
        }));
        return;
      } else if (command === 'give') {
        // Request testing supplies with specific material
        const material = parts[1] || 'all';
        const amount = parseInt(parts[2]) || 64;
        
        this.socket.send(JSON.stringify({
          type: MESSAGE_TYPES.GIVE_ITEMS,
          data: { material, amount }
        }));
        return;
      }
    }
    
    // Regular chat message
    this.socket.send(JSON.stringify({
      type: MESSAGE_TYPES.CHAT_MESSAGE,
      data: { message: message.trim() }
    }));
  }
  
  addChatMessage(message, type = 'normal', data = {}) {
    const chatMessages = document.getElementById('chatMessages');
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (type === 'normal') {
      messageEl.innerHTML = `<span class="timestamp">${timestamp}</span><span class="username">${data.username}:</span> ${message}`;
    } else if (type === 'whisper') {
      const direction = data.direction === 'sent' ? 'to' : 'from';
      messageEl.innerHTML = `<span class="timestamp">${timestamp}</span><span class="username">[Whisper ${direction} ${data.otherPlayer}]</span> ${message}`;
    } else if (type === 'system') {
      messageEl.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;
    }
    
    chatMessages.appendChild(messageEl);
    
    // Keep only last N messages
    while (chatMessages.children.length > this.maxChatMessages) {
      chatMessages.removeChild(chatMessages.firstChild);
    }
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  setupChatInput() {
    const chatInput = document.getElementById('chatInput');
    
    chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation(); // Prevent event from bubbling to document
      if (e.key === 'Enter') {
        const message = chatInput.value;
        if (message.trim()) {
          this.sendChatMessage(message);
        }
        this.closeChat();
      } else if (e.key === 'Escape') {
        this.closeChat();
      }
    });
    
    // Also handle keyup for consistency
    chatInput.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
  }

  toggleOrbitMode() {
    this.orbitMode = !this.orbitMode;
    console.log(`Camera mode: ${this.orbitMode ? 'ORBIT (use scroll to zoom, auto-spinning)' : 'FIRST PERSON (click to lock mouse)'}`);
    if (this.orbitMode && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  dumpVoxelDiagnostic() {
    if (!this.player) return;
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    
    console.log('=== VOXEL DIAGNOSTIC ===');
    console.log(`Player at (${this.player.position.x.toFixed(2)}, ${this.player.position.y.toFixed(2)}, ${this.player.position.z.toFixed(2)})`);
    console.log(`Loaded chunks: ${this.world.chunks.size}`);
    for (const [key] of this.world.chunks) {
      console.log(`  Chunk: ${key}`);
    }
    
    // Y cross-section at player X: show Z vs Y grid
    console.log(`\n--- Y vs Z cross-section at x=${px} ---`);
    let header = '  Y\\Z';
    for (let z = pz - 5; z <= pz + 5; z++) header += String(z).padStart(4);
    console.log(header);
    for (let y = py + 5; y >= py - 5; y--) {
      let row = String(y).padStart(4) + ' |';
      for (let z = pz - 5; z <= pz + 5; z++) {
        const b = this.world.getBlock(px, y, z);
        row += String(b).padStart(4);
      }
      console.log(row);
    }
    
    // X vs Z top-down at player Y (feet level)
    console.log(`\n--- X vs Z top-down at y=${py} (feet) ---`);
    header = '  X\\Z';
    for (let z = pz - 5; z <= pz + 5; z++) header += String(z).padStart(4);
    console.log(header);
    for (let x = px - 5; x <= px + 5; x++) {
      let row = String(x).padStart(4) + ' |';
      for (let z = pz - 5; z <= pz + 5; z++) {
        const b = this.world.getBlock(x, py, z);
        row += String(b).padStart(4);
      }
      console.log(row);
    }
    
    // Also show one layer below feet
    console.log(`\n--- X vs Z top-down at y=${py - 1} (below feet) ---`);
    header = '  X\\Z';
    for (let z = pz - 5; z <= pz + 5; z++) header += String(z).padStart(4);
    console.log(header);
    for (let x = px - 5; x <= px + 5; x++) {
      let row = String(x).padStart(4) + ' |';
      for (let z = pz - 5; z <= pz + 5; z++) {
        const b = this.world.getBlock(x, py - 1, z);
        row += String(b).padStart(4);
      }
      console.log(row);
    }
    
    // Height column directly at player position
    console.log(`\n--- Height column at (${px}, ${pz}) ---`);
    for (let y = py + 10; y >= Math.max(0, py - 10); y--) {
      const b = this.world.getBlock(px, y, pz);
      const label = y === py ? ' <-- FEET' : (y === py + 1 ? ' <-- BODY' : '');
      if (b !== 0 || Math.abs(y - py) <= 3) {
        console.log(`  y=${String(y).padStart(3)}: block=${b}${label}`);
      }
    }
    console.log('=== END DIAGNOSTIC ===');
  }

  renderStructures(chunkX, chunkZ, chunkData) {
    // Check if chunk has structure data
    if (!chunkData.metadata) return;
    
    const structures = chunkData.metadata.structures || [];
    const site = chunkData.metadata.site;
    
    // Render site if present
    if (site) {
      this.renderSite(chunkX, chunkZ, site);
    }
    
    // Render other structures
    structures.forEach(structure => {
      this.renderStructure(chunkX, chunkZ, structure);
    });
  }
  
  renderStructure(chunkX, chunkZ, structure) {
    // Simple structure rendering - can be expanded based on structure type
    const worldX = chunkX * 16 + structure.x || 8;
    const worldZ = chunkZ * 16 + structure.z || 8;
    const worldY = structure.y || 32;
    
    // Create a simple structure marker
    const geometry = new THREE.BoxGeometry(2, 3, 2);
    const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(worldX, worldY, worldZ);
    this.scene.add(mesh);
  }
  
  renderSite(chunkX, chunkZ, site) {
    const worldX = chunkX * 16 + 8; // Center of chunk
    const worldZ = chunkZ * 16 + 8;
    const worldY = site.y || 32;
    
    switch (site.site_type) {
      case 'village':
        this.renderVillage(worldX, worldY, worldZ, site);
        break;
      case 'ruins':
        this.renderRuins(worldX, worldY, worldZ, site);
        break;
      case 'fort':
        this.renderFort(worldX, worldY, worldZ, site);
        break;
      case 'lair':
        this.renderLair(worldX, worldY, worldZ, site);
        break;
      default:
        this.renderSimpleStructure(worldX, worldY, worldZ, site);
    }
  }
  
  renderVillage(x, y, z, site) {
    // Render village well
    this.renderWell(x, y, z);
    
    // Render houses around well
    const housePositions = [
      {x: x + 5, z: z},
      {x: x - 5, z: z},
      {x: x, z: z + 5},
      {x: x, z: z - 5}
    ];
    
    housePositions.forEach(pos => {
      this.renderHouse(pos.x, y, pos.z);
    });
    
    // Add spawn marker for NPCs
    if (this.spawnMarkers) {
      this.spawnMarkers.push({
        type: 'village',
        position: new THREE.Vector3(x, y + 1, z),
        siteId: site.site_id,
        npcTypes: ['villager', 'merchant', 'blacksmith']
      });
    }
  }
  
  renderWell(x, y, z) {
    // Create well structure
    const wellGeometry = new THREE.BoxGeometry(3, 2, 3);
    const wellMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const well = new THREE.Mesh(wellGeometry, wellMaterial);
    well.position.set(x, y + 1, z);
    this.scene.add(well);
    
    // Water in well
    const waterGeometry = new THREE.BoxGeometry(2, 0.1, 2);
    const waterMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x006994,
      transparent: true,
      opacity: 0.7
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.set(x, y + 0.5, z);
    this.scene.add(water);
  }
  
  renderHouse(x, y, z) {
    // House foundation
    const foundationGeometry = new THREE.BoxGeometry(4, 1, 4);
    const foundationMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
    foundation.position.set(x, y + 0.5, z);
    this.scene.add(foundation);
    
    // House walls
    const wallGeometry = new THREE.BoxGeometry(3, 3, 3);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
    const walls = new THREE.Mesh(wallGeometry, wallMaterial);
    walls.position.set(x, y + 2.5, z);
    this.scene.add(walls);
    
    // Roof
    const roofGeometry = new THREE.ConeGeometry(3, 2, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(x, y + 5, z);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    
    // Door
    const doorGeometry = new THREE.BoxGeometry(1, 2, 0.1);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(x, y + 1, z + 1.5);
    this.scene.add(door);
  }
  
  renderRuins(x, y, z, site) {
    // Crumbled walls
    const wallPositions = [
      {x: x + 3, z: z + 3, h: 2},
      {x: x - 3, z: z + 3, h: 1},
      {x: x + 3, z: z - 3, h: 1.5},
      {x: x - 3, z: z - 3, h: 0.5}
    ];
    
    wallPositions.forEach(wall => {
      const wallGeometry = new THREE.BoxGeometry(1, wall.h, 1);
      const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      wallMesh.position.set(wall.x, y + wall.h/2, wall.z);
      this.scene.add(wallMesh);
    });
    
    // Add spawn marker for monsters/loot
    if (this.spawnMarkers) {
      this.spawnMarkers.push({
        type: 'ruins',
        position: new THREE.Vector3(x, y + 1, z),
        siteId: site.site_id,
        lootTier: 'ancient',
        monsterType: 'undead'
      });
    }
  }
  
  renderFort(x, y, z, site) {
    // Fort walls (square)
    const wallSize = 6;
    const wallHeight = 4;
    const wallThickness = 1;
    
    // Create walls
    for (let i = -wallSize; i <= wallSize; i += wallSize * 2) {
      for (let j = -wallSize; j <= wallSize; j += wallSize * 2) {
        // North wall
        const wallGeometry1 = new THREE.BoxGeometry(wallThickness, wallHeight, wallSize * 2);
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        const wall1 = new THREE.Mesh(wallGeometry1, wallMaterial);
        wall1.position.set(x + i, y + wallHeight/2, z + j);
        this.scene.add(wall1);
        
        // East wall
        const wallGeometry2 = new THREE.BoxGeometry(wallSize * 2, wallHeight, wallThickness);
        const wall2 = new THREE.Mesh(wallGeometry2, wallMaterial);
        wall2.position.set(x + i, y + wallHeight/2, z + j);
        this.scene.add(wall2);
      }
    }
    
    // Central keep
    const keepGeometry = new THREE.BoxGeometry(4, 6, 4);
    const keepMaterial = new THREE.MeshLambertMaterial({ color: 0x4A4A4A });
    const keep = new THREE.Mesh(keepGeometry, keepMaterial);
    keep.position.set(x, y + 3, z);
    this.scene.add(keep);
    
    // Add spawn marker
    if (this.spawnMarkers) {
      this.spawnMarkers.push({
        type: 'fort',
        position: new THREE.Vector3(x, y + 1, z),
        siteId: site.site_id,
        npcTypes: ['guard', 'commander', 'merchant']
      });
    }
  }
  
  renderLair(x, y, z, site) {
    // Cave entrance
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (dy === 0 && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
            // Entrance opening - don't place blocks
            continue;
          }
          
          const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
          const blockMaterial = new THREE.MeshLambertMaterial({ color: 0x3E3E3E });
          const block = new THREE.Mesh(blockGeometry, blockMaterial);
          block.position.set(x + dx, y - dy, z + dz);
          this.scene.add(block);
        }
      }
    }
    
    // Add spawn marker for monsters
    if (this.spawnMarkers) {
      this.spawnMarkers.push({
        type: 'lair',
        position: new THREE.Vector3(x, y - 1, z),
        siteId: site.site_id,
        monsterType: 'goblins',
        spawnCount: 5
      });
    }
  }
  
  renderSimpleStructure(x, y, z, site) {
    // Simple 2x2 structure
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const structure = new THREE.Mesh(geometry, material);
    structure.position.set(x, y + 1, z);
    this.scene.add(structure);
  }
  
  renderChunk(scene, chunkX, chunkZ, blockMeshes) {
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.world.chunks.get(key);
    if (!chunk) return;
    
    // Remove existing chunk meshes
    const existingMesh = blockMeshes.get(key);
    if (existingMesh) {
      scene.remove(existingMesh);
    }
    const existingTransparentMesh = blockMeshes.get(key + '_transparent');
    if (existingTransparentMesh) {
      scene.remove(existingTransparentMesh);
    }
    
    // Create chunk geometry
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const colors = [];
    const indices = [];
    
    // Separate transparent and opaque blocks
    const transparentPositions = [];
    const transparentNormals = [];
    const transparentColors = [];
    const transparentIndices = [];
    
    let vertexCount = 0;
    let transparentVertexCount = 0;
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const index = y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
          const blockType = chunk[index];
          
          if (blockType === BLOCK_TYPES.AIR) continue;
          
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldY = y;
          const worldZ = chunkZ * CHUNK_SIZE + z;
          
          // Check if block is transparent
          const isTransparent = blockType === BLOCK_TYPES.WATER || blockType === BLOCK_TYPES.GLASS;
          
          // Check each face for visibility - check adjacent blocks
          const faces = [
            { dir: [0, 1, 0], visible: y >= CHUNK_HEIGHT - 1 || this.world.getBlock(worldX, worldY + 1, worldZ) === BLOCK_TYPES.AIR },
            { dir: [0, -1, 0], visible: y <= 0 || this.world.getBlock(worldX, worldY - 1, worldZ) === BLOCK_TYPES.AIR },
            { dir: [1, 0, 0], visible: this.world.getBlock(worldX + 1, worldY, worldZ) === BLOCK_TYPES.AIR },
            { dir: [-1, 0, 0], visible: this.world.getBlock(worldX - 1, worldY, worldZ) === BLOCK_TYPES.AIR },
            { dir: [0, 0, 1], visible: this.world.getBlock(worldX, worldY, worldZ + 1) === BLOCK_TYPES.AIR },
            { dir: [0, 0, -1], visible: this.world.getBlock(worldX, worldY, worldZ - 1) === BLOCK_TYPES.AIR }
          ];
          
          const color = this.getBlockColor(blockType);
          
          faces.forEach(face => {
            if (face.visible) {
              if (isTransparent) {
                this.addFace(
                  transparentPositions, transparentNormals, transparentColors, transparentIndices,
                  x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE,
                  face.dir[0], face.dir[1], face.dir[2],
                  color, transparentVertexCount
                );
                transparentVertexCount += 4;
              } else {
                this.addFace(
                  positions, normals, colors, indices,
                  x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE,
                  face.dir[0], face.dir[1], face.dir[2],
                  color, vertexCount
                );
                vertexCount += 4;
              }
            }
          });
        }
      }
    }
    
    // Create opaque mesh
    if (vertexCount > 0) {
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      
      const material = new THREE.MeshLambertMaterial({ 
        vertexColors: true,
        transparent: false
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      scene.add(mesh);
      blockMeshes.set(key, mesh);
      
      // Add to world's chunk mesh management
      this.world.addChunkMesh(chunkX, chunkZ, mesh);
    }
    
    // Create transparent mesh (rendered after opaque)
    if (transparentVertexCount > 0) {
      const transparentGeometry = new THREE.BufferGeometry();
      transparentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(transparentPositions, 3));
      transparentGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(transparentNormals, 3));
      transparentGeometry.setAttribute('color', new THREE.Float32BufferAttribute(transparentColors, 3));
      transparentGeometry.setIndex(transparentIndices);
      
      // Check if any water blocks in this chunk for opacity
      const hasWater = chunk.includes(BLOCK_TYPES.WATER);
      
      const transparentMaterial = new THREE.MeshLambertMaterial({ 
        vertexColors: true,
        transparent: true,
        opacity: hasWater ? 0.7 : 0.8,
        depthWrite: false
      });
      
      const transparentMesh = new THREE.Mesh(transparentGeometry, transparentMaterial);
      transparentMesh.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
      transparentMesh.renderOrder = 1; // Render after opaque
      
      scene.add(transparentMesh);
      blockMeshes.set(key + '_transparent', transparentMesh);
    }
    
    // Set initial visibility based on current camera position
    this.world.updateChunkVisibility(this.camera);
    
    console.log(`Rendered chunk (${chunkX}, ${chunkZ}) with ${vertexCount/4} opaque blocks and ${transparentVertexCount/4} transparent blocks`);
  }

  addFace(positions, normals, colors, indices, x, y, z, nx, ny, nz, color, vertexCount) {
    const s = BLOCK_SIZE;
    
    if (nx === 1) { // +X face
      positions.push(
        x + s, y,     z,
        x + s, y + s, z,
        x + s, y + s, z + s,
        x + s, y,     z + s
      );
    } else if (nx === -1) { // -X face
      positions.push(
        x, y,     z + s,
        x, y + s, z + s,
        x, y + s, z,
        x, y,     z
      );
    } else if (ny === 1) { // +Y face (top)
      positions.push(
        x,     y + s, z + s,
        x + s, y + s, z + s,
        x + s, y + s, z,
        x,     y + s, z
      );
    } else if (ny === -1) { // -Y face (bottom)
      positions.push(
        x,     y, z,
        x + s, y, z,
        x + s, y, z + s,
        x,     y, z + s
      );
    } else if (nz === 1) { // +Z face
      positions.push(
        x + s, y,     z + s,
        x + s, y + s, z + s,
        x,     y + s, z + s,
        x,     y,     z + s
      );
    } else if (nz === -1) { // -Z face
      positions.push(
        x,     y,     z,
        x,     y + s, z,
        x + s, y + s, z,
        x + s, y,     z
      );
    }
    
    // Add normals
    for (let i = 0; i < 4; i++) {
      normals.push(nx, ny, nz);
      colors.push(color.r, color.g, color.b);
    }
    
    // Add indices
    const baseIndex = vertexCount;
    indices.push(
      baseIndex, baseIndex + 1, baseIndex + 2,
      baseIndex, baseIndex + 2, baseIndex + 3
    );
  }
  
  getBlockColor(blockType) {
    switch (blockType) {
      case BLOCK_TYPES.GRASS: return { r: 0.2, g: 0.8, b: 0.2 };
      case BLOCK_TYPES.DIRT: return { r: 0.6, g: 0.4, b: 0.2 };
      case BLOCK_TYPES.STONE: return { r: 0.5, g: 0.5, b: 0.5 };
      case BLOCK_TYPES.WOOD: return { r: 0.6, g: 0.4, b: 0.2 };
      case BLOCK_TYPES.LEAVES: return { r: 0.2, g: 0.6, b: 0.2 };
      case BLOCK_TYPES.SAND: return { r: 0.9, g: 0.8, b: 0.6 };
      case BLOCK_TYPES.WATER: return { r: 0.2, g: 0.4, b: 0.8 }; // Blue water
      case BLOCK_TYPES.CHEST: return { r: 0.6, g: 0.3, b: 0.1 };
      case BLOCK_TYPES.COAL_ORE: return { r: 0.1, g: 0.1, b: 0.1 }; // Black coal
      case BLOCK_TYPES.IRON_ORE: return { r: 0.7, g: 0.7, b: 0.8 }; // Silver-gray iron
      case BLOCK_TYPES.GOLD_ORE: return { r: 0.9, g: 0.8, b: 0.2 }; // Gold
      case BLOCK_TYPES.DIAMOND_ORE: return { r: 0.2, g: 0.8, b: 0.9 }; // Cyan diamond
      case BLOCK_TYPES.FLOWERS: return { r: 0.9, g: 0.4, b: 0.6 }; // Pink flowers
      case BLOCK_TYPES.TALL_GRASS: return { r: 0.3, g: 0.7, b: 0.2 }; // Bright green
      case BLOCK_TYPES.LOG: return { r: 0.4, g: 0.2, b: 0.1 }; // Dark brown
      case BLOCK_TYPES.PLANKS: return { r: 0.7, g: 0.5, b: 0.3 }; // Light brown
      case BLOCK_TYPES.COBBLESTONE: return { r: 0.4, g: 0.4, b: 0.4 }; // Dark gray
      case BLOCK_TYPES.BRICK: return { r: 0.6, g: 0.2, b: 0.2 }; // Red brick
      case BLOCK_TYPES.GLASS: return { r: 0.8, g: 0.9, b: 1.0 }; // Light blue
      case BLOCK_TYPES.WOOL: return { r: 0.9, g: 0.9, b: 0.9 }; // White wool
      case BLOCK_TYPES.FURNACE: return { r: 0.3, g: 0.3, b: 0.3 }; // Dark gray
      case BLOCK_TYPES.CRAFTING_TABLE: return { r: 0.5, g: 0.3, b: 0.1 }; // Brown
      default: return { r: 1, g: 0, b: 1 }; // Magenta for unknown blocks
    }
  }

  updateChunkBiomeVisuals(chunkX, chunkZ) {
    // Get biome information from world generation metadata
    // This would be sent from server along with chunk data
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.world.chunks.get(key);
    if (!chunk) return;
    
    // Check if we have biome data (would be stored in metadata)
    const biomeData = this.world.biomeData?.get(key);
    if (!biomeData) return;
    
    // Apply biome-specific fog colors
    switch (biomeData.primaryBiome) {
      case 'desert':
        this.scene.fog = new THREE.Fog(0xf4e4c1, 50, 200); // Light sandy fog
        break;
      case 'tundra':
      case 'alpine':
        this.scene.fog = new THREE.Fog(0xe8f4f8, 40, 150); // Cold blue-white fog
        break;
      case 'marsh':
        this.scene.fog = new THREE.Fog(0x8fbc8f, 30, 120); // Murky green fog
        break;
      case 'forest':
      case 'conifer_forest':
      case 'rainforest':
        this.scene.fog = new THREE.Fog(0x228b22, 50, 180); // Deep green fog
        break;
      default:
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200); // Default sky blue
    }
  }
  
  addBiomeParticles(biomeType, position) {
    // Add particle effects for certain biomes
    switch (biomeType) {
      case 'marsh':
        // Add firefly particles
        this.createFireflies(position);
        break;
      case 'desert':
        // Add heat shimmer effect
        this.createHeatShimmer(position);
        break;
      case 'tundra':
        // Add snow particles
        this.createSnowFall(position);
        break;
    }
  }
  
  createFireflies(center) {
    // Create glowing firefly particles
    const particleCount = 20;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions.push(
        center.x + (Math.random() - 0.5) * 30,
        center.y + Math.random() * 10,
        center.z + (Math.random() - 0.5) * 30
      );
      colors.push(1, 1, 0); // Yellow color
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const fireflies = new THREE.Points(geometry, material);
    this.scene.add(fireflies);
    
    // Animate fireflies
    const animateFireflies = () => {
      const positions = fireflies.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.01;
        positions[i + 2] += Math.cos(Date.now() * 0.001 + i) * 0.01;
      }
      fireflies.geometry.attributes.position.needsUpdate = true;
    };
    
    // Store animation function for cleanup
    this.biomeParticles = this.biomeParticles || [];
    this.biomeParticles.push({ mesh: fireflies, animate: animateFireflies });
  }
  
  createHeatShimmer(center) {
    // Create heat shimmer effect using transparent planes
    const shimmerCount = 5;
    for (let i = 0; i < shimmerCount; i++) {
      const geometry = new THREE.PlaneGeometry(20, 20);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.05,
        color: 0xffaa00
      });
      
      const shimmer = new THREE.Mesh(geometry, material);
      shimmer.position.set(
        center.x + (Math.random() - 0.5) * 40,
        center.y + Math.random() * 5 + 2,
        center.z + (Math.random() - 0.5) * 40
      );
      shimmer.rotation.x = Math.PI / 2;
      
      this.scene.add(shimmer);
      
      // Animate shimmer
      const animateShimmer = () => {
        shimmer.material.opacity = 0.02 + Math.sin(Date.now() * 0.002 + i) * 0.03;
      };
      
      this.biomeParticles = this.biomeParticles || [];
      this.biomeParticles.push({ mesh: shimmer, animate: animateShimmer });
    }
  }
  
  createSnowFall(center) {
    // Create falling snow particles
    const particleCount = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions.push(
        center.x + (Math.random() - 0.5) * 50,
        center.y + Math.random() * 30,
        center.z + (Math.random() - 0.5) * 50
      );
      velocities.push(
        (Math.random() - 0.5) * 0.1,
        -Math.random() * 0.5 - 0.1,
        (Math.random() - 0.5) * 0.1
      );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.3,
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    
    const snow = new THREE.Points(geometry, material);
    this.scene.add(snow);
    
    // Store velocities for animation
    snow.userData.velocities = velocities;
    
    // Animate snow
    const animateSnow = () => {
      const positions = snow.geometry.attributes.position.array;
      const velocities = snow.userData.velocities;
      
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
        
        // Reset snowflakes that fall too low
        if (positions[i + 1] < center.y - 10) {
          positions[i + 1] = center.y + 30;
          positions[i] = center.x + (Math.random() - 0.5) * 50;
          positions[i + 2] = center.z + (Math.random() - 0.5) * 50;
        }
      }
      snow.geometry.attributes.position.needsUpdate = true;
    };
    
    this.biomeParticles = this.biomeParticles || [];
    this.biomeParticles.push({ mesh: snow, animate: animateSnow });
  }
}

class Player {
  constructor(id, username) {
    this.id = id;
    this.username = username;
    this.position = new THREE.Vector3(0, 80, 0);
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.health = 100;
    this.maxHealth = 100;
    this.mana = 50;
    this.maxMana = 50;
    this.stamina = 100;
    this.maxStamina = 100;
    this.experience = 0;
    this.level = 1;
    this.experienceToNextLevel = 100;
    this.lastAttackTime = 0;
    this.lastDodgeTime = 0;
    this.isDodging = false;
    this.dodgeDuration = 300; // ms
    this.dodgeStartTime = 0;
  }
  
  regenerateStamina(deltaTime) {
    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 20 * deltaTime); // 20 stamina per second
    }
  }
  
  canAttack() {
    const now = Date.now();
    return now - this.lastAttackTime > 500 && this.stamina >= 10; // 500ms cooldown, 10 stamina cost
  }
  
  attack() {
    this.lastAttackTime = Date.now();
    this.stamina = Math.max(0, this.stamina - 10);
  }
  
  canDodge() {
    const now = Date.now();
    return now - this.lastDodgeTime > 1000 && this.stamina >= 20 && this.onGround; // 1s cooldown, 20 stamina cost
  }
  
  dodge() {
    this.lastDodgeTime = Date.now();
    this.stamina = Math.max(0, this.stamina - 20);
    this.isDodging = true;
    this.dodgeStartTime = Date.now();
  }
  
  updateDodge() {
    if (this.isDodging && Date.now() - this.dodgeStartTime > this.dodgeDuration) {
      this.isDodging = false;
    }
  }
}

class Enemy {
  constructor(id, type, position) {
    this.id = id;
    this.type = type; // 'zombie', 'skeleton', 'slime', etc.
    this.position = new THREE.Vector3(position.x, position.y, position.z);
    this.velocity = new THREE.Vector3();
    this.health = 50;
    this.maxHealth = 50;
    this.damage = 10;
    this.speed = 1.5;
    this.attackRange = 2;
    this.detectionRange = 10;
    this.lastAttackTime = 0;
    this.attackCooldown = 1500; // ms
    this.state = 'idle'; // idle, chasing, attacking
    this.target = null;
    this.mesh = null;
    this.createMesh();
  }
  
  createMesh() {
    // Make bears larger
    const size = this.type === 'bear' ? 1.5 : 0.8;
    const height = this.type === 'bear' ? 2.5 : 1.8;
    const geometry = new THREE.BoxGeometry(size, height, size);
    const material = new THREE.MeshLambertMaterial({ 
      color: this.type === 'zombie' ? 0x2d5016 : 
            this.type === 'skeleton' ? 0xf0f0f0 : 
            this.type === 'bear' ? 0x8B4513 : // Brown color for bear
            0x4a7c7c
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Add health bar
    const barGeometry = new THREE.PlaneGeometry(1, 0.1);
    const barMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    });
    this.healthBar = new THREE.Mesh(barGeometry, barMaterial);
    this.healthBar.position.y = this.type === 'bear' ? 1.8 : 1.2;
    this.mesh.add(this.healthBar);
    
    // Add floating mob indicator
    this.addMobIndicator();
  }
  
  addMobIndicator() {
    // Create a glowing orb above the mob
    const indicatorGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ 
      color: this.getMobIndicatorColor(),
      transparent: true,
      opacity: 0.8
    });
    this.mobIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    
    // Position it above the mob's head
    const indicatorHeight = this.type === 'bear' ? 3.2 : 2.5;
    this.mobIndicator.position.set(0, indicatorHeight, 0);
    this.mesh.add(this.mobIndicator);
    
    // Add pulsing animation
    this.mobIndicator.userData = {
      pulseSpeed: 0.002,
      pulsePhase: Math.random() * Math.PI * 2
    };
  }
  
  getMobIndicatorColor() {
    // Different colors for different mob types
    switch(this.type) {
      case 'zombie': return 0x00ff00; // Green
      case 'skeleton': return 0xffffff; // White
      case 'slime': return 0x00ffff; // Cyan
      case 'spider': return 0xff00ff; // Magenta
      case 'bear': return 0xff8800; // Orange
      case 'wolf': return 0x8888ff; // Light blue
      case 'troll': return 0xff0088; // Pink
      case 'boar': return 0x8b4513; // Brown
      case 'cow': return 0xffff00; // Yellow
      case 'deer': return 0x88ff88; // Light green
      case 'sheep': return 0xffffff; // White
      case 'rabbit': return 0xffaaaa; // Light pink
      case 'chicken': return 0xffffaa; // Light yellow
      default: return 0xff0000; // Red for unknown
    }
  }
  
  update(deltaTime, player, world) {
    // Update AI state
    const distanceToPlayer = this.position.distanceTo(player.position);
    
    // Animate the mob indicator
    if (this.mobIndicator) {
      const userData = this.mobIndicator.userData;
      userData.pulsePhase += userData.pulseSpeed;
      const scale = 1 + Math.sin(userData.pulsePhase) * 0.3;
      this.mobIndicator.scale.setScalar(scale);
    }
    
    switch (this.state) {
      case 'idle':
        if (distanceToPlayer < this.detectionRange) {
          this.state = 'chasing';
          this.target = player;
        }
        break;
        
      case 'chasing':
        if (distanceToPlayer > this.detectionRange * 1.5) {
          this.state = 'idle';
          this.target = null;
          this.velocity.set(0, 0, 0);
        } else if (distanceToPlayer < this.attackRange) {
          this.state = 'attacking';
        } else {
          // Move towards player
          const direction = new THREE.Vector3();
          direction.subVectors(player.position, this.position);
          direction.y = 0;
          direction.normalize();
          
          this.velocity.x = direction.x * this.speed;
          this.velocity.z = direction.z * this.speed;
        }
        break;
        
      case 'attacking':
        this.velocity.set(0, 0, 0);
        
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldown) {
          this.attack(player);
          this.lastAttackTime = now;
        }
        
        if (distanceToPlayer > this.attackRange) {
          this.state = 'chasing';
        }
        break;
    }
    
    // Apply physics
    this.velocity.y -= 9.81 * deltaTime; // Gravity
    
    // Simple collision check
    const newPos = this.position.clone();
    newPos.addScaledVector(this.velocity, deltaTime);
    
    // Ground collision
    if (newPos.y <= this.getGroundHeight(world)) {
      newPos.y = this.getGroundHeight(world);
      this.velocity.y = 0;
    }
    
    this.position.copy(newPos);
    this.mesh.position.copy(this.position);
    
    // Update health bar
    this.healthBar.scale.x = this.health / this.maxHealth;
    this.healthBar.position.x = -(1 - this.health / this.maxHealth) / 2;
  }
  
  getGroundHeight(world) {
    // Simple ground height check
    for (let y = this.position.y - 2; y >= 0; y--) {
      if (world.getBlock(Math.floor(this.position.x), Math.floor(y), Math.floor(this.position.z)) !== BLOCK_TYPES.AIR) {
        return y + 1;
      }
    }
    return 0;
  }
  
  attack(player) {
    if (player.isDodging) {
      console.log('Enemy attack dodged!');
      return;
    }
    
    const damage = this.damage + Math.random() * 5; // 10-15 damage
    player.health = Math.max(0, player.health - damage);
    
    console.log(`Enemy attacked for ${Math.floor(damage)} damage!`);
    
    // Send damage to server
    if (window.game && window.game.socket) {
      window.game.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.COMBAT_HIT,
        data: {
          targetId: player.id,
          damage: Math.floor(damage)
        }
      }));
    }
  }
  
  takeDamage(damage) {
    this.health = Math.max(0, this.health - damage);
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
  die() {
    console.log(`Enemy ${this.id} defeated!`);
    
    // Remove from scene
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    
    // Notify server
    if (window.game && window.game.socket) {
      window.game.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.MOB_DESPAWN,
        data: { mobId: this.id }
      }));
    }
  }
}

class StatusEffects {
  constructor() {
    this.effects = new Map(); // entityId -> Map of effectName -> effect
  }
  
  applyEffect(entityId, effectName, duration, properties = {}) {
    if (!this.effects.has(entityId)) {
      this.effects.set(entityId, new Map());
    }
    
    const entityEffects = this.effects.get(entityId);
    entityEffects.set(effectName, {
      startTime: Date.now(),
      duration: duration,
      properties: properties
    });
    
    console.log(`Applied ${effectName} to entity ${entityId} for ${duration}ms`);
  }
  
  removeEffect(entityId, effectName) {
    const entityEffects = this.effects.get(entityId);
    if (entityEffects) {
      entityEffects.delete(effectName);
      console.log(`Removed ${effectName} from entity ${entityId}`);
    }
  }
  
  hasEffect(entityId, effectName) {
    const entityEffects = this.effects.get(entityId);
    return entityEffects && entityEffects.has(effectName);
  }
  
  getEffect(entityId, effectName) {
    const entityEffects = this.effects.get(entityId);
    return entityEffects ? entityEffects.get(effectName) : null;
  }
  
  update(deltaTime) {
    const now = Date.now();
    
    this.effects.forEach((entityEffects, entityId) => {
      // Remove expired effects
      for (const [effectName, effect] of entityEffects.entries()) {
        if (now - effect.startTime > effect.duration) {
          entityEffects.delete(effectName);
          console.log(`Effect ${effectName} expired on entity ${entityId}`);
        }
      }
      
      // Clean up empty entity effect maps
      if (entityEffects.size === 0) {
        this.effects.delete(entityId);
      }
    });
  }
  
  // Common status effects
  static EFFECTS = {
    BURNING: {
      name: 'Burning',
      color: 0xff4444,
      damagePerSecond: 5,
      particleColor: 0xff6600
    },
    FROZEN: {
      name: 'Frozen',
      color: 0x4444ff,
      speedMultiplier: 0.5,
      particleColor: 0x88ccff
    },
    POISONED: {
      name: 'Poisoned',
      color: 0x44ff44,
      damagePerSecond: 3,
      particleColor: 0x88ff88
    },
    STRENGTHENED: {
      name: 'Strengthened',
      color: 0xffaa00,
      damageMultiplier: 1.5,
      particleColor: 0xffdd44
    },
    HASTENED: {
      name: 'Hastened',
      color: 0x00ffff,
      speedMultiplier: 1.5,
      particleColor: 0x88ffff
    },
    REGENERATING: {
      name: 'Regenerating',
      color: 0x00ff00,
      healPerSecond: 10,
      particleColor: 0x88ff88
    }
  };
}

class World {
  constructor() {
    this.chunks = new Map();
    this.chunkMeshes = new Map();  // Store chunk meshes for visibility management
    this.renderDistance = 6;  // Chunks to render in each direction
    this.lastCameraChunk = { x: 0, z: 0 };
  }

  loadChunk(chunkX, chunkZ, data) {
    const key = `${chunkX},${chunkZ}`;
    this.chunks.set(key, data);
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK_TYPES.AIR;
    
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(key);
    if (!chunk) {
      return BLOCK_TYPES.AIR;
    }
    
    const index = y * CHUNK_SIZE * CHUNK_SIZE + localZ * CHUNK_SIZE + localX;
    return chunk[index];
  }

  setBlock(x, y, z, blockType) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const key = `${chunkX},${chunkZ}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    
    const index = y * CHUNK_SIZE * CHUNK_SIZE + localZ * CHUNK_SIZE + localX;
    chunk[index] = blockType;
  }

  updateChunkVisibility(camera) {
    // Calculate which chunk the camera is in
    const cameraChunkX = Math.floor(camera.position.x / (CHUNK_SIZE * BLOCK_SIZE));
    const cameraChunkZ = Math.floor(camera.position.z / (CHUNK_SIZE * BLOCK_SIZE));
    
    // Only update if camera moved to a different chunk
    if (cameraChunkX === this.lastCameraChunk.x && cameraChunkZ === this.lastCameraChunk.z) {
      return;
    }
    
    this.lastCameraChunk = { x: cameraChunkX, z: cameraChunkZ };
    
    // Update visibility of all chunk meshes
    for (const [key, mesh] of this.chunkMeshes) {
      const [chunkX, chunkZ] = key.split(',').map(Number);
      const distance = Math.max(Math.abs(chunkX - cameraChunkX), Math.abs(chunkZ - cameraChunkZ));
      
      // Show chunks within render distance, hide others
      if (distance <= this.renderDistance) {
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    }
  }

  addChunkMesh(chunkX, chunkZ, mesh) {
    const key = `${chunkX},${chunkZ}`;
    this.chunkMeshes.set(key, mesh);
  }

  removeChunkMesh(chunkX, chunkZ) {
    const key = `${chunkX},${chunkZ}`;
    const mesh = this.chunkMeshes.get(key);
    if (mesh) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.parent.remove(mesh);
      this.chunkMeshes.delete(key);
    }
  }

  updateBlock(scene, position, blockMeshes) {
    // Find which chunks are affected and re-render them
    const chunkX = Math.floor(position.x / CHUNK_SIZE);
    const chunkZ = Math.floor(position.z / CHUNK_SIZE);
    
    // Re-render affected chunks (including neighbors for face updates)
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        // Note: renderChunk will be called by the VoxelGame class
      }
    }
  }
}

class Physics {
  constructor() {
    this.gravity = GRAVITY;
  }

  update(player, world) {
    const dt = 0.016;
    const playerWidth = 0.6;
    const playerHeight = 1.8;
    const halfW = playerWidth / 2;
    
    // Depenetration: if player is already inside terrain, push them up
    if (this.collidesAt(player.position, halfW, playerHeight, world)) {
      for (let i = 0; i < 100; i++) {
        player.position.y += 0.1;
        if (!this.collidesAt(player.position, halfW, playerHeight, world)) break;
      }
      player.velocity.y = 0;
      player.onGround = true;
    }
    
    // Apply gravity
    player.velocity.y += this.gravity * dt;
    
    // Move each axis independently to allow sliding along walls/ground
    
    // --- Y axis (gravity/jumping) ---
    player.position.y += player.velocity.y * dt;
    const groundY = this.findGround(player.position, halfW, world);
    if (groundY !== null && player.position.y <= groundY) {
      player.position.y = groundY;
      player.velocity.y = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }
    
    // --- X axis ---
    player.position.x += player.velocity.x * dt;
    if (this.collidesAt(player.position, halfW, playerHeight, world)) {
      player.position.x -= player.velocity.x * dt;
      player.velocity.x = 0;
    }
    
    // --- Z axis ---
    player.position.z += player.velocity.z * dt;
    if (this.collidesAt(player.position, halfW, playerHeight, world)) {
      player.position.z -= player.velocity.z * dt;
      player.velocity.z = 0;
    }
    
    // Prevent falling below world bottom
    if (player.position.y < -10) {
      player.position.y = 100;
      player.velocity.set(0, 0, 0);
    }
  }

  findGround(position, halfW, world) {
    // Scan downward from player feet to find the highest solid block below
    const feetY = position.y;
    const startY = Math.floor(feetY);
    
    for (let checkY = startY; checkY >= startY - 3 && checkY >= 0; checkY--) {
      for (let bx = Math.floor(position.x - halfW); bx <= Math.floor(position.x + halfW); bx++) {
        for (let bz = Math.floor(position.z - halfW); bz <= Math.floor(position.z + halfW); bz++) {
          if (world.getBlock(bx, checkY, bz) !== BLOCK_TYPES.AIR) {
            return checkY + 1; // Top of solid block
          }
        }
      }
    }
    return null;
  }

  collidesAt(position, halfW, playerHeight, world) {
    // Check if the player bounding box overlaps any solid block
    const minX = Math.floor(position.x - halfW);
    const maxX = Math.floor(position.x + halfW);
    const minY = Math.floor(position.y);
    const maxY = Math.floor(position.y + playerHeight);
    const minZ = Math.floor(position.z - halfW);
    const maxZ = Math.floor(position.z + halfW);
    
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (world.getBlock(bx, by, bz) !== BLOCK_TYPES.AIR) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

class Controls {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false
    };
    
    this.yaw = 0;
    this.pitch = 0;
    this.pointerLocked = false;
    this.sensitivity = 0.002;
  }

  handleKeyDown(event) {
    switch (event.code) {
      case 'KeyW': this.keys.forward = true; break;
      case 'KeyS': this.keys.backward = true; break;
      case 'KeyA': this.keys.left = true; break;
      case 'KeyD': this.keys.right = true; break;
      case 'Space': this.keys.jump = true; break;
      case 'Shift': this.keys.sprint = true; break;
    }
  }

  handleKeyUp(event) {
    switch (event.code) {
      case 'KeyW': this.keys.forward = false; break;
      case 'KeyS': this.keys.backward = false; break;
      case 'KeyA': this.keys.left = false; break;
      case 'KeyD': this.keys.right = false; break;
      case 'Space': this.keys.jump = false; break;
      case 'Shift': this.keys.sprint = false; break;
    }
  }

  handleMouseMove(event) {
    if (!this.pointerLocked) return;
    
    this.yaw -= event.movementX * this.sensitivity;
    this.pitch -= event.movementY * this.sensitivity;
    
    // Clamp pitch
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
  }
}

class Raycaster {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.targetPosition = null;
    this.targetNormal = null;
  }

  update(camera, scene) {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    
    // Get all block meshes
    const meshes = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry.attributes.position) {
        meshes.push(object);
      }
    });
    
    const intersects = this.raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      this.targetPosition = intersection.point;
      this.targetNormal = intersection.face.normal;
    } else {
      this.targetPosition = null;
      this.targetNormal = null;
    }
  }

  getTargetBlock(camera, scene) {
    if (!this.targetPosition || !this.targetNormal) return null;
    
    // Check if within interaction range
    const distance = camera.position.distanceTo(this.targetPosition);
    if (distance > INTERACTION_RANGE) return null;
    
    // Offset hit point slightly inward along the face normal to get the solid block
    const inward = this.targetPosition.clone().sub(
      new THREE.Vector3(this.targetNormal.x, this.targetNormal.y, this.targetNormal.z).multiplyScalar(0.01)
    );
    const blockX = Math.floor(inward.x);
    const blockY = Math.floor(inward.y);
    const blockZ = Math.floor(inward.z);
    
    return {
      position: new THREE.Vector3(blockX, blockY, blockZ),
      normal: new THREE.Vector3(this.targetNormal.x, this.targetNormal.y, this.targetNormal.z)
    };
  }
  
  getTargetEnemy(camera, scene) {
    if (!window.game || !window.game.enemies) return null;
    
    // Cast ray from camera center
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    
    // Check enemy meshes
    const enemyMeshes = [];
    window.game.enemies.forEach((enemy, id) => {
      if (enemy.mesh) {
        enemyMeshes.push(enemy.mesh);
        enemyMeshes[enemyMeshes.length - 1].userData = { enemyId: id, enemy: enemy };
      }
    });
    
    const intersects = this.raycaster.intersectObjects(enemyMeshes);
    
    if (intersects.length > 0) {
      const intersection = intersects[0];
      const distance = camera.position.distanceTo(intersection.point);
      
      // Check if within attack range (4 blocks)
      if (distance <= 4) {
        return {
          enemy: intersection.object.userData.enemy,
          distance: distance,
          point: intersection.point
        };
      }
    }
    
    return null;
  }
}

class Inventory {
  constructor(game) {
    this.game = game;
    this.slots = Array(36).fill(null); // 0-8 quickbar, 9-35 backpack
    this.selectedSlot = 0;
    this.panelOpen = false;
    this.containerOpen = false;
    this.containerData = null; // { x, y, z, slots, size }
    this.heldItem = null; // item being moved (click-to-move)
    this.heldSource = null; // { source: 'inventory'|'container', slot: N }
    this.containerSlots = Array(27).fill(null); // Chest slots
    
    this.createInventoryUI();
    this.setupInventoryActions();
    this.updateUI();
  }

  createInventoryUI() {
    // Build quickbar (9 slots at bottom)
    const quickbar = document.getElementById('quickbar');
    quickbar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = this.createSlotEl(i, 'inventory');
      slot.innerHTML = `<span class="slot-number">${i + 1}</span>`;
      quickbar.appendChild(slot);
    }
    this.updateUI();
  }

  createSlotEl(slotIndex, source) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slot = slotIndex;
    slot.dataset.source = source;
    slot.addEventListener('click', () => this.handleSlotClick(source, slotIndex));
    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (source === 'inventory') this.tryEquipSlot(slotIndex);
    });
    return slot;
  }

  tryEquipSlot(slotIndex) {
    const item = this.slots[slotIndex];
    if (!item) return;
    if (this.game.socket) {
      this.game.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.EQUIP_ITEM,
        data: { slot: slotIndex, itemType: item.type }
      }));
    }
  }

  handleSlotClick(source, slotIndex) {
    if (this.heldItem) {
      // Place held item into this slot
      const socket = this.game.socket;
      if (socket) {
        socket.send(JSON.stringify({
          type: MESSAGE_TYPES.MOVE_ITEM,
          data: {
            source: this.heldSource.source,
            dest: source,
            fromSlot: this.heldSource.slot,
            toSlot: slotIndex,
            containerPos: this.containerData ? 
              { x: this.containerData.x, y: this.containerData.y, z: this.containerData.z } : null
          }
        }));
      }
      this.heldItem = null;
      this.heldSource = null;
      document.body.style.cursor = 'default';
    } else {
      // Pick up item from this slot
      let item = null;
      if (source === 'inventory') {
        item = this.slots[slotIndex];
      } else if (source === 'container' && this.containerData) {
        item = this.containerData.slots[slotIndex];
      }
      if (item) {
        this.heldItem = item;
        this.heldSource = { source, slot: slotIndex };
        document.body.style.cursor = 'grab';
      }
    }
    this.updateUI();
  }

  selectQuickbar(slot) {
    this.selectedSlot = slot;
    this.updateUI();
  }

  getSelectedItem() {
    return this.slots[this.selectedSlot];
  }

  togglePanel() {
    console.log('Inventory togglePanel called');
    if (this.containerOpen) {
      console.log('Container is open, closing all');
      this.closeAll();
      return;
    }
    this.panelOpen = !this.panelOpen;
    console.log('Panel open:', this.panelOpen);
    const panel = document.getElementById('inventoryPanel');
    console.log('Inventory panel element:', panel);
    if (panel) {
      panel.classList.toggle('open', this.panelOpen);
      if (this.panelOpen) this.renderPanel();
    } else {
      console.error('Inventory panel element not found!');
    }
  }

  closeAll() {
    this.panelOpen = false;
    this.containerOpen = false;
    this.heldItem = null;
    this.heldSource = null;
    document.body.style.cursor = 'default';
    document.getElementById('inventoryPanel').classList.remove('open');
    document.getElementById('containerPanel').classList.remove('open');
    if (this.containerData && this.game.socket) {
      this.game.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.CLOSE_CONTAINER,
        data: {}
      }));
    }
    this.containerData = null;
  }

  openContainer(data) {
    this.containerData = data;
    this.containerOpen = true;
    this.panelOpen = false;
    document.getElementById('inventoryPanel').classList.remove('open');
    document.getElementById('containerPanel').classList.add('open');
    this.renderContainer();
  }

  renderPanel() {
    // Quickbar section in panel
    const invQuickbar = document.getElementById('invQuickbar');
    invQuickbar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const el = this.createSlotEl(i, 'inventory');
      this.fillSlotEl(el, this.slots[i], i === this.selectedSlot);
      invQuickbar.appendChild(el);
    }
    // Main inventory (slots 9-35)
    const invMain = document.getElementById('invMain');
    invMain.innerHTML = '';
    for (let i = 9; i < 36; i++) {
      const el = this.createSlotEl(i, 'inventory');
      this.fillSlotEl(el, this.slots[i], false);
      invMain.appendChild(el);
    }
  }

  renderContainer() {
    if (!this.containerData) return;
    // Container slots
    const containerSlots = document.getElementById('containerSlots');
    containerSlots.innerHTML = '';
    for (let i = 0; i < this.containerData.size; i++) {
      const el = this.createSlotEl(i, 'container');
      this.fillSlotEl(el, this.containerData.slots[i], false);
      containerSlots.appendChild(el);
    }
    // Player inventory slots below
    const containerInv = document.getElementById('containerInvSlots');
    containerInv.innerHTML = '';
    for (let i = 0; i < 36; i++) {
      const el = this.createSlotEl(i, 'inventory');
      this.fillSlotEl(el, this.slots[i], i === this.selectedSlot);
      containerInv.appendChild(el);
    }
  }

  fillSlotEl(el, item, isSelected) {
    if (isSelected) el.classList.add('selected');
    if (this.heldSource && 
        this.heldSource.source === el.dataset.source && 
        this.heldSource.slot === parseInt(el.dataset.slot)) {
      el.style.opacity = '0.5';
    }
    if (item) {
      const name = ITEM_NAMES[item.type] || '?';
      const color = ITEM_COLORS[item.type] || '#fff';
      el.innerHTML += `<div class="item-icon" style="background:${color}"></div>` +
        `<div class="item-name">${name}</div>` +
        (item.count > 1 ? `<div class="item-count">${item.count}</div>` : '');
    }
  }
  
  // Inventory management methods
  sortInventory() {
    // Sort items by type and quantity
    const nonNullSlots = this.slots
      .map((item, index) => ({ item, index }))
      .filter(slot => slot.item !== null)
      .sort((a, b) => {
        if (a.item.type !== b.item.type) {
          return a.item.type - b.item.type;
        }
        return b.item.count - a.item.count;
      });
    
    // Clear all slots
    this.slots = Array(36).fill(null);
    
    // Place sorted items back
    nonNullSlots.forEach(({ item }, index) => {
      this.slots[index] = item;
    });
    
    this.updateUI();
    this.syncToServer();
  }
  
  stackItems() {
    // Combine stacks of the same item type
    const itemMap = new Map();
    
    // Collect all items
    this.slots.forEach(item => {
      if (item !== null) {
        const key = item.type;
        if (itemMap.has(key)) {
          itemMap.get(key).count += item.count;
        } else {
          itemMap.set(key, { type: item.type, count: item.count });
        }
      }
    });
    
    // Clear and redistribute with proper stacking
    this.slots = Array(36).fill(null);
    let slotIndex = 0;
    
    // Place items back with proper stacking (max 64 per stack)
    itemMap.forEach(item => {
      while (item.count > 0 && slotIndex < 36) {
        const stackSize = Math.min(64, item.count);
        this.slots[slotIndex] = {
          type: item.type,
          count: stackSize
        };
        item.count -= stackSize;
        slotIndex++;
      }
    });
    
    this.updateUI();
    this.syncToServer();
  }
  
  setupInventoryActions() {
    // Setup action buttons
    document.getElementById('sortInvBtn').addEventListener('click', () => {
      this.sortInventory();
    });
    
    document.getElementById('stackInvBtn').addEventListener('click', () => {
      this.stackItems();
    });
    
    document.getElementById('quickDropBtn').addEventListener('click', () => {
      this.quickDrop();
    });
  }
  
  // ... rest of the code remains the same ...
  
  updateUI() {
    // Update quickbar at bottom of screen
    const quickbar = document.getElementById('quickbar');
    const slotEls = quickbar.querySelectorAll('.slot');
    slotEls.forEach((el, i) => {
      el.className = 'slot' + (i === this.selectedSlot ? ' selected' : '');
      el.style.opacity = '';
      const numHtml = `<span class="slot-number">${i + 1}</span>`;
      const item = this.slots[i];
      if (item) {
        const name = ITEM_NAMES[item.type] || '?';
        const color = ITEM_COLORS[item.type] || '#fff';
        el.innerHTML = numHtml +
          `<div class="item-icon" style="background:${color}"></div>` +
          `<div class="item-name">${name}</div>` +
          (item.count > 1 ? `<div class="item-count">${item.count}</div>` : '');
      } else {
        el.innerHTML = numHtml;
      }
    });
    // Re-render open panels
    if (this.panelOpen) this.renderPanel();
    if (this.containerOpen) this.renderContainer();
  }

  updateFromServer(data) {
    this.slots = data.slots;
    this.selectedSlot = data.selectedSlot;
    this.updateUI();
  }
}

class Crafting {
  constructor(game) {
    this.game = game;
    this.panelOpen = false;
    this.selectedRecipe = null;
    this.currentCategory = 'all';
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' && document.activeElement.id !== 'chatInput') {
        this.togglePanel();
      }
    });
    
    // Tab buttons
    document.getElementById('craftAllTab').addEventListener('click', () => {
      this.setCategory('all');
    });
    document.getElementById('craftToolsTab').addEventListener('click', () => {
      this.setCategory('tools');
    });
    document.getElementById('craftWeaponsTab').addEventListener('click', () => {
      this.setCategory('weapons');
    });
    document.getElementById('craftArmorTab').addEventListener('click', () => {
      this.setCategory('armor');
    });
    document.getElementById('craftMaterialsTab').addEventListener('click', () => {
      this.setCategory('materials');
    });
    
    // Craft button
    document.getElementById('craftButton').addEventListener('click', () => {
      this.craftSelectedRecipe();
    });
  }
  
  togglePanel() {
    this.panelOpen = !this.panelOpen;
    const panel = document.getElementById('craftingPanel');
    
    if (this.panelOpen) {
      panel.classList.add('open');
      this.renderRecipeList();
    } else {
      panel.classList.remove('open');
    }
  }
  
  setCategory(category) {
    this.currentCategory = category;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`craft${category.charAt(0).toUpperCase() + category.slice(1)}Tab`).classList.add('active');
    
    this.renderRecipeList();
  }
  
  getFilteredRecipes() {
    if (this.currentCategory === 'all') {
      return CRAFTING_RECIPES;
    }
    
    return CRAFTING_RECIPES.filter(recipe => {
      const resultType = recipe.result.type;
      
      if (this.currentCategory === 'tools') {
        return resultType >= 110 && resultType < 140;
      } else if (this.currentCategory === 'weapons') {
        return resultType >= 100 && resultType < 110;
      } else if (this.currentCategory === 'armor') {
        return resultType >= 200 && resultType < 240;
      } else if (this.currentCategory === 'materials') {
        return resultType === ITEM_TYPES.PLANKS || 
               resultType === ITEM_TYPES.STICK || 
               resultType === ITEM_TYPES.IRON_INGOT ||
               resultType === ITEM_TYPES.GOLD_INGOT ||
               resultType === ITEM_TYPES.COAL ||
               resultType === BLOCK_TYPES.CRAFTING_TABLE ||
               resultType === BLOCK_TYPES.CHEST;
      }
      
      return false;
    });
  }
  
  renderRecipeList() {
    const recipeList = document.getElementById('recipeList');
    const recipes = this.getFilteredRecipes();
    
    recipeList.innerHTML = '';
    
    recipes.forEach((recipe, index) => {
      const recipeEl = document.createElement('div');
      recipeEl.className = 'recipe-item';
      if (this.selectedRecipe === recipe) {
        recipeEl.classList.add('selected');
      }
      
      const resultName = ITEM_NAMES[recipe.result.type] || 'Unknown';
      const resultColor = ITEM_COLORS[recipe.result.type] || '#fff';
      
      recipeEl.innerHTML = `
        <div class="recipe-icon" style="background: ${resultColor}"></div>
        <div class="recipe-name">${resultName}</div>
        <div class="recipe-count">×${recipe.result.count}</div>
      `;
      
      recipeEl.addEventListener('click', () => {
        this.selectRecipe(recipe);
      });
      
      recipeList.appendChild(recipeEl);
    });
  }
  
  selectRecipe(recipe) {
    this.selectedRecipe = recipe;
    
    // Update selection in UI
    document.querySelectorAll('.recipe-item').forEach(el => {
      el.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show recipe details
    this.renderRecipeDetails();
  }
  
  renderRecipeDetails() {
    if (!this.selectedRecipe) {
      document.getElementById('selectedRecipe').innerHTML = '<p>Select a recipe to view details</p>';
      document.getElementById('craftButton').disabled = true;
      return;
    }
    
    const recipe = this.selectedRecipe;
    const resultName = ITEM_NAMES[recipe.result.type] || 'Unknown';
    const resultColor = ITEM_COLORS[recipe.result.type] || '#fff';
    
    // Build ingredients list
    let ingredientsHtml = '<h4>Ingredients:</h4><ul>';
    recipe.ingredients.forEach(ing => {
      const ingName = ITEM_NAMES[ing.type] || 'Unknown';
      const ingColor = ITEM_COLORS[ing.type] || '#fff';
      ingredientsHtml += `<li><span style="color: ${ingColor}">${ingName}</span> ×${ing.count}</li>`;
    });
    ingredientsHtml += '</ul>';
    
    // Check if player has ingredients
    const canCraft = this.canCraftRecipe(recipe);
    const stats = EQUIPMENT_STATS[recipe.result.type];
    
    let statsHtml = '';
    if (stats) {
      statsHtml = '<h4>Stats:</h4><ul>';
      if (stats.damage) statsHtml += `<li>Damage: ${stats.damage}</li>`;
      if (stats.efficiency) statsHtml += `<li>Efficiency: ${stats.efficiency}</li>`;
      if (stats.protection) statsHtml += `<li>Protection: ${stats.protection}</li>`;
      if (stats.durability) statsHtml += `<li>Durability: ${stats.durability}</li>`;
      statsHtml += '</ul>';
    }
    
    document.getElementById('selectedRecipe').innerHTML = `
      <div style="text-align: center; margin-bottom: 10px;">
        <div class="recipe-icon" style="background: ${resultColor}; width: 48px; height: 48px; margin: 0 auto;"></div>
        <h3>${resultName} ×${recipe.result.count}</h3>
      </div>
      ${ingredientsHtml}
      ${statsHtml}
      ${recipe.requiresFurnace ? '<p style="color: #ff9800;">Requires Furnace</p>' : ''}
      ${canCraft ? '<p style="color: #4CAF50;">You have the required materials</p>' : '<p style="color: #f44336;">Missing materials</p>'}
    `;
    
    // Update craft grid
    this.renderCraftGrid();
    
    // Enable/disable craft button
    document.getElementById('craftButton').disabled = !canCraft;
  }
  
  renderCraftGrid() {
    const craftGrid = document.getElementById('craftGrid');
    craftGrid.innerHTML = '';
    
    if (!this.selectedRecipe || !this.selectedRecipe.shape) {
      return;
    }
    
    const shape = this.selectedRecipe.shape;
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const slotIndex = y * 3 + x;
        const slotType = shape[y][x];
        
        const slot = document.createElement('div');
        slot.className = 'craft-slot';
        
        if (slotType > 0) {
          const ingredient = this.selectedRecipe.ingredients.find(ing => ing.type === slotType);
          if (ingredient) {
            const ingName = ITEM_NAMES[ingredient.type] || 'Unknown';
            const ingColor = ITEM_COLORS[ingredient.type] || '#fff';
            slot.className = 'craft-slot filled';
            slot.innerHTML = `<div style="width: 20px; height: 20px; background: ${ingColor}; border-radius: 2px;"></div>`;
            slot.title = `${ingName} ×${ingredient.count}`;
          }
        }
        
        craftGrid.appendChild(slot);
      }
    }
  }
  
  canCraftRecipe(recipe) {
    // Check if player has all required ingredients
    for (const ingredient of recipe.ingredients) {
      let hasCount = 0;
      
      for (const slot of this.game.inventory.slots) {
        if (slot && slot.type === ingredient.type) {
          hasCount += slot.count || 1;
        }
      }
      
      if (hasCount < ingredient.count) {
        return false;
      }
    }
    
    return true;
  }
  
  craftSelectedRecipe() {
    if (!this.selectedRecipe || !this.canCraftRecipe(this.selectedRecipe)) {
      return;
    }
    
    // Send craft request to server
    if (this.game.socket) {
      const recipeToSend = this.selectedRecipe.id || this.selectedRecipe;
      console.log('Sending recipe:', recipeToSend, typeof recipeToSend);
      this.game.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.CRAFT_ITEM,
        data: {
          recipe: recipeToSend
        }
      }));
    }
  }
}

// ── ExplorationTracker ────────────────────────────────────────────────────
class ExplorationTracker {
  constructor(game) {
    this.game = game;
    this.exploredChunks = {};   // "cx,cz" -> { r, g, b, detail, mappingAccum }
    this.landmarks = [];
    this._nextLandmarkId = 1;
    this.compassTarget = null;  // { id, worldX, worldZ, name }

    this._minimapEl  = document.getElementById('minimap');
    this._minimapCtx = this._minimapEl ? this._minimapEl.getContext('2d') : null;
    this._minimapDirty = true;
    this._lastCx = null; this._lastCz = null;

    this._mapPanelEl  = document.getElementById('explorationMapPanel');
    this._mapCanvasEl = document.getElementById('explorationMapCanvas');
    this._mapCtx = null;
    this._mapOpen = false;
    this._mapScale   = 4;     // px per block
    this._mapOffsetX = 0;
    this._mapOffsetZ = 0;
    this._mapDragging = false;
    this._mapDragStart = null;
    this._mapMouseWorld = null;
    this._fiddleLastWorld = null;
    this._fiddleTimer = null;

    this._load();
    this._setupMapEvents();
  }

  _key() { return `expl_${this.game.username || 'anon'}`; }

  _load() {
    try {
      const raw = localStorage.getItem(this._key());
      if (!raw) return;
      const d = JSON.parse(raw);
      this.exploredChunks   = d.exploredChunks   || {};
      this.landmarks        = d.landmarks        || [];
      this._nextLandmarkId  = d.nextLandmarkId   || 1;
      this.compassTarget    = d.compassTarget    || null;
      this.landmarks.forEach(l => { if (!l.id) l.id = this._nextLandmarkId++; });
    } catch (e) {}
  }

  _save() {
    try {
      localStorage.setItem(this._key(), JSON.stringify({
        exploredChunks:  this.exploredChunks,
        landmarks:       this.landmarks,
        nextLandmarkId:  this._nextLandmarkId,
        compassTarget:   this.compassTarget,
      }));
    } catch (e) {}
  }

  // Called periodically from animate loop
  tick() {
    if (!this.game.player) return;
    const px = this.game.player.position.x;
    const pz = this.game.player.position.z;
    const cx = Math.floor(px / 16);
    const cz = Math.floor(pz / 16);

    let changed = false;
    for (let dcx = -3; dcx <= 3; dcx++) {
      for (let dcz = -3; dcz <= 3; dcz++) {
        const key = `${cx+dcx},${cz+dcz}`;
        if (!this.exploredChunks[key]) {
          const col = this._sampleChunkColor(cx+dcx, cz+dcz);
          this.exploredChunks[key] = { r: col[0], g: col[1], b: col[2], detail: 0.15, mappingAccum: 0 };
          changed = true;
        }
      }
    }

    if (changed || cx !== this._lastCx || cz !== this._lastCz) {
      this._lastCx = cx; this._lastCz = cz;
      this._minimapDirty = true;
    }
    if (this._minimapDirty) {
      this._drawMinimap();
      this._minimapDirty = false;
    }
  }

  _sampleChunkColor(cx, cz) {
    if (!this.game.world) return [80, 80, 80];
    let r = 0, g = 0, b = 0, n = 0;
    for (const dx of [4, 8, 12]) {
      for (const dz of [4, 8, 12]) {
        const bx = cx * 16 + dx, bz = cz * 16 + dz;
        for (let y = 62; y >= 0; y--) {
          const bt = this.game.world.getBlock(bx, y, bz);
          if (bt !== 0) {
            const c = TERRAIN_COLORS[bt] || [110, 110, 110];
            r += c[0]; g += c[1]; b += c[2]; n++;
            break;
          }
        }
      }
    }
    return n ? [Math.round(r/n), Math.round(g/n), Math.round(b/n)] : [80, 80, 80];
  }

  // ── Mini-map ────────────────────────────────────────────────────────────
  _drawMinimap() {
    const ctx = this._minimapCtx;
    if (!ctx || !this.game.player) return;
    const W = 160, H = 160, CPX = 12, RC = 6;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a1018'; ctx.fillRect(0, 0, W, H);

    const pcx = Math.floor(this.game.player.position.x / 16);
    const pcz = Math.floor(this.game.player.position.z / 16);

    for (const [key, d] of Object.entries(this.exploredChunks)) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - pcx, dz = cz - pcz;
      if (Math.abs(dx) > RC+1 || Math.abs(dz) > RC+1) continue;
      const sx = W/2 + dx*CPX, sy = H/2 + dz*CPX;
      ctx.fillStyle = `rgba(${d.r},${d.g},${d.b},${0.3 + d.detail * 0.7})`;
      ctx.fillRect(sx, sy, CPX, CPX);
    }

    // Landmarks
    for (const lm of this.landmarks) {
      const dx = lm.worldX/16 - pcx, dz = lm.worldZ/16 - pcz;
      if (Math.abs(dx) > RC || Math.abs(dz) > RC) continue;
      ctx.fillStyle = lm.isTarget ? '#f0c060' : '#ff6688';
      ctx.beginPath(); ctx.arc(W/2+dx*CPX, H/2+dz*CPX, 3, 0, Math.PI*2); ctx.fill();
    }

    // Other players
    this.game.otherPlayers.forEach(op => {
      const dx = op.position.x/16 - pcx, dz = op.position.z/16 - pcz;
      if (Math.abs(dx) > RC || Math.abs(dz) > RC) return;
      ctx.fillStyle = '#ffff44';
      ctx.beginPath(); ctx.arc(W/2+dx*CPX, H/2+dz*CPX, 2.5, 0, Math.PI*2); ctx.fill();
    });

    // Mobs
    this.game.enemies.forEach(mob => {
      if (!mob.position) return;
      const dx = mob.position.x/16 - pcx, dz = mob.position.z/16 - pcz;
      if (Math.abs(dx) > RC || Math.abs(dz) > RC) return;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(W/2+dx*CPX, H/2+dz*CPX, 1.5, 0, Math.PI*2); ctx.fill();
    });

    // Player dot + facing direction
    const yaw = this.game.controls ? this.game.controls.yaw : 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W/2, H/2, 4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#aef'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W/2, H/2);
    ctx.lineTo(W/2 + Math.sin(yaw)*8, H/2 - Math.cos(yaw)*8); ctx.stroke();

    // N label
    ctx.fillStyle = 'rgba(255,90,90,0.75)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', W/2, 11);
  }

  // ── Full Exploration Map ─────────────────────────────────────────────────
  openMap() {
    if (!this._mapPanelEl) return;
    this._mapOpen = true;
    this._mapPanelEl.classList.add('open');
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.game.player) {
      this._mapOffsetX = this.game.player.position.x;
      this._mapOffsetZ = this.game.player.position.z;
    }
    // Size canvas to its container
    const body = document.getElementById('explorationMapBody');
    if (body && this._mapCanvasEl) {
      requestAnimationFrame(() => {
        const rect = body.getBoundingClientRect();
        const sideW = 198;
        this._mapCanvasEl.width  = Math.max(200, rect.width - sideW - 16);
        this._mapCanvasEl.height = Math.max(200, rect.height);
        this._mapCtx = this._mapCanvasEl.getContext('2d');
        this._drawFullMap();
      });
    }
    this._renderLandmarksList();
    this._updateFiddleHint();
    this._fiddleTimer = setInterval(() => this._fiddleTick(), 500);
  }

  closeMap() {
    if (!this._mapPanelEl) return;
    this._mapOpen = false;
    this._mapPanelEl.classList.remove('open');
    clearInterval(this._fiddleTimer); this._fiddleTimer = null;
    this._save();
  }

  _drawFullMap() {
    const ctx = this._mapCtx;
    if (!ctx || !this._mapCanvasEl) return;
    const W = this._mapCanvasEl.width, H = this._mapCanvasEl.height;
    const sc = this._mapScale, ox = this._mapOffsetX, oz = this._mapOffsetZ;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080e18'; ctx.fillRect(0, 0, W, H);

    const CPX = 16 * sc;
    for (const [key, d] of Object.entries(this.exploredChunks)) {
      const [cx, cz] = key.split(',').map(Number);
      const sx = (cx*16 - ox)*sc + W/2, sy = (cz*16 - oz)*sc + H/2;
      if (sx+CPX < 0 || sx > W || sy+CPX < 0 || sy > H) continue;

      if (d.detail >= 1.0 && sc >= 3) {
        this._drawDetailedChunk(ctx, cx, cz, sx, sy, sc);
      } else {
        const a = 0.25 + d.detail * 0.55;
        ctx.fillStyle = `rgba(${d.r},${d.g},${d.b},${a})`;
        ctx.fillRect(sx, sy, CPX, CPX);
        // Soft edge blur effect for vague areas
        if (d.detail < 1.0) {
          ctx.fillStyle = `rgba(${d.r},${d.g},${d.b},${d.detail * 0.12})`;
          ctx.fillRect(sx-3, sy-3, CPX+6, CPX+6);
        }
      }

      // Mapping progress outline
      if (d.mappingAccum > 0 && d.detail < 1.0) {
        const prog = Math.min(d.mappingAccum / 4.0, 1.0);
        ctx.strokeStyle = `rgba(100,220,100,${prog * 0.7})`; ctx.lineWidth = 1.5;
        ctx.strokeRect(sx+1, sy+1, CPX-2, CPX-2);
      }
    }

    // Faint chunk grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 0.5;
    for (let cx = Math.floor((ox - W/2/sc)/16); cx <= Math.ceil((ox + W/2/sc)/16); cx++) {
      const x = (cx*16 - ox)*sc + W/2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let cz = Math.floor((oz - H/2/sc)/16); cz <= Math.ceil((oz + H/2/sc)/16); cz++) {
      const y = (cz*16 - oz)*sc + H/2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Landmarks
    for (const lm of this.landmarks) {
      const sx = (lm.worldX - ox)*sc + W/2, sy = (lm.worldZ - oz)*sc + H/2;
      if (sx < -20 || sx > W+20 || sy < -20 || sy > H+20) continue;
      ctx.fillStyle = lm.isTarget ? '#f0c060' : '#ff6688';
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = lm.isTarget ? '#f0c060' : '#ddd';
      ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(lm.name, sx+8, sy+4);
    }

    // Compass target line
    if (this.compassTarget && this.game.player) {
      const psx = (this.game.player.position.x - ox)*sc + W/2;
      const psy = (this.game.player.position.z - oz)*sc + H/2;
      const tsx = (this.compassTarget.worldX - ox)*sc + W/2;
      const tsy = (this.compassTarget.worldZ - oz)*sc + H/2;
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(240,192,96,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(psx, psy); ctx.lineTo(tsx, tsy); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Player marker
    if (this.game.player) {
      const sx = (this.game.player.position.x - ox)*sc + W/2;
      const sy = (this.game.player.position.z - oz)*sc + H/2;
      const yaw = this.game.controls ? this.game.controls.yaw : 0;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#aef'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#aef'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.sin(yaw)*12, sy - Math.cos(yaw)*12); ctx.stroke();
    }

    // Scale bar
    const scaleBlocks = Math.pow(2, Math.round(Math.log2(80/sc)));
    const barW = scaleBlocks * sc;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(10, H-14, barW, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${scaleBlocks}m`, 14 + barW, H-10);
  }

  _drawDetailedChunk(ctx, cx, cz, sx, sy, sc) {
    for (let bx = 0; bx < 16; bx++) {
      for (let bz = 0; bz < 16; bz++) {
        const wx = cx*16+bx, wz = cz*16+bz;
        let col = [80, 80, 80];
        if (this.game.world) {
          for (let y = 62; y >= 0; y--) {
            const bt = this.game.world.getBlock(wx, y, wz);
            if (bt !== 0) { col = TERRAIN_COLORS[bt] || [110,110,110]; break; }
          }
        }
        ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.fillRect(sx + bx*sc, sy + bz*sc, sc, sc);
      }
    }
  }

  _fiddleTick() {
    if (!this._mapMouseWorld) return;
    const pos = this._mapMouseWorld;
    const last = this._fiddleLastWorld;
    if (last && Math.abs(pos.wx - last.wx) < 12 && Math.abs(pos.wz - last.wz) < 12) return;
    this._fiddleLastWorld = { wx: pos.wx, wz: pos.wz };

    const cx = Math.floor(pos.wx / 16), cz = Math.floor(pos.wz / 16);
    let changed = false;
    for (let dcx = -1; dcx <= 1; dcx++) {
      for (let dcz = -1; dcz <= 1; dcz++) {
        const key = `${cx+dcx},${cz+dcz}`;
        const d = this.exploredChunks[key];
        if (d && d.detail < 1.0) {
          d.mappingAccum += 0.5;
          if (d.mappingAccum >= 4.0) {
            d.detail = 1.0;
            const col = this._sampleChunkColor(cx+dcx, cz+dcz);
            d.r = col[0]; d.g = col[1]; d.b = col[2];
          }
          changed = true;
        }
      }
    }
    if (changed) { this._drawFullMap(); this._updateFiddleHint(); this._minimapDirty = true; }
  }

  _updateFiddleHint() {
    const el = document.getElementById('mapFiddleHint');
    if (!el) return;
    const vals = Object.values(this.exploredChunks);
    if (!vals.length) { el.textContent = 'Explore the world to reveal the map.'; return; }
    const unmapped = vals.filter(d => d.detail < 1.0).length;
    if (unmapped === 0) el.textContent = '✓ All visited areas fully charted';
    else el.textContent = `Move cursor here to chart in detail (${vals.length - unmapped}/${vals.length} areas)`;
  }

  _worldFromCanvas(mx, my) {
    if (!this._mapCanvasEl) return { wx: 0, wz: 0 };
    const W = this._mapCanvasEl.width, H = this._mapCanvasEl.height;
    return {
      wx: (mx - W/2) / this._mapScale + this._mapOffsetX,
      wz: (my - H/2) / this._mapScale + this._mapOffsetZ,
    };
  }

  _setupMapEvents() {
    const canvas = document.getElementById('explorationMapCanvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
      if (!this._mapOpen) return;
      const r = canvas.getBoundingClientRect();
      this._mapMouseWorld = this._worldFromCanvas(e.clientX - r.left, e.clientY - r.top);
      if (this._mapDragging && this._mapDragStart) {
        const dx = (e.clientX - this._mapDragStart.mx) / this._mapScale;
        const dz = (e.clientY - this._mapDragStart.mz) / this._mapScale;
        this._mapOffsetX = this._mapDragStart.ox - dx;
        this._mapOffsetZ = this._mapDragStart.oz - dz;
        this._drawFullMap();
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this._mapDragging = true;
        this._mapDragStart = { mx: e.clientX, mz: e.clientY, ox: this._mapOffsetX, oz: this._mapOffsetZ };
      }
    });
    canvas.addEventListener('mouseup', () => { this._mapDragging = false; });
    canvas.addEventListener('mouseleave', () => { this._mapDragging = false; this._mapMouseWorld = null; });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this._mapOpen) return;
      const r = canvas.getBoundingClientRect();
      const { wx, wz } = this._worldFromCanvas(e.clientX - r.left, e.clientY - r.top);
      const nameEl = document.getElementById('landmarkNameInput');
      const name = nameEl?.value.trim() || `Pin ${this._nextLandmarkId}`;
      this.addLandmark(Math.round(wx), Math.round(wz), name);
      if (nameEl) nameEl.value = '';
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1 : -1;
      this._mapScale = Math.max(1, Math.min(16, this._mapScale + factor));
      document.getElementById('mapZoomInfo').textContent =
        `Zoom ${this._mapScale}px/blk · Scroll to zoom · Drag to pan · Right-click to pin`;
      this._drawFullMap();
    }, { passive: false });

    const saveBtn = document.getElementById('mapLandmarkBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      if (!this.game.player) return;
      const nameEl = document.getElementById('landmarkNameInput');
      const name = nameEl?.value.trim() || `Pin ${this._nextLandmarkId}`;
      this.addLandmark(Math.round(this.game.player.position.x), Math.round(this.game.player.position.z), name);
      if (nameEl) nameEl.value = '';
    });

    const closeBtn = document.getElementById('mapCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeMap());
  }

  addLandmark(worldX, worldZ, name) {
    const lm = { id: this._nextLandmarkId++, worldX, worldZ, name, isTarget: false };
    this.landmarks.push(lm);
    this._save(); this._drawFullMap(); this._renderLandmarksList(); this._minimapDirty = true;
  }

  removeLandmark(id) {
    this.landmarks = this.landmarks.filter(l => l.id !== id);
    if (this.compassTarget?.id === id) this.compassTarget = null;
    this._save(); this._drawFullMap(); this._renderLandmarksList(); this._minimapDirty = true;
  }

  setCompassTarget(id) {
    const already = this.compassTarget?.id === id;
    this.landmarks.forEach(l => l.isTarget = !already && l.id === id);
    this.compassTarget = already ? null : (this.landmarks.find(l => l.id === id) || null);
    if (this.compassTarget) {
      this.compassTarget = { id: this.compassTarget.id, worldX: this.compassTarget.worldX, worldZ: this.compassTarget.worldZ, name: this.compassTarget.name };
    }
    this._save(); this._drawFullMap(); this._renderLandmarksList(); this._minimapDirty = true;
  }

  _renderLandmarksList() {
    const el = document.getElementById('landmarksList');
    if (!el) return;
    if (!this.landmarks.length) {
      el.innerHTML = '<h4>Landmarks</h4><div class="quest-empty">Right-click map to pin a location.</div>';
      return;
    }
    el.innerHTML = '<h4>Landmarks</h4>' + this.landmarks.map(lm => `
      <div class="landmark-item ${lm.isTarget ? 'targeted' : ''}" data-id="${lm.id}">
        <span class="landmark-target-btn" title="Set compass target">🧭</span>
        <span class="landmark-name">${lm.name}</span>
        <span class="landmark-del-btn" title="Remove">✕</span>
      </div>`).join('');
    el.querySelectorAll('.landmark-target-btn').forEach(b =>
      b.addEventListener('click', () => this.setCompassTarget(+b.closest('.landmark-item').dataset.id)));
    el.querySelectorAll('.landmark-del-btn').forEach(b =>
      b.addEventListener('click', () => this.removeLandmark(+b.closest('.landmark-item').dataset.id)));
    el.querySelectorAll('.landmark-item').forEach(item =>
      item.addEventListener('dblclick', () => {
        const lm = this.landmarks.find(l => l.id === +item.dataset.id);
        if (lm) { this._mapOffsetX = lm.worldX; this._mapOffsetZ = lm.worldZ; this._drawFullMap(); }
      }));
  }
}

// ── Compass ────────────────────────────────────────────────────────────────
class Compass {
  constructor(game) {
    this.game = game;
    this._canvasEl = document.getElementById('compassCanvas');
    this._targetNameEl = document.getElementById('compassTargetName');
    this._ctx = this._canvasEl ? this._canvasEl.getContext('2d') : null;
  }

  update() {
    const ctx = this._ctx;
    if (!ctx) return;
    const W = 72, H = 72, cx = 36, cy = 36, R = 28;
    const yaw = this.game.controls ? this.game.controls.yaw : 0;

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(8,14,24,0.75)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();

    // Tick marks
    for (let i = 0; i < 12; i++) {
      const a = (-Math.PI/2 + yaw) + i * Math.PI/6;
      const len = i % 3 === 0 ? 5 : 3;
      ctx.strokeStyle = i%3===0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a)*(R-len), cy + Math.sin(a)*(R-len));
      ctx.lineTo(cx + Math.cos(a)*R,       cy + Math.sin(a)*R);
      ctx.stroke();
    }

    // Cardinal letters — angle in canvas: N_base=-PI/2, then +yaw rotates ring
    const dirs = [
      { label: 'N', base: -Math.PI/2, color: '#ff5544' },
      { label: 'E', base:  0,         color: 'rgba(255,255,255,0.8)' },
      { label: 'S', base:  Math.PI/2, color: 'rgba(255,255,255,0.8)' },
      { label: 'W', base:  Math.PI,   color: 'rgba(255,255,255,0.8)' },
    ];
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const d of dirs) {
      const a = d.base + yaw;
      ctx.fillStyle = d.color;
      ctx.fillText(d.label, cx + Math.cos(a)*20, cy + Math.sin(a)*20);
    }

    // Compass target needle or north arrow
    const tracker = this.game.explorationTracker;
    const hasTarget = tracker?.compassTarget && this.game.player;
    if (hasTarget) {
      const tx = tracker.compassTarget.worldX - this.game.player.position.x;
      const tz = tracker.compassTarget.worldZ - this.game.player.position.z;
      const tWorldAngle = Math.atan2(tx, -tz);
      const na = tWorldAngle + yaw - Math.PI/2;
      ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(na)*22, cy + Math.sin(na)*22); ctx.stroke();
      ctx.fillStyle = '#f0c060';
      ctx.beginPath(); ctx.arc(cx + Math.cos(na)*22, cy + Math.sin(na)*22, 3, 0, Math.PI*2); ctx.fill();
      const dist = Math.round(Math.sqrt(tx*tx + tz*tz));
      if (this._targetNameEl) this._targetNameEl.textContent = `◎ ${tracker.compassTarget.name} (${dist}m)`;
    } else {
      if (this._targetNameEl) this._targetNameEl.textContent = '';
    }

    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.fill();
  }
}

// ── QuestJournal ───────────────────────────────────────────────────────────
class QuestJournal {
  constructor(game) {
    this.game = game;
    this.activeQuests   = [];  // [{ id, name, description, requirements, progress }]
    this.completedQuests = [];
    this._panelEl = document.getElementById('questJournalPanel');
  }

  toggle() { this._panelEl?.classList.toggle('open'); }
  close()  { this._panelEl?.classList.remove('open'); }
  isOpen() { return this._panelEl?.classList.contains('open') || false; }

  addQuest(data) {
    if (this.activeQuests.find(q => q.id === data.quest_id)) return;
    this.activeQuests.push({
      id:           data.quest_id,
      name:         data.quest?.name        || data.quest_id,
      description:  data.quest?.description || '',
      requirements: data.quest?.requirements || [],
      progress:     {},
    });
    this._render();
  }

  completeQuest(data) {
    const idx = this.activeQuests.findIndex(q => q.id === data.quest_id);
    if (idx !== -1) {
      const q = this.activeQuests.splice(idx, 1)[0];
      this.completedQuests.push(q);
    }
    this._render();
  }

  updateProgress(inventorySlots) {
    for (const q of this.activeQuests) {
      for (const req of q.requirements) {
        if (req.type === 'item') {
          let count = 0;
          for (const slot of inventorySlots) {
            if (slot && slot.type === req.item_type) count += slot.count || 1;
          }
          q.progress[req.item_type] = count;
        }
      }
    }
    if (this.isOpen()) this._render();
  }

  _render() {
    const activeEl = document.getElementById('questActiveList');
    const doneEl   = document.getElementById('questDoneList');
    if (!activeEl || !doneEl) return;

    if (!this.activeQuests.length) {
      activeEl.innerHTML = '<div class="quest-empty">No active quests. Talk to an NPC to get started.</div>';
    } else {
      activeEl.innerHTML = this.activeQuests.map(q => {
        const objs = q.requirements.map(r => {
          if (r.type !== 'item') return '';
          const have = q.progress[r.item_type] || 0;
          const done = have >= r.count;
          const name = ITEM_NAMES[r.item_type] || `Item ${r.item_type}`;
          return `<div class="quest-objective ${done ? 'done' : ''}">
            <span>${done ? '✓' : '○'}</span>
            <span>${name}: ${Math.min(have, r.count)}/${r.count}</span>
          </div>`;
        }).join('');
        return `<div class="quest-item">
          <div class="quest-name">${q.name}</div>
          <div class="quest-desc">${q.description}</div>
          ${objs}
        </div>`;
      }).join('');
    }

    if (!this.completedQuests.length) {
      doneEl.innerHTML = '<div class="quest-empty">None yet.</div>';
    } else {
      doneEl.innerHTML = this.completedQuests.slice(-5).map(q =>
        `<div class="quest-item" style="opacity:0.5">
          <div class="quest-name">✓ ${q.name}</div>
        </div>`).join('');
    }
  }
}

class EquipmentPanel {
  constructor(game) {
    this.game = game;
    this.panelEl = document.getElementById('equipPanel');
    this.equipped = {
      weapon: null, offhand: null,
      helmet: null, chestplate: null, leggings: null, boots: null,
      ring: null, amulet: null,
    };
    this._initSlotClicks();
  }

  _initSlotClicks() {
    if (!this.panelEl) return;
    this.panelEl.querySelectorAll('.equip-slot').forEach(slotEl => {
      slotEl.addEventListener('click', () => {
        const slotName = slotEl.dataset.slot;
        if (this.equipped[slotName]) this._unequip(slotName);
      });
    });
  }

  toggle() {
    if (!this.panelEl) return;
    this.panelEl.classList.toggle('open');
  }

  close() {
    if (this.panelEl) this.panelEl.classList.remove('open');
  }

  applyUpdate(data) {
    if (data.equipped_weapon) {
      this.equipped.weapon = data.equipped_weapon;
    }
    if (data.equipped_armor) {
      this.equipped.helmet      = data.equipped_armor.helmet     || null;
      this.equipped.chestplate  = data.equipped_armor.chestplate || null;
      this.equipped.leggings    = data.equipped_armor.leggings   || null;
      this.equipped.boots       = data.equipped_armor.boots      || null;
    }
    this._render();
  }

  _render() {
    const SLOT_ICONS = {
      weapon: '⚔️', offhand: '🛡️', helmet: '🪖',
      chestplate: '🥋', leggings: '👖', boots: '👢',
      ring: '💍', amulet: '📿',
    };
    const ITEM_NAMES_LOCAL = typeof ITEM_NAMES !== 'undefined' ? ITEM_NAMES : {};
    let totalAtk = 1, totalDef = 0;

    Object.entries(this.equipped).forEach(([slotName, item]) => {
      const el = document.getElementById(`slot-${slotName}`);
      if (!el) return;
      if (item) {
        const name = ITEM_NAMES_LOCAL[item.type] || `Item ${item.type}`;
        el.classList.add('filled');
        el.innerHTML = `<span class="equip-slot-item">${name}</span><span class="equip-slot-label">${slotName}</span>`;
        if (item.damage)     totalAtk += item.damage;
        if (item.protection) totalDef += item.protection;
      } else {
        el.classList.remove('filled');
        el.innerHTML = `<span class="equip-slot-icon">${SLOT_ICONS[slotName] || '?'}</span><span class="equip-slot-label">${slotName}</span>`;
      }
    });

    const hp = this.game.player ? this.game.player.maxHealth : 100;
    const atkEl = document.getElementById('eqAtk');
    const defEl = document.getElementById('eqDef');
    const hpEl  = document.getElementById('eqHp');
    if (atkEl) atkEl.textContent = totalAtk;
    if (defEl) defEl.textContent = totalDef;
    if (hpEl)  hpEl.textContent  = hp;
  }

  _unequip(slotName) {
    if (this.game.socket) {
      this.game.socket.send(JSON.stringify({
        type: MESSAGE_TYPES.UNEQUIP_ITEM,
        data: { slot: slotName }
      }));
    }
  }
}

class UI {
  constructor() {
    this.consoleEl = document.getElementById('console');
    this.healthEl = document.getElementById('health');
    this.positionEl = document.getElementById('position');
    this.targetNameEl = document.getElementById('target-name');
    this._lastTargetType = -1;
  }

  updateTargetName(raycaster, camera, world) {
    const target = raycaster.getTargetBlock(camera, null);
    if (!target) {
      if (this.targetNameEl) this.targetNameEl.classList.add('hidden');
      this._lastTargetType = -1;
      return;
    }
    const blockType = world.getBlock(target.position.x, target.position.y, target.position.z);
    if (blockType === BLOCK_TYPES.AIR) {
      if (this.targetNameEl) this.targetNameEl.classList.add('hidden');
      this._lastTargetType = -1;
      return;
    }
    if (blockType !== this._lastTargetType) {
      const name = BLOCK_NAMES[blockType] || `Block ${blockType}`;
      if (this.targetNameEl) {
        this.targetNameEl.textContent = name;
        this.targetNameEl.classList.remove('hidden');
      }
      this._lastTargetType = blockType;
    }
  }

  showConsole(message) {
    this.consoleEl.classList.remove('hidden');
    this.consoleEl.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${message}</div>`;
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.consoleEl.classList.add('hidden');
    }, 5000);
  }

  updateHealth(health) {
    this.healthEl.textContent = health;
  }

  updatePosition(position) {
    this.positionEl.textContent = `${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}`;
  }
}

// Start the game when the page loads
window.addEventListener('load', () => {
  console.log('Page loaded, checking dependencies...');
  if (typeof THREE === 'undefined') {
    console.error('THREE.js not loaded');
    alert('Error: THREE.js not loaded');
    return;
  }
  console.log('Creating VoxelGame...');
  try {
    new VoxelGame();
    console.log('VoxelGame created successfully');
  } catch (error) {
    console.error('Error creating VoxelGame:', error);
    alert('Error creating game: ' + error.message);
  }
});
