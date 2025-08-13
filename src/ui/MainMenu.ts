/**
 * Main Menu System
 * Professional game menu with retro CRT styling and smooth transitions
 */

import { Logger } from '@utils/Logger';
import { Renderer, Color } from '@core/Renderer';
import { InputManager } from '@core/InputManager';
import { ProceduralAudio, SoundType } from '@audio/ProceduralAudio';
import { ParticleSystem, ParticleType } from '@effects/ParticleSystem';

export enum MenuState {
    MainMenu = 'main_menu',
    NewGame = 'new_game',
    LoadGame = 'load_game',
    Settings = 'settings',
    Credits = 'credits',
    Connecting = 'connecting',
    GameStart = 'game_start'
}

export interface MenuButton {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    enabled: boolean;
    highlighted: boolean;
    action: () => void;
    hotkey?: string;
}

export interface MenuConfig {
    title: string;
    subtitle?: string;
    showBackground: boolean;
    showParticles: boolean;
    enableSounds: boolean;
    transitionTime: number;
}

export interface NewGameSettings {
    playerName: string;
    difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
    galaxySeed: string;
    galaxySize: 'small' | 'medium' | 'large' | 'huge';
    startingResources: 'minimal' | 'standard' | 'abundant';
    enemyFrequency: 'low' | 'normal' | 'high' | 'extreme';
    enablePermadeath: boolean;
    enableTutorial: boolean;
}

export interface GameSettings {
    // Video settings
    renderScale: number;
    vsync: boolean;
    fullscreen: boolean;
    
    // Audio settings
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    
    // Gameplay settings
    mouseSensitivity: number;
    showFPS: boolean;
    autoSave: boolean;
    autoSaveInterval: number;
    
    // Accessibility
    colorblindMode: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
    subtitles: boolean;
    reducedMotion: boolean;
    
    // Controls
    keyBindings: { [action: string]: string };
}

export interface MenuEvents {
    onNewGame?: (settings: NewGameSettings) => void;
    onLoadGame?: (saveSlot: number) => void;
    onSettings?: (settings: GameSettings) => void;
    onExit?: () => void;
    onGameStart?: () => void;
}

export class MainMenu {
    private currentState: MenuState = MenuState.MainMenu;
    private previousState: MenuState | null = null;
    
    // UI state
    private buttons: MenuButton[] = [];
    private selectedButtonIndex: number = 0;
    private animationTime: number = 0;
    private transitionProgress: number = 0;
    private isTransitioning: boolean = false;
    
    // Settings
    private newGameSettings: NewGameSettings;
    private gameSettings: GameSettings;
    
    // Visual effects
    private backgroundParticles: string[] = [];
    private titleGlow: number = 0;
    private screenFlicker: number = 0;
    
    // Menu specific data
    private saveSlots: Array<{
        slot: number;
        name: string;
        date: string;
        playtime: string;
        level: number;
        system: string;
        exists: boolean;
    }> = [];
    
    private events: MenuEvents;
    private audio: ProceduralAudio | null = null;
    private particles: ParticleSystem | null = null;
    private logger: Logger;

    constructor(
        events: MenuEvents,
        audio?: ProceduralAudio,
        particles?: ParticleSystem
    ) {
        this.logger = new Logger('MainMenu');
        this.events = events;
        this.audio = audio || null;
        this.particles = particles || null;
        
        // Initialize default settings
        this.newGameSettings = this.getDefaultNewGameSettings();
        this.gameSettings = this.getDefaultGameSettings();
        
        // Load save slots
        this.loadSaveSlots();
        
        // Initialize main menu
        this.initializeMainMenu();
        
        // Start background effects
        this.startBackgroundEffects();
        
        this.logger.info('🎮 Main menu system initialized');
    }

    /**
     * Update menu system
     */
    update(deltaTime: number, input: InputManager): void {
        this.animationTime += deltaTime;
        
        // Update visual effects
        this.updateVisualEffects(deltaTime);
        
        // Handle transitions
        if (this.isTransitioning) {
            this.updateTransition(deltaTime);
            return;
        }
        
        // Handle input based on current state
        this.handleInput(input);
        
        // Update particles
        this.updateParticleEffects(deltaTime);
    }

    /**
     * Handle input for current menu state
     */
    private handleInput(input: InputManager): void {
        // Navigation
        if (input.isKeyPressed('ArrowUp') || input.isKeyPressed('KeyW')) {
            this.navigateUp();
        } else if (input.isKeyPressed('ArrowDown') || input.isKeyPressed('KeyS')) {
            this.navigateDown();
        }
        
        // Selection
        if (input.isKeyPressed('Enter') || input.isKeyPressed('Space')) {
            this.selectButton();
        }
        
        // Back/Cancel
        if (input.isKeyPressed('Escape')) {
            this.goBack();
        }
        
        // State-specific input
        switch (this.currentState) {
            case MenuState.NewGame:
                this.handleNewGameInput(input);
                break;
            case MenuState.Settings:
                this.handleSettingsInput(input);
                break;
        }
        
        // Hotkey support
        this.handleHotkeys(input);
    }

