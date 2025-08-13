/**
 * Main Game Class - Core Engine Controller
 * Orchestrates all game systems and manages the game lifecycle
 */

import { Renderer } from '@core/Renderer';
import { InputManager } from '@core/InputManager';
import { SpacePhysics } from '@core/Physics';
import { AudioEngine } from '@core/AudioEngine';
import { GameStateManager, GameState } from '@core/GameStateManager';
import { Platform, PlatformDetector } from '@utils/Platform';
import { Logger } from '@utils/Logger';
import { PlayerShip } from '@entities/PlayerShip';
import { GalaxyManager } from '@procedural/GalaxyManager';
import { CockpitStatusBar } from '@ui/CockpitStatusBar';
import { ShipSection, SystemType } from '@entities/ShipSystems';
import { CelestialManager } from '@managers/CelestialManager';
import { SpaceBackground } from '@rendering/SpaceBackground';
import { ItemDatabase } from '@items/ItemSystem';
import { InventoryManager } from '@inventory/InventoryManager';
import { CraftingSystem } from '@crafting/CraftingSystem';

export interface GameConfig {
    targetFPS: number;
    enableDebug: boolean;
    enablePerformanceMonitoring: boolean;
    enableAutoSave: boolean;
    autoSaveInterval: number;
}

export class Game {
    private canvas: HTMLCanvasElement;
    private platform: Platform;
    private config: GameConfig;
    
    // Core systems
    private renderer: Renderer;
    private input: InputManager;
    private physics: SpacePhysics;
    private audio: AudioEngine;
    private stateManager: GameStateManager;
    
    // Game entities
    private playerShip: PlayerShip | null = null;
    
    // Galaxy system
    private galaxyManager: GalaxyManager | null = null;
    
    // UI systems
    private cockpitStatusBar: CockpitStatusBar | null = null;
    
    // Celestial systems
    private celestialManager: CelestialManager | null = null;
    
    // Background rendering
    private spaceBackground: SpaceBackground | null = null;
    
    // Item and inventory systems
    private itemDatabase: ItemDatabase | null = null;
    private inventoryManager: InventoryManager | null = null;
    private craftingSystem: CraftingSystem | null = null;
    
    // Game loop
    private isRunning = false;
    private isPaused = false;
    private lastTime = 0;
    private deltaTime = 0;
    private frameCount = 0;
    private fpsCounter = 0;
    private lastFpsUpdate = 0;
    
    // Performance monitoring
    private performanceStats = {
        averageFPS: 0,
        frameTime: 0,
        renderTime: 0,
        updateTime: 0,
        memoryUsage: 0
    };
    
    private logger: Logger;
    private perfLogger: ReturnType<Logger['createPerformanceLogger']>;

    constructor(canvas: HTMLCanvasElement, platform: Platform) {
        this.canvas = canvas;
        this.platform = platform;
        this.logger = new Logger('Game');
        this.perfLogger = this.logger.createPerformanceLogger();
        
        // Get platform-specific configuration
        const platformConfig = PlatformDetector.getConfig();
        this.config = {
            targetFPS: platformConfig.performance.targetFPS,
            enableDebug: import.meta.env.DEV,
            enablePerformanceMonitoring: import.meta.env.DEV,
            enableAutoSave: platformConfig.storage.enableAutoSave,
            autoSaveInterval: platformConfig.storage.saveInterval
        };

        this.logger.info('🎮 Game instance created', {
            platform: platform,
            canvasSize: `${canvas.width}x${canvas.height}`,
            config: this.config
        });

        // Initialize core systems
        this.initializeSystems();
    }

    /**
     * Initialize all game systems
     */
    private initializeSystems(): void {
        this.logger.info('🔧 Initializing game systems...');
        
        try {
            // Initialize renderer first
            this.renderer = new Renderer(this.canvas, this.platform);
            this.logger.info('✅ Renderer initialized');
            
            // Initialize input system
            this.input = new InputManager(this.canvas, this.platform);
            this.logger.info('✅ Input system initialized');
            
            // Initialize physics engine
            this.physics = new SpacePhysics();
            this.logger.info('✅ Physics engine initialized');
            
            // Initialize audio engine
            this.audio = new AudioEngine(this.platform);
            this.logger.info('✅ Audio engine initialized');
            
            // Initialize game state manager
            this.stateManager = new GameStateManager();
            this.logger.info('✅ Game state manager initialized');
            
            this.logger.info('🎯 All core systems initialized successfully');
            
        } catch (error) {
            this.logger.critical('❌ Failed to initialize core systems', error);
            throw error;
        }
    }

