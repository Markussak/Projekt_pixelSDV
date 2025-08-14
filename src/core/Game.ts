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
import { CombatManager } from '@combat/CombatManager';
import { PlayerProgression } from '@rpg/PlayerProgression';
import { ResearchSystem } from '@rpg/ResearchSystem';
import { CrewManagement } from '@rpg/CrewManagement';
import { DiplomacySystem } from '@diplomacy/DiplomacySystem';
import { AlienAI, AlienSpecies } from '@ai/AlienAI';
import { ProceduralAudio, SoundType } from '@audio/ProceduralAudio';
import { PerformanceMonitor } from '@optimization/PerformanceMonitor';
import { ParticleSystem } from '@effects/ParticleSystem';

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
    private renderer!: Renderer;
    private input!: InputManager;
    private physics!: SpacePhysics;
    private audio!: AudioEngine;
    private stateManager!: GameStateManager;
    
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
    
    // Combat system
    private combatManager: CombatManager | null = null;
    
    // RPG systems
    private playerProgression: PlayerProgression | null = null;
    private researchSystem: ResearchSystem | null = null;
    private crewManagement: CrewManagement | null = null;
    
    // AI & Diplomacy systems
    private diplomacySystem: DiplomacySystem | null = null;
    private alienAI: AlienAI | null = null;
    
    // Polish systems
    private proceduralAudio: ProceduralAudio | null = null;
    private performanceMonitor: PerformanceMonitor | null = null;
    private particleSystem: ParticleSystem | null = null;
    
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
            
            // Initialize game state manager with audio and particles
            this.stateManager = new GameStateManager(this.proceduralAudio || undefined, this.particleSystem || undefined);
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
            
            // Initialize combat system (will be initialized after RPG systems)
            this.combatManager = null;
            
            // Initialize RPG systems
            this.playerProgression = new PlayerProgression({
                onLevelUp: (level, rewards) => {
                    this.logger.info(`🎉 Level up! Level ${level}`, rewards);
                },
                onSkillLevelUp: (skill, level) => {
                    this.logger.info(`📈 Skill up: ${skill.name} → ${level}`);
                },
                onAchievementUnlocked: (achievement) => {
                    this.logger.info(`🏆 Achievement: ${achievement.name}`);
                }
            });
            
            this.researchSystem = new ResearchSystem({
                onTechnologyUnlocked: (tech) => {
                    this.logger.info(`🔬 Technology unlocked: ${tech.name}`);
                },
                onDiscoveryMade: (discovery) => {
                    this.logger.info(`🔍 Discovery: ${discovery.name}`);
                }
            });
            
            this.crewManagement = new CrewManagement({
                onCrewJoined: (crew) => {
                    this.logger.info(`👤 Crew joined: ${crew.name} (${crew.role})`);
                },
                onCrewEvent: (event) => {
                    this.logger.info(`📰 Crew event: ${event.description}`);
                },
                onMoraleAlert: (morale) => {
                    this.logger.warn(`😟 Low crew morale: ${morale.toFixed(0)}%`);
                }
            });
            
            // Initialize diplomacy and alien AI systems
            this.diplomacySystem = new DiplomacySystem({
                onFirstContact: (faction) => {
                    this.logger.info(`🤝 First contact with: ${faction.name}`);
                },
                onReputationChanged: (factionId, oldRep, newRep) => {
                    const change = newRep - oldRep;
                    this.logger.info(`🤝 Reputation ${change > 0 ? '+' : ''}${change}: ${factionId}`);
                },
                onNegotiationStarted: (session) => {
                    this.logger.info(`💬 Negotiation started with faction`);
                },
                onEncounterGenerated: (encounter) => {
                    this.logger.info(`🎭 Diplomatic encounter: ${encounter.type}`);
                }
            });
            
            this.alienAI = new AlienAI({
                onFirstContact: (species, encounter) => {
                    this.logger.info(`👽 First contact with: ${species}`);
                },
                onCommunicationBreakthrough: (species, method) => {
                    this.logger.info(`📡 Communication breakthrough: ${species} via ${method}`);
                },
                onTechnologyDiscovered: (species, technology) => {
                    this.logger.info(`🔬 Technology discovered from ${species}: ${technology}`);
                },
                onCulturalInsight: (species, insight) => {
                    this.logger.info(`🎭 Cultural insight about ${species}: ${insight}`);
                }
            });
            
            // Initialize polish systems
            this.proceduralAudio = new ProceduralAudio({
                onSoundPlayed: (type, config) => {
                    this.logger.debug(`🔊 Sound played: ${type}`);
                },
                onTrackChanged: (trackName) => {
                    this.logger.info(`🎵 Music track changed: ${trackName}`);
                },
                onAudioError: (error) => {
                    this.logger.error('🔊 Audio error', error);
                }
            });
            
            this.performanceMonitor = new PerformanceMonitor({
                onPerformanceUpdate: (metrics) => {
                    // Update game metrics for audio system
                    // TODO: Add setGameMetrics method to ProceduralAudio if needed
                    // this.proceduralAudio?.setGameMetrics?.({
                    //     activeSounds: metrics.activeSounds
                    // });
                },
                onThresholdExceeded: (metric, value, threshold) => {
                    this.logger.warn(`⚠️ Performance threshold exceeded: ${metric} = ${value} (threshold: ${threshold})`);
                },
                onOptimizationRecommended: (recommendations) => {
                    this.logger.info(`🔧 Performance recommendations: ${recommendations.length} suggestions`);
                },
                onSettingsChanged: (settings) => {
                    this.logger.info('⚙️ Performance settings updated');
                }
            });
            
            // Initialize audio system
            await this.proceduralAudio.initialize();
            
            // Initialize particle system
            this.particleSystem = new ParticleSystem({
                maxParticles: 1000,
                qualityScale: 1.0,
                enableTrails: true,
                pixelPerfect: true
            });
            
            // Initialize performance monitoring
            this.performanceMonitor.initialize();
            
            // Start ambient space music
            this.proceduralAudio.startAmbientTrack('deep_space');
            
            // Initialize combat system with RPG integration
            this.combatManager = new CombatManager(
                this.itemDatabase,
                this.inventoryManager,
                {
                    onEncounterStarted: (encounter) => {
                        this.logger.info(`🚨 Combat encounter: ${encounter.name}`);
                    },
                    onEncounterCompleted: (encounter, success) => {
                        this.logger.info(`${success ? '✅' : '❌'} Encounter ${encounter.name} ${success ? 'completed' : 'failed'}`);
                        // Award experience for completed encounters
                        if (success && this.playerProgression) {
                            this.playerProgression.addExperience(encounter.rewards.experience);
                            this.playerProgression.updateStatistics({ enemiesDefeated: 1 });
                        }
                    },
                    onEnemyDestroyed: (enemyId, rewards) => {
                        this.logger.info(`💰 Enemy destroyed: +${rewards.experience} XP, ${rewards.items.length} items`);
                        // Award experience and update stats
                        if (this.playerProgression) {
                            this.playerProgression.addExperience(rewards.experience);
                            this.playerProgression.updateStatistics({ enemiesDefeated: 1 });
                            // Award skill experience based on combat
                            this.playerProgression.addSkillExperience('weapon_proficiency', 10);
                            this.playerProgression.addSkillExperience('tactical_combat', 5);
                        }
                    },
                    onPlayerDamaged: (damage, damageType) => {
                        this.logger.warn(`💥 Player hit: ${damage} ${damageType} damage`);
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
            // Transition to main menu state instead of playing directly
            await this.stateManager.setState(GameState.MainMenu);
            
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
        this.stateManager.update(deltaTime, this.input);
        
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
            
            // Demo combat controls
            if (this.combatManager) {
                // Fire primary weapon (left mouse or space)
                if (this.input.isKeyPressed('Space')) {
                    const fired = this.combatManager.firePlayerWeapon('player_laser_1');
                    if (fired) {
                        this.logger.debug('🔫 Fired laser cannon');
                    }
                }
                
                // Fire secondary weapon (right mouse or shift)
                if (this.input.isKeyPressed('ShiftLeft')) {
                    const fired = this.combatManager.firePlayerWeapon('player_cannon_1');
                    if (fired) {
                        this.logger.debug('🔫 Fired mass driver');
                    }
                }
                
                // Spawn random enemy (press 'E' for demo)
                if (this.input.isKeyPressed('KeyE')) {
                    this.combatManager.startRandomEncounter();
                    this.logger.info('🛸 Spawned random encounter');
                }
                
                // Clear all enemies (press 'Q' for demo)
                if (this.input.isKeyPressed('KeyQ')) {
                    this.combatManager.clearCombat();
                    this.logger.info('🧹 Cleared all combat');
                }
            }
            
            // Demo AI & Diplomacy controls
            if (this.diplomacySystem) {
                // Generate random diplomatic encounter (press 'K' for demo)
                if (this.input.isKeyPressed('KeyK')) {
                    const playerPos = this.playerShip?.getPosition() || { x: 0, y: 0 };
                    const encounter = this.diplomacySystem.generateRandomEncounter(playerPos);
                    if (encounter) {
                        this.logger.info(`🎭 Generated diplomatic encounter with ${encounter.factionId}`);
                    }
                }
                
                // Modify faction reputation (press 'L' for demo)
                if (this.input.isKeyPressed('KeyL')) {
                    const factions = this.diplomacySystem.getAllFactions();
                    if (factions.length > 0) {
                        const randomFaction = factions[Math.floor(Math.random() * factions.length)];
                        const change = Math.floor(Math.random() * 21) - 10; // -10 to +10
                        this.diplomacySystem.modifyReputation(randomFaction.id, change, 'Random diplomatic action');
                    }
                }
            }
            
            if (this.alienAI) {
                // Generate alien encounter (press 'M' for demo)
                if (this.input.isKeyPressed('KeyM')) {
                    const playerPos = this.playerShip?.getPosition() || { x: 0, y: 0 };
                    const species = Object.values(AlienSpecies)[Math.floor(Math.random() * Object.values(AlienSpecies).length)];
                    const encounter = this.alienAI.generateEncounter(species, playerPos, 'routine');
                    this.logger.info(`👽 Generated alien encounter: ${species}`);
                }
                
                // Simulate alien communication (press 'N' for demo)
                if (this.input.isKeyPressed('KeyN')) {
                    const encounters = this.alienAI.getActiveEncounters();
                    if (encounters.length > 0) {
                        const encounter = encounters[0];
                        const response = this.alienAI.processPlayerAction(
                            encounter.id,
                            'communicate',
                            50,
                            'peaceful_greeting'
                        );
                        this.logger.info(`📡 Alien response: ${response.type} - ${response.description}`);
                    }
                }
            }
            
            // Demo Audio & Polish controls
            if (this.proceduralAudio) {
                // Play laser sound (press 'O' for demo)
                if (this.input.isKeyPressed('KeyO')) {
                    this.proceduralAudio.playRetroSound(SoundType.Laser, 1.0);
                }
                
                // Play explosion sound (press 'P' for demo)
                if (this.input.isKeyPressed('KeyP')) {
                    this.proceduralAudio.playRetroSound(SoundType.Explosion, 1.0);
                }
                
                // Cycle ambient tracks (press 'U' for demo)
                if (this.input.isKeyPressed('KeyU')) {
                    const tracks = ['deep_space', 'nebula_drift', 'void_silence'];
                    const currentTrack = this.proceduralAudio.getAudioStats().currentTrack;
                    const currentIndex = tracks.indexOf(currentTrack || 'deep_space');
                    const nextTrack = tracks[(currentIndex + 1) % tracks.length];
                    this.proceduralAudio.startAmbientTrack(nextTrack);
                }
            }
            
            if (this.performanceMonitor) {
                // Toggle auto-optimization (press 'Y' for demo)
                if (this.input.isKeyPressed('KeyY')) {
                    const settings = this.performanceMonitor.getSettings();
                    this.performanceMonitor.updateSettings({
                        autoOptimize: !settings.autoOptimize
                    });
                    this.logger.info(`🔧 Auto-optimization: ${!settings.autoOptimize ? 'ON' : 'OFF'}`);
                }
                
                // Get performance summary (press 'T' for demo)
                if (this.input.isKeyPressed('KeyT')) {
                    const summary = this.performanceMonitor.getPerformanceSummary();
                    this.logger.info(`📊 Performance: ${summary.performanceGrade} (${Math.round(summary.averageFPS)} FPS, ${Math.round(summary.averageMemoryUsage)}% memory)`);
                }
            }
            
            // Demo RPG system controls
            if (this.playerProgression) {
                // Add experience (press 'F' for demo)
                if (this.input.isKeyPressed('KeyF')) {
                    this.playerProgression.addExperience(100);
                    this.logger.info('📈 Added 100 XP');
                }
                
                // Add skill experience (press 'G' for demo)
                if (this.input.isKeyPressed('KeyG')) {
                    this.playerProgression.addSkillExperience('weapon_proficiency', 25);
                    this.logger.info('🔧 Added weapon proficiency XP');
                }
            }
            
            if (this.researchSystem) {
                // Start basic research (press 'H' for demo)
                if (this.input.isKeyPressed('KeyH')) {
                    const started = this.researchSystem.startResearch('basic_sensors', 'basic_lab', ['dr_smith']);
                    if (started) {
                        this.logger.info('🔬 Started basic sensors research');
                    } else {
                        this.logger.warn('🔬 Cannot start research');
                    }
                }
            }
            
            if (this.crewManagement) {
                // Auto-assign crew (press 'J' for demo)
                if (this.input.isKeyPressed('KeyJ')) {
                    const crew = this.crewManagement.getAllCrew();
                    if (crew.length > 0) {
                        const randomCrew = crew[Math.floor(Math.random() * crew.length)];
                        const stations = this.crewManagement.getAllStations();
                        const availableStation = stations.find(s => s.assignedCrew.length < s.maxCrew);
                        
                        if (availableStation) {
                            const assigned = this.crewManagement.assignCrewToStation(randomCrew.id, availableStation.stationId);
                            if (assigned) {
                                this.logger.info(`👥 Assigned ${randomCrew.name} to ${availableStation.stationId}`);
                            }
                        }
                    }
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
        
        // Update combat system
        if (this.combatManager && this.playerShip) {
            const shipSystems = this.playerShip.getSystemStatus();
            this.combatManager.updatePlayer(
                this.playerShip.getPosition(),
                this.playerShip.getVelocity(),
                20, // Player ship size
                shipSystems.hull,
                100 // Max hull
            );
            this.combatManager.update(deltaTime);
        }
        
        // Update RPG systems
        if (this.researchSystem) {
            this.researchSystem.update(deltaTime);
        }
        
        if (this.crewManagement) {
            this.crewManagement.update(deltaTime);
        }
        
        // Update polish systems
        this.performanceMonitor?.update(deltaTime);
        this.particleSystem?.update(deltaTime);
        
        // Update performance metrics for monitoring
        if (this.performanceMonitor) {
            const audioStats = this.proceduralAudio?.getAudioStats();
            this.performanceMonitor.setGameMetrics({
                activeEntities: (this.celestialManager?.getActiveBodies()?.length || 0) + 1, // +1 for player
                activeSounds: audioStats?.activeSounds || 0,
                drawCalls: 1, // Simplified for now
                triangles: 100, // Simplified for now
                textureMemory: 10 // Simplified for now
            });
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
        
        // Render combat effects
        if (this.combatManager) {
            this.combatManager.render(this.renderer);
        }
        
        // Render debug information if enabled
        if (this.config.enableDebug) {
            this.renderDebugInfo();
        }
        
        // Render particles on top of everything
        if (this.particleSystem) {
            this.particleSystem.render(this.renderer);
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
     * Check if game is paused
     */
    getPaused(): boolean {
        return this.isPaused;
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
                        { x: 720, y: 450 }, // Center the star on screen
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
                            x: 720 + Math.cos(angle) * distance,
                            y: 450 + Math.sin(angle) * distance
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
                        cameraPosition: { x: 720, y: 450 }
                    });
                    
                    // Discover all bodies for demo
                    this.celestialManager.discoverAllBodies();
                    
                    this.logger.info(`🌌 Loaded celestial system: ${currentSystem.name}`);
                }
            }

            // Fallback demo planets if no galaxy system
            if (demoPlanets.length === 0) {
                const planet1 = this.physics.createPlanet('demo_planet_1', { x: 420, y: 300 }, 1000000, 50);
                const planet2 = this.physics.createPlanet('demo_planet_2', { x: 1020, y: 600 }, 800000, 40);

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
    async cleanup(): Promise<void> {
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
    getIsPaused(): boolean {
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