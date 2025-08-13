/**
 * Item System - Core item definitions and management
 * Comprehensive item system with procedural generation and 16-bit pixel art
 */

import { Logger } from '@utils/Logger';
import { Color, Renderer } from '@core/Renderer';

export enum ItemType {
    Resource = 'resource',
    Component = 'component',
    Equipment = 'equipment',
    Weapon = 'weapon',
    Tool = 'tool',
    Consumable = 'consumable',
    Blueprint = 'blueprint',
    Artifact = 'artifact'
}

export enum ItemRarity {
    Common = 'common',
    Uncommon = 'uncommon',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary',
    Artifact = 'artifact'
}

export enum ItemCategory {
    // Resources
    Metal = 'metal',
    Crystal = 'crystal',
    Gas = 'gas',
    Biological = 'biological',
    Energy = 'energy',
    Exotic = 'exotic',
    
    // Equipment
    Engine = 'engine',
    Shield = 'shield',
    Reactor = 'reactor',
    Scanner = 'scanner',
    WarpCore = 'warp_core',
    
    // Weapons
    Projectile = 'projectile',
    EnergyWeapon = 'energy_weapon',
    Missile = 'missile',
    
    // Tools
    Mining = 'mining',
    Repair = 'repair',
    Research = 'research'
}

export interface ItemStats {
    // Base properties
    mass: number;
    volume: number;
    durability?: number; // For equipment/tools
    maxStack: number;
    
    // Equipment stats
    power?: number;
    efficiency?: number;
    range?: number;
    damage?: number;
    defense?: number;
    
    // Resource/component stats
    purity?: number; // 0-1
    stability?: number; // 0-1
    radioactivity?: number; // 0-1
}

export interface ItemRecipe {
    id: string;
    requiredItems: { [itemId: string]: number };
    requiredTech?: string[];
    craftingTime: number; // seconds
    energyCost: number;
    successRate: number; // 0-1
}

export interface ItemSprite {
    width: number;
    height: number;
    pixels: Color[][]; // 2D array of colors for 16-bit sprite
}

export interface GameItem {
    id: string;
    name: string;
    description: string;
    type: ItemType;
    category: ItemCategory;
    rarity: ItemRarity;
    
    // Visual
    sprite: ItemSprite;
    iconColor: Color;
    
    // Properties
    stats: ItemStats;
    
    // Crafting
    recipe?: ItemRecipe;
    
    // Special properties
    isUnique: boolean;
    isTradeable: boolean;
    isConsumable: boolean;
    
    // Lore
    loreText?: string;
    discoveredBy?: string;
    discoveryDate?: number;
}

export interface ItemStack {
    item: GameItem;
    quantity: number;
    condition?: number; // 0-1 for equipment durability
    modifiers?: { [key: string]: number }; // Special modifiers
}

export class ItemDatabase {
    private items: Map<string, GameItem> = new Map();
    private recipes: Map<string, ItemRecipe> = new Map();
    private categories: Map<ItemCategory, GameItem[]> = new Map();
    
    private logger: Logger;

    constructor() {
        this.logger = new Logger('ItemDatabase');
        this.initializeDatabase();
        this.logger.info('📦 Item database initialized', {
            totalItems: this.items.size,
            categories: this.categories.size
        });
    }

    /**
     * Initialize the item database with base items
     */
    private initializeDatabase(): void {
        // Generate base resources
        this.generateResources();
        
        // Generate components
        this.generateComponents();
        
        // Generate equipment
        this.generateEquipment();
        
        // Generate weapons
        this.generateWeapons();
        
        // Generate tools
        this.generateTools();
        
        // Generate consumables
        this.generateConsumables();
        
        // Generate blueprints
        this.generateBlueprints();
        
        // Generate artifacts
        this.generateArtifacts();
    }

