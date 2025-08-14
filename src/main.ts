/**
 * Space Explorer 16-Bit - Main Entry Point
 * AI-Generated 2D space exploration game with retro CRT aesthetic
 */

import { Game } from '@core/Game';
import { Platform, PlatformDetector } from '@utils/Platform';
import { Logger } from '@utils/Logger';

// Global game instance
let game: Game | null = null;

/**
 * Loading progress management
 */
class LoadingManager {
    private progressElement: HTMLElement;
    private textElement: HTMLElement;
    private currentProgress = 0;

    constructor() {
        this.progressElement = document.getElementById('loadingProgress')!;
        this.textElement = document.getElementById('loadingText')!;
    }

    updateProgress(progress: number, text?: string): void {
        this.currentProgress = Math.max(this.currentProgress, progress);
        this.progressElement.style.width = `${this.currentProgress}%`;
        
        if (text) {
            this.textElement.textContent = text;
        }
    }

    hide(): void {
        const loadingScreen = document.getElementById('loadingScreen')!;
        loadingScreen.classList.add('hidden');
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

/**
 * Initialize the game with proper error handling and loading
 */
async function initializeGame(): Promise<void> {
    const loader = new LoadingManager();
    const logger = new Logger('Main');
    
    try {
        logger.info('🚀 Starting Space Explorer 16-Bit initialization...');
        
        // Detect platform for adaptive features
        loader.updateProgress(10, 'DETECTING PLATFORM...');
        const platform = PlatformDetector.detect();
        logger.info(`Platform detected: ${platform}`);
        
        // Initialize canvas and context
        loader.updateProgress(20, 'INITIALIZING GRAPHICS...');
        const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        if (!canvas) {
            throw new Error('Game canvas not found');
        }
        
        // Adjust canvas for mobile
        if (platform === Platform.Mobile) {
            adjustCanvasForMobile(canvas);
        }
        
        // Pre-load critical resources
        loader.updateProgress(40, 'LOADING CORE SYSTEMS...');
        await preloadCriticalResources();
        
        // Initialize game engine
        loader.updateProgress(60, 'INITIALIZING GAME ENGINE...');
        game = new Game(canvas, platform);
        
        // Initialize procedural generators
        loader.updateProgress(80, 'GENERATING GALAXY...');
        
        // Add additional progress updates during galaxy generation
        const progressInterval = setInterval(() => {
            const currentProgress = Math.min(95, 80 + Math.floor(Math.random() * 10));
            loader.updateProgress(currentProgress, 'GENERATING GALAXY...');
        }, 1000);
        
        try {
            await game.initialize();
            clearInterval(progressInterval);
        } catch (error) {
            clearInterval(progressInterval);
            throw error;
        }
        
        // Final setup
        loader.updateProgress(95, 'FINAL PREPARATIONS...');
        setupEventListeners();
        
        // Start the game
        loader.updateProgress(100, 'LAUNCHING SPACE EXPLORER...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for effect
        
        loader.hide();
        await game.start();
        
        logger.info('✅ Game successfully initialized and started');
        
    } catch (error) {
        logger.error('❌ Failed to initialize game:', error);
        showErrorScreen(error as Error);
    }
}

/**
 * Adjust canvas size and settings for mobile devices
 */
function adjustCanvasForMobile(canvas: HTMLCanvasElement): void {
    const container = document.getElementById('gameContainer')!;
    const containerRect = container.getBoundingClientRect();
    
    // Calculate optimal size maintaining aspect ratio
    const targetRatio = 1024 / 768;
    let width = containerRect.width - 20; // margin
    let height = width / targetRatio;
    
    if (height > containerRect.height - 20) {
        height = containerRect.height - 20;
        width = height * targetRatio;
    }
    
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    // Maintain internal resolution for pixel-perfect rendering
    canvas.width = 1024;
    canvas.height = 768;
}

/**
 * Pre-load any critical resources
 */
async function preloadCriticalResources(): Promise<void> {
    // For now, just simulate loading time
    // In future phases, this will load essential assets
    return new Promise(resolve => {
        setTimeout(resolve, 200);
    });
}

/**
 * Setup global event listeners
 */
function setupEventListeners(): void {
    // Handle window resize
    window.addEventListener('resize', () => {
        if (game && PlatformDetector.detect() === Platform.Mobile) {
            const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
            adjustCanvasForMobile(canvas);
            game.handleResize();
        }
    });
    
    // Handle visibility changes (pause when tab not visible)
    document.addEventListener('visibilitychange', () => {
        if (game) {
            if (document.hidden) {
                game.pause();
            } else {
                game.resume();
            }
        }
    });
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (game) {
            game.cleanup();
        }
    });
    
    // Handle errors
    window.addEventListener('error', (event) => {
        const logger = new Logger('GlobalError');
        logger.error('Unhandled error:', event.error);
        
        if (game) {
            game.handleError(event.error);
        }
    });
}

/**
 * Show error screen with debugging information
 */
function showErrorScreen(error: Error): void {
    const loadingScreen = document.getElementById('loadingScreen')!;
    const loadingText = document.getElementById('loadingText')!;
    const loadingBar = document.getElementById('loadingBar')!;
    
    loadingText.textContent = '❌ INITIALIZATION FAILED';
    loadingText.style.color = '#f00';
    loadingBar.style.display = 'none';
    
    // Create error details
    const errorDetails = document.createElement('div');
    errorDetails.style.cssText = `
        color: #f00;
        font-family: monospace;
        font-size: 12px;
        margin-top: 20px;
        text-align: left;
        background: rgba(255, 0, 0, 0.1);
        padding: 10px;
        border: 1px solid #f00;
        max-width: 80%;
        overflow-wrap: break-word;
    `;
    errorDetails.innerHTML = `
        <div><strong>Error:</strong> ${error.message}</div>
        <div><strong>Stack:</strong></div>
        <pre style="font-size: 10px; margin-top: 5px;">${error.stack}</pre>
        <div style="margin-top: 10px; color: #ff0;">
            Please check the browser console for more details.
        </div>
    `;
    
    loadingScreen.appendChild(errorDetails);
}

/**
 * Development helpers (only in dev mode)
 */
if (import.meta.env.DEV) {
    // Expose game instance for debugging
    (window as any).__SPACE_EXPLORER_GAME__ = () => game;
    
    // Add debug key bindings
    document.addEventListener('keydown', (event) => {
        if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && event.key === 'I')) {
            // Allow developer tools
            return;
        }
        
        if (game && event.ctrlKey) {
            switch (event.key) {
                case 'r':
                    // Restart game
                    event.preventDefault();
                    location.reload();
                    break;
                case 'p':
                    // Toggle pause
                    event.preventDefault();
                    if (game.getPaused()) {
                        game.resume();
                    } else {
                        game.pause();
                    }
                    break;
            }
        }
    });
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}

// Export for potential external access
export { game };