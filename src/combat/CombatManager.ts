/**
 * Combat Manager
 * Coordinates weapon systems, enemy AI, and combat encounters
 */

import { Logger } from '@utils/Logger';
import { Vector2, Renderer } from '@core/Renderer';
import { WeaponSystem, WeaponConfig, WeaponType, DamageType, DamageResult } from './WeaponSystem';
import { EnemyAI, EnemyShipConfig, ShipClass, AIBehavior } from './EnemyAI';
import { GameItem, ItemDatabase } from '@items/ItemSystem';
import { InventoryManager } from '@inventory/InventoryManager';

export interface CombatEncounter {
    id: string;
    name: string;
    difficulty: number; // 1-10
    enemyConfigs: EnemyShipConfig[];
    spawnPositions: Vector2[];
    rewards: {
        experience: number;
        credits: number;
        items: { itemId: string, quantity: number, dropRate: number }[];
    };
    isActive: boolean;
    startTime: number;
    completionTime?: number;
}

export interface CombatStats {
    totalDamageDealt: number;
    totalDamageReceived: number;
    enemiesDestroyed: number;
    shotsHit: number;
    shotsFired: number;
    encountersCompleted: number;
    experienceGained: number;
}

export interface CombatEvents {
    onEncounterStarted?: (encounter: CombatEncounter) => void;
    onEncounterCompleted?: (encounter: CombatEncounter, success: boolean) => void;
    onEnemyDestroyed?: (enemyId: string, rewards: { items: GameItem[], experience: number }) => void;
    onPlayerDamaged?: (damage: number, damageType: DamageType) => void;
    onCombatStatsUpdated?: (stats: CombatStats) => void;
}

export class CombatManager {
    private weaponSystem: WeaponSystem;
    private enemyAI: EnemyAI;
    private itemDatabase: ItemDatabase;
    private inventory: InventoryManager;
    
    // Combat state
    private activeEncounters: Map<string, CombatEncounter> = new Map();
    private combatStats: CombatStats = {
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        enemiesDestroyed: 0,
        shotsHit: 0,
        shotsFired: 0,
        encountersCompleted: 0,
        experienceGained: 0
    };
    
    // Player ship reference
    private playerPosition: Vector2 = { x: 0, y: 0 };
    private playerVelocity: Vector2 = { x: 0, y: 0 };
    private playerSize: number = 20;
    private playerHull: number = 100;
    private playerMaxHull: number = 100;
    
    private events: CombatEvents;
    private logger: Logger;

    constructor(
        itemDatabase: ItemDatabase,
        inventory: InventoryManager,
        events: CombatEvents = {}
    ) {
        this.logger = new Logger('CombatManager');
        this.itemDatabase = itemDatabase;
        this.inventory = inventory;
        this.events = events;
        
        // Initialize weapon system
        this.weaponSystem = new WeaponSystem({
            onWeaponFired: (weapon, projectile) => {
                this.combatStats.shotsFired++;
                this.logger.debug(`🔫 ${weapon.name} fired`);
            },
            onProjectileHit: (projectile, result) => {
                this.handleProjectileHit(projectile, result);
            },
            onWeaponOverheat: (weapon) => {
                this.logger.warn(`🔥 ${weapon.name} overheated`);
            }
        });
        
        // Initialize enemy AI
        this.enemyAI = new EnemyAI(this.weaponSystem, {
            onEnemySpawned: (enemy) => {
                this.logger.info(`🛸 Enemy spawned: ${enemy.config.name}`);
            },
            onEnemyDestroyed: (enemy) => {
                this.handleEnemyDestroyed(enemy);
            },
            onEnemyDamaged: (enemy, damage) => {
                this.logger.debug(`💥 ${enemy.config.name} took ${damage} damage`);
            }
        });
        
        this.initializePlayerWeapons();
        
        this.logger.info('⚔️ Combat manager initialized');
    }

