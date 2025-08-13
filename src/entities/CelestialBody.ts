/**
 * Celestial Body System
 * Handles planets, moons, stars, asteroids with orbital mechanics and interactions
 */

import { Logger } from '@utils/Logger';
import { Vector2, Renderer, Color } from '@core/Renderer';
import { PhysicsObject } from '@core/Physics';
import { StarData, PlanetData, MoonData, PlanetType, SurfaceType } from '@procedural/GalaxyGenerator';

export interface CelestialBodyConfig {
    renderDistance: number; // Maximum distance to render details
    orbitLineOpacity: number;
    showOrbitLines: boolean;
    animationSpeed: number;
    minPixelSize: number; // Minimum size for distant objects
    maxPixelSize: number; // Maximum size for close objects
}

export interface InteractionZone {
    bodyId: string;
    type: 'orbit' | 'surface' | 'atmosphere';
    radius: number;
    distance: number; // Distance from ship
    canEnter: boolean;
    requirements?: string[];
}

export interface BodyInteraction {
    onEnterOrbit?: (bodyId: string) => void;
    onExitOrbit?: (bodyId: string) => void;
    onLandingAttempt?: (bodyId: string, canLand: boolean) => void;
    onMining?: (bodyId: string, resources: MiningResult) => void;
    onScan?: (bodyId: string, scanData: ScanResult) => void;
}

export interface MiningResult {
    resourceType: string;
    quantity: number;
    quality: number; // 0-1
    depletion: number; // How much the resource is depleted
}

export interface ScanResult {
    composition: string[];
    atmosphere?: AtmosphereData;
    surfaceConditions: SurfaceConditions;
    biologicalSigns: boolean;
    anomalies: string[];
    mineralDeposits: MineralDeposit[];
}

export interface AtmosphereData {
    pressure: number; // Earth atmospheres
    composition: { [element: string]: number };
    breathable: boolean;
    toxic: boolean;
    temperature: number; // Kelvin
}

export interface SurfaceConditions {
    temperature: number; // Kelvin
    gravity: number; // Earth gravities
    radiation: number; // 0-1 (danger level)
    weather: string;
    landingDifficulty: number; // 0-1
}

export interface MineralDeposit {
    type: string;
    richness: number; // 0-1
    accessibility: number; // 0-1
    extractionDifficulty: number; // 0-1
}

export class CelestialBody {
    public id: string;
    public name: string;
    public type: 'star' | 'planet' | 'moon' | 'asteroid';
    public position: Vector2;
    public velocity: Vector2 = { x: 0, y: 0 };
    
    // Visual properties
    public radius: number;
    public color: Color;
    public atmosphereColor?: Color;
    public hasAtmosphere: boolean = false;
    public hasRings: boolean = false;
    public ringColor?: Color;
    
    // Orbital mechanics
    public orbitCenter?: Vector2;
    public orbitRadius: number = 0;
    public orbitSpeed: number = 0;
    public orbitAngle: number = 0;
    public rotationSpeed: number = 0;
    public currentRotation: number = 0;
    
    // Physics and interaction
    public mass: number;
    public physicsObject?: PhysicsObject;
    public interactionZones: InteractionZone[] = [];
    
    // Data
    public planetData?: PlanetData;
    public starData?: StarData;
    public moonData?: MoonData;
    
    // Resource data
    public mineralDeposits: MineralDeposit[] = [];
    public surfaceConditions?: SurfaceConditions;
    public atmosphereData?: AtmosphereData;
    
    // Interaction state
    public isDiscovered: boolean = false;
    public isScanned: boolean = false;
    public isLanded: boolean = false;
    public resourcesDepleted: number = 0; // 0-1
    
    private logger: Logger;

    constructor(config: {
        id: string;
        name: string;
        type: 'star' | 'planet' | 'moon' | 'asteroid';
        position: Vector2;
        radius: number;
        mass: number;
        color: Color;
        planetData?: PlanetData;
        starData?: StarData;
        moonData?: MoonData;
    }) {
        this.id = config.id;
        this.name = config.name;
        this.type = config.type;
        this.position = { ...config.position };
        this.radius = config.radius;
        this.mass = config.mass;
        this.color = { ...config.color };
        
        this.planetData = config.planetData;
        this.starData = config.starData;
        this.moonData = config.moonData;
        
        this.logger = new Logger(`CelestialBody:${config.name}`);
        
        this.initializeFromData();
        this.generateInteractionZones();
        this.generateResources();
        
        this.logger.debug(`Created ${this.type}: ${this.name}`, {
            radius: this.radius,
            mass: this.mass,
            hasAtmosphere: this.hasAtmosphere
        });
    }

