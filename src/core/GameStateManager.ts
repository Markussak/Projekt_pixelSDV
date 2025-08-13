/**
 * Game State Manager
 * Handles different game states and manages transitions with save/load functionality
 */

import { Logger } from '@utils/Logger';
import { Renderer } from '@core/Renderer';
import { PhysicsObject } from '@core/Physics';
import { Vector2 } from '@core/Renderer';

export enum GameState {
    Loading = 'loading',
    Menu = 'menu',
    Playing = 'playing',
    Paused = 'paused',
    Inventory = 'inventory',
    Research = 'research',
    Navigation = 'navigation',
    Diplomacy = 'diplomacy',
    Error = 'error'
}

export interface GameData {
    // Player data
    playerShip: {
        id: string;
        position: Vector2;
        velocity: Vector2;
        health: number;
        fuel: number;
        resources: Map<string, number>;
    };
    
    // Current location
    currentSystem: {
        id: string;
        name: string;
        type: 'star_system' | 'interstellar_space';
    };
    
    // Game progress
    gameTime: number;
    level: number;
    experience: number;
    discoveries: string[];
    technologies: string[];
    
    // Settings
    settings: {
        masterVolume: number;
        musicVolume: number;
        sfxVolume: number;
        difficulty: 'easy' | 'normal' | 'hard';
    };
    
    // Statistics
    stats: {
        timePlayedSeconds: number;
        systemsVisited: number;
        aliensEncountered: number;
        battlesWon: number;
        resourcesCollected: number;
    };
}

export interface StateTransition {
    from: GameState;
    to: GameState;
    condition?: () => boolean;
    action?: () => void;
}

export class GameStateManager {
    private currentState: GameState = GameState.Loading;
    private previousState: GameState = GameState.Loading;
    private gameData: GameData;
    
    // State management
    private stateStack: GameState[] = [];
    private transitions: Map<string, StateTransition> = new Map();
    
    // Demo entities for FÁZE 1
    private demoShip: PhysicsObject | null = null;
    private demoPlanets: PhysicsObject[] = [];
    
    private logger: Logger;
    private isInitialized = false;
    private saveInterval = 30000; // Auto-save every 30 seconds

    constructor() {
        this.logger = new Logger('GameStateManager');
        
        // Initialize default game data
        this.gameData = this.createDefaultGameData();
        
        // Setup state transitions
        this.setupStateTransitions();
        
        this.logger.info('🎯 Game state manager created');
    }

    /**
     * Initialize the game state manager
     */
    async initialize(): Promise<void> {
        this.logger.info('🔧 Initializing game state manager...');
        
        try {
            // Try to load existing save data
            await this.loadGameData();
            
            // Setup demo content for FÁZE 1
            this.setupDemoContent();
            
            this.isInitialized = true;
            this.logger.info('✅ Game state manager initialized');
            
        } catch (error) {
            this.logger.error('❌ Game state manager initialization failed', error);
            throw error;
        }
    }

    /**
     * Create default game data
     */
    private createDefaultGameData(): GameData {
        return {
            playerShip: {
                id: 'player_ship',
                position: { x: 512, y: 384 }, // Center of 1024x768 screen
                velocity: { x: 0, y: 0 },
                health: 100,
                fuel: 1000,
                resources: new Map([
                    ['credits', 1000],
                    ['fuel', 1000],
                    ['metal', 50],
                    ['crystals', 10]
                ])
            },
            currentSystem: {
                id: 'sol_system',
                name: 'Sol System',
                type: 'star_system'
            },
            gameTime: 0,
            level: 1,
            experience: 0,
            discoveries: [],
            technologies: ['basic_engines', 'basic_weapons'],
            settings: {
                masterVolume: 1.0,
                musicVolume: 0.7,
                sfxVolume: 0.8,
                difficulty: 'normal'
            },
            stats: {
                timePlayedSeconds: 0,
                systemsVisited: 1,
                aliensEncountered: 0,
                battlesWon: 0,
                resourcesCollected: 0
            }
        };
    }

    /**
     * Setup state transitions
     */
    private setupStateTransitions(): void {
        // Loading → Menu
        this.addTransition(GameState.Loading, GameState.Menu);
        
        // Menu ↔ Playing
        this.addTransition(GameState.Menu, GameState.Playing);
        this.addTransition(GameState.Playing, GameState.Menu);
        
        // Playing ↔ Paused
        this.addTransition(GameState.Playing, GameState.Paused);
        this.addTransition(GameState.Paused, GameState.Playing);
        
        // Playing → Sub-states
        this.addTransition(GameState.Playing, GameState.Inventory);
        this.addTransition(GameState.Playing, GameState.Research);
        this.addTransition(GameState.Playing, GameState.Navigation);
        this.addTransition(GameState.Playing, GameState.Diplomacy);
        
        // Sub-states → Playing
        this.addTransition(GameState.Inventory, GameState.Playing);
        this.addTransition(GameState.Research, GameState.Playing);
        this.addTransition(GameState.Navigation, GameState.Playing);
        this.addTransition(GameState.Diplomacy, GameState.Playing);
        
        // Error state
        this.addTransition(GameState.Playing, GameState.Error);
        this.addTransition(GameState.Error, GameState.Menu);
        
        this.logger.debug('State transitions configured');
    }