    /**
     * Navigate up in menu
     */
    private navigateUp(): void {
        if (this.buttons.length === 0) return;
        
        this.playUISound('navigation');
        
        do {
            this.selectedButtonIndex = (this.selectedButtonIndex - 1 + this.buttons.length) % this.buttons.length;
        } while (!this.buttons[this.selectedButtonIndex].enabled);
        
        this.updateButtonHighlights();
    }

    /**
     * Navigate down in menu
     */
    private navigateDown(): void {
        if (this.buttons.length === 0) return;
        
        this.playUISound('navigation');
        
        do {
            this.selectedButtonIndex = (this.selectedButtonIndex + 1) % this.buttons.length;
        } while (!this.buttons[this.selectedButtonIndex].enabled);
        
        this.updateButtonHighlights();
    }

    /**
     * Select current button
     */
    private selectButton(): void {
        if (this.buttons.length === 0 || this.selectedButtonIndex >= this.buttons.length) return;
        
        const button = this.buttons[this.selectedButtonIndex];
        if (!button.enabled) return;
        
        this.playUISound('select');
        button.action();
    }

    /**
     * Go back to previous menu
     */
    private goBack(): void {
        this.playUISound('back');
        
        switch (this.currentState) {
            case MenuState.MainMenu:
                // Exit game or minimize
                this.events.onExit?.();
                break;
            default:
                this.transitionToState(MenuState.MainMenu);
                break;
        }
    }

    /**
     * Initialize main menu buttons
     */
    private initializeMainMenu(): void {
        this.buttons = [
            {
                id: 'new_game',
                text: 'NEW GAME',
                x: 0, y: 0, width: 200, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.transitionToState(MenuState.NewGame),
                hotkey: 'KeyN'
            },
            {
                id: 'load_game',
                text: 'LOAD GAME',
                x: 0, y: 0, width: 200, height: 40,
                enabled: this.hasSaveGames(),
                highlighted: false,
                action: () => this.transitionToState(MenuState.LoadGame),
                hotkey: 'KeyL'
            },
            {
                id: 'settings',
                text: 'SETTINGS',
                x: 0, y: 0, width: 200, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.transitionToState(MenuState.Settings),
                hotkey: 'KeyS'
            },
            {
                id: 'credits',
                text: 'CREDITS',
                x: 0, y: 0, width: 200, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.transitionToState(MenuState.Credits),
                hotkey: 'KeyC'
            },
            {
                id: 'exit',
                text: 'EXIT',
                x: 0, y: 0, width: 200, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.events.onExit?.(),
                hotkey: 'KeyQ'
            }
        ];
        
        this.selectedButtonIndex = 0;
        this.updateButtonPositions();
        this.updateButtonHighlights();
    }

    /**
     * Initialize new game menu
     */
    private initializeNewGameMenu(): void {
        this.buttons = [
            {
                id: 'player_name',
                text: `CAPTAIN NAME: ${this.newGameSettings.playerName}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.editPlayerName()
            },
            {
                id: 'difficulty',
                text: `DIFFICULTY: ${this.newGameSettings.difficulty.toUpperCase()}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.cycleDifficulty()
            },
            {
                id: 'galaxy_size',
                text: `GALAXY SIZE: ${this.newGameSettings.galaxySize.toUpperCase()}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.cycleGalaxySize()
            },
            {
                id: 'enemy_frequency',
                text: `HOSTILES: ${this.newGameSettings.enemyFrequency.toUpperCase()}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.cycleEnemyFrequency()
            },
            {
                id: 'permadeath',
                text: `PERMADEATH: ${this.newGameSettings.enablePermadeath ? 'ON' : 'OFF'}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.togglePermadeath()
            },
            {
                id: 'tutorial',
                text: `TUTORIAL: ${this.newGameSettings.enableTutorial ? 'ON' : 'OFF'}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.toggleTutorial()
            },
            {
                id: 'start_game',
                text: 'START MISSION',
                x: 0, y: 0, width: 300, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.startNewGame()
            },
            {
                id: 'back',
                text: 'BACK',
                x: 0, y: 0, width: 200, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.transitionToState(MenuState.MainMenu)
            }
        ];
        
        this.selectedButtonIndex = 0;
        this.updateButtonPositions();
        this.updateButtonHighlights();
    }

    /**
     * Initialize load game menu
     */
    private initializeLoadGameMenu(): void {
        this.buttons = [];
        
        // Add save slot buttons
        for (let i = 0; i < this.saveSlots.length; i++) {
            const slot = this.saveSlots[i];
            
            this.buttons.push({
                id: `save_slot_${slot.slot}`,
                text: slot.exists ? 
                    `SLOT ${slot.slot}: ${slot.name} - ${slot.system} (${slot.playtime})` :
                    `SLOT ${slot.slot}: EMPTY`,
                x: 0, y: 0, width: 600, height: 40,
                enabled: slot.exists,
                highlighted: false,
                action: () => this.loadGame(slot.slot)
            });
        }
        
        // Add back button
        this.buttons.push({
            id: 'back',
            text: 'BACK',
            x: 0, y: 0, width: 200, height: 40,
            enabled: true,
            highlighted: false,
            action: () => this.transitionToState(MenuState.MainMenu)
        });
        
        this.selectedButtonIndex = 0;
        this.updateButtonPositions();
        this.updateButtonHighlights();
    }

