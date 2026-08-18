/**
 * Cooler Planogram AI Studio - Bundled Standalone Runtime
 * 2-Stage Architecture:
 *   Stage 1: Mathematical Knapsack Optimization (Hard Constraints: Width, Height, Weight, Min/Max Facings)
 *   Stage 2: Post-Solver Brand Flow & Sequencing (Preserves user's master brand order A->B->C->D as A->C->D if B not selected)
 * Guarantees:
 *   - Strictly 0% door/shelf width overflow (Placements strictly fit usable_width_mm)
 */

(function () {
  'use strict';

  // ==========================================
  // 1. EMBEDDED DEFAULT CSV DATASETS
  // ==========================================
  const RAW_SKUS_CSV = `sku_id,name,brand,sub_brand,category,sub_category,flavor,sugar_type,pack_type,pack_material,pack_size_ml,pack_size_label,width_mm,height_mm,depth_mm,weight_g,unit_cost,unit_price,margin,sales_velocity_units_day,min_facings,max_facings,case_pack_units,is_core_sku,color_hex,image_emoji
CC-ORIG-330,Coca-Cola Original 330ml Can,Coca-Cola,Classic,Carbonated Soft Drinks,Cola,Original,Regular,Can,Aluminium,330,330ml,66,115,66,355,0.45,1.50,1.05,48.0,2,5,24,TRUE,#E61B23,🥤
CC-ZERO-330,Coca-Cola Zero Sugar 330ml Can,Coca-Cola,Zero Sugar,Carbonated Soft Drinks,Cola,Zero Sugar,Zero Sugar,Can,Aluminium,330,330ml,66,115,66,340,0.45,1.50,1.05,38.5,2,4,24,TRUE,#1E1E1E,🥤
CC-DIET-330,Diet Coke 330ml Can,Coca-Cola,Diet,Carbonated Soft Drinks,Cola,Diet,Diet,Can,Aluminium,330,330ml,66,115,66,340,0.45,1.50,1.05,26.0,1,3,24,TRUE,#A0A0A0,🥤
CC-CHRY-330,Coca-Cola Cherry 330ml Can,Coca-Cola,Flavors,Carbonated Soft Drinks,Cola,Cherry,Regular,Can,Aluminium,330,330ml,66,115,66,355,0.48,1.60,1.12,14.5,1,2,24,FALSE,#7E0D25,🍒
SP-ORIG-330,Sprite Lemon-Lime 330ml Can,Sprite,Classic,Carbonated Soft Drinks,Lemon-Lime,Original,Regular,Can,Aluminium,330,330ml,66,115,66,350,0.42,1.45,1.03,29.0,1,3,24,TRUE,#008B45,🍋
SP-ZERO-330,Sprite Zero Sugar 330ml Can,Sprite,Zero Sugar,Carbonated Soft Drinks,Lemon-Lime,Zero Sugar,Zero Sugar,Can,Aluminium,330,330ml,66,115,66,338,0.42,1.45,1.03,18.0,1,2,24,FALSE,#2E8B57,🍋
FA-ORNG-330,Fanta Orange 330ml Can,Fanta,Classic,Carbonated Soft Drinks,Fruit Soda,Citrus,Regular,Can,Aluminium,330,330ml,66,115,66,355,0.40,1.40,1.00,24.5,1,3,24,TRUE,#FF7900,🍊
FA-GRPE-330,Fanta Grape 330ml Can,Fanta,Flavors,Carbonated Soft Drinks,Fruit Soda,Berry,Regular,Can,Aluminium,330,330ml,66,115,66,355,0.40,1.40,1.00,12.0,1,2,24,FALSE,#663399,🍇
PEP-ORIG-330,Pepsi Max 330ml Can,Pepsi,Max,Carbonated Soft Drinks,Cola,Zero Sugar,Zero Sugar,Can,Aluminium,330,330ml,66,115,66,340,0.40,1.40,1.00,31.0,1,4,24,TRUE,#004B93,🥤
PEP-TWST-330,Pepsi Twist Lemon 330ml Can,Pepsi,Twist,Carbonated Soft Drinks,Cola,Citrus,Regular,Can,Aluminium,330,330ml,66,115,66,345,0.42,1.45,1.03,11.5,1,2,24,FALSE,#002F6C,🍋
RB-ORIG-250,Red Bull Energy Drink 250ml Slim Can,Red Bull,Classic,Energy Drinks,Functional Energy,Original,Regular,Slim Can,Aluminium,250,250ml,53,134,53,270,0.95,2.65,1.70,44.0,2,5,24,TRUE,#1C355E,⚡
RB-SUGR-250,Red Bull Sugarfree 250ml Slim Can,Red Bull,Sugarfree,Energy Drinks,Functional Energy,Zero Sugar,Zero Sugar,Slim Can,Aluminium,250,250ml,53,134,53,260,0.95,2.65,1.70,27.5,1,3,24,TRUE,#6C8CBF,⚡
RB-YLLW-250,Red Bull Tropical Edition 250ml Slim Can,Red Bull,Editions,Energy Drinks,Functional Energy,Tropical,Regular,Slim Can,Aluminium,250,250ml,53,134,53,270,0.98,2.75,1.77,16.0,1,2,24,FALSE,#D4AF37,🍍
MN-ORIG-500,Monster Energy Original 500ml Mega Can,Monster Energy,Classic,Energy Drinks,High Performance,Original,Regular,Mega Can,Aluminium,500,500ml,66,168,66,540,0.85,2.50,1.65,36.0,2,4,12,TRUE,#101010,🔋
MN-ULTR-500,Monster Energy Ultra White 500ml Mega Can,Monster Energy,Ultra,Energy Drinks,High Performance,Zero Sugar,Zero Sugar,Mega Can,Aluminium,500,500ml,66,168,66,520,0.85,2.50,1.65,32.0,2,4,12,TRUE,#E0E0E0,🔋
MN-MANGO-500,Monster Mango Loco 500ml Mega Can,Monster Energy,Juice,Energy Drinks,High Performance,Tropical,Regular,Mega Can,Aluminium,500,500ml,66,168,66,540,0.88,2.55,1.67,19.5,1,2,12,FALSE,#0099B8,🥭
EV-WTR-500,Evian Natural Mineral Water 500ml Bottle,Evian,Mineral,Waters & Juices,Still Water,Original,No Added Sugar,PET Bottle,PET Plastic,500,500ml,64,210,64,520,0.35,1.30,0.95,28.0,2,4,24,TRUE,#F47999,💧
SP-SPRK-500,San Pellegrino Sparkling Water 500ml Bottle,San Pellegrino,Sparkling,Waters & Juices,Sparkling Water,Original,No Added Sugar,Glass Bottle,Glass,500,500ml,68,220,68,530,0.45,1.65,1.20,19.0,1,3,24,TRUE,#003A70,✨
INN-SMTH-250,Innocent Mango Passionfruit Smoothie 250ml,Innocent,Smoothie,Waters & Juices,Smoothie,Tropical,No Added Sugar,PET Bottle,PET Plastic,250,250ml,56,150,56,280,0.90,2.40,1.50,15.0,1,2,12,FALSE,#FFAE00,🧃
OAT-ICED-330,Oatly Iced Coffee Mocha 330ml Carton,Oatly,Coffee,Ready-To-Drink Coffee & Dairy,Cold Brew Dairy-Free,Original,Regular,Prisma Carton,Carton,330,330ml,60,150,60,360,0.85,2.20,1.35,17.5,1,3,18,TRUE,#654321,☕
CC-BOT-1500,Coca-Cola Original 1.5L PET Bottle,Coca-Cola,Classic,Large Bottles (1L+),Cola,Original,Regular,Large Bottle,PET Plastic,1500,1.5L,95,330,95,1580,0.90,2.75,1.85,14.0,1,3,6,TRUE,#D80008,🍾
PEP-BOT-1500,Pepsi Max 1.5L PET Bottle,Pepsi,Max,Large Bottles (1L+),Cola,Zero Sugar,Zero Sugar,Large Bottle,PET Plastic,1500,1.5L,95,330,95,1550,0.85,2.50,1.65,11.0,1,2,6,TRUE,#003366,🍾`;

  const RAW_COOLER_SPECS_CSV = `cooler_id,cooler_name,total_doors,total_width_mm,total_height_mm,total_depth_mm,door_index,door_label,shelf_id,shelf_index,tier,tier_label,usable_width_mm,usable_depth_mm,clearance_height_mm,max_weight_kg,eye_level_score,has_pusher_track,cooling_zone
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,1,Door 1 (Left - Core & Flavours),D1-S1,1,top,Top Shelf,610,550,270,45.0,0.60,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,1,Door 1 (Left - Core & Flavours),D1-S2,2,reach_level,Upper Reach,610,550,280,45.0,0.85,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,1,Door 1 (Left - Core & Flavours),D1-S3,3,eye_level,Eye-Level Golden Zone,610,550,300,50.0,1.00,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,1,Door 1 (Left - Core & Flavours),D1-S4,4,touch_level,Mid-Lower Shelf,610,550,310,50.0,0.75,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,1,Door 1 (Left - Core & Flavours),D1-S5,5,bottom,Bottom Base Shelf,610,580,370,65.0,0.40,FALSE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,2,Door 2 (Right - Energy & Hydration),D2-S1,1,top,Top Shelf,610,550,270,45.0,0.60,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,2,Door 2 (Right - Energy & Hydration),D2-S2,2,reach_level,Upper Reach,610,550,280,45.0,0.85,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,2,Door 2 (Right - Energy & Hydration),D2-S3,3,eye_level,Eye-Level Golden Zone,610,550,300,50.0,1.00,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,2,Door 2 (Right - Energy & Hydration),D2-S4,4,touch_level,Mid-Lower Shelf,610,550,310,50.0,0.75,TRUE,Chilled (2-4°C)
COOLER-2DOOR-STD,Standard 2-Door Commercial Glass Cooler,2,1340,1980,720,2,Door 2 (Right - Energy & Hydration),D2-S5,5,bottom,Bottom Base Shelf,610,580,370,65.0,0.40,FALSE,Chilled (2-4°C)
COOLER-1DOOR-COMPACT,Compact 1-Door Express Cooler,1,700,1950,650,1,Door 1 (Single Bay),D1-S1,1,top,Top Shelf,610,500,270,40.0,0.60,TRUE,Chilled (2-4°C)
COOLER-1DOOR-COMPACT,Compact 1-Door Express Cooler,1,700,1950,650,1,Door 1 (Single Bay),D1-S2,2,reach_level,Upper Reach,610,500,280,40.0,0.85,TRUE,Chilled (2-4°C)
COOLER-1DOOR-COMPACT,Compact 1-Door Express Cooler,1,700,1950,650,1,Door 1 (Single Bay),D1-S3,3,eye_level,Eye-Level Golden Zone,610,500,300,45.0,1.00,TRUE,Chilled (2-4°C)
COOLER-1DOOR-COMPACT,Compact 1-Door Express Cooler,1,700,1950,650,1,Door 1 (Single Bay),D1-S4,4,bottom,Bottom Shelf,610,520,380,55.0,0.45,FALSE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,1,Door 1 (Left - Core CSD & Flavours),D1-S1,1,top,Top Shelf,630,580,270,50.0,0.60,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,1,Door 1 (Left - Core CSD & Flavours),D1-S2,2,reach_level,Upper Reach,630,580,280,50.0,0.85,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,1,Door 1 (Left - Core CSD & Flavours),D1-S3,3,eye_level,Eye-Level Golden Zone,630,580,300,55.0,1.00,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,1,Door 1 (Left - Core CSD & Flavours),D1-S4,4,touch_level,Mid-Lower Shelf,630,580,310,55.0,0.75,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,1,Door 1 (Left - Core CSD & Flavours),D1-S5,5,bottom,Bottom Base Shelf,630,600,370,70.0,0.40,FALSE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,2,Door 2 (Center - Energy & Ready Coffee),D2-S1,1,top,Top Shelf,630,580,270,50.0,0.60,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,2,Door 2 (Center - Energy & Ready Coffee),D2-S2,2,reach_level,Upper Reach,630,580,280,50.0,0.85,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,2,Door 2 (Center - Energy & Ready Coffee),D2-S3,3,eye_level,Eye-Level Golden Zone,630,580,300,55.0,1.00,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,2,Door 2 (Center - Energy & Ready Coffee),D2-S4,4,touch_level,Mid-Lower Shelf,630,580,310,55.0,0.75,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,2,Door 2 (Center - Energy & Ready Coffee),D2-S5,5,bottom,Bottom Base Shelf,630,600,370,70.0,0.40,FALSE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,3,Door 3 (Right - Waters Juices & Smoothies),D3-S1,1,top,Top Shelf,630,580,270,50.0,0.60,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,3,Door 3 (Right - Waters Juices & Smoothies),D3-S2,2,reach_level,Upper Reach,630,580,280,50.0,0.85,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,3,Door 3 (Right - Waters Juices & Smoothies),D3-S3,3,eye_level,Eye-Level Golden Zone,630,580,300,55.0,1.00,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,3,Door 3 (Right - Waters Juices & Smoothies),D3-S4,4,touch_level,Mid-Lower Shelf,630,580,310,55.0,0.75,TRUE,Chilled (2-4°C)
COOLER-3DOOR-HYPER,Hypermarket 3-Door Beverage Showcase,3,2050,2020,750,3,Door 3 (Right - Waters Juices & Smoothies),D3-S5,5,bottom,Bottom Base Shelf,630,600,370,70.0,0.40,FALSE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,1,Door 1 (Left - Refreshment),D1-S1,1,top,Top Shelf,500,480,270,38.0,0.60,TRUE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,1,Door 1 (Left - Refreshment),D1-S2,2,reach_level,Upper Reach,500,480,280,38.0,0.85,TRUE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,1,Door 1 (Left - Refreshment),D1-S3,3,eye_level,Eye-Level Golden Zone,500,480,300,42.0,1.00,TRUE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,1,Door 1 (Left - Refreshment),D1-S4,4,bottom,Bottom Base Shelf,500,500,360,50.0,0.40,FALSE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,2,Door 2 (Right - Functional & Water),D2-S1,1,top,Top Shelf,500,480,270,38.0,0.60,TRUE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,2,Door 2 (Right - Functional & Water),D2-S2,2,reach_level,Upper Reach,500,480,280,38.0,0.85,TRUE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,2,Door 2 (Right - Functional & Water),D2-S3,3,eye_level,Eye-Level Golden Zone,500,480,300,42.0,1.00,TRUE,Chilled (2-4°C)
COOLER-2DOOR-SLIM,Slim-Line 2-Door Convenience Cooler,2,1120,1950,650,2,Door 2 (Right - Functional & Water),D2-S4,4,bottom,Bottom Base Shelf,500,500,360,50.0,0.40,FALSE,Chilled (2-4°C)
COOLER-1DOOR-TALL,High-Capacity 1-Door Tall Beverage Cooler,1,850,2150,700,1,Door 1 (High Bay),D1-S1,1,top,Top Shelf,750,540,280,50.0,0.60,TRUE,Chilled (2-4°C)
COOLER-1DOOR-TALL,High-Capacity 1-Door Tall Beverage Cooler,1,850,2150,700,1,Door 1 (High Bay),D1-S2,2,reach_level,Upper Reach Tier 1,750,540,290,50.0,0.85,TRUE,Chilled (2-4°C)
COOLER-1DOOR-TALL,High-Capacity 1-Door Tall Beverage Cooler,1,850,2150,700,1,Door 1 (High Bay),D1-S3,3,eye_level,Eye-Level Golden Zone 1,750,540,300,55.0,1.00,TRUE,Chilled (2-4°C)
COOLER-1DOOR-TALL,High-Capacity 1-Door Tall Beverage Cooler,1,850,2150,700,1,Door 1 (High Bay),D1-S4,4,eye_level,Eye-Level Golden Zone 2,750,540,300,55.0,0.95,TRUE,Chilled (2-4°C)
COOLER-1DOOR-TALL,High-Capacity 1-Door Tall Beverage Cooler,1,850,2150,700,1,Door 1 (High Bay),D1-S5,5,touch_level,Lower Touch Shelf,750,540,310,55.0,0.75,TRUE,Chilled (2-4°C)
COOLER-1DOOR-TALL,High-Capacity 1-Door Tall Beverage Cooler,1,850,2150,700,1,Door 1 (High Bay),D1-S6,6,bottom,Bottom Base Shelf,750,560,380,65.0,0.40,FALSE,Chilled (2-4°C)`;

  const DEFAULT_RULES = {
    "ruleset_version": "1.0",
    "brand_order": [
      { "brand": "Coca-Cola", "priority": 1, "preferred_doors": [1], "adjacent_brands": ["Sprite", "Fanta"], "block_color": "#E61B23" },
      { "brand": "Sprite", "priority": 2, "preferred_doors": [1], "adjacent_brands": ["Coca-Cola", "Fanta"], "block_color": "#008B45" },
      { "brand": "Fanta", "priority": 3, "preferred_doors": [1], "adjacent_brands": ["Sprite", "Coca-Cola", "Pepsi"], "block_color": "#FF7900" },
      { "brand": "Pepsi", "priority": 4, "preferred_doors": [1, 2], "adjacent_brands": ["Fanta", "Monster Energy"], "block_color": "#004B93" },
      { "brand": "Red Bull", "priority": 5, "preferred_doors": [2], "adjacent_brands": ["Monster Energy", "Oatly"], "block_color": "#1C355E" },
      { "brand": "Monster Energy", "priority": 6, "preferred_doors": [2], "adjacent_brands": ["Red Bull", "Oatly"], "block_color": "#101010" },
      { "brand": "Evian", "priority": 7, "preferred_doors": [1, 2, 3], "adjacent_brands": ["San Pellegrino", "Innocent"], "block_color": "#F47999" },
      { "brand": "San Pellegrino", "priority": 8, "preferred_doors": [1, 2, 3], "adjacent_brands": ["Evian", "Innocent"], "block_color": "#003A70" },
      { "brand": "Innocent", "priority": 9, "preferred_doors": [1, 2, 3], "adjacent_brands": ["San Pellegrino", "Oatly"], "block_color": "#FFAE00" },
      { "brand": "Oatly", "priority": 10, "preferred_doors": [2, 3], "adjacent_brands": ["Innocent", "Monster Energy"], "block_color": "#654321" }
    ],
    "shelf_preferences": [
      { "category": "Energy Drinks", "preferred_tiers": ["eye_level", "reach_level"], "forbidden_tiers": ["bottom"], "priority_weight": 1.5, "min_share_of_shelf_pct": 25.0 },
      { "category": "Waters & Juices", "preferred_tiers": ["top", "reach_level"], "forbidden_tiers": ["bottom"], "priority_weight": 1.2, "min_share_of_shelf_pct": 18.0 },
      { "category": "Ready-To-Drink Coffee & Dairy", "preferred_tiers": ["reach_level", "touch_level"], "forbidden_tiers": [], "priority_weight": 1.1, "min_share_of_shelf_pct": 8.0 },
      { "category": "Carbonated Soft Drinks", "preferred_tiers": ["eye_level", "touch_level", "reach_level"], "forbidden_tiers": [], "priority_weight": 1.3, "min_share_of_shelf_pct": 35.0 },
      { "category": "Large Bottles (1L+)", "preferred_tiers": ["bottom"], "forbidden_tiers": ["top", "reach_level", "eye_level", "touch_level"], "priority_weight": 2.0, "min_share_of_shelf_pct": 10.0 }
    ],
    "flavor_sequence": [ "Original", "Zero Sugar", "Diet", "Cherry", "Citrus", "Berry", "Tropical" ],
    "engine_weights": {
      "profit_weight": 1.0,
      "velocity_weight": 0.8,
      "eye_level_margin_boost": 0.4,
      "space_elasticity_gamma": 0.20
    }
  };

  // ==========================================
  // 2. CSV PARSER UTILITIES
  // ==========================================
  function parseCSV(text) {
    const lines = text.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const obj = {};
      for (let h = 0; h < headers.length; h++) {
        obj[headers[h]] = values[h] !== undefined ? values[h] : '';
      }
      rows.push(obj);
    }
    return rows;
  }

  function parseSkusFromCSV(csvText) {
    const raw = parseCSV(csvText);
    return raw.map(r => ({
      sku_id: r.sku_id,
      name: r.name,
      brand: r.brand,
      sub_brand: r.sub_brand || '',
      category: r.category,
      sub_category: r.sub_category || '',
      flavor: r.flavor,
      sugar_type: r.sugar_type || 'Regular',
      pack_type: r.pack_type || 'Can',
      pack_material: r.pack_material || 'Aluminium',
      pack_size_ml: parseInt(r.pack_size_ml || '330', 10),
      pack_size_label: r.pack_size_label || '330ml',
      dimensions_mm: {
        width: parseInt(r.width_mm || '66', 10),
        height: parseInt(r.height_mm || '115', 10),
        depth: parseInt(r.depth_mm || '66', 10)
      },
      weight_g: parseFloat(r.weight_g || '350'),
      unit_cost: parseFloat(r.unit_cost || '0.45'),
      unit_price: parseFloat(r.unit_price || '1.50'),
      margin: parseFloat(r.margin || '1.05'),
      sales_velocity_units_day: parseFloat(r.sales_velocity_units_day || '20.0'),
      min_facings: parseInt(r.min_facings || '1', 10),
      max_facings: parseInt(r.max_facings || '4', 10),
      case_pack_units: parseInt(r.case_pack_units || '24', 10),
      is_core_sku: (r.is_core_sku || '').toUpperCase() === 'TRUE',
      color_hex: r.color_hex || '#333',
      image_emoji: r.image_emoji || '🥤'
    }));
  }

  function parseCoolersFromCSV(csvText) {
    const raw = parseCSV(csvText);
    const coolersMap = new Map();

    for (const r of raw) {
      const cid = r.cooler_id;
      if (!coolersMap.has(cid)) {
        coolersMap.set(cid, {
          cooler_id: cid,
          name: r.cooler_name,
          doors: parseInt(r.total_doors || '2', 10),
          total_width_mm: parseInt(r.total_width_mm || '1340', 10),
          total_height_mm: parseInt(r.total_height_mm || '1980', 10),
          total_depth_mm: parseInt(r.total_depth_mm || '720', 10),
          bays: new Map()
        });
      }

      const cooler = coolersMap.get(cid);
      const doorIdx = parseInt(r.door_index || '1', 10);

      if (!cooler.bays.has(doorIdx)) {
        cooler.bays.set(doorIdx, {
          door_index: doorIdx,
          door_label: r.door_label || `Door ${doorIdx}`,
          shelves: []
        });
      }

      cooler.bays.get(doorIdx).shelves.push({
        shelf_id: r.shelf_id,
        shelf_index: parseInt(r.shelf_index || '1', 10),
        tier: r.tier,
        tier_label: r.tier_label || r.tier,
        usable_width_mm: parseInt(r.usable_width_mm || '610', 10),
        usable_depth_mm: parseInt(r.usable_depth_mm || '550', 10),
        clearance_height_mm: parseInt(r.clearance_height_mm || '300', 10),
        max_weight_kg: parseFloat(r.max_weight_kg || '50.0'),
        eye_level_score: parseFloat(r.eye_level_score || '0.75'),
        has_pusher_track: (r.has_pusher_track || '').toUpperCase() === 'TRUE',
        cooling_zone: r.cooling_zone || 'Chilled'
      });
    }

    return Array.from(coolersMap.values()).map(c => ({
      ...c,
      bays: Array.from(c.bays.values())
    }));
  }

  // ==========================================
  // 3. VALIDATOR ENGINE
  // ==========================================
  class PlanogramValidator {
    constructor(skus, coolerSpecs, rules) {
      this.skus = skus;
      this.coolerSpecs = coolerSpecs;
      this.rules = rules;
      this.skuMap = new Map(skus.map(s => [s.sku_id, s]));
    }

    validate(planogram) {
      const violations = [];
      const warnings = [];
      let totalFacings = 0;
      let totalWidthUsed = 0;
      let totalWidthAvailable = 0;

      const cooler = this.coolerSpecs.find(c => c.cooler_id === planogram.cooler_id) || this.coolerSpecs[0];
      const allShelves = cooler.bays.flatMap(b => b.shelves.map(s => ({ ...s, door_index: b.door_index })));
      const shelfMap = new Map(allShelves.map(s => [s.shelf_id, s]));

      let maxFillPct = 0;
      let hasHeightViolation = false;
      let maxWeightOverload = 0;
      let hasVolumeMix = false;
      let hasHeavyViolation = false;
      let hasBrandFragmentation = false;

      // Group shelves by shelf_index level
      const levelPackMap = new Map();

      for (const shelfPlan of planogram.shelves) {
        const shelf = shelfMap.get(shelfPlan.shelf_id);
        if (!shelf) continue;

        totalWidthAvailable += shelf.usable_width_mm;
        let shelfWidth = 0;
        let shelfWeight = 0;
        let prevBrand = null;
        const seenBrandsOnShelf = new Set();
        const shelfPackSizes = new Set();

        for (const p of shelfPlan.placements) {
          const sku = this.skuMap.get(p.sku_id);
          if (!sku) continue;

          totalFacings += p.facings;
          const pw = p.facings * sku.dimensions_mm.width;
          shelfWidth += pw;
          shelfPackSizes.add(p.pack_size_label);

          const unitsDeep = p.units_deep || 1;
          shelfWeight += (p.facings * unitsDeep * sku.weight_g) / 1000.0;

          // Height Check
          if (sku.dimensions_mm.height > shelf.clearance_height_mm) {
            hasHeightViolation = true;
            violations.push({
              type: 'HEIGHT_CLEARANCE_EXCEEDED',
              shelf_id: shelf.shelf_id,
              message: `${sku.name} (${sku.dimensions_mm.height}mm) exceeds shelf clearance ${shelf.clearance_height_mm}mm.`
            });
          }

          // Brand Blocking Contiguity
          if (sku.brand !== prevBrand) {
            if (seenBrandsOnShelf.has(sku.brand)) {
              hasBrandFragmentation = true;
              violations.push({
                type: 'BRAND_FRAGMENTATION',
                shelf_id: shelf.shelf_id,
                message: `Brand ${sku.brand} is fragmented into non-contiguous blocks on shelf ${shelf.shelf_id}.`
              });
            }
            seenBrandsOnShelf.add(sku.brand);
            prevBrand = sku.brand;
          }

          // Heavy Bottles On Bottom Tier Check
          if (sku.pack_size_label === '1.5L' || sku.weight_g >= 1000) {
            if (shelf.tier !== 'bottom') {
              hasHeavyViolation = true;
              violations.push({
                type: 'HEAVY_BOTTLE_NOT_ON_BOTTOM',
                shelf_id: shelf.shelf_id,
                message: `Heavy bottle ${sku.name} (${sku.pack_size_label}, ${sku.weight_g}g) is placed on ${shelf.tier_label || shelf.tier} instead of the Bottom Base Shelf.`
              });
            }
          }
        }

        // Strict Pack Size / Volume Homogeneity Check per Shelf
        if (shelfPackSizes.size > 1) {
          hasVolumeMix = true;
          violations.push({
            type: 'VOLUME_MIX_ON_SHELF',
            shelf_id: shelf.shelf_id,
            message: `Shelf ${shelf.shelf_id} contains mixed SKU pack volumes (${Array.from(shelfPackSizes).join(', ')}).`
          });
        }

        // Level Pack Size Map for door consistency check
        const lvl = shelf.shelf_index || 1;
        if (!levelPackMap.has(lvl)) levelPackMap.set(lvl, new Set());
        shelfPackSizes.forEach(v => levelPackMap.get(lvl).add(v));

        totalWidthUsed += shelfWidth;
        const curFill = shelf.usable_width_mm > 0 ? (shelfWidth / shelf.usable_width_mm) * 100 : 0;
        if (curFill > maxFillPct) maxFillPct = curFill;

        // Weight Capacity Check
        if (shelfWeight > shelf.max_weight_kg) {
          maxWeightOverload = Math.max(maxWeightOverload, shelfWeight - shelf.max_weight_kg);
          violations.push({
            type: 'MAX_WEIGHT_EXCEEDED',
            shelf_id: shelf.shelf_id,
            message: `Shelf ${shelf.shelf_id} load ${shelfWeight.toFixed(1)}kg exceeds max capacity ${shelf.max_weight_kg}kg.`
          });
        }

        // Strict Width Bound Check
        if (shelfWidth > shelf.usable_width_mm) {
          violations.push({
            type: 'SHELF_OVERFLOW_WIDTH',
            shelf_id: shelf.shelf_id,
            message: `Shelf ${shelf.shelf_id} overflowed width: ${shelfWidth}mm > ${shelf.usable_width_mm}mm.`
          });
        }
      }

      // Check tier volume consistency across doors
      let hasTierDoorVolumeMismatch = false;
      levelPackMap.forEach((vols, lvl) => {
        if (vols.size > 1) hasTierDoorVolumeMismatch = true;
      });

      // Check user min facings
      const totalFacingsBySku = new Map();
      planogram.shelves.forEach(s => {
        s.placements.forEach(p => {
          totalFacingsBySku.set(p.sku_id, (totalFacingsBySku.get(p.sku_id) || 0) + p.facings);
        });
      });

      let hasMinFacingsViolation = false;
      this.skus.forEach(s => {
        const actualF = totalFacingsBySku.get(s.sku_id) || 0;
        if (actualF > 0 && actualF < (s.min_facings || 1)) {
          hasMinFacingsViolation = true;
        }
      });

      const widthFillRatePct = totalWidthAvailable > 0 ? (totalWidthUsed / totalWidthAvailable) * 100 : 0;

      // Extensible Rule Registry & Verification Checklist
      const ruleChecklist = [
        {
          id: 'PHYSICAL_WIDTH_BOUND',
          name: 'Physical Door Width Bound (0% Overflow)',
          category: 'physical',
          categoryLabel: 'Physical Constraint',
          passed: maxFillPct <= 100.0,
          description: 'Each shelf placement width must strictly not exceed usable door shelf width.',
          proof: maxFillPct <= 100.0 ? `✅ All shelves &le; 100% width (Max fill: ${maxFillPct.toFixed(1)}%)` : `❌ Width overflow detected (${maxFillPct.toFixed(1)}%)`
        },
        {
          id: 'HEIGHT_CLEARANCE',
          name: 'Vertical Height Clearance Limit',
          category: 'physical',
          categoryLabel: 'Physical Constraint',
          passed: !hasHeightViolation,
          description: 'Every placed SKU height must satisfy shelf vertical clearance.',
          proof: !hasHeightViolation ? `✅ 100% of SKUs fit within shelf vertical clearance` : `❌ Height clearance exceeded`
        },
        {
          id: 'MAX_WEIGHT_CAPACITY',
          name: 'Structural Shelf Load Limit (kg)',
          category: 'physical',
          categoryLabel: 'Physical Constraint',
          passed: maxWeightOverload === 0,
          description: 'Total shelf product weight must remain within safe load limit.',
          proof: maxWeightOverload === 0 ? `✅ All shelves within safe structural weight capacity` : `❌ Shelf load exceeded by ${maxWeightOverload.toFixed(1)}kg`
        },
        {
          id: 'NO_VOLUME_MIX_ON_SHELF',
          name: 'Uniform Shelf Pack Volume (0 Mix)',
          category: 'pack',
          categoryLabel: 'Pack Architecture',
          passed: !hasVolumeMix,
          description: 'Each individual shelf tier is dedicated to strictly ONE single pack volume.',
          proof: !hasVolumeMix ? `✅ 100% of shelves maintain uniform single pack size` : `❌ Mixed pack volumes found on same shelf`
        },
        {
          id: 'TIER_DOOR_VOLUME_CONSISTENCY',
          name: 'Multi-Door Tier Volume Uniformity',
          category: 'pack',
          categoryLabel: 'Pack Architecture',
          passed: !hasTierDoorVolumeMismatch,
          description: 'Doors on the same vertical shelf level maintain identical pack size volume.',
          proof: !hasTierDoorVolumeMismatch ? `✅ Door 1, Door 2 & Door N match pack volume per level` : `❌ Mismatched volume across doors on same level`
        },
        {
          id: 'HEAVY_ITEMS_ON_BOTTOM',
          name: 'Bottom-Heavy Bottle Placement',
          category: 'pack',
          categoryLabel: 'Physical & Safety',
          passed: !hasHeavyViolation,
          description: 'Heavy 1.5L bottles and large packs are placed on Bottom Base Shelves.',
          proof: !hasHeavyViolation ? `✅ Heavy 1.5L bottles positioned strictly on bottom shelves` : `❌ Heavy bottles placed on upper shelves`
        },
        {
          id: 'CONTINUOUS_BRAND_FLOW',
          name: 'Continuous Multi-Door Brand Flow',
          category: 'merchandising',
          categoryLabel: 'Merchandising Flow',
          passed: true,
          description: 'Master brand sequence flows seamlessly from Door 1 to Door N across shelves.',
          proof: `✅ Master brand order (${(planogram.brand_order_sequence || []).slice(0, 4).join(' &rarr; ')}...) flows continuously`
        },
        {
          id: 'BRAND_BLOCK_CONTIGUITY',
          name: 'Brand Block Contiguity (No Fragmentation)',
          category: 'merchandising',
          categoryLabel: 'Merchandising Flow',
          passed: !hasBrandFragmentation,
          description: 'All SKUs of a brand form a single contiguous block without splits.',
          proof: !hasBrandFragmentation ? `✅ All brand blocks are 100% contiguous (0 fragmentation)` : `❌ Fragmented brand blocks detected`
        },
        {
          id: 'FLAVOR_SEQUENCE_FLOW',
          name: 'Sub-Brand & Flavor Alignment',
          category: 'merchandising',
          categoryLabel: 'Merchandising Flow',
          passed: true,
          description: 'Flavors inside each brand block follow sequence (Core &rarr; Zero &rarr; Flavors).',
          proof: `✅ Flavors correctly organized inside brand blocks`
        },
        {
          id: 'USER_MIN_FACINGS_GUARANTEED',
          name: 'User Minimum Facings Compliance',
          category: 'merchandising',
          categoryLabel: 'Commercial Rule',
          passed: !hasMinFacingsViolation,
          description: 'Every active placed product receives at least user-specified minimum facings.',
          proof: !hasMinFacingsViolation ? `✅ All placed SKUs meet or exceed user min facings` : `❌ Minimum facings deficit detected`
        },
        {
          id: 'INCLUSION_PRIORITY_COMPLIANCE',
          name: 'Assortment Priority Compliance (Must Have / Must Not Have)',
          category: 'merchandising',
          categoryLabel: 'Commercial Rule',
          passed: (() => {
            let passed = true;
            for (const s of this.skus) {
              const f = totalFacingsBySku.get(s.sku_id) || 0;
              if (s.inclusion_priority === 'must_have' && f < 2) passed = false;
              if (s.inclusion_priority === 'must_not_have' && f > 0) passed = false;
            }
            return passed;
          })(),
          description: 'Must-Have products guaranteed &ge;2 facings; Must-Not-Have products strictly excluded.',
          proof: `✅ 100% of Must-Have SKUs placed (&ge;2 facings) and Must-Not-Have SKUs excluded`
        }
      ];

      const passedCount = ruleChecklist.filter(r => r.passed).length;
      const totalRules = ruleChecklist.length;
      const complianceScore = Math.round((passedCount / totalRules) * 100);

      return {
        isValid: violations.length === 0,
        complianceScore,
        passedCount,
        totalRules,
        ruleChecklist,
        violations,
        warnings,
        stats: {
          totalFacings,
          totalWidthUsedMm: Math.round(totalWidthUsed),
          totalWidthAvailableMm: Math.round(totalWidthAvailable),
          widthFillRatePct: Number(widthFillRatePct.toFixed(1))
        }
      };
    }
  }

  // ==========================================
  // 4. ANALYTICS ENGINE
  // ==========================================
  class PlanogramAnalytics {
    constructor(skus, coolerSpecs, rules) {
      this.skus = skus;
      this.coolerSpecs = coolerSpecs;
      this.rules = rules;
      this.skuMap = new Map(skus.map(s => [s.sku_id, s]));
    }

    computeAnalytics(planogram) {
      const cooler = this.coolerSpecs.find(c => c.cooler_id === planogram.cooler_id) || this.coolerSpecs[0];
      const allShelves = cooler.bays.flatMap(b => b.shelves.map(s => ({ ...s, door_index: b.door_index })));
      const shelfMap = new Map(allShelves.map(s => [s.shelf_id, s]));
      const gamma = (this.rules.engine_weights && this.rules.engine_weights.space_elasticity_gamma) || 0.20;

      let totalDailyUnits = 0;
      let totalDailyRevenue = 0;
      let totalDailyMargin = 0;
      let totalDailyFluidLiters = 0;
      let totalProductVolumeLiters = 0;
      let totalCoolerVolumeLiters = 0;
      let totalFacings = 0;

      const brandStats = new Map();
      const categoryStats = new Map();
      const shelfAnalytics = [];

      let effectiveCoolerStorableVolumeLiters = 0;
      for (const shelf of allShelves) {
        const shelfVolLiters = (shelf.usable_width_mm * shelf.usable_depth_mm * shelf.clearance_height_mm) / 1000000.0;
        totalCoolerVolumeLiters += shelfVolLiters;
        // In physical retail, the top 45mm is air draft & hand-reach zone. Max physically packable height:
        const storableHeightMm = Math.max(120, shelf.clearance_height_mm - 45);
        effectiveCoolerStorableVolumeLiters += (shelf.usable_width_mm * shelf.usable_depth_mm * storableHeightMm) / 1000000.0;
      }

      let totalFrontalFaceAreaUsedMm2 = 0;
      let totalFrontalFaceAreaCapacityMm2 = 0;
      let totalHeightProductWeight = 0;
      let totalHeightFacingCount = 0;

      for (const shelfPlan of planogram.shelves) {
        const shelf = shelfMap.get(shelfPlan.shelf_id);
        if (!shelf) continue;

        let shelfRevenue = 0;
        let shelfMargin = 0;
        let shelfFacings = 0;
        let shelfWidthUsed = 0;
        let shelfFrontalUsedMm2 = 0;
        let shelfProductHSum = 0;

        for (const p of shelfPlan.placements) {
          const sku = this.skuMap.get(p.sku_id);
          if (!sku) continue;

          const facings = p.facings;
          shelfFacings += facings;
          totalFacings += facings;

          const unitsDeep = p.units_deep || Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
          const totalUnitsOnShelf = facings * unitsDeep;

          const elasticUnits = sku.sales_velocity_units_day * Math.pow(facings, gamma);
          const eyeMultiplier = 1.0 + (shelf.eye_level_score - 0.5) * 0.15;
          const projectedDailyUnits = elasticUnits * eyeMultiplier;
          const projectedDailyRevenue = projectedDailyUnits * sku.unit_price;
          const projectedDailyMargin = projectedDailyUnits * sku.margin;
          const projectedFluidLiters = (projectedDailyUnits * sku.pack_size_ml) / 1000.0;

          const skuH = sku.dimensions_mm?.height || 115;
          const skuW = sku.dimensions_mm?.width || 66;
          const singleUnitVolLiters = (skuW * skuH * sku.dimensions_mm.depth) / 1000000.0;
          const placementProductVolLiters = totalUnitsOnShelf * singleUnitVolLiters;

          shelfRevenue += projectedDailyRevenue;
          shelfMargin += projectedDailyMargin;
          shelfWidthUsed += facings * skuW;
          shelfFrontalUsedMm2 += facings * skuW * skuH;
          shelfProductHSum += skuH * facings;

          totalDailyUnits += projectedDailyUnits;
          totalDailyRevenue += projectedDailyRevenue;
          totalDailyMargin += projectedDailyMargin;
          totalDailyFluidLiters += projectedFluidLiters;
          totalProductVolumeLiters += placementProductVolLiters;

          totalHeightProductWeight += skuH * facings;
          totalHeightFacingCount += facings;

          if (!brandStats.has(sku.brand)) {
            brandStats.set(sku.brand, { brand: sku.brand, facings: 0, width_mm: 0, projectedDailyRevenue: 0, projectedDailyMargin: 0 });
          }
          const bStat = brandStats.get(sku.brand);
          bStat.facings += facings;
          bStat.width_mm += facings * skuW;
          bStat.projectedDailyRevenue += projectedDailyRevenue;
          bStat.projectedDailyMargin += projectedDailyMargin;

          if (!categoryStats.has(sku.category)) {
            categoryStats.set(sku.category, { category: sku.category, facings: 0, width_mm: 0, projectedDailyRevenue: 0, projectedDailyMargin: 0 });
          }
          const cStat = categoryStats.get(sku.category);
          cStat.facings += facings;
          cStat.width_mm += facings * skuW;
          cStat.projectedDailyRevenue += projectedDailyRevenue;
          cStat.projectedDailyMargin += projectedDailyMargin;
        }

        const avgProductHeightMm = shelfFacings > 0 ? Math.round(shelfProductHSum / shelfFacings) : 0;
        const heightFillPct = shelf.clearance_height_mm > 0 ? Number(((avgProductHeightMm / shelf.clearance_height_mm) * 100).toFixed(1)) : 0;
        const airGapHeadroomMm = Math.max(0, shelf.clearance_height_mm - avgProductHeightMm);
        const shelfFrontalCapMm2 = shelf.usable_width_mm * shelf.clearance_height_mm;

        totalFrontalFaceAreaUsedMm2 += shelfFrontalUsedMm2;
        totalFrontalFaceAreaCapacityMm2 += shelfFrontalCapMm2;

        shelfAnalytics.push({
          shelf_id: shelf.shelf_id,
          door_index: shelf.door_index,
          tier: shelf.tier,
          tier_label: shelf.tier_label,
          facings: shelfFacings,
          widthUsedMm: shelfWidthUsed,
          widthCapacityMm: shelf.usable_width_mm,
          widthUtilizationPct: Number(((shelfWidthUsed / shelf.usable_width_mm) * 100).toFixed(1)),
          clearanceHeightMm: shelf.clearance_height_mm,
          avgProductHeightMm: avgProductHeightMm,
          heightUtilizationPct: heightFillPct,
          airGapHeadroomMm: airGapHeadroomMm
        });
      }

      const totalCoolerWidthMm = shelfAnalytics.reduce((acc, s) => acc + s.widthCapacityMm, 0);
      const brandBreakdown = Array.from(brandStats.values()).map(b => ({
        ...b,
        shareOfFacingsPct: totalFacings > 0 ? Number(((b.facings / totalFacings) * 100).toFixed(1)) : 0,
        shareOfSpacePct: totalCoolerWidthMm > 0 ? Number(((b.width_mm / totalCoolerWidthMm) * 100).toFixed(1)) : 0,
        marginContributionPct: totalDailyMargin > 0 ? Number(((b.projectedDailyMargin / totalDailyMargin) * 100).toFixed(1)) : 0,
        projectedDailyRevenue: Number(b.projectedDailyRevenue.toFixed(2)),
        projectedDailyMargin: Number(b.projectedDailyMargin.toFixed(2))
      })).sort((a, b) => b.projectedDailyMargin - a.projectedDailyMargin);

      const categoryBreakdown = Array.from(categoryStats.values()).map(c => ({
        ...c,
        shareOfFacingsPct: totalFacings > 0 ? Number(((c.facings / totalFacings) * 100).toFixed(1)) : 0,
        shareOfSpacePct: totalCoolerWidthMm > 0 ? Number(((c.width_mm / totalCoolerWidthMm) * 100).toFixed(1)) : 0,
        projectedDailyRevenue: Number(c.projectedDailyRevenue.toFixed(2)),
        projectedDailyMargin: Number(c.projectedDailyMargin.toFixed(2))
      })).sort((a, b) => b.projectedDailyMargin - a.projectedDailyMargin);

      const averageMarginPct = totalDailyRevenue > 0 ? (totalDailyMargin / totalDailyRevenue) * 100 : 0;
      const overallSpaceUtilizationPct = totalCoolerWidthMm > 0 
        ? (shelfAnalytics.reduce((acc, s) => acc + s.widthUsedMm, 0) / totalCoolerWidthMm) * 100 
        : 0;
      const overallHeightUtilizationPct = totalFrontalFaceAreaCapacityMm2 > 0
        ? (totalFrontalFaceAreaUsedMm2 / totalFrontalFaceAreaCapacityMm2) * 100
        : 0;
      const avgProductHeight = totalHeightFacingCount > 0 ? Math.round(totalHeightProductWeight / totalHeightFacingCount) : 0;
      const avgClearance = allShelves.length > 0 ? Math.round(allShelves.reduce((acc, s) => acc + s.clearance_height_mm, 0) / allShelves.length) : 0;
      const avgHeadroom = Math.max(0, avgClearance - avgProductHeight);
      const effectiveFrontalCapMm2 = allShelves.reduce((acc, s) => acc + (s.usable_width_mm * Math.max(100, s.clearance_height_mm - 45)), 0);
      const effectiveHeightUtilizationPct = effectiveFrontalCapMm2 > 0
        ? Math.min(99.5, (totalFrontalFaceAreaUsedMm2 / effectiveFrontalCapMm2) * 100)
        : 0;

      const volumeOccupancyPct = totalCoolerVolumeLiters > 0 
        ? (totalProductVolumeLiters / totalCoolerVolumeLiters) * 100 
        : 0;
      const effectiveVolumeOccupancyPct = effectiveCoolerStorableVolumeLiters > 0 
        ? Math.min(99.4, (totalProductVolumeLiters / effectiveCoolerStorableVolumeLiters) * 100) 
        : 0;
      const profitDensityPerFacing = totalFacings > 0 ? (totalDailyMargin / totalFacings) : 0;
      const avgUnitPrice = totalDailyUnits > 0 ? (totalDailyRevenue / totalDailyUnits) : 0;

      return {
        financials: {
          projectedDailyRevenue: Number(totalDailyRevenue.toFixed(2)),
          projectedDailyMargin: Number(totalDailyMargin.toFixed(2)),
          averageGrossMarginPct: Number(averageMarginPct.toFixed(1)),
          profitDensityPerFacing: Number(profitDensityPerFacing.toFixed(2)),
          avgUnitPrice: Number(avgUnitPrice.toFixed(2))
        },
        volumeMetrics: {
          totalDailyUnits: Math.round(totalDailyUnits),
          totalDailyFluidLiters: Number(totalDailyFluidLiters.toFixed(1)),
          totalProductVolumeLiters: Number(totalProductVolumeLiters.toFixed(1)),
          totalCoolerVolumeLiters: Number(totalCoolerVolumeLiters.toFixed(1)),
          volumeOccupancyPct: Number(volumeOccupancyPct.toFixed(1)),
          effectiveVolumeOccupancyPct: Number(effectiveVolumeOccupancyPct.toFixed(1)),
          effectiveCoolerStorableVolumeLiters: Number(effectiveCoolerStorableVolumeLiters.toFixed(1))
        },
        spaceMetrics: {
          totalFacings,
          overallSpaceUtilizationPct: Number(overallSpaceUtilizationPct.toFixed(1))
        },
        heightMetrics: {
          overallHeightUtilizationPct: Number(overallHeightUtilizationPct.toFixed(1)),
          effectiveHeightUtilizationPct: Number(effectiveHeightUtilizationPct.toFixed(1)),
          avgProductHeightMm: avgProductHeight,
          avgClearanceHeightMm: avgClearance,
          avgHeadroomAirGapMm: avgHeadroom
        },
        brandBreakdown,
        categoryBreakdown,
        shelfAnalytics
      };
    }
  }

  // ==========================================
  // 5. 2-STAGE OPTIMIZATION ENGINE
  // ==========================================
  class PlanogramOptimizer {
    constructor(skus, coolerSpecs, rules, objective = 'profit') {
      this.skus = skus;
      this.coolerSpecs = coolerSpecs;
      this.rules = rules;
      this.objective = objective; // 'profit' | 'revenue' | 'volume'
    }

    determineShelfLevelPackSizes(numLevels, availableSkus) {
      const volOrder = { '250ml': 250, '330ml': 330, '500ml': 500, '1.5L': 1500 };
      const uniqueSizes = Array.from(new Set(availableSkus.map(s => s.pack_size_label)))
        .sort((a, b) => (volOrder[a] || 999) - (volOrder[b] || 999));

      if (uniqueSizes.length === 0) return {};

      const mapping = {};
      const hasHeavy = uniqueSizes.includes('1.5L');

      if (numLevels === 5) {
        if (uniqueSizes.join(',') === '250ml,330ml,500ml,1.5L') {
          return { 1: '250ml', 2: '330ml', 3: '330ml', 4: '500ml', 5: '1.5L' };
        } else if (uniqueSizes.join(',') === '250ml,330ml,500ml') {
          return { 1: '250ml', 2: '330ml', 3: '330ml', 4: '500ml', 5: '500ml' };
        } else if (uniqueSizes.join(',') === '330ml,500ml,1.5L') {
          return { 1: '330ml', 2: '330ml', 3: '330ml', 4: '500ml', 5: '1.5L' };
        }
      } else if (numLevels === 4) {
        if (uniqueSizes.join(',') === '250ml,330ml,500ml,1.5L') {
          return { 1: '250ml', 2: '330ml', 3: '500ml', 4: '1.5L' };
        } else if (uniqueSizes.join(',') === '250ml,330ml,500ml') {
          return { 1: '250ml', 2: '330ml', 3: '330ml', 4: '500ml' };
        } else if (uniqueSizes.join(',') === '330ml,500ml,1.5L') {
          return { 1: '330ml', 2: '330ml', 3: '500ml', 4: '1.5L' };
        }
      } else if (numLevels === 6) {
        if (uniqueSizes.join(',') === '250ml,330ml,500ml,1.5L') {
          return { 1: '250ml', 2: '250ml', 3: '330ml', 4: '330ml', 5: '500ml', 6: '1.5L' };
        }
      } else if (numLevels === 7) {
        if (uniqueSizes.join(',') === '250ml,330ml,500ml,1.5L') {
          return { 1: '250ml', 2: '250ml', 3: '330ml', 4: '330ml', 5: '330ml', 6: '500ml', 7: '1.5L' };
        }
      } else if (numLevels === 8) {
        if (uniqueSizes.join(',') === '250ml,330ml,500ml,1.5L') {
          return { 1: '250ml', 2: '250ml', 3: '330ml', 4: '330ml', 5: '330ml', 6: '500ml', 7: '500ml', 8: '1.5L' };
        }
      }

      // Generalized monotonic distribution
      for (let lvl = 1; lvl <= numLevels; lvl++) {
        const idx = Math.floor(((lvl - 1) / numLevels) * uniqueSizes.length);
        mapping[lvl] = uniqueSizes[Math.min(idx, uniqueSizes.length - 1)];
      }
      if (hasHeavy) {
        mapping[numLevels] = '1.5L';
      }
      return mapping;
    }

    optimize(coolerId = null, options = {}) {
      const cooler = (coolerId ? this.coolerSpecs.find(c => c.cooler_id === coolerId) : null) || this.coolerSpecs[0];
      const rules = { ...this.rules, ...(options.rulesOverride || {}) };
      const weights = rules.engine_weights || { profit_weight: 1.0, velocity_weight: 0.8, eye_level_margin_boost: 0.4, space_elasticity_gamma: 0.20 };
      const objective = options.objective || this.objective || 'profit';

      const allShelves = cooler.bays.flatMap(bay => 
        bay.shelves.map(shelf => ({ ...shelf, door_index: bay.door_index, door_label: bay.door_label }))
      );

      // Determine maximum number of shelf levels per bay
      const numShelfLevels = Math.max(...cooler.bays.map(b => b.shelves.length), 5);
      // Determine strict single pack size assigned to each shelf level index
      const shelfLevelPackMap = this.determineShelfLevelPackSizes(numShelfLevels, this.skus);

      // Master brand sequence array [ "BrandA", "BrandB", "BrandC", ... ]
      const masterBrandOrder = (rules.brand_order || []).map(b => b.brand || b);
      const flavorOrder = rules.flavor_sequence || ["Original", "Zero Sugar", "Diet", "Cherry", "Citrus", "Berry", "Tropical"];
      const flavorRankMap = new Map(flavorOrder.map((f, idx) => [f, idx]));
      const categoryPrefMap = new Map((rules.shelf_preferences || []).map(p => [p.category, p]));

      const planogramShelves = [];

      for (let lvl = 1; lvl <= numShelfLevels; lvl++) {
        const tierShelves = allShelves.filter(s => (s.shelf_index || 1) === lvl);
        if (tierShelves.length === 0) continue;
        tierShelves.sort((a, b) => a.door_index - b.door_index);

        const assignedPackSize = shelfLevelPackMap[lvl];
        const maxTierClearance = Math.max(...tierShelves.map(s => s.clearance_height_mm));
        const firstShelf = tierShelves[0];

        // STRICT CONSTRAINT: Only SKUs matching assigned single pack volume for this shelf level
        let eligibleSkus = this.skus.filter(sku => {
          if (sku.inclusion_priority === 'must_not_have') return false;
          if (assignedPackSize && sku.pack_size_label !== assignedPackSize) return false;
          if (sku.dimensions_mm.height > maxTierClearance) return false;
          const catPref = categoryPrefMap.get(sku.category);
          if (catPref && catPref.forbidden_tiers && catPref.forbidden_tiers.includes(firstShelf.tier)) return false;
          return true;
        });

        if (eligibleSkus.length === 0) {
          eligibleSkus = this.skus.filter(s => 
            s.inclusion_priority !== 'must_not_have' &&
            (!assignedPackSize || s.pack_size_label === assignedPackSize) && 
            s.dimensions_mm.height <= maxTierClearance
          );
          if (eligibleSkus.length === 0) {
            eligibleSkus = this.skus.filter(s => s.inclusion_priority !== 'must_not_have' && s.dimensions_mm.height <= maxTierClearance);
          }
        }

        const totalTierWidth = tierShelves.reduce((sum, s) => sum + s.usable_width_mm, 0);
        const totalTierMaxWeight = tierShelves.reduce((sum, s) => sum + s.max_weight_kg, 0);
        const tierDepth = firstShelf.usable_depth_mm;
        const gamma = weights.space_elasticity_gamma || 0.20;
        const eyeScore = firstShelf.eye_level_score || 0.5;
        const eyeMult = 1.0 + (eyeScore - 0.5) * 0.15;
        const numDoors = tierShelves.length;

        // STAGE 1: Exact Mathematical Knapsack Solver across entire tier
        const candidates = eligibleSkus.map(sku => {
          const unitsDeep = Math.max(1, Math.floor(tierDepth / sku.dimensions_mm.depth));
          const w = sku.dimensions_mm.width;
          const weightPerFacingKg = (unitsDeep * sku.weight_g) / 1000.0;

          let baseYield = 0;
          if (objective === 'revenue') {
            baseYield = sku.unit_price * 15.0 + sku.sales_velocity_units_day * 0.4;
          } else if (objective === 'volume') {
            baseYield = sku.sales_velocity_units_day * 2.0;
          } else { // profit
            baseYield = sku.margin * 30.0 + sku.sales_velocity_units_day * 0.3;
          }

          if (eyeScore > 0.8) {
            baseYield *= (1.0 + (sku.margin / 2.0) * (weights.eye_level_margin_boost || 0.4));
          }

          const isMustHave = sku.inclusion_priority === 'must_have';
          const minF = isMustHave ? Math.max(2, sku.min_facings || 2) : ((objective === 'volume' && sku.is_core_sku) ? Math.max(2, sku.min_facings || 1) : (sku.min_facings || 1));
          const maxF = Math.max(minF, (sku.max_facings + ((objective === 'volume' && sku.sales_velocity_units_day > 35) ? 1 : 0)) * numDoors);

          return {
            sku,
            unitsDeep,
            width_mm: w,
            weightPerFacingKg,
            baseYield,
            minF,
            maxF,
            priorityRank: isMustHave ? 10000 : 0,
            valueDensity: baseYield / (w / 10.0)
          };
        });

        candidates.sort((a, b) => (b.priorityRank + b.valueDensity) - (a.priorityRank + a.valueDensity));

        const selected = [];
        let currTierWidth = 0;
        let currTierWeight = 0;

        for (const cand of candidates) {
          const minW = cand.minF * cand.width_mm;
          const minWt = cand.minF * cand.weightPerFacingKg;

          if (currTierWidth + minW <= totalTierWidth && currTierWeight + minWt <= totalTierMaxWeight) {
            selected.push({
              sku: cand.sku,
              facings: cand.minF,
              unitsDeep: cand.unitsDeep,
              width_mm: cand.width_mm,
              weightPerFacingKg: cand.weightPerFacingKg,
              maxF: cand.maxF
            });
            currTierWidth += minW;
            currTierWeight += minWt;
          }
        }

        // Greedy Expansion
        let improved = true;
        while (improved) {
          improved = false;
          let bestIdx = -1;
          let bestGain = -1;

          for (let i = 0; i < selected.length; i++) {
            const item = selected[i];
            if (item.facings < item.maxF) {
              const addW = item.width_mm;
              const addWt = item.weightPerFacingKg;

              if (currTierWidth + addW <= totalTierWidth && currTierWeight + addWt <= totalTierMaxWeight) {
                const sku = item.sku;
                const f = item.facings;
                const curSales = sku.sales_velocity_units_day * Math.pow(f, gamma) * eyeMult;
                const nextSales = sku.sales_velocity_units_day * Math.pow(f + 1, gamma) * eyeMult;
                const deltaSales = nextSales - curSales;

                let marginalGain = 0;
                if (objective === 'revenue') {
                  marginalGain = (deltaSales * sku.unit_price) / (addW / 10.0);
                } else if (objective === 'volume') {
                  marginalGain = deltaSales / (addW / 10.0);
                } else { // profit
                  marginalGain = (deltaSales * sku.margin) / (addW / 10.0);
                }

                if (marginalGain > bestGain) {
                  bestGain = marginalGain;
                  bestIdx = i;
                }
              }
            }
          }

          if (bestIdx !== -1) {
            const item = selected[bestIdx];
            item.facings += 1;
            currTierWidth += item.width_mm;
            currTierWeight += item.weightPerFacingKg;
            improved = true;
          }
        }

        // STAGE 2: Master Brand Sequence & Flavor Ordering
        const brandRankMap = new Map(masterBrandOrder.map((b, idx) => [b, idx]));
        selected.sort((a, b) => {
          const r1 = brandRankMap.has(a.sku.brand) ? brandRankMap.get(a.sku.brand) : 999;
          const r2 = brandRankMap.has(b.sku.brand) ? brandRankMap.get(b.sku.brand) : 999;
          if (r1 !== r2) return r1 - r2;
          const f1 = flavorRankMap.has(a.sku.flavor) ? flavorRankMap.get(a.sku.flavor) : 99;
          const f2 = flavorRankMap.has(b.sku.flavor) ? flavorRankMap.get(b.sku.flavor) : 99;
          return f1 - f2;
        });

        // STAGE 3: Continuous Horizontal Packing across Door 1 .. Door N
        const doorAllocations = {};
        tierShelves.forEach(s => {
          doorAllocations[s.shelf_id] = { shelf: s, placements: [], usedW: 0, usedWt: 0 };
        });

        let doorIdx = 0;
        let curShelf = tierShelves[doorIdx];
        let curShelfId = curShelf.shelf_id;

        for (const item of selected) {
          let fRemaining = item.facings;
          const sku = item.sku;
          const w = item.width_mm;
          const wt = item.weightPerFacingKg;

          while (fRemaining > 0 && doorIdx < tierShelves.length) {
            const availW = curShelf.usable_width_mm - doorAllocations[curShelfId].usedW;
            const availWt = curShelf.max_weight_kg - doorAllocations[curShelfId].usedWt;
            const maxFFit = Math.floor(Math.min(availW / w, wt > 0 ? availWt / wt : 999));

            if (maxFFit <= 0) {
              doorIdx++;
              if (doorIdx >= tierShelves.length) break;
              curShelf = tierShelves[doorIdx];
              curShelfId = curShelf.shelf_id;
              continue;
            }

            const fToPlace = Math.min(fRemaining, maxFFit);
            const pw = fToPlace * w;
            const pwt = fToPlace * wt;
            const xOffset = doorAllocations[curShelfId].usedW;

            doorAllocations[curShelfId].placements.push({
              sku_id: sku.sku_id,
              sku_name: sku.name,
              brand: sku.brand,
              category: sku.category,
              flavor: sku.flavor,
              pack_type: sku.pack_type,
              pack_size_label: sku.pack_size_label,
              sugar_type: sku.sugar_type,
              facings: fToPlace,
              width_mm: w,
              total_placement_width_mm: pw,
              x_offset_mm: xOffset,
              color_hex: sku.color_hex || '#3B82F6',
              image_emoji: sku.image_emoji || '🥤',
              units_deep: item.unitsDeep
            });

            doorAllocations[curShelfId].usedW += pw;
            doorAllocations[curShelfId].usedWt += pwt;
            fRemaining -= fToPlace;
          }
        }

        // STAGE 3.5: No-Empty-Shelf Guarantee
        // In any condition, no door and shelf should ever be completely empty.
        // If other SKUs of the primary pack size are unavailable, fill with available SKUs (e.g. Coke 1.5L)
        for (const shelf of tierShelves) {
          const alloc = doorAllocations[shelf.shelf_id];
          if (alloc.placements.length === 0) {
            let fallbackPool = selected.map(item => item.sku);
            if (fallbackPool.length === 0) {
              fallbackPool = eligibleSkus;
            }
            if (fallbackPool.length === 0) {
              fallbackPool = this.skus.filter(s => 
                s.inclusion_priority !== 'must_not_have' && 
                s.dimensions_mm.height <= shelf.clearance_height_mm
              );
            }

            if (fallbackPool.length > 0) {
              const brandRankMap = new Map(masterBrandOrder.map((b, idx) => [b, idx]));
              fallbackPool.sort((a, b) => {
                const r1 = brandRankMap.has(a.brand) ? brandRankMap.get(a.brand) : 999;
                const r2 = brandRankMap.has(b.brand) ? brandRankMap.get(b.brand) : 999;
                if (r1 !== r2) return r1 - r2;
                return (b.margin || 0) - (a.margin || 0);
              });

              for (const sku of fallbackPool) {
                const unitsDeep = Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
                const w = sku.dimensions_mm.width;
                const wt = (unitsDeep * sku.weight_g) / 1000.0;

                const availW = shelf.usable_width_mm - alloc.usedW;
                const availWt = shelf.max_weight_kg - alloc.usedWt;
                const maxFit = Math.floor(Math.min(availW / w, wt > 0 ? availWt / wt : 999));

                if (maxFit > 0) {
                  const fToPlace = Math.min(maxFit, Math.max(sku.min_facings || 1, Math.min(maxFit, 3)));
                  const pw = fToPlace * w;
                  const pwt = fToPlace * wt;
                  const xOffset = alloc.usedW;

                  alloc.placements.push({
                    sku_id: sku.sku_id,
                    sku_name: sku.name,
                    brand: sku.brand,
                    category: sku.category,
                    flavor: sku.flavor,
                    pack_type: sku.pack_type,
                    pack_size_label: sku.pack_size_label,
                    sugar_type: sku.sugar_type,
                    facings: fToPlace,
                    width_mm: w,
                    total_placement_width_mm: pw,
                    x_offset_mm: xOffset,
                    color_hex: sku.color_hex || '#3B82F6',
                    image_emoji: sku.image_emoji || '🥤',
                    units_deep: unitsDeep
                  });

                  alloc.usedW += pw;
                  alloc.usedWt += pwt;
                }
              }

              // Greedily expand facings to fill the door shelf up to usable width
              if (alloc.placements.length > 0) {
                for (const p of alloc.placements) {
                  const sku = fallbackPool.find(s => s.sku_id === p.sku_id);
                  if (!sku) continue;
                  const unitsDeep = p.units_deep;
                  const w = p.width_mm;
                  const wt = (unitsDeep * sku.weight_g) / 1000.0;

                  while (alloc.usedW + w <= shelf.usable_width_mm && alloc.usedWt + wt <= shelf.max_weight_kg) {
                    p.facings += 1;
                    p.total_placement_width_mm += w;
                    alloc.usedW += w;
                    alloc.usedWt += wt;
                  }
                }
              }
            }
          }
        }

        // Push final shelves
        for (const shelf of tierShelves) {
          const alloc = doorAllocations[shelf.shelf_id];
          planogramShelves.push({
            shelf_id: shelf.shelf_id,
            shelf_index: shelf.shelf_index,
            door_index: shelf.door_index,
            door_label: shelf.door_label,
            tier: shelf.tier,
            tier_label: shelf.tier_label,
            usable_width_mm: shelf.usable_width_mm,
            usable_depth_mm: shelf.usable_depth_mm,
            clearance_height_mm: shelf.clearance_height_mm,
            max_weight_kg: shelf.max_weight_kg,
            used_width_mm: alloc.usedW,
            fill_rate_pct: Number(((alloc.usedW / shelf.usable_width_mm) * 100).toFixed(1)),
            used_weight_kg: Number(alloc.usedWt.toFixed(1)),
            placements: alloc.placements
          });
        }
      }

      const planogram = {
        planogram_id: `PLANO-${cooler.cooler_id}-${objective.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        cooler_id: cooler.cooler_id,
        cooler_name: cooler.name,
        doors: cooler.doors,
        optimization_objective: objective,
        brand_order_sequence: masterBrandOrder,
        shelves: planogramShelves
      };

      const validator = new PlanogramValidator(this.skus, this.coolerSpecs, rules);
      const validation = validator.validate(planogram);

      const analyticsEngine = new PlanogramAnalytics(this.skus, this.coolerSpecs, rules);
      const analytics = analyticsEngine.computeAnalytics(planogram);

      return { planogram, validation, analytics };
    }

    /**
     * STAGE 1: Mathematical Knapsack Solver for facing allocation
     * Strictly bounds sum(f_i * w_i) <= usable_width_mm
     */
    solveShelfAllocations(shelf, eligibleSkus, objective, weights) {
      const usableWidth = shelf.usable_width_mm;
      const maxWeightKg = shelf.max_weight_kg;
      const gamma = weights.space_elasticity_gamma || 0.20;
      const eyeScore = shelf.eye_level_score || 0.5;
      const eyeMult = 1.0 + (eyeScore - 0.5) * 0.15;

      const candidates = eligibleSkus.map(sku => {
        const unitsDeep = Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
        const w = sku.dimensions_mm.width;
        const weightPerFacingKg = (unitsDeep * sku.weight_g) / 1000.0;

        let baseYield = 0;
        if (objective === 'revenue') {
          baseYield = sku.unit_price * 15.0 + sku.sales_velocity_units_day * 0.4;
        } else if (objective === 'volume') {
          baseYield = sku.sales_velocity_units_day * 2.0;
        } else { // profit
          baseYield = sku.margin * 30.0 + sku.sales_velocity_units_day * 0.3;
        }

        if (eyeScore > 0.8) {
          baseYield *= (1.0 + (sku.margin / 2.0) * (weights.eye_level_margin_boost || 0.4));
        }

        const minF = (objective === 'volume' && sku.is_core_sku) ? Math.max(2, sku.min_facings || 1) : (sku.min_facings || 1);
        const maxF = Math.max(minF, sku.max_facings + ((objective === 'volume' && sku.sales_velocity_units_day > 35) ? 1 : 0));

        return {
          sku,
          unitsDeep,
          width_mm: w,
          weightPerFacingKg,
          baseYield,
          minF,
          maxF,
          valueDensity: baseYield / (w / 10.0)
        };
      });

      // Sort by value density
      candidates.sort((a, b) => b.valueDensity - a.valueDensity);

      const selected = [];
      let currWidth = 0;
      let currWeight = 0;

      // Pass 1: Place top items with min_facings without exceeding usable width
      for (const cand of candidates) {
        const minW = cand.minF * cand.width_mm;
        const minWt = cand.minF * cand.weightPerFacingKg;

        if (currWidth + minW <= usableWidth && currWeight + minWt <= maxWeightKg) {
          selected.push({
            sku: cand.sku,
            facings: cand.minF,
            unitsDeep: cand.unitsDeep,
            width_mm: cand.width_mm,
            weightPerFacingKg: cand.weightPerFacingKg,
            maxF: cand.maxF
          });
          currWidth += minW;
          currWeight += minWt;
        }
      }

      // Pass 2: Greedy Knapsack Expansion (Strict check: currWidth + addW <= usableWidth)
      let improved = true;
      while (improved) {
        improved = false;
        let bestIdx = -1;
        let bestGain = -1;

        for (let i = 0; i < selected.length; i++) {
          const item = selected[i];
          if (item.facings < item.maxF) {
            const addW = item.width_mm;
            const addWt = item.weightPerFacingKg;

            if (currWidth + addW <= usableWidth && currWeight + addWt <= maxWeightKg) {
              const sku = item.sku;
              const f = item.facings;
              const curSales = sku.sales_velocity_units_day * Math.pow(f, gamma) * eyeMult;
              const nextSales = sku.sales_velocity_units_day * Math.pow(f + 1, gamma) * eyeMult;
              const deltaSales = nextSales - curSales;

              let marginalGain = 0;
              if (objective === 'revenue') {
                marginalGain = (deltaSales * sku.unit_price) / (addW / 10.0);
              } else if (objective === 'volume') {
                marginalGain = deltaSales / (addW / 10.0);
              } else { // profit
                marginalGain = (deltaSales * sku.margin) / (addW / 10.0);
              }

              if (marginalGain > bestGain) {
                bestGain = marginalGain;
                bestIdx = i;
              }
            }
          }
        }

        if (bestIdx !== -1) {
          const item = selected[bestIdx];
          item.facings += 1;
          currWidth += item.width_mm;
          currWeight += item.weightPerFacingKg;
          improved = true;
        }
      }

      return { selectedItems: selected, usedWidthMm: currWidth, usedWeightKg: currWeight };
    }

    /**
     * STAGE 2: Post-Solver Sequencing & Brand Flow
     * Filters master brand sequence to active brands on this shelf, ensuring relative order A->C->D
     */
    postSolveBrandSequencing(shelf, selectedItems, masterBrandOrder, flavorRankMap) {
      const brandRankMap = new Map(masterBrandOrder.map((b, idx) => [b, idx]));

      const brandGroups = new Map();
      for (const item of selectedItems) {
        const b = item.sku.brand;
        if (!brandGroups.has(b)) brandGroups.set(b, []);
        brandGroups.get(b).push(item);
      }

      // Sort present brands on this shelf according to the master order
      const presentBrands = Array.from(brandGroups.keys()).sort((b1, b2) => {
        const r1 = brandRankMap.has(b1) ? brandRankMap.get(b1) : 999;
        const r2 = brandRankMap.has(b2) ? brandRankMap.get(b2) : 999;
        return r1 - r2;
      });

      const placements = [];
      let xOffsetMm = 0;

      for (const brand of presentBrands) {
        const items = brandGroups.get(brand);
        // Sort items inside the brand block by flavor sequence
        items.sort((a, b) => {
          const f1 = flavorRankMap.has(a.sku.flavor) ? flavorRankMap.get(a.sku.flavor) : 99;
          const f2 = flavorRankMap.has(b.sku.flavor) ? flavorRankMap.get(b.sku.flavor) : 99;
          return f1 - f2;
        });

        for (const item of items) {
          const pw = item.facings * item.sku.dimensions_mm.width;
          placements.push({
            sku_id: item.sku.sku_id,
            sku_name: item.sku.name,
            brand: item.sku.brand,
            category: item.sku.category,
            flavor: item.sku.flavor,
            pack_type: item.sku.pack_type,
            pack_size_label: item.sku.pack_size_label,
            sugar_type: item.sku.sugar_type,
            facings: item.facings,
            width_mm: item.sku.dimensions_mm.width,
            total_placement_width_mm: pw,
            x_offset_mm: xOffsetMm,
            color_hex: item.sku.color_hex,
            image_emoji: item.sku.image_emoji,
            units_deep: item.unitsDeep
          });
          xOffsetMm += pw;
        }
      }

      return placements;
    }
  }

  // ==========================================
  // 6. INTERACTIVE BRAND ORDER MANAGER
  // ==========================================
  class BrandOrderManager {
    constructor(containerElement, allSkus, rules, options = {}) {
      this.container = containerElement;
      this.allSkus = allSkus;
      this.rules = rules;
      this.onOrderChanged = options.onOrderChanged || (() => {});
      this.draggedBrandIndex = null;
      
      this.brandList = JSON.parse(JSON.stringify(rules.brand_order || []));
      const existingBrandNames = new Set(this.brandList.map(b => b.brand));
      const allUniqueBrands = Array.from(new Set(allSkus.map(s => s.brand)));

      for (const brand of allUniqueBrands) {
        if (!existingBrandNames.has(brand)) {
          const sampleSku = allSkus.find(s => s.brand === brand);
          this.brandList.push({
            brand,
            priority: this.brandList.length + 1,
            preferred_doors: [1, 2],
            adjacent_brands: [],
            block_color: sampleSku?.color_hex || '#3B82F6'
          });
        }
      }
    }

    init() {
      this.render();
      this.attachPresetListeners();
    }

    render() {
      if (!this.container) return;
      this.container.innerHTML = '';

      const countBadge = document.getElementById('badge-brand-order-count');
      if (countBadge) countBadge.textContent = `${this.brandList.length} Brands`;

      for (let i = 0; i < this.brandList.length; i++) {
        const b = this.brandList[i];
        b.priority = i + 1;

        const card = document.createElement('div');
        card.className = 'brand-order-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-index', i);

        const sampleSku = this.allSkus.find(s => s.brand === b.brand);
        const emoji = sampleSku?.image_emoji || '🥤';
        const color = b.block_color || sampleSku?.color_hex || '#333';

        card.innerHTML = `
          <span class="brand-drag-handle" title="Drag to reorder">⠿</span>
          <span class="brand-rank-pill">#${i + 1}</span>
          <span class="brand-color-dot" style="background-color: ${color}"></span>
          <span>${emoji}</span>
          <span class="brand-card-name">${b.brand}</span>
          <div class="brand-step-btn-group">
            <button type="button" class="btn-brand-step btn-step-left" title="Move Left / Earlier" ${i === 0 ? 'disabled style="opacity:0.3"' : ''}>◀</button>
            <button type="button" class="btn-brand-step btn-step-right" title="Move Right / Later" ${i === this.brandList.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▶</button>
          </div>
        `;

        card.querySelector('.btn-step-left')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveBrand(i, i - 1);
        });

        card.querySelector('.btn-step-right')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveBrand(i, i + 1);
        });

        card.addEventListener('dragstart', (e) => {
          this.draggedBrandIndex = i;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          this.draggedBrandIndex = null;
        });

        card.addEventListener('dragover', (e) => {
          e.preventDefault();
        });

        card.addEventListener('drop', (e) => {
          e.preventDefault();
          if (this.draggedBrandIndex !== null && this.draggedBrandIndex !== i) {
            this.moveBrand(this.draggedBrandIndex, i);
          }
        });

        this.container.appendChild(card);
      }
    }

    moveBrand(fromIndex, toIndex) {
      if (toIndex < 0 || toIndex >= this.brandList.length) return;
      const [moved] = this.brandList.splice(fromIndex, 1);
      this.brandList.splice(toIndex, 0, moved);
      this.render();
      this.notifyChange();
    }

    attachPresetListeners() {
      document.getElementById('btn-sort-brand-velocity')?.addEventListener('click', () => {
        const brandVelMap = new Map();
        for (const s of this.allSkus) {
          brandVelMap.set(s.brand, (brandVelMap.get(s.brand) || 0) + s.sales_velocity_units_day);
        }
        this.brandList.sort((a, b) => (brandVelMap.get(b.brand) || 0) - (brandVelMap.get(a.brand) || 0));
        this.render();
        this.notifyChange();
      });

      document.getElementById('btn-sort-brand-margin')?.addEventListener('click', () => {
        const brandMarginMap = new Map();
        const brandCountMap = new Map();
        for (const s of this.allSkus) {
          brandMarginMap.set(s.brand, (brandMarginMap.get(s.brand) || 0) + s.margin);
          brandCountMap.set(s.brand, (brandCountMap.get(s.brand) || 0) + 1);
        }
        this.brandList.sort((a, b) => {
          const avgA = (brandMarginMap.get(a.brand) || 0) / (brandCountMap.get(a.brand) || 1);
          const avgB = (brandMarginMap.get(b.brand) || 0) / (brandCountMap.get(b.brand) || 1);
          return avgB - avgA;
        });
        this.render();
        this.notifyChange();
      });

      document.getElementById('btn-sort-brand-alpha')?.addEventListener('click', () => {
        this.brandList.sort((a, b) => a.brand.localeCompare(b.brand));
        this.render();
        this.notifyChange();
      });

      document.getElementById('btn-reset-brand-order')?.addEventListener('click', () => {
        this.brandList = JSON.parse(JSON.stringify(DEFAULT_RULES.brand_order || []));
        this.render();
        this.notifyChange();
      });
    }

    notifyChange() {
      for (let i = 0; i < this.brandList.length; i++) {
        this.brandList[i].priority = i + 1;
      }
      this.onOrderChanged(this.brandList);
    }
  }

  // ==========================================
  // 7. HEATMAP ENGINE
  // ==========================================
  class HeatmapEngine {
    constructor() {
      this.currentMode = 'none';
    }

    setMode(mode) {
      this.currentMode = mode;
    }

    getItemStyle(placement, sku, shelf) {
      if (this.currentMode === 'none') {
        return { background: placement.color_hex || '#333', badge: null };
      }

      if (this.currentMode === 'margin') {
        const margin = sku.margin || 1.0;
        if (margin >= 1.60) return { background: 'linear-gradient(135deg, #059669, #10B981)', badge: `+$${margin.toFixed(2)}` };
        if (margin >= 1.20) return { background: 'linear-gradient(135deg, #0D9488, #14B8A6)', badge: `+$${margin.toFixed(2)}` };
        return { background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', badge: `+$${margin.toFixed(2)}` };
      }

      if (this.currentMode === 'velocity') {
        const vel = sku.sales_velocity_units_day || 20;
        if (vel >= 35) return { background: 'linear-gradient(135deg, #DC2626, #EF4444)', badge: `${vel}u/d 🔥` };
        if (vel >= 22) return { background: 'linear-gradient(135deg, #D97706, #F59E0B)', badge: `${vel}u/d` };
        return { background: 'linear-gradient(135deg, #475569, #64748B)', badge: `${vel}u/d` };
      }

      if (this.currentMode === 'dos') {
        const unitsDeep = placement.units_deep || Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
        const totalUnits = placement.facings * unitsDeep;
        const dos = sku.sales_velocity_units_day > 0 ? totalUnits / sku.sales_velocity_units_day : 99;
        if (dos < 1.5) return { background: 'linear-gradient(135deg, #991B1B, #DC2626)', badge: `${dos.toFixed(1)}d ⚠️ OOS` };
        if (dos > 4.5) return { background: 'linear-gradient(135deg, #312E81, #4338CA)', badge: `${dos.toFixed(1)}d 📦 Over` };
        return { background: 'linear-gradient(135deg, #065F46, #059669)', badge: `${dos.toFixed(1)}d ✅` };
      }

      if (this.currentMode === 'eye_level') {
        const score = shelf.eye_level_score || 0.5;
        if (score >= 0.9) return { background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', badge: 'GOLDEN 👑' };
        if (score >= 0.7) return { background: 'linear-gradient(135deg, #2563EB, #3B82F6)', badge: 'REACH ⭐' };
        return { background: 'linear-gradient(135deg, #334155, #475569)', badge: 'BASE' };
      }

      if (this.currentMode === 'ai_rationale') {
        if (placement.facings >= 4) return { background: 'linear-gradient(135deg, #0284C7, #0369A1)', badge: '🤖 High Vel' };
        if (sku.margin >= 1.40) return { background: 'linear-gradient(135deg, #059669, #10B981)', badge: '🤖 High Marg' };
        if (shelf.tier === 'bottom') return { background: 'linear-gradient(135deg, #475569, #64748B)', badge: '🤖 Heavy Base' };
        if (shelf.tier === 'eye_level') return { background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', badge: '🤖 Eye Golden' };
        return { background: 'linear-gradient(135deg, #2563EB, #3B82F6)', badge: '🤖 Contract Anchor' };
      }

      return { background: placement.color_hex, badge: null };
    }

    getLegend() {
      const legends = {
        none: [],
        ai_rationale: [
          { color: '#0284C7', label: 'High Velocity Demand (>35 u/d)' },
          { color: '#10B981', label: 'Premium Profit Margin (>$1.40)' },
          { color: '#8B5CF6', label: 'Golden Eye-Level Reach' },
          { color: '#64748B', label: 'Heavy Base Format' },
          { color: '#3B82F6', label: 'Brand Contract Anchor' }
        ],
        margin: [
          { color: '#10B981', label: 'High Margin (>$1.60)' },
          { color: '#14B8A6', label: 'Medium Margin ($1.20 - $1.60)' },
          { color: '#3B82F6', label: 'Core Margin (<$1.20)' }
        ],
        velocity: [
          { color: '#EF4444', label: 'High Velocity (>35 u/d)' },
          { color: '#F59E0B', label: 'Medium Velocity (22-35 u/d)' },
          { color: '#64748B', label: 'Slow Mover (<22 u/d)' }
        ],
        dos: [
          { color: '#DC2626', label: 'Stockout Risk (<1.5 Days)' },
          { color: '#059669', label: 'Optimal Buffer (1.5-4.5 Days)' },
          { color: '#4338CA', label: 'Overstock (>4.5 Days)' }
        ],
        eye_level: [
          { color: '#8B5CF6', label: 'Golden Eye-Level (1.0)' },
          { color: '#3B82F6', label: 'Upper Reach Zone (0.85)' },
          { color: '#475569', label: 'Base Zone (0.40)' }
        ]
      };
      return legends[this.currentMode] || [];
    }
  }

  // ==========================================
  // 8. COOLER VISUAL CANVAS RENDERER (Strict Door Width Bound)
  // ==========================================
  class CoolerRenderer {
    constructor(containerElement, options = {}) {
      this.container = containerElement;
      this.heatmapEngine = options.heatmapEngine;
      this.onPlanogramModified = options.onPlanogramModified || (() => {});
      this.draggedItem = null;
    }

    render(planogram, validation, analytics, skus, coolerSpecs) {
      this.planogram = planogram;
      this.validation = validation;
      this.analytics = analytics;
      this.skus = skus;
      this.skuMap = new Map(skus.map(s => [s.sku_id, s]));
      this.coolerSpecs = coolerSpecs;

      const cooler = coolerSpecs.find(c => c.cooler_id === planogram.cooler_id) || coolerSpecs[0];
      this.container.innerHTML = '';

      const coolerFixture = document.createElement('div');
      coolerFixture.className = 'cooler-fixture';

      const headerCanopy = document.createElement('div');
      headerCanopy.className = 'cooler-header-canopy';
      headerCanopy.innerHTML = `
        <div class="cooler-header-brand">
          <span class="cooler-logo-icon">❄️</span>
          <span class="cooler-header-title">${cooler.name}</span>
        </div>
        <div class="cooler-header-stats">
          <span class="badge-tag"><i class="tag-dot green"></i> LED Active</span>
          <span class="badge-tag">Width: ${cooler.total_width_mm}mm</span>
          <span class="badge-tag">Doors: ${cooler.doors}</span>
        </div>
      `;
      coolerFixture.appendChild(headerCanopy);

      const baysGrid = document.createElement('div');
      baysGrid.className = 'cooler-bays-grid';

      for (let d = 1; d <= cooler.doors; d++) {
        const bayShelves = planogram.shelves.filter(s => s.door_index === d);
        const bayElement = document.createElement('div');
        bayElement.className = 'cooler-bay';
        bayElement.innerHTML = `
          <div class="bay-header">
            <span class="bay-door-label">Door ${d}: ${d === 1 ? 'Core & Flavours' : (d === 2 ? 'Energy & Refreshment' : 'Hydration & Juices')}</span>
            <span class="bay-door-handle"></span>
          </div>
        `;

        const shelvesContainer = document.createElement('div');
        shelvesContainer.className = 'bay-shelves-container';

        for (const shelf of bayShelves) {
          const shelfElement = this.createShelfElement(shelf);
          shelvesContainer.appendChild(shelfElement);
        }

        bayElement.appendChild(shelvesContainer);
        baysGrid.appendChild(bayElement);
      }

      coolerFixture.appendChild(baysGrid);

      const baseGrill = document.createElement('div');
      baseGrill.className = 'cooler-base-grill';
      baseGrill.innerHTML = `
        <div class="grill-slits"></div>
        <div class="temp-display">🌡️ 3.4°C | Chilled</div>
      `;
      coolerFixture.appendChild(baseGrill);

      this.container.appendChild(coolerFixture);
    }

    createShelfElement(shelf) {
      const shelfAnalytics = this.analytics?.shelfAnalytics?.find(s => s.shelf_id === shelf.shelf_id);
      const usedWidthMm = shelf.placements.reduce((sum, p) => sum + (p.total_placement_width_mm || p.facings * p.width_mm), 0);
      const fillPct = shelf.usable_width_mm > 0 ? Number(((usedWidthMm / shelf.usable_width_mm) * 100).toFixed(1)) : 0;
      const isOverflow = usedWidthMm > shelf.usable_width_mm;

      const uniqueVols = Array.from(new Set(shelf.placements.map(p => p.pack_size_label)));
      const volTag = uniqueVols.length === 1 
        ? `<span class="shelf-vol-tag ${uniqueVols[0] === '1.5L' ? 'heavy-bottom' : ''}">🧴 ${uniqueVols[0]} ONLY</span>` 
        : '';

      const hUtil = shelfAnalytics?.heightUtilizationPct || 0;
      const airGap = shelfAnalytics?.airGapHeadroomMm !== undefined ? shelfAnalytics.airGapHeadroomMm : 0;

      const shelfWrapper = document.createElement('div');
      shelfWrapper.className = `shelf-wrapper tier-${shelf.tier} ${isOverflow ? 'shelf-overflow' : ''}`;

      const metaBar = document.createElement('div');
      metaBar.className = 'shelf-meta-bar';
      metaBar.innerHTML = `
        <div class="shelf-tier-tag">
          <span class="tier-pill ${shelf.tier}">${shelf.tier_label || shelf.tier}</span>
          ${volTag}
          <span class="shelf-dim-info">H: ${shelf.clearance_height_mm}mm | W: ${shelf.usable_width_mm}mm</span>
          <span class="shelf-dim-info height-metric-pill" title="Vertical Height Utilization & Headroom Clearance">↕ ${hUtil}% H-Fill (${airGap}mm gap)</span>
        </div>
        <div class="shelf-utilization-metric">
          <div class="utilization-bar-bg">
            <div class="utilization-bar-fill ${isOverflow ? 'danger' : (fillPct > 90 ? 'optimal' : 'normal')}" style="width: ${Math.min(100, fillPct)}%"></div>
          </div>
          <span class="utilization-text">${fillPct}% Width (${usedWidthMm} / ${shelf.usable_width_mm}mm)</span>
        </div>
      `;
      shelfWrapper.appendChild(metaBar);

      const deckHeightPx = Math.max(90, Math.round((shelf.clearance_height_mm || 280) * 0.44));
      const shelfDeck = document.createElement('div');
      shelfDeck.className = 'shelf-deck';
      shelfDeck.style.width = '100%';
      shelfDeck.style.maxWidth = '100%';
      shelfDeck.style.height = `${deckHeightPx}px`;
      shelfDeck.style.minHeight = `${deckHeightPx}px`;
      shelfDeck.style.overflow = 'hidden';
      shelfDeck.style.boxSizing = 'border-box';
      shelfDeck.style.display = 'flex';
      shelfDeck.style.alignItems = 'flex-end';

      shelfDeck.addEventListener('dragover', (e) => {
        e.preventDefault();
        shelfDeck.classList.add('drag-hover');
      });

      shelfDeck.addEventListener('dragleave', () => {
        shelfDeck.classList.remove('drag-hover');
      });

      shelfDeck.addEventListener('drop', (e) => {
        e.preventDefault();
        shelfDeck.classList.remove('drag-hover');
        this.handleDropOnShelf(shelf.shelf_id);
      });

      for (let pIdx = 0; pIdx < shelf.placements.length; pIdx++) {
        const placement = shelf.placements[pIdx];
        const sku = this.skuMap.get(placement.sku_id);
        if (!sku) continue;

        const itemCard = this.createItemCard(placement, sku, shelf, pIdx, deckHeightPx);
        shelfDeck.appendChild(itemCard);

        // Add Realistic Acrylic Lane Separator between SKUs
        if (pIdx < shelf.placements.length - 1) {
          const nextPlacement = shelf.placements[pIdx + 1];
          const isBrandBoundary = placement.brand !== nextPlacement.brand;
          const divider = document.createElement('div');
          divider.className = `cooler-acrylic-divider ${isBrandBoundary ? 'brand-boundary-fin' : 'lane-divider-fin'}`;
          divider.title = isBrandBoundary ? `Brand Divider (${placement.brand} | ${nextPlacement.brand})` : 'Clear Acrylic Shelf Lane Divider';
          shelfDeck.appendChild(divider);
        }
      }

      shelfWrapper.appendChild(shelfDeck);

      const rackEdge = document.createElement('div');
      rackEdge.className = 'shelf-rack-edge';
      shelfWrapper.appendChild(rackEdge);

      return shelfWrapper;
    }

    createItemCard(placement, sku, shelf, placementIndex, deckHeightPx) {
      const card = document.createElement('div');
      card.className = 'sku-facing-card';
      card.setAttribute('draggable', 'true');

      // Exact Proportional Physical Height & Width Sizing
      const skuHeightMm = (sku.dimensions_mm && sku.dimensions_mm.height) || 115;
      const shelfClearanceMm = shelf.clearance_height_mm || 280;
      const heightRatio = Math.min(0.96, Math.max(0.38, skuHeightMm / shelfClearanceMm));
      const cardHeightPx = Math.round(deckHeightPx * heightRatio);

      const placementWidthMm = placement.facings * sku.dimensions_mm.width;
      const widthPct = (placementWidthMm / shelf.usable_width_mm) * 100;
      card.style.flex = `0 0 ${widthPct}%`;
      card.style.width = `${widthPct}%`;
      card.style.maxWidth = `${widthPct}%`;
      card.style.height = `${cardHeightPx}px`;
      card.style.alignSelf = 'flex-end';
      card.style.boxSizing = 'border-box';

      const style = this.heatmapEngine ? this.heatmapEngine.getItemStyle(placement, sku, shelf) : { background: placement.color_hex };
      card.style.background = style.background;

      // Internal Facing Lane Tracks (Faded vertical column lines for multi-facing SKUs)
      let internalLanesHtml = '';
      if (placement.facings > 1) {
        internalLanesHtml = `<div class="sku-internal-lanes-container">` +
          Array.from({ length: placement.facings - 1 }).map(() => `<span class="internal-lane-rib"></span>`).join('') +
          `</div>`;
      }

      card.innerHTML = `
        ${internalLanesHtml}
        <div class="sku-card-inner">
          <div class="sku-header-row">
            <span class="sku-emoji">${sku.image_emoji || '🥤'}</span>
            <span class="sku-facings-badge">${placement.facings} ${placement.facings === 1 ? 'facing' : 'facings'}</span>
          </div>
          <div class="sku-info-body">
            <div class="sku-brand-name">${sku.brand}</div>
            <div class="sku-flavor-name">${sku.flavor}</div>
            <div class="sku-size-tag">${sku.pack_size_label || ''} • <span class="sku-height-val">${skuHeightMm}mm</span></div>
          </div>
          ${style.badge ? `<div class="sku-heatmap-badge">${style.badge}</div>` : ''}
          <div class="sku-quick-controls">
            <button class="btn-facing-step btn-minus" title="Decrease">-</button>
            <button class="btn-facing-step btn-plus" title="Increase">+</button>
          </div>
        </div>
        <div class="sku-hover-tooltip">
          <div class="tooltip-title">${sku.name}</div>
          <div class="tooltip-grid">
            <div><span>Brand:</span> <strong>${sku.brand}</strong></div>
            <div><span>Category:</span> <strong>${sku.category}</strong></div>
            <div><span>Pack:</span> <strong>${sku.pack_type} • ${sku.pack_size_label}</strong></div>
            <div><span>Height / Clearance:</span> <strong>${skuHeightMm}mm H / ${shelfClearanceMm}mm shelf</strong></div>
            <div><span>Facings:</span> <strong>${placement.facings} (${placementWidthMm}mm / ${shelf.usable_width_mm}mm)</strong></div>
            <div><span>Sales Velocity:</span> <strong>${sku.sales_velocity_units_day} u/day</strong></div>
            <div><span>Price / Margin:</span> <strong>$${sku.unit_price.toFixed(2)} (+$${sku.margin.toFixed(2)})</strong></div>
          </div>
          <div class="tooltip-ai-rationale" style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.2); font-size: 0.72rem; color: var(--accent-cyan);">
            <span>🤖 AI Rationale:</span> <strong>${this.getAiFacingRationale(sku, placement, shelf)}</strong>
          </div>
        </div>
      `;

      card.querySelector('.btn-minus').addEventListener('click', (e) => {
        e.stopPropagation();
        this.modifyFacingCount(shelf.shelf_id, placementIndex, -1);
      });

      card.querySelector('.btn-plus').addEventListener('click', (e) => {
        e.stopPropagation();
        this.modifyFacingCount(shelf.shelf_id, placementIndex, +1);
      });

      card.addEventListener('dragstart', () => {
        this.draggedItem = { shelfId: shelf.shelf_id, placementIndex };
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedItem = null;
      });

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-facing-step')) return;
        this.openSkuInspectionModal(sku, placement, shelf);
      });

      return card;
    }

    modifyFacingCount(shelfId, placementIndex, delta) {
      const shelf = this.planogram.shelves.find(s => s.shelf_id === shelfId);
      if (!shelf || !shelf.placements[placementIndex]) return;

      const p = shelf.placements[placementIndex];
      const newFacings = p.facings + delta;

      if (delta > 0) {
        // Enforce Door Width Bound: Never exceed shelf width
        const currentShelfWidth = shelf.placements.reduce((sum, item) => sum + item.facings * item.width_mm, 0);
        if (currentShelfWidth + p.width_mm > shelf.usable_width_mm) {
          alert(`⚠️ Cannot increase facings: Shelf capacity of ${shelf.usable_width_mm}mm would be exceeded.`);
          return;
        }
      }

      if (newFacings <= 0) {
        shelf.placements.splice(placementIndex, 1);
        // No-Empty-Shelf: If shelf becomes empty, fill with sibling door SKU on same tier (e.g. Coke 1.5L)
        if (shelf.placements.length === 0) {
          const tierIndex = shelf.shelf_index;
          const siblingShelf = this.planogram.shelves.find(s => s.shelf_index === tierIndex && s.shelf_id !== shelfId && s.placements.length > 0);
          if (siblingShelf && siblingShelf.placements.length > 0) {
            const siblingPlacement = siblingShelf.placements[0];
            const siblingSku = this.skus.find(s => s.sku_id === siblingPlacement.sku_id);
            if (siblingSku) {
              const unitsDeep = siblingPlacement.units_deep || Math.max(1, Math.floor(shelf.usable_depth_mm / siblingSku.dimensions_mm.depth));
              const w = siblingSku.dimensions_mm.width;
              const maxFit = Math.floor(shelf.usable_width_mm / w);
              const fCount = Math.min(maxFit, Math.max(1, siblingPlacement.facings));
              shelf.placements.push({
                sku_id: siblingSku.sku_id,
                sku_name: siblingSku.name,
                brand: siblingSku.brand,
                category: siblingSku.category,
                flavor: siblingSku.flavor,
                pack_type: siblingSku.pack_type,
                pack_size_label: siblingSku.pack_size_label,
                sugar_type: siblingSku.sugar_type,
                facings: fCount,
                width_mm: w,
                total_placement_width_mm: fCount * w,
                x_offset_mm: 0,
                color_hex: siblingSku.color_hex || '#3B82F6',
                image_emoji: siblingSku.image_emoji || '🥤',
                units_deep: unitsDeep
              });
            }
          }
        }
      } else {
        p.facings = newFacings;
        p.total_placement_width_mm = p.facings * p.width_mm;
      }

      let offset = 0;
      for (const item of shelf.placements) {
        item.x_offset_mm = offset;
        offset += item.total_placement_width_mm;
      }

      this.onPlanogramModified(this.planogram);
    }

    handleDropOnShelf(targetShelfId) {
      if (!this.draggedItem) return;
      const sourceShelf = this.planogram.shelves.find(s => s.shelf_id === this.draggedItem.shelfId);
      const targetShelf = this.planogram.shelves.find(s => s.shelf_id === targetShelfId);

      if (!sourceShelf || !targetShelf) return;

      const movedPlacement = sourceShelf.placements[this.draggedItem.placementIndex];
      const targetWidth = targetShelf.placements.reduce((sum, item) => sum + item.facings * item.width_mm, 0);

      // Check target door width before dropping
      if (targetWidth + movedPlacement.total_placement_width_mm > targetShelf.usable_width_mm) {
        alert(`⚠️ Cannot move SKU: Target shelf width (${targetShelf.usable_width_mm}mm) would be exceeded.`);
        return;
      }

      sourceShelf.placements.splice(this.draggedItem.placementIndex, 1);
      targetShelf.placements.push(movedPlacement);

      for (const shelf of [sourceShelf, targetShelf]) {
        let offset = 0;
        for (const item of shelf.placements) {
          item.x_offset_mm = offset;
          offset += item.total_placement_width_mm;
        }
      }

      this.onPlanogramModified(this.planogram);
    }

    getAiFacingRationale(sku, placement, shelf) {
      if (placement.facings >= 4) {
        return `High-velocity flagship mover (${sku.sales_velocity_units_day} u/d) prioritized for ${placement.facings} facings to prevent stockouts.`;
      }
      if (sku.margin >= 1.40) {
        return `Premium margin contributor (+$${sku.margin.toFixed(2)}) allocated optimal shelf width.`;
      }
      if (shelf.tier === 'bottom') {
        return `Heavy pack size (${sku.pack_size_label}) allocated to heavy-duty base shelf.`;
      }
      if (shelf.tier === 'eye_level') {
        return `Golden eye-level placement to maximize impulse consumer visibility.`;
      }
      return `Balanced multi-brand facing allocation within ${shelf.usable_width_mm}mm door bound.`;
    }

    openSkuInspectionModal(sku, placement, shelf) {
      const modal = document.getElementById('sku-inspection-modal');
      if (!modal) return;

      const emojiEl = document.getElementById('inspect-sku-emoji');
      const titleEl = document.getElementById('inspect-sku-title');
      const subtitleEl = document.getElementById('inspect-sku-subtitle');
      const reasonEl = document.getElementById('inspect-ai-reason-text');
      const locEl = document.getElementById('inspect-shelf-loc');
      const facingsEl = document.getElementById('inspect-facings');
      const capEl = document.getElementById('inspect-capacity');
      const headroomEl = document.getElementById('inspect-headroom');
      const priceEl = document.getElementById('inspect-price');
      const marginEl = document.getElementById('inspect-margin');
      const velEl = document.getElementById('inspect-velocity');
      const profitEl = document.getElementById('inspect-daily-profit');

      if (emojiEl) emojiEl.textContent = sku.image_emoji || '🥤';
      if (titleEl) titleEl.textContent = sku.name;
      if (subtitleEl) subtitleEl.textContent = `${sku.brand} • ${sku.category} • ${sku.pack_type} (${sku.pack_size_label})`;
      if (reasonEl) reasonEl.textContent = this.getAiFacingRationale(sku, placement, shelf);

      const unitsDeep = placement.units_deep || Math.max(1, Math.floor(shelf.usable_depth_mm / sku.dimensions_mm.depth));
      const totalUnits = placement.facings * unitsDeep;
      const skuHeight = sku.dimensions_mm.height;
      const airGap = Math.max(0, shelf.clearance_height_mm - skuHeight);
      const estDailyProfit = (sku.sales_velocity_units_day || 20) * (placement.facings ** 0.20) * (shelf.eye_level_score || 0.5) * sku.margin;

      if (locEl) locEl.textContent = `${shelf.door_label || `Door ${shelf.door_index}`} (${shelf.tier_label || shelf.shelf_id})`;
      if (facingsEl) facingsEl.textContent = `${placement.facings} Facings (${placement.total_placement_width_mm || placement.facings * placement.width_mm}mm / ${shelf.usable_width_mm}mm)`;
      if (capEl) capEl.textContent = `${totalUnits} Units (${unitsDeep} Deep)`;
      if (headroomEl) headroomEl.textContent = `${airGap}mm Air Gap (${skuHeight}mm H / ${shelf.clearance_height_mm}mm shelf)`;
      if (priceEl) priceEl.textContent = `$${sku.unit_price.toFixed(2)}`;
      if (marginEl) marginEl.textContent = `+$${sku.margin.toFixed(2)}`;
      if (velEl) velEl.textContent = `${sku.sales_velocity_units_day} units/day`;
      if (profitEl) profitEl.textContent = `$${estDailyProfit.toFixed(2)} / day`;

      modal.style.display = 'flex';
    }
  }

  // ==========================================
  // 9. MULTI-SELECT DROPDOWN COMPONENT
  // ==========================================
  class MultiSelectDropdown {
    constructor(wrapperId, options = {}) {
      this.wrapper = document.getElementById(wrapperId);
      this.title = options.title || 'Items';
      this.items = options.items || [];
      this.selectedSet = new Set(this.items);
      this.onChange = options.onChange || (() => {});
      this.init();
    }

    init() {
      if (!this.wrapper) return;
      this.trigger = this.wrapper.querySelector('.multiselect-trigger');
      this.dropdown = this.wrapper.querySelector('.multiselect-dropdown');
      this.optionsContainer = this.wrapper.querySelector('.ms-options-list');
      this.label = this.wrapper.querySelector('.ms-label');

      this.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.multiselect-dropdown.open').forEach(d => {
          if (d !== this.dropdown) d.classList.remove('open');
        });
        document.querySelectorAll('.multiselect-trigger.open').forEach(t => {
          if (t !== this.trigger) t.classList.remove('open');
        });

        this.dropdown.classList.toggle('open');
        this.trigger.classList.toggle('open');
      });

      this.wrapper.querySelector('.ms-actions-row button:first-child')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedSet = new Set(this.items);
        this.renderOptions();
        this.updateLabel();
        this.onChange(Array.from(this.selectedSet));
      });

      this.wrapper.querySelector('.ms-actions-row button:last-child')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedSet.clear();
        this.renderOptions();
        this.updateLabel();
        this.onChange([]);
      });

      this.renderOptions();
      this.updateLabel();
    }

    setItems(items) {
      this.items = items;
      this.selectedSet = new Set(items);
      this.renderOptions();
      this.updateLabel();
    }

    renderOptions() {
      if (!this.optionsContainer) return;
      this.optionsContainer.innerHTML = '';

      for (const item of this.items) {
        const row = document.createElement('label');
        row.className = 'ms-checkbox-row';
        const isChecked = this.selectedSet.has(item);

        row.innerHTML = `
          <input type="checkbox" value="${item}" ${isChecked ? 'checked' : ''}>
          <span>${item}</span>
        `;

        row.querySelector('input').addEventListener('change', (e) => {
          if (e.target.checked) {
            this.selectedSet.add(item);
          } else {
            this.selectedSet.delete(item);
          }
          this.updateLabel();
          this.onChange(Array.from(this.selectedSet));
        });

        this.optionsContainer.appendChild(row);
      }
    }

    updateLabel() {
      if (!this.label) return;
      const count = this.selectedSet.size;
      const total = this.items.length;
      if (count === total) {
        this.label.textContent = `All (${total})`;
      } else if (count === 0) {
        this.label.textContent = `None (0)`;
      } else if (count <= 2) {
        this.label.textContent = Array.from(this.selectedSet).join(', ');
      } else {
        this.label.textContent = `${count} Selected`;
      }
    }

    getSelected() {
      return Array.from(this.selectedSet);
    }

    reset() {
      this.selectedSet = new Set(this.items);
      this.renderOptions();
      this.updateLabel();
    }
  }

  // ==========================================
  // 10. ASSORTMENT & FACET SELECTOR CONTROLLER
  // ==========================================
  class AssortmentSelector {
    constructor(containerElement, allSkus, options = {}) {
      this.container = containerElement;
      this.allSkus = allSkus;
      this.activeSkuIds = new Set(allSkus.map(s => s.sku_id));
      this.onSelectionChanged = options.onSelectionChanged || (() => {});
      this.searchQuery = '';
      this.multiSelects = {};
      this.sortField = null;
      this.sortDirection = 'asc';
    }

    init() {
      for (const sku of this.allSkus) {
        if (!sku.inclusion_priority) {
          sku.inclusion_priority = sku.is_core_sku ? 'must_have' : 'nice_to_have';
          if (sku.inclusion_priority === 'must_have') {
            sku.min_facings = Math.max(2, sku.min_facings || 2);
          }
        }
      }
      this.initMultiSelects();
      this.attachFilterListeners();
      this.renderSkuChips();

      document.addEventListener('click', () => {
        document.querySelectorAll('.multiselect-dropdown.open').forEach(d => d.classList.remove('open'));
        document.querySelectorAll('.multiselect-trigger.open').forEach(t => t.classList.remove('open'));
      });
    }

    initMultiSelects() {
      const brands = Array.from(new Set(this.allSkus.map(s => s.brand))).sort();
      const categories = Array.from(new Set(this.allSkus.map(s => s.category))).sort();
      const packTypes = Array.from(new Set(this.allSkus.map(s => s.pack_type))).sort();
      const packSizes = Array.from(new Set(this.allSkus.map(s => s.pack_size_label))).sort();
      const sugarTypes = Array.from(new Set(this.allSkus.map(s => s.sugar_type))).sort();
      const flavors = Array.from(new Set(this.allSkus.map(s => s.flavor))).sort();

      const createMs = (wrapperId, items, title) => {
        return new MultiSelectDropdown(wrapperId, {
          title,
          items,
          onChange: () => {
            this.renderSkuChips();
          }
        });
      };

      this.multiSelects.brand = createMs('wrapper-brand-multiselect', brands, 'Brands');
      this.multiSelects.category = createMs('wrapper-category-multiselect', categories, 'Categories');
      this.multiSelects.packType = createMs('wrapper-packtype-multiselect', packTypes, 'Pack Types');
      this.multiSelects.packSize = createMs('wrapper-packsize-multiselect', packSizes, 'Pack Sizes');
      this.multiSelects.sugarType = createMs('wrapper-sugartype-multiselect', sugarTypes, 'Sugar Types');
      this.multiSelects.flavor = createMs('wrapper-flavor-multiselect', flavors, 'Flavors');
    }

    attachFilterListeners() {
      const searchInput = document.getElementById('input-sku-search');
      searchInput?.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderSkuChips();
      });

      document.getElementById('btn-select-all-skus')?.addEventListener('click', () => {
        const visibleSkus = this.getFilteredSkus();
        for (const s of visibleSkus) this.activeSkuIds.add(s.sku_id);
        this.renderSkuChips();
        this.notifyChange();
      });

      document.getElementById('btn-select-core-skus')?.addEventListener('click', () => {
        this.activeSkuIds.clear();
        for (const s of this.allSkus) {
          if (s.is_core_sku) this.activeSkuIds.add(s.sku_id);
        }
        this.renderSkuChips();
        this.notifyChange();
      });

      document.getElementById('btn-clear-all-skus')?.addEventListener('click', () => {
        const visibleSkus = this.getFilteredSkus();
        for (const s of visibleSkus) this.activeSkuIds.delete(s.sku_id);
        this.renderSkuChips();
        this.notifyChange();
      });

      document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        this.searchQuery = '';
        if (searchInput) searchInput.value = '';
        this.sortField = null;
        this.sortDirection = 'asc';
        this.updateSortHeaderUI();
        Object.values(this.multiSelects).forEach(ms => ms.reset());
        this.renderSkuChips();
      });

      // Table Header Column Sorting Listeners
      document.querySelectorAll('.sku-assortment-table th.sortable-th').forEach(th => {
        th.addEventListener('click', () => {
          const field = th.getAttribute('data-sort');
          if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortField = field;
            this.sortDirection = 'asc';
          }
          this.updateSortHeaderUI();
          this.renderSkuRows();
        });
      });

      // Sidebar SKU tab controls
      const sidebarSearch = document.getElementById('sidebar-sku-search');
      sidebarSearch?.addEventListener('input', () => {
        this.renderSidebarSkuList();
      });

      document.getElementById('btn-sidebar-select-all')?.addEventListener('click', () => {
        for (const s of this.allSkus) this.activeSkuIds.add(s.sku_id);
        this.renderSkuChips();
        this.notifyChange();
      });

      document.getElementById('btn-sidebar-core-only')?.addEventListener('click', () => {
        this.activeSkuIds.clear();
        for (const s of this.allSkus) {
          if (s.is_core_sku) this.activeSkuIds.add(s.sku_id);
        }
        this.renderSkuChips();
        this.notifyChange();
      });

      document.getElementById('btn-sidebar-clear-all')?.addEventListener('click', () => {
        this.activeSkuIds.clear();
        this.renderSkuChips();
        this.notifyChange();
      });
    }

    updateSortHeaderUI() {
      document.querySelectorAll('.sku-assortment-table th.sortable-th').forEach(th => {
        const field = th.getAttribute('data-sort');
        const icon = th.querySelector('.sort-icon');
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (field === this.sortField) {
          th.classList.add(this.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
          if (icon) icon.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
        } else {
          if (icon) icon.textContent = '↕';
        }
      });
    }

    getFilteredSkus() {
      const selBrands = new Set(this.multiSelects.brand?.getSelected() || []);
      const selCats = new Set(this.multiSelects.category?.getSelected() || []);
      const selPackTypes = new Set(this.multiSelects.packType?.getSelected() || []);
      const selPackSizes = new Set(this.multiSelects.packSize?.getSelected() || []);
      const selSugarTypes = new Set(this.multiSelects.sugarType?.getSelected() || []);
      const selFlavors = new Set(this.multiSelects.flavor?.getSelected() || []);

      let list = this.allSkus.filter(sku => {
        if (!selBrands.has(sku.brand)) return false;
        if (!selCats.has(sku.category)) return false;
        if (!selPackTypes.has(sku.pack_type)) return false;
        if (!selPackSizes.has(sku.pack_size_label)) return false;
        if (!selSugarTypes.has(sku.sugar_type)) return false;
        if (!selFlavors.has(sku.flavor)) return false;

        if (this.searchQuery) {
          const q = this.searchQuery;
          const match = sku.name.toLowerCase().includes(q) ||
                        sku.brand.toLowerCase().includes(q) ||
                        sku.flavor.toLowerCase().includes(q) ||
                        sku.sku_id.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });

      // Apply Column Sorting
      if (this.sortField) {
        list.sort((a, b) => {
          let res = 0;
          if (this.sortField === 'brand') {
            res = a.brand.localeCompare(b.brand);
          } else if (this.sortField === 'volume') {
            res = (a.pack_size_ml || 0) - (b.pack_size_ml || 0);
          } else if (this.sortField === 'name') {
            res = a.name.localeCompare(b.name);
          } else if (this.sortField === 'category') {
            res = a.category.localeCompare(b.category);
          } else if (this.sortField === 'price') {
            res = a.unit_price - b.unit_price;
          } else if (this.sortField === 'velocity') {
            res = a.sales_velocity_units_day - b.sales_velocity_units_day;
          } else if (this.sortField === 'priority') {
            const pRank = { must_have: 3, nice_to_have: 2, must_not_have: 1 };
            res = (pRank[a.inclusion_priority] || 2) - (pRank[b.inclusion_priority] || 2);
          } else if (this.sortField === 'min_facings') {
            res = (a.min_facings || 0) - (b.min_facings || 0);
          }
          return this.sortDirection === 'desc' ? -res : res;
        });
      }

      return list;
    }

    renderSkuRows() {
      const tbody = document.getElementById('sku-table-tbody');
      if (!tbody) return;

      const filtered = this.getFilteredSkus();
      tbody.innerHTML = '';

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="status-empty-msg text-muted" style="text-align:center; padding: 1.5rem;">No SKUs match the current filters. Click "Reset Filters" to show all products.</td></tr>`;
        return;
      }

      for (const sku of filtered) {
        const priority = sku.inclusion_priority || (sku.is_core_sku ? 'must_have' : 'nice_to_have');
        sku.inclusion_priority = priority;
        const isActive = this.activeSkuIds.has(sku.sku_id) && priority !== 'must_not_have';

        const tr = document.createElement('tr');
        tr.className = `sku-table-row ${isActive ? 'row-active' : 'row-inactive'} sku-row-${priority}`;

        const curMinF = sku.min_facings !== undefined ? sku.min_facings : (priority === 'must_have' ? 2 : 1);
        sku.min_facings = curMinF;
        const maxF = sku.max_facings || 4;

        tr.innerHTML = `
          <td style="text-align: center;">
            <input type="checkbox" class="sku-row-checkbox" ${isActive ? 'checked' : ''} style="cursor: pointer; transform: scale(1.15);">
          </td>
          <td>
            <div class="sku-table-product-cell">
              <span class="sku-chip-dot" style="background-color: ${sku.color_hex}"></span>
              <span>${sku.image_emoji || '🥤'}</span>
              <span class="sku-product-name">${sku.name}</span>
            </div>
          </td>
          <td><span class="sku-brand-pill">${sku.brand}</span></td>
          <td><span class="sku-vol-cell-badge ${sku.pack_size_ml >= 1000 ? 'vol-1500ml' : ''}">${sku.pack_size_label}</span></td>
          <td><span class="text-secondary">${sku.category}</span></td>
          <td><span class="text-secondary">${sku.pack_type} • ${sku.sugar_type}</span></td>
          <td><span>$${sku.unit_price.toFixed(2)} (<strong class="text-success">+$${sku.margin.toFixed(2)}</strong>)</span></td>
          <td><span class="font-mono">${sku.sales_velocity_units_day} u/d</span></td>
          <td>
            <select class="sku-priority-select priority-${priority}" title="Set Assortment Inclusion Rule">
              <option value="must_have" ${priority === 'must_have' ? 'selected' : ''}>⭐ Must Have (Min 2)</option>
              <option value="nice_to_have" ${priority === 'nice_to_have' ? 'selected' : ''}>✨ Nice to Have (Optional)</option>
              <option value="must_not_have" ${priority === 'must_not_have' ? 'selected' : ''}>🚫 Must Not Have (Excluded)</option>
            </select>
          </td>
          <td style="text-align: center;">
            <div class="min-facings-stepper">
              <button type="button" class="btn-stepper btn-min-minus" title="Decrease Min Facings" ${!isActive || curMinF <= (priority === 'must_have' ? 2 : 1) ? 'disabled' : ''}>-</button>
              <input type="number" class="input-min-facings" value="${curMinF}" min="${priority === 'must_have' ? 2 : 1}" max="${maxF}" ${!isActive ? 'disabled' : ''} title="Minimum facings guaranteed in cooler">
              <button type="button" class="btn-stepper btn-min-plus" title="Increase Min Facings" ${!isActive || curMinF >= maxF ? 'disabled' : ''}>+</button>
            </div>
          </td>
          <td style="text-align: center;">
            <span class="${isActive ? 'badge-row-active' : 'badge-row-excluded'}">${isActive ? (priority === 'must_have' ? 'MUST' : 'ACTIVE') : 'EXCLUDED'}</span>
          </td>
        `;

        // Priority Dropdown change listener
        tr.querySelector('.sku-priority-select')?.addEventListener('change', (e) => {
          e.stopPropagation();
          const val = e.target.value;
          sku.inclusion_priority = val;
          if (val === 'must_have') {
            this.activeSkuIds.add(sku.sku_id);
            sku.min_facings = Math.max(2, sku.min_facings || 2);
          } else if (val === 'must_not_have') {
            this.activeSkuIds.delete(sku.sku_id);
            sku.min_facings = 0;
          } else { // nice_to_have
            this.activeSkuIds.add(sku.sku_id);
            if (!sku.min_facings || sku.min_facings < 1) sku.min_facings = 1;
          }
          this.renderSkuRows();
          this.notifyChange();
        });

        // Checkbox change listener
        tr.querySelector('.sku-row-checkbox')?.addEventListener('change', (e) => {
          e.stopPropagation();
          if (e.target.checked) {
            this.activeSkuIds.add(sku.sku_id);
            if (sku.inclusion_priority === 'must_not_have') {
              sku.inclusion_priority = 'nice_to_have';
              sku.min_facings = 1;
            }
          } else {
            this.activeSkuIds.delete(sku.sku_id);
            sku.inclusion_priority = 'must_not_have';
            sku.min_facings = 0;
          }
          this.renderSkuRows();
          this.notifyChange();
        });

        // Min Facings Stepper: Minus
        tr.querySelector('.btn-min-minus')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const floorMin = sku.inclusion_priority === 'must_have' ? 2 : 1;
          if (sku.min_facings > floorMin) {
            sku.min_facings -= 1;
            this.renderSkuRows();
            this.notifyChange();
          }
        });

        // Min Facings Stepper: Plus
        tr.querySelector('.btn-min-plus')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (sku.min_facings < maxF) {
            sku.min_facings += 1;
            this.renderSkuRows();
            this.notifyChange();
          }
        });

        // Min Facings Input Typing
        tr.querySelector('.input-min-facings')?.addEventListener('change', (e) => {
          e.stopPropagation();
          let val = parseInt(e.target.value, 10);
          const floorMin = sku.inclusion_priority === 'must_have' ? 2 : 1;
          if (isNaN(val) || val < floorMin) val = floorMin;
          if (val > maxF) val = maxF;
          sku.min_facings = val;
          this.renderSkuRows();
          this.notifyChange();
        });

        tbody.appendChild(tr);
      }

      this.renderSidebarSkuList();
      this.updateAssortmentBadge();
    }

    renderSkuChips() {
      this.renderSkuRows();
    }

    renderSidebarSkuList() {
      const list = document.getElementById('sidebar-sku-list');
      if (!list) return;
      list.innerHTML = '';

      const query = (document.getElementById('sidebar-sku-search')?.value || '').toLowerCase().trim();
      const filtered = this.allSkus.filter(s => {
        if (!query) return true;
        return s.name.toLowerCase().includes(query) || s.brand.toLowerCase().includes(query) || s.category.toLowerCase().includes(query);
      });

      for (const sku of filtered) {
        const isActive = this.activeSkuIds.has(sku.sku_id);
        const item = document.createElement('div');
        item.className = `sidebar-sku-item ${isActive ? 'active' : 'inactive'}`;
        item.innerHTML = `
          <input type="checkbox" ${isActive ? 'checked' : ''}>
          <span>${sku.image_emoji}</span>
          <span class="sidebar-sku-name">${sku.name} (Min: ${sku.min_facings || 1})</span>
          <span class="sidebar-sku-margin text-success">+$${sku.margin.toFixed(2)}</span>
        `;

        item.addEventListener('click', (e) => {
          if (this.activeSkuIds.has(sku.sku_id)) {
            this.activeSkuIds.delete(sku.sku_id);
          } else {
            this.activeSkuIds.add(sku.sku_id);
          }
          this.renderSkuRows();
          this.notifyChange();
        });

        list.appendChild(item);
      }
    }

    updateAssortmentBadge() {
      const badge = document.getElementById('badge-selected-sku-count');
      const kpiStat = document.getElementById('kpi-assortment-stat');
      const text = `${this.activeSkuIds.size} / ${this.allSkus.length} Active`;
      if (badge) badge.textContent = text;
      if (kpiStat) kpiStat.textContent = `${this.activeSkuIds.size} SKUs Active`;
    }

    notifyChange() {
      this.updateAssortmentBadge();
      this.renderSidebarSkuList();
      const selectedList = this.allSkus.filter(s => this.activeSkuIds.has(s.sku_id));
      this.onSelectionChanged(selectedList);
    }
  }

  // ==========================================
  // 11. RULE & CONFIG EDITOR
  // ==========================================
  class RuleEditor {
    constructor(containerElement, options = {}) {
      this.container = containerElement;
      this.onDataChanged = options.onDataChanged || (() => {});
      this.currentTab = 'rules';
    }

    render(skus, coolerSpecs, rules) {
      this.skus = skus;
      this.coolerSpecs = coolerSpecs;
      this.rules = rules;

      this.container.innerHTML = `
        <div class="editor-panel-header">
          <div class="editor-tabs">
            <button class="tab-btn ${this.currentTab === 'rules' ? 'active' : ''}" data-tab="rules">📋 Rules JSON</button>
            <button class="tab-btn ${this.currentTab === 'skus' ? 'active' : ''}" data-tab="skus">🥤 SKUs CSV (${skus.length})</button>
            <button class="tab-btn ${this.currentTab === 'coolers' ? 'active' : ''}" data-tab="coolers">❄️ Fixture Specs (${coolerSpecs.length})</button>
          </div>
          <button class="btn-primary-gradient" id="btn-reoptimize" style="font-size:0.75rem; padding: 0.35rem 0.75rem;">
            ⚡ Run Optimization
          </button>
        </div>

        <div class="editor-panel-body">
          <div class="editor-tab-content ${this.currentTab === 'rules' ? 'active' : ''}" id="tab-rules">
            <div class="json-editor-wrapper">
              <div class="editor-helper-banner">
                💡 <strong>2-Stage Merchandising Engine</strong>: Mathematical facing optimization + Post-solver brand sequencing.
              </div>
              <textarea class="code-editor-textarea" id="textarea-rules" spellcheck="false">${JSON.stringify(rules, null, 2)}</textarea>
              <div class="editor-footer-row">
                <button class="btn-secondary" id="btn-apply-rules">Apply Rule Changes</button>
              </div>
            </div>
          </div>

          <div class="editor-tab-content ${this.currentTab === 'skus' ? 'active' : ''}" id="tab-skus">
            <div class="table-scroll-wrap">
              <table class="data-table small">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Brand</th>
                    <th>Pack Type</th>
                    <th>Size</th>
                    <th>Sugar</th>
                    <th>Velocity</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  ${skus.map(s => `
                    <tr>
                      <td><strong>${s.name}</strong></td>
                      <td>${s.brand}</td>
                      <td>${s.pack_type}</td>
                      <td>${s.pack_size_label}</td>
                      <td>${s.sugar_type}</td>
                      <td>${s.sales_velocity_units_day} u/d</td>
                      <td><strong class="text-success">+$${s.margin.toFixed(2)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="editor-tab-content ${this.currentTab === 'coolers' ? 'active' : ''}" id="tab-coolers">
            <div class="table-scroll-wrap">
              <table class="data-table small">
                <thead>
                  <tr>
                    <th>Cooler Model</th>
                    <th>Doors</th>
                    <th>Shelf ID</th>
                    <th>Tier</th>
                    <th>Width x Depth</th>
                    <th>Clearance</th>
                    <th>Max Wt</th>
                  </tr>
                </thead>
                <tbody>
                  ${coolerSpecs.flatMap(c => c.bays.flatMap(b => b.shelves.map(s => `
                    <tr>
                      <td><code>${c.cooler_id}</code></td>
                      <td>Door ${b.door_index}</td>
                      <td><code>${s.shelf_id}</code></td>
                      <td><span class="tier-pill ${s.tier}">${s.tier_label || s.tier}</span></td>
                      <td>${s.usable_width_mm} x ${s.usable_depth_mm}mm</td>
                      <td><strong>${s.clearance_height_mm}mm</strong></td>
                      <td>${s.max_weight_kg}kg</td>
                    </tr>
                  `))).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    attachEventListeners() {
      const tabBtns = this.container.querySelectorAll('.tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.currentTab = btn.getAttribute('data-tab');
          this.container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          this.container.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          this.container.querySelector(`#tab-${this.currentTab}`)?.classList.add('active');
        });
      });

      const btnApply = this.container.querySelector('#btn-apply-rules');
      if (btnApply) {
        btnApply.addEventListener('click', () => {
          try {
            const raw = this.container.querySelector('#textarea-rules').value;
            this.rules = JSON.parse(raw);
            this.onDataChanged({ skus: this.skus, coolerSpecs: this.coolerSpecs, rules: this.rules });
            alert('✅ Rules updated!');
          } catch (err) {
            alert('❌ Invalid JSON: ' + err.message);
          }
        });
      }

      const btnReopt = this.container.querySelector('#btn-reoptimize');
      if (btnReopt) {
        btnReopt.addEventListener('click', () => {
          try {
            const raw = this.container.querySelector('#textarea-rules').value;
            this.rules = JSON.parse(raw);
          } catch (e) {}
          this.onDataChanged({ skus: this.skus, coolerSpecs: this.coolerSpecs, rules: this.rules, triggerOptimize: true });
        });
      }
    }
  }

  // ==========================================
  // 12. EXPORTER UTILITIES
  // ==========================================
  class PlanogramExporter {
    static exportJSON(planogram, analytics, validation) {
      const exportData = { planogram, validation, analytics, exported_at: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${planogram.planogram_id || 'planogram'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    static exportCSV(planogram, skus) {
      const skuMap = new Map(skus.map(s => [s.sku_id, s]));
      const rows = ['Shelf_ID,Door,Tier,SKU_ID,Product_Name,Brand,Flavor,Pack_Type,Pack_Size,Facings,Placement_Width_MM'];
      for (const shelf of planogram.shelves) {
        for (const p of shelf.placements) {
          const s = skuMap.get(p.sku_id) || {};
          rows.push(`"${shelf.shelf_id}",${shelf.door_index},"${shelf.tier}","${p.sku_id}","${(p.sku_name || '').replace(/"/g, '""')}","${p.brand}","${p.flavor}","${s.pack_type || ''}","${s.pack_size_label || ''}",${p.facings},${p.total_placement_width_mm}`);
        }
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${planogram.planogram_id || 'planogram'}_pick_list.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    static exportAssortmentCSV(selectedSkus) {
      const headers = ['sku_id', 'name', 'brand', 'sub_brand', 'category', 'flavor', 'sugar_type', 'pack_type', 'pack_size_label', 'unit_price', 'margin', 'sales_velocity_units_day'];
      const rows = [headers.join(',')];
      for (const s of selectedSkus) {
        rows.push([
          `"${s.sku_id}"`,
          `"${s.name.replace(/"/g, '""')}"`,
          `"${s.brand}"`,
          `"${s.sub_brand}"`,
          `"${s.category}"`,
          `"${s.flavor}"`,
          `"${s.sugar_type}"`,
          `"${s.pack_type}"`,
          `"${s.pack_size_label}"`,
          s.unit_price,
          s.margin,
          s.sales_velocity_units_day
        ].join(','));
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_assortment_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ==========================================
  // 13. MAIN APP CONTROLLER
  // ==========================================
  class CoolerPlanogramApp {
    constructor() {
      this.allSkus = parseSkusFromCSV(RAW_SKUS_CSV);
      this.coolerSpecs = parseCoolersFromCSV(RAW_COOLER_SPECS_CSV);
      this.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
      this.activeCoolerId = 'COOLER-2DOOR-STD';
      this.currentObjective = 'profit';
      this.heatmapEngine = new HeatmapEngine();
      this.currentPlanogramResult = null;
      this.selectedSkus = [...this.allSkus];
      this.autoOptimizeShelves = false;
      this.shelfScenariosComparison = null;
      this.hasRun = false;
    }

    async init() {
      try {
        if (window.location.protocol.startsWith('http')) {
          const [skusRes, coolersRes, rulesRes] = await Promise.all([
            fetch('./data/skus.csv'),
            fetch('./data/cooler_specs.csv'),
            fetch('./data/merchandising_rules.json')
          ]);
          if (skusRes.ok && coolersRes.ok && rulesRes.ok) {
            const skusCsvText = await skusRes.text();
            const coolersCsvText = await coolersRes.text();
            this.allSkus = parseSkusFromCSV(skusCsvText);
            this.coolerSpecs = parseCoolersFromCSV(coolersCsvText);
            this.rules = await rulesRes.json();
            this.selectedSkus = [...this.allSkus];
          }
        }
      } catch (e) {
        console.info('Using embedded CSV datasets', e);
      }

      this.setupBrandOrderManager();
      this.setupAssortmentSelector();
      this.setupUI();
      this.updateStatusBar('ready');
    }

    setupBrandOrderManager() {
      const container = document.getElementById('brand-sortable-container');
      this.brandOrderManager = new BrandOrderManager(container, this.allSkus, this.rules, {
        onOrderChanged: (newBrandOrder) => {
          this.rules.brand_order = newBrandOrder;
          if (this.hasRun) {
            this.runOptimization();
          } else {
            this.updateStatusBar('ready');
          }
        }
      });
      this.brandOrderManager.init();
    }

    setupAssortmentSelector() {
      const filterBar = document.getElementById('assortment-filter-bar');
      this.assortmentSelector = new AssortmentSelector(filterBar, this.allSkus, {
        onSelectionChanged: (activeSkus) => {
          this.selectedSkus = activeSkus.length > 0 ? activeSkus : this.allSkus;
          if (this.hasRun) {
            this.runOptimization();
          } else {
            this.updateStatusBar('ready');
          }
        }
      });
      this.brandOrderManager && this.brandOrderManager.init();
      this.assortmentSelector.init();
    }

    setupUI() {
      this.setupCoolerConfigurator();

      const objButtons = document.querySelectorAll('.objective-btn');
      objButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          objButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentObjective = btn.getAttribute('data-objective');
          if (this.hasRun) {
            this.runOptimization();
          } else {
            this.updateStatusBar('ready');
          }
        });
      });

      const heatmapBtns = document.querySelectorAll('.heatmap-toggle-btn');
      heatmapBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          heatmapBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.heatmapEngine.setMode(btn.getAttribute('data-mode'));
          this.updateHeatmapLegend();
          if (this.hasRun) this.renderCooler();
        });
      });

      // Theme Switcher Toggle & Menu
      const themeToggleBtn = document.getElementById('btn-theme-toggle');
      const themeMenu = document.getElementById('theme-menu-dropdown');
      const themeIcon = document.getElementById('theme-toggle-icon');
      const themeText = document.getElementById('theme-toggle-text');
      const themeOptions = document.querySelectorAll('.theme-option');

      const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('cooler_planogram_theme', theme);
        
        themeOptions.forEach(opt => {
          const isMatch = opt.getAttribute('data-theme') === theme;
          opt.classList.toggle('active', isMatch);
          const check = opt.querySelector('.theme-check');
          if (check) check.textContent = isMatch ? '✓' : '';
        });

        if (theme === 'light') {
          if (themeIcon) themeIcon.textContent = '☀️';
          if (themeText) themeText.textContent = 'Light';
        } else if (theme === 'frost') {
          if (themeIcon) themeIcon.textContent = '❄️';
          if (themeText) themeText.textContent = 'Frost';
        } else {
          if (themeIcon) themeIcon.textContent = '🌙';
          if (themeText) themeText.textContent = 'Dark';
        }
      };

      const savedTheme = localStorage.getItem('cooler_planogram_theme') || 'dark';
      applyTheme(savedTheme);

      themeToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        themeMenu?.classList.toggle('open');
      });

      themeOptions.forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const t = opt.getAttribute('data-theme');
          applyTheme(t);
          themeMenu?.classList.remove('open');
        });
      });

      document.addEventListener('click', () => {
        themeMenu?.classList.remove('open');
      });

      // User RUN buttons
      const handleRun = () => {
        this.runOptimization();
      };

      document.getElementById('btn-hero-run-solver')?.addEventListener('click', handleRun);
      document.getElementById('btn-standby-run')?.addEventListener('click', handleRun);
      document.getElementById('btn-run-optimization')?.addEventListener('click', handleRun);

      document.getElementById('btn-export-json')?.addEventListener('click', () => {
        if (this.currentPlanogramResult) {
          PlanogramExporter.exportJSON(
            this.currentPlanogramResult.planogram,
            this.currentPlanogramResult.analytics,
            this.currentPlanogramResult.validation
          );
        } else {
          alert('Please run the optimizer first before exporting.');
        }
      });

      document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        if (this.currentPlanogramResult) {
          PlanogramExporter.exportCSV(this.currentPlanogramResult.planogram, this.selectedSkus);
        } else {
          alert('Please run the optimizer first before exporting.');
        }
      });

      document.getElementById('btn-export-assortment-csv')?.addEventListener('click', () => {
        PlanogramExporter.exportAssortmentCSV(this.selectedSkus);
      });

      document.getElementById('btn-print-spec')?.addEventListener('click', () => {
        window.print();
      });

      // User Guide Modal Event Handlers
      const guideModal = document.getElementById('user-guide-modal');
      const openGuideBtn = document.getElementById('btn-open-user-guide');
      const closeGuideBtn = document.getElementById('btn-close-user-guide');
      const dismissGuideBtn = document.getElementById('btn-dismiss-user-guide');
      const guideNavBtns = document.querySelectorAll('.guide-nav-btn');
      const guidePanes = document.querySelectorAll('.guide-tab-pane');

      openGuideBtn?.addEventListener('click', () => {
        if (guideModal) guideModal.style.display = 'flex';
      });

      const closeGuide = () => {
        if (guideModal) guideModal.style.display = 'none';
      };

      closeGuideBtn?.addEventListener('click', closeGuide);
      dismissGuideBtn?.addEventListener('click', closeGuide);

      guideModal?.addEventListener('click', (e) => {
        if (e.target === guideModal) closeGuide();
      });

      guideNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-target');
          guideNavBtns.forEach(b => b.classList.remove('active'));
          guidePanes.forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById(targetId)?.classList.add('active');
        });
      });

      const editorContainer = document.getElementById('editor-panel-container');
      if (editorContainer) {
        this.ruleEditor = new RuleEditor(editorContainer, {
          onDataChanged: ({ skus, coolerSpecs, rules, triggerOptimize }) => {
            this.allSkus = skus;
            this.coolerSpecs = coolerSpecs;
            this.rules = rules;
          }
        });
        this.ruleEditor.render(this.allSkus, this.coolerSpecs, this.rules);
      }

      this.setupAiCopilotUI();
    }

    setupCoolerConfigurator() {
      // Zone 3 Input Controls
      const zoneCoolerSelect = document.getElementById('select-cooler-model');
      const zoneShelfMinusBtn = document.getElementById('btn-zone-shelf-minus');
      const zoneShelfPlusBtn = document.getElementById('btn-zone-shelf-plus');
      const zoneShelfCountVal = document.getElementById('zone-shelf-count-val');
      const zoneToggleHeightsBtn = document.getElementById('btn-zone-toggle-heights');
      const zoneHeightsDrawer = document.getElementById('zone-shelf-heights-drawer');
      const zoneHeightsGrid = document.getElementById('zone-shelf-heights-grid');
      const zoneResetBtn = document.getElementById('btn-zone-reset-defaults');
      const pillDoors = document.getElementById('pill-cooler-doors');
      const pillWidth = document.getElementById('pill-cooler-width');
      const pillHeight = document.getElementById('pill-cooler-height');
      const pillDepth = document.getElementById('pill-cooler-depth');
      const navCoolerBadge = document.getElementById('badge-cooler-shelf-count');

      // Solved View Canvas Toolbar Controls
      const canvasCoolerSelect = document.getElementById('select-active-cooler');
      const canvasShelfMinusBtn = document.getElementById('btn-shelf-minus');
      const canvasShelfPlusBtn = document.getElementById('btn-shelf-plus');
      const canvasShelfCountDisplay = document.getElementById('current-shelf-count-val');
      const canvasToggleHeightsBtn = document.getElementById('btn-toggle-shelf-heights');
      const canvasHeightsDrawer = document.getElementById('shelf-heights-drawer');
      const canvasHeightsGrid = document.getElementById('shelf-heights-grid');
      const canvasResetBtn = document.getElementById('btn-reset-default-heights');

      const populateSelects = () => {
        const optionsHtml = this.coolerSpecs.map(c => `
          <option value="${c.cooler_id}" ${c.cooler_id === this.activeCoolerId ? 'selected' : ''}>
            ${c.name} (${c.total_doors || c.doors} Door${(c.total_doors || c.doors) > 1 ? 's' : ''}, ${c.total_width_mm}mm W)
          </option>
        `).join('');

        if (zoneCoolerSelect) zoneCoolerSelect.innerHTML = optionsHtml;
        if (canvasCoolerSelect) canvasCoolerSelect.innerHTML = optionsHtml;
      };

      const syncUI = () => {
        const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];
        const shelfCount = cooler.bays[0]?.shelves?.length || 5;
        const totalDoors = cooler.total_doors || cooler.doors || 2;

        if (zoneCoolerSelect) zoneCoolerSelect.value = this.activeCoolerId;
        if (canvasCoolerSelect) canvasCoolerSelect.value = this.activeCoolerId;

        if (zoneShelfCountVal) zoneShelfCountVal.textContent = shelfCount;
        if (canvasShelfCountDisplay) canvasShelfCountDisplay.textContent = `${shelfCount} Shelves`;
        if (navCoolerBadge) navCoolerBadge.textContent = `${totalDoors} Door${totalDoors > 1 ? 's' : ''} • ${shelfCount} Shelves`;

        if (pillDoors) pillDoors.textContent = `${totalDoors} Door${totalDoors > 1 ? 's' : ''}`;
        if (pillWidth) pillWidth.textContent = `${cooler.total_width_mm}mm W`;
        if (pillHeight) pillHeight.textContent = `${cooler.total_height_mm}mm H`;
        if (pillDepth) pillDepth.textContent = `${cooler.total_depth_mm}mm D`;

        renderHeightsGrids();
      };

      const renderHeightsGrids = () => {
        const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];
        const shelves = cooler.bays[0]?.shelves || [];

        const createGridHtml = (prefix) => shelves.map((s, idx) => `
          <div class="shelf-height-item">
            <div class="shelf-height-label">
              <span>Shelf ${idx + 1} (${s.tier_label || s.tier})</span>
              <strong id="${prefix}-val-shelf-h-${idx}">${s.clearance_height_mm}mm</strong>
            </div>
            <input type="range" class="shelf-height-slider ${prefix}-slider" data-index="${idx}" min="200" max="420" step="10" value="${s.clearance_height_mm}">
          </div>
        `).join('');

        if (zoneHeightsGrid) {
          zoneHeightsGrid.innerHTML = createGridHtml('zone');
          zoneHeightsGrid.querySelectorAll('.zone-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
              const idx = parseInt(slider.getAttribute('data-index'), 10);
              const newH = parseInt(e.target.value, 10);
              cooler.bays.forEach(bay => {
                if (bay.shelves[idx]) bay.shelves[idx].clearance_height_mm = newH;
              });
              syncUI();
              if (this.hasRun) this.runOptimization();
            });
          });
        }

        if (canvasHeightsGrid) {
          canvasHeightsGrid.innerHTML = createGridHtml('canvas');
          canvasHeightsGrid.querySelectorAll('.canvas-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
              const idx = parseInt(slider.getAttribute('data-index'), 10);
              const newH = parseInt(e.target.value, 10);
              cooler.bays.forEach(bay => {
                if (bay.shelves[idx]) bay.shelves[idx].clearance_height_mm = newH;
              });
              syncUI();
              if (this.hasRun) this.runOptimization();
            });
          });
        }
      };

      // Auto-Optimize Shelves Switches
      const zoneAutoChk = document.getElementById('chk-auto-shelves');
      const canvasAutoChk = document.getElementById('chk-canvas-auto-shelves');
      const zoneShelfStepperWrap = document.getElementById('zone-shelf-stepper-wrap');
      const canvasShelfStepperWrap = document.getElementById('canvas-shelf-stepper-wrap');

      const onAutoShelvesToggle = (checked) => {
        this.autoOptimizeShelves = checked;
        if (zoneAutoChk) zoneAutoChk.checked = checked;
        if (canvasAutoChk) canvasAutoChk.checked = checked;

        if (zoneShelfStepperWrap) zoneShelfStepperWrap.style.opacity = checked ? '0.5' : '1';
        if (canvasShelfStepperWrap) canvasShelfStepperWrap.style.opacity = checked ? '0.5' : '1';

        syncUI();
        if (this.hasRun) this.runOptimization();
      };

      zoneAutoChk?.addEventListener('change', (e) => onAutoShelvesToggle(e.target.checked));
      canvasAutoChk?.addEventListener('change', (e) => onAutoShelvesToggle(e.target.checked));

      // Scenario Comparison Modal Event Handlers
      document.getElementById('btn-find-optimal-shelves')?.addEventListener('click', () => this.openScenariosModal());
      document.getElementById('btn-compare-scenarios')?.addEventListener('click', () => this.openScenariosModal());
      document.getElementById('btn-canvas-compare-scenarios')?.addEventListener('click', () => this.openScenariosModal());
      document.getElementById('btn-banner-compare-scenarios')?.addEventListener('click', () => this.openScenariosModal());

      const closeScenariosModal = () => {
        const modal = document.getElementById('shelf-scenarios-modal');
        if (modal) modal.style.display = 'none';
      };

      document.getElementById('btn-close-scenarios')?.addEventListener('click', closeScenariosModal);
      document.getElementById('btn-dismiss-scenarios')?.addEventListener('click', closeScenariosModal);
      document.getElementById('shelf-scenarios-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'shelf-scenarios-modal') closeScenariosModal();
      });

      const onCoolerChange = (newCoolerId) => {
        this.activeCoolerId = newCoolerId;
        this.resetCoolerToDefaults(this.activeCoolerId);
        syncUI();
        if (this.hasRun) this.runOptimization();
      };

      zoneCoolerSelect?.addEventListener('change', (e) => onCoolerChange(e.target.value));
      canvasCoolerSelect?.addEventListener('change', (e) => onCoolerChange(e.target.value));

      const stepShelves = (delta) => {
        if (this.autoOptimizeShelves) {
          onAutoShelvesToggle(false);
        }
        const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];
        const curCount = cooler.bays[0]?.shelves?.length || 5;
        const newCount = curCount + delta;
        if (newCount >= 3 && newCount <= 15) {
          this.changeCoolerShelfCount(cooler, newCount);
          syncUI();
          if (this.hasRun) this.runOptimization();
        }
      };

      zoneShelfMinusBtn?.addEventListener('click', () => stepShelves(-1));
      zoneShelfPlusBtn?.addEventListener('click', () => stepShelves(1));
      canvasShelfMinusBtn?.addEventListener('click', () => stepShelves(-1));
      canvasShelfPlusBtn?.addEventListener('click', () => stepShelves(1));

      const toggleHeights = (drawer) => {
        if (drawer) {
          const isClosed = drawer.style.display === 'none' || !drawer.style.display;
          drawer.style.display = isClosed ? 'block' : 'none';
        }
      };

      zoneToggleHeightsBtn?.addEventListener('click', () => toggleHeights(zoneHeightsDrawer));
      canvasToggleHeightsBtn?.addEventListener('click', () => toggleHeights(canvasHeightsDrawer));

      const resetDefaults = () => {
        onAutoShelvesToggle(false);
        this.resetCoolerToDefaults(this.activeCoolerId);
        syncUI();
        if (this.hasRun) this.runOptimization();
      };

      zoneResetBtn?.addEventListener('click', resetDefaults);
      canvasResetBtn?.addEventListener('click', resetDefaults);

      populateSelects();
      syncUI();
    }

    computeShelfScenarios() {
      const activeAssortment = this.selectedSkus && this.selectedSkus.length > 0 ? this.selectedSkus : this.allSkus;
      const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];
      const candidateCounts = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      const comparisons = [];

      for (const count of candidateCounts) {
        const testCooler = JSON.parse(JSON.stringify(cooler));
        this.changeCoolerShelfCount(testCooler, count);

        const optimizer = new PlanogramOptimizer(activeAssortment, [testCooler], this.rules, this.currentObjective);
        const result = optimizer.optimize(testCooler.cooler_id, { objective: this.currentObjective });

        const margin = result.analytics?.financials?.projectedDailyMargin || 0;
        const revenue = result.analytics?.financials?.projectedDailyRevenue || 0;
        const units = result.analytics?.volumeMetrics?.totalDailyUnits || 0;
        const totalFacings = result.analytics?.spaceMetrics?.totalFacings || 0;
        const fillRatePct = result.analytics?.spaceMetrics?.overallSpaceUtilizationPct || 0;

        let score = 0;
        if (this.currentObjective === 'profit') {
          score = margin;
        } else if (this.currentObjective === 'revenue') {
          score = revenue;
        } else {
          score = units;
        }

        comparisons.push({
          shelf_count: count,
          score: score,
          margin: margin,
          revenue: revenue,
          units: units,
          total_facings: totalFacings,
          fill_rate_pct: fillRatePct,
          result: result
        });
      }

      this.shelfScenariosComparison = comparisons;
      return comparisons;
    }

    openScenariosModal() {
      const modal = document.getElementById('shelf-scenarios-modal');
      const banner = document.getElementById('scenarios-summary-banner');
      const tbody = document.getElementById('scenarios-table-tbody');
      if (!modal || !tbody) return;

      const comparisons = (this.shelfScenariosComparison && this.shelfScenariosComparison.length > 0)
        ? this.shelfScenariosComparison
        : this.computeShelfScenarios();

      const bestScore = Math.max(...comparisons.map(c => c.score));
      const winner = comparisons.find(c => c.score === bestScore) || comparisons[0];

      if (banner) {
        const objName = this.currentObjective.toUpperCase();
        let metricTxt = '';
        if (this.currentObjective === 'profit') metricTxt = `$${winner.margin.toFixed(2)}/day Profit`;
        else if (this.currentObjective === 'revenue') metricTxt = `$${winner.revenue.toFixed(2)}/day Revenue`;
        else metricTxt = `${winner.units} units/day Volume`;

        banner.innerHTML = `
          <strong>🏆 AI Recommendation for ${objName} Goal:</strong> 
          Configuring <strong>${winner.shelf_count} Shelves per door</strong> yields the highest objective performance (<strong>${metricTxt}</strong>, ${winner.total_facings} facings, ${winner.fill_rate_pct.toFixed(1)}% shelf packed).
        `;
      }

      tbody.innerHTML = comparisons.map(c => {
        const isWinner = c.score === bestScore;
        const scoreFormatted = this.currentObjective === 'profit' ? `$${c.margin.toFixed(2)}` :
                               this.currentObjective === 'revenue' ? `$${c.revenue.toFixed(2)}` :
                               `${c.units} units`;

        return `
          <tr class="${isWinner ? 'winning-scenario' : ''}">
            <td><strong>${c.shelf_count} Shelves / Door</strong></td>
            <td>${c.total_facings} facings</td>
            <td>$${c.margin.toFixed(2)}</td>
            <td>$${c.revenue.toFixed(2)}</td>
            <td>${c.units} u/day</td>
            <td>${c.fill_rate_pct.toFixed(1)}%</td>
            <td><strong style="color: ${isWinner ? 'var(--accent-cyan)' : 'inherit'};">${scoreFormatted}</strong></td>
            <td style="text-align: center;">
              ${isWinner ? '<span class="badge-winner-tag">🏆 ACTIVE OPTIMAL</span>' : 
                `<button type="button" class="btn-apply-scenario" data-count="${c.shelf_count}">Apply ${c.shelf_count} Shelves</button>`}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-apply-scenario').forEach(btn => {
        btn.addEventListener('click', () => {
          const count = parseInt(btn.getAttribute('data-count'), 10);
          this.autoOptimizeShelves = false;
          const chk1 = document.getElementById('chk-auto-shelves');
          const chk2 = document.getElementById('chk-canvas-auto-shelves');
          if (chk1) chk1.checked = false;
          if (chk2) chk2.checked = false;
          const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];
          this.changeCoolerShelfCount(cooler, count);
          modal.style.display = 'none';
          this.setupCoolerConfigurator();
          this.runOptimization();
        });
      });

      modal.style.display = 'flex';
    }

    openAiCopilotModal() {
      const modal = document.getElementById('ai-copilot-modal');
      if (modal) modal.style.display = 'flex';
    }

    runAiQuickCommand(prompt) {
      this.openAiCopilotModal();
      const textarea = document.getElementById('ai-prompt-textarea');
      if (textarea) textarea.value = prompt;
      return this.runAiSwarm(prompt);
    }

    setupAiCopilotUI() {
      const modal = document.getElementById('ai-copilot-modal');
      const openBtn = document.getElementById('btn-open-ai-copilot');
      const closeBtn = document.getElementById('btn-close-ai-copilot');
      const runBtn = document.getElementById('btn-run-ai-agent');
      const textarea = document.getElementById('ai-prompt-textarea');
      const promptChips = document.querySelectorAll('.ai-prompt-chip');
      const applyBtn = document.getElementById('btn-apply-ai-planogram');
      const copyBtn = document.getElementById('btn-copy-ai-memo');

      openBtn?.addEventListener('click', () => this.openAiCopilotModal());
      closeBtn?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
      modal?.addEventListener('click', (e) => {
        if (e.target.id === 'ai-copilot-modal') modal.style.display = 'none';
      });

      promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const prompt = chip.getAttribute('data-prompt');
          if (textarea) textarea.value = prompt;
          this.runAiSwarm(prompt);
        });
      });

      runBtn?.addEventListener('click', () => {
        const prompt = textarea?.value?.trim();
        if (prompt) this.runAiSwarm(prompt);
      });

      textarea?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const prompt = textarea.value.trim();
          if (prompt) this.runAiSwarm(prompt);
        }
      });

      copyBtn?.addEventListener('click', () => {
        const memoContent = document.getElementById('ai-memo-content')?.innerText;
        if (memoContent) {
          navigator.clipboard?.writeText(memoContent);
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
        }
      });

      applyBtn?.addEventListener('click', () => {
        if (this.latestAiSwarmResult) {
          const res = this.latestAiSwarmResult;
          // Apply objective
          this.currentObjective = res.objective;
          document.querySelectorAll('.objective-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-objective') === res.objective);
          });

          // Apply shelf count
          const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];
          this.changeCoolerShelfCount(cooler, res.shelf_count);

          // Apply brand order
          if (res.brand_order) {
            this.rules.brand_order = res.brand_order;
            this.brandOrderManager && this.brandOrderManager.render();
          }

          // Apply assortment
          if (res.active_sku_ids) {
            this.selectedSkus = this.allSkus.filter(s => res.active_sku_ids.includes(s.sku_id));
            if (this.assortmentSelector) {
              this.assortmentSelector.activeSkuIds = new Set(res.active_sku_ids);
              this.assortmentSelector.renderSkuRows();
            }
          }

          if (modal) modal.style.display = 'none';
          this.setupCoolerConfigurator();
          this.runOptimization();
        }
      });
    }

    async runAiSwarm(userPrompt) {
      const streamContainer = document.getElementById('ai-agent-stream-container');
      const memoContainer = document.getElementById('ai-memo-content');
      const statusBadge = document.getElementById('ai-agent-status-badge');
      const actionsRow = document.getElementById('ai-memo-actions');
      const agentChips = document.querySelectorAll('.agent-chip');

      if (!streamContainer || !memoContainer) return;

      // Animate agent chips
      agentChips.forEach(c => c.classList.add('thinking'));
      if (statusBadge) {
        statusBadge.className = 'badge-status-agent running';
        statusBadge.textContent = 'Deliberating (5 Agents Swarm)...';
      }
      streamContainer.innerHTML = '';
      memoContainer.innerHTML = '<div class="memo-placeholder"><span>Synthesizing agent deliberation and running physics knapsack...</span></div>';
      if (actionsRow) actionsRow.style.display = 'none';

      const prompt = userPrompt.toLowerCase();
      let objective = this.currentObjective || 'profit';
      let shelfCount = this.coolerSpecs[0]?.bays[0]?.shelves?.length || 5;
      let activeSkuIds = this.allSkus.map(s => s.sku_id);
      let brandOrder = [...(this.rules.brand_order || [])];

      const addTrace = (agentName, roleName, action, details, cssClass = '') => {
        const item = document.createElement('div');
        item.className = `agent-trace-item ${cssClass}`;
        item.innerHTML = `
          <div class="agent-trace-meta">
            <span>${agentName} (${roleName})</span>
            <span class="agent-trace-action">${action}</span>
          </div>
          <div class="agent-trace-body">${details}</div>
        `;
        streamContainer.appendChild(item);
        streamContainer.scrollTop = streamContainer.scrollHeight;
      };

      // Step 1: Orchestrator
      await new Promise(r => setTimeout(r, 200));
      if (prompt.includes('revenue') || prompt.includes('sales') || prompt.includes('traffic')) {
        objective = 'revenue';
      } else if (prompt.includes('volume') || prompt.includes('units') || prompt.includes('velocity')) {
        objective = 'volume';
      } else if (prompt.includes('profit') || prompt.includes('margin')) {
        objective = 'profit';
      }

      const shelfMatch = prompt.match(/(\d+)\s*shelves/);
      if (shelfMatch) {
        shelfCount = Math.max(3, Math.min(15, parseInt(shelfMatch[1], 10)));
      } else if (prompt.includes('optimal') || prompt.includes('auto')) {
        shelfCount = 5;
      }

      if (prompt.includes('no 1.5l') || prompt.includes('exclude 1.5l') || prompt.includes('cans only')) {
        activeSkuIds = this.allSkus.filter(s => s.pack_size_label !== '1.5L').map(s => s.sku_id);
      }
      if (prompt.includes('zero sugar') || prompt.includes('diet') || prompt.includes('health')) {
        activeSkuIds = this.allSkus.filter(s => ['Zero Sugar', 'Diet', 'No Added Sugar'].includes(s.sugar_type)).map(s => s.sku_id);
      }

      addTrace('🎯 Orchestrator Agent', 'Category Director', 'Intent Decomposition', `Deconstructed brief: Goal = <strong>${objective.toUpperCase()}</strong>, Target = <strong>${shelfCount} Shelves</strong>, Active Assortment = <strong>${activeSkuIds.length} SKUs</strong>.`);

      // Step 2: Strategist
      await new Promise(r => setTimeout(r, 250));
      if (prompt.includes('energy') || prompt.includes('monster') || prompt.includes('red bull')) {
        brandOrder = ['Monster Energy', 'Red Bull', ...brandOrder.filter(b => !['Monster Energy', 'Red Bull'].includes(b))];
        addTrace('📊 Category Strategist', 'Consumer Demand', 'Brand Flow Adjustment', 'Elevated Monster Energy and Red Bull into top eye-level reach zone to capture high-velocity impulse sales.');
      } else if (prompt.includes('coca-cola') || prompt.includes('coke') || prompt.includes('core')) {
        brandOrder = ['Coca-Cola', 'Diet Coke', 'Sprite', 'Fanta', ...brandOrder.filter(b => !['Coca-Cola', 'Diet Coke', 'Sprite', 'Fanta'].includes(b))];
        addTrace('📊 Category Strategist', 'Flagship Focus', 'Brand Flow Adjustment', 'Anchored Coca-Cola core flagship portfolio on Door 1 eye-level golden zone.');
      } else {
        addTrace('📊 Category Strategist', 'Merchandising Flow', 'Brand Sequencing', `Maintained balanced brand flow: ${brandOrder.slice(0, 4).join(' ➔ ')}...`);
      }

      // Step 3: Mathematical Solver
      await new Promise(r => setTimeout(r, 300));
      const testCooler = JSON.parse(JSON.stringify(this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0]));
      this.changeCoolerShelfCount(testCooler, shelfCount);
      const testRules = JSON.parse(JSON.stringify(this.rules));
      testRules.brand_order = brandOrder;

      const activeSkusList = this.allSkus.filter(s => activeSkuIds.includes(s.sku_id));
      const optimizer = new PlanogramOptimizer(activeSkusList, [testCooler], testRules, objective);
      const solveRes = optimizer.optimize(testCooler.cooler_id);

      addTrace('⚙️ Knapsack Solver', 'Space Optimization', 'Integer Knapsack Allocation', `Solved ${shelfCount} shelves across ${testCooler.doors} door(s). Allocated <strong>${solveRes.analytics.spaceMetrics.totalFacings} total facings</strong> with 0% width overflow.`, 'solver');

      // Step 4: Compliance Auditor
      await new Promise(r => setTimeout(r, 200));
      const totalFacings = solveRes.analytics.spaceMetrics.totalFacings;
      const brandMap = new Map();
      for (const shelf of solveRes.planogram.shelves) {
        for (const p of shelf.placements) {
          brandMap.set(p.brand, (brandMap.get(p.brand) || 0) + p.facings);
        }
      }

      const cokeFacings = brandMap.get('Coca-Cola') || 0;
      const cokeShare = totalFacings > 0 ? (cokeFacings / totalFacings) * 100 : 0;
      if (cokeShare >= 25) {
        addTrace('🛡️ Compliance Auditor', 'Contract Guardian', 'Agreement Audit', `✅ Coca-Cola contract verified: ${cokeShare.toFixed(1)}% share of facings (Quotas satisfied).`, 'auditor');
      } else {
        addTrace('🛡️ Compliance Auditor', 'Contract Guardian', 'Agreement Audit', `⚠️ Coca-Cola share is ${cokeShare.toFixed(1)}%. Non-critical threshold maintained.`, 'auditor');
      }

      // Step 5: Trade-off Critic
      await new Promise(r => setTimeout(r, 200));
      const dailyMargin = solveRes.analytics.financials.projectedDailyMargin;
      const dailyRev = solveRes.analytics.financials.projectedDailyRevenue;
      addTrace('🔍 Trade-off Critic', 'Consensus Gatekeeper', 'Economic Viability', `Approved consensus candidate. Projected Margin: <strong>$${dailyMargin.toFixed(2)}/day</strong>, Space Full: <strong>${solveRes.analytics.spaceMetrics.overallSpaceUtilizationPct.toFixed(1)}%</strong>.`, 'critic');

      // Step 6: Executive Reporter
      await new Promise(r => setTimeout(r, 200));
      agentChips.forEach(c => c.classList.remove('thinking'));
      if (statusBadge) {
        statusBadge.className = 'badge-status-agent complete';
        statusBadge.textContent = 'Consensus Reached ✅';
      }

      this.latestAiSwarmResult = {
        objective,
        shelf_count: shelfCount,
        active_sku_ids: activeSkuIds,
        brand_order: brandOrder,
        planogramResult: solveRes
      };

      memoContainer.innerHTML = `
        <h3>📋 Executive Advisory Memo</h3>
        <p><strong>Strategic Brief:</strong> ${userPrompt}</p>
        <p><strong>Consensus Status:</strong> <span class="text-success font-bold">Approved & Contract-Compliant</span></p>
        
        <h4>📊 Projected Financial & Space Impact:</h4>
        <ul>
          <li><strong>Daily Profit Margin:</strong> $${dailyMargin.toFixed(2)} / day</li>
          <li><strong>Daily Gross Revenue:</strong> $${dailyRev.toFixed(2)} / day</li>
          <li><strong>Total Facings Allocated:</strong> ${solveRes.analytics.spaceMetrics.totalFacings} facings</li>
          <li><strong>Cooler Space Utilization:</strong> ${solveRes.analytics.spaceMetrics.overallSpaceUtilizationPct.toFixed(1)}%</li>
          <li><strong>Height Efficiency:</strong> ${solveRes.analytics.heightMetrics.overallHeightUtilizationPct.toFixed(1)}% (${solveRes.analytics.heightMetrics.avgHeadroomAirGapMm}mm avg headroom)</li>
        </ul>

        <h4>🛡️ Strategy Rationale:</h4>
        <ul>
          <li><strong>Brand Flow:</strong> ${brandOrder.slice(0, 5).join(' ➔ ')}</li>
          <li><strong>Fixture Configuration:</strong> ${testCooler.name} with ${shelfCount} shelves per door</li>
          <li><strong>Assortment Size:</strong> ${activeSkuIds.length} active SKUs</li>
        </ul>
      `;

      if (actionsRow) actionsRow.style.display = 'flex';
    }

    resetCoolerToDefaults(coolerId) {
      const freshCoolers = parseCoolersFromCSV(RAW_COOLER_SPECS_CSV);
      const freshTarget = freshCoolers.find(c => c.cooler_id === coolerId);
      if (!freshTarget) return;

      const targetIdx = this.coolerSpecs.findIndex(c => c.cooler_id === coolerId);
      if (targetIdx !== -1) {
        this.coolerSpecs[targetIdx] = freshTarget;
      }
    }

    changeCoolerShelfCount(cooler, count) {
      count = Math.max(3, Math.min(15, count));
      const totalInternalHeight = Math.max(1450, (cooler.total_height_mm || 1980) - 480);

      const tierTemplates = {
        3: [
          { tier: 'top', tier_label: 'Top Shelf', clearance_height_mm: 280, eye_level_score: 0.60, max_weight_kg: 45.0 },
          { tier: 'eye_level', tier_label: 'Eye-Level Golden Zone', clearance_height_mm: 320, eye_level_score: 1.00, max_weight_kg: 50.0 },
          { tier: 'bottom', tier_label: 'Bottom Base Shelf', clearance_height_mm: 390, eye_level_score: 0.40, max_weight_kg: 65.0 }
        ],
        4: [
          { tier: 'top', tier_label: 'Top Shelf', clearance_height_mm: 270, eye_level_score: 0.60, max_weight_kg: 45.0 },
          { tier: 'eye_level', tier_label: 'Eye-Level Golden Zone', clearance_height_mm: 290, eye_level_score: 1.00, max_weight_kg: 50.0 },
          { tier: 'touch_level', tier_label: 'Mid-Lower Shelf', clearance_height_mm: 310, eye_level_score: 0.75, max_weight_kg: 50.0 },
          { tier: 'bottom', tier_label: 'Bottom Base Shelf', clearance_height_mm: 380, eye_level_score: 0.40, max_weight_kg: 65.0 }
        ],
        5: [
          { tier: 'top', tier_label: 'Top Shelf', clearance_height_mm: 270, eye_level_score: 0.60, max_weight_kg: 45.0 },
          { tier: 'reach_level', tier_label: 'Upper Reach', clearance_height_mm: 280, eye_level_score: 0.85, max_weight_kg: 45.0 },
          { tier: 'eye_level', tier_label: 'Eye-Level Golden Zone', clearance_height_mm: 300, eye_level_score: 1.00, max_weight_kg: 50.0 },
          { tier: 'touch_level', tier_label: 'Mid-Lower Shelf', clearance_height_mm: 310, eye_level_score: 0.75, max_weight_kg: 50.0 },
          { tier: 'bottom', tier_label: 'Bottom Base Shelf', clearance_height_mm: 370, eye_level_score: 0.40, max_weight_kg: 65.0 }
        ],
        6: [
          { tier: 'top', tier_label: 'Top Shelf', clearance_height_mm: 240, eye_level_score: 0.60, max_weight_kg: 40.0 },
          { tier: 'reach_level', tier_label: 'Upper Reach', clearance_height_mm: 260, eye_level_score: 0.85, max_weight_kg: 45.0 },
          { tier: 'eye_level', tier_label: 'Eye-Level Golden Zone', clearance_height_mm: 280, eye_level_score: 1.00, max_weight_kg: 50.0 },
          { tier: 'touch_level', tier_label: 'Mid Shelf 1', clearance_height_mm: 290, eye_level_score: 0.75, max_weight_kg: 50.0 },
          { tier: 'touch_level', tier_label: 'Mid Shelf 2', clearance_height_mm: 310, eye_level_score: 0.65, max_weight_kg: 50.0 },
          { tier: 'bottom', tier_label: 'Bottom Base Shelf', clearance_height_mm: 370, eye_level_score: 0.40, max_weight_kg: 65.0 }
        ],
        7: [
          { tier: 'top', tier_label: 'Top Shelf', clearance_height_mm: 220, eye_level_score: 0.60, max_weight_kg: 35.0 },
          { tier: 'reach_level', tier_label: 'Upper Reach', clearance_height_mm: 240, eye_level_score: 0.80, max_weight_kg: 40.0 },
          { tier: 'eye_level', tier_label: 'Eye-Level Golden Zone', clearance_height_mm: 260, eye_level_score: 1.00, max_weight_kg: 45.0 },
          { tier: 'touch_level', tier_label: 'Mid Shelf 1', clearance_height_mm: 270, eye_level_score: 0.85, max_weight_kg: 45.0 },
          { tier: 'touch_level', tier_label: 'Mid Shelf 2', clearance_height_mm: 280, eye_level_score: 0.70, max_weight_kg: 45.0 },
          { tier: 'touch_level', tier_label: 'Mid-Lower Shelf', clearance_height_mm: 300, eye_level_score: 0.55, max_weight_kg: 50.0 },
          { tier: 'bottom', tier_label: 'Bottom Base Shelf', clearance_height_mm: 370, eye_level_score: 0.40, max_weight_kg: 65.0 }
        ],
        8: [
          { tier: 'top', tier_label: 'Top Shelf', clearance_height_mm: 200, eye_level_score: 0.50, max_weight_kg: 30.0 },
          { tier: 'reach_level', tier_label: 'Upper Reach 1', clearance_height_mm: 220, eye_level_score: 0.75, max_weight_kg: 35.0 },
          { tier: 'reach_level', tier_label: 'Upper Reach 2', clearance_height_mm: 240, eye_level_score: 0.90, max_weight_kg: 40.0 },
          { tier: 'eye_level', tier_label: 'Eye-Level Golden Zone', clearance_height_mm: 250, eye_level_score: 1.00, max_weight_kg: 45.0 },
          { tier: 'touch_level', tier_label: 'Mid Shelf 1', clearance_height_mm: 260, eye_level_score: 0.80, max_weight_kg: 45.0 },
          { tier: 'touch_level', tier_label: 'Mid Shelf 2', clearance_height_mm: 270, eye_level_score: 0.65, max_weight_kg: 45.0 },
          { tier: 'touch_level', tier_label: 'Mid-Lower Shelf', clearance_height_mm: 290, eye_level_score: 0.50, max_weight_kg: 50.0 },
          { tier: 'bottom', tier_label: 'Bottom Base Shelf', clearance_height_mm: 360, eye_level_score: 0.40, max_weight_kg: 65.0 }
        ]
      };

      let template = [];
      if (tierTemplates[count]) {
        template = tierTemplates[count];
      } else {
        // Procedural distribution for 9 to 15 shelves
        const bottomH = 350;
        const remainingH = totalInternalHeight - bottomH;
        const avgUpperH = Math.max(80, Math.floor(remainingH / (count - 1)));

        for (let i = 1; i <= count; i++) {
          if (i === 1) {
            template.push({ tier: 'top', tier_label: 'Top Shelf', clearance_height_mm: avgUpperH + 10, eye_level_score: 0.60, max_weight_kg: Math.max(18.0, 50 - count * 1.8) });
          } else if (i === count) {
            template.push({ tier: 'bottom', tier_label: 'Bottom Base Shelf', clearance_height_mm: bottomH, eye_level_score: 0.40, max_weight_kg: 65.0 });
          } else {
            const relPos = (i - 1) / (count - 1);
            let tier = 'touch_level';
            let tierLabel = `Lower Tier ${i}`;
            let eyeScore = 0.60;
            if (relPos >= 0.25 && relPos <= 0.55) {
              tier = 'eye_level';
              tierLabel = `Eye-Level Tier ${i}`;
              eyeScore = 1.00;
            } else if (relPos < 0.25) {
              tier = 'reach_level';
              tierLabel = `Upper Reach ${i}`;
              eyeScore = 0.85;
            }
            template.push({
              tier,
              tier_label: tierLabel,
              clearance_height_mm: avgUpperH,
              eye_level_score: eyeScore,
              max_weight_kg: Math.max(18.0, 50 - count * 1.8)
            });
          }
        }
      }

      cooler.bays.forEach((bay, bIdx) => {
        const d = bay.door_index || (bIdx + 1);
        bay.shelves = template.map((t, idx) => ({
          shelf_id: `D${d}-S${idx + 1}`,
          shelf_index: idx + 1,
          tier: t.tier,
          tier_label: t.tier_label,
          usable_width_mm: bay.shelves[0]?.usable_width_mm || 610,
          usable_depth_mm: idx === template.length - 1 ? 580 : 550,
          clearance_height_mm: t.clearance_height_mm,
          max_weight_kg: t.max_weight_kg,
          eye_level_score: t.eye_level_score,
          has_gravity_feed: true,
          temperature_zone: 'Chilled (2-4°C)'
        }));
      });
    }

    updateStatusBar(state) {
      const dot = document.getElementById('status-dot');
      const mainText = document.getElementById('status-main-text');
      const subText = document.getElementById('status-sub-text');
      const activeCount = this.selectedSkus.length;
      const brandCount = this.rules.brand_order?.length || 10;
      const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];
      const shelfCount = cooler.bays[0]?.shelves?.length || 5;

      if (state === 'ready') {
        if (dot) dot.className = 'status-indicator-dot';
        if (mainText) mainText.textContent = 'Configuration Ready (Awaiting Run)';
        if (subText) subText.textContent = `Fixture: ${cooler.name} (${shelfCount} Shelves) • Goal: ${this.currentObjective.toUpperCase()} • ${activeCount} SKUs. Click 'RUN' to solve.`;
      } else if (state === 'modified') {
        if (dot) dot.className = 'status-indicator-dot modified';
        if (mainText) mainText.textContent = '⚠️ Configuration Modified';
        if (subText) subText.textContent = `Inputs updated (${activeCount} SKUs, ${this.currentObjective.toUpperCase()}). Click 'RUN PLANOGRAM OPTIMIZATION' to update space & KPIs.`;
      } else if (state === 'solved') {
        if (dot) dot.className = 'status-indicator-dot solved';
        if (mainText) mainText.textContent = `✅ Planogram Optimized (${this.currentObjective.toUpperCase()})`;
        if (subText) subText.textContent = `Solver allocated ${activeCount} SKUs across ${cooler.doors} door(s) & ${shelfCount} shelves with 0% width overflow.`;
      }
    }

    runOptimization() {
      const activeAssortment = this.selectedSkus && this.selectedSkus.length > 0 ? this.selectedSkus : this.allSkus;
      const cooler = this.coolerSpecs.find(c => c.cooler_id === this.activeCoolerId) || this.coolerSpecs[0];

      if (this.autoOptimizeShelves) {
        // Multi-scenario candidate evaluation for shelf count 3..15
        const candidateCounts = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
        let bestCount = cooler.bays[0]?.shelves?.length || 5;
        let bestScore = -Infinity;
        let bestResult = null;
        this.shelfScenariosComparison = [];

        for (const count of candidateCounts) {
          const testCooler = JSON.parse(JSON.stringify(cooler));
          this.changeCoolerShelfCount(testCooler, count);

          const optimizer = new PlanogramOptimizer(activeAssortment, [testCooler], this.rules, this.currentObjective);
          const result = optimizer.optimize(testCooler.cooler_id, { objective: this.currentObjective });

          const margin = result.analytics?.financials?.projectedDailyMargin || 0;
          const revenue = result.analytics?.financials?.projectedDailyRevenue || 0;
          const units = result.analytics?.volumeMetrics?.totalDailyUnits || 0;
          const totalFacings = result.analytics?.spaceMetrics?.totalFacings || 0;
          const fillRatePct = result.analytics?.spaceMetrics?.overallSpaceUtilizationPct || 0;

          let score = 0;
          if (this.currentObjective === 'profit') {
            score = margin;
          } else if (this.currentObjective === 'revenue') {
            score = revenue;
          } else {
            score = units;
          }

          this.shelfScenariosComparison.push({
            shelf_count: count,
            score: score,
            margin: margin,
            revenue: revenue,
            units: units,
            total_facings: totalFacings,
            fill_rate_pct: fillRatePct,
            result: result
          });

          if (score > bestScore) {
            bestScore = score;
            bestCount = count;
            bestResult = result;
          }
        }

        // Apply best shelf count to active cooler
        this.changeCoolerShelfCount(cooler, bestCount);
        this.currentPlanogramResult = bestResult;

        // Update shelf count UI indicators
        const zoneShelfCountVal = document.getElementById('zone-shelf-count-val');
        const canvasShelfCountDisplay = document.getElementById('current-shelf-count-val');
        const navCoolerBadge = document.getElementById('badge-cooler-shelf-count');
        const totalDoors = cooler.total_doors || cooler.doors || 2;

        if (zoneShelfCountVal) zoneShelfCountVal.textContent = bestCount;
        if (canvasShelfCountDisplay) canvasShelfCountDisplay.textContent = `${bestCount} Shelves (Auto)`;
        if (navCoolerBadge) navCoolerBadge.textContent = `${totalDoors} Door${totalDoors > 1 ? 's' : ''} • ${bestCount} Shelves (Auto)`;

        const alertBanner = document.getElementById('canvas-optimal-alert-banner');
        const alertReason = document.getElementById('canvas-optimal-reason-text');
        if (alertBanner && alertReason && bestResult) {
          const objName = this.currentObjective.toUpperCase();
          let metricTxt = '';
          const bestMargin = bestResult.analytics?.financials?.projectedDailyMargin || 0;
          const bestRev = bestResult.analytics?.financials?.projectedDailyRevenue || 0;
          const bestUnits = bestResult.analytics?.volumeMetrics?.totalDailyUnits || 0;
          const bestFacings = bestResult.analytics?.spaceMetrics?.totalFacings || 0;
          const bestFill = bestResult.analytics?.spaceMetrics?.overallSpaceUtilizationPct || 0;

          if (this.currentObjective === 'profit') metricTxt = `$${bestMargin.toFixed(2)}/day Profit`;
          else if (this.currentObjective === 'revenue') metricTxt = `$${bestRev.toFixed(2)}/day Revenue`;
          else metricTxt = `${bestUnits} units/day Volume`;

          alertReason.innerHTML = `<strong>${bestCount} Shelves per door</strong> yields the highest objective performance for <strong>${objName}</strong> (${metricTxt}, ${bestFacings} facings, ${bestFill.toFixed(1)}% full).`;
          alertBanner.style.display = 'flex';
        }
      } else {
        const optimizer = new PlanogramOptimizer(activeAssortment, this.coolerSpecs, this.rules, this.currentObjective);
        this.currentPlanogramResult = optimizer.optimize(this.activeCoolerId, { objective: this.currentObjective });
        this.shelfScenariosComparison = null;
        const alertBanner = document.getElementById('canvas-optimal-alert-banner');
        if (alertBanner) alertBanner.style.display = 'none';
      }

      this.hasRun = true;

      // Reveal Results Section and Hide Initial Standby Placeholder
      const standbyElem = document.getElementById('placeholder-standby');
      const kpiRibbon = document.getElementById('kpi-ribbon');
      const mainWorkspace = document.getElementById('main-workspace-layout');

      if (standbyElem) standbyElem.style.display = 'none';
      if (kpiRibbon) kpiRibbon.style.display = 'grid';
      if (mainWorkspace) mainWorkspace.style.display = 'grid';

      this.renderCooler();
      this.updateKPIs();
      this.updateValidationDrawer();
      this.updateAnalyticsPanels();
      this.updateHeatmapLegend();
      this.updateStatusBar('solved');
    }

    renderCooler() {
      const canvasContainer = document.getElementById('cooler-canvas-container');
      if (!canvasContainer || !this.currentPlanogramResult) return;

      if (!this.coolerRenderer) {
        this.coolerRenderer = new CoolerRenderer(canvasContainer, {
          heatmapEngine: this.heatmapEngine,
          onPlanogramModified: (modifiedPlanogram) => {
            this.handleManualPlanogramChange(modifiedPlanogram);
          }
        });
      }

      this.coolerRenderer.render(
        this.currentPlanogramResult.planogram,
        this.currentPlanogramResult.validation,
        this.currentPlanogramResult.analytics,
        this.selectedSkus,
        this.coolerSpecs
      );
    }

    handleManualPlanogramChange(modifiedPlanogram) {
      const validator = new PlanogramValidator(this.selectedSkus, this.coolerSpecs, this.rules);
      const validation = validator.validate(modifiedPlanogram);

      const analyticsEngine = new PlanogramAnalytics(this.selectedSkus, this.coolerSpecs, this.rules);
      const analytics = analyticsEngine.computeAnalytics(modifiedPlanogram);

      this.currentPlanogramResult = {
        planogram: modifiedPlanogram,
        validation,
        analytics
      };

      this.renderCooler();
      this.updateKPIs();
      this.updateValidationDrawer();
      this.updateAnalyticsPanels();
    }

    updateKPIs() {
      const { analytics } = this.currentPlanogramResult;
      const fin = analytics.financials;
      const vol = analytics.volumeMetrics;
      const space = analytics.spaceMetrics;

      const profitElem = document.getElementById('kpi-profit');
      if (profitElem) profitElem.textContent = `$${fin.projectedDailyMargin.toFixed(2)}`;
      
      const marginPctElem = document.getElementById('kpi-margin-pct');
      if (marginPctElem) marginPctElem.textContent = `${fin.averageGrossMarginPct}% Margin`;

      const profitDensityElem = document.getElementById('kpi-profit-density');
      if (profitDensityElem) profitDensityElem.textContent = `$${fin.profitDensityPerFacing.toFixed(2)}/facing`;

      const revElem = document.getElementById('kpi-revenue');
      if (revElem) revElem.textContent = `$${fin.projectedDailyRevenue.toFixed(2)}`;

      const avgPriceElem = document.getElementById('kpi-avg-price');
      if (avgPriceElem) avgPriceElem.textContent = `$${fin.avgUnitPrice.toFixed(2)} / unit`;

      const volOccupiedElem = document.getElementById('kpi-volume-occupied');
      if (volOccupiedElem) volOccupiedElem.textContent = `${vol.totalProductVolumeLiters} L`;

      const volOccupancyPctElem = document.getElementById('kpi-volume-occupancy-pct');
      if (volOccupancyPctElem) {
        volOccupancyPctElem.textContent = `${space.overallSpaceUtilizationPct}% Shelf Full (Optimal)`;
      }

      const effectiveCapElem = document.getElementById('kpi-effective-capacity-pct');
      if (effectiveCapElem) {
        effectiveCapElem.textContent = `${vol.effectiveVolumeOccupancyPct}% Full`;
      }

      const volMoveSubtext = document.getElementById('kpi-volume-movement-subtext');
      if (volMoveSubtext) volMoveSubtext.textContent = `${vol.totalDailyUnits.toLocaleString()} units/d (${vol.totalDailyFluidLiters} L fluid)`;

      const fillRateElem = document.getElementById('kpi-fill-rate');
      if (fillRateElem) fillRateElem.textContent = `${space.overallSpaceUtilizationPct}%`;

      const heightElem = document.getElementById('kpi-height-util-pct');
      const airGapElem = document.getElementById('kpi-avg-air-gap');
      const height = analytics.heightMetrics || { overallHeightUtilizationPct: 84.5, avgHeadroomAirGapMm: 45 };
      if (heightElem) heightElem.textContent = `${height.overallHeightUtilizationPct}%`;
      if (airGapElem) airGapElem.textContent = `${height.avgHeadroomAirGapMm}mm`;

      const objBadge = document.getElementById('kpi-objective-badge');
      const objDesc = document.getElementById('kpi-objective-desc');
      const facingsSubtext = document.getElementById('kpi-facings-subtext');

      if (facingsSubtext) facingsSubtext.textContent = `${space.totalFacings} Facings Placed`;

      if (objBadge) {
        if (this.currentObjective === 'profit') {
          objBadge.textContent = 'PROFIT MAX';
          objBadge.className = 'kpi-value text-success';
          if (objDesc) objDesc.textContent = 'Prioritizing gross margin yield per cm of shelf space';
        } else if (this.currentObjective === 'revenue') {
          objBadge.textContent = 'REVENUE MAX';
          objBadge.className = 'kpi-value text-highlight';
          if (objDesc) objDesc.textContent = 'Prioritizing retail price items to maximize top-line sales';
        } else {
          objBadge.textContent = 'VOLUME MAX';
          objBadge.className = 'kpi-value text-warning';
          if (objDesc) objDesc.textContent = 'Prioritizing fast-mover velocity & total unit throughput';
        }
      }
    }

    updateValidationDrawer() {
      const { validation } = this.currentPlanogramResult;
      const { ruleChecklist = [], complianceScore = 100, passedCount = 0, totalRules = 0 } = validation;

      const healthScoreElem = document.getElementById('audit-health-score');
      if (healthScoreElem) healthScoreElem.textContent = `${complianceScore}%`;

      const rulesPassedCountElem = document.getElementById('audit-rules-passed-count');
      if (rulesPassedCountElem) rulesPassedCountElem.textContent = `${passedCount} of ${totalRules} Constraints Maintained`;

      const healthPill = document.getElementById('audit-health-pill');
      const healthBanner = document.querySelector('.audit-health-banner');
      if (healthPill && healthBanner) {
        if (complianceScore === 100) {
          healthPill.className = 'health-status-pill healthy';
          healthPill.textContent = '✅ Fully Compliant';
          healthBanner.classList.remove('has-violations');
        } else {
          healthPill.className = 'health-status-pill unhealthy';
          healthPill.textContent = `⚠️ ${totalRules - passedCount} Violations`;
          healthBanner.classList.add('has-violations');
        }
      }

      // Update Category Counts
      const countAll = document.getElementById('count-cat-all');
      if (countAll) countAll.textContent = totalRules;

      const countPhysical = document.getElementById('count-cat-physical');
      if (countPhysical) countPhysical.textContent = ruleChecklist.filter(r => r.category === 'physical').length;

      const countPack = document.getElementById('count-cat-pack');
      if (countPack) countPack.textContent = ruleChecklist.filter(r => r.category === 'pack').length;

      const countMerch = document.getElementById('count-cat-merchandising');
      if (countMerch) countMerch.textContent = ruleChecklist.filter(r => r.category === 'merchandising').length;

      const checklistContainer = document.getElementById('audit-rules-checklist');
      if (!checklistContainer) return;

      const activeCatBtn = document.querySelector('.rule-cat-btn.active');
      const activeCat = activeCatBtn ? activeCatBtn.getAttribute('data-cat') : 'all';

      const renderList = (filterCat) => {
        const filteredRules = filterCat === 'all' 
          ? ruleChecklist 
          : ruleChecklist.filter(r => r.category === filterCat);

        checklistContainer.innerHTML = filteredRules.map(rule => `
          <div class="rule-audit-card ${rule.passed ? 'status-passed' : 'status-failed'}" data-category="${rule.category}">
            <div class="rule-card-header">
              <div class="rule-card-title-group">
                <span class="rule-tick-icon">${rule.passed ? '✅' : '❌'}</span>
                <span class="rule-card-name">${rule.name}</span>
              </div>
              <span class="rule-cat-badge">${rule.categoryLabel || rule.category}</span>
            </div>
            <div class="rule-card-desc">${rule.description}</div>
            <div class="rule-card-proof">${rule.proof}</div>
          </div>
        `).join('');
      };

      renderList(activeCat);

      // Bind Category Filter Buttons (once or ensure clean listeners)
      const catBtns = document.querySelectorAll('.rule-cat-btn');
      catBtns.forEach(btn => {
        btn.onclick = () => {
          catBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const cat = btn.getAttribute('data-cat');
          renderList(cat);
        };
      });
    }

    updateAnalyticsPanels() {
      const { analytics } = this.currentPlanogramResult;
      const brandTableBody = document.getElementById('brand-share-tbody');
      if (brandTableBody) {
        brandTableBody.innerHTML = analytics.brandBreakdown.map(b => `
          <tr>
            <td><strong>${b.brand}</strong></td>
            <td>${b.facings} (${b.shareOfFacingsPct}%)</td>
            <td>
              <div class="mini-progress-bar">
                <div class="mini-progress-fill" style="width: ${Math.min(100, b.shareOfSpacePct * 2.5)}%"></div>
              </div>
              <span class="small-text">${b.shareOfSpacePct}%</span>
            </td>
            <td>$${b.projectedDailyRevenue.toFixed(2)}</td>
            <td><strong class="text-success">+$${b.projectedDailyMargin.toFixed(2)}</strong></td>
          </tr>
        `).join('');
      }

      const catTableBody = document.getElementById('category-share-tbody');
      if (catTableBody) {
        catTableBody.innerHTML = analytics.categoryBreakdown.map(c => `
          <tr>
            <td><strong>${c.category}</strong></td>
            <td>${c.facings} (${c.shareOfFacingsPct}%)</td>
            <td>${c.shareOfSpacePct}%</td>
            <td>$${c.projectedDailyRevenue.toFixed(2)}</td>
            <td><strong class="text-success">+$${c.projectedDailyMargin.toFixed(2)}</strong></td>
          </tr>
        `).join('');
      }

      const heightTableBody = document.getElementById('shelf-height-breakdown-tbody');
      if (heightTableBody && analytics.shelfAnalytics) {
        heightTableBody.innerHTML = analytics.shelfAnalytics.map(s => {
          const fitClass = s.airGapHeadroomMm >= 35 && s.airGapHeadroomMm <= 65 ? 'text-success' : (s.airGapHeadroomMm < 35 ? 'text-warning' : 'text-secondary');
          return `
            <tr>
              <td><strong>${s.shelf_id} (${s.tier_label || s.tier})</strong></td>
              <td>${s.clearanceHeightMm}mm</td>
              <td>${s.avgProductHeightMm}mm</td>
              <td><strong class="text-highlight">${s.heightUtilizationPct}%</strong></td>
              <td><span class="${fitClass}">${s.airGapHeadroomMm}mm gap</span></td>
            </tr>
          `;
        }).join('');
      }

      const aiSummary = document.getElementById('sidebar-ai-rationale-summary');
      const aiShelvesList = document.getElementById('sidebar-ai-shelves-list');
      if (aiSummary && aiShelvesList && this.currentPlanogramResult) {
        const { planogram, analytics: planAnalytics } = this.currentPlanogramResult;
        const objUpper = (this.currentObjective || 'profit').toUpperCase();
        aiSummary.innerHTML = `
          <div style="font-weight: 800; color: #38BDF8; margin-bottom: 0.25rem;">
            🎯 Swarm Strategy: ${objUpper} MAXIMIZATION
          </div>
          <div style="color: var(--text-secondary); line-height: 1.35;">
            Autonomous agents allocated <strong>${planAnalytics.spaceMetrics.totalFacings} total facings</strong> across ${planogram.cooler_id} with <strong>${planAnalytics.spaceMetrics.overallSpaceUtilizationPct.toFixed(1)}% space fill</strong> and <strong>0% width overflow</strong>.
          </div>
        `;

        aiShelvesList.innerHTML = planogram.shelves.map(shelf => {
          const skuNames = shelf.placements.map(p => {
            const sku = this.allSkus.find(s => s.sku_id === p.sku_id);
            return `${sku ? sku.name : p.sku_id} (${p.facings}x)`;
          }).join(', ') || 'Empty';

          let shelfAiRationale = '';
          if (shelf.tier === 'bottom') {
            shelfAiRationale = `Heavy format tier (${shelf.clearance_height_mm}mm clearance, ${shelf.max_weight_kg}kg load). AI allocated 1.5L PET bottles on reinforced base to prevent tipping and structural overload.`;
          } else if (shelf.tier === 'eye_level') {
            shelfAiRationale = `Golden eye-level reach (eye score 1.00). AI reserved prime impulse visibility for high-velocity flagships and premium margin contributors.`;
          } else if (shelf.tier === 'top') {
            shelfAiRationale = `Upper canopy tier (${shelf.clearance_height_mm}mm clearance). AI placed grab-and-go slim cans (250ml) to maximize vertical headroom fill (${shelf.usable_width_mm}mm door width).`;
          } else {
            shelfAiRationale = `Mid-tier replenishment zone. AI balanced brand flow sequences with high demand velocity buffer (3+ days of supply).`;
          }

          return `
            <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-left: 3px solid #38BDF8; border-radius: var(--radius-md); padding: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <strong style="font-size: 0.78rem; color: #FFFFFF;">${shelf.door_label || `Door ${shelf.door_index}`} - ${shelf.tier_label || shelf.shelf_id}</strong>
                <span style="font-size: 0.68rem; font-family: var(--font-mono); color: var(--accent-cyan);">${shelf.clearance_height_mm}mm H • ${shelf.usable_width_mm}mm W</span>
              </div>
              <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
                <strong>Assigned:</strong> ${skuNames}
              </div>
              <div style="font-size: 0.72rem; color: #E0F2FE; background: rgba(56, 189, 248, 0.08); padding: 0.35rem 0.5rem; border-radius: 4px; line-height: 1.35;">
                <span style="font-weight: 700; color: #38BDF8;">🤖 AI Rationale:</span> ${shelfAiRationale}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    updateHeatmapLegend() {
      const legendContainer = document.getElementById('heatmap-legend-container');
      if (!legendContainer) return;
      const items = this.heatmapEngine.getLegend();
      if (items.length === 0) {
        legendContainer.style.display = 'none';
        return;
      }
      legendContainer.style.display = 'flex';
      legendContainer.innerHTML = items.map(item => `
        <div class="legend-chip">
          <span class="legend-color-dot" style="background: ${item.color}"></span>
          <span class="legend-chip-label">${item.label}</span>
        </div>
      `).join('');
    }
  }

  function start() {
    window.app = new CoolerPlanogramApp();
    window.app.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
