/**
 * Weapon System
 * Complete combat mechanics with projectiles, targeting, and damage
 */

import { Logger } from '@utils/Logger';
import { Vector2, Renderer, Color } from '@core/Renderer';
import { GameItem } from '@items/ItemSystem';

export enum WeaponType {
    Energy = 'energy',
    Projectile = 'projectile', 
    Missile = 'missile',
    Plasma = 'plasma',
    Beam = 'beam',
    Torpedo = 'torpedo'
}

export enum DamageType {
    Kinetic = 'kinetic',
    Energy = 'energy',
    Thermal = 'thermal',
    Electromagnetic = 'electromagnetic',
    Explosive = 'explosive'
}

export enum TargetingMode {
    Manual = 'manual',
    Assisted = 'assisted',
    Automatic = 'automatic',
    PointDefense = 'point_defense'
}

export interface WeaponStats {
    damage: number;
    range: number;
    fireRate: number; // shots per second
    energyCost: number;
    accuracy: number; // 0-1
    penetration: number;
    spread: number; // degrees
    chargeTime: number; // seconds
    cooldownTime: number; // seconds
    ammoCapacity?: number;
    reloadTime?: number;
}

export interface WeaponConfig {
    id: string;
    name: string;
    type: WeaponType;
    damageType: DamageType;
    stats: WeaponStats;
    item?: GameItem;
    mountPoint: Vector2;
    hardpointSize: 'small' | 'medium' | 'large';
}

export interface Projectile {
    id: string;
    position: Vector2;
    velocity: Vector2;
    damage: number;
    damageType: DamageType;
    range: number;
    maxRange: number;
    size: number;
    weaponId: string;
    targetId?: string;
    penetration: number;
    isHoming: boolean;
    homingStrength: number;
    life: number; // 0-1
    trail: Vector2[];
}

export interface DamageResult {
    targetId: string;
    damage: number;
    damageType: DamageType;
    criticalHit: boolean;
    penetrated: boolean;
    shieldsHit: boolean;
    hullHit: boolean;
}

export interface WeaponEvents {
    onWeaponFired?: (weapon: WeaponConfig, projectile: Projectile) => void;
    onProjectileHit?: (projectile: Projectile, result: DamageResult) => void;
    onWeaponOverheat?: (weapon: WeaponConfig) => void;
    onAmmoEmpty?: (weapon: WeaponConfig) => void;
}

export class WeaponSystem {
    private weapons: Map<string, WeaponConfig> = new Map();
    private projectiles: Map<string, Projectile> = new Map();
    private weaponStates: Map<string, {
        isCharging: boolean;
        chargeProgress: number;
        lastFired: number;
        heat: number;
        ammo: number;
        isOverheated: boolean;
        cooldownEnd: number;
    }> = new Map();
    
    private events: WeaponEvents;
    private nextProjectileId: number = 0;
    
    // Targeting system
    private targetingMode: TargetingMode = TargetingMode.Manual;
    private currentTarget: string | null = null;
    private targetPosition: Vector2 | null = null;
    private targets: Map<string, { position: Vector2, velocity: Vector2, size: number }> = new Map();
    
    private logger: Logger;

    constructor(events: WeaponEvents = {}) {
        this.logger = new Logger('WeaponSystem');
        this.events = events;
        
        this.logger.info('⚔️ Weapon system initialized');
    }

    /**
     * Add weapon to system
     */
    addWeapon(weapon: WeaponConfig): void {
        this.weapons.set(weapon.id, weapon);
        this.weaponStates.set(weapon.id, {
            isCharging: false,
            chargeProgress: 0,
            lastFired: 0,
            heat: 0,
            ammo: weapon.stats.ammoCapacity || -1, // -1 for infinite energy weapons
            isOverheated: false,
            cooldownEnd: 0
        });
        
        this.logger.info(`🔫 Added weapon: ${weapon.name}`, {
            type: weapon.type,
            damage: weapon.stats.damage,
            range: weapon.stats.range
        });
    }

    /**
     * Remove weapon from system
     */
    removeWeapon(weaponId: string): void {
        this.weapons.delete(weaponId);
        this.weaponStates.delete(weaponId);
        
        // Remove projectiles from this weapon
        for (const [projId, projectile] of this.projectiles.entries()) {
            if (projectile.weaponId === weaponId) {
                this.projectiles.delete(projId);
            }
        }
        
        this.logger.info(`🔫 Removed weapon: ${weaponId}`);
    }