    /**
     * Initialize the game (async setup)
     */
    async initialize(): Promise<void> {
        this.logger.info('🚀 Starting game initialization...');
        
        try {
            // Initialize renderer context and shaders
            await this.perfLogger.measureAsync('renderer-init', async () => {
                await this.renderer.initialize();
            });
            
            // Initialize audio context
            await this.perfLogger.measureAsync('audio-init', async () => {
                await this.audio.initialize();
            });
            
            // Load initial game state
            await this.perfLogger.measureAsync('state-init', async () => {
                await this.stateManager.initialize();
            });
            
            // Setup auto-save if enabled
            if (this.config.enableAutoSave) {
                this.setupAutoSave();
            }
            
            // Initialize galaxy manager
            await this.perfLogger.measureAsync('galaxy-init', async () => {
                this.galaxyManager = new GalaxyManager();
                await this.galaxyManager.initialize();
            });
            
            // Initialize cockpit UI
            this.cockpitStatusBar = new CockpitStatusBar({
                screenWidth: this.canvas.width,
                screenHeight: this.canvas.height
            }, {
                onPowerAllocationChange: (allocation) => {
                    if (this.playerShip) {
                        this.playerShip.setPowerAllocation(allocation);
                        this.logger.debug('Power allocation changed', allocation);
                    }
                },
                onSystemToggle: (system, state) => {
                    if (this.playerShip) {
                        this.playerShip.toggleSystem(system as any, state);
                        this.logger.debug(`System ${system} ${state ? 'enabled' : 'disabled'}`);
                    }
                },
                onInventoryOpen: () => {
                    this.logger.info('📦 Inventory requested');
                    // TODO: Open inventory screen
                },
                onCodexOpen: () => {
                    this.logger.info('📚 Codex requested');
                    // TODO: Open codex screen
                },
                onResearchOpen: () => {
                    this.logger.info('🔬 Research requested');
                    // TODO: Open research screen
                },
                onCrewOpen: () => {
                    this.logger.info('👥 Crew management requested');
                    // TODO: Open crew screen
                },
                onGalaxyMapOpen: () => {
                    this.logger.info('🌌 Galaxy map requested');
                    // TODO: Open galaxy map
                },
                onRadarZoom: (zoomLevel) => {
                    this.logger.debug(`Radar zoom: ${zoomLevel}x`);
                    // TODO: Update radar zoom
                }
            });
            
            // Initialize celestial manager
            this.celestialManager = new CelestialManager({
                renderDistance: 2000,
                interactionDistance: 150,
                showOrbitLines: true,
                enableInteractions: true
            }, {
                onEnterOrbit: (bodyId) => {
                    this.logger.info(`🛰️ Entering orbit around ${bodyId}`);
                    // TODO: Handle orbit mechanics
                },
                onLand: (bodyId) => {
                    this.logger.info(`🚁 Landing on ${bodyId}`);
                    // TODO: Handle landing mechanics
                },
                onContinueFlight: () => {
                    this.logger.info('🚀 Continuing flight');
                },
                onStartMining: (bodyId) => {
                    this.logger.info(`⛏️ Mining on ${bodyId}`);
                    // TODO: Add resources to inventory
                },
                onPerformScan: (bodyId) => {
                    this.logger.info(`🔍 Scanned ${bodyId}`);
                    // TODO: Add scan data to codex
                }
            });
            
            // Initialize space background
            this.spaceBackground = new SpaceBackground({
                starCount: 300,
                starLayers: 5,
                parallaxStrength: 0.3,
                enableDistortion: true,
                galaxyBandIntensity: 0.4,
                nebulaOpacity: 0.2
            });
            
            // Initialize item systems
            this.itemDatabase = new ItemDatabase();
            
            this.inventoryManager = new InventoryManager({
                maxSlots: 50,
                gridWidth: 10,
                gridHeight: 5,
                maxWeight: 1000,
                maxVolume: 500,
                allowStacking: true
            }, {
                onItemAdded: (item, quantity) => {
                    this.logger.info(`📦 Added ${quantity}x ${item.name} to inventory`);
                },
                onItemRemoved: (item, quantity) => {
                    this.logger.info(`📦 Removed ${quantity}x ${item.name} from inventory`);
                },
                onInventoryFull: () => {
                    this.logger.warn('📦 Inventory is full!');
                }
            }, this.itemDatabase);
            
            this.craftingSystem = new CraftingSystem(
                this.itemDatabase,
                this.inventoryManager,
                {
                    onCraftingStarted: (attempt) => {
                        this.logger.info(`🔧 Started crafting: ${attempt.recipeId}`);
                    },
                    onCraftingCompleted: (item, success) => {
                        if (success) {
                            this.logger.info(`✅ Successfully crafted ${item.name}`);
                        } else {
                            this.logger.warn(`❌ Failed to craft ${item.name}`);
                        }
                    }
                }
            );
            
            // Setup demo content
            this.setupDemoContent();
            
            this.logger.info('✅ Game initialization completed successfully');
            
        } catch (error) {
            this.logger.critical('❌ Game initialization failed', error);
            throw error;
        }
    }

