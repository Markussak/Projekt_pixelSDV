/**
 * Warp Drive System
 * Complete warp drive mechanics with black hole formation, particle effects, and space distortion
 */

import { Logger } from '@utils/Logger';
import { Vector2, Renderer, Color } from '@core/Renderer';
import { AudioEngine } from '@core/AudioEngine';

export interface WarpDriveConfig {
    speedMultiplier: number; // 20x speed multiplier
    energyCost: number; // Energy cost per second
    particleCount: number; // Number of particles for effects
    maxRange: number; // Maximum warp range
    cooldownTime: number; // Cooldown between warps
}

export enum WarpState {
    Idle = 'idle',
    Charging = 'charging',         // 0-5s: Particle absorption
    BlackHoleGrowth = 'growth',    // 5-7s: Black hole formation
    AccretionFormation = 'accretion', // 7-12s: Accretion disk formation
    Active = 'active',             // Warp active with space distortion
    Deactivating = 'deactivating' // 6s: Shutdown sequence
}

interface WarpParticle {
    position: Vector2;
    velocity: Vector2;
    color: Color;
    life: number; // 0-1
    size: number;
    absorbed: boolean;
}

interface AccretionParticle {
    angle: number;
    radius: number;
    speed: number;
    color: Color;
    size: number;
    life: number;
}

interface SpaceDistortion {
    intensity: number; // 0-1
    radius: number;
    center: Vector2;
}

export interface WarpEvents {
    onWarpStart?: () => void;
    onWarpEnd?: () => void;
    onBlackHoleFormed?: () => void;
    onSpaceDistorted?: () => void;
    onWarpFail?: (reason: string) => void;
}

export class WarpDrive {
    private config: WarpDriveConfig;
    private events: WarpEvents;
    
    // Warp state
    private state: WarpState = WarpState.Idle;
    private stateTimer: number = 0;
    private isCharging: boolean = false;
    private isActive: boolean = false;
    
    // Visual effects
    private particles: WarpParticle[] = [];
    private accretionParticles: AccretionParticle[] = [];
    private blackHoleRadius: number = 0;
    private distortion: SpaceDistortion = { intensity: 0, radius: 0, center: { x: 0, y: 0 } };
    
    // Ship properties
    private shipPosition: Vector2 = { x: 0, y: 0 };
    private shipSize: number = 20;
    private originalSpeed: number = 1.0;
    
    // Timing phases (seconds)
    private readonly PHASE_PARTICLE_ABSORPTION = 5.0;
    private readonly PHASE_BLACK_HOLE_GROWTH = 2.0; // 5-7s
    private readonly PHASE_ACCRETION_FORMATION = 5.0; // 7-12s
    private readonly PHASE_SHUTDOWN = 6.0;
    
    // Effect intensities
    private particleIntensity: number = 0;
    private blackHoleIntensity: number = 0;
    private accretionIntensity: number = 0;
    private distortionIntensity: number = 0;
    
    private logger: Logger;

    constructor(
        config: Partial<WarpDriveConfig> = {},
        events: WarpEvents = {}
    ) {
        this.logger = new Logger('WarpDrive');
        this.events = events;
        
        this.config = {
            speedMultiplier: 20.0,
            energyCost: 10.0, // Energy per second
            particleCount: 50,
            maxRange: 10000,
            cooldownTime: 30.0,
            ...config
        };
        
        this.logger.info('🌌 Warp drive system initialized', {
            speedMultiplier: this.config.speedMultiplier,
            particleCount: this.config.particleCount
        });
    }

    /**
     * Activate warp drive
     */
    activateWarp(shipPosition: Vector2, shipSize: number): boolean {
        if (this.state !== WarpState.Idle) {
            this.logger.warn('⚠️ Warp already active or charging');
            return false;
        }
        
        this.shipPosition = { ...shipPosition };
        this.shipSize = shipSize;
        this.state = WarpState.Charging;
        this.stateTimer = 0;
        this.isCharging = true;
        
        // Initialize particle system
        this.initializeParticles();
        
        this.logger.info('🚀 Warp drive activation sequence started');
        this.events.onWarpStart?.();
        
        return true;
    }