    /**
     * Fire weapon
     */
    fireWeapon(weaponId: string, sourcePosition: Vector2, targetPosition?: Vector2): boolean {
        const weapon = this.weapons.get(weaponId);
        const state = this.weaponStates.get(weaponId);
        
        if (!weapon || !state) return false;
        
        const currentTime = Date.now() / 1000;
        
        // Check if weapon can fire
        if (state.isOverheated || currentTime < state.cooldownEnd) {
            return false;
        }
        
        // Check fire rate
        const timeSinceLastShot = currentTime - state.lastFired;
        const minInterval = 1 / weapon.stats.fireRate;
        if (timeSinceLastShot < minInterval) {
            return false;
        }
        
        // Check ammo
        if (state.ammo === 0) {
            this.events.onAmmoEmpty?.(weapon);
            return false;
        }
        
        // For charge weapons, handle charging
        if (weapon.stats.chargeTime > 0) {
            if (!state.isCharging) {
                state.isCharging = true;
                state.chargeProgress = 0;
                return false; // Start charging, don't fire yet
            } else if (state.chargeProgress < 1.0) {
                return false; // Still charging
            }
        }
        
        // Determine target position
        let finalTargetPos = targetPosition;
        if (!finalTargetPos) {
            if (this.targetPosition) {
                finalTargetPos = this.targetPosition;
            } else if (this.currentTarget && this.targets.has(this.currentTarget)) {
                finalTargetPos = this.targets.get(this.currentTarget)!.position;
            } else {
                // Default forward firing
                finalTargetPos = {
                    x: sourcePosition.x + weapon.stats.range,
                    y: sourcePosition.y
                };
            }
        }
        
        // Calculate firing direction with spread
        const direction = this.calculateFiringDirection(sourcePosition, finalTargetPos, weapon.stats.spread);
        
        // Create projectile
        const projectile = this.createProjectile(weapon, sourcePosition, direction, finalTargetPos);
        this.projectiles.set(projectile.id, projectile);
        
        // Update weapon state
        state.lastFired = currentTime;
        state.heat += 0.1; // Weapons generate heat
        state.isCharging = false;
        state.chargeProgress = 0;
        
        if (state.ammo > 0) {
            state.ammo--;
        }
        
        // Check for overheat
        if (state.heat > 1.0) {
            state.isOverheated = true;
            state.cooldownEnd = currentTime + weapon.stats.cooldownTime;
            this.events.onWeaponOverheat?.(weapon);
        }
        
        this.events.onWeaponFired?.(weapon, projectile);
        
        this.logger.debug(`🔥 Fired ${weapon.name}`, {
            damage: projectile.damage,
            range: projectile.maxRange,
            targetDistance: this.calculateDistance(sourcePosition, finalTargetPos)
        });
        
        return true;
    }

    /**
     * Create projectile from weapon
     */
    private createProjectile(weapon: WeaponConfig, sourcePos: Vector2, direction: Vector2, targetPos: Vector2): Projectile {
        const projectileId = `proj_${weapon.id}_${this.nextProjectileId++}`;
        
        // Calculate velocity based on weapon type
        let speed = 500; // Default speed
        let isHoming = false;
        let homingStrength = 0;
        
        switch (weapon.type) {
            case WeaponType.Energy:
                speed = 800;
                break;
            case WeaponType.Projectile:
                speed = 600;
                break;
            case WeaponType.Missile:
                speed = 300;
                isHoming = true;
                homingStrength = 0.1;
                break;
            case WeaponType.Plasma:
                speed = 400;
                break;
            case WeaponType.Beam:
                speed = 1200; // Very fast
                break;
            case WeaponType.Torpedo:
                speed = 250;
                isHoming = true;
                homingStrength = 0.15;
                break;
        }
        
        const velocity = {
            x: direction.x * speed,
            y: direction.y * speed
        };
        
        return {
            id: projectileId,
            position: { ...sourcePos },
            velocity,
            damage: weapon.stats.damage,
            damageType: weapon.damageType,
            range: 0,
            maxRange: weapon.stats.range,
            size: this.getProjectileSize(weapon.type),
            weaponId: weapon.id,
            targetId: this.currentTarget || undefined,
            penetration: weapon.stats.penetration,
            isHoming,
            homingStrength,
            life: 1.0,
            trail: []
        };
    }

