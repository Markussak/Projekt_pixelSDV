/**
 * Galaxy Persistence System
 * Handles saving and loading of galaxy data with compression and chunked loading
 */

import { Logger } from '@utils/Logger';
import { 
    GalaxyConfig, 
    StarData, 
    StarSystemData, 
    PlanetData,
    GalaxyGenerator 
} from './GalaxyGenerator';
import { Vector2 } from '@core/Renderer';
import { Platform, PlatformDetector } from '@utils/Platform';

export interface GalaxySaveData {
    version: string;
    timestamp: number;
    config: GalaxyConfig;
    playerData: PlayerGalaxyData;
    
    // Galaxy data
    stars: CompressedStarData[];
    systems: CompressedSystemData[];
    
    // Discovery and exploration data
    exploredSystems: string[];
    discoveredPlanets: string[];
    visitedLocations: VisitedLocation[];
    
    // Player progression in galaxy
    reputation: Map<string, number>; // Faction reputation
    tradeRoutes: TradeRoute[];
}

export interface PlayerGalaxyData {
    currentSystemId: string;
    homeSystemId: string;
    totalSystemsVisited: number;
    totalPlanetsExplored: number;
    totalDistanceTraveled: number; // Light years
    galaxyDiscoveryProgress: number; // 0-1
}

export interface CompressedStarData {
    id: string;
    name: string;
    pos: [number, number]; // [x, y] position
    type: string; // StarType
    mass: number;
    temp: number; // Temperature
    color: [number, number, number]; // [r, g, b]
}

export interface CompressedSystemData {
    id: string;
    planets: CompressedPlanetData[];
    explored: boolean;
    lastVisited?: number; // Timestamp
}

export interface CompressedPlanetData {
    id: string;
    name: string;
    type: string; // PlanetType
    orbit: number; // Orbit distance
    radius: number;
    temp: number; // Temperature
    hasAtmo: boolean;
    moons: number; // Moon count
    color: [number, number, number]; // [r, g, b]
}

export interface VisitedLocation {
    systemId: string;
    planetId?: string;
    timestamp: number;
    coordinates: Vector2;
    notes?: string;
}

export interface TradeRoute {
    id: string;
    fromSystemId: string;
    toSystemId: string;
    commodity: string;
    profitMargin: number;
    discovered: boolean;
}

export interface ChunkLoadOptions {
    center: Vector2;
    radius: number;
    maxSystems: number;
    includeUnexplored: boolean;
}

export class GalaxyPersistence {
    private platform: Platform;
    private logger: Logger;
    
    // Cached data for performance
    private cachedSaveData: GalaxySaveData | null = null;
    private loadedChunks: Map<string, StarSystemData[]> = new Map();
    private compressionEnabled: boolean;

    constructor() {
        this.platform = PlatformDetector.detect();
        this.logger = new Logger('GalaxyPersistence');
        this.compressionEnabled = true; // Enable compression by default
        
        this.logger.info('💾 Galaxy persistence system initialized', {
            platform: this.platform,
            compressionEnabled: this.compressionEnabled
        });
    }

    /**
     * Save complete galaxy data
     */
    async saveGalaxy(
        generator: GalaxyGenerator,
        playerData: PlayerGalaxyData,
        explorationData: {
            exploredSystems: string[];
            discoveredPlanets: string[];
            visitedLocations: VisitedLocation[];
        }
    ): Promise<void> {
        this.logger.info('💾 Saving galaxy data...');
        
        const startTime = performance.now();
        
        try {
            // Prepare save data
            const saveData: GalaxySaveData = {
                version: '2.0.0',
                timestamp: Date.now(),
                config: generator.getGalaxyConfig(),
                playerData: { ...playerData },
                stars: [],
                systems: [],
                exploredSystems: [...explorationData.exploredSystems],
                discoveredPlanets: [...explorationData.discoveredPlanets],
                visitedLocations: [...explorationData.visitedLocations],
                reputation: new Map(),
                tradeRoutes: []
            };
            
            // Compress galaxy data
            saveData.stars = this.compressStarData(generator.getAllStars());
            saveData.systems = this.compressSystemData(generator.getAllSystems());
            
            // Cache the save data
            this.cachedSaveData = saveData;
            
            // Save to storage based on platform
            await this.saveToStorage(saveData);
            
            const endTime = performance.now();
            this.logger.info(`✅ Galaxy saved successfully in ${(endTime - startTime).toFixed(2)}ms`, {
                stars: saveData.stars.length,
                systems: saveData.systems.length,
                size: this.calculateSaveSize(saveData)
            });
            
        } catch (error) {
            this.logger.error('❌ Failed to save galaxy', error);
            throw error;
        }
    }