    /**
     * Initialize player weapons
     */
    private initializePlayerWeapons(): void {
        // Add basic player weapons
        const basicLaser: WeaponConfig = {
            id: 'player_laser_1',
            name: 'Basic Laser Cannon',
            type: WeaponType.Energy,
            damageType: DamageType.Energy,
            stats: {
                damage: 25,
                range: 400,
                fireRate: 3, // 3 shots per second
                energyCost: 5,
                accuracy: 0.9,
                penetration: 0.1,
                spread: 2, // 2 degrees
                chargeTime: 0,
                cooldownTime: 2
            },
            mountPoint: { x: 0, y: -10 },
            hardpointSize: 'small'
        };
        
        const basicProjectile: WeaponConfig = {
            id: 'player_cannon_1',
            name: 'Mass Driver',
            type: WeaponType.Projectile,
            damageType: DamageType.Kinetic,
            stats: {
                damage: 40,
                range: 500,
                fireRate: 2,
                energyCost: 0,
                accuracy: 0.8,
                penetration: 0.3,
                spread: 1,
                chargeTime: 0,
                cooldownTime: 1,
                ammoCapacity: 100,
                reloadTime: 3
            },
            mountPoint: { x: 0, y: 10 },
            hardpointSize: 'small'
        };
        
        this.weaponSystem.addWeapon(basicLaser);
        this.weaponSystem.addWeapon(basicProjectile);
        
        this.logger.info('🔫 Player weapons initialized', {
            laser: basicLaser.name,
            cannon: basicProjectile.name
        });
    }

    /**
     * Handle projectile hit
     */
    private handleProjectileHit(projectile: any, result: DamageResult): void {
        this.combatStats.shotsHit++;
        
        if (result.targetId === 'player') {
            // Player took damage
            this.playerHull = Math.max(0, this.playerHull - result.damage);
            this.combatStats.totalDamageReceived += result.damage;
            
            this.events.onPlayerDamaged?.(result.damage, result.damageType);
            
            this.logger.info(`💥 Player hit for ${result.damage} ${result.damageType} damage`, {
                critical: result.criticalHit,
                penetrated: result.penetrated,
                hullRemaining: this.playerHull
            });
        } else {
            // Enemy took damage
            const destroyed = this.enemyAI.applyDamage(result.targetId, result.damage, result.damageType);
            this.combatStats.totalDamageDealt += result.damage;
            
            if (destroyed) {
                this.combatStats.enemiesDestroyed++;
            }
        }
        
        this.events.onCombatStatsUpdated?.(this.combatStats);
    }

    /**
     * Handle enemy destroyed
     */
    private handleEnemyDestroyed(enemy: any): void {
        const rewards = this.calculateRewards(enemy.config);
        
        // Add items to inventory
        rewards.items.forEach(item => {
            this.inventory.addItem(item, 1);
        });
        
        // Add experience
        this.combatStats.experienceGained += rewards.experience;
        
        this.events.onEnemyDestroyed?.(enemy.config.id, rewards);
        
        // Check if any encounters are completed
        this.checkEncounterCompletion();
        
        this.logger.info(`💰 Enemy destroyed rewards`, {
            enemy: enemy.config.name,
            items: rewards.items.length,
            experience: rewards.experience
        });
    }

