/**
 * Enemy AI System
 * Intelligent combat AI with different behaviors and ship types
 */

import { Logger } from '@utils/Logger';
import { Vector2, Renderer, Color } from '@core/Renderer';
import { WeaponSystem, WeaponConfig, WeaponType, DamageType } from './WeaponSystem';

export enum AIBehavior {
    Aggressive = 'aggressive',
    Defensive = 'defensive',
    Evasive = 'evasive',
    Patrol = 'patrol',
    Guard = 'guard',
    Kamikaze = 'kamikaze',
    Sniper = 'sniper',
    Support = 'support'
}

export enum ShipClass {
    Fighter = 'fighter',
    Corvette = 'corvette',
    Frigate = 'frigate',
    Destroyer = 'destroyer',
    Cruiser = 'cruiser',
    Battleship = 'battleship',
    Drone = 'drone'
}

export interface EnemyShipConfig {
    id: string;
    name: string;
    shipClass: ShipClass;
    faction: string;
    
    // Physical properties
    size: number;
    mass: number;
    maxSpeed: number;
    acceleration: number;
    turnRate: number;
    
    // Combat properties
    hull: number;
    maxHull: number;
    shields: number;
    maxShields: number;
    armor: number;
    
    // AI properties
    behavior: AIBehavior;
    aggression: number; // 0-1
    intelligence: number; // 0-1
    accuracy: number; // 0-1
    reactionTime: number; // seconds
    
    // Equipment
    weapons: WeaponConfig[];
    engagementRange: number;
    preferredRange: number;
}

export interface EnemyShip {
    config: EnemyShipConfig;
    position: Vector2;
    velocity: Vector2;
    rotation: number;
    
    // AI state
    currentTarget: string | null;
    state: AIState;
    stateTimer: number;
    lastDecisionTime: number;
    
    // Combat state
    lastShotTime: number;
    weaponCooldowns: Map<string, number>;
    
    // Movement state
    waypoint: Vector2 | null;
    patrolCenter: Vector2;
    patrolRadius: number;
    
    // Status
    isAlive: boolean;
    lastDamageTime: number;
}

export enum AIState {
    Idle = 'idle',
    Patrol = 'patrol',
    Pursue = 'pursue',
    Attack = 'attack',
    Evade = 'evade',
    Retreat = 'retreat',
    Guard = 'guard',
    CircleStrafe = 'circle_strafe',
    Ramming = 'ramming'
}

export interface AIEvents {
    onEnemySpawned?: (enemy: EnemyShip) => void;
    onEnemyDestroyed?: (enemy: EnemyShip) => void;
    onEnemyDamaged?: (enemy: EnemyShip, damage: number) => void;
    onEnemyStateChanged?: (enemy: EnemyShip, oldState: AIState, newState: AIState) => void;
}

export class EnemyAI {
    private enemies: Map<string, EnemyShip> = new Map();
    private weaponSystem: WeaponSystem;
    private events: AIEvents;
    
    // Player tracking
    private playerPosition: Vector2 = { x: 0, y: 0 };
    private playerVelocity: Vector2 = { x: 0, y: 0 };
    private playerSize: number = 20;
    
    // Faction relationships
    private factionRelations: Map<string, Map<string, number>> = new Map(); // -1 to 1
    
    private logger: Logger;

    constructor(weaponSystem: WeaponSystem, events: AIEvents = {}) {
        this.logger = new Logger('EnemyAI');
        this.weaponSystem = weaponSystem;
        this.events = events;
        
        this.initializeFactions();
        
        this.logger.info('🤖 Enemy AI system initialized');
    }

    /**
     * Initialize faction relationships
     */
    private initializeFactions(): void {
        const factions = ['pirates', 'aliens', 'rebels', 'corporation', 'military'];
        
        for (const faction1 of factions) {
            if (!this.factionRelations.has(faction1)) {
                this.factionRelations.set(faction1, new Map());
            }
            
            for (const faction2 of factions) {
                let relation = 0;
                
                if (faction1 === faction2) {
                    relation = 1; // Same faction
                } else if (
                    (faction1 === 'pirates' && faction2 === 'military') ||
                    (faction1 === 'military' && faction2 === 'pirates') ||
                    (faction1 === 'rebels' && faction2 === 'corporation') ||
                    (faction1 === 'corporation' && faction2 === 'rebels')
                ) {
                    relation = -1; // Hostile
                } else if (faction1 === 'aliens') {
                    relation = -0.5; // Aliens generally hostile
                } else {
                    relation = Math.random() * 0.4 - 0.2; // Neutral with slight variation
                }
                
                this.factionRelations.get(faction1)!.set(faction2, relation);
            }
        }
    }

