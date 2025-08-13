/**
 * Particle System
 * Advanced particle effects for retro space game visuals
 */

import { Logger } from '@utils/Logger';
import { Renderer, Color } from '@core/Renderer';

export enum ParticleType {
    Explosion = 'explosion',
    Thrust = 'thrust',
    Laser = 'laser',
    Shield = 'shield',
    Spark = 'spark',
    Smoke = 'smoke',
    Debris = 'debris',
    StarField = 'starfield',
    WarpTrail = 'warp_trail',
    Beam = 'beam'
}

export interface Particle {
    id: string;
    type: ParticleType;
    position: { x: number, y: number };
    velocity: { x: number, y: number };
    acceleration: { x: number, y: number };
    
    // Visual properties
    size: number;
    color: Color;
    alpha: number;
    rotation: number;
    rotationSpeed: number;
    
    // Lifecycle
    age: number;
    maxAge: number;
    
    // Behavior
    gravity: number;
    bounce: number;
    friction: number;
    
    // Animation
    sizeAnimation?: {
        startSize: number;
        endSize: number;
        curve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    };
    
    colorAnimation?: {
        startColor: Color;
        endColor: Color;
        curve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    };
    
    alphaAnimation?: {
        startAlpha: number;
        endAlpha: number;
        curve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    };
}

export interface ParticleEmitter {
    id: string;
    type: ParticleType;
    position: { x: number, y: number };
    
    // Emission properties
    emissionRate: number; // particles per second
    burstCount: number; // particles per burst
    
    // Particle spawn properties
    velocityRange: {
        min: { x: number, y: number };
        max: { x: number, y: number };
    };
    
    sizeRange: { min: number, max: number };
    lifeRange: { min: number, max: number };
    colorVariation: number; // 0-1
    
    // Emitter lifecycle
    active: boolean;
    duration: number; // -1 for infinite
    startTime: number;
    
    // Shape
    shape: 'point' | 'circle' | 'rectangle' | 'cone';
    shapeData: any;
}

export interface ParticleSystemConfig {
    maxParticles: number;
    qualityScale: number; // 0-1, affects particle count
    enableTrails: boolean;
    enableBloom: boolean;
    pixelPerfect: boolean;
}

export interface ParticleEvents {
    onParticleSpawned?: (particle: Particle) => void;
    onParticleDied?: (particle: Particle) => void;
    onEmitterCompleted?: (emitter: ParticleEmitter) => void;
}

export class ParticleSystem {
    private particles: Map<string, Particle> = new Map();
    private emitters: Map<string, ParticleEmitter> = new Map();
    
    private nextParticleId: number = 0;
    private nextEmitterId: number = 0;
    
    private config: ParticleSystemConfig;
    private events: ParticleEvents;
    private logger: Logger;

    constructor(config: Partial<ParticleSystemConfig> = {}, events: ParticleEvents = {}) {
        this.logger = new Logger('ParticleSystem');
        this.events = events;
        
        this.config = {
            maxParticles: 1000,
            qualityScale: 1.0,
            enableTrails: true,
            enableBloom: false,
            pixelPerfect: true,
            ...config
        };
        
        this.logger.info('✨ Particle system initialized');
    }

    /**
     * Update particle system
     */
    update(deltaTime: number): void {
        this.updateEmitters(deltaTime);
        this.updateParticles(deltaTime);
        this.cleanupParticles();
    }

    /**
     * Update emitters
     */
    private updateEmitters(deltaTime: number): void {
        const currentTime = Date.now();
        
        this.emitters.forEach((emitter, emitterId) => {
            if (!emitter.active) return;
            
            // Check if emitter should expire
            if (emitter.duration > 0 && currentTime - emitter.startTime > emitter.duration * 1000) {
                emitter.active = false;
                this.events.onEmitterCompleted?.(emitter);
                return;
            }
            
            // Emit particles based on rate
            if (emitter.emissionRate > 0) {
                const particlesToEmit = (emitter.emissionRate * deltaTime / 1000) * this.config.qualityScale;
                const fullParticles = Math.floor(particlesToEmit);
                const fractionalChance = particlesToEmit - fullParticles;
                
                for (let i = 0; i < fullParticles; i++) {
                    this.emitParticle(emitter);
                }
                
                // Emit fractional particle based on probability
                if (Math.random() < fractionalChance) {
                    this.emitParticle(emitter);
                }
            }
            
            // Handle burst emission
            if (emitter.burstCount > 0) {
                for (let i = 0; i < emitter.burstCount; i++) {
                    this.emitParticle(emitter);
                }
                emitter.burstCount = 0; // Reset burst
            }
        });
    }