    /**
     * Generate base resources
     */
    private generateResources(): void {
        const resources = [
            {
                id: 'metal_iron',
                name: 'Iron Ore',
                description: 'Common metallic ore found throughout the galaxy.',
                category: ItemCategory.Metal,
                rarity: ItemRarity.Common,
                stats: { mass: 1, volume: 1, maxStack: 1000, purity: 0.7 },
                color: { r: 48, g: 32, b: 24 }
            },
            {
                id: 'metal_titanium',
                name: 'Titanium',
                description: 'Lightweight, durable metal used in ship construction.',
                category: ItemCategory.Metal,
                rarity: ItemRarity.Uncommon,
                stats: { mass: 0.8, volume: 1, maxStack: 500, purity: 0.85 },
                color: { r: 64, g: 64, b: 64 }
            },
            {
                id: 'crystal_quartz',
                name: 'Quartz Crystal',
                description: 'Common crystalline structure with electronic properties.',
                category: ItemCategory.Crystal,
                rarity: ItemRarity.Common,
                stats: { mass: 0.5, volume: 1, maxStack: 200, purity: 0.6 },
                color: { r: 48, g: 48, b: 56 }
            },
            {
                id: 'crystal_dilithium',
                name: 'Dilithium Crystal',
                description: 'Rare crystal essential for warp core regulation.',
                category: ItemCategory.Crystal,
                rarity: ItemRarity.Rare,
                stats: { mass: 0.3, volume: 1, maxStack: 50, purity: 0.9, radioactivity: 0.3 },
                color: { r: 32, g: 48, b: 32 }
            },
            {
                id: 'gas_hydrogen',
                name: 'Hydrogen',
                description: 'Common gas used for fuel and life support.',
                category: ItemCategory.Gas,
                rarity: ItemRarity.Common,
                stats: { mass: 0.1, volume: 2, maxStack: 2000, purity: 0.8 },
                color: { r: 32, g: 40, b: 48 }
            },
            {
                id: 'bio_protein',
                name: 'Protein Compounds',
                description: 'Organic compounds essential for life support systems.',
                category: ItemCategory.Biological,
                rarity: ItemRarity.Uncommon,
                stats: { mass: 0.5, volume: 1, maxStack: 100, stability: 0.7 },
                color: { r: 40, g: 48, b: 32 }
            },
            {
                id: 'energy_antimatter',
                name: 'Antimatter',
                description: 'Extremely dangerous but powerful energy source.',
                category: ItemCategory.Energy,
                rarity: ItemRarity.Epic,
                stats: { mass: 0.01, volume: 1, maxStack: 10, radioactivity: 0.9, stability: 0.3 },
                color: { r: 48, g: 24, b: 72 }
            }
        ];

        resources.forEach(res => {
            const item = this.createItem({
                id: res.id,
                name: res.name,
                description: res.description,
                type: ItemType.Resource,
                category: res.category,
                rarity: res.rarity,
                stats: res.stats,
                iconColor: res.color,
                isUnique: false,
                isTradeable: true,
                isConsumable: false
            });
            this.addItem(item);
        });
    }

    /**
     * Generate ship components
     */
    private generateComponents(): void {
        const components = [
            {
                id: 'comp_circuit',
                name: 'Circuit Board',
                description: 'Basic electronic component for ship systems.',
                category: ItemCategory.Engine,
                rarity: ItemRarity.Common,
                stats: { mass: 0.2, volume: 1, maxStack: 100, durability: 0.9 },
                color: { r: 24, g: 48, b: 24 }
            },
            {
                id: 'comp_plasma_conduit',
                name: 'Plasma Conduit',
                description: 'Advanced conduit for energy distribution systems.',
                category: ItemCategory.Reactor,
                rarity: ItemRarity.Rare,
                stats: { mass: 2, volume: 1, maxStack: 20, power: 150, efficiency: 0.85 },
                color: { r: 64, g: 32, b: 16 }
            },
            {
                id: 'comp_shield_emitter',
                name: 'Shield Emitter',
                description: 'Generates protective energy barriers around the ship.',
                category: ItemCategory.Shield,
                rarity: ItemRarity.Uncommon,
                stats: { mass: 1.5, volume: 1, maxStack: 50, defense: 100, efficiency: 0.75 },
                color: { r: 16, g: 32, b: 48 }
            }
        ];

        components.forEach(comp => {
            const item = this.createItem({
                id: comp.id,
                name: comp.name,
                description: comp.description,
                type: ItemType.Component,
                category: comp.category,
                rarity: comp.rarity,
                stats: comp.stats,
                iconColor: comp.color,
                isUnique: false,
                isTradeable: true,
                isConsumable: false
            });
            this.addItem(item);
        });
    }