    /**
     * Spawn enemy ship
     */
    spawnEnemy(config: EnemyShipConfig, position: Vector2): string {
        const enemy: EnemyShip = {
            config,
            position: { ...position },
            velocity: { x: 0, y: 0 },
            rotation: Math.random() * Math.PI * 2,
            
            currentTarget: null,
            state: AIState.Idle,
            stateTimer: 0,
            lastDecisionTime: 0,
            
            lastShotTime: 0,
            weaponCooldowns: new Map(),
            
            waypoint: null,
            patrolCenter: { ...position },
            patrolRadius: 500,
            
            isAlive: true,
            lastDamageTime: 0
        };
        
        // Add weapons to weapon system
        config.weapons.forEach(weapon => {
            const weaponId = `${config.id}_${weapon.id}`;
            this.weaponSystem.addWeapon({
                ...weapon,
                id: weaponId
            });
        });
        
        // Add as target to weapon system
        this.weaponSystem.updateTarget(config.id, position, { x: 0, y: 0 }, config.size);
        
        this.enemies.set(config.id, enemy);
        this.events.onEnemySpawned?.(enemy);
        
        this.logger.info(`🛸 Spawned ${config.shipClass} "${config.name}"`, {
            faction: config.faction,
            behavior: config.behavior,
            position
        });
        
        return config.id;
    }

    /**
     * Update player information for AI targeting
     */
    updatePlayer(position: Vector2, velocity: Vector2, size: number): void {
        this.playerPosition = { ...position };
        this.playerVelocity = { ...velocity };
        this.playerSize = size;
        
        // Update player as target in weapon system
        this.weaponSystem.updateTarget('player', position, velocity, size);
    }

    /**
     * Update AI system
     */
    update(deltaTime: number): void {
        for (const enemy of this.enemies.values()) {
            if (enemy.isAlive) {
                this.updateEnemy(enemy, deltaTime);
            }
        }
        
        this.cleanupDeadEnemies();
    }

    /**
     * Update individual enemy
     */
    private updateEnemy(enemy: EnemyShip, deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        
        // Update timers
        enemy.stateTimer += deltaTime;
        
        // AI decision making (based on reaction time)
        if (currentTime - enemy.lastDecisionTime >= enemy.config.reactionTime) {
            this.makeDecision(enemy);
            enemy.lastDecisionTime = currentTime;
        }
        
        // Execute current state
        this.executeState(enemy, deltaTime);
        
        // Update movement
        this.updateMovement(enemy, deltaTime);
        
        // Update weapon targeting and firing
        this.updateCombat(enemy, deltaTime);
        
        // Update weapon system target
        this.weaponSystem.updateTarget(enemy.config.id, enemy.position, enemy.velocity, enemy.config.size);
    }

    /**
     * AI decision making
     */
    private makeDecision(enemy: EnemyShip): void {
        const distanceToPlayer = this.calculateDistance(enemy.position, this.playerPosition);
        const inRange = distanceToPlayer <= enemy.config.engagementRange;
        const hasLineOfSight = this.hasLineOfSight(enemy.position, this.playerPosition);
        
        let newState = enemy.state;
        
        switch (enemy.config.behavior) {
            case AIBehavior.Aggressive:
                if (inRange && hasLineOfSight) {
                    newState = AIState.Attack;
                } else if (distanceToPlayer < enemy.config.engagementRange * 2) {
                    newState = AIState.Pursue;
                } else {
                    newState = AIState.Patrol;
                }
                break;
                
            case AIBehavior.Defensive:
                if (inRange && hasLineOfSight && enemy.lastDamageTime > Date.now() / 1000 - 5) {
                    newState = AIState.Attack;
                } else if (distanceToPlayer < enemy.config.engagementRange) {
                    newState = AIState.Guard;
                } else {
                    newState = AIState.Patrol;
                }
                break;
                
            case AIBehavior.Evasive:
                if (enemy.config.hull < enemy.config.maxHull * 0.3) {
                    newState = AIState.Retreat;
                } else if (inRange) {
                    newState = AIState.Evade;
                } else {
                    newState = AIState.Patrol;
                }
                break;
                
            case AIBehavior.Sniper:
                if (distanceToPlayer <= enemy.config.preferredRange && hasLineOfSight) {
                    newState = AIState.Attack;
                } else if (distanceToPlayer < enemy.config.preferredRange) {
                    newState = AIState.Retreat; // Back up to preferred range
                } else {
                    newState = AIState.Pursue;
                }
                break;
                
            case AIBehavior.Kamikaze:
                if (distanceToPlayer < 100) {
                    newState = AIState.Ramming;
                } else {
                    newState = AIState.Pursue;
                }
                break;
                
            default:
                newState = AIState.Patrol;
        }
        
        if (newState !== enemy.state) {
            this.changeState(enemy, newState);
        }
    }

