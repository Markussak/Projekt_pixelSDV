/**
 * Galaxy Manager - Integration Layer
 * Provides unified interface for galaxy generation, persistence, and exploration
 */

import { Logger } from '@utils/Logger';
import { Vector2 } from '@core/Renderer';
import { 
    GalaxyGenerator, 
    GalaxyConfig, 
    StarData, 
    StarSystemData,
    PlanetData 
} from './GalaxyGenerator';
import { 
    GalaxyPersistence, 
    PlayerGalaxyData,
    VisitedLocation,
    ChunkLoadOptions 
} from './GalaxyPersistence';

export interface ExplorationData {
    exploredSystems: Set<string>;
    discoveredPlanets: Set<string>;
    visitedLocations: VisitedLocation[];
    currentSystemId: string;
    homeSystemId: string;
}

export interface GalaxyManagerConfig {
    enableAutoSave: boolean;
    autoSaveInterval: number; // milliseconds
    chunkLoadRadius: number; // light years
    maxLoadedSystems: number;
    galaxyConfig?: Partial<GalaxyConfig>;
}

export interface GalaxyStats {
    totalStars: number;
    totalSystems: number;
    exploredSystems: number;
    discoveredPlanets: number;
    systemsVisited: number;
    distanceTraveled: number;
    currentSystemName: string;
    galaxySize: number;
    explorationProgress: number; // 0-1
}

export class GalaxyManager {
    private generator: GalaxyGenerator;
    private persistence: GalaxyPersistence;
    private config: GalaxyManagerConfig;
    
    // Galaxy state
    private explorationData: ExplorationData;
    private playerData: PlayerGalaxyData;
    private isInitialized = false;
    
    // Runtime data
    private loadedSystems: Map<string, StarSystemData> = new Map();
    private nearbyStars: StarData[] = [];
    private currentSystem: StarSystemData | null = null;
    
    // Auto-save
    private autoSaveTimer: number | null = null;
    
    private logger: Logger;

    constructor(config: Partial<GalaxyManagerConfig> = {}) {
        this.logger = new Logger('GalaxyManager');
        
        // Default configuration
        this.config = {
            enableAutoSave: true,
            autoSaveInterval: 60000, // 1 minute
            chunkLoadRadius: 500, // 500 light years
            maxLoadedSystems: 100,
            galaxyConfig: {
                seed: Math.floor(Math.random() * 1000000),
                starCount: 800, // Reduced for better performance
                size: 30000 // 30,000 light years
            },
            ...config
        };
        
        // Initialize components
        this.generator = new GalaxyGenerator(this.config.galaxyConfig);
        this.persistence = new GalaxyPersistence();
        
        // Initialize exploration data
        this.explorationData = {
            exploredSystems: new Set(),
            discoveredPlanets: new Set(),
            visitedLocations: [],
            currentSystemId: '',
            homeSystemId: ''
        };
        
        // Initialize player data
        this.playerData = {
            currentSystemId: '',
            homeSystemId: '',
            totalSystemsVisited: 0,
            totalPlanetsExplored: 0,
            totalDistanceTraveled: 0,
            galaxyDiscoveryProgress: 0
        };
        
        this.logger.info('🌌 Galaxy manager initialized', {
            config: this.config
        });
    }

