/**
 * Ship Systems Manager
 * Handles all ship subsystems including engines, shields, weapons, life support, and damage
 */

import { Logger } from '@utils/Logger';
import { Vector2 } from '@core/Renderer';

export interface ShipSystemsConfig {
    maxHull: number;
    maxShields: number;
    maxPower: number;
    maxFuel: number;
    maxHeat: number;
    
    // Engine configuration
    enginePower: number;
    engineEfficiency: number;
    
    // Shield configuration
    shieldRegenRate: number;
    shieldPowerDrain: number;
    
    // Weapon configuration
    weaponCount: number;
    weaponPower: number;
    weaponHeatGeneration: number;
}

export interface SystemStatus {
    hull: number;           // 0-100%
    shields: number;        // 0-100%
    power: number;          // 0-100%
    fuel: number;           // 0-100%
    heat: number;           // 0-100%
    
    // System states
    enginesOnline: boolean;
    shieldsOnline: boolean;
    weaponsOnline: boolean;
    lifeSupport: boolean;
    warpDrive: boolean;
    
    // Performance modifiers
    engineEfficiency: number;  // 0-1
    shieldStrength: number;    // 0-1
    weaponAccuracy: number;    // 0-1
    sensorRange: number;       // 0-1
}

export interface DamageReport {
    section: ShipSection;
    severity: DamageSeverity;
    systemsAffected: SystemType[];
    repairCost: RepairCost;
    repairTime: number; // seconds
}

export interface RepairCost {
    metal: number;
    electronics: number;
    crystals: number;
    nanobots?: number;
}

export enum ShipSection {
    Bow = 'bow',
    Stern = 'stern',
    Port = 'port',
    Starboard = 'starboard',
    Core = 'core',
    Bridge = 'bridge',
    Engineering = 'engineering',
    Weapons = 'weapons'
}

export enum SystemType {
    Engines = 'engines',
    Shields = 'shields',
    Weapons = 'weapons',
    LifeSupport = 'life_support',
    Sensors = 'sensors',
    Navigation = 'navigation',
    Communications = 'communications',
    WarpDrive = 'warp_drive'
}

export enum DamageSeverity {
    Minor = 'minor',       // 0-25% damage
    Moderate = 'moderate', // 25-50% damage
    Major = 'major',       // 50-75% damage
    Critical = 'critical', // 75-100% damage
    Destroyed = 'destroyed' // 100% damage
}

export interface PowerAllocation {
    engines: number;    // 0-100%
    shields: number;    // 0-100%
    weapons: number;    // 0-100%
    lifeSupport: number; // 0-100%
    sensors: number;    // 0-100%
}

export interface ShipSystemsEvents {
    onSystemDamage: (system: SystemType, severity: DamageSeverity) => void;
    onSystemRepaired: (system: SystemType) => void;
    onCriticalDamage: (section: ShipSection) => void;
    onPowerFailure: () => void;
    onOverheat: () => void;
}

export class ShipSystems {
    private config: ShipSystemsConfig;
    private status: SystemStatus;
    private damage: Map<ShipSection, DamageReport[]> = new Map();
    private powerAllocation: PowerAllocation;
    
    // System performance tracking
    private heatGeneration: number = 0;
    private powerConsumption: number = 0;
    private fuelConsumption: number = 0;
    
    // Timers and intervals
    private updateTimer: number = 0;
    private lastUpdateTime: number = 0;
    
    // Events
    private events: Partial<ShipSystemsEvents> = {};
    
    private logger: Logger;

    constructor(config: Partial<ShipSystemsConfig> = {}, events: Partial<ShipSystemsEvents> = {}) {
        this.logger = new Logger('ShipSystems');
        this.events = events;
        
        // Default configuration
        this.config = {
            maxHull: 100,
            maxShields: 100,
            maxPower: 100,
            maxFuel: 1000,
            maxHeat: 100,
            enginePower: 5000,
            engineEfficiency: 0.8,
            shieldRegenRate: 2.0,
            shieldPowerDrain: 5.0,
            weaponCount: 2,
            weaponPower: 25,
            weaponHeatGeneration: 15,
            ...config
        };
        
        // Initialize status
        this.status = {
            hull: 100,
            shields: 100,
            power: 100,
            fuel: 100,
            heat: 0,
            enginesOnline: true,
            shieldsOnline: true,
            weaponsOnline: true,
            lifeSupport: true,
            warpDrive: true,
            engineEfficiency: 1.0,
            shieldStrength: 1.0,
            weaponAccuracy: 1.0,
            sensorRange: 1.0
        };
        
        // Initialize power allocation
        this.powerAllocation = {
            engines: 30,
            shields: 25,
            weapons: 20,
            lifeSupport: 15,
            sensors: 10
        };
        
        // Initialize damage tracking for all sections
        Object.values(ShipSection).forEach(section => {
            this.damage.set(section, []);
        });
        
        this.logger.info('🛸 Ship systems initialized', {
            config: this.config,
            status: this.status
        });
    }