    /**
     * Add a state transition
     */
    private addTransition(from: GameState, to: GameState, condition?: () => boolean, action?: () => void): void {
        const key = `${from}->${to}`;
        this.transitions.set(key, { from, to, condition, action });
    }

    /**
     * Setup demo content for FÁZE 1
     */
    private setupDemoContent(): void {
        // Demo content will be created when needed
        // This is just initialization
        this.logger.debug('Demo content setup prepared');
    }

    /**
     * Set the current game state
     */
    async setState(newState: GameState): Promise<void> {
        const transitionKey = `${this.currentState}->${newState}`;
        const transition = this.transitions.get(transitionKey);
        
        if (!transition) {
            this.logger.warn(`Invalid state transition: ${this.currentState} → ${newState}`);
            return;
        }
        
        // Check transition condition
        if (transition.condition && !transition.condition()) {
            this.logger.debug(`Transition condition not met: ${transitionKey}`);
            return;
        }
        
        this.logger.info(`State transition: ${this.currentState} → ${newState}`);
        
        // Save previous state
        this.previousState = this.currentState;
        
        // Execute transition action
        if (transition.action) {
            transition.action();
        }
        
        // Update state
        this.currentState = newState;
        
        // Handle state-specific initialization
        await this.onStateEnter(newState);
    }

    /**
     * Push state onto stack (for modal states)
     */
    pushState(newState: GameState): void {
        this.stateStack.push(this.currentState);
        this.currentState = newState;
        this.logger.debug(`Pushed state: ${newState} (stack depth: ${this.stateStack.length})`);
    }

    /**
     * Pop state from stack
     */
    popState(): GameState | null {
        if (this.stateStack.length === 0) {
            this.logger.warn('Cannot pop state: stack is empty');
            return null;
        }
        
        const poppedState = this.currentState;
        this.currentState = this.stateStack.pop()!;
        this.logger.debug(`Popped state: ${poppedState} → ${this.currentState}`);
        
        return poppedState;
    }

    /**
     * Handle state enter events
     */
    private async onStateEnter(state: GameState): Promise<void> {
        switch (state) {
            case GameState.Playing:
                // Start game time tracking
                this.startGameTimeTracking();
                break;
                
            case GameState.Paused:
                // Pause game time tracking
                this.pauseGameTimeTracking();
                break;
                
            case GameState.Menu:
                // Auto-save when returning to menu
                await this.save();
                break;
                
            case GameState.Error:
                // Log error state entry
                this.logger.error('Entered error state');
                break;
        }
    }

    /**
     * Update the game state manager
     */
    update(deltaTime: number): void {
        if (!this.isInitialized) return;
        
        // Update game time
        if (this.currentState === GameState.Playing) {
            this.gameData.gameTime += deltaTime;
            this.gameData.stats.timePlayedSeconds += deltaTime;
        }
        
        // State-specific updates
        switch (this.currentState) {
            case GameState.Playing:
                this.updatePlayingState(deltaTime);
                break;
                
            case GameState.Menu:
                this.updateMenuState(deltaTime);
                break;
        }
    }

    /**
     * Update playing state
     */
    private updatePlayingState(deltaTime: number): void {
        // Update player ship position in game data
        if (this.demoShip) {
            this.gameData.playerShip.position = { ...this.demoShip.position };
            this.gameData.playerShip.velocity = { ...this.demoShip.velocity };
            
            // Update ship health if damaged
            if (this.demoShip.health !== undefined) {
                this.gameData.playerShip.health = this.demoShip.health;
            }
        }
    }

    /**
     * Update menu state
     */
    private updateMenuState(deltaTime: number): void {
        // Menu animations or background effects could go here
    }

    /**
     * Render the current game state
     */
    render(renderer: Renderer): void {
        if (!this.isInitialized) {
            this.renderLoadingState(renderer);
            return;
        }
        
        switch (this.currentState) {
            case GameState.Loading:
                this.renderLoadingState(renderer);
                break;
                
            case GameState.Menu:
                this.renderMenuState(renderer);
                break;
                
            case GameState.Playing:
                this.renderPlayingState(renderer);
                break;
                
            case GameState.Paused:
                this.renderPausedState(renderer);
                break;
                
            case GameState.Error:
                this.renderErrorState(renderer);
                break;
                
            default:
                this.renderDefaultState(renderer);
        }
    }