    /**
     * Initialize the galaxy (load existing or generate new)
     */
    async initialize(): Promise<void> {
        this.logger.info('🚀 Initializing galaxy...');
        
        try {
            // Try to load existing galaxy
            const savedData = await this.persistence.loadGalaxy();
            
            if (savedData) {
                // Load from save
                this.logger.info('📁 Loading existing galaxy...');
                this.generator = savedData.generator;
                this.playerData = savedData.playerData;
                
                // Convert arrays back to Sets
                this.explorationData = {
                    exploredSystems: new Set(savedData.explorationData.exploredSystems),
                    discoveredPlanets: new Set(savedData.explorationData.discoveredPlanets),
                    visitedLocations: savedData.explorationData.visitedLocations,
                    currentSystemId: savedData.playerData.currentSystemId,
                    homeSystemId: savedData.playerData.homeSystemId
                };
                
            } else {
                // Generate new galaxy
                this.logger.info('🔄 Generating new galaxy...');
                await this.generator.generateGalaxy();
                
                // Set up initial player data
                await this.setupNewGame();
            }
            
            // Load current system and nearby area
            await this.loadCurrentArea();
            
            // Setup auto-save
            if (this.config.enableAutoSave) {
                this.setupAutoSave();
            }
            
            this.isInitialized = true;
            this.logger.info('✅ Galaxy initialization completed');
            
        } catch (error) {
            this.logger.error('❌ Galaxy initialization failed', error);
            throw error;
        }
    }

    /**
     * Setup new game with starting system
     */
    private async setupNewGame(): Promise<void> {
        // Find a suitable starting system near galactic center
        const centerStars = this.generator.getStarsInRadius({ x: 0, y: 0 }, 5000);
        
        // Find a G-type star with planets
        let startingSystem: StarSystemData | null = null;
        for (const star of centerStars) {
            if (star.type === 'G') { // Sun-like star
                const system = this.generator.getStarSystem(star.id);
                if (system && system.planets.length > 0) {
                    startingSystem = system;
                    break;
                }
            }
        }
        
        // Fallback to any system with planets
        if (!startingSystem) {
            for (const star of centerStars) {
                const system = this.generator.getStarSystem(star.id);
                if (system && system.planets.length > 0) {
                    startingSystem = system;
                    break;
                }
            }
        }
        
        if (!startingSystem) {
            throw new Error('Could not find suitable starting system');
        }
        
        // Set starting system
        this.explorationData.currentSystemId = startingSystem.id;
        this.explorationData.homeSystemId = startingSystem.id;
        this.playerData.currentSystemId = startingSystem.id;
        this.playerData.homeSystemId = startingSystem.id;
        
        // Mark as explored
        this.exploreSystem(startingSystem.id);
        
        this.logger.info(`🏠 Starting system set: ${startingSystem.name}`);
    }

    /**
     * Load current area around player
     */
    private async loadCurrentArea(): Promise<void> {
        if (!this.explorationData.currentSystemId) return;
        
        // Get current system
        this.currentSystem = this.generator.getStarSystem(this.explorationData.currentSystemId) || null;
        if (!this.currentSystem) {
            this.logger.error('Current system not found');
            return;
        }
        
        // Load nearby systems
        const chunkOptions: ChunkLoadOptions = {
            center: this.currentSystem.position,
            radius: this.config.chunkLoadRadius,
            maxSystems: this.config.maxLoadedSystems,
            includeUnexplored: true
        };
        
        const nearbySystems = await this.persistence.loadGalaxyChunk(this.generator, chunkOptions);
        
        // Update loaded systems
        this.loadedSystems.clear();
        for (const system of nearbySystems) {
            this.loadedSystems.set(system.id, system);
        }
        
        // Get nearby stars for rendering
        this.nearbyStars = this.generator.getStarsInRadius(
            this.currentSystem.position,
            this.config.chunkLoadRadius / 2
        );
        
        this.logger.debug(`Loaded ${nearbySystems.length} systems and ${this.nearbyStars.length} stars`);
    }

    /**
     * Travel to a new system
     */
    async travelToSystem(systemId: string): Promise<boolean> {
        const targetSystem = this.generator.getStarSystem(systemId);
        if (!targetSystem) {
            this.logger.error(`System not found: ${systemId}`);
            return false;
        }
        
        // Calculate travel distance
        const currentPos = this.currentSystem?.position || { x: 0, y: 0 };
        const distance = Math.sqrt(
            Math.pow(targetSystem.position.x - currentPos.x, 2) +
            Math.pow(targetSystem.position.y - currentPos.y, 2)
        );
        
        // Update player data
        this.explorationData.currentSystemId = systemId;
        this.playerData.currentSystemId = systemId;
        this.playerData.totalDistanceTraveled += distance;
        
        // Add to visited systems if not already visited
        if (!this.explorationData.exploredSystems.has(systemId)) {
            this.playerData.totalSystemsVisited++;
        }
        
        // Explore the system
        this.exploreSystem(systemId);
        
        // Add to visited locations
        this.explorationData.visitedLocations.push({
            systemId: systemId,
            timestamp: Date.now(),
            coordinates: targetSystem.position
        });
        
        // Reload area around new system
        await this.loadCurrentArea();
        
        this.logger.info(`🚀 Traveled to ${targetSystem.name} (${distance.toFixed(1)} LY)`);
        return true;
    }