    /**
     * Update ship systems (called each frame)
     */
    update(deltaTime: number): void {
        this.lastUpdateTime = deltaTime;
        
        // Update power consumption
        this.updatePowerConsumption();
        
        // Update heat generation and cooling
        this.updateThermalManagement(deltaTime);
        
        // Update shields
        this.updateShields(deltaTime);
        
        // Update fuel consumption
        this.updateFuelConsumption(deltaTime);
        
        // Update system efficiency based on damage
        this.updateSystemEfficiency();
        
        // Check for critical system failures
        this.checkCriticalSystems();
        
        // Update performance modifiers
        this.updatePerformanceModifiers();
    }

    /**
     * Update power consumption based on active systems
     */
    private updatePowerConsumption(): void {
        let totalConsumption = 0;
        
        // Base life support always consumes power
        totalConsumption += (this.powerAllocation.lifeSupport / 100) * 10;
        
        // Engine power consumption
        if (this.status.enginesOnline) {
            totalConsumption += (this.powerAllocation.engines / 100) * 20;
        }
        
        // Shield power consumption
        if (this.status.shieldsOnline) {
            totalConsumption += (this.powerAllocation.shields / 100) * this.config.shieldPowerDrain;
        }
        
        // Weapon power consumption
        if (this.status.weaponsOnline) {
            totalConsumption += (this.powerAllocation.weapons / 100) * 15;
        }
        
        // Sensor power consumption
        totalConsumption += (this.powerAllocation.sensors / 100) * 5;
        
        this.powerConsumption = totalConsumption;
        
        // Drain power
        this.status.power = Math.max(0, this.status.power - (totalConsumption * this.lastUpdateTime));
        
        // Auto-shutdown systems if power critical
        if (this.status.power < 10) {
            this.handlePowerFailure();
        }
    }

    /**
     * Update thermal management (heat generation and cooling)
     */
    private updateThermalManagement(deltaTime: number): void {
        // Heat generation
        this.heatGeneration = 0;
        
        // Engine heat
        if (this.status.enginesOnline) {
            this.heatGeneration += (this.powerAllocation.engines / 100) * 8;
        }
        
        // Shield heat
        if (this.status.shieldsOnline) {
            this.heatGeneration += (this.powerAllocation.shields / 100) * 3;
        }
        
        // Weapon heat
        if (this.status.weaponsOnline) {
            this.heatGeneration += (this.powerAllocation.weapons / 100) * 5;
        }
        
        // Add heat
        this.status.heat = Math.min(this.config.maxHeat, 
            this.status.heat + this.heatGeneration * deltaTime);
        
        // Passive cooling (space is cold)
        const coolingRate = 15; // Heat units per second
        this.status.heat = Math.max(0, this.status.heat - coolingRate * deltaTime);
        
        // Overheat protection
        if (this.status.heat > 90) {
            this.handleOverheat();
        }
    }

    /**
     * Update shields (regeneration and power drain)
     */
    private updateShields(deltaTime: number): void {
        if (this.status.shieldsOnline && this.status.power > 5) {
            // Shield regeneration
            const regenRate = this.config.shieldRegenRate * (this.powerAllocation.shields / 100);
            this.status.shields = Math.min(this.config.maxShields, 
                this.status.shields + regenRate * deltaTime);
        }
    }

    /**
     * Update fuel consumption
     */
    private updateFuelConsumption(deltaTime: number): void {
        if (this.status.enginesOnline) {
            // Base fuel consumption for life support
            let consumption = 0.5; // Units per second
            
            // Engine fuel consumption based on power allocation
            consumption += (this.powerAllocation.engines / 100) * 2.0;
            
            // Inefficiency increases consumption
            consumption *= (2.0 - this.status.engineEfficiency);
            
            this.fuelConsumption = consumption;
            this.status.fuel = Math.max(0, this.status.fuel - consumption * deltaTime);
            
            // Emergency shutdown if no fuel
            if (this.status.fuel === 0) {
                this.emergencyShutdown();
            }
        }
    }