    /**
     * Generate equipment items
     */
    private generateEquipment(): void {
        const equipment = [
            {
                id: 'eq_engine_basic',
                name: 'Basic Thruster',
                description: 'Standard propulsion system for small vessels.',
                category: ItemCategory.Engine,
                rarity: ItemRarity.Common,
                stats: { mass: 10, volume: 4, maxStack: 1, power: 100, efficiency: 0.6 },
                color: { r: 48, g: 48, b: 48 }
            },
            {
                id: 'eq_shield_mk2',
                name: 'Shield Generator Mk.II',
                description: 'Improved shield generation system.',
                category: ItemCategory.Shield,
                rarity: ItemRarity.Uncommon,
                stats: { mass: 8, volume: 3, maxStack: 1, defense: 200, efficiency: 0.8 },
                color: { r: 16, g: 40, b: 32 }
            },
            {
                id: 'eq_warp_core',
                name: 'Warp Core',
                description: 'Essential component for faster-than-light travel.',
                category: ItemCategory.WarpCore,
                rarity: ItemRarity.Epic,
                stats: { mass: 20, volume: 8, maxStack: 1, power: 500, efficiency: 0.9 },
                color: { r: 48, g: 24, b: 72 }
            }
        ];

        equipment.forEach(eq => {
            const item = this.createItem({
                id: eq.id,
                name: eq.name,
                description: eq.description,
                type: ItemType.Equipment,
                category: eq.category,
                rarity: eq.rarity,
                stats: eq.stats,
                iconColor: eq.color,
                isUnique: false,
                isTradeable: true,
                isConsumable: false
            });
            this.addItem(item);
        });
    }

    /**
     * Generate weapons
     */
    private generateWeapons(): void {
        const weapons = [
            {
                id: 'wp_laser_basic',
                name: 'Basic Laser Cannon',
                description: 'Standard energy weapon for ship defense.',
                category: ItemCategory.Energy,
                rarity: ItemRarity.Common,
                stats: { mass: 5, volume: 2, maxStack: 1, damage: 50, range: 200 },
                color: { r: 72, g: 24, b: 24 }
            },
            {
                id: 'wp_railgun',
                name: 'Magnetic Railgun',
                description: 'High-velocity projectile weapon system.',
                category: ItemCategory.Projectile,
                rarity: ItemRarity.Rare,
                stats: { mass: 12, volume: 4, maxStack: 1, damage: 150, range: 400 },
                color: { r: 64, g: 64, b: 32 }
            }
        ];

        weapons.forEach(wp => {
            const item = this.createItem({
                id: wp.id,
                name: wp.name,
                description: wp.description,
                type: ItemType.Weapon,
                category: wp.category,
                rarity: wp.rarity,
                stats: wp.stats,
                iconColor: wp.color,
                isUnique: false,
                isTradeable: true,
                isConsumable: false
            });
            this.addItem(item);
        });
    }