    /**
     * Render loading state
     */
    private renderLoadingState(renderer: Renderer): void {
        const centerX = 512;
        const centerY = 384;
        
        renderer.renderText('INITIALIZING SPACE EXPLORER...', centerX - 150, centerY - 50, 
            { r: 0, g: 255, b: 0 }, 16);
        
        // Animated loading dots
        const dots = '.'.repeat((Math.floor(Date.now() / 500) % 4));
        renderer.renderText(`LOADING${dots}`, centerX - 50, centerY, 
            { r: 0, g: 128, b: 0 }, 14);
    }

    /**
     * Render menu state
     */
    private renderMenuState(renderer: Renderer): void {
        const centerX = 512;
        const centerY = 384;
        
        // Title
        renderer.renderText('SPACE EXPLORER 16-BIT', centerX - 140, centerY - 100, 
            { r: 0, g: 255, b: 0 }, 20);
        
        // Menu options
        const menuItems = [
            'CONTINUE EXPLORATION',
            'NEW EXPEDITION',
            'SETTINGS',
            'EXIT'
        ];
        
        menuItems.forEach((item, index) => {
            const y = centerY - 20 + index * 30;
            const color = index === 0 ? { r: 255, g: 255, b: 0 } : { r: 0, g: 192, b: 0 };
            renderer.renderText(item, centerX - 80, y, color, 14);
        });
        
        // Instructions
        renderer.renderText('USE ARROW KEYS TO NAVIGATE, ENTER TO SELECT', 
            centerX - 180, centerY + 150, { r: 0, g: 128, b: 0 }, 12);
    }

    /**
     * Render playing state
     */
    private renderPlayingState(renderer: Renderer): void {
        // Render space background
        this.renderSpaceBackground(renderer);
        
        // Render demo ship if available
        if (this.demoShip) {
            const shipSprite = renderer.generateShipSprite('player', 32);
            renderer.drawSprite(shipSprite, this.demoShip.position.x - 16, this.demoShip.position.y - 16);
        }
        
        // Render demo planets
        this.demoPlanets.forEach(planet => {
            renderer.drawCircle(planet.position.x, planet.position.y, planet.radius, 
                { r: 64, g: 128, b: 192 }, true);
        });
        
        // Render basic HUD
        this.renderBasicHUD(renderer);
    }

    /**
     * Render paused state
     */
    private renderPausedState(renderer: Renderer): void {
        // Render playing state first
        this.renderPlayingState(renderer);
        
        // Overlay pause menu
        const centerX = 512;
        const centerY = 384;
        
        // Semi-transparent background
        renderer.fillRect(centerX - 100, centerY - 50, 200, 100, { r: 0, g: 0, b: 0, a: 128 });
        
        // Pause text
        renderer.renderText('GAME PAUSED', centerX - 60, centerY - 20, 
            { r: 255, g: 255, b: 0 }, 16);
        
        renderer.renderText('PRESS ESC TO RESUME', centerX - 80, centerY + 10, 
            { r: 0, g: 192, b: 0 }, 12);
    }

    /**
     * Render error state
     */
    private renderErrorState(renderer: Renderer): void {
        const centerX = 512;
        const centerY = 384;
        
        // Error background
        renderer.fillRect(0, 0, 1024, 768, { r: 64, g: 0, b: 0 });
        
        // Error message
        renderer.renderText('SYSTEM ERROR', centerX - 60, centerY - 50, 
            { r: 255, g: 0, b: 0 }, 20);
        
        renderer.renderText('CRITICAL SYSTEM FAILURE DETECTED', centerX - 140, centerY - 10, 
            { r: 255, g: 64, b: 64 }, 14);
        
        renderer.renderText('PRESS ENTER TO RETURN TO MAIN MENU', centerX - 160, centerY + 30, 
            { r: 192, g: 192, b: 192 }, 12);
    }

    /**
     * Render default state
     */
    private renderDefaultState(renderer: Renderer): void {
        const centerX = 512;
        const centerY = 384;
        
        renderer.renderText(`UNKNOWN STATE: ${this.currentState}`, centerX - 100, centerY, 
            { r: 255, g: 0, b: 255 }, 16);
    }

    /**
     * Render space background
     */
    private renderSpaceBackground(renderer: Renderer): void {
        // Simple star field
        for (let i = 0; i < 100; i++) {
            const x = (i * 73) % 1024; // Pseudo-random distribution
            const y = (i * 149) % 768;
            const brightness = (i % 3) + 1;
            const color = { 
                r: brightness * 64, 
                g: brightness * 64, 
                b: brightness * 96 
            };
            
            renderer.setPixel(x, y, color);
        }
    }