    /**
     * Update system efficiency based on damage
     */
    private updateSystemEfficiency(): void {
        // Calculate engine efficiency based on engineering section damage
        const engineDamage = this.getSectionDamageLevel(ShipSection.Engineering);
        this.status.engineEfficiency = Math.max(0.1, 1.0 - (engineDamage * 0.8));
        
        // Calculate shield strength based on core section damage
        const coreDamage = this.getSectionDamageLevel(ShipSection.Core);
        this.status.shieldStrength = Math.max(0.1, 1.0 - (coreDamage * 0.9));
        
        // Calculate weapon accuracy based on weapons section damage
        const weaponDamage = this.getSectionDamageLevel(ShipSection.Weapons);
        this.status.weaponAccuracy = Math.max(0.1, 1.0 - (weaponDamage * 0.7));
        
        // Calculate sensor range based on bridge damage
        const bridgeDamage = this.getSectionDamageLevel(ShipSection.Bridge);
        this.status.sensorRange = Math.max(0.2, 1.0 - (bridgeDamage * 0.6));
    }

    /**
     * Update performance modifiers
     */
    private updatePerformanceModifiers(): void {
        // Heat affects all systems
        const heatPenalty = Math.max(0, (this.status.heat - 70) / 30); // Penalty starts at 70% heat
        
        this.status.engineEfficiency *= (1 - heatPenalty * 0.3);
        this.status.shieldStrength *= (1 - heatPenalty * 0.2);
        this.status.weaponAccuracy *= (1 - heatPenalty * 0.4);
        
        // Power affects system performance
        const powerLevel = this.status.power / 100;
        if (powerLevel < 0.5) {
            const powerPenalty = (0.5 - powerLevel) * 2; // 0 to 1
            this.status.engineEfficiency *= (1 - powerPenalty * 0.5);
            this.status.shieldStrength *= (1 - powerPenalty * 0.7);
            this.status.weaponAccuracy *= (1 - powerPenalty * 0.3);
        }
    }

    /**
     * Check for critical system failures
     */
    private checkCriticalSystems(): void {
        // Check hull integrity
        if (this.status.hull < 20) {
            this.logger.warn('⚠️ Critical hull damage detected');
            this.events.onCriticalDamage?.(ShipSection.Core);
        }
        
        // Check life support
        if (!this.status.lifeSupport || this.status.power < 5) {
            this.logger.error('💀 Life support critical');
        }
        
        // Check for system failures due to damage
        Object.entries(ShipSection).forEach(([key, section]) => {
            const damageLevel = this.getSectionDamageLevel(section);
            if (damageLevel > 0.8) {
                this.logger.warn(`⚠️ Critical damage in ${section} section`);
                this.events.onCriticalDamage?.(section);
            }
        });
    }

    /**
     * Handle power failure
     */
    private handlePowerFailure(): void {
        this.logger.error('⚡ Power failure - emergency protocols activated');
        
        // Auto-shutdown non-essential systems
        this.status.weaponsOnline = false;
        this.powerAllocation.weapons = 0;
        this.powerAllocation.sensors = 5; // Minimal sensors
        
        // Reduce other allocations
        this.powerAllocation.engines = Math.min(this.powerAllocation.engines, 20);
        this.powerAllocation.shields = Math.min(this.powerAllocation.shields, 15);
        
        this.events.onPowerFailure?.();
    }

    /**
     * Handle overheat
     */
    private handleOverheat(): void {
        this.logger.error('🔥 System overheat - emergency cooling');
        
        // Reduce power allocation to prevent further heating
        this.powerAllocation.engines *= 0.7;
        this.powerAllocation.weapons *= 0.5;
        
        // Emergency shutdown weapons if too hot
        if (this.status.heat > 95) {
            this.status.weaponsOnline = false;
            this.powerAllocation.weapons = 0;
        }
        
        this.events.onOverheat?.();
    }

    /**
     * Emergency shutdown
     */
    private emergencyShutdown(): void {
        this.logger.error('🛑 Emergency shutdown - no fuel');
        
        this.status.enginesOnline = false;
        this.status.weaponsOnline = false;
        this.status.shieldsOnline = false;
        
        // Keep minimal life support
        this.powerAllocation = {
            engines: 0,
            shields: 0,
            weapons: 0,
            lifeSupport: 100,
            sensors: 0
        };
    }

    /**
     * Apply damage to ship section
     */
    applyDamage(section: ShipSection, amount: number, damageType: 'kinetic' | 'energy' | 'thermal' = 'kinetic'): void {
        // Calculate actual damage based on shields
        let actualDamage = amount;
        
        if (this.status.shieldsOnline && this.status.shields > 0) {
            const shieldAbsorption = Math.min(this.status.shields, amount * this.status.shieldStrength);
            this.status.shields -= shieldAbsorption;
            actualDamage -= shieldAbsorption;
            
            this.logger.debug(`Shields absorbed ${shieldAbsorption.toFixed(1)} damage`);
        }
        
        if (actualDamage > 0) {
            // Apply hull damage
            this.status.hull = Math.max(0, this.status.hull - actualDamage);
            
            // Create damage report
            this.addDamageReport(section, actualDamage);
            
            this.logger.warn(`${section} section took ${actualDamage.toFixed(1)} ${damageType} damage`);
        }
    }

