/**
 * Celestial Body Manager
 * Manages all celestial bodies in the current star system
 */

import { Logger } from '@utils/Logger';
import { Vector2, Renderer } from '@core/Renderer';
import { CelestialBody, CelestialBodyConfig, BodyInteraction, InteractionZone } from '@entities/CelestialBody';
import { InteractionPanel, PanelInteractions } from '@ui/InteractionPanel';
import { StarSystemData, PlanetData, StarData } from '@procedural/GalaxyGenerator';
import { InputManager } from '@core/InputManager';

export interface CelestialManagerConfig {
    renderDistance: number;
    interactionDistance: number;
    showOrbitLines: boolean;
    enableInteractions: boolean;
    celestialBodyConfig: CelestialBodyConfig;
}

export interface SystemLoadConfig {
    systemData: StarSystemData;
    playerStartPosition?: Vector2;
    cameraPosition: Vector2;
}

export class CelestialManager {
    private bodies: Map<string, CelestialBody> = new Map();
    private interactionPanel: InteractionPanel;
    private config: CelestialManagerConfig;
    
    // Current system data
    private currentSystem: StarSystemData | null = null;
    private systemCenter: Vector2 = { x: 512, y: 384 };
    
    // Interaction state
    private nearbyBodies: CelestialBody[] = [];
    private currentInteraction: { body: CelestialBody, zone: InteractionZone } | null = null;
    
    // Performance tracking
    private lastUpdateTime: number = 0;
    private frameCount: number = 0;
    
    private logger: Logger;

    constructor(
        config: Partial<CelestialManagerConfig> = {},
        panelInteractions: PanelInteractions = {}
    ) {
        this.logger = new Logger('CelestialManager');
        
        this.config = {
            renderDistance: 2000,
            interactionDistance: 150,
            showOrbitLines: true,
            enableInteractions: true,
            celestialBodyConfig: {
                renderDistance: 2000,
                orbitLineOpacity: 0.3,
                showOrbitLines: true,
                animationSpeed: 1.0,
                minPixelSize: 2,
                maxPixelSize: 80
            },
            ...config
        };
        
        // Initialize interaction panel
        this.interactionPanel = new InteractionPanel({
            enableAnimations: true,
            fadeSpeed: 3.0,
            maxWidth: 300,
            maxHeight: 200
        }, panelInteractions);
        
        this.logger.info('🌌 Celestial manager initialized', {
            renderDistance: this.config.renderDistance,
            enableInteractions: this.config.enableInteractions
        });
    }

    /**
     * Load a star system
     */
    loadSystem(systemConfig: SystemLoadConfig): void {
        this.logger.info(`🌟 Loading star system: ${systemConfig.systemData.name}`);
        
        // Clear existing bodies
        this.clearSystem();
        
        // Store system data
        this.currentSystem = systemConfig.systemData;
        this.systemCenter = systemConfig.cameraPosition;
        
        // Create star
        this.createStar(systemConfig.systemData.star);
        
        // Create planets
        systemConfig.systemData.planets.forEach((planetData, index) => {
            this.createPlanet(planetData, index);
        });
        
        // Create moons for planets
        systemConfig.systemData.planets.forEach(planetData => {
            if (planetData.moons && planetData.moons.length > 0) {
                planetData.moons.forEach(moonData => {
                    this.createMoon(moonData, planetData);
                });
            }
        });
        
        // Setup orbital mechanics
        this.setupOrbitalMechanics();
        
        this.logger.info(`✅ System loaded: ${this.bodies.size} celestial bodies created`);
    }

    /**
     * Create star from data
     */
    private createStar(starData: StarData): void {
        const star = new CelestialBody({
            id: starData.id,
            name: starData.name,
            type: 'star',
            position: { ...this.systemCenter },
            radius: Math.min(starData.radius * 20, 80), // Scale for visibility
            mass: starData.mass * 1000000,
            color: this.getStarColor(starData.temperature),
            starData: starData
        });
        
        // Mark as discovered (stars are always visible)
        star.isDiscovered = true;
        
        this.bodies.set(star.id, star);
        this.logger.debug(`⭐ Created star: ${star.name}`);
    }

    /**
     * Get star color based on temperature (dark retro style)
     */
    private getStarColor(temperature: number): { r: number, g: number, b: number } {
        // Dark, muted star colors
        if (temperature > 25000) return { r: 32, g: 36, b: 48 }; // Blue giant
        if (temperature > 10000) return { r: 40, g: 44, b: 48 }; // Blue-white
        if (temperature > 7500) return { r: 48, g: 48, b: 48 };  // White
        if (temperature > 6000) return { r: 48, g: 44, b: 36 };  // Yellow-white (Sun-like)
        if (temperature > 5000) return { r: 48, g: 40, b: 28 };  // Yellow
        if (temperature > 3500) return { r: 48, g: 32, b: 20 };  // Orange
        return { r: 48, g: 24, b: 16 }; // Red dwarf
    }