    /**
     * Calculate rewards for destroyed enemy
     */
    private calculateRewards(enemyConfig: any): { items: GameItem[], experience: number } {
        const items: GameItem[] = [];
        let experience = 0;
        
        // Base experience based on ship class
        const baseExperience: { [key: string]: number } = {
            [ShipClass.Drone]: 5,
            [ShipClass.Fighter]: 15,
            [ShipClass.Corvette]: 30,
            [ShipClass.Frigate]: 50,
            [ShipClass.Destroyer]: 100,
            [ShipClass.Cruiser]: 200,
            [ShipClass.Battleship]: 500
        };
        
        experience = baseExperience[enemyConfig.shipClass] || 10;
        
        // Random item drops
        const dropChance = 0.3; // 30% chance for item drop
        if (Math.random() < dropChance) {
            const randomItem = this.itemDatabase.generateRandomItem();
            if (randomItem) {
                items.push(randomItem);
            }
        }
        
        // Specific loot based on faction
        const factionLoot: { [faction: string]: string[] } = {
            pirates: ['metal_iron', 'gas_hydrogen'],
            aliens: ['crystal_dilithium', 'energy_antimatter'],
            military: ['comp_circuit', 'tool_repair_kit'],
            corporation: ['crystal_quartz', 'comp_shield_emitter']
        };
        
        const possibleLoot = factionLoot[enemyConfig.faction] || [];
        if (possibleLoot.length > 0 && Math.random() < 0.4) {
            const lootId = possibleLoot[Math.floor(Math.random() * possibleLoot.length)];
            const lootItem = this.itemDatabase.getItem(lootId);
            if (lootItem) {
                items.push(lootItem);
            }
        }
        
        return { items, experience };
    }

    /**
     * Start combat encounter
     */
    startEncounter(encounter: CombatEncounter): void {
        encounter.isActive = true;
        encounter.startTime = Date.now();
        
        // Spawn enemies
        encounter.enemyConfigs.forEach((config, index) => {
            const spawnPos = encounter.spawnPositions[index] || { x: 800, y: 400 };
            this.enemyAI.spawnEnemy(config, spawnPos);
        });
        
        this.activeEncounters.set(encounter.id, encounter);
        this.events.onEncounterStarted?.(encounter);
        
        this.logger.info(`🚨 Combat encounter started: ${encounter.name}`, {
            difficulty: encounter.difficulty,
            enemies: encounter.enemyConfigs.length
        });
    }

    /**
     * Check if encounters are completed
     */
    private checkEncounterCompletion(): void {
        for (const [encounterId, encounter] of this.activeEncounters.entries()) {
            if (!encounter.isActive) continue;
            
            // Check if all enemies from this encounter are destroyed
            const remainingEnemies = this.enemyAI.getAllEnemies()
                .filter(enemy => encounter.enemyConfigs.some(config => config.id === enemy.config.id));
            
            if (remainingEnemies.length === 0) {
                // Encounter completed
                encounter.isActive = false;
                encounter.completionTime = Date.now();
                
                this.combatStats.encountersCompleted++;
                this.events.onEncounterCompleted?.(encounter, true);
                
                this.logger.info(`✅ Encounter completed: ${encounter.name}`, {
                    duration: (encounter.completionTime - encounter.startTime) / 1000,
                    rewards: encounter.rewards
                });
                
                this.activeEncounters.delete(encounterId);
            }
        }
    }