    /**
     * Generate tools
     */
    private generateTools(): void {
        const tools = [
            {
                id: 'tool_mining_drill',
                name: 'Mining Drill',
                description: 'Automated mining equipment for resource extraction.',
                category: ItemCategory.Mining,
                rarity: ItemRarity.Uncommon,
                stats: { mass: 3, volume: 2, maxStack: 1, efficiency: 0.8, durability: 0.9 },
                color: { r: 96, g: 64, b: 16 }
            },
            {
                id: 'tool_repair_kit',
                name: 'Repair Kit',
                description: 'Emergency repair tools and materials.',
                category: ItemCategory.Repair,
                rarity: ItemRarity.Common,
                stats: { mass: 1, volume: 1, maxStack: 10, efficiency: 0.6 },
                color: { r: 48, g: 48, b: 32 }
            }
        ];

        tools.forEach(tool => {
            const item = this.createItem({
                id: tool.id,
                name: tool.name,
                description: tool.description,
                type: ItemType.Tool,
                category: tool.category,
                rarity: tool.rarity,
                stats: tool.stats,
                iconColor: tool.color,
                isUnique: false,
                isTradeable: true,
                isConsumable: false
            });
            this.addItem(item);
        });
    }

    /**
     * Generate consumables
     */
    private generateConsumables(): void {
        const consumables = [
            {
                id: 'cons_energy_cell',
                name: 'Energy Cell',
                description: 'Portable power source for emergency systems.',
                rarity: ItemRarity.Common,
                stats: { mass: 0.5, volume: 1, maxStack: 50, power: 100 },
                color: { r: 32, g: 80, b: 64 }
            },
            {
                id: 'cons_nanobots',
                name: 'Repair Nanobots',
                description: 'Microscopic robots that repair ship damage.',
                rarity: ItemRarity.Rare,
                stats: { mass: 0.1, volume: 1, maxStack: 20, efficiency: 0.9 },
                color: { r: 48, g: 24, b: 72 }
            }
        ];

        consumables.forEach(cons => {
            const item = this.createItem({
                id: cons.id,
                name: cons.name,
                description: cons.description,
                type: ItemType.Consumable,
                category: ItemCategory.Energy,
                rarity: cons.rarity,
                stats: cons.stats,
                iconColor: cons.color,
                isUnique: false,
                isTradeable: true,
                isConsumable: true
            });
            this.addItem(item);
        });
    }

    /**
     * Generate blueprints
     */
    private generateBlueprints(): void {
        const blueprints = [
            {
                id: 'bp_engine_advanced',
                name: 'Advanced Engine Blueprint',
                description: 'Schematic for constructing high-efficiency thrusters.',
                rarity: ItemRarity.Rare,
                color: { r: 32, g: 48, b: 32 }
            },
            {
                id: 'bp_warp_upgrade',
                name: 'Warp Core Upgrade Blueprint',
                description: 'Plans for enhancing warp drive capabilities.',
                rarity: ItemRarity.Epic,
                color: { r: 48, g: 24, b: 72 }
            }
        ];

        blueprints.forEach(bp => {
            const item = this.createItem({
                id: bp.id,
                name: bp.name,
                description: bp.description,
                type: ItemType.Blueprint,
                category: ItemCategory.Engine,
                rarity: bp.rarity,
                stats: { mass: 0.1, volume: 1, maxStack: 1 },
                iconColor: bp.color,
                isUnique: false,
                isTradeable: true,
                isConsumable: false
            });
            this.addItem(item);
        });
    }

    /**
     * Generate rare artifacts
     */
    private generateArtifacts(): void {
        const artifacts = [
            {
                id: 'art_precursor_relic',
                name: 'Precursor Data Core',
                description: 'Ancient technology from a lost civilization.',
                rarity: ItemRarity.Artifact,
                stats: { mass: 1, volume: 1, maxStack: 1, radioactivity: 0.5 },
                color: { r: 64, g: 32, b: 96 },
                lore: 'This mysterious device contains fragments of knowledge from a species that vanished eons ago.'
            }
        ];

        artifacts.forEach(art => {
            const item = this.createItem({
                id: art.id,
                name: art.name,
                description: art.description,
                type: ItemType.Artifact,
                category: ItemCategory.Exotic,
                rarity: art.rarity,
                stats: art.stats,
                iconColor: art.color,
                isUnique: true,
                isTradeable: false,
                isConsumable: false,
                loreText: art.lore
            });
            this.addItem(item);
        });
    }