    /**
     * Initialize body properties from data
     */
    private initializeFromData(): void {
        if (this.planetData) {
            this.hasAtmosphere = this.planetData.hasAtmosphere;
            this.hasRings = this.planetData.hasRings;
            
            // Set colors based on planet type with dark, muted tones
            this.updatePlanetVisuals();
            
            // Setup orbital mechanics
            if (this.planetData.orbitDistance > 0) {
                this.orbitRadius = this.planetData.orbitDistance * 50; // Scale for display
                this.orbitSpeed = 2 * Math.PI / (this.planetData.orbitPeriod / 3600); // Convert to radians per hour
            }
            
            // Rotation (30-frame cycle as specified)
            this.rotationSpeed = (2 * Math.PI) / 30; // 30 frames for full rotation
        }
        
        if (this.starData) {
            // Star visual properties with muted glow
            this.color = this.getDarkStarColor(this.starData.temperature);
            this.rotationSpeed = (2 * Math.PI) / 60; // Slower star rotation
        }
        
        if (this.moonData) {
            // Moon properties
            this.orbitRadius = this.moonData.orbitDistance * 5; // Scale for display
            this.orbitSpeed = 2 * Math.PI / (this.moonData.orbitPeriod / 60); // Convert to minutes
            this.rotationSpeed = this.moonData.tidallyLocked ? this.orbitSpeed : (2 * Math.PI) / 45;
        }
    }

    /**
     * Update planet visual properties with dark, atmospheric colors
     */
    private updatePlanetVisuals(): void {
        if (!this.planetData) return;
        
        // Dark, muted planet colors based on type
        switch (this.planetData.type) {
            case PlanetType.Terrestrial:
                this.color = { r: 32, g: 24, b: 16 }; // Dark brown/rock
                if (this.hasAtmosphere) {
                    this.atmosphereColor = { r: 16, g: 24, b: 32 }; // Dark blue haze
                }
                break;
                
            case PlanetType.Ocean:
                this.color = { r: 8, g: 16, b: 32 }; // Deep dark blue
                this.atmosphereColor = { r: 12, g: 20, b: 28 }; // Muted blue atmosphere
                break;
                
            case PlanetType.Desert:
                this.color = { r: 48, g: 32, b: 16 }; // Dark sand/rust
                break;
                
            case PlanetType.Volcanic:
                this.color = { r: 32, g: 16, b: 8 }; // Dark volcanic rock
                break;
                
            case PlanetType.Frozen:
                this.color = { r: 32, g: 36, b: 40 }; // Dark ice
                break;
                
            case PlanetType.GasGiant:
                this.color = { r: 40, g: 32, b: 24 }; // Muted gas colors
                this.atmosphereColor = { r: 32, g: 28, b: 20 }; // Dark atmosphere
                if (this.hasRings) {
                    this.ringColor = { r: 24, g: 20, b: 16 }; // Dark ring material
                }
                break;
                
            case PlanetType.IceGiant:
                this.color = { r: 16, g: 24, b: 32 }; // Dark blue-gray
                this.atmosphereColor = { r: 12, g: 20, b: 28 }; // Muted methane haze
                break;
                
            case PlanetType.Toxic:
                this.color = { r: 32, g: 24, b: 16 }; // Dark toxic surface
                this.atmosphereColor = { r: 48, g: 32, b: 16 }; // Toxic haze
                break;
        }
    }

    /**
     * Get dark star color based on temperature
     */
    private getDarkStarColor(temperature: number): Color {
        // Dark, muted star colors (no bright neons)
        if (temperature > 25000) return { r: 32, g: 36, b: 48 }; // Muted blue
        if (temperature > 10000) return { r: 40, g: 44, b: 48 }; // Blue-white
        if (temperature > 7500) return { r: 48, g: 48, b: 48 };  // Muted white
        if (temperature > 6000) return { r: 48, g: 44, b: 36 };  // Yellow-white
        if (temperature > 5000) return { r: 48, g: 40, b: 28 };  // Muted yellow
        if (temperature > 3500) return { r: 48, g: 32, b: 20 };  // Orange
        return { r: 48, g: 24, b: 16 }; // Dark red
    }