    /**
     * Emit single particle from emitter
     */
    private emitParticle(emitter: ParticleEmitter): void {
        if (this.particles.size >= this.config.maxParticles) {
            // Remove oldest particle to make room
            const oldestId = this.particles.keys().next().value;
            if (oldestId) {
                this.particles.delete(oldestId);
            }
        }
        
        const particleId = `particle_${this.nextParticleId++}`;
        const spawnPosition = this.calculateSpawnPosition(emitter);
        const velocity = this.calculateSpawnVelocity(emitter);
        
        const particle: Particle = {
            id: particleId,
            type: emitter.type,
            position: { ...spawnPosition },
            velocity,
            acceleration: { x: 0, y: 0 },
            
            size: this.randomBetween(emitter.sizeRange.min, emitter.sizeRange.max),
            color: this.generateParticleColor(emitter.type, emitter.colorVariation),
            alpha: 1.0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 4, // -2 to 2 rad/s
            
            age: 0,
            maxAge: this.randomBetween(emitter.lifeRange.min, emitter.lifeRange.max),
            
            gravity: this.getParticleGravity(emitter.type),
            bounce: this.getParticleBounce(emitter.type),
            friction: this.getParticleFriction(emitter.type)
        };
        
        // Add animations based on particle type
        this.addParticleAnimations(particle);
        
        this.particles.set(particleId, particle);
        this.events.onParticleSpawned?.(particle);
    }

    /**
     * Calculate spawn position based on emitter shape
     */
    private calculateSpawnPosition(emitter: ParticleEmitter): { x: number, y: number } {
        const { position, shape, shapeData } = emitter;
        
        switch (shape) {
            case 'point':
                return { ...position };
                
            case 'circle':
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * (shapeData.radius || 10);
                return {
                    x: position.x + Math.cos(angle) * radius,
                    y: position.y + Math.sin(angle) * radius
                };
                
            case 'rectangle':
                return {
                    x: position.x + (Math.random() - 0.5) * (shapeData.width || 20),
                    y: position.y + (Math.random() - 0.5) * (shapeData.height || 20)
                };
                
            case 'cone':
                const coneAngle = Math.random() * (shapeData.angle || Math.PI / 4) - (shapeData.angle || Math.PI / 4) / 2;
                const coneRadius = Math.random() * (shapeData.radius || 10);
                const direction = shapeData.direction || 0;
                
                return {
                    x: position.x + Math.cos(direction + coneAngle) * coneRadius,
                    y: position.y + Math.sin(direction + coneAngle) * coneRadius
                };
                
            default:
                return { ...position };
        }
    }

    /**
     * Calculate spawn velocity
     */
    private calculateSpawnVelocity(emitter: ParticleEmitter): { x: number, y: number } {
        const { velocityRange } = emitter;
        
        return {
            x: this.randomBetween(velocityRange.min.x, velocityRange.max.x),
            y: this.randomBetween(velocityRange.min.y, velocityRange.max.y)
        };
    }

    /**
     * Generate particle color based on type
     */
    private generateParticleColor(type: ParticleType, variation: number): Color {
        const baseColors: { [key in ParticleType]: Color } = {
            [ParticleType.Explosion]: { r: 96, g: 48, b: 12 }, // Orange explosion
            [ParticleType.Thrust]: { r: 32, g: 80, b: 64 }, // Cyan thrust
            [ParticleType.Laser]: { r: 16, g: 48, b: 16 }, // Green laser
            [ParticleType.Shield]: { r: 24, g: 60, b: 48 }, // Teal shield
            [ParticleType.Spark]: { r: 96, g: 64, b: 16 }, // Amber sparks
            [ParticleType.Smoke]: { r: 32, g: 32, b: 32 }, // Gray smoke
            [ParticleType.Debris]: { r: 48, g: 48, b: 48 }, // Gray debris
            [ParticleType.StarField]: { r: 80, g: 80, b: 80 }, // White stars
            [ParticleType.WarpTrail]: { r: 48, g: 24, b: 72 }, // Purple warp
            [ParticleType.Beam]: { r: 72, g: 24, b: 24 } // Red beam
        };
        
        const baseColor = baseColors[type];
        const variationAmount = variation * 30; // Max variation
        
        return {
            r: Math.max(0, Math.min(255, baseColor.r + (Math.random() - 0.5) * variationAmount)),
            g: Math.max(0, Math.min(255, baseColor.g + (Math.random() - 0.5) * variationAmount)),
            b: Math.max(0, Math.min(255, baseColor.b + (Math.random() - 0.5) * variationAmount))
        };
    }