    /**
     * Create an item with generated sprite
     */
    private createItem(config: {
        id: string;
        name: string;
        description: string;
        type: ItemType;
        category: ItemCategory;
        rarity: ItemRarity;
        stats: Partial<ItemStats>;
        iconColor: Color;
        isUnique: boolean;
        isTradeable: boolean;
        isConsumable: boolean;
        loreText?: string;
    }): GameItem {
        const sprite = this.generateItemSprite(config.type, config.category, config.iconColor);
        
        return {
            id: config.id,
            name: config.name,
            description: config.description,
            type: config.type,
            category: config.category,
            rarity: config.rarity,
            sprite,
            iconColor: config.iconColor,
            stats: {
                mass: 1,
                volume: 1,
                maxStack: 1,
                ...config.stats
            },
            isUnique: config.isUnique,
            isTradeable: config.isTradeable,
            isConsumable: config.isConsumable,
            loreText: config.loreText
        };
    }

    /**
     * Generate 16-bit pixel art sprite for item
     */
    private generateItemSprite(type: ItemType, category: ItemCategory, baseColor: Color): ItemSprite {
        const width = 16;
        const height = 16;
        const pixels: Color[][] = [];
        
        // Initialize empty sprite
        for (let y = 0; y < height; y++) {
            pixels[y] = [];
            for (let x = 0; x < width; x++) {
                pixels[y][x] = { r: 0, g: 0, b: 0 }; // Transparent
            }
        }
        
        // Generate sprite based on type and category
        switch (type) {
            case ItemType.Resource:
                this.drawResourceSprite(pixels, category, baseColor);
                break;
            case ItemType.Component:
                this.drawComponentSprite(pixels, category, baseColor);
                break;
            case ItemType.Equipment:
                this.drawEquipmentSprite(pixels, category, baseColor);
                break;
            case ItemType.Weapon:
                this.drawWeaponSprite(pixels, category, baseColor);
                break;
            case ItemType.Tool:
                this.drawToolSprite(pixels, category, baseColor);
                break;
            case ItemType.Consumable:
                this.drawConsumableSprite(pixels, baseColor);
                break;
            case ItemType.Blueprint:
                this.drawBlueprintSprite(pixels, baseColor);
                break;
            case ItemType.Artifact:
                this.drawArtifactSprite(pixels, baseColor);
                break;
        }
        
        return { width, height, pixels };
    }

    /**
     * Draw resource sprite (crystal/ore shapes)
     */
    private drawResourceSprite(pixels: Color[][], category: ItemCategory, color: Color): void {
        const darkColor = this.darkenColor(color, 0.7);
        const lightColor = this.lightenColor(color, 1.3);
        
        if (category === ItemCategory.Crystal) {
            // Crystal shape
            this.setPixel(pixels, 8, 2, lightColor);
            this.setPixel(pixels, 7, 3, color);
            this.setPixel(pixels, 8, 3, lightColor);
            this.setPixel(pixels, 9, 3, color);
            this.setPixel(pixels, 6, 4, darkColor);
            this.setPixel(pixels, 7, 4, color);
            this.setPixel(pixels, 8, 4, lightColor);
            this.setPixel(pixels, 9, 4, color);
            this.setPixel(pixels, 10, 4, darkColor);
            // Continue crystal pattern...
            for (let y = 5; y < 13; y++) {
                for (let x = 6; x <= 10; x++) {
                    if (x === 6 || x === 10) this.setPixel(pixels, x, y, darkColor);
                    else if (x === 8) this.setPixel(pixels, x, y, lightColor);
                    else this.setPixel(pixels, x, y, color);
                }
            }
            this.setPixel(pixels, 8, 13, darkColor);
        } else {
            // Ore/metal chunk shape
            for (let y = 4; y < 12; y++) {
                for (let x = 5; x < 11; x++) {
                    if ((x + y) % 3 === 0) this.setPixel(pixels, x, y, lightColor);
                    else if ((x + y) % 3 === 1) this.setPixel(pixels, x, y, color);
                    else this.setPixel(pixels, x, y, darkColor);
                }
            }
        }
    }

