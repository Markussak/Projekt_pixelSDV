/**
 * Player Ship Entity
 * Integrates physics, input, and rendering for the player's controllable ship
 */

import { PhysicsObject, SpacePhysics } from '@core/Physics';
import { InputManager } from '@core/InputManager';
import { AudioEngine } from '@core/AudioEngine';
import { Vector2 } from '@core/Renderer';
import { Logger } from '@utils/Logger';

export interface ShipStats {
    maxHealth: number;
    maxFuel: number;
    thrustPower: number;
    rotationSpeed: number;
    maxVelocity: number;
    mass: number;
}

export class PlayerShip {
    private physicsObject: PhysicsObject;
    private physics: SpacePhysics;
    private input: InputManager;
    private audio: AudioEngine;
    
    // Ship properties
    private stats: ShipStats;
    private currentFuel: number;
    private rotation: number = 0; // Rotation in radians
    private thrustLevel: number = 0; // 0-1
    private engineSoundId: string | null = null;
    
    // Visual effects
    private thrustParticles: ThrustParticle[] = [];
    
    private logger: Logger;

    constructor(
        physics: SpacePhysics,
        input: InputManager,
        audio: AudioEngine,
        startPosition: Vector2,
        stats?: Partial<ShipStats>
    ) {
        this.physics = physics;
        this.input = input;
        this.audio = audio;
        this.logger = new Logger('PlayerShip');
        
        // Default ship stats
        this.stats = {
            maxHealth: 100,
            maxFuel: 1000,
            thrustPower: 5000,
            rotationSpeed: 3.0,
            maxVelocity: 500,
            mass: 1000,
            ...stats
        };
        
        this.currentFuel = this.stats.maxFuel;
        
        // Create physics object
        this.physicsObject = this.physics.createShip('player_ship', startPosition, this.stats.mass);
        this.physicsObject.health = this.stats.maxHealth;
        
        // Add collision callback
        this.physicsObject.onCollision = (other) => this.handleCollision(other);
        
        // Add to physics simulation
        this.physics.addObject(this.physicsObject);
        
        this.logger.info('🚀 Player ship created', {
            position: startPosition,
            stats: this.stats
        });
    }

    /**
     * Update the player ship
     */
    update(deltaTime: number): void {
        // Handle input
        this.handleInput(deltaTime);
        
        // Update rotation based on input
        this.updateRotation(deltaTime);
        
        // Update thrust and movement
        this.updateMovement(deltaTime);
        
        // Update visual effects
        this.updateThrustParticles(deltaTime);
        
        // Update audio
        this.updateAudio();
        
        // Apply fuel consumption
        this.consumeFuel(deltaTime);
    }

    /**
     * Handle player input
     */
    private handleInput(deltaTime: number): void {
        // Get input values
        const thrustInput = this.input.getThrustInput();
        const rotationInput = this.input.getRotationInput();
        
        // Update thrust level
        this.thrustLevel = Math.max(0, thrustInput); // Only forward thrust for now
        
        // Update rotation
        this.rotation += rotationInput * this.stats.rotationSpeed * deltaTime;
        
        // Normalize rotation to 0-2π
        while (this.rotation < 0) this.rotation += Math.PI * 2;
        while (this.rotation > Math.PI * 2) this.rotation -= Math.PI * 2;
    }

    /**
     * Update ship rotation
     */
    private updateRotation(deltaTime: number): void {
        // Rotation is handled in handleInput
        // This method can be used for additional rotation logic
    }

