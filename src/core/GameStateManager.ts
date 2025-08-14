/**
 * Game State Manager
 * Handles different game states and manages transitions with save/load functionality
 */

import { Logger } from '@utils/Logger';
import { Renderer } from '@core/Renderer';
import { PhysicsObject } from '@core/Physics';
import { Vector2 } from '@core/Renderer';
import { MainMenu, MenuEvents, NewGameSettings, GameSettings } from '@ui/MainMenu';
import { InputManager } from '@core/InputManager';
import { ProceduralAudio } from '@audio/ProceduralAudio';
import { ParticleSystem } from '@effects/ParticleSystem';

export enum GameState {
    MainMenu = 'main_menu',
    Loading = 'loading',
    Playing = 'playing',
    Paused = 'paused',
    Inventory = 'inventory',
    Research = 'research',
    Navigation = 'navigation',
    Diplomacy = 'diplomacy',
    Settings = 'settings',
    Credits = 'credits',
    NewGame = 'new_game',
    LoadGame = 'load_game',
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
    private currentState: GameState = GameState.MainMenu;
    private previousState: GameState = GameState.MainMenu;
    private gameData: GameData;
    
    // State management
    private stateStack: GameState[] = [];
    private transitions: Map<string, StateTransition> = new Map();
    private stateStartTime: number = Date.now();
    
    // Menu system
    private mainMenu: MainMenu | null = null;
    
    // Demo entities for FÁZE 1
    private demoShip: PhysicsObject | null = null;
    private demoPlanets: PhysicsObject[] = [];
    
    private logger: Logger;
    private isInitialized = false;
    private saveInterval = 30000; // Auto-save every 30 seconds

    constructor(audio?: ProceduralAudio, particles?: ParticleSystem) {
        this.logger = new Logger('GameStateManager');
        
        // Initialize default game data
        this.gameData = this.createDefaultGameData();
        
        // Initialize menu system
        this.initializeMenuSystem(audio, particles);
        
        // Setup state transitions
        this.setupStateTransitions();
        
        this.logger.info('🎯 Game state manager created');
    }

    /**
     * Initialize menu system
     */
    private initializeMenuSystem(audio?: ProceduralAudio, particles?: ParticleSystem): void {
        const menuEvents: MenuEvents = {
            onNewGame: async (settings: NewGameSettings) => {
                await this.handleNewGame(settings);
            },
            onLoadGame: async (saveSlot: number) => {
                await this.handleLoadGame(saveSlot);
            },
            onSettings: (settings: GameSettings) => {
                this.handleSettingsChange(settings);
            },
            onExit: () => {
                this.handleExit();
            },
            onGameStart: async () => {
                await this.setState(GameState.Playing);
            }
        };
        
        this.mainMenu = new MainMenu(menuEvents, audio, particles);
        this.logger.info('🎮 Menu system initialized');
    }