    /**
     * Create planet from data
     */
    private createPlanet(planetData: PlanetData, index: number): void {
        // Calculate position in orbit around star
        const angle = (index * Math.PI * 2) / (this.currentSystem?.planets.length || 1);
        const orbitDistance = 150 + (planetData.orbitDistance * 30); // Scale for screen
        
        const position = {
            x: this.systemCenter.x + Math.cos(angle) * orbitDistance,
            y: this.systemCenter.y + Math.sin(angle) * orbitDistance
        };
        
        const planet = new CelestialBody({
            id: planetData.id,
            name: planetData.name,
            type: 'planet',
            position: position,
            radius: Math.max(planetData.radius * 10, 15), // Scale for visibility
            mass: planetData.mass * 10000,
            color: this.getPlanetColor(planetData),
            planetData: planetData
        });
        
        // Set orbital mechanics
        planet.setOrbit(
            { ...this.systemCenter },
            orbitDistance,
            2 * Math.PI / (planetData.orbitPeriod / 3600) // Convert to radians per hour
        );
        
        this.bodies.set(planet.id, planet);
        this.logger.debug(`🪐 Created planet: ${planet.name}`);
    }

    /**
     * Get planet color based on type and surface (dark retro style)
     */
    private getPlanetColor(planetData: PlanetData): { r: number, g: number, b: number } {
        // Dark, muted planet colors based on surface type and planet type
        switch (planetData.surfaceType) {
            case 'Rocky': return { r: 32, g: 24, b: 16 };
            case 'Desert': return { r: 48, g: 32, b: 16 };
            case 'Ocean': return { r: 8, g: 16, b: 32 };
            case 'Ice': return { r: 32, g: 36, b: 40 };
            case 'Lava': return { r: 32, g: 16, b: 8 };
            case 'Gas': return { r: 40, g: 32, b: 24 };
            case 'Toxic': return { r: 32, g: 24, b: 16 };
            case 'Crystalline': return { r: 24, g: 32, b: 36 };
            default: return { r: 24, g: 24, b: 24 };
        }
    }

    /**
     * Create moon from data
     */
    private createMoon(moonData: any, parentPlanet: PlanetData): void {
        const parentBody = this.bodies.get(parentPlanet.id);
        if (!parentBody) return;
        
        // Position moon around parent planet
        const angle = Math.random() * Math.PI * 2;
        const orbitDistance = moonData.orbitDistance * 3; // Scale for screen
        
        const position = {
            x: parentBody.position.x + Math.cos(angle) * orbitDistance,
            y: parentBody.position.y + Math.sin(angle) * orbitDistance
        };
        
        const moon = new CelestialBody({
            id: moonData.id,
            name: moonData.name,
            type: 'moon',
            position: position,
            radius: Math.max(moonData.radius * 8, 8), // Scale for visibility
            mass: moonData.mass * 10000,
            color: { r: 24, g: 24, b: 24 }, // Dark gray for moons
            moonData: moonData
        });
        
        // Set orbital mechanics around parent planet
        moon.setOrbit(
            { ...parentBody.position },
            orbitDistance,
            2 * Math.PI / (moonData.orbitPeriod / 60) // Convert to radians per minute
        );
        
        this.bodies.set(moon.id, moon);
        this.logger.debug(`🌙 Created moon: ${moon.name} (around ${parentPlanet.name})`);
    }

    /**
     * Setup orbital mechanics for all bodies
     */
    private setupOrbitalMechanics(): void {
        // Update moon orbits to follow their parent planets
        this.bodies.forEach(body => {
            if (body.type === 'moon' && body.moonData) {
                const parentPlanet = Array.from(this.bodies.values()).find(planet => 
                    planet.type === 'planet' && planet.planetData?.moons?.some(moon => moon.id === body.id)
                );
                
                if (parentPlanet) {
                    // Moon orbit follows planet position
                    const originalSetOrbit = body.setOrbit.bind(body);
                    body.setOrbit = (center, radius, speed) => {
                        // Update orbit center to parent planet's current position
                        originalSetOrbit(parentPlanet.position, radius, speed);
                    };
                }
            }
        });
    }

    /**
     * Update all celestial bodies
     */
    update(deltaTime: number, input: InputManager, shipPosition: Vector2): void {
        this.lastUpdateTime = deltaTime;
        this.frameCount++;
        
        // Update all celestial bodies
        this.bodies.forEach(body => {
            body.update(deltaTime);
        });
        
        // Update interactions if enabled
        if (this.config.enableInteractions) {
            this.updateInteractions(shipPosition, input);
        }
        
        // Update interaction panel
        this.interactionPanel.update(deltaTime, input);
    }