    /**
     * Change enemy AI state
     */
    private changeState(enemy: EnemyShip, newState: AIState): void {
        const oldState = enemy.state;
        enemy.state = newState;
        enemy.stateTimer = 0;
        
        // State entry logic
        switch (newState) {
            case AIState.Patrol:
                enemy.waypoint = this.generatePatrolWaypoint(enemy);
                break;
                
            case AIState.Pursue:
                enemy.currentTarget = 'player';
                break;
                
            case AIState.Attack:
                enemy.currentTarget = 'player';
                break;
                
            case AIState.CircleStrafe:
                enemy.currentTarget = 'player';
                break;
                
            case AIState.Retreat:
                enemy.waypoint = this.generateRetreatWaypoint(enemy);
                break;
        }
        
        this.events.onEnemyStateChanged?.(enemy, oldState, newState);
        
        this.logger.debug(`🤖 ${enemy.config.name} state: ${oldState} → ${newState}`);
    }

    /**
     * Execute current AI state
     */
    private executeState(enemy: EnemyShip, deltaTime: number): void {
        switch (enemy.state) {
            case AIState.Idle:
                // Do nothing, maybe rotate slowly
                break;
                
            case AIState.Patrol:
                this.executePatrol(enemy, deltaTime);
                break;
                
            case AIState.Pursue:
                this.executePursue(enemy, deltaTime);
                break;
                
            case AIState.Attack:
                this.executeAttack(enemy, deltaTime);
                break;
                
            case AIState.Evade:
                this.executeEvade(enemy, deltaTime);
                break;
                
            case AIState.Retreat:
                this.executeRetreat(enemy, deltaTime);
                break;
                
            case AIState.CircleStrafe:
                this.executeCircleStrafe(enemy, deltaTime);
                break;
                
            case AIState.Ramming:
                this.executeRamming(enemy, deltaTime);
                break;
        }
    }

    /**
     * Execute patrol behavior
     */
    private executePatrol(enemy: EnemyShip, deltaTime: number): void {
        if (!enemy.waypoint || this.calculateDistance(enemy.position, enemy.waypoint) < 50) {
            enemy.waypoint = this.generatePatrolWaypoint(enemy);
        }
        
        this.moveToward(enemy, enemy.waypoint, 0.5); // Half speed for patrol
    }

    /**
     * Execute pursue behavior
     */
    private executePursue(enemy: EnemyShip, deltaTime: number): void {
        const predictedPlayerPos = this.predictPlayerPosition(0.5);
        this.moveToward(enemy, predictedPlayerPos, 1.0);
    }

    /**
     * Execute attack behavior
     */
    private executeAttack(enemy: EnemyShip, deltaTime: number): void {
        const distanceToPlayer = this.calculateDistance(enemy.position, this.playerPosition);
        
        if (distanceToPlayer > enemy.config.preferredRange * 1.2) {
            // Too far, move closer
            this.moveToward(enemy, this.playerPosition, 1.0);
        } else if (distanceToPlayer < enemy.config.preferredRange * 0.8) {
            // Too close, back away
            const retreatPoint = this.calculateRetreatPoint(enemy.position, this.playerPosition);
            this.moveToward(enemy, retreatPoint, 0.8);
        } else {
            // Good range, circle strafe
            this.executeCircleStrafe(enemy, deltaTime);
        }
    }

    /**
     * Execute evade behavior
     */
    private executeEvade(enemy: EnemyShip, deltaTime: number): void {
        const evasionPoint = this.calculateEvasionPoint(enemy);
        this.moveToward(enemy, evasionPoint, 1.2); // Slightly faster for evasion
    }