    /**
     * Load complete galaxy data
     */
    async loadGalaxy(): Promise<{
        generator: GalaxyGenerator;
        playerData: PlayerGalaxyData;
        explorationData: {
            exploredSystems: string[];
            discoveredPlanets: string[];
            visitedLocations: VisitedLocation[];
        };
    } | null> {
        this.logger.info('📁 Loading galaxy data...');
        
        const startTime = performance.now();
        
        try {
            // Load from storage
            const saveData = await this.loadFromStorage();
            if (!saveData) {
                this.logger.warn('No galaxy save data found');
                return null;
            }
            
            // Validate save data
            this.validateSaveData(saveData);
            
            // Create generator with saved config
            const generator = new GalaxyGenerator(saveData.config);
            
            // Decompress and restore galaxy data
            await this.restoreGalaxyData(generator, saveData);
            
            const endTime = performance.now();
            this.logger.info(`✅ Galaxy loaded successfully in ${(endTime - startTime).toFixed(2)}ms`);
            
            return {
                generator,
                playerData: saveData.playerData,
                explorationData: {
                    exploredSystems: saveData.exploredSystems,
                    discoveredPlanets: saveData.discoveredPlanets,
                    visitedLocations: saveData.visitedLocations
                }
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to load galaxy', error);
            return null;
        }
    }

    /**
     * Load galaxy chunk for specific region
     */
    async loadGalaxyChunk(
        generator: GalaxyGenerator,
        options: ChunkLoadOptions
    ): Promise<StarSystemData[]> {
        const chunkKey = this.getChunkKey(options.center, options.radius);
        
        // Check if chunk is already loaded
        if (this.loadedChunks.has(chunkKey)) {
            return this.loadedChunks.get(chunkKey)!;
        }
        
        this.logger.debug(`Loading galaxy chunk: ${chunkKey}`);
        
        try {
            // Get stars in radius
            const starsInRegion = generator.getStarsInRadius(options.center, options.radius);
            
            // Limit to max systems
            const limitedStars = starsInRegion.slice(0, options.maxSystems);
            
            // Load systems for these stars
            const systems: StarSystemData[] = [];
            for (const star of limitedStars) {
                const system = generator.getStarSystem(star.id);
                if (system) {
                    // Check if should include unexplored systems
                    if (options.includeUnexplored || this.isSystemExplored(system.id)) {
                        systems.push(system);
                    }
                }
            }
            
            // Cache the chunk
            this.loadedChunks.set(chunkKey, systems);
            
            this.logger.debug(`Loaded chunk with ${systems.length} systems`);
            return systems;
            
        } catch (error) {
            this.logger.error(`Failed to load galaxy chunk: ${chunkKey}`, error);
            return [];
        }
    }

    /**
     * Compress star data for storage
     */
    private compressStarData(stars: StarData[]): CompressedStarData[] {
        return stars.map(star => ({
            id: star.id,
            name: star.name,
            pos: [Math.round(star.position.x), Math.round(star.position.y)],
            type: star.type,
            mass: Math.round(star.mass * 100) / 100, // 2 decimal places
            temp: Math.round(star.temperature),
            color: [star.color.r, star.color.g, star.color.b]
        }));
    }

    /**
     * Compress system data for storage
     */
    private compressSystemData(systems: StarSystemData[]): CompressedSystemData[] {
        return systems.map(system => ({
            id: system.id,
            planets: this.compressPlanetData(system.planets),
            explored: this.isSystemExplored(system.id)
        }));
    }

    /**
     * Compress planet data for storage
     */
    private compressPlanetData(planets: PlanetData[]): CompressedPlanetData[] {
        return planets.map(planet => ({
            id: planet.id,
            name: planet.name,
            type: planet.type,
            orbit: Math.round(planet.orbitDistance * 100) / 100,
            radius: Math.round(planet.radius * 100) / 100,
            temp: Math.round(planet.temperature),
            hasAtmo: planet.hasAtmosphere,
            moons: planet.moons.length,
            color: [planet.surfaceColor.r, planet.surfaceColor.g, planet.surfaceColor.b]
        }));
    }

    /**
     * Restore galaxy data from compressed format
     */
    private async restoreGalaxyData(generator: GalaxyGenerator, saveData: GalaxySaveData): Promise<void> {
        // Note: This is a simplified restoration process
        // In a full implementation, we would need to properly reconstruct
        // the galaxy data structures from compressed format
        
        this.logger.debug('Restoring galaxy data from compressed format...');
        
        // For now, regenerate the galaxy with the same seed
        // This ensures consistency while avoiding complex decompression
        await generator.generateGalaxy();
        
        this.logger.debug('Galaxy data restoration completed');
    }

    /**
     * Save to storage based on platform
     */
    private async saveToStorage(saveData: GalaxySaveData): Promise<void> {
        const serialized = JSON.stringify(saveData);
        
        switch (this.platform) {
            case Platform.Desktop:
            case Platform.Web:
            case Platform.Mobile:
                // Use localStorage/IndexedDB
                await this.saveToWebStorage(serialized);
                break;
                
            case Platform.Tauri:
                // Use file system through Tauri API
                await this.saveToFileSystem(serialized);
                break;
                
            case Platform.Cordova:
                // Use Cordova file plugin
                await this.saveToCordovaFile(serialized);
                break;
                
            default:
                throw new Error(`Unsupported platform for saving: ${this.platform}`);
        }
    }

    /**
     * Load from storage based on platform
     */
    private async loadFromStorage(): Promise<GalaxySaveData | null> {
        switch (this.platform) {
            case Platform.Desktop:
            case Platform.Web:
            case Platform.Mobile:
                return await this.loadFromWebStorage();
                
            case Platform.Tauri:
                return await this.loadFromFileSystem();
                
            case Platform.Cordova:
                return await this.loadFromCordovaFile();
                
            default:
                throw new Error(`Unsupported platform for loading: ${this.platform}`);
        }
    }

    /**
     * Save to web storage (localStorage/IndexedDB)
     */
    private async saveToWebStorage(data: string): Promise<void> {
        try {
            // Try IndexedDB first for larger storage capacity
            if ('indexedDB' in window) {
                await this.saveToIndexedDB(data);
            } else {
                // Fallback to localStorage
                localStorage.setItem('spaceExplorer_galaxy', data);
            }
        } catch (error) {
            // If IndexedDB fails, try localStorage
            try {
                localStorage.setItem('spaceExplorer_galaxy', data);
            } catch (localStorageError) {
                throw new Error('Failed to save to both IndexedDB and localStorage');
            }
        }
    }

    /**
     * Load from web storage
     */
    private async loadFromWebStorage(): Promise<GalaxySaveData | null> {
        try {
            // Try IndexedDB first
            if ('indexedDB' in window) {
                const data = await this.loadFromIndexedDB();
                if (data) return data;
            }
            
            // Fallback to localStorage
            const stored = localStorage.getItem('spaceExplorer_galaxy');
            return stored ? JSON.parse(stored) : null;
            
        } catch (error) {
            this.logger.error('Failed to load from web storage', error);
            return null;
        }
    }

    /**
     * Save to IndexedDB for larger storage capacity
     */
    private async saveToIndexedDB(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SpaceExplorerDB', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('galaxy')) {
                    db.createObjectStore('galaxy');
                }
            };
            