    /**
     * Draw component sprite (circuit patterns)
     */
    private drawComponentSprite(pixels: Color[][], category: ItemCategory, color: Color): void {
        const darkColor = this.darkenColor(color, 0.6);
        const lightColor = this.lightenColor(color, 1.4);
        
        // Circuit board base
        for (let y = 3; y < 13; y++) {
            for (let x = 3; x < 13; x++) {
                this.setPixel(pixels, x, y, darkColor);
            }
        }
        
        // Circuit traces
        for (let x = 4; x < 12; x++) {
            this.setPixel(pixels, x, 6, color);
            this.setPixel(pixels, x, 9, color);
        }
        for (let y = 4; y < 12; y++) {
            this.setPixel(pixels, 6, y, color);
            this.setPixel(pixels, 9, y, color);
        }
        
        // Components
        this.setPixel(pixels, 5, 5, lightColor);
        this.setPixel(pixels, 10, 5, lightColor);
        this.setPixel(pixels, 5, 10, lightColor);
        this.setPixel(pixels, 10, 10, lightColor);
    }

    /**
     * Draw equipment sprite (mechanical shapes)
     */
    private drawEquipmentSprite(pixels: Color[][], category: ItemCategory, color: Color): void {
        const darkColor = this.darkenColor(color, 0.7);
        const lightColor = this.lightenColor(color, 1.2);
        
        // Base equipment shape
        for (let y = 2; y < 14; y++) {
            for (let x = 4; x < 12; x++) {
                if (y === 2 || y === 13 || x === 4 || x === 11) {
                    this.setPixel(pixels, x, y, darkColor);
                } else {
                    this.setPixel(pixels, x, y, color);
                }
            }
        }
        
        // Equipment details based on category
        if (category === ItemCategory.Engine) {
            // Engine nozzle
            for (let y = 6; y < 10; y++) {
                this.setPixel(pixels, 8, y, lightColor);
            }
        } else if (category === ItemCategory.Shield) {
            // Shield emitter pattern
            this.setPixel(pixels, 8, 5, lightColor);
            this.setPixel(pixels, 7, 6, lightColor);
            this.setPixel(pixels, 9, 6, lightColor);
            this.setPixel(pixels, 8, 7, lightColor);
        }
    }

    /**
     * Draw weapon sprite
     */
    private drawWeaponSprite(pixels: Color[][], category: ItemCategory, color: Color): void {
        const darkColor = this.darkenColor(color, 0.6);
        const lightColor = this.lightenColor(color, 1.3);
        
        // Weapon barrel
        for (let y = 6; y < 10; y++) {
            for (let x = 2; x < 14; x++) {
                if (y === 6 || y === 9) this.setPixel(pixels, x, y, darkColor);
                else this.setPixel(pixels, x, y, color);
            }
        }
        
        // Weapon tip
        this.setPixel(pixels, 14, 7, lightColor);
        this.setPixel(pixels, 14, 8, lightColor);
        
        // Handle/mount
        for (let y = 8; y < 12; y++) {
            for (let x = 4; x < 8; x++) {
                this.setPixel(pixels, x, y, darkColor);
            }
        }
    }

    /**
     * Draw tool sprite
     */
    private drawToolSprite(pixels: Color[][], category: ItemCategory, color: Color): void {
        const darkColor = this.darkenColor(color, 0.7);
        const lightColor = this.lightenColor(color, 1.2);
        
        // Tool handle
        for (let y = 8; y < 14; y++) {
            for (let x = 6; x < 10; x++) {
                this.setPixel(pixels, x, y, darkColor);
            }
        }
        
        // Tool head based on category
        if (category === ItemCategory.Mining) {
            // Drill bit
            for (let y = 2; y < 8; y++) {
                this.setPixel(pixels, 8, y, color);
                if (y > 3) {
                    this.setPixel(pixels, 7, y, lightColor);
                    this.setPixel(pixels, 9, y, lightColor);
                }
            }
        } else {
            // Generic tool head
            for (let y = 4; y < 8; y++) {
                for (let x = 5; x < 11; x++) {
                    this.setPixel(pixels, x, y, color);
                }
            }
        }
    }