    /**
     * Generate interaction zones around the body
     */
    private generateInteractionZones(): void {
        this.interactionZones = [];
        
        // Orbit zone (space around the body)
        this.interactionZones.push({
            bodyId: this.id,
            type: 'orbit',
            radius: this.radius * 3,
            distance: 0,
            canEnter: true
        });
        
        // Atmosphere zone (if has atmosphere)
        if (this.hasAtmosphere) {
            this.interactionZones.push({
                bodyId: this.id,
                type: 'atmosphere',
                radius: this.radius * 1.5,
                distance: 0,
                canEnter: true,
                requirements: ['heat_shielding']
            });
        }
        
        // Surface zone (for landing)
        if (this.type !== 'star') {
            const canLand = this.canShipLand();
            this.interactionZones.push({
                bodyId: this.id,
                type: 'surface',
                radius: this.radius,
                distance: 0,
                canEnter: canLand,
                requirements: canLand ? [] : ['specialized_equipment']
            });
        }
    }

    /**
     * Determine if a ship can land on this body
     */
    private canShipLand(): boolean {
        if (this.type === 'star') return false;
        if (this.type === 'asteroid') return true; // Can dock with asteroids
        
        if (this.planetData) {
            // Gas giants can't be landed on
            if (this.planetData.type === PlanetType.GasGiant || 
                this.planetData.type === PlanetType.IceGiant) {
                return false;
            }
            
            // Very high temperature/pressure is dangerous
            if (this.planetData.temperature > 1000) return false;
            
            return true;
        }
        
        return true; // Moons and unknown bodies default to landable
    }

    /**
     * Generate mineral deposits and resources
     */
    private generateResources(): void {
        this.mineralDeposits = [];
        
        if (this.type === 'star') return; // Stars don't have mineable resources
        
        // Generate resources based on body type
        const resourceTypes = this.getResourceTypes();
        
        resourceTypes.forEach(resourceType => {
            this.mineralDeposits.push({
                type: resourceType,
                richness: Math.random() * 0.7 + 0.3, // 0.3 to 1.0
                accessibility: Math.random() * 0.8 + 0.2, // 0.2 to 1.0
                extractionDifficulty: Math.random() * 0.6 + 0.2 // 0.2 to 0.8
            });
        });
        
        // Generate surface conditions
        this.generateSurfaceConditions();
    }

    /**
     * Get available resource types for this body
     */
    private getResourceTypes(): string[] {
        const baseResources = ['metal', 'crystals'];
        
        if (this.type === 'asteroid') {
            return [...baseResources, 'rare_metals', 'ice'];
        }
        
        if (this.planetData) {
            switch (this.planetData.type) {
                case PlanetType.Terrestrial:
                    return [...baseResources, 'rare_earth', 'radioactive'];
                case PlanetType.Volcanic:
                    return [...baseResources, 'sulfur', 'rare_metals'];
                case PlanetType.Frozen:
                    return [...baseResources, 'ice', 'frozen_gases'];
                case PlanetType.Desert:
                    return [...baseResources, 'silicon', 'rare_earth'];
                case PlanetType.Ocean:
                    return [...baseResources, 'deuterium', 'biologics'];
                default:
                    return baseResources;
            }
        }
        
        return baseResources;
    }

    /**
     * Generate surface conditions for landing/mining
     */
    private generateSurfaceConditions(): void {
        if (this.type === 'star') return;
        
        let temperature = 273; // Default Earth-like
        let gravity = 1.0;
        let radiation = 0.0;
        let weather = 'none';
        let landingDifficulty = 0.2;
        
        if (this.planetData) {
            temperature = this.planetData.temperature;
            gravity = Math.sqrt(this.planetData.mass); // Simplified gravity calculation
            
            // Radiation based on proximity to star and atmosphere
            radiation = this.hasAtmosphere ? 0.1 : 0.3;
            
            // Weather based on atmosphere and temperature
            if (this.hasAtmosphere) {
                if (temperature > 373) weather = 'extreme_heat';
                else if (temperature < 273) weather = 'frozen';
                else weather = 'stable';
            }
            
            // Landing difficulty based on conditions
            landingDifficulty = Math.min(0.9, 
                (Math.abs(temperature - 273) / 500) + 
                (Math.abs(gravity - 1) * 0.3) + 
                (radiation * 0.4)
            );
        }
        
        this.surfaceConditions = {
            temperature,
            gravity,
            radiation,
            weather,
            landingDifficulty
        };
    }