    /**
     * Explore a system (mark as explored)
     */
    exploreSystem(systemId: string): void {
        if (!this.explorationData.exploredSystems.has(systemId)) {
            this.explorationData.exploredSystems.add(systemId);
            
            // Explore all planets in the system
            const system = this.generator.getStarSystem(systemId);
            if (system) {
                for (const planet of system.planets) {
                    this.discoverPlanet(planet.id);
                }
            }
            
            this.updateExplorationProgress();
            this.logger.debug(`System explored: ${systemId}`);
        }
    }

    /**
     * Discover a planet
     */
    discoverPlanet(planetId: string): void {
        if (!this.explorationData.discoveredPlanets.has(planetId)) {
            this.explorationData.discoveredPlanets.add(planetId);
            this.playerData.totalPlanetsExplored++;
            
            this.logger.debug(`Planet discovered: ${planetId}`);
        }
    }

    /**
     * Update exploration progress
     */
    private updateExplorationProgress(): void {
        const totalSystems = this.generator.getAllSystems().length;
        const exploredSystems = this.explorationData.exploredSystems.size;
        
        this.playerData.galaxyDiscoveryProgress = totalSystems > 0 ? exploredSystems / totalSystems : 0;
    }

    /**
     * Get nearby systems for rendering
     */
    getNearbyStars(): StarData[] {
        return [...this.nearbyStars];
    }

    /**
     * Get loaded systems
     */
    getLoadedSystems(): StarSystemData[] {
        return Array.from(this.loadedSystems.values());
    }

    /**
     * Get current system
     */
    getCurrentSystem(): StarSystemData | null {
        return this.currentSystem;
    }

    /**
     * Get system by ID
     */
    getSystem(systemId: string): StarSystemData | undefined {
        return this.loadedSystems.get(systemId) || this.generator.getStarSystem(systemId);
    }

    /**
     * Find systems within radius
     */
    findSystemsInRadius(center: Vector2, radius: number): StarSystemData[] {
        const nearbyStars = this.generator.getStarsInRadius(center, radius);
        const systems: StarSystemData[] = [];
        
        for (const star of nearbyStars) {
            const system = this.generator.getStarSystem(star.id);
            if (system) {
                systems.push(system);
            }
        }
        
        return systems;
    }

    /**
     * Check if system is explored
     */
    isSystemExplored(systemId: string): boolean {
        return this.explorationData.exploredSystems.has(systemId);
    }

    /**
     * Check if planet is discovered
     */
    isPlanetDiscovered(planetId: string): boolean {
        return this.explorationData.discoveredPlanets.has(planetId);
    }

    /**
     * Get galaxy statistics
     */
    getGalaxyStats(): GalaxyStats {
        const totalStars = this.generator.getAllStars().length;
        const allSystems = this.generator.getAllSystems();
        const totalSystems = allSystems.length;
        const totalPlanets = allSystems.reduce((sum, system) => sum + system.planets.length, 0);
        
        return {
            totalStars: totalStars,
            totalSystems: totalSystems,
            exploredSystems: this.explorationData.exploredSystems.size,
            discoveredPlanets: this.explorationData.discoveredPlanets.size,
            systemsVisited: this.playerData.totalSystemsVisited,
            distanceTraveled: this.playerData.totalDistanceTraveled,
            currentSystemName: this.currentSystem?.name || 'Unknown',
            galaxySize: this.generator.getGalaxyConfig().size,
            explorationProgress: this.playerData.galaxyDiscoveryProgress
        };
    }