    /**
     * Add damage report
     */
    private addDamageReport(section: ShipSection, damage: number): void {
        const severity = this.calculateDamageSeverity(damage);
        const systemsAffected = this.getAffectedSystems(section);
        
        const damageReport: DamageReport = {
            section,
            severity,
            systemsAffected,
            repairCost: this.calculateRepairCost(severity),
            repairTime: this.calculateRepairTime(severity)
        };
        
        const sectionDamage = this.damage.get(section) || [];
        sectionDamage.push(damageReport);
        this.damage.set(section, sectionDamage);
        
        // Trigger events
        systemsAffected.forEach(system => {
            this.events.onSystemDamage?.(system, severity);
        });
    }

    /**
     * Calculate damage severity
     */
    private calculateDamageSeverity(damage: number): DamageSeverity {
        if (damage >= 50) return DamageSeverity.Critical;
        if (damage >= 30) return DamageSeverity.Major;
        if (damage >= 15) return DamageSeverity.Moderate;
        return DamageSeverity.Minor;
    }

    /**
     * Get systems affected by damage to a section
     */
    private getAffectedSystems(section: ShipSection): SystemType[] {
        const systemMap: Record<ShipSection, SystemType[]> = {
            [ShipSection.Bow]: [SystemType.Sensors, SystemType.Navigation],
            [ShipSection.Stern]: [SystemType.Engines],
            [ShipSection.Port]: [],
            [ShipSection.Starboard]: [],
            [ShipSection.Core]: [SystemType.LifeSupport, SystemType.Shields],
            [ShipSection.Bridge]: [SystemType.Navigation, SystemType.Communications, SystemType.Sensors],
            [ShipSection.Engineering]: [SystemType.Engines, SystemType.WarpDrive],
            [ShipSection.Weapons]: [SystemType.Weapons]
        };
        
        return systemMap[section] || [];
    }

    /**
     * Calculate repair cost
     */
    private calculateRepairCost(severity: DamageSeverity): RepairCost {
        const baseCost = {
            [DamageSeverity.Minor]: { metal: 5, electronics: 2, crystals: 1 },
            [DamageSeverity.Moderate]: { metal: 15, electronics: 8, crystals: 3 },
            [DamageSeverity.Major]: { metal: 30, electronics: 20, crystals: 8 },
            [DamageSeverity.Critical]: { metal: 60, electronics: 40, crystals: 20, nanobots: 5 },
            [DamageSeverity.Destroyed]: { metal: 100, electronics: 80, crystals: 40, nanobots: 15 }
        };
        
        return baseCost[severity];
    }

    /**
     * Calculate repair time
     */
    private calculateRepairTime(severity: DamageSeverity): number {
        const baseTimes = {
            [DamageSeverity.Minor]: 30,      // 30 seconds
            [DamageSeverity.Moderate]: 120,  // 2 minutes
            [DamageSeverity.Major]: 300,     // 5 minutes
            [DamageSeverity.Critical]: 600,  // 10 minutes
            [DamageSeverity.Destroyed]: 1800 // 30 minutes
        };
        
        return baseTimes[severity];
    }

    /**
     * Get damage level for a section (0-1)
     */
    private getSectionDamageLevel(section: ShipSection): number {
        const damages = this.damage.get(section) || [];
        let totalDamage = 0;
        
        damages.forEach(damage => {
            const severityValues = {
                [DamageSeverity.Minor]: 0.1,
                [DamageSeverity.Moderate]: 0.25,
                [DamageSeverity.Major]: 0.5,
                [DamageSeverity.Critical]: 0.8,
                [DamageSeverity.Destroyed]: 1.0
            };
            totalDamage += severityValues[damage.severity];
        });
        
        return Math.min(1.0, totalDamage);
    }

    /**
     * Repair system damage
     */
    repairDamage(section: ShipSection, damageIndex: number, resources: RepairCost): boolean {
        const damages = this.damage.get(section);
        if (!damages || !damages[damageIndex]) return false;
        
        const damageReport = damages[damageIndex];
        
        // Check if we have enough resources
        if (!this.hasEnoughResources(resources, damageReport.repairCost)) {
            return false;
        }
        
        // Remove the damage
        damages.splice(damageIndex, 1);
        this.damage.set(section, damages);
        
        // Restore some hull if applicable
        this.status.hull = Math.min(this.config.maxHull, this.status.hull + 10);
        
        // Trigger repair event
        damageReport.systemsAffected.forEach(system => {
            this.events.onSystemRepaired?.(system);
        });
        
        this.logger.info(`Repaired ${damageReport.severity} damage in ${section} section`);
        return true;
    }