    /**
     * Draw consumable sprite (container shapes)
     */
    private drawConsumableSprite(pixels: Color[][], color: Color): void {
        const darkColor = this.darkenColor(color, 0.6);
        const lightColor = this.lightenColor(color, 1.4);
        
        // Container outline
        for (let y = 3; y < 13; y++) {
            for (let x = 5; x < 11; x++) {
                if (y === 3 || y === 12 || x === 5 || x === 10) {
                    this.setPixel(pixels, x, y, darkColor);
                } else {
                    this.setPixel(pixels, x, y, color);
                }
            }
        }
        
        // Label/indicator
        this.setPixel(pixels, 8, 6, lightColor);
        this.setPixel(pixels, 7, 7, lightColor);
        this.setPixel(pixels, 9, 7, lightColor);
        this.setPixel(pixels, 8, 8, lightColor);
    }

    /**
     * Draw blueprint sprite (schematic pattern)
     */
    private drawBlueprintSprite(pixels: Color[][], color: Color): void {
        const darkColor = this.darkenColor(color, 0.8);
        const lightColor = this.lightenColor(color, 1.1);
        
        // Blueprint base
        for (let y = 2; y < 14; y++) {
            for (let x = 3; x < 13; x++) {
                this.setPixel(pixels, x, y, darkColor);
            }
        }
        
        // Schematic lines
        for (let x = 5; x < 11; x++) {
            this.setPixel(pixels, x, 5, color);
            this.setPixel(pixels, x, 8, color);
            this.setPixel(pixels, x, 11, color);
        }
        
        // Blueprint markers
        this.setPixel(pixels, 5, 6, lightColor);
        this.setPixel(pixels, 8, 6, lightColor);
        this.setPixel(pixels, 11, 6, lightColor);
    }

    /**
     * Draw artifact sprite (mystical patterns)
     */
    private drawArtifactSprite(pixels: Color[][], color: Color): void {
        const darkColor = this.darkenColor(color, 0.5);
        const lightColor = this.lightenColor(color, 1.5);
        
        // Artifact base
        for (let y = 4; y < 12; y++) {
            for (let x = 4; x < 12; x++) {
                if ((x + y) % 2 === 0) this.setPixel(pixels, x, y, color);
                else this.setPixel(pixels, x, y, darkColor);
            }
        }
        
        // Mystical pattern
        this.setPixel(pixels, 8, 2, lightColor);
        this.setPixel(pixels, 6, 6, lightColor);
        this.setPixel(pixels, 10, 6, lightColor);
        this.setPixel(pixels, 8, 10, lightColor);
        this.setPixel(pixels, 8, 14, lightColor);
    }