    /**
     * Generate predefined encounters
     */
    generateEncounters(): CombatEncounter[] {
        const encounters: CombatEncounter[] = [];
        
        // Pirate patrol
        encounters.push({
            id: 'pirate_patrol_1',
            name: 'Pirate Patrol',
            difficulty: 2,
            enemyConfigs: [
                this.createEnemyConfig('pirate_fighter_1', 'Pirate Fighter', ShipClass.Fighter, 'pirates', AIBehavior.Aggressive),
                this.createEnemyConfig('pirate_drone_1', 'Pirate Drone', ShipClass.Drone, 'pirates', AIBehavior.Kamikaze)
            ],
            spawnPositions: [
                { x: 700, y: 300 },
                { x: 750, y: 350 }
            ],
            rewards: {
                experience: 50,
                credits: 100,
                items: [
                    { itemId: 'metal_iron', quantity: 5, dropRate: 0.8 },
                    { itemId: 'tool_repair_kit', quantity: 1, dropRate: 0.3 }
                ]
            },
            isActive: false,
            startTime: 0
        });
        
        // Alien scout
        encounters.push({
            id: 'alien_scout_1',
            name: 'Alien Scout',
            difficulty: 4,
            enemyConfigs: [
                this.createEnemyConfig('alien_corvette_1', 'Alien Corvette', ShipClass.Corvette, 'aliens', AIBehavior.Evasive)
            ],
            spawnPositions: [
                { x: 600, y: 200 }
            ],
            rewards: {
                experience: 80,
                credits: 200,
                items: [
                    { itemId: 'crystal_dilithium', quantity: 2, dropRate: 0.6 },
                    { itemId: 'energy_antimatter', quantity: 1, dropRate: 0.2 }
                ]
            },
            isActive: false,
            startTime: 0
        });
        
        // Corporate security
        encounters.push({
            id: 'corp_security_1',
            name: 'Corporate Security',
            difficulty: 3,
            enemyConfigs: [
                this.createEnemyConfig('corp_frigate_1', 'Corporate Frigate', ShipClass.Frigate, 'corporation', AIBehavior.Defensive),
                this.createEnemyConfig('corp_fighter_1', 'Corporate Fighter', ShipClass.Fighter, 'corporation', AIBehavior.Support)
            ],
            spawnPositions: [
                { x: 800, y: 400 },
                { x: 750, y: 450 }
            ],
            rewards: {
                experience: 120,
                credits: 300,
                items: [
                    { itemId: 'comp_shield_emitter', quantity: 1, dropRate: 0.5 },
                    { itemId: 'crystal_quartz', quantity: 3, dropRate: 0.7 }
                ]
            },
            isActive: false,
            startTime: 0
        });
        
        return encounters;
    }

    /**
     * Create enemy ship configuration
     */
    private createEnemyConfig(
        id: string,
        name: string,
        shipClass: ShipClass,
        faction: string,
        behavior: AIBehavior
    ): EnemyShipConfig {
        // Base stats by ship class
        const classStats: { [key: string]: any } = {
            [ShipClass.Drone]: {
                size: 8, maxSpeed: 200, hull: 20, weapons: [this.createBasicWeapon('drone_laser', WeaponType.Energy, 15)]
            },
            [ShipClass.Fighter]: {
                size: 15, maxSpeed: 180, hull: 60, weapons: [this.createBasicWeapon('fighter_cannon', WeaponType.Projectile, 25)]
            },
            [ShipClass.Corvette]: {
                size: 20, maxSpeed: 150, hull: 120, weapons: [
                    this.createBasicWeapon('corvette_laser', WeaponType.Energy, 30),
                    this.createBasicWeapon('corvette_missiles', WeaponType.Missile, 40)
                ]
            },
            [ShipClass.Frigate]: {
                size: 25, maxSpeed: 120, hull: 200, weapons: [
                    this.createBasicWeapon('frigate_plasma', WeaponType.Plasma, 45),
                    this.createBasicWeapon('frigate_cannon', WeaponType.Projectile, 35)
                ]
            }
        };
        
        const stats = classStats[shipClass] || classStats[ShipClass.Fighter];
        
        return {
            id,
            name,
            shipClass,
            faction,
            
            size: stats.size,
            mass: stats.size * 10,
            maxSpeed: stats.maxSpeed,
            acceleration: 0.8,
            turnRate: 2.0,
            
            hull: stats.hull,
            maxHull: stats.hull,
            shields: shipClass === ShipClass.Drone ? 0 : stats.hull * 0.5,
            maxShields: shipClass === ShipClass.Drone ? 0 : stats.hull * 0.5,
            armor: Math.floor(stats.hull * 0.1),
            
            behavior,
            aggression: behavior === AIBehavior.Aggressive ? 0.9 : 0.6,
            intelligence: 0.7,
            accuracy: 0.75,
            reactionTime: 0.5,
            
            weapons: stats.weapons,
            engagementRange: stats.size * 20,
            preferredRange: stats.size * 15
        };
    }