    /**
     * Get particle physics properties
     */
    private getParticleGravity(type: ParticleType): number {
        const gravityValues: { [key in ParticleType]: number } = {
            [ParticleType.Explosion]: 0,
            [ParticleType.Thrust]: -50, // Upward thrust
            [ParticleType.Laser]: 0,
            [ParticleType.Shield]: 0,
            [ParticleType.Spark]: 100, // Falls down
            [ParticleType.Smoke]: -20, // Rises slowly
            [ParticleType.Debris]: 200, // Falls fast
            [ParticleType.StarField]: 0,
            [ParticleType.WarpTrail]: 0,
            [ParticleType.Beam]: 0
        };
        
        return gravityValues[type];
    }

    private getParticleBounce(type: ParticleType): number {
        const bounceValues: { [key in ParticleType]: number } = {
            [ParticleType.Explosion]: 0.2,
            [ParticleType.Thrust]: 0,
            [ParticleType.Laser]: 0,
            [ParticleType.Shield]: 0,
            [ParticleType.Spark]: 0.8,
            [ParticleType.Smoke]: 0,
            [ParticleType.Debris]: 0.6,
            [ParticleType.StarField]: 0,
            [ParticleType.WarpTrail]: 0,
            [ParticleType.Beam]: 0
        };
        
        return bounceValues[type];
    }

    private getParticleFriction(type: ParticleType): number {
        const frictionValues: { [key in ParticleType]: number } = {
            [ParticleType.Explosion]: 0.95,
            [ParticleType.Thrust]: 0.9,
            [ParticleType.Laser]: 1.0,
            [ParticleType.Shield]: 0.98,
            [ParticleType.Spark]: 0.98,
            [ParticleType.Smoke]: 0.92,
            [ParticleType.Debris]: 0.95,
            [ParticleType.StarField]: 1.0,
            [ParticleType.WarpTrail]: 0.99,
            [ParticleType.Beam]: 1.0
        };
        
        return frictionValues[type];
    }

    /**
     * Add type-specific animations
     */
    private addParticleAnimations(particle: Particle): void {
        switch (particle.type) {
            case ParticleType.Explosion:
                particle.sizeAnimation = {
                    startSize: particle.size * 0.1,
                    endSize: particle.size * 2,
                    curve: 'ease-out'
                };
                particle.alphaAnimation = {
                    startAlpha: 1.0,
                    endAlpha: 0.0,
                    curve: 'ease-in'
                };
                break;
                
            case ParticleType.Thrust:
                particle.sizeAnimation = {
                    startSize: particle.size,
                    endSize: particle.size * 0.1,
                    curve: 'linear'
                };
                particle.alphaAnimation = {
                    startAlpha: 0.8,
                    endAlpha: 0.0,
                    curve: 'linear'
                };
                break;
                
            case ParticleType.Smoke:
                particle.sizeAnimation = {
                    startSize: particle.size * 0.5,
                    endSize: particle.size * 2,
                    curve: 'ease-out'
                };
                particle.alphaAnimation = {
                    startAlpha: 0.6,
                    endAlpha: 0.0,
                    curve: 'ease-in'
                };
                break;
                
            case ParticleType.Spark:
                particle.alphaAnimation = {
                    startAlpha: 1.0,
                    endAlpha: 0.0,
                    curve: 'ease-in'
                };
                break;
        }
    }

    /**
     * Update particles
     */
    private updateParticles(deltaTime: number): void {
        this.particles.forEach((particle, particleId) => {
            const dt = deltaTime / 1000; // Convert to seconds
            
            // Update age
            particle.age += deltaTime;
            
            // Apply physics
            this.updateParticlePhysics(particle, dt);
            
            // Update animations
            this.updateParticleAnimations(particle);
            
            // Update rotation
            particle.rotation += particle.rotationSpeed * dt;
        });
    }

