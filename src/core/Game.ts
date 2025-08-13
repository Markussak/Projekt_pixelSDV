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
    }

    /**
     * Render the current frame
     */
    private render(): void {
        // Clear canvas and setup rendering
        this.renderer.beginFrame();
        
        // Render current game state
        this.stateManager.render(this.renderer);
        
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