    /**
     * Check if we have enough resources for repair
     */
    private hasEnoughResources(available: RepairCost, required: RepairCost): boolean {
        return available.metal >= required.metal &&
               available.electronics >= required.electronics &&
               available.crystals >= required.crystals &&
               (required.nanobots === undefined || (available.nanobots || 0) >= required.nanobots);
    }

    /**
     * Set power allocation
     */
    setPowerAllocation(allocation: Partial<PowerAllocation>): void {
        this.powerAllocation = { ...this.powerAllocation, ...allocation };
        
        // Ensure total doesn't exceed 100%
        const total = Object.values(this.powerAllocation).reduce((sum, val) => sum + val, 0);
        if (total > 100) {
            // Scale down proportionally
            const scale = 100 / total;
            Object.keys(this.powerAllocation).forEach(key => {
                (this.powerAllocation as any)[key] *= scale;
            });
        }
        
        this.logger.debug('Power allocation updated', this.powerAllocation);
    }

    /**
     * Toggle system on/off
     */
    toggleSystem(system: SystemType, state?: boolean): void {
        const newState = state !== undefined ? state : !this.getSystemState(system);
        
        switch (system) {
            case SystemType.Engines:
                this.status.enginesOnline = newState;
                break;
            case SystemType.Shields:
                this.status.shieldsOnline = newState;
                break;
            case SystemType.Weapons:
                this.status.weaponsOnline = newState;
                break;
            case SystemType.LifeSupport:
                this.status.lifeSupport = newState;
                break;
            case SystemType.WarpDrive:
                this.status.warpDrive = newState;
                break;
        }
        
        this.logger.debug(`${system} ${newState ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get system state
     */
    private getSystemState(system: SystemType): boolean {
        switch (system) {
            case SystemType.Engines: return this.status.enginesOnline;
            case SystemType.Shields: return this.status.shieldsOnline;
            case SystemType.Weapons: return this.status.weaponsOnline;
            case SystemType.LifeSupport: return this.status.lifeSupport;
            case SystemType.WarpDrive: return this.status.warpDrive;
            default: return true;
        }
    }

    /**
     * Get current status
     */
    getStatus(): SystemStatus {
        return { ...this.status };
    }

    /**
     * Get power allocation
     */
    getPowerAllocation(): PowerAllocation {
        return { ...this.powerAllocation };
    }

    /**
     * Get damage reports
     */
    getDamageReports(): Map<ShipSection, DamageReport[]> {
        return new Map(this.damage);
    }

    /**
     * Get system diagnostics
     */
    getDiagnostics() {
        return {
            powerConsumption: this.powerConsumption,
            heatGeneration: this.heatGeneration,
            fuelConsumption: this.fuelConsumption,
            totalDamageReports: Array.from(this.damage.values()).reduce((sum, reports) => sum + reports.length, 0),
            criticalSystems: this.getCriticalSystems()
        };
    }

    /**
     * Get critical systems
     */
    private getCriticalSystems(): SystemType[] {
        const critical: SystemType[] = [];
        
        if (this.status.hull < 25) critical.push(SystemType.LifeSupport);
        if (this.status.power < 15) critical.push(SystemType.Engines);
        if (this.status.heat > 85) critical.push(SystemType.Weapons);
        if (!this.status.enginesOnline) critical.push(SystemType.Engines);
        if (!this.status.lifeSupport) critical.push(SystemType.LifeSupport);
        
        return critical;
    }

    /**
     * Add fuel
     */
    addFuel(amount: number): void {
        this.status.fuel = Math.min(this.config.maxFuel, this.status.fuel + amount);
    }

    /**
     * Add power (battery recharge)
     */
    addPower(amount: number): void {
        this.status.power = Math.min(this.config.maxPower, this.status.power + amount);
    }

    /**
     * Emergency repair (restores basic functionality)
     */
    emergencyRepair(): void {
        this.status.hull = Math.max(this.status.hull, 25);
        this.status.power = Math.max(this.status.power, 30);
        this.status.heat = Math.min(this.status.heat, 50);
        
        // Restore critical systems
        this.status.enginesOnline = true;
        this.status.lifeSupport = true;
        
        this.logger.info('🔧 Emergency repair completed');
    }
}