    /**
     * Get projectile visual size based on weapon type
     */
    private getProjectileSize(weaponType: WeaponType): number {
        switch (weaponType) {
            case WeaponType.Energy: return 2;
            case WeaponType.Projectile: return 1;
            case WeaponType.Missile: return 4;
            case WeaponType.Plasma: return 3;
            case WeaponType.Beam: return 1;
            case WeaponType.Torpedo: return 6;
            default: return 2;
        }
    }

    /**
     * Calculate firing direction with accuracy and spread
     */
    private calculateFiringDirection(sourcePos: Vector2, targetPos: Vector2, spread: number): Vector2 {
        // Base direction to target
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) {
            return { x: 1, y: 0 }; // Default forward
        }
        
        // Normalize
        let direction = {
            x: dx / distance,
            y: dy / distance
        };
        
        // Apply spread (inaccuracy)
        if (spread > 0) {
            const spreadRad = (spread * Math.PI / 180) * (Math.random() - 0.5);
            const cos = Math.cos(spreadRad);
            const sin = Math.sin(spreadRad);
            
            direction = {
                x: direction.x * cos - direction.y * sin,
                y: direction.x * sin + direction.y * cos
            };
        }
        
        return direction;
    }

    /**
     * Update weapon system
     */
    update(deltaTime: number): void {
        this.updateWeaponStates(deltaTime);
        this.updateProjectiles(deltaTime);
        this.checkProjectileHits();
        this.cleanupProjectiles();
    }

    /**
     * Update weapon states (cooling, charging, etc.)
     */
    private updateWeaponStates(deltaTime: number): void {
        const currentTime = Date.now() / 1000;
        
        for (const [weaponId, state] of this.weaponStates.entries()) {
            const weapon = this.weapons.get(weaponId);
            if (!weapon) continue;
            
            // Cool down heat
            if (state.heat > 0) {
                state.heat = Math.max(0, state.heat - deltaTime * 0.5); // Heat dissipation rate
            }
            
            // Check if cooled down from overheat
            if (state.isOverheated && currentTime >= state.cooldownEnd) {
                state.isOverheated = false;
                state.heat = 0;
            }
            
            // Update charging
            if (state.isCharging && weapon.stats.chargeTime > 0) {
                state.chargeProgress = Math.min(1.0, state.chargeProgress + deltaTime / weapon.stats.chargeTime);
            }
        }
    }

    /**
     * Update projectile movement and behavior
     */
    private updateProjectiles(deltaTime: number): void {
        for (const [projId, projectile] of this.projectiles.entries()) {
            // Update position
            projectile.position.x += projectile.velocity.x * deltaTime;
            projectile.position.y += projectile.velocity.y * deltaTime;
            
            // Update range
            projectile.range += Math.sqrt(
                projectile.velocity.x * projectile.velocity.x + 
                projectile.velocity.y * projectile.velocity.y
            ) * deltaTime;
            
            // Update trail
            if (projectile.trail.length > 10) {
                projectile.trail.shift(); // Remove oldest position
            }
            projectile.trail.push({ ...projectile.position });
            
            // Homing behavior
            if (projectile.isHoming && projectile.targetId && this.targets.has(projectile.targetId)) {
                this.updateHomingProjectile(projectile, deltaTime);
            }
            
            // Update life based on range
            projectile.life = Math.max(0, 1 - (projectile.range / projectile.maxRange));
        }
    }

    /**
     * Update homing projectile guidance
     */
    private updateHomingProjectile(projectile: Projectile, deltaTime: number): void {
        const target = this.targets.get(projectile.targetId!);
        if (!target) return;
        
        // Predict target position
        const predictedPos = {
            x: target.position.x + target.velocity.x * 0.5, // 0.5 second prediction
            y: target.position.y + target.velocity.y * 0.5
        };
        
        // Calculate direction to predicted position
        const dx = predictedPos.x - projectile.position.x;
        const dy = predictedPos.y - projectile.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const targetDirection = {
                x: dx / distance,
                y: dy / distance
            };
            
            // Current velocity direction
            const speed = Math.sqrt(
                projectile.velocity.x * projectile.velocity.x + 
                projectile.velocity.y * projectile.velocity.y
            );
            
            // Interpolate toward target direction
            const currentDirection = {
                x: projectile.velocity.x / speed,
                y: projectile.velocity.y / speed
            };
            
            const homingFactor = projectile.homingStrength * deltaTime * 10;
            const newDirection = {
                x: currentDirection.x + (targetDirection.x - currentDirection.x) * homingFactor,
                y: currentDirection.y + (targetDirection.y - currentDirection.y) * homingFactor
            };
            
            // Normalize and apply
            const newLength = Math.sqrt(newDirection.x * newDirection.x + newDirection.y * newDirection.y);
            if (newLength > 0) {
                projectile.velocity.x = (newDirection.x / newLength) * speed;
                projectile.velocity.y = (newDirection.y / newLength) * speed;
            }
        }
    }

    /**
     * Check for projectile hits against targets
     */
    private checkProjectileHits(): void {
        for (const [projId, projectile] of this.projectiles.entries()) {
            for (const [targetId, target] of this.targets.entries()) {
                const distance = this.calculateDistance(projectile.position, target.position);
                const hitRadius = projectile.size + target.size;
                
                if (distance <= hitRadius) {
                    // Hit detected
                    const damage = this.calculateDamage(projectile, target);
                    const result: DamageResult = {
                        targetId,
                        damage: damage.finalDamage,
                        damageType: projectile.damageType,
                        criticalHit: damage.critical,
                        penetrated: damage.penetrated,
                        shieldsHit: damage.shieldsHit,
                        hullHit: damage.hullHit
                    };
                    
                    this.events.onProjectileHit?.(projectile, result);
                    
                    // Remove projectile unless it penetrates
                    if (!damage.penetrated) {
                        this.projectiles.delete(projId);
                    }
                    
                    this.logger.debug(`💥 Projectile hit`, {
                        targetId,
                        damage: damage.finalDamage,
                        critical: damage.critical
                    });
                    
                    break; // One hit per projectile per frame
                }
            }
        }
    }

    /**
     * Calculate damage from projectile hit
     */
    private calculateDamage(projectile: Projectile, target: { position: Vector2, velocity: Vector2, size: number }): {
        finalDamage: number;
        critical: boolean;
        penetrated: boolean;
        shieldsHit: boolean;
        hullHit: boolean;
    } {
        let damage = projectile.damage;
        let critical = false;
        let penetrated = false;
        
        // Critical hit chance (5% base)
        if (Math.random() < 0.05) {
            critical = true;
            damage *= 2;
        }
        
        // Damage falloff with range
        const falloff = Math.max(0.3, 1 - (projectile.range / projectile.maxRange) * 0.5);
        damage *= falloff;
        
        // Penetration check (simplified)
        if (projectile.penetration > 0.7) {
            penetrated = Math.random() < 0.3;
        }
        
        return {
            finalDamage: Math.floor(damage),
            critical,
            penetrated,
            shieldsHit: true, // Simplified - assume shields absorb first
            hullHit: penetrated
        };
    }

    /**
     * Remove expired projectiles
     */
    private cleanupProjectiles(): void {
        for (const [projId, projectile] of this.projectiles.entries()) {
            if (projectile.life <= 0 || projectile.range >= projectile.maxRange) {
                this.projectiles.delete(projId);
            }
        }
    }

    /**
     * Set targeting mode
     */
    setTargetingMode(mode: TargetingMode): void {
        this.targetingMode = mode;
        this.logger.debug(`🎯 Targeting mode: ${mode}`);
    }

    /**
     * Set manual target position
     */
    setTargetPosition(position: Vector2): void {
        this.targetPosition = { ...position };
    }

    /**
     * Set current target
     */
    setTarget(targetId: string | null): void {
        this.currentTarget = targetId;
        this.logger.debug(`🎯 Target: ${targetId || 'none'}`);
    }

    /**
     * Add/update target for tracking
     */
    updateTarget(targetId: string, position: Vector2, velocity: Vector2, size: number): void {
        this.targets.set(targetId, { position: { ...position }, velocity: { ...velocity }, size });
    }

    /**
     * Remove target from tracking
     */
    removeTarget(targetId: string): void {
        this.targets.delete(targetId);
        if (this.currentTarget === targetId) {
            this.currentTarget = null;
        }
    }

    /**
     * Get weapon information
     */
    getWeapon(weaponId: string): { weapon: WeaponConfig; state: any } | null {
        const weapon = this.weapons.get(weaponId);
        const state = this.weaponStates.get(weaponId);
        
        if (!weapon || !state) return null;
        
        return { weapon, state };
    }

    /**
     * Get all weapons
     */
    getAllWeapons(): Array<{ weapon: WeaponConfig; state: any }> {
        const result: Array<{ weapon: WeaponConfig; state: any }> = [];
        
        for (const [weaponId, weapon] of this.weapons.entries()) {
            const state = this.weaponStates.get(weaponId);
            if (state) {
                result.push({ weapon, state });
            }
        }
        
        return result;
    }

    /**
     * Reload weapon
     */
    reloadWeapon(weaponId: string): boolean {
        const weapon = this.weapons.get(weaponId);
        const state = this.weaponStates.get(weaponId);
        
        if (!weapon || !state || !weapon.stats.ammoCapacity) return false;
        
        state.ammo = weapon.stats.ammoCapacity;
        this.logger.debug(`🔄 Reloaded ${weapon.name}`);
        
        return true;
    }

    /**
     * Render weapon effects
     */
    render(renderer: Renderer): void {
        this.renderProjectiles(renderer);
        this.renderWeaponCharges(renderer);
    }

    /**
     * Render projectiles and their trails
     */
    private renderProjectiles(renderer: Renderer): void {
        for (const projectile of this.projectiles.values()) {
            // Render trail
            if (projectile.trail.length > 1) {
                for (let i = 1; i < projectile.trail.length; i++) {
                    const alpha = (i / projectile.trail.length) * projectile.life;
                    const trailColor = this.getProjectileColor(projectile, alpha * 0.5);
                    
                    renderer.drawLine(
                        projectile.trail[i-1].x, projectile.trail[i-1].y,
                        projectile.trail[i].x, projectile.trail[i].y,
                        trailColor
                    );
                }
            }
            
            // Render projectile
            const color = this.getProjectileColor(projectile, projectile.life);
            const size = projectile.size * projectile.life;
            
            if (projectile.size > 2) {
                // Larger projectiles as filled circles
                renderer.drawCircle(projectile.position.x, projectile.position.y, size, color, true);
            } else {
                // Small projectiles as pixels
                renderer.fillRect(
                    projectile.position.x - size/2, 
                    projectile.position.y - size/2, 
                    size, size, color
                );
            }
        }
    }

    /**
     * Get projectile color based on weapon type
     */
    private getProjectileColor(projectile: Projectile, alpha: number): Color {
        const weapon = this.weapons.get(projectile.weaponId);
        if (!weapon) return { r: 48, g: 48, b: 48 };
        
        let baseColor: Color;
        
        switch (weapon.type) {
            case WeaponType.Energy:
                baseColor = { r: 16, g: 48, b: 16 }; // Green energy
                break;
            case WeaponType.Projectile:
                baseColor = { r: 96, g: 64, b: 16 }; // Orange projectile
                break;
            case WeaponType.Missile:
                baseColor = { r: 72, g: 24, b: 24 }; // Red missile
                break;
            case WeaponType.Plasma:
                baseColor = { r: 48, g: 24, b: 72 }; // Purple plasma
                break;
            case WeaponType.Beam:
                baseColor = { r: 32, g: 80, b: 64 }; // Cyan beam
                break;
            case WeaponType.Torpedo:
                baseColor = { r: 64, g: 32, b: 96 }; // Magenta torpedo
                break;
            default:
                baseColor = { r: 48, g: 48, b: 48 };
        }
        
        return {
            r: Math.floor(baseColor.r * alpha),
            g: Math.floor(baseColor.g * alpha),
            b: Math.floor(baseColor.b * alpha)
        };
    }

    /**
     * Render weapon charge indicators
     */
    private renderWeaponCharges(renderer: Renderer): void {
        // TODO: Render charging indicators for weapons that require charging
        // This would show charge progress bars near weapon hardpoints
    }

    /**
     * Calculate distance between two points
     */
    private calculateDistance(pos1: Vector2, pos2: Vector2): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get weapon system statistics
     */
    getStats(): {
        totalWeapons: number;
        activeProjectiles: number;
        targetsTracked: number;
        weaponsByType: { [type: string]: number };
    } {
        const weaponsByType: { [type: string]: number } = {};
        
        for (const weapon of this.weapons.values()) {
            weaponsByType[weapon.type] = (weaponsByType[weapon.type] || 0) + 1;
        }
        
        return {
            totalWeapons: this.weapons.size,
            activeProjectiles: this.projectiles.size,
            targetsTracked: this.targets.size,
            weaponsByType
        };
    }

    /**
     * Clear all projectiles (for cleanup/reset)
     */
    clearProjectiles(): void {
        this.projectiles.clear();
    }

    /**
     * Clear all targets
     */
    clearTargets(): void {
        this.targets.clear();
        this.currentTarget = null;
    }
}