    /**
     * Start the game loop
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Game is already running');
            return;
        }
        
        this.logger.info('🎮 Starting game...');
        
        try {
            // Transition to initial game state
            await this.stateManager.setState(GameState.Playing);
            
            // Start the game loop
            this.isRunning = true;
            this.isPaused = false;
            this.lastTime = performance.now();
            
            // Start the main loop
            this.gameLoop();
            
            this.logger.info('✅ Game started successfully');
            
        } catch (error) {
            this.logger.critical('❌ Failed to start game', error);
            this.isRunning = false;
            throw error;
        }
    }

    /**
     * Main game loop
     */
    private gameLoop(): void {
        if (!this.isRunning) {
            return;
        }

        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap delta time to prevent large jumps
        this.deltaTime = Math.min(this.deltaTime, 1/15); // Max 15 FPS minimum

        if (!this.isPaused) {
            try {
                // Update performance stats
                if (this.config.enablePerformanceMonitoring) {
                    this.updatePerformanceStats(currentTime);
                }

                // Update game systems
                this.perfLogger.measure('update', () => {
                    this.update(this.deltaTime);
                });

                // Render frame
                this.perfLogger.measure('render', () => {
                    this.render();
                });

                this.frameCount++;

            } catch (error) {
                this.logger.error('Game loop error', error);
                this.handleError(error);
            }
        }

        // Schedule next frame
        requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Update all game systems
     */
    private update(deltaTime: number): void {
        // Update input state
        this.input.update(deltaTime);
        
        // Update game state
        this.stateManager.update(deltaTime);
        
        // Update physics simulation
        this.physics.update(deltaTime);
        
        // Update audio
        this.audio.update(deltaTime);
        
        // Update game entities
        if (this.playerShip && this.stateManager.isGameActive()) {
            this.playerShip.update(deltaTime);
            
            // Handle weapon firing
            this.playerShip.fireWeapon();
            
            // Demo damage testing (press 'T' to test damage)
            if (this.input.isKeyPressed('KeyT')) {
                this.playerShip.applyDamage(15, Math.random() > 0.5 ? 
                    ShipSection.Engineering : ShipSection.Weapons
                );
                this.logger.info('🧪 Demo damage applied');
            }
            
            // Demo system toggle (press 'Y' to toggle engines)
            if (this.input.isKeyPressed('KeyY')) {
                const currentStatus = this.playerShip.getSystemStatus();
                this.playerShip.toggleSystem(SystemType.Engines, !currentStatus.enginesOnline);
                this.logger.info(`🧪 Engines ${!currentStatus.enginesOnline ? 'enabled' : 'disabled'}`);
            }
            
            // Demo celestial interactions (press 'P' to perform action on nearby body)
            if (this.input.isKeyPressed('KeyP') && this.celestialManager) {
                const nearbyBodies = this.celestialManager.getNearbyBodies();
                if (nearbyBodies.length > 0) {
                    const body = nearbyBodies[0];
                    this.celestialManager.performAction(body.id, 'scan', this.playerShip.getPosition());
                    this.logger.info(`🔍 Demo scan of ${body.name}`);
                }
            }
            
            // Demo warp drive (press 'W' for warp toggle - already handled in PlayerShip)
            // Just log current warp state for debugging
            if (this.input.isKeyPressed('KeyW')) {
                const warpState = this.playerShip.getWarpState();
                this.logger.info(`🌌 Warp state: ${warpState}`);
            }
            
            // Demo inventory system (press 'I' to toggle inventory)
            if (this.input.isKeyPressed('KeyI') && this.inventoryManager) {
                const isVisible = this.inventoryManager.isInventoryVisible();
                this.inventoryManager.setVisible(!isVisible);
                this.logger.info(`📦 Inventory ${!isVisible ? 'opened' : 'closed'}`);
            }
            
            // Demo crafting system (press 'C' to toggle crafting)
            if (this.input.isKeyPressed('KeyC') && this.craftingSystem) {
                const isVisible = this.craftingSystem.isCraftingVisible();
                this.craftingSystem.setVisible(!isVisible);
                if (!isVisible) {
                    this.craftingSystem.selectStation('basic_fabricator');
                }
                this.logger.info(`🔧 Crafting ${!isVisible ? 'opened' : 'closed'}`);
            }
            
            // Demo item generation (press 'R' to add random items)
            if (this.input.isKeyPressed('KeyR') && this.inventoryManager && this.itemDatabase) {
                const randomItem = this.itemDatabase.generateRandomItem();
                if (randomItem) {
                    const quantity = Math.floor(Math.random() * 5) + 1;
                    const added = this.inventoryManager.addItem(randomItem, quantity);
                    if (added) {
                        this.logger.info(`🎲 Added ${quantity}x ${randomItem.name} (${randomItem.rarity})`);
                    }
                }
            }
            
            // Demo auto-crafting (press 'X' to start crafting if possible)
            if (this.input.isKeyPressed('KeyX') && this.craftingSystem) {
                // Try to craft an energy cell (simple recipe)
                const success = this.craftingSystem.startCrafting('craft_energy_cell', 'basic_fabricator');
                if (success) {
                    this.logger.info('🔧 Started crafting Energy Cell');
                } else {
                    this.logger.warn('🔧 Cannot start crafting - check materials');
                }
            }
            
            // Handle pause input
            if (this.input.isPausePressed()) {
                if (this.stateManager.canPause()) {
                    this.stateManager.setState(GameState.Paused);
                } else if (this.stateManager.canResume()) {
                    this.stateManager.setState(GameState.Playing);
                }
            }
        }
        
        // Update cockpit UI
        if (this.cockpitStatusBar) {
            this.cockpitStatusBar.update(deltaTime, this.input);
            
            // Update UI with current ship status
            if (this.playerShip) {
                this.cockpitStatusBar.updateSystemStatus(this.playerShip.getSystemStatus());
                this.cockpitStatusBar.updateDamageReports(this.playerShip.getShipSystems().getDamageReports());
            }
        }
        
        // Update celestial bodies
        if (this.celestialManager && this.playerShip) {
            this.celestialManager.update(deltaTime, this.input, this.playerShip.getPosition());
        }
        
        // Update space background
        if (this.spaceBackground) {
            this.spaceBackground.update(deltaTime);
            
            // Handle warp distortion effects
            if (this.playerShip && this.playerShip.isWarpActive()) {
                const warpDistortion = this.playerShip.getWarpDrive().getSpaceDistortion();
                this.spaceBackground.updateWarpDistortion(warpDistortion);
            } else if (this.playerShip && this.playerShip.getWarpState() === 'deactivating') {
                // Gradually restore background during warp deactivation
                const progress = this.playerShip.getWarpDrive().getWarpProgress();
                this.spaceBackground.gradualRestore(progress);
            }
        }
        
        // Update inventory and crafting systems
        if (this.craftingSystem) {
            this.craftingSystem.update(deltaTime);
        }
    }

    /**
     * Render the current frame
     */
    private render(): void {
        // Clear canvas and setup rendering
        this.renderer.beginFrame();
        
        // Render space background first
        if (this.spaceBackground && this.playerShip && this.stateManager.isGameActive()) {
            this.spaceBackground.render(this.renderer, this.playerShip.getPosition());
        }
        
        // Render current game state
        this.stateManager.render(this.renderer);
        
        // Render game entities
        if (this.playerShip && this.stateManager.isGameActive()) {
            // Render thrust particles
            this.playerShip.renderThrustParticles(this.renderer);
            
            // Render warp effects (on top of ship)
            this.playerShip.renderWarpEffects(this.renderer);
        }
        
        // Render celestial bodies
        if (this.celestialManager && this.playerShip && this.stateManager.isGameActive()) {
            this.celestialManager.render(this.renderer, this.playerShip.getPosition());
        }
        
        // Render cockpit status bar
        if (this.cockpitStatusBar) {
            this.cockpitStatusBar.render(this.renderer);
        }
        
        // Render inventory and crafting UIs
        if (this.inventoryManager && this.inventoryManager.isInventoryVisible()) {
            this.inventoryManager.render(this.renderer);
        }
        
        if (this.craftingSystem && this.craftingSystem.isCraftingVisible()) {
            this.craftingSystem.render(this.renderer);
        }
        
        // Render debug information if enabled
        if (this.config.enableDebug) {
            this.renderDebugInfo();
        }
        
        // Finalize frame
        this.renderer.endFrame();
    }

    /**
     * Render debug information
     */
    private renderDebugInfo(): void {
        const debugInfo = [
            `FPS: ${this.performanceStats.averageFPS.toFixed(1)}`,
            `Frame Time: ${this.performanceStats.frameTime.toFixed(2)}ms`,
            `Render Time: ${this.performanceStats.renderTime.toFixed(2)}ms`,
            `Update Time: ${this.performanceStats.updateTime.toFixed(2)}ms`,
            `Platform: ${this.platform}`,
            `State: ${this.stateManager.getCurrentState()}`,
            `Objects: ${this.physics.getObjectCount()}`
        ];

        this.renderer.renderDebugText(debugInfo, 10, 10);
    }

    /**
     * Update performance statistics
     */
    private updatePerformanceStats(currentTime: number): void {
        // Update FPS counter
        this.fpsCounter++;
        
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.performanceStats.averageFPS = this.fpsCounter;
            this.fpsCounter = 0;
            this.lastFpsUpdate = currentTime;
            
            // Update memory usage if available
            if ((performance as any).memory) {
                this.performanceStats.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
            }
        }
        
        // Update frame timing
        this.performanceStats.frameTime = this.deltaTime * 1000;
        this.performanceStats.renderTime = this.perfLogger.end('render') || 0;
        this.performanceStats.updateTime = this.perfLogger.end('update') || 0;
    }