    /**
     * Update particle physics
     */
    private updateParticlePhysics(particle: Particle, dt: number): void {
        // Apply gravity
        particle.acceleration.y += particle.gravity * dt;
        
        // Apply acceleration to velocity
        particle.velocity.x += particle.acceleration.x * dt;
        particle.velocity.y += particle.acceleration.y * dt;
        
        // Apply friction
        particle.velocity.x *= particle.friction;
        particle.velocity.y *= particle.friction;
        
        // Apply velocity to position
        particle.position.x += particle.velocity.x * dt;
        particle.position.y += particle.velocity.y * dt;
        
        // Reset acceleration
        particle.acceleration.x = 0;
        particle.acceleration.y = 0;
    }

    /**
     * Update particle animations
     */
    private updateParticleAnimations(particle: Particle): void {
        const progress = Math.min(1, particle.age / particle.maxAge);
        
        // Size animation
        if (particle.sizeAnimation) {
            const t = this.applyEasing(progress, particle.sizeAnimation.curve);
            particle.size = this.lerp(
                particle.sizeAnimation.startSize,
                particle.sizeAnimation.endSize,
                t
            );
        }
        
        // Alpha animation
        if (particle.alphaAnimation) {
            const t = this.applyEasing(progress, particle.alphaAnimation.curve);
            particle.alpha = this.lerp(
                particle.alphaAnimation.startAlpha,
                particle.alphaAnimation.endAlpha,
                t
            );
        }
        
        // Color animation
        if (particle.colorAnimation) {
            const t = this.applyEasing(progress, particle.colorAnimation.curve);
            particle.color = {
                r: Math.floor(this.lerp(particle.colorAnimation.startColor.r, particle.colorAnimation.endColor.r, t)),
                g: Math.floor(this.lerp(particle.colorAnimation.startColor.g, particle.colorAnimation.endColor.g, t)),
                b: Math.floor(this.lerp(particle.colorAnimation.startColor.b, particle.colorAnimation.endColor.b, t))
            };
        }
    }

    /**
     * Apply easing curves
     */
    private applyEasing(t: number, curve: string): number {
        switch (curve) {
            case 'ease-in':
                return t * t;
            case 'ease-out':
                return 1 - (1 - t) * (1 - t);
            case 'ease-in-out':
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            default:
                return t; // linear
        }
    }

    /**
     * Linear interpolation
     */
    private lerp(start: number, end: number, t: number): number {
        return start + (end - start) * t;
    }

    /**
     * Clean up expired particles
     */
    private cleanupParticles(): void {
        this.particles.forEach((particle, particleId) => {
            if (particle.age >= particle.maxAge || particle.alpha <= 0) {
                this.particles.delete(particleId);
                this.events.onParticleDied?.(particle);
            }
        });
    }

    /**
     * Create explosion effect
     */
    createExplosion(position: { x: number, y: number }, intensity: number = 1.0): string {
        const emitterId = `explosion_${this.nextEmitterId++}`;
        
        const emitter: ParticleEmitter = {
            id: emitterId,
            type: ParticleType.Explosion,
            position: { ...position },
            emissionRate: 0, // Burst only
            burstCount: Math.floor(50 * intensity * this.config.qualityScale),
            velocityRange: {
                min: { x: -100 * intensity, y: -100 * intensity },
                max: { x: 100 * intensity, y: 100 * intensity }
            },
            sizeRange: { min: 2, max: 8 * intensity },
            lifeRange: { min: 500, max: 1500 },
            colorVariation: 0.3,
            active: true,
            duration: 0.1, // Very short duration
            startTime: Date.now(),
            shape: 'circle',
            shapeData: { radius: 5 * intensity }
        };
        
        this.emitters.set(emitterId, emitter);
        this.logger.debug(`💥 Created explosion at (${position.x}, ${position.y})`);
        
        return emitterId;
    }