    /**
     * Update orbital mechanics and rotation
     */
    update(deltaTime: number): void {
        // Update orbital position
        if (this.orbitCenter && this.orbitRadius > 0) {
            this.orbitAngle += this.orbitSpeed * deltaTime;
            
            this.position.x = this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius;
            this.position.y = this.orbitCenter.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        }
        
        // Update rotation (30-frame animation cycle)
        this.currentRotation += this.rotationSpeed * deltaTime;
        if (this.currentRotation > 2 * Math.PI) {
            this.currentRotation -= 2 * Math.PI;
        }
        
        // Update physics object position if exists
        if (this.physicsObject) {
            this.physicsObject.position = { ...this.position };
        }
    }

    /**
     * Render the celestial body with dark retro style
     */
    render(renderer: Renderer, cameraPosition: Vector2, config: CelestialBodyConfig): void {
        const distance = this.getDistanceFrom(cameraPosition);
        
        // Don't render if too far away
        if (distance > config.renderDistance) return;
        
        // Calculate screen position
        const screenPos = {
            x: this.position.x - cameraPosition.x + 512, // Assuming 1024x768 screen
            y: this.position.y - cameraPosition.y + 384
        };
        
        // Calculate size based on distance
        const baseSize = this.radius;
        const scaledSize = Math.max(config.minPixelSize, 
            Math.min(config.maxPixelSize, baseSize * (config.renderDistance / distance)));
        
        // Render orbit line if enabled and not too close
        if (config.showOrbitLines && this.orbitCenter && distance > 100) {
            this.renderOrbitLine(renderer, cameraPosition, config);
        }
        
        // Render atmosphere if present
        if (this.hasAtmosphere && this.atmosphereColor) {
            const atmoSize = scaledSize * 1.3;
            renderer.drawCircle(screenPos.x, screenPos.y, atmoSize, this.atmosphereColor, true);
        }
        
        // Render rings if present
        if (this.hasRings && this.ringColor) {
            this.renderRings(renderer, screenPos, scaledSize);
        }
        
        // Render main body
        renderer.drawCircle(screenPos.x, screenPos.y, scaledSize, this.color, true);
        
        // Add subtle rotation texture for planets
        if (this.type === 'planet' && scaledSize > 8) {
            this.renderSurfaceDetails(renderer, screenPos, scaledSize);
        }
        
        // Render star glow effect (very subtle)
        if (this.type === 'star') {
            this.renderStarGlow(renderer, screenPos, scaledSize);
        }
        
        // Render name if close enough and discovered
        if (distance < config.renderDistance / 3 && this.isDiscovered) {
            renderer.renderText(this.name, screenPos.x - 20, screenPos.y - scaledSize - 15, 
                { r: 48, g: 48, b: 48 }, 8);
        }
    }

    /**
     * Render orbit line with dark, subtle styling
     */
    private renderOrbitLine(renderer: Renderer, cameraPosition: Vector2, config: CelestialBodyConfig): void {
        if (!this.orbitCenter) return;
        
        const centerScreen = {
            x: this.orbitCenter.x - cameraPosition.x + 512,
            y: this.orbitCenter.y - cameraPosition.y + 384
        };
        
        // Render faint orbit line
        const orbitColor = { 
            r: Math.floor(this.color.r * 0.3), 
            g: Math.floor(this.color.g * 0.3), 
            b: Math.floor(this.color.b * 0.3) 
        };
        
        renderer.drawCircle(centerScreen.x, centerScreen.y, this.orbitRadius, orbitColor, false);
    }

    /**
     * Render planet rings with dark styling
     */
    private renderRings(renderer: Renderer, screenPos: Vector2, size: number): void {
        if (!this.ringColor) return;
        
        const innerRadius = size * 1.5;
        const outerRadius = size * 2.2;
        
        // Draw ring segments
        for (let radius = innerRadius; radius < outerRadius; radius += 2) {
            const alpha = 1 - ((radius - innerRadius) / (outerRadius - innerRadius)) * 0.7;
            const ringColor = {
                r: Math.floor(this.ringColor.r * alpha),
                g: Math.floor(this.ringColor.g * alpha),
                b: Math.floor(this.ringColor.b * alpha)
            };
            
            renderer.drawCircle(screenPos.x, screenPos.y, radius, ringColor, false);
        }
    }