    /**
     * Execute retreat behavior
     */
    private executeRetreat(enemy: EnemyShip, deltaTime: number): void {
        if (!enemy.waypoint) {
            enemy.waypoint = this.generateRetreatWaypoint(enemy);
        }
        
        this.moveToward(enemy, enemy.waypoint, 1.5); // Faster retreat
    }

    /**
     * Execute circle strafe behavior
     */
    private executeCircleStrafe(enemy: EnemyShip, deltaTime: number): void {
        const toPlayer = {
            x: this.playerPosition.x - enemy.position.x,
            y: this.playerPosition.y - enemy.position.y
        };
        
        const distance = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.y * toPlayer.y);
        if (distance === 0) return;
        
        // Normalize
        toPlayer.x /= distance;
        toPlayer.y /= distance;
        
        // Calculate perpendicular direction for strafing
        const strafeDirection = {
            x: -toPlayer.y, // Perpendicular
            y: toPlayer.x
        };
        
        // Random direction change
        if (Math.random() < 0.1) {
            strafeDirection.x *= -1;
            strafeDirection.y *= -1;
        }
        
        // Move in strafe direction
        const targetPoint = {
            x: enemy.position.x + strafeDirection.x * 200,
            y: enemy.position.y + strafeDirection.y * 200
        };
        
