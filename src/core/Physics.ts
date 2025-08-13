/**
 * Space Physics Engine
 * Handles realistic space movement, gravity, and orbital mechanics
 */

import { Logger } from '@utils/Logger';
import { Vector2 } from '@core/Renderer';

export interface PhysicsObject {
    id: string;
    position: Vector2;
    velocity: Vector2;
    acceleration: Vector2;
    mass: number;
    radius: number;
    isStatic: boolean;
    type: 'ship' | 'planet' | 'star' | 'asteroid' | 'projectile';
    
    // Physics properties
    drag: number;
    restitution: number; // Bounce factor
    friction: number;
    
    // Game-specific properties
    health?: number;
    faction?: string;
    
    // Callbacks
    onCollision?: (other: PhysicsObject) => void;
    onDestroy?: () => void;
}

export interface CollisionInfo {
    objectA: PhysicsObject;
    objectB: PhysicsObject;
    penetration: number;
    normal: Vector2;
    point: Vector2;
}

export interface GravityWell {
    position: Vector2;
    mass: number;
    radius: number; // Effective radius for gravity
}

export class SpacePhysics {
    private objects: Map<string, PhysicsObject> = new Map();
    private gravityWells: Map<string, GravityWell> = new Map();
    
    // Physics constants
    private readonly GRAVITATIONAL_CONSTANT = 6.67e-11; // Scaled for game
    private readonly SPACE_DRAG = 0.999; // Very low drag in space
    private readonly MIN_VELOCITY = 0.01; // Below this, velocity is zeroed
    private readonly MAX_VELOCITY = 1000; // Maximum velocity cap
    
    // Collision detection
    private collisionPairs: CollisionInfo[] = [];
    
    private logger: Logger;

    constructor() {
        this.logger = new Logger('SpacePhysics');
        this.logger.info('🌌 Space physics engine initialized');
    }

    /**
     * Add a physics object to the simulation
     */
    addObject(object: PhysicsObject): void {
        this.objects.set(object.id, object);
        this.logger.debug(`Added physics object: ${object.id} (${object.type})`);
    }

    /**
     * Remove a physics object from the simulation
     */
    removeObject(id: string): boolean {
        const removed = this.objects.delete(id);
        if (removed) {
            this.logger.debug(`Removed physics object: ${id}`);
        }
        return removed;
    }

    /**
     * Get a physics object by ID
     */
    getObject(id: string): PhysicsObject | undefined {
        return this.objects.get(id);
    }

    /**
     * Add a gravity well (like a planet or star)
     */
    addGravityWell(id: string, well: GravityWell): void {
        this.gravityWells.set(id, well);
        this.logger.debug(`Added gravity well: ${id}`);
    }

    /**
     * Remove a gravity well
     */
    removeGravityWell(id: string): boolean {
        return this.gravityWells.delete(id);
    }

    /**
     * Update the physics simulation
     */
    update(deltaTime: number): void {
        // Cap delta time to prevent simulation instability
        deltaTime = Math.min(deltaTime, 1/30); // Max 30 FPS minimum
        
        // Clear previous collision data
        this.collisionPairs = [];
        
        // Apply forces to all objects
        for (const object of this.objects.values()) {
            if (!object.isStatic) {
                this.updateObject(object, deltaTime);
            }
        }
        
        // Detect and resolve collisions
        this.detectCollisions();
        this.resolveCollisions();
    }

    /**
     * Update a single physics object
     */
    private updateObject(object: PhysicsObject, deltaTime: number): void {
        // Reset acceleration each frame
        object.acceleration = { x: 0, y: 0 };
        
        // Apply gravitational forces
        this.applyGravity(object);
        
        // Apply space drag (very minimal)
        this.applyDrag(object);
        
        // Integrate velocity (acceleration → velocity)
        object.velocity.x += object.acceleration.x * deltaTime;
        object.velocity.y += object.acceleration.y * deltaTime;
        
        // Cap velocity to prevent runaway speeds
        const speed = this.getVectorMagnitude(object.velocity);
        if (speed > this.MAX_VELOCITY) {
            const scale = this.MAX_VELOCITY / speed;
            object.velocity.x *= scale;
            object.velocity.y *= scale;
        }
        
        // Zero very small velocities (simulate friction/energy loss)
        if (speed < this.MIN_VELOCITY) {
            object.velocity = { x: 0, y: 0 };
        }
        
        // Integrate position (velocity → position)
        object.position.x += object.velocity.x * deltaTime;
        object.position.y += object.velocity.y * deltaTime;
    }