            request.onsuccess = () => {
                const db = request.result;
                
                // Check if object store exists before creating transaction
                if (!db.objectStoreNames.contains('galaxy')) {
                    this.logger.warn('Galaxy object store not found, skipping save');
                    resolve();
                    return;
                }
                
                try {
                    const transaction = db.transaction(['galaxy'], 'readwrite');
                    const store = transaction.objectStore('galaxy');
                    
                    const putRequest = store.put(data, 'galaxyData');
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                    
                    transaction.onerror = () => reject(transaction.error);
                } catch (error) {
                    this.logger.error('Transaction failed:', error);
                    reject(error);
                }
            };
        });
    }

    /**
     * Load from IndexedDB
     */
    private async loadFromIndexedDB(): Promise<GalaxySaveData | null> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SpaceExplorerDB', 1);
            
            request.onerror = () => resolve(null);
            
            request.onsuccess = () => {
                const db = request.result;
                
                if (!db.objectStoreNames.contains('galaxy')) {
                    resolve(null);
                    return;
                }
                
                try {
                    const transaction = db.transaction(['galaxy'], 'readonly');
                    const store = transaction.objectStore('galaxy');
                    
                    const getRequest = store.get('galaxyData');
                    getRequest.onsuccess = () => {
                        try {
                            const data = getRequest.result;
                            resolve(data ? JSON.parse(data) : null);
                        } catch (parseError) {
                            this.logger.error('Failed to parse galaxy data:', parseError);
                            resolve(null);
                        }
                    };
                    getRequest.onerror = () => {
                        this.logger.warn('Failed to get galaxy data:', getRequest.error);
                        resolve(null);
                    };
                    
                    transaction.onerror = () => {
                        this.logger.warn('Transaction failed:', transaction.error);
                        resolve(null);
                    };
                } catch (error) {
                    this.logger.error('Transaction creation failed:', error);
                    resolve(null);
                }
            };
        });
    }

    /**
     * Save to file system (Tauri)
     */
    private async saveToFileSystem(data: string): Promise<void> {
        // Placeholder for Tauri file system API
        // This would use the Tauri fs API when available
        this.logger.warn('File system save not implemented yet');
        throw new Error('File system save not implemented');
    }

    /**
     * Load from file system (Tauri)
     */
    private async loadFromFileSystem(): Promise<GalaxySaveData | null> {
        // Placeholder for Tauri file system API
        this.logger.warn('File system load not implemented yet');
        return null;
    }

    /**
     * Save to Cordova file
     */
    private async saveToCordovaFile(data: string): Promise<void> {
        // Placeholder for Cordova file plugin
        this.logger.warn('Cordova file save not implemented yet');
        throw new Error('Cordova file save not implemented');
    }

    /**
     * Load from Cordova file
     */
    private async loadFromCordovaFile(): Promise<GalaxySaveData | null> {
        // Placeholder for Cordova file plugin
        this.logger.warn('Cordova file load not implemented yet');
        return null;
    }

    /**
     * Validate save data integrity
     */
    private validateSaveData(saveData: GalaxySaveData): void {
        if (!saveData.version) {
            throw new Error('Invalid save data: missing version');
        }
        
        if (!saveData.config || !saveData.stars || !saveData.systems) {
            throw new Error('Invalid save data: missing core data');
        }
        
        // Version compatibility check
        const [major] = saveData.version.split('.').map(Number);
        if (major !== 2) {
            throw new Error(`Incompatible save version: ${saveData.version}`);
        }
    }

    /**
     * Calculate save data size
     */
    private calculateSaveSize(saveData: GalaxySaveData): string {
        const serialized = JSON.stringify(saveData);
        const bytes = new Blob([serialized]).size;
        
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * Generate chunk key for caching
     */
    private getChunkKey(center: Vector2, radius: number): string {
        const x = Math.round(center.x / 1000) * 1000;
        const y = Math.round(center.y / 1000) * 1000;
        const r = Math.round(radius / 100) * 100;
        return `chunk_${x}_${y}_${r}`;
    }

    /**
     * Check if system is explored
     */
    private isSystemExplored(systemId: string): boolean {
        if (!this.cachedSaveData) return false;
        return this.cachedSaveData.exploredSystems.includes(systemId);
    }

    /**
     * Clear cached data
     */
    clearCache(): void {
        this.cachedSaveData = null;
        this.loadedChunks.clear();
        this.logger.debug('Galaxy persistence cache cleared');
    }

    /**
     * Get storage statistics
     */
    getStorageStats(): {
        cacheSize: number;
        loadedChunks: number;
        lastSaveTime?: number;
    } {
        return {
            cacheSize: this.cachedSaveData ? 1 : 0,
            loadedChunks: this.loadedChunks.size,
            lastSaveTime: this.cachedSaveData?.timestamp
        };
    }

    /**
     * Export galaxy data for sharing/backup
     */
    async exportGalaxy(): Promise<string> {
        if (!this.cachedSaveData) {
            throw new Error('No galaxy data to export');
        }
        
        return JSON.stringify(this.cachedSaveData, null, 2);
    }

    /**
     * Import galaxy data from backup
     */
    async importGalaxy(data: string): Promise<void> {
        try {
            const saveData: GalaxySaveData = JSON.parse(data);
            this.validateSaveData(saveData);
            
            await this.saveToStorage(saveData);
            this.cachedSaveData = saveData;
            
            this.logger.info('Galaxy data imported successfully');
            
        } catch (error) {
            this.logger.error('Failed to import galaxy data', error);
            throw error;
        }
    }
}