    /**
     * Render surface details with 30-frame rotation
     */
    private renderSurfaceDetails(renderer: Renderer, screenPos: Vector2, size: number): void {
        const rotationFrame = Math.floor((this.currentRotation / (2 * Math.PI)) * 30);
        
        // Simple surface features that rotate
        for (let i = 0; i < 3; i++) {
            const angle = (i * 2 * Math.PI / 3) + this.currentRotation;
            const featureX = screenPos.x + Math.cos(angle) * (size * 0.6);
            const featureY = screenPos.y + Math.sin(angle) * (size * 0.3); // Flattened for 2D view
            
            // Dark surface features
            const featureColor = {
                r: Math.max(0, this.color.r - 8),
                g: Math.max(0, this.color.g - 8),
                b: Math.max(0, this.color.b - 8)
            };
            
            renderer.fillRect(featureX - 1, featureY - 1, 2, 2, featureColor);
        }
    }

    /**
     * Render subtle star glow effect
     */
    private renderStarGlow(renderer: Renderer, screenPos: Vector2, size: number): void {
        // Very subtle glow effect (no bright neons)
        const glowColor = {
            r: Math.min(64, this.color.r + 16),
            g: Math.min(64, this.color.g + 16),
            b: Math.min(64, this.color.b + 16)
        };
        
        renderer.drawCircle(screenPos.x, screenPos.y, size * 1.2, glowColor, false);
    }

    /**
     * Check for ship interactions
     */
    checkInteraction(shipPosition: Vector2): InteractionZone | null {
        const distance = this.getDistanceFrom(shipPosition);
        
        // Check each interaction zone
        for (const zone of this.interactionZones) {
            if (distance <= zone.radius) {
                zone.distance = distance;
                return zone;
            }
        }
        
        return null;
    }

    /**
     * Perform mining operation
     */
    performMining(shipPosition: Vector2, miningEfficiency: number = 1.0): MiningResult | null {
        const interaction = this.checkInteraction(shipPosition);
        
        if (!interaction || interaction.type !== 'surface') {
            return null;
        }
        
        // Find best resource to mine
        const availableResources = this.mineralDeposits.filter(deposit => 
            deposit.richness > this.resourcesDepleted
        );
        
        if (availableResources.length === 0) {
            return null;
        }
        
        const resource = availableResources[0]; // Mine the first available resource
        const extractedQuantity = resource.richness * resource.accessibility * miningEfficiency;
        
        // Deplete resources
        resource.richness = Math.max(0, resource.richness - 0.05);
        this.resourcesDepleted = Math.min(1, this.resourcesDepleted + 0.02);
        
        return {
            resourceType: resource.type,
            quantity: extractedQuantity,
            quality: resource.accessibility,
            depletion: this.resourcesDepleted
        };
    }

    /**
     * Perform detailed scan
     */
    performScan(): ScanResult {
        this.isScanned = true;
        
        return {
            composition: this.getResourceTypes(),
            atmosphere: this.atmosphereData,
            surfaceConditions: this.surfaceConditions!,
            biologicalSigns: this.planetData?.hasLife || false,
            anomalies: [], // TODO: Generate anomalies
            mineralDeposits: [...this.mineralDeposits]
        };
    }

    /**
     * Get distance from a position
     */
    getDistanceFrom(position: Vector2): number {
        const dx = this.position.x - position.x;
        const dy = this.position.y - position.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Set orbit around another body
     */
    setOrbit(center: Vector2, radius: number, speed: number): void {
        this.orbitCenter = { ...center };
        this.orbitRadius = radius;
        this.orbitSpeed = speed;
    }

    /**
     * Get interaction info for UI
     */
    getInteractionInfo(): string {
        if (!this.isDiscovered) return 'Unknown Object';
        
        let info = `${this.name} (${this.type.toUpperCase()})`;
        
        if (this.surfaceConditions) {
            info += `\nTemp: ${this.surfaceConditions.temperature.toFixed(0)}K`;
            info += `\nGravity: ${this.surfaceConditions.gravity.toFixed(1)}g`;
            
            if (this.mineralDeposits.length > 0) {
                info += `\nResources: ${this.mineralDeposits.length} types`;
            }
        }
        
        return info;
    }
}