    /**
     * Apply gravitational forces from all gravity wells
     */
    private applyGravity(object: PhysicsObject): void {
        for (const well of this.gravityWells.values()) {
            const dx = well.position.x - object.position.x;
            const dy = well.position.y - object.position.y;
            const distanceSquared = dx * dx + dy * dy;
            const distance = Math.sqrt(distanceSquared);
            
            // Skip if too close (prevent division by zero and extreme forces)
            if (distance < well.radius * 0.1) continue;
            
            // Calculate gravitational force
            // F = G * (m1 * m2) / r²
            const force = (this.GRAVITATIONAL_CONSTANT * well.mass * object.mass) / distanceSquared;
            
            // Apply force in direction of gravity well
            const forceX = (dx / distance) * force;
            const forceY = (dy / distance) * force;
            
            // F = ma, so a = F/m
            object.acceleration.x += forceX / object.mass;
            object.acceleration.y += forceY / object.mass;
        }
    }

    /**
     * Apply drag forces (minimal in space)
     */
    private applyDrag(object: PhysicsObject): void {
        // Apply object-specific drag
        object.velocity.x *= (this.SPACE_DRAG * object.drag);
        object.velocity.y *= (this.SPACE_DRAG * object.drag);
    }

    /**
     * Detect collisions between all objects
     */
    private detectCollisions(): void {
        const objectArray = Array.from(this.objects.values());
        
        for (let i = 0; i < objectArray.length; i++) {
            for (let j = i + 1; j < objectArray.length; j++) {
                const objA = objectArray[i];
                const objB = objectArray[j];
                
                const collision = this.checkCollision(objA, objB);
                if (collision) {
                    this.collisionPairs.push(collision);
                }
            }
        }
    }

    /**
     * Check collision between two objects
     */
    private checkCollision(objA: PhysicsObject, objB: PhysicsObject): CollisionInfo | null {
        const dx = objB.position.x - objA.position.x;
        const dy = objB.position.y - objA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = objA.radius + objB.radius;
        
        if (distance < minDistance) {
            // Collision detected
            const penetration = minDistance - distance;
            const normal = distance > 0 ? 
                { x: dx / distance, y: dy / distance } : 
                { x: 1, y: 0 }; // Fallback if objects are exactly overlapping
            
            const point = {
                x: objA.position.x + dx * (objA.radius / minDistance),
                y: objA.position.y + dy * (objA.radius / minDistance)
            };
            
            return {
                objectA: objA,
                objectB: objB,
                penetration,
                normal,
                point
            };
        }
        
        return null;
    }

    /**
     * Resolve all detected collisions
     */
    private resolveCollisions(): void {
        for (const collision of this.collisionPairs) {
            this.resolveCollision(collision);
            
            // Call collision callbacks
            if (collision.objectA.onCollision) {
                collision.objectA.onCollision(collision.objectB);
            }
            if (collision.objectB.onCollision) {
                collision.objectB.onCollision(collision.objectA);
            }
        }
    }

    /**
     * Resolve a single collision
     */
    private resolveCollision(collision: CollisionInfo): void {
        const { objectA, objectB, penetration, normal } = collision;
        
        // Separate objects to prevent overlap
        if (!objectA.isStatic && !objectB.isStatic) {
            // Both objects can move
            const separationA = penetration * 0.5;
            const separationB = penetration * 0.5;
            
            objectA.position.x -= normal.x * separationA;
            objectA.position.y -= normal.y * separationA;
            objectB.position.x += normal.x * separationB;
            objectB.position.y += normal.y * separationB;
        } else if (!objectA.isStatic) {
            // Only object A can move
            objectA.position.x -= normal.x * penetration;
            objectA.position.y -= normal.y * penetration;
        } else if (!objectB.isStatic) {
            // Only object B can move
            objectB.position.x += normal.x * penetration;
            objectB.position.y += normal.y * penetration;
        }
        
        // Calculate relative velocity
        const relativeVelocity = {
            x: objectB.velocity.x - objectA.velocity.x,
            y: objectB.velocity.y - objectA.velocity.y
        };
        
        // Calculate collision impulse
        const velocityAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
        
        // Objects are separating, no need to resolve
        if (velocityAlongNormal > 0) return;
        
        // Calculate restitution (bounciness)
        const restitution = Math.min(objectA.restitution, objectB.restitution);
        
        // Calculate impulse scalar
        let impulse = -(1 + restitution) * velocityAlongNormal;
        
        // Calculate mass ratio
        if (!objectA.isStatic && !objectB.isStatic) {
            impulse /= (1 / objectA.mass + 1 / objectB.mass);
        }
        
        // Apply impulse
        const impulseVector = { x: impulse * normal.x, y: impulse * normal.y };
        
        if (!objectA.isStatic) {
            objectA.velocity.x -= impulseVector.x / objectA.mass;
            objectA.velocity.y -= impulseVector.y / objectA.mass;
        }
        
        if (!objectB.isStatic) {
            objectB.velocity.x += impulseVector.x / objectB.mass;
            objectB.velocity.y += impulseVector.y / objectB.mass;
        }
    }