    /**
     * Update interaction system
     */
    private updateInteractions(shipPosition: Vector2, input: InputManager): void {
        // Find nearby bodies
        this.nearbyBodies = [];
        let closestInteraction: { body: CelestialBody, zone: InteractionZone } | null = null;
        let closestDistance = Infinity;
        
        this.bodies.forEach(body => {
            const distance = body.getDistanceFrom(shipPosition);
            
            if (distance <= this.config.interactionDistance) {
                this.nearbyBodies.push(body);
                
                // Check for interaction zones
                const zone = body.checkInteraction(shipPosition);
                if (zone && distance < closestDistance) {
                    closestDistance = distance;
                    closestInteraction = { body, zone };
                }
            }
        });
        
        // Handle interaction changes
        if (closestInteraction && closestInteraction !== this.currentInteraction) {
            // New interaction
            this.currentInteraction = closestInteraction;
            this.interactionPanel.showInteraction(
                closestInteraction.body, 
                closestInteraction.zone, 
                shipPosition
            );
            
            this.logger.debug(`🎯 New interaction: ${closestInteraction.body.name} (${closestInteraction.zone.type})`);
            
        } else if (!closestInteraction && this.currentInteraction) {
            // Lost interaction
            this.currentInteraction = null;
            this.interactionPanel.hideInteraction();
            
            this.logger.debug('🚀 Left interaction zone');
        }
    }

    /**
     * Render all celestial bodies
     */
    render(renderer: Renderer, cameraPosition: Vector2): void {
        // Sort bodies by distance for proper rendering order
        const sortedBodies = Array.from(this.bodies.values()).sort((a, b) => {
            const distA = a.getDistanceFrom(cameraPosition);
            const distB = b.getDistanceFrom(cameraPosition);
            return distB - distA; // Render farthest first
        });
        
        // Render celestial bodies
        sortedBodies.forEach(body => {
            body.render(renderer, cameraPosition, this.config.celestialBodyConfig);
        });
        
        // Render interaction panel
        this.interactionPanel.render(renderer);
    }

    /**
     * Clear current system
     */
    private clearSystem(): void {
        this.bodies.clear();
        this.nearbyBodies = [];
        this.currentInteraction = null;
        this.interactionPanel.hideInteraction();
        
        this.logger.debug('🧹 System cleared');
    }

    /**
     * Get celestial body by ID
     */
    getBody(bodyId: string): CelestialBody | undefined {
        return this.bodies.get(bodyId);
    }

    /**
     * Get all bodies in system
     */
    getAllBodies(): CelestialBody[] {
        return Array.from(this.bodies.values());
    }

    /**
     * Get nearby bodies
     */
    getNearbyBodies(): CelestialBody[] {
        return [...this.nearbyBodies];
    }

    /**
     * Get current interaction
     */
    getCurrentInteraction(): { body: CelestialBody, zone: InteractionZone } | null {
        return this.currentInteraction;
    }

    /**
     * Force discovery of all bodies (for debugging)
     */
    discoverAllBodies(): void {
        this.bodies.forEach(body => {
            body.isDiscovered = true;
        });
        this.logger.info('🔍 All bodies discovered');
    }

    /**
     * Get system statistics
     */
    getSystemStats(): {
        bodyCount: number;
        discoveredBodies: number;
        scannedBodies: number;
        nearbyBodies: number;
        hasActiveInteraction: boolean;
    } {
        const discoveredBodies = Array.from(this.bodies.values()).filter(b => b.isDiscovered).length;
        const scannedBodies = Array.from(this.bodies.values()).filter(b => b.isScanned).length;
        
        return {
            bodyCount: this.bodies.size,
            discoveredBodies,
            scannedBodies,
            nearbyBodies: this.nearbyBodies.length,
            hasActiveInteraction: this.currentInteraction !== null
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<CelestialManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.logger.debug('Config updated', newConfig);
    }

    /**
     * Get current system data
     */
    getCurrentSystem(): StarSystemData | null {
        return this.currentSystem;
    }

    /**
     * Perform action on body
     */
    performAction(bodyId: string, action: 'scan' | 'mine' | 'land', shipPosition?: Vector2): boolean {
        const body = this.bodies.get(bodyId);
        if (!body) return false;
        
        switch (action) {
            case 'scan':
                body.performScan();
                body.isDiscovered = true;
                this.logger.info(`🔍 Scanned ${body.name}`);
                return true;
                
            case 'mine':
                if (shipPosition) {
                    const result = body.performMining(shipPosition);
                    if (result) {
                        this.logger.info(`⛏️ Mined ${result.quantity.toFixed(2)} ${result.resourceType} from ${body.name}`);
                        return true;
                    }
                }
                return false;
                
            case 'land':
                const interaction = body.checkInteraction(shipPosition || { x: 0, y: 0 });
                if (interaction && interaction.type === 'surface' && interaction.canEnter) {
                    body.isLanded = true;
                    this.logger.info(`🚁 Landed on ${body.name}`);
                    return true;
                }
                return false;
                
            default:
                return false;
        }
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        this.clearSystem();
        this.logger.info('🧹 Celestial manager cleanup completed');
    }
}