    /**
     * Create thrust effect
     */
    createThrustTrail(position: { x: number, y: number }, direction: number, intensity: number = 1.0): string {
        const emitterId = `thrust_${this.nextEmitterId++}`;
        
        const emitter: ParticleEmitter = {
            id: emitterId,
            type: ParticleType.Thrust,
            position: { ...position },
            emissionRate: 60 * intensity * this.config.qualityScale,
            burstCount: 0,
            velocityRange: {
                min: { x: Math.cos(direction) * -50 * intensity, y: Math.sin(direction) * -50 * intensity },
                max: { x: Math.cos(direction) * -100 * intensity, y: Math.sin(direction) * -100 * intensity }
            },
            sizeRange: { min: 1, max: 3 * intensity },
            lifeRange: { min: 100, max: 400 },
            colorVariation: 0.2,
            active: true,
            duration: -1, // Continuous
            startTime: Date.now(),
            shape: 'cone',
            shapeData: { 
                direction: direction + Math.PI, // Opposite direction
                angle: Math.PI / 6, // 30 degrees
                radius: 3 * intensity
            }
        };
        
        this.emitters.set(emitterId, emitter);
        
        return emitterId;
    }

    /**
     * Create laser beam effect
     */
    createLaserBeam(start: { x: number, y: number }, end: { x: number, y: number }): string {
        const emitterId = `laser_${this.nextEmitterId++}`;
        
        const distance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        const particleCount = Math.floor(distance / 5); // One particle every 5 pixels
        
        const emitter: ParticleEmitter = {
            id: emitterId,
            type: ParticleType.Laser,
            position: { ...start },
            emissionRate: 0,
            burstCount: particleCount * this.config.qualityScale,
            velocityRange: {
                min: { x: 0, y: 0 },
                max: { x: 0, y: 0 }
            },
            sizeRange: { min: 1, max: 2 },
            lifeRange: { min: 100, max: 200 },
            colorVariation: 0.1,
            active: true,
            duration: 0.05,
            startTime: Date.now(),
            shape: 'rectangle',
            shapeData: { 
                width: distance,
                height: 2
            }
        };
        
        this.emitters.set(emitterId, emitter);
        
        return emitterId;
    }

    /**
     * Update emitter position (for continuous effects)
     */
    updateEmitterPosition(emitterId: string, position: { x: number, y: number }): void {
        const emitter = this.emitters.get(emitterId);
        if (emitter) {
            emitter.position = { ...position };
        }
    }

    /**
     * Stop emitter
     */
    stopEmitter(emitterId: string): void {
        const emitter = this.emitters.get(emitterId);
        if (emitter) {
            emitter.active = false;
        }
    }

    /**
     * Remove emitter
     */
    removeEmitter(emitterId: string): void {
        this.emitters.delete(emitterId);
    }

    /**
     * Render particles
     */
    render(renderer: Renderer): void {
        // Sort particles by type for optimal rendering
        const sortedParticles = Array.from(this.particles.values()).sort((a, b) => {
            return a.type.localeCompare(b.type);
        });
        
        sortedParticles.forEach(particle => {
            this.renderParticle(renderer, particle);
        });
    }

    /**
     * Render individual particle
     */
    private renderParticle(renderer: Renderer, particle: Particle): void {
        if (particle.alpha <= 0) return;
        
        const color = {
            ...particle.color,
            // Apply alpha if renderer supports it
        };
        
        if (this.config.pixelPerfect) {
            // Pixel-perfect rendering for retro style
            const x = Math.floor(particle.position.x);
            const y = Math.floor(particle.position.y);
            const size = Math.max(1, Math.floor(particle.size));
            
            renderer.fillRect(x - size/2, y - size/2, size, size, color);
        } else {
            // Smooth rendering
            renderer.drawCircle(
                particle.position.x,
                particle.position.y,
                particle.size,
                color,
                true
            );
        }
    }

    /**
     * Utility: Random between values
     */
    private randomBetween(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ParticleSystemConfig>): void {
        Object.assign(this.config, newConfig);
        this.logger.info('✨ Particle system config updated', newConfig);
    }

    /**
     * Get particle system statistics
     */
    getStats(): {
        activeParticles: number;
        activeEmitters: number;
        maxParticles: number;
        qualityScale: number;
    } {
        return {
            activeParticles: this.particles.size,
            activeEmitters: Array.from(this.emitters.values()).filter(e => e.active).length,
            maxParticles: this.config.maxParticles,
            qualityScale: this.config.qualityScale
        };
    }

    /**
     * Clear all particles and emitters
     */
    clear(): void {
        this.particles.clear();
        this.emitters.clear();
        this.logger.info('✨ Particle system cleared');
    }

    /**
     * Dispose particle system
     */
    dispose(): void {
        this.clear();
        this.logger.info('✨ Particle system disposed');
    }
}