    /**
     * Deactivate warp drive
     */
    deactivateWarp(): void {
        if (this.state === WarpState.Active) {
            this.state = WarpState.Deactivating;
            this.stateTimer = 0;
            this.isActive = false;
            
            this.logger.info('🛑 Warp drive deactivation sequence started');
        }
    }

    /**
     * Initialize particle system for warp effects
     */
    private initializeParticles(): void {
        this.particles = [];
        const spawnRadius = 150; // Spawn particles around ship
        
        for (let i = 0; i < this.config.particleCount; i++) {
            // Spawn particles in circle around ship
            const angle = (Math.PI * 2 * i) / this.config.particleCount + Math.random() * 0.5;
            const distance = spawnRadius + Math.random() * 50;
            
            const position = {
                x: this.shipPosition.x + Math.cos(angle) * distance,
                y: this.shipPosition.y + Math.sin(angle) * distance
            };
            
            // Random particle colors (red, yellow, gray, purple, white, orange)
            const colors = [
                { r: 72, g: 24, b: 24 },  // Dark red
                { r: 72, g: 48, b: 12 },  // Dark yellow
                { r: 48, g: 48, b: 48 },  // Gray
                { r: 48, g: 24, b: 72 },  // Dark purple
                { r: 64, g: 64, b: 64 },  // White (muted)
                { r: 64, g: 32, b: 16 }   // Dark orange
            ];
            
            this.particles.push({
                position: { ...position },
                velocity: { x: 0, y: 0 },
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                size: Math.random() * 3 + 1,
                absorbed: false
            });
        }
    }

    /**
     * Update warp drive system
     */
    update(deltaTime: number, shipPosition: Vector2): number {
        this.shipPosition = { ...shipPosition };
        this.stateTimer += deltaTime;
        
        switch (this.state) {
            case WarpState.Charging:
                this.updateChargingPhase(deltaTime);
                break;
                
            case WarpState.BlackHoleGrowth:
                this.updateBlackHoleGrowth(deltaTime);
                break;
                
            case WarpState.AccretionFormation:
                this.updateAccretionFormation(deltaTime);
                break;
                
            case WarpState.Active:
                this.updateActiveWarp(deltaTime);
                break;
                
            case WarpState.Deactivating:
                this.updateDeactivation(deltaTime);
                break;
        }
        
        // Update particle systems
        this.updateParticles(deltaTime);
        this.updateAccretionDisk(deltaTime);
        this.updateSpaceDistortion(deltaTime);
        
        // Return speed multiplier
        return this.isActive ? this.config.speedMultiplier : 1.0;
    }

    /**
     * Update charging phase (0-5 seconds)
     */
    private updateChargingPhase(deltaTime: number): void {
        const progress = this.stateTimer / this.PHASE_PARTICLE_ABSORPTION;
        this.particleIntensity = Math.min(1.0, progress);
        
        // Particles start moving toward ship center
        this.particles.forEach(particle => {
            if (!particle.absorbed) {
                const toCenter = {
                    x: this.shipPosition.x - particle.position.x,
                    y: this.shipPosition.y - particle.position.y
                };
                const distance = Math.sqrt(toCenter.x * toCenter.x + toCenter.y * toCenter.y);
                
                if (distance > 5) {
                    // Accelerate toward center
                    const speed = 50 + (progress * 200); // Speed increases over time
                    particle.velocity.x = (toCenter.x / distance) * speed;
                    particle.velocity.y = (toCenter.y / distance) * speed;
                    
                    // Update position
                    particle.position.x += particle.velocity.x * deltaTime;
                    particle.position.y += particle.velocity.y * deltaTime;
                } else {
                    particle.absorbed = true;
                }
            }
        });
        
        // Transition to black hole growth
        if (this.stateTimer >= this.PHASE_PARTICLE_ABSORPTION) {
            this.state = WarpState.BlackHoleGrowth;
            this.stateTimer = 0;
            this.logger.debug('🕳️ Black hole formation phase started');
        }
    }

