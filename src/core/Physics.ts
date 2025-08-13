/**
 * Space Physics Engine
 * Handles realistic space movement, gravity, and orbital mechanics
 *
 * Upgrades:
 * - Sub-stepped, semi-implicit integration for stability
 * - Spatial hash broadphase (O(n)) + narrowphase for collisions
 * - Positional correction with slop, proper restitution & Coulomb friction
 * - Optional collision filtering (group/mask), CCD ray-sweep for fast projectiles
 * - Gravity improvements: influence radius, softening, per-well toggles
 * - Force generators API (custom fields/thrusters), impulses & helpers
 * - Sleep/awake for tiny-motion objects; health damage on impacts + destroy callback
 * - Config setters, richer stats, safer raycast, nearest-object queries
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
    drag: number;          // multiplicative per-second drag baseline (~1.0 in space)
    restitution: number;   // bounce [0..1]
    friction: number;      // Coulomb friction coefficient (tangent impulse)

    // Game-specific properties
    health?: number;
    faction?: string;

    // Optional collision filtering (32-bit bitmasks)
    collisionGroup?: number; // which group I belong to
    collisionMask?: number;  // which groups I collide with

    // Sleep/awake hint
    sleeping?: boolean;

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
    relativeNormalSpeed: number;
}

export interface GravityWell {
    position: Vector2;
    mass: number;
    radius: number;       // Effective influence radius; <=0 means infinite
    softening?: number;   // Optional softening length to avoid singularity near center
    enabled?: boolean;
}

type ForceGenerator = (obj: PhysicsObject, dt: number) => Vector2 | null;

export class SpacePhysics {
    private objects: Map<string, PhysicsObject> = new Map();
    private gravityWells: Map<string, GravityWell> = new Map();
    private forceGenerators: Map<string, ForceGenerator> = new Map();

    // Physics constants (mutable via setters)
    private GRAVITATIONAL_CONSTANT = 6.67e-11;     // Scaled for game
    private SPACE_DRAG = 0.999;                    // Global low drag
    private MIN_VELOCITY = 0.01;                   // Below this, velocity is zeroed
    private MAX_VELOCITY = 1000;                   // Maximum velocity cap
    private MAX_SUBSTEP = 1 / 60;                  // Substep size for integrator
    private CCD_THRESHOLD = 200;                   // Speed above which CCD sweep test runs
    private DAMAGE_SPEED_THRESHOLD = 5;            // Normal impact speed before damage
    private SLEEP_SPEED_SQ = 0.0025;               // Sleep when v^2 below this for a while
    private SLEEP_TIME = 0.5;                      // seconds

    // Broadphase (spatial hash) cell size ~ average diameter
    private CELL_SIZE = 64;

    // Collision detection
    private collisionPairs: CollisionInfo[] = [];
    private logger: Logger;

    // Internal sleep timers
    private sleepTimers: Map<string, number> = new Map();

    // Scratch vectors to reduce GC (lightweight micro-alloc avoidance)
    private _scratchV: Vector2 = { x: 0, y: 0 };

    constructor() {
        this.logger = new Logger('SpacePhysics');
        this.logger.info('🌌 Space physics engine initialized');
    }

    // -----------------------------
    // Public API (existing + new)
    // -----------------------------

    /** Add a physics object to the simulation */
    addObject(object: PhysicsObject): void {
        if (object.collisionGroup === undefined) object.collisionGroup = 1;
        if (object.collisionMask === undefined) object.collisionMask = 0xFFFFFFFF;
        this.objects.set(object.id, object);
        this.logger.debug(`Added physics object: ${object.id} (${object.type})`);
    }

    /** Remove a physics object from the simulation */
    removeObject(id: string): boolean {
        const removed = this.objects.delete(id);
        if (removed) {
            this.sleepTimers.delete(id);
            this.logger.debug(`Removed physics object: ${id}`);
        }
        return removed;
    }

    /** Get a physics object by ID */
    getObject(id: string): PhysicsObject | undefined {
        return this.objects.get(id);
    }

    /** Add a gravity well (like a planet or star) */
    addGravityWell(id: string, well: GravityWell): void {
        const w = { ...well };
        if (w.enabled === undefined) w.enabled = true;
        this.gravityWells.set(id, w);
        this.logger.debug(`Added gravity well: ${id}`);
    }

    /** Remove a gravity well */
    removeGravityWell(id: string): boolean {
        return this.gravityWells.delete(id);
    }

    /** Register a custom force generator (e.g. solar wind, field) */
    addForceGenerator(id: string, fn: ForceGenerator): void {
        this.forceGenerators.set(id, fn);
    }

    /** Unregister a custom force generator */
    removeForceGenerator(id: string): void {
        this.forceGenerators.delete(id);
    }

    /** Update the physics simulation */
    update(deltaTime: number): void {
        if (deltaTime <= 0) return;

        // Substep for stability (semi-implicit Euler per step)
        const steps = Math.max(1, Math.ceil(deltaTime / this.MAX_SUBSTEP));
        const dt = deltaTime / steps;

        for (let s = 0; s < steps; s++) {
            // Clear previous collision data
            this.collisionPairs.length = 0;

            // Advance dynamic objects
            for (const object of this.objects.values()) {
                if (!object.isStatic) this.updateObject(object, dt);
            }

            // Detect & resolve collisions
            this.detectCollisions(dt);
            this.resolveCollisions();

            // Cleanup destroyed objects (health <= 0 with onDestroy)
            this.pruneDestroyed();
        }
    }

    /** Apply thrust to an object (for ships) */
    applyThrust(objectId: string, thrustVector: Vector2, thrustPower: number): void {
        const object = this.objects.get(objectId);
        if (!object || object.isStatic) return;
        const magnitude = this.len(thrustVector);
        if (magnitude === 0) return;
        const nx = thrustVector.x / magnitude;
        const ny = thrustVector.y / magnitude;
        object.acceleration.x += (nx * thrustPower) / object.mass;
        object.acceleration.y += (ny * thrustPower) / object.mass;
        object.sleeping = false;
        this.sleepTimers.set(object.id, 0);
    }

    /** Calculate orbital velocity for circular orbit around a gravity well */
    calculateOrbitalVelocity(distance: number, centralMass: number): number {
        return Math.sqrt(this.GRAVITATIONAL_CONSTANT * centralMass / distance);
    }

    /** Calculate escape velocity from a gravity well */
    calculateEscapeVelocity(distance: number, centralMass: number): number {
        return Math.sqrt(2 * this.GRAVITATIONAL_CONSTANT * centralMass / distance);
    }

    /** Get all objects within a radius */
    getObjectsInRadius(center: Vector2, radius: number): PhysicsObject[] {
        const r2 = radius * radius;
        const out: PhysicsObject[] = [];
        for (const object of this.objects.values()) {
            const dx = object.position.x - center.x;
            const dy = object.position.y - center.y;
            if (dx * dx + dy * dy <= r2) out.push(object);
        }
        return out;
    }

    /** Raycast to find the first object hit (sphere cast against circles) */
    raycast(start: Vector2, direction: Vector2, maxDistance: number): PhysicsObject | null {
        const dir = this.normalize(direction);
        let closest: { obj: PhysicsObject; t: number } | null = null;

        for (const obj of this.objects.values()) {
            // Solve |start + t*dir - obj.pos| = r, t in [0, maxDistance]
            const ocx = start.x - obj.position.x;
            const ocy = start.y - obj.position.y;
            const b = ocx * dir.x + ocy * dir.y;
            const c = ocx * ocx + ocy * ocy - obj.radius * obj.radius;
            const disc = b * b - c;
            if (disc < 0) continue;
            const sqrtD = Math.sqrt(disc);
            const t = -b - sqrtD; // nearest root
            if (t >= 0 && t <= maxDistance) {
                if (!closest || t < closest.t) closest = { obj, t };
            }
        }
        return closest ? closest.obj : null;
    }

    /** Utility: current simulation statistics */
    getStats() {
        return {
            objectCount: this.objects.size,
            gravityWellCount: this.gravityWells.size,
            collisionCount: this.collisionPairs.length,
            activeObjects: Array.from(this.objects.values()).filter(obj => !obj.isStatic && !obj.sleeping).length
        };
    }

    /** Object count for performance monitoring */
    getObjectCount(): number {
        return this.objects.size;
    }

    /** Get all objects (for debugging/rendering) */
    getAllObjects(): PhysicsObject[] {
        return Array.from(this.objects.values());
    }

    /** Clear all objects and gravity wells */
    clear(): void {
        this.objects.clear();
        this.gravityWells.clear();
        this.collisionPairs.length = 0;
        this.sleepTimers.clear();
        this.logger.debug('Physics simulation cleared');
    }

    // ---- Prefab helpers (kept compatible) ----

    createShip(id: string, position: Vector2, mass: number = 1000): PhysicsObject {
        return {
            id,
            position: { ...position },
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 },
            mass,
            radius: 16,
            isStatic: false,
            type: 'ship',
            drag: 0.999,
            restitution: 0.3,
            friction: 0.1,
            health: 100,
            collisionGroup: 1,
            collisionMask: 0xFFFFFFFF
        };
    }

    createPlanet(id: string, position: Vector2, mass: number, radius: number): PhysicsObject {
        return {
            id,
            position: { ...position },
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 },
            mass,
            radius,
            isStatic: true,
            type: 'planet',
            drag: 1.0,
            restitution: 0.1,
            friction: 0.9,
            collisionGroup: 2,
            collisionMask: 0xFFFFFFFF
        };
    }

    createProjectile(id: string, position: Vector2, velocity: Vector2, mass: number = 1): PhysicsObject {
        return {
            id,
            position: { ...position },
            velocity: { ...velocity },
            acceleration: { x: 0, y: 0 },
            mass,
            radius: 2,
            isStatic: false,
            type: 'projectile',
            drag: 1.0,
            restitution: 0.8,
            friction: 0.0,
            collisionGroup: 4,
            collisionMask: 0xFFFFFFFF
        };
    }

    // -----------------------------
    // New helpers / config setters
    // -----------------------------

    setGravitationalConstant(G: number) { this.GRAVITATIONAL_CONSTANT = G; }
    setGlobalSpaceDrag(k: number) { this.SPACE_DRAG = k; }
    setVelocityCap(max: number) { this.MAX_VELOCITY = max; }
    setCellSize(size: number) { this.CELL_SIZE = Math.max(8, size | 0); }
    setMaxSubstep(dt: number) { this.MAX_SUBSTEP = Math.max(1 / 240, dt); }
    setCCDThreshold(speed: number) { this.CCD_THRESHOLD = Math.max(0, speed); }

    applyImpulse(id: string, impulse: Vector2): void {
        const o = this.objects.get(id);
        if (!o || o.isStatic) return;
        o.velocity.x += impulse.x / o.mass;
        o.velocity.y += impulse.y / o.mass;
        o.sleeping = false;
        this.sleepTimers.set(id, 0);
    }

    teleport(id: string, position: Vector2): void {
        const o = this.objects.get(id);
        if (!o) return;
        o.position = { ...position };
    }

    // -----------------------------
    // Internal: per-object update
    // -----------------------------

    /** Semi-implicit Euler with substeps + drag, gravity, forces, sleep */
    private updateObject(object: PhysicsObject, dt: number): void {
        if (object.sleeping) return;

        // Reset acceleration each frame (external code can add to it via thrust/impulses)
        object.acceleration.x = 0;
        object.acceleration.y = 0;

        // Gravity from wells
        this.applyGravity(object);

        // Custom forces
        if (this.forceGenerators.size) {
            for (const [, fn] of this.forceGenerators) {
                const f = fn(object, dt);
                if (f) {
                    object.acceleration.x += f.x / object.mass;
                    object.acceleration.y += f.y / object.mass;
                }
            }
        }

        // Integrate (semi-implicit: v += a*dt; then damping; then x += v*dt)
        object.velocity.x += object.acceleration.x * dt;
        object.velocity.y += object.acceleration.y * dt;

        // Apply drag consistently across dt relative to 60hz baseline
        this.applyDrag(object, dt);

        // Velocity cap
        const sp = this.len(object.velocity);
        if (sp > this.MAX_VELOCITY) {
            const k = this.MAX_VELOCITY / sp;
            object.velocity.x *= k;
            object.velocity.y *= k;
        }

        // Sleep check
        const v2 = object.velocity.x * object.velocity.x + object.velocity.y * object.velocity.y;
        if (v2 < this.SLEEP_SPEED_SQ) {
            const t = (this.sleepTimers.get(object.id) || 0) + dt;
            if (t >= this.SLEEP_TIME) {
                object.velocity.x = 0; object.velocity.y = 0;
                object.sleeping = true;
            }
            this.sleepTimers.set(object.id, t);
        } else {
            this.sleepTimers.set(object.id, 0);
        }

        // Integrate position
        object.position.x += object.velocity.x * dt;
        object.position.y += object.velocity.y * dt;
    }

    /** Gravity from all wells with influence radius + softening */
    private applyGravity(object: PhysicsObject): void {
        for (const well of this.gravityWells.values()) {
            if (!well.enabled) continue;

            const dx = well.position.x - object.position.x;
            const dy = well.position.y - object.position.y;
            let r2 = dx * dx + dy * dy;

            const infR = well.radius;
            if (infR > 0 && r2 > infR * infR) continue; // outside influence

            const soft = well.softening ?? (well.radius * 0.01); // default 1% of radius
            if (soft > 0) r2 += soft * soft;

            const r = Math.sqrt(r2);
            if (r <= 1e-6) continue;

            // F = G m1 m2 / r^2
            const F = (this.GRAVITATIONAL_CONSTANT * well.mass * object.mass) / r2;
            const ax = (dx / r) * (F / object.mass);
            const ay = (dy / r) * (F / object.mass);

            object.acceleration.x += ax;
            object.acceleration.y += ay;
        }
    }

    /** Exponential-like drag scaled to dt relative to 60Hz */
    private applyDrag(object: PhysicsObject, dt: number): void {
        const base = Math.max(0.0, Math.min(1.0, this.SPACE_DRAG * object.drag));
        const factor = Math.pow(base, dt / (1 / 60)); // stable wrt dt
        object.velocity.x *= factor;
        object.velocity.y *= factor;

        // Zero very small velocities
        if (Math.abs(object.velocity.x) < this.MIN_VELOCITY) object.velocity.x = 0;
        if (Math.abs(object.velocity.y) < this.MIN_VELOCITY) object.velocity.y = 0;
    }

    // -----------------------------
    // Collisions (broad + narrow)
    // -----------------------------

    /** Build spatial hash and detect candidate pairs; include CCD sweep for fast movers */
    private detectCollisions(dt: number): void {
        const cells = new Map<string, PhysicsObject[]>();
        const keyOf = (x: number, y: number) => `${x}|${y}`;
        const insert = (o: PhysicsObject) => {
            const minX = Math.floor((o.position.x - o.radius) / this.CELL_SIZE);
            const maxX = Math.floor((o.position.x + o.radius) / this.CELL_SIZE);
            const minY = Math.floor((o.position.y - o.radius) / this.CELL_SIZE);
            const maxY = Math.floor((o.position.y + o.radius) / this.CELL_SIZE);
            for (let gx = minX; gx <= maxX; gx++) {
                for (let gy = minY; gy <= maxY; gy++) {
                    const k = keyOf(gx, gy);
                    const a = cells.get(k);
                    if (a) a.push(o); else cells.set(k, [o]);
                }
            }
        };

        // Populate grid
        for (const o of this.objects.values()) insert(o);

        // Narrowphase
        const visited = new Set<string>();
        const tryPair = (a: PhysicsObject, b: PhysicsObject) => {
            // Skip static-static
            if (a.isStatic && b.isStatic) return;
            // Group/mask filtering
            if (((a.collisionMask ?? 0xFFFFFFFF) & (b.collisionGroup ?? 1)) === 0) return;
            if (((b.collisionMask ?? 0xFFFFFFFF) & (a.collisionGroup ?? 1)) === 0) return;

            const idA = a.id < b.id ? a.id : b.id;
            const idB = a.id < b.id ? b.id : a.id;
            const key = `${idA}#${idB}`;
            if (visited.has(key)) return;
            visited.add(key);

            // CCD: sweep test for very fast small objects (e.g., projectile)
            const fastA = !a.isStatic && this.len(a.velocity) > this.CCD_THRESHOLD;
            const fastB = !b.isStatic && this.len(b.velocity) > this.CCD_THRESHOLD;
            let info: CollisionInfo | null = null;

            if (fastA || fastB) {
                info = this.sweptCircleVsCircle(a, b, dt);
                if (!info) info = this.checkCollision(a, b);
            } else {
                info = this.checkCollision(a, b);
            }

            if (info) this.collisionPairs.push(info);
        };

        for (const arr of cells.values()) {
            const n = arr.length;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    tryPair(arr[i], arr[j]);
                }
            }
        }
    }

    /** Basic overlap check (narrowphase) */
    private checkCollision(objA: PhysicsObject, objB: PhysicsObject): CollisionInfo | null {
        const dx = objB.position.x - objA.position.x;
        const dy = objB.position.y - objA.position.y;
        const dist2 = dx * dx + dy * dy;
        const minDist = objA.radius + objB.radius;

        if (dist2 < minDist * minDist) {
            const dist = Math.sqrt(Math.max(dist2, 1e-12));
            const nx = dist > 0 ? dx / dist : 1;
            const ny = dist > 0 ? dy / dist : 0;
            const point = {
                x: objA.position.x + nx * objA.radius,
                y: objA.position.y + ny * objA.radius,
            };

            const rvx = objB.velocity.x - objA.velocity.x;
            const rvy = objB.velocity.y - objA.velocity.y;
            const vN = rvx * nx + rvy * ny;

            return {
                objectA: objA,
                objectB: objB,
                penetration: minDist - dist,
                normal: { x: nx, y: ny },
                point,
                relativeNormalSpeed: -vN,
            };
        }
        return null;
    }

    /** Continuous collision detection: swept circle vs circle (linear) */
    private sweptCircleVsCircle(a: PhysicsObject, b: PhysicsObject, dt: number): CollisionInfo | null {
        // Relative motion: a moves by va, b by vb -> treat b as stationary and a has vrel
        const vrel = { x: a.velocity.x - b.velocity.x, y: a.velocity.y - b.velocity.y };
        const sx = a.position.x - b.position.x;
        const sy = a.position.y - b.position.y;
        const r = a.radius + b.radius;

        const A = vrel.x * vrel.x + vrel.y * vrel.y;
        const B = 2 * (sx * vrel.x + sy * vrel.y);
        const C = sx * sx + sy * sy - r * r;

        const disc = B * B - 4 * A * C;
        if (A <= 1e-12 || disc < 0) return null;

        const sqrtD = Math.sqrt(disc);
        const t0 = (-B - sqrtD) / (2 * A);
        if (t0 < 0 || t0 > dt) return null;

        // Move a to time of impact
        const ix = a.position.x + a.velocity.x * t0;
        const iy = a.position.y + a.velocity.y * t0;
        const jx = b.position.x + b.velocity.x * t0;
        const jy = b.position.y + b.velocity.y * t0;

        const dx = jx - ix;
        const dy = jy - iy;
        const dist = Math.sqrt(dx * dx + dy * dy) || r;
        const nx = (dx / dist);
        const ny = (dy / dist);
        const point = { x: ix + nx * a.radius, y: iy + ny * a.radius };

        const rvx = b.velocity.x - a.velocity.x;
        const rvy = b.velocity.y - a.velocity.y;
        const vN = rvx * nx + rvy * ny;

        return {
            objectA: a,
            objectB: b,
            penetration: 0.001, // tiny overlap to trigger resolution
            normal: { x: -nx, y: -ny }, // normal pointing from A to B
            point,
            relativeNormalSpeed: -vN
        };
    }

    /** Resolve all detected collisions */
    private resolveCollisions(): void {
        for (const c of this.collisionPairs) {
            this.resolveCollision(c);

            // callbacks
            c.objectA.onCollision?.(c.objectB);
            c.objectB.onCollision?.(c.objectA);

            // Damage on high-speed impacts (if health present)
            const v = c.relativeNormalSpeed;
            if (v > this.DAMAGE_SPEED_THRESHOLD) {
                const dmg = (v - this.DAMAGE_SPEED_THRESHOLD) * 0.5;
                if (c.objectA.health !== undefined && !c.objectA.isStatic) c.objectA.health = Math.max(0, c.objectA.health - dmg);
                if (c.objectB.health !== undefined && !c.objectB.isStatic) c.objectB.health = Math.max(0, c.objectB.health - dmg);
            }
        }
    }

    /** Resolve a single collision with restitution, friction, and positional correction */
    private resolveCollision(col: CollisionInfo): void {
        const A = col.objectA, B = col.objectB;
        const nx = col.normal.x, ny = col.normal.y;

        // Relative velocity
        const rvx = B.velocity.x - A.velocity.x;
        const rvy = B.velocity.y - A.velocity.y;
        const velAlongNormal = rvx * nx + rvy * ny;

        // Ignore separating
        if (velAlongNormal > 0) {
            // Still perform positional correction to depenetrate
            this.positionalCorrection(A, B, col.penetration, nx, ny);
            return;
        }

        // Restitution combine (min)
        const e = Math.min(A.restitution, B.restitution);

        // Impulse scalar
        const invMassA = A.isStatic ? 0 : 1 / A.mass;
        const invMassB = B.isStatic ? 0 : 1 / B.mass;
        const j = -(1 + e) * velAlongNormal / (invMassA + invMassB);

        // Apply normal impulse
        const jx = j * nx, jy = j * ny;
        if (!A.isStatic) { A.velocity.x -= jx * invMassA; A.velocity.y -= jy * invMassA; }
        if (!B.isStatic) { B.velocity.x += jx * invMassB; B.velocity.y += jy * invMassB; }

        // Friction (Coulomb)
        // Tangent = relative velocity minus normal component
        const rvx2 = B.velocity.x - A.velocity.x;
        const rvy2 = B.velocity.y - A.velocity.y;
        const vt_x = rvx2 - (rvx2 * nx + rvy2 * ny) * nx;
        const vt_y = rvy2 - (rvx2 * nx + rvy2 * ny) * ny;
        const vt_len = Math.hypot(vt_x, vt_y);
        let tx = 0, ty = 0;
        if (vt_len > 1e-8) { tx = vt_x / vt_len; ty = vt_y / vt_len; }

        const mu = Math.sqrt(A.friction * B.friction); // combine
        let jt = - (rvx2 * tx + rvy2 * ty) / (invMassA + invMassB);

        // Coulomb clamp
        const maxFriction = j * mu;
        if (Math.abs(jt) > maxFriction) jt = (jt < 0 ? -1 : 1) * maxFriction;

        const jtx = jt * tx, jty = jt * ty;
        if (!A.isStatic) { A.velocity.x -= jtx * invMassA; A.velocity.y -= jty * invMassA; }
        if (!B.isStatic) { B.velocity.x += jtx * invMassB; B.velocity.y += jty * invMassB; }

        // Positional correction (to avoid sinking)
        this.positionalCorrection(A, B, col.penetration, nx, ny);

        // Wake bodies
        A.sleeping = false; B.sleeping = false;
        this.sleepTimers.set(A.id, 0);
        this.sleepTimers.set(B.id, 0);
    }

    private positionalCorrection(A: PhysicsObject, B: PhysicsObject, penetration: number, nx: number, ny: number) {
        const percent = 0.8;  // usually 20%-80%
        const slop = 0.01;    // penetration allowance
        const correction = Math.max(penetration - slop, 0) * percent;

        const invMassA = A.isStatic ? 0 : 1 / A.mass;
        const invMassB = B.isStatic ? 0 : 1 / B.mass;
        const invSum = invMassA + invMassB || 1;

        const cx = (correction * nx) / invSum;
        const cy = (correction * ny) / invSum;

        if (!A.isStatic) { A.position.x -= cx * invMassA; A.position.y -= cy * invMassA; }
        if (!B.isStatic) { B.position.x += cx * invMassB; B.position.y += cy * invMassB; }
    }

    private pruneDestroyed(): void {
        for (const [id, obj] of this.objects) {
            if (obj.health !== undefined && obj.health <= 0) {
                obj.onDestroy?.();
                this.objects.delete(id);
                this.sleepTimers.delete(id);
            }
        }
    }

    // -----------------------------
    // Math helpers
    // -----------------------------
    private len(v: Vector2): number { return Math.hypot(v.x, v.y); }
    private normalize(v: Vector2): Vector2 {
        const l = this.len(v);
        if (l === 0) return { x: 0, y: 0 };
        return { x: v.x / l, y: v.y / l };
    }
}