    /**
     * Create basic weapon configuration
     */
    private createBasicWeapon(id: string, type: WeaponType, damage: number): WeaponConfig {
        const baseStats = {
            [WeaponType.Energy]: { range: 300, fireRate: 2.5, energyCost: 5 },
            [WeaponType.Projectile]: { range: 400, fireRate: 2.0, energyCost: 0 },
            [WeaponType.Missile]: { range: 500, fireRate: 0.5, energyCost: 15 },
            [WeaponType.Plasma]: { range: 250, fireRate: 1.5, energyCost: 10 },
            [WeaponType.Beam]: { range: 350, fireRate: 3.0, energyCost: 8 },
            [WeaponType.Torpedo]: { range: 600, fireRate: 0.3, energyCost: 20 }
        };
        
        const stats = baseStats[type] || baseStats[WeaponType.Energy];
        
        return {
            id,
            name: `${type} Weapon`,
            type,
            damageType: type === WeaponType.Energy ? DamageType.Energy : DamageType.Kinetic,
            stats: {
                damage,
                range: stats.range,
                fireRate: stats.fireRate,
                energyCost: stats.energyCost,
                accuracy: 0.8,
                penetration: 0.2,
                spread: 3,
                chargeTime: 0,
                cooldownTime: 1
            },
            mountPoint: { x: 0, y: 0 },
            hardpointSize: 'small'
        };
    }

    /**
     * Update combat manager
     */
    update(deltaTime: number): void {
        // Update weapon system
        this.weaponSystem.update(deltaTime);
        
        // Update enemy AI with player position
        this.enemyAI.updatePlayer(this.playerPosition, this.playerVelocity, this.playerSize);
        this.enemyAI.update(deltaTime);
        
        // Check encounter completion
        this.checkEncounterCompletion();
    }

    /**
     * Update player information
     */
    updatePlayer(position: Vector2, velocity: Vector2, size: number, hull: number, maxHull: number): void {
        this.playerPosition = { ...position };
        this.playerVelocity = { ...velocity };
        this.playerSize = size;
        this.playerHull = hull;
        this.playerMaxHull = maxHull;
    }

    /**
     * Fire player weapon
     */
    firePlayerWeapon(weaponId: string, targetPosition?: Vector2): boolean {
        return this.weaponSystem.fireWeapon(weaponId, this.playerPosition, targetPosition);
    }

    /**
     * Render combat effects
     */
    render(renderer: Renderer): void {
        // Render weapon effects (projectiles, etc.)
        this.weaponSystem.render(renderer);
        
        // Render enemies
        this.enemyAI.render(renderer);
    }

    /**
     * Start random encounter
     */
    startRandomEncounter(): void {
        const encounters = this.generateEncounters();
        if (encounters.length > 0) {
            const randomIndex = Math.floor(Math.random() * encounters.length);
            this.startEncounter(encounters[randomIndex]);
        }
    }

    /**
     * Get combat statistics
     */
    getCombatStats(): CombatStats {
        return { ...this.combatStats };
    }

    /**
     * Get active encounters
     */
    getActiveEncounters(): CombatEncounter[] {
        return Array.from(this.activeEncounters.values());
    }

    /**
     * Get player weapons
     */
    getPlayerWeapons(): Array<{ weapon: WeaponConfig; state: any }> {
        return this.weaponSystem.getAllWeapons().filter(w => w.weapon.id.startsWith('player_'));
    }

    /**
     * Get all enemies
     */
    getEnemies(): any[] {
        return this.enemyAI.getAllEnemies();
    }

    /**
     * Clear all combat
     */
    clearCombat(): void {
        this.weaponSystem.clearProjectiles();
        this.enemyAI.clearEnemies();
        this.activeEncounters.clear();
        
        this.logger.info('🧹 Combat cleared');
    }

    /**
     * Reset combat stats
     */
    resetStats(): void {
        this.combatStats = {
            totalDamageDealt: 0,
            totalDamageReceived: 0,
            enemiesDestroyed: 0,
            shotsHit: 0,
            shotsFired: 0,
            encountersCompleted: 0,
            experienceGained: 0
        };
        
        this.events.onCombatStatsUpdated?.(this.combatStats);
    }
}