    /**
     * Update black hole growth phase (5-7 seconds)
     */
    private updateBlackHoleGrowth(deltaTime: number): void {
        const progress = this.stateTimer / this.PHASE_BLACK_HOLE_GROWTH;
        this.blackHoleIntensity = Math.min(1.0, progress);
        
        // Black hole grows to 1/3 of ship size
        this.blackHoleRadius = (this.shipSize / 3) * this.blackHoleIntensity;
        
        // Transition to accretion formation
        if (this.stateTimer >= this.PHASE_BLACK_HOLE_GROWTH) {
            this.state = WarpState.AccretionFormation;
            this.stateTimer = 0;
            this.initializeAccretionDisk();
            this.logger.debug('💫 Accretion disk formation phase started');
        }
    }

    /**
     * Update accretion formation phase (7-12 seconds)
     */
    private updateAccretionFormation(deltaTime: number): void {
        const progress = this.stateTimer / this.PHASE_ACCRETION_FORMATION;
        this.accretionIntensity = Math.min(1.0, progress);
        
        // Black hole continues growing to consume whole ship
        const totalGrowthProgress = (this.PHASE_BLACK_HOLE_GROWTH + this.stateTimer) / 
                                  (this.PHASE_BLACK_HOLE_GROWTH + this.PHASE_ACCRETION_FORMATION);
        this.blackHoleRadius = this.shipSize * totalGrowthProgress;
        
        // Transition to active warp
        if (this.stateTimer >= this.PHASE_ACCRETION_FORMATION) {
            this.state = WarpState.Active;
            this.stateTimer = 0;
            this.isActive = true;
            this.isCharging = false;
            
            // Initialize space distortion
            this.distortion.center = { ...this.shipPosition };
            this.distortion.radius = 200;
            
            this.logger.info('🌌 Warp drive fully active - space distortion engaged');
            this.events.onBlackHoleFormed?.();
            this.events.onSpaceDistorted?.();
        }
    }

    /**
     * Update active warp phase
     */
    private updateActiveWarp(deltaTime: number): void {
        // Maintain full intensity effects
        this.particleIntensity = 1.0;
        this.blackHoleIntensity = 1.0;
        this.accretionIntensity = 1.0;
        this.distortionIntensity = 1.0;
        
        // Update distortion center to follow ship
        this.distortion.center = { ...this.shipPosition };
    }

    /**
     * Update deactivation phase (6 seconds)
     */
    private updateDeactivation(deltaTime: number): void {
        const progress = this.stateTimer / this.PHASE_SHUTDOWN;
        const reverseProgress = 1.0 - progress;
        
        // Gradually reduce all effects
        this.distortionIntensity = reverseProgress;
        this.blackHoleIntensity = Math.max(0, reverseProgress - 0.3); // Black hole dissolves faster
        this.accretionIntensity = Math.max(0, reverseProgress - 0.1); // Accretion disk dissolves
        this.particleIntensity = Math.max(0, reverseProgress - 0.5); // Particles fade last
        
        // Add dissolution particles
        if (progress > 0.3 && Math.random() < 0.3) {
            this.addDissolutionParticles();
        }
        
        // Complete shutdown
        if (this.stateTimer >= this.PHASE_SHUTDOWN) {
            this.state = WarpState.Idle;
            this.stateTimer = 0;
            this.clearAllEffects();
            
            this.logger.info('✅ Warp drive deactivation complete');
            this.events.onWarpEnd?.();
        }
    }

    /**
     * Initialize accretion disk
     */
    private initializeAccretionDisk(): void {
        this.accretionParticles = [];
        const particleCount = 40;
        
        for (let i = 0; i < particleCount; i++) {
            this.accretionParticles.push({
                angle: Math.random() * Math.PI * 2,
                radius: 15 + Math.random() * 25, // Radius around black hole
                speed: 2 + Math.random() * 4, // Rotation speed (chaotic)
                color: this.getAccretionColor(),
                size: Math.random() * 2 + 1,
                life: 1.0
            });
        }
    }