    /**
     * Initialize the game state manager
     */
    async initialize(): Promise<void> {
        this.logger.info('🔧 Initializing game state manager...');
        
        try {
            // Try to load existing save data, fallback to defaults if none exists
            try {
                await this.loadGameData();
                this.logger.info('Existing save data loaded');
            } catch (error) {
                this.logger.info('No existing save data found, creating new game data');
                this.gameData = this.createDefaultGameData();
            }
            
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
                position: { x: 720, y: 450 }, // Center of 1440x900 screen
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
        // Loading → MainMenu
        this.addTransition(GameState.Loading, GameState.MainMenu);
        
        // MainMenu self-transition (for menu refresh/reset)
        this.addTransition(GameState.MainMenu, GameState.MainMenu);
        
        // MainMenu ↔ Playing
        this.addTransition(GameState.MainMenu, GameState.Playing);
        this.addTransition(GameState.Playing, GameState.MainMenu);
        
        // MainMenu → Settings/Credits/NewGame/LoadGame
        this.addTransition(GameState.MainMenu, GameState.Settings);
        this.addTransition(GameState.MainMenu, GameState.Credits);
        this.addTransition(GameState.MainMenu, GameState.NewGame);
        this.addTransition(GameState.MainMenu, GameState.LoadGame);
        
        // Settings/Credits/NewGame/LoadGame → MainMenu
        this.addTransition(GameState.Settings, GameState.MainMenu);
        this.addTransition(GameState.Credits, GameState.MainMenu);
        this.addTransition(GameState.NewGame, GameState.MainMenu);
        this.addTransition(GameState.LoadGame, GameState.MainMenu);
        
        // Playing ↔ Paused
        this.addTransition(GameState.Playing, GameState.Paused);
        this.addTransition(GameState.Paused, GameState.Playing);
        
        // Playing → Sub-states
        this.addTransition(GameState.Playing, GameState.Inventory);
        this.addTransition(GameState.Playing, GameState.Research);
        this.addTransition(GameState.Playing, GameState.Navigation);
        this.addTransition(GameState.Playing, GameState.Diplomacy);
        this.addTransition(GameState.Playing, GameState.Settings);
        
        // Sub-states → Playing
        this.addTransition(GameState.Inventory, GameState.Playing);
        this.addTransition(GameState.Research, GameState.Playing);
        this.addTransition(GameState.Navigation, GameState.Playing);
        this.addTransition(GameState.Diplomacy, GameState.Playing);
        
        // Error state - can be reached from ANY state
        Object.values(GameState).forEach(state => {
            if (state !== GameState.Error) {
                this.addTransition(state, GameState.Error);
            }
        });
        
        // Error state can go to MainMenu
        this.addTransition(GameState.Error, GameState.MainMenu);
        
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
        // Handle same-state transition gracefully
        if (this.currentState === newState) {
            this.logger.debug(`Refreshing current state: ${newState}`);
            if (newState !== GameState.Error) { // Don't refresh error state
                await this.onStateEnter(newState);
            }
            return;
        }
        
        // Allow error state from any state (emergency transition)
        if (newState === GameState.Error) {
            this.logger.warn(`Emergency transition to error state from: ${this.currentState}`);
            this.previousState = this.currentState;
            this.currentState = newState;
            await this.onStateEnter(newState);
            return;
        }
        
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
            try {
                transition.action();
            } catch (error) {
                this.logger.error('Error executing transition action', error);
                // Continue with state change despite action error
            }
        }
        
        // Update state
        this.currentState = newState;
        
        // Handle state-specific initialization
        try {
            await this.onStateEnter(newState);
        } catch (error) {
            this.logger.error('Error entering new state', error);
            // Don't go to error state if we're already handling an error
            if (newState !== GameState.Error) {
                await this.setState(GameState.Error);
            }
        }
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
                
            case GameState.MainMenu:
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
    update(deltaTime: number, input?: InputManager): void {
        if (!this.isInitialized) return;
        
        // Update game time
        if (this.currentState === GameState.Playing) {
            this.gameData.gameTime += deltaTime;
            this.gameData.stats.timePlayedSeconds += deltaTime;
        }
        
        // State-specific updates
        switch (this.currentState) {
            case GameState.MainMenu:
            case GameState.NewGame:
            case GameState.LoadGame:
            case GameState.Settings:
            case GameState.Credits:
                if (this.mainMenu && input) {
                    this.mainMenu.update(deltaTime, input);
                }
                break;
                
            case GameState.Playing:
                this.updatePlayingState(deltaTime);
                break;
                
            case GameState.Loading:
                this.updateLoadingState(deltaTime);
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
     * Update loading state
     */
    private updateLoadingState(deltaTime: number): void {
        // Simulate loading time
        const loadingTime = Date.now() - this.stateStartTime;
        
        if (loadingTime > 2000) { // 2 seconds loading time
            this.setState(GameState.Playing).catch(error => {
                this.logger.error('Failed to transition to playing state', error);
            });
        }
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
            case GameState.MainMenu:
            case GameState.NewGame:
            case GameState.LoadGame:
            case GameState.Settings:
            case GameState.Credits:
                if (this.mainMenu) {
                    this.mainMenu.render(renderer);
                }
                break;
                
            case GameState.Loading:
                this.renderLoadingState(renderer);
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
        const centerX = 720;
        const centerY = 450;
        
        renderer.renderText('INITIALIZING SPACE EXPLORER...', centerX - 150, centerY - 50, 
            { r: 192, g: 192, b: 192 }, 16);
        
        // Animated loading dots
        const dots = '.'.repeat((Math.floor(Date.now() / 500) % 4));
        renderer.renderText(`LOADING${dots}`, centerX - 50, centerY, 
            { r: 128, g: 128, b: 128 }, 14);
    }

    /**
     * Render menu state
     */
    private renderMenuState(renderer: Renderer): void {
        const centerX = 720;
        const centerY = 450;
        
        // Render background image (Image 3)
        this.renderMenuBackground(renderer);
        
        // Title
        renderer.renderText('SPACE EXPLORER 16-BIT', centerX - 140, centerY - 100, 
            { r: 255, g: 255, b: 255 }, 20);
        
        // Menu options
        const menuItems = [
            'CONTINUE EXPLORATION',
            'NEW EXPEDITION',
            'SETTINGS',
            'EXIT'
        ];
        
        menuItems.forEach((item, index) => {
            const y = centerY - 20 + index * 30;
            const color = index === 0 ? { r: 255, g: 255, b: 255 } : { r: 192, g: 192, b: 192 };
            renderer.renderText(item, centerX - 80, y, color, 14);
        });
        
        // Instructions
        renderer.renderText('USE ARROW KEYS TO NAVIGATE, ENTER TO SELECT', 
            centerX - 180, centerY + 150, { r: 128, g: 128, b: 128 }, 12);
    }

    /**
     * Render playing state
     */
    private renderPlayingState(renderer: Renderer): void {
        // Render enhanced space background
        this.renderEnhancedSpaceBackground(renderer);
        
        // Render demo planets with detailed 16-bit textures
        this.demoPlanets.forEach((planet, index) => {
            const planetColors = [
                { r: 205, g: 85, b: 45 }, // Mars-like (rusty red)
                { r: 45, g: 120, b: 200 }, // Earth-like (ocean blue)
                { r: 180, g: 160, b: 85 }, // Desert planet (sandy)
                { r: 85, g: 180, b: 85 }  // Forest planet (green)
            ];
            const baseColor = planetColors[index % planetColors.length];
            const planetRadius = planet.radius;
            const centerX = planet.position.x;
            const centerY = planet.position.y;
            
            // Atmospheric glow (outermost layer)
            const atmosphereSize = planetRadius + 8;
            for (let i = 0; i < 3; i++) {
                const glowRadius = atmosphereSize - i * 2;
                const glowOpacity = (3 - i) * 0.15;
                renderer.drawCircle(centerX, centerY, glowRadius, 
                    { r: baseColor.r * glowOpacity, g: baseColor.g * glowOpacity, b: baseColor.b * glowOpacity }, true);
            }
            
            // Main planet body with gradient shading
            for (let r = planetRadius; r > 0; r -= 2) {
                const shadeFactor = 0.4 + (r / planetRadius) * 0.6; // Gradient from dark to light
                const shadeColor = {
                    r: Math.floor(baseColor.r * shadeFactor),
                    g: Math.floor(baseColor.g * shadeFactor),
                    b: Math.floor(baseColor.b * shadeFactor)
                };
                renderer.drawCircle(centerX, centerY, r, shadeColor, true);
            }
            
            // Surface features based on planet type
            const surfaceDetails = [];
            switch (index % 4) {
                case 0: // Mars-like - craters and polar caps
                    surfaceDetails.push(
                        { x: centerX - planetRadius * 0.3, y: centerY - planetRadius * 0.4, size: planetRadius * 0.2, color: { r: 120, g: 60, b: 30 } },
                        { x: centerX + planetRadius * 0.4, y: centerY + planetRadius * 0.3, size: planetRadius * 0.15, color: { r: 140, g: 70, b: 35 } },
                        { x: centerX, y: centerY - planetRadius * 0.8, size: planetRadius * 0.1, color: { r: 255, g: 255, b: 255 } } // Ice cap
                    );
                    break;
                case 1: // Earth-like - continents and clouds
                    surfaceDetails.push(
                        { x: centerX - planetRadius * 0.2, y: centerY, size: planetRadius * 0.3, color: { r: 30, g: 100, b: 40 } }, // Continent
                        { x: centerX + planetRadius * 0.3, y: centerY - planetRadius * 0.2, size: planetRadius * 0.25, color: { r: 35, g: 110, b: 45 } },
                        { x: centerX, y: centerY + planetRadius * 0.4, size: planetRadius * 0.15, color: { r: 220, g: 220, b: 255 } } // Cloud
                    );
                    break;
                case 2: // Desert planet - dune patterns
                    for (let d = 0; d < 4; d++) {
                        const angle = (d * Math.PI * 2) / 4;
                        const x = centerX + Math.cos(angle) * planetRadius * 0.3;
                        const y = centerY + Math.sin(angle) * planetRadius * 0.3;
                        surfaceDetails.push({ x, y, size: planetRadius * 0.1, color: { r: 200, g: 180, b: 100 } });
                    }
                    break;
                case 3: // Forest planet - vegetation patches
                    for (let f = 0; f < 5; f++) {
                        const angle = (f * Math.PI * 2) / 5;
                        const x = centerX + Math.cos(angle) * planetRadius * 0.4;
                        const y = centerY + Math.sin(angle) * planetRadius * 0.4;
                        surfaceDetails.push({ x, y, size: planetRadius * 0.12, color: { r: 60, g: 150, b: 60 } });
                    }
                    break;
            }
            
            // Draw surface details
            surfaceDetails.forEach(detail => {
                renderer.drawCircle(detail.x, detail.y, detail.size, detail.color, true);
                // Add subtle highlight
                renderer.drawCircle(detail.x - detail.size * 0.3, detail.y - detail.size * 0.3, detail.size * 0.5, 
                    { r: detail.color.r + 30, g: detail.color.g + 30, b: detail.color.b + 30 }, true);
            });
            
            // Terminator line (day/night boundary)
            const terminatorX = centerX + planetRadius * 0.3;
            for (let y = centerY - planetRadius; y <= centerY + planetRadius; y += 2) {
                const distFromCenter = Math.abs(y - centerY);
                if (distFromCenter < planetRadius) {
                    const shadowWidth = Math.sqrt(planetRadius * planetRadius - distFromCenter * distFromCenter) * 0.6;
                    if (terminatorX - shadowWidth > centerX - planetRadius) {
                        renderer.setPixel(terminatorX - shadowWidth, y, { r: 0, g: 0, b: 0 });
                    }
                }
            }
            
            // Specular highlight (sun reflection)
            const highlightX = centerX - planetRadius * 0.4;
            const highlightY = centerY - planetRadius * 0.4;
            const highlightSize = planetRadius * 0.15;
            renderer.drawCircle(highlightX, highlightY, highlightSize, 
                { r: 255, g: 255, b: 255 }, true);
            renderer.drawCircle(highlightX, highlightY, highlightSize * 0.7, 
                { r: 255, g: 255, b: 220 }, true);
        });
        
        // Render enhanced demo ship if available
        if (this.demoShip) {
            const shipSize = 48; // Larger ship
            const shipSprite = renderer.generateShipSprite('player', shipSize);
            const shipX = this.demoShip.position.x - shipSize/2;
            const shipY = this.demoShip.position.y - shipSize/2;
            
            renderer.drawSprite(shipSprite, shipX, shipY);
            
            // Enhanced engine effects
            const engineGlowSize = 12;
            const engineY = this.demoShip.position.y + shipSize/2 + 5;
            
            // Main engine exhausts
            renderer.drawCircle(this.demoShip.position.x - 8, engineY, engineGlowSize, 
                { r: 100, g: 200, b: 255 }, true);
            renderer.drawCircle(this.demoShip.position.x + 8, engineY, engineGlowSize, 
                { r: 100, g: 200, b: 255 }, true);
            
            // Bright engine cores
            renderer.drawCircle(this.demoShip.position.x - 8, engineY, engineGlowSize * 0.6, 
                { r: 200, g: 240, b: 255 }, true);
            renderer.drawCircle(this.demoShip.position.x + 8, engineY, engineGlowSize * 0.6, 
                { r: 200, g: 240, b: 255 }, true);
            
            // Engine plasma trails
            for (let i = 1; i <= 5; i++) {
                const trailY = engineY + i * 4;
                const trailOpacity = (6 - i) / 6;
                const trailSize = engineGlowSize * trailOpacity;
                
                renderer.drawCircle(this.demoShip.position.x - 8, trailY, trailSize, 
                    { r: 50 * trailOpacity, g: 150 * trailOpacity, b: 255 * trailOpacity }, true);
                renderer.drawCircle(this.demoShip.position.x + 8, trailY, trailSize, 
                    { r: 50 * trailOpacity, g: 150 * trailOpacity, b: 255 * trailOpacity }, true);
            }
            
            // Navigation lights
            renderer.setPixel(this.demoShip.position.x - shipSize/2 + 5, this.demoShip.position.y - 10, 
                { r: 255, g: 0, b: 0 }); // Red port light
            renderer.setPixel(this.demoShip.position.x + shipSize/2 - 5, this.demoShip.position.y - 10, 
                { r: 0, g: 255, b: 0 }); // Green starboard light
            renderer.setPixel(this.demoShip.position.x, this.demoShip.position.y - shipSize/2 + 5, 
                { r: 255, g: 255, b: 255 }); // White forward light
        }
        
        // Render enhanced HUD
        this.renderEnhancedHUD(renderer);
    }

    /**
     * Render paused state
     */
    private renderPausedState(renderer: Renderer): void {
        // Render playing state first
        this.renderPlayingState(renderer);
        
        // Overlay pause menu
        const centerX = 720;
        const centerY = 450;
        
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
        const centerX = 720;
        const centerY = 450;
        
        // Error background
        renderer.fillRect(0, 0, 1440, 900, { r: 64, g: 0, b: 0 });
        
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
        const centerX = 720;
        const centerY = 450;
        
        renderer.renderText(`UNKNOWN STATE: ${this.currentState}`, centerX - 100, centerY, 
            { r: 255, g: 0, b: 255 }, 16);
    }

    /**
     * Render space background
     */
    private renderSpaceBackground(renderer: Renderer): void {
        // Simple star field
        for (let i = 0; i < 150; i++) {
            const x = (i * 73) % 1440; // Pseudo-random distribution for 1440x900
            const y = (i * 149) % 900;
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
     * Render enhanced space background
     */
    private renderEnhancedSpaceBackground(renderer: Renderer): void {
        // Deep space gradient background
        renderer.fillRect(0, 0, 1440, 900, { r: 2, g: 4, b: 12 });
        
        // Distant galaxy background (faint milky way)
        for (let i = 0; i < 50; i++) {
            const x = (i * 28.8) % 1440;
            const y = 200 + Math.sin(i * 0.1) * 150;
            const size = 40 + (i % 20);
            const intensity = 8 + (i % 12);
            
            renderer.drawCircle(x, y, size, { 
                r: intensity, 
                g: intensity * 0.9, 
                b: intensity * 1.3 
            }, true);
        }
        
        // Enhanced multi-layer star field
        for (let layer = 0; layer < 3; layer++) {
            const starCount = [150, 100, 50][layer]; // Different densities per layer
            const brightness = [4, 3, 2][layer]; // Brightness per layer
            
            for (let i = 0; i < starCount; i++) {
                const x = ((i * 73) + layer * 123) % 1440;
                const y = ((i * 149) + layer * 67) % 900;
                const starBrightness = (i % 4) + brightness;
                const size = starBrightness > 5 ? 3 : starBrightness > 3 ? 2 : 1;
                
                // Star color variation (blue-white to red giants)
                const colorVariation = i % 6;
                let color;
                switch (colorVariation) {
                    case 0: // Blue-white hot stars
                        color = { 
                            r: starBrightness * 40, 
                            g: starBrightness * 45, 
                            b: starBrightness * 60 
                        };
                        break;
                    case 1: // White stars
                        color = { 
                            r: starBrightness * 50, 
                            g: starBrightness * 50, 
                            b: starBrightness * 50 
                        };
                        break;
                    case 2: // Yellow stars (like our sun)
                        color = { 
                            r: starBrightness * 55, 
                            g: starBrightness * 50, 
                            b: starBrightness * 35 
                        };
                        break;
                    case 3: // Orange stars
                        color = { 
                            r: starBrightness * 55, 
                            g: starBrightness * 40, 
                            b: starBrightness * 25 
                        };
                        break;
                    case 4: // Red giants
                        color = { 
                            r: starBrightness * 60, 
                            g: starBrightness * 25, 
                            b: starBrightness * 15 
                        };
                        break;
                    default: // Distant dim stars
                        color = { 
                            r: starBrightness * 30, 
                            g: starBrightness * 30, 
                            b: starBrightness * 40 
                        };
                }
                
                if (size === 1) {
                    renderer.setPixel(x, y, color);
                } else if (size === 2) {
                    renderer.fillRect(x, y, 2, 2, color);
                    // Add subtle glow
                    renderer.setPixel(x-1, y, { r: color.r * 0.3, g: color.g * 0.3, b: color.b * 0.3 });
                    renderer.setPixel(x+2, y, { r: color.r * 0.3, g: color.g * 0.3, b: color.b * 0.3 });
                    renderer.setPixel(x, y-1, { r: color.r * 0.3, g: color.g * 0.3, b: color.b * 0.3 });
                    renderer.setPixel(x, y+2, { r: color.r * 0.3, g: color.g * 0.3, b: color.b * 0.3 });
                } else {
                    renderer.drawCircle(x, y, size, color, true);
                    // Bright star corona
                    renderer.drawCircle(x, y, size + 1, { 
                        r: color.r * 0.4, 
                        g: color.g * 0.4, 
                        b: color.b * 0.4 
                    }, true);
                }
            }
        }
        
        // Colorful nebulae patches
        const nebulaColors = [
            { r: 80, g: 20, b: 100 }, // Purple nebula
            { r: 100, g: 40, b: 20 }, // Orange nebula
            { r: 20, g: 80, b: 100 }, // Blue nebula
            { r: 80, g: 100, b: 30 }, // Green nebula
            { r: 100, g: 20, b: 60 }  // Pink nebula
        ];
        
        for (let i = 0; i < 8; i++) {
            const x = (i * 180) % 1440;
            const y = (i * 112.5) % 900;
            const size = 60 + (i % 40);
            const baseColor = nebulaColors[i % nebulaColors.length];
            
            // Create wispy nebula effect
            for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
                for (let radius = 0; radius < size; radius += 8) {
                    const opacity = (1 - radius / size) * 0.3;
                    const px = x + Math.cos(angle) * radius + Math.sin(angle * 3) * 10;
                    const py = y + Math.sin(angle) * radius + Math.cos(angle * 2) * 8;
                    
                    if (px >= 0 && px < 1440 && py >= 0 && py < 900) {
                        const nebulaColor = {
                            r: Math.floor(baseColor.r * opacity),
                            g: Math.floor(baseColor.g * opacity),
                            b: Math.floor(baseColor.b * opacity)
                        };
                        renderer.setPixel(Math.floor(px), Math.floor(py), nebulaColor);
                    }
                }
            }
        }
        
        // Distant galaxies (very faint spiral shapes)
        for (let i = 0; i < 3; i++) {
            const x = 200 + i * 500;
            const y = 150 + i * 200;
            const size = 30 + i * 10;
            
            // Spiral galaxy arms
            for (let arm = 0; arm < 2; arm++) {
                for (let t = 0; t < Math.PI * 4; t += 0.3) {
                    const armOffset = arm * Math.PI;
                    const radius = (t / (Math.PI * 4)) * size;
                    const px = x + Math.cos(t + armOffset) * radius;
                    const py = y + Math.sin(t + armOffset) * radius * 0.6; // Elliptical
                    
                    if (px >= 0 && px < 1440 && py >= 0 && py < 900) {
                        const intensity = (1 - t / (Math.PI * 4)) * 15;
                        renderer.setPixel(Math.floor(px), Math.floor(py), {
                            r: intensity * 0.8,
                            g: intensity * 0.8,
                            b: intensity * 1.2
                        });
                    }
                }
            }
        }
    }

    /**
     * Render menu background (Image 3)
     */
    private renderMenuBackground(renderer: Renderer): void {
        // Image 3 as base64 (cockpit view with galaxy)
        const menuBgData = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABQAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxAAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=';
        
        // For now, we'll draw a simple gradient background
        // In a real implementation, you'd decode and render the base64 image
        for (let y = 0; y < 768; y++) {
            for (let x = 0; x < 1024; x++) {
                // Create a dark space gradient from top to bottom
                const gradient = Math.floor((y / 768) * 64);
                const color = {
                    r: gradient / 4,
                    g: gradient / 3,
                    b: gradient
                };
                renderer.setPixel(x, y, color);
            }
        }
        
        // Add some stars
        for (let i = 0; i < 200; i++) {
            const x = (i * 73) % 1024;
            const y = (i * 149) % 768;
            const brightness = (i % 4) + 1;
            const color = { 
                r: brightness * 48, 
                g: brightness * 48, 
                b: brightness * 64 
            };
            
            renderer.setPixel(x, y, color);
            
            // Add twinkling effect for some stars
            if (i % 7 === 0) {
                const twinkle = Math.sin(Date.now() / 1000 + i) * 32 + 32;
                const twinkleColor = {
                    r: twinkle,
                    g: twinkle * 0.8,
                    b: twinkle * 1.2
                };
                renderer.setPixel(x, y, twinkleColor);
            }
        }
        
        // Add galaxy band across the middle
        for (let x = 0; x < 1024; x++) {
            for (let y = 300; y < 468; y++) {
                const distance = Math.abs(y - 384);
                const intensity = Math.max(0, 168 - distance) / 168;
                const color = {
                    r: intensity * 48,
                    g: intensity * 32,
                    b: intensity * 64
                };
                if (intensity > 0.1) {
                    renderer.setPixel(x, y, color);
                }
            }
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
     * Render enhanced HUD with better visuals
     */
    private renderEnhancedHUD(renderer: Renderer): void {
        // HUD background panel
        renderer.fillRect(10, 10, 280, 140, { r: 0, g: 0, b: 0, a: 180 });
        renderer.drawRect(10, 10, 280, 140, { r: 0, g: 255, b: 255 }, false);
        
        // Ship status with bars
        const health = this.gameData.playerShip.health;
        const fuel = this.gameData.playerShip.fuel;
        
        // Health bar
        renderer.renderText('INTEGRITA:', 20, 25, { r: 200, g: 200, b: 200 }, 12);
        renderer.fillRect(100, 25, 100, 12, { r: 50, g: 50, b: 50 });
        renderer.fillRect(100, 25, health, 12, 
            health > 70 ? { r: 0, g: 200, b: 0 } : 
            health > 30 ? { r: 200, g: 200, b: 0 } : { r: 200, g: 0, b: 0 });
        renderer.renderText(`${health.toFixed(0)}%`, 210, 25, { r: 255, g: 255, b: 255 }, 12);
        
        // Fuel bar
        renderer.renderText('PALIVO:', 20, 45, { r: 200, g: 200, b: 200 }, 12);
        const fuelPercent = Math.min(100, (fuel / 1000) * 100);
        renderer.fillRect(100, 45, 100, 12, { r: 50, g: 50, b: 50 });
        renderer.fillRect(100, 45, fuelPercent, 12, 
            fuelPercent > 50 ? { r: 0, g: 150, b: 255 } : { r: 255, g: 100, b: 0 });
        renderer.renderText(`${fuel.toFixed(0)}`, 210, 45, { r: 255, g: 255, b: 255 }, 12);
        
        // Resources
        renderer.renderText(`KREDITY: ${this.gameData.playerShip.resources.get('credits') || 0}`, 
            20, 70, { r: 255, g: 255, b: 100 }, 12);
        
        // Location info
        renderer.renderText(`SYSTÉM: ${this.gameData.currentSystem.name}`, 
            20, 90, { r: 100, g: 255, b: 255 }, 12);
            
        // Game time
        const minutes = Math.floor(this.gameData.gameTime / 60);
        const seconds = Math.floor(this.gameData.gameTime % 60);
        renderer.renderText(`ČAS: ${minutes}:${seconds.toString().padStart(2, '0')}`, 
            20, 110, { r: 150, g: 200, b: 255 }, 12);
            
        // Position indicator (top right)
        const shipPos = this.gameData.playerShip.position;
        renderer.renderText(`POS: ${Math.floor(shipPos.x)}, ${Math.floor(shipPos.y)}`, 
            1290, 20, { r: 150, g: 150, b: 150 }, 10);
            
        // Control hints (bottom of screen)
        const hints = [
            'WASD - Pohyb | MEZERNÍK - Brždění | ESC - Menu',
            'P - Skenovat planetu | E - Interakce'
        ];
        hints.forEach((hint, index) => {
            renderer.renderText(hint, 720, 850 + index * 20, { r: 100, g: 100, b: 100 }, 10);
        });
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
     * Handle menu events
     */
    private async handleNewGame(settings: NewGameSettings): Promise<void> {
        this.logger.info('🆕 Starting new game', settings);
        
        // Apply new game settings
        this.gameData = this.createDefaultGameData();
        this.gameData.playerShip.id = `ship_${settings.playerName.toLowerCase()}`;
        
        // Apply difficulty settings
        switch (settings.difficulty) {
            case 'easy':
                this.gameData.playerShip.health = 150;
                this.gameData.playerShip.fuel = 200;
                break;
            case 'hard':
                this.gameData.playerShip.health = 75;
                this.gameData.playerShip.fuel = 100;
                break;
            case 'nightmare':
                this.gameData.playerShip.health = 50;
                this.gameData.playerShip.fuel = 75;
                break;
            default: // normal
                this.gameData.playerShip.health = 100;
                this.gameData.playerShip.fuel = 150;
        }
        
        // Set galaxy settings
        this.gameData.currentSystem.name = `Galaxy_${settings.galaxySeed}`;
        
        await this.setState(GameState.Loading);
    }
    
    private async handleLoadGame(saveSlot: number): Promise<void> {
        this.logger.info(`📁 Loading game from slot ${saveSlot}`);
        
        try {
            const saveKey = `stellarOdyssey_save_${saveSlot}`;
            const saveData = localStorage.getItem(saveKey);
            
            if (saveData) {
                this.gameData = JSON.parse(saveData);
                await this.setState(GameState.Loading);
            } else {
                this.logger.warn('Save slot is empty');
            }
        } catch (error) {
            this.logger.error('Failed to load game', error);
        }
    }
    
    private handleSettingsChange(settings: GameSettings): void {
        this.logger.info('⚙️ Applying settings', settings);
        
        // Update game data settings
        this.gameData.settings = {
            masterVolume: settings.masterVolume,
            musicVolume: settings.musicVolume,
            sfxVolume: settings.sfxVolume,
            difficulty: settings.difficulty || 'normal'
        };
        
        // Save settings
        try {
            localStorage.setItem('stellarOdyssey_settings', JSON.stringify(settings));
        } catch (error) {
            this.logger.error('Failed to save settings', error);
        }
    }
    
    private async handleExit(): Promise<void> {
        this.logger.info('👋 Exiting game');
        
        // Save current game state
        await this.save();
        
        // Close game or minimize window
        if ('close' in window) {
            (window as any).close();
        }
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
        return this.currentState === GameState.MainMenu;
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