    /**
     * Helper methods for sprite generation
     */
    private setPixel(pixels: Color[][], x: number, y: number, color: Color): void {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) {
            pixels[y][x] = { ...color };
        }
    }

    private darkenColor(color: Color, factor: number): Color {
        return {
            r: Math.floor(color.r * factor),
            g: Math.floor(color.g * factor),
            b: Math.floor(color.b * factor)
        };
    }

    private lightenColor(color: Color, factor: number): Color {
        return {
            r: Math.min(255, Math.floor(color.r * factor)),
            g: Math.min(255, Math.floor(color.g * factor)),
            b: Math.min(255, Math.floor(color.b * factor))
        };
    }

    /**
     * Public interface methods
     */
    
    /**
     * Add item to database
     */
    addItem(item: GameItem): void {
        this.items.set(item.id, item);
        
        if (!this.categories.has(item.category)) {
            this.categories.set(item.category, []);
        }
        this.categories.get(item.category)!.push(item);
        
        if (item.recipe) {
            this.recipes.set(item.id, item.recipe);
        }
    }

    /**
     * Get item by ID
     */
    getItem(id: string): GameItem | undefined {
        return this.items.get(id);
    }

    /**
     * Get items by category
     */
    getItemsByCategory(category: ItemCategory): GameItem[] {
        return this.categories.get(category) || [];
    }

    /**
     * Get items by type
     */
    getItemsByType(type: ItemType): GameItem[] {
        return Array.from(this.items.values()).filter(item => item.type === type);
    }

    /**
     * Get items by rarity
     */
    getItemsByRarity(rarity: ItemRarity): GameItem[] {
        return Array.from(this.items.values()).filter(item => item.rarity === rarity);
    }

    /**
     * Get all items
     */
    getAllItems(): GameItem[] {
        return Array.from(this.items.values());
    }

    /**
     * Get recipe for item
     */
    getRecipe(itemId: string): ItemRecipe | undefined {
        return this.recipes.get(itemId);
    }

    /**
     * Search items by name
     */
    searchItems(query: string): GameItem[] {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.items.values()).filter(item => 
            item.name.toLowerCase().includes(lowerQuery) ||
            item.description.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Generate random item by rarity
     */
    generateRandomItem(rarity?: ItemRarity): GameItem | null {
        let candidateItems: GameItem[];
        
        if (rarity) {
            candidateItems = this.getItemsByRarity(rarity);
        } else {
            // Weighted random by rarity
            const rarityWeights = {
                [ItemRarity.Common]: 50,
                [ItemRarity.Uncommon]: 25,
                [ItemRarity.Rare]: 15,
                [ItemRarity.Epic]: 8,
                [ItemRarity.Legendary]: 1.5,
                [ItemRarity.Artifact]: 0.5
            };
            
            const totalWeight = Object.values(rarityWeights).reduce((sum, weight) => sum + weight, 0);
            const random = Math.random() * totalWeight;
            
            let currentWeight = 0;
            let selectedRarity: ItemRarity = ItemRarity.Common;
            
            for (const [rarity, weight] of Object.entries(rarityWeights)) {
                currentWeight += weight;
                if (random <= currentWeight) {
                    selectedRarity = rarity as ItemRarity;
                    break;
                }
            }
            
            candidateItems = this.getItemsByRarity(selectedRarity);
        }
        
        if (candidateItems.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * candidateItems.length);
        return candidateItems[randomIndex];
    }

    /**
     * Render item sprite
     */
    renderItemSprite(renderer: Renderer, item: GameItem, x: number, y: number, scale: number = 1): void {
        const sprite = item.sprite;
        
        for (let sy = 0; sy < sprite.height; sy++) {
            for (let sx = 0; sx < sprite.width; sx++) {
                const pixel = sprite.pixels[sy][sx];
                if (pixel.r > 0 || pixel.g > 0 || pixel.b > 0) { // Skip transparent pixels
                    if (scale === 1) {
                        renderer.setPixel(x + sx, y + sy, pixel);
                    } else {
                        // Scale up the pixel
                        for (let dy = 0; dy < scale; dy++) {
                            for (let dx = 0; dx < scale; dx++) {
                                renderer.setPixel(x + sx * scale + dx, y + sy * scale + dy, pixel);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Get database statistics
     */
    getStats(): {
        totalItems: number;
        itemsByType: { [type: string]: number };
        itemsByRarity: { [rarity: string]: number };
        categories: number;
    } {
        const itemsByType: { [type: string]: number } = {};
        const itemsByRarity: { [rarity: string]: number } = {};
        
        this.items.forEach(item => {
            itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
            itemsByRarity[item.rarity] = (itemsByRarity[item.rarity] || 0) + 1;
        });
        
        return {
            totalItems: this.items.size,
            itemsByType,
            itemsByRarity,
            categories: this.categories.size
        };
    }
}