    /**
     * Pause the game
     */
    pause(): void {
        if (!this.isRunning || this.isPaused) {
            return;
        }
        
        this.isPaused = true;
        this.audio.pauseAll();
        this.logger.info('⏸️ Game paused');
    }

    /**
     * Resume the game
     */
    resume(): void {
        if (!this.isRunning || !this.isPaused) {
            return;
        }
        
        this.isPaused = false;
        this.lastTime = performance.now(); // Reset timing
        this.audio.resumeAll();
        this.logger.info('▶️ Game resumed');
    }

    /**
     * Stop the game
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        this.isPaused = false;
        this.audio.stopAll();
        this.logger.info('⏹️ Game stopped');
    }

    /**
     * Handle window resize
     */
    handleResize(): void {
        this.renderer.handleResize();
        this.logger.debug('📐 Game resized');
    }

    /**
     * Setup demo content for FÁZE 1
     */
    private setupDemoContent(): void {
        this.logger.info('🎮 Setting up demo content...');
        
        try {
            // Create player ship in current system
            let shipPosition = { x: 512, y: 384 }; // Default center
            
            if (this.galaxyManager) {
                const currentSystem = this.galaxyManager.getCurrentSystem();
                if (currentSystem) {
                    // Position ship in the system
                    shipPosition = {
                        x: currentSystem.star.position.x + 100, // Offset from star
                        y: currentSystem.star.position.y + 100
                    };
                }
            }
            
            this.playerShip = new PlayerShip(
                this.physics,
                this.input,
                this.audio,
                shipPosition
            );
            
            // Create planets from current galaxy system
            const demoPlanets: any[] = [];
            
            if (this.galaxyManager) {
                const currentSystem = this.galaxyManager.getCurrentSystem();
                if (currentSystem) {
                    // Add central star
                    const starObj = this.physics.createPlanet(
                        currentSystem.star.id, 
                        { x: 512, y: 384 }, // Center the star on screen
                        currentSystem.star.mass * 1000000, 
                        Math.min(currentSystem.star.radius * 20, 80) // Scale for visibility
                    );
                    this.physics.addObject(starObj);
                    this.physics.addGravityWell(currentSystem.star.id, {
                        position: starObj.position,
                        mass: starObj.mass,
                        radius: 300
                    });
                    demoPlanets.push(starObj);
                    
                    // Add planets
                    currentSystem.planets.forEach((planet, index) => {
                        const angle = (index * Math.PI * 2) / currentSystem.planets.length;
                        const distance = 150 + (planet.orbitDistance * 30); // Scale orbit distance
                        
                        const planetPos = {
                            x: 512 + Math.cos(angle) * distance,
                            y: 384 + Math.sin(angle) * distance
                        };
                        
                        const planetObj = this.physics.createPlanet(
                            planet.id,
                            planetPos,
                            planet.mass * 100000,
                            Math.max(planet.radius * 10, 15) // Scale for visibility
                        );
                        
                        this.physics.addObject(planetObj);
                        demoPlanets.push(planetObj);
                    });
                    
                    this.logger.info(`✅ Generated system: ${currentSystem.name} with ${currentSystem.planets.length} planets`);
                }
            }
            
                        // Load celestial system
            if (this.galaxyManager && this.celestialManager) {
                const currentSystem = this.galaxyManager.getCurrentSystem();
                if (currentSystem) {
                    this.celestialManager.loadSystem({
                        systemData: currentSystem,
                        cameraPosition: { x: 512, y: 384 }
                    });
                    
                    // Discover all bodies for demo
                    this.celestialManager.discoverAllBodies();
                    
                    this.logger.info(`🌌 Loaded celestial system: ${currentSystem.name}`);
                }
            }

            // Fallback demo planets if no galaxy system
            if (demoPlanets.length === 0) {
                const planet1 = this.physics.createPlanet('demo_planet_1', { x: 300, y: 200 }, 1000000, 50);
                const planet2 = this.physics.createPlanet('demo_planet_2', { x: 700, y: 500 }, 800000, 40);

                this.physics.addObject(planet1);
                this.physics.addObject(planet2);

                this.physics.addGravityWell('demo_planet_1', {
                    position: planet1.position,
                    mass: planet1.mass,
                    radius: 200
                });

                this.physics.addGravityWell('demo_planet_2', {
                    position: planet2.position,
                    mass: planet2.mass,
                    radius: 180
                });

                demoPlanets.push(planet1, planet2);
            }

            // Pass demo entities to state manager for rendering
            this.stateManager.setDemoShip(this.playerShip.getPhysicsObject());
            this.stateManager.setDemoPlanets(demoPlanets);
            
            this.logger.info('✅ Demo content setup completed');
            
        } catch (error) {
            this.logger.error('❌ Failed to setup demo content', error);
        }
    }