    /**
     * Apply thrust to an object (for ships)
     */
    applyThrust(objectId: string, thrustVector: Vector2, thrustPower: number): void {
        const object = this.objects.get(objectId);
        if (!object || object.isStatic) return;
        
        // Normalize thrust vector
        const magnitude = this.getVectorMagnitude(thrustVector);
        if (magnitude === 0) return;
        
        const normalizedThrust = {
            x: thrustVector.x / magnitude,
            y: thrustVector.y / magnitude
        };
        
        // Apply thrust as acceleration
        object.acceleration.x += normalizedThrust.x * thrustPower / object.mass;
        object.acceleration.y += normalizedThrust.y * thrustPower / object.mass;
    }

    /**
     * Calculate orbital velocity for circular orbit around a gravity well
     */
    calculateOrbitalVelocity(distance: number, centralMass: number): number {
        // v = sqrt(GM/r)
        return Math.sqrt(this.GRAVITATIONAL_CONSTANT * centralMass / distance);
    }

    /**
     * Calculate escape velocity from a gravity well
     */
    calculateEscapeVelocity(distance: number, centralMass: number): number {
        // v = sqrt(2GM/r)
        return Math.sqrt(2 * this.GRAVITATIONAL_CONSTANT * centralMass / distance);
    }

    /**
     * Get all objects within a radius
     */
    getObjectsInRadius(center: Vector2, radius: number): PhysicsObject[] {
        const result: PhysicsObject[] = [];
        
        for (const object of this.objects.values()) {
            const distance = this.getDistance(center, object.position);
            if (distance <= radius) {
                result.push(object);
            }
        }
        
        return result;
    }

    /**
     * Raycast to find the first object hit
     */
    raycast(start: Vector2, direction: Vector2, maxDistance: number): PhysicsObject | null {
        const normalizedDirection = this.normalizeVector(direction);
        const step = 1; // Step size for ray marching
        
        for (let distance = 0; distance < maxDistance; distance += step) {
            const point = {
                x: start.x + normalizedDirection.x * distance,
                y: start.y + normalizedDirection.y * distance
            };
            
            for (const object of this.objects.values()) {
                const objectDistance = this.getDistance(point, object.position);
                if (objectDistance <= object.radius) {
                    return object;
                }
            }
        }
        
        return null;
    }

    /**
     * Utility functions
     */
    private getVectorMagnitude(vector: Vector2): number {
        return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    }

    private normalizeVector(vector: Vector2): Vector2 {
        const magnitude = this.getVectorMagnitude(vector);
        if (magnitude === 0) return { x: 0, y: 0 };
        return { x: vector.x / magnitude, y: vector.y / magnitude };
    }

    private getDistance(a: Vector2, b: Vector2): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get simulation statistics
     */
    getStats() {
        return {
            objectCount: this.objects.size,
            gravityWellCount: this.gravityWells.size,
            collisionCount: this.collisionPairs.length,
            activeObjects: Array.from(this.objects.values()).filter(obj => !obj.isStatic).length
        };
    }

    /**
     * Get object count for performance monitoring
     */
    getObjectCount(): number {
        return this.objects.size;
    }

    /**
     * Get all objects (for debugging/rendering)
     */
    getAllObjects(): PhysicsObject[] {
        return Array.from(this.objects.values());
    }

    /**
     * Clear all objects and gravity wells
     */
    clear(): void {
        this.objects.clear();
        this.gravityWells.clear();
        this.collisionPairs = [];
        this.logger.debug('Physics simulation cleared');
    }

    /**
     * Create a basic ship physics object
     */
    createShip(id: string, position: Vector2, mass: number = 1000): PhysicsObject {
        return {
            id,
            position: { ...position },
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 },
            mass,
            radius: 16, // Ship radius in pixels
            isStatic: false,
            type: 'ship',
            drag: 0.999, // Very little drag in space
            restitution: 0.3, // Some bounce for collisions
            friction: 0.1,
            health: 100
        };
    }

    /**
     * Create a basic planet physics object
     */
    createPlanet(id: string, position: Vector2, mass: number, radius: number): PhysicsObject {
        return {
            id,
            position: { ...position },
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 },
            mass,
            radius,
            isStatic: true, // Planets don't move
            type: 'planet',
            drag: 1.0,
            restitution: 0.1, // Planets are not bouncy
            friction: 0.9
        };
    }

    /**
     * Create a projectile physics object
     */
    createProjectile(id: string, position: Vector2, velocity: Vector2, mass: number = 1): PhysicsObject {
        return {
            id,
            position: { ...position },
            velocity: { ...velocity },
            acceleration: { x: 0, y: 0 },
            mass,
            radius: 2, // Small projectile
            isStatic: false,
            type: 'projectile',
            drag: 1.0, // No drag for projectiles
            restitution: 0.8, // Bouncy projectiles
            friction: 0.0
        };
    }
}