    /**
     * Get accretion disk particle color (red-orange-yellow-white swirl)
     */
    private getAccretionColor(): Color {
        const colors = [
            { r: 96, g: 32, b: 32 },  // Dark red
            { r: 96, g: 48, b: 16 },  // Dark orange  
            { r: 96, g: 64, b: 16 },  // Dark yellow
            { r: 80, g: 80, b: 80 }   // Muted white
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Update particle effects
     */
    private updateParticles(deltaTime: number): void {
        this.particles.forEach(particle => {
            if (this.state === WarpState.Deactivating && !particle.absorbed) {
                // During deactivation, particles fly outward
                const fromCenter = {
                    x: particle.position.x - this.shipPosition.x,
                    y: particle.position.y - this.shipPosition.y
                };
                const distance = Math.sqrt(fromCenter.x * fromCenter.x + fromCenter.y * fromCenter.y);
                
                if (distance > 0) {
                    const speed = 100;
                    particle.velocity.x = (fromCenter.x / distance) * speed;
                    particle.velocity.y = (fromCenter.y / distance) * speed;
                    
                    particle.position.x += particle.velocity.x * deltaTime;
                    particle.position.y += particle.velocity.y * deltaTime;
                }
                
                particle.life -= deltaTime * 2; // Fade quickly
            }
        });
    }

    /**
     * Update accretion disk
     */
    private updateAccretionDisk(deltaTime: number): void {
        this.accretionParticles.forEach(particle => {
            // Chaotic rotation
            particle.angle += particle.speed * deltaTime * (0.5 + Math.random() * 0.5);
            
            // Slight radius variation for chaos
            particle.radius += Math.sin(particle.angle * 3) * 2 * deltaTime;
            
            // During deactivation, particles spiral outward
            if (this.state === WarpState.Deactivating) {
                particle.radius += 50 * deltaTime;
                particle.life -= deltaTime * 1.5;
            }
        });
        
        // Remove dead particles
        this.accretionParticles = this.accretionParticles.filter(p => p.life > 0);
    }

    /**
     * Update space distortion effect
     */
    private updateSpaceDistortion(deltaTime: number): void {
        if (this.distortionIntensity > 0) {
            // Subtle pulsing effect
            this.distortion.intensity = this.distortionIntensity * (0.8 + Math.sin(this.stateTimer * 3) * 0.2);
        }
    }

    /**
     * Add dissolution particles during shutdown
     */
    private addDissolutionParticles(): void {
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 30;
            
            this.particles.push({
                position: {
                    x: this.shipPosition.x + Math.cos(angle) * distance,
                    y: this.shipPosition.y + Math.sin(angle) * distance
                },
                velocity: {
                    x: Math.cos(angle) * 50,
                    y: Math.sin(angle) * 50
                },
                color: { r: 32, g: 32, b: 32 }, // Darker particles for dissolution
                life: 0.5,
                size: Math.random() * 2 + 1,
                absorbed: false
            });
        }
    }

    /**
     * Clear all effects
     */
    private clearAllEffects(): void {
        this.particles = [];
        this.accretionParticles = [];
        this.blackHoleRadius = 0;
        this.particleIntensity = 0;
        this.blackHoleIntensity = 0;
        this.accretionIntensity = 0;
        this.distortionIntensity = 0;
    }

    /**
     * Render warp effects
     */
    render(renderer: Renderer): void {
        if (this.state === WarpState.Idle) return;
        
        // Render space distortion first (background effect)
        if (this.distortionIntensity > 0) {
            this.renderSpaceDistortion(renderer);
        }
        
        // Render absorption particles
        if (this.particleIntensity > 0) {
            this.renderParticles(renderer);
        }
        
        // Render accretion disk
        if (this.accretionIntensity > 0) {
            this.renderAccretionDisk(renderer);
        }
        
        // Render black hole (on top)
        if (this.blackHoleIntensity > 0) {
            this.renderBlackHole(renderer);
        }
    }

    /**
     * Render absorption particles
     */
    private renderParticles(renderer: Renderer): void {
        this.particles.forEach(particle => {
            if (particle.life > 0) {
                const alpha = particle.life * this.particleIntensity;
                const color = {
                    r: Math.floor(particle.color.r * alpha),
                    g: Math.floor(particle.color.g * alpha),
                    b: Math.floor(particle.color.b * alpha)
                };
                
                renderer.fillRect(
                    particle.position.x - particle.size/2,
                    particle.position.y - particle.size/2,
                    particle.size,
                    particle.size,
                    color
                );
            }
        });
    }

    /**
     * Render black hole
     */
    private renderBlackHole(renderer: Renderer): void {
        const radius = this.blackHoleRadius * this.blackHoleIntensity;
        if (radius > 0) {
            // Pure black center
            renderer.drawCircle(this.shipPosition.x, this.shipPosition.y, radius, { r: 0, g: 0, b: 0 }, true);
            
            // Subtle event horizon glow
            const glowRadius = radius * 1.2;
            const glowColor = { r: 8, g: 8, b: 8 }; // Very dark glow
            renderer.drawCircle(this.shipPosition.x, this.shipPosition.y, glowRadius, glowColor, false);
        }
    }

    /**
     * Render accretion disk
     */
    private renderAccretionDisk(renderer: Renderer): void {
        this.accretionParticles.forEach(particle => {
            if (particle.life > 0) {
                const x = this.shipPosition.x + Math.cos(particle.angle) * particle.radius;
                const y = this.shipPosition.y + Math.sin(particle.angle) * particle.radius;
                
                const alpha = particle.life * this.accretionIntensity;
                const color = {
                    r: Math.floor(particle.color.r * alpha),
                    g: Math.floor(particle.color.g * alpha),
                    b: Math.floor(particle.color.b * alpha)
                };
                
                renderer.fillRect(
                    x - particle.size/2,
                    y - particle.size/2,
                    particle.size,
                    particle.size,
                    color
                );
            }
        });
    }

    /**
     * Render space distortion effect
     */
    private renderSpaceDistortion(renderer: Renderer): void {
        // This is a placeholder for space distortion
        // In a real implementation, this would affect the entire background rendering
        // For now, we'll render subtle distortion lines
        
        const intensity = this.distortion.intensity;
        if (intensity > 0) {
            const lines = 8;
            for (let i = 0; i < lines; i++) {
                const angle = (Math.PI * 2 * i) / lines;
                const baseRadius = this.distortion.radius;
                
                for (let r = baseRadius * 0.5; r < baseRadius * 1.5; r += 10) {
                    const distortion = Math.sin(this.stateTimer * 2 + r * 0.1) * intensity * 5;
                    const x = this.distortion.center.x + Math.cos(angle) * (r + distortion);
                    const y = this.distortion.center.y + Math.sin(angle) * (r + distortion);
                    
                    const alpha = intensity * 0.3 * (1 - (r - baseRadius * 0.5) / (baseRadius));
                    const color = {
                        r: Math.floor(16 * alpha),
                        g: Math.floor(24 * alpha),
                        b: Math.floor(32 * alpha)
                    };
                    
                    renderer.fillRect(x - 1, y - 1, 2, 2, color);
                }
            }
        }
    }

    /**
     * Get current warp state
     */
    getState(): WarpState {
        return this.state;
    }

    /**
     * Check if warp is active
     */
    isWarpActive(): boolean {
        return this.isActive;
    }

    /**
     * Check if warp is charging
     */
    isWarpCharging(): boolean {
        return this.isCharging;
    }

    /**
     * Get warp progress (0-1) during charging/deactivation
     */
    getWarpProgress(): number {
        switch (this.state) {
            case WarpState.Charging:
                return this.stateTimer / this.PHASE_PARTICLE_ABSORPTION;
            case WarpState.BlackHoleGrowth:
                return this.stateTimer / this.PHASE_BLACK_HOLE_GROWTH;
            case WarpState.AccretionFormation:
                return this.stateTimer / this.PHASE_ACCRETION_FORMATION;
            case WarpState.Deactivating:
                return 1.0 - (this.stateTimer / this.PHASE_SHUTDOWN);
            case WarpState.Active:
                return 1.0;
            default:
                return 0.0;
        }
    }

    /**
     * Get space distortion data for background rendering
     */
    getSpaceDistortion(): SpaceDistortion {
        return { ...this.distortion };
    }

    /**
     * Force emergency warp shutdown
     */
    emergencyShutdown(): void {
        if (this.state !== WarpState.Idle) {
            this.state = WarpState.Deactivating;
            this.stateTimer = 0;
            this.isActive = false;
            this.isCharging = false;
            
            this.logger.warn('🚨 Emergency warp shutdown initiated');
        }
    }
}