    /**
     * Save galaxy state
     */
    async saveGalaxy(): Promise<void> {
        if (!this.isInitialized) return;
        
        try {
            // Convert Sets to Arrays for serialization
            const explorationData = {
                exploredSystems: Array.from(this.explorationData.exploredSystems),
                discoveredPlanets: Array.from(this.explorationData.discoveredPlanets),
                visitedLocations: this.explorationData.visitedLocations
            };
            
            await this.persistence.saveGalaxy(
                this.generator,
                this.playerData,
                explorationData
            );
            
            this.logger.debug('Galaxy saved successfully');
            
        } catch (error) {
            this.logger.error('Failed to save galaxy', error);
        }
    }

    /**
     * Setup auto-save timer
     */
    private setupAutoSave(): void {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = window.setInterval(async () => {
            await this.saveGalaxy();
        }, this.config.autoSaveInterval);
        
        this.logger.debug(`Auto-save enabled (${this.config.autoSaveInterval}ms interval)`);
    }

    /**
     * Get player galaxy data
     */
    getPlayerData(): PlayerGalaxyData {
        return { ...this.playerData };
    }

    /**
     * Get exploration data
     */
    getExplorationData(): ExplorationData {
        return {
            exploredSystems: new Set(this.explorationData.exploredSystems),
            discoveredPlanets: new Set(this.explorationData.discoveredPlanets),
            visitedLocations: [...this.explorationData.visitedLocations],
            currentSystemId: this.explorationData.currentSystemId,
            homeSystemId: this.explorationData.homeSystemId
        };
    }

    /**
     * Export galaxy for sharing
     */
    async exportGalaxy(): Promise<string> {
        return await this.persistence.exportGalaxy();
    }

    /**
     * Import galaxy from backup
     */
    async importGalaxy(data: string): Promise<void> {
        await this.persistence.importGalaxy(data);
        
        // Reinitialize after import
        this.isInitialized = false;
        await this.initialize();
    }

    /**
     * Get storage statistics
     */
    getStorageStats() {
        return this.persistence.getStorageStats();
    }

    /**
     * Search for systems by name
     */
    searchSystems(query: string): StarSystemData[] {
        const allSystems = this.generator.getAllSystems();
        const lowercaseQuery = query.toLowerCase();
        
        return allSystems.filter(system => 
            system.name.toLowerCase().includes(lowercaseQuery) ||
            system.star.name.toLowerCase().includes(lowercaseQuery)
        ).slice(0, 20); // Limit results
    }

    /**
     * Get distance between two systems
     */
    getSystemDistance(systemId1: string, systemId2: string): number {
        const system1 = this.getSystem(systemId1);
        const system2 = this.getSystem(systemId2);
        
        if (!system1 || !system2) return -1;
        
        return Math.sqrt(
            Math.pow(system2.position.x - system1.position.x, 2) +
            Math.pow(system2.position.y - system1.position.y, 2)
        );
    }

    /**
     * Get home system
     */
    getHomeSystem(): StarSystemData | null {
        if (!this.explorationData.homeSystemId) return null;
        return this.getSystem(this.explorationData.homeSystemId) || null;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<GalaxyManagerConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Restart auto-save if interval changed
        if (newConfig.autoSaveInterval && this.config.enableAutoSave) {
            this.setupAutoSave();
        }
        
        this.logger.debug('Galaxy manager configuration updated');
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        // Save before cleanup
        await this.saveGalaxy();
        
        // Clear auto-save timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        // Clear cached data
        this.loadedSystems.clear();
        this.nearbyStars = [];
        this.persistence.clearCache();
        
        this.logger.info('🧹 Galaxy manager cleanup completed');
    }

    /**
     * Check if galaxy is initialized
     */
    isGalaxyInitialized(): boolean {
        return this.isInitialized;
    }
}