    /**
     * Initialize settings menu
     */
    private initializeSettingsMenu(): void {
        this.buttons = [
            {
                id: 'render_scale',
                text: `RENDER QUALITY: ${Math.round(this.gameSettings.renderScale * 100)}%`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.adjustRenderScale()
            },
            {
                id: 'master_volume',
                text: `MASTER VOLUME: ${Math.round(this.gameSettings.masterVolume * 100)}%`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.adjustMasterVolume()
            },
            {
                id: 'music_volume',
                text: `MUSIC VOLUME: ${Math.round(this.gameSettings.musicVolume * 100)}%`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.adjustMusicVolume()
            },
            {
                id: 'sfx_volume',
                text: `SFX VOLUME: ${Math.round(this.gameSettings.sfxVolume * 100)}%`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.adjustSfxVolume()
            },
            {
                id: 'show_fps',
                text: `SHOW FPS: ${this.gameSettings.showFPS ? 'ON' : 'OFF'}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.toggleShowFPS()
            },
            {
                id: 'vsync',
                text: `VSYNC: ${this.gameSettings.vsync ? 'ON' : 'OFF'}`,
                x: 0, y: 0, width: 400, height: 30,
                enabled: true,
                highlighted: false,
                action: () => this.toggleVSync()
            },
            {
                id: 'apply_settings',
                text: 'APPLY CHANGES',
                x: 0, y: 0, width: 300, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.applySettings()
            },
            {
                id: 'reset_defaults',
                text: 'RESET TO DEFAULTS',
                x: 0, y: 0, width: 300, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.resetToDefaults()
            },
            {
                id: 'back',
                text: 'BACK',
                x: 0, y: 0, width: 200, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.transitionToState(MenuState.MainMenu)
            }
        ];
        
        this.selectedButtonIndex = 0;
        this.updateButtonPositions();
        this.updateButtonHighlights();
    }

    /**
     * Initialize credits menu
     */
    private initializeCreditsMenu(): void {
        this.buttons = [
            {
                id: 'back',
                text: 'BACK',
                x: 400, y: 500, width: 200, height: 40,
                enabled: true,
                highlighted: false,
                action: () => this.transitionToState(MenuState.MainMenu)
            }
        ];
        
        this.selectedButtonIndex = 0;
        this.updateButtonHighlights();
    }

    /**
     * Update button positions based on screen size
     */
    private updateButtonPositions(): void {
        const centerX = 400; // Assuming 800px width
        const startY = 250;
        const spacing = 50;
        
        for (let i = 0; i < this.buttons.length; i++) {
            const button = this.buttons[i];
            button.x = centerX - button.width / 2;
            button.y = startY + i * spacing;
        }
    }

    /**
     * Update button highlight states
     */
    private updateButtonHighlights(): void {
        for (let i = 0; i < this.buttons.length; i++) {
            this.buttons[i].highlighted = (i === this.selectedButtonIndex);
        }
    }

    /**
     * Handle new game settings input
     */
    private handleNewGameInput(input: InputManager): void {
        // Additional input handling for new game menu
        if (input.isKeyPressed('KeyR')) {
            this.generateRandomSeed();
        }
    }

    /**
     * Handle settings input
     */
    private handleSettingsInput(input: InputManager): void {
        const button = this.buttons[this.selectedButtonIndex];
        if (!button) return;
        
        // Use left/right arrows to adjust values
        if (input.isKeyPressed('ArrowLeft')) {
            this.adjustSettingDown(button.id);
        } else if (input.isKeyPressed('ArrowRight')) {
            this.adjustSettingUp(button.id);
        }
    }

    /**
     * Handle hotkey input
     */
    private handleHotkeys(input: InputManager): void {
        if (this.currentState !== MenuState.MainMenu) return;
        
        for (const button of this.buttons) {
            if (button.hotkey && input.isKeyPressed(button.hotkey) && button.enabled) {
                this.playUISound('select');
                button.action();
                break;
            }
        }
    }

    /**
     * Transition to new menu state
     */
    private transitionToState(newState: MenuState): void {
        if (this.isTransitioning) return;
        
        this.previousState = this.currentState;
        this.isTransitioning = true;
        this.transitionProgress = 0;
        
        // Start transition effect
        this.playUISound('transition');
        this.createTransitionEffect();
        
        // Initialize new state after half transition
        setTimeout(() => {
            this.currentState = newState;
            this.initializeMenuForState(newState);
        }, 150); // Half of transition time
    }

    /**
     * Initialize menu for specific state
     */
    private initializeMenuForState(state: MenuState): void {
        switch (state) {
            case MenuState.MainMenu:
                this.initializeMainMenu();
                break;
            case MenuState.NewGame:
                this.initializeNewGameMenu();
                break;
            case MenuState.LoadGame:
                this.initializeLoadGameMenu();
                break;
            case MenuState.Settings:
                this.initializeSettingsMenu();
                break;
            case MenuState.Credits:
                this.initializeCreditsMenu();
                break;
        }
    }

    /**
     * Update transition animation
     */
    private updateTransition(deltaTime: number): void {
        this.transitionProgress += deltaTime / 300; // 300ms transition
        
        if (this.transitionProgress >= 1.0) {
            this.transitionProgress = 1.0;
            this.isTransitioning = false;
        }
    }

    /**
     * Update visual effects
     */
    private updateVisualEffects(deltaTime: number): void {
        // Title glow animation
        this.titleGlow = (Math.sin(this.animationTime * 0.003) + 1) * 0.5;
        
        // Screen flicker effect
        this.screenFlicker = Math.random() * 0.05;
        
        // Background particle movement
        this.updateBackgroundParticles(deltaTime);
    }

    /**
     * Update particle effects
     */
    private updateParticleEffects(deltaTime: number): void {
        if (!this.particles) return;
        
        this.particles.update(deltaTime);
        
        // Spawn occasional background particles
        if (Math.random() < 0.01) {
            const x = Math.random() * 800;
            const y = Math.random() * 600;
            this.particles.createExplosion({ x, y }, 0.1);
        }
    }

    /**
     * Start background effects
     */
    private startBackgroundEffects(): void {
        if (!this.particles) return;
        
        // Create initial background particles
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * 800;
            const y = Math.random() * 600;
            const emitterId = this.particles.createThrustTrail(
                { x, y },
                Math.random() * Math.PI * 2,
                0.2
            );
            this.backgroundParticles.push(emitterId);
        }
        
        // Start ambient music
        if (this.audio) {
            this.audio.startAmbientTrack('void_silence');
        }
    }

    /**
     * Update background particles
     */
    private updateBackgroundParticles(deltaTime: number): void {
        // Background particles drift slowly
        // Implementation depends on particle system API
    }

    /**
     * Create transition effect
     */
    private createTransitionEffect(): void {
        if (!this.particles) return;
        
        // Screen wipe effect with particles
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 800;
            const y = Math.random() * 600;
            this.particles.createExplosion({ x, y }, 0.3);
        }
    }

    /**
     * Play UI sound effect
     */
    private playUISound(type: 'navigation' | 'select' | 'back' | 'transition' | 'error'): void {
        if (!this.audio) return;
        
        switch (type) {
            case 'navigation':
                this.audio.playRetroSound(SoundType.Beep, 0.3);
                break;
            case 'select':
                this.audio.playRetroSound(SoundType.UI, 0.5);
                break;
            case 'back':
                this.audio.playRetroSound(SoundType.UI, 0.3);
                break;
            case 'transition':
                this.audio.playRetroSound(SoundType.Communication, 0.4);
                break;
            case 'error':
                this.audio.playRetroSound(SoundType.Warning, 0.6);
                break;
        }
    }

    /**
     * New game setting actions
     */
    private editPlayerName(): void {
        // Simple name cycling for demo
        const names = ['COMMANDER', 'CAPTAIN', 'ADMIRAL', 'PILOT', 'EXPLORER'];
        const currentIndex = names.indexOf(this.newGameSettings.playerName);
        this.newGameSettings.playerName = names[(currentIndex + 1) % names.length];
        this.updateNewGameMenuText();
    }

    private cycleDifficulty(): void {
        const difficulties: NewGameSettings['difficulty'][] = ['easy', 'normal', 'hard', 'nightmare'];
        const currentIndex = difficulties.indexOf(this.newGameSettings.difficulty);
        this.newGameSettings.difficulty = difficulties[(currentIndex + 1) % difficulties.length];
        this.updateNewGameMenuText();
    }

    private cycleGalaxySize(): void {
        const sizes: NewGameSettings['galaxySize'][] = ['small', 'medium', 'large', 'huge'];
        const currentIndex = sizes.indexOf(this.newGameSettings.galaxySize);
        this.newGameSettings.galaxySize = sizes[(currentIndex + 1) % sizes.length];
        this.updateNewGameMenuText();
    }

    private cycleEnemyFrequency(): void {
        const frequencies: NewGameSettings['enemyFrequency'][] = ['low', 'normal', 'high', 'extreme'];
        const currentIndex = frequencies.indexOf(this.newGameSettings.enemyFrequency);
        this.newGameSettings.enemyFrequency = frequencies[(currentIndex + 1) % frequencies.length];
        this.updateNewGameMenuText();
    }

    private togglePermadeath(): void {
        this.newGameSettings.enablePermadeath = !this.newGameSettings.enablePermadeath;
        this.updateNewGameMenuText();
    }

    private toggleTutorial(): void {
        this.newGameSettings.enableTutorial = !this.newGameSettings.enableTutorial;
        this.updateNewGameMenuText();
    }

    private generateRandomSeed(): void {
        this.newGameSettings.galaxySeed = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.updateNewGameMenuText();
    }

    private startNewGame(): void {
        this.playUISound('select');
        this.events.onNewGame?.(this.newGameSettings);
        this.transitionToState(MenuState.GameStart);
    }

    /**
     * Settings adjustment actions
     */
    private adjustSettingDown(settingId: string): void {
        switch (settingId) {
            case 'render_scale':
                this.gameSettings.renderScale = Math.max(0.5, this.gameSettings.renderScale - 0.1);
                break;
            case 'master_volume':
                this.gameSettings.masterVolume = Math.max(0, this.gameSettings.masterVolume - 0.1);
                break;
            case 'music_volume':
                this.gameSettings.musicVolume = Math.max(0, this.gameSettings.musicVolume - 0.1);
                break;
            case 'sfx_volume':
                this.gameSettings.sfxVolume = Math.max(0, this.gameSettings.sfxVolume - 0.1);
                break;
        }
        this.updateSettingsMenuText();
    }

    private adjustSettingUp(settingId: string): void {
        switch (settingId) {
            case 'render_scale':
                this.gameSettings.renderScale = Math.min(2.0, this.gameSettings.renderScale + 0.1);
                break;
            case 'master_volume':
                this.gameSettings.masterVolume = Math.min(1.0, this.gameSettings.masterVolume + 0.1);
                break;
            case 'music_volume':
                this.gameSettings.musicVolume = Math.min(1.0, this.gameSettings.musicVolume + 0.1);
                break;
            case 'sfx_volume':
                this.gameSettings.sfxVolume = Math.min(1.0, this.gameSettings.sfxVolume + 0.1);
                break;
        }
        this.updateSettingsMenuText();
    }

    private adjustRenderScale(): void {
        this.gameSettings.renderScale = this.gameSettings.renderScale >= 2.0 ? 0.5 : this.gameSettings.renderScale + 0.25;
        this.updateSettingsMenuText();
    }

    private adjustMasterVolume(): void {
        this.gameSettings.masterVolume = (this.gameSettings.masterVolume + 0.2) % 1.2;
        if (this.gameSettings.masterVolume > 1.0) this.gameSettings.masterVolume = 0;
        this.updateSettingsMenuText();
    }

    private adjustMusicVolume(): void {
        this.gameSettings.musicVolume = (this.gameSettings.musicVolume + 0.2) % 1.2;
        if (this.gameSettings.musicVolume > 1.0) this.gameSettings.musicVolume = 0;
        this.updateSettingsMenuText();
    }

    private adjustSfxVolume(): void {
        this.gameSettings.sfxVolume = (this.gameSettings.sfxVolume + 0.2) % 1.2;
        if (this.gameSettings.sfxVolume > 1.0) this.gameSettings.sfxVolume = 0;
        this.updateSettingsMenuText();
    }

    private toggleShowFPS(): void {
        this.gameSettings.showFPS = !this.gameSettings.showFPS;
        this.updateSettingsMenuText();
    }

    private toggleVSync(): void {
        this.gameSettings.vsync = !this.gameSettings.vsync;
        this.updateSettingsMenuText();
    }

    private applySettings(): void {
        this.playUISound('select');
        this.events.onSettings?.(this.gameSettings);
        this.saveSettings();
    }

    private resetToDefaults(): void {
        this.gameSettings = this.getDefaultGameSettings();
        this.updateSettingsMenuText();
        this.playUISound('select');
    }

    /**
     * Load game action
     */
    private loadGame(slot: number): void {
        this.playUISound('select');
        this.events.onLoadGame?.(slot);
        this.transitionToState(MenuState.GameStart);
    }

    /**
     * Update menu text after changes
     */
    private updateNewGameMenuText(): void {
        if (this.currentState !== MenuState.NewGame) return;
        
        const buttonUpdates = [
            { id: 'player_name', text: `CAPTAIN NAME: ${this.newGameSettings.playerName}` },
            { id: 'difficulty', text: `DIFFICULTY: ${this.newGameSettings.difficulty.toUpperCase()}` },
            { id: 'galaxy_size', text: `GALAXY SIZE: ${this.newGameSettings.galaxySize.toUpperCase()}` },
            { id: 'enemy_frequency', text: `HOSTILES: ${this.newGameSettings.enemyFrequency.toUpperCase()}` },
            { id: 'permadeath', text: `PERMADEATH: ${this.newGameSettings.enablePermadeath ? 'ON' : 'OFF'}` },
            { id: 'tutorial', text: `TUTORIAL: ${this.newGameSettings.enableTutorial ? 'ON' : 'OFF'}` }
        ];
        
        buttonUpdates.forEach(update => {
            const button = this.buttons.find(b => b.id === update.id);
            if (button) button.text = update.text;
        });
    }

    private updateSettingsMenuText(): void {
        if (this.currentState !== MenuState.Settings) return;
        
        const buttonUpdates = [
            { id: 'render_scale', text: `RENDER QUALITY: ${Math.round(this.gameSettings.renderScale * 100)}%` },
            { id: 'master_volume', text: `MASTER VOLUME: ${Math.round(this.gameSettings.masterVolume * 100)}%` },
            { id: 'music_volume', text: `MUSIC VOLUME: ${Math.round(this.gameSettings.musicVolume * 100)}%` },
            { id: 'sfx_volume', text: `SFX VOLUME: ${Math.round(this.gameSettings.sfxVolume * 100)}%` },
            { id: 'show_fps', text: `SHOW FPS: ${this.gameSettings.showFPS ? 'ON' : 'OFF'}` },
            { id: 'vsync', text: `VSYNC: ${this.gameSettings.vsync ? 'ON' : 'OFF'}` }
        ];
        
        buttonUpdates.forEach(update => {
            const button = this.buttons.find(b => b.id === update.id);
            if (button) button.text = update.text;
        });
    }

    /**
     * Utility methods
     */
    private getDefaultNewGameSettings(): NewGameSettings {
        return {
            playerName: 'COMMANDER',
            difficulty: 'normal',
            galaxySeed: Math.random().toString(36).substring(2, 8).toUpperCase(),
            galaxySize: 'medium',
            startingResources: 'standard',
            enemyFrequency: 'normal',
            enablePermadeath: false,
            enableTutorial: true
        };
    }

    private getDefaultGameSettings(): GameSettings {
        return {
            renderScale: 1.0,
            vsync: true,
            fullscreen: false,
            masterVolume: 0.7,
            musicVolume: 0.5,
            sfxVolume: 0.8,
            mouseSensitivity: 1.0,
            showFPS: false,
            autoSave: true,
            autoSaveInterval: 300, // 5 minutes
            colorblindMode: 'none',
            subtitles: false,
            reducedMotion: false,
            keyBindings: {
                forward: 'KeyW',
                backward: 'KeyS',
                left: 'KeyA',
                right: 'KeyD',
                fire: 'Space',
                warp: 'KeyW'
            }
        };
    }

    private hasSaveGames(): boolean {
        return this.saveSlots.some(slot => slot.exists);
    }

    private loadSaveSlots(): void {
        // Mock save data for demo
        this.saveSlots = [
            {
                slot: 1,
                name: 'Captain Nova',
                date: '2024-01-15',
                playtime: '12h 34m',
                level: 15,
                system: 'Alpha Centauri',
                exists: true
            },
            {
                slot: 2,
                name: 'Commander Rex',
                date: '2024-01-10',
                playtime: '8h 22m',
                level: 8,
                system: 'Sol System',
                exists: true
            },
            {
                slot: 3,
                name: '',
                date: '',
                playtime: '',
                level: 0,
                system: '',
                exists: false
            }
        ];
    }

    private saveSettings(): void {
        try {
            localStorage.setItem('gameSettings', JSON.stringify(this.gameSettings));
            this.logger.info('⚙️ Settings saved');
        } catch (error) {
            this.logger.error('Failed to save settings', error);
        }
    }

    private loadSettings(): void {
        try {
            const saved = localStorage.getItem('gameSettings');
            if (saved) {
                this.gameSettings = { ...this.getDefaultGameSettings(), ...JSON.parse(saved) };
                this.logger.info('⚙️ Settings loaded');
            }
        } catch (error) {
            this.logger.warn('Failed to load settings, using defaults', error);
        }
    }

    /**
     * Render menu system
     */
    render(renderer: Renderer): void {
        // Clear screen with dark background
        renderer.fillRect(0, 0, 800, 600, { r: 8, g: 8, b: 8 });
        
        // Apply screen flicker effect
        if (this.screenFlicker > 0.03) {
            const flickerAlpha = this.screenFlicker * 0.3;
            renderer.fillRect(0, 0, 800, 600, { r: 16, g: 16, b: 16 });
        }
        
        // Render current state
        switch (this.currentState) {
            case MenuState.MainMenu:
                this.renderMainMenu(renderer);
                break;
            case MenuState.NewGame:
                this.renderNewGameMenu(renderer);
                break;
            case MenuState.LoadGame:
                this.renderLoadGameMenu(renderer);
                break;
            case MenuState.Settings:
                this.renderSettingsMenu(renderer);
                break;
            case MenuState.Credits:
                this.renderCreditsMenu(renderer);
                break;
            case MenuState.GameStart:
                this.renderGameStart(renderer);
                break;
        }
        
        // Render transition effect
        if (this.isTransitioning) {
            this.renderTransition(renderer);
        }
        
        // Render particles
        if (this.particles) {
            this.particles.render(renderer);
        }
    }

    /**
     * Render main menu
     */
    private renderMainMenu(renderer: Renderer): void {
        // Render title with glow effect
        const titleColor = {
            r: 72 + Math.floor(this.titleGlow * 24),
            g: 48 + Math.floor(this.titleGlow * 16),
            b: 12 + Math.floor(this.titleGlow * 8)
        };
        
        this.renderText(renderer, 'STELLAR ODYSSEY', 400, 100, 'large', titleColor, 'center');
        this.renderText(renderer, 'DEEP SPACE EXPLORATION', 400, 140, 'medium', { r: 48, g: 48, b: 48 }, 'center');
        
        // Render version
        this.renderText(renderer, 'v1.0.0 ALPHA', 780, 580, 'small', { r: 32, g: 32, b: 32 }, 'right');
        
        // Render buttons
        this.renderButtons(renderer);
        
        // Render hotkey hints
        if (this.currentState === MenuState.MainMenu) {
            const hints = [
                'N - New Game    L - Load Game    S - Settings    C - Credits    Q - Exit',
                'Use ARROW KEYS or WASD to navigate, ENTER to select, ESC to go back'
            ];
            
            hints.forEach((hint, index) => {
                this.renderText(renderer, hint, 400, 520 + index * 20, 'small', { r: 24, g: 24, b: 24 }, 'center');
            });
        }
    }

    /**
     * Render new game menu
     */
    private renderNewGameMenu(renderer: Renderer): void {
        this.renderText(renderer, 'NEW MISSION SETUP', 400, 80, 'large', { r: 72, g: 48, b: 12 }, 'center');
        
        // Render buttons
        this.renderButtons(renderer);
        
        // Render galaxy seed info
        this.renderText(renderer, `GALAXY SEED: ${this.newGameSettings.galaxySeed}`, 400, 480, 'medium', { r: 48, g: 48, b: 48 }, 'center');
        this.renderText(renderer, 'Press R to generate random seed', 400, 500, 'small', { r: 32, g: 32, b: 32 }, 'center');
    }

    /**
     * Render load game menu
     */
    private renderLoadGameMenu(renderer: Renderer): void {
        this.renderText(renderer, 'LOAD MISSION', 400, 80, 'large', { r: 72, g: 48, b: 12 }, 'center');
        
        // Render save slot details
        for (let i = 0; i < this.saveSlots.length; i++) {
            const slot = this.saveSlots[i];
            const y = 150 + i * 70;
            
            if (slot.exists) {
                // Render detailed save info
                this.renderText(renderer, `SLOT ${slot.slot}: ${slot.name}`, 50, y, 'medium', { r: 48, g: 48, b: 48 }, 'left');
                this.renderText(renderer, `Location: ${slot.system}`, 50, y + 20, 'small', { r: 32, g: 32, b: 32 }, 'left');
                this.renderText(renderer, `Playtime: ${slot.playtime}`, 400, y + 20, 'small', { r: 32, g: 32, b: 32 }, 'left');
                this.renderText(renderer, `Date: ${slot.date}`, 600, y + 20, 'small', { r: 32, g: 32, b: 32 }, 'left');
            } else {
                this.renderText(renderer, `SLOT ${slot.slot}: EMPTY`, 50, y, 'medium', { r: 24, g: 24, b: 24 }, 'left');
            }
        }
        
        // Render back button
        this.renderButtons(renderer);
    }

    /**
     * Render settings menu
     */
    private renderSettingsMenu(renderer: Renderer): void {
        this.renderText(renderer, 'SYSTEM CONFIGURATION', 400, 80, 'large', { r: 72, g: 48, b: 12 }, 'center');
        
        // Render buttons
        this.renderButtons(renderer);
        
        // Render instructions
        this.renderText(renderer, 'Use LEFT/RIGHT arrows to adjust values', 400, 500, 'small', { r: 32, g: 32, b: 32 }, 'center');
    }

    /**
     * Render credits menu
     */
    private renderCreditsMenu(renderer: Renderer): void {
        this.renderText(renderer, 'STELLAR ODYSSEY', 400, 100, 'large', { r: 72, g: 48, b: 12 }, 'center');
        
        const credits = [
            '',
            'AI-DRIVEN GAME DEVELOPMENT',
            '',
            'Game Design & Programming:',
            'Claude Sonnet 4 (Anthropic)',
            '',
            'Technology Stack:',
            'TypeScript + HTML5 Canvas + WebGL',
            'Web Audio API + Performance Monitoring',
            'Procedural Generation + Advanced AI',
            '',
            'Special Thanks:',
            'The TypeScript Community',
            'Web Standards Contributors',
            'Space Exploration Pioneers',
            '',
            '© 2024 AI-Powered Game Development',
            'Created entirely through AI collaboration'
        ];
        
        credits.forEach((line, index) => {
            const y = 150 + index * 20;
            const color = line === '' ? { r: 0, g: 0, b: 0 } :
                         line.includes(':') ? { r: 48, g: 48, b: 48 } :
                         { r: 32, g: 32, b: 32 };
            
            if (line !== '') {
                this.renderText(renderer, line, 400, y, 'small', color, 'center');
            }
        });
        
        // Render back button
        this.renderButtons(renderer);
    }

    /**
     * Render game start loading
     */
    private renderGameStart(renderer: Renderer): void {
        this.renderText(renderer, 'INITIALIZING STELLAR DRIVE...', 400, 250, 'large', { r: 72, g: 48, b: 12 }, 'center');
        
        // Animated loading bar
        const progress = (this.animationTime % 3000) / 3000;
        const barWidth = 400;
        const barHeight = 20;
        const barX = 400 - barWidth / 2;
        const barY = 300;
        
        // Background
        renderer.drawRect(barX, barY, barWidth, barHeight, { r: 32, g: 32, b: 32 });
        
        // Progress
        const progressWidth = barWidth * progress;
        renderer.fillRect(barX, barY, progressWidth, barHeight, { r: 72, g: 48, b: 12 });
        
        // Loading text
        const loadingTexts = [
            'Generating galaxy...',
            'Calculating stellar positions...',
            'Initializing quantum drive...',
            'Loading mission parameters...',
            'Calibrating sensors...',
            'Establishing communications...',
            'Mission ready!'
        ];
        
        const textIndex = Math.floor(progress * loadingTexts.length);
        const currentText = loadingTexts[Math.min(textIndex, loadingTexts.length - 1)];
        
        this.renderText(renderer, currentText, 400, 350, 'medium', { r: 48, g: 48, b: 48 }, 'center');
        
        // Auto-start game after loading
        if (progress >= 0.95) {
            setTimeout(() => this.events.onGameStart?.(), 500);
        }
    }

    /**
     * Render transition effect
     */
    private renderTransition(renderer: Renderer): void {
        const alpha = this.transitionProgress < 0.5 ? 
            this.transitionProgress * 2 : 
            (1 - this.transitionProgress) * 2;
        
        // Screen wipe effect
        const wipeHeight = 600 * alpha;
        renderer.fillRect(0, 0, 800, wipeHeight, { r: 16, g: 16, b: 16 });
        renderer.fillRect(0, 600 - wipeHeight, 800, wipeHeight, { r: 16, g: 16, b: 16 });
    }

    /**
     * Render buttons
     */
    private renderButtons(renderer: Renderer): void {
        for (const button of this.buttons) {
            this.renderButton(renderer, button);
        }
    }

    /**
     * Render individual button
     */
    private renderButton(renderer: Renderer, button: MenuButton): void {
        const color = button.highlighted ? 
            { r: 72, g: 48, b: 12 } : 
            button.enabled ? 
                { r: 48, g: 48, b: 48 } : 
                { r: 24, g: 24, b: 24 };
        
        // Button background (if highlighted)
        if (button.highlighted) {
            renderer.fillRect(button.x - 5, button.y - 5, button.width + 10, button.height + 10, { r: 16, g: 16, b: 16 });
            renderer.drawRect(button.x - 5, button.y - 5, button.width + 10, button.height + 10, color);
        }
        
        // Button text
        this.renderText(renderer, button.text, button.x + button.width / 2, button.y + button.height / 2, 'medium', color, 'center');
        
        // Hotkey hint
        if (button.hotkey && button.enabled) {
            const hotkeyText = `[${button.hotkey.replace('Key', '')}]`;
            this.renderText(renderer, hotkeyText, button.x + button.width + 10, button.y + button.height / 2, 'small', { r: 32, g: 32, b: 32 }, 'left');
        }
    }

    /**
     * Render text with retro styling
     */
    private renderText(
        renderer: Renderer, 
        text: string, 
        x: number, 
        y: number, 
        size: 'small' | 'medium' | 'large', 
        color: Color, 
        align: 'left' | 'center' | 'right'
    ): void {
        const fontSize = size === 'small' ? 12 : size === 'medium' ? 16 : 24;
        
        // Simple text rendering for now - would use proper font rendering in full implementation
        let textX = x;
        if (align === 'center') {
            textX = x - (text.length * fontSize * 0.3);
        } else if (align === 'right') {
            textX = x - (text.length * fontSize * 0.6);
        }
        
        // Draw text as rectangles (simplified implementation)
        for (let i = 0; i < text.length; i++) {
            const charX = textX + i * fontSize * 0.6;
            
            if (text[i] !== ' ') {
                renderer.fillRect(charX, y - fontSize / 2, fontSize * 0.5, fontSize, color);
            }
        }
    }

    /**
     * Get current menu state
     */
    getCurrentState(): MenuState {
        return this.currentState;
    }

    /**
     * Get current settings
     */
    getGameSettings(): GameSettings {
        return { ...this.gameSettings };
    }

    /**
     * Set new game settings externally
     */
    setNewGameSettings(settings: Partial<NewGameSettings>): void {
        Object.assign(this.newGameSettings, settings);
        if (this.currentState === MenuState.NewGame) {
            this.updateNewGameMenuText();
        }
    }

    /**
     * Dispose menu system
     */
    dispose(): void {
        // Clean up background particles
        if (this.particles) {
            this.backgroundParticles.forEach(id => {
                this.particles!.removeEmitter(id);
            });
        }
        
        this.logger.info('🎮 Main menu system disposed');
    }
}