    /**
     * Render basic HUD
     */
    private renderBasicHUD(renderer: Renderer): void {
        // Ship status
        const health = this.gameData.playerShip.health;
        const fuel = this.gameData.playerShip.fuel;
        
        renderer.renderText(`HEALTH: ${health.toFixed(0)}%`, 10, 10, 
            health > 50 ? { r: 0, g: 255, b: 0 } : { r: 255, g: 0, b: 0 }, 12);
        
        renderer.renderText(`FUEL: ${fuel.toFixed(0)}`, 10, 30, 
            fuel > 200 ? { r: 0, g: 255, b: 0 } : { r: 255, g: 255, b: 0 }, 12);
        
        // Resources
        renderer.renderText(`CREDITS: ${this.gameData.playerShip.resources.get('credits') || 0}`, 
            10, 50, { r: 255, g: 255, b: 0 }, 12);
        
        // Game time
        const minutes = Math.floor(this.gameData.gameTime / 60);
        const seconds = Math.floor(this.gameData.gameTime % 60);
        renderer.renderText(`TIME: ${minutes}:${seconds.toString().padStart(2, '0')}`, 
            10, 70, { r: 0, g: 192, b: 192 }, 12);
        
        // Galaxy info (if available)
        renderer.renderText(`SYSTEM: ${this.gameData.currentSystem.name}`, 
            10, 90, { r: 0, g: 255, b: 255 }, 12);
        
        // Galaxy exploration progress
        renderer.renderText(`EXPLORATION: ${(this.gameData.stats.systemsVisited || 0)} systems`, 
            10, 110, { r: 192, g: 192, b: 192 }, 12);
    }

    /**
     * Game time tracking
     */
    private gameTimeStarted = false;
    
    private startGameTimeTracking(): void {
        this.gameTimeStarted = true;
        this.logger.debug('Game time tracking started');
    }
    
    private pauseGameTimeTracking(): void {
        this.gameTimeStarted = false;
        this.logger.debug('Game time tracking paused');
    }

    /**
     * Save game data
     */
    async save(): Promise<void> {
        try {
            const saveData = {
                version: '1.0.0',
                timestamp: Date.now(),
                gameData: this.gameData
            };
            
            const serialized = JSON.stringify(saveData);
            localStorage.setItem('spaceExplorer_save', serialized);
            
            this.logger.debug('Game saved successfully');
            
        } catch (error) {
            this.logger.error('Failed to save game', error);
            throw error;
        }
    }

    /**
     * Load game data
     */
    async load(): Promise<void> {
        try {
            await this.loadGameData();
            this.logger.info('Game loaded successfully');
            
        } catch (error) {
            this.logger.warn('Failed to load game, using defaults', error);
            this.gameData = this.createDefaultGameData();
        }
    }

    /**
     * Load game data from storage
     */
    private async loadGameData(): Promise<void> {
        const saved = localStorage.getItem('spaceExplorer_save');
        if (!saved) {
            throw new Error('No save data found');
        }
        
        const saveData = JSON.parse(saved);
        
        // Validate save data
        if (!saveData.gameData) {
            throw new Error('Invalid save data format');
        }
        
        // Restore resources as Map
        if (saveData.gameData.playerShip.resources) {
            const resourcesArray = saveData.gameData.playerShip.resources;
            if (Array.isArray(resourcesArray)) {
                saveData.gameData.playerShip.resources = new Map(resourcesArray);
            } else {
                // Convert object to Map
                saveData.gameData.playerShip.resources = new Map(Object.entries(resourcesArray));
            }
        }
        
        this.gameData = saveData.gameData;
        this.logger.debug('Game data loaded from storage');
    }

    /**
     * Public getters
     */
    getCurrentState(): GameState {
        return this.currentState;
    }

    getPreviousState(): GameState {
        return this.previousState;
    }

    getGameData(): GameData {
        return this.gameData;
    }

    isInState(state: GameState): boolean {
        return this.currentState === state;
    }

    /**
     * Set demo entities for rendering
     */
    setDemoShip(ship: PhysicsObject): void {
        this.demoShip = ship;
    }

    setDemoPlanets(planets: PhysicsObject[]): void {
        this.demoPlanets = [...planets];
    }

    /**
     * Game state checks
     */
    canPause(): boolean {
        return this.currentState === GameState.Playing;
    }

    canResume(): boolean {
        return this.currentState === GameState.Paused;
    }

    isGameActive(): boolean {
        return this.currentState === GameState.Playing;
    }

    isInMenu(): boolean {
        return this.currentState === GameState.Menu;
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        // Save game before cleanup
        this.save().catch(error => {
            this.logger.error('Failed to save during cleanup', error);
        });
        
        this.logger.info('🧹 Game state manager cleanup completed');
    }
}