        this.moveToward(enemy, targetPoint, 0.8);
    }

    /**
     * Execute ramming behavior
     */
    private executeRamming(enemy: EnemyShip, deltaTime: number): void {
        // Full speed toward player
        this.moveToward(enemy, this.playerPosition, 2.0); // Maximum speed
    }

    /**
     * Move enemy toward target position
     */
    private moveToward(enemy: EnemyShip, target: Vector2, speedMultiplier: number): void {
        const direction = {
            x: target.x - enemy.position.x,
            y: target.y - enemy.position.y
        };
        
        const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (distance === 0) return;
        
        // Normalize
        direction.x /= distance;
        direction.y /= distance;
        
        // Apply desired velocity
        const desiredSpeed = enemy.config.maxSpeed * speedMultiplier;
        const desiredVelocity = {
            x: direction.x * desiredSpeed,
            y: direction.y * desiredSpeed
        };
        
        // Smooth acceleration
        const acceleration = enemy.config.acceleration;
        enemy.velocity.x += (desiredVelocity.x - enemy.velocity.x) * acceleration * 0.016; // Assume 60fps
        enemy.velocity.y += (desiredVelocity.y - enemy.velocity.y) * acceleration * 0.016;
        
        // Update rotation to face movement direction
        const targetRotation = Math.atan2(direction.y, direction.x);
        enemy.rotation = this.lerpAngle(enemy.rotation, targetRotation, enemy.config.turnRate * 0.016);
    }

    /**
     * Update enemy movement
     */
    private updateMovement(enemy: EnemyShip, deltaTime: number): void {
        // Apply velocity
        enemy.position.x += enemy.velocity.x * deltaTime;
        enemy.position.y += enemy.velocity.y * deltaTime;
        
        // Apply drag
        const drag = 0.95;
        enemy.velocity.x *= drag;
        enemy.velocity.y *= drag;
    }

    /**
     * Update combat behavior
     */
    private updateCombat(enemy: EnemyShip, deltaTime: number): void {
        if (!enemy.currentTarget) return;
        
        const currentTime = Date.now() / 1000;
        const target = enemy.currentTarget === 'player' ? this.playerPosition : null;
        
        if (!target) return;
        
        const distance = this.calculateDistance(enemy.position, target);
        const inRange = distance <= enemy.config.engagementRange;
        const hasLineOfSight = this.hasLineOfSight(enemy.position, target);
        
        if (inRange && hasLineOfSight) {
            // Try to fire weapons
            for (const weaponConfig of enemy.config.weapons) {
                const weaponId = `${enemy.config.id}_${weaponConfig.id}`;
                const cooldownKey = weaponId;
                const lastFired = enemy.weaponCooldowns.get(cooldownKey) || 0;
                
                // Check if weapon can fire based on fire rate
                const fireRate = weaponConfig.stats.fireRate;
                const timeSinceLastShot = currentTime - lastFired;
                
                if (timeSinceLastShot >= 1 / fireRate) {
                    // Apply accuracy
                    const accuracy = enemy.config.accuracy * enemy.config.intelligence;
                    const shouldFire = Math.random() < accuracy;
                    
                    if (shouldFire) {
                        const fired = this.weaponSystem.fireWeapon(
                            weaponId,
                            enemy.position,
                            this.predictPlayerPosition(distance / 600) // Predict based on projectile travel time
                        );
                        
                        if (fired) {
                            enemy.weaponCooldowns.set(cooldownKey, currentTime);
                        }
                    }
                }
            }
        }
    }

    /**
     * Apply damage to enemy
     */
    applyDamage(enemyId: string, damage: number, damageType: string): boolean {
        const enemy = this.enemies.get(enemyId);
        if (!enemy || !enemy.isAlive) return false;
        
        // Apply armor reduction
        let finalDamage = damage;
        if (enemy.config.armor > 0) {
            finalDamage = Math.max(1, damage - enemy.config.armor * 0.1);
        }
        
        // Apply to shields first
        if (enemy.config.shields > 0) {
            const shieldDamage = Math.min(finalDamage, enemy.config.shields);
            enemy.config.shields -= shieldDamage;
            finalDamage -= shieldDamage;
        }
        
        // Apply remaining damage to hull
        if (finalDamage > 0) {
            enemy.config.hull -= finalDamage;
        }
        
        enemy.lastDamageTime = Date.now() / 1000;
        
        this.events.onEnemyDamaged?.(enemy, damage);
        
        // Check if destroyed
        if (enemy.config.hull <= 0) {
            this.destroyEnemy(enemyId);
            return true;
        }
        
        return false;
    }

    /**
     * Destroy enemy
     */
    private destroyEnemy(enemyId: string): void {
        const enemy = this.enemies.get(enemyId);
        if (!enemy) return;
        
        enemy.isAlive = false;
        
        // Remove weapons
        enemy.config.weapons.forEach(weapon => {
            this.weaponSystem.removeWeapon(`${enemyId}_${weapon.id}`);
        });
        
        // Remove from weapon system targets
        this.weaponSystem.removeTarget(enemyId);
        
        this.events.onEnemyDestroyed?.(enemy);
        
        this.logger.info(`💥 Destroyed ${enemy.config.name}`);
    }

    /**
     * Clean up dead enemies
     */
    private cleanupDeadEnemies(): void {
        for (const [enemyId, enemy] of this.enemies.entries()) {
            if (!enemy.isAlive) {
                this.enemies.delete(enemyId);
            }
        }
    }

    /**
     * Helper methods
     */
    
    private generatePatrolWaypoint(enemy: EnemyShip): Vector2 {
        const angle = Math.random() * Math.PI * 2;
        const radius = enemy.patrolRadius * (0.5 + Math.random() * 0.5);
        
        return {
            x: enemy.patrolCenter.x + Math.cos(angle) * radius,
            y: enemy.patrolCenter.y + Math.sin(angle) * radius
        };
    }

    private generateRetreatWaypoint(enemy: EnemyShip): Vector2 {
        const awayFromPlayer = {
            x: enemy.position.x - this.playerPosition.x,
            y: enemy.position.y - this.playerPosition.y
        };
        
        const distance = Math.sqrt(awayFromPlayer.x * awayFromPlayer.x + awayFromPlayer.y * awayFromPlayer.y);
        if (distance === 0) {
            return { x: enemy.position.x + 500, y: enemy.position.y };
        }
        
        awayFromPlayer.x /= distance;
        awayFromPlayer.y /= distance;
        
        return {
            x: enemy.position.x + awayFromPlayer.x * 800,
            y: enemy.position.y + awayFromPlayer.y * 800
        };
    }

    private calculateRetreatPoint(from: Vector2, away: Vector2): Vector2 {
        const direction = {
            x: from.x - away.x,
            y: from.y - away.y
        };
        
        const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (distance === 0) return from;
        
        direction.x /= distance;
        direction.y /= distance;
        
        return {
            x: from.x + direction.x * 200,
            y: from.y + direction.y * 200
        };
    }

    private calculateEvasionPoint(enemy: EnemyShip): Vector2 {
        // Move perpendicular to player direction
        const toPlayer = {
            x: this.playerPosition.x - enemy.position.x,
            y: this.playerPosition.y - enemy.position.y
        };
        
        const distance = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.y * toPlayer.y);
        if (distance === 0) return enemy.position;
        
        // Perpendicular direction
        const perpendicular = {
            x: -toPlayer.y / distance,
            y: toPlayer.x / distance
        };
        
        // Random side
        if (Math.random() < 0.5) {
            perpendicular.x *= -1;
            perpendicular.y *= -1;
        }
        
        return {
            x: enemy.position.x + perpendicular.x * 300,
            y: enemy.position.y + perpendicular.y * 300
        };
    }

    private predictPlayerPosition(seconds: number): Vector2 {
        return {
            x: this.playerPosition.x + this.playerVelocity.x * seconds,
            y: this.playerPosition.y + this.playerVelocity.y * seconds
        };
    }

    private hasLineOfSight(from: Vector2, to: Vector2): boolean {
        // Simplified - assume always true for now
        // In a real implementation, this would check for obstacles
        return true;
    }

    private calculateDistance(pos1: Vector2, pos2: Vector2): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private lerpAngle(from: number, to: number, factor: number): number {
        let diff = to - from;
        
        // Wrap difference to [-π, π]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        return from + diff * factor;
    }

    /**
     * Render enemies
     */
    render(renderer: Renderer): void {
        for (const enemy of this.enemies.values()) {
            if (enemy.isAlive) {
                this.renderEnemy(renderer, enemy);
            }
        }
    }

    /**
     * Render individual enemy
     */
    private renderEnemy(renderer: Renderer, enemy: EnemyShip): void {
        const pos = enemy.position;
        const size = enemy.config.size;
        
        // Get ship color based on faction and class
        const color = this.getShipColor(enemy.config.faction, enemy.config.shipClass);
        
        // Draw ship body
        if (enemy.config.shipClass === ShipClass.Drone) {
            // Small triangle for drones
            const points = this.getTrianglePoints(pos, size * 0.5, enemy.rotation);
            this.drawTriangle(renderer, points, color);
        } else {
            // Larger ships as rectangles with details
            this.drawShip(renderer, pos, size, enemy.rotation, color);
        }
        
        // Draw health bar
        this.drawHealthBar(renderer, enemy);
        
        // Draw AI state indicator (debug)
        if (enemy.state !== AIState.Idle) {
            this.drawStateIndicator(renderer, enemy);
        }
    }

    private getShipColor(faction: string, shipClass: ShipClass): Color {
        const factionColors: { [key: string]: Color } = {
            pirates: { r: 72, g: 24, b: 24 },     // Dark red
            aliens: { r: 48, g: 24, b: 72 },      // Dark purple
            rebels: { r: 24, g: 48, b: 24 },      // Dark green
            corporation: { r: 48, g: 48, b: 32 }, // Dark yellow
            military: { r: 32, g: 32, b: 48 }     // Dark blue
        };
        
        return factionColors[faction] || { r: 48, g: 48, b: 48 };
    }

    private getTrianglePoints(center: Vector2, size: number, rotation: number): Vector2[] {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        return [
            {
                x: center.x + cos * size,
                y: center.y + sin * size
            },
            {
                x: center.x + cos * (-size * 0.5) - sin * (size * 0.5),
                y: center.y + sin * (-size * 0.5) + cos * (size * 0.5)
            },
            {
                x: center.x + cos * (-size * 0.5) - sin * (-size * 0.5),
                y: center.y + sin * (-size * 0.5) + cos * (-size * 0.5)
            }
        ];
    }

    private drawTriangle(renderer: Renderer, points: Vector2[], color: Color): void {
        // Draw triangle outline
        for (let i = 0; i < points.length; i++) {
            const next = (i + 1) % points.length;
            renderer.drawLine(points[i].x, points[i].y, points[next].x, points[next].y, color);
        }
    }

    private drawShip(renderer: Renderer, pos: Vector2, size: number, rotation: number, color: Color): void {
        // Simple ship representation as oriented rectangle
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const halfWidth = size * 0.3;
        const halfHeight = size * 0.6;
        
        const corners = [
            { x: pos.x + cos * halfHeight - sin * halfWidth, y: pos.y + sin * halfHeight + cos * halfWidth },
            { x: pos.x + cos * halfHeight - sin * (-halfWidth), y: pos.y + sin * halfHeight + cos * (-halfWidth) },
            { x: pos.x + cos * (-halfHeight) - sin * (-halfWidth), y: pos.y + sin * (-halfHeight) + cos * (-halfWidth) },
            { x: pos.x + cos * (-halfHeight) - sin * halfWidth, y: pos.y + sin * (-halfHeight) + cos * halfWidth }
        ];
        
        // Draw ship outline
        for (let i = 0; i < corners.length; i++) {
            const next = (i + 1) % corners.length;
            renderer.drawLine(corners[i].x, corners[i].y, corners[next].x, corners[next].y, color);
        }
        
        // Draw front indicator
        const frontX = pos.x + cos * halfHeight;
        const frontY = pos.y + sin * halfHeight;
        renderer.fillRect(frontX - 1, frontY - 1, 2, 2, color);
    }

    private drawHealthBar(renderer: Renderer, enemy: EnemyShip): void {
        const pos = enemy.position;
        const size = enemy.config.size;
        
        const barWidth = size * 1.2;
        const barHeight = 3;
        const barY = pos.y - size * 0.8;
        
        // Background
        renderer.fillRect(pos.x - barWidth/2, barY, barWidth, barHeight, { r: 16, g: 16, b: 16 });
        
        // Health
        const healthPercent = enemy.config.hull / enemy.config.maxHull;
        const healthWidth = barWidth * healthPercent;
        const healthColor = healthPercent > 0.6 ? 
            { r: 12, g: 36, b: 12 } : 
            healthPercent > 0.3 ? 
                { r: 72, g: 48, b: 12 } : 
                { r: 72, g: 24, b: 24 };
        
        renderer.fillRect(pos.x - barWidth/2, barY, healthWidth, barHeight, healthColor);
        
        // Shields (if any)
        if (enemy.config.maxShields > 0) {
            const shieldPercent = enemy.config.shields / enemy.config.maxShields;
            const shieldWidth = barWidth * shieldPercent;
            renderer.fillRect(pos.x - barWidth/2, barY - 5, shieldWidth, 2, { r: 16, g: 40, b: 32 });
        }
    }

    private drawStateIndicator(renderer: Renderer, enemy: EnemyShip): void {
        const pos = enemy.position;
        const stateColors: { [key: string]: Color } = {
            [AIState.Patrol]: { r: 32, g: 32, b: 32 },
            [AIState.Pursue]: { r: 72, g: 48, b: 12 },
            [AIState.Attack]: { r: 72, g: 24, b: 24 },
            [AIState.Evade]: { r: 12, g: 36, b: 12 },
            [AIState.Retreat]: { r: 48, g: 32, b: 72 },
            [AIState.Ramming]: { r: 96, g: 32, b: 32 }
        };
        
        const color = stateColors[enemy.state] || { r: 48, g: 48, b: 48 };
        renderer.fillRect(pos.x - 3, pos.y + enemy.config.size + 5, 6, 6, color);
    }

    /**
     * Get all enemies
     */
    getAllEnemies(): EnemyShip[] {
        return Array.from(this.enemies.values()).filter(e => e.isAlive);
    }

    /**
     * Get enemy by ID
     */
    getEnemy(enemyId: string): EnemyShip | null {
        return this.enemies.get(enemyId) || null;
    }

    /**
     * Get AI statistics
     */
    getStats(): {
        totalEnemies: number;
        aliveEnemies: number;
        enemiesByFaction: { [faction: string]: number };
        enemiesByState: { [state: string]: number };
    } {
        const enemiesByFaction: { [faction: string]: number } = {};
        const enemiesByState: { [state: string]: number } = {};
        
        let aliveCount = 0;
        
        for (const enemy of this.enemies.values()) {
            if (enemy.isAlive) {
                aliveCount++;
                enemiesByFaction[enemy.config.faction] = (enemiesByFaction[enemy.config.faction] || 0) + 1;
                enemiesByState[enemy.state] = (enemiesByState[enemy.state] || 0) + 1;
            }
        }
        
        return {
            totalEnemies: this.enemies.size,
            aliveEnemies: aliveCount,
            enemiesByFaction,
            enemiesByState
        };
    }

    /**
     * Clear all enemies
     */
    clearEnemies(): void {
        for (const [enemyId] of this.enemies.entries()) {
            this.destroyEnemy(enemyId);
        }
        this.enemies.clear();
    }
}