    /**
     * Update ship movement and thrust
     */
    private updateMovement(deltaTime: number): void {
        if (this.thrustLevel > 0 && this.currentFuel > 0) {
            // Calculate thrust direction based on rotation
            const thrustDirection: Vector2 = {
                x: Math.cos(this.rotation - Math.PI / 2), // -PI/2 because 0 rotation points up
                y: Math.sin(this.rotation - Math.PI / 2)
            };
            
            // Apply thrust
            const thrustForce = this.thrustLevel * this.stats.thrustPower;
            this.physics.applyThrust(this.physicsObject.id, thrustDirection, thrustForce);
            
            // Create thrust particles
            this.createThrustParticles();
        }
        
        // Limit velocity to max speed
        const currentSpeed = Math.sqrt(
            this.physicsObject.velocity.x ** 2 + this.physicsObject.velocity.y ** 2
        );
        
        if (currentSpeed > this.stats.maxVelocity) {
            const scale = this.stats.maxVelocity / currentSpeed;
            this.physicsObject.velocity.x *= scale;
            this.physicsObject.velocity.y *= scale;
        }
    }

    /**
     * Update thrust particle effects
     */
    private updateThrustParticles(deltaTime: number): void {
        // Update existing particles
        for (let i = this.thrustParticles.length - 1; i >= 0; i--) {
            const particle = this.thrustParticles[i];
            
            // Update particle
            particle.position.x += particle.velocity.x * deltaTime;
            particle.position.y += particle.velocity.y * deltaTime;
            particle.life -= deltaTime;
            
            // Remove dead particles
            if (particle.life <= 0) {
                this.thrustParticles.splice(i, 1);
            }
        }
    }

    /**
     * Create thrust particles
     */
    private createThrustParticles(): void {
        if (this.thrustParticles.length > 20) return; // Limit particle count
        
        // Calculate exhaust position (behind the ship)
        const exhaustOffset = 20; // Distance behind ship center
        const exhaustX = this.physicsObject.position.x - Math.cos(this.rotation - Math.PI / 2) * exhaustOffset;
        const exhaustY = this.physicsObject.position.y - Math.sin(this.rotation - Math.PI / 2) * exhaustOffset;
        
        // Create particle
        const particle: ThrustParticle = {
            position: { x: exhaustX, y: exhaustY },
            velocity: {
                x: -Math.cos(this.rotation - Math.PI / 2) * 100 + (Math.random() - 0.5) * 50,
                y: -Math.sin(this.rotation - Math.PI / 2) * 100 + (Math.random() - 0.5) * 50
            },
            life: 0.5,
            maxLife: 0.5
        };
        
        this.thrustParticles.push(particle);
    }

    /**
     * Update audio based on ship state
     */
    private updateAudio(): void {
        if (this.thrustLevel > 0 && this.currentFuel > 0) {
            // Start engine sound if not playing
            if (!this.engineSoundId) {
                this.engineSoundId = this.audio.playEngineSound();
            }
        } else {
            // Stop engine sound
            if (this.engineSoundId) {
                this.audio.stopSound(this.engineSoundId);
                this.engineSoundId = null;
            }
        }
    }

    /**
     * Consume fuel based on thrust
     */
    private consumeFuel(deltaTime: number): void {
        if (this.thrustLevel > 0) {
            const fuelConsumption = this.thrustLevel * 10 * deltaTime; // Adjust consumption rate
            this.currentFuel = Math.max(0, this.currentFuel - fuelConsumption);
            
            if (this.currentFuel === 0) {
                this.logger.warn('Ship out of fuel!');
            }
        }
    }

    /**
     * Handle collision with other objects
     */
    private handleCollision(other: PhysicsObject): void {
        this.logger.debug(`Ship collision with ${other.type}: ${other.id}`);
        
        switch (other.type) {
            case 'planet':
            case 'asteroid':
                // Take damage from collision
                const collisionDamage = 10;
                this.takeDamage(collisionDamage);
                
                // Play collision sound
                this.audio.playExplosion(this.physicsObject.position);
                break;
                
            case 'projectile':
                // Take damage from projectile
                this.takeDamage(5);
                break;
        }
    }

    /**
     * Take damage
     */
    takeDamage(amount: number): void {
        if (this.physicsObject.health) {
            this.physicsObject.health = Math.max(0, this.physicsObject.health - amount);
            this.logger.debug(`Ship took ${amount} damage, health: ${this.physicsObject.health}`);
            
            if (this.physicsObject.health === 0) {
                this.destroy();
            }
        }
    }