    /**
     * Handle errors
     */
    handleError(error: any): void {
        this.logger.error('Game error handled', error);
        
        // Try to recover gracefully
        try {
            // Pause the game
            this.pause();
            
            // Show error state
            this.stateManager.setState(GameState.Error);
            
        } catch (recoveryError) {
            this.logger.critical('Failed to recover from error', recoveryError);
            // Full stop if recovery fails
            this.stop();
        }
    }

    /**
     * Setup auto-save functionality
     */
    private setupAutoSave(): void {
        setInterval(() => {
            if (this.isRunning && !this.isPaused) {
                this.saveGame();
            }
        }, this.config.autoSaveInterval);
    }

    /**
     * Save game state
     */
    async saveGame(): Promise<void> {
        try {
            await this.stateManager.save();
            this.logger.debug('💾 Game saved');
        } catch (error) {
            this.logger.error('Failed to save game', error);
        }
    }

    /**
     * Load game state
     */
    async loadGame(): Promise<void> {
        try {
            await this.stateManager.load();
            this.logger.info('📁 Game loaded');
        } catch (error) {
            this.logger.error('Failed to load game', error);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.logger.info('🧹 Cleaning up game resources...');
        
        this.stop();
        
        if (this.renderer) {
            this.renderer.cleanup();
        }
        
        if (this.audio) {
            this.audio.cleanup();
        }
        
        if (this.input) {
            this.input.cleanup();
        }
        
        if (this.playerShip) {
            this.playerShip.cleanup();
        }
        
        if (this.galaxyManager) {
            await this.galaxyManager.cleanup();
        }
        
        if (this.celestialManager) {
            this.celestialManager.cleanup();
        }
        
        // Cleanup inventory and crafting systems (save state if needed)
        if (this.inventoryManager) {
            this.inventoryManager.clearInventory();
        }
        
        this.logger.info('✅ Game cleanup completed');
    }

    // Getters for external access
    isPaused(): boolean {
        return this.isPaused;
    }

    isGameRunning(): boolean {
        return this.isRunning;
    }

    getPerformanceStats() {
        return { ...this.performanceStats };
    }

    getRenderer(): Renderer {
        return this.renderer;
    }

    getInput(): InputManager {
        return this.input;
    }

    getPhysics(): SpacePhysics {
        return this.physics;
    }

    getAudio(): AudioEngine {
        return this.audio;
    }

    getStateManager(): GameStateManager {
        return this.stateManager;
    }
}