    /**
     * Heal the ship
     */
    heal(amount: number): void {
        if (this.physicsObject.health) {
            this.physicsObject.health = Math.min(this.stats.maxHealth, this.physicsObject.health + amount);
            this.logger.debug(`Ship healed ${amount}, health: ${this.physicsObject.health}`);
        }
    }

    /**
     * Add fuel
     */
    addFuel(amount: number): void {
        this.currentFuel = Math.min(this.stats.maxFuel, this.currentFuel + amount);
        this.logger.debug(`Added ${amount} fuel, current: ${this.currentFuel}`);
    }

    /**
     * Fire weapon
     */
    fireWeapon(): void {
        if (this.input.isActionPressed()) {
            // Calculate projectile spawn position (front of ship)
            const spawnOffset = 25;
            const spawnX = this.physicsObject.position.x + Math.cos(this.rotation - Math.PI / 2) * spawnOffset;
            const spawnY = this.physicsObject.position.y + Math.sin(this.rotation - Math.PI / 2) * spawnOffset;
            
            // Calculate projectile velocity
            const projectileSpeed = 800;
            const projectileVelocity: Vector2 = {
                x: Math.cos(this.rotation - Math.PI / 2) * projectileSpeed + this.physicsObject.velocity.x,
                y: Math.sin(this.rotation - Math.PI / 2) * projectileSpeed + this.physicsObject.velocity.y
            };
            
            // Create projectile
            const projectile = this.physics.createProjectile(
                `projectile_${Date.now()}`,
                { x: spawnX, y: spawnY },
                projectileVelocity
            );
            
            // Add projectile to physics
            this.physics.addObject(projectile);
            
            // Play laser sound
            this.audio.playLaserSound(this.physicsObject.position);
            
            this.logger.debug('Weapon fired');
        }
    }

    /**
     * Destroy the ship
     */
    private destroy(): void {
        this.logger.warn('Ship destroyed!');
        
        // Play explosion sound
        this.audio.playExplosion(this.physicsObject.position);
        
        // Stop engine sound
        if (this.engineSoundId) {
            this.audio.stopSound(this.engineSoundId);
            this.engineSoundId = null;
        }
        
        // Remove from physics simulation
        this.physics.removeObject(this.physicsObject.id);
    }

    /**
     * Render thrust particles
     */
    renderThrustParticles(renderer: any): void {
        this.thrustParticles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            const color = {
                r: 255,
                g: Math.floor(255 * alpha),
                b: 0,
                a: Math.floor(255 * alpha)
            };
            
            renderer.setPixel(
                Math.floor(particle.position.x),
                Math.floor(particle.position.y),
                color
            );
        });
    }

    /**
     * Get ship data for UI display
     */
    getShipData() {
        return {
            position: { ...this.physicsObject.position },
            velocity: { ...this.physicsObject.velocity },
            rotation: this.rotation,
            health: this.physicsObject.health || 0,
            fuel: this.currentFuel,
            thrustLevel: this.thrustLevel,
            maxHealth: this.stats.maxHealth,
            maxFuel: this.stats.maxFuel
        };
    }

    /**
     * Get physics object for external access
     */
    getPhysicsObject(): PhysicsObject {
        return this.physicsObject;
    }

    /**
     * Get current position
     */
    getPosition(): Vector2 {
        return { ...this.physicsObject.position };
    }

    /**
     * Get current rotation in radians
     */
    getRotation(): number {
        return this.rotation;
    }

    /**
     * Check if ship is alive
     */
    isAlive(): boolean {
        return (this.physicsObject.health || 0) > 0;
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        // Stop engine sound
        if (this.engineSoundId) {
            this.audio.stopSound(this.engineSoundId);
        }
        
        // Remove from physics
        this.physics.removeObject(this.physicsObject.id);
        
        this.logger.info('🧹 Player ship cleanup completed');
    }
}

// Thrust particle interface
interface ThrustParticle {
    position: Vector2;
    velocity: Vector2;
    life: number;
    maxLife: number;
}